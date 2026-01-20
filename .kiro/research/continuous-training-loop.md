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
4. **Gate AS Cost Function** - Gate provides the training signal directly

### Key Design Principle: Gate IS the Cost Function

The simulation gate is not just a validator - **it IS the cost function for training**.

```
Gate Output = R_expected - threshold

where:
  R_expected = w₁×P_survival + w₂×D_disruption + w₃×L_location + exploration_bonus
  threshold = 0.6

Result:
  > 0  →  Good action (SEND at inference time)
  ≤ 0  →  Bad action (WAIT at inference time)
```

The NN learns to maximize this signal. When the gate output is negative, that IS the feedback telling the NN "this was a bad decision."

---

## 2. Architecture

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
│      │                                    │                         │       │
│      ▼                                    │                         │       │
│  ┌────────────────────────────────────────┴─────────────────────────┘       │
│  │     EXPERIENCE REPLAY BUFFER                                      │       │
│  │  ┌──────────────────────────────────────────────────────────┐     │       │
│  │  │ Experience:                                               │     │       │
│  │  │   - observation (28 features)                            │     │       │
│  │  │   - action (chunk, type)                                 │     │       │
│  │  │   - gate_signal (R_expected - 0.6) ← TRAINING SIGNAL     │     │       │
│  │  │   - actual_reward (from game, pending initially)         │     │       │
│  │  │   - timestamp, territory_id                              │     │       │
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
│  │    │  training_reward = combine(gate_signal, actual_reward)      │   │   │
│  │    │                                                             │   │   │
│  │    │  where:                                                     │   │   │
│  │    │    gate_signal = R_expected - 0.6  (already computed)       │   │   │
│  │    │    actual_reward = from game (if action was SEND)           │   │   │
│  │    │                                                             │   │   │
│  │    │  If SEND (gate_signal > 0):                                 │   │   │
│  │    │    training_reward = α×gate_signal + β×actual_reward        │   │   │
│  │    │                                                             │   │   │
│  │    │  If WAIT (gate_signal ≤ 0):                                 │   │   │
│  │    │    training_reward = gate_signal  (direct feedback)         │   │   │
│  │    │    ← This IS the penalty. NN learns "don't do this"         │   │   │
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

---

## 3. Gate as Cost Function

### 3.1 The Core Insight

The simulation gate computes expected reward based on game dynamics. This computation:

```
R_expected = V_capacity × (w₁×P_survival + w₂×D_disruption + w₃×L_location) + exploration_bonus
```

This value represents "how good is this action according to game dynamics."

The **gate signal** is:
```
gate_signal = R_expected - threshold
           = R_expected - 0.6
```

This signal tells the NN:
- **Positive**: Action is good, do more of this
- **Negative**: Action is bad, don't do this
- **Magnitude**: How good or bad

### 3.2 Why This Works

The NN's goal is to learn:
> "Given observation O, what action A maximizes expected reward?"

The gate signal directly answers this:
- If NN proposes action A and gate_signal is +0.3, that's positive feedback
- If NN proposes action A and gate_signal is -0.4, that's negative feedback

The NN learns to propose actions that result in positive gate signals.

### 3.3 Gate Output Interface

The gate should always return the numeric signal:

```python
class SimulationGate:
    def evaluate(self, observation, spawn_chunk, spawn_type, nn_confidence) -> GateResult:
        # Calculate expected reward
        R_expected = self.cost_function.calculate(observation, spawn_chunk, spawn_type)

        # Gate signal = expected reward minus threshold
        gate_signal = R_expected - self.config.reward_threshold  # threshold = 0.6

        return GateResult(
            gate_signal=gate_signal,      # The training signal (numeric)
            R_expected=R_expected,        # Raw expected reward
            components={...}              # Breakdown for debugging
        )
```

At **inference time**, we check:
```python
if gate_result.gate_signal > 0:
    # SEND - execute the action
else:
    # WAIT - block the action
```

At **training time**, we use `gate_signal` directly as feedback.

---

## 4. Experience Structure

```python
@dataclass
class Experience:
    """Single experience in replay buffer."""

    # State (for NN input)
    observation: np.ndarray           # 28 normalized features

    # Action (NN output)
    spawn_chunk: int                  # 0-399
    spawn_type: str                   # 'energy' or 'combat'
    nn_confidence: float              # NN's confidence

    # Gate evaluation (THE training signal)
    gate_signal: float                # R_expected - 0.6 (can be negative!)
    R_expected: float                 # Raw expected reward (for logging)
    gate_components: dict             # Breakdown (survival, disruption, etc.)

    # Game outcome (only for SEND actions)
    actual_reward: Optional[float]    # From reward_calculator, None for WAIT
    was_executed: bool                # True if SEND, False if WAIT

    # Metadata
    timestamp: float
    territory_id: str
    model_version: int
```

**Key Points:**
- `gate_signal` is the primary training signal
- `actual_reward` only exists for SEND actions (where action was executed)
- WAIT actions still provide training signal via `gate_signal`

---

## 5. Training Reward Calculation

```python
def calculate_training_reward(experience: Experience, config: TrainingConfig) -> float:
    """
    Calculate reward for training the NN.

    Gate signal IS the feedback. If gate said "bad action" (negative signal),
    that's the penalty. NN learns from it.
    """

    if experience.was_executed:
        # SEND action - combine gate signal with actual game outcome
        # gate_signal is positive (otherwise wouldn't have been sent)
        # actual_reward tells us what really happened
        return (
            config.gate_weight * experience.gate_signal +
            config.actual_weight * experience.actual_reward
        )
    else:
        # WAIT action - gate signal IS the feedback
        # It's negative (that's why we waited)
        # This teaches NN: "this action would have been bad"
        return experience.gate_signal
```

