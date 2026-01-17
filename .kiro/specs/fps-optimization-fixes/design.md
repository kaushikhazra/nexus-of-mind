# FPS Optimization Fixes - Design Document

## Overview

This design addresses 11 performance issues: 3 memory leaks causing FPS degradation over time, and 8 per-frame/event bottlenecks causing low baseline FPS. The target is stable 60 FPS (+/- 5) throughout extended gameplay sessions.

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

### Fix 10: Mining Operation Per-Frame Allocation Elimination

**Problem:** Mining with even one worker causes FPS to drop from 60 to 43. Investigation revealed per-frame allocations in the mining code path.

**Call chain during mining (every frame):**
```
MiningAction.executeAction()
├── currentTarget.mine(deltaTime)
│   └── updateVisual()
│       └── new Vector3(scale, scale, scale)  ← ALLOCATION
├── currentTarget.getPosition()
│   └── this.position.clone()  ← ALLOCATION
└── Vector3.Distance(minerPosition, target.getPosition())
    └── target.getPosition() clone  ← ALLOCATION
```

**Estimated allocations:** ~10-20 Vector3 objects per frame per mining worker

#### Fix 10.1: MineralDeposit.updateVisual() - Eliminate Scaling Allocation

```typescript
// MineralDeposit.ts - BEFORE (Line 173)
private updateVisual(): void {
    const percentage = this.remaining / this.capacity;
    const scale = Math.max(0.2, percentage);
    this.mesh.scaling = new Vector3(scale, scale, scale);  // ALLOCATION every frame!
}

// MineralDeposit.ts - AFTER
private updateVisual(): void {
    const percentage = this.remaining / this.capacity;
    const scale = Math.max(0.2, percentage);
    this.mesh.scaling.set(scale, scale, scale);  // Mutate existing, no allocation
}
```

#### Fix 10.2: MineralDeposit.getPosition() - Return Reference

```typescript
// MineralDeposit.ts - BEFORE (Line 281)
public getPosition(): Vector3 {
    return this.position.clone();  // Creates new Vector3 every call
}

// MineralDeposit.ts - AFTER (two methods for different use cases)
/**
 * Get position reference (for internal use, DO NOT MODIFY)
 */
public getPositionRef(): Vector3 {
    return this.position;  // Zero allocation
}

/**
 * Get position copy (for external use where modification is needed)
 */
public getPosition(): Vector3 {
    return this.position.clone();  // Safe copy for external use
}
```

#### Fix 10.3: Unit.getPosition() - Add Reference Method

```typescript
// Unit.ts - BEFORE (Line 571)
public getPosition(): Vector3 { return this.position.clone(); }

// Unit.ts - AFTER (add reference method for internal hot paths)
/**
 * Get position reference (for internal use, DO NOT MODIFY)
 */
public getPositionRef(): Vector3 { return this.position; }

/**
 * Get position copy (for external use)
 */
public getPosition(): Vector3 { return this.position.clone(); }
```

#### Fix 10.4: MiningAction - Use copyFrom() Instead of clone()

```typescript
// MiningAction.ts - BEFORE (Line 164)
public updatePosition(newPosition: Vector3): void {
    this.minerPosition = newPosition.clone();  // Creates new Vector3
}

// MiningAction.ts - AFTER
public updatePosition(newPosition: Vector3): void {
    this.minerPosition.copyFrom(newPosition);  // Mutate existing, no allocation
}

// Also update range checks to use getPositionRef()
// BEFORE (Line 65, 168)
const distance = Vector3.Distance(this.minerPosition, target.getPosition());

// AFTER
const distance = Vector3.Distance(this.minerPosition, target.getPositionRef());
```

**Note on getPosition() vs getPositionRef():**
- `getPosition()` returns a clone - safe for external code that might modify the position
- `getPositionRef()` returns the actual reference - zero allocation but caller must NOT modify
- Use `getPositionRef()` in hot paths (per-frame code) where position is only read
- Use `getPosition()` when passing position to code that might store or modify it

### Fix 11: Unit Rendering Per-Frame Allocation Elimination

**Problem:** UnitRenderer calls several methods every frame for every unit, each creating new Vector3 or Color3 objects. With 3 workers, this creates ~1,140 allocations/sec.

