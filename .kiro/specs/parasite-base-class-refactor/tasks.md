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

- [ ] 7. Update visual system for color abstraction
  - [ ] 7.1 Update mesh creation to use getColor()
    - Modify base class `createMesh()` to call `this.getColor()`
    - Apply color to material during segment creation
    - Remove hardcoded colors from subclasses
    - _Requirements: 5.4, 5.5_

  - [ ] 7.2 Verify visual differentiation
    - Test EnergyParasite renders yellow/gold
    - Test CombatParasite renders red
    - Test Queen renders purple
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 7.3 Write property test for color uniqueness
    - **Property 4: Color Uniqueness**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [ ] 8. Update exports and imports
  - [ ] 8.1 Update barrel exports
    - Add Parasite to `entities/index.ts` exports
    - Ensure EnergyParasite, CombatParasite, Queen exports unchanged
    - _Requirements: 8.5_

  - [ ] 8.2 Update imports across codebase
    - Update any files that import parasite classes
    - Verify ParasiteManager imports work correctly
    - Verify CombatSystem imports work correctly
    - _Requirements: 8.5_

- [ ] 9. Backward compatibility validation
  - [ ] 9.1 Run all existing parasite tests
    - Run `EnhancedParasiteSystemIntegration.test.ts`
    - Run `EnhancedParasiteSystemValidation.test.ts`
    - Run `CombatParasite.test.ts`
    - Run `ParasiteTypes.test.ts`
    - Fix any failing tests
    - _Requirements: 8.1_

  - [ ] 9.2 Verify spawn distribution unchanged
    - Test that 75% Energy / 25% Combat ratio maintained
    - Verify ParasiteManager creates correct types
    - _Requirements: 8.2_

  - [ ] 9.3 Verify combat values unchanged
    - Test EnergyParasite: 2 health, 2 energy reward
    - Test CombatParasite: 4 health, 4 energy reward
    - Test damage values identical to pre-refactor
    - _Requirements: 8.3, 8.4_

  - [ ]* 9.4 Write property test for spawn distribution
    - **Property 8: Backward Compatibility - Spawn Distribution**
    - **Validates: Requirements 8.2**

  - [ ]* 9.5 Write property test for combat values
    - **Property 9: Backward Compatibility - Combat Values**
    - **Validates: Requirements 8.3, 8.4**

- [ ] 10. Performance validation
  - [ ] 10.1 Run performance benchmarks
    - Test with 10+ parasites of mixed types
    - Verify 60fps maintained
    - Compare memory usage before/after refactor
    - _Requirements: 3.5, 8.1_

  - [ ]* 10.2 Write property test for performance maintenance
    - **Property 10: Performance Maintenance**
    - **Validates: Requirements 3.5, 8.1**

- [ ] 11. Checkpoint - Refactor complete
  - All existing tests pass
  - Visual appearance identical to pre-refactor
  - Movement and animation behavior identical
  - Spawn distribution (75/25) maintained
  - Combat values (health, damage, rewards) maintained
  - 60fps performance maintained
  - Ask the user if questions arise

- [ ] 12. Code cleanup
  - [ ] 12.1 Remove dead code
    - Delete any unused methods from subclasses
    - Remove commented-out duplicated code
    - Clean up unused imports
    - _Requirements: 1.2, 1.3_

  - [ ] 12.2 Add documentation
    - Add JSDoc to Parasite base class
    - Document abstract methods and their contracts
    - Add inline comments for non-obvious behavior
    - _Requirements: 1.1_

- [ ] 13. Final checkpoint - Production ready
  - Code review complete
  - All tests pass (existing + new property tests)
  - Documentation complete
  - No performance regression
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
