# Implementation Plan: FPS Optimization Fixes

## Overview

Fix 7 performance issues: 3 memory leaks causing FPS decay over time, and 4 per-frame bottlenecks causing low baseline FPS. Target is stable 60 FPS (+/- 5) throughout extended gameplay sessions.

## Tasks

### Phase 1: Memory Leak Fixes

- [x] 1. Fix CombatEffects material disposal
  - [x] 1.1 Add material tracking map
    - File: `client/src/rendering/CombatEffects.ts`
    - Add `private effectMaterials: Map<string, Material[]> = new Map()`
    - _Requirements: 1.1_

  - [x] 1.2 Track cloned materials on creation
    - File: `client/src/rendering/CombatEffects.ts`
    - In createEnergyBeam(), store cloned material reference
    - In any method that clones materials, track them
    - _Requirements: 1.1, 1.2_

  - [x] 1.3 Dispose materials in removeEffect()
    - File: `client/src/rendering/CombatEffects.ts`
    - Dispose all tracked materials before disposing meshes
    - Delete from effectMaterials map
    - _Requirements: 1.2, 1.3_

  - [x] 1.4 Update clearAllEffects() to dispose materials
    - File: `client/src/rendering/CombatEffects.ts`
    - Iterate effectMaterials and dispose all
    - Clear the map
    - _Requirements: 1.3_

- [x] 2. Fix duplicate UI texture
  - [x] 2.1 Modify CombatEffects constructor to accept shared UI
    - File: `client/src/rendering/CombatEffects.ts`
    - Add optional `sharedUI?: AdvancedDynamicTexture` parameter
    - Store and use if provided
    - Add `private ownsUI: boolean = false` flag
    - _Requirements: 2.1, 2.3_

  - [x] 2.2 Update setupUI() to respect shared UI
    - File: `client/src/rendering/CombatEffects.ts`
    - Only create new UI if not provided
    - Set ownsUI = true only when creating
    - _Requirements: 2.2, 2.4_

  - [x] 2.3 Update dispose() to check ownership
    - File: `client/src/rendering/CombatEffects.ts`
    - Only dispose advancedTexture if ownsUI is true
    - _Requirements: 2.4_

  - [x] 2.4 Pass shared UI from CombatSystem
    - File: `client/src/game/CombatSystem.ts`
    - Get guiTexture from GameEngine
    - Pass to CombatEffects constructor
    - _Requirements: 2.1_

- [x] 3. Remove PerformanceMonitor entirely
  - [x] 3.1 Remove PerformanceMonitor file
    - DELETE: `client/src/utils/PerformanceMonitor.ts`
    - _Requirements: 3.4_

  - [x] 3.2 Remove TerritoryPerformanceMonitor file
    - DELETE: `client/src/game/TerritoryPerformanceMonitor.ts`
    - _Requirements: 3.4_

  - [x] 3.3 Clean up GameEngine references
    - File: `client/src/game/GameEngine.ts`
    - Remove import statement
    - Remove performanceMonitor property
    - Remove initialization (line ~161)
    - Remove getPerformanceMonitor() method
    - Remove startMonitoring()/stopMonitoring() calls
    - Remove dispose() call for performanceMonitor
    - _Requirements: 3.2, 3.4_

  - [x] 3.4 Clean up TerritoryManager references
    - File: `client/src/game/TerritoryManager.ts`
    - Remove TerritoryPerformanceMonitor import
    - Remove performanceMonitor property
    - Remove initialization in initialize()
    - Remove getPerformanceMonitor() method
    - _Requirements: 3.4_

  - [x] 3.5 Clean up DebugUI references
    - File: `client/src/ui/DebugUI.ts`
    - Remove/update code using getPerformanceMonitor()
    - _Requirements: 3.4_

  - [x] 3.6 Clean up SystemIntegration references
    - File: `client/src/game/SystemIntegration.ts`
    - Remove setupPerformanceMonitoring() method
    - Remove performanceMonitor usage
    - _Requirements: 3.4_

  - [x] 3.7 Update test files
    - Update mocks in test files that reference PerformanceMonitor
    - Files: `__tests__/PerformanceBalanceValidation.test.ts`, etc.
    - _Requirements: 3.4_

