# Server Code Review - Nexus of Mind AI Backend

## Overview

- **Total Production Files**: 79 Python files
- **Total Test Files**: 46 Python files
- **Lines of Production Code**: ~41,600 lines
- **Lines of Test Code**: ~16,500 lines
- **Test Coverage**: 88 test classes covering major modules

---

## Architecture Assessment

### Module Structure

| Module | Files | Lines | Purpose | Quality |
|--------|-------|-------|---------|---------|
| `ai_engine/` | 50+ | ~25,000 | Neural network, training, decision gate | Good |
| `websocket/` | 2 | ~1,800 | WebSocket communication | Needs refactoring |
| `game_simulator/` | 9 | ~3,200 | Training data generation | Good |
| `routes/` | 2 | ~280 | REST API endpoints | Excellent |
| `database/` | 1 | ~180 | SQLite persistence | Excellent |
| `config/` | - | - | Configuration files | Good |

---

## MUST FIX Before Hackathon Submission

### 1. **CRITICAL: message_handler.py is 1,425 lines (SRP Violation)**

**File**: `server/websocket/message_handler.py`
**Issue**: Single file handles 15+ responsibilities - message validation, JSON schemas, all message handlers, NN model initialization, background training, gate handling, etc.

**Hackathon Impact**: Judges will flag this as a major code quality issue.

**Suggested Fix**: Split into multiple modules:

```python
# websocket/handlers/__init__.py
# websocket/handlers/observation_handler.py
# websocket/handlers/training_handler.py
# websocket/handlers/gate_handler.py
# websocket/schemas.py
# websocket/message_router.py
```

### 2. **HIGH: neural_network.py is 1,940 lines**

**File**: `server/ai_engine/neural_network.py`
**Issue**: TensorFlow-based NN implementation is too large and complex.

**Suggested Fix**: Split into:
- `neural_network/base.py` - Base class
- `neural_network/tensorflow_impl.py` - TF implementation
- `neural_network/callbacks.py` - Training callbacks
- `neural_network/quantization.py` - Model optimization

### 3. **HIGH: Duplicate NN Implementations (DRY Violation)**

**Issue**: Both TensorFlow (`neural_network.py`) and PyTorch (`nn_model.py`) implementations exist.

**Files**:
- `ai_engine/neural_network.py` - TensorFlow (1,940 lines)
- `ai_engine/nn_model.py` - PyTorch (1,295 lines)

**Hackathon Impact**: Confusing for judges, appears unfinished.

**Suggested Fix**:
1. Document which is the primary implementation (PyTorch is actively used)
2. Either remove TensorFlow version or clearly mark as legacy/deprecated

### 4. **MEDIUM: Missing Type Hints in Some Modules**

**Files**: Various files in `ai_engine/`

**Suggested Fix**: Add type hints to all public functions:

```python
# Before
def evaluate(self, observation, chunk, parasite_type, confidence):

# After
def evaluate(
    self,
    observation: Dict[str, Any],
    chunk: int,
    parasite_type: str,
    confidence: float
) -> GateDecision:
```

---

## Nice to Have Improvements

### 1. **Reorganize ai_engine/ Module**

Current structure is flat with 50+ files. Suggested reorganization:

```
ai_engine/
├── core/
│   ├── ai_engine.py
│   ├── feature_extractor.py
│   └── reward_calculator.py
├── models/
│   ├── nn_model.py
│   ├── continuous_trainer.py
│   └── background_trainer.py
├── decision_gate/  (already reorganized)
├── training/       (exists)
├── monitoring/
│   ├── performance_monitor.py
│   ├── accuracy_tracker.py
│   └── learning_quality_monitor.py
├── optimization/
│   ├── gpu_manager.py
│   ├── model_quantizer.py
│   └── batch_processor.py
└── utils/
    ├── hardware_detector.py
    └── memory_manager.py
```

### 2. **Add Module-Level Docstrings**

Some files lack proper module docstrings explaining their purpose.

### 3. **Standardize Error Handling**

Error handling patterns vary across modules. Consider creating:
- Custom exception classes
- Centralized error logging
- Consistent error response format

---

## SOLID Principles Analysis

### Single Responsibility Principle (SRP)
- **Violation**: `message_handler.py` - handles too many concerns
- **Violation**: `neural_network.py` - manages training, inference, optimization
- **Good**: `routes/` modules - each route file has single purpose
- **Good**: `database/energy_lords.py` - focused on persistence only

