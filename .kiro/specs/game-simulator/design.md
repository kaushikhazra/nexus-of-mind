# Game Simulator - Design

## Overview

This document describes the technical design for a lightweight game simulator that generates training observations. The simulator models game entities (workers, protectors, parasites) and their interactions, producing observations that match the frontend format exactly.

**Core Principle: Reuse Existing Pipeline**

The simulator connects via WebSocket and sends observations in the same format as the real game frontend. The backend cannot distinguish between real and simulated observations.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GAME SIMULATOR                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      SimulatedGameState                              │   │
│  │                                                                      │   │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │   │ Workers  │  │Protectors│  │ Parasites│  │  Queen   │           │   │
│  │   │  [W1]    │  │   [P1]   │  │   [X1]   │  │ energy   │           │   │
│  │   │  [W2]    │  │   [P2]   │  │   [X2]   │  │ chunk    │           │   │
│  │   │  [W3]    │  │   [P3]   │  │          │  │          │           │   │
│  │   │  ...     │  │          │  │          │  │          │           │   │
│  │   └──────────┘  └──────────┘  └──────────┘  └──────────┘           │   │
│  │                                                                      │   │
│  │   Resources: player_energy, player_minerals, rates                   │   │
│  │   Map: mining_spots, grid_size                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ tick()                                 │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Simulator                                    │   │
│  │                                                                      │   │
│  │   1. Move workers (flee or toward mining)                           │   │
│  │   2. Move protectors (patrol or chase)                              │   │
│  │   3. Check parasite kills                                           │   │
│  │   4. Update resource generation                                     │   │
│  │   5. Regenerate queen energy                                        │   │
│  │   6. Calculate rates                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ generate_observation()                 │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Observation Generator                             │   │
│  │                                                                      │   │
│  │   {                                                                  │   │
│  │     "territoryId": "sim-territory",                                 │   │
│  │     "chunks": { "45": { "workers": 3, ... }, ... },                 │   │
│  │     "queenEnergy": 50,                                              │   │
│  │     "playerEnergyStart": 100,                                       │   │
│  │     "playerEnergyEnd": 105,                                         │   │
│  │     ...                                                              │   │
│  │   }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     │ WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXISTING BACKEND                                   │
│                                                                             │
│   WebSocket ──► Message Handler ──► NN ──► Gate ──► Buffer ──► Trainer     │
│                                                                             │
│                        (Unchanged - thinks it's real game)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Entity Base Class

```python
from dataclasses import dataclass
from enum import Enum
from typing import Optional

@dataclass
class Entity:
    """Base class for all game entities."""
    chunk: int  # Current position (0-399)

    def distance_to(self, other_chunk: int) -> float:
        """Calculate chunk distance (Euclidean on 20x20 grid)."""
        x1, y1 = self.chunk % 20, self.chunk // 20
        x2, y2 = other_chunk % 20, other_chunk // 20
        return ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5

    def move_toward(self, target_chunk: int, speed: float = 1.0) -> None:
        """Move toward target chunk by speed."""
        # Implementation: calculate direction, move by speed
        pass

    def move_away_from(self, threat_chunk: int, speed: float = 1.0) -> None:
        """Move away from threat chunk by speed."""
        # Implementation: opposite of move_toward
        pass
```

### 2. Worker Entity

```python
class WorkerState(Enum):
    MINING = "mining"
    MOVING = "moving"
    FLEEING = "fleeing"

@dataclass
class Worker(Entity):
    """Worker entity that mines resources and flees from parasites."""
    target_chunk: int  # Mining spot destination
    state: WorkerState = WorkerState.MOVING
    flee_timer: int = 0  # Ticks remaining in flee state

    def update(self, parasites: List['Parasite'], config: 'SimulationConfig') -> float:
        """
        Update worker state and position.
        Returns resource generation (0 if not mining).
        """
        # Check for nearby parasites
        nearest_parasite = self._find_nearest_parasite(parasites)

        if nearest_parasite and self.distance_to(nearest_parasite.chunk) < config.flee_radius:
            # Enter or continue fleeing
            self.state = WorkerState.FLEEING
            self.flee_timer = config.flee_duration
            self.move_away_from(nearest_parasite.chunk, config.worker_speed)
            return 0.0

        if self.flee_timer > 0:
            # Still fleeing
            self.flee_timer -= 1
            self.state = WorkerState.FLEEING
            return 0.0

        if self.chunk == self.target_chunk:
            # At mining spot - generate resources
            self.state = WorkerState.MINING
            return config.mining_rate

        # Moving toward mining spot
        self.state = WorkerState.MOVING
        self.move_toward(self.target_chunk, config.worker_speed)
        return 0.0
```

### 3. Protector Entity

```python
class ProtectorState(Enum):
    PATROLLING = "patrolling"
    CHASING = "chasing"

@dataclass
class Protector(Entity):
    """Protector entity that patrols and chases parasites."""
    patrol_path: List[int]  # Chunks to visit
    patrol_index: int = 0
    state: ProtectorState = ProtectorState.PATROLLING
    chase_target: Optional['Parasite'] = None

    def update(self, parasites: List['Parasite'], config: 'SimulationConfig') -> Optional['Parasite']:
        """
        Update protector state and position.
        Returns killed parasite (if any).
        """
        # Look for parasites to chase
        if self.state == ProtectorState.PATROLLING:
            for parasite in parasites:
                if self.distance_to(parasite.chunk) < config.detection_radius:
                    self.state = ProtectorState.CHASING
                    self.chase_target = parasite
                    break

        if self.state == ProtectorState.CHASING:
            if self.chase_target is None or self.chase_target not in parasites:
                # Target gone, return to patrol
                self.state = ProtectorState.PATROLLING
                self.chase_target = None
            else:
                # Move toward target
                self.move_toward(self.chase_target.chunk, config.protector_speed)

                # Check for kill
                if self.distance_to(self.chase_target.chunk) < config.kill_radius:
                    killed = self.chase_target
                    self.state = ProtectorState.PATROLLING
                    self.chase_target = None
                    return killed

        if self.state == ProtectorState.PATROLLING:
            # Move along patrol path
            target = self.patrol_path[self.patrol_index]
            if self.chunk == target:
                self.patrol_index = (self.patrol_index + 1) % len(self.patrol_path)
                target = self.patrol_path[self.patrol_index]
            self.move_toward(target, config.protector_speed)

        return None
```

### 4. Parasite Entity

```python
@dataclass
class Parasite(Entity):
    """Parasite entity spawned by queen."""
    type: str  # 'energy' or 'combat'
    spawn_time: int  # Tick when spawned

    def get_disruption_chunks(self, config: 'SimulationConfig') -> List[int]:
        """Get chunks within disruption radius."""
        chunks = []
        for dx in range(-config.disruption_radius, config.disruption_radius + 1):
            for dy in range(-config.disruption_radius, config.disruption_radius + 1):
                if dx * dx + dy * dy <= config.disruption_radius ** 2:
                    x = self.chunk % 20 + dx
                    y = self.chunk // 20 + dy
                    if 0 <= x < 20 and 0 <= y < 20:
                        chunks.append(y * 20 + x)
        return chunks
```

### 5. Simulated Game State

```python
@dataclass
class SimulatedGameState:
    """Complete game state for simulation."""
    # Entities
    workers: List[Worker]
    protectors: List[Protector]
    parasites: List[Parasite]

    # Queen
    queen_energy: float
    queen_chunk: int

    # Resources
    player_energy: float
    player_minerals: float
    player_energy_prev: float  # For rate calculation
    player_minerals_prev: float

    # Map
    mining_spots: List[int]

    # Tick counter
    tick: int = 0

    @classmethod
    def create_initial(cls, config: 'SimulationConfig') -> 'SimulatedGameState':
        """Create initial game state from config."""
        workers = [
            Worker(
                chunk=spot,
                target_chunk=spot
            )
            for spot in config.mining_spots[:config.num_workers]
        ]

        protectors = [
            Protector(
                chunk=config.queen_chunk,
                patrol_path=cls._generate_patrol_path(i, config)
            )
            for i in range(config.num_protectors)
        ]

        return cls(
            workers=workers,
            protectors=protectors,
            parasites=[],
            queen_energy=config.queen_start_energy,
            queen_chunk=config.queen_chunk,
            player_energy=config.player_start_energy,
            player_minerals=config.player_start_minerals,
            player_energy_prev=config.player_start_energy,
            player_minerals_prev=config.player_start_minerals,
            mining_spots=config.mining_spots,
        )
```

### 6. Simulator (Tick Logic)

```python
class Simulator:
    """Main simulation logic."""

    def __init__(self, config: SimulationConfig):
        self.config = config
        self.state = SimulatedGameState.create_initial(config)

    def tick(self) -> None:
        """Execute one simulation tick."""
        # Save previous values for rate calculation
        self.state.player_energy_prev = self.state.player_energy
        self.state.player_minerals_prev = self.state.player_minerals

        # 1. Update workers
        total_mining = 0.0
        for worker in self.state.workers:
            mining = worker.update(self.state.parasites, self.config)
            total_mining += mining

        # 2. Update protectors and check kills
        killed_parasites = []
        for protector in self.state.protectors:
            killed = protector.update(self.state.parasites, self.config)
            if killed:
                killed_parasites.append(killed)

        # 3. Remove killed parasites
        for parasite in killed_parasites:
            self.state.parasites.remove(parasite)

        # 4. Update resources
        self.state.player_energy += total_mining * self.config.energy_per_mining
        self.state.player_minerals += total_mining * self.config.minerals_per_mining

        # 5. Regenerate queen energy
        self.state.queen_energy = min(
            self.config.queen_max_energy,
            self.state.queen_energy + self.config.queen_energy_regen
        )

        # 6. Increment tick
        self.state.tick += 1

    def spawn_parasite(self, chunk: int, parasite_type: str) -> bool:
        """
        Spawn a parasite at the given chunk.
        Returns True if successful, False if insufficient energy.
        """
        cost = (
            self.config.energy_parasite_cost
            if parasite_type == 'energy'
            else self.config.combat_parasite_cost
        )

        if self.state.queen_energy < cost:
            return False

        self.state.queen_energy -= cost
        self.state.parasites.append(Parasite(
            chunk=chunk,
            type=parasite_type,
            spawn_time=self.state.tick
        ))
        return True
```

### 7. Observation Generator

```python
def generate_observation(state: SimulatedGameState) -> dict:
    """Generate observation matching frontend format."""
    # Count entities per chunk
    chunk_data = {}

    for worker in state.workers:
        chunk_str = str(worker.chunk)
        if chunk_str not in chunk_data:
            chunk_data[chunk_str] = {"workers": 0, "protectors": 0, "energyParasites": 0, "combatParasites": 0}
        chunk_data[chunk_str]["workers"] += 1

    for protector in state.protectors:
        chunk_str = str(protector.chunk)
        if chunk_str not in chunk_data:
            chunk_data[chunk_str] = {"workers": 0, "protectors": 0, "energyParasites": 0, "combatParasites": 0}
        chunk_data[chunk_str]["protectors"] += 1

    for parasite in state.parasites:
        chunk_str = str(parasite.chunk)
        if chunk_str not in chunk_data:
            chunk_data[chunk_str] = {"workers": 0, "protectors": 0, "energyParasites": 0, "combatParasites": 0}
        if parasite.type == "energy":
            chunk_data[chunk_str]["energyParasites"] += 1
        else:
            chunk_data[chunk_str]["combatParasites"] += 1

    return {
        "territoryId": "sim-territory",
        "aiPlayer": 1,
        "tick": state.tick,
        "chunks": chunk_data,
        "queenEnergy": state.queen_energy,
        "playerEnergyStart": state.player_energy_prev,
        "playerEnergyEnd": state.player_energy,
        "playerMineralsStart": state.player_minerals_prev,
        "playerMineralsEnd": state.player_minerals,
        "hiveChunk": state.queen_chunk,
    }
```

### 8. Simulation Runner

```python
import asyncio
import websockets
import json

class SimulationRunner:
    """Orchestrates simulation and WebSocket communication."""

    def __init__(self, config: SimulationConfig):
        self.config = config
        self.simulator = Simulator(config)
        self.ws = None

    async def connect(self, url: str = "ws://localhost:8000/ws"):
        """Connect to backend WebSocket."""
        self.ws = await websockets.connect(url)

    async def run(self, num_ticks: int):
        """Run simulation for specified ticks."""
        for tick in range(num_ticks):
            # 1. Evolve game state
            self.simulator.tick()

            # 2. Generate and send observation
            obs = generate_observation(self.simulator.state)
            await self.ws.send(json.dumps({
                "type": "nn_observation",
                "data": obs
            }))

            # 3. Receive NN decision
            response = await self.ws.recv()
            data = json.loads(response)

            # 4. Execute spawn if decision was SEND
            if data.get("action") == "spawn":
                self.simulator.spawn_parasite(
                    chunk=data["spawnChunk"],
                    parasite_type=data["spawnType"]
                )

            # 5. Wait for next tick (skip in turbo mode)
            if not self.config.turbo_mode:
                await asyncio.sleep(self.config.tick_interval)

    async def close(self):
        """Close WebSocket connection."""
        if self.ws:
            await self.ws.close()
```

## Directory Structure

```
server/
├── game_simulator/
│   ├── __init__.py
│   ├── config.py          # SimulationConfig dataclass
│   ├── entities.py        # Worker, Protector, Parasite, Entity base
│   ├── state.py           # SimulatedGameState
│   ├── simulator.py       # Tick logic
│   ├── observation.py     # Generate observations from state
│   ├── runner.py          # WebSocket connection, main loop
│   └── curriculum.py      # Curriculum learning phases
├── game_simulator_configs/
│   └── default.yaml       # Default simulation config
```

## Configuration Schema

```yaml
# default.yaml

# Map
grid_size: 20
queen_chunk: 200  # Center of map
mining_spots: [45, 67, 123, 189, 234, 312, 378]

# Workers
num_workers: 8
worker_speed: 1.0
flee_radius: 3
flee_duration: 5
mining_rate: 1.0

# Protectors
num_protectors: 3
protector_speed: 1.5
detection_radius: 5
kill_radius: 2

# Queen
queen_start_energy: 50
queen_max_energy: 100
queen_energy_regen: 0.5
energy_parasite_cost: 15
combat_parasite_cost: 25

# Parasites
disruption_radius: 3

# Resources
player_start_energy: 100
player_start_minerals: 50
energy_per_mining: 0.5
minerals_per_mining: 0.3

# Simulation
tick_interval: 0.1
turbo_mode: false

# Curriculum (optional)
curriculum:
  enabled: true
  phases:
    - name: "basic"
      duration: 1000
      num_workers: 4
      num_protectors: 0
    - name: "with_protectors"
      duration: 2000
      num_workers: 6
      num_protectors: 2
    - name: "full"
      duration: -1  # Run indefinitely
      num_workers: 8
      num_protectors: 3
```

## WebSocket Message Format

### Outgoing (Simulator → Backend)

```json
{
  "type": "nn_observation",
  "data": {
    "territoryId": "sim-territory",
    "aiPlayer": 1,
    "tick": 1234,
    "chunks": {
      "45": {"workers": 3, "protectors": 0, "energyParasites": 0, "combatParasites": 0},
      "67": {"workers": 2, "protectors": 1, "energyParasites": 0, "combatParasites": 0}
    },
    "queenEnergy": 45.5,
    "playerEnergyStart": 100.0,
    "playerEnergyEnd": 102.5,
    "playerMineralsStart": 50.0,
    "playerMineralsEnd": 51.5,
    "hiveChunk": 200
  }
}
```

### Incoming (Backend → Simulator)

```json
{
  "action": "spawn",
  "spawnChunk": 67,
  "spawnType": "energy",
  "confidence": 0.85
}
```

Or if WAIT decision:

```json
{
  "action": "wait",
  "reason": "negative_reward"
}
```

## Curriculum Learning Design

```python
@dataclass
class CurriculumPhase:
    """Configuration for a curriculum phase."""
    name: str
    duration: int  # Ticks (-1 for infinite)
    num_workers: int
    num_protectors: int

class CurriculumManager:
    """Manages curriculum learning progression."""

    def __init__(self, phases: List[CurriculumPhase]):
        self.phases = phases
        self.current_phase_index = 0
        self.ticks_in_phase = 0

    def get_current_phase(self) -> CurriculumPhase:
        return self.phases[self.current_phase_index]

    def tick(self) -> Optional[CurriculumPhase]:
        """
        Advance tick counter.
        Returns new phase if transition occurred, None otherwise.
        """
        self.ticks_in_phase += 1
        current = self.get_current_phase()

        if current.duration > 0 and self.ticks_in_phase >= current.duration:
            if self.current_phase_index < len(self.phases) - 1:
                self.current_phase_index += 1
                self.ticks_in_phase = 0
                return self.get_current_phase()

        return None
```
