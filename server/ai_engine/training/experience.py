"""
Experience dataclass for replay buffer.

The gate_signal IS the training feedback - no re-evaluation needed.
"""

from dataclasses import dataclass, field
from typing import Optional
import numpy as np
import time


@dataclass
class Experience:
    """
    Single experience for replay buffer.

    Stores all information needed to train the NN on this decision.
    The gate_signal is the primary training signal.
    """

    # State - normalized features for NN
    observation: np.ndarray  # [28] normalized features

    # Action
    spawn_chunk: int  # 0-399
    spawn_type: str  # 'energy' or 'combat'
    nn_confidence: float  # NN's confidence in decision

    # Gate evaluation (THE training signal)
    gate_signal: float  # R_expected - 0.6 (can be negative!)
    R_expected: float  # Raw expected reward (for logging)

    # Execution status
    was_executed: bool  # True if SEND, False if WAIT

    # Outcome (only for SEND actions)
    actual_reward: Optional[float] = None  # From game, None for WAIT

    # Metadata
    timestamp: float = field(default_factory=time.time)
    territory_id: str = ""
    model_version: int = 0  # Which model version made this decision

    @property
    def is_send(self) -> bool:
        """Check if this was a SEND action."""
        return self.was_executed

    @property
    def is_wait(self) -> bool:
        """Check if this was a WAIT action."""
        return not self.was_executed

    @property
    def has_actual_reward(self) -> bool:
        """Check if actual reward is available (only for SEND actions)."""
        return self.actual_reward is not None

    def __repr__(self) -> str:
        action = "SEND" if self.was_executed else "WAIT"
        reward_str = f"{self.actual_reward:.3f}" if self.actual_reward is not None else "None"
        return (
            f"Experience({action}, chunk={self.spawn_chunk}, "
            f"gate_signal={self.gate_signal:.3f}, actual_reward={reward_str})"
        )
