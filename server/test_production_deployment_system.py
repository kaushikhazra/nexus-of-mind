"""
Test suite for Production Deployment System
Tests Requirements 7.1, 7.2, 7.3, 7.4, 7.5 for production deployment optimization
"""

import pytest
import asyncio
import time
from unittest.mock import Mock, patch, MagicMock

# Import the components we're testing
from ai_engine.production_deployment_system import (
    ProductionDeploymentSystem, ModelConfigurationSelector, LoadBalancer,
    AutoScaler, RollingUpdateManager, DeploymentNode, ModelConfiguration,
    ScalingMetrics, DeploymentEnvironment, LoadBalancingStrategy, ScalingDirection
)


class TestModelConfigurationSelector:
    """Test automatic model configuration selection"""
    
    def test_selector_initialization(self):
        """Test configuration selector initialization"""
        selector = ModelConfigurationSelector()
        
        assert len(selector.predefined_configs) > 0
        assert 'high_performance' in selector.predefined_configs
        assert 'balanced' in selector.predefined_configs
        assert 'resource_constrained' in selector.predefined_configs
        assert 'development' in selector.predefined_configs
        
        assert DeploymentEnvironment.PRODUCTION in selector.environment_profiles
        assert DeploymentEnvironment.DEVELOPMENT in selector.environment_profiles
    
    def test_select_optimal_configuration_production(self):
        """Test configuration selection for production environment"""
        selector = ModelConfigurationSelector()
        
        # High-end hardware profile
        hardware_profile = {
            'gpu_available': True,
            'gpu_memory_gb': 8.0,
            'cpu_cores': 8,
            'memory_gb': 16.0
        }
        
        # Strict performance requirements
        performance_requirements = {
            'max_inference_time_ms': 16.0,
            'min_throughput_per_sec': 100.0
        }
        
        config = selector.select_optimal_configuration(
            DeploymentEnvironment.PRODUCTION,
            hardware_profile,
            performance_requirements
        )
        
        assert isinstance(config, ModelConfiguration)
        assert config.gpu_acceleration is True  # Should use GPU for production
        assert config.target_inference_time_ms <= 16.0
        assert config.target_throughput_per_sec >= 100.0
    
    def test_select_optimal_configuration_resource_constrained(self):
        """Test configuration selection for resource-constrained environment"""
        selector = ModelConfigurationSelector()
        
        # Limited hardware profile
        hardware_profile = {
            'gpu_available': False,
            'gpu_memory_gb': 0.0,
            'cpu_cores': 2,
            'memory_gb': 4.0
        }
        
        # Relaxed performance requirements
        performance_requirements = {
            'max_inference_time_ms': 50.0,
            'min_throughput_per_sec': 20.0
        }
        
        config = selector.select_optimal_configuration(
            DeploymentEnvironment.TESTING,
            hardware_profile,
            performance_requirements
        )
        
        assert isinstance(config, ModelConfiguration)
        assert config.gpu_acceleration is False  # Should not require GPU
        assert config.memory_limit_mb <= 200  # Should use less memory
    
    def test_configuration_customization(self):
        """Test configuration customization based on hardware"""
        selector = ModelConfigurationSelector()
        
        # High memory hardware
        hardware_profile = {
            'gpu_available': True,
            'gpu_memory_gb': 4.0,
            'cpu_cores': 4,
            'memory_gb': 32.0  # High memory
        }
        
        performance_requirements = {
            'max_inference_time_ms': 12.0,  # Strict requirement
            'min_throughput_per_sec': 150.0
        }
        
        config = selector.select_optimal_configuration(
            DeploymentEnvironment.PRODUCTION,
            hardware_profile,
            performance_requirements
        )
        
        # Should customize based on requirements
        assert config.target_inference_time_ms <= 12.0
        assert config.target_throughput_per_sec >= 150.0


