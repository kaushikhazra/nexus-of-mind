#!/usr/bin/env python3
"""
Main CLI entry point for the game simulator.

This script provides a command-line interface for running the game simulator
with configurable parameters. It supports loading configuration from YAML files,
setting simulation parameters, and running in different modes.

Usage:
    python -m server.game_simulator.main [options]

Examples:
    # Run with default config, real-time speed
    python -m server.game_simulator.main

    # Run in turbo mode for 10k ticks
    python -m server.game_simulator.main --turbo --ticks 10000

    # Use custom config
    python -m server.game_simulator.main --config my_config.yaml

    # Connect to different WebSocket URL
    python -m server.game_simulator.main --url ws://remote-server:8000/ws
"""

import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Optional

# Add the server directory to the path so we can import modules
server_dir = Path(__file__).parent.parent
if str(server_dir) not in sys.path:
    sys.path.insert(0, str(server_dir))

from game_simulator.config import SimulationConfig
from game_simulator.runner import SimulationRunner
from game_simulator.curriculum import CurriculumManager, create_default_curriculum


def setup_logging(verbose: bool = False) -> None:
    """
    Set up logging configuration.
    
    Args:
        verbose: If True, enable debug logging
    """
    level = logging.DEBUG if verbose else logging.INFO
    
    # Configure logging format
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Reduce noise from websockets library
    logging.getLogger('websockets').setLevel(logging.WARNING)


