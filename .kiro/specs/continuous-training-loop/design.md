# Continuous Training Loop - Design

## Overview

This document describes the technical design for decoupling NN training from inference. The system uses an experience replay buffer and background training thread to enable continuous model improvement.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MAIN THREAD                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     MESSAGE HANDLER                                  │   │
│  │                                                                      │   │
│  │  Observation ──► Update Pending Reward ──► Feature Extract          │   │
│  │                         │                        │                   │   │
│  │                         ▼                        ▼                   │   │
│  │              ┌──────────────────┐    ┌─────────────────────┐        │   │
│  │              │  Replay Buffer   │    │  NN Inference       │        │   │
│  │              │                  │    │  (latest model)     │        │   │
│  │              │  ┌────────────┐  │    └──────────┬──────────┘        │   │
│  │              │  │ Pending    │  │               │                   │   │
│  │              │  │ Exp        │  │               ▼                   │   │
│  │              │  └────────────┘  │    ┌─────────────────────┐        │   │
│  │              │  ┌────────────┐  │    │  Simulation Gate    │        │   │
│  │              │  │ Completed  │  │    └──────────┬──────────┘        │   │
│  │              │  │ Exps       │  │               │                   │   │
│  │              │  └────────────┘  │    ┌─────────┴─────────┐          │   │
│  │              └──────────────────┘    │                   │          │   │
│  │                       ▲              ▼                   ▼          │   │
│  │                       │          [SEND]              [WAIT]         │   │
│  │                       │              │                   │          │   │
│  │                       └──────────────┴───────────────────┘          │   │
│  │                              Add New Experience                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ Thread-safe buffer access
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRAINING THREAD (Daemon)                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     CONTINUOUS TRAINER                               │   │
│  │                                                                      │   │
│  │  while running:                                                      │   │
│  │      sleep(training_interval)                                        │   │
│  │      batch = buffer.sample(batch_size)                               │   │
│  │      if len(batch) >= min_batch_size:                                │   │
│  │          loss = model.train(batch)                                   │   │
│  │          model_version += 1                                          │   │
│  │          log_metrics(loss, batch_size, version)                      │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Model: ────────────────────────────────────────────────────────────────   │
│         │ v1 │ v2 │ v3 │ v4 │ v5 │ ... │ vN │◄── Latest (used by inference)│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Experience Dataclass

```python
from dataclasses import dataclass, field
from typing import Optional, Tuple
import numpy as np

@dataclass
class Experience:
    """
    Single experience for replay buffer.

    Stores all information needed to train the NN on this decision.
    """
    # State
    observation: np.ndarray          # [28] normalized features

    # Action
    spawn_chunk: int                 # 0-399
    spawn_type: str                  # 'energy' or 'combat'
    nn_confidence: float             # NN's confidence in decision

    # Gate evaluation
    gate_decision: str               # 'SEND' or 'WAIT'
    expected_reward: float           # From simulation cost function
    gate_components: dict            # Breakdown (survival, disruption, etc.)

    # Outcome (delayed)
    actual_reward: Optional[float] = None  # From real game, None if pending

    # Metadata
    timestamp: float = field(default_factory=time.time)
    territory_id: str = ""
    model_version: int = 0           # Which model version made this decision

    @property
    def is_completed(self) -> bool:
        """Check if experience has actual reward."""
        return self.actual_reward is not None

    @property
    def effective_reward(self) -> float:
        """
        Calculate effective reward for training.

        Combines simulation and actual rewards with configurable weights.
        """
        if self.actual_reward is None:
            # WAIT experience - use expected_reward only
            return self.expected_reward

        # SEND experience - weighted combination
        return (
            SIMULATION_WEIGHT * self.expected_reward +
            ACTUAL_WEIGHT * self.actual_reward
        )
```

### 2. Experience Replay Buffer

