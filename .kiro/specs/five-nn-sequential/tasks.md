# Implementation Plan: Five-NN Sequential Architecture

## Overview

Replace the single 29→257 neural network with 5 specialized sequential NNs to fix mode collapse. Each NN has focused inputs and bounded outputs, executing in sequence to produce spawn decisions.

## Dependencies

- NNModel (nn_model.py) - current single-NN implementation to replace
- FeatureExtractor (feature_extractor.py) - needs focused extraction per NN
- SimulationGate (gate.py) - uses NNModel API
- Trainer (trainer.py) - uses NNModel API
- Message Handler (message_handler.py) - uses NNModel API
- Game Simulator - uses NNModel via WebSocket

## Tasks

### Phase 1: Core NN Architecture

- [ ] 1. Create SequentialQueenNN module
  - [ ] 1.1 Define NN1: Energy Suitability network
    - File: `server/ai_engine/nn_model.py`
    - Architecture: Input(10) → Dense(8) → ReLU → Dense(5) → Sigmoid
    - Input: [protector_density, e_parasite_rate] × 5 chunks
    - Output: 5 energy suitability scores (0-1)
    - _Requirements: 1_

  - [ ] 1.2 Define NN2: Combat Suitability network
    - File: `server/ai_engine/nn_model.py`
    - Architecture: Input(10) → Dense(8) → ReLU → Dense(5) → Sigmoid
    - Input: [protector_density, c_parasite_rate] × 5 chunks
    - Output: 5 combat suitability scores (0-1)
    - _Requirements: 2_

  - [ ] 1.3 Define NN3: Type Decision network
    - File: `server/ai_engine/nn_model.py`
    - Architecture: Input(10) → Dense(8) → ReLU → Dense(2) → Softmax
    - Input: 5 energy_suit + 5 combat_suit from NN1/NN2
    - Output: [P(energy), P(combat)]
    - _Requirements: 3_

  - [ ] 1.4 Define NN4: Chunk Decision network
    - File: `server/ai_engine/nn_model.py`
    - Architecture: Input(15) → Dense(12) → ReLU → Dense(8) → ReLU → Dense(6) → Softmax
    - Input: 5 worker_density + 5 suitability + 5 saturation (pre-selected by type)
    - Output: [P(chunk0), P(chunk1), P(chunk2), P(chunk3), P(chunk4), P(NO_SPAWN)]
    - _Requirements: 4_

  - [ ] 1.5 Define NN5: Quantity Decision network
    - File: `server/ai_engine/nn_model.py`
    - Architecture: Input(7) → Dense(8) → ReLU → Dense(5) → Softmax
    - Input: chunk_saturation, chunk_suitability, queen_capacity, player_rates, type, chunk
    - Output: [P(0), P(1), P(2), P(3), P(4)]
    - _Requirements: 5_

- [ ] 2. Implement sequential forward pass
  - [ ] 2.1 Create SequentialQueenNN class
    - File: `server/ai_engine/nn_model.py`
    - Add: `class SequentialQueenNN(nn.Module)` with 5 sub-networks
    - _Requirements: 1, 2, 3, 4, 5_

  - [ ] 2.2 Implement forward() method
    - Run NN1 and NN2 (can be parallel)
    - Feed NN1+NN2 outputs to NN3
    - Build NN4 inputs based on NN3 type decision
    - Build NN5 inputs based on NN4 chunk decision
    - Skip NN5 if NN4 outputs NO_SPAWN (index 5)
    - _Requirements: 6_

  - [ ] 2.3 Add input extraction helpers
    - `_extract_nn1_input(features)` → 10 values
    - `_extract_nn2_input(features)` → 10 values
    - `_extract_nn4_input(features, e_suit, c_suit, type_decision)` → 15 values
    - `_extract_nn5_input(features, e_suit, c_suit, type_decision, chunk_decision)` → 7 values
    - _Requirements: 8_

### Phase 2: NNModel Wrapper Updates

- [ ] 3. Update NNModel class
  - [ ] 3.1 Replace model instantiation
    - File: `server/ai_engine/nn_model.py`
    - Replace: `self.model = QueenNN()` with `self.model = SequentialQueenNN()`
    - _Requirements: 1, 2, 3, 4, 5_

  - [ ] 3.2 Update predict() method
    - Call `SequentialQueenNN.forward()`
    - Return structured output with all pipeline stages
    - Include: e_suitability, c_suitability, type_probs, chunk_probs, quantity_probs
    - _Requirements: 6_

  - [ ] 3.3 Update get_spawn_decision() method
    - Map relative chunk index (0-4) to actual chunk ID using top_chunk_ids
    - Handle NO_SPAWN case (chunk index 5 → spawnChunk = -1)
    - Include quantity in return value
    - Include pipeline info for debugging
    - _Requirements: 6_

  - [ ] 3.4 Update model persistence
    - File: `server/ai_engine/nn_model.py`
    - Save: all 5 NN state_dicts in single checkpoint
    - Load: all 5 NN state_dicts from checkpoint
    - Use single version number for ensemble
    - _Requirements: 7_

### Phase 3: Feature Extraction

