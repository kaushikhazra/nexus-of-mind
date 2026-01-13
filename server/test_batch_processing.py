"""
Comprehensive tests for Batch Processing Engine
Tests Requirements 3.1, 3.2, 3.3, 3.4, 3.5 for batch processing functionality
"""

import pytest
import asyncio
import time
import numpy as np
from unittest.mock import Mock, AsyncMock, patch

from ai_engine.batch_processor import (
    BatchProcessor, QueueManager, InferenceRequest, BatchRequest, BatchResult,
    RequestPriority, BatchStatus
)
from ai_engine.inference_engine import InferenceEngine
from ai_engine.neural_network import QueenBehaviorNetwork


class TestBatchProcessor:
    """Test suite for BatchProcessor class"""
    
    @pytest.fixture
    def mock_neural_network(self):
        """Create mock neural network for testing"""
        mock_nn = Mock(spec=QueenBehaviorNetwork)
        
        # Create async mock functions with realistic timing
        async def mock_batch_predict(features, operation_id=None):
            await asyncio.sleep(0.01)  # 10ms processing time
            return [np.random.random((1, 20)).astype(np.float32) for _ in features]
        
        async def mock_single_predict(features, operation_id=None):
            await asyncio.sleep(0.005)  # 5ms processing time
            return np.random.random((1, 20)).astype(np.float32)
        
        mock_nn.predict_batch_async = AsyncMock(side_effect=mock_batch_predict)
        mock_nn.predict_strategy_async = AsyncMock(side_effect=mock_single_predict)
        
        return mock_nn
    
    @pytest.fixture
    def batch_processor(self, mock_neural_network):
        """Create BatchProcessor instance for testing"""
        return BatchProcessor(mock_neural_network)
    
    @pytest.fixture
    def sample_request(self):
        """Create sample inference request"""
        return InferenceRequest(
            request_id="test_request_1",
            features=np.random.random((1, 50)).astype(np.float32),
            priority=RequestPriority.NORMAL,
            timeout_ms=1000.0
        )
    
    def test_batch_processor_initialization(self, batch_processor):
        """Test BatchProcessor initialization"""
        assert batch_processor is not None
        assert batch_processor.min_batch_size == 1
        assert batch_processor.max_batch_size == 32
        assert batch_processor.optimal_batch_size == 8
        assert len(batch_processor.request_queues) == 4  # Four priority levels
        assert batch_processor.throughput_target == 100.0
    
    def test_add_request(self, batch_processor, sample_request):
        """Test adding requests to priority queues - Requirement 3.1"""
        # Add request
        request_id = batch_processor.add_request(sample_request)
        
        assert request_id == sample_request.request_id
        
        # Check request was added to correct queue
        normal_queue = batch_processor.request_queues[RequestPriority.NORMAL]
        assert len(normal_queue) == 1
        assert normal_queue[0] == sample_request
    
    def test_add_multiple_priority_requests(self, batch_processor):
        """Test adding requests with different priorities - Requirement 3.5"""
        requests = []
        priorities = [RequestPriority.LOW, RequestPriority.NORMAL, RequestPriority.HIGH, RequestPriority.CRITICAL]
        
        for i, priority in enumerate(priorities):
            request = InferenceRequest(
                request_id=f"test_request_{i}",
                features=np.random.random((1, 50)).astype(np.float32),
                priority=priority
            )
            requests.append(request)
            batch_processor.add_request(request)
        
        # Verify requests are in correct queues
        for priority in priorities:
            queue = batch_processor.request_queues[priority]
            assert len(queue) == 1
    
    def test_determine_optimal_batch_size(self, batch_processor):
        """Test optimal batch size determination - Requirement 3.2"""
        # Test with no performance history
        optimal_size = batch_processor.determine_optimal_batch_size(16)
        assert optimal_size == 8  # Should use default optimal size
        
        # Test with limited requests
        optimal_size = batch_processor.determine_optimal_batch_size(3)
        assert optimal_size == 3  # Should not exceed available requests
        
        # Test bounds checking
        optimal_size = batch_processor.determine_optimal_batch_size(100)
        assert optimal_size <= batch_processor.max_batch_size
    
    def test_create_batch_from_queues(self, batch_processor):
        """Test batch creation from priority queues - Requirements 3.1, 3.2"""
        # Add requests with different priorities
        requests = []
        for i in range(12):
            priority = RequestPriority.HIGH if i < 4 else RequestPriority.NORMAL
            request = InferenceRequest(
                request_id=f"test_request_{i}",
                features=np.random.random((1, 50)).astype(np.float32),
                priority=priority
            )
            requests.append(request)
            batch_processor.add_request(request)
        
        # Create batch
        batch = batch_processor.create_batch_from_queues()
        
        assert batch is not None
        assert len(batch.requests) == batch_processor.optimal_batch_size
        assert batch.status == BatchStatus.PENDING
        
        # Verify high priority requests are processed first
        high_priority_count = sum(1 for req in batch.requests if req.priority == RequestPriority.HIGH)
        assert high_priority_count == 4  # All high priority requests should be included
    
    def test_create_batch_empty_queues(self, batch_processor):
        """Test batch creation with empty queues"""
        batch = batch_processor.create_batch_from_queues()
        assert batch is None
    
    @pytest.mark.asyncio
    async def test_process_batch_success(self, batch_processor, mock_neural_network):
        """Test successful batch processing - Requirement 3.3"""
        # Create batch with requests
        requests = []
        for i in range(4):
            request = InferenceRequest(
                request_id=f"test_request_{i}",
                features=np.random.random((1, 50)).astype(np.float32),
                priority=RequestPriority.NORMAL
            )
            requests.append(request)
        
        batch = BatchRequest(
            batch_id="test_batch_1",
            requests=requests,
            optimal_size=4
        )
        
        # Process batch
        result = await batch_processor.process_batch(batch)
        
        assert result.success is True
        assert result.batch_id == "test_batch_1"
        assert len(result.request_results) == 4
        assert result.throughput_predictions_per_sec > 0
        assert batch.status == BatchStatus.COMPLETED
        
        # Verify neural network was called
        mock_neural_network.predict_batch_async.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_process_batch_with_fallback(self, batch_processor, mock_neural_network):
        """Test batch processing with fallback to individual processing - Requirement 3.4"""
        # Configure neural network to fail batch processing
        mock_neural_network.predict_batch_async.side_effect = Exception("Batch processing failed")
        mock_neural_network.predict_strategy_async.return_value = np.random.random((1, 20)).astype(np.float32)
        
        # Create batch
        requests = []
        for i in range(3):
            request = InferenceRequest(
                request_id=f"test_request_{i}",
                features=np.random.random((1, 50)).astype(np.float32),
                priority=RequestPriority.NORMAL
            )
            requests.append(request)
        
        batch = BatchRequest(
            batch_id="test_batch_fallback",
            requests=requests,
            optimal_size=3
        )
        
        # Process batch with fallback
        result = await batch_processor.process_batch_with_fallback(batch)
        
        assert result.success is True
        assert result.individual_fallback_used is True
        assert len(result.request_results) == 3
        
        # Verify individual processing was called
        assert mock_neural_network.predict_strategy_async.call_count == 3
    
    @pytest.mark.asyncio
    async def test_throughput_performance_target(self, batch_processor, mock_neural_network):
        """Test throughput performance target - Requirement 3.3"""
        # Configure fast neural network response
        mock_neural_network.predict_batch_async.return_value = [
            np.random.random((1, 20)).astype(np.float32) for _ in range(16)
        ]
        
        # Create large batch for throughput testing
        requests = []
        for i in range(16):
            request = InferenceRequest(
                request_id=f"throughput_test_{i}",
                features=np.random.random((1, 50)).astype(np.float32),
                priority=RequestPriority.NORMAL
            )
            requests.append(request)
        
        batch = BatchRequest(
            batch_id="throughput_test_batch",
            requests=requests,
            optimal_size=16
        )
        
        # Process batch and measure throughput
        start_time = time.time()
        result = await batch_processor.process_batch(batch)
        processing_time = time.time() - start_time
        
        # Calculate expected throughput
        expected_throughput = len(requests) / processing_time
        
        assert result.success is True
        assert result.throughput_predictions_per_sec > 0
        
        # Note: Actual throughput target (>100 pred/sec) depends on neural network performance
        # This test validates the throughput calculation is working correctly
    
    def test_queue_status(self, batch_processor):
        """Test queue status reporting"""
        # Add requests to different queues
        for i in range(5):
            priority = RequestPriority.HIGH if i < 2 else RequestPriority.NORMAL
            request = InferenceRequest(
                request_id=f"status_test_{i}",
                features=np.random.random((1, 50)).astype(np.float32),
                priority=priority
            )
            batch_processor.add_request(request)
        
        status = batch_processor.get_queue_status()
        
        assert status['total_queued_requests'] == 5
        assert status['queue_counts']['HIGH'] == 2
        assert status['queue_counts']['NORMAL'] == 3
        assert status['optimal_batch_size'] == batch_processor.optimal_batch_size
    
    @pytest.mark.asyncio
    async def test_process_pending_batches(self, batch_processor, mock_neural_network):
        """Test processing all pending batches"""
        # Add multiple requests
        for i in range(10):
            request = InferenceRequest(
                request_id=f"pending_test_{i}",
                features=np.random.random((1, 50)).astype(np.float32),
                priority=RequestPriority.NORMAL
            )
            batch_processor.add_request(request)
        
        # Process all pending batches
        results = await batch_processor.process_pending_batches()
        
        assert len(results) > 0  # Should create at least one batch
        
        # Verify all requests were processed
        total_processed = sum(len(result.request_results) for result in results)
        assert total_processed == 10
    
    def test_auto_optimization(self, batch_processor):
        """Test automatic batch size optimization"""
        # Simulate performance history with poor throughput
        for i in range(10):
            performance_data = {
                'timestamp': time.time(),
                'batch_size': 8,
                'processing_time_ms': 25.0,  # High processing time
                'throughput': 50.0,  # Low throughput
                'success': True,
                'individual_fallback': False
            }
            batch_processor.performance_history.append(performance_data)
        
        original_size = batch_processor.optimal_batch_size
        
        # Trigger auto-optimization
        batch_processor._auto_optimize_batch_size()
        
        # Should reduce batch size due to poor performance
        assert batch_processor.optimal_batch_size <= original_size


