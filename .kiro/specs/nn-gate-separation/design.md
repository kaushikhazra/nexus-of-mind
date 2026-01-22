# NN-Gate Separation - Technical Design

## Overview

This document describes the technical implementation for adding "no-spawn" capability to the Neural Network. The NN will output 257 chunk classes (0-255 = spawn locations, 256 = no spawn), and the gate will validate BOTH spawn and no-spawn decisions.

## Architecture Change

### Current Architecture (256 chunks)

```
Input (29 features)
    │
    ▼
┌─────────────────┐
│ Dense(32, ReLU) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Dense(16, ReLU) │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐  ┌────────┐
│ Chunk  │  │ Type   │
│ 256    │  │ 1      │
│Softmax │  │Sigmoid │
└────────┘  └────────┘
```

### New Architecture (257 chunks)

```
Input (29 features)
    │
    ▼
┌─────────────────┐
│ Dense(32, ReLU) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Dense(16, ReLU) │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐  ┌────────┐
│ Chunk  │  │ Type   │
│ 257    │  │ 1      │  ◄── Index 256 = "no spawn"
│Softmax │  │Sigmoid │
└────────┘  └────────┘
```

**Parameter Change:**
- Chunk head: 16 → 32 → 256 becomes 16 → 32 → 257
- Additional parameters: 32 weights + 1 bias = 33 new parameters
- Total: ~10,497 → ~10,530 parameters

## Data Flow

### Complete Decision Pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         DECISION PIPELINE                                │
│                                                                          │
│  Observation                                                             │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────┐                                                     │
│  │ Feature Extract │  29 features                                        │
│  └────────┬────────┘                                                     │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────┐                                                     │
│  │   NN Inference  │                                                     │
│  │   257 chunks    │                                                     │
│  └────────┬────────┘                                                     │
│           │                                                              │
│           ▼                                                              │
│      argmax(chunk_probs)                                                 │
│           │                                                              │
│     ┌─────┴─────┐                                                        │
│     │           │                                                        │
│     ▼           ▼                                                        │
│  0-255        256                                                        │
│  SPAWN     NO SPAWN                                                      │
│     │           │                                                        │
│     ▼           ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                        GATE EVALUATION                           │    │
│  │                                                                  │    │
│  │  ┌─────────────────────┐    ┌─────────────────────────────────┐  │    │
│  │  │ SPAWN PROPOSAL      │    │ NO-SPAWN PROPOSAL               │  │    │
│  │  │                     │    │                                 │  │    │
│  │  │ Calculate expected  │    │ Find best available chunk       │  │    │
│  │  │ reward for chunk X  │    │ Calculate best possible reward  │  │    │
│  │  │                     │    │                                 │  │    │
│  │  │ If reward > θ:      │    │ If best_reward > θ:             │  │    │
│  │  │   → SEND            │    │   → SHOULD_SPAWN (missed opp)   │  │    │
│  │  │ Else:               │    │ Else:                           │  │    │
│  │  │   → WAIT            │    │   → CORRECT_WAIT                │  │    │
│  │  └─────────────────────┘    └─────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│           │                           │                                  │
│           ▼                           ▼                                  │
│  ┌─────────────────┐         ┌─────────────────┐                         │
│  │ TRAINING SIGNAL │         │ TRAINING SIGNAL │                         │
│  │                 │         │                 │                         │
│  │ SEND: positive  │         │ CORRECT: +0.2   │                         │
│  │ WAIT: negative  │         │ MISSED: -reward │                         │
│  │ for chunk X     │         │ for chunk 256   │                         │
│  └─────────────────┘         └─────────────────┘                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. NN Model Changes (nn_model.py)

#### Change Chunk Output Size

```python
class NNModel:
    def __init__(self, model_path: Optional[str] = None):
        # ...
        self.chunk_output_size = 257  # Was 256
        # ...
```

#### Update get_spawn_decision() with Exploration