class TestLoadBalancer:
    """Test load balancing system"""
    
    def test_load_balancer_initialization(self):
        """Test load balancer initialization"""
        lb = LoadBalancer(LoadBalancingStrategy.ROUND_ROBIN)
        
        assert lb.strategy == LoadBalancingStrategy.ROUND_ROBIN
        assert len(lb.nodes) == 0
        assert lb.request_counter == 0
    
    def test_add_remove_nodes(self):
        """Test adding and removing nodes"""
        lb = LoadBalancer()
        
        # Create test node
        node = DeploymentNode(
            node_id='test_node_1',
            host='localhost',
            port=8000,
            status='active',
            current_connections=0,
            max_connections=100,
            current_load_percent=0.0,
            last_health_check=time.time(),
            model_config=None,
            performance_metrics={}
        )
        
        # Add node
        lb.add_node(node)
        assert 'test_node_1' in lb.nodes
        assert lb.nodes['test_node_1'] == node
        
        # Remove node
        lb.remove_node('test_node_1')
        assert 'test_node_1' not in lb.nodes
    
    def test_round_robin_selection(self):
        """Test round-robin node selection"""
        lb = LoadBalancer(LoadBalancingStrategy.ROUND_ROBIN)
        
        # Add multiple nodes
        for i in range(3):
            node = DeploymentNode(
                node_id=f'node_{i}',
                host='localhost',
                port=8000 + i,
                status='active',
                current_connections=0,
                max_connections=100,
                current_load_percent=0.0,
                last_health_check=time.time(),
                model_config=None,
                performance_metrics={}
            )
            lb.add_node(node)
        
        # Test round-robin selection
        selected_nodes = []
        for _ in range(6):  # Two full rounds
            selected = lb.select_node()
            selected_nodes.append(selected.node_id)
        
        # Should cycle through nodes
        assert selected_nodes == ['node_0', 'node_1', 'node_2', 'node_0', 'node_1', 'node_2']
    
    def test_least_connections_selection(self):
        """Test least connections node selection"""
        lb = LoadBalancer(LoadBalancingStrategy.LEAST_CONNECTIONS)
        
        # Add nodes with different connection counts
        for i in range(3):
            node = DeploymentNode(
                node_id=f'node_{i}',
                host='localhost',
                port=8000 + i,
                status='active',
                current_connections=i * 10,  # Different connection counts
                max_connections=100,
                current_load_percent=0.0,
                last_health_check=time.time(),
                model_config=None,
                performance_metrics={}
            )
            lb.add_node(node)
        
        # Should select node with least connections (node_0)
        selected = lb.select_node()
        assert selected.node_id == 'node_0'
        assert selected.current_connections == 0
    
    def test_performance_based_selection(self):
        """Test performance-based node selection"""
        lb = LoadBalancer(LoadBalancingStrategy.PERFORMANCE_BASED)
        
        # Add nodes with different performance characteristics
        for i in range(3):
            node = DeploymentNode(
                node_id=f'node_{i}',
                host='localhost',
                port=8000 + i,
                status='active',
                current_connections=10,
                max_connections=100,
                current_load_percent=20.0 + (i * 20.0),  # Different loads
                last_health_check=time.time(),
                model_config=None,
                performance_metrics={
                    'avg_response_time_ms': 10.0 + (i * 5.0)  # Different response times
                }
            )
            lb.add_node(node)
        
        # Should select node with best performance (node_0)
        selected = lb.select_node()
        assert selected.node_id == 'node_0'  # Lowest load and response time
    
    def test_no_active_nodes(self):
        """Test selection when no active nodes available"""
        lb = LoadBalancer()
        
        # Add inactive node
        node = DeploymentNode(
            node_id='inactive_node',
            host='localhost',
            port=8000,
            status='failed',  # Not active
            current_connections=0,
            max_connections=100,
            current_load_percent=0.0,
            last_health_check=time.time(),
            model_config=None,
            performance_metrics={}
        )
        lb.add_node(node)
        
        # Should return None when no active nodes
        selected = lb.select_node()
        assert selected is None
    
    def test_update_node_metrics(self):
        """Test updating node performance metrics"""
        lb = LoadBalancer()
        
        node = DeploymentNode(
            node_id='test_node',
            host='localhost',
            port=8000,
            status='active',
            current_connections=0,
            max_connections=100,
            current_load_percent=0.0,
            last_health_check=0.0,
            model_config=None,
            performance_metrics={}
        )
        lb.add_node(node)
        
        # Update metrics
        new_metrics = {
            'avg_response_time_ms': 15.0,
            'requests_processed': 100
        }
        
        lb.update_node_metrics('test_node', new_metrics)
        
        # Verify metrics updated
        assert lb.nodes['test_node'].performance_metrics['avg_response_time_ms'] == 15.0
        assert lb.nodes['test_node'].performance_metrics['requests_processed'] == 100
        assert lb.nodes['test_node'].last_health_check > 0.0


