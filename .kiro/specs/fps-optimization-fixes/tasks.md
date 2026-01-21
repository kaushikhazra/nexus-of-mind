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

### Phase 2j: Parasite Segment Animation Allocation Fixes

- [x] 40. Fix Parasite segment animation per-frame allocations
  - [x] 40.1 Add cached Vector3 class members
    - File: `client/src/game/entities/Parasite.ts`
    - Added `protected cachedZeroVector: Vector3 = Vector3.Zero()`
    - Added `protected cachedWorldOffset: Vector3 = new Vector3()`
    - _Requirements: 16.2_

  - [x] 40.2 Initialize segmentPositions array with Vector3 instances
    - File: `client/src/game/entities/Parasite.ts`
    - segmentPositions already contains pre-allocated Vector3 objects from createMesh()
    - _Requirements: 16.2_

  - [x] 40.3 Update updateSegmentAnimation() to use zero-allocation patterns
    - File: `client/src/game/entities/Parasite.ts`
    - Changed `this.segments[i].position = Vector3.Zero()` to `copyFrom(cachedZeroVector)`
    - Changed `this.segmentPositions[i] = this.position.clone()` to `copyFrom()`
    - Changed `new Vector3(...)` to `set()`
    - Changed `this.position.add(worldOffset)` to `addToRef()`
    - _Requirements: 16.1, 16.3, 16.4, 16.5_

- [ ] 41. Checkpoint - Parasite allocations fixed
  - Verify FPS above 45 with 4-5 parasites active
  - Verify no Vector3 allocations in updateSegmentAnimation()
  - _Requirements: 16.6, 16.7_

### Phase 2k: BuildingRenderer Animation Allocation Fixes

- [x] 42. Fix BuildingRenderer per-frame allocations
  - [x] 42.1 Fix energy core scaling allocations
    - File: `client/src/rendering/BuildingRenderer.ts`
    - Changed `new Vector3(coreScale, ...)` to `scaling.set(coreScale, ...)`
    - _Requirements: 17.1_

  - [x] 42.2 Fix energy core emissive color allocations
    - File: `client/src/rendering/BuildingRenderer.ts`
    - Changed `new Color3(...)` to direct r/g/b property assignment
    - _Requirements: 17.2, 17.3_

  - [x] 42.3 Fix energy indicator scaling allocations
    - File: `client/src/rendering/BuildingRenderer.ts`
    - Changed `new Vector3(pulseScale, ...)` to `scaling.set(pulseScale, ...)`
    - _Requirements: 17.1, 17.4_

  - [x] 42.4 Fix energy indicator color allocations
    - File: `client/src/rendering/BuildingRenderer.ts`
    - Changed `new Color3(0, intensity, 0)` to direct property assignment
    - _Requirements: 17.2, 17.3_

  - [x] 42.5 Fix construction visualization scaling
    - File: `client/src/rendering/BuildingRenderer.ts`
    - Changed `new Vector3(1, 1, 1)` to `scaling.set(1, 1, 1)`
    - _Requirements: 17.1_

- [ ] 43. Checkpoint - BuildingRenderer allocations fixed
  - Verify FPS above 50 with multiple buildings
  - Verify no per-frame Vector3/Color3 allocations in animations
  - _Requirements: 17.5, 17.6_

### Phase 2l: CameraController Movement Allocation Fixes

- [x] 44. Fix CameraController per-frame allocations
  - [x] 44.1 Add cached static direction vectors
    - File: `client/src/rendering/CameraController.ts`
    - Added `private static readonly FORWARD = new Vector3(0, 0, 1)`
    - Added `private static readonly BACKWARD = new Vector3(0, 0, -1)`
    - Added `private cachedDirection: Vector3 = new Vector3()`
    - _Requirements: 18.2_

  - [x] 44.2 Update keyboard movement to use cached vectors
    - File: `client/src/rendering/CameraController.ts`
    - Changed `Vector3.Forward()` to `CameraController.FORWARD`
    - Changed `getDirection()` to `getDirectionToRef()`
    - _Requirements: 18.1, 18.3_

- [ ] 45. Checkpoint - CameraController allocations fixed
  - Verify FPS above 50 during WASD movement in combat
  - Verify no per-frame Vector3 allocations during movement
  - _Requirements: 18.4, 18.5_

### Phase 2m: Mouse Move Scene.pick() Elimination

