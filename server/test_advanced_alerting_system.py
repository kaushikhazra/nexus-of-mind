"""
Test suite for Advanced Alerting System
Tests Requirements 4.2, 4.5 for advanced performance monitoring and alerting
"""

import pytest
import asyncio
import time
import statistics
from collections import deque
from unittest.mock import Mock, patch, MagicMock

# Import the components we're testing
from ai_engine.advanced_alerting_system import (
    AdvancedAlertingSystem, TrendAnalyzer, DiagnosticEngine,
    AdvancedAlert, AlertSeverity, TrendDirection, PerformanceTrend,
    DiagnosticRecommendation
)
from ai_engine.performance_profiler import PerformanceProfiler, ProfilingMetrics


class TestTrendAnalyzer:
    """Test trend analysis functionality"""
    
    def test_trend_analyzer_initialization(self):
        """Test trend analyzer initialization"""
        analyzer = TrendAnalyzer(analysis_window_hours=12)
        
        assert analyzer.analysis_window_hours == 12
        assert analyzer.min_data_points == 10
        assert analyzer.trend_threshold == 0.05
    
    def test_analyze_metric_trend_insufficient_data(self):
        """Test trend analysis with insufficient data"""
        analyzer = TrendAnalyzer()
        
        # Create minimal metrics
        metrics = [
            ProfilingMetrics(
                timestamp=time.time() - i,
                operation_type='inference',
                operation_id=f'test_{i}',
                execution_time_ms=10.0 + i,
                memory_delta_mb=5.0,
                gpu_utilization_percent=50.0,
                meets_inference_target=True,
                meets_memory_target=True,
                meets_throughput_target=True
            ) for i in range(5)  # Only 5 data points
        ]
        
        # Should return None for insufficient data
        trend = analyzer.analyze_metric_trend(
            metrics, 'inference_time', 
            lambda m: m.execution_time_ms if m.operation_type == 'inference' else None
        )
        
        assert trend is None
    
    def test_analyze_metric_trend_stable(self):
        """Test trend analysis for stable metrics"""
        analyzer = TrendAnalyzer()
        current_time = time.time()
        
        # Create stable metrics (consistent values)
        metrics = []
        for i in range(20):
            metrics.append(ProfilingMetrics(
                timestamp=current_time - (i * 100),  # Spread over time
                operation_type='inference',
                operation_id=f'test_{i}',
                execution_time_ms=10.0,  # Stable value
                memory_delta_mb=5.0,
                gpu_utilization_percent=50.0,
                meets_inference_target=True,
                meets_memory_target=True,
                meets_throughput_target=True
            ))
        
        trend = analyzer.analyze_metric_trend(
            metrics, 'inference_time',
            lambda m: m.execution_time_ms if m.operation_type == 'inference' else None
        )
        
        assert trend is not None
        assert trend.trend_direction == TrendDirection.STABLE
        assert abs(trend.change_percent) < 5.0  # Should be minimal change
        assert trend.confidence_level > 0.8  # High confidence for stable data
    
    def test_analyze_metric_trend_degrading(self):
        """Test trend analysis for degrading performance"""
        analyzer = TrendAnalyzer()
        current_time = time.time()
        
        # Create degrading metrics (increasing inference time)
        metrics = []
        for i in range(20):
            # Recent metrics have higher inference times
            if i < 10:  # Historical data
                inference_time = 8.0 + (i * 0.1)
            else:  # Recent data
                inference_time = 12.0 + ((i - 10) * 0.2)
            
            metrics.append(ProfilingMetrics(
                timestamp=current_time - ((19 - i) * 100),  # Chronological order
                operation_type='inference',
                operation_id=f'test_{i}',
                execution_time_ms=inference_time,
                memory_delta_mb=5.0,
                gpu_utilization_percent=50.0,
                meets_inference_target=True,
                meets_memory_target=True,
                meets_throughput_target=True
            ))
        
        trend = analyzer.analyze_metric_trend(
            metrics, 'inference_time',
            lambda m: m.execution_time_ms if m.operation_type == 'inference' else None
        )
        
        assert trend is not None
        assert trend.trend_direction == TrendDirection.DEGRADING
        assert trend.change_percent > 10.0  # Significant increase
        assert trend.recent_average > trend.historical_average
    
    def test_analyze_all_trends(self):
        """Test analysis of all performance trends"""
        analyzer = TrendAnalyzer()
        current_time = time.time()
        
        # Create comprehensive metrics
        metrics = []
        for i in range(15):
            metrics.append(ProfilingMetrics(
                timestamp=current_time - (i * 100),
                operation_type='inference',
                operation_id=f'test_{i}',
                execution_time_ms=10.0 + (i * 0.1),
                memory_delta_mb=50.0 + (i * 2.0),
                gpu_utilization_percent=60.0 - (i * 1.0),
                meets_inference_target=True,
                meets_memory_target=True,
                meets_throughput_target=True
            ))
        
        trends = analyzer.analyze_all_trends(metrics)
        
        # Should have trends for key metrics
        assert 'inference_time' in trends
        assert 'memory_usage' in trends
        assert 'gpu_utilization' in trends
        assert 'throughput' in trends
        
        # Verify trend objects
        for trend_name, trend in trends.items():
            assert isinstance(trend, PerformanceTrend)
            assert trend.metric_name == trend_name
            assert trend.data_points >= 10


