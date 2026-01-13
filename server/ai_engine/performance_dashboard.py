"""
Performance Dashboard - Real-time performance monitoring dashboard for neural network operations
Implements Requirement 4.4 for performance dashboard and real-time monitoring
"""

import asyncio
import logging
import time
import json
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import threading
from collections import defaultdict, deque

from .performance_profiler import PerformanceProfiler, ProfilingMetrics
from .advanced_alerting_system import AdvancedAlertingSystem, AdvancedAlert

logger = logging.getLogger(__name__)


@dataclass
class DashboardAlert:
    """Dashboard alert data structure"""
    id: str
    severity: str  # 'info', 'warning', 'critical'
    type: str
    message: str
    timestamp: float
    acknowledged: bool = False
    auto_resolve: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RealTimeMetrics:
    """Real-time metrics for dashboard display"""
    timestamp: float
    current_inference_time_ms: float
    current_memory_usage_mb: float
    current_gpu_utilization: Optional[float]
    operations_per_minute: float
    target_compliance_rate: float
    active_alerts_count: int
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class MetricsAggregator:
    """Aggregates and processes metrics for dashboard display"""
    
    def __init__(self, window_size_minutes: int = 60):
        self.window_size_minutes = window_size_minutes
        self.metrics_window: deque = deque(maxlen=window_size_minutes * 60)  # 1 per second
        self.operation_counts = defaultdict(int)
        self.last_aggregation_time = time.time()
    
    def add_metrics(self, metrics: ProfilingMetrics):
        """Add new metrics to the aggregation window"""
        current_time = time.time()
        
        # Add to window
        self.metrics_window.append({
            'timestamp': current_time,
            'metrics': metrics
        })
        
        # Update operation counts
        self.operation_counts[metrics.operation_type] += 1
        
        # Clean old operation counts (older than window)
        cutoff_time = current_time - (self.window_size_minutes * 60)
        # This is simplified - in production you'd want more sophisticated cleanup
    
    def get_aggregated_metrics(self) -> Dict[str, Any]:
        """Get aggregated metrics for the current window"""
        if not self.metrics_window:
            return {'status': 'no_data'}
        
        current_time = time.time()
        window_start = current_time - (self.window_size_minutes * 60)
        
        # Filter metrics within window
        window_metrics = [
            item['metrics'] for item in self.metrics_window 
            if item['timestamp'] >= window_start
        ]
        
        if not window_metrics:
            return {'status': 'no_data'}
        
        # Calculate aggregations
        inference_times = [m.execution_time_ms for m in window_metrics if m.operation_type == 'inference']
        memory_deltas = [m.memory_delta_mb for m in window_metrics]
        gpu_utilizations = [m.gpu_utilization_percent for m in window_metrics if m.gpu_utilization_percent is not None]
        
        # Operations per minute
        operations_per_minute = len(window_metrics) / self.window_size_minutes
        
        # Target compliance
        compliant_operations = sum(1 for m in window_metrics if 
                                 m.meets_inference_target and m.meets_memory_target and m.meets_throughput_target)
        compliance_rate = compliant_operations / len(window_metrics) if window_metrics else 0.0
        
        aggregated = {
            'window_size_minutes': self.window_size_minutes,
            'total_operations': len(window_metrics),
            'operations_per_minute': operations_per_minute,
            'compliance_rate': compliance_rate,
            'inference_stats': {
                'count': len(inference_times),
                'avg_ms': sum(inference_times) / len(inference_times) if inference_times else 0.0,
                'max_ms': max(inference_times) if inference_times else 0.0,
                'min_ms': min(inference_times) if inference_times else 0.0
            },
            'memory_stats': {
                'avg_delta_mb': sum(memory_deltas) / len(memory_deltas) if memory_deltas else 0.0,
                'max_delta_mb': max(memory_deltas) if memory_deltas else 0.0,
                'min_delta_mb': min(memory_deltas) if memory_deltas else 0.0
            },
            'gpu_stats': {
                'available': len(gpu_utilizations) > 0,
                'avg_utilization': sum(gpu_utilizations) / len(gpu_utilizations) if gpu_utilizations else 0.0,
                'max_utilization': max(gpu_utilizations) if gpu_utilizations else 0.0
            },
            'operation_breakdown': dict(self.operation_counts)
        }
        
        return aggregated


