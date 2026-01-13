#!/usr/bin/env python3
"""
Test script for Inference Engine Optimization
Tests Requirements 1.1, 1.4, 5.3 for real-time inference performance
"""

import asyncio
import logging
import time
import numpy as np
from typing import Dict, Any
from dataclasses import dataclass
from enum import Enum

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mock implementations for testing
class HardwareType(Enum):
    CPU_ONLY = "cpu_only"

class CPUArchitecture(Enum):
    X86_64 = "x86_64"

@dataclass
class CPUInfo:
    architecture: CPUArchitecture
    cores_physical: int
    cores_logical: int
    frequency_ghz: float
    cache_l3_mb: int
    supports_avx: bool
    supports_avx2: bool
    supports_avx512: bool
    vendor: str
    model_name: str

@dataclass
class MemoryInfo:
    total_gb: float
    available_gb: float
    swap_total_gb: float
    swap_available_gb: float
    memory_type: str
    memory_speed_mhz: int

@dataclass
class HardwareProfile:
    hardware_type: HardwareType
    cpu_info: CPUInfo
    memory_info: MemoryInfo
    gpu_info: list
    storage_info: dict
    network_info: dict
    optimization_recommendations: list
    performance_tier: str

class MockQueenBehaviorNetwork:
    async def predict_strategy_async(self, features, operation_id=None):
        await asyncio.sleep(0.010)  # 10ms simulation
        return np.random.random((1, 20)).astype(np.float32)
    
    def predict_strategy(self, features):
        # Synchronous version for CPU fallback
        time.sleep(0.015)  # 15ms simulation
        return np.random.random((1, 20)).astype(np.float32)
    
    async def predict_batch_async(self, batch_features, operation_id=None):
        # Batch prediction simulation
        await asyncio.sleep(0.005 * len(batch_features))  # 5ms per item
        results = []
        for features in batch_features:
            results.append(np.random.random((1, 20)).astype(np.float32))
        return results

class MockHardwareDetector:
    def detect_hardware_configuration(self):
        return HardwareProfile(
            hardware_type=HardwareType.CPU_ONLY,
            cpu_info=CPUInfo(
                architecture=CPUArchitecture.X86_64,
                cores_physical=4,
                cores_logical=8,
                frequency_ghz=3.0,
                cache_l3_mb=8,
                supports_avx=True,
                supports_avx2=True,
                supports_avx512=False,
                vendor="Intel",
                model_name="Test CPU"
            ),
            memory_info=MemoryInfo(
                total_gb=16.0,
                available_gb=12.0,
                swap_total_gb=4.0,
                swap_available_gb=4.0,
                memory_type="DDR4",
                memory_speed_mhz=3200
            ),
            gpu_info=[],
            storage_info={'total_space_gb': 500.0, 'available_space_gb': 250.0},
            network_info={'interfaces': []},
            optimization_recommendations=["Enable CPU optimizations"],
            performance_tier="medium"
        )
    
    def get_hardware_status(self):
        return {
            'hardware_detected': True,
            'hardware_type': 'cpu_only',
            'performance_tier': 'medium',
            'optimization_recommendations': ["Enable CPU optimizations"]
        }
    
    async def cleanup(self):
        pass

# Import the optimized inference engine
try:
    from ai_engine.inference_engine import InferenceEngine, CPUOptimizedInferenceEngine, PerformanceAwareRouter, RealTimePerformanceEnforcer
    INFERENCE_ENGINE_AVAILABLE = True
except ImportError as e:
    logger.error(f"Import failed: {e}")
    logger.info("Running in limited mode - some tests will be skipped")
    INFERENCE_ENGINE_AVAILABLE = False


