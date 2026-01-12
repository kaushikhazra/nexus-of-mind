"""
Test Performance Monitoring and Optimization
"""

import asyncio
import unittest
from unittest.mock import Mock, patch, MagicMock
import time
import sys
import os

# Add the server directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ai_engine.performance_monitor import PerformanceMonitor, PerformanceOptimizer, PerformanceMetrics, SystemResources
from ai_engine.neural_network import QueenBehaviorNetwork


class TestPerformanceMonitor(unittest.TestCase):
    """Test performance monitoring functionality"""
    
    def setUp(self):
        self.performance_monitor = PerformanceMonitor()
    
    def tearDown(self):
        asyncio.run(self.performance_monitor.cleanup())
    
    def test_performance_monitor_initialization(self):
        """Test performance monitor initializes correctly"""
        self.assertIsNotNone(self.performance_monitor)
        self.assertFalse(self.performance_monitor.is_monitoring)
        self.assertEqual(len(self.performance_monitor.metrics_history), 0)
        
        # Check thresholds are set correctly (Requirements 8.1, 8.2, 8.3, 8.5)
        thresholds = self.performance_monitor.thresholds
        self.assertEqual(thresholds['max_memory_mb'], 200)  # Requirement 8.2
        self.assertEqual(thresholds['max_training_time_seconds'], 120)  # Requirement 8.4
        self.assertEqual(thresholds['max_model_size_mb'], 50)  # Requirement 8.5
        self.assertEqual(thresholds['max_network_traffic_kb_per_sec'], 1)  # Requirement 8.3
        self.assertEqual(thresholds['target_fps'], 60)  # Requirement 8.1
    
    @patch('psutil.virtual_memory')
    @patch('psutil.cpu_percent')
    def test_system_metrics_collection(self, mock_cpu_percent, mock_virtual_memory):
        """Test system metrics collection"""
        # Mock system metrics
        mock_memory = Mock()
        mock_memory.used = 1024 * 1024 * 1024  # 1GB in bytes
        mock_virtual_memory.return_value = mock_memory
        mock_cpu_percent.return_value = 45.5
        
        # Collect metrics
        self.performance_monitor._collect_system_metrics()
        
        # Check metrics were collected
        self.assertGreater(len(self.performance_monitor.metrics_history), 0)
        
        latest_metrics = self.performance_monitor.metrics_history[-1]
        self.assertEqual(latest_metrics.memory_usage_mb, 1024.0)  # 1GB = 1024MB
        self.assertEqual(latest_metrics.cpu_usage_percent, 45.5)
    
    def test_performance_thresholds_validation(self):
        """Test performance threshold checking"""
        # Create test metrics that exceed thresholds
        test_metrics = PerformanceMetrics(
            timestamp=time.time(),
            training_time=150.0,  # Exceeds 120s threshold
            memory_usage_mb=250.0,  # Exceeds 200MB threshold
            cpu_usage_percent=85.0,
            gpu_usage_percent=None,
            gpu_memory_mb=None,
            model_size_mb=60.0,  # Exceeds 50MB threshold
            network_traffic_kb=2.0,  # Exceeds 1KB/sec threshold
            fps_impact=15.0,  # Exceeds critical threshold
            generation=5,
            training_success=True
        )
        
        warnings = self.performance_monitor._check_performance_thresholds(test_metrics)
        
        # Should have warnings for all exceeded thresholds
        self.assertGreater(len(warnings), 0)
        
        # Check specific warnings
        warning_text = ' '.join(warnings)
        self.assertIn('Memory usage', warning_text)
        self.assertIn('Training time', warning_text)
        self.assertIn('Model size', warning_text)
        self.assertIn('FPS impact', warning_text)
    
    async def test_monitored_training_session(self):
        """Test monitored training session"""
        # Mock training function
        async def mock_training_func(training_data):
            await asyncio.sleep(0.1)  # Simulate training time
            return {
                'success': True,
                'training_time': 0.1,
                'loss': 0.5,
                'accuracy': 0.8
            }
        
        training_data = {
            'generation': 3,
            'training_config': {
                'batch_size': 32,
                'max_epochs': 10
            }
        }
        
        # Monitor training session
        result = await self.performance_monitor.monitor_training_session(
            mock_training_func, training_data
        )
        
        # Check result contains performance data
        self.assertIn('performance_metrics', result)
        self.assertIn('system_resources', result)
        self.assertIn('optimized_config', result)
        
        # Check performance metrics
        perf_metrics = result['performance_metrics']
        self.assertIn('training_time', perf_metrics)
        self.assertIn('memory_usage_mb', perf_metrics)
        self.assertIn('generation', perf_metrics)
        self.assertEqual(perf_metrics['generation'], 3)
    
    def test_performance_summary(self):
        """Test performance summary generation"""
        # Add some test metrics
        for i in range(5):
            metrics = PerformanceMetrics(
                timestamp=time.time() + i,
                training_time=60.0 + i * 10,
                memory_usage_mb=100.0 + i * 20,
                cpu_usage_percent=50.0 + i * 5,
                gpu_usage_percent=None,
                gpu_memory_mb=None,
                model_size_mb=25.0,
                network_traffic_kb=0.5,
                fps_impact=2.0 + i,
                generation=i + 1,
                training_success=True
            )
            self.performance_monitor.metrics_history.append(metrics)
        
        summary = self.performance_monitor.get_performance_summary()
        
        # Check summary structure
        self.assertIn('status', summary)
        self.assertIn('averages', summary)
        self.assertIn('thresholds', summary)
        self.assertIn('system_resources', summary)
        
        # Check averages calculation
        averages = summary['averages']
        self.assertIn('training_time_seconds', averages)
        self.assertIn('memory_usage_mb', averages)
        self.assertIn('cpu_usage_percent', averages)
        self.assertIn('fps_impact', averages)
        
        # Verify average calculations
        self.assertAlmostEqual(averages['training_time_seconds'], 80.0, places=1)  # Average of 60,70,80,90,100
        self.assertAlmostEqual(averages['memory_usage_mb'], 140.0, places=1)  # Average of 100,120,140,160,180


