# Implementation Plan: Simulation-Gated Inference

## Overview

Implement a predictive cost function that evaluates NN spawn decisions before execution. The system uses game dynamics encoded as mathematical formulas to simulate expected outcomes, providing immediate training feedback to the NN.

## Dependencies

- Queen NN v2 (complete) - observation pipeline, feature extraction, reward calculator
- PyTorch for GPU-accelerated cost function
- Existing continuous learning infrastructure

## Tasks

### Phase 1: Cost Function Components

- [ ] 1. Create simulation module structure
  - [ ] 1.1 Create directory structure
    - Directory: `server/ai_engine/simulation/`
    - Files: `__init__.py`, `config.py`
    - _Requirements: 12.1_

  - [ ] 1.2 Create SimulationGateConfig dataclass
    - File: `server/ai_engine/simulation/config.py`
    - All parameters with defaults from design doc
    - Validation method for config values
    - _Requirements: 12.1-12.4_

- [ ] 2. Implement survival probability component
  - [ ] 2.1 Create survival calculation module
    - File: `server/ai_engine/simulation/components/survival.py`
    - Function: `calculate_survival_probability(spawn_chunk, protector_chunks, config)`
    - Vectorized PyTorch implementation
    - _Requirements: 1.1-1.6_

  - [ ] 2.2 Implement chunk distance utilities
    - File: `server/ai_engine/simulation/components/utils.py`
    - Function: `chunk_to_coords_batch(chunk_ids)` - convert to grid coords
    - Function: `chunk_distance_batch(chunks1, chunks2)` - Euclidean distance
    - Constant: `MAX_DISTANCE = 26.87`
    - _Requirements: 1.1_

  - [ ] 2.3 Implement threat factor calculation
    - Kill zone: distance < kill_range → threat = 1.0
    - Threat zone: kill_range ≤ d < safe_range → threat = exp(-λ × (d - kill_range))
    - Safe zone: distance ≥ safe_range → threat = 0.0
    - _Requirements: 1.2-1.5_

- [ ] 3. Implement worker disruption component
  - [ ] 3.1 Create disruption calculation module
    - File: `server/ai_engine/simulation/components/disruption.py`
    - Function: `calculate_worker_disruption(spawn_chunk, worker_chunks, survival_prob, config)`
    - Scale by survival probability
    - _Requirements: 2.1-2.6_

  - [ ] 3.2 Implement disruption factor calculation
    - Flee zone: distance < flee_range → disruption = 1.0
    - Effect zone: flee_range ≤ d < ignore_range → disruption = exp(-μ × (d - flee_range))
    - No effect: distance ≥ ignore_range → disruption = 0.0
    - _Requirements: 2.2-2.5_

- [ ] 4. Implement location penalty component
  - [ ] 4.1 Create location penalty module
    - File: `server/ai_engine/simulation/components/location.py`
    - Function: `calculate_location_penalty(spawn_chunk, hive_chunk, worker_chunks, worker_count, config)`
    - Mode detection: IDLE vs ACTIVE based on worker count
    - _Requirements: 3.1-3.5_

  - [ ] 4.2 Implement IDLE mode penalty
    - Calculate normalized distance to hive
    - Apply hive_proximity_weight
    - _Requirements: 3.1, 3.2_

  - [ ] 4.3 Implement ACTIVE mode penalty
    - Calculate distance to nearest worker
    - Apply worker_proximity_weight
    - _Requirements: 3.1, 3.3_

- [ ] 5. Implement spawn capacity validation
  - [ ] 5.1 Create capacity validation module
    - File: `server/ai_engine/simulation/components/capacity.py`
    - Function: `validate_spawn_capacity(spawn_type, queen_energy, config)`
    - Return 1.0 if affordable, -inf otherwise
    - _Requirements: 4.2_

### Phase 2: Combined Cost Function

- [ ] 6. Create combined cost function class
  - [ ] 6.1 Create SimulationCostFunction class
    - File: `server/ai_engine/simulation/cost_function.py`
    - Method: `calculate_expected_reward(observation, action, current_time)`
    - Combine all components with weights
    - _Requirements: 4.1-4.5_

  - [ ] 6.2 Implement exploration bonus tracking
    - Track last spawn time per chunk
    - Calculate time-based bonus
    - Apply exploration coefficient
    - _Requirements: 7.1-7.6_

  - [ ] 6.3 Add unit tests for cost function
    - File: `server/tests/test_cost_function.py`
    - Test each component independently
    - Test combined output
    - Test edge cases (no protectors, no workers, etc.)

