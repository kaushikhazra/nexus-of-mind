# FPS Optimization Fixes - Design Document

## Overview

This design addresses 9 performance issues: 3 memory leaks causing FPS degradation over time, and 6 per-frame/event bottlenecks causing low baseline FPS. The target is stable 60 FPS (+/- 5) throughout extended gameplay sessions.

## Problem Analysis

### Current Performance Profile

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CURRENT FPS BEHAVIOR                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FPS                                                                        │
│   60 ┤                                                                      │
│   50 ┤ ████                                                                 │
│   40 ┤ ████████                                                             │
│   30 ┤ ████████████████                                                     │
│   20 ┤ ████████████████████████████████                                     │
│   10 ┤ ████████████████████████████████████████████████                     │
│    0 ┼─────────────────────────────────────────────────────────────────     │
│      0min    15min    30min    45min    60min                               │
│                                                                             │
│  Baseline: 25-38 FPS (should be 60)                                         │
│  After 1hr: 12 FPS (memory leak effect)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Root Causes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ISSUE CLASSIFICATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MEMORY LEAKS (FPS decay over time)          PER-FRAME BOTTLENECKS          │
│  ─────────────────────────────────           ─────────────────────          │
│                                                                             │
│  1. CombatEffects cloned materials           4. Async in render loop        │
│     - Every laser beam clones material          - await unitManager.update  │
│     - Material NOT disposed on cleanup          - Causes microtask delays   │
│     - Accumulates in GPU memory                                             │
│                                              5. 12+ systems at 60Hz         │
│  2. Duplicate fullscreen UI                     - Most don't need 60Hz      │
│     - CombatEffects creates own UI              - Wasted CPU cycles         │
│     - GameEngine already has MainUI                                         │
│                                              6. Per-frame allocations       │
│  3. PerformanceMonitor setInterval              - filter/map/sort/slice     │
│     - Never cleared on dispose                  - Creates GC pressure       │
│     - Minor leak but still a leak                                           │
│                                              7. Repeated getInstance()      │
│                                                 - Called multiple times     │
│                                                 - Per frame overhead        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Architecture

### Fix 1: Combat Effects Material Disposal

```typescript
// CombatEffects.ts - BEFORE (leak)
public createEnergyBeam(config: EnergyBeamConfig): string {
    const beam = this.createBeamLine(...);
    beam.material = this.beamMaterial.clone(`beam_material_${effectId}`);  // LEAK!
    effects.push(beam);
    this.activeEffects.set(effectId, effects);
    // Material reference lost - never disposed
}

public removeEffect(effectId: string): void {
    const effects = this.activeEffects.get(effectId);
    for (const effect of effects) {
        effect.dispose();  // Mesh disposed, but NOT material!
    }
}

// CombatEffects.ts - AFTER (fixed)
private effectMaterials: Map<string, Material[]> = new Map();  // Track materials

public createEnergyBeam(config: EnergyBeamConfig): string {
    const beam = this.createBeamLine(...);
    const clonedMaterial = this.beamMaterial.clone(`beam_material_${effectId}`);
    beam.material = clonedMaterial;

    // Track material for disposal
    if (!this.effectMaterials.has(effectId)) {
        this.effectMaterials.set(effectId, []);
    }
    this.effectMaterials.get(effectId)!.push(clonedMaterial);

    effects.push(beam);
    this.activeEffects.set(effectId, effects);
}

public removeEffect(effectId: string): void {
    // Dispose materials FIRST
    const materials = this.effectMaterials.get(effectId);
    if (materials) {
        for (const material of materials) {
            material.dispose();
        }
        this.effectMaterials.delete(effectId);
    }

    // Then dispose meshes
    const effects = this.activeEffects.get(effectId);
    if (effects) {
        for (const effect of effects) {
            effect.dispose();
        }
        this.activeEffects.delete(effectId);
    }
}
```

### Fix 2: Shared UI Texture

