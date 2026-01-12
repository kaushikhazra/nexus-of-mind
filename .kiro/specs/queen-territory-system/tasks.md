# Implementation Plan: Queen & Territory System

## Overview

This implementation plan converts the Queen & Territory System design into discrete coding tasks that build incrementally on the existing Enhanced Parasite System. Each task focuses on specific components while maintaining integration with existing systems (ParasiteManager, CombatSystem, UnitManager). The plan emphasizes early validation through property-based testing and maintains 60fps performance throughout development.

## Tasks

- [x] 1. Territory Grid Foundation
  - Create TerritoryManager class with 16x16 chunk grid system
  - Implement territory boundary calculations and coordinate mapping
  - Add territory creation and lookup methods
  - Integrate with existing 64-unit chunk system
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ]* 1.1 Write property test for territory grid calculations
  - **Property 1: Territory Grid Mathematical Correctness**
  - **Validates: Requirements 1.1, 1.2, 1.5**

- [ ]* 1.2 Write property test for territory non-overlap
  - **Property 2: Territory Non-Overlap Constraint**
  - **Validates: Requirements 1.3**

- [ ] 2. Queen Entity Implementation
  - Create Queen class with CombatTarget interface implementation
  - Implement Queen lifecycle state machine (underground_growth, hive_construction, active_control)
  - Add Queen health system and vulnerability state management
  - Create Queen-parasite control relationship tracking
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

- [ ]* 2.1 Write property test for Queen health constraints
  - **Property 3: Queen Health Constraints**
  - **Validates: Requirements 2.1**

- [ ]* 2.2 Write property test for Queen stationary behavior
  - **Property 4: Queen Stationary Behavior**
  - **Validates: Requirements 2.2**

- [ ]* 2.3 Write property test for Queen parasite control
  - **Property 5: Queen Parasite Control Authority**
  - **Validates: Requirements 2.3**

- [ ]* 2.4 Write property test for Queen vulnerability states
  - **Property 6: Queen Vulnerability State Management**
  - **Validates: Requirements 2.4, 4.7**

- [ ] 3. Hive Structure System
  - Create Hive class with CombatTarget interface implementation
  - Implement hive construction process with timing controls
  - Add defensive parasite swarm spawning (50+ parasites)
  - Create hive placement logic within territory boundaries
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

- [ ]* 3.1 Write property test for hive health constraints
  - **Property 8: Hive Health Constraints**
  - **Validates: Requirements 3.1**

- [ ]* 3.2 Write property test for defensive swarm spawning
  - **Property 9: Hive Defensive Swarm Spawning**
  - **Validates: Requirements 3.2**

- [ ]* 3.3 Write property test for hive territorial placement
  - **Property 10: Hive Territorial Placement**
  - **Validates: Requirements 3.3**

- [ ]* 3.4 Write property test for hive construction timing
  - **Property 11: Hive Construction Timing**
  - **Validates: Requirements 3.4**

- [ ] 4. Queen Lifecycle Management
  - Implement Queen regeneration cycle after death
  - Create underground growth phase with timing (60-120 seconds)
  - Add hive construction phase with random location selection
  - Implement Queen death and territory liberation mechanics
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7_

- [ ]* 4.1 Write property test for Queen death liberation
  - **Property 7: Queen Death Territory Liberation**
  - **Validates: Requirements 2.6, 4.1, 4.2**

- [ ]* 4.2 Write property test for Queen regeneration lifecycle
  - **Property 13: Queen Regeneration Lifecycle**
  - **Validates: Requirements 4.3**

- [ ]* 4.3 Write property test for Queen growth timing
  - **Property 14: Queen Growth Phase Timing**
  - **Validates: Requirements 4.4**

- [ ]* 4.4 Write property test for growth completion hive selection
  - **Property 15: Growth Completion Hive Selection**
  - **Validates: Requirements 4.6**

- [ ] 5. Territory Liberation System
  - Create LiberationManager for territory liberation tracking
  - Implement 3-5 minute liberation periods with parasite-free guarantee
  - Add 25% mining speed bonus during liberation
  - Create energy reward system for Queen kills (50-100 energy)
  - _Requirements: 5.1, 5.2, 5.4_

- [ ]* 5.1 Write property test for liberation mining bonus
  - **Property 16: Liberation Period Mining Bonus**
  - **Validates: Requirements 5.2**

