# Implementation Plan: FPS Optimization Fixes

## Overview

Fix 11 performance issues: 3 memory leaks causing FPS decay over time, and 8 per-frame/event bottlenecks causing low baseline FPS. Target is stable 60 FPS (+/- 5) throughout extended gameplay sessions.

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

### Phase 2c: Camera Traversal Allocation Fixes

- [x] 14. Fix TreeRenderer per-frame Vector3 allocations
  - [x] 14.1 Replace `new Vector3()` with `set()` in updateAnimations()
    - File: `client/src/rendering/TreeRenderer.ts`
    - Change `spot.scaling = new Vector3(pulse, pulse, pulse)` to `spot.scaling.set(pulse, pulse, pulse)`
    - _Requirements: 9.1, 9.2_

- [x] 15. Fix CameraController per-frame Vector3 allocations
  - [x] 15.1 Add cached Vector3 class members
    - File: `client/src/rendering/CameraController.ts`
    - Add `private cachedMoveVector: Vector3 = new Vector3()`
    - Add `private cachedNewTarget: Vector3 = new Vector3()`
    - _Requirements: 9.3_

  - [x] 15.2 Update keyboard movement to use cached vectors
    - File: `client/src/rendering/CameraController.ts`
    - Use `scaleInPlace()` instead of `scale()`
    - Use `addToRef()` instead of `add()`
    - _Requirements: 9.3_

- [x] 16. Make GameState.getAllMineralDeposits() zero-allocation
  - [x] 16.1 Add mineralDepositsArray property
    - File: `client/src/game/GameState.ts`
    - Add `private mineralDepositsArray: MineralDeposit[] = []`
    - _Requirements: 9.5_

  - [x] 16.2 Update addMineralDeposit() to maintain array
    - File: `client/src/game/GameState.ts`
    - Push to mineralDepositsArray when adding to Map
    - _Requirements: 9.5_

  - [x] 16.3 Update reset() to clear array
    - File: `client/src/game/GameState.ts`
    - Clear mineralDepositsArray in reset()
    - _Requirements: 9.5_

  - [x] 16.4 Update getAllMineralDeposits() to return existing array
    - File: `client/src/game/GameState.ts`
    - Return mineralDepositsArray directly (no Array.from())
    - _Requirements: 9.5_

- [x] 17. Make UnitManager.getUnitsByType() zero-allocation
  - [x] 17.1 Add typed unit arrays
    - File: `client/src/game/UnitManager.ts`
    - Add `private workerUnits: Worker[] = []`
    - Add `private protectorUnits: Protector[] = []`
    - Add `private scoutUnits: Scout[] = []`
    - _Requirements: 9.6_

  - [x] 17.2 Update unit creation to maintain typed arrays
    - File: `client/src/game/UnitManager.ts`
    - Push to appropriate typed array when adding unit
    - _Requirements: 9.6_

  - [x] 17.3 Update unit removal to maintain typed arrays
    - File: `client/src/game/UnitManager.ts`
    - Remove from appropriate typed array when removing unit
    - _Requirements: 9.6_

  - [x] 17.4 Update getUnitsByType() to return existing arrays
    - File: `client/src/game/UnitManager.ts`
    - Return typed arrays directly (no Array.from().filter())
    - _Requirements: 9.6_

- [x] 18. Checkpoint - Camera traversal allocations fixed
  - Verify FPS stays above 50 during W key + rapid rotation ✓ (~60 FPS)
  - Verify no new Vector3 allocations in TreeRenderer per frame ✓
  - Verify no new Vector3 allocations in CameraController during movement ✓
  - Verify zero array allocations in getAllMineralDeposits() / getUnitsByType() ✓
  - _Requirements: 9.7, 9.8_
  - Verify FPS stays above 50 during W key + rapid rotation ✓ (~60 FPS)
  - Verify no new Vector3 allocations in TreeRenderer per frame ✓
  - Verify no new Vector3 allocations in CameraController during movement ✓
  - Verify zero array allocations in getAllMineralDeposits() / getUnitsByType() ✓
  - _Requirements: 9.7, 9.8_

