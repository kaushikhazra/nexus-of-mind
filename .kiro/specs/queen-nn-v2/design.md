# Queen Neural Network v2.0 - Technical Design

## Overview

This design document details the chunk-based neural network architecture for Queen AI strategic spawning decisions. The system observes top mining activity zones, Queen spawn capacity, and player energy trends to decide WHERE and WHAT type of parasite to spawn.

## System Architecture

```
                    QUEEN NEURAL NETWORK v2.0
═══════════════════════════════════════════════════════════════

    29 INPUTS              HIDDEN LAYERS              OUTPUTS
    ═════════              ═════════════              ═══════

┌──────────────┐
│ Top 5 Chunks │─┐
│ (25 values)  │ │
├──────────────┤ │       ┌──────────┐
│ Queen Spawn  │ │       │          │
│ Capacity (2) │ ├──────▶│ 32 ReLU  │──┐
├──────────────┤ │       │          │  │
│ Player State │ │       └──────────┘  │
│  (2 values)  │─┘                     │     ┌──────────┐
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
Architecture: 29 → 32 → 16 → (32 → 256) + (1)
Parameters:   ~10,497
═══════════════════════════════════════════════════════════════
```

## Input Specification (29 total)

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


[Player State]                                2 values
───────────────────────────────────────────────────────────────
  ├── Player Energy Rate         (e_end - e_start) / max(e_start, e_end) → -1 to +1
  └── Player Mineral Rate        (m_end - m_start) / max(m_start, m_end) → -1 to +1

  Minerals = player's stockpile (mined resources waiting for power plant)
  - Positive rate = player accumulating minerals = bad for Queen
  - Negative rate = player depleting minerals = good for Queen

───────────────────────────────────────────────────────────────
TOTAL: 25 + 2 + 2 = 29 inputs
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

## Confidence-Based Spawn Gating

```
PROBLEM: NN spawns every 15s even when no targets exist
═══════════════════════════════════════════════════════════════

Without spawn gating:
  - NN is FORCED to spawn every observation window
  - No workers → spawn anyway → wasted energy
  - NN cannot learn "don't spawn when idle"

With confidence threshold:
  - NN CAN choose to skip spawning
  - Low confidence = uncertain/unfavorable = skip spawn
  - NN learns: no targets → low confidence → conserve energy


CONFIDENCE CALCULATION
═══════════════════════════════════════════════════════════════

Confidence = max(chunk_probabilities)

The softmax output gives probability distribution over 256 chunks.
The maximum probability indicates how "certain" the NN is about its choice.

Examples:
  - Confident:   [0.01, 0.02, 0.85, 0.01, ...] → max = 0.85 ✓ SPAWN
  - Uncertain:   [0.01, 0.01, 0.02, 0.01, ...] → max = 0.02 ✗ SKIP
  - Threshold:   [0.01, 0.48, 0.02, 0.01, ...] → max = 0.48 ✗ SKIP (if threshold=0.5)


SPAWN DECISION FLOW
═══════════════════════════════════════════════════════════════

                    NN Inference
                         │
                         ▼
              ┌─────────────────────┐
              │  chunk_probs (256)  │
              │  type_prob (1)      │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  confidence =       │
              │  max(chunk_probs)   │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │ confidence >= 0.5?  │──── NO ───▶ SKIP SPAWN
              └──────────┬──────────┘             (log: "skipped, conf=X")
                         │
                        YES
                         │
                         ▼
              ┌─────────────────────┐
              │ Can afford spawn?   │──── NO ───▶ SKIP SPAWN
              └──────────┬──────────┘             (insufficient energy)
                         │
                        YES
                         │
                         ▼
                   EXECUTE SPAWN


REWARD SHAPING FOR SPAWN GATING
═══════════════════════════════════════════════════════════════

Scenario                           Reward
────────────────────────────────   ──────────────────
Spawn + kills workers              +1.0 (success!)
Spawn + no targets exist           -0.5 (wasted energy)
Skip + no targets exist             0.0 (smart conservation)
Skip + targets existed             -0.3 (missed opportunity)

NN learns:
  - High confidence when targets exist → spawn → positive reward
  - Low confidence when no targets → skip → neutral (better than negative)


CONFIGURATION
═══════════════════════════════════════════════════════════════

Parameter               Default    Description
────────────────────    ───────    ─────────────────────────────
CONFIDENCE_THRESHOLD    0.5        Min confidence to spawn
MIN_WORKERS_FOR_SPAWN   0          If > 0, require workers present
EXPLORATION_RATE        0.1        Chance to spawn despite low confidence
                                   (for exploration during training)
```

## Revised Reward Structure (Presence-Based)

