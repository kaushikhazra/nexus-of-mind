# Five-NN Sequential Architecture - Design

## Overview

Replace the single QueenNN (29→257+1) with SequentialQueenNN containing 5 specialized sub-networks that execute in sequence, each with focused inputs and bounded outputs.

---

## Architecture

### Sequential Flow

```
┌─────────────────┐
│ NN1: E_Suitable │──┐
│ (10 in → 5 out) │  │
└─────────────────┘  │    ┌─────────────┐     ┌─────────────┐     ┌──────────────┐
                     ├──► │ NN3: Type   │ ──► │ NN4: Chunk  │ ──► │ NN5: Quantity│
┌─────────────────┐  │    │ (10 → 2)    │     │ (15 → 6)    │     │   (7 → 5)    │
│ NN2: C_Suitable │──┘    └─────────────┘     └─────────────┘     └──────────────┘
│ (10 in → 5 out) │
└─────────────────┘
```

### Network Specifications

| NN | Purpose | Input | Output | Activation |
|----|---------|-------|--------|------------|
| NN1 | Energy Suitability | 10 | 5 | Sigmoid |
| NN2 | Combat Suitability | 10 | 5 | Sigmoid |
| NN3 | Type Decision | 10 | 2 | Softmax |
| NN4 | Chunk Decision | 15 | 6 | Softmax |
| NN5 | Quantity Decision | 7 | 5 | Softmax |

---

## Layer Architecture

### NN1: Energy Suitability
```python
nn.Sequential(
    nn.Linear(10, 8),
    nn.ReLU(),
    nn.Linear(8, 5),
    nn.Sigmoid()
)
```

### NN2: Combat Suitability
```python
nn.Sequential(
    nn.Linear(10, 8),
    nn.ReLU(),
    nn.Linear(8, 5),
    nn.Sigmoid()
)
```

### NN3: Type Decision
```python
nn.Sequential(
    nn.Linear(10, 8),
    nn.ReLU(),
    nn.Linear(8, 2),
    nn.Softmax(dim=-1)
)
```

### NN4: Chunk Decision
```python
nn.Sequential(
    nn.Linear(15, 12),
    nn.ReLU(),
    nn.Linear(12, 8),
    nn.ReLU(),
    nn.Linear(8, 6),
    nn.Softmax(dim=-1)
)
```

### NN5: Quantity Decision
```python
nn.Sequential(
    nn.Linear(7, 8),
    nn.ReLU(),
    nn.Linear(8, 5),
    nn.Softmax(dim=-1)
)
```

---

## Input Specifications

### NN1 Inputs (10 values)

| Index | Feature | Source |
|-------|---------|--------|
| 0,1 | Chunk 0: [protector_density, e_parasite_rate] | features[2,3] |
| 2,3 | Chunk 1: [protector_density, e_parasite_rate] | features[7,8] |
| 4,5 | Chunk 2: [protector_density, e_parasite_rate] | features[12,13] |
| 6,7 | Chunk 3: [protector_density, e_parasite_rate] | features[17,18] |
| 8,9 | Chunk 4: [protector_density, e_parasite_rate] | features[22,23] |

### NN2 Inputs (10 values)

| Index | Feature | Source |
|-------|---------|--------|
| 0,1 | Chunk 0: [protector_density, c_parasite_rate] | features[2,4] |
| 2,3 | Chunk 1: [protector_density, c_parasite_rate] | features[7,9] |
| 4,5 | Chunk 2: [protector_density, c_parasite_rate] | features[12,14] |
| 6,7 | Chunk 3: [protector_density, c_parasite_rate] | features[17,19] |
| 8,9 | Chunk 4: [protector_density, c_parasite_rate] | features[22,24] |

### NN3 Inputs (10 values)

| Index | Feature | Source |
|-------|---------|--------|
| 0-4 | Energy suitability × 5 | NN1 output |
| 5-9 | Combat suitability × 5 | NN2 output |

### NN4 Inputs (15 values)