### Open/Closed Principle (OCP)
- **Good**: Message handlers use type-based routing
- **Improvement**: Could use handler registry pattern for extensibility

### Liskov Substitution Principle (LSP)
- **Good**: Entity classes (Parasite, Worker, Protector) follow consistent interfaces

### Interface Segregation Principle (ISP)
- **Good**: Clean public APIs in `__init__.py` files
- **Good**: Separate config classes for different concerns

### Dependency Inversion Principle (DIP)
- **Good**: Uses dependency injection for managers
- **Improvement**: Could use abstract base classes for neural network implementations

---

## DRY Principle Analysis

### Violations Found:
1. **Duplicate NN implementations** (TensorFlow + PyTorch)
2. **Repeated JSON schema definitions** in message_handler.py
3. **Similar validation logic** in multiple handlers

### Well-Applied:
1. **Config loader** - single source for all configuration
2. **Dashboard metrics** - singleton pattern for metrics collection
3. **Cost function** - reused across gate evaluations

---

## KISS Principle Analysis

### Overly Complex:
1. **Multi-GPU coordination** - may be over-engineered for current needs
2. **Optimization rollback manager** - complex state machine

### Well-Applied:
1. **Database layer** - simple SQLite with straightforward CRUD
2. **Routes** - minimal, focused endpoints
3. **Game simulator** - clear state machine

---

## Test Coverage Assessment

### Well-Tested Modules:
- Decision gate components (514 lines of tests)
- Game simulator (542 lines)
- Continuous training (601 lines)
- Batch processing (665 lines)
- Production deployment (903 lines)

### Under-Tested Modules:
- `message_handler.py` - needs unit tests for individual handlers
- Some utility modules in `ai_engine/`

---

## Hackathon Judging Criteria Compliance

### Application Quality (40 points)
- **Functionality**: Good - all core features work
- **Code Quality**: Needs work - large files, SRP violations
- **Architecture**: Good - clear module boundaries

### Documentation (20 points)
- **Code Comments**: Good - most files have docstrings
- **API Documentation**: Needs improvement
- **README**: Present but could be more detailed

### Innovation (15 points)
- **Uniqueness**: Excellent - simulation-gated NN inference is novel
- **Problem-Solving**: Excellent - curriculum learning, continuous training

---

## Priority Action Items

1. **Immediate (Before Submission)**:
   - Split `message_handler.py` into smaller modules
   - Add clear documentation explaining TF vs PyTorch choice
   - Ensure all tests pass

2. **If Time Permits**:
   - Add type hints to critical modules
   - Improve test coverage for message handlers
   - Clean up unused code

3. **Post-Hackathon**:
   - Full module reorganization
   - Remove duplicate implementations
   - Performance optimization audit

---

## Detailed Refactoring Guide

This section provides specific, actionable changes for each file identified in the code review.

---

### 1. message_handler.py Refactoring (CRITICAL)

**Current State**: `server/websocket/message_handler.py` - 1,425 lines
**Target State**: 6-7 focused modules, each <300 lines

#### Step 1: Create `server/websocket/handlers/` directory

```
server/websocket/
├── __init__.py
├── connection_manager.py      # (existing, keep as-is)
├── message_handler.py         # Slim coordinator (~150 lines)
├── message_router.py          # Route messages to handlers (~100 lines)
├── schemas.py                 # JSON schema definitions (~150 lines)
└── handlers/
    ├── __init__.py
    ├── observation_handler.py # NN observation processing (~200 lines)
    ├── training_handler.py    # Training control messages (~150 lines)
    ├── gate_handler.py        # Gate evaluation messages (~150 lines)
    ├── game_state_handler.py  # Game state updates (~150 lines)
    └── system_handler.py      # System/health messages (~100 lines)
```

#### Step 2: Extract schemas.py (~150 lines)

**Move these from message_handler.py:**
- All JSON schema definitions
- Schema validation functions
- Message type constants

