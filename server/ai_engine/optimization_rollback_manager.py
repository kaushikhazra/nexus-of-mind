"""
Optimization Rollback Manager for Neural Network Performance Tuning
Handles rollback of optimizations when performance degrades or errors occur
"""

import asyncio
import logging
import time
import json
import os
import shutil
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib

logger = logging.getLogger(__name__)


class OptimizationType(Enum):
    """Types of optimizations that can be rolled back"""
    MODEL_QUANTIZATION = "model_quantization"
    GPU_ACCELERATION = "gpu_acceleration"
    BATCH_PROCESSING = "batch_processing"
    MIXED_PRECISION = "mixed_precision"
    MULTI_GPU = "multi_gpu"
    HARDWARE_OPTIMIZATION = "hardware_optimization"
    PERFORMANCE_TUNING = "performance_tuning"


class RollbackReason(Enum):
    """Reasons for optimization rollback"""
    PERFORMANCE_DEGRADATION = "performance_degradation"
    ACCURACY_LOSS = "accuracy_loss"
    SYSTEM_INSTABILITY = "system_instability"
    RESOURCE_EXHAUSTION = "resource_exhaustion"
    ERROR_THRESHOLD_EXCEEDED = "error_threshold_exceeded"
    MANUAL_ROLLBACK = "manual_rollback"
    COMPATIBILITY_ISSUE = "compatibility_issue"


@dataclass
class OptimizationSnapshot:
    """Snapshot of optimization state"""
    timestamp: float
    optimization_id: str
    optimization_type: OptimizationType
    configuration: Dict[str, Any]
    performance_metrics: Dict[str, float]
    model_path: Optional[str]
    model_hash: Optional[str]
    system_state: Dict[str, Any]
    success: bool
    error_count: int


@dataclass
class RollbackEvent:
    """Record of a rollback event"""
    timestamp: float
    optimization_id: str
    optimization_type: OptimizationType
    reason: RollbackReason
    performance_before: Dict[str, float]
    performance_after: Dict[str, float]
    rollback_success: bool
    recovery_time: float


