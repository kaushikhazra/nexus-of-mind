# Client Code Review - Nexus of Mind Game Client

## Overview

- **Total Production Files**: 93 TypeScript files
- **Total Unit Test Files**: 48 files
- **E2E Test Files**: 4 files
- **Lines of Production Code**: ~35,000+ lines
- **Lines of Test Code**: ~22,400 lines
- **Framework**: Babylon.js 6.x

---

## Architecture Assessment

### Module Structure

| Module | Files | Purpose | Quality |
|--------|-------|---------|---------|
| `game/` | 40+ | Core game logic, entities, systems | Good |
| `rendering/` | 11 | Babylon.js scene, camera, materials | Excellent |
| `ui/` | 28 | User interface components | Needs refactoring |
| `networking/` | 3 | WebSocket communication | Excellent |
| `world/` | 3 | Terrain, mineral deposits | Good |
| `utils/` | 2 | Utility functions | Good |

---

## MUST FIX Before Hackathon Submission

### 1. **CRITICAL: GameEngine.ts is 1,260 lines (SRP Violation)**

**File**: `client/src/game/GameEngine.ts`
**Issue**: God class that manages everything - engine, scene, camera, lighting, energy, units, buildings, combat, territory, parasites, UI, mouse interactions.

**Hackathon Impact**: Major code quality concern for judges.

**Suggested Fix**: Extract responsibilities into focused managers:

```typescript
// game/engine/
// ├── EngineCore.ts      - Babylon.js engine/scene only (~200 lines)
// ├── SystemManager.ts   - Manages all game systems (~150 lines)
// ├── InputHandler.ts    - Mouse/keyboard handling (~200 lines)
// └── UIInitializer.ts   - UI component setup (~150 lines)
```

### 2. **HIGH: IntroductionModelRenderer.ts is 101KB (2,800+ lines)**

**File**: `client/src/ui/IntroductionModelRenderer.ts`
**Issue**: Single file contains entire 3D model rendering logic for introduction.

**Hackathon Impact**: Will raise concerns about maintainability.

**Suggested Fix**: Split into:
- `IntroductionScene.ts` - Scene setup
- `IntroductionAnimations.ts` - Animation logic
- `IntroductionModels.ts` - Model creation
- `IntroductionEffects.ts` - Visual effects

### 3. **HIGH: IntroductionScreen.ts is 53KB**

**File**: `client/src/ui/IntroductionScreen.ts`
**Issue**: Very large UI component with multiple responsibilities.

**Suggested Fix**: Extract into smaller components:
- `IntroductionStory.ts`
- `IntroductionNavigation.ts`
- `IntroductionPreferences.ts`

### 4. **MEDIUM: Large UI Component Files**

Several UI files are too large:
- `BuildingPlacementUI.ts` - 37KB
- `CombatUI.ts` - 32KB
- `TerritoryVisualUI.ts` - 30KB
- `LearningProgressUI.ts` - 29KB

**Suggested Fix**: Consider breaking into smaller, focused components.

---

## Nice to Have Improvements

### 1. **Entity Component System (ECS) Pattern**

Current entity design uses class inheritance. Consider ECS for better flexibility:

```typescript
// Current (class inheritance)
class Worker extends Unit { ... }
class Protector extends Unit { ... }

// Better (composition)
interface Entity { id: string; }
interface HasPosition { position: Vector3; }
interface HasHealth { health: number; maxHealth: number; }
interface CanMine { startMining(deposit): void; }

// Components can be mixed and matched
type Worker = Entity & HasPosition & HasHealth & CanMine;
```

### 2. **State Management**

Consider implementing a centralized state management pattern:

```typescript
// game/state/
// ├── GameStore.ts      - Central state store
// ├── actions.ts        - State mutations
// └── selectors.ts      - State queries
```

### 3. **Performance Optimizations Documented**

Good optimizations are in place but could be better documented:
- Zero-allocation patterns (cached vectors)
- Spatial indexing for O(1) entity lookups
- Throttled system updates (round-robin scheduling)
- Event-driven mining worker tracking