```
PROBLEM: Mining speed > observation transmission speed
═══════════════════════════════════════════════════════════════

The observation window (15s) is too slow to catch fast mining.
By the time the system transmits data, mining may already be done.

SOLUTION: Track worker PRESENCE, not just mining activity
═══════════════════════════════════════════════════════════════

Instead of "workers currently mining", track "workers present in territory".
This makes the Queen aggressive about ANY worker intrusion.


NEW REWARD SIGNALS
═══════════════════════════════════════════════════════════════

Signal                          Weight    Description
────────────────────────────    ──────    ─────────────────────────────
Workers Present                 -0.1      Penalty if NN doesn't act when
                                          workers are in territory
                                          (Queen doesn't tolerate intruders)

Active Mining                   -0.6      Penalty when miningWorkers > 0
                                          (workers actively harvesting)

Energy Rate > 0                 Scaled    Penalty scales with rate:
                                          rate × -0.5 (max -0.5)
                                          Higher player income = higher penalty

Mineral Rate > 0                Scaled    Penalty scales with rate:
                                          rate × -0.5 (max -0.5)
                                          Player stockpiling minerals = penalty


REWARD FORMULA
═══════════════════════════════════════════════════════════════

total_penalty = 0

if workers_present > 0 and NN_skipped:
    total_penalty += -0.1  # Workers in territory

if mining_workers > 0 and NN_skipped:
    total_penalty += -0.6  # Active mining happening

if energy_rate > 0 and NN_skipped:
    total_penalty += energy_rate × -0.5  # Scaled with energy income

if mineral_rate > 0 and NN_skipped:
    total_penalty += mineral_rate × -0.5  # Scaled with mineral stockpiling

# Rewards for attacking
if workers_killed > 0:
    reward += workers_killed × 0.2  # Per worker killed

if mining_disrupted:
    reward += 0.3  # Successfully stopped mining


EXAMPLE SCENARIOS
═══════════════════════════════════════════════════════════════

Scenario 1: Workers present, idle
  - workers_present = 3, mining_workers = 0, mineral_rate = 0, energy_rate = 0
  - NN skips spawn
  - Penalty: -0.1 (workers in territory)

Scenario 2: Active mining operation
  - workers_present = 5, mining_workers = 3, mineral_rate = +0.4, energy_rate = +0.3
  - NN skips spawn
  - Penalty: -0.1 (workers) + -0.6 (mining) + (-0.15 energy) + (-0.2 mineral)
  - Total: -1.05 (clipped to -1.0)

Scenario 3: No activity
  - workers_present = 0, mining_workers = 0, mineral_rate = 0, energy_rate = 0
  - NN skips spawn
  - Penalty: 0 (correctly conserving energy)

Scenario 4: NN attacks active miners
  - Spawns parasites, kills 2 workers
  - Reward: +0.4 (2 × 0.2) + 0.3 (disruption)
  - Total: +0.7
```

## Spawn Location Rewards (Strategic Spatial Awareness)

