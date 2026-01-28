#!/usr/bin/env python3
"""
Startup script for Adaptive Queen Intelligence AI Backend
"""

import logging
import os
import sys
from pathlib import Path

# Configure root logger to INFO level so application logs show
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)


def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 9):
        sys.exit(1)


def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import fastapi
        import uvicorn
        import torch
        import numpy as np
    except ImportError:
        sys.exit(1)


def setup_environment():
    """Set up environment variables and directories"""
    directories = [
        "data/queen_memory",
        "models",
        "logs"
    ]

    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)

    env_defaults = {
        "HOST": "0.0.0.0",
        "PORT": "8010",
        "LOG_LEVEL": "info",
        "GPU_MEMORY_LIMIT": "2048"
    }

    for key, value in env_defaults.items():
        if key not in os.environ:
            os.environ[key] = value


def main():
    """Main startup function"""
    check_python_version()
    check_dependencies()
    setup_environment()

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8010))
    log_level = os.getenv("LOG_LEVEL", "info")

    try:
        import uvicorn
        uvicorn.run(
            "main:app",
            host=host,
            port=port,
            log_level=log_level,
            reload=True,
            access_log=False
        )
    except KeyboardInterrupt:
        pass
    except Exception:
        sys.exit(1)


if __name__ == "__main__":
    main()
