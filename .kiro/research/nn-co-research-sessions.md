# Queen Neural Network - Co-Research Document

**Researchers:** Kaushik & Velasari
**Started:** 2026-01-18
**Status:** Active Research

---

## 1. Objectives & Game Dynamics

### Queen's Moto

```
1. Keep minimum parasites on field
2. Preserve queen energy
```

### Game Mechanics

```
Parasites       → Auto attack workers
Protectors      → Kill parasites, chase on target lock
Combat Parasite → Can kill protectors (costs more energy)

GOAL: Drain player energy → Force defeat
```

### Win Condition Chain

```
Energy Parasites attack Workers
         ↓
Workers flee → Mining stops
         ↓
No minerals → No power generation
         ↓
Protectors fire → Drains energy
         ↓
Energy hits zero
         ↓
Can't build: Power Plants, Bases, Workers, Protectors
         ↓
Progress stops → Player defeat
```

### Reward / Penalty Signals

```
REWARD (+)                              PENALTY (-)
├── Mining stopped                      ├── Mining active
├── Protector count reduced             ├── Protector count increased
└── Net energy negative (higher=better) └── Net energy positive
```

---

## 2. Architecture Overview

```
                    QUEEN NEURAL NETWORK
═══════════════════════════════════════════════════════════════

    28 INPUTS              HIDDEN LAYERS              OUTPUTS
    ═════════              ═════════════              ═══════

┌──────────────┐
│ Top 5 Chunks │─┐
│ (25 values)  │ │
├──────────────┤ │       ┌──────────┐
│ Queen Spawn  │ │       │          │
│ Capacity (2) │ ├──────▶│ 32 ReLU  │──┐
├──────────────┤ │       │          │  │
│ Player Energy│ │       └──────────┘  │
│  (1 value)   │─┘                     │     ┌──────────┐
                                       │     │ 32 ReLU  │     ┌─────────┐
                         ┌──────────┐  │     └────┬─────┘     │   256   │
                         │          │  │          │           │ Softmax │
                         │ 16 ReLU  │──┴──────────┼──────────▶└─────────┘
                         │          │────┐        │            Chunk ID
                         └──────────┘    │        │
                                         │        │           ┌─────────┐
                                         └────────┴──────────▶│ Sigmoid │
                                                              └─────────┘
                                                                Type

═══════════════════════════════════════════════════════════════
Architecture: 28 → 32 → 16 → (32 → 256) + (1)
═══════════════════════════════════════════════════════════════
```

---

## 3. Inputs (28 total)

### Unified Normalization Formula

```
All rates use the same bounded formula:

    rate = (end - start) / max(start, end)

    Always bounded: -1 to +1
    - Positive = growing/gaining
    - Negative = shrinking/losing
    - Zero = stable

    Examples:
      Start: 100, End: 150 → (150-100)/150 = +0.33
      Start: 100, End: 10  → (10-100)/100  = -0.90
      Start: 5, End: 5     → (5-5)/5       =  0.00
```

### Input Specification

```
INPUT SPECIFICATION (28 total)
═══════════════════════════════════════════════════════════════

[Top 5 Chunks - by mining worker density]     25 values
───────────────────────────────────────────────────────────────
  For each chunk (×5):
    ├── Chunk ID                 chunk_id / 255 → 0-1
    ├── Mining Worker Density    workers_here / total_mining_workers → 0-1
    ├── Protector Density        protectors_here / total_protectors → 0-1
    ├── Energy Parasite Rate     (p_end - p_start) / max(p_start, p_end) → -1 to +1
    └── Combat Parasite Rate     (p_end - p_start) / max(p_start, p_end) → -1 to +1

  5 values × 5 chunks = 25 values


[Queen Spawn Capacity]                        2 values
───────────────────────────────────────────────────────────────
  Queen Energy System:
    maxEnergy = 100
    energyParasiteCost = 15  →  max affordable = floor(100/15) = 6
    combatParasiteCost = 25  →  max affordable = floor(100/25) = 4

  Inputs:
    ├── Energy Spawn Capacity    floor(current/15) / 6 → 0-1
    └── Combat Spawn Capacity    floor(current/25) / 4 → 0-1

  NN learns: "How many of each type can I spawn right now?"
    - 1.0 = full spawn capacity
    - 0.0 = cannot spawn any
    - Enables strategic type selection based on affordability


[Player State]                                1 value
───────────────────────────────────────────────────────────────
  └── Player Energy Rate         (e_end - e_start) / max(e_start, e_end) → -1 to +1

───────────────────────────────────────────────────────────────
TOTAL: 25 + 2 + 1 = 28 inputs
```

