# Continuous Training Loop - Requirements

## Introduction

This specification defines a continuous training system that decouples NN training from inference. Training runs in a background thread, producing new model versions every second, while inference uses the latest model to respond to observations. Both training and inference remain gated by the simulation gate.

**Key Innovation:**
- Training and inference run in separate threads
- Experience replay buffer enables batch training
- Model improves every second instead of every 15 seconds
- Non-blocking: training never delays inference

**Building on Simulation-Gated Inference:**
- Gate evaluates all inference outputs (unchanged)
- Experiences include gate decisions for training signal
- WAIT experiences provide negative training signal

## Glossary

- **Experience**: A tuple of (observation, action, gate_decision, reward) representing one decision
- **Replay Buffer**: Fixed-size storage for experiences, enabling batch sampling
- **Pending Experience**: An experience waiting for its reward (known at next observation)
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
   - `action`: (spawn_chunk, spawn_type) tuple
   - `gate_decision`: 'SEND' or 'WAIT'
   - `expected_reward`: float from simulation gate
   - `actual_reward`: Optional[float] (None if pending)
   - `timestamp`: float (creation time)
   - `territory_id`: str (for multi-territory support)

2. THE System SHALL implement ExperienceReplayBuffer with:
   - Fixed capacity (default: 10,000 experiences)
   - FIFO eviction when capacity exceeded
   - Thread-safe operations using locks

3. THE buffer SHALL track pending experiences:
   - Store experience with `actual_reward=None` when inference runs
   - Update with actual reward when next observation arrives

4. THE buffer SHALL provide batch sampling:
   - Sample N random completed experiences
   - Only return experiences with `actual_reward is not None`
   - Return empty list if insufficient completed experiences

5. THE buffer operations SHALL be thread-safe:
   - `add()` - called from inference thread
   - `sample()` - called from training thread
   - `update_pending_reward()` - called from inference thread

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
- Rewards are only known 15 seconds later (at next observation)
- Need to associate rewards with correct experiences

#### Acceptance Criteria

1. THE System SHALL handle pending experiences:
   - Create experience with `actual_reward=None` at inference time
   - Store territory_id to track pending experience
   - Only one pending experience per territory

2. THE System SHALL update rewards when observation arrives:
   - Calculate reward using reward_calculator
   - Update pending experience's `actual_reward`
   - Move experience to main buffer

3. THE System SHALL combine simulation and actual rewards:
   ```
   effective_reward = (simulation_weight × expected_reward) +
                      (actual_weight × actual_reward)
   ```
   - simulation_weight default: 0.3
   - actual_weight default: 0.7

### Requirement 5: Gate Integration (Inference)

**User Story:** As the Queen AI, I need gate decisions included in training so that I learn to make better decisions.

#### Acceptance Criteria

1. THE System SHALL store gate decision in experience:
   - 'SEND' - action was executed
   - 'WAIT' - action was blocked

2. THE System SHALL include WAIT experiences in training:
   - Use expected_reward as training signal (no actual reward)
   - Apply wait_reward_multiplier (default: 0.5) to reduce weight

3. THE gate SHALL remain the final authority:
   - All inference outputs evaluated by gate (unchanged)
   - Training does not bypass gate evaluation

### Requirement 5.1: Gate Validation During Training

**User Story:** As the Queen AI, I need the gate to validate my training data so that I don't learn from outdated or incorrect experiences.

**Problem Statement:**
- Experiences in the buffer may become stale as game dynamics evolve
- Model may drift from game dynamics without feedback
- Need continuous validation to ensure training aligns with current understanding

#### Acceptance Criteria

1. THE System SHALL re-evaluate each sampled experience through the gate:
   - Pass stored observation data to gate
   - Get current expected_reward from gate
   - Compare gate decision with original decision

2. THE System SHALL track gate agreement:
   - `gate_agrees = (current_decision == original_decision)`
   - Log gate agreement rate per training step
   - Track lifetime gate agreement percentage

3. THE System SHALL adjust training reward based on validation:
   - When gate agrees: Use weighted combination of actual and validation rewards
   - When gate disagrees: Apply disagreement_penalty (default: 0.5)
   - Option to skip disagreed experiences entirely

4. THE Experience dataclass SHALL store raw observation data:
   - `protector_chunks`: List of protector chunk IDs
   - `worker_chunks`: List of worker chunk IDs
   - `hive_chunk`: Hive position
   - `queen_energy`: Energy at decision time
   - These enable gate re-validation

5. THE metrics SHALL track gate validation statistics:
   - `average_gate_agreement`: Rolling average (last 100 steps)
   - `lifetime_gate_agreement`: All-time agreement rate
   - `gate_disagreements`: Count of disagreed experiences

### Requirement 6: Configuration

**User Story:** As a developer, I need all parameters configurable so that I can tune the system.

#### Acceptance Criteria

1. THE System SHALL support ContinuousTrainingConfig:
   ```python
   @dataclass
   class ContinuousTrainingConfig:
       # Training loop
       training_interval: float = 1.0
       batch_size: int = 32
       min_batch_size: int = 8

       # Replay buffer
       buffer_capacity: int = 10000

       # Reward weighting
       simulation_reward_weight: float = 0.3
       actual_reward_weight: float = 0.7

       # Gate integration (inference)
       train_on_wait: bool = True
       wait_reward_multiplier: float = 0.5

       # Gate validation (training)
       gate_validation_enabled: bool = True
       gate_disagreement_penalty: float = 0.5
       skip_disagreed_experiences: bool = False

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

2. THE System SHALL track buffer metrics:
   - `buffer_size`: Current number of experiences
   - `pending_count`: Experiences waiting for rewards
   - `completed_count`: Experiences with rewards

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

2. THE message handler SHALL update pending rewards:
   - When observation arrives, check for pending experience
   - Calculate reward and update buffer
   - Then proceed with new inference

3. THE System SHALL support enable/disable:
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