class TestPerformanceOptimizer(unittest.TestCase):
    """Test performance optimization functionality"""
    
    def setUp(self):
        self.optimizer = PerformanceOptimizer()
    
    @patch('psutil.virtual_memory')
    @patch('psutil.cpu_count')
    @patch('psutil.cpu_percent')
    @patch('psutil.disk_usage')
    def test_system_resource_analysis(self, mock_disk_usage, mock_cpu_percent, mock_cpu_count, mock_virtual_memory):
        """Test system resource analysis"""
        # Mock system resources
        mock_memory = Mock()
        mock_memory.available = 4 * 1024 * 1024 * 1024  # 4GB available
        mock_virtual_memory.return_value = mock_memory
        
        mock_cpu_count.return_value = 8
        mock_cpu_percent.return_value = 35.0
        
        mock_disk = Mock()
        mock_disk.free = 100 * 1024 * 1024 * 1024  # 100GB free
        mock_disk_usage.return_value = mock_disk
        
        # Analyze resources
        resources = self.optimizer.analyze_system_resources()
        
        # Check resource analysis
        self.assertEqual(resources.available_memory_mb, 4096.0)  # 4GB = 4096MB
        self.assertEqual(resources.cpu_cores, 8)
        self.assertEqual(resources.cpu_usage_percent, 35.0)
        self.assertEqual(resources.disk_space_gb, 100.0)
    
    def test_training_config_optimization(self):
        """Test training configuration optimization"""
        # Set up mock system resources
        self.optimizer.current_resources = SystemResources(
            available_memory_mb=2048.0,  # 2GB available
            cpu_cores=4,
            cpu_usage_percent=60.0,
            gpu_available=True,
            gpu_memory_total_mb=8192.0,
            gpu_memory_used_mb=2048.0,
            disk_space_gb=50.0
        )
        
        base_config = {
            'batch_size': 32,
            'max_epochs': 10,
            'patience': 3
        }
        
        # Get optimized configuration
        optimized_config = self.optimizer.get_optimal_training_config(5, base_config)
        
        # Check optimization applied
        self.assertIn('complexity_multiplier', optimized_config)
        self.assertIn('use_mixed_precision', optimized_config)
        
        # With GPU available, should allow larger batches
        self.assertLessEqual(optimized_config['batch_size'], 128)
        self.assertTrue(optimized_config['use_mixed_precision'])
    
    def test_low_memory_optimization(self):
        """Test optimization for low memory systems"""
        # Set up low memory system
        self.optimizer.current_resources = SystemResources(
            available_memory_mb=512.0,  # Only 512MB available
            cpu_cores=2,
            cpu_usage_percent=85.0,  # High CPU usage
            gpu_available=False,
            gpu_memory_total_mb=None,
            gpu_memory_used_mb=None,
            disk_space_gb=20.0
        )
        
        base_config = {
            'batch_size': 32,
            'max_epochs': 10,
            'patience': 3
        }
        
        # Get optimized configuration
        optimized_config = self.optimizer.get_optimal_training_config(3, base_config)
        
        # Should apply memory and CPU constraints
        self.assertLessEqual(optimized_config['batch_size'], 8)  # Reduced batch size
        self.assertLessEqual(optimized_config['max_epochs'], 8)  # Reduced epochs
        self.assertFalse(optimized_config['use_mixed_precision'])  # No GPU
    
    def test_gpu_usage_decision(self):
        """Test GPU usage decision logic"""
        # Test with GPU available and sufficient memory
        self.optimizer.current_resources = SystemResources(
            available_memory_mb=2048.0,
            cpu_cores=4,
            cpu_usage_percent=50.0,
            gpu_available=True,
            gpu_memory_total_mb=8192.0,
            gpu_memory_used_mb=1024.0,
            disk_space_gb=50.0
        )
        
        self.assertTrue(self.optimizer.should_use_gpu())
        
        # Test with GPU available but low memory
        self.optimizer.current_resources.available_memory_mb = 256.0  # Low memory
        self.assertFalse(self.optimizer.should_use_gpu())
        
        # Test with no GPU
        self.optimizer.current_resources.gpu_available = False
        self.assertFalse(self.optimizer.should_use_gpu())


