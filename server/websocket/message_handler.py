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
            "observation_data": self._handle_observation_data,
            "training_status_request": self._handle_training_status_request,
            "ping": self._handle_ping,
            "health_check": self._handle_health_check,
            "reconnect": self._handle_reconnect,
            "heartbeat_response": self._handle_heartbeat_response,
            "reset_nn": self._handle_reset_nn
        }

        # Continuous trainer for real-time learning
        self.continuous_trainer = None
        self._init_continuous_trainer()
        
        # Message validation schemas
        self.message_schemas = self._initialize_schemas()

    def _init_continuous_trainer(self) -> None:
        """Initialize the continuous trainer for real-time learning."""
        try:
            self.continuous_trainer = AsyncContinuousTrainer()
            logger.info("ContinuousTrainer initialized for real-time learning")
        except Exception as e:
            logger.warning(f"Failed to initialize ContinuousTrainer: {e}. Continuous learning disabled.")
        
        # Message processing statistics
        self.message_stats = {
            "total_processed": 0,
            "successful": 0,
            "failed": 0,
            "validation_errors": 0,
            "processing_errors": 0
        }
    
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
            "observation_data": {
                "type": "object",
                "required": ["type", "data"],
                "properties": {
                    "type": {"type": "string", "enum": ["observation_data"]},
                    "timestamp": {"type": "number"},
                    "data": {
                        "type": "object",
                        "required": ["timestamp", "gameTime", "player", "queen", "events"],
                        "properties": {
                            "timestamp": {"type": "number"},
                            "gameTime": {"type": "number"},
                            "sequenceNumber": {"type": "integer"},
                            "player": {"type": "object"},
                            "queen": {"type": "object"},
                            "events": {"type": "object"},
                            "snapshotCount": {"type": "integer"},
                            "windowDuration": {"type": "number"}
                        }
                    }
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
    
    async def _handle_observation_data(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """
        Handle observation data for continuous learning.

        Processes game state observations and returns strategy updates.
        """
        try:
            observation = message.get("data")
            if not observation:
                logger.warning(f"[ObservationHandler] Missing observation data from client {client_id}")
                return self._create_error_response("Missing observation data", error_code="MISSING_DATA")

            if not self.continuous_trainer:
                logger.warning(f"[ObservationHandler] Continuous trainer not available for client {client_id}")
                return self._create_error_response(
                    "Continuous learning not available",
                    error_code="TRAINER_NOT_AVAILABLE"
                )

            sequence_number = observation.get("sequenceNumber", 0)
            logger.info(f"[ObservationHandler] Processing observation #{sequence_number} from client {client_id}")

            # Process observation and get strategy update
            try:
                strategy = await asyncio.wait_for(
                    self.continuous_trainer.process_observation_async(observation),
                    timeout=2.0  # 2 second timeout for real-time response
                )

                logger.info(f"[ObservationHandler] Sending strategy_update v{strategy.version} to client {client_id}")
                return {
                    "type": "strategy_update",
                    "timestamp": asyncio.get_event_loop().time(),
                    "inResponseTo": sequence_number,
                    "payload": strategy.to_dict()
                }

            except asyncio.TimeoutError:
                logger.warning(f"Observation processing timeout for client {client_id}")
                return self._create_error_response(
                    "Observation processing timeout",
                    error_code="PROCESSING_TIMEOUT"
                )

        except Exception as e:
            logger.error(f"Error processing observation data: {e}")
            return self._create_error_response(
                f"Failed to process observation: {str(e)}",
                error_code="PROCESSING_ERROR"
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