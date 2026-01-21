# Implementation Plan: Parasite Base Class Refactor

## Overview

This implementation plan refactors the parasite entity hierarchy to introduce an abstract `Parasite` base class. The refactor consolidates ~300 lines of duplicated movement, animation, and patrol code from EnergyParasite, CombatParasite, and Queen into a single base class. Each subclass will only define what makes it unique: color, targeting behavior, and special abilities.

## Tasks

- [x] 1. Create abstract Parasite base class
  - [x] 1.1 Create new file `client/src/game/entities/Parasite.ts`
    - Define abstract class implementing CombatTarget interface
    - Add shared properties: id, position, health, maxHealth, speed, isMoving, facingAngle
    - Add patrol properties: territoryCenter, patrolRadius, patrolTarget, patrolPauseTime
    - Add visual properties: segments, parentNode, scene
    - Declare abstract methods: `getColor()`, `getTargetPriority()`
    - _Requirements: 1.1, 1.2, 1.5_

  - [x] 1.2 Implement shared movement in base class
    - Extract `moveTowards()` from EnergyParasite into base class
    - Implement direction calculation and position update
    - Add `isMoving` state tracking and facing angle calculation
    - Add `applyRotationToSegments()` helper method
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.3 Implement shared segment animation in base class
    - Extract `updateSegmentAnimation()` from EnergyParasite into base class
    - Implement wave motion calculation with time-based offset
    - Add segment trailing based on movement direction
    - Add configurable methods: `getSegmentSpacing()`, `getSegmentCount()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.4 Implement shared patrol behavior in base class
    - Extract `updatePatrolling()` from EnergyParasite into base class
    - Implement patrol pause state machine
    - Extract `generatePatrolTarget()` into base class (virtual for override)
    - Add configurable patrol radius and pause duration
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x]* 1.5 Write property test for movement consistency
    - **Property 1: Movement Consistency**
    - **Validates: Requirements 2.1, 2.3, 2.5**

  - [x]* 1.6 Write property test for animation uniformity
    - **Property 2: Animation Uniformity**
    - **Validates: Requirements 3.1, 3.2, 3.4**

- [x] 2. Refactor EnergyParasite to extend Parasite
  - [x] 2.1 Update EnergyParasite class declaration
    - Change `implements CombatTarget` to `extends Parasite`
    - Remove duplicated movement, animation, and patrol code
    - Keep energy-specific targeting and drain behavior
    - _Requirements: 1.2, 1.3, 6.1_

  - [x] 2.2 Implement abstract methods in EnergyParasite
    - Implement `getColor()` returning yellow/gold Color3
    - Implement `getTargetPriority()` returning [TargetType.WORKER]
    - _Requirements: 5.1, 6.1_

  - [x] 2.3 Preserve EnergyParasite-specific behavior
    - Keep `drainEnergy()` method
    - Keep worker-only targeting logic in `updateTargeting()`
    - Ensure `ParasiteState` transitions work correctly
    - _Requirements: 6.1, 8.1_

  - [x]* 2.4 Write property test for EnergyParasite worker-only targeting
    - **Property 6: EnergyParasite Worker-Only Targeting**
    - **Validates: Requirements 6.1, 6.4**

- [x] 3. Refactor CombatParasite to extend Parasite
  - [x] 3.1 Update CombatParasite class declaration
    - Change `extends EnergyParasite` to `extends Parasite`
    - Remove duplicated movement and animation code
    - Keep combat-specific targeting and aggression behavior
    - _Requirements: 1.2, 1.3, 6.2_

  - [x] 3.2 Implement abstract methods in CombatParasite
    - Implement `getColor()` returning red Color3
    - Implement `getTargetPriority()` returning [TargetType.PROTECTOR, TargetType.WORKER]
    - _Requirements: 5.2, 6.2_

  - [x] 3.3 Preserve CombatParasite-specific behavior
    - Keep protector-first targeting logic
    - Keep aggression level and enhanced patrol pattern
    - Override `generatePatrolTarget()` for aggressive movement
    - _Requirements: 6.2, 8.1, 8.3_

  - [x]* 3.4 Write property test for targeting hierarchy
    - **Property 5: Targeting Hierarchy**
    - **Validates: Requirements 6.2, 6.4**

- [x] 4. Refactor Queen to extend Parasite
  - [x] 4.1 Update Queen class declaration
    - Change `implements CombatTarget` to `extends Parasite`
    - Remove duplicated movement, animation, and patrol code
    - Keep Queen-specific spawning and hive management
    - _Requirements: 1.2, 1.3, 7.1_

  - [x] 4.2 Implement abstract methods in Queen
    - Implement `getColor()` returning purple Color3
    - Implement `getTargetPriority()` returning [TargetType.WORKER, TargetType.PROTECTOR]
    - _Requirements: 5.3, 6.3_

  - [x] 4.3 Override configurable methods for Queen size
    - Override `getSegmentCount()` to return 12 (larger)
    - Override `getSegmentSpacing()` to return 0.5 (wider)
    - Override patrol radius for larger territory
    - _Requirements: 3.4, 4.3_

  - [x] 4.4 Preserve Queen-specific behavior
    - Keep `spawnParasites()` method
    - Keep hive position management
    - Keep spawn cooldown and interval logic
    - _Requirements: 7.1, 7.2, 7.4_

  - [x]* 4.5 Write property test for patrol territory bounds
    - **Property 3: Patrol Territory Bounds**
    - **Validates: Requirements 4.2, 4.3, 4.5**

- [x] 5. Verify AdaptiveQueen inheritance chain
  - [x] 5.1 Update AdaptiveQueen if needed
    - Verify AdaptiveQueen still extends Queen correctly
    - Ensure AI learning features work with new base class
    - Test full inheritance chain: Parasite → Queen → AdaptiveQueen
    - _Requirements: 7.3, 7.5_

  - [x]* 5.2 Write property test for Queen inheritance chain
    - **Property 7: Queen Inheritance Chain**
    - **Validates: Requirements 7.3, 7.5**

- [x] 6. Checkpoint - Base refactor complete
  - Verify all three parasite types extend Parasite base class
  - Confirm shared movement, animation, and patrol code is in base class only
  - Run existing unit tests for EnergyParasite, CombatParasite, Queen
  - Verify no TypeScript compilation errors
  - Ask the user if questions arise

- [x] 7. Consolidate roaming/patrol to single implementation
  - [x] 7.1 Update base class with Queen's roaming approach
    - Replace `updatePatrolling()` with `updateRoaming()` in Parasite base class
    - Use direct `parentNode.position` updates (no position sync issues)
    - Include proper movement ratio calculation: `Math.min(moveDistance / distance, 1)`
    - Get terrain height at new position before moving
    - Add `updateTerrainSlope()` for pitch/roll following
    - _Requirements: 2.1, 2.2, 4.1_

  - [x] 7.2 Update EnergyParasite to use base roaming
    - Remove `updatePatrollingWithWorkers()` custom implementation
    - Call `updateRoaming()` from base class
    - Keep worker detection logic separate from movement
    - _Requirements: 2.5, 4.4_

  - [x] 7.3 Update CombatParasite to use base roaming
    - Remove `updateCombatPatrolling()` custom implementation
    - Remove `moveTowardsEnhanced()` duplicate method
    - Call `updateRoaming()` from base class
    - Override `generatePatrolTarget()` for aggression-based range
    - Keep protector/worker detection logic separate from movement
    - _Requirements: 2.5, 4.4_

  - [x] 7.4 Simplify Queen to use base roaming
    - Remove custom `updateRoaming()` from Queen (now in base class)
    - Override `generatePatrolTarget()` to patrol around hive position
    - Keep hive-specific logic (spawning, phases)
    - _Requirements: 2.5, 4.4_

- [x] 8. Checkpoint - Roaming consolidation complete
  - All parasites use single `updateRoaming()` from base class
  - Movement is smooth and consistent across all types
  - Terrain following works for all parasites
  - Patrol patterns work correctly (random for Energy/Combat, around hive for Queen)
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property tests and can be skipped for faster implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation of the refactor
- The refactor should NOT change any external behavior - only internal structure
- Key risk: CombatParasite currently extends EnergyParasite, will now extend Parasite directly
  - Any EnergyParasite methods used by CombatParasite must be moved to Parasite base class
  - Or CombatParasite must re-implement them if they are energy-specific
- Run tests frequently during refactor to catch regressions early
- Preserve git history by committing after each major task group