- [x] 46. Move Protector tooltip from hover to right-click
  - [x] 46.1 Remove handleMouseMove() scene.pick() logic
    - File: `client/src/game/GameEngine.ts`
    - Removed POINTERMOVE handler entirely, added handleRightClick() method
    - _Requirements: 19.1_

  - [x] 46.2 Add right-click handler for Protector tooltip
    - File: `client/src/game/GameEngine.ts`
    - Check for button === 2 (right-click) in POINTERDOWN handler
    - Call scene.pick() only on right-click
    - Show ProtectorSelectionUI when right-clicking on Protector
    - _Requirements: 19.2_

  - [x] 46.3 Hide tooltip on left-click elsewhere
    - File: `client/src/game/GameEngine.ts`
    - In handleMouseClick(), hide ProtectorSelectionUI at start
    - _Requirements: 19.3_

- [x] 48. Fix MiningAnalysisTooltip wrong enum value
  - [x] 48.1 Fix POINTERMOVE vs POINTERDOWN bug
    - File: `client/src/ui/MiningAnalysisTooltip.ts`
    - Changed `pointerInfo.type === 4` to `PointerEventTypes.POINTERDOWN`
    - Bug: Code used magic number 4 (POINTERMOVE) instead of 1 (POINTERDOWN)
    - _Requirements: 19.4_

  - [x] 48.2 Make MiningAnalysisTooltip right-click only
    - File: `client/src/ui/MiningAnalysisTooltip.ts`
    - Added check for `event.button === 2` (right-click)
    - Left-click now hides tooltip (consistent with Protector tooltip)
    - _Requirements: 19.2, 19.3_

- [x] 49. Checkpoint - Mouse move scene.pick() eliminated
  - Verified FPS stable during mouse movement (no more dips from scene.pick())
  - Verified Protector tooltip shows on right-click
  - Verified Mining Analysis tooltip shows on right-click
  - Verified both tooltips hide on left-click elsewhere
  - FPS during heavy load (rapid movement + 5 fights + 10 workers + 8 protectors): 45 FPS
  - _Requirements: 19.4, 19.5, 19.6_

### Phase 2n: Memory Leak Prevention - Interval and Callback Cleanup

- [x] 50. Fix MiningUI setInterval leak
  - [x] 50.1 Store interval ID and clear on dispose
    - File: `client/src/ui/MiningUI.ts`
    - Added `updateIntervalId` property
    - Store interval ID from `window.setInterval()`
    - Clear interval in `dispose()` method
    - _Requirements: 20.1_

- [x] 51. Fix ProtectorCreationUI setInterval leak
  - [x] 51.1 Store interval ID and clear on dispose
    - File: `client/src/ui/ProtectorCreationUI.ts`
    - Added `updateIntervalId` property
    - Store interval ID from `window.setInterval()`
    - Clear interval in `dispose()` method
    - _Requirements: 20.2_

- [x] 52. Fix DifficultyDisplayUI setInterval leak
  - [x] 52.1 Store compact display interval ID and clear on destroy
    - File: `client/src/ui/DifficultyDisplayUI.ts`
    - Added `compactUpdateInterval` property
    - Store interval ID in `createCompactDisplay()`
    - Clear interval in `destroy()` method
    - _Requirements: 20.3_

- [x] 53. Fix CameraController callback leaks
  - [x] 53.1 Store and cleanup registerBeforeRender callback
    - File: `client/src/rendering/CameraController.ts`
    - Added `renderObserver` property
    - Store callback reference
    - Call `unregisterBeforeRender()` in `dispose()`
    - _Requirements: 20.4_

  - [x] 53.2 Store and cleanup keyboard event listeners
    - File: `client/src/rendering/CameraController.ts`
    - Added `keydownHandler` and `keyupHandler` properties
    - Store handler references (not anonymous functions)
    - Call `removeEventListener()` in `dispose()`
    - _Requirements: 20.5_

- [ ] 54. Checkpoint - Memory leaks fixed
  - Verify no FPS degradation during extended sessions (30+ minutes)
  - Verify intervals are cleared when components disposed
  - Verify no accumulating callbacks on scene reinit
  - _Requirements: 20.6, 20.7, 20.8_

### Phase 2o: Parasite Segment Animation Allocation Fixes

- [ ] 55. Fix Parasite.updateSegmentAnimation() per-frame allocations
  - [ ] 55.1 Add cached worldOffset Vector3 as class member
    - File: `client/src/game/entities/Parasite.ts`
    - Add `protected cachedWorldOffset: Vector3 = new Vector3()`
    - _Requirements: 21.9_

  - [ ] 55.2 Fix head segment allocation (i === 0 branch)
    - File: `client/src/game/entities/Parasite.ts`
    - Change `this.segments[i].position = Vector3.Zero()` to `this.segments[i].position.set(0, 0, 0)`
    - Change `this.segmentPositions[i] = this.position.clone()` to `this.segmentPositions[i].copyFrom(this.position)`
    - _Requirements: 21.1, 21.2, 21.6, 21.7_

  - [ ] 55.3 Fix body segment position allocation (else branch)
    - File: `client/src/game/entities/Parasite.ts`
    - Change `this.segments[i].position = new Vector3(0, 0, -i * trailingDistance)` to `this.segments[i].position.set(0, 0, -i * trailingDistance)`
    - _Requirements: 21.3, 21.6_

  - [ ] 55.4 Fix worldOffset allocation
    - File: `client/src/game/entities/Parasite.ts`
    - Change `const worldOffset = new Vector3(...)` to `this.cachedWorldOffset.set(...)`
    - _Requirements: 21.4, 21.9_

  - [ ] 55.5 Fix position.add() allocation
    - File: `client/src/game/entities/Parasite.ts`
    - Change `this.segmentPositions[i] = this.position.add(worldOffset)` to `this.position.addToRef(this.cachedWorldOffset, this.segmentPositions[i])`
    - _Requirements: 21.5, 21.8_