| Index | Feature | Source |
|-------|---------|--------|
| 0-4 | Worker density × 5 | features[1,6,11,16,21] |
| 5-9 | Suitability × 5 (for chosen type) | NN1 or NN2 output |
| 10-14 | Parasite saturation × 5 (for chosen type) | features based on type |

Type is implicit - the selected suitability/saturation arrays encode the type decision.

### NN5 Inputs (7 values)

| Index | Feature | Source |
|-------|---------|--------|
| 0 | Selected chunk parasite saturation | From NN4 selection |
| 1 | Selected chunk suitability | From NN1/NN2 |
| 2 | Queen spawn capacity (for type) | features[25] or features[26] |
| 3 | Player energy rate | features[27] |
| 4 | Player mineral rate | features[28] |
| 5 | Type decision | NN3 argmax (0 or 1) |
| 6 | Chunk selection | NN4 argmax (0-5) |

---

## Output Specifications

### Final Decision Structure

```python
{
    'spawnChunk': int,      # Actual chunk ID from top-5, or -1 for NO_SPAWN
    'spawnType': str,       # 'energy' or 'combat' or None
    'quantity': int,        # 0-4
    'confidence': float,    # NN4 max probability
    'pipeline': {
        'e_suitability': [5 floats],
        'c_suitability': [5 floats],
        'type_probs': [2 floats],
        'chunk_probs': [6 floats],
        'quantity_probs': [5 floats]
    }
}
```

---

## Class Design

### SequentialQueenNN (PyTorch Module)

```python
class SequentialQueenNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.nn1_energy_suit = self._build_suitability_net()
        self.nn2_combat_suit = self._build_suitability_net()
        self.nn3_type = self._build_type_net()
        self.nn4_chunk = self._build_chunk_net()
        self.nn5_quantity = self._build_quantity_net()

    def forward(self, features, top_chunk_ids):
        # NN1 & NN2 (can be parallel)
        nn1_input = self._extract_nn1_input(features)
        nn2_input = self._extract_nn2_input(features)
        e_suit = self.nn1_energy_suit(nn1_input)
        c_suit = self.nn2_combat_suit(nn2_input)

        # NN3: Type decision
        nn3_input = torch.cat([e_suit, c_suit], dim=-1)
        type_probs = self.nn3_type(nn3_input)
        type_decision = torch.argmax(type_probs, dim=-1)

        # NN4: Chunk decision (with type-selected inputs)
        nn4_input = self._extract_nn4_input(features, e_suit, c_suit, type_decision)
        chunk_probs = self.nn4_chunk(nn4_input)
        chunk_decision = torch.argmax(chunk_probs, dim=-1)

        # NN5: Quantity decision (skip if NO_SPAWN)
        if chunk_decision == 5:  # NO_SPAWN
            quantity_probs = torch.zeros(5)
            quantity_probs[0] = 1.0  # quantity = 0
        else:
            nn5_input = self._extract_nn5_input(features, e_suit, c_suit,
                                                 type_decision, chunk_decision)
            quantity_probs = self.nn5_quantity(nn5_input)

        return {
            'e_suitability': e_suit,
            'c_suitability': c_suit,
            'type_probs': type_probs,
            'chunk_probs': chunk_probs,
            'quantity_probs': quantity_probs
        }
```

### NNModel Wrapper Changes

```python
class NNModel:
    def __init__(self):
        self.model = SequentialQueenNN()
        # ... rest of initialization

    def predict(self, features):
        """Run sequential inference through 5 NNs."""
        with torch.no_grad():
            outputs = self.model(features, self.top_chunk_ids)
        return self._format_decision(outputs)

    def get_spawn_decision(self, features, explore=True):
        """High-level API for spawn decision."""
        outputs = self.predict(features)

        # Map relative chunk (0-4) to actual chunk ID
        chunk_idx = outputs['chunk_decision']
        if chunk_idx == 5:  # NO_SPAWN
            spawn_chunk = -1
        else:
            spawn_chunk = self.top_chunk_ids[chunk_idx]

        return {
            'spawnChunk': spawn_chunk,
            'spawnType': 'energy' if outputs['type_decision'] == 0 else 'combat',
            'quantity': outputs['quantity_decision'],
            'confidence': outputs['chunk_confidence'],
            'pipeline': outputs
        }
```