class TestAutoScaler:
    """Test auto-scaling system"""
    
    @pytest.fixture
    def load_balancer(self):
        """Create load balancer with test nodes"""
        lb = LoadBalancer()
        
        # Add initial nodes
        for i in range(2):
            node = DeploymentNode(
                node_id=f'node_{i}',
                host='localhost',
                port=8000 + i,
                status='active',
                current_connections=10,
                max_connections=100,
                current_load_percent=30.0,
                last_health_check=time.time(),
                model_config=None,
                performance_metrics={}
            )
            lb.add_node(node)
        
        return lb
    
    @pytest.fixture
    def auto_scaler(self, load_balancer):
        """Create auto-scaler for testing"""
        return AutoScaler(load_balancer)
    
    def test_auto_scaler_initialization(self, auto_scaler):
        """Test auto-scaler initialization"""
        assert auto_scaler.min_nodes == 1
        assert auto_scaler.max_nodes == 10
        assert auto_scaler.scale_up_cooldown == 300.0
        assert auto_scaler.scale_down_cooldown == 600.0
    
    def test_scale_up_analysis(self, auto_scaler):
        """Test scale-up analysis with high load"""
        # Create metrics indicating need for scale-up
        high_load_metrics = ScalingMetrics(
            timestamp=time.time(),
            total_requests_per_minute=500.0,
            average_response_time_ms=25.0,  # Above threshold
            active_connections=80,
            cpu_utilization_percent=85.0,  # Above threshold
            memory_utilization_percent=90.0,  # Above threshold
            error_rate_percent=8.0,  # Above threshold
            target_compliance_rate=0.6
        )
        
        direction, node_count, reasoning = auto_scaler.analyze_scaling_needs(high_load_metrics)
        
        assert direction == ScalingDirection.SCALE_UP
        assert node_count > 0
        assert 'High' in reasoning or 'high' in reasoning
    
    def test_scale_down_analysis(self, auto_scaler):
        """Test scale-down analysis with low load"""
        # Create metrics indicating possibility for scale-down
        low_load_metrics = ScalingMetrics(
            timestamp=time.time(),
            total_requests_per_minute=50.0,
            average_response_time_ms=5.0,  # Below threshold
            active_connections=10,
            cpu_utilization_percent=20.0,  # Below threshold
            memory_utilization_percent=25.0,  # Below threshold
            error_rate_percent=0.5,  # Below threshold
            target_compliance_rate=0.95
        )
        
        # Set last scaling action to past to avoid cooldown
        auto_scaler.last_scaling_action = time.time() - 700.0
        
        direction, node_count, reasoning = auto_scaler.analyze_scaling_needs(low_load_metrics)
        
        assert direction == ScalingDirection.SCALE_DOWN
        assert node_count > 0
        assert 'Low' in reasoning or 'low' in reasoning
    
    def test_maintain_analysis(self, auto_scaler):
        """Test maintain decision with balanced load"""
        # Create balanced metrics
        balanced_metrics = ScalingMetrics(
            timestamp=time.time(),
            total_requests_per_minute=200.0,
            average_response_time_ms=15.0,  # Within acceptable range
            active_connections=50,
            cpu_utilization_percent=50.0,  # Within acceptable range
            memory_utilization_percent=60.0,  # Within acceptable range
            error_rate_percent=2.0,  # Within acceptable range
            target_compliance_rate=0.85
        )
        
        direction, node_count, reasoning = auto_scaler.analyze_scaling_needs(balanced_metrics)
        
        assert direction == ScalingDirection.MAINTAIN
        assert node_count == 0
    
    def test_cooldown_periods(self, auto_scaler):
        """Test scaling cooldown periods"""
        # Set recent scaling action
        auto_scaler.last_scaling_action = time.time() - 100.0  # Recent action
        
        # Create metrics that would normally trigger scale-up
        high_load_metrics = ScalingMetrics(
            timestamp=time.time(),
            total_requests_per_minute=500.0,
            average_response_time_ms=30.0,
            active_connections=90,
            cpu_utilization_percent=90.0,
            memory_utilization_percent=95.0,
            error_rate_percent=10.0,
            target_compliance_rate=0.5
        )
        
        direction, node_count, reasoning = auto_scaler.analyze_scaling_needs(high_load_metrics)
        
        # Should maintain due to cooldown
        assert direction == ScalingDirection.MAINTAIN
        assert 'cooldown' in reasoning.lower()
    
    def test_record_scaling_action(self, auto_scaler):
        """Test recording scaling actions"""
        initial_count = len(auto_scaler.scaling_decisions_history)
        
        auto_scaler.record_scaling_action(
            ScalingDirection.SCALE_UP, 
            2, 
            "High CPU utilization"
        )
        
        assert len(auto_scaler.scaling_decisions_history) == initial_count + 1
        assert auto_scaler.last_scaling_action > 0


