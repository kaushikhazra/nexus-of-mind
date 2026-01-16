# Implementation Plan: Queen NN Continuous Learning System

## Overview

Transform the Queen AI from death-triggered learning to continuous real-time adaptation. The system collects game state every 500ms, batches into 10-20 second windows, trains incrementally, and sends strategy updates to the Queen during gameplay.

## Tasks

### Phase 1: Data Collection Infrastructure

- [x] 1. Create ObservationCollector (Frontend)
  - [x] 1.1 Create ObservationCollector class
    - File: `client/src/game/systems/ObservationCollector.ts` (new)
    - Implement 500ms game state sampling
    - Buffer snapshots in memory
    - Aggregate into observation batches every 10-20s
    - _Requirements: 1.1-1.5_

  - [x] 1.2 Define observation data types
    - File: `client/src/game/types/ObservationTypes.ts` (new)
    - Define GameStateSnapshot interface
    - Define ObservationData interface
    - Define Position, UnitPosition, MiningPosition types
    - Define CombatEvent interface
    - _Requirements: 6.1-6.3_

  - [x] 1.3 Integrate with GameEngine
    - File: `client/src/game/AdaptiveQueenIntegration.ts`
    - Instantiate ObservationCollector
    - Call update() from game loop
    - Pass relevant game state data
    - _Requirements: 1.1, 1.2_

- [x] 2. Create Feature Extractor (Backend)
  - [x] 2.1 Create FeatureExtractor class
    - File: `server/ai_engine/feature_extractor.py` (new)
    - Extract 20 features from ObservationData
    - Normalize all features to 0-1 range
    - Handle missing/invalid data gracefully
    - _Requirements: 6.1, 6.2_

  - [x] 2.2 Implement player state features (7)
    - energy_level, mining_site_count, worker_count
    - protector_count, base_health, avg_worker_dist
    - mining_efficiency
    - _Requirements: 6.1_

  - [x] 2.3 Implement spatial features (6)
    - nearest_mine_dist, player_centroid_x/y
    - mining_centroid_x/y, territory_control
    - _Requirements: 6.1_

  - [x] 2.4 Implement queen state features (4)
    - parasite_count, queen_health
    - time_since_spawn, hive_discovered
    - _Requirements: 6.1_

  - [x] 2.5 Implement temporal features (3)
    - game_time, mining_intrpt_rate, combat_win_rate
    - _Requirements: 6.1_

### Phase 2: Neural Network Updates

- [x] 3. Create Continuous Trainer (Backend)
  - [x] 3.1 Create ContinuousTrainer class
    - File: `server/ai_engine/continuous_trainer.py` (new)
    - Load existing model or create new
    - Implement experience buffer (deque)
    - Process observation → features → train → output
    - _Requirements: 2.1-2.5_

  - [x] 3.2 Implement reward calculation
    - File: `server/ai_engine/reward_calculator.py` (new)
    - Calculate reward from observation events
    - Mining interruption rewards (+0.5)
    - Player unit kills (+0.3)
    - Parasite deaths (-0.5)
    - Hive discovery (-1.0)
    - Normalize to [-1, 1]
    - _Requirements: 2.3_

  - [x] 3.3 Create NN configuration system
    - File: `server/ai_engine/nn_config.py` (new)
    - Create NNConfig dataclass with all hyperparameters
    - Support loading from JSON file and environment variables
    - Define preset configurations (default, minimal, deep, wide)
    - File: `server/config/nn_config.json` (new)
    - Create default configuration file
    - _Requirements: 7.1, 7.2_

  - [x] 3.4 Update neural network architecture
    - File: `server/ai_engine/continuous_trainer.py`
    - Build model dynamically from NNConfig
    - Input: config.input_size features (default: 20)
    - Hidden: config.hidden_layers (default: [64, 32])
    - Output: config.output_size values (default: 8, sigmoid)
    - Support L2 regularization and gradient clipping
    - _Requirements: 7.1, 7.2_

  - [x] 3.5 Implement incremental training
    - File: `server/ai_engine/continuous_trainer.py`
    - Mini-batch training from experience buffer
    - Reward-weighted loss adjustment
    - Prevent catastrophic forgetting
    - Use NNConfig for batch_size and training_frequency
    - _Requirements: 2.2, 2.5_