**Hot paths in UnitRenderer (called every frame per unit):**
```
updateAllVisuals()
├── updateUnitPosition()
│   └── lastPosition = currentPosition.clone()  ← Vector3
├── updateEnergyVisualization()
│   ├── getEnergyColor() → new Color3(...)  ← Color3
│   ├── coreColor.scale(1.5) → new Color3  ← Color3
│   └── energyIndicator.scaling = new Vector3(...)  ← Vector3
├── updateHealthVisualization()
│   ├── mesh.scaling = new Vector3(...)  ← Vector3
│   └── baseEmissive.scale(healthPercentage) → new Color3  ← Color3
└── updateActionVisualization()
```

**Also in MineralDeposit.updateVisual() (every frame during mining):**
```
updateVisual()
└── this.material.emissiveColor = new Color3(...)  ← Color3
```

#### Fix 11.1: UnitRenderer - Cache Position Updates

```typescript
// UnitRenderer.ts - BEFORE (Line 694)
unitVisual.lastPosition = currentPosition.clone();

// UnitRenderer.ts - AFTER
unitVisual.lastPosition.copyFrom(currentPosition);  // Mutate existing
```

#### Fix 11.2: UnitRenderer - Cache Scaling Vectors

```typescript
// UnitRenderer.ts - BEFORE (Line 716)
unitVisual.energyIndicator.scaling = new Vector3(scale, scale, scale);

// UnitRenderer.ts - AFTER
unitVisual.energyIndicator.scaling.set(scale, scale, scale);

// UnitRenderer.ts - BEFORE (Line 778)
unitVisual.mesh.scaling = new Vector3(healthScale, healthScale, healthScale);

// UnitRenderer.ts - AFTER
unitVisual.mesh.scaling.set(healthScale, healthScale, healthScale);
```

#### Fix 11.3: UnitRenderer - Cache Energy Colors

```typescript
// UnitRenderer.ts - BEFORE (Lines 726, 734, 750)
private getEnergyColor(percentage: number): Color3 {
    if (percentage > 0.5) {
        return new Color3(...);  // Creates new Color3 every call
    } else {
        return new Color3(...);
    }
}

// UnitRenderer.ts - AFTER (cache Color3 objects)
// Add cached colors as class members
private cachedEnergyColor: Color3 = new Color3();
private cachedProtectorColor: Color3 = new Color3();
private cachedEmissiveColor: Color3 = new Color3();

private getEnergyColor(percentage: number): Color3 {
    if (percentage > 0.5) {
        const t = (percentage - 0.5) * 2;
        this.cachedEnergyColor.r = 1.0 - (t * 0.5);
        this.cachedEnergyColor.g = 1.0;
        this.cachedEnergyColor.b = 0.3 * t;
    } else {
        const t = percentage * 2;
        this.cachedEnergyColor.r = 1.0;
        this.cachedEnergyColor.g = t * 1.0;
        this.cachedEnergyColor.b = 0.0;
    }
    return this.cachedEnergyColor;  // Return cached, no allocation
}

// Same pattern for getProtectorEnergyColor()
```

#### Fix 11.4: UnitRenderer - Avoid scale() Method Allocations

```typescript
// UnitRenderer.ts - BEFORE (Line 711)
unitVisual.energyCoreMaterial.emissiveColor = coreColor.scale(1.5);

// UnitRenderer.ts - AFTER (use scaleToRef or direct assignment)
coreColor.scaleToRef(1.5, this.cachedEmissiveColor);
unitVisual.energyCoreMaterial.emissiveColor = this.cachedEmissiveColor;

// Or even simpler - set properties directly:
unitVisual.energyCoreMaterial.emissiveColor.r = coreColor.r * 1.5;
unitVisual.energyCoreMaterial.emissiveColor.g = coreColor.g * 1.5;
unitVisual.energyCoreMaterial.emissiveColor.b = coreColor.b * 1.5;
```

#### Fix 11.5: MineralDeposit - Cache Emissive Colors