class TestRollingUpdateManager:
    """Test rolling update system"""
    
    @pytest.fixture
    def load_balancer(self):
        """Create load balancer with test nodes"""
        lb = LoadBalancer()
        
        # Add test nodes
        for i in range(4):
            node = DeploymentNode(
                node_id=f'node_{i}',
                host='localhost',
                port=8000 + i,
                status='active',
                current_connections=5,
                max_connections=100,
                current_load_percent=20.0,
                last_health_check=time.time(),
                model_config=None,
                performance_metrics={}
            )
            lb.add_node(node)
        
        return lb
    
    @pytest.fixture
    def rolling_updater(self, load_balancer):
        """Create rolling update manager for testing"""
        return RollingUpdateManager(load_balancer)
    
    @pytest.fixture
    def new_config(self):
        """Create new model configuration for testing"""
        return ModelConfiguration(
            config_id='test_config_001',
            name='Test Configuration',
            description='Test configuration for rolling update',
            quantization_enabled=True,
            gpu_acceleration=True,
            batch_size=16,
            memory_limit_mb=200,
            target_inference_time_ms=12.0,
            target_throughput_per_sec=120.0,
            hardware_requirements={'min_gpu_memory_gb': 2.0},
            optimization_level='balanced'
        )
    
    def test_rolling_updater_initialization(self, rolling_updater):
        """Test rolling update manager initialization"""
        assert rolling_updater.update_in_progress is False
        assert len(rolling_updater.update_history) == 0
    
    @pytest.mark.asyncio
    async def test_gradual_update_success(self, rolling_updater, new_config):
        """Test successful gradual rolling update"""
        result = await rolling_updater.perform_rolling_update(new_config, 'gradual')
        
        assert result['success'] is True
        assert result['status'] == 'completed'
        assert result['nodes_updated'] == 4  # All nodes should be updated
        assert result['nodes_failed'] == 0
        assert len(result['updated_nodes']) == 4
    
    @pytest.mark.asyncio
    async def test_canary_update_success(self, rolling_updater, new_config):
        """Test successful canary deployment"""
        result = await rolling_updater.perform_rolling_update(new_config, 'canary')
        
        assert result['success'] is True
        assert result['status'] == 'completed'
        assert 'canary_nodes' in result
        assert 'remaining_nodes' in result
        assert len(result['canary_nodes']) >= 1  # At least one canary node
    
    @pytest.mark.asyncio
    async def test_blue_green_update_success(self, rolling_updater, new_config):
        """Test successful blue-green deployment"""
        result = await rolling_updater.perform_rolling_update(new_config, 'blue_green')
        
        assert result['success'] is True
        assert result['status'] == 'completed'
        assert 'blue_nodes' in result
        assert 'green_nodes' in result
    
    @pytest.mark.asyncio
    async def test_concurrent_update_rejection(self, rolling_updater, new_config):
        """Test rejection of concurrent updates"""
        # Start first update
        update_task = asyncio.create_task(
            rolling_updater.perform_rolling_update(new_config, 'gradual')
        )
        
        # Try to start second update while first is in progress
        await asyncio.sleep(0.1)  # Let first update start
        
        result2 = await rolling_updater.perform_rolling_update(new_config, 'gradual')
        
        # Second update should be rejected
        assert result2['success'] is False
        assert 'already in progress' in result2['error'].lower()
        
        # Wait for first update to complete
        result1 = await update_task
        assert result1['success'] is True
    
    @pytest.mark.asyncio
    async def test_update_with_insufficient_nodes(self, new_config):
        """Test update with insufficient nodes"""
        # Create load balancer with only one node
        lb = LoadBalancer()
        node = DeploymentNode(
            node_id='single_node',
            host='localhost',
            port=8000,
            status='active',
            current_connections=0,
            max_connections=100,
            current_load_percent=0.0,
            last_health_check=time.time(),
            model_config=None,
            performance_metrics={}
        )
        lb.add_node(node)
        
        updater = RollingUpdateManager(lb)
        
        # Canary deployment should fail with insufficient nodes
        result = await updater.perform_rolling_update(new_config, 'canary')
        assert result['success'] is False
        assert 'requires at least 2' in result['error'].lower()