async def test_cpu_optimization():
    """Test CPU-optimized inference engine"""
    logger.info("Testing CPU-optimized inference engine...")
    
    if not INFERENCE_ENGINE_AVAILABLE:
        logger.warning("Inference engine not available - skipping CPU optimization test")
        return {'success': False, 'error': 'Inference engine not available'}
    
    try:
        # Initialize hardware detector
        hardware_detector = MockHardwareDetector()
        
        # Initialize CPU optimizer
        cpu_optimizer = CPUOptimizedInferenceEngine(hardware_detector)
        
        # Test data
        test_features = np.random.random((1, 50)).astype(np.float32)
        
        # Run CPU optimization test
        start_time = time.time()
        result = await cpu_optimizer.predict_cpu_optimized(test_features)
        execution_time_ms = (time.time() - start_time) * 1000
        
        # Validate results
        assert result is not None, "CPU optimization should return result"
        assert result.shape == (1, 20), f"Expected shape (1, 20), got {result.shape}"
        
        logger.info(f"CPU optimization test completed in {execution_time_ms:.1f}ms")
        
        # Get performance metrics
        cpu_metrics = cpu_optimizer.get_cpu_performance_metrics()
        logger.info(f"CPU performance metrics: {cpu_metrics}")
        
        # Cleanup
        await cpu_optimizer.cleanup()
        
        return {
            'success': True,
            'execution_time_ms': execution_time_ms,
            'cpu_metrics': cpu_metrics
        }
        
    except Exception as e:
        logger.error(f"CPU optimization test failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }


async def test_performance_aware_routing():
    """Test performance-aware routing system"""
    logger.info("Testing performance-aware routing...")
    
    if not INFERENCE_ENGINE_AVAILABLE:
        logger.warning("Inference engine not available - skipping routing test")
        return {'success': False, 'error': 'Inference engine not available'}
    
    try:
        # Initialize hardware detector
        hardware_detector = MockHardwareDetector()
        
        # Initialize performance router
        router = PerformanceAwareRouter(hardware_detector)
        
        # Test different request scenarios
        test_scenarios = [
            {
                'name': 'high_urgency',
                'request_data': {'time_sensitivity': 0.95, 'complexity_score': 0.3},
                'current_load': {'gpu_utilization': 0.2, 'cpu_utilization': 0.3, 'queue_length': 0}
            },
            {
                'name': 'batch_eligible',
                'request_data': {'time_sensitivity': 0.4, 'batch_eligible': True, 'complexity_score': 0.5},
                'current_load': {'gpu_utilization': 0.5, 'cpu_utilization': 0.4, 'queue_length': 3}
            },
            {
                'name': 'high_load',
                'request_data': {'time_sensitivity': 0.6, 'complexity_score': 0.8},
                'current_load': {'gpu_utilization': 0.9, 'cpu_utilization': 0.8, 'queue_length': 10}
            }
        ]
        
        routing_results = {}
        
        for scenario in test_scenarios:
            routing_decision = router.determine_optimal_strategy(
                scenario['request_data'], 
                scenario['current_load']
            )
            
            routing_results[scenario['name']] = routing_decision
            logger.info(f"Routing decision for {scenario['name']}: {routing_decision['strategy']} "
                       f"(expected: {routing_decision['expected_time_ms']:.1f}ms)")
        
        # Get routing statistics
        routing_stats = router.get_routing_statistics()
        logger.info(f"Routing statistics: {routing_stats}")
        
        return {
            'success': True,
            'routing_results': routing_results,
            'routing_stats': routing_stats
        }
        
    except Exception as e:
        logger.error(f"Performance-aware routing test failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }


async def test_performance_enforcement():
    """Test real-time performance enforcement"""
    logger.info("Testing real-time performance enforcement...")
    
    if not INFERENCE_ENGINE_AVAILABLE:
        logger.warning("Inference engine not available - skipping enforcement test")
        return {'success': False, 'error': 'Inference engine not available'}
    
    try:
        # Initialize performance enforcer
        enforcer = RealTimePerformanceEnforcer(target_inference_time_ms=16.0)
        
        # Test different performance scenarios
        test_scenarios = [
            {
                'name': 'target_met',
                'execution_time_ms': 12.0,
                'context': {'strategy': 'gpu_immediate', 'batch_size': 1}
            },
            {
                'name': 'warning_violation',
                'execution_time_ms': 22.0,
                'context': {'strategy': 'gpu_batch', 'batch_size': 8}
            },
            {
                'name': 'critical_violation',
                'execution_time_ms': 45.0,
                'context': {'strategy': 'cpu_fallback', 'batch_size': 16}
            }
        ]
        
        enforcement_results = {}
        
        for scenario in test_scenarios:
            enforcement_result = enforcer.enforce_performance_target(
                f"test_{scenario['name']}", 
                scenario['execution_time_ms'],
                scenario['context']
            )
            
            enforcement_results[scenario['name']] = enforcement_result
            logger.info(f"Enforcement for {scenario['name']}: "
                       f"target_met={enforcement_result['target_met']}, "
                       f"violation_level={enforcement_result['violation_level']}, "
                       f"actions={len(enforcement_result['actions_taken'])}")
        
        # Get enforcement statistics
        enforcement_stats = enforcer.get_enforcement_statistics()
        logger.info(f"Enforcement statistics: {enforcement_stats}")
        
        return {
            'success': True,
            'enforcement_results': enforcement_results,
            'enforcement_stats': enforcement_stats
        }
        
    except Exception as e:
        logger.error(f"Performance enforcement test failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }


async def test_integrated_inference_engine():
    """Test the complete integrated inference engine"""
    logger.info("Testing integrated inference engine...")
    
    if not INFERENCE_ENGINE_AVAILABLE:
        logger.warning("Inference engine not available - skipping integrated test")
        return {'success': False, 'error': 'Inference engine not available'}
    
    try:
        # Initialize neural network (mock)
        neural_network = MockQueenBehaviorNetwork()
        
        # Initialize inference engine
        inference_engine = InferenceEngine(neural_network)
        
        # Start the engine
        await inference_engine.start()
        
        # Test data
        test_features = np.random.random((1, 50)).astype(np.float32)
        
        # Test single prediction with optimization
        start_time = time.time()
        result = await inference_engine.predict_strategy_optimized(
            test_features, 
            {'request_id': 'test_integrated', 'time_sensitivity': 0.7}
        )
        execution_time_ms = (time.time() - start_time) * 1000
        
        # Validate results
        assert result is not None, "Integrated inference should return result"
        assert result.shape == (1, 20), f"Expected shape (1, 20), got {result.shape}"
        
        logger.info(f"Integrated inference completed in {execution_time_ms:.1f}ms")
        
        # Test batch prediction
        batch_features = [np.random.random((1, 50)).astype(np.float32) for _ in range(8)]
        batch_metadata = [{'request_id': f'batch_test_{i}'} for i in range(8)]
        
        start_time = time.time()
        batch_results = await inference_engine.predict_batch_optimized(batch_features, batch_metadata)
        batch_time_ms = (time.time() - start_time) * 1000
        
        # Validate batch results
        assert len(batch_results) == 8, f"Expected 8 batch results, got {len(batch_results)}"
        
        throughput = (len(batch_results) / batch_time_ms) * 1000
        logger.info(f"Batch inference completed in {batch_time_ms:.1f}ms, throughput: {throughput:.1f} pred/sec")
        
        # Get comprehensive performance metrics
        performance_metrics = inference_engine.get_performance_metrics()
        logger.info(f"Performance metrics available: {len(performance_metrics)} categories")
        
        # Run benchmark
        benchmark_results = await inference_engine.benchmark_inference_performance()
        logger.info(f"Benchmark completed: {benchmark_results['success']}")
        
        # Stop the engine
        await inference_engine.stop()
        
        # Cleanup
        await inference_engine.cleanup()
        
        return {
            'success': True,
            'single_inference_time_ms': execution_time_ms,
            'batch_inference_time_ms': batch_time_ms,
            'throughput_predictions_per_sec': throughput,
            'performance_metrics': performance_metrics,
            'benchmark_results': benchmark_results
        }
        
    except Exception as e:
        logger.error(f"Integrated inference engine test failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }


async def main():
    """Run all inference optimization tests"""
    logger.info("Starting Inference Engine Optimization Tests")
    logger.info("=" * 60)
    
    test_results = {}
    
    # Test 1: CPU Optimization
    logger.info("\n1. Testing CPU Optimization...")
    test_results['cpu_optimization'] = await test_cpu_optimization()
    
    # Test 2: Performance-Aware Routing
    logger.info("\n2. Testing Performance-Aware Routing...")
    test_results['performance_routing'] = await test_performance_aware_routing()
    
    # Test 3: Performance Enforcement
    logger.info("\n3. Testing Performance Enforcement...")
    test_results['performance_enforcement'] = await test_performance_enforcement()
    
    # Test 4: Integrated Inference Engine
    logger.info("\n4. Testing Integrated Inference Engine...")
    test_results['integrated_engine'] = await test_integrated_inference_engine()
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("INFERENCE OPTIMIZATION TEST SUMMARY")
    logger.info("=" * 60)
    
    total_tests = len(test_results)
    passed_tests = sum(1 for result in test_results.values() if result.get('success', False))
    
    for test_name, result in test_results.items():
        status = "PASS" if result.get('success', False) else "FAIL"
        logger.info(f"{test_name:25} : {status}")
        
        if not result.get('success', False):
            logger.error(f"  Error: {result.get('error', 'Unknown error')}")
    
    logger.info(f"\nTests passed: {passed_tests}/{total_tests}")
    
    # Performance analysis
    if test_results['integrated_engine'].get('success', False):
        integrated_result = test_results['integrated_engine']
        single_time = integrated_result.get('single_inference_time_ms', 0)
        throughput = integrated_result.get('throughput_predictions_per_sec', 0)
        
        logger.info(f"\nPerformance Analysis:")
        logger.info(f"Single inference time: {single_time:.1f}ms (target: ≤16ms)")
        logger.info(f"Batch throughput: {throughput:.1f} pred/sec (target: ≥100 pred/sec)")
        
        single_target_met = single_time <= 16.0
        throughput_target_met = throughput >= 100.0
        
        logger.info(f"Single inference target: {'MET' if single_target_met else 'MISSED'}")
        logger.info(f"Throughput target: {'MET' if throughput_target_met else 'MISSED'}")
        
        if single_target_met and throughput_target_met:
            logger.info("🎉 ALL PERFORMANCE TARGETS MET!")
        else:
            logger.warning("⚠️  Some performance targets missed - optimization needed")
    
    logger.info("\nInference Engine Optimization Tests Completed")
    
    return passed_tests == total_tests


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)