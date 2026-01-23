"""
Simulation runner module for the game simulator.

This module contains the SimulationRunner class that orchestrates the simulation
loop and WebSocket communication with the backend. It connects to the existing
WebSocket interface and sends observations in the same format as the real game
frontend.
"""

import asyncio
import json
import logging
import time
from typing import Optional, Dict, Any, TYPE_CHECKING, List
from dataclasses import dataclass

if TYPE_CHECKING:
    from .config import SimulationConfig

try:
    import websockets
except ImportError:
    websockets = None

from .simulator import Simulator
from .observation import generate_observation
from .curriculum import CurriculumManager, CurriculumPhase


# Set up logging
logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """
    Performance metrics for simulation tracking.
    
    Requirements satisfied:
    - 12.1: Ticks per second
    - 12.2: Average tick time
    """
    start_time: float
    end_time: Optional[float] = None
    total_ticks: int = 0
    tick_times: List[float] = None
    
    def __post_init__(self):
        if self.tick_times is None:
            self.tick_times = []
    
    def add_tick_time(self, tick_time: float) -> None:
        """Add a tick execution time."""
        self.tick_times.append(tick_time)
        self.total_ticks += 1
    
    def get_ticks_per_second(self) -> float:
        """Calculate ticks per second."""
        if self.end_time is None or self.total_ticks == 0:
            return 0.0
        
        elapsed_time = self.end_time - self.start_time
        if elapsed_time <= 0:
            return 0.0
        
        return self.total_ticks / elapsed_time
    
    def get_average_tick_time(self) -> float:
        """Calculate average tick time in milliseconds."""
        if not self.tick_times:
            return 0.0
        
        return (sum(self.tick_times) / len(self.tick_times)) * 1000  # Convert to ms
    
    def get_min_tick_time(self) -> float:
        """Get minimum tick time in milliseconds."""
        if not self.tick_times:
            return 0.0
        return min(self.tick_times) * 1000
    
    def get_max_tick_time(self) -> float:
        """Get maximum tick time in milliseconds."""
        if not self.tick_times:
            return 0.0
        return max(self.tick_times) * 1000
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get comprehensive performance summary."""
        return {
            'total_ticks': self.total_ticks,
            'elapsed_time_seconds': (self.end_time or time.time()) - self.start_time,
            'ticks_per_second': self.get_ticks_per_second(),
            'average_tick_time_ms': self.get_average_tick_time(),
            'min_tick_time_ms': self.get_min_tick_time(),
            'max_tick_time_ms': self.get_max_tick_time(),
            'total_tick_samples': len(self.tick_times)
        }


class SimulationRunner:
    """
    Orchestrates simulation and WebSocket communication.
    
    The SimulationRunner connects to the backend WebSocket, runs the simulation
    loop, sends observations, receives NN decisions, and executes spawns.
    Supports curriculum learning with automatic phase transitions.
    
    Requirements satisfied:
    - 8.1: WebSocket connection
    - 9.1: Main loop orchestration
    - 11.3: Update entity counts on transition, log phase changes
    """
    
    def __init__(self, config: 'SimulationConfig', curriculum_manager: Optional[CurriculumManager] = None):
        """
        Initialize the simulation runner with configuration and optional curriculum.
        
        Args:
            config: Simulation configuration parameters
            curriculum_manager: Optional curriculum manager for progressive difficulty
        """
        self.config = config
        self.simulator = Simulator(config, curriculum_manager)
        self.curriculum_manager = curriculum_manager
        self.ws: Optional[Any] = None
        self.connected = False
        
        # Performance tracking
        self.performance_metrics: Optional[PerformanceMetrics] = None
        
        # Curriculum tracking
        self.phase_transitions = []
        self.current_phase_start_tick = 0
        
        if self.curriculum_manager:
            initial_phase = self.curriculum_manager.get_current_phase()
            logger.info(f"Initialized with curriculum learning enabled")
            logger.info(f"Starting phase: {initial_phase.name} "
                       f"(workers={initial_phase.num_workers}, "
                       f"protectors={initial_phase.num_protectors})")
        else:
            logger.info("Initialized without curriculum learning")
        
    async def connect(self, url: str = "ws://localhost:8000/ws") -> None:
        """
        Connect to backend WebSocket.
        
        Args:
            url: WebSocket URL to connect to
            
        Raises:
            ConnectionError: If connection fails
            ImportError: If websockets library is not available
            
        Requirements satisfied:
        - 8.1: Connect to backend WebSocket
        - 8.4: Handle connection errors
        """
        if websockets is None:
            raise ImportError(
                "websockets library is required. Install with: pip install websockets"
            )
            
        try:
            logger.info(f"Connecting to WebSocket at {url}")
            self.ws = await websockets.connect(url)
            self.connected = True
            logger.info("Successfully connected to WebSocket")
            
        except Exception as e:
            logger.error(f"Failed to connect to WebSocket: {e}")
            self.connected = False
            raise ConnectionError(f"Failed to connect to WebSocket: {e}")
    
    async def run(self, num_ticks: int, continuous: bool = False) -> None:
        """
        Run simulation for specified number of ticks or continuously.

        Implements the main simulation loop:
        tick() → generate_observation() → send → receive → spawn

        Handles curriculum phase transitions and logs phase changes.
        Tracks performance metrics including ticks per second and average tick time.

        Args:
            num_ticks: Number of simulation ticks to run (ignored if continuous=True)
            continuous: If True, run indefinitely until interrupted

        Raises:
            RuntimeError: If not connected to WebSocket

        Requirements satisfied:
        - 9.1: Main loop implementation
        - 9.2: Turbo mode support
        - 11.3: Update entity counts on transition, log phase changes
        - 12.1: Ticks per second tracking
        - 12.2: Average tick time tracking
        """
        if not self.connected or self.ws is None:
            raise RuntimeError("Not connected to WebSocket. Call connect() first.")

        if continuous:
            logger.info("Starting simulation in CONTINUOUS mode (Ctrl+C to stop)")
        else:
            logger.info(f"Starting simulation for {num_ticks} ticks")
        logger.info(f"Turbo mode: {self.config.turbo_mode}")
        
        # Initialize performance metrics
        self.performance_metrics = PerformanceMetrics(start_time=time.time())
        
        # Log initial state
        self._log_simulation_state()
        
        try:
            tick = 0
            while continuous or tick < num_ticks:
                tick_start_time = time.time()

                # 1. Evolve game state (includes curriculum phase transitions)
                new_phase = self.simulator.tick()

                # 2. Handle curriculum phase transition
                if new_phase:
                    self._apply_phase(new_phase)
                    self._handle_phase_transition(new_phase, tick)

                # 3. Generate and send observation
                observation = generate_observation(self.simulator.state)
                await self._send_observation(observation)

                # 4. Receive NN decision
                response = await self._receive_response()

                # 5. Execute spawn if decision was to spawn
                if response and self._should_spawn(response):
                    success = self._execute_spawn(response)
                    data = response.get('data', {})
                    if success:
                        logger.info(f"Tick {tick}: NN spawned {data.get('spawnType')} parasite at chunk {data.get('spawnChunk')}")
                    else:
                        logger.warning(f"Tick {tick}: NN spawn failed - {data.get('spawnType')} at chunk {data.get('spawnChunk')}")
                else:
                    # Log NN decision to wait or no-spawn
                    if response:
                        resp_type = response.get("type")
                        if resp_type == "spawn_decision":
                            data = response.get("data", {})
                            if data.get("spawnChunk") == -1:
                                logger.debug(f"Tick {tick}: NN decided no-spawn (confidence: {data.get('confidence', 0):.3f})")
                            else:
                                logger.debug(f"Tick {tick}: NN response blocked by gate")
                        elif resp_type == "observation_ack":
                            logger.debug(f"Tick {tick}: Observation acknowledged (gate blocked)")
                        else:
                            logger.debug(f"Tick {tick}: NN response: {response}")
                    else:
                        logger.debug(f"Tick {tick}: No response from NN (timeout)")

                # 6. Wait for next tick (skip in turbo mode)
                if not self.config.turbo_mode:
                    await asyncio.sleep(self.config.tick_interval)

                # Record tick performance
                tick_end_time = time.time()
                tick_duration = tick_end_time - tick_start_time
                self.performance_metrics.add_tick_time(tick_duration)

                # 7. Log progress periodically
                if tick % 100 == 0:
                    if continuous:
                        logger.info(f"Simulation progress: {tick} ticks completed (continuous mode)")
                    else:
                        logger.info(f"Simulation progress: {tick}/{num_ticks} ticks completed ({tick/num_ticks*100:.1f}%)")

                    # Log performance metrics
                    current_tps = self.performance_metrics.get_ticks_per_second() if tick > 0 else 0
                    avg_tick_time = self.performance_metrics.get_average_tick_time()
                    logger.info(f"Performance - TPS: {current_tps:.1f}, Avg tick time: {avg_tick_time:.2f}ms")

                    if self.curriculum_manager:
                        progress = self.curriculum_manager.get_phase_progress()
                        logger.info(f"Curriculum - Phase: {progress['phase_name']}, "
                                   f"ticks in phase: {progress['ticks_in_phase']}")

                    # Log current entity counts
                    state = self.simulator.state
                    energy_parasites = sum(1 for p in state.parasites if p.type == "energy")
                    combat_parasites = sum(1 for p in state.parasites if p.type == "combat")
                    logger.info(f"Current state - Workers: {len(state.workers)}, "
                               f"Protectors: {len(state.protectors)}, "
                               f"Parasites: {len(state.parasites)} (E:{energy_parasites}, C:{combat_parasites}), "
                               f"Queen energy: {state.queen_energy:.1f}")

                tick += 1
                    
        except Exception as e:
            logger.error(f"Error during simulation: {e}")
            raise
        finally:
            # Finalize performance metrics
            if self.performance_metrics:
                self.performance_metrics.end_time = time.time()
            
        if continuous:
            logger.info(f"Simulation stopped after {self.simulator.state.tick} ticks")
        else:
            logger.info(f"Simulation completed after {num_ticks} ticks")
        self._log_final_statistics()
    
    def _handle_phase_transition(self, new_phase, tick: int) -> None:
        """
        Handle curriculum phase transition.
        
        Args:
            new_phase: The new curriculum phase
            tick: Current simulation tick
            
        Requirements satisfied:
        - 11.3: Log phase changes
        """
        # Record transition
        transition_info = {
            'tick': tick,
            'from_phase': self.phase_transitions[-1]['to_phase'] if self.phase_transitions else 'initial',
            'to_phase': new_phase.name,
            'ticks_in_previous_phase': tick - self.current_phase_start_tick,
            'new_workers': new_phase.num_workers,
            'new_protectors': new_phase.num_protectors
        }
        self.phase_transitions.append(transition_info)
        self.current_phase_start_tick = tick
        
        # Log detailed transition information
        logger.info("=" * 60)
        logger.info(f"CURRICULUM PHASE TRANSITION at tick {tick}")
        logger.info(f"Previous phase duration: {transition_info['ticks_in_previous_phase']} ticks")
        logger.info(f"New phase: {new_phase.name}")
        logger.info(f"Entity counts - Workers: {new_phase.num_workers}, Protectors: {new_phase.num_protectors}")
        logger.info(f"Phase duration: {new_phase.duration} ticks ({'infinite' if new_phase.duration == -1 else 'finite'})")
        logger.info("=" * 60)
        
        # Log current simulation state after transition
        self._log_simulation_state()
    
    def _apply_phase(self, phase: 'CurriculumPhase') -> None:
        """
        Apply curriculum phase configuration to update entity counts.
        
        This method delegates to the simulator's phase application logic
        and ensures the runner's tracking is updated.
        
        Args:
            phase: The curriculum phase to apply
            
        Requirements satisfied:
        - 11.3: Update entity counts on transition
        """
        # The actual phase application is handled by the simulator
        # This method exists for API consistency and future extensibility
        logger.info(f"Applying curriculum phase: {phase.name}")
        logger.info(f"Target entity counts - Workers: {phase.num_workers}, "
                   f"Protectors: {phase.num_protectors}")
        
        # Note: The simulator already applies the phase config internally
        # during its tick() method when curriculum transitions occur
    
    def _log_simulation_state(self) -> None:
        """Log current simulation state for debugging."""
        state = self.simulator.state
        logger.info(f"Simulation state - Tick: {state.tick}, "
                   f"Workers: {len(state.workers)}, "
                   f"Protectors: {len(state.protectors)}, "
                   f"Parasites: {len(state.parasites)}, "
                   f"Queen energy: {state.queen_energy:.1f}")
    
    def _log_final_statistics(self) -> None:
        """
        Log final simulation statistics including performance metrics.
        
        Requirements satisfied:
        - 12.1: Ticks per second reporting
        - 12.2: Average tick time reporting
        """
        logger.info("=" * 60)
        logger.info("SIMULATION COMPLETED")
        logger.info(f"Total ticks: {self.simulator.state.tick}")
        logger.info(f"Final state - Workers: {len(self.simulator.state.workers)}, "
                   f"Protectors: {len(self.simulator.state.protectors)}, "
                   f"Parasites: {len(self.simulator.state.parasites)}")
        
        # Log performance metrics
        if self.performance_metrics:
            perf_summary = self.performance_metrics.get_performance_summary()
            logger.info("PERFORMANCE METRICS:")
            logger.info(f"  Total elapsed time: {perf_summary['elapsed_time_seconds']:.2f} seconds")
            logger.info(f"  Ticks per second: {perf_summary['ticks_per_second']:.1f} TPS")
            logger.info(f"  Average tick time: {perf_summary['average_tick_time_ms']:.2f} ms")
            logger.info(f"  Min tick time: {perf_summary['min_tick_time_ms']:.2f} ms")
            logger.info(f"  Max tick time: {perf_summary['max_tick_time_ms']:.2f} ms")
            logger.info(f"  Tick samples collected: {perf_summary['total_tick_samples']}")
        
        if self.curriculum_manager:
            logger.info(f"Curriculum phases completed: {len(self.phase_transitions)}")
            for i, transition in enumerate(self.phase_transitions):
                logger.info(f"  Phase {i+1}: {transition['to_phase']} "
                           f"({transition['ticks_in_previous_phase']} ticks)")
            
            # Current phase info
            current_progress = self.curriculum_manager.get_phase_progress()
            logger.info(f"Final phase: {current_progress['phase_name']} "
                       f"({current_progress['ticks_in_phase']} ticks)")
        
        logger.info("=" * 60)
    
    def get_curriculum_statistics(self) -> Optional[Dict[str, Any]]:
        """
        Get curriculum learning statistics.
        
        Returns:
            Dictionary with curriculum statistics or None if no curriculum
        """
        if not self.curriculum_manager:
            return None
            
        current_progress = self.curriculum_manager.get_phase_progress()
        
        return {
            'current_phase': current_progress,
            'phase_transitions': self.phase_transitions,
            'total_phases': len(self.curriculum_manager.get_all_phases()),
            'transitions_completed': len(self.phase_transitions)
        }
    
    def get_performance_metrics(self) -> Optional[Dict[str, Any]]:
        """
        Get performance metrics for the simulation.
        
        Returns:
            Dictionary with performance metrics or None if no metrics available
            
        Requirements satisfied:
        - 12.1: Ticks per second access
        - 12.2: Average tick time access
        """
        if self.performance_metrics:
            return self.performance_metrics.get_performance_summary()
        return None
    
    async def _send_observation(self, observation: Dict[str, Any]) -> None:
        """
        Send observation to backend via WebSocket.
        
        Args:
            observation: Observation data to send
            
        Requirements satisfied:
        - 8.2: Send observations with correct message type and format
        """
        message = {
            "type": "observation_data",
            "timestamp": time.time(),
            "data": observation
        }

        try:
            await self.ws.send(json.dumps(message))
            logger.debug(f"Sent observation for tick {observation['tick']}")
            
        except Exception as e:
            logger.error(f"Failed to send observation: {e}")
            raise
    
    async def _receive_response(self, timeout: float = 2.0) -> Optional[Dict[str, Any]]:
        """
        Receive NN decision from backend via WebSocket.

        Args:
            timeout: Maximum time to wait for response in seconds

        Returns:
            Parsed response data or None if no response/timeout

        Requirements satisfied:
        - 8.3: Receive NN decisions
        """
        try:
            response_str = await asyncio.wait_for(self.ws.recv(), timeout=timeout)
            response = json.loads(response_str)
            logger.debug(f"Received response: {response}")
            return response

        except asyncio.TimeoutError:
            # Gate blocked the decision - no response sent (expected behavior)
            logger.debug("No response from backend (gate may have blocked)")
            return None

        except Exception as e:
            logger.error(f"Failed to receive response: {e}")
            return None
    
    def _should_spawn(self, response: Dict[str, Any]) -> bool:
        """
        Check if response indicates a spawn decision.

        Args:
            response: Response data from backend

        Returns:
            True if should spawn parasite, False otherwise

        Requirements satisfied:
        - 8.3: Parse spawn decisions
        """
        # Backend sends: {"type": "spawn_decision", "data": {"spawnChunk": ..., "spawnType": ...}}
        if response.get("type") == "spawn_decision":
            data = response.get("data", {})
            spawn_chunk = data.get("spawnChunk")
            spawn_type = data.get("spawnType")
            # spawnChunk of -1 means no-spawn decision
            return spawn_chunk is not None and spawn_chunk >= 0 and spawn_type is not None
        return False
    
    def _execute_spawn(self, response: Dict[str, Any]) -> bool:
        """
        Execute parasite spawn based on NN decision.

        Args:
            response: Response data containing spawn parameters

        Returns:
            True if spawn was successful, False otherwise

        Requirements satisfied:
        - 8.3: Execute spawns in simulation
        - 8.3: Handle WAIT decisions (by not spawning)
        """
        # Backend sends: {"type": "spawn_decision", "data": {"spawnChunk": ..., "spawnType": ...}}
        data = response.get("data", {})
        chunk = data.get("spawnChunk")
        parasite_type = data.get("spawnType")
        
        if chunk is None or parasite_type is None:
            logger.warning(f"Invalid spawn parameters: chunk={chunk}, type={parasite_type}")
            return False
            
        # Validate chunk is in bounds
        max_chunk = self.config.grid_size * self.config.grid_size - 1
        if not (0 <= chunk <= max_chunk):
            logger.warning(f"Spawn chunk {chunk} is out of bounds (0-{max_chunk})")
            return False
            
        # Validate parasite type
        if parasite_type not in ["energy", "combat"]:
            logger.warning(f"Invalid parasite type: {parasite_type}")
            return False
            
        # Execute spawn
        return self.simulator.spawn_parasite(chunk, parasite_type)
    
    async def close(self) -> None:
        """
        Close WebSocket connection and clean up resources.
        
        Requirements satisfied:
        - 8.4: Clean shutdown
        """
        if self.ws is not None:
            try:
                await self.ws.close()
                logger.info("WebSocket connection closed")
            except Exception as e:
                logger.warning(f"Error closing WebSocket: {e}")
            finally:
                self.ws = None
                self.connected = False
    
    def __repr__(self) -> str:
        """String representation for debugging."""
        curriculum_info = ""
        if self.curriculum_manager:
            progress = self.curriculum_manager.get_phase_progress()
            curriculum_info = f", phase={progress['phase_name']}"
        
        return (
            f"SimulationRunner("
            f"connected={self.connected}, "
            f"tick={self.simulator.state.tick}"
            f"{curriculum_info}, "
            f"config={self.config})"
        )