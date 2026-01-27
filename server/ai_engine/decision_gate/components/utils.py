"""
Utility functions for chunk-based distance calculations.

Supports both scalar and batched (tensor) operations.
"""

import numpy as np
from typing import Tuple, List, Union
import logging

logger = logging.getLogger(__name__)

# Grid constants
CHUNKS_PER_AXIS = 20
MAX_CHUNK_DISTANCE = 26.87  # sqrt(19² + 19²)


def chunk_to_coords(chunk_id: int, chunks_per_axis: int = CHUNKS_PER_AXIS) -> Tuple[int, int]:
    """
    Convert chunk ID to grid coordinates.

    Args:
        chunk_id: Chunk ID (0 to chunks_per_axis² - 1)
        chunks_per_axis: Grid size (default 20)

    Returns:
        Tuple of (x, z) grid coordinates
    """
    if chunk_id < 0:
        return (0, 0)
    x = chunk_id % chunks_per_axis
    z = chunk_id // chunks_per_axis
    return (x, z)


def chunk_distance(chunk1: int, chunk2: int, chunks_per_axis: int = CHUNKS_PER_AXIS) -> float:
    """
    Calculate Euclidean distance between two chunks.

    Args:
        chunk1: First chunk ID
        chunk2: Second chunk ID
        chunks_per_axis: Grid size (default 20)

    Returns:
        Euclidean distance in chunk units
    """
    if chunk1 < 0 or chunk2 < 0:
        return MAX_CHUNK_DISTANCE

    x1, z1 = chunk_to_coords(chunk1, chunks_per_axis)
    x2, z2 = chunk_to_coords(chunk2, chunks_per_axis)

    return np.sqrt((x1 - x2) ** 2 + (z1 - z2) ** 2)


def chunk_to_coords_batch(chunk_ids: np.ndarray, chunks_per_axis: int = CHUNKS_PER_AXIS) -> np.ndarray:
    """
    Convert batch of chunk IDs to grid coordinates.

    Args:
        chunk_ids: Array of chunk IDs, shape [N] or [N, M]
        chunks_per_axis: Grid size (default 20)

    Returns:
        Array of coordinates, shape [N, 2] or [N, M, 2]
    """
    chunk_ids = np.asarray(chunk_ids)
    original_shape = chunk_ids.shape

    # Handle negative chunk IDs (invalid)
    chunk_ids = np.maximum(chunk_ids, 0)

    x = chunk_ids % chunks_per_axis
    z = chunk_ids // chunks_per_axis

    if len(original_shape) == 1:
        return np.stack([x, z], axis=-1)  # [N, 2]
    else:
        return np.stack([x, z], axis=-1)  # [N, M, 2]


def chunk_distance_matrix(
    spawn_chunks: np.ndarray,
    target_chunks: np.ndarray,
    chunks_per_axis: int = CHUNKS_PER_AXIS
) -> np.ndarray:
    """
    Calculate distance matrix between spawn chunks and target chunks.

    Args:
        spawn_chunks: Array of spawn chunk IDs, shape [B]
        target_chunks: Array of target chunk IDs, shape [B, T] or [T]
        chunks_per_axis: Grid size (default 20)

    Returns:
        Distance matrix, shape [B, T]
    """
    spawn_chunks = np.asarray(spawn_chunks)
    target_chunks = np.asarray(target_chunks)

    # Convert to coordinates
    spawn_coords = chunk_to_coords_batch(spawn_chunks, chunks_per_axis)  # [B, 2]

    if len(target_chunks.shape) == 1:
        # Single set of targets for all spawns
        target_coords = chunk_to_coords_batch(target_chunks, chunks_per_axis)  # [T, 2]
        # Broadcast: [B, 1, 2] - [T, 2] -> [B, T, 2]
        diff = spawn_coords[:, np.newaxis, :] - target_coords[np.newaxis, :, :]
    else:
        # Different targets per spawn
        target_coords = chunk_to_coords_batch(target_chunks, chunks_per_axis)  # [B, T, 2]
        # [B, 1, 2] - [B, T, 2] -> [B, T, 2]
        diff = spawn_coords[:, np.newaxis, :] - target_coords

    # Euclidean distance
    distances = np.sqrt(np.sum(diff ** 2, axis=-1))  # [B, T]

    return distances


def normalize_distance(distance: Union[float, np.ndarray], max_distance: float = MAX_CHUNK_DISTANCE) -> Union[float, np.ndarray]:
    """
    Normalize distance to [0, 1] range.

    Args:
        distance: Distance value(s)
        max_distance: Maximum possible distance

    Returns:
        Normalized distance(s)
    """
    return np.minimum(distance / max_distance, 1.0)
