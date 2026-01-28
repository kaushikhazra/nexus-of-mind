# Design Document

## Overview

This design addresses critical code quality issues in the Nexus of Mind AI backend server by refactoring oversized files into maintainable, focused modules. The primary goal is to eliminate god classes, implement SOLID principles, standardize error handling, and improve type safety for hackathon judges while maintaining the server's real-time performance.

The refactoring focuses on three critical areas:
1. **message_handler.py** (1,425 lines) - Split into focused handler modules
2. **neural_network.py** (1,940 lines) - Deprecate in favor of PyTorch implementation
3. **Error Handling** - Standardize with custom exceptions and consistent responses

## Architecture

### Current Architecture Problems

The current architecture suffers from several anti-patterns:
- **God Class**: message_handler.py handles 15+ responsibilities - message validation, JSON schemas, all message handlers, NN model initialization, background training, gate handling
- **Code Duplication**: Two neural network implementations (TensorFlow + PyTorch) with overlapping logic
- **Inconsistent Error Handling**: Error patterns vary across modules
- **Missing Type Safety**: Several modules lack comprehensive type hints

### Target Architecture

The new architecture implements a **Layered Handler Pattern** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    WebSocket Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ ConnectionMgr   │  │ MessageHandler  │  │   Schemas   │ │
│  │ (Connections)   │  │   (Facade)      │  │ (Validation)│ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     Handler Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ ObservationHdlr │  │ TrainingHandler │  │ GateHandler │ │
│  │ (NN Inference)  │  │ (Train Control) │  │ (Decisions) │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    AI Engine Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  NNModel        │  │ ContinuousTrainer│ │ SimulationGate│
│  │  (PyTorch)      │  │ (Training)       │ │ (Evaluation) │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Single Responsibility**: Each handler processes one message type category
2. **Facade Pattern**: MessageHandler coordinates all handlers through a router
3. **Dependency Injection**: Handlers receive dependencies rather than creating them
4. **Custom Exceptions**: Typed error handling with consistent response formats
5. **Schema Centralization**: All message schemas in dedicated module

## Components and Interfaces

### 1. Message Handler Refactoring

#### Current State
```python
# BEFORE: God class with 1,425 lines
class MessageHandler:
    # JSON schemas
    # Message validation
    # NN model initialization
    # Background training management
    # Observation handling
    # Training control handling
    # Gate evaluation handling
    # System status handling
    # Metrics collection
```

#### Target State
```python
# AFTER: Focused facade with clear responsibilities

# Main facade (150 lines)
class MessageHandler:
    def __init__(self, ai_engine: AIEngine):
        self.router = MessageRouter()
        self._init_components()
        self._register_handlers()

    async def handle_message(
        self,
        data: Dict[str, Any],
        client_id: str
    ) -> Optional[Dict[str, Any]]:
        message = self._parse_message(data, client_id)
        return await self.router.route(message)

# Message router (100 lines)
class MessageRouter:
    def __init__(self):
        self._handlers: Dict[MessageType, HandlerFunc] = {}

    def register(self, message_type: MessageType, handler: HandlerFunc) -> None:
        self._handlers[message_type] = handler

    async def route(self, message: ParsedMessage) -> Optional[Dict[str, Any]]:
        handler = self._handlers.get(message.type)
        return await handler(message)

# Observation handler (200 lines)
class ObservationHandler:
    def __init__(
        self,
        nn_model: NNModel,
        simulation_gate: SimulationGate,
        preprocess_gate: PreprocessGate,
        feature_extractor: FeatureExtractor
    ):
        self.nn_model = nn_model
        self.simulation_gate = simulation_gate
        # ...

    async def handle(self, message: ParsedMessage) -> Optional[Dict[str, Any]]:
        # Process observation, get NN prediction, evaluate gate
        pass

# Training handler (150 lines)
class TrainingHandler:
    def __init__(
        self,
        continuous_trainer: ContinuousTrainer,
        background_trainer: BackgroundTrainer
    ):
        # ...

    async def handle(self, message: ParsedMessage) -> Optional[Dict[str, Any]]:
        action = message.data.get("action")
        # Handle start/stop/pause/resume/reset
        pass
```

