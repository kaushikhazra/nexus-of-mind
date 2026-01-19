"""
Combined Cost Function

Combines all component calculations into a single expected reward.
Full implementation in Phase 2.
"""

import numpy as np
from typing import Dict, Any, Union, Optional
import time
import logging

from .config import SimulationGateConfig
from .components import (
    calculate_survival_probability,
    calculate_worker_disruption,
    calculate_location_penalty,
    validate_spawn_capacity,
    ExplorationTracker
)

logger = logging.getLogger(__name__)


class SimulationCostFunction:
    """
    Calculates expected reward for proposed spawn actions.

    Combines:
    - Survival probability (threat from protectors)
    - Worker disruption potential
    - Location penalty (hive/worker proximity)
    - Spawn capacity validation
    - Exploration bonus (deadlock prevention)
    """

    def __init__(self, config: Optional[SimulationGateConfig] = None):
        """
        Initialize cost function.

        Args:
            config: Simulation configuration (uses defaults if None)
        """
        self.config = config or SimulationGateConfig()
        self.exploration_tracker = ExplorationTracker(self.config)

    def calculate_expected_reward(
        self,
        observation: Dict[str, Any],
        spawn_chunk: int,
        spawn_type: str
    ) -> Dict[str, float]:
        """
        Calculate expected reward for proposed spawn action.

        Args:
            observation: Current game observation with:
                - protector_chunks: List[int]
                - worker_chunks: List[int]
                - hive_chunk: int
                - queen_energy: float
            spawn_chunk: Proposed spawn chunk ID
            spawn_type: 'energy' or 'combat'

        Returns:
            Dictionary with:
                - expected_reward: Combined reward value
                - survival: Survival probability
                - disruption: Worker disruption potential
                - location: Location penalty
                - exploration: Exploration bonus
                - capacity_valid: Whether spawn is affordable
        """
        # Extract observation data
        protector_chunks = observation.get('protector_chunks', [])
        worker_chunks = observation.get('worker_chunks', [])
        hive_chunk = observation.get('hive_chunk', 0)
        queen_energy = observation.get('queen_energy', 0)

        # 1. Survival probability
        survival = calculate_survival_probability(
            spawn_chunk, protector_chunks, self.config
        )

        # 2. Worker disruption
        disruption = calculate_worker_disruption(
            spawn_chunk, worker_chunks, survival, self.config
        )

        # 3. Location penalty
        location = calculate_location_penalty(
            spawn_chunk, hive_chunk, worker_chunks, self.config
        )

        # 4. Spawn capacity
        capacity = validate_spawn_capacity(
            spawn_type, queen_energy, self.config
        )
        capacity_valid = capacity > 0

        # 5. Exploration bonus
        exploration = self.exploration_tracker.calculate_exploration_bonus(spawn_chunk)

        # 6. Combined reward
        if not capacity_valid:
            expected_reward = float('-inf')
        else:
            base_reward = (
                self.config.survival_weight * survival +
                self.config.disruption_weight * disruption +
                self.config.location_weight * location
            )
            expected_reward = base_reward + exploration

        return {
            'expected_reward': expected_reward,
            'survival': survival,
            'disruption': disruption,
            'location': location,
            'exploration': exploration,
            'capacity_valid': capacity_valid
        }

    def record_spawn(self, chunk_id: int) -> None:
        """Record that spawn was executed at chunk."""
        self.exploration_tracker.record_spawn(chunk_id)

    def get_exploration_stats(self) -> Dict:
        """Get exploration statistics."""
        return self.exploration_tracker.get_statistics()
