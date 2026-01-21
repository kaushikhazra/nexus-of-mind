"""
Spawn Location Penalty Calculation

Penalizes spawning far from strategic targets based on game mode:
- IDLE mode (no workers): penalize distance from hive
- ACTIVE mode (workers present): penalize distance from nearest worker
"""

import numpy as np
from typing import List, Union
import logging

from .utils import chunk_distance, chunk_distance_matrix, normalize_distance, CHUNKS_PER_AXIS, MAX_CHUNK_DISTANCE
from ..config import SimulationGateConfig

logger = logging.getLogger(__name__)


def calculate_location_penalty(
    spawn_chunk: Union[int, np.ndarray],
    hive_chunk: Union[int, np.ndarray],
    worker_chunks: Union[List[int], np.ndarray],
    config: SimulationGateConfig
) -> Union[float, np.ndarray]:
    """
    Calculate spawn location penalty based on game mode.

    IDLE mode (no workers):
        penalty = -α × normalized_distance_to_hive

    ACTIVE mode (workers present):
        penalty = -β × normalized_distance_to_nearest_worker

    Args:
        spawn_chunk: Spawn location chunk ID (scalar or [B] array)
        hive_chunk: Hive/Queen chunk ID (scalar or [B] array)
        worker_chunks: Worker chunk IDs ([W] or [B, W] array, can be empty)
        config: Simulation configuration

    Returns:
        Location penalty (negative value, scalar or [B] array)
    """
    # Convert to numpy arrays
    spawn_chunk = np.atleast_1d(np.asarray(spawn_chunk))  # [B]
    hive_chunk = np.atleast_1d(np.asarray(hive_chunk))  # [B]
    worker_chunks = np.asarray(worker_chunks) if len(worker_chunks) > 0 else np.array([])

    batch_size = len(spawn_chunk)

    # Broadcast hive_chunk if needed
    if len(hive_chunk) == 1:
        hive_chunk = np.broadcast_to(hive_chunk, (batch_size,))

    # Calculate distance to hive
    hive_distances = np.array([
        chunk_distance(int(spawn_chunk[i]), int(hive_chunk[i]), config.chunks_per_axis)
        for i in range(batch_size)
    ])
    normalized_hive_dist = normalize_distance(hive_distances, config.max_chunk_distance)

    # Determine mode based on worker presence
    has_workers = len(worker_chunks) > 0 and (
        worker_chunks.ndim == 1 or
        (worker_chunks.ndim > 1 and worker_chunks.shape[1] > 0)
    )

    if not has_workers:
        # IDLE mode: penalize distance from hive
        penalty = -config.hive_proximity_weight * normalized_hive_dist
    else:
        # ACTIVE mode: penalize distance from nearest worker
        # Ensure worker_chunks has proper shape
        if worker_chunks.ndim == 1:
            worker_chunks = worker_chunks[np.newaxis, :]
            worker_chunks = np.broadcast_to(worker_chunks, (batch_size, worker_chunks.shape[1]))

        # Calculate distances to all workers: [B, W]
        distances = chunk_distance_matrix(spawn_chunk, worker_chunks, config.chunks_per_axis)

        # Find minimum distance to any worker
        min_worker_dist = np.min(distances, axis=1)  # [B]
        normalized_worker_dist = normalize_distance(min_worker_dist, config.max_chunk_distance)

        penalty = -config.worker_proximity_weight * normalized_worker_dist

    # Handle invalid chunks
    invalid_spawn = spawn_chunk < 0
    invalid_hive = hive_chunk < 0
    penalty[invalid_spawn | invalid_hive] = -1.0  # Maximum penalty for invalid

    # Return scalar if single input
    if batch_size == 1:
        return float(penalty[0])

    return penalty


def get_location_mode(worker_count: int) -> str:
    """
    Determine location penalty mode based on worker presence.

    Args:
        worker_count: Number of workers in territory

    Returns:
        'IDLE' or 'ACTIVE'
    """
    return 'ACTIVE' if worker_count > 0 else 'IDLE'
