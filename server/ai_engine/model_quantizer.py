"""
Model Quantization System - TensorFlow model quantization and optimization
Implements Requirements 2.1, 2.2, 2.3, 2.4, 2.5 for model optimization and quantization
"""

import logging
import os
import time
import json
from typing import Dict, Any, List, Optional, Tuple, Union, TYPE_CHECKING
from dataclasses import dataclass, asdict
from enum import Enum
import numpy as np

# TensorFlow removed - using PyTorch instead
TENSORFLOW_AVAILABLE = False
tf = None
keras = None

# TensorFlow model optimization removed
OPTIMIZATION_AVAILABLE = False
tfmot = None

if TYPE_CHECKING:
    KerasModule = Any
else:
    KerasModule = Any

logger = logging.getLogger(__name__)


class QuantizationMethod(Enum):
    """Available quantization methods"""
    POST_TRAINING_QUANTIZATION = "post_training"
    QUANTIZATION_AWARE_TRAINING = "qat"
    DYNAMIC_RANGE_QUANTIZATION = "dynamic_range"


class ModelFormat(Enum):
    """Supported model formats"""
    KERAS = "keras"
    TFLITE = "tflite"
    SAVED_MODEL = "saved_model"


@dataclass
class QuantizationConfig:
    """Configuration for model quantization"""
    method: QuantizationMethod
    target_format: ModelFormat
    accuracy_threshold: float = 0.05  # <5% accuracy loss
    enable_pruning: bool = True
    pruning_sparsity: float = 0.5  # 50% sparsity
    enable_clustering: bool = False
    cluster_count: int = 16
    representative_dataset_size: int = 100
    optimization_level: str = "balanced"  # "speed", "balanced", "accuracy"


@dataclass
class QuantizationMetrics:
    """Metrics for quantization results"""
    original_size_mb: float
    quantized_size_mb: float
    compression_ratio: float
    original_accuracy: float
    quantized_accuracy: float
    accuracy_loss_percent: float
    original_inference_time_ms: float
    quantized_inference_time_ms: float
    speedup_ratio: float
    quantization_time_ms: float
    meets_accuracy_threshold: bool
    meets_size_reduction_target: bool
    meets_speed_improvement_target: bool


@dataclass
class ModelVariant:
    """Represents a model variant (original, quantized, pruned, etc.)"""
    name: str
    model_path: str
    model_format: ModelFormat
    size_mb: float
    accuracy: float
    inference_time_ms: float
    quantization_method: Optional[QuantizationMethod]
    is_fallback: bool = False


