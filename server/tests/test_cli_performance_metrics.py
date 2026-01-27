#!/usr/bin/env python3
"""
Test CLI performance metrics display functionality.

This test verifies that the CLI properly displays performance metrics
after simulation completion.
"""

import asyncio
import unittest
from unittest.mock import patch, MagicMock, AsyncMock
from game_simulator.main import run_simulation
from game_simulator.config import SimulationConfig


class TestCLIPerformanceMetrics(unittest.TestCase):
    """Test CLI performance metrics display."""
    
    @patch('game_simulator.main.SimulationRunner')
    @patch('builtins.print')
    async def test_cli_displays_performance_metrics(self, mock_print, mock_runner_class):
        """Test that CLI displays performance metrics after simulation."""
        
        # Mock the runner instance
        mock_runner = MagicMock()
        mock_runner_class.return_value = mock_runner
        
        # Mock async methods
        mock_runner.connect = AsyncMock()
        mock_runner.run = AsyncMock()
        mock_runner.close = AsyncMock()
        
        # Mock the simulator state
        mock_state = MagicMock()
        mock_state.tick = 1000
        mock_state.workers = [1, 2, 3]  # 3 workers
        mock_state.protectors = [1, 2]  # 2 protectors
        mock_state.parasites = [1]  # 1 parasite
        mock_state.queen_energy = 45.5
        mock_runner.simulator.state = mock_state
        
        # Mock performance metrics
        mock_performance_metrics = {
            'elapsed_time_seconds': 10.5,
            'ticks_per_second': 95.2,
            'average_tick_time_ms': 10.5,
            'min_tick_time_ms': 8.2,
            'max_tick_time_ms': 15.3
        }
        mock_runner.get_performance_metrics.return_value = mock_performance_metrics
        
        # Mock curriculum statistics (none for this test)
        mock_runner.get_curriculum_statistics.return_value = None
        
        # Create config
        config = SimulationConfig()
        config.turbo_mode = True
        
        # Run the simulation function
        await run_simulation(
            config=config,
            num_ticks=1000,
            websocket_url="ws://localhost:8000/ws",
            use_curriculum=False
        )
        
        # Verify that performance metrics were displayed
        print_calls = [call[0][0] for call in mock_print.call_args_list if call[0]]
        
        # Check for performance metrics output
        performance_output = [call for call in print_calls if 'Performance metrics:' in call]
        self.assertTrue(len(performance_output) > 0, "Performance metrics header not found in output")
        
        # Check for specific metrics
        tps_output = [call for call in print_calls if 'Ticks per second:' in call and '95.2 TPS' in call]
        self.assertTrue(len(tps_output) > 0, "TPS metric not found in output")
        
        avg_time_output = [call for call in print_calls if 'Average tick time:' in call and '10.50 ms' in call]
        self.assertTrue(len(avg_time_output) > 0, "Average tick time not found in output")
        
        # Check for turbo mode efficiency note
        turbo_output = [call for call in print_calls if 'Turbo mode efficiency:' in call and '95 TPS achieved' in call]
        self.assertTrue(len(turbo_output) > 0, "Turbo mode efficiency note not found in output")
    
    @patch('game_simulator.main.SimulationRunner')
    @patch('builtins.print')
    async def test_cli_handles_missing_performance_metrics(self, mock_print, mock_runner_class):
        """Test that CLI handles missing performance metrics gracefully."""
        
        # Mock the runner instance
        mock_runner = MagicMock()
        mock_runner_class.return_value = mock_runner
        
        # Mock async methods
        mock_runner.connect = AsyncMock()
        mock_runner.run = AsyncMock()
        mock_runner.close = AsyncMock()
        
        # Mock the simulator state
        mock_state = MagicMock()
        mock_state.tick = 100
        mock_state.workers = []
        mock_state.protectors = []
        mock_state.parasites = []
        mock_state.queen_energy = 50.0
        mock_runner.simulator.state = mock_state
        
        # Mock no performance metrics
        mock_runner.get_performance_metrics.return_value = None
        mock_runner.get_curriculum_statistics.return_value = None
        
        # Create config
        config = SimulationConfig()
        config.turbo_mode = False
        
        # Run the simulation function
        await run_simulation(
            config=config,
            num_ticks=100,
            websocket_url="ws://localhost:8000/ws",
            use_curriculum=False
        )
        
        # Verify that no performance metrics were displayed
        print_calls = [call[0][0] for call in mock_print.call_args_list if call[0]]
        
        # Check that performance metrics section is not present
        performance_output = [call for call in print_calls if 'Performance metrics:' in call]
        self.assertEqual(len(performance_output), 0, "Performance metrics should not be displayed when None")


def run_async_test():
    """Helper to run async tests."""
    async def run_tests():
        test_case = TestCLIPerformanceMetrics()
        await test_case.test_cli_displays_performance_metrics()
        await test_case.test_cli_handles_missing_performance_metrics()
        print("All CLI performance metrics tests passed!")
    
    asyncio.run(run_tests())


if __name__ == '__main__':
    run_async_test()