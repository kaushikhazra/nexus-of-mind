# Design Document

## Overview

This design addresses critical code quality issues in the Nexus of Mind game client by refactoring oversized files into maintainable, focused modules. The primary goal is to eliminate god classes, implement SOLID principles, and create a clean architecture that will impress hackathon judges while maintaining the game's 60fps performance and existing functionality.

The refactoring focuses on three critical areas:
1. **GameEngine.ts** (1,260 lines) - Split into focused engine components
2. **IntroductionModelRenderer.ts** (2,800+ lines) - Modularize 3D rendering system
3. **Large UI Components** - Apply consistent patterns and eliminate duplication

## Architecture

### Current Architecture Problems

The current architecture suffers from several anti-patterns:
- **God Class**: GameEngine.ts manages engine, scene, systems, input, and UI
- **Monolithic Components**: Introduction system packed into single massive files
- **Code Duplication**: Repeated UI patterns and position calculations
- **Tight Coupling**: Systems directly reference each other without clear interfaces

### Target Architecture

The new architecture implements a **Layered Facade Pattern** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   GameEngine    │  │ IntroScreen     │  │  UI Layer   │ │
│  │   (Facade)      │  │   (Facade)      │  │  (Facade)   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     System Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  EngineCore     │  │ SystemManager   │  │ InputHandler│ │
│  │  (Babylon.js)   │  │ (Coordination)  │  │ (Events)    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Component Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  Game Systems   │  │ UI Components   │  │  Utilities  │ │
│  │  (Managers)     │  │ (Specialized)   │  │  (Shared)   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Single Responsibility**: Each class has one clear purpose
2. **Facade Pattern**: Complex subsystems hidden behind simple interfaces
3. **Dependency Injection**: Systems receive dependencies rather than creating them
4. **Event-Driven Communication**: Loose coupling through event system
5. **Shared Utilities**: Common functionality centralized in utility modules

## Components and Interfaces

### 1. GameEngine Refactoring

#### Current State
```typescript
// BEFORE: God class with 1,260 lines
class GameEngine {
    // Engine management
    // Scene management  
    // System coordination
    // Input handling
    // UI management
    // Camera control
    // Lighting setup
    // Event handling
}
```

#### Target State
```typescript
// AFTER: Focused facade with clear responsibilities

// Main facade (150 lines)
class GameEngine {
    private engineCore: EngineCore;
    private systemManager: SystemManager;
    private inputHandler: InputHandler;
    
    constructor(canvas: HTMLCanvasElement) {
        this.engineCore = new EngineCore(canvas);
        this.systemManager = new SystemManager(this.engineCore.getScene());
        this.inputHandler = new InputHandler(this.engineCore.getScene());
        this.wireComponents();
    }
    
    // Delegate to appropriate subsystem
    public getUnitManager(): UnitManager {
        return this.systemManager.getUnitManager();
    }
}

// Engine core (200 lines)
class EngineCore {
    private engine: Engine;
    private scene: Scene;
    
    constructor(canvas: HTMLCanvasElement) {
        this.engine = new Engine(canvas, true);
        this.scene = new Scene(this.engine);
        this.setupLighting();
    }
    
    public startRenderLoop(): void {
        this.engine.runRenderLoop(() => this.scene.render());
    }
}

// System coordination (150 lines)
class SystemManager {
    private systems: Map<string, GameSystem>;
    
    constructor(scene: Scene) {
        this.initializeSystems(scene);
    }
    
    public update(deltaTime: number): void {
        this.systems.forEach(system => system.update(deltaTime));
    }
}

// Input handling (200 lines)
class InputHandler {
    private scene: Scene;
    private eventHandlers: Map<string, EventHandler>;
    
    constructor(scene: Scene) {
        this.scene = scene;
        this.setupEventHandlers();
    }
}
```

### 2. Introduction System Refactoring

#### Current State
```typescript
// BEFORE: Monolithic renderer with 2,800+ lines
class IntroductionModelRenderer {
    // Scene setup
    // Model creation
    // Animation sequences
    // Particle effects
    // Camera control
    // Lighting management
}
```

