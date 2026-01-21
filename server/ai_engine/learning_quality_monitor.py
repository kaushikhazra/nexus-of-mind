"""
Learning Quality Preservation System - Monitors and validates learning progression stability
during neural network optimization and batch processing.

Implements Requirements 6.1, 6.2, 6.3, 6.4 for learning quality preservation.
"""

import asyncio
import logging
import time
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from collections import deque
import json
import os

logger = logging.getLogger(__name__)


@dataclass
class LearningQualityMetrics:
    """Metrics for tracking learning quality"""
    timestamp: float
    generation: int
    queen_id: str
    territory_id: Optional[str]
    
    # Core learning metrics
    prediction_accuracy: float
    learning_progression_score: float
    strategy_effectiveness: float
    adaptation_rate: float
    
    # Quality preservation metrics
    accuracy_retention: float  # Percentage of original accuracy retained
    learning_stability: float  # Consistency of learning across generations
    convergence_quality: float  # Quality of neural network convergence
    
    # Batch processing specific metrics
    individual_queen_performance: float  # Performance during batch processing
    batch_learning_consistency: float  # Consistency across batch members
    
    # Optimization impact metrics
    pre_optimization_accuracy: float
    post_optimization_accuracy: float
    optimization_impact: float  # Positive = improvement, negative = degradation
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class LearningQualityThresholds:
    """Thresholds for learning quality validation"""
    min_accuracy_retention: float = 0.95  # >95% of original prediction quality (Req 6.3)
    min_learning_stability: float = 0.7   # Minimum stability score
    min_convergence_quality: float = 0.6  # Minimum convergence quality
    max_accuracy_loss: float = 0.05       # <5% accuracy loss allowed
    min_adaptation_rate: float = 0.3      # Minimum adaptation rate
    
    # Batch processing thresholds
    min_individual_performance: float = 0.8  # Individual Queen performance in batch
    min_batch_consistency: float = 0.7       # Consistency across batch members
    
    # Alert thresholds
    warning_accuracy_loss: float = 0.03   # 3% loss triggers warning
    critical_accuracy_loss: float = 0.08  # 8% loss triggers critical alert