```typescript
// CombatEffects.ts - BEFORE (duplicate UI)
export class CombatEffects {
    private advancedTexture: AdvancedDynamicTexture | null = null;

    private setupUI(): void {
        // Creates SECOND fullscreen UI!
        this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('combat_ui');
    }
}

// CombatEffects.ts - AFTER (shared UI)
export class CombatEffects {
    private advancedTexture: AdvancedDynamicTexture | null = null;

    constructor(scene: Scene, sharedUI?: AdvancedDynamicTexture) {
        this.scene = scene;
        this.advancedTexture = sharedUI || null;  // Use shared, don't create
        this.initialize();
    }

    private setupUI(): void {
        // Only create if not provided (fallback)
        if (!this.advancedTexture) {
            this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('combat_ui');
            this.ownsUI = true;  // Track ownership for disposal
        }
    }

    public dispose(): void {
        // Only dispose if we created it
        if (this.advancedTexture && this.ownsUI) {
            this.advancedTexture.dispose();
        }
    }
}

// CombatSystem.ts - Pass shared UI
this.combatEffects = new CombatEffects(scene, gameEngine.getGUITexture());
```

### Fix 3: Remove PerformanceMonitor Entirely

The PerformanceMonitor adds complexity and overhead without providing value beyond what FPSCounter already offers. Instead of fixing its interval leak, we remove it entirely.

**Rationale:**
- FPSCounter already provides FPS display (simpler, toggleable)
- PerformanceMonitor runs `registerBeforeRender` every frame
- Stores 60 samples of metrics history
- Has leaked setInterval
- TerritoryPerformanceMonitor depends on it (also remove)

```
FILES TO REMOVE:
├── client/src/utils/PerformanceMonitor.ts          (main file)
└── client/src/game/TerritoryPerformanceMonitor.ts  (depends on above)

FILES TO MODIFY (remove references):
├── client/src/game/GameEngine.ts
│   - Remove import
│   - Remove performanceMonitor property
│   - Remove initialization
│   - Remove getPerformanceMonitor() method
│   - Remove startMonitoring()/stopMonitoring() calls
│   - Remove dispose() call
│
├── client/src/game/TerritoryManager.ts
│   - Remove TerritoryPerformanceMonitor import
│   - Remove performanceMonitor property
│   - Remove initialization in initialize()
│   - Remove getPerformanceMonitor() method
│
├── client/src/ui/DebugUI.ts
│   - Remove/update code using getPerformanceMonitor()
│
├── client/src/game/SystemIntegration.ts
│   - Remove setupPerformanceMonitoring()
│   - Remove performanceMonitor usage
│
├── client/src/rendering/SceneManager.ts
│   - Remove comment reference (minor)
│
└── client/src/game/__tests__/*.ts
    - Update mocks in test files
```

### Fix 4: Synchronous Render Loop

```typescript
// GameEngine.ts - BEFORE (async in render loop)
this.engine.runRenderLoop(async () => {
    // ...
    await this.unitManager.update(deltaTime);  // BAD! Async in render loop
    // ...
});

// GameEngine.ts - AFTER (synchronous)
this.engine.runRenderLoop(() => {
    // ...
    this.unitManager.update(deltaTime);  // Synchronous
    // ...
});

// UnitManager.ts - Make update synchronous
// BEFORE
public async update(deltaTime: number): Promise<void> {
    await this.processCommands();
}

// AFTER
public update(deltaTime: number): void {
    this.processCommands();  // Make synchronous or queue async work
}

private processCommands(): void {
    // Process commands synchronously
    // If truly async work needed, queue for next frame
}
```

### Fix 5: System Update Throttling (Round-Robin)

Instead of checking all throttled systems every frame (which causes "burst" updates when multiple intervals align), we use a **round-robin** approach: check ONE system per frame.

**Why round-robin?**
- Checking all 4 systems every frame means when intervals align, all 4 update in one frame → micro-stutter
- Round-robin ensures **at most ONE** throttled update per frame
- Work naturally spreads across frames
- Gives control back to engine faster