```python
# server/websocket/schemas.py
"""
WebSocket message schemas and validation.

Defines JSON schemas for all message types exchanged between
the game client and AI backend.
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum


class MessageType(Enum):
    """All supported WebSocket message types."""
    NN_OBSERVATION = "nn_observation"
    TRAINING_CONTROL = "training_control"
    GATE_EVALUATION = "gate_evaluation"
    GAME_STATE = "game_state"
    SYSTEM_STATUS = "system_status"
    PING = "ping"
    PONG = "pong"


# JSON Schemas for validation
OBSERVATION_SCHEMA = {
    "type": "object",
    "required": ["territoryId", "chunks", "queenEnergy", "hiveChunk"],
    "properties": {
        "territoryId": {"type": "string"},
        "aiPlayer": {"type": "integer"},
        "tick": {"type": "integer"},
        "chunks": {"type": "object"},
        "queenEnergy": {"type": "number"},
        "playerEnergyStart": {"type": "number"},
        "playerEnergyEnd": {"type": "number"},
        "playerMineralsStart": {"type": "number"},
        "playerMineralsEnd": {"type": "number"},
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

GATE_EVALUATION_SCHEMA = {
    "type": "object",
    "required": ["chunk", "parasiteType", "confidence"],
    "properties": {
        "chunk": {"type": "integer", "minimum": 0, "maximum": 399},
        "parasiteType": {"enum": ["energy", "combat"]},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1}
    }
}


def validate_message(message: Dict[str, Any], schema: Dict) -> tuple[bool, Optional[str]]:
    """
    Validate a message against a JSON schema.

    Returns:
        Tuple of (is_valid, error_message)
    """
    # Simple validation - could use jsonschema library for full validation
    required = schema.get("required", [])
    for field in required:
        if field not in message:
            return False, f"Missing required field: {field}"
    return True, None


@dataclass
class ParsedMessage:
    """Parsed and validated WebSocket message."""
    type: MessageType
    data: Dict[str, Any]
    client_id: str
    timestamp: float
```

#### Step 3: Extract message_router.py (~100 lines)

**Move these responsibilities:**
- Message type routing logic
- Handler registration
- Error handling for unknown message types

```python
# server/websocket/message_router.py
"""
Message routing for WebSocket handlers.

Routes incoming messages to appropriate handlers based on message type.
"""

import logging
from typing import Dict, Any, Callable, Awaitable, Optional

from .schemas import MessageType, ParsedMessage

logger = logging.getLogger(__name__)

# Type alias for handler functions
HandlerFunc = Callable[[ParsedMessage], Awaitable[Optional[Dict[str, Any]]]]


class MessageRouter:
    """Routes WebSocket messages to appropriate handlers."""

    def __init__(self):
        self._handlers: Dict[MessageType, HandlerFunc] = {}

    def register(self, message_type: MessageType, handler: HandlerFunc) -> None:
        """Register a handler for a message type."""
        self._handlers[message_type] = handler
        logger.debug(f"Registered handler for {message_type.value}")

    async def route(self, message: ParsedMessage) -> Optional[Dict[str, Any]]:
        """
        Route a message to its handler.

        Returns:
            Response dict if handler returns one, None otherwise.

        Raises:
            ValueError: If no handler registered for message type.
        """
        handler = self._handlers.get(message.type)
        if handler is None:
            logger.warning(f"No handler for message type: {message.type}")
            return {
                "type": "error",
                "error": f"Unknown message type: {message.type.value}",
                "errorCode": "UNKNOWN_MESSAGE_TYPE"
            }

        try:
            return await handler(message)
        except Exception as e:
            logger.error(f"Handler error for {message.type}: {e}")
            return {
                "type": "error",
                "error": str(e),
                "errorCode": "HANDLER_ERROR"
            }

    def get_registered_types(self) -> list[MessageType]:
        """Get list of registered message types."""
        return list(self._handlers.keys())
```

#### Step 4: Extract observation_handler.py (~200 lines)

**Move these responsibilities:**
- NN observation processing
- Feature extraction coordination
- Spawn decision generation
- Response formatting

