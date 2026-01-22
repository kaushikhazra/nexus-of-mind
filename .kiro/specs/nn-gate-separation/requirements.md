# NN-Gate Separation - Requirements

## Introduction

This specification adds the ability for the Neural Network to explicitly decide "don't spawn" rather than always proposing a spawn location. Currently, the NN always outputs a chunk/type, and a "skip" value is incorrectly derived from the gate's decision. This creates confusion and prevents the NN from learning WHEN to spawn.

**Current Problem:**

```
NN outputs: chunk (0-255), type, confidence
Gate decides: SEND or WAIT
"skip" displayed = gate.decision == 'WAIT'  ← NOT an NN decision!
```

The NN has no way to say "don't spawn." It always proposes a location, and the gate decides whether to execute. The NN cannot learn "this game state = don't spawn."

**Solution:**

Extend the chunk output to 257 values, where chunk 256 means "no spawn":

```
NN outputs: chunk (0-256), type, confidence
- chunk 0-255: spawn at this location
- chunk 256: don't spawn (NN's explicit decision)

Gate ALWAYS evaluates (both spawn and no-spawn decisions)
```

## Glossary

- **No-Spawn Signal**: NN outputting chunk=256, indicating "I decide not to spawn"
- **Spawn Proposal**: NN outputting chunk 0-255, indicating "spawn at this location"
- **Gate Validation**: Gate evaluating whether NN's decision (spawn OR no-spawn) is correct
- **Bidirectional Training**: NN learns both when to spawn AND when not to spawn

## Requirements

### Requirement 1: Extend Chunk Output to 257

**User Story:** As the Queen AI, I need the ability to decide "don't spawn" so that I can learn WHEN to spawn, not just WHERE.

**Problem Statement:**
Currently, the NN always outputs a chunk 0-255, forcing it to always propose a spawn. It cannot express "I don't think we should spawn right now."

#### Acceptance Criteria

1. THE chunk head output size SHALL be 257 (was 256)
2. THE chunk indices SHALL be interpreted as:
   - 0-255: Valid spawn locations on the grid
   - 256: "No spawn" decision
3. THE softmax activation SHALL remain unchanged (257-way classification)
4. WHEN argmax(chunk_probs) == 256, THE NN is signaling "don't spawn"
5. THE type output SHALL be ignored when chunk == 256

### Requirement 2: Gate Validates Both Directions

**User Story:** As a training system, I need the gate to validate both spawn and no-spawn decisions so that the NN learns correct behavior in both cases.

**Problem Statement:**
The gate must not blindly accept "no spawn" from the NN. The NN could be wrong about when NOT to spawn, just as it could be wrong about WHERE to spawn.

#### Acceptance Criteria

1. THE gate SHALL evaluate when NN proposes spawn (chunk 0-255):
   - Calculate expected reward for proposed location
   - Return SEND if reward > threshold, WAIT otherwise

2. THE gate SHALL evaluate when NN proposes no-spawn (chunk 256):
   - Assess current game state (workers present, energy available, targets)
   - If spawning would be beneficial: return signal "should_spawn"
   - If waiting is correct: return signal "correct_wait"

3. THE gate evaluation for no-spawn SHALL consider:
   - Are workers actively mining? (missed opportunity if yes)
   - Does queen have sufficient energy?
   - Are there reachable targets with acceptable survival?
   - What is the best possible spawn reward right now?

4. THE gate SHALL return training signals for BOTH decision types:
   ```
   NN says spawn at X:
     - Gate approves: positive signal for chunk X
     - Gate rejects: negative signal for chunk X

   NN says no-spawn:
     - Gate agrees (no good targets): positive signal for chunk 256
     - Gate disagrees (should spawn): negative signal for chunk 256
   ```

### Requirement 3: Training Signal for No-Spawn Decisions

**User Story:** As the Queen AI, I need feedback on my no-spawn decisions so that I learn when waiting is correct vs when I should have spawned.

#### Acceptance Criteria

1. WHEN NN outputs chunk=256 AND gate agrees (correct wait):
   - Training reward SHALL be positive (e.g., +0.2)
   - NN learns: "this game state = don't spawn"

2. WHEN NN outputs chunk=256 AND gate disagrees (missed opportunity):
   - Training reward SHALL be negative
   - Gate SHALL calculate what the best spawn reward WOULD have been
   - NN learns: "this game state = should have spawned"

3. THE missed opportunity penalty SHALL be proportional to:
   - Best available expected reward (what NN missed)
   - Worker activity level (more workers = bigger miss)

4. THE gate SHALL log no-spawn evaluations:
   ```
   [Gate] NN decided NO_SPAWN
   [Gate] Best available spawn: chunk=142, expected_reward=0.45
   [Gate] Verdict: MISSED_OPPORTUNITY, penalty=-0.35
   ```

### Requirement 4: Keep Response Format Simple

**User Story:** As a frontend consumer, I receive what the NN decided.

**Principle:** One response format. Gate is invisible - it just filters.

#### Acceptance Criteria

