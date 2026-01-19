"""
Configuration for Simulation-Gated Inference

All parameters for the cost function, gate, and deadlock prevention.
"""

from dataclasses import dataclass, field
from typing import Optional
import yaml
import os
import logging

logger = logging.getLogger(__name__)


@dataclass
class SimulationGateConfig:
    """Configuration for simulation-gated inference system."""

    # Survival probability parameters
    kill_range: float = 2.0          # Chunks - protector instant kill zone
    safe_range: float = 8.0          # Chunks - beyond threat
    threat_decay: float = 0.5        # Exponential decay rate (λ)

    # Worker disruption parameters
    flee_range: float = 3.0          # Chunks - worker flee zone
    ignore_range: float = 10.0       # Chunks - beyond effect
    disruption_decay: float = 0.3    # Exponential decay rate (μ)

    # Location penalty parameters
    hive_proximity_weight: float = 0.3   # α - penalty for distance from hive (IDLE)
    worker_proximity_weight: float = 0.4  # β - penalty for distance from workers (ACTIVE)

    # Spawn costs (must match frontend Queen energy system)
    energy_parasite_cost: float = 15.0
    combat_parasite_cost: float = 25.0

    # Combined cost function weights
    survival_weight: float = 0.4     # w₁
    disruption_weight: float = 0.5   # w₂
    location_weight: float = 0.1     # w₃

    # Gate threshold
    reward_threshold: float = 0.0    # θ - only positive rewards pass

    # Exploration bonus (deadlock prevention)
    exploration_coefficient: float = 0.2  # ε
    exploration_max_time: float = 300.0   # 5 minutes max bonus

    # Confidence override (deadlock prevention)
    confidence_threshold: float = 0.8  # NN confidence to bypass gate

    # Grid parameters
    chunks_per_axis: int = 20        # 20x20 grid
    max_chunk_distance: float = 26.87  # sqrt(19² + 19²)

    # Feature flags
    gate_enabled: bool = True        # Master switch for simulation gate

    def validate(self) -> bool:
        """Validate configuration values."""
        errors = []

        if self.kill_range < 0:
            errors.append("kill_range must be non-negative")
        if self.safe_range <= self.kill_range:
            errors.append("safe_range must be greater than kill_range")
        if self.threat_decay <= 0:
            errors.append("threat_decay must be positive")

        if self.flee_range < 0:
            errors.append("flee_range must be non-negative")
        if self.ignore_range <= self.flee_range:
            errors.append("ignore_range must be greater than flee_range")
        if self.disruption_decay <= 0:
            errors.append("disruption_decay must be positive")

        if not (0 <= self.hive_proximity_weight <= 1):
            errors.append("hive_proximity_weight must be between 0 and 1")
        if not (0 <= self.worker_proximity_weight <= 1):
            errors.append("worker_proximity_weight must be between 0 and 1")

        weights_sum = self.survival_weight + self.disruption_weight + self.location_weight
        if abs(weights_sum - 1.0) > 0.01:
            errors.append(f"Combined weights should sum to 1.0, got {weights_sum}")

        if not (0 <= self.confidence_threshold <= 1):
            errors.append("confidence_threshold must be between 0 and 1")

        if errors:
            for error in errors:
                logger.error(f"Config validation error: {error}")
            return False

        return True

    @classmethod
    def from_yaml(cls, filepath: str) -> 'SimulationGateConfig':
        """Load configuration from YAML file."""
        if not os.path.exists(filepath):
            logger.warning(f"Config file not found: {filepath}, using defaults")
            return cls()

        try:
            with open(filepath, 'r') as f:
                data = yaml.safe_load(f)

            if data is None:
                return cls()

            config = cls(**{k: v for k, v in data.items() if hasattr(cls, k)})

            if not config.validate():
                logger.warning("Config validation failed, using defaults")
                return cls()

            return config
        except Exception as e:
            logger.error(f"Failed to load config from {filepath}: {e}")
            return cls()

    def to_yaml(self, filepath: str) -> None:
        """Save configuration to YAML file."""
        data = {
            'kill_range': self.kill_range,
            'safe_range': self.safe_range,
            'threat_decay': self.threat_decay,
            'flee_range': self.flee_range,
            'ignore_range': self.ignore_range,
            'disruption_decay': self.disruption_decay,
            'hive_proximity_weight': self.hive_proximity_weight,
            'worker_proximity_weight': self.worker_proximity_weight,
            'energy_parasite_cost': self.energy_parasite_cost,
            'combat_parasite_cost': self.combat_parasite_cost,
            'survival_weight': self.survival_weight,
            'disruption_weight': self.disruption_weight,
            'location_weight': self.location_weight,
            'reward_threshold': self.reward_threshold,
            'exploration_coefficient': self.exploration_coefficient,
            'exploration_max_time': self.exploration_max_time,
            'confidence_threshold': self.confidence_threshold,
            'chunks_per_axis': self.chunks_per_axis,
            'max_chunk_distance': self.max_chunk_distance,
            'gate_enabled': self.gate_enabled,
        }

        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w') as f:
            yaml.dump(data, f, default_flow_style=False)


# Default config instance
DEFAULT_CONFIG = SimulationGateConfig()