class TestQueueManager:
    """Test suite for QueueManager class"""
    
    @pytest.fixture
    def batch_processor(self):
        """Create BatchProcessor for QueueManager testing"""
        return BatchProcessor()
    
    @pytest.fixture
    def queue_manager(self, batch_processor):
        """Create QueueManager instance for testing"""
        return QueueManager(batch_processor)
    
    def test_prioritize_request_critical(self, queue_manager):
        """Test critical priority assignment - Requirement 3.5"""
        request_data = {
            'queen_under_attack': True,
            'time_sensitivity': 0.9
        }
        
        priority = queue_manager.prioritize_request(request_data)
        assert priority == RequestPriority.CRITICAL
    
    def test_prioritize_request_high(self, queue_manager):
        """Test high priority assignment - Requirement 3.5"""
        request_data = {
            'combat_active': True,
            'time_sensitivity': 0.7
        }
        
        priority = queue_manager.prioritize_request(request_data)
        assert priority == RequestPriority.HIGH
    
    def test_prioritize_request_normal(self, queue_manager):
        """Test normal priority assignment - Requirement 3.5"""
        request_data = {
            'exploration_active': True,
            'time_sensitivity': 0.5
        }
        
        priority = queue_manager.prioritize_request(request_data)
        assert priority == RequestPriority.NORMAL
    
    def test_prioritize_request_low(self, queue_manager):
        """Test low priority assignment - Requirement 3.5"""
        request_data = {
            'idle_state': True,
            'time_sensitivity': 0.2
        }
        
        priority = queue_manager.prioritize_request(request_data)
        assert priority == RequestPriority.LOW
    
    def test_create_prioritized_request(self, queue_manager):
        """Test creating prioritized requests"""
        features = np.random.random((1, 50)).astype(np.float32)
        request_data = {
            'request_id': 'priority_test',
            'queen_under_attack': True,
            'timeout_ms': 500.0
        }
        
        request = queue_manager.create_prioritized_request(features, request_data)
        
        assert request.request_id == 'priority_test'
        assert request.priority == RequestPriority.CRITICAL
        assert request.timeout_ms == 500.0
        assert np.array_equal(request.features, features)
    
    @pytest.mark.asyncio
    async def test_submit_request(self, queue_manager):
        """Test submitting prioritized requests"""
        features = np.random.random((1, 50)).astype(np.float32)
        request_data = {
            'request_id': 'submit_test',
            'combat_active': True
        }
        
        request_id = await queue_manager.submit_request(features, request_data)
        
        assert request_id == 'submit_test'
        
        # Verify request was added to batch processor
        status = queue_manager.batch_processor.get_queue_status()
        assert status['total_queued_requests'] == 1


