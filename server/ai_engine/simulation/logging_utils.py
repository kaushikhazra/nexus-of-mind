"""
Structured Logging for Simulation Gate

Provides JSON-formatted logging for gate decisions, suitable for parsing
and analysis tools.
"""

import json
import time
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict

logger = logging.getLogger('simulation_gate')


@dataclass
class GateLogEntry:
    """Structured log entry for gate decisions."""
    timestamp: float
    decision: str
    reason: str
    spawn_chunk: int
    spawn_type: str
    expected_reward: float
    nn_confidence: float
    components: Dict[str, float]
    observation_count: int  # How many observations since last action
    territory_id: str


class GateLogger:
    """
    Structured logger for simulation gate decisions.

    Outputs JSON-formatted logs for easy parsing.
    """

    def __init__(self, log_level: int = logging.INFO):
        """
        Initialize gate logger.

        Args:
            log_level: Logging level for gate messages
        """
        self.log_level = log_level
        self._setup_logger()

    def _setup_logger(self) -> None:
        """Configure the simulation gate logger."""
        # Use existing logger, just ensure proper formatting
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        logger.setLevel(self.log_level)

    def log_decision(
        self,
        decision: str,
        reason: str,
        spawn_chunk: int,
        spawn_type: str,
        expected_reward: float,
        nn_confidence: float,
        components: Dict[str, float],
        observation_count: int = 0,
        territory_id: str = 'unknown'
    ) -> None:
        """
        Log a gate decision in structured format.

        Args:
            decision: 'SEND' or 'WAIT'
            reason: Decision reason
            spawn_chunk: Proposed spawn chunk
            spawn_type: 'energy' or 'combat'
            expected_reward: Calculated expected reward
            nn_confidence: NN confidence score
            components: Cost function component values
            observation_count: Observations since last action
            territory_id: Territory identifier
        """
        entry = GateLogEntry(
            timestamp=time.time(),
            decision=decision,
            reason=reason,
            spawn_chunk=spawn_chunk,
            spawn_type=spawn_type,
            expected_reward=expected_reward,
            nn_confidence=nn_confidence,
            components=components,
            observation_count=observation_count,
            territory_id=territory_id
        )

        # Human-readable summary
        summary = self._format_summary(entry)

        # JSON for parsing
        json_data = self._to_json(entry)

        if decision == 'SEND':
            logger.info(f"[SimGate] {summary}")
            logger.debug(f"[SimGate:JSON] {json_data}")
        else:
            logger.info(f"[SimGate] {summary}")
            logger.debug(f"[SimGate:JSON] {json_data}")

    def _format_summary(self, entry: GateLogEntry) -> str:
        """Format human-readable summary."""
        if entry.expected_reward == float('-inf'):
            reward_str = '-inf'
        else:
            reward_str = f'{entry.expected_reward:.3f}'

        comp_str = ', '.join(f'{k}={v:.3f}' for k, v in entry.components.items())

        return (
            f"{entry.decision}: chunk={entry.spawn_chunk}, type={entry.spawn_type}, "
            f"reward={reward_str}, conf={entry.nn_confidence:.3f}, "
            f"reason={entry.reason}, obs#{entry.observation_count} [{comp_str}]"
        )

    def _to_json(self, entry: GateLogEntry) -> str:
        """Convert entry to JSON string."""
        data = asdict(entry)
        # Handle -inf for JSON serialization
        if data['expected_reward'] == float('-inf'):
            data['expected_reward'] = None
            data['expected_reward_valid'] = False
        else:
            data['expected_reward_valid'] = True
        return json.dumps(data)

    def log_statistics(self, stats: Dict[str, Any]) -> None:
        """
        Log gate statistics summary.

        Args:
            stats: Statistics dict from GateMetrics
        """
        logger.info(f"[SimGate:Stats] {json.dumps(stats, default=str)}")

    def log_wait_streak_warning(
        self,
        streak: int,
        time_since_action: float,
        threshold: int = 10
    ) -> None:
        """
        Log warning when wait streak exceeds threshold.

        Args:
            streak: Number of consecutive WAIT decisions
            time_since_action: Seconds since last SEND
            threshold: Warning threshold
        """
        if streak >= threshold:
            logger.warning(
                f"[SimGate:DeadlockRisk] Wait streak={streak}, "
                f"time_since_action={time_since_action:.1f}s - "
                f"Consider checking exploration bonus configuration"
            )

    def log_training_feedback(
        self,
        feedback_type: str,  # 'simulation' or 'real'
        reward: float,
        loss: float,
        spawn_chunk: int,
        spawn_type: str
    ) -> None:
        """
        Log training feedback events.

        Args:
            feedback_type: 'simulation' or 'real'
            reward: Training reward
            loss: Training loss
            spawn_chunk: Spawn location
            spawn_type: 'energy' or 'combat'
        """
        logger.info(
            f"[SimGate:Train] type={feedback_type}, reward={reward:.3f}, "
            f"loss={loss:.4f}, chunk={spawn_chunk}, spawn={spawn_type}"
        )


# Singleton instance for convenience
_gate_logger: Optional[GateLogger] = None


def get_gate_logger() -> GateLogger:
    """Get or create singleton gate logger."""
    global _gate_logger
    if _gate_logger is None:
        _gate_logger = GateLogger()
    return _gate_logger
