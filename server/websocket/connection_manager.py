"""
WebSocket Connection Manager for handling client connections
"""

import asyncio
import logging
from typing import Dict, List, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time client-backend communication
    """
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_metadata: Dict[str, Dict] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, client_id: Optional[str] = None):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        
        # Generate client ID if not provided
        if client_id is None:
            client_id = str(id(websocket))
        
        async with self._lock:
            self.active_connections[client_id] = websocket
            self.connection_metadata[client_id] = {
                "connected_at": asyncio.get_event_loop().time(),
                "message_count": 0,
                "last_activity": asyncio.get_event_loop().time()
            }
        
        logger.info(f"Client {client_id} connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        client_id = None
        
        # Find client ID by websocket
        for cid, ws in self.active_connections.items():
            if ws == websocket:
                client_id = cid
                break
        
        if client_id:
            asyncio.create_task(self._remove_connection(client_id))
    
    async def _remove_connection(self, client_id: str):
        """Remove connection with proper cleanup"""
        async with self._lock:
            if client_id in self.active_connections:
                del self.active_connections[client_id]
            if client_id in self.connection_metadata:
                del self.connection_metadata[client_id]
        
        logger.info(f"Client {client_id} disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: dict, client_id: str):
        """Send a message to a specific client"""
        websocket = self.active_connections.get(client_id)
        if websocket:
            try:
                await websocket.send_json(message)
                await self._update_activity(client_id)
                return True
            except Exception as e:
                logger.error(f"Failed to send message to client {client_id}: {e}")
                await self._remove_connection(client_id)
                return False
        else:
            logger.warning(f"Client {client_id} not found for message delivery")
            return False
    
    async def broadcast(self, message: dict):
        """Send a message to all connected clients"""
        if not self.active_connections:
            return
        
        disconnected_clients = []
        
        for client_id, websocket in self.active_connections.items():
            try:
                await websocket.send_json(message)
                await self._update_activity(client_id)
            except Exception as e:
                logger.error(f"Failed to broadcast to client {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            await self._remove_connection(client_id)
    
    async def _update_activity(self, client_id: str):
        """Update client activity metadata"""
        if client_id in self.connection_metadata:
            metadata = self.connection_metadata[client_id]
            metadata["last_activity"] = asyncio.get_event_loop().time()
            metadata["message_count"] += 1
    
    def get_connection_info(self) -> Dict:
        """Get information about all active connections"""
        current_time = asyncio.get_event_loop().time()
        
        connections_info = {}
        for client_id, metadata in self.connection_metadata.items():
            connections_info[client_id] = {
                "connected_duration": current_time - metadata["connected_at"],
                "message_count": metadata["message_count"],
                "last_activity": current_time - metadata["last_activity"],
                "status": "active" if client_id in self.active_connections else "disconnected"
            }
        
        return {
            "total_connections": len(self.active_connections),
            "connections": connections_info
        }
    
    async def cleanup_stale_connections(self, timeout_seconds: int = 300):
        """Remove connections that haven't been active for specified timeout"""
        current_time = asyncio.get_event_loop().time()
        stale_clients = []
        
        for client_id, metadata in self.connection_metadata.items():
            if current_time - metadata["last_activity"] > timeout_seconds:
                stale_clients.append(client_id)
        
        for client_id in stale_clients:
            logger.info(f"Removing stale connection: {client_id}")
            await self._remove_connection(client_id)
        
        return len(stale_clients)