"""
Example usage of the SimulationRunner.

This script demonstrates how to use the SimulationRunner to connect to the
backend WebSocket and run automated training simulations, including curriculum
learning examples.
"""

import asyncio
import logging
from .config import SimulationConfig
from .runner import SimulationRunner
from .curriculum import CurriculumManager, create_default_curriculum, CurriculumPhase


# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def run_simulation_example():
    """Example of running a simulation with the SimulationRunner."""
    
    # Create configuration
    config = SimulationConfig(
        # Map settings
        grid_size=20,
        queen_chunk=200,  # Center of map
        mining_spots=[45, 67, 123, 189, 234, 312, 378],
        
        # Entity counts
        num_workers=8,
        num_protectors=3,
        
        # Simulation settings
        turbo_mode=False,  # Set to True for maximum speed
        tick_interval=0.1,  # 100ms per tick in real-time mode
        
        # Energy settings
        queen_start_energy=50,
        energy_parasite_cost=15,
        combat_parasite_cost=25,
    )
    
    # Create runner
    runner = SimulationRunner(config)
    
    try:
        # Connect to backend WebSocket
        logger.info("Connecting to backend WebSocket...")
        await runner.connect("ws://localhost:8000/ws")
        
        # Run simulation for 100 ticks
        logger.info("Starting simulation...")
        await runner.run(num_ticks=100)
        
        logger.info("Simulation completed successfully!")
        
    except ConnectionError as e:
        logger.error(f"Failed to connect to backend: {e}")
        logger.info("Make sure the backend server is running on localhost:8000")
        
    except Exception as e:
        logger.error(f"Simulation error: {e}")
        
    finally:
        # Clean up
        await runner.close()
        logger.info("WebSocket connection closed")


async def run_curriculum_simulation():
    """Example of running a simulation with curriculum learning."""
    
    # Create configuration
    config = SimulationConfig(
        grid_size=20,
        queen_chunk=200,
        mining_spots=[45, 67, 123, 189, 234, 312, 378],
        turbo_mode=True,  # Fast simulation for curriculum learning
        tick_interval=0.0,
        queen_start_energy=50,
        energy_parasite_cost=15,
        combat_parasite_cost=25,
    )
    
    # Create curriculum with custom phases
    curriculum_phases = [
        CurriculumPhase(
            name="learning_basics",
            duration=50,  # Short phases for demo
            num_workers=2,
            num_protectors=0
        ),
        CurriculumPhase(
            name="adding_defense",
            duration=50,
            num_workers=4,
            num_protectors=1
        ),
        CurriculumPhase(
            name="full_complexity",
            duration=100,
            num_workers=6,
            num_protectors=2
        )
    ]
    
    curriculum_manager = CurriculumManager(curriculum_phases)
    
    # Create runner with curriculum
    runner = SimulationRunner(config, curriculum_manager)
    
    try:
        logger.info("Starting curriculum learning simulation...")
        await runner.connect("ws://localhost:8000/ws")
        
        # Run simulation through all curriculum phases
        await runner.run(num_ticks=200)
        
        # Get curriculum statistics
        stats = runner.get_curriculum_statistics()
        if stats:
            logger.info("Curriculum Learning Results:")
            logger.info(f"  Phases completed: {stats['transitions_completed']}")
            logger.info(f"  Current phase: {stats['current_phase']['phase_name']}")
            logger.info(f"  Ticks in current phase: {stats['current_phase']['ticks_in_phase']}")
        
        logger.info("Curriculum simulation completed successfully!")
        
    except Exception as e:
        logger.error(f"Curriculum simulation error: {e}")
        
    finally:
        await runner.close()


async def run_turbo_simulation():
    """Example of running a high-speed simulation for training."""
    
    # Configuration optimized for speed
    config = SimulationConfig(
        turbo_mode=True,  # No delays between ticks
        tick_interval=0.0,
        num_workers=4,  # Fewer entities for faster simulation
        num_protectors=2,
    )
    
    runner = SimulationRunner(config)
    
    try:
        await runner.connect()
        
        logger.info("Starting turbo simulation (10,000 ticks)...")
        
        await runner.run(num_ticks=10000)
        
        # Use built-in performance metrics
        performance_metrics = runner.get_performance_metrics()
        if performance_metrics:
            logger.info(f"Turbo simulation completed in {performance_metrics['elapsed_time_seconds']:.2f}s")
            logger.info(f"Performance: {performance_metrics['ticks_per_second']:.1f} TPS")
            logger.info(f"Average tick time: {performance_metrics['average_tick_time_ms']:.2f}ms")
            logger.info(f"Min/Max tick time: {performance_metrics['min_tick_time_ms']:.2f}ms / {performance_metrics['max_tick_time_ms']:.2f}ms")
        else:
            logger.warning("Performance metrics not available")
        
    except Exception as e:
        logger.error(f"Turbo simulation error: {e}")
        
    finally:
        await runner.close()


async def run_default_curriculum():
    """Example using the default curriculum learning setup."""
    
    config = SimulationConfig(
        turbo_mode=True,
        tick_interval=0.0,
        grid_size=20,
        queen_chunk=200,
    )
    
    # Use default curriculum
    curriculum_phases = create_default_curriculum()
    curriculum_manager = CurriculumManager(curriculum_phases)
    
    runner = SimulationRunner(config, curriculum_manager)
    
    try:
        logger.info("Starting default curriculum simulation...")
        await runner.connect("ws://localhost:8000/ws")
        
        # Run through first two phases (basic + with_protectors)
        # Note: third phase is infinite, so we limit ticks
        await runner.run(num_ticks=3500)  # 1000 + 2000 + 500 extra
        
        # Log final statistics
        stats = runner.get_curriculum_statistics()
        if stats:
            logger.info("Default Curriculum Results:")
            for i, transition in enumerate(stats['phase_transitions']):
                logger.info(f"  Phase {i+1}: {transition['to_phase']} "
                           f"({transition['ticks_in_previous_phase']} ticks)")
        
    except Exception as e:
        logger.error(f"Default curriculum error: {e}")
        
    finally:
        await runner.close()


def main():
    """Main entry point."""
    import sys
    
    if len(sys.argv) > 1:
        mode = sys.argv[1]
        if mode == "turbo":
            asyncio.run(run_turbo_simulation())
        elif mode == "curriculum":
            asyncio.run(run_curriculum_simulation())
        elif mode == "default-curriculum":
            asyncio.run(run_default_curriculum())
        else:
            print("Usage: python example_usage.py [turbo|curriculum|default-curriculum]")
            print("  turbo: Run high-speed simulation")
            print("  curriculum: Run custom curriculum learning")
            print("  default-curriculum: Run with default curriculum phases")
    else:
        # Run normal simulation
        asyncio.run(run_simulation_example())


if __name__ == "__main__":
    main()