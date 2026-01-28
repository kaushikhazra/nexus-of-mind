"""
WebSocket Message Handler - Main Entry Point.

Coordinates message parsing, routing, and response generation.
This is a slim facade that delegates to specialized handlers.
"""

import asyncio
import json
import logging
import os
import uuid
from typing import Dict, Any, Optional, List
from pathlib import Path

from websocket.schemas import (
    MessageType, ParsedMessage, MESSAGE_SCHEMAS,
    validate_message, get_message_type
)
from websocket.message_router import MessageRouter
from websocket.handlers.observation_handler import ObservationHandler
from websocket.handlers.training_handler import TrainingHandler
from websocket.handlers.gate_handler import GateHandler
from websocket.handlers.game_state_handler import GameStateHandler
from websocket.handlers.system_handler import SystemHandler

from ai_engine.continuous_trainer import AsyncContinuousTrainer
from ai_engine.feature_extractor import FeatureExtractor
from ai_engine.nn_model import NNModel
from ai_engine.reward_calculator import RewardCalculator
from ai_engine.config import get_config
from ai_engine.decision_gate import SimulationGate, SimulationGateConfig, PreprocessGate
from ai_engine.decision_gate.dashboard_metrics import get_dashboard_metrics
from ai_engine.training import (
    ExperienceReplayBuffer,
    ContinuousTrainingConfig,
    ContinuousTrainer as BackgroundTrainer,
)

logger = logging.getLogger(__name__)


