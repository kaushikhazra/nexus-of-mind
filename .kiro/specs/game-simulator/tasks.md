# Implementation Plan: Game Simulator

## Overview

Implement a lightweight game simulator that generates training observations for the Queen NN. The simulator models game entities and sends observations through the existing WebSocket interface.

**Core Principle:** Reuse the existing pipeline. The simulator sends observations in the same format as the real game frontend.

## Dependencies

- Continuous Training Loop (complete)
- WebSocket backend (complete)
- Python websockets library

## Tasks

### Phase 1: Project Setup

- [x] 1. Create module structure
  - [x] 1.1 Create directory structure
    - Directory: `server/game_simulator/`
    - Files: `__init__.py`, `config.py`, `entities.py`, `state.py`, `simulator.py`, `observation.py`, `runner.py`
    - _Requirements: N/A_

  - [x] 1.2 Create configuration dataclass
    - File: `server/game_simulator/config.py`
    - SimulationConfig with all parameters
    - YAML loader
    - Validation
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 1.3 Create default config file
    - File: `server/game_simulator_configs/default.yaml`
    - Sensible defaults for all parameters
    - _Requirements: 10.3_

### Phase 2: Entity Implementation

- [x] 2. Implement Entity base class
  - [x] 2.1 Create Entity base
    - File: `server/game_simulator/entities.py`
    - chunk position
    - distance_to() method
    - move_toward() method
    - move_away_from() method
    - _Requirements: 2.1, 3.1, 4.1_

- [x] 3. Implement Worker entity
  - [x] 3.1 Create Worker class
    - Extends Entity
    - States: MINING, MOVING, FLEEING
    - target_chunk, flee_timer
    - _Requirements: 2.1_

  - [x] 3.2 Implement Worker.update()
    - Check for nearby parasites
    - Flee if parasite in range
    - Move toward mining spot
    - Generate resources when mining
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 4. Implement Protector entity
  - [x] 4.1 Create Protector class
    - Extends Entity
    - States: PATROLLING, CHASING
    - patrol_path, patrol_index, chase_target
    - _Requirements: 3.1_

  - [x] 4.2 Implement Protector.update()
    - Detect parasites in range
    - Chase detected parasite
    - Kill parasite when close
    - Return to patrol after kill
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 5. Implement Parasite entity
  - [x] 5.1 Create Parasite class
    - Extends Entity
    - type ('energy' or 'combat')
    - spawn_time
    - _Requirements: 4.1_

  - [x] 5.2 Implement disruption calculation
    - get_disruption_chunks() method
    - _Requirements: 4.3_

### Phase 3: Game State

- [x] 6. Implement SimulatedGameState
  - [x] 6.1 Create state dataclass
    - File: `server/game_simulator/state.py`
    - workers, protectors, parasites lists
    - queen_energy, queen_chunk
    - player_energy, player_minerals
    - Previous values for rate calculation
    - _Requirements: 1.1, 1.2_

  - [x] 6.2 Implement create_initial()
    - Create workers at mining spots
    - Create protectors with patrol paths
    - Initialize resources
    - _Requirements: 1.1_

  - [x] 6.3 Generate patrol paths
    - Helper method for protector patrol routes
    - Spread across territory
    - _Requirements: 3.1_

### Phase 4: Simulation Logic

- [x] 7. Implement Simulator
  - [x] 7.1 Create Simulator class
    - File: `server/game_simulator/simulator.py`
    - Holds state and config
    - _Requirements: 6.1_

  - [x] 7.2 Implement tick() method
    - Update workers
    - Update protectors
    - Remove killed parasites
    - Update resources
    - Regenerate queen energy
    - Increment tick counter
    - _Requirements: 6.1, 6.2_

  - [x] 7.3 Implement spawn_parasite()
    - Check queen energy
    - Deduct cost
    - Create parasite entity
    - _Requirements: 5.2, 5.3_

- [x] 8. Add unit tests for simulation
  - [x] 8.1 Test entity movement
    - Worker moves toward target
    - Protector follows patrol
    - _Requirements: 2.2, 3.2_

  - [x] 8.2 Test worker fleeing
    - Worker flees from parasite
    - Worker returns after flee timer
    - _Requirements: 2.3_

  - [x] 8.3 Test protector chasing
    - Protector detects parasite
    - Protector kills parasite
    - _Requirements: 3.3, 3.4_

  - [x] 8.4 Test resource generation
    - Mining workers generate resources
    - Fleeing workers don't generate
    - _Requirements: 2.4_

### Phase 5: Observation Generation

