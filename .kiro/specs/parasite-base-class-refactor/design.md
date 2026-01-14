# Parasite Base Class Refactor - Design Document

## Overview

The Parasite Base Class Refactor consolidates duplicated code across EnergyParasite, CombatParasite, and Queen into a single abstract base class. This eliminates ~300 lines of duplicated movement, animation, and patrol code while establishing a clean inheritance hierarchy where each subclass only defines what makes it unique: color, targeting behavior, and special abilities.

## Architecture

### Current Architecture (Before Refactor)

```
EnergyParasite (implements CombatTarget)
│   - movement logic (duplicated)
│   - segment animation (duplicated)
│   - patrol behavior (duplicated)
│   - yellow color
│   - targets: workers
│
└── CombatParasite (extends EnergyParasite)
        - movement logic (overridden/duplicated)
        - segment animation (duplicated)
        - patrol behavior (enhanced copy)
        - red color
        - targets: protectors, workers

Queen (implements CombatTarget) [SEPARATE HIERARCHY]
│   - movement logic (duplicated)
│   - segment animation (duplicated)
│   - patrol behavior (duplicated)
│   - purple color
│   - targets: workers, protectors
│   - spawns parasites
│
└── AdaptiveQueen (extends Queen)
        - AI learning capabilities
```

### Target Architecture (After Refactor)

```
Parasite (abstract, implements CombatTarget)
│   - moveTowards()           [SHARED]
│   - updateSegmentAnimation() [SHARED]
│   - updatePatrolling()       [SHARED]
│   - generatePatrolTarget()   [SHARED]
│   - createMesh()            [SHARED, uses getColor()]
│   - abstract getColor()
│   - abstract getTargetPriority()
│
├── EnergyParasite
│       - getColor() → Yellow
│       - getTargetPriority() → [Worker]
│       - updateTargeting() → workers only
│
├── CombatParasite
│       - getColor() → Red
│       - getTargetPriority() → [Protector, Worker]
│       - updateTargeting() → protectors first
│       - enhanced aggression behavior
│
└── Queen
    │   - getColor() → Purple
    │   - getTargetPriority() → [Worker, Protector]
    │   - spawnParasites()     [QUEEN-SPECIFIC]
    │   - hive management      [QUEEN-SPECIFIC]
    │
    └── AdaptiveQueen
            - AI learning layer
            - strategy adaptation
```

### Integration Points

- **ParasiteManager**: No changes required - continues to create EnergyParasite/CombatParasite instances
- **CombatSystem**: No changes required - all parasites implement CombatTarget
- **MaterialManager**: Minor update to support base class color application
- **Auto-Attack System**: No changes required - targeting interface unchanged

## Components and Interfaces

### Abstract Parasite Base Class

```typescript
export abstract class Parasite implements CombatTarget {
    // CombatTarget interface properties
    public readonly id: string;
    public position: Vector3;
    public health: number;
    public maxHealth: number;

    // Shared movement properties
    protected speed: number;
    protected isMoving: boolean = false;
    protected facingAngle: number = 0;

    // Shared patrol properties
    protected territoryCenter: Vector3;
    protected patrolRadius: number;
    protected patrolTarget: Vector3;
    protected patrolPauseTime: number = 0;
    protected patrolPauseDuration: number = 2;
    protected isPatrolPaused: boolean = false;

    // Shared visual properties
    protected segments: Mesh[] = [];
    protected parentNode: TransformNode;
    protected scene: Scene;

    // Abstract methods - subclasses MUST implement
    abstract getColor(): Color3;
    abstract getTargetPriority(): TargetType[];

    // Shared movement implementation
    protected moveTowards(target: Vector3, deltaTime: number): void {
        const direction = target.subtract(this.position).normalize();
        const movement = direction.scale(this.speed * deltaTime);

        this.isMoving = movement.length() > 0.01;

        if (this.isMoving) {
            this.facingAngle = Math.atan2(direction.x, direction.z);
            this.applyRotationToSegments(this.facingAngle);
        }

        this.position.addInPlace(movement);
        this.updateMeshPosition();
    }

    // Shared segment animation
    protected updateSegmentAnimation(): void {
        const time = Date.now() * 0.002;

        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const waveOffset = Math.sin(time + i * 0.5) * 0.3;

            if (this.isMoving) {
                // Trail behind movement direction
                const trailDistance = (i + 1) * this.getSegmentSpacing();
                segment.position.x = -Math.sin(this.facingAngle) * trailDistance;
                segment.position.z = -Math.cos(this.facingAngle) * trailDistance;
            }

            segment.position.y = waveOffset;
        }
    }

    // Shared patrol behavior
    protected updatePatrolling(deltaTime: number): void {
        if (this.isPatrolPaused) {
            this.patrolPauseTime -= deltaTime;
            if (this.patrolPauseTime <= 0) {
                this.isPatrolPaused = false;
                this.patrolTarget = this.generatePatrolTarget();
            }
            this.updateSegmentAnimation();
            return;
        }

        this.moveTowards(this.patrolTarget, deltaTime);

        if (Vector3.Distance(this.position, this.patrolTarget) < 1.0) {
            this.isPatrolPaused = true;
            this.patrolPauseTime = this.patrolPauseDuration + Math.random() * 2;
        }

        this.updateSegmentAnimation();
    }

    // Shared patrol target generation
    protected generatePatrolTarget(): Vector3 {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.patrolRadius;

        return new Vector3(
            this.territoryCenter.x + Math.cos(angle) * radius,
            this.territoryCenter.y,
            this.territoryCenter.z + Math.sin(angle) * radius
        );
    }

    // Overridable properties for subclass customization
    protected getSegmentSpacing(): number { return 0.8; }
    protected getSegmentCount(): number { return 5; }
}
```

