"""
Exploration Bonus Tracking

Tracks time since last spawn per chunk and provides exploration bonus
to encourage trying new locations (deadlock prevention).
"""

import numpy as np
from typing import Dict, Union
import time
import logging

from ..config import SimulationGateConfig

logger = logging.getLogger(__name__)


class ExplorationTracker:
    """
    Tracks spawn history per chunk and calculates exploration bonus.

    Exploration bonus formula:
        bonus = ε × (time_since_spawn / max_time)

    Chunks never spawned get maximum bonus.
    """

    def __init__(self, config: SimulationGateConfig):
        """
        Initialize exploration tracker.

        Args:
            config: Simulation configuration
        """
        self.config = config
        self.last_spawn_time: Dict[int, float] = {}
        self.start_time = time.time()

    def record_spawn(self, chunk_id: int) -> None:
        """
        Record that a spawn occurred at given chunk.

        Args:
            chunk_id: Chunk where spawn occurred
        """
        self.last_spawn_time[chunk_id] = time.time()
        logger.debug(f"[Exploration] Recorded spawn at chunk {chunk_id}")

    def get_time_since_spawn(self, chunk_id: int) -> float:
        """
        Get time since last spawn at chunk.

        Args:
            chunk_id: Chunk to check

        Returns:
            Time in seconds since last spawn (or since tracker start if never spawned)
        """
        if chunk_id in self.last_spawn_time:
            return time.time() - self.last_spawn_time[chunk_id]
        else:
            # Never spawned here - use time since tracker start
            return time.time() - self.start_time

    def calculate_exploration_bonus(
        self,
        spawn_chunk: Union[int, np.ndarray]
    ) -> Union[float, np.ndarray]:
        """
        Calculate exploration bonus for proposed spawn location(s).

        Bonus = ε × min(1.0, time_since_spawn / max_time)

        Args:
            spawn_chunk: Chunk ID(s) to calculate bonus for

        Returns:
            Exploration bonus (scalar or [B] array)
        """
        # Convert to numpy array
        spawn_chunk = np.atleast_1d(np.asarray(spawn_chunk))
        batch_size = len(spawn_chunk)

        # Calculate bonus for each chunk
        bonuses = np.zeros(batch_size)

        for i, chunk in enumerate(spawn_chunk):
            chunk_id = int(chunk)
            if chunk_id < 0:
                bonuses[i] = 0.0
                continue

            time_since = self.get_time_since_spawn(chunk_id)
            normalized = min(1.0, time_since / self.config.exploration_max_time)
            bonuses[i] = self.config.exploration_coefficient * normalized

        # Return scalar if single input
        if batch_size == 1:
            return float(bonuses[0])

        return bonuses

    def get_statistics(self) -> Dict:
        """
        Get exploration statistics.

        Returns:
            Dictionary with exploration stats
        """
        total_chunks = self.config.chunks_per_axis ** 2
        explored_chunks = len(self.last_spawn_time)
        unexplored_chunks = total_chunks - explored_chunks

        return {
            'total_chunks': total_chunks,
            'explored_chunks': explored_chunks,
            'unexplored_chunks': unexplored_chunks,
            'exploration_rate': explored_chunks / total_chunks if total_chunks > 0 else 0,
            'tracker_age': time.time() - self.start_time
        }

    def reset(self) -> None:
        """Reset exploration tracking."""
        self.last_spawn_time.clear()
        self.start_time = time.time()
        logger.info("[Exploration] Tracker reset")
