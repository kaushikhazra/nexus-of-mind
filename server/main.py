"""
Adaptive Queen Intelligence - Python AI Backend
Main FastAPI application with WebSocket support for real-time AI learning
Enhanced with comprehensive logging and system integration
"""

import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager
from typing import Dict, Any

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ai_engine.ai_engine import AIEngine
from ai_engine.neural_network import QueenBehaviorNetwork
from websocket.connection_manager import ConnectionManager
from websocket.message_handler import MessageHandler
from logging_config import initialize_logging, get_logger, log_ai_event, log_websocket_event, request_logging_context
from routes.progress_routes import router as progress_router
from database.energy_lords import init_db

# Initialize comprehensive logging
initialize_logging()
logger = get_logger(__name__)

# Global instances
ai_engine: AIEngine = None
connection_manager: ConnectionManager = None
message_handler: MessageHandler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown with enhanced logging"""
    global ai_engine, connection_manager, message_handler
    
    startup_id = str(uuid.uuid4())
    
    with request_logging_context(f"startup_{startup_id}") as startup_logger:
        startup_logger.info("Starting Adaptive Queen Intelligence AI Backend...")
        
        # Log system information
        log_ai_event("system_startup", {
            "startup_id": startup_id,
            "python_version": os.sys.version,
            "environment": os.getenv("ENVIRONMENT", "development"),
            "gpu_enabled": os.getenv("ENABLE_GPU", "false").lower() == "true"
        })
        
        # Initialize Energy Lords database
        try:
            init_db()
            startup_logger.info("Energy Lords database initialized successfully")
        except Exception as e:
            startup_logger.warning(f"Failed to initialize Energy Lords database: {e}")

        # Initialize AI Engine with GPU acceleration if available
        try:
            ai_engine = AIEngine()
            await ai_engine.initialize()
            startup_logger.info("AI Engine initialized successfully")
            
            log_ai_event("ai_engine_initialized", {
                "gpu_available": ai_engine.neural_network.use_gpu if ai_engine.neural_network else False,
                "components_initialized": [
                    "neural_network", "death_analyzer", "player_behavior", 
                    "strategy_generator", "memory_manager", "adaptive_difficulty"
                ]
            })
            
        except Exception as e:
            startup_logger.error(f"Failed to initialize AI Engine: {e}")
            log_ai_event("ai_engine_initialization_failed", {"error": str(e)}, "ERROR")
            raise
        
        # Initialize WebSocket connection manager
        connection_manager = ConnectionManager()
        startup_logger.info("WebSocket connection manager initialized")
        
        # Initialize message handler
        message_handler = MessageHandler(ai_engine)
        startup_logger.info("Message handler initialized")
        
        log_ai_event("backend_startup_complete", {
            "startup_id": startup_id,
            "components": ["ai_engine", "connection_manager", "message_handler"]
        })
        
        startup_logger.info("Backend initialization complete")
    
    yield
    
    # Cleanup on shutdown
    shutdown_id = str(uuid.uuid4())
    
    with request_logging_context(f"shutdown_{shutdown_id}") as shutdown_logger:
        shutdown_logger.info("Shutting down AI Backend...")
        
        # Shutdown connection manager first
        if connection_manager:
            await connection_manager.shutdown()
            shutdown_logger.info("Connection manager shutdown complete")
        
        # Then cleanup AI engine
        if ai_engine:
            await ai_engine.cleanup()
            shutdown_logger.info("AI engine cleanup complete")
        
        log_ai_event("backend_shutdown_complete", {"shutdown_id": shutdown_id})
        shutdown_logger.info("Backend shutdown complete")


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

# Register API routers
app.include_router(progress_router)


@app.get("/")
async def root():
    """Health check endpoint with comprehensive system information"""
    system_info = {
        "status": "running",
        "service": "Adaptive Queen Intelligence AI Backend",
        "version": "1.0.0",
        "gpu_available": ai_engine.neural_network.use_gpu if ai_engine and ai_engine.neural_network else False,
        "environment": os.getenv("ENVIRONMENT", "development"),
        "active_connections": len(connection_manager.active_connections) if connection_manager else 0,
        "system_health": {
            "ai_engine_initialized": ai_engine is not None and ai_engine.initialized,
            "connection_manager_active": connection_manager is not None,
            "message_handler_active": message_handler is not None
        }
    }
    
    log_ai_event("health_check", system_info)
    return system_info


@app.get("/health")
async def health_check():
    """Detailed health check with AI engine status and performance metrics"""
    if not ai_engine:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "message": "AI Engine not initialized"}
        )
    
    # Gather comprehensive health information
    health_data = {
        "status": "healthy",
        "timestamp": asyncio.get_event_loop().time(),
        "ai_engine": "running" if ai_engine.initialized else "initializing",
        "neural_network": "ready" if ai_engine.neural_network else "unavailable",
        "gpu_acceleration": ai_engine.neural_network.use_gpu if ai_engine.neural_network else False,
        "active_connections": len(connection_manager.active_connections) if connection_manager else 0,
        "system_metrics": {
            "uptime_seconds": asyncio.get_event_loop().time(),
            "environment": os.getenv("ENVIRONMENT", "development"),
            "log_level": os.getenv("LOG_LEVEL", "INFO")
        }
    }
    
    # Add performance metrics if available
    try:
        import psutil
        process = psutil.Process()
        health_data["performance_metrics"] = {
            "memory_mb": process.memory_info().rss / 1024 / 1024,
            "cpu_percent": process.cpu_percent(),
            "threads": process.num_threads()
        }
    except ImportError:
        pass
    
    log_ai_event("detailed_health_check", health_data)
    return health_data


@app.get("/system/status")
async def system_status():
    """Comprehensive system status including AI learning statistics"""
    if not ai_engine:
        return JSONResponse(
            status_code=503,
            content={"error": "AI Engine not initialized"}
        )
    
    status = {
        "system": {
            "status": "operational",
            "version": "1.0.0",
            "environment": os.getenv("ENVIRONMENT", "development"),
            "uptime": asyncio.get_event_loop().time()
        },
        "ai_engine": {
            "initialized": ai_engine.initialized,
            "neural_network_available": ai_engine.neural_network is not None,
            "gpu_acceleration": ai_engine.neural_network.use_gpu if ai_engine.neural_network else False
        },
        "connections": {
            "active": len(connection_manager.active_connections) if connection_manager else 0,
            "total_known": len(connection_manager.connection_metadata) if connection_manager else 0
        }
    }
    
    return status


@app.post("/system/test")
async def trigger_system_test():
    """Trigger comprehensive system test (for debugging and validation)"""
    if not ai_engine:
        return JSONResponse(
            status_code=503,
            content={"error": "AI Engine not initialized"}
        )
    
    test_id = str(uuid.uuid4())
    
    with request_logging_context(f"system_test_{test_id}") as test_logger:
        test_logger.info("Starting system test")
        
        try:
            # Test AI engine components
            test_results = {
                "test_id": test_id,
                "timestamp": asyncio.get_event_loop().time(),
                "tests": {}
            }
            
            # Test neural network
            if ai_engine.neural_network:
                test_results["tests"]["neural_network"] = {
                    "status": "available",
                    "gpu_enabled": ai_engine.neural_network.use_gpu
                }
            else:
                test_results["tests"]["neural_network"] = {"status": "unavailable"}
            
            # Test connection manager
            if connection_manager:
                test_results["tests"]["connection_manager"] = {
                    "status": "active",
                    "active_connections": len(connection_manager.active_connections)
                }
            else:
                test_results["tests"]["connection_manager"] = {"status": "unavailable"}
            
            # Test message handler
            if message_handler:
                test_results["tests"]["message_handler"] = {"status": "active"}
            else:
                test_results["tests"]["message_handler"] = {"status": "unavailable"}
            
            test_results["overall_status"] = "passed"
            
            log_ai_event("system_test_completed", test_results)
            test_logger.info("System test completed successfully")
            
            return test_results
            
        except Exception as e:
            test_results = {
                "test_id": test_id,
                "overall_status": "failed",
                "error": str(e)
            }
            
            log_ai_event("system_test_failed", test_results, "ERROR")
            test_logger.error(f"System test failed: {e}")
            
            return JSONResponse(status_code=500, content=test_results)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for client-backend communication with comprehensive logging"""
    client_id = None
    connection_start = asyncio.get_event_loop().time()
    
    try:
        client_id = await connection_manager.connect(websocket)
        log_websocket_event("client_connected", client_id, {
            "endpoint": "main",
            "connection_time": connection_start
        })
        
        # Send queued messages if this is a reconnection
        queued_count = await connection_manager.send_queued_messages(client_id)
        if queued_count > 0:
            log_websocket_event("queued_messages_sent", client_id, {
                "message_count": queued_count
            })
        
        message_count = 0
        
        while True:
            try:
                # Receive message from client with timeout
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                message_count += 1
                
                # Log message received
                log_websocket_event("message_received", client_id, {
                    "message_type": data.get("type", "unknown"),
                    "message_count": message_count,
                    "timestamp": data.get("timestamp")
                })
                
                # Process message through message handler
                response = await message_handler.handle_message(data, client_id)
                
                # Send response back to client
                if response:
                    await websocket.send_json(response)
                    log_websocket_event("response_sent", client_id, {
                        "response_type": response.get("type", "unknown"),
                        "message_count": message_count
                    })
                    
            except asyncio.TimeoutError:
                # Send ping to check if connection is still alive
                ping_message = {
                    "type": "ping",
                    "timestamp": asyncio.get_event_loop().time()
                }
                await websocket.send_json(ping_message)
                log_websocket_event("ping_sent", client_id)
                
    except WebSocketDisconnect:
        connection_duration = asyncio.get_event_loop().time() - connection_start
        log_websocket_event("client_disconnected_normal", client_id or "unknown", {
            "connection_duration": connection_duration,
            "messages_processed": message_count
        })
        
    except Exception as e:
        connection_duration = asyncio.get_event_loop().time() - connection_start
        log_websocket_event("client_disconnected_error", client_id or "unknown", {
            "error": str(e),
            "connection_duration": connection_duration,
            "messages_processed": message_count
        })
        
        # Send error message if connection is still active
        try:
            error_response = {
                "type": "error",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "error": "Connection error occurred",
                    "errorCode": "CONNECTION_ERROR",
                    "retryable": True
                }
            }
            await websocket.send_json(error_response)
        except:
            pass  # Connection already closed
            
    finally:
        if client_id:
            connection_manager.disconnect(websocket, client_id)