#### Target State
```typescript
// AFTER: Modular system with focused components

// Main coordinator (200 lines)
class IntroductionModelRenderer {
    private scene: IntroductionScene;
    private models: IntroductionModels;
    private animations: IntroductionAnimations;
    private effects: IntroductionEffects;
    
    constructor(engine: Engine) {
        this.scene = new IntroductionScene(engine);
        this.models = new IntroductionModels(this.scene.getScene());
        this.animations = new IntroductionAnimations(this.scene.getScene());
        this.effects = new IntroductionEffects(this.scene.getScene());
    }
}

// Scene management (400 lines)
class IntroductionScene {
    private scene: Scene;
    private camera: ArcRotateCamera;
    
    public setCameraTarget(target: Vector3, duration: number): Animation {
        return this.createCameraAnimation(target, duration);
    }
}

// Model creation (600 lines)
class IntroductionModels {
    private modelCache: Map<string, Mesh>;
    
    public createPlanet(options: PlanetOptions): Mesh {
        return this.buildPlanetMesh(options);
    }
}

// Animation management (500 lines)
class IntroductionAnimations {
    private animationGroups: AnimationGroup[];
    
    public playSequence(name: string): Promise<void> {
        return this.executeAnimationSequence(name);
    }
}

// Effects system (400 lines)
class IntroductionEffects {
    private particleSystems: ParticleSystem[];
    
    public createStarField(): ParticleSystem {
        return this.buildStarParticleSystem();
    }
}
```

### 3. UI Component Base Architecture

#### Shared UI Foundation
```typescript
// Base class for all UI components
abstract class UIComponentBase {
    protected gui: AdvancedDynamicTexture;
    protected container: Container;
    protected isVisible: boolean = false;
    
    constructor(gui: AdvancedDynamicTexture) {
        this.gui = gui;
        this.container = this.createContainer();
        this.setupComponent();
    }
    
    protected abstract setupComponent(): void;
    
    protected createButton(text: string, onClick: () => void): Button {
        const button = Button.CreateSimpleButton("btn", text);
        button.onPointerUpObservable.add(onClick);
        this.applyButtonStyling(button);
        return button;
    }
    
    protected createLabel(text: string): TextBlock {
        const label = new TextBlock();
        label.text = text;
        this.applyLabelStyling(label);
        return label;
    }
    
    public show(): void {
        this.container.isVisible = true;
        this.isVisible = true;
        this.onShow();
    }
    
    public hide(): void {
        this.container.isVisible = false;
        this.isVisible = false;
        this.onHide();
    }
    
    protected onShow(): void {} // Override in subclasses
    protected onHide(): void {} // Override in subclasses
    
    public dispose(): void {
        this.gui.removeControl(this.container);
        this.container.dispose();
    }
}

// Example specialized component
class BuildingPlacementUI extends UIComponentBase {
    private buildingMenu: BuildingMenu;
    private placementPreview: PlacementPreview;
    private placementValidator: PlacementValidator;
    
    protected setupComponent(): void {
        this.buildingMenu = new BuildingMenu(this.container);
        this.placementPreview = new PlacementPreview(this.container);
        this.placementValidator = new PlacementValidator();
    }
}
```

### 4. Utility Module Architecture

#### Position Utilities
```typescript
class PositionUtils {
    private static readonly CHUNK_SIZE = 10;
    private static readonly GRID_SIZE = 20;
    
    /**
     * Convert chunk ID to world position
     * Used throughout the codebase for spatial calculations
     */
    public static chunkToWorld(chunk: number): Vector3 {
        const x = (chunk % this.GRID_SIZE) * this.CHUNK_SIZE;
        const z = Math.floor(chunk / this.GRID_SIZE) * this.CHUNK_SIZE;
        return new Vector3(x, 0, z);
    }
    
    /**
     * Convert world position to chunk ID
     * Enables spatial indexing for O(1) entity lookups
     */
    public static worldToChunk(position: Vector3): number {
        const x = Math.floor(position.x / this.CHUNK_SIZE);
        const z = Math.floor(position.z / this.CHUNK_SIZE);
        return z * this.GRID_SIZE + x;
    }
    
    /**
     * Calculate distance between chunks
     * Optimized for frequent distance checks in combat/mining
     */
    public static chunkDistance(chunk1: number, chunk2: number): number {
        const p1 = this.chunkToWorld(chunk1);
        const p2 = this.chunkToWorld(chunk2);
        return Vector3.Distance(p1, p2);
    }
}
```

