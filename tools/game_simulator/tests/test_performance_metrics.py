#!/usr/bin/env python3
"""
Test performance metrics functionality for the game simulator.

This test verifies that performance metrics are correctly tracked and calculated.
"""

import time
import unittest
from game_simulator.runner import PerformanceMetrics


class TestPerformanceMetrics(unittest.TestCase):
    """Test performance metrics tracking."""
    
    def test_performance_metrics_basic(self):
        """Test basic performance metrics functionality."""
        start_time = time.time()
        metrics = PerformanceMetrics(start_time=start_time)
        
        # Simulate some tick times
        tick_times = [0.001, 0.002, 0.0015, 0.0025, 0.001]  # 1-2.5ms ticks
        
        for tick_time in tick_times:
            metrics.add_tick_time(tick_time)
        
        # Finalize metrics
        metrics.end_time = start_time + 0.1  # 100ms total
        
        # Test calculations
        self.assertEqual(metrics.total_ticks, 5)
        self.assertAlmostEqual(metrics.get_ticks_per_second(), 50.0, places=1)  # 5 ticks / 0.1s = 50 TPS
        
        # Test average tick time (should be around 1.7ms)
        expected_avg = sum(tick_times) / len(tick_times) * 1000  # Convert to ms
        self.assertAlmostEqual(metrics.get_average_tick_time(), expected_avg, places=2)
        
        # Test min/max
        self.assertAlmostEqual(metrics.get_min_tick_time(), 1.0, places=1)  # 0.001s = 1ms
        self.assertAlmostEqual(metrics.get_max_tick_time(), 2.5, places=1)  # 0.0025s = 2.5ms
    
    def test_performance_summary(self):
        """Test performance summary generation."""
        start_time = time.time()
        metrics = PerformanceMetrics(start_time=start_time)
        
        # Add some tick times
        metrics.add_tick_time(0.001)
        metrics.add_tick_time(0.002)
        metrics.end_time = start_time + 0.01  # 10ms total
        
        summary = metrics.get_performance_summary()
        
        # Verify summary structure
        required_keys = [
            'total_ticks', 'elapsed_time_seconds', 'ticks_per_second',
            'average_tick_time_ms', 'min_tick_time_ms', 'max_tick_time_ms',
            'total_tick_samples'
        ]
        
        for key in required_keys:
            self.assertIn(key, summary)
        
        # Verify values
        self.assertEqual(summary['total_ticks'], 2)
        self.assertEqual(summary['total_tick_samples'], 2)
        self.assertAlmostEqual(summary['elapsed_time_seconds'], 0.01, places=3)
        self.assertAlmostEqual(summary['ticks_per_second'], 200.0, places=1)  # 2 ticks / 0.01s = 200 TPS
    
    def test_empty_metrics(self):
        """Test metrics with no data."""
        metrics = PerformanceMetrics(start_time=time.time())
        
        self.assertEqual(metrics.get_ticks_per_second(), 0.0)
        self.assertEqual(metrics.get_average_tick_time(), 0.0)
        self.assertEqual(metrics.get_min_tick_time(), 0.0)
        self.assertEqual(metrics.get_max_tick_time(), 0.0)


if __name__ == '__main__':
    unittest.main()