@app.websocket("/ws/{client_id}")
async def websocket_endpoint_with_id(websocket: WebSocket, client_id: str):
    """WebSocket endpoint with explicit client ID for reconnection with comprehensive logging"""
    connection_start = asyncio.get_event_loop().time()
    message_count = 0
    
    try:
        await connection_manager.connect(websocket, client_id)
        log_websocket_event("client_reconnected", client_id, {
            "endpoint": "explicit_id",
            "connection_time": connection_start
        })
        
        # Send queued messages for reconnection
        queued_count = await connection_manager.send_queued_messages(client_id)
        if queued_count > 0:
            log_websocket_event("reconnection_messages_sent", client_id, {
                "message_count": queued_count
            })
        
        # Send reconnection confirmation
        reconnect_confirmation = {
            "type": "reconnect_confirmation",
            "timestamp": asyncio.get_event_loop().time(),
            "data": {
                "clientId": client_id,
                "status": "reconnected",
                "queuedMessages": queued_count
            }
        }
        await websocket.send_json(reconnect_confirmation)
        
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                message_count += 1
                
                log_websocket_event("message_received", client_id, {
                    "message_type": data.get("type", "unknown"),
                    "message_count": message_count,
                    "reconnection": True
                })
                
                response = await message_handler.handle_message(data, client_id)
                
                if response:
                    await websocket.send_json(response)
                    log_websocket_event("response_sent", client_id, {
                        "response_type": response.get("type", "unknown"),
                        "message_count": message_count,
                        "reconnection": True
                    })
                    
            except asyncio.TimeoutError:
                # Send ping to check connection
                ping_message = {
                    "type": "ping", 
                    "timestamp": asyncio.get_event_loop().time()
                }
                await websocket.send_json(ping_message)
                log_websocket_event("ping_sent", client_id, {"reconnection": True})
                
    except WebSocketDisconnect:
        connection_duration = asyncio.get_event_loop().time() - connection_start
        log_websocket_event("client_disconnected_normal", client_id, {
            "connection_duration": connection_duration,
            "messages_processed": message_count,
            "reconnection": True
        })
        
    except Exception as e:
        connection_duration = asyncio.get_event_loop().time() - connection_start
        log_websocket_event("client_disconnected_error", client_id, {
            "error": str(e),
            "connection_duration": connection_duration,
            "messages_processed": message_count,
            "reconnection": True
        })
        
        try:
            error_response = {
                "type": "error",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "error": "Connection error occurred",
                    "errorCode": "CONNECTION_ERROR",
                    "retryable": True
                }
            }
            await websocket.send_json(error_response)
        except:
            pass
            
    finally:
        connection_manager.disconnect(websocket, client_id)


@app.get("/connections")
async def get_connections():
    """Get information about all WebSocket connections"""
    if not connection_manager:
        return {"error": "Connection manager not initialized"}
    
    return connection_manager.get_connection_info()


@app.get("/connections/{client_id}/queue")
async def get_client_queue(client_id: str):
    """Get message queue information for a specific client"""
    if not connection_manager:
        return {"error": "Connection manager not initialized"}
    
    return connection_manager.get_client_queue_info(client_id)


@app.post("/connections/{client_id}/send")
async def send_message_to_client(client_id: str, message: dict):
    """Send a message to a specific client (for testing/admin purposes)"""
    if not connection_manager:
        return {"error": "Connection manager not initialized"}
    
    success = await connection_manager.send_personal_message(message, client_id)
    return {"success": success, "client_id": client_id}


@app.get("/message-stats")
async def get_message_statistics():
    """Get message processing statistics"""
    if not message_handler:
        return {"error": "Message handler not initialized"}
    
    return message_handler.get_message_statistics()


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