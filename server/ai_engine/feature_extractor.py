"""
Feature Extractor for Queen AI Neural Network

Extracts 29 normalized features from chunk-based observation data.
Processes raw observation data from frontend into NN-ready features.

Feature Layout (29 total):
- Top 5 Chunks (25): 5 chunks × 5 features each
  - Normalized chunk ID (0-1)
  - Worker presence density (0-1) - uses workersPresent, not miningWorkers
  - Protector density (0-1)
  - Energy parasite rate (-1 to +1, scaled to 0-1)
  - Combat parasite rate (-1 to +1, scaled to 0-1)
- Spawn Capacities (2):
  - Energy spawn capacity (0-1)
  - Combat spawn capacity (0-1)
- Player State (2):
  - Player energy rate (-1 to +1, scaled to 0-1)
  - Player mineral rate (-1 to +1, scaled to 0-1)
"""

import logging
import random
from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass
from collections import defaultdict
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class FeatureConfig:
    """Configuration for feature extraction."""

    # Chunk configuration
    total_chunks: int = 256  # 16x16 grid
    top_chunks: int = 5  # Top N chunks by mining activity
    features_per_chunk: int = 5

    # Queen energy configuration
    max_energy: float = 100.0
    energy_parasite_cost: float = 15.0
    combat_parasite_cost: float = 25.0
    max_energy_parasites: int = 6  # floor(100/15)
    max_combat_parasites: int = 4  # floor(100/25)


