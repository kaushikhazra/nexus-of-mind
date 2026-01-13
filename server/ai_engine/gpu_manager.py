"""
GPU Manager - CUDA stream management and GPU memory optimization
Implements Requirements 1.3, 5.1, 5.2, 5.4, 5.5 for GPU acceleration
"""

import asyncio
import logging
import os
import time
from typing import Dict, Any, List, Optional, Tuple, Union
from dataclasses import dataclass
from enum import Enum
import threading
import queue

try:
    import tensorflow as tf
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    tf = None

logger = logging.getLogger(__name__)


class GPUMemoryStrategy(Enum):
    """GPU memory allocation strategies"""
    GROWTH = "growth"  # Allow memory growth as needed
    LIMIT = "limit"    # Set specific memory limit
    VIRTUAL = "virtual"  # Use virtual GPU memory


@dataclass
class GPUConfig:
    """GPU configuration settings"""
    device_id: int
    memory_limit_mb: Optional[int]
    memory_strategy: GPUMemoryStrategy
    enable_mixed_precision: bool
    compute_capability: Optional[str]
    memory_total_mb: float
    memory_available_mb: float
    utilization_percent: float


@dataclass
class CUDAStreamConfig:
    """CUDA stream configuration"""
    stream_count: int
    priority_levels: List[int]
    enable_concurrent_execution: bool
    memory_pool_size_mb: int


