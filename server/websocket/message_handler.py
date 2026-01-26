"""
WebSocket Message Handler for processing client messages
Enhanced with validation, serialization, and error handling
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import jsonschema
from jsonschema import validate, ValidationError

from ai_engine.data_models import (
    QueenDeathData, QueenDeathMessage, QueenStrategyMessage,
    LearningProgressMessage, serialize_message, deserialize_message
)
from ai_engine.continuous_trainer import ContinuousTrainer, AsyncContinuousTrainer
from ai_engine.feature_extractor import FeatureExtractor
from ai_engine.nn_model import NNModel
from ai_engine.reward_calculator import RewardCalculator
from ai_engine.config import get_config
from ai_engine.simulation import SimulationGate, SimulationGateConfig, get_gate_logger, PreprocessGate
from ai_engine.simulation.dashboard_metrics import get_dashboard_metrics

# New continuous training module (gate as cost function)
from ai_engine.training import (
    Experience as TrainingExperience,
    ExperienceReplayBuffer,
    ContinuousTrainingConfig,
    ContinuousTrainer as BackgroundTrainer,
)
from ai_engine.training.config import ContinuousTrainingConfig
from pathlib import Path

logger = logging.getLogger(__name__)


class MessageHandler:
    """
    Handles incoming WebSocket messages and routes them to appropriate AI Engine functions
    Enhanced with message validation, serialization, and comprehensive error handling
    """
    
    def __init__(self, ai_engine):
        self.ai_engine = ai_engine
        self.message_handlers = {
            "queen_death": self._handle_queen_death,
            "queen_success": self._handle_queen_success,
            "game_outcome": self._handle_game_outcome,
            "difficulty_status_request": self._handle_difficulty_status_request,
            "learning_progress_request": self._handle_learning_progress_request,
            "observation_data": self._handle_chunk_observation_data,
            "training_status_request": self._handle_training_status_request,
            "background_training_stats_request": self._handle_background_training_stats_request,
            "ping": self._handle_ping,
            "health_check": self._handle_health_check,
            "reconnect": self._handle_reconnect,
            "heartbeat_response": self._handle_heartbeat_response,
            "reset_nn": self._handle_reset_nn,
            "gate_stats_request": self._handle_gate_stats_request,
            "spawn_result": self._handle_spawn_result
        }

        # Continuous trainer for real-time learning
        self.continuous_trainer = None
        self._init_continuous_trainer()
        
        # Message validation schemas
        self.message_schemas = self._initialize_schemas()

        # Load spawn gating config
        self.nn_config = get_config()

    def _init_continuous_trainer(self) -> None:
        """Initialize the continuous trainer for real-time learning."""
        try:
            self.continuous_trainer = AsyncContinuousTrainer()
            logger.info("ContinuousTrainer initialized for real-time learning")

        except Exception as e:
            logger.warning(f"Failed to initialize ContinuousTrainer: {e}. Continuous learning disabled.")

        # Initialize feature extractor and model
        self._init_nn()

        # Message processing statistics
        self.message_stats = {
            "total_processed": 0,
            "successful": 0,
            "failed": 0,
            "validation_errors": 0,
            "processing_errors": 0
        }

    def _init_nn(self) -> None:
        """Initialize NN components for chunk-based spawning."""
        self.feature_extractor = None
        self.nn_model = None

        try:
            self.feature_extractor = FeatureExtractor()
            logger.info("FeatureExtractor initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize FeatureExtractor: {e}")

        try:
            self.nn_model = NNModel()
            logger.info(f"NNModel initialized with {self.nn_model._count_parameters()} parameters")
        except Exception as e:
            logger.warning(f"Failed to initialize NNModel: {e}")

        try:
            self.reward_calculator = RewardCalculator()
            logger.info("RewardCalculator initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize RewardCalculator: {e}")
            self.reward_calculator = None

        # Initialize simulation gate for predictive cost function
        try:
            self.simulation_gate = SimulationGate(SimulationGateConfig())
            self.gate_logger = get_gate_logger()
            logger.info("SimulationGate initialized for simulation-gated inference")
        except Exception as e:
            logger.warning(f"Failed to initialize SimulationGate: {e}")
            self.simulation_gate = None
            self.gate_logger = None

        # Initialize preprocess gate (runs BEFORE NN inference)
        try:
            self.preprocess_gate = PreprocessGate()
            logger.info("PreprocessGate initialized for early skip detection")
        except Exception as e:
            logger.warning(f"Failed to initialize PreprocessGate: {e}")
            self.preprocess_gate = None

        # Store previous observations for reward calculation (per territory)
        self.prev_observations: Dict[str, Dict[str, Any]] = {}
        self.prev_decisions: Dict[str, Dict[str, Any]] = {}

        # Thinking loop statistics
        self.thinking_stats = {
            'observations_since_last_action': 0,
            'total_gate_evaluations': 0,
            'gate_passes': 0,
            'confidence_overrides': 0
        }

        # Initialize new continuous training (gate as cost function)
        self._init_background_training()
    
    def _init_background_training(self) -> None:
        """Initialize background training with experience replay buffer."""
        self.replay_buffer = None
        self.background_trainer = None

        try:
            # Load config
            config_path = Path(__file__).parent.parent / "ai_engine" / "configs" / "continuous_training.yaml"
            training_config = ContinuousTrainingConfig.from_yaml(config_path)

            if not training_config.enabled:
                logger.info("[BackgroundTraining] Disabled by config")
                return

            if not self.nn_model:
                logger.warning("[BackgroundTraining] NN model not available, skipping")
                return

            # Create replay buffer
            self.replay_buffer = ExperienceReplayBuffer(
                capacity=training_config.buffer_capacity,
                lock_timeout=training_config.lock_timeout
            )

            # Create background trainer
            self.background_trainer = BackgroundTrainer(
                model=self.nn_model,
                buffer=self.replay_buffer,
                config=training_config
            )

            # Start background training thread
            self.background_trainer.start()

            # Set initial model version in dashboard
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
            self.replay_buffer = None
            self.background_trainer = None

    def _initialize_schemas(self) -> Dict[str, Dict]:
        """Initialize JSON schemas for message validation"""
        return {
            "queen_death": {
                "type": "object",
                "required": ["type", "data"],
                "properties": {
                    "type": {"type": "string", "enum": ["queen_death"]},
                    "timestamp": {"type": "number"},
                    "data": {
                        "type": "object",
                        "required": ["queenId", "generation", "deathLocation", "deathCause"],
                        "properties": {
                            "queenId": {"type": "string", "minLength": 1},
                            "territoryId": {"type": "string"},
                            "generation": {"type": "integer", "minimum": 1},
                            "deathLocation": {
                                "type": "object",
                                "required": ["x", "y", "z"],
                                "properties": {
                                    "x": {"type": "number"},
                                    "y": {"type": "number"},
                                    "z": {"type": "number"}
                                }
                            },
                            "deathCause": {
                                "type": "string",
                                "enum": ["protector_assault", "worker_infiltration", "coordinated_attack", "energy_depletion", "unknown"]
                            },
                            "survivalTime": {"type": "number", "minimum": 0},
                            "parasitesSpawned": {"type": "integer", "minimum": 0},
                            "hiveDiscoveryTime": {"type": "number", "minimum": 0},
                            "playerUnits": {"type": "object"},
                            "assaultPattern": {"type": "object"},
                            "gameState": {"type": "object"}
                        }
                    }
                }
            },
            "queen_success": {
                "type": "object",
                "required": ["type", "data"],
                "properties": {
                    "type": {"type": "string", "enum": ["queen_success"]},
                    "timestamp": {"type": "number"},
                    "data": {
                        "type": "object",
                        "required": ["queenId", "generation", "survivalTime"],
                        "properties": {
                            "queenId": {"type": "string", "minLength": 1},
                            "generation": {"type": "integer", "minimum": 1},
                            "survivalTime": {"type": "number", "minimum": 0},
                            "successful_strategies": {"type": "array"},
                            "effectiveness": {"type": "number", "minimum": 0, "maximum": 1},
                            "game_state": {"type": "object"}
                        }
                    }
                }
            },
            "learning_progress_request": {
                "type": "object",
                "required": ["type", "data"],
                "properties": {
                    "type": {"type": "string", "enum": ["learning_progress_request"]},
                    "data": {
                        "type": "object",
                        "required": ["queenId"],
                        "properties": {
                            "queenId": {"type": "string", "minLength": 1}
                        }
                    }
                }
            },
            "ping": {
                "type": "object",
                "required": ["type"],
                "properties": {
                    "type": {"type": "string", "enum": ["ping"]},
                    "timestamp": {"type": "number"}
                }
            },
            "health_check": {
                "type": "object",
                "required": ["type"],
                "properties": {
                    "type": {"type": "string", "enum": ["health_check"]}
                }
            },
            "reconnect": {
                "type": "object",
                "required": ["type", "data"],
                "properties": {
                    "type": {"type": "string", "enum": ["reconnect"]},
                    "data": {
                        "type": "object",
                        "required": ["clientId"],
                        "properties": {
                            "clientId": {"type": "string", "minLength": 1},
                            "lastMessageId": {"type": "string"}
                        }
                    }
                }
            },
            "game_outcome": {
                "type": "object",
                "required": ["type", "data"],
                "properties": {
                    "type": {"type": "string", "enum": ["game_outcome"]},
                    "timestamp": {"type": "number"},
                    "data": {
                        "type": "object",
                        "required": ["player_won", "survival_time"],
                        "properties": {
                            "player_won": {"type": "boolean"},
                            "survival_time": {"type": "number", "minimum": 0},
                            "queens_killed": {"type": "integer", "minimum": 0},
                            "resources_gathered": {"type": "number", "minimum": 0},
                            "units_created": {"type": "integer", "minimum": 0},
                            "combat_encounters": {"type": "integer", "minimum": 0},
                            "strategic_decisions": {"type": "array"},
                            "adaptation_indicators": {"type": "object"},
                            "game_duration": {"type": "number", "minimum": 0},
                            "difficulty_level": {"type": "number", "minimum": 0, "maximum": 1}
                        }
                    }
                }
            },
            "difficulty_status_request": {
                "type": "object",
                "required": ["type"],
                "properties": {
                    "type": {"type": "string", "enum": ["difficulty_status_request"]},
                    "timestamp": {"type": "number"}
                }
            },
            "training_status_request": {
                "type": "object",
                "required": ["type"],
                "properties": {
                    "type": {"type": "string", "enum": ["training_status_request"]},
                    "timestamp": {"type": "number"}
                }
            },
            "heartbeat_response": {
                "type": "object",
                "required": ["type"],
                "properties": {
                    "type": {"type": "string", "enum": ["heartbeat_response"]},
                    "timestamp": {"type": "number"}
                }
            },
            "reset_nn": {
                "type": "object",
                "required": ["type"],
                "properties": {
                    "type": {"type": "string", "enum": ["reset_nn"]},
                    "timestamp": {"type": "number"},
                    "data": {
                        "type": "object",
                        "properties": {
                            "confirm": {"type": "boolean"}
                        }
                    }
                }
            },
            "observation_data": {
                "type": "object",
                "required": ["type", "data"],
                "properties": {
                    "type": {"type": "string", "enum": ["observation_data"]},
                    "timestamp": {"type": "number"},
                    "data": {
                        "type": "object",
                        "required": ["timestamp", "miningWorkers", "protectors", "queenEnergy", "playerEnergy", "territoryId"],
                        "properties": {
                            "timestamp": {"type": "number"},
                            "miningWorkers": {"type": "array"},
                            "protectors": {"type": "array"},
                            "parasitesStart": {"type": "array"},
                            "parasitesEnd": {"type": "array"},
                            "queenEnergy": {"type": "object"},
                            "playerEnergy": {"type": "object"},
                            "territoryId": {"type": "string"}
                        }
                    }
                }
            }
        }
    
    async def handle_message(self, message: Dict[str, Any], client_id: str) -> Optional[Dict[str, Any]]:
        """
        Process incoming message with enhanced validation and error handling
        
        Args:
            message: Message data from client
            client_id: ID of the client that sent the message
            
        Returns:
            Response message or None if no response needed
        """
        self.message_stats["total_processed"] += 1
        
        try:
            # Validate message structure
            validation_result = self._validate_message(message)
            if not validation_result["valid"]:
                self.message_stats["validation_errors"] += 1
                self.message_stats["failed"] += 1
                return self._create_error_response(
                    f"Message validation failed: {validation_result['error']}", 
                    error_code="VALIDATION_ERROR"
                )
            
            message_type = message.get("type")
            logger.info(f"Handling validated message type '{message_type}' from client {client_id}")
            
            # Add timestamp if not present
            if "timestamp" not in message:
                message["timestamp"] = asyncio.get_event_loop().time()
            
            # Route message to appropriate handler
            handler = self.message_handlers.get(message_type)
            if handler:
                response = await handler(message, client_id)
                if response:
                    # Echo back original message ID for request-response matching
                    # Use original messageId if present, otherwise generate new one
                    response["messageId"] = message.get("messageId") or self._generate_message_id()
                    response["clientId"] = client_id
                    
                self.message_stats["successful"] += 1
                return response
            else:
                logger.warning(f"Unknown message type: {message_type}")
                self.message_stats["failed"] += 1
                return self._create_error_response(
                    f"Unknown message type: {message_type}", 
                    error_code="UNKNOWN_MESSAGE_TYPE"
                )
        
        except Exception as e:
            logger.error(f"Error handling message from client {client_id}: {e}")
            self.message_stats["processing_errors"] += 1
            self.message_stats["failed"] += 1
            return self._create_error_response(
                f"Internal server error: {str(e)}", 
                error_code="PROCESSING_ERROR"
            )
    
    def _validate_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate message against JSON schema
        
        Args:
            message: Message to validate
            
        Returns:
            Dictionary with validation result
        """
        try:
            message_type = message.get("type")
            if not message_type:
                return {"valid": False, "error": "Missing message type"}
            
            schema = self.message_schemas.get(message_type)
            if not schema:
                return {"valid": False, "error": f"No schema defined for message type: {message_type}"}
            
            # Validate against schema
            validate(instance=message, schema=schema)
            return {"valid": True, "error": None}
            
        except ValidationError as e:
            return {"valid": False, "error": f"Schema validation error: {e.message}"}
        except Exception as e:
            return {"valid": False, "error": f"Validation error: {str(e)}"}
    
    def _generate_message_id(self) -> str:
        """Generate unique message ID for tracking"""
        import uuid
        return str(uuid.uuid4())
    
    def serialize_message(self, message: Dict[str, Any]) -> str:
        """
        Serialize message to JSON string with error handling
        
        Args:
            message: Message dictionary to serialize
            
        Returns:
            JSON string or error message
        """
        try:
            return json.dumps(message, default=str)
        except Exception as e:
            logger.error(f"Message serialization error: {e}")
            return json.dumps(self._create_error_response(
                f"Serialization error: {str(e)}", 
                error_code="SERIALIZATION_ERROR"
            ))
    
    def deserialize_message(self, json_str: str) -> Dict[str, Any]:
        """
        Deserialize JSON string to message dictionary with error handling
        
        Args:
            json_str: JSON string to deserialize
            
        Returns:
            Message dictionary or error response
        """
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(f"Message deserialization error: {e}")
            return self._create_error_response(
                f"Invalid JSON format: {str(e)}", 
                error_code="DESERIALIZATION_ERROR"
            )
        except Exception as e:
            logger.error(f"Unexpected deserialization error: {e}")
            return self._create_error_response(
                f"Deserialization error: {str(e)}", 
                error_code="DESERIALIZATION_ERROR"
            )
    
    async def _handle_queen_death(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Handle Queen death data and trigger AI learning with enhanced validation"""
        try:
            death_data = message.get("data")
            if not death_data:
                return self._create_error_response("Missing death data", error_code="MISSING_DATA")
            
            # Additional business logic validation
            validation_errors = self._validate_death_data_business_logic(death_data)
            if validation_errors:
                return self._create_error_response(
                    f"Business logic validation failed: {'; '.join(validation_errors)}", 
                    error_code="BUSINESS_VALIDATION_ERROR"
                )
            
            logger.info(f"Processing Queen death for ID: {death_data['queenId']}, Generation: {death_data['generation']}")
            
            # Process through AI Engine with timeout
            try:
                response = await asyncio.wait_for(
                    self.ai_engine.process_queen_death(death_data),
                    timeout=120.0  # 2 minute timeout for neural network training
                )
                
                logger.info(f"Queen death processing completed for client {client_id}")
                return response
                
            except asyncio.TimeoutError:
                logger.error(f"Queen death processing timeout for client {client_id}")
                return self._create_error_response(
                    "Processing timeout - neural network training took too long", 
                    error_code="PROCESSING_TIMEOUT"
                )
        
        except Exception as e:
            logger.error(f"Error processing Queen death: {e}")
            return self._create_error_response(
                f"Failed to process Queen death: {str(e)}", 
                error_code="PROCESSING_ERROR"
            )
    
    def _validate_death_data_business_logic(self, death_data: Dict[str, Any]) -> List[str]:
        """Validate death data against business logic rules"""
        errors = []
        
        # Validate survival time is reasonable
        survival_time = death_data.get('survivalTime', 0)
        if survival_time < 0:
            errors.append("Survival time cannot be negative")
        elif survival_time > 3600:  # 1 hour max
            errors.append("Survival time exceeds maximum reasonable duration")
        
        # Validate generation progression
        generation = death_data.get('generation', 1)
        if generation < 1:
            errors.append("Generation must be at least 1")
        elif generation > 100:  # Reasonable upper limit
            errors.append("Generation exceeds maximum reasonable value")
        
        # Validate parasites spawned
        parasites_spawned = death_data.get('parasitesSpawned', 0)
        if parasites_spawned < 0:
            errors.append("Parasites spawned cannot be negative")
        elif parasites_spawned > 1000:  # Reasonable upper limit
            errors.append("Parasites spawned exceeds reasonable maximum")
        
        # Validate hive discovery time vs survival time
        hive_discovery_time = death_data.get('hiveDiscoveryTime', 0)
        if hive_discovery_time > survival_time:
            errors.append("Hive discovery time cannot exceed survival time")
        
        return errors
    
    async def _handle_queen_success(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Handle Queen success data for positive reinforcement learning"""
        try:
            success_data = message.get("data")
            if not success_data:
                return self._create_error_response("Missing success data", error_code="MISSING_DATA")
            
            logger.info(f"Processing Queen success for ID: {success_data['queenId']}, Generation: {success_data['generation']}")
            
            # Process through AI Engine with timeout
            try:
                response = await asyncio.wait_for(
                    self.ai_engine.process_queen_success(success_data),
                    timeout=60.0  # 1 minute timeout for success processing
                )
                
                logger.info(f"Queen success processing completed for client {client_id}")
                return response
                
            except asyncio.TimeoutError:
                logger.error(f"Queen success processing timeout for client {client_id}")
                return self._create_error_response(
                    "Processing timeout - success reinforcement took too long", 
                    error_code="PROCESSING_TIMEOUT"
                )
        
        except Exception as e:
            logger.error(f"Error processing Queen success: {e}")
            return self._create_error_response(
                f"Failed to process Queen success: {str(e)}", 
                error_code="PROCESSING_ERROR"
            )
    
    async def _handle_game_outcome(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Handle game outcome data for difficulty adjustment"""
        try:
            outcome_data = message.get("data")
            if not outcome_data:
                return self._create_error_response("Missing outcome data", error_code="MISSING_DATA")
            
            logger.info(f"Processing game outcome for difficulty adjustment from client {client_id}")
            
            # Process through AI Engine with timeout
            try:
                response = await asyncio.wait_for(
                    self.ai_engine.process_game_outcome(outcome_data),
                    timeout=30.0  # 30 second timeout for difficulty processing
                )
                
                logger.info(f"Game outcome processing completed for client {client_id}")
                return response
                
            except asyncio.TimeoutError:
                logger.error(f"Game outcome processing timeout for client {client_id}")
                return self._create_error_response(
                    "Processing timeout - difficulty adjustment took too long", 
                    error_code="PROCESSING_TIMEOUT"
                )
        
        except Exception as e:
            logger.error(f"Error processing game outcome: {e}")
            return self._create_error_response(
                f"Failed to process game outcome: {str(e)}", 
                error_code="PROCESSING_ERROR"
            )
    
    async def _handle_difficulty_status_request(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Handle request for difficulty system status"""
        try:
            logger.info(f"Getting difficulty status for client {client_id}")
            
            # Get status from AI Engine with timeout
            try:
                response = await asyncio.wait_for(
                    self.ai_engine.get_difficulty_status(),
                    timeout=10.0  # 10 second timeout for status retrieval
                )
                
                return response
                
            except asyncio.TimeoutError:
                logger.error(f"Difficulty status request timeout for client {client_id}")
                return self._create_error_response(
                    "Status request timeout", 
                    error_code="REQUEST_TIMEOUT"
                )
        
        except Exception as e:
            logger.error(f"Error getting difficulty status: {e}")
            return self._create_error_response(
                f"Failed to get difficulty status: {str(e)}", 
                error_code="PROCESSING_ERROR"
            )
    
    async def _handle_learning_progress_request(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Handle request for learning progress information with enhanced error handling"""
        try:
            queen_id = message.get("data", {}).get("queenId")
            if not queen_id:
                return self._create_error_response("Missing queenId in learning progress request", error_code="MISSING_DATA")
            
            logger.info(f"Getting learning progress for Queen ID: {queen_id}")
            
            # Get progress from AI Engine with timeout
            try:
                response = await asyncio.wait_for(
                    self.ai_engine.get_learning_progress(queen_id),
                    timeout=30.0  # 30 second timeout for progress retrieval
                )
                
                return response
                
            except asyncio.TimeoutError:
                logger.error(f"Learning progress request timeout for Queen ID: {queen_id}")
                return self._create_error_response(
                    "Progress request timeout", 
                    error_code="REQUEST_TIMEOUT"
                )
        
        except Exception as e:
            logger.error(f"Error getting learning progress: {e}")
            return self._create_error_response(
                f"Failed to get learning progress: {str(e)}", 
                error_code="PROCESSING_ERROR"
            )
    
    async def _handle_reconnect(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Handle client reconnection with message recovery"""
        try:
            reconnect_data = message.get("data", {})
            original_client_id = reconnect_data.get("clientId")
            last_message_id = reconnect_data.get("lastMessageId")
            
            logger.info(f"Handling reconnection for client {original_client_id}, last message: {last_message_id}")
            
            # TODO: Implement message recovery from queue
            # For now, return successful reconnection
            return {
                "type": "reconnect_response",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "status": "reconnected",
                    "clientId": client_id,
                    "originalClientId": original_client_id,
                    "missedMessages": [],  # TODO: Implement message recovery
                    "serverStatus": "healthy"
                }
            }
        
        except Exception as e:
            logger.error(f"Error handling reconnection: {e}")
            return self._create_error_response(
                f"Reconnection failed: {str(e)}", 
                error_code="RECONNECTION_ERROR"
            )
    
    async def _handle_training_status_request(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Handle request for continuous training status."""
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
            return self._create_error_response(
                f"Failed to get training status: {str(e)}",
                error_code="PROCESSING_ERROR"
            )

    async def _handle_ping(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Handle ping message for connection testing with enhanced metrics"""
        request_timestamp = message.get("timestamp", 0)
        current_timestamp = asyncio.get_event_loop().time()
        
        return {
            "type": "pong",
            "timestamp": current_timestamp,
            "data": {
                "clientId": client_id,
                "serverStatus": "healthy",
                "requestTimestamp": request_timestamp,
                "responseTime": current_timestamp - request_timestamp if request_timestamp > 0 else 0,
                "messageStats": self.message_stats.copy()
            }
        }
    
    async def _handle_health_check(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Handle health check request with comprehensive system status"""
        return {
            "type": "health_response",
            "timestamp": asyncio.get_event_loop().time(),
            "data": {
                "status": "healthy",
                "aiEngine": "running" if self.ai_engine.initialized else "initializing",
                "neuralNetwork": "ready" if self.ai_engine.neural_network else "not_ready",
                "gpuAcceleration": self.ai_engine.neural_network.use_gpu if self.ai_engine.neural_network else False,
                "messageHandler": {
                    "status": "active",
                    "supportedMessageTypes": list(self.message_handlers.keys()),
                    "statistics": self.message_stats.copy()
                },
                "systemInfo": {
                    "pythonVersion": "3.9+",
                    "tensorflowVersion": "2.x",
                    "memoryUsage": "normal"  # TODO: Add actual memory monitoring
                }
            }
        }

    async def _handle_heartbeat_response(self, message: Dict[str, Any], client_id: str) -> Optional[Dict[str, Any]]:
        """Handle heartbeat response from client - no response needed"""
        logger.debug(f"Heartbeat response received from client {client_id}")
        # No response needed for heartbeat acknowledgment
        return None

    async def _handle_reset_nn(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """
        Handle neural network reset request.

        Fully resets the NN to initial random state and clears training history.
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
                return self._create_error_response(
                    "Continuous trainer not available",
                    error_code="TRAINER_NOT_AVAILABLE"
                )

            # Perform full reset
            logger.info(f"[ResetNN] Full neural network reset requested by client {client_id}")
            result = self.continuous_trainer.full_reset()
            logger.info(f"[ResetNN] Reset complete: {result}")

            return {
                "type": "reset_nn_response",
                "timestamp": asyncio.get_event_loop().time(),
                "data": result
            }

        except Exception as e:
            logger.error(f"Error resetting neural network: {e}")
            return self._create_error_response(
                f"Failed to reset neural network: {str(e)}",
                error_code="RESET_ERROR"
            )

    def _create_error_response(self, error_message: str, error_code: str = "GENERIC_ERROR") -> Dict[str, Any]:
        """Create standardized error response with enhanced error information"""
        return {
            "type": "error",
            "timestamp": asyncio.get_event_loop().time(),
            "data": {
                "error": error_message,
                "errorCode": error_code,
                "status": "error",
                "retryable": error_code in ["PROCESSING_TIMEOUT", "REQUEST_TIMEOUT", "PROCESSING_ERROR"],
                "supportedMessageTypes": list(self.message_handlers.keys())
            }
        }
    
    def get_message_statistics(self) -> Dict[str, Any]:
        """Get message processing statistics"""
        return {
            "statistics": self.message_stats.copy(),
            "success_rate": (
                self.message_stats["successful"] / max(1, self.message_stats["total_processed"])
            ) * 100,
            "supported_message_types": list(self.message_handlers.keys())
        }

    # ==================== Chunk-Based Observation Handler ====================

    async def _handle_chunk_observation_data(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """
        Handle chunk-based observation data for NN spawning.

        Processes observation → extracts 28 features → runs NN inference → returns spawn decision.
        Also calculates rewards and trains the model based on previous observations.
        """
        try:
            observation = message.get("data")
            if not observation:
                logger.warning(f"[Observation] Missing observation data from client {client_id}")
                return self._create_error_response("Missing observation data", error_code="MISSING_DATA")

            # Check components are available
            if not self.feature_extractor or not self.nn_model:
                logger.warning(f"[Observation] NN components not available for client {client_id}")
                return self._create_error_response(
                    "NN not available",
                    error_code="NN_NOT_AVAILABLE"
                )

            territory_id = observation.get("territoryId", "unknown")
            logger.info(f"[Observation] Processing observation for territory {territory_id} from client {client_id}")

            try:
                # Log raw observation data
                workers_mining = observation.get('miningWorkers', [])
                workers_present = observation.get('workersPresent', [])
                protectors = observation.get('protectors', [])
                queen_energy = observation.get('queenEnergy', {})
                player_energy = observation.get('playerEnergy', {})
                player_minerals = observation.get('playerMinerals', {})
                logger.info(f"[Observation] Raw data: present={len(workers_present)}, mining={len(workers_mining)}, "
                           f"protectors={len(protectors)}, queenE={queen_energy.get('current', 0)}, "
                           f"playerE={player_energy.get('end', 0)}, minerals={player_minerals.get('end', 0)}")

                # === PREPROCESS GATE: Skip NN pipeline if no activity ===
                if self.preprocess_gate:
                    preprocess_decision = self.preprocess_gate.evaluate(observation)
                    if preprocess_decision.should_skip:
                        logger.info(f"[PreprocessGate] SKIP: {preprocess_decision.reason} "
                                   f"(workers={preprocess_decision.workers_count}, "
                                   f"protectors={preprocess_decision.protectors_count})")
                        # Return no-spawn decision without running NN
                        return {
                            "type": "spawn_decision",
                            "timestamp": asyncio.get_event_loop().time(),
                            "data": {
                                "spawnChunk": -1,
                                "spawnType": None,
                                "confidence": 0.0,
                                "skipped": True,
                                "skipReason": preprocess_decision.reason
                            }
                        }

                # Update dashboard game state
                try:
                    dashboard = get_dashboard_metrics()
                    dashboard.update_game_state({
                        'queen_energy': queen_energy.get('current', 0),
                        'workers_visible': len(workers_present) + len(workers_mining),
                        'protectors_visible': len(protectors),
                        'territory_id': territory_id
                    })
                except Exception as e:
                    logger.warning(f"Failed to update dashboard game state: {e}")

                # Calculate reward and train if we have previous observation
                reward_info = None
                if territory_id in self.prev_observations and self.reward_calculator:
                    prev_obs = self.prev_observations[territory_id]
                    prev_decision = self.prev_decisions.get(territory_id)

                    # Calculate reward
                    reward_info = self.reward_calculator.calculate_reward(
                        prev_obs, observation, prev_decision
                    )
                    logger.info(f"[Observation] Reward calculated: {reward_info['reward']:.3f}, "
                               f"components={reward_info.get('components', {})}")

                    # Update pending reward in replay buffer (for SEND actions only)
                    # Background trainer will use this for training
                    if self.replay_buffer is not None and prev_decision and prev_decision.get('was_executed'):
                        updated_exp = self.replay_buffer.update_pending_reward(
                            territory_id,
                            reward_info['reward']
                        )
                        if updated_exp:
                            logger.debug(f"[BackgroundTraining] Updated pending reward: {reward_info['reward']:.3f}")

                        # Record actual reward in gate metrics
                        if self.simulation_gate:
                            self.simulation_gate.record_actual_reward(reward_info['reward'])
                else:
                    logger.info(f"[Observation] First observation for territory - no reward calculation")

                # Extract features (28 normalized values)
                features = self.feature_extractor.extract(observation)
                logger.info(f"[Observation] Features extracted: {len(features)} values, "
                           f"first 5: {[f'{f:.3f}' for f in features[:5]]}")

                # Run NN inference with timeout (2s for first inference, then fast)
                spawn_decision = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None,
                        self.nn_model.get_spawn_decision,
                        features
                    ),
                    timeout=2.0  # 2s timeout to allow TensorFlow warm-up
                )

                # Extract NN decision details
                nn_decision = spawn_decision['nnDecision']
                confidence = spawn_decision['confidence']
                spawn_chunk = spawn_decision['spawnChunk']
                spawn_type = spawn_decision['spawnType']

                logger.debug(f"[NN Decision] {nn_decision.upper()}, confidence={confidence:.3f}")

                # Record entropy for distribution health monitoring
                try:
                    dist_stats = self.nn_model.get_distribution_stats(features)
                    dashboard = get_dashboard_metrics()
                    dashboard.record_entropy(
                        entropy=dist_stats['entropy'],
                        max_entropy=dist_stats['max_entropy'],
                        effective_actions=dist_stats['effective_actions']
                    )
                except Exception as e:
                    logger.debug(f"Failed to record entropy: {e}")

                # === SIMULATION-GATED INFERENCE ===
                should_skip = False
                gate_decision = None
                gate_reason = 'no_gate'

                if self.simulation_gate:
                    # Build observation for simulation gate
                    sim_observation = self._build_simulation_observation(observation)

                    # Evaluate through simulation gate (ALWAYS, for both spawn and no-spawn)
                    # Pass full observation for dashboard recording
                    gate_decision = self.simulation_gate.evaluate(
                        sim_observation,
                        spawn_chunk,
                        spawn_type,
                        confidence,
                        full_observation=observation
                    )

                    # Update thinking loop statistics
                    self.thinking_stats['total_gate_evaluations'] += 1

                    obs_count = self.thinking_stats['observations_since_last_action']

                    # Handle no-spawn decisions
                    if nn_decision == 'no_spawn':
                        logger.info(f"[Gate Validation] {gate_decision.decision}")

                        # Log gate assessment (training happens in background thread)
                        if gate_decision.decision == 'CORRECT_WAIT':
                            logger.info(f"[Gate] NO_SPAWN correct - will be trained via buffer")
                        else:  # SHOULD_SPAWN
                            logger.info(f"[Gate] NO_SPAWN missed opportunity, expected_reward={gate_decision.expected_reward:.3f}")

                        # For no-spawn decisions, we don't execute anything
                        should_skip = True
                        gate_blocked = False  # Not blocked, just no action needed
                        
                    elif gate_decision.decision == 'SEND':
                        # Gate allows - in simulation mode, always execute (don't skip)
                        # In production mode, use NN's confidence-based skip decision
                        if gate_decision.reason == 'simulation_mode':
                            should_skip = False  # Simulation mode: execute everything for training
                        else:
                            nn_threshold = self.nn_config.spawn_gating.confidence_threshold
                            nn_skip = confidence < nn_threshold
                            should_skip = nn_skip  # NN decides whether to skip
                        gate_blocked = False
                        self.thinking_stats['gate_passes'] += 1
                        self.thinking_stats['observations_since_last_action'] = 0

                        if gate_decision.reason == 'confidence_override':
                            self.thinking_stats['confidence_overrides'] += 1

                        # Record spawn for exploration tracking
                        self.simulation_gate.record_spawn(spawn_chunk)

                        # Structured logging
                        if self.gate_logger:
                            self.gate_logger.log_decision(
                                decision='SEND',
                                reason=gate_decision.reason,
                                spawn_chunk=spawn_chunk,
                                spawn_type=spawn_type,
                                expected_reward=gate_decision.expected_reward,
                                nn_confidence=confidence,
                                components=gate_decision.components,
                                observation_count=obs_count,
                                territory_id=territory_id
                            )
                    else:
                        should_skip = True
                        gate_blocked = True  # Gate blocks this decision
                        self.thinking_stats['observations_since_last_action'] += 1
                        gate_reason = gate_decision.reason

                        # Structured logging
                        if self.gate_logger:
                            self.gate_logger.log_decision(
                                decision='WAIT',
                                reason=gate_decision.reason,
                                spawn_chunk=spawn_chunk,
                                spawn_type=spawn_type,
                                expected_reward=gate_decision.expected_reward,
                                nn_confidence=confidence,
                                components=gate_decision.components,
                                observation_count=obs_count + 1,
                                territory_id=territory_id
                            )

                            # Check for deadlock risk
                            wait_streak = self.simulation_gate.get_wait_streak()
                            time_since = self.simulation_gate.get_time_since_last_action()
                            self.gate_logger.log_wait_streak_warning(wait_streak, time_since)

                        # Training happens in background thread via replay buffer
                        # Log gate decision for monitoring
                        if gate_decision.expected_reward == float('-inf'):
                            logger.info(f"[Gate] WAIT: insufficient_energy - experience added to buffer")
                        else:
                            logger.info(f"[Gate] WAIT: expected_reward={gate_decision.expected_reward:.3f} - experience added to buffer")
                else:
                    # Fallback to old confidence threshold if no simulation gate
                    threshold = self.nn_config.spawn_gating.confidence_threshold
                    exploration_rate = self.nn_config.spawn_gating.exploration_rate
                    should_skip = confidence < threshold
                    gate_blocked = False  # No gate, so not blocked by gate

                    # Exploration: occasionally spawn despite low confidence
                    import random
                    if should_skip and random.random() < exploration_rate:
                        should_skip = False
                        logger.info(f"[Observation] Exploration override: spawning despite low confidence {confidence:.3f}")

                    if should_skip:
                        logger.info(f"[Observation] Spawn SKIPPED: confidence {confidence:.3f} < threshold {threshold}")
                    else:
                        logger.info(f"[Observation] Spawn decision: chunk={spawn_chunk}, "
                                   f"type={spawn_type}, confidence={confidence:.3f}")

                # Add experience to replay buffer for background training
                # ALL experiences go to buffer - observation is ground truth from game
                if self.replay_buffer is None:
                    logger.warning("[BackgroundTraining] replay_buffer is None - not initialized!")
                elif gate_decision is None:
                    logger.warning("[BackgroundTraining] gate_decision is None - experiences not being stored!")

                if self.replay_buffer is not None and gate_decision is not None:
                    expected_reward = gate_decision.expected_reward
                    was_executed = gate_decision.decision == 'SEND'

                    # In simulation mode, gate passes everything through
                    # All experiences go to buffer, actual_reward comes from simulation
                    gate_signal = expected_reward - self.simulation_gate.config.reward_threshold if expected_reward != float('-inf') else -1.0

                    try:
                        experience = TrainingExperience(
                            observation=features,
                            spawn_chunk=spawn_chunk,
                            spawn_type=spawn_type,
                            nn_confidence=confidence,
                            gate_signal=gate_signal,
                            R_expected=expected_reward if expected_reward != float('-inf') else -1.0,
                            was_executed=was_executed,
                            actual_reward=None,  # Will be updated on next observation
                            territory_id=territory_id,
                            model_version=self.background_trainer.model_version if self.background_trainer else 0
                        )
                        self.replay_buffer.add(experience)
                        logger.debug(f"[BackgroundTraining] Added experience: chunk={spawn_chunk}")
                    except Exception as e:
                        logger.warning(f"[BackgroundTraining] Failed to add experience: {e}")

                # Store for next reward calculation
                self.prev_observations[territory_id] = observation
                self.prev_decisions[territory_id] = {
                    **spawn_decision,
                    'skipped': should_skip,
                    'was_executed': gate_decision.decision == 'SEND' if gate_decision else not should_skip
                }

                # Gate behavior:
                # - For no-spawn decisions: always send (NN's explicit decision)
                # - For spawn decisions: Gate allows → send, Gate blocks → send ack
                if nn_decision == 'spawn' and gate_decision and gate_decision.decision != 'SEND':
                    # Gate blocks spawn decision - send acknowledgement so client doesn't wait
                    return {
                        "type": "observation_ack",
                        "timestamp": asyncio.get_event_loop().time(),
                        "data": {"status": "processed", "action": "none"}
                    }

                # Send NN decision in clean format (no gate info)
                response_data = {
                    "spawnChunk": spawn_decision["spawnChunk"],  # -1 for no-spawn, 0-255 for spawn
                    "spawnType": spawn_decision["spawnType"],   # None for no-spawn, string for spawn
                    "confidence": confidence
                }

                # Add typeConfidence only for spawn decisions
                if nn_decision == 'spawn':
                    response_data["typeConfidence"] = spawn_decision["typeConfidence"]

                return {
                    "type": "spawn_decision",
                    "timestamp": asyncio.get_event_loop().time(),
                    "data": response_data
                }

            except asyncio.TimeoutError:
                logger.warning(f"[Observation] Inference timeout for client {client_id}")
                return self._create_error_response(
                    "NN inference timeout",
                    error_code="INFERENCE_TIMEOUT"
                )

        except Exception as e:
            logger.error(f"[Observation] Error processing observation: {e}")
            return self._create_error_response(
                f"Failed to process observation: {str(e)}",
                error_code="PROCESSING_ERROR"
            )

    def _build_simulation_observation(self, observation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build observation dict for simulation gate evaluation.

        Converts frontend observation format to simulation gate format.
        """
        # Extract protector chunk IDs
        protectors = observation.get('protectors', [])
        protector_chunks = [p.get('chunkId', -1) for p in protectors if isinstance(p, dict)]

        # Extract worker chunk IDs (both present and mining)
        workers_present = observation.get('workersPresent', [])
        workers_mining = observation.get('miningWorkers', [])
        all_workers = workers_present + workers_mining
        worker_chunks = list(set(w.get('chunkId', -1) for w in all_workers if isinstance(w, dict)))

        # Get hive chunk
        hive_chunk = observation.get('hiveChunk', 0)

        # Get Queen energy
        queen_energy_data = observation.get('queenEnergy', {})
        queen_energy = queen_energy_data.get('current', 50) if isinstance(queen_energy_data, dict) else 50

        return {
            'protector_chunks': protector_chunks,
            'worker_chunks': worker_chunks,
            'hive_chunk': hive_chunk,
            'queen_energy': queen_energy
        }

    async def _handle_gate_stats_request(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """
        Handle request for simulation gate statistics.

        Returns comprehensive metrics about gate behavior.
        """
        try:
            if not self.simulation_gate:
                return self._create_error_response(
                    "Simulation gate not available",
                    error_code="GATE_NOT_AVAILABLE"
                )

            stats = self.simulation_gate.get_statistics()

            # Add thinking loop stats
            stats['thinking_loop'] = self.thinking_stats.copy()

            return {
                "type": "gate_stats_response",
                "timestamp": asyncio.get_event_loop().time(),
                "data": stats
            }

        except Exception as e:
            logger.error(f"Error getting gate statistics: {e}")
            return self._create_error_response(
                f"Failed to get gate statistics: {str(e)}",
                error_code="PROCESSING_ERROR"
            )

    async def _handle_spawn_result(
        self, message: Dict[str, Any], client_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Handle spawn result from simulator.

        When simulator fails to execute a spawn (e.g., insufficient energy),
        it sends this message so we can update the experience properly.
        """
        success = message.get("success", True)
        spawn_chunk = message.get("spawnChunk")
        spawn_type = message.get("spawnType")
        reason = message.get("reason", "")

        if success:
            # Spawn succeeded - nothing special to do
            logger.debug(f"[SpawnResult] Spawn succeeded: {spawn_type} at chunk {spawn_chunk}")
            return None

        # Spawn failed - update the pending experience
        logger.info(f"[SpawnResult] Spawn FAILED: {spawn_type} at chunk {spawn_chunk}, reason={reason}")

        # Use default territory ID for simulator (consistent with observation handling)
        territory_id = "sim-territory"

        # Update pending experience with failure
        if self.replay_buffer is not None:
            # Set actual_reward to negative value for failed spawn
            failed_reward = -0.5  # Penalty for failed spawn attempt
            updated = self.replay_buffer.update_pending_reward(territory_id, failed_reward)
            if updated:
                logger.info(f"[SpawnResult] Updated experience with failure penalty: {failed_reward}")
            else:
                logger.debug(f"[SpawnResult] No pending experience found for territory {territory_id}")

        return None  # No response needed

    async def _handle_background_training_stats_request(
        self, message: Dict[str, Any], client_id: str
    ) -> Dict[str, Any]:
        """
        Handle request for background training statistics.

        Returns metrics from the continuous training loop (gate as cost function).
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
            return self._create_error_response(
                f"Failed to get background training statistics: {str(e)}",
                error_code="PROCESSING_ERROR"
            )