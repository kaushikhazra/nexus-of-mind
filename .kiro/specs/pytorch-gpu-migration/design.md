# PyTorch GPU Migration - Design

## Overview

Replace `server/ai_engine/nn_model.py` TensorFlow implementation with PyTorch while maintaining identical API and behavior.

## Architecture

### Model Structure (Unchanged)

```
Input (29)
    │
    ▼
Dense(32, ReLU) ─── "hidden1"
    │
    ▼
Dense(16, ReLU) ─── "hidden2"
    │
    ├────────────────┬────────────────┐
    ▼                ▼                │
Dense(32, ReLU)  Dense(1, Sigmoid)   │
"chunk_expand"   "type_prob"         │
    │                                 │
    ▼                                 │
Dense(257, Softmax)                  │
"chunk_probs"                        │
```

### PyTorch Implementation

```python
class QueenNN(nn.Module):
    def __init__(self):
        super().__init__()
        # Shared backbone
        self.hidden1 = nn.Linear(29, 32)
        self.hidden2 = nn.Linear(32, 16)

        # Chunk head
        self.chunk_expand = nn.Linear(16, 32)
        self.chunk_out = nn.Linear(32, 257)

        # Type head
        self.type_out = nn.Linear(16, 1)

    def forward(self, x):
        x = F.relu(self.hidden1(x))
        x = F.relu(self.hidden2(x))

        # Chunk head
        chunk = F.relu(self.chunk_expand(x))
        chunk_probs = F.softmax(self.chunk_out(chunk), dim=-1)

        # Type head
        type_prob = torch.sigmoid(self.type_out(x))

        return chunk_probs, type_prob
```

## Device Management

### Automatic GPU Detection

```python
def get_device():
    if torch.cuda.is_available():
        device = torch.device("cuda")
        logger.info(f"Using GPU: {torch.cuda.get_device_name(0)}")
    else:
        device = torch.device("cpu")
        logger.info("Using CPU (no GPU available)")
    return device
```

### Tensor Handling

- All model parameters on same device
- Input numpy arrays converted to tensors on device
- Output converted back to numpy for API compatibility

```python
def predict(self, features: np.ndarray):
    with torch.no_grad():
        x = torch.from_numpy(features).float().to(self.device)
        chunk_probs, type_prob = self.model(x)
        return chunk_probs.cpu().numpy(), type_prob.cpu().numpy()
```

## Loss Function

### Entropy-Regularized Cross-Entropy

```python
def compute_loss(self, chunk_probs, chunk_target, type_prob, type_target):
    # Cross-entropy for chunk
    ce_loss = F.cross_entropy(chunk_logits, chunk_target)

    # Entropy bonus (maximize entropy = minimize negative entropy)
    entropy = -torch.sum(chunk_probs * torch.log(chunk_probs + 1e-8), dim=-1)

    # Combined: minimize CE, maximize entropy
    chunk_loss = ce_loss - self.entropy_coef * entropy.mean()

    # Binary CE for type
    type_loss = F.binary_cross_entropy(type_prob, type_target)

    return chunk_loss + 0.5 * type_loss
```

## File Changes

### Modified Files

| File | Changes |
|------|---------|
| `server/ai_engine/nn_model.py` | Complete rewrite to PyTorch |
| `server/ai_engine/__init__.py` | Update imports if needed |

### No Changes Required

- `server/ai_engine/simulation/gate.py` - uses NNModel API only
- `server/ai_engine/training/trainer.py` - uses NNModel API only
- `server/websocket/message_handler.py` - uses NNModel API only
- `server/game_simulator/*` - uses NNModel API only

## Weight File Format

### Old (TensorFlow)
```
models/queen_nn.weights.h5
models/queen_nn_metadata.json
```

### New (PyTorch)
```
models/queen_nn.pt              # state_dict
models/queen_nn_metadata.json   # same format, add framework field
```

## Migration Strategy

1. **Fresh Start (Recommended)**
   - Delete old TF weights
   - Train from scratch with entropy regularization
   - Model recovers good distribution quickly

2. **Weight Transfer (Optional)**
   - Extract TF weights as numpy
   - Load into PyTorch layers with matching shapes
   - Complex due to weight ordering differences

## Testing Strategy

1. Verify GPU detection and usage
2. Verify identical output shape/format
3. Verify training reduces loss
4. Verify entropy stays healthy
5. Run game simulator end-to-end
