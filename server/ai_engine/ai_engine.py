"""
AI Engine - Central coordinator for neural network learning and strategy generation
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List

from .neural_network import QueenBehaviorNetwork
from .death_analyzer import DeathAnalyzer
from .player_behavior import PlayerBehaviorAnalyzer
from .strategy_generator import StrategyGenerator
from .memory_manager import QueenMemoryManager
from .adaptive_difficulty import AdaptiveDifficultySystem
from .data_models import QueenDeathData, QueenStrategy
from .error_recovery import ErrorRecoveryManager
from .data_validator import DataValidator

logger = logging.getLogger(__name__)


class AIEngine:
    """
    Central AI Engine that coordinates all neural network learning and strategy generation
    """
    
    def __init__(self):
        self.neural_network: Optional[QueenBehaviorNetwork] = None
        self.death_analyzer: Optional[DeathAnalyzer] = None
        self.player_behavior: Optional[PlayerBehaviorAnalyzer] = None
        self.strategy_generator: Optional[StrategyGenerator] = None
        self.memory_manager: Optional[QueenMemoryManager] = None
        self.adaptive_difficulty: Optional[AdaptiveDifficultySystem] = None
        self.error_recovery: Optional[ErrorRecoveryManager] = None
        self.data_validator: Optional[DataValidator] = None
        self.initialized = False
        
    async def initialize(self):
        """Initialize all AI Engine components with error recovery"""
        try:
            logger.info("Initializing AI Engine components...")
            
            # Initialize error recovery and data validation first
            self.error_recovery = ErrorRecoveryManager()
            self.data_validator = DataValidator()
            logger.info("Error recovery and data validation initialized")
            
            # Initialize neural network with GPU acceleration
            try:
                self.neural_network = QueenBehaviorNetwork()
                logger.info(f"Neural network initialized (GPU: {self.neural_network.use_gpu})")
            except Exception as nn_error:
                logger.error(f"Neural network initialization failed: {nn_error}")
                # Use error recovery for neural network initialization
                recovery_result = await self.error_recovery.handle_neural_network_error(
                    nn_error, 
                    {'operation': 'initialization', 'component': 'neural_network'}
                )
                if recovery_result['success']:
                    logger.info("Neural network recovered successfully")
                else:
                    logger.warning("Neural network recovery failed, continuing with degraded functionality")
            
            # Initialize analysis components
            self.death_analyzer = DeathAnalyzer()
            self.player_behavior = PlayerBehaviorAnalyzer()
            self.strategy_generator = StrategyGenerator()
            self.memory_manager = QueenMemoryManager()
            self.adaptive_difficulty = AdaptiveDifficultySystem()
            
            logger.info("All AI Engine components initialized successfully")
            self.initialized = True
            
        except Exception as e:
            logger.error(f"Failed to initialize AI Engine: {e}")
            # Try to recover from initialization failure
            if self.error_recovery:
                recovery_result = await self.error_recovery.handle_neural_network_error(
                    e, 
                    {'operation': 'initialization', 'component': 'ai_engine'}
                )
                if recovery_result['success']:
                    self.initialized = True
                    logger.info("AI Engine initialization recovered")
                else:
                    raise
            else:
                raise
    
    async def process_queen_death(self, death_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process Queen death data and generate new strategy for next generation
        Enhanced with error recovery and data validation
        
        Args:
            death_data: Dictionary containing Queen death information
            
        Returns:
            Dictionary containing new strategy and learning insights
        """
        if not self.initialized:
            raise RuntimeError("AI Engine not initialized")
        
        try:
            logger.info(f"Processing Queen death for generation {death_data.get('generation', 'unknown')}")
            
            # Validate and sanitize input data
            is_valid, validation_error = self.data_validator.validate_data(death_data, 'queen_death')
            if not is_valid:
                logger.warning(f"Death data validation failed: {validation_error}")
                # Attempt to sanitize the data
                death_data = self.data_validator.sanitize_data(death_data, 'queen_death')
                logger.info("Death data sanitized successfully")
            
            # Check for data corruption
            is_corrupted, corruption_issues = self.data_validator.detect_corruption(death_data, 'queen_death')
            if is_corrupted:
                logger.warning(f"Data corruption detected: {corruption_issues}")
                # Attempt to recover corrupted data
                death_data = self.data_validator.recover_corrupted_data(death_data, 'queen_death')
                logger.info("Corrupted data recovered successfully")
            
            # Backup the validated data
            self.data_validator.backup_data(death_data, 'queen_death', death_data.get('queen_id'))
            
            # Convert dict to structured data
            queen_death = QueenDeathData.from_dict(death_data)
            
            # Analyze death circumstances with error handling
            try:
                death_analysis = await self.death_analyzer.analyze_death(queen_death)
                logger.info("Death analysis completed")
            except Exception as analysis_error:
                logger.error(f"Death analysis failed: {analysis_error}")
                # Use error recovery for analysis failure
                recovery_result = await self.error_recovery.handle_neural_network_error(
                    analysis_error,
                    {'operation': 'death_analysis', 'death_data': death_data}
                )
                if recovery_result['success']:
                    death_analysis = recovery_result.get('result', {})
                else:
                    # Use minimal analysis as fallback
                    death_analysis = self._create_minimal_death_analysis(queen_death)
            
            # Update player behavior model with error handling
            try:
                await self.player_behavior.update_patterns(queen_death.game_state)
                logger.info("Player behavior patterns updated")
            except Exception as behavior_error:
                logger.warning(f"Player behavior update failed: {behavior_error}")
                # Continue without player behavior update
            
            # Train neural network on failure with comprehensive error handling
            training_result = None
            try:
                training_data = await self._prepare_training_data(death_analysis, queen_death)
                
                # Validate training data
                is_valid, validation_error = self.data_validator.validate_data(training_data, 'training_data')
                if not is_valid:
                    logger.warning(f"Training data validation failed: {validation_error}")
                    training_data = self.data_validator.sanitize_data(training_data, 'training_data')
                
                training_result = await self.neural_network.train_on_failure(training_data)
                logger.info(f"Neural network training completed: {training_result}")
                
            except Exception as training_error:
                logger.error(f"Neural network training failed: {training_error}")
                # Use error recovery for training failure
                recovery_result = await self.error_recovery.handle_neural_network_error(
                    training_error,
                    {
                        'operation': 'train_on_failure',
                        'training_data': training_data if 'training_data' in locals() else {},
                        'death_data': death_data,
                        'generation': queen_death.generation
                    }
                )
                
                if recovery_result['success']:
                    training_result = recovery_result.get('result', {})
                    logger.info("Neural network training recovered successfully")
                else:
                    # Use fallback training result
                    training_result = {
                        'success': False,
                        'training_time': 0,
                        'accuracy': 0.5,
                        'method': 'fallback',
                        'error_recovery': True
                    }
                    logger.warning("Using fallback training result")
            
            # Generate new strategy for next generation with difficulty adjustment
            try:
                difficulty_modifiers = self.adaptive_difficulty.get_difficulty_modifiers()
                new_strategy = await self.strategy_generator.generate_strategy(
                    generation=queen_death.generation + 1,
                    learned_patterns=self.player_behavior.get_patterns(),
                    death_lessons=death_analysis,
                    difficulty_modifiers=difficulty_modifiers
                )
                logger.info(f"New strategy generated for generation {queen_death.generation + 1}")
                
                # Validate generated strategy
                strategy_dict = new_strategy.to_dict()
                is_valid, validation_error = self.data_validator.validate_data(strategy_dict, 'strategy')
                if not is_valid:
                    logger.warning(f"Generated strategy validation failed: {validation_error}")
                    strategy_dict = self.data_validator.sanitize_data(strategy_dict, 'strategy')
                    new_strategy = QueenStrategy.from_dict(strategy_dict)
                
            except Exception as strategy_error:
                logger.error(f"Strategy generation failed: {strategy_error}")
                # Use fallback strategy generation
                new_strategy = self._create_fallback_strategy(queen_death.generation + 1)
                logger.warning("Using fallback strategy generation")
            
            # Store learning data in memory with territory context
            try:
                await self.memory_manager.store_generation_data(
                    generation=queen_death.generation,
                    death_analysis=death_analysis,
                    strategy=new_strategy,
                    territory_id=queen_death.territory_id
                )
            except Exception as memory_error:
                logger.warning(f"Memory storage failed: {memory_error}")
                # Continue without memory storage
            
            # Return strategy and insights
            return {
                "type": "queen_strategy",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "queenId": queen_death.queen_id,
                    "generation": queen_death.generation + 1,
                    "strategies": new_strategy.to_dict(),
                    "learningInsights": {
                        "deathCause": death_analysis.primary_cause if hasattr(death_analysis, 'primary_cause') else 'unknown',
                        "survivalImprovement": death_analysis.survival_improvement if hasattr(death_analysis, 'survival_improvement') else 0,
                        "playerPatterns": self.player_behavior.get_summary() if self.player_behavior else {},
                        "trainingMetrics": training_result or {}
                    },
                    "estimatedTrainingTime": training_result.get("training_time", 0) if training_result else 0,
                    "difficultyLevel": self.adaptive_difficulty.get_current_difficulty_level(),
                    "difficultyModifiers": self.adaptive_difficulty.get_difficulty_modifiers(),
                    "errorRecoveryApplied": training_result.get('error_recovery', False) if training_result else False
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing Queen death: {e}")
            # Final error recovery attempt
            if self.error_recovery:
                recovery_result = await self.error_recovery.handle_neural_network_error(
                    e,
                    {'operation': 'process_queen_death', 'death_data': death_data}
                )
                if recovery_result['success']:
                    return recovery_result.get('result', {})
            
            # Return error response if all recovery attempts fail
            return {
                "type": "error",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "error": str(e),
                    "errorCode": "PROCESSING_FAILED",
                    "queenId": death_data.get('queen_id', 'unknown'),
                    "generation": death_data.get('generation', 1)
                }
            }
    
    async def _prepare_training_data(self, death_analysis, queen_death) -> Dict[str, Any]:
        """Prepare enhanced training data for neural network with generation context"""
        return {
            "game_state_features": death_analysis.game_state_features,
            "player_pattern_features": self.player_behavior.get_feature_vector(),
            "death_analysis_features": death_analysis.feature_vector,
            "generation_features": self._encode_generation_context(queen_death.generation),
            "reward_signal": -1.0,  # Negative reward for death
            "strategy_labels": death_analysis.failed_strategies,
            "generation": queen_death.generation,
            # Additional context for enhanced feature encoding
            "game_state": death_analysis.to_dict(),
            "player_patterns": self.player_behavior.get_patterns().to_dict(),
            "death_cause": queen_death.death_cause,
            "survival_time": queen_death.survival_time,
            "parasites_spawned": queen_death.parasites_spawned,
            "hive_discovery_time": queen_death.hive_discovery_time,
            "assault_pattern": queen_death.assault_pattern
        }
    
    def _encode_generation_context(self, generation: int) -> List[float]:
        """Encode generation context for neural network training"""
        complexity_level = min(1.0, 0.1 + (generation - 1) * 0.05)
        
        return [
            generation / 20.0,  # Normalized generation
            complexity_level,   # Complexity level
            1.0 if generation <= 3 else 0.0,  # Basic phase
            1.0 if 4 <= generation <= 7 else 0.0,  # Tactical phase
            1.0 if generation >= 8 else 0.0   # Strategic phase
        ]
    
    async def process_queen_success(self, success_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process successful Queen strategy data for positive reinforcement learning
        
        Args:
            success_data: Dictionary containing successful strategy information
            
        Returns:
            Dictionary containing training results and insights
        """
        if not self.initialized:
            raise RuntimeError("AI Engine not initialized")
        
        try:
            logger.info(f"Processing Queen success for generation {success_data.get('generation', 'unknown')}")
            
            # Prepare training data for success reinforcement
            training_data = {
                "generation": success_data.get('generation', 1),
                "reward_signal": 1.0,  # Positive reward for success
                "strategy_labels": success_data.get('successful_strategies', []),
                "game_state": success_data.get('game_state', {}),
                "player_patterns": self.player_behavior.get_patterns().to_dict(),
                "survival_time": success_data.get('survival_time', 0),
                "strategic_effectiveness": success_data.get('effectiveness', 1.0)
            }
            
            # Train neural network on success
            training_result = await self.neural_network.train_on_success(training_data)
            logger.info(f"Success reinforcement training completed: {training_result}")
            
            # Update memory with successful patterns
            await self.memory_manager.store_success_data(
                generation=success_data.get('generation', 1),
                success_data=success_data,
                training_result=training_result
            )
            
            return {
                "type": "success_training_result",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "generation": success_data.get('generation', 1),
                    "training_metrics": training_result,
                    "reinforcement_type": "positive"
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing Queen success: {e}")
            raise
    
    async def get_learning_progress(self, queen_id: str) -> Dict[str, Any]:
        """Get current learning progress for a Queen"""
        if not self.initialized:
            return {"error": "AI Engine not initialized"}
        
        try:
            progress = await self.memory_manager.get_learning_progress(queen_id)
            return {
                "type": "learning_progress",
                "data": progress
            }
        except Exception as e:
            logger.error(f"Error getting learning progress: {e}")
            return {"error": str(e)}
    
    async def process_game_outcome(self, outcome_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process game outcome for difficulty adjustment and learning
        
        Args:
            outcome_data: Dictionary containing game outcome information
            
        Returns:
            Dictionary containing difficulty adjustment results
        """
        if not self.initialized:
            raise RuntimeError("AI Engine not initialized")
        
        try:
            logger.info(f"Processing game outcome for difficulty adjustment")
            
            # Update adaptive difficulty system
            difficulty_result = await self.adaptive_difficulty.update_player_performance(outcome_data)
            
            # Get updated difficulty insights
            difficulty_insights = self.adaptive_difficulty.get_difficulty_insights()
            
            return {
                "type": "difficulty_adjustment",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "difficultyResult": difficulty_result,
                    "difficultyInsights": difficulty_insights,
                    "currentDifficulty": self.adaptive_difficulty.get_current_difficulty_level(),
                    "difficultyModifiers": self.adaptive_difficulty.get_difficulty_modifiers()
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing game outcome: {e}")
            raise
    
    async def get_difficulty_status(self) -> Dict[str, Any]:
        """Get current difficulty system status"""
        if not self.initialized:
            return {"error": "AI Engine not initialized"}
        
        try:
            return {
                "type": "difficulty_status",
                "data": {
                    "currentDifficulty": self.adaptive_difficulty.get_current_difficulty_level(),
                    "difficultyModifiers": self.adaptive_difficulty.get_difficulty_modifiers(),
                    "difficultyInsights": self.adaptive_difficulty.get_difficulty_insights()
                }
            }
        except Exception as e:
            logger.error(f"Error getting difficulty status: {e}")
            return {"error": str(e)}
    
    async def cleanup(self):
        """Cleanup AI Engine resources"""
        logger.info("Cleaning up AI Engine...")
        
        if self.memory_manager:
            await self.memory_manager.cleanup()
        
        if self.neural_network:
            await self.neural_network.cleanup()
        
        if self.error_recovery:
            await self.error_recovery.cleanup()
        
        if self.data_validator:
            await self.data_validator.cleanup()
        
        logger.info("AI Engine cleanup completed")
    
    def _create_minimal_death_analysis(self, queen_death: QueenDeathData) -> Any:
        """Create minimal death analysis when full analysis fails"""
        class MinimalDeathAnalysis:
            def __init__(self, queen_death):
                self.primary_cause = queen_death.death_cause
                self.survival_improvement = 0
                self.game_state_features = [0.5] * 20
                self.feature_vector = [0.5] * 10
                self.failed_strategies = []
            
            def to_dict(self):
                return {
                    'primary_cause': self.primary_cause,
                    'survival_improvement': self.survival_improvement,
                    'analysis_type': 'minimal_fallback'
                }
        
        return MinimalDeathAnalysis(queen_death)
    
    def _create_fallback_strategy(self, generation: int) -> QueenStrategy:
        """Create fallback strategy when strategy generation fails"""
        from .data_models import QueenStrategy
        
        # Create basic strategy based on generation
        complexity = min(1.0, 0.1 + (generation - 1) * 0.05)
        
        strategy_data = {
            'generation': generation,
            'hive_placement': {
                'strategy': 'balanced_placement',
                'parameters': {'complexity': complexity}
            },
            'parasite_spawning': {
                'strategy': 'standard_spawning',
                'parameters': {'complexity': complexity}
            },
            'defensive_coordination': {
                'strategy': 'basic_defense',
                'parameters': {'complexity': complexity}
            },
            'complexity_level': complexity
        }
        
        if generation >= 4:
            strategy_data['predictive_behavior'] = {
                'enabled': True,
                'strategy': 'basic_prediction',
                'parameters': {'complexity': complexity}
            }
        
        return QueenStrategy.from_dict(strategy_data)