"""
Enhanced Memory Manager - Extends existing memory manager with intelligent resource management
Integrates with ResourceManager for comprehensive memory and resource optimization
Implements Requirements 1.5, 8.1, 8.2, 8.3, 8.4, 8.5
"""

import asyncio
import logging
import time
from typing import Dict, Any, List, Optional
from .memory_manager import QueenMemoryManager
from .resource_manager import ResourceManager, ResourceLimits
from .data_models import DeathAnalysis, QueenStrategy

logger = logging.getLogger(__name__)


class EnhancedMemoryManager(QueenMemoryManager):
    """
    Enhanced Memory Manager that combines existing Queen memory management
    with intelligent resource management and optimization
    """
    
    def __init__(self, resource_limits: ResourceLimits = None):
        # Initialize parent class
        super().__init__()
        
        # Initialize resource management
        self.resource_manager = ResourceManager(resource_limits)
        self.resource_monitoring_active = False
        
        # Enhanced memory management settings
        self.intelligent_cleanup_enabled = True
        self.adaptive_compression_enabled = True
        self.performance_aware_storage = True
        
        # Performance tracking
        self.operation_metrics = {
            'store_operations': [],
            'retrieval_operations': [],
            'cleanup_operations': []
        }
        
        # Memory optimization strategies
        self.optimization_strategies = {
            'aggressive_compression': False,
            'lazy_loading': True,
            'smart_caching': True,
            'predictive_cleanup': True
        }
    
    async def initialize(self):
        """Initialize enhanced memory manager with resource monitoring"""
        try:
            logger.info("Initializing enhanced memory manager...")
            
            # Start resource monitoring
            await self.resource_manager.start_monitoring()
            self.resource_monitoring_active = True
            
            # Start background cleanup with resource awareness
            self.start_background_cleanup()
            
            # Load existing data if available
            await self.load_from_disk()
            
            logger.info("Enhanced memory manager initialized successfully")
            
        except Exception as e:
            logger.error(f"Enhanced memory manager initialization failed: {e}")
            raise
    
    async def store_generation_data(self, generation: int, death_analysis: DeathAnalysis, 
                                   strategy: QueenStrategy, territory_id: str = None):
        """
        Enhanced generation data storage with resource management
        """
        start_time = time.time()
        
        try:
            # Check resource availability before storing
            estimated_memory = self._estimate_storage_memory_requirement(death_analysis, strategy)
            
            allocation_result = await self.resource_manager.allocate_resources_for_operation(
                'memory_storage',
                estimated_memory_mb=estimated_memory,
                estimated_threads=1
            )
            
            if not allocation_result['success']:
                logger.warning(f"Resource allocation failed for generation {generation}: "
                             f"{allocation_result.get('reason', 'unknown')}")
                
                # Try to free resources and retry
                await self._intelligent_resource_cleanup()
                
                allocation_result = await self.resource_manager.allocate_resources_for_operation(
                    'memory_storage',
                    estimated_memory_mb=estimated_memory,
                    estimated_threads=1
                )
                
                if not allocation_result['success']:
                    raise RuntimeError(f"Cannot allocate resources for generation storage: "
                                     f"{allocation_result.get('reason', 'unknown')}")
            
            # Perform adaptive compression if enabled
            if self.adaptive_compression_enabled:
                death_analysis, strategy = await self._adaptive_compress_data(
                    death_analysis, strategy, generation
                )
            
            # Store using parent method with resource awareness
            await super().store_generation_data(generation, death_analysis, strategy, territory_id)
            
            # Track operation metrics
            operation_time = time.time() - start_time
            self.operation_metrics['store_operations'].append({
                'generation': generation,
                'territory_id': territory_id,
                'operation_time': operation_time,
                'memory_used': estimated_memory,
                'timestamp': time.time()
            })
            
            # Maintain metrics history
            self._maintain_metrics_history()
            
            # Trigger intelligent cleanup if needed
            if self.intelligent_cleanup_enabled:
                await self._check_and_trigger_cleanup()
            
            logger.debug(f"Enhanced generation storage completed in {operation_time:.3f}s")
            
        except Exception as e:
            logger.error(f"Enhanced generation data storage failed: {e}")
            raise
    
    async def store_success_data(self, generation: int, success_data: Dict[str, Any], 
                                training_result: Dict[str, Any]):
        """
        Enhanced success data storage with resource optimization
        """
        start_time = time.time()
        
        try:
            # Estimate resource requirements
            estimated_memory = self._estimate_success_data_memory(success_data, training_result)
            
            # Allocate resources
            allocation_result = await self.resource_manager.allocate_resources_for_operation(
                'success_storage',
                estimated_memory_mb=estimated_memory
            )
            
            if allocation_result['success']:
                # Store using parent method
                await super().store_success_data(generation, success_data, training_result)
                
                # Track metrics
                operation_time = time.time() - start_time
                self.operation_metrics['store_operations'].append({
                    'type': 'success_data',
                    'generation': generation,
                    'operation_time': operation_time,
                    'memory_used': estimated_memory,
                    'timestamp': time.time()
                })
            else:
                logger.warning(f"Resource allocation failed for success data storage: "
                             f"{allocation_result.get('reason', 'unknown')}")
                
                # Store with reduced data if resources are limited
                await self._store_compressed_success_data(generation, success_data, training_result)
            
        except Exception as e:
            logger.error(f"Enhanced success data storage failed: {e}")
            raise
    
    async def get_learning_progress(self, queen_id: str, territory_id: str = None) -> Dict[str, Any]:
        """
        Enhanced learning progress retrieval with resource optimization
        """
        start_time = time.time()
        
        try:
            # Get base learning progress
            progress = await super().get_learning_progress(queen_id, territory_id)
            
            # Add resource management insights
            resource_status = self.resource_manager.get_resource_status()
            progress['resource_management'] = {
                'memory_efficiency': resource_status['memory_manager'].get('utilization_percent', 0),
                'optimization_active': self.intelligent_cleanup_enabled,
                'compression_ratio': self._calculate_overall_compression_ratio(),
                'storage_optimization': self._get_storage_optimization_stats()
            }
            
            # Add performance metrics
            progress['performance_metrics'] = self._get_performance_metrics()
            
            # Track retrieval operation
            operation_time = time.time() - start_time
            self.operation_metrics['retrieval_operations'].append({
                'queen_id': queen_id,
                'territory_id': territory_id,
                'operation_time': operation_time,
                'timestamp': time.time()
            })
            
            return progress
            
        except Exception as e:
            logger.error(f"Enhanced learning progress retrieval failed: {e}")
            return {"error": str(e)}
    
    async def _adaptive_compress_data(self, death_analysis: DeathAnalysis, 
                                    strategy: QueenStrategy, generation: int) -> tuple:
        """
        Adaptively compress data based on resource availability and generation age
        """
        try:
            resource_status = self.resource_manager.get_resource_status()
            memory_pressure = resource_status['current_metrics']['memory_utilization']
            
            # Determine compression level based on memory pressure and generation age
            if memory_pressure > 0.8 or generation < self._get_current_generation() - 5:
                # High compression for old generations or high memory pressure
                compressed_analysis = self._compress_death_analysis(death_analysis, level='high')
                compressed_strategy = self._compress_strategy(strategy, level='high')
            elif memory_pressure > 0.6:
                # Medium compression for moderate memory pressure
                compressed_analysis = self._compress_death_analysis(death_analysis, level='medium')
                compressed_strategy = self._compress_strategy(strategy, level='medium')
            else:
                # Light compression or no compression
                compressed_analysis = death_analysis
                compressed_strategy = strategy
            
            return compressed_analysis, compressed_strategy
            
        except Exception as e:
            logger.error(f"Adaptive compression failed: {e}")
            return death_analysis, strategy
    
    def _compress_death_analysis(self, death_analysis: DeathAnalysis, level: str = 'medium') -> DeathAnalysis:
        """Compress death analysis data based on compression level"""
        try:
            if level == 'high':
                # Keep only essential information
                essential_data = {
                    'primary_cause': getattr(death_analysis, 'primary_cause', 'unknown'),
                    'survival_improvement': getattr(death_analysis, 'survival_improvement', 0),
                    'key_insights': self._extract_key_insights_from_analysis(death_analysis)
                }
            elif level == 'medium':
                # Keep important information with some detail
                essential_data = death_analysis.to_dict()
                # Remove verbose fields
                essential_data.pop('detailed_logs', None)
                essential_data.pop('raw_game_state', None)
            else:
                return death_analysis
            
            # Create compressed death analysis object
            # Note: This would need proper implementation based on DeathAnalysis structure
            return death_analysis  # Placeholder - would implement actual compression
            
        except Exception as e:
            logger.error(f"Death analysis compression failed: {e}")
            return death_analysis
    
    def _compress_strategy(self, strategy: QueenStrategy, level: str = 'medium') -> QueenStrategy:
        """Compress strategy data based on compression level"""
        try:
            if level == 'high':
                # Keep only core strategy elements
                strategy_dict = strategy.to_dict()
                compressed_dict = {
                    'generation': strategy_dict.get('generation', 1),
                    'core_strategy': self._extract_core_strategy_elements(strategy_dict),
                    'complexity_level': strategy_dict.get('complexity_level', 0.5)
                }
                return QueenStrategy.from_dict(compressed_dict)
            elif level == 'medium':
                # Remove detailed parameters but keep structure
                strategy_dict = strategy.to_dict()
                # Remove verbose parameter details
                for key in list(strategy_dict.keys()):
                    if isinstance(strategy_dict[key], dict) and 'detailed_params' in strategy_dict[key]:
                        strategy_dict[key].pop('detailed_params', None)
                return QueenStrategy.from_dict(strategy_dict)
            else:
                return strategy
                
        except Exception as e:
            logger.error(f"Strategy compression failed: {e}")
            return strategy
    
    def _extract_key_insights_from_analysis(self, death_analysis: DeathAnalysis) -> List[str]:
        """Extract key insights from death analysis for compression"""
        insights = []
        
        try:
            if hasattr(death_analysis, 'primary_cause'):
                insights.append(f"death_cause:{death_analysis.primary_cause}")
            
            if hasattr(death_analysis, 'survival_improvement') and death_analysis.survival_improvement > 0:
                insights.append(f"improvement:{death_analysis.survival_improvement:.2f}")
            
            # Add other key insights based on analysis structure
            
        except Exception as e:
            logger.error(f"Key insights extraction failed: {e}")
        
        return insights
    
    def _extract_core_strategy_elements(self, strategy_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Extract core strategy elements for high compression"""
        core_elements = {}
        
        try:
            # Extract essential strategy components
            if 'hive_placement' in strategy_dict:
                core_elements['hive_placement'] = strategy_dict['hive_placement'].get('strategy', 'default')
            
            if 'parasite_spawning' in strategy_dict:
                core_elements['parasite_spawning'] = strategy_dict['parasite_spawning'].get('strategy', 'default')
            
            if 'defensive_coordination' in strategy_dict:
                core_elements['defensive_coordination'] = strategy_dict['defensive_coordination'].get('strategy', 'default')
            
        except Exception as e:
            logger.error(f"Core strategy extraction failed: {e}")
        
        return core_elements
    
    async def _intelligent_resource_cleanup(self):
        """Perform intelligent resource cleanup based on current system state"""
        start_time = time.time()
        
        try:
            logger.info("Performing intelligent resource cleanup...")
            
            cleanup_actions = []
            
            # 1. Memory manager optimization
            memory_result = await self.resource_manager.memory_manager.optimize_memory_usage()
            if memory_result['success']:
                cleanup_actions.append(f"Memory optimization freed {memory_result['memory_freed_mb']:.1f}MB")
            
            # 2. Garbage collection
            gc_result = await self.resource_manager.gc_manager.collect_garbage()
            if gc_result['success']:
                cleanup_actions.append(f"GC collected {gc_result['objects_collected']} objects")
            
            # 3. Compress old generation data
            compressed_count = await self._compress_old_generations()
            if compressed_count > 0:
                cleanup_actions.append(f"Compressed {compressed_count} old generations")
            
            # 4. Clean up low-priority cached data
            cache_cleaned = await self._cleanup_low_priority_cache()
            if cache_cleaned > 0:
                cleanup_actions.append(f"Cleaned {cache_cleaned} cache entries")
            
            # Track cleanup operation
            operation_time = time.time() - start_time
            self.operation_metrics['cleanup_operations'].append({
                'operation_time': operation_time,
                'actions': cleanup_actions,
                'timestamp': time.time()
            })
            
            logger.info(f"Intelligent cleanup completed in {operation_time:.3f}s: {', '.join(cleanup_actions)}")
            
        except Exception as e:
            logger.error(f"Intelligent resource cleanup failed: {e}")
    
    async def _compress_old_generations(self) -> int:
        """Compress old generation data to save memory"""
        compressed_count = 0
        
        try:
            current_gen = self._get_current_generation()
            compression_threshold = current_gen - 3  # Compress generations older than 3
            
            for key, data in list(self.generation_data.items()):
                if not data.get('compressed', False):
                    generation = data.get('generation', 0)
                    if generation <= compression_threshold:
                        # Compress this generation
                        await self._compress_generation_data(key, data)
                        compressed_count += 1
            
        except Exception as e:
            logger.error(f"Old generation compression failed: {e}")
        
        return compressed_count
    
    async def _cleanup_low_priority_cache(self) -> int:
        """Clean up low-priority cached data"""
        cleaned_count = 0
        
        try:
            # Clean up knowledge transfer cache entries older than 7 days
            cutoff_time = time.time() - (7 * 24 * 3600)
            
            old_transfers = [
                transfer_id for transfer_id, data in self.knowledge_transfer_cache.items()
                if data.get('timestamp', 0) < cutoff_time
            ]
            
            for transfer_id in old_transfers:
                del self.knowledge_transfer_cache[transfer_id]
                cleaned_count += 1
            
            # Clean up compressed patterns with low access frequency
            low_access_patterns = [
                pattern_id for pattern_id, data in self.compressed_patterns.items()
                if data.get('access_count', 0) < 2 and data.get('timestamp', 0) < cutoff_time
            ]
            
            for pattern_id in low_access_patterns:
                del self.compressed_patterns[pattern_id]
                cleaned_count += 1
            
        except Exception as e:
            logger.error(f"Low-priority cache cleanup failed: {e}")
        
        return cleaned_count
    
    async def _check_and_trigger_cleanup(self):
        """Check if cleanup is needed and trigger if necessary"""
        try:
            resource_status = self.resource_manager.get_resource_status()
            memory_utilization = resource_status['current_metrics']['memory_utilization']
            
            # Trigger cleanup if memory utilization is high
            if memory_utilization > 0.8:
                await self._intelligent_resource_cleanup()
            elif memory_utilization > 0.7 and self.optimization_strategies['predictive_cleanup']:
                # Predictive cleanup for moderate memory pressure
                await self._predictive_cleanup()
            
        except Exception as e:
            logger.error(f"Cleanup check failed: {e}")
    
    async def _predictive_cleanup(self):
        """Perform predictive cleanup based on usage patterns"""
        try:
            # Analyze recent operation patterns
            recent_operations = self._get_recent_operations()
            
            if self._predict_memory_pressure(recent_operations):
                logger.info("Predictive cleanup triggered based on usage patterns")
                await self._intelligent_resource_cleanup()
            
        except Exception as e:
            logger.error(f"Predictive cleanup failed: {e}")
    
    def _predict_memory_pressure(self, recent_operations: List[Dict[str, Any]]) -> bool:
        """Predict if memory pressure will increase based on recent operations"""
        try:
            if len(recent_operations) < 5:
                return False
            
            # Calculate memory usage trend
            memory_usage_trend = []
            for op in recent_operations[-5:]:
                memory_usage_trend.append(op.get('memory_used', 0))
            
            # Check if memory usage is increasing
            if len(memory_usage_trend) >= 3:
                recent_avg = sum(memory_usage_trend[-3:]) / 3
                earlier_avg = sum(memory_usage_trend[:-3]) / max(len(memory_usage_trend) - 3, 1)
                
                return recent_avg > earlier_avg * 1.2  # 20% increase indicates pressure
            
            return False
            
        except Exception as e:
            logger.error(f"Memory pressure prediction failed: {e}")
            return False
    
    def _get_recent_operations(self) -> List[Dict[str, Any]]:
        """Get recent operations for analysis"""
        recent_ops = []
        cutoff_time = time.time() - 300  # Last 5 minutes
        
        for op_type in self.operation_metrics:
            for op in self.operation_metrics[op_type]:
                if op.get('timestamp', 0) > cutoff_time:
                    recent_ops.append(op)
        
        return sorted(recent_ops, key=lambda x: x.get('timestamp', 0))
    
    def _estimate_storage_memory_requirement(self, death_analysis: DeathAnalysis, 
                                           strategy: QueenStrategy) -> float:
        """Estimate memory requirement for storing generation data"""
        try:
            # Rough estimation based on object sizes
            base_memory = 0.5  # Base overhead in MB
            
            # Estimate death analysis size
            analysis_size = 0.2  # Base analysis size
            if hasattr(death_analysis, 'detailed_logs'):
                analysis_size += 0.3  # Additional for detailed logs
            
            # Estimate strategy size
            strategy_size = 0.1  # Base strategy size
            strategy_dict = strategy.to_dict()
            if len(str(strategy_dict)) > 1000:  # Large strategy
                strategy_size += 0.2
            
            return base_memory + analysis_size + strategy_size
            
        except Exception as e:
            logger.error(f"Memory estimation failed: {e}")
            return 1.0  # Default estimate
    
    def _estimate_success_data_memory(self, success_data: Dict[str, Any], 
                                    training_result: Dict[str, Any]) -> float:
        """Estimate memory requirement for success data"""
        try:
            base_memory = 0.2
            data_size = len(str(success_data)) / 10000  # Rough size estimation
            result_size = len(str(training_result)) / 10000
            
            return base_memory + data_size + result_size
            
        except Exception as e:
            logger.error(f"Success data memory estimation failed: {e}")
            return 0.5  # Default estimate
    
    async def _store_compressed_success_data(self, generation: int, success_data: Dict[str, Any], 
                                           training_result: Dict[str, Any]):
        """Store success data in compressed format when resources are limited"""
        try:
            # Create compressed version of success data
            compressed_success = {
                'generation': generation,
                'effectiveness': success_data.get('effectiveness', 1.0),
                'survival_time': success_data.get('survival_time', 0),
                'key_strategies': success_data.get('successful_strategies', [])[:3],  # Top 3 only
                'training_summary': {
                    'success': training_result.get('success', False),
                    'training_time': training_result.get('training_time', 0),
                    'accuracy': training_result.get('accuracy', 0.5)
                }
            }
            
            # Store compressed version
            await super().store_success_data(generation, compressed_success, compressed_success['training_summary'])
            
            logger.info(f"Stored compressed success data for generation {generation}")
            
        except Exception as e:
            logger.error(f"Compressed success data storage failed: {e}")
    
    def _calculate_overall_compression_ratio(self) -> float:
        """Calculate overall compression ratio across all compressed data"""
        try:
            if not self.compressed_patterns:
                return 1.0
            
            total_ratio = sum(
                data.get('compression_ratio', 1.0) 
                for data in self.compressed_patterns.values()
            )
            
            return total_ratio / len(self.compressed_patterns)
            
        except Exception as e:
            logger.error(f"Compression ratio calculation failed: {e}")
            return 1.0
    
    def _get_storage_optimization_stats(self) -> Dict[str, Any]:
        """Get storage optimization statistics"""
        try:
            total_generations = len(self.generation_data)
            compressed_generations = len([
                data for data in self.generation_data.values()
                if data.get('compressed', False)
            ])
            
            return {
                'total_generations': total_generations,
                'compressed_generations': compressed_generations,
                'compression_percentage': (compressed_generations / max(total_generations, 1)) * 100,
                'adaptive_compression_enabled': self.adaptive_compression_enabled,
                'intelligent_cleanup_enabled': self.intelligent_cleanup_enabled
            }
            
        except Exception as e:
            logger.error(f"Storage optimization stats failed: {e}")
            return {'error': str(e)}
    
    def _get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for operations"""
        try:
            metrics = {}
            
            for op_type, operations in self.operation_metrics.items():
                if operations:
                    times = [op['operation_time'] for op in operations]
                    metrics[op_type] = {
                        'count': len(operations),
                        'average_time': sum(times) / len(times),
                        'max_time': max(times),
                        'min_time': min(times)
                    }
                else:
                    metrics[op_type] = {'count': 0}
            
            return metrics
            
        except Exception as e:
            logger.error(f"Performance metrics calculation failed: {e}")
            return {'error': str(e)}
    
    def _maintain_metrics_history(self):
        """Maintain operation metrics history within reasonable limits"""
        max_history = 100
        
        for op_type in self.operation_metrics:
            if len(self.operation_metrics[op_type]) > max_history:
                # Keep only recent operations
                self.operation_metrics[op_type] = self.operation_metrics[op_type][-max_history//2:]
    
    def get_enhanced_memory_statistics(self) -> Dict[str, Any]:
        """Get comprehensive enhanced memory statistics"""
        try:
            base_stats = self.get_memory_statistics()
            resource_status = self.resource_manager.get_resource_status()
            
            enhanced_stats = {
                'base_memory_stats': base_stats,
                'resource_management': resource_status,
                'optimization_strategies': self.optimization_strategies,
                'performance_metrics': self._get_performance_metrics(),
                'compression_stats': {
                    'overall_ratio': self._calculate_overall_compression_ratio(),
                    'adaptive_enabled': self.adaptive_compression_enabled,
                    'compressed_patterns': len(self.compressed_patterns)
                },
                'cleanup_stats': {
                    'intelligent_enabled': self.intelligent_cleanup_enabled,
                    'recent_cleanups': len([
                        op for op in self.operation_metrics['cleanup_operations']
                        if time.time() - op['timestamp'] < 3600  # Last hour
                    ])
                }
            }
            
            return enhanced_stats
            
        except Exception as e:
            logger.error(f"Enhanced memory statistics failed: {e}")
            return {'error': str(e)}
    
    async def cleanup(self):
        """Enhanced cleanup with resource management"""
        try:
            logger.info("Starting enhanced memory manager cleanup...")
            
            # Stop resource monitoring
            if self.resource_monitoring_active:
                await self.resource_manager.stop_monitoring()
                self.resource_monitoring_active = False
            
            # Perform final resource cleanup
            await self._intelligent_resource_cleanup()
            
            # Cleanup resource manager
            await self.resource_manager.cleanup()
            
            # Clear operation metrics
            for op_type in self.operation_metrics:
                self.operation_metrics[op_type].clear()
            
            # Call parent cleanup
            await super().cleanup()
            
            logger.info("Enhanced memory manager cleanup completed")
            
        except Exception as e:
            logger.error(f"Enhanced cleanup failed: {e}")
            raise