```python
import threading
from collections import deque
from typing import List, Dict, Optional
import random

class ExperienceReplayBuffer:
    """
    Thread-safe experience replay buffer.

    Supports:
    - Fixed capacity with FIFO eviction
    - Pending experience tracking (waiting for rewards)
    - Random batch sampling
    - Thread-safe operations
    """

    def __init__(self, capacity: int = 10000, lock_timeout: float = 5.0):
        self.capacity = capacity
        self.lock_timeout = lock_timeout

        # Main storage
        self._buffer: deque = deque(maxlen=capacity)
        self._lock = threading.Lock()

        # Pending experiences (one per territory)
        self._pending: Dict[str, Experience] = {}

        # Statistics
        self._total_added = 0
        self._total_sampled = 0

    def add(self, experience: Experience) -> None:
        """
        Add experience to buffer.

        If experience has no actual_reward, it's stored as pending.
        Called from inference thread.
        """
        acquired = self._lock.acquire(timeout=self.lock_timeout)
        if not acquired:
            logger.warning("Failed to acquire buffer lock for add()")
            return

        try:
            if experience.is_completed:
                # Completed experience - add to main buffer
                self._buffer.append(experience)
                self._total_added += 1
            else:
                # Pending experience - track by territory
                self._pending[experience.territory_id] = experience
        finally:
            self._lock.release()

    def update_pending_reward(
        self,
        territory_id: str,
        actual_reward: float
    ) -> Optional[Experience]:
        """
        Update pending experience with actual reward.

        Moves experience from pending to main buffer.
        Returns the completed experience, or None if not found.
        """
        acquired = self._lock.acquire(timeout=self.lock_timeout)
        if not acquired:
            logger.warning("Failed to acquire buffer lock for update_pending_reward()")
            return None

        try:
            if territory_id not in self._pending:
                return None

            experience = self._pending.pop(territory_id)
            experience.actual_reward = actual_reward
            self._buffer.append(experience)
            self._total_added += 1
            return experience
        finally:
            self._lock.release()

    def sample(self, batch_size: int) -> List[Experience]:
        """
        Sample random batch of completed experiences.

        Only returns experiences with actual_reward.
        Called from training thread.
        """
        acquired = self._lock.acquire(timeout=self.lock_timeout)
        if not acquired:
            logger.warning("Failed to acquire buffer lock for sample()")
            return []

        try:
            # Filter to completed experiences
            completed = [e for e in self._buffer if e.is_completed]

            if len(completed) == 0:
                return []

            # Random sample (with replacement if needed)
            sample_size = min(batch_size, len(completed))
            batch = random.sample(completed, sample_size)
            self._total_sampled += len(batch)
            return batch
        finally:
            self._lock.release()

    def get_stats(self) -> dict:
        """Get buffer statistics (thread-safe)."""
        acquired = self._lock.acquire(timeout=self.lock_timeout)
        if not acquired:
            return {}

        try:
            completed = sum(1 for e in self._buffer if e.is_completed)
            return {
                'buffer_size': len(self._buffer),
                'pending_count': len(self._pending),
                'completed_count': completed,
                'total_added': self._total_added,
                'total_sampled': self._total_sampled,
                'capacity': self.capacity,
                'utilization': len(self._buffer) / self.capacity
            }
        finally:
            self._lock.release()

    def clear(self) -> None:
        """Clear all experiences (thread-safe)."""
        with self._lock:
            self._buffer.clear()
            self._pending.clear()
```

### 3. Continuous Trainer

