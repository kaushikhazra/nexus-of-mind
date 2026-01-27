"""
Survival Probability Calculation

Estimates probability that a spawned parasite survives the observation window
based on protector positions and threat zones.
"""

import numpy as np
from typing import List, Union
import logging

from .utils import chunk_distance_matrix, CHUNKS_PER_AXIS
from ..config import SimulationGateConfig

logger = logging.getLogger(__name__)


def calculate_survival_probability(
    spawn_chunk: Union[int, np.ndarray],
    protector_chunks: Union[List[int], np.ndarray],
    config: SimulationGateConfig
) -> Union[float, np.ndarray]:
    """
    Calculate survival probability for spawned parasite.

    Uses threat factor calculation:
    - Kill zone (d < kill_range): threat = 1.0 (certain death)
    - Threat zone (kill_range <= d < safe_range): threat = exp(-λ * (d - kill_range))
    - Safe zone (d >= safe_range): threat = 0.0 (no threat)

    Survival = ∏ᵢ (1 - threat_factor_i)

    Args:
        spawn_chunk: Spawn location chunk ID (scalar or [B] array)
        protector_chunks: Protector chunk IDs ([P] or [B, P] array)
        config: Simulation configuration

    Returns:
        Survival probability (scalar or [B] array)
    """
    # Convert to numpy arrays
    spawn_chunk = np.atleast_1d(np.asarray(spawn_chunk))  # [B]
    protector_chunks = np.asarray(protector_chunks)

    batch_size = len(spawn_chunk)

    # Handle empty protector case
    if len(protector_chunks) == 0 or (protector_chunks.ndim > 1 and protector_chunks.shape[1] == 0):
        # No protectors = 100% survival
        result = np.ones(batch_size)
        return result[0] if batch_size == 1 else result

    # Ensure protector_chunks has proper shape
    if protector_chunks.ndim == 1:
        # Same protectors for all spawn positions
        protector_chunks = protector_chunks[np.newaxis, :]  # [1, P]
        protector_chunks = np.broadcast_to(protector_chunks, (batch_size, protector_chunks.shape[1]))

    # Calculate distances to all protectors: [B, P]
    distances = chunk_distance_matrix(spawn_chunk, protector_chunks, config.chunks_per_axis)

    # Calculate threat factors
    threat = np.zeros_like(distances)

    # Kill zone: certain death
    in_kill_zone = distances < config.kill_range
    threat[in_kill_zone] = 1.0

    # Threat zone: exponential decay
    in_threat_zone = (distances >= config.kill_range) & (distances < config.safe_range)
    threat[in_threat_zone] = np.exp(
        -config.threat_decay * (distances[in_threat_zone] - config.kill_range)
    )

    # Safe zone: no threat (already 0)

    # Survival = product of (1 - threat) across all protectors
    survival = np.prod(1 - threat, axis=1)  # [B]

    # Handle invalid chunks (negative)
    invalid_spawn = spawn_chunk < 0
    survival[invalid_spawn] = 0.0

    # Return scalar if single input
    if batch_size == 1:
        return float(survival[0])

    return survival


def calculate_threat_factor(
    distance: float,
    config: SimulationGateConfig
) -> float:
    """
    Calculate threat factor for a single distance.

    Args:
        distance: Distance to protector in chunks
        config: Simulation configuration

    Returns:
        Threat factor [0, 1]
    """
    if distance < config.kill_range:
        return 1.0
    elif distance < config.safe_range:
        return np.exp(-config.threat_decay * (distance - config.kill_range))
    else:
        return 0.0
