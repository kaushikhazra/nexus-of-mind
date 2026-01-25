# PyTorch GPU Migration - Requirements

## Introduction

Migrate the Neural Network model from TensorFlow to PyTorch to enable GPU acceleration on Windows. TensorFlow 2.x on Windows lacks native GPU support (dropped after v2.10), while PyTorch has excellent CUDA support on Windows.

**Current Problem:**
- TensorFlow 2.20.0 Windows binary: `Built with CUDA: False`
- Training/inference runs on CPU only
- CPU becomes bottleneck in turbo mode

**Solution:**
Migrate to PyTorch with automatic GPU detection.

## Hardware Context

- GPU: NVIDIA GeForce RTX 3060 (6GB VRAM)
- CUDA Toolkit: v12.8
- Driver: 581.57

## Requirements

### Requirement 1: PyTorch Model Equivalent

**User Story:** As a developer, I need the NN model in PyTorch for Windows GPU support.

#### Acceptance Criteria

1. Architecture SHALL be identical:
   - Input: 29 features
   - Hidden 1: 32 neurons (ReLU)
   - Hidden 2: 16 neurons (ReLU)
   - Chunk Head: 16 → 32 → 257 (Softmax)
   - Type Head: 16 → 1 (Sigmoid)
2. Parameter count SHALL remain ~10,530
3. Model SHALL auto-detect and use GPU when available
4. Model SHALL fall back to CPU gracefully

### Requirement 2: Preserve API Interface

**User Story:** As the training system, I need the same API so existing code works.

#### Acceptance Criteria

1. `predict()` SHALL accept numpy arrays, return (chunk_probs, type_prob)
2. `train_step()` SHALL accept features/targets, return loss dict
3. `train_with_reward()` SHALL implement RL-style training
4. `train_with_supervision()` SHALL implement supervised training
5. `get_spawn_decision()` SHALL return identical dict structure
6. `save_model()` SHALL use PyTorch format (.pt)

### Requirement 3: Entropy Regularization

**User Story:** As the NN, I need entropy regularization to prevent collapse.

#### Acceptance Criteria

1. Loss SHALL include: `loss = CE - entropy_coef * entropy`
2. Default entropy coefficient SHALL be 0.03
3. `get_entropy()` and `get_distribution_stats()` SHALL be preserved

### Requirement 4: Device Management

**User Story:** As a developer, I need clear GPU/CPU status reporting.

#### Acceptance Criteria

1. System SHALL log device at startup (GPU name or CPU)
2. GPU memory usage SHALL be minimal (~50MB for 10k params)
3. All tensors SHALL be on same device (no device mismatch errors)

## Non-Functional Requirements

- GPU inference: < 5ms latency
- Training step: < 10ms on GPU
- Compatible with CUDA 12.x, Python 3.10+
- Works with existing WebSocket handler and game simulator

## Out of Scope

- Multi-GPU, distributed training
- ONNX/TensorRT optimization (future)
- TF weight migration (fresh training preferred)
