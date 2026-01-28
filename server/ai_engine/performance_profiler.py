"""
Performance Profiler - Comprehensive performance profiling system for neural network operations
Implements baseline measurement, regression detection, and automated benchmarking
"""

import asyncio
import logging
import time
import json
import os
import statistics
from typing import Dict, Any, List, Optional, Callable, Tuple
from dataclasses import dataclass, asdict
from collections import deque, defaultdict
from datetime import datetime, timedelta
import threading
import psutil

# TensorFlow removed - using PyTorch instead
TENSORFLOW_AVAILABLE = False
tf = None

logger = logging.getLogger(__name__)


@dataclass
class ProfilingMetrics:
    """Detailed profiling metrics for neural network operations"""
    timestamp: float
    operation_type: str  # 'inference', 'training', 'quantization', 'batch_processing'
    operation_id: str
    
    # Timing metrics (Requirements 4.1, 4.3)
    execution_time_ms: float
    preparation_time_ms: float
    model_load_time_ms: float
    data_processing_time_ms: float
    
    # Memory metrics (Requirements 4.1, 4.3)
    memory_before_mb: float
    memory_after_mb: float
    memory_peak_mb: float
    memory_delta_mb: float
    
    # GPU metrics (Requirements 4.1, 4.3)
    gpu_utilization_percent: Optional[float]
    gpu_memory_used_mb: Optional[float]
    gpu_memory_total_mb: Optional[float]
    gpu_compute_time_ms: Optional[float]
    
    # Performance targets
    meets_inference_target: bool  # <16ms for inference
    meets_throughput_target: bool  # >100 predictions/sec
    meets_memory_target: bool  # <200MB additional
    
    # Context information
    generation: int
    batch_size: int
    model_size_mb: float
    hardware_config: str
    
    # Quality metrics
    accuracy_score: Optional[float]
    quality_degradation: Optional[float]
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BaselineMetrics:
    """Baseline performance metrics for comparison"""
    operation_type: str
    hardware_config: str
    
    # Baseline timing (ms)
    baseline_inference_time_ms: float
    baseline_training_time_ms: float
    baseline_batch_processing_time_ms: float
    
    # Baseline memory (MB)
    baseline_memory_usage_mb: float
    baseline_peak_memory_mb: float
    
    # Baseline throughput
    baseline_throughput_predictions_per_sec: float
    
    # Quality baselines
    baseline_accuracy: float
    baseline_model_size_mb: float
    
    # Measurement metadata
    measurement_date: str
    sample_count: int
    confidence_interval: float
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class PerformanceRegression:
    """Performance regression detection and analysis"""
    
    def __init__(self, threshold_percent: float = 10.0):
        self.threshold_percent = threshold_percent
        self.regression_history: List[Dict[str, Any]] = []
        
    def detect_regression(self, current_metrics: ProfilingMetrics, 
                         baseline: BaselineMetrics) -> Optional[Dict[str, Any]]:
        """
        Detect performance regression by comparing current metrics to baseline
        
        Args:
            current_metrics: Current performance measurements
            baseline: Baseline performance metrics
            
        Returns:
            Regression analysis if detected, None otherwise
        """
        regressions = []
        
        # Check inference time regression
        if current_metrics.operation_type == 'inference':
            if current_metrics.execution_time_ms > baseline.baseline_inference_time_ms:
                regression_percent = ((current_metrics.execution_time_ms - baseline.baseline_inference_time_ms) 
                                    / baseline.baseline_inference_time_ms) * 100
                if regression_percent > self.threshold_percent:
                    regressions.append({
                        'metric': 'inference_time',
                        'current_value': current_metrics.execution_time_ms,
                        'baseline_value': baseline.baseline_inference_time_ms,
                        'regression_percent': regression_percent,
                        'severity': 'critical' if regression_percent > 50 else 'warning'
                    })
        
        # Check memory usage regression
        memory_regression_percent = ((current_metrics.memory_delta_mb - baseline.baseline_memory_usage_mb) 
                                   / baseline.baseline_memory_usage_mb) * 100
        if memory_regression_percent > self.threshold_percent:
            regressions.append({
                'metric': 'memory_usage',
                'current_value': current_metrics.memory_delta_mb,
                'baseline_value': baseline.baseline_memory_usage_mb,
                'regression_percent': memory_regression_percent,
                'severity': 'critical' if memory_regression_percent > 100 else 'warning'
            })
        
        # Check accuracy regression (if available)
        if (current_metrics.accuracy_score is not None and 
            baseline.baseline_accuracy > 0):
            accuracy_regression_percent = ((baseline.baseline_accuracy - current_metrics.accuracy_score) 
                                         / baseline.baseline_accuracy) * 100
            if accuracy_regression_percent > self.threshold_percent:
                regressions.append({
                    'metric': 'accuracy',
                    'current_value': current_metrics.accuracy_score,
                    'baseline_value': baseline.baseline_accuracy,
                    'regression_percent': accuracy_regression_percent,
                    'severity': 'critical' if accuracy_regression_percent > 25 else 'warning'
                })
        
        if regressions:
            regression_analysis = {
                'timestamp': current_metrics.timestamp,
                'operation_id': current_metrics.operation_id,
                'operation_type': current_metrics.operation_type,
                'regressions': regressions,
                'overall_severity': max(r['severity'] for r in regressions),
                'hardware_config': current_metrics.hardware_config
            }
            
            self.regression_history.append(regression_analysis)
            return regression_analysis
        
        return None
    
    def get_regression_trends(self, days: int = 7) -> Dict[str, Any]:
        """Get regression trends over specified time period"""
        cutoff_time = time.time() - (days * 24 * 3600)
        recent_regressions = [r for r in self.regression_history 
                            if r['timestamp'] > cutoff_time]
        
        if not recent_regressions:
            return {'status': 'no_regressions', 'period_days': days}
        
        # Analyze trends by metric
        metric_trends = defaultdict(list)
        for regression in recent_regressions:
            for reg in regression['regressions']:
                metric_trends[reg['metric']].append(reg['regression_percent'])
        
        trend_analysis = {}
        for metric, values in metric_trends.items():
            trend_analysis[metric] = {
                'count': len(values),
                'avg_regression_percent': statistics.mean(values),
                'max_regression_percent': max(values),
                'trend': 'worsening' if len(values) > 1 and values[-1] > values[0] else 'stable'
            }
        
        return {
            'status': 'regressions_detected',
            'period_days': days,
            'total_regressions': len(recent_regressions),
            'metric_trends': trend_analysis,
            'most_affected_metric': max(trend_analysis.keys(), 
                                      key=lambda k: trend_analysis[k]['avg_regression_percent'])
        }


