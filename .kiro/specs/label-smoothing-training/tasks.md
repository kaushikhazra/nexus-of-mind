# Implementation Plan: Label Smoothing Training

## Overview

Add label smoothing to NNModel training to prevent mode collapse. Replace one-hot targets with smoothed probability distributions.

## Dependencies

- NNModel (nn_model.py) - training methods to modify
- Game Simulator - for testing

## Tasks

### Phase 1: Implementation

- [ ] 1. Add label smoothing constant and helper method
  - [ ] 1.1 Add DEFAULT_LABEL_SMOOTHING constant
    - File: `server/ai_engine/nn_model.py`
    - Value: 0.1 (10% smoothing)
    - _Requirements: 1.1_

  - [ ] 1.2 Implement `_create_smoothed_target()` method
    - File: `server/ai_engine/nn_model.py`
    - Args: target_idx, alpha
    - Returns: smoothed probability array (257,)
    - _Requirements: 1.2, 1.4_

- [ ] 2. Modify training methods
  - [ ] 2.1 Update `train_with_reward()` for positive rewards
    - File: `server/ai_engine/nn_model.py`
    - Use smoothed target instead of one-hot for positive rewards
    - Keep negative reward logic unchanged
    - _Requirements: 2.1, 2.2_

  - [ ] 2.2 Update `train_with_supervision()`
    - File: `server/ai_engine/nn_model.py`
    - Use smoothed target instead of one-hot
    - _Requirements: 3.1, 3.2_

### Phase 2: Short Test (200 ticks)

- [ ] 3. Run short simulation test
  - [ ] 3.1 Start server (auto-restart on code change)
    - Verify NNModel loads successfully
    - _Requirements: 4.1_

  - [ ] 3.2 Run 200-tick simulation
    - Command: `python -m game_simulator.main --turbo --ticks 200`
    - Observe entropy via dashboard API
    - _Requirements: 4.2_

  - [ ] 3.3 Check entropy metrics
    - Query: `/api/nn-dashboard`
    - Success: entropy ratio > 40%
    - _Requirements: 4.1_

### Phase 3: Medium Test (500 ticks)

- [ ] 4. Run medium simulation test
  - [ ] 4.1 Run 500-tick simulation
    - Command: `python -m game_simulator.main --turbo --ticks 500`
    - _Requirements: 4.1, 4.2_

  - [ ] 4.2 Verify entropy improvement
    - Success: entropy ratio > 50%
    - Success: chunk 179 dominance < 50%
    - _Requirements: 4.2, 4.3_

### Phase 4: Long Test (1000 ticks)

- [ ] 5. Run long simulation test
  - [ ] 5.1 Run 1000-tick simulation
    - Command: `python -m game_simulator.main --turbo --ticks 1000`
    - _Requirements: 4.1_

  - [ ] 5.2 Verify sustained diversity
    - Entropy ratio stays above 50% throughout
    - No mode collapse observed
    - Model still learning (rewards affect behavior)
    - _Requirements: 4.2, 4.3_

### Phase 5: Iteration (Max 3 cycles)

- [ ] 6. Adjust if needed (max 3 iterations)
  - [ ] 6.1 If entropy too low: increase alpha to 0.15 or 0.2
    - Rerun Phase 3 test
    - _Requirements: 4.1_

  - [ ] 6.2 If model not learning: decrease alpha to 0.05
    - Rerun Phase 3 test
    - _Requirements: 4.3_

  - [ ] 6.3 Document final alpha value
    - Update DEFAULT_LABEL_SMOOTHING
    - _Requirements: 1.1_

## Completion Criteria

1. [ ] `_create_smoothed_target()` implemented and working
2. [ ] `train_with_reward()` uses smoothed targets for positive rewards
3. [ ] `train_with_supervision()` uses smoothed targets
4. [ ] Entropy ratio > 50% in 500-tick test
5. [ ] Chunk dominance < 50% in 500-tick test
6. [ ] No regression in training ability (model learns from rewards)

## Iteration Limit

Maximum 3 adjustment cycles in Phase 5. If not resolved after 3 iterations:
1. Document current state
2. Consider alternative approaches
3. Escalate for design review
