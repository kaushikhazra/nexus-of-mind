# Implementation Plan: Queen Neural Network (Chunk-Based Architecture)

## Overview

Transform the Queen AI from centroid-based inputs to chunk-based strategic decision making. The NN observes top 5 mining zones, spawn capacities, and player energy trends to output spawn location (256 chunks) and type (binary).

## Tasks

### Phase 1: Queen Energy System (Frontend) ✅ COMPLETE

- [x] 1. Create Queen Energy System ✓
  - [x] 1.1 Create QueenEnergySystem class ✓
    - File: `client/src/game/systems/QueenEnergySystem.ts` (new)
    - Properties: currentEnergy, maxEnergy (100), regenRate (3.0)
    - Properties: energyParasiteCost (15), combatParasiteCost (25)
    - Method: update(deltaTime) - passive regeneration
    - Method: canAffordSpawn(type: 'energy' | 'combat'): boolean
    - Method: consumeForSpawn(type): boolean
    - Method: getSpawnCapacity(type): number (normalized 0-1)
    - _Requirements: 2.1-2.5, 9.1-9.6_

  - [x] 1.2 Create energy type definitions ✓
    - File: `client/src/game/types/QueenEnergyTypes.ts` (new)
    - Interface: QueenEnergyConfig
    - Interface: SpawnCapacity { energy: number, combat: number }
    - Constants: DEFAULT_QUEEN_ENERGY_CONFIG
    - _Requirements: 2.1_

  - [x] 1.3 Integrate with Queen entity ✓
    - File: `client/src/game/entities/Queen.ts`
    - Add energySystem: QueenEnergySystem property
    - Initialize in constructor
    - Call energySystem.update(deltaTime) in update loop
    - _Requirements: 9.6_

  - [x] 1.4 Integrate with ParasiteManager ✓
    - File: `client/src/game/ParasiteManager.ts`
    - Check queen.energySystem.canAffordSpawn() before spawn
    - Call queen.energySystem.consumeForSpawn() on spawn
    - Log warning if spawn rejected due to insufficient energy
    - _Requirements: 9.3, 9.4_

### Phase 2: Event-Driven Worker Tracking (Frontend) ✅ COMPLETE

- [x] 2. Create Mining Worker Tracker ✓
  - [x] 2.1 Add mining worker tracking to UnitManager ✓
    - File: `client/src/game/UnitManager.ts`
    - Add miningWorkers: Set<Worker> property
    - Method: onWorkerStartMining(worker) - add to set
    - Method: onWorkerStopMining(worker) - remove from set
    - Method: getMiningWorkers(): Set<Worker>
    - _Requirements: 8.1-8.5_

  - [x] 2.2 Update Worker entity for mining events ✓
    - File: `client/src/game/entities/Worker.ts`
    - Emit event on mining start (call UnitManager.onWorkerStartMining)
    - Emit event on mining stop (call UnitManager.onWorkerStopMining)
    - Integrate with existing MiningAction callbacks
    - _Requirements: 8.2, 8.3_

  - [x] 2.3 Add chunk tracking to mining workers ✓
    - File: `client/src/game/entities/Worker.ts`
    - Property: currentChunkId (update on position change)
    - Calculate chunk: floor(x/64), floor(z/64) → chunkId
    - _Requirements: 1.1_

### Phase 3: Chunk-Based Observation Collector (Frontend) ✅ COMPLETE

