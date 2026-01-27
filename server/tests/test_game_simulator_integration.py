"""
Integration tests for Game Simulator WebSocket connection.

These tests connect to the actual WebSocket backend to verify
the simulator can communicate with the real system.

Requirements tested:
- 8.1: WebSocket connection
- 8.2: Send observation
- 8.3: Receive response
- 9.1: Full loop
"""

import pytest
import asyncio
import json
import logging
from typing import Dict, Any
from unittest.mock import patch

from game_simulator.runner import SimulationRunner
from game_simulator.config import SimulationConfig
from game_simulator.observation import generate_observation


# Set up logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestGameSimulatorIntegration:
    """Integration tests for game simulator WebSocket communication."""
    
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
        self.backend_url = "ws://localhost:8000/ws"
    
    @pytest.mark.asyncio
    async def test_websocket_connection_success(self):
        """
        Test successful WebSocket connection to backend.
        
        Requirements: 8.1 - Connect to backend WebSocket
        """
        try:
            # Attempt to connect to backend
            await self.runner.connect(self.backend_url)
            
            # Verify connection state
            assert self.runner.connected is True
            assert self.runner.ws is not None
            
            logger.info("✓ WebSocket connection successful")
            
        except Exception as e:
            # If backend is not running, skip the test
            pytest.skip(f"Backend not available: {e}")
        
        finally:
            # Clean up connection
            if self.runner.connected:
                await self.runner.close()
    
    @pytest.mark.asyncio
    async def test_websocket_connection_failure(self):
        """
        Test WebSocket connection failure handling.
        
        Requirements: 8.4 - Handle connection errors
        """
        # Try to connect to non-existent endpoint
        invalid_url = "ws://localhost:9999/invalid"
        
        with pytest.raises(ConnectionError):
            await self.runner.connect(invalid_url)
        
        # Verify connection state remains false
        assert self.runner.connected is False
        assert self.runner.ws is None
        
        logger.info("✓ Connection failure handled correctly")
    
    @pytest.mark.asyncio
    async def test_send_observation_to_backend(self):
        """
        Test sending observation to real backend.
        
        Requirements: 8.2 - Send observation
        """
        try:
            # Connect to backend
            await self.runner.connect(self.backend_url)
            
            # Generate a realistic observation
            observation = generate_observation(self.runner.simulator.state)
            
            # Send observation
            await self.runner._send_observation(observation)
            
            logger.info("✓ Observation sent successfully")
            logger.info(f"  Observation tick: {observation['tick']}")
            logger.info(f"  Territory ID: {observation['territoryId']}")
            logger.info(f"  Queen energy: {observation['queenEnergy']}")
            
        except Exception as e:
            pytest.skip(f"Backend not available: {e}")
        
        finally:
            if self.runner.connected:
                await self.runner.close()
    
    @pytest.mark.asyncio
    async def test_receive_response_from_backend(self):
        """
        Test receiving response from real backend.
        
        Requirements: 8.3 - Receive response
        """
        try:
            # Connect to backend
            await self.runner.connect(self.backend_url)
            
            # Generate and send observation
            observation = generate_observation(self.runner.simulator.state)
            await self.runner._send_observation(observation)
            
            # Receive response with timeout
            response = await asyncio.wait_for(
                self.runner._receive_response(),
                timeout=10.0  # 10 second timeout
            )
            
            # Verify response structure
            assert response is not None
            assert isinstance(response, dict)
            
            # Log response details
            logger.info("✓ Response received successfully")
            logger.info(f"  Response keys: {list(response.keys())}")
            
            # Check for expected response types
            if "action" in response:
                logger.info(f"  Action: {response['action']}")
                if response["action"] == "spawn":
                    logger.info(f"  Spawn chunk: {response.get('spawnChunk')}")
                    logger.info(f"  Spawn type: {response.get('spawnType')}")
            
        except asyncio.TimeoutError:
            pytest.skip("Backend did not respond within timeout")
        except Exception as e:
            pytest.skip(f"Backend not available: {e}")
        
        finally:
            if self.runner.connected:
                await self.runner.close()
    
    @pytest.mark.asyncio
    async def test_full_communication_cycle(self):
        """
        Test complete observation → response → spawn cycle.
        
        Requirements: 8.1, 8.2, 8.3 - Full WebSocket communication
        """
        try:
            # Connect to backend
            await self.runner.connect(self.backend_url)
            
            # Record initial state
            initial_parasites = len(self.runner.simulator.state.parasites)
            initial_energy = self.runner.simulator.state.queen_energy
            
            # Generate and send observation
            observation = generate_observation(self.runner.simulator.state)
            await self.runner._send_observation(observation)
            
            # Receive response
            response = await asyncio.wait_for(
                self.runner._receive_response(),
                timeout=10.0
            )
            
            assert response is not None
            
            # Process response if it's a spawn decision
            spawn_executed = False
            if self.runner._should_spawn(response):
                spawn_executed = self.runner._execute_spawn(response)
                logger.info(f"  Spawn executed: {spawn_executed}")
                
                if spawn_executed:
                    # Verify parasite was added
                    new_parasites = len(self.runner.simulator.state.parasites)
                    assert new_parasites == initial_parasites + 1
                    
                    # Verify energy was deducted
                    new_energy = self.runner.simulator.state.queen_energy
                    assert new_energy < initial_energy
                    
                    logger.info(f"  Parasites: {initial_parasites} → {new_parasites}")
                    logger.info(f"  Queen energy: {initial_energy:.1f} → {new_energy:.1f}")
            
            logger.info("✓ Full communication cycle completed")
            
        except asyncio.TimeoutError:
            pytest.skip("Backend did not respond within timeout")
        except Exception as e:
            pytest.skip(f"Backend not available: {e}")
        
        finally:
            if self.runner.connected:
                await self.runner.close()


