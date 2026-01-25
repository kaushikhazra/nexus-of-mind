# Five-NN Sequential Architecture - Requirements

## Introduction

Replace the single 29→257 neural network with 5 specialized sequential NNs to fix mode collapse and improve decision quality. The current architecture collapses to chunk 179 (~67%) because it treats 29 features as flat independent signals and outputs 257 classes for only 5 known chunks.

**Current Problem:**
- 29 inputs treated as flat features, but they're grouped information
- 257 outputs for chunks, but only 5 chunks have meaningful data
- Mode collapse to chunk 179 despite entropy regularization and label smoothing

**Solution:**
5 specialized NNs in sequence, each with focused inputs and meaningful outputs.

---

## Requirements

### Requirement 1: Energy Suitability Network (NN1)

**User Story:** As the Queen AI, I need to know how suitable each chunk is for energy parasites based on protector presence and actual survival rates.

#### Acceptance Criteria

1. NN1 SHALL accept 10 inputs: [protector_density, e_parasite_rate] × 5 chunks
2. NN1 SHALL output 5 sigmoid scores (0-1), one per chunk
3. Output SHALL represent energy parasite suitability (high = safe for energy)
4. NN1 SHALL learn from actual parasite survival, not just theoretical protector threat
5. Architecture: Input(10) → Dense(8) → ReLU → Dense(5) → Sigmoid → Output(5)

---

### Requirement 2: Combat Suitability Network (NN2)

**User Story:** As the Queen AI, I need to know how suitable each chunk is for combat parasites independently from energy suitability.

#### Acceptance Criteria

1. NN2 SHALL accept 10 inputs: [protector_density, c_parasite_rate] × 5 chunks
2. NN2 SHALL output 5 sigmoid scores (0-1), one per chunk
3. Output SHALL represent combat parasite suitability (high = combat can thrive)
4. Energy and combat suitability SHALL be independent (not 1 - each other)
5. Architecture: Input(10) → Dense(8) → ReLU → Dense(5) → Sigmoid → Output(5)

---

### Requirement 3: Type Decision Network (NN3)

**User Story:** As the Queen AI, I need to decide whether to spawn energy or combat parasites based on the suitability landscape.

#### Acceptance Criteria

1. NN3 SHALL accept 10 inputs: 5 energy_suitability + 5 combat_suitability
2. NN3 SHALL output 2 softmax probabilities: [P(energy), P(combat)]
3. NN3 SHALL choose the type that has better overall suitability
4. Architecture: Input(10) → Dense(8) → ReLU → Dense(2) → Softmax → Output(2)

---

### Requirement 4: Chunk Decision Network (NN4)

**User Story:** As the Queen AI, I need to decide which chunk to target based on worker density, suitability, and saturation.

#### Acceptance Criteria

1. NN4 SHALL accept 15 inputs:
   - 5 worker densities
   - 5 suitabilities (pre-selected based on type from NN3)
   - 5 parasite saturations (pre-selected based on type)
2. NN4 SHALL output 6 softmax probabilities: [P(chunk0-4), P(NO_SPAWN)]
3. Type SHALL be implicit in pre-selected suitability/saturation (no explicit type input)
4. Architecture: Input(15) → Dense(12) → ReLU → Dense(8) → ReLU → Dense(6) → Softmax → Output(6)

---

### Requirement 5: Quantity Decision Network (NN5)

**User Story:** As the Queen AI, I need to decide how many parasites to spawn (0-4) based on capacity, saturation, and player pressure.

#### Acceptance Criteria

1. NN5 SHALL accept 7 inputs:
   - Selected chunk parasite saturation
   - Selected chunk suitability
   - Queen spawn capacity (for chosen type)
   - Player energy rate
   - Player mineral rate
   - Type decision (from NN3)
   - Chunk selection (from NN4)
2. NN5 SHALL output 5 softmax probabilities: [P(0), P(1), P(2), P(3), P(4)]
3. NN5 SHALL be skipped if NN4 outputs NO_SPAWN
4. Architecture: Input(7) → Dense(8) → ReLU → Dense(5) → Softmax → Output(5)

---

### Requirement 6: Sequential Orchestration

**User Story:** As the system, I need to execute the 5 NNs in sequence with proper data flow.

#### Acceptance Criteria

1. Execution order SHALL be: NN1 → NN2 → NN3 → NN4 → NN5
2. NN1 and NN2 MAY run in parallel (no dependency)
3. NN3 SHALL receive outputs from NN1 and NN2
4. NN4 SHALL receive pre-selected features based on NN3's type decision
5. NN5 SHALL receive context from NN3 and NN4 decisions
6. If NN4 outputs NO_SPAWN, NN5 SHALL be skipped (quantity = 0)

---

### Requirement 7: Unified Training

**User Story:** As the training system, I need to train all 5 NNs together when a reward signal arrives.

#### Acceptance Criteria

1. All 5 NNs SHALL be trained on every reward signal (chain responsibility)
2. Single model version SHALL track the ensemble
3. Backpropagation SHALL flow through the entire chain
4. Model persistence SHALL save/load all 5 NNs as a unit
5. No backward compatibility with old single-NN model required

---

### Requirement 8: Feature Extraction

**User Story:** As the feature extractor, I need to provide focused inputs for each NN.

#### Acceptance Criteria

1. Feature extractor SHALL produce 5 separate input arrays (not single 29-dim)
2. NN1 inputs: protector densities + energy parasite rates
3. NN2 inputs: protector densities + combat parasite rates
4. NN3 inputs: assembled from NN1 + NN2 outputs
5. NN4 inputs: worker densities + type-selected suitabilities + type-selected saturations
6. NN5 inputs: chunk-selected values + queen capacity + player rates

---

## Non-Functional Requirements

1. Total parameters SHALL be ~830 (vs ~10,000+ in current architecture)
2. Inference latency SHALL not exceed current single-NN latency significantly
3. Training SHALL work with existing replay buffer infrastructure
4. Dashboard SHALL be updated to show 5-stage decision pipeline

---

## Out of Scope

1. Dynamic NN routing (always run full sequence)
2. Per-NN learning rates (use single learning rate)
3. Separate model versioning per NN
4. Backward compatibility with old model weights
