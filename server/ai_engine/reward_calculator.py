"""
Reward Calculator for Queen AI Neural Network

Calculates reward signals for reinforcement learning based on observation changes.
The Queen is rewarded for actions that harm the player's economy.

Reward Signals:
- Positive: Mining activity decreased, protectors reduced, player energy declining
- Negative: Mining activity increased, protectors increased, player energy growing

Spawn Location Rewards (Strategic Spatial Awareness):
- IDLE mode (no workers): Penalize spawning far from hive (defensive posture)
- ACTIVE mode (workers present): Penalize spawning far from workers (offensive posture)

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
    worker_killed_bonus: float = 0.2  # Bonus per worker killed

    # Penalty for ineffective actions
    no_impact_penalty: float = -0.1  # Penalty when action has no observable impact

    # Presence-based penalties (Queen doesn't tolerate intruders)
    workers_present_penalty: float = -0.1  # Penalty when workers present and NN skips
    active_mining_penalty: float = -0.6  # Higher penalty when mining is active and NN skips
    energy_rate_penalty_multiplier: float = -0.5  # Scaled with energy rate: rate × this
    mineral_rate_penalty_multiplier: float = -0.5  # Scaled with mineral rate: rate × this (player stockpiling)

    # Spawn location rewards (strategic spatial awareness)
    hive_proximity_penalty_weight: float = -0.3  # Penalty weight when idle (spawn far from hive)
    threat_proximity_penalty_weight: float = -0.4  # Penalty weight when active (spawn far from workers)
    max_chunk_distance: float = 26.87  # Max distance on 20x20 grid: sqrt(19^2 + 19^2)
    chunks_per_axis: int = 20  # Grid size for chunk distance calculation

    # Legacy spawn gating (kept for compatibility)
    spawn_no_targets_penalty: float = -0.5  # Penalty for spawning when no targets exist
    skip_no_targets_reward: float = 0.0  # Neutral for skipping when no targets

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

        # 7. Apply spawn gating rewards/penalties
        spawn_gating_reward = self._calculate_spawn_gating_reward(
            prev_observation, curr_observation, spawn_decision, details
        )
        if spawn_gating_reward != 0:
            total_reward += spawn_gating_reward
            components['spawn_gating'] = spawn_gating_reward

        # 8. Apply spawn location rewards (strategic spatial awareness)
        spawn_location_reward = self._calculate_spawn_location_reward(
            curr_observation, spawn_decision
        )
        if spawn_location_reward != 0:
            total_reward += spawn_location_reward
            components['spawn_location'] = spawn_location_reward

        # 9. Clip to bounds
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

    def _has_workers_present(self, observation: Dict[str, Any]) -> int:
        """
        Check how many workers are PRESENT in territory (not just mining).
        Queen doesn't tolerate ANY worker intrusion.
        """
        # Use workersPresent if available, fall back to miningWorkers
        workers = observation.get('workersPresent', observation.get('miningWorkers', []))
        return len(workers)

    def _has_active_mining(self, observation: Dict[str, Any]) -> bool:
        """
        Check if active mining is happening.
        Uses miningWorkers count as indicator.
        """
        mining_workers = observation.get('miningWorkers', [])
        return len(mining_workers) > 0

    def _get_energy_rate(self, observation: Dict[str, Any]) -> float:
        """
        Get player energy rate from observation.
        Positive = player gaining energy.
        """
        player_energy = observation.get('playerEnergy', {})
        start = player_energy.get('start', 0)
        end = player_energy.get('end', 0)
        return self._calculate_rate(start, end)

    def _get_mineral_rate(self, observation: Dict[str, Any]) -> float:
        """
        Get player mineral rate from observation.
        Positive = player accumulating minerals (stockpiling).
        """
        player_minerals = observation.get('playerMinerals', {})
        start = player_minerals.get('start', 0)
        end = player_minerals.get('end', 0)
        return self._calculate_rate(start, end)

    def _calculate_spawn_gating_reward(
        self,
        prev_observation: Dict[str, Any],
        curr_observation: Dict[str, Any],
        spawn_decision: Optional[Dict[str, Any]],
        details: Dict[str, Any]
    ) -> float:
        """
        Calculate reward/penalty based on presence-based system.

        Penalty structure:
        - Workers present + NN skips: -0.1 (Queen doesn't tolerate intruders)
        - Active mining + NN skips: -0.6 (active economic damage)
        - Energy rate positive + NN skips: scaled penalty (rate × -0.5)
        - Mineral rate positive + NN skips: scaled penalty (rate × -0.5)
        - Spawned with no workers: -0.5 (wasted energy)
        - Skipped with no workers: 0 (smart conservation)
        """
        if spawn_decision is None:
            return 0.0

        was_skipped = spawn_decision.get('skipped', False)

        # Get presence metrics from previous observation
        workers_present = self._has_workers_present(prev_observation)
        has_mining = self._has_active_mining(prev_observation)
        energy_rate = self._get_energy_rate(curr_observation)
        mineral_rate = self._get_mineral_rate(curr_observation)

        total_penalty = 0.0

        if was_skipped:
            # NN chose not to spawn - calculate presence-based penalties
            if workers_present > 0:
                # Workers in territory - Queen doesn't tolerate this
                total_penalty += self.config.workers_present_penalty
                logger.info(f"[SpawnGating] Workers present ({workers_present}): {self.config.workers_present_penalty}")

            if has_mining:
                # Active mining happening - higher penalty
                total_penalty += self.config.active_mining_penalty
                logger.info(f"[SpawnGating] Active mining: {self.config.active_mining_penalty}")

            if energy_rate > 0:
                # Player energy growing - scaled penalty
                energy_penalty = energy_rate * self.config.energy_rate_penalty_multiplier
                total_penalty += energy_penalty
                logger.info(f"[SpawnGating] Energy rate {energy_rate:.2f}: {energy_penalty:.3f}")

            if mineral_rate > 0:
                # Player accumulating minerals - scaled penalty
                mineral_penalty = mineral_rate * self.config.mineral_rate_penalty_multiplier
                total_penalty += mineral_penalty
                logger.info(f"[SpawnGating] Mineral rate {mineral_rate:.2f}: {mineral_penalty:.3f}")

            if workers_present == 0 and not has_mining and energy_rate <= 0 and mineral_rate <= 0:
                # No activity - smart conservation
                logger.info(f"[SpawnGating] No activity - smart skip")
                return self.config.skip_no_targets_reward
        else:
            # NN chose to spawn
            if workers_present == 0 and not has_mining:
                # Spawned but nothing to attack - wasted energy
                logger.info(f"[SpawnGating] Spawned without targets: {self.config.spawn_no_targets_penalty}")
                return self.config.spawn_no_targets_penalty
            # else: spawned with targets - normal reward flow handles effectiveness

        return total_penalty

    def _chunk_distance(self, chunk1: int, chunk2: int) -> float:
        """
        Calculate Euclidean distance between two chunks on the grid.

        Chunks are on a 20x20 grid (400 total).
        chunk_x = chunk % 20
        chunk_z = chunk // 20
        """
        if chunk1 < 0 or chunk2 < 0:
            return self.config.max_chunk_distance  # Max distance for invalid chunks

        x1 = chunk1 % self.config.chunks_per_axis
        z1 = chunk1 // self.config.chunks_per_axis
        x2 = chunk2 % self.config.chunks_per_axis
        z2 = chunk2 // self.config.chunks_per_axis

        return np.sqrt((x1 - x2) ** 2 + (z1 - z2) ** 2)

    def _normalize_distance(self, distance: float) -> float:
        """Normalize distance to 0-1 range."""
        return min(1.0, distance / self.config.max_chunk_distance)

    def _calculate_spawn_location_reward(
        self,
        observation: Dict[str, Any],
        spawn_decision: Optional[Dict[str, Any]]
    ) -> float:
        """
        Calculate reward/penalty based on spawn location strategy.

        IDLE mode (no workers): Penalize spawning far from hive
        ACTIVE mode (workers present): Penalize spawning far from workers

        Only applies when spawn actually occurs (not skipped).
        """
        if spawn_decision is None:
            return 0.0

        # Only apply when spawn actually occurred
        was_skipped = spawn_decision.get('skipped', False)
        if was_skipped:
            return 0.0

        spawn_chunk = spawn_decision.get('spawnChunk', -1)
        if spawn_chunk < 0:
            return 0.0

        hive_chunk = observation.get('hiveChunk', -1)
        workers_present = observation.get('workersPresent', [])

        if len(workers_present) == 0:
            # IDLE MODE: Penalize distance from hive
            if hive_chunk < 0:
                return 0.0  # No hive data

            distance = self._chunk_distance(spawn_chunk, hive_chunk)
            normalized_distance = self._normalize_distance(distance)
            penalty = normalized_distance * self.config.hive_proximity_penalty_weight

            logger.info(
                f"[SpawnLocation] Mode=IDLE, spawn={spawn_chunk}, hive={hive_chunk}, "
                f"distance={distance:.1f}, penalty={penalty:.3f}"
            )
            return penalty
        else:
            # ACTIVE MODE: Penalize distance from nearest worker
            worker_chunks = [w.get('chunkId', -1) for w in workers_present]
            worker_chunks = [c for c in worker_chunks if c >= 0]

            if not worker_chunks:
                return 0.0  # No valid worker chunks

            # Find minimum distance to any worker
            distances = [self._chunk_distance(spawn_chunk, wc) for wc in worker_chunks]
            min_distance = min(distances)
            nearest_worker_chunk = worker_chunks[distances.index(min_distance)]

            normalized_distance = self._normalize_distance(min_distance)
            penalty = normalized_distance * self.config.threat_proximity_penalty_weight

            logger.info(
                f"[SpawnLocation] Mode=ACTIVE, spawn={spawn_chunk}, nearest_worker={nearest_worker_chunk}, "
                f"distance={min_distance:.1f}, penalty={penalty:.3f}"
            )
            return penalty

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
