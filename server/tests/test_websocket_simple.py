"""
Simple WebSocket Protocol Tests
Tests core message validation and queue functionality without external dependencies
"""

import asyncio
import json
import sys
import os

# Add server directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

# Mock external dependencies
class MockWebSocket:
    def __init__(self):
        self.messages = []
        self.closed = False
    
    async def accept(self):
        pass
    
    async def send_json(self, message):
        self.messages.append(message)
    
    async def close(self):
        self.closed = True

class MockAIEngine:
    def __init__(self):
        self.initialized = True
        self.neural_network = MockNeuralNetwork()
    
    async def process_queen_death(self, death_data):
        return {
            "type": "queen_strategy",
            "timestamp": 1234567890.0,
            "data": {
                "queenId": death_data["queenId"],
                "generation": death_data["generation"] + 1,
                "strategies": {"test": "strategy"}
            }
        }
    
    async def get_learning_progress(self, queen_id):
        return {
            "type": "learning_progress",
            "data": {"queenId": queen_id, "progress": 0.5}
        }

class MockNeuralNetwork:
    def __init__(self):
        self.use_gpu = False

# Mock FastAPI WebSocket
sys.modules['fastapi'] = type('MockModule', (), {'WebSocket': MockWebSocket})()

# Now import our modules
from websocket.message_handler import MessageHandler
from websocket.connection_manager import MessageQueue


def test_message_queue():
    """Test message queue functionality"""
    print("Testing MessageQueue...")
    
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
    
    # Test max size limit
    queue.add_message({"type": "test3", "data": "message3"})
    queue.add_message({"type": "test4", "data": "message4"})  # Should evict first message
    
    assert queue.size() == 3
    messages = queue.get_all_messages()
    assert messages[0]["type"] == "test2"  # First message evicted
    
    print("✓ MessageQueue tests passed")


def test_message_validation():
    """Test message validation"""
    print("Testing message validation...")
    
    ai_engine = MockAIEngine()
    handler = MessageHandler(ai_engine)
    
    # Valid queen death message
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
    
    result = handler._validate_message(valid_message)
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
    
    result = handler._validate_message(invalid_message)
    assert result["valid"] is False
    assert "generation" in result["error"]
    
    print("✓ Message validation tests passed")


def test_business_logic_validation():
    """Test business logic validation"""
    print("Testing business logic validation...")
    
    ai_engine = MockAIEngine()
    handler = MessageHandler(ai_engine)
    
    # Valid data
    valid_data = {
        "queenId": "queen_123",
        "generation": 5,
        "survivalTime": 300.0,
        "parasitesSpawned": 10,
        "hiveDiscoveryTime": 150.0
    }
    
    errors = handler._validate_death_data_business_logic(valid_data)
    assert len(errors) == 0
    
    # Invalid data - negative survival time
    invalid_data = {
        "queenId": "queen_123",
        "generation": 5,
        "survivalTime": -10.0,  # Invalid
        "parasitesSpawned": 10,
        "hiveDiscoveryTime": 150.0
    }
    
    errors = handler._validate_death_data_business_logic(invalid_data)
    assert len(errors) > 0
    assert any("negative" in error.lower() for error in errors)
    
    print("✓ Business logic validation tests passed")


async def test_message_handling():
    """Test message handling"""
    print("Testing message handling...")
    
    ai_engine = MockAIEngine()
    handler = MessageHandler(ai_engine)
    
    # Test valid message handling
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
    
    response = await handler.handle_message(valid_message, "client_123")
    
    assert response is not None
    assert response["type"] == "queen_strategy"
    assert "messageId" in response
    assert "clientId" in response
    assert response["clientId"] == "client_123"
    
    # Test ping-pong
    ping_message = {
        "type": "ping",
        "timestamp": 1234567890.0
    }
    
    response = await handler.handle_message(ping_message, "client_123")
    
    assert response is not None
    assert response["type"] == "pong"
    assert response["data"]["clientId"] == "client_123"
    assert response["data"]["serverStatus"] == "healthy"
    
    print("✓ Message handling tests passed")


def test_message_serialization():
    """Test message serialization"""
    print("Testing message serialization...")
    
    ai_engine = MockAIEngine()
    handler = MessageHandler(ai_engine)
    
    test_message = {
        "type": "test",
        "timestamp": 1234567890.0,
        "data": {"key": "value", "number": 42}
    }
    
    # Test serialization
    json_str = handler.serialize_message(test_message)
    assert isinstance(json_str, str)
    
    # Test deserialization
    deserialized = handler.deserialize_message(json_str)
    assert deserialized["type"] == "test"
    assert deserialized["data"]["key"] == "value"
    assert deserialized["data"]["number"] == 42
    
    # Test invalid JSON
    invalid_json = "{ invalid json }"
    error_response = handler.deserialize_message(invalid_json)
    assert error_response["type"] == "error"
    assert error_response["data"]["errorCode"] == "DESERIALIZATION_ERROR"
    
    print("✓ Message serialization tests passed")


async def run_all_tests():
    """Run all tests"""
    print("Running WebSocket Protocol Tests...")
    print("=" * 50)
    
    try:
        # Synchronous tests
        test_message_queue()
        test_message_validation()
        test_business_logic_validation()
        test_message_serialization()
        
        # Asynchronous tests
        await test_message_handling()
        
        print("=" * 50)
        print("✅ All tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    # Run tests
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)