```python
NO_SPAWN_CHUNK = 256

def get_spawn_decision(self, features: np.ndarray, explore: bool = True) -> Dict[str, Any]:
    """
    Get spawn decision from features.

    Args:
        features: numpy array of 29 normalized features
        explore: if True, sample from distribution; if False, use argmax

    Returns:
        Dictionary with:
        - spawnChunk: int (0-255) or -1 for no-spawn
        - spawnType: str ('energy', 'combat', or None for no-spawn)
        - confidence: float
        - nnDecision: str ('spawn' or 'no_spawn')
    """
    chunk_probs, type_prob = self.predict(features)

    # CRITICAL: Exploration vs Exploitation
    if explore:
        # Sample from probability distribution (enables exploration/learning)
        # This prevents the "always same chunk" problem where argmax
        # creates a self-reinforcing loop
        spawn_chunk = int(np.random.choice(len(chunk_probs), p=chunk_probs))
    else:
        # Greedy: always pick highest probability (exploitation only)
        spawn_chunk = int(np.argmax(chunk_probs))

    chunk_confidence = float(chunk_probs[spawn_chunk])

    # Check for no-spawn decision
    if spawn_chunk == NO_SPAWN_CHUNK:
        return {
            'spawnChunk': -1,
            'spawnType': None,
            'confidence': chunk_confidence,
            'nnDecision': 'no_spawn'
        }

    # Normal spawn decision
    spawn_type = 'combat' if type_prob >= 0.5 else 'energy'
    type_confidence = type_prob if type_prob >= 0.5 else (1.0 - type_prob)

    return {
        'spawnChunk': spawn_chunk,
        'spawnType': spawn_type,
        'confidence': chunk_confidence,
        'typeConfidence': float(type_confidence),
        'nnDecision': 'spawn'
    }
```

### Exploration Mechanism (Critical for Learning)

#### The Problem: Argmax Creates Self-Reinforcing Loops

Without exploration, the NN gets stuck:
```
1. NN outputs probabilities: [0.02, 0.03, 0.15, ...]  (chunk 42 = 0.15)
2. argmax selects chunk 42
3. Spawn succeeds → positive reward
4. NN increases P(chunk 42) → [0.01, 0.02, 0.25, ...]
5. argmax ALWAYS selects chunk 42 now
6. NN never explores other chunks → no learning
```

#### The Solution: Sample from Distribution

```python
# Instead of:
spawn_chunk = np.argmax(chunk_probs)  # Always picks highest

# Use:
spawn_chunk = np.random.choice(len(chunk_probs), p=chunk_probs)  # Samples proportionally
```

#### How Sampling Enables Learning

```
Probability distribution: [0.02, 0.03, 0.15, 0.10, ...]
- Chunk 42 (P=0.15) selected ~15% of the time
- Chunk 43 (P=0.10) selected ~10% of the time
- Even chunk 0 (P=0.02) selected ~2% of the time

Over many iterations:
- High-probability chunks get tested more (efficient)
- Low-probability chunks still get tested (exploration)
- NN discovers better strategies through varied experience
```

#### Exploration vs Exploitation Tradeoff

| Mode | Selection | Use Case |
|------|-----------|----------|
| `explore=True` | Sample from distribution | Training, learning, simulation |
| `explore=False` | Argmax (greedy) | Production, evaluation, benchmarking |

By default, `explore=True` to enable continuous learning.

#### Update train_with_reward() for No-Spawn

```python
def train_with_reward(
    self,
    features: np.ndarray,
    chunk_id: int,  # Can be -1 for no-spawn (maps to 256)
    spawn_type: Optional[str],
    reward: float,
    learning_rate: float = 0.01
) -> Dict[str, float]:
    """
    Train using reward signal.

    For no-spawn training: chunk_id=-1 maps to chunk index 256
    """
    # Map -1 to no-spawn index
    target_chunk = NO_SPAWN_CHUNK if chunk_id == -1 else chunk_id

    # Create one-hot target for chunk (257 classes)
    chunk_target = np.zeros(257)
    chunk_target[target_chunk] = 1.0

    # Scale by reward (reinforce if positive, discourage if negative)
    chunk_target = chunk_target * abs(reward)
    if reward < 0:
        # For negative reward, we want to DECREASE probability of this chunk
        # Invert the target: increase all OTHER chunks slightly
        chunk_target = (1.0 - chunk_target) / 256 * abs(reward)

    # Type target (ignored for no-spawn, but still need valid input)
    type_target = np.array([0.5 if spawn_type is None else (1.0 if spawn_type == 'combat' else 0.0)])

    # ... rest of training logic
```

### 2. Gate Changes (gate.py)

#### Add No-Spawn Evaluation

