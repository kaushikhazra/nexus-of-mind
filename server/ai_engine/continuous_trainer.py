"""
Continuous Trainer for Queen AI Real-Time Learning

Implements continuous learning from observation batches without requiring
Queen death as a trigger. Trains incrementally and generates strategy updates.
"""

import asyncio
import json
import logging
import os
import time
from collections import deque
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field, asdict
import numpy as np

try:
    import tensorflow as tf
    from tensorflow import keras
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    tf = None
    keras = None

from .nn_config import NNConfig, load_nn_config, DEFAULT_CONFIG_PATH
from .feature_extractor import FeatureExtractor, FeatureConfig
from .reward_calculator import RewardCalculator, RewardConfig

logger = logging.getLogger(__name__)


@dataclass
class Experience:
    """Single experience tuple for training."""
    features: np.ndarray
    reward: float
    timestamp: float = field(default_factory=time.time)


@dataclass
class ModelMetadata:
    """Persistent metadata for model versioning and tracking."""
    version: int = 1
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    last_saved_at: str = field(default_factory=lambda: datetime.now().isoformat())
    total_training_iterations: int = 0
    total_samples_ever_processed: int = 0
    cumulative_training_time_seconds: float = 0.0
    best_loss: float = float('inf')
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ModelMetadata':
        """Create from dictionary."""
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class StrategyUpdate:
    """Strategy update to send to frontend."""
    timestamp: float
    version: int
    confidence: float
    spawn_zone_x: float
    spawn_zone_y: float
    spawn_rate: float
    spawn_burst: float
    aggression: float
    target_priority: float
    formation: float
    attack_timing: float
    debug_info: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'timestamp': self.timestamp,
            'version': self.version,
            'confidence': self.confidence,
            'spawn': {
                'zone': {'x': self.spawn_zone_x, 'y': self.spawn_zone_y},
                'rate': 0.1 + self.spawn_rate * 1.9,  # Map to [0.1, 2.0]
                'burstSize': int(1 + self.spawn_burst * 9)  # Map to [1, 10]
            },
            'tactics': {
                'aggression': self.aggression,
                'targetPriority': self._discretize_target_priority(self.target_priority),
                'formation': self._discretize_formation(self.formation),
                'attackTiming': self._discretize_attack_timing(self.attack_timing)
            },
            'debug': self.debug_info
        }

    def _discretize_target_priority(self, value: float) -> str:
        """Convert continuous value to discrete target priority."""
        if value < 0.25:
            return 'MINERS'
        elif value < 0.5:
            return 'PROTECTORS'
        elif value < 0.75:
            return 'BASE'
        return 'BALANCED'

    def _discretize_formation(self, value: float) -> str:
        """Convert continuous value to discrete formation type."""
        if value < 0.25:
            return 'SWARM'
        elif value < 0.5:
            return 'FLANK'
        elif value < 0.75:
            return 'SURROUND'
        return 'DEFENSIVE'

    def _discretize_attack_timing(self, value: float) -> str:
        """Convert continuous value to discrete attack timing."""
        if value < 0.33:
            return 'IMMEDIATE'
        elif value < 0.67:
            return 'DELAYED'
        return 'OPPORTUNISTIC'


