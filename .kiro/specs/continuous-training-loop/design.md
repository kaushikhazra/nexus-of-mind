# Continuous Training Loop - Design

## Overview

This document describes the technical design for decoupling NN training from inference. The system uses an experience replay buffer and background training thread to enable continuous model improvement.

**Core Principle: Gate IS the Cost Function**

The simulation gate returns `gate_signal = R_expected - 0.6` (numeric value). This signal serves as direct training feedback:
- Positive signal → Good action, NN should do more of this
- Negative signal → Bad action, NN should avoid this
- The signal at inference time is ground truth (no re-evaluation)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INFERENCE THREAD (Main)                           │
│                                                                             │
│  Observation ──► Feature Extract ──► NN Inference ──► Gate                 │
│      │                                (latest model)    │                   │
│      │                                                  │                   │
│      │                                                  ▼                   │
│      │                                    ┌─────────────────────────┐       │
│      │                                    │  gate_signal =          │       │
│      │                                    │  R_expected - 0.6       │       │
│      │                                    └────────────┬────────────┘       │
│      │                                                 │                    │
│      │                                    ┌────────────┴────────────┐       │
│      │                                    │                         │       │
│      │                                    ▼                         ▼       │
│      │                            gate_signal > 0           gate_signal ≤ 0 │
│      │                                [SEND]                    [WAIT]      │
│      │                           was_executed=True         was_executed=False│
│      │                                    │                         │       │
│      ▼                                    │                         │       │
│  ┌────────────────────────────────────────┴─────────────────────────┘       │
│  │     EXPERIENCE REPLAY BUFFER                                      │       │
│  │  ┌──────────────────────────────────────────────────────────┐     │       │
│  │  │ Experience:                                               │     │       │
│  │  │   - observation (28 features)                            │     │       │
│  │  │   - action (chunk, type)                                 │     │       │
│  │  │   - gate_signal (R_expected - 0.6) ← TRAINING SIGNAL     │     │       │
│  │  │   - was_executed (True/False)                            │     │       │
│  │  │   - actual_reward (from game, None for WAIT)             │     │       │
│  │  └──────────────────────────────────────────────────────────┘     │       │
│  │                                                                    │       │
│  │  Note: ALL experiences go to buffer (SEND and WAIT)               │       │
│  │  The gate_signal IS the training feedback                         │       │
│  └────────────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Thread-safe buffer access
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRAINING THREAD (Background)                        │
│                                                                             │
│  Every 1 second:                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Sample batch (N experiences) from replay buffer                   │   │
│  │                                                                      │   │
│  │ 2. For each experience, calculate training reward:                   │   │
│  │    ┌─────────────────────────────────────────────────────────────┐   │   │
│  │    │                                                             │   │   │
│  │    │  If was_executed (SEND):                                    │   │   │
│  │    │    if actual_reward is not None:                            │   │   │
│  │    │      training_reward = α×gate_signal + β×actual_reward      │   │   │
│  │    │    else:                                                    │   │   │
│  │    │      training_reward = gate_signal  (pending)               │   │   │
│  │    │                                                             │   │   │
│  │    │  If not was_executed (WAIT):                                │   │   │
│  │    │    training_reward = gate_signal  (negative = penalty)      │   │   │
│  │    │                                                             │   │   │
│  │    └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │ 3. Train model: minimize loss(predicted_action, training_reward)     │   │
│  │                                                                      │   │
│  │ 4. Produce new model version                                         │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Model Versioning:                                                          │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐                        │
│  │ Version N  │ ─► │ Version N+1│ ─► │ Version N+2│  ...                   │
│  └────────────┘    └────────────┘    └────────────┘                        │
│                                            ▲                                │
│                                            │                                │
│                               Inference uses latest                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Experience Dataclass

```python
from dataclasses import dataclass, field
from typing import Optional
import numpy as np
import time

@dataclass
class Experience:
    """
    Single experience for replay buffer.

    The gate_signal IS the training feedback - no re-evaluation needed.
    """
    # State - normalized features for NN
    observation: np.ndarray          # [28] normalized features

    # Action
    spawn_chunk: int                 # 0-399
    spawn_type: str                  # 'energy' or 'combat'
    nn_confidence: float             # NN's confidence in decision

    # Gate evaluation (THE training signal)
    gate_signal: float               # R_expected - 0.6 (can be negative!)
    R_expected: float                # Raw expected reward (for logging)

    # Execution status
    was_executed: bool               # True if SEND, False if WAIT

    # Outcome (only for SEND actions)
    actual_reward: Optional[float] = None  # From game, None for WAIT

    # Metadata
    timestamp: float = field(default_factory=time.time)
    territory_id: str = ""
    model_version: int = 0           # Which model version made this decision

    @property
    def is_send(self) -> bool:
        """Check if this was a SEND action."""
        return self.was_executed

    @property
    def is_wait(self) -> bool:
        """Check if this was a WAIT action."""
        return not self.was_executed

    @property
    def has_actual_reward(self) -> bool:
        """Check if actual reward is available (only for SEND actions)."""
        return self.actual_reward is not None
```