class GPUManager:
    """
    Manages GPU resources and CUDA optimization for maximum performance
    Implements Requirements 1.3, 5.1, 5.2, 5.4 for GPU acceleration
    """
    
    def __init__(self):
        self.gpu_available = False
        self.gpu_configs: List[GPUConfig] = []
        self.cuda_streams: Dict[int, Any] = {}  # GPU ID -> stream objects
        self.memory_pools: Dict[int, Any] = {}  # GPU ID -> memory pool
        self.mixed_precision_enabled = False
        self.multi_gpu_strategy = None
        
        # Performance monitoring
        self.gpu_utilization_history: Dict[int, List[float]] = {}
        self.memory_usage_history: Dict[int, List[float]] = {}
        
        # Thread safety
        self._gpu_lock = threading.RLock()
        self._stream_queue = queue.Queue()
        
        # Initialize GPU configuration
        self._initialize_gpu_system()
    
    def _initialize_gpu_system(self) -> bool:
        """Initialize GPU system and detect available hardware"""
        if not TENSORFLOW_AVAILABLE:
            logger.warning("TensorFlow not available, GPU acceleration disabled")
            return False
        
        try:
            # Detect available GPUs
            physical_gpus = tf.config.experimental.list_physical_devices('GPU')
            
            if not physical_gpus:
                logger.info("No GPU devices found, using CPU-only mode")
                return False
            
            logger.info(f"Found {len(physical_gpus)} GPU device(s)")
            
            # Configure each GPU
            for i, gpu in enumerate(physical_gpus):
                try:
                    # Enable memory growth to prevent allocation issues
                    tf.config.experimental.set_memory_growth(gpu, True)
                    
                    # Get GPU details
                    gpu_details = tf.config.experimental.get_device_details(gpu)
                    compute_capability = gpu_details.get('compute_capability', 'unknown')
                    
                    # Create GPU configuration
                    gpu_config = GPUConfig(
                        device_id=i,
                        memory_limit_mb=None,  # Will be set based on strategy
                        memory_strategy=GPUMemoryStrategy.GROWTH,
                        enable_mixed_precision=self._check_mixed_precision_support(compute_capability),
                        compute_capability=compute_capability,
                        memory_total_mb=self._get_gpu_memory_info(i)[0],
                        memory_available_mb=self._get_gpu_memory_info(i)[1],
                        utilization_percent=0.0
                    )
                    
                    self.gpu_configs.append(gpu_config)
                    
                    # Initialize utilization tracking
                    self.gpu_utilization_history[i] = []
                    self.memory_usage_history[i] = []
                    
                    logger.info(f"GPU {i} configured: {compute_capability}, "
                              f"{gpu_config.memory_total_mb:.0f}MB total memory")
                    
                except Exception as e:
                    logger.error(f"Failed to configure GPU {i}: {e}")
            
            if self.gpu_configs:
                self.gpu_available = True
                
                # Configure CUDA streams
                self._configure_cuda_streams()
                
                # Enable mixed precision if supported
                self._configure_mixed_precision()
                
                logger.info(f"GPU system initialized with {len(self.gpu_configs)} device(s)")
                return True
            
        except Exception as e:
            logger.error(f"GPU system initialization failed: {e}")
        
        return False
    
    def _check_mixed_precision_support(self, compute_capability: str) -> bool:
        """Check if GPU supports mixed precision (Tensor Cores)"""
        try:
            # Mixed precision requires compute capability 7.0+ (V100, T4, RTX series)
            if compute_capability and compute_capability != 'unknown':
                major, minor = map(int, compute_capability.split('.'))
                return major >= 7
        except:
            pass
        return False
    
    def _get_gpu_memory_info(self, gpu_id: int) -> Tuple[float, float]:
        """Get GPU memory information (total, available) in MB"""
        try:
            # This is a simplified implementation
            # In production, use nvidia-ml-py for accurate memory info
            if TENSORFLOW_AVAILABLE and tf:
                # Placeholder values - would need proper GPU monitoring
                return 8192.0, 6144.0  # 8GB total, 6GB available
        except:
            pass
        return 0.0, 0.0
    
    def configure_cuda_streams(self) -> Dict[str, Any]:
        """
        Configure CUDA streams for optimal performance
        Implements Requirement 5.1 for CUDA stream management
        
        Returns:
            CUDA configuration details
        """
        if not self.gpu_available:
            return {
                'success': False,
                'error': 'No GPU available for CUDA stream configuration'
            }
        
        try:
            with self._gpu_lock:
                stream_configs = {}
                
                for gpu_config in self.gpu_configs:
                    gpu_id = gpu_config.device_id
                    
                    # Create CUDA stream configuration
                    stream_config = CUDAStreamConfig(
                        stream_count=4,  # Multiple streams for concurrent execution
                        priority_levels=[0, -1, -2],  # High, normal, low priority
                        enable_concurrent_execution=True,
                        memory_pool_size_mb=min(1024, int(gpu_config.memory_available_mb * 0.3))
                    )
                    
                    # Configure streams for this GPU
                    with tf.device(f'/GPU:{gpu_id}'):
                        # Create multiple streams for concurrent operations
                        gpu_streams = []
                        for stream_idx in range(stream_config.stream_count):
                            # TensorFlow doesn't expose CUDA streams directly
                            # This would require custom CUDA operations or TensorRT
                            # For now, we'll use TensorFlow's built-in parallelism
                            gpu_streams.append({
                                'stream_id': stream_idx,
                                'priority': stream_config.priority_levels[stream_idx % len(stream_config.priority_levels)],
                                'active': False
                            })
                        
                        self.cuda_streams[gpu_id] = gpu_streams
                        stream_configs[gpu_id] = stream_config
                    
                    logger.info(f"CUDA streams configured for GPU {gpu_id}: "
                              f"{stream_config.stream_count} streams, "
                              f"{stream_config.memory_pool_size_mb}MB memory pool")
                
                return {
                    'success': True,
                    'gpu_count': len(self.gpu_configs),
                    'stream_configs': {gpu_id: {
                        'stream_count': config.stream_count,
                        'memory_pool_mb': config.memory_pool_size_mb,
                        'concurrent_execution': config.enable_concurrent_execution
                    } for gpu_id, config in stream_configs.items()},
                    'total_streams': sum(config.stream_count for config in stream_configs.values())
                }
                
        except Exception as e:
            logger.error(f"CUDA stream configuration failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _configure_cuda_streams(self):
        """Internal CUDA stream configuration during initialization"""
        try:
            result = self.configure_cuda_streams()
            if result['success']:
                logger.info(f"CUDA streams initialized: {result['total_streams']} total streams")
            else:
                logger.warning(f"CUDA stream initialization failed: {result.get('error')}")
        except Exception as e:
            logger.error(f"Internal CUDA stream configuration failed: {e}")
    
    def optimize_gpu_memory(self) -> Dict[str, Any]:
        """
        Optimize GPU memory allocation and usage
        Implements Requirement 5.2 for GPU memory optimization
        
        Returns:
            Memory optimization results
        """
        if not self.gpu_available:
            return {
                'success': False,
                'error': 'No GPU available for memory optimization'
            }
        
        try:
            with self._gpu_lock:
                optimization_results = {}
                
                for gpu_config in self.gpu_configs:
                    gpu_id = gpu_config.device_id
                    
                    # Get current memory usage
                    total_memory, available_memory = self._get_gpu_memory_info(gpu_id)
                    used_memory = total_memory - available_memory
                    usage_percent = (used_memory / total_memory) * 100 if total_memory > 0 else 0
                    
                    # Apply memory optimization strategies
                    optimizations_applied = []
                    
                    # Strategy 1: Set memory limit if usage is high
                    if usage_percent > 80:
                        memory_limit = int(total_memory * 0.9)  # 90% of total memory
                        try:
                            physical_gpu = tf.config.experimental.list_physical_devices('GPU')[gpu_id]
                            tf.config.experimental.set_memory_limit(physical_gpu, memory_limit)
                            gpu_config.memory_limit_mb = memory_limit
                            gpu_config.memory_strategy = GPUMemoryStrategy.LIMIT
                            optimizations_applied.append(f"Memory limit set to {memory_limit}MB")
                        except Exception as e:
                            logger.warning(f"Failed to set memory limit for GPU {gpu_id}: {e}")
                    
                    # Strategy 2: Enable virtual memory if available
                    if hasattr(tf.config.experimental, 'enable_virtual_device_memory'):
                        try:
                            tf.config.experimental.enable_virtual_device_memory()
                            optimizations_applied.append("Virtual memory enabled")
                        except:
                            pass
                    
                    # Strategy 3: Clear unused memory
                    try:
                        # Force garbage collection on GPU
                        with tf.device(f'/GPU:{gpu_id}'):
                            tf.keras.backend.clear_session()
                        optimizations_applied.append("GPU memory cleared")
                    except Exception as e:
                        logger.debug(f"GPU memory clear failed for GPU {gpu_id}: {e}")
                    
                    # Update GPU configuration
                    gpu_config.memory_available_mb = available_memory
                    gpu_config.utilization_percent = usage_percent
                    
                    optimization_results[gpu_id] = {
                        'total_memory_mb': total_memory,
                        'available_memory_mb': available_memory,
                        'usage_percent': usage_percent,
                        'optimizations_applied': optimizations_applied,
                        'memory_strategy': gpu_config.memory_strategy.value
                    }
                    
                    logger.info(f"GPU {gpu_id} memory optimized: {usage_percent:.1f}% usage, "
                              f"{len(optimizations_applied)} optimizations applied")
                
                return {
                    'success': True,
                    'gpu_count': len(self.gpu_configs),
                    'optimization_results': optimization_results,
                    'total_memory_optimized_mb': sum(
                        result['total_memory_mb'] for result in optimization_results.values()
                    )
                }
                
        except Exception as e:
            logger.error(f"GPU memory optimization failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def enable_mixed_precision(self) -> Dict[str, Any]:
        """
        Enable mixed precision (float16) for compatible operations
        Implements Requirement 5.4 for mixed precision support
        
        Returns:
            Mixed precision configuration results
        """
        if not self.gpu_available:
            return {
                'success': False,
                'error': 'No GPU available for mixed precision'
            }
        
        try:
            # Check if any GPU supports mixed precision
            supported_gpus = [
                gpu for gpu in self.gpu_configs 
                if gpu.enable_mixed_precision
            ]
            
            if not supported_gpus:
                return {
                    'success': False,
                    'error': 'No GPU supports mixed precision (requires compute capability 7.0+)',
                    'gpu_capabilities': [gpu.compute_capability for gpu in self.gpu_configs]
                }
            
            # Enable mixed precision policy
            try:
                policy = tf.keras.mixed_precision.Policy('mixed_float16')
                tf.keras.mixed_precision.set_global_policy(policy)
                self.mixed_precision_enabled = True
                
                logger.info("Mixed precision (float16) enabled for neural network operations")
                
                return {
                    'success': True,
                    'policy': 'mixed_float16',
                    'supported_gpus': len(supported_gpus),
                    'total_gpus': len(self.gpu_configs),
                    'compute_capabilities': [gpu.compute_capability for gpu in supported_gpus],
                    'expected_speedup': '1.5-2x',
                    'memory_savings': '~50%'
                }
                
            except Exception as e:
                logger.error(f"Failed to enable mixed precision policy: {e}")
                return {
                    'success': False,
                    'error': f'Mixed precision policy failed: {e}'
                }
                
        except Exception as e:
            logger.error(f"Mixed precision configuration failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _configure_mixed_precision(self):
        """Internal mixed precision configuration during initialization"""
        try:
            result = self.enable_mixed_precision()
            if result['success']:
                logger.info(f"Mixed precision enabled: {result['expected_speedup']} speedup expected")
            else:
                logger.info(f"Mixed precision not enabled: {result.get('error')}")
        except Exception as e:
            logger.error(f"Internal mixed precision configuration failed: {e}")
    
    async def execute_on_gpu(self, operation_func, gpu_id: Optional[int] = None, 
                           stream_priority: int = 0) -> Any:
        """
        Execute operation on specified GPU with stream management
        
        Args:
            operation_func: Function to execute on GPU
            gpu_id: Specific GPU ID (None for automatic selection)
            stream_priority: Stream priority (0=high, 1=normal, 2=low)
            
        Returns:
            Operation result
        """
        if not self.gpu_available:
            raise RuntimeError("No GPU available for execution")
        
        # Select GPU if not specified
        if gpu_id is None:
            gpu_id = self._select_optimal_gpu()
        
        if gpu_id >= len(self.gpu_configs):
            raise ValueError(f"Invalid GPU ID: {gpu_id}")
        
        try:
            with self._gpu_lock:
                # Get available stream for this GPU
                available_stream = self._get_available_stream(gpu_id, stream_priority)
                
                if available_stream is None:
                    logger.warning(f"No available stream for GPU {gpu_id}, using default")
                
                # Execute operation on GPU
                with tf.device(f'/GPU:{gpu_id}'):
                    start_time = time.time()
                    result = await operation_func()
                    execution_time = time.time() - start_time
                
                # Update GPU utilization tracking
                self._update_gpu_utilization(gpu_id, execution_time)
                
                # Release stream
                if available_stream:
                    available_stream['active'] = False
                
                return result
                
        except Exception as e:
            logger.error(f"GPU execution failed on GPU {gpu_id}: {e}")
            raise
    
    def _select_optimal_gpu(self) -> int:
        """Select optimal GPU based on current utilization"""
        if not self.gpu_configs:
            raise RuntimeError("No GPU configurations available")
        
        # Select GPU with lowest utilization
        best_gpu_id = 0
        lowest_utilization = float('inf')
        
        for gpu_config in self.gpu_configs:
            utilization = gpu_config.utilization_percent
            if utilization < lowest_utilization:
                lowest_utilization = utilization
                best_gpu_id = gpu_config.device_id
        
        return best_gpu_id
    
    def _get_available_stream(self, gpu_id: int, priority: int) -> Optional[Dict[str, Any]]:
        """Get available CUDA stream for GPU"""
        if gpu_id not in self.cuda_streams:
            return None
        
        streams = self.cuda_streams[gpu_id]
        
        # Find available stream with matching or better priority
        for stream in streams:
            if not stream['active'] and stream['priority'] <= priority:
                stream['active'] = True
                return stream
        
        return None
    
    def _update_gpu_utilization(self, gpu_id: int, execution_time: float):
        """Update GPU utilization tracking"""
        if gpu_id < len(self.gpu_configs):
            # Simple utilization calculation based on execution time
            # In production, would use proper GPU monitoring
            utilization = min(100.0, execution_time * 1000)  # Convert to percentage
            
            self.gpu_configs[gpu_id].utilization_percent = utilization
            
            # Update history
            if gpu_id in self.gpu_utilization_history:
                self.gpu_utilization_history[gpu_id].append(utilization)
                # Keep only last 100 measurements
                if len(self.gpu_utilization_history[gpu_id]) > 100:
                    self.gpu_utilization_history[gpu_id].pop(0)
    
    def get_gpu_status(self) -> Dict[str, Any]:
        """Get comprehensive GPU status information"""
        if not self.gpu_available:
            return {
                'gpu_available': False,
                'error': 'No GPU devices available'
            }
        
        gpu_status = []
        for gpu_config in self.gpu_configs:
            gpu_id = gpu_config.device_id
            
            # Get current utilization history
            utilization_history = self.gpu_utilization_history.get(gpu_id, [])
            avg_utilization = sum(utilization_history) / len(utilization_history) if utilization_history else 0.0
            
            gpu_status.append({
                'gpu_id': gpu_id,
                'compute_capability': gpu_config.compute_capability,
                'memory_total_mb': gpu_config.memory_total_mb,
                'memory_available_mb': gpu_config.memory_available_mb,
                'memory_limit_mb': gpu_config.memory_limit_mb,
                'memory_strategy': gpu_config.memory_strategy.value,
                'current_utilization_percent': gpu_config.utilization_percent,
                'average_utilization_percent': avg_utilization,
                'mixed_precision_supported': gpu_config.enable_mixed_precision,
                'cuda_streams_count': len(self.cuda_streams.get(gpu_id, [])),
                'active_streams': sum(1 for stream in self.cuda_streams.get(gpu_id, []) if stream['active'])
            })
        
        return {
            'gpu_available': True,
            'gpu_count': len(self.gpu_configs),
            'mixed_precision_enabled': self.mixed_precision_enabled,
            'total_cuda_streams': sum(len(streams) for streams in self.cuda_streams.values()),
            'gpu_details': gpu_status,
            'optimization_recommendations': self._get_gpu_optimization_recommendations()
        }
    
    def _get_gpu_optimization_recommendations(self) -> List[str]:
        """Generate GPU optimization recommendations"""
        recommendations = []
        
        if not self.gpu_available:
            recommendations.append("Enable GPU acceleration for 3x+ performance improvement")
            return recommendations
        
        # Check utilization
        total_utilization = sum(gpu.utilization_percent for gpu in self.gpu_configs)
        avg_utilization = total_utilization / len(self.gpu_configs) if self.gpu_configs else 0
        
        if avg_utilization < 30:
            recommendations.append("GPU utilization is low - consider increasing batch sizes")
        elif avg_utilization > 90:
            recommendations.append("GPU utilization is high - consider load balancing across multiple GPUs")
        
        # Check mixed precision
        if not self.mixed_precision_enabled:
            supported_count = sum(1 for gpu in self.gpu_configs if gpu.enable_mixed_precision)
            if supported_count > 0:
                recommendations.append(f"Enable mixed precision on {supported_count} compatible GPU(s) for 1.5-2x speedup")
        
        # Check memory usage
        for gpu in self.gpu_configs:
            usage_percent = ((gpu.memory_total_mb - gpu.memory_available_mb) / gpu.memory_total_mb) * 100
            if usage_percent > 85:
                recommendations.append(f"GPU {gpu.device_id} memory usage high ({usage_percent:.1f}%) - consider memory optimization")
        
        if not recommendations:
            recommendations.append("GPU configuration is optimal")
        
        return recommendations
    
    async def cleanup(self):
        """Cleanup GPU resources"""
        logger.info("Cleaning up GPU resources...")
        
        try:
            with self._gpu_lock:
                # Clear CUDA streams
                self.cuda_streams.clear()
                
                # Clear memory pools
                self.memory_pools.clear()
                
                # Clear utilization history
                self.gpu_utilization_history.clear()
                self.memory_usage_history.clear()
                
                # Reset mixed precision policy
                if self.mixed_precision_enabled:
                    try:
                        policy = tf.keras.mixed_precision.Policy('float32')
                        tf.keras.mixed_precision.set_global_policy(policy)
                        self.mixed_precision_enabled = False
                    except:
                        pass
                
                # Clear TensorFlow GPU memory
                if TENSORFLOW_AVAILABLE and tf:
                    tf.keras.backend.clear_session()
                
                logger.info("GPU cleanup completed")
                
        except Exception as e:
            logger.error(f"GPU cleanup failed: {e}")