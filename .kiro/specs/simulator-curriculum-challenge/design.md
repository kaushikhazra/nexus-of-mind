# Simulator Curriculum Challenge - Design

## Overview

This document describes the technical design for extending the curriculum system to vary behavioral parameters, creating progressive challenges for the Queen NN training.

**Core Principle: Challenge the NN to Generalize**

By varying not just entity counts but also behavioral parameters (speeds, radiuses), we force the NN to learn robust strategies that work across different "player skill levels" rather than overfitting to a single configuration.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CURRICULUM CHALLENGE SYSTEM                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      CurriculumPhase (Extended)                      │   │
│  │                                                                      │   │
│  │   name: str              num_workers: int      num_protectors: int   │   │
│  │   duration: int                                                      │   │
│  │   ─────────────────────────────────────────────────────────────────  │   │
│  │   NEW BEHAVIORAL PARAMETERS:                                         │   │
│  │   protector_speed: Optional[float]    detection_radius: Optional[int]│   │
│  │   kill_radius: Optional[int]          flee_radius: Optional[int]     │   │
│  │   flee_duration: Optional[int]        worker_speed: Optional[float]  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ Phase Transition                       │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Simulator._apply_phase_config()                 │   │
│  │                                                                      │   │
│  │   1. Adjust entity counts (existing)                                 │   │
│  │   2. NEW: Update config behavioral parameters                        │   │
│  │      - self.config.protector_speed = phase.protector_speed          │   │
│  │      - self.config.detection_radius = phase.detection_radius        │   │
│  │      - etc.                                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ Entities read config each tick         │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Entity Behavior                              │   │
│  │                                                                      │   │
│  │   Worker.update():                    Protector.update():            │   │
│  │   - uses config.flee_radius           - uses config.protector_speed  │   │
│  │   - uses config.flee_duration         - uses config.detection_radius │   │
│  │   - uses config.worker_speed          - uses config.kill_radius      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Extended CurriculumPhase

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class CurriculumPhase:
    """Configuration for a curriculum learning phase with behavioral parameters."""
    name: str
    duration: int  # Ticks (-1 for infinite)
    num_workers: int
    num_protectors: int

    # Behavioral parameters (None = use base config default)
    protector_speed: Optional[float] = None
    detection_radius: Optional[int] = None
    kill_radius: Optional[int] = None
    flee_radius: Optional[int] = None
    flee_duration: Optional[int] = None
    worker_speed: Optional[float] = None

    def __post_init__(self):
        """Validate phase configuration."""
        if self.duration < -1 or self.duration == 0:
            raise ValueError(f"Invalid duration {self.duration}")
        if self.num_workers < 0:
            raise ValueError(f"Invalid num_workers {self.num_workers}")
        if self.num_protectors < 0:
            raise ValueError(f"Invalid num_protectors {self.num_protectors}")

        # Validate optional behavioral parameters
        if self.protector_speed is not None and self.protector_speed <= 0:
            raise ValueError(f"protector_speed must be positive")
        if self.detection_radius is not None and self.detection_radius < 0:
            raise ValueError(f"detection_radius must be non-negative")
        if self.kill_radius is not None and self.kill_radius < 0:
            raise ValueError(f"kill_radius must be non-negative")
        if self.flee_radius is not None and self.flee_radius < 0:
            raise ValueError(f"flee_radius must be non-negative")
        if self.flee_duration is not None and self.flee_duration <= 0:
            raise ValueError(f"flee_duration must be positive")
        if self.worker_speed is not None and self.worker_speed <= 0:
            raise ValueError(f"worker_speed must be positive")
```

### 2. Updated Simulator._apply_phase_config()

```python
def _apply_phase_config(self, phase: CurriculumPhase) -> None:
    """Apply curriculum phase configuration to simulation."""
    state = self.state

    # --- Existing: Adjust entity counts ---
    # Workers
    current_workers = len(state.workers)
    if phase.num_workers > current_workers:
        # Add workers...
        pass
    elif phase.num_workers < current_workers:
        # Remove workers...
        pass

    # Protectors (similar logic)
    # ...

    # --- NEW: Apply behavioral parameters ---
    if phase.protector_speed is not None:
        logger.info(f"  protector_speed: {self.config.protector_speed} -> {phase.protector_speed}")
        self.config.protector_speed = phase.protector_speed

    if phase.detection_radius is not None:
        logger.info(f"  detection_radius: {self.config.detection_radius} -> {phase.detection_radius}")
        self.config.detection_radius = phase.detection_radius

    if phase.kill_radius is not None:
        logger.info(f"  kill_radius: {self.config.kill_radius} -> {phase.kill_radius}")
        self.config.kill_radius = phase.kill_radius

    if phase.flee_radius is not None:
        logger.info(f"  flee_radius: {self.config.flee_radius} -> {phase.flee_radius}")
        self.config.flee_radius = phase.flee_radius

    if phase.flee_duration is not None:
        logger.info(f"  flee_duration: {self.config.flee_duration} -> {phase.flee_duration}")
        self.config.flee_duration = phase.flee_duration

    if phase.worker_speed is not None:
        logger.info(f"  worker_speed: {self.config.worker_speed} -> {phase.worker_speed}")
        self.config.worker_speed = phase.worker_speed
