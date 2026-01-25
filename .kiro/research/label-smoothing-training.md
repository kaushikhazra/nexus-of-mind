# Label Smoothing for NN Training

## Research Document
**Created:** 2026-01-25
**Branch:** feature/label-smoothing-training
**Status:** Research & Design Phase

---

## 1. Problem Statement

### The Issue: Mode Collapse During Training

The Queen NN exhibits severe mode collapse where it converges to outputting a single chunk (chunk 179) for ~67% of all decisions. This happens despite entropy regularization with coefficient 0.2.

### Root Cause Analysis

When training with reward signals, we use **one-hot targets**:
```python
chunk_target = [0, 0, ..., 1.0, ..., 0]  # Target chunk = 1.0, others = 0.0
```

This teaches the model: "This chunk should be 100%, everything else 0%."

### Mathematical Proof of Problem

```
Cross-Entropy improvement from collapsing:  5.192
Entropy penalty from collapsing:            0.922
Net gain from collapsing:                   4.271
```

The model is **rewarded** for collapsing because CE improvement (5.2) >> entropy penalty (0.9).

Even with entropy_coef = 0.2:
- Entropy bonus at max (uniform): 0.2 × 5.55 = 1.11
- Entropy bonus when collapsed: 0.2 × 0.94 = 0.19
- Difference: only 0.92

The CE loss reduction of 5.2 easily overwhelms the 0.92 entropy penalty.

---

## 2. Solution: Label Smoothing

### Concept

Instead of hard one-hot targets, use **soft targets** that distribute some probability mass to non-target classes:

```python
# Hard target (current):
[0, 0, ..., 1.0, ..., 0]

# Smoothed target (proposed):
[0.0004, 0.0004, ..., 0.90, ..., 0.0004]  # 90% target, 10% spread across 256 others
```

### Why This Works

1. **Prevents overconfidence**: Model learns "179 is best, but others aren't impossible"
2. **Maintains diversity**: Non-zero targets keep all logits active
3. **Fixes root cause**: Training signal itself encourages diversity
4. **Works with entropy reg**: Complementary to existing entropy regularization

### Label Smoothing Formula

```python
smoothed_target = (1 - alpha) * one_hot + alpha / num_classes

where:
  alpha = smoothing factor (e.g., 0.1)
  one_hot = original one-hot vector
  num_classes = 257
```

For alpha = 0.1:
- Target class: 0.9 (instead of 1.0)
- Each other class: 0.1 / 256 ≈ 0.00039

---

## 3. Implementation Strategy

### Where to Apply

Label smoothing should be applied in:
1. `train_with_reward()` - When creating chunk targets for RL training
2. `train_with_supervision()` - When creating chunk targets for supervised training

### Default Parameters

```python
LABEL_SMOOTHING_ALPHA = 0.1  # 10% smoothing
```

This means:
- Target chunk gets 90% probability
- Remaining 10% spread across 256 other chunks
- Each non-target chunk gets ~0.039% probability

### Code Changes

```python
def _smooth_target(self, target_idx: int, alpha: float = 0.1) -> np.ndarray:
    """Create label-smoothed target for chunk prediction."""
    num_classes = self.chunk_output_size  # 257
    smoothed = np.full(num_classes, alpha / num_classes, dtype=np.float32)
    smoothed[target_idx] = 1.0 - alpha + alpha / num_classes
    return smoothed
```

---

## 4. Expected Impact

### Before (One-Hot)
- CE pushes hard toward single chunk
- Entropy penalty insufficient
- Result: Mode collapse to chunk 179 (67% of decisions)
- Entropy ratio: 35%

### After (Label Smoothing)
- CE pushes toward target but maintains diversity
- Model learns "target is best, others aren't zero"
- Expected: Wider distribution across chunks
- Expected entropy ratio: 50-70%

---

## 5. Testing Plan

1. **Short test (200 ticks)**: Verify no crashes, observe entropy trend
2. **Medium test (500 ticks)**: Check if entropy stabilizes higher
3. **Long test (1000+ ticks)**: Verify sustained diversity without collapse

### Success Criteria

- Entropy ratio stays above 50%
- Chunk 179 dominance drops below 50%
- Model still learns (loss decreases, reward signal works)

---

## 6. Alternative Approaches Considered

| Approach | Pros | Cons |
|----------|------|------|
| Higher entropy_coef | Simple | Fights training signal, unstable |
| Temperature scaling | Runtime control | Masks problem, doesn't fix weights |
| **Label smoothing** | Fixes root cause | Requires code change |
| Dropout | Adds noise | Doesn't address target issue |

**Conclusion:** Label smoothing is the most direct solution as it fixes the training signal itself.

---

## 7. References

- Szegedy et al., "Rethinking the Inception Architecture" - Original label smoothing paper
- Used successfully in ImageNet training to prevent overconfident predictions
