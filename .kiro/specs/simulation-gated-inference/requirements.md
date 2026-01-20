# Simulation-Gated Inference - Requirements

## Introduction

This specification defines a predictive cost function system that evaluates Neural Network spawn decisions BEFORE they are executed in the real game. The system uses known game dynamics encoded as mathematical formulas to simulate expected outcomes, enabling the NN to learn from both simulated feedback and real game results.

**Key Innovation:**
- NN inference is "gated" by a simulation that predicts success/failure
- Only actions with positive expected reward reach the real game
- NN receives continuous training feedback from simulation
- Game dynamics are encoded as GPU-friendly mathematical operations

**Building on Queen NN v2:**
- Uses existing observation pipeline and feature extraction
- Extends reward calculation with predictive cost function
- Adds thinking loop that validates actions before execution

## Glossary

- **Cost Function**: Mathematical formula that predicts expected reward without executing action
- **Simulation Gate**: Decision point that allows/blocks actions based on cost function output
- **Thinking Loop**: Iterative process where NN proposes, simulation evaluates, until positive reward
- **Survival Probability**: Estimated chance a spawned parasite survives the observation window
- **Threat Factor**: Danger level from a protector at given distance
- **Exploration Bonus**: Reward boost for trying unexplored spawn locations

## Requirements

### Requirement 1: Cost Function - Survival Probability

**User Story:** As the Queen AI, I need to predict whether a spawned parasite will survive so that I don't waste energy on doomed spawns.

**Problem Statement:**
- Currently, parasites spawn and die without the NN learning the danger pattern
- Feedback is delayed 15+ seconds until next observation
- NN repeatedly makes same mistakes in dangerous areas

#### Acceptance Criteria

1. THE System SHALL calculate survival probability using protector positions:
   ```
   P_survival = ∏ᵢ (1 - threat_factor(spawn_chunk, protector_i))
   ```
2. THE threat_factor SHALL be calculated as:
   - 1.0 (certain death) if distance < kill_range
   - exp(-λ × (distance - kill_range)) if distance ≥ kill_range
   - 0.0 (no threat) if distance > safe_range
3. THE kill_range SHALL default to 2 chunks (protector immediate kill zone)
4. THE safe_range SHALL default to 8 chunks (beyond threat)
5. THE λ (decay rate) SHALL default to 0.5
6. THE calculation SHALL be vectorized for GPU execution

### Requirement 2: Cost Function - Worker Disruption Potential

**User Story:** As the Queen AI, I need to predict how much mining disruption a spawn will cause so that I can target high-value locations.

#### Acceptance Criteria

1. THE System SHALL calculate worker disruption as:
   ```
   D_workers = P_survival × Σᵢ disruption(spawn_chunk, worker_i)
   ```
2. THE disruption function SHALL be:
   - 1.0 (full disruption) if distance < flee_range
   - exp(-μ × (distance - flee_range)) if distance ≥ flee_range
   - 0.0 (no effect) if distance > ignore_range
3. THE flee_range SHALL default to 3 chunks
4. THE ignore_range SHALL default to 10 chunks
5. THE μ (disruption decay) SHALL default to 0.3
6. THE disruption SHALL scale with survival probability (dead parasite = no disruption)

### Requirement 3: Cost Function - Spawn Location Penalty

**User Story:** As the Queen AI, I need spawn location feedback integrated into the cost function so that spatial awareness is part of the simulation.

#### Acceptance Criteria

1. THE System SHALL calculate location penalty based on game mode:
   - IDLE mode (no workers): penalty = -α × normalized_distance_to_hive
   - ACTIVE mode (workers present): penalty = -β × normalized_distance_to_nearest_worker
2. THE α (hive proximity weight) SHALL default to 0.3
3. THE β (threat proximity weight) SHALL default to 0.4
4. THE normalized_distance SHALL use chunk grid coordinates:
   ```
   distance = sqrt((x1-x2)² + (z1-z2)²)
   normalized = distance / max_distance (26.87 for 20×20 grid)
   ```
5. THE location penalty SHALL be included in combined cost function

### Requirement 4: Combined Cost Function

**User Story:** As the Queen AI, I need a single expected reward value that combines all simulation factors so that I can evaluate if an action is good.

#### Acceptance Criteria

1. THE System SHALL calculate combined expected reward as:
   ```
   R_expected = V_capacity × (w₁×P_survival + w₂×D_workers + w₃×L_location)
   ```
2. THE V_capacity SHALL be a binary validation:
   - 1.0 if Queen can afford the spawn
   - -∞ (invalid) if Queen cannot afford
3. THE default weights SHALL be:
   - w₁ (survival weight): 0.4
   - w₂ (disruption weight): 0.5
   - w₃ (location weight): 0.1
4. THE weights SHALL be configurable for tuning
5. THE cost function SHALL return a single scalar value

### Requirement 5: Simulation Gate

**User Story:** As the Queen AI, I need a gate that blocks bad actions so that only good decisions reach the real game.

#### Acceptance Criteria

1. THE System SHALL implement a decision gate:
   ```
   Gate(action, observation) = SEND if R_expected > θ, else WAIT
   ```
