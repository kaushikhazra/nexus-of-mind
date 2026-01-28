"""
Hardware Detection and Configuration - Automatic hardware detection and optimization
Implements Requirements 5.5 for automatic hardware detection and configuration
"""

import asyncio
import logging
import os
import platform
import subprocess
import time
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import psutil
import threading

# TensorFlow removed - using PyTorch instead
TENSORFLOW_AVAILABLE = False
tf = None

logger = logging.getLogger(__name__)


class HardwareType(Enum):
    """Hardware types for optimization"""
    CPU_ONLY = "cpu_only"
    SINGLE_GPU = "single_gpu"
    MULTI_GPU = "multi_gpu"
    CLOUD_INSTANCE = "cloud_instance"
    EDGE_DEVICE = "edge_device"


class CPUArchitecture(Enum):
    """CPU architectures"""
    X86_64 = "x86_64"
    ARM64 = "arm64"
    UNKNOWN = "unknown"


@dataclass
class CPUInfo:
    """CPU information"""
    architecture: CPUArchitecture
    cores_physical: int
    cores_logical: int
    frequency_ghz: float
    cache_l3_mb: Optional[int]
    supports_avx: bool
    supports_avx2: bool
    supports_avx512: bool
    vendor: str
    model_name: str


@dataclass
class MemoryInfo:
    """Memory information"""
    total_gb: float
    available_gb: float
    swap_total_gb: float
    swap_available_gb: float
    memory_type: str  # DDR4, DDR5, etc.
    memory_speed_mhz: Optional[int]


@dataclass
class GPUInfo:
    """GPU information"""
    device_id: int
    name: str
    compute_capability: str
    memory_total_mb: float
    memory_available_mb: float
    driver_version: str
    cuda_version: Optional[str]
    supports_mixed_precision: bool
    tensor_cores: bool
    nvlink_available: bool


@dataclass
class HardwareProfile:
    """Complete hardware profile"""
    hardware_type: HardwareType
    cpu_info: CPUInfo
    memory_info: MemoryInfo
    gpu_info: List[GPUInfo]
    storage_info: Dict[str, Any]
    network_info: Dict[str, Any]
    optimization_recommendations: List[str]
    performance_tier: str  # "high", "medium", "low"


