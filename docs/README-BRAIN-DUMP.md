# NEXUS OF MIND - README Brain Dump Document

> **Purpose**: This document captures the comprehensive research of all `.kiro/specs` in chronological order (Jan 9-28, 2026). It serves as the source material for creating user stories and the final README.

---

## 1. PREREQUISITES

### Tech Stack
- **Frontend**: Babylon.js 6.x (3D WebGL), TypeScript 5.x, Webpack 5.x
- **Backend**: Python 3.12+, PyTorch (neural network), WebSocket
- **GPU**: Optional - NVIDIA CUDA 12.x for accelerated training (CPU works fine for normal gameplay; GPU helps for turbo-mode simulator training)
- **Browser**: WebGL 2.0 compatible (Chrome, Firefox, Edge, Safari)

### Core Dependencies
- Babylon.js: 3D engine, scene management, WebGL abstraction
- PyTorch: Neural network training and inference (GPU-accelerated)
- Node.js: Build toolchain and development server

### Environment Requirements
- 60fps target performance
- Memory footprint: ~100-200MB (client + server)
- WebSocket connectivity for AI backend (ws://localhost:8000)
- GPU optional (model is only ~830 parameters - CPU handles real-time gameplay fine; GPU accelerates turbo-mode simulator training)

### Installation Steps (to document)
- Node.js install
- Python environment setup
- PyTorch with CUDA
- npm install
- Python requirements.txt
- Running dev server + AI backend

---

## 2. QUICK START

### The Game in One Paragraph
Mine minerals, convert to energy, defend against adaptive parasite swarms controlled by an evolving Queen AI. The Queen is the brain behind parasite behavior - learning your strategies and adapting over time. Survive escalating difficulty as the AI grows smarter each generation.

### Installation

**Windows (Recommended)**:
1. Install Python 3.12+ (https://python.org)
2. Install Node.js 18+ (https://nodejs.org)
3. Run `install.bat` (installs Python and npm dependencies)
4. Run `start.bat` (launches AI backend + game client)
5. Open http://localhost:3010

**Docker**:
```bash
docker-compose up --build
```
Open http://localhost:3010

| | URL |
|--|-----|
| Game Client | http://localhost:3010 |
| AI Backend | http://localhost:8010 |

### AI Backend API Endpoints

**Core Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check with system info |
| GET | `/health` | Detailed health check with AI engine status |
| GET | `/system/status` | System status and metrics |
| POST | `/system/test` | Test endpoint |
| WebSocket | `/ws` | Real-time AI communication (game ↔ NN) |

**Reset Endpoints** (for development/testing):
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reset-db` | Reset player progress database to initial state |
| GET | `/reset-nn` | Reset neural networks to random state (deletes saved models) |

**Player Progress** (`/api/progress`):
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/progress` | Load player progress |
| POST | `/api/progress` | Save player progress |
| DELETE | `/api/progress` | Reset player progress |
| GET | `/api/progress/leaderboard` | Get all players ranked by level |
| GET | `/api/progress/reset` | Reset entire database (testing) |

**NN Dashboard** (`/api/nn-dashboard`):
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Serve NN visualization dashboard HTML |
| GET | `/api/nn-dashboard` | Get dashboard metrics snapshot |
| POST | `/api/nn-dashboard/reset` | Reset dashboard metrics |

### Game Dynamics

> Press **H** in-game to open help window.

#### NAVIGATION

**Camera Movement:**
| Key | Action |
|-----|--------|
| W / Arrow Up | Move camera forward |
| S / Arrow Down | Move camera backward |
| A / Arrow Left | Rotate camera left |
| D / Arrow Right | Rotate camera right |

**Zoom & View:**
| Control | Action |
|---------|--------|
| Mouse Wheel | Zoom in/out |
| Mouse Drag | Rotate camera view |
| H Key | Open help window |
| Escape | Close help / Cancel action |

#### OPERATIONS

**Construction:**
- Placing Base/Power Plant:
  1. Click a building button in the panel
  2. Move mouse to preview placement location
  3. Left-click to place (requires energy)

**Energy Production:**
Minerals hold immense energy potential. Only **Power Plants** can convert harvested minerals into usable energy. Keep your workforce mining continuously, and deploy Power Plants strategically to maintain a steady energy flow.

**Units:**
| Unit | Description |
|------|-------------|
| Workforce | Created from Base, mine minerals |
| Protectors | Created from Base, combat units |

**Unit Movement:**
| Action | Result |
|--------|--------|
| Left-click unit | Select the unit |
| Left-click mineral | Move worker to mine |
| Left-click terrain | Move protector (protector auto-attacks) |
| Right-click | View information tooltip |

**Caution:**
Nearly all operations consume energy. Monitor the energy bar at the top of your display to avoid critical shortages.

#### ENEMIES

**Energy Parasites:**
The planet is home to hostile Energy Parasites that protect the Adaptive Queen. They hunt your units.

**Parasite Types:**

*Combat Parasites:*
- Aggressive, combat-focused behavior
- Prioritize attacking your Protectors

*Energy Parasites:*
- Target your Workers specifically
- Steal energy, weaker but more numerous

**Strategy Tips:**
- Keep Protectors near your Workers
- Parasites will spawn near mining
- Parasites will chase the workers
- Combat Parasites (red one) will destroy protectors
- Remember the Queen adapts to your tactics over time

#### PROGRESSION SYSTEM (Energy Lords)

Players advance through **60 levels** organized into **12 tiers** by sustaining energy production above thresholds for specified durations.

**Tier Structure:**
| Tier | Levels | Title | Sustain Time | Energy Range |
|------|--------|-------|--------------|--------------|
| Spark | 1-5 | Spark I-V | 1 min | 1,000 - 1,360 J |
| Ember | 6-10 | Ember I-V | 2 min | 1,469 - 1,999 J |
| Flame | 11-15 | Flame I-V | 3 min | 2,159 - 2,937 J |
| Blaze | 16-20 | Blaze I-V | 4 min | 3,172 - 4,316 J |
| Inferno | 21-25 | Inferno I-V | 5 min | 4,661 - 6,341 J |
| Nova | 26-30 | Nova I-V | 7 min | 6,848 - 9,317 J |
| Pulsar | 31-35 | Pulsar I-V | 9 min | 10,063 - 13,690 J |
| Quasar | 36-40 | Quasar I-V | 11 min | 14,785 - 20,115 J |
| Nebula | 41-45 | Nebula I-V | 13 min | 21,725 - 29,560 J |
| Star | 46-50 | Star I-V | 14 min | 31,924 - 43,427 J |
| Supernova | 51-55 | Supernova I-V | 15 min | 46,901 - 63,800 J |
| Nexus | 56-60 | Nexus I-V | 15 min | 68,904 - 93,749 J |

**How it works:**
- Energy threshold formula: `1000 × 1.08^(level-1)` Joules
- Energy checked every 500ms
- If energy drops below threshold, timer resets to zero
- Victory triggers when sustained time reaches required duration

**Upgrade Bonuses:**
- Regular level completion: +1% power generator bonus
- Tier completion (every 5th level): +3.5% bonus
- Maximum total bonus at level 60: 90%

**Persistence:**
- Progress saved to SQLite database via backend API
- Survives browser sessions
- Reset via `/reset-db` endpoint

#### GAME OBJECTIVE

No traditional "victory" - perpetual strategic challenge against evolving AI:
- Survive against increasingly adaptive parasite swarms
- Maximize energy extraction efficiency
- Advance through 60 levels of the Energy Lords progression
- Adapt strategies as the Queen AI learns yours

---

## 3. ARCHITECTURE AND CODEBASE OVERVIEW

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GAME CLIENT (Babylon.js)                    │
│  GameEngine → SceneManager, CameraController, TerrainSystem,    │
│  UnitManager, ParasiteManager, EnergyManager, BuildingSystem,   │
│  CombatSystem, TerritoryManager, EnergyLordsProgression, UI     │
└─────────────────────────┬───────────────────────────────────────┘
                          │ WebSocket (ws://localhost:8000)
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│              AI BACKEND (Python + PyTorch)                      │
│  WebSocket Server → Feature Extractor → SequentialQueenNN       │
│  (5 networks) → Simulation Gate → Strategy Generator → Trainer  │
└─────────────────────────────────────────────────────────────────┘
```

### Client Folder Structure
```
src/
├── game/          # GameEngine.ts, game-state.ts, types.ts
├── engine/        # SceneManager, CameraController, MaterialManager
├── world/         # TerrainSystem, TreeRenderer, MineralDeposit
├── units/         # Unit, Worker, Protector, UnitManager
├── parasites/     # Parasite, EnergyParasite, CombatParasite, ParasiteManager
├── buildings/     # Building, Base, PowerPlant, BuildingSystem
├── territories/   # TerritoryManager, Queen, Hive
├── combat/        # CombatSystem, CombatUI, effects/
├── economy/       # EnergyManager, energy-ui
├── ui/            # All UI components (HUD, Help, Intro, Debug)
├── tools/         # game-simulator.ts (training data generation)
└── main.ts        # Entry point
```

### Backend Folder Structure
```
server/
├── game_simulator.py              # Lightweight game state simulation
├── game_simulator_curriculum.py   # Progressive difficulty phases
├── message_handler.py             # WebSocket message processing
├── feature_extractor.py           # Observation → NN features
├── reward_calculator.py           # Outcome evaluation
├── trainer.py                     # Weight updates, learning loop
├── nn_model.py                    # PyTorch SequentialQueenNN
├── gate.py                        # Simulation-gated inference
├── death_analyzer.py              # Queen failure analysis
├── player_behavior.py             # Player pattern recognition
├── strategy_generator.py          # Adaptive strategy creation
├── models/
│   ├── queen_sequential.pt        # 5-network checkpoint
│   └── queen_sequential_metadata.json
└── requirements.txt
```

### Key Components (brief description for each)

| Component | Purpose |
|-----------|---------|
| GameEngine | Central coordinator, 60fps render loop, system orchestration |
| TerrainSystem | Procedural infinite terrain via Perlin noise, chunk-based loading |
| TerritoryManager | 16x16 chunk territories, Queen lifecycle, parasite spawning |
| CombatSystem | Auto-attack mechanics, damage resolution, energy cost validation |
| EnergyManager | Global energy pool, mining conversion, action validation |
| ParasiteManager | NN-driven spawn types, behavior state machine |
| SequentialQueenNN | 5 specialized neural networks for spawn decisions |

---

## 4. DEEP DIVE - GAME ENGINE

### 3D Rendering (Babylon.js)
- WebGL 2.0 rendering
- Low poly SciFi aesthetic, flat shading
- Dynamic lighting: Directional (sun) + ambient
- Performance targets: 60fps, <50 draw calls, <100MB memory
- Source specs: `.kiro/specs/3d-foundation-system/`

### Procedural Terrain
- Infinite generation using Perlin noise (deterministic seed)
- Chunk-based loading: 64x64 unit chunks, 7×7 grid around camera
- 3 biomes by height: Green (0-3), Yellow (3-6), Brown (6+)
- LOD system, frustum culling, efficient disposal
- Trees: ~400+ with GPU-accelerated glow pulsing
- Source specs: `.kiro/specs/procedural-terrain-system/`

### Unit System
**Workers** (from `client/src/game/entities/Worker.ts`):
- Energy capacity: 50
- Mining range: 3 units
- Mining energy cost: 0.4 per action
- Flee distance: 25 units when attacked by parasites
- Max health: 60
- Movement speed: 4.0

**Protectors** (from `client/src/game/entities/Protector.ts`):
- Energy capacity: 60
- Detection range: 12 units (auto-detect enemies)
- Attack range: 12 units
- Attack energy cost: 1 energy per attack
- Attack damage: 35
- Attack cooldown: 1.5 seconds
- Max health: 80
- Movement speed: 7.0

### Parasite System
**Spawn Distribution**:
- **NN-controlled**: The neural network decides spawn type via NN3 (Type Decision network)
  - NN outputs `spawnType` ('energy' or 'combat') → honored by ParasiteSpawner
- **Default fallback**: 75% Energy / 25% Combat (from `DEFAULT_SPAWN_DISTRIBUTION` in `ParasiteTypes.ts`)
  - Used when NN decision unavailable or for initialization

**Types** (from `PARASITE_STATS` in `ParasiteTypes.ts`):
| Type | Health | Target | Speed | Scale | Reward |
|------|--------|--------|-------|-------|--------|
| Energy | 60 HP | Workers | 4.0 | 1.0x | 2 energy |
| Combat | 100 HP | Protectors (then Workers) | 5.0 | 1.2x | 4 energy |

**States** (from `ParasiteState` enum in `Parasite.ts`):
SPAWNING → PATROLLING → HUNTING → FEEDING → RETURNING

### Territory & Queen System
**Territory**: Code exists in `TerritoryManager.ts` for 16×16 chunk grid territories.

**Queen**: Code exists in `Queen.ts` with lifecycle phases (UNDERGROUND_GROWTH, HIVE_CONSTRUCTION, ACTIVE_CONTROL), but:
- Queen is **non-interactive** (visual/conceptual only)
- No player combat with Queen
- Serves as the "brain" representing the NN that makes parasite spawn decisions
- Lifecycle phases exist for NN training context, not gameplay mechanics

**Note**: Territory liberation, Queen battles, and related mechanics from specs are not active gameplay features.

### Combat System
**Flow**: Detection (12 units) → Prioritization → Movement → Attack (12 units range) → Resolution

**Energy Economics** (from `CombatInterfaces.ts` and `ParasiteTypes.ts`):
| Action/Kill | Energy |
|-------------|--------|
| Attack cost | -1 |
| Energy Parasite kill | +2 |
| Combat Parasite kill | +4 |
| Worker kill (by enemy) | +15 |
| Protector kill (by enemy) | +20 |

### Performance Optimizations
**Key fixes from Jan 17 spec** (`.kiro/specs/fps-optimization-fixes/`):
- Combat material disposal
- Eliminated duplicate UI textures
- Synchronous render loop (no async stalls)
- Round-robin system throttling (EnergyManager 10Hz, TerritoryManager 10Hz, etc.)
- Per-frame allocation elimination (90%+ reduction)
- Singleton lookup caching
- Mouse move throttling
- Interval cleanup on dispose

---

## 5. DEEP DIVE - NEURAL NETWORK

### Evolution of Architecture

**v1 - Single Network** (failed):
- 29 inputs → 257 outputs (chunks)
- Problem: Mode collapse to chunk 179 (~67%)
- Issue: Flat features, overspecialized outputs

**v2 - Entropy/Label Smoothing** (partial):
- Added entropy penalty and label smoothing
- Better diversity but still architecture mismatch

**v3 - Five-NN Sequential** (current):
- 5 specialized networks, ~830 total parameters
- Sequential pipeline with focused inputs/outputs

### Five-NN Architecture
```
NN1: Energy Suitability
├─ Input: 10 (protector_density + e_parasite_rate × 5 chunks)
├─ Output: 5 sigmoid (suitability per chunk)
└─ Purpose: Is chunk good for energy parasites?

NN2: Combat Suitability (parallel)
├─ Input: 10 (protector_density + c_parasite_rate × 5 chunks)
├─ Output: 5 sigmoid (suitability per chunk)
└─ Purpose: Is chunk good for combat parasites?

NN3: Type Decision
├─ Input: 10 (5 energy_suit + 5 combat_suit)
├─ Output: 2 softmax (P(energy), P(combat))
└─ Purpose: Energy or combat parasite?

NN4: Chunk Decision
├─ Input: 15 (5 worker_densities + 5 suitabilities + 5 saturations)
├─ Output: 6 softmax (P(chunk0-4) + P(NO_SPAWN))
└─ Purpose: Which chunk to target?

NN5: Quantity Decision
├─ Input: 7 (saturation, suitability, capacity, rates, type, chunk)
├─ Output: 5 softmax (P(0-4 parasites))
└─ Purpose: How many to spawn?
```

- Source: `.kiro/specs/five-nn-sequential/`

### Feature Extraction
**Base 29 Features**:
- Per-chunk (×5): worker_density, protector_density, e_parasite_rate, c_parasite_rate
- Global: e/c_parasite_spawn_capacity, player_energy_rate, player_mineral_rate

### Simulation-Gated Inference
**Purpose**: Evaluate spawn decisions before execution using predictive cost function

#### Expected Reward Formula
```
R_expected = w₁·Survival + w₂·Disruption + w₃·Location + Exploration
```

**Weights** (from `config.py`):
- w₁ (survival_weight) = 0.3
- w₂ (disruption_weight) = 0.5
- w₃ (location_weight) = 0.2

#### Component 1: Survival Probability
Estimates if spawned parasite survives based on protector positions.

**Threat Factor per Protector**:
```
threat(d) =
  1.0                           if d < kill_range (2 chunks)
  exp(-λ·(d - kill_range))      if kill_range ≤ d < safe_range
  0.0                           if d ≥ safe_range (8 chunks)
```
Where λ (threat_decay) = 0.5

**Survival Probability**:
```
P_survival = ∏ᵢ (1 - threat_factorᵢ)
```
Product across all protectors - one protector in kill zone = 0% survival.

#### Component 2: Worker Disruption
Estimates damage potential to player's economy.
- Energy parasites: pursuit range = 6 chunks (60 game units)
- Combat parasites: pursuit range = 7.5 chunks (75 game units)
- Considers protector protection around workers

#### Component 3: Location Penalty
- α (hive_proximity_weight) = 0.3 - penalty for distance from hive
- β (worker_proximity_weight) = 0.4 - penalty for distance from workers

#### Component 4: Exploration Bonus (Deadlock Prevention)
```
bonus = ε · min(time_since_spawn, max_time) / max_time
```
- ε (exploration_coefficient) = 0.35
- max_time = 300 seconds (5 minutes)

Chunks not spawned at recently get increasing bonus to prevent NN from ignoring viable options.

#### Gate Decision
```
if R_expected > θ (threshold):
    SEND spawn to game
else:
    WAIT, train on simulation feedback
```

**Threshold Configuration**:
- Detection logic: `simulation_mode = reward_threshold < -1000`
- Default: θ = -2000 (simulation mode - gate passes everything, NN learns from all outcomes)
- Production: θ = 0.35 (available in YAML configs but not currently wired up)

**Current State**: Gate is unintentionally disabled due to `message_handler.py` not using the config loader:
- `simulation_gate.yaml` has θ = 0.0 (proper production value)
- But `message_handler.py:112` uses `SimulationGateConfig()` directly → Python default θ = -2000
- **Fix needed**: Use `load_simulation_config()` instead (see TODOs section)

- Source: `.kiro/specs/simulation-gated-inference/`, `server/ai_engine/decision_gate/`

### Learning Pipeline
**Dual Feedback**:
- Simulation feedback: Immediate (every observation)
- Real feedback: Delayed (executed actions only)
- Effective: simulation × 0.3 + real × 0.7

**Loss Functions**:
- NN1/NN2: MSE on suitability vs actual survival rate
- NN3/NN4/NN5: Cross-entropy

**On Queen Death**:
1. Capture death data (location, cause, timing, player units)
2. Analyze assault pattern (direct, flanking, coordinated, infiltration)
3. Update player behavior model
4. Train 5 NNs on failure signal (negative reward)
5. Generate new strategy for next generation

- Source: `.kiro/specs/queen-nn-continuous-learning/`, `.kiro/specs/continuous-training-loop/`

### PyTorch GPU Migration
**Why**: TensorFlow 2.x Windows has no native GPU support after v2.10
**Result**: PyTorch with auto GPU/CPU detection
- GPU: 0.60ms inference, 3.71ms training
- CPU: Still fast enough for real-time gameplay (model is only ~830 params)
- GPU mainly benefits turbo-mode simulator (79.5 TPS vs slower on CPU)
- Source: `.kiro/specs/pytorch-gpu-migration/`

### Game Simulator
**Purpose**: Automated training data generation (no 3D rendering)
**Performance**: 1000+ ticks/sec in turbo mode (100x faster than real gameplay)
**Interface**: Reuses WebSocket protocol - NN cannot distinguish simulated from real
**Curriculum**: Progressive difficulty phases
- Source: `.kiro/specs/game-simulator/`, `.kiro/specs/simulator-curriculum-challenge/`

### Generational Evolution
- Gen 1: Random/baseline
- Gen 2-3: Avoid death locations, adaptive timing
- Gen 4+: Predictive placement, counter assault patterns
- Gen 7+: Multi-step planning, deceptive behaviors

---

## 6. GAME LORE

> Note: This section can be separated into its own file as per project preference.

### The Korenthi Empire
- Advanced civilization mastering Artificial Consciousness
- Facing energy starvation despite tech prowess

### The Energy Crisis
- AI technology extremely power-hungry
- Home planet resources insufficient
- Must expand to distant worlds

### The Energy Lords Guild
- Elite organization addressing energy crisis
- Player is a deployed member
- Handles mineral extraction with autonomy

### The Discovery
- Remote planet rich in minerals
- Quantum tunneling enables resource transmission across stars
- Mining bases deployed via spacecraft

### The Threat

**Energy Parasites** (ecological threat):
- Target workers, drain energy
- 75% of spawns, 2 hits to destroy

**Combat Parasites** (evolved threat):
- Target protectors, aggressive hunting
- 25% of spawns, 4 hits to destroy

**Queens** (adaptive intelligence):
- Neural network learns from failures
- Each generation smarter than last
- Controls territories, commands swarms

### Narrative Arc
1. Empire discovers energy-rich planet
2. Energy Lords established
3. Parasites emerge as inhabitants
4. Combat Parasites evolve
5. Queens appear, organizing parasites
6. AI evolution accelerates
7. Arms race: player vs adaptive intelligence
8. Perpetual strategic challenge (no "final victory")

- Source: `.kiro/specs/introduction-screen/story.md`

---

## 7. TROUBLESHOOTING

### Common Issues

**Low FPS (Below 50fps)**:
- Check memory (<100MB target)
- Verify GPU acceleration in browser console
- Reduce unit/parasite count
- Check for memory leaks (intervals not cleared)

**AI Backend Disconnection**:
- Verify WebSocket server at ws://localhost:8000
- Check Python env and dependencies
- Auto-retry with exponential backoff (max 30s)
- Falls back to rule-based AI if unavailable

**NN Training Stuck**:
- Verify simulator sending observations
- Check for mode collapse in spawn decisions
- Review loss values in training logs
- Exploration bonus prevents deadlock

**Memory Leaks**:
- Intervals cleared on UI dispose
- WebSocket callbacks cleaned up
- Material disposal on effect completion
- Restart browser if >300MB

**Queen Not Visible**:
- Queen is non-interactive (visual/AI element only)
- Controls parasite behavior behind the scenes
- Visible as Hive structure in territory

### Performance Tips
- GPU: RTX 3060 can process 100+ NN predictions/sec
- Per-frame allocations fixed in Jan 17 spec
- Max 49 terrain chunks loaded (7×7 grid)
- Max 10 concurrent combat effects

### Browser Compatibility
- Chrome/Edge: Best WebGL 2.0 + CUDA
- Firefox: Good WebGL, slower JS engine
- Safari: Adequate WebGL, no CUDA
- Mobile: Limited support

---

## 8. PROJECT EVOLUTION SUMMARY

### Development Timeline

| Date | Phase | Key Specs |
|------|-------|-----------|
| Jan 9-11 | Foundation | protector-combat-system |
| Jan 12 | Ecosystem | enhanced-parasite-system, queen-territory-system, adaptive-queen-intelligence |
| Jan 13 | Core Systems | neural-network-tuning, 3d-foundation, energy-economy, terrain, units |
| Jan 14-15 | Refinement | parasite-base-class-refactor, spatial-unit-indexing, combat-balance-tuning |
| Jan 16 | Progression | energy-lords-progression, queen-nn-continuous-learning |
| Jan 17 | Performance | fps-optimization-fixes (20+ requirements) |
| Jan 18 | NN v2 | queen-nn-v2 architecture improvements |
| Jan 20-22 | Intelligence | simulation-gated-inference, nn-visualization-dashboard, continuous-training-loop, nn-gate-separation |
| Jan 25 | Training | game-simulator, pytorch-gpu-migration, label-smoothing, five-nn-sequential |
| Jan 26 | Curriculum | simulator-curriculum-challenge |
| Jan 28 | Polish | client/server-code-quality, in-game-help |

### Key Pivots
1. **Single NN → Five-NN Sequential**: Mode collapse forced architecture redesign
2. **TensorFlow → PyTorch**: Windows GPU support critical
3. **Simulation-Gated Inference**: Immediate feedback enabled continuous learning
4. **Game Simulator**: Manual gameplay bottleneck → 100x training acceleration
5. **FPS Optimization**: 25fps baseline → restored 60fps stability

---

## 9. KNOWN ISSUES / TODOs

- [ ] **SimulationGate not loading YAML config**: `message_handler.py:112` uses `SimulationGateConfig()` directly (Python defaults, threshold=-2000) instead of `load_simulation_config()` which loads from `simulation_gate.yaml` (threshold=0.0). Fix: use the config loader to enable proper gate filtering.

---

## 10. NEXT STEPS FOR README

This brain dump should enable:
- [ ] User story: "As a player, I want to quickly install and start playing"
- [ ] User story: "As a developer, I want to understand the architecture"
- [ ] User story: "As a contributor, I want to understand the NN system"
- [ ] Separate Game Lore into its own markdown file
- [ ] Add actual installation commands (npm, python)
- [ ] Add screenshots/diagrams where helpful
- [ ] Verify all paths and commands are accurate

---

*Document generated by scanning all `.kiro/specs/` in chronological order (Jan 9-28, 2026)*
