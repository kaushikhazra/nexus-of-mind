# Implementation Plan: PyTorch GPU Migration

## Overview

Migrate the Neural Network from TensorFlow to PyTorch to enable GPU acceleration on Windows. TensorFlow 2.x Windows binaries are CPU-only, while PyTorch has native CUDA 12.x support.

## Dependencies

- NNModel (nn_model.py) - current TensorFlow implementation
- SimulationGate (gate.py) - uses NNModel API
- Trainer (trainer.py) - uses NNModel API
- Message Handler - uses NNModel API
- Game Simulator - uses NNModel API

## Tasks

### Phase 1: PyTorch Installation

- [x] 1. Install PyTorch with CUDA support
  - [x] 1.1 Install PyTorch for CUDA 12.x
    - Command: `pip install torch --index-url https://download.pytorch.org/whl/cu121`
    - Installed: torch-2.5.1+cu121
    - _Requirements: 1.3_

  - [x] 1.2 Verify GPU detection
    - Test: `python -c "import torch; print(torch.cuda.is_available())"`
    - Result: `True`
    - _Requirements: 1.4_

  - [x] 1.3 Verify device name
    - Test: `python -c "import torch; print(torch.cuda.get_device_name(0))"`
    - Result: `NVIDIA GeForce RTX 3060 Laptop GPU`
    - _Requirements: 4.1_

### Phase 2: PyTorch Model Implementation

- [x] 2. Create QueenNN module
  - [x] 2.1 Define nn.Module class
    - File: `server/ai_engine/nn_model.py`
    - Add: `class QueenNN(nn.Module)` with identical architecture
    - _Requirements: 1.1_

  - [x] 2.2 Implement forward pass
    - Shared backbone: 29 → 32 (ReLU) → 16 (ReLU)
    - Chunk head: 16 → 32 (ReLU) → 257 (Softmax)
    - Type head: 16 → 1 (Sigmoid)
    - _Requirements: 1.1, 1.2_

  - [x] 2.3 Add device management
    - File: `server/ai_engine/nn_model.py`
    - Add: `get_device()` function for auto GPU/CPU detection
    - Move model to device on init
    - Result: Device=cuda (RTX 3060)
    - _Requirements: 1.3, 1.4_

- [x] 3. Implement NNModel wrapper
  - [x] 3.1 Update __init__
    - File: `server/ai_engine/nn_model.py`
    - Replace TF model build with PyTorch QueenNN
    - Store device reference
    - _Requirements: 1.3_

  - [x] 3.2 Implement predict()
    - Convert numpy input to tensor on device
    - Run inference with torch.no_grad()
    - Convert output back to numpy
    - _Requirements: 2.1_

  - [x] 3.3 Implement get_spawn_decision()
    - Same logic as TF version
    - Handle chunk=256 as no-spawn
    - Return identical dict structure
    - _Requirements: 2.5_

  - [x] 3.4 Implement train_step()
    - Accept numpy features/targets
    - Compute loss with entropy regularization
    - Run optimizer step
    - Return loss dict
    - _Requirements: 2.2_

  - [x] 3.5 Implement train_with_reward()
    - Same RL-style training logic
    - Map chunk_id=-1 to target_chunk=256
    - _Requirements: 2.3_

  - [x] 3.6 Implement train_with_supervision()
    - Same supervised training logic
    - One-hot target for chunk
    - _Requirements: 2.4_

### Phase 3: Entropy Regularization

- [x] 4. Port entropy-regularized loss
  - [x] 4.1 Implement entropy calculation
    - File: `server/ai_engine/nn_model.py`
    - Formula: `-sum(p * log(p + 1e-8))`
    - Verified: entropy=5.527 in training output
    - _Requirements: 3.1_

  - [x] 4.2 Implement combined loss
    - Chunk loss: `CE - entropy_coef * entropy`
    - Type loss: `binary_cross_entropy`
    - Total: `chunk_loss + 0.5 * type_loss`
    - _Requirements: 3.1, 3.2_

  - [x] 4.3 Preserve entropy methods
    - Implement: `get_entropy()`
    - Implement: `get_max_entropy()`
    - Implement: `get_distribution_stats()`
    - _Requirements: 3.3_

### Phase 4: Model Persistence