### 2. Experience Replay Buffer

```python
import threading
from collections import deque
from typing import List, Dict, Optional
import random
import logging

logger = logging.getLogger(__name__)

class ExperienceReplayBuffer:
    """
    Thread-safe experience replay buffer.

    Supports:
    - Fixed capacity with FIFO eviction
    - Pending reward tracking (for SEND actions only)
    - Random batch sampling of all experiences
    - Thread-safe operations
    """

    def __init__(self, capacity: int = 10000, lock_timeout: float = 5.0):
        self.capacity = capacity
        self.lock_timeout = lock_timeout

        # Main storage - ALL experiences (SEND and WAIT)
        self._buffer: deque = deque(maxlen=capacity)
        self._lock = threading.Lock()

        # Pending SEND experiences (waiting for actual_reward)
        self._pending: Dict[str, Experience] = {}

        # Statistics
        self._total_added = 0
        self._send_count = 0
        self._wait_count = 0

    def add(self, experience: Experience) -> None:
        """
        Add experience to buffer.

        SEND actions with no actual_reward are stored as pending.
        WAIT actions go directly to main buffer.
        Called from inference thread.
        """
        acquired = self._lock.acquire(timeout=self.lock_timeout)
        if not acquired:
            logger.warning("Failed to acquire buffer lock for add()")
            return

        try:
            if experience.is_send:
                self._send_count += 1
                if experience.has_actual_reward:
                    # SEND with reward - add to main buffer
                    self._buffer.append(experience)
                    self._total_added += 1
                else:
                    # SEND pending reward - track by territory
                    self._pending[experience.territory_id] = experience
            else:
                # WAIT - add directly to buffer (no reward expected)
                self._wait_count += 1
                self._buffer.append(experience)
                self._total_added += 1
        finally:
            self._lock.release()

    def update_pending_reward(
        self,
        territory_id: str,
        actual_reward: float
    ) -> Optional[Experience]:
        """
        Update pending SEND experience with actual reward.

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
        Sample random batch of experiences.

        Includes both SEND and WAIT experiences.
        Called from training thread.
        """
        acquired = self._lock.acquire(timeout=self.lock_timeout)
        if not acquired:
            logger.warning("Failed to acquire buffer lock for sample()")
            return []

        try:
            if len(self._buffer) == 0:
                return []

            # Random sample (with replacement if needed)
            sample_size = min(batch_size, len(self._buffer))
            return random.sample(list(self._buffer), sample_size)
        finally:
            self._lock.release()

    def get_stats(self) -> dict:
        """Get buffer statistics (thread-safe)."""
        acquired = self._lock.acquire(timeout=self.lock_timeout)
        if not acquired:
            return {}

        try:
            send_in_buffer = sum(1 for e in self._buffer if e.is_send)
            wait_in_buffer = sum(1 for e in self._buffer if e.is_wait)
            pending_with_reward = sum(1 for e in self._buffer if e.is_send and e.has_actual_reward)

            return {
                'buffer_size': len(self._buffer),
                'pending_count': len(self._pending),
                'send_count': send_in_buffer,
                'wait_count': wait_in_buffer,
                'send_with_reward': pending_with_reward,
                'total_added': self._total_added,
                'total_sends': self._send_count,
                'total_waits': self._wait_count,
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
import logging

logger = logging.getLogger(__name__)

class ContinuousTrainer:
    """
    Background training thread for continuous model improvement.

    Runs in a daemon thread, training the model every interval
    on batches sampled from the replay buffer.

    Uses gate_signal directly as training feedback.
    NO re-evaluation during training - gate_signal at inference is ground truth.
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

        # Calculate training rewards
        training_rewards = [
            self._calculate_training_reward(exp) for exp in batch
        ]

        # Calculate average gate_signal for metrics
        avg_gate_signal = sum(exp.gate_signal for exp in batch) / len(batch)

        # Prepare training tensors
        observations = torch.stack([
            torch.tensor(exp.observation, dtype=torch.float32)
            for exp in batch
        ])

        actions = torch.tensor([
            [exp.spawn_chunk, 0 if exp.spawn_type == 'energy' else 1]
            for exp in batch
        ], dtype=torch.long)

        rewards = torch.tensor(training_rewards, dtype=torch.float32)

        # Train model
        with self._model_lock:
            loss = self.model.train_batch(observations, actions, rewards)
            self._model_version += 1

        # Update metrics
        step_time = (time.time() - step_start) * 1000  # ms
        self._metrics.record_step(
            loss=loss,
            batch_size=len(batch),
            step_time_ms=step_time,
            avg_gate_signal=avg_gate_signal
        )

        logger.info(
            f"[Training] v{self._model_version}: loss={loss:.4f}, "
            f"batch={len(batch)}, avg_signal={avg_gate_signal:.3f}, "
            f"time={step_time:.1f}ms"
        )

    def _calculate_training_reward(self, experience: Experience) -> float:
        """
        Calculate training reward from experience.

        Gate signal IS the training feedback:
        - SEND: combine gate_signal with actual_reward (if available)
        - WAIT: use gate_signal directly (negative = penalty)
        """
        if experience.was_executed:
            # SEND action
            if experience.actual_reward is not None:
                # Have actual reward - weighted combination
                return (
                    self.config.gate_weight * experience.gate_signal +
                    self.config.actual_weight * experience.actual_reward
                )
            else:
                # Pending - use gate signal only
                return experience.gate_signal
        else:
            # WAIT action - gate signal IS the penalty
            # It's negative (otherwise wouldn't have waited)
            return experience.gate_signal

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
    gate_signal_history: deque = field(default_factory=lambda: deque(maxlen=100))

    # Lifetime counters
    total_steps: int = 0
    total_samples_trained: int = 0
    start_time: float = field(default_factory=time.time)

    def record_step(
        self,
        loss: float,
        batch_size: int,
        step_time_ms: float,
        avg_gate_signal: float = 0.0
    ) -> None:
        """Record metrics for a training step."""
        self.loss_history.append(loss)
        self.batch_size_history.append(batch_size)
        self.step_time_history.append(step_time_ms)
        self.gate_signal_history.append(avg_gate_signal)
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
            'average_gate_signal': sum(self.gate_signal_history) / len(self.gate_signal_history) if self.gate_signal_history else 0,
            'uptime_seconds': uptime
        }
```

