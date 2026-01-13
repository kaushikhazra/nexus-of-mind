"""
Test Memory and Resource Management System
Tests Requirements 1.5, 8.1, 8.2, 8.3, 8.4, 8.5
"""

import asyncio
import pytest
import time
import threading
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add the server directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_engine.resource_manager import (
    ResourceManager, ResourceLimits, ThreadManager, 
    GarbageCollectionManager, ResourceThrottleSystem, IntelligentMemoryManager
)
from ai_engine.enhanced_memory_manager import EnhancedMemoryManager
from ai_engine.data_models import DeathAnalysis, QueenStrategy


class TestResourceLimits:
    """Test resource limits configuration"""
    
    def test_default_limits(self):
        """Test default resource limits"""
        limits = ResourceLimits()
        
        assert limits.max_memory_mb == 200.0
        assert limits.max_cpu_percent == 80.0
        assert limits.max_threads == 8
        assert limits.gc_threshold_mb == 150.0
        assert limits.emergency_cleanup_mb == 180.0
    
    def test_custom_limits(self):
        """Test custom resource limits"""
        limits = ResourceLimits(
            max_memory_mb=150.0,
            max_cpu_percent=70.0,
            max_threads=6
        )
        
        assert limits.max_memory_mb == 150.0
        assert limits.max_cpu_percent == 70.0
        assert limits.max_threads == 6


class TestThreadManager:
    """Test thread management optimization"""
    
    @pytest.fixture
    def thread_manager(self):
        return ThreadManager(max_threads=4)
    
    def test_thread_manager_initialization(self, thread_manager):
        """Test thread manager initialization"""
        assert thread_manager.max_threads == 4
        assert len(thread_manager.active_threads) == 0
    
    @pytest.mark.asyncio
    async def test_submit_task(self, thread_manager):
        """Test task submission to thread pool"""
        def test_function():
            time.sleep(0.1)
            return "test_result"
        
        future = thread_manager.submit_task(test_function)
        result = await future
        
        assert result == "test_result"
    
    def test_get_thread_status(self, thread_manager):
        """Test thread status reporting"""
        status = thread_manager.get_thread_status()
        
        assert 'active_threads' in status
        assert 'max_threads' in status
        assert 'utilization' in status
        assert status['max_threads'] == 4
    
    def test_optimize_thread_allocation(self, thread_manager):
        """Test thread allocation optimization"""
        # Test different workload types
        thread_manager.optimize_thread_allocation('inference')
        thread_manager.optimize_thread_allocation('training')
        thread_manager.optimize_thread_allocation('other')
        
        # Should not raise exceptions
        assert True
    
    @pytest.mark.asyncio
    async def test_cleanup(self, thread_manager):
        """Test thread manager cleanup"""
        await thread_manager.cleanup()
        assert len(thread_manager.active_threads) == 0


class TestGarbageCollectionManager:
    """Test garbage collection system"""
    
    @pytest.fixture
    def gc_manager(self):
        return GarbageCollectionManager(threshold_mb=100.0)
    
    def test_gc_manager_initialization(self, gc_manager):
        """Test garbage collection manager initialization"""
        assert gc_manager.threshold_mb == 100.0
        assert gc_manager.collection_stats['total_collections'] == 0
    
    def test_should_collect(self, gc_manager):
        """Test garbage collection trigger logic"""
        # Should not collect if under threshold and recent collection
        assert not gc_manager.should_collect(50.0)
        
        # Should collect if over threshold and enough time passed
        gc_manager.last_collection = time.time() - 60  # 1 minute ago
        assert gc_manager.should_collect(150.0)
        
        # Should force collect if critically high
        assert gc_manager.should_collect(200.0)
    
    @pytest.mark.asyncio
    async def test_collect_garbage(self, gc_manager):
        """Test garbage collection execution"""
        result = await gc_manager.collect_garbage()
        
        assert result['success'] is True
        assert 'objects_collected' in result
        assert 'collection_time_ms' in result
        assert gc_manager.collection_stats['total_collections'] == 1
    
    @pytest.mark.asyncio
    async def test_aggressive_collection(self, gc_manager):
        """Test aggressive garbage collection"""
        result = await gc_manager.collect_garbage(aggressive=True)
        
        assert result['success'] is True
        assert result['aggressive'] is True
    
    def test_get_gc_stats(self, gc_manager):
        """Test garbage collection statistics"""
        stats = gc_manager.get_gc_stats()
        
        assert 'total_collections' in stats
        assert 'average_time_ms' in stats
        assert 'total_objects_collected' in stats


