# Simulator Curriculum Challenge - Tasks

## Overview

Extend the game simulator's curriculum system to vary behavioral parameters (speeds, radiuses) per phase, creating progressive challenges for NN training.

**Goal:** Force the NN to learn robust strategies that generalize across different "player skill levels."

## Dependencies

- Game Simulator (complete)
- Curriculum System (complete)
- NN Dashboard API (complete)

## Tasks

### Phase 1: Extend CurriculumPhase

- [ ] 1. Add behavioral parameters to CurriculumPhase
  - [ ] 1.1 Extend CurriculumPhase dataclass
    - File: `server/game_simulator/curriculum.py`
    - Add optional fields: protector_speed, detection_radius, kill_radius, flee_radius, flee_duration, worker_speed
    - All default to None (use base config)
    - _Requirements: 1.1, 1.2_

  - [ ] 1.2 Add validation for new parameters
    - File: `server/game_simulator/curriculum.py`
    - Validate in __post_init__
    - Speeds must be positive, radiuses non-negative, durations positive
    - _Requirements: 1.3_

### Phase 2: Apply Behavioral Parameters on Transition

- [ ] 2. Update Simulator to apply behavioral parameters
  - [ ] 2.1 Modify _apply_phase_config method
    - File: `server/game_simulator/simulator.py`
    - Check each behavioral parameter in phase
    - If not None, update self.config with new value
    - Log old -> new value changes
    - _Requirements: 2.1, 2.2, 2.3_

### Phase 3: Verify Entity Dynamic Behavior

- [ ] 3. Verify entities use config dynamically
  - [ ] 3.1 Review Worker.update() method
    - File: `server/game_simulator/entities.py`
    - Confirm it reads flee_radius, flee_duration, worker_speed from config parameter
    - No caching of values
    - _Requirements: 3.1, 3.3_

  - [ ] 3.2 Review Protector.update() method
    - File: `server/game_simulator/entities.py`
    - Confirm it reads protector_speed, detection_radius, kill_radius from config parameter
    - No caching of values
    - _Requirements: 3.2, 3.3_

### Phase 4: Update Default Curriculum

- [ ] 4. Create progressive challenge curriculum
  - [ ] 4.1 Update create_default_curriculum function
    - File: `server/game_simulator/curriculum.py`
    - Add behavioral parameters to each phase
    - Follow progression table from requirements
    - _Requirements: 4.1, 4.2, 4.3_

### Phase 5: Testing and Observation

- [ ] 5. Run simulation and observe NN metrics
  - [ ] 5.1 Start backend server
    - Command: `python -m server.main`
    - Verify server starts without errors

  - [ ] 5.2 Run simulator with curriculum
    - Command: `python -m server.game_simulator.main --curriculum --turbo --ticks 25000`
    - Should progress through all phases

  - [ ] 5.3 Observe dashboard metrics
    - URL: http://localhost:8010/api/nn-dashboard
    - Monitor: confidence, entropy, loss
    - Look for changes at phase transitions
    - _Requirements: 5.1, 5.2_

- [ ] 6. Tune parameters if needed
  - [ ] 6.1 Analyze phase transition impacts
    - Does entropy change at transitions?
    - Does loss show learning signal?
    - Is progression too easy or too hard?

  - [ ] 6.2 Adjust parameter values
    - If too easy: increase challenge faster
    - If too hard: smooth the progression
    - Re-run and observe

### Phase 6: Documentation and Commit

- [ ] 7. Final report and commit
  - [ ] 7.1 Document observations
    - Note NN behavior at each phase
    - Record any parameter adjustments made
    - Summarize effectiveness of curriculum

  - [ ] 7.2 Commit changes
    - Stage modified files
    - Create descriptive commit message
    - Push to feature branch

## Completion Criteria

1. [ ] CurriculumPhase includes behavioral parameters
2. [ ] Simulator applies parameters on phase transition
3. [ ] Entities respect dynamic config values
4. [ ] Default curriculum has progressive challenge
5. [ ] NN shows learning signal across phases (entropy/loss changes)
6. [ ] Changes committed to feature branch

## Parameter Reference

### Default Progression

| Phase | Workers | Protectors | Prot Speed | Detection | Kill | Flee Radius | Flee Duration |
|-------|---------|------------|------------|-----------|------|-------------|---------------|
| beginner | 4 | 0 | 1.0 | 3 | 1 | 5 | 8 |
| novice | 6 | 1 | 1.2 | 4 | 1 | 4 | 7 |
| intermediate | 8 | 2 | 1.5 | 5 | 2 | 3 | 5 |
| advanced | 10 | 3 | 1.7 | 5 | 2 | 3 | 4 |
| expert | 12 | 4 | 1.8 | 6 | 2 | 2 | 3 |
| master | 15 | 5 | 2.0 | 7 | 3 | 2 | 3 |

### Challenge Logic

- **Protector speed**: 1.0 → 2.0 (2x faster = half the disruption window)
- **Detection radius**: 3 → 7 (2.3x larger = much harder to avoid)
- **Kill radius**: 1 → 3 (3x larger = faster parasite elimination)
- **Flee radius**: 5 → 2 (60% smaller = workers are braver)
- **Flee duration**: 8 → 3 (62% shorter = faster recovery)

## Usage After Implementation

```bash
# Run with progressive curriculum challenge
python -m server.game_simulator.main --curriculum --turbo --ticks 25000

# Monitor NN response
curl http://localhost:8010/api/nn-dashboard
```
