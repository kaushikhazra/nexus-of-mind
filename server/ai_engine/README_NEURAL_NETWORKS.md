# Neural Network Implementations

## Active Implementation: PyTorch (nn_model.py)

The primary neural network implementation uses PyTorch for the following reasons:

1. **Better Debugging**: PyTorch's eager execution makes debugging straightforward
2. **Development Speed**: Faster iteration during model architecture experiments
3. **Community**: Larger research community using PyTorch for RL applications
4. **ONNX Export**: Easy export to ONNX for production deployment if needed

### Usage

```python
from ai_engine.nn_model import NNModel

model = NNModel()
prediction = model.predict(features)
```

### Key Features

- **Spawn Decision Generation**: Predicts optimal chunk and parasite type
- **Continuous Training**: Supports online learning from gameplay
- **Feature Extraction Integration**: Works with FeatureExtractor for observation processing
- **Simulation Gate Compatible**: Outputs confidence scores for gate evaluation

## Legacy Implementation: TensorFlow (neural_network.py)

The TensorFlow implementation is preserved for reference but is **NOT actively maintained**.

### Why It Exists

- Original implementation before PyTorch migration
- May be useful for TensorFlow Lite deployment in future
- Reference for architecture decisions

### DO NOT USE for new development.

If you import from `ai_engine.neural_network`, you will see a `DeprecationWarning`.

## Architecture

Both implementations share the same conceptual architecture:

### Input Features (64-dimensional vector)

The feature extractor converts raw game observations into a normalized feature vector:

- Queen state (energy, position, hive location)
- Player resource tracking (energy, minerals)
- Entity distributions (workers, protectors by chunk)
- Temporal patterns (energy delta, worker movement)

### Neural Network Structure

```
Input Layer:  64 features
    |
Dense Layer: 256 units (ReLU)
    |
Dropout:     0.2 (training only)
    |
Dense Layer: 256 units (ReLU)
    |
Dropout:     0.2 (training only)
    |
Output Layer: 257 units
    - 256 units: chunk selection (softmax)
    - 1 unit: parasite type (sigmoid)
```

### Output

- **Chunk Selection**: Probability distribution over 256 chunks
- **Parasite Type**: Binary classification (energy vs combat)
- **Confidence**: Max probability from chunk distribution

## Model Files

- `models/queen_sequential.pt` - PyTorch model weights
- `models/queen_sequential_metadata.json` - Training metadata (iterations, samples, version)

## Training Pipeline

1. **Experience Collection**: Observations stored in replay buffer
2. **Reward Calculation**: Based on spawn outcome (survival, disruption)
3. **Background Training**: Continuous updates in separate thread
4. **Model Versioning**: Track model changes for experience replay

## Migration Guide

If you're using the deprecated TensorFlow implementation, migrate as follows:

```python
# Old (deprecated)
from ai_engine.neural_network import QueenBehaviorNetwork
model = QueenBehaviorNetwork()
model.build_model()

# New (recommended)
from ai_engine.nn_model import NNModel
model = NNModel()
# Model is auto-initialized, no build_model() needed
```

## Performance Comparison

| Metric | TensorFlow | PyTorch |
|--------|------------|---------|
| Inference Time | ~5ms | ~2ms |
| Training Step | ~15ms | ~8ms |
| Memory Usage | Higher | Lower |
| GPU Utilization | Good | Excellent |
| Debugging | Difficult | Easy |

## Questions?

See the main project documentation or reach out to the development team.
