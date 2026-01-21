"""
Integration tests for neural network optimization compatibility
Tests that optimized system maintains compatibility with existing AI engine
"""

import asyncio
import pytest
import numpy as np
import tempfile
import os
from unittest.mock import Mock, patch, AsyncMock

# Import the neural network and optimization systems
from ai_engine.neural_network import QueenBehaviorNetwork
from ai_engine.optimization_configuration_system import (
    OptimizationConfigurationManager, OptimizationFeature, OptimizationLevel
)
from ai_engine.neural_network_integration import NeuralNetworkOptimizationIntegrator


class TestNeuralNetworkIntegration:
    """Test neural network optimization integration compatibility"""
    
    @pytest.fixture
    async def neural_network(self):
        """Create a neural network instance for testing"""
        with patch('ai_engine.neural_network.TENSORFLOW_AVAILABLE', True):
            with patch('tensorflow.keras.Sequential') as mock_sequential:
                # Mock the TensorFlow model
                mock_model = Mock()
                mock_model.compile = Mock()
                mock_model.count_params = Mock(return_value=1000)
                mock_model.predict = Mock(return_value=np.random.random((1, 20)))
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
    async def test_backward_compatibility_with_existing_ai_engine(self, neural_network):
        """Test that optimized system maintains compatibility with existing AI engine"""
        
        # Test basic neural network functionality still works
        test_features = np.random.random((1, 50)).astype(np.float32)
        
        # Test synchronous prediction (existing interface)
        predictions = neural_network.predict_strategy(test_features)
        assert predictions is not None
        assert predictions.shape == (1, 20)
        
        # Test asynchronous prediction (new interface)
        async_predictions = await neural_network.predict_strategy_async(test_features)
        assert async_predictions is not None
        assert async_predictions.shape == (1, 20)
        
        # Test training interfaces still work
        training_data = {
            'generation': 1,
            'death_cause': 'protector_assault',
            'survival_time': 120,
            'strategy_labels': [1, 5, 10]
        }
        
        # Test failure training
        failure_result = await neural_network.train_on_failure(training_data)
        assert failure_result['success'] is True
        assert 'training_time' in failure_result
        
        # Test success training
        success_result = await neural_network.train_on_success(training_data)
        assert success_result['success'] is True
        assert 'training_time' in success_result
    
    @pytest.mark.asyncio
    async def test_configuration_system_selective_optimization(self, config_manager):
        """Test configuration system allows selective optimization enabling"""
        
        # Test enabling individual features
        result = config_manager.enable_feature(
            OptimizationFeature.PERFORMANCE_PROFILING,
            OptimizationLevel.BALANCED
        )
        assert result is True
        assert config_manager.is_feature_enabled(OptimizationFeature.PERFORMANCE_PROFILING)
        
        # Test disabling features
        result = config_manager.disable_feature(OptimizationFeature.PERFORMANCE_PROFILING)
        assert result is True
        assert not config_manager.is_feature_enabled(OptimizationFeature.PERFORMANCE_PROFILING)
        
        # Test profile switching
        result = config_manager.set_active_profile('production')
        assert result is True
        assert config_manager.get_active_profile().profile_name == 'production'
        
        # Test feature dependencies are respected
        config_manager.enable_feature(OptimizationFeature.MODEL_QUANTIZATION)
        # Should automatically enable performance profiling (dependency)
        assert config_manager.is_feature_enabled(OptimizationFeature.PERFORMANCE_PROFILING)
        
        # Test configuration validation
        validation = config_manager.validate_configuration()
        assert validation['valid'] is True
        assert isinstance(validation['warnings'], list)
        assert isinstance(validation['recommendations'], list)
    
    @pytest.mark.asyncio
    async def test_performance_improvements_dont_break_functionality(self, integration_system, neural_network):
        """Test performance improvements don't break existing functionality"""
        
        # Initialize optimizations
        init_result = await integration_system.initialize_optimizations()
        assert init_result['success'] is True
        
        # Test that optimized prediction still returns correct format
        test_features = np.random.random((1, 50)).astype(np.float32)
        
        optimized_result = await integration_system.optimized_predict_strategy(test_features)
        assert optimized_result['success'] is True
        assert 'predictions' in optimized_result
        assert 'optimization_metadata' in optimized_result
        
        # Test batch prediction compatibility
        batch_features = [
            np.random.random((1, 50)).astype(np.float32) for _ in range(5)
        ]
        
        batch_results = await neural_network.predict_batch_async(batch_features)
        assert len(batch_results) == 5
        assert all(result.shape == (1, 20) for result in batch_results)
        
        # Test training still works with optimizations enabled
        training_data = {
            'generation': 2,
            'death_cause': 'worker_infiltration',
            'survival_time': 180,
            'strategy_labels': [2, 7, 15]
        }
        
        training_result = await neural_network.train_on_failure(training_data)
        assert training_result['success'] is True
        
        # Test optimization status reporting
        status = integration_system.get_integration_status()
        assert status['integration_status']['initialized'] is True
        assert isinstance(status['integration_status']['active_optimizations'], list)
    
    @pytest.mark.asyncio
    async def test_optimization_feature_runtime_control(self, integration_system):
        """Test optimization features can be controlled at runtime"""
        
        # Initialize system
        await integration_system.initialize_optimizations()
        
        # Test enabling feature at runtime
        enable_result = integration_system.enable_optimization_feature(
            OptimizationFeature.BATCH_PROCESSING,
            OptimizationLevel.AGGRESSIVE
        )
        assert enable_result['success'] is True
        
        # Test disabling feature at runtime
        disable_result = integration_system.disable_optimization_feature(
            OptimizationFeature.BATCH_PROCESSING
        )
        assert disable_result['success'] is True
        
        # Test profile switching at runtime
        switch_result = integration_system.switch_optimization_profile('development')
        assert switch_result['success'] is True
    
    @pytest.mark.asyncio
    async def test_fallback_mechanisms_work_correctly(self, integration_system, neural_network):
        """Test fallback mechanisms work when optimizations fail"""
        
        # Test legacy prediction fallback
        test_features = np.random.random((1, 50)).astype(np.float32)
        
        # Simulate optimization failure by not initializing
        legacy_result = await integration_system._legacy_predict_strategy(test_features)
        assert legacy_result['success'] is True
        assert legacy_result['legacy_mode'] is True
        assert 'predictions' in legacy_result
        
        # Test batch processing fallback
        batch_features = [
            np.random.random((1, 50)).astype(np.float32) for _ in range(3)
        ]
        
        fallback_results = await neural_network._predict_batch_fallback(batch_features, 'test_op')
        assert len(fallback_results) == 3
        assert all(result.shape == (1, 20) for result in fallback_results)
    
    @pytest.mark.asyncio
    async def test_cleanup_handles_all_optimization_systems(self, neural_network):
        """Test cleanup method handles all optimization systems gracefully"""
        
        # Mock all optimization components
        neural_network._optimization_integrator = Mock()
        neural_network._optimization_integrator.cleanup = AsyncMock()
        
        neural_network.performance_monitor = Mock()
        neural_network.performance_monitor.cleanup = AsyncMock()
        
        neural_network.performance_profiler = Mock()
        neural_network.performance_profiler.cleanup = AsyncMock()
        
        neural_network.learning_quality_monitor = Mock()
        neural_network.learning_quality_monitor.cleanup = AsyncMock()
        
        neural_network.degradation_manager = Mock()
        neural_network.degradation_manager.stop_monitoring = AsyncMock()
        
        neural_network.rollback_manager = Mock()
        neural_network.rollback_manager.cleanup = AsyncMock()
        
        neural_network.multi_gpu_coordinator = Mock()
        neural_network.multi_gpu_coordinator.cleanup = AsyncMock()
        
        neural_network.gpu_manager = Mock()
        neural_network.gpu_manager.cleanup = AsyncMock()
        
        neural_network.hardware_detector = Mock()
        neural_network.hardware_detector.cleanup = AsyncMock()
        
        # Test cleanup
        await neural_network.cleanup()
        
        # Verify all cleanup methods were called
        neural_network._optimization_integrator.cleanup.assert_called_once()
        neural_network.performance_monitor.cleanup.assert_called_once()
        neural_network.performance_profiler.cleanup.assert_called_once()
        neural_network.learning_quality_monitor.cleanup.assert_called_once()
        neural_network.degradation_manager.stop_monitoring.assert_called_once()
        neural_network.rollback_manager.cleanup.assert_called_once()
        neural_network.multi_gpu_coordinator.cleanup.assert_called_once()
        neural_network.gpu_manager.cleanup.assert_called_once()
        neural_network.hardware_detector.cleanup.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_cleanup_handles_exceptions_gracefully(self, neural_network):
        """Test cleanup handles exceptions in individual components gracefully"""
        
        # Mock components that raise exceptions during cleanup
        neural_network._optimization_integrator = Mock()
        neural_network._optimization_integrator.cleanup = AsyncMock(side_effect=Exception("Integration cleanup failed"))
        
        neural_network.performance_monitor = Mock()
        neural_network.performance_monitor.cleanup = AsyncMock(side_effect=Exception("Monitor cleanup failed"))
        
        neural_network.gpu_manager = Mock()
        neural_network.gpu_manager.cleanup = AsyncMock()  # This one succeeds
        
        # Test cleanup doesn't raise exception despite individual failures
        await neural_network.cleanup()
        
        # Verify all cleanup methods were attempted
        neural_network._optimization_integrator.cleanup.assert_called_once()
        neural_network.performance_monitor.cleanup.assert_called_once()
        neural_network.gpu_manager.cleanup.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_optimization_recommendations_system(self, integration_system):
        """Test optimization recommendations system works correctly"""
        
        # Initialize system
        await integration_system.initialize_optimizations()
        
        # Get recommendations
        recommendations = integration_system.get_optimization_recommendations()
        assert isinstance(recommendations, list)
        
        # Test recommendations are contextual
        # Simulate poor performance to trigger recommendations
        integration_system.current_metrics['inference_times'] = [25.0] * 20  # Slow inference
        
        recommendations = integration_system.get_optimization_recommendations()
        assert any('quantization' in rec.lower() for rec in recommendations)
    
    def test_configuration_persistence(self, config_manager):
        """Test configuration changes are persisted correctly"""
        
        # Create custom profile
        result = config_manager.create_custom_profile(
            'test_profile',
            'Test profile for integration testing',
            'development'
        )
        assert result is True
        
        # Switch to custom profile
        result = config_manager.set_active_profile('test_profile')
        assert result is True
        
        # Enable feature
        result = config_manager.enable_feature(
            OptimizationFeature.GPU_ACCELERATION,
            OptimizationLevel.AGGRESSIVE
        )
        assert result is True
        
        # Create new manager instance (simulates restart)
        new_manager = OptimizationConfigurationManager(config_dir=config_manager.config_dir)
        
        # Verify configuration was persisted
        assert 'test_profile' in new_manager.available_profiles
        assert new_manager.get_active_profile().profile_name == 'test_profile'
        assert new_manager.is_feature_enabled(OptimizationFeature.GPU_ACCELERATION)
    
    @pytest.mark.asyncio
    async def test_integration_status_reporting(self, integration_system):
        """Test integration status reporting provides comprehensive information"""
        
        # Test status before initialization
        status = integration_system.get_integration_status()
        assert status['integration_status']['initialized'] is False
        
        # Initialize and test status after
        await integration_system.initialize_optimizations()
        
        status = integration_system.get_integration_status()
        assert status['integration_status']['initialized'] is True
        assert 'active_optimizations' in status['integration_status']
        assert 'configuration_status' in status
        assert 'performance_data' in status
        assert 'component_status' in status
        assert 'backward_compatibility' in status


if __name__ == '__main__':
    # Run tests
    pytest.main([__file__, '-v'])