#!/usr/bin/env python3
"""
Integration test for Learning Quality Preservation System
Tests the integration of learning quality monitoring with neural network training
"""

import asyncio
import logging
import sys
import os
import numpy as np
from typing import Dict, Any

# Add the server directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ai_engine.neural_network import QueenBehaviorNetwork
from ai_engine.learning_quality_monitor import LearningQualityMonitor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_learning_quality_integration():
    """Test learning quality monitoring integration with neural network training"""
    
    logger.info("Starting Learning Quality Integration Test")
    
    try:
        # Initialize neural network (which includes learning quality monitor)
        neural_network = QueenBehaviorNetwork()
        logger.info("Neural network initialized with learning quality monitoring")
        
        # Create test training data
        test_training_data = {
            'queen_id': 'test_queen_integration',
            'territory_id': 'test_territory_1',
            'generation': 1,
            'death_cause': 'resource_depletion',
            'survival_time': 120.5,
            'resources_collected': 850,
            'units_created': 12,
            'buildings_built': 3,
            'combat_encounters': 2,
            'strategy_effectiveness': 0.75,
            'player_aggression': 0.6,
            'player_expansion_rate': 0.4,
            'player_resource_focus': 0.8,
            'current_accuracy': 0.82,
            'reward_signal': -1.0  # Failure training
        }
        
        logger.info("Testing failure training with learning quality monitoring...")
        
        # Test training on failure with quality monitoring
        failure_result = await neural_network.train_on_failure(test_training_data)
        
        # Verify quality monitoring results
        assert 'learning_quality_metrics' in failure_result, "Learning quality metrics missing from failure training"
        assert 'quality_validation' in failure_result, "Quality validation missing from failure training"
        assert 'quality_preserved' in failure_result, "Quality preservation flag missing from failure training"
        
        quality_metrics = failure_result['learning_quality_metrics']
        quality_validation = failure_result['quality_validation']
        
        logger.info(f"Failure training quality score: {quality_validation['quality_score']:.3f}")
        logger.info(f"Quality preserved: {failure_result['quality_preserved']}")
        
        # Test success training with quality monitoring
        success_training_data = test_training_data.copy()
        success_training_data.update({
            'generation': 2,
            'survival_time': 180.0,
            'strategy_effectiveness': 0.85,
            'current_accuracy': 0.85,
            'reward_signal': 1.0  # Success training
        })
        
        logger.info("Testing success training with learning quality monitoring...")
        
        success_result = await neural_network.train_on_success(success_training_data)
        
        # Verify quality monitoring results
        assert 'learning_quality_metrics' in success_result, "Learning quality metrics missing from success training"
        assert 'quality_validation' in success_result, "Quality validation missing from success training"
        assert 'quality_preserved' in success_result, "Quality preservation flag missing from success training"
        
        success_quality_metrics = success_result['learning_quality_metrics']
        success_quality_validation = success_result['quality_validation']
        
        logger.info(f"Success training quality score: {success_quality_validation['quality_score']:.3f}")
        logger.info(f"Quality preserved: {success_result['quality_preserved']}")
        
        # Test learning quality summary
        logger.info("Testing learning quality summary...")
        
        quality_summary = await neural_network.learning_quality_monitor.get_learning_quality_summary(
            queen_id='test_queen_integration'
        )
        
        assert quality_summary['status'] != 'error', f"Quality summary failed: {quality_summary.get('error')}"
        logger.info(f"Quality summary: {quality_summary['total_measurements']} measurements recorded")
        
        # Test generation comparison
        logger.info("Testing generation quality comparison...")
        
        generation_comparison = await neural_network.learning_quality_monitor.get_generation_quality_comparison([1, 2])
        
        assert 'comparison_data' in generation_comparison, "Generation comparison data missing"
        logger.info(f"Generation comparison completed for generations: {generation_comparison['generations']}")
        
        # Cleanup
        await neural_network.cleanup()
        logger.info("Neural network cleanup completed")
        
        logger.info("✅ Learning Quality Integration Test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ Learning Quality Integration Test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_batch_learning_quality():
    """Test batch learning quality monitoring"""
    
    logger.info("Starting Batch Learning Quality Test")
    
    try:
        # Initialize learning quality monitor directly
        quality_monitor = LearningQualityMonitor()
        await quality_monitor.start_monitoring()
        
        # Create batch training data
        batch_data = []
        for i in range(3):
            batch_data.append({
                'queen_id': f'batch_queen_{i}',
                'territory_id': f'territory_{i}',
                'generation': 1,
                'death_cause': 'combat_loss',
                'survival_time': 100 + i * 20,
                'strategy_effectiveness': 0.7 + i * 0.1,
                'current_accuracy': 0.75 + i * 0.05
            })
        
        # Mock batch learning function
        async def mock_batch_learning(batch_data):
            return {
                'success': True,
                'individual_results': [
                    {'accuracy': 0.78, 'final_accuracy': 0.78, 'strategy_effectiveness': 0.75},
                    {'accuracy': 0.82, 'final_accuracy': 0.82, 'strategy_effectiveness': 0.80},
                    {'accuracy': 0.85, 'final_accuracy': 0.85, 'strategy_effectiveness': 0.85}
                ]
            }
        
        logger.info("Testing batch learning quality monitoring...")
        
        # Test batch learning monitoring
        batch_result = await quality_monitor.monitor_batch_learning(batch_data, mock_batch_learning)
        
        # Verify batch quality monitoring results
        assert 'batch_quality_metrics' in batch_result, "Batch quality metrics missing"
        assert 'batch_quality_validation' in batch_result, "Batch quality validation missing"
        assert 'batch_quality_preserved' in batch_result, "Batch quality preservation flag missing"
        
        batch_validation = batch_result['batch_quality_validation']
        
        logger.info(f"Batch quality score: {batch_validation['batch_quality_score']:.3f}")
        logger.info(f"Batch consistency score: {batch_validation['consistency_score']:.3f}")
        logger.info(f"Batch quality preserved: {batch_result['batch_quality_preserved']}")
        
        # Cleanup
        await quality_monitor.cleanup()
        
        logger.info("✅ Batch Learning Quality Test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ Batch Learning Quality Test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all learning quality integration tests"""
    
    logger.info("=" * 60)
    logger.info("LEARNING QUALITY PRESERVATION INTEGRATION TESTS")
    logger.info("=" * 60)
    
    tests_passed = 0
    total_tests = 2
    
    # Test 1: Neural network integration
    if await test_learning_quality_integration():
        tests_passed += 1
    
    # Test 2: Batch learning quality
    if await test_batch_learning_quality():
        tests_passed += 1
    
    # Summary
    logger.info("=" * 60)
    logger.info(f"INTEGRATION TEST RESULTS: {tests_passed}/{total_tests} tests passed")
    
    if tests_passed == total_tests:
        logger.info("🎉 ALL LEARNING QUALITY INTEGRATION TESTS PASSED!")
        return True
    else:
        logger.error(f"❌ {total_tests - tests_passed} tests failed")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)