### 2. Schema Module

#### Centralized Schema Definitions
```python
# server/websocket/schemas.py
from enum import Enum
from dataclasses import dataclass
from typing import Dict, Any, Optional

class MessageType(Enum):
    """All supported WebSocket message types."""
    NN_OBSERVATION = "nn_observation"
    TRAINING_CONTROL = "training_control"
    GATE_EVALUATION = "gate_evaluation"
    GAME_STATE = "game_state"
    SYSTEM_STATUS = "system_status"
    PING = "ping"
    PONG = "pong"

OBSERVATION_SCHEMA = {
    "type": "object",
    "required": ["territoryId", "chunks", "queenEnergy", "hiveChunk"],
    "properties": {
        "territoryId": {"type": "string"},
        "aiPlayer": {"type": "integer"},
        "tick": {"type": "integer"},
        "chunks": {"type": "object"},
        "queenEnergy": {"type": "number"},
        "hiveChunk": {"type": "integer"},
    }
}

TRAINING_CONTROL_SCHEMA = {
    "type": "object",
    "required": ["action"],
    "properties": {
        "action": {"enum": ["start", "stop", "pause", "resume", "reset"]},
        "config": {"type": "object"}
    }
}

@dataclass
class ParsedMessage:
    """Parsed and validated WebSocket message."""
    type: MessageType
    data: Dict[str, Any]
    client_id: str
    timestamp: float

def validate_message(
    message: Dict[str, Any],
    schema: Dict
) -> tuple[bool, Optional[str]]:
    """Validate a message against a JSON schema."""
    required = schema.get("required", [])
    for field in required:
        if field not in message:
            return False, f"Missing required field: {field}"
    return True, None
```

### 3. Custom Exception Architecture

#### Exception Hierarchy
```python
# server/ai_engine/exceptions.py

class AIEngineError(Exception):
    """Base exception for AI engine errors."""
    pass

class ModelNotInitializedError(AIEngineError):
    """Raised when attempting to use an uninitialized model."""
    def __init__(self, model_name: str = "NNModel"):
        super().__init__(f"{model_name} not initialized. Call initialize() first.")

class InsufficientEnergyError(AIEngineError):
    """Raised when queen lacks energy for spawn."""
    def __init__(self, required: float, available: float):
        super().__init__(
            f"Insufficient energy: {available:.1f} available, {required:.1f} required"
        )
        self.required = required
        self.available = available

class InvalidObservationError(AIEngineError):
    """Raised when observation data is malformed."""
    def __init__(self, field: str, reason: str):
        super().__init__(f"Invalid observation field '{field}': {reason}")
        self.field = field
        self.reason = reason

class GateEvaluationError(AIEngineError):
    """Raised when gate evaluation fails."""
    def __init__(self, reason: str, observation: dict = None):
        super().__init__(f"Gate evaluation failed: {reason}")
        self.reason = reason
        self.observation = observation

class TrainingError(AIEngineError):
    """Raised when training encounters an error."""
    def __init__(self, phase: str, reason: str):
        super().__init__(f"Training error in {phase}: {reason}")
        self.phase = phase
        self.reason = reason
```

### 4. Neural Network Documentation Strategy

#### Deprecation Notice for TensorFlow Implementation
```python
# server/ai_engine/neural_network_tensorflow_legacy.py
"""
DEPRECATED: TensorFlow implementation of Queen Behavior Network.

This module is preserved for reference only. The active implementation
is in nn_model.py (PyTorch).

Reason for deprecation:
- PyTorch provides better debugging and development experience
- PyTorch model is actively maintained and tested
- Reduces maintenance burden of dual implementations

To use the active implementation:
    from ai_engine.nn_model import NNModel
"""

import warnings
warnings.warn(
    "neural_network.py is deprecated. Use nn_model.py instead.",
    DeprecationWarning,
    stacklevel=2
)

# ... rest of file unchanged
```