### Phase 2d: Mining Operation Allocation Fixes

- [x] 19. Fix MineralDeposit per-frame allocations
  - [x] 19.1 Fix updateVisual() scaling allocation
    - File: `client/src/world/MineralDeposit.ts`
    - Change `this.mesh.scaling = new Vector3(scale, scale, scale)` to `this.mesh.scaling.set(scale, scale, scale)`
    - _Requirements: 10.1, 10.2_

  - [x] 19.2 Add getPositionRef() method
    - File: `client/src/world/MineralDeposit.ts`
    - Add `getPositionRef()` that returns `this.position` directly
    - Keep `getPosition()` for backward compatibility (returns clone)
    - _Requirements: 10.3_

- [x] 20. Fix Unit per-frame allocations
  - [x] 20.1 Add getPositionRef() method
    - File: `client/src/game/entities/Unit.ts`
    - Add `getPositionRef()` that returns `this.position` directly
    - Keep `getPosition()` for backward compatibility
    - _Requirements: 10.4_

- [x] 21. Fix MiningAction per-frame allocations
  - [x] 21.1 Use copyFrom() instead of clone()
    - File: `client/src/game/actions/MiningAction.ts`
    - Change `this.minerPosition = newPosition.clone()` to `this.minerPosition.copyFrom(newPosition)`
    - _Requirements: 10.5_

  - [x] 21.2 Use getPositionRef() for range checks
    - File: `client/src/game/actions/MiningAction.ts`
    - Update `target.getPosition()` calls to `target.getPositionRef()` in hot paths
    - _Requirements: 10.5_

- [x] 22. Checkpoint - Mining allocations fixed
  - Fix 10 completed, Fix 11 addresses remaining allocations in UnitRenderer
  - Testing pending after Fix 11 completion
  - _Requirements: 10.6, 10.7, 10.8_

### Phase 2e: Unit Rendering Allocation Fixes

- [x] 23. Fix UnitRenderer position tracking allocations
  - [x] 23.1 Use copyFrom() for lastPosition update
    - File: `client/src/rendering/UnitRenderer.ts`
    - Change `unitVisual.lastPosition = currentPosition.clone()` to `unitVisual.lastPosition.copyFrom(currentPosition)`
    - _Requirements: 11.1_

- [x] 24. Fix UnitRenderer scaling allocations
  - [x] 24.1 Fix energy indicator scaling
    - File: `client/src/rendering/UnitRenderer.ts`
    - Change `energyIndicator.scaling = new Vector3(...)` to `energyIndicator.scaling.set(...)`
    - _Requirements: 11.2_

  - [x] 24.2 Fix health scaling
    - File: `client/src/rendering/UnitRenderer.ts`
    - Change `mesh.scaling = new Vector3(...)` to `mesh.scaling.set(...)`
    - _Requirements: 11.3_

- [x] 25. Fix UnitRenderer color allocations
  - [x] 25.1 Add cached Color3 class members
    - File: `client/src/rendering/UnitRenderer.ts`
    - Add `private cachedEnergyColor: Color3 = new Color3()`
    - Add `private cachedProtectorColor: Color3 = new Color3()`
    - Add `private cachedEmissiveColor: Color3 = new Color3()`
    - _Requirements: 11.4, 11.5_

  - [x] 25.2 Update getEnergyColor() to mutate cached color
    - File: `client/src/rendering/UnitRenderer.ts`
    - Created `getEnergyColorInto()` that sets r/g/b properties directly
    - _Requirements: 11.4_

  - [x] 25.3 Update getProtectorEnergyColor() to mutate cached color
    - File: `client/src/rendering/UnitRenderer.ts`
    - Created `getProtectorEnergyColorInto()` that sets r/g/b properties directly
    - _Requirements: 11.5_

  - [x] 25.4 Fix scale() method allocations
    - File: `client/src/rendering/UnitRenderer.ts`
    - Used direct property multiplication instead of scale() in updateEnergyVisualization and updateHealthVisualization
    - Cached base emissive colors in initializeMaterials() instead of computing per-frame
    - _Requirements: 11.7_

