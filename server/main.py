"""
Adaptive Queen Intelligence - Python AI Backend
Main FastAPI application with WebSocket support for real-time AI learning
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Dict, Any

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from ai_engine.ai_engine import AIEngine
from ai_engine.neural_network import QueenBehaviorNetwork
from websocket.connection_manager import ConnectionManager
from websocket.message_handler import MessageHandler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global instances
ai_engine: AIEngine = None
connection_manager: ConnectionManager = None
message_handler: MessageHandler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown"""
    global ai_engine, connection_manager, message_handler
    
    logger.info("Starting Adaptive Queen Intelligence AI Backend...")
    
    # Initialize AI Engine with GPU acceleration if available
    try:
        ai_engine = AIEngine()
        await ai_engine.initialize()
        logger.info("AI Engine initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize AI Engine: {e}")
        raise
    
    # Initialize WebSocket connection manager
    connection_manager = ConnectionManager()
    
    # Initialize message handler
    message_handler = MessageHandler(ai_engine)
    
    logger.info("Backend initialization complete")
    
    yield
    
    # Cleanup on shutdown
    logger.info("Shutting down AI Backend...")
    if ai_engine:
        await ai_engine.cleanup()


# Create FastAPI application
app = FastAPI(
    title="Adaptive Queen Intelligence AI Backend",
    description="Neural network-powered AI learning system for Nexus of Mind",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for client communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080"],  # Game client origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "service": "Adaptive Queen Intelligence AI Backend",
        "version": "1.0.0",
        "gpu_available": ai_engine.neural_network.use_gpu if ai_engine else False
    }


@app.get("/health")
async def health_check():
    """Detailed health check with AI engine status"""
    if not ai_engine:
        return {"status": "error", "message": "AI Engine not initialized"}
    
    return {
        "status": "healthy",
        "ai_engine": "running",
        "neural_network": "ready",
        "gpu_acceleration": ai_engine.neural_network.use_gpu,
        "active_connections": len(connection_manager.active_connections)
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for client-backend communication"""
    await connection_manager.connect(websocket)
    client_id = id(websocket)
    
    try:
        logger.info(f"Client {client_id} connected")
        
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            # Process message through message handler
            response = await message_handler.handle_message(data, client_id)
            
            # Send response back to client
            if response:
                await websocket.send_json(response)
                
    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
    finally:
        connection_manager.disconnect(websocket)


@app.websocket("/ws/{client_id}")
async def websocket_endpoint_with_id(websocket: WebSocket, client_id: str):
    """WebSocket endpoint with explicit client ID for reconnection"""
    await connection_manager.connect(websocket, client_id)
    
    try:
        logger.info(f"Client {client_id} connected with explicit ID")
        
        while True:
            data = await websocket.receive_json()
            response = await message_handler.handle_message(data, client_id)
            
            if response:
                await websocket.send_json(response)
                
    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
    finally:
        connection_manager.disconnect(websocket)


if __name__ == "__main__":
    # Development server configuration
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,  # Enable auto-reload for development
        log_level="info"
    )