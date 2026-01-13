"""
Multi-GPU Coordinator - Distributed processing across multiple GPUs
Implements Requirements 5.2 for multi-GPU coordination and distributed processing
"""

import asyncio
import logging
import time
from typing import Dict, Any, List, Optional, Callable, Tuple
from dataclasses import dataclass
from enum import Enum
import threading
import queue
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import tensorflow as tf
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    tf = None

from .gpu_manager import GPUManager, GPUConfig

logger = logging.getLogger(__name__)


class DistributionStrategy(Enum):
    """Multi-GPU distribution strategies"""
    MIRRORED = "mirrored"  # Synchronous training across GPUs
    PARAMETER_SERVER = "parameter_server"  # Asynchronous parameter server
    MULTI_WORKER_MIRRORED = "multi_worker_mirrored"  # Multi-machine mirrored
    CENTRAL_STORAGE = "central_storage"  # Central storage strategy
    DATA_PARALLEL = "data_parallel"  # Data parallelism
    MODEL_PARALLEL = "model_parallel"  # Model parallelism


@dataclass
class MultiGPUConfig:
    """Multi-GPU coordination configuration"""
    strategy: DistributionStrategy
    gpu_count: int
    batch_size_per_gpu: int
    synchronization_mode: str  # 'sync' or 'async'
    communication_backend: str  # 'nccl', 'gloo', 'mpi'
    gradient_compression: bool
    all_reduce_algorithm: str


@dataclass
class WorkloadDistribution:
    """Workload distribution across GPUs"""
    gpu_id: int
    workload_size: int
    priority: int
    estimated_time_ms: float
    memory_required_mb: float


