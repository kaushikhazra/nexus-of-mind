"""
Memory Manager - Manages learning data and Queen memory across generations
"""

import asyncio
import logging
import json
import os
import gzip
import pickle
import time
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict
from .data_models import DeathAnalysis, QueenStrategy, PlayerPatterns

logger = logging.getLogger(__name__)


class QueenMemoryManager:
    """
    Enhanced Memory Manager for Queen learning data across generations
    
    Features:
    - Rolling window memory management (last 10 generations)
    - Data compression for player behavior patterns
    - Knowledge transfer between Queens in different territories
    - Memory cleanup and garbage collection
    - Prioritization of recent and successful learning
    """
    
    def __init__(self):
        self.memory_storage = {}  # In-memory storage
        self.generation_data = {}  # Generation-specific data
        self.territory_knowledge = defaultdict(dict)  # Territory-specific knowledge
        self.compressed_patterns = {}  # Compressed player behavior patterns
        self.knowledge_transfer_cache = {}  # Cache for knowledge transfer
        
        # Configuration
        self.max_generations = 10  # Rolling window size (Requirement 9.1)
        self.compression_threshold = 5  # Compress data older than 5 generations
        self.cleanup_interval = 300  # Cleanup every 5 minutes
        self.max_memory_mb = 200  # Maximum memory usage in MB
        
        # Storage paths
        self.storage_path = "data/queen_memory"
        self.compressed_path = "data/queen_memory/compressed"
        self.knowledge_base_path = "data/queen_memory/knowledge_base"
        
        self._ensure_storage_directories()
        self._last_cleanup = time.time()
        
        # Background cleanup task will be started when needed
        self._cleanup_task = None
    
    def _ensure_storage_directories(self):
        """Ensure all storage directories exist"""
        for path in [self.storage_path, self.compressed_path, self.knowledge_base_path]:
            os.makedirs(path, exist_ok=True)
    
    async def store_generation_data(self, generation: int, death_analysis: DeathAnalysis, 
                                   strategy: QueenStrategy, territory_id: str = None):
        """
        Store learning data for a generation with enhanced memory management
        
        Args:
            generation: Generation number
            death_analysis: Analysis of the death that ended this generation
            strategy: Strategy generated for next generation
            territory_id: Territory identifier for knowledge transfer
        """
        try:
            logger.info(f"Storing generation {generation} data for territory {territory_id}")
            
            generation_data = {
                "generation": generation,
                "territory_id": territory_id,
                "timestamp": time.time(),
                "death_analysis": death_analysis.to_dict(),
                "next_strategy": strategy.to_dict(),
                "learning_metrics": {
                    "survival_time": death_analysis.temporal_insights.get("survival_time", 0),
                    "improvement_score": death_analysis.survival_improvement,
                    "strategy_effectiveness": self._calculate_strategy_effectiveness(death_analysis),
                    "success_score": self._calculate_success_score(death_analysis)
                },
                "memory_priority": self._calculate_memory_priority(generation, death_analysis)
            }
            
            # Store in memory with territory context
            key = f"{territory_id}_{generation}" if territory_id else str(generation)
            self.generation_data[key] = generation_data
            
            # Update territory-specific knowledge
            if territory_id:
                await self._update_territory_knowledge(territory_id, generation_data)
            
            # Maintain rolling window and cleanup
            await self._maintain_rolling_window()
            
            # Compress old data if needed
            await self._compress_old_data(generation)
            
            # Persist to disk
            await self._save_to_disk(key, generation_data)
            
            # Trigger knowledge transfer to other territories
            if territory_id and generation_data["learning_metrics"]["success_score"] > 0.7:
                await self._initiate_knowledge_transfer(territory_id, generation_data)
            
            logger.info(f"Generation {generation} data stored successfully")
            
        except Exception as e:
            logger.error(f"Error storing generation data: {e}")
            raise
    
    async def store_success_data(self, generation: int, success_data: Dict[str, Any], 
                                training_result: Dict[str, Any]):
        """
        Store successful strategy data for positive reinforcement learning
        
        Args:
            generation: Generation number
            success_data: Data about successful strategies
            training_result: Results from success training
        """
        try:
            logger.info(f"Storing success data for generation {generation}")
            
            success_entry = {
                "generation": generation,
                "timestamp": time.time(),
                "success_type": "strategy_reinforcement",
                "success_data": success_data,
                "training_result": training_result,
                "reinforcement_metrics": {
                    "survival_time": success_data.get('survival_time', 0),
                    "effectiveness_score": success_data.get('effectiveness', 1.0),
                    "successful_strategies": success_data.get('successful_strategies', [])
                }
            }
            
            # Find the appropriate generation data to store success info
            generation_key = None
            for key in self.generation_data.keys():
                if key.endswith(f"_{generation}"):
                    generation_key = key
                    break
            
            if generation_key:
                # Store success data alongside generation data
                if 'success_data' not in self.generation_data[generation_key]:
                    self.generation_data[generation_key]['success_data'] = []
                
                self.generation_data[generation_key]['success_data'].append(success_entry)
                
                # Update success score in learning metrics
                self.generation_data[generation_key]['learning_metrics']['success_score'] = success_data.get('effectiveness', 1.0)
                
                # Persist to disk
                await self._save_to_disk(generation_key, self.generation_data[generation_key])
            else:
                # Create new entry for success data if generation data doesn't exist
                success_key = f"success_{generation}_{int(time.time())}"
                self.generation_data[success_key] = {
                    "generation": generation,
                    "timestamp": time.time(),
                    "success_only": True,
                    "success_data": [success_entry],
                    "learning_metrics": {
                        "success_score": success_data.get('effectiveness', 1.0),
                        "survival_time": success_data.get('survival_time', 0),
                        "strategy_effectiveness": success_data.get('effectiveness', 1.0)
                    }
                }
                
                await self._save_to_disk(success_key, self.generation_data[success_key])
            
            logger.info(f"Success data for generation {generation} stored successfully")
            
        except Exception as e:
            logger.error(f"Error storing success data: {e}")
            raise
    
    async def compress_player_patterns(self, patterns: PlayerPatterns, territory_id: str) -> str:
        """
        Compress player behavior patterns for efficient storage (Requirement 9.2)
        
        Args:
            patterns: Player behavior patterns to compress
            territory_id: Territory identifier
            
        Returns:
            Compressed data identifier
        """
        try:
            # Create compressed representation
            compressed_data = {
                "mining_summary": self._compress_mining_patterns(patterns.mining_patterns),
                "combat_summary": self._compress_combat_patterns(patterns.combat_patterns),
                "energy_summary": self._compress_energy_patterns(patterns.energy_patterns),
                "player_type": patterns.player_profile.player_type,
                "confidence": patterns.player_profile.confidence,
                "key_insights": self._extract_key_insights(patterns),
                "timestamp": time.time()
            }
            
            # Generate unique identifier
            pattern_id = f"{territory_id}_{int(time.time())}"
            
            # Compress and store
            compressed_bytes = gzip.compress(pickle.dumps(compressed_data))
            
            # Store compressed data
            self.compressed_patterns[pattern_id] = {
                "data": compressed_bytes,
                "size": len(compressed_bytes),
                "original_size": len(pickle.dumps(patterns.to_dict())),
                "compression_ratio": len(compressed_bytes) / len(pickle.dumps(patterns.to_dict())),
                "territory_id": territory_id,
                "timestamp": time.time()
            }
            
            # Save to disk
            compressed_file = os.path.join(self.compressed_path, f"{pattern_id}.gz")
            with open(compressed_file, 'wb') as f:
                f.write(compressed_bytes)
            
            logger.info(f"Compressed player patterns for territory {territory_id}, "
                       f"compression ratio: {self.compressed_patterns[pattern_id]['compression_ratio']:.2f}")
            
            return pattern_id
            
        except Exception as e:
            logger.error(f"Error compressing player patterns: {e}")
            raise
    
    def _compress_mining_patterns(self, mining_patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Compress mining patterns to essential information"""
        return {
            "preferred_locations": mining_patterns.get("preferred_locations", [])[:5],  # Top 5 locations
            "expansion_timing": mining_patterns.get("expansion_timing", 0),
            "worker_distribution": mining_patterns.get("avg_worker_distribution", 0),
            "efficiency_score": mining_patterns.get("efficiency", 0.5)
        }
    
    def _compress_combat_patterns(self, combat_patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Compress combat patterns to essential information"""
        return {
            "aggression_level": combat_patterns.get("aggression_score", 0.5),
            "preferred_tactics": combat_patterns.get("tactics", [])[:3],  # Top 3 tactics
            "timing_preference": combat_patterns.get("timing_preference", "medium"),
            "coordination_level": combat_patterns.get("coordination", 0.5)
        }
    
    def _compress_energy_patterns(self, energy_patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Compress energy patterns to essential information"""
        return {
            "management_style": energy_patterns.get("management_style", "balanced"),
            "spending_rate": energy_patterns.get("avg_spending_rate", 0.5),
            "conservation_threshold": energy_patterns.get("conservation_threshold", 200),
            "efficiency_score": energy_patterns.get("efficiency", 0.5)
        }
    
    def _extract_key_insights(self, patterns: PlayerPatterns) -> List[str]:
        """Extract key insights from player patterns"""
        insights = []
        
        # Mining insights
        if patterns.mining_patterns.get("efficiency", 0) > 0.8:
            insights.append("highly_efficient_mining")
        
        # Combat insights
        if patterns.combat_patterns.get("aggression_score", 0) > 0.7:
            insights.append("aggressive_combat_style")
        elif patterns.combat_patterns.get("aggression_score", 0) < 0.3:
            insights.append("defensive_combat_style")
        
        # Energy insights
        if patterns.energy_patterns.get("management_style") == "conservative":
            insights.append("conservative_energy_management")
        
        return insights
    async def transfer_knowledge_between_territories(self, source_territory: str, 
                                                   target_territory: str) -> Dict[str, Any]:
        """
        Transfer successful strategies between Queens in different territories (Requirement 9.3)
        
        Args:
            source_territory: Territory with successful strategies
            target_territory: Territory to receive knowledge
            
        Returns:
            Transfer result information
        """
        try:
            logger.info(f"Transferring knowledge from {source_territory} to {target_territory}")
            
            # Get successful strategies from source territory
            source_knowledge = await self._get_territory_knowledge(source_territory)
            successful_strategies = self._filter_successful_strategies(source_knowledge)
            
            if not successful_strategies:
                logger.info(f"No successful strategies found in territory {source_territory}")
                return {"transferred": 0, "reason": "no_successful_strategies"}
            
            # Adapt strategies for target territory
            adapted_strategies = await self._adapt_strategies_for_territory(
                successful_strategies, target_territory
            )
            
            # Store adapted knowledge in target territory
            transfer_key = f"transfer_{source_territory}_to_{target_territory}_{int(time.time())}"
            transfer_data = {
                "source_territory": source_territory,
                "target_territory": target_territory,
                "timestamp": time.time(),
                "strategies": adapted_strategies,
                "adaptation_confidence": self._calculate_adaptation_confidence(
                    source_territory, target_territory
                ),
                "transfer_type": "inter_territory_knowledge"
            }
            
            # Update target territory knowledge
            if target_territory not in self.territory_knowledge:
                self.territory_knowledge[target_territory] = {}
            
            self.territory_knowledge[target_territory][transfer_key] = transfer_data
            
            # Cache for quick access
            self.knowledge_transfer_cache[transfer_key] = transfer_data
            
            # Persist to knowledge base
            await self._save_knowledge_transfer(transfer_key, transfer_data)
            
            logger.info(f"Successfully transferred {len(adapted_strategies)} strategies "
                       f"from {source_territory} to {target_territory}")
            
            return {
                "transferred": len(adapted_strategies),
                "transfer_id": transfer_key,
                "adaptation_confidence": transfer_data["adaptation_confidence"],
                "strategies": [s["strategy_type"] for s in adapted_strategies]
            }
            
        except Exception as e:
            logger.error(f"Error transferring knowledge between territories: {e}")
            return {"transferred": 0, "error": str(e)}
    
    async def _get_territory_knowledge(self, territory_id: str) -> Dict[str, Any]:
        """Get all knowledge for a specific territory"""
        territory_data = {}
        
        # Get from memory
        for key, data in self.generation_data.items():
            if key.startswith(f"{territory_id}_"):
                territory_data[key] = data
        
        # Get from territory knowledge
        if territory_id in self.territory_knowledge:
            territory_data.update(self.territory_knowledge[territory_id])
        
        return territory_data
    
    def _filter_successful_strategies(self, territory_knowledge: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Filter strategies that were successful (high success score)"""
        successful_strategies = []
        
        for key, data in territory_knowledge.items():
            if "learning_metrics" in data:
                success_score = data["learning_metrics"].get("success_score", 0)
                if success_score > 0.6:  # Threshold for successful strategies
                    strategy_info = {
                        "strategy": data.get("next_strategy", {}),
                        "success_score": success_score,
                        "generation": data.get("generation", 1),
                        "strategy_type": self._classify_strategy_type(data.get("next_strategy", {})),
                        "effectiveness_metrics": data["learning_metrics"]
                    }
                    successful_strategies.append(strategy_info)
        
        # Sort by success score (best first)
        successful_strategies.sort(key=lambda x: x["success_score"], reverse=True)
        
        return successful_strategies[:5]  # Top 5 successful strategies
    
    def _classify_strategy_type(self, strategy: Dict[str, Any]) -> str:
        """Classify strategy type for knowledge transfer"""
        if not strategy:
            return "unknown"
        
        # Analyze strategy components to classify
        hive_placement = strategy.get("hive_placement", {})
        parasite_spawning = strategy.get("parasite_spawning", {})
        defensive = strategy.get("defensive_coordination", {})
        
        if hive_placement.get("stealth_focus", False):
            return "stealth_placement"
        elif defensive.get("aggressive_swarm", False):
            return "aggressive_defense"
        elif parasite_spawning.get("rapid_spawn", False):
            return "rapid_expansion"
        else:
            return "balanced_strategy"
    
    async def _adapt_strategies_for_territory(self, strategies: List[Dict[str, Any]], 
                                            target_territory: str) -> List[Dict[str, Any]]:
        """Adapt strategies for a different territory"""
        adapted_strategies = []
        
        for strategy_info in strategies:
            # Create adapted version
            adapted_strategy = {
                "original_strategy": strategy_info["strategy"],
                "adapted_strategy": self._modify_strategy_for_territory(
                    strategy_info["strategy"], target_territory
                ),
                "strategy_type": strategy_info["strategy_type"],
                "original_success_score": strategy_info["success_score"],
                "adaptation_notes": self._generate_adaptation_notes(
                    strategy_info["strategy"], target_territory
                ),
                "confidence": self._calculate_strategy_adaptation_confidence(strategy_info)
            }
            adapted_strategies.append(adapted_strategy)
        
        return adapted_strategies
    
    def _modify_strategy_for_territory(self, strategy: Dict[str, Any], 
                                     territory_id: str) -> Dict[str, Any]:
        """Modify strategy parameters for different territory"""
        # Create a copy to avoid modifying original
        adapted = strategy.copy()
        
        # Territory-specific adaptations
        # This is a simplified adaptation - in practice, this would be more sophisticated
        territory_hash = hash(territory_id) % 100
        
        # Adjust hive placement based on territory characteristics
        if "hive_placement" in adapted:
            hive_placement = adapted["hive_placement"].copy()
            # Modify placement strategy based on territory
            hive_placement["territory_adaptation"] = territory_hash / 100.0
            adapted["hive_placement"] = hive_placement
        
        # Adjust spawning timing
        if "parasite_spawning" in adapted:
            spawning = adapted["parasite_spawning"].copy()
            spawning["territory_modifier"] = (territory_hash % 20) / 20.0
            adapted["parasite_spawning"] = spawning
        
        return adapted
    
    def _generate_adaptation_notes(self, strategy: Dict[str, Any], territory_id: str) -> List[str]:
        """Generate notes about strategy adaptations"""
        notes = []
        notes.append(f"Adapted for territory {territory_id}")
        notes.append("Hive placement adjusted for territory characteristics")
        notes.append("Spawning timing modified based on territory analysis")
        return notes
    
    def _calculate_adaptation_confidence(self, source_territory: str, target_territory: str) -> float:
        """Calculate confidence in knowledge transfer adaptation"""
        # Simplified confidence calculation
        # In practice, this would consider territory similarity, strategy compatibility, etc.
        base_confidence = 0.7
        
        # Reduce confidence if territories are very different (simplified)
        territory_similarity = 1.0 - abs(hash(source_territory) - hash(target_territory)) / (2**32)
        
        return min(1.0, base_confidence * territory_similarity)
    
    def _calculate_strategy_adaptation_confidence(self, strategy_info: Dict[str, Any]) -> float:
        """Calculate confidence for individual strategy adaptation"""
        base_confidence = strategy_info["success_score"]
        
        # Adjust based on strategy complexity
        complexity = strategy_info["strategy"].get("complexity_level", 0.5)
        complexity_penalty = complexity * 0.2  # More complex strategies are harder to adapt
        
        return max(0.1, base_confidence - complexity_penalty)
    
    async def _maintain_rolling_window(self):
        """
        Maintain rolling window of last 10 generations (Requirement 9.1, 9.5)
        """
        try:
            # Group data by territory
            territory_generations = defaultdict(list)
            
            for key in self.generation_data.keys():
                if "_" in key:
                    territory_id, generation = key.rsplit("_", 1)
                    try:
                        gen_num = int(generation)
                        territory_generations[territory_id].append((key, gen_num))
                    except ValueError:
                        continue
            
            # Maintain rolling window for each territory
            for territory_id, generations in territory_generations.items():
                # Sort by generation number
                generations.sort(key=lambda x: x[1])
                
                # Keep only last max_generations
                if len(generations) > self.max_generations:
                    old_generations = generations[:-self.max_generations]
                    
                    for key, gen_num in old_generations:
                        # Move to compressed storage before deletion
                        if key in self.generation_data:
                            await self._archive_generation_data(key, self.generation_data[key])
                            del self.generation_data[key]
                        
                        # Remove from disk
                        file_path = os.path.join(self.storage_path, f"{key}.json")
                        if os.path.exists(file_path):
                            os.remove(file_path)
                    
                    logger.info(f"Cleaned up {len(old_generations)} old generations for territory {territory_id}")
            
        except Exception as e:
            logger.error(f"Error maintaining rolling window: {e}")
    
    async def _archive_generation_data(self, key: str, data: Dict[str, Any]):
        """Archive generation data to compressed storage"""
        try:
            # Compress and store in archive
            compressed_data = gzip.compress(pickle.dumps(data))
            archive_path = os.path.join(self.compressed_path, f"archived_{key}.gz")
            
            with open(archive_path, 'wb') as f:
                f.write(compressed_data)
            
            logger.debug(f"Archived generation data {key}")
            
        except Exception as e:
            logger.error(f"Error archiving generation data: {e}")
    
    async def _compress_old_data(self, current_generation: int):
        """
        Compress data older than compression threshold (Requirement 9.2)
        """
        try:
            compression_cutoff = current_generation - self.compression_threshold
            
            for key, data in list(self.generation_data.items()):
                # Extract generation number
                if "_" in key:
                    _, generation_str = key.rsplit("_", 1)
                    try:
                        generation = int(generation_str)
                        if generation <= compression_cutoff:
                            # Compress this data
                            await self._compress_generation_data(key, data)
                    except ValueError:
                        continue
            
        except Exception as e:
            logger.error(f"Error compressing old data: {e}")
    
    async def _compress_generation_data(self, key: str, data: Dict[str, Any]):
        """Compress individual generation data"""
        try:
            # Create compressed version with only essential data
            essential_data = {
                "generation": data.get("generation"),
                "territory_id": data.get("territory_id"),
                "timestamp": data.get("timestamp"),
                "learning_metrics": data.get("learning_metrics"),
                "memory_priority": data.get("memory_priority"),
                "key_insights": self._extract_generation_insights(data)
            }
            
            # Compress and store
            compressed_bytes = gzip.compress(pickle.dumps(essential_data))
            compressed_file = os.path.join(self.compressed_path, f"compressed_{key}.gz")
            
            with open(compressed_file, 'wb') as f:
                f.write(compressed_bytes)
            
            # Update memory with compressed reference
            self.generation_data[key] = {
                "compressed": True,
                "file_path": compressed_file,
                "original_size": len(pickle.dumps(data)),
                "compressed_size": len(compressed_bytes),
                "essential_data": essential_data
            }
            
            logger.debug(f"Compressed generation data {key}")
            
        except Exception as e:
            logger.error(f"Error compressing generation data: {e}")
    
    def _extract_generation_insights(self, data: Dict[str, Any]) -> List[str]:
        """Extract key insights from generation data for compressed storage"""
        insights = []
        
        learning_metrics = data.get("learning_metrics", {})
        
        if learning_metrics.get("success_score", 0) > 0.8:
            insights.append("high_success_generation")
        
        if learning_metrics.get("improvement_score", 0) > 0.5:
            insights.append("significant_improvement")
        
        if learning_metrics.get("strategy_effectiveness", 0) > 0.7:
            insights.append("effective_strategy")
        
        return insights
    
    def start_background_cleanup(self):
        """Start background cleanup task"""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._background_cleanup_task())
    
    def stop_background_cleanup(self):
        """Stop background cleanup task"""
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
    
    async def _background_cleanup_task(self):
        """Background task for periodic memory cleanup (Requirement 9.5)"""
        while True:
            try:
                await asyncio.sleep(self.cleanup_interval)
                
                current_time = time.time()
                if current_time - self._last_cleanup > self.cleanup_interval:
                    await self._perform_memory_cleanup()
                    self._last_cleanup = current_time
                    
            except Exception as e:
                logger.error(f"Error in background cleanup task: {e}")
                await asyncio.sleep(60)  # Wait before retrying
    
    async def _perform_memory_cleanup(self):
        """Perform comprehensive memory cleanup"""
        try:
            logger.info("Performing memory cleanup...")
            
            # Check memory usage
            memory_usage = self._estimate_memory_usage()
            
            if memory_usage > self.max_memory_mb:
                logger.warning(f"Memory usage ({memory_usage:.1f}MB) exceeds limit ({self.max_memory_mb}MB)")
                await self._aggressive_cleanup()
            
            # Clean up old compressed patterns
            await self._cleanup_compressed_patterns()
            
            # Clean up knowledge transfer cache
            await self._cleanup_knowledge_transfer_cache()
            
            # Garbage collect
            import gc
            gc.collect()
            
            logger.info("Memory cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during memory cleanup: {e}")
    
    def _estimate_memory_usage(self) -> float:
        """Estimate current memory usage in MB"""
        try:
            import sys
            
            total_size = 0
            
            # Estimate size of generation data
            total_size += sys.getsizeof(self.generation_data)
            for key, data in self.generation_data.items():
                total_size += sys.getsizeof(key) + sys.getsizeof(data)
            
            # Estimate size of compressed patterns
            total_size += sys.getsizeof(self.compressed_patterns)
            for pattern_data in self.compressed_patterns.values():
                total_size += pattern_data.get("size", 0)
            
            # Estimate size of territory knowledge
            total_size += sys.getsizeof(self.territory_knowledge)
            
            # Estimate size of knowledge transfer cache
            total_size += sys.getsizeof(self.knowledge_transfer_cache)
            
            return total_size / (1024 * 1024)  # Convert to MB
            
        except Exception as e:
            logger.error(f"Error estimating memory usage: {e}")
            return 0.0
    
    async def _aggressive_cleanup(self):
        """Perform aggressive cleanup when memory limit is exceeded"""
        try:
            logger.info("Performing aggressive memory cleanup...")
            
            # Remove low-priority generation data
            low_priority_keys = []
            for key, data in self.generation_data.items():
                if data.get("memory_priority", 0.5) < 0.3:
                    low_priority_keys.append(key)
            
            for key in low_priority_keys[:len(low_priority_keys)//2]:  # Remove half of low-priority data
                await self._archive_generation_data(key, self.generation_data[key])
                del self.generation_data[key]
            
            # Clear old compressed patterns
            cutoff_time = time.time() - (7 * 24 * 3600)  # 7 days ago
            old_patterns = [
                pattern_id for pattern_id, data in self.compressed_patterns.items()
                if data.get("timestamp", 0) < cutoff_time
            ]
            
            for pattern_id in old_patterns:
                del self.compressed_patterns[pattern_id]
            
            logger.info(f"Aggressive cleanup completed: removed {len(low_priority_keys)//2} generations "
                       f"and {len(old_patterns)} old patterns")
            
        except Exception as e:
            logger.error(f"Error during aggressive cleanup: {e}")
    
    async def _cleanup_compressed_patterns(self):
        """Clean up old compressed patterns"""
        try:
            cutoff_time = time.time() - (30 * 24 * 3600)  # 30 days ago
            
            old_patterns = [
                pattern_id for pattern_id, data in self.compressed_patterns.items()
                if data.get("timestamp", 0) < cutoff_time
            ]
            
            for pattern_id in old_patterns:
                # Remove from memory
                del self.compressed_patterns[pattern_id]
                
                # Remove file
                file_path = os.path.join(self.compressed_path, f"{pattern_id}.gz")
                if os.path.exists(file_path):
                    os.remove(file_path)
            
            if old_patterns:
                logger.info(f"Cleaned up {len(old_patterns)} old compressed patterns")
                
        except Exception as e:
            logger.error(f"Error cleaning up compressed patterns: {e}")
    
    async def _cleanup_knowledge_transfer_cache(self):
        """Clean up knowledge transfer cache"""
        try:
            cutoff_time = time.time() - (7 * 24 * 3600)  # 7 days ago
            
            old_transfers = [
                transfer_id for transfer_id, data in self.knowledge_transfer_cache.items()
                if data.get("timestamp", 0) < cutoff_time
            ]
            
            for transfer_id in old_transfers:
                del self.knowledge_transfer_cache[transfer_id]
            
            if old_transfers:
                logger.info(f"Cleaned up {len(old_transfers)} old knowledge transfers from cache")
                
        except Exception as e:
            logger.error(f"Error cleaning up knowledge transfer cache: {e}")
    
    def _calculate_memory_priority(self, generation: int, death_analysis: DeathAnalysis) -> float:
        """
        Calculate memory priority for data retention (Requirement 9.6)
        Higher priority = more likely to be retained
        """
        priority = 0.5  # Base priority
        
        # Recent generations have higher priority
        recency_bonus = min(0.3, generation / 100.0)
        priority += recency_bonus
        
        # Successful strategies have higher priority
        success_bonus = death_analysis.survival_improvement * 0.2
        priority += success_bonus
        
        # Significant improvements have higher priority
        if death_analysis.survival_improvement > 0.5:
            priority += 0.2
        
        # Unique or rare strategies have higher priority
        if len(death_analysis.failed_strategies) < 3:  # Few failed strategies = good performance
            priority += 0.1
        
        return min(1.0, priority)
    
    def _calculate_success_score(self, death_analysis: DeathAnalysis) -> float:
        """Calculate overall success score for a generation"""
        base_score = 0.5
        
        # Survival improvement contributes significantly
        survival_component = death_analysis.survival_improvement * 0.4
        
        # Strategy effectiveness
        effectiveness_component = self._calculate_strategy_effectiveness(death_analysis) * 0.3
        
        # Parasite spawning success
        spawn_success = min(1.0, death_analysis.get_parasites_spawned() / 15.0) * 0.2
        
        # Defensive success (fewer failed strategies = better)
        defensive_success = max(0, 1.0 - len(death_analysis.failed_strategies) / 10.0) * 0.1
        
        return min(1.0, base_score + survival_component + effectiveness_component + 
                  spawn_success + defensive_success)
    async def get_learning_progress(self, queen_id: str, territory_id: str = None) -> Dict[str, Any]:
        """
        Get enhanced learning progress for a Queen with territory context
        
        Args:
            queen_id: Queen identifier
            territory_id: Territory identifier for context
            
        Returns:
            Enhanced learning progress information
        """
        try:
            # Get territory-specific data if available
            territory_data = await self._get_territory_knowledge(territory_id) if territory_id else {}
            
            current_generation = self._get_current_generation(territory_id)
            
            # Calculate enhanced progress metrics
            progress_metrics = await self._calculate_enhanced_progress_metrics(territory_id)
            
            # Get knowledge transfer information
            transfer_info = await self._get_knowledge_transfer_info(territory_id)
            
            return {
                "queen_id": queen_id,
                "territory_id": territory_id,
                "current_generation": current_generation,
                "total_generations": len(territory_data),
                "learning_phase": self._determine_learning_phase(current_generation),
                "progress_metrics": progress_metrics,
                "recent_improvements": await self._get_recent_improvements(territory_id),
                "next_strategy_preview": await self._get_next_strategy_preview(current_generation),
                "knowledge_transfers": transfer_info,
                "memory_usage": {
                    "total_mb": self._estimate_memory_usage(),
                    "compressed_patterns": len(self.compressed_patterns),
                    "active_generations": len([k for k in self.generation_data.keys() 
                                             if not self.generation_data[k].get("compressed", False)])
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting learning progress: {e}")
            return {"error": str(e)}
    
    def _get_current_generation(self, territory_id: str = None) -> int:
        """Get current generation for territory or overall"""
        if territory_id:
            territory_generations = [
                int(key.split("_")[-1]) for key in self.generation_data.keys()
                if key.startswith(f"{territory_id}_") and key.split("_")[-1].isdigit()
            ]
            return max(territory_generations) if territory_generations else 1
        else:
            all_generations = []
            for key in self.generation_data.keys():
                if "_" in key:
                    gen_str = key.split("_")[-1]
                    if gen_str.isdigit():
                        all_generations.append(int(gen_str))
            return max(all_generations) if all_generations else 1
    
    async def _calculate_enhanced_progress_metrics(self, territory_id: str = None) -> Dict[str, Any]:
        """Calculate enhanced progress metrics with territory context"""
        try:
            territory_data = await self._get_territory_knowledge(territory_id) if territory_id else self.generation_data
            
            if not territory_data:
                return {
                    "survival_improvement": 0.0,
                    "strategy_effectiveness": 0.0,
                    "learning_rate": 0.0,
                    "consistency": 0.0,
                    "knowledge_transfer_benefit": 0.0
                }
            
            # Get recent generations data
            recent_data = self._get_recent_generation_data(territory_data, 5)
            
            # Calculate metrics
            survival_improvement = self._calculate_survival_trend(recent_data)
            strategy_effectiveness = self._calculate_average_effectiveness(recent_data)
            learning_rate = self._calculate_enhanced_learning_rate(recent_data)
            consistency = self._calculate_strategy_consistency(recent_data)
            transfer_benefit = self._calculate_knowledge_transfer_benefit(territory_id)
            
            return {
                "survival_improvement": max(-1.0, min(1.0, survival_improvement)),
                "strategy_effectiveness": strategy_effectiveness,
                "learning_rate": learning_rate,
                "consistency": consistency,
                "knowledge_transfer_benefit": transfer_benefit,
                "data_compression_ratio": self._calculate_compression_efficiency(),
                "memory_efficiency": self._calculate_memory_efficiency()
            }
            
        except Exception as e:
            logger.error(f"Error calculating enhanced progress metrics: {e}")
            return {"error": str(e)}
    
    def _get_recent_generation_data(self, territory_data: Dict[str, Any], count: int) -> List[Dict[str, Any]]:
        """Get recent generation data sorted by generation number"""
        generation_list = []
        
        for key, data in territory_data.items():
            if "generation" in data and "learning_metrics" in data:
                generation_list.append(data)
        
        # Sort by generation number
        generation_list.sort(key=lambda x: x.get("generation", 0))
        
        return generation_list[-count:] if len(generation_list) > count else generation_list
    
    def _calculate_survival_trend(self, recent_data: List[Dict[str, Any]]) -> float:
        """Calculate survival time improvement trend"""
        if len(recent_data) < 2:
            return 0.0
        
        survival_times = [
            data["learning_metrics"].get("survival_time", 0) 
            for data in recent_data
        ]
        
        # Calculate linear trend
        if survival_times[0] == 0:
            return 0.0
        
        return (survival_times[-1] - survival_times[0]) / max(survival_times[0], 1)
    
    def _calculate_average_effectiveness(self, recent_data: List[Dict[str, Any]]) -> float:
        """Calculate average strategy effectiveness"""
        if not recent_data:
            return 0.0
        
        effectiveness_scores = [
            data["learning_metrics"].get("strategy_effectiveness", 0.5)
            for data in recent_data
        ]
        
        return sum(effectiveness_scores) / len(effectiveness_scores)
    
    def _calculate_enhanced_learning_rate(self, recent_data: List[Dict[str, Any]]) -> float:
        """Calculate enhanced learning rate"""
        if len(recent_data) < 2:
            return 0.5
        
        # Calculate improvement rate between generations
        improvements = []
        for i in range(1, len(recent_data)):
            prev_score = recent_data[i-1]["learning_metrics"].get("success_score", 0.5)
            curr_score = recent_data[i]["learning_metrics"].get("success_score", 0.5)
            improvement = curr_score - prev_score
            improvements.append(improvement)
        
        avg_improvement = sum(improvements) / len(improvements) if improvements else 0
        
        # Normalize to 0-1 range
        return max(0.0, min(1.0, 0.5 + avg_improvement))
    
    def _calculate_strategy_consistency(self, recent_data: List[Dict[str, Any]]) -> float:
        """Calculate consistency of strategy performance"""
        if len(recent_data) < 2:
            return 0.5
        
        effectiveness_scores = [
            data["learning_metrics"].get("strategy_effectiveness", 0.5)
            for data in recent_data
        ]
        
        # Calculate variance (lower variance = higher consistency)
        mean_score = sum(effectiveness_scores) / len(effectiveness_scores)
        variance = sum((score - mean_score) ** 2 for score in effectiveness_scores) / len(effectiveness_scores)
        
        # Convert variance to consistency score (0-1, higher is better)
        return max(0.0, 1.0 - variance)
    
    def _calculate_knowledge_transfer_benefit(self, territory_id: str) -> float:
        """Calculate benefit gained from knowledge transfers"""
        if not territory_id or territory_id not in self.territory_knowledge:
            return 0.0
        
        transfer_count = 0
        total_benefit = 0.0
        
        for key, data in self.territory_knowledge[territory_id].items():
            if data.get("transfer_type") == "inter_territory_knowledge":
                transfer_count += 1
                # Estimate benefit based on adaptation confidence
                benefit = data.get("adaptation_confidence", 0.5) * 0.2
                total_benefit += benefit
        
        return min(1.0, total_benefit)
    
    def _calculate_compression_efficiency(self) -> float:
        """Calculate data compression efficiency"""
        if not self.compressed_patterns:
            return 0.0
        
        total_compression_ratio = sum(
            data.get("compression_ratio", 1.0) 
            for data in self.compressed_patterns.values()
        )
        
        return total_compression_ratio / len(self.compressed_patterns)
    
    def _calculate_memory_efficiency(self) -> float:
        """Calculate memory usage efficiency"""
        current_usage = self._estimate_memory_usage()
        efficiency = 1.0 - (current_usage / self.max_memory_mb)
        return max(0.0, min(1.0, efficiency))
    
    async def _get_knowledge_transfer_info(self, territory_id: str) -> Dict[str, Any]:
        """Get information about knowledge transfers for territory"""
        if not territory_id:
            return {"incoming": 0, "outgoing": 0, "recent_transfers": []}
        
        incoming_transfers = []
        outgoing_transfers = []
        
        # Check knowledge transfer cache
        for transfer_id, data in self.knowledge_transfer_cache.items():
            if data.get("target_territory") == territory_id:
                incoming_transfers.append({
                    "source": data.get("source_territory"),
                    "timestamp": data.get("timestamp"),
                    "strategies_count": len(data.get("strategies", [])),
                    "confidence": data.get("adaptation_confidence", 0.0)
                })
            elif data.get("source_territory") == territory_id:
                outgoing_transfers.append({
                    "target": data.get("target_territory"),
                    "timestamp": data.get("timestamp"),
                    "strategies_count": len(data.get("strategies", [])),
                    "confidence": data.get("adaptation_confidence", 0.0)
                })
        
        # Sort by timestamp (most recent first)
        incoming_transfers.sort(key=lambda x: x["timestamp"], reverse=True)
        outgoing_transfers.sort(key=lambda x: x["timestamp"], reverse=True)
        
        return {
            "incoming": len(incoming_transfers),
            "outgoing": len(outgoing_transfers),
            "recent_incoming": incoming_transfers[:3],
            "recent_outgoing": outgoing_transfers[:3]
        }
    
    async def _update_territory_knowledge(self, territory_id: str, generation_data: Dict[str, Any]):
        """Update territory-specific knowledge base"""
        try:
            if territory_id not in self.territory_knowledge:
                self.territory_knowledge[territory_id] = {}
            
            # Store generation-specific insights
            insights_key = f"generation_{generation_data['generation']}_insights"
            self.territory_knowledge[territory_id][insights_key] = {
                "generation": generation_data["generation"],
                "timestamp": generation_data["timestamp"],
                "success_score": generation_data["learning_metrics"]["success_score"],
                "key_strategies": self._extract_key_strategies(generation_data),
                "player_adaptations": self._extract_player_adaptations(generation_data)
            }
            
            # Update territory summary
            await self._update_territory_summary(territory_id)
            
        except Exception as e:
            logger.error(f"Error updating territory knowledge: {e}")
    
    def _extract_key_strategies(self, generation_data: Dict[str, Any]) -> List[str]:
        """Extract key strategies from generation data"""
        strategies = []
        
        next_strategy = generation_data.get("next_strategy", {})
        
        if next_strategy.get("hive_placement", {}).get("stealth_focus"):
            strategies.append("stealth_hive_placement")
        
        if next_strategy.get("parasite_spawning", {}).get("rapid_spawn"):
            strategies.append("rapid_parasite_spawning")
        
        if next_strategy.get("defensive_coordination", {}).get("swarm_tactics"):
            strategies.append("coordinated_swarm_defense")
        
        return strategies
    
    def _extract_player_adaptations(self, generation_data: Dict[str, Any]) -> List[str]:
        """Extract player adaptations from generation data"""
        adaptations = []
        
        death_analysis = generation_data.get("death_analysis", {})
        
        # Analyze what the player did differently
        if death_analysis.get("spatial_insights", {}).get("new_approach_vector"):
            adaptations.append("changed_approach_strategy")
        
        if death_analysis.get("temporal_insights", {}).get("faster_discovery"):
            adaptations.append("improved_hive_discovery")
        
        if death_analysis.get("tactical_insights", {}).get("better_coordination"):
            adaptations.append("enhanced_unit_coordination")
        
        return adaptations
    
    async def _update_territory_summary(self, territory_id: str):
        """Update summary information for territory"""
        try:
            territory_data = self.territory_knowledge[territory_id]
            
            # Calculate territory-wide metrics
            generations = [
                data for key, data in territory_data.items()
                if key.endswith("_insights") and "generation" in data
            ]
            
            if generations:
                avg_success = sum(g.get("success_score", 0) for g in generations) / len(generations)
                latest_generation = max(g.get("generation", 0) for g in generations)
                
                # Update summary
                territory_data["summary"] = {
                    "total_generations": len(generations),
                    "latest_generation": latest_generation,
                    "average_success_score": avg_success,
                    "last_updated": time.time(),
                    "dominant_strategies": self._identify_dominant_strategies(generations),
                    "adaptation_patterns": self._identify_adaptation_patterns(generations)
                }
            
        except Exception as e:
            logger.error(f"Error updating territory summary: {e}")
    
    def _identify_dominant_strategies(self, generations: List[Dict[str, Any]]) -> List[str]:
        """Identify dominant strategies across generations"""
        strategy_counts = defaultdict(int)
        
        for gen_data in generations:
            for strategy in gen_data.get("key_strategies", []):
                strategy_counts[strategy] += 1
        
        # Return top 3 most common strategies
        sorted_strategies = sorted(strategy_counts.items(), key=lambda x: x[1], reverse=True)
        return [strategy for strategy, count in sorted_strategies[:3]]
    
    def _identify_adaptation_patterns(self, generations: List[Dict[str, Any]]) -> List[str]:
        """Identify player adaptation patterns"""
        adaptation_counts = defaultdict(int)
        
        for gen_data in generations:
            for adaptation in gen_data.get("player_adaptations", []):
                adaptation_counts[adaptation] += 1
        
        # Return adaptations that occurred multiple times
        return [adaptation for adaptation, count in adaptation_counts.items() if count > 1]
    
    async def _initiate_knowledge_transfer(self, source_territory: str, generation_data: Dict[str, Any]):
        """Initiate knowledge transfer to other territories"""
        try:
            # Find other territories that could benefit
            target_territories = [
                territory_id for territory_id in self.territory_knowledge.keys()
                if territory_id != source_territory
            ]
            
            for target_territory in target_territories:
                # Check if transfer would be beneficial
                if await self._should_transfer_knowledge(source_territory, target_territory, generation_data):
                    transfer_result = await self.transfer_knowledge_between_territories(
                        source_territory, target_territory
                    )
                    
                    if transfer_result.get("transferred", 0) > 0:
                        logger.info(f"Initiated knowledge transfer from {source_territory} to {target_territory}")
            
        except Exception as e:
            logger.error(f"Error initiating knowledge transfer: {e}")
    
    async def _should_transfer_knowledge(self, source_territory: str, target_territory: str, 
                                       generation_data: Dict[str, Any]) -> bool:
        """Determine if knowledge transfer would be beneficial"""
        try:
            # Check success score threshold
            success_score = generation_data["learning_metrics"]["success_score"]
            if success_score < 0.7:
                return False
            
            # Check if target territory is struggling
            target_data = await self._get_territory_knowledge(target_territory)
            if not target_data:
                return True  # New territory can benefit from any knowledge
            
            # Get recent performance of target territory
            recent_target_data = self._get_recent_generation_data(target_data, 3)
            if recent_target_data:
                avg_target_success = sum(
                    data["learning_metrics"].get("success_score", 0.5)
                    for data in recent_target_data
                ) / len(recent_target_data)
                
                # Transfer if source is significantly better
                return success_score > avg_target_success + 0.2
            
            return True
            
        except Exception as e:
            logger.error(f"Error determining knowledge transfer benefit: {e}")
            return False
    
    async def _save_knowledge_transfer(self, transfer_id: str, transfer_data: Dict[str, Any]):
        """Save knowledge transfer data to persistent storage"""
        try:
            transfer_file = os.path.join(self.knowledge_base_path, f"{transfer_id}.json")
            
            with open(transfer_file, 'w') as f:
                json.dump(transfer_data, f, indent=2)
            
            logger.debug(f"Saved knowledge transfer {transfer_id}")
            
        except Exception as e:
            logger.error(f"Error saving knowledge transfer: {e}")
    
    async def get_compressed_pattern(self, pattern_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve and decompress a player pattern"""
        try:
            if pattern_id not in self.compressed_patterns:
                return None
            
            pattern_info = self.compressed_patterns[pattern_id]
            compressed_bytes = pattern_info["data"]
            
            # Decompress
            decompressed_data = pickle.loads(gzip.decompress(compressed_bytes))
            
            return decompressed_data
            
        except Exception as e:
            logger.error(f"Error retrieving compressed pattern: {e}")
            return None
    
    async def get_territory_statistics(self, territory_id: str) -> Dict[str, Any]:
        """Get comprehensive statistics for a territory"""
        try:
            territory_data = await self._get_territory_knowledge(territory_id)
            
            if not territory_data:
                return {"error": "Territory not found"}
            
            # Calculate statistics
            generations = self._get_recent_generation_data(territory_data, 10)  # Last 10 generations
            
            stats = {
                "territory_id": territory_id,
                "total_generations": len(generations),
                "average_survival_time": 0.0,
                "average_success_score": 0.0,
                "improvement_trend": 0.0,
                "dominant_strategies": [],
                "knowledge_transfers": {
                    "received": 0,
                    "provided": 0
                },
                "memory_usage": {
                    "compressed_patterns": 0,
                    "active_data_mb": 0.0
                }
            }
            
            if generations:
                # Calculate averages
                survival_times = [g["learning_metrics"].get("survival_time", 0) for g in generations]
                success_scores = [g["learning_metrics"].get("success_score", 0.5) for g in generations]
                
                stats["average_survival_time"] = sum(survival_times) / len(survival_times)
                stats["average_success_score"] = sum(success_scores) / len(success_scores)
                
                # Calculate improvement trend
                if len(success_scores) > 1:
                    stats["improvement_trend"] = success_scores[-1] - success_scores[0]
                
                # Get dominant strategies
                all_strategies = []
                for gen in generations:
                    all_strategies.extend(self._extract_key_strategies(gen))
                
                strategy_counts = defaultdict(int)
                for strategy in all_strategies:
                    strategy_counts[strategy] += 1
                
                stats["dominant_strategies"] = [
                    {"strategy": strategy, "count": count}
                    for strategy, count in sorted(strategy_counts.items(), key=lambda x: x[1], reverse=True)[:3]
                ]
            
            # Count knowledge transfers
            for transfer_data in self.knowledge_transfer_cache.values():
                if transfer_data.get("target_territory") == territory_id:
                    stats["knowledge_transfers"]["received"] += 1
                elif transfer_data.get("source_territory") == territory_id:
                    stats["knowledge_transfers"]["provided"] += 1
            
            # Calculate memory usage for this territory
            territory_patterns = [
                p for p in self.compressed_patterns.values()
                if p.get("territory_id") == territory_id
            ]
            stats["memory_usage"]["compressed_patterns"] = len(territory_patterns)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting territory statistics: {e}")
            return {"error": str(e)}
    async def _save_to_disk(self, key: str, data: Dict[str, Any]):
        """Save generation data to disk with enhanced error handling"""
        try:
            file_path = os.path.join(self.storage_path, f"{key}.json")
            
            # Convert data to JSON-serializable format
            serializable_data = self._make_serializable(data)
            
            # Add metadata
            serializable_data["_metadata"] = {
                "saved_at": time.time(),
                "version": "2.0",
                "memory_manager": "enhanced"
            }
            
            with open(file_path, 'w') as f:
                json.dump(serializable_data, f, indent=2)
            
            logger.debug(f"Generation data {key} saved to {file_path}")
            
        except Exception as e:
            logger.error(f"Error saving generation data to disk: {e}")
    
    def _make_serializable(self, data: Any) -> Any:
        """Convert data to JSON-serializable format with enhanced handling"""
        if isinstance(data, dict):
            return {key: self._make_serializable(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [self._make_serializable(item) for item in data]
        elif isinstance(data, tuple):
            return list(data)
        elif hasattr(data, 'to_dict'):
            return data.to_dict()
        elif isinstance(data, (int, float, str, bool)) or data is None:
            return data
        else:
            # Convert other types to string representation
            return str(data)
    
    async def cleanup(self):
        """Enhanced cleanup of memory manager resources"""
        try:
            logger.info("Starting enhanced memory manager cleanup...")
            
            # Stop background cleanup task
            self.stop_background_cleanup()
            
            # Save all current data to disk
            for key, data in self.generation_data.items():
                if not data.get("compressed", False):  # Don't re-save compressed data
                    await self._save_to_disk(key, data)
            
            # Save compressed patterns metadata
            patterns_metadata = {
                pattern_id: {
                    "size": info["size"],
                    "compression_ratio": info["compression_ratio"],
                    "territory_id": info["territory_id"],
                    "timestamp": info["timestamp"]
                }
                for pattern_id, info in self.compressed_patterns.items()
            }
            
            metadata_file = os.path.join(self.compressed_path, "patterns_metadata.json")
            with open(metadata_file, 'w') as f:
                json.dump(patterns_metadata, f, indent=2)
            
            # Save territory knowledge
            for territory_id, knowledge in self.territory_knowledge.items():
                territory_file = os.path.join(self.knowledge_base_path, f"territory_{territory_id}.json")
                with open(territory_file, 'w') as f:
                    json.dump(self._make_serializable(knowledge), f, indent=2)
            
            # Save knowledge transfer cache
            cache_file = os.path.join(self.knowledge_base_path, "transfer_cache.json")
            with open(cache_file, 'w') as f:
                json.dump(self._make_serializable(self.knowledge_transfer_cache), f, indent=2)
            
            # Clear memory
            self.generation_data.clear()
            self.memory_storage.clear()
            self.territory_knowledge.clear()
            self.compressed_patterns.clear()
            self.knowledge_transfer_cache.clear()
            
            # Final garbage collection
            import gc
            gc.collect()
            
            logger.info("Enhanced memory manager cleanup completed successfully")
            
        except Exception as e:
            logger.error(f"Error during enhanced cleanup: {e}")
            raise
    
    async def load_from_disk(self, territory_id: str = None) -> bool:
        """Load data from disk on startup"""
        try:
            logger.info(f"Loading memory data from disk for territory {territory_id}")
            
            # Load generation data
            if os.path.exists(self.storage_path):
                for filename in os.listdir(self.storage_path):
                    if filename.endswith('.json') and not filename.startswith('_'):
                        file_path = os.path.join(self.storage_path, filename)
                        key = filename[:-5]  # Remove .json extension
                        
                        # Filter by territory if specified
                        if territory_id and not key.startswith(f"{territory_id}_"):
                            continue
                        
                        try:
                            with open(file_path, 'r') as f:
                                data = json.load(f)
                                self.generation_data[key] = data
                        except Exception as e:
                            logger.warning(f"Could not load {filename}: {e}")
            
            # Load compressed patterns metadata
            metadata_file = os.path.join(self.compressed_path, "patterns_metadata.json")
            if os.path.exists(metadata_file):
                try:
                    with open(metadata_file, 'r') as f:
                        patterns_metadata = json.load(f)
                        
                    # Reconstruct compressed patterns info (without actual data)
                    for pattern_id, metadata in patterns_metadata.items():
                        if not territory_id or metadata.get("territory_id") == territory_id:
                            self.compressed_patterns[pattern_id] = {
                                "data": None,  # Will be loaded on demand
                                "size": metadata["size"],
                                "compression_ratio": metadata["compression_ratio"],
                                "territory_id": metadata["territory_id"],
                                "timestamp": metadata["timestamp"],
                                "lazy_load": True
                            }
                except Exception as e:
                    logger.warning(f"Could not load compressed patterns metadata: {e}")
            
            # Load territory knowledge
            if territory_id:
                territory_file = os.path.join(self.knowledge_base_path, f"territory_{territory_id}.json")
                if os.path.exists(territory_file):
                    try:
                        with open(territory_file, 'r') as f:
                            knowledge = json.load(f)
                            self.territory_knowledge[territory_id] = knowledge
                    except Exception as e:
                        logger.warning(f"Could not load territory knowledge: {e}")
            
            # Load knowledge transfer cache
            cache_file = os.path.join(self.knowledge_base_path, "transfer_cache.json")
            if os.path.exists(cache_file):
                try:
                    with open(cache_file, 'r') as f:
                        cache_data = json.load(f)
                        
                    # Filter by territory if specified
                    if territory_id:
                        filtered_cache = {
                            k: v for k, v in cache_data.items()
                            if v.get("source_territory") == territory_id or v.get("target_territory") == territory_id
                        }
                        self.knowledge_transfer_cache.update(filtered_cache)
                    else:
                        self.knowledge_transfer_cache.update(cache_data)
                        
                except Exception as e:
                    logger.warning(f"Could not load knowledge transfer cache: {e}")
            
            logger.info(f"Successfully loaded memory data: {len(self.generation_data)} generations, "
                       f"{len(self.compressed_patterns)} compressed patterns, "
                       f"{len(self.knowledge_transfer_cache)} transfers")
            
            return True
            
        except Exception as e:
            logger.error(f"Error loading data from disk: {e}")
            return False
    
    def get_memory_statistics(self) -> Dict[str, Any]:
        """Get comprehensive memory usage statistics"""
        try:
            stats = {
                "memory_usage_mb": self._estimate_memory_usage(),
                "max_memory_mb": self.max_memory_mb,
                "memory_efficiency": self._calculate_memory_efficiency(),
                "active_generations": len([
                    k for k in self.generation_data.keys() 
                    if not self.generation_data[k].get("compressed", False)
                ]),
                "compressed_generations": len([
                    k for k in self.generation_data.keys() 
                    if self.generation_data[k].get("compressed", False)
                ]),
                "compressed_patterns": len(self.compressed_patterns),
                "territories": len(self.territory_knowledge),
                "knowledge_transfers": len(self.knowledge_transfer_cache),
                "compression_ratios": {
                    "average": self._calculate_compression_efficiency(),
                    "best": min([p.get("compression_ratio", 1.0) for p in self.compressed_patterns.values()], default=1.0),
                    "worst": max([p.get("compression_ratio", 1.0) for p in self.compressed_patterns.values()], default=1.0)
                },
                "cleanup_info": {
                    "last_cleanup": self._last_cleanup,
                    "cleanup_interval": self.cleanup_interval,
                    "next_cleanup": self._last_cleanup + self.cleanup_interval
                }
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting memory statistics: {e}")
            return {"error": str(e)}
    
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
    
    async def _get_recent_improvements(self, territory_id: str = None) -> List[Dict[str, Any]]:
        """Get recent learning improvements with territory context"""
        improvements = []
        
        # Get territory-specific data
        if territory_id:
            territory_data = await self._get_territory_knowledge(territory_id)
            recent_data = self._get_recent_generation_data(territory_data, 3)
        else:
            recent_data = self._get_recent_generation_data(self.generation_data, 3)
        
        if len(recent_data) < 2:
            return improvements
        
        for i in range(1, len(recent_data)):
            prev_data = recent_data[i-1]
            current_data = recent_data[i]
            
            current_survival = current_data["learning_metrics"]["survival_time"]
            prev_survival = prev_data["learning_metrics"]["survival_time"]
            
            if current_survival > prev_survival:
                improvement = {
                    "generation": current_data["generation"],
                    "improvement_type": "survival_time",
                    "improvement_value": current_survival - prev_survival,
                    "description": f"Survived {current_survival - prev_survival:.1f} seconds longer"
                }
                improvements.append(improvement)
            
            # Check for strategy effectiveness improvements
            current_effectiveness = current_data["learning_metrics"]["strategy_effectiveness"]
            prev_effectiveness = prev_data["learning_metrics"]["strategy_effectiveness"]
            
            if current_effectiveness > prev_effectiveness + 0.1:  # Significant improvement
                improvement = {
                    "generation": current_data["generation"],
                    "improvement_type": "strategy_effectiveness",
                    "improvement_value": current_effectiveness - prev_effectiveness,
                    "description": f"Strategy effectiveness improved by {(current_effectiveness - prev_effectiveness)*100:.1f}%"
                }
                improvements.append(improvement)
        
        return improvements
    
    async def _get_next_strategy_preview(self, current_generation: int) -> Dict[str, Any]:
        """Get preview of next strategy"""
        # Try to find current generation data
        generation_key = None
        for key in self.generation_data.keys():
            if key.endswith(f"_{current_generation}"):
                generation_key = key
                break
        
        if generation_key and generation_key in self.generation_data:
            strategy_data = self.generation_data[generation_key]["next_strategy"]
            return {
                "generation": current_generation + 1,
                "complexity_level": strategy_data.get("complexity_level", 0.0),
                "key_adaptations": [
                    "Improved hive placement based on death analysis",
                    "Adaptive spawning timing from player patterns",
                    "Enhanced defensive coordination",
                    "Knowledge transfer from successful territories"
                ],
                "estimated_effectiveness": min(1.0, 0.7 + (current_generation * 0.02)),
                "knowledge_transfer_applied": len(self.knowledge_transfer_cache) > 0
            }
        
        return {
            "generation": current_generation + 1,
            "status": "generating",
            "estimated_completion": "60-120 seconds",
            "features": [
                "Neural network training in progress",
                "Analyzing recent death patterns",
                "Incorporating player behavior insights"
            ]
        }
    
    def _calculate_strategy_effectiveness(self, death_analysis: DeathAnalysis) -> float:
        """Calculate strategy effectiveness score with enhanced metrics"""
        base_score = 0.5
        
        # Adjust based on survival improvement
        survival_bonus = getattr(death_analysis, 'survival_improvement', 0) * 0.3
        
        # Adjust based on parasites spawned
        parasites_spawned = death_analysis.get_parasites_spawned() if hasattr(death_analysis, 'get_parasites_spawned') else 0
        spawn_effectiveness = min(1.0, parasites_spawned / 20.0) * 0.2
        
        # Adjust based on defensive performance
        failed_strategies = getattr(death_analysis, 'failed_strategies', [])
        defensive_bonus = max(0, 1.0 - len(failed_strategies) / 10.0) * 0.2
        
        # Adjust based on hive placement effectiveness
        spatial_insights = getattr(death_analysis, 'spatial_insights', {})
        placement_bonus = spatial_insights.get("placement_effectiveness", 0.5) * 0.1
        
        return min(1.0, base_score + survival_bonus + spawn_effectiveness + defensive_bonus + placement_bonus)
    
    def _calculate_learning_rate(self, recent_generations: List[int]) -> float:
        """Calculate learning rate based on recent improvements"""
        if len(recent_generations) < 2:
            return 0.5
        
        # Enhanced learning rate calculation
        improvement_count = 0
        total_generations = len(recent_generations)
        
        for i, gen in enumerate(recent_generations[1:], 1):
            prev_gen = recent_generations[i-1]
            
            # Check if this generation showed improvement
            if gen in self.generation_data and prev_gen in self.generation_data:
                current_score = self.generation_data[gen]["learning_metrics"]["success_score"]
                prev_score = self.generation_data[prev_gen]["learning_metrics"]["success_score"]
                
                if current_score > prev_score:
                    improvement_count += 1
        
        return min(1.0, improvement_count / max(total_generations - 1, 1))
    
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
        """Legacy method for backward compatibility"""
        await self._maintain_rolling_window()
    
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