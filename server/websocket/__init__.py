"""
WebSocket package for real-time client-backend communication.

This package contains:
- ConnectionManager: WebSocket connection lifecycle management
- MessageHandler: Main message processing facade
- MessageRouter: Message routing to handlers
- Schemas: Message type definitions and validation
- Handlers: Specialized handlers for different message categories
"""

from websocket.connection_manager import ConnectionManager
from websocket.message_handler import MessageHandler
from websocket.message_router import MessageRouter
from websocket.schemas import MessageType, ParsedMessage, validate_message

__all__ = [
    "ConnectionManager",
    "MessageHandler",
    "MessageRouter",
    "MessageType",
    "ParsedMessage",
    "validate_message",
]
