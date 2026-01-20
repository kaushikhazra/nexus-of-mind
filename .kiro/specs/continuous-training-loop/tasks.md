# Implementation Plan: Continuous Training Loop

## Overview

Implement a continuous training system that decouples NN training from inference. Training runs in a background thread, producing new model versions every second, while inference uses the latest model.

**Core Principle:** Gate IS the cost function. The gate returns `gate_signal = R_expected - 0.6` (numeric). This signal IS the training feedback - no re-evaluation during training.

## Dependencies

- Simulation-Gated Inference (complete)
- PyTorch for model training
- Threading for background training

## Tasks

### Phase 1: Experience Replay Buffer

- [ ] 1. Create experience module structure
  - [ ] 1.1 Create directory structure
    - Directory: `server/ai_engine/training/`
    - Files: `__init__.py`, `experience.py`, `buffer.py`, `config.py`
    - _Requirements: 1.1_

  - [ ] 1.2 Create Experience dataclass
    - File: `server/ai_engine/training/experience.py`
    - Fields: observation, spawn_chunk, spawn_type, nn_confidence
    - Gate fields: gate_signal (float), R_expected (float)
    - Execution: was_executed (bool)
    - Outcome: actual_reward (Optional[float], None for WAIT)
    - Metadata: timestamp, territory_id, model_version
    - Properties: is_send, is_wait, has_actual_reward
    - _Requirements: 1.1_

- [ ] 2. Implement ExperienceReplayBuffer
  - [ ] 2.1 Create buffer class
    - File: `server/ai_engine/training/buffer.py`
    - Fixed capacity with deque
    - Thread-safe with Lock
    - _Requirements: 1.2, 1.5_

  - [ ] 2.2 Implement add() method
    - WAIT actions: add directly to buffer
    - SEND actions without reward: store as pending
    - SEND actions with reward: add to buffer
    - _Requirements: 1.3_

  - [ ] 2.3 Implement update_pending_reward() method
    - Update pending SEND experience with actual reward
    - Move to main buffer
    - _Requirements: 1.3_

  - [ ] 2.4 Implement sample() method
    - Random batch sampling
    - Include both SEND and WAIT experiences
    - _Requirements: 1.4_

  - [ ] 2.5 Add buffer statistics
    - Size, send_count, wait_count, pending_count
    - Thread-safe getter
    - _Requirements: 8.2_

- [ ] 3. Add unit tests for buffer
  - [ ] 3.1 Test basic operations
    - File: `server/tests/test_continuous_training.py`
    - Test add (SEND and WAIT), sample, update_pending_reward
    - _Requirements: 1.2-1.5_

  - [ ] 3.2 Test thread safety
    - Concurrent add from multiple threads
    - Concurrent sample during add
    - Lock timeout behavior
    - _Requirements: 7.1_

### Phase 2: Continuous Trainer

- [ ] 4. Create ContinuousTrainer class
  - [ ] 4.1 Create trainer module
    - File: `server/ai_engine/training/trainer.py`
    - Initialize with model, buffer, config
    - NO gate reference (gate_signal stored in experience)
    - _Requirements: 2.1_

  - [ ] 4.2 Implement training loop
    - Background thread with daemon=True
    - Sleep for training_interval
    - Sample batch → Calculate rewards → Train
    - _Requirements: 2.2_

  - [ ] 4.3 Implement start/stop methods
    - start() - spawn thread
    - stop() - graceful shutdown with timeout
    - _Requirements: 2.4_

  - [ ] 4.4 Implement get_model_for_inference()
    - Return model reference (thread-safe)
    - _Requirements: 2.3_

- [ ] 5. Implement model versioning
  - [ ] 5.1 Add version counter
    - Increment on each training step
    - Thread-safe access
    - _Requirements: 3.1, 3.2_

  - [ ] 5.2 Log version with training
    - Include version in training logs
    - Track which version made each decision
    - _Requirements: 3.3_

- [ ] 6. Implement training reward calculation
  - [ ] 6.1 Calculate reward for SEND actions
    - If actual_reward available: `gate_weight × gate_signal + actual_weight × actual_reward`
    - If pending: use gate_signal only
    - _Requirements: 5.1_

  - [ ] 6.2 Calculate reward for WAIT actions
    - Use gate_signal directly (negative = penalty)
    - _Requirements: 5.1_

  - [ ] 6.3 Track average gate_signal in metrics
    - Rolling average of gate_signal per batch
    - _Requirements: 8.1_

