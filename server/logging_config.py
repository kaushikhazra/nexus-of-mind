"""
Minimal logging configuration for server startup only.
"""


class NoOpLogger:
    """Logger that does nothing."""
    def info(self, *args, **kwargs): pass
    def debug(self, *args, **kwargs): pass
    def warning(self, *args, **kwargs): pass
    def error(self, *args, **kwargs): pass
    def critical(self, *args, **kwargs): pass
    def exception(self, *args, **kwargs): pass


def initialize_logging():
    """No-op - logging handled by uvicorn."""
    pass


def get_logger(name: str):
    """Return no-op logger."""
    return NoOpLogger()


def log_ai_event(*args, **kwargs):
    """No-op."""
    pass


def log_websocket_event(*args, **kwargs):
    """No-op."""
    pass


def request_logging_context(request_id: str):
    """Return a no-op context manager."""
    class NoOpContext:
        def __enter__(self):
            return NoOpLogger()
        def __exit__(self, *args):
            pass
    return NoOpContext()