- [x] 3. Create ObservationCollector ✓
  - [x] 3.1 Create ObservationCollector class ✓
    - File: `client/src/game/systems/ObservationCollector.ts` (new)
    - Method: collectRawData(): ObservationData
    - Collect mining workers with chunk IDs
    - Collect protectors with chunk IDs
    - Collect parasites (energy/combat) with chunk IDs
    - Collect Queen energy state
    - Collect player energy (start/end of window)
    - _Requirements: 1.1-1.5, 7.1_

  - [x] 3.2 Create observation data types ✓
    - File: `client/src/game/types/ObservationTypes.ts` (new)
    - Interface: ObservationData
    - Interface: WorkerData { x, y, chunkId }
    - Interface: ProtectorData { x, y, chunkId }
    - Interface: ParasiteData { chunkId, type }
    - Interface: QueenEnergyData { current, max }
    - Interface: PlayerEnergyData { start, end }
    - _Requirements: 7.1_

  - [x] 3.3 Implement 15-second observation window ✓
    - File: `client/src/game/systems/ObservationCollector.ts`
    - Track window start time
    - Store player energy at window start
    - Store parasite counts (per chunk) at window start
    - Send observation at window end (every 15s)
    - _Requirements: 1.4, 7.4_

  - [x] 3.4 Integrate with AdaptiveQueenIntegration ✓
    - File: `client/src/game/AdaptiveQueenIntegration.ts`
    - Replace or extend existing ObservationCollector
    - Connect to WebSocket for sending observation data
    - _Requirements: 7.5_

### Phase 4: Backend Preprocessing ✅ COMPLETE

- [x] 4. Create Feature Extractor (Backend) ✓
  - [x] 4.1 Create FeatureExtractor class ✓
    - File: `server/ai_engine/feature_extractor.py` (new)
    - Method: extract_features(observation_data) → [28 floats]
    - _Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.5_

  - [x] 4.2 Implement top 5 chunk selection ✓
    - File: `server/ai_engine/feature_extractor.py`
    - Group mining workers by chunk
    - Calculate mining worker density per chunk
    - Select top 5 chunks by density
    - Pad with zeros if fewer than 5
    - _Requirements: 1.1, 1.5_

  - [x] 4.3 Implement per-chunk feature calculation ✓
    - File: `server/ai_engine/feature_extractor.py`
    - For each of top 5 chunks:
      - chunk_id / 255 → normalized chunk ID
      - workers_in_chunk / total_mining_workers → worker density
      - protectors_in_chunk / total_protectors → protector density
      - (parasites_end - parasites_start) / max(...) → parasite rates
    - _Requirements: 1.2_

  - [x] 4.4 Implement spawn capacity calculation ✓
    - File: `server/ai_engine/feature_extractor.py`
    - energy_capacity = floor(current/15) / 6
    - combat_capacity = floor(current/25) / 4
    - _Requirements: 2.2_

  - [x] 4.5 Implement player energy rate calculation ✓
    - File: `server/ai_engine/feature_extractor.py`
    - rate = (end - start) / max(start, end)
    - Handle edge cases (zero values)
    - _Requirements: 3.2, 3.5_

### Phase 5: Neural Network Model (Backend) ✅ COMPLETE

- [x] 5. Create Split-Head NN Architecture ✓
  - [x] 5.1 Create NNModel class ✓
    - File: `server/ai_engine/nn_model.py` (new)
    - Architecture: 28 → 32 → 16 → split heads
    - Input layer: 28 neurons
    - Hidden 1: 32 neurons (ReLU)
    - Hidden 2: 16 neurons (ReLU)
    - _Requirements: 6.1-6.6_

  - [x] 5.2 Implement chunk head ✓
    - File: `server/ai_engine/nn_model.py`
    - Hidden 2 (16) → Expand (32) → Output (256)
    - Softmax activation
    - _Requirements: 4.1, 4.2_

  - [x] 5.3 Implement type head ✓
    - File: `server/ai_engine/nn_model.py`
    - Hidden 2 (16) → Output (1)
    - Sigmoid activation
    - _Requirements: 5.1, 5.2_

  - [x] 5.4 Implement inference method ✓
    - File: `server/ai_engine/nn_model.py`
    - Method: predict(features) → (chunk_probs, type_prob)
    - _Requirements: 6.1_

  - [x] 5.5 Implement post-processing ✓
    - File: `server/ai_engine/nn_model.py`
    - Method: get_spawn_decision(chunk_probs, type_prob)
    - chunk_id = argmax(chunk_probs)
    - type = "energy" if type_prob < 0.5 else "combat"
    - Return: { spawn_chunk, spawn_type }
    - _Requirements: 4.3, 5.3_

