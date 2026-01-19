# Simulation-Gated Inference - Technical Design

## Overview

This document describes the technical implementation of the simulation-gated inference system. The core concept is a mathematical cost function that predicts expected rewards using known game dynamics, enabling the NN to learn faster by receiving immediate feedback from simulation rather than waiting for real game outcomes.

## Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Python)                             │
│                                                                           │
│    ┌────────────────────────────────────────────────────────────────┐    │
│    │                     THINKING LOOP                               │    │
│    │                                                                 │    │
│    │   ┌──────────┐      ┌────────────┐      ┌─────────────────┐    │    │
│    │   │    NN    │─────▶│    Cost    │─────▶│   Reward > θ?   │    │    │
│    │   │ Inference│      │  Function  │      │                 │    │    │
│    │   └──────────┘      │(Simulation)│      └────────┬────────┘    │    │
│    │        ▲            └────────────┘               │             │    │
│    │        │                                         │             │    │
│    │        │  Train                       ┌──────────┴──────────┐  │    │
│    │        │  + Wait                      │                     │  │    │
│    │        │                              ▼                     ▼  │    │
│    │        │                         ┌────────┐            ┌───────┴───┐│
│    │        └─────────────────────────│ WAIT   │            │   SEND    ││
│    │            (next observation)    │(Train) │            │(Execute)  ││
│    │                                  └────────┘            └─────┬─────┘│
│    │                                                              │      │
│    └──────────────────────────────────────────────────────────────┼──────┘
│                                                                   │       │
│                                          ┌────────────────────────┘       │
│                                          ▼                                │
│                               ┌─────────────────────┐                     │
│                               │ Send to Frontend    │                     │
│                               │ + Train on Real     │                     │
│                               └──────────┬──────────┘                     │
└──────────────────────────────────────────┼────────────────────────────────┘
                                           │
               ▲                           ▼
  Observation  │                 ┌─────────────────────┐
  (continuous) │                 │  Execute Spawn      │
               │                 │  (Real Game)        │
               │                 └─────────────────────┘
┌──────────────┴────────────────────────────────────────────────────────────┐
│                              FRONTEND                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

## Mathematical Formulation

### 1. Input Representation

Given observation `O` and proposed action `A`:

```python
O = {
    protector_chunks: List[int],     # Protector positions as chunk IDs
    worker_chunks: List[int],        # Worker positions as chunk IDs
    hive_chunk: int,                 # Queen/territory center chunk
    queen_energy: float,             # Current Queen energy
    spawn_costs: Dict[str, float]    # Cost per parasite type
}

A = {
    spawn_chunk: int,                # Target chunk (0-399 for 20×20 grid)
    spawn_type: str                  # 'energy' or 'combat'
}
```

### 2. Chunk Distance Calculation

Convert chunk IDs to grid coordinates and calculate Euclidean distance:

```python
def chunk_to_coords(chunk_id: int, chunks_per_axis: int = 20) -> Tuple[int, int]:
    x = chunk_id % chunks_per_axis
    z = chunk_id // chunks_per_axis
    return (x, z)

def chunk_distance(chunk1: int, chunk2: int) -> float:
    x1, z1 = chunk_to_coords(chunk1)
    x2, z2 = chunk_to_coords(chunk2)
    return sqrt((x1 - x2)² + (z1 - z2)²)

# Maximum distance on 20×20 grid: sqrt(19² + 19²) = 26.87
MAX_DISTANCE = 26.87
```

### 3. Survival Probability

Estimate probability that spawned parasite survives observation window:

```
P_survival(c_s, O) = ∏ᵢ (1 - threat_factor(c_s, pᵢ))

where threat_factor(c_s, pᵢ) = {
    1.0                           if d(c_s, pᵢ) < R_kill
    exp(-λ × (d(c_s, pᵢ) - R_kill))  if R_kill ≤ d < R_safe
    0.0                           if d(c_s, pᵢ) ≥ R_safe
}

Parameters:
    R_kill = 2.0 chunks (protector kill zone)
    R_safe = 8.0 chunks (beyond threat range)
    λ = 0.5 (threat decay rate)
```

**PyTorch Implementation:**