class FeatureExtractor:
    """
    Extracts 29 normalized features from observation data.

    Processes chunk-based observations into features for the split-head NN:
    - 25 features for top 5 mining chunks
    - 2 features for spawn capacities
    - 2 features for player state (energy rate, mineral rate)
    """

    def __init__(self, config: Optional[FeatureConfig] = None):
        self.config = config or FeatureConfig()
        self._feature_names = self._initialize_feature_names()

    def _initialize_feature_names(self) -> List[str]:
        """Get ordered list of feature names."""
        names = []

        # Top 5 chunks (25 features)
        for i in range(self.config.top_chunks):
            names.extend([
                f'chunk_{i}_id',
                f'chunk_{i}_worker_presence',
                f'chunk_{i}_protector_density',
                f'chunk_{i}_energy_parasite_rate',
                f'chunk_{i}_combat_parasite_rate'
            ])

        # Spawn capacities (2 features)
        names.extend([
            'spawn_capacity_energy',
            'spawn_capacity_combat'
        ])

        # Player state (2 features)
        names.extend([
            'player_energy_rate',
            'player_mineral_rate'
        ])

        return names

    @property
    def feature_names(self) -> List[str]:
        """Get list of feature names in order."""
        return self._feature_names

    @property
    def feature_count(self) -> int:
        """Get total number of features."""
        return len(self._feature_names)

    def extract(self, observation: Dict[str, Any]) -> np.ndarray:
        """
        Extract 29 features from V2 observation data.

        Args:
            observation: ObservationDataV2 from frontend

        Returns:
            numpy array of 29 normalized features
        """
        features = np.zeros(29, dtype=np.float32)

        try:
            # Extract chunk-based features (indices 0-24)
            self._extract_chunk_features(observation, features)

            # Extract spawn capacity features (indices 25-26)
            self._extract_spawn_capacity_features(observation, features)

            # Extract player state features (indices 27-28)
            self._extract_player_state_features(observation, features)

            # Ensure all features are in valid range
            features = np.clip(features, 0.0, 1.0)

        except Exception as e:
            logger.error(f"Error extracting V2 features: {e}")
            # Return zero features on error (safe default)

        return features

    def _extract_chunk_features(self, obs: Dict[str, Any], features: np.ndarray) -> None:
        """
        Extract features for top 5 chunks by worker presence density.

        Uses workersPresent (all workers in territory) rather than miningWorkers
        to capture all threats - workers traveling, fleeing, or idle are still
        valid targets for the Queen's parasites.

        For each of the top 5 chunks:
        - Normalized chunk ID
        - Worker density (presence-based)
        - Protector density
        - Energy parasite rate
        - Combat parasite rate
        """
        workers_present = obs.get('workersPresent', [])
        protectors = obs.get('protectors', [])
        parasites_start = obs.get('parasitesStart', [])
        parasites_end = obs.get('parasitesEnd', [])

        # Count workers per chunk (using workersPresent for territorial awareness)
        workers_by_chunk = defaultdict(int)
        for worker in workers_present:
            chunk_id = worker.get('chunkId', -1)
            if chunk_id >= 0:
                workers_by_chunk[chunk_id] += 1

        # Get top 5 chunks by worker count
        total_workers = len(workers_present)
        sorted_chunks = sorted(
            workers_by_chunk.items(),
            key=lambda x: x[1],
            reverse=True
        )[:self.config.top_chunks]

        # Shuffle to prevent NN from learning "index 0 = most workers" bias
        # This forces NN to learn from actual feature values, not position
        sorted_chunks = list(sorted_chunks)
        random.shuffle(sorted_chunks)

        # Count protectors per chunk
        protectors_by_chunk = defaultdict(int)
        for protector in protectors:
            chunk_id = protector.get('chunkId', -1)
            if chunk_id >= 0:
                protectors_by_chunk[chunk_id] += 1
        total_protectors = len(protectors)

        # Count parasites at start and end per chunk
        energy_start_by_chunk = defaultdict(int)
        combat_start_by_chunk = defaultdict(int)
        energy_end_by_chunk = defaultdict(int)
        combat_end_by_chunk = defaultdict(int)

        for p in parasites_start:
            chunk_id = p.get('chunkId', -1)
            if chunk_id >= 0:
                if p.get('type') == 'combat':
                    combat_start_by_chunk[chunk_id] += 1
                else:
                    energy_start_by_chunk[chunk_id] += 1

        for p in parasites_end:
            chunk_id = p.get('chunkId', -1)
            if chunk_id >= 0:
                if p.get('type') == 'combat':
                    combat_end_by_chunk[chunk_id] += 1
                else:
                    energy_end_by_chunk[chunk_id] += 1

        # Extract features for each of top 5 chunks
        for i in range(self.config.top_chunks):
            base_idx = i * self.config.features_per_chunk

            if i < len(sorted_chunks):
                chunk_id, worker_count = sorted_chunks[i]

                # Normalized chunk ID (0-255 -> 0-1)
                features[base_idx] = chunk_id / (self.config.total_chunks - 1)

                # Worker density (workers in chunk / total workers)
                if total_workers > 0:
                    features[base_idx + 1] = worker_count / total_workers
                else:
                    features[base_idx + 1] = 0.0

                # Protector density (protectors in chunk / total protectors)
                if total_protectors > 0:
                    features[base_idx + 2] = protectors_by_chunk[chunk_id] / total_protectors
                else:
                    features[base_idx + 2] = 0.0

                # Energy parasite rate (scaled from -1,+1 to 0,1)
                energy_rate = self._calculate_rate(
                    energy_start_by_chunk[chunk_id],
                    energy_end_by_chunk[chunk_id]
                )
                features[base_idx + 3] = (energy_rate + 1.0) / 2.0  # -1,+1 -> 0,1

                # Combat parasite rate (scaled from -1,+1 to 0,1)
                combat_rate = self._calculate_rate(
                    combat_start_by_chunk[chunk_id],
                    combat_end_by_chunk[chunk_id]
                )
                features[base_idx + 4] = (combat_rate + 1.0) / 2.0  # -1,+1 -> 0,1

            else:
                # Pad with zeros if fewer than 5 chunks have activity
                features[base_idx:base_idx + 5] = 0.0

    def _extract_spawn_capacity_features(self, obs: Dict[str, Any], features: np.ndarray) -> None:
        """
        Extract spawn capacity features.

        Formula: floor(current_energy / cost) / max_affordable
        - Energy capacity: floor(current/15) / 6
        - Combat capacity: floor(current/25) / 4
        """
        queen_energy = obs.get('queenEnergy', {})
        current_energy = queen_energy.get('current', 0)

        # Energy spawn capacity
        energy_affordable = int(current_energy // self.config.energy_parasite_cost)
        features[25] = min(1.0, energy_affordable / self.config.max_energy_parasites)

        # Combat spawn capacity
        combat_affordable = int(current_energy // self.config.combat_parasite_cost)
        features[26] = min(1.0, combat_affordable / self.config.max_combat_parasites)

    def _extract_player_state_features(self, obs: Dict[str, Any], features: np.ndarray) -> None:
        """
        Extract player state features: energy rate and mineral rate.

        Formula: (end - start) / max(start, end)
        - Negative rate = player losing resources (good for Queen)
        - Positive rate = player gaining resources (bad for Queen)

        Scaled from -1,+1 to 0,1 for NN input.
        """
        # Player energy rate (index 27)
        player_energy = obs.get('playerEnergy', {})
        energy_start = player_energy.get('start', 0)
        energy_end = player_energy.get('end', 0)
        energy_rate = self._calculate_rate(energy_start, energy_end)
        features[27] = (energy_rate + 1.0) / 2.0  # -1,+1 -> 0,1

        # Player mineral rate (index 28)
        player_minerals = obs.get('playerMinerals', {})
        mineral_start = player_minerals.get('start', 0)
        mineral_end = player_minerals.get('end', 0)
        mineral_rate = self._calculate_rate(mineral_start, mineral_end)
        features[28] = (mineral_rate + 1.0) / 2.0  # -1,+1 -> 0,1

    def _calculate_rate(self, start: float, end: float) -> float:
        """
        Calculate rate of change using the formula: (end - start) / max(start, end)

        Returns value in [-1, +1] range:
        - -1: Complete decrease (end = 0, start > 0)
        - 0: No change
        - +1: Complete increase from zero (start = 0, end > 0)
        """
        if start == 0 and end == 0:
            return 0.0

        max_val = max(start, end)
        if max_val == 0:
            return 0.0

        return (end - start) / max_val

    def describe_features(self, features: np.ndarray) -> Dict[str, float]:
        """
        Create a descriptive dictionary of feature values.

        Args:
            features: Feature array (28 values)

        Returns:
            Dictionary mapping feature names to values
        """
        if len(features) != len(self._feature_names):
            return {}

        return dict(zip(self._feature_names, features.tolist()))

    def get_top_chunks_from_features(self, features: np.ndarray) -> List[Tuple[int, float]]:
        """
        Extract top chunk IDs and their worker densities from features.

        Args:
            features: Feature array

        Returns:
            List of (chunk_id, worker_density) tuples
        """
        chunks = []
        for i in range(self.config.top_chunks):
            base_idx = i * self.config.features_per_chunk
            # Denormalize chunk ID
            chunk_id = int(features[base_idx] * (self.config.total_chunks - 1))
            worker_density = features[base_idx + 1]
            if worker_density > 0:
                chunks.append((chunk_id, worker_density))
        return chunks

    def get_spawn_capacities_from_features(self, features: np.ndarray) -> Dict[str, float]:
        """
        Extract spawn capacities from features.

        Args:
            features: Feature array

        Returns:
            Dictionary with 'energy' and 'combat' capacities
        """
        return {
            'energy': features[25],
            'combat': features[26]
        }

    def get_player_energy_rate_from_features(self, features: np.ndarray) -> float:
        """
        Extract player energy rate from features.

        Args:
            features: Feature array

        Returns:
            Rate in original -1 to +1 scale
        """
        # Convert back from 0,1 to -1,+1
        return (features[27] * 2.0) - 1.0

    def get_player_mineral_rate_from_features(self, features: np.ndarray) -> float:
        """
        Extract player mineral rate from features.

        Args:
            features: Feature array

        Returns:
            Rate in original -1 to +1 scale
        """
        # Convert back from 0,1 to -1,+1
        return (features[28] * 2.0) - 1.0