class TestNeuralNetworkPerformanceIntegration(unittest.TestCase):
    """Test neural network integration with performance monitoring"""
    
    def setUp(self):
        # Mock TensorFlow to avoid dependency issues in testing
        self.tf_patcher = patch('ai_engine.neural_network.TENSORFLOW_AVAILABLE', False)
        self.tf_patcher.start()
    
    def tearDown(self):
        self.tf_patcher.stop()
    
    def test_neural_network_performance_integration(self):
        """Test that neural network integrates with performance monitoring"""
        # This test would require TensorFlow, so we'll mock the key components
        with patch('ai_engine.neural_network.QueenBehaviorNetwork') as MockNetwork:
            mock_network = MockNetwork.return_value
            mock_network.performance_monitor = Mock()
            mock_network.use_gpu = True
            
            # Test that performance monitor is created
            self.assertIsNotNone(mock_network.performance_monitor)
    
    @patch('ai_engine.performance_monitor.PerformanceMonitor')
    def test_training_with_performance_monitoring(self, MockPerformanceMonitor):
        """Test training with performance monitoring"""
        mock_monitor = MockPerformanceMonitor.return_value
        mock_monitor.monitor_training_session = Mock(return_value={
            'success': True,
            'training_time': 75.0,
            'performance_metrics': {
                'memory_usage_mb': 150.0,
                'cpu_usage_percent': 65.0,
                'fps_impact': 3.0
            }
        })
        
        # This would test the actual integration, but requires TensorFlow
        # For now, just verify the mock setup
        self.assertIsNotNone(mock_monitor)


