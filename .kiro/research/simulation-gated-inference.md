# Simulation-Gated Inference

## Research Document
**Created:** 2026-01-19
**Branch:** feature/simulation-gated-inference
**Status:** Research & Design Phase

---

## 1. Overview

### The Problem
The Queen Neural Network makes spawning decisions based on observations, but it doesn't know if an action will succeed before executing it. Bad decisions (spawning in dangerous areas, far from objectives) only get penalized AFTER the real game shows negative outcomes - 15+ seconds later.

### The Solution
**Simulation-Gated Inference** - Use a mathematical cost function that simulates game dynamics to evaluate NN inferences BEFORE they reach the real game. Only actions that pass the simulation gate (positive expected reward) are executed.

### Key Insight
The game dynamics are deterministic and known. We don't need to learn a "world model" - we can encode the game rules directly as a cost function. This cost function becomes the "gatekeeper" that validates NN decisions.

---

## 2. Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Python)                             │
│                                                                           │
│    ┌────────────────────────────────────────────────────────────────┐     │
│    │                     THINKING LOOP                              │     │
│    │                                                                │     │
│    │   ┌──────────┐      ┌────────────┐      ┌─────────────────┐    │     │
│    │   │    NN    │─────▶│    Cost    │─────▶│   Reward > 0?   │   │     │
│    │   │ Inference│      │  Function  │      │                 │    │     │
│    │   └──────────┘      │(Simulation)│      └────────┬────────┘    │     │
│    │        ▲            └────────────┘               │             │     │
│    │        │                                         │             │     │
│    │        │  Backprop                    ┌──────────┴──────────┐  │     │
│    │        │  + Re-infer                  │                     │  │     │
│    │        │                              ▼                     ▼  │     │
│    │        │                         ┌────────┐            ┌───────┴───┐ │
│    │        └─────────────────────────│PENALTY │            │  REWARD   │ │
│    │            (wait for next obs)   │ (Wait) │            │  (Send)   │ │
│    │                                  └────────┘            └─────┬─────┘ │
│    │                                                              │       │
│    └──────────────────────────────────────────────────────────────┼───────┘
│                                                                   │        │
│                                          ┌────────────────────────┘        │
│                                          ▼                                 │
│                               ┌─────────────────────┐                      │
│                               │ Send to Frontend    │                      │
│                               │ + Positive Feedback │                      │
│                               └──────────┬──────────┘                      │
└──────────────────────────────────────────┼─────────────────────────────────┘
                                           │
               ▲                           ▼
  Observation  │                 ┌─────────────────────┐
  (continuous) │                 │  Execute Spawn      │
               │                 │  (Real Game)        │
               │                 └─────────────────────┘
┌──────────────┴─────────────────────────────────────────────────────────────┐
│                              FRONTEND                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

### Flow Description

1. **Frontend** continuously sends observations (every frame or at intervals)
2. **NN** processes observation, produces inference (spawn_chunk, spawn_type)
3. **Cost Function** evaluates inference against simulated game dynamics
4. **If PENALTY**:
   - Don't send to frontend
   - Provide negative feedback to NN
   - Wait for next observation (game state evolves)
   - NN re-infers with fresh data
5. **If REWARD**:
   - Send decision to frontend for execution
   - Provide positive feedback to NN

### Key Property: Non-Closed Loop
The NN does NOT loop on stale data. Each inference uses the LATEST observation from the continuously updating game state. This means:
- The game evolves while NN is "thinking"
- Each attempt reflects current reality
- NN learns game dynamics implicitly through observation changes

---

## 3. Cost Function (Mathematical Formulation)

The cost function predicts expected reward without executing the action. Designed for **math co-processor** execution (GPU/TPU-friendly matrix operations).

### Input Vector

Given observation `O` and proposed action `A = (chunk_s, type_s)`:

