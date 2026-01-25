# Game Simulation for NN Training

**Goal:** Train the Queen NN without manual gameplay by simulating realistic game observations.

---

## 1. The Problem

- Manual gameplay is slow (~1.3k iterations to reach 0.3 loss)
- Human becomes the training data bottleneck
- Need automated way to generate training experiences

---

## 2. Key Insight

We already have:
- WebSocket interface that receives observations
- Gate that evaluates spawn decisions
- Training pipeline that learns from gate signals

**Solution:** Send SIMULATED observations through the same interface. The NN + Gate + Trainer work unchanged.

```
┌─────────────────────┐
│  GAME SIMULATOR     │
│                     │
│  Lightweight model  │
│  of game state      │──────► WebSocket ──────► NN + Gate + Trainer
│  that evolves       │        (existing)        (unchanged)
│  over time          │
└─────────────────────┘
```

---

## 3. What We Need to Simulate

### 3.1 Entities

| Entity | Behavior | Key Properties |
|--------|----------|----------------|
| **Workers** | Cluster at mining spots, flee from parasites | chunk, mining_target, flee_timer |
| **Protectors** | Patrol territory, chase parasites | chunk, patrol_path, chase_target |
| **Parasites** | Spawn from queen, disrupt workers, get killed | chunk, type, spawn_time |
| **Queen** | Spawns parasites, has energy | energy, regen_rate |

### 3.2 Game State

```python
@dataclass
class SimulatedGameState:
    # Entities
    workers: List[Worker]
    protectors: List[Protector]
    parasites: List[Parasite]

    # Queen
    queen_energy: float
    queen_chunk: int  # Hive location

    # Resources (what NN observes)
    player_energy: float
    player_minerals: float
    player_energy_rate: float  # Derived from workers
    player_mineral_rate: float

    # Map
    mining_spots: List[int]  # Chunks with resources
```

### 3.3 Tick-Based Evolution

Each tick (~100ms simulated time):

1. **Move workers**
   - If no threat: move toward mining_target
   - If parasite nearby: flee (move away)
   - If at mining spot: generate resources

2. **Move protectors**
   - If no parasite: follow patrol_path
   - If parasite nearby: chase and kill

3. **Update parasites**
   - Check if killed by protector (distance < kill_radius)
   - Track disruption (workers fleeing)

4. **Update queen**
   - Regenerate energy over time
   - (Spawn decisions come from NN via WebSocket)

5. **Calculate rates**
   - energy_rate = workers_mining * base_rate
   - mineral_rate = workers_mining * base_rate

---

## 4. Observation Generation

Must match frontend format exactly:

```python
def generate_observation(state: SimulatedGameState) -> dict:
    # Calculate chunk densities
    worker_chunks = [w.chunk for w in state.workers]
    protector_chunks = [p.chunk for p in state.protectors]

    # Find top 5 chunks by activity
    top_chunks = calculate_top_chunks(worker_chunks, protector_chunks)

    return {
        "territoryId": "sim-territory",
        "aiPlayer": 1,
        "tick": current_tick,
        "chunks": {
            str(chunk): {
                "workers": count_in_chunk(worker_chunks, chunk),
                "protectors": count_in_chunk(protector_chunks, chunk),
                "energyParasites": count_parasites(state, chunk, "energy"),
                "combatParasites": count_parasites(state, chunk, "combat"),
            }
            for chunk in top_chunks
        },
        "queenEnergy": state.queen_energy,
        "playerEnergyStart": state.player_energy - state.player_energy_rate,
        "playerEnergyEnd": state.player_energy,
        "playerMineralsStart": state.player_minerals - state.player_mineral_rate,
        "playerMineralsEnd": state.player_minerals,
        "hiveChunk": state.queen_chunk,
    }
```

---

## 5. Simulation Runner

```python
class SimulationRunner:
    def __init__(self, websocket_url: str):
        self.state = SimulatedGameState.create_initial()
        self.ws = connect(websocket_url)

    async def run(self, ticks: int, tick_interval: float = 0.1):
        for _ in range(ticks):
            # 1. Evolve game state
            self.state.tick()

            # 2. Generate and send observation
            obs = generate_observation(self.state)
            await self.ws.send(json.dumps({
                "type": "nn_observation",
                "data": obs
            }))

            # 3. Receive NN decision (if any)
            response = await self.ws.recv()
            if response.get("action") == "spawn":
                self.state.spawn_parasite(
                    chunk=response["chunk"],
                    type=response["spawnType"]
                )

            # 4. Wait for next tick
            await asyncio.sleep(tick_interval)
```

