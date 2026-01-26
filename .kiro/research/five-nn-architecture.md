# Five-NN Sequential Architecture

## Research Document
**Created:** 2026-01-25
**Updated:** 2026-01-25
**Status:** Design Phase

---

## 1. Problem Statement

### Current Architecture Flaws

The current single-NN architecture has fundamental issues:

1. **Input-Output Mismatch**: 29 inputs about 5 chunks → 257 output classes
2. **Flat Feature Treatment**: 29 features treated as independent, but they're structured groups
3. **Mixed Signals**: NN receives all features for all decisions, causing noise
4. **Mode Collapse**: NN collapses to chunk 179 (~67%) because mapping is too indirect

### Root Cause

The 29 inputs are NOT 29 independent features. They are **grouped information**:

```
Chunk 0: [id, workers, protectors, e_parasites, c_parasites]
Chunk 1: [id, workers, protectors, e_parasites, c_parasites]
Chunk 2: [id, workers, protectors, e_parasites, c_parasites]
Chunk 3: [id, workers, protectors, e_parasites, c_parasites]
Chunk 4: [id, workers, protectors, e_parasites, c_parasites]
Queen:   [energy_capacity, combat_capacity]
Player:  [energy_rate, mineral_rate]
```

The NN doesn't know features 0-4 belong together, 5-9 belong together, etc.

---

## 2. Feature Semantics Analysis

Each feature serves a specific decision purpose:

| Feature | What It Tells | Decision It Informs |
|---------|---------------|---------------------|
| Worker Density | Which chunk to hit first | **WHERE** (chunk) |
| Protector Density | Theoretical threat to parasites | **SUITABILITY** |
| Energy Parasite Rate | Are energy parasites surviving/dying? | **E_SUITABILITY** |
| Combat Parasite Rate | Are combat parasites surviving/dying? | **C_SUITABILITY** |
| Queen Energy Capacity | Can we afford energy parasites? | **HOW MANY** |
| Queen Combat Capacity | Can we afford combat parasites? | **HOW MANY** |
| Player Energy Rate | Is player gaining/losing energy? | **HOW MANY** (aggression) |
| Player Mineral Rate | Is player gaining/losing minerals? | **HOW MANY** (aggression) |

---

## 3. Five Decisions, Five NNs

### Key Insight: Suitability from Outcomes

Suitability is learned from **actual outcomes**, not just theoretical protector presence:

- **Energy Suitability**: Based on protector density + energy parasite survival rate
- **Combat Suitability**: Based on protector density + combat parasite survival rate

This captures **player behavior**:
- If player specifically hunts energy parasites even with low protectors → e_suitability drops
- If combat parasites thrive in high-protector zones → c_suitability stays high

### Decision Breakdown

1. **Energy Suitability**: How suitable is each chunk for energy parasites?
   - Input: protector density + energy parasite rate (per chunk)
   - Output: 5 energy_suitability scores

2. **Combat Suitability**: How suitable is each chunk for combat parasites?
   - Input: protector density + combat parasite rate (per chunk)
   - Output: 5 combat_suitability scores

3. **Type Decision**: Energy or Combat parasite?
   - Input: 5 energy_suitability + 5 combat_suitability
   - Output: energy or combat

4. **Chunk Decision**: Which of the 5 chunks to target?
   - Input: worker densities + suitabilities + type decision
   - Output: chunk 0-4 or NO_SPAWN

5. **Quantity Decision**: How many to spawn (0-4)?
   - Input: selected chunk info + queen capacity + player pressure
   - Output: 0, 1, 2, 3, or 4

### Sequential Flow

```
┌─────────────────┐
│ NN1: E_Suitable │──┐
│ (10 in → 5 out) │  │
└─────────────────┘  │    ┌─────────────┐     ┌─────────────┐     ┌──────────────┐
                     ├──► │ NN3: Type   │ ──► │ NN4: Chunk  │ ──► │ NN5: Quantity│
┌─────────────────┐  │    │ (10 → 2)    │     │ (16 → 6)    │     │   (7 → 5)    │
│ NN2: C_Suitable │──┘    └─────────────┘     └─────────────┘     └──────────────┘
│ (10 in → 5 out) │
└─────────────────┘
```

---

## 4. Focused Inputs Per NN

### NN1: Energy Suitability Scoring

**Purpose:** Score each chunk's suitability for energy parasites based on protector presence AND actual energy parasite survival.

**Inputs (10 values):**
| Index | Feature | Source |
|-------|---------|--------|
| 0 | Protector Density Chunk 0 | input[2] |
| 1 | Energy Parasite Rate Chunk 0 | input[3] |
| 2 | Protector Density Chunk 1 | input[7] |
| 3 | Energy Parasite Rate Chunk 1 | input[8] |
| 4 | Protector Density Chunk 2 | input[12] |
| 5 | Energy Parasite Rate Chunk 2 | input[13] |
| 6 | Protector Density Chunk 3 | input[17] |
| 7 | Energy Parasite Rate Chunk 3 | input[18] |
| 8 | Protector Density Chunk 4 | input[22] |
| 9 | Energy Parasite Rate Chunk 4 | input[23] |