class AlertManager:
    """Manages dashboard alerts and notifications"""
    
    def __init__(self, max_alerts: int = 100):
        self.max_alerts = max_alerts
        self.alerts: deque = deque(maxlen=max_alerts)
        self.alert_callbacks: List[Callable] = []
        self.alert_counter = 0
        
        # Alert thresholds
        self.thresholds = {
            'inference_time_warning_ms': 12.0,
            'inference_time_critical_ms': 20.0,
            'memory_warning_mb': 150.0,
            'memory_critical_mb': 200.0,
            'compliance_warning_rate': 0.8,
            'compliance_critical_rate': 0.6,
            'operations_per_minute_low': 10.0
        }
    
    def check_and_generate_alerts(self, metrics: ProfilingMetrics, 
                                aggregated_data: Dict[str, Any]) -> List[DashboardAlert]:
        """Check metrics and generate alerts if thresholds are exceeded"""
        new_alerts = []
        current_time = time.time()
        
        # Check inference time alerts
        if metrics.operation_type == 'inference':
            if metrics.execution_time_ms > self.thresholds['inference_time_critical_ms']:
                alert = self._create_alert(
                    'critical', 'inference_performance',
                    f"Inference time {metrics.execution_time_ms:.1f}ms exceeds critical threshold",
                    current_time
                )
                new_alerts.append(alert)
            elif metrics.execution_time_ms > self.thresholds['inference_time_warning_ms']:
                alert = self._create_alert(
                    'warning', 'inference_performance',
                    f"Inference time {metrics.execution_time_ms:.1f}ms exceeds warning threshold",
                    current_time
                )
                new_alerts.append(alert)
        
        # Check memory alerts
        if abs(metrics.memory_delta_mb) > self.thresholds['memory_critical_mb']:
            alert = self._create_alert(
                'critical', 'memory_usage',
                f"Memory usage {metrics.memory_delta_mb:.1f}MB exceeds critical threshold",
                current_time
            )
            new_alerts.append(alert)
        elif abs(metrics.memory_delta_mb) > self.thresholds['memory_warning_mb']:
            alert = self._create_alert(
                'warning', 'memory_usage',
                f"Memory usage {metrics.memory_delta_mb:.1f}MB exceeds warning threshold",
                current_time
            )
            new_alerts.append(alert)
        
        # Check compliance rate alerts (from aggregated data)
        compliance_rate = aggregated_data.get('compliance_rate', 1.0)
        if compliance_rate < self.thresholds['compliance_critical_rate']:
            alert = self._create_alert(
                'critical', 'compliance_rate',
                f"Performance compliance rate {compliance_rate:.1%} is critically low",
                current_time
            )
            new_alerts.append(alert)
        elif compliance_rate < self.thresholds['compliance_warning_rate']:
            alert = self._create_alert(
                'warning', 'compliance_rate',
                f"Performance compliance rate {compliance_rate:.1%} is below target",
                current_time
            )
            new_alerts.append(alert)
        
        # Check operations per minute
        ops_per_minute = aggregated_data.get('operations_per_minute', 0.0)
        if ops_per_minute < self.thresholds['operations_per_minute_low']:
            alert = self._create_alert(
                'info', 'low_activity',
                f"Low neural network activity: {ops_per_minute:.1f} operations/minute",
                current_time
            )
            new_alerts.append(alert)
        
        # Add new alerts to queue
        for alert in new_alerts:
            self.alerts.append(alert)
            logger.info(f"Generated {alert.severity} alert: {alert.message}")
        
        # Trigger alert callbacks
        for callback in self.alert_callbacks:
            try:
                for alert in new_alerts:
                    callback(alert)
            except Exception as e:
                logger.error(f"Alert callback failed: {e}")
        
        return new_alerts
    
    def _create_alert(self, severity: str, alert_type: str, message: str, timestamp: float) -> DashboardAlert:
        """Create a new dashboard alert"""
        self.alert_counter += 1
        return DashboardAlert(
            id=f"alert_{self.alert_counter}_{int(timestamp)}",
            severity=severity,
            type=alert_type,
            message=message,
            timestamp=timestamp
        )
    
    def get_active_alerts(self, max_age_hours: int = 24) -> List[DashboardAlert]:
        """Get active alerts within the specified time window"""
        cutoff_time = time.time() - (max_age_hours * 3600)
        return [alert for alert in self.alerts 
                if alert.timestamp >= cutoff_time and not alert.acknowledged]
    
    def acknowledge_alert(self, alert_id: str) -> bool:
        """Acknowledge an alert by ID"""
        for alert in self.alerts:
            if alert.id == alert_id:
                alert.acknowledged = True
                logger.info(f"Alert {alert_id} acknowledged")
                return True
        return False
    
    def add_alert_callback(self, callback: Callable):
        """Add callback for new alerts"""
        self.alert_callbacks.append(callback)
    
    def get_alert_summary(self) -> Dict[str, Any]:
        """Get summary of alert statistics"""
        active_alerts = self.get_active_alerts()
        
        severity_counts = defaultdict(int)
        type_counts = defaultdict(int)
        
        for alert in active_alerts:
            severity_counts[alert.severity] += 1
            type_counts[alert.type] += 1
        
        return {
            'total_active': len(active_alerts),
            'by_severity': dict(severity_counts),
            'by_type': dict(type_counts),
            'most_recent': active_alerts[-1].to_dict() if active_alerts else None
        }


