"""
Unit tests for WebSocket message handlers.

Tests the refactored handler modules:
- MessageRouter
- ObservationHandler
- TrainingHandler
- GateHandler
- GameStateHandler
- SystemHandler
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any

from websocket.message_router import MessageRouter
from websocket.schemas import MessageType, ParsedMessage, validate_message
from websocket.handlers.observation_handler import ObservationHandler
from websocket.handlers.training_handler import TrainingHandler
from websocket.handlers.gate_handler import GateHandler
from websocket.handlers.game_state_handler import GameStateHandler
from websocket.handlers.system_handler import SystemHandler


class TestMessageRouter:
    """Tests for message routing logic."""

    def test_route_unknown_type(self):
        """Unknown message types return error."""
        router = MessageRouter()

        result = asyncio.run(router.route_raw("unknown_type", {}, "test_client"))

        assert result["type"] == "error"
        assert "Unknown message type" in result.get("error", result.get("data", {}).get("error", ""))

    def test_handler_registration_string(self):
        """Handlers can be registered with string type and invoked."""
        router = MessageRouter()
        mock_handler = AsyncMock(return_value={"status": "ok"})

        router.register("test_type", mock_handler)
        result = asyncio.run(router.route_raw("test_type", {"data": "test"}, "client1"))

        mock_handler.assert_called_once()
        assert result["status"] == "ok"

    def test_handler_registration_enum(self):
        """Handlers can be registered with enum type and invoked."""
        router = MessageRouter()
        mock_handler = AsyncMock(return_value={"type": "response"})

        router.register_typed(MessageType.OBSERVATION_DATA, mock_handler)

        # Create a parsed message
        message = ParsedMessage(
            type=MessageType.OBSERVATION_DATA,
            data={"chunks": {}},
            client_id="test",
            timestamp=0
        )

        result = asyncio.run(router.route(message))
        assert result["type"] == "response"

    def test_multiple_handlers(self):
        """Multiple handlers can be registered for different types."""
        router = MessageRouter()
        handler1 = AsyncMock(return_value={"handler": 1})
        handler2 = AsyncMock(return_value={"handler": 2})

        router.register("type_a", handler1)
        router.register("type_b", handler2)

        result1 = asyncio.run(router.route_raw("type_a", {}, "client"))
        result2 = asyncio.run(router.route_raw("type_b", {}, "client"))

        assert result1["handler"] == 1
        assert result2["handler"] == 2

    def test_handler_exception_returns_error(self):
        """Handler exceptions are caught and returned as error responses."""
        router = MessageRouter()

        async def failing_handler(msg, client_id):
            raise ValueError("Test error")

        router.register("failing", failing_handler)
        result = asyncio.run(router.route_raw("failing", {}, "client"))

        assert result["type"] == "error"
        error_msg = result.get("error", result.get("data", {}).get("error", ""))
        assert "Test error" in error_msg


class TestSchemaValidation:
    """Tests for message schema validation."""

    def test_valid_message(self):
        """Valid messages pass basic validation (type exists)."""
        message = {
            "type": "ping",  # Simple message type that just needs type field
            "data": {}
        }

        is_valid, error = validate_message(message)
        assert is_valid is True

    def test_missing_type(self):
        """Messages without type field fail validation."""
        message = {"data": {"test": True}}

        is_valid, error = validate_message(message)
        assert not is_valid
        assert "type" in error.lower()

    def test_empty_message(self):
        """Empty messages fail validation."""
        is_valid, error = validate_message({})
        assert not is_valid


class TestObservationHandler:
    """Tests for observation processing."""

    @pytest.fixture
    def mock_components(self):
        """Create mocked handler dependencies."""
        # Mock feature extractor
        feature_extractor = Mock()
        feature_extractor.extract.return_value = [0.0] * 29

        # Mock NN model
        nn_model = Mock()
        nn_model.get_spawn_decision.return_value = {
            'nnDecision': 'spawn',
            'spawnChunk': 50,
            'spawnType': 'energy',
            'confidence': 0.8,
            'typeConfidence': 0.9
        }
        nn_model.get_distribution_stats.return_value = {
            'entropy': 0.5,
            'max_entropy': 1.0,
            'effective_actions': 10
        }

        # Mock reward calculator
        reward_calculator = Mock()
        reward_calculator.calculate_reward.return_value = {
            'reward': 0.5,
            'components': {}
        }

        # Mock simulation gate
        simulation_gate = Mock()
        gate_decision = Mock()
        gate_decision.decision = 'SEND'
        gate_decision.reason = 'positive_reward'
        gate_decision.expected_reward = 0.6
        simulation_gate.evaluate.return_value = gate_decision
        simulation_gate.config = Mock()
        simulation_gate.config.reward_threshold = 0.0

        # Mock preprocess gate
        preprocess_gate = Mock()
        preprocess_decision = Mock()
        preprocess_decision.should_skip = False
        preprocess_gate.evaluate.return_value = preprocess_decision

        # Mock replay buffer
        replay_buffer = Mock()
        replay_buffer.add.return_value = None

        # Mock background trainer
        background_trainer = Mock()
        background_trainer.model_version = 1

        # Mock config
        nn_config = Mock()
        nn_config.spawn_gating = Mock()
        nn_config.spawn_gating.confidence_threshold = 0.5
        nn_config.spawn_gating.exploration_rate = 0.1

        # Mock dashboard metrics
        dashboard = Mock()
        get_dashboard_metrics_func = Mock(return_value=dashboard)

        return {
            'feature_extractor': feature_extractor,
            'nn_model': nn_model,
            'reward_calculator': reward_calculator,
            'simulation_gate': simulation_gate,
            'preprocess_gate': preprocess_gate,
            'replay_buffer': replay_buffer,
            'background_trainer': background_trainer,
            'nn_config': nn_config,
            'get_dashboard_metrics_func': get_dashboard_metrics_func
        }

    def test_missing_observation_data(self, mock_components):
        """Missing observation data returns error."""
        handler = ObservationHandler(**mock_components)

        message = {"type": "observation_data", "data": None}
        result = asyncio.run(handler.handle_raw(message, "client1"))

        assert result["type"] == "error"
        assert "INVALID_OBSERVATION" in result["data"]["errorCode"]

    def test_missing_nn_model(self, mock_components):
        """Missing NN model returns error."""
        mock_components['nn_model'] = None
        handler = ObservationHandler(**mock_components)

        message = {"type": "observation_data", "data": {"territoryId": "test"}}
        result = asyncio.run(handler.handle_raw(message, "client1"))

        assert result["type"] == "error"
        assert "MODEL_NOT_INITIALIZED" in result["data"]["errorCode"]

    def test_valid_observation_returns_spawn_decision(self, mock_components):
        """Valid observation with SEND gate decision returns spawn action."""
        handler = ObservationHandler(**mock_components)

        observation = {
            "territoryId": "test-territory",
            "workersPresent": [{"chunkId": 50}],
            "miningWorkers": [],
            "protectors": [],
            "parasitesStart": [],
            "parasitesEnd": [],
            "queenEnergy": {"current": 80},
            "playerEnergy": {"start": 100, "end": 95},
            "playerMinerals": {"start": 500, "end": 490}
        }

        message = {"type": "observation_data", "data": observation}
        result = asyncio.run(handler.handle_raw(message, "client1"))

        assert result["type"] == "spawn_decision"
        assert result["data"]["spawnChunk"] == 50

    def test_preprocess_gate_skip(self, mock_components):
        """Preprocess gate skip returns wait decision."""
        preprocess_decision = Mock()
        preprocess_decision.should_skip = True
        preprocess_decision.reason = "no_workers_present"
        preprocess_decision.workers_count = 0
        preprocess_decision.protectors_count = 0
        mock_components['preprocess_gate'].evaluate.return_value = preprocess_decision

        handler = ObservationHandler(**mock_components)

        observation = {
            "territoryId": "test",
            "workersPresent": [],
            "miningWorkers": [],
            "protectors": [],
            "parasitesStart": [],
            "parasitesEnd": [],
            "queenEnergy": {"current": 80},
            "playerEnergy": {"start": 100, "end": 100},
            "playerMinerals": {"start": 500, "end": 500}
        }

        message = {"type": "observation_data", "data": observation}
        result = asyncio.run(handler.handle_raw(message, "client1"))

        assert result["type"] == "spawn_decision"
        assert result["data"]["skipped"] is True


class TestTrainingHandler:
    """Tests for training control messages."""

    @pytest.fixture
    def handler(self):
        """Create handler with mocked trainers."""
        continuous_trainer = Mock()
        continuous_trainer.get_stats.return_value = {
            "training_count": 10,
            "total_samples_processed": 1000,
            "strategy_version": 5,
            "buffer_size": 500,
            "last_training_loss": 0.01,
            "model_parameters": 12345,
            "config": {}
        }
        continuous_trainer.full_reset.return_value = {
            "status": "reset_complete",
            "previous_version": 5,
            "new_version": 6
        }

        background_trainer = Mock()
        background_trainer.is_running = True
        background_trainer.model_version = 5
        background_trainer.get_metrics.return_value = {
            "model_version": 5,
            "is_running": True,
            "buffer": {"size": 500, "capacity": 10000},
            "training": {"iterations": 10, "last_loss": 0.01}
        }

        return TrainingHandler(continuous_trainer, background_trainer)

    def test_training_status_request(self, handler):
        """Training status request returns stats."""
        message = {"type": "training_status_request", "data": {}}
        result = asyncio.run(handler.handle_training_status(message, "client1"))

        assert result["type"] == "training_status"
        assert result["data"]["status"] == "active"
        assert result["data"]["trainingCount"] == 10

    def test_reset_nn_requires_confirmation(self, handler):
        """Reset NN requires confirmation flag."""
        message = {"type": "reset_nn", "data": {}}
        result = asyncio.run(handler.handle_reset_nn(message, "client1"))

        assert result["type"] == "reset_nn_response"
        assert result["data"]["status"] == "confirmation_required"

    def test_reset_nn_with_confirmation(self, handler):
        """Reset NN with confirmation performs reset."""
        message = {"type": "reset_nn", "data": {"confirm": True}}
        result = asyncio.run(handler.handle_reset_nn(message, "client1"))

        assert result["type"] == "reset_nn_response"
        assert result["data"]["status"] == "reset_complete"

    def test_background_training_stats(self, handler):
        """Background training stats request returns metrics."""
        message = {"type": "background_training_stats_request", "data": {}}
        result = asyncio.run(handler.handle_background_training_stats(message, "client1"))

        assert result["type"] == "background_training_stats_response"
        assert result["data"]["status"] == "active"
        assert result["data"]["model_version"] == 5


class TestGateHandler:
    """Tests for gate handler messages."""

    @pytest.fixture
    def handler(self):
        """Create handler with mocked gate."""
        simulation_gate = Mock()
        simulation_gate.get_statistics.return_value = {
            "total_evaluations": 100,
            "send_decisions": 60,
            "wait_decisions": 40,
            "send_rate": 0.6
        }

        replay_buffer = Mock()

        def get_thinking_stats():
            return {
                "observations_since_last_action": 5,
                "total_gate_evaluations": 100,
                "gate_passes": 60
            }

        return GateHandler(simulation_gate, replay_buffer, get_thinking_stats)

    def test_gate_stats_request(self, handler):
        """Gate stats request returns statistics."""
        message = {"type": "gate_stats_request", "data": {}}
        result = asyncio.run(handler.handle_gate_stats_request(message, "client1"))

        assert result["type"] == "gate_stats_response"
        assert result["data"]["total_evaluations"] == 100
        assert "thinking_loop" in result["data"]

    def test_spawn_result_success(self, handler):
        """Spawn result success returns nothing."""
        message = {
            "type": "spawn_result",
            "success": True,
            "spawnChunk": 50,
            "spawnType": "energy"
        }
        result = asyncio.run(handler.handle_spawn_result(message, "client1"))

        assert result is None

    def test_spawn_result_failure(self, handler):
        """Spawn result failure updates buffer."""
        message = {
            "type": "spawn_result",
            "success": False,
            "spawnChunk": 50,
            "spawnType": "energy",
            "reason": "insufficient_energy"
        }
        result = asyncio.run(handler.handle_spawn_result(message, "client1"))

        # Should return None (no response needed)
        assert result is None


class TestGameStateHandler:
    """Tests for game state handler messages."""

    @pytest.fixture
    def handler(self):
        """Create handler with mocked AI engine."""
        ai_engine = Mock()
        ai_engine.process_queen_death = AsyncMock(return_value={
            "type": "queen_death_response",
            "data": {"processed": True}
        })
        ai_engine.process_queen_success = AsyncMock(return_value={
            "type": "queen_success_response",
            "data": {"processed": True}
        })
        ai_engine.process_game_outcome = AsyncMock(return_value={
            "type": "game_outcome_response",
            "data": {"difficulty_adjusted": True}
        })

        return GameStateHandler(ai_engine)

    def test_queen_death_missing_data(self, handler):
        """Queen death with missing data returns error."""
        message = {"type": "queen_death", "data": None}
        result = asyncio.run(handler.handle_queen_death(message, "client1"))

        assert result["type"] == "error"
        assert "MISSING_DATA" in result["data"]["errorCode"]

    def test_queen_death_valid(self, handler):
        """Queen death with valid data processes successfully."""
        message = {
            "type": "queen_death",
            "data": {
                "queenId": "q1",
                "generation": 5,
                "survivalTime": 120.5,
                "finalEnergy": 10,
                "causeOfDeath": "starvation"
            }
        }
        result = asyncio.run(handler.handle_queen_death(message, "client1"))

        assert result["type"] == "queen_death_response"
        assert result["data"]["processed"] is True

    def test_queen_success_valid(self, handler):
        """Queen success with valid data processes successfully."""
        message = {
            "type": "queen_success",
            "data": {
                "queenId": "q1",
                "generation": 5
            }
        }
        result = asyncio.run(handler.handle_queen_success(message, "client1"))

        assert result["type"] == "queen_success_response"


class TestSystemHandler:
    """Tests for system handler messages."""

    @pytest.fixture
    def handler(self):
        """Create handler with mocked AI engine."""
        ai_engine = Mock()
        ai_engine.initialized = True
        ai_engine.neural_network = Mock()
        ai_engine.neural_network.use_gpu = False

        message_handlers = ["ping", "health_check", "observation_data"]

        def get_message_stats():
            return {
                "total_processed": 100,
                "successful": 95,
                "failed": 5
            }

        return SystemHandler(ai_engine, message_handlers, get_message_stats)

    def test_ping_returns_pong(self, handler):
        """Ping message returns pong response."""
        message = {"type": "ping", "timestamp": 1000.0}
        result = asyncio.run(handler.handle_ping(message, "client1"))

        assert result["type"] == "pong"
        assert result["data"]["clientId"] == "client1"
        assert result["data"]["serverStatus"] == "healthy"

    def test_health_check(self, handler):
        """Health check returns system status."""
        message = {"type": "health_check", "data": {}}
        result = asyncio.run(handler.handle_health_check(message, "client1"))

        assert result["type"] == "health_response"
        assert result["data"]["status"] == "healthy"
        assert result["data"]["aiEngine"] == "running"

    def test_reconnect(self, handler):
        """Reconnect message returns acknowledgement."""
        message = {"type": "reconnect", "data": {"previousSessionId": "old-123"}}
        result = asyncio.run(handler.handle_reconnect(message, "client1"))

        assert result["type"] == "reconnect_response"
        assert result["data"]["clientId"] == "client1"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