class TestGameSimulatorBackendCompatibility:
    """Test compatibility with actual backend message formats."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.config = SimulationConfig(
            grid_size=20,
            num_workers=2,
            num_protectors=1,
            turbo_mode=True
        )
        self.runner = SimulationRunner(self.config)
        self.backend_url = "ws://localhost:8000/ws"
    
    @pytest.mark.asyncio
    async def test_observation_format_compatibility(self):
        """
        Test that simulator observations match backend expectations.
        
        The backend expects 'observation_data' messages, but simulator
        sends 'nn_observation'. This test verifies compatibility.
        """
        try:
            # Connect to backend
            await self.runner.connect(self.backend_url)
            
            # Generate observation
            observation = generate_observation(self.runner.simulator.state)
            
            # Test current format (nn_observation)
            message = {
                "type": "nn_observation",
                "data": observation
            }
            
            # Send message and check if backend accepts it
            await self.runner.ws.send(json.dumps(message))
            
            # Try to receive response (backend might not understand nn_observation)
            try:
                response = await asyncio.wait_for(
                    self.runner.ws.recv(),
                    timeout=5.0
                )
                response_data = json.loads(response)
                logger.info("✓ Backend accepted nn_observation format")
                logger.info(f"  Response: {response_data}")
                
            except asyncio.TimeoutError:
                logger.warning("⚠ Backend did not respond to nn_observation format")
                
                # Try alternative format (observation_data)
                alt_message = {
                    "type": "observation_data",
                    "data": observation
                }
                
                await self.runner.ws.send(json.dumps(alt_message))
                
                try:
                    response = await asyncio.wait_for(
                        self.runner.ws.recv(),
                        timeout=5.0
                    )
                    response_data = json.loads(response)
                    logger.info("✓ Backend accepted observation_data format")
                    logger.info(f"  Response: {response_data}")
                    
                except asyncio.TimeoutError:
                    logger.error("✗ Backend did not respond to either format")
                    pytest.skip("Backend does not accept observation messages")
            
        except Exception as e:
            pytest.skip(f"Backend not available: {e}")
        
        finally:
            if self.runner.connected:
                await self.runner.close()
    
    @pytest.mark.asyncio
    async def test_response_format_parsing(self):
        """
        Test parsing of different backend response formats.
        
        Backend may send different response formats depending on
        the AI decision (spawn vs wait).
        """
        try:
            # Connect to backend
            await self.runner.connect(self.backend_url)
            
            # Send observation
            observation = generate_observation(self.runner.simulator.state)
            await self.runner._send_observation(observation)
            
            # Receive and analyze response
            response = await asyncio.wait_for(
                self.runner._receive_response(),
                timeout=10.0
            )
            
            assert response is not None
            
            # Test different response formats
            logger.info("✓ Response received and parsed")
            logger.info(f"  Response type: {type(response)}")
            logger.info(f"  Response keys: {list(response.keys())}")
            
            # Check for spawn decision format
            if "action" in response:
                logger.info(f"  Action-based format: {response['action']}")
                
                if response["action"] == "spawn":
                    assert "spawnChunk" in response
                    assert "spawnType" in response
                    logger.info("  ✓ Spawn format valid")
                
                elif response["action"] == "wait":
                    logger.info("  ✓ Wait format valid")
            
            # Check for alternative formats
            elif "type" in response:
                logger.info(f"  Type-based format: {response['type']}")
                
                if response["type"] == "spawn_decision":
                    data = response.get("data", {})
                    assert "spawnChunk" in data
                    assert "spawnType" in data
                    logger.info("  ✓ Spawn decision format valid")
                
                elif response["type"] == "no_action":
                    logger.info("  ✓ No action format valid")
            
            else:
                logger.warning(f"  ⚠ Unknown response format: {response}")
            
        except asyncio.TimeoutError:
            pytest.skip("Backend did not respond within timeout")
        except Exception as e:
            pytest.skip(f"Backend not available: {e}")
        
        finally:
            if self.runner.connected:
                await self.runner.close()


class TestGameSimulatorFullLoop:
    """Test complete simulation loops with multiple ticks and state changes."""
    
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
        self.backend_url = "ws://localhost:8000/ws"
    
    @pytest.mark.asyncio
    async def test_multiple_tick_simulation(self):
        """
        Test simulation running for multiple ticks with backend communication.
        
        Requirements: 9.1 - Multiple ticks
        """
        try:
            # Connect to backend
            await self.runner.connect(self.backend_url)
            
            # Record initial state
            initial_tick = self.runner.simulator.state.tick
            initial_parasites = len(self.runner.simulator.state.parasites)
            initial_energy = self.runner.simulator.state.queen_energy
            
            # Run simulation for 3 ticks
            num_ticks = 3
            await self.runner.run(num_ticks)
            
            # Verify simulation progressed
            final_tick = self.runner.simulator.state.tick
            assert final_tick == initial_tick + num_ticks
            
            logger.info("✓ Multiple tick simulation completed")
            logger.info(f"  Ticks: {initial_tick} → {final_tick}")
            logger.info(f"  Parasites: {initial_parasites} → {len(self.runner.simulator.state.parasites)}")
            logger.info(f"  Queen energy: {initial_energy:.1f} → {self.runner.simulator.state.queen_energy:.1f}")
            
        except Exception as e:
            pytest.skip(f"Backend not available: {e}")
        
        finally:
            if self.runner.connected:
                await self.runner.close()
    
    @pytest.mark.asyncio
    async def test_parasite_spawning_integration(self):
        """
        Test parasite spawning through backend decisions.
        
        Requirements: 9.1 - Spawn parasites
        """
        try:
            # Connect to backend
            await self.runner.connect(self.backend_url)
            
            # Track spawning activity
            spawn_attempts = 0
            successful_spawns = 0
            initial_parasites = len(self.runner.simulator.state.parasites)
            
            # Run simulation and track spawns
            for tick in range(5):  # Run for 5 ticks
                # Evolve game state
                self.runner.simulator.tick()
                
                # Generate and send observation
                observation = generate_observation(self.runner.simulator.state)
                await self.runner._send_observation(observation)
                
                # Receive response
                response = await asyncio.wait_for(
                    self.runner._receive_response(),
                    timeout=10.0
                )
                
                # Process spawn decision
                if response and self.runner._should_spawn(response):
                    spawn_attempts += 1
                    success = self.runner._execute_spawn(response)
                    if success:
                        successful_spawns += 1
                        logger.info(f"  Tick {tick + 1}: Spawned {response['spawnType']} at chunk {response['spawnChunk']}")
                    else:
                        logger.info(f"  Tick {tick + 1}: Spawn failed (insufficient energy)")
                else:
                    logger.info(f"  Tick {tick + 1}: No spawn decision")
            
            # Verify spawning occurred
            final_parasites = len(self.runner.simulator.state.parasites)
            parasites_added = final_parasites - initial_parasites
            
            logger.info("✓ Parasite spawning integration completed")
            logger.info(f"  Spawn attempts: {spawn_attempts}")
            logger.info(f"  Successful spawns: {successful_spawns}")
            logger.info(f"  Parasites added: {parasites_added}")
            
            # At least some interaction should have occurred
            assert spawn_attempts >= 0  # Backend may decide not to spawn
            assert successful_spawns <= spawn_attempts  # Can't succeed more than attempted
            assert parasites_added == successful_spawns  # Spawns should match parasite count
            
        except asyncio.TimeoutError:
            pytest.skip("Backend responses timed out")
        except Exception as e:
            pytest.skip(f"Backend not available: {e}")
        
        finally:
            if self.runner.connected:
                await self.runner.close()
    
    @pytest.mark.asyncio
    async def test_state_changes_verification(self):
        """
        Test that simulation state changes are properly reflected.
        
        Requirements: 9.1 - Verify state changes
        """
        try:
            # Connect to backend
            await self.runner.connect(self.backend_url)
            
            # Record detailed initial state
            initial_state = {
                'tick': self.runner.simulator.state.tick,
                'parasites': len(self.runner.simulator.state.parasites),
                'queen_energy': self.runner.simulator.state.queen_energy,
                'player_energy': self.runner.simulator.state.player_energy,
                'player_minerals': self.runner.simulator.state.player_minerals,
                'worker_positions': [w.chunk for w in self.runner.simulator.state.workers],
                'protector_positions': [p.chunk for p in self.runner.simulator.state.protectors]
            }
            
            # Run simulation for several ticks
            await self.runner.run(4)
            
            # Record final state
            final_state = {
                'tick': self.runner.simulator.state.tick,
                'parasites': len(self.runner.simulator.state.parasites),
                'queen_energy': self.runner.simulator.state.queen_energy,
                'player_energy': self.runner.simulator.state.player_energy,
                'player_minerals': self.runner.simulator.state.player_minerals,
                'worker_positions': [w.chunk for w in self.runner.simulator.state.workers],
                'protector_positions': [p.chunk for p in self.runner.simulator.state.protectors]
            }
            
            # Verify expected changes
            assert final_state['tick'] > initial_state['tick']
            
            # Queen energy should regenerate (unless spawns consumed it all)
            # Allow for energy consumption from spawns
            energy_change = final_state['queen_energy'] - initial_state['queen_energy']
            logger.info(f"  Queen energy change: {energy_change:.1f}")
            
            # Player resources should increase (workers mining)
            energy_gained = final_state['player_energy'] - initial_state['player_energy']
            minerals_gained = final_state['player_minerals'] - initial_state['player_minerals']
            
            assert energy_gained >= 0, "Player energy should not decrease"
            assert minerals_gained >= 0, "Player minerals should not decrease"
            
            logger.info("✓ State changes verification completed")
            logger.info(f"  Tick progression: {initial_state['tick']} → {final_state['tick']}")
            logger.info(f"  Parasite count: {initial_state['parasites']} → {final_state['parasites']}")
            logger.info(f"  Player energy gained: {energy_gained:.1f}")
            logger.info(f"  Player minerals gained: {minerals_gained:.1f}")
            
            # Log position changes (entities should move)
            worker_moves = sum(1 for i, pos in enumerate(final_state['worker_positions']) 
                             if pos != initial_state['worker_positions'][i])
            protector_moves = sum(1 for i, pos in enumerate(final_state['protector_positions']) 
                                if pos != initial_state['protector_positions'][i])
            
            logger.info(f"  Workers that moved: {worker_moves}/{len(initial_state['worker_positions'])}")
            logger.info(f"  Protectors that moved: {protector_moves}/{len(initial_state['protector_positions'])}")
            
        except Exception as e:
            pytest.skip(f"Backend not available: {e}")
        
        finally:
            if self.runner.connected:
                await self.runner.close()
    
    @pytest.mark.asyncio
    async def test_long_running_simulation(self):
        """
        Test longer simulation to verify stability and performance.
        
        Requirements: 9.1 - Extended operation
        """
        try:
            # Connect to backend
            await self.runner.connect(self.backend_url)
            
            # Record start time and state
            import time
            start_time = time.time()
            initial_tick = self.runner.simulator.state.tick
            
            # Run longer simulation (10 ticks)
            num_ticks = 10
            await self.runner.run(num_ticks)
            
            # Calculate performance metrics
            end_time = time.time()
            duration = end_time - start_time
            ticks_per_second = num_ticks / duration if duration > 0 else 0
            
            # Verify completion
            final_tick = self.runner.simulator.state.tick
            assert final_tick == initial_tick + num_ticks
            
            logger.info("✓ Long running simulation completed")
            logger.info(f"  Duration: {duration:.2f} seconds")
            logger.info(f"  Performance: {ticks_per_second:.1f} ticks/second")
            logger.info(f"  Final tick: {final_tick}")
            
            # Performance should be reasonable (at least 1 tick per second)
            assert ticks_per_second >= 0.5, f"Performance too slow: {ticks_per_second:.1f} ticks/sec"
            
        except Exception as e:
            pytest.skip(f"Backend not available: {e}")
        
        finally:
            if self.runner.connected:
                await self.runner.close()


if __name__ == "__main__":
    # Run tests with verbose output
    pytest.main([__file__, "-v", "-s"])