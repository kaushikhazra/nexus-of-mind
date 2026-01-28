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
    from ai_engine.continuous_trainer import AsyncContinuousTrainer
    from ai_engine.training.continuous_trainer import ContinuousTrainer as BackgroundTrainer

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
        continuous_trainer: Optional["AsyncContinuousTrainer"],
        background_trainer: Optional["BackgroundTrainer"]
    ) -> None:
        """
        Initialize the training handler.

        Args:
            continuous_trainer: AsyncContinuousTrainer instance
            background_trainer: BackgroundTrainer instance
        """
        self.continuous_trainer: Optional["AsyncContinuousTrainer"] = continuous_trainer
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
            if not self.continuous_trainer:
                return {
                    "type": "training_status",
                    "timestamp": asyncio.get_event_loop().time(),
                    "data": {
                        "status": "not_available",
                        "message": "Continuous learning not initialized"
                    }
                }

            stats = self.continuous_trainer.get_stats()

            return {
                "type": "training_status",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "status": "active",
                    "trainingCount": stats["training_count"],
                    "totalSamplesProcessed": stats["total_samples_processed"],
                    "strategyVersion": stats["strategy_version"],
                    "bufferSize": stats["buffer_size"],
                    "lastTrainingLoss": stats["last_training_loss"],
                    "modelParameters": stats["model_parameters"],
                    "config": stats["config"]
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

            if not self.continuous_trainer:
                raise ModelNotInitializedError("ContinuousTrainer")

            # Perform full reset
            logger.info(f"[ResetNN] Full neural network reset requested by client {client_id}")
            result = self.continuous_trainer.full_reset()
            logger.info(f"[ResetNN] Reset complete: {result}")

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
