# Queen Neural Network v2.0 - Technical Design

## Overview

This design document details the chunk-based neural network architecture for Queen AI strategic spawning decisions. The system observes top mining activity zones, Queen spawn capacity, and player energy trends to decide WHERE and WHAT type of parasite to spawn.

## System Architecture

```
                    QUEEN NEURAL NETWORK v2.0
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
Parameters:   ~10,465
═══════════════════════════════════════════════════════════════
```

## Input Specification (28 total)

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

### Input Layout

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

## Output Specification (257 total)

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


OUTPUT EXAMPLE:

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

## Data Pipeline

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
│ 1. Verify Queen can afford spawn (check capacity)           │
│ 2. Queen spawns energy parasite at chunk 47                 │
│ 3. Deduct energy from Queen reserve                         │
└─────────────────────────────────────────────────────────────┘
```

## Event-Driven Worker Tracking

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

## Queen Energy System

```
QUEEN ENERGY FLOW
═══════════════════════════════════════════════════════════════

                          Passive Regeneration
     Planetary            (3.0 energy/second)
     Environment  ─────────────────────────────►  ┌───────────────────┐
                                                  │  Queen Energy     │
                                                  │  Reserve          │
                                                  │                   │
                                                  │  ┌─────────────┐  │
                                                  │  │ Current: 75 │  │
                                                  │  │ Max: 100    │  │
                                                  │  └─────────────┘  │
                                                  └────────┬──────────┘
                                                           │
                          Spawn Cost                       │
                          (per parasite)                   ▼
                                                  ┌───────────────────┐
                                                  │  Spawn Decision   │
                                                  │                   │
                                                  │  Energy Parasite  │───► Cost: 15
                                                  │  Combat Parasite  │───► Cost: 25
                                                  │                   │
                                                  └───────────────────┘


ENERGY PARAMETERS
═══════════════════════════════════════════════════════════════

Parameter            │ Default │ Description
─────────────────────┼─────────┼─────────────────────────────────
maxEnergy            │ 100     │ Maximum energy capacity
startingEnergy       │ 50      │ Starting energy (50% of max)
regenRate            │ 3.0     │ Energy regenerated per second
energyParasiteCost   │ 15      │ Cost to spawn Energy Parasite
combatParasiteCost   │ 25      │ Cost to spawn Combat Parasite


ENERGY FLOW TIMING EXAMPLE
═══════════════════════════════════════════════════════════════

Time (seconds)  Energy Level    Events
─────────────   ────────────    ──────
    0           50              Game starts
    5           65              +15 regen
   10           80              +15 regen
   12           55              -25 spawn Combat Parasite
   15           64              +9 regen
   17           49              -15 spawn Energy Parasite
   20           58              +9 regen
```

## Network Design Details

### Hidden Layers

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

### Split Heads Architecture

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

## Reward/Penalty Signals

```
REWARD (+)                              PENALTY (-)
├── Mining stopped in chunk             ├── Mining active/increasing
├── Protector count reduced             ├── Protector count increased
├── Player energy rate negative         ├── Player energy rate positive
└── Parasites surviving in chunk        └── Parasites dying in chunk

All signals derived from:
  rate = (end - start) / max(start, end)  →  bounded -1 to +1
```

## Edge Cases

```
EDGE CASE HANDLING
═══════════════════════════════════════════════════════════════

1. Fewer than 5 chunks with mining workers:
   - Pad remaining chunk slots with zeros
   - Chunk ID = 0, all densities = 0, all rates = 0

2. No parasites exist (division by zero in rate):
   - If start = 0 and end = 0: rate = 0 (stable)
   - If start = 0 and end > 0: rate = +1 (maximum growth)
   - If start > 0 and end = 0: rate = -1 (maximum decline)

3. Player energy is 0:
   - Energy rate formula handles this: (0 - start) / max(start, 0) = -1

4. Queen cannot afford spawn:
   - Skip spawn execution
   - Wait for energy regeneration
   - Next decision cycle will have updated capacity inputs
```

## Integration Points

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `client/src/game/entities/Queen.ts` | Modify | Add energy system properties |
| `client/src/game/systems/QueenEnergySystem.ts` | Create | Energy management logic |
| `client/src/game/systems/ObservationCollectorV2.ts` | Create | Chunk-based data collection |
| `server/ai_engine/feature_extractor_v2.py` | Create | 28-feature extraction |
| `server/ai_engine/nn_model_v2.py` | Create | Split-head architecture |
| `server/ai_engine/preprocessing.py` | Create | Top 5 chunk selection |

### Existing Systems to Integrate

- **SpatialIndex**: Uses same 64-unit chunk size
- **TerritoryManager**: 16×16 chunks = 256 zones
- **MiningAction**: Has isMining state for event tracking
- **EnergyManager**: Player energy tracking
- **ParasiteManager**: Spawn execution
