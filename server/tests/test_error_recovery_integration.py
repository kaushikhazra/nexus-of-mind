"""
Integration tests for Error Recovery and Data Validation systems
Tests comprehensive error handling, recovery, and graceful degradation
"""

import pytest
import asyncio
import json
import tempfile
import os
from unittest.mock import Mock, patch, AsyncMock

# Import the components we're testing
from ai_engine.error_recovery import ErrorRecoveryManager, ErrorSeverity, RecoveryStrategy
from ai_engine.data_validator import DataValidator, DataCorruptionError, ValidationRecoveryError
from ai_engine.ai_engine import AIEngine


class TestErrorRecoveryIntegration:
    """Test error recovery system integration"""
    
    @pytest.fixture
    def error_recovery_manager(self):
        """Create error recovery manager for testing"""
        return ErrorRecoveryManager(max_retry_attempts=3, retry_delay=0.1)
    
    @pytest.fixture
    def data_validator(self):
        """Create data validator for testing"""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield DataValidator(backup_directory=temp_dir)
    
    @pytest.fixture
    def ai_engine(self):
        """Create AI engine for testing"""
        return AIEngine()
    
    @pytest.mark.asyncio
    async def test_neural_network_training_timeout_recovery(self, error_recovery_manager):
        """Test recovery from neural network training timeout"""
        # Simulate training timeout error
        timeout_error = Exception("Training timeout exceeded")
        context = {
            'operation': 'train_on_failure',
            'training_data': {'generation': 1, 'reward_signal': -1.0},
            'death_data': {'queen_id': 'test_queen', 'generation': 1}
        }
        
        # Test recovery
        recovery_result = await error_recovery_manager.handle_neural_network_error(
            timeout_error, context
        )
        
        assert recovery_result['success'] == True
        assert 'strategy' in recovery_result
        assert recovery_result['strategy'] in ['retry', 'fallback', 'rule_based_fallback']
    
    @pytest.mark.asyncio
    async def test_neural_network_gpu_memory_error_recovery(self, error_recovery_manager):
        """Test recovery from GPU memory error"""
        # Simulate GPU memory error
        gpu_error = Exception("CUDA out of memory")
        context = {
            'operation': 'train_on_failure',
            'gpu_error': True,
            'training_data': {'generation': 5, 'reward_signal': -1.0}
        }
        
        # Test recovery
        recovery_result = await error_recovery_manager.handle_neural_network_error(
            gpu_error, context
        )
        
        assert recovery_result['success'] == True
        assert recovery_result.get('gpu_disabled') == True or recovery_result.get('strategy') == 'cpu_fallback'
    
    @pytest.mark.asyncio
    async def test_neural_network_complete_failure_fallback(self, error_recovery_manager):
        """Test fallback to rule-based strategy when neural network completely fails"""
        # Simulate complete neural network failure
        critical_error = Exception("Neural network initialization failed")
        context = {
            'operation': 'train_on_failure',
            'death_data': {
                'queen_id': 'test_queen',
                'generation': 3,
                'death_cause': 'protector_assault',
                'survival_time': 45
            }
        }
        
        # Test recovery
        recovery_result = await error_recovery_manager.handle_neural_network_error(
            critical_error, context
        )
        
        assert recovery_result['success'] == True
        assert recovery_result.get('neural_network_bypassed') == True
        assert 'strategy' in recovery_result.get('result', {})
    
    @pytest.mark.asyncio
    async def test_websocket_connection_lost_recovery(self, error_recovery_manager):
        """Test recovery from WebSocket connection loss"""
        # Simulate connection lost error
        connection_error = Exception("WebSocket connection lost")
        context = {
            'operation': 'send_message',
            'message_type': 'queen_death'
        }
        
        # Test recovery
        recovery_result = await error_recovery_manager.handle_websocket_error(
            connection_error, context
        )
        
        assert recovery_result['success'] == True
        assert recovery_result['strategy'] in ['retry', 'graceful_degradation']
    
    def test_data_validation_queen_death_data(self, data_validator):
        """Test data validation for Queen death data"""
        # Valid data
        valid_data = {
            'queen_id': 'test_queen_123',
            'generation': 5,
            'death_location': {'x': 10.5, 'y': 20.0, 'z': 5.5},
            'death_cause': 'protector_assault',
            'survival_time': 120.5,
            'parasites_spawned': 15,
            'hive_discovery_time': 60.0
        }
        
        is_valid, error_message = data_validator.validate_data(valid_data, 'queen_death')
        assert is_valid == True
        assert error_message is None
        
        # Invalid data
        invalid_data = {
            'queen_id': '',  # Empty queen ID
            'generation': -1,  # Invalid generation
            'death_location': {'x': 10.5},  # Missing y, z coordinates
            'death_cause': 'invalid_cause',  # Invalid death cause
            'survival_time': -50  # Negative survival time
        }
        
        is_valid, error_message = data_validator.validate_data(invalid_data, 'queen_death')
        assert is_valid == False
        assert error_message is not None
    
    def test_data_sanitization_queen_death_data(self, data_validator):
        """Test data sanitization for corrupted Queen death data"""
        # Corrupted data
        corrupted_data = {
            'queen_id': None,  # Missing queen ID
            'generation': 'invalid',  # Wrong type
            'death_location': {'x': 'not_a_number', 'y': 2000, 'z': -2000},  # Invalid coordinates
            'death_cause': 'unknown_cause',  # Invalid cause
            'survival_time': -100,  # Negative time
            'parasites_spawned': 'many'  # Wrong type
        }
        
        # Sanitize data
        sanitized_data = data_validator.sanitize_data(corrupted_data, 'queen_death')
        
        # Verify sanitization
        assert sanitized_data['queen_id'].startswith('recovered_queen_')
        assert sanitized_data['generation'] == 1
        assert sanitized_data['death_location']['x'] == 0
        assert sanitized_data['death_location']['y'] == 1000  # Clamped to max
        assert sanitized_data['death_location']['z'] == -1000  # Clamped to min
        assert sanitized_data['death_cause'] == 'unknown'
        assert sanitized_data['survival_time'] == 0
        assert sanitized_data['parasites_spawned'] == 0
    
    def test_data_corruption_detection(self, data_validator):
        """Test data corruption detection"""
        # Data with logical inconsistencies
        corrupted_data = {
            'queen_id': 'test_queen',
            'generation': 5,
            'death_location': {'x': 0, 'y': 0, 'z': 0},
            'death_cause': 'protector_assault',
            'survival_time': 60,
            'hive_discovery_time': 120,  # Discovery time > survival time (impossible)
            'parasites_spawned': -5  # Negative parasites (impossible)
        }
        
        is_corrupted, issues = data_validator.detect_corruption(corrupted_data, 'queen_death')
        
        assert is_corrupted == True
        assert len(issues) >= 2  # Should detect both issues
        assert any('discovery time exceeds survival time' in issue.lower() for issue in issues)
        assert any('impossible parasites spawned' in issue.lower() for issue in issues)
    
    def test_data_recovery_from_corruption(self, data_validator):
        """Test data recovery from corruption"""
        # Severely corrupted data
        corrupted_data = {
            'queen_id': None,
            'generation': -999,
            'survival_time': 'not_a_number',
            'death_cause': 'completely_invalid'
        }
        
        # Attempt recovery
        recovered_data = data_validator.recover_corrupted_data(corrupted_data, 'queen_death')
        
        # Verify recovery
        assert recovered_data['queen_id'] is not None
        assert recovered_data['generation'] >= 1
        assert isinstance(recovered_data['survival_time'], (int, float))
        assert recovered_data['survival_time'] >= 0
        assert recovered_data['death_cause'] in ['protector_assault', 'worker_infiltration', 'coordinated_attack', 'energy_depletion', 'unknown']
    
    def test_data_backup_and_restore(self, data_validator):
        """Test data backup and restore functionality"""
        # Test data
        test_data = {
            'queen_id': 'backup_test_queen',
            'generation': 10,
            'death_location': {'x': 5, 'y': 10, 'z': 15},
            'death_cause': 'coordinated_attack',
            'survival_time': 300
        }
        
        # Create backup
        backup_success = data_validator.backup_data(test_data, 'queen_death', 'test_backup')
        assert backup_success == True
        
        # Verify backup file exists
        backup_files = [f for f in os.listdir(data_validator.backup_directory) 
                       if f.startswith('queen_death_backup_') and 'test_backup' in f]
        assert len(backup_files) > 0
    
    @pytest.mark.asyncio
    async def test_ai_engine_error_recovery_integration(self, ai_engine):
        """Test AI Engine integration with error recovery"""
        # Mock the neural network to raise an error
        with patch.object(ai_engine, 'neural_network') as mock_nn:
            mock_nn.train_on_failure = AsyncMock(side_effect=Exception("Training failed"))
            
            # Initialize AI Engine
            await ai_engine.initialize()
            
            # Test data that should trigger error recovery
            death_data = {
                'queen_id': 'integration_test_queen',
                'generation': 3,
                'death_location': {'x': 0, 'y': 0, 'z': 0},
                'death_cause': 'protector_assault',
                'survival_time': 90,
                'parasites_spawned': 5,
                'hive_discovery_time': 30,
                'player_units': {'protectors': [], 'workers': []},
                'assault_pattern': {},
                'game_state': {}
            }
            
            # Process death data (should trigger error recovery)
            result = await ai_engine.process_queen_death(death_data)
            
            # Verify that we got a result despite the neural network failure
            assert result is not None
            assert 'type' in result
            # Should either be a successful strategy or an error response
            assert result['type'] in ['queen_strategy', 'error']
            
            if result['type'] == 'queen_strategy':
                # Verify fallback strategy was generated
                assert 'data' in result
                assert 'strategies' in result['data']
                assert result['data'].get('errorRecoveryApplied') == True
    
    @pytest.mark.asyncio
    async def test_error_pattern_detection_and_escalation(self, error_recovery_manager):
        """Test error pattern detection and strategy escalation"""
        # Simulate repeated connection failures
        connection_error = Exception("Connection failed")
        context = {'operation': 'connect'}
        
        # First few failures should use retry strategy
        for i in range(2):
            recovery_result = await error_recovery_manager.handle_websocket_error(
                connection_error, context
            )
            assert recovery_result['strategy'] == 'retry'
        
        # After pattern detection, strategy should escalate
        for i in range(3):
            recovery_result = await error_recovery_manager.handle_websocket_error(
                connection_error, context
            )
        
        # Strategy should have escalated to graceful degradation
        final_result = await error_recovery_manager.handle_websocket_error(
            connection_error, context
        )
        assert final_result['strategy'] in ['graceful_degradation', 'fallback']
    
    def test_system_health_monitoring(self, error_recovery_manager):
        """Test system health status monitoring"""
        # Get initial health status
        health_status = error_recovery_manager.get_system_health_status()
        
        assert 'system_health' in health_status
        assert 'error_statistics' in health_status
        assert 'recovery_strategies' in health_status
        
        # Verify health components
        system_health = health_status['system_health']
        assert 'neural_network' in system_health
        assert 'websocket' in system_health
        assert 'data_validation' in system_health
        assert 'memory_management' in system_health
    
    def test_validation_statistics(self, data_validator):
        """Test data validation statistics"""
        stats = data_validator.get_validation_statistics()
        
        assert 'schemas_loaded' in stats
        assert 'backup_directory' in stats
        assert 'available_schemas' in stats
        assert stats['schemas_loaded'] > 0
        assert 'queen_death' in stats['available_schemas']
        assert 'training_data' in stats['available_schemas']
        assert 'strategy' in stats['available_schemas']
    
    @pytest.mark.asyncio
    async def test_comprehensive_error_recovery_scenario(self, error_recovery_manager, data_validator):
        """Test comprehensive error recovery scenario with multiple failure types"""
        # Scenario: Neural network fails, data is corrupted, WebSocket is down
        
        # 1. Corrupted death data
        corrupted_death_data = {
            'queen_id': None,
            'generation': 'invalid',
            'death_cause': 'unknown_cause',
            'survival_time': -100
        }
        
        # Recover corrupted data
        recovered_data = data_validator.recover_corrupted_data(corrupted_death_data, 'queen_death')
        assert recovered_data['queen_id'] is not None
        assert recovered_data['generation'] >= 1
        
        # 2. Neural network training failure
        training_error = Exception("Neural network completely failed")
        nn_context = {
            'operation': 'train_on_failure',
            'death_data': recovered_data
        }
        
        nn_recovery = await error_recovery_manager.handle_neural_network_error(
            training_error, nn_context
        )
        assert nn_recovery['success'] == True
        
        # 3. WebSocket communication failure
        ws_error = Exception("WebSocket connection lost")
        ws_context = {'operation': 'send_message'}
        
        ws_recovery = await error_recovery_manager.handle_websocket_error(
            ws_error, ws_context
        )
        assert ws_recovery['success'] == True
        
        # Verify system can still function with multiple failures
        health_status = error_recovery_manager.get_system_health_status()
        assert health_status['error_statistics']['total_errors'] >= 3


if __name__ == '__main__':
    # Run the tests
    pytest.main([__file__, '-v'])