```python
# server/websocket/handlers/observation_handler.py
"""
Handler for neural network observation messages.

Processes game observations and generates spawn decisions.
"""

import logging
from typing import Dict, Any, Optional

from ..schemas import ParsedMessage, validate_message, OBSERVATION_SCHEMA
from ai_engine.nn_model import NNModel
from ai_engine.decision_gate import SimulationGate, PreprocessGate
from ai_engine.feature_extractor import FeatureExtractor

logger = logging.getLogger(__name__)


class ObservationHandler:
    """Handles NN observation messages from the game client."""

    def __init__(
        self,
        nn_model: NNModel,
        simulation_gate: SimulationGate,
        preprocess_gate: PreprocessGate,
        feature_extractor: FeatureExtractor
    ):
        self.nn_model = nn_model
        self.simulation_gate = simulation_gate
        self.preprocess_gate = preprocess_gate
        self.feature_extractor = feature_extractor

    async def handle(self, message: ParsedMessage) -> Optional[Dict[str, Any]]:
        """
        Process an NN observation and return spawn decision.

        Args:
            message: Parsed observation message

        Returns:
            Spawn decision response or None if no action
        """
        # Validate observation data
        is_valid, error = validate_message(message.data, OBSERVATION_SCHEMA)
        if not is_valid:
            logger.warning(f"Invalid observation: {error}")
            return {"type": "error", "error": error}

        observation = message.data

        # Preprocess gate check
        preprocess_decision = self.preprocess_gate.evaluate(observation)
        if not preprocess_decision.should_process:
            logger.debug(f"Preprocess gate blocked: {preprocess_decision.reason}")
            return {
                "type": "nn_decision",
                "action": "wait",
                "reason": preprocess_decision.reason
            }

        # Extract features for NN
        features = self.feature_extractor.extract(observation)

        # Get NN prediction
        prediction = self.nn_model.predict(features)
        chunk = prediction.chunk
        parasite_type = prediction.parasite_type
        confidence = prediction.confidence

        # Simulation gate evaluation
        gate_decision = self.simulation_gate.evaluate(
            observation=observation,
            chunk=chunk,
            parasite_type=parasite_type,
            confidence=confidence
        )

        if gate_decision.decision == "SEND":
            return {
                "type": "nn_decision",
                "action": "spawn",
                "spawnChunk": chunk,
                "spawnType": parasite_type,
                "confidence": confidence,
                "expectedReward": gate_decision.expected_reward
            }
        else:
            return {
                "type": "nn_decision",
                "action": "wait",
                "reason": gate_decision.reason,
                "expectedReward": gate_decision.expected_reward
            }
```

#### Step 5: Extract training_handler.py (~150 lines)

**Move these responsibilities:**
- Training start/stop/pause/resume
- Training configuration updates
- Training status queries
- Background trainer coordination

```python
# server/websocket/handlers/training_handler.py
"""
Handler for training control messages.

Manages neural network training lifecycle.
"""

import logging
from typing import Dict, Any, Optional

from ..schemas import ParsedMessage, validate_message, TRAINING_CONTROL_SCHEMA
from ai_engine.continuous_trainer import ContinuousTrainer
from ai_engine.background_trainer import BackgroundTrainer

logger = logging.getLogger(__name__)


class TrainingHandler:
    """Handles training control messages."""

    def __init__(
        self,
        continuous_trainer: ContinuousTrainer,
        background_trainer: BackgroundTrainer
    ):
        self.continuous_trainer = continuous_trainer
        self.background_trainer = background_trainer

    async def handle(self, message: ParsedMessage) -> Optional[Dict[str, Any]]:
        """
        Process a training control message.

        Args:
            message: Parsed training control message

        Returns:
            Status response
        """
        is_valid, error = validate_message(message.data, TRAINING_CONTROL_SCHEMA)
        if not is_valid:
            return {"type": "error", "error": error}

        action = message.data.get("action")

        if action == "start":
            return await self._handle_start(message.data)
        elif action == "stop":
            return await self._handle_stop()
        elif action == "pause":
            return await self._handle_pause()
        elif action == "resume":
            return await self._handle_resume()
        elif action == "reset":
            return await self._handle_reset()
        elif action == "status":
            return self._get_status()
        else:
            return {"type": "error", "error": f"Unknown action: {action}"}

    async def _handle_start(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Start training with optional config."""
        config = data.get("config", {})
        self.background_trainer.start(config)
        logger.info("Training started")
        return {"type": "training_status", "status": "started"}

    async def _handle_stop(self) -> Dict[str, Any]:
        """Stop training."""
        self.background_trainer.stop()
        logger.info("Training stopped")
        return {"type": "training_status", "status": "stopped"}

    async def _handle_pause(self) -> Dict[str, Any]:
        """Pause training."""
        self.background_trainer.pause()
        return {"type": "training_status", "status": "paused"}

    async def _handle_resume(self) -> Dict[str, Any]:
        """Resume training."""
        self.background_trainer.resume()
        return {"type": "training_status", "status": "resumed"}

    async def _handle_reset(self) -> Dict[str, Any]:
        """Reset model to initial state."""
        result = self.continuous_trainer.full_reset()
        logger.info(f"Model reset: {result}")
        return {"type": "training_status", "status": "reset", "details": result}

    def _get_status(self) -> Dict[str, Any]:
        """Get current training status."""
        return {
            "type": "training_status",
            "status": "active" if self.background_trainer.is_running else "stopped",
            "model_version": self.background_trainer.model_version,
            "iterations": self.continuous_trainer.metadata.total_training_iterations,
            "samples_processed": self.continuous_trainer.metadata.total_samples_ever_processed
        }
```