### Phase 3: Strategy Generation & Execution

- [x] 4. Create Strategy Generator (Backend)
  - [x] 4.1 Map NN outputs to strategy
    - File: `server/ai_engine/continuous_trainer.py`
    - Output [0-1] → spawn zone (x, y)
    - Output [0-1] → spawn rate (0.1-2.0)
    - Output [0-1] → aggression level
    - Output [0-1] → target priority (discretize)
    - Output [0-1] → formation type (discretize)
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 4.2 Define strategy data structures
    - File: `server/ai_engine/continuous_trainer.py`
    - Created StrategyUpdate dataclass
    - Add spawn zone, rate, burst_size
    - Add aggression, target_priority, formation
    - _Requirements: 4.1-4.5, 5.1-5.4_

- [x] 5. Create StrategyExecutor (Frontend)
  - [x] 5.1 Create StrategyExecutor class
    - File: `client/src/game/systems/StrategyExecutor.ts` (new)
    - Receive strategy updates from WebSocket
    - Store current strategy
    - Provide spawn decisions to Queen
    - Provide behavior decisions to swarm
    - _Requirements: 3.1-3.5_

  - [x] 5.2 Define strategy types
    - File: `client/src/game/types/StrategyTypes.ts` (new)
    - Define StrategyUpdate interface
    - Define SpawnDecision interface
    - Define SwarmBehavior interface
    - Define enums: TargetPriority, FormationType
    - _Requirements: 4.1-4.5, 5.1-5.4_

  - [x] 5.3 Implement smooth strategy transitions
    - File: `client/src/game/systems/StrategyExecutor.ts`
    - Interpolate between old and new strategy
    - Avoid jarring behavior changes
    - _Requirements: 3.4_

### Phase 4: Queen Integration

- [ ] 6. Update Queen Entity
  - [ ] 6.1 Add spawn location control
    - File: `client/src/game/entities/Queen.ts`
    - Accept spawn position from StrategyExecutor
    - Spawn parasites at specified location
    - Support multiple spawn zones
    - _Requirements: 4.1-4.5_

  - [ ] 6.2 Add spawn rate control
    - File: `client/src/game/entities/Queen.ts`
    - Variable spawn rate from strategy
    - Burst spawning support
    - _Requirements: 4.1_

  - [ ] 6.3 Add swarm behavior commands
    - File: `client/src/game/entities/Queen.ts`
    - Set aggression level on parasites
    - Set target priority
    - Set formation type
    - _Requirements: 5.1-5.4_

- [ ] 7. Update Parasite Behavior
  - [ ] 7.1 Add aggression level handling
    - File: `client/src/game/entities/Parasite.ts`
    - Behavior varies with aggression 0-1
    - Low: patrol, avoid combat
    - High: seek and attack
    - _Requirements: 5.1_

  - [ ] 7.2 Add target priority handling
    - File: `client/src/game/entities/Parasite.ts`
    - MINERS: Prioritize worker units
    - PROTECTORS: Prioritize combat units
    - BASE: Move toward player base
    - BALANCED: Nearest target
    - _Requirements: 5.2_

  - [ ] 7.3 Add formation behaviors
    - File: `client/src/game/entities/Parasite.ts`
    - SWARM: Converge on target
    - FLANK: Split and approach from sides
    - SURROUND: Encircle target area
    - DEFENSIVE: Stay near hive
    - _Requirements: 5.3_

### Phase 5: WebSocket Communication

