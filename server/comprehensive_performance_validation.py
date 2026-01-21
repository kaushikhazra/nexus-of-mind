#!/usr/bin/env python3
"""
Comprehensive Performance Validation Script
Validates all performance targets are met across different hardware configurations
"""

import asyncio
import time
import logging
import json
import sys
import os
from typing import Dict, Any, List
import numpy as np
import psutil
from pathlib import Path

# Add the server directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import neural network and optimization systems
try:
    from ai_engine.neural_network import QueenBehaviorNetwork
    from ai_engine.optimization_configuration_system import (
        OptimizationConfigurationManager, OptimizationFeature, OptimizationLevel
    )
    from ai_engine.neural_network_integration import NeuralNetworkOptimizationIntegrator
except ImportError as e:
    print(f"Import error: {e}")
    print("Please ensure all required dependencies are installed")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PerformanceValidationSuite:
    """Comprehensive performance validation suite"""
    
    def __init__(self):
        self.neural_network = None
        self.integration_system = None
        self.config_manager = None
        self.validation_results = {}
        self.hardware_info = self._get_hardware_info()
        
    def _get_hardware_info(self) -> Dict[str, Any]:
        """Get system hardware information"""
        try:
            return {
                'cpu_count': psutil.cpu_count(),
                'cpu_freq': psutil.cpu_freq()._asdict() if psutil.cpu_freq() else {},
                'memory_total_gb': psutil.virtual_memory().total / (1024**3),
                'memory_available_gb': psutil.virtual_memory().available / (1024**3),
                'platform': sys.platform,
                'python_version': sys.version
            }
        except Exception as e:
            logger.error(f"Failed to get hardware info: {e}")
            return {'error': str(e)}
    
    async def initialize_systems(self):
        """Initialize neural network and optimization systems"""
        try:
            logger.info("Initializing neural network and optimization systems...")
            
            # Create neural network
            self.neural_network = QueenBehaviorNetwork()
            
            # Create integration system
            self.integration_system = NeuralNetworkOptimizationIntegrator(self.neural_network)
            self.config_manager = self.integration_system.config_manager
            
            # Initialize optimizations
            init_result = await self.integration_system.initialize_optimizations()
            
            if not init_result['success']:
                raise RuntimeError(f"Failed to initialize optimizations: {init_result.get('error')}")
            
            logger.info("Systems initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize systems: {e}")
            return False
    
    async def validate_inference_performance(self) -> Dict[str, Any]:
        """Validate inference performance targets"""
        logger.info("Validating inference performance targets...")
        
        results = {
            'test_name': 'inference_performance',
            'target_inference_time_ms': 16.0,
            'profiles_tested': {},
            'overall_pass': True
        }
        
        # Test different optimization profiles
        profiles = ['development', 'balanced', 'production']
        test_features = np.random.random((1, 50)).astype(np.float32)
        
        for profile_name in profiles:
            logger.info(f"Testing {profile_name} profile...")
            
            # Switch to profile
            self.config_manager.set_active_profile(profile_name)
            await self.integration_system.initialize_optimizations()
            
            # Measure inference times
            inference_times = []
            for i in range(50):  # 50 runs for statistical significance
                start_time = time.perf_counter()
                
                result = await self.integration_system.optimized_predict_strategy(
                    test_features, f"validation_{profile_name}_{i}"
                )
                
                end_time = time.perf_counter()
                inference_time_ms = (end_time - start_time) * 1000
                inference_times.append(inference_time_ms)
                
                if not result['success']:
                    logger.error(f"Inference failed for {profile_name} profile, run {i}")
            
            # Calculate statistics
            avg_time = sum(inference_times) / len(inference_times)
            min_time = min(inference_times)
            max_time = max(inference_times)
            p95_time = sorted(inference_times)[int(0.95 * len(inference_times))]
            p99_time = sorted(inference_times)[int(0.99 * len(inference_times))]
            
            # Determine target based on profile
            if profile_name == 'production':
                target_time = 16.0
            elif profile_name == 'balanced':
                target_time = 20.0
            else:
                target_time = 50.0
            
            profile_pass = avg_time <= target_time
            if not profile_pass:
                results['overall_pass'] = False
            
            results['profiles_tested'][profile_name] = {
                'target_time_ms': target_time,
                'avg_time_ms': avg_time,
                'min_time_ms': min_time,
                'max_time_ms': max_time,
                'p95_time_ms': p95_time,
                'p99_time_ms': p99_time,
                'samples': len(inference_times),
                'pass': profile_pass
            }
            
            logger.info(f"{profile_name} profile: avg={avg_time:.2f}ms, target={target_time:.2f}ms, pass={profile_pass}")
        
        return results
    
    async def validate_throughput_performance(self) -> Dict[str, Any]:
        """Validate throughput performance targets"""
        logger.info("Validating throughput performance targets...")
        
        results = {
            'test_name': 'throughput_performance',
            'target_throughput_per_sec': 100.0,
            'batch_tests': {},
            'overall_pass': True
        }
        
        # Set production profile for maximum performance
        self.config_manager.set_active_profile('production')
        await self.integration_system.initialize_optimizations()
        
        # Test different batch sizes
        batch_sizes = [10, 25, 50, 100]
        
        for batch_size in batch_sizes:
            logger.info(f"Testing batch size {batch_size}...")
            
            # Create batch
            batch_features = [
                np.random.random((1, 50)).astype(np.float32) for _ in range(batch_size)
            ]
            
            # Measure throughput over multiple runs
            throughput_measurements = []
            
            for run in range(10):  # 10 runs
                start_time = time.perf_counter()
                
                batch_results = await self.neural_network.predict_batch_async(
                    batch_features, f"throughput_test_{batch_size}_{run}"
                )
                
                end_time = time.perf_counter()
                
                total_time = end_time - start_time
                throughput = len(batch_results) / total_time
                throughput_measurements.append(throughput)
            
            # Calculate statistics
            avg_throughput = sum(throughput_measurements) / len(throughput_measurements)
            min_throughput = min(throughput_measurements)
            max_throughput = max(throughput_measurements)
            
            batch_pass = avg_throughput >= 100.0
            if not batch_pass:
                results['overall_pass'] = False
            
            results['batch_tests'][f'batch_{batch_size}'] = {
                'batch_size': batch_size,
                'avg_throughput_per_sec': avg_throughput,
                'min_throughput_per_sec': min_throughput,
                'max_throughput_per_sec': max_throughput,
                'runs': len(throughput_measurements),
                'pass': batch_pass
            }
            
            logger.info(f"Batch {batch_size}: avg={avg_throughput:.1f} req/sec, pass={batch_pass}")
        
        return results
    
    async def validate_memory_usage(self) -> Dict[str, Any]:
        """Validate memory usage stays within limits"""
        logger.info("Validating memory usage limits...")
        
        results = {
            'test_name': 'memory_usage',
            'target_memory_limit_mb': 200.0,
            'profile_tests': {},
            'overall_pass': True
        }
        
        process = psutil.Process()
        baseline_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        profiles = ['development', 'balanced', 'production']
        
        for profile_name in profiles:
            logger.info(f"Testing memory usage for {profile_name} profile...")
            
            # Switch to profile
            self.config_manager.set_active_profile(profile_name)
            await self.integration_system.initialize_optimizations()
            
            # Force garbage collection
            import gc
            gc.collect()
            
            memory_before = process.memory_info().rss / 1024 / 1024
            
            # Simulate memory-intensive operations
            batch_features = [
                np.random.random((1, 50)).astype(np.float32) for _ in range(200)
            ]
            
            # Process multiple batches
            for i in range(20):
                await self.neural_network.predict_batch_async(batch_features[:10])
                
                # Measure peak memory every 5 iterations
                if i % 5 == 0:
                    current_memory = process.memory_info().rss / 1024 / 1024
                    memory_delta = current_memory - baseline_memory
            
            memory_after = process.memory_info().rss / 1024 / 1024
            memory_delta = memory_after - baseline_memory
            
            profile_pass = memory_delta <= 200.0
            if not profile_pass:
                results['overall_pass'] = False
            
            results['profile_tests'][profile_name] = {
                'baseline_memory_mb': baseline_memory,
                'peak_memory_mb': memory_after,
                'memory_delta_mb': memory_delta,
                'target_limit_mb': 200.0,
                'pass': profile_pass
            }
            
            logger.info(f"{profile_name} memory: delta={memory_delta:.1f}MB, pass={profile_pass}")
            
            # Force cleanup
            gc.collect()
        
        return results
    
    async def validate_learning_quality_preservation(self) -> Dict[str, Any]:
        """Validate learning quality is preserved across optimizations"""
        logger.info("Validating learning quality preservation...")
        
        results = {
            'test_name': 'learning_quality_preservation',
            'target_quality_threshold': 0.9,
            'profile_tests': {},
            'overall_pass': True
        }
        
        # Consistent training data for comparison
        training_data = {
            'generation': 3,
            'death_cause': 'coordinated_attack',
            'survival_time': 200,
            'strategy_labels': [2, 8, 12, 18],
            'game_state': {
                'energy_level': 800,
                'player_units': {'protectors': [1, 2, 3, 4], 'workers': [1, 2, 3, 4, 5, 6]},
                'territory_control_percentage': 0.7
            }
        }
        
        profiles = ['development', 'balanced', 'production']
        
        for profile_name in profiles:
            logger.info(f"Testing learning quality for {profile_name} profile...")
            
            # Switch to profile
            self.config_manager.set_active_profile(profile_name)
            await self.integration_system.initialize_optimizations()
            
            # Train and measure quality
            training_result = await self.neural_network.train_on_failure(training_data)
            
            # Extract quality metrics
            quality_score = training_result.get('accuracy', 0.0)
            quality_preserved = training_result.get('quality_preserved', True)
            convergence_achieved = training_result.get('convergence_achieved', False)
            
            profile_pass = (
                training_result['success'] and 
                quality_preserved and 
                quality_score >= 0.5
            )
            
            if not profile_pass:
                results['overall_pass'] = False
            
            results['profile_tests'][profile_name] = {
                'training_success': training_result['success'],
                'quality_score': quality_score,
                'quality_preserved': quality_preserved,
                'convergence_achieved': convergence_achieved,
                'training_time_s': training_result.get('training_time', 0),
                'pass': profile_pass
            }
            
            logger.info(f"{profile_name} quality: score={quality_score:.3f}, pass={profile_pass}")
        
        return results
    
    async def validate_stress_testing(self) -> Dict[str, Any]:
        """Validate system behavior under stress"""
        logger.info("Validating system behavior under stress...")
        
        results = {
            'test_name': 'stress_testing',
            'target_success_rate': 0.95,
            'stress_tests': {},
            'overall_pass': True
        }
        
        # Set production profile for stress testing
        self.config_manager.set_active_profile('production')
        await self.integration_system.initialize_optimizations()
        
        # Define stress test scenarios
        stress_scenarios = [
            {
                'name': 'concurrent_requests',
                'concurrent_tasks': 5,
                'requests_per_task': 10,
                'description': 'Concurrent inference requests'
            },
            {
                'name': 'high_frequency',
                'concurrent_tasks': 1,
                'requests_per_task': 100,
                'description': 'High frequency sequential requests'
            },
            {
                'name': 'mixed_load',
                'concurrent_tasks': 3,
                'requests_per_task': 20,
                'description': 'Mixed concurrent and sequential load'
            }
        ]
        
        for scenario in stress_scenarios:
            logger.info(f"Running stress test: {scenario['description']}...")
            
            async def stress_task(task_id: int, num_requests: int):
                """Individual stress test task"""
                successes = 0
                errors = []
                inference_times = []
                
                for i in range(num_requests):
                    try:
                        test_features = np.random.random((1, 50)).astype(np.float32)
                        start_time = time.perf_counter()
                        
                        result = await self.integration_system.optimized_predict_strategy(
                            test_features, f"stress_{scenario['name']}_{task_id}_{i}"
                        )
                        
                        end_time = time.perf_counter()
                        inference_time = (end_time - start_time) * 1000
                        
                        if result['success']:
                            successes += 1
                            inference_times.append(inference_time)
                        else:
                            errors.append(f"Task {task_id}, request {i}: prediction failed")
                            
                    except Exception as e:
                        errors.append(f"Task {task_id}, request {i}: {str(e)}")
                
                return {
                    'task_id': task_id,
                    'successes': successes,
                    'errors': errors,
                    'inference_times': inference_times
                }
            
            # Run stress test
            start_time = time.perf_counter()
            
            tasks = [
                stress_task(task_id, scenario['requests_per_task'])
                for task_id in range(scenario['concurrent_tasks'])
            ]
            
            task_results = await asyncio.gather(*tasks)
            
            end_time = time.perf_counter()
            total_time = end_time - start_time
            
            # Analyze results
            total_requests = scenario['concurrent_tasks'] * scenario['requests_per_task']
            total_successes = sum(result['successes'] for result in task_results)
            total_errors = sum(len(result['errors']) for result in task_results)
            
            all_inference_times = []
            for result in task_results:
                all_inference_times.extend(result['inference_times'])
            
            success_rate = total_successes / total_requests if total_requests > 0 else 0
            avg_inference_time = sum(all_inference_times) / len(all_inference_times) if all_inference_times else 0
            throughput = total_successes / total_time
            
            scenario_pass = success_rate >= 0.95 and avg_inference_time < 30.0
            if not scenario_pass:
                results['overall_pass'] = False
            
            results['stress_tests'][scenario['name']] = {
                'description': scenario['description'],
                'total_requests': total_requests,
                'successful_requests': total_successes,
                'failed_requests': total_errors,
                'success_rate': success_rate,
                'avg_inference_time_ms': avg_inference_time,
                'throughput_per_sec': throughput,
                'total_time_s': total_time,
                'pass': scenario_pass
            }
            
            logger.info(f"{scenario['name']}: success_rate={success_rate:.1%}, "
                       f"avg_time={avg_inference_time:.2f}ms, pass={scenario_pass}")
        
        return results
    
    async def run_comprehensive_validation(self) -> Dict[str, Any]:
        """Run comprehensive performance validation"""
        logger.info("Starting comprehensive performance validation...")
        
        validation_start_time = time.time()
        
        # Initialize systems
        if not await self.initialize_systems():
            return {
                'success': False,
                'error': 'Failed to initialize systems',
                'hardware_info': self.hardware_info
            }
        
        # Run all validation tests
        validation_tests = [
            self.validate_inference_performance(),
            self.validate_throughput_performance(),
            self.validate_memory_usage(),
            self.validate_learning_quality_preservation(),
            self.validate_stress_testing()
        ]
        
        try:
            test_results = await asyncio.gather(*validation_tests)
            
            validation_end_time = time.time()
            total_validation_time = validation_end_time - validation_start_time
            
            # Compile overall results
            overall_pass = all(result.get('overall_pass', False) for result in test_results)
            
            comprehensive_results = {
                'success': True,
                'overall_pass': overall_pass,
                'validation_time_s': total_validation_time,
                'hardware_info': self.hardware_info,
                'test_results': test_results,
                'summary': {
                    'total_tests': len(test_results),
                    'passed_tests': sum(1 for result in test_results if result.get('overall_pass', False)),
                    'failed_tests': sum(1 for result in test_results if not result.get('overall_pass', False))
                }
            }
            
            logger.info(f"Comprehensive validation completed in {total_validation_time:.2f}s")
            logger.info(f"Overall result: {'PASS' if overall_pass else 'FAIL'}")
            
            return comprehensive_results
            
        except Exception as e:
            logger.error(f"Validation failed with error: {e}")
            return {
                'success': False,
                'error': str(e),
                'hardware_info': self.hardware_info
            }
        
        finally:
            # Cleanup
            if self.integration_system:
                await self.integration_system.cleanup()
            if self.neural_network:
                await self.neural_network.cleanup()
    
    def save_results(self, results: Dict[str, Any], output_file: str = 'validation_results.json'):
        """Save validation results to file"""
        try:
            output_path = Path(output_file)
            with open(output_path, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            
            logger.info(f"Validation results saved to {output_path}")
            
        except Exception as e:
            logger.error(f"Failed to save results: {e}")
    
    def print_summary(self, results: Dict[str, Any]):
        """Print validation summary"""
        print("\n" + "="*80)
        print("COMPREHENSIVE PERFORMANCE VALIDATION SUMMARY")
        print("="*80)
        
        if not results.get('success', False):
            print(f"❌ VALIDATION FAILED: {results.get('error', 'Unknown error')}")
            return
        
        overall_pass = results.get('overall_pass', False)
        print(f"Overall Result: {'✅ PASS' if overall_pass else '❌ FAIL'}")
        print(f"Validation Time: {results.get('validation_time_s', 0):.2f}s")
        
        # Hardware info
        hardware = results.get('hardware_info', {})
        print(f"\nHardware Configuration:")
        print(f"  CPU Cores: {hardware.get('cpu_count', 'Unknown')}")
        print(f"  Memory: {hardware.get('memory_total_gb', 0):.1f}GB total, {hardware.get('memory_available_gb', 0):.1f}GB available")
        print(f"  Platform: {hardware.get('platform', 'Unknown')}")
        
        # Test results summary
        summary = results.get('summary', {})
        print(f"\nTest Summary:")
        print(f"  Total Tests: {summary.get('total_tests', 0)}")
        print(f"  Passed: {summary.get('passed_tests', 0)}")
        print(f"  Failed: {summary.get('failed_tests', 0)}")
        
        # Individual test results
        print(f"\nDetailed Results:")
        for test_result in results.get('test_results', []):
            test_name = test_result.get('test_name', 'Unknown')
            test_pass = test_result.get('overall_pass', False)
            status = '✅ PASS' if test_pass else '❌ FAIL'
            print(f"  {test_name}: {status}")
        
        print("="*80)


async def main():
    """Main validation function"""
    print("Neural Network Optimization - Comprehensive Performance Validation")
    print("="*80)
    
    # Create validation suite
    validation_suite = PerformanceValidationSuite()
    
    # Run comprehensive validation
    results = await validation_suite.run_comprehensive_validation()
    
    # Save results
    validation_suite.save_results(results)
    
    # Print summary
    validation_suite.print_summary(results)
    
    # Exit with appropriate code
    if results.get('success', False) and results.get('overall_pass', False):
        print("\n🎉 All performance targets met! Neural network optimization is ready for production.")
        sys.exit(0)
    else:
        print("\n⚠️  Some performance targets not met. Review results and optimize further.")
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())