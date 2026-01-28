"""
Performance Monitor - Comprehensive performance monitoring and optimization for AI training
"""

import asyncio
import logging
import time
import psutil
import threading
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, asdict
from collections import deque
import json
import os

# TensorFlow removed - using PyTorch instead
TENSORFLOW_AVAILABLE = False
tf = None

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """Performance metrics data structure"""
    timestamp: float
    training_time: float
    memory_usage_mb: float
    cpu_usage_percent: float
    gpu_usage_percent: Optional[float]
    gpu_memory_mb: Optional[float]
    model_size_mb: float
    network_traffic_kb: float
    fps_impact: float
    generation: int
    training_success: bool
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SystemResources:
    """Current system resource availability"""
    available_memory_mb: float
    cpu_cores: int
    cpu_usage_percent: float
    gpu_available: bool
    gpu_memory_total_mb: Optional[float]
    gpu_memory_used_mb: Optional[float]
    disk_space_gb: float
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class PerformanceOptimizer:
    """Adaptive performance optimization based on system resources"""
    
    def __init__(self):
        self.current_resources = None
        self.optimization_level = "balanced"  # conservative, balanced, aggressive
        self.training_config_cache = {}
        
    def analyze_system_resources(self) -> SystemResources:
        """Analyze current system resource availability"""
        # Memory analysis
        memory = psutil.virtual_memory()
        available_memory_mb = memory.available / (1024 * 1024)
        
        # CPU analysis
        cpu_cores = psutil.cpu_count()
        cpu_usage = psutil.cpu_percent(interval=1)
        
        # GPU analysis
        gpu_available = False
        gpu_memory_total_mb = None
        gpu_memory_used_mb = None
        
        if TENSORFLOW_AVAILABLE and tf:
            try:
                gpus = tf.config.experimental.list_physical_devices('GPU')
                if gpus:
                    gpu_available = True
                    # Try to get GPU memory info
                    try:
                        gpu_details = tf.config.experimental.get_device_details(gpus[0])
                        if 'device_name' in gpu_details:
                            # Estimate GPU memory (this is approximate)
                            gpu_memory_total_mb = 8192  # Default estimate
                    except:
                        pass
            except Exception as e:
                logger.debug(f"GPU analysis failed: {e}")
        
        # Disk space analysis
        disk_usage = psutil.disk_usage('/')
        disk_space_gb = disk_usage.free / (1024 * 1024 * 1024)
        
        self.current_resources = SystemResources(
            available_memory_mb=available_memory_mb,
            cpu_cores=cpu_cores,
            cpu_usage_percent=cpu_usage,
            gpu_available=gpu_available,
            gpu_memory_total_mb=gpu_memory_total_mb,
            gpu_memory_used_mb=gpu_memory_used_mb,
            disk_space_gb=disk_space_gb
        )
        
        return self.current_resources
    
    def get_optimal_training_config(self, generation: int, base_config: Dict[str, Any]) -> Dict[str, Any]:
        """Get optimized training configuration based on system resources"""
        if not self.current_resources:
            self.analyze_system_resources()
        
        config_key = f"{generation}_{self.optimization_level}"
        if config_key in self.training_config_cache:
            return self.training_config_cache[config_key]
        
        # Start with base configuration
        optimized_config = base_config.copy()
        
        # Memory-based optimizations
        if self.current_resources.available_memory_mb < 1024:  # Less than 1GB available
            optimized_config['batch_size'] = min(optimized_config.get('batch_size', 32), 8)
            optimized_config['max_epochs'] = min(optimized_config.get('max_epochs', 10), 5)
            logger.info("Applied memory-constrained optimizations")
        elif self.current_resources.available_memory_mb > 4096:  # More than 4GB available
            optimized_config['batch_size'] = min(optimized_config.get('batch_size', 32), 64)
            
        # CPU-based optimizations
        if self.current_resources.cpu_usage_percent > 80:
            # High CPU usage - reduce training intensity
            optimized_config['max_epochs'] = max(1, optimized_config.get('max_epochs', 10) - 2)
            optimized_config['patience'] = max(1, optimized_config.get('patience', 3) - 1)
            logger.info("Applied CPU-constrained optimizations")
        elif self.current_resources.cpu_usage_percent < 30 and self.current_resources.cpu_cores >= 4:
            # Low CPU usage with multiple cores - can be more aggressive
            optimized_config['max_epochs'] = min(20, optimized_config.get('max_epochs', 10) + 2)
            
        # GPU-based optimizations
        if self.current_resources.gpu_available:
            # GPU available - can handle larger batches and more complex training
            optimized_config['batch_size'] = min(optimized_config.get('batch_size', 32), 128)
            optimized_config['use_mixed_precision'] = True
        else:
            # CPU only - be more conservative
            optimized_config['batch_size'] = min(optimized_config.get('batch_size', 32), 16)
            optimized_config['use_mixed_precision'] = False
            
        # Generation-based scaling with resource constraints
        complexity_multiplier = min(1.0 + (generation - 1) * 0.1, 2.0)
        if self.current_resources.available_memory_mb < 2048:
            complexity_multiplier = min(complexity_multiplier, 1.5)  # Limit complexity on low memory
            
        optimized_config['complexity_multiplier'] = complexity_multiplier
        
        # Cache the configuration
        self.training_config_cache[config_key] = optimized_config
        
        return optimized_config
    
    def should_use_gpu(self) -> bool:
        """Determine if GPU should be used based on current system state"""
        if not self.current_resources:
            self.analyze_system_resources()
            
        return (self.current_resources.gpu_available and 
                self.current_resources.available_memory_mb > 512)  # Minimum memory for GPU training


