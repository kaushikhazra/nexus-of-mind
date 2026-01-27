"""
Gate Metrics Collection

Collects and aggregates statistics for simulation-gated inference.
Provides rolling windows for time-series analysis.
"""

import time
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from collections import deque

logger = logging.getLogger(__name__)


@dataclass
class GateMetricsSample:
    """Single sample of gate metrics."""
    timestamp: float
    decision: str  # 'SEND' or 'WAIT'
    reason: str
    expected_reward: float
    nn_confidence: float
    components: Dict[str, float]


class GateMetrics:
    """
    Collects rolling statistics for simulation gate.

    Tracks:
    - Gate pass rate over time
    - Average expected reward
    - Component breakdowns
    """

    def __init__(self, window_size: int = 100):
        """
        Initialize metrics collector.

        Args:
            window_size: Number of samples to keep for rolling statistics
        """
        self.window_size = window_size
        self.samples: deque = deque(maxlen=window_size)

        # Lifetime counters
        self.total_evaluations = 0
        self.total_sends = 0
        self.total_waits = 0
        self.total_insufficient_energy = 0

        # Time tracking
        self.start_time = time.time()
        self.last_action_time: Optional[float] = None
        self.last_evaluation_time: Optional[float] = None

        # Cumulative reward tracking
        self.cumulative_expected_reward = 0.0
        self.cumulative_actual_reward = 0.0

    def record_evaluation(
        self,
        decision: str,
        reason: str,
        expected_reward: float,
        nn_confidence: float,
        components: Dict[str, float]
    ) -> None:
        """
        Record a gate evaluation.

        Args:
            decision: 'SEND' or 'WAIT'
            reason: Decision reason
            expected_reward: Calculated expected reward
            nn_confidence: NN's confidence score
            components: Breakdown of cost function components
        """
        now = time.time()

        sample = GateMetricsSample(
            timestamp=now,
            decision=decision,
            reason=reason,
            expected_reward=expected_reward,
            nn_confidence=nn_confidence,
            components=components
        )
        self.samples.append(sample)

        # Update lifetime counters
        self.total_evaluations += 1
        self.last_evaluation_time = now

        if decision == 'SEND':
            self.total_sends += 1
            self.last_action_time = now
        else:
            self.total_waits += 1
            if reason == 'insufficient_energy':
                self.total_insufficient_energy += 1

        # Track cumulative expected reward (only for valid actions)
        if expected_reward != float('-inf'):
            self.cumulative_expected_reward += expected_reward

    def record_actual_reward(self, reward: float) -> None:
        """Record actual reward received from game."""
        self.cumulative_actual_reward += reward

    def get_pass_rate(self, window: Optional[int] = None) -> float:
        """
        Get gate pass rate.

        Args:
            window: Number of recent samples (None for all samples in buffer)

        Returns:
            Pass rate as fraction [0, 1]
        """
        samples = list(self.samples)
        if window:
            samples = samples[-window:]

        if not samples:
            return 0.0

        sends = sum(1 for s in samples if s.decision == 'SEND')
        return sends / len(samples)

    def get_lifetime_pass_rate(self) -> float:
        """Get lifetime gate pass rate."""
        if self.total_evaluations == 0:
            return 0.0
        return self.total_sends / self.total_evaluations

    def get_average_expected_reward(self, window: Optional[int] = None) -> float:
        """
        Get average expected reward (excluding -inf).

        Args:
            window: Number of recent samples (None for all samples in buffer)

        Returns:
            Average expected reward
        """
        samples = list(self.samples)
        if window:
            samples = samples[-window:]

        valid_rewards = [s.expected_reward for s in samples
                        if s.expected_reward != float('-inf')]

        if not valid_rewards:
            return 0.0

        return sum(valid_rewards) / len(valid_rewards)

    def get_time_since_last_action(self) -> float:
        """Get seconds since last SEND decision."""
        if self.last_action_time is None:
            return time.time() - self.start_time
        return time.time() - self.last_action_time

    def get_wait_streak(self) -> int:
        """Get number of consecutive WAIT decisions."""
        streak = 0
        for sample in reversed(list(self.samples)):
            if sample.decision == 'WAIT':
                streak += 1
            else:
                break
        return streak

    def get_average_components(self, window: Optional[int] = None) -> Dict[str, float]:
        """
        Get average component values.

        Args:
            window: Number of recent samples (None for all samples in buffer)

        Returns:
            Dict of component name -> average value
        """
        samples = list(self.samples)
        if window:
            samples = samples[-window:]

        if not samples:
            return {}

        # Collect all component values
        component_sums: Dict[str, float] = {}
        component_counts: Dict[str, int] = {}

        for sample in samples:
            for name, value in sample.components.items():
                if name not in component_sums:
                    component_sums[name] = 0.0
                    component_counts[name] = 0
                component_sums[name] += value
                component_counts[name] += 1

        return {
            name: component_sums[name] / component_counts[name]
            for name in component_sums
        }

    def get_statistics(self) -> Dict:
        """
        Get comprehensive statistics summary.

        Returns:
            Dict with all metrics
        """
        return {
            'lifetime': {
                'total_evaluations': self.total_evaluations,
                'total_sends': self.total_sends,
                'total_waits': self.total_waits,
                'pass_rate': self.get_lifetime_pass_rate(),
                'insufficient_energy_count': self.total_insufficient_energy,
                'cumulative_expected_reward': self.cumulative_expected_reward,
                'cumulative_actual_reward': self.cumulative_actual_reward,
                'uptime_seconds': time.time() - self.start_time
            },
            'rolling': {
                'window_size': len(self.samples),
                'pass_rate': self.get_pass_rate(),
                'average_expected_reward': self.get_average_expected_reward(),
                'average_components': self.get_average_components()
            },
            'recent': {
                'time_since_last_action': self.get_time_since_last_action(),
                'wait_streak': self.get_wait_streak()
            }
        }

    def reset(self) -> None:
        """Reset all metrics."""
        self.samples.clear()
        self.total_evaluations = 0
        self.total_sends = 0
        self.total_waits = 0
        self.total_insufficient_energy = 0
        self.start_time = time.time()
        self.last_action_time = None
        self.last_evaluation_time = None
        self.cumulative_expected_reward = 0.0
        self.cumulative_actual_reward = 0.0