```
O = {
    protector_positions: [(x₁,z₁), (x₂,z₂), ...],  // P protectors
    worker_positions: [(x₁,z₁), (x₂,z₂), ...],     // W workers
    hive_chunk: c_h,                                 // Hive location
    queen_energy: e_q,                               // Spawn capacity
    parasite_positions: [(x₁,z₁,type), ...]         // Existing parasites
}

A = {
    spawn_chunk: c_s,    // Target chunk (0-399 for 20x20 grid)
    spawn_type: t_s      // 'energy' or 'combat'
}
```

### 3.1 Survival Probability

Estimate probability parasite survives the observation window.

```
P_survival(c_s, O) = ∏ᵢ (1 - threat_factor(c_s, pᵢ))

where:
    threat_factor(c_s, pᵢ) = {
        1.0                           if d(c_s, pᵢ) < R_kill
        exp(-λ · (d(c_s, pᵢ) - R_kill))  if d(c_s, pᵢ) ≥ R_kill
        0.0                           if d(c_s, pᵢ) > R_safe
    }

    d(c_s, pᵢ) = chunk distance to protector i
    R_kill = protector kill range (chunks)
    R_safe = safe distance threshold (chunks)
    λ = threat decay rate
```

**Matrix Form (GPU-friendly):**
```
D = distance_matrix(c_s, protector_chunks)  // [1 x P] vector
T = threat_function(D, R_kill, R_safe, λ)   // element-wise
P_survival = prod(1 - T)                     // scalar
```

### 3.2 Energy Drain Potential

Estimate energy drained if parasite survives.

```
E_drain(c_s, t_s, O) = P_survival · drain_rate(t_s) · proximity_bonus(c_s)

where:
    drain_rate(t_s) = {
        r_energy    if t_s = 'energy'
        r_combat    if t_s = 'combat'
    }

    proximity_bonus(c_s) = 1 / (1 + d(c_s, player_base))
```

### 3.3 Worker Disruption Potential

Estimate combat effectiveness based on reachable targets vs threats.

**Key Game Mechanics:**
- Energy Parasite: pursuit range 60 units, feeding range 3 units
- Combat Parasite: pursuit range 75 units
- Protector attack range: 12 units
- Workers only flee when energy < 40% AND being fed upon (not proximity-based)

**Energy Parasite Formula:**
```
D_energy(c_s, O) = (W_reachable - P_threatening) / W_total

where:
    W_reachable = workers within 60 units of spawn location
    P_threatening = protectors within 12 units (can kill parasite)
    W_total = total workers in the chunk

Properties:
    - Range: [-1.0, 1.0]
    - Positive: more reachable workers than threatening protectors
    - Negative: protectors outnumber targets (dangerous spawn)
    - Zero: balanced or no targets
```

**Combat Parasite Formula:**
```
D_combat(c_s, O) = (W_reachable + P_reachable) / (W_total + P_total)

where:
    W_reachable = workers within 75 units of spawn location
    P_reachable = protectors within 75 units (combat targets protectors too)
    W_total = total workers in the chunk
    P_total = total protectors in the chunk

Properties:
    - Range: [0.0, 1.0]
    - Combat parasites treat protectors as valid targets, not threats
    - Higher value = more total targets reachable
```

**Combined Disruption:**
```
D_workers(c_s, t_s, O) = {
    D_energy(c_s, O)   if t_s = 'energy'
    D_combat(c_s, O)   if t_s = 'combat'
}
```

**Matrix Form:**
```
// Energy parasite
dist_to_workers = distance_matrix(spawn_pos, worker_positions)      // [1 x W]
dist_to_protectors = distance_matrix(spawn_pos, protector_positions) // [1 x P]
W_reachable = sum(dist_to_workers < 60.0)
P_threatening = sum(dist_to_protectors < 12.0)
D_energy = (W_reachable - P_threatening) / max(W_total, 1)

// Combat parasite
W_reachable = sum(dist_to_workers < 75.0)
P_reachable = sum(dist_to_protectors < 75.0)
D_combat = (W_reachable + P_reachable) / max(W_total + P_total, 1)
```

