# Queen Neural Network v2.0 - Chunk-Based Strategic Spawning

## Introduction

This specification defines the second generation Queen AI neural network. Building on the continuous learning foundation from v1, this version introduces a chunk-based spatial decision system that enables strategic parasite spawning based on mining activity zones, protector distribution, and resource management.

**Key Evolution from v1:**
- Chunk-based inputs (Top 5 mining zones) instead of global centroids
- Spawn capacity inputs instead of raw energy percentage
- 256-chunk softmax output for precise spawn location control
- Binary type decision per spawn cycle (KISS principle)

## Glossary

- **Chunk**: A 64×64 unit spatial zone (matching SpatialIndex chunk size)
- **Territory**: 16×16 chunks = 1024 units (256 possible spawn zones)
- **Spawn Capacity**: Normalized value (0-1) indicating how many parasites of a type can be afforded
- **Mining Worker Density**: Ratio of mining workers in a chunk vs total mining workers
- **Protector Density**: Ratio of protectors in a chunk vs total protectors
- **Parasite Rate**: Change in parasite count over observation window, normalized to [-1, +1]
- **Observation Window**: 15-second period between NN decisions

## Requirements

### Requirement 1: Chunk-Based Observation Space

**User Story:** As the Queen AI, I need to observe the top mining activity zones so that I can make strategic spawn decisions based on where workers are concentrated.

#### Acceptance Criteria

1. THE System SHALL identify the top 5 chunks by mining worker density
2. THE System SHALL collect for each of the top 5 chunks:
   - Chunk ID (normalized: chunk_id / 255 → 0-1)
   - Mining Worker Density (workers_here / total_mining_workers → 0-1)
   - Protector Density (protectors_here / total_protectors → 0-1)
   - Energy Parasite Rate ((p_end - p_start) / max(p_start, p_end) → -1 to +1)
   - Combat Parasite Rate ((p_end - p_start) / max(p_start, p_end) → -1 to +1)
3. THE observation SHALL total 25 values (5 chunks × 5 values)
4. THE System SHALL use event-driven tracking for mining workers (O(1) add/remove)
5. THE System SHALL handle edge cases where fewer than 5 chunks have mining activity

### Requirement 2: Queen Spawn Capacity Inputs

**User Story:** As the Queen AI, I need to know my spawn capacity for each parasite type so that I can make resource-aware decisions.

#### Acceptance Criteria

1. THE System SHALL track Queen energy with the following parameters:
   - Maximum energy capacity: 100
   - Energy Parasite spawn cost: 15
   - Combat Parasite spawn cost: 25
   - Passive regeneration rate: 3.0 energy/second
2. THE System SHALL calculate spawn capacity as:
   - Energy spawn capacity: floor(current_energy / 15) / 6 → 0-1
   - Combat spawn capacity: floor(current_energy / 25) / 4 → 0-1
3. THE System SHALL provide 2 normalized spawn capacity values to the NN
4. THE capacity value of 1.0 SHALL indicate maximum spawn potential
5. THE capacity value of 0.0 SHALL indicate inability to spawn that type

### Requirement 3: Player Energy Rate Input

**User Story:** As the Queen AI, I need to observe the player's energy trend so that I can gauge the effectiveness of my strategy.

#### Acceptance Criteria

1. THE System SHALL track player energy at observation window start and end
2. THE System SHALL calculate player energy rate as:
   - (energy_end - energy_start) / max(energy_start, energy_end) → -1 to +1
3. THE negative rate SHALL indicate player is losing energy (REWARD for Queen)
4. THE positive rate SHALL indicate player is gaining energy (PENALTY for Queen)
5. THE System SHALL handle edge cases (zero energy, no change)

### Requirement 4: Chunk-Based Spawn Output

**User Story:** As the Queen AI, I need to decide which chunk to spawn parasites in so that I can strategically position my swarm.

#### Acceptance Criteria

1. THE NN SHALL output 256 values representing spawn probability for each chunk
2. THE output SHALL use Softmax activation (probabilities sum to 1.0)
3. THE System SHALL select spawn chunk via argmax(chunk_probabilities)
4. THE spawn location SHALL be within the selected chunk boundaries
5. THE System SHALL validate spawn location is within Queen's territory

### Requirement 5: Binary Parasite Type Output

**User Story:** As the Queen AI, I need to decide which type of parasite to spawn so that I can adapt to the current tactical situation.

#### Acceptance Criteria

1. THE NN SHALL output 1 value for parasite type decision
2. THE output SHALL use Sigmoid activation (0 to 1)
3. THE type decision SHALL be:
   - Output < 0.5 → Spawn Energy Parasite
   - Output >= 0.5 → Spawn Combat Parasite
4. THE System SHALL spawn exactly ONE parasite per decision cycle
5. THE System SHALL verify affordability before spawning (check spawn capacity)

### Requirement 6: Neural Network Architecture

**User Story:** As a developer, I need a well-defined NN architecture so that I can implement and train the model effectively.

#### Acceptance Criteria

1. THE NN architecture SHALL be: 28 → 32 → 16 → split heads
2. THE input layer SHALL accept 28 normalized values:
   - 25 values from top 5 chunks (5 × 5)
   - 2 values for spawn capacities
   - 1 value for player energy rate
3. THE hidden layers SHALL use ReLU activation
4. THE chunk head SHALL expand: 16 → 32 → 256 (Softmax)
5. THE type head SHALL be: 16 → 1 (Sigmoid)
6. THE total parameters SHALL be approximately 10,465

### Requirement 7: Data Pipeline

**User Story:** As a developer, I need a clear data flow so that frontend and backend responsibilities are well-defined.