### Phase 3: Simulation Gate

- [ ] 7. Implement simulation gate
  - [ ] 7.1 Create SimulationGate class
    - File: `server/ai_engine/simulation/gate.py`
    - Method: `evaluate(observation, action, nn_confidence, current_time)`
    - Return GateDecision(decision, reason, expected_reward, confidence)
    - _Requirements: 5.1-5.5_

  - [ ] 7.2 Implement confidence override logic
    - Check if nn_confidence > confidence_threshold
    - Bypass reward check if override triggered
    - Log override events
    - _Requirements: 8.1-8.5_

  - [ ] 7.3 Create GateDecision dataclass
    - Fields: decision ('SEND' | 'WAIT'), reason, expected_reward, nn_confidence
    - Components breakdown for logging
    - _Requirements: 5.3_

### Phase 4: Thinking Loop Integration

- [ ] 8. Integrate with message handler
  - [ ] 8.1 Update message handler for thinking loop
    - File: `server/websocket/message_handler.py`
    - Add SimulationGate instance
    - Evaluate gate before sending spawn decision
    - _Requirements: 6.1-6.5_

  - [ ] 8.2 Implement dual training signals
    - Train on simulation feedback when WAIT
    - Track pending action for real feedback
    - Train on real reward when next observation arrives
    - _Requirements: 9.1-9.5_

  - [ ] 8.3 Update reward weighting
    - Simulation feedback weight: 0.3
    - Real feedback weight: 0.7
    - Apply weighted combination when real feedback received
    - _Requirements: 9.4_

### Phase 5: Logging and Observability

- [ ] 9. Implement logging
  - [ ] 9.1 Add gate decision logging
    - Log every gate evaluation
    - Include all components and decision reason
    - JSON format for parsing
    - _Requirements: 11.1_

  - [ ] 9.2 Add thinking loop statistics
    - Track observations since last action
    - Track time since last action
    - Calculate gate pass rate
    - _Requirements: 11.2_

  - [ ] 9.3 Add metrics collection
    - Gate pass rate over time
    - Average expected reward
    - Confidence override rate
    - _Requirements: 11.3_

### Phase 6: Configuration and Testing

- [ ] 10. Configuration management
  - [ ] 10.1 Create YAML config file
    - File: `server/ai_engine/configs/simulation_gate.yaml`
    - All parameters with comments
    - _Requirements: 12.1_

  - [ ] 10.2 Implement config loader
    - Load from YAML file
    - Fall back to defaults if missing
    - Validate values on load
    - _Requirements: 12.2-12.4_

  - [ ] 10.3 Add hot-reload support
    - Watch config file for changes
    - Reload without restart
    - _Requirements: 12.2_

- [ ] 11. Integration testing
  - [ ] 11.1 Create integration tests
    - File: `server/tests/test_simulation_integration.py`
    - Test full pipeline with mock observations
    - Test gate decisions match expectations

  - [ ] 11.2 Performance testing
    - Verify cost function < 10ms on GPU
    - Test batch processing performance
    - _Requirements: 10.4_

### Phase 7: GPU Optimization

- [ ] 12. GPU optimization
  - [ ] 12.1 Verify PyTorch GPU usage
    - All tensors on CUDA device
    - No CPU-GPU transfers in hot path
    - _Requirements: 10.1-10.3_

  - [ ] 12.2 Implement batch processing
    - Process multiple candidate actions in parallel
    - Configurable batch size
    - _Requirements: 10.2_

  - [ ] 12.3 CPU fallback
    - Detect GPU availability
    - Graceful fallback to CPU
    - _Requirements: 10.5_

  - [ ] 12.4 Memory profiling
    - Verify < 50MB memory footprint
    - No memory leaks in long sessions
    - _Requirements: 10.6_

## Completion Criteria

1. Cost function calculates expected reward matching design formulas
2. Simulation gate correctly blocks negative reward actions
3. Thinking loop provides continuous training feedback
4. Exploration bonus prevents deadlock
5. Confidence override allows calculated risks
6. All parameters configurable via YAML
7. Logging provides full observability
8. Performance meets requirements (< 10ms on GPU)

## Rollback Plan

If issues arise:
1. Disable simulation gate via config flag (`gate_enabled: false`)
2. Fall back to existing reward calculator behavior
3. Spawn decisions go directly to frontend without gate