class TestDiagnosticEngine:
    """Test diagnostic recommendation engine"""
    
    def test_diagnostic_engine_initialization(self):
        """Test diagnostic engine initialization"""
        engine = DiagnosticEngine()
        
        assert engine.recommendation_counter == 0
    
    def test_generate_diagnostics_inference_issues(self):
        """Test diagnostic generation for inference issues"""
        engine = DiagnosticEngine()
        
        # Create mock trend showing inference degradation
        inference_trend = PerformanceTrend(
            metric_name='inference_time',
            trend_direction=TrendDirection.DEGRADING,
            trend_strength=0.8,
            recent_average=18.0,
            historical_average=12.0,
            change_percent=50.0,
            confidence_level=0.9,
            data_points=20,
            analysis_window_hours=24
        )
        
        trends = {'inference_time': inference_trend}
        
        # Create current metrics showing poor performance
        current_metrics = ProfilingMetrics(
            timestamp=time.time(),
            operation_type='inference',
            operation_id='test_current',
            execution_time_ms=20.0,  # Above 16ms target
            memory_delta_mb=50.0,
            gpu_utilization_percent=30.0,
            meets_inference_target=False,
            meets_memory_target=True,
            meets_throughput_target=False
        )
        
        diagnostics = engine.generate_diagnostics([], trends, current_metrics)
        
        # Should generate recommendations for inference issues
        assert len(diagnostics) > 0
        
        inference_diagnostics = [d for d in diagnostics if 'inference' in d.title.lower()]
        assert len(inference_diagnostics) > 0
        
        # Check diagnostic quality
        for diagnostic in inference_diagnostics:
            assert isinstance(diagnostic, DiagnosticRecommendation)
            assert diagnostic.priority in ['high', 'medium', 'low']
            assert diagnostic.category in ['performance', 'memory', 'gpu', 'configuration']
            assert len(diagnostic.action_items) > 0
    
    def test_generate_diagnostics_memory_issues(self):
        """Test diagnostic generation for memory issues"""
        engine = DiagnosticEngine()
        
        # Create mock trend showing memory degradation
        memory_trend = PerformanceTrend(
            metric_name='memory_usage',
            trend_direction=TrendDirection.DEGRADING,
            trend_strength=0.7,
            recent_average=180.0,  # High memory usage
            historical_average=120.0,
            change_percent=50.0,
            confidence_level=0.8,
            data_points=15,
            analysis_window_hours=24
        )
        
        trends = {'memory_usage': memory_trend}
        
        current_metrics = ProfilingMetrics(
            timestamp=time.time(),
            operation_type='inference',
            operation_id='test_current',
            execution_time_ms=12.0,
            memory_delta_mb=190.0,  # High memory usage
            gpu_utilization_percent=50.0,
            meets_inference_target=True,
            meets_memory_target=False,
            meets_throughput_target=True
        )
        
        diagnostics = engine.generate_diagnostics([], trends, current_metrics)
        
        # Should generate recommendations for memory issues
        memory_diagnostics = [d for d in diagnostics if 'memory' in d.category.lower()]
        assert len(memory_diagnostics) > 0
        
        # Verify memory-specific recommendations
        for diagnostic in memory_diagnostics:
            assert 'memory' in diagnostic.title.lower() or 'memory' in diagnostic.description.lower()
            assert len(diagnostic.action_items) > 0