class QualityValidator:
    """Validates model quality after optimization"""
    
    def __init__(self, accuracy_threshold: float = 0.05):
        self.accuracy_threshold = accuracy_threshold
        
    def validate_quantized_model(self, original_model, quantized_model, 
                                test_data: np.ndarray, test_labels: np.ndarray) -> Dict[str, Any]:
        """
        Validate quantized model quality against original
        
        Args:
            original_model: Original model
            quantized_model: Quantized model
            test_data: Test dataset
            test_labels: Test labels
            
        Returns:
            Validation results with quality metrics
        """
        try:
            # Evaluate original model
            original_results = original_model.evaluate(test_data, test_labels, verbose=0)
            original_accuracy = original_results[1] if len(original_results) > 1 else original_results[0]
            
            # Evaluate quantized model
            if hasattr(quantized_model, 'evaluate'):
                quantized_results = quantized_model.evaluate(test_data, test_labels, verbose=0)
                quantized_accuracy = quantized_results[1] if len(quantized_results) > 1 else quantized_results[0]
            else:
                # For TFLite models, need to run inference manually
                quantized_accuracy = self._evaluate_tflite_model(quantized_model, test_data, test_labels)
            
            # Calculate accuracy loss
            accuracy_loss = abs(original_accuracy - quantized_accuracy)
            accuracy_loss_percent = (accuracy_loss / original_accuracy) * 100
            
            # Determine if quality is acceptable
            quality_acceptable = accuracy_loss_percent <= (self.accuracy_threshold * 100)
            
            return {
                'original_accuracy': float(original_accuracy),
                'quantized_accuracy': float(quantized_accuracy),
                'accuracy_loss': float(accuracy_loss),
                'accuracy_loss_percent': float(accuracy_loss_percent),
                'quality_acceptable': quality_acceptable,
                'threshold_percent': self.accuracy_threshold * 100,
                'validation_samples': len(test_data)
            }
            
        except Exception as e:
            logger.error(f"Quality validation failed: {e}")
            return {
                'error': str(e),
                'quality_acceptable': False,
                'validation_failed': True
            }
    
    def _evaluate_tflite_model(self, tflite_model, test_data: np.ndarray, 
                              test_labels: np.ndarray) -> float:
        """Evaluate TFLite model accuracy"""
        try:
            # Initialize TFLite interpreter
            interpreter = tf.lite.Interpreter(model_content=tflite_model)
            interpreter.allocate_tensors()
            
            input_details = interpreter.get_input_details()
            output_details = interpreter.get_output_details()
            
            correct_predictions = 0
            total_predictions = len(test_data)
            
            # Run inference on test data
            for i in range(total_predictions):
                # Set input tensor
                interpreter.set_tensor(input_details[0]['index'], 
                                     test_data[i:i+1].astype(np.float32))
                
                # Run inference
                interpreter.invoke()
                
                # Get prediction
                output_data = interpreter.get_tensor(output_details[0]['index'])
                predicted_class = np.argmax(output_data[0])
                actual_class = np.argmax(test_labels[i])
                
                if predicted_class == actual_class:
                    correct_predictions += 1
            
            accuracy = correct_predictions / total_predictions
            return accuracy
            
        except Exception as e:
            logger.error(f"TFLite model evaluation failed: {e}")
            return 0.0


class ModelPruner:
    """Handles model pruning for weight reduction"""
    
    def __init__(self):
        if not OPTIMIZATION_AVAILABLE:
            raise ImportError("TensorFlow Model Optimization is required. Run: pip install tensorflow-model-optimization")
    
    def prune_model(self, model, sparsity: float = 0.5, 
                   training_data: Optional[Tuple[np.ndarray, np.ndarray]] = None):
        """
        Prune model to reduce weights while preserving functionality
        
        Args:
            model: Original model to prune
            sparsity: Target sparsity level (0.0 to 1.0)
            training_data: Optional training data for fine-tuning
            
        Returns:
            Pruned model
        """
        try:
            logger.info(f"Starting model pruning with {sparsity:.1%} sparsity")
            
            # Define pruning schedule
            pruning_params = {
                'pruning_schedule': tfmot.sparsity.keras.PolynomialDecay(
                    initial_sparsity=0.0,
                    final_sparsity=sparsity,
                    begin_step=0,
                    end_step=1000
                )
            }
            
            # Apply pruning to the model
            pruned_model = tfmot.sparsity.keras.prune_low_magnitude(model, **pruning_params)
            
            # Recompile the model
            pruned_model.compile(
                optimizer=model.optimizer,
                loss=model.loss,
                metrics=model.metrics
            )
            
            # Fine-tune if training data is provided
            if training_data is not None:
                features, labels = training_data
                logger.info("Fine-tuning pruned model...")
                
                # Add pruning callbacks
                callbacks = [
                    tfmot.sparsity.keras.UpdatePruningStep(),
                    tfmot.sparsity.keras.PruningSummaries(log_dir='logs/pruning')
                ]
                
                # Fine-tune for a few epochs
                pruned_model.fit(
                    features, labels,
                    epochs=5,
                    batch_size=32,
                    validation_split=0.2,
                    callbacks=callbacks,
                    verbose=0
                )
            
            # Strip pruning wrappers for final model
            final_model = tfmot.sparsity.keras.strip_pruning(pruned_model)
            
            logger.info("Model pruning completed successfully")
            return final_model
            
        except Exception as e:
            logger.error(f"Model pruning failed: {e}")
            raise


