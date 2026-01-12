"""
Test WebSocket Communication Protocol
Tests message validation, serialization, and error handling
"""

import asyncio
import json
import pytest
import websockets
from unittest.mock import Mock, AsyncMock

from websocket.message_handler import MessageHandler
from websocket.connection_manager import ConnectionManager, MessageQueue
from ai_engine.ai_engine import AIEngine


class TestMessageQueue:
    """Test message queue functionality"""
    
    def test_message_queue_basic_operations(self):
        """Test basic queue operations"""
        queue = MessageQueue(max_size=3)
        
        # Test empty queue
        assert queue.size() == 0
        assert queue.get_all_messages() == []
        
        # Add messages
        queue.add_message({"type": "test1", "data": "message1"})
        queue.add_message({"type": "test2", "data": "message2"})
        
        assert queue.size() == 2
        messages = queue.get_all_messages()
        assert len(messages) == 2
        assert messages[0]["type"] == "test1"
        assert messages[1]["type"] == "test2"
        
        # Test max size limit
        queue.add_message({"type": "test3", "data": "message3"})
        queue.add_message({"type": "test4", "data": "message4"})  # Should evict first message
        
        assert queue.size() == 3
        messages = queue.get_all_messages()
        assert messages[0]["type"] == "test2"  # First message evicted
        assert messages[2]["type"] == "test4"
        
        # Clear queue
        queue.clear()
        assert queue.size() == 0
    
    def test_message_queue_timestamp_filtering(self):
        """Test timestamp-based message filtering"""
        queue = MessageQueue()
        
        # Add messages with different timestamps
        import time
        base_time = time.time()
        
        queue.add_message({"type": "old", "data": "old_message"})
        # Manually set timestamp for testing
        queue.messages[0]["queued_at"] = base_time - 100
        
        queue.add_message({"type": "new", "data": "new_message"})
        queue.messages[1]["queued_at"] = base_time + 100
        
        # Get messages since base_time
        recent_messages = queue.get_messages_since(base_time)
        assert len(recent_messages) == 1
        assert recent_messages[0]["type"] == "new"