Add comments explaining WHY these optimizations exist.

---

## Babylon.js Best Practices Analysis

### Following Best Practices:

1. **Scene Management**
   - ✅ Proper scene disposal
   - ✅ Resource cleanup in `dispose()` methods
   - ✅ Single scene instance

2. **Camera Setup**
   - ✅ ArcRotateCamera for RTS controls
   - ✅ Proper camera constraints (limits)
   - ✅ Cached vectors for movement (Fix 18)

3. **Material Management**
   - ✅ Centralized MaterialManager
   - ✅ Material reuse across entities

4. **Performance**
   - ✅ Frustum culling (default)
   - ✅ Throttled updates for non-critical systems
   - ✅ Scene.pick() only on click, not mouse move (Fix 19)

### Areas for Improvement:

1. **Asset Loading**
   - No async asset loading with progress feedback
   - Consider implementing `AssetsManager` for loading textures/models

2. **LOD (Level of Detail)**
   - No LOD system for distant entities
   - Could improve performance with many units

3. **Instancing**
   - Not using mesh instancing for repeated entities
   - Could significantly improve render performance

**Suggested Enhancement**:

```typescript
// Use instancing for repeated geometry
const workerMesh = MeshBuilder.CreateBox("worker_template", {size: 1});
workerMesh.isVisible = false;

// Create instances instead of new meshes
const worker1 = workerMesh.createInstance("worker_1");
const worker2 = workerMesh.createInstance("worker_2");
```

---

## SOLID Principles Analysis

### Single Responsibility Principle (SRP)
- **Violation**: `GameEngine.ts` - manages too many systems
- **Violation**: Large UI components (Introduction, Building)
- **Good**: `SceneManager.ts` - focused on scene lifecycle
- **Good**: `CameraController.ts` - focused on camera only
- **Good**: `WebSocketClient.ts` - focused on communication

### Open/Closed Principle (OCP)
- **Good**: Entity system allows extension without modification
- **Improvement**: UI components could use composition over inheritance

### Liskov Substitution Principle (LSP)
- **Good**: Unit hierarchy (Worker, Scout, Protector) is consistent
- **Good**: Parasite types share common base

### Interface Segregation Principle (ISP)
- **Good**: `UnitCommand` interface is focused
- **Good**: `ConnectionOptions` interface is minimal

### Dependency Inversion Principle (DIP)
- **Good**: GameEngine uses managers via getters
- **Improvement**: Could inject dependencies instead of using getInstance()

---

## DRY Principle Analysis

### Violations Found:
1. **Repeated UI setup patterns** in multiple UI components
2. **Similar entity update loops** across managers
3. **Duplicate position calculation logic**

### Well-Applied:
1. **MaterialManager** - centralized material creation
2. **SpatialIndex** - reused for all entity lookups
3. **ChunkUtils** - shared chunk calculation logic

---

## KISS Principle Analysis

### Overly Complex:
1. **Introduction system** - 3 large files for cinematic
2. **Combat system** - could be simplified

### Well-Applied:
1. **Rendering pipeline** - straightforward Babylon.js usage
2. **WebSocket client** - clean event-based design
3. **Unit system** - clear state machine for actions

---

## Test Coverage Assessment

### Well-Tested Modules:
- Entity classes (Queen, Hive, CombatParasite)
- Combat system (unit tests + integration)
- Territory manager
- WebSocket error handling

### Under-Tested Modules:
- `GameEngine.ts` - needs integration tests
- Most UI components
- Rendering modules

### E2E Tests:
- Building placement
- Game smoke tests
- NN dashboard
- Enhanced parasite system

---

## Hackathon Judging Criteria Compliance

### Application Quality (40 points)
- **Functionality**: Excellent - game is playable
- **Visual Quality**: Good - low-poly aesthetic is consistent
- **Code Quality**: Needs work - large files need splitting

