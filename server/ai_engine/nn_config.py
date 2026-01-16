"""
Neural Network Configuration for Queen AI Continuous Learning

This module provides a configurable neural network architecture that can be
tuned via JSON files or environment variables for easy experimentation.
"""

import json
import os
import logging
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)


@dataclass
class NNConfig:
    """Neural Network Configuration for Queen AI"""

    # ==================== Architecture ====================

    # Number of input features (fixed by observation space)
    input_size: int = 20

    # Number of outputs (fixed by action space)
    output_size: int = 8

    # Hidden layer sizes - can be changed for experimentation
    # Default: [64, 32] provides good capacity without overfitting
    hidden_layers: List[int] = field(default_factory=lambda: [64, 32])

    # Dropout rate between layers (regularization)
    dropout_rate: float = 0.2

    # Activation function for hidden layers
    hidden_activation: str = 'relu'

    # Activation function for output layer (0-1 range for actions)
    output_activation: str = 'sigmoid'

    # ==================== Training ====================

    # Adam optimizer learning rate
    learning_rate: float = 0.001

    # Mini-batch size for training
    batch_size: int = 32

    # Maximum experiences to store in buffer
    experience_buffer_size: int = 1000

    # Minimum samples before training starts
    min_samples_for_training: int = 32

    # ==================== Regularization ====================

    # L2 regularization strength
    l2_regularization: float = 0.0001

    # Gradient clipping (None to disable)
    gradient_clip: Optional[float] = 1.0

    # ==================== Continuous Learning ====================

    # Train every N observations (1 = every observation)
    training_frequency: int = 1

    # Reward discount factor (gamma) for future rewards
    reward_discount: float = 0.95

    # Soft update rate for target network (if using)
    target_update_rate: float = 0.01

    # ==================== Observation Window ====================

    # Interval between snapshots in milliseconds
    snapshot_interval_ms: int = 500

    # Interval between batch transmissions in milliseconds
    batch_interval_ms: int = 15000

    # Combat event window in milliseconds
    combat_event_window_ms: int = 20000

    @classmethod
    def from_file(cls, path: str) -> 'NNConfig':
        """
        Load configuration from JSON file.
        Falls back to defaults if file doesn't exist.
        """
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    data = json.load(f)
                logger.info(f"Loaded NN config from {path}")
                return cls(**data)
            except Exception as e:
                logger.warning(f"Failed to load config from {path}: {e}. Using defaults.")
                return cls()
        else:
            logger.info(f"Config file {path} not found. Using defaults.")
            return cls()

    @classmethod
    def from_env(cls) -> 'NNConfig':
        """
        Load configuration from environment variables.
        Environment variables override default values.
        """
        config = cls()

        # Architecture
        if os.getenv('NN_HIDDEN_LAYERS'):
            config.hidden_layers = json.loads(os.getenv('NN_HIDDEN_LAYERS'))
        if os.getenv('NN_DROPOUT_RATE'):
            config.dropout_rate = float(os.getenv('NN_DROPOUT_RATE'))
        if os.getenv('NN_HIDDEN_ACTIVATION'):
            config.hidden_activation = os.getenv('NN_HIDDEN_ACTIVATION')

        # Training
        if os.getenv('NN_LEARNING_RATE'):
            config.learning_rate = float(os.getenv('NN_LEARNING_RATE'))
        if os.getenv('NN_BATCH_SIZE'):
            config.batch_size = int(os.getenv('NN_BATCH_SIZE'))
        if os.getenv('NN_EXPERIENCE_BUFFER_SIZE'):
            config.experience_buffer_size = int(os.getenv('NN_EXPERIENCE_BUFFER_SIZE'))

        # Regularization
        if os.getenv('NN_L2_REGULARIZATION'):
            config.l2_regularization = float(os.getenv('NN_L2_REGULARIZATION'))
        if os.getenv('NN_GRADIENT_CLIP'):
            clip = os.getenv('NN_GRADIENT_CLIP')
            config.gradient_clip = float(clip) if clip.lower() != 'none' else None

        # Continuous Learning
        if os.getenv('NN_TRAINING_FREQUENCY'):
            config.training_frequency = int(os.getenv('NN_TRAINING_FREQUENCY'))
        if os.getenv('NN_REWARD_DISCOUNT'):
            config.reward_discount = float(os.getenv('NN_REWARD_DISCOUNT'))

        logger.info("Loaded NN config from environment variables")
        return config

    def to_file(self, path: str) -> None:
        """Save configuration to JSON file."""
        # Ensure directory exists
        os.makedirs(os.path.dirname(path), exist_ok=True)

        with open(path, 'w') as f:
            json.dump(asdict(self), f, indent=2)
        logger.info(f"Saved NN config to {path}")

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary."""
        return asdict(self)

    def describe(self) -> str:
        """Return human-readable description of architecture."""
        layers = [f"Input({self.input_size})"]
        for size in self.hidden_layers:
            layers.append(f"Dense({size}, {self.hidden_activation})")
            layers.append(f"Dropout({self.dropout_rate})")
        layers.append(f"Output({self.output_size}, {self.output_activation})")
        return " -> ".join(layers)

    def get_total_parameters(self) -> int:
        """Estimate total number of trainable parameters."""
        total = 0
        prev_size = self.input_size

        for size in self.hidden_layers:
            # Weights + biases
            total += prev_size * size + size
            prev_size = size

        # Output layer
        total += prev_size * self.output_size + self.output_size

        return total

    def validate(self) -> List[str]:
        """Validate configuration and return list of issues."""
        issues = []

        if self.input_size < 1:
            issues.append("input_size must be at least 1")
        if self.output_size < 1:
            issues.append("output_size must be at least 1")
        if not self.hidden_layers:
            issues.append("hidden_layers must have at least one layer")
        if any(size < 1 for size in self.hidden_layers):
            issues.append("All hidden layer sizes must be at least 1")
        if not 0 <= self.dropout_rate < 1:
            issues.append("dropout_rate must be in [0, 1)")
        if self.learning_rate <= 0:
            issues.append("learning_rate must be positive")
        if self.batch_size < 1:
            issues.append("batch_size must be at least 1")
        if self.experience_buffer_size < self.batch_size:
            issues.append("experience_buffer_size must be >= batch_size")
        if self.l2_regularization < 0:
            issues.append("l2_regularization must be non-negative")
        if self.gradient_clip is not None and self.gradient_clip <= 0:
            issues.append("gradient_clip must be positive or None")
        if not 0 < self.reward_discount <= 1:
            issues.append("reward_discount must be in (0, 1]")

        return issues

    def is_valid(self) -> bool:
        """Check if configuration is valid."""
        return len(self.validate()) == 0


# ==================== Preset Configurations ====================

class NNConfigPresets:
    """Predefined configuration presets for common use cases."""

    @staticmethod
    def default() -> NNConfig:
        """Default balanced configuration."""
        return NNConfig()

    @staticmethod
    def minimal() -> NNConfig:
        """
        Minimal configuration for fast training and simple patterns.
        ~1,000 parameters.
        """
        return NNConfig(
            hidden_layers=[32],
            dropout_rate=0.1,
            learning_rate=0.01,
            batch_size=16
        )

    @staticmethod
    def deep() -> NNConfig:
        """
        Deeper network for complex patterns.
        ~6,000 parameters.
        """
        return NNConfig(
            hidden_layers=[64, 64, 32],
            dropout_rate=0.3,
            learning_rate=0.0005
        )

    @staticmethod
    def wide() -> NNConfig:
        """
        Wider network for more feature interactions.
        ~5,500 parameters.
        """
        return NNConfig(
            hidden_layers=[128, 64],
            dropout_rate=0.2
        )

    @staticmethod
    def aggressive_learning() -> NNConfig:
        """
        Configuration for rapid adaptation during gameplay.
        Faster learning but potentially less stable.
        """
        return NNConfig(
            hidden_layers=[64, 32],
            dropout_rate=0.1,
            learning_rate=0.01,
            batch_size=16,
            training_frequency=1
        )

    @staticmethod
    def stable_learning() -> NNConfig:
        """
        Configuration for stable, slower learning.
        More resistant to noise and overfitting.
        """
        return NNConfig(
            hidden_layers=[64, 32],
            dropout_rate=0.3,
            learning_rate=0.0001,
            batch_size=64,
            l2_regularization=0.001,
            training_frequency=2
        )

    @staticmethod
    def get_preset(name: str) -> NNConfig:
        """Get a preset by name."""
        presets = {
            'default': NNConfigPresets.default,
            'minimal': NNConfigPresets.minimal,
            'deep': NNConfigPresets.deep,
            'wide': NNConfigPresets.wide,
            'aggressive_learning': NNConfigPresets.aggressive_learning,
            'stable_learning': NNConfigPresets.stable_learning
        }

        if name not in presets:
            logger.warning(f"Unknown preset '{name}'. Using default.")
            return NNConfigPresets.default()

        return presets[name]()

    @staticmethod
    def list_presets() -> List[str]:
        """List all available preset names."""
        return [
            'default',
            'minimal',
            'deep',
            'wide',
            'aggressive_learning',
            'stable_learning'
        ]


# ==================== Configuration Loading ====================

def load_nn_config(
    config_path: Optional[str] = None,
    preset: Optional[str] = None,
    use_env: bool = True
) -> NNConfig:
    """
    Load neural network configuration with the following priority:
    1. Environment variables (if use_env=True)
    2. Config file (if config_path provided)
    3. Preset (if preset provided)
    4. Default

    Args:
        config_path: Path to JSON config file
        preset: Name of preset to use
        use_env: Whether to apply environment variable overrides

    Returns:
        NNConfig instance
    """
    # Start with defaults or preset
    if preset:
        config = NNConfigPresets.get_preset(preset)
    else:
        config = NNConfig()

    # Override with file if provided
    if config_path and os.path.exists(config_path):
        file_config = NNConfig.from_file(config_path)
        # Merge file config into base
        for key, value in asdict(file_config).items():
            setattr(config, key, value)

    # Override with environment variables
    if use_env:
        env_config = NNConfig.from_env()
        # Only override if env var was set (check against defaults)
        default = NNConfig()
        for key, value in asdict(env_config).items():
            if value != getattr(default, key):
                setattr(config, key, value)

    # Validate
    issues = config.validate()
    if issues:
        logger.warning(f"Configuration has issues: {issues}")

    return config


# Default config path
DEFAULT_CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    'config',
    'nn_config.json'
)


def get_default_config() -> NNConfig:
    """Get the default configuration, loading from file if available."""
    return load_nn_config(config_path=DEFAULT_CONFIG_PATH)