```python
class SimulationGate:

    def evaluate(
        self,
        observation: Dict,
        spawn_chunk: int,  # -1 for no-spawn
        spawn_type: Optional[str],
        nn_confidence: float,
        full_observation: Optional[Dict] = None
    ) -> GateDecision:
        """
        Evaluate NN decision (spawn or no-spawn).
        """
        if spawn_chunk == -1:
            return self._evaluate_no_spawn(observation, nn_confidence, full_observation)
        else:
            return self._evaluate_spawn(observation, spawn_chunk, spawn_type, nn_confidence, full_observation)

    def _evaluate_no_spawn(
        self,
        observation: Dict,
        nn_confidence: float,
        full_observation: Optional[Dict] = None
    ) -> GateDecision:
        """
        Evaluate NN's decision to NOT spawn.

        Find the best possible spawn and compare:
        - If best_reward > threshold: NN missed an opportunity
        - If best_reward <= threshold: NN was correct to wait
        """
        # Find best available chunk
        best_chunk, best_reward, best_type = self._find_best_spawn(observation)

        if best_reward > self.config.reward_threshold:
            # NN should have spawned - missed opportunity
            return GateDecision(
                decision='SHOULD_SPAWN',
                reason='missed_opportunity',
                expected_reward=-best_reward,  # Negative signal
                components={
                    'best_chunk': best_chunk,
                    'best_reward': best_reward,
                    'best_type': best_type
                },
                nn_confidence=nn_confidence
            )
        else:
            # NN was correct to wait
            return GateDecision(
                decision='CORRECT_WAIT',
                reason='no_viable_targets',
                expected_reward=0.2,  # Small positive signal
                components={
                    'best_chunk': best_chunk,
                    'best_reward': best_reward
                },
                nn_confidence=nn_confidence
            )

    def _find_best_spawn(self, observation: Dict) -> Tuple[int, float, str]:
        """
        Find the best possible spawn location and its expected reward.

        Evaluates top candidate chunks (e.g., near workers) and returns
        the one with highest expected reward.
        """
        candidate_chunks = self._get_candidate_chunks(observation)

        best_chunk = -1
        best_reward = float('-inf')
        best_type = 'energy'

        for chunk in candidate_chunks:
            for spawn_type in ['energy', 'combat']:
                reward = self.cost_function.calculate_expected_reward(
                    observation, chunk, spawn_type
                )
                if reward > best_reward:
                    best_reward = reward
                    best_chunk = chunk
                    best_type = spawn_type

        return best_chunk, best_reward, best_type

    def _get_candidate_chunks(self, observation: Dict) -> List[int]:
        """
        Get candidate chunks to evaluate (chunks near workers/activity).
        """
        candidates = set()

        # Add chunks with workers
        for worker in observation.get('workers_present', []):
            if 'chunk' in worker:
                candidates.add(worker['chunk'])
                # Add neighboring chunks
                for neighbor in self._get_neighbors(worker['chunk']):
                    candidates.add(neighbor)

        # Add chunks with mining workers
        for worker in observation.get('workers_mining', []):
            if 'chunk' in worker:
                candidates.add(worker['chunk'])

        # Limit to prevent performance issues
        return list(candidates)[:20]
```

### 3. Message Handler Changes (message_handler.py)

```python
async def _handle_chunk_observation_data(self, observation: Dict) -> Optional[Dict]:
    # ... feature extraction ...

    # Get NN decision
    spawn_decision = self.nn_model.get_spawn_decision(features)

    nn_decision = spawn_decision['nnDecision']
    spawn_chunk = spawn_decision['spawnChunk']
    spawn_type = spawn_decision.get('spawnType')
    confidence = spawn_decision['confidence']

    # Gate evaluation (ALWAYS, for both spawn and no-spawn)
    gate_decision = self.simulation_gate.evaluate(
        sim_observation,
        spawn_chunk,  # -1 for no-spawn
        spawn_type,
        confidence,
        full_observation=observation
    )

    # Training based on gate validation
    if nn_decision == 'no_spawn':
        # NN decided not to spawn
        if gate_decision.decision == 'CORRECT_WAIT':
            # NN was right - positive reinforcement
            train_reward = 0.2
        else:
            # NN missed opportunity - negative signal
            train_reward = gate_decision.expected_reward  # Already negative

        self.nn_model.train_with_reward(
            features,
            chunk_id=-1,  # Train on no-spawn decision
            spawn_type=None,
            reward=train_reward
        )

        return self._build_no_spawn_response(gate_decision, confidence)

    else:
        # NN proposed a spawn
        if gate_decision.decision == 'SEND':
            # Execute spawn
            return self._build_spawn_response(spawn_decision, gate_decision)
        else:
            # Gate blocked - train with negative signal
            self.nn_model.train_with_reward(
                features,
                chunk_id=spawn_chunk,
                spawn_type=spawn_type,
                reward=gate_decision.expected_reward * 0.3
            )
            return self._build_wait_response(gate_decision)
```