### 5.1 Example Scenarios

**Scenario 1: Good action, good outcome**
```
gate_signal = +0.25 (R_expected=0.85, threshold=0.6)
was_executed = True (SEND)
actual_reward = +0.8 (parasite survived, disrupted workers)

training_reward = 0.3×(+0.25) + 0.7×(+0.8) = +0.635
→ Strong positive reinforcement
```

**Scenario 2: Good action, bad outcome**
```
gate_signal = +0.15 (R_expected=0.75, threshold=0.6)
was_executed = True (SEND)
actual_reward = -0.3 (parasite died immediately)

training_reward = 0.3×(+0.15) + 0.7×(-0.3) = -0.165
→ Slight negative - gate was optimistic but game corrected
```

**Scenario 3: Bad action (blocked)**
```
gate_signal = -0.35 (R_expected=0.25, threshold=0.6)
was_executed = False (WAIT)
actual_reward = None (not executed)

training_reward = -0.35
→ Negative reinforcement - NN learns "don't do this"
```

**Scenario 4: Very bad action (blocked)**
```
gate_signal = -0.55 (R_expected=0.05, threshold=0.6)
was_executed = False (WAIT)
actual_reward = None

training_reward = -0.55
→ Strong negative - NN learns "really don't do this"
```

---

## 6. Training Thread

```python
class ContinuousTrainer:
    """Background training thread."""

    def __init__(self, model, buffer, gate, config):
        self.model = model
        self.buffer = buffer
        self.gate = gate  # For re-evaluating if needed
        self.config = config

    def _training_loop(self):
        while self.running:
            # Sample batch
            batch = self.buffer.sample(self.config.batch_size)

            if len(batch) >= self.config.min_batch_size:
                # Calculate training rewards
                rewards = [
                    self._calculate_training_reward(exp)
                    for exp in batch
                ]

                # Prepare tensors
                observations = torch.stack([exp.observation for exp in batch])
                actions = torch.tensor([[exp.spawn_chunk, exp.spawn_type] for exp in batch])
                rewards = torch.tensor(rewards)

                # Train
                loss = self.model.train_batch(observations, actions, rewards)
                self.model_version += 1

            time.sleep(self.config.training_interval)
```

---

## 7. Configuration

```python
@dataclass
class ContinuousTrainingConfig:
    # Training loop
    training_interval: float = 1.0      # Train every 1 second
    batch_size: int = 32                # Samples per training step
    min_batch_size: int = 8             # Minimum samples to train

    # Replay buffer
    buffer_capacity: int = 10000        # Max experiences stored

    # Reward weighting (for SEND actions only)
    gate_weight: float = 0.3            # Weight for gate_signal
    actual_weight: float = 0.7          # Weight for actual_reward

    # Learning rate
    learning_rate: float = 0.001

    # Gate threshold (must match gate config)
    reward_threshold: float = 0.6

    # Feature flags
    enabled: bool = True
```

---

## 8. Flow Summary

### Inference Flow (every 15 seconds)
```
1. Observation arrives
2. Extract features (28 values)
3. NN infers action (chunk, type, confidence)
4. Gate evaluates: gate_signal = R_expected - 0.6
5. If gate_signal > 0:
     → SEND action to frontend
     → Create experience with was_executed=True
   Else:
     → WAIT (don't send)
     → Create experience with was_executed=False
6. Add experience to buffer (with gate_signal as training signal)
```

### Training Flow (every 1 second)
```
1. Sample batch from buffer
2. For each experience:
     If was_executed:
       training_reward = α×gate_signal + β×actual_reward
     Else:
       training_reward = gate_signal  (negative, that's the penalty)
3. Train NN on (observations, actions, training_rewards)
4. Increment model version
```

---

## 9. Benefits of This Design

1. **Clean separation** - Gate is cost function, not validator
2. **Numeric signal** - NN gets gradients, not boolean
3. **All experiences train** - WAIT experiences provide negative signal
4. **Alignment** - NN naturally learns to maximize gate approval
5. **Simplicity** - No "SEND/WAIT" in training, just numbers

---

## 10. Implementation Notes

### Gate Changes
- Gate should return `gate_signal` (R_expected - threshold)
- SEND/WAIT decision is just `gate_signal > 0` check at inference time
- Remove any concept of "gate decision" from training path

### Experience Changes
- Store `gate_signal` not "gate_decision"
- `was_executed: bool` replaces "SEND/WAIT"
- Always store experience regardless of execution

### Training Changes
- Use `gate_signal` directly as feedback
- WAIT experiences: training_reward = gate_signal (negative)
- SEND experiences: combine gate_signal with actual_reward

---

## 11. Open Questions

1. **Buffer priority** - Should we sample proportional to |gate_signal|?
2. **Threshold changes** - What if we tune threshold during training?
3. **Multi-objective** - Can we train NN to output expected_reward directly?

---

## 12. References

- Current gate: `server/ai_engine/simulation/gate.py`
- Cost function: `server/ai_engine/simulation/cost_function.py`
- NN model: `server/ai_engine/nn_model.py`
- Reward calculator: `server/ai_engine/reward_calculator.py`