## Data Models

### Module Organization Structure

```
server/
├── websocket/
│   ├── __init__.py
│   ├── connection_manager.py      # (existing, keep as-is)
│   ├── message_handler.py         # Slim coordinator (~150 lines)
│   ├── message_router.py          # Route messages to handlers (~100 lines)
│   ├── schemas.py                 # JSON schema definitions (~150 lines)
│   └── handlers/
│       ├── __init__.py
│       ├── observation_handler.py # NN observation processing (~200 lines)
│       ├── training_handler.py    # Training control messages (~150 lines)
│       ├── gate_handler.py        # Gate evaluation messages (~150 lines)
│       ├── game_state_handler.py  # Game state updates (~150 lines)
│       └── system_handler.py      # System/health messages (~100 lines)
├── ai_engine/
│   ├── __init__.py
│   ├── exceptions.py              # Custom exception classes (~100 lines)
│   ├── nn_model.py                # PyTorch implementation (primary)
│   ├── neural_network_tensorflow_legacy.py  # Deprecated TensorFlow
│   ├── feature_extractor.py       # Feature extraction (add type hints)
│   ├── reward_calculator.py       # Reward calculation (add type hints)
│   ├── continuous_trainer.py      # Continuous training (add docstrings)
│   ├── background_trainer.py      # Background training (add docstrings)
│   └── decision_gate/             # (existing, keep as-is)
│       ├── __init__.py
│       ├── gate.py                # Gate evaluation (add type hints)
│       └── config.py
└── tests/
    └── websocket/
        ├── test_message_handler.py
        ├── test_message_router.py
        ├── test_schemas.py
        └── handlers/
            ├── test_observation_handler.py
            ├── test_training_handler.py
            └── test_gate_handler.py
```

### Interface Definitions

