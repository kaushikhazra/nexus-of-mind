# Implementation Plan: Continuous Training Loop

## Overview

Implement a continuous training system that decouples NN training from inference. Training runs in a background thread, producing new model versions every second, while inference uses the latest model.

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
    - Fields: observation, action, gate_decision, rewards, metadata
    - Properties: is_completed, effective_reward
    - _Requirements: 1.1_

- [ ] 2. Implement ExperienceReplayBuffer
  - [ ] 2.1 Create buffer class
    - File: `server/ai_engine/training/buffer.py`
    - Fixed capacity with deque
    - Thread-safe with Lock
    - _Requirements: 1.2, 1.5_

  - [ ] 2.2 Implement add() method
    - Add completed experience to buffer
    - Track pending experience by territory
    - _Requirements: 1.2, 1.3_

  - [ ] 2.3 Implement update_pending_reward() method
    - Update pending experience with actual reward
    - Move to main buffer
    - _Requirements: 1.3_

  - [ ] 2.4 Implement sample() method
    - Random batch sampling
    - Filter to completed experiences only
    - _Requirements: 1.4_

  - [ ] 2.5 Add buffer statistics
    - Size, pending count, utilization
    - Thread-safe getter
    - _Requirements: 8.2_

- [ ] 3. Add unit tests for buffer
  - [ ] 3.1 Test basic operations
    - File: `server/tests/test_continuous_training.py`
    - Test add, sample, update_pending_reward
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
    - _Requirements: 2.1_

  - [ ] 4.2 Implement training loop
    - Background thread with daemon=True
    - Sleep for training_interval
    - Sample batch and train
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

- [ ] 6. Implement reward calculation
  - [ ] 6.1 Calculate training reward
    - Combine simulation and actual rewards
    - Apply WAIT multiplier
    - _Requirements: 4.3, 5.2_

  - [ ] 6.2 Handle WAIT experiences
    - Include in training if config.train_on_wait
    - Use expected_reward with multiplier
    - _Requirements: 5.2_

- [ ] 7. Add trainer tests
  - [ ] 7.1 Test training loop
    - Verify training steps execute
    - Verify batch sampling
    - _Requirements: 2.2_

  - [ ] 7.2 Test thread lifecycle
    - Start, stop, restart
    - Graceful shutdown
    - _Requirements: 2.4, 7.2_

### Phase 3: Configuration

- [ ] 8. Create configuration
  - [ ] 8.1 Create ContinuousTrainingConfig
    - File: `server/ai_engine/training/config.py`
    - All parameters with defaults
    - Validation method
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
    - Update pending rewards on observation
    - Use trainer.get_model_for_inference()
    - Add experiences to buffer
    - _Requirements: 9.2_

  - [ ] 9.3 Add enable/disable support
    - Check config.enabled flag
    - Fall back to current behavior when disabled
    - _Requirements: 9.3_

- [ ] 10. Add integration tests
  - [ ] 10.1 Test full pipeline
    - File: `server/tests/test_training_integration.py`
    - Mock observations through training
    - Verify model updates
    - _Requirements: 9.1-9.3_

  - [ ] 10.2 Test pending reward flow
    - Create pending experience
    - Update with reward on next observation
    - Verify experience in buffer
    - _Requirements: 4.1, 4.2_

### Phase 5: Metrics and Observability

- [ ] 11. Implement training metrics
  - [ ] 11.1 Create TrainingMetrics class
    - File: `server/ai_engine/training/metrics.py`
    - Rolling averages for loss, batch size, time
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
    - _Requirements: 8.1, 8.3_

  - [ ] 12.2 Add buffer visualization
    - Buffer size gauge
    - Pending vs completed counts
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

1. [ ] Experience replay buffer stores and samples experiences correctly
2. [ ] Background training runs every 1 second without blocking inference
3. [ ] Model version increments with each training step
4. [ ] Pending rewards are updated when observations arrive
5. [ ] WAIT experiences are included in training with penalty
6. [ ] All operations are thread-safe
7. [ ] Metrics are exposed via API and dashboard
8. [ ] Performance meets requirements

## Rollback Plan

If issues arise:
1. Set `enabled: false` in config
2. System falls back to current training behavior
3. No code changes required to disable
