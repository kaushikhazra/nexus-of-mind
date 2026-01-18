# Implementation Plan: Queen Neural Network v2.0

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

- [x] 3. Create ObservationCollector V2 ✓
  - [x] 3.1 Create ObservationCollectorV2 class ✓
    - File: `client/src/game/systems/ObservationCollectorV2.ts` (new)
    - Method: collectRawData(): ObservationDataV2
    - Collect mining workers with chunk IDs
    - Collect protectors with chunk IDs
    - Collect parasites (energy/combat) with chunk IDs
    - Collect Queen energy state
    - Collect player energy (start/end of window)
    - _Requirements: 1.1-1.5, 7.1_

  - [x] 3.2 Create observation data types ✓
    - File: `client/src/game/types/ObservationTypesV2.ts` (new)
    - Interface: ObservationDataV2
    - Interface: WorkerData { x, y, chunkId }
    - Interface: ProtectorData { x, y, chunkId }
    - Interface: ParasiteData { chunkId, type }
    - Interface: QueenEnergyData { current, max }
    - Interface: PlayerEnergyData { start, end }
    - _Requirements: 7.1_

  - [x] 3.3 Implement 15-second observation window ✓
    - File: `client/src/game/systems/ObservationCollectorV2.ts`
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

- [x] 4. Create Feature Extractor V2 (Backend) ✓
  - [x] 4.1 Create FeatureExtractorV2 class ✓
    - File: `server/ai_engine/feature_extractor_v2.py` (new)
    - Method: extract_features(observation_data) → [28 floats]
    - _Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.5_

  - [x] 4.2 Implement top 5 chunk selection ✓
    - File: `server/ai_engine/feature_extractor_v2.py`
    - Group mining workers by chunk
    - Calculate mining worker density per chunk
    - Select top 5 chunks by density
    - Pad with zeros if fewer than 5
    - _Requirements: 1.1, 1.5_

  - [x] 4.3 Implement per-chunk feature calculation ✓
    - File: `server/ai_engine/feature_extractor_v2.py`
    - For each of top 5 chunks:
      - chunk_id / 255 → normalized chunk ID
      - workers_in_chunk / total_mining_workers → worker density
      - protectors_in_chunk / total_protectors → protector density
      - (parasites_end - parasites_start) / max(...) → parasite rates
    - _Requirements: 1.2_

  - [x] 4.4 Implement spawn capacity calculation ✓
    - File: `server/ai_engine/feature_extractor_v2.py`
    - energy_capacity = floor(current/15) / 6
    - combat_capacity = floor(current/25) / 4
    - _Requirements: 2.2_

  - [x] 4.5 Implement player energy rate calculation ✓
    - File: `server/ai_engine/feature_extractor_v2.py`
    - rate = (end - start) / max(start, end)
    - Handle edge cases (zero values)
    - _Requirements: 3.2, 3.5_

### Phase 5: Neural Network Model V2 (Backend) ✅ COMPLETE

- [x] 5. Create Split-Head NN Architecture ✓
  - [x] 5.1 Create NNModelV2 class ✓
    - File: `server/ai_engine/nn_model_v2.py` (new)
    - Architecture: 28 → 32 → 16 → split heads
    - Input layer: 28 neurons
    - Hidden 1: 32 neurons (ReLU)
    - Hidden 2: 16 neurons (ReLU)
    - _Requirements: 6.1-6.6_

  - [x] 5.2 Implement chunk head ✓
    - File: `server/ai_engine/nn_model_v2.py`
    - Hidden 2 (16) → Expand (32) → Output (256)
    - Softmax activation
    - _Requirements: 4.1, 4.2_

  - [x] 5.3 Implement type head ✓
    - File: `server/ai_engine/nn_model_v2.py`
    - Hidden 2 (16) → Output (1)
    - Sigmoid activation
    - _Requirements: 5.1, 5.2_

  - [x] 5.4 Implement inference method ✓
    - File: `server/ai_engine/nn_model_v2.py`
    - Method: predict(features) → (chunk_probs, type_prob)
    - _Requirements: 6.1_

  - [x] 5.5 Implement post-processing ✓
    - File: `server/ai_engine/nn_model_v2.py`
    - Method: get_spawn_decision(chunk_probs, type_prob)
    - chunk_id = argmax(chunk_probs)
    - type = "energy" if type_prob < 0.5 else "combat"
    - Return: { spawn_chunk, spawn_type }
    - _Requirements: 4.3, 5.3_

### Phase 6: WebSocket Integration ✅ COMPLETE