```python
from typing import Protocol, Dict, Any, Optional, Callable, Awaitable
from dataclasses import dataclass

# Handler function type
HandlerFunc = Callable[[ParsedMessage], Awaitable[Optional[Dict[str, Any]]]]

# Handler protocol for type checking
class Handler(Protocol):
    async def handle(self, message: ParsedMessage) -> Optional[Dict[str, Any]]:
        ...

# Error response structure
@dataclass
class ErrorResponse:
    type: str = "error"
    error: str = ""
    errorCode: str = ""
    field: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {"type": self.type, "error": self.error, "errorCode": self.errorCode}
        if self.field:
            result["field"] = self.field
        return result

# Success response for training operations
@dataclass
class TrainingStatusResponse:
    type: str = "training_status"
    status: str = ""
    model_version: Optional[int] = None
    iterations: Optional[int] = None
    samples_processed: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {"type": self.type, "status": self.status}
        if self.model_version is not None:
            result["model_version"] = self.model_version
        if self.iterations is not None:
            result["iterations"] = self.iterations
        if self.samples_processed is not None:
            result["samples_processed"] = self.samples_processed
        return result

# NN decision response
@dataclass
class NNDecisionResponse:
    type: str = "nn_decision"
    action: str = ""  # "spawn" or "wait"
    spawnChunk: Optional[int] = None
    spawnType: Optional[str] = None
    confidence: Optional[float] = None
    expectedReward: Optional[float] = None
    reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {"type": self.type, "action": self.action}
        if self.spawnChunk is not None:
            result["spawnChunk"] = self.spawnChunk
        if self.spawnType is not None:
            result["spawnType"] = self.spawnType
        if self.confidence is not None:
            result["confidence"] = self.confidence
        if self.expectedReward is not None:
            result["expectedReward"] = self.expectedReward
        if self.reason is not None:
            result["reason"] = self.reason
        return result
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: File Size Constraint Compliance
*For any* Python file in the refactored codebase, the line count should not exceed 500 lines
**Validates: Requirements 1.1**

### Property 2: Functional Preservation
*For any* existing functionality in the server, it should continue to work exactly as before after refactoring, with all existing tests passing
**Validates: Requirements 1.5, 2.5, 8.3**

### Property 3: Single Responsibility Compliance
*For any* class in the refactored codebase, it should have exactly one well-defined responsibility and all its methods should relate to that core purpose
**Validates: Requirements 2.2, 2.3, 2.4**

### Property 4: DRY Principle Compliance
*For any* neural network logic pattern in the codebase, it should exist in exactly one active implementation with the deprecated version clearly marked
**Validates: Requirements 3.1, 3.2, 3.4**

### Property 5: Type Hint Coverage
*For any* public function in core modules, it should have complete type hints for all parameters and return values
**Validates: Requirements 4.1, 4.2, 4.4**

### Property 6: Error Response Consistency
*For any* error condition in message handlers, it should return a structured error response with appropriate error code
**Validates: Requirements 5.2, 5.4**

### Property 7: Handler Isolation
*For any* message handler, it should be independently testable without requiring the full MessageHandler infrastructure
**Validates: Requirements 6.4, 8.1**

### Property 8: Schema Centralization
*For any* message validation, it should use schemas defined in the centralized schemas module
**Validates: Requirements 6.3**

### Property 9: Build System Compatibility
*For any* build operation (test, lint, run), it should complete successfully without errors after refactoring
**Validates: Requirements 10.1, 10.4**

### Property 10: Test Coverage Preservation
*For any* module in the codebase, test coverage should be maintained at current levels or improved, with handler modules achieving at least 80% coverage
**Validates: Requirements 8.5**

### Property 11: Module Documentation
*For any* public module, it should have a comprehensive docstring explaining its purpose, usage, and architecture
**Validates: Requirements 9.1, 9.4**

### Property 12: Import Resolution
*For any* import statement in the refactored codebase, it should resolve correctly without circular dependencies
**Validates: Requirements 7.4, 7.5**

## Error Handling

### Refactoring Error Prevention

The refactoring process must handle several categories of potential errors:

#### 1. Import Resolution Errors
**Problem**: Moving files breaks existing import statements
**Solution**:
- Use Python compiler to validate all imports after each module extraction
- Implement automated import path updates using AST transformation
- Create import mapping configuration for complex moves

```python
# Before refactoring
from websocket.message_handler import MessageHandler

# After refactoring - automatically updated
from websocket.message_handler import MessageHandler
# Handlers imported through the main module
```

#### 2. Circular Dependency Detection
**Problem**: Refactoring may introduce circular dependencies between modules
**Solution**:
- Use dependency analysis tools to detect cycles before they cause runtime errors
- Implement dependency injection to break tight coupling
- Create clear dependency hierarchy with one-way dependencies

```python
# Avoid circular dependencies
# Bad: message_handler imports observation_handler, observation_handler imports message_handler
# Good: message_handler creates observation_handler, observation_handler uses interfaces
```

#### 3. Runtime Behavior Changes
**Problem**: Refactoring may inadvertently change runtime behavior
**Solution**:
- Maintain comprehensive test suite that validates behavior preservation
- Use integration tests for cross-module communication
- Implement E2E tests for WebSocket message flows

#### 4. Type Checking Failures
**Problem**: Adding type hints may reveal existing type issues
**Solution**:
- Use gradual typing approach, starting with core modules
- Configure mypy with appropriate strictness levels
- Document any intentional type: ignore directives

## Testing Strategy

### Dual Testing Approach

The refactoring effort requires both **unit tests** and **integration tests** to ensure comprehensive coverage:

#### Unit Testing Focus
- **Handler Tests**: Test each handler in isolation with mocked dependencies
- **Schema Tests**: Test validation logic for valid and invalid messages
- **Router Tests**: Test message routing to correct handlers
- **Exception Tests**: Test custom exceptions produce correct messages

#### Integration Testing Focus
- **Message Flow Tests**: Test complete message processing from receipt to response
- **Training Control Tests**: Test training lifecycle operations
- **Gate Evaluation Tests**: Test gate decisions with realistic observations

### Testing Configuration

#### Unit Test Examples
```python
# server/tests/websocket/handlers/test_observation_handler.py

