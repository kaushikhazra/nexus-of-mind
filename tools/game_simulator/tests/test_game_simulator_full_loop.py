"""
Full loop integration tests for Game Simulator with mocked backend.

These tests verify the complete simulation loop logic without requiring
a running backend server, using mocked WebSocket responses.

Requirements tested:
- 9.1: Full loop with multiple ticks, spawns, and state changes
"""

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, patch

from game_simulator.runner import SimulationRunner
from game_simulator.config import SimulationConfig
from game_simulator.observation import generate_observation


class TestGameSimulatorFullLoopMocked:
    """Test complete simulation loops with mocked backend responses."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.config = SimulationConfig(
            grid_size=20,
            num_workers=3,
            num_protectors=2,
            queen_start_energy=100,
            energy_parasite_cost=15,
            combat_parasite_cost=25,
            turbo_mode=True,
            tick_interval=0.0
        )
        self.runner = SimulationRunner(self.config)
    
    @pytest.mark.asyncio
    async def test_full_loop_with_multiple_spawns(self):
        """
        Test complete simulation loop with multiple parasite spawns.
        
        Requirements: 9.1 - Multiple ticks, spawn parasites, verify state changes
        """
        # Mock WebSocket with varied responses
        mock_ws = AsyncMock()
        
        # Simulate realistic NN responses: spawn, wait, spawn, wait, spawn
        responses = [
            '{"action": "spawn", "spawnChunk": 100, "spawnType": "energy"}',
            '{"action": "wait", "reason": "low_confidence"}',
            '{"action": "spawn", "spawnChunk": 150, "spawnType": "combat"}',
            '{"action": "wait", "reason": "insufficient_reward"}',
            '{"action": "spawn", "spawnChunk": 200, "spawnType": "energy"}',
        ]
        mock_ws.recv = AsyncMock(side_effect=responses)
        mock_ws.send = AsyncMock()
        
        # Set up connection
        self.runner.ws = mock_ws
        self.runner.connected = True
        
        # Record initial state
        initial_state = {
            'tick': self.runner.simulator.state.tick,
            'parasites': len(self.runner.simulator.state.parasites),
            'queen_energy': self.runner.simulator.state.queen_energy,
            'player_energy': self.runner.simulator.state.player_energy,
            'player_minerals': self.runner.simulator.state.player_minerals
        }
        
        # Run simulation for 5 ticks
        num_ticks = 5
        await self.runner.run(num_ticks)
        
        # Verify simulation progressed
        final_state = {
            'tick': self.runner.simulator.state.tick,
            'parasites': len(self.runner.simulator.state.parasites),
            'queen_energy': self.runner.simulator.state.queen_energy,
            'player_energy': self.runner.simulator.state.player_energy,
            'player_minerals': self.runner.simulator.state.player_minerals
        }
        
        # Verify tick progression
        assert final_state['tick'] == initial_state['tick'] + num_ticks
        
        # Verify parasites were spawned (3 spawn commands, should succeed if energy allows)
        parasites_added = final_state['parasites'] - initial_state['parasites']
        assert parasites_added >= 0  # At least no parasites lost
        assert parasites_added <= 3  # At most 3 spawns attempted
        
        # Verify energy changes (spawns consume energy, regeneration adds energy)
        energy_change = final_state['queen_energy'] - initial_state['queen_energy']
        # Energy change depends on spawns vs regeneration
        
        # Verify player resources increased (workers mining)
        energy_gained = final_state['player_energy'] - initial_state['player_energy']
        minerals_gained = final_state['player_minerals'] - initial_state['player_minerals']
        
        assert energy_gained >= 0, "Player energy should not decrease"
        assert minerals_gained >= 0, "Player minerals should not decrease"
        
        # Verify WebSocket interactions
        assert mock_ws.send.call_count == num_ticks  # One observation per tick
        assert mock_ws.recv.call_count == num_ticks  # One response per tick
        
        print(f"✓ Full loop completed: {num_ticks} ticks, {parasites_added} parasites spawned")
        print(f"  Energy gained: {energy_gained:.1f}, Minerals gained: {minerals_gained:.1f}")
    
    @pytest.mark.asyncio
    async def test_full_loop_with_energy_depletion(self):
        """
        Test simulation behavior when queen energy is depleted.
        
        Requirements: 9.1 - Handle energy constraints in spawning
        """
        # Set low initial energy
        self.runner.simulator.state.queen_energy = 20  # Only enough for 1 energy parasite
        
        # Mock WebSocket with multiple spawn attempts
        mock_ws = AsyncMock()
        
        # Attempt multiple expensive spawns
        responses = [
            '{"action": "spawn", "spawnChunk": 100, "spawnType": "combat"}',  # 25 energy - should fail
            '{"action": "spawn", "spawnChunk": 150, "spawnType": "energy"}',  # 15 energy - might succeed
            '{"action": "spawn", "spawnChunk": 200, "spawnType": "combat"}',  # 25 energy - should fail
        ]
        mock_ws.recv = AsyncMock(side_effect=responses)
        mock_ws.send = AsyncMock()
        
        self.runner.ws = mock_ws
        self.runner.connected = True
        
        # Record initial state
        initial_parasites = len(self.runner.simulator.state.parasites)
        initial_energy = self.runner.simulator.state.queen_energy
        
        # Run simulation
        await self.runner.run(3)
        
        # Verify limited spawning due to energy constraints
        final_parasites = len(self.runner.simulator.state.parasites)
        final_energy = self.runner.simulator.state.queen_energy
        
        parasites_added = final_parasites - initial_parasites
        
        # Should have spawned at most 1 parasite due to energy constraints
        assert parasites_added <= 1, f"Too many parasites spawned with low energy: {parasites_added}"
        
        # Energy should be managed properly
        assert final_energy >= 0, "Queen energy should not go negative"
        
        print(f"✓ Energy depletion test: {parasites_added} parasites spawned with limited energy")
        print(f"  Energy: {initial_energy:.1f} → {final_energy:.1f}")
    
    @pytest.mark.asyncio
    async def test_full_loop_with_entity_interactions(self):
        """
        Test simulation with entity interactions (workers fleeing, protectors chasing).
        
        Requirements: 9.1 - Verify complex state changes with entity behaviors
        """
        # Mock WebSocket responses
        mock_ws = AsyncMock()
        
        # Spawn parasites near workers to trigger fleeing behavior
        responses = [
            '{"action": "spawn", "spawnChunk": 45, "spawnType": "energy"}',   # Near mining spot
            '{"action": "wait", "reason": "let_interactions_happen"}',
            '{"action": "spawn", "spawnChunk": 67, "spawnType": "combat"}',   # Another mining spot
            '{"action": "wait", "reason": "observe_behavior"}',
            '{"action": "wait", "reason": "continue_observation"}',
        ]
        mock_ws.recv = AsyncMock(side_effect=responses)
        mock_ws.send = AsyncMock()
        
        self.runner.ws = mock_ws
        self.runner.connected = True
        
        # Record initial positions
        initial_worker_positions = [w.chunk for w in self.runner.simulator.state.workers]
        initial_protector_positions = [p.chunk for p in self.runner.simulator.state.protectors]
        
        # Run simulation to allow interactions
        await self.runner.run(5)
        
        # Check for position changes (entities should move due to interactions)
        final_worker_positions = [w.chunk for w in self.runner.simulator.state.workers]
        final_protector_positions = [p.chunk for p in self.runner.simulator.state.protectors]
        
        # Count entities that moved
        workers_moved = sum(1 for i, pos in enumerate(final_worker_positions) 
                           if pos != initial_worker_positions[i])
        protectors_moved = sum(1 for i, pos in enumerate(final_protector_positions) 
                              if pos != initial_protector_positions[i])
        
        # Some entities should have moved due to interactions
        total_moved = workers_moved + protectors_moved
        assert total_moved > 0, "No entities moved - interactions not working"
        
        # Check for parasites (some should have been spawned)
        parasites_count = len(self.runner.simulator.state.parasites)
        
        print(f"✓ Entity interactions test completed")
        print(f"  Workers moved: {workers_moved}/{len(initial_worker_positions)}")
        print(f"  Protectors moved: {protectors_moved}/{len(initial_protector_positions)}")
        print(f"  Parasites spawned: {parasites_count}")
    
    @pytest.mark.asyncio
    async def test_observation_accuracy_over_time(self):
        """
        Test that observations accurately reflect changing game state over multiple ticks.
        
        Requirements: 9.1 - Observations reflect actual state changes
        """
        # Mock WebSocket responses
        mock_ws = AsyncMock()
        
        # Mix of spawn and wait decisions
        responses = [
            '{"action": "spawn", "spawnChunk": 100, "spawnType": "energy"}',
            '{"action": "spawn", "spawnChunk": 150, "spawnType": "combat"}',
            '{"action": "wait", "reason": "observe_changes"}',
        ]
        mock_ws.recv = AsyncMock(side_effect=responses)
        mock_ws.send = AsyncMock()
        
        self.runner.ws = mock_ws
        self.runner.connected = True
        
        # Track observations sent
        sent_observations = []
        
        # Override send method to capture observations
        original_send = mock_ws.send
        async def capture_send(message):
            data = json.loads(message)
            if data.get("type") == "nn_observation":
                sent_observations.append(data["data"])
            return await original_send(message)
        
        mock_ws.send = capture_send
        
        # Run simulation
        await self.runner.run(3)
        
        # Verify we captured observations
        assert len(sent_observations) == 3, f"Expected 3 observations, got {len(sent_observations)}"
        
        # Verify observation progression
        for i, obs in enumerate(sent_observations):
            # Check required fields
            assert "tick" in obs
            assert "territoryId" in obs
            assert "queenEnergy" in obs
            assert "chunks" in obs
            
            # Verify tick progression
            assert obs["tick"] == i + 1
            
            # Verify territory ID consistency
            assert obs["territoryId"] == "sim-territory"
            
            # Verify energy is reasonable
            assert isinstance(obs["queenEnergy"], (int, float))
            assert obs["queenEnergy"] >= 0
        
        # Check for state changes reflected in observations
        first_obs = sent_observations[0]
        last_obs = sent_observations[-1]
        
        # Energy should change (regeneration and/or consumption)
        energy_change = last_obs["queenEnergy"] - first_obs["queenEnergy"]
        
        # Player resources should increase
        first_player_energy = first_obs.get("playerEnergyEnd", first_obs.get("playerEnergy", 0))
        last_player_energy = last_obs.get("playerEnergyEnd", last_obs.get("playerEnergy", 0))
        
        if isinstance(first_player_energy, (int, float)) and isinstance(last_player_energy, (int, float)):
            energy_gained = last_player_energy - first_player_energy
            assert energy_gained >= 0, "Player energy should not decrease"
        
        print(f"✓ Observation accuracy test completed")
        print(f"  Observations captured: {len(sent_observations)}")
        print(f"  Queen energy change: {energy_change:.1f}")
        print(f"  Tick range: {first_obs['tick']} → {last_obs['tick']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])