```python
def calculate_survival_probability(
    spawn_chunk: torch.Tensor,      # [B]
    protector_chunks: torch.Tensor, # [B, P]
    config: SimulationGateConfig
) -> torch.Tensor:                  # [B]

    # Calculate distances to all protectors
    spawn_coords = chunk_to_coords_batch(spawn_chunk)         # [B, 2]
    protector_coords = chunk_to_coords_batch(protector_chunks) # [B, P, 2]

    # Euclidean distance
    diff = spawn_coords.unsqueeze(1) - protector_coords  # [B, P, 2]
    distances = torch.norm(diff, dim=2)                   # [B, P]

    # Threat factor calculation
    in_kill_zone = distances < config.kill_range
    in_threat_zone = (distances >= config.kill_range) & (distances < config.safe_range)

    threat = torch.zeros_like(distances)
    threat[in_kill_zone] = 1.0
    threat[in_threat_zone] = torch.exp(
        -config.threat_decay * (distances[in_threat_zone] - config.kill_range)
    )

    # Survival = product of (1 - threat) across all protectors
    survival = torch.prod(1 - threat, dim=1)  # [B]

    return survival
```

### 4. Worker Disruption Potential

Estimate mining disruption caused by spawn:

```
D_workers(c_s, O) = P_survival × Σᵢ disruption(c_s, wᵢ)

where disruption(c_s, wᵢ) = {
    1.0                           if d(c_s, wᵢ) < R_flee
    exp(-μ × (d(c_s, wᵢ) - R_flee))  if R_flee ≤ d < R_ignore
    0.0                           if d(c_s, wᵢ) ≥ R_ignore
}

Parameters:
    R_flee = 3.0 chunks (worker flee range)
    R_ignore = 10.0 chunks (beyond effect range)
    μ = 0.3 (disruption decay rate)
```

**PyTorch Implementation:**

```python
def calculate_worker_disruption(
    spawn_chunk: torch.Tensor,      # [B]
    worker_chunks: torch.Tensor,    # [B, W]
    survival_prob: torch.Tensor,    # [B]
    config: SimulationGateConfig
) -> torch.Tensor:                  # [B]

    # Calculate distances to all workers
    spawn_coords = chunk_to_coords_batch(spawn_chunk)     # [B, 2]
    worker_coords = chunk_to_coords_batch(worker_chunks)  # [B, W, 2]

    diff = spawn_coords.unsqueeze(1) - worker_coords  # [B, W, 2]
    distances = torch.norm(diff, dim=2)               # [B, W]

    # Disruption calculation
    in_flee_zone = distances < config.flee_range
    in_effect_zone = (distances >= config.flee_range) & (distances < config.ignore_range)

    disruption = torch.zeros_like(distances)
    disruption[in_flee_zone] = 1.0
    disruption[in_effect_zone] = torch.exp(
        -config.disruption_decay * (distances[in_effect_zone] - config.flee_range)
    )

    # Sum disruption and scale by survival probability
    total_disruption = torch.sum(disruption, dim=1) * survival_prob  # [B]

    return total_disruption
```

### 5. Spawn Location Penalty

Penalize spawning far from strategic targets:

```
L_location(c_s, O) = {
    -α × norm_dist(c_s, c_hive)           if |workers| = 0  (IDLE mode)
    -β × min_dist(c_s, worker_chunks)     if |workers| > 0  (ACTIVE mode)
}

Parameters:
    α = 0.3 (hive proximity penalty weight)
    β = 0.4 (worker proximity penalty weight)
```

**PyTorch Implementation:**

```python
def calculate_location_penalty(
    spawn_chunk: torch.Tensor,      # [B]
    hive_chunk: torch.Tensor,       # [B]
    worker_chunks: torch.Tensor,    # [B, W]
    worker_count: torch.Tensor,     # [B]
    config: SimulationGateConfig
) -> torch.Tensor:                  # [B]

    spawn_coords = chunk_to_coords_batch(spawn_chunk)     # [B, 2]
    hive_coords = chunk_to_coords_batch(hive_chunk)       # [B, 2]
    worker_coords = chunk_to_coords_batch(worker_chunks)  # [B, W, 2]

    # Distance to hive (normalized)
    hive_distance = torch.norm(spawn_coords - hive_coords, dim=1) / MAX_DISTANCE  # [B]

    # Distance to nearest worker (normalized)
    worker_diff = spawn_coords.unsqueeze(1) - worker_coords  # [B, W, 2]
    worker_distances = torch.norm(worker_diff, dim=2)        # [B, W]
    min_worker_distance = torch.min(worker_distances, dim=1).values / MAX_DISTANCE  # [B]

    # Mode selection
    is_idle = (worker_count == 0).float()  # [B]
    is_active = 1 - is_idle                # [B]

    # Calculate penalty based on mode
    penalty = (
        is_idle * (-config.hive_proximity_weight * hive_distance) +
        is_active * (-config.worker_proximity_weight * min_worker_distance)
    )

    return penalty  # [B]
```

### 6. Spawn Capacity Validation

