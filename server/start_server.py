#!/usr/bin/env python3
"""
Startup script for Adaptive Queen Intelligence AI Backend
"""

import os
import sys
import logging
import subprocess
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 9):
        logger.error("Python 3.9 or higher is required")
        sys.exit(1)
    logger.info(f"Python version: {sys.version}")


def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import fastapi
        import uvicorn
        import tensorflow as tf
        import numpy as np
        
        logger.info("All required dependencies are installed")
        logger.info(f"TensorFlow version: {tf.__version__}")
        
        # Check GPU availability
        gpus = tf.config.experimental.list_physical_devices('GPU')
        if gpus:
            logger.info(f"GPU acceleration available: {len(gpus)} GPU(s)")
        else:
            logger.info("No GPU available, using CPU")
            
    except ImportError as e:
        logger.error(f"Missing dependency: {e}")
        logger.info("Please install dependencies: pip install -r requirements.txt")
        sys.exit(1)


def setup_environment():
    """Set up environment variables and directories"""
    # Create necessary directories
    directories = [
        "data/queen_memory",
        "models",
        "logs"
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        logger.info(f"Created directory: {directory}")
    
    # Set default environment variables if not set
    env_defaults = {
        "HOST": "0.0.0.0",
        "PORT": "8010",
        "LOG_LEVEL": "debug",
        "GPU_MEMORY_LIMIT": "2048"  # MB
    }
    
    for key, value in env_defaults.items():
        if key not in os.environ:
            os.environ[key] = value
            logger.info(f"Set environment variable {key}={value}")


def main():
    """Main startup function"""
    logger.info("Starting Adaptive Queen Intelligence AI Backend...")
    
    # Perform startup checks
    check_python_version()
    check_dependencies()
    setup_environment()
    
    # Get configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8010))
    log_level = os.getenv("LOG_LEVEL", "info")
    
    logger.info(f"Starting server on {host}:{port}")
    logger.info(f"Log level: {log_level}")
    
    # Start the server
    try:
        import uvicorn
        uvicorn.run(
            "main:app",
            host=host,
            port=port,
            log_level=log_level,
            reload=True,  # Enable auto-reload for development
            access_log=True
        )
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server startup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()