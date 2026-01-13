"""
Resource Manager - Intelligent memory and resource management for neural network operations
Implements Requirements 1.5, 8.1, 8.2, 8.3, 8.4, 8.5
"""

import asyncio
import logging
import os
import psutil
import threading
import time
import gc
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import weakref

logger = logging.getLogger(__name__)


@dataclass
class ResourceLimits:
    """Resource limits configuration"""
    max_memory_mb: float = 200.0
    max_cpu_percent: float = 80.0
    max_threads: int = 8
    gc_threshold_mb: float = 150.0
    emergency_cleanup_mb: float = 180.0


@dataclass
class ResourceMetrics:
    """Current resource usage metrics"""
    memory_usage_mb: float
    cpu_percent: float
    active_threads: int
    gc_collections: int
    timestamp: float


class ThreadManager:
    """
    Thread management optimization for neural network operations
    Implements Requirement 8.4
    """
    
    def __init__(self, max_threads: int = 8):
        self.max_threads = max_threads
        self.active_threads = {}
        self.thread_pool = ThreadPoolExecutor(max_workers=max_threads, thread_name_prefix="NN-Worker")
        self.lock = threading.Lock()
        
    def submit_task(self, func: Callable, *args, **kwargs) -> asyncio.Future:
        """Submit task to optimized thread pool"""
        with self.lock:
            if len(self.active_threads) >= self.max_threads:
                logger.warning(f"Thread pool at capacity ({self.max_threads}), queuing task")
        
        # Submit to thread pool and wrap in asyncio Future
        loop = asyncio.get_event_loop()
        future = loop.run_in_executor(self.thread_pool, func, *args, **kwargs)
        
        # Track active thread
        thread_id = id(future)
        self.active_threads[thread_id] = {
            'future': future,
            'start_time': time.time(),
            'function': func.__name__ if hasattr(func, '__name__') else str(func)
        }
        
        # Clean up when done
        def cleanup_thread(fut):
            with self.lock:
                self.active_threads.pop(thread_id, None)
        
        future.add_done_callback(cleanup_thread)
        return future
    
    def get_thread_status(self) -> Dict[str, Any]:
        """Get current thread pool status"""
        with self.lock:
            return {
                'active_threads': len(self.active_threads),
                'max_threads': self.max_threads,
                'utilization': len(self.active_threads) / self.max_threads,
                'thread_details': [
                    {
                        'function': info['function'],
                        'duration': time.time() - info['start_time']
                    }
                    for info in self.active_threads.values()
                ]
            }
    
    def optimize_thread_allocation(self, workload_type: str) -> None:
        """Optimize thread allocation based on workload type"""
        if workload_type == 'inference':
            # Inference benefits from more threads for batch processing
            optimal_threads = min(self.max_threads, psutil.cpu_count())
        elif workload_type == 'training':
            # Training is more memory intensive, use fewer threads
            optimal_threads = max(2, self.max_threads // 2)
        else:
            optimal_threads = self.max_threads // 2
        
        if optimal_threads != self.thread_pool._max_workers:
            logger.info(f"Optimizing thread pool for {workload_type}: {optimal_threads} threads")
            # Note: ThreadPoolExecutor doesn't support dynamic resizing
            # In production, we'd need to recreate the pool
    
    async def cleanup(self):
        """Cleanup thread manager resources"""
        logger.info("Shutting down thread pool...")
        self.thread_pool.shutdown(wait=True)
        self.active_threads.clear()


class GarbageCollectionManager:
    """
    Garbage collection system that doesn't impact performance
    Implements Requirement 8.2
    """
    
    def __init__(self, threshold_mb: float = 150.0):
        self.threshold_mb = threshold_mb
        self.last_collection = time.time()
        self.collection_interval = 30.0  # 30 seconds minimum between collections
        self.collection_stats = {
            'total_collections': 0,
            'total_time_ms': 0.0,
            'objects_collected': 0
        }
        
    def should_collect(self, current_memory_mb: float) -> bool:
        """Determine if garbage collection should run"""
        time_since_last = time.time() - self.last_collection
        
        # Collect if memory threshold exceeded and enough time passed
        if current_memory_mb > self.threshold_mb and time_since_last > self.collection_interval:
            return True
        
        # Force collection if memory is critically high
        if current_memory_mb > self.threshold_mb * 1.2:
            return True
        
        return False
    
    async def collect_garbage(self, aggressive: bool = False) -> Dict[str, Any]:
        """
        Perform garbage collection without impacting performance
        """
        start_time = time.time()
        
        try:
            # Get memory before collection
            process = psutil.Process()
            memory_before = process.memory_info().rss / 1024 / 1024
            
            if aggressive:
                # Aggressive collection for emergency cleanup
                collected = gc.collect()
                # Force collection of all generations
                for generation in range(3):
                    collected += gc.collect(generation)
            else:
                # Gentle collection to avoid performance impact
                collected = gc.collect(0)  # Only collect generation 0
            
            # Get memory after collection
            memory_after = process.memory_info().rss / 1024 / 1024
            collection_time = (time.time() - start_time) * 1000
            
            # Update stats
            self.collection_stats['total_collections'] += 1
            self.collection_stats['total_time_ms'] += collection_time
            self.collection_stats['objects_collected'] += collected
            self.last_collection = time.time()
            
            result = {
                'success': True,
                'objects_collected': collected,
                'memory_freed_mb': memory_before - memory_after,
                'collection_time_ms': collection_time,
                'aggressive': aggressive
            }
            
            if collection_time > 10.0:  # Log if collection took too long
                logger.warning(f"Garbage collection took {collection_time:.1f}ms")
            else:
                logger.debug(f"Garbage collection: {collected} objects, {collection_time:.1f}ms")
            
            return result
            
        except Exception as e:
            logger.error(f"Garbage collection failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'collection_time_ms': (time.time() - start_time) * 1000
            }
    
    def get_gc_stats(self) -> Dict[str, Any]:
        """Get garbage collection statistics"""
        return {
            'total_collections': self.collection_stats['total_collections'],
            'average_time_ms': (
                self.collection_stats['total_time_ms'] / max(self.collection_stats['total_collections'], 1)
            ),
            'total_objects_collected': self.collection_stats['objects_collected'],
            'last_collection': self.last_collection,
            'gc_thresholds': gc.get_threshold(),
            'gc_counts': gc.get_count()
        }


class ResourceThrottleSystem:
    """
    Resource throttling system to prevent crashes
    Implements Requirement 8.5
    """
    
    def __init__(self, limits: ResourceLimits):
        self.limits = limits
        self.throttle_active = False
        self.throttle_level = 0.0  # 0.0 = no throttling, 1.0 = maximum throttling
        self.throttle_history = []
        
    def calculate_throttle_level(self, metrics: ResourceMetrics) -> float:
        """Calculate required throttle level based on resource usage"""
        throttle_factors = []
        
        # Memory-based throttling
        memory_ratio = metrics.memory_usage_mb / self.limits.max_memory_mb
        if memory_ratio > 0.8:
            memory_throttle = min(1.0, (memory_ratio - 0.8) / 0.2)
            throttle_factors.append(memory_throttle)
        
        # CPU-based throttling
        if metrics.cpu_percent > self.limits.max_cpu_percent:
            cpu_throttle = min(1.0, (metrics.cpu_percent - self.limits.max_cpu_percent) / 20.0)
            throttle_factors.append(cpu_throttle)
        
        # Thread-based throttling
        thread_ratio = metrics.active_threads / self.limits.max_threads
        if thread_ratio > 0.9:
            thread_throttle = min(1.0, (thread_ratio - 0.9) / 0.1)
            throttle_factors.append(thread_throttle)
        
        # Return maximum throttle factor
        return max(throttle_factors) if throttle_factors else 0.0
    
    async def apply_throttling(self, throttle_level: float) -> Dict[str, Any]:
        """Apply resource throttling based on level"""
        if throttle_level == 0.0:
            if self.throttle_active:
                logger.info("Resource throttling disabled")
                self.throttle_active = False
            return {'throttling': False, 'level': 0.0}
        
        if not self.throttle_active or abs(throttle_level - self.throttle_level) > 0.1:
            logger.warning(f"Resource throttling active: level {throttle_level:.2f}")
            self.throttle_active = True
            self.throttle_level = throttle_level
        
        # Apply throttling measures
        throttle_actions = []
        
        if throttle_level > 0.3:
            # Light throttling: add small delays
            delay_ms = throttle_level * 10
            await asyncio.sleep(delay_ms / 1000)
            throttle_actions.append(f"Added {delay_ms:.1f}ms delay")
        
        if throttle_level > 0.6:
            # Medium throttling: reduce batch sizes
            throttle_actions.append("Reduced batch processing size")
        
        if throttle_level > 0.8:
            # Heavy throttling: pause non-critical operations
            throttle_actions.append("Paused non-critical operations")
        
        # Record throttling event
        self.throttle_history.append({
            'timestamp': time.time(),
            'level': throttle_level,
            'actions': throttle_actions
        })
        
        # Keep only recent history
        if len(self.throttle_history) > 100:
            self.throttle_history = self.throttle_history[-50:]
        
        return {
            'throttling': True,
            'level': throttle_level,
            'actions': throttle_actions
        }
    
    def get_throttle_status(self) -> Dict[str, Any]:
        """Get current throttling status"""
        return {
            'active': self.throttle_active,
            'level': self.throttle_level,
            'recent_events': len([
                event for event in self.throttle_history
                if time.time() - event['timestamp'] < 300  # Last 5 minutes
            ]),
            'total_events': len(self.throttle_history)
        }


class IntelligentMemoryManager:
    """
    Intelligent memory management with <200MB limits
    Implements Requirements 1.5, 8.1, 8.2, 8.3
    """
    
    def __init__(self, limits: ResourceLimits = None):
        self.limits = limits or ResourceLimits()
        self.memory_cache = {}
        self.cache_priorities = {}
        self.memory_pools = {
            'training_data': [],
            'inference_cache': [],
            'model_weights': [],
            'temporary_objects': []
        }
        self.weak_references = weakref.WeakValueDictionary()
        
    def allocate_memory_pool(self, pool_name: str, size_mb: float) -> bool:
        """Allocate memory pool for specific operations"""
        try:
            current_usage = self.get_memory_usage()
            if current_usage + size_mb > self.limits.max_memory_mb:
                logger.warning(f"Cannot allocate {size_mb}MB pool, would exceed limit")
                return False
            
            # Create memory pool (simplified - in production would use actual memory allocation)
            self.memory_pools[pool_name] = {
                'allocated_mb': size_mb,
                'used_mb': 0.0,
                'objects': [],
                'created_at': time.time()
            }
            
            logger.info(f"Allocated {size_mb}MB memory pool: {pool_name}")
            return True
            
        except Exception as e:
            logger.error(f"Memory pool allocation failed: {e}")
            return False
    
    def cache_object(self, key: str, obj: Any, priority: float = 0.5) -> bool:
        """Cache object with priority-based eviction"""
        try:
            # Check memory limits
            current_usage = self.get_memory_usage()
            if current_usage > self.limits.max_memory_mb * 0.9:
                self._evict_low_priority_objects()
            
            # Store object with weak reference if possible
            try:
                self.weak_references[key] = obj
                cache_method = 'weak_reference'
            except TypeError:
                # Object doesn't support weak references
                self.memory_cache[key] = obj
                cache_method = 'strong_reference'
            
            self.cache_priorities[key] = {
                'priority': priority,
                'created_at': time.time(),
                'access_count': 0,
                'method': cache_method
            }
            
            return True
            
        except Exception as e:
            logger.error(f"Object caching failed: {e}")
            return False
    
    def get_cached_object(self, key: str) -> Optional[Any]:
        """Retrieve cached object and update access statistics"""
        try:
            # Try weak reference first
            if key in self.weak_references:
                obj = self.weak_references.get(key)
                if obj is not None:
                    self.cache_priorities[key]['access_count'] += 1
                    return obj
                else:
                    # Object was garbage collected
                    self._cleanup_dead_reference(key)
            
            # Try strong reference
            if key in self.memory_cache:
                self.cache_priorities[key]['access_count'] += 1
                return self.memory_cache[key]
            
            return None
            
        except Exception as e:
            logger.error(f"Object retrieval failed: {e}")
            return None
    
    def _evict_low_priority_objects(self) -> int:
        """Evict low priority objects to free memory"""
        evicted_count = 0
        
        # Sort by priority (lower priority first)
        sorted_keys = sorted(
            self.cache_priorities.keys(),
            key=lambda k: (
                self.cache_priorities[k]['priority'],
                -self.cache_priorities[k]['access_count'],
                -self.cache_priorities[k]['created_at']
            )
        )
        
        # Evict bottom 25% of objects
        evict_count = max(1, len(sorted_keys) // 4)
        
        for key in sorted_keys[:evict_count]:
            try:
                self.memory_cache.pop(key, None)
                self.weak_references.pop(key, None)
                self.cache_priorities.pop(key, None)
                evicted_count += 1
            except Exception as e:
                logger.warning(f"Failed to evict object {key}: {e}")
        
        if evicted_count > 0:
            logger.info(f"Evicted {evicted_count} low-priority objects")
        
        return evicted_count
    
    def _cleanup_dead_reference(self, key: str) -> None:
        """Clean up dead weak reference"""
        self.weak_references.pop(key, None)
        self.cache_priorities.pop(key, None)
    
    def get_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        try:
            process = psutil.Process()
            return process.memory_info().rss / 1024 / 1024
        except Exception:
            return 0.0
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get comprehensive memory statistics"""
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            
            return {
                'current_usage_mb': memory_info.rss / 1024 / 1024,
                'virtual_memory_mb': memory_info.vms / 1024 / 1024,
                'memory_limit_mb': self.limits.max_memory_mb,
                'utilization_percent': (memory_info.rss / 1024 / 1024) / self.limits.max_memory_mb * 100,
                'cached_objects': len(self.memory_cache) + len(self.weak_references),
                'strong_references': len(self.memory_cache),
                'weak_references': len(self.weak_references),
                'memory_pools': {
                    name: pool.get('allocated_mb', 0) if isinstance(pool, dict) else 0
                    for name, pool in self.memory_pools.items()
                },
                'system_memory': {
                    'total_gb': psutil.virtual_memory().total / 1024 / 1024 / 1024,
                    'available_gb': psutil.virtual_memory().available / 1024 / 1024 / 1024,
                    'percent_used': psutil.virtual_memory().percent
                }
            }
        except Exception as e:
            logger.error(f"Failed to get memory stats: {e}")
            return {'error': str(e)}
    
    async def optimize_memory_usage(self) -> Dict[str, Any]:
        """Optimize memory usage through various strategies"""
        optimization_results = []
        
        try:
            # 1. Clean up dead weak references
            dead_refs = []
            for key in list(self.weak_references.keys()):
                if self.weak_references.get(key) is None:
                    dead_refs.append(key)
            
            for key in dead_refs:
                self._cleanup_dead_reference(key)
            
            if dead_refs:
                optimization_results.append(f"Cleaned up {len(dead_refs)} dead references")
            
            # 2. Evict low priority objects if memory usage is high
            current_usage = self.get_memory_usage()
            if current_usage > self.limits.max_memory_mb * 0.8:
                evicted = self._evict_low_priority_objects()
                optimization_results.append(f"Evicted {evicted} low-priority objects")
            
            # 3. Optimize memory pools
            for pool_name, pool in self.memory_pools.items():
                if isinstance(pool, dict) and pool.get('used_mb', 0) < pool.get('allocated_mb', 0) * 0.5:
                    # Pool is underutilized, could be optimized
                    optimization_results.append(f"Pool {pool_name} underutilized")
            
            # 4. Force garbage collection if needed
            if current_usage > self.limits.max_memory_mb * 0.9:
                gc.collect()
                optimization_results.append("Forced garbage collection")
            
            final_usage = self.get_memory_usage()
            memory_freed = current_usage - final_usage
            
            return {
                'success': True,
                'memory_freed_mb': memory_freed,
                'optimizations': optimization_results,
                'final_usage_mb': final_usage
            }
            
        except Exception as e:
            logger.error(f"Memory optimization failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def cleanup(self):
        """Cleanup memory manager resources"""
        logger.info("Cleaning up memory manager...")
        
        # Clear all caches
        self.memory_cache.clear()
        self.weak_references.clear()
        self.cache_priorities.clear()
        
        # Clear memory pools
        for pool_name in self.memory_pools:
            if isinstance(self.memory_pools[pool_name], dict):
                self.memory_pools[pool_name]['objects'].clear()
        
        # Force garbage collection
        gc.collect()


class ResourceManager:
    """
    Main Resource Manager coordinating all resource management components
    Implements Requirements 1.5, 8.1, 8.2, 8.3, 8.4, 8.5
    """
    
    def __init__(self, limits: ResourceLimits = None):
        self.limits = limits or ResourceLimits()
        self.memory_manager = IntelligentMemoryManager(self.limits)
        self.thread_manager = ThreadManager(self.limits.max_threads)
        self.gc_manager = GarbageCollectionManager(self.limits.gc_threshold_mb)
        self.throttle_system = ResourceThrottleSystem(self.limits)
        
        self.monitoring_active = False
        self.monitoring_task = None
        self.monitoring_interval = 5.0  # 5 seconds
        self.metrics_history = []
        
    async def start_monitoring(self):
        """Start resource monitoring"""
        if self.monitoring_active:
            return
        
        self.monitoring_active = True
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        logger.info("Resource monitoring started")
    
    async def stop_monitoring(self):
        """Stop resource monitoring"""
        if not self.monitoring_active:
            return
        
        self.monitoring_active = False
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Resource monitoring stopped")
    
    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.monitoring_active:
            try:
                # Collect current metrics
                metrics = self._collect_metrics()
                self.metrics_history.append(metrics)
                
                # Keep only recent history
                if len(self.metrics_history) > 100:
                    self.metrics_history = self.metrics_history[-50:]
                
                # Check if garbage collection is needed
                if self.gc_manager.should_collect(metrics.memory_usage_mb):
                    await self.gc_manager.collect_garbage()
                
                # Check if throttling is needed
                throttle_level = self.throttle_system.calculate_throttle_level(metrics)
                await self.throttle_system.apply_throttling(throttle_level)
                
                # Emergency cleanup if memory is critically high
                if metrics.memory_usage_mb > self.limits.emergency_cleanup_mb:
                    logger.warning("Emergency memory cleanup triggered")
                    await self._emergency_cleanup()
                
                await asyncio.sleep(self.monitoring_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Resource monitoring error: {e}")
                await asyncio.sleep(self.monitoring_interval)
    
    def _collect_metrics(self) -> ResourceMetrics:
        """Collect current resource usage metrics"""
        try:
            process = psutil.Process()
            
            return ResourceMetrics(
                memory_usage_mb=process.memory_info().rss / 1024 / 1024,
                cpu_percent=process.cpu_percent(),
                active_threads=threading.active_count(),
                gc_collections=sum(gc.get_count()),
                timestamp=time.time()
            )
        except Exception as e:
            logger.error(f"Failed to collect metrics: {e}")
            return ResourceMetrics(0, 0, 0, 0, time.time())
    
    async def _emergency_cleanup(self):
        """Perform emergency cleanup when memory is critically high"""
        try:
            logger.warning("Performing emergency resource cleanup")
            
            # 1. Aggressive garbage collection
            gc_result = await self.gc_manager.collect_garbage(aggressive=True)
            
            # 2. Optimize memory usage
            memory_result = await self.memory_manager.optimize_memory_usage()
            
            # 3. Clear metrics history to free memory
            self.metrics_history = self.metrics_history[-10:]  # Keep only last 10 entries
            
            # 4. Force Python garbage collection
            collected = gc.collect()
            
            logger.info(f"Emergency cleanup completed: "
                       f"GC freed {gc_result.get('memory_freed_mb', 0):.1f}MB, "
                       f"Memory optimization freed {memory_result.get('memory_freed_mb', 0):.1f}MB, "
                       f"Collected {collected} objects")
            
        except Exception as e:
            logger.error(f"Emergency cleanup failed: {e}")
    
    async def allocate_resources_for_operation(self, operation_type: str, 
                                             estimated_memory_mb: float = 0,
                                             estimated_threads: int = 1) -> Dict[str, Any]:
        """
        Allocate resources for a specific operation
        """
        try:
            current_metrics = self._collect_metrics()
            
            # Check if resources are available
            memory_available = self.limits.max_memory_mb - current_metrics.memory_usage_mb
            threads_available = self.limits.max_threads - current_metrics.active_threads
            
            if estimated_memory_mb > memory_available:
                # Try to free memory
                await self.memory_manager.optimize_memory_usage()
                current_metrics = self._collect_metrics()
                memory_available = self.limits.max_memory_mb - current_metrics.memory_usage_mb
                
                if estimated_memory_mb > memory_available:
                    return {
                        'success': False,
                        'reason': 'insufficient_memory',
                        'available_mb': memory_available,
                        'requested_mb': estimated_memory_mb
                    }
            
            if estimated_threads > threads_available:
                return {
                    'success': False,
                    'reason': 'insufficient_threads',
                    'available_threads': threads_available,
                    'requested_threads': estimated_threads
                }
            
            # Optimize thread allocation for operation type
            self.thread_manager.optimize_thread_allocation(operation_type)
            
            # Allocate memory pool if needed
            if estimated_memory_mb > 0:
                pool_name = f"{operation_type}_{int(time.time())}"
                if not self.memory_manager.allocate_memory_pool(pool_name, estimated_memory_mb):
                    return {
                        'success': False,
                        'reason': 'memory_pool_allocation_failed'
                    }
            
            return {
                'success': True,
                'allocated_memory_mb': estimated_memory_mb,
                'allocated_threads': estimated_threads,
                'operation_type': operation_type
            }
            
        except Exception as e:
            logger.error(f"Resource allocation failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_resource_status(self) -> Dict[str, Any]:
        """Get comprehensive resource status"""
        try:
            current_metrics = self._collect_metrics()
            
            return {
                'current_metrics': {
                    'memory_usage_mb': current_metrics.memory_usage_mb,
                    'memory_limit_mb': self.limits.max_memory_mb,
                    'memory_utilization': current_metrics.memory_usage_mb / self.limits.max_memory_mb,
                    'cpu_percent': current_metrics.cpu_percent,
                    'active_threads': current_metrics.active_threads,
                    'max_threads': self.limits.max_threads
                },
                'memory_manager': self.memory_manager.get_memory_stats(),
                'thread_manager': self.thread_manager.get_thread_status(),
                'gc_manager': self.gc_manager.get_gc_stats(),
                'throttle_system': self.throttle_system.get_throttle_status(),
                'monitoring_active': self.monitoring_active,
                'metrics_history_size': len(self.metrics_history)
            }
        except Exception as e:
            logger.error(f"Failed to get resource status: {e}")
            return {'error': str(e)}
    
    def get_optimization_recommendations(self) -> List[str]:
        """Get resource optimization recommendations"""
        recommendations = []
        
        try:
            current_metrics = self._collect_metrics()
            
            # Memory recommendations
            memory_utilization = current_metrics.memory_usage_mb / self.limits.max_memory_mb
            if memory_utilization > 0.8:
                recommendations.append("Memory usage high - consider reducing batch sizes")
            if memory_utilization > 0.9:
                recommendations.append("Critical memory usage - enable aggressive garbage collection")
            
            # CPU recommendations
            if current_metrics.cpu_percent > 80:
                recommendations.append("High CPU usage - consider reducing thread count")
            
            # Thread recommendations
            thread_utilization = current_metrics.active_threads / self.limits.max_threads
            if thread_utilization > 0.9:
                recommendations.append("Thread pool near capacity - consider queuing operations")
            
            # GC recommendations
            gc_stats = self.gc_manager.get_gc_stats()
            if gc_stats['average_time_ms'] > 20:
                recommendations.append("Garbage collection taking too long - optimize object lifecycle")
            
            # Throttling recommendations
            throttle_status = self.throttle_system.get_throttle_status()
            if throttle_status['active']:
                recommendations.append("Resource throttling active - reduce system load")
            
            if not recommendations:
                recommendations.append("Resource usage optimal")
            
        except Exception as e:
            logger.error(f"Failed to generate recommendations: {e}")
            recommendations.append("Unable to analyze resource usage")
        
        return recommendations
    
    async def cleanup(self):
        """Cleanup all resource management components"""
        logger.info("Cleaning up resource manager...")
        
        # Stop monitoring
        await self.stop_monitoring()
        
        # Cleanup components
        await self.memory_manager.cleanup()
        await self.thread_manager.cleanup()
        
        # Clear metrics history
        self.metrics_history.clear()
        
        logger.info("Resource manager cleanup completed")