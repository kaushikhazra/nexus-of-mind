"""
Reward Calculator for Queen AI Continuous Learning

Calculates reward signals from observation events to guide reinforcement learning.
Rewards are normalized to [-1, 1] range for stable training.
"""

import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class RewardWeights:
    """Configurable weights for different reward components."""

    # Positive rewards (Queen success)
    mining_interruption: float = 0.5       # Successfully interrupted mining
    mining_site_abandoned: float = 1.0     # Site was completely abandoned
    player_unit_killed: float = 0.3        # Killed a player unit
    combat_victory: float = 0.4            # Won a combat encounter
    mining_efficiency_decrease: float = 2.0 # Multiplier for efficiency drop
    territory_maintained: float = 0.1      # Keeping territory control

    # Negative rewards (Queen failure)
    parasite_killed: float = -0.5          # Lost a parasite
    failed_attack: float = -0.3            # Attack dealt no damage
    queen_damage: float = -0.2             # Queen took damage
    hive_discovered: float = -1.0          # Hive was discovered by player
    combat_defeat: float = -0.4            # Lost a combat encounter

    # Normalization bounds
    min_reward: float = -1.0
    max_reward: float = 1.0


class RewardCalculator:
    """
    Calculates reward signals from observation data for RL training.

    The reward function encourages:
    - Disrupting player mining operations
    - Killing player units
    - Surviving (preserving parasites)
    - Keeping the hive hidden

    And discourages:
    - Losing parasites
    - Failing attacks
    - Having the hive discovered
    """

    def __init__(self, weights: Optional[RewardWeights] = None):
        self.weights = weights or RewardWeights()
        self._last_observation: Optional[Dict[str, Any]] = None

    def calculate(
        self,
        current_obs: Dict[str, Any],
        previous_obs: Optional[Dict[str, Any]] = None
    ) -> float:
        """
        Calculate reward signal from observation data.

        Args:
            current_obs: Current observation data
            previous_obs: Previous observation data (for delta comparisons)

        Returns:
            Reward value in [-1, 1] range
        """
        # Use stored previous observation if not provided
        if previous_obs is None:
            previous_obs = self._last_observation

        reward = 0.0

        try:
            # Calculate event-based rewards
            reward += self._calculate_event_rewards(current_obs)

            # Calculate state delta rewards (if we have previous state)
            if previous_obs is not None:
                reward += self._calculate_delta_rewards(current_obs, previous_obs)

            # Normalize to [-1, 1]
            reward = self._normalize_reward(reward)

        except Exception as e:
            logger.error(f"Error calculating reward: {e}")
            reward = 0.0

        # Store for next calculation
        self._last_observation = current_obs

        return reward

    def _calculate_event_rewards(self, obs: Dict[str, Any]) -> float:
        """Calculate rewards from events in the observation window."""
        events = obs.get('events', {})
        reward = 0.0

        # Mining interruptions (positive)
        interruption_count = events.get('miningInterruptionCount', 0)
        reward += interruption_count * self.weights.mining_interruption

        # Player units killed (positive)
        player_units_killed = events.get('playerUnitsKilled', 0)
        reward += player_units_killed * self.weights.player_unit_killed

        # Parasites killed (negative)
        parasites_killed = events.get('parasitesKilled', 0)
        reward += parasites_killed * self.weights.parasite_killed

        # Failed attacks (negative)
        failed_attacks = events.get('failedAttacks', 0)
        reward += failed_attacks * self.weights.failed_attack

        # Combat encounters
        combat_encounters = events.get('combatEncounters', [])
        for encounter in combat_encounters:
            outcome = encounter.get('outcome', 'draw')
            if outcome == 'queen_win':
                reward += self.weights.combat_victory
            elif outcome == 'player_win':
                reward += self.weights.combat_defeat

        return reward

    def _calculate_delta_rewards(
        self,
        current_obs: Dict[str, Any],
        previous_obs: Dict[str, Any]
    ) -> float:
        """Calculate rewards from state changes between observations."""
        reward = 0.0

        current_player = current_obs.get('player', {})
        previous_player = previous_obs.get('player', {})
        current_queen = current_obs.get('queen', {})
        previous_queen = previous_obs.get('queen', {})

        # Mining efficiency decrease (positive reward)
        current_efficiency = current_player.get('miningEfficiency', 0)
        previous_efficiency = previous_player.get('miningEfficiency', 0)

        if previous_efficiency > 0 and current_efficiency < previous_efficiency:
            efficiency_drop = (previous_efficiency - current_efficiency) / previous_efficiency
            reward += efficiency_drop * self.weights.mining_efficiency_decrease

        # Mining sites abandoned (check for complete loss)
        current_sites = len(current_player.get('miningSites', []))
        previous_sites = len(previous_player.get('miningSites', []))

        if current_sites < previous_sites:
            sites_lost = previous_sites - current_sites
            reward += sites_lost * self.weights.mining_site_abandoned

        # Hive discovery (major negative reward)
        current_discovered = current_queen.get('hiveDiscovered', False)
        previous_discovered = previous_queen.get('hiveDiscovered', False)

        if current_discovered and not previous_discovered:
            reward += self.weights.hive_discovered

        # Queen health decrease
        current_health = current_queen.get('health', 1.0)
        previous_health = previous_queen.get('health', 1.0)

        if current_health < previous_health:
            health_lost = previous_health - current_health
            reward += health_lost * self.weights.queen_damage

        # Territory maintenance (small positive if maintaining parasites)
        current_parasites = current_queen.get('parasiteCount', 0)
        if current_parasites > 0:
            reward += self.weights.territory_maintained

        return reward

    def _normalize_reward(self, reward: float) -> float:
        """Normalize reward to [-1, 1] range."""
        return max(
            self.weights.min_reward,
            min(self.weights.max_reward, reward)
        )

    def get_reward_breakdown(self, obs: Dict[str, Any]) -> Dict[str, float]:
        """
        Get detailed breakdown of reward components for debugging.

        Args:
            obs: Current observation data

        Returns:
            Dictionary with individual reward components
        """
        events = obs.get('events', {})
        breakdown = {}

        # Event rewards
        breakdown['mining_interruptions'] = (
            events.get('miningInterruptionCount', 0) *
            self.weights.mining_interruption
        )
        breakdown['player_units_killed'] = (
            events.get('playerUnitsKilled', 0) *
            self.weights.player_unit_killed
        )
        breakdown['parasites_killed'] = (
            events.get('parasitesKilled', 0) *
            self.weights.parasite_killed
        )
        breakdown['failed_attacks'] = (
            events.get('failedAttacks', 0) *
            self.weights.failed_attack
        )

        # Combat
        combat_encounters = events.get('combatEncounters', [])
        combat_reward = 0
        for encounter in combat_encounters:
            outcome = encounter.get('outcome', 'draw')
            if outcome == 'queen_win':
                combat_reward += self.weights.combat_victory
            elif outcome == 'player_win':
                combat_reward += self.weights.combat_defeat
        breakdown['combat'] = combat_reward

        # Total before normalization
        breakdown['total_raw'] = sum(breakdown.values())
        breakdown['total_normalized'] = self._normalize_reward(breakdown['total_raw'])

        return breakdown

    def reset(self) -> None:
        """Reset the calculator state."""
        self._last_observation = None

    def update_weights(self, weights: RewardWeights) -> None:
        """Update reward weights."""
        self.weights = weights