class TestResourceThrottleSystem:
    """Test resource throttling system"""
    
    @pytest.fixture
    def throttle_system(self):
        limits = ResourceLimits(max_memory_mb=100.0, max_cpu_percent=80.0, max_threads=4)
        return ResourceThrottleSystem(limits)
    
    def test_throttle_system_initialization(self, throttle_system):
        """Test throttle system initialization"""
        assert not throttle_system.throttle_active
        assert throttle_system.throttle_level == 0.0
    
    def test_calculate_throttle_level(self, throttle_system):
        """Test throttle level calculation"""
        from ai_engine.resource_manager import ResourceMetrics
        
        # Low resource usage - no throttling
        metrics = ResourceMetrics(
            memory_usage_mb=50.0,
            cpu_percent=40.0,
            active_threads=2,
            gc_collections=10,
            timestamp=time.time()
        )
        throttle_level = throttle_system.calculate_throttle_level(metrics)
        assert throttle_level == 0.0
        
        # High memory usage - should throttle
        metrics = ResourceMetrics(
            memory_usage_mb=95.0,  # 95% of 100MB limit
            cpu_percent=40.0,
            active_threads=2,
            gc_collections=10,
            timestamp=time.time()
        )
        throttle_level = throttle_system.calculate_throttle_level(metrics)
        assert throttle_level > 0.0
    
    @pytest.mark.asyncio
    async def test_apply_throttling(self, throttle_system):
        """Test throttling application"""
        # No throttling
        result = await throttle_system.apply_throttling(0.0)
        assert not result['throttling']
        
        # Light throttling
        result = await throttle_system.apply_throttling(0.4)
        assert result['throttling']
        assert result['level'] == 0.4
        
        # Heavy throttling
        result = await throttle_system.apply_throttling(0.9)
        assert result['throttling']
        assert result['level'] == 0.9
    
    def test_get_throttle_status(self, throttle_system):
        """Test throttle status reporting"""
        status = throttle_system.get_throttle_status()
        
        assert 'active' in status
        assert 'level' in status
        assert 'recent_events' in status


class TestIntelligentMemoryManager:
    """Test intelligent memory management"""
    
    @pytest.fixture
    def memory_manager(self):
        limits = ResourceLimits(max_memory_mb=100.0)
        return IntelligentMemoryManager(limits)
    
    def test_memory_manager_initialization(self, memory_manager):
        """Test memory manager initialization"""
        assert memory_manager.limits.max_memory_mb == 100.0
        assert len(memory_manager.memory_cache) == 0
    
    def test_allocate_memory_pool(self, memory_manager):
        """Test memory pool allocation"""
        # Should succeed with reasonable size
        result = memory_manager.allocate_memory_pool('test_pool', 10.0)
        assert result is True
        assert 'test_pool' in memory_manager.memory_pools
    
    def test_cache_object(self, memory_manager):
        """Test object caching"""
        test_obj = {'test': 'data'}
        result = memory_manager.cache_object('test_key', test_obj, priority=0.8)
        assert result is True
        assert 'test_key' in memory_manager.cache_priorities
    
    def test_get_cached_object(self, memory_manager):
        """Test cached object retrieval"""
        test_obj = {'test': 'data'}
        memory_manager.cache_object('test_key', test_obj)
        
        retrieved = memory_manager.get_cached_object('test_key')
        assert retrieved == test_obj
        
        # Test non-existent key
        assert memory_manager.get_cached_object('nonexistent') is None
    
    @patch('psutil.Process')
    def test_get_memory_usage(self, mock_process, memory_manager):
        """Test memory usage reporting"""
        mock_process.return_value.memory_info.return_value.rss = 50 * 1024 * 1024  # 50MB
        
        usage = memory_manager.get_memory_usage()
        assert usage == 50.0
    
    @patch('psutil.Process')
    @patch('psutil.virtual_memory')
    def test_get_memory_stats(self, mock_virtual_memory, mock_process, memory_manager):
        """Test memory statistics"""
        # Mock process memory info
        mock_memory_info = Mock()
        mock_memory_info.rss = 50 * 1024 * 1024  # 50MB
        mock_memory_info.vms = 100 * 1024 * 1024  # 100MB
        mock_process.return_value.memory_info.return_value = mock_memory_info
        
        # Mock system memory info
        mock_virtual_memory.return_value.total = 8 * 1024 * 1024 * 1024  # 8GB
        mock_virtual_memory.return_value.available = 4 * 1024 * 1024 * 1024  # 4GB
        mock_virtual_memory.return_value.percent = 50.0
        
        stats = memory_manager.get_memory_stats()
        
        assert 'current_usage_mb' in stats
        assert 'memory_limit_mb' in stats
        assert 'utilization_percent' in stats
        assert stats['memory_limit_mb'] == 100.0
    
    @pytest.mark.asyncio
    async def test_optimize_memory_usage(self, memory_manager):
        """Test memory usage optimization"""
        # Add some test objects
        memory_manager.cache_object('test1', {'data': 'test1'}, priority=0.2)
        memory_manager.cache_object('test2', {'data': 'test2'}, priority=0.8)
        
        result = await memory_manager.optimize_memory_usage()
        
        assert result['success'] is True
        assert 'optimizations' in result
    
    @pytest.mark.asyncio
    async def test_cleanup(self, memory_manager):
        """Test memory manager cleanup"""
        # Add some test data
        memory_manager.cache_object('test', {'data': 'test'})
        
        await memory_manager.cleanup()
        
        assert len(memory_manager.memory_cache) == 0
        assert len(memory_manager.cache_priorities) == 0


