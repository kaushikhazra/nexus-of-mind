"""
Continuous Training Module.

Provides experience replay buffer and background training for the Queen NN.
Gate signal IS the cost function - no re-evaluation during training.
"""

from .experience import Experience
from .buffer import ExperienceReplayBuffer
from .config import ContinuousTrainingConfig
from .trainer import ContinuousTrainer
from .metrics import TrainingMetrics

__all__ = [
    'Experience',
    'ExperienceReplayBuffer',
    'ContinuousTrainingConfig',
    'ContinuousTrainer',
    'TrainingMetrics',
]
