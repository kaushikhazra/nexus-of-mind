"""
Advanced Alerting System - Enhanced threshold-based alerting with trend analysis and diagnostics
Implements Requirements 4.2, 4.5 for advanced performance monitoring and alerting
"""

import asyncio
import logging
import time
import statistics
from typing import Dict, Any, List, Optional, Callable, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from collections import defaultdict, deque
from enum import Enum
import json

from .performance_profiler import PerformanceProfiler, ProfilingMetrics

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class TrendDirection(Enum):
    """Performance trend directions"""
    IMPROVING = "improving"
    STABLE = "stable"
    DEGRADING = "degrading"
    VOLATILE = "volatile"


@dataclass
class PerformanceTrend:
    """Performance trend analysis data"""
    metric_name: str
    trend_direction: TrendDirection
    trend_strength: float  # 0.0 to 1.0
    recent_average: float
    historical_average: float
    change_percent: float
    confidence_level: float  # 0.0 to 1.0
    data_points: int
    analysis_window_hours: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'metric_name': self.metric_name,
            'trend_direction': self.trend_direction.value,
            'trend_strength': self.trend_strength,
            'recent_average': self.recent_average,
            'historical_average': self.historical_average,
            'change_percent': self.change_percent,
            'confidence_level': self.confidence_level,
            'data_points': self.data_points,
            'analysis_window_hours': self.analysis_window_hours
        }


@dataclass
class DiagnosticRecommendation:
    """Diagnostic recommendation with priority and impact"""
    id: str
    title: str
    description: str
    priority: str  # 'high', 'medium', 'low'
    category: str  # 'performance', 'memory', 'gpu', 'configuration'
    estimated_impact: str  # 'high', 'medium', 'low'
    implementation_effort: str  # 'easy', 'moderate', 'complex'
    related_metrics: List[str]
    action_items: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AdvancedAlert:
    """Enhanced alert with trend analysis and diagnostics"""
    id: str
    severity: AlertSeverity
    type: str
    title: str
    message: str
    timestamp: float
    acknowledged: bool = False
    auto_resolve: bool = True
    trend_analysis: Optional[PerformanceTrend] = None
    diagnostic_recommendations: List[DiagnosticRecommendation] = None
    related_metrics: Dict[str, Any] = None
    confidence_score: float = 1.0
    
    def __post_init__(self):
        if self.diagnostic_recommendations is None:
            self.diagnostic_recommendations = []
        if self.related_metrics is None:
            self.related_metrics = {}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'severity': self.severity.value,
            'type': self.type,
            'title': self.title,
            'message': self.message,
            'timestamp': self.timestamp,
            'acknowledged': self.acknowledged,
            'auto_resolve': self.auto_resolve,
            'trend_analysis': self.trend_analysis.to_dict() if self.trend_analysis else None,
            'diagnostic_recommendations': [rec.to_dict() for rec in self.diagnostic_recommendations],
            'related_metrics': self.related_metrics,
            'confidence_score': self.confidence_score
        }