---

## 6. Realism Considerations

### 6.1 Worker Behavior
- Don't just random walk - cluster at mining spots
- Flee realistically (not teleport, gradual movement)
- Return to mining after threat passes

### 6.2 Protector Behavior
- Patrol patterns (not random)
- Chase parasites within detection range
- Kill parasites within kill range

### 6.3 Resource Flow
- Mining rate depends on active workers
- Workers not mining (fleeing) = reduced rate
- This creates the feedback loop NN needs to learn

### 6.4 Parasite Lifecycle
- Spawn at queen's command (from NN)
- Survive based on protector positions
- Disrupt workers while alive
- Die when caught

---

## 7. Configuration

```yaml
# simulation_config.yaml

# Map
grid_size: 20  # 20x20 = 400 chunks
mining_spots: [45, 67, 123, 189, 234, 312, 378]  # Resource locations

# Workers
num_workers: 8
worker_speed: 1.0  # chunks per tick
flee_radius: 3  # chunks
flee_duration: 5  # ticks

# Protectors
num_protectors: 3
protector_speed: 1.5
detection_radius: 5
kill_radius: 2

# Queen
queen_start_energy: 50
queen_energy_regen: 0.5  # per tick
energy_parasite_cost: 15
combat_parasite_cost: 25

# Parasites
parasite_disruption_radius: 3

# Simulation
tick_interval: 0.1  # seconds
```

---

## 8. Directory Structure

```
server/
├── game_simulator/
│   ├── __init__.py
│   ├── config.py          # SimulationConfig dataclass
│   ├── entities.py        # Worker, Protector, Parasite classes
│   ├── state.py           # SimulatedGameState
│   ├── simulator.py       # Tick logic, state evolution
│   ├── observation.py     # Generate observations from state
│   └── runner.py          # WebSocket connection, main loop
```

---

## 9. Training Workflow

1. Start backend server (NN + Gate + Trainer)
2. Start simulator, connects via WebSocket
3. Simulator runs N ticks, sends observations
4. NN makes decisions, gate evaluates, trainer learns
5. Monitor dashboard for loss/reward curves
6. Tune simulation parameters if needed

---

## 10. Success Criteria

- [ ] Simulator produces valid observations (schema matches)
- [ ] NN trains on simulated data (loss decreases)
- [ ] Learned behavior transfers to real game
- [ ] Can run 10k+ iterations unattended

---

## 11. Design Decisions

### 11.1 Speed Strategy
- **Start real-time** (0.1s ticks) for debugging and visual inspection
- **Add turbo mode** - remove delays, run as fast as pipeline allows
- Bottleneck will likely be NN inference + training, not simulation
- Target: 100-1000x real-time speed in turbo mode

### 11.2 Single Territory
- No parallel territories for simplicity
- One simulation instance, one NN training

### 11.3 Curriculum Learning
- **Yes** - start simple, increase complexity
- Phase 1: Few workers, no protectors (learn basic spawning)
- Phase 2: Add protectors (learn avoidance)
- Phase 3: Dynamic workers, full game feel (learn timing)

### 11.4 Validation Strategy

Layered approach - don't over-engineer upfront:

| Level | Method | What it tells you |
|-------|--------|-------------------|
| **Sanity** | Visual inspection of chunk heatmaps | "Does it look like a game?" |
| **Statistical** | Compare distributions (worker density, protector spread) | "Are the numbers similar?" |
| **Behavioral** | Compare gate pass rates, avg rewards | "Does the gate react similarly?" |
| **Transfer test** | Train on sim, play real game, observe | "Does it actually work?" |

**Philosophy:** The real game IS the ultimate validator. Simulation just needs to be "close enough" that learned patterns transfer. Build simple, test in real game, tune if behavior is weird.

---

## 12. Next Steps

1. Create `server/game_simulator/` directory
2. Implement basic entities (Worker, Protector)
3. Implement state evolution (tick logic)
4. Generate observations
5. Connect to WebSocket
6. Test with live training