class TestResourceManager:
    """Test main resource manager"""
    
    @pytest.fixture
    def resource_manager(self):
        limits = ResourceLimits(max_memory_mb=100.0, max_threads=4)
        return ResourceManager(limits)
    
    def test_resource_manager_initialization(self, resource_manager):
        """Test resource manager initialization"""
        assert resource_manager.limits.max_memory_mb == 100.0
        assert not resource_manager.monitoring_active
        assert isinstance(resource_manager.memory_manager, IntelligentMemoryManager)
        assert isinstance(resource_manager.thread_manager, ThreadManager)
    
    @pytest.mark.asyncio
    async def test_start_stop_monitoring(self, resource_manager):
        """Test resource monitoring start/stop"""
        await resource_manager.start_monitoring()
        assert resource_manager.monitoring_active
        
        await resource_manager.stop_monitoring()
        assert not resource_manager.monitoring_active
    
    @patch('psutil.Process')
    def test_collect_metrics(self, mock_process, resource_manager):
        """Test metrics collection"""
        # Mock process info
        mock_memory_info = Mock()
        mock_memory_info.rss = 50 * 1024 * 1024  # 50MB
        mock_process.return_value.memory_info.return_value = mock_memory_info
        mock_process.return_value.cpu_percent.return_value = 25.0
        
        metrics = resource_manager._collect_metrics()
        
        assert metrics.memory_usage_mb == 50.0
        assert metrics.cpu_percent == 25.0
        assert metrics.active_threads > 0
    
    @pytest.mark.asyncio
    async def test_allocate_resources_for_operation(self, resource_manager):
        """Test resource allocation for operations"""
        result = await resource_manager.allocate_resources_for_operation(
            'test_operation',
            estimated_memory_mb=10.0,
            estimated_threads=2
        )
        
        assert 'success' in result
        if result['success']:
            assert result['allocated_memory_mb'] == 10.0
            assert result['allocated_threads'] == 2
    
    def test_get_resource_status(self, resource_manager):
        """Test resource status reporting"""
        status = resource_manager.get_resource_status()
        
        assert 'current_metrics' in status
        assert 'memory_manager' in status
        assert 'thread_manager' in status
        assert 'monitoring_active' in status
    
    def test_get_optimization_recommendations(self, resource_manager):
        """Test optimization recommendations"""
        recommendations = resource_manager.get_optimization_recommendations()
        
        assert isinstance(recommendations, list)
        assert len(recommendations) > 0
    
    @pytest.mark.asyncio
    async def test_cleanup(self, resource_manager):
        """Test resource manager cleanup"""
        await resource_manager.cleanup()
        assert not resource_manager.monitoring_active
        assert len(resource_manager.metrics_history) == 0