class TrendAnalyzer:
    """Advanced trend analysis for performance metrics"""
    
    def __init__(self, analysis_window_hours: int = 24):
        self.analysis_window_hours = analysis_window_hours
        self.min_data_points = 10
        self.trend_threshold = 0.05  # 5% change threshold
        
    def analyze_metric_trend(self, metrics: List[ProfilingMetrics], 
                           metric_name: str, 
                           extractor_func: Callable[[ProfilingMetrics], float]) -> Optional[PerformanceTrend]:
        """
        Analyze trend for a specific metric
        
        Args:
            metrics: List of profiling metrics
            metric_name: Name of the metric being analyzed
            extractor_func: Function to extract metric value from ProfilingMetrics
            
        Returns:
            PerformanceTrend object or None if insufficient data
        """
        if len(metrics) < self.min_data_points:
            return None
        
        # Extract metric values with timestamps
        metric_data = []
        for metric in metrics:
            try:
                value = extractor_func(metric)
                if value is not None:
                    metric_data.append((metric.timestamp, value))
            except (AttributeError, TypeError):
                continue
        
        if len(metric_data) < self.min_data_points:
            return None
        
        # Sort by timestamp
        metric_data.sort(key=lambda x: x[0])
        
        # Split into recent and historical periods
        current_time = time.time()
        split_time = current_time - (self.analysis_window_hours * 3600 / 2)  # Half the window
        
        recent_data = [value for timestamp, value in metric_data if timestamp >= split_time]
        historical_data = [value for timestamp, value in metric_data if timestamp < split_time]
        
        if len(recent_data) < 3 or len(historical_data) < 3:
            return None
        
        # Calculate averages
        recent_avg = statistics.mean(recent_data)
        historical_avg = statistics.mean(historical_data)
        
        # Calculate change percentage
        change_percent = ((recent_avg - historical_avg) / historical_avg) * 100 if historical_avg != 0 else 0
        
        # Determine trend direction
        if abs(change_percent) < self.trend_threshold * 100:
            trend_direction = TrendDirection.STABLE
        elif change_percent > 0:
            trend_direction = TrendDirection.DEGRADING if metric_name in ['inference_time', 'memory_usage'] else TrendDirection.IMPROVING
        else:
            trend_direction = TrendDirection.IMPROVING if metric_name in ['inference_time', 'memory_usage'] else TrendDirection.DEGRADING
        
        # Calculate trend strength (0.0 to 1.0)
        trend_strength = min(1.0, abs(change_percent) / 50.0)  # Normalize to 50% max change
        
        # Calculate confidence level based on data consistency
        recent_std = statistics.stdev(recent_data) if len(recent_data) > 1 else 0
        historical_std = statistics.stdev(historical_data) if len(historical_data) > 1 else 0
        
        # Lower standard deviation = higher confidence
        avg_std = (recent_std + historical_std) / 2
        confidence_level = max(0.1, 1.0 - (avg_std / max(recent_avg, historical_avg, 1.0)))
        
        # Check for volatility
        if recent_std > recent_avg * 0.5:  # High volatility
            trend_direction = TrendDirection.VOLATILE
            confidence_level *= 0.5
        
        return PerformanceTrend(
            metric_name=metric_name,
            trend_direction=trend_direction,
            trend_strength=trend_strength,
            recent_average=recent_avg,
            historical_average=historical_avg,
            change_percent=change_percent,
            confidence_level=confidence_level,
            data_points=len(metric_data),
            analysis_window_hours=self.analysis_window_hours
        )
    
    def analyze_all_trends(self, metrics: List[ProfilingMetrics]) -> Dict[str, PerformanceTrend]:
        """Analyze trends for all key performance metrics"""
        trends = {}
        
        # Define metric extractors
        extractors = {
            'inference_time': lambda m: m.execution_time_ms if m.operation_type == 'inference' else None,
            'memory_usage': lambda m: abs(m.memory_delta_mb),
            'gpu_utilization': lambda m: m.gpu_utilization_percent,
            'throughput': lambda m: 1000.0 / m.execution_time_ms if m.execution_time_ms > 0 else None
        }
        
        for metric_name, extractor in extractors.items():
            trend = self.analyze_metric_trend(metrics, metric_name, extractor)
            if trend:
                trends[metric_name] = trend
        
        return trends