2. THE threshold θ SHALL default to 0.0 (only positive expected reward passes)
3. THE System SHALL log gate decisions with:
   - Proposed action (spawn_chunk, spawn_type)
   - Expected reward calculated
   - Gate decision (SEND or WAIT)
4. THE System SHALL NOT execute spawn when gate returns WAIT
5. THE System SHALL provide simulation feedback to NN when gate returns WAIT

### Requirement 6: Thinking Loop Integration

**User Story:** As the Queen AI, I need a continuous thinking loop so that I keep evaluating with fresh observations until I find a good action.

#### Acceptance Criteria

1. THE System SHALL implement continuous observation flow:
   - Receive observation from frontend
   - NN produces inference
   - Cost function evaluates inference
   - If PENALTY: train NN, wait for next observation
   - If REWARD: send to frontend, train NN
2. THE NN SHALL NOT loop on stale data
3. THE NN SHALL always use latest observation for inference
4. THE System SHALL log thinking loop iterations
5. THE game state SHALL continue evolving during thinking

### Requirement 7: Deadlock Prevention - Exploration Bonus

**User Story:** As the Queen AI, I need an exploration bonus so that I try new spawn locations and don't get stuck.

#### Acceptance Criteria

1. THE System SHALL track time since last spawn per chunk
2. THE System SHALL add exploration bonus to expected reward:
   ```
   R_expected += ε × (time_since_spawn(chunk) / max_time)
   ```
3. THE ε (exploration coefficient) SHALL default to 0.2
4. THE max_time SHALL default to 300 seconds (5 minutes)
5. THE exploration coefficient SHALL anneal over training:
   - High ε early (explore more)
   - Low ε later (exploit learned patterns)
6. THE chunks never spawned in SHALL receive maximum bonus

### ~~Requirement 8: Deadlock Prevention - Confidence Override~~ REMOVED

**Status:** REJECTED - This requirement contradicts the purpose of the gate.

**Reason for removal:** The simulation gate exists to evaluate game state and
prevent wasteful spawns. Allowing NN confidence to bypass the gate defeats this
purpose entirely. If the gate says "no targets, protectors nearby" but NN is
confident, the spawn would still be wasteful. The gate must be the final
authority. Deadlock is prevented by exploration bonus (Requirement 7) instead.

### Requirement 9: Training Integration

**User Story:** As the Queen AI, I need to learn from both simulation feedback and real outcomes so that I improve faster.

#### Acceptance Criteria

1. THE System SHALL provide dual training signals:
   - Simulation feedback: immediate, every observation
   - Real feedback: delayed, only on executed actions
2. THE NN SHALL train on simulation feedback when gate returns WAIT
3. THE NN SHALL train on real reward when action is executed
4. THE System SHALL weight real feedback higher than simulation:
   ```
   effective_reward = simulation_reward × 0.3 + real_reward × 0.7
   ```
5. THE training SHALL use existing continuous learning infrastructure

### Requirement 10: GPU-Optimized Implementation

**User Story:** As a developer, I need the cost function to run on GPU so that simulation doesn't slow down the game.

#### Acceptance Criteria

1. THE cost function SHALL be implemented using PyTorch tensors
2. THE implementation SHALL support batch processing:
   - Multiple candidate actions evaluated in parallel
   - Batch size configurable (default: 10)
3. THE distance calculations SHALL use vectorized operations
4. THE cost function SHALL complete within 10ms on GPU
5. THE System SHALL fallback to CPU if GPU unavailable
6. THE memory footprint SHALL be < 50MB for cost function

### Requirement 11: Observability and Debugging

**User Story:** As a developer, I need detailed logs so that I can debug and tune the simulation system.

#### Acceptance Criteria

1. THE System SHALL log for each observation:
   - NN inference output (chunk probabilities, type, confidence)
   - Cost function components (P_survival, D_workers, L_location)
   - Combined expected reward
   - Gate decision and reason
2. THE System SHALL log thinking loop statistics:
   - Observations processed before action
   - Time spent in thinking loop
   - Exploration bonus applied
3. THE System SHALL expose metrics:
   - Gate pass rate (actions executed / observations received)
   - Average expected reward
   - Confidence override rate
4. THE logging SHALL be configurable (verbose/minimal)

### Requirement 12: Configuration Management

**User Story:** As a developer, I need all parameters configurable so that I can tune the system without code changes.

#### Acceptance Criteria

1. THE System SHALL load configuration from config file:
   ```python
   @dataclass
   class SimulationGateConfig:
       # Survival probability
       kill_range: float = 2.0
       safe_range: float = 8.0
       threat_decay: float = 0.5

       # Worker disruption
       flee_range: float = 3.0
       ignore_range: float = 10.0
       disruption_decay: float = 0.3

       # Combined weights
       survival_weight: float = 0.4
       disruption_weight: float = 0.5
       location_weight: float = 0.1

       # Gate
       reward_threshold: float = 0.0

       # Deadlock prevention
       exploration_coefficient: float = 0.2
       exploration_max_time: float = 300.0
       confidence_threshold: float = 0.8
   ```
2. THE configuration SHALL be hot-reloadable without restart
3. THE System SHALL validate configuration values on load
4. THE System SHALL use sensible defaults if config missing