```python
import threading
import time
from typing import Optional
import torch

class ContinuousTrainer:
    """
    Background training thread for continuous model improvement.

    Runs in a daemon thread, training the model every interval
    on batches sampled from the replay buffer.
    """

    def __init__(
        self,
        model: 'QueenNN',
        buffer: ExperienceReplayBuffer,
        config: 'ContinuousTrainingConfig'
    ):
        self.model = model
        self.buffer = buffer
        self.config = config

        # Threading
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._model_lock = threading.Lock()

        # Versioning
        self._model_version = 0

        # Metrics
        self._metrics = TrainingMetrics()

    def start(self) -> None:
        """Start background training thread."""
        if self._running:
            logger.warning("Trainer already running")
            return

        self._running = True
        self._thread = threading.Thread(
            target=self._training_loop,
            name="ContinuousTrainer",
            daemon=True  # Dies with main process
        )
        self._thread.start()
        logger.info(f"[Training] Started background trainer (interval={self.config.training_interval}s)")

    def stop(self, timeout: float = 5.0) -> None:
        """Stop background training thread."""
        if not self._running:
            return

        self._running = False
        if self._thread:
            self._thread.join(timeout=timeout)
            if self._thread.is_alive():
                logger.warning("[Training] Thread did not stop gracefully")
        logger.info("[Training] Stopped background trainer")

    def _training_loop(self) -> None:
        """Main training loop - runs until stopped."""
        logger.info("[Training] Training loop started")

        while self._running:
            loop_start = time.time()

            try:
                self._training_step()
            except Exception as e:
                logger.error(f"[Training] Error in training step: {e}")
                # Continue running - don't crash on single error

            # Sleep for remaining interval
            elapsed = time.time() - loop_start
            sleep_time = max(0, self.config.training_interval - elapsed)

            if sleep_time == 0:
                logger.warning(f"[Training] Step took {elapsed:.2f}s, exceeds interval")

            time.sleep(sleep_time)

        logger.info("[Training] Training loop stopped")

    def _training_step(self) -> None:
        """Execute single training step."""
        step_start = time.time()

        # Sample batch from buffer
        batch = self.buffer.sample(self.config.batch_size)

        if len(batch) < self.config.min_batch_size:
            logger.debug(f"[Training] Insufficient samples: {len(batch)} < {self.config.min_batch_size}")
            return

        # Prepare training data
        observations = torch.stack([
            torch.tensor(e.observation, dtype=torch.float32)
            for e in batch
        ])

        actions = torch.tensor([
            [e.spawn_chunk, 0 if e.spawn_type == 'energy' else 1]
            for e in batch
        ], dtype=torch.long)

        rewards = torch.tensor([
            self._calculate_training_reward(e)
            for e in batch
        ], dtype=torch.float32)

        # Train model
        with self._model_lock:
            loss = self.model.train_batch(observations, actions, rewards)
            self._model_version += 1

        # Update metrics
        step_time = (time.time() - step_start) * 1000  # ms
        self._metrics.record_step(
            loss=loss,
            batch_size=len(batch),
            step_time_ms=step_time
        )

        logger.info(
            f"[Training] v{self._model_version}: loss={loss:.4f}, "
            f"batch={len(batch)}, time={step_time:.1f}ms"
        )

    def _calculate_training_reward(self, experience: Experience) -> float:
        """
        Calculate reward for training.

        Combines simulation and actual rewards with configurable weights.
        Applies multiplier for WAIT experiences.
        """
        if experience.gate_decision == 'WAIT':
            # WAIT - use expected_reward with penalty
            return experience.expected_reward * self.config.wait_reward_multiplier

        if experience.actual_reward is None:
            # SEND but no actual reward yet (shouldn't happen in training)
            return experience.expected_reward

        # SEND with actual reward - weighted combination
        return (
            self.config.simulation_reward_weight * experience.expected_reward +
            self.config.actual_reward_weight * experience.actual_reward
        )

    def get_model_for_inference(self) -> 'QueenNN':
        """
        Get model for inference.

        Thread-safe - can be called while training is running.
        PyTorch models are safe for concurrent inference.
        """
        return self.model  # No lock needed for read-only inference

    @property
    def model_version(self) -> int:
        """Current model version."""
        return self._model_version

    def get_metrics(self) -> dict:
        """Get training metrics."""
        buffer_stats = self.buffer.get_stats()
        training_stats = self._metrics.get_stats()
        return {
            'buffer': buffer_stats,
            'training': training_stats,
            'model_version': self._model_version,
            'is_running': self._running
        }
```

