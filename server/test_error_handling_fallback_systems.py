#!/usr/bin/env python3
"""
Comprehensive test for Error Handling and Fallback Systems
Tests Requirements 2.4, 3.4, 6.5 for comprehensive fallback mechanisms
"""

import asyncio
import logging
import sys
import os
import time
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, Any

# Add the server directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ai_engine.graceful_degradation_manager import GracefulDegradationManager, DegradationLevel, ServiceMode
from ai_engine.optimization_rollback_manager import OptimizationRollbackManager, OptimizationType, RollbackReason
from ai_engine.neural_network import QueenBehaviorNetwork
from ai_engine.error_recovery import ErrorRecoveryManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_graceful_degradation_system():
    """Test graceful degradation system functionality"""
    logger.info("Testing Graceful Degradation System")
    
    try:
        degradation_manager = GracefulDegradationManager()
        await degradation_manager.start_monitoring()
        
        # Test normal operation
        assert degradation_manager.current_level == DegradationLevel.NORMAL
        assert degradation_manager.current_mode == ServiceMode.FULL_PERFORMANCE
        
        # Test manual degradation
        await degradation_manager.force_degradation(DegradationLevel.LIGHT, "test_degradation")
        
        assert degradation_manager.current_level == DegradationLevel.LIGHT
        assert degradation_manager.current_mode == ServiceMode.OPTIMIZED
        assert not degradation_manager.is_feature_enabled('model_quantization') or \
               degradation_manager.get_feature_reduction_factor('batch_size') < 1.0
        
        # Test moderate degradation
        await degradation_manager.force_degradation(DegradationLevel.MODERATE, "test_moderate")
        
        assert degradation_manager.current_level == DegradationLevel.MODERATE
        assert degradation_manager.current_mode == ServiceMode.REDUCED
        assert not degradation_manager.is_feature_enabled('model_quantization')
        
        # Test heavy degradation
        await degradation_manager.force_degradation(DegradationLevel.HEAVY, "test_heavy")
        
        assert degradation_manager.current_level == DegradationLevel.HEAVY
        assert degradation_manager.current_mode == ServiceMode.MINIMAL
        assert not degradation_manager.is_feature_enabled('batch_processing')
        
        # Test critical degradation
        await degradation_manager.force_degradation(DegradationLevel.CRITICAL, "test_critical")
        
        assert degradation_manager.current_level == DegradationLevel.CRITICAL
        assert degradation_manager.current_mode == ServiceMode.EMERGENCY
        assert not degradation_manager.is_feature_enabled('neural_network_training')
        assert degradation_manager.is_fallback_active('rule_based_strategy')
        
        # Test recovery
        await degradation_manager.force_recovery("test_recovery")
        
        assert degradation_manager.current_level == DegradationLevel.NORMAL
        assert degradation_manager.current_mode == ServiceMode.FULL_PERFORMANCE
        
        # Test system status
        status = degradation_manager.get_system_status()
        assert 'degradation_level' in status
        assert 'service_mode' in status
        assert 'disabled_features' in status
        
        # Test performance impact summary
        impact = degradation_manager.get_performance_impact_summary()
        assert 'impact_level' in impact
        assert 'degradation_level' in impact
        
        await degradation_manager.stop_monitoring()
        
        logger.info("✅ Graceful Degradation System test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ Graceful Degradation System test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_optimization_rollback_system():
    """Test optimization rollback system functionality"""
    logger.info("Testing Optimization Rollback System")
    
    try:
        rollback_manager = OptimizationRollbackManager()
        
        # Clear any existing rollback history for clean test
        rollback_manager.rollback_history.clear()
        
        # Test snapshot creation
        optimization_config = {
            'quantization_method': 'dynamic_range',
            'target_accuracy': 0.95,
            'compression_ratio': 0.25
        }
        
        snapshot_id = await rollback_manager.create_optimization_snapshot(
            OptimizationType.MODEL_QUANTIZATION,
            optimization_config,
            model_path="models/queen_behavior_model.keras"  # Provide model path for backup
        )
        
        assert snapshot_id is not None
        assert snapshot_id in rollback_manager.snapshots
        
        # Test performance monitoring with good performance
        good_metrics = {
            'inference_time': 15.0,  # Good performance
            'training_time': 120.0,
            'accuracy': 0.87,
            'throughput': 50.0
        }
        
        monitoring_result = await rollback_manager.monitor_optimization_performance(
            snapshot_id, good_metrics, error_occurred=False
        )
        
        assert not monitoring_result['rollback_recommended']
        assert not monitoring_result['rollback_executed']
        
        # Test performance monitoring with degraded performance
        bad_metrics = {
            'inference_time': 80.0,  # Poor performance (5x worse)
            'training_time': 600.0,  # Much slower
            'accuracy': 0.60,        # Lower accuracy
            'throughput': 10.0       # Lower throughput
        }
        
        # Disable auto-rollback for this test
        rollback_manager.auto_rollback_enabled = False
        
        monitoring_result = await rollback_manager.monitor_optimization_performance(
            snapshot_id, bad_metrics, error_occurred=False
        )
        
        assert monitoring_result['rollback_recommended']
        assert monitoring_result['performance_analysis']['degradation_detected']
        
        # Test manual rollback
        rollback_result = await rollback_manager.rollback_optimization(
            snapshot_id, RollbackReason.PERFORMANCE_DEGRADATION
        )
        
        assert rollback_result['success']
        assert rollback_result['optimization_type'] == OptimizationType.MODEL_QUANTIZATION.value
        assert rollback_result['reason'] == RollbackReason.PERFORMANCE_DEGRADATION.value
        
        # Test rollback statistics
        stats = rollback_manager.get_rollback_statistics()
        assert stats['total_rollbacks'] == 1
        assert stats['success_rate'] == 1.0
        assert OptimizationType.MODEL_QUANTIZATION.value in stats['rollbacks_by_type']
        
        await rollback_manager.cleanup()
        
        logger.info("✅ Optimization Rollback System test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ Optimization Rollback System test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_neural_network_error_handling():
    """Test neural network error handling and fallback mechanisms"""
    logger.info("Testing Neural Network Error Handling")
    
    try:
        neural_network = QueenBehaviorNetwork()
        
        # Test normal training (should work)
        normal_training_data = {
            'queen_id': 'test_error_handling_queen',
            'territory_id': 'test_territory',
            'generation': 1,
            'death_cause': 'protector_assault',
            'survival_time': 120.0,
            'strategy_effectiveness': 0.75,
            'current_accuracy': 0.80
        }
        
        result = await neural_network.train_on_failure(normal_training_data)
        assert result['success'] == True
        assert 'fallback_type' not in result  # Should not need fallback
        
        # Test with degraded system
        await neural_network.degradation_manager.force_degradation(
            DegradationLevel.HEAVY, "test_degraded_training"
        )
        
        degraded_result = await neural_network.train_on_failure(normal_training_data)
        assert degraded_result['success'] == True
        assert 'degraded_training' in degraded_result or 'fallback_type' in degraded_result
        
        # Test with critical degradation (should use rule-based fallback)
        await neural_network.degradation_manager.force_degradation(
            DegradationLevel.CRITICAL, "test_critical_fallback"
        )
        
        critical_result = await neural_network.train_on_failure(normal_training_data)
        assert critical_result['success'] == True
        assert critical_result.get('neural_network_bypassed') == True or \
               critical_result.get('method') == 'rule_based_fallback'
        
        # Test rule-based strategy generation
        strategy = neural_network._generate_rule_based_strategy(
            generation=3,
            death_cause='protector_assault',
            survival_time=45.0
        )
        
        assert 'hive_placement' in strategy
        assert 'parasite_spawning' in strategy
        assert 'defensive_coordination' in strategy
        assert strategy['hive_placement'] == 'hidden'  # Should adapt to protector assault
        
        # Test recovery
        await neural_network.degradation_manager.force_recovery("test_recovery")
        
        recovery_result = await neural_network.train_on_failure(normal_training_data)
        assert recovery_result['success'] == True
        
        await neural_network.cleanup()
        
        logger.info("✅ Neural Network Error Handling test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ Neural Network Error Handling test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_comprehensive_fallback_mechanisms():
    """Test comprehensive fallback mechanisms integration"""
    logger.info("Testing Comprehensive Fallback Mechanisms")
    
    try:
        neural_network = QueenBehaviorNetwork()
        
        # Test GPU to CPU fallback simulation
        training_data = {
            'queen_id': 'fallback_test_queen',
            'generation': 2,
            'death_cause': 'coordinated_attack',
            'survival_time': 180.0
        }
        
        # Simulate GPU error
        gpu_fallback_result = await neural_network._execute_gpu_to_cpu_fallback(training_data)
        assert gpu_fallback_result['success'] == True
        assert gpu_fallback_result.get('gpu_fallback') == True
        
        # Test reduced complexity fallback
        complexity_fallback_result = await neural_network._execute_reduced_complexity_fallback(training_data)
        assert complexity_fallback_result['success'] == True
        assert complexity_fallback_result.get('complexity_reduced') == True
        
        # Test rule-based fallback
        rule_fallback_result = await neural_network._execute_rule_based_fallback(training_data)
        assert rule_fallback_result['success'] == True
        assert rule_fallback_result.get('neural_network_bypassed') == True
        assert 'strategy' in rule_fallback_result
        
        # Test comprehensive fallback with simulated error
        class SimulatedGPUError(Exception):
            pass
        
        comprehensive_result = await neural_network._execute_comprehensive_fallback(
            training_data, 'test_operation', SimulatedGPUError("CUDA out of memory")
        )
        
        assert comprehensive_result['success'] == True
        assert 'fallback_type' in comprehensive_result
        
        # Test degradation triggers
        bad_training_result = {
            'success': False,
            'error': 'CUDA out of memory error',
            'training_time': 350,  # Exceeds threshold
            'quality_preserved': False
        }
        
        await neural_network._check_degradation_triggers(bad_training_result)
        
        # Should have triggered degradation
        assert neural_network.degradation_manager.current_level != DegradationLevel.NORMAL
        
        await neural_network.cleanup()
        
        logger.info("✅ Comprehensive Fallback Mechanisms test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ Comprehensive Fallback Mechanisms test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_error_recovery_integration():
    """Test error recovery system integration"""
    logger.info("Testing Error Recovery Integration")
    
    try:
        error_recovery = ErrorRecoveryManager()
        
        # Test neural network error handling
        training_error = Exception("Training timeout exceeded")
        context = {
            'operation': 'train_on_failure',
            'training_data': {'generation': 1},
            'death_data': {'queen_id': 'test_queen', 'generation': 1}
        }
        
        recovery_result = await error_recovery.handle_neural_network_error(training_error, context)
        
        assert recovery_result['success'] == True
        assert 'strategy' in recovery_result
        
        # Test WebSocket error handling
        websocket_error = Exception("WebSocket connection lost")
        websocket_context = {'operation': 'send_message'}
        
        websocket_recovery = await error_recovery.handle_websocket_error(websocket_error, websocket_context)
        
        assert websocket_recovery['success'] == True
        assert 'strategy' in websocket_recovery
        
        # Test error pattern detection
        # Simulate multiple errors to trigger pattern detection
        for i in range(3):
            await error_recovery.handle_neural_network_error(training_error, context)
        
        # Strategy should have escalated
        final_recovery = await error_recovery.handle_neural_network_error(training_error, context)
        # Should still succeed but may use different strategy
        assert final_recovery['success'] == True
        
        logger.info("✅ Error Recovery Integration test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error Recovery Integration test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_service_availability_during_failures():
    """Test that service remains available during various failure scenarios"""
    logger.info("Testing Service Availability During Failures")
    
    try:
        neural_network = QueenBehaviorNetwork()
        
        # Test continuous service during degradation
        training_requests = []
        for i in range(5):
            training_data = {
                'queen_id': f'availability_test_queen_{i}',
                'generation': i + 1,
                'death_cause': 'protector_assault',
                'survival_time': 100 + i * 20
            }
            training_requests.append(training_data)
        
        # Process requests while gradually degrading system
        results = []
        for i, request in enumerate(training_requests):
            # Increase degradation with each request
            if i == 1:
                await neural_network.degradation_manager.force_degradation(
                    DegradationLevel.LIGHT, f"test_degradation_{i}"
                )
            elif i == 2:
                await neural_network.degradation_manager.force_degradation(
                    DegradationLevel.MODERATE, f"test_degradation_{i}"
                )
            elif i == 3:
                await neural_network.degradation_manager.force_degradation(
                    DegradationLevel.HEAVY, f"test_degradation_{i}"
                )
            elif i == 4:
                await neural_network.degradation_manager.force_degradation(
                    DegradationLevel.CRITICAL, f"test_degradation_{i}"
                )
            
            result = await neural_network.train_on_failure(request)
            results.append(result)
            
            # Service should remain available at all degradation levels
            assert result['success'] == True, f"Service failed at degradation level {i}"
        
        # Verify all requests were processed successfully
        assert len(results) == 5
        assert all(r['success'] for r in results)
        
        # Verify degradation progression
        assert any('degraded_training' in r or 'fallback_type' in r or 'neural_network_bypassed' in r 
                  for r in results[1:])  # Later results should show degradation
        
        # Test recovery maintains service
        await neural_network.degradation_manager.force_recovery("test_service_recovery")
        
        recovery_request = {
            'queen_id': 'recovery_test_queen',
            'generation': 6,
            'death_cause': 'energy_depletion',
            'survival_time': 200
        }
        
        recovery_result = await neural_network.train_on_failure(recovery_request)
        assert recovery_result['success'] == True
        
        await neural_network.cleanup()
        
        logger.info("✅ Service Availability During Failures test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ Service Availability During Failures test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all Error Handling and Fallback Systems tests"""
    
    logger.info("=" * 80)
    logger.info("ERROR HANDLING AND FALLBACK SYSTEMS TESTS")
    logger.info("=" * 80)
    
    tests_passed = 0
    total_tests = 6
    
    # Test 1: Graceful Degradation System
    if await test_graceful_degradation_system():
        tests_passed += 1
    
    # Test 2: Optimization Rollback System
    if await test_optimization_rollback_system():
        tests_passed += 1
    
    # Test 3: Neural Network Error Handling
    if await test_neural_network_error_handling():
        tests_passed += 1
    
    # Test 4: Comprehensive Fallback Mechanisms
    if await test_comprehensive_fallback_mechanisms():
        tests_passed += 1
    
    # Test 5: Error Recovery Integration
    if await test_error_recovery_integration():
        tests_passed += 1
    
    # Test 6: Service Availability During Failures
    if await test_service_availability_during_failures():
        tests_passed += 1
    
    # Summary
    logger.info("=" * 80)
    logger.info(f"ERROR HANDLING TEST RESULTS: {tests_passed}/{total_tests} tests passed")
    
    if tests_passed == total_tests:
        logger.info("🎉 ALL ERROR HANDLING AND FALLBACK SYSTEMS TESTS PASSED!")
        logger.info("✅ Requirement 2.4: Comprehensive fallback mechanisms - VALIDATED")
        logger.info("✅ Requirement 3.4: Graceful degradation system - VALIDATED")
        logger.info("✅ Requirement 6.5: Automatic recovery systems - VALIDATED")
        return True
    else:
        logger.error(f"❌ {total_tests - tests_passed} tests failed")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)