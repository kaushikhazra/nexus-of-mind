# Implementation Plan: Protector Combat System

## Overview

This implementation plan transforms the existing manual target selection combat system into an intuitive movement-based auto-attack system. The current codebase has manual combat capabilities, but needs to be refactored to support click-to-move commands with automatic enemy detection and engagement within a 10-unit detection range.

## Tasks

- [x] 1. Refactor CombatSystem for movement-based auto-attack
  - Update `client/src/game/CombatSystem.ts` to support auto-detection
  - Add `detectNearbyEnemies()` method with 10-unit detection range
  - Implement `initiateAutoAttack()` for automatic enemy engagement
  - Add movement resumption logic after combat completion
  - _Requirements: 1.1, 2.1, 2.2, 3.4_

- [-] 2. Implement automatic enemy detection system
  - [x] 2.1 Add detection range validation to CombatSystem
    - Implement 10-unit detection range (larger than 8-unit combat range)
    - Add enemy detection during protector movement
    - _Requirements: 2.1, 3.5_

  - [x] 2.2 Implement target prioritization logic
    - Add closest-enemy prioritization when multiple enemies detected
    - Ensure consistent target selection behavior
    - _Requirements: 2.2_

  - [x] 2.3 Update target validation for auto-detection
    - Maintain existing target validation logic for auto-detected enemies
    - Ensure friendly unit rejection during auto-detection
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 2.4 Write property test for automatic enemy detection
    - **Property 2: Automatic Enemy Detection**
    - **Validates: Requirements 2.1**

  - [x] 2.5 Write property test for target prioritization
    - **Property 3: Target Prioritization Consistency**
    - **Validates: Requirements 2.2**

- [x] 3. Refactor Protector class for movement-based combat
  - [x] 3.1 Add movement command handling
    - Implement `moveToLocation()` method for click-to-move commands
    - Add `originalDestination` tracking for movement resumption
    - _Requirements: 1.1_

  - [x] 3.2 Implement auto-detection during movement
    - Add `detectNearbyEnemies()` method with 10-unit range
    - Integrate detection checks during movement updates
    - _Requirements: 2.1, 3.5_

  - [x] 3.3 Add automatic engagement logic
    - Implement `autoEngageTarget()` for seamless combat transition
    - Add combat state management (moving → detecting → engaging → attacking)
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.4 Implement movement resumption after combat
    - Add `resumeOriginalMovement()` method
    - Handle movement continuation after target destruction or escape
    - _Requirements: 3.4, 2.6_

  - [x] 3.5 Write property test for movement command execution
    - **Property 1: Movement Command Execution**
    - **Validates: Requirements 1.1**

  - [x] 3.6 Write property test for range-based engagement
    - **Property 8: Range-Based Engagement Behavior**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 3.7 Write property test for movement resumption
    - **Property 9: Movement Resumption After Combat**
    - **Validates: Requirements 3.4, 2.6**

- [x] 4. Update energy-based combat economics for auto-attack
  - [x] 4.1 Ensure energy validation works with auto-attack
    - Verify 5 energy per attack cost during auto-engagement
    - Prevent auto-attack when insufficient energy but allow movement
    - _Requirements: 4.1, 1.4, 1.6_

  - [x] 4.2 Maintain energy reward system
    - Keep existing 10 energy reward for Energy Parasite destruction
    - Ensure rewards work with auto-attack system
    - _Requirements: 4.2_

  - [x] 4.3 Update energy shortage feedback for auto-attack
    - Modify energy shortage UI for auto-attack scenarios
    - Show feedback when auto-attack is prevented by low energy
    - _Requirements: 1.6, 4.4, 4.5_

  - [x] 4.4 Write property test for energy consumption in auto-attack
    - **Property 5: Energy Consumption Per Attack**
    - **Validates: Requirements 1.4, 4.1**

  - [x] 4.5 Write property test for energy validation with movement
    - **Property 6: Energy Validation Prevents Attacks**
    - **Validates: Requirements 1.6, 4.4**

  - [x] 4.6 Write property test for energy rewards
    - **Property 11: Energy Reward Consistency**
    - **Validates: Requirements 4.2, 4.3**