class PerformanceDashboard:
    """
    Real-time performance monitoring dashboard for neural network operations
    Implements Requirement 4.4 for performance dashboard and real-time monitoring
    """
    
    def __init__(self, profiler: PerformanceProfiler):
        self.profiler = profiler
        self.is_running = False
        self.update_interval_seconds = 1.0
        self.dashboard_thread: Optional[threading.Thread] = None
        
        # Dashboard components
        self.metrics_aggregator = MetricsAggregator(window_size_minutes=60)
        self.alert_manager = AlertManager()
        self.advanced_alerting = AdvancedAlertingSystem(profiler)
        
        # Real-time data storage
        self.current_metrics: Optional[RealTimeMetrics] = None
        self.dashboard_data_cache: Dict[str, Any] = {}
        self.last_update_time = 0.0
        
        # Dashboard configuration
        self.config = {
            'auto_refresh_enabled': True,
            'alert_notifications_enabled': True,
            'detailed_logging_enabled': True,
            'performance_history_hours': 24,
            'max_dashboard_data_points': 1000
        }
        
        # Performance tracking
        self.dashboard_metrics = {
            'total_updates': 0,
            'update_errors': 0,
            'last_error_time': 0.0,
            'avg_update_time_ms': 0.0
        }
    
    async def start_dashboard(self):
        """Start the real-time performance dashboard"""
        if self.is_running:
            logger.warning("Dashboard is already running")
            return
        
        self.is_running = True
        logger.info("Starting performance dashboard...")
        
        # Start dashboard update thread
        self.dashboard_thread = threading.Thread(
            target=self._dashboard_update_loop,
            daemon=True
        )
        self.dashboard_thread.start()
        
        # Set up alert callbacks
        self.alert_manager.add_alert_callback(self._handle_alert_notification)
        
        logger.info("Performance dashboard started successfully")
    
    async def stop_dashboard(self):
        """Stop the performance dashboard"""
        if not self.is_running:
            return
        
        self.is_running = False
        logger.info("Stopping performance dashboard...")
        
        if self.dashboard_thread:
            self.dashboard_thread.join(timeout=5.0)
        
        logger.info("Performance dashboard stopped")
    
    def _dashboard_update_loop(self):
        """Main dashboard update loop running in background thread"""
        while self.is_running:
            try:
                update_start = time.time()
                
                # Update dashboard data
                self._update_dashboard_data()
                
                # Track update performance
                update_time = (time.time() - update_start) * 1000
                self.dashboard_metrics['total_updates'] += 1
                self.dashboard_metrics['avg_update_time_ms'] = (
                    (self.dashboard_metrics['avg_update_time_ms'] * 0.9) + 
                    (update_time * 0.1)
                )
                
                # Sleep until next update
                time.sleep(self.update_interval_seconds)
                
            except Exception as e:
                logger.error(f"Dashboard update error: {e}")
                self.dashboard_metrics['update_errors'] += 1
                self.dashboard_metrics['last_error_time'] = time.time()
                time.sleep(5.0)  # Wait longer on error
    
    def _update_dashboard_data(self):
        """Update dashboard data from profiler metrics"""
        current_time = time.time()
        
        # Get recent metrics from profiler
        recent_metrics = list(self.profiler.metrics_history)[-100:]  # Last 100 operations
        
        if not recent_metrics:
            return
        
        # Update metrics aggregator with latest metrics
        latest_metric = recent_metrics[-1]
        self.metrics_aggregator.add_metrics(latest_metric)
        
        # Get aggregated data
        aggregated_data = self.metrics_aggregator.get_aggregated_metrics()
        
        # Check for alerts
        new_alerts = self.alert_manager.check_and_generate_alerts(latest_metric, aggregated_data)
        
        # Generate advanced alerts with trend analysis
        advanced_alerts = self.advanced_alerting.check_and_generate_alerts(latest_metric)
        
        # Update real-time metrics
        self.current_metrics = RealTimeMetrics(
            timestamp=current_time,
            current_inference_time_ms=latest_metric.execution_time_ms if latest_metric.operation_type == 'inference' else 0.0,
            current_memory_usage_mb=latest_metric.memory_delta_mb,
            current_gpu_utilization=latest_metric.gpu_utilization_percent,
            operations_per_minute=aggregated_data.get('operations_per_minute', 0.0),
            target_compliance_rate=aggregated_data.get('compliance_rate', 0.0),
            active_alerts_count=len(self.alert_manager.get_active_alerts())
        )
        
        # Update dashboard data cache
        self.dashboard_data_cache = {
            'timestamp': current_time,
            'real_time_metrics': self.current_metrics.to_dict(),
            'aggregated_metrics': aggregated_data,
            'alert_summary': self.alert_manager.get_alert_summary(),
            'recent_alerts': [alert.to_dict() for alert in new_alerts],
            'advanced_alerts': [alert.to_dict() for alert in advanced_alerts],
            'alert_analytics': self.advanced_alerting.get_alert_analytics(),
            'performance_targets': self.profiler.performance_targets,
            'dashboard_status': {
                'is_running': self.is_running,
                'update_interval_seconds': self.update_interval_seconds,
                'total_updates': self.dashboard_metrics['total_updates'],
                'update_errors': self.dashboard_metrics['update_errors'],
                'avg_update_time_ms': self.dashboard_metrics['avg_update_time_ms']
            }
        }
        
        self.last_update_time = current_time
    
    def _handle_alert_notification(self, alert: DashboardAlert):
        """Handle new alert notifications"""
        if not self.config['alert_notifications_enabled']:
            return
        
        # Log alert
        if self.config['detailed_logging_enabled']:
            logger.info(f"Dashboard Alert [{alert.severity.upper()}]: {alert.message}")
        
        # Could implement additional notification mechanisms here
        # (email, webhook, etc.)
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """
        Get current dashboard data for display
        
        Returns:
            Complete dashboard data including metrics, alerts, and status
        """
        if not self.dashboard_data_cache:
            return {
                'status': 'initializing',
                'message': 'Dashboard is starting up...'
            }
        
        # Add additional computed data
        enhanced_data = self.dashboard_data_cache.copy()
        
        # Add performance trends
        enhanced_data['performance_trends'] = self._calculate_performance_trends()
        
        # Add system health status
        enhanced_data['system_health'] = self._assess_system_health()
        
        # Add recommendations
        enhanced_data['recommendations'] = self._generate_dashboard_recommendations()
        
        return enhanced_data
    
    def _calculate_performance_trends(self) -> Dict[str, Any]:
        """Calculate performance trends for dashboard display"""
        if len(self.profiler.metrics_history) < 10:
            return {'status': 'insufficient_data'}
        
        # Get metrics from last hour and previous hour for comparison
        current_time = time.time()
        hour_ago = current_time - 3600
        two_hours_ago = current_time - 7200
        
        recent_metrics = [m for m in self.profiler.metrics_history if m.timestamp >= hour_ago]
        previous_metrics = [m for m in self.profiler.metrics_history 
                          if two_hours_ago <= m.timestamp < hour_ago]
        
        if not recent_metrics or not previous_metrics:
            return {'status': 'insufficient_data'}
        
        # Calculate trends
        recent_avg_time = sum(m.execution_time_ms for m in recent_metrics) / len(recent_metrics)
        previous_avg_time = sum(m.execution_time_ms for m in previous_metrics) / len(previous_metrics)
        
        recent_avg_memory = sum(m.memory_delta_mb for m in recent_metrics) / len(recent_metrics)
        previous_avg_memory = sum(m.memory_delta_mb for m in previous_metrics) / len(previous_metrics)
        
        time_trend = 'improving' if recent_avg_time < previous_avg_time else 'degrading'
        memory_trend = 'improving' if abs(recent_avg_memory) < abs(previous_avg_memory) else 'degrading'
        
        return {
            'status': 'available',
            'execution_time': {
                'trend': time_trend,
                'recent_avg_ms': recent_avg_time,
                'previous_avg_ms': previous_avg_time,
                'change_percent': ((recent_avg_time - previous_avg_time) / previous_avg_time) * 100
            },
            'memory_usage': {
                'trend': memory_trend,
                'recent_avg_mb': recent_avg_memory,
                'previous_avg_mb': previous_avg_memory,
                'change_percent': ((abs(recent_avg_memory) - abs(previous_avg_memory)) / abs(previous_avg_memory)) * 100
            }
        }
    
    def _assess_system_health(self) -> Dict[str, Any]:
        """Assess overall system health for dashboard display"""
        if not self.current_metrics:
            return {'status': 'unknown'}
        
        health_score = 100.0
        issues = []
        
        # Check inference time health
        if self.current_metrics.current_inference_time_ms > 16.0:
            health_score -= 20
            issues.append("Inference time exceeds target")
        
        # Check memory health
        if abs(self.current_metrics.current_memory_usage_mb) > 150:
            health_score -= 15
            issues.append("High memory usage")
        
        # Check compliance rate health
        if self.current_metrics.target_compliance_rate < 0.8:
            health_score -= 25
            issues.append("Low performance compliance")
        
        # Check alert health
        if self.current_metrics.active_alerts_count > 5:
            health_score -= 20
            issues.append("Multiple active alerts")
        
        # Check activity health
        if self.current_metrics.operations_per_minute < 10:
            health_score -= 10
            issues.append("Low neural network activity")
        
        health_status = 'excellent' if health_score >= 90 else \
                       'good' if health_score >= 70 else \
                       'fair' if health_score >= 50 else 'poor'
        
        return {
            'status': health_status,
            'score': max(0, health_score),
            'issues': issues,
            'last_assessment': time.time()
        }
    
    def _generate_dashboard_recommendations(self) -> List[str]:
        """Generate performance recommendations for dashboard display"""
        recommendations = []
        
        if not self.current_metrics:
            return ["Dashboard initializing - no recommendations available"]
        
        # Inference time recommendations
        if self.current_metrics.current_inference_time_ms > 16.0:
            recommendations.append("Consider enabling GPU acceleration or model quantization to improve inference speed")
        
        # Memory recommendations
        if abs(self.current_metrics.current_memory_usage_mb) > 150:
            recommendations.append("High memory usage detected - consider reducing batch sizes or enabling memory optimization")
        
        # GPU recommendations
        if self.current_metrics.current_gpu_utilization is None:
            recommendations.append("GPU acceleration not detected - enable GPU support for better performance")
        elif self.current_metrics.current_gpu_utilization < 30:
            recommendations.append("Low GPU utilization - consider increasing batch sizes or model complexity")
        
        # Activity recommendations
        if self.current_metrics.operations_per_minute < 10:
            recommendations.append("Low neural network activity - system may be underutilized")
        
        # Compliance recommendations
        if self.current_metrics.target_compliance_rate < 0.8:
            recommendations.append("Performance compliance is low - review recent optimizations and system configuration")
        
        # Alert recommendations
        if self.current_metrics.active_alerts_count > 3:
            recommendations.append("Multiple active alerts - review and address performance issues")
        
        if not recommendations:
            recommendations.append("System performance is within acceptable thresholds")
        
        return recommendations
    
    def get_historical_data(self, hours: int = 24) -> Dict[str, Any]:
        """Get historical performance data for dashboard charts"""
        cutoff_time = time.time() - (hours * 3600)
        historical_metrics = [m for m in self.profiler.metrics_history if m.timestamp >= cutoff_time]
        
        if not historical_metrics:
            return {'status': 'no_data'}
        
        # Group metrics by hour for charting
        hourly_data = defaultdict(list)
        for metric in historical_metrics:
            hour_key = int(metric.timestamp // 3600) * 3600  # Round to hour
            hourly_data[hour_key].append(metric)
        
        # Calculate hourly averages
        chart_data = []
        for hour_timestamp in sorted(hourly_data.keys()):
            hour_metrics = hourly_data[hour_timestamp]
            
            avg_inference_time = sum(m.execution_time_ms for m in hour_metrics if m.operation_type == 'inference') / \
                               max(1, len([m for m in hour_metrics if m.operation_type == 'inference']))
            
            avg_memory_usage = sum(m.memory_delta_mb for m in hour_metrics) / len(hour_metrics)
            
            compliance_rate = sum(1 for m in hour_metrics if m.meets_inference_target and m.meets_memory_target) / len(hour_metrics)
            
            chart_data.append({
                'timestamp': hour_timestamp,
                'avg_inference_time_ms': avg_inference_time,
                'avg_memory_usage_mb': avg_memory_usage,
                'compliance_rate': compliance_rate,
                'operation_count': len(hour_metrics)
            })
        
        return {
            'status': 'available',
            'hours_requested': hours,
            'data_points': len(chart_data),
            'chart_data': chart_data
        }
    
    def export_dashboard_data(self, format_type: str = 'json') -> str:
        """Export dashboard data for external analysis"""
        export_data = {
            'export_timestamp': time.time(),
            'dashboard_data': self.get_dashboard_data(),
            'historical_data': self.get_historical_data(hours=24),
            'configuration': self.config,
            'dashboard_metrics': self.dashboard_metrics
        }
        
        if format_type == 'json':
            return json.dumps(export_data, indent=2, default=str)
        else:
            raise ValueError(f"Unsupported export format: {format_type}")
    
    def update_configuration(self, new_config: Dict[str, Any]):
        """Update dashboard configuration"""
        self.config.update(new_config)
        logger.info(f"Dashboard configuration updated: {new_config}")
    
    async def cleanup(self):
        """Cleanup dashboard resources"""
        await self.stop_dashboard()
        await self.advanced_alerting.cleanup()
        self.dashboard_data_cache.clear()
        logger.info("Performance dashboard cleanup completed")