Binary check if spawn is affordable:

```
V_capacity(type, energy) = {
    1.0    if energy ≥ spawn_cost[type]
    -∞     otherwise (action invalid)
}
```

**PyTorch Implementation:**

```python
def validate_spawn_capacity(
    spawn_type: torch.Tensor,       # [B] (0=energy, 1=combat)
    queen_energy: torch.Tensor,     # [B]
    config: SimulationGateConfig
) -> torch.Tensor:                  # [B]

    spawn_costs = torch.tensor([
        config.energy_parasite_cost,  # 15
        config.combat_parasite_cost   # 25
    ])

    required_energy = spawn_costs[spawn_type.long()]  # [B]
    can_afford = (queen_energy >= required_energy).float()  # [B]

    # Return 1.0 if affordable, -inf otherwise
    return torch.where(can_afford > 0, can_afford, torch.tensor(float('-inf')))
```

### 7. Combined Cost Function

Combine all components into single expected reward:

```
R_expected(A, O) = V_capacity × (
    w₁ × P_survival +
    w₂ × D_workers +
    w₃ × L_location
) + exploration_bonus

Parameters:
    w₁ = 0.4 (survival weight)
    w₂ = 0.5 (disruption weight)
    w₃ = 0.1 (location weight)
```

**Complete PyTorch Implementation:**

```python
class SimulationCostFunction:
    def __init__(self, config: SimulationGateConfig):
        self.config = config
        self.last_spawn_time: Dict[int, float] = {}  # chunk -> timestamp

    def calculate_expected_reward(
        self,
        observation: ObservationTensor,
        action: ActionTensor,
        current_time: float
    ) -> torch.Tensor:
        """
        Calculate expected reward for proposed action.

        Returns: [B] tensor of expected rewards
        """
        # 1. Survival probability
        p_survival = calculate_survival_probability(
            action.spawn_chunk,
            observation.protector_chunks,
            self.config
        )

        # 2. Worker disruption
        d_workers = calculate_worker_disruption(
            action.spawn_chunk,
            observation.worker_chunks,
            p_survival,
            self.config
        )

        # 3. Location penalty
        l_location = calculate_location_penalty(
            action.spawn_chunk,
            observation.hive_chunk,
            observation.worker_chunks,
            observation.worker_count,
            self.config
        )

        # 4. Capacity validation
        v_capacity = validate_spawn_capacity(
            action.spawn_type,
            observation.queen_energy,
            self.config
        )

        # 5. Exploration bonus
        exploration = self._calculate_exploration_bonus(
            action.spawn_chunk,
            current_time
        )

        # 6. Combined reward
        base_reward = (
            self.config.survival_weight * p_survival +
            self.config.disruption_weight * d_workers +
            self.config.location_weight * l_location
        )

        expected_reward = v_capacity * base_reward + exploration

        return expected_reward

    def _calculate_exploration_bonus(
        self,
        spawn_chunk: torch.Tensor,
        current_time: float
    ) -> torch.Tensor:
        """Add bonus for unexplored chunks"""
        bonuses = []
        for chunk in spawn_chunk.tolist():
            last_spawn = self.last_spawn_time.get(chunk, 0)
            time_since = current_time - last_spawn
            normalized = min(1.0, time_since / self.config.exploration_max_time)
            bonus = self.config.exploration_coefficient * normalized
            bonuses.append(bonus)

        return torch.tensor(bonuses)
```

### 8. Simulation Gate

Decision gate that allows/blocks actions:

```python
class SimulationGate:
    def __init__(self, config: SimulationGateConfig):
        self.config = config
        self.cost_function = SimulationCostFunction(config)

    def evaluate(
        self,
        observation: ObservationTensor,
        action: ActionTensor,
        nn_confidence: float,
        current_time: float
    ) -> GateDecision:
        """
        Evaluate proposed action and decide SEND or WAIT.
        """
        # Calculate expected reward
        expected_reward = self.cost_function.calculate_expected_reward(
            observation, action, current_time
        )

        # Check confidence override
        if nn_confidence > self.config.confidence_threshold:
            return GateDecision(
                decision='SEND',
                reason='confidence_override',
                expected_reward=expected_reward.item(),
                nn_confidence=nn_confidence
            )

        # Check reward threshold
        if expected_reward > self.config.reward_threshold:
            return GateDecision(
                decision='SEND',
                reason='positive_reward',
                expected_reward=expected_reward.item(),
                nn_confidence=nn_confidence
            )
        else:
            return GateDecision(
                decision='WAIT',
                reason='negative_reward',
                expected_reward=expected_reward.item(),
                nn_confidence=nn_confidence
            )
```

