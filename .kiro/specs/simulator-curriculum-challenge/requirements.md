# Simulator Curriculum Challenge - Requirements

## Introduction

This specification defines enhancements to the game simulator's curriculum system to provide more challenging and varied training scenarios for the Queen NN. Currently, curriculum phases only vary entity counts (workers/protectors). This enhancement adds behavioral parameter variation to create progressive difficulty that challenges the NN to learn robust, generalizable strategies.

**Key Innovation:**
- Vary behavioral parameters (speeds, radiuses) per curriculum phase
- Create scenarios that challenge the NN beyond just entity counts
- Force the NN to generalize rather than overfit to one configuration
- Simulate different "player skill levels" through behavioral differences

**Core Design Principle: Challenge the NN**

```
┌─────────────────────────────────────────────────────────────────┐
│                     CURRICULUM PROGRESSION                       │
│                                                                 │
│  Beginner         →    Intermediate    →    Master              │
│  ─────────────────────────────────────────────────────          │
│  Slow protectors       Medium speeds       Fast protectors      │
│  Small detection       Medium detection    Large detection      │
│  Scared workers        Moderate flee       Brave workers        │
│  Easy for NN           Learning curve      Maximum challenge    │
└─────────────────────────────────────────────────────────────────┘
```

## Glossary

- **Behavioral Parameter**: A simulation config value that affects entity behavior (speed, radius, duration)
- **Challenge Level**: How difficult a phase is for the NN to achieve optimal disruption
- **Detection Radius**: Distance at which protectors spot and chase parasites
- **Flee Radius**: Distance at which workers detect and flee from parasites
- **Kill Radius**: Distance at which protectors destroy parasites

## Requirements

### Requirement 1: Extended CurriculumPhase

**User Story:** As a trainer, I need curriculum phases to include behavioral parameters so that the NN faces varied challenges beyond entity counts.

**Problem Statement:**
- Current curriculum only varies num_workers and num_protectors
- NN may overfit to specific behavioral patterns
- No way to simulate "skill progression" in player behavior

#### Acceptance Criteria

1. THE CurriculumPhase dataclass SHALL include:
   - `protector_speed`: float (default: None, uses config)
   - `detection_radius`: int (default: None, uses config)
   - `kill_radius`: int (default: None, uses config)
   - `flee_radius`: int (default: None, uses config)
   - `flee_duration`: int (default: None, uses config)
   - `worker_speed`: float (default: None, uses config)

2. THE None value SHALL indicate "use base config default"
   - Allows phases to override only specific parameters
   - Maintains backward compatibility with phase definitions

3. THE System SHALL validate parameter ranges:
   - Speeds must be positive
   - Radiuses must be non-negative
   - Durations must be positive

### Requirement 2: Dynamic Config Updates

**User Story:** As a simulator, I need to update behavioral parameters during runtime so that phase transitions actually change entity behavior.

#### Acceptance Criteria

1. THE Simulator SHALL apply phase behavioral parameters on transition:
   - Update config values when phase changes
   - Entities use updated config values in their update() methods

2. THE config update SHALL be atomic:
   - All parameters update together
   - No partial updates that could cause inconsistencies

3. THE System SHALL log parameter changes:
   - Log old and new values on transition
   - Include phase name in log message

### Requirement 3: Entity Dynamic Behavior

**User Story:** As a simulator, I need entities to respect current config values so that behavioral changes take effect immediately.

#### Acceptance Criteria

1. THE Worker entity SHALL read these from config each tick:
   - `flee_radius`: For parasite proximity detection
   - `flee_duration`: For how long to stay in flee state
   - `worker_speed`: For movement calculations

2. THE Protector entity SHALL read these from config each tick:
   - `protector_speed`: For movement calculations
   - `detection_radius`: For parasite detection range
   - `kill_radius`: For parasite elimination range

3. THE entities SHALL NOT cache behavioral parameters:
   - Always read current config values
   - Changes take effect on next tick

### Requirement 4: Progressive Challenge Curriculum

**User Story:** As a trainer, I need a default curriculum that progressively challenges the NN so that it learns robust strategies.

#### Acceptance Criteria

1. THE default curriculum SHALL have 6 phases with progressive challenge:

   | Phase | Workers | Protectors | Prot Speed | Detection | Kill | Flee Radius | Flee Duration |
   |-------|---------|------------|------------|-----------|------|-------------|---------------|
   | beginner | 4 | 0 | 1.0 | 3 | 1 | 5 | 8 |
   | novice | 6 | 1 | 1.2 | 4 | 1 | 4 | 7 |
   | intermediate | 8 | 2 | 1.5 | 5 | 2 | 3 | 5 |
   | advanced | 10 | 3 | 1.7 | 5 | 2 | 3 | 4 |
   | expert | 12 | 4 | 1.8 | 6 | 2 | 2 | 3 |
   | master | 15 | 5 | 2.0 | 7 | 3 | 2 | 3 |

2. THE progression logic SHALL be:
   - **Protector speed**: Increases (less time for parasites to disrupt)
   - **Detection radius**: Increases (harder to avoid protectors)
   - **Kill radius**: Increases slightly (faster kills)
   - **Flee radius**: Decreases (braver workers, need better placement)
   - **Flee duration**: Decreases (workers recover faster)

3. THE master phase SHALL represent maximum challenge:
   - Fast protectors that quickly eliminate parasites
   - Large detection range (hard to place parasites safely)
   - Brave workers that require precise parasite placement

### Requirement 5: Observability

**User Story:** As a trainer, I need to see how the NN responds to challenge changes so that I can tune the curriculum.

#### Acceptance Criteria

1. THE System SHALL log phase transitions with full parameters:
   - All behavioral parameter values
   - Change from previous phase

2. THE dashboard metrics SHALL reflect challenge changes:
   - Entropy should vary as difficulty changes
   - Loss should increase when new challenges introduced
   - Confidence patterns should shift with difficulty

3. THE System SHALL support per-phase metrics collection:
   - Track performance within each phase
   - Enable analysis of NN adaptation to challenges