### EnergyParasite Subclass

```typescript
export class EnergyParasite extends Parasite {
    protected parasiteType: ParasiteType = ParasiteType.ENERGY;

    // Implement abstract methods
    public getColor(): Color3 {
        return new Color3(1.0, 0.85, 0.2); // Yellow/Gold
    }

    public getTargetPriority(): TargetType[] {
        return [TargetType.WORKER];
    }

    // Energy-specific targeting
    protected updateTargeting(nearbyUnits: Unit[]): void {
        const workers = nearbyUnits.filter(u => u.type === UnitType.WORKER);
        if (workers.length > 0) {
            this.currentTarget = this.findClosest(workers);
            this.setState(ParasiteState.HUNTING);
        }
    }

    // Energy drain behavior (unique to EnergyParasite)
    protected drainEnergy(worker: Worker): void {
        worker.energy -= this.drainRate;
    }
}
```

### CombatParasite Subclass

```typescript
export class CombatParasite extends Parasite {
    protected parasiteType: ParasiteType = ParasiteType.COMBAT;
    protected aggressionLevel: number = 0.8;

    // Implement abstract methods
    public getColor(): Color3 {
        return new Color3(0.9, 0.2, 0.2); // Red
    }

    public getTargetPriority(): TargetType[] {
        return [TargetType.PROTECTOR, TargetType.WORKER];
    }

    // Combat-specific targeting (protectors first)
    protected updateTargeting(nearbyUnits: Unit[]): void {
        const protectors = nearbyUnits.filter(u => u.type === UnitType.PROTECTOR);
        const workers = nearbyUnits.filter(u => u.type === UnitType.WORKER);

        if (protectors.length > 0) {
            this.currentTarget = this.findClosest(protectors);
        } else if (workers.length > 0) {
            this.currentTarget = this.findClosest(workers);
        }

        if (this.currentTarget) {
            this.setState(ParasiteState.HUNTING);
        }
    }

    // Enhanced patrol with aggression (override base behavior)
    protected generatePatrolTarget(): Vector3 {
        // More aggressive patrol pattern
        const baseTarget = super.generatePatrolTarget();
        const aggressionOffset = this.aggressionLevel * 5;
        return baseTarget.add(new Vector3(
            (Math.random() - 0.5) * aggressionOffset,
            0,
            (Math.random() - 0.5) * aggressionOffset
        ));
    }
}
```

### Queen Subclass

```typescript
export class Queen extends Parasite {
    // Queen-specific properties
    protected hivePosition: Vector3;
    protected spawnCooldown: number = 0;
    protected spawnInterval: number = 30; // seconds

    // Implement abstract methods
    public getColor(): Color3 {
        return new Color3(0.6, 0.2, 0.8); // Purple
    }

    public getTargetPriority(): TargetType[] {
        return [TargetType.WORKER, TargetType.PROTECTOR];
    }

    // Override for larger Queen
    protected getSegmentCount(): number { return 8; }
    protected getSegmentSpacing(): number { return 1.2; }

    // Queen-specific: spawn other parasites
    public spawnParasites(manager: ParasiteManager): void {
        if (this.spawnCooldown <= 0) {
            manager.spawnParasiteNear(this.position);
            this.spawnCooldown = this.spawnInterval;
        }
    }

    // Queen-specific update loop
    public update(deltaTime: number, nearbyUnits: Unit[], manager: ParasiteManager): void {
        super.update(deltaTime, nearbyUnits);

        this.spawnCooldown -= deltaTime;
        this.spawnParasites(manager);
    }
}
```

## Data Models

### Target Type Enumeration

```typescript
export enum TargetType {
    WORKER = 'worker',
    PROTECTOR = 'protector',
    STRUCTURE = 'structure'
}
```

### Parasite Configuration