### 9. Thinking Loop Integration

Integration with existing message handler:

```python
async def handle_observation(
    self,
    observation_data: Dict[str, Any],
    nn_model: QueenNNModel,
    simulation_gate: SimulationGate,
    trainer: ContinuousTrainer
):
    """
    Process observation through thinking loop.
    """
    # Extract features
    features = self.feature_extractor.extract(observation_data)

    # NN inference
    inference = nn_model.forward(features)
    action = Action(
        spawn_chunk=inference.chunk_argmax,
        spawn_type=inference.type_decision
    )

    # Simulation gate evaluation
    gate_decision = simulation_gate.evaluate(
        observation=features,
        action=action,
        nn_confidence=inference.confidence,
        current_time=time.time()
    )

    # Log decision
    logger.info(f"[SimGate] {gate_decision.decision}: "
                f"chunk={action.spawn_chunk}, "
                f"expected_reward={gate_decision.expected_reward:.3f}, "
                f"confidence={gate_decision.nn_confidence:.3f}, "
                f"reason={gate_decision.reason}")

    if gate_decision.decision == 'SEND':
        # Execute action in real game
        await self.send_spawn_decision(action)

        # Train on actual outcome (next observation will provide real reward)
        self.pending_real_feedback = {
            'action': action,
            'expected_reward': gate_decision.expected_reward
        }
    else:
        # Train on simulation feedback immediately
        trainer.train_step(
            features=features,
            reward=gate_decision.expected_reward
        )
```

## Configuration

### Default Configuration

```python
@dataclass
class SimulationGateConfig:
    # Survival probability parameters
    kill_range: float = 2.0          # Chunks - protector instant kill zone
    safe_range: float = 8.0          # Chunks - beyond threat
    threat_decay: float = 0.5        # Exponential decay rate

    # Worker disruption parameters
    flee_range: float = 3.0          # Chunks - worker flee zone
    ignore_range: float = 10.0       # Chunks - beyond effect
    disruption_decay: float = 0.3    # Exponential decay rate

    # Location penalty parameters
    hive_proximity_weight: float = 0.3
    worker_proximity_weight: float = 0.4

    # Spawn costs
    energy_parasite_cost: float = 15.0
    combat_parasite_cost: float = 25.0

    # Combined weights
    survival_weight: float = 0.4
    disruption_weight: float = 0.5
    location_weight: float = 0.1

    # Gate threshold
    reward_threshold: float = 0.0

    # Exploration bonus
    exploration_coefficient: float = 0.2
    exploration_max_time: float = 300.0  # 5 minutes

    # Confidence override
    confidence_threshold: float = 0.8
```

### Configuration File Location

```
server/ai_engine/configs/simulation_gate.yaml
```

## File Structure

```
server/ai_engine/
├── simulation/
│   ├── __init__.py
│   ├── cost_function.py        # SimulationCostFunction class
│   ├── gate.py                 # SimulationGate class
│   ├── components/
│   │   ├── survival.py         # calculate_survival_probability
│   │   ├── disruption.py       # calculate_worker_disruption
│   │   ├── location.py         # calculate_location_penalty
│   │   └── exploration.py      # calculate_exploration_bonus
│   └── config.py               # SimulationGateConfig
├── configs/
│   └── simulation_gate.yaml    # Default configuration
└── websocket/
    └── message_handler.py      # Updated with thinking loop
```

## Logging Format

### Gate Decision Log

```json
{
  "timestamp": "2026-01-20T00:10:15.123",
  "level": "INFO",
  "logger": "ai_engine.simulation.gate",
  "message": "[SimGate] SEND: chunk=145, expected_reward=0.342, confidence=0.85, reason=positive_reward",
  "data": {
    "decision": "SEND",
    "spawn_chunk": 145,
    "spawn_type": "energy",
    "expected_reward": 0.342,
    "components": {
      "survival": 0.85,
      "disruption": 0.45,
      "location": -0.12,
      "exploration": 0.05
    },
    "nn_confidence": 0.85,
    "reason": "positive_reward"
  }
}
```

### Thinking Loop Statistics

```json
{
  "timestamp": "2026-01-20T00:10:30.456",
  "level": "INFO",
  "logger": "ai_engine.simulation.gate",
  "message": "[ThinkingLoop] Statistics: observations=5, time=75s, gate_pass_rate=0.20",
  "data": {
    "observations_since_last_action": 5,
    "time_since_last_action": 75.2,
    "gate_pass_rate": 0.20,
    "average_expected_reward": -0.15,
    "confidence_overrides": 0
  }
}
```