- [ ] 7. Add trainer tests
  - [ ] 7.1 Test training loop
    - Verify training steps execute
    - Verify batch sampling
    - _Requirements: 2.2_

  - [ ] 7.2 Test thread lifecycle
    - Start, stop, restart
    - Graceful shutdown
    - _Requirements: 2.4, 7.2_

  - [ ] 7.3 Test reward calculation
    - SEND with actual_reward
    - SEND pending (no actual_reward)
    - WAIT (negative gate_signal)
    - _Requirements: 5.1_

### Phase 3: Configuration

- [ ] 8. Create configuration
  - [ ] 8.1 Create ContinuousTrainingConfig
    - File: `server/ai_engine/training/config.py`
    - training_interval, batch_size, min_batch_size
    - buffer_capacity, lock_timeout
    - gate_weight, actual_weight
    - learning_rate, reward_threshold
    - enabled flag
    - _Requirements: 6.1_

  - [ ] 8.2 Create YAML config file
    - File: `server/ai_engine/configs/continuous_training.yaml`
    - All parameters documented
    - _Requirements: 6.2_

  - [ ] 8.3 Implement config loader
    - Load from YAML
    - Validate on load
    - Fall back to defaults
    - _Requirements: 6.3, 6.4_

### Phase 4: Integration

- [ ] 9. Integrate with message handler
  - [ ] 9.1 Initialize training components
    - Create buffer and trainer in __init__
    - Start trainer on startup
    - _Requirements: 9.1_

  - [ ] 9.2 Update observation handling
    - Extract gate_signal from gate result
    - Determine was_executed from gate_signal > 0
    - Create experience and add to buffer
    - Update pending SEND rewards on observation
    - _Requirements: 9.2_

  - [ ] 9.3 Add enable/disable support
    - Check config.enabled flag
    - Fall back to current behavior when disabled
    - _Requirements: 9.4_

- [ ] 10. Add integration tests
  - [ ] 10.1 Test full pipeline
    - File: `server/tests/test_training_integration.py`
    - Mock observations through training
    - Verify model updates
    - _Requirements: 9.1-9.4_

  - [ ] 10.2 Test pending reward flow
    - Create pending SEND experience
    - Update with reward on next observation
    - Verify experience in buffer with reward
    - _Requirements: 4.1, 4.2_

  - [ ] 10.3 Test WAIT experience flow
    - Create WAIT experience (negative gate_signal)
    - Verify added directly to buffer
    - Verify sampled for training
    - _Requirements: 5.1_

### Phase 5: Metrics and Observability

- [ ] 11. Implement training metrics
  - [ ] 11.1 Create TrainingMetrics class
    - File: `server/ai_engine/training/metrics.py`
    - Rolling averages for loss, batch size, time, gate_signal
    - Lifetime counters
    - _Requirements: 8.1_

  - [ ] 11.2 Add metrics API endpoint
    - GET /api/training/stats
    - Return JSON with all metrics
    - _Requirements: 8.4_

- [ ] 12. Update dashboard
  - [ ] 12.1 Add training section
    - Model version indicator
    - Training loss graph
    - Steps per second
    - Average gate_signal
    - _Requirements: 8.1, 8.3_

  - [ ] 12.2 Add buffer visualization
    - Buffer size gauge
    - SEND vs WAIT counts
    - Pending count
    - Utilization percentage
    - _Requirements: 8.2_

### Phase 6: Performance and Polish

- [ ] 13. Performance optimization
  - [ ] 13.1 Profile training step
    - Ensure < training_interval
    - Optimize batch preparation
    - _Requirements: 10.1_

  - [ ] 13.2 Profile buffer operations
    - Ensure add < 1ms
    - Ensure sample < 10ms
    - _Requirements: 10.2_

  - [ ] 13.3 Verify inference latency
    - Measure latency before/after
    - Ensure < 1ms increase
    - _Requirements: 10.3_

- [ ] 14. Error handling
  - [ ] 14.1 Handle training errors
    - Catch exceptions in loop
    - Log and continue
    - _Requirements: 7.2_

  - [ ] 14.2 Handle buffer errors
    - Lock timeout handling
    - Memory pressure handling
    - _Requirements: 7.1, 7.3_

## Completion Criteria

1. [ ] Experience replay buffer stores SEND and WAIT experiences correctly
2. [ ] Background training runs every 1 second without blocking inference
3. [ ] Model version increments with each training step
4. [ ] SEND pending rewards are updated when observations arrive
5. [ ] WAIT experiences use gate_signal directly as penalty
6. [ ] Training reward = gate_weight × gate_signal + actual_weight × actual_reward (for SEND)
7. [ ] All operations are thread-safe
8. [ ] Metrics are exposed via API and dashboard
9. [ ] Performance meets requirements

## Rollback Plan

If issues arise:
1. Set `enabled: false` in config
2. System falls back to current training behavior
3. No code changes required to disable