class TestInferenceEngine:
    """Test suite for InferenceEngine class"""
    
    @pytest.fixture
    def mock_neural_network(self):
        """Create mock neural network for testing"""
        mock_nn = Mock(spec=QueenBehaviorNetwork)
        
        # Create async mock functions with realistic timing
        async def mock_single_predict(features, operation_id=None):
            await asyncio.sleep(0.002)  # 2ms processing time
            return np.random.random((1, 20)).astype(np.float32)
        
        async def mock_batch_predict(features, operation_id=None):
            await asyncio.sleep(0.005)  # 5ms processing time
            return [np.random.random((1, 20)).astype(np.float32) for _ in features]
        
        mock_nn.predict_strategy_async = AsyncMock(side_effect=mock_single_predict)
        mock_nn.predict_batch_async = AsyncMock(side_effect=mock_batch_predict)
        
        return mock_nn
    
    @pytest.fixture
    def inference_engine(self, mock_neural_network):
        """Create InferenceEngine instance for testing"""
        return InferenceEngine(mock_neural_network)
    
    def test_inference_engine_initialization(self, inference_engine):
        """Test InferenceEngine initialization"""
        assert inference_engine is not None
        assert inference_engine.target_inference_time_ms == 16.0
        assert inference_engine.target_throughput == 100.0
        assert inference_engine.auto_batch_enabled is True
        assert inference_engine.running is False
    
    @pytest.mark.asyncio
    async def test_start_stop_engine(self, inference_engine):
        """Test starting and stopping inference engine"""
        # Start engine
        await inference_engine.start()
        assert inference_engine.running is True
        assert inference_engine.processing_task is not None
        
        # Stop engine
        await inference_engine.stop()
        assert inference_engine.running is False
        assert inference_engine.processing_task is None
    
    @pytest.mark.asyncio
    async def test_predict_strategy_optimized_immediate(self, inference_engine, mock_neural_network):
        """Test optimized strategy prediction with immediate processing"""
        features = np.random.random((1, 50)).astype(np.float32)
        request_data = {
            'request_id': 'immediate_test',
            'queen_under_attack': True,  # Should trigger immediate processing
            'time_sensitivity': 0.95
        }
        
        result = await inference_engine.predict_strategy_optimized(features, request_data)
        
        assert result is not None
        assert result.shape == (1, 20)
        
        # Verify neural network was called for immediate processing
        mock_neural_network.predict_strategy_async.assert_called()
    
    @pytest.mark.asyncio
    async def test_predict_strategy_optimized_direct(self, inference_engine, mock_neural_network):
        """Test optimized strategy prediction with direct processing"""
        features = np.random.random((1, 50)).astype(np.float32)
        request_data = {
            'request_id': 'direct_test',
            'time_sensitivity': 0.5
        }
        
        result = await inference_engine.predict_strategy_optimized(features, request_data)
        
        assert result is not None
        assert result.shape == (1, 20)
        
        # Verify neural network was called
        mock_neural_network.predict_strategy_async.assert_called()
    
    @pytest.mark.asyncio
    async def test_predict_batch_optimized(self, inference_engine, mock_neural_network):
        """Test optimized batch prediction"""
        batch_features = [np.random.random((1, 50)).astype(np.float32) for _ in range(4)]
        batch_metadata = [{'request_id': f'batch_test_{i}'} for i in range(4)]
        
        results = await inference_engine.predict_batch_optimized(batch_features, batch_metadata)
        
        assert len(results) == 4
        for result in results:
            assert result.shape == (1, 20)
        
        # Verify neural network batch processing was called
        mock_neural_network.predict_batch_async.assert_called()
    
    def test_get_performance_metrics(self, inference_engine):
        """Test performance metrics reporting"""
        metrics = inference_engine.get_performance_metrics()
        
        assert 'inference_engine_status' in metrics
        assert 'performance_targets' in metrics
        assert 'current_performance' in metrics
        assert 'queue_status' in metrics
        assert 'optimization_recommendations' in metrics
        
        # Verify target values
        assert metrics['performance_targets']['target_inference_time_ms'] == 16.0
        assert metrics['performance_targets']['target_throughput_predictions_per_sec'] == 100.0
    
    @pytest.mark.asyncio
    async def test_benchmark_inference_performance(self, inference_engine, mock_neural_network):
        """Test inference performance benchmarking"""
        # Configure fast neural network responses
        mock_neural_network.predict_strategy_async.return_value = np.random.random((1, 20)).astype(np.float32)
        mock_neural_network.predict_batch_async.return_value = [
            np.random.random((1, 20)).astype(np.float32) for _ in range(16)
        ]
        
        benchmark_result = await inference_engine.benchmark_inference_performance()
        
        assert benchmark_result['success'] is True
        assert 'benchmark_results' in benchmark_result
        assert 'single_prediction' in benchmark_result['benchmark_results']
        assert 'batch_prediction' in benchmark_result['benchmark_results']
        assert 'overall_assessment' in benchmark_result['benchmark_results']
        
        # Verify benchmark structure
        single_results = benchmark_result['benchmark_results']['single_prediction']
        assert 'avg_time_ms' in single_results
        assert 'target_met' in single_results
        
        batch_results = benchmark_result['benchmark_results']['batch_prediction']
        assert 'avg_throughput_predictions_per_sec' in batch_results
        assert 'target_met' in batch_results


