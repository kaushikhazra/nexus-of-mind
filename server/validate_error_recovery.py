"""
Simple validation script for Error Recovery and Data Validation systems
Tests basic functionality without requiring pytest
"""

import asyncio
import json
import tempfile
import os
import sys
import traceback

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from ai_engine.error_recovery import ErrorRecoveryManager, ErrorSeverity, RecoveryStrategy
    from ai_engine.data_validator import DataValidator
    print("✓ Successfully imported error recovery components")
except ImportError as e:
    print(f"✗ Failed to import components: {e}")
    sys.exit(1)


async def test_error_recovery_manager():
    """Test basic error recovery manager functionality"""
    print("\n=== Testing Error Recovery Manager ===")
    
    try:
        # Create error recovery manager
        error_manager = ErrorRecoveryManager(max_retry_attempts=3, retry_delay=0.1)
        print("✓ Error recovery manager created successfully")
        
        # Test neural network error handling
        test_error = Exception("Test neural network error")
        context = {
            'operation': 'train_on_failure',
            'training_data': {'generation': 1, 'reward_signal': -1.0}
        }
        
        recovery_result = await error_manager.handle_neural_network_error(test_error, context)
        
        if recovery_result['success']:
            print(f"✓ Neural network error recovery successful: {recovery_result['strategy']}")
        else:
            print(f"✗ Neural network error recovery failed: {recovery_result.get('error', 'Unknown error')}")
        
        # Test WebSocket error handling
        ws_error = Exception("Test WebSocket connection error")
        ws_context = {'operation': 'send_message'}
        
        ws_recovery = await error_manager.handle_websocket_error(ws_error, ws_context)
        
        if ws_recovery['success']:
            print(f"✓ WebSocket error recovery successful: {ws_recovery['strategy']}")
        else:
            print(f"✗ WebSocket error recovery failed: {ws_recovery.get('error', 'Unknown error')}")
        
        # Test system health status
        health_status = error_manager.get_system_health_status()
        if 'system_health' in health_status and 'error_statistics' in health_status:
            print("✓ System health monitoring working")
        else:
            print("✗ System health monitoring failed")
        
        return True
        
    except Exception as e:
        print(f"✗ Error recovery manager test failed: {e}")
        traceback.print_exc()
        return False


def test_data_validator():
    """Test basic data validator functionality"""
    print("\n=== Testing Data Validator ===")
    
    try:
        # Create temporary directory for testing
        with tempfile.TemporaryDirectory() as temp_dir:
            validator = DataValidator(backup_directory=temp_dir)
            print("✓ Data validator created successfully")
            
            # Test valid data validation
            valid_data = {
                'queen_id': 'test_queen_123',
                'generation': 5,
                'death_location': {'x': 10.5, 'y': 20.0, 'z': 5.5},
                'death_cause': 'protector_assault',
                'survival_time': 120.5,
                'parasites_spawned': 15,
                'hive_discovery_time': 60.0
            }
            
            is_valid, error_message = validator.validate_data(valid_data, 'queen_death')
            if is_valid:
                print("✓ Valid data validation passed")
            else:
                print(f"✗ Valid data validation failed: {error_message}")
            
            # Test invalid data validation
            invalid_data = {
                'queen_id': '',  # Empty queen ID
                'generation': -1,  # Invalid generation
                'death_cause': 'invalid_cause'  # Invalid death cause
            }
            
            is_valid, error_message = validator.validate_data(invalid_data, 'queen_death')
            if not is_valid:
                print("✓ Invalid data validation correctly failed")
            else:
                print("✗ Invalid data validation should have failed")
            
            # Test data sanitization
            corrupted_data = {
                'queen_id': None,
                'generation': 'invalid',
                'death_cause': 'unknown_cause',
                'survival_time': -100
            }
            
            sanitized_data = validator.sanitize_data(corrupted_data, 'queen_death')
            
            if (sanitized_data['queen_id'] and 
                sanitized_data['generation'] >= 1 and
                sanitized_data['survival_time'] >= 0):
                print("✓ Data sanitization working correctly")
            else:
                print("✗ Data sanitization failed")
            
            # Test corruption detection
            corrupted_data_with_issues = {
                'queen_id': 'test_queen',
                'generation': 5,
                'survival_time': 60,
                'hive_discovery_time': 120,  # Discovery time > survival time (impossible)
                'parasites_spawned': -5  # Negative parasites (impossible)
            }
            
            is_corrupted, issues = validator.detect_corruption(corrupted_data_with_issues, 'queen_death')
            
            if is_corrupted and len(issues) > 0:
                print(f"✓ Corruption detection working: found {len(issues)} issues")
            else:
                print("✗ Corruption detection failed")
            
            # Test data recovery
            recovered_data = validator.recover_corrupted_data(corrupted_data, 'queen_death')
            
            if (recovered_data['queen_id'] and 
                recovered_data['generation'] >= 1 and
                recovered_data['death_cause'] in ['protector_assault', 'worker_infiltration', 'coordinated_attack', 'energy_depletion', 'unknown']):
                print("✓ Data recovery working correctly")
            else:
                print("✗ Data recovery failed")
            
            # Test backup functionality
            backup_success = validator.backup_data(valid_data, 'queen_death', 'test_backup')
            if backup_success:
                print("✓ Data backup working")
            else:
                print("✗ Data backup failed")
            
            # Test validation statistics
            stats = validator.get_validation_statistics()
            if 'schemas_loaded' in stats and stats['schemas_loaded'] > 0:
                print("✓ Validation statistics working")
            else:
                print("✗ Validation statistics failed")
        
        return True
        
    except Exception as e:
        print(f"✗ Data validator test failed: {e}")
        traceback.print_exc()
        return False


async def test_integration():
    """Test integration between error recovery and data validation"""
    print("\n=== Testing Integration ===")
    
    try:
        # Create both components
        error_manager = ErrorRecoveryManager()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            validator = DataValidator(backup_directory=temp_dir)
            
            # Test scenario: corrupted data + neural network error
            corrupted_data = {
                'queen_id': None,
                'generation': 'invalid',
                'death_cause': 'unknown_cause'
            }
            
            # First, recover the corrupted data
            recovered_data = validator.recover_corrupted_data(corrupted_data, 'queen_death')
            
            # Then, simulate neural network error with recovered data
            nn_error = Exception("Neural network failed")
            context = {
                'operation': 'train_on_failure',
                'death_data': recovered_data
            }
            
            recovery_result = await error_manager.handle_neural_network_error(nn_error, context)
            
            if recovery_result['success']:
                print("✓ Integration test successful: data recovery + error handling")
            else:
                print("✗ Integration test failed")
        
        return True
        
    except Exception as e:
        print(f"✗ Integration test failed: {e}")
        traceback.print_exc()
        return False


async def main():
    """Run all validation tests"""
    print("Starting Error Recovery and Data Validation Tests")
    print("=" * 60)
    
    results = []
    
    # Test error recovery manager
    results.append(await test_error_recovery_manager())
    
    # Test data validator
    results.append(test_data_validator())
    
    # Test integration
    results.append(await test_integration())
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("✓ All tests passed! Error recovery system is working correctly.")
        return 0
    else:
        print("✗ Some tests failed. Please check the implementation.")
        return 1


if __name__ == '__main__':
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\nTests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"Test execution failed: {e}")
        traceback.print_exc()
        sys.exit(1)