import pytest
from unittest.mock import Mock, AsyncMock
from websocket.handlers.observation_handler import ObservationHandler
from websocket.schemas import MessageType, ParsedMessage

class TestObservationHandler:
    @pytest.fixture
    def handler(self):
        """Create handler with mocked dependencies."""
        nn_model = Mock()
        nn_model.predict.return_value = Mock(
            chunk=50,
            parasite_type="energy",
            confidence=0.8
        )

        gate = Mock()
        gate.evaluate.return_value = Mock(
            decision="SEND",
            expected_reward=0.5,
            reason=None
        )

        return ObservationHandler(
            nn_model=nn_model,
            simulation_gate=gate,
            preprocess_gate=Mock(evaluate=Mock(return_value=Mock(should_process=True))),
            feature_extractor=Mock(extract=Mock(return_value=[0]*64))
        )

    @pytest.mark.asyncio
    async def test_valid_observation_returns_spawn(self, handler):
        """Valid observation with SEND decision returns spawn action."""
        message = ParsedMessage(
            type=MessageType.NN_OBSERVATION,
            data={
                "territoryId": "test",
                "chunks": {"50": {"workers": 3}},
                "queenEnergy": 100,
                "hiveChunk": 0
            },
            client_id="test",
            timestamp=0
        )

        result = await handler.handle(message)

        assert result["type"] == "nn_decision"
        assert result["action"] == "spawn"
        assert result["spawnChunk"] == 50

    @pytest.mark.asyncio
    async def test_invalid_observation_returns_error(self, handler):
        """Invalid observation returns error response."""
        message = ParsedMessage(
            type=MessageType.NN_OBSERVATION,
            data={"invalid": "data"},  # Missing required fields
            client_id="test",
            timestamp=0
        )

        result = await handler.handle(message)

        assert result["type"] == "error"
```

#### Integration Test Examples
```python
# server/tests/websocket/test_message_handler_integration.py

import pytest
from websocket.message_handler import MessageHandler
from ai_engine.ai_engine import AIEngine

class TestMessageHandlerIntegration:
    @pytest.fixture
    def handler(self):
        """Create handler with real dependencies."""
        ai_engine = AIEngine()
        return MessageHandler(ai_engine)

    @pytest.mark.asyncio
    async def test_full_observation_flow(self, handler):
        """Test complete observation processing."""
        observation = {
            "type": "nn_observation",
            "territoryId": "test",
            "chunks": {"50": {"workers": 3}},
            "queenEnergy": 100,
            "hiveChunk": 0
        }

        result = await handler.handle_message(observation, "client_1")

        assert result["type"] == "nn_decision"
        assert result["action"] in ["spawn", "wait"]

    @pytest.mark.asyncio
    async def test_training_control_flow(self, handler):
        """Test training control operations."""
        start_msg = {"type": "training_control", "action": "start"}
        result = await handler.handle_message(start_msg, "client_1")
        assert result["status"] == "started"

        stop_msg = {"type": "training_control", "action": "stop"}
        result = await handler.handle_message(stop_msg, "client_1")
        assert result["status"] == "stopped"
```

### Test Coverage Requirements

#### Coverage Targets
- **Handler Modules**: Minimum 80% coverage
- **Schema Module**: 100% coverage for validation logic
- **Exception Module**: 100% coverage for all exception types
- **Integration Points**: Full coverage for message routing

#### Coverage Monitoring
```python
# pytest configuration for coverage monitoring
# pyproject.toml or setup.cfg

[tool.pytest.ini_options]
addopts = "--cov=websocket --cov=ai_engine --cov-report=term-missing"

[tool.coverage.run]
source = ["server"]
omit = ["**/tests/**", "**/__init__.py"]

[tool.coverage.report]
fail_under = 80
show_missing = true
```

This comprehensive testing strategy ensures that the refactoring maintains code quality while preserving all existing functionality and real-time performance characteristics.
