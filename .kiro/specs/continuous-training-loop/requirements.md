# Continuous Training Loop - Requirements

## Introduction

This specification defines a continuous training system that decouples NN training from inference. Training runs in a background thread, producing new model versions every second, while inference uses the latest model to respond to observations.

**Key Innovation:**
- Training and inference run in separate threads
- Experience replay buffer enables batch training
- Model improves every second instead of every 15 seconds
- Non-blocking: training never delays inference

**Core Design Principle: Gate IS the Cost Function**

The simulation gate is not just a validator - it IS the cost function for training:
```
gate_signal = R_expected - threshold

where:
  R_expected = w1×P_survival + w2×D_disruption + w3×L_location + exploration_bonus
  threshold = 0.6

Result:
  > 0  →  Good action (SEND at inference time)
  ≤ 0  →  Bad action (WAIT at inference time)
```

The NN learns to maximize this numeric signal. The gate_signal at inference time is ground truth - it reflects actual game dynamics at that moment.

## Glossary

- **Experience**: A tuple of (observation, action, gate_signal, was_executed, actual_reward) representing one decision
- **Gate Signal**: Numeric value (R_expected - 0.6) that serves as training feedback
- **Replay Buffer**: Fixed-size storage for experiences, enabling batch sampling
- **Pending Experience**: An experience waiting for its actual_reward (known at next observation, only for SEND actions)
- **Model Version**: Incrementing counter for each training step
- **Training Interval**: Time between training steps (default: 1 second)

## Requirements

### Requirement 1: Experience Replay Buffer

**User Story:** As the Queen AI, I need to store past experiences so that I can learn from them multiple times.

**Problem Statement:**
- Currently training on single samples (high variance)
- Experiences are discarded after one use
- No ability to replay important experiences

#### Acceptance Criteria

