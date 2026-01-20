# Continuous Training Loop

## Research Document
**Created:** 2026-01-21
**Branch:** feature/continuous-training-loop
**Status:** Research & Design Phase

---

## 1. Overview

### The Problem
Currently, training and inference are tightly coupled:
- Observation arrives every 15 seconds
- Inference runs on that observation
- Training happens based on reward from previous observation
- NN only improves every 15 seconds

This creates several issues:
1. **Slow learning** - Model only updates every 15 seconds
2. **Single sample training** - Each training step uses just one sample (high variance)
3. **Blocking** - Training blocks the inference path
4. **Wasted cycles** - NN sits idle between observations

### The Solution
**Continuous Training Loop** - Decouple training from inference:
1. **Experience Replay Buffer** - Store experiences for batch sampling
2. **Background Training Thread** - Train every 1 second on batched samples
3. **Model Versioning** - Inference uses latest stable model version
4. **Gate Validation** - Gate validates both inference AND training
   - Inference: Gate evaluates each decision (existing behavior)
   - Training: Gate re-validates sampled experiences to ensure alignment

### Key Design Principles
1. Training and inference run in **separate threads**, never blocking each other.
2. **Gate is the validator** - ensures model doesn't drift from game dynamics.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INFERENCE THREAD (Main)                           │
│                                                                             │
│  Observation ──► Feature Extract ──► NN Inference ──► Simulation Gate      │
│      │                                (latest model)        │               │
│      │                                                      │               │
│      │                                            ┌─────────┴─────────┐     │
│      │                                            │                   │     │
│      ▼                                            ▼                   ▼     │
│  ┌────────────────────────────────────────┐   [SEND]              [WAIT]   │
│  │     EXPERIENCE REPLAY BUFFER           │      │                   │     │
│  │  ┌─────────────────────────────────┐   │      │                   │     │
│  │  │ (obs, action, gate_decision,    │◄──┼──────┴───────────────────┘     │
│  │  │  reward_pending, timestamp)     │   │                                │
│  │  └─────────────────────────────────┘   │                                │
│  │                                        │                                │
│  │  When next observation arrives:        │                                │
│  │  - Calculate reward for pending exp    │                                │
│  │  - Update experience with real reward  │                                │
│  └────────────────────────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Thread-safe queue
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRAINING THREAD (Background)                        │
│                                                                             │
│  Every 1 second:                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Sample batch (N experiences) from replay buffer                   │   │
│  │ 2. Filter: only experiences with rewards (not pending)               │   │
│  │ 3. GATE VALIDATES each experience:                                   │   │
│  │    ┌─────────────────────────────────────────────────────────────┐   │   │
│  │    │ For each exp in batch:                                      │   │   │
│  │    │   validation = gate.evaluate(exp.observation, exp.action)   │   │   │
│  │    │   if gate agrees with original decision:                    │   │   │
│  │    │     → Use weighted (actual + validation) reward             │   │   │
│  │    │   else (gate disagrees):                                    │   │   │
│  │    │     → Apply disagreement penalty OR skip experience         │   │   │
│  │    └─────────────────────────────────────────────────────────────┘   │   │
│  │ 4. Train model on validated batch                                    │   │
│  │ 5. Produce new model version                                         │   │
│  │ 6. Log gate agreement rate                                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Model Versioning:                                                          │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐                        │
│  │ Version N  │ ─► │ Version N+1│ ─► │ Version N+2│  ...                   │
│  │ (training) │    │ (training) │    │ (active)   │                        │
│  └────────────┘    └────────────┘    └────────────┘                        │
│                                            ▲                                │
│                                            │                                │
│                               Inference uses latest                         │
│                                                                             │
│  Gate Agreement Metric: Tracks how often gate still agrees with past        │
│  decisions - indicates model drift if agreement drops                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Components

### 3.1 Experience Replay Buffer

**Purpose:** Store experiences for batch sampling and delayed reward assignment.

