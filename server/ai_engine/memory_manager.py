"""
Memory Manager - Manages learning data and Queen memory across generations
"""

import asyncio
import logging
import json
import os
from typing import Dict, Any, List, Optional
from .data_models import DeathAnalysis, QueenStrategy

logger = logging.getLogger(__name__)


class QueenMemoryManager:
    """
    Manages Queen memory and learning data across generations
    """
    
    def __init__(self):
        self.memory_storage = {}  # In-memory storage
        self.generation_data = {}  # Generation-specific data
        self.max_generations = 10  # Rolling window size
        self.storage_path = "data/queen_memory"
        self._ensure_storage_directory()
    
    def _ensure_storage_directory(self):
        """Ensure storage directory exists"""
        os.makedirs(self.storage_path, exist_ok=True)
    
    async def store_generation_data(self, generation: int, death_analysis: DeathAnalysis, 
                                   strategy: QueenStrategy):
        """
        Store learning data for a generation
        
        Args:
            generation: Generation number
            death_analysis: Analysis of the death that ended this generation
            strategy: Strategy generated for next generation
        """
        try:
            logger.info(f"Storing generation {generation} data")
            
            generation_data = {
                "generation": generation,
                "timestamp": asyncio.get_event_loop().time(),
                "death_analysis": death_analysis.to_dict(),
                "next_strategy": strategy.to_dict(),
                "learning_metrics": {
                    "survival_time": death_analysis.temporal_insights.get("survival_time", 0),
                    "improvement_score": death_analysis.survival_improvement,
                    "strategy_effectiveness": self._calculate_strategy_effectiveness(death_analysis)
                }
            }
            
            # Store in memory
            self.generation_data[generation] = generation_data
            
            # Maintain rolling window
            await self._cleanup_old_generations()
            
            # Persist to disk
            await self._save_to_disk(generation, generation_data)
            
            logger.info(f"Generation {generation} data stored successfully")
            
        except Exception as e:
            logger.error(f"Error storing generation data: {e}")
            raise
    
    async def get_learning_progress(self, queen_id: str) -> Dict[str, Any]:
        """
        Get learning progress for a Queen
        
        Args:
            queen_id: Queen identifier
            
        Returns:
            Learning progress information
        """
        try:
            current_generation = max(self.generation_data.keys()) if self.generation_data else 1
            
            # Calculate progress metrics
            progress_metrics = await self._calculate_progress_metrics()
            
            return {
                "queen_id": queen_id,
                "current_generation": current_generation,
                "total_generations": len(self.generation_data),
                "learning_phase": self._determine_learning_phase(current_generation),
                "progress_metrics": progress_metrics,
                "recent_improvements": await self._get_recent_improvements(),
                "next_strategy_preview": await self._get_next_strategy_preview(current_generation)
            }
            
        except Exception as e:
            logger.error(f"Error getting learning progress: {e}")
            return {"error": str(e)}
    
    async def _calculate_progress_metrics(self) -> Dict[str, Any]:
        """Calculate learning progress metrics"""
        if not self.generation_data:
            return {
                "survival_improvement": 0.0,
                "strategy_effectiveness": 0.0,
                "learning_rate": 0.0,
                "consistency": 0.0
            }
        
        generations = sorted(self.generation_data.keys())
        recent_generations = generations[-5:]  # Last 5 generations
        
        # Calculate survival improvement trend
        survival_times = []
        for gen in recent_generations:
            data = self.generation_data[gen]
            survival_time = data["learning_metrics"]["survival_time"]
            survival_times.append(survival_time)
        
        survival_improvement = 0.0
        if len(survival_times) > 1:
            survival_improvement = (survival_times[-1] - survival_times[0]) / max(survival_times[0], 1)
        
        # Calculate average strategy effectiveness
        effectiveness_scores = []
        for gen in recent_generations:
            data = self.generation_data[gen]
            effectiveness = data["learning_metrics"]["strategy_effectiveness"]
            effectiveness_scores.append(effectiveness)
        
        avg_effectiveness = sum(effectiveness_scores) / len(effectiveness_scores) if effectiveness_scores else 0.0
        
        return {
            "survival_improvement": max(-1.0, min(1.0, survival_improvement)),
            "strategy_effectiveness": avg_effectiveness,
            "learning_rate": self._calculate_learning_rate(recent_generations),
            "consistency": self._calculate_consistency(effectiveness_scores)
        }
    
    def _determine_learning_phase(self, generation: int) -> str:
        """Determine current learning phase"""
        if generation <= 2:
            return "initial_learning"
        elif generation <= 5:
            return "pattern_recognition"
        elif generation <= 10:
            return "strategy_refinement"
        else:
            return "advanced_adaptation"
    
    async def _get_recent_improvements(self) -> List[Dict[str, Any]]:
        """Get recent learning improvements"""
        improvements = []
        
        if len(self.generation_data) < 2:
            return improvements
        
        generations = sorted(self.generation_data.keys())[-3:]  # Last 3 generations
        
        for i, gen in enumerate(generations[1:], 1):
            prev_gen = generations[i-1]
            current_data = self.generation_data[gen]
            prev_data = self.generation_data[prev_gen]
            
            current_survival = current_data["learning_metrics"]["survival_time"]
            prev_survival = prev_data["learning_metrics"]["survival_time"]
            
            if current_survival > prev_survival:
                improvement = {
                    "generation": gen,
                    "improvement_type": "survival_time",
                    "improvement_value": current_survival - prev_survival,
                    "description": f"Survived {current_survival - prev_survival:.1f} seconds longer"
                }
                improvements.append(improvement)
        
        return improvements
    
    async def _get_next_strategy_preview(self, current_generation: int) -> Dict[str, Any]:
        """Get preview of next strategy"""
        if current_generation in self.generation_data:
            strategy_data = self.generation_data[current_generation]["next_strategy"]
            return {
                "generation": current_generation + 1,
                "complexity_level": strategy_data.get("complexity_level", 0.0),
                "key_adaptations": [
                    "Improved hive placement",
                    "Adaptive spawning timing",
                    "Enhanced defensive coordination"
                ],
                "estimated_effectiveness": 0.7 + (current_generation * 0.02)
            }
        
        return {
            "generation": current_generation + 1,
            "status": "generating",
            "estimated_completion": "60-120 seconds"
        }
    
    def _calculate_strategy_effectiveness(self, death_analysis: DeathAnalysis) -> float:
        """Calculate strategy effectiveness score"""
        # Placeholder implementation
        base_score = 0.5
        
        # Adjust based on survival improvement
        survival_bonus = death_analysis.survival_improvement * 0.3
        
        # Adjust based on parasites spawned
        spawn_effectiveness = min(1.0, death_analysis.get_parasites_spawned() / 20.0) * 0.2
        
        return min(1.0, base_score + survival_bonus + spawn_effectiveness)
    
    def _calculate_learning_rate(self, recent_generations: List[int]) -> float:
        """Calculate learning rate based on recent improvements"""
        if len(recent_generations) < 2:
            return 0.5
        
        # Placeholder implementation
        return min(1.0, len(recent_generations) / 10.0)
    
    def _calculate_consistency(self, effectiveness_scores: List[float]) -> float:
        """Calculate consistency of strategy effectiveness"""
        if len(effectiveness_scores) < 2:
            return 0.5
        
        # Calculate variance (lower variance = higher consistency)
        mean_score = sum(effectiveness_scores) / len(effectiveness_scores)
        variance = sum((score - mean_score) ** 2 for score in effectiveness_scores) / len(effectiveness_scores)
        
        # Convert variance to consistency score (0-1, higher is better)
        return max(0.0, 1.0 - variance)
    
    async def _cleanup_old_generations(self):
        """Remove old generation data to maintain rolling window"""
        if len(self.generation_data) > self.max_generations:
            generations = sorted(self.generation_data.keys())
            old_generations = generations[:-self.max_generations]
            
            for gen in old_generations:
                del self.generation_data[gen]
                # Also remove from disk
                file_path = os.path.join(self.storage_path, f"generation_{gen}.json")
                if os.path.exists(file_path):
                    os.remove(file_path)
            
            logger.info(f"Cleaned up {len(old_generations)} old generations")
    
    async def _save_to_disk(self, generation: int, data: Dict[str, Any]):
        """Save generation data to disk"""
        try:
            file_path = os.path.join(self.storage_path, f"generation_{generation}.json")
            
            # Convert data to JSON-serializable format
            serializable_data = self._make_serializable(data)
            
            with open(file_path, 'w') as f:
                json.dump(serializable_data, f, indent=2)
            
            logger.debug(f"Generation {generation} data saved to {file_path}")
            
        except Exception as e:
            logger.error(f"Error saving generation data to disk: {e}")
    
    def _make_serializable(self, data: Any) -> Any:
        """Convert data to JSON-serializable format"""
        if isinstance(data, dict):
            return {key: self._make_serializable(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [self._make_serializable(item) for item in data]
        elif hasattr(data, 'to_dict'):
            return data.to_dict()
        else:
            return data
    
    async def cleanup(self):
        """Cleanup memory manager resources"""
        logger.info("Cleaning up memory manager...")
        
        # Save all current data to disk
        for generation, data in self.generation_data.items():
            await self._save_to_disk(generation, data)
        
        # Clear memory
        self.generation_data.clear()
        self.memory_storage.clear()
        
        logger.info("Memory manager cleanup completed")