### Phase 6: WebSocket Integration ✅ COMPLETE

- [x] 6. Update WebSocket Protocol ✓
  - [x] 6.1 Add observation_data handler (Backend) ✓
    - File: `server/websocket/message_handler.py`
    - Parse ObservationData format
    - Route to FeatureExtractor
    - Route to NNModel
    - _Requirements: 7.1-7.4_

  - [x] 6.2 Add spawn_decision response (Backend) ✓
    - File: `server/websocket/message_handler.py`
    - Format: { spawn_chunk: number, spawn_type: "energy" | "combat" }
    - Send after NN inference
    - _Requirements: 7.4_

  - [x] 6.3 Handle spawn_decision in frontend ✓
    - File: `client/src/game/AdaptiveQueenIntegration.ts`
    - Listen for spawn_decision message
    - Validate spawn affordability
    - Execute spawn via ParasiteManager
    - _Requirements: 7.5_

### Phase 7: Spawn Execution ✅ COMPLETE

- [x] 7. Implement Spawn Execution ✓
  - [x] 7.1 Add chunk-to-position conversion ✓
    - File: `client/src/game/utils/ChunkUtils.ts` (new)
    - Method: chunkToPosition(chunkId): Vector3
    - Convert chunk ID to world coordinates
    - Add random offset within chunk boundaries
    - _Requirements: 4.4_

  - [x] 7.2 Update ParasiteManager spawn method ✓
    - File: `client/src/game/ParasiteManager.ts`
    - Method: spawnAtChunk(chunkId, type)
    - Convert chunk to position
    - Verify within Queen territory
    - Execute spawn
    - _Requirements: 4.5, 5.4_

  - [x] 7.3 Add spawn validation ✓
    - File: `client/src/game/ParasiteManager.ts`
    - Check Queen energy before spawn
    - Check spawn location validity
    - Log rejection reasons
    - _Requirements: 5.5_

### Phase 8: Training Integration (Backend) ✅ COMPLETE

- [x] 8. Implement Reward Calculation ✓
  - [x] 8.1 Create RewardCalculator class ✓
    - File: `server/ai_engine/reward_calculator.py` (new)
    - Method: calculate_reward(prev_obs, curr_obs) → float
    - _Requirements: 11.1-11.4_

  - [x] 8.2 Implement reward signals ✓
    - File: `server/ai_engine/reward_calculator.py`
    - Positive: mining stopped, protectors reduced, player energy negative
    - Negative: mining active, protectors increased, player energy positive
    - Use rate formula: (end - start) / max(start, end)
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 8.3 Integrate reward into training loop ✓
    - File: `server/websocket/message_handler.py`
    - Use RewardCalculator for reward signals
    - Train on observation/reward pairs via NNModel.train_with_reward()
    - _Requirements: 11.4_

### Phase 9: Confidence-Based Spawn Gating

- [ ] 9. Implement Spawn Gating
  - [ ] 9.1 Add confidence calculation to backend
    - File: `server/ai_engine/nn_model.py`
    - Calculate confidence = max(chunk_probabilities)
    - Include confidence in spawn_decision response
    - _Requirements: 12.1_

  - [ ] 9.2 Add confidence threshold to spawn decision handler
    - File: `server/websocket/message_handler.py`
    - Add CONFIDENCE_THRESHOLD constant (default: 0.5)
    - Skip spawn if confidence < threshold
    - Log skipped spawns with confidence value
    - _Requirements: 12.2, 12.3, 12.4_

  - [ ] 9.3 Update frontend to handle skipped spawns
    - File: `client/src/game/AdaptiveQueenIntegration.ts`
    - Handle spawn_decision with skip flag
    - Log when spawn is skipped due to low confidence
    - _Requirements: 12.4_

  - [ ] 9.4 Update reward calculator for spawn gating
    - File: `server/ai_engine/reward_calculator.py`
    - Add reward for spawn with no targets (negative: wasted energy)
    - Add reward for skip with no targets (neutral: conserved)
    - Add reward for skip with targets (negative: missed opportunity)
    - Track whether spawn was executed or skipped
    - _Requirements: 12.5_

  - [ ] 9.5 Add target presence detection
    - File: `server/ai_engine/feature_extractor.py`
    - Method: has_valid_targets(observation_data) → boolean
    - Check for workers > 0 or player buildings
    - Used by reward calculator to determine if skip was smart
    - _Requirements: 12.6_

  - [ ] 9.6 Add configuration for threshold tuning
    - File: `server/ai_engine/config.py` (new or existing)
    - CONFIDENCE_THRESHOLD: float = 0.5
    - EXPLORATION_RATE: float = 0.1 (chance to spawn despite low confidence)
    - Make configurable via environment or config file
    - _Requirements: 12.7_