#### Step 6: Slim down message_handler.py (~150 lines)

**Keep only:**
- MessageHandler class as facade
- Initialization of all handlers
- High-level message dispatch

```python
# server/websocket/message_handler.py (refactored)
"""
WebSocket message handler - main entry point.

Coordinates message parsing, routing, and response generation.
"""

import asyncio
import logging
import time
from typing import Dict, Any, Optional

from .schemas import MessageType, ParsedMessage
from .message_router import MessageRouter
from .handlers.observation_handler import ObservationHandler
from .handlers.training_handler import TrainingHandler
from .handlers.gate_handler import GateHandler
from .handlers.game_state_handler import GameStateHandler
from .handlers.system_handler import SystemHandler

from ai_engine.ai_engine import AIEngine
from ai_engine.nn_model import NNModel
from ai_engine.continuous_trainer import ContinuousTrainer
from ai_engine.background_trainer import BackgroundTrainer
from ai_engine.decision_gate import SimulationGate, PreprocessGate, get_dashboard_metrics

logger = logging.getLogger(__name__)


class MessageHandler:
    """
    Main WebSocket message handler.

    Coordinates all message processing for the AI backend.
    Delegates to specialized handlers for each message type.
    """

    def __init__(self, ai_engine: AIEngine):
        self.ai_engine = ai_engine
        self.router = MessageRouter()

        # Initialize components
        self._init_components()

        # Register handlers
        self._register_handlers()

        # Statistics
        self.message_count = 0
        self.error_count = 0
        self.start_time = time.time()

    def _init_components(self) -> None:
        """Initialize NN model, trainers, and gates."""
        self.nn_model = NNModel()
        self.continuous_trainer = ContinuousTrainer(self.nn_model)
        self.background_trainer = BackgroundTrainer(self.continuous_trainer)
        self.simulation_gate = SimulationGate()
        self.preprocess_gate = PreprocessGate()
        self.dashboard_metrics = get_dashboard_metrics()

    def _register_handlers(self) -> None:
        """Register all message handlers."""
        # Observation handler
        obs_handler = ObservationHandler(
            nn_model=self.nn_model,
            simulation_gate=self.simulation_gate,
            preprocess_gate=self.preprocess_gate,
            feature_extractor=self.ai_engine.feature_extractor
        )
        self.router.register(MessageType.NN_OBSERVATION, obs_handler.handle)

        # Training handler
        training_handler = TrainingHandler(
            continuous_trainer=self.continuous_trainer,
            background_trainer=self.background_trainer
        )
        self.router.register(MessageType.TRAINING_CONTROL, training_handler.handle)

        # Gate handler
        gate_handler = GateHandler(self.simulation_gate)
        self.router.register(MessageType.GATE_EVALUATION, gate_handler.handle)

        # System handler
        system_handler = SystemHandler(self)
        self.router.register(MessageType.SYSTEM_STATUS, system_handler.handle)

    async def handle_message(
        self,
        data: Dict[str, Any],
        client_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Handle an incoming WebSocket message.

        Args:
            data: Raw message data
            client_id: Client identifier

        Returns:
            Response to send back, or None
        """
        self.message_count += 1

        try:
            # Parse message type
            msg_type_str = data.get("type", "unknown")
            try:
                msg_type = MessageType(msg_type_str)
            except ValueError:
                logger.warning(f"Unknown message type: {msg_type_str}")
                return {"type": "error", "error": f"Unknown type: {msg_type_str}"}

            # Create parsed message
            message = ParsedMessage(
                type=msg_type,
                data=data.get("data", data),
                client_id=client_id,
                timestamp=time.time()
            )

            # Route to handler
            return await self.router.route(message)

        except Exception as e:
            self.error_count += 1
            logger.error(f"Message handling error: {e}")
            return {"type": "error", "error": str(e)}

    def get_message_statistics(self) -> Dict[str, Any]:
        """Get message processing statistics."""
        uptime = time.time() - self.start_time
        return {
            "total_messages": self.message_count,
            "error_count": self.error_count,
            "uptime_seconds": uptime,
            "messages_per_second": self.message_count / uptime if uptime > 0 else 0
        }
```