#### Performance Utilities
```typescript
class PerformanceUtils {
    /**
     * Zero-allocation vector operations
     * Reuse these vectors for frequent calculations to avoid GC pressure
     */
    private static readonly _tempVector1 = new Vector3();
    private static readonly _tempVector2 = new Vector3();
    private static readonly _tempVector3 = new Vector3();
    
    /**
     * Calculate direction without allocation
     * Used in movement and combat systems for 60fps performance
     */
    public static getDirection(from: Vector3, to: Vector3, result: Vector3): void {
        to.subtractToRef(from, result);
        result.normalize();
    }
    
    /**
     * Round-robin scheduler for system updates
     * Distributes non-critical updates across frames to maintain 60fps
     */
    public static createRoundRobinScheduler(systems: GameSystem[], frameInterval: number): UpdateScheduler {
        return new RoundRobinScheduler(systems, frameInterval);
    }
}
```

## Data Models

### Module Organization Structure

```
client/src/
├── game/
│   ├── engine/                    # GameEngine refactoring
│   │   ├── EngineCore.ts         # Babylon.js engine/scene (200 lines)
│   │   ├── SystemManager.ts      # Game systems coordination (150 lines)
│   │   ├── InputHandler.ts       # Input event handling (200 lines)
│   │   └── GameEngine.ts         # Main facade (150 lines)
│   ├── systems/                   # Existing game systems (unchanged)
│   └── entities/                  # Existing entities (unchanged)
├── ui/
│   ├── base/                      # Shared UI foundation
│   │   ├── UIComponentBase.ts    # Base class for all UI components
│   │   ├── UIEventBus.ts         # Event communication between components
│   │   └── UITheme.ts            # Consistent styling and theming
│   ├── introduction/              # Introduction system refactoring
│   │   ├── IntroductionModelRenderer.ts  # Main coordinator (200 lines)
│   │   ├── IntroductionScene.ts          # Scene setup (400 lines)
│   │   ├── IntroductionModels.ts         # 3D model creation (600 lines)
│   │   ├── IntroductionAnimations.ts     # Animation sequences (500 lines)
│   │   ├── IntroductionEffects.ts        # Visual effects (400 lines)
│   │   ├── IntroductionScreen.ts         # Main screen coordinator (300 lines)
│   │   ├── IntroductionStory.ts          # Story content (400 lines)
│   │   ├── IntroductionNavigation.ts     # Navigation controls (250 lines)
│   │   └── IntroductionPreferences.ts    # Settings/preferences (200 lines)
│   ├── building/                  # Building placement refactoring
│   │   ├── BuildingPlacementUI.ts        # Main coordinator (300 lines)
│   │   ├── BuildingMenu.ts               # Building selection (200 lines)
│   │   ├── PlacementPreview.ts           # Ghost placement (150 lines)
│   │   └── PlacementValidator.ts         # Validation logic (150 lines)
│   ├── combat/                    # Combat UI refactoring
│   │   ├── CombatUI.ts                   # Main coordinator (250 lines)
│   │   ├── CombatHUD.ts                  # Health bars/damage (200 lines)
│   │   ├── CombatControls.ts             # Attack/defend commands (150 lines)
│   │   └── CombatEffects.ts              # Visual feedback (200 lines)
│   └── territory/                 # Territory UI refactoring
│       ├── TerritoryVisualUI.ts          # Main coordinator (250 lines)
│       ├── TerritoryOverlay.ts           # Territory boundaries (200 lines)
│       ├── TerritoryColors.ts            # Color management (150 lines)
│       └── TerritoryLabels.ts            # Territory info (200 lines)
├── utils/                         # Shared utilities
│   ├── PositionUtils.ts          # Spatial calculations
│   ├── PerformanceUtils.ts       # Performance optimizations
│   └── MathUtils.ts              # Mathematical operations
└── rendering/                     # Existing rendering (unchanged)
```

### Interface Definitions