- [x] 6. Update WebSocket Protocol ✓
  - [x] 6.1 Add observation_data_v2 handler (Backend) ✓
    - File: `server/websocket/message_handler.py`
    - Parse ObservationDataV2 format
    - Route to FeatureExtractorV2
    - Route to NNModelV2
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
  - [x] 8.1 Create RewardCalculatorV2 class ✓
    - File: `server/ai_engine/reward_calculator_v2.py` (new)
    - Method: calculate_reward(prev_obs, curr_obs) → float
    - _Requirements: 11.1-11.4_

  - [x] 8.2 Implement reward signals ✓
    - File: `server/ai_engine/reward_calculator_v2.py`
    - Positive: mining stopped, protectors reduced, player energy negative
    - Negative: mining active, protectors increased, player energy positive
    - Use rate formula: (end - start) / max(start, end)
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 8.3 Integrate reward into training loop ✓
    - File: `server/websocket/message_handler.py`
    - Use RewardCalculatorV2 for reward signals
    - Train on observation/reward pairs via NNModelV2.train_with_reward()
    - _Requirements: 11.4_

### Phase 9: Testing & Validation

- [ ] 9. Testing
  - [ ] 9.1 Test Queen Energy System
    - Verify regeneration rate (3.0/sec)
    - Verify spawn costs (15 energy, 25 combat)
    - Verify capacity calculation
    - Verify spawn rejection when insufficient
    - _Requirements: 2.1-2.5, 9.1-9.6_

  - [ ] 9.2 Test event-driven worker tracking
    - Verify O(1) add/remove
    - Verify set accuracy vs full iteration
    - _Requirements: 8.1-8.5_

  - [ ] 9.3 Test observation collection
    - Verify 15-second window timing
    - Verify all data fields populated
    - Verify parasite rate calculation
    - _Requirements: 1.1-1.5, 7.1_

  - [ ] 9.4 Test NN inference
    - Verify 28 inputs processed
    - Verify 257 outputs generated
    - Verify chunk selection via argmax
    - Verify type selection via threshold
    - _Requirements: 6.1-6.6_

  - [ ] 9.5 Test spawn execution
    - Verify chunk-to-position conversion
    - Verify territory validation
    - Verify energy deduction
    - _Requirements: 4.3-4.5, 5.3-5.5_

  - [ ] 9.6 Performance testing
    - Verify < 5% CPU overhead
    - Verify < 50ms inference time
    - Verify 60 FPS maintained
    - _Requirements: 10.1-10.5_

### Final Checkpoint

- [ ] Queen Energy System implemented and integrated
- [ ] Event-driven worker tracking operational
- [ ] ObservationCollectorV2 sending data every 15s
- [ ] Backend preprocessing 28 features correctly
- [ ] NNModelV2 with split heads operational
- [ ] Spawn decisions executing correctly
- [ ] Reward signals driving learning
- [ ] Performance requirements met (60 FPS, < 50ms inference)

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `client/src/game/systems/QueenEnergySystem.ts` | Create | Queen spawn energy management |
| `client/src/game/types/QueenEnergyTypes.ts` | Create | Energy configuration types |
| `client/src/game/systems/ObservationCollectorV2.ts` | Create | Chunk-based data collection |
| `client/src/game/types/ObservationTypesV2.ts` | Create | V2 observation data types |
| `client/src/game/utils/ChunkUtils.ts` | Create | Chunk-to-position utilities |
| `client/src/game/entities/Queen.ts` | Modify | Add energy system |
| `client/src/game/entities/Worker.ts` | Modify | Mining events + chunk tracking |
| `client/src/game/UnitManager.ts` | Modify | Mining worker set tracking |
| `client/src/game/ParasiteManager.ts` | Modify | Energy check + chunk spawn |
| `client/src/game/AdaptiveQueenIntegration.ts` | Modify | V2 WebSocket integration |
| `server/ai_engine/feature_extractor_v2.py` | Create | 28-feature extraction |
| `server/ai_engine/nn_model_v2.py` | Create | Split-head NN architecture |
| `server/ai_engine/reward_calculator_v2.py` | Create | V2 reward signals |
| `server/websocket/message_handler.py` | Modify | V2 message handling |

## Notes

- This is a parallel implementation (V2) - does not replace existing V1 system
- Can be feature-flagged for A/B testing
- Queen Energy System is shared between V1 and V2
- Event-driven tracking benefits both versions
- Research document: `.kiro/research/nn-co-research-sessions.md`
