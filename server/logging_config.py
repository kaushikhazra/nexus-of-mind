"""
Enhanced Logging Configuration for Adaptive Queen Intelligence Backend
Provides structured logging with multiple outputs and performance monitoring
"""

import logging
import logging.handlers
import json
import os
import sys
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path


class StructuredFormatter(logging.Formatter):
    """
    Custom formatter that outputs structured JSON logs for better parsing and analysis
    """
    
    def __init__(self, include_extra: bool = True):
        super().__init__()
        self.include_extra = include_extra
    
    def format(self, record: logging.LogRecord) -> str:
        # Base log structure
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add exception information if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields if enabled
        if self.include_extra:
            extra_fields = {}
            for key, value in record.__dict__.items():
                if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 
                              'filename', 'module', 'lineno', 'funcName', 'created', 
                              'msecs', 'relativeCreated', 'thread', 'threadName', 
                              'processName', 'process', 'getMessage', 'exc_info', 'exc_text', 'stack_info']:
                    extra_fields[key] = value
            
            if extra_fields:
                log_entry["extra"] = extra_fields
        
        return json.dumps(log_entry, default=str)


class PerformanceFilter(logging.Filter):
    """
    Filter that adds performance metrics to log records
    """
    
    def __init__(self):
        super().__init__()
        self.start_time = datetime.now()
    
    def filter(self, record: logging.LogRecord) -> bool:
        # Add uptime to all records
        uptime = (datetime.now() - self.start_time).total_seconds()
        record.uptime = uptime
        
        # Add memory usage if available
        try:
            import psutil
            process = psutil.Process()
            record.memory_mb = process.memory_info().rss / 1024 / 1024
            record.cpu_percent = process.cpu_percent()
        except ImportError:
            pass
        
        return True


class AILearningFilter(logging.Filter):
    """
    Filter specifically for AI learning events
    """
    
    def filter(self, record: logging.LogRecord) -> bool:
        # Only pass through AI learning related logs
        ai_keywords = ['neural', 'training', 'strategy', 'queen', 'learning', 'generation']
        message_lower = record.getMessage().lower()
        
        return any(keyword in message_lower for keyword in ai_keywords)


