"""
AI Engine package for Adaptive Queen Intelligence
"""

from .ai_engine import AIEngine
from .neural_network import QueenBehaviorNetwork

# Continuous learning modules
from .nn_config import NNConfig, NNConfigPresets, load_nn_config
from .feature_extractor import FeatureExtractor, FeatureConfig
from .reward_calculator import RewardCalculator, RewardWeights, AdaptiveRewardCalculator
from .continuous_trainer import ContinuousTrainer, AsyncContinuousTrainer, StrategyUpdate

__all__ = [
    "AIEngine",
    "QueenBehaviorNetwork",
    # Continuous learning
    "NNConfig",
    "NNConfigPresets",
    "load_nn_config",
    "FeatureExtractor",
    "FeatureConfig",
    "RewardCalculator",
    "RewardWeights",
    "AdaptiveRewardCalculator",
    "ContinuousTrainer",
    "AsyncContinuousTrainer",
    "StrategyUpdate"
]