# Game Simulator - Requirements

## Introduction

This specification defines a lightweight game simulator that generates realistic observations for training the Queen NN without manual gameplay. The simulator sends observations through the existing WebSocket interface, allowing the NN + Gate + Trainer pipeline to work unchanged.

**Key Innovation:**
- Automated training data generation
- Uses existing WebSocket interface (no backend changes)
- Simulates game dynamics (workers, protectors, resources)
- Enables 100-1000x faster training than manual play

**Core Design Principle: Reuse Existing Pipeline**

```
┌─────────────────────┐
│  GAME SIMULATOR     │
│                     │
│  Lightweight model  │──────► WebSocket ──────► NN + Gate + Trainer
│  of game state      │        (existing)        (unchanged)
└─────────────────────┘
```

The simulator generates observations that look like real gameplay. The NN cannot tell the difference.

## Glossary

- **Tick**: One simulation step (default: 100ms simulated time)
- **Entity**: A game object (Worker, Protector, Parasite, Queen)
- **Chunk**: A grid cell (0-399 for 20x20 grid)
- **Mining Spot**: A chunk with resources where workers gather
- **Observation**: The data packet sent to backend (matches frontend format)
- **Turbo Mode**: Run simulation without delays for maximum speed

## Requirements

### Requirement 1: Game State Model

**User Story:** As a trainer, I need a model of game state so that observations reflect realistic game dynamics.

**Problem Statement:**
- Manual gameplay is slow (~1.3k iterations to reach 0.3 loss)
- Human becomes the training data bottleneck
- Need automated way to generate training experiences

#### Acceptance Criteria

1. THE System SHALL implement SimulatedGameState containing:
   - `workers`: List of Worker entities with position and behavior
   - `protectors`: List of Protector entities with patrol logic
   - `parasites`: List of active Parasite entities
   - `queen_energy`: float (regenerates over time)
   - `queen_chunk`: int (hive location)
   - `player_energy`: float (increases from mining)
   - `player_minerals`: float (increases from mining)
   - `mining_spots`: List of chunks with resources

2. THE System SHALL track derived rates:
   - `player_energy_rate`: Change in energy per tick
   - `player_mineral_rate`: Change in minerals per tick

3. THE state SHALL be serializable for debugging/inspection

### Requirement 2: Worker Entity

**User Story:** As a simulator, I need workers that behave realistically so that the NN learns valid patterns.

#### Acceptance Criteria

1. THE Worker entity SHALL have:
   - `chunk`: Current position (0-399)
   - `target_chunk`: Destination (mining spot)
   - `state`: Enum (MINING, MOVING, FLEEING)
   - `flee_timer`: Ticks remaining in flee state

2. THE Worker SHALL exhibit behaviors:
   - **MINING**: Stay at mining spot, generate resources
   - **MOVING**: Move toward target chunk (1 chunk per tick)
   - **FLEEING**: Move away from parasite threat

3. THE Worker SHALL respond to parasites:
   - If parasite within `flee_radius` (default: 3 chunks): enter FLEEING state
   - Flee direction: away from nearest parasite
   - After `flee_duration` ticks: return to MOVING toward mining spot

4. THE Worker flee behavior SHALL affect resource generation:
   - FLEEING workers do not generate resources
   - This creates the feedback loop the NN needs to learn

### Requirement 3: Protector Entity

**User Story:** As a simulator, I need protectors that patrol and chase parasites so that the NN learns survival patterns.

#### Acceptance Criteria

1. THE Protector entity SHALL have:
   - `chunk`: Current position (0-399)
   - `patrol_path`: List of chunks to visit
   - `patrol_index`: Current position in patrol
   - `state`: Enum (PATROLLING, CHASING)
   - `chase_target`: Parasite being chased (if any)

2. THE Protector SHALL exhibit behaviors:
   - **PATROLLING**: Move along patrol_path in sequence
   - **CHASING**: Move toward detected parasite

3. THE Protector SHALL detect parasites:
   - If parasite within `detection_radius` (default: 5 chunks): enter CHASING
   - Move toward parasite at `protector_speed` (faster than parasite)

4. THE Protector SHALL kill parasites:
   - If parasite within `kill_radius` (default: 2 chunks): remove parasite
   - Return to PATROLLING after kill

### Requirement 4: Parasite Entity

**User Story:** As a simulator, I need parasites that spawn from NN decisions and affect workers so that training reflects real consequences.

#### Acceptance Criteria

1. THE Parasite entity SHALL have:
   - `chunk`: Current position (0-399)
   - `type`: 'energy' or 'combat'
   - `spawn_time`: When spawned (for lifetime tracking)

2. THE Parasite SHALL be created:
   - When NN decision is received via WebSocket
   - At the chunk specified by NN
   - Of the type specified by NN
   - Only if queen has sufficient energy

3. THE Parasite SHALL affect workers:
   - Workers within `disruption_radius` enter FLEEING state
   - Disruption reduces resource generation

4. THE Parasite SHALL be removed when:
   - Killed by protector (within kill_radius)
   - (Future: natural lifetime expiry)

### Requirement 5: Queen Entity

**User Story:** As a simulator, I need a queen that manages energy so that spawn capacity is realistic.

#### Acceptance Criteria

1. THE Queen SHALL have:
   - `energy`: Current energy level
   - `chunk`: Hive location (fixed)
   - `regen_rate`: Energy regeneration per tick

2. THE Queen energy SHALL follow game rules:
   - Regenerate `regen_rate` energy per tick
   - Energy parasite costs 15 energy
   - Combat parasite costs 25 energy
   - Cannot spawn if insufficient energy

3. THE System SHALL deduct energy on spawn:
   - When NN decision is executed
   - Before creating parasite entity

### Requirement 6: Tick-Based Simulation