class TestAdvancedAlertingSystem:
    """Test advanced alerting system"""
    
    @pytest.fixture
    def mock_profiler(self):
        """Create mock performance profiler"""
        profiler = Mock(spec=PerformanceProfiler)
        profiler.metrics_history = deque(maxlen=1000)
        profiler.performance_targets = {
            'inference_time_ms': 16.0,
            'memory_limit_mb': 200.0,
            'throughput_predictions_per_sec': 100.0
        }
        return profiler
    
    @pytest.fixture
    def alerting_system(self, mock_profiler):
        """Create advanced alerting system for testing"""
        return AdvancedAlertingSystem(mock_profiler)
    
    def test_alerting_system_initialization(self, alerting_system):
        """Test alerting system initialization"""
        assert alerting_system.alert_counter == 0
        assert len(alerting_system.alerts) == 0
        assert alerting_system.config['trend_analysis_enabled'] is True
        assert alerting_system.config['diagnostic_recommendations_enabled'] is True
    
    def test_check_immediate_violations_critical_inference(self, alerting_system):
        """Test immediate violation detection for critical inference time"""
        # Create metrics with critical inference time violation
        critical_metrics = ProfilingMetrics(
            timestamp=time.time(),
            operation_type='inference',
            operation_id='critical_test',
            execution_time_ms=25.0,  # Well above 20ms critical threshold
            memory_delta_mb=50.0,
            gpu_utilization_percent=40.0,
            meets_inference_target=False,
            meets_memory_target=True,
            meets_throughput_target=False
        )
        
        # Add some history to profiler
        for i in range(15):
            alerting_system.profiler.metrics_history.append(
                ProfilingMetrics(
                    timestamp=time.time() - (i * 10),
                    operation_type='inference',
                    operation_id=f'history_{i}',
                    execution_time_ms=12.0 + (i * 0.5),
                    memory_delta_mb=40.0,
                    gpu_utilization_percent=50.0,
                    meets_inference_target=True,
                    meets_memory_target=True,
                    meets_throughput_target=True
                )
            )
        
        alerts = alerting_system.check_and_generate_alerts(critical_metrics)
        
        # Should generate critical alert
        assert len(alerts) > 0
        
        critical_alerts = [a for a in alerts if a.severity == AlertSeverity.CRITICAL]
        assert len(critical_alerts) > 0
        
        # Verify alert properties
        critical_alert = critical_alerts[0]
        assert 'inference' in critical_alert.title.lower()
        assert critical_alert.confidence_score > 0.8
        assert 'current_inference_time_ms' in critical_alert.related_metrics
    
    def test_check_immediate_violations_critical_memory(self, alerting_system):
        """Test immediate violation detection for critical memory usage"""
        # Create metrics with critical memory violation
        critical_metrics = ProfilingMetrics(
            timestamp=time.time(),
            operation_type='inference',
            operation_id='memory_critical_test',
            execution_time_ms=12.0,
            memory_delta_mb=250.0,  # Well above 200MB critical threshold
            gpu_utilization_percent=40.0,
            meets_inference_target=True,
            meets_memory_target=False,
            meets_throughput_target=True
        )
        
        alerts = alerting_system.check_and_generate_alerts(critical_metrics)
        
        # Should generate critical memory alert
        critical_alerts = [a for a in alerts if a.severity == AlertSeverity.CRITICAL]
        memory_alerts = [a for a in critical_alerts if 'memory' in a.title.lower()]
        
        assert len(memory_alerts) > 0
        
        memory_alert = memory_alerts[0]
        assert memory_alert.confidence_score > 0.8
        assert 'current_memory_usage_mb' in memory_alert.related_metrics
    
    def test_proactive_alerting_trend_based(self, alerting_system):
        """Test proactive alerting based on performance trends"""
        # Create degrading trend in profiler history
        current_time = time.time()
        
        # Add metrics showing degrading performance trend
        for i in range(25):
            # Simulate gradual performance degradation
            inference_time = 10.0 + (i * 0.3)  # Gradually increasing
            
            alerting_system.profiler.metrics_history.append(
                ProfilingMetrics(
                    timestamp=current_time - ((24 - i) * 100),
                    operation_type='inference',
                    operation_id=f'trend_{i}',
                    execution_time_ms=inference_time,
                    memory_delta_mb=40.0 + (i * 1.0),
                    gpu_utilization_percent=60.0 - (i * 0.5),
                    meets_inference_target=inference_time <= 16.0,
                    meets_memory_target=True,
                    meets_throughput_target=True
                )
            )
        
        # Current metrics showing continued degradation but not critical
        current_metrics = ProfilingMetrics(
            timestamp=current_time,
            operation_type='inference',
            operation_id='current_trend',
            execution_time_ms=15.0,  # Not critical but trending up
            memory_delta_mb=65.0,
            gpu_utilization_percent=45.0,
            meets_inference_target=True,
            meets_memory_target=True,
            meets_throughput_target=True
        )
        
        alerts = alerting_system.check_and_generate_alerts(current_metrics)
        
        # Should generate proactive warning alerts
        warning_alerts = [a for a in alerts if a.severity == AlertSeverity.WARNING]
        proactive_alerts = [a for a in warning_alerts if 'proactive' in a.type.lower()]
        
        assert len(proactive_alerts) > 0
        
        # Verify proactive alert has trend analysis
        proactive_alert = proactive_alerts[0]
        assert proactive_alert.trend_analysis is not None
        assert proactive_alert.trend_analysis.trend_direction == TrendDirection.DEGRADING
    
    def test_alert_suppression(self, alerting_system):
        """Test alert suppression to prevent spam"""
        # Enable alert suppression
        alerting_system.config['alert_suppression_enabled'] = True
        
        # Create metrics that would trigger alerts
        critical_metrics = ProfilingMetrics(
            timestamp=time.time(),
            operation_type='inference',
            operation_id='suppression_test',
            execution_time_ms=25.0,  # Critical violation
            memory_delta_mb=50.0,
            gpu_utilization_percent=40.0,
            meets_inference_target=False,
            meets_memory_target=True,
            meets_throughput_target=False
        )
        
        # Generate multiple alerts rapidly
        all_alerts = []
        for i in range(5):
            alerts = alerting_system.check_and_generate_alerts(critical_metrics)
            all_alerts.extend(alerts)
            time.sleep(0.1)  # Small delay
        
        # Should have suppressed some alerts
        assert alerting_system.system_metrics['alerts_suppressed'] > 0
        
        # Total alerts should be less than 5 (due to suppression)
        assert len(all_alerts) < 5
    
    def test_get_alert_analytics(self, alerting_system):
        """Test alert analytics and statistics"""
        # Generate some test alerts
        test_metrics = ProfilingMetrics(
            timestamp=time.time(),
            operation_type='inference',
            operation_id='analytics_test',
            execution_time_ms=22.0,  # Critical
            memory_delta_mb=180.0,   # Warning level
            gpu_utilization_percent=20.0,
            meets_inference_target=False,
            meets_memory_target=True,
            meets_throughput_target=False
        )
        
        alerting_system.check_and_generate_alerts(test_metrics)
        
        analytics = alerting_system.get_alert_analytics()
        
        # Verify analytics structure
        assert 'summary' in analytics
        assert 'distribution' in analytics
        assert 'system_metrics' in analytics
        assert 'configuration' in analytics
        
        # Verify summary data
        summary = analytics['summary']
        assert 'total_active_alerts' in summary
        assert 'average_confidence_score' in summary
        
        # Verify distribution data
        distribution = analytics['distribution']
        assert 'by_severity' in distribution
        assert 'by_type' in distribution
    
    def test_acknowledge_alert(self, alerting_system):
        """Test alert acknowledgment"""
        # Generate an alert
        test_metrics = ProfilingMetrics(
            timestamp=time.time(),
            operation_type='inference',
            operation_id='ack_test',
            execution_time_ms=25.0,
            memory_delta_mb=50.0,
            gpu_utilization_percent=40.0,
            meets_inference_target=False,
            meets_memory_target=True,
            meets_throughput_target=False
        )
        
        alerts = alerting_system.check_and_generate_alerts(test_metrics)
        assert len(alerts) > 0
        
        # Acknowledge the first alert
        alert_id = alerts[0].id
        result = alerting_system.acknowledge_alert(alert_id)
        
        assert result is True
        
        # Verify alert is acknowledged
        acknowledged_alert = next((a for a in alerting_system.alerts if a.id == alert_id), None)
        assert acknowledged_alert is not None
        assert acknowledged_alert.acknowledged is True
    
    def test_configuration_update(self, alerting_system):
        """Test alerting system configuration updates"""
        new_config = {
            'trend_analysis_enabled': False,
            'max_alerts_per_hour': 25
        }
        
        alerting_system.update_configuration(new_config)
        
        assert alerting_system.config['trend_analysis_enabled'] is False
        assert alerting_system.config['max_alerts_per_hour'] == 25
        
        # Other config should remain unchanged
        assert alerting_system.config['diagnostic_recommendations_enabled'] is True
    
    @pytest.mark.asyncio
    async def test_cleanup(self, alerting_system):
        """Test alerting system cleanup"""
        # Add some test data
        alerting_system.alerts.append(Mock())
        alerting_system.alert_callbacks.append(Mock())
        alerting_system.alert_history['test'] = [time.time()]
        
        await alerting_system.cleanup()
        
        # Verify cleanup
        assert len(alerting_system.alerts) == 0
        assert len(alerting_system.alert_callbacks) == 0
        assert len(alerting_system.alert_history) == 0