class TestProductionDeploymentSystem:
    """Test main production deployment system"""
    
    @pytest.fixture
    def deployment_system(self):
        """Create production deployment system for testing"""
        return ProductionDeploymentSystem()
    
    @pytest.mark.asyncio
    async def test_deployment_initialization(self, deployment_system):
        """Test deployment system initialization"""
        hardware_profile = {
            'gpu_available': True,
            'gpu_memory_gb': 4.0,
            'cpu_cores': 4,
            'memory_gb': 8.0
        }
        
        performance_requirements = {
            'max_inference_time_ms': 16.0,
            'min_throughput_per_sec': 100.0
        }
        
        result = await deployment_system.initialize_deployment(
            DeploymentEnvironment.PRODUCTION,
            hardware_profile,
            performance_requirements,
            initial_node_count=3
        )
        
        assert result['success'] is True
        assert result['environment'] == 'production'
        assert 'configuration' in result
        assert result['initial_nodes'] == 3
        
        # Verify nodes were created
        status = deployment_system.get_deployment_status()
        assert status['system_metrics']['total_nodes'] == 3
        assert status['system_metrics']['active_nodes'] == 3
    
    @pytest.mark.asyncio
    async def test_handle_inference_request(self, deployment_system):
        """Test handling inference requests through load balancer"""
        # Initialize deployment first
        await deployment_system.initialize_deployment(
            DeploymentEnvironment.DEVELOPMENT,
            {'gpu_available': False, 'cpu_cores': 2, 'memory_gb': 4.0},
            {'max_inference_time_ms': 50.0, 'min_throughput_per_sec': 20.0},
            initial_node_count=2
        )
        
        # Handle inference request
        request_data = {
            'input_features': [1.0, 2.0, 3.0],
            'metadata': {'priority': 'normal'}
        }
        
        result = await deployment_system.handle_inference_request(request_data)
        
        assert result['success'] is True
        assert 'node_id' in result
        assert 'processing_time_ms' in result
        assert result['processing_time_ms'] > 0
    
    @pytest.mark.asyncio
    async def test_auto_scaling_integration(self, deployment_system):
        """Test auto-scaling integration"""
        # Initialize deployment
        await deployment_system.initialize_deployment(
            DeploymentEnvironment.PRODUCTION,
            {'gpu_available': True, 'gpu_memory_gb': 4.0, 'cpu_cores': 4, 'memory_gb': 8.0},
            {'max_inference_time_ms': 16.0, 'min_throughput_per_sec': 100.0},
            initial_node_count=2
        )
        
        # Create metrics that trigger scale-up
        high_load_metrics = ScalingMetrics(
            timestamp=time.time(),
            total_requests_per_minute=600.0,
            average_response_time_ms=25.0,
            active_connections=150,
            cpu_utilization_percent=85.0,
            memory_utilization_percent=90.0,
            error_rate_percent=7.0,
            target_compliance_rate=0.6
        )
        
        result = await deployment_system.check_auto_scaling(high_load_metrics)
        
        assert result['action_taken'] is True
        assert result['direction'] == 'scale_up'
        assert 'scaling_result' in result
        
        # Verify nodes were added
        status = deployment_system.get_deployment_status()
        assert status['system_metrics']['total_nodes'] > 2
    
    @pytest.mark.asyncio
    async def test_rolling_update_integration(self, deployment_system):
        """Test rolling update integration"""
        # Initialize deployment
        await deployment_system.initialize_deployment(
            DeploymentEnvironment.STAGING,
            {'gpu_available': True, 'gpu_memory_gb': 2.0, 'cpu_cores': 2, 'memory_gb': 4.0},
            {'max_inference_time_ms': 20.0, 'min_throughput_per_sec': 50.0},
            initial_node_count=3
        )
        
        # Create new configuration
        new_config = ModelConfiguration(
            config_id='updated_config_001',
            name='Updated Configuration',
            description='Updated configuration for testing',
            quantization_enabled=True,
            gpu_acceleration=True,
            batch_size=32,
            memory_limit_mb=300,
            target_inference_time_ms=10.0,
            target_throughput_per_sec=150.0,
            hardware_requirements={'min_gpu_memory_gb': 2.0},
            optimization_level='aggressive'
        )
        
        # Perform rolling update
        result = await deployment_system.perform_rolling_update(new_config, 'gradual')
        
        assert result['success'] is True
        assert result['status'] == 'completed'
        
        # Verify configuration was updated
        assert deployment_system.current_config.config_id == 'updated_config_001'
    
    @pytest.mark.asyncio
    async def test_health_monitoring(self, deployment_system):
        """Test health monitoring functionality"""
        # Initialize deployment
        await deployment_system.initialize_deployment(
            DeploymentEnvironment.DEVELOPMENT,
            {'gpu_available': False, 'cpu_cores': 1, 'memory_gb': 2.0},
            {'max_inference_time_ms': 100.0, 'min_throughput_per_sec': 10.0},
            initial_node_count=2
        )
        
        # Health monitoring should be started automatically
        assert deployment_system.monitoring_active is True
        
        # Wait a moment for health checks
        await asyncio.sleep(0.1)
        
        # Stop health monitoring
        await deployment_system.stop_health_monitoring()
        assert deployment_system.monitoring_active is False
    
    def test_deployment_status(self, deployment_system):
        """Test deployment status reporting"""
        status = deployment_system.get_deployment_status()
        
        assert 'environment' in status
        assert 'load_balancer' in status
        assert 'auto_scaler' in status
        assert 'rolling_updater' in status
        assert 'health_monitoring' in status
        assert 'system_metrics' in status
        
        # Verify system metrics structure
        metrics = status['system_metrics']
        assert 'total_nodes' in metrics
        assert 'active_nodes' in metrics
        assert 'failed_nodes' in metrics
        assert 'updating_nodes' in metrics
    
    @pytest.mark.asyncio
    async def test_cleanup(self, deployment_system):
        """Test deployment system cleanup"""
        # Initialize deployment first
        await deployment_system.initialize_deployment(
            DeploymentEnvironment.TESTING,
            {'gpu_available': False, 'cpu_cores': 1, 'memory_gb': 2.0},
            {'max_inference_time_ms': 100.0, 'min_throughput_per_sec': 5.0},
            initial_node_count=1
        )
        
        # Verify system is running
        assert len(deployment_system.load_balancer.nodes) > 0
        assert deployment_system.monitoring_active is True
        
        # Cleanup
        await deployment_system.cleanup()
        
        # Verify cleanup
        assert len(deployment_system.load_balancer.nodes) == 0
        assert deployment_system.monitoring_active is False