class ContinuousTrainer:
    """
    Real-time continuous training system for Queen AI.

    Processes observation batches every 10-20 seconds, trains incrementally,
    and generates strategy updates for the Queen.
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        config_path: Optional[str] = None,
        config: Optional[NNConfig] = None
    ):
        if not TENSORFLOW_AVAILABLE:
            raise ImportError("TensorFlow is required. Run: pip install tensorflow")

        # Load configuration
        if config:
            self.config = config
        else:
            self.config = load_nn_config(config_path or DEFAULT_CONFIG_PATH)

        # Model path
        self.model_path = model_path or "models/queen_continuous_model.keras"
        self.metadata_path = self.model_path.replace('.keras', '_metadata.json')

        # Model metadata for versioning
        self.metadata: ModelMetadata = ModelMetadata()

        # Initialize model
        self.model: Optional[keras.Model] = None
        self._build_model()

        # Experience buffer
        self.experience_buffer: deque = deque(maxlen=self.config.experience_buffer_size)

        # Feature extraction and reward calculation
        self.feature_extractor = FeatureExtractor()
        self.reward_calculator = RewardCalculator()

        # Training state
        self.training_count = 0
        self.total_samples_processed = 0
        self.strategy_version = 0
        self.last_training_loss = 0.0
        self.last_training_time = 0.0

        # Previous observation for delta calculations
        self._previous_observation: Optional[Dict[str, Any]] = None

        # Load existing model if available
        self._load_model()

        logger.info(f"ContinuousTrainer initialized: {self.config.describe()}")

    def _build_model(self) -> None:
        """Build neural network from configuration."""
        model = keras.Sequential()

        # Input layer (first hidden layer)
        model.add(keras.layers.Dense(
            self.config.hidden_layers[0],
            activation=self.config.hidden_activation,
            input_shape=(self.config.input_size,),
            kernel_regularizer=keras.regularizers.l2(self.config.l2_regularization)
        ))
        model.add(keras.layers.Dropout(self.config.dropout_rate))

        # Additional hidden layers
        for size in self.config.hidden_layers[1:]:
            model.add(keras.layers.Dense(
                size,
                activation=self.config.hidden_activation,
                kernel_regularizer=keras.regularizers.l2(self.config.l2_regularization)
            ))
            model.add(keras.layers.Dropout(self.config.dropout_rate))

        # Output layer
        model.add(keras.layers.Dense(
            self.config.output_size,
            activation=self.config.output_activation
        ))

        # Compile with gradient clipping
        optimizer = keras.optimizers.Adam(
            learning_rate=self.config.learning_rate,
            clipnorm=self.config.gradient_clip
        )
        model.compile(optimizer=optimizer, loss='mse')

        self.model = model
        logger.info(f"Built model with {self.config.get_total_parameters()} parameters")

    def _load_model(self) -> bool:
        """Load model weights and metadata if available."""
        loaded = False
        if os.path.exists(self.model_path):
            try:
                self.model.load_weights(self.model_path)
                loaded = True
                logger.info(f"Loaded model weights from {self.model_path}")
            except Exception as e:
                logger.warning(f"Failed to load model: {e}")

        # Load metadata
        if os.path.exists(self.metadata_path):
            try:
                with open(self.metadata_path, 'r') as f:
                    data = json.load(f)
                self.metadata = ModelMetadata.from_dict(data)
                logger.info("=" * 60)
                logger.info("MODEL VERSION INFO")
                logger.info(f"  Version: {self.metadata.version}")
                logger.info(f"  Created: {self.metadata.created_at}")
                logger.info(f"  Last saved: {self.metadata.last_saved_at}")
                logger.info(f"  Total training iterations: {self.metadata.total_training_iterations}")
                logger.info(f"  Total samples processed: {self.metadata.total_samples_ever_processed}")
                logger.info(f"  Best loss: {self.metadata.best_loss:.6f}")
                if self.metadata.description:
                    logger.info(f"  Description: {self.metadata.description}")
                logger.info("=" * 60)
            except Exception as e:
                logger.warning(f"Failed to load metadata: {e}")
                self.metadata = ModelMetadata()
        else:
            if loaded:
                logger.info("No metadata file found - creating new metadata for existing model")
                self.metadata = ModelMetadata(description="Metadata created for pre-existing model")

        return loaded

    def save_model(self) -> None:
        """Save model weights and metadata."""
        try:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            self.model.save_weights(self.model_path)
            logger.info(f"Saved model weights to {self.model_path}")

            # Update and save metadata
            self._save_metadata()
        except Exception as e:
            logger.error(f"Failed to save model: {e}")

    def _save_metadata(self) -> None:
        """Save model metadata to JSON file."""
        try:
            # Update metadata
            self.metadata.version += 1
            self.metadata.last_saved_at = datetime.now().isoformat()
            self.metadata.total_training_iterations += self.training_count
            self.metadata.total_samples_ever_processed += self.total_samples_processed

            # Track best loss
            if self.last_training_loss > 0 and self.last_training_loss < self.metadata.best_loss:
                self.metadata.best_loss = self.last_training_loss

            # Save to file
            with open(self.metadata_path, 'w') as f:
                json.dump(self.metadata.to_dict(), f, indent=2)

            logger.info(f"Saved model metadata (version {self.metadata.version}) to {self.metadata_path}")
        except Exception as e:
            logger.error(f"Failed to save metadata: {e}")

    def process_observation(self, observation: Dict[str, Any]) -> StrategyUpdate:
        """
        Process incoming observation data and generate strategy update.

        Args:
            observation: Observation data from frontend

        Returns:
            Strategy update for the Queen
        """
        start_time = time.time()

        # 1. Extract features
        features = self.feature_extractor.extract(observation)

        # 2. Calculate reward
        reward = self.reward_calculator.calculate(observation, self._previous_observation)

        # 3. Store experience
        experience = Experience(features=features, reward=reward)
        self.experience_buffer.append(experience)
        self.total_samples_processed += 1

        # 4. Train if we have enough samples
        should_train = (
            len(self.experience_buffer) >= self.config.min_samples_for_training and
            self.total_samples_processed % self.config.training_frequency == 0
        )

        if should_train:
            self._train_batch()

        # 5. Generate strategy via inference
        strategy = self._generate_strategy(features, reward)

        # Store for next iteration
        self._previous_observation = observation

        self.last_training_time = time.time() - start_time
        logger.debug(f"Processed observation in {self.last_training_time:.3f}s")

        return strategy

    def _train_batch(self) -> None:
        """Train on a batch sampled from experience buffer."""
        if len(self.experience_buffer) < self.config.batch_size:
            return

        try:
            # Sample batch
            indices = np.random.choice(
                len(self.experience_buffer),
                self.config.batch_size,
                replace=False
            )
            batch = [self.experience_buffer[i] for i in indices]

            # Prepare training data
            features = np.array([exp.features for exp in batch])
            rewards = np.array([exp.reward for exp in batch])

            # Get current outputs
            current_outputs = self.model.predict(features, verbose=0)

            # Adjust outputs based on rewards (reward-weighted learning)
            # Higher reward -> reinforce current output
            # Lower reward -> push away from current output
            targets = self._compute_reward_weighted_targets(current_outputs, rewards)

            # Train
            history = self.model.fit(
                features,
                targets,
                epochs=1,
                verbose=0,
                batch_size=self.config.batch_size
            )

            self.last_training_loss = history.history['loss'][0]
            self.training_count += 1

            logger.debug(f"Training batch {self.training_count}, loss: {self.last_training_loss:.4f}")

        except Exception as e:
            logger.error(f"Training error: {e}")

    def _compute_reward_weighted_targets(
        self,
        current_outputs: np.ndarray,
        rewards: np.ndarray
    ) -> np.ndarray:
        """
        Compute training targets using reward-weighted adjustment.

        For positive rewards: reinforce current output
        For negative rewards: push towards different output
        """
        targets = current_outputs.copy()

        for i, reward in enumerate(rewards):
            if reward > 0:
                # Positive reward: slightly reinforce current output
                # (targets stay as current output, which is already being reinforced)
                pass
            else:
                # Negative reward: push outputs away
                # Add noise in opposite direction of current output
                adjustment = (0.5 - current_outputs[i]) * abs(reward) * 0.1
                targets[i] = np.clip(current_outputs[i] + adjustment, 0, 1)

        return targets

    def _generate_strategy(self, features: np.ndarray, reward: float) -> StrategyUpdate:
        """Generate strategy from model inference."""
        # Forward pass
        output = self.model.predict(features.reshape(1, -1), verbose=0)[0]

        # Calculate confidence based on output entropy and recent reward
        confidence = self._calculate_confidence(output, reward)

        # Increment strategy version
        self.strategy_version += 1

        # Create strategy update
        strategy = StrategyUpdate(
            timestamp=time.time() * 1000,  # milliseconds
            version=self.strategy_version,
            confidence=confidence,
            spawn_zone_x=float(output[0]),
            spawn_zone_y=float(output[1]),
            spawn_rate=float(output[2]),
            spawn_burst=float(output[3]),
            aggression=float(output[4]),
            target_priority=float(output[5]),
            formation=float(output[6]),
            attack_timing=float(output[7]),
            debug_info={
                'reward_signal': reward,
                'training_loss': self.last_training_loss,
                'training_count': self.training_count,
                'buffer_size': len(self.experience_buffer)
            }
        )

        return strategy

    def _calculate_confidence(self, output: np.ndarray, reward: float) -> float:
        """
        Calculate model confidence in the strategy.

        Based on:
        - Output entropy (lower entropy = higher confidence)
        - Recent reward signal
        - Training progress
        """
        # Calculate output "decisiveness" (distance from 0.5)
        decisiveness = np.mean(np.abs(output - 0.5)) * 2  # Scale to [0, 1]

        # Factor in training progress
        training_factor = min(1.0, self.training_count / 100)

        # Combine factors
        confidence = (decisiveness * 0.5 + training_factor * 0.5)

        # Adjust slightly based on recent reward
        if reward > 0:
            confidence = min(1.0, confidence + 0.1)
        elif reward < 0:
            confidence = max(0.1, confidence - 0.05)

        return float(np.clip(confidence, 0.1, 0.95))

    def get_stats(self) -> Dict[str, Any]:
        """Get trainer statistics."""
        return {
            'training_count': self.training_count,
            'total_samples_processed': self.total_samples_processed,
            'strategy_version': self.strategy_version,
            'buffer_size': len(self.experience_buffer),
            'last_training_loss': self.last_training_loss,
            'last_training_time_ms': self.last_training_time * 1000,
            'model_parameters': self.config.get_total_parameters(),
            'config': {
                'hidden_layers': self.config.hidden_layers,
                'learning_rate': self.config.learning_rate,
                'batch_size': self.config.batch_size
            },
            'model_metadata': {
                'version': self.metadata.version,
                'created_at': self.metadata.created_at,
                'last_saved_at': self.metadata.last_saved_at,
                'total_training_iterations': self.metadata.total_training_iterations,
                'total_samples_ever_processed': self.metadata.total_samples_ever_processed,
                'best_loss': self.metadata.best_loss if self.metadata.best_loss != float('inf') else None,
                'description': self.metadata.description
            }
        }

    def reset(self) -> None:
        """Reset training state (but keep model weights)."""
        self.experience_buffer.clear()
        self.training_count = 0
        self.total_samples_processed = 0
        self.strategy_version = 0
        self.last_training_loss = 0.0
        self._previous_observation = None
        self.reward_calculator.reset()
        logger.info("ContinuousTrainer reset")

    def reset_model(self) -> None:
        """Reset model weights to random initialization."""
        self._build_model()
        self.reset()
        logger.info("ContinuousTrainer model reset to random weights")

    def full_reset(self) -> Dict[str, Any]:
        """
        Full reset: delete saved model file, metadata and reset to fresh state.

        Returns:
            Status dictionary with reset details
        """
        deleted_model = False
        deleted_metadata = False
        old_version = self.metadata.version

        # Delete saved model file if exists
        if os.path.exists(self.model_path):
            try:
                os.remove(self.model_path)
                deleted_model = True
                logger.info(f"Deleted model file: {self.model_path}")
            except Exception as e:
                logger.warning(f"Failed to delete model file: {e}")

        # Delete metadata file if exists
        if os.path.exists(self.metadata_path):
            try:
                os.remove(self.metadata_path)
                deleted_metadata = True
                logger.info(f"Deleted metadata file: {self.metadata_path}")
            except Exception as e:
                logger.warning(f"Failed to delete metadata file: {e}")

        # Reset model to random weights
        self.reset_model()

        # Reset metadata to fresh state
        self.metadata = ModelMetadata(description="Fresh model after full reset")

        return {
            'status': 'success',
            'deleted_model_file': deleted_model,
            'deleted_metadata_file': deleted_metadata,
            'previous_version': old_version,
            'model_path': self.model_path,
            'metadata_path': self.metadata_path,
            'message': 'Neural network fully reset to initial state'
        }


class AsyncContinuousTrainer(ContinuousTrainer):
    """
    Async version of ContinuousTrainer for non-blocking training.

    Training happens in background while inference remains fast.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._training_lock = asyncio.Lock()
        self._pending_training = False

    async def process_observation_async(
        self,
        observation: Dict[str, Any]
    ) -> StrategyUpdate:
        """
        Process observation asynchronously.

        Inference is immediate; training is deferred.
        """
        # Extract features and calculate reward (fast)
        features = self.feature_extractor.extract(observation)
        reward = self.reward_calculator.calculate(observation, self._previous_observation)

        # Store experience
        experience = Experience(features=features, reward=reward)
        self.experience_buffer.append(experience)
        self.total_samples_processed += 1

        # Schedule training if needed (non-blocking)
        should_train = (
            len(self.experience_buffer) >= self.config.min_samples_for_training and
            self.total_samples_processed % self.config.training_frequency == 0 and
            not self._pending_training
        )

        if should_train:
            self._pending_training = True
            asyncio.create_task(self._train_batch_async())

        # Generate strategy immediately
        strategy = self._generate_strategy(features, reward)

        self._previous_observation = observation
        return strategy

    async def _train_batch_async(self) -> None:
        """Train batch asynchronously."""
        async with self._training_lock:
            try:
                # Run training in executor to avoid blocking
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self._train_batch)
            except Exception as e:
                logger.error(f"Async training error: {e}")
            finally:
                self._pending_training = False
