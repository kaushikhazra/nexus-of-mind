# Game Simulator

Automated game simulation for training the Queen Neural Network. The simulator connects to the backend WebSocket, runs game scenarios, and generates training data by interacting with the NN in real-time.

## Quick Start

```bash
# Ensure the backend server is running first
cd server
python main.py

# In another terminal, run the simulator
python -m server.game_simulator.main --turbo --ticks 1000
```

## CLI Reference

```bash
python -m server.game_simulator.main [options]
```

### Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--config` | `-c` | (built-in) | Path to YAML configuration file |
| `--ticks` | `-t` | 1000 | Number of simulation ticks to run |
| `--turbo` | | false | Enable turbo mode (no delays, max speed) |
| `--continuous` | | false | Run indefinitely until Ctrl+C |
| `--curriculum` | | false | Enable curriculum learning |
| `--url` | `-u` | `ws://localhost:8000/ws` | WebSocket URL to connect to |
| `--verbose` | `-v` | false | Enable debug logging |
| `--quiet` | `-q` | false | Suppress all output except errors |

### Usage Examples

```bash
# Default run (1000 ticks, real-time speed)
python -m server.game_simulator.main

# Fast training run
python -m server.game_simulator.main --turbo --ticks 10000

# Continuous training (runs until Ctrl+C)
python -m server.game_simulator.main --continuous --turbo

# Curriculum learning
python -m server.game_simulator.main --curriculum --turbo --ticks 5000

# Custom configuration
python -m server.game_simulator.main --config my_config.yaml

# Remote backend
python -m server.game_simulator.main --url ws://remote-server:8000/ws

# Debug mode
python -m server.game_simulator.main --verbose --ticks 100

# Quiet training run
python -m server.game_simulator.main --quiet --turbo --continuous
```

## Configuration

### YAML Configuration File

Create a YAML file to customize simulation parameters:

```yaml
# Map Settings
grid_size: 20                    # Grid dimensions (20x20 = 400 chunks)
queen_chunk: 200                 # Queen's position (center)
mining_spots: [45, 67, 123, 189, 234, 312, 378]

# Workers
num_workers: 8
worker_speed: 1.0
flee_radius: 3                   # Distance to flee from parasites
flee_duration: 5                 # Ticks to stay in flee mode
mining_rate: 1.0

# Protectors
num_protectors: 3
protector_speed: 1.5
detection_radius: 5              # Parasite detection range
kill_radius: 2                   # Range to kill parasites

# Queen
queen_start_energy: 50
queen_max_energy: 100
queen_energy_regen: 0.5          # Energy regen per tick
energy_parasite_cost: 15         # Cost to spawn energy parasite
combat_parasite_cost: 25         # Cost to spawn combat parasite

# Parasites
disruption_radius: 3             # Effect radius of parasites

# Resources
player_start_energy: 100
player_start_minerals: 50
energy_per_mining: 0.5
minerals_per_mining: 0.3

# Simulation
tick_interval: 0.1               # Seconds between ticks (real-time mode)
turbo_mode: false                # Override with --turbo flag
```

### Minimal Configuration

Override only what you need:

```yaml
num_workers: 4
num_protectors: 1
turbo_mode: true
```

## Curriculum Learning

Curriculum learning progressively increases simulation complexity to help the NN learn incrementally.

### Default Curriculum Phases

| Phase | Duration | Workers | Protectors | Description |
|-------|----------|---------|------------|-------------|
| `basic` | 1000 ticks | 4 | 0 | Learn worker patterns without protectors |
| `with_protectors` | 2000 ticks | 6 | 2 | Introduce defensive units |
| `full` | infinite | 8 | 3 | Full complexity training |

### Enable Curriculum Learning

```bash
python -m server.game_simulator.main --curriculum --turbo --continuous
```

The simulator automatically transitions between phases and logs progress:

```
CURRICULUM PHASE TRANSITION at tick 1000
Previous phase duration: 1000 ticks
New phase: with_protectors
Entity counts - Workers: 6, Protectors: 2
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      main.py (CLI)                          │
│  - Parse arguments                                          │
│  - Load configuration                                       │
│  - Start simulation                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   SimulationRunner                          │
│  - WebSocket connection to backend                          │
│  - Main loop orchestration                                  │
│  - Performance metrics tracking                             │
│  - Curriculum phase transitions                             │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌───────────────────┐ ┌─────────────┐ ┌─────────────────────┐
│    Simulator      │ │ Observation │ │  CurriculumManager  │
│  - Game state     │ │  Generator  │ │  - Phase tracking   │
│  - Entity logic   │ │  - Format   │ │  - Transitions      │
│  - Tick updates   │ │    output   │ │  - Difficulty       │
└───────────────────┘ └─────────────┘ └─────────────────────┘
```

### Simulation Loop

Each tick executes:

1. **Evolve** - Update game state (entity movement, combat, resources)
2. **Observe** - Generate observation for NN
3. **Send** - Transmit observation via WebSocket
4. **Receive** - Get NN decision (spawn/wait)
5. **Execute** - Spawn parasite if requested
6. **Wait** - Delay for tick interval (skipped in turbo mode)

## Performance Metrics

The simulator tracks and reports:

- **Ticks per Second (TPS)** - Simulation throughput
- **Average Tick Time** - Mean tick execution time
- **Min/Max Tick Time** - Performance bounds

### Expected Performance

| Mode | TPS | Use Case |
|------|-----|----------|
| Real-time | ~10 | Debugging, visualization |
| Turbo | 100-1000+ | Training data generation |

Performance is logged every 100 ticks:

```
Performance - TPS: 450.2, Avg tick time: 2.22ms
```

## Module Reference

| Module | Purpose |
|--------|---------|
| `main.py` | CLI entry point |
| `runner.py` | Simulation orchestration |
| `simulator.py` | Core game logic |
| `state.py` | Game state management |
| `entities.py` | Worker, Protector, Parasite entities |
| `observation.py` | Observation generation for NN |
| `config.py` | Configuration management |
| `curriculum.py` | Curriculum learning system |

## Integration

The simulator uses the same WebSocket protocol as the game frontend:

```json
// Observation sent to backend
{
  "type": "observation_data",
  "timestamp": 1234567890.123,
  "data": {
    "tick": 42,
    "queen_energy": 75.5,
    "workers": [...],
    "protectors": [...],
    "parasites": [...]
  }
}

// Response from backend
{
  "action": "spawn",
  "spawnChunk": 156,
  "spawnType": "energy"
}
// or
{
  "action": "wait",
  "reason": "insufficient_energy"
}
```

## Troubleshooting

### Connection Failed

```
ERROR: Failed to connect to backend: [Connection refused]
```

Ensure the backend server is running:
```bash
cd server
python main.py
```

### Invalid Configuration

```
ERROR: Invalid configuration: num_workers must be positive
```

Check your YAML configuration file for valid values.

### Performance Issues

If TPS is lower than expected:
- Ensure `--turbo` flag is set
- Check backend NN inference speed
- Reduce entity counts in configuration
