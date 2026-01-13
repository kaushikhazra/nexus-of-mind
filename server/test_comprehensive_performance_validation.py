"""
Comprehensive Performance Validation Test Suite
Tests all performance targets across optimization scenarios and validates learning quality preservation
"""

import asyncio
import pytest
import numpy as np
import time
import tempfile
import os
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, Any, List
import concurrent.futures
import threading

# Import the neural network and optimization systems
from ai_engine.neural_network import QueenBehaviorNetwork
from ai_engine.optimization_configuration_system import (
    OptimizationConfigurationManager, OptimizationFeature, OptimizationLevel
)
from ai_engine.neural_network_integration import NeuralNetworkOptimizationIntegrator


class TestComprehensivePerformanceValidation:
    """Comprehensive performance validation across all optimization scenarios"""
    
    @pytest.fixture
    async def neural_network(self):
        """Create a neural network instance for testing"""
        with patch('ai_engine.neural_network.TENSORFLOW_AVAILABLE', True):
            with patch('tensorflow.keras.Sequential') as mock_sequential:
                # Mock the TensorFlow model with realistic performance characteristics
                mock_model = Mock()
                mock_model.compile = Mock()
                mock_model.count_params = Mock(return_value=1000)
                
                # Mock predict with timing simulation
                def mock_predict(features, verbose=0):
                    # Simulate inference time based on optimization level
                    time.sleep(0.010)  # 10ms base inference time
                    return np.random.random((features.shape[0], 20))
                
                mock_model.predict = mock_predict
                mock_model.fit = Mock()
                mock_model.save = Mock()
                mock_sequential.return_value = mock_model
                
                # Create neural network
                nn = QueenBehaviorNetwork()
                nn.model = mock_model
                
                yield nn
                
                # Cleanup
                if hasattr(nn, 'cleanup'):
                    await nn.cleanup()
    
    @pytest.fixture
    def config_manager(self):
        """Create optimization configuration manager for testing"""
        with tempfile.TemporaryDirectory() as temp_dir:
            manager = OptimizationConfigurationManager(config_dir=temp_dir)
            yield manager
    
    @pytest.fixture
    async def integration_system(self, neural_network):
        """Create integration system for testing"""
        integrator = NeuralNetworkOptimizationIntegrator(neural_network)
        yield integrator
        
        # Cleanup
        await integrator.cleanup()
    
    @pytest.mark.asyncio
    async def test_inference_time_target_16ms(self, neural_network, integration_system):
        """Test inference time meets <16ms target across all optimization scenarios"""
        
        # Test data
        test_features = np.random.random((1, 50)).astype(np.float32)
        
        # Test scenarios with different optimization levels
        scenarios = [
            ('development', 'Conservative optimizations'),
            ('balanced', 'Balanced optimizations'),
            ('production', 'Aggressive optimizations')
        ]
        
        for profile_name, description in scenarios:
            # Switch to profile
            integration_system.config_manager.set_active_profile(profile_name)
            await integration_system.initialize_optimizations()
            
            # Measure inference time over multiple runs
            inference_times = []
            for _ in range(20):  # 20 runs for statistical significance
                start_time = time.perf_counter()
                await integration_system.optimized_predict_strategy(test_features)
                end_time = time.perf_counter()
                
                inference_time_ms = (end_time - start_time) * 1000
                inference_times.append(inference_time_ms)
            
            # Calculate statistics
            avg_inference_time = sum(inference_times) / len(inference_times)
            max_inference_time = max(inference_times)
            p95_inference_time = sorted(inference_times)[int(0.95 * len(inference_times))]
            
            print(f"\n{description} ({profile_name}):")
            print(f"  Average inference time: {avg_inference_time:.2f}ms")
            print(f"  Maximum inference time: {max_inference_time:.2f}ms")
            print(f"  95th percentile: {p95_inference_time:.2f}ms")
            
            # Validate performance targets
            if profile_name == 'production':
                # Production should meet strict 16ms target
                assert avg_inference_time < 16.0, f"Production average inference time {avg_inference_time:.2f}ms exceeds 16ms target"
                assert p95_inference_time < 20.0, f"Production 95th percentile {p95_inference_time:.2f}ms exceeds 20ms limit"
            elif profile_name == 'balanced':
                # Balanced should meet 20ms target
                assert avg_inference_time < 20.0, f"Balanced average inference time {avg_inference_time:.2f}ms exceeds 20ms target"
            else:
                # Development should meet 50ms target
                assert avg_inference_time < 50.0, f"Development average inference time {avg_inference_time:.2f}ms exceeds 50ms target"
    
    @pytest.mark.asyncio
    async def test_throughput_target_100_predictions_per_second(self, neural_network, integration_system):
        """Test system achieves >100 predictions/sec throughput target"""
        
        # Initialize with production profile for maximum performance
        integration_system.config_manager.set_active_profile('production')
        await integration_system.initialize_optimizations()
        
        # Create batch of test data
        batch_size = 50
        batch_features = [
            np.random.random((1, 50)).astype(np.float32) for _ in range(batch_size)
        ]
        
        # Measure throughput over multiple batch runs
        throughput_measurements = []
        
        for run in range(5):  # 5 batch runs
            start_time = time.perf_counter()
            
            # Process batch
            results = await neural_network.predict_batch_async(batch_features)
            
            end_time = time.perf_counter()
            
            # Calculate throughput
            total_time = end_time - start_time
            throughput = len(results) / total_time  # predictions per second
            throughput_measurements.append(throughput)
            
            print(f"Batch run {run + 1}: {throughput:.1f} predictions/sec")
        
        # Calculate average throughput
        avg_throughput = sum(throughput_measurements) / len(throughput_measurements)
        min_throughput = min(throughput_measurements)
        
        print(f"\nThroughput Performance:")
        print(f"  Average throughput: {avg_throughput:.1f} predictions/sec")
        print(f"  Minimum throughput: {min_throughput:.1f} predictions/sec")
        
        # Validate throughput targets
        assert avg_throughput >= 100.0, f"Average throughput {avg_throughput:.1f} predictions/sec below 100 target"
        assert min_throughput >= 80.0, f"Minimum throughput {min_throughput:.1f} predictions/sec below 80 minimum"
    
    @pytest.mark.asyncio
    async def test_memory_usage_under_200mb_limit(self, neural_network, integration_system):
        """Test memory usage stays under 200MB limit across all scenarios"""
        
        import psutil
        import gc
        
        # Get baseline memory usage
        process = psutil.Process()
        baseline_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        scenarios = ['development', 'balanced', 'production']
        
        for profile_name in scenarios:
            # Switch to profile and initialize
            integration_system.config_manager.set_active_profile(profile_name)
            await integration_system.initialize_optimizations()
            
            # Force garbage collection
            gc.collect()
            
            # Measure memory before load test
            memory_before = process.memory_info().rss / 1024 / 1024
            
            # Simulate memory-intensive operations
            batch_features = [
                np.random.random((1, 50)).astype(np.float32) for _ in range(100)
            ]
            
            # Process multiple batches to stress memory
            for _ in range(10):
                await neural_network.predict_batch_async(batch_features[:20])
            
            # Measure peak memory usage
            memory_after = process.memory_info().rss / 1024 / 1024
            memory_delta = memory_after - baseline_memory
            
            print(f"\n{profile_name.title()} Profile Memory Usage:")
            print(f"  Baseline: {baseline_memory:.1f}MB")
            print(f"  After load test: {memory_after:.1f}MB")
            print(f"  Delta: {memory_delta:.1f}MB")
            
            # Validate memory limits
            assert memory_delta < 200.0, f"{profile_name} memory usage {memory_delta:.1f}MB exceeds 200MB limit"
            
            # Force cleanup
            gc.collect()
    
    @pytest.mark.asyncio
    async def test_learning_quality_preservation_across_optimizations(self, neural_network, integration_system):
        """Test learning quality is preserved across all optimization combinations"""
        
        # Create consistent training data for quality comparison
        base_training_data = {
            'generation': 5,
            'death_cause': 'protector_assault',
            'survival_time': 150,
            'strategy_labels': [1, 5, 10, 15],
            'game_state': {
                'energy_level': 750,
                'player_units': {'protectors': [1, 2, 3], 'workers': [1, 2, 3, 4, 5]},
                'territory_control_percentage': 0.6
            }
        }
        
        # Test learning quality across different optimization profiles
        profiles = ['development', 'balanced', 'production']
        quality_results = {}
        
        for profile_name in profiles:
            # Switch to profile
            integration_system.config_manager.set_active_profile(profile_name)
            await integration_system.initialize_optimizations()
            
            # Train and measure quality
            training_result = await neural_network.train_on_failure(base_training_data)
            
            # Extract quality metrics
            quality_metrics = {
                'training_success': training_result['success'],
                'convergence_achieved': training_result.get('convergence_achieved', False),
                'final_accuracy': training_result.get('accuracy', 0.0),
                'final_loss': training_result.get('loss', float('inf')),
                'quality_preserved': training_result.get('quality_preserved', True)
            }
            
            quality_results[profile_name] = quality_metrics
            
            print(f"\n{profile_name.title()} Profile Learning Quality:")
            print(f"  Training success: {quality_metrics['training_success']}")
            print(f"  Convergence achieved: {quality_metrics['convergence_achieved']}")
            print(f"  Final accuracy: {quality_metrics['final_accuracy']:.3f}")
            print(f"  Final loss: {quality_metrics['final_loss']:.3f}")
            print(f"  Quality preserved: {quality_metrics['quality_preserved']}")
        
        # Validate learning quality preservation
        for profile_name, metrics in quality_results.items():
            assert metrics['training_success'], f"{profile_name} training failed"
            assert metrics['quality_preserved'], f"{profile_name} quality not preserved"
            assert metrics['final_accuracy'] >= 0.5, f"{profile_name} accuracy {metrics['final_accuracy']:.3f} too low"
        
        # Compare quality across profiles (should be similar)
        accuracies = [metrics['final_accuracy'] for metrics in quality_results.values()]
        accuracy_range = max(accuracies) - min(accuracies)
        
        assert accuracy_range < 0.2, f"Accuracy range {accuracy_range:.3f} too large across profiles"
    
    @pytest.mark.asyncio
    async def test_stress_testing_concurrent_requests(self, neural_network, integration_system):
        """Test system behavior under stress with concurrent requests"""
        
        # Initialize with production profile
        integration_system.config_manager.set_active_profile('production')
        await integration_system.initialize_optimizations()
        
        # Create concurrent request simulation
        async def concurrent_inference_task(task_id: int, num_requests: int):
            """Simulate concurrent inference requests"""
            results = []
            errors = []
            
            for i in range(num_requests):
                try:
                    test_features = np.random.random((1, 50)).astype(np.float32)
                    start_time = time.perf_counter()
                    
                    result = await integration_system.optimized_predict_strategy(
                        test_features, 
                        f"stress_test_{task_id}_{i}"
                    )
                    
                    end_time = time.perf_counter()
                    inference_time = (end_time - start_time) * 1000
                    
                    results.append({
                        'success': result['success'],
                        'inference_time_ms': inference_time,
                        'task_id': task_id,
                        'request_id': i
                    })
                    
                except Exception as e:
                    errors.append({
                        'error': str(e),
                        'task_id': task_id,
                        'request_id': i
                    })
            
            return {'results': results, 'errors': errors}
        
        # Run concurrent stress test
        num_concurrent_tasks = 10
        requests_per_task = 20
        
        print(f"\nRunning stress test: {num_concurrent_tasks} concurrent tasks, {requests_per_task} requests each")
        
        start_time = time.perf_counter()
        
        # Execute concurrent tasks
        tasks = [
            concurrent_inference_task(task_id, requests_per_task) 
            for task_id in range(num_concurrent_tasks)
        ]
        
        task_results = await asyncio.gather(*tasks)
        
        end_time = time.perf_counter()
        total_time = end_time - start_time
        
        # Analyze results
        all_results = []
        all_errors = []
        
        for task_result in task_results:
            all_results.extend(task_result['results'])
            all_errors.extend(task_result['errors'])
        
        # Calculate statistics
        successful_requests = len(all_results)
        total_requests = num_concurrent_tasks * requests_per_task
        success_rate = successful_requests / total_requests
        
        if all_results:
            inference_times = [r['inference_time_ms'] for r in all_results]
            avg_inference_time = sum(inference_times) / len(inference_times)
            max_inference_time = max(inference_times)
            p95_inference_time = sorted(inference_times)[int(0.95 * len(inference_times))]
        else:
            avg_inference_time = max_inference_time = p95_inference_time = 0
        
        overall_throughput = successful_requests / total_time
        
        print(f"\nStress Test Results:")
        print(f"  Total requests: {total_requests}")
        print(f"  Successful requests: {successful_requests}")
        print(f"  Success rate: {success_rate:.1%}")
        print(f"  Total time: {total_time:.2f}s")
        print(f"  Overall throughput: {overall_throughput:.1f} requests/sec")
        print(f"  Average inference time: {avg_inference_time:.2f}ms")
        print(f"  Maximum inference time: {max_inference_time:.2f}ms")
        print(f"  95th percentile: {p95_inference_time:.2f}ms")
        print(f"  Errors: {len(all_errors)}")
        
        # Validate stress test results
        assert success_rate >= 0.95, f"Success rate {success_rate:.1%} below 95% minimum"
        assert overall_throughput >= 50.0, f"Overall throughput {overall_throughput:.1f} below 50 req/sec minimum"
        assert avg_inference_time < 25.0, f"Average inference time {avg_inference_time:.2f}ms too high under stress"
        assert len(all_errors) == 0, f"Stress test produced {len(all_errors)} errors"
    
    @pytest.mark.asyncio
    async def test_resource_constraint_behavior(self, neural_network, integration_system):
        """Test system behavior under resource constraints"""
        
        # Initialize with balanced profile
        integration_system.config_manager.set_active_profile('balanced')
        await integration_system.initialize_optimizations()
        
        # Simulate memory pressure by creating large data structures
        memory_pressure_data = []
        
        try:
            # Create memory pressure
            for i in range(10):
                large_array = np.random.random((1000, 1000)).astype(np.float32)  # ~4MB each
                memory_pressure_data.append(large_array)
            
            print(f"Created memory pressure with {len(memory_pressure_data)} large arrays")
            
            # Test inference under memory pressure
            test_features = np.random.random((1, 50)).astype(np.float32)
            
            inference_times = []
            for i in range(10):
                start_time = time.perf_counter()
                
                result = await integration_system.optimized_predict_strategy(test_features)
                
                end_time = time.perf_counter()
                inference_time = (end_time - start_time) * 1000
                inference_times.append(inference_time)
                
                assert result['success'], f"Inference failed under memory pressure (iteration {i})"
            
            avg_inference_time = sum(inference_times) / len(inference_times)
            
            print(f"Average inference time under memory pressure: {avg_inference_time:.2f}ms")
            
            # Should still meet reasonable performance targets under pressure
            assert avg_inference_time < 50.0, f"Inference time {avg_inference_time:.2f}ms too high under memory pressure"
            
        finally:
            # Clean up memory pressure
            memory_pressure_data.clear()
            import gc
            gc.collect()
    
    @pytest.mark.asyncio
    async def test_optimization_combinations_performance(self, neural_network, integration_system):
        """Test performance across different optimization feature combinations"""
        
        # Define optimization combinations to test
        optimization_combinations = [
            {
                'name': 'minimal',
                'features': [OptimizationFeature.PERFORMANCE_PROFILING],
                'expected_inference_ms': 30.0
            },
            {
                'name': 'gpu_only',
                'features': [
                    OptimizationFeature.PERFORMANCE_PROFILING,
                    OptimizationFeature.GPU_ACCELERATION,
                    OptimizationFeature.HARDWARE_OPTIMIZATION
                ],
                'expected_inference_ms': 20.0
            },
            {
                'name': 'quantization_only',
                'features': [
                    OptimizationFeature.PERFORMANCE_PROFILING,
                    OptimizationFeature.MODEL_QUANTIZATION
                ],
                'expected_inference_ms': 25.0
            },
            {
                'name': 'batch_processing',
                'features': [
                    OptimizationFeature.PERFORMANCE_PROFILING,
                    OptimizationFeature.BATCH_PROCESSING
                ],
                'expected_inference_ms': 20.0
            },
            {
                'name': 'full_optimization',
                'features': [
                    OptimizationFeature.PERFORMANCE_PROFILING,
                    OptimizationFeature.MODEL_QUANTIZATION,
                    OptimizationFeature.GPU_ACCELERATION,
                    OptimizationFeature.BATCH_PROCESSING,
                    OptimizationFeature.MEMORY_OPTIMIZATION,
                    OptimizationFeature.HARDWARE_OPTIMIZATION
                ],
                'expected_inference_ms': 15.0
            }
        ]
        
        combination_results = {}
        
        for combination in optimization_combinations:
            print(f"\nTesting optimization combination: {combination['name']}")
            
            # Create custom profile for this combination
            config_manager = integration_system.config_manager
            
            # Disable all features first
            for feature in OptimizationFeature:
                config_manager.disable_feature(feature)
            
            # Enable only the features for this combination
            for feature in combination['features']:
                config_manager.enable_feature(feature, OptimizationLevel.BALANCED)
            
            # Re-initialize with new configuration
            await integration_system._reconfigure_optimizations()
            
            # Test performance
            test_features = np.random.random((1, 50)).astype(np.float32)
            inference_times = []
            
            for _ in range(15):  # 15 runs for statistical significance
                start_time = time.perf_counter()
                result = await integration_system.optimized_predict_strategy(test_features)
                end_time = time.perf_counter()
                
                inference_time = (end_time - start_time) * 1000
                inference_times.append(inference_time)
                
                assert result['success'], f"Inference failed for {combination['name']} combination"
            
            avg_inference_time = sum(inference_times) / len(inference_times)
            combination_results[combination['name']] = {
                'avg_inference_time': avg_inference_time,
                'expected_time': combination['expected_inference_ms'],
                'features': [f.value for f in combination['features']]
            }
            
            print(f"  Average inference time: {avg_inference_time:.2f}ms")
            print(f"  Expected time: {combination['expected_inference_ms']:.2f}ms")
            print(f"  Features: {[f.value for f in combination['features']]}")
            
            # Validate performance meets expectations (with some tolerance)
            tolerance_factor = 1.5  # Allow 50% tolerance for testing environment
            max_allowed_time = combination['expected_inference_ms'] * tolerance_factor
            
            assert avg_inference_time <= max_allowed_time, \
                f"{combination['name']} inference time {avg_inference_time:.2f}ms exceeds expected {max_allowed_time:.2f}ms"
        
        # Verify that more optimizations generally lead to better performance
        minimal_time = combination_results['minimal']['avg_inference_time']
        full_optimization_time = combination_results['full_optimization']['avg_inference_time']
        
        print(f"\nPerformance Improvement Analysis:")
        print(f"  Minimal optimizations: {minimal_time:.2f}ms")
        print(f"  Full optimizations: {full_optimization_time:.2f}ms")
        print(f"  Improvement factor: {minimal_time / full_optimization_time:.2f}x")
        
        assert full_optimization_time < minimal_time, \
            "Full optimizations should be faster than minimal optimizations"
    
    @pytest.mark.asyncio
    async def test_performance_regression_detection(self, neural_network, integration_system):
        """Test performance regression detection across optimization changes"""
        
        # Initialize with production profile
        integration_system.config_manager.set_active_profile('production')
        await integration_system.initialize_optimizations()
        
        # Establish baseline performance
        test_features = np.random.random((1, 50)).astype(np.float32)
        baseline_times = []
        
        for _ in range(20):
            start_time = time.perf_counter()
            await integration_system.optimized_predict_strategy(test_features)
            end_time = time.perf_counter()
            baseline_times.append((end_time - start_time) * 1000)
        
        baseline_avg = sum(baseline_times) / len(baseline_times)
        
        # Simulate performance regression by disabling optimizations
        integration_system.config_manager.disable_feature(OptimizationFeature.GPU_ACCELERATION)
        integration_system.config_manager.disable_feature(OptimizationFeature.MODEL_QUANTIZATION)
        await integration_system._reconfigure_optimizations()
        
        # Measure degraded performance
        degraded_times = []
        
        for _ in range(20):
            start_time = time.perf_counter()
            await integration_system.optimized_predict_strategy(test_features)
            end_time = time.perf_counter()
            degraded_times.append((end_time - start_time) * 1000)
        
        degraded_avg = sum(degraded_times) / len(degraded_times)
        
        # Calculate regression
        regression_factor = degraded_avg / baseline_avg
        
        print(f"\nPerformance Regression Analysis:")
        print(f"  Baseline average: {baseline_avg:.2f}ms")
        print(f"  Degraded average: {degraded_avg:.2f}ms")
        print(f"  Regression factor: {regression_factor:.2f}x")
        
        # Verify regression is detected
        assert regression_factor > 1.2, f"Expected performance regression not detected (factor: {regression_factor:.2f})"
        
        # Re-enable optimizations and verify recovery
        integration_system.config_manager.enable_feature(OptimizationFeature.GPU_ACCELERATION)
        integration_system.config_manager.enable_feature(OptimizationFeature.MODEL_QUANTIZATION)
        await integration_system._reconfigure_optimizations()
        
        # Measure recovered performance
        recovered_times = []
        
        for _ in range(20):
            start_time = time.perf_counter()
            await integration_system.optimized_predict_strategy(test_features)
            end_time = time.perf_counter()
            recovered_times.append((end_time - start_time) * 1000)
        
        recovered_avg = sum(recovered_times) / len(recovered_times)
        recovery_factor = recovered_avg / baseline_avg
        
        print(f"  Recovered average: {recovered_avg:.2f}ms")
        print(f"  Recovery factor: {recovery_factor:.2f}x")
        
        # Verify performance recovery
        assert recovery_factor < 1.1, f"Performance did not recover properly (factor: {recovery_factor:.2f})"


if __name__ == '__main__':
    # Run tests with detailed output
    pytest.main([__file__, '-v', '-s'])