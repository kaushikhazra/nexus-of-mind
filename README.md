# Nexus of Mind

🧠🦠 **Player vs Evolving Parasite Ecosystem** - Defend against adaptive parasite swarms powered by neural network learning. Experience a genuinely novel gaming sub-genre where the AI-controlled ecosystem evolves and adapts to your strategies, creating endless tactical challenges that never become stale.

> **🎮 Live Demo**: [Development Server](http://localhost:3010) (when running locally)  
> **🏆 Hackathon Entry**: Dynamous Kiro Hackathon 2026 - Showcasing parasite ecosystem innovation

## 🌟 What Makes This Special

**Nexus of Mind** isn't just another RTS game - it's a showcase of cutting-edge parasite ecosystem innovation:

- **🦠 Neural Network Parasite Spawning**: AI-controlled parasites that learn from your strategies and adapt their behavior
- **⚔️ Dual Parasite Types**: Face 75% Energy Parasites that drain resources and 25% Combat Parasites that attack directly
- **🎨 Low Poly Aesthetic**: Beautiful SciFi world with optimized flat-shading graphics
- **⚡ Parasite-Focused Energy Economy**: Manage energy while defending against parasites that evolve their tactics
- **🌍 Infinite Procedural World**: Explore an endless SciFi landscape with varied terrain and parasite territories
- **🎯 Strategic Depth**: Balance resource management, territorial control, and evolving parasite combat
- **🚀 Web-Based**: Runs in any modern browser with 60fps performance

## 🎯 Game Concept

### Core Gameplay
Players control **Workers** (green spheres) and **Protectors** (red spheres) in a survival battle against an evolving parasite ecosystem. Mine radioactive minerals, build **Bases** (yellow pyramids) and **Power Plants** (orange semi-cylinders) while defending against adaptive parasite swarms controlled by a learning neural network.

The challenge isn't a traditional AI opponent - it's an entire ecosystem that learns from your strategies and evolves its behavior patterns through neural network learning.

### The Neural Network Challenge
The parasite ecosystem doesn't follow scripted behaviors - it genuinely learns:
- **Analyzes your gameplay data**: Mining patterns, defensive strategies, movement behaviors
- **Adapts spawning patterns**: Queens adjust parasite types and timing based on your tactics
- **Evolves generationally**: Each Queen death feeds learning data to improve future spawning strategies
- **Creates endless variety**: No two encounters feel the same as the ecosystem continuously adapts

### Parasite Ecosystem Mechanics
Experience a living, breathing ecosystem that challenges you in multiple ways:

**Dual Parasite Types**:
- **Energy Parasites (75%)**: Drain your energy reserves and disrupt mining operations
- **Combat Parasites (25%)**: Directly attack your units with aggressive territorial behavior
- **Dynamic Distribution**: The 75/25 split creates tactical depth - manage energy while defending against direct threats

**The Queen (Neural Network Brain)**:
- **Visual Representation**: The Queen represents the neural network "brain" controlling all parasite behavior
- **Adaptive Spawning**: The NN learns from your strategies and evolves parasite deployment patterns
- **Non-Interactive**: You don't fight the Queen directly - she orchestrates the parasite swarms from behind the scenes

**Energy Lords Progression**:
- **60-Level System**: Advance through increasingly challenging encounters as the ecosystem evolves
- **Adaptive Difficulty**: Each level brings smarter Queens with more sophisticated spawning strategies
- **Continuous Learning**: The neural network ensures no level feels repetitive or predictable

### Energy Economy
Everything costs energy:
- **Mining**: Extract energy from radioactive minerals (light blue crystals)
- **Building**: Construct bases and power plants
- **Combat**: Protector attacks consume energy
- **Unit Creation**: Spawn workers and protectors from bases

## 🚀 Quick Start

### Prerequisites
- **Python 3.12+** for AI backend and neural network parasite spawning
- **Node.js 18+** for game client and 3D rendering
- **Modern Web Browser** with WebGL 2.0 support for parasite ecosystem visualization
- **Git** for version control and development workflow

### Installation & Setup (Windows)

```bash
# Clone the repository
git clone https://github.com/kaushikhazra/nexus-of-mind.git
cd nexus-of-mind

# Option 1: Use batch files (recommended)
install.bat    # Install all dependencies
start.bat      # Start both servers

# Option 2: Manual setup
# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies
cd client && npm install && cd ..

# Start AI backend (terminal 1)
cd server && python start_server.py

# Start game client (terminal 2)
cd client && npm run dev

# Open in browser: http://localhost:3010
```

### Docker Deployment
```bash
# Build and run with Docker
docker-compose up -d

# Access the game at http://localhost:3010
# AI Backend API at http://localhost:8010
```

## 🎮 How to Play

### Controls
- **Left Click**: Select and move Protectors to defend against parasites
- **Mouse**: Rotate camera around the parasite ecosystem
- **Mouse Wheel**: Zoom in and out to observe territorial battles
- **Right Click**: Additional camera controls for strategic overview

### Parasite Combat Mechanics
- **Protector Movement**: Click to move red Protectors - they automatically engage parasites in range
- **Auto-Attack System**: Protectors automatically target and attack nearby parasites when in combat range
- **Energy Management**: Monitor energy levels as parasites drain resources during encounters
- **Territorial Defense**: Defend against evolving parasite swarms that adapt to your strategies

### Current Parasite Ecosystem Features
- ✅ **Dual Parasite Types**: Face 75% Energy Parasites and 25% Combat Parasites with different behaviors
- ✅ **Queen AI**: Neural network "brain" that controls and adapts parasite spawning patterns
- ✅ **Neural Network Learning**: Experience parasites that learn from your defensive strategies
- ✅ **Movement-Based Combat**: Intuitive protector control with automatic engagement system
- ✅ **Energy Economy**: Mine resources while defending against energy-draining parasite attacks
- ✅ **60-Level Progression**: Advance through Energy Lords system with increasingly intelligent Queens

### Developer Notes
> **Reset Introduction Screen**: If you clicked "Don't show again" and want to see the introduction again, open browser console (F12) and run:
> ```javascript
> localStorage.removeItem('skipIntroduction');
> ```
> Then refresh the page.

## 🏗️ Technical Architecture

### Frontend (Game Client)
- **Babylon.js**: High-performance 3D web engine
- **TypeScript**: Type-safe game logic and UI
- **Webpack**: Optimized asset bundling
- **WebGL**: Hardware-accelerated 3D rendering

### Backend (AI Server)
- **Python 3.12+ with PyTorch**: Neural network system for adaptive parasite spawning
- **PyTorch**: Sequential neural network learning from gameplay data to optimize parasite behavior
- **FastAPI**: High-performance REST API for game state management
- **WebSocket**: Real-time parasite behavior updates and Queen adaptation communication
- **Continuous Learning**: Background training from Queen death data and player strategy analysis

### Key Components
- **GameEngine**: Core game loop and parasite ecosystem coordination
- **SceneManager**: 3D scene setup and Queen territory visualization
- **CameraController**: RTS-style camera with smooth controls
- **MaterialManager**: Low poly material system with parasite and Queen visual representation
- **ParasiteManager**: Dual parasite type spawning and territorial behavior coordination
- **QueenSystem**: Visual Queen representation and neural network integration for parasite spawning
- **PerformanceMonitor**: FPS tracking and optimization alerts

## 🎨 Visual Design

### Low Poly Aesthetic
- **Flat Shading**: Authentic low poly look with geometric surfaces
- **Color Coding**: Instant unit recognition (green=workers, red=protectors)
- **SciFi Atmosphere**: Dark space background with atmospheric lighting
- **Performance Focus**: Optimized geometry for smooth 60fps gameplay

### Art Style Goals
- Clean geometric shapes for clarity
- Vibrant colors for gameplay readability
- Atmospheric lighting for immersion
- Scalable design for infinite worlds

## 🤖 AI Architecture

### Neural Network System
- **PyTorch Sequential Model**: Lightweight neural network for spawn decisions
- **Feature Extraction**: 29-dimensional game state encoding
- **Simulation Gate**: Cost-benefit analysis for decision validation
- **Background Training**: Continuous learning from gameplay experience

### Adaptive Difficulty
- **Player Behavior Analysis**: Tracks aggression, economy focus, and tactics
- **Dynamic Difficulty Adjustment**: Scales challenge based on player skill
- **Learning Persistence**: Model weights saved and restored across sessions

### Real-Time Adaptation
- **Strategy Switching**: AI changes approach based on player actions
- **Experience Replay**: Learns from recent gameplay decisions
- **Reward-Based Training**: Optimizes for survival and resource efficiency

## 📊 Development Progress

### ✅ Completed Specifications
- **Enhanced Parasite System**: Dual parasite types (75% Energy, 25% Combat) with tactical depth and territorial behavior
- **Queen AI System**: Neural network "brain" representing the Queen, controlling adaptive parasite spawning patterns
- **Neural Network Learning**: Generational AI learning with Python backend integration and adaptive spawning patterns
- **Protector Combat System**: Movement-based auto-attack system optimized for parasite ecosystem encounters
- **3D Foundation System**: Complete Babylon.js implementation with low poly aesthetic and 60fps performance
- **Energy Economy System**: Universal energy currency powering mining, building, combat, and movement
- **Procedural Terrain System**: Infinite world generation with varied biomes and mineral deposits

### 🎯 Strategic Evolution: Traditional RTS → Parasite Ecosystem
This project demonstrates superior development methodology through strategic pivoting. Rather than rigidly following an initial plan for traditional RTS AI, we recognized that the parasite system generated the most player engagement and doubled down on that innovation.

**The Evolution Process**:
- **Week 1**: Established solid foundation with traditional RTS mechanics
- **Week 2**: Discovered parasite system created more engaging gameplay than planned AI opponent
- **Week 3**: Pivoted to evolving parasite ecosystem with neural network learning
- **Result**: Created genuinely novel gaming sub-genre instead of incremental AI improvement

### 🏗️ Specification-Based Development Methodology
Transitioned from traditional user stories to comprehensive specifications for complex, interconnected features:

**Traditional User Stories** (Week 1): Effective for foundational systems
- Linear completion of discrete features
- Clear acceptance criteria and testing
- Rapid establishment of core mechanics

**Specification-Driven Development** (Week 2-3): Superior for innovation
- Comprehensive design documents with property-based testing
- Iterative refinement of complex systems
- Focus on correctness properties and formal verification
- Adaptive planning based on what actually creates value

### 🚀 Innovation Achievement: Novel Gaming Sub-Genre
**Created "Player vs Evolving Parasite Ecosystem"** - a genuinely new gaming genre:
- **Not Traditional RTS**: No base-vs-base warfare or resource competition
- **Not Tower Defense**: Active unit control with strategic territorial decisions
- **Not Survival Game**: Focused on ecosystem adaptation rather than resource scarcity
- **Unique Innovation**: Neural network learning creates continuously evolving challenge

This represents the kind of breakthrough thinking that creates new market categories rather than incremental improvements to existing genres.

## 🛠️ Development Workflow

This project uses **Kiro CLI** for AI-powered development assistance:

### Core Development Commands
```bash
# Load project context
@prime

# Plan new features
@plan-feature

# Execute implementation plans
@execute

# Review code quality
@code-review
```

### Git Flow
- **main**: Production releases
- **develop**: Integration branch
- **feature/***: Individual user stories
- **hotfix/***: Critical fixes

## 📈 Performance Metrics

### Current Performance
- **Bundle Size**: 5.13 MiB (optimized for Babylon.js)
- **Load Time**: ~2 seconds on modern browsers
- **Frame Rate**: 60fps target achieved
- **Memory Usage**: Stable with test objects

### Optimization Strategies
- Low poly geometry for reduced GPU load
- Efficient material system with minimal textures
- Frustum culling and scene optimization
- Performance monitoring with real-time alerts

## 🎯 Hackathon Submission

### Innovation Highlights
- **AI-Powered Gaming**: Self-learning opponent that evolves with player behavior
- **Web-Based RTS**: High-performance 3D strategy game in the browser
- **Energy Economy**: Unique resource system where energy powers everything
- **Low Poly Aesthetic**: Beautiful and performant visual design

### Technical Excellence
- **Modern Stack**: Babylon.js + TypeScript + Python AI backend
- **Clean Architecture**: Modular, maintainable, and extensible codebase
- **Performance Focus**: 60fps target with optimization monitoring
- **Development Workflow**: AI-assisted development with Kiro CLI

### Real-World Value
- **Educational**: Demonstrates AI learning in interactive environments
- **Entertainment**: Engaging gameplay with adaptive difficulty
- **Technical Showcase**: Advanced web-based 3D gaming capabilities
- **Open Source**: Extensible platform for AI gaming experiments

## 🛠️ Troubleshooting

### Common Setup Issues

#### Python/Node.js Version Problems
**Problem**: Installation fails with version errors
**Solution**: 
```bash
# Check versions
python --version  # Should be 3.12+
node --version    # Should be 18+

# Update if needed (Windows)
# Download from python.org and nodejs.org
```

#### Port Already in Use
**Problem**: `Error: listen EADDRINUSE :::3000` or `:::8010`
**Solution**:
```bash
# Find and kill processes using ports
netstat -ano | findstr :3000
netstat -ano | findstr :8010
taskkill /PID <process_id> /F

# Or use different ports in config files
```

#### WebGL Not Supported
**Problem**: "WebGL not supported" error in browser
**Solution**:
- Update graphics drivers
- Enable hardware acceleration in browser settings
- Try different browser (Chrome, Firefox, Edge)
- Check `chrome://gpu/` for WebGL status

### Parasite Ecosystem Game Issues

#### Parasites Not Spawning
**Problem**: No parasites appear in the game world
**Solution**:
- Verify AI backend is running (`http://localhost:8010/health`)
- Check browser console for WebSocket connection errors
- Restart both client and server
- Ensure neural network model files are present in `server/models/`

#### Protectors Not Attacking
**Problem**: Protectors don't engage parasites automatically
**Solution**:
- Move protectors closer to parasites (auto-attack has limited range)
- Check energy levels - low energy disables combat
- Verify combat system is initialized (check browser console)
- Try clicking directly on parasites to force engagement

#### Performance Issues / Low FPS
**Problem**: Game runs slowly or stutters
**Solution**:
```bash
# Check performance in browser console
# Look for FPS counter and performance warnings

# Reduce graphics quality:
# - Lower browser zoom level
# - Close other browser tabs
# - Disable browser extensions
# - Update graphics drivers
```

#### Neural Network Not Learning
**Problem**: Queens don't seem to adapt strategies
**Solution**:
- Play multiple rounds to generate training data
- Check `server/logs/` for training activity
- Verify PyTorch installation: `pip show torch`
- Restart AI backend to reload model weights

### Development Issues

#### Build Failures
**Problem**: `npm run dev` or build commands fail
**Solution**:
```bash
# Clear caches and reinstall
cd client
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run type-check
```

#### Docker Issues
**Problem**: Docker containers won't start
**Solution**:
```bash
# Check Docker is running
docker --version

# View container logs
docker-compose logs

# Rebuild containers
docker-compose down
docker-compose up --build -d
```

#### WebSocket Connection Failures
**Problem**: Client can't connect to AI backend
**Solution**:
- Verify backend is running: `curl http://localhost:8010/health`
- Check firewall settings
- Try different port in configuration
- Disable antivirus temporarily for testing

### Getting Help

#### Debug Information to Collect
When reporting issues, please include:
- Operating system and version
- Browser type and version
- Python and Node.js versions
- Error messages from browser console (F12)
- Server logs from `server/logs/`
- Steps to reproduce the problem

#### Support Channels
- **GitHub Issues**: [Report bugs and feature requests](https://github.com/kaushikhazra/nexus-of-mind/issues)
- **Development Logs**: Check `DEVLOG.md` for recent changes
- **Code Review**: Use `@code-review` prompt for development questions

#### Performance Monitoring
```bash
# Enable detailed logging
# Set LOG_LEVEL=debug in environment

# Monitor resource usage
# Check Task Manager (Windows) or Activity Monitor (Mac)
# Look for high CPU/memory usage

# Browser performance tools
# F12 → Performance tab → Record gameplay session
```

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit with descriptive messages
5. Push to your fork and create a Pull Request

### Code Standards
- **TypeScript**: Strict mode with comprehensive type safety
- **Testing**: Unit tests for core game logic
- **Documentation**: Clear comments and README updates
- **Performance**: Maintain 60fps target

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Babylon.js Team**: For the incredible 3D web engine
- **Dynamous & Kiro**: For the hackathon opportunity and AI development tools
- **Open Source Community**: For the libraries and tools that make this possible

---

**🎮 Ready to challenge the AI?** Clone the repo, run `install.bat` then `start.bat`, and experience the future of strategy gaming!

**🏆 Hackathon Entry**: This project showcases the potential of AI in gaming, combining cutting-edge machine learning with engaging gameplay in a web-accessible format.