"""
Worker Disruption Potential Calculation

Estimates combat effectiveness based on reachable targets vs threats.
Uses actual game mechanics:
- Energy Parasite: workers are targets (60u pursuit), protectors are threats (12u attack)
- Combat Parasite: both workers and protectors are valid targets (75u pursuit)
"""

import numpy as np
from typing import List, Union
import logging

from .utils import chunk_distance_matrix, CHUNKS_PER_AXIS
from ..config import SimulationGateConfig

logger = logging.getLogger(__name__)


def calculate_worker_disruption(
    spawn_chunk: Union[int, np.ndarray],
    spawn_type: str,
    worker_chunks: Union[List[int], np.ndarray],
    protector_chunks: Union[List[int], np.ndarray],
    config: SimulationGateConfig
) -> Union[float, np.ndarray]:
    """
    Calculate worker disruption potential for spawned parasite.

    Energy Parasite Formula:
        D = (workers_in_range - protectors_threatening) / total_workers
        - workers_in_range: workers within energy_pursuit_range
        - protectors_threatening: protectors within protector_attack_range
        - Range: [-1.0, 1.0] (can go negative when protectors > reachable workers)

    Combat Parasite Formula:
        D = (workers_in_range + protectors_in_range) / (total_workers + total_protectors)
        - Both workers and protectors are valid targets
        - Range: [0.0, 1.0]

    Args:
        spawn_chunk: Spawn location chunk ID (scalar or [B] array)
        spawn_type: 'energy' or 'combat'
        worker_chunks: Worker chunk IDs ([W] or [B, W] array)
        protector_chunks: Protector chunk IDs ([P] or [B, P] array)
        config: Simulation configuration

    Returns:
        Disruption potential (scalar or [B] array)
    """
    # Convert to numpy arrays
    spawn_chunk = np.atleast_1d(np.asarray(spawn_chunk))  # [B]
    worker_chunks = np.asarray(worker_chunks) if len(worker_chunks) > 0 else np.array([])
    protector_chunks = np.asarray(protector_chunks) if len(protector_chunks) > 0 else np.array([])

    batch_size = len(spawn_chunk)

    # Handle invalid spawn chunks
    invalid_spawn = spawn_chunk < 0

    if spawn_type == 'energy':
        result = _calculate_energy_disruption(
            spawn_chunk, worker_chunks, protector_chunks, config
        )
    else:  # combat
        result = _calculate_combat_disruption(
            spawn_chunk, worker_chunks, protector_chunks, config
        )

    # Zero out invalid spawns
    result[invalid_spawn] = 0.0

    # Return scalar if single input
    if batch_size == 1:
        return float(result[0])

    return result


def _calculate_energy_disruption(
    spawn_chunk: np.ndarray,
    worker_chunks: np.ndarray,
    protector_chunks: np.ndarray,
    config: SimulationGateConfig
) -> np.ndarray:
    """
    Calculate disruption for energy parasite.

    Formula: D = (workers_in_range - protectors_threatening) / total_workers

    Energy parasites:
    - Target workers within pursuit range (6 chunks / 60 game units)
    - Threatened by protectors within attack range (1.2 chunks / 12 game units)
    - Can go NEGATIVE when protectors outnumber reachable workers
    """
    batch_size = len(spawn_chunk)

    # Count total workers
    total_workers = len(worker_chunks) if worker_chunks.ndim == 1 else worker_chunks.shape[1]

    # Handle no workers case
    if total_workers == 0:
        return np.zeros(batch_size)

    # Calculate workers in pursuit range
    if len(worker_chunks) > 0:
        worker_distances = chunk_distance_matrix(
            spawn_chunk, worker_chunks, config.chunks_per_axis
        )  # [B, W]
        workers_in_range = np.sum(worker_distances < config.energy_pursuit_range, axis=1)  # [B]
    else:
        workers_in_range = np.zeros(batch_size)

    # Calculate protectors threatening (within their attack range)
    if len(protector_chunks) > 0:
        protector_distances = chunk_distance_matrix(
            spawn_chunk, protector_chunks, config.chunks_per_axis
        )  # [B, P]
        protectors_threatening = np.sum(protector_distances < config.protector_attack_range, axis=1)  # [B]
    else:
        protectors_threatening = np.zeros(batch_size)

    # Formula: (workers_in_range - protectors_threatening) / total_workers
    # Can be negative when protectors > reachable workers (dangerous spawn)
    disruption = (workers_in_range - protectors_threatening) / max(total_workers, 1)

    # Clamp to [-1.0, 1.0] range
    return np.clip(disruption, -1.0, 1.0)


def _calculate_combat_disruption(
    spawn_chunk: np.ndarray,
    worker_chunks: np.ndarray,
    protector_chunks: np.ndarray,
    config: SimulationGateConfig
) -> np.ndarray:
    """
    Calculate disruption for combat parasite.

    Formula: D = (workers_in_range + protectors_in_range) / (total_workers + total_protectors)

    Combat parasites:
    - Target BOTH workers and protectors within pursuit range (7.5 chunks / 75 game units)
    - Protectors are valid targets, not threats
    - Always non-negative
    """
    batch_size = len(spawn_chunk)

    # Count totals
    total_workers = len(worker_chunks) if worker_chunks.ndim == 1 else worker_chunks.shape[1]
    total_protectors = len(protector_chunks) if protector_chunks.ndim == 1 else protector_chunks.shape[1]
    total_entities = total_workers + total_protectors

    # Handle no entities case
    if total_entities == 0:
        return np.zeros(batch_size)

    # Calculate workers in pursuit range
    if len(worker_chunks) > 0:
        worker_distances = chunk_distance_matrix(
            spawn_chunk, worker_chunks, config.chunks_per_axis
        )  # [B, W]
        workers_in_range = np.sum(worker_distances < config.combat_pursuit_range, axis=1)  # [B]
    else:
        workers_in_range = np.zeros(batch_size)

    # Calculate protectors in pursuit range (they are targets for combat)
    if len(protector_chunks) > 0:
        protector_distances = chunk_distance_matrix(
            spawn_chunk, protector_chunks, config.chunks_per_axis
        )  # [B, P]
        protectors_in_range = np.sum(protector_distances < config.combat_pursuit_range, axis=1)  # [B]
    else:
        protectors_in_range = np.zeros(batch_size)

    # Formula: (workers_in_range + protectors_in_range) / total_entities
    disruption = (workers_in_range + protectors_in_range) / max(total_entities, 1)

    # Clamp to [0.0, 1.0] range (always non-negative for combat)
    return np.clip(disruption, 0.0, 1.0)


def calculate_disruption_factor(
    distance: float,
    pursuit_range: float
) -> float:
    """
    Calculate binary disruption factor for a single distance.

    Args:
        distance: Distance to target in chunks
        pursuit_range: Maximum pursuit range

    Returns:
        1.0 if within range, 0.0 otherwise
    """
    return 1.0 if distance < pursuit_range else 0.0
