"""
Production Deployment System - Automatic model configuration, load balancing, and auto-scaling
Implements Requirements 7.1, 7.2, 7.3, 7.4, 7.5 for production deployment optimization
"""

import asyncio
import logging
import time
import json
import hashlib
from typing import Dict, Any, List, Optional, Callable, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from collections import defaultdict, deque
from enum import Enum
import threading
import os
from pathlib import Path

logger = logging.getLogger(__name__)


class DeploymentEnvironment(Enum):
    """Deployment environment types"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class LoadBalancingStrategy(Enum):
    """Load balancing strategies"""
    ROUND_ROBIN = "round_robin"
    LEAST_CONNECTIONS = "least_connections"
    WEIGHTED_ROUND_ROBIN = "weighted_round_robin"
    PERFORMANCE_BASED = "performance_based"


class ScalingDirection(Enum):
    """Auto-scaling directions"""
    SCALE_UP = "scale_up"
    SCALE_DOWN = "scale_down"
    MAINTAIN = "maintain"


@dataclass
class ModelConfiguration:
    """Model configuration for deployment"""
    config_id: str
    name: str
    description: str
    quantization_enabled: bool
    gpu_acceleration: bool
    batch_size: int
    memory_limit_mb: int
    target_inference_time_ms: float
    target_throughput_per_sec: float
    hardware_requirements: Dict[str, Any]
    optimization_level: str  # 'conservative', 'balanced', 'aggressive'
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    def get_config_hash(self) -> str:
        """Generate hash for configuration comparison"""
        config_str = json.dumps(self.to_dict(), sort_keys=True)
        return hashlib.md5(config_str.encode()).hexdigest()[:8]


@dataclass
class DeploymentNode:
    """Individual deployment node information"""
    node_id: str
    host: str
    port: int
    status: str  # 'active', 'inactive', 'updating', 'failed'
    current_connections: int
    max_connections: int
    current_load_percent: float
    last_health_check: float
    model_config: Optional[ModelConfiguration]
    performance_metrics: Dict[str, float]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'node_id': self.node_id,
            'host': self.host,
            'port': self.port,
            'status': self.status,
            'current_connections': self.current_connections,
            'max_connections': self.max_connections,
            'current_load_percent': self.current_load_percent,
            'last_health_check': self.last_health_check,
            'model_config': self.model_config.to_dict() if self.model_config else None,
            'performance_metrics': self.performance_metrics
        }


@dataclass
class ScalingMetrics:
    """Metrics for auto-scaling decisions"""
    timestamp: float
    total_requests_per_minute: float
    average_response_time_ms: float
    active_connections: int
    cpu_utilization_percent: float
    memory_utilization_percent: float
    error_rate_percent: float
    target_compliance_rate: float
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ModelConfigurationSelector:
    """Automatic optimal model configuration selection for production"""
    
    def __init__(self):
        self.predefined_configs = self._create_predefined_configurations()
        self.environment_profiles = self._create_environment_profiles()
        
    def _create_predefined_configurations(self) -> Dict[str, ModelConfiguration]:
        """Create predefined model configurations for different scenarios"""
        configs = {}
        
        # High-performance configuration
        configs['high_performance'] = ModelConfiguration(
            config_id='high_perf_001',
            name='High Performance',
            description='Maximum performance with GPU acceleration and aggressive optimization',
            quantization_enabled=True,
            gpu_acceleration=True,
            batch_size=32,
            memory_limit_mb=400,
            target_inference_time_ms=8.0,
            target_throughput_per_sec=200.0,
            hardware_requirements={
                'min_gpu_memory_gb': 4.0,
                'min_cpu_cores': 4,
                'min_ram_gb': 8.0
            },
            optimization_level='aggressive'
        )
        
        # Balanced configuration
        configs['balanced'] = ModelConfiguration(
            config_id='balanced_001',
            name='Balanced Performance',
            description='Balanced performance and resource usage',
            quantization_enabled=True,
            gpu_acceleration=True,
            batch_size=16,
            memory_limit_mb=200,
            target_inference_time_ms=16.0,
            target_throughput_per_sec=100.0,
            hardware_requirements={
                'min_gpu_memory_gb': 2.0,
                'min_cpu_cores': 2,
                'min_ram_gb': 4.0
            },
            optimization_level='balanced'
        )
        
        # Resource-constrained configuration
        configs['resource_constrained'] = ModelConfiguration(
            config_id='constrained_001',
            name='Resource Constrained',
            description='Optimized for limited hardware resources',
            quantization_enabled=True,
            gpu_acceleration=False,
            batch_size=8,
            memory_limit_mb=100,
            target_inference_time_ms=32.0,
            target_throughput_per_sec=50.0,
            hardware_requirements={
                'min_gpu_memory_gb': 0.0,
                'min_cpu_cores': 1,
                'min_ram_gb': 2.0
            },
            optimization_level='conservative'
        )
        
        # Development configuration
        configs['development'] = ModelConfiguration(
            config_id='dev_001',
            name='Development',
            description='Development environment with debugging features',
            quantization_enabled=False,
            gpu_acceleration=False,
            batch_size=4,
            memory_limit_mb=150,
            target_inference_time_ms=50.0,
            target_throughput_per_sec=20.0,
            hardware_requirements={
                'min_gpu_memory_gb': 0.0,
                'min_cpu_cores': 1,
                'min_ram_gb': 2.0
            },
            optimization_level='conservative'
        )
        
        return configs
    
    def _create_environment_profiles(self) -> Dict[DeploymentEnvironment, Dict[str, Any]]:
        """Create environment-specific profiles"""
        return {
            DeploymentEnvironment.DEVELOPMENT: {
                'preferred_configs': ['development', 'balanced'],
                'performance_priority': 'low',
                'resource_constraints': 'flexible',
                'monitoring_level': 'detailed'
            },
            DeploymentEnvironment.STAGING: {
                'preferred_configs': ['balanced', 'high_performance'],
                'performance_priority': 'medium',
                'resource_constraints': 'moderate',
                'monitoring_level': 'standard'
            },
            DeploymentEnvironment.PRODUCTION: {
                'preferred_configs': ['high_performance', 'balanced'],
                'performance_priority': 'high',
                'resource_constraints': 'strict',
                'monitoring_level': 'comprehensive'
            },
            DeploymentEnvironment.TESTING: {
                'preferred_configs': ['resource_constrained', 'balanced'],
                'performance_priority': 'low',
                'resource_constraints': 'strict',
                'monitoring_level': 'minimal'
            }
        }
    
    def select_optimal_configuration(self, 
                                   environment: DeploymentEnvironment,
                                   hardware_profile: Dict[str, Any],
                                   performance_requirements: Dict[str, float],
                                   current_load_metrics: Optional[Dict[str, float]] = None) -> ModelConfiguration:
        """
        Select optimal model configuration for deployment environment
        
        Args:
            environment: Target deployment environment
            hardware_profile: Available hardware resources
            performance_requirements: Required performance targets
            current_load_metrics: Current system load metrics
            
        Returns:
            Optimal ModelConfiguration for the environment
        """
        try:
            env_profile = self.environment_profiles[environment]
            preferred_configs = env_profile['preferred_configs']
            
            # Score each configuration
            config_scores = {}
            for config_name in preferred_configs:
                if config_name in self.predefined_configs:
                    config = self.predefined_configs[config_name]
                    score = self._score_configuration(
                        config, hardware_profile, performance_requirements, 
                        current_load_metrics, env_profile
                    )
                    config_scores[config_name] = score
            
            # Select highest scoring configuration
            if config_scores:
                best_config_name = max(config_scores.keys(), key=lambda k: config_scores[k])
                selected_config = self.predefined_configs[best_config_name]
                
                # Customize configuration based on specific requirements
                customized_config = self._customize_configuration(
                    selected_config, hardware_profile, performance_requirements
                )
                
                logger.info(f"Selected optimal configuration: {best_config_name} "
                           f"(score: {config_scores[best_config_name]:.2f})")
                
                return customized_config
            else:
                # Fallback to balanced configuration
                logger.warning("No suitable configuration found, using balanced fallback")
                return self.predefined_configs['balanced']
                
        except Exception as e:
            logger.error(f"Failed to select optimal configuration: {e}")
            return self.predefined_configs['balanced']  # Safe fallback
    
    def _score_configuration(self, config: ModelConfiguration,
                           hardware_profile: Dict[str, Any],
                           performance_requirements: Dict[str, float],
                           current_load_metrics: Optional[Dict[str, float]],
                           env_profile: Dict[str, Any]) -> float:
        """Score a configuration based on suitability for the environment"""
        score = 0.0
        
        # Hardware compatibility score (0-30 points)
        hw_score = self._score_hardware_compatibility(config, hardware_profile)
        score += hw_score
        
        # Performance requirements score (0-40 points)
        perf_score = self._score_performance_requirements(config, performance_requirements)
        score += perf_score
        
        # Resource efficiency score (0-20 points)
        resource_score = self._score_resource_efficiency(config, hardware_profile)
        score += resource_score
        
        # Load handling score (0-10 points)
        if current_load_metrics:
            load_score = self._score_load_handling(config, current_load_metrics)
            score += load_score
        
        return score
    
    def _score_hardware_compatibility(self, config: ModelConfiguration,
                                    hardware_profile: Dict[str, Any]) -> float:
        """Score hardware compatibility (0-30 points)"""
        score = 0.0
        
        # GPU requirements
        if config.gpu_acceleration:
            if hardware_profile.get('gpu_available', False):
                gpu_memory = hardware_profile.get('gpu_memory_gb', 0)
                required_gpu_memory = config.hardware_requirements.get('min_gpu_memory_gb', 0)
                if gpu_memory >= required_gpu_memory:
                    score += 15.0
                else:
                    score += max(0, 15.0 * (gpu_memory / required_gpu_memory))
            else:
                score -= 10.0  # Penalty for missing GPU
        else:
            score += 10.0  # Bonus for not requiring GPU
        
        # CPU requirements
        cpu_cores = hardware_profile.get('cpu_cores', 1)
        required_cpu_cores = config.hardware_requirements.get('min_cpu_cores', 1)
        if cpu_cores >= required_cpu_cores:
            score += 10.0
        else:
            score += max(0, 10.0 * (cpu_cores / required_cpu_cores))
        
        # Memory requirements
        ram_gb = hardware_profile.get('memory_gb', 1)
        required_ram_gb = config.hardware_requirements.get('min_ram_gb', 1)
        if ram_gb >= required_ram_gb:
            score += 5.0
        else:
            score += max(0, 5.0 * (ram_gb / required_ram_gb))
        
        return score
    
    def _score_performance_requirements(self, config: ModelConfiguration,
                                      performance_requirements: Dict[str, float]) -> float:
        """Score performance requirements match (0-40 points)"""
        score = 0.0
        
        # Inference time requirements
        required_inference_time = performance_requirements.get('max_inference_time_ms', 50.0)
        if config.target_inference_time_ms <= required_inference_time:
            score += 20.0
        else:
            # Penalty for exceeding requirements
            ratio = required_inference_time / config.target_inference_time_ms
            score += max(0, 20.0 * ratio)
        
        # Throughput requirements
        required_throughput = performance_requirements.get('min_throughput_per_sec', 10.0)
        if config.target_throughput_per_sec >= required_throughput:
            score += 20.0
        else:
            # Penalty for not meeting throughput
            ratio = config.target_throughput_per_sec / required_throughput
            score += max(0, 20.0 * ratio)
        
        return score
    
    def _score_resource_efficiency(self, config: ModelConfiguration,
                                 hardware_profile: Dict[str, Any]) -> float:
        """Score resource efficiency (0-20 points)"""
        score = 0.0
        
        # Memory efficiency
        available_memory = hardware_profile.get('memory_gb', 4.0) * 1024  # Convert to MB
        memory_usage_ratio = config.memory_limit_mb / available_memory
        
        if memory_usage_ratio <= 0.5:  # Using less than 50% of available memory
            score += 10.0
        elif memory_usage_ratio <= 0.8:  # Using 50-80% of available memory
            score += 7.0
        else:  # Using more than 80% of available memory
            score += max(0, 5.0 * (1.0 - memory_usage_ratio))
        
        # Optimization level efficiency
        optimization_scores = {
            'conservative': 5.0,
            'balanced': 8.0,
            'aggressive': 10.0
        }
        score += optimization_scores.get(config.optimization_level, 5.0)
        
        return score
    
    def _score_load_handling(self, config: ModelConfiguration,
                           current_load_metrics: Dict[str, float]) -> float:
        """Score load handling capability (0-10 points)"""
        score = 0.0
        
        current_load = current_load_metrics.get('requests_per_minute', 0)
        config_capacity = config.target_throughput_per_sec * 60  # Convert to per minute
        
        if config_capacity >= current_load * 1.5:  # 50% headroom
            score += 10.0
        elif config_capacity >= current_load:  # Meets current load
            score += 7.0
        else:  # Cannot handle current load
            score += max(0, 5.0 * (config_capacity / current_load))
        
        return score
    
    def _customize_configuration(self, base_config: ModelConfiguration,
                               hardware_profile: Dict[str, Any],
                               performance_requirements: Dict[str, float]) -> ModelConfiguration:
        """Customize configuration based on specific requirements"""
        # Create a copy of the base configuration
        customized = ModelConfiguration(
            config_id=f"{base_config.config_id}_custom_{int(time.time())}",
            name=f"{base_config.name} (Customized)",
            description=f"{base_config.description} - Customized for deployment",
            quantization_enabled=base_config.quantization_enabled,
            gpu_acceleration=base_config.gpu_acceleration,
            batch_size=base_config.batch_size,
            memory_limit_mb=base_config.memory_limit_mb,
            target_inference_time_ms=base_config.target_inference_time_ms,
            target_throughput_per_sec=base_config.target_throughput_per_sec,
            hardware_requirements=base_config.hardware_requirements.copy(),
            optimization_level=base_config.optimization_level
        )
        
        # Adjust batch size based on available memory
        available_memory_mb = hardware_profile.get('memory_gb', 4.0) * 1024
        if available_memory_mb > 8192:  # More than 8GB
            customized.batch_size = min(64, customized.batch_size * 2)
        elif available_memory_mb < 2048:  # Less than 2GB
            customized.batch_size = max(1, customized.batch_size // 2)
        
        # Adjust targets based on performance requirements
        required_inference_time = performance_requirements.get('max_inference_time_ms')
        if required_inference_time and required_inference_time < customized.target_inference_time_ms:
            customized.target_inference_time_ms = required_inference_time
        
        required_throughput = performance_requirements.get('min_throughput_per_sec')
        if required_throughput and required_throughput > customized.target_throughput_per_sec:
            customized.target_throughput_per_sec = required_throughput
        
        return customized


class LoadBalancer:
    """Load balancing system for distributed neural network requests"""
    
    def __init__(self, strategy: LoadBalancingStrategy = LoadBalancingStrategy.PERFORMANCE_BASED):
        self.strategy = strategy
        self.nodes: Dict[str, DeploymentNode] = {}
        self.request_counter = 0
        self.performance_history = defaultdict(list)
        self.health_check_interval = 30.0  # seconds
        self.last_health_check = 0.0
        
    def add_node(self, node: DeploymentNode):
        """Add a deployment node to the load balancer"""
        self.nodes[node.node_id] = node
        logger.info(f"Added node {node.node_id} to load balancer")
    
    def remove_node(self, node_id: str):
        """Remove a deployment node from the load balancer"""
        if node_id in self.nodes:
            del self.nodes[node_id]
            logger.info(f"Removed node {node_id} from load balancer")
    
    def select_node(self, request_metadata: Optional[Dict[str, Any]] = None) -> Optional[DeploymentNode]:
        """
        Select optimal node for request based on load balancing strategy
        
        Args:
            request_metadata: Optional metadata about the request
            
        Returns:
            Selected DeploymentNode or None if no nodes available
        """
        active_nodes = [node for node in self.nodes.values() if node.status == 'active']
        
        if not active_nodes:
            return None
        
        if self.strategy == LoadBalancingStrategy.ROUND_ROBIN:
            return self._select_round_robin(active_nodes)
        elif self.strategy == LoadBalancingStrategy.LEAST_CONNECTIONS:
            return self._select_least_connections(active_nodes)
        elif self.strategy == LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
            return self._select_weighted_round_robin(active_nodes)
        elif self.strategy == LoadBalancingStrategy.PERFORMANCE_BASED:
            return self._select_performance_based(active_nodes, request_metadata)
        else:
            return active_nodes[0]  # Fallback
    
    def _select_round_robin(self, nodes: List[DeploymentNode]) -> DeploymentNode:
        """Round-robin selection"""
        self.request_counter += 1
        return nodes[self.request_counter % len(nodes)]
    
    def _select_least_connections(self, nodes: List[DeploymentNode]) -> DeploymentNode:
        """Select node with least connections"""
        return min(nodes, key=lambda n: n.current_connections)
    
    def _select_weighted_round_robin(self, nodes: List[DeploymentNode]) -> DeploymentNode:
        """Weighted round-robin based on node capacity"""
        # Calculate weights based on max connections
        total_capacity = sum(node.max_connections for node in nodes)
        
        if total_capacity == 0:
            return self._select_round_robin(nodes)
        
        # Use request counter to distribute based on weights
        self.request_counter += 1
        position = self.request_counter % total_capacity
        
        current_position = 0
        for node in nodes:
            current_position += node.max_connections
            if position < current_position:
                return node
        
        return nodes[-1]  # Fallback
    
    def _select_performance_based(self, nodes: List[DeploymentNode], 
                                request_metadata: Optional[Dict[str, Any]]) -> DeploymentNode:
        """Select node based on performance metrics"""
        # Score nodes based on multiple factors
        node_scores = {}
        
        for node in nodes:
            score = 0.0
            
            # Load factor (lower is better)
            load_factor = node.current_load_percent / 100.0
            score += (1.0 - load_factor) * 40.0
            
            # Connection availability
            connection_availability = (node.max_connections - node.current_connections) / max(1, node.max_connections)
            score += connection_availability * 30.0
            
            # Performance metrics
            avg_response_time = node.performance_metrics.get('avg_response_time_ms', 50.0)
            response_score = max(0, (50.0 - avg_response_time) / 50.0) * 20.0
            score += response_score
            
            # Health check recency
            time_since_health_check = time.time() - node.last_health_check
            health_score = max(0, (300.0 - time_since_health_check) / 300.0) * 10.0
            score += health_score
            
            node_scores[node.node_id] = score
        
        # Select highest scoring node
        best_node_id = max(node_scores.keys(), key=lambda k: node_scores[k])
        return self.nodes[best_node_id]
    
    def update_node_metrics(self, node_id: str, metrics: Dict[str, float]):
        """Update performance metrics for a node"""
        if node_id in self.nodes:
            self.nodes[node_id].performance_metrics.update(metrics)
            self.nodes[node_id].last_health_check = time.time()
            
            # Update performance history
            self.performance_history[node_id].append({
                'timestamp': time.time(),
                'metrics': metrics.copy()
            })
            
            # Keep only recent history (last 100 entries)
            if len(self.performance_history[node_id]) > 100:
                self.performance_history[node_id] = self.performance_history[node_id][-100:]
    
    def get_load_balancer_status(self) -> Dict[str, Any]:
        """Get current load balancer status"""
        active_nodes = [n for n in self.nodes.values() if n.status == 'active']
        
        return {
            'strategy': self.strategy.value,
            'total_nodes': len(self.nodes),
            'active_nodes': len(active_nodes),
            'total_connections': sum(n.current_connections for n in active_nodes),
            'total_capacity': sum(n.max_connections for n in active_nodes),
            'average_load_percent': sum(n.current_load_percent for n in active_nodes) / max(1, len(active_nodes)),
            'nodes': [node.to_dict() for node in self.nodes.values()]
        }


class AutoScaler:
    """Auto-scaling system that maintains performance targets under load"""
    
    def __init__(self, load_balancer: LoadBalancer):
        self.load_balancer = load_balancer
        self.scaling_metrics_history = deque(maxlen=100)
        self.scaling_decisions_history = deque(maxlen=50)
        
        # Scaling thresholds
        self.scale_up_thresholds = {
            'cpu_utilization_percent': 70.0,
            'memory_utilization_percent': 80.0,
            'average_response_time_ms': 20.0,
            'connection_utilization_percent': 80.0,
            'error_rate_percent': 5.0
        }
        
        self.scale_down_thresholds = {
            'cpu_utilization_percent': 30.0,
            'memory_utilization_percent': 40.0,
            'average_response_time_ms': 10.0,
            'connection_utilization_percent': 40.0,
            'error_rate_percent': 1.0
        }
        
        # Scaling configuration
        self.min_nodes = 1
        self.max_nodes = 10
        self.scale_up_cooldown = 300.0  # 5 minutes
        self.scale_down_cooldown = 600.0  # 10 minutes
        self.last_scaling_action = 0.0
        
    def analyze_scaling_needs(self, current_metrics: ScalingMetrics) -> Tuple[ScalingDirection, int, str]:
        """
        Analyze current metrics and determine scaling needs
        
        Args:
            current_metrics: Current system metrics
            
        Returns:
            Tuple of (scaling_direction, node_count_change, reasoning)
        """
        self.scaling_metrics_history.append(current_metrics)
        
        current_time = time.time()
        active_nodes = len([n for n in self.load_balancer.nodes.values() if n.status == 'active'])
        
        # Check cooldown periods
        time_since_last_scaling = current_time - self.last_scaling_action
        
        # Analyze scale-up conditions
        scale_up_score = self._calculate_scale_up_score(current_metrics)
        scale_down_score = self._calculate_scale_down_score(current_metrics)
        
        # Determine scaling decision
        if scale_up_score > 0.7 and active_nodes < self.max_nodes:
            if time_since_last_scaling >= self.scale_up_cooldown:
                nodes_to_add = self._calculate_nodes_to_add(current_metrics, scale_up_score)
                reasoning = self._generate_scale_up_reasoning(current_metrics, scale_up_score)
                return ScalingDirection.SCALE_UP, nodes_to_add, reasoning
            else:
                return ScalingDirection.MAINTAIN, 0, "Scale-up needed but in cooldown period"
        
        elif scale_down_score > 0.7 and active_nodes > self.min_nodes:
            if time_since_last_scaling >= self.scale_down_cooldown:
                nodes_to_remove = self._calculate_nodes_to_remove(current_metrics, scale_down_score)
                reasoning = self._generate_scale_down_reasoning(current_metrics, scale_down_score)
                return ScalingDirection.SCALE_DOWN, nodes_to_remove, reasoning
            else:
                return ScalingDirection.MAINTAIN, 0, "Scale-down possible but in cooldown period"
        
        else:
            return ScalingDirection.MAINTAIN, 0, "System metrics within acceptable ranges"
    
    def _calculate_scale_up_score(self, metrics: ScalingMetrics) -> float:
        """Calculate scale-up necessity score (0.0 to 1.0)"""
        score = 0.0
        factors = 0
        
        # CPU utilization
        if metrics.cpu_utilization_percent > self.scale_up_thresholds['cpu_utilization_percent']:
            excess = metrics.cpu_utilization_percent - self.scale_up_thresholds['cpu_utilization_percent']
            score += min(1.0, excess / 30.0)  # Normalize to 0-1
            factors += 1
        
        # Memory utilization
        if metrics.memory_utilization_percent > self.scale_up_thresholds['memory_utilization_percent']:
            excess = metrics.memory_utilization_percent - self.scale_up_thresholds['memory_utilization_percent']
            score += min(1.0, excess / 20.0)
            factors += 1
        
        # Response time
        if metrics.average_response_time_ms > self.scale_up_thresholds['average_response_time_ms']:
            excess = metrics.average_response_time_ms - self.scale_up_thresholds['average_response_time_ms']
            score += min(1.0, excess / 30.0)
            factors += 1
        
        # Error rate
        if metrics.error_rate_percent > self.scale_up_thresholds['error_rate_percent']:
            excess = metrics.error_rate_percent - self.scale_up_thresholds['error_rate_percent']
            score += min(1.0, excess / 10.0)
            factors += 1
        
        return score / max(1, factors)  # Average score
    
    def _calculate_scale_down_score(self, metrics: ScalingMetrics) -> float:
        """Calculate scale-down possibility score (0.0 to 1.0)"""
        score = 0.0
        factors = 0
        
        # CPU utilization (lower is better for scale-down)
        if metrics.cpu_utilization_percent < self.scale_down_thresholds['cpu_utilization_percent']:
            headroom = self.scale_down_thresholds['cpu_utilization_percent'] - metrics.cpu_utilization_percent
            score += min(1.0, headroom / 30.0)
            factors += 1
        
        # Memory utilization
        if metrics.memory_utilization_percent < self.scale_down_thresholds['memory_utilization_percent']:
            headroom = self.scale_down_thresholds['memory_utilization_percent'] - metrics.memory_utilization_percent
            score += min(1.0, headroom / 40.0)
            factors += 1
        
        # Response time
        if metrics.average_response_time_ms < self.scale_down_thresholds['average_response_time_ms']:
            headroom = self.scale_down_thresholds['average_response_time_ms'] - metrics.average_response_time_ms
            score += min(1.0, headroom / 10.0)
            factors += 1
        
        # Error rate
        if metrics.error_rate_percent < self.scale_down_thresholds['error_rate_percent']:
            headroom = self.scale_down_thresholds['error_rate_percent'] - metrics.error_rate_percent
            score += min(1.0, headroom / 1.0)
            factors += 1
        
        return score / max(1, factors)
    
    def _calculate_nodes_to_add(self, metrics: ScalingMetrics, scale_up_score: float) -> int:
        """Calculate number of nodes to add"""
        base_nodes = 1
        
        # Add more nodes for higher urgency
        if scale_up_score > 0.9:
            return min(3, self.max_nodes - len(self.load_balancer.nodes))
        elif scale_up_score > 0.8:
            return min(2, self.max_nodes - len(self.load_balancer.nodes))
        else:
            return min(1, self.max_nodes - len(self.load_balancer.nodes))
    
    def _calculate_nodes_to_remove(self, metrics: ScalingMetrics, scale_down_score: float) -> int:
        """Calculate number of nodes to remove"""
        active_nodes = len([n for n in self.load_balancer.nodes.values() if n.status == 'active'])
        
        # Conservative scale-down
        if scale_down_score > 0.9 and active_nodes > 2:
            return min(2, active_nodes - self.min_nodes)
        else:
            return min(1, active_nodes - self.min_nodes)
    
    def _generate_scale_up_reasoning(self, metrics: ScalingMetrics, score: float) -> str:
        """Generate human-readable reasoning for scale-up decision"""
        reasons = []
        
        if metrics.cpu_utilization_percent > self.scale_up_thresholds['cpu_utilization_percent']:
            reasons.append(f"High CPU utilization ({metrics.cpu_utilization_percent:.1f}%)")
        
        if metrics.memory_utilization_percent > self.scale_up_thresholds['memory_utilization_percent']:
            reasons.append(f"High memory utilization ({metrics.memory_utilization_percent:.1f}%)")
        
        if metrics.average_response_time_ms > self.scale_up_thresholds['average_response_time_ms']:
            reasons.append(f"High response time ({metrics.average_response_time_ms:.1f}ms)")
        
        if metrics.error_rate_percent > self.scale_up_thresholds['error_rate_percent']:
            reasons.append(f"High error rate ({metrics.error_rate_percent:.1f}%)")
        
        return f"Scale-up needed (score: {score:.2f}): " + ", ".join(reasons)
    
    def _generate_scale_down_reasoning(self, metrics: ScalingMetrics, score: float) -> str:
        """Generate human-readable reasoning for scale-down decision"""
        reasons = []
        
        if metrics.cpu_utilization_percent < self.scale_down_thresholds['cpu_utilization_percent']:
            reasons.append(f"Low CPU utilization ({metrics.cpu_utilization_percent:.1f}%)")
        
        if metrics.memory_utilization_percent < self.scale_down_thresholds['memory_utilization_percent']:
            reasons.append(f"Low memory utilization ({metrics.memory_utilization_percent:.1f}%)")
        
        if metrics.average_response_time_ms < self.scale_down_thresholds['average_response_time_ms']:
            reasons.append(f"Low response time ({metrics.average_response_time_ms:.1f}ms)")
        
        return f"Scale-down possible (score: {score:.2f}): " + ", ".join(reasons)
    
    def record_scaling_action(self, direction: ScalingDirection, node_count_change: int, reasoning: str):
        """Record a scaling action for history tracking"""
        self.last_scaling_action = time.time()
        
        scaling_decision = {
            'timestamp': self.last_scaling_action,
            'direction': direction.value,
            'node_count_change': node_count_change,
            'reasoning': reasoning
        }
        
        self.scaling_decisions_history.append(scaling_decision)
        logger.info(f"Scaling action recorded: {reasoning}")
    
    def get_auto_scaler_status(self) -> Dict[str, Any]:
        """Get current auto-scaler status"""
        recent_decisions = list(self.scaling_decisions_history)[-10:]  # Last 10 decisions
        
        return {
            'min_nodes': self.min_nodes,
            'max_nodes': self.max_nodes,
            'current_active_nodes': len([n for n in self.load_balancer.nodes.values() if n.status == 'active']),
            'scale_up_cooldown_seconds': self.scale_up_cooldown,
            'scale_down_cooldown_seconds': self.scale_down_cooldown,
            'time_since_last_action': time.time() - self.last_scaling_action,
            'recent_decisions': recent_decisions,
            'thresholds': {
                'scale_up': self.scale_up_thresholds,
                'scale_down': self.scale_down_thresholds
            }
        }


class RollingUpdateManager:
    """Rolling update system for model updates without downtime"""
    
    def __init__(self, load_balancer: LoadBalancer):
        self.load_balancer = load_balancer
        self.update_in_progress = False
        self.update_history = deque(maxlen=20)
        
    async def perform_rolling_update(self, new_config: ModelConfiguration,
                                   update_strategy: str = 'gradual') -> Dict[str, Any]:
        """
        Perform rolling update with new model configuration
        
        Args:
            new_config: New model configuration to deploy
            update_strategy: 'gradual', 'canary', or 'blue_green'
            
        Returns:
            Update result with status and details
        """
        if self.update_in_progress:
            return {
                'success': False,
                'error': 'Update already in progress',
                'status': 'rejected'
            }
        
        self.update_in_progress = True
        update_start_time = time.time()
        
        try:
            if update_strategy == 'gradual':
                result = await self._perform_gradual_update(new_config)
            elif update_strategy == 'canary':
                result = await self._perform_canary_update(new_config)
            elif update_strategy == 'blue_green':
                result = await self._perform_blue_green_update(new_config)
            else:
                raise ValueError(f"Unknown update strategy: {update_strategy}")
            
            # Record update in history
            update_record = {
                'timestamp': update_start_time,
                'duration_seconds': time.time() - update_start_time,
                'strategy': update_strategy,
                'config_id': new_config.config_id,
                'success': result['success'],
                'nodes_updated': result.get('nodes_updated', 0),
                'rollback_performed': result.get('rollback_performed', False)
            }
            
            self.update_history.append(update_record)
            
            return result
            
        except Exception as e:
            logger.error(f"Rolling update failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'status': 'failed'
            }
        finally:
            self.update_in_progress = False
    
    async def _perform_gradual_update(self, new_config: ModelConfiguration) -> Dict[str, Any]:
        """Perform gradual rolling update (update nodes one by one)"""
        active_nodes = [n for n in self.load_balancer.nodes.values() if n.status == 'active']
        
        if not active_nodes:
            return {
                'success': False,
                'error': 'No active nodes available for update',
                'status': 'failed'
            }
        
        updated_nodes = []
        failed_nodes = []
        
        for node in active_nodes:
            try:
                # Update node configuration
                success = await self._update_node_configuration(node, new_config)
                
                if success:
                    updated_nodes.append(node.node_id)
                    logger.info(f"Successfully updated node {node.node_id}")
                    
                    # Wait between updates to ensure stability
                    await asyncio.sleep(30)  # 30 second delay between updates
                else:
                    failed_nodes.append(node.node_id)
                    logger.error(f"Failed to update node {node.node_id}")
                    
                    # If update fails, consider rollback
                    if len(failed_nodes) > len(updated_nodes):
                        logger.warning("Too many failures, initiating rollback")
                        rollback_result = await self._rollback_updates(updated_nodes)
                        return {
                            'success': False,
                            'error': 'Update failed, rollback performed',
                            'status': 'rolled_back',
                            'nodes_updated': len(updated_nodes),
                            'nodes_failed': len(failed_nodes),
                            'rollback_performed': True,
                            'rollback_result': rollback_result
                        }
                
            except Exception as e:
                logger.error(f"Exception updating node {node.node_id}: {e}")
                failed_nodes.append(node.node_id)
        
        return {
            'success': len(failed_nodes) == 0,
            'status': 'completed' if len(failed_nodes) == 0 else 'partial',
            'nodes_updated': len(updated_nodes),
            'nodes_failed': len(failed_nodes),
            'updated_nodes': updated_nodes,
            'failed_nodes': failed_nodes,
            'rollback_performed': False
        }
    
    async def _perform_canary_update(self, new_config: ModelConfiguration) -> Dict[str, Any]:
        """Perform canary deployment (update small subset first)"""
        active_nodes = [n for n in self.load_balancer.nodes.values() if n.status == 'active']
        
        if len(active_nodes) < 2:
            return {
                'success': False,
                'error': 'Canary deployment requires at least 2 active nodes',
                'status': 'failed'
            }
        
        # Select canary nodes (10% or minimum 1 node)
        canary_count = max(1, len(active_nodes) // 10)
        canary_nodes = active_nodes[:canary_count]
        
        # Phase 1: Update canary nodes
        canary_results = []
        for node in canary_nodes:
            success = await self._update_node_configuration(node, new_config)
            canary_results.append(success)
        
        if not all(canary_results):
            return {
                'success': False,
                'error': 'Canary deployment failed',
                'status': 'canary_failed',
                'canary_nodes': [n.node_id for n in canary_nodes],
                'canary_results': canary_results
            }
        
        # Phase 2: Monitor canary performance
        logger.info("Monitoring canary deployment performance...")
        await asyncio.sleep(300)  # 5 minute monitoring period
        
        # Check canary health (simplified - in production would check detailed metrics)
        canary_healthy = all(node.status == 'active' for node in canary_nodes)
        
        if not canary_healthy:
            # Rollback canary nodes
            await self._rollback_updates([n.node_id for n in canary_nodes])
            return {
                'success': False,
                'error': 'Canary nodes showed poor performance, rolled back',
                'status': 'canary_rollback',
                'rollback_performed': True
            }
        
        # Phase 3: Update remaining nodes
        remaining_nodes = active_nodes[canary_count:]
        remaining_results = []
        
        for node in remaining_nodes:
            success = await self._update_node_configuration(node, new_config)
            remaining_results.append(success)
            await asyncio.sleep(15)  # Shorter delay for remaining nodes
        
        total_success = all(canary_results + remaining_results)
        
        return {
            'success': total_success,
            'status': 'completed' if total_success else 'partial',
            'canary_nodes': [n.node_id for n in canary_nodes],
            'remaining_nodes': [n.node_id for n in remaining_nodes],
            'nodes_updated': len(active_nodes) if total_success else sum(canary_results + remaining_results),
            'rollback_performed': False
        }
    
    async def _perform_blue_green_update(self, new_config: ModelConfiguration) -> Dict[str, Any]:
        """Perform blue-green deployment (maintain two environments)"""
        # This is a simplified implementation
        # In production, this would involve creating a complete parallel environment
        
        active_nodes = [n for n in self.load_balancer.nodes.values() if n.status == 'active']
        
        if len(active_nodes) < 2:
            return {
                'success': False,
                'error': 'Blue-green deployment requires at least 2 active nodes',
                'status': 'failed'
            }
        
        # Split nodes into blue (current) and green (new) environments
        blue_nodes = active_nodes[:len(active_nodes)//2]
        green_nodes = active_nodes[len(active_nodes)//2:]
        
        # Update green environment
        green_results = []
        for node in green_nodes:
            success = await self._update_node_configuration(node, new_config)
            green_results.append(success)
        
        if not all(green_results):
            return {
                'success': False,
                'error': 'Green environment update failed',
                'status': 'green_failed',
                'green_nodes': [n.node_id for n in green_nodes]
            }
        
        # Monitor green environment
        await asyncio.sleep(180)  # 3 minute monitoring
        
        # Switch traffic to green environment (simplified)
        logger.info("Switching traffic to green environment")
        
        # Update blue environment
        blue_results = []
        for node in blue_nodes:
            success = await self._update_node_configuration(node, new_config)
            blue_results.append(success)
        
        total_success = all(green_results + blue_results)
        
        return {
            'success': total_success,
            'status': 'completed' if total_success else 'partial',
            'blue_nodes': [n.node_id for n in blue_nodes],
            'green_nodes': [n.node_id for n in green_nodes],
            'nodes_updated': len(active_nodes) if total_success else sum(green_results + blue_results),
            'rollback_performed': False
        }
    
    async def _update_node_configuration(self, node: DeploymentNode, 
                                       new_config: ModelConfiguration) -> bool:
        """Update configuration for a single node"""
        try:
            # Mark node as updating
            node.status = 'updating'
            
            # Simulate configuration update (in production, this would involve actual deployment)
            await asyncio.sleep(5)  # Simulate update time
            
            # Update node configuration
            node.model_config = new_config
            node.status = 'active'
            
            logger.info(f"Node {node.node_id} updated to configuration {new_config.config_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update node {node.node_id}: {e}")
            node.status = 'failed'
            return False
    
    async def _rollback_updates(self, node_ids: List[str]) -> Dict[str, Any]:
        """Rollback updates for specified nodes"""
        rollback_results = []
        
        for node_id in node_ids:
            if node_id in self.load_balancer.nodes:
                node = self.load_balancer.nodes[node_id]
                try:
                    # Simulate rollback (in production, would restore previous configuration)
                    node.status = 'updating'
                    await asyncio.sleep(3)
                    node.status = 'active'
                    rollback_results.append(True)
                    logger.info(f"Rolled back node {node_id}")
                except Exception as e:
                    logger.error(f"Failed to rollback node {node_id}: {e}")
                    rollback_results.append(False)
        
        return {
            'nodes_rolled_back': sum(rollback_results),
            'rollback_failures': len(rollback_results) - sum(rollback_results),
            'success': all(rollback_results)
        }
    
    def get_update_status(self) -> Dict[str, Any]:
        """Get current update status"""
        recent_updates = list(self.update_history)[-5:]  # Last 5 updates
        
        return {
            'update_in_progress': self.update_in_progress,
            'recent_updates': recent_updates,
            'total_updates_performed': len(self.update_history),
            'successful_updates': len([u for u in self.update_history if u['success']]),
            'failed_updates': len([u for u in self.update_history if not u['success']])
        }


class ProductionDeploymentSystem:
    """
    Main production deployment system coordinating all components
    Implements Requirements 7.1, 7.2, 7.3, 7.4, 7.5
    """
    
    def __init__(self):
        self.config_selector = ModelConfigurationSelector()
        self.load_balancer = LoadBalancer()
        self.auto_scaler = AutoScaler(self.load_balancer)
        self.rolling_updater = RollingUpdateManager(self.load_balancer)
        
        # System state
        self.current_environment = DeploymentEnvironment.DEVELOPMENT
        self.current_config: Optional[ModelConfiguration] = None
        self.system_health_checks_enabled = True
        self.monitoring_active = False
        
        # Health check configuration
        self.health_check_interval = 60.0  # seconds
        self.health_check_task: Optional[asyncio.Task] = None
        
    async def initialize_deployment(self, environment: DeploymentEnvironment,
                                  hardware_profile: Dict[str, Any],
                                  performance_requirements: Dict[str, float],
                                  initial_node_count: int = 2) -> Dict[str, Any]:
        """
        Initialize production deployment system
        
        Args:
            environment: Target deployment environment
            hardware_profile: Available hardware resources
            performance_requirements: Required performance targets
            initial_node_count: Number of initial deployment nodes
            
        Returns:
            Initialization result
        """
        try:
            self.current_environment = environment
            
            # Select optimal configuration
            self.current_config = self.config_selector.select_optimal_configuration(
                environment, hardware_profile, performance_requirements
            )
            
            # Initialize deployment nodes
            for i in range(initial_node_count):
                node = DeploymentNode(
                    node_id=f"node_{i+1}",
                    host=f"localhost",  # In production, would be actual hosts
                    port=8000 + i,
                    status='active',
                    current_connections=0,
                    max_connections=100,
                    current_load_percent=0.0,
                    last_health_check=time.time(),
                    model_config=self.current_config,
                    performance_metrics={}
                )
                self.load_balancer.add_node(node)
            
            # Start health monitoring
            if self.system_health_checks_enabled:
                await self.start_health_monitoring()
            
            logger.info(f"Production deployment initialized for {environment.value} "
                       f"with {initial_node_count} nodes")
            
            return {
                'success': True,
                'environment': environment.value,
                'configuration': self.current_config.to_dict(),
                'initial_nodes': initial_node_count,
                'load_balancer_status': self.load_balancer.get_load_balancer_status()
            }
            
        except Exception as e:
            logger.error(f"Failed to initialize deployment: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def handle_inference_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle inference request through load balancer
        
        Args:
            request_data: Request data and metadata
            
        Returns:
            Response with routing information
        """
        try:
            # Select optimal node
            selected_node = self.load_balancer.select_node(request_data.get('metadata'))
            
            if not selected_node:
                return {
                    'success': False,
                    'error': 'No available nodes for request',
                    'status': 'no_capacity'
                }
            
            # Update node connection count
            selected_node.current_connections += 1
            
            # Simulate request processing (in production, would route to actual node)
            processing_start = time.time()
            await asyncio.sleep(0.01)  # Simulate processing time
            processing_time = (time.time() - processing_start) * 1000
            
            # Update node metrics
            self.load_balancer.update_node_metrics(selected_node.node_id, {
                'avg_response_time_ms': processing_time,
                'requests_processed': selected_node.performance_metrics.get('requests_processed', 0) + 1
            })
            
            # Update connection count
            selected_node.current_connections = max(0, selected_node.current_connections - 1)
            
            return {
                'success': True,
                'node_id': selected_node.node_id,
                'processing_time_ms': processing_time,
                'load_balancer_strategy': self.load_balancer.strategy.value
            }
            
        except Exception as e:
            logger.error(f"Failed to handle inference request: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def check_auto_scaling(self, current_metrics: ScalingMetrics) -> Dict[str, Any]:
        """
        Check and perform auto-scaling based on current metrics
        
        Args:
            current_metrics: Current system performance metrics
            
        Returns:
            Scaling action result
        """
        try:
            # Analyze scaling needs
            direction, node_count_change, reasoning = self.auto_scaler.analyze_scaling_needs(current_metrics)
            
            if direction == ScalingDirection.MAINTAIN:
                return {
                    'action_taken': False,
                    'direction': direction.value,
                    'reasoning': reasoning,
                    'current_nodes': len([n for n in self.load_balancer.nodes.values() if n.status == 'active'])
                }
            
            # Perform scaling action
            if direction == ScalingDirection.SCALE_UP:
                result = await self._scale_up_nodes(node_count_change)
            else:  # SCALE_DOWN
                result = await self._scale_down_nodes(node_count_change)
            
            # Record scaling action
            if result['success']:
                self.auto_scaler.record_scaling_action(direction, node_count_change, reasoning)
            
            return {
                'action_taken': True,
                'direction': direction.value,
                'node_count_change': node_count_change,
                'reasoning': reasoning,
                'scaling_result': result
            }
            
        except Exception as e:
            logger.error(f"Auto-scaling check failed: {e}")
            return {
                'action_taken': False,
                'error': str(e)
            }
    
    async def _scale_up_nodes(self, node_count: int) -> Dict[str, Any]:
        """Add new nodes to the deployment"""
        added_nodes = []
        
        try:
            current_node_count = len(self.load_balancer.nodes)
            
            for i in range(node_count):
                new_node = DeploymentNode(
                    node_id=f"node_{current_node_count + i + 1}",
                    host="localhost",
                    port=8000 + current_node_count + i,
                    status='active',
                    current_connections=0,
                    max_connections=100,
                    current_load_percent=0.0,
                    last_health_check=time.time(),
                    model_config=self.current_config,
                    performance_metrics={}
                )
                
                self.load_balancer.add_node(new_node)
                added_nodes.append(new_node.node_id)
                
                # Simulate node startup time
                await asyncio.sleep(1)
            
            logger.info(f"Scaled up by {node_count} nodes: {added_nodes}")
            
            return {
                'success': True,
                'nodes_added': len(added_nodes),
                'new_node_ids': added_nodes
            }
            
        except Exception as e:
            logger.error(f"Scale-up failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'nodes_added': len(added_nodes)
            }
    
    async def _scale_down_nodes(self, node_count: int) -> Dict[str, Any]:
        """Remove nodes from the deployment"""
        removed_nodes = []
        
        try:
            active_nodes = [n for n in self.load_balancer.nodes.values() if n.status == 'active']
            
            # Select nodes with lowest load for removal
            nodes_to_remove = sorted(active_nodes, key=lambda n: n.current_load_percent)[:node_count]
            
            for node in nodes_to_remove:
                # Gracefully drain connections
                node.status = 'draining'
                
                # Wait for connections to drain (simplified)
                await asyncio.sleep(2)
                
                # Remove node
                self.load_balancer.remove_node(node.node_id)
                removed_nodes.append(node.node_id)
            
            logger.info(f"Scaled down by {node_count} nodes: {removed_nodes}")
            
            return {
                'success': True,
                'nodes_removed': len(removed_nodes),
                'removed_node_ids': removed_nodes
            }
            
        except Exception as e:
            logger.error(f"Scale-down failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'nodes_removed': len(removed_nodes)
            }
    
    async def perform_rolling_update(self, new_config: ModelConfiguration,
                                   update_strategy: str = 'gradual') -> Dict[str, Any]:
        """
        Perform rolling update with new configuration
        
        Args:
            new_config: New model configuration
            update_strategy: Update strategy ('gradual', 'canary', 'blue_green')
            
        Returns:
            Update result
        """
        result = await self.rolling_updater.perform_rolling_update(new_config, update_strategy)
        
        if result['success']:
            self.current_config = new_config
            logger.info(f"Rolling update completed successfully with strategy: {update_strategy}")
        else:
            logger.error(f"Rolling update failed: {result.get('error', 'Unknown error')}")
        
        return result
    
    async def start_health_monitoring(self):
        """Start continuous health monitoring"""
        if self.monitoring_active:
            return
        
        self.monitoring_active = True
        self.health_check_task = asyncio.create_task(self._health_monitoring_loop())
        logger.info("Health monitoring started")
    
    async def stop_health_monitoring(self):
        """Stop health monitoring"""
        self.monitoring_active = False
        
        if self.health_check_task:
            self.health_check_task.cancel()
            try:
                await self.health_check_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Health monitoring stopped")
    
    async def _health_monitoring_loop(self):
        """Continuous health monitoring loop"""
        while self.monitoring_active:
            try:
                # Check health of all nodes
                for node in self.load_balancer.nodes.values():
                    await self._check_node_health(node)
                
                # Sleep until next check
                await asyncio.sleep(self.health_check_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health monitoring error: {e}")
                await asyncio.sleep(10)  # Wait before retrying
    
    async def _check_node_health(self, node: DeploymentNode):
        """Check health of a single node"""
        try:
            # Simulate health check (in production, would make actual health check request)
            current_time = time.time()
            
            # Update last health check time
            node.last_health_check = current_time
            
            # Simulate load calculation
            base_load = min(100.0, (node.current_connections / max(1, node.max_connections)) * 100)
            node.current_load_percent = base_load
            
            # Mark node as healthy if it responds
            if node.status == 'failed':
                node.status = 'active'
                logger.info(f"Node {node.node_id} recovered and marked as active")
            
        except Exception as e:
            logger.error(f"Health check failed for node {node.node_id}: {e}")
            node.status = 'failed'
    
    def get_deployment_status(self) -> Dict[str, Any]:
        """Get comprehensive deployment system status"""
        return {
            'environment': self.current_environment.value,
            'current_configuration': self.current_config.to_dict() if self.current_config else None,
            'load_balancer': self.load_balancer.get_load_balancer_status(),
            'auto_scaler': self.auto_scaler.get_auto_scaler_status(),
            'rolling_updater': self.rolling_updater.get_update_status(),
            'health_monitoring': {
                'enabled': self.system_health_checks_enabled,
                'active': self.monitoring_active,
                'check_interval_seconds': self.health_check_interval
            },
            'system_metrics': {
                'total_nodes': len(self.load_balancer.nodes),
                'active_nodes': len([n for n in self.load_balancer.nodes.values() if n.status == 'active']),
                'failed_nodes': len([n for n in self.load_balancer.nodes.values() if n.status == 'failed']),
                'updating_nodes': len([n for n in self.load_balancer.nodes.values() if n.status == 'updating'])
            }
        }
    
    async def cleanup(self):
        """Cleanup deployment system resources"""
        await self.stop_health_monitoring()
        self.load_balancer.nodes.clear()
        logger.info("Production deployment system cleanup completed")