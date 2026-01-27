"""
GPU-Optimized Utility Functions for Simulation Gate

Provides PyTorch-based implementations with automatic GPU detection.
Falls back to CPU gracefully if CUDA is not available.
"""

import logging
from typing import Tuple, Optional, Union
from dataclasses import dataclass

import numpy as np

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    torch = None

logger = logging.getLogger(__name__)

# Grid constants
CHUNKS_PER_AXIS = 20
MAX_CHUNK_DISTANCE = 26.87  # sqrt(19² + 19²)


@dataclass
class DeviceInfo:
    """Information about compute device."""
    device: str
    device_name: str
    is_cuda: bool
    cuda_device_count: int
    memory_allocated_mb: float
    memory_reserved_mb: float


def get_device() -> str:
    """
    Get best available compute device.

    Returns:
        'cuda' if GPU available, 'cpu' otherwise
    """
    if not TORCH_AVAILABLE:
        return 'cpu'

    if torch.cuda.is_available():
        return 'cuda'
    return 'cpu'


def get_device_info() -> DeviceInfo:
    """
    Get detailed information about current compute device.

    Returns:
        DeviceInfo with device details
    """
    if not TORCH_AVAILABLE:
        return DeviceInfo(
            device='cpu',
            device_name='CPU (PyTorch not available)',
            is_cuda=False,
            cuda_device_count=0,
            memory_allocated_mb=0.0,
            memory_reserved_mb=0.0
        )

    device = get_device()
    is_cuda = device == 'cuda'

    if is_cuda:
        device_name = torch.cuda.get_device_name(0)
        cuda_count = torch.cuda.device_count()
        mem_allocated = torch.cuda.memory_allocated() / (1024 * 1024)
        mem_reserved = torch.cuda.memory_reserved() / (1024 * 1024)
    else:
        device_name = 'CPU'
        cuda_count = 0
        mem_allocated = 0.0
        mem_reserved = 0.0

    return DeviceInfo(
        device=device,
        device_name=device_name,
        is_cuda=is_cuda,
        cuda_device_count=cuda_count,
        memory_allocated_mb=mem_allocated,
        memory_reserved_mb=mem_reserved
    )


