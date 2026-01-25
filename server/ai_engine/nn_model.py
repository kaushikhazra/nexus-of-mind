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
from typing import Dict, Any, Optional, Tuple, List
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
# PyTorch needs stronger regularization than TensorFlow
# 0.2 provides robust collapse prevention
DEFAULT_ENTROPY_COEF = 0.5  # Increased from 0.2 to prevent mode collapse

# Label smoothing factor for training targets
# 0.0 = one-hot targets (causes mode collapse)
# 0.1 = 10% smoothing (iteration 1 - still collapsed)
# 0.15 = 15% smoothing (iteration 2 - still collapsed)
# 0.2 = 20% smoothing (iteration 3 - final attempt)
# Higher = more uniform targets, less learning signal
DEFAULT_LABEL_SMOOTHING = 0.2


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


class SequentialQueenNN(nn.Module):
    """
    Five-NN Sequential Architecture for Queen spawn decisions.

    Sequential flow:
    NN1 (Energy Suitability): 10 → 8 → 5 (Sigmoid)
    NN2 (Combat Suitability): 10 → 8 → 5 (Sigmoid)
    NN3 (Type Decision):      10 → 8 → 2 (Softmax)
    NN4 (Chunk Decision):     15 → 12 → 8 → 5 (Softmax) - picks best of 5 chunks
    NN5 (Quantity Decision):  7 → 8 → 5 (Softmax)

    Note: NO_SPAWN decision removed from NN4. Gate is sole authority on spawn/no-spawn.
    Total parameters: ~820
    """

    # Feature indices for extraction from 29-dim input
    # Each chunk has 5 features at indices: [i*5, i*5+1, i*5+2, i*5+3, i*5+4]
    # = [chunk_id, worker_density, protector_density, e_parasite_rate, c_parasite_rate]
    PROTECTOR_INDICES = [2, 7, 12, 17, 22]  # protector_density for chunks 0-4
    E_PARASITE_INDICES = [3, 8, 13, 18, 23]  # energy_parasite_rate for chunks 0-4
    C_PARASITE_INDICES = [4, 9, 14, 19, 24]  # combat_parasite_rate for chunks 0-4
    WORKER_INDICES = [1, 6, 11, 16, 21]  # worker_density for chunks 0-4
    QUEEN_ENERGY_CAP_INDEX = 25
    QUEEN_COMBAT_CAP_INDEX = 26
    PLAYER_ENERGY_RATE_INDEX = 27
    PLAYER_MINERAL_RATE_INDEX = 28

    def __init__(self):
        super().__init__()

        # NN1: Energy Suitability (10 → 8 → 5, Sigmoid)
        # Input: [protector_density, e_parasite_rate] x 5 chunks
        self.nn1_energy_suit = nn.Sequential(
            nn.Linear(10, 8),
            nn.ReLU(),
            nn.Linear(8, 5),
            nn.Sigmoid()
        )

        # NN2: Combat Suitability (10 → 8 → 5, Sigmoid)
        # Input: [protector_density, c_parasite_rate] x 5 chunks
        self.nn2_combat_suit = nn.Sequential(
            nn.Linear(10, 8),
            nn.ReLU(),
            nn.Linear(8, 5),
            nn.Sigmoid()
        )

        # NN3: Type Decision (10 → 8 → 2, Softmax)
        # Input: 5 energy_suit + 5 combat_suit
        self.nn3_type = nn.Sequential(
            nn.Linear(10, 8),
            nn.ReLU(),
            nn.Linear(8, 2)
            # Softmax applied in forward()
        )

        # NN4: Chunk Decision (15 → 12 → 8 → 5, Softmax)
        # Input: 5 worker_density + 5 suitability + 5 saturation
        # Output: 5 chunks (no NO_SPAWN - Gate decides spawn/no-spawn)
        self.nn4_chunk = nn.Sequential(
            nn.Linear(15, 12),
            nn.ReLU(),
            nn.Linear(12, 8),
            nn.ReLU(),
            nn.Linear(8, 5)
            # Softmax applied in forward()
        )

        # NN5: Quantity Decision (7 → 8 → 5, Softmax)
        # Input: saturation, suitability, queen_cap, player_energy, player_mineral, type, chunk
        self.nn5_quantity = nn.Sequential(
            nn.Linear(7, 8),
            nn.ReLU(),
            nn.Linear(8, 5)
            # Softmax applied in forward()
        )

        # Initialize weights
        self._init_weights()

    def _init_weights(self):
        """Initialize weights using He normal for ReLU, Xavier for output."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                # Check if this is an output layer (followed by Sigmoid/Softmax)
                # For simplicity, use Xavier for all - works well for both
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)

    def _extract_nn1_input(self, features: torch.Tensor) -> torch.Tensor:
        """Extract NN1 input: [protector, e_parasite_rate] x 5 chunks."""
        batch_size = features.shape[0] if features.dim() > 1 else 1
        if features.dim() == 1:
            features = features.unsqueeze(0)

        # Interleave protector and e_parasite for each chunk
        nn1_input = torch.zeros(batch_size, 10, device=features.device)
        for i in range(5):
            nn1_input[:, i*2] = features[:, self.PROTECTOR_INDICES[i]]
            nn1_input[:, i*2+1] = features[:, self.E_PARASITE_INDICES[i]]
        return nn1_input

    def _extract_nn2_input(self, features: torch.Tensor) -> torch.Tensor:
        """Extract NN2 input: [protector, c_parasite_rate] x 5 chunks."""
        batch_size = features.shape[0] if features.dim() > 1 else 1
        if features.dim() == 1:
            features = features.unsqueeze(0)

        # Interleave protector and c_parasite for each chunk
        nn2_input = torch.zeros(batch_size, 10, device=features.device)
        for i in range(5):
            nn2_input[:, i*2] = features[:, self.PROTECTOR_INDICES[i]]
            nn2_input[:, i*2+1] = features[:, self.C_PARASITE_INDICES[i]]
        return nn2_input

    def _extract_nn4_input(
        self,
        features: torch.Tensor,
        e_suit: torch.Tensor,
        c_suit: torch.Tensor,
        type_decision: torch.Tensor
    ) -> torch.Tensor:
        """
        Extract NN4 input: worker_density + suitability + saturation (all pre-selected by type).

        Args:
            features: Original 29-dim features
            e_suit: Energy suitability from NN1 (batch, 5)
            c_suit: Combat suitability from NN2 (batch, 5)
            type_decision: Type decision from NN3 (batch,) - 0=energy, 1=combat
        """
        batch_size = features.shape[0] if features.dim() > 1 else 1
        if features.dim() == 1:
            features = features.unsqueeze(0)

        nn4_input = torch.zeros(batch_size, 15, device=features.device)

        # Worker densities (indices 0-4)
        for i in range(5):
            nn4_input[:, i] = features[:, self.WORKER_INDICES[i]]

        # Suitability for chosen type (indices 5-9)
        # type_decision: 0=energy, 1=combat
        for b in range(batch_size):
            if type_decision[b] == 0:  # energy
                nn4_input[b, 5:10] = e_suit[b]
            else:  # combat
                nn4_input[b, 5:10] = c_suit[b]

        # Parasite saturation for chosen type (indices 10-14)
        for b in range(batch_size):
            for i in range(5):
                if type_decision[b] == 0:  # energy
                    nn4_input[b, 10+i] = features[b, self.E_PARASITE_INDICES[i]]
                else:  # combat
                    nn4_input[b, 10+i] = features[b, self.C_PARASITE_INDICES[i]]

        return nn4_input

    def _extract_nn5_input(
        self,
        features: torch.Tensor,
        e_suit: torch.Tensor,
        c_suit: torch.Tensor,
        type_decision: torch.Tensor,
        chunk_decision: torch.Tensor
    ) -> torch.Tensor:
        """
        Extract NN5 input: saturation, suitability, queen_cap, player_rates, type, chunk.

        Args:
            features: Original 29-dim features
            e_suit: Energy suitability from NN1 (batch, 5)
            c_suit: Combat suitability from NN2 (batch, 5)
            type_decision: Type decision from NN3 (batch,) - 0=energy, 1=combat
            chunk_decision: Chunk decision from NN4 (batch,) - 0-4
        """
        batch_size = features.shape[0] if features.dim() > 1 else 1
        if features.dim() == 1:
            features = features.unsqueeze(0)

        nn5_input = torch.zeros(batch_size, 7, device=features.device)

        for b in range(batch_size):
            chunk_idx = int(chunk_decision[b].item())
            # Clamp to valid range (0-4)
            chunk_idx = min(chunk_idx, 4)

            # Selected chunk parasite saturation (index 0)
            if type_decision[b] == 0:  # energy
                nn5_input[b, 0] = features[b, self.E_PARASITE_INDICES[chunk_idx]]
                nn5_input[b, 1] = e_suit[b, chunk_idx]
            else:  # combat
                nn5_input[b, 0] = features[b, self.C_PARASITE_INDICES[chunk_idx]]
                nn5_input[b, 1] = c_suit[b, chunk_idx]

            # Queen spawn capacity for chosen type (index 2)
            if type_decision[b] == 0:  # energy
                nn5_input[b, 2] = features[b, self.QUEEN_ENERGY_CAP_INDEX]
            else:  # combat
                nn5_input[b, 2] = features[b, self.QUEEN_COMBAT_CAP_INDEX]

            # Player rates (indices 3-4)
            nn5_input[b, 3] = features[b, self.PLAYER_ENERGY_RATE_INDEX]
            nn5_input[b, 4] = features[b, self.PLAYER_MINERAL_RATE_INDEX]

            # Type decision (index 5) - normalized 0 or 1
            nn5_input[b, 5] = float(type_decision[b])

            # Chunk selection (index 6) - normalized 0-1
            nn5_input[b, 6] = chunk_idx / 4.0  # 0-4 -> 0-1

        return nn5_input

    def forward(self, features: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Sequential forward pass through all 5 NNs.

        Args:
            features: Input tensor of shape (batch, 29) or (29,)

        Returns:
            Dictionary with all outputs:
            - e_suitability: (batch, 5) energy suitability scores
            - c_suitability: (batch, 5) combat suitability scores
            - type_probs: (batch, 2) type probabilities [P(energy), P(combat)]
            - type_decision: (batch,) argmax of type_probs
            - chunk_probs: (batch, 5) chunk probabilities [P(c0-c4)]
            - chunk_decision: (batch,) argmax of chunk_probs (0-4)
            - quantity_probs: (batch, 5) quantity probabilities [P(0-4)]
            - quantity_decision: (batch,) argmax of quantity_probs
        """
        single_input = features.dim() == 1
        if single_input:
            features = features.unsqueeze(0)

        # NN1: Energy Suitability
        nn1_input = self._extract_nn1_input(features)
        e_suit = self.nn1_energy_suit(nn1_input)

        # NN2: Combat Suitability
        nn2_input = self._extract_nn2_input(features)
        c_suit = self.nn2_combat_suit(nn2_input)

        # NN3: Type Decision
        nn3_input = torch.cat([e_suit, c_suit], dim=-1)
        type_logits = self.nn3_type(nn3_input)
        type_probs = F.softmax(type_logits, dim=-1)
        type_decision = torch.argmax(type_probs, dim=-1)

        # NN4: Chunk Decision (always picks one of 5 chunks)
        nn4_input = self._extract_nn4_input(features, e_suit, c_suit, type_decision)
        chunk_logits = self.nn4_chunk(nn4_input)
        chunk_probs = F.softmax(chunk_logits, dim=-1)
        chunk_decision = torch.argmax(chunk_probs, dim=-1)

        # NN5: Quantity Decision (always runs - no NO_SPAWN)
        nn5_input = self._extract_nn5_input(features, e_suit, c_suit, type_decision, chunk_decision)
        quantity_logits = self.nn5_quantity(nn5_input)
        quantity_probs = F.softmax(quantity_logits, dim=-1)
        quantity_decision = torch.argmax(quantity_probs, dim=-1)

        result = {
            'e_suitability': e_suit,
            'c_suitability': c_suit,
            'type_logits': type_logits,
            'type_probs': type_probs,
            'type_decision': type_decision,
            'chunk_logits': chunk_logits,
            'chunk_probs': chunk_probs,
            'chunk_decision': chunk_decision,
            'quantity_logits': quantity_logits,
            'quantity_probs': quantity_probs,
            'quantity_decision': quantity_decision
        }

        # Squeeze if single input
        if single_input:
            result = {k: v.squeeze(0) if v.dim() > 1 else v for k, v in result.items()}

        return result


