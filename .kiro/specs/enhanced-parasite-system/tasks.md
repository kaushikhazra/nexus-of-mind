# Implementation Plan: Enhanced Parasite System

## Overview

This implementation plan adds Combat Parasites to the existing Energy Parasite system, creating a dual-threat ecosystem with 25% Combat Parasites (target protectors) and 75% Energy Parasites (target workers). The system maintains existing spawning mechanics while adding tactical depth through differentiated enemy types.

## Tasks

- [x] 1. Create parasite type enumeration and configuration system
  - Create ParasiteType enum (ENERGY, COMBAT) in new types file
  - Define PARASITE_STATS configuration for both types
  - Create TargetingBehavior interface and configurations
  - Export types for use across the system
  - _Requirements: 1.1, 1.2, 3.1, 3.2_

- [x] 2. Create Combat Parasite entity class
  - Create CombatParasite class extending EnergyParasite
  - Implement 4-5 hits health (2x stronger than Energy Parasites)
  - Add protector-first targeting logic with worker fallback
  - Create distinct visual appearance (20% larger, different material)
  - Use ParasiteType.COMBAT and PARASITE_STATS configuration
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. Implement spawn distribution system
  - [x] 3.1 Create DistributionTracker class
    - Implement 75/25 ratio enforcement logic
    - Add spawn history tracking with 20-spawn rolling window
    - Create distribution accuracy validation (±10% tolerance)
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Enhance ParasiteManager spawning logic
    - Update spawn methods to determine parasite type before creation
    - Implement factory pattern for parasite creation (Energy vs Combat)
    - Integrate DistributionTracker into spawning decisions
    - Maintain existing spawn timing and location logic
    - _Requirements: 2.3, 2.4_

  - [ ]* 3.3 Write property test for spawn distribution accuracy
    - **Property 1: Spawn Distribution Accuracy**
    - **Validates: Requirements 2.1, 2.2**

- [x] 4. Update visual differentiation system
  - [x] 4.1 Enhance MaterialManager for Combat Parasites
    - Add combat parasite material creation method
    - Design distinct material (darker, more aggressive appearance)
    - Update color palette to include combat parasite colors
    - _Requirements: 5.1, 5.2_

  - [x] 4.2 Update Combat Parasite visual rendering
    - Implement 20% larger scale for Combat Parasites
    - Apply distinct materials during mesh creation
    - Add visual indicators for parasite type identification
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 4.3 Write property test for visual differentiation
    - **Property 4: Visual Differentiation Requirement**
    - **Validates: Requirements 5.1, 5.2**

- [x] 5. Implement Combat Parasite targeting system
  - [x] 5.1 Update targeting behavior in CombatParasite
    - Implement protector-first targeting in hunting behavior
    - Add fallback to worker targeting when no protectors available
    - Update target validation and switching mechanisms
    - Use TARGETING_BEHAVIORS configuration
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.2 Update CombatSystem for dual parasite types
    - Ensure CombatSystem handles both parasite types correctly
    - Update target validation to work with both types
    - Maintain existing auto-attack functionality
    - _Requirements: 6.1, 6.3_

  - [ ]* 5.3 Write property test for targeting priority
    - **Property 2: Combat Parasite Targeting Priority**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 5.4 Write property test for targeting fallback behavior
    - **Property 6: Targeting Fallback Behavior**
    - **Validates: Requirements 3.2, 3.3**

- [x] 6. Update combat mechanics and energy systems
  - [x] 6.1 Update health and damage systems
    - Ensure Combat Parasites use correct health values (4-5 hits)
    - Maintain existing energy costs for protector attacks (5 energy per attack)
    - Update energy rewards for Combat Parasite kills (proportional to difficulty)
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 Integrate with auto-attack system
    - Ensure protector auto-attack works seamlessly with both parasite types
    - Maintain existing detection ranges and engagement logic
    - Update combat coordination for multiple parasite types
    - _Requirements: 4.4, 4.5_

  - [ ]* 6.3 Write property test for health differential consistency
    - **Property 3: Health Differential Consistency**
    - **Validates: Requirements 1.1, 4.1**

  - [ ]* 6.4 Write property test for energy reward proportionality
    - **Property 5: Energy Reward Proportionality**
    - **Validates: Requirements 1.4, 4.3**

- [x] 7. Performance optimization and system integration
  - [x] 7.1 Update ParasiteManager lifecycle management
    - Update cleanup and respawn logic for both parasite types
    - Maintain existing spawn timing and territorial behavior
    - Ensure proper tracking of parasite counts by type
    - _Requirements: 6.1, 6.2_

  - [x] 7.2 Performance optimization for mixed combat
    - Optimize rendering pipeline for multiple parasite types
    - Ensure 60fps maintenance with up to 10 active parasites
    - Implement efficient targeting and behavior updates
    - _Requirements: 6.4, 6.5_

  - [ ]* 7.3 Write property test for auto-attack integration
    - **Property 9: Auto-Attack Integration**
    - **Validates: Requirements 6.3, 6.4**

  - [ ]* 7.4 Write property test for performance maintenance
    - **Property 8: Performance Maintenance**
    - **Validates: Requirements 4.5, 6.5**

- [x] 8. Checkpoint - Enhanced parasite system functional
  - Verify both Energy and Combat Parasites spawn with correct distribution
  - Test Combat Parasite targeting behavior (protectors first, workers second)
  - Confirm visual differentiation between parasite types
  - Validate integration with existing auto-attack system
  - Ensure 60fps performance with mixed parasite combat
  - Ask the user if questions arise

- [x] 9. Advanced behavior and polish
  - [x] 9.1 Fine-tune Combat Parasite behavior
    - Adjust aggression levels and pursuit distances
    - Optimize target switching and engagement patterns
    - Balance Combat Parasite speed and movement patterns
    - _Requirements: 3.5, 4.4_

  - [ ]* 9.2 Write property test for territory behavior consistency
    - **Property 10: Territory Behavior Consistency**
    - **Validates: Requirements 3.5, 6.1**

  - [ ]* 9.3 Write property test for spawn timing preservation
    - **Property 7: Spawn Timing Preservation**
    - **Validates: Requirements 2.3, 6.2**

- [x] 10. Final integration and validation
  - [x] 10.1 Complete end-to-end testing
    - Test full gameplay scenarios with mixed parasite types
    - Validate player experience with dual-threat ecosystem
    - Confirm strategic depth and tactical decision-making
    - _Requirements: All requirements_

  - [x] 10.2 Performance and balance validation
    - Final performance optimization pass
    - Balance testing for Combat Parasite difficulty
    - Validate spawn distribution accuracy over extended gameplay
    - _Requirements: 2.2, 4.5, 6.5_

- [x] 11. Final checkpoint - Complete enhanced parasite system
  - Ensure all requirements for dual parasite types are implemented
  - Verify seamless integration with existing combat and spawning systems
  - Validate enhanced tactical gameplay with protector positioning
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation of enhanced parasite functionality
- Property tests validate universal correctness properties for dual parasite system
- Unit tests validate specific examples and edge cases for Combat Parasites
- The implementation extends existing Energy Parasite system without breaking changes
- Combat Parasites add tactical depth while maintaining existing gameplay flow
- Spawn distribution system ensures balanced threat variety (75% Energy, 25% Combat)
- Visual differentiation enables strategic decision-making for players