- [x] 5. Update save/load for PyTorch
  - [x] 5.1 Implement save_model()
    - File: `server/ai_engine/nn_model.py`
    - Save: `torch.save(model.state_dict(), path)`
    - Use `.pt` extension
    - _Requirements: 2.6_

  - [x] 5.2 Implement _load_model_if_exists()
    - Load: `model.load_state_dict(torch.load(path))`
    - Handle missing files gracefully
    - _Requirements: 2.6_

  - [x] 5.3 Update metadata
    - Add: `'framework': 'pytorch'` to metadata
    - Keep architecture_version, parameter count
    - _Requirements: 2.6_

  - [x] 5.4 Handle old TF files
    - Detect .h5 files, log warning
    - Don't crash, start fresh
    - _Requirements: 1.4_

### Phase 5: Utility Methods

- [x] 6. Port remaining methods
  - [x] 6.1 Implement reset_weights()
    - Reinitialize model parameters
    - Backup old weights if requested
    - _Requirements: 2.6_

  - [x] 6.2 Implement full_reset()
    - Delete saved model files
    - Rebuild fresh model
    - _Requirements: 2.6_

  - [x] 6.3 Implement get_stats()
    - Return same dict structure
    - Include device info
    - Verified: framework=pytorch, device=cuda
    - _Requirements: 4.1_

  - [x] 6.4 Implement get_model_summary()
    - Return string representation
    - _Requirements: 2.1_

  - [x] 6.5 Implement _count_parameters()
    - Sum all trainable parameters
    - Result: 10,530 parameters
    - _Requirements: 1.2_

### Phase 6: Integration Testing

- [x] 7. Verify API compatibility
  - [x] 7.1 Test with gate.py
    - File: `server/ai_engine/simulation/gate.py`
    - Verify: `nn_model.get_spawn_decision()` works
    - Verify: `nn_model.predict()` works
    - Result: OK
    - _Requirements: 2.1, 2.5_

  - [x] 7.2 Test with trainer.py
    - File: `server/ai_engine/training/trainer.py`
    - Verify: training loop works
    - Verify: loss values reasonable
    - Result: train_with_reward OK, train_with_supervision OK
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ] 7.3 Test with message_handler.py
    - File: `server/websocket/message_handler.py`
    - Verify: inference works
    - Verify: training triggers work
    - _Requirements: 2.1_

  - [ ] 7.4 Test with game simulator
    - Command: `python -m server.game_simulator.main`
    - Verify: full loop runs
    - Verify: GPU utilized (check nvidia-smi)
    - _Requirements: 1.3, 2.1_

### Phase 7: Performance Validation

- [x] 8. Benchmark and validate
  - [x] 8.1 Measure inference latency
    - Run 100 inference calls
    - Target: < 5ms per call on GPU
    - Result: **0.60ms** per call - PASSED
    - _Requirements: NFR Performance_

  - [x] 8.2 Measure training latency
    - Run 100 training steps
    - Target: < 10ms per step on GPU
    - Result: **3.71ms** per step - PASSED
    - _Requirements: NFR Performance_

  - [ ] 8.3 Check GPU memory usage
    - Monitor via nvidia-smi
    - Target: < 100MB for model
    - _Requirements: 4.2_

  - [x] 8.4 Log device on startup
    - Print: "Using GPU: NVIDIA GeForce RTX 3060" or "Using CPU"
    - Result: Logs "Using GPU: NVIDIA GeForce RTX 3060 Laptop GPU"
    - _Requirements: 4.1_

### Phase 8: Cleanup (Optional)

- [ ] 9. Remove TensorFlow dependency
  - [ ] 9.1 Remove TF imports
    - File: `server/ai_engine/nn_model.py`
    - Remove: `import tensorflow`, `from tensorflow import keras`
    - _Requirements: Out of scope_

  - [ ] 9.2 Update requirements
    - Remove: `tensorflow` from requirements.txt
    - Add: `torch` if not present
    - _Requirements: Out of scope_

## Completion Criteria

1. [x] PyTorch installed with CUDA support
2. [x] `torch.cuda.is_available()` returns True
3. [x] NNModel uses identical architecture (29→32→16→split heads)
4. [x] All public methods have same signatures and return types
5. [x] Entropy regularization works (loss decreases, entropy stays healthy)
6. [x] Model saves/loads in .pt format
7. [ ] Game simulator runs end-to-end on GPU
8. [x] Inference < 5ms (0.60ms), training step < 10ms (3.71ms) on GPU

## Rollback Plan

If issues arise:
1. Keep TensorFlow nn_model.py as nn_model_tf.py
2. Can switch back by renaming files
3. No other files need changes (API preserved)
