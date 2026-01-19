"""
Configuration for Queen AI Neural Network

Provides configurable parameters for:
- Confidence-based spawn gating
- Exploration vs exploitation balance
- Training parameters
"""

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class SpawnGatingConfig:
    """Configuration for confidence-based spawn gating."""

    # Confidence threshold - NN must be at least this confident to spawn
    # Lower = more spawns, higher = more selective
    confidence_threshold: float = 0.5

    # Exploration rate - chance to spawn despite low confidence (for learning)
    # Higher = more exploration, lower = more exploitation of learned behavior
    exploration_rate: float = 0.1

    # Minimum workers required to consider spawning (0 = no minimum)
    min_workers_for_spawn: int = 0

    @classmethod
    def from_env(cls) -> 'SpawnGatingConfig':
        """Create config from environment variables."""
        return cls(
            confidence_threshold=float(os.getenv('NN_CONFIDENCE_THRESHOLD', '0.5')),
            exploration_rate=float(os.getenv('NN_EXPLORATION_RATE', '0.1')),
            min_workers_for_spawn=int(os.getenv('NN_MIN_WORKERS', '0'))
        )


@dataclass
class TrainingConfig:
    """Configuration for NN training."""

    # Learning rate for reward-based training
    learning_rate: float = 0.01

    # Discount factor for future rewards
    discount_factor: float = 0.95

    # Batch size for training
    batch_size: int = 32

    # How often to save the model (in training steps)
    save_frequency: int = 100

    @classmethod
    def from_env(cls) -> 'TrainingConfig':
        """Create config from environment variables."""
        return cls(
            learning_rate=float(os.getenv('NN_LEARNING_RATE', '0.01')),
            discount_factor=float(os.getenv('NN_DISCOUNT_FACTOR', '0.95')),
            batch_size=int(os.getenv('NN_BATCH_SIZE', '32')),
            save_frequency=int(os.getenv('NN_SAVE_FREQUENCY', '100'))
        )


@dataclass
class NNConfig:
    """Master configuration for Queen NN."""

    spawn_gating: SpawnGatingConfig
    training: TrainingConfig

    @classmethod
    def default(cls) -> 'NNConfig':
        """Create default configuration."""
        return cls(
            spawn_gating=SpawnGatingConfig(),
            training=TrainingConfig()
        )

    @classmethod
    def from_env(cls) -> 'NNConfig':
        """Create configuration from environment variables."""
        return cls(
            spawn_gating=SpawnGatingConfig.from_env(),
            training=TrainingConfig.from_env()
        )


# Global config instance (lazy loaded)
_config: Optional[NNConfig] = None


def get_config() -> NNConfig:
    """Get the global configuration instance."""
    global _config
    if _config is None:
        _config = NNConfig.from_env()
    return _config


def set_config(config: NNConfig) -> None:
    """Set the global configuration instance."""
    global _config
    _config = config


def reset_config() -> None:
    """Reset to default configuration."""
    global _config
    _config = NNConfig.default()