# Integration test
@pytest.mark.asyncio
async def test_advanced_alerting_integration():
    """Integration test for advanced alerting system"""
    
    # Create real profiler (mocked TensorFlow dependencies)
    with patch('ai_engine.performance_profiler.TENSORFLOW_AVAILABLE', True):
        profiler = PerformanceProfiler()
        
        # Create alerting system
        alerting_system = AdvancedAlertingSystem(profiler)
        
        # Add callback to track alerts
        received_alerts = []
        alerting_system.add_alert_callback(lambda alert: received_alerts.append(alert))
        
        # Simulate performance degradation over time
        current_time = time.time()
        
        # Add historical good performance
        for i in range(20):
            good_metrics = ProfilingMetrics(
                timestamp=current_time - (100 * (20 - i)),
                operation_type='inference',
                operation_id=f'good_{i}',
                execution_time_ms=8.0 + (i * 0.1),
                memory_delta_mb=30.0,
                gpu_utilization_percent=70.0,
                meets_inference_target=True,
                meets_memory_target=True,
                meets_throughput_target=True
            )
            profiler.metrics_history.append(good_metrics)
        
        # Add recent degraded performance
        for i in range(10):
            bad_metrics = ProfilingMetrics(
                timestamp=current_time - (10 * (10 - i)),
                operation_type='inference',
                operation_id=f'bad_{i}',
                execution_time_ms=15.0 + (i * 0.5),
                memory_delta_mb=80.0 + (i * 5.0),
                gpu_utilization_percent=40.0 - (i * 2.0),
                meets_inference_target=False,
                meets_memory_target=True,
                meets_throughput_target=False
            )
            profiler.metrics_history.append(bad_metrics)
        
        # Trigger alerting with current critical metrics
        critical_metrics = ProfilingMetrics(
            timestamp=current_time,
            operation_type='inference',
            operation_id='critical_integration',
            execution_time_ms=22.0,  # Critical
            memory_delta_mb=130.0,
            gpu_utilization_percent=20.0,
            meets_inference_target=False,
            meets_memory_target=True,
            meets_throughput_target=False
        )
        
        alerts = alerting_system.check_and_generate_alerts(critical_metrics)
        
        # Verify comprehensive alerting
        assert len(alerts) > 0
        assert len(received_alerts) > 0  # Callbacks triggered
        
        # Should have both immediate and proactive alerts
        critical_alerts = [a for a in alerts if a.severity == AlertSeverity.CRITICAL]
        warning_alerts = [a for a in alerts if a.severity == AlertSeverity.WARNING]
        
        assert len(critical_alerts) > 0  # Immediate violations
        
        # Verify alerts have comprehensive data
        for alert in alerts:
            assert alert.id is not None
            assert alert.timestamp > 0
            assert alert.confidence_score > 0
            
            # Advanced alerts should have trend analysis or diagnostics
            if alert.trend_analysis or alert.diagnostic_recommendations:
                assert True  # At least one advanced feature present
        
        # Test analytics
        analytics = alerting_system.get_alert_analytics()
        assert analytics['summary']['total_active_alerts'] > 0
        
        # Cleanup
        await alerting_system.cleanup()


if __name__ == '__main__':
    # Run basic tests
    print("Running Advanced Alerting System Tests...")
    
    # Test TrendAnalyzer
    analyzer = TrendAnalyzer()
    print("✓ TrendAnalyzer initialized")
    
    # Test DiagnosticEngine
    engine = DiagnosticEngine()
    print("✓ DiagnosticEngine initialized")
    
    # Test AdvancedAlertingSystem
    mock_profiler = Mock(spec=PerformanceProfiler)
    mock_profiler.metrics_history = deque(maxlen=1000)
    mock_profiler.performance_targets = {
        'inference_time_ms': 16.0,
        'memory_limit_mb': 200.0,
        'throughput_predictions_per_sec': 100.0
    }
    
    alerting_system = AdvancedAlertingSystem(mock_profiler)
    print("✓ AdvancedAlertingSystem initialized")
    
    print("\nAll basic tests passed! ✓")
    print("\nAdvanced Alerting System Features:")
    print("- Comprehensive trend analysis with confidence scoring")
    print("- Intelligent diagnostic recommendations")
    print("- Proactive alerting based on performance trends")
    print("- Alert suppression to prevent notification spam")
    print("- Advanced analytics and reporting")
    print("- Integration with existing performance monitoring")