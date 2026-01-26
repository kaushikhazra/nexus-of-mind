# Nexus of Mind

🧠⚔️ **An AI-Powered Real Time Strategy Game** - Where players face off against a self-learning AI opponent that adapts and evolves its strategies based on player behavior, creating dynamic and increasingly challenging gameplay experiences.

> **🎮 Live Demo**: [Development Server](http://localhost:3000) (when running locally)  
> **🏆 Hackathon Entry**: Dynamous Kiro Hackathon 2026 - Showcasing AI innovation in gaming

## 🌟 What Makes This Special

**Nexus of Mind** isn't just another RTS game - it's a showcase of cutting-edge AI technology in gaming:

- **🤖 Self-Learning AI**: The AI opponent learns from your strategies and adapts in real-time
- **🎨 Low Poly Aesthetic**: Beautiful SciFi world with optimized flat-shading graphics
- **⚡ Energy-Based Economy**: Everything runs on energy - mining, building, combat, even shields
- **🌍 Infinite Procedural World**: Explore an endless SciFi landscape with varied terrain
- **🎯 Strategic Depth**: Balance resource management, unit upgrades, and tactical combat
- **🚀 Web-Based**: Runs in any modern browser with 60fps performance

## 🎯 Game Concept

### Core Gameplay
Players control **Workers** (green spheres), **Scouts** (blue spheres), and **Protectors** (red spheres) in a battle for energy dominance. Build **Bases** (yellow pyramids) and **Power Plants** (orange semi-cylinders) while the AI learns your strategies and counter-adapts.

### The AI Challenge
The AI doesn't just follow scripted behaviors - it:
- **Learns your patterns**: Aggressive? Defensive? Economic focus?
- **Adapts strategies**: Changes unit composition and tactics based on your play style
- **Evolves over time**: Gets smarter with each match you play
- **Provides fair challenge**: Scales difficulty naturally based on your skill level

### Energy Economy
Everything costs energy:
- **Mining**: Extract energy from radioactive minerals (light blue crystals)
- **Building**: Construct bases and power plants
- **Combat**: Fire weapons and activate shields
- **Upgrades**: Improve unit performance and capabilities

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** for development and build tools
- **Modern Web Browser** with WebGL 2.0 support
- **Git** for version control

### Installation & Setup

```bash
# Clone the repository
git clone https://github.com/kaushikhazra/nexus-of-mind.git
cd nexus-of-mind

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
# Navigate to http://localhost:3000
```

### Production Build
```bash
# Build for production
npm run build

# Serve production build
npm run serve
```

## 🎮 How to Play

### Controls
- **Mouse**: Rotate camera around the scene
- **Mouse Wheel**: Zoom in and out
- **WASD**: Pan camera (planned feature)
- **Right Click**: Additional camera controls

### Current Features (v0.1.0)
- ✅ **3D World**: Low poly SciFi environment with atmospheric lighting
- ✅ **Camera System**: Smooth RTS-style camera controls
- ✅ **Visual Foundation**: Test objects showing unit and building concepts
- ✅ **Performance**: Optimized for 60fps web gameplay

### Planned Features (Coming Soon)
- 🔄 **Procedural Terrain**: Infinite world with varied biomes
- 🔄 **Energy Economy**: Complete resource management system
- 🔄 **Unit Types**: Workers, Scouts, and Protectors with unique abilities
- 🔄 **AI Opponent**: Self-learning AI with strategic adaptation
- 🔄 **Combat System**: Energy-based weapons and shield mechanics

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

### Backend (Planned)
- **Python**: AI/ML processing and game server
- **TensorFlow/PyTorch**: Neural network implementation
- **FastAPI**: Game server API
- **WebSocket**: Real-time game communication

### Key Components
- **GameEngine**: Core game loop and system coordination
- **SceneManager**: 3D scene setup and optimization
- **CameraController**: RTS-style camera with smooth controls
- **MaterialManager**: Low poly material system with color coding
- **PerformanceMonitor**: FPS tracking and optimization alerts

## 🎨 Visual Design

### Low Poly Aesthetic
- **Flat Shading**: Authentic low poly look with geometric surfaces
- **Color Coding**: Instant unit recognition (green=workers, blue=scouts, red=protectors)
- **SciFi Atmosphere**: Dark space background with atmospheric lighting
- **Performance Focus**: Optimized geometry for smooth 60fps gameplay

### Art Style Goals
- Clean geometric shapes for clarity
- Vibrant colors for gameplay readability
- Atmospheric lighting for immersion
- Scalable design for infinite worlds

## 🤖 AI Architecture (Planned)

### Multi-Layer Learning System
1. **Player Behavior Classification**: Identify play styles (aggressive, defensive, economic)
2. **Strategic DQN**: High-level decision making and resource allocation
3. **Tactical Actor-Critic**: Unit-level control and micro-management
4. **Pattern Recognition LSTM**: Learn and predict player strategies

### Real-Time Adaptation
- **Strategy Switching**: AI changes approach based on player actions
- **Difficulty Scaling**: Maintains challenging but fair gameplay
- **Learning Persistence**: AI remembers lessons across game sessions

## 📊 Development Progress

### ✅ Completed (Week 1)
- **Project Setup**: Comprehensive planning and architecture
- **3D Foundation**: Complete Babylon.js implementation
- **Build System**: Development and production workflows
- **Git Flow**: Feature branch workflow established
- **Documentation**: Comprehensive project documentation

### 🔄 In Progress (Week 2)
- **Procedural Terrain**: Infinite world generation
- **Energy Economy**: Resource management system
- **Game Units**: Sphere-based unit implementation

### 📋 Planned (Week 3)
- **AI Opponent**: Self-learning AI implementation
- **Combat System**: Energy-based combat mechanics
- **Polish & Deploy**: Final optimization and deployment

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

**🎮 Ready to challenge the AI?** Clone the repo, run `npm run dev`, and experience the future of strategy gaming!

**🏆 Hackathon Entry**: This project showcases the potential of AI in gaming, combining cutting-edge machine learning with engaging gameplay in a web-accessible format.