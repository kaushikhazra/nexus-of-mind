"""
Continuous Trainer for background model training.

Uses gate_signal directly as training feedback.
NO re-evaluation during training - gate_signal at inference is ground truth.
"""

import os
import threading
import time
import logging
from typing import Optional, TYPE_CHECKING, List
import numpy as np

from .buffer import ExperienceReplayBuffer
from .config import ContinuousTrainingConfig
from .experience import Experience
from .metrics import TrainingMetrics
from ..simulation.dashboard_metrics import get_dashboard_metrics

if TYPE_CHECKING:
    from ..nn_model import NNModel

logger = logging.getLogger(__name__)


class ContinuousTrainer:
    """
    Background training thread for continuous model improvement.

    Runs in a daemon thread, training the model every interval
    on batches sampled from the replay buffer.

    Uses gate_signal directly as training feedback.
    NO re-evaluation during training - gate_signal at inference is ground truth.
    """

    def __init__(
        self,
        model: "NNModel",
        buffer: ExperienceReplayBuffer,
        config: ContinuousTrainingConfig
    ):
        self.model = model
        self.buffer = buffer
        self.config = config

        # Threading
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._model_lock = threading.Lock()

        # Versioning
        self._model_version = self._load_model_version()  # Restore from metadata
        self._last_save_version = self._model_version
        self._save_interval = 50  # Save every 50 versions

        # Metrics
        self._metrics = TrainingMetrics()

        logger.info(f"[Training] Restored model version: {self._model_version}")

    def start(self) -> None:
        """Start background training thread."""
        if self._running:
            logger.warning("[Training] Trainer already running")
            return

        self._running = True
        self._thread = threading.Thread(
            target=self._training_loop,
            name="ContinuousTrainer",
            daemon=True  # Dies with main process
        )
        self._thread.start()
        logger.info(
            f"[Training] Started background trainer "
            f"(interval={self.config.training_interval}s, "
            f"batch_size={self.config.batch_size})"
        )

    def stop(self, timeout: float = 5.0) -> None:
        """Stop background training thread and save model."""
        if not self._running:
            return

        self._running = False
        if self._thread:
            self._thread.join(timeout=timeout)
            if self._thread.is_alive():
                logger.warning("[Training] Thread did not stop gracefully")

        # Save model on shutdown
        self._save_model()
        logger.info("[Training] Stopped background trainer")

    def _training_loop(self) -> None:
        """Main training loop - runs until stopped."""
        logger.info("[Training] Training loop started")

        while self._running:
            loop_start = time.time()

            try:
                self._training_step()
            except Exception as e:
                logger.error(f"[Training] Error in training step: {e}", exc_info=True)
                self._metrics.record_error()
                # Continue running - don't crash on single error

            # Sleep for remaining interval
            elapsed = time.time() - loop_start
            sleep_time = max(0, self.config.training_interval - elapsed)

            if sleep_time == 0 and elapsed > self.config.training_interval * 1.5:
                logger.warning(
                    f"[Training] Step took {elapsed:.2f}s, "
                    f"exceeds interval {self.config.training_interval}s"
                )

            time.sleep(sleep_time)

        logger.info("[Training] Training loop stopped")

    def _training_step(self) -> None:
        """Execute single training step."""
        step_start = time.time()

        # Sample batch from buffer
        batch = self.buffer.sample(self.config.batch_size)

        if len(batch) < self.config.min_batch_size:
            return

        # Train on each experience in batch
        total_loss = 0.0
        total_training_reward = 0.0

        with self._model_lock:
            for exp in batch:
                training_reward = self._calculate_training_reward(exp)
                total_training_reward += training_reward

                # Use the model's train_with_reward method
                result = self.model.train_with_reward(
                    features=exp.observation,
                    chunk_id=exp.spawn_chunk,
                    spawn_type=exp.spawn_type,
                    reward=training_reward,
                    learning_rate=self.config.learning_rate
                )

                total_loss += result.get("loss", 0.0)

            self._model_version += 1

            # Periodic save
            if self._model_version - self._last_save_version >= self._save_interval:
                self._save_model()

        avg_loss = total_loss / len(batch)
        avg_training_reward = total_training_reward / len(batch)

        # Update metrics
        step_time = (time.time() - step_start) * 1000  # ms
        self._metrics.record_step(
            loss=avg_loss,
            batch_size=len(batch),
            step_time_ms=step_time,
            avg_gate_signal=avg_training_reward  # Now shows normalized reward
        )

        logger.info(
            f"[Training] v{self._model_version}: loss={avg_loss:.4f}, "
            f"batch={len(batch)}, avg_reward={avg_training_reward:.3f}, "
            f"time={step_time:.1f}ms"
        )

        # Record to dashboard for UI visualization
        try:
            dashboard = get_dashboard_metrics()
            dashboard.record_training_step(
                loss=avg_loss,
                reward=avg_training_reward,  # Normalized training reward
                is_simulation=True,
                model_version=self._model_version,
                buffer_size=len(self.buffer)
            )
        except Exception as e:
            logger.info(f"Failed to record to dashboard: {e}")

    def _calculate_training_reward(self, experience: Experience) -> float:
        """
        Calculate training reward from experience.

        Uses normalized R_expected for full [-1, +1] signal range:
        - R_expected in [0, 1] maps to training_reward in [-1, +1]
        - SEND with actual_reward: blend normalized expected with actual
        """
        # Normalize R_expected from [0,1] to [-1,+1]
        # This gives full signal range regardless of threshold setting
        normalized_expected = 2 * experience.R_expected - 1

        if experience.was_executed and experience.actual_reward is not None:
            # SEND with actual outcome - blend expected with actual
            return (
                self.config.gate_weight * normalized_expected +
                self.config.actual_weight * experience.actual_reward
            )
        else:
            # WAIT or SEND pending actual - use normalized expected
            return normalized_expected

    def train_batch(
        self,
        observations: np.ndarray,
        actions: np.ndarray,
        rewards: np.ndarray
    ) -> float:
        """
        Train model on a batch of experiences.

        This is an alternative interface for batch training.

        Args:
            observations: (batch_size, 29) feature arrays
            actions: (batch_size, 2) [chunk_id, type_id]
            rewards: (batch_size,) reward values

        Returns:
            Average loss
        """
        total_loss = 0.0
        batch_size = len(observations)

        with self._model_lock:
            for i in range(batch_size):
                spawn_type = "energy" if actions[i, 1] == 0 else "combat"
                result = self.model.train_with_reward(
                    features=observations[i],
                    chunk_id=int(actions[i, 0]),
                    spawn_type=spawn_type,
                    reward=float(rewards[i]),
                    learning_rate=self.config.learning_rate
                )
                total_loss += result.get("loss", 0.0)

            self._model_version += 1

        return total_loss / batch_size if batch_size > 0 else 0.0

    def get_model_for_inference(self) -> "NNModel":
        """
        Get model for inference.

        Thread-safe - can be called while training is running.
        """
        return self.model  # No lock needed for read-only inference

    @property
    def model_version(self) -> int:
        """Current model version."""
        return self._model_version

    @property
    def is_running(self) -> bool:
        """Check if trainer is running."""
        return self._running

    def get_metrics(self) -> dict:
        """Get training metrics."""
        buffer_stats = self.buffer.get_stats()
        training_stats = self._metrics.get_stats()
        return {
            "buffer": buffer_stats,
            "training": training_stats,
            "model_version": self._model_version,
            "is_running": self._running,
        }

    def _save_model(self) -> None:
        """Save model weights and version to disk."""
        try:
            if self.model.save_model():
                self._last_save_version = self._model_version
                self._save_model_version()
                logger.info(f"[Training] Model saved at version {self._model_version}")
        except Exception as e:
            logger.error(f"[Training] Failed to save model: {e}")

    def _save_model_version(self) -> None:
        """Save model version to metadata file."""
        try:
            metadata_path = self.model.model_path.replace('.weights.h5', '_metadata.json')

            # Load existing metadata
            metadata = {}
            if os.path.exists(metadata_path):
                import json
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)

            # Update with version
            metadata['model_version'] = self._model_version
            metadata['total_training_steps'] = self._model_version

            # Save back
            import json
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)

        except Exception as e:
            logger.warning(f"[Training] Failed to save model version: {e}")

    def _load_model_version(self) -> int:
        """Load model version from metadata file."""
        try:
            metadata_path = self.model.model_path.replace('.weights.h5', '_metadata.json')

            if os.path.exists(metadata_path):
                import json
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                return metadata.get('model_version', 0)
        except Exception as e:
            logger.warning(f"[Training] Failed to load model version: {e}")

        return 0
