"""
Unit tests for Neural Network Architecture Implementation
Task 2: Neural Network Architecture Implementation
"""

import unittest
import asyncio
import os
import sys
import tempfile
import shutil
import numpy as np

# Add server directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_engine.neural_network import QueenBehaviorNetwork


class TestNeuralNetworkArchitecture(unittest.TestCase):
    """Test neural network architecture requirements"""
    
    def setUp(self):
        """Set up test environment"""
        self.network = QueenBehaviorNetwork()
        self.test_data = {
            'game_state_features': [0.5] * 20,
            'player_pattern_features': [0.3] * 15,
            'death_analysis_features': [0.7] * 10,
            'generation_features': [0.1] * 5,
            'strategy_labels': [1, 5, 10],
            'reward_signal': -1.0
        }
    
    def test_model_architecture_layers(self):
        """Test that model has correct layer architecture [128, 64, 32]"""
        # Requirement 1.1: TensorFlow neural network with [128, 64, 32] hidden layers
        layers = self.network.model.layers
        
        # Check layer count (input + 2 dropouts + 2 hidden + output = 6 layers)
        self.assertEqual(len(layers), 6, "Model should have 6 layers")
        
        # Check layer units
        self.assertEqual(layers[0].units, 128, "First layer should have 128 units")
        self.assertEqual(layers[2].units, 64, "Second dense layer should have 64 units")
        self.assertEqual(layers[4].units, 32, "Third dense layer should have 32 units")
        self.assertEqual(layers[5].units, 20, "Output layer should have 20 units")
        
        # Check activation functions
        self.assertEqual(layers[0].activation.__name__, 'relu', "Hidden layers should use ReLU")
        self.assertEqual(layers[2].activation.__name__, 'relu', "Hidden layers should use ReLU")
        self.assertEqual(layers[4].activation.__name__, 'relu', "Hidden layers should use ReLU")
        self.assertEqual(layers[5].activation.__name__, 'softmax', "Output layer should use softmax")
    
    def test_input_output_dimensions(self):
        """Test 50-input features and 20-output strategies"""
        # Requirement 1.1: 50-input feature encoding and 20-output strategy decoding
        self.assertEqual(self.network.input_features, 50, "Should have 50 input features")
        self.assertEqual(self.network.output_strategies, 20, "Should have 20 output strategies")
        
        # Test model input/output shapes by creating a test input
        test_input = np.random.random((1, 50))
        output = self.network.model(test_input)
        
        self.assertEqual(output.shape[1], 20, "Output should have 20 strategies")
        
        # Test that model accepts 50-feature input
        features = self.network._prepare_features(self.test_data)
        self.assertEqual(features.shape[1], 50, "Prepared features should have 50 dimensions")
        
        # Test prediction works with correct dimensions
        prediction = self.network.predict_strategy(features)
        self.assertEqual(prediction.shape, (1, 20), "Prediction should be shaped (1, 20)")
    
    def test_dropout_layers(self):
        """Test dropout layers are present"""
        # Requirement 1.1: Add dropout layers
        dropout_layers = [layer for layer in self.network.model.layers 
                         if layer.__class__.__name__ == 'Dropout']
        
        self.assertEqual(len(dropout_layers), 2, "Should have 2 dropout layers")
        
        # Check dropout rates
        for dropout_layer in dropout_layers:
            self.assertEqual(dropout_layer.rate, 0.2, "Dropout rate should be 0.2")
    
    def test_adam_optimizer(self):
        """Test Adam optimizer configuration"""
        # Requirement 1.1: Adam optimizer configuration
        optimizer = self.network.model.optimizer
        self.assertEqual(optimizer.__class__.__name__, 'Adam', "Should use Adam optimizer")
        
        # Check loss function
        self.assertEqual(self.network.model.loss, 'categorical_crossentropy', 
                        "Should use categorical crossentropy loss")
    
    def test_feature_preparation(self):
        """Test feature encoding functionality"""
        # Requirement 1.1: 50-input feature encoding
        features = self.network._prepare_features(self.test_data)
        
        self.assertEqual(features.shape, (1, 50), "Features should be shaped (1, 50)")
        self.assertTrue(np.all(features >= 0), "Features should be non-negative")
        self.assertTrue(np.all(features <= 1), "Features should be normalized")
    
    def test_strategy_decoding(self):
        """Test strategy output decoding"""
        # Requirement 1.1: 20-output strategy decoding
        features = self.network._prepare_features(self.test_data)
        prediction = self.network.predict_strategy(features)
        
        self.assertEqual(prediction.shape, (1, 20), "Prediction should be shaped (1, 20)")
        self.assertAlmostEqual(prediction.sum(), 1.0, places=5, 
                              msg="Softmax output should sum to 1.0")
        self.assertTrue(np.all(prediction >= 0), "All probabilities should be non-negative")
        self.assertTrue(np.all(prediction <= 1), "All probabilities should be <= 1.0")
    
    def test_model_persistence_save_load(self):
        """Test model persistence (save/load) functionality"""
        # Requirement 1.4: Create model persistence (save/load) functionality
        
        # Create temporary directory for testing
        with tempfile.TemporaryDirectory() as temp_dir:
            # Update model path to temporary directory
            original_path = self.network.model_path
            self.network.model_path = os.path.join(temp_dir, "test_model.keras")
            
            try:
                # Get initial prediction
                features = self.network._prepare_features(self.test_data)
                initial_prediction = self.network.predict_strategy(features)
                
                # Save model
                self.network._save_model()
                self.assertTrue(os.path.exists(self.network.model_path), 
                               "Model file should be created")
                
                # Create new network instance and load model
                new_network = QueenBehaviorNetwork()
                new_network.model_path = self.network.model_path
                new_network._load_model()
                
                # Test that loaded model produces same predictions
                loaded_prediction = new_network.predict_strategy(features)
                np.testing.assert_array_almost_equal(
                    initial_prediction, loaded_prediction, decimal=5,
                    err_msg="Loaded model should produce same predictions"
                )
                
            finally:
                # Restore original path
                self.network.model_path = original_path
    
    def test_async_training_functionality(self):
        """Test asynchronous training functionality"""
        # Requirement 1.1: Neural network training capability
        
        async def run_training_test():
            result = await self.network.train_on_failure(self.test_data)
            
            self.assertIsInstance(result, dict, "Training should return a dictionary")
            self.assertIn('success', result, "Result should contain success flag")
            self.assertIn('training_time', result, "Result should contain training time")
            self.assertIn('gpu_used', result, "Result should contain GPU usage info")
            
            if result['success']:
                self.assertIn('loss', result, "Successful training should include loss")
                self.assertIn('accuracy', result, "Successful training should include accuracy")
                self.assertIn('epochs_trained', result, "Should include epochs trained")
                self.assertGreater(result['training_time'], 0, "Training time should be positive")
        
        # Run async test
        asyncio.run(run_training_test())
    
    def test_gpu_configuration(self):
        """Test GPU acceleration configuration"""
        # Requirement: GPU acceleration with graceful CPU fallback
        
        # GPU configuration should not raise errors
        self.assertIsInstance(self.network.use_gpu, bool, "GPU flag should be boolean")
        
        # Model should work regardless of GPU availability
        features = self.network._prepare_features(self.test_data)
        prediction = self.network.predict_strategy(features)
        self.assertEqual(prediction.shape, (1, 20), "Model should work with or without GPU")


if __name__ == '__main__':
    # Run tests
    unittest.main(verbosity=2)