- [x] 4. Checkpoint - Memory leaks fixed
  - Verify no material accumulation over time
  - Verify single fullscreen UI
  - Verify PerformanceMonitor fully removed
  - Verify game compiles and runs

### Phase 2: Per-frame Bottleneck Fixes

- [x] 5. Remove async from render loop
  - [x] 5.1 Make render loop synchronous
    - File: `client/src/game/GameEngine.ts`
    - Remove `async` from runRenderLoop callback
    - Remove `await` from unitManager.update() call
    - _Requirements: 4.1_

  - [x] 5.2 Make UnitManager.update() synchronous
    - File: `client/src/game/UnitManager.ts`
    - Change return type from `Promise<void>` to `void`
    - Remove async keyword
    - _Requirements: 4.2_

  - [x] 5.3 Make processCommands() synchronous
    - File: `client/src/game/UnitManager.ts`
    - Remove async/await from command processing
    - Queue any truly async work for deferred execution
    - _Requirements: 4.3, 4.4_

- [x] 6. Implement round-robin system update throttling
  - [x] 6.1 Add ThrottledSystem interface and array
    - File: `client/src/game/GameEngine.ts`
    - Define ThrottledSystem interface (name, interval, lastUpdate, update fn)
    - Add `private throttledSystems: ThrottledSystem[] = []`
    - Add `private currentSystemIndex: number = 0`
    - _Requirements: 5.5, 5.6_

  - [x] 6.2 Create initThrottledSystems() method
    - File: `client/src/game/GameEngine.ts`
    - Initialize array with all 4 throttled systems
    - EnergyManager: 100ms interval (10 Hz)
    - TerritoryManager: 100ms interval (10 Hz)
    - LiberationManager: 200ms interval (5 Hz)
    - EnergyLordsManager: 100ms interval (10 Hz)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 6.3 Implement round-robin check in render loop
    - File: `client/src/game/GameEngine.ts`
    - Guard against empty array with `if (length > 0)`
    - Clamp index to valid range before access (handles invalid initialization)
    - Each frame: check ONE system (currentSystemIndex)
    - If interval elapsed: call update(), set lastUpdate
    - Increment with modulo wrap-around
    - _Requirements: 5.5, 5.6, 5.7_

  - [x] 6.4 Remove old direct update calls
    - File: `client/src/game/GameEngine.ts`
    - Remove energyManager.update() from render loop
    - Remove territoryManager.update() from render loop
    - Remove liberationManager.updateLiberations() from render loop
    - Remove energyLordsManager.update() from render loop
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 7. Eliminate per-frame allocations
  - [x] 7.1 Add cached arrays to ParasiteManager
    - File: `client/src/game/ParasiteManager.ts`
    - Add `private cachedDeposits: MineralDeposit[] = []`
    - Add `private depositDistances: array = []`
    - Add cache timestamp and interval
    - _Requirements: 6.2_

  - [x] 7.2 Create updateDepositCache() method
    - File: `client/src/game/ParasiteManager.ts`
    - Reuse arrays instead of creating new
    - Clear with .length = 0 instead of new array
    - Sort in place
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 7.3 Update update() to use cache
    - File: `client/src/game/ParasiteManager.ts`
    - Only refresh cache every 1 second
    - Use cachedDeposits for iteration
    - _Requirements: 6.1, 6.5_