---

### 2. neural_network.py Refactoring (HIGH)

**Current State**: `server/ai_engine/neural_network.py` - 1,940 lines (TensorFlow)
**Target State**: Either remove or split into 4 focused modules

#### Option A: Remove TensorFlow Implementation (Recommended)

Since PyTorch (`nn_model.py`) is the actively used implementation:

1. **Rename `neural_network.py` to `neural_network_tensorflow_legacy.py`**
2. **Add deprecation notice at top of file:**

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

3. **Update main.py imports** to use `nn_model.py` only
4. **Add README note** explaining the choice

#### Option B: Split TensorFlow Implementation (If keeping both)

```
server/ai_engine/neural_network/
├── __init__.py              # Public API
├── base.py                  # Abstract base class (~150 lines)
├── tensorflow_impl.py       # TensorFlow implementation (~800 lines)
├── callbacks.py             # Training callbacks (~300 lines)
├── quantization.py          # Model optimization (~300 lines)
└── model_io.py              # Save/load utilities (~200 lines)
```

**base.py - Abstract Base Class:**

```python
# server/ai_engine/neural_network/base.py
"""
Abstract base class for neural network implementations.

Defines the interface that all NN implementations must follow,
enabling switching between TensorFlow/PyTorch/etc.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from dataclasses import dataclass
import numpy as np


@dataclass
class Prediction:
    """Neural network prediction result."""
    chunk: int
    parasite_type: str
    confidence: float
    raw_output: np.ndarray


@dataclass
class TrainingResult:
    """Result of a training step."""
    loss: float
    accuracy: float
    samples_processed: int


class BaseNeuralNetwork(ABC):
    """Abstract base class for Queen behavior neural networks."""

    @abstractmethod
    def predict(self, features: np.ndarray) -> Prediction:
        """
        Make a spawn prediction from features.

        Args:
            features: Extracted feature vector

        Returns:
            Prediction with chunk, type, and confidence
        """
        pass

    @abstractmethod
    def train_step(
        self,
        features: np.ndarray,
        labels: np.ndarray,
        rewards: np.ndarray
    ) -> TrainingResult:
        """
        Execute one training step.

        Args:
            features: Batch of feature vectors
            labels: Batch of target labels
            rewards: Batch of reward signals

        Returns:
            Training result with loss and metrics
        """
        pass

    @abstractmethod
    def save(self, path: str) -> None:
        """Save model to disk."""
        pass

    @abstractmethod
    def load(self, path: str) -> None:
        """Load model from disk."""
        pass

    @abstractmethod
    def reset(self) -> Dict[str, Any]:
        """Reset model to initial random state."""
        pass

    @property
    @abstractmethod
    def is_gpu_enabled(self) -> bool:
        """Whether GPU acceleration is enabled."""
        pass
```

---

### 3. Duplicate NN Documentation (HIGH)

Create a clear document explaining the NN implementations:

```python
# server/ai_engine/README_NEURAL_NETWORKS.md
"""
# Neural Network Implementations

## Active Implementation: PyTorch (nn_model.py)

The primary neural network implementation uses PyTorch for the following reasons:

1. **Better Debugging**: PyTorch's eager execution makes debugging straightforward
2. **Development Speed**: Faster iteration during model architecture experiments
3. **Community**: Larger research community using PyTorch for RL applications
4. **ONNX Export**: Easy export to ONNX for production deployment if needed

### Usage

```python
from ai_engine.nn_model import NNModel

model = NNModel()
prediction = model.predict(features)
```

## Legacy Implementation: TensorFlow (neural_network_tensorflow_legacy.py)

The TensorFlow implementation is preserved for reference but is NOT actively maintained.

### Why It Exists
- Original implementation before PyTorch migration
- May be useful for TensorFlow Lite deployment in future
- Reference for architecture decisions

### DO NOT USE for new development.

## Architecture

Both implementations share the same architecture:

- Input: 64-dimensional feature vector
- Hidden: 2x256 dense layers with ReLU
- Output: 257 outputs (256 chunks + 1 parasite type selector)

## Model Files

- `models/queen_sequential.pt` - PyTorch model weights
- `models/queen_sequential_metadata.json` - Training metadata
"""
```