class LearningQualityValidator:
    """Validates learning quality to ensure optimization doesn't compromise learning"""
    
    def __init__(self):
        self.thresholds = LearningQualityThresholds()
        self.baseline_metrics = {}  # Store baseline metrics for comparison
        self.quality_history = deque(maxlen=100)  # Keep last 100 quality measurements
        
    def validate_learning_progression(self, current_metrics: LearningQualityMetrics,
                                    baseline_metrics: Optional[LearningQualityMetrics] = None) -> Dict[str, Any]:
        """
        Validate that learning progression remains stable (Requirement 6.1)
        
        Args:
            current_metrics: Current learning quality metrics
            baseline_metrics: Baseline metrics for comparison
            
        Returns:
            Validation results with quality assessment
        """
        try:
            validation_result = {
                'is_valid': True,
                'quality_score': 0.0,
                'warnings': [],
                'violations': [],
                'recommendations': []
            }
            
            # Check accuracy retention (Requirement 6.3)
            if current_metrics.accuracy_retention < self.thresholds.min_accuracy_retention:
                validation_result['is_valid'] = False
                validation_result['violations'].append(
                    f"Accuracy retention {current_metrics.accuracy_retention:.3f} below threshold "
                    f"{self.thresholds.min_accuracy_retention:.3f}"
                )
            elif current_metrics.accuracy_retention < (self.thresholds.min_accuracy_retention + 0.02):
                validation_result['warnings'].append(
                    f"Accuracy retention {current_metrics.accuracy_retention:.3f} approaching threshold"
                )
            
            # Check learning stability
            if current_metrics.learning_stability < self.thresholds.min_learning_stability:
                validation_result['is_valid'] = False
                validation_result['violations'].append(
                    f"Learning stability {current_metrics.learning_stability:.3f} below threshold "
                    f"{self.thresholds.min_learning_stability:.3f}"
                )
            
            # Check convergence quality
            if current_metrics.convergence_quality < self.thresholds.min_convergence_quality:
                validation_result['warnings'].append(
                    f"Convergence quality {current_metrics.convergence_quality:.3f} below optimal threshold"
                )
            
            # Check optimization impact
            if current_metrics.optimization_impact < -self.thresholds.max_accuracy_loss:
                validation_result['is_valid'] = False
                validation_result['violations'].append(
                    f"Optimization caused accuracy loss of {abs(current_metrics.optimization_impact):.3f}, "
                    f"exceeding maximum allowed loss of {self.thresholds.max_accuracy_loss:.3f}"
                )
            
            # Compare with baseline if available
            if baseline_metrics:
                accuracy_change = current_metrics.prediction_accuracy - baseline_metrics.prediction_accuracy
                if accuracy_change < -self.thresholds.warning_accuracy_loss:
                    if accuracy_change < -self.thresholds.critical_accuracy_loss:
                        validation_result['is_valid'] = False
                        validation_result['violations'].append(
                            f"Critical accuracy degradation: {abs(accuracy_change):.3f}"
                        )
                    else:
                        validation_result['warnings'].append(
                            f"Accuracy degradation detected: {abs(accuracy_change):.3f}"
                        )
            
            # Calculate overall quality score
            quality_components = [
                current_metrics.accuracy_retention,
                current_metrics.learning_stability,
                current_metrics.convergence_quality,
                max(0, 1 + current_metrics.optimization_impact)  # Convert impact to positive score
            ]
            validation_result['quality_score'] = sum(quality_components) / len(quality_components)
            
            # Generate recommendations
            if current_metrics.accuracy_retention < 0.98:
                validation_result['recommendations'].append(
                    "Consider reducing optimization aggressiveness to preserve accuracy"
                )
            
            if current_metrics.learning_stability < 0.8:
                validation_result['recommendations'].append(
                    "Increase training epochs or reduce learning rate for better stability"
                )
            
            if current_metrics.convergence_quality < 0.7:
                validation_result['recommendations'].append(
                    "Adjust convergence criteria or increase patience for better convergence"
                )
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Error validating learning progression: {e}")
            return {
                'is_valid': False,
                'error': str(e),
                'quality_score': 0.0
            }
    
    def validate_batch_learning_quality(self, batch_metrics: List[LearningQualityMetrics]) -> Dict[str, Any]:
        """
        Validate that individual Queen learning is not compromised during batch processing (Requirement 6.2)
        
        Args:
            batch_metrics: List of quality metrics for each Queen in the batch
            
        Returns:
            Batch validation results
        """
        try:
            if not batch_metrics:
                return {'is_valid': False, 'error': 'No batch metrics provided'}
            
            validation_result = {
                'is_valid': True,
                'batch_quality_score': 0.0,
                'individual_scores': [],
                'consistency_score': 0.0,
                'warnings': [],
                'violations': [],
                'recommendations': []
            }
            
            # Validate individual Queen performance
            individual_scores = []
            for i, metrics in enumerate(batch_metrics):
                individual_score = metrics.individual_queen_performance
                individual_scores.append(individual_score)
                
                if individual_score < self.thresholds.min_individual_performance:
                    validation_result['violations'].append(
                        f"Queen {i} individual performance {individual_score:.3f} below threshold "
                        f"{self.thresholds.min_individual_performance:.3f}"
                    )
                    validation_result['is_valid'] = False
            
            validation_result['individual_scores'] = individual_scores
            
            # Calculate batch consistency
            if len(individual_scores) > 1:
                mean_score = np.mean(individual_scores)
                std_score = np.std(individual_scores)
                consistency_score = max(0, 1 - (std_score / max(mean_score, 0.1)))
                validation_result['consistency_score'] = consistency_score
                
                if consistency_score < self.thresholds.min_batch_consistency:
                    validation_result['violations'].append(
                        f"Batch consistency {consistency_score:.3f} below threshold "
                        f"{self.thresholds.min_batch_consistency:.3f}"
                    )
                    validation_result['is_valid'] = False
            else:
                validation_result['consistency_score'] = 1.0
            
            # Calculate overall batch quality score
            avg_individual_score = np.mean(individual_scores)
            validation_result['batch_quality_score'] = (avg_individual_score + validation_result['consistency_score']) / 2
            
            # Generate recommendations for batch processing
            if validation_result['consistency_score'] < 0.8:
                validation_result['recommendations'].append(
                    "Consider reducing batch size or adjusting batch composition for better consistency"
                )
            
            if avg_individual_score < 0.85:
                validation_result['recommendations'].append(
                    "Individual Queen performance is suboptimal - consider individual training adjustments"
                )
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Error validating batch learning quality: {e}")
            return {
                'is_valid': False,
                'error': str(e),
                'batch_quality_score': 0.0
            }
    
    def set_baseline_metrics(self, queen_id: str, metrics: LearningQualityMetrics):
        """Set baseline metrics for a Queen"""
        self.baseline_metrics[queen_id] = metrics
        logger.info(f"Baseline metrics set for Queen {queen_id}")
    
    def get_baseline_metrics(self, queen_id: str) -> Optional[LearningQualityMetrics]:
        """Get baseline metrics for a Queen"""
        return self.baseline_metrics.get(queen_id)
    
    def update_thresholds(self, new_thresholds: Dict[str, float]):
        """Update quality validation thresholds"""
        for key, value in new_thresholds.items():
            if hasattr(self.thresholds, key):
                setattr(self.thresholds, key, value)
                logger.info(f"Updated threshold {key} to {value}")