### 3.4 Spawn Location Penalty

Penalize spawning far from strategic targets.

```
L_location(c_s, O) = {
    -α · norm_dist(c_s, c_h)           if W = 0  (IDLE: stay near hive)
    -β · min_dist(c_s, worker_chunks)  if W > 0  (ACTIVE: target workers)
}

where:
    norm_dist(a, b) = d(a, b) / d_max
    d_max = √(grid_x² + grid_z²)  // Maximum possible distance
    α = hive proximity weight
    β = threat proximity weight
```

### 3.5 Spawn Capacity Check

Binary validation of spawn feasibility.

```
V_capacity(t_s, e_q) = {
    1.0    if e_q ≥ cost(t_s)
    -∞     otherwise (invalid action)
}

where:
    cost(t_s) = spawn energy cost for type
```

### 3.6 Combined Cost Function

```
R_expected(A, O) = V_capacity · (
    w₁ · P_survival +
    w₂ · E_drain +
    w₃ · D_workers +
    w₄ · L_location
)

where:
    w₁, w₂, w₃, w₄ = learned or tuned weights
```

### 3.7 Decision Gate

```
Gate(A, O) = {
    SEND      if R_expected(A, O) > θ
    WAIT      if R_expected(A, O) ≤ θ
}

where:
    θ = 0.6 (reward threshold)

Rationale for θ = 0.6:
    - Survival alone (~0.4) should NOT trigger spawn
    - Requires meaningful disruption potential
    - Prevents wasteful spawns when no player activity
    - Creates bias toward action only with valid targets
```

---

## 4. Matrix Implementation (Co-Processor Optimized)

All operations designed for parallel execution:

```python
def cost_function(observation: Tensor, action: Tensor) -> Tensor:
    """
    Vectorized cost function for GPU execution.

    observation: [batch x features]
    action: [batch x 2] (chunk, type)

    Returns: [batch x 1] expected rewards
    """
    # Extract positions as matrices
    spawn_chunks = action[:, 0]  # [B]
    spawn_types = action[:, 1]   # [B]

    protector_chunks = observation.protector_chunks  # [B x P]
    worker_chunks = observation.worker_chunks        # [B x W]
    hive_chunks = observation.hive_chunk             # [B]
    queen_energy = observation.queen_energy          # [B]

    # 1. Survival probability (batched)
    dist_to_protectors = chunk_distance(spawn_chunks, protector_chunks)  # [B x P]
    threat_factors = threat_function(dist_to_protectors)                  # [B x P]
    p_survival = torch.prod(1 - threat_factors, dim=1)                   # [B]

    # 2. Worker disruption (batched)
    dist_to_workers = chunk_distance(spawn_chunks, worker_chunks)  # [B x W]
    disruption = disruption_function(dist_to_workers)              # [B x W]
    d_workers = p_survival * torch.sum(disruption, dim=1)          # [B]

    # 3. Location penalty (batched)
    has_workers = (observation.worker_count > 0).float()           # [B]
    dist_to_hive = chunk_distance(spawn_chunks, hive_chunks)       # [B]
    dist_to_nearest_worker = torch.min(dist_to_workers, dim=1)     # [B]

    l_location = (
        (1 - has_workers) * (-ALPHA * dist_to_hive / D_MAX) +
        has_workers * (-BETA * dist_to_nearest_worker / D_MAX)
    )  # [B]

    # 4. Capacity check (batched)
    spawn_cost = spawn_cost_lookup[spawn_types]                    # [B]
    v_capacity = (queen_energy >= spawn_cost).float()              # [B]
    v_capacity = torch.where(v_capacity > 0, v_capacity, -INF)

    # 5. Combined reward
    r_expected = v_capacity * (
        W1 * p_survival +
        W2 * d_workers +
        W3 * l_location
    )  # [B]

    return r_expected
```