# Integration test
@pytest.mark.asyncio
async def test_production_deployment_integration():
    """Comprehensive integration test for production deployment system"""
    
    deployment_system = ProductionDeploymentSystem()
    
    try:
        # Phase 1: Initialize production deployment
        hardware_profile = {
            'gpu_available': True,
            'gpu_memory_gb': 6.0,
            'cpu_cores': 6,
            'memory_gb': 12.0
        }
        
        performance_requirements = {
            'max_inference_time_ms': 16.0,
            'min_throughput_per_sec': 120.0
        }
        
        init_result = await deployment_system.initialize_deployment(
            DeploymentEnvironment.PRODUCTION,
            hardware_profile,
            performance_requirements,
            initial_node_count=3
        )
        
        assert init_result['success'] is True
        
        # Phase 2: Handle multiple inference requests
        request_results = []
        for i in range(10):
            request_data = {
                'input_features': [float(i), float(i+1), float(i+2)],
                'metadata': {'request_id': f'test_request_{i}'}
            }
            
            result = await deployment_system.handle_inference_request(request_data)
            request_results.append(result)
        
        # All requests should succeed
        assert all(r['success'] for r in request_results)
        
        # Phase 3: Simulate high load and trigger auto-scaling
        high_load_metrics = ScalingMetrics(
            timestamp=time.time(),
            total_requests_per_minute=800.0,
            average_response_time_ms=22.0,
            active_connections=200,
            cpu_utilization_percent=88.0,
            memory_utilization_percent=85.0,
            error_rate_percent=6.0,
            target_compliance_rate=0.65
        )
        
        scaling_result = await deployment_system.check_auto_scaling(high_load_metrics)
        assert scaling_result['action_taken'] is True
        assert scaling_result['direction'] == 'scale_up'
        
        # Phase 4: Perform rolling update
        new_config = ModelConfiguration(
            config_id='integration_test_config',
            name='Integration Test Config',
            description='Configuration for integration testing',
            quantization_enabled=True,
            gpu_acceleration=True,
            batch_size=24,
            memory_limit_mb=250,
            target_inference_time_ms=14.0,
            target_throughput_per_sec=140.0,
            hardware_requirements={'min_gpu_memory_gb': 4.0},
            optimization_level='balanced'
        )
        
        update_result = await deployment_system.perform_rolling_update(new_config, 'canary')
        assert update_result['success'] is True
        
        # Phase 5: Verify final system state
        final_status = deployment_system.get_deployment_status()
        
        assert final_status['environment'] == 'production'
        assert final_status['current_configuration']['config_id'] == 'integration_test_config'
        assert final_status['system_metrics']['active_nodes'] >= 3  # Should have scaled up
        assert final_status['health_monitoring']['active'] is True
        
        # Phase 6: Test scale-down with low load
        low_load_metrics = ScalingMetrics(
            timestamp=time.time(),
            total_requests_per_minute=30.0,
            average_response_time_ms=8.0,
            active_connections=15,
            cpu_utilization_percent=25.0,
            memory_utilization_percent=35.0,
            error_rate_percent=0.5,
            target_compliance_rate=0.98
        )
        
        # Set scaling action time to past to avoid cooldown
        deployment_system.auto_scaler.last_scaling_action = time.time() - 700.0
        
        scale_down_result = await deployment_system.check_auto_scaling(low_load_metrics)
        
        # May or may not scale down depending on min_nodes, but should not fail
        assert 'error' not in scale_down_result
        
        print("✅ Production Deployment Integration Test Completed Successfully!")
        print(f"   Final node count: {final_status['system_metrics']['active_nodes']}")
        print(f"   Configuration: {final_status['current_configuration']['name']}")
        print(f"   Load balancer strategy: {final_status['load_balancer']['strategy']}")
        
    finally:
        # Cleanup
        await deployment_system.cleanup()


if __name__ == '__main__':
    # Run basic tests
    print("Running Production Deployment System Tests...")
    
    # Test ModelConfigurationSelector
    selector = ModelConfigurationSelector()
    print("✓ ModelConfigurationSelector initialized")
    
    # Test LoadBalancer
    lb = LoadBalancer()
    print("✓ LoadBalancer initialized")
    
    # Test AutoScaler
    auto_scaler = AutoScaler(lb)
    print("✓ AutoScaler initialized")
    
    # Test RollingUpdateManager
    updater = RollingUpdateManager(lb)
    print("✓ RollingUpdateManager initialized")
    
    # Test ProductionDeploymentSystem
    deployment_system = ProductionDeploymentSystem()
    print("✓ ProductionDeploymentSystem initialized")
    
    print("\nAll basic tests passed! ✓")
    print("\nProduction Deployment System Features:")
    print("- Automatic optimal model configuration selection")
    print("- Intelligent load balancing with multiple strategies")
    print("- Auto-scaling based on performance metrics")
    print("- Rolling updates with canary and blue-green deployment")
    print("- Comprehensive health monitoring and status reporting")
    print("- Production-ready deployment orchestration")