- [ ] 4. Extend FeatureExtractor
  - [ ] 4.1 Add extract_all() method
    - File: `server/ai_engine/feature_extractor.py`
    - Returns dict with focused inputs for each NN
    - Includes top_chunk_ids for output mapping
    - _Requirements: 8_

  - [ ] 4.2 Add NN1 feature extraction
    - `_extract_nn1_features(base_features)` → 10 values
    - Extract: [protector_density, e_parasite_rate] × 5 chunks
    - Source indices: [2,3], [7,8], [12,13], [17,18], [22,23]
    - _Requirements: 8_

  - [ ] 4.3 Add NN2 feature extraction
    - `_extract_nn2_features(base_features)` → 10 values
    - Extract: [protector_density, c_parasite_rate] × 5 chunks
    - Source indices: [2,4], [7,9], [12,14], [17,19], [22,24]
    - _Requirements: 8_

  - [ ] 4.4 Add worker density extraction
    - `_extract_worker_densities(base_features)` → 5 values
    - Source indices: [1, 6, 11, 16, 21]
    - _Requirements: 8_

  - [ ] 4.5 Add chunk ID tracking
    - `_get_top_chunk_ids(observation)` → list of actual chunk IDs
    - Store mapping for output interpretation
    - _Requirements: 8_

### Phase 4: Training Pipeline

- [ ] 5. Update training methods
  - [ ] 5.1 Create compute_loss() for 5 NNs
    - File: `server/ai_engine/nn_model.py`
    - NN1/NN2: MSE loss on suitability (regression targets)
    - NN3: Cross-entropy on type decision
    - NN4: Cross-entropy on chunk decision
    - NN5: Cross-entropy on quantity decision
    - Combine with reward weighting
    - _Requirements: 7_

  - [ ] 5.2 Update train_with_reward()
    - Create targets for all 5 NNs from experience
    - Backprop through entire chain
    - All NNs trained together (chain responsibility)
    - _Requirements: 7_

  - [ ] 5.3 Update train_step()
    - Accept 5-NN structured inputs
    - Compute combined loss
    - Run single optimizer step for all 5 NNs
    - _Requirements: 7_

- [ ] 6. Update Trainer class
  - [ ] 6.1 Update _training_step()
    - File: `server/ai_engine/training/trainer.py`
    - Call new sequential training method
    - Log individual NN losses if needed
    - _Requirements: 7_

  - [ ] 6.2 Update Experience structure
    - Add: quantity field
    - Add: pipeline decisions for analysis
    - _Requirements: 7_

### Phase 5: Integration

- [ ] 7. Update Message Handler
  - [ ] 7.1 Update feature extraction call
    - File: `server/websocket/message_handler.py`
    - Use `extract_all()` instead of `extract()`
    - Pass structured features to NNModel
    - _Requirements: 8_

  - [ ] 7.2 Update spawn decision handling
    - Handle new decision structure with quantity
    - Map relative chunk to actual chunk ID
    - _Requirements: 6_

  - [ ] 7.3 Update Experience creation
    - Include quantity in experience
    - Include pipeline info for analysis
    - _Requirements: 7_

- [ ] 8. Update Gate
  - [ ] 8.1 Update evaluate() method
    - File: `server/ai_engine/simulation/gate.py`
    - Handle quantity in evaluation
    - Adjust expected reward calculation if needed
    - _Requirements: 6_

  - [ ] 8.2 Update dashboard recording
    - Log 5-stage pipeline decisions
    - Show suitability scores
    - _Requirements: 6_

### Phase 6: Testing

- [ ] 9. Unit tests
  - [ ] 9.1 Test SequentialQueenNN forward pass
    - Verify output shapes: e_suit(5), c_suit(5), type(2), chunk(6), quantity(5)
    - Verify NO_SPAWN skips NN5 (quantity_probs[0] = 1.0)
    - _Requirements: 1, 2, 3, 4, 5, 6_

  - [ ] 9.2 Test feature extraction
    - Verify correct index mapping for each NN
    - Verify top_chunk_ids extraction
    - _Requirements: 8_

  - [ ] 9.3 Test training step
    - Verify loss computation for all 5 NNs
    - Verify backprop updates all parameters
    - _Requirements: 7_

- [ ] 10. Integration tests
  - [ ] 10.1 Run short simulation (200 ticks)
    - Command: `python -m game_simulator.main --turbo --ticks 200`
    - Verify: no crashes, pipeline executes correctly
    - _Requirements: 1-8_

  - [ ] 10.2 Run medium simulation (500 ticks)
    - Command: `python -m game_simulator.main --turbo --ticks 500`
    - Verify: entropy ratio > 50%
    - Verify: no single chunk dominates > 50%
    - _Requirements: 1-8_

  - [ ] 10.3 Run long simulation (1000 ticks)
    - Command: `python -m game_simulator.main --turbo --ticks 1000`
    - Verify: sustained diversity
    - Verify: model learning (decisions improve)
    - _Requirements: 1-8_

### Phase 7: Cleanup

- [ ] 11. Remove old code
  - [ ] 11.1 Remove old QueenNN class
    - File: `server/ai_engine/nn_model.py`
    - After verifying new architecture works
    - _Requirements: N/A_

  - [ ] 11.2 Clean up feature extractor
    - Remove unused methods if any
    - Keep backward compatibility for extract() if needed
    - _Requirements: N/A_

  - [ ] 11.3 Update documentation
    - Update research doc with final implementation details
    - Update any architecture references
    - _Requirements: N/A_

## Completion Criteria

1. [ ] SequentialQueenNN with 5 sub-networks implemented and working
2. [ ] All 5 NNs execute in correct sequence (NN1/NN2 → NN3 → NN4 → NN5)
3. [ ] Feature extractor provides focused inputs per NN via extract_all()
4. [ ] Training updates all 5 NNs together on reward signal
5. [ ] NO_SPAWN correctly skips NN5 (quantity = 0)
6. [ ] No mode collapse in 500-tick simulation (entropy > 50%)
7. [ ] Model saves/loads all 5 NNs as single unit
8. [ ] Dashboard shows 5-stage pipeline decisions

## Rollback Plan

If issues arise:
1. Keep old `QueenNN` class as `QueenNN_legacy`
2. Can switch back by changing model instantiation
3. Feature extractor keeps original `extract()` method
4. No other files need changes (API preserved)
