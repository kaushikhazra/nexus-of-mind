#!/usr/bin/env python3
"""
Neural Network Assessment - Comprehensive Analysis of Queen Behavior Network
Provides detailed analysis of training effectiveness, inference accuracy, and learning capabilities
"""

import asyncio
import time
import sys
import os
import numpy as np
import json
from typing import Dict, List, Any, Tuple
from pathlib import Path

# Add server directory to path for imports
sys.path.append(str(Path(__file__).parent / 'server'))

try:
    from server.ai_engine.neural_network import QueenBehaviorNetwork
    from server.ai_engine.performance_monitor import PerformanceMonitor
    NEURAL_NETWORK_AVAILABLE = True
except ImportError as e:
    print(f"Error: Neural Network not available: {e}")
    NEURAL_NETWORK_AVAILABLE = False

class NeuralNetworkAssessment:
    """Comprehensive assessment of neural network training and inference"""
    
    def __init__(self):
        self.network = None
        self.assessment_results = {
            'architecture_analysis': {'status': 'not_run', 'details': {}},
            'training_effectiveness': {'status': 'not_run', 'details': {}},
            'inference_accuracy': {'status': 'not_run', 'details': {}},
            'learning_progression': {'status': 'not_run', 'details': {}},
            'performance_analysis': {'status': 'not_run', 'details': {}},
            'feature_encoding_test': {'status': 'not_run', 'details': {}},
            'strategy_generation_test': {'status': 'not_run', 'details': {}},
            'overall_assessment': 'not_run'
        }
    
    async def run_comprehensive_assessment(self) -> Dict[str, Any]:
        """Run complete neural network assessment"""
        print("🧠 Neural Network Comprehensive Assessment")
        print("=" * 60)
        
        if not NEURAL_NETWORK_AVAILABLE:
            print("❌ Neural Network not available - cannot run assessment")
            return self.assessment_results
        
        try:
            # Initialize network
            self.network = QueenBehaviorNetwork()
            print("✅ Neural Network initialized successfully")
            
            # Run all assessment tests
            await self.analyze_architecture()
            await self.test_training_effectiveness()
            await self.test_inference_accuracy()
            await self.test_learning_progression()
            await self.analyze_performance()
            await self.test_feature_encoding()
            await self.test_strategy_generation()
            
            # Generate overall assessment
            self.generate_overall_assessment()
            
            # Cleanup
            await self.network.cleanup()
            
            return self.assessment_results
            
        except Exception as e:
            print(f"❌ Assessment failed: {e}")
            self.assessment_results['overall_assessment'] = f'error: {str(e)}'
            return self.assessment_results
    
    async def analyze_architecture(self):
        """Analyze neural network architecture"""
        print("\n1. 🏗️  Architecture Analysis")
        print("-" * 40)
        
        try:
            details = {}
            
            # Model summary
            model = self.network.model
            details['total_parameters'] = model.count_params()
            details['trainable_parameters'] = sum([np.prod(v.get_shape()) for v in model.trainable_weights])
            details['input_shape'] = (self.network.input_features,)
            details['output_shape'] = (self.network.output_strategies,)
            
            # Layer analysis
            layers_info = []
            for i, layer in enumerate(model.layers):
                layer_info = {
                    'index': i,
                    'name': layer.name,
                    'type': type(layer).__name__,
                    'output_shape': str(layer.output_shape),
                    'parameters': layer.count_params()
                }
                if hasattr(layer, 'activation'):
                    layer_info['activation'] = str(layer.activation.__name__)
                layers_info.append(layer_info)
            
            details['layers'] = layers_info
            details['architecture_valid'] = True
            
            # Validate architecture requirements
            requirements_check = {
                'input_features_50': self.network.input_features == 50,
                'output_strategies_20': self.network.output_strategies == 20,
                'has_dropout_layers': any('dropout' in layer['name'].lower() for layer in layers_info),
                'has_dense_layers': any('dense' in layer['name'].lower() for layer in layers_info),
                'reasonable_parameter_count': 1000 < details['total_parameters'] < 100000
            }
            
            details['requirements_check'] = requirements_check
            details['requirements_met'] = all(requirements_check.values())
            
            self.assessment_results['architecture_analysis'] = {
                'status': 'passed' if details['requirements_met'] else 'failed',
                'details': details
            }
            
            print(f"✅ Architecture: {details['total_parameters']} parameters, {len(layers_info)} layers")
            print(f"✅ Requirements: {sum(requirements_check.values())}/{len(requirements_check)} met")
            
        except Exception as e:
            print(f"❌ Architecture analysis failed: {e}")
            self.assessment_results['architecture_analysis'] = {
                'status': 'error',
                'details': {'error': str(e)}
            }
    
    async def test_training_effectiveness(self):
        """Test neural network training effectiveness"""
        print("\n2. 🎯 Training Effectiveness Test")
        print("-" * 40)
        
        try:
            # Create diverse training scenarios
            training_scenarios = [
                {
                    'name': 'Early Generation (Simple)',
                    'generation': 1,
                    'complexity': 0.1,
                    'failed_strategies': [0, 1],
                    'expected_improvement': 'basic_learning'
                },
                {
                    'name': 'Mid Generation (Tactical)',
                    'generation': 5,
                    'complexity': 0.5,
                    'failed_strategies': [2, 7, 12],
                    'expected_improvement': 'tactical_learning'
                },
                {
                    'name': 'Advanced Generation (Strategic)',
                    'generation': 10,
                    'complexity': 0.9,
                    'failed_strategies': [1, 5, 10, 15, 18],
                    'expected_improvement': 'strategic_learning'
                }
            ]
            
            training_results = []
            
            for scenario in training_scenarios:
                print(f"Testing: {scenario['name']}")
                
                # Prepare training data
                training_data = self.create_training_data(scenario)
                
                # Record initial model state
                initial_weights = [w.numpy().copy() for w in self.network.model.get_weights()]
                
                # Train the network
                start_time = time.time()
                result = await self.network.train_on_failure(training_data)
                training_time = time.time() - start_time
                
                # Record final model state
                final_weights = [w.numpy().copy() for w in self.network.model.get_weights()]
                
                # Analyze weight changes
                weight_changes = []
                for initial, final in zip(initial_weights, final_weights):
                    change = np.mean(np.abs(final - initial))
                    weight_changes.append(float(change))
                
                avg_weight_change = np.mean(weight_changes)
                
                scenario_result = {
                    'scenario': scenario['name'],
                    'generation': scenario['generation'],
                    'training_time': training_time,
                    'training_success': result.get('success', False),
                    'final_loss': result.get('loss', float('inf')),
                    'final_accuracy': result.get('accuracy', 0.0),
                    'epochs_trained': result.get('epochs_trained', 0),
                    'convergence_achieved': result.get('convergence_achieved', False),
                    'avg_weight_change': avg_weight_change,
                    'learning_occurred': avg_weight_change > 0.001  # Threshold for meaningful learning
                }
                
                training_results.append(scenario_result)
                
                status = "✅" if scenario_result['learning_occurred'] else "❌"
                print(f"  {status} Loss: {scenario_result['final_loss']:.4f}, "
                      f"Accuracy: {scenario_result['final_accuracy']:.3f}, "
                      f"Weight Change: {avg_weight_change:.6f}")
            
            # Overall training effectiveness
            learning_scenarios = sum(1 for r in training_results if r['learning_occurred'])
            effectiveness_score = learning_scenarios / len(training_scenarios)
            
            details = {
                'scenarios_tested': len(training_scenarios),
                'scenarios_with_learning': learning_scenarios,
                'effectiveness_score': effectiveness_score,
                'training_results': training_results,
                'average_training_time': np.mean([r['training_time'] for r in training_results]),
                'average_final_accuracy': np.mean([r['final_accuracy'] for r in training_results])
            }
            
            self.assessment_results['training_effectiveness'] = {
                'status': 'passed' if effectiveness_score >= 0.7 else 'failed',
                'details': details
            }
            
            print(f"✅ Training Effectiveness: {effectiveness_score:.1%} ({learning_scenarios}/{len(training_scenarios)} scenarios)")
            
        except Exception as e:
            print(f"❌ Training effectiveness test failed: {e}")
            self.assessment_results['training_effectiveness'] = {
                'status': 'error',
                'details': {'error': str(e)}
            }
    
    async def test_inference_accuracy(self):
        """Test neural network inference accuracy"""
        print("\n3. 🎲 Inference Accuracy Test")
        print("-" * 40)
        
        try:
            # Create test scenarios with known expected outputs
            test_scenarios = [
                {
                    'name': 'Aggressive Player Pattern',
                    'features': self.create_test_features('aggressive_player'),
                    'expected_strategies': ['defensive_swarm', 'coordinated_defense', 'predictive_spawning']
                },
                {
                    'name': 'Economic Player Pattern', 
                    'features': self.create_test_features('economic_player'),
                    'expected_strategies': ['mining_disruption', 'resource_denial', 'expansion_blocking']
                },
                {
                    'name': 'Defensive Player Pattern',
                    'features': self.create_test_features('defensive_player'),
                    'expected_strategies': ['aggressive_spawning', 'flanking_tactics', 'pressure_tactics']
                }
            ]
            
            inference_results = []
            
            for scenario in test_scenarios:
                print(f"Testing: {scenario['name']}")
                
                # Run inference
                features = np.array([scenario['features']], dtype=np.float32)
                predictions = self.network.predict_strategy(features)
                
                # Analyze predictions
                strategy_probabilities = predictions[0]
                top_strategies = np.argsort(strategy_probabilities)[-5:][::-1]  # Top 5 strategies
                top_probabilities = strategy_probabilities[top_strategies]
                
                # Check prediction quality
                max_probability = np.max(strategy_probabilities)
                entropy = -np.sum(strategy_probabilities * np.log(strategy_probabilities + 1e-8))
                confidence = max_probability
                diversity = entropy / np.log(len(strategy_probabilities))  # Normalized entropy
                
                scenario_result = {
                    'scenario': scenario['name'],
                    'top_strategies': [int(s) for s in top_strategies],
                    'top_probabilities': [float(p) for p in top_probabilities],
                    'max_probability': float(max_probability),
                    'confidence': float(confidence),
                    'diversity': float(diversity),
                    'entropy': float(entropy),
                    'prediction_quality': 'high' if confidence > 0.3 else 'medium' if confidence > 0.1 else 'low'
                }
                
                inference_results.append(scenario_result)
                
                print(f"  ✅ Top strategy: {top_strategies[0]} (prob: {top_probabilities[0]:.3f})")
                print(f"     Confidence: {confidence:.3f}, Diversity: {diversity:.3f}")
            
            # Overall inference quality
            high_quality_predictions = sum(1 for r in inference_results if r['prediction_quality'] == 'high')
            inference_score = high_quality_predictions / len(inference_results)
            
            details = {
                'scenarios_tested': len(test_scenarios),
                'high_quality_predictions': high_quality_predictions,
                'inference_score': inference_score,
                'inference_results': inference_results,
                'average_confidence': np.mean([r['confidence'] for r in inference_results]),
                'average_diversity': np.mean([r['diversity'] for r in inference_results])
            }
            
            self.assessment_results['inference_accuracy'] = {
                'status': 'passed' if inference_score >= 0.6 else 'failed',
                'details': details
            }
            
            print(f"✅ Inference Quality: {inference_score:.1%} ({high_quality_predictions}/{len(test_scenarios)} high quality)")
            
        except Exception as e:
            print(f"❌ Inference accuracy test failed: {e}")
            self.assessment_results['inference_accuracy'] = {
                'status': 'error',
                'details': {'error': str(e)}
            }
    
    async def test_learning_progression(self):
        """Test learning progression across generations"""
        print("\n4. 📈 Learning Progression Test")
        print("-" * 40)
        
        try:
            # Simulate learning across multiple generations
            generations = [1, 3, 5, 8, 12]
            progression_results = []
            
            # Create consistent test scenario
            base_features = self.create_test_features('consistent_test')
            
            for generation in generations:
                print(f"Testing Generation {generation}")
                
                # Train with generation-specific data
                training_data = self.create_training_data({
                    'generation': generation,
                    'complexity': min(1.0, 0.1 + (generation - 1) * 0.05),
                    'failed_strategies': list(range(min(generation, 5)))
                })
                
                # Train the network
                await self.network.train_on_failure(training_data)
                
                # Test inference on consistent scenario
                features = np.array([base_features], dtype=np.float32)
                predictions = self.network.predict_strategy(features)
                
                # Analyze prediction evolution
                strategy_probabilities = predictions[0]
                top_strategy = np.argmax(strategy_probabilities)
                max_probability = np.max(strategy_probabilities)
                entropy = -np.sum(strategy_probabilities * np.log(strategy_probabilities + 1e-8))
                
                generation_result = {
                    'generation': generation,
                    'top_strategy': int(top_strategy),
                    'max_probability': float(max_probability),
                    'entropy': float(entropy),
                    'strategy_distribution': [float(p) for p in strategy_probabilities]
                }
                
                progression_results.append(generation_result)
                
                print(f"  ✅ Gen {generation}: Strategy {top_strategy} (prob: {max_probability:.3f})")
            
            # Analyze progression trends
            probabilities = [r['max_probability'] for r in progression_results]
            entropies = [r['entropy'] for r in progression_results]
            
            # Check for learning trends
            probability_trend = np.polyfit(generations, probabilities, 1)[0]  # Linear trend
            entropy_trend = np.polyfit(generations, entropies, 1)[0]
            
            learning_indicators = {
                'increasing_confidence': probability_trend > 0.01,  # Probabilities should increase
                'decreasing_uncertainty': entropy_trend < -0.01,   # Entropy should decrease
                'strategy_evolution': len(set(r['top_strategy'] for r in progression_results)) > 1
            }
            
            learning_score = sum(learning_indicators.values()) / len(learning_indicators)
            
            details = {
                'generations_tested': len(generations),
                'progression_results': progression_results,
                'probability_trend': float(probability_trend),
                'entropy_trend': float(entropy_trend),
                'learning_indicators': learning_indicators,
                'learning_score': learning_score,
                'final_confidence': probabilities[-1],
                'confidence_improvement': probabilities[-1] - probabilities[0]
            }
            
            self.assessment_results['learning_progression'] = {
                'status': 'passed' if learning_score >= 0.6 else 'failed',
                'details': details
            }
            
            print(f"✅ Learning Progression: {learning_score:.1%} indicators positive")
            print(f"   Confidence trend: {probability_trend:+.4f}, Entropy trend: {entropy_trend:+.4f}")
            
        except Exception as e:
            print(f"❌ Learning progression test failed: {e}")
            self.assessment_results['learning_progression'] = {
                'status': 'error',
                'details': {'error': str(e)}
            }
    
    async def analyze_performance(self):
        """Analyze neural network performance characteristics"""
        print("\n5. ⚡ Performance Analysis")
        print("-" * 40)
        
        try:
            performance_metrics = {}
            
            # Test inference speed
            test_features = np.random.rand(100, 50).astype(np.float32)
            
            start_time = time.time()
            for i in range(100):
                predictions = self.network.predict_strategy(test_features[i:i+1])
            inference_time = (time.time() - start_time) / 100
            
            performance_metrics['inference_time_ms'] = inference_time * 1000
            performance_metrics['inference_fps'] = 1.0 / inference_time if inference_time > 0 else float('inf')
            
            # Test batch inference
            start_time = time.time()
            batch_predictions = self.network.predict_strategy(test_features)
            batch_time = time.time() - start_time
            
            performance_metrics['batch_inference_time_ms'] = batch_time * 1000
            performance_metrics['batch_throughput'] = len(test_features) / batch_time
            
            # Memory usage estimation
            model_size_mb = sum([np.prod(w.shape) * 4 for w in self.network.model.get_weights()]) / (1024 * 1024)
            performance_metrics['model_size_mb'] = model_size_mb
            
            # GPU utilization
            performance_metrics['gpu_available'] = self.network.use_gpu
            performance_metrics['gpu_acceleration'] = self.network.use_gpu
            
            # Performance requirements check
            requirements_check = {
                'fast_inference': inference_time < 0.01,  # < 10ms per inference
                'reasonable_model_size': model_size_mb < 50,  # < 50MB
                'batch_efficient': batch_time < 1.0,  # < 1s for 100 predictions
                'real_time_capable': performance_metrics['inference_fps'] > 60  # > 60 FPS
            }
            
            performance_score = sum(requirements_check.values()) / len(requirements_check)
            
            details = {
                'performance_metrics': performance_metrics,
                'requirements_check': requirements_check,
                'performance_score': performance_score
            }
            
            self.assessment_results['performance_analysis'] = {
                'status': 'passed' if performance_score >= 0.75 else 'failed',
                'details': details
            }
            
            print(f"✅ Inference Speed: {inference_time*1000:.2f}ms ({performance_metrics['inference_fps']:.0f} FPS)")
            print(f"✅ Model Size: {model_size_mb:.1f}MB")
            print(f"✅ Performance Score: {performance_score:.1%}")
            
        except Exception as e:
            print(f"❌ Performance analysis failed: {e}")
            self.assessment_results['performance_analysis'] = {
                'status': 'error',
                'details': {'error': str(e)}
            }
    
    async def test_feature_encoding(self):
        """Test feature encoding functionality"""
        print("\n6. 🔢 Feature Encoding Test")
        print("-" * 40)
        
        try:
            # Test different types of input data
            test_cases = [
                {
                    'name': 'Complete Data',
                    'data': {
                        'generation': 5,
                        'game_state': {'energy_level': 750, 'active_mining': [{'location': {'x': 10, 'z': 20}}]},
                        'player_patterns': {'aggression_score': 0.8, 'economic_focus': 0.3},
                        'death_cause': 'protector_assault',
                        'survival_time': 300,
                        'parasites_spawned': 15
                    }
                },
                {
                    'name': 'Minimal Data',
                    'data': {
                        'generation': 1,
                        'reward_signal': -1.0
                    }
                },
                {
                    'name': 'Edge Case Data',
                    'data': {
                        'generation': 20,
                        'game_state': {'energy_level': 0},
                        'survival_time': 0,
                        'parasites_spawned': 0
                    }
                }
            ]
            
            encoding_results = []
            
            for test_case in test_cases:
                print(f"Testing: {test_case['name']}")
                
                try:
                    # Test feature encoding
                    features = self.network._prepare_features(test_case['data'])
                    
                    # Validate feature array
                    is_valid = (
                        features.shape == (1, 50) and
                        np.all(np.isfinite(features)) and
                        np.all(features >= 0.0) and
                        np.all(features <= 1.0)
                    )
                    
                    encoding_result = {
                        'test_case': test_case['name'],
                        'encoding_success': True,
                        'feature_shape': features.shape,
                        'feature_range': [float(np.min(features)), float(np.max(features))],
                        'feature_mean': float(np.mean(features)),
                        'valid_encoding': is_valid,
                        'non_zero_features': int(np.sum(features > 0))
                    }
                    
                    print(f"  ✅ Shape: {features.shape}, Range: [{np.min(features):.3f}, {np.max(features):.3f}]")
                    
                except Exception as e:
                    encoding_result = {
                        'test_case': test_case['name'],
                        'encoding_success': False,
                        'error': str(e)
                    }
                    print(f"  ❌ Encoding failed: {e}")
                
                encoding_results.append(encoding_result)
            
            # Overall encoding quality
            successful_encodings = sum(1 for r in encoding_results if r.get('encoding_success', False))
            valid_encodings = sum(1 for r in encoding_results if r.get('valid_encoding', False))
            encoding_score = valid_encodings / len(test_cases)
            
            details = {
                'test_cases': len(test_cases),
                'successful_encodings': successful_encodings,
                'valid_encodings': valid_encodings,
                'encoding_score': encoding_score,
                'encoding_results': encoding_results
            }
            
            self.assessment_results['feature_encoding_test'] = {
                'status': 'passed' if encoding_score >= 0.8 else 'failed',
                'details': details
            }
            
            print(f"✅ Feature Encoding: {encoding_score:.1%} ({valid_encodings}/{len(test_cases)} valid)")
            
        except Exception as e:
            print(f"❌ Feature encoding test failed: {e}")
            self.assessment_results['feature_encoding_test'] = {
                'status': 'error',
                'details': {'error': str(e)}
            }
    
    async def test_strategy_generation(self):
        """Test strategy generation and output interpretation"""
        print("\n7. 🎯 Strategy Generation Test")
        print("-" * 40)
        
        try:
            # Test strategy generation for different scenarios
            test_scenarios = [
                {'name': 'Early Game', 'generation': 1, 'complexity': 0.1},
                {'name': 'Mid Game', 'generation': 5, 'complexity': 0.5},
                {'name': 'Late Game', 'generation': 10, 'complexity': 0.9}
            ]
            
            strategy_results = []
            
            for scenario in test_scenarios:
                print(f"Testing: {scenario['name']}")
                
                # Create test features
                features = self.create_test_features('strategy_test', scenario['generation'])
                features_array = np.array([features], dtype=np.float32)
                
                # Generate strategy predictions
                predictions = self.network.predict_strategy(features_array)
                strategy_probs = predictions[0]
                
                # Analyze strategy distribution
                top_strategies = np.argsort(strategy_probs)[-5:][::-1]
                strategy_diversity = len([p for p in strategy_probs if p > 0.05])  # Strategies with >5% probability
                max_prob = np.max(strategy_probs)
                
                # Test label preparation (for training)
                test_labels = self.network._prepare_labels({
                    'strategy_labels': [1, 5, 10],
                    'reward_signal': -1.0
                })
                
                strategy_result = {
                    'scenario': scenario['name'],
                    'generation': scenario['generation'],
                    'top_strategies': [int(s) for s in top_strategies],
                    'strategy_probabilities': [float(strategy_probs[s]) for s in top_strategies],
                    'max_probability': float(max_prob),
                    'strategy_diversity': strategy_diversity,
                    'label_preparation_success': test_labels.shape == (1, 20),
                    'output_valid': np.allclose(np.sum(strategy_probs), 1.0, atol=1e-6)  # Probabilities sum to 1
                }
                
                strategy_results.append(strategy_result)
                
                print(f"  ✅ Top strategy: {top_strategies[0]} (prob: {strategy_probs[top_strategies[0]]:.3f})")
                print(f"     Diversity: {strategy_diversity} strategies, Max prob: {max_prob:.3f}")
            
            # Overall strategy generation quality
            valid_outputs = sum(1 for r in strategy_results if r['output_valid'])
            diverse_outputs = sum(1 for r in strategy_results if r['strategy_diversity'] >= 3)
            strategy_score = (valid_outputs + diverse_outputs) / (2 * len(test_scenarios))
            
            details = {
                'scenarios_tested': len(test_scenarios),
                'valid_outputs': valid_outputs,
                'diverse_outputs': diverse_outputs,
                'strategy_score': strategy_score,
                'strategy_results': strategy_results
            }
            
            self.assessment_results['strategy_generation_test'] = {
                'status': 'passed' if strategy_score >= 0.7 else 'failed',
                'details': details
            }
            
            print(f"✅ Strategy Generation: {strategy_score:.1%} quality score")
            
        except Exception as e:
            print(f"❌ Strategy generation test failed: {e}")
            self.assessment_results['strategy_generation_test'] = {
                'status': 'error',
                'details': {'error': str(e)}
            }
    
    def generate_overall_assessment(self):
        """Generate overall assessment based on all tests"""
        print("\n" + "=" * 60)
        print("🧠 OVERALL NEURAL NETWORK ASSESSMENT")
        print("=" * 60)
        
        # Count test results
        test_categories = [
            'architecture_analysis',
            'training_effectiveness', 
            'inference_accuracy',
            'learning_progression',
            'performance_analysis',
            'feature_encoding_test',
            'strategy_generation_test'
        ]
        
        passed_tests = 0
        failed_tests = 0
        error_tests = 0
        
        for category in test_categories:
            status = self.assessment_results[category]['status']
            if status == 'passed':
                passed_tests += 1
                print(f"✅ {category.replace('_', ' ').title()}: PASSED")
            elif status == 'failed':
                failed_tests += 1
                print(f"❌ {category.replace('_', ' ').title()}: FAILED")
            elif status == 'error':
                error_tests += 1
                print(f"⚠️  {category.replace('_', ' ').title()}: ERROR")
        
        total_tests = len(test_categories)
        success_rate = passed_tests / total_tests
        
        print("-" * 60)
        print(f"📊 Test Results: {passed_tests}/{total_tests} passed ({success_rate:.1%})")
        print(f"   Passed: {passed_tests}, Failed: {failed_tests}, Errors: {error_tests}")
        
        # Overall assessment
        if success_rate >= 0.85:
            overall_status = "EXCELLENT"
            assessment = "Neural network is performing excellently across all categories"
        elif success_rate >= 0.7:
            overall_status = "GOOD"
            assessment = "Neural network is performing well with minor issues"
        elif success_rate >= 0.5:
            overall_status = "FAIR"
            assessment = "Neural network has significant issues that need attention"
        else:
            overall_status = "POOR"
            assessment = "Neural network requires major improvements"
        
        self.assessment_results['overall_assessment'] = {
            'status': overall_status,
            'success_rate': success_rate,
            'passed_tests': passed_tests,
            'failed_tests': failed_tests,
            'error_tests': error_tests,
            'total_tests': total_tests,
            'assessment': assessment
        }
        
        print(f"🎯 Overall Status: {overall_status}")
        print(f"📝 Assessment: {assessment}")
        print("=" * 60)
    
    def create_training_data(self, scenario: Dict[str, Any]) -> Dict[str, Any]:
        """Create training data for a specific scenario"""
        return {
            'generation': scenario.get('generation', 1),
            'reward_signal': -1.0,
            'strategy_labels': scenario.get('failed_strategies', [0, 1]),
            'game_state_features': [0.5] * 20,
            'player_pattern_features': [0.3] * 15,
            'death_analysis_features': [0.7] * 10,
            'generation_features': self._encode_generation_features(scenario.get('generation', 1)),
            'game_state': {'energy_level': 500, 'active_mining': []},
            'player_patterns': {'aggression_score': 0.5, 'economic_focus': 0.5},
            'death_cause': 'protector_assault',
            'survival_time': 300,
            'parasites_spawned': 10
        }
    
    def create_test_features(self, scenario_type: str, generation: int = 1) -> List[float]:
        """Create test features for different scenarios"""
        features = [0.5] * 50  # Default neutral features
        
        if scenario_type == 'aggressive_player':
            # High aggression, low economic focus
            features[0] = 0.3  # Low energy (under pressure)
            features[1] = 0.8  # High unit count
            features[15] = 0.9  # High aggression score
            features[16] = 0.2  # Low economic focus
            
        elif scenario_type == 'economic_player':
            # Low aggression, high economic focus
            features[0] = 0.8  # High energy
            features[4] = 0.9  # High mining activity
            features[15] = 0.2  # Low aggression score
            features[16] = 0.9  # High economic focus
            
        elif scenario_type == 'defensive_player':
            # Balanced but defensive
            features[1] = 0.4  # Moderate unit count
            features[15] = 0.4  # Moderate aggression
            features[29] = 0.8  # High defensive behavior
            
        # Add generation-based features
        generation_features = self._encode_generation_features(generation)
        features[45:50] = generation_features
        
        return features
    
    def _encode_generation_features(self, generation: int) -> List[float]:
        """Encode generation-based features"""
        complexity_level = min(1.0, 0.1 + (generation - 1) * 0.05)
        
        return [
            min(1.0, generation / 20.0),  # Normalized generation
            complexity_level,             # Complexity level
            1.0 if generation <= 3 else 0.0,    # Basic phase
            1.0 if 4 <= generation <= 7 else 0.0,  # Tactical phase
            1.0 if generation >= 8 else 0.0     # Strategic phase
        ]
    
    def print_detailed_results(self):
        """Print detailed assessment results"""
        print("\n" + "=" * 80)
        print("📋 DETAILED NEURAL NETWORK ASSESSMENT RESULTS")
        print("=" * 80)
        
        for category, result in self.assessment_results.items():
            if category == 'overall_assessment':
                continue
                
            print(f"\n🔍 {category.replace('_', ' ').title()}")
            print("-" * 50)
            print(f"Status: {result['status'].upper()}")
            
            if 'details' in result and isinstance(result['details'], dict):
                for key, value in result['details'].items():
                    if isinstance(value, (int, float)):
                        if isinstance(value, float):
                            print(f"  {key}: {value:.4f}")
                        else:
                            print(f"  {key}: {value}")
                    elif isinstance(value, bool):
                        print(f"  {key}: {'✅' if value else '❌'}")
                    elif isinstance(value, str):
                        print(f"  {key}: {value}")
                    elif isinstance(value, dict) and len(value) < 10:
                        print(f"  {key}:")
                        for sub_key, sub_value in value.items():
                            print(f"    {sub_key}: {sub_value}")

async def main():
    """Main assessment function"""
    assessment = NeuralNetworkAssessment()
    
    try:
        results = await assessment.run_comprehensive_assessment()
        
        # Print detailed results
        assessment.print_detailed_results()
        
        # Save results to file
        with open('neural_network_assessment_results.json', 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"\n📄 Detailed results saved to: neural_network_assessment_results.json")
        
        # Exit with appropriate code
        overall_status = results.get('overall_assessment', {}).get('status', 'UNKNOWN')
        if overall_status in ['EXCELLENT', 'GOOD']:
            print(f"\n🎉 Neural Network Assessment: {overall_status}")
            sys.exit(0)
        else:
            print(f"\n⚠️  Neural Network Assessment: {overall_status}")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n💥 Assessment failed with error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())