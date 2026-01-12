"""
WebSocket Message Handler for processing client messages
"""

import asyncio
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class MessageHandler:
    """
    Handles incoming WebSocket messages and routes them to appropriate AI Engine functions
    """
    
    def __init__(self, ai_engine):
        self.ai_engine = ai_engine
        self.message_handlers = {
            "queen_death": self._handle_queen_death,
            "learning_progress_request": self._handle_learning_progress_request,
            "ping": self._handle_ping,
            "health_check": self._handle_health_check
        }
    
    async def handle_message(self, message: Dict[str, Any], client_id: str) -> Optional[Dict[str, Any]]:
        """
        Process incoming message and return response
        
        Args:
            message: Message data from client
            client_id: ID of the client that sent the message
            
        Returns:
            Response message or None if no response needed
        """
        try:
            message_type = message.get("type")
            if not message_type:
                return self._create_error_response("Missing message type")
            
            logger.info(f"Handling message type '{message_type}' from client {client_id}")
            
            # Route message to appropriate handler
            handler = self.message_handlers.get(message_type)
            if handler:
                return await handler(message, client_id)
            else:
                logger.warning(f"Unknown message type: {message_type}")
                return self._create_error_response(f"Unknown message type: {message_type}")
        
        except Exception as e:
            logger.error(f"Error handling message from client {client_id}: {e}")
            return self._create_error_response(f"Internal server error: {str(e)}")
    
    async def _handle_queen_death(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Handle Queen death data and trigger AI learning"""
        try:
            death_data = message.get("data")
            if not death_data:
                return self._create_error_response("Missing death data")
            
            # Validate required fields
            required_fields = ["queenId", "generation", "deathLocation", "deathCause"]
            missing_fields = [field for field in required_fields if field not in death_data]
            if missing_fields:
                return self._create_error_response(f"Missing required fields: {missing_fields}")
            
            logger.info(f"Processing Queen death for ID: {death_data['queenId']}, Generation: {death_data['generation']}")
            
            # Process through AI Engine
            response = await self.ai_engine.process_queen_death(death_data)
            
            logger.info(f"Queen death processing completed for client {client_id}")
            return response
        
        except Exception as e:
            logger.error(f"Error processing Queen death: {e}")
            return self._create_error_response(f"Failed to process Queen death: {str(e)}")
    
    async def _handle_learning_progress_request(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Handle request for learning progress information"""
        try:
            queen_id = message.get("data", {}).get("queenId")
            if not queen_id:
                return self._create_error_response("Missing queenId in learning progress request")
            
            logger.info(f"Getting learning progress for Queen ID: {queen_id}")
            
            # Get progress from AI Engine
            response = await self.ai_engine.get_learning_progress(queen_id)
            
            return response
        
        except Exception as e:
            logger.error(f"Error getting learning progress: {e}")
            return self._create_error_response(f"Failed to get learning progress: {str(e)}")
    
    async def _handle_ping(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Handle ping message for connection testing"""
        return {
            "type": "pong",
            "timestamp": asyncio.get_event_loop().time(),
            "data": {
                "clientId": client_id,
                "serverStatus": "healthy"
            }
        }
    
    async def _handle_health_check(self, message: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Handle health check request"""
        return {
            "type": "health_response",
            "timestamp": asyncio.get_event_loop().time(),
            "data": {
                "status": "healthy",
                "aiEngine": "running" if self.ai_engine.initialized else "initializing",
                "neuralNetwork": "ready" if self.ai_engine.neural_network else "not_ready",
                "gpuAcceleration": self.ai_engine.neural_network.use_gpu if self.ai_engine.neural_network else False
            }
        }
    
    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """Create standardized error response"""
        return {
            "type": "error",
            "timestamp": asyncio.get_event_loop().time(),
            "data": {
                "error": error_message,
                "status": "error"
            }
        }