```typescript
// GameEngine.ts - Round-robin throttling infrastructure

interface ThrottledSystem {
    name: string;
    interval: number;      // ms between updates
    lastUpdate: number;    // timestamp of last update
    update: () => void;    // update function
}

private throttledSystems: ThrottledSystem[] = [];
private currentSystemIndex: number = 0;

// Initialize in constructor or init method
private initThrottledSystems(): void {
    this.throttledSystems = [
        {
            name: 'energy',
            interval: 100,  // 10 Hz
            lastUpdate: 0,
            update: () => this.energyManager.update()
        },
        {
            name: 'territory',
            interval: 100,  // 10 Hz
            lastUpdate: 0,
            update: () => this.territoryManager.update(this.lastDeltaTime)
        },
        {
            name: 'liberation',
            interval: 200,  // 5 Hz
            lastUpdate: 0,
            update: () => this.liberationManager.updateLiberations(this.lastDeltaTime)
        },
        {
            name: 'energyLords',
            interval: 100,  // 10 Hz
            lastUpdate: 0,
            update: () => this.energyLordsManager.update(performance.now())
        },
    ];
}

// In render loop
this.engine.runRenderLoop(() => {
    const now = performance.now();

    // Always update (60 Hz) - critical for gameplay
    this.unitManager.update(deltaTime);
    this.parasiteManager.update(deltaTime, ...);
    this.combatSystem.update(deltaTime);

    // Round-robin: Check ONE throttled system per frame
    if (this.throttledSystems.length > 0) {
        // Guard: Clamp to valid range before access
        if (this.currentSystemIndex < 0 || this.currentSystemIndex >= this.throttledSystems.length) {
            this.currentSystemIndex = 0;
        }

        const system = this.throttledSystems[this.currentSystemIndex];

        if (now - system.lastUpdate >= system.interval) {
            system.update();
            system.lastUpdate = now;
        }

        // Move to next system for next frame
        this.currentSystemIndex = (this.currentSystemIndex + 1) % this.throttledSystems.length;
    }

    this.scene.render();
});
```

**Frame-by-frame example:**
```
Frame 1: Check energy     → 100ms elapsed? → Yes → Update energy
Frame 2: Check territory  → 100ms elapsed? → Yes → Update territory
Frame 3: Check liberation → 200ms elapsed? → No  → Skip
Frame 4: Check energyLords→ 100ms elapsed? → Yes → Update energyLords
Frame 5: Check energy     → 100ms elapsed? → No  → Skip (only ~67ms passed)
Frame 6: Check territory  → 100ms elapsed? → No  → Skip
...
```

**Result:** Maximum ONE throttled system update per frame, no burst updates.

### Fix 6: Per-frame Allocation Elimination

```typescript
// ParasiteManager.ts - BEFORE (allocations every frame)
public update(deltaTime: number, mineralDeposits: MineralDeposit[], ...): void {
    // Creates 5 new arrays EVERY FRAME!
    const nearbyDeposits = mineralDeposits
        .filter(d => d.isVisible() && !d.isDepleted())
        .map(d => ({ deposit: d, distance: Vector3.Distance(...) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20)
        .map(item => item.deposit);
}

// ParasiteManager.ts - AFTER (reuse arrays)
private cachedDeposits: MineralDeposit[] = [];
private depositDistances: { deposit: MineralDeposit; distance: number }[] = [];
private lastDepositCacheTime: number = 0;
private readonly DEPOSIT_CACHE_INTERVAL = 1000;  // Refresh every 1 second

public update(deltaTime: number, mineralDeposits: MineralDeposit[], ...): void {
    const now = performance.now();

    // Only recalculate deposit list every second
    if (now - this.lastDepositCacheTime >= this.DEPOSIT_CACHE_INTERVAL) {
        this.updateDepositCache(mineralDeposits);
        this.lastDepositCacheTime = now;
    }

    // Use cached deposits
    for (const deposit of this.cachedDeposits) {
        // Process deposit...
    }
}

private updateDepositCache(mineralDeposits: MineralDeposit[]): void {
    // Reuse array, clear instead of creating new
    this.depositDistances.length = 0;

    const cameraTarget = this.cachedCameraTarget;  // Cached reference

    for (const d of mineralDeposits) {
        if (d.isVisible() && !d.isDepleted()) {
            this.depositDistances.push({
                deposit: d,
                distance: Vector3.Distance(d.getPosition(), cameraTarget)
            });
        }
    }

    // Sort in place
    this.depositDistances.sort((a, b) => a.distance - b.distance);

    // Reuse output array
    this.cachedDeposits.length = 0;
    const limit = Math.min(20, this.depositDistances.length);
    for (let i = 0; i < limit; i++) {
        this.cachedDeposits.push(this.depositDistances[i].deposit);
    }
}
```

### Fix 7: Singleton Lookup Caching

