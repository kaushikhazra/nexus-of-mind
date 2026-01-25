# Implementation Plan: NN-Gate Separation

## Overview

Add "no-spawn" capability to the Neural Network by extending the chunk output to 257 classes (0-255 = spawn locations, 256 = no spawn). The gate validates both spawn and no-spawn decisions, providing bidirectional training signals.

## Dependencies

- NNModel (nn_model.py) - current 256-chunk architecture
- SimulationGate (gate.py) - existing gate evaluation
- Message Handler - WebSocket observation handling
- Dashboard - NN visualization pipeline

## Tasks

### Phase 1: NN Architecture Update

- [x] 1. Extend chunk output to 257
  - [x] 1.1 Update chunk output size
    - File: `server/ai_engine/nn_model.py`
    - Change: `self.chunk_output_size = 256` → `self.chunk_output_size = 257`
    - _Requirements: 1.1_

  - [x] 1.2 Add no-spawn constant
    - File: `server/ai_engine/nn_model.py`
    - Add: `NO_SPAWN_CHUNK = 256` at module level
    - _Requirements: 1.2_

  - [x] 1.3 Rebuild model with 257 outputs
    - Verify chunk head builds correctly with 257-dim softmax
    - Verify parameter count increases by ~33
    - _Requirements: 1.3_

- [x] 2. Update get_spawn_decision()
  - [x] 2.1 Handle no-spawn output
    - File: `server/ai_engine/nn_model.py`
    - Check: `if spawn_chunk == NO_SPAWN_CHUNK`
    - Return: `{'spawnChunk': -1, 'spawnType': None, 'confidence': X, 'nnDecision': 'no_spawn'}`
    - _Requirements: 1.4, 1.5_

  - [x] 2.2 Update spawn output format
    - Add: `'nnDecision': 'spawn'` to return dict
    - _Requirements: 1.4_

- [x] 3. Update train_with_reward()
  - [x] 3.1 Accept chunk_id=-1 for no-spawn
    - File: `server/ai_engine/nn_model.py`
    - Map: `chunk_id=-1` → `target_chunk=256`
    - _Requirements: 3.1_

  - [x] 3.2 Update target array size
    - Change: `np.zeros(256)` → `np.zeros(257)`
    - _Requirements: 3.2_

  - [x] 3.3 Handle spawn_type=None
    - Use neutral type target (0.5) for no-spawn training
    - _Requirements: 3.3_

### Phase 2: Gate No-Spawn Evaluation

- [x] 4. Add no-spawn evaluation to gate
  - [x] 4.1 Update evaluate() method
    - File: `server/ai_engine/simulation/gate.py`
    - Add routing: `if spawn_chunk == -1: return self._evaluate_no_spawn(...)`
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 Implement _evaluate_no_spawn()
    - Find best available chunk via `_find_best_spawn()`
    - Compare best_reward to threshold
    - Return: `CORRECT_WAIT` or `SHOULD_SPAWN`
    - _Requirements: 2.2, 2.3_

  - [x] 4.3 Implement _find_best_spawn()
    - Get candidate chunks near workers
    - Evaluate each with cost function
    - Return: `(best_chunk, best_reward, best_type)`
    - _Requirements: 2.3_

  - [x] 4.4 Implement _get_candidate_chunks()
    - Collect chunks with workers/mining activity
    - Include neighboring chunks
    - Limit to 20 candidates for performance
    - _Requirements: 2.3_

  - [x] 4.5 Add new gate decision types
    - Add: `'CORRECT_WAIT'`, `'SHOULD_SPAWN'` to GateDecision
    - _Requirements: 2.4_

### Phase 3: Message Handler Integration

- [x] 5. Update message handler for no-spawn
  - [x] 5.1 Handle nnDecision='no_spawn'
    - File: `server/websocket/message_handler.py`
    - Branch on `spawn_decision['nnDecision']`
    - _Requirements: 2.1_

  - [x] 5.2 Apply training signals for no-spawn
    - `CORRECT_WAIT` → train with +0.2 reward on chunk=-1
    - `SHOULD_SPAWN` → train with negative reward on chunk=-1
    - _Requirements: 3.1, 3.2_

  - [x] 5.3 Update response building
    - Send same format for spawn and no-spawn
    - `{spawnChunk: X, spawnType: Y, confidence: Z}`
    - _Requirements: 4.1, 4.2_

  - [x] 5.4 Update logging
    - Log: `[NN Decision] NO_SPAWN, confidence=X`
    - Log: `[Gate Validation] CORRECT_WAIT` or `SHOULD_SPAWN`
    - _Requirements: 3.4_

### Phase 4: Dashboard Updates