### 4. Training Metrics

```python
from dataclasses import dataclass, field
from collections import deque
import time

@dataclass
class TrainingMetrics:
    """Metrics for continuous training."""

    # Rolling windows
    window_size: int = 100
    loss_history: deque = field(default_factory=lambda: deque(maxlen=100))
    batch_size_history: deque = field(default_factory=lambda: deque(maxlen=100))
    step_time_history: deque = field(default_factory=lambda: deque(maxlen=100))

    # Lifetime counters
    total_steps: int = 0
    total_samples_trained: int = 0
    start_time: float = field(default_factory=time.time)

    def record_step(
        self,
        loss: float,
        batch_size: int,
        step_time_ms: float
    ) -> None:
        """Record metrics for a training step."""
        self.loss_history.append(loss)
        self.batch_size_history.append(batch_size)
        self.step_time_history.append(step_time_ms)
        self.total_steps += 1
        self.total_samples_trained += batch_size

    def get_stats(self) -> dict:
        """Get current statistics."""
        uptime = time.time() - self.start_time

        return {
            'total_steps': self.total_steps,
            'total_samples_trained': self.total_samples_trained,
            'steps_per_second': self.total_steps / uptime if uptime > 0 else 0,
            'average_loss': sum(self.loss_history) / len(self.loss_history) if self.loss_history else 0,
            'average_batch_size': sum(self.batch_size_history) / len(self.batch_size_history) if self.batch_size_history else 0,
            'average_step_time_ms': sum(self.step_time_history) / len(self.step_time_history) if self.step_time_history else 0,
            'uptime_seconds': uptime
        }
```

### 5. Configuration

```python
from dataclasses import dataclass

@dataclass
class ContinuousTrainingConfig:
    """Configuration for continuous training loop."""

    # Training loop
    training_interval: float = 1.0      # Seconds between training steps
    batch_size: int = 32                # Target batch size
    min_batch_size: int = 8             # Minimum samples to train

    # Replay buffer
    buffer_capacity: int = 10000        # Max experiences stored
    lock_timeout: float = 5.0           # Seconds to wait for lock

    # Reward weighting
    simulation_reward_weight: float = 0.3   # Weight for expected_reward
    actual_reward_weight: float = 0.7       # Weight for actual_reward
    wait_reward_multiplier: float = 0.5     # Penalty for WAIT experiences

    # Feature flags
    enabled: bool = True                # Master switch
    train_on_wait: bool = True          # Include WAIT experiences

    def validate(self) -> bool:
        """Validate configuration values."""
        errors = []

        if self.training_interval <= 0:
            errors.append("training_interval must be positive")
        if self.batch_size <= 0:
            errors.append("batch_size must be positive")
        if self.min_batch_size <= 0:
            errors.append("min_batch_size must be positive")
        if self.min_batch_size > self.batch_size:
            errors.append("min_batch_size must be <= batch_size")
        if self.buffer_capacity <= 0:
            errors.append("buffer_capacity must be positive")

        weight_sum = self.simulation_reward_weight + self.actual_reward_weight
        if abs(weight_sum - 1.0) > 0.01:
            errors.append(f"Reward weights should sum to 1.0, got {weight_sum}")

        if errors:
            for error in errors:
                logger.error(f"Config validation error: {error}")
            return False

        return True
```

## Integration with Message Handler