```typescript
// Core system interface
interface GameSystem {
    update(deltaTime: number): void;
    dispose(): void;
    getName(): string;
}

// Event system for loose coupling
interface GameEvent {
    type: string;
    data: any;
    timestamp: number;
}

interface EventHandler {
    handle(event: GameEvent): void;
}

// UI component lifecycle
interface UIComponent {
    show(): void;
    hide(): void;
    dispose(): void;
    isVisible(): boolean;
}

// Performance monitoring
interface PerformanceMetrics {
    frameRate: number;
    memoryUsage: number;
    renderTime: number;
    updateTime: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: File Size Constraint Compliance
*For any* TypeScript file in the refactored codebase, the line count should not exceed 500 lines
**Validates: Requirements 1.1**

### Property 2: Functional Preservation
*For any* existing functionality in the game, it should continue to work exactly as before after refactoring, with all existing tests passing
**Validates: Requirements 1.5, 2.5, 6.3**

### Property 3: Single Responsibility Compliance
*For any* class in the refactored codebase, it should have exactly one well-defined responsibility and all its methods should relate to that core purpose
**Validates: Requirements 2.2, 2.3, 2.4**

### Property 4: DRY Principle Compliance
*For any* logic pattern in the codebase, it should exist in exactly one location, with all dependent code using the centralized implementation
**Validates: Requirements 3.4, 3.5**

### Property 5: Directory Structure Organization
*For any* related functionality, it should be grouped in logical directory hierarchies with UI components in feature-specific directories
**Validates: Requirements 1.4, 5.2**

### Property 6: Build System Compatibility
*For any* build operation (compile, test, bundle), it should complete successfully without errors after refactoring
**Validates: Requirements 5.4, 5.5, 10.1, 10.3**

### Property 7: Performance Maintenance
*For any* game performance metric (frame rate, memory usage), it should be maintained or improved after refactoring, with 60fps gameplay preserved
**Validates: Requirements 4.4**

### Property 8: Test Coverage Preservation
*For any* module in the codebase, test coverage should be maintained at current levels or improved, with new modules achieving at least 80% coverage
**Validates: Requirements 6.1, 6.5**

### Property 9: Cross-Module Integration
*For any* interaction between refactored modules, it should work correctly with proper dependency resolution and communication
**Validates: Requirements 6.2, 7.5**

### Property 10: UI Component Consistency
*For any* UI component, it should follow consistent patterns for lifecycle management, styling, and event handling through the base class
**Validates: Requirements 8.2, 8.3, 8.4, 8.5**

### Property 11: Spatial Utility Centralization
*For any* position or coordinate calculation, it should use the centralized PositionUtils functions with mathematically correct transformations
**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

### Property 12: Documentation Quality
*For any* performance optimization in the code, it should include JSDoc comments explaining the WHY behind the optimization
**Validates: Requirements 4.1, 4.2, 4.3, 4.5**

### Property 13: Development Workflow Compatibility
*For any* development workflow (hot reloading, build performance), it should work correctly with the new file structure without regression
**Validates: Requirements 10.2, 10.4, 10.5**

## Error Handling

### Refactoring Error Prevention

The refactoring process must handle several categories of potential errors:

#### 1. Import Resolution Errors
**Problem**: Moving files breaks existing import statements
**Solution**: 
- Use TypeScript compiler to validate all imports after each module extraction
- Implement automated import path updates using AST transformation
- Create import mapping configuration for complex moves

```typescript
// Before refactoring
import { GameEngine } from './game/GameEngine';

// After refactoring - automatically updated
import { GameEngine } from './game/engine/GameEngine';
```

#### 2. Circular Dependency Detection
**Problem**: Refactoring may introduce circular dependencies between modules
**Solution**:
- Use dependency analysis tools to detect cycles before they cause runtime errors
- Implement dependency injection to break tight coupling
- Create clear dependency hierarchy with one-way dependencies

```typescript
// Avoid circular dependencies
// ❌ Bad: GameEngine imports SystemManager, SystemManager imports GameEngine
// ✅ Good: GameEngine creates SystemManager, SystemManager uses interfaces
```

#### 3. Runtime Behavior Changes
**Problem**: Refactoring may inadvertently change runtime behavior
**Solution**:
- Maintain comprehensive test suite that validates behavior preservation
- Use property-based testing to verify invariants across refactoring
- Implement integration tests for cross-module communication

#### 4. Performance Regression Detection
**Problem**: Refactoring may introduce performance bottlenecks
**Solution**:
- Implement automated performance benchmarks
- Monitor frame rate during refactoring process
- Use profiling tools to identify performance regressions

```typescript
// Performance monitoring during refactoring
class PerformanceMonitor {
    private frameRateThreshold = 60;
    