- [x] 5. Update combat UI for movement-based auto-attack system
  - [x] 5.1 Refactor CombatUI for movement-based interface
    - Replace attack cursors with movement destination indicators
    - Add detection range visualization (10 units) for selected protectors
    - Keep combat range indicators (8 units) for reference
    - Add auto-engagement status displays
    - _Requirements: 5.1, 5.6_

  - [x] 5.2 Add enemy detection visual feedback
    - Create detection indicators when enemies are spotted
    - Add enemy highlighting during auto-engagement
    - Implement engagement transition visual effects
    - _Requirements: 5.1_

  - [x] 5.3 Maintain existing combat visual effects
    - Keep energy beam effects for protector attacks
    - Maintain damage effects and destruction animations
    - Keep floating energy gain/loss numbers
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 5.4 Write property test for comprehensive visual feedback
    - **Property 12: Comprehensive Visual Feedback**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

- [x] 6. Update combat state management for auto-attack system
  - [x] 6.1 Enhance CombatAction class for movement integration
    - Add movement states: 'moving' | 'detecting' | 'engaging' | 'attacking' | 'resuming_movement'
    - Add `originalDestination` tracking
    - Add `detectionTriggered` flag
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [x] 6.2 Update multi-protector coordination for auto-attack
    - Ensure multiple protectors can auto-engage same target
    - Maintain proper damage accumulation during auto-attack
    - _Requirements: 6.1_

  - [x] 6.3 Update combat cleanup for movement resumption
    - Ensure protectors resume movement after target destruction
    - Handle cleanup when protectors are destroyed during auto-attack
    - _Requirements: 6.2, 6.3_

  - [x] 6.4 Write property test for multi-protector coordination
    - **Property 13: Multi-Protector Damage Coordination**
    - **Validates: Requirements 6.1**

  - [x] 6.5 Write property test for target destruction cleanup
    - **Property 14: Target Destruction Cleanup**
    - **Validates: Requirements 6.2**

  - [x] 6.6 Write property test for protector destruction cleanup
    - **Property 15: Protector Destruction Cleanup**
    - **Validates: Requirements 6.3**

  - [x] 6.7 Write property test for combat interruption handling
    - **Property 16: Combat Interruption Handling**
    - **Validates: Requirements 6.5**

- [x] 7. Update game system integration for movement-based combat
  - [x] 7.1 Update GameEngine for auto-attack integration
    - Modify CombatSystem integration to support auto-detection
    - Update main game loop to handle movement-combat transitions
    - _Requirements: 6.4_

  - [x] 7.2 Update UnitManager for movement commands
    - Replace 'attack' commands with 'move' commands
    - Remove manual target selection from mouse interaction
    - Add click-to-move command processing
    - _Requirements: 1.1_

  - [x] 7.3 Ensure ParasiteManager compatibility
    - Verify parasites work correctly with auto-attack system
    - Maintain existing environmental combat functionality
    - _Requirements: 1.2, 1.3_

- [x] 8. Checkpoint - Auto-attack system functional
  - Ensure movement commands work correctly
  - Verify auto-detection triggers within 10 units
  - Test seamless transition between movement and combat
  - Verify movement resumption after combat completion
  - Ask the user if questions arise

- [x] 9. Performance optimization for auto-attack system
  - [x] 9.1 Optimize enemy detection performance
    - Implement efficient spatial detection algorithms
    - Add detection frequency throttling to maintain 60fps
    - Monitor performance impact of continuous enemy scanning
    - _Requirements: 6.4_

  - [x] 9.2 Write unit tests for auto-attack edge cases
    - Test rapid movement direction changes during detection
    - Test multiple enemies entering/leaving detection range
    - Test energy depletion during auto-attack sequences

- [x] 10. Final integration and validation for auto-attack system
  - [x] 10.1 Complete end-to-end auto-attack flow testing
    - Test full scenarios from movement command to auto-engagement to resumption
    - Validate all visual feedback for detection and engagement
    - Test edge cases like multiple enemies, energy depletion, target destruction
    - _Requirements: All requirements_

  - [x] 10.2 Final performance validation for auto-attack
    - Ensure 60fps performance with continuous enemy detection
    - Optimize any performance bottlenecks in detection algorithms
    - Validate memory usage during extended auto-attack scenarios
    - _Requirements: 6.4_

- [x] 11. Final checkpoint - Complete auto-attack combat system
  - Ensure all requirements for movement-based auto-attack are implemented
  - Verify seamless integration between movement and combat systems
  - Validate user experience improvements from reduced micromanagement
  - Ask the user if questions arise

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation of auto-attack functionality
- Property tests validate universal correctness properties for movement-based combat
- Unit tests validate specific examples and edge cases for auto-detection
- The implementation refactors existing manual combat into intuitive auto-attack system
- Current manual target selection will be replaced with movement-based commands
- Detection range (10 units) is larger than combat range (8 units) for smooth engagement
- Movement resumption ensures protectors complete their original objectives after combat