```typescript
// ParasiteManager.ts - BEFORE (repeated lookups)
public update(deltaTime: number, ...): void {
    // Called EVERY FRAME
    const gameEngine = GameEngine.getInstance();        // Lookup 1
    const cameraController = gameEngine?.getCameraController();  // Lookup 2
    const camera = cameraController?.getCamera();       // Lookup 3
    const cameraTarget = camera?.getTarget();           // Lookup 4
}

// ParasiteManager.ts - AFTER (cached)
private gameEngine: GameEngine | null = null;
private cameraController: CameraController | null = null;
private cachedCameraTarget: Vector3 = new Vector3(0, 0, 0);
private lastCameraTargetUpdate: number = 0;
private readonly CAMERA_TARGET_UPDATE_INTERVAL = 100;  // Update 10x/sec

public initialize(): void {
    this.gameEngine = GameEngine.getInstance();
    this.cameraController = this.gameEngine?.getCameraController() || null;
}

public update(deltaTime: number, ...): void {
    const now = performance.now();

    // Update camera target periodically, not every frame
    if (now - this.lastCameraTargetUpdate >= this.CAMERA_TARGET_UPDATE_INTERVAL) {
        const camera = this.cameraController?.getCamera();
        if (camera) {
            const target = camera.getTarget();
            this.cachedCameraTarget.copyFrom(target);
        }
        this.lastCameraTargetUpdate = now;
    }

    // Use cached values
    // ...
}
```

### Fix 8: Mouse Move Handler Throttling

**Problem:** The `handleMouseMove()` method in GameEngine calls `this.scene.pick()` on every mouse move event. Scene picking performs ray casting against all meshes in the scene - an expensive O(n) operation where n = number of meshes.

When moving the mouse, browsers can fire 60+ move events per second. Each pick operation can take 5-15ms depending on scene complexity, causing FPS to drop from 60 to 40 during mouse movement.

```typescript
// GameEngine.ts - BEFORE (pick on every mouse move)
private handleMouseMove(): void {
    if (!this.scene || !this.unitManager || !this.protectorSelectionUI) return;

    // THIS IS CALLED 60+ TIMES PER SECOND DURING MOUSE MOVEMENT!
    const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
    // ... tooltip logic
}

// GameEngine.ts - AFTER (throttled to 20Hz)
private lastMouseMoveCheckTime: number = 0;
private readonly MOUSE_MOVE_CHECK_INTERVAL: number = 50; // 50ms = 20Hz

private handleMouseMove(): void {
    // Throttle: Only check every 50ms (scene.pick is expensive)
    const now = performance.now();
    if (now - this.lastMouseMoveCheckTime < this.MOUSE_MOVE_CHECK_INTERVAL) {
        return;  // Skip this event, too soon since last check
    }
    this.lastMouseMoveCheckTime = now;

    if (!this.scene || !this.unitManager || !this.protectorSelectionUI) return;

    const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
    // ... tooltip logic
}
```

**Why 50ms (20Hz)?**
- 50ms is imperceptible delay for tooltip display (human reaction time ~200ms)
- Reduces pick operations from 60/sec to 20/sec (70% reduction)
- Still responsive enough for smooth tooltip tracking
- Matches the existing DETECTION_CHECK_INTERVAL pattern in the codebase

### Fix 9: Camera Traversal Per-Frame Allocation Elimination

**Problem:** During camera traversal (W/S keys + rotation), FPS drops from 60 to 43-39. Investigation revealed massive per-frame object allocations:

| Source | Allocations/frame | Type |
|--------|------------------|------|
| TreeRenderer.updateAnimations() | ~3,920 | Vector3 |
| CameraController (W key) | 3-4 | Vector3 |
| GameEngine render loop | 3 | Arrays |
| **Total** | **~3,927+** | Objects |

At 60 FPS, this creates **~236,000 object allocations per second**, causing GC pressure and frame drops.

#### Fix 9.1: TreeRenderer - Eliminate Vector3 Allocations

```typescript
// TreeRenderer.ts - BEFORE (creates ~3920 Vector3 per frame!)
public updateAnimations(): void {
    const time = performance.now() / 1000;

    for (const [treeId, treeVisual] of this.treeVisuals) {
        for (let i = 0; i < treeVisual.glowSpots.length; i++) {
            const spot = treeVisual.glowSpots[i];
            const offset = i * 0.3;
            const pulse = Math.sin(time * 1.5 + offset) * 0.15 + 0.85;
            spot.scaling = new Vector3(pulse, pulse, pulse);  // ALLOCATION!
        }
    }
}

// TreeRenderer.ts - AFTER (zero allocations)
public updateAnimations(): void {
    const time = performance.now() / 1000;

    for (const [treeId, treeVisual] of this.treeVisuals) {
        for (let i = 0; i < treeVisual.glowSpots.length; i++) {
            const spot = treeVisual.glowSpots[i];
            const offset = i * 0.3;
            const pulse = Math.sin(time * 1.5 + offset) * 0.15 + 0.85;
            spot.scaling.set(pulse, pulse, pulse);  // Mutate existing, no allocation
        }
    }
}
```

