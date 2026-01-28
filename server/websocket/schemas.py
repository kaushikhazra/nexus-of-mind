"""
WebSocket Message Schemas and Validation.

Defines JSON schemas for all message types exchanged between
the game client (TypeScript) and AI backend (Python).

This module provides:
- MessageType enum with all supported message types
- JSON schema definitions for message validation
- Validation functions for incoming messages
- ParsedMessage dataclass for type-safe message handling

Message Categories:
    - Game State: queen_death, queen_success, game_outcome
    - Observation: observation_data, spawn_result
    - Training: reset_nn, training_status_request
    - Status: difficulty_status_request, learning_progress_request
    - System: ping, pong, health_check, reconnect

Usage:
    from websocket.schemas import MessageType, validate_message, ParsedMessage

    # Validate incoming message
    is_valid, error = validate_message(raw_message)

    # Parse into typed structure
    parsed = ParsedMessage(type=MessageType.OBSERVATION_DATA, data=data, ...)
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
import time
import logging

from jsonschema import validate, ValidationError

logger = logging.getLogger(__name__)


class MessageType(Enum):
    """All supported WebSocket message types."""
    # Game state messages
    QUEEN_DEATH = "queen_death"
    QUEEN_SUCCESS = "queen_success"
    GAME_OUTCOME = "game_outcome"

    # Observation and spawning
    OBSERVATION_DATA = "observation_data"
    SPAWN_RESULT = "spawn_result"

    # Training control
    RESET_NN = "reset_nn"
    TRAINING_STATUS_REQUEST = "training_status_request"
    BACKGROUND_TRAINING_STATS_REQUEST = "background_training_stats_request"

    # Status requests
    DIFFICULTY_STATUS_REQUEST = "difficulty_status_request"
    LEARNING_PROGRESS_REQUEST = "learning_progress_request"
    GATE_STATS_REQUEST = "gate_stats_request"

    # Connection management
    PING = "ping"
    HEALTH_CHECK = "health_check"
    RECONNECT = "reconnect"
    HEARTBEAT_RESPONSE = "heartbeat_response"


@dataclass
class ParsedMessage:
    """Parsed and validated WebSocket message."""
    type: MessageType
    data: Dict[str, Any]
    client_id: str
    timestamp: float = field(default_factory=time.time)
    message_id: Optional[str] = None


# ============================================================================
# JSON Schema Definitions
# ============================================================================

QUEEN_DEATH_SCHEMA = {
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
}

QUEEN_SUCCESS_SCHEMA = {
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
}

GAME_OUTCOME_SCHEMA = {
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
}

OBSERVATION_DATA_SCHEMA = {
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

LEARNING_PROGRESS_REQUEST_SCHEMA = {
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
}

PING_SCHEMA = {
    "type": "object",
    "required": ["type"],
    "properties": {
        "type": {"type": "string", "enum": ["ping"]},
        "timestamp": {"type": "number"}
    }
}

HEALTH_CHECK_SCHEMA = {
    "type": "object",
    "required": ["type"],
    "properties": {
        "type": {"type": "string", "enum": ["health_check"]}
    }
}

RECONNECT_SCHEMA = {
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
}

DIFFICULTY_STATUS_REQUEST_SCHEMA = {
    "type": "object",
    "required": ["type"],
    "properties": {
        "type": {"type": "string", "enum": ["difficulty_status_request"]},
        "timestamp": {"type": "number"}
    }
}

TRAINING_STATUS_REQUEST_SCHEMA = {
    "type": "object",
    "required": ["type"],
    "properties": {
        "type": {"type": "string", "enum": ["training_status_request"]},
        "timestamp": {"type": "number"}
    }
}

HEARTBEAT_RESPONSE_SCHEMA = {
    "type": "object",
    "required": ["type"],
    "properties": {
        "type": {"type": "string", "enum": ["heartbeat_response"]},
        "timestamp": {"type": "number"}
    }
}

RESET_NN_SCHEMA = {
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

GATE_STATS_REQUEST_SCHEMA = {
    "type": "object",
    "required": ["type"],
    "properties": {
        "type": {"type": "string", "enum": ["gate_stats_request"]},
        "timestamp": {"type": "number"}
    }
}

BACKGROUND_TRAINING_STATS_REQUEST_SCHEMA = {
    "type": "object",
    "required": ["type"],
    "properties": {
        "type": {"type": "string", "enum": ["background_training_stats_request"]},
        "timestamp": {"type": "number"}
    }
}

SPAWN_RESULT_SCHEMA = {
    "type": "object",
    "required": ["type"],
    "properties": {
        "type": {"type": "string", "enum": ["spawn_result"]},
        "success": {"type": "boolean"},
        "spawnChunk": {"type": "integer"},
        "spawnType": {"type": "string"},
        "reason": {"type": "string"}
    }
}

# Schema mapping by message type string
MESSAGE_SCHEMAS: Dict[str, Dict] = {
    "queen_death": QUEEN_DEATH_SCHEMA,
    "queen_success": QUEEN_SUCCESS_SCHEMA,
    "game_outcome": GAME_OUTCOME_SCHEMA,
    "observation_data": OBSERVATION_DATA_SCHEMA,
    "learning_progress_request": LEARNING_PROGRESS_REQUEST_SCHEMA,
    "ping": PING_SCHEMA,
    "health_check": HEALTH_CHECK_SCHEMA,
    "reconnect": RECONNECT_SCHEMA,
    "difficulty_status_request": DIFFICULTY_STATUS_REQUEST_SCHEMA,
    "training_status_request": TRAINING_STATUS_REQUEST_SCHEMA,
    "heartbeat_response": HEARTBEAT_RESPONSE_SCHEMA,
    "reset_nn": RESET_NN_SCHEMA,
    "gate_stats_request": GATE_STATS_REQUEST_SCHEMA,
    "background_training_stats_request": BACKGROUND_TRAINING_STATS_REQUEST_SCHEMA,
    "spawn_result": SPAWN_RESULT_SCHEMA,
}


def validate_message(message: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """
    Validate a message against its JSON schema.

    Args:
        message: Message dictionary to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        message_type = message.get("type")
        if not message_type:
            return False, "Missing message type"

        schema = MESSAGE_SCHEMAS.get(message_type)
        if not schema:
            return False, f"No schema defined for message type: {message_type}"

        # Validate against schema
        validate(instance=message, schema=schema)
        return True, None

    except ValidationError as e:
        return False, f"Schema validation error: {e.message}"
    except Exception as e:
        return False, f"Validation error: {str(e)}"


def get_message_type(type_string: str) -> Optional[MessageType]:
    """
    Convert message type string to MessageType enum.

    Args:
        type_string: Message type as string

    Returns:
        MessageType enum value or None if not found
    """
    try:
        return MessageType(type_string)
    except ValueError:
        return None


def validate_death_data_business_logic(death_data: Dict[str, Any]) -> List[str]:
    """
    Validate death data against business logic rules.

    Args:
        death_data: Death data dictionary

    Returns:
        List of validation error messages (empty if valid)
    """
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