class DiagnosticEngine:
    """Advanced diagnostic engine for performance issues"""
    
    def __init__(self):
        self.recommendation_counter = 0
        
    def generate_diagnostics(self, metrics: List[ProfilingMetrics], 
                           trends: Dict[str, PerformanceTrend],
                           current_metrics: ProfilingMetrics) -> List[DiagnosticRecommendation]:
        """Generate diagnostic recommendations based on metrics and trends"""
        recommendations = []
        
        # Analyze inference time issues
        if 'inference_time' in trends:
            inference_trend = trends['inference_time']
            if inference_trend.trend_direction == TrendDirection.DEGRADING:
                recommendations.extend(self._diagnose_inference_degradation(inference_trend, current_metrics))
        
        # Analyze memory issues
        if 'memory_usage' in trends:
            memory_trend = trends['memory_usage']
            if memory_trend.trend_direction == TrendDirection.DEGRADING:
                recommendations.extend(self._diagnose_memory_issues(memory_trend, current_metrics))
        
        # Analyze GPU utilization
        if 'gpu_utilization' in trends:
            gpu_trend = trends['gpu_utilization']
            recommendations.extend(self._diagnose_gpu_issues(gpu_trend, current_metrics))
        
        # Analyze throughput issues
        if 'throughput' in trends:
            throughput_trend = trends['throughput']
            if throughput_trend.trend_direction == TrendDirection.DEGRADING:
                recommendations.extend(self._diagnose_throughput_issues(throughput_trend, current_metrics))
        
        # Cross-metric analysis
        recommendations.extend(self._diagnose_cross_metric_issues(trends, current_metrics))
        
        return recommendations
    
    def _diagnose_inference_degradation(self, trend: PerformanceTrend, 
                                      current_metrics: ProfilingMetrics) -> List[DiagnosticRecommendation]:
        """Diagnose inference time degradation"""
        recommendations = []
        
        if trend.change_percent > 20:  # Significant degradation
            self.recommendation_counter += 1
            recommendations.append(DiagnosticRecommendation(
                id=f"inference_degradation_{self.recommendation_counter}",
                title="Significant Inference Time Degradation Detected",
                description=f"Inference time has increased by {trend.change_percent:.1f}% over the analysis period. "
                           f"Current average: {trend.recent_average:.1f}ms, Historical: {trend.historical_average:.1f}ms",
                priority="high",
                category="performance",
                estimated_impact="high",
                implementation_effort="moderate",
                related_metrics=["inference_time", "gpu_utilization", "memory_usage"],
                action_items=[
                    "Review recent model changes or updates",
                    "Check GPU memory availability and utilization",
                    "Consider model quantization if not already applied",
                    "Verify batch processing configuration",
                    "Monitor for memory leaks or resource contention"
                ]
            ))
        
        if current_metrics.execution_time_ms > 16.0:  # Above target
            self.recommendation_counter += 1
            recommendations.append(DiagnosticRecommendation(
                id=f"inference_target_miss_{self.recommendation_counter}",
                title="Inference Time Target Not Met",
                description=f"Current inference time ({current_metrics.execution_time_ms:.1f}ms) exceeds "
                           f"the 16ms target for 60fps gameplay",
                priority="high",
                category="performance",
                estimated_impact="high",
                implementation_effort="easy",
                related_metrics=["inference_time"],
                action_items=[
                    "Enable GPU acceleration if available",
                    "Apply model quantization (float32 → int8)",
                    "Optimize batch processing parameters",
                    "Review model architecture complexity"
                ]
            ))
        
        return recommendations
    
    def _diagnose_memory_issues(self, trend: PerformanceTrend, 
                              current_metrics: ProfilingMetrics) -> List[DiagnosticRecommendation]:
        """Diagnose memory usage issues"""
        recommendations = []
        
        if trend.recent_average > 150:  # High memory usage
            self.recommendation_counter += 1
            recommendations.append(DiagnosticRecommendation(
                id=f"high_memory_usage_{self.recommendation_counter}",
                title="High Memory Usage Detected",
                description=f"Average memory usage ({trend.recent_average:.1f}MB) is approaching limits. "
                           f"Trend shows {trend.change_percent:.1f}% change",
                priority="medium",
                category="memory",
                estimated_impact="medium",
                implementation_effort="moderate",
                related_metrics=["memory_usage", "batch_size"],
                action_items=[
                    "Reduce batch processing sizes",
                    "Enable memory optimization features",
                    "Review model size and complexity",
                    "Implement more aggressive garbage collection",
                    "Monitor for memory leaks in training loops"
                ]
            ))
        
        return recommendations
    
    def _diagnose_gpu_issues(self, trend: PerformanceTrend, 
                           current_metrics: ProfilingMetrics) -> List[DiagnosticRecommendation]:
        """Diagnose GPU utilization issues"""
        recommendations = []
        
        if trend.recent_average < 30 and current_metrics.gpu_utilization_percent is not None:
            self.recommendation_counter += 1
            recommendations.append(DiagnosticRecommendation(
                id=f"low_gpu_utilization_{self.recommendation_counter}",
                title="Low GPU Utilization",
                description=f"GPU utilization ({trend.recent_average:.1f}%) is below optimal levels. "
                           f"This may indicate underutilized hardware resources",
                priority="medium",
                category="gpu",
                estimated_impact="medium",
                implementation_effort="easy",
                related_metrics=["gpu_utilization", "throughput"],
                action_items=[
                    "Increase batch processing sizes",
                    "Enable mixed precision training (float16)",
                    "Optimize CUDA stream configuration",
                    "Review model parallelization settings",
                    "Consider increasing model complexity if performance allows"
                ]
            ))
        
        return recommendations
    
    def _diagnose_throughput_issues(self, trend: PerformanceTrend, 
                                  current_metrics: ProfilingMetrics) -> List[DiagnosticRecommendation]:
        """Diagnose throughput performance issues"""
        recommendations = []
        
        if trend.recent_average < 100:  # Below 100 predictions/sec target
            self.recommendation_counter += 1
            recommendations.append(DiagnosticRecommendation(
                id=f"low_throughput_{self.recommendation_counter}",
                title="Throughput Below Target",
                description=f"Current throughput ({trend.recent_average:.1f} pred/sec) is below the "
                           f"100 predictions/second target",
                priority="high",
                category="performance",
                estimated_impact="high",
                implementation_effort="moderate",
                related_metrics=["throughput", "batch_size", "inference_time"],
                action_items=[
                    "Optimize batch processing configuration",
                    "Enable GPU acceleration for parallel processing",
                    "Review request queuing and prioritization",
                    "Consider model quantization for faster inference",
                    "Implement more efficient data preprocessing"
                ]
            ))
        
        return recommendations
    
    def _diagnose_cross_metric_issues(self, trends: Dict[str, PerformanceTrend], 
                                    current_metrics: ProfilingMetrics) -> List[DiagnosticRecommendation]:
        """Diagnose issues that span multiple metrics"""
        recommendations = []
        
        # Check for correlated degradation
        degrading_metrics = [name for name, trend in trends.items() 
                           if trend.trend_direction == TrendDirection.DEGRADING]
        
        if len(degrading_metrics) >= 2:
            self.recommendation_counter += 1
            recommendations.append(DiagnosticRecommendation(
                id=f"multi_metric_degradation_{self.recommendation_counter}",
                title="Multiple Performance Metrics Degrading",
                description=f"Multiple metrics showing degradation: {', '.join(degrading_metrics)}. "
                           f"This may indicate a systemic performance issue",
                priority="critical",
                category="performance",
                estimated_impact="high",
                implementation_effort="complex",
                related_metrics=degrading_metrics,
                action_items=[
                    "Perform comprehensive system health check",
                    "Review recent configuration changes",
                    "Check for resource contention or hardware issues",
                    "Consider rolling back recent optimizations",
                    "Implement emergency performance recovery procedures"
                ]
            ))
        
        return recommendations


