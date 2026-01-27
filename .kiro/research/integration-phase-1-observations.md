# Integration Phase 1 Observations

## Client Observation to Feature Extraction Mapping

### Key Observations

1. ~~`miningWorkers` is used to determine top 5 chunks (not `workersPresent`)~~
   **FIXED**: Now uses `workersPresent` for top 5 chunk selection
   <!--
    K: This does not look right, it means when there is no mining
    the top chunks are going to be -1, which is what we saw

    V: Fixed in feature_extractor.py - changed to use workersPresent
    -->
2. ~~`workersPresent` is only used by preprocess gate, not feature extraction~~
   **FIXED**: Both preprocess gate and feature extraction now use `workersPresent`
    <!--
    K: This property should be used to determine the top 5 chunks.
    The assumptions might have changed as some point during development
    and we switched to miningWorkers.

    Ideally, parasites don't allow anyone in their territory, mining or
    not. Thats the game lore.

    V: Fixed in both:
    - feature_extractor.py: uses workersPresent for chunk selection
    - preprocess_gate.py: checks workersPresent instead of miningWorkers
    -->
3. Chunks are **shuffled** to prevent NN from learning position bias
4. All 29 features are normalized to 0-1 range

## Training Loop Behavior

### Key Observations

1. ~~**No "already trained" tracking**~~ **FIXED**: Now uses "train once, then remove" model
   <!--
   K: This is wrong. That means we are training on the same data again
   and again, which will not produce variance

   V: Fixed - buffer.drain() removes all experiences after training
   -->

2. ~~**Training runs continuously**~~ **FIXED**: Now waits for min_batch_size, drains all, trains, waits again
   <!--
   K: That is not right either. The already trained data should be removed from the buffer. That way when minimum data comes in we train, remove the already trained data. Then we wait for min batch to fill up.

   V: Fixed - trainer waits until buffer >= min_batch_size, then drains and trains all
   -->

3. ~~**FIFO eviction only**~~ **FIXED**: Experiences removed immediately after training via drain()
   <!--
   K: This need to change, data should be removed. But here one catch is there. Only remove the data that has been used for training. Because there is a cycle
   1. Inference
   2. Wait for observation to arrive
   3. Update the training data after observation has arrived
   4. Train using that data
   5. Then remove that from buffer

   V: Fixed - new cycle implemented:
   - Buffer accumulates experiences
   - When >= min_batch_size, trainer wakes up
   - drain() returns ALL experiences and clears buffer
   - Train on all, then wait for buffer to fill again
   -->

4. ~~**Standard experience replay design**~~ **CHANGED**: Now "train once and discard" model
   - Fresh data only - no stale experiences
   - Waits for new data when buffer is empty
   - No overfitting on old experiences

## Throughput Management

### Design Principle

The `min_batch_size` threshold acts as a flow regulator balancing:
- **Inflow**: Observations coming in (game ticks)
- **Outflow**: Training consuming data

```
[Observations] → [Buffer] → [Trainer]
    inflow         queue      outflow

min_batch_size = trigger point to balance flow
```

### Throughput vs Learning Quality

These are interconnected - cannot optimize one without affecting the other:

| Threshold | Throughput Effect | Learning Quality Effect |
|-----------|-------------------|------------------------|
| Too low (1-2) | Drains fast, may starve | Low variance, noisy gradients, poor generalization |
| Sweet spot | Balanced flow | Good variance, stable gradients, fresh data |
| Too high | Data piles up | Stale data by training time, or trainer starves waiting |

### Observation Rates

| Mode | Observation Rate | Recommended min_batch_size |
|------|------------------|---------------------------|
| Real game | 1 per 15 seconds | 4 (wait ~1 minute) |
| Sim normal | 1 per second | 16-20 (~20 seconds of data) |
| Sim turbo | 100+ per second | 32-64 (capped) |

### Implementation Decision
**Approach**: Simple config per mode (not auto-adaptive)
- Simulator: `min_batch_size` in `game_simulator.yaml`
- Real game: default in training config

Auto-adaptive (measuring observation rate dynamically) deferred for later if manual tuning becomes tedious.

### Potential Improvements (Future)
<!--
K: These points are improvements, we will tackle that if we have time.
-->
- Implement prioritized experience replay (newer or higher-error samples more likely)
- Add staleness detection to skip experiences older than N ticks
- Consider clearing buffer on significant game state changes
- Auto-adaptive min_batch_size based on measured observation rate