### Documentation (20 points)
- **JSDoc Comments**: Good - most classes documented
- **Code Organization**: Good - clear folder structure
- **README**: Present

### Innovation (15 points)
- **AI Integration**: Excellent - real-time NN spawning
- **Visual Design**: Good - cohesive sci-fi aesthetic
- **Game Mechanics**: Good - unique queen/parasite system

---

## Priority Action Items

1. **Immediate (Before Submission)**:
   - Split `GameEngine.ts` into smaller modules
   - Document the performance optimizations
   - Ensure all tests pass

2. **If Time Permits**:
   - Split large UI components
   - Add JSDoc to undocumented functions
   - Add mesh instancing for performance

3. **Post-Hackathon**:
   - Implement ECS pattern
   - Add LOD system
   - Full UI component refactoring
   - Add more integration tests

---

## Code Quality Metrics Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Max file size | 2,800 lines | <500 lines | Needs work |
| Test coverage | ~60% | >80% | Good |
| Type coverage | ~95% | 100% | Excellent |
| Documentation | ~80% | >90% | Good |
| Cyclomatic complexity | Varies | <10 per function | Needs audit |

---

## Detailed Refactoring Guide

This section provides specific, actionable changes for each file identified in the code review.

---

### 1. GameEngine.ts Refactoring (CRITICAL)

**Current State**: `client/src/game/GameEngine.ts` - 1,260 lines
**Target State**: 4 focused files, each <300 lines

#### Step 1: Create `client/src/game/engine/` directory

```
client/src/game/engine/
├── EngineCore.ts        # Babylon.js engine, scene, render loop
├── SystemManager.ts     # Game systems coordination
├── InputHandler.ts      # Mouse/keyboard event handling
└── GameEngine.ts        # Facade that combines all (slim)
```

#### Step 2: Extract EngineCore.ts (~200 lines)

**Move these responsibilities:**
- `private engine: Engine`
- `private scene: Scene`
- `private canvas: HTMLCanvasElement`
- `createEngine()` method
- `createScene()` method
- `setupLighting()` method
- `startRenderLoop()` method
- `dispose()` for engine/scene cleanup

```typescript
// client/src/game/engine/EngineCore.ts
export class EngineCore {
    private engine: Engine;
    private scene: Scene;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.engine = new Engine(canvas, true);
        this.scene = new Scene(this.engine);
        this.setupLighting();
    }

    private setupLighting(): void {
        // Move lighting setup here
    }

    public startRenderLoop(): void {
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
    }

    public getScene(): Scene { return this.scene; }
    public getEngine(): Engine { return this.engine; }

    public dispose(): void {
        this.scene.dispose();
        this.engine.dispose();
    }
}
```

#### Step 3: Extract InputHandler.ts (~200 lines)

**Move these responsibilities:**
- `onPointerDown` handler
- `onPointerMove` handler
- `onPointerUp` handler
- `onKeyDown` handler
- Mouse picking logic
- Selection box logic
- Keyboard shortcuts

```typescript
// client/src/game/engine/InputHandler.ts
export class InputHandler {
    private scene: Scene;
    private selectionCallback: (entities: Entity[]) => void;

    constructor(scene: Scene) {
        this.scene = scene;
        this.setupPointerEvents();
        this.setupKeyboardEvents();
    }

    private setupPointerEvents(): void {
        this.scene.onPointerDown = (evt, pickResult) => {
            // Move pointer down logic here
        };
        // ... other pointer events
    }

    private setupKeyboardEvents(): void {
        // Move keyboard handling here
    }

    public onEntitySelected(callback: (entities: Entity[]) => void): void {
        this.selectionCallback = callback;
    }

    public dispose(): void {
        // Remove event listeners
    }
}
```

#### Step 4: Extract SystemManager.ts (~150 lines)

**Move these responsibilities:**
- References to all game systems (UnitManager, BuildingManager, etc.)
- System initialization order
- System update coordination
- Inter-system communication