---

## 5. Deadlock Prevention

### The Problem
What if no action ever yields positive reward? The NN would wait forever.

### Chosen Strategy

> **Selected approach: 5.2 Exploration Bonus**
> The exploration bonus adds reward to unexplored chunks, preventing deadlock
> while keeping the gate as the final authority on spawn decisions.

### All Options Considered

#### 5.1 Threshold Decay
```
θ(t) = θ_initial · exp(-decay_rate · t)

After N observations without action, lower the bar.
Eventually any action becomes acceptable.
```

#### 5.2 Exploration Bonus ✅ SELECTED
```
R_expected += ε · exploration_bonus(c_s)

where:
    exploration_bonus(c_s) = time_since_spawn(c_s) / max_time
    ε = exploration coefficient (annealed)
```
- Chunks not spawned in recently get a bonus
- Prevents NN from getting stuck in local optima
- ε anneals over training (high early, low later)

#### 5.3 Forced Action Timeout
```
if observations_since_last_action > MAX_WAIT:
    execute best_available_action regardless of reward
```

#### 5.4 Confidence-Based Override ❌ REJECTED
```
if NN_confidence > HIGH_THRESHOLD:
    bypass simulation gate (let NN take calculated risks)
```
**Why rejected:** This defeats the purpose of the gate. The gate exists to
evaluate game state and prevent wasteful spawns. If NN confidence can bypass
the gate, then bad decisions (no targets, protectors nearby) would still
execute just because the NN is confident. The gate must be the final authority.

### Why Exploration Bonus Works
- Adds reward to unexplored chunks, eventually making them pass the threshold
- Gate remains the authority - only spawns with positive expected reward execute
- Prevents deadlock without compromising game state evaluation

---

## 6. Training Integration

### Online Learning Loop
```
for each observation:
    action = NN.infer(observation)
    expected_reward = cost_function(observation, action)

    if expected_reward > threshold:
        # Execute and learn from real outcome
        real_reward = execute_and_observe(action)
        NN.train(observation, action, real_reward)
    else:
        # Learn from simulation
        NN.train(observation, action, expected_reward)
        # Wait for next observation
```

### Dual Learning Signal
- **Simulation feedback**: Immediate, every observation
- **Real feedback**: Delayed, only on executed actions

This creates a curriculum:
1. Learn basic spatial awareness from simulation
2. Refine with real game outcomes

---

## 7. Benefits

1. **Only good actions reach real game** - No wasted spawns
2. **NN learns game dynamics** - Through observation changes
3. **Strategic patience emerges** - Waits for right moment
4. **Fast learning** - Simulation feedback is immediate
5. **GPU-friendly** - Vectorized cost function
6. **No world model training** - Uses known game rules

---

## 8. Implementation Phases

### Phase 1: Cost Function Module
- Implement mathematical cost function in Python
- Vectorize for batch processing
- Unit tests against expected behaviors

### Phase 2: Simulation Gate
- Integrate cost function into inference pipeline
- Add threshold and decay mechanisms
- Logging for debugging

### Phase 3: Training Integration
- Dual feedback loop (simulation + real)
- Gradient flow through cost function
- Hyperparameter tuning

### Phase 4: Co-Processor Optimization
- Port cost function to PyTorch/JAX
- Profile GPU execution
- Batch observation processing

---

## 9. Open Questions

1. **Observation rate**: Should we increase observation frequency during active play?
2. **Weight tuning**: How to balance survival vs disruption vs location?
3. **Threshold calibration**: What's the right starting θ and decay rate?
4. **Protector prediction**: Should we model protector movement/spawn probability?

---

## 10. References

- Current reward calculator: `server/ai_engine/reward_calculator.py`
- Observation types: `client/src/game/types/ObservationTypes.ts`
- NN model: `server/ai_engine/nn_model.py`
- Spawn location rewards: Phase 10 of queen-nn-v2 spec
