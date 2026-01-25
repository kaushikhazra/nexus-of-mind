# Label Smoothing Training - Design

## Overview

Add label smoothing to `NNModel` training methods to prevent mode collapse by replacing one-hot targets with soft probability distributions.

## Label Smoothing Formula

### Standard Label Smoothing

```
smoothed[i] = (1 - α) * one_hot[i] + α / K

where:
  α = smoothing factor (default 0.1)
  K = number of classes (257)
  one_hot[i] = 1 if i == target, else 0
```

### Result for α = 0.1, K = 257

```
Target class:     1 - 0.1 + 0.1/257 = 0.9004
Non-target class: 0 + 0.1/257       = 0.00039
Sum: 0.9004 + 256 * 0.00039 = 1.0 ✓
```

## Implementation

### New Method: `_create_smoothed_target()`

```python
def _create_smoothed_target(
    self,
    target_idx: int,
    alpha: float = 0.1
) -> np.ndarray:
    """
    Create label-smoothed target for chunk prediction.

    Args:
        target_idx: Index of target class (0-256)
        alpha: Smoothing factor (0.0 = one-hot, 1.0 = uniform)

    Returns:
        Smoothed probability distribution of shape (257,)
    """
    num_classes = self.chunk_output_size  # 257

    # Start with uniform distribution scaled by alpha
    smoothed = np.full(num_classes, alpha / num_classes, dtype=np.float32)

    # Add remaining probability to target
    smoothed[target_idx] += (1.0 - alpha)

    return smoothed
```

### Modified: `train_with_reward()`

```python
def train_with_reward(self, features, chunk_id, spawn_type, reward, learning_rate=0.01):
    target_chunk = NO_SPAWN_CHUNK if chunk_id == -1 else chunk_id

    if reward > 0:
        # Positive reward: use smoothed target (NEW)
        chunk_target = self._create_smoothed_target(target_chunk, alpha=0.1)
    else:
        # Negative reward: redistribute away from selected chunk (unchanged)
        chunk_probs, _ = self.predict(features)
        chunk_target = chunk_probs.copy()
        chunk_target[target_chunk] = max(0.0, chunk_target[target_chunk] - abs(reward) * 0.5)
        chunk_target = chunk_target / (chunk_target.sum() + 1e-8)

    # ... rest unchanged
```

### Modified: `train_with_supervision()`

```python
def train_with_supervision(self, features, target_chunk, target_type=None, learning_rate=0.01):
    # Use smoothed target instead of one-hot (NEW)
    chunk_target = self._create_smoothed_target(target_chunk, alpha=0.1)

    # ... rest unchanged
```

## Configuration

### New Constant

```python
# Label smoothing factor
# 0.0 = one-hot (current behavior)
# 0.1 = 10% smoothing (recommended)
# Higher = more uniform, less learning signal
DEFAULT_LABEL_SMOOTHING = 0.1
```

## File Changes

### Modified Files

| File | Changes |
|------|---------|
| `server/ai_engine/nn_model.py` | Add `_create_smoothed_target()`, modify training methods |

### No Changes Required

- `gate.py` - doesn't access training internals
- `trainer.py` - calls NNModel methods, unchanged API
- `message_handler.py` - unchanged API
- `game_simulator/*` - unchanged API

## Loss Function Interaction

### Current Loss (unchanged)

```python
chunk_loss = CE(logits, target) - entropy_coef * entropy(probs)
```

### How Label Smoothing Helps

With one-hot target:
- CE pushes logit[target] → +∞, others → -∞
- After softmax: p[target] → 1.0, others → 0.0

With smoothed target:
- CE pushes logit[target] high, but others stay non-zero
- After softmax: p[target] → 0.9, others → small but non-zero
- Entropy regularization now has "something to work with"

## Testing Strategy

1. **Unit Test**: Verify `_create_smoothed_target()` sums to 1.0
2. **Short Sim (200 ticks)**: Check entropy doesn't collapse
3. **Medium Sim (500 ticks)**: Verify entropy ratio > 50%
4. **Long Sim (1000 ticks)**: Confirm sustained diversity

## Rollback Plan

If issues arise:
1. Set `DEFAULT_LABEL_SMOOTHING = 0.0` (reverts to one-hot)
2. Or pass `alpha=0.0` to training methods