class GPUCostFunction:
    """
    GPU-accelerated cost function for batch processing.

    Processes multiple spawn candidates in parallel for efficiency.
    """

    def __init__(self, chunks_per_axis: int = CHUNKS_PER_AXIS, device: Optional[str] = None):
        """
        Initialize GPU cost function.

        Args:
            chunks_per_axis: Grid dimension
            device: Force specific device ('cpu' or 'cuda'), auto-detect if None
        """
        self.chunks_per_axis = chunks_per_axis
        self.max_distance = np.sqrt(2) * (chunks_per_axis - 1)

        if device is None:
            self.device = get_device()
        else:
            self.device = device

        self._torch_available = TORCH_AVAILABLE

        if self._torch_available:
            logger.info(f"GPUCostFunction initialized on device: {self.device}")
        else:
            logger.warning("PyTorch not available, using numpy fallback")

    def chunk_to_coords_batch(self, chunk_ids: Union[np.ndarray, 'torch.Tensor']) -> Union[np.ndarray, 'torch.Tensor']:
        """
        Convert batch of chunk IDs to grid coordinates.

        Args:
            chunk_ids: Chunk IDs, shape [N]

        Returns:
            Coordinates, shape [N, 2]
        """
        if self._torch_available and isinstance(chunk_ids, torch.Tensor):
            chunk_ids = torch.clamp(chunk_ids, min=0)
            x = chunk_ids % self.chunks_per_axis
            z = chunk_ids // self.chunks_per_axis
            return torch.stack([x, z], dim=-1).float()
        else:
            chunk_ids = np.asarray(chunk_ids)
            chunk_ids = np.maximum(chunk_ids, 0)
            x = chunk_ids % self.chunks_per_axis
            z = chunk_ids // self.chunks_per_axis
            return np.stack([x, z], axis=-1).astype(np.float32)

    def distance_matrix(
        self,
        spawn_coords: Union[np.ndarray, 'torch.Tensor'],
        target_coords: Union[np.ndarray, 'torch.Tensor']
    ) -> Union[np.ndarray, 'torch.Tensor']:
        """
        Calculate distance matrix between spawn and target coordinates.

        Args:
            spawn_coords: Shape [B, 2]
            target_coords: Shape [T, 2]

        Returns:
            Distance matrix, shape [B, T]
        """
        if self._torch_available and isinstance(spawn_coords, torch.Tensor):
            # [B, 1, 2] - [1, T, 2] -> [B, T, 2]
            diff = spawn_coords.unsqueeze(1) - target_coords.unsqueeze(0)
            return torch.sqrt(torch.sum(diff ** 2, dim=-1))
        else:
            diff = spawn_coords[:, np.newaxis, :] - target_coords[np.newaxis, :, :]
            return np.sqrt(np.sum(diff ** 2, axis=-1))

    def calculate_survival_batch(
        self,
        spawn_chunks: np.ndarray,
        protector_chunks: np.ndarray,
        kill_range: float = 2.0,
        safe_range: float = 8.0,
        threat_decay: float = 0.5
    ) -> np.ndarray:
        """
        Calculate survival probability for batch of spawn locations.

        Args:
            spawn_chunks: Spawn chunk IDs, shape [B]
            protector_chunks: Protector chunk IDs, shape [P]
            kill_range: Distance below which survival = 0
            safe_range: Distance above which threat = 0
            threat_decay: Exponential decay rate

        Returns:
            Survival probabilities, shape [B]
        """
        if len(protector_chunks) == 0:
            return np.ones(len(spawn_chunks), dtype=np.float32)

        if self._torch_available:
            return self._survival_torch(
                spawn_chunks, protector_chunks,
                kill_range, safe_range, threat_decay
            )
        else:
            return self._survival_numpy(
                spawn_chunks, protector_chunks,
                kill_range, safe_range, threat_decay
            )

    def _survival_torch(
        self,
        spawn_chunks: np.ndarray,
        protector_chunks: np.ndarray,
        kill_range: float,
        safe_range: float,
        threat_decay: float
    ) -> np.ndarray:
        """PyTorch implementation of survival calculation."""
        with torch.no_grad():
            spawn_t = torch.tensor(spawn_chunks, device=self.device)
            protector_t = torch.tensor(protector_chunks, device=self.device)

            spawn_coords = self.chunk_to_coords_batch(spawn_t)
            protector_coords = self.chunk_to_coords_batch(protector_t)

            # Distance matrix [B, P]
            distances = self.distance_matrix(spawn_coords, protector_coords)

            # Calculate threat for each protector
            threat = torch.zeros_like(distances)

            # Kill zone: threat = 1.0
            kill_mask = distances < kill_range
            threat = torch.where(kill_mask, torch.ones_like(threat), threat)

            # Threat zone: exponential decay
            threat_mask = (distances >= kill_range) & (distances < safe_range)
            threat_zone_value = torch.exp(-threat_decay * (distances - kill_range))
            threat = torch.where(threat_mask, threat_zone_value, threat)

            # Safe zone: threat = 0 (already initialized)

            # Survival = product of (1 - threat) across all protectors
            survival = torch.prod(1.0 - threat, dim=-1)

            return survival.cpu().numpy()

    def _survival_numpy(
        self,
        spawn_chunks: np.ndarray,
        protector_chunks: np.ndarray,
        kill_range: float,
        safe_range: float,
        threat_decay: float
    ) -> np.ndarray:
        """Numpy implementation of survival calculation."""
        spawn_coords = self.chunk_to_coords_batch(spawn_chunks)
        protector_coords = self.chunk_to_coords_batch(protector_chunks)

        distances = self.distance_matrix(spawn_coords, protector_coords)

        threat = np.zeros_like(distances)

        # Kill zone
        kill_mask = distances < kill_range
        threat = np.where(kill_mask, 1.0, threat)

        # Threat zone
        threat_mask = (distances >= kill_range) & (distances < safe_range)
        threat_zone_value = np.exp(-threat_decay * (distances - kill_range))
        threat = np.where(threat_mask, threat_zone_value, threat)

        # Survival = product of (1 - threat)
        survival = np.prod(1.0 - threat, axis=-1)

        return survival.astype(np.float32)

    def calculate_disruption_batch(
        self,
        spawn_chunks: np.ndarray,
        worker_chunks: np.ndarray,
        survival_probs: np.ndarray,
        flee_range: float = 3.0,
        ignore_range: float = 10.0,
        disruption_decay: float = 0.3
    ) -> np.ndarray:
        """
        Calculate worker disruption for batch of spawn locations.

        Args:
            spawn_chunks: Spawn chunk IDs, shape [B]
            worker_chunks: Worker chunk IDs, shape [W]
            survival_probs: Survival probabilities, shape [B]
            flee_range: Distance below which disruption = 1.0
            ignore_range: Distance above which disruption = 0
            disruption_decay: Exponential decay rate

        Returns:
            Disruption values, shape [B]
        """
        if len(worker_chunks) == 0:
            return np.zeros(len(spawn_chunks), dtype=np.float32)

        if self._torch_available:
            return self._disruption_torch(
                spawn_chunks, worker_chunks, survival_probs,
                flee_range, ignore_range, disruption_decay
            )
        else:
            return self._disruption_numpy(
                spawn_chunks, worker_chunks, survival_probs,
                flee_range, ignore_range, disruption_decay
            )

    def _disruption_torch(
        self,
        spawn_chunks: np.ndarray,
        worker_chunks: np.ndarray,
        survival_probs: np.ndarray,
        flee_range: float,
        ignore_range: float,
        disruption_decay: float
    ) -> np.ndarray:
        """PyTorch implementation of disruption calculation."""
        with torch.no_grad():
            spawn_t = torch.tensor(spawn_chunks, device=self.device)
            worker_t = torch.tensor(worker_chunks, device=self.device)
            survival_t = torch.tensor(survival_probs, device=self.device)

            spawn_coords = self.chunk_to_coords_batch(spawn_t)
            worker_coords = self.chunk_to_coords_batch(worker_t)

            # Distance matrix [B, W]
            distances = self.distance_matrix(spawn_coords, worker_coords)

            # Calculate disruption factor
            disruption = torch.zeros_like(distances)

            # Flee zone: disruption = 1.0
            flee_mask = distances < flee_range
            disruption = torch.where(flee_mask, torch.ones_like(disruption), disruption)

            # Effect zone: exponential decay
            effect_mask = (distances >= flee_range) & (distances < ignore_range)
            effect_value = torch.exp(-disruption_decay * (distances - flee_range))
            disruption = torch.where(effect_mask, effect_value, disruption)

            # Sum disruption across workers, scale by survival
            total_disruption = torch.sum(disruption, dim=-1) * survival_t

            return total_disruption.cpu().numpy()

    def _disruption_numpy(
        self,
        spawn_chunks: np.ndarray,
        worker_chunks: np.ndarray,
        survival_probs: np.ndarray,
        flee_range: float,
        ignore_range: float,
        disruption_decay: float
    ) -> np.ndarray:
        """Numpy implementation of disruption calculation."""
        spawn_coords = self.chunk_to_coords_batch(spawn_chunks)
        worker_coords = self.chunk_to_coords_batch(worker_chunks)

        distances = self.distance_matrix(spawn_coords, worker_coords)

        disruption = np.zeros_like(distances)

        # Flee zone
        flee_mask = distances < flee_range
        disruption = np.where(flee_mask, 1.0, disruption)

        # Effect zone
        effect_mask = (distances >= flee_range) & (distances < ignore_range)
        effect_value = np.exp(-disruption_decay * (distances - flee_range))
        disruption = np.where(effect_mask, effect_value, disruption)

        total_disruption = np.sum(disruption, axis=-1) * survival_probs

        return total_disruption.astype(np.float32)

    def evaluate_candidates_batch(
        self,
        candidate_chunks: np.ndarray,
        protector_chunks: np.ndarray,
        worker_chunks: np.ndarray,
        hive_chunk: int,
        config_params: dict
    ) -> dict:
        """
        Evaluate multiple spawn candidates in parallel.

        Args:
            candidate_chunks: Candidate spawn locations, shape [B]
            protector_chunks: Current protector locations, shape [P]
            worker_chunks: Current worker locations, shape [W]
            hive_chunk: Hive chunk ID
            config_params: Dict with kill_range, safe_range, etc.

        Returns:
            Dict with survival, disruption, and combined scores for each candidate
        """
        batch_size = len(candidate_chunks)

        # Calculate survival
        survival = self.calculate_survival_batch(
            candidate_chunks,
            protector_chunks,
            kill_range=config_params.get('kill_range', 2.0),
            safe_range=config_params.get('safe_range', 8.0),
            threat_decay=config_params.get('threat_decay', 0.5)
        )

        # Calculate disruption
        disruption = self.calculate_disruption_batch(
            candidate_chunks,
            worker_chunks,
            survival,
            flee_range=config_params.get('flee_range', 3.0),
            ignore_range=config_params.get('ignore_range', 10.0),
            disruption_decay=config_params.get('disruption_decay', 0.3)
        )

        # Calculate location penalty (distance to nearest worker or hive)
        if len(worker_chunks) > 0:
            # Active mode: penalize distance from nearest worker
            if self._torch_available:
                with torch.no_grad():
                    spawn_t = torch.tensor(candidate_chunks, device=self.device)
                    worker_t = torch.tensor(worker_chunks, device=self.device)
                    spawn_coords = self.chunk_to_coords_batch(spawn_t)
                    worker_coords = self.chunk_to_coords_batch(worker_t)
                    distances = self.distance_matrix(spawn_coords, worker_coords)
                    min_dist = torch.min(distances, dim=-1)[0]
                    location = -min_dist.cpu().numpy() / self.max_distance * config_params.get('worker_proximity_weight', 0.4)
            else:
                spawn_coords = self.chunk_to_coords_batch(candidate_chunks)
                worker_coords = self.chunk_to_coords_batch(worker_chunks)
                distances = self.distance_matrix(spawn_coords, worker_coords)
                min_dist = np.min(distances, axis=-1)
                location = -min_dist / self.max_distance * config_params.get('worker_proximity_weight', 0.4)
        else:
            # Idle mode: penalize distance from hive
            hive_coords = self.chunk_to_coords_batch(np.array([hive_chunk]))[0]
            spawn_coords = self.chunk_to_coords_batch(candidate_chunks)
            hive_dist = np.sqrt(np.sum((spawn_coords - hive_coords) ** 2, axis=-1))
            location = -hive_dist / self.max_distance * config_params.get('hive_proximity_weight', 0.3)

        # Combined score
        survival_weight = config_params.get('survival_weight', 0.4)
        disruption_weight = config_params.get('disruption_weight', 0.5)
        location_weight = config_params.get('location_weight', 0.1)

        scores = (
            survival_weight * survival +
            disruption_weight * disruption +
            location_weight * (1 + location)  # Location is negative penalty
        )

        return {
            'survival': survival,
            'disruption': disruption,
            'location': location,
            'scores': scores,
            'best_idx': int(np.argmax(scores)),
            'best_chunk': int(candidate_chunks[np.argmax(scores)])
        }

    def get_memory_usage(self) -> float:
        """
        Get current GPU memory usage in MB.

        Returns:
            Memory usage in MB, or 0 if not using CUDA
        """
        if not self._torch_available or self.device != 'cuda':
            return 0.0

        return torch.cuda.memory_allocated() / (1024 * 1024)

    def clear_cache(self) -> None:
        """Clear GPU memory cache."""
        if self._torch_available and self.device == 'cuda':
            torch.cuda.empty_cache()


# Singleton instance
_gpu_cost_function: Optional[GPUCostFunction] = None


def get_gpu_cost_function() -> GPUCostFunction:
    """Get or create singleton GPU cost function."""
    global _gpu_cost_function
    if _gpu_cost_function is None:
        _gpu_cost_function = GPUCostFunction()
    return _gpu_cost_function
