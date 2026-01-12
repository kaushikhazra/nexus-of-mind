"""
AI Engine - Central coordinator for neural network learning and strategy generation
"""

import asyncio
import logging
from typing import Dict, Any, Optional

from .neural_network import QueenBehaviorNetwork
from .death_analyzer import DeathAnalyzer
from .player_behavior import PlayerBehaviorAnalyzer
from .strategy_generator import StrategyGenerator
from .memory_manager import QueenMemoryManager
from .data_models import QueenDeathData, QueenStrategy

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
        self.initialized = False
        
    async def initialize(self):
        """Initialize all AI Engine components"""
        try:
            logger.info("Initializing AI Engine components...")
            
            # Initialize neural network with GPU acceleration
            self.neural_network = QueenBehaviorNetwork()
            logger.info(f"Neural network initialized (GPU: {self.neural_network.use_gpu})")
            
            # Initialize analysis components
            self.death_analyzer = DeathAnalyzer()
            self.player_behavior = PlayerBehaviorAnalyzer()
            self.strategy_generator = StrategyGenerator()
            self.memory_manager = QueenMemoryManager()
            
            logger.info("All AI Engine components initialized successfully")
            self.initialized = True
            
        except Exception as e:
            logger.error(f"Failed to initialize AI Engine: {e}")
            raise
    
    async def process_queen_death(self, death_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process Queen death data and generate new strategy for next generation
        
        Args:
            death_data: Dictionary containing Queen death information
            
        Returns:
            Dictionary containing new strategy and learning insights
        """
        if not self.initialized:
            raise RuntimeError("AI Engine not initialized")
        
        try:
            logger.info(f"Processing Queen death for generation {death_data.get('generation', 'unknown')}")
            
            # Convert dict to structured data
            queen_death = QueenDeathData.from_dict(death_data)
            
            # Analyze death circumstances
            death_analysis = await self.death_analyzer.analyze_death(queen_death)
            logger.info("Death analysis completed")
            
            # Update player behavior model
            await self.player_behavior.update_patterns(queen_death.game_state)
            logger.info("Player behavior patterns updated")
            
            # Train neural network on failure
            training_data = await self._prepare_training_data(death_analysis, queen_death)
            training_result = await self.neural_network.train_on_failure(training_data)
            logger.info(f"Neural network training completed: {training_result}")
            
            # Generate new strategy for next generation
            new_strategy = await self.strategy_generator.generate_strategy(
                generation=queen_death.generation + 1,
                learned_patterns=self.player_behavior.get_patterns(),
                death_lessons=death_analysis
            )
            logger.info(f"New strategy generated for generation {queen_death.generation + 1}")
            
            # Store learning data in memory
            await self.memory_manager.store_generation_data(
                generation=queen_death.generation,
                death_analysis=death_analysis,
                strategy=new_strategy
            )
            
            # Return strategy and insights
            return {
                "type": "queen_strategy",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "queenId": queen_death.queen_id,
                    "generation": queen_death.generation + 1,
                    "strategies": new_strategy.to_dict(),
                    "learningInsights": {
                        "deathCause": death_analysis.primary_cause,
                        "survivalImprovement": death_analysis.survival_improvement,
                        "playerPatterns": self.player_behavior.get_summary(),
                        "trainingMetrics": training_result
                    },
                    "estimatedTrainingTime": training_result.get("training_time", 0)
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing Queen death: {e}")
            raise
    
    async def _prepare_training_data(self, death_analysis, queen_death) -> Dict[str, Any]:
        """Prepare training data for neural network"""
        return {
            "game_state_features": death_analysis.game_state_features,
            "player_pattern_features": self.player_behavior.get_feature_vector(),
            "death_analysis_features": death_analysis.feature_vector,
            "generation_features": [queen_death.generation / 20.0],  # Normalized
            "reward_signal": -1.0,  # Negative reward for death
            "strategy_labels": death_analysis.failed_strategies
        }
    
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
    
    async def cleanup(self):
        """Cleanup AI Engine resources"""
        logger.info("Cleaning up AI Engine...")
        
        if self.memory_manager:
            await self.memory_manager.cleanup()
        
        if self.neural_network:
            await self.neural_network.cleanup()
        
        logger.info("AI Engine cleanup completed")