```typescript
export interface ParasiteConfig {
    health: number;
    maxHealth: number;
    speed: number;
    patrolRadius: number;
    segmentCount: number;
    segmentSpacing: number;
    color: Color3;
}

export const PARASITE_CONFIGS: Record<ParasiteType, Partial<ParasiteConfig>> = {
    [ParasiteType.ENERGY]: {
        health: 2,
        maxHealth: 2,
        speed: 2.0,
        patrolRadius: 15,
        segmentCount: 5,
        segmentSpacing: 0.8
    },
    [ParasiteType.COMBAT]: {
        health: 4,
        maxHealth: 4,
        speed: 2.5,
        patrolRadius: 15,
        segmentCount: 5,
        segmentSpacing: 0.8
    },
    [ParasiteType.QUEEN]: {
        health: 10,
        maxHealth: 10,
        speed: 1.5,
        patrolRadius: 20,
        segmentCount: 8,
        segmentSpacing: 1.2
    }
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do.*

### Property 1: Movement Consistency
*For any* two parasites of different types moving toward the same target, the movement interpolation and facing direction calculation should produce identical results (given the same speed).
**Validates: Requirements 2.1, 2.3, 2.5**

### Property 2: Animation Uniformity
*For any* parasite type, the segment wave animation should use the same mathematical formula, differing only by configurable parameters (segment count, spacing).
**Validates: Requirements 3.1, 3.2, 3.4**

### Property 3: Patrol Territory Bounds
*For any* parasite patrolling its territory, the generated patrol targets should never exceed the configured patrol radius from the territory center.
**Validates: Requirements 4.2, 4.3, 4.5**

### Property 4: Color Uniqueness
*For any* two parasites of different types, calling `getColor()` should return distinct Color3 values that are visually distinguishable.
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 5: Targeting Hierarchy
*For any* CombatParasite with both protectors and workers in range, calling targeting logic should select a protector before any worker.
**Validates: Requirements 6.2, 6.4**

### Property 6: EnergyParasite Worker-Only Targeting
*For any* EnergyParasite with protectors and workers in range, the targeting logic should only consider workers as valid targets.
**Validates: Requirements 6.1, 6.4**

### Property 7: Queen Inheritance Chain
*For any* AdaptiveQueen instance, the inheritance chain should be: Parasite → Queen → AdaptiveQueen, preserving all base class functionality.
**Validates: Requirements 7.3, 7.5**

### Property 8: Backward Compatibility - Spawn Distribution
*For any* sequence of parasite spawns after refactor, the 75% Energy / 25% Combat distribution should be maintained.
**Validates: Requirements 8.2**

### Property 9: Backward Compatibility - Combat Values
*For any* parasite type, health, damage, and energy reward values should be identical before and after refactor.
**Validates: Requirements 8.3, 8.4**

### Property 10: Performance Maintenance
*For any* scenario with 10+ active parasites of mixed types, the system should maintain 60fps with the refactored class hierarchy.
**Validates: Requirements 3.5, 8.1**

## Error Handling

### Inheritance Errors
- **Abstract Method Not Implemented**: TypeScript compiler enforces implementation of `getColor()` and `getTargetPriority()`
- **Super Call Missing**: Ensure subclass constructors call `super()` with required parameters
- **Type Narrowing**: Use type guards when accessing subclass-specific methods

### Migration Errors
- **Missing Property**: If subclass relied on removed duplicate code, add protected method to base class
- **Behavior Drift**: If subclass had subtle differences in duplicated code, preserve via override
- **Test Failures**: Map failing tests to specific behavior changes and fix accordingly

### Runtime Errors
- **Null Segments**: Validate segment array before animation updates
- **Invalid Patrol Target**: Clamp patrol targets to valid map bounds
- **Target Lost**: Gracefully handle destroyed targets during hunt state

## Testing Strategy

### Unit Testing
- **Base Class Methods**: Test `moveTowards()`, `updateSegmentAnimation()`, `generatePatrolTarget()` in isolation
- **Abstract Method Enforcement**: Verify subclasses implement required methods
- **Property Overrides**: Test that subclass config values override base defaults
- **Color Values**: Verify each subclass returns expected Color3 value

### Property-Based Testing
- **Movement Consistency**: Generate random positions/targets, verify consistent movement across types
- **Patrol Bounds**: Generate random patrol sequences, verify all targets within radius
- **Targeting Priority**: Generate random unit configurations, verify correct target selection
- **Animation Parameters**: Verify wave formula produces valid segment positions

### Integration Testing
- **ParasiteManager Compatibility**: Verify spawning works unchanged after refactor
- **CombatSystem Integration**: Test combat engagement with refactored parasites
- **Queen Spawning**: Verify Queen can still spawn EnergyParasite/CombatParasite
- **AdaptiveQueen Chain**: Test full inheritance chain with AI features

### Regression Testing
- **Run All Existing Tests**: All tests in `__tests__/` folders must pass
- **Behavioral Comparison**: Compare gameplay recordings before/after refactor
- **Performance Benchmarks**: Verify no performance regression with new hierarchy

Each property-based test should run a minimum of 100 iterations to ensure comprehensive coverage, with test tags following the format: **Feature: parasite-base-class-refactor, Property {number}: {property_text}**.