- [x] 9. Implement observation generator
  - [x] 9.1 Create observation module
    - File: `server/game_simulator/observation.py`
    - generate_observation(state) function
    - _Requirements: 7.1_

  - [x] 9.2 Calculate chunk densities
    - Count workers per chunk
    - Count protectors per chunk
    - Count parasites per chunk by type
    - _Requirements: 7.2_

  - [x] 9.3 Format observation
    - Match frontend JSON format exactly
    - Include all required fields
    - _Requirements: 7.1, 7.3_

- [x] 10. Add observation tests
  - [x] 10.1 Test observation format
    - Verify all required fields present
    - Verify correct data types
    - _Requirements: 7.1_

  - [x] 10.2 Test chunk counting
    - Multiple workers in same chunk
    - Workers and protectors in same chunk
    - _Requirements: 7.2_

### Phase 6: WebSocket Integration

- [x] 11. Implement SimulationRunner
  - [x] 11.1 Create runner module
    - File: `server/game_simulator/runner.py`
    - WebSocket connection
    - Main loop
    - _Requirements: 8.1, 9.1_

  - [x] 11.2 Implement connect()
    - Connect to backend WebSocket
    - Handle connection errors
    - _Requirements: 8.1, 8.4_

  - [x] 11.3 Implement run loop
    - tick() → generate_observation() → send → receive → spawn
    - Turbo mode support
    - _Requirements: 9.1, 9.2_

  - [x] 11.4 Handle NN responses
    - Parse spawn decisions
    - Execute in simulation
    - Handle WAIT decisions
    - _Requirements: 8.3_

- [x] 12. Add integration tests
  - [x] 12.1 Test WebSocket connection
    - Connect to backend
    - Send observation
    - Receive response
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 12.2 Test full loop
    - Multiple ticks
    - Spawn parasites
    - Verify state changes
    - _Requirements: 9.1_

### Phase 7: Curriculum Learning

- [x] 13. Implement curriculum system
  - [x] 13.1 Create curriculum module
    - File: `server/game_simulator/curriculum.py`
    - CurriculumPhase dataclass
    - CurriculumManager class
    - _Requirements: 11.1_

  - [x] 13.2 Implement phase transitions
    - Track ticks per phase
    - Transition when duration reached
    - Apply phase config
    - _Requirements: 11.2_

  - [x] 13.3 Integrate with runner
    - Update entity counts on transition
    - Log phase changes
    - _Requirements: 11.3_

- [x] 14. Add curriculum tests
  - [x] 14.1 Test phase transitions
    - Phase 1 → Phase 2 → Phase 3
    - Config changes applied
    - _Requirements: 11.2_

### Phase 8: CLI and Polish

- [x] 15. Create CLI entry point
  - [x] 15.1 Create main script
    - File: `server/game_simulator/main.py`
    - Parse arguments
    - Load config
    - Run simulation
    - _Requirements: 9.3_

  - [x] 15.2 Add CLI arguments
    - --config: Config file path
    - --ticks: Number of ticks
    - --turbo: Enable turbo mode
    - --url: WebSocket URL
    - _Requirements: 9.3_

- [x] 16. Add logging and metrics
  - [x] 16.1 Add simulation logging
    - Tick progress
    - Entity counts
    - Spawn events
    - _Requirements: 11.3_

  - [x] 16.2 Add performance metrics
    - Ticks per second
    - Average tick time
    - _Requirements: 12.1, 12.2_

### Phase 9: Documentation

- [ ] 17. Documentation
  - [ ] 17.1 Add module docstrings
    - All classes and functions
    - Usage examples

  - [ ] 17.2 Create README
    - File: `server/game_simulator/README.md`
    - Setup instructions
    - Usage examples
    - Configuration reference

## Completion Criteria

1. [ ] Simulator produces valid observations (matches frontend format)
2. [ ] Workers exhibit realistic behavior (mine, flee, return)
3. [ ] Protectors patrol and kill parasites
4. [ ] NN decisions result in parasite spawns
5. [ ] Resources update based on worker activity
6. [ ] Curriculum learning progresses through phases
7. [ ] Turbo mode achieves 100+ ticks/second
8. [ ] NN trains successfully on simulated data
9. [ ] Learned behavior transfers to real game (manual testing)

## Rollback Plan

If simulation produces unrealistic training:
1. Compare observation distributions with real game
2. Tune entity behavior parameters
3. Adjust curriculum phases
4. Fall back to real game training if needed

## Usage (After Implementation)

```bash
# Run with default config, real-time speed
python -m server.game_simulator.main

# Run in turbo mode for 10k ticks
python -m server.game_simulator.main --turbo --ticks 10000

# Use custom config
python -m server.game_simulator.main --config my_config.yaml
```