**Output:** 5 values (energy_suitability for each chunk, 0-1)

**Learns:**
- High protector + negative e_rate → low suitability (being killed)
- Low protector + positive e_rate → high suitability (thriving)
- Low protector + negative e_rate → low suitability (player hunting energy specifically)

---

### NN2: Combat Suitability Scoring

**Purpose:** Score each chunk's suitability for combat parasites based on protector presence AND actual combat parasite survival.

**Inputs (10 values):**
| Index | Feature | Source |
|-------|---------|--------|
| 0 | Protector Density Chunk 0 | input[2] |
| 1 | Combat Parasite Rate Chunk 0 | input[4] |
| 2 | Protector Density Chunk 1 | input[7] |
| 3 | Combat Parasite Rate Chunk 1 | input[9] |
| 4 | Protector Density Chunk 2 | input[12] |
| 5 | Combat Parasite Rate Chunk 2 | input[14] |
| 6 | Protector Density Chunk 3 | input[17] |
| 7 | Combat Parasite Rate Chunk 3 | input[19] |
| 8 | Protector Density Chunk 4 | input[22] |
| 9 | Combat Parasite Rate Chunk 4 | input[24] |

**Output:** 5 values (combat_suitability for each chunk, 0-1)

**Learns:**
- High protector + positive c_rate → high suitability (fighting back successfully)
- High protector + negative c_rate → low suitability (overwhelmed)
- Combat can succeed where energy fails (and vice versa)

---

### NN3: Type Decision

**Purpose:** Decide whether to spawn energy or combat parasites globally.

**Inputs (10 values):**
| Index | Feature | Source |
|-------|---------|--------|
| 0-4 | Energy Suitability × 5 | from NN1 |
| 5-9 | Combat Suitability × 5 | from NN2 |

**Output:** 2 classes (energy=0, combat=1)

**Logic:** Compare overall suitability landscape. If energy parasites are generally thriving, choose energy. If combat is needed, choose combat.

---

### NN4: Chunk Decision

**Purpose:** Decide which chunk to target. Type is implicit in the pre-selected suitability/saturation values.

**Inputs (15 values):**
| Index | Feature | Source |
|-------|---------|--------|
| 0-4 | Worker Density × 5 | input[1,6,11,16,21] |
| 5-9 | Suitability for chosen type × 5 | from NN1 or NN2 (pre-selected based on type) |
| 10-14 | Parasite Saturation × 5 | pre-selected based on type |

**Output:** 6 classes (chunk 0, 1, 2, 3, 4, NO_SPAWN)

**Note:** Type decision is not passed explicitly - it's implicit in which suitability and saturation values were selected.

**Logic:**
- High worker density = priority target (more disruption potential)
- High suitability for chosen type = better survival
- Low parasite saturation = room for more parasites

---

### NN5: Quantity Decision

**Purpose:** Decide how many parasites to spawn (0-4).

**Inputs (7 values):**
| Index | Feature | Source |
|-------|---------|--------|
| 0 | Selected Chunk Parasite Saturation | from NN4 selection |
| 1 | Selected Chunk Suitability | from NN1/NN2 (for chosen chunk) |
| 2 | Queen Spawn Capacity | input[25] or input[26] based on type |
| 3 | Player Energy Rate | input[27] |
| 4 | Player Mineral Rate | input[28] |
| 5 | Type Decision | from NN3 |
| 6 | Chunk Selection | from NN4 (0-5) |

**Output:** 5 classes (0, 1, 2, 3, 4)

**Logic:**
- Low saturation + high capacity = spawn more
- Player gaining resources = spawn aggressively
- Player losing resources = conserve (already winning)

---

## 5. Architecture Summary 

| NN | Inputs | Outputs | Purpose |
|----|--------|---------|---------|
| NN1 | 10 | 5 | Energy suitability per chunk |
| NN2 | 10 | 5 | Combat suitability per chunk |
| NN3 | 10 | 2 | Type (energy/combat) |
| NN4 | 15 | 6 | Chunk (0-4 + NO_SPAWN) |
| NN5 | 7 | 5 | Quantity (0-4) |

**Total: 52 inputs across 5 networks, 23 outputs**

Compare to current: 29 inputs → 257 outputs in one network

### Layer Architecture Per NN

**NN1: Energy Suitability**
```
Input(10) → Dense(8) → ReLU → Dense(5) → Sigmoid → Output(5)
```
- Small network, learns protector+rate → suitability mapping
- Sigmoid output: each chunk gets independent 0-1 score
- Output: 5 energy suitability scores

**NN2: Combat Suitability**
```
Input(10) → Dense(8) → ReLU → Dense(5) → Sigmoid → Output(5)
```
- Same architecture as NN1
- Could share weights with NN1 (same structure, different inputs)
- Output: 5 combat suitability scores