```python
@dataclass
class Experience:
    """Single experience in replay buffer."""
    observation: np.ndarray      # 28 normalized features
    action: Tuple[int, str]      # (spawn_chunk, spawn_type)
    gate_decision: str           # 'SEND' or 'WAIT'
    expected_reward: float       # From simulation gate
    actual_reward: Optional[float]  # From real game (None if pending)
    timestamp: float             # When experience was created
    territory_id: str            # For multi-territory support

class ExperienceReplayBuffer:
    """Thread-safe experience replay buffer with priority sampling."""

    def __init__(self, capacity: int = 10000):
        self.capacity = capacity
        self.buffer: deque = deque(maxlen=capacity)
        self.pending: Dict[str, Experience] = {}  # territory_id -> pending exp
        self.lock = threading.Lock()

    def add(self, experience: Experience) -> None:
        """Add experience to buffer (thread-safe)."""

    def sample(self, batch_size: int) -> List[Experience]:
        """Sample batch of completed experiences (thread-safe)."""

    def update_pending_reward(self, territory_id: str, reward: float) -> None:
        """Update pending experience with actual reward."""
```

**Key Design Decisions:**
1. **Fixed capacity** - FIFO eviction when full (10,000 default)
2. **Pending experiences** - Track experiences waiting for reward
3. **Thread-safe** - Lock for concurrent access from both threads
4. **Completed only** - Sampling only returns experiences with rewards

### 3.2 Background Training Thread

**Purpose:** Continuously train model on batched experiences.

```python
class ContinuousTrainer:
    """Background training thread that produces new model versions."""

    def __init__(
        self,
        model: QueenNN,
        buffer: ExperienceReplayBuffer,
        config: TrainingConfig
    ):
        self.model = model
        self.buffer = buffer
        self.config = config
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.model_version = 0
        self.model_lock = threading.Lock()

    def start(self) -> None:
        """Start background training thread."""
        self.running = True
        self.thread = threading.Thread(target=self._training_loop, daemon=True)
        self.thread.start()

    def stop(self) -> None:
        """Stop background training thread."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5.0)

    def _training_loop(self) -> None:
        """Main training loop - runs every interval."""
        while self.running:
            start_time = time.time()

            # Sample batch from buffer
            batch = self.buffer.sample(self.config.batch_size)

            if len(batch) >= self.config.min_batch_size:
                # Train on batch
                loss = self._train_batch(batch)

                # Increment version
                with self.model_lock:
                    self.model_version += 1

                logger.info(f"[Training] Version {self.model_version}, "
                           f"loss={loss:.4f}, batch_size={len(batch)}")

            # Sleep for remaining interval
            elapsed = time.time() - start_time
            sleep_time = max(0, self.config.training_interval - elapsed)
            time.sleep(sleep_time)

    def get_model_for_inference(self) -> QueenNN:
        """Get latest model for inference (thread-safe)."""
        with self.model_lock:
            return self.model  # Return reference (PyTorch models are thread-safe for inference)
```

### 3.3 Model Versioning

**Approach:** PyTorch models are thread-safe for inference. Training and inference can use the same model object safely because:
1. Inference only reads weights (no gradients)
2. Training updates weights atomically
3. Python GIL provides additional safety

**Alternative (if needed):** Double-buffering with model copies:
- Train on copy A
- Inference uses copy B
- Swap atomically when training completes

### 3.4 Reward Handling

**Challenge:** Rewards are only known 15 seconds later when next observation arrives.

**Solution:**
1. When inference runs, create experience with `actual_reward=None`
2. Store as "pending" experience for that territory
3. When next observation arrives:
   - Calculate reward based on prev/current observation
   - Update pending experience with actual reward
   - Move to main buffer

```python
def on_observation(self, observation: Dict, territory_id: str) -> None:
    # 1. Update pending experience with reward
    if territory_id in self.buffer.pending:
        reward = self.reward_calculator.calculate(
            self.prev_observations[territory_id],
            observation,
            self.prev_decisions[territory_id]
        )
        self.buffer.update_pending_reward(territory_id, reward)

    # 2. Run inference with latest model
    model = self.trainer.get_model_for_inference()
    features = self.feature_extractor.extract(observation)
    action = model.infer(features)

    # 3. Evaluate through gate
    gate_decision = self.gate.evaluate(observation, action, confidence)

    # 4. Create new pending experience
    experience = Experience(
        observation=features,
        action=action,
        gate_decision=gate_decision.decision,
        expected_reward=gate_decision.expected_reward,
        actual_reward=None,  # Pending
        timestamp=time.time(),
        territory_id=territory_id
    )
    self.buffer.add_pending(experience)
```

---

## 4. Configuration

