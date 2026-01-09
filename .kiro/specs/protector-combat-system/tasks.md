# Implementation Plan: Protector Combat System

## Overview

This implementation plan builds upon the existing environmental combat foundation (Energy Parasites vs Workers/Protectors) to create a comprehensive player-initiated combat system. The current codebase already has basic Protector attack capabilities and parasite interactions, but lacks the centralized combat system, UI feedback, and comprehensive target validation required by the design.

## Tasks

- [x] 1. Create core CombatSystem class and infrastructure
  - Create `client/src/game/CombatSystem.ts` with central combat coordinator
  - Implement `CombatAction` class for tracking ongoing combat actions
  - Integrate CombatSystem with GameEngine and existing managers
  - _Requirements: 1.1, 6.1, 6.2, 6.3, 6.5_

- [ ] 2. Implement target validation and selection system
  - [ ] 2.1 Create `CombatTarget` interface implementation for Energy Parasites
    - Extend EnergyParasite to implement CombatTarget interface
    - Add health tracking and damage methods
    - _Requirements: 2.3_

  - [ ] 2.2 Implement target validation logic in CombatSystem
    - Create `validateTarget()` method with range, type, and energy checks
    - Implement friendly unit rejection logic
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

  - [ ] 2.3 Write property test for target validation
    - **Property 5: Target Classification Accuracy**
    - **Validates: Requirements 2.3, 2.4, 2.5**

- [ ] 3. Implement combat range and movement mechanics
  - [ ] 3.1 Enhance Protector class with combat range validation
    - Add `isInCombatRange()` method using design specifications
    - Implement movement-to-range logic for out-of-range targets
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 3.2 Implement dynamic target pursuit system
    - Add target tracking during movement
    - Handle moving targets during protector approach
    - _Requirements: 3.4_

  - [ ] 3.3 Write property test for range-based combat behavior
    - **Property 6: Range-Based Combat Behavior**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ] 3.4 Write property test for dynamic target pursuit
    - **Property 7: Dynamic Target Pursuit**
    - **Validates: Requirements 3.4**

- [ ] 4. Implement energy-based combat economics
  - [ ] 4.1 Integrate combat energy costs with EnergyManager
    - Update Protector attack methods to use global energy system
    - Implement 5 energy per attack cost as specified
    - _Requirements: 4.1, 1.4_

  - [ ] 4.2 Implement energy reward system for target destruction
    - Add 10 energy reward for Energy Parasite destruction
    - Integrate rewards with EnergyManager
    - _Requirements: 4.2_

  - [ ] 4.3 Add energy validation and shortage feedback
    - Prevent attacks when insufficient energy available
    - Add energy shortage UI feedback
    - _Requirements: 1.5, 4.4, 4.5_

  - [ ] 4.4 Write property test for energy consumption
    - **Property 3: Energy Consumption Per Attack**
    - **Validates: Requirements 1.4, 4.1**

  - [ ] 4.5 Write property test for energy validation
    - **Property 4: Energy Validation Prevents Attacks**
    - **Validates: Requirements 1.5, 4.4**

  - [ ] 4.6 Write property test for energy rewards
    - **Property 8: Energy Reward Consistency**
    - **Validates: Requirements 4.2, 4.3**

- [ ] 5. Create combat UI and visual feedback system
  - [ ] 5.1 Create CombatUI class for user interface elements
    - Implement attack cursor states (valid/invalid target)
    - Add combat range indicators for selected protectors
    - Create energy cost preview displays
    - _Requirements: 2.1, 2.2, 2.6, 3.5, 5.5_

  - [ ] 5.2 Implement combat visual effects
    - Create energy beam effects for protector attacks
    - Add damage effects on targets
    - Implement destruction effects and target removal
    - Add floating energy gain/loss numbers
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 5.3 Write property test for comprehensive UI feedback
    - **Property 9: Comprehensive UI Feedback**
    - **Validates: Requirements 2.1, 2.2, 2.6, 3.5, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5**

- [ ] 6. Implement combat state management and coordination
  - [ ] 6.1 Add multi-protector damage coordination
    - Handle multiple protectors attacking same target
    - Implement proper damage accumulation
    - _Requirements: 6.1_

  - [ ] 6.2 Implement combat state cleanup systems
    - Cancel pending attacks when targets are destroyed
    - Clean up combat state when protectors are destroyed
    - Handle combat interruption scenarios gracefully
    - _Requirements: 6.2, 6.3, 6.5_

  - [ ] 6.3 Write property test for multi-protector coordination
    - **Property 10: Multi-Protector Damage Coordination**
    - **Validates: Requirements 6.1**

  - [ ] 6.4 Write property test for target destruction cleanup
    - **Property 11: Target Destruction Cleanup**
    - **Validates: Requirements 6.2**

  - [ ] 6.5 Write property test for protector destruction cleanup
    - **Property 12: Protector Destruction Cleanup**
    - **Validates: Requirements 6.3**

  - [ ] 6.6 Write property test for combat interruption handling
    - **Property 13: Combat Interruption Handling**
    - **Validates: Requirements 6.5**

- [ ] 7. Integrate combat system with existing game systems
  - [ ] 7.1 Update GameEngine to initialize and manage CombatSystem
    - Add CombatSystem initialization in GameEngine
    - Integrate combat updates in main game loop
    - _Requirements: 6.4_

  - [ ] 7.2 Update UnitManager to handle combat commands
    - Add 'attack' command type to command system
    - Integrate combat target selection with mouse interaction
    - _Requirements: 1.1_

  - [ ] 7.3 Update ParasiteManager for combat integration
    - Ensure proper integration with new CombatSystem
    - Maintain existing environmental combat functionality
    - _Requirements: 1.2_

- [ ] 8. Checkpoint - Core combat system functional
  - Ensure all core combat mechanics work together
  - Verify energy costs and rewards function correctly
  - Test protector-parasite combat interactions
  - Ask the user if questions arise

- [ ] 9. Performance optimization and testing
  - [ ] 9.1 Implement performance monitoring for combat scenarios
    - Add combat-specific performance metrics
    - Ensure 60fps during active combat scenarios
    - _Requirements: 6.4_

  - [ ] 9.2 Write unit tests for combat edge cases
    - Test boundary conditions and error scenarios
    - Test integration points between combat and other systems

- [ ] 10. Final integration and validation
  - [ ] 10.1 Complete end-to-end combat flow testing
    - Test full combat scenarios from target selection to destruction
    - Validate all visual feedback and UI elements
    - _Requirements: All requirements_

  - [ ] 10.2 Final performance validation and optimization
    - Ensure all performance requirements are met
    - Optimize any performance bottlenecks discovered
    - _Requirements: 6.4_

- [ ] 11. Final checkpoint - Complete combat system
  - Ensure all requirements are implemented and tested
  - Verify comprehensive combat system functionality
  - Ask the user if questions arise

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation builds incrementally on existing environmental combat foundation
- Current Protector class already has basic attack capabilities that will be enhanced
- Current ParasiteManager handles basic combat interactions that will be integrated