### 4. Dashboard Changes (nn_dashboard.html)

#### Update Pipeline Stage 2 (NN Inference)

```html
<!-- Stage 2: NN Inference -->
<div class="pipeline-stage" id="stage-nn-inference">
    <div class="stage-header">NN INFERENCE</div>
    <div class="stage-content">
        <div class="stage-item"><span class="label">Decision</span><span class="value" id="pipe-nn-decision">-</span></div>
        <div class="stage-item"><span class="label">Chunk</span><span class="value" id="pipe-chunk">-</span></div>
        <div class="stage-item"><span class="label">Type</span><span class="value" id="pipe-type">-</span></div>
        <div class="stage-item"><span class="label">Confidence</span><span class="value" id="pipe-confidence">-</span></div>
    </div>
</div>
```

#### Update JavaScript

```javascript
function updatePipeline(pipeline) {
    const nn = pipeline.nn_inference || {};

    // NN Decision display
    const nnDecision = nn.nn_decision || 'spawn';
    document.getElementById('pipe-nn-decision').textContent = nnDecision.toUpperCase();

    if (nnDecision === 'no_spawn') {
        document.getElementById('pipe-chunk').textContent = 'N/A';
        document.getElementById('pipe-type').textContent = 'N/A';
    } else {
        document.getElementById('pipe-chunk').textContent = nn.chunk_id ?? '-';
        document.getElementById('pipe-type').textContent = nn.spawn_type ?? '-';
    }
    document.getElementById('pipe-confidence').textContent = formatDecimal(nn.confidence, 4);

    // Gate validation display
    const decision = pipeline.decision || {};
    const action = decision.action || '-';

    if (nnDecision === 'no_spawn') {
        // Show gate validation of no-spawn
        if (action === 'CORRECT_WAIT') {
            document.getElementById('pipe-action').textContent = 'CORRECT';
            document.getElementById('pipe-action').className = 'value status-good';
        } else {
            document.getElementById('pipe-action').textContent = 'SHOULD SPAWN';
            document.getElementById('pipe-action').className = 'value status-bad';
        }
    } else {
        // Show gate decision for spawn
        document.getElementById('pipe-action').textContent = action;
    }
}
```

## Training Signal Summary

| NN Decision | Gate Validation | Training Signal | Effect |
|-------------|-----------------|-----------------|--------|
| Spawn at X | SEND | Real reward (delayed) | Learn from actual outcome |
| Spawn at X | WAIT | Negative (expected_reward × 0.3) | Discourage chunk X |
| No spawn | CORRECT_WAIT | +0.2 | Reinforce no-spawn in this state |
| No spawn | SHOULD_SPAWN | -best_reward | Penalize missed opportunity |

## Testing Scenarios

### Scenario 1: NN Correctly Waits
```
Game state: No workers, no targets, low energy
NN outputs: chunk=256 (no spawn), confidence=0.7
Gate: best_reward=-0.3 (< threshold)
Result: CORRECT_WAIT, reward=+0.2
NN learns: "No targets = don't spawn" ✓
```

### Scenario 2: NN Incorrectly Waits
```
Game state: Workers mining, energy available
NN outputs: chunk=256 (no spawn), confidence=0.5
Gate: best_chunk=142, best_reward=0.45 (> threshold)
Result: SHOULD_SPAWN, reward=-0.45
NN learns: "Workers present = should spawn" ✓
```

### Scenario 3: NN Correctly Spawns
```
Game state: Workers at chunk 100
NN outputs: chunk=100, type=energy, confidence=0.8
Gate: expected_reward=0.5 (> threshold)
Result: SEND
NN learns from real outcome ✓
```

### Scenario 4: NN Incorrectly Spawns
```
Game state: Protectors near chunk 50
NN outputs: chunk=50, type=combat, confidence=0.6
Gate: expected_reward=-0.3 (< threshold)
Result: WAIT, reward=-0.09
NN learns: "Protectors nearby = dangerous chunk" ✓
```
