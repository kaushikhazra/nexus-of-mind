# Implementation Plan: Combat Balance Tuning

## Overview

This implementation plan rebalances combat stats to create asymmetric gameplay between native parasites (tough, swarm) and human colonizers (fragile, tech). Changes span unit entities, parasite entities, and combat system integration.

## Tasks

- [x] 1. Update Human Unit Stats
  - [x] 1.1 Update Worker health
    - File: `client/src/game/entities/Worker.ts`
    - Change maxHealth: 80 → 60
    - Change health initialization to match
    - _Requirements: 2.1_

  - [x] 1.2 Update Scout health
    - File: `client/src/game/entities/Scout.ts`
    - Change maxHealth: 60 → 40
    - Change health initialization to match
    - _Requirements: 2.2_

  - [x] 1.3 Update Protector stats
    - File: `client/src/game/entities/Protector.ts`
    - Change maxHealth: 120 → 80
    - Change shieldStrength: 50 → 60
    - Change attackDamage: 25 → 35
    - Change attackCooldown: 2.0 → 1.5
    - Change attackRange: 8.0 → 12.0
    - Change detectionRange: 10.0 → 12.0
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

- [x] 2. Update Parasite Base Class
  - [x] 2.1 Add regeneration system to Parasite base class
    - File: `client/src/game/entities/Parasite.ts`
    - Add protected regenRate property
    - Add updateRegeneration() method
    - Call regeneration in update loop when not in combat
    - _Requirements: 3.5_

- [x] 3. Update Energy Parasite Stats
  - [x] 3.1 Update Energy Parasite configuration
    - File: `client/src/game/entities/EnergyParasite.ts`
    - Change health: 2 → 60
    - Change maxHealth: 2 → 60
    - Change drainRate: 3.0 → 2.0
    - Change speed: 2.0 → 5.0
    - Set regenRate: 1.0
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [x] 3.2 Update ParasiteTypes config for Energy Parasite
    - File: `client/src/game/types/ParasiteTypes.ts`
    - Update ENERGY_PARASITE_CONFIG constants
    - _Requirements: 3.1, 3.2_

- [x] 4. Update Combat Parasite Stats
  - [x] 4.1 Update Combat Parasite configuration
    - File: `client/src/game/entities/CombatParasite.ts`
    - Change health: 4 → 100
    - Change maxHealth: 4 → 100
    - Change attackDamage: 2 → 5
    - Add attackCooldown: 0.8 sec
    - Change speed: 2.5 → 6.0
    - Set regenRate: 1.0
    - _Requirements: 3.3, 3.4, 3.5, 3.6_

  - [x] 4.2 Update ParasiteTypes config for Combat Parasite
    - File: `client/src/game/types/ParasiteTypes.ts`
    - Update COMBAT_PARASITE_CONFIG constants
    - _Requirements: 3.3, 3.4_

- [x] 5. Update Queen Stats
  - [x] 5.1 Update Queen configuration
    - File: `client/src/game/entities/Queen.ts`
    - Change health range: 40-100 → 200 (fixed)
    - Change speed: 5.0 → 4.0
    - Set regenRate: 2.0
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. Checkpoint - Stats Updated
  - Verify all stat changes compile without errors ✓
  - Run TypeScript build to check for type errors ✓
  - Review changes match design document values ✓

- [x] 7. Verify Combat Math
  - [x] 7.1 Test 1v1 combat (Protector vs Combat Parasite)
    - Verify Protector wins ✓
    - Verify TTK approximately 4.3 seconds ✓
    - _Requirements: 5.1_

  - [x] 7.2 Test swarm combat (Protector vs 4 Combat Parasites)
    - Verify Parasites win ✓
    - Verify Protector kills ~1 parasite before dying ✓
    - _Requirements: 5.3_

  - [x] 7.3 Test regeneration
    - Verify parasites heal 1 HP/sec when idle ✓
    - Verify Queen heals 2 HP/sec when idle ✓
    - _Requirements: 3.5, 4.2_

- [x] 8. Final Checkpoint
  - All stats match design document ✓
  - Combat outcomes match expected results ✓
  - No TypeScript compilation errors ✓
  - Game runs without runtime errors ✓

## File Summary

| File | Changes |
|------|---------|
| `Worker.ts` | health: 80 → 60 |
| `Scout.ts` | health: 60 → 40 |
| `Protector.ts` | health: 120→80, shield: 50→60, damage: 25→35, cooldown: 2.0→1.5, range: 8→12, healthRegen: 0.5/sec |
| `Parasite.ts` | Add regenRate, updateRegeneration() |
| `EnergyParasite.ts` | health: 2→60, drain: 3→2, speed: 2→5, regen: 1 |
| `CombatParasite.ts` | health: 4→100, damage: 2→5, cooldown: 0.8, speed: 2.5→6, regen: 1 |
| `Queen.ts` | health: 200, speed: 5→4, regen: 2 |
| `ParasiteTypes.ts` | Update config constants |

## Notes

- Regeneration only applies when parasite is not actively in combat
- Shield regeneration for Protector remains unchanged (existing behavior)
- Detection range increased to match attack range for better engagement feel
- Queen health is now fixed at 200 (not variable range)