```python
@dataclass
class ContinuousTrainingConfig:
    # Training loop
    training_interval: float = 1.0      # Train every 1 second
    batch_size: int = 32                # Samples per training step
    min_batch_size: int = 8             # Minimum samples to train

    # Replay buffer
    buffer_capacity: int = 10000        # Max experiences stored
    priority_sampling: bool = False     # Use priority-based sampling

    # Reward weighting
    simulation_reward_weight: float = 0.3   # Weight for gate's expected reward
    actual_reward_weight: float = 0.7       # Weight for real game reward

    # Learning rate scheduling
    initial_lr: float = 0.001
    lr_decay: float = 0.99              # Decay per 100 training steps
    min_lr: float = 0.0001

    # Gate integration
    train_on_wait: bool = True          # Include WAIT experiences in training
    wait_reward_multiplier: float = 0.5 # Reduce reward for WAIT (penalize blocked actions)
```

---

## 5. Thread Safety Analysis

### Shared Resources
1. **NN Model** - Read by inference, written by training
2. **Replay Buffer** - Written by inference, read by training
3. **Configuration** - Read by both

### Synchronization Strategy
1. **Model**: PyTorch handles thread-safety for inference vs training
2. **Buffer**: Use `threading.Lock()` for all operations
3. **Config**: Immutable after initialization (no lock needed)

### Potential Issues & Mitigations
1. **Training too slow** - Skip training step if still processing previous
2. **Buffer contention** - Use lock-free queue for adding experiences
3. **Model divergence** - Monitor loss, reset if NaN

---

## 6. Metrics & Observability

```python
@dataclass
class TrainingMetrics:
    # Training loop
    training_steps: int = 0
    total_batches_trained: int = 0
    average_batch_size: float = 0.0
    average_loss: float = 0.0

    # Buffer stats
    buffer_size: int = 0
    pending_experiences: int = 0
    experiences_with_rewards: int = 0

    # Model versioning
    current_model_version: int = 0
    training_steps_per_second: float = 0.0

    # Timing
    average_training_time_ms: float = 0.0
    training_utilization: float = 0.0  # % of interval spent training
```

---

## 7. Integration Points

### 7.1 Message Handler Changes
- Add `ContinuousTrainer` instance
- Use `trainer.get_model_for_inference()` instead of direct model access
- Add/update experiences in replay buffer

### 7.2 Dashboard Integration
- New section for training metrics
- Real-time buffer size visualization
- Training loss graph over time
- Model version indicator

### 7.3 Gate Integration
- Gate evaluates all inference outputs (unchanged)
- WAIT experiences included in training with reduced weight
- Expected reward from gate stored in experience

---

## 8. Benefits

1. **Faster learning** - Model improves every second, not every 15 seconds
2. **Stable training** - Batch training reduces variance
3. **Experience replay** - Learn from past experiences multiple times
4. **Non-blocking** - Training doesn't delay inference responses
5. **Better GPU utilization** - Continuous training keeps GPU busy
6. **Curriculum learning** - Can prioritize certain experiences

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Training thread crashes | No model updates | Watchdog + auto-restart |
| Memory growth | OOM | Fixed-size buffer with FIFO eviction |
| Model divergence | Bad decisions | Loss monitoring + checkpoint rollback |
| Thread deadlock | System hang | Timeout on all lock acquisitions |
| Stale experiences | Poor learning | Timestamp-based expiration |

---

## 10. Open Questions

1. **Priority sampling** - Should we prioritize high-reward or rare experiences?
2. **Experience expiration** - Should old experiences be discarded?
3. **Multi-territory** - How to handle multiple Queens with different game states?
4. **Checkpoint frequency** - How often to save model checkpoints?

---

## 11. Implementation Phases

### Phase 1: Experience Replay Buffer
- Create Experience dataclass
- Implement thread-safe buffer
- Add pending experience handling
- Unit tests

### Phase 2: Background Training Thread
- Create ContinuousTrainer class
- Implement training loop
- Add model versioning
- Thread safety tests

### Phase 3: Integration
- Update message handler
- Wire up buffer and trainer
- Add metrics collection
- Integration tests

### Phase 4: Dashboard & Observability
- Add training metrics to dashboard
- Buffer visualization
- Loss graphs
- Model version indicator

---

## 12. References

- Current training: `server/ai_engine/nn_model.py`
- Reward calculator: `server/ai_engine/reward_calculator.py`
- Message handler: `server/websocket/message_handler.py`
- Simulation gate: `server/ai_engine/simulation/gate.py`