- [ ]* 5.2 Write property test for Queen kill energy rewards
  - **Property 17: Queen Kill Energy Rewards**
  - **Validates: Requirements 5.4**

- [ ] 6. Enhanced ParasiteManager Integration
  - Extend existing ParasiteManager with territorial control
  - Implement Queen-controlled parasite spawning within territories
  - Add territory-wide parasite explosion on Queen death
  - Create parasite transfer mechanisms between Queens
  - _Requirements: 2.3, 2.6, 8.4_

- [ ]* 6.1 Write property test for existing system preservation
  - **Property 19: Existing Parasite System Preservation**
  - **Validates: Requirements 8.4**

- [ ] 7. Enhanced CombatSystem Integration
  - Extend CombatSystem to handle Queen and Hive as combat targets
  - Implement multi-protector hive assault coordination
  - Add Queen/Hive target validation and prioritization
  - Create hive assault difficulty scaling for single vs multiple protectors
  - _Requirements: 6.3_

- [ ]* 7.1 Write property test for hive assault difficulty
  - **Property 18: Hive Assault Difficulty Scaling**
  - **Validates: Requirements 6.3**

- [ ]* 7.2 Write property test for hive destruction liberation
  - **Property 12: Hive Destruction Liberation Chain**
  - **Validates: Requirements 3.6**

- [ ] 8. Queen Growth UI System
  - Create QueenGrowthUI component for top-right display
  - Implement growth progress bar with percentage and time remaining
  - Add Queen generation tracking display
  - Create smooth UI animations and transitions
  - _Requirements: 4.5, 7.1_

- [ ]* 8.1 Write unit tests for UI component updates
  - Test progress bar updates and animation timing
  - Test generation display and status changes
  - _Requirements: 4.5, 7.1_

- [ ] 9. Territory Visual Indicators
  - Create territory boundary visualization system
  - Implement territory entry/exit visual feedback
  - Add liberation timer countdown display
  - Create Queen status visual communication
  - _Requirements: 1.4, 7.2, 7.4, 7.5_

- [ ]* 9.1 Write unit tests for territory visual feedback
  - Test boundary indicator display and updates
  - Test liberation timer countdown accuracy
  - _Requirements: 1.4, 7.2, 7.4_

- [ ] 10. Performance Optimization and Integration
  - Optimize territory system for 60fps performance
  - Implement memory usage monitoring (<100MB additional)
  - Add CPU overhead monitoring (<15% additional)
  - Create performance degradation handling
  - _Requirements: 8.1, 8.2, 8.3, 8.6_

- [ ]* 10.1 Write performance benchmark tests
  - Test frame rate stability with multiple territories
  - Test memory usage under various loads
  - Test CPU overhead during Queen lifecycle transitions
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 11. Error Handling and Recovery
  - Implement territory overlap detection and correction
  - Add Queen lifecycle corruption recovery
  - Create hive construction failure retry logic
  - Add parasite control consistency validation
  - _Requirements: All requirements - error recovery_

- [ ]* 11.1 Write unit tests for error recovery
  - Test territory overlap correction
  - Test Queen state recovery mechanisms
  - Test hive construction retry logic

- [ ] 12. System Integration and Validation
  - Integrate all components with GameEngine
  - Validate cross-system communication and event propagation
  - Test complete Queen lifecycle from spawn to death to regeneration
  - Verify territory liberation and mining bonus functionality
  - _Requirements: All requirements - integration_

- [ ]* 12.1 Write integration tests for complete system
  - Test end-to-end Queen lifecycle scenarios
  - Test territory liberation and mining bonus integration
  - Test multi-system event propagation

- [ ] 13. Final Checkpoint - Comprehensive Testing
  - Ensure all property tests pass with 100+ iterations
  - Validate all unit tests and integration tests
  - Confirm 60fps performance with multiple active territories
  - Verify seamless integration with existing Enhanced Parasite System
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check with 100+ iterations
- Unit tests validate specific examples, edge cases, and integration points
- Checkpoints ensure incremental validation and user feedback
- All tasks build incrementally on existing Enhanced Parasite System foundation

## Testing Framework Guidelines

**IMPORTANT: DO NOT USE PLAYWRIGHT TESTS**
- Playwright tests slow down development and provide no value for this core game system
- Use **Jest** for unit tests and integration tests
- Use **fast-check** for property-based tests
- Use **performance benchmarks** for frame rate and memory testing
- Focus on **game logic testing**, not UI automation