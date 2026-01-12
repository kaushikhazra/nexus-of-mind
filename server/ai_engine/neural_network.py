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

from .performance_monitor import PerformanceMonitor

logger = logging.getLogger(__name__)


class ConvergenceMonitor(keras.callbacks.Callback):
    """Custom callback to monitor training convergence"""
    
    def __init__(self, patience=3, min_delta=0.001, monitor='val_loss'):
        super().__init__()
        self.patience = patience
        self.min_delta = min_delta
        self.monitor = monitor
        self.best_loss = float('inf')
        self.wait = 0
        self.converged = False
    
    def on_epoch_end(self, epoch, logs=None):
        current_loss = logs.get(self.monitor, float('inf'))
        
        if current_loss < self.best_loss - self.min_delta:
            self.best_loss = current_loss
            self.wait = 0
        else:
            self.wait += 1
            
        if self.wait >= self.patience:
            self.converged = True
            logger.info(f"Convergence achieved at epoch {epoch + 1}")
    
    def on_epoch_end(self, epoch, logs=None):
        current_loss = logs.get(self.monitor, float('inf'))
        
        if current_loss < self.best_loss - self.min_delta:
            self.best_loss = current_loss
            self.wait = 0
        else:
            self.wait += 1
            
        if self.wait >= self.patience:
            self.converged = True
            logger.info(f"Convergence achieved at epoch {epoch + 1}")


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
        self.model_path = "models/queen_behavior_model.keras"
        
        # Initialize performance monitoring
        self.performance_monitor = PerformanceMonitor()
        
        # Initialize GPU configuration
        self._configure_gpu_acceleration()
        
        # Create neural network architecture
        self._create_model()
        
        # Start performance monitoring (only if event loop is running)
        try:
            loop = asyncio.get_running_loop()
            asyncio.create_task(self.performance_monitor.start_monitoring())
        except RuntimeError:
            # No event loop running, skip async monitoring
            logger.info("No event loop running, skipping async performance monitoring")
    
    def _configure_gpu_acceleration(self) -> bool:
        """Configure GPU acceleration if CUDA is available with performance optimization"""
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
                
                # Enable mixed precision for better performance (if supported)
                try:
                    policy = tf.keras.mixed_precision.Policy('mixed_float16')
                    tf.keras.mixed_precision.set_global_policy(policy)
                    logger.info("Mixed precision enabled for GPU acceleration")
                except Exception as e:
                    logger.debug(f"Mixed precision not available: {e}")
                
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
                    name='dense_input'
                ),
                keras.layers.Dropout(0.2, name='dropout_input'),  # Prevent overfitting
                
                # Hidden layers with decreasing complexity
                keras.layers.Dense(64, activation='relu', name='dense_hidden_1'),
                keras.layers.Dropout(0.2, name='dropout_hidden_1'),
                
                keras.layers.Dense(32, activation='relu', name='dense_hidden_2'),
                
                # Output layer: 20 possible strategies
                keras.layers.Dense(
                    self.output_strategies, 
                    activation='softmax', 
                    name='dense_output'
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
        Train the neural network on failure data with performance monitoring
        
        Args:
            training_data: Dictionary containing features and labels
            
        Returns:
            Training results and metrics with performance data
        """
        try:
            # Use performance monitor for training session
            training_result = await self.performance_monitor.monitor_training_session(
                self._execute_training_on_failure, training_data
            )
            
            return training_result
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "training_time": 0,
                "gpu_used": self.use_gpu
            }
    
    def _execute_training_on_failure(self, training_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the actual training on failure (synchronous)"""
        start_time = time.time()
        
        # Prepare training data with enhanced feature encoding
        features = self._prepare_features(training_data)
        labels = self._prepare_labels(training_data)
        
        # Apply generation-based complexity scaling
        generation = training_data.get('generation', 1)
        training_config = self._get_training_config(generation)
        
        # Multiply training data to ensure longer training time
        multiplier = training_config.get('training_data_multiplier', 1)
        if multiplier > 1:
            # Duplicate training data with slight variations
            features_list = [features]
            labels_list = [labels]
            
            for i in range(multiplier - 1):
                # Add small noise to create variations
                noise_scale = 0.01
                noisy_features = features + np.random.normal(0, noise_scale, features.shape)
                noisy_features = np.clip(noisy_features, 0.0, 1.0)  # Keep in valid range
                
                features_list.append(noisy_features)
                labels_list.append(labels)
            
            features = np.vstack(features_list)
            labels = np.vstack(labels_list)
        
        # Validate data shapes
        if features.shape[1] != self.input_features:
            raise ValueError(f"Feature dimension mismatch: expected {self.input_features}, got {features.shape[1]}")
        
        # Apply performance optimizations from training config
        optimized_config = training_data.get('training_config', training_config)
        
        # Train the model with convergence monitoring
        history = self._train_with_monitoring_sync(features, labels, optimized_config)
        
        training_time = time.time() - start_time
        
        # Validate training time bounds (60-120 seconds requirement)
        if training_time > 120:
            logger.warning(f"Training time {training_time:.1f}s exceeded 120s limit")
        elif training_time < 60:
            logger.info(f"Training completed quickly in {training_time:.1f}s")
        
        # Save the updated model
        self._save_model()
        
        # Return enhanced training results
        return {
            "success": True,
            "training_time": training_time,
            "loss": float(history.history['loss'][-1]),
            "accuracy": float(history.history['accuracy'][-1]),
            "epochs_trained": len(history.history['loss']),
            "convergence_achieved": self._check_convergence(history),
            "generation_complexity": optimized_config.get('complexity_level', training_config['complexity_level']),
            "gpu_used": self.use_gpu,
            "training_config": optimized_config,
            "data_multiplier": multiplier,
            "training_samples": features.shape[0]
        }
    
    async def train_on_success(self, training_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Train the neural network on successful strategy data with performance monitoring
        
        Args:
            training_data: Dictionary containing features and labels for successful strategies
            
        Returns:
            Training results and metrics with performance data
        """
        try:
            # Use performance monitor for training session
            training_result = await self.performance_monitor.monitor_training_session(
                self._execute_training_on_success, training_data
            )
            
            return training_result
            
        except Exception as e:
            logger.error(f"Success training failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "training_time": 0,
                "gpu_used": self.use_gpu
            }
    
    def _execute_training_on_success(self, training_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the actual training on success (synchronous)"""
        start_time = time.time()
        
        # Prepare training data for success (positive rewards)
        training_data['reward_signal'] = 1.0  # Positive reward for success
        features = self._prepare_features(training_data)
        labels = self._prepare_success_labels(training_data)
        
        # Validate data shapes
        if features.shape[1] != self.input_features:
            raise ValueError(f"Feature dimension mismatch: expected {self.input_features}, got {features.shape[1]}")
        
        # Apply generation-based complexity scaling
        generation = training_data.get('generation', 1)
        training_config = self._get_training_config(generation)
        
        # Apply performance optimizations from training config
        optimized_config = training_data.get('training_config', training_config)
        
        # Train the model with convergence monitoring
        history = self._train_with_monitoring_sync(features, labels, optimized_config)
        
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
            "convergence_achieved": self._check_convergence(history),
            "generation_complexity": optimized_config.get('complexity_level', training_config['complexity_level']),
            "gpu_used": self.use_gpu,
            "training_type": "success_reinforcement"
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
    
    async def _train_with_convergence_monitoring(self, features: np.ndarray, labels: np.ndarray, 
                                               training_config: Dict[str, Any]):
        """Enhanced training with convergence monitoring and generation-based scaling"""
        loop = asyncio.get_event_loop()
        
        # Run enhanced training in thread pool
        return await loop.run_in_executor(
            None,
            self._train_with_monitoring_sync,
            features,
            labels,
            training_config
        )
    
    def _train_with_monitoring_sync(self, features: np.ndarray, labels: np.ndarray, 
                                  training_config: Dict[str, Any]):
        """Synchronous training with convergence monitoring"""
        # Determine validation split based on data size
        validation_split = 0.2 if features.shape[0] >= 5 else 0.0
        
        # Create convergence monitoring callback
        convergence_callback = ConvergenceMonitor(
            patience=training_config.get('patience', 3),
            min_delta=training_config.get('min_delta', 0.001),
            monitor=training_config.get('monitor', 'loss')  # Default to 'loss' if no validation
        )
        
        # Create learning rate scheduler for generation-based complexity
        monitor_metric = 'val_loss' if validation_split > 0 else 'loss'
        lr_scheduler = keras.callbacks.ReduceLROnPlateau(
            monitor=monitor_metric,
            factor=0.8,
            patience=2,
            min_lr=training_config.get('min_learning_rate', 0.0001)
        )
        
        callbacks = [
            keras.callbacks.EarlyStopping(
                monitor=monitor_metric,
                patience=training_config.get('patience', 3),
                restore_best_weights=True,
                min_delta=training_config.get('min_delta', 0.001)
            ),
            lr_scheduler,
            convergence_callback
        ]
        
        return self.model.fit(
            features,
            labels,
            epochs=training_config.get('max_epochs', 10),
            batch_size=min(training_config.get('batch_size', 32), features.shape[0]),
            validation_split=validation_split,
            verbose=0,  # Suppress training output
            callbacks=callbacks
        )
    
    def _get_training_config(self, generation: int) -> Dict[str, Any]:
        """Get generation-based training configuration with complexity scaling"""
        # Calculate complexity level (0.0 to 1.0)
        complexity_level = min(1.0, 0.1 + (generation - 1) * 0.05)
        
        # Base configuration designed to meet 60-120 second requirement
        base_config = {
            'complexity_level': complexity_level,
            'max_epochs': 50,  # Increased for longer training time
            'batch_size': 8,   # Smaller batch size for more iterations
            'patience': 10,    # More patience for convergence
            'min_delta': 0.0001,  # Stricter convergence criteria
            'monitor': 'val_loss',
            'min_learning_rate': 0.00001,  # Lower minimum learning rate
            'training_data_multiplier': 10  # Multiply training data for longer training
        }
        
        # Scale parameters based on generation complexity
        if complexity_level > 0.5:  # Advanced generations (6+)
            base_config.update({
                'max_epochs': 75,  # Even more training for complex strategies
                'patience': 15,    # More patience for convergence
                'min_delta': 0.00005,  # Even stricter convergence criteria
                'batch_size': 4,   # Smaller batches for better learning
                'training_data_multiplier': 15
            })
        
        if complexity_level > 0.8:  # Expert generations (16+)
            base_config.update({
                'max_epochs': 100,
                'patience': 20,
                'min_delta': 0.00001,
                'batch_size': 2,
                'training_data_multiplier': 20
            })
        
        return base_config
    
    def _check_convergence(self, history) -> bool:
        """Check if training achieved convergence"""
        if len(history.history['loss']) < 3:
            return False
        
        # Check if loss is decreasing and stabilizing
        recent_losses = history.history['loss'][-3:]
        loss_improvement = recent_losses[0] - recent_losses[-1]
        
        # Convergence if loss improved by at least 0.001 and is stable
        return loss_improvement > 0.001 and max(recent_losses) - min(recent_losses) < 0.01
    
    def _train_sync(self, features: np.ndarray, labels: np.ndarray):
        """Synchronous training implementation"""
        # Determine validation split based on data size
        validation_split = 0.2 if features.shape[0] >= 5 else 0.0
        
        return self.model.fit(
            features,
            labels,
            epochs=10,  # Limited epochs for real-time training
            batch_size=min(32, features.shape[0]),  # Adjust batch size for small datasets
            validation_split=validation_split,
            verbose=0,  # Suppress training output
            callbacks=[
                keras.callbacks.EarlyStopping(
                    monitor='val_loss' if validation_split > 0 else 'loss',
                    patience=3,
                    restore_best_weights=True
                )
            ]
        )
    
    def _prepare_features(self, training_data: Dict[str, Any]) -> np.ndarray:
        """Enhanced feature vector preparation with generation-based encoding"""
        features = []
        
        # Game state features (20 features) - Enhanced encoding
        game_state = training_data.get('game_state_features', [])
        if len(game_state) < 20:
            # Create enhanced game state features if not provided
            game_state = self._encode_game_state_features(training_data)
        features.extend(game_state[:20])  # Ensure exactly 20 features
        
        # Player pattern features (15 features) - Enhanced encoding
        player_patterns = training_data.get('player_pattern_features', [])
        if len(player_patterns) < 15:
            # Create enhanced player pattern features if not provided
            player_patterns = self._encode_player_pattern_features(training_data)
        features.extend(player_patterns[:15])  # Ensure exactly 15 features
        
        # Death analysis features (10 features) - Enhanced encoding
        death_analysis = training_data.get('death_analysis_features', [])
        if len(death_analysis) < 10:
            # Create enhanced death analysis features if not provided
            death_analysis = self._encode_death_analysis_features(training_data)
        features.extend(death_analysis[:10])  # Ensure exactly 10 features
        
        # Generation features (5 features) - Enhanced with complexity scaling
        generation_features = self._encode_generation_features(training_data)
        features.extend(generation_features[:5])  # Ensure exactly 5 features
        
        # Pad or truncate to exact feature count
        while len(features) < self.input_features:
            features.append(0.0)
        features = features[:self.input_features]
        
        # Normalize features to [0, 1] range
        features = np.array(features, dtype=np.float32)
        features = np.clip(features, 0.0, 1.0)
        
        return np.array([features], dtype=np.float32)
    
    def _encode_game_state_features(self, training_data: Dict[str, Any]) -> List[float]:
        """Encode game state into 20 normalized features"""
        features = [0.0] * 20
        
        # Extract game state data
        game_state = training_data.get('game_state', {})
        
        # Energy level (normalized to 0-1)
        features[0] = min(1.0, game_state.get('energy_level', 500) / 1000.0)
        
        # Player unit counts (normalized)
        player_units = game_state.get('player_units', {})
        features[1] = min(1.0, len(player_units.get('protectors', [])) / 20.0)
        features[2] = min(1.0, len(player_units.get('workers', [])) / 50.0)
        
        # Territory control (0-1)
        features[3] = game_state.get('territory_control_percentage', 0.5)
        
        # Mining activity (normalized)
        active_mining = game_state.get('active_mining', [])
        features[4] = min(1.0, len(active_mining) / 10.0)
        
        # Exploration progress (0-1)
        features[5] = game_state.get('exploration_percentage', 0.0)
        
        # Time-based features
        features[6] = min(1.0, training_data.get('survival_time', 0) / 600.0)  # Normalized to 10 minutes
        features[7] = min(1.0, training_data.get('hive_discovery_time', 0) / 300.0)  # Normalized to 5 minutes
        
        # Combat intensity
        features[8] = min(1.0, game_state.get('combat_intensity', 0.0))
        
        # Resource availability
        features[9] = min(1.0, game_state.get('resource_density', 0.5))
        
        # Remaining features filled with contextual data or defaults
        for i in range(10, 20):
            features[i] = 0.0  # Default values for unused features
        
        return features
    
    def _encode_player_pattern_features(self, training_data: Dict[str, Any]) -> List[float]:
        """Encode player behavior patterns into 15 normalized features"""
        features = [0.0] * 15
        
        # Extract player patterns if available
        patterns = training_data.get('player_patterns', {})
        
        # Aggression patterns
        features[0] = patterns.get('aggression_score', 0.5)
        features[1] = patterns.get('combat_frequency', 0.5)
        features[2] = patterns.get('assault_timing_preference', 0.5)
        
        # Economic patterns
        features[3] = patterns.get('economic_focus', 0.5)
        features[4] = patterns.get('expansion_rate', 0.5)
        features[5] = patterns.get('resource_efficiency', 0.5)
        
        # Exploration patterns
        features[6] = patterns.get('exploration_thoroughness', 0.5)
        features[7] = patterns.get('scouting_frequency', 0.5)
        
        # Tactical patterns
        features[8] = patterns.get('unit_coordination', 0.5)
        features[9] = patterns.get('formation_preference', 0.5)
        features[10] = patterns.get('flanking_tendency', 0.5)
        
        # Adaptive behavior
        features[11] = patterns.get('strategy_adaptation', 0.5)
        features[12] = patterns.get('learning_rate', 0.5)
        
        # Risk assessment
        features[13] = patterns.get('risk_tolerance', 0.5)
        features[14] = patterns.get('retreat_threshold', 0.5)
        
        return features
    
    def _encode_death_analysis_features(self, training_data: Dict[str, Any]) -> List[float]:
        """Encode death analysis into 10 normalized features"""
        features = [0.0] * 10
        
        # Death cause encoding (one-hot style)
        death_cause = training_data.get('death_cause', 'unknown')
        if death_cause == 'protector_assault':
            features[0] = 1.0
        elif death_cause == 'worker_infiltration':
            features[1] = 1.0
        elif death_cause == 'coordinated_attack':
            features[2] = 1.0
        
        # Survival metrics
        features[3] = min(1.0, training_data.get('survival_time', 0) / 600.0)
        features[4] = min(1.0, training_data.get('parasites_spawned', 0) / 100.0)
        
        # Discovery timing
        features[5] = min(1.0, training_data.get('hive_discovery_time', 0) / 300.0)
        
        # Assault pattern analysis
        assault_pattern = training_data.get('assault_pattern', {})
        features[6] = assault_pattern.get('directness', 0.5)
        features[7] = assault_pattern.get('coordination_level', 0.5)
        features[8] = assault_pattern.get('force_concentration', 0.5)
        
        # Strategic effectiveness
        features[9] = training_data.get('strategic_effectiveness', 0.0)
        
        return features
    
    def _encode_generation_features(self, training_data: Dict[str, Any]) -> List[float]:
        """Encode generation-based features with complexity scaling"""
        features = [0.0] * 5
        
        generation = training_data.get('generation', 1)
        complexity_level = min(1.0, 0.1 + (generation - 1) * 0.05)
        
        # Generation number (normalized to 0-1 for generations 1-20)
        features[0] = min(1.0, generation / 20.0)
        
        # Complexity level (0-1)
        features[1] = complexity_level
        
        # Learning phase indicators
        if generation <= 3:
            features[2] = 1.0  # Basic learning phase
        elif generation <= 7:
            features[3] = 1.0  # Tactical learning phase
        else:
            features[4] = 1.0  # Strategic learning phase
        
        return features
    
    def _prepare_success_labels(self, training_data: Dict[str, Any]) -> np.ndarray:
        """Prepare label vector for successful strategies (positive reinforcement)"""
        # Create one-hot encoded strategy labels
        labels = np.zeros(self.output_strategies, dtype=np.float32)
        
        # Mark successful strategies with positive signal
        successful_strategies = training_data.get('strategy_labels', [])
        reward_signal = training_data.get('reward_signal', 1.0)
        
        # For successful strategies, we want to increase their probability
        for strategy_idx in successful_strategies:
            if 0 <= strategy_idx < self.output_strategies:
                labels[strategy_idx] = reward_signal  # Positive value for what to reinforce
        
        # Normalize labels
        if labels.sum() > 0:
            labels = labels / labels.sum()
        else:
            # If no specific successful strategies, distribute evenly
            labels.fill(1.0 / self.output_strategies)
        
        return np.array([labels], dtype=np.float32)
    
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
        
        # Stop performance monitoring
        if hasattr(self, 'performance_monitor'):
            await self.performance_monitor.cleanup()
        
        # Save model before cleanup
        if self.model:
            self._save_model()
        
        # Clear TensorFlow session
        if tf:
            tf.keras.backend.clear_session()
        
        logger.info("Neural network cleanup completed")
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance monitoring summary"""
        if hasattr(self, 'performance_monitor'):
            return self.performance_monitor.get_performance_summary()
        else:
            return {'status': 'monitoring_not_available'}
    
    def get_optimization_recommendations(self) -> List[str]:
        """Get performance optimization recommendations"""
        if hasattr(self, 'performance_monitor'):
            return self.performance_monitor.get_optimization_recommendations()
        else:
            return ["Performance monitoring not available"]