#### Acceptance Criteria

1. THE frontend SHALL send raw data every 15 seconds:
   - Mining workers with positions and chunk IDs
   - Protectors with positions and chunk IDs
   - Parasites (energy and combat) with chunk IDs
   - Queen current energy and max energy
   - Player energy at window start and end
2. THE backend SHALL preprocess raw data into 28 normalized features
3. THE backend SHALL run NN inference and generate spawn decision
4. THE backend SHALL return: { spawn_chunk: number, spawn_type: "energy" | "combat" }
5. THE frontend SHALL execute spawn command from backend

### Requirement 8: Event-Driven Worker Tracking

**User Story:** As a developer, I need efficient tracking of mining workers so that the system scales without performance degradation.

#### Acceptance Criteria

1. THE System SHALL maintain a Set of currently mining workers
2. THE System SHALL add workers to the set on mining start (O(1))
3. THE System SHALL remove workers from the set on mining stop (O(1))
4. THE System SHALL NOT iterate all workers every observation cycle
5. THE System SHALL provide getMiningWorkersData() without filtering

### Requirement 9: Queen Energy System Implementation

**User Story:** As the Queen, I need an energy reserve that limits spawning so that I must manage resources strategically.

#### Acceptance Criteria

1. THE Queen SHALL have an energy reserve (default: start at 50/100)
2. THE Queen SHALL regenerate energy passively (3.0 energy/second)
3. THE Queen SHALL deduct energy when spawning:
   - Energy Parasite: -15 energy
   - Combat Parasite: -25 energy
4. THE Queen SHALL NOT spawn when insufficient energy
5. THE energy system SHALL cap at maximum (100)
6. THE energy system SHALL be integrated into existing Queen.ts

### Requirement 10: Performance Requirements

**User Story:** As a player, I need the AI system to run smoothly without impacting game performance.

#### Acceptance Criteria

1. THE observation collection SHALL use < 5% CPU overhead
2. THE NN inference SHALL complete within 50ms
3. THE WebSocket round-trip SHALL complete within 500ms
4. THE System SHALL maintain 60 FPS during all AI operations
5. THE event-driven tracking SHALL avoid per-frame allocations

### Requirement 11: Reward/Penalty Signal Definition

**User Story:** As the Queen AI, I need clear reward signals so that I can learn effective strategies.

#### Acceptance Criteria

1. THE System SHALL provide positive rewards for:
   - Mining activity stopped in targeted chunks
   - Player protector count reduced
   - Player energy rate becoming negative
2. THE System SHALL provide negative rewards for:
   - Mining activity continuing/increasing
   - Protector count increasing
   - Player energy rate becoming positive
3. THE reward calculation SHALL use the rate formula:
   - (end - start) / max(start, end) → bounded -1 to +1
4. THE reward signals SHALL be derived from observation data

### Requirement 12: Confidence-Based Spawn Gating

**User Story:** As the Queen AI, I need the ability to choose NOT to spawn when conditions are unfavorable, so that I can conserve energy and learn when spawning is wasteful.

#### Acceptance Criteria

1. THE NN output confidence (max chunk probability) SHALL be used as spawn confidence
2. THE System SHALL use a configurable confidence threshold (default: 0.5)
3. THE System SHALL skip spawn execution when confidence < threshold
4. THE System SHALL log skipped spawns with confidence value for training feedback
5. THE reward system SHALL provide:
   - Negative reward for spawning with no valid targets (wasted energy)
   - Neutral reward for skipping spawn when no targets exist (energy conserved)
   - Positive reward for spawning that results in kills
6. THE NN SHALL learn to output low confidence when:
   - No workers are present in the territory
   - No player buildings exist
   - Spawning would be wasteful
7. THE confidence threshold SHALL be adjustable for tuning exploration vs exploitation

### Requirement 13: Spawn Location Rewards (Strategic Spatial Awareness)

**User Story:** As the Queen AI, I need to learn spatial awareness so that I spawn parasites near my hive when idle (defensive posture) and near worker activity when threats are present (offensive posture).

**Problem Statement:**
- NN currently spawns at random chunks with no spatial understanding
- Parasites spawned far from hive waste energy when idle
- Parasites spawned far from workers miss interception opportunities

#### Acceptance Criteria

1. THE frontend SHALL send hive chunk ID in observation data:
   - hiveChunkX = floor(queenPosition.x / 64)
   - hiveChunkZ = floor(queenPosition.z / 64)
   - hiveChunk = hiveChunkZ * 20 + hiveChunkX
2. THE System SHALL calculate chunk distance using grid coordinates:
   - distance = sqrt((x1-x2)^2 + (z1-z2)^2) where x = chunk % 20, z = chunk // 20
   - normalized_distance = distance / 26.87 (max possible distance)
3. THE System SHALL apply hive proximity penalty when spawning during IDLE state:
   - Idle = no workers present in territory
   - penalty = normalized_distance_to_hive * hive_proximity_penalty_weight
   - Default hive_proximity_penalty_weight: -0.3
4. THE System SHALL apply threat proximity penalty when spawning during ACTIVE state:
   - Active = one or more workers present in territory
   - Calculate distance to nearest worker chunk
   - penalty = normalized_min_distance_to_worker * threat_proximity_penalty_weight
   - Default threat_proximity_penalty_weight: -0.4
5. THE spawn location reward SHALL be added to existing reward components
6. THE System SHALL log spawn location decisions with:
   - Spawn chunk, hive chunk, nearest worker chunk
   - Distance calculated and penalty applied
   - Mode used (idle vs active)
7. THE spawn location penalty SHALL ONLY apply when spawn actually occurs (not when skipped)