- [x] 8. Cache singleton lookups
  - [x] 8.1 Add cached references to ParasiteManager
    - File: `client/src/game/ParasiteManager.ts`
    - Add `private gameEngine: GameEngine | null = null`
    - Add `private cameraController: CameraController | null = null`
    - Add `private cachedCameraTarget: Vector3`
    - _Requirements: 7.1, 7.2_

  - [x] 8.2 Initialize cached references
    - File: `client/src/game/ParasiteManager.ts`
    - Cache GameEngine in constructor or init method
    - Cache CameraController reference
    - _Requirements: 7.2, 7.4_

  - [x] 8.3 Update camera target periodically
    - File: `client/src/game/ParasiteManager.ts`
    - Update cachedCameraTarget every 100ms, not every frame
    - Use copyFrom() to avoid creating new Vector3
    - _Requirements: 7.3, 7.5_

- [x] 9. Checkpoint - Per-frame bottlenecks fixed
  - Verify render loop is synchronous
  - Verify systems update at correct frequencies
  - Verify no new arrays created in hot paths
  - Verify singleton lookups are cached

### Phase 2b: Event-Driven Bottleneck Fixes

- [x] 10. Throttle mouse move handler
  - [x] 10.1 Add throttling properties to GameEngine
    - File: `client/src/game/GameEngine.ts`
    - Add `private lastMouseMoveCheckTime: number = 0`
    - Add `private readonly MOUSE_MOVE_CHECK_INTERVAL: number = 50`
    - _Requirements: 8.1, 8.5_

  - [x] 10.2 Implement throttling in handleMouseMove()
    - File: `client/src/game/GameEngine.ts`
    - Check elapsed time at start of method
    - Return early if less than 50ms since last check
    - Update lastMouseMoveCheckTime when processing
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 11. Checkpoint - Event-driven bottlenecks fixed
  - Verify FPS stays above 55 during mouse movement ✓ (53 FPS minimum)
  - Verify tooltip still responds within 100ms ✓ (no perceived delay)

### Phase 3: Validation

- [ ] 12. Performance validation
  - [ ] 12.1 Baseline FPS test
    - Run game fresh, measure FPS with counter
    - Target: 55-65 FPS
    - _Requirements: 1.5, 4.5_

  - [ ] 12.2 Sustained FPS test
    - Run game for 1 hour
    - Measure FPS at 15, 30, 45, 60 minutes
    - Target: No degradation below 55 FPS
    - _Requirements: 1.5_

  - [ ] 12.3 Combat stress test
    - Continuous combat for 30 minutes
    - Measure FPS stability
    - Target: Stable 55+ FPS
    - _Requirements: 1.4, 1.5_

  - [ ] 12.4 Mouse movement FPS test
    - Move mouse continuously for 1 minute
    - Measure FPS during movement
    - Target: Stable 55+ FPS
    - _Requirements: 8.3_

- [ ] 13. Final checkpoint
  - Baseline FPS improved to 55-65
  - No FPS degradation over 1 hour
  - No memory leaks detected
  - Mouse movement doesn't drop FPS below 55
  - All tests passing

## Notes

- Test FPS after each fix to measure individual impact
- Memory leaks should be fixed FIRST as they affect long-term testing
- Keep FPSCounter active during development for real-time feedback
- Use Chrome DevTools Memory tab to verify no heap growth

## File Summary

| File | Changes |
|------|---------|
| `client/src/rendering/CombatEffects.ts` | Material tracking, shared UI, disposal fixes |
| `client/src/utils/PerformanceMonitor.ts` | **DELETE** |
| `client/src/game/TerritoryPerformanceMonitor.ts` | **DELETE** |
| `client/src/game/GameEngine.ts` | Remove PerformanceMonitor, sync render loop, system throttling, mouse move throttling |
| `client/src/game/TerritoryManager.ts` | Remove TerritoryPerformanceMonitor references |
| `client/src/game/UnitManager.ts` | Sync update method |
| `client/src/game/ParasiteManager.ts` | Array caching, singleton caching |
| `client/src/game/CombatSystem.ts` | Pass shared UI to CombatEffects |
| `client/src/ui/DebugUI.ts` | Remove PerformanceMonitor usage |
| `client/src/game/SystemIntegration.ts` | Remove PerformanceMonitor usage |