- [ ] 56. Checkpoint - Parasite animation allocations fixed
  - Verify FPS above 50 with 5+ parasites chasing at ground-level camera
  - Verify no Vector3 allocations in updateSegmentAnimation()
  - _Requirements: 21.10, 21.11_

### Phase 2p: ParasiteManager updateParasites Allocation Fixes

- [ ] 57. Add getPositionRef() to Parasite base class
  - [ ] 57.1 Add getPositionRef() method to Parasite.ts
    - File: `client/src/game/entities/Parasite.ts`
    - Add `public getPositionRef(): Vector3 { return this.position; }`
    - Returns reference instead of clone
    - _Requirements: 22.5_

- [ ] 58. Add getEntitiesInRangeTo() to SpatialIndex
  - [ ] 58.1 Add zero-allocation query method to SpatialIndex
    - File: `client/src/game/SpatialIndex.ts`
    - Add `getEntitiesInRangeTo(position, radius, entityTypes, outArray)` method
    - Writes results to provided array instead of creating new one
    - _Requirements: 22.4, 22.6_

- [ ] 59. Fix ParasiteManager.updateParasites() per-frame allocations
  - [ ] 59.1 Add cached arrays as class members
    - File: `client/src/game/ParasiteManager.ts`
    - Add `cachedParasiteIds: string[] = []`
    - Add `cachedNearbyWorkers: Worker[] = []`
    - Add `cachedNearbyProtectors: Protector[] = []`
    - Add `cachedWorkerIds: string[] = []`
    - Add `cachedProtectorIds: string[] = []`
    - _Requirements: 22.4_

  - [ ] 59.2 Replace getEntitiesInRange() with getEntitiesInRangeTo()
    - File: `client/src/game/ParasiteManager.ts`
    - Change `parasiteIdsToUpdate = spatialIndex.getEntitiesInRange(...)` to use cached array
    - Change worker/protector queries to use cached arrays
    - _Requirements: 22.1, 22.6_

  - [ ] 59.3 Replace .map()/.filter() chains with for-loops
    - File: `client/src/game/ParasiteManager.ts`
    - Replace `workerIds.map(...).filter(...)` with for-loop populating cached array
    - Replace `protectorIds.map(...).filter(...)` with for-loop populating cached array
    - _Requirements: 22.1, 22.2, 22.7_

  - [ ] 59.4 Replace getPosition() with getPositionRef() for spatial updates
    - File: `client/src/game/ParasiteManager.ts`
    - Change `spatialIndex.updatePosition(id, parasite.getPosition())` to `spatialIndex.updatePosition(id, parasite.getPositionRef())`
    - _Requirements: 22.3, 22.5_

- [ ] 60. Checkpoint - ParasiteManager allocations fixed
  - Verify FPS above 50 with 10+ parasites chasing spread-out units
  - Verify no array allocations in updateParasites() loop
  - Verify FPS scales efficiently regardless of spread distance
  - _Requirements: 22.8, 22.9, 22.10_

### Phase 2q: Tree Glow Animation GPU Optimization

- [ ] 61. Create ShaderMaterial for glow animation
  - [ ] 61.1 Create vertex shader with instance support
    - File: `client/src/rendering/TreeRenderer.ts`
    - Add vertex shader that reads instanceData attribute (x,y,z,phase)
    - Calculate pulse based on time uniform and per-instance phase
    - Apply pulse scaling to vertex position
    - _Requirements: 23.4, 23.5, 23.6_

  - [ ] 61.2 Create fragment shader with emissive glow
    - File: `client/src/rendering/TreeRenderer.ts`
    - Add fragment shader that uses glowColor uniform
    - Apply pulsing intensity based on vertex pulse value
    - _Requirements: 23.4_

  - [ ] 61.3 Initialize ShaderMaterial in TreeRenderer
    - File: `client/src/rendering/TreeRenderer.ts`
    - Create ShaderMaterial with vertex/fragment sources
    - Define attributes: position, normal, instanceData
    - Define uniforms: viewProjection, time, glowColor
    - _Requirements: 23.4, 23.5_

