# Nexus of Mind - AI Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (includes server/models with pretrained weights)
COPY server/ .

# Create required directories (models/ already copied from server/models/)
RUN mkdir -p /app/data/queen_memory /app/logs

# Python environment (deployment config in docker-compose.yml)
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8010

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8010/health || exit 1

# Run via start_server.py for consistent logging setup
CMD ["python", "start_server.py"]