---

### 4. Type Hints to Add (MEDIUM)

#### Priority files for type hints:

**ai_engine/feature_extractor.py:**

```python
# Before
def extract(self, observation):
    chunks = observation.get('chunks', {})
    # ...

# After
from typing import Dict, Any, List
import numpy as np

def extract(self, observation: Dict[str, Any]) -> np.ndarray:
    """
    Extract features from a game observation.

    Args:
        observation: Game state observation dict containing:
            - chunks: Dict mapping chunk IDs to entity counts
            - queenEnergy: Current queen energy level
            - hiveChunk: Queen's hive location

    Returns:
        64-dimensional feature vector as numpy array
    """
    chunks: Dict[str, Dict[str, int]] = observation.get('chunks', {})
    # ...
```

**ai_engine/reward_calculator.py:**

```python
# Before
def calculate(self, observation, decision, outcome):
    # ...

# After
from typing import Dict, Any
from dataclasses import dataclass

@dataclass
class RewardComponents:
    """Breakdown of reward calculation."""
    survival: float
    disruption: float
    efficiency: float
    exploration: float
    total: float

def calculate(
    self,
    observation: Dict[str, Any],
    decision: 'GateDecision',
    outcome: 'SpawnOutcome'
) -> RewardComponents:
    """
    Calculate reward for a spawn decision.

    Args:
        observation: Game state when decision was made
        decision: The gate decision that was executed
        outcome: The result of the spawn action

    Returns:
        RewardComponents with detailed breakdown
    """
    # ...
```

**ai_engine/decision_gate/gate.py:**

```python
# Before
def evaluate(self, observation, chunk, parasite_type, confidence):
    # ...

# After
from typing import Dict, Any, List, Optional
from .config import SimulationGateConfig

def evaluate(
    self,
    observation: Dict[str, Any],
    chunk: int,
    parasite_type: str,
    confidence: float
) -> 'GateDecision':
    """
    Evaluate whether a spawn decision should be executed.

    Args:
        observation: Current game state observation
        chunk: Target chunk for spawn (0-399)
        parasite_type: Type of parasite ('energy' or 'combat')
        confidence: NN confidence in decision (0.0-1.0)

    Returns:
        GateDecision with SEND/WAIT decision and reasoning

    Raises:
        ValueError: If chunk is out of range or parasite_type invalid
    """
    # ...
```

---

### 5. Error Handling Standardization

#### Create custom exceptions:

```python
# server/ai_engine/exceptions.py
"""
Custom exceptions for AI engine.

Provides specific exception types for different error categories,
enabling precise error handling and informative error messages.
"""

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

#### Update handlers to use custom exceptions:

```python
# In observation_handler.py
from ai_engine.exceptions import InvalidObservationError, GateEvaluationError

async def handle(self, message: ParsedMessage) -> Optional[Dict[str, Any]]:
    try:
        # ... processing logic
    except InvalidObservationError as e:
        logger.warning(f"Invalid observation: {e}")
        return {
            "type": "error",
            "errorCode": "INVALID_OBSERVATION",
            "error": str(e),
            "field": e.field
        }
    except GateEvaluationError as e:
        logger.error(f"Gate evaluation failed: {e}")
        return {
            "type": "error",
            "errorCode": "GATE_ERROR",
            "error": str(e)
        }