```
PROBLEM: NN spawns at random chunks with no spatial understanding
═══════════════════════════════════════════════════════════════

Current behavior:
  - NN outputs chunk 0-399 with no understanding of strategy
  - Parasites spawned far from hive = wasted energy when idle
  - Parasites spawned far from workers = missed interception

SOLUTION: Distance-based reward shaping
═══════════════════════════════════════════════════════════════

Teach the NN spatial awareness through rewards:
  - "Stay near hive when idle" (defensive posture)
  - "Go to threats when active" (offensive posture)


HIVE CHUNK CALCULATION
═══════════════════════════════════════════════════════════════

Frontend calculates hive chunk from Queen/territory position:

  hiveChunkX = floor(queenPosition.x / 64)   // 64 = chunk size
  hiveChunkZ = floor(queenPosition.z / 64)
  hiveChunk = hiveChunkZ * 20 + hiveChunkX   // 20x20 grid

Example:
  Queen at position (150, 0, 220)
  hiveChunkX = floor(150 / 64) = 2
  hiveChunkZ = floor(220 / 64) = 3
  hiveChunk = 3 * 20 + 2 = 62


CHUNK DISTANCE CALCULATION
═══════════════════════════════════════════════════════════════

Chunks are on a 20x20 grid (400 total chunks).

  chunk1_x = chunk1 % 20
  chunk1_z = chunk1 // 20
  chunk2_x = chunk2 % 20
  chunk2_z = chunk2 // 20

  distance = sqrt((x1 - x2)² + (z1 - z2)²)

  Max distance = sqrt(19² + 19²) = 26.87 chunks
  Normalized distance = distance / 26.87  →  0 to 1

Example:
  Spawn chunk = 47  (x=7, z=2)
  Hive chunk = 62   (x=2, z=3)
  distance = sqrt((7-2)² + (2-3)²) = sqrt(25+1) = 5.1 chunks
  normalized = 5.1 / 26.87 = 0.19


REWARD LOGIC
═══════════════════════════════════════════════════════════════

                    ┌─────────────────────────┐
                    │  Workers Present?       │
                    └───────────┬─────────────┘
                                │
               ┌────────────────┼────────────────┐
               │ NO             │                │ YES
               ▼                                 ▼
    ┌──────────────────────┐          ┌──────────────────────┐
    │  IDLE MODE           │          │  ACTIVE MODE         │
    │                      │          │                      │
    │  Penalize distance   │          │  Penalize distance   │
    │  from HIVE           │          │  from WORKERS        │
    │                      │          │                      │
    │  "Stay near home     │          │  "Go to the threat"  │
    │   when no threats"   │          │                      │
    └──────────────────────┘          └──────────────────────┘


IDLE MODE (no workers present)
═══════════════════════════════════════════════════════════════

When territory is clear, parasites should defend the hive.

  distance_to_hive = chunk_distance(spawn_chunk, hive_chunk)
  normalized_distance = distance_to_hive / 26.87
  penalty = normalized_distance * hive_proximity_penalty_weight

  Default weight: -0.3

Example:
  Spawn at chunk 200 (far from hive at 62)
  distance = 15.3 chunks → normalized = 0.57
  penalty = 0.57 × -0.3 = -0.17


ACTIVE MODE (workers present)
═══════════════════════════════════════════════════════════════

When workers are in territory, parasites should intercept them.

  worker_chunks = [w.chunkId for w in workers_present]
  distances = [chunk_distance(spawn_chunk, wc) for wc in worker_chunks]
  min_distance = min(distances)  # Distance to nearest worker
  normalized_distance = min_distance / 26.87
  penalty = normalized_distance * threat_proximity_penalty_weight

  Default weight: -0.4

Example:
  Workers at chunks [45, 67, 89]
  Spawn at chunk 47
  distances = [chunk_distance(47, 45), chunk_distance(47, 67), chunk_distance(47, 89)]
           = [1.0, 2.2, 4.5]
  min_distance = 1.0 → normalized = 0.037
  penalty = 0.037 × -0.4 = -0.015 (very small - good placement!)


CONFIGURATION PARAMETERS
═══════════════════════════════════════════════════════════════

Parameter                        Default    Description
────────────────────────────     ───────    ─────────────────────────────
hive_proximity_penalty_weight    -0.3       Weight when idle (no workers)
threat_proximity_penalty_weight  -0.4       Weight when active (workers present)
max_chunk_distance               26.87      Maximum possible chunk distance


INTEGRATION WITH EXISTING REWARDS
═══════════════════════════════════════════════════════════════

The spawn_location reward is added to the existing reward components:

  total_reward = (
      mining_disruption +
      protector_reduction +
      player_energy_drain +
      bonuses +
      spawn_gating +
      spawn_location  ← NEW
  )

Note: spawn_location penalty ONLY applies when spawn actually occurs.
If NN skips spawn (low confidence), no spawn_location penalty is applied.


EXAMPLE SCENARIOS
═══════════════════════════════════════════════════════════════

Scenario 1: Idle territory, spawn near hive
  - workers_present = 0
  - spawn_chunk = 63, hive_chunk = 62
  - distance = 1.0 chunk → normalized = 0.037
  - penalty = 0.037 × -0.3 = -0.011 (minimal - good!)

Scenario 2: Idle territory, spawn far from hive
  - workers_present = 0
  - spawn_chunk = 350, hive_chunk = 62
  - distance = 18.4 chunks → normalized = 0.68
  - penalty = 0.68 × -0.3 = -0.20 (significant - bad placement!)

Scenario 3: Workers present, spawn near workers
  - workers_present at chunks [45, 48]
  - spawn_chunk = 47
  - min_distance = 1.0 chunk → normalized = 0.037
  - penalty = 0.037 × -0.4 = -0.015 (minimal - good interception!)

Scenario 4: Workers present, spawn far from workers
  - workers_present at chunks [45, 48]
  - spawn_chunk = 300
  - min_distance = 14.2 chunks → normalized = 0.53
  - penalty = 0.53 × -0.4 = -0.21 (significant - missed opportunity!)


LOGGING OUTPUT
═══════════════════════════════════════════════════════════════

[SpawnLocation] Mode=IDLE, spawn=200, hive=62, distance=15.3, penalty=-0.17
[SpawnLocation] Mode=ACTIVE, spawn=47, nearest_worker=45, distance=1.0, penalty=-0.015
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