1. THE System SHALL implement an Experience dataclass containing:
   - `observation`: 28 normalized feature values
   - `spawn_chunk`: int (0-399)
   - `spawn_type`: str ('energy' or 'combat')
   - `nn_confidence`: float (NN's confidence in the action)
   - `gate_signal`: float (R_expected - 0.6, can be negative)
   - `R_expected`: float (raw expected reward for logging)
   - `was_executed`: bool (True if SEND, False if WAIT)
   - `actual_reward`: Optional[float] (from game, None for WAIT actions)
   - `timestamp`: float (creation time)
   - `territory_id`: str (for multi-territory support)
   - `model_version`: int (which model version made this decision)

2. THE System SHALL implement ExperienceReplayBuffer with:
   - Fixed capacity (default: 10,000 experiences)
   - FIFO eviction when capacity exceeded
   - Thread-safe operations using locks

3. THE buffer SHALL store ALL experiences:
   - Both SEND (was_executed=True) and WAIT (was_executed=False) actions
   - WAIT actions have actual_reward=None (never updated)
   - SEND actions start with actual_reward=None, updated when next observation arrives

4. THE buffer SHALL provide batch sampling:
   - Sample N random experiences
   - Include both SEND and WAIT experiences
   - Return empty list if insufficient experiences

5. THE buffer operations SHALL be thread-safe:
   - `add()` - called from inference thread
   - `sample()` - called from training thread
   - `update_pending_reward()` - called from inference thread (for SEND only)

### Requirement 2: Background Training Thread

**User Story:** As the Queen AI, I need to train continuously so that I improve faster than waiting for observations.

#### Acceptance Criteria

1. THE System SHALL implement ContinuousTrainer class with:
   - Background thread for training loop
   - Reference to NN model and replay buffer
   - Configuration for training parameters

2. THE training loop SHALL execute every training_interval (default: 1 second):
   - Sample batch from replay buffer
   - Skip training if batch_size < min_batch_size
   - Calculate training rewards from gate_signal (see Requirement 5)
   - Train model on batch
   - Increment model version
   - Log training metrics

3. THE trainer SHALL provide model access for inference:
   - `get_model_for_inference()` returns latest model
   - Thread-safe access using lock

4. THE trainer SHALL support start/stop operations:
   - `start()` - spawns daemon thread
   - `stop()` - gracefully terminates thread with timeout

5. THE training thread SHALL NOT block inference:
   - Training runs in separate daemon thread
   - Inference uses model without waiting for training

### Requirement 3: Model Versioning

**User Story:** As a developer, I need to track model versions so that I can monitor training progress and debug issues.

#### Acceptance Criteria

1. THE System SHALL maintain a model version counter:
   - Increment on each successful training step
   - Expose via `trainer.model_version` property

2. THE System SHALL ensure thread-safe model access:
   - PyTorch models are safe for concurrent read/write
   - Use lock for version counter updates

3. THE System SHALL log model version with each:
   - Training step completion
   - Inference execution (which version was used)

### Requirement 4: Delayed Reward Handling

**User Story:** As the Queen AI, I need to handle delayed rewards so that I can learn from real game outcomes.

**Problem Statement:**
- Actual rewards are only known 15 seconds later (at next observation)
- Only SEND actions have actual rewards (WAIT actions have no game outcome)
- Need to associate rewards with correct experiences

#### Acceptance Criteria

1. THE System SHALL handle pending experiences for SEND actions:
   - Create experience with `actual_reward=None` at inference time
   - Store territory_id to track pending experience
   - Only one pending experience per territory

2. THE System SHALL update rewards when observation arrives:
   - Calculate reward using reward_calculator
   - Update pending SEND experience's `actual_reward`
   - WAIT experiences are never updated (no game outcome)

3. THE System SHALL NOT block training on pending rewards:
   - Experiences with actual_reward=None can still be sampled
   - Training reward calculation handles None actual_reward

### Requirement 5: Training Reward Calculation (Gate as Cost Function)

**User Story:** As the Queen AI, I need the gate signal to guide my learning so that I make better decisions.

**Core Principle:** The gate_signal IS the training feedback. No separate validation needed.

#### Acceptance Criteria

1. THE System SHALL calculate training reward based on execution status:
   ```python
   if was_executed:  # SEND action
       if actual_reward is not None:
           training_reward = gate_weight × gate_signal + actual_weight × actual_reward
       else:
           training_reward = gate_signal  # Pending, use gate signal only
   else:  # WAIT action
       training_reward = gate_signal  # Negative value IS the penalty
   ```

2. THE gate_signal SHALL serve as direct feedback:
   - Positive gate_signal = good action (NN should do more of this)
   - Negative gate_signal = bad action (NN should avoid this)
   - Magnitude indicates how good or bad

3. THE System SHALL NOT re-evaluate experiences:
   - gate_signal at inference time is ground truth
   - Re-evaluation would drift from actual game dynamics
   - No gate validation during training

4. THE configuration SHALL define reward weights:
   - `gate_weight`: float (default: 0.3) - weight for gate_signal in SEND actions
   - `actual_weight`: float (default: 0.7) - weight for actual_reward in SEND actions

### Requirement 6: Configuration

**User Story:** As a developer, I need all parameters configurable so that I can tune the system.

#### Acceptance Criteria

1. THE System SHALL support ContinuousTrainingConfig:
   ```python
   @dataclass
   class ContinuousTrainingConfig:
       # Training loop
       training_interval: float = 1.0      # Train every 1 second
       batch_size: int = 32                # Samples per training step
       min_batch_size: int = 8             # Minimum samples to train

       # Replay buffer
       buffer_capacity: int = 10000        # Max experiences stored

       # Reward weighting (for SEND actions with actual_reward)
       gate_weight: float = 0.3            # Weight for gate_signal
       actual_weight: float = 0.7          # Weight for actual_reward

       # Learning rate
       learning_rate: float = 0.001

       # Gate threshold (must match gate config)
       reward_threshold: float = 0.6

       # Feature flags
       enabled: bool = True
   ```

2. THE configuration SHALL be loadable from YAML file
3. THE configuration SHALL have sensible defaults
4. THE System SHALL validate configuration on load

### Requirement 7: Thread Safety

**User Story:** As a developer, I need thread-safe operations so that the system doesn't crash or produce incorrect results.

#### Acceptance Criteria

1. THE replay buffer SHALL use locks for all operations:
   - `threading.Lock()` for buffer access
   - Timeout on lock acquisition (default: 5 seconds)

2. THE trainer SHALL handle thread errors gracefully:
   - Catch exceptions in training loop
   - Log errors and continue
   - Auto-restart on crash (optional)

3. THE System SHALL prevent deadlocks:
   - Single lock per resource
   - Consistent lock ordering
   - Timeout on all lock acquisitions

### Requirement 8: Metrics and Observability

**User Story:** As a developer, I need metrics so that I can monitor training performance.

#### Acceptance Criteria

1. THE System SHALL track training metrics:
   - `training_steps`: Total training steps completed
   - `average_loss`: Rolling average loss
   - `average_batch_size`: Rolling average batch size
   - `training_time_ms`: Time per training step
   - `average_gate_signal`: Rolling average of gate_signal in batch

2. THE System SHALL track buffer metrics:
   - `buffer_size`: Current number of experiences
   - `send_count`: Experiences with was_executed=True
   - `wait_count`: Experiences with was_executed=False
   - `pending_count`: SEND experiences awaiting actual_reward

3. THE System SHALL track model metrics:
   - `model_version`: Current version number
   - `steps_per_second`: Training throughput

4. THE metrics SHALL be exposed via API endpoint:
   - GET /api/training/stats
   - Include all metrics in JSON response

### Requirement 9: Integration with Message Handler

**User Story:** As a developer, I need seamless integration so that the existing system works with continuous training.

#### Acceptance Criteria

1. THE message handler SHALL use ContinuousTrainer:
   - Initialize trainer on startup
   - Use `trainer.get_model_for_inference()` for inference
   - Add experiences to replay buffer

2. THE message handler SHALL create experiences at inference time:
   - Extract gate_signal from gate evaluation
   - Determine was_executed from gate_signal > 0
   - Store experience immediately (SEND and WAIT)

3. THE message handler SHALL update pending rewards:
   - When observation arrives, check for pending SEND experience
   - Calculate actual_reward and update buffer
   - Then proceed with new inference

4. THE System SHALL support enable/disable:
   - Config flag to enable/disable continuous training
   - Fall back to current behavior when disabled

### Requirement 10: Performance

**User Story:** As a developer, I need the system to meet performance requirements.

#### Acceptance Criteria

1. THE training step SHALL complete within training_interval:
   - If training takes longer, skip to next interval
   - Log warning when training exceeds interval

2. THE buffer operations SHALL complete in < 1ms:
   - add(): < 1ms
   - sample(): < 10ms for batch_size=32

3. THE inference latency SHALL NOT increase:
   - Model access via lock should be < 1ms
   - No blocking on training operations

4. THE memory usage SHALL be bounded:
   - Buffer: ~50MB for 10,000 experiences
   - No memory leaks in long sessions
