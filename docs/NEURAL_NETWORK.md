# Neural Network Architecture

The Queen AI uses a **Five-NN Sequential Architecture** (~830 parameters) that controls parasite spawning behavior. This document details the technical implementation.

---

## Architecture Evolution

| Version | Architecture | Problem |
|---------|--------------|---------|
| v1 | Single NN: 29 inputs → 257 outputs | Mode collapse to chunk 179 (~67%) |
| v2 | + Entropy penalty, label smoothing | Better diversity, still mismatched |
| v3 | Five-NN Sequential (~830 params) | Current - specialized pipeline |

---

## Five-NN Sequential Architecture

```
NN1: Energy Suitability
├─ Input: 10 (protector_density + e_parasite_rate × 5 chunks)
├─ Output: 5 sigmoid (suitability per chunk)
└─ Purpose: Is chunk good for energy parasites?

NN2: Combat Suitability (parallel with NN1)
├─ Input: 10 (protector_density + c_parasite_rate × 5 chunks)
├─ Output: 5 sigmoid (suitability per chunk)
└─ Purpose: Is chunk good for combat parasites?

NN3: Type Decision
├─ Input: 10 (5 energy_suit + 5 combat_suit)
├─ Output: 2 softmax (P(energy), P(combat))
└─ Purpose: Energy or combat parasite?

NN4: Chunk Decision
├─ Input: 15 (5 worker_densities + 5 suitabilities + 5 saturations)
├─ Output: 6 softmax (P(chunk0-4) + P(NO_SPAWN))
└─ Purpose: Which chunk to target?

NN5: Quantity Decision
├─ Input: 7 (saturation, suitability, capacity, rates, type, chunk)
├─ Output: 5 softmax (P(0-4 parasites))
└─ Purpose: How many to spawn?
```

---

## Feature Extraction

**29 Base Features:**
- Per-chunk (×5): worker_density, protector_density, e_parasite_rate, c_parasite_rate
- Global: e/c_parasite_spawn_capacity, player_energy_rate, player_mineral_rate

---

## Simulation-Gated Inference

Before spawning, decisions are evaluated with a predictive cost function.

**Expected Reward Formula:**
```
R_expected = w₁·Survival + w₂·Disruption + w₃·Location + Exploration
```

**Weights:**
- w₁ (survival_weight) = 0.3
- w₂ (disruption_weight) = 0.5
- w₃ (location_weight) = 0.2

**Survival Probability:**
```
threat(d) =
  1.0                           if d < 2 chunks (kill zone)
  exp(-0.5·(d - 2))             if 2 ≤ d < 8 chunks (threat zone)
  0.0                           if d ≥ 8 chunks (safe zone)

P_survival = ∏ᵢ (1 - threat_factorᵢ)
```
One protector in kill zone = 0% survival.

**Worker Disruption:**
- Energy parasites: pursuit range = 6 chunks
- Combat parasites: pursuit range = 7.5 chunks

**Location Penalty:**
- α (hive_proximity_weight) = 0.3
- β (worker_proximity_weight) = 0.4

**Exploration Bonus (Deadlock Prevention):**
```
bonus = 0.35 · min(time_since_spawn, 300) / 300
```
Chunks not spawned at recently get increasing bonus.

**Gate Decision:**
```
if R_expected > θ: SEND spawn to game
else: WAIT, train on simulation feedback
```
- Default θ = -2000 (simulation mode, gate passes everything)
- Production θ = 0.0 (in YAML config)

---

## Learning Pipeline

**Dual Feedback:**
- Simulation feedback: Immediate (every observation)
- Real feedback: Delayed (executed actions only)
- Effective weight: simulation × 0.3 + real × 0.7

**Loss Functions:**
- NN1/NN2: MSE on suitability vs actual survival rate
- NN3/NN4/NN5: Cross-entropy

**On Queen Death:**
1. Capture death data (location, cause, timing, player units)
2. Analyze assault pattern (direct, flanking, coordinated, infiltration)
3. Update player behavior model
4. Train 5 NNs on failure signal (negative reward)
5. Generate new strategy for next generation

---

## PyTorch GPU Migration

- **Why**: TensorFlow 2.x Windows has no native GPU support after v2.10
- **Result**: PyTorch with auto GPU/CPU detection
- GPU: 0.60ms inference, 3.71ms training
- CPU: Still fast enough (model is only ~830 params)
- GPU mainly benefits turbo-mode simulator (79.5 TPS)

---

## Game Simulator

- **Purpose**: Automated training data generation (no 3D rendering)
- **Performance**: 1000+ ticks/sec in turbo mode (100x faster than gameplay)
- **Interface**: Reuses WebSocket protocol - NN cannot distinguish simulated from real
- **Curriculum**: Progressive difficulty phases

---

## Generational Evolution

- Gen 1: Random/baseline
- Gen 2-3: Avoid death locations, adaptive timing
- Gen 4+: Predictive placement, counter assault patterns
- Gen 7+: Multi-step planning, deceptive behaviors
