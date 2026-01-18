"""
Reward Calculator for Queen AI Neural Network

Calculates reward signals for reinforcement learning based on observation changes.
The Queen is rewarded for actions that harm the player's economy.

Reward Signals:
- Positive: Mining activity decreased, protectors reduced, player energy declining
- Negative: Mining activity increased, protectors increased, player energy growing

All rates use unified normalization: (end - start) / max(start, end) → [-1, +1]
"""

import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from collections import defaultdict
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class RewardConfig:
    """Configuration for reward calculation."""

    # Reward weights for each signal
    mining_disruption_weight: float = 0.4  # Weight for mining activity changes
    protector_reduction_weight: float = 0.3  # Weight for protector count changes
    player_energy_weight: float = 0.3  # Weight for player energy changes

    # Bonus rewards
    mining_stopped_bonus: float = 0.2  # Bonus when mining completely stops in a chunk
    protector_killed_bonus: float = 0.15  # Bonus per protector killed

    # Penalty for ineffective actions
    no_impact_penalty: float = -0.1  # Penalty when action has no observable impact

    # Clipping bounds
    min_reward: float = -1.0
    max_reward: float = 1.0


class RewardCalculator:
    """
    Calculates reward signals for Queen NN training.

    Compares consecutive observations to determine the effectiveness
    of the Queen's spawn decisions.
    """

    def __init__(self, config: Optional[RewardConfig] = None):
        self.config = config or RewardConfig()

        # Track history for multi-step rewards
        self.observation_history: List[Dict[str, Any]] = []
        self.reward_history: List[float] = []
        self.max_history = 10

    def calculate_reward(
        self,
        prev_observation: Dict[str, Any],
        curr_observation: Dict[str, Any],
        spawn_decision: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Calculate reward based on observation changes.

        Args:
            prev_observation: Previous observation data (window start)
            curr_observation: Current observation data (window end)
            spawn_decision: Optional spawn decision that was executed

        Returns:
            Dictionary with:
            - reward: Total reward value [-1, +1]
            - components: Breakdown of reward components
            - details: Detailed metrics
        """
        components = {}
        details = {}

        # 1. Mining disruption reward
        mining_reward, mining_details = self._calculate_mining_reward(
            prev_observation, curr_observation
        )
        components['mining_disruption'] = mining_reward
        details['mining'] = mining_details

        # 2. Protector reduction reward
        protector_reward, protector_details = self._calculate_protector_reward(
            prev_observation, curr_observation
        )
        components['protector_reduction'] = protector_reward
        details['protector'] = protector_details

        # 3. Player energy drain reward
        energy_reward, energy_details = self._calculate_energy_reward(
            prev_observation, curr_observation
        )
        components['player_energy_drain'] = energy_reward
        details['energy'] = energy_details

        # 4. Calculate weighted total
        total_reward = (
            mining_reward * self.config.mining_disruption_weight +
            protector_reward * self.config.protector_reduction_weight +
            energy_reward * self.config.player_energy_weight
        )

        # 5. Apply bonuses
        bonuses = self._calculate_bonuses(prev_observation, curr_observation, details)
        total_reward += bonuses['total']
        components['bonuses'] = bonuses['total']
        details['bonuses'] = bonuses

        # 6. Apply no-impact penalty if nothing changed
        if self._is_no_impact(details):
            total_reward += self.config.no_impact_penalty
            components['no_impact_penalty'] = self.config.no_impact_penalty

        # 7. Clip to bounds
        total_reward = np.clip(
            total_reward,
            self.config.min_reward,
            self.config.max_reward
        )

        # Store in history
        self._update_history(curr_observation, total_reward)

        return {
            'reward': float(total_reward),
            'components': components,
            'details': details
        }

    def _calculate_mining_reward(
        self,
        prev_obs: Dict[str, Any],
        curr_obs: Dict[str, Any]
    ) -> tuple:
        """
        Calculate reward for mining disruption.

        Positive reward when mining activity decreases.
        """
        prev_workers = prev_obs.get('miningWorkers', [])
        curr_workers = curr_obs.get('miningWorkers', [])

        prev_count = len(prev_workers)
        curr_count = len(curr_workers)

        # Calculate rate of change
        rate = self._calculate_rate(prev_count, curr_count)

        # Invert: negative rate (fewer workers) = positive reward
        reward = -rate

        # Per-chunk analysis
        prev_by_chunk = self._count_by_chunk(prev_workers)
        curr_by_chunk = self._count_by_chunk(curr_workers)

        chunks_cleared = sum(
            1 for chunk_id in prev_by_chunk
            if prev_by_chunk[chunk_id] > 0 and curr_by_chunk.get(chunk_id, 0) == 0
        )

        details = {
            'prev_count': prev_count,
            'curr_count': curr_count,
            'rate': rate,
            'chunks_cleared': chunks_cleared
        }

        return reward, details

    def _calculate_protector_reward(
        self,
        prev_obs: Dict[str, Any],
        curr_obs: Dict[str, Any]
    ) -> tuple:
        """
        Calculate reward for protector reduction.

        Positive reward when protector count decreases.
        """
        prev_protectors = prev_obs.get('protectors', [])
        curr_protectors = curr_obs.get('protectors', [])

        prev_count = len(prev_protectors)
        curr_count = len(curr_protectors)

        # Calculate rate of change
        rate = self._calculate_rate(prev_count, curr_count)

        # Invert: negative rate (fewer protectors) = positive reward
        reward = -rate

        # Count protectors killed
        protectors_killed = max(0, prev_count - curr_count)

        details = {
            'prev_count': prev_count,
            'curr_count': curr_count,
            'rate': rate,
            'protectors_killed': protectors_killed
        }

        return reward, details

    def _calculate_energy_reward(
        self,
        prev_obs: Dict[str, Any],
        curr_obs: Dict[str, Any]
    ) -> tuple:
        """
        Calculate reward for player energy drain.

        Positive reward when player energy decreases.
        """
        player_energy = curr_obs.get('playerEnergy', {})
        start_energy = player_energy.get('start', 0)
        end_energy = player_energy.get('end', 0)

        # Calculate rate from the observation window
        rate = self._calculate_rate(start_energy, end_energy)

        # Invert: negative rate (energy declining) = positive reward
        reward = -rate

        details = {
            'start_energy': start_energy,
            'end_energy': end_energy,
            'rate': rate,
            'energy_drained': max(0, start_energy - end_energy)
        }

        return reward, details

    def _calculate_bonuses(
        self,
        prev_obs: Dict[str, Any],
        curr_obs: Dict[str, Any],
        details: Dict[str, Any]
    ) -> Dict[str, float]:
        """Calculate bonus rewards for specific achievements."""
        bonuses = {
            'mining_stopped': 0.0,
            'protectors_killed': 0.0,
            'total': 0.0
        }

        # Bonus for completely clearing mining from chunks
        chunks_cleared = details.get('mining', {}).get('chunks_cleared', 0)
        if chunks_cleared > 0:
            bonuses['mining_stopped'] = chunks_cleared * self.config.mining_stopped_bonus

        # Bonus for killing protectors
        protectors_killed = details.get('protector', {}).get('protectors_killed', 0)
        if protectors_killed > 0:
            bonuses['protectors_killed'] = protectors_killed * self.config.protector_killed_bonus

        bonuses['total'] = bonuses['mining_stopped'] + bonuses['protectors_killed']

        return bonuses

    def _is_no_impact(self, details: Dict[str, Any]) -> bool:
        """Check if the action had no observable impact."""
        mining_rate = abs(details.get('mining', {}).get('rate', 0))
        protector_rate = abs(details.get('protector', {}).get('rate', 0))
        energy_rate = abs(details.get('energy', {}).get('rate', 0))

        # No impact if all rates are near zero
        threshold = 0.05
        return (
            mining_rate < threshold and
            protector_rate < threshold and
            energy_rate < threshold
        )

    def _calculate_rate(self, start: float, end: float) -> float:
        """
        Calculate normalized rate of change.

        Formula: (end - start) / max(start, end)
        Returns value in [-1, +1] range.
        """
        if start == 0 and end == 0:
            return 0.0

        max_val = max(start, end)
        if max_val == 0:
            return 0.0

        return (end - start) / max_val

    def _count_by_chunk(self, entities: List[Dict[str, Any]]) -> Dict[int, int]:
        """Count entities per chunk."""
        counts = defaultdict(int)
        for entity in entities:
            chunk_id = entity.get('chunkId', -1)
            if chunk_id >= 0:
                counts[chunk_id] += 1
        return dict(counts)

    def _update_history(self, observation: Dict[str, Any], reward: float) -> None:
        """Update observation and reward history."""
        self.observation_history.append(observation)
        self.reward_history.append(reward)

        # Trim to max history
        if len(self.observation_history) > self.max_history:
            self.observation_history.pop(0)
            self.reward_history.pop(0)

    def get_average_reward(self, window: int = 5) -> float:
        """Get average reward over recent history."""
        if not self.reward_history:
            return 0.0

        recent = self.reward_history[-window:]
        return sum(recent) / len(recent)

    def get_reward_trend(self) -> str:
        """Get reward trend (improving, declining, stable)."""
        if len(self.reward_history) < 3:
            return 'insufficient_data'

        recent = self.reward_history[-5:]
        older = self.reward_history[-10:-5] if len(self.reward_history) >= 10 else self.reward_history[:-5]

        if not older:
            return 'insufficient_data'

        recent_avg = sum(recent) / len(recent)
        older_avg = sum(older) / len(older)

        diff = recent_avg - older_avg

        if diff > 0.1:
            return 'improving'
        elif diff < -0.1:
            return 'declining'
        else:
            return 'stable'

    def get_stats(self) -> Dict[str, Any]:
        """Get reward calculator statistics."""
        return {
            'history_length': len(self.reward_history),
            'average_reward': self.get_average_reward(),
            'trend': self.get_reward_trend(),
            'recent_rewards': self.reward_history[-5:] if self.reward_history else [],
            'config': {
                'mining_weight': self.config.mining_disruption_weight,
                'protector_weight': self.config.protector_reduction_weight,
                'energy_weight': self.config.player_energy_weight
            }
        }

    def reset(self) -> None:
        """Reset history."""
        self.observation_history.clear()
        self.reward_history.clear()
