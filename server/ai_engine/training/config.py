"""
Configuration for continuous training loop.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import logging
import yaml

logger = logging.getLogger(__name__)


@dataclass
class ContinuousTrainingConfig:
    """Configuration for continuous training loop."""

    # Training loop
    training_interval: float = 1.0  # Seconds between checking buffer
    batch_size: int = 32  # Legacy - not used with drain() model
    min_batch_size: int = 4  # Real game: 4 (~1 min at 15s ticks), Sim: 32 (override in game_simulator.yaml)

    # Replay buffer
    buffer_capacity: int = 10000  # Max experiences stored
    lock_timeout: float = 5.0  # Seconds to wait for lock

    # Reward weighting (for SEND actions with actual_reward)
    gate_weight: float = 0.3  # Weight for gate_signal
    actual_weight: float = 0.7  # Weight for actual_reward

    # Learning rate
    learning_rate: float = 0.001

    # Gate threshold (must match gate config)
    reward_threshold: float = 0.6

    # Feature flags
    enabled: bool = True  # Master switch

    def validate(self) -> bool:
        """Validate configuration values."""
        errors = []

        if self.training_interval <= 0:
            errors.append("training_interval must be positive")
        if self.batch_size <= 0:
            errors.append("batch_size must be positive")
        if self.min_batch_size <= 0:
            errors.append("min_batch_size must be positive")
        if self.min_batch_size > self.batch_size:
            errors.append("min_batch_size must be <= batch_size")
        if self.buffer_capacity <= 0:
            errors.append("buffer_capacity must be positive")
        if self.lock_timeout <= 0:
            errors.append("lock_timeout must be positive")

        weight_sum = self.gate_weight + self.actual_weight
        if abs(weight_sum - 1.0) > 0.01:
            errors.append(f"Reward weights should sum to 1.0, got {weight_sum}")

        if self.learning_rate <= 0:
            errors.append("learning_rate must be positive")

        if errors:
            for error in errors:
                logger.error(f"[ContinuousTraining] Config validation error: {error}")
            return False

        return True

    @classmethod
    def from_yaml(cls, path: Path) -> "ContinuousTrainingConfig":
        """Load configuration from YAML file."""
        if not path.exists():
            logger.warning(f"[ContinuousTraining] Config file not found: {path}, using defaults")
            return cls()

        try:
            with open(path, "r") as f:
                data = yaml.safe_load(f) or {}

            config = cls(
                training_interval=data.get("training_interval", cls.training_interval),
                batch_size=data.get("batch_size", cls.batch_size),
                min_batch_size=data.get("min_batch_size", cls.min_batch_size),
                buffer_capacity=data.get("buffer_capacity", cls.buffer_capacity),
                lock_timeout=data.get("lock_timeout", cls.lock_timeout),
                gate_weight=data.get("gate_weight", cls.gate_weight),
                actual_weight=data.get("actual_weight", cls.actual_weight),
                learning_rate=data.get("learning_rate", cls.learning_rate),
                reward_threshold=data.get("reward_threshold", cls.reward_threshold),
                enabled=data.get("enabled", cls.enabled),
            )

            if not config.validate():
                logger.warning("[ContinuousTraining] Invalid config, using defaults")
                return cls()

            return config

        except Exception as e:
            logger.error(f"[ContinuousTraining] Failed to load config: {e}")
            return cls()

    def to_dict(self) -> dict:
        """Convert to dictionary for logging/serialization."""
        return {
            "training_interval": self.training_interval,
            "batch_size": self.batch_size,
            "min_batch_size": self.min_batch_size,
            "buffer_capacity": self.buffer_capacity,
            "lock_timeout": self.lock_timeout,
            "gate_weight": self.gate_weight,
            "actual_weight": self.actual_weight,
            "learning_rate": self.learning_rate,
            "reward_threshold": self.reward_threshold,
            "enabled": self.enabled,
        }