```typescript
// MineralDeposit.ts - BEFORE (Lines 178, 181, 184)
private updateVisual(): void {
    if (percentage < 0.2) {
        this.material.emissiveColor = new Color3(0.1, 0.3, 0.5);
    } else if (percentage < 0.5) {
        this.material.emissiveColor = new Color3(0.2, 0.5, 0.8);
    } else {
        this.material.emissiveColor = new Color3(0.3, 0.7, 1.0);
    }
}

// MineralDeposit.ts - AFTER (set properties directly)
private updateVisual(): void {
    if (percentage < 0.2) {
        this.material.emissiveColor.r = 0.1;
        this.material.emissiveColor.g = 0.3;
        this.material.emissiveColor.b = 0.5;
    } else if (percentage < 0.5) {
        this.material.emissiveColor.r = 0.2;
        this.material.emissiveColor.g = 0.5;
        this.material.emissiveColor.b = 0.8;
    } else {
        this.material.emissiveColor.r = 0.3;
        this.material.emissiveColor.g = 0.7;
        this.material.emissiveColor.b = 1.0;
    }
}
```

**Allocation reduction:**
- Before: ~1,140 allocations/sec (3 units active)
- After: ~0 allocations/sec in hot paths
- Scales with unit count (more units = bigger savings)

### Fix 12: Parasite-Unit Interaction Map Allocation Elimination

**Problem:** During parasite-unit interactions (combat, fleeing, targeting), FPS drops to 29-35. Investigation revealed that `updateParasites()` creates two new Map objects every frame for O(1) unit lookups.

**Code path (every frame when parasites active):**
```
ParasiteManager.update()
└── updateParasites()
    ├── new Map<string, Worker>()      ← ALLOCATION every frame!
    ├── for worker of workers → workerMap.set(...)
    ├── new Map<string, Protector>()   ← ALLOCATION every frame!
    └── for protector of protectors → protectorMap.set(...)
```

**Estimated allocations:** 2 Maps per frame × 60 FPS = 120 Map allocations/second + all the internal allocations for Map entries.

#### Fix 12.1: Cache Unit Lookup Maps as Class Members

```typescript
// ParasiteManager.ts - BEFORE (Lines 314-321)
private updateParasites(deltaTime: number, workers: Worker[], protectors: Protector[]): void {
    // Build ID->Object maps for O(1) lookups (done once per frame)
    const workerMap = new Map<string, Worker>();     // ALLOCATION!
    for (const worker of workers) {
        workerMap.set(worker.getId(), worker);
    }
    const protectorMap = new Map<string, Protector>(); // ALLOCATION!
    for (const protector of protectors) {
        protectorMap.set(protector.getId(), protector);
    }
    // ... use maps for spatial lookups
}

// ParasiteManager.ts - AFTER (cache as class members)
// Add class members
private cachedWorkerMap: Map<string, Worker> = new Map();
private cachedProtectorMap: Map<string, Protector> = new Map();

private updateParasites(deltaTime: number, workers: Worker[], protectors: Protector[]): void {
    // Clear and reuse existing Maps (no allocation)
    this.cachedWorkerMap.clear();
    for (const worker of workers) {
        this.cachedWorkerMap.set(worker.getId(), worker);
    }

    this.cachedProtectorMap.clear();
    for (const protector of protectors) {
        this.cachedProtectorMap.set(protector.getId(), protector);
    }

    // ... use cached maps for spatial lookups
}
```

**Impact:**
- Eliminates 2 Map allocations per frame (120/second)
- Eliminates internal Map entry object allocations
- Map.clear() is O(n) but reuses the underlying data structure
- Significantly reduces GC pressure during parasite interactions

### Fix 13: Visual Effect Beam/Ray Per-Frame Allocation Elimination

**Problem:** During combat and mining, visual effects (drain beams, mining rays) are **completely disposed and recreated every frame**. This creates massive allocation pressure.

**Per-frame allocations (with 3 parasites feeding + 1 worker mining):**
- 4x LinesMesh disposal + creation
- 8x Vector3 (position clones)
- 4x StandardMaterial (new)
- 4x Color3 (new)
- 2x Animation objects (mining line)

**Total: ~18+ object allocations per frame per active effect**

#### Fix 13.1: EnergyParasite Drain Beam - Update Instead of Recreate

