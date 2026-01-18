"""
Neural Network Model V2 for Queen AI - Split-Head Architecture

Architecture: 28 → 32 → 16 → split heads
- Input: 28 normalized features from FeatureExtractorV2
- Hidden 1: 32 neurons (ReLU)
- Hidden 2: 16 neurons (ReLU)
- Chunk Head: 16 → 32 → 256 (Softmax) - spawn location
- Type Head: 16 → 1 (Sigmoid) - parasite type

Total parameters: ~10,465
"""

import logging
import os
from typing import Dict, Any, Optional, Tuple
import numpy as np

try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers, Model
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    tf = None
    keras = None
    layers = None
    Model = None

logger = logging.getLogger(__name__)


class NNModelV2:
    """
    Split-head neural network for Queen spawn decisions.

    Outputs:
    - chunk_probs: 256-dim softmax (spawn location)
    - type_prob: scalar sigmoid (0=energy, 1=combat)
    """

    def __init__(self, model_path: Optional[str] = None):
        if not TENSORFLOW_AVAILABLE:
            raise ImportError("TensorFlow is required. Install with: pip install tensorflow")

        self.input_size = 28
        self.hidden1_size = 32
        self.hidden2_size = 16
        self.chunk_expand_size = 32
        self.chunk_output_size = 256
        self.type_output_size = 1

        self.model_path = model_path or "models/queen_nn_v2.keras"
        self.model: Optional[Model] = None

        # Build the model
        self._build_model()

        # Try to load existing weights
        self._load_model_if_exists()

        logger.info(f"NNModelV2 initialized: {self._count_parameters()} parameters")

    def _build_model(self) -> None:
        """Build the split-head neural network architecture."""
        # Input layer
        inputs = keras.Input(shape=(self.input_size,), name='features')

        # Shared layers
        x = layers.Dense(
            self.hidden1_size,
            activation='relu',
            kernel_initializer='he_normal',
            name='hidden1'
        )(inputs)

        x = layers.Dense(
            self.hidden2_size,
            activation='relu',
            kernel_initializer='he_normal',
            name='hidden2'
        )(x)

        # Chunk head: 16 → 32 → 256 (softmax)
        chunk_hidden = layers.Dense(
            self.chunk_expand_size,
            activation='relu',
            kernel_initializer='he_normal',
            name='chunk_expand'
        )(x)

        chunk_output = layers.Dense(
            self.chunk_output_size,
            activation='softmax',
            kernel_initializer='glorot_uniform',
            name='chunk_probs'
        )(chunk_hidden)

        # Type head: 16 → 1 (sigmoid)
        type_output = layers.Dense(
            self.type_output_size,
            activation='sigmoid',
            kernel_initializer='glorot_uniform',
            name='type_prob'
        )(x)

        # Create model with two outputs
        self.model = Model(
            inputs=inputs,
            outputs=[chunk_output, type_output],
            name='queen_nn_v2'
        )

        # Compile model for training
        self.model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss={
                'chunk_probs': 'categorical_crossentropy',
                'type_prob': 'binary_crossentropy'
            },
            loss_weights={
                'chunk_probs': 1.0,
                'type_prob': 0.5
            },
            metrics={
                'chunk_probs': 'accuracy',
                'type_prob': 'binary_accuracy'
            }
        )

    def _count_parameters(self) -> int:
        """Count total trainable parameters."""
        if self.model is None:
            return 0
        return int(np.sum([np.prod(v.shape) for v in self.model.trainable_weights]))

    def _load_model_if_exists(self) -> bool:
        """Load model weights if they exist."""
        if os.path.exists(self.model_path):
            try:
                self.model.load_weights(self.model_path)
                logger.info(f"Loaded model weights from {self.model_path}")
                return True
            except Exception as e:
                logger.warning(f"Failed to load model weights: {e}")
        return False

    def save_model(self, path: Optional[str] = None) -> bool:
        """Save model weights."""
        save_path = path or self.model_path
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            self.model.save_weights(save_path)
            logger.info(f"Saved model weights to {save_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
            return False

    def predict(self, features: np.ndarray) -> Tuple[np.ndarray, float]:
        """
        Run inference on input features.

        Args:
            features: numpy array of shape (28,) or (batch, 28)

        Returns:
            Tuple of (chunk_probs, type_prob)
            - chunk_probs: array of shape (256,) or (batch, 256)
            - type_prob: float or array of floats
        """
        # Ensure correct shape
        if features.ndim == 1:
            features = features.reshape(1, -1)

        # Run inference
        chunk_probs, type_prob = self.model.predict(features, verbose=0)

        # Return single result if single input
        if chunk_probs.shape[0] == 1:
            return chunk_probs[0], float(type_prob[0, 0])

        return chunk_probs, type_prob.flatten()

    def get_spawn_decision(self, features: np.ndarray) -> Dict[str, Any]:
        """
        Get spawn decision from features.

        Args:
            features: numpy array of 28 normalized features

        Returns:
            Dictionary with:
            - spawnChunk: int (0-255)
            - spawnType: str ('energy' or 'combat')
            - confidence: float (chunk probability)
            - typeConfidence: float (type probability)
        """
        chunk_probs, type_prob = self.predict(features)

        # Select chunk via argmax
        spawn_chunk = int(np.argmax(chunk_probs))
        chunk_confidence = float(chunk_probs[spawn_chunk])

        # Select type via threshold
        spawn_type = 'combat' if type_prob >= 0.5 else 'energy'
        type_confidence = type_prob if type_prob >= 0.5 else (1.0 - type_prob)

        return {
            'spawnChunk': spawn_chunk,
            'spawnType': spawn_type,
            'confidence': chunk_confidence,
            'typeConfidence': float(type_confidence)
        }

    def train_step(
        self,
        features: np.ndarray,
        chunk_targets: np.ndarray,
        type_targets: np.ndarray
    ) -> Dict[str, float]:
        """
        Perform a single training step.

        Args:
            features: Input features (batch, 28)
            chunk_targets: One-hot encoded chunk targets (batch, 256)
            type_targets: Binary type targets (batch, 1)

        Returns:
            Dictionary with loss values
        """
        # Ensure correct shapes
        if features.ndim == 1:
            features = features.reshape(1, -1)
        if chunk_targets.ndim == 1:
            chunk_targets = chunk_targets.reshape(1, -1)
        if type_targets.ndim == 1:
            type_targets = type_targets.reshape(-1, 1)

        # Train on batch
        history = self.model.fit(
            features,
            {'chunk_probs': chunk_targets, 'type_prob': type_targets},
            epochs=1,
            verbose=0
        )

        return {
            'loss': float(history.history['loss'][0]),
            'chunk_loss': float(history.history.get('chunk_probs_loss', [0])[0]),
            'type_loss': float(history.history.get('type_prob_loss', [0])[0])
        }

    def train_with_reward(
        self,
        features: np.ndarray,
        chunk_id: int,
        spawn_type: str,
        reward: float,
        learning_rate: float = 0.01
    ) -> Dict[str, float]:
        """
        Train using reward signal (reinforcement learning style).

        Positive reward reinforces the action taken.
        Negative reward discourages the action taken.

        Args:
            features: Input features (28,)
            chunk_id: Chunk that was selected
            spawn_type: Type that was selected ('energy' or 'combat')
            reward: Reward signal (-1 to +1)
            learning_rate: Learning rate for this update

        Returns:
            Dictionary with training info
        """
        # Create target based on reward
        # For positive reward: reinforce the action
        # For negative reward: push away from the action

        chunk_probs, type_prob = self.predict(features)

        # Create chunk target
        chunk_target = np.zeros(256, dtype=np.float32)
        if reward > 0:
            # Reinforce: make selected chunk more likely
            chunk_target[chunk_id] = 1.0
        else:
            # Discourage: spread probability away from selected chunk
            # Use softmax temperature to create smooth target
            chunk_target = chunk_probs.copy()
            chunk_target[chunk_id] = max(0.0, chunk_target[chunk_id] - abs(reward) * 0.5)
            chunk_target = chunk_target / (chunk_target.sum() + 1e-8)

        # Create type target
        type_target = 1.0 if spawn_type == 'combat' else 0.0
        if reward < 0:
            # Flip target for negative reward
            type_target = 1.0 - type_target

        # Apply reward scaling to learning rate
        scaled_lr = learning_rate * abs(reward)

        # Temporarily adjust learning rate
        old_lr = float(self.model.optimizer.learning_rate)
        self.model.optimizer.learning_rate.assign(scaled_lr)

        # Train
        result = self.train_step(
            features,
            chunk_target.reshape(1, -1),
            np.array([[type_target]], dtype=np.float32)
        )

        # Restore learning rate
        self.model.optimizer.learning_rate.assign(old_lr)

        result['reward'] = reward
        result['scaled_lr'] = scaled_lr

        return result

    def get_model_summary(self) -> str:
        """Get model architecture summary."""
        if self.model is None:
            return "Model not built"

        # Capture summary to string
        lines = []
        self.model.summary(print_fn=lambda x: lines.append(x))
        return '\n'.join(lines)

    def get_stats(self) -> Dict[str, Any]:
        """Get model statistics."""
        return {
            'input_size': self.input_size,
            'hidden1_size': self.hidden1_size,
            'hidden2_size': self.hidden2_size,
            'chunk_output_size': self.chunk_output_size,
            'type_output_size': self.type_output_size,
            'total_parameters': self._count_parameters(),
            'model_path': self.model_path,
            'weights_loaded': os.path.exists(self.model_path)
        }
