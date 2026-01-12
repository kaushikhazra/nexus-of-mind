"""
Neural Network implementation for Queen behavior learning using TensorFlow
"""

import asyncio
import logging
import os
import time
from typing import Dict, Any, List, Optional
import numpy as np

try:
    import tensorflow as tf
    from tensorflow import keras
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    tf = None
    keras = None

logger = logging.getLogger(__name__)


class QueenBehaviorNetwork:
    """
    TensorFlow neural network for learning Queen strategies and behaviors
    """
    
    def __init__(self):
        if not TENSORFLOW_AVAILABLE:
            raise ImportError("TensorFlow is required but not installed. Run: pip install tensorflow")
        
        self.model: Optional[keras.Model] = None
        self.use_gpu = False
        self.input_features = 50  # Game state, player patterns, death analysis
        self.output_strategies = 20  # Available strategies
        self.model_path = "models/queen_behavior_model"
        
        # Initialize GPU configuration
        self._configure_gpu_acceleration()
        
        # Create neural network architecture
        self._create_model()
    
    def _configure_gpu_acceleration(self) -> bool:
        """Configure GPU acceleration if CUDA is available"""
        try:
            # List available GPUs
            gpus = tf.config.experimental.list_physical_devices('GPU')
            
            if gpus:
                # Enable memory growth to prevent GPU memory allocation issues
                for gpu in gpus:
                    tf.config.experimental.set_memory_growth(gpu, True)
                
                # Set memory limit if specified in environment
                memory_limit = os.getenv('GPU_MEMORY_LIMIT')
                if memory_limit and gpus:
                    memory_limit_mb = int(memory_limit)
                    tf.config.experimental.set_memory_limit(gpus[0], memory_limit_mb)
                    logger.info(f"GPU memory limit set to {memory_limit_mb}MB")
                
                logger.info(f"GPU acceleration enabled: {len(gpus)} GPU(s) available")
                self.use_gpu = True
                return True
            else:
                logger.info("No GPU available, using CPU for neural network training")
                self.use_gpu = False
                return False
                
        except Exception as e:
            logger.warning(f"GPU configuration failed, falling back to CPU: {e}")
            self.use_gpu = False
            return False
    
    def _create_model(self):
        """Create the neural network architecture"""
        try:
            # Define the model architecture
            self.model = keras.Sequential([
                # Input layer: 50 features (game state, player patterns, death analysis)
                keras.layers.Dense(
                    128, 
                    activation='relu', 
                    input_shape=(self.input_features,),
                    name='input_layer'
                ),
                keras.layers.Dropout(0.2, name='dropout_1'),  # Prevent overfitting
                
                # Hidden layers with decreasing complexity
                keras.layers.Dense(64, activation='relu', name='hidden_1'),
                keras.layers.Dropout(0.2, name='dropout_2'),
                
                keras.layers.Dense(32, activation='relu', name='hidden_2'),
                
                # Output layer: 20 possible strategies
                keras.layers.Dense(
                    self.output_strategies, 
                    activation='softmax', 
                    name='output_layer'
                )
            ])
            
            # Compile with Adam optimizer for fast convergence
            self.model.compile(
                optimizer=keras.optimizers.Adam(learning_rate=0.001),
                loss='categorical_crossentropy',
                metrics=['accuracy', 'top_k_categorical_accuracy']
            )
            
            logger.info("Neural network model created successfully")
            logger.info(f"Model summary: {self.model.count_params()} parameters")
            
            # Try to load existing model if available
            self._load_model()
            
        except Exception as e:
            logger.error(f"Failed to create neural network model: {e}")
            raise
    
    async def train_on_failure(self, training_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Train the neural network on failure data
        
        Args:
            training_data: Dictionary containing features and labels
            
        Returns:
            Training results and metrics
        """
        try:
            start_time = time.time()
            
            # Prepare training data
            features = self._prepare_features(training_data)
            labels = self._prepare_labels(training_data)
            
            # Validate data shapes
            if features.shape[1] != self.input_features:
                raise ValueError(f"Feature dimension mismatch: expected {self.input_features}, got {features.shape[1]}")
            
            # Train the model
            history = await self._train_async(features, labels)
            
            training_time = time.time() - start_time
            
            # Save the updated model
            self._save_model()
            
            # Return training results
            return {
                "success": True,
                "training_time": training_time,
                "loss": float(history.history['loss'][-1]),
                "accuracy": float(history.history['accuracy'][-1]),
                "epochs_trained": len(history.history['loss']),
                "gpu_used": self.use_gpu
            }
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "training_time": 0,
                "gpu_used": self.use_gpu
            }
    
    async def _train_async(self, features: np.ndarray, labels: np.ndarray):
        """Asynchronous training wrapper"""
        loop = asyncio.get_event_loop()
        
        # Run training in thread pool to avoid blocking
        return await loop.run_in_executor(
            None,
            self._train_sync,
            features,
            labels
        )
    
    def _train_sync(self, features: np.ndarray, labels: np.ndarray):
        """Synchronous training implementation"""
        return self.model.fit(
            features,
            labels,
            epochs=10,  # Limited epochs for real-time training
            batch_size=32,
            validation_split=0.2,
            verbose=0,  # Suppress training output
            callbacks=[
                keras.callbacks.EarlyStopping(
                    monitor='val_loss',
                    patience=3,
                    restore_best_weights=True
                )
            ]
        )
    
    def _prepare_features(self, training_data: Dict[str, Any]) -> np.ndarray:
        """Prepare feature vector for training"""
        features = []
        
        # Game state features (20 features)
        game_state = training_data.get('game_state_features', [0] * 20)
        features.extend(game_state[:20])  # Ensure exactly 20 features
        
        # Player pattern features (15 features)
        player_patterns = training_data.get('player_pattern_features', [0] * 15)
        features.extend(player_patterns[:15])  # Ensure exactly 15 features
        
        # Death analysis features (10 features)
        death_analysis = training_data.get('death_analysis_features', [0] * 10)
        features.extend(death_analysis[:10])  # Ensure exactly 10 features
        
        # Generation features (5 features)
        generation_features = training_data.get('generation_features', [0] * 5)
        features.extend(generation_features[:5])  # Ensure exactly 5 features
        
        # Pad or truncate to exact feature count
        while len(features) < self.input_features:
            features.append(0.0)
        features = features[:self.input_features]
        
        return np.array([features], dtype=np.float32)
    
    def _prepare_labels(self, training_data: Dict[str, Any]) -> np.ndarray:
        """Prepare label vector for training"""
        # Create one-hot encoded strategy labels
        labels = np.zeros(self.output_strategies, dtype=np.float32)
        
        # Mark failed strategies with negative signal
        failed_strategies = training_data.get('strategy_labels', [])
        reward_signal = training_data.get('reward_signal', -1.0)
        
        # For failed strategies, we want to reduce their probability
        # This is done by creating inverse labels (what NOT to do)
        for strategy_idx in failed_strategies:
            if 0 <= strategy_idx < self.output_strategies:
                labels[strategy_idx] = abs(reward_signal)  # Positive value for what to avoid
        
        # Normalize labels
        if labels.sum() > 0:
            labels = labels / labels.sum()
        else:
            # If no specific failed strategies, distribute evenly
            labels.fill(1.0 / self.output_strategies)
        
        return np.array([labels], dtype=np.float32)
    
    def predict_strategy(self, features: np.ndarray) -> np.ndarray:
        """Predict strategy probabilities for given features"""
        if self.model is None:
            raise RuntimeError("Model not initialized")
        
        return self.model.predict(features, verbose=0)
    
    def _save_model(self):
        """Save the trained model to disk"""
        try:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            self.model.save(self.model_path)
            logger.info(f"Model saved to {self.model_path}")
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
    
    def _load_model(self):
        """Load existing model from disk"""
        try:
            if os.path.exists(self.model_path):
                self.model = keras.models.load_model(self.model_path)
                logger.info(f"Model loaded from {self.model_path}")
            else:
                logger.info("No existing model found, using fresh model")
        except Exception as e:
            logger.warning(f"Failed to load existing model: {e}")
    
    async def cleanup(self):
        """Cleanup neural network resources"""
        logger.info("Cleaning up neural network resources...")
        
        # Save model before cleanup
        if self.model:
            self._save_model()
        
        # Clear TensorFlow session
        if tf:
            tf.keras.backend.clear_session()
        
        logger.info("Neural network cleanup completed")