```typescript
// EnergyParasite.ts - BEFORE (Lines 275-299)
protected updateDrainBeam(targetPosition: Vector3): void {
    // Remove existing beam - WASTEFUL!
    if (this.drainBeam) {
        this.drainBeam.dispose();
        this.drainBeam = null;
    }

    // Create new beam - EVERY FRAME!
    const points = [this.position.clone(), targetPosition.clone()];
    this.drainBeam = MeshBuilder.CreateLines(...);

    const beamMaterial = new StandardMaterial(...);  // NEW MATERIAL EVERY FRAME
    beamMaterial.emissiveColor = new Color3(1, 0.2, 0.2);  // NEW COLOR3
    this.drainBeam.material = beamMaterial;
}

// EnergyParasite.ts - AFTER (update geometry, cache material)
// Add class members
private drainBeamMaterial: StandardMaterial | null = null;
private cachedDrainPoints: Vector3[] = [new Vector3(), new Vector3()];

protected updateDrainBeam(targetPosition: Vector3): void {
    if (!this.scene) return;

    // Create beam and material ONCE (lazy initialization)
    if (!this.drainBeam) {
        this.cachedDrainPoints[0].copyFrom(this.position);
        this.cachedDrainPoints[1].copyFrom(targetPosition);

        this.drainBeam = MeshBuilder.CreateLines(`drain_beam_${this.id}`, {
            points: this.cachedDrainPoints,
            updatable: true  // KEY: Make updatable for vertex updates
        }, this.scene);

        // Create material ONCE
        if (!this.drainBeamMaterial) {
            this.drainBeamMaterial = new StandardMaterial(`drain_beam_mat_${this.id}`, this.scene);
            this.drainBeamMaterial.emissiveColor = new Color3(1, 0.2, 0.2);
            this.drainBeamMaterial.disableLighting = true;
        }
        this.drainBeam.material = this.drainBeamMaterial;
        this.drainBeam.alpha = 0.8;
    } else {
        // UPDATE existing beam geometry (no allocation)
        this.cachedDrainPoints[0].copyFrom(this.position);
        this.cachedDrainPoints[1].copyFrom(targetPosition);

        this.drainBeam = MeshBuilder.CreateLines(`drain_beam_${this.id}`, {
            points: this.cachedDrainPoints,
            instance: this.drainBeam  // KEY: Update existing instance
        }, this.scene);
    }
}
```

#### Fix 13.2: CombatParasite Drain Beam - Same Pattern

```typescript
// CombatParasite.ts - Same fix as EnergyParasite
// Add class members for cached material and points
private drainBeamMaterial: StandardMaterial | null = null;
private cachedDrainPoints: Vector3[] = [new Vector3(), new Vector3()];

// Use same update pattern with updatable mesh and instance update
```

#### Fix 13.3: UnitRenderer Mining Connection Line - Update Instead of Recreate