```typescript
// client/src/game/engine/SystemManager.ts
export class SystemManager {
    private unitManager: UnitManager;
    private buildingManager: BuildingManager;
    private territoryManager: TerritoryManager;
    private combatManager: CombatManager;
    private parasiteManager: ParasiteManager;

    constructor(scene: Scene) {
        this.initializeSystems(scene);
    }

    private initializeSystems(scene: Scene): void {
        this.territoryManager = new TerritoryManager(scene);
        this.unitManager = new UnitManager(scene);
        this.buildingManager = new BuildingManager(scene);
        this.combatManager = new CombatManager(scene);
        this.parasiteManager = new ParasiteManager(scene);
    }

    public update(deltaTime: number): void {
        this.unitManager.update(deltaTime);
        this.combatManager.update(deltaTime);
        this.parasiteManager.update(deltaTime);
    }

    // Getters for each system
    public getUnitManager(): UnitManager { return this.unitManager; }
    // ... other getters

    public dispose(): void {
        // Dispose all systems
    }
}
```

#### Step 5: Slim down GameEngine.ts (~150 lines)

**Keep only:**
- Facade pattern combining EngineCore, SystemManager, InputHandler
- Public API for external callers
- High-level game state (paused, started, etc.)

```typescript
// client/src/game/engine/GameEngine.ts (refactored)
export class GameEngine {
    private engineCore: EngineCore;
    private systemManager: SystemManager;
    private inputHandler: InputHandler;
    private uiManager: UIManager;

    constructor(canvas: HTMLCanvasElement) {
        this.engineCore = new EngineCore(canvas);
        this.systemManager = new SystemManager(this.engineCore.getScene());
        this.inputHandler = new InputHandler(this.engineCore.getScene());
        this.uiManager = new UIManager(this.engineCore.getScene());
    }

    public start(): void {
        this.engineCore.startRenderLoop();
    }

    // Delegate to appropriate manager
    public getUnitManager(): UnitManager {
        return this.systemManager.getUnitManager();
    }

    public dispose(): void {
        this.inputHandler.dispose();
        this.systemManager.dispose();
        this.uiManager.dispose();
        this.engineCore.dispose();
    }
}
```

---

### 2. IntroductionModelRenderer.ts Refactoring (HIGH)

**Current State**: `client/src/ui/IntroductionModelRenderer.ts` - 2,800+ lines
**Target State**: 4-5 focused files, each <600 lines

#### Step 1: Create `client/src/ui/introduction/` directory

```
client/src/ui/introduction/
├── IntroductionModelRenderer.ts  # Main coordinator (slim)
├── IntroductionScene.ts          # Scene setup, lighting, camera
├── IntroductionModels.ts         # 3D model creation (planets, ships, etc.)
├── IntroductionAnimations.ts     # Animation sequences
└── IntroductionEffects.ts        # Particle effects, glow, post-processing
```

#### Step 2: Extract IntroductionScene.ts (~400 lines)

**Move these responsibilities:**
- Scene creation and configuration
- Camera setup for cinematic shots
- Lighting setup (ambient, directional, point lights)
- Skybox/environment setup
- Scene disposal

```typescript
// client/src/ui/introduction/IntroductionScene.ts
export class IntroductionScene {
    private scene: Scene;
    private camera: ArcRotateCamera;

    constructor(engine: Engine) {
        this.scene = new Scene(engine);
        this.setupCamera();
        this.setupLighting();
        this.setupEnvironment();
    }

    private setupCamera(): void {
        // Cinematic camera setup
    }

    private setupLighting(): void {
        // Introduction-specific lighting
    }

    public setCameraTarget(target: Vector3, duration: number): void {
        // Animate camera to target
    }

    public getScene(): Scene { return this.scene; }
    public dispose(): void { this.scene.dispose(); }
}
```

#### Step 3: Extract IntroductionModels.ts (~800 lines)

**Move these responsibilities:**
- Planet mesh creation
- Spaceship mesh creation
- Queen/Hive model creation
- Station/structure creation
- All `MeshBuilder` calls