**User Story:** As a trainer, I need the simulation to evolve over time so that observations change realistically.

#### Acceptance Criteria

1. THE Simulator SHALL implement tick() method that:
   - Updates all entity positions
   - Processes entity interactions (flee, chase, kill)
   - Updates resource generation
   - Regenerates queen energy

2. THE tick order SHALL be:
   1. Move workers (flee or toward mining)
   2. Move protectors (patrol or chase)
   3. Check parasite kills
   4. Update resource generation
   5. Regenerate queen energy
   6. Calculate rates (energy_rate, mineral_rate)

3. THE simulation SHALL be deterministic:
   - Same initial state + same NN decisions = same outcome
   - Enables reproducible training runs

### Requirement 7: Observation Generation

**User Story:** As a trainer, I need observations that match the frontend format exactly so that the existing pipeline works unchanged.

#### Acceptance Criteria

1. THE observation format SHALL match frontend exactly:
   ```json
   {
     "territoryId": "sim-territory",
     "aiPlayer": 1,
     "tick": <current_tick>,
     "chunks": {
       "<chunk_id>": {
         "workers": <count>,
         "protectors": <count>,
         "energyParasites": <count>,
         "combatParasites": <count>
       }
     },
     "queenEnergy": <float>,
     "playerEnergyStart": <float>,
     "playerEnergyEnd": <float>,
     "playerMineralsStart": <float>,
     "playerMineralsEnd": <float>,
     "hiveChunk": <int>
   }
   ```

2. THE System SHALL calculate chunk densities:
   - Count workers per chunk
   - Count protectors per chunk
   - Count parasites per chunk by type

3. THE System SHALL include top activity chunks:
   - Chunks with workers/protectors/parasites
   - Matches frontend's observation filtering

### Requirement 8: WebSocket Integration

**User Story:** As a trainer, I need the simulator to connect via WebSocket so that it uses the existing pipeline.

#### Acceptance Criteria

1. THE SimulationRunner SHALL connect to backend WebSocket:
   - URL: `ws://localhost:8000/ws`
   - Standard WebSocket protocol

2. THE SimulationRunner SHALL send observations:
   - Message type: `nn_observation`
   - Format matches frontend exactly

3. THE SimulationRunner SHALL receive NN decisions:
   - Parse spawn decisions from responses
   - Execute spawns in simulation state

4. THE SimulationRunner SHALL handle connection lifecycle:
   - Connect on start
   - Reconnect on disconnect
   - Clean shutdown

### Requirement 9: Simulation Runner

**User Story:** As a trainer, I need a runner that orchestrates the simulation loop so that I can run automated training.

#### Acceptance Criteria

1. THE SimulationRunner SHALL implement main loop:
   ```
   for tick in range(num_ticks):
       state.tick()
       observation = generate_observation(state)
       send_observation(observation)
       response = receive_response()
       if response.has_spawn:
           state.spawn_parasite(response)
       sleep(tick_interval)  # or skip in turbo mode
   ```

2. THE SimulationRunner SHALL support modes:
   - **Real-time**: tick_interval = 0.1s (for debugging)
   - **Turbo**: tick_interval = 0 (maximum speed)

3. THE SimulationRunner SHALL be configurable:
   - num_ticks: Total ticks to run
   - tick_interval: Time between ticks
   - websocket_url: Backend URL

### Requirement 10: Configuration

**User Story:** As a trainer, I need configurable parameters so that I can tune the simulation.

#### Acceptance Criteria

1. THE System SHALL support SimulationConfig:
   ```python
   @dataclass
   class SimulationConfig:
       # Map
       grid_size: int = 20  # 20x20 = 400 chunks
       mining_spots: List[int]  # Resource locations

       # Workers
       num_workers: int = 8
       worker_speed: float = 1.0
       flee_radius: int = 3
       flee_duration: int = 5

       # Protectors
       num_protectors: int = 3
       protector_speed: float = 1.5
       detection_radius: int = 5
       kill_radius: int = 2

       # Queen
       queen_start_energy: float = 50
       queen_energy_regen: float = 0.5
       energy_parasite_cost: int = 15
       combat_parasite_cost: int = 25

       # Parasites
       parasite_disruption_radius: int = 3

       # Simulation
       tick_interval: float = 0.1
       turbo_mode: bool = False
   ```

2. THE configuration SHALL be loadable from YAML file
3. THE configuration SHALL have sensible defaults
4. THE System SHALL validate configuration on load

### Requirement 11: Curriculum Learning

**User Story:** As a trainer, I need progressive difficulty so that the NN learns incrementally.

#### Acceptance Criteria

1. THE System SHALL support curriculum phases:
   - **Phase 1**: Few workers, no protectors (learn basic spawning)
   - **Phase 2**: Add protectors (learn avoidance)
   - **Phase 3**: Dynamic workers, full complexity (learn timing)

2. THE curriculum SHALL be configurable:
   - Phase durations (in ticks)
   - Entity counts per phase
   - Automatic phase transitions

3. THE System SHALL log phase transitions:
   - Current phase
   - Ticks in phase
   - Metrics per phase

### Requirement 12: Performance

**User Story:** As a trainer, I need the simulation to run fast so that training completes quickly.

#### Acceptance Criteria

1. THE tick() execution SHALL be fast:
   - Target: < 1ms per tick
   - Enables 1000+ ticks per second in turbo mode

2. THE observation generation SHALL be fast:
   - Target: < 1ms per observation

3. THE System SHALL NOT be bottlenecked by simulation:
   - Bottleneck should be NN inference/training
   - Simulation should be waiting on backend, not vice versa

4. THE System SHALL support batch observation mode (future):
   - Generate multiple observations per WebSocket round-trip
   - Further increase throughput
