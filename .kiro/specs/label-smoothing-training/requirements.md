# Label Smoothing Training - Requirements

## Introduction

Implement label smoothing in the NN training pipeline to prevent mode collapse. The current one-hot training targets cause the model to over-confidently predict a single chunk (179), collapsing to 67% dominance with only 35% entropy ratio.

**Current Problem:**
- One-hot targets teach "target = 100%, others = 0%"
- Cross-entropy improvement from collapsing (5.2) >> entropy penalty (0.9)
- Model is mathematically rewarded for collapsing

**Solution:**
Replace one-hot targets with smoothed targets that maintain diversity.

## Requirements

### Requirement 1: Label Smoothing for Chunk Targets

**User Story:** As the NN, I need training targets that don't force me to zero-out non-target chunks.

#### Acceptance Criteria

1. Smoothed target SHALL distribute probability: target gets (1-α), others share α
2. Default smoothing factor α SHALL be 0.1 (10%)
3. For α=0.1 with 257 classes:
   - Target chunk: 0.9 + 0.1/257 ≈ 0.9004
   - Each other chunk: 0.1/257 ≈ 0.00039
4. Smoothed targets SHALL sum to 1.0

### Requirement 2: Apply to Reward-Based Training

**User Story:** As the training system, I need label smoothing in `train_with_reward()`.

#### Acceptance Criteria

1. Positive rewards SHALL use smoothed target centered on selected chunk
2. Negative rewards SHALL continue using current redistribution logic
3. Training SHALL work with both smoothed and hard targets (configurable)

### Requirement 3: Apply to Supervised Training

**User Story:** As the training system, I need label smoothing in `train_with_supervision()`.

#### Acceptance Criteria

1. Supervised training SHALL use smoothed targets by default
2. Smoothing factor SHALL be configurable per call
3. API backwards compatibility SHALL be maintained

### Requirement 4: Entropy Improvement

**User Story:** As the game, I need the NN to maintain exploration diversity.

#### Acceptance Criteria

1. Entropy ratio SHALL stay above 50% during training
2. Single-chunk dominance SHALL stay below 50%
3. Model SHALL still learn from reward signals (loss decreases)

## Non-Functional Requirements

- No performance regression (training speed unchanged)
- Compatible with existing entropy regularization
- Works with PyTorch GPU training

## Out of Scope

- Dynamic smoothing factor adjustment
- Per-class smoothing weights
- Type head smoothing (binary, not needed)