### Input Examples

```
CHUNK 47 EXAMPLE (undefended mining zone):
═══════════════════════════════════════════════════════════════

  Chunk ID:              47/255 = 0.184
  Mining Worker Density: 3/8 = 0.375    (lots of workers here!)
  Protector Density:     0/5 = 0.000    (undefended!)
  Energy Parasite Rate:  (4-2)/4 = +0.5 (parasites thriving!)
  Combat Parasite Rate:  (0-0)/0 = 0    (none present)

  NN learns: "High workers + No protectors + Parasites surviving = ATTACK HERE!"


CHUNK 52 EXAMPLE (heavily defended zone):
═══════════════════════════════════════════════════════════════

  Chunk ID:              52/255 = 0.204
  Mining Worker Density: 2/8 = 0.250
  Protector Density:     3/5 = 0.600    (heavily defended!)
  Energy Parasite Rate:  (1-4)/4 = -0.75 (parasites dying fast!)
  Combat Parasite Rate:  (0-0)/0 = 0

  NN learns: "Defended + Parasites dying = AVOID or send COMBAT parasites"


PLAYER ENERGY RATE EXAMPLES:
═══════════════════════════════════════════════════════════════

  Player thriving:  Start: 100, End: 150 → +0.33 (PENALTY for Queen)
  Player struggling: Start: 100, End: 10 → -0.90 (REWARD for Queen!)
  Player stable:    Start: 100, End: 100 →  0.00 (neutral)


QUEEN SPAWN CAPACITY EXAMPLES:
═══════════════════════════════════════════════════════════════

  Queen    Energy Capacity              Combat Capacity
  Energy   ─────────────────────────    ─────────────────────────
   100     floor(100/15)/6 = 6/6 = 1.0  floor(100/25)/4 = 4/4 = 1.0
    75     floor(75/15)/6  = 5/6 = 0.83 floor(75/25)/4  = 3/4 = 0.75
    50     floor(50/15)/6  = 3/6 = 0.5  floor(50/25)/4  = 2/4 = 0.5
    25     floor(25/15)/6  = 1/6 = 0.17 floor(25/25)/4  = 1/4 = 0.25
    14     floor(14/15)/6  = 0/6 = 0.0  floor(14/25)/4  = 0/4 = 0.0

  NN learns from capacity inputs:
    - Both 1.0? "Full capacity - pick best type for situation"
    - Energy=0.83, Combat=0.75? "Can spawn either - strategy decides"
    - Energy=0.17, Combat=0.0? "Can only spawn energy - combat unaffordable"
    - Both 0.0? "Can't spawn - wait for regeneration (3 energy/sec)"
```

---

## 4. Outputs (257 total)

```
OUTPUT SPECIFICATION
═══════════════════════════════════════════════════════════════

[Chunk Selection]             256 values (Softmax)
  └── Probability for each chunk (sum to 1.0)
      Highest probability = spawn location

[Parasite Type]               1 value (Sigmoid)
  └── 0.0 - 0.5 = Energy Parasite
      0.5 - 1.0 = Combat Parasite

───────────────────────────────────────────────────────────────
Chunk = 64 × 64 units
Territory = 16 × 16 chunks = 256 possible spawn zones
```

### Output Example

```
CHUNK (Softmax)                     TYPE (Sigmoid)
───────────────                     ──────────────
Chunk 0:   0.01  (1%)               Output: 0.23
Chunk 1:   0.02  (2%)
...                                 0 ────────────── 1
Chunk 47:  0.35  (35%) ← WINNER     │     ▲          │
...                               Energy  │       Combat
Chunk 255: 0.01  (1%)                    0.23
           ─────
Total:     1.00  (100%)             Decision: Energy Parasite

FINAL: Spawn Energy Parasite at Chunk 47
```

---

## 5. Data Pipeline

