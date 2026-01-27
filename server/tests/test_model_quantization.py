"""
Test suite for Model Quantization System
Tests Requirements 2.1, 2.2, 2.3, 2.4, 2.5
"""

import pytest
import numpy as np
import tempfile
import os
import shutil
from unittest.mock import Mock, patch, MagicMock

# Import the modules to test
from ai_engine.model_quantizer import (
    ModelQuantizer, QuantizationConfig, QuantizationMethod, ModelFormat,
    QualityValidator, ModelPruner, QuantizationMetrics, ModelVariant
)
from ai_engine.neural_network import QueenBehaviorNetwork

try:
    import tensorflow as tf
    from tensorflow import keras
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    tf = None
    keras = None

# Skip all tests if TensorFlow is not available
pytestmark = pytest.mark.skipif(not TENSORFLOW_AVAILABLE, reason="TensorFlow not available")


@pytest.fixture
def sample_model():
    """Create a simple test model"""
    if not TENSORFLOW_AVAILABLE:
        pytest.skip("TensorFlow not available")
    
    model = keras.Sequential([
        keras.layers.Dense(64, activation='relu', input_shape=(50,)),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(32, activation='relu'),
        keras.layers.Dense(20, activation='softmax')
    ])
    
    model.compile(
        optimizer='adam',
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    return model


@pytest.fixture
def sample_data():
    """Create sample training/test data"""
    features = np.random.random((100, 50)).astype(np.float32)
    labels = np.random.random((100, 20)).astype(np.float32)
    # Normalize labels to sum to 1
    labels = labels / labels.sum(axis=1, keepdims=True)
    return features, labels


@pytest.fixture
def quantization_config():
    """Create default quantization configuration"""
    return QuantizationConfig(
        method=QuantizationMethod.POST_TRAINING_QUANTIZATION,
        target_format=ModelFormat.TFLITE,
        accuracy_threshold=0.05,
        enable_pruning=True,
        pruning_sparsity=0.3
    )


@pytest.fixture
def temp_models_dir():
    """Create temporary directory for model storage"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


class TestQualityValidator:
    """Test quality validation functionality"""
    
    def test_validate_quantized_model_success(self, sample_model, sample_data):
        """Test successful quality validation"""
        validator = QualityValidator(accuracy_threshold=0.05)
        features, labels = sample_data
        
        # Create a mock quantized model that performs similarly
        quantized_model = sample_model  # Using same model for simplicity
        
        result = validator.validate_quantized_model(
            sample_model, quantized_model, features, labels
        )
        
        assert 'original_accuracy' in result
        assert 'quantized_accuracy' in result
        assert 'accuracy_loss_percent' in result
        assert 'quality_acceptable' in result
        assert result['validation_samples'] == len(features)
    
    def test_validate_quantized_model_failure(self, sample_model, sample_data):
        """Test quality validation with poor quantized model"""
        validator = QualityValidator(accuracy_threshold=0.01)  # Very strict threshold
        features, labels = sample_data
        
        # Mock a poorly performing quantized model
        with patch.object(sample_model, 'evaluate') as mock_evaluate:
            mock_evaluate.side_effect = [[0.5, 0.9], [0.5, 0.5]]  # Original: 90%, Quantized: 50%
            
            result = validator.validate_quantized_model(
                sample_model, sample_model, features, labels
            )
            
            assert result['accuracy_loss_percent'] > 40  # Significant loss
            assert not result['quality_acceptable']
    
    def test_validate_with_error_handling(self, sample_model, sample_data):
        """Test error handling in quality validation"""
        validator = QualityValidator()
        features, labels = sample_data
        
        # Mock evaluation failure
        with patch.object(sample_model, 'evaluate', side_effect=Exception("Evaluation failed")):
            result = validator.validate_quantized_model(
                sample_model, sample_model, features, labels
            )
            
            assert 'error' in result
            assert not result['quality_acceptable']
            assert result['validation_failed']


class TestModelQuantizer:
    """Test model quantization functionality"""
    
    def test_quantizer_initialization(self):
        """Test quantizer initialization"""
        quantizer = ModelQuantizer()
        
        assert quantizer.quality_validator is not None
        assert quantizer.quantization_cache == {}
        assert os.path.exists(quantizer.models_dir)
    
    def test_quantize_model_post_training(self, sample_model, sample_data, quantization_config, temp_models_dir):
        """Test post-training quantization"""
        with patch('ai_engine.model_quantizer.ModelQuantizer.models_dir', temp_models_dir):
            quantizer = ModelQuantizer()
            features, labels = sample_data
            
            # Mock TFLite conversion
            with patch('tensorflow.lite.TFLiteConverter.from_keras_model') as mock_converter:
                mock_converter_instance = Mock()
                mock_converter_instance.convert.return_value = b'fake_tflite_model'
                mock_converter.return_value = mock_converter_instance
                
                result = quantizer.quantize_model(
                    sample_model, 
                    quantization_config, 
                    (features, labels),
                    features[:50]
                )
                
                assert result['success']
                assert result['quantization_method'] == 'post_training'
                assert 'metrics' in result
                assert 'quantized_model_path' in result
    
    def test_quantize_model_dynamic_range(self, sample_model, sample_data, temp_models_dir):
        """Test dynamic range quantization"""
        config = QuantizationConfig(
            method=QuantizationMethod.DYNAMIC_RANGE_QUANTIZATION,
            target_format=ModelFormat.TFLITE
        )
        
        with patch('ai_engine.model_quantizer.ModelQuantizer.models_dir', temp_models_dir):
            quantizer = ModelQuantizer()
            features, labels = sample_data
            
            # Mock TFLite conversion
            with patch('tensorflow.lite.TFLiteConverter.from_keras_model') as mock_converter:
                mock_converter_instance = Mock()
                mock_converter_instance.convert.return_value = b'fake_tflite_model'
                mock_converter.return_value = mock_converter_instance
                
                result = quantizer.quantize_model(
                    sample_model, 
                    config, 
                    (features, labels)
                )
                
                assert result['success']
                assert result['quantization_method'] == 'dynamic_range'
    
    def test_quantize_model_failure_handling(self, sample_model, sample_data, quantization_config):
        """Test quantization failure handling"""
        quantizer = ModelQuantizer()
        features, labels = sample_data
        
        # Mock TFLite conversion failure
        with patch('tensorflow.lite.TFLiteConverter.from_keras_model', side_effect=Exception("Conversion failed")):
            result = quantizer.quantize_model(
                sample_model, 
                quantization_config, 
                (features, labels)
            )
            
            assert not result['success']
            assert 'error' in result
            assert result['fallback_required']
    
    def test_prune_model_success(self, sample_model, sample_data):
        """Test successful model pruning"""
        # Skip if tensorflow-model-optimization not available
        try:
            import tensorflow_model_optimization as tfmot
        except ImportError:
            pytest.skip("TensorFlow Model Optimization not available")
        
        quantizer = ModelQuantizer()
        features, labels = sample_data
        
        result = quantizer.prune_model(sample_model, sparsity=0.3, training_data=(features, labels))
        
        assert result['success']
        assert result['sparsity_achieved'] == 0.3
        assert 'pruned_model' in result
        assert result['size_reduction_ratio'] > 0
    
    def test_create_fallback_chain(self, sample_model, quantization_config):
        """Test fallback chain creation"""
        quantizer = ModelQuantizer()
        
        fallback_variants = quantizer.create_fallback_chain(sample_model, quantization_config)
        
        assert len(fallback_variants) >= 1
        assert fallback_variants[0].name == "original_fallback"
        assert fallback_variants[0].is_fallback
    
    def test_model_caching(self, sample_model, sample_data, quantization_config, temp_models_dir):
        """Test model quantization caching"""
        with patch('ai_engine.model_quantizer.ModelQuantizer.models_dir', temp_models_dir):
            quantizer = ModelQuantizer()
            features, labels = sample_data
            
            # Mock successful quantization
            with patch('tensorflow.lite.TFLiteConverter.from_keras_model') as mock_converter:
                mock_converter_instance = Mock()
                mock_converter_instance.convert.return_value = b'fake_tflite_model'
                mock_converter.return_value = mock_converter_instance
                
                # First quantization
                result1 = quantizer.quantize_model(
                    sample_model, 
                    quantization_config, 
                    (features, labels)
                )
                
                # Second quantization should use cache
                result2 = quantizer.quantize_model(
                    sample_model, 
                    quantization_config, 
                    (features, labels)
                )
                
                assert result1['success']
                assert result2['success']
                assert result2.get('from_cache', False)


class TestNeuralNetworkIntegration:
    """Test integration with QueenBehaviorNetwork"""
    
    @patch('ai_engine.neural_network.TENSORFLOW_AVAILABLE', True)
    def test_neural_network_quantization_integration(self):
        """Test quantization integration with neural network"""
        with patch('ai_engine.neural_network.QueenBehaviorNetwork._create_model'):
            with patch('ai_engine.neural_network.QueenBehaviorNetwork._load_model'):
                with patch('ai_engine.neural_network.QueenBehaviorNetwork._configure_gpu_acceleration'):
                    network = QueenBehaviorNetwork()
                    
                    # Mock model
                    network.model = Mock()
                    network.model.input_shape = (None, 50)
                    network.model.count_params.return_value = 10000
                    network.model.predict.return_value = np.random.random((1, 20))
                    network.model.evaluate.return_value = [0.5, 0.8]
                    
                    # Test quantization status
                    status = network.get_quantization_status()
                    
                    assert status['quantization_available']
                    assert status['model_available']
                    assert len(status['supported_methods']) > 0
    
    @patch('ai_engine.neural_network.TENSORFLOW_AVAILABLE', True)
    async def test_quantize_model_for_inference(self):
        """Test model quantization for inference optimization"""
        with patch('ai_engine.neural_network.QueenBehaviorNetwork._create_model'):
            with patch('ai_engine.neural_network.QueenBehaviorNetwork._load_model'):
                with patch('ai_engine.neural_network.QueenBehaviorNetwork._configure_gpu_acceleration'):
                    network = QueenBehaviorNetwork()
                    
                    # Mock model and quantizer
                    network.model = Mock()
                    network.model.input_shape = (None, 50)
                    network.model_quantizer = Mock()
                    
                    # Mock successful quantization
                    mock_result = {
                        'success': True,
                        'metrics': {
                            'compression_ratio': 4.0,
                            'speedup_ratio': 2.5,
                            'accuracy_loss_percent': 2.0
                        },
                        'quantized_model_variant': Mock()
                    }
                    network.model_quantizer.quantize_model.return_value = mock_result
                    
                    result = await network.quantize_model_for_inference()
                    
                    assert result['success']
                    assert hasattr(network, 'quantized_model_variant')
    
    @patch('ai_engine.neural_network.TENSORFLOW_AVAILABLE', True)
    async def test_prune_model_for_optimization(self):
        """Test model pruning for optimization"""
        with patch('ai_engine.neural_network.QueenBehaviorNetwork._create_model'):
            with patch('ai_engine.neural_network.QueenBehaviorNetwork._load_model'):
                with patch('ai_engine.neural_network.QueenBehaviorNetwork._configure_gpu_acceleration'):
                    network = QueenBehaviorNetwork()
                    
                    # Mock model and quantizer
                    network.model = Mock()
                    network.model_quantizer = Mock()
                    
                    # Mock successful pruning
                    mock_result = {
                        'success': True,
                        'size_reduction_ratio': 2.0,
                        'pruned_model': Mock()
                    }
                    network.model_quantizer.prune_model.return_value = mock_result
                    
                    result = await network.prune_model_for_optimization(sparsity=0.5)
                    
                    assert result['success']
                    assert network.model == mock_result['pruned_model']


class TestQuantizationMetrics:
    """Test quantization metrics calculation"""
    
    def test_quantization_metrics_creation(self):
        """Test creation of quantization metrics"""
        metrics = QuantizationMetrics(
            original_size_mb=25.0,
            quantized_size_mb=6.25,
            compression_ratio=4.0,
            original_accuracy=0.85,
            quantized_accuracy=0.83,
            accuracy_loss_percent=2.35,
            original_inference_time_ms=50.0,
            quantized_inference_time_ms=20.0,
            speedup_ratio=2.5,
            quantization_time_ms=5000.0,
            meets_accuracy_threshold=True,
            meets_size_reduction_target=True,
            meets_speed_improvement_target=True
        )
        
        assert metrics.compression_ratio == 4.0
        assert metrics.speedup_ratio == 2.5
        assert metrics.meets_accuracy_threshold
        assert metrics.meets_size_reduction_target
        assert metrics.meets_speed_improvement_target


class TestModelVariant:
    """Test model variant functionality"""
    
    def test_model_variant_creation(self):
        """Test creation of model variants"""
        variant = ModelVariant(
            name="quantized_post_training",
            model_path="/path/to/model.tflite",
            model_format=ModelFormat.TFLITE,
            size_mb=6.25,
            accuracy=0.83,
            inference_time_ms=20.0,
            quantization_method=QuantizationMethod.POST_TRAINING_QUANTIZATION,
            is_fallback=False
        )
        
        assert variant.name == "quantized_post_training"
        assert variant.model_format == ModelFormat.TFLITE
        assert variant.quantization_method == QuantizationMethod.POST_TRAINING_QUANTIZATION
        assert not variant.is_fallback


# Integration tests
class TestQuantizationIntegration:
    """Test end-to-end quantization integration"""
    
    @pytest.mark.asyncio
    async def test_full_quantization_workflow(self, sample_model, sample_data, temp_models_dir):
        """Test complete quantization workflow"""
        with patch('ai_engine.model_quantizer.ModelQuantizer.models_dir', temp_models_dir):
            quantizer = ModelQuantizer()
            features, labels = sample_data
            
            config = QuantizationConfig(
                method=QuantizationMethod.DYNAMIC_RANGE_QUANTIZATION,
                target_format=ModelFormat.TFLITE,
                accuracy_threshold=0.1  # Lenient for testing
            )
            
            # Mock TFLite conversion
            with patch('tensorflow.lite.TFLiteConverter.from_keras_model') as mock_converter:
                mock_converter_instance = Mock()
                mock_converter_instance.convert.return_value = b'fake_tflite_model_data'
                mock_converter.return_value = mock_converter_instance
                
                # Perform quantization
                result = quantizer.quantize_model(
                    sample_model, 
                    config, 
                    (features, labels),
                    features[:50]
                )
                
                # Verify results
                assert result['success']
                assert 'metrics' in result
                assert 'quantized_model_variant' in result
                
                # Verify metrics
                metrics = result['metrics']
                assert metrics['compression_ratio'] > 0
                assert metrics['speedup_ratio'] > 0
                assert 'meets_accuracy_threshold' in metrics
                
                # Verify model variant
                variant = result['quantized_model_variant']
                assert variant.model_format == ModelFormat.TFLITE
                assert variant.quantization_method == QuantizationMethod.DYNAMIC_RANGE_QUANTIZATION


if __name__ == "__main__":
    pytest.main([__file__, "-v"])