#!/usr/bin/env python3
"""
Test logging integration for the game simulator.

This test verifies that the enhanced logging works correctly.
"""

import logging
import unittest
from unittest.mock import patch, MagicMock
from server.game_simulator.config import SimulationConfig
from server.game_simulator.simulator import Simulator


class TestLoggingIntegration(unittest.TestCase):
    """Test logging integration."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.config = SimulationConfig()
        self.simulator = Simulator(self.config)
    
    @patch('server.game_simulator.simulator.logger')
    def test_tick_logging(self, mock_logger):
        """Test that tick logging works correctly."""
        # Run a few ticks
        for _ in range(5):
            self.simulator.tick()
        
        # Verify that logging was called
        self.assertTrue(mock_logger.debug.called or mock_logger.info.called)
    
    @patch('server.game_simulator.simulator.logger')
    def test_spawn_logging(self, mock_logger):
        """Test that spawn event logging works correctly."""
        # Test successful spawn
        success = self.simulator.spawn_parasite(100, "energy")
        self.assertTrue(success)
        
        # Verify spawn was logged
        mock_logger.info.assert_called()
        call_args = mock_logger.info.call_args[0][0]
        self.assertIn("Spawned energy parasite", call_args)
        
        # Test failed spawn (insufficient energy)
        self.simulator.state.queen_energy = 5  # Not enough for any parasite
        success = self.simulator.spawn_parasite(100, "energy")
        self.assertFalse(success)
        
        # Verify failure was logged
        mock_logger.debug.assert_called()
        call_args = mock_logger.debug.call_args[0][0]
        self.assertIn("Failed to spawn", call_args)
    
    def test_performance_metrics_integration(self):
        """Test that performance metrics integrate with simulation."""
        from server.game_simulator.runner import SimulationRunner
        
        runner = SimulationRunner(self.config)
        
        # Verify performance metrics are available
        self.assertIsNone(runner.get_performance_metrics())  # None before run
        
        # Initialize performance metrics manually (normally done in run())
        from server.game_simulator.runner import PerformanceMetrics
        import time
        runner.performance_metrics = PerformanceMetrics(start_time=time.time())
        runner.performance_metrics.add_tick_time(0.001)
        runner.performance_metrics.end_time = time.time()
        
        # Verify metrics are now available
        metrics = runner.get_performance_metrics()
        self.assertIsNotNone(metrics)
        self.assertIn('ticks_per_second', metrics)
        self.assertIn('average_tick_time_ms', metrics)


if __name__ == '__main__':
    # Set up logging for test
    logging.basicConfig(level=logging.DEBUG)
    unittest.main()