```typescript
// client/src/ui/introduction/IntroductionModels.ts
export class IntroductionModels {
    private scene: Scene;
    private models: Map<string, Mesh> = new Map();

    constructor(scene: Scene) {
        this.scene = scene;
    }

    public createPlanet(name: string, options: PlanetOptions): Mesh {
        // Planet creation logic
    }

    public createSpaceship(name: string, options: ShipOptions): Mesh {
        // Ship creation logic
    }

    public createQueenModel(): Mesh {
        // Queen model logic
    }

    public getModel(name: string): Mesh | undefined {
        return this.models.get(name);
    }

    public dispose(): void {
        this.models.forEach(mesh => mesh.dispose());
    }
}
```

#### Step 4: Extract IntroductionAnimations.ts (~600 lines)

**Move these responsibilities:**
- Animation sequences (orbit, approach, etc.)
- Timeline management
- Keyframe animations
- Animation callbacks

```typescript
// client/src/ui/introduction/IntroductionAnimations.ts
export class IntroductionAnimations {
    private scene: Scene;
    private animationGroups: AnimationGroup[] = [];

    constructor(scene: Scene) {
        this.scene = scene;
    }

    public playOrbitSequence(mesh: Mesh, duration: number): Promise<void> {
        // Orbit animation
    }

    public playApproachSequence(mesh: Mesh, target: Vector3): Promise<void> {
        // Approach animation
    }

    public createTimeline(sequences: AnimationSequence[]): Timeline {
        // Timeline creation
    }

    public stopAll(): void {
        this.animationGroups.forEach(group => group.stop());
    }
}
```

#### Step 5: Extract IntroductionEffects.ts (~400 lines)

**Move these responsibilities:**
- Particle systems (stars, dust, etc.)
- Glow/bloom effects
- Post-processing pipeline
- Shader effects

```typescript
// client/src/ui/introduction/IntroductionEffects.ts
export class IntroductionEffects {
    private scene: Scene;
    private particleSystems: ParticleSystem[] = [];

    constructor(scene: Scene) {
        this.scene = scene;
    }

    public createStarField(count: number): ParticleSystem {
        // Star particle system
    }

    public createGlowEffect(mesh: Mesh): GlowLayer {
        // Glow effect
    }

    public setupPostProcessing(camera: Camera): void {
        // Post-processing pipeline
    }

    public dispose(): void {
        this.particleSystems.forEach(ps => ps.dispose());
    }
}
```

---

### 3. IntroductionScreen.ts Refactoring (HIGH)

**Current State**: `client/src/ui/IntroductionScreen.ts` - ~1,500 lines
**Target State**: 3-4 focused files, each <400 lines

#### Step 1: Extend the `client/src/ui/introduction/` directory

```
client/src/ui/introduction/
├── ... (model renderer files)
├── IntroductionScreen.ts         # Main screen coordinator (slim)
├── IntroductionStory.ts          # Story content, text, pages
├── IntroductionNavigation.ts     # Navigation controls, progress
└── IntroductionPreferences.ts    # Settings, skip, audio controls
```

#### Step 2: Extract IntroductionStory.ts (~500 lines)

**Move these responsibilities:**
- Story page content definitions
- Text rendering and styling
- Page transitions
- Story progression logic

```typescript
// client/src/ui/introduction/IntroductionStory.ts
export interface StoryPage {
    title: string;
    content: string[];
    visualType: 'planet' | 'ship' | 'queen' | 'battle';
    duration: number;
}

export class IntroductionStory {
    private pages: StoryPage[];
    private currentPageIndex: number = 0;

    constructor() {
        this.pages = this.defineStoryPages();
    }

    private defineStoryPages(): StoryPage[] {
        return [
            { title: "The Discovery", content: [...], visualType: 'planet', duration: 5000 },
            // ... other pages
        ];
    }

    public getCurrentPage(): StoryPage {
        return this.pages[this.currentPageIndex];
    }

    public nextPage(): StoryPage | null {
        if (this.currentPageIndex < this.pages.length - 1) {
            this.currentPageIndex++;
            return this.getCurrentPage();
        }
        return null;
    }

    public getTotalPages(): number { return this.pages.length; }
}
```

