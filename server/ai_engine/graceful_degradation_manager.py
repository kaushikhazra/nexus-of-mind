"""
Graceful Degradation Manager for Neural Network Optimization
Maintains service availability during optimization failures and system stress
"""

import asyncio
import logging
import time
import psutil
import os
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import json

logger = logging.getLogger(__name__)


class DegradationLevel(Enum):
    """System degradation levels"""
    NORMAL = 0
    LIGHT = 1
    MODERATE = 2
    HEAVY = 3
    CRITICAL = 4


class ServiceMode(Enum):
    """Service operation modes"""
    FULL_PERFORMANCE = "full_performance"
    OPTIMIZED = "optimized"
    REDUCED = "reduced"
    MINIMAL = "minimal"
    EMERGENCY = "emergency"


@dataclass
class SystemResources:
    """Current system resource status"""
    cpu_usage: float
    memory_usage: float
    memory_available: float
    gpu_memory_usage: float
    gpu_available: bool
    disk_usage: float
    network_latency: float
    timestamp: float


@dataclass
class DegradationConfig:
    """Configuration for graceful degradation"""
    # Resource thresholds
    cpu_threshold_light: float = 80.0
    cpu_threshold_moderate: float = 90.0
    cpu_threshold_heavy: float = 95.0
    
    memory_threshold_light: float = 80.0
    memory_threshold_moderate: float = 90.0
    memory_threshold_heavy: float = 95.0
    
    gpu_memory_threshold: float = 90.0
    disk_threshold: float = 95.0
    
    # Performance thresholds
    inference_time_threshold: float = 50.0  # ms
    training_time_threshold: float = 300.0  # seconds
    
    # Degradation settings
    enable_auto_degradation: bool = True
    enable_resource_monitoring: bool = True
    enable_performance_rollback: bool = True
    
    # Recovery settings
    recovery_check_interval: float = 30.0  # seconds
    auto_recovery_enabled: bool = True
    recovery_stability_period: float = 120.0  # seconds