### Phase 10: Spawn Location Rewards (Strategic Spatial Awareness)

- [ ] 10. Implement Spawn Location Rewards
  - [ ] 10.1 Add hive chunk to observation data (Frontend)
    - File: `client/src/game/types/ObservationTypes.ts`
    - Add hiveChunk: number to ObservationData interface
    - _Requirements: 13.1_

  - [ ] 10.2 Calculate and send hive chunk (Frontend)
    - File: `client/src/game/systems/ObservationCollector.ts`
    - Calculate hiveChunk from Queen/territory position:
      - hiveChunkX = floor(queenPosition.x / 64)
      - hiveChunkZ = floor(queenPosition.z / 64)
      - hiveChunk = hiveChunkZ * 20 + hiveChunkX
    - Include hiveChunk in observation data sent to backend
    - _Requirements: 13.1_

  - [ ] 10.3 Add chunk distance calculation (Backend)
    - File: `server/ai_engine/reward_calculator.py`
    - Method: _chunk_distance(chunk1, chunk2) → float
    - Implementation:
      - x1, z1 = chunk1 % 20, chunk1 // 20
      - x2, z2 = chunk2 % 20, chunk2 // 20
      - distance = sqrt((x1-x2)^2 + (z1-z2)^2)
    - Method: _normalize_distance(distance) → float (0-1)
      - return distance / 26.87 (max possible distance)
    - _Requirements: 13.2_

  - [ ] 10.4 Implement idle mode reward (hive proximity)
    - File: `server/ai_engine/reward_calculator.py`
    - Detect idle state: len(workers_present) == 0
    - Calculate distance from spawn_chunk to hive_chunk
    - Apply penalty: normalized_distance * hive_proximity_penalty_weight
    - Default weight: -0.3
    - _Requirements: 13.3_

  - [ ] 10.5 Implement active mode reward (threat proximity)
    - File: `server/ai_engine/reward_calculator.py`
    - Detect active state: len(workers_present) > 0
    - Get worker chunks from workers_present array
    - Calculate distance from spawn_chunk to each worker chunk
    - Use minimum distance (nearest worker)
    - Apply penalty: normalized_min_distance * threat_proximity_penalty_weight
    - Default weight: -0.4
    - _Requirements: 13.4_

  - [ ] 10.6 Integrate spawn location reward
    - File: `server/ai_engine/reward_calculator.py`
    - Add spawn_location to reward components
    - Only apply when spawn actually occurs (not when skipped)
    - Add to total reward calculation
    - _Requirements: 13.5_

  - [ ] 10.7 Add configuration parameters
    - File: `server/ai_engine/reward_calculator.py`
    - Add to RewardConfig dataclass:
      - hive_proximity_penalty_weight: float = -0.3
      - threat_proximity_penalty_weight: float = -0.4
      - max_chunk_distance: float = 26.87
    - _Requirements: 13.6_

  - [ ] 10.8 Add logging for spawn location decisions
    - File: `server/ai_engine/reward_calculator.py`
    - Log spawn location mode (IDLE vs ACTIVE)
    - Log spawn chunk, hive chunk, nearest worker chunk
    - Log calculated distance and penalty
    - Follow existing structured logging format
    - _Requirements: 13.6_

### Phase 11: Testing & Validation