```

---

### 6. Module-Level Docstrings to Add

Add docstrings to files missing them:

```python
# server/ai_engine/continuous_trainer.py
"""
Continuous Training System for Queen Neural Network.

This module implements the continuous training loop that allows the
neural network to learn from ongoing gameplay. Key features:

- Incremental learning from streaming observations
- Experience replay buffer management
- Automatic model checkpointing
- Training metrics tracking

The continuous trainer is designed to run alongside the game,
updating the model without interrupting gameplay.

Example:
    trainer = ContinuousTrainer(model)
    trainer.add_experience(observation, action, reward)
    trainer.train_step()  # Non-blocking

Architecture:
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │ Observations│────▶│   Buffer    │────▶│   Trainer   │
    └─────────────┘     └─────────────┘     └─────────────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │   Model     │
                                            └─────────────┘
"""
```

```python
# server/ai_engine/background_trainer.py
"""
Background Training Thread Manager.

Manages neural network training in a separate thread to prevent
blocking the WebSocket event loop. Features:

- Non-blocking training execution
- Thread-safe model updates
- Graceful shutdown handling
- Training state persistence

The background trainer wraps ContinuousTrainer and executes
training steps in a dedicated thread.

Thread Safety:
    - Model weights are updated atomically
    - Training state is protected by locks
    - Shutdown is coordinated with pending operations
"""
```

---

### 7. Test Coverage Improvements

#### Add message_handler unit tests:

```python
# server/tests/test_message_handler.py
"""
Unit tests for WebSocket message handler.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch

from websocket.message_handler import MessageHandler
from websocket.schemas import MessageType, ParsedMessage


class TestMessageRouter:
    """Tests for message routing logic."""

    def test_route_unknown_type(self):
        """Unknown message types return error."""
        router = MessageRouter()
        message = ParsedMessage(
            type=None,  # Unknown
            data={},
            client_id="test",
            timestamp=0
        )

        result = asyncio.run(router.route(message))

        assert result["type"] == "error"
        assert "UNKNOWN_MESSAGE_TYPE" in result["errorCode"]

    def test_handler_registration(self):
        """Handlers can be registered and invoked."""
        router = MessageRouter()
        mock_handler = AsyncMock(return_value={"status": "ok"})

        router.register(MessageType.NN_OBSERVATION, mock_handler)

        message = ParsedMessage(
            type=MessageType.NN_OBSERVATION,
            data={"test": True},
            client_id="test",
            timestamp=0
        )

        result = asyncio.run(router.route(message))

        mock_handler.assert_called_once_with(message)
        assert result["status"] == "ok"


class TestObservationHandler:
    """Tests for observation processing."""

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

    def test_valid_observation_returns_spawn(self, handler):
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

        result = asyncio.run(handler.handle(message))

        assert result["type"] == "nn_decision"
        assert result["action"] == "spawn"
        assert result["spawnChunk"] == 50

    def test_invalid_observation_returns_error(self, handler):
        """Invalid observation returns error response."""
        message = ParsedMessage(
            type=MessageType.NN_OBSERVATION,
            data={"invalid": "data"},  # Missing required fields
            client_id="test",
            timestamp=0
        )

        result = asyncio.run(handler.handle(message))

        assert result["type"] == "error"


class TestTrainingHandler:
    """Tests for training control messages."""

    def test_start_training(self):
        """Start action begins training."""
        trainer = Mock()
        background = Mock()
        handler = TrainingHandler(trainer, background)

        message = ParsedMessage(
            type=MessageType.TRAINING_CONTROL,
            data={"action": "start"},
            client_id="test",
            timestamp=0
        )

        result = asyncio.run(handler.handle(message))

        background.start.assert_called_once()
        assert result["status"] == "started"

    def test_reset_model(self):
        """Reset action resets model to initial state."""
        trainer = Mock()
        trainer.full_reset.return_value = {"status": "reset"}
        handler = TrainingHandler(trainer, Mock())

        message = ParsedMessage(
            type=MessageType.TRAINING_CONTROL,
            data={"action": "reset"},
            client_id="test",
            timestamp=0
        )

        result = asyncio.run(handler.handle(message))

        trainer.full_reset.assert_called_once()
        assert result["status"] == "reset"
```

---

### Summary Checklist

#### CRITICAL (Must complete before submission)
- [ ] Split `message_handler.py` into router + handlers
- [ ] Create `server/websocket/handlers/` directory structure
- [ ] Extract `schemas.py` with message validation
- [ ] Update all imports in `main.py`
- [ ] Verify all tests pass after refactoring

#### HIGH (Complete if time permits)
- [ ] Add deprecation notice to `neural_network.py` (TensorFlow)
- [ ] Create `README_NEURAL_NETWORKS.md` explaining NN choice
- [ ] Add type hints to `feature_extractor.py`, `reward_calculator.py`
- [ ] Add type hints to `decision_gate/gate.py`

#### MEDIUM (Nice to have)
- [ ] Create `ai_engine/exceptions.py` with custom exceptions
- [ ] Add module-level docstrings to trainers
- [ ] Reorganize `ai_engine/` into subdirectories
- [ ] Add unit tests for message handlers

#### Documentation
- [ ] Add docstrings to all new modules
- [ ] Update API documentation
- [ ] Add inline comments explaining complex logic
