"""
Tests for the SimulationRunner module.
"""

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from game_simulator.runner import SimulationRunner
from game_simulator.config import SimulationConfig


class TestSimulationRunner:
    """Test cases for SimulationRunner class."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.config = SimulationConfig(
            grid_size=20,
            num_workers=2,
            num_protectors=1,
            turbo_mode=True,  # For faster testing
            tick_interval=0.0
        )
        self.runner = SimulationRunner(self.config)
    
    def test_init(self):
        """Test SimulationRunner initialization."""
        assert self.runner.config == self.config
        assert self.runner.simulator is not None
        assert self.runner.ws is None
        assert self.runner.connected is False
    
    @pytest.mark.asyncio
    async def test_connect_success(self):
        """Test successful WebSocket connection."""
        mock_ws = AsyncMock()
        
        with patch('game_simulator.runner.websockets') as mock_websockets:
            mock_websockets.connect = AsyncMock(return_value=mock_ws)
            
            await self.runner.connect("ws://test:8000/ws")
            
            assert self.runner.connected is True
            assert self.runner.ws == mock_ws
            mock_websockets.connect.assert_called_once_with("ws://test:8000/ws")
    
    @pytest.mark.asyncio
    async def test_connect_failure(self):
        """Test WebSocket connection failure."""
        with patch('game_simulator.runner.websockets') as mock_websockets:
            mock_websockets.connect = AsyncMock(side_effect=Exception("Connection failed"))
            
            with pytest.raises(ConnectionError, match="Failed to connect to WebSocket"):
                await self.runner.connect("ws://test:8000/ws")
            
            assert self.runner.connected is False
            assert self.runner.ws is None
    
    @pytest.mark.asyncio
    async def test_connect_no_websockets_library(self):
        """Test connection when websockets library is not available."""
        with patch('game_simulator.runner.websockets', None):
            with pytest.raises(ImportError, match="websockets library is required"):
                await self.runner.connect("ws://test:8000/ws")
    
    @pytest.mark.asyncio
    async def test_run_not_connected(self):
        """Test run() when not connected."""
        with pytest.raises(RuntimeError, match="Not connected to WebSocket"):
            await self.runner.run(1)
    
    @pytest.mark.asyncio
    async def test_run_basic_loop(self):
        """Test basic simulation run loop."""
        # Mock WebSocket
        mock_ws = AsyncMock()
        mock_ws.send = AsyncMock()
        mock_ws.recv = AsyncMock(return_value='{"action": "wait"}')
        
        self.runner.ws = mock_ws
        self.runner.connected = True
        
        # Run for 2 ticks
        await self.runner.run(2)
        
        # Verify WebSocket interactions
        assert mock_ws.send.call_count == 2  # One observation per tick
        assert mock_ws.recv.call_count == 2  # One response per tick
        
        # Verify simulation advanced
        assert self.runner.simulator.state.tick == 2
    
    @pytest.mark.asyncio
    async def test_send_observation(self):
        """Test sending observation via WebSocket."""
        mock_ws = AsyncMock()
        self.runner.ws = mock_ws
        
        observation = {
            "territoryId": "sim-territory",
            "tick": 1,
            "chunks": {},
            "queenEnergy": 50.0
        }
        
        await self.runner._send_observation(observation)
        
        # Verify message format
        mock_ws.send.assert_called_once()
        sent_data = json.loads(mock_ws.send.call_args[0][0])
        
        assert sent_data["type"] == "nn_observation"
        assert sent_data["data"] == observation
    
    @pytest.mark.asyncio
    async def test_receive_response(self):
        """Test receiving response from WebSocket."""
        mock_ws = AsyncMock()
        response_data = {"action": "spawn", "spawnChunk": 100, "spawnType": "energy"}
        mock_ws.recv = AsyncMock(return_value=json.dumps(response_data))
        
        self.runner.ws = mock_ws
        
        result = await self.runner._receive_response()
        
        assert result == response_data
        mock_ws.recv.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_receive_response_error(self):
        """Test handling error when receiving response."""
        mock_ws = AsyncMock()
        mock_ws.recv = AsyncMock(side_effect=Exception("Connection lost"))
        
        self.runner.ws = mock_ws
        
        result = await self.runner._receive_response()
        
        assert result is None
    
    def test_should_spawn_valid(self):
        """Test spawn decision detection with valid response."""
        response = {
            "action": "spawn",
            "spawnChunk": 100,
            "spawnType": "energy"
        }
        
        assert self.runner._should_spawn(response) is True
    
    def test_should_spawn_wait(self):
        """Test spawn decision detection with wait response."""
        response = {"action": "wait"}
        
        assert self.runner._should_spawn(response) is False
    
    def test_should_spawn_missing_fields(self):
        """Test spawn decision detection with missing fields."""
        response = {"action": "spawn", "spawnChunk": 100}  # Missing spawnType
        
        assert self.runner._should_spawn(response) is False
    
    def test_execute_spawn_success(self):
        """Test successful parasite spawn execution."""
        response = {
            "spawnChunk": 100,
            "spawnType": "energy"
        }
        
        # Mock the simulator spawn method
        self.runner.simulator.spawn_parasite = MagicMock(return_value=True)
        
        result = self.runner._execute_spawn(response)
        
        assert result is True
        self.runner.simulator.spawn_parasite.assert_called_once_with(100, "energy")
    
    def test_execute_spawn_insufficient_energy(self):
        """Test spawn execution with insufficient energy."""
        response = {
            "spawnChunk": 100,
            "spawnType": "energy"
        }
        
        # Mock the simulator spawn method to return False (insufficient energy)
        self.runner.simulator.spawn_parasite = MagicMock(return_value=False)
        
        result = self.runner._execute_spawn(response)
        
        assert result is False
        self.runner.simulator.spawn_parasite.assert_called_once_with(100, "energy")
    
    def test_execute_spawn_invalid_chunk(self):
        """Test spawn execution with invalid chunk."""
        response = {
            "spawnChunk": 500,  # Out of bounds for 20x20 grid
            "spawnType": "energy"
        }
        
        result = self.runner._execute_spawn(response)
        
        assert result is False
    
    def test_execute_spawn_invalid_type(self):
        """Test spawn execution with invalid parasite type."""
        response = {
            "spawnChunk": 100,
            "spawnType": "invalid"
        }
        
        result = self.runner._execute_spawn(response)
        
        assert result is False
    
    def test_execute_spawn_missing_parameters(self):
        """Test spawn execution with missing parameters."""
        response = {"spawnChunk": 100}  # Missing spawnType
        
        result = self.runner._execute_spawn(response)
        
        assert result is False
    
    @pytest.mark.asyncio
    async def test_close(self):
        """Test WebSocket connection cleanup."""
        mock_ws = AsyncMock()
        self.runner.ws = mock_ws
        self.runner.connected = True
        
        await self.runner.close()
        
        mock_ws.close.assert_called_once()
        assert self.runner.ws is None
        assert self.runner.connected is False
    
    @pytest.mark.asyncio
    async def test_close_with_error(self):
        """Test WebSocket cleanup with close error."""
        mock_ws = AsyncMock()
        mock_ws.close = AsyncMock(side_effect=Exception("Close failed"))
        
        self.runner.ws = mock_ws
        self.runner.connected = True
        
        # Should not raise exception
        await self.runner.close()
        
        assert self.runner.ws is None
        assert self.runner.connected is False
    
    def test_repr(self):
        """Test string representation."""
        repr_str = repr(self.runner)
        
        assert "SimulationRunner" in repr_str
        assert "connected=False" in repr_str
        assert "tick=0" in repr_str


if __name__ == "__main__":
    pytest.main([__file__])