**Impact:** Eliminates ~3,920 Vector3 allocations per frame (99% of total).

#### Fix 9.2: CameraController - Cache Movement Vectors

```typescript
// CameraController.ts - BEFORE (creates 3-4 Vector3 per frame when moving)
this.scene.registerBeforeRender(() => {
    if (pressedKeys.has('KeyW')) {
        const forward = this.camera.getDirection(Vector3.Forward()).scale(moveSpeed);
        const newTarget = target.add(new Vector3(forward.x, 0, forward.z));  // 2 allocations
        this.camera.setTarget(newTarget);
    }
});

// CameraController.ts - AFTER (zero allocations)
// Add cached vectors as class members
private cachedForward: Vector3 = new Vector3();
private cachedMoveVector: Vector3 = new Vector3();
private cachedNewTarget: Vector3 = new Vector3();

this.scene.registerBeforeRender(() => {
    if (pressedKeys.has('KeyW')) {
        // Reuse cached vectors
        this.camera.getDirection(Vector3.Forward(), this.cachedForward);
        this.cachedForward.scaleInPlace(moveSpeed);

        this.cachedMoveVector.set(this.cachedForward.x, 0, this.cachedForward.z);
        target.addToRef(this.cachedMoveVector, this.cachedNewTarget);
        this.camera.setTarget(this.cachedNewTarget);
    }
});
```

**Impact:** Eliminates 3-4 Vector3 allocations per frame during movement.

#### Fix 9.3: Make GameState/UnitManager Methods Zero-Allocation (Preferred)

Instead of caching in GameEngine, maintain arrays alongside Maps at the source. This provides zero per-frame allocations and proper separation of concerns.

```typescript
// GameState.ts - BEFORE
public getAllMineralDeposits(): MineralDeposit[] {
    return Array.from(this.mineralDeposits.values());  // Creates new array every call
}

// GameState.ts - AFTER (maintain array alongside Map)
private mineralDepositsArray: MineralDeposit[] = [];

public addMineralDeposit(deposit: MineralDeposit): void {
    this.mineralDeposits.set(deposit.getId(), deposit);
    this.mineralDepositsArray.push(deposit);  // Keep in sync
}

public removeMineralDeposit(depositId: string): void {
    this.mineralDeposits.delete(depositId);
    const idx = this.mineralDepositsArray.findIndex(d => d.getId() === depositId);
    if (idx !== -1) this.mineralDepositsArray.splice(idx, 1);
}

public getAllMineralDeposits(): MineralDeposit[] {
    return this.mineralDepositsArray;  // Return existing array, zero allocation
}
```

```typescript
// UnitManager.ts - BEFORE
public getUnitsByType(unitType: 'worker' | 'scout' | 'protector'): Unit[] {
    return Array.from(this.units.values()).filter(unit => unit.getUnitType() === unitType);
    // Creates new array AND filters - two allocations per call
}

// UnitManager.ts - AFTER (maintain typed arrays alongside main Map)
private workerUnits: Worker[] = [];
private protectorUnits: Protector[] = [];
private scoutUnits: Unit[] = [];

public addUnit(unit: Unit): void {
    this.units.set(unit.getId(), unit);
    // Keep typed arrays in sync
    switch (unit.getUnitType()) {
        case 'worker':
            this.workerUnits.push(unit as Worker);
            break;
        case 'protector':
            this.protectorUnits.push(unit as Protector);
            break;
        case 'scout':
            this.scoutUnits.push(unit);
            break;
    }
}

public removeUnit(unitId: string): void {
    const unit = this.units.get(unitId);
    if (!unit) return;

    this.units.delete(unitId);
    // Remove from typed array
    switch (unit.getUnitType()) {
        case 'worker':
            const wIdx = this.workerUnits.findIndex(u => u.getId() === unitId);
            if (wIdx !== -1) this.workerUnits.splice(wIdx, 1);
            break;
        case 'protector':
            const pIdx = this.protectorUnits.findIndex(u => u.getId() === unitId);
            if (pIdx !== -1) this.protectorUnits.splice(pIdx, 1);
            break;
        case 'scout':
            const sIdx = this.scoutUnits.findIndex(u => u.getId() === unitId);
            if (sIdx !== -1) this.scoutUnits.splice(sIdx, 1);
            break;
    }
}

public getUnitsByType(unitType: 'worker' | 'scout' | 'protector'): Unit[] {
    // Return existing arrays, zero allocation
    switch (unitType) {
        case 'worker': return this.workerUnits;
        case 'protector': return this.protectorUnits;
        case 'scout': return this.scoutUnits;
        default: return [];
    }
}
```