class TestMessageHandler:
    """Test message handler functionality"""
    
    @pytest.fixture
    def mock_ai_engine(self):
        """Create mock AI engine"""
        ai_engine = Mock(spec=AIEngine)
        ai_engine.initialized = True
        ai_engine.neural_network = Mock()
        ai_engine.neural_network.use_gpu = False
        ai_engine.process_queen_death = AsyncMock(return_value={
            "type": "queen_strategy",
            "data": {"generation": 2, "strategies": {}}
        })
        ai_engine.process_queen_success = AsyncMock(return_value={
            "type": "success_training_result",
            "data": {"generation": 1}
        })
        ai_engine.get_learning_progress = AsyncMock(return_value={
            "type": "learning_progress",
            "data": {"progress": 0.5}
        })
        return ai_engine
    
    @pytest.fixture
    def message_handler(self, mock_ai_engine):
        """Create message handler with mock AI engine"""
        return MessageHandler(mock_ai_engine)
    
    def test_message_validation_schemas(self, message_handler):
        """Test message validation against schemas"""
        # Valid queen death message
        valid_death_message = {
            "type": "queen_death",
            "data": {
                "queenId": "queen_123",
                "generation": 1,
                "deathLocation": {"x": 10.0, "y": 5.0, "z": 15.0},
                "deathCause": "protector_assault",
                "survivalTime": 120.5,
                "parasitesSpawned": 5,
                "hiveDiscoveryTime": 60.0,
                "playerUnits": {},
                "assaultPattern": {},
                "gameState": {}
            }
        }
        
        result = message_handler._validate_message(valid_death_message)
        assert result["valid"] is True
        assert result["error"] is None
        
        # Invalid message - missing required field
        invalid_message = {
            "type": "queen_death",
            "data": {
                "queenId": "queen_123",
                # Missing generation
                "deathLocation": {"x": 10.0, "y": 5.0, "z": 15.0},
                "deathCause": "protector_assault"
            }
        }
        
        result = message_handler._validate_message(invalid_message)
        assert result["valid"] is False
        assert "generation" in result["error"]
        
        # Invalid message - wrong enum value
        invalid_enum_message = {
            "type": "queen_death",
            "data": {
                "queenId": "queen_123",
                "generation": 1,
                "deathLocation": {"x": 10.0, "y": 5.0, "z": 15.0},
                "deathCause": "invalid_cause",  # Not in enum
                "survivalTime": 120.5,
                "parasitesSpawned": 5,
                "hiveDiscoveryTime": 60.0,
                "playerUnits": {},
                "assaultPattern": {},
                "gameState": {}
            }
        }
        
        result = message_handler._validate_message(invalid_enum_message)
        assert result["valid"] is False
        assert "invalid_cause" in result["error"]
    
    def test_business_logic_validation(self, message_handler):
        """Test business logic validation"""
        # Valid data
        valid_data = {
            "queenId": "queen_123",
            "generation": 5,
            "survivalTime": 300.0,
            "parasitesSpawned": 10,
            "hiveDiscoveryTime": 150.0
        }
        
        errors = message_handler._validate_death_data_business_logic(valid_data)
        assert len(errors) == 0
        
        # Invalid data - negative survival time
        invalid_data = {
            "queenId": "queen_123",
            "generation": 5,
            "survivalTime": -10.0,  # Invalid
            "parasitesSpawned": 10,
            "hiveDiscoveryTime": 150.0
        }
        
        errors = message_handler._validate_death_data_business_logic(invalid_data)
        assert len(errors) > 0
        assert any("negative" in error.lower() for error in errors)
        
        # Invalid data - hive discovery time > survival time
        invalid_timing_data = {
            "queenId": "queen_123",
            "generation": 5,
            "survivalTime": 100.0,
            "parasitesSpawned": 10,
            "hiveDiscoveryTime": 200.0  # Greater than survival time
        }
        
        errors = message_handler._validate_death_data_business_logic(invalid_timing_data)
        assert len(errors) > 0
        assert any("discovery time" in error.lower() for error in errors)
    
    @pytest.mark.asyncio
    async def test_message_handling_success(self, message_handler, mock_ai_engine):
        """Test successful message handling"""
        valid_message = {
            "type": "queen_death",
            "data": {
                "queenId": "queen_123",
                "generation": 1,
                "deathLocation": {"x": 10.0, "y": 5.0, "z": 15.0},
                "deathCause": "protector_assault",
                "survivalTime": 120.5,
                "parasitesSpawned": 5,
                "hiveDiscoveryTime": 60.0,
                "playerUnits": {},
                "assaultPattern": {},
                "gameState": {}
            }
        }
        
        response = await message_handler.handle_message(valid_message, "client_123")
        
        assert response is not None
        assert response["type"] == "queen_strategy"
        assert "messageId" in response
        assert "clientId" in response
        assert response["clientId"] == "client_123"
        
        # Verify AI engine was called
        mock_ai_engine.process_queen_death.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_message_handling_validation_error(self, message_handler):
        """Test message handling with validation errors"""
        invalid_message = {
            "type": "queen_death",
            "data": {
                "queenId": "queen_123"
                # Missing required fields
            }
        }
        
        response = await message_handler.handle_message(invalid_message, "client_123")
        
        assert response is not None
        assert response["type"] == "error"
        assert response["data"]["errorCode"] == "VALIDATION_ERROR"
        assert "validation failed" in response["data"]["error"].lower()
    
    @pytest.mark.asyncio
    async def test_ping_pong(self, message_handler):
        """Test ping-pong functionality"""
        ping_message = {
            "type": "ping",
            "timestamp": 1234567890.0
        }
        
        response = await message_handler.handle_message(ping_message, "client_123")
        
        assert response is not None
        assert response["type"] == "pong"
        assert response["data"]["clientId"] == "client_123"
        assert response["data"]["serverStatus"] == "healthy"
        assert "responseTime" in response["data"]
        assert "messageStats" in response["data"]
    
    @pytest.mark.asyncio
    async def test_health_check(self, message_handler):
        """Test health check functionality"""
        health_message = {"type": "health_check"}
        
        response = await message_handler.handle_message(health_message, "client_123")
        
        assert response is not None
        assert response["type"] == "health_response"
        assert response["data"]["status"] == "healthy"
        assert response["data"]["aiEngine"] == "running"
        assert "messageHandler" in response["data"]
        assert "systemInfo" in response["data"]
    
    def test_message_serialization(self, message_handler):
        """Test message serialization and deserialization"""
        test_message = {
            "type": "test",
            "timestamp": 1234567890.0,
            "data": {"key": "value", "number": 42}
        }
        
        # Test serialization
        json_str = message_handler.serialize_message(test_message)
        assert isinstance(json_str, str)
        
        # Test deserialization
        deserialized = message_handler.deserialize_message(json_str)
        assert deserialized["type"] == "test"
        assert deserialized["data"]["key"] == "value"
        assert deserialized["data"]["number"] == 42
        
        # Test invalid JSON
        invalid_json = "{ invalid json }"
        error_response = message_handler.deserialize_message(invalid_json)
        assert error_response["type"] == "error"
        assert error_response["data"]["errorCode"] == "DESERIALIZATION_ERROR"
    
    def test_message_statistics(self, message_handler):
        """Test message statistics tracking"""
        # Initial stats
        stats = message_handler.get_message_statistics()
        assert stats["statistics"]["total_processed"] == 0
        assert stats["success_rate"] == 0.0
        
        # Simulate some message processing
        message_handler.message_stats["total_processed"] = 10
        message_handler.message_stats["successful"] = 8
        message_handler.message_stats["failed"] = 2
        
        stats = message_handler.get_message_statistics()
        assert stats["statistics"]["total_processed"] == 10
        assert stats["success_rate"] == 80.0
        assert "supported_message_types" in stats


