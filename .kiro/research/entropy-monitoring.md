# Entropy Monitoring for Neural Network Health

## Overview

Entropy is used to monitor the health of the NN's probability distributions. A healthy NN should maintain exploration (high entropy) while still making decisive actions when confident.

## Shannon Entropy Formula

We use **Shannon Entropy** from information theory:

```
H(p) = -Σ p(x) × log(p(x))
```

Where:
- `p(x)` is the probability of each action/class
- `log` is natural logarithm (ln)
- Sum is over all possible actions

### Implementation

```python
# From nn_model.py
def get_entropy(self, probs: np.ndarray) -> float:
    probs_clean = probs[probs > 1e-10]  # Avoid log(0)
    return float(-np.sum(probs_clean * np.log(probs_clean)))

def get_max_entropy(self, num_classes: int) -> float:
    return float(np.log(num_classes))  # Uniform distribution
```

## Key Metrics

| Metric | Formula | Description |
|--------|---------|-------------|
| **Entropy** | `-Σ p × ln(p)` | Measures how spread out the distribution is |
| **Max Entropy** | `ln(num_classes)` | Maximum possible entropy (uniform distribution) |
| **Entropy Ratio** | `entropy / max_entropy` | Normalized 0-1 scale |
| **Effective Actions** | `e^entropy` | Perplexity - equivalent number of equally-likely choices |

## Entropy Values for Five-NN Architecture

### NN4 - Chunk Selection (5 classes)
- Max entropy: `ln(5)` ≈ **1.609**
- Uniform distribution: each chunk has 20% probability

### NN3 - Type Selection (2 classes)
- Max entropy: `ln(2)` ≈ **0.693**
- Uniform distribution: 50% energy, 50% combat

### NN5 - Quantity Selection (5 classes)
- Max entropy: `ln(5)` ≈ **1.609**
- Uniform distribution: each quantity has 20% probability

## Health Thresholds

Based on entropy ratio (`current_entropy / max_entropy`):

| Ratio | Status | Meaning |
|-------|--------|---------|
| ≥ 0.5 | **Healthy** | Good exploration, NN considering multiple options |
| 0.25 - 0.5 | **Warning** | Distribution narrowing, may be over-fitting |
| < 0.25 | **Collapsed** | NN stuck on one action, needs intervention |

## Interpretation Examples

### Healthy Distribution (entropy ratio ~0.7)
```
Chunk probs: [0.25, 0.22, 0.20, 0.18, 0.15]
Entropy: 1.58 / 1.609 = 0.98 ratio
Effective actions: 4.8 (almost all 5 chunks viable)
```

### Warning Distribution (entropy ratio ~0.4)
```
Chunk probs: [0.60, 0.20, 0.10, 0.07, 0.03]
Entropy: 0.64 / 1.609 = 0.40 ratio
Effective actions: 1.9 (only ~2 real choices)
```

### Collapsed Distribution (entropy ratio ~0.1)
```
Chunk probs: [0.95, 0.02, 0.01, 0.01, 0.01]
Entropy: 0.16 / 1.609 = 0.10 ratio
Effective actions: 1.2 (essentially one choice)
```

## Entropy in Training Loss

Entropy bonus is added to the loss function to encourage exploration:

```python
# From nn_model.py training
type_entropy = -torch.sum(type_probs * torch.log(type_probs + 1e-8), dim=-1).mean()
chunk_entropy = -torch.sum(chunk_probs * torch.log(chunk_probs + 1e-8), dim=-1).mean()

# Entropy is SUBTRACTED from loss (negative = bonus for high entropy)
total_loss = base_loss - entropy_coef * (type_entropy + chunk_entropy)
```

The `entropy_coef` controls how much exploration is encouraged vs exploitation.

## Dashboard Monitoring

The dashboard displays:
- **Current Entropy**: Raw entropy value
- **Max Entropy**: Theoretical maximum (ln of num classes)
- **Entropy Ratio**: Percentage of max (shown as progress bar)
- **Effective Actions**: How many "real" choices the NN is considering
- **Health Status**: healthy / warning / collapsed
- **Entropy History**: Time series chart showing entropy over training

## Recovery from Collapse

If entropy collapses:
1. Increase `entropy_coef` to encourage more exploration
2. Add noise to training (label smoothing)
3. Reset optimizer momentum
4. In extreme cases, reinitialize some weights

---

*Research document for Nexus of Mind - Queen NN Training*
