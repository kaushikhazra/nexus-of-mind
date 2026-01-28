"""
Custom exceptions for AI engine.

Provides specific exception types for different error categories,
enabling precise error handling and informative error messages.
"""

from typing import Dict, Any, Optional


class AIEngineError(Exception):
    """Base exception for AI engine errors."""
    pass


class ModelNotInitializedError(AIEngineError):
    """Raised when attempting to use an uninitialized model."""
    def __init__(self, model_name: str = "NNModel"):
        super().__init__(f"{model_name} not initialized. Call initialize() first.")
        self.model_name = model_name


class InsufficientEnergyError(AIEngineError):
    """Raised when queen lacks energy for spawn."""
    def __init__(self, required: float, available: float):
        super().__init__(
            f"Insufficient energy: {available:.1f} available, {required:.1f} required"
        )
        self.required = required
        self.available = available


class InvalidObservationError(AIEngineError):
    """Raised when observation data is malformed."""
    def __init__(self, field: str, reason: str):
        super().__init__(f"Invalid observation field '{field}': {reason}")
        self.field = field
        self.reason = reason


class GateEvaluationError(AIEngineError):
    """Raised when gate evaluation fails."""
    def __init__(self, reason: str, observation: Optional[Dict[str, Any]] = None):
        super().__init__(f"Gate evaluation failed: {reason}")
        self.reason = reason
        self.observation = observation


class TrainingError(AIEngineError):
    """Raised when training encounters an error."""
    def __init__(self, phase: str, reason: str):
        super().__init__(f"Training error in {phase}: {reason}")
        self.phase = phase
        self.reason = reason


class FeatureExtractionError(AIEngineError):
    """Raised when feature extraction fails."""
    def __init__(self, reason: str, observation: Optional[Dict[str, Any]] = None):
        super().__init__(f"Feature extraction failed: {reason}")
        self.reason = reason
        self.observation = observation


class RewardCalculationError(AIEngineError):
    """Raised when reward calculation fails."""
    def __init__(self, reason: str, outcome: Optional[Dict[str, Any]] = None):
        super().__init__(f"Reward calculation failed: {reason}")
        self.reason = reason
        self.outcome = outcome


class BufferOverflowError(AIEngineError):
    """Raised when experience replay buffer operations fail."""
    def __init__(self, operation: str, reason: str):
        super().__init__(f"Buffer {operation} failed: {reason}")
        self.operation = operation
        self.reason = reason


class ConfigurationError(AIEngineError):
    """Raised when configuration is invalid."""
    def __init__(self, config_name: str, reason: str):
        super().__init__(f"Invalid configuration '{config_name}': {reason}")
        self.config_name = config_name
        self.reason = reason