#### Step 3: Extract IntroductionNavigation.ts (~300 lines)

**Move these responsibilities:**
- Next/Previous buttons
- Progress indicator
- Skip button logic
- Auto-advance timer

```typescript
// client/src/ui/introduction/IntroductionNavigation.ts
export class IntroductionNavigation {
    private gui: AdvancedDynamicTexture;
    private onNext: () => void;
    private onSkip: () => void;

    constructor(gui: AdvancedDynamicTexture) {
        this.gui = gui;
        this.createControls();
    }

    private createControls(): void {
        // Create navigation buttons
    }

    public updateProgress(current: number, total: number): void {
        // Update progress indicator
    }

    public setCallbacks(onNext: () => void, onSkip: () => void): void {
        this.onNext = onNext;
        this.onSkip = onSkip;
    }
}
```

---

### 4. Large UI Components Refactoring (MEDIUM)

#### BuildingPlacementUI.ts (~1,000 lines → ~400 lines)

**Extract into:**
- `BuildingPlacementUI.ts` - Main coordinator
- `BuildingMenu.ts` - Building selection menu
- `PlacementPreview.ts` - Ghost placement preview
- `PlacementValidator.ts` - Validation logic

#### CombatUI.ts (~900 lines → ~350 lines)

**Extract into:**
- `CombatUI.ts` - Main coordinator
- `CombatHUD.ts` - Health bars, damage numbers
- `CombatControls.ts` - Attack/defend commands
- `CombatEffects.ts` - Visual feedback

#### TerritoryVisualUI.ts (~850 lines → ~350 lines)

**Extract into:**
- `TerritoryVisualUI.ts` - Main coordinator
- `TerritoryOverlay.ts` - Territory boundaries
- `TerritoryColors.ts` - Color management
- `TerritoryLabels.ts` - Territory labels/info

---

### 5. DRY Violations to Fix

#### 5.1 Create UIComponentBase.ts

**Problem**: Repeated UI setup patterns across components
**Solution**: Create a base class with common functionality

```typescript
// client/src/ui/UIComponentBase.ts
export abstract class UIComponentBase {
    protected gui: AdvancedDynamicTexture;
    protected container: Container;

    constructor(gui: AdvancedDynamicTexture) {
        this.gui = gui;
        this.container = this.createContainer();
        this.gui.addControl(this.container);
    }

    protected createContainer(): Container {
        const container = new Rectangle();
        container.thickness = 0;
        return container;
    }

    protected createButton(text: string, onClick: () => void): Button {
        const button = Button.CreateSimpleButton("btn", text);
        button.onPointerUpObservable.add(onClick);
        return button;
    }

    protected createLabel(text: string): TextBlock {
        const label = new TextBlock();
        label.text = text;
        label.color = "white";
        return label;
    }

    public show(): void { this.container.isVisible = true; }
    public hide(): void { this.container.isVisible = false; }

    public dispose(): void {
        this.gui.removeControl(this.container);
        this.container.dispose();
    }
}
```

#### 5.2 Create PositionUtils.ts

**Problem**: Duplicate position calculation logic
**Solution**: Centralize in utility module

```typescript
// client/src/utils/PositionUtils.ts
export class PositionUtils {
    private static readonly CHUNK_SIZE = 10;
    private static readonly GRID_SIZE = 20;

    public static chunkToWorld(chunk: number): Vector3 {
        const x = (chunk % this.GRID_SIZE) * this.CHUNK_SIZE;
        const z = Math.floor(chunk / this.GRID_SIZE) * this.CHUNK_SIZE;
        return new Vector3(x, 0, z);
    }

    public static worldToChunk(position: Vector3): number {
        const x = Math.floor(position.x / this.CHUNK_SIZE);
        const z = Math.floor(position.z / this.CHUNK_SIZE);
        return z * this.GRID_SIZE + x;
    }

    public static distance(chunk1: number, chunk2: number): number {
        const p1 = this.chunkToWorld(chunk1);
        const p2 = this.chunkToWorld(chunk2);
        return Vector3.Distance(p1, p2);
    }
}
```