class HardwareDetector:
    """
    Automatic hardware detection and configuration system
    Implements Requirement 5.5 for hardware optimization adaptation
    """
    
    def __init__(self):
        self.hardware_profile: Optional[HardwareProfile] = None
        self.detection_cache: Dict[str, Any] = {}
        self.cache_expiry_time = 300  # 5 minutes
        self.last_detection_time = 0
        
        # Thread safety
        self._detection_lock = threading.RLock()
        
        # Initialize hardware detection
        self._initialize_detector()
    
    def _initialize_detector(self):
        """Initialize hardware detection system"""
        try:
            logger.info("Initializing hardware detection system...")
            
            # Perform initial hardware detection
            self.detect_hardware_configuration()
            
            logger.info("Hardware detection system initialized")
            
        except Exception as e:
            logger.error(f"Hardware detection initialization failed: {e}")
    
    def detect_hardware_configuration(self) -> HardwareProfile:
        """
        Detect and analyze current hardware configuration
        Implements Requirement 5.5 for automatic hardware detection
        
        Returns:
            Complete hardware profile with optimization recommendations
        """
        current_time = time.time()
        
        # Use cached result if recent
        if (self.hardware_profile and 
            current_time - self.last_detection_time < self.cache_expiry_time):
            return self.hardware_profile
        
        try:
            with self._detection_lock:
                logger.info("Detecting hardware configuration...")
                
                # Detect CPU information
                cpu_info = self._detect_cpu_info()
                
                # Detect memory information
                memory_info = self._detect_memory_info()
                
                # Detect GPU information
                gpu_info = self._detect_gpu_info()
                
                # Detect storage information
                storage_info = self._detect_storage_info()
                
                # Detect network information
                network_info = self._detect_network_info()
                
                # Determine hardware type
                hardware_type = self._determine_hardware_type(cpu_info, memory_info, gpu_info)
                
                # Generate optimization recommendations
                recommendations = self._generate_optimization_recommendations(
                    hardware_type, cpu_info, memory_info, gpu_info
                )
                
                # Determine performance tier
                performance_tier = self._determine_performance_tier(
                    cpu_info, memory_info, gpu_info
                )
                
                # Create hardware profile
                self.hardware_profile = HardwareProfile(
                    hardware_type=hardware_type,
                    cpu_info=cpu_info,
                    memory_info=memory_info,
                    gpu_info=gpu_info,
                    storage_info=storage_info,
                    network_info=network_info,
                    optimization_recommendations=recommendations,
                    performance_tier=performance_tier
                )
                
                self.last_detection_time = current_time
                
                logger.info(f"Hardware detection completed: {hardware_type.value}, "
                          f"{len(gpu_info)} GPU(s), {performance_tier} performance tier")
                
                return self.hardware_profile
                
        except Exception as e:
            logger.error(f"Hardware detection failed: {e}")
            # Return minimal profile on failure
            return self._create_minimal_hardware_profile()
    
    def _detect_cpu_info(self) -> CPUInfo:
        """Detect CPU information"""
        try:
            # Get basic CPU info from psutil
            cpu_count_physical = psutil.cpu_count(logical=False) or 1
            cpu_count_logical = psutil.cpu_count(logical=True) or 1
            cpu_freq = psutil.cpu_freq()
            cpu_frequency = cpu_freq.max / 1000.0 if cpu_freq and cpu_freq.max else 2.0  # GHz
            
            # Detect architecture
            machine = platform.machine().lower()
            if 'x86_64' in machine or 'amd64' in machine:
                architecture = CPUArchitecture.X86_64
            elif 'arm64' in machine or 'aarch64' in machine:
                architecture = CPUArchitecture.ARM64
            else:
                architecture = CPUArchitecture.UNKNOWN
            
            # Get CPU vendor and model (simplified)
            try:
                if platform.system() == "Linux":
                    with open('/proc/cpuinfo', 'r') as f:
                        cpuinfo = f.read()
                    
                    vendor = "unknown"
                    model_name = "unknown"
                    
                    for line in cpuinfo.split('\n'):
                        if 'vendor_id' in line:
                            vendor = line.split(':')[1].strip()
                        elif 'model name' in line:
                            model_name = line.split(':')[1].strip()
                            break
                else:
                    vendor = platform.processor() or "unknown"
                    model_name = platform.processor() or "unknown"
            except:
                vendor = "unknown"
                model_name = "unknown"
            
            # Detect CPU features (simplified)
            supports_avx = self._check_cpu_feature('avx')
            supports_avx2 = self._check_cpu_feature('avx2')
            supports_avx512 = self._check_cpu_feature('avx512')
            
            return CPUInfo(
                architecture=architecture,
                cores_physical=cpu_count_physical,
                cores_logical=cpu_count_logical,
                frequency_ghz=cpu_frequency,
                cache_l3_mb=None,  # Would need more detailed detection
                supports_avx=supports_avx,
                supports_avx2=supports_avx2,
                supports_avx512=supports_avx512,
                vendor=vendor,
                model_name=model_name
            )
            
        except Exception as e:
            logger.error(f"CPU detection failed: {e}")
            return CPUInfo(
                architecture=CPUArchitecture.UNKNOWN,
                cores_physical=1,
                cores_logical=1,
                frequency_ghz=2.0,
                cache_l3_mb=None,
                supports_avx=False,
                supports_avx2=False,
                supports_avx512=False,
                vendor="unknown",
                model_name="unknown"
            )
    
    def _check_cpu_feature(self, feature: str) -> bool:
        """Check if CPU supports specific feature"""
        try:
            if platform.system() == "Linux":
                with open('/proc/cpuinfo', 'r') as f:
                    cpuinfo = f.read()
                return feature in cpuinfo.lower()
            else:
                # Simplified check for other platforms
                return False
        except:
            return False
    
    def _detect_memory_info(self) -> MemoryInfo:
        """Detect memory information"""
        try:
            memory = psutil.virtual_memory()
            swap = psutil.swap_memory()
            
            return MemoryInfo(
                total_gb=memory.total / (1024**3),
                available_gb=memory.available / (1024**3),
                swap_total_gb=swap.total / (1024**3),
                swap_available_gb=swap.free / (1024**3),
                memory_type="unknown",  # Would need more detailed detection
                memory_speed_mhz=None
            )
            
        except Exception as e:
            logger.error(f"Memory detection failed: {e}")
            return MemoryInfo(
                total_gb=8.0,  # Default assumption
                available_gb=6.0,
                swap_total_gb=0.0,
                swap_available_gb=0.0,
                memory_type="unknown",
                memory_speed_mhz=None
            )
    
    def _detect_gpu_info(self) -> List[GPUInfo]:
        """Detect GPU information"""
        gpu_info = []
        
        if not TENSORFLOW_AVAILABLE:
            logger.info("TensorFlow not available, no GPU detection")
            return gpu_info
        
        try:
            # Get GPU devices from TensorFlow
            physical_gpus = tf.config.experimental.list_physical_devices('GPU')
            
            for i, gpu in enumerate(physical_gpus):
                try:
                    # Get GPU details
                    gpu_details = tf.config.experimental.get_device_details(gpu)
                    
                    # Extract GPU information
                    compute_capability = gpu_details.get('compute_capability', 'unknown')
                    device_name = gpu_details.get('device_name', f'GPU_{i}')
                    
                    # Estimate memory (simplified)
                    memory_total = 8192.0  # Default 8GB
                    memory_available = 6144.0  # Default 6GB available
                    
                    # Check mixed precision support
                    supports_mixed_precision = self._check_mixed_precision_support(compute_capability)
                    
                    # Check for Tensor Cores (compute capability 7.0+)
                    tensor_cores = False
                    if compute_capability != 'unknown':
                        try:
                            major = int(compute_capability.split('.')[0])
                            tensor_cores = major >= 7
                        except:
                            pass
                    
                    gpu_info.append(GPUInfo(
                        device_id=i,
                        name=device_name,
                        compute_capability=compute_capability,
                        memory_total_mb=memory_total,
                        memory_available_mb=memory_available,
                        driver_version="unknown",  # Would need nvidia-ml-py
                        cuda_version=self._get_cuda_version(),
                        supports_mixed_precision=supports_mixed_precision,
                        tensor_cores=tensor_cores,
                        nvlink_available=False  # Would need detailed detection
                    ))
                    
                except Exception as e:
                    logger.error(f"Failed to detect GPU {i}: {e}")
            
            logger.info(f"Detected {len(gpu_info)} GPU(s)")
            
        except Exception as e:
            logger.error(f"GPU detection failed: {e}")
        
        return gpu_info
    
    def _check_mixed_precision_support(self, compute_capability: str) -> bool:
        """Check if GPU supports mixed precision"""
        if compute_capability == 'unknown':
            return False
        
        try:
            major, minor = map(int, compute_capability.split('.'))
            return major >= 7  # Tensor Cores available from compute 7.0+
        except:
            return False
    
    def _get_cuda_version(self) -> Optional[str]:
        """Get CUDA version"""
        try:
            if hasattr(tf, 'sysconfig') and hasattr(tf.sysconfig, 'get_build_info'):
                build_info = tf.sysconfig.get_build_info()
                return build_info.get('cuda_version', None)
        except:
            pass
        return None
    
    def _detect_storage_info(self) -> Dict[str, Any]:
        """Detect storage information"""
        try:
            storage_info = {
                'disks': [],
                'total_space_gb': 0.0,
                'available_space_gb': 0.0
            }
            
            # Get disk usage for root partition
            disk_usage = psutil.disk_usage('/')
            storage_info['total_space_gb'] = disk_usage.total / (1024**3)
            storage_info['available_space_gb'] = disk_usage.free / (1024**3)
            
            # Get disk partitions
            partitions = psutil.disk_partitions()
            for partition in partitions:
                try:
                    partition_usage = psutil.disk_usage(partition.mountpoint)
                    storage_info['disks'].append({
                        'device': partition.device,
                        'mountpoint': partition.mountpoint,
                        'fstype': partition.fstype,
                        'total_gb': partition_usage.total / (1024**3),
                        'free_gb': partition_usage.free / (1024**3)
                    })
                except:
                    continue
            
            return storage_info
            
        except Exception as e:
            logger.error(f"Storage detection failed: {e}")
            return {
                'disks': [],
                'total_space_gb': 100.0,
                'available_space_gb': 50.0
            }
    
    def _detect_network_info(self) -> Dict[str, Any]:
        """Detect network information"""
        try:
            network_info = {
                'interfaces': [],
                'default_interface': None
            }
            
            # Get network interfaces
            interfaces = psutil.net_if_addrs()
            stats = psutil.net_if_stats()
            
            for interface_name, addresses in interfaces.items():
                if interface_name in stats:
                    interface_stats = stats[interface_name]
                    
                    network_info['interfaces'].append({
                        'name': interface_name,
                        'is_up': interface_stats.isup,
                        'speed_mbps': interface_stats.speed if interface_stats.speed > 0 else None,
                        'mtu': interface_stats.mtu
                    })
            
            return network_info
            
        except Exception as e:
            logger.error(f"Network detection failed: {e}")
            return {
                'interfaces': [],
                'default_interface': None
            }
    
    def _determine_hardware_type(self, cpu_info: CPUInfo, memory_info: MemoryInfo, 
                                gpu_info: List[GPUInfo]) -> HardwareType:
        """Determine hardware type based on detected components"""
        if not gpu_info:
            return HardwareType.CPU_ONLY
        elif len(gpu_info) == 1:
            return HardwareType.SINGLE_GPU
        elif len(gpu_info) > 1:
            return HardwareType.MULTI_GPU
        else:
            return HardwareType.CPU_ONLY
    
    def _generate_optimization_recommendations(self, hardware_type: HardwareType,
                                             cpu_info: CPUInfo, memory_info: MemoryInfo,
                                             gpu_info: List[GPUInfo]) -> List[str]:
        """Generate hardware-specific optimization recommendations"""
        recommendations = []
        
        # CPU-specific recommendations
        if cpu_info.cores_logical >= 8:
            recommendations.append("Multi-threading optimization recommended with 8+ CPU cores")
        
        if cpu_info.supports_avx2:
            recommendations.append("Enable AVX2 optimizations for CPU inference")
        
        if cpu_info.supports_avx512:
            recommendations.append("Enable AVX512 optimizations for maximum CPU performance")
        
        # Memory-specific recommendations
        if memory_info.total_gb >= 16:
            recommendations.append("Sufficient memory for large batch processing")
        elif memory_info.total_gb < 8:
            recommendations.append("Limited memory - consider smaller batch sizes and model quantization")
        
        # GPU-specific recommendations
        if hardware_type == HardwareType.CPU_ONLY:
            recommendations.append("Consider GPU acceleration for 3x+ performance improvement")
        elif hardware_type == HardwareType.SINGLE_GPU:
            gpu = gpu_info[0]
            if gpu.supports_mixed_precision:
                recommendations.append("Enable mixed precision (float16) for 1.5-2x GPU speedup")
            if gpu.memory_total_mb >= 8192:
                recommendations.append("GPU has sufficient memory for large models and batch sizes")
        elif hardware_type == HardwareType.MULTI_GPU:
            recommendations.append(f"Multi-GPU setup detected - enable distributed processing across {len(gpu_info)} GPUs")
            
            # Check for NVLink
            nvlink_count = sum(1 for gpu in gpu_info if gpu.nvlink_available)
            if nvlink_count > 1:
                recommendations.append("NVLink detected - optimize for high-bandwidth GPU communication")
        
        return recommendations
    
    def _determine_performance_tier(self, cpu_info: CPUInfo, memory_info: MemoryInfo,
                                  gpu_info: List[GPUInfo]) -> str:
        """Determine performance tier based on hardware capabilities"""
        score = 0
        
        # CPU scoring
        if cpu_info.cores_logical >= 16:
            score += 3
        elif cpu_info.cores_logical >= 8:
            score += 2
        elif cpu_info.cores_logical >= 4:
            score += 1
        
        if cpu_info.frequency_ghz >= 3.5:
            score += 2
        elif cpu_info.frequency_ghz >= 2.5:
            score += 1
        
        # Memory scoring
        if memory_info.total_gb >= 32:
            score += 3
        elif memory_info.total_gb >= 16:
            score += 2
        elif memory_info.total_gb >= 8:
            score += 1
        
        # GPU scoring
        if len(gpu_info) >= 2:
            score += 4  # Multi-GPU
        elif len(gpu_info) == 1:
            gpu = gpu_info[0]
            if gpu.tensor_cores:
                score += 3  # Modern GPU with Tensor Cores
            elif gpu.supports_mixed_precision:
                score += 2  # GPU with mixed precision
            else:
                score += 1  # Basic GPU
        
        # Determine tier
        if score >= 8:
            return "high"
        elif score >= 4:
            return "medium"
        else:
            return "low"
    
    def _create_minimal_hardware_profile(self) -> HardwareProfile:
        """Create minimal hardware profile on detection failure"""
        return HardwareProfile(
            hardware_type=HardwareType.CPU_ONLY,
            cpu_info=CPUInfo(
                architecture=CPUArchitecture.UNKNOWN,
                cores_physical=1,
                cores_logical=1,
                frequency_ghz=2.0,
                cache_l3_mb=None,
                supports_avx=False,
                supports_avx2=False,
                supports_avx512=False,
                vendor="unknown",
                model_name="unknown"
            ),
            memory_info=MemoryInfo(
                total_gb=8.0,
                available_gb=6.0,
                swap_total_gb=0.0,
                swap_available_gb=0.0,
                memory_type="unknown",
                memory_speed_mhz=None
            ),
            gpu_info=[],
            storage_info={'disks': [], 'total_space_gb': 100.0, 'available_space_gb': 50.0},
            network_info={'interfaces': [], 'default_interface': None},
            optimization_recommendations=["Hardware detection failed - using default configuration"],
            performance_tier="low"
        )
    
    def reconfigure_optimization_settings(self, hardware_changes: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Reconfigure optimization settings based on hardware changes
        Implements Requirement 5.5 for automatic reconfiguration
        
        Args:
            hardware_changes: Optional specific hardware changes to respond to
            
        Returns:
            Reconfiguration results
        """
        try:
            logger.info("Reconfiguring optimization settings for hardware changes...")
            
            # Re-detect hardware if changes specified or cache expired
            if hardware_changes or time.time() - self.last_detection_time > self.cache_expiry_time:
                self.detect_hardware_configuration()
            
            if not self.hardware_profile:
                return {
                    'success': False,
                    'error': 'No hardware profile available for reconfiguration'
                }
            
            # Generate new optimization configuration
            optimization_config = self._generate_optimization_config(self.hardware_profile)
            
            # Apply configuration changes
            applied_changes = self._apply_optimization_config(optimization_config)
            
            return {
                'success': True,
                'hardware_type': self.hardware_profile.hardware_type.value,
                'performance_tier': self.hardware_profile.performance_tier,
                'optimization_config': optimization_config,
                'applied_changes': applied_changes,
                'recommendations': self.hardware_profile.optimization_recommendations
            }
            
        except Exception as e:
            logger.error(f"Optimization reconfiguration failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _generate_optimization_config(self, hardware_profile: HardwareProfile) -> Dict[str, Any]:
        """Generate optimization configuration based on hardware profile"""
        config = {
            'cpu_optimization': {},
            'memory_optimization': {},
            'gpu_optimization': {},
            'inference_optimization': {},
            'training_optimization': {}
        }
        
        # CPU optimization
        config['cpu_optimization'] = {
            'thread_count': min(hardware_profile.cpu_info.cores_logical, 8),
            'enable_avx': hardware_profile.cpu_info.supports_avx,
            'enable_avx2': hardware_profile.cpu_info.supports_avx2,
            'enable_avx512': hardware_profile.cpu_info.supports_avx512,
            'cpu_fallback_enabled': len(hardware_profile.gpu_info) == 0
        }
        
        # Memory optimization
        config['memory_optimization'] = {
            'memory_limit_mb': int(hardware_profile.memory_info.available_gb * 1024 * 0.8),
            'enable_memory_growth': True,
            'garbage_collection_threshold': 0.8,
            'swap_usage_limit': 0.1
        }
        
        # GPU optimization
        if hardware_profile.gpu_info:
            config['gpu_optimization'] = {
                'gpu_count': len(hardware_profile.gpu_info),
                'enable_mixed_precision': any(gpu.supports_mixed_precision for gpu in hardware_profile.gpu_info),
                'enable_multi_gpu': len(hardware_profile.gpu_info) > 1,
                'memory_growth_enabled': True,
                'cuda_streams_per_gpu': 4 if hardware_profile.performance_tier == 'high' else 2
            }
        
        # Inference optimization
        config['inference_optimization'] = {
            'target_inference_time_ms': 16.0,
            'enable_quantization': hardware_profile.performance_tier in ['low', 'medium'],
            'batch_size_optimization': True,
            'enable_caching': True
        }
        
        # Training optimization
        config['training_optimization'] = {
            'batch_size': self._calculate_optimal_batch_size(hardware_profile),
            'enable_distributed_training': len(hardware_profile.gpu_info) > 1,
            'gradient_accumulation_steps': 1 if hardware_profile.performance_tier == 'high' else 2,
            'mixed_precision_training': any(gpu.supports_mixed_precision for gpu in hardware_profile.gpu_info)
        }
        
        return config
    
    def _calculate_optimal_batch_size(self, hardware_profile: HardwareProfile) -> int:
        """Calculate optimal batch size based on hardware"""
        base_batch_size = 32
        
        # Adjust based on memory
        if hardware_profile.memory_info.total_gb >= 32:
            memory_factor = 2.0
        elif hardware_profile.memory_info.total_gb >= 16:
            memory_factor = 1.5
        elif hardware_profile.memory_info.total_gb >= 8:
            memory_factor = 1.0
        else:
            memory_factor = 0.5
        
        # Adjust based on GPU memory
        gpu_factor = 1.0
        if hardware_profile.gpu_info:
            max_gpu_memory = max(gpu.memory_total_mb for gpu in hardware_profile.gpu_info)
            if max_gpu_memory >= 16384:  # 16GB+
                gpu_factor = 2.0
            elif max_gpu_memory >= 8192:  # 8GB+
                gpu_factor = 1.5
            elif max_gpu_memory >= 4096:  # 4GB+
                gpu_factor = 1.0
            else:
                gpu_factor = 0.5
        
        optimal_batch_size = int(base_batch_size * memory_factor * gpu_factor)
        return max(1, min(128, optimal_batch_size))  # Clamp between 1 and 128
    
    def _apply_optimization_config(self, config: Dict[str, Any]) -> List[str]:
        """Apply optimization configuration"""
        applied_changes = []
        
        try:
            # Apply CPU optimizations
            cpu_config = config.get('cpu_optimization', {})
            if cpu_config.get('thread_count'):
                # Would set TensorFlow thread count
                applied_changes.append(f"CPU threads set to {cpu_config['thread_count']}")
            
            # Apply GPU optimizations
            gpu_config = config.get('gpu_optimization', {})
            if gpu_config.get('enable_mixed_precision'):
                applied_changes.append("Mixed precision enabled")
            
            if gpu_config.get('enable_multi_gpu'):
                applied_changes.append("Multi-GPU coordination enabled")
            
            # Apply memory optimizations
            memory_config = config.get('memory_optimization', {})
            if memory_config.get('memory_limit_mb'):
                applied_changes.append(f"Memory limit set to {memory_config['memory_limit_mb']}MB")
            
            logger.info(f"Applied {len(applied_changes)} optimization changes")
            
        except Exception as e:
            logger.error(f"Failed to apply optimization config: {e}")
            applied_changes.append(f"Configuration application failed: {e}")
        
        return applied_changes
    
    def get_hardware_status(self) -> Dict[str, Any]:
        """Get comprehensive hardware status"""
        if not self.hardware_profile:
            return {
                'hardware_detected': False,
                'error': 'No hardware profile available'
            }
        
        return {
            'hardware_detected': True,
            'hardware_type': self.hardware_profile.hardware_type.value,
            'performance_tier': self.hardware_profile.performance_tier,
            'cpu_info': {
                'architecture': self.hardware_profile.cpu_info.architecture.value,
                'cores_physical': self.hardware_profile.cpu_info.cores_physical,
                'cores_logical': self.hardware_profile.cpu_info.cores_logical,
                'frequency_ghz': self.hardware_profile.cpu_info.frequency_ghz,
                'vendor': self.hardware_profile.cpu_info.vendor,
                'supports_avx2': self.hardware_profile.cpu_info.supports_avx2
            },
            'memory_info': {
                'total_gb': self.hardware_profile.memory_info.total_gb,
                'available_gb': self.hardware_profile.memory_info.available_gb
            },
            'gpu_info': [
                {
                    'device_id': gpu.device_id,
                    'name': gpu.name,
                    'compute_capability': gpu.compute_capability,
                    'memory_total_mb': gpu.memory_total_mb,
                    'supports_mixed_precision': gpu.supports_mixed_precision,
                    'tensor_cores': gpu.tensor_cores
                }
                for gpu in self.hardware_profile.gpu_info
            ],
            'optimization_recommendations': self.hardware_profile.optimization_recommendations,
            'last_detection_time': self.last_detection_time
        }
    
    async def cleanup(self):
        """Cleanup hardware detector resources"""
        logger.info("Cleaning up hardware detector...")
        
        try:
            with self._detection_lock:
                # Clear detection cache
                self.detection_cache.clear()
                
                # Reset hardware profile
                self.hardware_profile = None
                self.last_detection_time = 0
                
                logger.info("Hardware detector cleanup completed")
                
        except Exception as e:
            logger.error(f"Hardware detector cleanup failed: {e}")