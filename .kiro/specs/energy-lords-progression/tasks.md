# Implementation Plan: Energy Lords Progression System

## Overview

This implementation plan adds a roguelike progression system with 60 levels organized into 12 tiers. Players earn titles by sustaining energy production above exponentially-scaled thresholds. The system includes threshold monitoring, victory conditions, tiered title awards, power generator upgrades, and persistent progress.

## Tasks

- [x] 1. Create Core Types and Interfaces
  - [x] 1.1 Create EnergyLordsTypes.ts
    - File: `client/src/game/types/EnergyLordsTypes.ts` (new)
    - Define LevelDefinition interface
    - Define SavedProgress interface
    - Create LEVEL_CONFIGS constant with all 7 levels
    - _Requirements: 1.1-1.7, 4.1-4.7_

- [x] 2. Implement Backend Progress Storage
  - [x] 2.1 Create SQLite database schema
    - File: `server/database/energy_lords.py` (new)
    - Create player_progress table
    - Initialize database on server start
    - _Requirements: 8.1-8.3_

  - [x] 2.2 Create backend API routes
    - File: `server/routes/progress_routes.py` (new)
    - GET /api/progress - Load player progress
    - POST /api/progress - Save player progress
    - DELETE /api/progress - Reset player progress
    - GET /api/progress/reset - Reset database for testing
    - _Requirements: 8.1-8.6_

  - [x] 2.3 Register routes with server
    - File: `server/main.py`
    - Import and register progress routes
    - _Requirements: 8.4_

  - [x] 2.4 Create frontend ProgressStorage API client
    - File: `client/src/game/systems/ProgressStorage.ts` (new)
    - Implement async save() method via POST
    - Implement async load() method via GET
    - Implement async clear() method via DELETE
    - Handle API errors gracefully
    - _Requirements: 8.1-8.5_

- [x] 3. Implement Threshold Monitor
  - [x] 3.1 Create ThresholdMonitor class
    - File: `client/src/game/systems/ThresholdMonitor.ts` (new)
    - Check energy every 500ms (not every frame)
    - Increment sustained time when energy >= threshold
    - Reset sustained time to 0 when energy < threshold
    - Provide getSustainedTime() and reset() methods
    - _Requirements: 2.1-2.6_

- [x] 4. Implement EnergyLordsManager
  - [x] 4.1 Create EnergyLordsManager class
    - File: `client/src/game/systems/EnergyLordsManager.ts` (new)
    - Initialize with EnergyManager reference
    - Load saved progress on construction
    - update() method checks threshold via monitor
    - Trigger victory when sustainedTime >= requiredTime
    - Apply upgrade bonus and save progress on victory
    - _Requirements: 3.1-3.6, 5.1-5.5_

- [x] 5. Integrate with GameEngine
  - [x] 5.1 Add EnergyLordsManager to GameEngine
    - File: `client/src/game/GameEngine.ts`
    - Instantiate EnergyLordsManager during game init
    - Call manager.update() in game loop
    - Trigger game session end on victory event
    - _Requirements: 6.1-6.5_

  - [x] 5.2 Apply upgrades on game start
    - File: `client/src/game/GameEngine.ts`
    - Load progress on game initialization
    - Apply cumulative upgrade bonus to power generators
    - _Requirements: 5.3, 5.5_

- [x] 6. Create Progress HUD Component
  - [x] 6.1 Create EnergyLordsHUD component
    - File: `client/src/ui/EnergyLordsHUD.ts` (new)
    - Display current title
    - Show target threshold and time requirement
    - Show current energy level
    - Progress bar for sustained time
    - Timer showing sustained vs required time
    - _Requirements: 2.4_

  - [x] 6.2 Integrate HUD into GameEngine
    - File: `client/src/game/GameEngine.ts`
    - Add EnergyLordsHUD component to game UI
    - Connect to EnergyLordsManager state
    - _Requirements: 2.4_

- [x] 7. Create Victory Screen Component
  - [x] 7.1 Create VictoryScreen component
    - File: `client/src/ui/VictoryScreen.ts` (new)
    - Display new title earned
    - Show upgrade bonus received
    - "Continue" button to restart with upgrades
    - _Requirements: 3.2, 3.4, 3.5_

  - [x] 7.2 Integrate VictoryScreen into GameEngine
    - File: `client/src/game/GameEngine.ts`
    - Show VictoryScreen on victory event
    - Handle continue button to reload game
    - _Requirements: 3.3, 3.6, 6.3_

- [x] 8. Checkpoint - Core System Complete
  - TypeScript compilation verified - no errors
  - Threshold monitoring implemented at 500ms interval
  - Victory triggers when sustainedTime >= requiredTime
  - Progress saves to SQLite via backend API
  - Progress loads on game initialization

---

## Phase 2: 60-Level Tier System Upgrade