1. THE response format SHALL be consistent:
   ```json
   {
     "spawnChunk": 142,
     "spawnType": "combat",
     "confidence": 0.78
   }
   ```

2. FOR no-spawn decisions:
   ```json
   {
     "spawnChunk": -1,
     "spawnType": null,
     "confidence": 0.65
   }
   ```

3. THE gate behavior:
   - Gate allows → send NN decision
   - Gate blocks → send nothing (no response)

4. THE frontend logic:
   - `if spawnChunk >= 0` → execute spawn
   - `if spawnChunk == -1` → do nothing

5. NO separate response types, NO gate details, NO "skip" field

### Requirement 5: Frontend Alignment

**User Story:** As a frontend developer, I need to handle the new response format.

#### Acceptance Criteria

1. THE frontend SHALL check `spawnChunk` value:
   - `spawnChunk >= 0` → execute spawn at that chunk
   - `spawnChunk == -1` → do nothing (NN decided no spawn)

2. THE frontend SHALL handle `spawnType: null` gracefully

3. THE frontend SHALL NOT rely on:
   - "skip" field (removed)
   - Separate response types
   - Gate decision details

### Requirement 5: Update Dashboard Display

**User Story:** As a developer, I need the dashboard to clearly show NN's decision (spawn vs no-spawn) separately from gate's validation.

#### Acceptance Criteria

1. THE pipeline Stage 2 (NN Inference) SHALL display:
   - If spawn: "Chunk: 142, Type: combat, Conf: 0.78"
   - If no-spawn: "Decision: NO SPAWN, Conf: 0.65"

2. THE pipeline Stage 5 (Decision) SHALL display:
   - Gate's validation of NN's decision
   - For spawn: "SEND" or "WAIT (reason)"
   - For no-spawn: "CORRECT" or "SHOULD SPAWN (best: chunk 142)"

3. THE dashboard SHALL NOT display "skip" as an NN output
4. THE dashboard SHALL clearly distinguish NN decision from gate validation

### Requirement 6: Model File Compatibility

**User Story:** As a developer, I need to handle the architecture change gracefully.

#### Acceptance Criteria

1. THE system SHALL detect old models (256 outputs) vs new models (257 outputs)
2. WHEN loading old model, THE system SHALL:
   - Log warning about architecture mismatch
   - Initialize fresh weights for the new architecture
   - NOT crash or produce undefined behavior
3. THE model metadata SHALL include architecture version
4. THE system SHALL save new models with 257-output architecture

### Requirement 7: Exploration Mechanism for Learning

**User Story:** As the Queen AI, I need to explore different spawn locations during training so that I can learn from varied experiences rather than getting stuck on a single chunk.

**Problem Statement:**
Using argmax to select the highest-probability chunk creates a self-reinforcing loop. Once a chunk receives positive reward and becomes the highest probability, the NN will always select it, preventing exploration of other potentially better options. This prevents effective learning.

#### Acceptance Criteria

1. THE NN SHALL sample from the probability distribution (not argmax) during training/exploration
   - Use: `np.random.choice(len(chunk_probs), p=chunk_probs)`
   - This allows lower-probability chunks to occasionally be selected
2. THE exploration behavior SHALL be controlled by an `explore` parameter:
   - `explore=True`: Sample from distribution (enables learning)
   - `explore=False`: Use argmax (greedy exploitation for production)
3. BY DEFAULT, `explore` SHALL be True to enable learning
4. THE sampling approach ensures:
   - Chunks with higher probability are selected more often
   - Lower probability chunks still get occasional selection
   - NN can discover better strategies through varied experience
5. THIS mechanism is CRITICAL for:
   - Breaking out of local optima
   - Learning about multiple viable spawn locations
   - Avoiding the "always same chunk" problem

## Non-Requirements (Out of Scope)

1. Changing type output structure (remains binary)
2. Changing feature extraction (remains 29 features)
3. Changing gate cost function weights
4. Backward compatibility with old model files (fresh training expected)

## Impact Analysis

### Files to Modify

1. `server/ai_engine/nn_model.py`
   - Change chunk_output_size from 256 to 257
   - Update get_spawn_decision() to handle chunk=256
   - Update train_with_reward() for no-spawn training

2. `server/ai_engine/simulation/gate.py`
   - Add evaluate_no_spawn() method
   - Calculate best available spawn for comparison
   - Return appropriate training signals

3. `server/websocket/message_handler.py`
   - Handle no-spawn decisions from NN
   - Route to gate validation
   - Apply correct training signals

4. `server/static/nn_dashboard.html`
   - Update pipeline display for no-spawn decisions
   - Remove "skip" from NN output stage

5. `server/ai_engine/simulation/dashboard_metrics.py`
   - Track no-spawn decisions separately
   - Record gate validation results

### Training Behavior Change

- NN will initially output chunk=256 randomly (~0.4% of the time)
- Gate feedback will teach NN when no-spawn is correct
- Over time, NN learns to output 256 when waiting is optimal
- NN learns to output 0-255 when spawning is beneficial
