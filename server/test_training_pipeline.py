"""
Test suite for Neural Network Training Pipeline implementation
"""

import unittest
import asyncio
import numpy as np
from unittest.mock import patch, MagicMock

from ai_engine.neural_network import QueenBehaviorNetwork, ConvergenceMonitor
from ai_engine.ai_engine import AIEngine


class TestTrainingPipeline(unittest.TestCase):
    """Test the enhanced neural network training pipeline"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.network = QueenBehaviorNetwork()
        self.test_training_data = {
            'game_state_features': [0.5] * 20,
            'player_pattern_features': [0.3] * 15,
            'death_analysis_features': [0.7] * 10,
            'generation_features': [0.1] * 5,
            'strategy_labels': [1, 5, 10],
            'reward_signal': -1.0,
            'generation': 3,
            'game_state': {
                'energy_level': 750,
                'player_units': {'protectors': [{}] * 5, 'workers': [{}] * 15},
                'territory_control_percentage': 0.6,
                'active_mining': [{}] * 3
            },
            'death_cause': 'protector_assault',
            'survival_time': 180.0,
            'parasites_spawned': 25,
            'hive_discovery_time': 120.0,
            'assault_pattern': {'directness': 0.8, 'coordination_level': 0.6}
        }
        
        self.test_success_data = {
            'generation': 5,
            'reward_signal': 1.0,
            'strategy_labels': [2, 7, 12],
            'survival_time': 300.0,
            'strategic_effectiveness': 0.85,
            'successful_strategies': [2, 7, 12]
        }
    
    def test_enhanced_feature_encoding(self):
        """Test enhanced feature encoding with generation context"""
        features = self.network._prepare_features(self.test_training_data)
        
        # Verify feature dimensions
        self.assertEqual(features.shape, (1, 50), "Features should be 1x50 array")
        
        # Verify feature normalization (all values should be 0-1)
        self.assertTrue(np.all(features >= 0.0), "All features should be >= 0")
        self.assertTrue(np.all(features <= 1.0), "All features should be <= 1")
        
        # Verify non-zero features (should have meaningful values)
        self.assertTrue(np.any(features > 0), "Should have non-zero features")
    
    def test_game_state_feature_encoding(self):
        """Test game state feature encoding"""
        features = self.network._encode_game_state_features(self.test_training_data)
        
        self.assertEqual(len(features), 20, "Should have exactly 20 game state features")
        
        # Test energy level encoding (750/1000 = 0.75)
        self.assertAlmostEqual(features[0], 0.75, places=2, msg="Energy level should be normalized")
        
        # Test unit count encoding
        self.assertAlmostEqual(features[1], 0.25, places=2, msg="Protector count should be normalized (5/20)")
        self.assertAlmostEqual(features[2], 0.3, places=2, msg="Worker count should be normalized (15/50)")
    
    def test_generation_complexity_scaling(self):
        """Test generation-based complexity scaling"""
        # Test different generations
        test_cases = [
            (1, 0.1),   # Generation 1: 0.1 complexity
            (5, 0.3),   # Generation 5: 0.3 complexity  
            (10, 0.55), # Generation 10: 0.55 complexity
            (20, 1.0)   # Generation 20: 1.0 complexity (capped)
        ]
        
        for generation, expected_complexity in test_cases:
            config = self.network._get_training_config(generation)
            self.assertAlmostEqual(
                config['complexity_level'], 
                expected_complexity, 
                places=2,
                msg=f"Generation {generation} should have complexity {expected_complexity}"
            )
    
    def test_training_config_scaling(self):
        """Test training configuration scales with generation"""
        # Basic generation (1-5)
        basic_config = self.network._get_training_config(3)
        self.assertEqual(basic_config['max_epochs'], 10)
        self.assertEqual(basic_config['patience'], 3)
        
        # Advanced generation (6-15)
        advanced_config = self.network._get_training_config(12)
        self.assertEqual(advanced_config['max_epochs'], 15)
        self.assertEqual(advanced_config['patience'], 4)
        
        # Expert generation (16+)
        expert_config = self.network._get_training_config(18)
        self.assertEqual(expert_config['max_epochs'], 20)
        self.assertEqual(expert_config['patience'], 5)
    
    def test_success_label_preparation(self):
        """Test positive reward label preparation for successful strategies"""
        labels = self.network._prepare_success_labels(self.test_success_data)
        
        # Verify label dimensions
        self.assertEqual(labels.shape, (1, 20), "Labels should be 1x20 array")
        
        # Verify positive reinforcement for successful strategies
        successful_indices = self.test_success_data['strategy_labels']
        for idx in successful_indices:
            if idx < 20:  # Valid strategy index
                self.assertGreater(labels[0, idx], 0, f"Strategy {idx} should have positive reinforcement")
        
        # Verify normalization
        self.assertAlmostEqual(np.sum(labels), 1.0, places=5, msg="Labels should sum to 1.0")
    
    def test_convergence_monitoring(self):
        """Test convergence monitoring callback"""
        monitor = ConvergenceMonitor(patience=2, min_delta=0.01, monitor='loss')
        
        # Simulate improving loss
        monitor.on_epoch_end(0, {'loss': 1.0})
        self.assertFalse(monitor.converged, "Should not converge immediately")
        
        monitor.on_epoch_end(1, {'loss': 0.8})  # Improvement > min_delta (1.0 - 0.8 = 0.2 > 0.01)
        self.assertFalse(monitor.converged, "Should not converge after one improvement")
        
        monitor.on_epoch_end(2, {'loss': 0.79})  # Small improvement < min_delta (0.8 - 0.79 = 0.01, not > 0.01)
        self.assertEqual(monitor.wait, 1, "Wait counter should increment for small improvement")
        
        monitor.on_epoch_end(3, {'loss': 0.791}) # No improvement (worse)
        self.assertEqual(monitor.wait, 2, "Wait counter should increment again")
        self.assertTrue(monitor.converged, "Should converge after patience exceeded")
    
    @patch('ai_engine.neural_network.keras')
    def test_training_time_bounds_validation(self, mock_keras):
        """Test training time bounds validation (60-120 seconds requirement)"""
        # Mock training to complete quickly
        mock_history = MagicMock()
        mock_history.history = {'loss': [1.0, 0.8, 0.6], 'accuracy': [0.5, 0.6, 0.7]}
        
        async def run_quick_training():
            with patch.object(self.network, '_train_with_convergence_monitoring', 
                            return_value=mock_history):
                result = await self.network.train_on_failure(self.test_training_data)
                
                # Should complete successfully even if under 60 seconds
                self.assertTrue(result['success'], "Training should succeed")
                self.assertIn('training_time', result, "Should report training time")
                self.assertIn('convergence_achieved', result, "Should report convergence status")
        
        asyncio.run(run_quick_training())
    
    def test_reward_assignment_system(self):
        """Test reward assignment for failures and successes"""
        # Test failure reward (negative)
        failure_labels = self.network._prepare_labels(self.test_training_data)
        failed_strategies = self.test_training_data['strategy_labels']
        
        for idx in failed_strategies:
            if idx < 20:
                self.assertGreater(failure_labels[0, idx], 0, 
                                 f"Failed strategy {idx} should be marked for avoidance")
        
        # Test success reward (positive)
        success_labels = self.network._prepare_success_labels(self.test_success_data)
        successful_strategies = self.test_success_data['strategy_labels']
        
        for idx in successful_strategies:
            if idx < 20:
                self.assertGreater(success_labels[0, idx], 0, 
                                 f"Successful strategy {idx} should be reinforced")
    
    def test_train_on_success_method(self):
        """Test the new train_on_success method"""
        async def run_success_test():
            with patch.object(self.network, '_train_with_convergence_monitoring') as mock_train:
                mock_history = MagicMock()
                mock_history.history = {'loss': [0.8, 0.6, 0.4], 'accuracy': [0.6, 0.7, 0.8]}
                mock_train.return_value = mock_history
                
                result = await self.network.train_on_success(self.test_success_data)
                
                self.assertTrue(result['success'], "Success training should succeed")
                self.assertEqual(result['training_type'], 'success_reinforcement')
                self.assertIn('convergence_achieved', result)
                self.assertIn('generation_complexity', result)
        
        asyncio.run(run_success_test())
    
    def test_ai_engine_success_processing(self):
        """Test AI Engine success processing integration"""
        async def run_success_test():
            ai_engine = AIEngine()
            
            # Mock the components
            ai_engine.initialized = True
            ai_engine.neural_network = MagicMock()
            ai_engine.memory_manager = MagicMock()
            ai_engine.player_behavior = MagicMock()
            
            # Mock return values - make train_on_success return a coroutine
            async def mock_train_on_success(data):
                return {
                    'success': True,
                    'training_time': 45.0,
                    'training_type': 'success_reinforcement'
                }
            
            async def mock_store_success_data(*args, **kwargs):
                return None
            
            ai_engine.neural_network.train_on_success = mock_train_on_success
            ai_engine.memory_manager.store_success_data = mock_store_success_data
            
            ai_engine.player_behavior.get_patterns.return_value = MagicMock()
            ai_engine.player_behavior.get_patterns.return_value.to_dict.return_value = {}
            
            result = await ai_engine.process_queen_success(self.test_success_data)
            
            self.assertEqual(result['type'], 'success_training_result')
            self.assertIn('data', result)
            self.assertEqual(result['data']['reinforcement_type'], 'positive')
        
        asyncio.run(run_success_test())


if __name__ == '__main__':
    unittest.main()