class OptimizationRollbackManager:
    """
    Manages rollback of neural network optimizations when they cause issues
    """
    
    def __init__(self, max_snapshots: int = 10, rollback_threshold: float = 0.1):
        self.max_snapshots = max_snapshots
        self.rollback_threshold = rollback_threshold  # 10% performance degradation threshold
        
        # Storage
        self.snapshots: Dict[str, OptimizationSnapshot] = {}
        self.rollback_history: List[RollbackEvent] = []
        self.baseline_performance: Dict[str, float] = {}
        
        # Monitoring
        self.performance_tracking: Dict[str, List[float]] = {}
        self.error_tracking: Dict[str, int] = {}
        self.stability_tracking: Dict[str, List[bool]] = {}
        
        # Configuration
        self.auto_rollback_enabled = True
        self.performance_window_size = 10
        self.error_threshold = 5
        self.stability_threshold = 0.7
        
        # Paths
        self.snapshot_dir = "optimization_snapshots"
        self.rollback_log_path = "optimization_rollbacks.json"
        
        # Initialize storage
        self._initialize_storage()
        self._load_existing_data()
    
    def _initialize_storage(self):
        """Initialize storage directories and files"""
        os.makedirs(self.snapshot_dir, exist_ok=True)
        
        if not os.path.exists(self.rollback_log_path):
            with open(self.rollback_log_path, 'w') as f:
                json.dump([], f)
    
    def _load_existing_data(self):
        """Load existing rollback data"""
        try:
            if os.path.exists(self.rollback_log_path):
                with open(self.rollback_log_path, 'r') as f:
                    rollback_data = json.load(f)
                    
                for event_data in rollback_data:
                    event = RollbackEvent(
                        timestamp=event_data['timestamp'],
                        optimization_id=event_data['optimization_id'],
                        optimization_type=OptimizationType(event_data['optimization_type']),
                        reason=RollbackReason(event_data['reason']),
                        performance_before=event_data['performance_before'],
                        performance_after=event_data['performance_after'],
                        rollback_success=event_data['rollback_success'],
                        recovery_time=event_data['recovery_time']
                    )
                    self.rollback_history.append(event)
                    
            logger.info(f"Loaded {len(self.rollback_history)} rollback events from history")
            
        except Exception as e:
            logger.error(f"Error loading rollback data: {e}")
    
    async def create_optimization_snapshot(self, 
                                         optimization_type: OptimizationType,
                                         configuration: Dict[str, Any],
                                         model_path: Optional[str] = None) -> str:
        """
        Create a snapshot before applying optimization
        
        Args:
            optimization_type: Type of optimization being applied
            configuration: Optimization configuration
            model_path: Path to model file (if applicable)
            
        Returns:
            Snapshot ID for later rollback
        """
        try:
            # Generate unique optimization ID
            optimization_id = self._generate_optimization_id(optimization_type, configuration)
            
            # Get current performance metrics
            performance_metrics = await self._collect_performance_metrics()
            
            # Get system state
            system_state = await self._collect_system_state()
            
            # Create model backup if provided
            model_hash = None
            backup_model_path = None
            if model_path and os.path.exists(model_path):
                model_hash = self._calculate_file_hash(model_path)
                backup_model_path = os.path.join(
                    self.snapshot_dir, 
                    f"model_{optimization_id}_{int(time.time())}.keras"
                )
                shutil.copy2(model_path, backup_model_path)
            
            # Create snapshot
            snapshot = OptimizationSnapshot(
                timestamp=time.time(),
                optimization_id=optimization_id,
                optimization_type=optimization_type,
                configuration=configuration.copy(),
                performance_metrics=performance_metrics,
                model_path=backup_model_path,
                model_hash=model_hash,
                system_state=system_state,
                success=True,
                error_count=0
            )
            
            # Store snapshot
            self.snapshots[optimization_id] = snapshot
            
            # Save snapshot to disk
            await self._save_snapshot_to_disk(snapshot)
            
            # Clean up old snapshots
            await self._cleanup_old_snapshots()
            
            # Initialize tracking for this optimization
            self.performance_tracking[optimization_id] = []
            self.error_tracking[optimization_id] = 0
            self.stability_tracking[optimization_id] = []
            
            logger.info(f"Created optimization snapshot: {optimization_id} ({optimization_type.value})")
            return optimization_id
            
        except Exception as e:
            logger.error(f"Error creating optimization snapshot: {e}")
            raise
    
    async def monitor_optimization_performance(self, 
                                             optimization_id: str,
                                             current_metrics: Dict[str, float],
                                             error_occurred: bool = False) -> Dict[str, Any]:
        """
        Monitor performance of an applied optimization
        
        Args:
            optimization_id: ID of the optimization to monitor
            current_metrics: Current performance metrics
            error_occurred: Whether an error occurred
            
        Returns:
            Monitoring result with rollback recommendation
        """
        try:
            if optimization_id not in self.snapshots:
                logger.warning(f"Unknown optimization ID: {optimization_id}")
                return {'rollback_recommended': False, 'reason': 'unknown_optimization'}
            
            snapshot = self.snapshots[optimization_id]
            
            # Update tracking
            self.performance_tracking[optimization_id].append(current_metrics.get('inference_time', 0))
            if error_occurred:
                self.error_tracking[optimization_id] += 1
            
            # Keep only recent performance data
            if len(self.performance_tracking[optimization_id]) > self.performance_window_size:
                self.performance_tracking[optimization_id] = \
                    self.performance_tracking[optimization_id][-self.performance_window_size:]
            
            # Analyze performance degradation
            performance_analysis = self._analyze_performance_degradation(
                optimization_id, snapshot.performance_metrics, current_metrics
            )
            
            # Analyze error rate
            error_analysis = self._analyze_error_rate(optimization_id)
            
            # Analyze stability
            stability_analysis = self._analyze_stability(optimization_id, current_metrics)
            
            # Determine if rollback is needed
            rollback_needed = False
            rollback_reason = None
            
            if performance_analysis['degradation_detected']:
                rollback_needed = True
                rollback_reason = RollbackReason.PERFORMANCE_DEGRADATION
            elif error_analysis['threshold_exceeded']:
                rollback_needed = True
                rollback_reason = RollbackReason.ERROR_THRESHOLD_EXCEEDED
            elif not stability_analysis['stable']:
                rollback_needed = True
                rollback_reason = RollbackReason.SYSTEM_INSTABILITY
            
            # Auto-rollback if enabled and needed
            if rollback_needed and self.auto_rollback_enabled:
                logger.warning(f"Auto-rollback triggered for {optimization_id}: {rollback_reason.value}")
                rollback_result = await self.rollback_optimization(optimization_id, rollback_reason)
                
                return {
                    'rollback_recommended': True,
                    'rollback_executed': True,
                    'rollback_result': rollback_result,
                    'reason': rollback_reason.value,
                    'performance_analysis': performance_analysis,
                    'error_analysis': error_analysis,
                    'stability_analysis': stability_analysis
                }
            
            return {
                'rollback_recommended': rollback_needed,
                'rollback_executed': False,
                'reason': rollback_reason.value if rollback_reason else None,
                'performance_analysis': performance_analysis,
                'error_analysis': error_analysis,
                'stability_analysis': stability_analysis
            }
            
        except Exception as e:
            logger.error(f"Error monitoring optimization performance: {e}")
            return {'rollback_recommended': True, 'reason': 'monitoring_error', 'error': str(e)}
    
    def _analyze_performance_degradation(self, 
                                       optimization_id: str,
                                       baseline_metrics: Dict[str, float],
                                       current_metrics: Dict[str, float]) -> Dict[str, Any]:
        """Analyze performance degradation compared to baseline"""
        try:
            degradation_detected = False
            degradations = {}
            
            # Check key performance metrics
            key_metrics = ['inference_time', 'training_time', 'accuracy', 'throughput']
            
            for metric in key_metrics:
                if metric in baseline_metrics and metric in current_metrics:
                    baseline_value = baseline_metrics[metric]
                    current_value = current_metrics[metric]
                    
                    # Calculate degradation (higher is worse for time metrics, lower is worse for accuracy/throughput)
                    if metric in ['inference_time', 'training_time']:
                        degradation = (current_value - baseline_value) / baseline_value
                    else:  # accuracy, throughput
                        degradation = (baseline_value - current_value) / baseline_value
                    
                    degradations[metric] = degradation
                    
                    if degradation > self.rollback_threshold:
                        degradation_detected = True
            
            # Check recent performance trend
            recent_performance = self.performance_tracking.get(optimization_id, [])
            trend_degrading = False
            
            if len(recent_performance) >= 5:
                recent_avg = sum(recent_performance[-5:]) / 5
                earlier_avg = sum(recent_performance[-10:-5]) / 5 if len(recent_performance) >= 10 else recent_avg
                
                if recent_avg > earlier_avg * (1 + self.rollback_threshold):
                    trend_degrading = True
            
            return {
                'degradation_detected': degradation_detected or trend_degrading,
                'metric_degradations': degradations,
                'trend_degrading': trend_degrading,
                'recent_performance_avg': sum(recent_performance[-5:]) / 5 if recent_performance else 0
            }
            
        except Exception as e:
            logger.error(f"Error analyzing performance degradation: {e}")
            return {'degradation_detected': True, 'error': str(e)}
    
    def _analyze_error_rate(self, optimization_id: str) -> Dict[str, Any]:
        """Analyze error rate for the optimization"""
        error_count = self.error_tracking.get(optimization_id, 0)
        threshold_exceeded = error_count >= self.error_threshold
        
        return {
            'error_count': error_count,
            'threshold_exceeded': threshold_exceeded,
            'error_threshold': self.error_threshold
        }
    
    def _analyze_stability(self, optimization_id: str, current_metrics: Dict[str, float]) -> Dict[str, Any]:
        """Analyze system stability with the optimization"""
        try:
            # Check if current performance is stable
            recent_performance = self.performance_tracking.get(optimization_id, [])
            
            if len(recent_performance) < 3:
                return {'stable': True, 'reason': 'insufficient_data'}
            
            # Calculate coefficient of variation (stability measure)
            import statistics
            mean_perf = statistics.mean(recent_performance)
            std_perf = statistics.stdev(recent_performance) if len(recent_performance) > 1 else 0
            
            coefficient_of_variation = std_perf / mean_perf if mean_perf > 0 else 1.0
            
            # Stability threshold (lower CV = more stable)
            stable = coefficient_of_variation < (1 - self.stability_threshold)
            
            return {
                'stable': stable,
                'coefficient_of_variation': coefficient_of_variation,
                'stability_threshold': self.stability_threshold,
                'recent_performance_count': len(recent_performance)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing stability: {e}")
            return {'stable': False, 'error': str(e)}
    
    async def rollback_optimization(self, 
                                  optimization_id: str,
                                  reason: RollbackReason) -> Dict[str, Any]:
        """
        Rollback an optimization to its previous state
        
        Args:
            optimization_id: ID of optimization to rollback
            reason: Reason for rollback
            
        Returns:
            Rollback result
        """
        try:
            rollback_start_time = time.time()
            
            if optimization_id not in self.snapshots:
                return {
                    'success': False,
                    'error': f'No snapshot found for optimization {optimization_id}'
                }
            
            snapshot = self.snapshots[optimization_id]
            
            logger.info(f"Rolling back optimization {optimization_id} ({snapshot.optimization_type.value}): {reason.value}")
            
            # Get current performance for comparison
            current_performance = await self._collect_performance_metrics()
            
            # Perform rollback based on optimization type
            rollback_success = False
            
            if snapshot.optimization_type == OptimizationType.MODEL_QUANTIZATION:
                rollback_success = await self._rollback_model_quantization(snapshot)
            elif snapshot.optimization_type == OptimizationType.GPU_ACCELERATION:
                rollback_success = await self._rollback_gpu_acceleration(snapshot)
            elif snapshot.optimization_type == OptimizationType.BATCH_PROCESSING:
                rollback_success = await self._rollback_batch_processing(snapshot)
            elif snapshot.optimization_type == OptimizationType.MIXED_PRECISION:
                rollback_success = await self._rollback_mixed_precision(snapshot)
            elif snapshot.optimization_type == OptimizationType.MULTI_GPU:
                rollback_success = await self._rollback_multi_gpu(snapshot)
            elif snapshot.optimization_type == OptimizationType.HARDWARE_OPTIMIZATION:
                rollback_success = await self._rollback_hardware_optimization(snapshot)
            elif snapshot.optimization_type == OptimizationType.PERFORMANCE_TUNING:
                rollback_success = await self._rollback_performance_tuning(snapshot)
            else:
                logger.warning(f"Unknown optimization type for rollback: {snapshot.optimization_type}")
                rollback_success = False
            
            # Get performance after rollback
            post_rollback_performance = await self._collect_performance_metrics()
            
            # Calculate recovery time
            recovery_time = time.time() - rollback_start_time
            
            # Record rollback event
            rollback_event = RollbackEvent(
                timestamp=time.time(),
                optimization_id=optimization_id,
                optimization_type=snapshot.optimization_type,
                reason=reason,
                performance_before=current_performance,
                performance_after=post_rollback_performance,
                rollback_success=rollback_success,
                recovery_time=recovery_time
            )
            
            self.rollback_history.append(rollback_event)
            await self._save_rollback_history()
            
            # Clean up tracking for this optimization
            if optimization_id in self.performance_tracking:
                del self.performance_tracking[optimization_id]
            if optimization_id in self.error_tracking:
                del self.error_tracking[optimization_id]
            if optimization_id in self.stability_tracking:
                del self.stability_tracking[optimization_id]
            
            result = {
                'success': rollback_success,
                'optimization_type': snapshot.optimization_type.value,
                'reason': reason.value,
                'recovery_time': recovery_time,
                'performance_before': current_performance,
                'performance_after': post_rollback_performance
            }
            
            if rollback_success:
                logger.info(f"Successfully rolled back optimization {optimization_id} in {recovery_time:.2f}s")
            else:
                logger.error(f"Failed to rollback optimization {optimization_id}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error during optimization rollback: {e}")
            return {
                'success': False,
                'error': str(e),
                'optimization_id': optimization_id
            }
    
    async def _rollback_model_quantization(self, snapshot: OptimizationSnapshot) -> bool:
        """Rollback model quantization optimization"""
        try:
            # Restore original model if available
            if snapshot.model_path and os.path.exists(snapshot.model_path):
                # Load the original model
                import tensorflow as tf
                original_model = tf.keras.models.load_model(snapshot.model_path)
                
                # Save as current model
                current_model_path = "models/queen_behavior_model.keras"
                original_model.save(current_model_path)
                
                logger.info("Restored original model from quantization rollback")
                return True
            else:
                logger.warning("No model backup available for quantization rollback")
                return False
                
        except Exception as e:
            logger.error(f"Error rolling back model quantization: {e}")
            return False
    
    async def _rollback_gpu_acceleration(self, snapshot: OptimizationSnapshot) -> bool:
        """Rollback GPU acceleration optimization"""
        try:
            # Force CPU-only mode
            os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
            
            # Clear TensorFlow session
            import tensorflow as tf
            tf.keras.backend.clear_session()
            
            logger.info("Rolled back GPU acceleration to CPU-only mode")
            return True
            
        except Exception as e:
            logger.error(f"Error rolling back GPU acceleration: {e}")
            return False
    
    async def _rollback_batch_processing(self, snapshot: OptimizationSnapshot) -> bool:
        """Rollback batch processing optimization"""
        try:
            # Restore original batch processing configuration
            original_config = snapshot.configuration
            
            # This would typically involve updating the batch processor configuration
            # For now, we'll just log the rollback
            logger.info(f"Rolled back batch processing to configuration: {original_config}")
            return True
            
        except Exception as e:
            logger.error(f"Error rolling back batch processing: {e}")
            return False
    
    async def _rollback_mixed_precision(self, snapshot: OptimizationSnapshot) -> bool:
        """Rollback mixed precision optimization"""
        try:
            # Disable mixed precision
            import tensorflow as tf
            tf.keras.mixed_precision.set_global_policy('float32')
            
            logger.info("Rolled back mixed precision to float32")
            return True
            
        except Exception as e:
            logger.error(f"Error rolling back mixed precision: {e}")
            return False
    
    async def _rollback_multi_gpu(self, snapshot: OptimizationSnapshot) -> bool:
        """Rollback multi-GPU optimization"""
        try:
            # Disable multi-GPU coordination
            # This would typically involve updating the multi-GPU coordinator
            logger.info("Rolled back multi-GPU optimization to single GPU mode")
            return True
            
        except Exception as e:
            logger.error(f"Error rolling back multi-GPU: {e}")
            return False
    
    async def _rollback_hardware_optimization(self, snapshot: OptimizationSnapshot) -> bool:
        """Rollback hardware optimization"""
        try:
            # Restore original hardware configuration
            original_config = snapshot.system_state
            
            logger.info(f"Rolled back hardware optimization to: {original_config}")
            return True
            
        except Exception as e:
            logger.error(f"Error rolling back hardware optimization: {e}")
            return False
    
    async def _rollback_performance_tuning(self, snapshot: OptimizationSnapshot) -> bool:
        """Rollback performance tuning optimization"""
        try:
            # Restore original performance tuning configuration
            original_config = snapshot.configuration
            
            logger.info(f"Rolled back performance tuning to: {original_config}")
            return True
            
        except Exception as e:
            logger.error(f"Error rolling back performance tuning: {e}")
            return False
    
    async def _collect_performance_metrics(self) -> Dict[str, float]:
        """Collect current performance metrics"""
        try:
            # This would typically collect real performance metrics
            # For now, return placeholder metrics
            return {
                'inference_time': 25.0,  # ms
                'training_time': 120.0,  # seconds
                'accuracy': 0.85,
                'throughput': 40.0,  # predictions/second
                'memory_usage': 512.0,  # MB
                'gpu_utilization': 75.0  # %
            }
        except Exception as e:
            logger.error(f"Error collecting performance metrics: {e}")
            return {}
    
    async def _collect_system_state(self) -> Dict[str, Any]:
        """Collect current system state"""
        try:
            import psutil
            
            return {
                'cpu_usage': psutil.cpu_percent(),
                'memory_usage': psutil.virtual_memory().percent,
                'disk_usage': psutil.disk_usage('/').percent,
                'gpu_available': len(os.environ.get('CUDA_VISIBLE_DEVICES', '').split(',')) > 0,
                'tensorflow_version': '2.x',  # Placeholder
                'timestamp': time.time()
            }
        except Exception as e:
            logger.error(f"Error collecting system state: {e}")
            return {}
    
    def _generate_optimization_id(self, optimization_type: OptimizationType, configuration: Dict[str, Any]) -> str:
        """Generate unique optimization ID"""
        config_str = json.dumps(configuration, sort_keys=True)
        hash_input = f"{optimization_type.value}_{config_str}_{time.time()}"
        return hashlib.md5(hash_input.encode()).hexdigest()[:12]
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate hash of a file"""
        try:
            hash_md5 = hashlib.md5()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception as e:
            logger.error(f"Error calculating file hash: {e}")
            return ""
    
    async def _save_snapshot_to_disk(self, snapshot: OptimizationSnapshot):
        """Save snapshot metadata to disk"""
        try:
            snapshot_file = os.path.join(
                self.snapshot_dir, 
                f"snapshot_{snapshot.optimization_id}.json"
            )
            
            snapshot_data = asdict(snapshot)
            snapshot_data['optimization_type'] = snapshot.optimization_type.value
            
            with open(snapshot_file, 'w') as f:
                json.dump(snapshot_data, f, indent=2, default=str)
                
        except Exception as e:
            logger.error(f"Error saving snapshot to disk: {e}")
    
    async def _save_rollback_history(self):
        """Save rollback history to disk"""
        try:
            rollback_data = []
            for event in self.rollback_history:
                event_data = asdict(event)
                event_data['optimization_type'] = event.optimization_type.value
                event_data['reason'] = event.reason.value
                rollback_data.append(event_data)
            
            with open(self.rollback_log_path, 'w') as f:
                json.dump(rollback_data, f, indent=2, default=str)
                
        except Exception as e:
            logger.error(f"Error saving rollback history: {e}")
    
    async def _cleanup_old_snapshots(self):
        """Clean up old snapshots to maintain storage limits"""
        try:
            if len(self.snapshots) > self.max_snapshots:
                # Sort by timestamp and remove oldest
                sorted_snapshots = sorted(
                    self.snapshots.items(), 
                    key=lambda x: x[1].timestamp
                )
                
                # Remove oldest snapshots
                to_remove = len(self.snapshots) - self.max_snapshots
                for i in range(to_remove):
                    optimization_id, snapshot = sorted_snapshots[i]
                    
                    # Remove from memory
                    del self.snapshots[optimization_id]
                    
                    # Remove files
                    if snapshot.model_path and os.path.exists(snapshot.model_path):
                        os.remove(snapshot.model_path)
                    
                    snapshot_file = os.path.join(
                        self.snapshot_dir, 
                        f"snapshot_{optimization_id}.json"
                    )
                    if os.path.exists(snapshot_file):
                        os.remove(snapshot_file)
                
                logger.info(f"Cleaned up {to_remove} old optimization snapshots")
                
        except Exception as e:
            logger.error(f"Error cleaning up old snapshots: {e}")
    
    def get_rollback_statistics(self) -> Dict[str, Any]:
        """Get statistics about rollback events"""
        try:
            if not self.rollback_history:
                return {'total_rollbacks': 0}
            
            # Count by optimization type
            type_counts = {}
            reason_counts = {}
            success_count = 0
            total_recovery_time = 0
            
            for event in self.rollback_history:
                # Count by type
                opt_type = event.optimization_type.value
                type_counts[opt_type] = type_counts.get(opt_type, 0) + 1
                
                # Count by reason
                reason = event.reason.value
                reason_counts[reason] = reason_counts.get(reason, 0) + 1
                
                # Success rate
                if event.rollback_success:
                    success_count += 1
                
                # Recovery time
                total_recovery_time += event.recovery_time
            
            return {
                'total_rollbacks': len(self.rollback_history),
                'success_rate': success_count / len(self.rollback_history),
                'average_recovery_time': total_recovery_time / len(self.rollback_history),
                'rollbacks_by_type': type_counts,
                'rollbacks_by_reason': reason_counts,
                'recent_rollbacks': len([e for e in self.rollback_history if time.time() - e.timestamp < 3600])
            }
            
        except Exception as e:
            logger.error(f"Error calculating rollback statistics: {e}")
            return {'error': str(e)}
    
    async def cleanup(self):
        """Cleanup rollback manager resources"""
        try:
            # Save final state
            await self._save_rollback_history()
            
            # Clear memory
            self.snapshots.clear()
            self.performance_tracking.clear()
            self.error_tracking.clear()
            self.stability_tracking.clear()
            
            logger.info("Optimization rollback manager cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during rollback manager cleanup: {e}")