    public validatePerformance(): boolean {
        const currentFPS = this.measureFrameRate();
        return currentFPS >= this.frameRateThreshold;
    }
}
```

### Error Recovery Strategies

#### 1. Incremental Refactoring
- Refactor one file at a time to isolate potential issues
- Maintain working state after each refactoring step
- Use feature flags to enable/disable refactored modules during development

#### 2. Rollback Capability
- Maintain git branches for each refactoring step
- Implement automated rollback if tests fail
- Keep original files until refactoring is fully validated

#### 3. Validation Checkpoints
- Run full test suite after each major refactoring step
- Validate build process after module moves
- Check performance benchmarks at regular intervals

## Testing Strategy

### Dual Testing Approach

The refactoring effort requires both **unit tests** and **property-based tests** to ensure comprehensive coverage:

#### Unit Testing Focus
- **Specific Examples**: Test concrete scenarios like "GameEngine initializes all systems correctly"
- **Edge Cases**: Test boundary conditions like "empty UI component containers"
- **Integration Points**: Test cross-module communication like "SystemManager coordinates with InputHandler"
- **Error Conditions**: Test failure scenarios like "invalid file paths in imports"

#### Property-Based Testing Focus
- **Universal Properties**: Test properties that hold for all inputs like "all files under 500 lines"
- **Structural Invariants**: Test architectural constraints like "no circular dependencies"
- **Performance Properties**: Test performance characteristics like "60fps maintained across all scenarios"
- **Behavioral Preservation**: Test that refactoring doesn't change observable behavior

### Testing Configuration

#### Property-Based Test Setup
- **Library**: Use `fast-check` for TypeScript property-based testing
- **Iterations**: Minimum 100 iterations per property test for statistical confidence
- **Test Tagging**: Each property test references its design document property

```typescript
// Example property test configuration
import fc from 'fast-check';

describe('File Size Constraint Property', () => {
    it('should ensure no TypeScript file exceeds 500 lines', () => {
        // Feature: client-code-quality, Property 1: File Size Constraint Compliance
        fc.assert(fc.property(
            fc.constantFrom(...getAllTypeScriptFiles()),
            (filePath) => {
                const lineCount = countLinesInFile(filePath);
                return lineCount <= 500;
            }
        ), { numRuns: 100 });
    });
});
```

#### Unit Test Examples
```typescript
describe('GameEngine Refactoring', () => {
    it('should initialize EngineCore with Babylon.js engine', () => {
        const canvas = document.createElement('canvas');
        const engineCore = new EngineCore(canvas);
        
        expect(engineCore.getEngine()).toBeInstanceOf(Engine);
        expect(engineCore.getScene()).toBeInstanceOf(Scene);
    });
    
    it('should coordinate systems through SystemManager', () => {
        const scene = new Scene(new Engine(canvas, true));
        const systemManager = new SystemManager(scene);
        
        expect(systemManager.getUnitManager()).toBeDefined();
        expect(systemManager.getBuildingManager()).toBeDefined();
    });
});
```

### Integration Testing Strategy

#### Cross-Module Communication Tests
```typescript
describe('Module Integration', () => {
    it('should maintain communication between GameEngine and UI systems', () => {
        const gameEngine = new GameEngine(canvas);
        const buildingUI = new BuildingPlacementUI(gameEngine.getGUI());
        
        // Test that UI can interact with game systems
        const building = buildingUI.placeBuildingAt(50);
        expect(gameEngine.getBuildingManager().getBuildingAt(50)).toBe(building);
    });
});
```

#### Performance Integration Tests
```typescript
describe('Performance Integration', () => {
    it('should maintain 60fps with refactored architecture', async () => {
        const gameEngine = new GameEngine(canvas);
        const performanceMonitor = new PerformanceMonitor();
        
        // Run game loop for 1 second
        await runGameLoopFor(1000);
        
        const averageFPS = performanceMonitor.getAverageFPS();
        expect(averageFPS).toBeGreaterThanOrEqual(60);
    });
});
```

### Test Coverage Requirements

#### Coverage Targets
- **Existing Modules**: Maintain current coverage levels (minimum 80%)
- **New Modules**: Achieve minimum 80% coverage
- **Integration Points**: 100% coverage for cross-module communication
- **Critical Paths**: 100% coverage for performance-critical code

#### Coverage Monitoring
```typescript
// Jest configuration for coverage monitoring
module.exports = {
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.test.ts',
        '!src/**/*.spec.ts'
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        },
        './src/game/engine/': {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90
        }
    }
};
```

This comprehensive testing strategy ensures that the refactoring maintains code quality while preserving all existing functionality and performance characteristics.