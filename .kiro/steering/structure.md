# Project Structure

## Directory Layout
```
nexus-of-mind/
├── client/                     # Babylon.js game client
│   ├── src/
│   │   ├── game/              # Core game logic
│   │   ├── rendering/         # 3D rendering and scenes
│   │   ├── ui/                # User interface components
│   │   ├── networking/        # WebSocket communication
│   │   └── utils/             # Utility functions
│   ├── assets/                # 3D models, textures, sounds
│   ├── public/                # Static web assets
│   └── dist/                  # Built game client
├── server/                     # Python game server
│   ├── game_engine/           # Server-side game logic
│   ├── ai_engine/             # AI strategy and learning
│   ├── api/                   # REST API endpoints
│   ├── websocket/             # Real-time communication
│   └── models/                # Data models and database
├── shared/                     # Shared code between client/server
│   ├── game_constants/        # Game rules and constants
│   ├── protocols/             # Communication protocols
│   └── types/                 # Shared type definitions
├── tests/                      # Test suites
│   ├── client/                # Frontend tests
│   ├── server/                # Backend tests
│   └── integration/           # End-to-end tests
├── docs/                       # Documentation
│   ├── game_design/           # Game design documents
│   ├── ai_architecture/       # AI system documentation
│   └── api/                   # API documentation
├── scripts/                    # Build and deployment scripts
├── .kiro/                      # Kiro CLI configuration
│   ├── steering/              # Project knowledge
│   └── prompts/               # Custom development commands
├── docker-compose.yml          # Development environment
├── package.json               # Node.js dependencies
├── requirements.txt           # Python dependencies
└── README.md                  # Project overview
```

## File Naming Conventions
**JavaScript/TypeScript Files**:
- Components: PascalCase (e.g., `GameRenderer.js`, `AIOpponent.ts`)
- Utilities: camelCase (e.g., `gameUtils.js`, `networkManager.ts`)
- Constants: UPPER_SNAKE_CASE (e.g., `GAME_CONSTANTS.js`)

**Python Files**:
- Modules: snake_case (e.g., `ai_engine.py`, `game_logic.py`)
- Classes: PascalCase within files (e.g., `class AIStrategy`)
- Functions: snake_case (e.g., `def calculate_move()`)

**Asset Files**:
- 3D Models: descriptive names (e.g., `tank_model.babylon`, `base_structure.glb`)
- Textures: purpose-based (e.g., `ground_texture.jpg`, `ui_button.png`)
- Audio: action-based (e.g., `unit_move.wav`, `battle_music.mp3`)

## Module Organization
**Client-Side Modules**:
- **Game Core**: Entity management, game state, physics
- **Rendering**: Scene management, camera control, lighting
- **Input**: User input handling, controls, UI interactions
- **Networking**: Server communication, state synchronization
- **AI Interface**: Client-side AI visualization and feedback

**Server-Side Modules**:
- **Game Engine**: Turn processing, rule enforcement, state management
- **AI Engine**: Neural networks, strategy learning, decision making
- **Communication**: WebSocket handling, message routing
- **Data Layer**: Game persistence, AI training data, analytics
- **API Layer**: REST endpoints, authentication, game management

## Configuration Files
**Development Configuration**:
- `package.json`: Node.js dependencies and scripts
- `requirements.txt`: Python dependencies
- `webpack.config.js`: Build configuration for client
- `tsconfig.json`: TypeScript compiler settings
- `.env`: Environment variables and API keys

**Game Configuration**:
- `game_config.json`: Game rules, balance parameters
- `ai_config.json`: AI learning parameters and model settings
- `server_config.json`: Server settings and performance tuning

**Deployment Configuration**:
- `docker-compose.yml`: Development environment setup
- `Dockerfile`: Production container configuration
- `.github/workflows/`: CI/CD pipeline configuration

## Documentation Structure
**Game Design Documentation**:
- `game_design_document.md`: Core gameplay mechanics
- `ai_behavior_specification.md`: AI learning and adaptation rules
- `user_experience_flow.md`: Player interaction design

**Technical Documentation**:
- `architecture_overview.md`: System design and component interaction
- `api_reference.md`: Server API endpoints and WebSocket protocols
- `ai_implementation_guide.md`: Neural network architecture and training

**Development Documentation**:
- `setup_guide.md`: Development environment setup
- `contribution_guidelines.md`: Code standards and review process
- `deployment_guide.md`: Production deployment instructions

## Asset Organization
**3D Assets**:
- `models/units/`: Game unit 3D models and animations
- `models/buildings/`: Base structures and environmental objects
- `models/terrain/`: Ground textures and landscape elements

**Audio Assets**:
- `audio/sfx/`: Sound effects for game actions
- `audio/music/`: Background music and ambient sounds
- `audio/ui/`: User interface sound feedback

**UI Assets**:
- `ui/icons/`: Game icons and interface elements
- `ui/textures/`: UI background and styling assets
- `ui/fonts/`: Custom fonts for game interface

## Build Artifacts
**Client Build Output**:
- `dist/`: Optimized game client for production
- `dist/assets/`: Compressed and optimized game assets
- `dist/js/`: Bundled and minified JavaScript

**Server Build Output**:
- `build/`: Python bytecode and optimized modules
- `models/`: Trained AI models and weights
- `logs/`: Application and AI training logs

## Environment-Specific Files
**Development Environment**:
- `.env.development`: Development API keys and settings
- `docker-compose.dev.yml`: Development container configuration
- `webpack.dev.js`: Development build configuration

**Production Environment**:
- `.env.production`: Production environment variables
- `docker-compose.prod.yml`: Production deployment configuration
- `webpack.prod.js`: Production optimization settings

**Testing Environment**:
- `.env.test`: Test environment configuration
- `jest.config.js`: JavaScript testing configuration
- `pytest.ini`: Python testing configuration
