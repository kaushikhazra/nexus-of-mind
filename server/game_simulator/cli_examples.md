# Game Simulator CLI Examples

This document provides examples of how to use the game simulator CLI.

## Basic Usage

### Run with default settings
```bash
python -m game_simulator.main
```
- Uses built-in default configuration
- Runs for 1000 ticks
- Real-time mode (100ms per tick)
- Connects to ws://localhost:8000/ws

### Run with custom configuration
```bash
python -m game_simulator.main --config my_config.yaml
```

### Run in turbo mode for training
```bash
python -m game_simulator.main --turbo --ticks 10000
```
- No delays between ticks (maximum speed)
- Runs for 10,000 ticks
- Ideal for AI training

### Run continuously until stopped
```bash
python -m game_simulator.main --continuous --turbo
```
- Runs indefinitely until Ctrl+C
- Combines with other flags (turbo, curriculum, etc.)
- Gracefully handles interruption

## Advanced Usage

### Curriculum learning
```bash
python -m game_simulator.main --curriculum --ticks 5000 --turbo
```
- Enables progressive difficulty phases
- Starts with few workers, no protectors
- Gradually increases complexity

### Connect to remote backend
```bash
python -m game_simulator.main --url ws://remote-server:8000/ws
```

### Verbose debugging
```bash
python -m game_simulator.main --verbose --ticks 100
```
- Shows detailed debug logs
- Useful for troubleshooting

### Quiet mode
```bash
python -m game_simulator.main --quiet --turbo --ticks 50000
```
- Suppresses all output except errors
- Good for automated training runs

## Configuration File Examples

### Custom config file (my_config.yaml)
```yaml
# Fast training configuration
grid_size: 20
num_workers: 4
num_protectors: 2
turbo_mode: true
tick_interval: 0.0
queen_start_energy: 100
energy_parasite_cost: 10
combat_parasite_cost: 20
```

### Minimal config (minimal.yaml)
```yaml
# Override just a few settings
num_workers: 2
num_protectors: 1
turbo_mode: true
```

## Performance Examples

### High-speed training run
```bash
python -m game_simulator.main \
  --turbo \
  --ticks 100000 \
  --quiet \
  --config fast_config.yaml
```

### Development testing
```bash
python -m game_simulator.main \
  --verbose \
  --ticks 50 \
  --config debug_config.yaml
```

### Curriculum learning experiment
```bash
python -m game_simulator.main \
  --curriculum \
  --turbo \
  --ticks 10000 \
  --verbose
```

## Error Handling

The CLI provides helpful error messages:

### Missing config file
```bash
$ python -m game_simulator.main --config missing.yaml
ERROR: Configuration file not found: missing.yaml
```

### Invalid tick count
```bash
$ python -m game_simulator.main --ticks 0
ERROR: Number of ticks must be positive
```

### Connection failure
```bash
$ python -m game_simulator.main --url ws://nonexistent:8000/ws
ERROR: Failed to connect to backend: [Connection refused]
Make sure the backend server is running and accessible
```

## Integration with Backend

The simulator connects to the existing WebSocket backend:

1. **Start the backend server** (in separate terminal):
   ```bash
   cd server
   python main.py
   ```

2. **Run the simulator**:
   ```bash
   python -m game_simulator.main --turbo --ticks 1000
   ```

The simulator will:
- Send observations in the same format as the real game frontend
- Receive NN decisions from the backend
- Execute parasite spawns based on AI decisions
- Generate training data for the Queen NN

## Performance Expectations

### Real-time mode (--turbo not specified)
- ~10 ticks per second
- Good for debugging and visualization
- Matches real game timing

### Turbo mode (--turbo specified)
- 100-1000+ ticks per second
- Limited by NN inference speed
- Ideal for training data generation

### Curriculum learning
- Automatic phase transitions
- Progressive difficulty increase
- Better training convergence