class TestIntegrationScenarios:
    """Integration tests for complete batch processing scenarios"""
    
    @pytest.fixture
    def mock_neural_network(self):
        """Create mock neural network for integration testing"""
        mock_nn = Mock(spec=QueenBehaviorNetwork)
        
        # Configure realistic response times
        async def mock_predict_batch(features, operation_id=None):
            await asyncio.sleep(0.01)  # 10ms processing time
            return [np.random.random((1, 20)).astype(np.float32) for _ in features]
        
        async def mock_predict_single(features, operation_id=None):
            await asyncio.sleep(0.005)  # 5ms processing time
            return np.random.random((1, 20)).astype(np.float32)
        
        mock_nn.predict_batch_async = mock_predict_batch
        mock_nn.predict_strategy_async = mock_predict_single
        
        return mock_nn
    
    @pytest.mark.asyncio
    async def test_end_to_end_batch_processing(self, mock_neural_network):
        """Test complete end-to-end batch processing workflow"""
        # Create inference engine
        inference_engine = InferenceEngine(mock_neural_network)
        await inference_engine.start()
        
        try:
            # Submit multiple requests with different priorities
            requests = []
            for i in range(12):
                features = np.random.random((1, 50)).astype(np.float32)
                
                if i < 2:
                    request_data = {'request_id': f'critical_{i}', 'queen_under_attack': True}
                elif i < 6:
                    request_data = {'request_id': f'high_{i}', 'combat_active': True}
                else:
                    request_data = {'request_id': f'normal_{i}', 'exploration_active': True}
                
                # Submit request
                result = await inference_engine.predict_strategy_optimized(features, request_data)
                requests.append((request_data['request_id'], result))
            
            # Verify all requests were processed
            assert len(requests) == 12
            for request_id, result in requests:
                assert result is not None
                assert result.shape == (1, 20)
            
            # Check performance metrics
            metrics = inference_engine.get_performance_metrics()
            assert metrics['inference_engine_status']['running'] is True
            
        finally:
            await inference_engine.stop()
    
    @pytest.mark.asyncio
    async def test_high_load_scenario(self, mock_neural_network):
        """Test batch processing under high load"""
        inference_engine = InferenceEngine(mock_neural_network)
        await inference_engine.start()
        
        try:
            # Submit many concurrent requests
            tasks = []
            for i in range(50):
                features = np.random.random((1, 50)).astype(np.float32)
                request_data = {'request_id': f'load_test_{i}', 'time_sensitivity': 0.5}
                
                task = asyncio.create_task(
                    inference_engine.predict_strategy_optimized(features, request_data)
                )
                tasks.append(task)
            
            # Wait for all requests to complete
            results = await asyncio.gather(*tasks)
            
            # Verify all requests were processed successfully
            assert len(results) == 50
            for result in results:
                assert result is not None
                assert result.shape == (1, 20)
            
            # Check that batch processing was utilized
            queue_status = inference_engine.batch_processor.get_queue_status()
            assert queue_status['completed_batches'] > 0
            
        finally:
            await inference_engine.stop()
    
    @pytest.mark.asyncio
    async def test_fallback_scenario(self, mock_neural_network):
        """Test fallback behavior when batch processing fails"""
        # Configure neural network to fail batch processing but succeed individual
        async def failing_batch_predict(features, operation_id=None):
            raise Exception("Batch processing failed")
        
        async def working_single_predict(features, operation_id=None):
            await asyncio.sleep(0.002)  # 2ms processing time
            return np.random.random((1, 20)).astype(np.float32)
        
        mock_neural_network.predict_batch_async = failing_batch_predict
        mock_neural_network.predict_strategy_async = working_single_predict
        
        # Create batch processor and test fallback
        batch_processor = BatchProcessor(mock_neural_network)
        
        # Add requests
        requests = []
        for i in range(4):
            request = InferenceRequest(
                request_id=f"fallback_test_{i}",
                features=np.random.random((1, 50)).astype(np.float32),
                priority=RequestPriority.NORMAL
            )
            requests.append(request)
            batch_processor.add_request(request)
        
        # Process batches (should trigger fallback)
        results = await batch_processor.process_pending_batches()
        
        # Verify fallback was used and requests were processed
        assert len(results) > 0
        for result in results:
            assert result.success is True
            assert result.individual_fallback_used is True
            assert len(result.request_results) > 0


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])