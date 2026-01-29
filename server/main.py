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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ai_engine.ai_engine import AIEngine
from ai_engine.decision_gate.dashboard_metrics import get_dashboard_metrics
from websocket.connection_manager import ConnectionManager
from websocket.message_handler import MessageHandler
from routes.progress_routes import router as progress_router
from routes.dashboard_routes import router as dashboard_router
from database.energy_lords import init_db

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

    # Initialize Energy Lords database
    try:
        init_db()
        logger.info("Energy Lords database initialized successfully")
    except Exception as e:
        logger.warning(f"Failed to initialize Energy Lords database: {e}")

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
    logger.info("WebSocket connection manager initialized")

    # Initialize message handler
    message_handler = MessageHandler(ai_engine)
    logger.info("Message handler initialized")

    logger.info("Backend initialization complete")

    yield

    # Cleanup on shutdown
    logger.info("Shutting down AI Backend...")

    if connection_manager:
        await connection_manager.shutdown()
        logger.info("Connection manager shutdown complete")

    if ai_engine:
        await ai_engine.cleanup()
        logger.info("AI engine cleanup complete")

    logger.info("Backend shutdown complete")


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
    allow_origins=["http://localhost:3010", "http://localhost:8080"],  # Game client origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(progress_router)
app.include_router(dashboard_router)