- [x] 8. Update WebSocket Protocol
  - [x] 8.1 Add observation_data handler (Backend)
    - File: `server/websocket/message_handler.py`
    - Parse incoming observation data
    - Route to ContinuousTrainer
    - Send strategy_update response
    - _Requirements: 8.1-8.5_

  - [x] 8.2 Update frontend WebSocket client
    - File: `client/src/game/AdaptiveQueenIntegration.ts`
    - Send observation_data messages
    - Handle strategy_update messages
    - Route to StrategyExecutor
    - _Requirements: 8.1-8.5_

  - [ ] 8.3 Add heartbeat mechanism
    - File: `client/src/game/AdaptiveQueenIntegration.ts`
    - Send heartbeat every 5 seconds
    - Detect connection loss
    - Trigger fallback behavior
    - _Requirements: 8.3, 8.4, 3.5_

### Phase 6: Performance & Testing

- [ ] 9. Performance Optimization
  - [ ] 9.1 Optimize data collection
    - File: `client/src/game/systems/ObservationCollector.ts`
    - Object pooling for snapshots
    - Minimal allocations during collection
    - _Requirements: 9.1, 9.4_

  - [ ] 9.2 Optimize WebSocket messages
    - Compress observation data
    - Delta encoding for repeated data
    - _Requirements: 9.3_

  - [ ] 9.3 Optimize training cycle
    - File: `server/ai_engine/continuous_trainer.py`
    - Async training (non-blocking)
    - Batch size tuning
    - _Requirements: 9.2_

- [ ] 10. Testing & Validation
  - [ ] 10.1 Test data collection
    - Verify 500ms sampling rate
    - Verify batch transmission
    - Verify data completeness
    - _Requirements: 1.1-1.5_

  - [ ] 10.2 Test training loop
    - Verify incremental learning
    - Verify reward calculation
    - Verify strategy generation
    - _Requirements: 2.1-2.5_

  - [ ] 10.3 Test Queen behavior
    - Verify spawn location control
    - Verify behavior updates
    - Verify smooth transitions
    - _Requirements: 4.1-4.5, 5.1-5.4_

- [ ] 11. Final Checkpoint
  - [ ] Data collection works at 500ms intervals
  - [ ] Batches sent every 10-20 seconds
  - [ ] NN trains incrementally without death trigger
  - [ ] Strategy updates received by Queen
  - [ ] Queen controls spawn location
  - [ ] Swarm behavior responds to strategy
  - [ ] No performance degradation (60 FPS)
  - [ ] Fallback works when backend unavailable

## File Summary

| File | Status | Purpose |
|------|--------|---------|
| `client/.../ObservationCollector.ts` | New | Game state collection |
| `client/.../StrategyExecutor.ts` | New | Strategy application |
| `client/.../ObservationTypes.ts` | New | Observation data types |
| `client/.../StrategyTypes.ts` | New | Strategy data types |
| `client/.../GameEngine.ts` | Modify | Integration point |
| `client/.../Queen.ts` | Modify | Spawn & behavior control |
| `client/.../Parasite.ts` | Modify | Behavior modes |
| `client/.../AdaptiveQueenIntegration.ts` | Modify | WebSocket updates |
| `server/.../feature_extractor.py` | New | Feature extraction |
| `server/.../continuous_trainer.py` | New | Real-time training |
| `server/.../reward_calculator.py` | New | Reward computation |
| `server/.../nn_config.py` | New | NN configuration dataclass |
| `server/config/nn_config.json` | New | Default NN configuration |
| `server/.../neural_network.py` | Modify | Dynamic model building |
| `server/.../data_models.py` | Modify | Strategy structures |
| `server/.../message_handler.py` | Modify | Message routing |

## Notes

- Observation window is configurable (10-20s) via config
- **Neural network architecture is fully configurable** via nn_config.json or environment variables
- All features normalized to 0-1 for stable training
- Experience buffer prevents catastrophic forgetting
- Fallback strategy ensures gameplay continues if backend fails
- Strategy transitions are smoothed over 1-2 seconds
- Model weights saved after each game session