def parse_arguments() -> argparse.Namespace:
    """
    Parse command line arguments.
    
    Returns:
        Parsed arguments namespace
        
    Requirements satisfied:
    - 9.3: CLI arguments for config, ticks, turbo, url
    """
    parser = argparse.ArgumentParser(
        description='Game Simulator - Automated training data generation for Queen NN',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                                    # Run with defaults
  %(prog)s --turbo --ticks 10000             # Fast training run
  %(prog)s --config custom.yaml              # Custom configuration
  %(prog)s --url ws://remote:8000/ws         # Remote backend
  %(prog)s --curriculum --ticks 5000         # Curriculum learning
  %(prog)s --continuous --turbo              # Run continuously until Ctrl+C
        """
    )
    
    # Configuration options
    parser.add_argument(
        '--config', '-c',
        type=str,
        help='Path to YAML configuration file (default: use built-in defaults)'
    )
    
    # Simulation parameters
    parser.add_argument(
        '--ticks', '-t',
        type=int,
        default=1000,
        help='Number of simulation ticks to run (default: 1000)'
    )
    
    parser.add_argument(
        '--turbo',
        action='store_true',
        help='Enable turbo mode (no delays, maximum speed)'
    )
    
    parser.add_argument(
        '--url', '-u',
        type=str,
        default='ws://localhost:8000/ws',
        help='WebSocket URL to connect to (default: ws://localhost:8000/ws)'
    )
    
    # Curriculum learning
    parser.add_argument(
        '--curriculum',
        action='store_true',
        help='Enable curriculum learning with default phases'
    )

    # Continuous mode
    parser.add_argument(
        '--continuous',
        action='store_true',
        help='Run continuously until interrupted (ignores --ticks)'
    )
    
    # Logging options
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose debug logging'
    )
    
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='Suppress all output except errors'
    )
    
    return parser.parse_args()


def load_config(config_path: Optional[str], turbo_override: bool = False) -> SimulationConfig:
    """
    Load simulation configuration from file or use defaults.
    
    Args:
        config_path: Path to YAML config file, or None for defaults
        turbo_override: If True, override turbo_mode setting
        
    Returns:
        Loaded and validated configuration
        
    Raises:
        FileNotFoundError: If config file doesn't exist
        ValueError: If config is invalid
        
    Requirements satisfied:
    - 9.3: Load config from file
    """
    if config_path:
        # Load from specified file
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
        
        print(f"Loading configuration from: {config_path}")
        config = SimulationConfig.from_yaml(config_path)
    else:
        # Use default configuration
        print("Using default configuration")
        config = SimulationConfig()
    
    # Apply turbo mode override if specified
    if turbo_override:
        config.turbo_mode = True
        config.tick_interval = 0.0
        print("Turbo mode enabled (overriding config)")
    
    return config


async def run_simulation(
    config: SimulationConfig,
    num_ticks: int,
    websocket_url: str,
    use_curriculum: bool = False,
    continuous: bool = False
) -> None:
    """
    Run the simulation with the given parameters.

    Args:
        config: Simulation configuration
        num_ticks: Number of ticks to run (ignored if continuous=True)
        websocket_url: WebSocket URL to connect to
        use_curriculum: Whether to enable curriculum learning
        continuous: If True, run indefinitely until interrupted

    Requirements satisfied:
    - 9.3: Run simulation with parsed parameters
    """
    # Create curriculum manager if requested
    curriculum_manager = None
    if use_curriculum:
        curriculum_phases = create_default_curriculum()
        curriculum_manager = CurriculumManager(curriculum_phases)
        print("Curriculum learning enabled with default phases")
    
    # Create simulation runner
    runner = SimulationRunner(config, curriculum_manager)
    
    try:
        # Connect to backend
        print(f"Connecting to WebSocket at {websocket_url}")
        await runner.connect(websocket_url)
        print("Successfully connected to backend")
        
        # Log simulation parameters
        print(f"Starting simulation:")
        print(f"  Mode: {'continuous' if continuous else f'{num_ticks} ticks'}")
        print(f"  Turbo mode: {config.turbo_mode}")
        print(f"  Workers: {config.num_workers}")
        print(f"  Protectors: {config.num_protectors}")
        if use_curriculum:
            print(f"  Curriculum phases: {len(curriculum_manager.get_all_phases())}")
        if continuous:
            print(f"  Press Ctrl+C to stop")

        # Run simulation
        await runner.run(num_ticks, continuous=continuous)
        
        # Print final statistics
        print("\nSimulation completed successfully!")
        
        if use_curriculum:
            stats = runner.get_curriculum_statistics()
            if stats and stats['phase_transitions']:
                print(f"Curriculum phases completed: {len(stats['phase_transitions'])}")
                for i, transition in enumerate(stats['phase_transitions']):
                    print(f"  Phase {i+1}: {transition['to_phase']} "
                          f"({transition['ticks_in_previous_phase']} ticks)")
        
        final_state = runner.simulator.state
        print(f"Final state:")
        print(f"  Total ticks: {final_state.tick}")
        print(f"  Workers: {len(final_state.workers)}")
        print(f"  Protectors: {len(final_state.protectors)}")
        print(f"  Active parasites: {len(final_state.parasites)}")
        print(f"  Queen energy: {final_state.queen_energy:.1f}")
        
        # Print performance metrics
        performance_metrics = runner.get_performance_metrics()
        if performance_metrics:
            print(f"Performance metrics:")
            print(f"  Elapsed time: {performance_metrics['elapsed_time_seconds']:.2f} seconds")
            print(f"  Ticks per second: {performance_metrics['ticks_per_second']:.1f} TPS")
            print(f"  Average tick time: {performance_metrics['average_tick_time_ms']:.2f} ms")
            print(f"  Min tick time: {performance_metrics['min_tick_time_ms']:.2f} ms")
            print(f"  Max tick time: {performance_metrics['max_tick_time_ms']:.2f} ms")
            
            # Special note for turbo mode performance
            if config.turbo_mode:
                print(f"  Turbo mode efficiency: {performance_metrics['ticks_per_second']:.0f} TPS achieved")
        
    except ConnectionError as e:
        print(f"ERROR: Failed to connect to backend: {e}")
        print("Make sure the backend server is running and accessible")
        sys.exit(1)
        
    except KeyboardInterrupt:
        print("\nSimulation interrupted by user")
        
    except Exception as e:
        print(f"ERROR: Simulation failed: {e}")
        sys.exit(1)
        
    finally:
        # Clean up connection
        await runner.close()
        print("WebSocket connection closed")


def main() -> None:
    """
    Main entry point for the CLI.
    
    Requirements satisfied:
    - 9.3: Parse arguments, load config, run simulation
    """
    # Parse command line arguments
    args = parse_arguments()
    
    # Set up logging
    if args.quiet:
        logging.disable(logging.CRITICAL)
    else:
        setup_logging(args.verbose)
    
    try:
        # Load configuration
        config = load_config(args.config, args.turbo)
        
        # Validate arguments
        if args.ticks <= 0:
            print("ERROR: Number of ticks must be positive")
            sys.exit(1)
        
        # Run simulation
        asyncio.run(run_simulation(
            config=config,
            num_ticks=args.ticks,
            websocket_url=args.url,
            use_curriculum=args.curriculum,
            continuous=args.continuous
        ))
        
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
        
    except ValueError as e:
        print(f"ERROR: Invalid configuration: {e}")
        sys.exit(1)
        
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(1)
        
    except Exception as e:
        print(f"ERROR: Unexpected error: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()