class AdvancedAlertingSystem:
    """
    Advanced alerting system with trend analysis and diagnostic recommendations
    Implements Requirements 4.2, 4.5
    """
    
    def __init__(self, profiler: PerformanceProfiler):
        self.profiler = profiler
        self.trend_analyzer = TrendAnalyzer()
        self.diagnostic_engine = DiagnosticEngine()
        
        # Alert management
        self.alerts: deque = deque(maxlen=1000)
        self.alert_callbacks: List[Callable] = []
        self.alert_counter = 0
        
        # Configuration
        self.config = {
            'trend_analysis_enabled': True,
            'diagnostic_recommendations_enabled': True,
            'proactive_alerting_enabled': True,
            'alert_suppression_enabled': True,
            'max_alerts_per_hour': 50,
            'trend_analysis_window_hours': 24
        }
        
        # Alert suppression tracking
        self.alert_history = defaultdict(list)
        self.suppression_windows = {
            'inference_performance': 300,  # 5 minutes
            'memory_usage': 600,  # 10 minutes
            'gpu_utilization': 900,  # 15 minutes
        }
        
        # Performance tracking
        self.system_metrics = {
            'alerts_generated': 0,
            'alerts_suppressed': 0,
            'trend_analyses_performed': 0,
            'diagnostics_generated': 0
        }
    
    def check_and_generate_alerts(self, current_metrics: ProfilingMetrics) -> List[AdvancedAlert]:
        """
        Check current metrics and generate advanced alerts with trend analysis
        
        Args:
            current_metrics: Latest profiling metrics
            
        Returns:
            List of generated advanced alerts
        """
        new_alerts = []
        current_time = time.time()
        
        try:
            # Get recent metrics for trend analysis
            recent_metrics = list(self.profiler.metrics_history)[-1000:]  # Last 1000 operations
            
            # Perform trend analysis if enabled
            trends = {}
            if self.config['trend_analysis_enabled'] and len(recent_metrics) >= 10:
                trends = self.trend_analyzer.analyze_all_trends(recent_metrics)
                self.system_metrics['trend_analyses_performed'] += 1
            
            # Generate diagnostic recommendations if enabled
            diagnostics = []
            if self.config['diagnostic_recommendations_enabled'] and trends:
                diagnostics = self.diagnostic_engine.generate_diagnostics(
                    recent_metrics, trends, current_metrics
                )
                self.system_metrics['diagnostics_generated'] += len(diagnostics)
            
            # Check for immediate performance violations
            immediate_alerts = self._check_immediate_violations(current_metrics, trends, diagnostics)
            new_alerts.extend(immediate_alerts)
            
            # Check for proactive trend-based alerts
            if self.config['proactive_alerting_enabled']:
                proactive_alerts = self._check_proactive_alerts(trends, diagnostics)
                new_alerts.extend(proactive_alerts)
            
            # Apply alert suppression if enabled
            if self.config['alert_suppression_enabled']:
                new_alerts = self._apply_alert_suppression(new_alerts, current_time)
            
            # Add alerts to history and trigger callbacks
            for alert in new_alerts:
                self.alerts.append(alert)
                self.system_metrics['alerts_generated'] += 1
                logger.info(f"Generated advanced alert [{alert.severity.value.upper()}]: {alert.title}")
                
                # Trigger callbacks
                for callback in self.alert_callbacks:
                    try:
                        callback(alert)
                    except Exception as e:
                        logger.error(f"Alert callback failed: {e}")
            
            return new_alerts
            
        except Exception as e:
            logger.error(f"Failed to generate advanced alerts: {e}")
            return []
    
    def _check_immediate_violations(self, metrics: ProfilingMetrics, 
                                  trends: Dict[str, PerformanceTrend],
                                  diagnostics: List[DiagnosticRecommendation]) -> List[AdvancedAlert]:
        """Check for immediate performance threshold violations"""
        alerts = []
        current_time = time.time()
        
        # Critical inference time violation
        if metrics.execution_time_ms > 20.0:
            self.alert_counter += 1
            alert = AdvancedAlert(
                id=f"critical_inference_{self.alert_counter}",
                severity=AlertSeverity.CRITICAL,
                type="inference_performance",
                title="Critical Inference Time Violation",
                message=f"Inference time ({metrics.execution_time_ms:.1f}ms) critically exceeds target (16ms)",
                timestamp=current_time,
                trend_analysis=trends.get('inference_time'),
                diagnostic_recommendations=[d for d in diagnostics if 'inference' in d.category.lower()],
                related_metrics={
                    'current_inference_time_ms': metrics.execution_time_ms,
                    'target_inference_time_ms': 16.0,
                    'violation_percent': ((metrics.execution_time_ms - 16.0) / 16.0) * 100
                },
                confidence_score=0.95
            )
            alerts.append(alert)
        
        # Memory usage critical violation
        if abs(metrics.memory_delta_mb) > 200.0:
            self.alert_counter += 1
            alert = AdvancedAlert(
                id=f"critical_memory_{self.alert_counter}",
                severity=AlertSeverity.CRITICAL,
                type="memory_usage",
                title="Critical Memory Usage Violation",
                message=f"Memory usage ({metrics.memory_delta_mb:.1f}MB) exceeds critical limit (200MB)",
                timestamp=current_time,
                trend_analysis=trends.get('memory_usage'),
                diagnostic_recommendations=[d for d in diagnostics if 'memory' in d.category.lower()],
                related_metrics={
                    'current_memory_usage_mb': abs(metrics.memory_delta_mb),
                    'memory_limit_mb': 200.0,
                    'violation_percent': ((abs(metrics.memory_delta_mb) - 200.0) / 200.0) * 100
                },
                confidence_score=0.90
            )
            alerts.append(alert)
        
        return alerts
    
    def _check_proactive_alerts(self, trends: Dict[str, PerformanceTrend],
                              diagnostics: List[DiagnosticRecommendation]) -> List[AdvancedAlert]:
        """Check for proactive alerts based on trend analysis"""
        alerts = []
        current_time = time.time()
        
        # Proactive inference degradation alert
        if 'inference_time' in trends:
            trend = trends['inference_time']
            if (trend.trend_direction == TrendDirection.DEGRADING and 
                trend.confidence_level > 0.7 and 
                trend.change_percent > 15):
                
                self.alert_counter += 1
                alert = AdvancedAlert(
                    id=f"proactive_inference_{self.alert_counter}",
                    severity=AlertSeverity.WARNING,
                    type="proactive_performance",
                    title="Proactive: Inference Performance Degradation Trend",
                    message=f"Inference time trending upward ({trend.change_percent:.1f}% increase). "
                           f"Intervention recommended before critical thresholds are reached",
                    timestamp=current_time,
                    trend_analysis=trend,
                    diagnostic_recommendations=[d for d in diagnostics if 'inference' in d.title.lower()],
                    related_metrics={
                        'trend_strength': trend.trend_strength,
                        'confidence_level': trend.confidence_level,
                        'projected_impact': 'high' if trend.change_percent > 25 else 'medium'
                    },
                    confidence_score=trend.confidence_level
                )
                alerts.append(alert)
        
        # Proactive memory usage alert
        if 'memory_usage' in trends:
            trend = trends['memory_usage']
            if (trend.trend_direction == TrendDirection.DEGRADING and 
                trend.confidence_level > 0.6 and 
                trend.recent_average > 150):
                
                self.alert_counter += 1
                alert = AdvancedAlert(
                    id=f"proactive_memory_{self.alert_counter}",
                    severity=AlertSeverity.WARNING,
                    type="proactive_memory",
                    title="Proactive: Memory Usage Approaching Limits",
                    message=f"Memory usage trending upward (current avg: {trend.recent_average:.1f}MB). "
                           f"Approaching 200MB limit",
                    timestamp=current_time,
                    trend_analysis=trend,
                    diagnostic_recommendations=[d for d in diagnostics if 'memory' in d.category.lower()],
                    related_metrics={
                        'current_average_mb': trend.recent_average,
                        'limit_mb': 200.0,
                        'buffer_remaining_mb': 200.0 - trend.recent_average
                    },
                    confidence_score=trend.confidence_level
                )
                alerts.append(alert)
        
        return alerts
    
    def _apply_alert_suppression(self, alerts: List[AdvancedAlert], 
                               current_time: float) -> List[AdvancedAlert]:
        """Apply alert suppression to prevent spam"""
        filtered_alerts = []
        
        for alert in alerts:
            # Check if this alert type was recently generated
            alert_type = alert.type
            recent_alerts = [
                timestamp for timestamp in self.alert_history[alert_type]
                if current_time - timestamp < self.suppression_windows.get(alert_type, 300)
            ]
            
            # Clean old entries
            self.alert_history[alert_type] = [
                timestamp for timestamp in self.alert_history[alert_type]
                if current_time - timestamp < 3600  # Keep 1 hour of history
            ]
            
            # Check suppression
            if len(recent_alerts) < 3:  # Allow up to 3 alerts per suppression window
                filtered_alerts.append(alert)
                self.alert_history[alert_type].append(current_time)
            else:
                self.system_metrics['alerts_suppressed'] += 1
                logger.debug(f"Suppressed alert of type {alert_type} due to recent similar alerts")
        
        return filtered_alerts
    
    def get_active_alerts(self, max_age_hours: int = 24) -> List[AdvancedAlert]:
        """Get active advanced alerts within the specified time window"""
        cutoff_time = time.time() - (max_age_hours * 3600)
        return [alert for alert in self.alerts 
                if alert.timestamp >= cutoff_time and not alert.acknowledged]
    
    def acknowledge_alert(self, alert_id: str) -> bool:
        """Acknowledge an alert by ID"""
        for alert in self.alerts:
            if alert.id == alert_id:
                alert.acknowledged = True
                logger.info(f"Advanced alert {alert_id} acknowledged")
                return True
        return False
    
    def get_alert_analytics(self) -> Dict[str, Any]:
        """Get comprehensive alert analytics and statistics"""
        active_alerts = self.get_active_alerts()
        
        # Severity distribution
        severity_counts = defaultdict(int)
        for alert in active_alerts:
            severity_counts[alert.severity.value] += 1
        
        # Type distribution
        type_counts = defaultdict(int)
        for alert in active_alerts:
            type_counts[alert.type] += 1
        
        # Trend analysis summary
        trend_alerts = [alert for alert in active_alerts if alert.trend_analysis]
        avg_confidence = statistics.mean([alert.confidence_score for alert in active_alerts]) if active_alerts else 0.0
        
        # Diagnostic summary
        all_diagnostics = []
        for alert in active_alerts:
            all_diagnostics.extend(alert.diagnostic_recommendations)
        
        diagnostic_categories = defaultdict(int)
        for diagnostic in all_diagnostics:
            diagnostic_categories[diagnostic.category] += 1
        
        return {
            'summary': {
                'total_active_alerts': len(active_alerts),
                'alerts_with_trends': len(trend_alerts),
                'alerts_with_diagnostics': len([a for a in active_alerts if a.diagnostic_recommendations]),
                'average_confidence_score': avg_confidence
            },
            'distribution': {
                'by_severity': dict(severity_counts),
                'by_type': dict(type_counts),
                'by_diagnostic_category': dict(diagnostic_categories)
            },
            'system_metrics': self.system_metrics.copy(),
            'configuration': self.config.copy(),
            'most_critical_alert': max(active_alerts, 
                                     key=lambda a: (a.severity.value == 'critical', a.confidence_score)).to_dict() 
                                   if active_alerts else None
        }
    
    def add_alert_callback(self, callback: Callable):
        """Add callback for new alerts"""
        self.alert_callbacks.append(callback)
    
    def update_configuration(self, new_config: Dict[str, Any]):
        """Update alerting system configuration"""
        self.config.update(new_config)
        logger.info(f"Advanced alerting system configuration updated: {new_config}")
    
    async def cleanup(self):
        """Cleanup alerting system resources"""
        self.alerts.clear()
        self.alert_callbacks.clear()
        self.alert_history.clear()
        logger.info("Advanced alerting system cleanup completed")