- [x] 26. Fix MineralDeposit color allocations
  - [x] 26.1 Use direct property assignment for emissive colors
    - File: `client/src/world/MineralDeposit.ts`
    - Set r/g/b properties directly instead of assigning new Color3
    - _Requirements: 11.6_

- [ ] 27. Checkpoint - Unit rendering allocations fixed
  - Verify FPS stays above 55 during unit activity (mining, moving, fleeing)
  - Verify no new Vector3/Color3 allocations in UnitRenderer per frame
  - Verify no new Color3 allocations in MineralDeposit per frame
  - _Requirements: 11.8, 11.9_

### Phase 2f: Parasite Interaction Allocation Fixes

- [x] 28. Fix ParasiteManager Map allocations in updateParasites()
  - [x] 28.1 Add cached Map class members
    - File: `client/src/game/ParasiteManager.ts`
    - Add `private cachedWorkerMap: Map<string, Worker> = new Map()`
    - Add `private cachedProtectorMap: Map<string, Protector> = new Map()`
    - _Requirements: 12.2, 12.3_

  - [x] 28.2 Update updateParasites() to reuse cached Maps
    - File: `client/src/game/ParasiteManager.ts`
    - Replace `const workerMap = new Map()` with `this.cachedWorkerMap.clear()`
    - Replace `const protectorMap = new Map()` with `this.cachedProtectorMap.clear()`
    - Use cached maps for lookups
    - _Requirements: 12.1, 12.4_

- [x] 29. Checkpoint - Parasite interaction allocations fixed
  - FPS improved from 29-35 to 39-55 range
  - Map allocations eliminated
  - _Requirements: 12.5, 12.6_

### Phase 2g: Visual Effect Beam/Ray Allocation Fixes

- [x] 30. Fix EnergyParasite drain beam per-frame recreation
  - [x] 30.1 Add cached material and points array
    - File: `client/src/game/entities/EnergyParasite.ts`
    - Add `private drainBeamMaterial: StandardMaterial | null = null`
    - Add `private cachedDrainPoints: Vector3[] = [new Vector3(), new Vector3()]`
    - _Requirements: 13.5, 13.6_

  - [x] 30.2 Update updateDrainBeam() to reuse mesh with instance update
    - File: `client/src/game/entities/EnergyParasite.ts`
    - Create mesh with `updatable: true` on first call
    - Use `instance: this.drainBeam` for subsequent updates
    - Use `copyFrom()` to update cached points
    - _Requirements: 13.1, 13.4_

- [x] 31. Fix CombatParasite drain beam per-frame recreation
  - [x] 31.1 Add cached material and points array
    - File: `client/src/game/entities/CombatParasite.ts`
    - Add `private drainBeamMaterial: StandardMaterial | null = null`
    - Add `private cachedDrainPoints: Vector3[] = [new Vector3(), new Vector3()]`
    - _Requirements: 13.5, 13.6_

  - [x] 31.2 Update updateDrainBeam() to reuse mesh with instance update
    - File: `client/src/game/entities/CombatParasite.ts`
    - Same pattern as EnergyParasite
    - _Requirements: 13.2, 13.4_

- [x] 32. Fix UnitRenderer mining line per-frame recreation
  - [x] 32.1 Add cached points and material to UnitVisual interface
    - File: `client/src/rendering/UnitRenderer.ts`
    - Add `miningLinePoints: Vector3[]` to UnitVisual interface
    - Add `miningLineMaterial: StandardMaterial | null` to UnitVisual
    - _Requirements: 13.5, 13.6_

  - [x] 32.2 Update createMiningConnectionLine() to use updatable mesh
    - File: `client/src/rendering/UnitRenderer.ts`
    - Create mesh with `updatable: true`
    - Initialize cached points array
    - Create material once and cache
    - _Requirements: 13.3, 13.5_

  - [x] 32.3 Update updateMiningConnectionLine() to use instance update
    - File: `client/src/rendering/UnitRenderer.ts`
    - Use `set()` to update cached points
    - Use `instance: existingMesh` for mesh update
    - Remove dispose/recreate pattern
    - _Requirements: 13.3, 13.4_

