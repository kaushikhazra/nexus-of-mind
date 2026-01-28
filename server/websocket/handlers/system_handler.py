"""
Handler for system status and health messages.

Handles ping/pong, health checks, reconnection, and status requests.
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List, Callable, TYPE_CHECKING

from websocket.schemas import ParsedMessage
from websocket.handlers.base import create_error_response

if TYPE_CHECKING:
    from ai_engine.ai_engine import AIEngine

logger = logging.getLogger(__name__)


class SystemHandler:
    """
    Handles system-level WebSocket messages.

    Manages:
    - Ping/pong for connection testing
    - Health checks with system status
    - Client reconnection
    - Heartbeat responses
    - Difficulty status requests
    - Learning progress requests
    """

    def __init__(
        self,
        ai_engine: "AIEngine",
        message_handlers: List[str],
        message_stats_getter: Callable[[], Dict[str, Any]]
    ) -> None:
        """
        Initialize the system handler.

        Args:
            ai_engine: AIEngine instance
            message_handlers: List of supported message type names
            message_stats_getter: Function to get message statistics
        """
        self.ai_engine: "AIEngine" = ai_engine
        self.message_handlers: List[str] = message_handlers
        self.get_message_stats: Callable[[], Dict[str, Any]] = message_stats_getter

    async def handle_ping(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """
        Handle ping message for connection testing.

        Args:
            message: Raw message dictionary
            client_id: Client identifier

        Returns:
            Pong response with metrics
        """
        request_timestamp = message.get("timestamp", 0)
        current_timestamp = asyncio.get_event_loop().time()

        return {
            "type": "pong",
            "timestamp": current_timestamp,
            "data": {
                "clientId": client_id,
                "serverStatus": "healthy",
                "requestTimestamp": request_timestamp,
                "responseTime": current_timestamp - request_timestamp if request_timestamp > 0 else 0,
                "messageStats": self.get_message_stats() if self.get_message_stats else {}
            }
        }

    async def handle_health_check(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """
        Handle health check request with comprehensive system status.

        Args:
            message: Raw message dictionary
            client_id: Client identifier

        Returns:
            Health response with system status
        """
        return {
            "type": "health_response",
            "timestamp": asyncio.get_event_loop().time(),
            "data": {
                "status": "healthy",
                "aiEngine": "running" if self.ai_engine.initialized else "initializing",
                "neuralNetwork": "ready",  # PyTorch NNModel handled by ContinuousTrainer
                "gpuAcceleration": False,  # Configured via ContinuousTrainer
                "messageHandler": {
                    "status": "active",
                    "supportedMessageTypes": self.message_handlers,
                    "statistics": self.get_message_stats() if self.get_message_stats else {}
                },
                "systemInfo": {
                    "pythonVersion": "3.9+",
                    "pytorchVersion": "2.x",
                    "memoryUsage": "normal"
                }
            }
        }

    async def handle_heartbeat_response(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Handle heartbeat response from client.

        Args:
            message: Raw message dictionary
            client_id: Client identifier

        Returns:
            None (no response needed)
        """
        logger.debug(f"Heartbeat response received from client {client_id}")
        return None

    async def handle_reconnect(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """
        Handle client reconnection with message recovery.

        Args:
            message: Raw message dictionary
            client_id: Client identifier

        Returns:
            Reconnection response
        """
        try:
            reconnect_data = message.get("data", {})
            original_client_id = reconnect_data.get("clientId")
            last_message_id = reconnect_data.get("lastMessageId")

            logger.info(f"Handling reconnection for client {original_client_id}, last message: {last_message_id}")

            return {
                "type": "reconnect_response",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "status": "reconnected",
                    "clientId": client_id,
                    "originalClientId": original_client_id,
                    "missedMessages": [],  # TODO: Implement message recovery
                    "serverStatus": "healthy"
                }
            }

        except Exception as e:
            logger.error(f"Error handling reconnection: {e}")
            return create_error_response(
                f"Reconnection failed: {str(e)}",
                error_code="RECONNECTION_ERROR"
            )

    async def handle_difficulty_status_request(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """
        Handle request for difficulty system status.

        Args:
            message: Raw message dictionary
            client_id: Client identifier

        Returns:
            Difficulty status response
        """
        try:
            logger.info(f"Getting difficulty status for client {client_id}")

            response = await asyncio.wait_for(
                self.ai_engine.get_difficulty_status(),
                timeout=10.0
            )

            return response

        except asyncio.TimeoutError:
            logger.error(f"Difficulty status request timeout for client {client_id}")
            return create_error_response(
                "Status request timeout",
                error_code="REQUEST_TIMEOUT"
            )

        except Exception as e:
            logger.error(f"Error getting difficulty status: {e}")
            return create_error_response(
                f"Failed to get difficulty status: {str(e)}",
                error_code="PROCESSING_ERROR"
            )

    async def handle_learning_progress_request(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """
        Handle request for learning progress information.

        Args:
            message: Raw message dictionary
            client_id: Client identifier

        Returns:
            Learning progress response
        """
        try:
            queen_id = message.get("data", {}).get("queenId")
            if not queen_id:
                return create_error_response(
                    "Missing queenId in learning progress request",
                    error_code="MISSING_DATA"
                )

            logger.info(f"Getting learning progress for Queen ID: {queen_id}")

            response = await asyncio.wait_for(
                self.ai_engine.get_learning_progress(queen_id),
                timeout=30.0
            )

            return response

        except asyncio.TimeoutError:
            logger.error(f"Learning progress request timeout for Queen ID: {queen_id}")
            return create_error_response(
                "Progress request timeout",
                error_code="REQUEST_TIMEOUT"
            )

        except Exception as e:
            logger.error(f"Error getting learning progress: {e}")
            return create_error_response(
                f"Failed to get learning progress: {str(e)}",
                error_code="PROCESSING_ERROR"
            )
