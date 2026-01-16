# Queen Neural Network - Continuous Learning System

## Introduction

This specification transforms the Queen AI from a death-triggered learning system to a continuous, real-time adaptive learning system. The Queen will observe player behavior throughout the game and continuously update her strategy every 10-20 seconds, enabling dynamic adaptation to player tactics.

## Glossary

- **Observation Window**: The time period (10-20s) of collected game data used for each learning cycle
- **Strategy Update**: The new decisions sent to the Queen after each learning cycle
- **Spawn Zone**: A strategic location where the Queen can spawn parasites
- **Aggression Level**: A 0-1 scale determining defensive (0) vs offensive (1) behavior
- **Target Priority**: Which player entities the swarm should focus on (miners, protectors, base)
- **Formation Type**: How parasites organize (swarm, flank, surround, defensive)

## Requirements

### Requirement 1: Continuous Data Collection

**User Story:** As the Queen AI, I need to continuously observe player behavior so that I can adapt my strategy during the game, not just after death.

#### Acceptance Criteria

1. THE System SHALL collect game state data every 500ms from the frontend
2. THE System SHALL buffer collected data for the current observation window
3. THE data collected SHALL include:
   - Player unit positions (workers, protectors)
   - Active mining site locations and status
   - Player energy levels
   - Player base location
   - Queen's current position
   - Active parasite positions
   - Recent combat events (last 20 seconds)
4. THE System SHALL send buffered data to backend every 10-20 seconds (configurable)
5. THE System SHALL NOT block game execution during data transmission

### Requirement 2: Real-Time Neural Network Training

**User Story:** As the Queen AI, I need to learn from recent observations so that my strategy improves throughout the game.

#### Acceptance Criteria

1. THE backend SHALL process observation data within 500ms of receipt
2. THE neural network SHALL perform incremental training on new data
3. THE System SHALL use reward signals based on:
   - Mining interruption success (+reward)
   - Parasite survival rate (+reward)
   - Player resource drain (+reward)
   - Parasite losses (-reward)
   - Failed attacks (-reward)
4. THE training SHALL NOT require Queen death to trigger
5. THE System SHALL maintain training stability (no catastrophic forgetting)

### Requirement 3: Dynamic Strategy Generation

**User Story:** As the Queen AI, I need to receive updated strategies during gameplay so that I can adapt to changing player tactics.

#### Acceptance Criteria

1. THE backend SHALL generate new strategy after each training cycle
2. THE strategy SHALL be sent to frontend within 1 second of generation
3. THE Queen SHALL apply new strategy immediately upon receipt
4. THE strategy transition SHALL be smooth (no jarring behavior changes)
5. THE System SHALL provide fallback strategy if backend is unavailable

### Requirement 4: Spawn Location Control

**User Story:** As the Queen, I need to decide WHERE to spawn parasites so that I can strategically position my swarm.

#### Acceptance Criteria

1. THE Queen SHALL control spawn location (not just timing/count)
2. THE spawn locations SHALL be strategic decisions including:
   - Near active mining sites (offensive)
   - Defensive perimeter around hive
   - Flanking positions relative to player units
   - Ambush points along player paths
3. THE System SHALL output spawn zone coordinates or zone IDs
4. THE Queen SHALL be able to spawn at multiple locations simultaneously
5. THE spawn location decisions SHALL consider:
   - Distance from player units
   - Terrain features
   - Current parasite distribution

### Requirement 5: Swarm Behavior Control

**User Story:** As the Queen, I need to control how my swarm behaves so that I can execute different tactical approaches.

#### Acceptance Criteria

1. THE Queen SHALL control swarm aggression level (0-1 scale)
2. THE Queen SHALL set target priority:
   - MINERS: Focus on disrupting resource collection
   - PROTECTORS: Eliminate defensive units first
   - BASE: Direct assault on player structures
   - BALANCED: Distribute attacks
3. THE Queen SHALL select formation type:
   - SWARM: All parasites converge on target
   - FLANK: Split forces to attack from multiple angles
   - SURROUND: Encircle target area
   - DEFENSIVE: Protect hive and territory
4. THE swarm behavior SHALL update when new strategy is received

### Requirement 6: Observation Space Definition

**User Story:** As a developer, I need a clear definition of what the NN observes so that the model can learn effectively.

#### Acceptance Criteria

1. THE observation space SHALL include (minimum 20 features):

   **Player State (7 features)**:
   - Player energy level (normalized 0-1)
   - Active mining site count
   - Total worker count
   - Total protector count
   - Player base health (normalized)
   - Average worker distance from base
   - Mining efficiency (resources/second)

   **Spatial Features (6 features)**:
   - Nearest mining site distance from hive
   - Player unit centroid (x, y relative to hive)
   - Mining site centroid (x, y relative to hive)
   - Territory coverage (% of map controlled)

   **Queen State (4 features)**:
   - Active parasite count
   - Queen energy/health
   - Time since last spawn
   - Hive discovery status (0/1)

   **Temporal Features (3 features)**:
   - Game time elapsed (normalized)
   - Recent mining interruption rate
   - Recent combat win rate

2. ALL features SHALL be normalized to 0-1 range
3. THE observation vector SHALL be fixed size (20 elements)

### Requirement 7: Action Space Definition

**User Story:** As a developer, I need a clear definition of what actions the NN outputs so that the Queen can execute decisions.

#### Acceptance Criteria

1. THE action space SHALL include (8 outputs):

   **Spawn Decisions (4 outputs)**:
   - Spawn zone X (normalized map coordinate)
   - Spawn zone Y (normalized map coordinate)
   - Spawn rate (0-1, mapped to parasites/second)
   - Spawn burst size (0-1, mapped to 1-10 parasites)

   **Tactical Decisions (4 outputs)**:
   - Aggression level (0-1)
   - Target priority (0-1, discretized to 4 categories)
   - Formation type (0-1, discretized to 4 types)
   - Attack timing (0-1, immediate to delayed)

2. ALL outputs SHALL be continuous values 0-1
3. THE frontend SHALL map continuous outputs to discrete actions where needed

### Requirement 8: WebSocket Communication Protocol

**User Story:** As a developer, I need reliable real-time communication between frontend and backend.

#### Acceptance Criteria

1. THE System SHALL use existing WebSocket connection
2. THE message types SHALL include:
   - `observation_data`: Frontend → Backend (every 10-20s)
   - `strategy_update`: Backend → Frontend (after each training)
   - `heartbeat`: Bidirectional (every 5s)
   - `training_status`: Backend → Frontend (progress updates)
3. THE messages SHALL be JSON formatted
4. THE System SHALL handle connection drops gracefully
5. THE System SHALL queue messages during brief disconnections

### Requirement 9: Performance Requirements

**User Story:** As a player, I need the AI to run smoothly without impacting game performance.

#### Acceptance Criteria

1. THE frontend data collection SHALL use < 5% CPU overhead
2. THE backend training cycle SHALL complete within 2 seconds
3. THE strategy update latency SHALL be < 500ms (network + processing)
4. THE System SHALL maintain 60 FPS during all AI operations
5. THE neural network inference SHALL use < 50ms per forward pass

### Requirement 10: Learning Persistence

**User Story:** As a player, I want the Queen to remember what she learned across game sessions.

#### Acceptance Criteria

1. THE System SHALL save model weights after each game
2. THE System SHALL load previous weights on game start
3. THE System SHALL support model versioning
4. THE System SHALL allow model reset for fresh learning
