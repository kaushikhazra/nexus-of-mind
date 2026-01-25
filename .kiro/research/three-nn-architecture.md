# Three-NN Sequential Architecture

## Research Document
**Created:** 2026-01-25
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
| Worker Density | Which chunk to hit first | **WHERE** |
| Protector Density | Energy will die, combat can fight | **WHAT TYPE** |
| Energy Parasite Rate | Chunk saturated with energy parasites? | **HOW MANY** |
| Combat Parasite Rate | Chunk saturated with combat parasites? | **HOW MANY** |
| Queen Energy Capacity | Can we afford to spawn? | **HOW MANY** |
| Queen Combat Capacity | Can we afford combat parasites? | **HOW MANY** |
| Player Energy Rate | Is player gaining/losing energy? | **HOW MANY** (aggression) |
| Player Mineral Rate | Is player gaining/losing minerals? | **HOW MANY** (aggression) |

---

## 3. Three Decisions, Three NNs

### Decision Breakdown

1. **Type Decision**: Energy or Combat parasite?
   - Driven by: Protector density (high protectors → combat, low → energy)

2. **Chunk Decision**: Which of the 5 chunks to target?
   - Driven by: Worker density (priority) + parasite saturation for chosen type

3. **Quantity Decision**: How many to spawn (0, 1, 2, 3, 4)?
   - Driven by: Selected chunk saturation + queen capacity + player pressure

### Sequential Flow

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  NN1: Type  │ ──► │ NN2: Chunk  │ ──► │ NN3: Quantity│
│  (E or C)   │     │  (0-4 + NS) │     │   (0-4)      │
└─────────────┘     └─────────────┘     └──────────────┘
```

Each NN receives the previous decision as additional context.

---

## 4. Focused Inputs Per NN

### NN1: Type Decision

**Purpose:** Decide energy or combat parasite

**Inputs (7 values):**
| Index | Feature | Source |
|-------|---------|--------|
| 0 | Protector Density Chunk 0 | input[2] |
| 1 | Protector Density Chunk 1 | input[7] |
| 2 | Protector Density Chunk 2 | input[12] |
| 3 | Protector Density Chunk 3 | input[17] |
| 4 | Protector Density Chunk 4 | input[22] |
| 5 | Player Energy Rate | input[27] |
| 6 | Player Mineral Rate | input[28] |

**Output:** 2 classes (energy=0, combat=1)

**Logic:** High protector presence → combat (can fight back). Player pressure informs aggression.

---

### NN2: Chunk Decision

**Purpose:** Decide which chunk to target (given the type)

**Inputs (12 values):**
| Index | Feature | Source |
|-------|---------|--------|
| 0 | Worker Density Chunk 0 | input[1] |
| 1 | Worker Density Chunk 1 | input[6] |
| 2 | Worker Density Chunk 2 | input[11] |
| 3 | Worker Density Chunk 3 | input[16] |
| 4 | Worker Density Chunk 4 | input[21] |
| 5 | Parasite Density Chunk 0 | input[3] or input[4] based on type |
| 6 | Parasite Density Chunk 1 | input[8] or input[9] based on type |
| 7 | Parasite Density Chunk 2 | input[13] or input[14] based on type |
| 8 | Parasite Density Chunk 3 | input[18] or input[19] based on type |
| 9 | Parasite Density Chunk 4 | input[23] or input[24] based on type |
| 10 | Type Decision | from NN1 (0 or 1) |
| 11 | NO_SPAWN option weight | derived from queen capacity |

**Output:** 6 classes (chunk 0, 1, 2, 3, 4, NO_SPAWN)

**Logic:** High worker density = priority target. Low parasite density = not saturated. Type informs which parasite density to check.

---

### NN3: Quantity Decision

**Purpose:** Decide how many to spawn (0-4)

**Inputs (6 values):**
| Index | Feature | Source |
|-------|---------|--------|
| 0 | Selected Chunk Parasite Density | from NN2 selection |
| 1 | Queen Spawn Capacity (for type) | input[25] or input[26] |
| 2 | Player Energy Rate | input[27] |
| 3 | Player Mineral Rate | input[28] |
| 4 | Type Decision | from NN1 |
| 5 | Chunk Selection | from NN2 |

**Output:** 5 classes (0, 1, 2, 3, 4)

**Logic:** Balance saturation need + affordability + aggression level.

---

## 5. Architecture Summary

| NN | Inputs | Outputs | Purpose |
|----|--------|---------|---------|
| NN1 | 7 | 2 | Type (energy/combat) |
| NN2 | 12 | 6 | Chunk (0-4 + NO_SPAWN) |
| NN3 | 6 | 5 | Quantity (0-4) |

**Total parameters:** Much smaller than current 29→257 architecture

**Benefits:**
- Each NN has focused, relevant inputs
- No mixed signals
- Sequential decisions respect dependencies
- Outputs are bounded and meaningful
- No more indirect chunk ID mapping

---

## 6. Why This Fixes Mode Collapse

### Current Problem
- NN sees 29 features, outputs 257 probabilities
- Must learn: "when input[0]=0.702, output[179] should be high"
- This is an indirect, hard-to-learn mapping
- NN gives up and always outputs chunk 179

### New Approach
- NN2 outputs relative to INPUT chunks (0, 1, 2, 3, 4)
- Output[0] = "spawn at the first input chunk" (whatever ID it has)
- No need to learn arbitrary chunk ID mapping
- Direct, easy-to-learn relationship

---

## 7. Training Considerations

### Reward Distribution
- NN1 (Type): Reward based on parasite survival/effectiveness
- NN2 (Chunk): Reward based on disruption at chosen location
- NN3 (Quantity): Reward based on efficiency (cost vs impact)

### Sequential Dependency
- NN3 depends on NN2's choice
- NN2 depends on NN1's choice
- Can train jointly or separately with frozen predecessors

---

## 8. Next Steps

1. [ ] Create spec documents (requirements, design, tasks)
2. [ ] Implement NN1 (Type)
3. [ ] Implement NN2 (Chunk)
4. [ ] Implement NN3 (Quantity)
5. [ ] Update feature extractor to provide focused inputs
6. [ ] Update training pipeline for sequential decisions
7. [ ] Test with simulation

---

## 9. Open Questions

1. Should we train all 3 NNs jointly or sequentially?
2. How to handle NO_SPAWN case in the sequence?
3. Should NN1 also have NO_SPAWN option, or is that NN2's job?