### 5. Configuration

```python
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

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

    # Reward weighting (for SEND actions with actual_reward)
    gate_weight: float = 0.3            # Weight for gate_signal
    actual_weight: float = 0.7          # Weight for actual_reward

    # Learning rate
    learning_rate: float = 0.001

    # Gate threshold (must match gate config)
    reward_threshold: float = 0.6

    # Feature flags
    enabled: bool = True                # Master switch

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

        weight_sum = self.gate_weight + self.actual_weight
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

        # 1. Update pending SEND experience with actual reward
        if territory_id in self.prev_observations:
            prev_obs = self.prev_observations[territory_id]
            prev_decision = self.prev_decisions.get(territory_id)

            if prev_decision and prev_decision.get('was_executed'):
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
        gate_result = self.simulation_gate.evaluate(
            observation=observation,
            spawn_chunk=spawn_decision['spawn_chunk'],
            spawn_type=spawn_decision['spawn_type'],
            nn_confidence=spawn_decision['confidence']
        )

        # 5. Determine execution based on gate_signal
        was_executed = gate_result.gate_signal > 0

        # 6. Create experience
        experience = Experience(
            observation=features,
            spawn_chunk=spawn_decision['spawn_chunk'],
            spawn_type=spawn_decision['spawn_type'],
            nn_confidence=spawn_decision['confidence'],
            gate_signal=gate_result.gate_signal,
            R_expected=gate_result.R_expected,
            was_executed=was_executed,
            actual_reward=None,  # Pending for SEND, always None for WAIT
            territory_id=territory_id,
            model_version=self.trainer.model_version
        )
        self.replay_buffer.add(experience)

        # 7. Store for next reward calculation
        self.prev_observations[territory_id] = observation
        self.prev_decisions[territory_id] = {
            **spawn_decision,
            'was_executed': was_executed
        }

        # 8. Return response based on gate decision
        if was_executed:
            # SEND - return spawn command
            return self._create_spawn_response(spawn_decision)
        else:
            # WAIT - return no action
            return self._create_wait_response()
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
Experience size ≈ 300 bytes
- observation: 28 × 4 = 112 bytes
- action: 16 bytes
- gate data: 32 bytes (gate_signal, R_expected, was_executed)
- metadata: ~140 bytes

Buffer (10,000 experiences) ≈ 3 MB
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
    "average_batch_size": 28.5,
    "average_gate_signal": 0.12
  },
  "buffer": {
    "size": 8500,
    "capacity": 10000,
    "utilization": 0.85,
    "pending_count": 3,
    "send_count": 5200,
    "wait_count": 3300
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
4. Training reward calculation (SEND vs WAIT)

### Integration Tests

1. Full pipeline with mock observations
2. Pending reward updates (SEND only)
3. Model version increments
4. Metrics accumulation

### Stress Tests

1. High-frequency observations
2. Large batch sizes
3. Long-running sessions
4. Memory leak detection