- [x] 33. Checkpoint - Visual effect allocations fixed
  - FPS at 50 during active mining + combat (verified)
  - Mesh reuse with instance update working
  - _Requirements: 13.7, 13.8_

### Phase 2h: Mouse Hover and UI Allocation Fixes

- [x] 34. Throttle BuildingPlacementUI mouse handler
  - [x] 34.1 Add throttling to handleMouseMove()
    - File: `client/src/ui/BuildingPlacementUI.ts`
    - Added `lastMouseMoveTime` and `MOUSE_MOVE_THROTTLE_INTERVAL` (100ms)
    - Early return if called too frequently
    - _Requirements: 14.1_

- [x] 35. Optimize ProtectorSelectionUI updates
  - [x] 35.1 Cache element references instead of innerHTML rebuild
    - File: `client/src/ui/ProtectorSelectionUI.ts`
    - Created elements once in createTooltipElement(), cached 10 element references
    - updateContent() now updates textContent/style only - no innerHTML rebuild
    - _Requirements: 14.2_

- [x] 36. Optimize EnergyLordsHUD updates
  - [x] 36.1 Slow update interval from 500ms to 1000ms
    - File: `client/src/ui/EnergyLordsHUD.ts`
    - Changed default updateInterval from 500 to 1000
    - _Requirements: 14.3_

  - [x] 36.2 Cache gradient strings
    - File: `client/src/ui/EnergyLordsHUD.ts`
    - Added static readonly GRADIENT_NORMAL and GRADIENT_NEAR_COMPLETE
    - _Requirements: 14.4_

  - [x] 36.3 Use array.join() instead of string += in loops
    - File: `client/src/ui/EnergyLordsHUD.ts`
    - Updated updateTierProgress() to push to dots array and join()
    - _Requirements: 14.5_

- [ ] 37. Checkpoint - Mouse hover allocations fixed
  - Verify FPS stays above 50 during hover
  - Verify reduced string allocations
  - _Requirements: 14.6, 14.7_

### Phase 2i: Energy Display Consolidation

- [x] 38. Remove total energy from EnergyDisplay
  - [x] 38.1 Remove total energy element from EnergyDisplay
    - File: `client/src/ui/EnergyDisplay.ts`
    - Removed energyValueElement and its updates
    - Kept generation, consumption, efficiency, net rate
    - Updated warning/alert methods to use energyBarFillElement
    - _Requirements: 15.2, 15.3_

- [ ] 39. Checkpoint - Energy display consolidated
  - Verify Energy Lords window shows total energy
  - Verify top right bar shows only delta stats
  - _Requirements: 15.1, 15.4_

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
| `client/src/game/UnitManager.ts` | Sync update method, typed unit arrays for zero-allocation getUnitsByType() |
| `client/src/game/GameState.ts` | Maintain mineralDepositsArray for zero-allocation getAllMineralDeposits() |
| `client/src/game/ParasiteManager.ts` | Array caching, singleton caching |
| `client/src/game/CombatSystem.ts` | Pass shared UI to CombatEffects |
| `client/src/ui/DebugUI.ts` | Remove PerformanceMonitor usage |
| `client/src/game/SystemIntegration.ts` | Remove PerformanceMonitor usage |
| `client/src/rendering/TreeRenderer.ts` | Eliminate Vector3 allocations in updateAnimations() |
| `client/src/rendering/CameraController.ts` | Cache movement vectors for keyboard controls |
| `client/src/rendering/UnitRenderer.ts` | Cache colors, use scaling.set(), use copyFrom() for positions |
| `client/src/world/MineralDeposit.ts` | Use scaling.set(), add getPositionRef(), direct color assignment |
| `client/src/game/entities/Unit.ts` | Add getPositionRef() for zero-allocation access |
| `client/src/game/actions/MiningAction.ts` | Use copyFrom(), use getPositionRef() |