class MultiGPUCoordinator:
    """
    Coordinates distributed processing across multiple GPUs
    Implements Requirement 5.2 for multi-GPU coordination
    """
    
    def __init__(self, gpu_manager: GPUManager):
        self.gpu_manager = gpu_manager
        self.distribution_strategy = None
        self.strategy_scope = None
        self.workload_queue = queue.PriorityQueue()
        self.active_workers: Dict[int, bool] = {}
        self.performance_metrics: Dict[int, List[float]] = {}
        
        # Thread pool for parallel execution
        self.executor = ThreadPoolExecutor(max_workers=8)
        
        # Synchronization
        self._coordination_lock = threading.RLock()
        self._strategy_lock = threading.Lock()
        
        # Initialize multi-GPU system
        self._initialize_multi_gpu()
    
    def _initialize_multi_gpu(self):
        """Initialize multi-GPU coordination system"""
        if not self.gpu_manager.gpu_available:
            logger.info("No GPU available, multi-GPU coordination disabled")
            return
        
        gpu_count = len(self.gpu_manager.gpu_configs)
        
        if gpu_count < 2:
            logger.info(f"Only {gpu_count} GPU available, multi-GPU coordination not needed")
            return
        
        try:
            # Initialize performance tracking for each GPU
            for gpu_config in self.gpu_manager.gpu_configs:
                gpu_id = gpu_config.device_id
                self.active_workers[gpu_id] = False
                self.performance_metrics[gpu_id] = []
            
            # Configure default distribution strategy
            self._configure_distribution_strategy(gpu_count)
            
            logger.info(f"Multi-GPU coordinator initialized for {gpu_count} GPUs")
            
        except Exception as e:
            logger.error(f"Multi-GPU initialization failed: {e}")
    
    def _configure_distribution_strategy(self, gpu_count: int):
        """Configure TensorFlow distribution strategy"""
        try:
            if gpu_count >= 2:
                # Use MirroredStrategy for synchronous multi-GPU training
                self.distribution_strategy = tf.distribute.MirroredStrategy()
                self.strategy_scope = self.distribution_strategy.scope()
                
                logger.info(f"MirroredStrategy configured for {gpu_count} GPUs")
            
        except Exception as e:
            logger.error(f"Distribution strategy configuration failed: {e}")
    
    def coordinate_multi_gpu(self, gpus: List[GPUConfig]) -> Dict[str, Any]:
        """
        Coordinate workload distribution across multiple GPUs
        Implements Requirement 5.2 for multi-GPU coordination
        
        Args:
            gpus: List of GPU configurations to coordinate
            
        Returns:
            Multi-GPU coordination results
        """
        if len(gpus) < 2:
            return {
                'success': False,
                'error': 'Multi-GPU coordination requires at least 2 GPUs',
                'gpu_count': len(gpus)
            }
        
        try:
            with self._coordination_lock:
                # Create multi-GPU configuration
                config = MultiGPUConfig(
                    strategy=DistributionStrategy.MIRRORED,
                    gpu_count=len(gpus),
                    batch_size_per_gpu=self._calculate_optimal_batch_size(gpus),
                    synchronization_mode='sync',
                    communication_backend='nccl',
                    gradient_compression=True,
                    all_reduce_algorithm='ring'
                )
                
                # Configure distribution strategy
                strategy_result = self._setup_distribution_strategy(config)
                
                if not strategy_result['success']:
                    return strategy_result
                
                # Initialize workload distribution
                distribution_result = self._initialize_workload_distribution(gpus, config)
                
                # Set up inter-GPU communication
                communication_result = self._setup_inter_gpu_communication(gpus, config)
                
                return {
                    'success': True,
                    'configuration': {
                        'strategy': config.strategy.value,
                        'gpu_count': config.gpu_count,
                        'batch_size_per_gpu': config.batch_size_per_gpu,
                        'synchronization_mode': config.synchronization_mode,
                        'communication_backend': config.communication_backend
                    },
                    'distribution_strategy': strategy_result,
                    'workload_distribution': distribution_result,
                    'communication_setup': communication_result,
                    'expected_speedup': f"{min(len(gpus), 4)}x",  # Realistic speedup expectation
                    'memory_scaling': f"{len(gpus)}x effective memory"
                }
                
        except Exception as e:
            logger.error(f"Multi-GPU coordination failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _calculate_optimal_batch_size(self, gpus: List[GPUConfig]) -> int:
        """Calculate optimal batch size per GPU"""
        # Find GPU with least available memory
        min_memory = min(gpu.memory_available_mb for gpu in gpus)
        
        # Conservative batch size calculation
        # Assume ~50MB per batch element for neural network
        max_batch_size = int(min_memory / 50)
        
        # Ensure batch size is reasonable (between 4 and 64)
        optimal_batch_size = max(4, min(64, max_batch_size))
        
        logger.info(f"Calculated optimal batch size per GPU: {optimal_batch_size}")
        return optimal_batch_size
    
    def _setup_distribution_strategy(self, config: MultiGPUConfig) -> Dict[str, Any]:
        """Set up TensorFlow distribution strategy"""
        try:
            if config.strategy == DistributionStrategy.MIRRORED:
                # Configure MirroredStrategy
                if not self.distribution_strategy:
                    self.distribution_strategy = tf.distribute.MirroredStrategy()
                
                # Get strategy info
                num_replicas = self.distribution_strategy.num_replicas_in_sync
                
                return {
                    'success': True,
                    'strategy_type': 'MirroredStrategy',
                    'num_replicas': num_replicas,
                    'cross_device_ops': str(self.distribution_strategy.cross_device_ops),
                    'reduce_to_device': str(self.distribution_strategy.extended.parameter_devices)
                }
            
            elif config.strategy == DistributionStrategy.PARAMETER_SERVER:
                # Parameter server strategy (for async training)
                # This would require more complex setup with parameter servers
                return {
                    'success': False,
                    'error': 'Parameter server strategy not implemented in this version'
                }
            
            else:
                return {
                    'success': False,
                    'error': f'Unsupported distribution strategy: {config.strategy.value}'
                }
                
        except Exception as e:
            logger.error(f"Distribution strategy setup failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _initialize_workload_distribution(self, gpus: List[GPUConfig], 
                                        config: MultiGPUConfig) -> Dict[str, Any]:
        """Initialize workload distribution across GPUs"""
        try:
            distributions = []
            
            for i, gpu in enumerate(gpus):
                # Calculate workload based on GPU capabilities
                workload_size = self._calculate_gpu_workload(gpu, config)
                
                distribution = WorkloadDistribution(
                    gpu_id=gpu.device_id,
                    workload_size=workload_size,
                    priority=0,  # Equal priority for now
                    estimated_time_ms=self._estimate_processing_time(workload_size, gpu),
                    memory_required_mb=workload_size * 50  # Estimate 50MB per workload unit
                )
                
                distributions.append(distribution)
            
            # Balance workloads across GPUs
            balanced_distributions = self._balance_workloads(distributions)
            
            return {
                'success': True,
                'distributions': [
                    {
                        'gpu_id': dist.gpu_id,
                        'workload_size': dist.workload_size,
                        'estimated_time_ms': dist.estimated_time_ms,
                        'memory_required_mb': dist.memory_required_mb
                    }
                    for dist in balanced_distributions
                ],
                'total_workload': sum(dist.workload_size for dist in balanced_distributions),
                'load_balance_ratio': self._calculate_load_balance_ratio(balanced_distributions)
            }
            
        except Exception as e:
            logger.error(f"Workload distribution initialization failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _calculate_gpu_workload(self, gpu: GPUConfig, config: MultiGPUConfig) -> int:
        """Calculate appropriate workload size for a GPU"""
        # Base workload on GPU memory and compute capability
        base_workload = config.batch_size_per_gpu
        
        # Adjust based on GPU memory
        memory_factor = gpu.memory_available_mb / 4096  # Normalize to 4GB baseline
        
        # Adjust based on compute capability
        compute_factor = 1.0
        if gpu.compute_capability and gpu.compute_capability != 'unknown':
            try:
                major, minor = map(int, gpu.compute_capability.split('.'))
                compute_factor = (major + minor * 0.1) / 7.0  # Normalize to compute 7.0
            except:
                pass
        
        # Calculate final workload
        workload = int(base_workload * memory_factor * compute_factor)
        return max(1, workload)  # Ensure at least 1 unit of work
    
    def _estimate_processing_time(self, workload_size: int, gpu: GPUConfig) -> float:
        """Estimate processing time for workload on specific GPU"""
        # Base time per workload unit (in ms)
        base_time_per_unit = 10.0
        
        # Adjust based on GPU compute capability
        compute_factor = 1.0
        if gpu.compute_capability and gpu.compute_capability != 'unknown':
            try:
                major, minor = map(int, gpu.compute_capability.split('.'))
                # Higher compute capability = faster processing
                compute_factor = 7.0 / (major + minor * 0.1)
            except:
                pass
        
        # Adjust based on current utilization
        utilization_factor = 1.0 + (gpu.utilization_percent / 100.0)
        
        estimated_time = workload_size * base_time_per_unit * compute_factor * utilization_factor
        return estimated_time
    
    def _balance_workloads(self, distributions: List[WorkloadDistribution]) -> List[WorkloadDistribution]:
        """Balance workloads across GPUs for optimal performance"""
        if len(distributions) <= 1:
            return distributions
        
        # Calculate total workload
        total_workload = sum(dist.workload_size for dist in distributions)
        
        # Calculate target workload per GPU based on capabilities
        total_capability = sum(
            dist.workload_size / dist.estimated_time_ms if dist.estimated_time_ms > 0 else 1.0
            for dist in distributions
        )
        
        # Redistribute workloads
        balanced_distributions = []
        for dist in distributions:
            capability_ratio = (dist.workload_size / dist.estimated_time_ms) / total_capability if dist.estimated_time_ms > 0 else 1.0 / len(distributions)
            new_workload_size = int(total_workload * capability_ratio)
            
            balanced_dist = WorkloadDistribution(
                gpu_id=dist.gpu_id,
                workload_size=max(1, new_workload_size),
                priority=dist.priority,
                estimated_time_ms=self._estimate_processing_time(new_workload_size, 
                                                               self._get_gpu_config(dist.gpu_id)),
                memory_required_mb=new_workload_size * 50
            )
            
            balanced_distributions.append(balanced_dist)
        
        return balanced_distributions
    
    def _get_gpu_config(self, gpu_id: int) -> GPUConfig:
        """Get GPU configuration by ID"""
        for gpu in self.gpu_manager.gpu_configs:
            if gpu.device_id == gpu_id:
                return gpu
        
        # Return default config if not found
        return GPUConfig(
            device_id=gpu_id,
            memory_limit_mb=None,
            memory_strategy=self.gpu_manager.gpu_configs[0].memory_strategy,
            enable_mixed_precision=False,
            compute_capability='unknown',
            memory_total_mb=4096.0,
            memory_available_mb=3072.0,
            utilization_percent=0.0
        )
    
    def _calculate_load_balance_ratio(self, distributions: List[WorkloadDistribution]) -> float:
        """Calculate load balance ratio (1.0 = perfectly balanced)"""
        if not distributions:
            return 1.0
        
        processing_times = [dist.estimated_time_ms for dist in distributions]
        
        if not processing_times:
            return 1.0
        
        min_time = min(processing_times)
        max_time = max(processing_times)
        
        if max_time == 0:
            return 1.0
        
        # Balance ratio: closer to 1.0 means better balance
        balance_ratio = min_time / max_time
        return balance_ratio
    
    def _setup_inter_gpu_communication(self, gpus: List[GPUConfig], 
                                     config: MultiGPUConfig) -> Dict[str, Any]:
        """Set up inter-GPU communication for coordination"""
        try:
            communication_setup = {
                'backend': config.communication_backend,
                'topology': 'ring',  # Ring topology for all-reduce
                'compression': config.gradient_compression,
                'bandwidth_estimation': {}
            }
            
            # Estimate communication bandwidth between GPUs
            for i, gpu1 in enumerate(gpus):
                for j, gpu2 in enumerate(gpus):
                    if i != j:
                        # Simplified bandwidth estimation
                        # In production, would measure actual bandwidth
                        bandwidth_gbps = self._estimate_inter_gpu_bandwidth(gpu1, gpu2)
                        communication_setup['bandwidth_estimation'][f'gpu_{gpu1.device_id}_to_gpu_{gpu2.device_id}'] = bandwidth_gbps
            
            return {
                'success': True,
                'communication_setup': communication_setup,
                'estimated_communication_overhead': '5-15%',
                'synchronization_points': ['gradient_aggregation', 'parameter_updates']
            }
            
        except Exception as e:
            logger.error(f"Inter-GPU communication setup failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _estimate_inter_gpu_bandwidth(self, gpu1: GPUConfig, gpu2: GPUConfig) -> float:
        """Estimate bandwidth between two GPUs"""
        # Simplified bandwidth estimation
        # In production, would use actual hardware topology and measurements
        
        # Assume NVLink for modern GPUs, PCIe for older ones
        if (gpu1.compute_capability and gpu2.compute_capability and
            gpu1.compute_capability != 'unknown' and gpu2.compute_capability != 'unknown'):
            try:
                gpu1_major = int(gpu1.compute_capability.split('.')[0])
                gpu2_major = int(gpu2.compute_capability.split('.')[0])
                
                # Modern GPUs (7.0+) likely have NVLink
                if gpu1_major >= 7 and gpu2_major >= 7:
                    return 300.0  # ~300 GB/s for NVLink
                else:
                    return 32.0   # ~32 GB/s for PCIe 4.0
            except:
                pass
        
        return 16.0  # Default PCIe 3.0 bandwidth
    
    async def distribute_workload(self, workload_func: Callable, 
                                workload_data: Dict[str, Any],
                                distribution_strategy: Optional[DistributionStrategy] = None) -> Dict[str, Any]:
        """
        Distribute workload across multiple GPUs
        
        Args:
            workload_func: Function to execute across GPUs
            workload_data: Data for the workload
            distribution_strategy: Optional strategy override
            
        Returns:
            Distributed execution results
        """
        if len(self.gpu_manager.gpu_configs) < 2:
            return {
                'success': False,
                'error': 'Multi-GPU distribution requires at least 2 GPUs'
            }
        
        try:
            with self._coordination_lock:
                # Use specified strategy or default
                strategy = distribution_strategy or DistributionStrategy.MIRRORED
                
                # Create workload distributions
                distributions = self._create_workload_distributions(workload_data, strategy)
                
                # Execute workload across GPUs
                start_time = time.time()
                results = await self._execute_distributed_workload(workload_func, distributions)
                execution_time = time.time() - start_time
                
                # Aggregate results
                aggregated_result = self._aggregate_distributed_results(results)
                
                # Update performance metrics
                self._update_multi_gpu_metrics(distributions, execution_time)
                
                return {
                    'success': True,
                    'execution_time_ms': execution_time * 1000,
                    'gpu_count': len(distributions),
                    'distribution_strategy': strategy.value,
                    'results': aggregated_result,
                    'performance_metrics': {
                        'total_execution_time_ms': execution_time * 1000,
                        'average_gpu_utilization': self._calculate_average_utilization(),
                        'load_balance_efficiency': self._calculate_load_balance_efficiency(distributions, results),
                        'communication_overhead_percent': self._estimate_communication_overhead(execution_time)
                    }
                }
                
        except Exception as e:
            logger.error(f"Distributed workload execution failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _create_workload_distributions(self, workload_data: Dict[str, Any], 
                                     strategy: DistributionStrategy) -> List[WorkloadDistribution]:
        """Create workload distributions for multi-GPU execution"""
        distributions = []
        gpu_count = len(self.gpu_manager.gpu_configs)
        
        # Calculate workload per GPU
        total_workload = workload_data.get('batch_size', 32)
        workload_per_gpu = max(1, total_workload // gpu_count)
        
        for gpu_config in self.gpu_manager.gpu_configs:
            distribution = WorkloadDistribution(
                gpu_id=gpu_config.device_id,
                workload_size=workload_per_gpu,
                priority=0,
                estimated_time_ms=self._estimate_processing_time(workload_per_gpu, gpu_config),
                memory_required_mb=workload_per_gpu * 50
            )
            distributions.append(distribution)
        
        return distributions
    
    async def _execute_distributed_workload(self, workload_func: Callable, 
                                          distributions: List[WorkloadDistribution]) -> List[Dict[str, Any]]:
        """Execute workload across multiple GPUs"""
        tasks = []
        
        for distribution in distributions:
            # Create task for each GPU
            task = asyncio.create_task(
                self._execute_gpu_workload(workload_func, distribution)
            )
            tasks.append(task)
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results and handle exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"GPU {distributions[i].gpu_id} workload failed: {result}")
                processed_results.append({
                    'gpu_id': distributions[i].gpu_id,
                    'success': False,
                    'error': str(result)
                })
            else:
                processed_results.append(result)
        
        return processed_results
    
    async def _execute_gpu_workload(self, workload_func: Callable, 
                                  distribution: WorkloadDistribution) -> Dict[str, Any]:
        """Execute workload on specific GPU"""
        gpu_id = distribution.gpu_id
        
        try:
            # Mark GPU as active
            self.active_workers[gpu_id] = True
            
            # Execute workload on GPU
            result = await self.gpu_manager.execute_on_gpu(
                workload_func, 
                gpu_id=gpu_id,
                stream_priority=distribution.priority
            )
            
            return {
                'gpu_id': gpu_id,
                'success': True,
                'result': result,
                'workload_size': distribution.workload_size,
                'execution_time_ms': distribution.estimated_time_ms  # Would be actual time in production
            }
            
        except Exception as e:
            logger.error(f"GPU {gpu_id} workload execution failed: {e}")
            return {
                'gpu_id': gpu_id,
                'success': False,
                'error': str(e)
            }
        finally:
            # Mark GPU as inactive
            self.active_workers[gpu_id] = False
    
    def _aggregate_distributed_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Aggregate results from distributed GPU execution"""
        successful_results = [r for r in results if r.get('success', False)]
        failed_results = [r for r in results if not r.get('success', False)]
        
        if not successful_results:
            return {
                'success': False,
                'error': 'All GPU executions failed',
                'failed_gpus': [r['gpu_id'] for r in failed_results]
            }
        
        # Simple aggregation - in production would be more sophisticated
        aggregated = {
            'success': True,
            'successful_gpus': len(successful_results),
            'failed_gpus': len(failed_results),
            'total_workload_processed': sum(r.get('workload_size', 0) for r in successful_results),
            'results': [r.get('result') for r in successful_results if r.get('result') is not None]
        }
        
        return aggregated
    
    def _update_multi_gpu_metrics(self, distributions: List[WorkloadDistribution], 
                                execution_time: float):
        """Update performance metrics for multi-GPU execution"""
        for distribution in distributions:
            gpu_id = distribution.gpu_id
            
            if gpu_id in self.performance_metrics:
                self.performance_metrics[gpu_id].append(execution_time * 1000)
                
                # Keep only last 100 measurements
                if len(self.performance_metrics[gpu_id]) > 100:
                    self.performance_metrics[gpu_id].pop(0)
    
    def _calculate_average_utilization(self) -> float:
        """Calculate average GPU utilization across all GPUs"""
        if not self.gpu_manager.gpu_configs:
            return 0.0
        
        total_utilization = sum(gpu.utilization_percent for gpu in self.gpu_manager.gpu_configs)
        return total_utilization / len(self.gpu_manager.gpu_configs)
    
    def _calculate_load_balance_efficiency(self, distributions: List[WorkloadDistribution], 
                                         results: List[Dict[str, Any]]) -> float:
        """Calculate load balance efficiency"""
        successful_results = [r for r in results if r.get('success', False)]
        
        if len(successful_results) < 2:
            return 1.0
        
        execution_times = [r.get('execution_time_ms', 0) for r in successful_results]
        
        if not execution_times or max(execution_times) == 0:
            return 1.0
        
        # Efficiency = min_time / max_time (closer to 1.0 is better)
        efficiency = min(execution_times) / max(execution_times)
        return efficiency
    
    def _estimate_communication_overhead(self, total_execution_time: float) -> float:
        """Estimate communication overhead percentage"""
        # Simplified estimation - in production would measure actual overhead
        gpu_count = len(self.gpu_manager.gpu_configs)
        
        if gpu_count < 2:
            return 0.0
        
        # Communication overhead typically increases with GPU count
        base_overhead = 5.0  # 5% base overhead
        scaling_overhead = (gpu_count - 2) * 2.0  # 2% per additional GPU
        
        total_overhead = min(25.0, base_overhead + scaling_overhead)  # Cap at 25%
        return total_overhead
    
    def get_multi_gpu_status(self) -> Dict[str, Any]:
        """Get comprehensive multi-GPU coordination status"""
        if len(self.gpu_manager.gpu_configs) < 2:
            return {
                'multi_gpu_available': False,
                'reason': 'Requires at least 2 GPUs'
            }
        
        # Calculate performance statistics
        performance_stats = {}
        for gpu_id, metrics in self.performance_metrics.items():
            if metrics:
                performance_stats[gpu_id] = {
                    'average_execution_time_ms': sum(metrics) / len(metrics),
                    'min_execution_time_ms': min(metrics),
                    'max_execution_time_ms': max(metrics),
                    'measurement_count': len(metrics)
                }
        
        return {
            'multi_gpu_available': True,
            'gpu_count': len(self.gpu_manager.gpu_configs),
            'distribution_strategy': self.distribution_strategy.__class__.__name__ if self.distribution_strategy else None,
            'active_workers': sum(1 for active in self.active_workers.values() if active),
            'performance_metrics': performance_stats,
            'average_utilization_percent': self._calculate_average_utilization(),
            'coordination_recommendations': self._get_coordination_recommendations()
        }
    
    def _get_coordination_recommendations(self) -> List[str]:
        """Get multi-GPU coordination recommendations"""
        recommendations = []
        
        gpu_count = len(self.gpu_manager.gpu_configs)
        
        if gpu_count < 2:
            recommendations.append("Add more GPUs for distributed processing benefits")
            return recommendations
        
        # Check utilization balance
        utilizations = [gpu.utilization_percent for gpu in self.gpu_manager.gpu_configs]
        if utilizations:
            max_util = max(utilizations)
            min_util = min(utilizations)
            
            if max_util - min_util > 30:
                recommendations.append("GPU utilization imbalance detected - consider workload rebalancing")
        
        # Check for optimal GPU count
        if gpu_count > 4:
            recommendations.append("Consider communication overhead with >4 GPUs - monitor efficiency")
        
        # Check memory balance
        memory_usages = [
            ((gpu.memory_total_mb - gpu.memory_available_mb) / gpu.memory_total_mb) * 100
            for gpu in self.gpu_manager.gpu_configs
        ]
        
        if memory_usages:
            max_memory = max(memory_usages)
            min_memory = min(memory_usages)
            
            if max_memory - min_memory > 40:
                recommendations.append("GPU memory usage imbalance - consider memory-aware workload distribution")
        
        if not recommendations:
            recommendations.append("Multi-GPU coordination is optimally configured")
        
        return recommendations
    
    async def cleanup(self):
        """Cleanup multi-GPU coordination resources"""
        logger.info("Cleaning up multi-GPU coordination...")
        
        try:
            with self._coordination_lock:
                # Stop all active workers
                for gpu_id in self.active_workers:
                    self.active_workers[gpu_id] = False
                
                # Clear workload queue
                while not self.workload_queue.empty():
                    try:
                        self.workload_queue.get_nowait()
                    except queue.Empty:
                        break
                
                # Clear performance metrics
                self.performance_metrics.clear()
                
                # Shutdown thread pool
                self.executor.shutdown(wait=True)
                
                # Clear distribution strategy
                self.distribution_strategy = None
                self.strategy_scope = None
                
                logger.info("Multi-GPU coordination cleanup completed")
                
        except Exception as e:
            logger.error(f"Multi-GPU coordination cleanup failed: {e}")