class GracefulDegradationManager:
    """
    Manages graceful degradation of neural network services during stress or failures
    """
    
    def __init__(self, config: Optional[DegradationConfig] = None):
        self.config = config or DegradationConfig()
        self.current_level = DegradationLevel.NORMAL
        self.current_mode = ServiceMode.FULL_PERFORMANCE
        
        # System monitoring
        self.resource_history: List[SystemResources] = []
        self.performance_history: List[Dict[str, Any]] = []
        self.degradation_history: List[Dict[str, Any]] = []
        
        # Service state
        self.disabled_features: List[str] = []
        self.reduced_features: Dict[str, float] = {}  # feature -> reduction factor
        self.fallback_active: Dict[str, bool] = {}
        
        # Recovery tracking
        self.last_degradation_time = 0
        self.recovery_start_time = 0
        self.stability_check_task: Optional[asyncio.Task] = None
        
        # Callbacks
        self.degradation_callbacks: List[Callable] = []
        self.recovery_callbacks: List[Callable] = []
        
        # Initialize monitoring
        self.monitoring_active = False
        self.monitoring_task: Optional[asyncio.Task] = None
    
    async def start_monitoring(self):
        """Start system resource and performance monitoring"""
        if self.monitoring_active:
            return
        
        self.monitoring_active = True
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        logger.info("Graceful degradation monitoring started")
    
    async def stop_monitoring(self):
        """Stop system monitoring"""
        self.monitoring_active = False
        
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        
        if self.stability_check_task:
            self.stability_check_task.cancel()
            try:
                await self.stability_check_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Graceful degradation monitoring stopped")
    
    async def _monitoring_loop(self):
        """Main monitoring loop for system resources and performance"""
        try:
            while self.monitoring_active:
                # Collect system resources
                resources = await self._collect_system_resources()
                self.resource_history.append(resources)
                
                # Keep only recent history
                if len(self.resource_history) > 100:
                    self.resource_history = self.resource_history[-100:]
                
                # Analyze degradation need
                if self.config.enable_auto_degradation:
                    await self._analyze_degradation_need(resources)
                
                # Check for recovery opportunities
                if self.config.auto_recovery_enabled and self.current_level != DegradationLevel.NORMAL:
                    await self._check_recovery_opportunity(resources)
                
                await asyncio.sleep(5.0)  # Check every 5 seconds
                
        except asyncio.CancelledError:
            logger.info("Monitoring loop cancelled")
        except Exception as e:
            logger.error(f"Error in monitoring loop: {e}")
    
    async def _collect_system_resources(self) -> SystemResources:
        """Collect current system resource usage"""
        try:
            # CPU usage
            cpu_usage = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_usage = memory.percent
            memory_available = memory.available / (1024 * 1024 * 1024)  # GB
            
            # GPU memory (if available) - check via PyTorch
            gpu_memory_usage = 0.0
            gpu_available = False
            try:
                import torch
                if torch.cuda.is_available():
                    gpu_available = True
                    # Get GPU memory info if available
                    gpu_memory_usage = 50.0  # Placeholder - would need nvidia-ml-py for real data
            except:
                pass
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_usage = disk.percent
            
            # Network latency (placeholder)
            network_latency = 10.0  # ms
            
            return SystemResources(
                cpu_usage=cpu_usage,
                memory_usage=memory_usage,
                memory_available=memory_available,
                gpu_memory_usage=gpu_memory_usage,
                gpu_available=gpu_available,
                disk_usage=disk_usage,
                network_latency=network_latency,
                timestamp=time.time()
            )
            
        except Exception as e:
            logger.error(f"Error collecting system resources: {e}")
            # Return safe defaults
            return SystemResources(
                cpu_usage=50.0,
                memory_usage=50.0,
                memory_available=4.0,
                gpu_memory_usage=0.0,
                gpu_available=False,
                disk_usage=50.0,
                network_latency=20.0,
                timestamp=time.time()
            )
    
    async def _analyze_degradation_need(self, resources: SystemResources):
        """Analyze if system degradation is needed based on resource usage"""
        try:
            # Determine required degradation level
            required_level = self._calculate_required_degradation_level(resources)
            
            # Apply degradation if needed
            if required_level.value > self.current_level.value:
                await self._apply_degradation(required_level, resources)
            
        except Exception as e:
            logger.error(f"Error analyzing degradation need: {e}")
    
    def _calculate_required_degradation_level(self, resources: SystemResources) -> DegradationLevel:
        """Calculate required degradation level based on resource usage"""
        max_level = DegradationLevel.NORMAL
        
        # Check CPU usage
        if resources.cpu_usage >= self.config.cpu_threshold_heavy:
            max_level = DegradationLevel.HEAVY if DegradationLevel.HEAVY.value > max_level.value else max_level
        elif resources.cpu_usage >= self.config.cpu_threshold_moderate:
            max_level = DegradationLevel.MODERATE if DegradationLevel.MODERATE.value > max_level.value else max_level
        elif resources.cpu_usage >= self.config.cpu_threshold_light:
            max_level = DegradationLevel.LIGHT if DegradationLevel.LIGHT.value > max_level.value else max_level
        
        # Check memory usage
        if resources.memory_usage >= self.config.memory_threshold_heavy:
            max_level = DegradationLevel.HEAVY if DegradationLevel.HEAVY.value > max_level.value else max_level
        elif resources.memory_usage >= self.config.memory_threshold_moderate:
            max_level = DegradationLevel.MODERATE if DegradationLevel.MODERATE.value > max_level.value else max_level
        elif resources.memory_usage >= self.config.memory_threshold_light:
            max_level = DegradationLevel.LIGHT if DegradationLevel.LIGHT.value > max_level.value else max_level
        
        # Check GPU memory
        if resources.gpu_available and resources.gpu_memory_usage >= self.config.gpu_memory_threshold:
            max_level = DegradationLevel.MODERATE if DegradationLevel.MODERATE.value > max_level.value else max_level
        
        # Check disk usage
        if resources.disk_usage >= self.config.disk_threshold:
            max_level = DegradationLevel.CRITICAL if DegradationLevel.CRITICAL.value > max_level.value else max_level
        
        # Check memory availability (critical threshold)
        if resources.memory_available < 0.5:  # Less than 500MB available
            max_level = DegradationLevel.CRITICAL if DegradationLevel.CRITICAL.value > max_level.value else max_level
        
        return max_level
    
    async def _apply_degradation(self, level: DegradationLevel, resources: SystemResources):
        """Apply system degradation to the specified level"""
        try:
            previous_level = self.current_level
            self.current_level = level
            self.last_degradation_time = time.time()
            
            logger.warning(f"Applying system degradation: {previous_level.name} -> {level.name}")
            
            # Apply degradation based on level
            if level == DegradationLevel.LIGHT:
                await self._apply_light_degradation()
            elif level == DegradationLevel.MODERATE:
                await self._apply_moderate_degradation()
            elif level == DegradationLevel.HEAVY:
                await self._apply_heavy_degradation()
            elif level == DegradationLevel.CRITICAL:
                await self._apply_critical_degradation()
            
            # Record degradation event
            degradation_event = {
                'timestamp': time.time(),
                'previous_level': previous_level.name,
                'new_level': level.name,
                'trigger_resources': asdict(resources),
                'disabled_features': self.disabled_features.copy(),
                'reduced_features': self.reduced_features.copy()
            }
            self.degradation_history.append(degradation_event)
            
            # Notify callbacks
            for callback in self.degradation_callbacks:
                try:
                    await callback(level, previous_level, resources)
                except Exception as e:
                    logger.error(f"Degradation callback error: {e}")
            
        except Exception as e:
            logger.error(f"Error applying degradation: {e}")
    
    async def _apply_light_degradation(self):
        """Apply light degradation - reduce non-essential features"""
        self.current_mode = ServiceMode.OPTIMIZED
        
        # Reduce batch processing size
        self.reduced_features['batch_size'] = 0.7
        
        # Reduce profiling frequency
        self.reduced_features['profiling_frequency'] = 0.5
        
        # Reduce monitoring frequency
        self.reduced_features['monitoring_frequency'] = 0.7
        
        logger.info("Applied light degradation: reduced batch sizes and monitoring")
    
    async def _apply_moderate_degradation(self):
        """Apply moderate degradation - disable some optimizations"""
        # Apply light degradation first
        await self._apply_light_degradation()
        
        # Set the correct service mode for moderate degradation
        self.current_mode = ServiceMode.REDUCED
        
        # Disable model quantization
        self.disabled_features.append('model_quantization')
        
        # Disable GPU acceleration if memory pressure
        if any(r.gpu_memory_usage > 85 for r in self.resource_history[-3:]):
            self.disabled_features.append('gpu_acceleration')
        
        # Reduce training complexity
        self.reduced_features['training_epochs'] = 0.5
        self.reduced_features['model_complexity'] = 0.7
        
        logger.info("Applied moderate degradation: disabled quantization, reduced training")
    
    async def _apply_heavy_degradation(self):
        """Apply heavy degradation - minimal neural network functionality"""
        # Apply moderate degradation first
        await self._apply_moderate_degradation()
        
        # Set the correct service mode for heavy degradation
        self.current_mode = ServiceMode.MINIMAL
        
        # Disable batch processing
        self.disabled_features.append('batch_processing')
        
        # Disable performance profiling
        self.disabled_features.append('performance_profiling')
        
        # Disable multi-GPU coordination
        self.disabled_features.append('multi_gpu_coordination')
        
        # Severely reduce training
        self.reduced_features['training_frequency'] = 0.3
        self.reduced_features['training_epochs'] = 0.3
        
        logger.warning("Applied heavy degradation: minimal neural network functionality")
    
    async def _apply_critical_degradation(self):
        """Apply critical degradation - emergency mode with rule-based fallback"""
        # Apply heavy degradation first
        await self._apply_heavy_degradation()
        
        # Set the correct service mode for critical degradation
        self.current_mode = ServiceMode.EMERGENCY
        
        # Disable neural network training
        self.disabled_features.append('neural_network_training')
        
        # Enable rule-based fallback
        self.fallback_active['rule_based_strategy'] = True
        
        # Disable all non-essential features
        self.disabled_features.extend([
            'learning_quality_monitoring',
            'performance_optimization',
            'hardware_optimization'
        ])
        
        logger.critical("Applied critical degradation: emergency mode with rule-based fallback")
    
    async def _check_recovery_opportunity(self, resources: SystemResources):
        """Check if system can recover from current degradation level"""
        try:
            # Calculate what level would be needed now
            required_level = self._calculate_required_degradation_level(resources)
            
            # Check if we can recover (reduce degradation)
            if required_level.value < self.current_level.value:
                # Check stability period
                time_since_degradation = time.time() - self.last_degradation_time
                if time_since_degradation >= self.config.recovery_stability_period:
                    await self._attempt_recovery(required_level, resources)
            
        except Exception as e:
            logger.error(f"Error checking recovery opportunity: {e}")
    
    async def _attempt_recovery(self, target_level: DegradationLevel, resources: SystemResources):
        """Attempt to recover system to a less degraded state"""
        try:
            previous_level = self.current_level
            self.current_level = target_level
            self.recovery_start_time = time.time()
            
            logger.info(f"Attempting system recovery: {previous_level.name} -> {target_level.name}")
            
            # Clear degradation settings
            self.disabled_features.clear()
            self.reduced_features.clear()
            self.fallback_active.clear()
            
            # Apply appropriate level
            if target_level == DegradationLevel.NORMAL:
                await self._apply_full_recovery()
            elif target_level == DegradationLevel.LIGHT:
                await self._apply_light_degradation()
            elif target_level == DegradationLevel.MODERATE:
                await self._apply_moderate_degradation()
            elif target_level == DegradationLevel.HEAVY:
                await self._apply_heavy_degradation()
            
            # Start stability monitoring
            if self.stability_check_task:
                self.stability_check_task.cancel()
            
            self.stability_check_task = asyncio.create_task(
                self._monitor_recovery_stability(target_level)
            )
            
            # Notify callbacks
            for callback in self.recovery_callbacks:
                try:
                    await callback(target_level, previous_level, resources)
                except Exception as e:
                    logger.error(f"Recovery callback error: {e}")
            
        except Exception as e:
            logger.error(f"Error during recovery attempt: {e}")
            # Revert to previous level on error
            self.current_level = previous_level
    
    async def _apply_full_recovery(self):
        """Apply full recovery to normal operation"""
        self.current_mode = ServiceMode.FULL_PERFORMANCE
        
        # Clear all degradation
        self.disabled_features.clear()
        self.reduced_features.clear()
        self.fallback_active.clear()
        
        logger.info("Applied full recovery: restored to normal operation")
    
    async def _monitor_recovery_stability(self, target_level: DegradationLevel):
        """Monitor system stability after recovery attempt"""
        try:
            stability_start = time.time()
            
            while time.time() - stability_start < self.config.recovery_stability_period:
                await asyncio.sleep(10.0)  # Check every 10 seconds
                
                # Check if system is still stable
                current_resources = await self._collect_system_resources()
                required_level = self._calculate_required_degradation_level(current_resources)
                
                if required_level.value > target_level.value:
                    logger.warning("Recovery unstable, reverting degradation")
                    await self._apply_degradation(required_level, current_resources)
                    return
            
            logger.info(f"Recovery to {target_level.name} stable after {self.config.recovery_stability_period}s")
            
        except asyncio.CancelledError:
            logger.info("Recovery stability monitoring cancelled")
        except Exception as e:
            logger.error(f"Error monitoring recovery stability: {e}")
    
    def is_feature_enabled(self, feature_name: str) -> bool:
        """Check if a feature is currently enabled"""
        return feature_name not in self.disabled_features
    
    def get_feature_reduction_factor(self, feature_name: str) -> float:
        """Get reduction factor for a feature (1.0 = no reduction, 0.5 = 50% reduction)"""
        return self.reduced_features.get(feature_name, 1.0)
    
    def is_fallback_active(self, fallback_name: str) -> bool:
        """Check if a fallback mechanism is currently active"""
        return self.fallback_active.get(fallback_name, False)
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get current system degradation status"""
        return {
            'degradation_level': self.current_level.name,
            'service_mode': self.current_mode.value,
            'disabled_features': self.disabled_features.copy(),
            'reduced_features': self.reduced_features.copy(),
            'active_fallbacks': {k: v for k, v in self.fallback_active.items() if v},
            'last_degradation_time': self.last_degradation_time,
            'recovery_start_time': self.recovery_start_time,
            'monitoring_active': self.monitoring_active
        }
    
    def get_performance_impact_summary(self) -> Dict[str, Any]:
        """Get summary of current performance impact"""
        impact_level = "none"
        
        if self.current_level == DegradationLevel.LIGHT:
            impact_level = "minimal"
        elif self.current_level == DegradationLevel.MODERATE:
            impact_level = "moderate"
        elif self.current_level == DegradationLevel.HEAVY:
            impact_level = "significant"
        elif self.current_level == DegradationLevel.CRITICAL:
            impact_level = "severe"
        
        return {
            'impact_level': impact_level,
            'degradation_level': self.current_level.name,
            'service_mode': self.current_mode.value,
            'features_disabled': len(self.disabled_features),
            'features_reduced': len(self.reduced_features),
            'fallbacks_active': len([v for v in self.fallback_active.values() if v])
        }
    
    def add_degradation_callback(self, callback: Callable):
        """Add callback for degradation events"""
        self.degradation_callbacks.append(callback)
    
    def add_recovery_callback(self, callback: Callable):
        """Add callback for recovery events"""
        self.recovery_callbacks.append(callback)
    
    async def force_degradation(self, level: DegradationLevel, reason: str = "manual"):
        """Manually force system degradation to specified level"""
        logger.warning(f"Forcing degradation to {level.name}: {reason}")
        
        current_resources = await self._collect_system_resources()
        await self._apply_degradation(level, current_resources)
    
    async def force_recovery(self, reason: str = "manual"):
        """Manually force system recovery to normal operation"""
        logger.info(f"Forcing recovery to normal operation: {reason}")
        
        current_resources = await self._collect_system_resources()
        await self._attempt_recovery(DegradationLevel.NORMAL, current_resources)
    
    async def cleanup(self):
        """Cleanup graceful degradation manager resources"""
        await self.stop_monitoring()
        
        self.resource_history.clear()
        self.performance_history.clear()
        self.degradation_history.clear()
        self.degradation_callbacks.clear()
        self.recovery_callbacks.clear()
        
        logger.info("Graceful degradation manager cleanup completed")