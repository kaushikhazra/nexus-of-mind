# Adaptive Queen Intelligence - Python AI Backend

This is the Python backend service for the Adaptive Queen Intelligence system, providing neural network-powered AI learning for Nexus of Mind.

## Features

- **Neural Network Learning**: TensorFlow-based Queen behavior learning
- **Real-time Communication**: WebSocket server for client-backend communication
- **GPU Acceleration**: CUDA support with graceful CPU fallback
- **Memory Management**: Rolling window memory management for learning data
- **Strategy Generation**: AI-driven strategy adaptation based on player patterns

## Requirements

- Python 3.9 or higher
- TensorFlow 2.15.0
- FastAPI and Uvicorn for web server
- Optional: CUDA-compatible GPU for acceleration

## Installation

1. **Create Python virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Set up environment (optional):**
```bash
cp .env.example .env
# Edit .env with your configuration
```

## Usage

### Development Server

Start the development server with auto-reload:

```bash
python start_server.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Server

For production deployment:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

### HTTP Endpoints

- `GET /` - Health check and service information
- `GET /health` - Detailed health check with AI engine status

### WebSocket Endpoints

- `WS /ws` - Main WebSocket endpoint for client communication
- `WS /ws/{client_id}` - WebSocket with explicit client ID for reconnection

## WebSocket Message Protocol

### Client to Server Messages

**Queen Death Message:**
```json
{
  "type": "queen_death",
  "timestamp": 1234567890.123,
  "data": {
    "queenId": "queen_123",
    "territoryId": "territory_456",
    "generation": 3,
    "deathLocation": {"x": 100, "y": 0, "z": 200},
    "deathCause": "protector_assault",
    "survivalTime": 180.5,
    "parasitesSpawned": 12,
    "hiveDiscoveryTime": 45.2,
    "playerUnits": {...},
    "assaultPattern": {...},
    "gameState": {...}
  }
}
```

**Learning Progress Request:**
```json
{
  "type": "learning_progress_request",
  "data": {
    "queenId": "queen_123"
  }
}
```

### Server to Client Messages

**Queen Strategy Response:**
```json
{
  "type": "queen_strategy",
  "timestamp": 1234567890.123,
  "data": {
    "queenId": "queen_123",
    "generation": 4,
    "strategies": {
      "hivePlacement": {...},
      "parasiteSpawning": {...},
      "defensiveCoordination": {...},
      "predictiveBehavior": {...}
    },
    "learningInsights": {...},
    "estimatedTrainingTime": 85.2
  }
}
```

## Architecture

### Core Components

- **AIEngine**: Central coordinator for neural network learning
- **QueenBehaviorNetwork**: TensorFlow neural network implementation
- **DeathAnalyzer**: Analyzes Queen death circumstances
- **PlayerBehaviorAnalyzer**: Learns player patterns and preferences
- **StrategyGenerator**: Generates adaptive Queen strategies
- **MemoryManager**: Manages learning data across generations

### Data Flow

1. Client sends Queen death data via WebSocket
2. AI Engine processes death data and analyzes patterns
3. Neural network trains on failure data
4. Strategy Generator creates new adaptive strategy
5. Response sent back to client with new strategy

## Configuration

### Environment Variables

- `HOST`: Server host address (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `LOG_LEVEL`: Logging level (default: info)
- `GPU_MEMORY_LIMIT`: GPU memory limit in MB (default: 2048)
- `MAX_GENERATIONS`: Rolling window size (default: 10)

### GPU Configuration

The system automatically detects and configures GPU acceleration:

- **CUDA Available**: Uses GPU with memory growth enabled
- **No CUDA**: Falls back to CPU with warning message
- **Memory Limit**: Configurable via `GPU_MEMORY_LIMIT` environment variable

## Development

### Project Structure

```
server/
├── main.py                 # FastAPI application entry point
├── start_server.py         # Startup script with checks
├── requirements.txt        # Python dependencies
├── ai_engine/             # AI Engine components
│   ├── ai_engine.py       # Central AI coordinator
│   ├── neural_network.py  # TensorFlow neural network
│   ├── death_analyzer.py  # Death analysis system
│   ├── player_behavior.py # Player behavior learning
│   ├── strategy_generator.py # Strategy generation
│   ├── memory_manager.py  # Memory management
│   └── data_models.py     # Data structures
├── websocket/             # WebSocket communication
│   ├── connection_manager.py # Connection management
│   └── message_handler.py    # Message processing
├── data/                  # Persistent data storage
│   └── queen_memory/      # Queen learning data
├── models/                # Trained neural network models
└── logs/                  # Application logs
```

### Testing

Run tests using pytest:

```bash
pytest
```

For async tests:

```bash
pytest -v --asyncio-mode=auto
```

### Code Quality

Format code with Black:

```bash
black .
```

Check code quality with Flake8:

```bash
flake8 .
```

## Performance

### Neural Network Training

- **Training Time**: 60-120 seconds per generation
- **Memory Usage**: ~200MB additional for neural network models
- **GPU Acceleration**: 3-5x faster training with CUDA
- **Model Size**: <50MB per Queen model

### WebSocket Performance

- **Connection Limit**: 100 concurrent connections (configurable)
- **Message Latency**: <50ms for typical messages
- **Throughput**: 1KB/sec average per connection
- **Timeout**: 300 seconds for inactive connections

## Troubleshooting

### Common Issues

1. **TensorFlow Import Error**: Install TensorFlow with `pip install tensorflow`
2. **GPU Not Detected**: Check CUDA installation and compatibility
3. **Memory Issues**: Reduce `GPU_MEMORY_LIMIT` or use CPU fallback
4. **WebSocket Connection Failed**: Check firewall and port availability

### Logging

The server provides detailed logging for debugging:

- **INFO**: General operation information
- **WARNING**: Non-critical issues (e.g., GPU fallback)
- **ERROR**: Critical errors requiring attention
- **DEBUG**: Detailed debugging information (set LOG_LEVEL=debug)

### Health Checks

Monitor server health using the health endpoint:

```bash
curl http://localhost:8000/health
```

Response includes:
- AI Engine status
- Neural network readiness
- GPU acceleration status
- Active WebSocket connections

## Integration

### Client Integration

The TypeScript game client connects via WebSocket:

```typescript
const websocket = new WebSocket('ws://localhost:8000/ws');

// Send Queen death data
websocket.send(JSON.stringify({
  type: 'queen_death',
  data: queenDeathData
}));

// Receive strategy response
websocket.onmessage = (event) => {
  const response = JSON.parse(event.data);
  if (response.type === 'queen_strategy') {
    applyNewStrategy(response.data);
  }
};
```

### Production Deployment

For production deployment, consider:

- **Load Balancing**: Multiple server instances behind load balancer
- **Database**: Replace in-memory storage with persistent database
- **Monitoring**: Add application performance monitoring
- **Security**: Implement authentication and rate limiting
- **Scaling**: Use container orchestration (Docker/Kubernetes)

## License

This project is part of the Nexus of Mind game development.