**Benefits:**
- Zero per-frame allocations (not even periodic refresh)
- Single source of truth - arrays maintained where data lives
- Proper separation of concerns
- No cache invalidation timing concerns
- GameEngine render loop unchanged - just calls methods directly

**Trade-off:** Slightly more memory (arrays + Map) and add/remove operations do a bit more work, but these are infrequent compared to 60Hz reads.

## Expected Performance Impact

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXPECTED FPS AFTER FIXES                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FPS                                                                        │
│   65 ┤ ████████████████████████████████████████████████████████████████     │
│   60 ┤ ████████████████████████████████████████████████████████████████     │
│   55 ┤ ████████████████████████████████████████████████████████████████     │
│   50 ┤                                                                      │
│   40 ┤                                                                      │
│   30 ┤                                                                      │
│      0min    15min    30min    45min    60min                               │
│                                                                             │
│  Target: 60 FPS (+/- 5) stable throughout session                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Performance Gains by Fix

| Fix | Category | Expected FPS Gain | Notes |
|-----|----------|-------------------|-------|
| 1. Material disposal | Memory leak | Prevents decay | Critical for long sessions |
| 2. Shared UI texture | Memory leak | +1-2 FPS | Reduces GPU overhead |
| 3. Interval cleanup | Memory leak | Minimal | Prevents timer accumulation |
| 4. Sync render loop | Per-frame | +5-10 FPS | Removes microtask delays |
| 5. System throttling | Per-frame | +10-15 FPS | Biggest single gain |
| 6. Allocation elimination | Per-frame | +3-5 FPS | Reduces GC pressure |
| 7. Singleton caching | Per-frame | +1-2 FPS | Minor but measurable |
| 8. Mouse move throttling | Event-driven | +15-20 FPS | During mouse movement |
| 9. Camera traversal allocations | Per-frame | +15-20 FPS | During W/S + rotation |

**Total Expected Gain: +20-35 FPS (idle), +35-55 FPS (during interaction)**

## File Locations

| File | Action |
|------|--------|
| `client/src/utils/PerformanceMonitor.ts` | **DELETE** |
| `client/src/game/TerritoryPerformanceMonitor.ts` | **DELETE** |
| `client/src/rendering/CombatEffects.ts` | Material tracking, disposal, shared UI |
| `client/src/game/GameEngine.ts` | Remove PerformanceMonitor, remove async, add throttling, mouse move throttling |
| `client/src/game/TerritoryManager.ts` | Remove TerritoryPerformanceMonitor |
| `client/src/game/UnitManager.ts` | Make update synchronous, typed arrays for zero-allocation getUnitsByType() |
| `client/src/game/GameState.ts` | Maintain mineralDepositsArray for zero-allocation getAllMineralDeposits() |
| `client/src/game/ParasiteManager.ts` | Cache arrays, singleton references |
| `client/src/game/CombatSystem.ts` | Pass shared UI to CombatEffects |
| `client/src/ui/DebugUI.ts` | Remove PerformanceMonitor usage |
| `client/src/game/SystemIntegration.ts` | Remove PerformanceMonitor usage |
| `client/src/rendering/TreeRenderer.ts` | Eliminate Vector3 allocations in updateAnimations() |
| `client/src/rendering/CameraController.ts` | Cache movement vectors for keyboard controls |

## Testing Strategy

### Performance Validation

1. **Baseline Test**: Measure FPS at game start
2. **Sustained Test**: Run for 1 hour, measure FPS at 15-minute intervals
3. **Combat Stress Test**: Continuous combat for 30 minutes
4. **Memory Profile**: Monitor heap size over time in Chrome DevTools

### Success Criteria

- Baseline FPS: 55-65
- After 1 hour: 55-65 (no degradation)
- Memory growth: < 50MB over 1 hour session
- Frame time variance: < 5ms standard deviation
