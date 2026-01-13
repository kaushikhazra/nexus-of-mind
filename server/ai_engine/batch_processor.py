"""
Batch Processing Engine for Neural Network Inference Optimization
Implements Requirements 3.1, 3.2, 3.3, 3.4, 3.5 for intelligent request batching
"""

import asyncio
import logging
import time
from typing import Dict, Any, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import numpy as np
from collections import deque
import threading

logger = logging.getLogger(__name__)


class RequestPriority(Enum):
    """Request priority levels based on game urgency"""
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


class BatchStatus(Enum):
    """Batch processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class InferenceRequest:
    """Individual inference request"""
    request_id: str
    features: np.ndarray
    priority: RequestPriority = RequestPriority.NORMAL
    timestamp: float = field(default_factory=time.time)
    timeout_ms: float = 1000.0  # 1 second default timeout
    callback: Optional[callable] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BatchRequest:
    """Batch of inference requests"""
    batch_id: str
    requests: List[InferenceRequest]
    created_at: float = field(default_factory=time.time)
    status: BatchStatus = BatchStatus.PENDING
    optimal_size: int = 0
    processing_start: Optional[float] = None
    processing_end: Optional[float] = None


@dataclass
class BatchResult:
    """Result from batch processing"""
    batch_id: str
    request_results: Dict[str, np.ndarray]  # request_id -> result
    processing_time_ms: float
    throughput_predictions_per_sec: float
    success: bool
    error: Optional[str] = None
    individual_fallback_used: bool = False


class BatchProcessor:
    """
    Intelligent request batching system with optimal size determination
    Implements Requirements 3.1, 3.2, 3.3, 3.4, 3.5
    """
    
    def __init__(self, neural_network=None):
        self.neural_network = neural_network
        
        # Request queues by priority
        self.request_queues = {
            RequestPriority.CRITICAL: deque(),
            RequestPriority.HIGH: deque(),
            RequestPriority.NORMAL: deque(),
            RequestPriority.LOW: deque()
        }
        
        # Batch configuration
        self.min_batch_size = 1
        self.max_batch_size = 32
        self.optimal_batch_size = 8
        self.batch_timeout_ms = 50.0  # Maximum wait time for batch formation
        
        # Performance tracking
        self.performance_history = deque(maxlen=100)
        self.throughput_target = 100.0  # predictions per second
        
        # Processing state
        self.processing_lock = threading.Lock()
        self.active_batches: Dict[str, BatchRequest] = {}
        self.completed_batches: Dict[str, BatchResult] = {}
        
        # Auto-optimization
        self.auto_optimize_enabled = True
        self.optimization_interval = 10  # Optimize every 10 batches
        self.batches_processed = 0
        
        logger.info(f"BatchProcessor initialized with optimal batch size: {self.optimal_batch_size}")
    
    def add_request(self, request: InferenceRequest) -> str:
        """
        Add inference request to appropriate priority queue
        Implements Requirement 3.1 - intelligent request batching
        
        Args:
            request: Inference request to add
            
        Returns:
            Request ID for tracking
        """
        try:
            with self.processing_lock:
                # Add to appropriate priority queue
                self.request_queues[request.priority].append(request)
                
                logger.debug(f"Added request {request.request_id} with priority {request.priority.name}")
                
                return request.request_id
                
        except Exception as e:
            logger.error(f"Failed to add request {request.request_id}: {e}")
            raise
    
    def determine_optimal_batch_size(self, available_requests: int) -> int:
        """
        Determine optimal batch size based on performance history and available requests
        Implements Requirement 3.2 - optimal size determination
        
        Args:
            available_requests: Number of requests available for batching
            
        Returns:
            Optimal batch size
        """
        try:
            # Start with configured optimal size
            optimal_size = self.optimal_batch_size
            
            # Adjust based on performance history
            if len(self.performance_history) >= 5:
                recent_performance = list(self.performance_history)[-5:]
                avg_throughput = sum(p['throughput'] for p in recent_performance) / len(recent_performance)
                avg_processing_time = sum(p['processing_time_ms'] for p in recent_performance) / len(recent_performance)
                
                # If throughput is below target, try smaller batches for lower latency
                if avg_throughput < self.throughput_target * 0.8:
                    optimal_size = max(self.min_batch_size, optimal_size // 2)
                    logger.debug(f"Reducing batch size to {optimal_size} due to low throughput")
                
                # If processing time is too high, reduce batch size
                elif avg_processing_time > 20.0:  # >20ms average
                    optimal_size = max(self.min_batch_size, optimal_size - 2)
                    logger.debug(f"Reducing batch size to {optimal_size} due to high processing time")
                
                # If performance is good, try increasing batch size
                elif avg_throughput > self.throughput_target * 1.2 and avg_processing_time < 10.0:
                    optimal_size = min(self.max_batch_size, optimal_size + 2)
                    logger.debug(f"Increasing batch size to {optimal_size} due to good performance")
            
            # Ensure we don't exceed available requests
            optimal_size = min(optimal_size, available_requests)
            
            # Ensure within bounds
            optimal_size = max(self.min_batch_size, min(self.max_batch_size, optimal_size))
            
            return optimal_size
            
        except Exception as e:
            logger.error(f"Failed to determine optimal batch size: {e}")
            return min(self.optimal_batch_size, available_requests)
    
    def create_batch_from_queues(self) -> Optional[BatchRequest]:
        """
        Create batch from priority queues with intelligent size determination
        Implements Requirements 3.1, 3.2 - request grouping and optimal sizing
        
        Returns:
            BatchRequest if sufficient requests available, None otherwise
        """
        try:
            with self.processing_lock:
                # Collect requests by priority (highest first)
                collected_requests = []
                
                # Process queues in priority order
                for priority in [RequestPriority.CRITICAL, RequestPriority.HIGH, 
                               RequestPriority.NORMAL, RequestPriority.LOW]:
                    queue = self.request_queues[priority]
                    
                    while queue and len(collected_requests) < self.max_batch_size:
                        request = queue.popleft()
                        
                        # Check if request has timed out
                        if time.time() - request.timestamp > (request.timeout_ms / 1000.0):
                            logger.warning(f"Request {request.request_id} timed out")
                            continue
                        
                        collected_requests.append(request)
                
                # Check if we have enough requests
                if not collected_requests:
                    return None
                
                # Determine optimal batch size
                optimal_size = self.determine_optimal_batch_size(len(collected_requests))
                
                # Take optimal number of requests
                batch_requests = collected_requests[:optimal_size]
                
                # Put remaining requests back (maintain priority order)
                remaining_requests = collected_requests[optimal_size:]
                for request in reversed(remaining_requests):
                    self.request_queues[request.priority].appendleft(request)
                
                # Create batch
                batch_id = f"batch_{int(time.time() * 1000)}_{len(batch_requests)}"
                batch = BatchRequest(
                    batch_id=batch_id,
                    requests=batch_requests,
                    optimal_size=optimal_size
                )
                
                self.active_batches[batch_id] = batch
                
                logger.debug(f"Created batch {batch_id} with {len(batch_requests)} requests")
                
                return batch
                
        except Exception as e:
            logger.error(f"Failed to create batch from queues: {e}")
            return None
    
    async def process_batch(self, batch: BatchRequest) -> BatchResult:
        """
        Process batch with parallel processing and individual result extraction
        Implements Requirements 3.1, 3.3 - parallel processing and throughput optimization
        
        Args:
            batch: Batch to process
            
        Returns:
            BatchResult with individual results
        """
        try:
            batch.status = BatchStatus.PROCESSING
            batch.processing_start = time.time()
            
            logger.debug(f"Processing batch {batch.batch_id} with {len(batch.requests)} requests")
            
            # Extract features from all requests
            batch_features = [request.features for request in batch.requests]
            
            # Process batch using neural network
            if self.neural_network:
                # Use neural network's batch processing capability
                batch_results = await self.neural_network.predict_batch_async(
                    batch_features, 
                    operation_id=batch.batch_id
                )
            else:
                # Fallback: simulate batch processing
                batch_results = []
                for features in batch_features:
                    # Simulate processing time
                    await asyncio.sleep(0.001)  # 1ms per prediction
                    result = np.random.random((1, 20)).astype(np.float32)  # Mock result
                    batch_results.append(result)
            
            batch.processing_end = time.time()
            processing_time_ms = (batch.processing_end - batch.processing_start) * 1000
            
            # Extract individual results
            request_results = {}
            for i, request in enumerate(batch.requests):
                if i < len(batch_results):
                    request_results[request.request_id] = batch_results[i]
                else:
                    # Handle missing results
                    logger.warning(f"Missing result for request {request.request_id}")
                    request_results[request.request_id] = np.zeros((1, 20), dtype=np.float32)
            
            # Calculate throughput (avoid division by zero)
            throughput = (len(batch.requests) / processing_time_ms) * 1000 if processing_time_ms > 0 else 0
            
            # Create result
            result = BatchResult(
                batch_id=batch.batch_id,
                request_results=request_results,
                processing_time_ms=processing_time_ms,
                throughput_predictions_per_sec=throughput,
                success=True
            )
            
            # Update performance tracking
            self._update_performance_history(result)
            
            # Update batch status
            batch.status = BatchStatus.COMPLETED
            self.completed_batches[batch.batch_id] = result
            
            # Auto-optimize if enabled
            if self.auto_optimize_enabled:
                self.batches_processed += 1
                if self.batches_processed % self.optimization_interval == 0:
                    self._auto_optimize_batch_size()
            
            logger.debug(f"Batch {batch.batch_id} processed successfully: "
                        f"{processing_time_ms:.1f}ms, {throughput:.1f} pred/sec")
            
            return result
            
        except Exception as e:
            logger.error(f"Batch processing failed for {batch.batch_id}: {e}")
            
            # Mark batch as failed
            batch.status = BatchStatus.FAILED
            
            # Create error result
            result = BatchResult(
                batch_id=batch.batch_id,
                request_results={},
                processing_time_ms=0.0,
                throughput_predictions_per_sec=0.0,
                success=False,
                error=str(e)
            )
            
            self.completed_batches[batch.batch_id] = result
            
            return result
    
    async def process_batch_with_fallback(self, batch: BatchRequest) -> BatchResult:
        """
        Process batch with fallback to individual processing
        Implements Requirement 3.4 - batch processing failure fallback
        
        Args:
            batch: Batch to process
            
        Returns:
            BatchResult with fallback handling
        """
        try:
            # Try batch processing first
            result = await self.process_batch(batch)
            
            if result.success:
                return result
            
            logger.warning(f"Batch processing failed for {batch.batch_id}, falling back to individual processing")
            
            # Fallback to individual processing
            return await self._process_individual_fallback(batch)
            
        except Exception as e:
            logger.error(f"Batch processing with fallback failed: {e}")
            return await self._process_individual_fallback(batch)
    
    async def _process_individual_fallback(self, batch: BatchRequest) -> BatchResult:
        """
        Process requests individually as fallback
        Implements Requirement 3.4 - individual processing fallback
        
        Args:
            batch: Batch to process individually
            
        Returns:
            BatchResult from individual processing
        """
        try:
            start_time = time.time()
            request_results = {}
            
            logger.info(f"Processing {len(batch.requests)} requests individually as fallback")
            
            for request in batch.requests:
                try:
                    if self.neural_network:
                        # Use neural network for individual prediction
                        result = await self.neural_network.predict_strategy_async(
                            request.features,
                            operation_id=f"{batch.batch_id}_individual_{request.request_id}"
                        )
                    else:
                        # Fallback: simulate individual processing
                        await asyncio.sleep(0.002)  # 2ms per individual prediction
                        result = np.random.random((1, 20)).astype(np.float32)
                    
                    request_results[request.request_id] = result
                    
                except Exception as req_error:
                    logger.error(f"Individual processing failed for request {request.request_id}: {req_error}")
                    # Provide zero result as final fallback
                    request_results[request.request_id] = np.zeros((1, 20), dtype=np.float32)
            
            processing_time_ms = (time.time() - start_time) * 1000
            throughput = (len(batch.requests) / processing_time_ms) * 1000 if processing_time_ms > 0 else 0
            
            # Create result
            result = BatchResult(
                batch_id=batch.batch_id,
                request_results=request_results,
                processing_time_ms=processing_time_ms,
                throughput_predictions_per_sec=throughput,
                success=True,
                individual_fallback_used=True
            )
            
            # Update performance tracking
            self._update_performance_history(result)
            
            batch.status = BatchStatus.COMPLETED
            self.completed_batches[batch.batch_id] = result
            
            logger.info(f"Individual fallback completed for {batch.batch_id}: "
                       f"{processing_time_ms:.1f}ms, {throughput:.1f} pred/sec")
            
            return result
            
        except Exception as e:
            logger.error(f"Individual fallback processing failed: {e}")
            
            # Final fallback: return empty results
            result = BatchResult(
                batch_id=batch.batch_id,
                request_results={req.request_id: np.zeros((1, 20), dtype=np.float32) 
                               for req in batch.requests},
                processing_time_ms=0.0,
                throughput_predictions_per_sec=0.0,
                success=False,
                error=str(e),
                individual_fallback_used=True
            )
            
            batch.status = BatchStatus.FAILED
            self.completed_batches[batch.batch_id] = result
            
            return result
    
    def _update_performance_history(self, result: BatchResult):
        """Update performance history for optimization"""
        try:
            performance_data = {
                'timestamp': time.time(),
                'batch_size': len(result.request_results),
                'processing_time_ms': result.processing_time_ms,
                'throughput': result.throughput_predictions_per_sec,
                'success': result.success,
                'individual_fallback': result.individual_fallback_used
            }
            
            self.performance_history.append(performance_data)
            
        except Exception as e:
            logger.error(f"Failed to update performance history: {e}")
    
    def _auto_optimize_batch_size(self):
        """
        Auto-optimize batch size based on performance history
        Implements intelligent batch size optimization
        """
        try:
            if len(self.performance_history) < 5:
                return
            
            recent_performance = list(self.performance_history)[-10:]
            
            # Calculate performance metrics
            avg_throughput = sum(p['throughput'] for p in recent_performance) / len(recent_performance)
            avg_processing_time = sum(p['processing_time_ms'] for p in recent_performance) / len(recent_performance)
            success_rate = sum(1 for p in recent_performance if p['success']) / len(recent_performance)
            
            old_optimal_size = self.optimal_batch_size
            
            # Optimization logic
            if success_rate < 0.8:
                # High failure rate, reduce batch size
                self.optimal_batch_size = max(self.min_batch_size, self.optimal_batch_size - 2)
                logger.info(f"Reduced batch size to {self.optimal_batch_size} due to low success rate ({success_rate:.2f})")
            
            elif avg_throughput < self.throughput_target * 0.8:
                # Low throughput, try smaller batches for better latency
                self.optimal_batch_size = max(self.min_batch_size, self.optimal_batch_size - 1)
                logger.info(f"Reduced batch size to {self.optimal_batch_size} due to low throughput ({avg_throughput:.1f})")
            
            elif avg_processing_time > 20.0:
                # High processing time, reduce batch size
                self.optimal_batch_size = max(self.min_batch_size, self.optimal_batch_size - 1)
                logger.info(f"Reduced batch size to {self.optimal_batch_size} due to high processing time ({avg_processing_time:.1f}ms)")
            
            elif (avg_throughput > self.throughput_target * 1.1 and 
                  avg_processing_time < 15.0 and 
                  success_rate > 0.95):
                # Good performance, try increasing batch size
                self.optimal_batch_size = min(self.max_batch_size, self.optimal_batch_size + 1)
                logger.info(f"Increased batch size to {self.optimal_batch_size} due to good performance")
            
            # Ensure within bounds
            self.optimal_batch_size = max(self.min_batch_size, 
                                        min(self.max_batch_size, self.optimal_batch_size))
            
            if self.optimal_batch_size != old_optimal_size:
                logger.info(f"Batch size optimized: {old_optimal_size} -> {self.optimal_batch_size}")
            
        except Exception as e:
            logger.error(f"Auto-optimization failed: {e}")
    
    def get_queue_status(self) -> Dict[str, Any]:
        """Get current queue status and metrics"""
        try:
            with self.processing_lock:
                queue_counts = {
                    priority.name: len(queue) 
                    for priority, queue in self.request_queues.items()
                }
                
                total_queued = sum(queue_counts.values())
                
                # Calculate performance metrics
                recent_performance = list(self.performance_history)[-10:] if self.performance_history else []
                avg_throughput = (sum(p['throughput'] for p in recent_performance) / len(recent_performance)) if recent_performance else 0
                avg_processing_time = (sum(p['processing_time_ms'] for p in recent_performance) / len(recent_performance)) if recent_performance else 0
                
                return {
                    'queue_counts': queue_counts,
                    'total_queued_requests': total_queued,
                    'active_batches': len(self.active_batches),
                    'completed_batches': len(self.completed_batches),
                    'optimal_batch_size': self.optimal_batch_size,
                    'performance_metrics': {
                        'avg_throughput_predictions_per_sec': avg_throughput,
                        'avg_processing_time_ms': avg_processing_time,
                        'throughput_target': self.throughput_target,
                        'performance_history_size': len(self.performance_history)
                    }
                }
                
        except Exception as e:
            logger.error(f"Failed to get queue status: {e}")
            return {'error': str(e)}
    
    def get_batch_result(self, batch_id: str) -> Optional[BatchResult]:
        """Get result for completed batch"""
        return self.completed_batches.get(batch_id)
    
    def get_request_result(self, request_id: str) -> Optional[np.ndarray]:
        """Get result for specific request"""
        try:
            for batch_result in self.completed_batches.values():
                if request_id in batch_result.request_results:
                    return batch_result.request_results[request_id]
            return None
            
        except Exception as e:
            logger.error(f"Failed to get request result for {request_id}: {e}")
            return None
    
    async def process_pending_batches(self) -> List[BatchResult]:
        """
        Process all pending batches
        Main processing loop for batch engine
        
        Returns:
            List of batch results
        """
        try:
            results = []
            
            # Create batches from queues
            while True:
                batch = self.create_batch_from_queues()
                if not batch:
                    break
                
                # Process batch with fallback
                result = await self.process_batch_with_fallback(batch)
                results.append(result)
                
                # Clean up active batch
                if batch.batch_id in self.active_batches:
                    del self.active_batches[batch.batch_id]
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to process pending batches: {e}")
            return []
    
    def cleanup(self):
        """Cleanup batch processor resources"""
        try:
            logger.info("Cleaning up BatchProcessor...")
            
            with self.processing_lock:
                # Clear queues
                for queue in self.request_queues.values():
                    queue.clear()
                
                # Clear active and completed batches
                self.active_batches.clear()
                self.completed_batches.clear()
                
                # Clear performance history
                self.performance_history.clear()
            
            logger.info("BatchProcessor cleanup completed")
            
        except Exception as e:
            logger.error(f"BatchProcessor cleanup failed: {e}")


class QueueManager:
    """
    Queue manager for request prioritization based on game urgency
    Implements Requirement 3.5 - request prioritization
    """
    
    def __init__(self, batch_processor: BatchProcessor):
        self.batch_processor = batch_processor
        self.priority_weights = {
            RequestPriority.CRITICAL: 1.0,
            RequestPriority.HIGH: 0.8,
            RequestPriority.NORMAL: 0.5,
            RequestPriority.LOW: 0.2
        }
        
    def prioritize_request(self, request_data: Dict[str, Any]) -> RequestPriority:
        """
        Determine request priority based on game urgency
        Implements Requirement 3.5 - game urgency prioritization
        
        Args:
            request_data: Request metadata for priority determination
            
        Returns:
            Appropriate priority level
        """
        try:
            # Default priority
            priority = RequestPriority.NORMAL
            
            # Check for critical game situations
            if request_data.get('queen_under_attack', False):
                priority = RequestPriority.CRITICAL
            elif request_data.get('combat_active', False):
                priority = RequestPriority.HIGH
            elif request_data.get('exploration_active', False):
                priority = RequestPriority.NORMAL
            elif request_data.get('idle_state', False):
                priority = RequestPriority.LOW
            
            # Adjust based on time sensitivity
            time_sensitivity = request_data.get('time_sensitivity', 0.5)
            if time_sensitivity > 0.8:
                priority = RequestPriority.CRITICAL
            elif time_sensitivity > 0.6:
                priority = RequestPriority.HIGH
            elif time_sensitivity < 0.3:
                priority = RequestPriority.LOW
            
            # Adjust based on player count (multiplayer scenarios)
            player_count = request_data.get('active_players', 1)
            if player_count > 4:
                # Higher priority for multiplayer scenarios
                if priority == RequestPriority.LOW:
                    priority = RequestPriority.NORMAL
                elif priority == RequestPriority.NORMAL:
                    priority = RequestPriority.HIGH
            
            return priority
            
        except Exception as e:
            logger.error(f"Failed to prioritize request: {e}")
            return RequestPriority.NORMAL
    
    def create_prioritized_request(self, features: np.ndarray, 
                                 request_data: Dict[str, Any]) -> InferenceRequest:
        """
        Create inference request with appropriate priority
        
        Args:
            features: Input features for inference
            request_data: Request metadata
            
        Returns:
            Prioritized inference request
        """
        try:
            priority = self.prioritize_request(request_data)
            
            request = InferenceRequest(
                request_id=request_data.get('request_id', f"req_{int(time.time() * 1000)}"),
                features=features,
                priority=priority,
                timeout_ms=request_data.get('timeout_ms', 1000.0),
                metadata=request_data
            )
            
            return request
            
        except Exception as e:
            logger.error(f"Failed to create prioritized request: {e}")
            # Return basic request as fallback
            return InferenceRequest(
                request_id=f"fallback_{int(time.time() * 1000)}",
                features=features,
                priority=RequestPriority.NORMAL
            )
    
    async def submit_request(self, features: np.ndarray, 
                           request_data: Dict[str, Any]) -> str:
        """
        Submit prioritized request to batch processor
        
        Args:
            features: Input features for inference
            request_data: Request metadata
            
        Returns:
            Request ID for tracking
        """
        try:
            request = self.create_prioritized_request(features, request_data)
            return self.batch_processor.add_request(request)
            
        except Exception as e:
            logger.error(f"Failed to submit request: {e}")
            raise