class LearningQualityMonitor:
    """
    Comprehensive learning quality monitoring system for neural network optimization
    """
    
    def __init__(self):
        self.validator = LearningQualityValidator()
        self.metrics_history = deque(maxlen=1000)  # Keep last 1000 measurements
        self.generation_metrics = {}  # Track metrics by generation
        self.territory_metrics = {}   # Track metrics by territory
        self.is_monitoring = False
        self.monitoring_callbacks = []
        
        # Storage paths
        self.storage_path = "data/learning_quality"
        self.metrics_file = os.path.join(self.storage_path, "quality_metrics.json")
        self._ensure_storage_directory()
    
    def _ensure_storage_directory(self):
        """Ensure storage directory exists"""
        os.makedirs(self.storage_path, exist_ok=True)
    
    async def start_monitoring(self):
        """Start learning quality monitoring"""
        if self.is_monitoring:
            return
        
        self.is_monitoring = True
        logger.info("Learning quality monitoring started")
    
    async def stop_monitoring(self):
        """Stop learning quality monitoring"""
        if not self.is_monitoring:
            return
        
        self.is_monitoring = False
        await self._save_metrics_to_disk()
        logger.info("Learning quality monitoring stopped")
    
    async def monitor_learning_session(self, queen_id: str, territory_id: Optional[str],
                                     generation: int, learning_function: callable,
                                     learning_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Monitor a learning session to ensure quality preservation (Requirement 6.1, 6.4)
        
        Args:
            queen_id: Queen identifier
            territory_id: Territory identifier
            generation: Generation number
            learning_function: Function to execute learning
            learning_data: Data for learning
            
        Returns:
            Learning results with quality metrics
        """
        try:
            logger.info(f"Monitoring learning session for Queen {queen_id}, generation {generation}")
            
            # Get baseline metrics if available
            baseline_metrics = self.validator.get_baseline_metrics(queen_id)
            
            # Pre-learning quality assessment
            pre_learning_metrics = await self._assess_pre_learning_quality(
                queen_id, territory_id, generation, learning_data
            )
            
            # Execute learning with monitoring
            start_time = time.time()
            learning_result = await learning_function(learning_data)
            learning_time = time.time() - start_time
            
            # Post-learning quality assessment
            post_learning_metrics = await self._assess_post_learning_quality(
                queen_id, territory_id, generation, learning_result, pre_learning_metrics
            )
            
            # Validate learning quality
            quality_validation = self.validator.validate_learning_progression(
                post_learning_metrics, baseline_metrics
            )
            
            # Store metrics
            self.metrics_history.append(post_learning_metrics)
            self._update_generation_metrics(generation, post_learning_metrics)
            if territory_id:
                self._update_territory_metrics(territory_id, post_learning_metrics)
            
            # Set as baseline if this is the first measurement for this Queen
            if queen_id not in self.validator.baseline_metrics:
                self.validator.set_baseline_metrics(queen_id, post_learning_metrics)
            
            # Trigger callbacks
            for callback in self.monitoring_callbacks:
                try:
                    await callback(post_learning_metrics, quality_validation)
                except Exception as e:
                    logger.error(f"Quality monitoring callback error: {e}")
            
            # Enhance learning result with quality information
            enhanced_result = learning_result.copy() if isinstance(learning_result, dict) else {}
            enhanced_result.update({
                'learning_quality_metrics': post_learning_metrics.to_dict(),
                'quality_validation': quality_validation,
                'learning_time': learning_time,
                'quality_preserved': quality_validation['is_valid'],
                'quality_score': quality_validation['quality_score']
            })
            
            logger.info(f"Learning session monitored: quality_score={quality_validation['quality_score']:.3f}, "
                       f"valid={quality_validation['is_valid']}")
            
            return enhanced_result
            
        except Exception as e:
            logger.error(f"Error monitoring learning session: {e}")
            return {
                'success': False,
                'error': str(e),
                'learning_quality_metrics': None,
                'quality_preserved': False
            }
    
    async def monitor_batch_learning(self, batch_data: List[Dict[str, Any]],
                                   batch_learning_function: callable) -> Dict[str, Any]:
        """
        Monitor batch learning to ensure individual Queen learning is preserved (Requirement 6.2)
        
        Args:
            batch_data: List of learning data for each Queen in batch
            batch_learning_function: Function to execute batch learning
            
        Returns:
            Batch learning results with quality metrics
        """
        try:
            logger.info(f"Monitoring batch learning session with {len(batch_data)} Queens")
            
            # Pre-batch quality assessment
            pre_batch_metrics = []
            for i, data in enumerate(batch_data):
                queen_id = data.get('queen_id', f'batch_queen_{i}')
                territory_id = data.get('territory_id')
                generation = data.get('generation', 1)
                
                pre_metrics = await self._assess_pre_learning_quality(
                    queen_id, territory_id, generation, data
                )
                pre_batch_metrics.append(pre_metrics)
            
            # Execute batch learning
            start_time = time.time()
            batch_result = await batch_learning_function(batch_data)
            batch_time = time.time() - start_time
            
            # Post-batch quality assessment
            post_batch_metrics = []
            batch_results = batch_result.get('individual_results', []) if isinstance(batch_result, dict) else []
            
            for i, (data, pre_metrics) in enumerate(zip(batch_data, pre_batch_metrics)):
                queen_id = data.get('queen_id', f'batch_queen_{i}')
                territory_id = data.get('territory_id')
                generation = data.get('generation', 1)
                
                individual_result = batch_results[i] if i < len(batch_results) else {}
                
                post_metrics = await self._assess_post_learning_quality(
                    queen_id, territory_id, generation, individual_result, pre_metrics
                )
                
                # Add batch-specific metrics
                post_metrics.individual_queen_performance = self._calculate_individual_batch_performance(
                    individual_result, pre_metrics
                )
                post_metrics.batch_learning_consistency = self._calculate_batch_consistency(
                    post_metrics, post_batch_metrics
                )
                
                post_batch_metrics.append(post_metrics)
            
            # Validate batch learning quality
            batch_validation = self.validator.validate_batch_learning_quality(post_batch_metrics)
            
            # Store metrics
            for metrics in post_batch_metrics:
                self.metrics_history.append(metrics)
                self._update_generation_metrics(metrics.generation, metrics)
                if metrics.territory_id:
                    self._update_territory_metrics(metrics.territory_id, metrics)
            
            # Enhance batch result with quality information
            enhanced_result = batch_result.copy() if isinstance(batch_result, dict) else {}
            enhanced_result.update({
                'batch_quality_metrics': [m.to_dict() for m in post_batch_metrics],
                'batch_quality_validation': batch_validation,
                'batch_time': batch_time,
                'batch_quality_preserved': batch_validation['is_valid'],
                'batch_quality_score': batch_validation['batch_quality_score']
            })
            
            logger.info(f"Batch learning monitored: batch_quality_score={batch_validation['batch_quality_score']:.3f}, "
                       f"valid={batch_validation['is_valid']}")
            
            return enhanced_result
            
        except Exception as e:
            logger.error(f"Error monitoring batch learning: {e}")
            return {
                'success': False,
                'error': str(e),
                'batch_quality_preserved': False
            }
    
    async def _assess_pre_learning_quality(self, queen_id: str, territory_id: Optional[str],
                                         generation: int, learning_data: Dict[str, Any]) -> LearningQualityMetrics:
        """Assess quality metrics before learning"""
        try:
            # Get baseline accuracy if available
            baseline_metrics = self.validator.get_baseline_metrics(queen_id)
            baseline_accuracy = baseline_metrics.prediction_accuracy if baseline_metrics else 0.5
            
            # Calculate pre-learning metrics
            current_accuracy = learning_data.get('current_accuracy', baseline_accuracy)
            learning_progression = self._calculate_learning_progression_score(queen_id, generation)
            strategy_effectiveness = learning_data.get('strategy_effectiveness', 0.5)
            adaptation_rate = self._calculate_adaptation_rate(queen_id, generation)
            
            metrics = LearningQualityMetrics(
                timestamp=time.time(),
                generation=generation,
                queen_id=queen_id,
                territory_id=territory_id,
                prediction_accuracy=current_accuracy,
                learning_progression_score=learning_progression,
                strategy_effectiveness=strategy_effectiveness,
                adaptation_rate=adaptation_rate,
                accuracy_retention=1.0,  # Will be calculated post-learning
                learning_stability=self._calculate_learning_stability(queen_id),
                convergence_quality=0.7,  # Will be updated post-learning
                individual_queen_performance=1.0,  # Default for non-batch
                batch_learning_consistency=1.0,    # Default for non-batch
                pre_optimization_accuracy=current_accuracy,
                post_optimization_accuracy=current_accuracy,  # Will be updated
                optimization_impact=0.0  # Will be calculated post-learning
            )
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error assessing pre-learning quality: {e}")
            # Return default metrics
            return LearningQualityMetrics(
                timestamp=time.time(),
                generation=generation,
                queen_id=queen_id,
                territory_id=territory_id,
                prediction_accuracy=0.8,  # Higher default
                learning_progression_score=0.7,
                strategy_effectiveness=0.7,
                adaptation_rate=0.7,
                accuracy_retention=1.0,
                learning_stability=0.8,
                convergence_quality=0.7,
                individual_queen_performance=1.0,
                batch_learning_consistency=1.0,
                pre_optimization_accuracy=0.8,
                post_optimization_accuracy=0.8,
                optimization_impact=0.0
            )
    
    async def _assess_post_learning_quality(self, queen_id: str, territory_id: Optional[str],
                                          generation: int, learning_result: Dict[str, Any],
                                          pre_metrics: LearningQualityMetrics) -> LearningQualityMetrics:
        """Assess quality metrics after learning"""
        try:
            # Extract post-learning accuracy
            post_accuracy = learning_result.get('accuracy', learning_result.get('final_accuracy', pre_metrics.prediction_accuracy))
            
            # Calculate accuracy retention
            baseline_metrics = self.validator.get_baseline_metrics(queen_id)
            baseline_accuracy = baseline_metrics.prediction_accuracy if baseline_metrics else pre_metrics.prediction_accuracy
            accuracy_retention = post_accuracy / max(baseline_accuracy, 0.01)
            
            # Calculate convergence quality
            convergence_quality = self._calculate_convergence_quality(learning_result)
            
            # Calculate optimization impact
            optimization_impact = post_accuracy - pre_metrics.pre_optimization_accuracy
            
            # Update metrics
            post_metrics = LearningQualityMetrics(
                timestamp=time.time(),
                generation=generation,
                queen_id=queen_id,
                territory_id=territory_id,
                prediction_accuracy=post_accuracy,
                learning_progression_score=self._calculate_learning_progression_score(queen_id, generation),
                strategy_effectiveness=learning_result.get('strategy_effectiveness', pre_metrics.strategy_effectiveness),
                adaptation_rate=self._calculate_adaptation_rate(queen_id, generation),
                accuracy_retention=min(1.0, accuracy_retention),
                learning_stability=self._calculate_learning_stability(queen_id),
                convergence_quality=convergence_quality,
                individual_queen_performance=pre_metrics.individual_queen_performance,
                batch_learning_consistency=pre_metrics.batch_learning_consistency,
                pre_optimization_accuracy=pre_metrics.pre_optimization_accuracy,
                post_optimization_accuracy=post_accuracy,
                optimization_impact=optimization_impact
            )
            
            return post_metrics
            
        except Exception as e:
            logger.error(f"Error assessing post-learning quality: {e}")
            # Return pre-metrics with minimal updates
            pre_metrics.timestamp = time.time()
            pre_metrics.post_optimization_accuracy = pre_metrics.pre_optimization_accuracy
            return pre_metrics
    
    def _calculate_learning_progression_score(self, queen_id: str, generation: int) -> float:
        """Calculate learning progression score across generations"""
        try:
            if generation <= 1:
                return 0.7  # Higher neutral score for first generation
            
            # Get historical metrics for this Queen
            queen_metrics = [m for m in self.metrics_history if m.queen_id == queen_id]
            if len(queen_metrics) < 2:
                return 0.7
            
            # Sort by generation
            queen_metrics.sort(key=lambda x: x.generation)
            
            # Calculate improvement trend
            recent_metrics = queen_metrics[-5:]  # Last 5 generations
            if len(recent_metrics) < 2:
                return 0.7
            
            # Calculate average improvement
            improvements = []
            for i in range(1, len(recent_metrics)):
                prev_accuracy = recent_metrics[i-1].prediction_accuracy
                curr_accuracy = recent_metrics[i].prediction_accuracy
                improvement = (curr_accuracy - prev_accuracy) / max(prev_accuracy, 0.01)
                improvements.append(improvement)
            
            avg_improvement = sum(improvements) / len(improvements)
            
            # Convert to 0-1 score (0.5 = no change, 1.0 = strong improvement, 0.0 = strong degradation)
            progression_score = 0.7 + (avg_improvement * 1.5)  # Scale improvement around 0.7
            return max(0.0, min(1.0, progression_score))
            
        except Exception as e:
            logger.error(f"Error calculating learning progression score: {e}")
            return 0.7
    
    def _calculate_adaptation_rate(self, queen_id: str, generation: int) -> float:
        """Calculate how quickly the Queen adapts to new challenges"""
        try:
            # Get recent metrics for this Queen
            queen_metrics = [m for m in self.metrics_history 
                           if m.queen_id == queen_id and m.generation >= max(1, generation - 3)]
            
            if len(queen_metrics) < 2:
                return 0.7  # Higher default adaptation rate
            
            # Sort by generation
            queen_metrics.sort(key=lambda x: x.generation)
            
            # Calculate adaptation based on strategy effectiveness changes
            effectiveness_changes = []
            for i in range(1, len(queen_metrics)):
                prev_effectiveness = queen_metrics[i-1].strategy_effectiveness
                curr_effectiveness = queen_metrics[i].strategy_effectiveness
                change = curr_effectiveness - prev_effectiveness
                effectiveness_changes.append(abs(change))  # Adaptation rate is about change magnitude
            
            if not effectiveness_changes:
                return 0.7
            
            # Higher changes indicate faster adaptation
            avg_change = sum(effectiveness_changes) / len(effectiveness_changes)
            adaptation_rate = min(1.0, 0.5 + avg_change * 2)  # Scale to 0.5-1.0
            
            return adaptation_rate
            
        except Exception as e:
            logger.error(f"Error calculating adaptation rate: {e}")
            return 0.7
    
    def _calculate_learning_stability(self, queen_id: str) -> float:
        """Calculate stability of learning across recent generations"""
        try:
            # Get recent metrics for this Queen
            queen_metrics = [m for m in self.metrics_history if m.queen_id == queen_id]
            
            if len(queen_metrics) < 3:
                return 0.8  # Higher default stability
            
            # Sort by generation and get recent metrics
            queen_metrics.sort(key=lambda x: x.generation)
            recent_metrics = queen_metrics[-5:]  # Last 5 generations
            
            # Calculate stability based on accuracy variance
            accuracies = [m.prediction_accuracy for m in recent_metrics]
            mean_accuracy = sum(accuracies) / len(accuracies)
            variance = sum((acc - mean_accuracy) ** 2 for acc in accuracies) / len(accuracies)
            
            # Convert variance to stability score (lower variance = higher stability)
            stability = max(0.5, 1.0 - (variance * 5))  # Scale variance, minimum 0.5
            
            return min(1.0, stability)
            
        except Exception as e:
            logger.error(f"Error calculating learning stability: {e}")
            return 0.8
    
    def _calculate_convergence_quality(self, learning_result: Dict[str, Any]) -> float:
        """Calculate quality of neural network convergence"""
        try:
            # Check if convergence was achieved
            convergence_achieved = learning_result.get('convergence_achieved', False)
            if not convergence_achieved:
                return 0.3  # Low quality if no convergence
            
            # Get convergence metrics
            final_loss = learning_result.get('loss', learning_result.get('final_loss', 1.0))
            epochs_trained = learning_result.get('epochs_trained', 1)
            max_epochs = learning_result.get('max_epochs', epochs_trained)
            
            # Quality based on final loss (lower is better)
            loss_quality = max(0.0, 1.0 - final_loss)
            
            # Quality based on convergence efficiency (fewer epochs = better)
            efficiency_quality = 1.0 - (epochs_trained / max(max_epochs, 1))
            
            # Combined quality score
            convergence_quality = (loss_quality * 0.7) + (efficiency_quality * 0.3)
            
            return max(0.0, min(1.0, convergence_quality))
            
        except Exception as e:
            logger.error(f"Error calculating convergence quality: {e}")
            return 0.5
    
    def _calculate_individual_batch_performance(self, individual_result: Dict[str, Any],
                                              pre_metrics: LearningQualityMetrics) -> float:
        """Calculate individual Queen performance within batch processing"""
        try:
            # Get individual accuracy from result
            individual_accuracy = individual_result.get('accuracy', individual_result.get('final_accuracy', 0.5))
            
            # Compare with pre-batch accuracy
            pre_accuracy = pre_metrics.prediction_accuracy
            
            # Performance is based on accuracy retention and improvement
            accuracy_retention = individual_accuracy / max(pre_accuracy, 0.01)
            
            # Bonus for improvement, penalty for degradation
            improvement_bonus = max(0, individual_accuracy - pre_accuracy)
            
            performance = min(1.0, accuracy_retention + improvement_bonus)
            
            return max(0.0, performance)
            
        except Exception as e:
            logger.error(f"Error calculating individual batch performance: {e}")
            return 0.5
    
    def _calculate_batch_consistency(self, current_metrics: LearningQualityMetrics,
                                   batch_metrics: List[LearningQualityMetrics]) -> float:
        """Calculate consistency of current Queen with batch"""
        try:
            if not batch_metrics:
                return 1.0  # Perfect consistency if no other metrics
            
            # Calculate consistency based on accuracy similarity
            current_accuracy = current_metrics.prediction_accuracy
            other_accuracies = [m.prediction_accuracy for m in batch_metrics]
            
            if not other_accuracies:
                return 1.0
            
            mean_accuracy = sum(other_accuracies) / len(other_accuracies)
            accuracy_diff = abs(current_accuracy - mean_accuracy)
            
            # Consistency decreases with larger differences
            consistency = max(0.0, 1.0 - (accuracy_diff * 2))
            
            return consistency
            
        except Exception as e:
            logger.error(f"Error calculating batch consistency: {e}")
            return 0.5
    
    def _update_generation_metrics(self, generation: int, metrics: LearningQualityMetrics):
        """Update generation-based metrics tracking"""
        if generation not in self.generation_metrics:
            self.generation_metrics[generation] = []
        
        self.generation_metrics[generation].append(metrics)
    
    def _update_territory_metrics(self, territory_id: str, metrics: LearningQualityMetrics):
        """Update territory-based metrics tracking"""
        if territory_id not in self.territory_metrics:
            self.territory_metrics[territory_id] = []
        
        self.territory_metrics[territory_id].append(metrics)
    
    async def get_learning_quality_summary(self, queen_id: Optional[str] = None,
                                         territory_id: Optional[str] = None,
                                         generation: Optional[int] = None) -> Dict[str, Any]:
        """
        Get comprehensive learning quality summary with filtering options
        
        Args:
            queen_id: Filter by specific Queen
            territory_id: Filter by specific territory
            generation: Filter by specific generation
            
        Returns:
            Learning quality summary
        """
        try:
            # Filter metrics based on criteria
            filtered_metrics = list(self.metrics_history)
            
            if queen_id:
                filtered_metrics = [m for m in filtered_metrics if m.queen_id == queen_id]
            
            if territory_id:
                filtered_metrics = [m for m in filtered_metrics if m.territory_id == territory_id]
            
            if generation:
                filtered_metrics = [m for m in filtered_metrics if m.generation == generation]
            
            if not filtered_metrics:
                return {
                    'status': 'no_data',
                    'message': 'No metrics found for specified criteria'
                }
            
            # Calculate summary statistics
            accuracies = [m.prediction_accuracy for m in filtered_metrics]
            retentions = [m.accuracy_retention for m in filtered_metrics]
            stabilities = [m.learning_stability for m in filtered_metrics]
            progressions = [m.learning_progression_score for m in filtered_metrics]
            
            summary = {
                'status': 'success',
                'total_measurements': len(filtered_metrics),
                'time_range': {
                    'start': min(m.timestamp for m in filtered_metrics),
                    'end': max(m.timestamp for m in filtered_metrics)
                },
                'accuracy_stats': {
                    'mean': np.mean(accuracies),
                    'std': np.std(accuracies),
                    'min': np.min(accuracies),
                    'max': np.max(accuracies)
                },
                'retention_stats': {
                    'mean': np.mean(retentions),
                    'std': np.std(retentions),
                    'min': np.min(retentions),
                    'max': np.max(retentions)
                },
                'stability_stats': {
                    'mean': np.mean(stabilities),
                    'std': np.std(stabilities),
                    'min': np.min(stabilities),
                    'max': np.max(stabilities)
                },
                'progression_stats': {
                    'mean': np.mean(progressions),
                    'std': np.std(progressions),
                    'min': np.min(progressions),
                    'max': np.max(progressions)
                },
                'quality_thresholds': {
                    'min_accuracy_retention': self.validator.thresholds.min_accuracy_retention,
                    'min_learning_stability': self.validator.thresholds.min_learning_stability,
                    'max_accuracy_loss': self.validator.thresholds.max_accuracy_loss
                },
                'violations': {
                    'accuracy_retention_violations': len([r for r in retentions if r < self.validator.thresholds.min_accuracy_retention]),
                    'stability_violations': len([s for s in stabilities if s < self.validator.thresholds.min_learning_stability])
                }
            }
            
            # Add trend analysis
            if len(filtered_metrics) >= 5:
                recent_metrics = sorted(filtered_metrics, key=lambda x: x.timestamp)[-5:]
                recent_accuracies = [m.prediction_accuracy for m in recent_metrics]
                
                # Calculate trend
                if len(recent_accuracies) >= 2:
                    trend = (recent_accuracies[-1] - recent_accuracies[0]) / len(recent_accuracies)
                    summary['trend_analysis'] = {
                        'accuracy_trend': trend,
                        'trend_direction': 'improving' if trend > 0.01 else 'declining' if trend < -0.01 else 'stable'
                    }
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting learning quality summary: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def get_generation_quality_comparison(self, generations: List[int]) -> Dict[str, Any]:
        """
        Compare learning quality across multiple generations (Requirement 6.4)
        
        Args:
            generations: List of generations to compare
            
        Returns:
            Generation comparison results
        """
        try:
            comparison_results = {
                'generations': generations,
                'comparison_data': {},
                'trends': {},
                'recommendations': []
            }
            
            for generation in generations:
                gen_metrics = [m for m in self.metrics_history if m.generation == generation]
                
                if gen_metrics:
                    accuracies = [m.prediction_accuracy for m in gen_metrics]
                    retentions = [m.accuracy_retention for m in gen_metrics]
                    stabilities = [m.learning_stability for m in gen_metrics]
                    
                    comparison_results['comparison_data'][generation] = {
                        'count': len(gen_metrics),
                        'avg_accuracy': np.mean(accuracies),
                        'avg_retention': np.mean(retentions),
                        'avg_stability': np.mean(stabilities),
                        'quality_score': (np.mean(accuracies) + np.mean(retentions) + np.mean(stabilities)) / 3
                    }
            
            # Calculate trends across generations
            if len(comparison_results['comparison_data']) >= 2:
                sorted_generations = sorted(comparison_results['comparison_data'].keys())
                quality_scores = [comparison_results['comparison_data'][gen]['quality_score'] 
                                for gen in sorted_generations]
                
                # Calculate overall trend
                if len(quality_scores) >= 2:
                    trend = (quality_scores[-1] - quality_scores[0]) / len(quality_scores)
                    comparison_results['trends']['overall_quality_trend'] = trend
                    comparison_results['trends']['trend_direction'] = (
                        'improving' if trend > 0.02 else 'declining' if trend < -0.02 else 'stable'
                    )
                
                # Generate recommendations
                if trend < -0.05:
                    comparison_results['recommendations'].append(
                        "Learning quality is declining across generations - consider reducing optimization aggressiveness"
                    )
                elif trend > 0.05:
                    comparison_results['recommendations'].append(
                        "Learning quality is improving - current optimization approach is effective"
                    )
                else:
                    comparison_results['recommendations'].append(
                        "Learning quality is stable across generations"
                    )
            
            return comparison_results
            
        except Exception as e:
            logger.error(f"Error comparing generation quality: {e}")
            return {
                'error': str(e),
                'generations': generations
            }
    
    def add_monitoring_callback(self, callback: callable):
        """Add callback for quality monitoring events"""
        self.monitoring_callbacks.append(callback)
        logger.info("Quality monitoring callback added")
    
    async def _save_metrics_to_disk(self):
        """Save quality metrics to disk"""
        try:
            metrics_data = {
                'metrics_history': [m.to_dict() for m in self.metrics_history],
                'generation_metrics': {
                    str(gen): [m.to_dict() for m in metrics]
                    for gen, metrics in self.generation_metrics.items()
                },
                'territory_metrics': {
                    territory: [m.to_dict() for m in metrics]
                    for territory, metrics in self.territory_metrics.items()
                },
                'baseline_metrics': {
                    queen_id: metrics.to_dict()
                    for queen_id, metrics in self.validator.baseline_metrics.items()
                },
                'saved_at': time.time()
            }
            
            with open(self.metrics_file, 'w') as f:
                json.dump(metrics_data, f, indent=2)
            
            logger.info(f"Quality metrics saved to {self.metrics_file}")
            
        except Exception as e:
            logger.error(f"Error saving metrics to disk: {e}")
    
    async def load_metrics_from_disk(self) -> bool:
        """Load quality metrics from disk"""
        try:
            if not os.path.exists(self.metrics_file):
                logger.info("No existing quality metrics file found")
                return False
            
            with open(self.metrics_file, 'r') as f:
                metrics_data = json.load(f)
            
            # Load metrics history
            for metric_dict in metrics_data.get('metrics_history', []):
                metrics = LearningQualityMetrics(**metric_dict)
                self.metrics_history.append(metrics)
            
            # Load generation metrics
            for gen_str, metrics_list in metrics_data.get('generation_metrics', {}).items():
                generation = int(gen_str)
                self.generation_metrics[generation] = [
                    LearningQualityMetrics(**m) for m in metrics_list
                ]
            
            # Load territory metrics
            for territory, metrics_list in metrics_data.get('territory_metrics', {}).items():
                self.territory_metrics[territory] = [
                    LearningQualityMetrics(**m) for m in metrics_list
                ]
            
            # Load baseline metrics
            for queen_id, metric_dict in metrics_data.get('baseline_metrics', {}).items():
                baseline_metrics = LearningQualityMetrics(**metric_dict)
                self.validator.set_baseline_metrics(queen_id, baseline_metrics)
            
            logger.info(f"Quality metrics loaded: {len(self.metrics_history)} total measurements")
            return True
            
        except Exception as e:
            logger.error(f"Error loading metrics from disk: {e}")
            return False
    
    async def cleanup(self):
        """Cleanup learning quality monitor resources"""
        await self.stop_monitoring()
        self.metrics_history.clear()
        self.generation_metrics.clear()
        self.territory_metrics.clear()
        self.monitoring_callbacks.clear()
        logger.info("Learning quality monitor cleanup completed")