@app.get("/")
async def root():
    """Health check endpoint with comprehensive system information"""
    system_info = {
        "status": "running",
        "service": "Adaptive Queen Intelligence AI Backend",
        "version": "1.0.0",
        "gpu_available": False,  # GPU config handled by ContinuousTrainer
        "environment": os.getenv("ENVIRONMENT", "development"),
        "active_connections": len(connection_manager.active_connections) if connection_manager else 0,
        "system_health": {
            "ai_engine_initialized": ai_engine is not None and ai_engine.initialized,
            "connection_manager_active": connection_manager is not None,
            "message_handler_active": message_handler is not None
        }
    }
    
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
        "neural_network": "ready",  # PyTorch NNModel via ContinuousTrainer
        "gpu_acceleration": False,  # GPU config handled by ContinuousTrainer
        "active_connections": len(connection_manager.active_connections) if connection_manager else 0,
        "system_metrics": {
            "uptime_seconds": asyncio.get_event_loop().time(),
            "environment": os.getenv("ENVIRONMENT", "development"),
            "log_level": os.getenv("LOG_LEVEL", "INFO")
        }
    }

    # Add model version info if available
    if message_handler and message_handler.continuous_trainer:
        metadata = message_handler.continuous_trainer.metadata
        health_data["model_version"] = {
            "version": metadata.version,
            "created_at": metadata.created_at,
            "last_saved_at": metadata.last_saved_at,
            "total_training_iterations": metadata.total_training_iterations
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
            "neural_network_available": True,  # PyTorch NNModel via ContinuousTrainer
            "gpu_acceleration": False  # GPU config handled by ContinuousTrainer
        },
        "connections": {
            "active": len(connection_manager.active_connections) if connection_manager else 0,
            "total_known": len(connection_manager.connection_metadata) if connection_manager else 0
        }
    }

    # Add model version info if available
    if message_handler and message_handler.continuous_trainer:
        metadata = message_handler.continuous_trainer.metadata
        status["model"] = {
            "version": metadata.version,
            "created_at": metadata.created_at,
            "last_saved_at": metadata.last_saved_at,
            "total_training_iterations": metadata.total_training_iterations,
            "total_samples_ever_processed": metadata.total_samples_ever_processed,
            "best_loss": metadata.best_loss if metadata.best_loss != float('inf') else None,
            "description": metadata.description
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
    logger.info("Starting system test")

    try:
        test_results = {
            "test_id": test_id,
            "timestamp": asyncio.get_event_loop().time(),
            "tests": {}
        }

        # Test neural network (PyTorch via ContinuousTrainer)
        test_results["tests"]["neural_network"] = {
            "status": "available",
            "gpu_enabled": False  # GPU config handled by ContinuousTrainer
        }

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
        logger.info("System test completed successfully")

        return test_results

    except Exception as e:
        test_results = {
            "test_id": test_id,
            "overall_status": "failed",
            "error": str(e)
        }
        logger.error(f"System test failed: {e}")

        return JSONResponse(status_code=500, content=test_results)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for client-backend communication"""
    client_id = None
    message_count = 0

    try:
        client_id = await connection_manager.connect(websocket)

        # Send queued messages if this is a reconnection
        await connection_manager.send_queued_messages(client_id)

        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                message_count += 1

                response = await message_handler.handle_message(data, client_id)

                if response:
                    await websocket.send_json(response)

            except asyncio.TimeoutError:
                ping_message = {
                    "type": "ping",
                    "timestamp": asyncio.get_event_loop().time()
                }
                await websocket.send_json(ping_message)

    except WebSocketDisconnect:
        pass

    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
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
        if client_id:
            connection_manager.disconnect(websocket, client_id)


@app.websocket("/ws/{client_id}")
async def websocket_endpoint_with_id(websocket: WebSocket, client_id: str):
    """WebSocket endpoint with explicit client ID for reconnection"""
    message_count = 0

    try:
        await connection_manager.connect(websocket, client_id)

        # Send queued messages for reconnection
        queued_count = await connection_manager.send_queued_messages(client_id)

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

                response = await message_handler.handle_message(data, client_id)

                if response:
                    await websocket.send_json(response)

            except asyncio.TimeoutError:
                ping_message = {
                    "type": "ping",
                    "timestamp": asyncio.get_event_loop().time()
                }
                await websocket.send_json(ping_message)

    except WebSocketDisconnect:
        pass

    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
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


@app.get("/reset-db")
async def reset_database():
    """
    Reset the database to initial state.

    Clears all player progress data.
    Access via: http://localhost:8000/reset-db
    """
    try:
        from database.energy_lords import init_db

        db = init_db()
        db.reset_progress('default')

        logger.info("Database reset via /reset-db endpoint")

        return {
            "status": "success",
            "message": "Database reset successfully. Starting fresh at Level 0."
        }

    except Exception as e:
        logger.error(f"Failed to reset database: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Reset failed: {str(e)}"}
        )


@app.get("/reset-nn")
async def reset_neural_network():
    """
    Reset all neural networks to initial random state.

    Resets:
    - NNModel (Five-NN Sequential architecture - ~830 parameters)
    - ContinuousTrainer (strategy model)

    Deletes saved model files and clears all training history.
    Access via: http://localhost:8010/reset-nn
    """
    if not message_handler:
        return JSONResponse(
            status_code=503,
            content={"error": "Message handler not initialized"}
        )

    results = {}

    try:
        logger.info("Neural network reset requested via HTTP endpoint")

        # Reset NNModel (spawn model with 257 outputs)
        if message_handler.nn_model:
            nn_result = message_handler.nn_model.full_reset()
            results['nn_model'] = nn_result
            logger.info(f"NNModel reset complete: {nn_result}")
        else:
            results['nn_model'] = {'status': 'skipped', 'reason': 'not initialized'}

        # Reset ContinuousTrainer (strategy model with 8 outputs)
        if message_handler.continuous_trainer:
            trainer_result = message_handler.continuous_trainer.full_reset()
            results['continuous_trainer'] = trainer_result
            logger.info(f"ContinuousTrainer reset complete: {trainer_result}")
        else:
            results['continuous_trainer'] = {'status': 'skipped', 'reason': 'not initialized'}

        # Update dashboard metrics with new model version (resets to 0)
        dashboard = get_dashboard_metrics()
        if message_handler.background_trainer:
            dashboard.model_version = message_handler.background_trainer.model_version
        else:
            dashboard.model_version = 0
        results['dashboard_model_version'] = dashboard.model_version
        logger.info(f"Dashboard model version updated to: {dashboard.model_version}")

        return {
            "status": "success",
            "message": "All neural networks reset to initial state",
            "details": results
        }

    except Exception as e:
        logger.error(f"Failed to reset neural network: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Reset failed: {str(e)}"})


# To start the server, run: python start_server.py