"""
Integration test for the complete Neural Network Training Pipeline
"""

import unittest
import asyncio
from unittest.mock import patch, MagicMock

from ai_engine.ai_engine import AIEngine
from ai_engine.data_models import QueenDeathData, DeathAnalysis


class TestTrainingIntegration(unittest.TestCase):
    """Integration test for the complete training pipeline"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.ai_engine = AIEngine()
        
        # Sample death data for testing
        self.sample_death_data = {
            'queenId': 'test-queen-1',
            'territoryId': 'territory-1',
            'generation': 3,
            'deathLocation': {'x': 100, 'y': 0, 'z': 150},
            'deathCause': 'protector_assault',
            'survivalTime': 180.0,
            'parasitesSpawned': 25,
            'hiveDiscoveryTime': 120.0,
            'playerUnits': {
                'protectors': [{'id': 'p1', 'position': {'x': 90, 'z': 140}}],
                'workers': [{'id': 'w1', 'position': {'x': 95, 'z': 145}}]
            },
            'assaultPattern': {
                'type': 'direct_assault',
                'coordination_level': 0.7,
                'force_concentration': 0.8
            },
            'gameState': {
                'energy_level': 750,
                'territory_control_percentage': 0.6,
                'active_mining': [{'location': {'x': 200, 'z': 200}}]
            },
            'timestamp': 1234567890.0
        }
    
    def test_complete_training_pipeline_integration(self):
        """Test the complete training pipeline from death data to strategy generation"""
        async def run_integration_test():
            # Initialize AI Engine
            await self.ai_engine.initialize()
            
            # Mock the components to avoid actual neural network training
            with patch.object(self.ai_engine.neural_network, 'train_on_failure') as mock_train:
                with patch.object(self.ai_engine.death_analyzer, 'analyze_death') as mock_analyze:
                    with patch.object(self.ai_engine.strategy_generator, 'generate_strategy') as mock_strategy:
                        
                        # Mock return values
                        mock_death_analysis = MagicMock(spec=DeathAnalysis)
                        mock_death_analysis.primary_cause = 'protector_assault'
                        mock_death_analysis.survival_improvement = 0.15
                        mock_death_analysis.failed_strategies = [1, 5, 10]
                        mock_death_analysis.game_state_features = [0.5] * 20
                        mock_death_analysis.feature_vector = [0.3] * 10
                        mock_death_analysis.temporal_insights = {'survival_time': 180.0}
                        mock_death_analysis.get_parasites_spawned.return_value = 25
                        mock_death_analysis.to_dict.return_value = {'primary_cause': 'protector_assault'}
                        
                        mock_analyze.return_value = mock_death_analysis
                        
                        mock_train.return_value = {
                            'success': True,
                            'training_time': 75.0,
                            'loss': 0.45,
                            'accuracy': 0.72,
                            'epochs_trained': 8,
                            'convergence_achieved': True,
                            'generation_complexity': 0.3,
                            'gpu_used': False
                        }
                        
                        mock_strategy_obj = MagicMock()
                        mock_strategy_obj.to_dict.return_value = {
                            'generation': 4,
                            'hive_placement': {'strategy_type': 'adaptive_placement'},
                            'parasite_spawning': {'strategy_type': 'adaptive_spawning'},
                            'defensive_coordination': {'strategy_type': 'coordinated_defense'},
                            'complexity_level': 0.3
                        }
                        mock_strategy.return_value = mock_strategy_obj
                        
                        # Mock player behavior
                        self.ai_engine.player_behavior.get_feature_vector = MagicMock(return_value=[0.4] * 15)
                        self.ai_engine.player_behavior.get_patterns = MagicMock()
                        self.ai_engine.player_behavior.get_summary = MagicMock(return_value={'player_type': 'aggressive'})
                        
                        # Process Queen death
                        result = await self.ai_engine.process_queen_death(self.sample_death_data)
                        
                        # Verify the result structure
                        self.assertEqual(result['type'], 'queen_strategy')
                        self.assertIn('data', result)
                        self.assertEqual(result['data']['queenId'], 'test-queen-1')
                        self.assertEqual(result['data']['generation'], 4)
                        self.assertIn('strategies', result['data'])
                        self.assertIn('learningInsights', result['data'])
                        
                        # Verify training was called with correct data
                        mock_train.assert_called_once()
                        training_data = mock_train.call_args[0][0]
                        
                        # Verify training data structure
                        self.assertIn('game_state_features', training_data)
                        self.assertIn('player_pattern_features', training_data)
                        self.assertIn('death_analysis_features', training_data)
                        self.assertIn('generation_features', training_data)
                        self.assertEqual(training_data['reward_signal'], -1.0)
                        self.assertEqual(training_data['generation'], 3)
                        
                        # Verify learning insights
                        insights = result['data']['learningInsights']
                        self.assertEqual(insights['deathCause'], 'protector_assault')
                        self.assertEqual(insights['survivalImprovement'], 0.15)
                        self.assertIn('trainingMetrics', insights)
                        self.assertTrue(insights['trainingMetrics']['success'])
                        
            # Cleanup
            await self.ai_engine.cleanup()
        
        asyncio.run(run_integration_test())
    
    def test_success_training_integration(self):
        """Test success training integration"""
        async def run_success_test():
            # Initialize AI Engine
            await self.ai_engine.initialize()
            
            success_data = {
                'generation': 5,
                'survival_time': 300.0,
                'effectiveness': 0.85,
                'successful_strategies': [2, 7, 12],
                'game_state': {
                    'energy_level': 900,
                    'territory_control_percentage': 0.8
                }
            }
            
            # Mock components
            with patch.object(self.ai_engine.neural_network, 'train_on_success') as mock_train:
                mock_train.return_value = {
                    'success': True,
                    'training_time': 45.0,
                    'training_type': 'success_reinforcement',
                    'convergence_achieved': True
                }
                
                self.ai_engine.player_behavior.get_patterns = MagicMock()
                self.ai_engine.player_behavior.get_patterns.return_value.to_dict.return_value = {}
                
                # Process success
                result = await self.ai_engine.process_queen_success(success_data)
                
                # Verify result
                self.assertEqual(result['type'], 'success_training_result')
                self.assertEqual(result['data']['generation'], 5)
                self.assertEqual(result['data']['reinforcement_type'], 'positive')
                self.assertTrue(result['data']['training_metrics']['success'])
                
                # Verify training was called
                mock_train.assert_called_once()
                training_data = mock_train.call_args[0][0]
                self.assertEqual(training_data['reward_signal'], 1.0)
                self.assertEqual(training_data['generation'], 5)
            
            # Cleanup
            await self.ai_engine.cleanup()
        
        asyncio.run(run_success_test())
    
    def test_generation_complexity_scaling_integration(self):
        """Test that generation complexity scaling works throughout the pipeline"""
        async def run_complexity_test():
            # Initialize AI Engine
            await self.ai_engine.initialize()
            
            # Test different generations
            test_generations = [1, 5, 10, 15, 20]
            
            for generation in test_generations:
                test_data = self.sample_death_data.copy()
                test_data['generation'] = generation
                
                with patch.object(self.ai_engine.neural_network, 'train_on_failure') as mock_train:
                    with patch.object(self.ai_engine.death_analyzer, 'analyze_death') as mock_analyze:
                        with patch.object(self.ai_engine.strategy_generator, 'generate_strategy') as mock_strategy:
                            
                            # Mock minimal required returns
                            mock_death_analysis = MagicMock()
                            mock_death_analysis.game_state_features = [0.5] * 20
                            mock_death_analysis.feature_vector = [0.3] * 10
                            mock_death_analysis.failed_strategies = []
                            mock_death_analysis.survival_improvement = 0.1
                            mock_death_analysis.temporal_insights = {'survival_time': 150.0}
                            mock_death_analysis.get_parasites_spawned.return_value = 20
                            mock_death_analysis.to_dict.return_value = {}
                            mock_analyze.return_value = mock_death_analysis
                            
                            mock_train.return_value = {'success': True, 'generation_complexity': 0.0}
                            
                            mock_strategy_obj = MagicMock()
                            mock_strategy_obj.to_dict.return_value = {'generation': generation + 1}
                            mock_strategy.return_value = mock_strategy_obj
                            
                            self.ai_engine.player_behavior.get_feature_vector = MagicMock(return_value=[0.4] * 15)
                            self.ai_engine.player_behavior.get_patterns = MagicMock()
                            self.ai_engine.player_behavior.get_summary = MagicMock(return_value={})
                            
                            # Process death
                            await self.ai_engine.process_queen_death(test_data)
                            
                            # Verify training was called with generation context
                            training_data = mock_train.call_args[0][0]
                            self.assertEqual(training_data['generation'], generation)
                            self.assertIn('generation_features', training_data)
                            
                            # Verify generation features are properly encoded
                            gen_features = training_data['generation_features']
                            self.assertEqual(len(gen_features), 5)
                            self.assertEqual(gen_features[0], generation / 20.0)  # Normalized generation
            
            # Cleanup
            await self.ai_engine.cleanup()
        
        asyncio.run(run_complexity_test())


if __name__ == '__main__':
    unittest.main()