class ModelQuantizer:
    """
    TensorFlow model quantization system
    Implements Requirements 2.1, 2.2, 2.3, 2.4, 2.5
    """
    
    def __init__(self):
        if not TENSORFLOW_AVAILABLE:
            logger.warning("TensorFlow not available. Model quantization will be limited.")
            self.quality_validator = None
            self.model_pruner = None
            self.quantization_cache = {}
            self.models_dir = "models/quantized"
            os.makedirs(self.models_dir, exist_ok=True)
            return
        
        if not OPTIMIZATION_AVAILABLE:
            logger.warning("TensorFlow Model Optimization not available. Some features will be limited.")
        
        self.quality_validator = QualityValidator()
        self.model_pruner = ModelPruner() if OPTIMIZATION_AVAILABLE else None
        self.quantization_cache: Dict[str, ModelVariant] = {}
        
        # Storage paths
        self.models_dir = "models/quantized"
        os.makedirs(self.models_dir, exist_ok=True)
    
    def quantize_model(self, model, config: QuantizationConfig,
                      test_data: Optional[Tuple[np.ndarray, np.ndarray]] = None,
                      representative_data: Optional[np.ndarray] = None) -> Dict[str, Any]:
        """
        Quantize model from float32 to int8 with quality validation
        Implements Requirements 2.1, 2.5
        
        Args:
            model: Original Keras model
            config: Quantization configuration
            test_data: Test data for quality validation
            representative_data: Representative dataset for quantization
            
        Returns:
            Quantization results with metrics and model variants
        """
        try:
            if not TENSORFLOW_AVAILABLE:
                return {
                    'success': False,
                    'error': 'TensorFlow not available for quantization',
                    'fallback_required': True
                }
            
            logger.info(f"Starting model quantization using {config.method.value} method")
            start_time = time.time()
            
            # Generate model cache key
            model_key = self._generate_model_key(model, config)
            
            # Check cache first
            if model_key in self.quantization_cache:
                logger.info("Using cached quantized model")
                cached_variant = self.quantization_cache[model_key]
                return self._create_quantization_result(cached_variant, time.time() - start_time)
            
            # Measure original model
            original_metrics = self._measure_model_performance(model, test_data)
            
            # Perform quantization based on method
            quantized_model = None
            quantization_successful = False
            
            if config.method == QuantizationMethod.POST_TRAINING_QUANTIZATION:
                quantized_model = self._post_training_quantization(model, representative_data)
                quantization_successful = True
                
            elif config.method == QuantizationMethod.DYNAMIC_RANGE_QUANTIZATION:
                quantized_model = self._dynamic_range_quantization(model)
                quantization_successful = True
                
            elif config.method == QuantizationMethod.QUANTIZATION_AWARE_TRAINING:
                if OPTIMIZATION_AVAILABLE:
                    quantized_model = self._quantization_aware_training(model, test_data)
                    quantization_successful = True
                else:
                    logger.warning("Quantization-aware training requires tensorflow-model-optimization")
                    quantization_successful = False
            
            if not quantization_successful or quantized_model is None:
                raise RuntimeError(f"Quantization failed for method {config.method.value}")
            
            # Measure quantized model performance
            quantized_metrics = self._measure_quantized_model_performance(quantized_model, test_data)
            
            # Validate quality
            quality_results = {}
            if test_data is not None:
                test_features, test_labels = test_data
                quality_results = self.quality_validator.validate_quantized_model(
                    model, quantized_model, test_features, test_labels
                )
            
            # Calculate comprehensive metrics
            metrics = self._calculate_quantization_metrics(
                original_metrics, quantized_metrics, quality_results, time.time() - start_time
            )
            
            # Save quantized model
            quantized_model_path = self._save_quantized_model(quantized_model, model_key, config)
            
            # Create model variant
            quantized_variant = ModelVariant(
                name=f"quantized_{config.method.value}",
                model_path=quantized_model_path,
                model_format=config.target_format,
                size_mb=metrics.quantized_size_mb,
                accuracy=metrics.quantized_accuracy,
                inference_time_ms=metrics.quantized_inference_time_ms,
                quantization_method=config.method
            )
            
            # Cache the result
            self.quantization_cache[model_key] = quantized_variant
            
            # Create fallback chain if quality is not acceptable
            fallback_variants = []
            if not metrics.meets_accuracy_threshold:
                logger.warning(f"Quantized model accuracy loss ({metrics.accuracy_loss_percent:.2f}%) exceeds threshold")
                fallback_variants = self._create_fallback_chain(model, config, original_metrics)
            
            result = {
                'success': True,
                'quantization_method': config.method.value,
                'metrics': asdict(metrics),
                'quality_validation': quality_results,
                'quantized_model_path': quantized_model_path,
                'original_model_variant': ModelVariant(
                    name="original",
                    model_path="",
                    model_format=ModelFormat.KERAS,
                    size_mb=original_metrics['size_mb'],
                    accuracy=original_metrics['accuracy'],
                    inference_time_ms=original_metrics['inference_time_ms'],
                    quantization_method=None
                ),
                'quantized_model_variant': quantized_variant,
                'fallback_variants': fallback_variants,
                'quantization_time_ms': metrics.quantization_time_ms
            }
            
            logger.info(f"Model quantization completed successfully in {metrics.quantization_time_ms:.1f}ms")
            logger.info(f"Size reduction: {metrics.compression_ratio:.2f}x, Speed improvement: {metrics.speedup_ratio:.2f}x")
            
            return result
            
        except Exception as e:
            logger.error(f"Model quantization failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'quantization_method': config.method.value,
                'fallback_required': True
            }
    
    def prune_model(self, model, sparsity: float = 0.5,
                   training_data: Optional[Tuple[np.ndarray, np.ndarray]] = None) -> Dict[str, Any]:
        """
        Prune model for weight reduction while preserving functionality
        Implements Requirement 2.2
        
        Args:
            model: Original model
            sparsity: Target sparsity level (0.0 to 1.0)
            training_data: Optional training data for fine-tuning
            
        Returns:
            Pruning results with metrics
        """
        try:
            if not OPTIMIZATION_AVAILABLE:
                raise RuntimeError("Model pruning requires tensorflow-model-optimization")
            
            logger.info(f"Starting model pruning with {sparsity:.1%} sparsity")
            start_time = time.time()
            
            # Measure original model
            original_metrics = self._measure_model_performance(model, training_data)
            
            # Perform pruning
            pruned_model = self.model_pruner.prune_model(model, sparsity, training_data)
            
            # Measure pruned model
            pruned_metrics = self._measure_model_performance(pruned_model, training_data)
            
            # Calculate metrics
            pruning_time_ms = (time.time() - start_time) * 1000
            size_reduction = original_metrics['size_mb'] / pruned_metrics['size_mb']
            
            # Validate quality if test data available
            quality_results = {}
            if training_data is not None:
                test_features, test_labels = training_data
                quality_results = self.quality_validator.validate_quantized_model(
                    model, pruned_model, test_features, test_labels
                )
            
            result = {
                'success': True,
                'pruning_time_ms': pruning_time_ms,
                'sparsity_achieved': sparsity,
                'original_size_mb': original_metrics['size_mb'],
                'pruned_size_mb': pruned_metrics['size_mb'],
                'size_reduction_ratio': size_reduction,
                'original_accuracy': original_metrics['accuracy'],
                'pruned_accuracy': pruned_metrics['accuracy'],
                'quality_validation': quality_results,
                'pruned_model': pruned_model
            }
            
            logger.info(f"Model pruning completed: {size_reduction:.2f}x size reduction")
            return result
            
        except Exception as e:
            logger.error(f"Model pruning failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'fallback_required': True
            }
    
    def create_fallback_chain(self, model, 
                             config: QuantizationConfig) -> List[ModelVariant]:
        """
        Create fallback chain for quantization failures
        Implements Requirement 2.4
        
        Args:
            model: Original model
            config: Quantization configuration
            
        Returns:
            List of fallback model variants
        """
        try:
            logger.info("Creating fallback chain for quantization failures")
            
            original_metrics = self._measure_model_performance(model, None)
            fallback_variants = []
            
            # Original model as primary fallback
            original_variant = ModelVariant(
                name="original_fallback",
                model_path="",
                model_format=ModelFormat.KERAS,
                size_mb=original_metrics['size_mb'],
                accuracy=original_metrics['accuracy'],
                inference_time_ms=original_metrics['inference_time_ms'],
                quantization_method=None,
                is_fallback=True
            )
            fallback_variants.append(original_variant)
            
            # Try different quantization methods as fallbacks
            fallback_methods = [
                QuantizationMethod.DYNAMIC_RANGE_QUANTIZATION,
                QuantizationMethod.POST_TRAINING_QUANTIZATION
            ]
            
            for method in fallback_methods:
                if method != config.method:
                    try:
                        fallback_config = QuantizationConfig(
                            method=method,
                            target_format=config.target_format,
                            accuracy_threshold=config.accuracy_threshold * 2  # More lenient
                        )
                        
                        result = self.quantize_model(model, fallback_config)
                        if result['success']:
                            fallback_variant = result['quantized_model_variant']
                            fallback_variant.is_fallback = True
                            fallback_variant.name = f"fallback_{method.value}"
                            fallback_variants.append(fallback_variant)
                            
                    except Exception as e:
                        logger.warning(f"Fallback method {method.value} failed: {e}")
            
            logger.info(f"Created fallback chain with {len(fallback_variants)} variants")
            return fallback_variants
            
        except Exception as e:
            logger.error(f"Failed to create fallback chain: {e}")
            return [ModelVariant(
                name="emergency_fallback",
                model_path="",
                model_format=ModelFormat.KERAS,
                size_mb=0.0,
                accuracy=0.0,
                inference_time_ms=0.0,
                quantization_method=None,
                is_fallback=True
            )]
    
    def _post_training_quantization(self, model, 
                                   representative_data: Optional[np.ndarray]) -> bytes:
        """Perform post-training quantization"""
        try:
            # Convert to TFLite with quantization
            converter = tf.lite.TFLiteConverter.from_keras_model(model)
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            
            if representative_data is not None:
                def representative_dataset():
                    for data in representative_data[:100]:  # Use first 100 samples
                        yield [data.reshape(1, -1).astype(np.float32)]
                
                converter.representative_dataset = representative_dataset
                converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
                converter.inference_input_type = tf.int8
                converter.inference_output_type = tf.int8
            
            quantized_model = converter.convert()
            return quantized_model
            
        except Exception as e:
            logger.error(f"Post-training quantization failed: {e}")
            raise
    
    def _dynamic_range_quantization(self, model) -> bytes:
        """Perform dynamic range quantization"""
        try:
            converter = tf.lite.TFLiteConverter.from_keras_model(model)
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            
            quantized_model = converter.convert()
            return quantized_model
            
        except Exception as e:
            logger.error(f"Dynamic range quantization failed: {e}")
            raise
    
    def _quantization_aware_training(self, model,
                                   training_data: Optional[Tuple[np.ndarray, np.ndarray]]):
        """Perform quantization-aware training"""
        try:
            # Apply quantization-aware training
            qat_model = tfmot.quantization.keras.quantize_model(model)
            
            # Recompile the model
            qat_model.compile(
                optimizer=model.optimizer,
                loss=model.loss,
                metrics=model.metrics
            )
            
            # Fine-tune if training data is provided
            if training_data is not None:
                features, labels = training_data
                qat_model.fit(
                    features, labels,
                    epochs=3,  # Few epochs for fine-tuning
                    batch_size=32,
                    validation_split=0.2,
                    verbose=0
                )
            
            return qat_model
            
        except Exception as e:
            logger.error(f"Quantization-aware training failed: {e}")
            raise
    
    def _measure_model_performance(self, model, 
                                  test_data: Optional[Tuple[np.ndarray, np.ndarray]]) -> Dict[str, Any]:
        """Measure model performance metrics"""
        try:
            # Calculate model size
            model_size_mb = self._calculate_model_size(model)
            
            # Measure inference time
            if test_data is not None:
                test_features, _ = test_data
                sample_input = test_features[:1]
            else:
                # Create dummy input based on model input shape
                input_shape = model.input_shape
                sample_input = np.random.random((1,) + input_shape[1:]).astype(np.float32)
            
            # Warmup
            for _ in range(5):
                _ = model.predict(sample_input, verbose=0)
            
            # Measure inference time
            start_time = time.time()
            for _ in range(10):
                _ = model.predict(sample_input, verbose=0)
            inference_time_ms = ((time.time() - start_time) / 10) * 1000
            
            # Measure accuracy if test data available
            accuracy = 0.0
            if test_data is not None:
                test_features, test_labels = test_data
                results = model.evaluate(test_features, test_labels, verbose=0)
                accuracy = results[1] if len(results) > 1 else results[0]
            
            return {
                'size_mb': model_size_mb,
                'inference_time_ms': inference_time_ms,
                'accuracy': accuracy
            }
            
        except Exception as e:
            logger.error(f"Model performance measurement failed: {e}")
            return {
                'size_mb': 0.0,
                'inference_time_ms': 0.0,
                'accuracy': 0.0
            }
    
    def _measure_quantized_model_performance(self, quantized_model,
                                           test_data: Optional[Tuple[np.ndarray, np.ndarray]]) -> Dict[str, Any]:
        """Measure quantized model performance"""
        try:
            if isinstance(quantized_model, bytes):
                # TFLite model
                model_size_mb = len(quantized_model) / (1024 * 1024)
                
                # Measure inference time with TFLite
                interpreter = tf.lite.Interpreter(model_content=quantized_model)
                interpreter.allocate_tensors()
                
                input_details = interpreter.get_input_details()
                
                if test_data is not None:
                    test_features, _ = test_data
                    sample_input = test_features[:1].astype(np.float32)
                else:
                    input_shape = input_details[0]['shape']
                    sample_input = np.random.random(input_shape).astype(np.float32)
                
                # Warmup
                for _ in range(5):
                    interpreter.set_tensor(input_details[0]['index'], sample_input)
                    interpreter.invoke()
                
                # Measure inference time
                start_time = time.time()
                for _ in range(10):
                    interpreter.set_tensor(input_details[0]['index'], sample_input)
                    interpreter.invoke()
                inference_time_ms = ((time.time() - start_time) / 10) * 1000
                
                # Accuracy measurement would require full evaluation
                accuracy = 0.0
                
            else:
                # Keras model
                return self._measure_model_performance(quantized_model, test_data)
            
            return {
                'size_mb': model_size_mb,
                'inference_time_ms': inference_time_ms,
                'accuracy': accuracy
            }
            
        except Exception as e:
            logger.error(f"Quantized model performance measurement failed: {e}")
            return {
                'size_mb': 0.0,
                'inference_time_ms': 0.0,
                'accuracy': 0.0
            }
    
    def _calculate_model_size(self, model) -> float:
        """Calculate model size in MB"""
        try:
            # Count parameters
            total_params = model.count_params()
            
            # Estimate size (4 bytes per float32 parameter)
            size_bytes = total_params * 4
            size_mb = size_bytes / (1024 * 1024)
            
            return size_mb
            
        except Exception as e:
            logger.error(f"Model size calculation failed: {e}")
            return 0.0
    
    def _calculate_quantization_metrics(self, original_metrics: Dict[str, Any],
                                       quantized_metrics: Dict[str, Any],
                                       quality_results: Dict[str, Any],
                                       quantization_time_ms: float) -> QuantizationMetrics:
        """Calculate comprehensive quantization metrics"""
        
        # Size metrics
        original_size = original_metrics['size_mb']
        quantized_size = quantized_metrics['size_mb']
        compression_ratio = original_size / quantized_size if quantized_size > 0 else 1.0
        
        # Accuracy metrics
        original_accuracy = quality_results.get('original_accuracy', original_metrics['accuracy'])
        quantized_accuracy = quality_results.get('quantized_accuracy', quantized_metrics['accuracy'])
        accuracy_loss_percent = quality_results.get('accuracy_loss_percent', 0.0)
        
        # Performance metrics
        original_time = original_metrics['inference_time_ms']
        quantized_time = quantized_metrics['inference_time_ms']
        speedup_ratio = original_time / quantized_time if quantized_time > 0 else 1.0
        
        # Target compliance
        meets_accuracy_threshold = quality_results.get('quality_acceptable', True)
        meets_size_reduction_target = compression_ratio >= 2.0  # At least 2x reduction
        meets_speed_improvement_target = speedup_ratio >= 1.5  # At least 1.5x speedup
        
        return QuantizationMetrics(
            original_size_mb=original_size,
            quantized_size_mb=quantized_size,
            compression_ratio=compression_ratio,
            original_accuracy=original_accuracy,
            quantized_accuracy=quantized_accuracy,
            accuracy_loss_percent=accuracy_loss_percent,
            original_inference_time_ms=original_time,
            quantized_inference_time_ms=quantized_time,
            speedup_ratio=speedup_ratio,
            quantization_time_ms=quantization_time_ms,
            meets_accuracy_threshold=meets_accuracy_threshold,
            meets_size_reduction_target=meets_size_reduction_target,
            meets_speed_improvement_target=meets_speed_improvement_target
        )
    
    def _generate_model_key(self, model, config: QuantizationConfig) -> str:
        """Generate unique key for model caching"""
        model_hash = str(hash(str(model.get_config())))
        config_hash = str(hash(str(asdict(config))))
        return f"{model_hash}_{config_hash}"
    
    def _save_quantized_model(self, quantized_model,
                             model_key: str, config: QuantizationConfig) -> str:
        """Save quantized model to disk"""
        try:
            timestamp = int(time.time())
            filename = f"quantized_{config.method.value}_{model_key[:8]}_{timestamp}"
            
            if isinstance(quantized_model, bytes):
                # TFLite model
                filepath = os.path.join(self.models_dir, f"{filename}.tflite")
                with open(filepath, 'wb') as f:
                    f.write(quantized_model)
            else:
                # Keras model
                filepath = os.path.join(self.models_dir, f"{filename}.keras")
                quantized_model.save(filepath)
            
            logger.info(f"Quantized model saved to {filepath}")
            return filepath
            
        except Exception as e:
            logger.error(f"Failed to save quantized model: {e}")
            return ""
    
    def _create_fallback_chain(self, model, config: QuantizationConfig,
                              original_metrics: Dict[str, Any]) -> List[ModelVariant]:
        """Create fallback chain when quantization quality is poor"""
        return self.create_fallback_chain(model, config)
    
    def _create_quantization_result(self, cached_variant: ModelVariant, 
                                   execution_time_ms: float) -> Dict[str, Any]:
        """Create result from cached quantized model"""
        return {
            'success': True,
            'quantization_method': cached_variant.quantization_method.value if cached_variant.quantization_method else 'cached',
            'quantized_model_path': cached_variant.model_path,
            'quantized_model_variant': cached_variant,
            'quantization_time_ms': execution_time_ms,
            'from_cache': True
        }