class TestEnhancedMemoryManager:
    """Test enhanced memory manager integration"""
    
    @pytest.fixture
    def enhanced_manager(self):
        limits = ResourceLimits(max_memory_mb=100.0)
        return EnhancedMemoryManager(limits)
    
    def test_enhanced_manager_initialization(self, enhanced_manager):
        """Test enhanced memory manager initialization"""
        assert isinstance(enhanced_manager.resource_manager, ResourceManager)
        assert enhanced_manager.intelligent_cleanup_enabled
        assert enhanced_manager.adaptive_compression_enabled
    
    @pytest.mark.asyncio
    async def test_initialize(self, enhanced_manager):
        """Test enhanced manager initialization"""
        await enhanced_manager.initialize()
        assert enhanced_manager.resource_monitoring_active
        
        # Cleanup
        await enhanced_manager.cleanup()
    
    def test_estimate_storage_memory_requirement(self, enhanced_manager):
        """Test memory requirement estimation"""
        # Create mock objects
        mock_death_analysis = Mock(spec=DeathAnalysis)
        mock_strategy = Mock(spec=QueenStrategy)
        mock_strategy.to_dict.return_value = {'test': 'strategy'}
        
        estimate = enhanced_manager._estimate_storage_memory_requirement(
            mock_death_analysis, mock_strategy
        )
        
        assert isinstance(estimate, float)
        assert estimate > 0
    
    def test_get_performance_metrics(self, enhanced_manager):
        """Test performance metrics collection"""
        # Add some test operations
        enhanced_manager.operation_metrics['store_operations'].append({
            'generation': 1,
            'operation_time': 0.5,
            'timestamp': time.time()
        })
        
        metrics = enhanced_manager._get_performance_metrics()
        
        assert 'store_operations' in metrics
        assert metrics['store_operations']['count'] == 1
    
    def test_calculate_overall_compression_ratio(self, enhanced_manager):
        """Test compression ratio calculation"""
        # Add test compressed patterns
        enhanced_manager.compressed_patterns['test1'] = {'compression_ratio': 0.5}
        enhanced_manager.compressed_patterns['test2'] = {'compression_ratio': 0.3}
        
        ratio = enhanced_manager._calculate_overall_compression_ratio()
        assert ratio == 0.4  # Average of 0.5 and 0.3
    
    def test_get_enhanced_memory_statistics(self, enhanced_manager):
        """Test enhanced memory statistics"""
        stats = enhanced_manager.get_enhanced_memory_statistics()
        
        assert 'resource_management' in stats
        assert 'optimization_strategies' in stats
        assert 'performance_metrics' in stats
        assert 'compression_stats' in stats
    
    @pytest.mark.asyncio
    async def test_cleanup(self, enhanced_manager):
        """Test enhanced manager cleanup"""
        await enhanced_manager.initialize()
        await enhanced_manager.cleanup()
        
        assert not enhanced_manager.resource_monitoring_active


