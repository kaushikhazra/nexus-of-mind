"""
Handler for game state messages.

Handles queen death, queen success, and game outcome events.
"""

import asyncio
import logging
from typing import Dict, Any, List

from websocket.schemas import ParsedMessage, validate_death_data_business_logic
from websocket.handlers.base import create_error_response
from ai_engine.exceptions import InvalidObservationError, TrainingError

logger = logging.getLogger(__name__)


class GameStateHandler:
    """
    Handles game state change messages.

    Processes:
    - Queen death events (for AI learning)
    - Queen success events (positive reinforcement)
    - Game outcome events (difficulty adjustment)
    """

    def __init__(self, ai_engine):
        """
        Initialize the game state handler.

        Args:
            ai_engine: AIEngine instance for processing game events
        """
        self.ai_engine = ai_engine

    async def handle_queen_death(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """
        Handle Queen death data and trigger AI learning.

        Args:
            message: Raw message dictionary with death data
            client_id: Client identifier

        Returns:
            Processing response or error
        """
        try:
            death_data = message.get("data")
            if not death_data:
                return create_error_response("Missing death data", error_code="MISSING_DATA")

            # Business logic validation
            validation_errors = validate_death_data_business_logic(death_data)
            if validation_errors:
                return create_error_response(
                    f"Business logic validation failed: {'; '.join(validation_errors)}",
                    error_code="BUSINESS_VALIDATION_ERROR"
                )

            logger.info(f"Processing Queen death for ID: {death_data['queenId']}, Generation: {death_data['generation']}")

            try:
                response = await asyncio.wait_for(
                    self.ai_engine.process_queen_death(death_data),
                    timeout=120.0  # 2 minute timeout for neural network training
                )

                logger.info(f"Queen death processing completed for client {client_id}")
                return response

            except asyncio.TimeoutError:
                logger.error(f"Queen death processing timeout for client {client_id}")
                return create_error_response(
                    "Processing timeout - neural network training took too long",
                    error_code="PROCESSING_TIMEOUT"
                )

        except Exception as e:
            logger.error(f"Error processing Queen death: {e}")
            return create_error_response(
                f"Failed to process Queen death: {str(e)}",
                error_code="PROCESSING_ERROR"
            )

    async def handle_queen_success(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """
        Handle Queen success data for positive reinforcement learning.

        Args:
            message: Raw message dictionary with success data
            client_id: Client identifier

        Returns:
            Processing response or error
        """
        try:
            success_data = message.get("data")
            if not success_data:
                return create_error_response("Missing success data", error_code="MISSING_DATA")

            logger.info(f"Processing Queen success for ID: {success_data['queenId']}, Generation: {success_data['generation']}")

            try:
                response = await asyncio.wait_for(
                    self.ai_engine.process_queen_success(success_data),
                    timeout=60.0  # 1 minute timeout
                )

                logger.info(f"Queen success processing completed for client {client_id}")
                return response

            except asyncio.TimeoutError:
                logger.error(f"Queen success processing timeout for client {client_id}")
                return create_error_response(
                    "Processing timeout - success reinforcement took too long",
                    error_code="PROCESSING_TIMEOUT"
                )

        except Exception as e:
            logger.error(f"Error processing Queen success: {e}")
            return create_error_response(
                f"Failed to process Queen success: {str(e)}",
                error_code="PROCESSING_ERROR"
            )

    async def handle_game_outcome(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """
        Handle game outcome data for difficulty adjustment.

        Args:
            message: Raw message dictionary with outcome data
            client_id: Client identifier

        Returns:
            Processing response or error
        """
        try:
            outcome_data = message.get("data")
            if not outcome_data:
                return create_error_response("Missing outcome data", error_code="MISSING_DATA")

            logger.info(f"Processing game outcome for difficulty adjustment from client {client_id}")

            try:
                response = await asyncio.wait_for(
                    self.ai_engine.process_game_outcome(outcome_data),
                    timeout=30.0  # 30 second timeout
                )

                logger.info(f"Game outcome processing completed for client {client_id}")
                return response

            except asyncio.TimeoutError:
                logger.error(f"Game outcome processing timeout for client {client_id}")
                return create_error_response(
                    "Processing timeout - difficulty adjustment took too long",
                    error_code="PROCESSING_TIMEOUT"
                )

        except Exception as e:
            logger.error(f"Error processing game outcome: {e}")
            return create_error_response(
                f"Failed to process game outcome: {str(e)}",
                error_code="PROCESSING_ERROR"
            )