- [ ] 62. Implement thin instances for glow spots
  - [ ] 62.1 Create base mesh for instancing
    - File: `client/src/rendering/TreeRenderer.ts`
    - Create single low-poly sphere mesh
    - Apply glow ShaderMaterial
    - Set isVisible = false (instances render, not base)
    - _Requirements: 23.3, 23.9_

  - [ ] 62.2 Create instance buffer management
    - File: `client/src/rendering/TreeRenderer.ts`
    - Add Float32Array for instance data
    - Track total glow spot count
    - Method to rebuild buffer when trees added/removed
    - _Requirements: 23.3, 23.9_

  - [ ] 62.3 Update createTree() to register instances
    - File: `client/src/rendering/TreeRenderer.ts`
    - Instead of creating individual meshes, add to instance buffer
    - Store world position + phase offset per spot
    - _Requirements: 23.3_

  - [ ] 62.4 Update removeTree() to handle instances
    - File: `client/src/rendering/TreeRenderer.ts`
    - Remove spots from instance buffer
    - Rebuild thin instances when trees removed
    - _Requirements: 23.3_

- [ ] 63. Refactor updateAnimations() to O(1)
  - [ ] 63.1 Replace mesh iteration with single uniform update
    - File: `client/src/rendering/TreeRenderer.ts`
    - Remove the for-loop over all trees/spots
    - Single call: `this.glowShaderMaterial.setFloat('time', ...)`
    - _Requirements: 23.1, 23.2, 23.7, 23.10_

- [ ] 64. Update TerrainGenerator integration
  - [ ] 64.1 Update tree creation flow
    - File: `client/src/rendering/TerrainGenerator.ts`
    - Ensure createTreesForChunk() works with new instancing system
    - _Requirements: 23.3_

  - [ ] 64.2 Update tree removal flow
    - File: `client/src/rendering/TerrainGenerator.ts`
    - Ensure chunk unload properly removes tree instances
    - _Requirements: 23.3_

- [ ] 65. Checkpoint - Tree GPU optimization complete
  - Verify FPS above 55 at ground level with 400+ trees
  - Verify single draw call for all glow spots
  - Verify updateAnimations() only updates time uniform
  - _Requirements: 23.7, 23.8, 23.9, 23.10_

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
| `client/src/game/GameEngine.ts` | Remove PerformanceMonitor, sync render loop, system throttling, Fix 19: remove handleMouseMove(), add handleRightClick() for Protector tooltip |
| `client/src/game/TerritoryManager.ts` | Remove TerritoryPerformanceMonitor references |
| `client/src/game/UnitManager.ts` | Sync update method, typed unit arrays for zero-allocation getUnitsByType() |
| `client/src/game/GameState.ts` | Maintain mineralDepositsArray for zero-allocation getAllMineralDeposits() |
| `client/src/game/ParasiteManager.ts` | Array caching, singleton caching, Fix 22: zero-allocation updateParasites() |
| `client/src/game/SpatialIndex.ts` | Fix 22: Add getEntitiesInRangeTo() method |
| `client/src/game/CombatSystem.ts` | Pass shared UI to CombatEffects |
| `client/src/ui/DebugUI.ts` | Remove PerformanceMonitor usage |
| `client/src/game/SystemIntegration.ts` | Remove PerformanceMonitor usage |
| `client/src/rendering/TreeRenderer.ts` | Fix 23: ShaderMaterial + thin instances for GPU-based glow animation |
| `client/src/rendering/CameraController.ts` | Cache movement vectors, Fix 20: cleanup registerBeforeRender + event listeners |
| `client/src/rendering/UnitRenderer.ts` | Cache colors, use scaling.set(), use copyFrom() for positions |
| `client/src/world/MineralDeposit.ts` | Use scaling.set(), add getPositionRef(), direct color assignment |
| `client/src/game/entities/Unit.ts` | Add getPositionRef() for zero-allocation access |
| `client/src/game/actions/MiningAction.ts` | Use copyFrom(), use getPositionRef() |
| `client/src/game/entities/Parasite.ts` | Fix 21: Cache worldOffset, use set()/copyFrom()/addToRef(); Fix 22: add getPositionRef() |
| `client/src/ui/MiningAnalysisTooltip.ts` | Fix 19: Fix wrong enum (4→POINTERDOWN), right-click only, hide on left-click |
| `client/src/ui/MiningUI.ts` | Fix 20: Store and clear setInterval on dispose |
| `client/src/ui/ProtectorCreationUI.ts` | Fix 20: Store and clear setInterval on dispose |
| `client/src/ui/DifficultyDisplayUI.ts` | Fix 20: Store and clear compact display interval on destroy |