class NNModel:
    """
    Five-NN Sequential Architecture for Queen spawn decisions.

    Uses SequentialQueenNN with 5 specialized sub-networks:
    - NN1: Energy suitability scoring
    - NN2: Combat suitability scoring
    - NN3: Type decision (energy vs combat)
    - NN4: Chunk decision (which of 5 chunks - always spawns)
    - NN5: Quantity decision (0-4 parasites)

    Note: NN always outputs a spawn decision. Gate is sole authority on spawn/no-spawn.
    Total parameters: ~820 (vs ~10,530 in old architecture)
    """

    # Architecture version 3: Five-NN Sequential
    ARCHITECTURE_VERSION = 3

    def __init__(self, model_path: Optional[str] = None):
        self.input_size = 29  # Still 29 features from FeatureExtractor

        # Use .pt extension for PyTorch
        self.model_path = model_path or "models/queen_sequential.pt"

        # Get device
        self.device = get_device()

        # Build sequential model
        self.model = SequentialQueenNN().to(self.device)

        # Entropy coefficient (for training regularization)
        self.entropy_coef = DEFAULT_ENTROPY_COEF

        # Optimizer for all 5 NNs
        self.optimizer = Adam(self.model.parameters(), lr=0.001)

        # Try to load existing weights
        weights_loaded = self._load_model_if_exists()

        if not weights_loaded and os.path.exists(self.model_path):
            logger.info("Initializing fresh sequential model")

        logger.info(f"NNModel (Sequential) initialized: {self._count_parameters()} parameters on {self.device}")

    def _count_parameters(self) -> int:
        """Count total trainable parameters."""
        return sum(p.numel() for p in self.model.parameters() if p.requires_grad)

    def _extract_top_chunk_ids(self, features: np.ndarray) -> List[int]:
        """
        Extract actual chunk IDs from the 29-dim features.

        The features encode chunk IDs at indices 0, 5, 10, 15, 20 as normalized values.
        Chunk ID = features[i*5] * 255 (since normalized by /255)

        IMPORTANT: Empty slots (padded with zeros) have worker_density = 0 at index i*5+1.
        These should return -1 to indicate "no valid chunk" and avoid false mapping to chunk 0.

        Args:
            features: 29-dim feature array

        Returns:
            List of 5 actual chunk IDs (-1 for empty/invalid slots)
        """
        chunk_ids = []
        for i in range(5):
            worker_density = features[i * 5 + 1]  # indices 1, 6, 11, 16, 21
            if worker_density <= 0:
                # Empty slot - no workers at this chunk position
                chunk_ids.append(-1)
            else:
                normalized_id = features[i * 5]  # indices 0, 5, 10, 15, 20
                chunk_id = int(round(normalized_id * 255))
                chunk_ids.append(chunk_id)
        return chunk_ids

    def _create_smoothed_target(self, target_idx: int, num_classes: int, alpha: float = DEFAULT_LABEL_SMOOTHING) -> np.ndarray:
        """
        Create label-smoothed target for classification.

        Instead of one-hot [0,0,...,1,...,0], creates a soft distribution
        that prevents mode collapse by keeping non-target classes non-zero.

        Args:
            target_idx: Index of target class
            num_classes: Total number of classes
            alpha: Smoothing factor (0.0 = one-hot, 1.0 = uniform)

        Returns:
            Smoothed probability distribution
        """
        # Start with uniform distribution scaled by alpha
        smoothed = np.full(num_classes, alpha / num_classes, dtype=np.float32)

        # Add remaining probability mass to target
        smoothed[target_idx] += (1.0 - alpha)

        return smoothed

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
                    saved_framework = metadata.get('framework', 'tensorflow')

                    if saved_framework != 'pytorch':
                        logger.warning(f"Framework mismatch: saved={saved_framework}, current=pytorch")
                        self._backup_incompatible_model()
                        return False

                    if saved_version != self.ARCHITECTURE_VERSION:
                        logger.warning(f"Architecture version mismatch: saved={saved_version}, current={self.ARCHITECTURE_VERSION}")
                        logger.info("Starting fresh with new Five-NN Sequential architecture")
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

        # Check for old model files
        old_path = "models/queen_nn.pt"
        if os.path.exists(old_path):
            logger.warning(f"Found old single-NN model at {old_path} - starting fresh with Sequential architecture")

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
                'architecture': 'five_nn_sequential',
                'architecture_version': self.ARCHITECTURE_VERSION,
                'input_size': self.input_size,
                'total_parameters': self._count_parameters(),
                'device': str(self.device),
                'nn_config': {
                    'nn1_energy_suit': '10->8->5 Sigmoid',
                    'nn2_combat_suit': '10->8->5 Sigmoid',
                    'nn3_type': '10->8->2 Softmax',
                    'nn4_chunk': '15->12->8->5 Softmax',  # No NO_SPAWN
                    'nn5_quantity': '7->8->5 Softmax'
                },
                'no_spawn_option': False  # Gate is sole spawn/no-spawn authority
            }

            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)

            logger.info(f"Saved model weights to {save_path}")
            logger.info(f"Saved model metadata to {metadata_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
            return False

    def predict(self, features: np.ndarray) -> Dict[str, Any]:
        """
        Run inference through the 5-NN sequential pipeline.

        Args:
            features: numpy array of shape (29,) or (batch, 29)

        Returns:
            Dictionary with all pipeline outputs:
            - e_suitability: (5,) energy suitability scores
            - c_suitability: (5,) combat suitability scores
            - type_probs: (2,) [P(energy), P(combat)]
            - type_decision: int (0=energy, 1=combat)
            - chunk_probs: (5,) [P(chunk0-4)]
            - chunk_decision: int (0-4, always a valid chunk)
            - quantity_probs: (5,) [P(0), P(1), P(2), P(3), P(4)]
            - quantity_decision: int (0-4)
        """
        # Ensure correct shape
        single_input = features.ndim == 1
        if single_input:
            features = features.reshape(1, -1)

        # Convert to tensor
        x = torch.from_numpy(features.astype(np.float32)).to(self.device)

        # Run inference through sequential pipeline
        self.model.eval()
        with torch.no_grad():
            outputs = self.model(x)

        # Convert tensors to numpy
        result = {}
        for key, value in outputs.items():
            if isinstance(value, torch.Tensor):
                np_value = value.cpu().numpy()
                if single_input and np_value.ndim > 0:
                    result[key] = np_value.squeeze(0) if np_value.shape[0] == 1 else np_value
                else:
                    result[key] = np_value
            else:
                result[key] = value

        # Convert scalar decisions to int
        if 'type_decision' in result:
            result['type_decision'] = int(result['type_decision'])
        if 'chunk_decision' in result:
            result['chunk_decision'] = int(result['chunk_decision'])
        if 'quantity_decision' in result:
            result['quantity_decision'] = int(result['quantity_decision'])

        return result

    def get_spawn_decision(self, features: np.ndarray, explore: bool = True) -> Dict[str, Any]:
        """
        Get spawn decision from features using 5-NN sequential pipeline.

        NN always outputs a spawn decision. Gate is sole authority on spawn/no-spawn.

        Args:
            features: numpy array of 29 normalized features
            explore: if True, sample from distribution; if False, use argmax

        Returns:
            Dictionary with:
            - spawnChunk: int (actual chunk ID 0-255)
            - spawnType: str ('energy' or 'combat')
            - quantity: int (0-4, number of parasites to spawn)
            - confidence: float (chunk probability)
            - typeConfidence: float (type probability)
            - nnDecision: str (always 'spawn' - Gate decides spawn/no-spawn)
            - pipeline: dict with all intermediate outputs for debugging
        """
        # Run sequential inference
        outputs = self.predict(features)

        # Extract top chunk IDs from features for mapping
        top_chunk_ids = self._extract_top_chunk_ids(features)

        # Get chunk decision (always 0-4, no NO_SPAWN option)
        chunk_probs = outputs['chunk_probs']
        if explore:
            # Sample from probability distribution (enables exploration)
            chunk_idx = int(np.random.choice(len(chunk_probs), p=chunk_probs))
        else:
            # Greedy: always pick highest probability
            chunk_idx = int(np.argmax(chunk_probs))

        chunk_confidence = float(chunk_probs[chunk_idx])

        # Get type decision
        type_probs = outputs['type_probs']
        if explore:
            type_idx = int(np.random.choice(len(type_probs), p=type_probs))
        else:
            type_idx = int(np.argmax(type_probs))
        type_confidence = float(type_probs[type_idx])

        # Get quantity decision
        quantity_probs = outputs['quantity_probs']
        if explore:
            quantity = int(np.random.choice(len(quantity_probs), p=quantity_probs))
        else:
            quantity = int(np.argmax(quantity_probs))

        # Map relative chunk index to actual chunk ID
        actual_chunk_id = top_chunk_ids[chunk_idx]

        # If empty slot (no workers), try to find next best valid chunk
        if actual_chunk_id == -1:
            # Find highest-probability valid chunk
            sorted_indices = np.argsort(chunk_probs)[::-1]
            for idx in sorted_indices:
                if top_chunk_ids[idx] != -1:
                    actual_chunk_id = top_chunk_ids[idx]
                    chunk_confidence = float(chunk_probs[idx])
                    chunk_idx = idx  # Update for training
                    break

            # If all slots are empty, pick random chunk (Gate will evaluate)
            if actual_chunk_id == -1:
                # Random chunk from grid - avoid always defaulting to 0
                actual_chunk_id = np.random.randint(0, 256)
                logger.debug(f"All slots empty, random chunk: {actual_chunk_id}")

        spawn_type = 'combat' if type_idx == 1 else 'energy'

        return {
            'spawnChunk': actual_chunk_id,
            'spawnType': spawn_type,
            'quantity': quantity,
            'confidence': chunk_confidence,
            'typeConfidence': type_confidence,
            'nnDecision': 'spawn',  # NN always suggests spawn, Gate decides
            'pipeline': outputs
        }

    def _compute_loss(
        self,
        outputs: Dict[str, torch.Tensor],
        targets: Dict[str, torch.Tensor],
        reward: float = 1.0
    ) -> Tuple[torch.Tensor, Dict[str, float]]:
        """
        Compute combined loss for all 5 NNs.

        Loss breakdown:
        - NN1/NN2: MSE loss on suitability (regression towards actual survival)
        - NN3: Cross-entropy on type decision
        - NN4: Cross-entropy on chunk decision (with entropy regularization)
        - NN5: Cross-entropy on quantity decision

        Args:
            outputs: Dictionary with model outputs (from forward pass)
            targets: Dictionary with targets:
                - 'type_target': int (0=energy, 1=combat)
                - 'chunk_target': int (0-4, always a valid chunk)
                - 'quantity_target': int (0-4)
                - 'e_suit_target': optional (5,) for supervised suitability
                - 'c_suit_target': optional (5,) for supervised suitability
            reward: Reward signal for weighting (-1 to +1)

        Returns:
            Tuple of (total_loss, loss_dict)
        """
        loss_dict = {}

        # NN3: Cross-entropy on type decision with entropy regularization
        type_target = targets['type_target']
        if not isinstance(type_target, torch.Tensor):
            type_target = torch.tensor([type_target], device=self.device, dtype=torch.long)
        type_ce_loss = F.cross_entropy(outputs['type_logits'], type_target)

        # Entropy regularization for type (prevents mode collapse to single type)
        type_probs = outputs['type_probs']
        if type_probs.dim() == 1:
            type_probs = type_probs.unsqueeze(0)
        type_entropy = -torch.sum(type_probs * torch.log(type_probs + 1e-8), dim=-1).mean()
        type_loss = type_ce_loss - self.entropy_coef * type_entropy

        loss_dict['type_loss'] = float(type_loss.item())
        loss_dict['type_entropy'] = float(type_entropy.item())

        # NN4: Cross-entropy on chunk decision with entropy regularization
        chunk_target = targets['chunk_target']
        if not isinstance(chunk_target, torch.Tensor):
            chunk_target = torch.tensor([chunk_target], device=self.device, dtype=torch.long)
        # Clamp to valid range (0-4)
        chunk_target = torch.clamp(chunk_target, 0, 4)
        chunk_ce_loss = F.cross_entropy(outputs['chunk_logits'], chunk_target)

        # Entropy regularization for chunk (prevents mode collapse)
        chunk_probs = outputs['chunk_probs']
        if chunk_probs.dim() == 1:
            chunk_probs = chunk_probs.unsqueeze(0)
        chunk_entropy = -torch.sum(chunk_probs * torch.log(chunk_probs + 1e-8), dim=-1).mean()
        chunk_loss = chunk_ce_loss - self.entropy_coef * chunk_entropy

        loss_dict['chunk_loss'] = float(chunk_loss.item())
        loss_dict['chunk_entropy'] = float(chunk_entropy.item())

        # NN5: Cross-entropy on quantity decision (always runs - no NO_SPAWN)
        quantity_target = targets['quantity_target']
        if not isinstance(quantity_target, torch.Tensor):
            quantity_target = torch.tensor([quantity_target], device=self.device, dtype=torch.long)

        quantity_logits = outputs.get('quantity_logits')
        if quantity_logits is None:
            # Quantity probs exist, convert back to pseudo-logits
            quantity_probs = outputs['quantity_probs']
            if quantity_probs.dim() == 1:
                quantity_probs = quantity_probs.unsqueeze(0)
            quantity_logits = torch.log(quantity_probs + 1e-8)
        quantity_loss = F.cross_entropy(quantity_logits, quantity_target)

        loss_dict['quantity_loss'] = float(quantity_loss.item())

        # Combined loss (all NNs trained together - chain responsibility)
        # Weight by absolute reward - stronger signal for clearer outcomes
        reward_weight = abs(reward)
        total_loss = (type_loss + chunk_loss + quantity_loss) * reward_weight

        loss_dict['loss'] = float(total_loss.item())
        loss_dict['reward'] = reward
        loss_dict['reward_weight'] = reward_weight

        return total_loss, loss_dict

    def train_step(
        self,
        features: np.ndarray,
        targets: Dict[str, int],
        reward: float = 1.0
    ) -> Dict[str, float]:
        """
        Perform a single training step for the 5-NN sequential architecture.

        Args:
            features: Input features (29,) or (batch, 29)
            targets: Dictionary with:
                - 'type_target': int (0=energy, 1=combat)
                - 'chunk_target': int (0-5, where 5=NO_SPAWN)
                - 'quantity_target': int (0-4)
            reward: Reward signal for weighting (-1 to +1)

        Returns:
            Dictionary with loss values
        """
        # Ensure correct shape
        if features.ndim == 1:
            features = features.reshape(1, -1)

        # Convert to tensor
        x = torch.from_numpy(features.astype(np.float32)).to(self.device)

        # Forward pass through sequential pipeline
        self.model.train()
        outputs = self.model(x)

        # Compute combined loss for all 5 NNs
        loss, loss_dict = self._compute_loss(outputs, targets, reward)

        # Backward pass (updates all 5 NNs together)
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
        quantity: int = 1,
        learning_rate: float = 0.01
    ) -> Dict[str, float]:
        """
        Train using reward signal (reinforcement learning style).

        In the 5-NN architecture:
        - chunk_id is the actual chunk ID (0-255)
        - We map it back to relative index (0-4) using top_chunk_ids
        - All 5 NNs are trained together (chain responsibility)
        - NO_SPAWN is not an option - Gate handles spawn/no-spawn decision

        Args:
            features: Input features (29,)
            chunk_id: Actual chunk ID that was selected (0-255)
            spawn_type: Type that was selected ('energy' or 'combat')
            reward: Reward signal (-1 to +1)
            quantity: Number of parasites spawned (0-4)
            learning_rate: Learning rate for this update

        Returns:
            Dictionary with training info
        """
        # Extract top chunk IDs to map actual chunk ID back to relative index
        top_chunk_ids = self._extract_top_chunk_ids(features)

        # Map actual chunk ID to relative index (0-4)
        try:
            chunk_target = top_chunk_ids.index(chunk_id)
        except ValueError:
            # Chunk not in top 5 - pick random valid index to avoid biasing towards 0
            valid_indices = [i for i, cid in enumerate(top_chunk_ids) if cid != -1]
            if valid_indices:
                chunk_target = np.random.choice(valid_indices)
            else:
                chunk_target = np.random.randint(0, 5)  # Random if all empty
            logger.debug(f"Chunk {chunk_id} not in top_chunk_ids {top_chunk_ids}, using random index {chunk_target}")

        # Map spawn type to index
        if spawn_type is None or spawn_type == '':
            type_target = 0  # Default to energy
        else:
            type_target = 1 if spawn_type == 'combat' else 0

        # Quantity target
        quantity_target = max(0, min(4, quantity))  # Clamp to valid range

        # Create targets dict
        targets = {
            'type_target': type_target,
            'chunk_target': chunk_target,
            'quantity_target': quantity_target
        }

        # Set learning rate
        old_lr = self.optimizer.param_groups[0]['lr']
        self.optimizer.param_groups[0]['lr'] = learning_rate

        # Train all 5 NNs together
        result = self.train_step(features, targets, reward)

        # Restore learning rate
        self.optimizer.param_groups[0]['lr'] = old_lr

        # Add context to result
        result['chunk_id'] = chunk_id
        result['chunk_target'] = chunk_target
        result['type_target'] = type_target
        result['quantity_target'] = quantity_target

        return result

    def train_with_supervision(
        self,
        features: np.ndarray,
        target_chunk: int,
        target_type: Optional[str] = None,
        target_quantity: int = 1,
        learning_rate: float = 0.01
    ) -> Dict[str, float]:
        """
        Train using supervised learning (direct target).

        In the 5-NN architecture:
        - target_chunk is the actual chunk ID (0-255)
        - We map it back to relative index (0-4) using top_chunk_ids
        - NO_SPAWN is not an option - Gate handles spawn/no-spawn decision

        Args:
            features: Input features (29,)
            target_chunk: Target chunk ID (0-255)
            target_type: Target type ('energy' or 'combat')
            target_quantity: Target quantity (0-4)
            learning_rate: Learning rate for this update

        Returns:
            Dictionary with training info
        """
        # Extract top chunk IDs to map actual chunk ID back to relative index
        top_chunk_ids = self._extract_top_chunk_ids(features)

        # Map actual chunk ID to relative index (0-4)
        try:
            chunk_target = top_chunk_ids.index(target_chunk)
        except ValueError:
            # Chunk not in top 5 - pick random valid index to avoid biasing towards 0
            valid_indices = [i for i, cid in enumerate(top_chunk_ids) if cid != -1]
            if valid_indices:
                chunk_target = np.random.choice(valid_indices)
            else:
                chunk_target = np.random.randint(0, 5)  # Random if all empty
            logger.debug(f"Target chunk {target_chunk} not in top_chunk_ids {top_chunk_ids}, using random index {chunk_target}")

        # Map spawn type to index
        if target_type is None or target_type == '':
            type_target = 0  # Default to energy
        else:
            type_target = 1 if target_type == 'combat' else 0

        # Quantity target
        quantity_target = max(0, min(4, target_quantity))

        # Create targets dict
        targets = {
            'type_target': type_target,
            'chunk_target': chunk_target,
            'quantity_target': quantity_target
        }

        # Set learning rate
        old_lr = self.optimizer.param_groups[0]['lr']
        self.optimizer.param_groups[0]['lr'] = learning_rate

        # Train with full reward weight (supervised = high confidence)
        result = self.train_step(features, targets, reward=1.0)

        # Restore learning rate
        self.optimizer.param_groups[0]['lr'] = old_lr

        result['mode'] = 'supervised'
        result['target_chunk'] = target_chunk
        result['chunk_target_idx'] = chunk_target

        logger.debug(f"[Supervised] Trained toward chunk {target_chunk} (idx {chunk_target}), loss={result.get('loss', 0):.4f}")

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
            "SequentialQueenNN - Five-NN Architecture:",
            "  NN1 (Energy Suitability): 10 → 8 → 5 (Sigmoid)",
            "  NN2 (Combat Suitability): 10 → 8 → 5 (Sigmoid)",
            "  NN3 (Type Decision):      10 → 8 → 2 (Softmax)",
            "  NN4 (Chunk Decision):     15 → 12 → 8 → 5 (Softmax)",
            "  NN5 (Quantity Decision):  7 → 8 → 5 (Softmax)",
            "",
            "Sequential Flow: NN1/NN2 → NN3 → NN4 → NN5",
            "Note: NN always outputs spawn. Gate is sole spawn/no-spawn authority.",
            f"Total parameters: {self._count_parameters():,}",
            f"Device: {self.device}"
        ]
        return '\n'.join(lines)

    def get_entropy(self, probs: np.ndarray) -> float:
        """
        Calculate entropy of a probability distribution.

        Args:
            probs: Probability distribution (e.g., chunk_probs with 6 classes)

        Returns:
            Entropy value (higher = more exploration)
        """
        probs_clean = probs[probs > 1e-10]
        return float(-np.sum(probs_clean * np.log(probs_clean)))

    def get_max_entropy(self, num_classes: int = 5) -> float:
        """
        Get maximum possible entropy (uniform distribution).

        Args:
            num_classes: Number of classes (default 5 for chunk decision)

        Returns:
            Maximum entropy for uniform distribution
        """
        return float(np.log(num_classes))

    def get_distribution_stats(self, features: np.ndarray) -> Dict[str, Any]:
        """
        Get statistics about the current probability distributions.

        Args:
            features: Input features (29,)

        Returns:
            Dictionary with distribution statistics for all 5 NNs
        """
        outputs = self.predict(features)

        # Chunk distribution stats (5 classes: chunks 0-4, no NO_SPAWN)
        chunk_probs = outputs['chunk_probs']
        chunk_entropy = self.get_entropy(chunk_probs)
        chunk_max_entropy = self.get_max_entropy(5)

        # Type distribution stats (2 classes)
        type_probs = outputs['type_probs']
        type_entropy = self.get_entropy(type_probs)
        type_max_entropy = self.get_max_entropy(2)

        # Quantity distribution stats (5 classes)
        quantity_probs = outputs['quantity_probs']
        quantity_entropy = self.get_entropy(quantity_probs)
        quantity_max_entropy = self.get_max_entropy(5)

        return {
            # Chunk stats
            'chunk_entropy': chunk_entropy,
            'chunk_max_entropy': chunk_max_entropy,
            'chunk_entropy_ratio': chunk_entropy / chunk_max_entropy if chunk_max_entropy > 0 else 0,
            'chunk_decision': int(outputs['chunk_decision']),
            'chunk_probs': [float(p) for p in chunk_probs],
            'chunk_effective_actions': float(np.exp(chunk_entropy)),

            # Type stats
            'type_entropy': type_entropy,
            'type_max_entropy': type_max_entropy,
            'type_entropy_ratio': type_entropy / type_max_entropy if type_max_entropy > 0 else 0,
            'type_decision': int(outputs['type_decision']),
            'type_probs': [float(p) for p in type_probs],

            # Quantity stats
            'quantity_entropy': quantity_entropy,
            'quantity_max_entropy': quantity_max_entropy,
            'quantity_entropy_ratio': quantity_entropy / quantity_max_entropy if quantity_max_entropy > 0 else 0,
            'quantity_decision': int(outputs['quantity_decision']),
            'quantity_probs': [float(p) for p in quantity_probs],

            # Suitability scores
            'e_suitability': [float(s) for s in outputs['e_suitability']],
            'c_suitability': [float(s) for s in outputs['c_suitability']],

            # Legacy compatibility (use chunk entropy as primary)
            'entropy': chunk_entropy,
            'max_entropy': chunk_max_entropy,
            'entropy_ratio': chunk_entropy / chunk_max_entropy if chunk_max_entropy > 0 else 0,
            'effective_actions': float(np.exp(chunk_entropy)),
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get model statistics."""
        return {
            'framework': 'pytorch',
            'architecture': 'five_nn_sequential',
            'architecture_version': self.ARCHITECTURE_VERSION,
            'input_size': self.input_size,
            'nn_config': {
                'nn1_energy_suit': '10->8->5 Sigmoid',
                'nn2_combat_suit': '10->8->5 Sigmoid',
                'nn3_type': '10->8->2 Softmax',
                'nn4_chunk': '15->12->8->5 Softmax',  # No NO_SPAWN
                'nn5_quantity': '7->8->5 Softmax'
            },
            'total_parameters': self._count_parameters(),
            'model_path': self.model_path,
            'weights_loaded': os.path.exists(self.model_path),
            'entropy_coef': self.entropy_coef,
            'chunk_max_entropy': self.get_max_entropy(5),  # 5 chunks, no NO_SPAWN
            'type_max_entropy': self.get_max_entropy(2),
            'quantity_max_entropy': self.get_max_entropy(5),
            'device': str(self.device),
            'no_spawn_option': False  # Gate is sole spawn/no-spawn authority
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
            'architecture_version': self.ARCHITECTURE_VERSION
        }