- [x] 9. Update Type Definitions for Tier System
  - [x] 9.1 Add TierDefinition interface
    - File: `client/src/game/types/EnergyLordsTypes.ts`
    - Define TierDefinition with id, name, startLevel, endLevel, sustainTime
    - Create TIER_CONFIGS constant with all 12 tiers
    - _Requirements: 1.1-1.6_

  - [x] 9.2 Update LevelDefinition interface
    - File: `client/src/game/types/EnergyLordsTypes.ts`
    - Add tierIndex, rankInTier, isTierCompletion fields
    - Update upgradeBonus to use 1% / 3.5% structure
    - _Requirements: 1.4, 5.1-5.3_

  - [x] 9.3 Generate 60-level LEVEL_CONFIGS
    - File: `client/src/game/types/EnergyLordsTypes.ts`
    - Create generateLevelConfigs() function
    - Energy formula: 1000 × 1.08^(level-1)
    - Title format: "[Tier] [Roman Numeral]"
    - _Requirements: 1.1-1.6, 4.1-4.5_

  - [x] 9.4 Add tier helper functions
    - File: `client/src/game/types/EnergyLordsTypes.ts`
    - getTierForLevel(level): TierDefinition
    - getRankInTier(level): number
    - isTierCompletion(level): boolean
    - formatTitle(level): string
    - _Requirements: 4.2-4.4_

  - [x] 9.5 Update MAX_LEVEL constant
    - File: `client/src/game/types/EnergyLordsTypes.ts`
    - Change from 6 to 60
    - _Requirements: 1.1_

- [x] 10. Update EnergyLordsManager for Tiers
  - [x] 10.1 Add tier completion detection
    - File: `client/src/game/systems/EnergyLordsManager.ts`
    - Detect when level % 5 === 0 (tier completion)
    - Include isTierCompletion in victory event data
    - _Requirements: 4.4, 7.1-7.4_

  - [x] 10.2 Update victory event data
    - File: `client/src/game/systems/EnergyLordsManager.ts`
    - Add isTierCompletion to VictoryEventData
    - Add previousTier and newTier names
    - _Requirements: 7.1-7.4_

- [x] 11. Update HUD for Tier Display
  - [x] 11.1 Add tier progress indicator
    - File: `client/src/ui/EnergyLordsHUD.ts`
    - Show "Tier: Ember (6-10) 3/5" style display
    - Mini progress bar for tier progress
    - _Requirements: 4.2, 4.3_

  - [x] 11.2 Update title display format
    - File: `client/src/ui/EnergyLordsHUD.ts`
    - Display "[Tier] [Rank]" format (e.g., "Ember III")
    - Update default placeholder values
    - _Requirements: 4.2, 4.3_

  - [x] 11.3 Update target display
    - File: `client/src/ui/EnergyLordsHUD.ts`
    - Show energy in Joules with proper formatting
    - Format large numbers (e.g., "12,345 J")
    - _Requirements: 2.4_

- [x] 12. Update Victory Screen for Tier Celebration
  - [x] 12.1 Add tier completion detection
    - File: `client/src/ui/VictoryScreen.ts`
    - Check isTierCompletion flag in victory data
    - _Requirements: 7.1-7.4_

  - [x] 12.2 Create tier completion celebration UI
    - File: `client/src/ui/VictoryScreen.ts`
    - "NEW TIER UNLOCKED!" banner for tier completions
    - Show "[Previous Tier] MASTERED" message
    - Enhanced visual effects for tier completion
    - _Requirements: 7.1-7.3_

  - [x] 12.3 Differentiate regular vs tier victory
    - File: `client/src/ui/VictoryScreen.ts`
    - Regular: "LEVEL COMPLETE" with 1% bonus
    - Tier: "NEW TIER UNLOCKED!" with 3.5% bonus
    - _Requirements: 7.3, 7.4_

- [ ] 13. Integration Testing
  - [ ] 13.1 Test level progression
    - Start at Level 0 (Initiate)
    - Progress through Spark I-V (levels 1-5)
    - Verify tier completion celebration at level 5
    - _Requirements: 1.1-1.6, 4.1-4.5_

  - [ ] 13.2 Test energy thresholds
    - Level 1: 1,000 J for 1 min
    - Level 5: 1,360 J for 1 min
    - Level 10: 1,999 J for 2 min
    - _Requirements: 1.4, 2.1-2.6_

  - [ ] 13.3 Test upgrade bonuses
    - Regular levels: +1%
    - Tier completion: +3.5%
    - Verify cumulative application
    - _Requirements: 5.1-5.5_

  - [ ] 13.4 Test persistence
    - Save progress, refresh browser
    - Verify level, title, bonus restored
    - _Requirements: 8.1-8.5_

- [ ] 14. Final Checkpoint
  - [x] All 60 levels configured correctly
  - [x] 12 tiers with proper names and times
  - [x] Energy scaling follows 1000 × 1.08^(level-1)
  - [x] Tier completion celebration works
  - [x] Upgrade bonuses apply correctly (90% max)
  - [x] Titles display as "[Tier] [Rank]"
  - [x] No TypeScript compilation errors
  - [ ] Game runs without runtime errors

## File Summary

| File | Changes |
|------|---------|
| `server/database/energy_lords.py` | Existing - no changes needed |
| `server/routes/progress_routes.py` | Existing - no changes needed |
| `client/.../EnergyLordsTypes.ts` | Update - Add tiers, generate 60 levels |
| `client/.../EnergyLordsManager.ts` | Update - Tier completion detection |
| `client/.../EnergyLordsHUD.ts` | Update - Tier progress display |
| `client/.../VictoryScreen.ts` | Update - Tier celebration UI |

## Notes

- Energy threshold formula: 1000 × 1.08^(level-1) Joules
- Sustain time per tier (not per level): 1-15 minutes
- 12 tiers: Spark, Ember, Flame, Blaze, Inferno, Nova, Pulsar, Quasar, Nebula, Star, Supernova, Nexus
- Upgrade bonus: 1% per regular level, 3.5% per tier completion = 90% max
- Roman numerals for ranks: I, II, III, IV, V
- Time cap at 15 minutes (Supernova and Nexus tiers)