class AdaptiveRewardCalculator(RewardCalculator):
    """
    Reward calculator that adapts weights based on game phase.

    Early game: Focus on mining disruption
    Mid game: Balance between disruption and combat
    Late game: Focus on survival and territory control
    """

    def __init__(self, weights: Optional[RewardWeights] = None):
        super().__init__(weights)
        self._phase_thresholds = {
            'early': 300,   # First 5 minutes
            'mid': 900,     # 5-15 minutes
            'late': float('inf')  # After 15 minutes
        }

    def calculate(
        self,
        current_obs: Dict[str, Any],
        previous_obs: Optional[Dict[str, Any]] = None
    ) -> float:
        """Calculate reward with phase-adaptive weights."""
        # Adjust weights based on game phase
        game_time = current_obs.get('gameTime', 0)
        self._adjust_weights_for_phase(game_time)

        return super().calculate(current_obs, previous_obs)

    def _adjust_weights_for_phase(self, game_time: float) -> None:
        """Adjust weights based on current game phase."""
        if game_time < self._phase_thresholds['early']:
            # Early game: Focus on disruption
            self.weights.mining_interruption = 0.7
            self.weights.parasite_killed = -0.3
            self.weights.hive_discovered = -0.5

        elif game_time < self._phase_thresholds['mid']:
            # Mid game: Balanced
            self.weights.mining_interruption = 0.5
            self.weights.parasite_killed = -0.5
            self.weights.hive_discovered = -1.0

        else:
            # Late game: Focus on survival
            self.weights.mining_interruption = 0.3
            self.weights.parasite_killed = -0.7
            self.weights.hive_discovered = -1.5
            self.weights.territory_maintained = 0.2

    def get_current_phase(self, game_time: float) -> str:
        """Get current game phase name."""
        if game_time < self._phase_thresholds['early']:
            return 'early'
        elif game_time < self._phase_thresholds['mid']:
            return 'mid'
        else:
            return 'late'