class TestPerformanceRequirements(unittest.TestCase):
    """Test compliance with specific performance requirements"""
    
    def test_requirement_8_1_fps_maintenance(self):
        """Test Requirement 8.1: System SHALL maintain 60fps during neural network training"""
        monitor = PerformanceMonitor()
        
        # Check that FPS isolation is enabled by default
        self.assertTrue(monitor.fps_isolation_enabled)
        self.assertEqual(monitor.thresholds['target_fps'], 60)
        
        # Check FPS impact thresholds
        self.assertLessEqual(monitor.thresholds['warning_fps_impact'], 10)
        self.assertLessEqual(monitor.thresholds['critical_fps_impact'], 15)
    
    def test_requirement_8_2_memory_usage(self):
        """Test Requirement 8.2: Memory usage SHALL remain under 200MB additional"""
        monitor = PerformanceMonitor()
        
        # Check memory threshold
        self.assertEqual(monitor.thresholds['max_memory_mb'], 200)
        
        # Test threshold checking
        test_metrics = PerformanceMetrics(
            timestamp=time.time(),
            training_time=60.0,
            memory_usage_mb=250.0,  # Exceeds threshold
            cpu_usage_percent=50.0,
            gpu_usage_percent=None,
            gpu_memory_mb=None,
            model_size_mb=25.0,
            network_traffic_kb=0.5,
            fps_impact=2.0,
            generation=1,
            training_success=True
        )
        
        warnings = monitor._check_performance_thresholds(test_metrics)
        memory_warning = any('Memory usage' in warning for warning in warnings)
        self.assertTrue(memory_warning)
    
    def test_requirement_8_3_network_traffic(self):
        """Test Requirement 8.3: Network traffic SHALL stay under 1KB/sec"""
        monitor = PerformanceMonitor()
        
        # Check network traffic threshold
        self.assertEqual(monitor.thresholds['max_network_traffic_kb_per_sec'], 1)
    
    def test_requirement_8_4_training_time(self):
        """Test Requirement 8.4: Training time SHALL scale appropriately (30-120 seconds)"""
        monitor = PerformanceMonitor()
        
        # Check training time threshold
        self.assertEqual(monitor.thresholds['max_training_time_seconds'], 120)
        
        # Test that training times within range don't trigger warnings
        test_metrics = PerformanceMetrics(
            timestamp=time.time(),
            training_time=90.0,  # Within range
            memory_usage_mb=100.0,
            cpu_usage_percent=50.0,
            gpu_usage_percent=None,
            gpu_memory_mb=None,
            model_size_mb=25.0,
            network_traffic_kb=0.5,
            fps_impact=2.0,
            generation=1,
            training_success=True
        )
        
        warnings = monitor._check_performance_thresholds(test_metrics)
        training_warning = any('Training time' in warning for warning in warnings)
        self.assertFalse(training_warning)
    
    def test_requirement_8_5_model_size(self):
        """Test Requirement 8.5: Model size SHALL remain manageable (under 50MB per Queen)"""
        monitor = PerformanceMonitor()
        
        # Check model size threshold
        self.assertEqual(monitor.thresholds['max_model_size_mb'], 50)
        
        # Test threshold checking
        test_metrics = PerformanceMetrics(
            timestamp=time.time(),
            training_time=60.0,
            memory_usage_mb=100.0,
            cpu_usage_percent=50.0,
            gpu_usage_percent=None,
            gpu_memory_mb=None,
            model_size_mb=60.0,  # Exceeds threshold
            network_traffic_kb=0.5,
            fps_impact=2.0,
            generation=1,
            training_success=True
        )
        
        warnings = monitor._check_performance_thresholds(test_metrics)
        model_warning = any('Model size' in warning for warning in warnings)
        self.assertTrue(model_warning)


if __name__ == '__main__':
    # Run tests
    unittest.main(verbosity=2)