---

## Training Design

### Loss Function

```python
def compute_loss(self, outputs, targets, reward):
    """Compute combined loss for all 5 NNs."""

    # NN1 & NN2: MSE loss on suitability (regression)
    # Target: actual parasite survival rate (0-1)
    loss_nn1 = F.mse_loss(outputs['e_suitability'], targets['e_suit_target'])
    loss_nn2 = F.mse_loss(outputs['c_suitability'], targets['c_suit_target'])

    # NN3: Cross-entropy on type decision
    loss_nn3 = F.cross_entropy(outputs['type_probs'], targets['type_target'])

    # NN4: Cross-entropy on chunk decision
    loss_nn4 = F.cross_entropy(outputs['chunk_probs'], targets['chunk_target'])

    # NN5: Cross-entropy on quantity decision
    loss_nn5 = F.cross_entropy(outputs['quantity_probs'], targets['quantity_target'])

    # Combined loss (weighted by reward signal)
    total_loss = loss_nn1 + loss_nn2 + loss_nn3 + loss_nn4 + loss_nn5

    return total_loss * reward_weight(reward)
```

### Reward Attribution

All 5 NNs share responsibility for the outcome:
- Positive reward → reinforce all decisions in the chain
- Negative reward → discourage all decisions in the chain
- The chain succeeds or fails together

---

## Feature Extractor Changes

### New Interface

```python
class FeatureExtractor:
    def extract_all(self, observation) -> dict:
        """Extract features for all 5 NNs."""
        # First extract base 29 features (for compatibility)
        base_features = self.extract(observation)

        return {
            'nn1_input': self._extract_nn1_features(base_features),
            'nn2_input': self._extract_nn2_features(base_features),
            'worker_densities': self._extract_worker_densities(base_features),
            'e_parasite_rates': self._extract_e_parasite_rates(base_features),
            'c_parasite_rates': self._extract_c_parasite_rates(base_features),
            'queen_capacities': self._extract_queen_capacities(base_features),
            'player_rates': self._extract_player_rates(base_features),
            'top_chunk_ids': self._get_top_chunk_ids(observation)
        }
```

---

## File Changes

### Modified Files

| File | Changes |
|------|---------|
| `nn_model.py` | Replace QueenNN with SequentialQueenNN, update predict/train methods |
| `feature_extractor.py` | Add extract_all() and per-NN extraction methods |
| `message_handler.py` | Update to use new extract_all() and handle pipeline output |
| `trainer.py` | Update training loop for 5-NN chain training |
| `gate.py` | Update evaluation for new decision structure |

### No Changes Required

| File | Reason |
|------|--------|
| `game_simulator/*` | Observation format unchanged |
| `reward_calculator.py` | Independent of NN architecture |

---

## Model Persistence

### Save Format

```
models/
  queen_sequential_v{version}.pt    # All 5 NNs in single checkpoint
  queen_sequential_v{version}.json  # Metadata
```

### Checkpoint Structure

```python
{
    'version': int,
    'nn1_state': nn1.state_dict(),
    'nn2_state': nn2.state_dict(),
    'nn3_state': nn3.state_dict(),
    'nn4_state': nn4.state_dict(),
    'nn5_state': nn5.state_dict(),
    'optimizer_state': optimizer.state_dict(),
    'metadata': {...}
}
```

---

## Migration Strategy

1. **Phase 1:** Build SequentialQueenNN class alongside existing QueenNN
2. **Phase 2:** Update FeatureExtractor with extract_all()
3. **Phase 3:** Wire up NNModel to use new architecture
4. **Phase 4:** Update trainer for chain training
5. **Phase 5:** Update message_handler and gate
6. **Phase 6:** Test with simulator, remove old code
