"""
Worker Disruption Potential Calculation

Estimates mining disruption caused by spawning a parasite
based on worker positions and flee zones.
"""

import numpy as np
from typing import List, Union
import logging

from .utils import chunk_distance_matrix, CHUNKS_PER_AXIS
from ..config import SimulationGateConfig

logger = logging.getLogger(__name__)


def calculate_worker_disruption(
    spawn_chunk: Union[int, np.ndarray],
    worker_chunks: Union[List[int], np.ndarray],
    survival_probability: Union[float, np.ndarray],
    config: SimulationGateConfig
) -> Union[float, np.ndarray]:
    """
    Calculate worker disruption potential for spawned parasite.

    Uses disruption factor calculation:
    - Flee zone (d < flee_range): disruption = 1.0 (full disruption)
    - Effect zone (flee_range <= d < ignore_range): disruption = exp(-μ * (d - flee_range))
    - Ignore zone (d >= ignore_range): disruption = 0.0 (no effect)

    Total disruption = survival_prob × Σᵢ disruption_factor_i

    Args:
        spawn_chunk: Spawn location chunk ID (scalar or [B] array)
        worker_chunks: Worker chunk IDs ([W] or [B, W] array)
        survival_probability: Survival probability (scalar or [B] array)
        config: Simulation configuration

    Returns:
        Total disruption potential (scalar or [B] array)
    """
    # Convert to numpy arrays
    spawn_chunk = np.atleast_1d(np.asarray(spawn_chunk))  # [B]
    survival_probability = np.atleast_1d(np.asarray(survival_probability))  # [B]
    worker_chunks = np.asarray(worker_chunks)

    batch_size = len(spawn_chunk)

    # Handle empty worker case
    if len(worker_chunks) == 0 or (worker_chunks.ndim > 1 and worker_chunks.shape[1] == 0):
        # No workers = no disruption
        result = np.zeros(batch_size)
        return result[0] if batch_size == 1 else result

    # Ensure worker_chunks has proper shape
    if worker_chunks.ndim == 1:
        # Same workers for all spawn positions
        worker_chunks = worker_chunks[np.newaxis, :]  # [1, W]
        worker_chunks = np.broadcast_to(worker_chunks, (batch_size, worker_chunks.shape[1]))

    # Calculate distances to all workers: [B, W]
    distances = chunk_distance_matrix(spawn_chunk, worker_chunks, config.chunks_per_axis)

    # Calculate disruption factors
    disruption = np.zeros_like(distances)

    # Flee zone: full disruption
    in_flee_zone = distances < config.flee_range
    disruption[in_flee_zone] = 1.0

    # Effect zone: exponential decay
    in_effect_zone = (distances >= config.flee_range) & (distances < config.ignore_range)
    disruption[in_effect_zone] = np.exp(
        -config.disruption_decay * (distances[in_effect_zone] - config.flee_range)
    )

    # Ignore zone: no effect (already 0)

    # Total disruption = sum across all workers, scaled by survival
    total_disruption = np.sum(disruption, axis=1) * survival_probability  # [B]

    # Normalize by number of workers to get average effect
    num_workers = worker_chunks.shape[1] if worker_chunks.ndim > 1 else len(worker_chunks)
    if num_workers > 0:
        total_disruption = total_disruption / num_workers

    # Handle invalid chunks (negative)
    invalid_spawn = spawn_chunk < 0
    total_disruption[invalid_spawn] = 0.0

    # Return scalar if single input
    if batch_size == 1:
        return float(total_disruption[0])

    return total_disruption


def calculate_disruption_factor(
    distance: float,
    config: SimulationGateConfig
) -> float:
    """
    Calculate disruption factor for a single distance.

    Args:
        distance: Distance to worker in chunks
        config: Simulation configuration

    Returns:
        Disruption factor [0, 1]
    """
    if distance < config.flee_range:
        return 1.0
    elif distance < config.ignore_range:
        return np.exp(-config.disruption_decay * (distance - config.flee_range))
    else:
        return 0.0