---

### 6. Performance Documentation to Add

Add JSDoc comments explaining WHY these optimizations exist:

#### CameraController.ts - Cached Vectors

```typescript
// client/src/rendering/CameraController.ts

/**
 * Cached vectors for camera movement calculations.
 *
 * WHY: Babylon.js Vector3 operations allocate new objects by default.
 * In the render loop (60fps), this would create 60+ objects/second
 * just for camera movement, causing GC pressure and frame drops.
 *
 * By reusing these vectors, we achieve zero-allocation camera updates.
 */
private readonly _moveDirection: Vector3 = new Vector3();
private readonly _tempVector: Vector3 = new Vector3();
```

#### SpatialIndex - O(1) Lookups

```typescript
// client/src/game/systems/SpatialIndex.ts

/**
 * Spatial index for O(1) entity lookups by chunk.
 *
 * WHY: Without spatial indexing, finding entities near a position
 * requires iterating all entities O(n). With 100+ units, this becomes
 * expensive when done every frame for combat/mining checks.
 *
 * This index maps chunk IDs to entity sets, enabling constant-time
 * lookups for "entities in chunk X" queries.
 */
```

#### Round-Robin System Updates

```typescript
// client/src/game/engine/SystemManager.ts

/**
 * Round-robin scheduling for non-critical system updates.
 *
 * WHY: Not all systems need 60fps updates. Combat needs immediate
 * response, but territory visuals can update at 10fps without
 * visible degradation. By spreading updates across frames, we
 * reduce per-frame CPU cost by ~40%.
 *
 * Critical (every frame): Combat, Movement, Input
 * Throttled (every 6 frames): Territory, Mining, UI updates
 */
```

---

### 7. Test Coverage Improvements

#### Add GameEngine Integration Tests

```typescript
// client/tests/game/GameEngine.integration.test.ts

describe('GameEngine Integration', () => {
    let engine: GameEngine;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        canvas = document.createElement('canvas');
        engine = new GameEngine(canvas);
    });

    afterEach(() => {
        engine.dispose();
    });

    it('should initialize all systems', () => {
        expect(engine.getUnitManager()).toBeDefined();
        expect(engine.getBuildingManager()).toBeDefined();
        expect(engine.getTerritoryManager()).toBeDefined();
    });

    it('should handle system communication', () => {
        const unit = engine.getUnitManager().createWorker(50);
        const building = engine.getBuildingManager().createHive(50);

        // Verify cross-system interaction
        expect(unit.canMineAt(building.chunk)).toBe(true);
    });

    it('should clean up on dispose', () => {
        const scene = engine.getScene();
        engine.dispose();

        expect(scene.isDisposed).toBe(true);
    });
});
```

---

### Summary Checklist

#### CRITICAL (Must complete before submission)
- [ ] Split `GameEngine.ts` into EngineCore, SystemManager, InputHandler
- [ ] Create `client/src/game/engine/` directory structure
- [ ] Update all imports to use new module paths
- [ ] Verify all tests pass after refactoring

#### HIGH (Complete if time permits)
- [ ] Split `IntroductionModelRenderer.ts` into Scene, Models, Animations, Effects
- [ ] Split `IntroductionScreen.ts` into Story, Navigation, Preferences
- [ ] Create `client/src/ui/introduction/` directory structure

#### MEDIUM (Nice to have)
- [ ] Create `UIComponentBase.ts` for shared UI patterns
- [ ] Create `PositionUtils.ts` for position calculations
- [ ] Split large UI components (BuildingPlacement, Combat, Territory)

#### Documentation
- [ ] Add WHY comments to performance optimizations
- [ ] Add JSDoc to all new classes and public methods
- [ ] Update README with new module structure
