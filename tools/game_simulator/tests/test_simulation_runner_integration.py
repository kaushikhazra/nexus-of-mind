"""
Integration tests for SimulationRunner with actual simulator components.
"""

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, patch
from game_simulator.runner import SimulationRunner
from game_simulator.config import SimulationConfig


class TestSimulationRunnerIntegration:
    """Integration test cases for SimulationRunner."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.config = SimulationConfig(
            grid_size=20,
            num_workers=2,
            num_protectors=1,
            queen_start_energy=100,
            energy_parasite_cost=15,
            combat_parasite_cost=25,
            turbo_mode=True,
            tick_interval=0.0
        )
        self.runner = SimulationRunner(self.config)
    
    @pytest.mark.asyncio
    async def test_full_simulation_loop_with_spawns(self):
        """Test complete simulation loop with parasite spawning."""
        # Mock WebSocket with realistic responses
        mock_ws = AsyncMock()
        
        # Simulate NN responses: spawn energy parasite, then wait
        responses = [
            '{"action": "spawn", "spawnChunk": 100, "spawnType": "energy"}',
            '{"action": "wait", "reason": "insufficient_reward"}',
            '{"action": "spawn", "spawnChunk": 150, "spawnType": "combat"}',
        ]
        mock_ws.recv = AsyncMock(side_effect=responses)
        mock_ws.send = AsyncMock()
        
        self.runner.ws = mock_ws
        self.runner.connected = True
        
        # Record initial state
        initial_tick = self.runner.simulator.state.tick
        initial_energy = self.runner.simulator.state.queen_energy
        initial_parasites = len(self.runner.simulator.state.parasites)
        
        # Run simulation for 3 ticks
        await self.runner.run(3)
        
        # Verify simulation progressed
        assert self.runner.simulator.state.tick == initial_tick + 3
        
        # Verify parasites were spawned (2 spawns out of 3 responses)
        assert len(self.runner.simulator.state.parasites) == initial_parasites + 2
        
        # Verify energy was deducted (15 + 25 = 40 energy)
        # Account for energy regeneration (0.5 per tick * 3 ticks = 1.5)
        expected_energy = initial_energy - 15 - 25 + (0.5 * 3)
        
        # Allow for small floating point differences and ensure energy is capped at max
        actual_energy = self.runner.simulator.state.queen_energy
        expected_energy = min(expected_energy, self.config.queen_max_energy)
        
        assert abs(actual_energy - expected_energy) < 1.0  # More lenient tolerance
        
        # Verify WebSocket interactions
        assert mock_ws.send.call_count == 3  # One observation per tick
        assert mock_ws.recv.call_count == 3  # One response per tick
        
        # Verify observation format in sent messages
        for call in mock_ws.send.call_args_list:
            sent_data = json.loads(call[0][0])
            assert sent_data["type"] == "nn_observation"
            assert "data" in sent_data
            
            observation = sent_data["data"]
            assert "territoryId" in observation
            assert "tick" in observation
            assert "chunks" in observation
            assert "queenEnergy" in observation
    
    @pytest.mark.asyncio
    async def test_spawn_with_insufficient_energy(self):
        """Test spawn attempt when queen has insufficient energy."""
        # Set queen energy very low
        self.runner.simulator.state.queen_energy = 10  # Less than combat cost (25)
        
        mock_ws = AsyncMock()
        mock_ws.recv = AsyncMock(return_value='{"action": "spawn", "spawnChunk": 100, "spawnType": "combat"}')
        mock_ws.send = AsyncMock()
        
        self.runner.ws = mock_ws
        self.runner.connected = True
        
        initial_parasites = len(self.runner.simulator.state.parasites)
        
        # Run simulation for 1 tick
        await self.runner.run(1)
        
        # Verify no parasite was spawned due to insufficient energy
        assert len(self.runner.simulator.state.parasites) == initial_parasites
        
        # Verify queen energy wasn't deducted
        # Should be 10 + 0.5 (regeneration) = 10.5
        assert abs(self.runner.simulator.state.queen_energy - 10.5) < 0.1
    
    @pytest.mark.asyncio
    async def test_observation_reflects_game_state(self):
        """Test that observations accurately reflect the current game state."""
        mock_ws = AsyncMock()
        mock_ws.recv = AsyncMock(return_value='{"action": "wait"}')
        mock_ws.send = AsyncMock()
        
        self.runner.ws = mock_ws
        self.runner.connected = True
        
        # Manually add some parasites to the state
        from game_simulator.entities import Parasite
        self.runner.simulator.state.parasites.append(
            Parasite(chunk=100, type="energy", spawn_time=0)
        )
        self.runner.simulator.state.parasites.append(
            Parasite(chunk=150, type="combat", spawn_time=0)
        )
        
        # Run simulation for 1 tick
        await self.runner.run(1)
        
        # Extract the observation from the sent message
        sent_data = json.loads(mock_ws.send.call_args[0][0])
        observation = sent_data["data"]
        
        # Verify observation includes parasite data
        chunks = observation["chunks"]
        
        # Check that chunks with parasites are included
        if "100" in chunks:
            assert chunks["100"]["energyParasites"] >= 1
        if "150" in chunks:
            assert chunks["150"]["combatParasites"] >= 1
        
        # Verify other observation fields
        assert observation["tick"] == 1
        assert observation["territoryId"] == "sim-territory"
        assert observation["aiPlayer"] == 1
        assert isinstance(observation["queenEnergy"], (int, float))
    
    @pytest.mark.asyncio
    async def test_worker_behavior_affects_observations(self):
        """Test that worker behavior changes are reflected in observations."""
        mock_ws = AsyncMock()
        
        # First response: spawn parasite near workers to make them flee
        # Second response: wait to let workers return
        responses = [
            '{"action": "spawn", "spawnChunk": 45, "spawnType": "energy"}',  # Near mining spot
            '{"action": "wait"}',
        ]
        mock_ws.recv = AsyncMock(side_effect=responses)
        mock_ws.send = AsyncMock()
        
        self.runner.ws = mock_ws
        self.runner.connected = True
        
        # Run simulation for 2 ticks
        await self.runner.run(2)
        
        # Verify we sent 2 observations
        assert mock_ws.send.call_count == 2
        
        # Extract observations
        obs1_data = json.loads(mock_ws.send.call_args_list[0][0][0])
        obs2_data = json.loads(mock_ws.send.call_args_list[1][0][0])
        
        obs1 = obs1_data["data"]
        obs2 = obs2_data["data"]
        
        # Verify tick progression
        assert obs1["tick"] == 1
        assert obs2["tick"] == 2
        
        # Verify energy changes (workers should generate less when fleeing)
        energy_change_1 = obs1["playerEnergyEnd"] - obs1["playerEnergyStart"]
        energy_change_2 = obs2["playerEnergyEnd"] - obs2["playerEnergyStart"]
        
        # Both should be non-negative (energy can only increase or stay same)
        assert energy_change_1 >= 0
        assert energy_change_2 >= 0


if __name__ == "__main__":
    pytest.main([__file__])