# Parasite Base Class Refactor - Requirements Document

## Introduction

This specification refactors the parasite entity hierarchy to introduce an abstract base `Parasite` class that consolidates shared behavior across all parasite types (EnergyParasite, CombatParasite, Queen). Currently, movement, roaming, patrol logic, and segment animation are duplicated across these classes. This refactor centralizes common functionality while preserving each type's unique targeting, color, and special abilities.

## Glossary

- **Parasite**: Abstract base class containing shared movement, roaming, and animation behavior
- **EnergyParasite**: Parasite type that targets workers to leach energy (yellow/gold color)
- **CombatParasite**: Parasite type that targets both workers and protectors (red color)
- **Queen**: Apex parasite that can target all units and spawn other parasites (purple color)
- **Segment_Animation**: Wave-like body animation shared by all parasite types
- **Patrol_Behavior**: Roaming movement pattern within a defined territory radius
- **Target_Priority**: The order in which a parasite type selects targets

## Requirements

### Requirement 1: Abstract Parasite Base Class

**User Story:** As a developer, I want a single base class containing shared parasite behavior, so that movement, animation, and patrol logic are maintained in one place without duplication.

#### Acceptance Criteria

1. WHEN the Parasite base class is created, THE System SHALL define it as abstract (cannot be instantiated directly)
2. WHEN a parasite subclass is created, THE System SHALL inherit all movement logic from the base class
3. WHEN a parasite subclass is created, THE System SHALL inherit all segment animation logic from the base class
4. WHEN a parasite subclass is created, THE System SHALL inherit all patrol/roaming behavior from the base class
5. THE Parasite base class SHALL implement the CombatTarget interface for combat system compatibility

### Requirement 2: Shared Movement System

**User Story:** As a developer, I want all parasites to share the same movement implementation, so that movement behavior is consistent and bugs are fixed in one place.

#### Acceptance Criteria

1. WHEN any parasite moves, THE System SHALL use the base class `moveTowards()` method
2. WHEN movement speed varies by type, THE System SHALL allow subclasses to define speed via property or constructor
3. WHEN a parasite moves, THE System SHALL update facing direction based on movement vector
4. WHEN a parasite moves, THE System SHALL track `isMoving` state for animation purposes
5. THE Movement system SHALL maintain existing movement feel and responsiveness

### Requirement 3: Shared Segment Animation

**User Story:** As a developer, I want all parasites to share the same wave animation system, so that visual consistency is maintained and animation code exists in one place.

#### Acceptance Criteria

1. WHEN any parasite animates, THE System SHALL use the base class `updateSegmentAnimation()` method
2. WHEN segments animate, THE System SHALL apply wave motion based on time and movement state
3. WHEN segments trail behind, THE System SHALL calculate positions relative to movement direction
4. WHEN animation parameters differ by type, THE System SHALL allow subclasses to override via properties
5. THE Animation system SHALL maintain 60fps performance with multiple active parasites

### Requirement 4: Shared Patrol Behavior

**User Story:** As a developer, I want all parasites to share the same patrol/roaming logic, so that territorial behavior is consistent across all types.

#### Acceptance Criteria

1. WHEN any parasite patrols, THE System SHALL use the base class patrol state machine
2. WHEN a parasite reaches patrol target, THE System SHALL generate a new target within territory
3. WHEN patrol radius varies by type, THE System SHALL allow subclasses to configure radius
4. WHEN a parasite pauses at patrol points, THE System SHALL use configurable pause duration
5. THE Patrol system SHALL maintain existing territorial boundaries and behavior

### Requirement 5: Subclass Color Differentiation

**User Story:** As a player, I want each parasite type to have a distinct color, so that I can quickly identify threats and make tactical decisions.

#### Acceptance Criteria

1. WHEN an EnergyParasite spawns, THE System SHALL render it with yellow/gold coloring
2. WHEN a CombatParasite spawns, THE System SHALL render it with red coloring
3. WHEN a Queen spawns, THE System SHALL render it with purple coloring
4. WHEN subclasses define color, THE System SHALL use abstract method or property override
5. THE Visual system SHALL apply colors during mesh creation in base class

### Requirement 6: Subclass Targeting Behavior

**User Story:** As a player, I want each parasite type to have unique targeting priorities, so that different parasites create varied tactical challenges.

#### Acceptance Criteria

1. WHEN an EnergyParasite selects targets, THE System SHALL prioritize workers only
2. WHEN a CombatParasite selects targets, THE System SHALL prioritize protectors, then workers
3. WHEN a Queen selects targets, THE System SHALL target workers and protectors
4. WHEN subclasses define targeting, THE System SHALL override base class targeting methods
5. THE Targeting system SHALL maintain existing detection ranges and engagement logic

### Requirement 7: Queen Spawning Capability

**User Story:** As a player, I want the Queen to retain its unique ability to spawn other parasites, so that the Queen remains the apex threat in the parasite hierarchy.

#### Acceptance Criteria

1. WHEN a Queen is active, THE System SHALL retain all spawning logic in the Queen subclass
2. WHEN a Queen spawns parasites, THE System SHALL use existing spawn rules and timing
3. WHEN the Queen class extends Parasite, THE System SHALL not break AdaptiveQueen inheritance
4. WHEN Queen-specific behavior exists, THE System SHALL keep it in Queen class (not base)
5. THE Queen hierarchy SHALL remain: Parasite → Queen → AdaptiveQueen

### Requirement 8: Backward Compatibility

**User Story:** As a developer, I want the refactor to maintain all existing functionality, so that gameplay is unchanged after the refactor.

#### Acceptance Criteria

1. WHEN the refactor is complete, THE System SHALL pass all existing parasite tests
2. WHEN parasites spawn, THE System SHALL maintain existing spawn distribution (75/25)
3. WHEN parasites engage in combat, THE System SHALL maintain existing damage and reward values
4. WHEN parasites are destroyed, THE System SHALL maintain existing cleanup behavior
5. THE Refactored system SHALL require no changes to ParasiteManager or other external systems
