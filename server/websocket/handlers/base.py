"""
Base utilities for WebSocket handlers.

Provides shared functionality to avoid code duplication across handlers.
"""

import asyncio
from typing import Dict, Any, List, Optional


def create_error_response(
    error_message: str,
    error_code: str = "GENERIC_ERROR",
    retryable: bool = False,
    supported_message_types: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Create a standardized error response.

    Args:
        error_message: Human-readable error description
        error_code: Machine-readable error code
        retryable: Whether the client should retry the request
        supported_message_types: Optional list of supported message types

    Returns:
        Standardized error response dictionary
    """
    response = {
        "type": "error",
        "timestamp": asyncio.get_event_loop().time(),
        "data": {
            "error": error_message,
            "errorCode": error_code,
            "status": "error"
        }
    }

    if retryable:
        response["data"]["retryable"] = True

    if supported_message_types:
        response["data"]["supportedMessageTypes"] = supported_message_types

    return response


# Error codes that are retryable by default
RETRYABLE_ERROR_CODES = frozenset([
    "PROCESSING_TIMEOUT",
    "REQUEST_TIMEOUT",
    "PROCESSING_ERROR"
])


def is_retryable_error(error_code: str) -> bool:
    """Check if an error code indicates a retryable error."""
    return error_code in RETRYABLE_ERROR_CODES
