"""
Message Routing for WebSocket Handlers.

Routes incoming messages to appropriate handlers based on message type.
Implements a plugin-style registration pattern for extensibility.

Design Pattern:
    This module implements the Router/Dispatcher pattern, allowing
    handlers to be registered dynamically and messages to be routed
    to the appropriate handler based on their type.

Key Features:
    - String-based and enum-based handler registration
    - Graceful error handling for unknown message types
    - Logging of handler registration and routing

Usage:
    from websocket.message_router import MessageRouter

    router = MessageRouter()
    router.register("observation_data", observation_handler.handle_raw)
    router.register("queen_death", game_state_handler.handle_queen_death)

    # Route incoming message
    response = await router.route_raw("observation_data", message, client_id)

Classes:
    - MessageRouter: Routes WebSocket messages to appropriate handlers
"""

import logging
from typing import Dict, Any, Callable, Awaitable, Optional, List

from websocket.schemas import MessageType, ParsedMessage

logger = logging.getLogger(__name__)

# Type alias for handler functions
HandlerFunc = Callable[[ParsedMessage], Awaitable[Optional[Dict[str, Any]]]]


class MessageRouter:
    """
    Routes WebSocket messages to appropriate handlers.

    Implements a plugin-style registration pattern where handlers
    can be registered for specific message types.
    """

    def __init__(self):
        self._handlers: Dict[str, HandlerFunc] = {}
        self._type_handlers: Dict[MessageType, HandlerFunc] = {}

    def register(self, message_type: str, handler: HandlerFunc) -> None:
        """
        Register a handler for a message type (string-based).

        Args:
            message_type: Message type string (e.g., "queen_death")
            handler: Async function to handle the message
        """
        self._handlers[message_type] = handler
        logger.debug(f"Registered handler for message type: {message_type}")

    def register_typed(self, message_type: MessageType, handler: HandlerFunc) -> None:
        """
        Register a handler for a MessageType enum value.

        Args:
            message_type: MessageType enum value
            handler: Async function to handle the message
        """
        self._type_handlers[message_type] = handler
        self._handlers[message_type.value] = handler
        logger.debug(f"Registered typed handler for: {message_type.value}")

    async def route(self, message: ParsedMessage) -> Optional[Dict[str, Any]]:
        """
        Route a message to its registered handler.

        Args:
            message: Parsed message to route

        Returns:
            Response dict if handler returns one, None otherwise.
        """
        # Try typed handler first
        handler = self._type_handlers.get(message.type)

        # Fall back to string-based handler
        if handler is None:
            handler = self._handlers.get(message.type.value)

        if handler is None:
            logger.warning(f"No handler for message type: {message.type}")
            return {
                "type": "error",
                "error": f"Unknown message type: {message.type.value if isinstance(message.type, MessageType) else message.type}",
                "errorCode": "UNKNOWN_MESSAGE_TYPE"
            }

        try:
            return await handler(message)
        except Exception as e:
            logger.error(f"Handler error for {message.type}: {e}", exc_info=True)
            return {
                "type": "error",
                "error": str(e),
                "errorCode": "HANDLER_ERROR"
            }

    async def route_raw(
        self,
        message_type: str,
        message: Dict[str, Any],
        client_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Route a raw message dictionary to its handler.

        This is a convenience method for backward compatibility with
        the existing message handler interface.

        Args:
            message_type: Message type string
            message: Raw message dictionary
            client_id: Client identifier

        Returns:
            Response dict if handler returns one, None otherwise.
        """
        handler = self._handlers.get(message_type)

        if handler is None:
            logger.warning(f"No handler for message type: {message_type}")
            return {
                "type": "error",
                "error": f"Unknown message type: {message_type}",
                "errorCode": "UNKNOWN_MESSAGE_TYPE"
            }

        try:
            # Create a minimal ParsedMessage for backward compatibility
            from websocket.schemas import get_message_type
            msg_type = get_message_type(message_type)

            if msg_type is None:
                # Unknown type, but handler exists (custom handler)
                # Pass raw message to handler
                return await handler(message, client_id)

            parsed = ParsedMessage(
                type=msg_type,
                data=message.get("data", message),
                client_id=client_id,
                message_id=message.get("messageId")
            )
            return await handler(parsed)
        except TypeError:
            # Handler expects old signature (message, client_id)
            return await handler(message, client_id)
        except Exception as e:
            logger.error(f"Handler error for {message_type}: {e}", exc_info=True)
            return {
                "type": "error",
                "error": str(e),
                "errorCode": "HANDLER_ERROR"
            }

    def get_registered_types(self) -> List[str]:
        """Get list of registered message type strings."""
        return list(self._handlers.keys())

    def has_handler(self, message_type: str) -> bool:
        """Check if a handler is registered for the given type."""
        return message_type in self._handlers