- [x] 6. Update dashboard metrics
  - [x] 6.1 Rename nn_output to nn_inference
    - File: `server/ai_engine/simulation/dashboard_metrics.py`
    - Update: `record_gate_decision()` parameter name
    - Update: `last_pipeline` key name
    - _Requirements: 5.1_

  - [x] 6.2 Add nn_decision field
    - Include: `'nn_decision': 'spawn'` or `'no_spawn'`
    - _Requirements: 5.1_

  - [x] 6.3 Remove skip field
    - Remove: `'skip': decision.decision == 'WAIT'` from gate.py
    - _Requirements: 5.3_

  - [x] 6.4 Track no-spawn statistics
    - Add counter for no-spawn decisions
    - Track correct vs missed opportunities
    - _Requirements: 5.1_

- [x] 7. Update dashboard HTML
  - [x] 7.1 Add Decision row to NN Inference stage
    - File: `server/static/nn_dashboard.html`
    - Show: "SPAWN" or "NO SPAWN"
    - _Requirements: 5.1_

  - [x] 7.2 Handle no-spawn display
    - Show chunk/type as "N/A" when no-spawn
    - _Requirements: 5.1_

  - [x] 7.3 Update Decision stage for no-spawn
    - Show: "CORRECT" (green) or "SHOULD SPAWN" (red)
    - _Requirements: 5.2_

  - [x] 7.4 Update JavaScript
    - Change: `pipeline.nn_output` → `pipeline.nn_inference`
    - Handle: `nn_decision` field
    - _Requirements: 5.1, 5.2_

### Phase 5: Model Compatibility

- [x] 8. Handle old model files
  - [x] 8.1 Add architecture version to metadata
    - File: `server/ai_engine/nn_model.py`
    - Add: `'architecture_version': 2` to model metadata
    - _Requirements: 6.3_

  - [x] 8.2 Detect architecture mismatch
    - Check output size on model load
    - Log warning if 256 vs 257 mismatch
    - _Requirements: 6.1, 6.2_

  - [x] 8.3 Reinitialize on mismatch
    - Build fresh model with 257 outputs
    - Do not crash on old model files
    - _Requirements: 6.2_

### Phase 6: Frontend Alignment

- [x] 9. Update frontend spawn handling
  - [x] 9.1 Find spawn_decision handler
    - Locate where WebSocket response is processed
    - _Requirements: 5.1_

  - [x] 9.2 Update spawn logic
    - Check: `if spawnChunk >= 0` → execute spawn
    - Check: `if spawnChunk == -1` → do nothing
    - _Requirements: 5.1, 5.2_

  - [x] 9.3 Handle spawnType=null
    - No action when type is null
    - _Requirements: 5.2_

  - [x] 9.4 Remove skip field handling
    - Remove any code checking for 'skip' field
    - _Requirements: 5.3_

### Phase 7: Testing

- [x] 10. Verification
  - [x] 10.1 Server startup test
    - Verify no errors on startup with new architecture
    - Verify model builds with 257 outputs

  - [x] 10.2 No-spawn inference test
    - Run simulator
    - Verify NN occasionally outputs chunk=256 (random initially)
    - Verify gate validates no-spawn decisions

  - [x] 10.3 Dashboard test
    - Verify pipeline shows "NO SPAWN" for chunk=256
    - Verify gate validation displayed correctly

  - [x] 10.4 Training test
    - Verify positive signal for CORRECT_WAIT
    - Verify negative signal for SHOULD_SPAWN
    - Monitor learning over time

  - [x] 10.5 Frontend test
    - Verify spawn works when spawnChunk >= 0
    - Verify no action when spawnChunk == -1

### Phase 8: Exploration Mechanism (Critical Fix)

- [x] 11. Implement exploration via sampling
  - [x] 11.1 Replace argmax with sampling
    - File: `server/ai_engine/nn_model.py`
    - Change: `np.argmax(chunk_probs)` → `np.random.choice(len(chunk_probs), p=chunk_probs)`
    - _Requirements: 7.1_

  - [x] 11.2 Add explore parameter to get_spawn_decision()
    - Add: `explore: bool = True` parameter
    - If explore=True: sample from distribution
    - If explore=False: use argmax (greedy)
    - _Requirements: 7.2, 7.3_

  - [x] 11.3 Verify exploration works
    - Reset NN weights
    - Run simulator
    - Verify NN proposes DIFFERENT chunks over time (not stuck on one)
    - _Requirements: 7.4, 7.5_

## Completion Criteria

1. [x] NN model has 257 chunk outputs
2. [x] get_spawn_decision() returns nnDecision='no_spawn' when chunk=256
3. [x] Gate evaluates no-spawn decisions and returns CORRECT_WAIT or SHOULD_SPAWN
4. [x] Training signals applied correctly for both directions
5. [x] Dashboard shows NN decision separately from gate validation
6. [x] No "skip" field anywhere in the system
7. [x] Frontend handles spawnChunk=-1 correctly
8. [x] Old model files handled gracefully
9. [x] NN uses exploration (sampling) to avoid getting stuck on single chunk

## Rollback Plan

If issues arise:
1. Revert chunk_output_size to 256
2. Remove no-spawn handling from gate
3. Restore original response format
4. The gate continues to work for spawn-only decisions