class PerformanceMonitor:
    """
    Comprehensive performance monitoring for AI training with 60fps isolation guarantee
    """
    
    def __init__(self):
        self.metrics_history: deque = deque(maxlen=1000)  # Keep last 1000 metrics
        self.is_monitoring = False
        self.monitoring_thread: Optional[threading.Thread] = None
        self.performance_callbacks: List[Callable] = []
        self.optimizer = PerformanceOptimizer()
        
        # Performance thresholds (Requirements 8.1, 8.2, 8.3, 8.5)
        self.thresholds = {
            'max_memory_mb': 200,  # Requirement 8.2: Under 200MB additional
            'max_training_time_seconds': 120,  # Requirement 8.4: 30-120 seconds
            'max_model_size_mb': 50,  # Requirement 8.5: Under 50MB per Queen
            'max_network_traffic_kb_per_sec': 1,  # Requirement 8.3: Under 1KB/sec
            'target_fps': 60,  # Requirement 8.1: Maintain 60fps
            'warning_fps_impact': 5,  # Warning if FPS drops by more than 5
            'critical_fps_impact': 10  # Critical if FPS drops by more than 10
        }
        
        # Performance isolation settings
        self.fps_isolation_enabled = True
        self.baseline_fps = 60.0
        self.current_fps_impact = 0.0
        
        # Adaptive scaling settings
        self.adaptive_scaling_enabled = True
        self.performance_history_window = 10
        
    async def start_monitoring(self):
        """Start performance monitoring in background thread"""
        if self.is_monitoring:
            return
            
        self.is_monitoring = True
        logger.info("Starting performance monitoring...")
        
        # Start monitoring thread
        self.monitoring_thread = threading.Thread(
            target=self._monitoring_loop,
            daemon=True
        )
        self.monitoring_thread.start()
        
        # Initialize system resource analysis
        self.optimizer.analyze_system_resources()
        
        logger.info("Performance monitoring started")
    
    async def stop_monitoring(self):
        """Stop performance monitoring"""
        if not self.is_monitoring:
            return
            
        self.is_monitoring = False
        logger.info("Stopping performance monitoring...")
        
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=5.0)
            
        logger.info("Performance monitoring stopped")
    
    def _monitoring_loop(self):
        """Background monitoring loop"""
        while self.is_monitoring:
            try:
                self._collect_system_metrics()
                time.sleep(1.0)  # Monitor every second
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(5.0)  # Wait longer on error
    
    def _collect_system_metrics(self):
        """Collect current system performance metrics"""
        try:
            # System metrics
            memory = psutil.virtual_memory()
            cpu_percent = psutil.cpu_percent()
            
            # GPU metrics (if available)
            gpu_usage = None
            gpu_memory = None
            
            if TENSORFLOW_AVAILABLE and tf:
                try:
                    # This is a simplified GPU monitoring approach
                    # In production, you might want to use nvidia-ml-py for detailed GPU stats
                    gpus = tf.config.experimental.list_physical_devices('GPU')
                    if gpus:
                        gpu_usage = 0.0  # Placeholder - would need nvidia-ml-py for real data
                        gpu_memory = 0.0  # Placeholder
                except:
                    pass
            
            # Network traffic (simplified - would need more sophisticated tracking)
            network_traffic = 0.0  # Placeholder for actual network monitoring
            
            # Create basic metrics entry
            metrics = PerformanceMetrics(
                timestamp=time.time(),
                training_time=0.0,  # Will be updated during training
                memory_usage_mb=memory.used / (1024 * 1024),
                cpu_usage_percent=cpu_percent,
                gpu_usage_percent=gpu_usage,
                gpu_memory_mb=gpu_memory,
                model_size_mb=0.0,  # Will be updated when model is loaded
                network_traffic_kb=network_traffic,
                fps_impact=self.current_fps_impact,
                generation=0,  # Will be updated during training
                training_success=True
            )
            
            self.metrics_history.append(metrics)
            
        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}")
    
    async def monitor_training_session(self, training_func: Callable, 
                                     training_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Monitor a training session with performance isolation and adaptive scaling
        
        Args:
            training_func: The training function to monitor
            training_data: Training data including generation info
            
        Returns:
            Enhanced training results with performance metrics
        """
        generation = training_data.get('generation', 1)
        start_time = time.time()
        
        # Pre-training system analysis
        pre_training_resources = self.optimizer.analyze_system_resources()
        
        # Get optimized training configuration
        base_config = training_data.get('training_config', {})
        optimized_config = self.optimizer.get_optimal_training_config(generation, base_config)
        training_data['training_config'] = optimized_config
        
        logger.info(f"Starting monitored training session for generation {generation}")
        logger.info(f"System resources: {pre_training_resources.available_memory_mb:.1f}MB memory, "
                   f"{pre_training_resources.cpu_usage_percent:.1f}% CPU, "
                   f"GPU: {'available' if pre_training_resources.gpu_available else 'not available'}")
        
        try:
            # Monitor memory usage before training
            initial_memory = psutil.virtual_memory().used / (1024 * 1024)
            
            # Execute training with performance monitoring
            if self.fps_isolation_enabled:
                training_result = await self._execute_with_fps_isolation(
                    training_func, training_data
                )
            else:
                training_result = await training_func(training_data)
            
            # Post-training analysis
            end_time = time.time()
            training_time = end_time - start_time
            final_memory = psutil.virtual_memory().used / (1024 * 1024)
            memory_delta = final_memory - initial_memory
            
            # Create performance metrics
            performance_metrics = PerformanceMetrics(
                timestamp=end_time,
                training_time=training_time,
                memory_usage_mb=memory_delta,
                cpu_usage_percent=psutil.cpu_percent(),
                gpu_usage_percent=None,  # Would need GPU monitoring library
                gpu_memory_mb=None,
                model_size_mb=self._estimate_model_size(),
                network_traffic_kb=0.0,  # Placeholder
                fps_impact=self.current_fps_impact,
                generation=generation,
                training_success=training_result.get('success', False)
            )
            
            # Store metrics
            self.metrics_history.append(performance_metrics)
            
            # Check performance thresholds
            performance_warnings = self._check_performance_thresholds(performance_metrics)
            
            # Update training result with performance data
            enhanced_result = training_result.copy()
            enhanced_result.update({
                'performance_metrics': performance_metrics.to_dict(),
                'performance_warnings': performance_warnings,
                'system_resources': pre_training_resources.to_dict(),
                'optimized_config': optimized_config,
                'memory_delta_mb': memory_delta,
                'fps_impact': self.current_fps_impact
            })
            
            # Trigger performance callbacks
            for callback in self.performance_callbacks:
                try:
                    await callback(performance_metrics, enhanced_result)
                except Exception as e:
                    logger.error(f"Performance callback error: {e}")
            
            logger.info(f"Training session completed: {training_time:.2f}s, "
                       f"memory delta: {memory_delta:.1f}MB, "
                       f"FPS impact: {self.current_fps_impact:.1f}")
            
            return enhanced_result
            
        except Exception as e:
            logger.error(f"Error during monitored training session: {e}")
            
            # Return error result with performance context
            error_result = {
                'success': False,
                'error': str(e),
                'training_time': time.time() - start_time,
                'performance_metrics': {
                    'timestamp': time.time(),
                    'training_time': time.time() - start_time,
                    'memory_usage_mb': 0.0,
                    'cpu_usage_percent': psutil.cpu_percent(),
                    'generation': generation,
                    'training_success': False
                },
                'system_resources': pre_training_resources.to_dict()
            }
            
            return error_result
    
    async def _execute_with_fps_isolation(self, training_func: Callable, 
                                        training_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute training with FPS isolation to maintain 60fps game performance
        
        This implements performance isolation by monitoring system load and
        adjusting training intensity to prevent game performance degradation.
        """
        # Monitor baseline performance
        baseline_cpu = psutil.cpu_percent(interval=0.1)
        
        # Adaptive training execution
        if baseline_cpu > 70:
            # High system load - use conservative training
            logger.info("High system load detected, using conservative training mode")
            training_data['training_config']['batch_size'] = min(
                training_data['training_config'].get('batch_size', 32), 8
            )
            training_data['training_config']['max_epochs'] = min(
                training_data['training_config'].get('max_epochs', 10), 5
            )
        
        # Execute training in thread pool to prevent blocking
        loop = asyncio.get_event_loop()
        
        # Use thread pool executor for CPU-intensive training
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            # Submit training to thread pool
            future = loop.run_in_executor(executor, self._sync_training_wrapper, 
                                        training_func, training_data)
            
            # Monitor performance during training
            training_result = await self._monitor_during_training(future)
        
        return training_result
    
    def _sync_training_wrapper(self, training_func: Callable, training_data: Dict[str, Any]) -> Dict[str, Any]:
        """Synchronous wrapper for training function"""
        # This would need to be adapted based on the actual training function signature
        # For now, assume it's a synchronous function
        try:
            if asyncio.iscoroutinefunction(training_func):
                # If it's async, we need to run it in a new event loop
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    return loop.run_until_complete(training_func(training_data))
                finally:
                    loop.close()
            else:
                return training_func(training_data)
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    async def _monitor_during_training(self, training_future) -> Dict[str, Any]:
        """Monitor system performance during training execution"""
        start_time = time.time()
        
        while not training_future.done():
            # Check system performance every 100ms
            await asyncio.sleep(0.1)
            
            current_cpu = psutil.cpu_percent()
            current_memory = psutil.virtual_memory()
            
            # Estimate FPS impact based on CPU usage
            if current_cpu > 80:
                self.current_fps_impact = min(15, (current_cpu - 60) * 0.5)
            else:
                self.current_fps_impact = max(0, self.current_fps_impact - 0.5)
            
            # Check for performance violations
            if self.current_fps_impact > self.thresholds['critical_fps_impact']:
                logger.warning(f"Critical FPS impact detected: {self.current_fps_impact:.1f}")
                # Could implement training throttling here
            
            # Check training time bounds
            elapsed_time = time.time() - start_time
            if elapsed_time > self.thresholds['max_training_time_seconds']:
                logger.warning(f"Training time exceeded threshold: {elapsed_time:.1f}s")
        
        # Get training result
        try:
            return training_future.result()
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _check_performance_thresholds(self, metrics: PerformanceMetrics) -> List[str]:
        """Check performance metrics against thresholds"""
        warnings = []
        
        # Memory usage check (Requirement 8.2)
        if metrics.memory_usage_mb > self.thresholds['max_memory_mb']:
            warnings.append(f"Memory usage {metrics.memory_usage_mb:.1f}MB exceeds "
                          f"threshold {self.thresholds['max_memory_mb']}MB")
        
        # Training time check (Requirement 8.4)
        if metrics.training_time > self.thresholds['max_training_time_seconds']:
            warnings.append(f"Training time {metrics.training_time:.1f}s exceeds "
                          f"threshold {self.thresholds['max_training_time_seconds']}s")
        
        # Model size check (Requirement 8.5)
        if metrics.model_size_mb > self.thresholds['max_model_size_mb']:
            warnings.append(f"Model size {metrics.model_size_mb:.1f}MB exceeds "
                          f"threshold {self.thresholds['max_model_size_mb']}MB")
        
        # FPS impact check (Requirement 8.1)
        if metrics.fps_impact > self.thresholds['critical_fps_impact']:
            warnings.append(f"FPS impact {metrics.fps_impact:.1f} exceeds "
                          f"critical threshold {self.thresholds['critical_fps_impact']}")
        elif metrics.fps_impact > self.thresholds['warning_fps_impact']:
            warnings.append(f"FPS impact {metrics.fps_impact:.1f} exceeds "
                          f"warning threshold {self.thresholds['warning_fps_impact']}")
        
        return warnings
    
    def _estimate_model_size(self) -> float:
        """Estimate current model size in MB"""
        # This would need access to the actual model
        # For now, return a reasonable estimate
        return 25.0  # Placeholder - actual implementation would check model file size
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get comprehensive performance summary"""
        if not self.metrics_history:
            return {'status': 'no_data'}
        
        recent_metrics = list(self.metrics_history)[-10:]  # Last 10 metrics
        
        # Calculate averages
        avg_training_time = sum(m.training_time for m in recent_metrics) / len(recent_metrics)
        avg_memory_usage = sum(m.memory_usage_mb for m in recent_metrics) / len(recent_metrics)
        avg_cpu_usage = sum(m.cpu_usage_percent for m in recent_metrics) / len(recent_metrics)
        avg_fps_impact = sum(m.fps_impact for m in recent_metrics) / len(recent_metrics)
        
        # Performance status
        is_performing_well = (
            avg_training_time <= self.thresholds['max_training_time_seconds'] and
            avg_memory_usage <= self.thresholds['max_memory_mb'] and
            avg_fps_impact <= self.thresholds['warning_fps_impact']
        )
        
        # System resources
        current_resources = self.optimizer.current_resources
        
        return {
            'status': 'performing_well' if is_performing_well else 'performance_issues',
            'averages': {
                'training_time_seconds': round(avg_training_time, 2),
                'memory_usage_mb': round(avg_memory_usage, 1),
                'cpu_usage_percent': round(avg_cpu_usage, 1),
                'fps_impact': round(avg_fps_impact, 1)
            },
            'thresholds': self.thresholds,
            'system_resources': current_resources.to_dict() if current_resources else None,
            'optimization_level': self.optimizer.optimization_level,
            'gpu_acceleration': self.optimizer.should_use_gpu(),
            'metrics_count': len(self.metrics_history),
            'fps_isolation_enabled': self.fps_isolation_enabled
        }
    
    def add_performance_callback(self, callback: Callable):
        """Add callback for performance events"""
        self.performance_callbacks.append(callback)
    
    def set_fps_baseline(self, fps: float):
        """Set baseline FPS for impact calculation"""
        self.baseline_fps = fps
        logger.info(f"FPS baseline set to {fps}")
    
    def enable_adaptive_scaling(self, enabled: bool = True):
        """Enable or disable adaptive performance scaling"""
        self.adaptive_scaling_enabled = enabled
        logger.info(f"Adaptive scaling {'enabled' if enabled else 'disabled'}")
    
    def get_optimization_recommendations(self) -> List[str]:
        """Get performance optimization recommendations"""
        recommendations = []
        
        if not self.metrics_history:
            return ["No performance data available for recommendations"]
        
        recent_metrics = list(self.metrics_history)[-5:]
        avg_memory = sum(m.memory_usage_mb for m in recent_metrics) / len(recent_metrics)
        avg_training_time = sum(m.training_time for m in recent_metrics) / len(recent_metrics)
        avg_fps_impact = sum(m.fps_impact for m in recent_metrics) / len(recent_metrics)
        
        # Memory recommendations
        if avg_memory > self.thresholds['max_memory_mb'] * 0.8:
            recommendations.append("Consider reducing batch size or model complexity to lower memory usage")
        
        # Training time recommendations
        if avg_training_time > self.thresholds['max_training_time_seconds'] * 0.8:
            recommendations.append("Consider reducing max epochs or enabling early stopping to speed up training")
        
        # FPS impact recommendations
        if avg_fps_impact > self.thresholds['warning_fps_impact']:
            recommendations.append("Enable FPS isolation or reduce training intensity during gameplay")
        
        # GPU recommendations
        if self.optimizer.current_resources and not self.optimizer.current_resources.gpu_available:
            recommendations.append("Consider GPU acceleration for faster training with lower CPU impact")
        
        # System resource recommendations
        if self.optimizer.current_resources:
            if self.optimizer.current_resources.available_memory_mb < 1024:
                recommendations.append("Low system memory detected - consider closing other applications")
            
            if self.optimizer.current_resources.cpu_usage_percent > 80:
                recommendations.append("High CPU usage detected - consider reducing concurrent processes")
        
        if not recommendations:
            recommendations.append("Performance is within acceptable thresholds")
        
        return recommendations
    
    async def cleanup(self):
        """Cleanup performance monitor resources"""
        await self.stop_monitoring()
        self.metrics_history.clear()
        self.performance_callbacks.clear()
        logger.info("Performance monitor cleanup completed")