```python
class MessageHandler:
    def __init__(self, ...):
        # ... existing init ...

        # Continuous training components
        self.replay_buffer = ExperienceReplayBuffer(
            capacity=self.training_config.buffer_capacity
        )
        self.trainer = ContinuousTrainer(
            model=self.nn_model,
            buffer=self.replay_buffer,
            config=self.training_config
        )

        # Start training thread
        if self.training_config.enabled:
            self.trainer.start()

    async def _handle_chunk_observation_data(self, message, client_id):
        observation = message.get("data")
        territory_id = observation.get("territoryId", "unknown")

        # 1. Update pending experience with actual reward
        if territory_id in self.prev_observations:
            prev_obs = self.prev_observations[territory_id]
            prev_decision = self.prev_decisions.get(territory_id)

            if prev_decision:
                reward_info = self.reward_calculator.calculate_reward(
                    prev_obs, observation, prev_decision
                )
                self.replay_buffer.update_pending_reward(
                    territory_id,
                    reward_info['reward']
                )

        # 2. Extract features
        features = self.feature_extractor.extract(observation)

        # 3. Run inference with latest model
        model = self.trainer.get_model_for_inference()
        spawn_decision = model.spawn_inference(features)

        # 4. Evaluate through simulation gate
        gate_decision = self.simulation_gate.evaluate(...)

        # 5. Create new experience (pending)
        experience = Experience(
            observation=features,
            spawn_chunk=spawn_decision['spawn_chunk'],
            spawn_type=spawn_decision['spawn_type'],
            nn_confidence=spawn_decision['confidence'],
            gate_decision=gate_decision.decision,
            expected_reward=gate_decision.expected_reward,
            gate_components=gate_decision.components,
            actual_reward=None,  # Pending
            territory_id=territory_id,
            model_version=self.trainer.model_version
        )
        self.replay_buffer.add(experience)

        # 6. Store for next reward calculation
        self.prev_observations[territory_id] = observation
        self.prev_decisions[territory_id] = spawn_decision

        # 7. Return response (unchanged logic)
        ...
```

## Thread Safety Analysis

### Shared Resources

| Resource | Writers | Readers | Synchronization |
|----------|---------|---------|-----------------|
| NN Model | Training thread | Inference thread | PyTorch internal |
| Replay Buffer | Both threads | Both threads | `threading.Lock` |
| Model Version | Training thread | Both threads | `threading.Lock` |
| Metrics | Training thread | API/Dashboard | Atomic operations |

### Lock Ordering

To prevent deadlocks, locks are always acquired in this order:
1. Buffer lock
2. Model lock (if needed)

### Timeout Strategy

All lock acquisitions use timeouts:
- Default: 5 seconds
- On timeout: Log warning, return gracefully
- Never block indefinitely

## Performance Considerations

### Memory Usage

```
Experience size ≈ 500 bytes
- observation: 28 × 4 = 112 bytes
- action: 16 bytes
- gate data: 200 bytes
- metadata: 172 bytes

Buffer (10,000 experiences) ≈ 5 MB
```

### CPU Usage

- Training thread: ~10% of one core during training step
- Lock contention: Minimal (< 1ms hold time)

### Latency Impact

- Inference latency increase: < 1ms (lock acquisition)
- Training does not block inference

## Dashboard Integration

Add new section to NN Dashboard:

```javascript
// Training Status
{
  "training": {
    "is_running": true,
    "model_version": 1234,
    "steps_per_second": 0.98,
    "average_loss": 0.0234,
    "average_batch_size": 28.5
  },
  "buffer": {
    "size": 8500,
    "capacity": 10000,
    "utilization": 0.85,
    "pending_count": 3,
    "completed_count": 8497
  }
}
```

## Error Handling

### Training Thread Errors

```python
def _training_loop(self):
    while self._running:
        try:
            self._training_step()
        except Exception as e:
            logger.error(f"Training error: {e}")
            self._metrics.record_error()
            # Continue running - don't crash on single error

        time.sleep(self.config.training_interval)
```

### Buffer Errors

- Lock timeout: Log and skip operation
- Memory error: Clear oldest experiences
- Validation error: Reject invalid experience

## Testing Strategy

### Unit Tests

1. Experience dataclass
2. Buffer thread-safety (concurrent add/sample)
3. Trainer start/stop
4. Reward calculation

### Integration Tests

1. Full pipeline with mock observations
2. Pending reward updates
3. Model version increments
4. Metrics accumulation

### Stress Tests

1. High-frequency observations
2. Large batch sizes
3. Long-running sessions
4. Memory leak detection