class LoggingConfig:
    """
    Centralized logging configuration for the AI backend
    """
    
    def __init__(self, 
                 log_level: str = "INFO",
                 log_dir: str = "logs",
                 enable_file_logging: bool = True,
                 enable_structured_logging: bool = True,
                 enable_performance_logging: bool = True,
                 max_file_size: int = 10 * 1024 * 1024,  # 10MB
                 backup_count: int = 5):
        
        self.log_level = getattr(logging, log_level.upper())
        self.log_dir = Path(log_dir)
        self.enable_file_logging = enable_file_logging
        self.enable_structured_logging = enable_structured_logging
        self.enable_performance_logging = enable_performance_logging
        self.max_file_size = max_file_size
        self.backup_count = backup_count
        
        # Create log directory
        if self.enable_file_logging:
            self.log_dir.mkdir(exist_ok=True)
        
        self.setup_logging()
    
    def setup_logging(self):
        """Setup comprehensive logging configuration"""
        
        # Clear existing handlers
        root_logger = logging.getLogger()
        root_logger.handlers.clear()
        
        # Set root level
        root_logger.setLevel(self.log_level)
        
        # Console handler
        self.setup_console_handler()
        
        # File handlers
        if self.enable_file_logging:
            self.setup_file_handlers()
        
        # Specialized loggers
        self.setup_specialized_loggers()
        
        logging.info("Logging configuration initialized")
    
    def setup_console_handler(self):
        """Setup console logging handler"""
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(self.log_level)
        
        if self.enable_structured_logging:
            console_formatter = StructuredFormatter(include_extra=False)
        else:
            console_formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
        
        console_handler.setFormatter(console_formatter)
        
        # Add performance filter if enabled
        if self.enable_performance_logging:
            console_handler.addFilter(PerformanceFilter())
        
        logging.getLogger().addHandler(console_handler)
    
    def setup_file_handlers(self):
        """Setup file logging handlers"""
        
        # Main application log
        main_log_file = self.log_dir / "ai_backend.log"
        main_handler = logging.handlers.RotatingFileHandler(
            main_log_file,
            maxBytes=self.max_file_size,
            backupCount=self.backup_count
        )
        main_handler.setLevel(self.log_level)
        main_handler.setFormatter(StructuredFormatter())
        
        if self.enable_performance_logging:
            main_handler.addFilter(PerformanceFilter())
        
        logging.getLogger().addHandler(main_handler)
        
        # Error log (errors and above only)
        error_log_file = self.log_dir / "errors.log"
        error_handler = logging.handlers.RotatingFileHandler(
            error_log_file,
            maxBytes=self.max_file_size,
            backupCount=self.backup_count
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(StructuredFormatter())
        logging.getLogger().addHandler(error_handler)
        
        # AI Learning specific log
        ai_log_file = self.log_dir / "ai_learning.log"
        ai_handler = logging.handlers.RotatingFileHandler(
            ai_log_file,
            maxBytes=self.max_file_size,
            backupCount=self.backup_count
        )
        ai_handler.setLevel(logging.DEBUG)
        ai_handler.setFormatter(StructuredFormatter())
        ai_handler.addFilter(AILearningFilter())
        logging.getLogger().addHandler(ai_handler)
        
        # Performance log
        if self.enable_performance_logging:
            perf_log_file = self.log_dir / "performance.log"
            perf_handler = logging.handlers.RotatingFileHandler(
                perf_log_file,
                maxBytes=self.max_file_size,
                backupCount=self.backup_count
            )
            perf_handler.setLevel(logging.INFO)
            perf_handler.setFormatter(StructuredFormatter())
            perf_handler.addFilter(PerformanceFilter())
            
            # Only log performance-related messages
            class PerformanceOnlyFilter(logging.Filter):
                def filter(self, record):
                    perf_keywords = ['performance', 'fps', 'memory', 'cpu', 'training_time', 'latency']
                    message_lower = record.getMessage().lower()
                    return any(keyword in message_lower for keyword in perf_keywords)
            
            perf_handler.addFilter(PerformanceOnlyFilter())
            logging.getLogger().addHandler(perf_handler)
    
    def setup_specialized_loggers(self):
        """Setup specialized loggers for different components"""
        
        # AI Engine logger
        ai_logger = logging.getLogger('ai_engine')
        ai_logger.setLevel(logging.DEBUG)
        
        # Neural Network logger
        nn_logger = logging.getLogger('neural_network')
        nn_logger.setLevel(logging.DEBUG)
        
        # WebSocket logger
        ws_logger = logging.getLogger('websocket')
        ws_logger.setLevel(logging.INFO)
        
        # Strategy Generation logger
        strategy_logger = logging.getLogger('strategy_generation')
        strategy_logger.setLevel(logging.DEBUG)
        
        # Performance logger
        perf_logger = logging.getLogger('performance')
        perf_logger.setLevel(logging.INFO)
    
    def get_logger(self, name: str) -> logging.Logger:
        """Get a logger with the specified name"""
        return logging.getLogger(name)
    
    def log_ai_event(self, event_type: str, data: Dict[str, Any], level: str = "INFO"):
        """Log AI-specific events with structured data"""
        logger = logging.getLogger('ai_engine')
        log_level = getattr(logging, level.upper())
        
        logger.log(log_level, f"AI Event: {event_type}", extra={
            "event_type": event_type,
            "event_data": data,
            "component": "ai_engine"
        })
    
    def log_performance_metric(self, metric_name: str, value: float, unit: str = "", context: Dict[str, Any] = None):
        """Log performance metrics"""
        logger = logging.getLogger('performance')
        
        logger.info(f"Performance Metric: {metric_name} = {value}{unit}", extra={
            "metric_name": metric_name,
            "metric_value": value,
            "metric_unit": unit,
            "context": context or {},
            "component": "performance_monitor"
        })
    
    def log_learning_cycle(self, cycle_id: str, phase: str, data: Dict[str, Any]):
        """Log learning cycle events"""
        logger = logging.getLogger('ai_engine')
        
        logger.info(f"Learning Cycle [{cycle_id}] - {phase}", extra={
            "cycle_id": cycle_id,
            "phase": phase,
            "cycle_data": data,
            "component": "learning_cycle"
        })
    
    def log_neural_network_event(self, event: str, metrics: Dict[str, Any]):
        """Log neural network training events"""
        logger = logging.getLogger('neural_network')
        
        logger.info(f"Neural Network: {event}", extra={
            "nn_event": event,
            "nn_metrics": metrics,
            "component": "neural_network"
        })
    
    def log_strategy_generation(self, queen_id: str, generation: int, strategy_data: Dict[str, Any]):
        """Log strategy generation events"""
        logger = logging.getLogger('strategy_generation')
        
        logger.info(f"Strategy Generated for Queen {queen_id} Gen {generation}", extra={
            "queen_id": queen_id,
            "generation": generation,
            "strategy_data": strategy_data,
            "component": "strategy_generation"
        })
    
    def log_websocket_event(self, event: str, client_id: str, data: Dict[str, Any] = None):
        """Log WebSocket events"""
        logger = logging.getLogger('websocket')
        
        logger.info(f"WebSocket: {event} - Client {client_id}", extra={
            "ws_event": event,
            "client_id": client_id,
            "ws_data": data or {},
            "component": "websocket"
        })
    
    def create_request_logger(self, request_id: str):
        """Create a logger for tracking a specific request"""
        logger = logging.getLogger(f'request.{request_id}')
        
        # Add request ID to all log messages
        class RequestFilter(logging.Filter):
            def filter(self, record):
                record.request_id = request_id
                return True
        
        logger.addFilter(RequestFilter())
        return logger


# Global logging configuration instance
_logging_config: Optional[LoggingConfig] = None


def initialize_logging(log_level: str = None, 
                      log_dir: str = None,
                      enable_file_logging: bool = None,
                      enable_structured_logging: bool = None,
                      enable_performance_logging: bool = None) -> LoggingConfig:
    """Initialize global logging configuration"""
    global _logging_config
    
    # Get configuration from environment variables
    config = {
        "log_level": log_level or os.getenv("LOG_LEVEL", "INFO"),
        "log_dir": log_dir or os.getenv("LOG_DIR", "logs"),
        "enable_file_logging": enable_file_logging if enable_file_logging is not None else os.getenv("ENABLE_FILE_LOGGING", "true").lower() == "true",
        "enable_structured_logging": enable_structured_logging if enable_structured_logging is not None else os.getenv("ENABLE_STRUCTURED_LOGGING", "true").lower() == "true",
        "enable_performance_logging": enable_performance_logging if enable_performance_logging is not None else os.getenv("ENABLE_PERFORMANCE_LOGGING", "true").lower() == "true"
    }
    
    _logging_config = LoggingConfig(**config)
    return _logging_config


def get_logging_config() -> LoggingConfig:
    """Get the global logging configuration"""
    global _logging_config
    if _logging_config is None:
        _logging_config = initialize_logging()
    return _logging_config


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the specified name"""
    return get_logging_config().get_logger(name)


# Convenience functions for common logging patterns
def log_ai_event(event_type: str, data: Dict[str, Any], level: str = "INFO"):
    """Log AI-specific events"""
    get_logging_config().log_ai_event(event_type, data, level)


def log_performance_metric(metric_name: str, value: float, unit: str = "", context: Dict[str, Any] = None):
    """Log performance metrics"""
    get_logging_config().log_performance_metric(metric_name, value, unit, context)


def log_learning_cycle(cycle_id: str, phase: str, data: Dict[str, Any]):
    """Log learning cycle events"""
    get_logging_config().log_learning_cycle(cycle_id, phase, data)


def log_neural_network_event(event: str, metrics: Dict[str, Any]):
    """Log neural network events"""
    get_logging_config().log_neural_network_event(event, metrics)


def log_strategy_generation(queen_id: str, generation: int, strategy_data: Dict[str, Any]):
    """Log strategy generation events"""
    get_logging_config().log_strategy_generation(queen_id, generation, strategy_data)


def log_websocket_event(event: str, client_id: str, data: Dict[str, Any] = None):
    """Log WebSocket events"""
    get_logging_config().log_websocket_event(event, client_id, data)


# Context manager for request logging
class RequestLoggingContext:
    """Context manager for request-specific logging"""
    
    def __init__(self, request_id: str):
        self.request_id = request_id
        self.logger = None
        self.start_time = None
    
    def __enter__(self):
        self.start_time = datetime.now()
        self.logger = get_logging_config().create_request_logger(self.request_id)
        self.logger.info(f"Request started: {self.request_id}")
        return self.logger
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = (datetime.now() - self.start_time).total_seconds()
        
        if exc_type:
            self.logger.error(f"Request failed: {self.request_id}", extra={
                "duration": duration,
                "exception_type": exc_type.__name__,
                "exception_message": str(exc_val)
            })
        else:
            self.logger.info(f"Request completed: {self.request_id}", extra={
                "duration": duration
            })


def request_logging_context(request_id: str) -> RequestLoggingContext:
    """Create a request logging context"""
    return RequestLoggingContext(request_id)