- [ ] 11. Testing
  - [ ] 11.1 Test Queen Energy System
    - Verify regeneration rate (3.0/sec)
    - Verify spawn costs (15 energy, 25 combat)
    - Verify capacity calculation
    - Verify spawn rejection when insufficient
    - _Requirements: 2.1-2.5, 9.1-9.6_

  - [ ] 11.2 Test event-driven worker tracking
    - Verify O(1) add/remove
    - Verify set accuracy vs full iteration
    - _Requirements: 8.1-8.5_

  - [ ] 11.3 Test observation collection
    - Verify 15-second window timing
    - Verify all data fields populated
    - Verify parasite rate calculation
    - Verify hive chunk is included
    - _Requirements: 1.1-1.5, 7.1, 13.1_

  - [ ] 11.4 Test NN inference
    - Verify 29 inputs processed
    - Verify 257 outputs generated
    - Verify chunk selection via argmax
    - Verify type selection via threshold
    - _Requirements: 6.1-6.6_

  - [ ] 11.5 Test spawn execution
    - Verify chunk-to-position conversion
    - Verify territory validation
    - Verify energy deduction
    - _Requirements: 4.3-4.5, 5.3-5.5_

  - [ ] 11.6 Test confidence-based spawn gating
    - Verify confidence calculation (max of chunk probs)
    - Verify skip when confidence < threshold
    - Verify spawn when confidence >= threshold
    - Verify reward shaping for skip vs spawn scenarios
    - _Requirements: 12.1-12.7_

  - [ ] 11.7 Test spawn location rewards
    - Verify chunk distance calculation
    - Verify idle mode (hive proximity penalty)
    - Verify active mode (threat proximity penalty)
    - Verify reward only applied on actual spawn
    - Verify logging output format
    - _Requirements: 13.1-13.7_

  - [ ] 11.8 Performance testing
    - Verify < 5% CPU overhead
    - Verify < 50ms inference time
    - Verify 60 FPS maintained
    - _Requirements: 10.1-10.5_

### Final Checkpoint

- [ ] Queen Energy System implemented and integrated
- [ ] Event-driven worker tracking operational
- [ ] ObservationCollector sending data every 15s (includes hiveChunk)
- [ ] Backend preprocessing 29 features correctly
- [ ] NNModel with split heads operational
- [ ] Spawn decisions executing correctly
- [ ] Confidence-based spawn gating working (skip when uncertain)
- [ ] Reward signals driving learning (including spawn gating rewards)
- [ ] Spawn location rewards working (hive proximity + threat proximity)
- [ ] Performance requirements met (60 FPS, < 50ms inference)

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `client/src/game/systems/QueenEnergySystem.ts` | Create | Queen spawn energy management |
| `client/src/game/types/QueenEnergyTypes.ts` | Create | Energy configuration types |
| `client/src/game/systems/ObservationCollector.ts` | Modify | Add hiveChunk calculation |
| `client/src/game/types/ObservationTypes.ts` | Modify | Add hiveChunk field |
| `client/src/game/utils/ChunkUtils.ts` | Create | Chunk-to-position utilities |
| `client/src/game/entities/Queen.ts` | Modify | Add energy system |
| `client/src/game/entities/Worker.ts` | Modify | Mining events + chunk tracking |
| `client/src/game/UnitManager.ts` | Modify | Mining worker set tracking |
| `client/src/game/ParasiteManager.ts` | Modify | Energy check + chunk spawn + remove auto-respawn |
| `client/src/game/AdaptiveQueenIntegration.ts` | Modify | WebSocket integration |
| `server/ai_engine/feature_extractor.py` | Create | 29-feature extraction |
| `server/ai_engine/nn_model.py` | Create | Split-head NN architecture |
| `server/ai_engine/reward_calculator.py` | Modify | Add spawn location rewards |
| `server/websocket/message_handler.py` | Modify | Message handling |

## Notes

- Research document: `.kiro/research/nn-co-research-sessions.md`
- Auto-respawn removed from ParasiteManager - NN controls all spawning decisions