**NN3: Type Decision**
```
Input(10) → Dense(8) → ReLU → Dense(2) → Softmax → Output(2)
```
- Compares 5 energy vs 5 combat suitabilities
- Softmax: mutually exclusive choice (energy OR combat)
- Output: [P(energy), P(combat)]

**NN4: Chunk Decision**
```
Input(15) → Dense(12) → ReLU → Dense(8) → ReLU → Dense(6) → Softmax → Output(6)
```
- Larger network: more complex decision (worker density + suitability + saturation)
- Two hidden layers for better feature combination
- Softmax: choose one chunk or NO_SPAWN
- Output: [P(chunk0), P(chunk1), P(chunk2), P(chunk3), P(chunk4), P(NO_SPAWN)]

**NN5: Quantity Decision**
```
Input(7) → Dense(8) → ReLU → Dense(5) → Softmax → Output(5)
```
- Small network: simple capacity vs need calculation
- Softmax: choose quantity 0-4
- Output: [P(0), P(1), P(2), P(3), P(4)]

### Total Parameters (Approximate)

| NN | Layers | Parameters |
|----|--------|------------|
| NN1 | 10→8→5 | ~130 |
| NN2 | 10→8→5 | ~130 |
| NN3 | 10→8→2 | ~106 |
| NN4 | 15→12→8→6 | ~350 |
| NN5 | 7→8→5 | ~113 |
| **Total** | | **~830** |

Compare to current single NN: ~10,000+ parameters

**Benefits:**
- Each NN has focused, relevant inputs
- No mixed signals - each network gets only what it needs
- Sequential decisions respect dependencies
- Suitability is learned from actual outcomes (captures player behavior)
- Energy and combat suitability are **independent** - not derived from each other
- No more indirect chunk ID mapping (outputs are relative indices)

---

## 6. Why This Fixes Mode Collapse

### Current Problem
- NN sees 29 features, outputs 257 probabilities
- Must learn: "when input[0]=0.702, output[179] should be high"
- This is an indirect, hard-to-learn mapping
- NN gives up and always outputs chunk 179

### New Approach
- NN4 outputs relative to INPUT chunks (0, 1, 2, 3, 4)
- Output[0] = "spawn at the first input chunk" (whatever ID it has)
- No need to learn arbitrary chunk ID mapping
- Direct, easy-to-learn relationship
- Suitability NNs preprocess raw data into actionable scores

---

## 7. Suitability Learning: Capturing Player Behavior

### Why Suitability Needs Learning

A simple formula like `e_suitability = 1 - protector_density` misses player behavior:

| Scenario | Protector Density | E_Para_Rate | What's Happening |
|----------|-------------------|-------------|------------------|
| Safe zone | Low | Positive | Energy thriving, spawn more |
| Safe zone | Low | Negative | Player hunting energy specifically! |
| Defended | High | Negative | Expected - protectors killing |
| Defended | High | Positive | Energy somehow surviving (rare) |

By including parasite rate, the NN learns:
- **Theoretical threat** (protector presence)
- **Actual outcome** (are parasites surviving?)
- **Player adaptation** (is player countering our strategy?)

### Independent Suitabilities

Energy and combat suitability are now **independently learned**:
- `e_suitability` comes from NN1 using energy parasite data
- `c_suitability` comes from NN2 using combat parasite data
- They are NOT `1 - each other`

This allows the model to learn that:
- Some chunks are bad for BOTH types
- Some chunks are good for BOTH types
- Player behavior affects each type differently

---

## 8. Training Considerations

### Reward Distribution
- **NN1 (E_Suitability):** Trained to predict energy parasite survival
- **NN2 (C_Suitability):** Trained to predict combat parasite survival
- **NN3 (Type):** Rewarded when chosen type survives/succeeds
- **NN4 (Chunk):** Rewarded based on disruption at chosen location
- **NN5 (Quantity):** Rewarded for efficiency (cost vs impact)

### Training Strategy Options

1. **End-to-end:** Train all 5 NNs jointly, backprop through the chain
2. **Sequential freeze:** Train NN1/NN2 first, freeze, then NN3, etc.
3. **Supervised warmup:** Pre-train suitability NNs with survival labels

---

## 9. Next Steps

1. [ ] Create spec documents (requirements, design, tasks)
2. [ ] Implement NN1 (Energy Suitability)
3. [ ] Implement NN2 (Combat Suitability)
4. [ ] Implement NN3 (Type)
5. [ ] Implement NN4 (Chunk)
6. [ ] Implement NN5 (Quantity)
7. [ ] Update feature extractor to provide focused inputs per NN
8. [ ] Update training pipeline for sequential decisions
9. [ ] Test with simulation

---

## 10. Open Questions

1. How to handle NO_SPAWN propagation (if NN4 says NO_SPAWN, skip NN5?)
2. Should we add exploration noise at each stage or only at final output?
3. How to attribute rewards across the 5 NNs in RL training?
4. Should NN1 and NN2 share weights (same architecture, different inputs)?