```typescript
// UnitRenderer.ts - BEFORE (Lines 983-998)
private updateMiningConnectionLine(unitVisual: UnitVisual, miningTarget: any): void {
    const points = [
        unitPos.add(new Vector3(0, 0.5, 0)),  // NEW VECTOR3
        targetPos.add(new Vector3(0, 0.5, 0)) // NEW VECTOR3
    ];

    // Recreate the line - WASTEFUL!
    unitVisual.miningConnectionLine.dispose();
    this.createMiningConnectionLine(unitVisual, miningTarget);  // Creates mesh + material + animations
}

// UnitRenderer.ts - AFTER (update existing line)
// Add to UnitVisual interface
interface UnitVisual {
    // ... existing fields
    miningLinePoints: Vector3[];  // Cached point array
    miningLineMaterial: StandardMaterial | null;  // Cached material
}

private updateMiningConnectionLine(unitVisual: UnitVisual, miningTarget: any): void {
    if (!unitVisual.miningConnectionLine || !miningTarget) return;

    // Ensure cached points exist
    if (!unitVisual.miningLinePoints) {
        unitVisual.miningLinePoints = [new Vector3(), new Vector3()];
    }

    // Update cached points (no allocation)
    const unitPos = unitVisual.unit.getPositionRef();
    const targetPos = miningTarget.getPositionRef();

    unitVisual.miningLinePoints[0].set(unitPos.x, unitPos.y + 0.5, unitPos.z);
    unitVisual.miningLinePoints[1].set(targetPos.x, targetPos.y + 0.5, targetPos.z);

    // Update existing mesh instance (no disposal/recreation)
    unitVisual.miningConnectionLine = MeshBuilder.CreateLines(
        `mining_line_${unitVisual.unit.getId()}`,
        {
            points: unitVisual.miningLinePoints,
            instance: unitVisual.miningConnectionLine  // Update in place
        },
        this.scene
    );
}

private createMiningConnectionLine(unitVisual: UnitVisual, miningTarget: any): void {
    // Initialize cached points
    unitVisual.miningLinePoints = [new Vector3(), new Vector3()];

    const unitPos = unitVisual.unit.getPositionRef();
    const targetPos = miningTarget.getPositionRef();

    unitVisual.miningLinePoints[0].set(unitPos.x, unitPos.y + 0.5, unitPos.z);
    unitVisual.miningLinePoints[1].set(targetPos.x, targetPos.y + 0.5, targetPos.z);

    const connectionLine = MeshBuilder.CreateLines(`mining_line_${unitVisual.unit.getId()}`, {
        points: unitVisual.miningLinePoints,
        updatable: true  // KEY: Make updatable
    }, this.scene);

    // Cache material (create once)
    if (!unitVisual.miningLineMaterial) {
        unitVisual.miningLineMaterial = new StandardMaterial(`mining_line_mat_${unitVisual.unit.getId()}`, this.scene);
        unitVisual.miningLineMaterial.emissiveColor = new Color3(0, 1, 0.5);
        unitVisual.miningLineMaterial.disableLighting = true;
    }
    connectionLine.material = unitVisual.miningLineMaterial;
    connectionLine.alpha = 0.6;

    // Animations only created ONCE (not every frame)
    Animation.CreateAndStartAnimation(...);

    unitVisual.miningConnectionLine = connectionLine;
}
```

**Key Babylon.js Pattern:**
```typescript
// Create updatable mesh ONCE:
MeshBuilder.CreateLines(name, { points: [...], updatable: true }, scene);

// Update geometry without recreation:
MeshBuilder.CreateLines(name, { points: newPoints, instance: existingMesh }, scene);
```

**Impact:**
- Eliminates ~12+ mesh disposal/creation per frame
- Eliminates ~12+ material allocations per frame
- Eliminates ~24+ Vector3 allocations per frame
- Expected FPS gain: +15-25 FPS during combat/mining

### Fix 14: Mouse Hover and UI Update Allocation Elimination

**Problem:** During mouse movement, FPS drops from 50 to 35. Investigation revealed multiple string allocation issues in hover/tooltip code.

**Critical Issues Found:**

| Location | Issue | Frequency |
|----------|-------|-----------|
| BuildingPlacementUI.handleMouseMove() | Unthrottled string allocations | Every mouse move (60+ fps) |
| ProtectorSelectionUI.updateContent() | Full innerHTML rebuild | Every 100ms |
| EnergyLordsHUD.updateTierProgress() | String concat in loop | Every 500ms |
| EnergyLordsHUD.updateDisplayWithState() | Gradient strings recreated | Every 500ms |

#### Fix 14.1: Throttle BuildingPlacementUI Mouse Handler

```typescript
// BuildingPlacementUI.ts - BEFORE (Lines 675-724)
private handleMouseMove(evt: PointerInfo): void {
    // Called on EVERY mouse move - no throttling!
    const workerText = `${this.currentMiningAnalysis.workerCount} workers can mine`;
    const efficiencyText = this.currentMiningAnalysis.efficiency.toUpperCase();
    this.updateStatus(`${workerText} - ${efficiencyText} efficiency...`);
}

// BuildingPlacementUI.ts - AFTER (add throttling)
private lastMouseMoveTime: number = 0;
private readonly MOUSE_MOVE_INTERVAL = 100; // 10Hz throttle

private handleMouseMove(evt: PointerInfo): void {
    const now = performance.now();
    if (now - this.lastMouseMoveTime < this.MOUSE_MOVE_INTERVAL) return;
    this.lastMouseMoveTime = now;

    // ... existing logic (now runs at 10Hz instead of 60Hz)
}
```

