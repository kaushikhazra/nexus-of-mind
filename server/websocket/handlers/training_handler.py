"""
Handler for training control messages.

Manages neural network training lifecycle including start/stop,
reset, and status queries.
"""

import asyncio
import logging
from typing import Dict, Any, Optional, TYPE_CHECKING

from websocket.schemas import ParsedMessage
from websocket.handlers.base import create_error_response
from ai_engine.exceptions import TrainingError, ModelNotInitializedError

if TYPE_CHECKING:
    from ai_engine.training.trainer import ContinuousTrainer as BackgroundTrainer

logger = logging.getLogger(__name__)


class TrainingHandler:
    """
    Handles training control messages.

    Manages the neural network training lifecycle:
    - Training status queries
    - Model reset operations
    - Background training statistics
    """

    def __init__(
        self,
        background_trainer: Optional["BackgroundTrainer"]
    ) -> None:
        """
        Initialize the training handler.

        Args:
            background_trainer: BackgroundTrainer instance (PyTorch-based)
        """
        self.background_trainer: Optional["BackgroundTrainer"] = background_trainer

    async def handle_training_status(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """
        Handle request for continuous training status.

        Args:
            message: Raw message dictionary
            client_id: Client identifier

        Returns:
            Training status response
        """
        try:
            if not self.background_trainer:
                return {
                    "type": "training_status",
                    "timestamp": asyncio.get_event_loop().time(),
                    "data": {
                        "status": "not_available",
                        "message": "Background trainer not initialized"
                    }
                }

            metrics = self.background_trainer.get_metrics()

            return {
                "type": "training_status",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "status": "active" if self.background_trainer.is_running else "stopped",
                    "modelVersion": self.background_trainer.model_version,
                    "trainingIterations": metrics.get("training_iterations", 0),
                    "averageLoss": metrics.get("average_loss"),
                    "bufferSize": metrics.get("buffer_size", 0),
                    "isRunning": self.background_trainer.is_running
                }
            }

        except Exception as e:
            logger.error(f"Error getting training status: {e}")
            return create_error_response(
                f"Failed to get training status: {str(e)}",
                error_code="PROCESSING_ERROR"
            )

    async def handle_reset_nn(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """
        Handle neural network reset request.

        Fully resets the NN to initial random state and clears training history.
        Requires confirmation flag for safety.

        Args:
            message: Raw message dictionary (should contain data.confirm)
            client_id: Client identifier

        Returns:
            Reset confirmation or status response
        """
        try:
            # Check for confirmation flag (safety)
            data = message.get("data", {})
            confirm = data.get("confirm", False)

            if not confirm:
                return {
                    "type": "reset_nn_response",
                    "timestamp": asyncio.get_event_loop().time(),
                    "data": {
                        "status": "confirmation_required",
                        "message": "Send with {confirm: true} to confirm reset"
                    }
                }

            # Reset is handled via HTTP endpoint /reset-nn
            # WebSocket reset not supported - use HTTP API instead
            logger.info(f"[ResetNN] Reset requested via WebSocket by client {client_id}")

            return {
                "type": "reset_nn_response",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "status": "use_http_api",
                    "message": "Use HTTP endpoint /reset-nn for neural network reset"
                }
            }

            # Note: The following code is bypassed - full reset available via HTTP only
            result = {"status": "skipped"}

            return {
                "type": "reset_nn_response",
                "timestamp": asyncio.get_event_loop().time(),
                "data": result
            }

        except ModelNotInitializedError as e:
            logger.error(f"Trainer not initialized: {e}")
            return create_error_response(str(e), error_code="TRAINER_NOT_AVAILABLE")

        except TrainingError as e:
            logger.error(f"Training error during reset: {e}")
            return create_error_response(str(e), error_code="TRAINING_ERROR")

        except Exception as e:
            logger.error(f"Error resetting neural network: {e}")
            return create_error_response(
                f"Failed to reset neural network: {str(e)}",
                error_code="RESET_ERROR"
            )

    async def handle_background_training_stats(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """
        Handle request for background training statistics.

        Returns metrics from the continuous training loop (gate as cost function).

        Args:
            message: Raw message dictionary
            client_id: Client identifier

        Returns:
            Background training statistics response
        """
        try:
            if not self.background_trainer:
                return {
                    "type": "background_training_stats_response",
                    "timestamp": asyncio.get_event_loop().time(),
                    "data": {
                        "status": "not_available",
                        "message": "Background training not initialized"
                    }
                }

            metrics = self.background_trainer.get_metrics()

            return {
                "type": "background_training_stats_response",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "status": "active" if self.background_trainer.is_running else "stopped",
                    "model_version": metrics["model_version"],
                    "is_running": metrics["is_running"],
                    "buffer": metrics["buffer"],
                    "training": metrics["training"]
                }
            }

        except Exception as e:
            logger.error(f"Error getting background training statistics: {e}")
            return create_error_response(
                f"Failed to get background training statistics: {str(e)}",
                error_code="PROCESSING_ERROR"
            )