class MessageHandler:
    """
    Main WebSocket message handler.

    Coordinates all message processing for the AI backend.
    Delegates to specialized handlers for each message type category.
    """

    def __init__(self, ai_engine):
        """
        Initialize the message handler.

        Args:
            ai_engine: AIEngine instance
        """
        self.ai_engine = ai_engine
        self.router = MessageRouter()

        # Message processing statistics
        self.message_stats = {
            "total_processed": 0,
            "successful": 0,
            "failed": 0,
            "validation_errors": 0,
            "processing_errors": 0
        }

        # Initialize components
        self._init_components()

        # Register all handlers
        self._register_handlers()

        # Load spawn gating config
        self.nn_config = get_config()

    def _init_components(self) -> None:
        """Initialize NN components and trainers."""
        # Initialize continuous trainer
        self.continuous_trainer = None
        try:
            self.continuous_trainer = AsyncContinuousTrainer()
            logger.info("AsyncContinuousTrainer initialized for real-time learning")
        except Exception as e:
            logger.warning(f"Failed to initialize AsyncContinuousTrainer: {e}")

        # Initialize feature extractor
        self.feature_extractor = None
        try:
            self.feature_extractor = FeatureExtractor()
            logger.info("FeatureExtractor initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize FeatureExtractor: {e}")

        # Initialize NN model
        self.nn_model = None
        try:
            self.nn_model = NNModel()
            logger.info(f"NNModel initialized with {self.nn_model._count_parameters()} parameters")
        except Exception as e:
            logger.warning(f"Failed to initialize NNModel: {e}")

        # Initialize reward calculator
        self.reward_calculator = None
        try:
            self.reward_calculator = RewardCalculator()
            logger.info("RewardCalculator initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize RewardCalculator: {e}")

        # Initialize simulation gate
        self.simulation_gate = None
        try:
            self.simulation_gate = SimulationGate(SimulationGateConfig())
            logger.info("SimulationGate initialized for simulation-gated inference")
        except Exception as e:
            logger.warning(f"Failed to initialize SimulationGate: {e}")

        # Initialize preprocess gate
        self.preprocess_gate = None
        try:
            self.preprocess_gate = PreprocessGate()
            logger.info("PreprocessGate initialized for early skip detection")
        except Exception as e:
            logger.warning(f"Failed to initialize PreprocessGate: {e}")

        # Initialize background training
        self._init_background_training()

    def _init_background_training(self) -> None:
        """Initialize background training with experience replay buffer."""
        self.replay_buffer = None
        self.background_trainer = None

        try:
            config_name = os.environ.get("TRAINING_CONFIG", "continuous_training.yaml")
            config_path = Path(__file__).parent.parent / "ai_engine" / "configs" / config_name
            logger.info(f"[BackgroundTraining] Loading config from: {config_path}")
            training_config = ContinuousTrainingConfig.from_yaml(config_path)

            if not training_config.enabled:
                logger.info("[BackgroundTraining] Disabled by config")
                return

            if not self.nn_model:
                logger.warning("[BackgroundTraining] NN model not available, skipping")
                return

            self.replay_buffer = ExperienceReplayBuffer(
                capacity=training_config.buffer_capacity,
                lock_timeout=training_config.lock_timeout
            )

            self.background_trainer = BackgroundTrainer(
                model=self.nn_model,
                buffer=self.replay_buffer,
                config=training_config
            )

            self.background_trainer.start()

            try:
                dashboard = get_dashboard_metrics()
                dashboard.model_version = self.background_trainer.model_version
                logger.info(f"Dashboard initialized with model version {dashboard.model_version}")
            except Exception as e:
                logger.warning(f"Failed to set dashboard model version: {e}")

            logger.info(
                f"[BackgroundTraining] Initialized with "
                f"buffer_capacity={training_config.buffer_capacity}, "
                f"training_interval={training_config.training_interval}s"
            )

        except Exception as e:
            logger.warning(f"[BackgroundTraining] Failed to initialize: {e}")

    def _register_handlers(self) -> None:
        """Register all message handlers with the router."""
        # Create observation handler
        self.observation_handler = ObservationHandler(
            feature_extractor=self.feature_extractor,
            nn_model=self.nn_model,
            reward_calculator=self.reward_calculator,
            simulation_gate=self.simulation_gate,
            preprocess_gate=self.preprocess_gate,
            replay_buffer=self.replay_buffer,
            background_trainer=self.background_trainer,
            nn_config=get_config(),
            get_dashboard_metrics_func=get_dashboard_metrics
        )

        # Create training handler
        self.training_handler = TrainingHandler(
            continuous_trainer=self.continuous_trainer,
            background_trainer=self.background_trainer
        )

        # Create gate handler
        self.gate_handler = GateHandler(
            simulation_gate=self.simulation_gate,
            replay_buffer=self.replay_buffer,
            thinking_stats_getter=self.observation_handler.get_thinking_stats
        )

        # Create game state handler
        self.game_state_handler = GameStateHandler(ai_engine=self.ai_engine)

        # Create system handler
        self.system_handler = SystemHandler(
            ai_engine=self.ai_engine,
            message_handlers=list(self._get_all_handler_types()),
            message_stats_getter=lambda: self.message_stats.copy()
        )

        # Register handlers with router
        self._register_message_handlers()

    def _get_all_handler_types(self) -> List[str]:
        """Get all supported message type names."""
        return [
            "queen_death", "queen_success", "game_outcome",
            "difficulty_status_request", "learning_progress_request",
            "observation_data", "training_status_request",
            "background_training_stats_request", "ping", "health_check",
            "reconnect", "heartbeat_response", "reset_nn",
            "gate_stats_request", "spawn_result"
        ]

    def _register_message_handlers(self) -> None:
        """Register individual message type handlers."""
        # Game state handlers
        self.router.register("queen_death", self.game_state_handler.handle_queen_death)
        self.router.register("queen_success", self.game_state_handler.handle_queen_success)
        self.router.register("game_outcome", self.game_state_handler.handle_game_outcome)

        # Observation handler
        self.router.register("observation_data", self.observation_handler.handle_raw)

        # Training handlers
        self.router.register("training_status_request", self.training_handler.handle_training_status)
        self.router.register("reset_nn", self.training_handler.handle_reset_nn)
        self.router.register("background_training_stats_request", self.training_handler.handle_background_training_stats)

        # Gate handlers
        self.router.register("gate_stats_request", self.gate_handler.handle_gate_stats_request)
        self.router.register("spawn_result", self.gate_handler.handle_spawn_result)

        # System handlers
        self.router.register("ping", self.system_handler.handle_ping)
        self.router.register("health_check", self.system_handler.handle_health_check)
        self.router.register("reconnect", self.system_handler.handle_reconnect)
        self.router.register("heartbeat_response", self.system_handler.handle_heartbeat_response)
        self.router.register("difficulty_status_request", self.system_handler.handle_difficulty_status_request)
        self.router.register("learning_progress_request", self.system_handler.handle_learning_progress_request)

    async def handle_message(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Process incoming message with validation and error handling.

        Args:
            message: Message data from client
            client_id: ID of the client that sent the message

        Returns:
            Response message or None if no response needed
        """
        self.message_stats["total_processed"] += 1

        try:
            # Validate message structure
            is_valid, error = validate_message(message)
            if not is_valid:
                self.message_stats["validation_errors"] += 1
                self.message_stats["failed"] += 1
                return self._create_error_response(
                    f"Message validation failed: {error}",
                    error_code="VALIDATION_ERROR"
                )

            message_type = message.get("type")
            logger.info(f"Handling validated message type '{message_type}' from client {client_id}")

            # Add timestamp if not present
            if "timestamp" not in message:
                message["timestamp"] = asyncio.get_event_loop().time()

            # Route message to handler
            response = await self.router.route_raw(message_type, message, client_id)

            if response:
                response["messageId"] = message.get("messageId") or str(uuid.uuid4())
                response["clientId"] = client_id

            self.message_stats["successful"] += 1
            return response

        except Exception as e:
            logger.error(f"Error handling message from client {client_id}: {e}", exc_info=True)
            self.message_stats["processing_errors"] += 1
            self.message_stats["failed"] += 1
            return self._create_error_response(
                f"Internal server error: {str(e)}",
                error_code="PROCESSING_ERROR"
            )

    def _create_error_response(
        self,
        error_message: str,
        error_code: str = "GENERIC_ERROR"
    ) -> Dict[str, Any]:
        """Create standardized error response."""
        return {
            "type": "error",
            "timestamp": asyncio.get_event_loop().time(),
            "data": {
                "error": error_message,
                "errorCode": error_code,
                "status": "error",
                "retryable": error_code in ["PROCESSING_TIMEOUT", "REQUEST_TIMEOUT", "PROCESSING_ERROR"],
                "supportedMessageTypes": list(self._get_all_handler_types())
            }
        }

    def serialize_message(self, message: Dict[str, Any]) -> str:
        """Serialize message to JSON string."""
        try:
            return json.dumps(message, default=str)
        except Exception as e:
            logger.error(f"Message serialization error: {e}")
            return json.dumps(self._create_error_response(
                f"Serialization error: {str(e)}",
                error_code="SERIALIZATION_ERROR"
            ))

    def deserialize_message(self, json_str: str) -> Dict[str, Any]:
        """Deserialize JSON string to message dictionary."""
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(f"Message deserialization error: {e}")
            return self._create_error_response(
                f"Invalid JSON format: {str(e)}",
                error_code="DESERIALIZATION_ERROR"
            )

    def get_message_statistics(self) -> Dict[str, Any]:
        """Get message processing statistics."""
        return {
            "statistics": self.message_stats.copy(),
            "success_rate": (
                self.message_stats["successful"] / max(1, self.message_stats["total_processed"])
            ) * 100,
            "supported_message_types": list(self._get_all_handler_types())
        }