```
COMPLETE FLOW
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (every 15s)                                        │
│                                                             │
│ Sends RAW data (minimal processing, saves FPS):             │
│ {                                                           │
│   miningWorkers: [{x, y, chunkId}, ...],  ← event-driven    │
│   protectors: [{x, y, chunkId}, ...],                       │
│   energyParasites: [{chunkId}, ...],                        │
│   combatParasites: [{chunkId}, ...],                        │
│   queen_energy: 75,                                         │
│   queen_max_energy: 100,                                    │
│   player_energy_start: 100,   ← at window start             │
│   player_energy_end: 85       ← at window end               │
│ }                                                           │
└──────────────────────────┬──────────────────────────────────┘
                           │ WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (preprocessing)                                     │
│                                                             │
│ 1. Find top 5 chunks by mining worker density               │
│ 2. Calculate per-chunk:                                     │
│    - Mining worker density                                  │
│    - Protector density                                      │
│    - Energy parasite rate (using window start/end counts)   │
│    - Combat parasite rate                                   │
│ 3. Normalize chunk IDs (÷255)                               │
│ 4. Calculate queen spawn capacities:                        │
│    - energy_capacity = floor(current/15) / 6                │
│    - combat_capacity = floor(current/25) / 4                │
│ 5. Calculate player energy rate                             │
│                                                             │
│ Output: [28 normalized floats]                              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ NEURAL NETWORK (inference)                                  │
│                                                             │
│ Input:  [28 values between -1 and +1]                       │
│ Output: [chunk_probs(256), type_prob(1)]                    │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (post-processing)                                   │
│                                                             │
│ 1. argmax(chunk_probs) → chunk_id = 47                      │
│ 2. type_prob < 0.5 → type = "energy"                        │
│ Output: { spawn_chunk: 47, spawn_type: "energy" }           │
└──────────────────────────┬──────────────────────────────────┘
                           │ WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (execution)                                        │
│                                                             │
│ Queen spawns energy parasite at chunk 47                    │
└─────────────────────────────────────────────────────────────┘
```

### Event-Driven Tracking (Scale Optimization)

```
PROBLEM: Iterating all workers every 15s is costly at scale

SOLUTION: Track incrementally with events


IMPLEMENTATION
═══════════════════════════════════════════════════════════════

private miningWorkers: Set<Worker> = new Set();

onWorkerStartMining(worker) {
  this.miningWorkers.add(worker);     // O(1)
}

onWorkerStopMining(worker) {
  this.miningWorkers.delete(worker);  // O(1)
}

getMiningWorkersData() {
  return this.miningWorkers;          // Already filtered, no iteration
}


COST COMPARISON
═══════════════════════════════════════════════════════════════

Poll-based:    100 workers × 4 times/min = 400 iterations/min
Event-driven:  10 mining workers = 10 reads (not 100)
```

---

## 6. Network Design Details

### Hidden Layers Explained

```
INPUT: "Chunk 47 has workers, no protectors, parasites thriving..."
         │
         ▼
LAYER 1: "Chunk 47 is undefended and productive"
         (combines per-chunk data into RELATIONSHIPS)
         │
         ▼
LAYER 2: "Best attack opportunity at chunk 47"
         (combines relationships into INSIGHTS)
         │
         ▼
OUTPUT: "Spawn energy parasite at chunk 47"
```

### Activation Functions

```
ReLU (Hidden Layers)              Sigmoid (Type Output)
════════════════════              ═════════════════════

     │    ╱                           1 ┤    ────────
     │   ╱                              │   ╱
     │  ╱                           0.5 ┤──╱
─────┼─╱────                            │ ╱
     │                              0   ┼╱──────────

f(x) = max(0, x)                  f(x) = 1 / (1 + e^(-x))
"Pass positive, block negative"   "Squash to 0-1 range"


Softmax (Chunk Output)
══════════════════════

Converts 256 raw values to probabilities that sum to 1.0
Highest probability wins.
```

### Why Split Heads?

```
PROBLEM: Hidden layer → 257 outputs is a bottleneck

SOLUTION: Split into specialized paths

         ┌─────┐     ┌─────┐
    28 ──┤  32 ├─────┤ 16  ├───┬─────────────┐
         └─────┘     └─────┘   │             │
                               ▼             ▼
                           ┌──────┐      ┌──────┐
                           │  32  │      │  1   │
                           └──┬───┘      └──────┘
                              ▼            Type
                           ┌──────┐
                           │ 256  │
                           └──────┘
                            Chunk

WHY?
- Location (spatial) and Type (tactical) are different problems
- Shared learning in 28→32→16, then specialize
- Fewer parameters than single wide layer
```

### Parameter Count

