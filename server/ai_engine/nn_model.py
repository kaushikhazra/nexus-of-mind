"""
Neural Network Model for Queen AI - Split-Head Architecture (PyTorch)

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
import json
from typing import Dict, Any, Optional, Tuple
import numpy as np

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.optim import Adam

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


def get_device() -> torch.device:
    """Get the best available device (GPU or CPU)."""
    if torch.cuda.is_available():
        device = torch.device("cuda")
        logger.info(f"Using GPU: {torch.cuda.get_device_name(0)}")
    else:
        device = torch.device("cpu")
        logger.info("Using CPU (no GPU available)")
    return device


class QueenNN(nn.Module):
    """
    PyTorch neural network for Queen spawn decisions.

    Architecture:
    - Shared backbone: 29 → 32 (ReLU) → 16 (ReLU)
    - Chunk head: 16 → 32 (ReLU) → 257 (Softmax)
    - Type head: 16 → 1 (Sigmoid)
    """

    def __init__(
        self,
        input_size: int = 29,
        hidden1_size: int = 32,
        hidden2_size: int = 16,
        chunk_expand_size: int = 32,
        chunk_output_size: int = 257,
        type_output_size: int = 1
    ):
        super().__init__()

        # Store sizes
        self.input_size = input_size
        self.hidden1_size = hidden1_size
        self.hidden2_size = hidden2_size
        self.chunk_expand_size = chunk_expand_size
        self.chunk_output_size = chunk_output_size
        self.type_output_size = type_output_size

        # Shared backbone
        self.hidden1 = nn.Linear(input_size, hidden1_size)
        self.hidden2 = nn.Linear(hidden1_size, hidden2_size)

        # Chunk head: 16 → 32 → 257
        self.chunk_expand = nn.Linear(hidden2_size, chunk_expand_size)
        self.chunk_out = nn.Linear(chunk_expand_size, chunk_output_size)

        # Type head: 16 → 1
        self.type_out = nn.Linear(hidden2_size, type_output_size)

        # Initialize weights
        self._init_weights()

    def _init_weights(self):
        """Initialize weights using He normal for ReLU layers, Xavier for output."""
        # He normal for hidden layers (ReLU activation)
        nn.init.kaiming_normal_(self.hidden1.weight, nonlinearity='relu')
        nn.init.zeros_(self.hidden1.bias)

        nn.init.kaiming_normal_(self.hidden2.weight, nonlinearity='relu')
        nn.init.zeros_(self.hidden2.bias)

        nn.init.kaiming_normal_(self.chunk_expand.weight, nonlinearity='relu')
        nn.init.zeros_(self.chunk_expand.bias)

        # Xavier/Glorot for output layers (softmax/sigmoid)
        nn.init.xavier_uniform_(self.chunk_out.weight)
        nn.init.zeros_(self.chunk_out.bias)

        nn.init.xavier_uniform_(self.type_out.weight)
        nn.init.zeros_(self.type_out.bias)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass.

        Args:
            x: Input tensor of shape (batch, 29)

        Returns:
            Tuple of (chunk_probs, type_prob)
            - chunk_probs: (batch, 257) softmax probabilities
            - type_prob: (batch, 1) sigmoid probability
        """
        # Shared backbone
        x = F.relu(self.hidden1(x))
        x = F.relu(self.hidden2(x))

        # Chunk head
        chunk = F.relu(self.chunk_expand(x))
        chunk_logits = self.chunk_out(chunk)
        chunk_probs = F.softmax(chunk_logits, dim=-1)

        # Type head
        type_prob = torch.sigmoid(self.type_out(x))

        return chunk_probs, type_prob

    def forward_with_logits(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Forward pass returning logits for training.

        Args:
            x: Input tensor of shape (batch, 29)

        Returns:
            Tuple of (chunk_logits, chunk_probs, type_prob)
        """
        # Shared backbone
        x = F.relu(self.hidden1(x))
        x = F.relu(self.hidden2(x))

        # Chunk head
        chunk = F.relu(self.chunk_expand(x))
        chunk_logits = self.chunk_out(chunk)
        chunk_probs = F.softmax(chunk_logits, dim=-1)

        # Type head
        type_prob = torch.sigmoid(self.type_out(x))

        return chunk_logits, chunk_probs, type_prob


class NNModel:
    """
    Split-head neural network for Queen spawn decisions.

    Outputs:
    - chunk_probs: 257-dim softmax (spawn location 0-255, or no-spawn 256)
    - type_prob: scalar sigmoid (0=energy, 1=combat)
    """

    def __init__(self, model_path: Optional[str] = None):
        self.input_size = 29
        self.hidden1_size = 32
        self.hidden2_size = 16
        self.chunk_expand_size = 32
        self.chunk_output_size = 257
        self.type_output_size = 1

        # Use .pt extension for PyTorch
        self.model_path = model_path or "models/queen_nn.pt"

        # Get device
        self.device = get_device()

        # Build model
        self.model = QueenNN(
            input_size=self.input_size,
            hidden1_size=self.hidden1_size,
            hidden2_size=self.hidden2_size,
            chunk_expand_size=self.chunk_expand_size,
            chunk_output_size=self.chunk_output_size,
            type_output_size=self.type_output_size
        ).to(self.device)

        # Entropy coefficient
        self.entropy_coef = DEFAULT_ENTROPY_COEF

        # Optimizer
        self.optimizer = Adam(self.model.parameters(), lr=0.001)

        # Try to load existing weights
        weights_loaded = self._load_model_if_exists()

        if not weights_loaded and os.path.exists(self.model_path):
            logger.info("Initializing fresh model with new architecture due to compatibility issues")

        logger.info(f"NNModel initialized: {self._count_parameters()} parameters on {self.device}")

    def _count_parameters(self) -> int:
        """Count total trainable parameters."""
        return sum(p.numel() for p in self.model.parameters() if p.requires_grad)

    def _load_model_if_exists(self) -> bool:
        """Load model weights if they exist, checking for architecture compatibility."""
        if os.path.exists(self.model_path):
            try:
                # Check for metadata file first
                metadata_path = self.model_path.replace('.pt', '_metadata.json')
                metadata = None

                if os.path.exists(metadata_path):
                    try:
                        with open(metadata_path, 'r') as f:
                            metadata = json.load(f)
                        logger.info(f"Loaded model metadata from {metadata_path}")
                    except Exception as e:
                        logger.warning(f"Failed to load metadata: {e}")

                # Check architecture compatibility
                if metadata:
                    saved_version = metadata.get('architecture_version', 1)
                    saved_chunk_size = metadata.get('chunk_output_size', 256)
                    saved_framework = metadata.get('framework', 'tensorflow')

                    if saved_framework != 'pytorch':
                        logger.warning(f"Framework mismatch: saved={saved_framework}, current=pytorch")
                        self._backup_incompatible_model()
                        return False

                    if saved_version != ARCHITECTURE_VERSION:
                        logger.warning(f"Architecture version mismatch: saved={saved_version}, current={ARCHITECTURE_VERSION}")
                        return False

                    if saved_chunk_size != self.chunk_output_size:
                        logger.warning(f"Chunk output size mismatch: saved={saved_chunk_size}, current={self.chunk_output_size}")
                        self._backup_incompatible_model()
                        return False

                # Try to load weights
                state_dict = torch.load(self.model_path, map_location=self.device, weights_only=True)
                self.model.load_state_dict(state_dict)
                logger.info(f"Loaded model weights from {self.model_path}")
                return True

            except Exception as e:
                logger.warning(f"Failed to load model weights: {e}")
                logger.info("Continuing with fresh model weights")
                return False

        # Check for old TensorFlow files
        tf_path = self.model_path.replace('.pt', '.weights.h5')
        if os.path.exists(tf_path):
            logger.warning(f"Found old TensorFlow weights at {tf_path} - starting fresh with PyTorch")

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
            metadata_path = self.model_path.replace('.pt', '_metadata.json')
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
            os.makedirs(os.path.dirname(save_path) if os.path.dirname(save_path) else '.', exist_ok=True)

            # Save weights
            torch.save(self.model.state_dict(), save_path)

            # Save metadata
            metadata_path = save_path.replace('.pt', '_metadata.json')
            metadata = {
                'framework': 'pytorch',
                'architecture_version': ARCHITECTURE_VERSION,
                'chunk_output_size': self.chunk_output_size,
                'input_size': self.input_size,
                'hidden1_size': self.hidden1_size,
                'hidden2_size': self.hidden2_size,
                'total_parameters': self._count_parameters(),
                'device': str(self.device)
            }

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
        single_input = features.ndim == 1
        if single_input:
            features = features.reshape(1, -1)

        # Convert to tensor
        x = torch.from_numpy(features.astype(np.float32)).to(self.device)

        # Run inference
        self.model.eval()
        with torch.no_grad():
            chunk_probs, type_prob = self.model(x)

        # Convert back to numpy
        chunk_probs = chunk_probs.cpu().numpy()
        type_prob = type_prob.cpu().numpy()

        # Return single result if single input
        if single_input:
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

    def _compute_loss(
        self,
        chunk_logits: torch.Tensor,
        chunk_probs: torch.Tensor,
        type_prob: torch.Tensor,
        chunk_targets: torch.Tensor,
        type_targets: torch.Tensor
    ) -> Tuple[torch.Tensor, Dict[str, float]]:
        """
        Compute entropy-regularized loss.

        Args:
            chunk_logits: Raw logits for chunk (batch, 257)
            chunk_probs: Softmax probabilities for chunk (batch, 257)
            type_prob: Sigmoid probability for type (batch, 1)
            chunk_targets: One-hot targets for chunk (batch, 257)
            type_targets: Binary targets for type (batch, 1)

        Returns:
            Tuple of (total_loss, loss_dict)
        """
        # Cross-entropy for chunk (using logits for numerical stability)
        # Convert one-hot to class indices
        chunk_target_indices = chunk_targets.argmax(dim=-1)
        ce_loss = F.cross_entropy(chunk_logits, chunk_target_indices)

        # Entropy of predicted distribution (maximize for exploration)
        entropy = -torch.sum(chunk_probs * torch.log(chunk_probs + 1e-8), dim=-1).mean()

        # Chunk loss with entropy regularization
        chunk_loss = ce_loss - self.entropy_coef * entropy

        # Binary cross-entropy for type
        type_loss = F.binary_cross_entropy(type_prob, type_targets)

        # Combined loss (type has 0.5 weight)
        total_loss = chunk_loss + 0.5 * type_loss

        return total_loss, {
            'loss': float(total_loss.item()),
            'chunk_loss': float(chunk_loss.item()),
            'type_loss': float(type_loss.item()),
            'entropy': float(entropy.item())
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

        # Convert to tensors
        x = torch.from_numpy(features.astype(np.float32)).to(self.device)
        chunk_t = torch.from_numpy(chunk_targets.astype(np.float32)).to(self.device)
        type_t = torch.from_numpy(type_targets.astype(np.float32)).to(self.device)

        # Forward pass
        self.model.train()
        chunk_logits, chunk_probs, type_prob = self.model.forward_with_logits(x)

        # Compute loss
        loss, loss_dict = self._compute_loss(chunk_logits, chunk_probs, type_prob, chunk_t, type_t)

        # Backward pass
        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()

        return loss_dict

    def train_with_reward(
        self,
        features: np.ndarray,
        chunk_id: int,
        spawn_type: Optional[str],
        reward: float,
        learning_rate: float = 0.01
    ) -> Dict[str, float]:
        """
        Train using reward signal (reinforcement learning style).

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

        # Get current predictions
        chunk_probs, type_prob = self.predict(features)

        # Create chunk target
        chunk_target = np.zeros(257, dtype=np.float32)
        if reward > 0:
            # Reinforce: make selected chunk more likely
            chunk_target[target_chunk] = 1.0
        else:
            # Discourage: spread probability away from selected chunk
            chunk_target = chunk_probs.copy()
            chunk_target[target_chunk] = max(0.0, chunk_target[target_chunk] - abs(reward) * 0.5)
            chunk_target = chunk_target / (chunk_target.sum() + 1e-8)

        # Create type target
        if spawn_type is None:
            type_target = 0.5
        else:
            type_target = 1.0 if spawn_type == 'combat' else 0.0
            if reward < 0:
                type_target = 1.0 - type_target

        # Set learning rate
        old_lr = self.optimizer.param_groups[0]['lr']
        self.optimizer.param_groups[0]['lr'] = learning_rate

        # Train
        result = self.train_step(
            features,
            chunk_target.reshape(1, -1),
            np.array([[type_target]], dtype=np.float32)
        )

        # Restore learning rate
        self.optimizer.param_groups[0]['lr'] = old_lr

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

        Args:
            features: Input features (29,)
            target_chunk: Target chunk (0-255) or 256 for no-spawn
            target_type: Target type ('energy', 'combat', or None for no-spawn)
            learning_rate: Learning rate for this update

        Returns:
            Dictionary with training info
        """
        # Create one-hot target for chunk
        chunk_target = np.zeros(257, dtype=np.float32)
        chunk_target[target_chunk] = 1.0

        # Create type target
        if target_type is None:
            type_target = 0.5
        else:
            type_target = 1.0 if target_type == 'combat' else 0.0

        # Set learning rate
        old_lr = self.optimizer.param_groups[0]['lr']
        self.optimizer.param_groups[0]['lr'] = learning_rate

        # Train
        result = self.train_step(
            features,
            chunk_target.reshape(1, -1),
            np.array([[type_target]], dtype=np.float32)
        )

        # Restore learning rate
        self.optimizer.param_groups[0]['lr'] = old_lr

        result['mode'] = 'supervised'
        result['target_chunk'] = target_chunk

        logger.debug(f"[Supervised] Trained toward chunk {target_chunk}, loss={result.get('loss', 0):.4f}")

        return result

    def reset_weights(self, backup: bool = True) -> bool:
        """
        Reset model weights to fresh random initialization.

        Args:
            backup: If True, backup current weights before resetting

        Returns:
            True if successful
        """
        try:
            if backup and os.path.exists(self.model_path):
                backup_path = self.model_path.replace('.pt', '_backup_collapsed.pt')
                import shutil
                shutil.copy(self.model_path, backup_path)
                logger.info(f"Backed up collapsed weights to {backup_path}")

            # Reinitialize weights
            logger.info("Resetting model weights to fresh initialization...")
            self.model._init_weights()

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
        lines = [
            "QueenNN(",
            f"  (hidden1): Linear(in_features={self.input_size}, out_features={self.hidden1_size})",
            f"  (hidden2): Linear(in_features={self.hidden1_size}, out_features={self.hidden2_size})",
            f"  (chunk_expand): Linear(in_features={self.hidden2_size}, out_features={self.chunk_expand_size})",
            f"  (chunk_out): Linear(in_features={self.chunk_expand_size}, out_features={self.chunk_output_size})",
            f"  (type_out): Linear(in_features={self.hidden2_size}, out_features={self.type_output_size})",
            ")",
            f"Total parameters: {self._count_parameters():,}",
            f"Device: {self.device}"
        ]
        return '\n'.join(lines)

    def get_entropy(self, chunk_probs: np.ndarray) -> float:
        """
        Calculate entropy of a probability distribution.

        Args:
            chunk_probs: Probability distribution (257,)

        Returns:
            Entropy value (higher = more exploration)
        """
        probs = chunk_probs[chunk_probs > 1e-10]
        return float(-np.sum(probs * np.log(probs)))

    def get_max_entropy(self) -> float:
        """Get maximum possible entropy (uniform distribution)."""
        return float(np.log(self.chunk_output_size))

    def get_distribution_stats(self, features: np.ndarray) -> Dict[str, Any]:
        """
        Get statistics about the current probability distribution.

        Args:
            features: Input features (29,)

        Returns:
            Dictionary with distribution statistics
        """
        chunk_probs, _ = self.predict(features)

        entropy = self.get_entropy(chunk_probs)
        max_entropy = self.get_max_entropy()

        top_indices = np.argsort(chunk_probs)[-5:][::-1]
        top_probs = chunk_probs[top_indices]

        return {
            'entropy': entropy,
            'max_entropy': max_entropy,
            'entropy_ratio': entropy / max_entropy,
            'top_chunk': int(top_indices[0]),
            'top_prob': float(top_probs[0]),
            'top_5_chunks': [int(i) for i in top_indices],
            'top_5_probs': [float(p) for p in top_probs],
            'effective_actions': float(np.exp(entropy)),
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get model statistics."""
        return {
            'framework': 'pytorch',
            'architecture_version': ARCHITECTURE_VERSION,
            'input_size': self.input_size,
            'hidden1_size': self.hidden1_size,
            'hidden2_size': self.hidden2_size,
            'chunk_output_size': self.chunk_output_size,
            'type_output_size': self.type_output_size,
            'total_parameters': self._count_parameters(),
            'model_path': self.model_path,
            'weights_loaded': os.path.exists(self.model_path),
            'entropy_coef': self.entropy_coef,
            'max_entropy': self.get_max_entropy(),
            'device': str(self.device)
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
        metadata_path = self.model_path.replace('.pt', '_metadata.json')
        if os.path.exists(metadata_path):
            try:
                os.remove(metadata_path)
                deleted_metadata = True
                logger.info(f"Deleted metadata file: {metadata_path}")
            except Exception as e:
                logger.warning(f"Failed to delete metadata file: {e}")

        # Reinitialize weights
        self.model._init_weights()
        logger.info(f"NNModel reset with fresh weights: {self._count_parameters()} parameters")

        return {
            'status': 'success',
            'deleted_weights_file': deleted_weights,
            'deleted_metadata_file': deleted_metadata,
            'model_path': self.model_path,
            'parameters': self._count_parameters(),
            'architecture_version': ARCHITECTURE_VERSION
        }
