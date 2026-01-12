"""
WebSocket Connection Manager for handling client connections
Enhanced with reconnection, timeout handling, and message queuing
"""

import asyncio
import logging
import json
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from collections import deque
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class MessageQueue:
    """Message queue for offline message handling"""
    
    def __init__(self, max_size: int = 100):
        self.messages: deque = deque(maxlen=max_size)
        self.max_size = max_size
    
    def add_message(self, message: Dict[str, Any]):
        """Add message to queue"""
        message["queued_at"] = asyncio.get_event_loop().time()
        self.messages.append(message)
    
    def get_messages_since(self, timestamp: float) -> List[Dict[str, Any]]:
        """Get messages queued since timestamp"""
        return [msg for msg in self.messages if msg.get("queued_at", 0) > timestamp]
    
    def get_all_messages(self) -> List[Dict[str, Any]]:
        """Get all queued messages"""
        return list(self.messages)
    
    def clear(self):
        """Clear all messages"""
        self.messages.clear()
    
    def size(self) -> int:
        """Get queue size"""
        return len(self.messages)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time client-backend communication
    Enhanced with reconnection support, timeout handling, and message queuing
    """
    
    def __init__(self, 
                 connection_timeout: int = 300,  # 5 minutes
                 heartbeat_interval: int = 30,   # 30 seconds
                 max_queue_size: int = 100):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_metadata: Dict[str, Dict] = {}
        self.message_queues: Dict[str, MessageQueue] = {}
        self.connection_timeout = connection_timeout
        self.heartbeat_interval = heartbeat_interval
        self.max_queue_size = max_queue_size
        self._lock = asyncio.Lock()
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        
        # Start background tasks
        self._start_background_tasks()
    
    def _start_background_tasks(self):
        """Start background tasks for heartbeat and cleanup"""
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
    
    async def _heartbeat_loop(self):
        """Send periodic heartbeat to all connections"""
        while True:
            try:
                await asyncio.sleep(self.heartbeat_interval)
                await self._send_heartbeat()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Heartbeat loop error: {e}")
    
    async def _cleanup_loop(self):
        """Periodic cleanup of stale connections"""
        while True:
            try:
                await asyncio.sleep(60)  # Run cleanup every minute
                await self.cleanup_stale_connections(self.connection_timeout)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cleanup loop error: {e}")
    
    async def _send_heartbeat(self):
        """Send heartbeat to all active connections"""
        if not self.active_connections:
            return
        
        heartbeat_message = {
            "type": "heartbeat",
            "timestamp": asyncio.get_event_loop().time(),
            "data": {"status": "alive"}
        }
        
        disconnected_clients = []
        
        for client_id, websocket in self.active_connections.items():
            try:
                await websocket.send_json(heartbeat_message)
                await self._update_activity(client_id)
            except Exception as e:
                logger.warning(f"Heartbeat failed for client {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Clean up failed connections
        for client_id in disconnected_clients:
            await self._handle_connection_loss(client_id)
    
    async def connect(self, websocket: WebSocket, client_id: Optional[str] = None):
        """Accept a new WebSocket connection with enhanced metadata"""
        await websocket.accept()
        
        # Generate client ID if not provided
        if client_id is None:
            client_id = str(id(websocket))
        
        current_time = asyncio.get_event_loop().time()
        
        async with self._lock:
            # Check if this is a reconnection
            is_reconnection = client_id in self.connection_metadata
            
            self.active_connections[client_id] = websocket
            
            if is_reconnection:
                # Update existing metadata for reconnection
                self.connection_metadata[client_id].update({
                    "reconnected_at": current_time,
                    "reconnection_count": self.connection_metadata[client_id].get("reconnection_count", 0) + 1,
                    "last_activity": current_time,
                    "status": "connected"
                })
                logger.info(f"Client {client_id} reconnected (#{self.connection_metadata[client_id]['reconnection_count']})")
            else:
                # Create new metadata for new connection
                self.connection_metadata[client_id] = {
                    "connected_at": current_time,
                    "last_activity": current_time,
                    "message_count": 0,
                    "reconnection_count": 0,
                    "status": "connected",
                    "user_agent": None,  # TODO: Extract from headers
                    "ip_address": None   # TODO: Extract from connection
                }
                # Create message queue for this client
                self.message_queues[client_id] = MessageQueue(self.max_queue_size)
                logger.info(f"New client {client_id} connected")
        
        logger.info(f"Total active connections: {len(self.active_connections)}")
        return client_id
    
    def disconnect(self, websocket: WebSocket, client_id: Optional[str] = None):
        """Remove a WebSocket connection with graceful handling"""
        if client_id is None:
            # Find client ID by websocket
            for cid, ws in self.active_connections.items():
                if ws == websocket:
                    client_id = cid
                    break
        
        if client_id:
            asyncio.create_task(self._handle_disconnection(client_id))
    
    async def _handle_disconnection(self, client_id: str):
        """Handle client disconnection with metadata update"""
        async with self._lock:
            if client_id in self.active_connections:
                del self.active_connections[client_id]
            
            if client_id in self.connection_metadata:
                self.connection_metadata[client_id]["status"] = "disconnected"
                self.connection_metadata[client_id]["disconnected_at"] = asyncio.get_event_loop().time()
        
        logger.info(f"Client {client_id} disconnected. Active connections: {len(self.active_connections)}")
    
    async def _handle_connection_loss(self, client_id: str):
        """Handle unexpected connection loss"""
        async with self._lock:
            if client_id in self.active_connections:
                del self.active_connections[client_id]
            
            if client_id in self.connection_metadata:
                self.connection_metadata[client_id]["status"] = "connection_lost"
                self.connection_metadata[client_id]["connection_lost_at"] = asyncio.get_event_loop().time()
        
        logger.warning(f"Connection lost for client {client_id}. Active connections: {len(self.active_connections)}")
    
    async def _remove_connection(self, client_id: str):
        """Remove connection with proper cleanup"""
        async with self._lock:
            if client_id in self.active_connections:
                del self.active_connections[client_id]
            if client_id in self.connection_metadata:
                del self.connection_metadata[client_id]
            if client_id in self.message_queues:
                del self.message_queues[client_id]
        
        logger.info(f"Client {client_id} removed completely. Total connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: dict, client_id: str, queue_if_offline: bool = True) -> bool:
        """Send a message to a specific client with offline queuing support"""
        websocket = self.active_connections.get(client_id)
        
        if websocket:
            try:
                await websocket.send_json(message)
                await self._update_activity(client_id)
                logger.debug(f"Message sent to client {client_id}")
                return True
            except Exception as e:
                logger.error(f"Failed to send message to client {client_id}: {e}")
                await self._handle_connection_loss(client_id)
                
                # Queue message if client was connected but send failed
                if queue_if_offline and client_id in self.message_queues:
                    self.message_queues[client_id].add_message(message)
                    logger.info(f"Message queued for offline client {client_id}")
                
                return False
        else:
            # Client is offline - queue message if requested
            if queue_if_offline and client_id in self.message_queues:
                self.message_queues[client_id].add_message(message)
                logger.info(f"Message queued for offline client {client_id}")
                return True
            else:
                logger.warning(f"Client {client_id} not found and queuing disabled")
                return False
    
    async def send_queued_messages(self, client_id: str) -> int:
        """Send all queued messages to a reconnected client"""
        if client_id not in self.message_queues or client_id not in self.active_connections:
            return 0
        
        websocket = self.active_connections[client_id]
        message_queue = self.message_queues[client_id]
        messages = message_queue.get_all_messages()
        
        if not messages:
            return 0
        
        sent_count = 0
        failed_messages = []
        
        for message in messages:
            try:
                # Add replay indicator
                message["replayed"] = True
                message["replayed_at"] = asyncio.get_event_loop().time()
                
                await websocket.send_json(message)
                sent_count += 1
                await self._update_activity(client_id)
            except Exception as e:
                logger.error(f"Failed to send queued message to client {client_id}: {e}")
                failed_messages.append(message)
                break  # Stop sending if connection fails
        
        # Clear successfully sent messages, keep failed ones
        if sent_count > 0:
            message_queue.clear()
            for failed_msg in failed_messages:
                message_queue.add_message(failed_msg)
        
        logger.info(f"Sent {sent_count} queued messages to client {client_id}")
        return sent_count
    
    async def broadcast(self, message: dict, exclude_clients: Optional[List[str]] = None):
        """Send a message to all connected clients with enhanced error handling"""
        if not self.active_connections:
            return
        
        exclude_clients = exclude_clients or []
        disconnected_clients = []
        successful_sends = 0
        
        for client_id, websocket in self.active_connections.items():
            if client_id in exclude_clients:
                continue
                
            try:
                await websocket.send_json(message)
                await self._update_activity(client_id)
                successful_sends += 1
            except Exception as e:
                logger.error(f"Failed to broadcast to client {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            await self._handle_connection_loss(client_id)
        
        logger.info(f"Broadcast sent to {successful_sends} clients, {len(disconnected_clients)} failed")
    
    async def _update_activity(self, client_id: str):
        """Update client activity metadata"""
        if client_id in self.connection_metadata:
            metadata = self.connection_metadata[client_id]
            metadata["last_activity"] = asyncio.get_event_loop().time()
            metadata["message_count"] += 1
    
    def get_connection_info(self) -> Dict:
        """Get comprehensive information about all connections"""
        current_time = asyncio.get_event_loop().time()
        
        connections_info = {}
        for client_id, metadata in self.connection_metadata.items():
            connection_duration = current_time - metadata["connected_at"]
            last_activity_ago = current_time - metadata["last_activity"]
            
            connections_info[client_id] = {
                "status": metadata.get("status", "unknown"),
                "connected_duration": connection_duration,
                "message_count": metadata["message_count"],
                "last_activity_ago": last_activity_ago,
                "reconnection_count": metadata.get("reconnection_count", 0),
                "is_active": client_id in self.active_connections,
                "queued_messages": self.message_queues.get(client_id, MessageQueue()).size()
            }
        
        return {
            "total_connections": len(self.active_connections),
            "total_known_clients": len(self.connection_metadata),
            "connections": connections_info,
            "system_info": {
                "heartbeat_interval": self.heartbeat_interval,
                "connection_timeout": self.connection_timeout,
                "max_queue_size": self.max_queue_size
            }
        }
    
    async def cleanup_stale_connections(self, timeout_seconds: int = None) -> int:
        """Remove connections that haven't been active for specified timeout"""
        if timeout_seconds is None:
            timeout_seconds = self.connection_timeout
            
        current_time = asyncio.get_event_loop().time()
        stale_clients = []
        
        for client_id, metadata in self.connection_metadata.items():
            last_activity = metadata.get("last_activity", 0)
            if current_time - last_activity > timeout_seconds:
                stale_clients.append(client_id)
        
        for client_id in stale_clients:
            logger.info(f"Removing stale connection: {client_id}")
            await self._remove_connection(client_id)
        
        if stale_clients:
            logger.info(f"Cleaned up {len(stale_clients)} stale connections")
        
        return len(stale_clients)
    
    def get_client_queue_info(self, client_id: str) -> Dict[str, Any]:
        """Get message queue information for a specific client"""
        if client_id not in self.message_queues:
            return {"error": "Client not found"}
        
        queue = self.message_queues[client_id]
        return {
            "client_id": client_id,
            "queue_size": queue.size(),
            "max_queue_size": queue.max_size,
            "messages": queue.get_all_messages()
        }
    
    async def shutdown(self):
        """Gracefully shutdown connection manager"""
        logger.info("Shutting down connection manager...")
        
        # Cancel background tasks
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
        
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        # Close all active connections
        for client_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.close()
            except Exception as e:
                logger.error(f"Error closing connection for client {client_id}: {e}")
        
        # Clear all data
        self.active_connections.clear()
        self.connection_metadata.clear()
        self.message_queues.clear()
        
        logger.info("Connection manager shutdown complete")