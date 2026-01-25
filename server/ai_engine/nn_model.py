"""
Neural Network Model for Queen AI - Split-Head Architecture

Architecture: 29 → 32 → 16 → split heads
- Input: 29 normalized features from FeatureExtractor
- Hidden 1: 32 neurons (ReLU)
- Hidden 2: 16 neurons (ReLU)
- Chunk Head: 16 → 32 → 257 (Softmax) - spawn location (0-255) or no-spawn (256)
- Type Head: 16 → 1 (Sigmoid) - parasite type

Total parameters: ~10,530
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

# Constants
NO_SPAWN_CHUNK = 256
ARCHITECTURE_VERSION = 2  # Version 2: 257 chunk outputs (0-255 spawn, 256 no-spawn)

# Entropy regularization coefficient
# Higher = more exploration (flatter distribution)
# Lower = more exploitation (peaked distribution)
# Typical range: 0.01 to 0.1
# 0.03 balances learning with collapse prevention
DEFAULT_ENTROPY_COEF = 0.03


def create_entropy_regularized_loss(entropy_coef: float = DEFAULT_ENTROPY_COEF):
    """
    Create a categorical cross-entropy loss with entropy regularization.

    The entropy term encourages the model to maintain a diverse probability
    distribution, preventing collapse to a single dominant action.

    Loss = CrossEntropy(y_true, y_pred) - entropy_coef * Entropy(y_pred)

    Where:
        Entropy(P) = -Σ P(x) * log(P(x))

    Entropy is MAXIMIZED when distribution is uniform (flat).
    Entropy is MINIMIZED when distribution is peaked (one-hot).

    By SUBTRACTING entropy from loss, we incentivize higher entropy
    (flatter distributions), preventing the "argmax trap" where the
    model collapses to always selecting the same action.

    Args:
        entropy_coef: Weight for entropy term (default 0.05)

    Returns:
        Loss function compatible with Keras
    """
    def loss_with_entropy(y_true, y_pred):
        # Standard categorical cross-entropy
        # This pulls predictions toward the target
        ce_loss = tf.keras.losses.categorical_crossentropy(y_true, y_pred)

        # Entropy of the predicted distribution
        # H(P) = -Σ P(x) * log(P(x))
        # Add small epsilon to prevent log(0)
        entropy = -tf.reduce_sum(y_pred * tf.math.log(y_pred + 1e-8), axis=-1)

        # Combined loss:
        # - Minimize cross-entropy (learn from rewards)
        # - Maximize entropy (maintain exploration)
        # Since we minimize loss, we SUBTRACT entropy (to maximize it)
        total_loss = ce_loss - entropy_coef * entropy

        return total_loss

    # Set a name for debugging
    loss_with_entropy.__name__ = f'ce_with_entropy_{entropy_coef}'

    return loss_with_entropy


class NNModel:
    """
    Split-head neural network for Queen spawn decisions.

    Outputs:
    - chunk_probs: 257-dim softmax (spawn location 0-255, or no-spawn 256)
    - type_prob: scalar sigmoid (0=energy, 1=combat)
    """

    def __init__(self, model_path: Optional[str] = None):
        if not TENSORFLOW_AVAILABLE:
            raise ImportError("TensorFlow is required. Install with: pip install tensorflow")

        self.input_size = 29
        self.hidden1_size = 32
        self.hidden2_size = 16
        self.chunk_expand_size = 32
        self.chunk_output_size = 257
        self.type_output_size = 1

        self.model_path = model_path or "models/queen_nn.weights.h5"
        self.model: Optional[Model] = None

        # Build the model
        self._build_model()

        # Try to load existing weights
        weights_loaded = self._load_model_if_exists()
        
        if not weights_loaded and os.path.exists(self.model_path):
            # Model file exists but couldn't be loaded (likely architecture mismatch)
            logger.info("Initializing fresh model with new architecture due to compatibility issues")

        logger.info(f"NNModel initialized: {self._count_parameters()} parameters")

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

        # Chunk head: 16 → 32 → 257 (softmax)
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
            name='queen_nn'
        )

        # Compile model for training
        # Use entropy-regularized loss for chunk probabilities
        # This prevents distribution collapse (the "argmax trap")
        self.entropy_coef = DEFAULT_ENTROPY_COEF
        chunk_loss = create_entropy_regularized_loss(self.entropy_coef)

        self.model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss={
                'chunk_probs': chunk_loss,  # Entropy-regularized CE
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

        logger.info(f"Model compiled with entropy regularization (coef={self.entropy_coef})")

    def _count_parameters(self) -> int:
        """Count total trainable parameters."""
        if self.model is None:
            return 0
        return int(np.sum([np.prod(v.shape) for v in self.model.trainable_weights]))

    def _load_model_if_exists(self) -> bool:
        """Load model weights if they exist, checking for architecture compatibility."""
        if os.path.exists(self.model_path):
            try:
                # Check for metadata file first
                metadata_path = self.model_path.replace('.weights.h5', '_metadata.json')
                metadata = None
                
                if os.path.exists(metadata_path):
                    try:
                        import json
                        with open(metadata_path, 'r') as f:
                            metadata = json.load(f)
                        logger.info(f"Loaded model metadata from {metadata_path}")
                    except Exception as e:
                        logger.warning(f"Failed to load metadata: {e}")
                
                # Check architecture compatibility
                if metadata:
                    saved_version = metadata.get('architecture_version', 1)  # Default to v1 if missing
                    saved_chunk_size = metadata.get('chunk_output_size', 256)  # Default to 256 if missing
                    
                    if saved_version != ARCHITECTURE_VERSION:
                        logger.warning(f"Architecture version mismatch: saved={saved_version}, current={ARCHITECTURE_VERSION}")
                        return False
                        
                    if saved_chunk_size != self.chunk_output_size:
                        logger.warning(f"Chunk output size mismatch: saved={saved_chunk_size}, current={self.chunk_output_size}")
                        self._backup_incompatible_model()
                        return False
                else:
                    # No metadata file - assume old model (256 outputs)
                    logger.warning("No metadata file found - assuming old model with 256 outputs")
                    if self.chunk_output_size != 256:
                        logger.warning(f"Architecture mismatch: old model has 256 outputs, current expects {self.chunk_output_size}")
                        self._backup_incompatible_model()
                        return False
                
                # Try to load weights
                self.model.load_weights(self.model_path)
                logger.info(f"Loaded model weights from {self.model_path}")
                return True
                
            except Exception as e:
                logger.warning(f"Failed to load model weights: {e}")
                # Don't crash - let the model continue with fresh weights
                logger.info("Continuing with fresh model weights")
                return False
        return False

    def _backup_incompatible_model(self) -> None:
        """Backup incompatible model file to avoid data loss."""
        try:
            import shutil
            import time
            
            timestamp = int(time.time())
            backup_path = f"{self.model_path}.backup_{timestamp}"
            
            if os.path.exists(self.model_path):
                shutil.copy2(self.model_path, backup_path)
                logger.info(f"Backed up incompatible model to {backup_path}")
                
            # Also backup metadata if it exists
            metadata_path = self.model_path.replace('.weights.h5', '_metadata.json')
            if os.path.exists(metadata_path):
                backup_metadata_path = f"{metadata_path}.backup_{timestamp}"
                shutil.copy2(metadata_path, backup_metadata_path)
                logger.info(f"Backed up metadata to {backup_metadata_path}")
                
        except Exception as e:
            logger.warning(f"Failed to backup incompatible model: {e}")

    def save_model(self, path: Optional[str] = None) -> bool:
        """Save model weights with metadata."""
        save_path = path or self.model_path
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            
            # Save weights
            self.model.save_weights(save_path)
            
            # Save metadata
            metadata_path = save_path.replace('.weights.h5', '_metadata.json')
            metadata = {
                'architecture_version': ARCHITECTURE_VERSION,
                'chunk_output_size': self.chunk_output_size,
                'input_size': self.input_size,
                'hidden1_size': self.hidden1_size,
                'hidden2_size': self.hidden2_size,
                'total_parameters': self._count_parameters()
            }
            
            import json
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            logger.info(f"Saved model weights to {save_path}")
            logger.info(f"Saved model metadata to {metadata_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
            return False

    def predict(self, features: np.ndarray) -> Tuple[np.ndarray, float]:
        """
        Run inference on input features.

        Args:
            features: numpy array of shape (29,) or (batch, 29)

        Returns:
            Tuple of (chunk_probs, type_prob)
            - chunk_probs: array of shape (257,) or (batch, 257)
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

    def get_spawn_decision(self, features: np.ndarray, explore: bool = True) -> Dict[str, Any]:
        """
        Get spawn decision from features.

        Args:
            features: numpy array of 29 normalized features
            explore: if True, sample from distribution; if False, use argmax

        Returns:
            Dictionary with:
            - spawnChunk: int (0-255) or -1 for no-spawn
            - spawnType: str ('energy', 'combat', or None for no-spawn)
            - confidence: float (chunk probability)
            - typeConfidence: float (type probability, only for spawn decisions)
            - nnDecision: str ('spawn' or 'no_spawn')
        """
        chunk_probs, type_prob = self.predict(features)

        if explore:
            # Sample from probability distribution (enables exploration)
            spawn_chunk = int(np.random.choice(len(chunk_probs), p=chunk_probs))
        else:
            # Greedy: always pick highest probability (exploitation only)
            spawn_chunk = int(np.argmax(chunk_probs))

        chunk_confidence = float(chunk_probs[spawn_chunk])

        # Check for no-spawn decision
        if spawn_chunk == NO_SPAWN_CHUNK:
            return {
                'spawnChunk': -1,
                'spawnType': None,
                'confidence': chunk_confidence,
                'nnDecision': 'no_spawn'
            }

        # Normal spawn decision
        spawn_type = 'combat' if type_prob >= 0.5 else 'energy'
        type_confidence = type_prob if type_prob >= 0.5 else (1.0 - type_prob)

        return {
            'spawnChunk': spawn_chunk,
            'spawnType': spawn_type,
            'confidence': chunk_confidence,
            'typeConfidence': float(type_confidence),
            'nnDecision': 'spawn'
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
            features: Input features (batch, 29)
            chunk_targets: One-hot encoded chunk targets (batch, 257)
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
        chunk_id: int,  # Can be -1 for no-spawn (maps to 256)
        spawn_type: Optional[str],  # Can be None for no-spawn
        reward: float,
        learning_rate: float = 0.01
    ) -> Dict[str, float]:
        """
        Train using reward signal (reinforcement learning style).

        Positive reward reinforces the action taken.
        Negative reward discourages the action taken.

        Args:
            features: Input features (29,)
            chunk_id: Chunk that was selected, or -1 for no-spawn
            spawn_type: Type that was selected ('energy', 'combat', or None for no-spawn)
            reward: Reward signal (-1 to +1)
            learning_rate: Learning rate for this update

        Returns:
            Dictionary with training info
        """
        # Map -1 to no-spawn index
        target_chunk = NO_SPAWN_CHUNK if chunk_id == -1 else chunk_id
        
        # Create target based on reward
        # For positive reward: reinforce the action
        # For negative reward: push away from the action

        chunk_probs, type_prob = self.predict(features)

        # Create chunk target
        chunk_target = np.zeros(257, dtype=np.float32)
        if reward > 0:
            # Reinforce: make selected chunk more likely
            chunk_target[target_chunk] = 1.0
        else:
            # Discourage: spread probability away from selected chunk
            # Use softmax temperature to create smooth target
            chunk_target = chunk_probs.copy()
            chunk_target[target_chunk] = max(0.0, chunk_target[target_chunk] - abs(reward) * 0.5)
            chunk_target = chunk_target / (chunk_target.sum() + 1e-8)

        # Create type target
        if spawn_type is None:
            # Use neutral type target (0.5) for no-spawn training
            type_target = 0.5
        else:
            type_target = 1.0 if spawn_type == 'combat' else 0.0
            if reward < 0:
                # Flip target for negative reward
                type_target = 1.0 - type_target

        # Set learning rate (no reward scaling - target construction handles magnitude)
        old_lr = float(self.model.optimizer.learning_rate)
        self.model.optimizer.learning_rate.assign(learning_rate)

        # Train
        result = self.train_step(
            features,
            chunk_target.reshape(1, -1),
            np.array([[type_target]], dtype=np.float32)
        )

        # Restore learning rate
        self.model.optimizer.learning_rate.assign(old_lr)

        result['reward'] = reward

        return result

    def train_with_supervision(
        self,
        features: np.ndarray,
        target_chunk: int,
        target_type: Optional[str] = None,
        learning_rate: float = 0.01
    ) -> Dict[str, float]:
        """
        Train using supervised learning (direct target).

        Used for teaching deterministic rules like "low energy = no-spawn".
        Unlike RL training, this directly teaches the correct answer.

        Args:
            features: Input features (29,)
            target_chunk: Target chunk (0-255) or 256 for no-spawn
            target_type: Target type ('energy', 'combat', or None for no-spawn)
            learning_rate: Learning rate for this update

        Returns:
            Dictionary with training info
        """
        # Create one-hot target for chunk (supervised = direct target)
        chunk_target = np.zeros(257, dtype=np.float32)
        chunk_target[target_chunk] = 1.0

        # Create type target
        if target_type is None:
            type_target = 0.5  # Neutral for no-spawn
        else:
            type_target = 1.0 if target_type == 'combat' else 0.0

        # Set learning rate
        old_lr = float(self.model.optimizer.learning_rate)
        self.model.optimizer.learning_rate.assign(learning_rate)

        # Train with direct supervised target
        result = self.train_step(
            features,
            chunk_target.reshape(1, -1),
            np.array([[type_target]], dtype=np.float32)
        )

        # Restore learning rate
        self.model.optimizer.learning_rate.assign(old_lr)

        result['mode'] = 'supervised'
        result['target_chunk'] = target_chunk

        logger.debug(f"[Supervised] Trained toward chunk {target_chunk}, loss={result.get('loss', 0):.4f}")

        return result

    def reset_weights(self, backup: bool = True) -> bool:
        """
        Reset model weights to fresh random initialization.

        This is useful when the model has collapsed to a peaked distribution
        and needs to start fresh with entropy regularization.

        Args:
            backup: If True, backup current weights before resetting

        Returns:
            True if successful
        """
        try:
            if backup and os.path.exists(self.model_path):
                # Backup current weights
                backup_path = self.model_path.replace('.weights.h5', '_backup_collapsed.weights.h5')
                import shutil
                shutil.copy(self.model_path, backup_path)
                logger.info(f"Backed up collapsed weights to {backup_path}")

            # Rebuild the model (this creates fresh random weights)
            logger.info("Resetting model weights to fresh initialization...")
            self._build_model()

            # Save the fresh weights
            self.save_model()

            # Verify the reset worked
            features = np.random.random(29).astype(np.float32)
            stats = self.get_distribution_stats(features)

            logger.info(f"Model reset complete!")
            logger.info(f"  New entropy: {stats['entropy']:.3f} / {stats['max_entropy']:.3f} ({stats['entropy_ratio']:.1%})")
            logger.info(f"  Effective actions: {stats['effective_actions']:.1f}")

            return True

        except Exception as e:
            logger.error(f"Failed to reset weights: {e}")
            return False

    def get_model_summary(self) -> str:
        """Get model architecture summary."""
        if self.model is None:
            return "Model not built"

        # Capture summary to string
        lines = []
        self.model.summary(print_fn=lambda x: lines.append(x))
        return '\n'.join(lines)

    def get_entropy(self, chunk_probs: np.ndarray) -> float:
        """
        Calculate entropy of a probability distribution.

        Entropy measures how "spread out" the distribution is:
        - High entropy (~5.5 for 257 classes) = uniform/flat distribution
        - Low entropy (~0) = peaked/collapsed distribution

        Args:
            chunk_probs: Probability distribution (257,)

        Returns:
            Entropy value (higher = more exploration)
        """
        # H(P) = -Σ P(x) * log(P(x))
        # Filter out zeros to avoid log(0)
        probs = chunk_probs[chunk_probs > 1e-10]
        return float(-np.sum(probs * np.log(probs)))

    def get_max_entropy(self) -> float:
        """
        Get maximum possible entropy (uniform distribution).

        For 257 classes: H_max = log(257) ≈ 5.55
        """
        return float(np.log(self.chunk_output_size))

    def get_distribution_stats(self, features: np.ndarray) -> Dict[str, Any]:
        """
        Get statistics about the current probability distribution.

        Useful for monitoring whether entropy regularization is working.

        Args:
            features: Input features (29,)

        Returns:
            Dictionary with distribution statistics
        """
        chunk_probs, _ = self.predict(features)

        entropy = self.get_entropy(chunk_probs)
        max_entropy = self.get_max_entropy()

        # Find top chunks
        top_indices = np.argsort(chunk_probs)[-5:][::-1]
        top_probs = chunk_probs[top_indices]

        return {
            'entropy': entropy,
            'max_entropy': max_entropy,
            'entropy_ratio': entropy / max_entropy,  # 1.0 = uniform, 0.0 = collapsed
            'top_chunk': int(top_indices[0]),
            'top_prob': float(top_probs[0]),
            'top_5_chunks': [int(i) for i in top_indices],
            'top_5_probs': [float(p) for p in top_probs],
            'effective_actions': float(np.exp(entropy)),  # Perplexity: "effective" number of choices
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get model statistics."""
        return {
            'architecture_version': ARCHITECTURE_VERSION,
            'input_size': self.input_size,
            'hidden1_size': self.hidden1_size,
            'hidden2_size': self.hidden2_size,
            'chunk_output_size': self.chunk_output_size,
            'type_output_size': self.type_output_size,
            'total_parameters': self._count_parameters(),
            'model_path': self.model_path,
            'weights_loaded': os.path.exists(self.model_path),
            'entropy_coef': getattr(self, 'entropy_coef', DEFAULT_ENTROPY_COEF),
            'max_entropy': self.get_max_entropy()
        }

    def full_reset(self) -> Dict[str, Any]:
        """
        Full reset: delete saved model files and reinitialize with random weights.

        Returns:
            Status dictionary with reset details
        """
        deleted_weights = False
        deleted_metadata = False

        # Delete saved weights file if exists
        if os.path.exists(self.model_path):
            try:
                os.remove(self.model_path)
                deleted_weights = True
                logger.info(f"Deleted weights file: {self.model_path}")
            except Exception as e:
                logger.warning(f"Failed to delete weights file: {e}")

        # Delete metadata file if exists
        metadata_path = self.model_path.replace('.weights.h5', '_metadata.json')
        if os.path.exists(metadata_path):
            try:
                os.remove(metadata_path)
                deleted_metadata = True
                logger.info(f"Deleted metadata file: {metadata_path}")
            except Exception as e:
                logger.warning(f"Failed to delete metadata file: {e}")

        # Rebuild model with fresh random weights
        self._build_model()
        logger.info(f"NNModel reset with fresh weights: {self._count_parameters()} parameters")

        return {
            'status': 'success',
            'deleted_weights_file': deleted_weights,
            'deleted_metadata_file': deleted_metadata,
            'model_path': self.model_path,
            'parameters': self._count_parameters(),
            'architecture_version': ARCHITECTURE_VERSION
        }