```
LAYER BREAKDOWN
═══════════════════════════════════════════════════════════════

Input → Hidden 1:     28 × 32 = 896 weights + 32 biases
Hidden 1 → Hidden 2:  32 × 16 = 512 weights + 16 biases

CHUNK PATH:
Hidden 2 → Expand:    16 × 32 = 512 weights + 32 biases
Expand → Output:      32 × 256 = 8,192 weights + 256 biases

TYPE PATH:
Hidden 2 → Output:    16 × 1 = 16 weights + 1 bias

───────────────────────────────────────────────────────────────
TOTAL: 10,128 weights + 337 biases = 10,465 parameters
```

---

## 7. Learning Notes (Q&A)

### How do neurons connect?

```
Fully connected = EVERY neuron connects to EVERY neuron

     8 neurons           32 neurons
    ┌───┐               ┌───┐
    │ 1 │═══════════════│ 1 │
    │ 2 │═══════════════│ 2 │
    │ 3 │═══════════════│ 3 │
    │...│═══════════════│...│
    │ 8 │═══════════════│32 │
    └───┘               └───┘
         ALL to ALL

Total connections: 8 × 32 = 256 weights
```

### How does one neuron calculate its output?

```
neuron_32[i] = ReLU( w1×n1 + w2×n2 + ... + w8×n8 + bias )

Each of 32 neurons has its OWN set of 8 weights.
Different weights = learns different patterns.
```

### Why does compression work?

```
Neurons can summarize inputs because each learns DIFFERENT patterns:

neuron[1]: "worker density patterns" (high weight on worker inputs)
neuron[2]: "threat level" (high weight on protector density)
neuron[3]: "survival status" (high weight on parasite rates)
...

Same inputs, different focus = meaningful compression.
```

### Why 1 neuron for type (not 2)?

```
Binary choice needs only 1 neuron + sigmoid:

16 neurons → 1 neuron → sigmoid → 0.23
                                   │
                        < 0.5 = Energy
                        ≥ 0.5 = Combat

2 neurons + softmax would be overkill.
```

### Why Top 5 chunks instead of all 256?

```
1. Fixed input size (5 chunks × 5 values = 25)
2. Focuses on relevant data (where mining is happening)
3. Self-normalizing (densities are ratios = 0-1)
4. Gamified decision: "high workers + low protectors + parasites surviving = attack!"
```

---

## 8. Open Items

```
Still to discuss:
├── Training Details
│   ├── Learning rate
│   ├── Loss function (CrossEntropy for chunks, BCE for type?)
│   ├── Batch size
│   └── When/how does training happen?
├── Edge Cases
│   ├── What if < 5 chunks have mining workers?
│   ├── What if no parasites exist (division by zero)?
│   └── What if player energy is 0?
└── Implementation
    └── Queen Energy System needs to be added to Queen.ts
        (see .kiro/specs/queen-nn-continuous-learning/design.md)


RESOLVED:
─────────
✓ Queen Spawn Costs → Use spawn capacity inputs instead of raw costs
  - Raw costs are fixed values (15, 25) - not useful as inputs
  - Spawn capacity = floor(current/cost) / max_affordable → 0-1
  - NN knows "how many can I spawn?" not just "what does it cost?"
  - Binary type output (sigmoid) - one type per decision cycle
```

---

## Summary

```
QUEEN NN AT A GLANCE
═══════════════════════════════════════════════════════════════

Inputs:       28 (5 chunks × 5 values + 2 spawn capacities + player rate)
Architecture: 28 → 32 → 16 → (32 → 256) + (1)
Outputs:      257 (256 chunks + 1 type)
Parameters:   ~10,465

Input Breakdown:
  - Top 5 Chunks: 25 values (chunk ID, worker/protector density, parasite rates)
  - Queen Spawn Capacity: 2 values (energy & combat affordability)
  - Player Energy Rate: 1 value

Normalization:
  - Chunk IDs: ÷255 → 0-1
  - Densities: ratio → 0-1
  - Rates: (end-start)/max(start,end) → -1 to +1
  - Spawn Capacities: floor(current/cost) / max_affordable → 0-1

Queen Energy System:
  - Max Energy: 100
  - Energy Parasite Cost: 15 (max 6 affordable)
  - Combat Parasite Cost: 25 (max 4 affordable)
  - Regeneration: 3 energy/second

Data Flow:    Frontend (raw) → Backend (preprocess) → NN → Backend (postprocess) → Frontend
Frequency:    Every 15 seconds
Optimization: Event-driven tracking for mining workers

Goal:         Spawn parasites efficiently to drain player energy
```