#### Fix 14.2: Optimize ProtectorSelectionUI Updates

```typescript
// ProtectorSelectionUI.ts - BEFORE (Line 228)
// Full innerHTML rebuild every 100ms
this.tooltipElement.innerHTML = `<div style="...">...</div>`;

// ProtectorSelectionUI.ts - AFTER (targeted updates)
// Cache element references
private nameElement: HTMLElement | null = null;
private healthElement: HTMLElement | null = null;
// ... etc

// Update only changed values
if (this.nameElement) this.nameElement.textContent = name;
if (this.healthElement) this.healthElement.textContent = `${health}/${maxHealth}`;
```

#### Fix 14.3: Slow Down and Optimize EnergyLordsHUD Updates

```typescript
// EnergyLordsHUD.ts - BEFORE (Line 390)
this.updateInterval = setInterval(() => this.updateDisplay(), 500);  // 500ms = too fast

// EnergyLordsHUD.ts - AFTER
this.updateInterval = setInterval(() => this.updateDisplay(), 1000);  // 1000ms = reasonable

// Cache gradient strings (create once)
private readonly GRADIENT_GOLD = 'linear-gradient(90deg, #ffd700 0%, #ffee88 50%, #ffffff 100%)';
private readonly GRADIENT_PURPLE = 'linear-gradient(90deg, #6040ff 0%, #a080ff 50%, #ffd700 100%)';

// Use array join instead of += concatenation
private updateTierProgress(): void {
    const dots: string[] = [];
    for (let i = 1; i <= 5; i++) {
        dots.push(`<div style="..."></div>`);
    }
    container.innerHTML = dots.join('');  // Single allocation instead of 5
}
```

**Impact:**
- BuildingPlacementUI: 60+ allocations/sec → ~10 allocations/sec
- ProtectorSelectionUI: Full DOM rebuild → Targeted textContent updates
- EnergyLordsHUD: 2 updates/sec → 1 update/sec, cached strings
- Expected FPS gain: +10-15 FPS during mouse movement

### Fix 15: Energy Display Consolidation

**Problem:** Energy info is displayed in two places - EnergyLordsHUD shows it, and EnergyDisplay (top right) also shows total energy. User requested consolidation.

**Changes:**
1. Keep total energy display in EnergyLordsHUD (already there)
2. Remove total energy from EnergyDisplay (top right bar)
3. Keep in EnergyDisplay: generation rate, consumption rate, efficiency %, net rate

```typescript
// EnergyDisplay.ts - BEFORE
// Shows: Total Energy | Generation | Consumption | Efficiency | Net Rate

// EnergyDisplay.ts - AFTER
// Shows: Generation | Consumption | Efficiency | Net Rate
// (Total energy now only in Energy Lords window)
```

**UI Layout After:**
- Top right bar: Delta stats only (generation, consumption, efficiency, net rate)
- Energy Lords window: Total energy + tier progress + detailed stats

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
| 10. Mining allocations | Per-frame | +5-8 FPS | During mining operations |
| 11. Unit rendering allocations | Per-frame | +10-15 FPS | During unit activity |
| 12. Parasite interaction Maps | Per-frame | +15-25 FPS | During parasite encounters |
| 13. Beam/Ray mesh recreation | Per-frame | +15-25 FPS | During combat/mining effects |
| 14. Mouse hover/UI string allocations | Per-event | +10-15 FPS | During mouse movement |
| 15. Energy display consolidation | UI cleanup | N/A | Cleaner UI, less redundancy |

**Total Expected Gain: +20-35 FPS (idle), +70-90 FPS (during gameplay)**

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
| `client/src/rendering/UnitRenderer.ts` | Cache colors, use scaling.set(), use copyFrom() |
| `client/src/world/MineralDeposit.ts` | Use scaling.set(), add getPositionRef(), direct color assignment |
| `client/src/game/entities/Unit.ts` | Add getPositionRef() for zero-allocation access |
| `client/src/game/actions/MiningAction.ts` | Use copyFrom(), use getPositionRef() |

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