```

### 3. Entity Behavior (Already Dynamic)

The entities already read config values in their update() methods. No changes needed to entities.py - they already use `config.flee_radius`, `config.protector_speed`, etc. from the passed config object.

```python
# Worker.update() - already reads config dynamically
def update(self, parasites: List['Parasite'], config: 'SimulationConfig') -> float:
    # ...
    if nearest_parasite and self.distance_to(nearest_parasite.chunk) < config.flee_radius:
        self.state = WorkerState.FLEEING
        self.flee_timer = config.flee_duration
        # ...

# Protector.update() - already reads config dynamically
def update(self, parasites: List['Parasite'], config: 'SimulationConfig') -> Optional['Parasite']:
    # ...
    if self.distance_to(parasite.chunk) < config.detection_radius:
        # ...
    self.move_toward(self.chase_target.chunk, config.protector_speed)
    if self.distance_to(self.chase_target.chunk) < config.kill_radius:
        # ...
```

### 4. Updated Default Curriculum

```python
def create_default_curriculum() -> List[CurriculumPhase]:
    """
    Create curriculum with progressive behavioral challenge.

    Challenge progression:
    - Protector speed: 1.0 -> 2.0 (faster = less disruption time)
    - Detection radius: 3 -> 7 (larger = harder to hide parasites)
    - Kill radius: 1 -> 3 (larger = faster kills)
    - Flee radius: 5 -> 2 (smaller = braver workers, need precise placement)
    - Flee duration: 8 -> 3 (shorter = workers recover faster)
    """
    return [
        # Phase 1: Beginner - Easy for NN to learn basics
        CurriculumPhase(
            name="beginner",
            duration=2000,
            num_workers=4,
            num_protectors=0,
            protector_speed=1.0,
            detection_radius=3,
            kill_radius=1,
            flee_radius=5,
            flee_duration=8,
        ),
        # Phase 2: Novice - Introduce light defense
        CurriculumPhase(
            name="novice",
            duration=3000,
            num_workers=6,
            num_protectors=1,
            protector_speed=1.2,
            detection_radius=4,
            kill_radius=1,
            flee_radius=4,
            flee_duration=7,
        ),
        # Phase 3: Intermediate - Balanced challenge
        CurriculumPhase(
            name="intermediate",
            duration=4000,
            num_workers=8,
            num_protectors=2,
            protector_speed=1.5,
            detection_radius=5,
            kill_radius=2,
            flee_radius=3,
            flee_duration=5,
        ),
        # Phase 4: Advanced - Stronger defense
        CurriculumPhase(
            name="advanced",
            duration=5000,
            num_workers=10,
            num_protectors=3,
            protector_speed=1.7,
            detection_radius=5,
            kill_radius=2,
            flee_radius=3,
            flee_duration=4,
        ),
        # Phase 5: Expert - High challenge
        CurriculumPhase(
            name="expert",
            duration=6000,
            num_workers=12,
            num_protectors=4,
            protector_speed=1.8,
            detection_radius=6,
            kill_radius=2,
            flee_radius=2,
            flee_duration=3,
        ),
        # Phase 6: Master - Maximum challenge
        CurriculumPhase(
            name="master",
            duration=-1,
            num_workers=15,
            num_protectors=5,
            protector_speed=2.0,
            detection_radius=7,
            kill_radius=3,
            flee_radius=2,
            flee_duration=3,
        ),
    ]
```

## Challenge Mechanics Explained

### Why These Parameters Matter for NN Training

| Parameter | Low Value (Easy) | High Value (Hard) | NN Learning Impact |
|-----------|------------------|-------------------|-------------------|
| protector_speed | Slow (1.0) | Fast (2.0) | Parasites live longer vs shorter; NN must learn timing |
| detection_radius | Small (3) | Large (7) | Easy to place parasites vs must find gaps |
| kill_radius | Small (1) | Large (3) | More warning before kill vs sudden death |
| flee_radius | Large (5) | Small (2) | Workers scatter easily vs need precise placement |
| flee_duration | Long (8) | Short (3) | Disruption lasts vs workers recover fast |

### Expected NN Behavior Changes

1. **Beginner Phase**: NN learns that spawning parasites near workers causes disruption
2. **Novice Phase**: NN learns to avoid protector patrol areas
3. **Intermediate Phase**: NN develops timing - when to spawn vs wait
4. **Advanced Phase**: NN learns spatial optimization - where protectors can't reach quickly
5. **Expert Phase**: NN develops precision - exact placement to maximize disruption before kill
6. **Master Phase**: NN operates at maximum efficiency, having learned all patterns

## Files to Modify

```
server/game_simulator/
├── curriculum.py      # Extend CurriculumPhase, update create_default_curriculum()
├── simulator.py       # Update _apply_phase_config() to set behavioral params
├── entities.py        # No changes needed (already reads config dynamically)
├── config.py          # No changes needed (already has all parameters)
```

## Verification Strategy

1. **Unit Tests**: Verify phase transitions update config values
2. **Integration Test**: Run simulation, verify entities behave differently per phase
3. **Dashboard Observation**: Monitor entropy/loss/confidence across phase transitions
4. **Expected Patterns**:
   - Entropy should spike when entering harder phases (more uncertainty)
   - Loss may increase temporarily as NN adapts
   - Confidence should stabilize after adaptation period