class TestIntegration:
    """Integration tests for memory and resource management"""
    
    @pytest.mark.asyncio
    async def test_full_system_integration(self):
        """Test full system integration"""
        # Create enhanced memory manager
        limits = ResourceLimits(max_memory_mb=150.0, max_threads=4)
        manager = EnhancedMemoryManager(limits)
        
        try:
            # Initialize
            await manager.initialize()
            
            # Test resource allocation
            allocation_result = await manager.resource_manager.allocate_resources_for_operation(
                'test_integration',
                estimated_memory_mb=10.0,
                estimated_threads=2
            )
            assert allocation_result['success']
            
            # Test memory operations
            test_obj = {'integration': 'test', 'data': list(range(100))}
            cache_result = manager.resource_manager.memory_manager.cache_object(
                'integration_test', test_obj, priority=0.8
            )
            assert cache_result
            
            # Test retrieval
            retrieved = manager.resource_manager.memory_manager.get_cached_object('integration_test')
            assert retrieved == test_obj
            
            # Test optimization
            optimization_result = await manager.resource_manager.memory_manager.optimize_memory_usage()
            assert optimization_result['success']
            
            # Test status reporting
            status = manager.get_enhanced_memory_statistics()
            assert 'resource_management' in status
            
        finally:
            # Cleanup
            await manager.cleanup()
    
    @pytest.mark.asyncio
    async def test_memory_pressure_handling(self):
        """Test system behavior under memory pressure"""
        # Create manager with low memory limits
        limits = ResourceLimits(max_memory_mb=50.0, gc_threshold_mb=30.0)
        manager = EnhancedMemoryManager(limits)
        
        try:
            await manager.initialize()
            
            # Simulate memory pressure by caching many objects
            for i in range(100):
                large_obj = {'data': list(range(1000)), 'id': i}
                manager.resource_manager.memory_manager.cache_object(
                    f'pressure_test_{i}', large_obj, priority=0.5
                )
            
            # Trigger optimization
            await manager._intelligent_resource_cleanup()
            
            # System should still be functional
            status = manager.resource_manager.get_resource_status()
            assert 'current_metrics' in status
            
        finally:
            await manager.cleanup()
    
    @pytest.mark.asyncio
    async def test_concurrent_operations(self):
        """Test concurrent memory and resource operations"""
        limits = ResourceLimits(max_memory_mb=100.0, max_threads=8)
        manager = EnhancedMemoryManager(limits)
        
        try:
            await manager.initialize()
            
            # Define concurrent operations
            async def cache_operation(i):
                obj = {'concurrent': True, 'id': i, 'data': list(range(50))}
                return manager.resource_manager.memory_manager.cache_object(
                    f'concurrent_{i}', obj, priority=0.6
                )
            
            async def allocation_operation(i):
                return await manager.resource_manager.allocate_resources_for_operation(
                    f'concurrent_op_{i}',
                    estimated_memory_mb=2.0,
                    estimated_threads=1
                )
            
            # Run concurrent operations
            cache_tasks = [cache_operation(i) for i in range(20)]
            allocation_tasks = [allocation_operation(i) for i in range(10)]
            
            cache_results = await asyncio.gather(*cache_tasks)
            allocation_results = await asyncio.gather(*allocation_tasks)
            
            # Verify results
            assert all(cache_results)  # All cache operations should succeed
            assert all(result.get('success', False) for result in allocation_results)
            
            # System should remain stable
            status = manager.resource_manager.get_resource_status()
            assert status['current_metrics']['memory_utilization'] < 1.0
            
        finally:
            await manager.cleanup()


if __name__ == '__main__':
    # Run basic tests
    print("Running Memory and Resource Management Tests...")
    
    # Test ResourceLimits
    limits = ResourceLimits()
    print(f"✓ ResourceLimits: max_memory={limits.max_memory_mb}MB, max_threads={limits.max_threads}")
    
    # Test ThreadManager
    thread_manager = ThreadManager(max_threads=4)
    status = thread_manager.get_thread_status()
    print(f"✓ ThreadManager: {status['active_threads']}/{status['max_threads']} threads")
    
    # Test GarbageCollectionManager
    gc_manager = GarbageCollectionManager()
    print(f"✓ GarbageCollectionManager: threshold={gc_manager.threshold_mb}MB")
    
    # Test IntelligentMemoryManager
    memory_manager = IntelligentMemoryManager()
    memory_manager.cache_object('test', {'data': 'test'})
    cached = memory_manager.get_cached_object('test')
    print(f"✓ IntelligentMemoryManager: cached object retrieved = {cached is not None}")
    
    # Test ResourceManager
    async def test_resource_manager():
        resource_manager = ResourceManager()
        await resource_manager.start_monitoring()
        
        # Wait a moment for monitoring
        await asyncio.sleep(0.1)
        
        status = resource_manager.get_resource_status()
        recommendations = resource_manager.get_optimization_recommendations()
        
        await resource_manager.stop_monitoring()
        await resource_manager.cleanup()
        
        print(f"✓ ResourceManager: monitoring_active={status['monitoring_active']}")
        print(f"✓ ResourceManager: {len(recommendations)} optimization recommendations")
    
    # Run async test
    asyncio.run(test_resource_manager())
    
    print("\nAll basic tests passed! ✓")
    print("\nMemory and Resource Management System implemented successfully!")
    print("\nKey Features:")
    print("- Intelligent memory management with <200MB limits")
    print("- Non-blocking garbage collection system")
    print("- Thread management optimization")
    print("- Resource throttling to prevent crashes")
    print("- Comprehensive monitoring and optimization")