class AutomatedBenchmark:
    """Automated benchmarking system for neural network operations"""
    
    def __init__(self):
        self.benchmark_results: Dict[str, List[ProfilingMetrics]] = defaultdict(list)
        self.benchmark_configs = {
            'inference_benchmark': {
                'operation_type': 'inference',
                'iterations': 100,
                'warmup_iterations': 10,
                'batch_sizes': [1, 8, 16, 32],
                'target_time_ms': 16.0
            },
            'training_benchmark': {
                'operation_type': 'training',
                'iterations': 10,
                'warmup_iterations': 2,
                'epochs': [5, 10, 20],
                'target_time_range_ms': (60000, 120000)  # 60-120 seconds
            },
            'batch_processing_benchmark': {
                'operation_type': 'batch_processing',
                'iterations': 50,
                'warmup_iterations': 5,
                'batch_sizes': [10, 50, 100, 200],
                'target_throughput': 100  # predictions per second
            }
        }
    
    async def run_inference_benchmark(self, model_func: Callable, 
                                    test_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run comprehensive inference performance benchmark
        
        Args:
            model_func: Function to perform inference
            test_data: Test data for inference
            
        Returns:
            Benchmark results with performance analysis
        """
        config = self.benchmark_configs['inference_benchmark']
        results = []
        
        logger.info("Starting inference benchmark...")
        
        for batch_size in config['batch_sizes']:
            batch_results = []
            
            # Warmup iterations
            for _ in range(config['warmup_iterations']):
                try:
                    await model_func(test_data, batch_size=batch_size)
                except Exception as e:
                    logger.warning(f"Warmup iteration failed: {e}")
            
            # Benchmark iterations
            for iteration in range(config['iterations']):
                start_time = time.time()
                memory_before = psutil.virtual_memory().used / (1024 * 1024)
                
                try:
                    # Execute inference
                    result = await model_func(test_data, batch_size=batch_size)
                    
                    end_time = time.time()
                    memory_after = psutil.virtual_memory().used / (1024 * 1024)
                    execution_time_ms = (end_time - start_time) * 1000
                    
                    # Create profiling metrics
                    metrics = ProfilingMetrics(
                        timestamp=end_time,
                        operation_type='inference',
                        operation_id=f'benchmark_inference_{batch_size}_{iteration}',
                        execution_time_ms=execution_time_ms,
                        preparation_time_ms=0.0,
                        model_load_time_ms=0.0,
                        data_processing_time_ms=0.0,
                        memory_before_mb=memory_before,
                        memory_after_mb=memory_after,
                        memory_peak_mb=memory_after,
                        memory_delta_mb=memory_after - memory_before,
                        gpu_utilization_percent=None,
                        gpu_memory_used_mb=None,
                        gpu_memory_total_mb=None,
                        gpu_compute_time_ms=None,
                        meets_inference_target=execution_time_ms < config['target_time_ms'],
                        meets_throughput_target=True,  # Will be calculated later
                        meets_memory_target=True,  # Will be validated later
                        generation=test_data.get('generation', 1),
                        batch_size=batch_size,
                        model_size_mb=25.0,  # Placeholder
                        hardware_config=self._get_hardware_config(),
                        accuracy_score=result.get('accuracy', None) if isinstance(result, dict) else None,
                        quality_degradation=None
                    )
                    
                    batch_results.append(metrics)
                    
                except Exception as e:
                    logger.error(f"Benchmark iteration {iteration} failed: {e}")
            
            results.extend(batch_results)
        
        # Store benchmark results
        self.benchmark_results['inference'].extend(results)
        
        # Analyze results
        analysis = self._analyze_benchmark_results(results, 'inference')
        
        logger.info(f"Inference benchmark completed: {len(results)} measurements")
        return analysis
    
    async def run_training_benchmark(self, training_func: Callable, 
                                   training_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run comprehensive training performance benchmark
        
        Args:
            training_func: Function to perform training
            training_data: Training data
            
        Returns:
            Benchmark results with performance analysis
        """
        config = self.benchmark_configs['training_benchmark']
        results = []
        
        logger.info("Starting training benchmark...")
        
        for epochs in config['epochs']:
            epoch_results = []
            
            # Warmup iterations
            for _ in range(config['warmup_iterations']):
                try:
                    test_data = training_data.copy()
                    test_data['training_config'] = {'max_epochs': 1}
                    await training_func(test_data)
                except Exception as e:
                    logger.warning(f"Training warmup failed: {e}")
            
            # Benchmark iterations
            for iteration in range(config['iterations']):
                start_time = time.time()
                memory_before = psutil.virtual_memory().used / (1024 * 1024)
                
                try:
                    # Prepare training data with specific epoch count
                    test_data = training_data.copy()
                    test_data['training_config'] = {'max_epochs': epochs}
                    
                    # Execute training
                    result = await training_func(test_data)
                    
                    end_time = time.time()
                    memory_after = psutil.virtual_memory().used / (1024 * 1024)
                    execution_time_ms = (end_time - start_time) * 1000
                    
                    # Create profiling metrics
                    metrics = ProfilingMetrics(
                        timestamp=end_time,
                        operation_type='training',
                        operation_id=f'benchmark_training_{epochs}_{iteration}',
                        execution_time_ms=execution_time_ms,
                        preparation_time_ms=0.0,
                        model_load_time_ms=0.0,
                        data_processing_time_ms=0.0,
                        memory_before_mb=memory_before,
                        memory_after_mb=memory_after,
                        memory_peak_mb=memory_after,
                        memory_delta_mb=memory_after - memory_before,
                        gpu_utilization_percent=None,
                        gpu_memory_used_mb=None,
                        gpu_memory_total_mb=None,
                        gpu_compute_time_ms=None,
                        meets_inference_target=True,  # Not applicable for training
                        meets_throughput_target=True,  # Not applicable for training
                        meets_memory_target=abs(memory_after - memory_before) < 200,
                        generation=training_data.get('generation', 1),
                        batch_size=test_data.get('training_config', {}).get('batch_size', 32),
                        model_size_mb=25.0,  # Placeholder
                        hardware_config=self._get_hardware_config(),
                        accuracy_score=result.get('accuracy', None) if isinstance(result, dict) else None,
                        quality_degradation=None
                    )
                    
                    epoch_results.append(metrics)
                    
                except Exception as e:
                    logger.error(f"Training benchmark iteration {iteration} failed: {e}")
            
            results.extend(epoch_results)
        
        # Store benchmark results
        self.benchmark_results['training'].extend(results)
        
        # Analyze results
        analysis = self._analyze_benchmark_results(results, 'training')
        
        logger.info(f"Training benchmark completed: {len(results)} measurements")
        return analysis
    
    def _analyze_benchmark_results(self, results: List[ProfilingMetrics], 
                                 operation_type: str) -> Dict[str, Any]:
        """Analyze benchmark results and generate performance insights"""
        if not results:
            return {'status': 'no_results', 'operation_type': operation_type}
        
        # Calculate statistics
        execution_times = [r.execution_time_ms for r in results]
        memory_deltas = [r.memory_delta_mb for r in results]
        
        # Performance target analysis
        if operation_type == 'inference':
            target_met_count = sum(1 for r in results if r.meets_inference_target)
            target_success_rate = target_met_count / len(results)
        else:
            target_success_rate = 1.0  # Placeholder for training
        
        # Hardware configuration analysis
        hardware_configs = set(r.hardware_config for r in results)
        
        analysis = {
            'operation_type': operation_type,
            'total_measurements': len(results),
            'measurement_period': {
                'start': min(r.timestamp for r in results),
                'end': max(r.timestamp for r in results)
            },
            'execution_time_stats': {
                'mean_ms': statistics.mean(execution_times),
                'median_ms': statistics.median(execution_times),
                'std_dev_ms': statistics.stdev(execution_times) if len(execution_times) > 1 else 0,
                'min_ms': min(execution_times),
                'max_ms': max(execution_times),
                'p95_ms': self._percentile(execution_times, 95),
                'p99_ms': self._percentile(execution_times, 99)
            },
            'memory_stats': {
                'mean_delta_mb': statistics.mean(memory_deltas),
                'median_delta_mb': statistics.median(memory_deltas),
                'max_delta_mb': max(memory_deltas),
                'min_delta_mb': min(memory_deltas)
            },
            'performance_targets': {
                'target_success_rate': target_success_rate,
                'meets_targets': target_success_rate >= 0.95
            },
            'hardware_configurations': list(hardware_configs),
            'recommendations': self._generate_performance_recommendations(results, operation_type)
        }
        
        return analysis
    
    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile of data"""
        if not data:
            return 0.0
        sorted_data = sorted(data)
        index = int((percentile / 100.0) * len(sorted_data))
        return sorted_data[min(index, len(sorted_data) - 1)]
    
    def _generate_performance_recommendations(self, results: List[ProfilingMetrics], 
                                            operation_type: str) -> List[str]:
        """Generate performance optimization recommendations based on benchmark results"""
        recommendations = []
        
        if not results:
            return ["No benchmark data available for recommendations"]
        
        # Analyze execution times
        execution_times = [r.execution_time_ms for r in results]
        avg_time = statistics.mean(execution_times)
        
        if operation_type == 'inference':
            if avg_time > 16.0:
                recommendations.append(f"Average inference time ({avg_time:.1f}ms) exceeds 16ms target - consider model quantization or GPU acceleration")
            
            # Check for high variance
            if len(execution_times) > 1:
                std_dev = statistics.stdev(execution_times)
                if std_dev > avg_time * 0.3:  # High variance
                    recommendations.append("High variance in inference times detected - consider batch processing optimization")
        
        # Analyze memory usage
        memory_deltas = [r.memory_delta_mb for r in results]
        avg_memory = statistics.mean(memory_deltas)
        
        if avg_memory > 200:
            recommendations.append(f"Average memory usage ({avg_memory:.1f}MB) exceeds 200MB target - consider memory optimization")
        
        # Check GPU utilization
        gpu_results = [r for r in results if r.gpu_utilization_percent is not None]
        if not gpu_results:
            recommendations.append("GPU acceleration not detected - consider enabling GPU support for better performance")
        
        # Hardware-specific recommendations
        hardware_configs = set(r.hardware_config for r in results)
        if len(hardware_configs) > 1:
            recommendations.append("Performance varies across hardware configurations - consider adaptive optimization")
        
        if not recommendations:
            recommendations.append("Performance is within acceptable thresholds")
        
        return recommendations
    
    def _get_hardware_config(self) -> str:
        """Get current hardware configuration string"""
        cpu_count = psutil.cpu_count()
        memory_gb = psutil.virtual_memory().total / (1024 ** 3)
        
        gpu_info = "no_gpu"
        if TENSORFLOW_AVAILABLE and tf:
            try:
                gpus = tf.config.experimental.list_physical_devices('GPU')
                if gpus:
                    gpu_info = f"{len(gpus)}_gpu"
            except:
                pass
        
        return f"cpu_{cpu_count}c_mem_{memory_gb:.0f}gb_{gpu_info}"


class PerformanceProfiler:
    """
    Comprehensive performance profiling system for neural network operations
    Implements Requirements 4.1, 4.3, 4.4 for performance monitoring and analysis
    """
    
    def __init__(self):
        self.profiling_enabled = True
        self.metrics_history: deque = deque(maxlen=10000)  # Store last 10k metrics
        self.baselines: Dict[str, BaselineMetrics] = {}
        self.regression_detector = PerformanceRegression()
        self.automated_benchmark = AutomatedBenchmark()
        
        # Profiling configuration
        self.profiling_config = {
            'detailed_memory_tracking': True,
            'gpu_profiling_enabled': TENSORFLOW_AVAILABLE,
            'timing_precision_ms': 0.1,
            'automatic_baseline_update': True,
            'regression_threshold_percent': 15.0
        }
        
        # Performance targets (from requirements)
        self.performance_targets = {
            'inference_time_ms': 16.0,  # <16ms for 60fps
            'throughput_predictions_per_sec': 100.0,  # >100 predictions/sec
            'memory_limit_mb': 200.0,  # <200MB additional
            'training_time_range_ms': (60000, 120000)  # 60-120 seconds
        }
        
        # Initialize baseline storage
        self.baseline_storage_path = "data/performance_baselines.json"
        self._load_baselines()
    
    async def profile_operation(self, operation_func: Callable, operation_type: str,
                              operation_data: Dict[str, Any], 
                              operation_id: Optional[str] = None) -> ProfilingMetrics:
        """
        Profile a neural network operation with comprehensive metrics collection
        
        Args:
            operation_func: Function to profile
            operation_type: Type of operation ('inference', 'training', 'quantization', 'batch_processing')
            operation_data: Data for the operation
            operation_id: Optional unique identifier for the operation
            
        Returns:
            Detailed profiling metrics
        """
        if not self.profiling_enabled:
            # Execute without profiling
            await operation_func(operation_data)
            return self._create_minimal_metrics(operation_type, operation_id or "disabled")
        
        # Generate operation ID if not provided
        if operation_id is None:
            operation_id = f"{operation_type}_{int(time.time() * 1000)}"
        
        logger.debug(f"Starting profiling for operation: {operation_id}")
        
        # Pre-operation measurements
        start_time = time.time()
        memory_before = psutil.virtual_memory().used / (1024 * 1024)
        cpu_before = psutil.cpu_percent()
        
        # GPU measurements (if available)
        gpu_memory_before = None
        gpu_utilization_before = None
        if self.profiling_config['gpu_profiling_enabled'] and TENSORFLOW_AVAILABLE:
            gpu_memory_before, gpu_utilization_before = self._measure_gpu_usage()
        
        # Execute operation with timing
        preparation_start = time.time()
        try:
            # Execute the operation
            result = await operation_func(operation_data)
            execution_success = True
        except Exception as e:
            logger.error(f"Operation {operation_id} failed during profiling: {e}")
            result = None
            execution_success = False
        
        # Post-operation measurements
        end_time = time.time()
        memory_after = psutil.virtual_memory().used / (1024 * 1024)
        cpu_after = psutil.cpu_percent()
        
        # GPU measurements (if available)
        gpu_memory_after = None
        gpu_utilization_after = None
        if self.profiling_config['gpu_profiling_enabled'] and TENSORFLOW_AVAILABLE:
            gpu_memory_after, gpu_utilization_after = self._measure_gpu_usage()
        
        # Calculate metrics
        execution_time_ms = (end_time - start_time) * 1000
        memory_delta_mb = memory_after - memory_before
        
        # Extract operation-specific data
        generation = operation_data.get('generation', 1)
        batch_size = operation_data.get('batch_size', 1)
        if 'training_config' in operation_data:
            batch_size = operation_data['training_config'].get('batch_size', batch_size)
        
        # Determine performance target compliance
        meets_inference_target = (operation_type != 'inference' or 
                                execution_time_ms <= self.performance_targets['inference_time_ms'])
        meets_memory_target = abs(memory_delta_mb) <= self.performance_targets['memory_limit_mb']
        meets_throughput_target = True  # Will be calculated for batch operations
        
        # Calculate throughput for batch operations
        if operation_type == 'batch_processing' and batch_size > 0:
            throughput = (batch_size / execution_time_ms) * 1000  # predictions per second
            meets_throughput_target = throughput >= self.performance_targets['throughput_predictions_per_sec']
        
        # Extract quality metrics from result
        accuracy_score = None
        quality_degradation = None
        if isinstance(result, dict):
            accuracy_score = result.get('accuracy', None)
            quality_degradation = result.get('quality_degradation', None)
        
        # Create comprehensive profiling metrics
        metrics = ProfilingMetrics(
            timestamp=end_time,
            operation_type=operation_type,
            operation_id=operation_id,
            execution_time_ms=execution_time_ms,
            preparation_time_ms=(preparation_start - start_time) * 1000,
            model_load_time_ms=0.0,  # Would need specific instrumentation
            data_processing_time_ms=0.0,  # Would need specific instrumentation
            memory_before_mb=memory_before,
            memory_after_mb=memory_after,
            memory_peak_mb=memory_after,  # Simplified - would need continuous monitoring
            memory_delta_mb=memory_delta_mb,
            gpu_utilization_percent=gpu_utilization_after,
            gpu_memory_used_mb=gpu_memory_after,
            gpu_memory_total_mb=None,  # Would need GPU library for accurate data
            gpu_compute_time_ms=None,  # Would need detailed GPU profiling
            meets_inference_target=meets_inference_target,
            meets_throughput_target=meets_throughput_target,
            meets_memory_target=meets_memory_target,
            generation=generation,
            batch_size=batch_size,
            model_size_mb=25.0,  # Placeholder - would need actual model size
            hardware_config=self.automated_benchmark._get_hardware_config(),
            accuracy_score=accuracy_score,
            quality_degradation=quality_degradation
        )
        
        # Store metrics
        self.metrics_history.append(metrics)
        
        # Check for performance regression
        await self._check_regression(metrics)
        
        # Update baseline if configured
        if self.profiling_config['automatic_baseline_update']:
            await self._update_baseline(metrics)
        
        logger.debug(f"Profiling completed for operation: {operation_id} "
                    f"({execution_time_ms:.1f}ms, {memory_delta_mb:.1f}MB)")
        
        return metrics
    
    def _measure_gpu_usage(self) -> Tuple[Optional[float], Optional[float]]:
        """Measure current GPU memory and utilization"""
        # This is a simplified implementation
        # In production, you would use nvidia-ml-py or similar for accurate GPU monitoring
        try:
            if tf and tf.config.experimental.list_physical_devices('GPU'):
                # Placeholder values - would need proper GPU monitoring library
                return 1024.0, 50.0  # memory_mb, utilization_percent
        except:
            pass
        return None, None
    
    def _create_minimal_metrics(self, operation_type: str, operation_id: str) -> ProfilingMetrics:
        """Create minimal metrics when profiling is disabled"""
        return ProfilingMetrics(
            timestamp=time.time(),
            operation_type=operation_type,
            operation_id=operation_id,
            execution_time_ms=0.0,
            preparation_time_ms=0.0,
            model_load_time_ms=0.0,
            data_processing_time_ms=0.0,
            memory_before_mb=0.0,
            memory_after_mb=0.0,
            memory_peak_mb=0.0,
            memory_delta_mb=0.0,
            gpu_utilization_percent=None,
            gpu_memory_used_mb=None,
            gpu_memory_total_mb=None,
            gpu_compute_time_ms=None,
            meets_inference_target=True,
            meets_throughput_target=True,
            meets_memory_target=True,
            generation=1,
            batch_size=1,
            model_size_mb=0.0,
            hardware_config="unknown",
            accuracy_score=None,
            quality_degradation=None
        )
    
    async def establish_baseline(self, operation_type: str, 
                               benchmark_func: Callable, 
                               test_data: Dict[str, Any],
                               iterations: int = 50) -> BaselineMetrics:
        """
        Establish performance baseline for an operation type
        
        Args:
            operation_type: Type of operation to baseline
            benchmark_func: Function to benchmark
            test_data: Test data for benchmarking
            iterations: Number of iterations for baseline measurement
            
        Returns:
            Baseline metrics
        """
        logger.info(f"Establishing baseline for {operation_type} with {iterations} iterations")
        
        baseline_metrics = []
        
        # Warmup iterations
        for _ in range(min(10, iterations // 5)):
            try:
                await benchmark_func(test_data)
            except Exception as e:
                logger.warning(f"Baseline warmup iteration failed: {e}")
        
        # Baseline measurement iterations
        for i in range(iterations):
            try:
                metrics = await self.profile_operation(
                    benchmark_func, 
                    operation_type, 
                    test_data,
                    f"baseline_{operation_type}_{i}"
                )
                baseline_metrics.append(metrics)
                
                # Progress logging
                if (i + 1) % 10 == 0:
                    logger.info(f"Baseline progress: {i + 1}/{iterations} iterations completed")
                    
            except Exception as e:
                logger.error(f"Baseline iteration {i} failed: {e}")
        
        if not baseline_metrics:
            raise RuntimeError(f"Failed to establish baseline for {operation_type}")
        
        # Calculate baseline statistics
        execution_times = [m.execution_time_ms for m in baseline_metrics]
        memory_deltas = [m.memory_delta_mb for m in baseline_metrics]
        accuracies = [m.accuracy_score for m in baseline_metrics if m.accuracy_score is not None]
        
        # Create baseline metrics
        baseline = BaselineMetrics(
            operation_type=operation_type,
            hardware_config=baseline_metrics[0].hardware_config,
            baseline_inference_time_ms=statistics.mean(execution_times) if operation_type == 'inference' else 0.0,
            baseline_training_time_ms=statistics.mean(execution_times) if operation_type == 'training' else 0.0,
            baseline_batch_processing_time_ms=statistics.mean(execution_times) if operation_type == 'batch_processing' else 0.0,
            baseline_memory_usage_mb=statistics.mean(memory_deltas),
            baseline_peak_memory_mb=max(m.memory_peak_mb for m in baseline_metrics),
            baseline_throughput_predictions_per_sec=100.0,  # Placeholder
            baseline_accuracy=statistics.mean(accuracies) if accuracies else 0.0,
            baseline_model_size_mb=baseline_metrics[0].model_size_mb,
            measurement_date=datetime.now().isoformat(),
            sample_count=len(baseline_metrics),
            confidence_interval=0.95
        )
        
        # Store baseline
        self.baselines[f"{operation_type}_{baseline.hardware_config}"] = baseline
        await self._save_baselines()
        
        logger.info(f"Baseline established for {operation_type}: "
                   f"avg_time={statistics.mean(execution_times):.1f}ms, "
                   f"avg_memory={statistics.mean(memory_deltas):.1f}MB")
        
        return baseline
    
    async def _check_regression(self, metrics: ProfilingMetrics):
        """Check for performance regression against baseline"""
        baseline_key = f"{metrics.operation_type}_{metrics.hardware_config}"
        
        if baseline_key in self.baselines:
            baseline = self.baselines[baseline_key]
            regression = self.regression_detector.detect_regression(metrics, baseline)
            
            if regression:
                logger.warning(f"Performance regression detected for {metrics.operation_id}: "
                             f"{regression['overall_severity']} severity")
                
                # Could trigger alerts or automatic optimization here
                await self._handle_regression(regression)
    
    async def _handle_regression(self, regression: Dict[str, Any]):
        """Handle detected performance regression"""
        # Log detailed regression information
        logger.warning(f"Regression details: {json.dumps(regression, indent=2)}")
        
        # Could implement automatic remediation strategies here
        # For now, just log recommendations
        recommendations = []
        
        for reg in regression['regressions']:
            if reg['metric'] == 'inference_time':
                recommendations.append("Consider enabling GPU acceleration or model quantization")
            elif reg['metric'] == 'memory_usage':
                recommendations.append("Consider reducing batch size or enabling memory optimization")
            elif reg['metric'] == 'accuracy':
                recommendations.append("Review recent model changes or training data quality")
        
        if recommendations:
            logger.info(f"Regression remediation recommendations: {recommendations}")
    
    async def _update_baseline(self, metrics: ProfilingMetrics):
        """Update baseline with new metrics (if appropriate)"""
        baseline_key = f"{metrics.operation_type}_{metrics.hardware_config}"
        
        # Only update baseline if performance is better or similar
        if baseline_key in self.baselines:
            baseline = self.baselines[baseline_key]
            
            # Simple baseline update logic - could be more sophisticated
            if (metrics.execution_time_ms <= baseline.baseline_inference_time_ms * 1.1 and
                metrics.memory_delta_mb <= baseline.baseline_memory_usage_mb * 1.1):
                
                # Update baseline with exponential moving average
                alpha = 0.1  # Learning rate for baseline updates
                
                if metrics.operation_type == 'inference':
                    baseline.baseline_inference_time_ms = (
                        (1 - alpha) * baseline.baseline_inference_time_ms + 
                        alpha * metrics.execution_time_ms
                    )
                
                baseline.baseline_memory_usage_mb = (
                    (1 - alpha) * baseline.baseline_memory_usage_mb + 
                    alpha * metrics.memory_delta_mb
                )
                
                logger.debug(f"Updated baseline for {baseline_key}")
    
    def _load_baselines(self):
        """Load baselines from storage"""
        try:
            if os.path.exists(self.baseline_storage_path):
                with open(self.baseline_storage_path, 'r') as f:
                    baseline_data = json.load(f)
                
                for key, data in baseline_data.items():
                    self.baselines[key] = BaselineMetrics(**data)
                
                logger.info(f"Loaded {len(self.baselines)} baselines from storage")
        except Exception as e:
            logger.error(f"Failed to load baselines: {e}")
    
    async def _save_baselines(self):
        """Save baselines to storage"""
        try:
            os.makedirs(os.path.dirname(self.baseline_storage_path), exist_ok=True)
            
            baseline_data = {key: baseline.to_dict() 
                           for key, baseline in self.baselines.items()}
            
            with open(self.baseline_storage_path, 'w') as f:
                json.dump(baseline_data, f, indent=2)
            
            logger.debug(f"Saved {len(self.baselines)} baselines to storage")
        except Exception as e:
            logger.error(f"Failed to save baselines: {e}")
    
    async def run_comprehensive_benchmark(self, model_func: Callable, 
                                        training_func: Callable,
                                        test_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run comprehensive benchmark suite covering all operation types
        
        Args:
            model_func: Function for inference operations
            training_func: Function for training operations
            test_data: Test data for benchmarking
            
        Returns:
            Comprehensive benchmark results
        """
        logger.info("Starting comprehensive performance benchmark suite")
        
        benchmark_results = {}
        
        try:
            # Run inference benchmark
            logger.info("Running inference benchmark...")
            inference_results = await self.automated_benchmark.run_inference_benchmark(
                model_func, test_data
            )
            benchmark_results['inference'] = inference_results
            
            # Run training benchmark
            logger.info("Running training benchmark...")
            training_results = await self.automated_benchmark.run_training_benchmark(
                training_func, test_data
            )
            benchmark_results['training'] = training_results
            
            # Generate overall analysis
            overall_analysis = {
                'benchmark_timestamp': time.time(),
                'total_operations_tested': (
                    inference_results.get('total_measurements', 0) + 
                    training_results.get('total_measurements', 0)
                ),
                'hardware_config': self.automated_benchmark._get_hardware_config(),
                'performance_targets_met': (
                    inference_results.get('performance_targets', {}).get('meets_targets', False) and
                    training_results.get('performance_targets', {}).get('meets_targets', False)
                ),
                'recommendations': (
                    inference_results.get('recommendations', []) + 
                    training_results.get('recommendations', [])
                )
            }
            
            benchmark_results['overall_analysis'] = overall_analysis
            
            logger.info("Comprehensive benchmark completed successfully")
            
        except Exception as e:
            logger.error(f"Comprehensive benchmark failed: {e}")
            benchmark_results['error'] = str(e)
        
        return benchmark_results
    
    def get_performance_dashboard_data(self) -> Dict[str, Any]:
        """
        Get comprehensive performance data for dashboard display
        Implements Requirement 4.4 for performance dashboard
        
        Returns:
            Dashboard data with metrics, trends, and alerts
        """
        if not self.metrics_history:
            return {
                'status': 'no_data',
                'message': 'No performance data available'
            }
        
        # Recent metrics analysis (last 100 operations)
        recent_metrics = list(self.metrics_history)[-100:]
        
        # Calculate current performance statistics
        current_stats = self._calculate_performance_stats(recent_metrics)
        
        # Get regression trends
        regression_trends = self.regression_detector.get_regression_trends(days=7)
        
        # Performance target compliance
        target_compliance = self._analyze_target_compliance(recent_metrics)
        
        # Hardware utilization analysis
        hardware_analysis = self._analyze_hardware_utilization(recent_metrics)
        
        # Generate alerts
        alerts = self._generate_performance_alerts(recent_metrics, regression_trends)
        
        dashboard_data = {
            'status': 'active',
            'last_updated': time.time(),
            'metrics_count': len(self.metrics_history),
            'current_performance': current_stats,
            'target_compliance': target_compliance,
            'regression_analysis': regression_trends,
            'hardware_utilization': hardware_analysis,
            'alerts': alerts,
            'baselines_count': len(self.baselines),
            'profiling_config': self.profiling_config,
            'performance_targets': self.performance_targets
        }
        
        return dashboard_data
    
    def _calculate_performance_stats(self, metrics: List[ProfilingMetrics]) -> Dict[str, Any]:
        """Calculate current performance statistics"""
        if not metrics:
            return {}
        
        # Group by operation type
        by_operation = defaultdict(list)
        for m in metrics:
            by_operation[m.operation_type].append(m)
        
        stats = {}
        for op_type, op_metrics in by_operation.items():
            execution_times = [m.execution_time_ms for m in op_metrics]
            memory_deltas = [m.memory_delta_mb for m in op_metrics]
            
            stats[op_type] = {
                'count': len(op_metrics),
                'avg_execution_time_ms': statistics.mean(execution_times),
                'p95_execution_time_ms': self.automated_benchmark._percentile(execution_times, 95),
                'avg_memory_delta_mb': statistics.mean(memory_deltas),
                'max_memory_delta_mb': max(memory_deltas),
                'target_compliance_rate': sum(1 for m in op_metrics if m.meets_inference_target) / len(op_metrics)
            }
        
        return stats
    
    def _analyze_target_compliance(self, metrics: List[ProfilingMetrics]) -> Dict[str, Any]:
        """Analyze compliance with performance targets"""
        if not metrics:
            return {}
        
        inference_metrics = [m for m in metrics if m.operation_type == 'inference']
        training_metrics = [m for m in metrics if m.operation_type == 'training']
        
        compliance = {
            'inference_time_compliance': 0.0,
            'memory_compliance': 0.0,
            'throughput_compliance': 0.0,
            'overall_compliance': 0.0
        }
        
        if inference_metrics:
            compliance['inference_time_compliance'] = (
                sum(1 for m in inference_metrics if m.meets_inference_target) / len(inference_metrics)
            )
        
        if metrics:
            compliance['memory_compliance'] = (
                sum(1 for m in metrics if m.meets_memory_target) / len(metrics)
            )
            
            compliance['throughput_compliance'] = (
                sum(1 for m in metrics if m.meets_throughput_target) / len(metrics)
            )
        
        # Calculate overall compliance
        compliance_values = [v for v in compliance.values() if isinstance(v, float)]
        if compliance_values:
            compliance['overall_compliance'] = statistics.mean(compliance_values)
        
        return compliance
    
    def _analyze_hardware_utilization(self, metrics: List[ProfilingMetrics]) -> Dict[str, Any]:
        """Analyze hardware utilization patterns"""
        if not metrics:
            return {}
        
        gpu_metrics = [m for m in metrics if m.gpu_utilization_percent is not None]
        
        analysis = {
            'gpu_available': len(gpu_metrics) > 0,
            'gpu_utilization_avg': 0.0,
            'memory_efficiency': 0.0,
            'hardware_configs': list(set(m.hardware_config for m in metrics))
        }
        
        if gpu_metrics:
            analysis['gpu_utilization_avg'] = statistics.mean(
                m.gpu_utilization_percent for m in gpu_metrics
            )
        
        # Calculate memory efficiency (lower is better)
        memory_deltas = [abs(m.memory_delta_mb) for m in metrics]
        if memory_deltas:
            analysis['memory_efficiency'] = statistics.mean(memory_deltas)
        
        return analysis
    
    def _generate_performance_alerts(self, metrics: List[ProfilingMetrics], 
                                   regression_trends: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate performance alerts based on current metrics and trends"""
        alerts = []
        
        # Check for recent performance violations
        recent_violations = [m for m in metrics[-20:] if not (
            m.meets_inference_target and m.meets_memory_target and m.meets_throughput_target
        )]
        
        if len(recent_violations) > 5:
            alerts.append({
                'severity': 'warning',
                'type': 'performance_degradation',
                'message': f"{len(recent_violations)} performance violations in last 20 operations",
                'timestamp': time.time()
            })
        
        # Check regression trends
        if regression_trends.get('status') == 'regressions_detected':
            total_regressions = regression_trends.get('total_regressions', 0)
            if total_regressions > 3:
                alerts.append({
                    'severity': 'critical',
                    'type': 'regression_trend',
                    'message': f"{total_regressions} performance regressions detected in last 7 days",
                    'timestamp': time.time()
                })
        
        # Check memory usage trends
        memory_deltas = [m.memory_delta_mb for m in metrics[-10:]]
        if memory_deltas and statistics.mean(memory_deltas) > 150:
            alerts.append({
                'severity': 'warning',
                'type': 'memory_usage',
                'message': f"Average memory usage ({statistics.mean(memory_deltas):.1f}MB) approaching limit",
                'timestamp': time.time()
            })
        
        return alerts
    
    async def cleanup(self):
        """Cleanup profiler resources"""
        logger.info("Cleaning up performance profiler...")
        
        # Save current baselines
        await self._save_baselines()
        
        # Clear metrics history
        self.metrics_history.clear()
        
        logger.info("Performance profiler cleanup completed")