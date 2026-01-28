# Project Structure

## Directory Layout
```
nexus-of-mind/
├── client/                     # Babylon.js game client
│   ├── src/
│   │   ├── game/              # Core game logic and entities
│   │   ├── rendering/         # 3D rendering and scenes
│   │   ├── ui/                # User interface components
│   │   ├── networking/        # WebSocket communication
│   │   ├── world/             # World and terrain generation
│   │   ├── utils/             # Utility functions
│   │   ├── main.ts            # Application entry point
│   │   └── config.ts          # Client configuration
│   ├── public/                # Static web assets
│   ├── dist/                  # Built game client
│   ├── Dockerfile             # Client container configuration
│   └── package.json           # Node.js dependencies
├── server/                     # Python AI backend server
│   ├── ai_engine/             # AI strategy and learning
│   │   ├── configs/           # AI configuration files
│   │   ├── decision_gate/     # Decision validation logic
│   │   ├── training/          # Neural network training
│   │   ├── ai_engine.py       # Main AI engine
│   │   ├── nn_model.py        # PyTorch neural network
│   │   ├── nn_config.py       # Neural network configuration
│   │   ├── player_behavior.py # Player behavior tracking
│   │   ├── strategy_generator.py # Strategy generation
│   │   ├── feature_extractor.py  # Game state feature extraction
│   │   └── reward_calculator.py  # Training reward calculation
│   ├── websocket/             # Real-time communication
│   │   └── handlers/          # Message handlers
│   ├── routes/                # REST API endpoints
│   ├── config/                # Server configuration
│   ├── models/                # Trained AI models (.pt files)
│   ├── data/                  # Game data storage
│   ├── database/              # Database utilities
│   ├── logs/                  # Server logs
│   ├── tests/                 # Server tests
│   ├── static/                # Static files
│   ├── Dockerfile             # Server container configuration
│   ├── main.py                # FastAPI application
│   ├── start_server.py        # Server startup script
│   └── README.md              # Server documentation
├── tools/                      # Development and CLI tools
│   └── game_simulator/        # Standalone game simulation tool
│       ├── tests/             # Simulator tests
│       ├── main.py            # CLI entry point
│       ├── simulator.py       # Game simulation logic
│       ├── runner.py          # Simulation runner
│       ├── state.py           # Game state management
│       ├── entities.py        # Entity definitions
│       ├── observation.py     # State observation
│       ├── curriculum.py      # Training curriculum
│       └── README.md          # Simulator documentation
├── docs/                       # Documentation
│   └── plans/                 # Implementation plans
├── scripts/                    # Build and utility scripts
├── examples/                   # Example code and usage
├── .kiro/                      # Kiro CLI configuration
│   ├── steering/              # Project knowledge
│   └── prompts/               # Custom development commands
├── docker-compose.yml          # Docker orchestration
├── install.bat                 # Windows installation script
├── start.bat                   # Windows startup script
├── package.json               # Root Node.js dependencies
├── requirements.txt           # Python dependencies
├── webpack.config.js          # Webpack build configuration
├── tsconfig.json              # TypeScript configuration
└── README.md                  # Project overview
```

## File Naming Conventions
**TypeScript Files**:
- Components: PascalCase (e.g., `GameRenderer.ts`, `CameraController.ts`)
- Utilities: camelCase (e.g., `gameUtils.ts`, `networkManager.ts`)
- Constants: UPPER_SNAKE_CASE within files

**Python Files**:
- Modules: snake_case (e.g., `ai_engine.py`, `nn_model.py`)
- Classes: PascalCase within files (e.g., `class NNModel`)
- Functions: snake_case (e.g., `def calculate_reward()`)

## Module Organization
**Client-Side Modules**:
- **Game Core**: Entity management, game state, unit logic
- **Rendering**: Scene management, camera control, lighting
- **UI**: HUD, menus, help panels, resource displays
- **Networking**: WebSocket communication, state synchronization
- **World**: Terrain generation, chunk management

**Server-Side Modules**:
- **AI Engine**: PyTorch neural networks, strategy learning, decision making
- **Training**: Continuous background training, experience replay
- **WebSocket**: Real-time game communication, message handlers
- **Routes**: REST API endpoints for health checks and diagnostics

## Configuration Files
**Development Configuration**:
- `package.json`: Node.js dependencies and scripts
- `requirements.txt`: Python dependencies (PyTorch, FastAPI, etc.)
- `webpack.config.js`: Build configuration for client
- `tsconfig.json`: TypeScript compiler settings

**AI Configuration**:
- `server/ai_engine/configs/`: AI learning parameters and model settings
- `server/ai_engine/nn_config.py`: Neural network hyperparameters

**Deployment Configuration**:
- `docker-compose.yml`: Container orchestration (client + server)
- `client/Dockerfile`: Client container (Node.js + nginx)
- `server/Dockerfile`: Server container (Python 3.11)

## Build Artifacts
**Client Build Output**:
- `client/dist/`: Optimized game client for production
- `dist/`: Root-level build output

**Server Artifacts**:
- `server/models/`: Trained PyTorch models (.pt files)
- `server/logs/`: Application and training logs
- `server/data/`: Persistent game data

## Docker Deployment
**Services**:
- `ai-backend`: Python FastAPI server (port 8010)
- `game-client`: Babylon.js client via nginx (port 3010)

**Environment Variables**:
- `LOG_LEVEL`: Logging level (info/warning/error)
- `ENVIRONMENT`: Runtime environment (development/production)
- `PORT`: Server port (default: 8010)

## Local Development
**Quick Start (Windows)**:
```bash
install.bat    # Install Python and npm dependencies
start.bat      # Start both servers
```

**Manual Start**:
```bash
# Terminal 1: AI Backend
cd server && python start_server.py

# Terminal 2: Game Client
cd client && npm run dev
```

**Access Points**:
- Game Client: http://localhost:3000
- AI Backend: http://localhost:8010
- Health Check: http://localhost:8010/health