class TestConnectionManager:
    """Test connection manager functionality"""
    
    @pytest.fixture
    def connection_manager(self):
        """Create connection manager for testing"""
        return ConnectionManager(
            connection_timeout=60,
            heartbeat_interval=10,
            max_queue_size=50
        )
    
    @pytest.mark.asyncio
    async def test_connection_lifecycle(self, connection_manager):
        """Test connection lifecycle management"""
        # Mock WebSocket
        mock_websocket = Mock()
        mock_websocket.accept = AsyncMock()
        mock_websocket.send_json = AsyncMock()
        mock_websocket.close = AsyncMock()
        
        # Test connection
        client_id = await connection_manager.connect(mock_websocket, "test_client")
        assert client_id == "test_client"
        assert "test_client" in connection_manager.active_connections
        assert "test_client" in connection_manager.connection_metadata
        assert "test_client" in connection_manager.message_queues
        
        # Test connection info
        info = connection_manager.get_connection_info()
        assert info["total_connections"] == 1
        assert "test_client" in info["connections"]
        assert info["connections"]["test_client"]["is_active"] is True
        
        # Test disconnection
        await connection_manager._handle_disconnection("test_client")
        assert "test_client" not in connection_manager.active_connections
        assert connection_manager.connection_metadata["test_client"]["status"] == "disconnected"
    
    @pytest.mark.asyncio
    async def test_message_queuing(self, connection_manager):
        """Test message queuing for offline clients"""
        # Create client and then disconnect
        mock_websocket = Mock()
        mock_websocket.accept = AsyncMock()
        mock_websocket.send_json = AsyncMock()
        
        client_id = await connection_manager.connect(mock_websocket, "test_client")
        await connection_manager._handle_disconnection("test_client")
        
        # Send message to offline client (should be queued)
        test_message = {"type": "test", "data": "queued_message"}
        success = await connection_manager.send_personal_message(
            test_message, "test_client", queue_if_offline=True
        )
        
        assert success is True  # Message was queued
        
        # Check queue
        queue_info = connection_manager.get_client_queue_info("test_client")
        assert queue_info["queue_size"] == 1
        assert queue_info["messages"][0]["type"] == "test"
        
        # Reconnect and send queued messages
        mock_websocket.send_json.reset_mock()
        await connection_manager.connect(mock_websocket, "test_client")
        sent_count = await connection_manager.send_queued_messages("test_client")
        
        assert sent_count == 1
        mock_websocket.send_json.assert_called()
    
    @pytest.mark.asyncio
    async def test_broadcast_functionality(self, connection_manager):
        """Test broadcast message functionality"""
        # Create multiple mock connections
        clients = []
        for i in range(3):
            mock_websocket = Mock()
            mock_websocket.accept = AsyncMock()
            mock_websocket.send_json = AsyncMock()
            client_id = await connection_manager.connect(mock_websocket, f"client_{i}")
            clients.append((client_id, mock_websocket))
        
        # Broadcast message
        broadcast_message = {"type": "broadcast", "data": "test_broadcast"}
        await connection_manager.broadcast(broadcast_message)
        
        # Verify all clients received the message
        for client_id, mock_websocket in clients:
            mock_websocket.send_json.assert_called_with(broadcast_message)
        
        # Test broadcast with exclusions
        mock_websocket.send_json.reset_mock()
        await connection_manager.broadcast(
            broadcast_message, 
            exclude_clients=["client_0"]
        )
        
        # Verify client_0 was excluded
        clients[0][1].send_json.assert_not_called()
        clients[1][1].send_json.assert_called_with(broadcast_message)
        clients[2][1].send_json.assert_called_with(broadcast_message)
    
    @pytest.mark.asyncio
    async def test_cleanup_stale_connections(self, connection_manager):
        """Test cleanup of stale connections"""
        # Create connection
        mock_websocket = Mock()
        mock_websocket.accept = AsyncMock()
        client_id = await connection_manager.connect(mock_websocket, "stale_client")
        
        # Manually set old last_activity
        import time
        old_time = time.time() - 1000  # 1000 seconds ago
        connection_manager.connection_metadata["stale_client"]["last_activity"] = old_time
        
        # Run cleanup with 500 second timeout
        cleaned_count = await connection_manager.cleanup_stale_connections(500)
        
        assert cleaned_count == 1
        assert "stale_client" not in connection_manager.active_connections
        assert "stale_client" not in connection_manager.connection_metadata
    
    @pytest.mark.asyncio
    async def test_shutdown(self, connection_manager):
        """Test graceful shutdown"""
        # Create some connections
        for i in range(2):
            mock_websocket = Mock()
            mock_websocket.accept = AsyncMock()
            mock_websocket.close = AsyncMock()
            await connection_manager.connect(mock_websocket, f"client_{i}")
        
        # Shutdown
        await connection_manager.shutdown()
        
        # Verify cleanup
        assert len(connection_manager.active_connections) == 0
        assert len(connection_manager.connection_metadata) == 0
        assert len(connection_manager.message_queues) == 0


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])