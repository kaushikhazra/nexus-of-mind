# Spatial Unit Indexing - Design Document

## Overview

The Spatial Unit Indexing system implements a chunk-based spatial partitioning data structure that enables O(k) entity lookup instead of O(n) full scans. The system is integrated with UnitManager, ParasiteManager, and CombatSystem to provide efficient range queries for AI targeting, combat detection, and spawn rate calculations.

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                           GameEngine                                 │
│                    (owns SpatialIndex instance)                      │
└──────────────┬────────────────────────────────────────────┬─────────┘
               │                                            │
    passes reference                             passes reference
               │                                            │
               ▼                                            ▼
┌──────────────────────────┐                ┌──────────────────────────┐
│      UnitManager         │                │    ParasiteManager       │
│  - add on unit create    │                │  - add on parasite spawn │
│  - update on unit move   │                │  - update on move        │
│  - remove on unit death  │                │  - remove on death       │
└──────────────────────────┘                └──────────────────────────┘
               │                                            │
               └────────────────┬───────────────────────────┘
                               │
                    queries for nearby entities
                               │
                               ▼
                    ┌──────────────────────────┐
                    │      CombatSystem        │
                    │  - enemy detection       │
                    │  - protector targeting   │
                    └──────────────────────────┘
```

### Chunk-Based Grid Structure

```
World Coordinates:                    Chunk Grid:
┌───────────────────────────────┐    ┌─────┬─────┬─────┬─────┐
│                               │    │-1,-1│ 0,-1│ 1,-1│ 2,-1│
│    Entity at (70, 0, 130)     │    ├─────┼─────┼─────┼─────┤
│         ↓                     │    │-1,0 │ 0,0 │ 1,0 │ 2,0 │
│    Chunk (1, 2)               │    ├─────┼─────┼─────┼─────┤
│    floor(70/64) = 1           │    │-1,1 │ 0,1 │ 1,1 │ 2,1 │
│    floor(130/64) = 2          │    ├─────┼─────┼─────┼─────┤
│                               │    │-1,2 │ 0,2 │ 1,2*│ 2,2 │ ← Entity here
└───────────────────────────────┘    └─────┴─────┴─────┴─────┘
                                           64 units per chunk
```

## Components and Interfaces

### SpatialIndex Class

```typescript
const CHUNK_SIZE = 64; // Aligned with terrain chunk size

type EntityType = 'worker' | 'scout' | 'protector' | 'parasite' |
                  'combat_parasite' | 'queen' | 'hive' | 'building';

export class SpatialIndex {
    // Primary data structures
    private chunks: Map<string, Set<string>>;        // chunkKey → entityIds
    private entityPositions: Map<string, Vector3>;   // entityId → position
    private entityTypes: Map<string, EntityType>;    // entityId → type
    private entityChunks: Map<string, string>;       // entityId → chunkKey

    constructor();

    // Core operations
    add(entityId: string, position: Vector3, entityType: EntityType): void;
    remove(entityId: string): void;
    updatePosition(entityId: string, newPosition: Vector3): void;

    // Query operations
    getEntitiesInRange(
        center: Vector3,
        radius: number,
        typeFilter?: EntityType | EntityType[]
    ): string[];

    getEntitiesInChunk(
        chunkX: number,
        chunkZ: number,
        typeFilter?: EntityType
    ): string[];

    // Utility
    getStats(): { entityCount: number; chunkCount: number; avgEntitiesPerChunk: number };

    // Internal helpers
    private getChunkKey(x: number, z: number): string;
    private getChunkCoords(position: Vector3): { chunkX: number; chunkZ: number };
}
```

### Integration Points

#### GameEngine Integration
```typescript
// GameEngine.ts
export class GameEngine {
    private spatialIndex: SpatialIndex;

    constructor() {
        this.spatialIndex = new SpatialIndex();
    }

    public getSpatialIndex(): SpatialIndex {
        return this.spatialIndex;
    }

    // Throttled detection (200ms interval)
    private lastDetectionCheckTime: number = 0;
    private readonly DETECTION_CHECK_INTERVAL: number = 200;

    private handleMovementCombatTransitions(): void {
        const now = performance.now();
        if (now - this.lastDetectionCheckTime < this.DETECTION_CHECK_INTERVAL) {
            return;
        }
        this.lastDetectionCheckTime = now;
        // ... detection logic using spatial index
    }
}
```

#### UnitManager Integration
```typescript
// UnitManager.ts - Key integration points
class UnitManager {
    private spatialIndex: SpatialIndex | null = null;

    public setSpatialIndex(index: SpatialIndex): void {
        this.spatialIndex = index;
    }

    // On unit creation (line ~164)
    private createUnit(type: UnitType, position: Vector3): Unit {
        const unit = new Unit(...);
        this.spatialIndex?.add(unit.getId(), position, this.mapUnitType(type));
        return unit;
    }

    // On unit update (line ~462)
    public update(deltaTime: number): void {
        for (const unit of this.units) {
            unit.update(deltaTime);
            this.spatialIndex?.updatePosition(unit.getId(), unit.getPosition());
        }
    }

    // On unit destruction (line ~201)
    public destroyUnit(unitId: string): void {
        this.spatialIndex?.remove(unitId);
        // ... cleanup logic
    }
}
```

#### ParasiteManager Integration
```typescript
// ParasiteManager.ts - Key integration points
class ParasiteManager {
    private spatialIndex: SpatialIndex | null = null;

    // Camera-based culling (lines 260-288)
    public update(deltaTime: number): void {
        if (this.spatialIndex) {
            // Only update parasites near camera
            const parasiteIds = this.spatialIndex.getEntitiesInRange(
                this.cameraTarget,
                192,  // 3 chunks radius
                ['parasite', 'combat_parasite']
            );

            for (const id of parasiteIds) {
                const parasite = this.getParasiteById(id);
                if (parasite) {
                    parasite.update(deltaTime);
                    this.spatialIndex.updatePosition(id, parasite.getPosition());
                }
            }
        }
    }
}
```

#### CombatSystem Integration
```typescript
// CombatSystem.ts - Key integration points
class CombatSystem {
    // Enemy detection (lines 389-423)
    private checkMovementDetection(protector: Protector): void {
        if (this.spatialIndex) {
            const nearbyEntityIds = this.spatialIndex.getEntitiesInRange(
                protector.getPosition(),
                10,  // detection range
                ['parasite', 'combat_parasite', 'queen', 'hive']
            );

            for (const id of nearbyEntityIds) {
                const target = this.resolveEntityById(id);
                if (target && this.isValidTarget(target)) {
                    this.engageTarget(protector, target);
                    break;
                }
            }
        } else {
            // Fallback to O(n) legacy scan
            const allTargets = this.getAllPotentialTargets();
            // ... legacy detection logic
        }
    }
}
```

## Data Models

### Chunk Key Format
```typescript
// Chunk key: "chunkX,chunkZ"
// Example: Position (150, 0, 200) → Chunk (2, 3) → Key "2,3"

private getChunkKey(x: number, z: number): string {
    return `${x},${z}`;
}

private getChunkCoords(position: Vector3): { chunkX: number; chunkZ: number } {
    return {
        chunkX: Math.floor(position.x / CHUNK_SIZE),
        chunkZ: Math.floor(position.z / CHUNK_SIZE)
    };
}
```

### Range Query Algorithm

```typescript
getEntitiesInRange(center: Vector3, radius: number, typeFilter?: EntityType | EntityType[]): string[] {
    const results: string[] = [];
    const radiusSquared = radius * radius;

    // Step 1: Calculate bounding chunk range
    const minChunkX = Math.floor((center.x - radius) / CHUNK_SIZE);
    const maxChunkX = Math.floor((center.x + radius) / CHUNK_SIZE);
    const minChunkZ = Math.floor((center.z - radius) / CHUNK_SIZE);
    const maxChunkZ = Math.floor((center.z + radius) / CHUNK_SIZE);

    // Step 2: Iterate only over relevant chunks
    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
        for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ++) {
            const chunkKey = this.getChunkKey(chunkX, chunkZ);
            const entityIds = this.chunks.get(chunkKey);

            if (!entityIds) continue;

            // Step 3: Filter entities in chunk
            for (const entityId of entityIds) {
                // Type filter check (O(1))
                if (typeFilter && !this.matchesTypeFilter(entityId, typeFilter)) {
                    continue;
                }

                // Distance check (squared, no sqrt)
                const pos = this.entityPositions.get(entityId)!;
                const dx = pos.x - center.x;
                const dz = pos.z - center.z;

                if (dx * dx + dz * dz <= radiusSquared) {
                    results.push(entityId);
                }
            }
        }
    }

    return results;
}
```

## Correctness Properties

### Property 1: Chunk Assignment Consistency
*For any* entity added to the spatial index, the entity's chunk assignment must match its actual position when converted using the chunk coordinate formula.
**Validates: Requirements 1.2, 2.1**

### Property 2: Boundary Crossing Detection
*For any* entity whose position update crosses a chunk boundary, the spatial index must atomically update the chunk membership.
**Validates: Requirements 1.3, 2.4**

### Property 3: Range Query Completeness
*For any* range query, all entities within the specified radius must be returned (no false negatives).
**Validates: Requirements 3.1, 3.5**

### Property 4: Range Query Correctness
*For any* range query result, all returned entities must be within the specified radius (no false positives).
**Validates: Requirements 3.1, 3.3**

### Property 5: Type Filter Accuracy
*For any* type-filtered query, all returned entities must match the specified type filter(s).
**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 6: O(1) Core Operations
*For any* add, remove, or position update operation, the time complexity must be O(1) (constant time).
**Validates: Requirements 9.1, 9.2, 9.3**

### Property 7: Fallback Equivalence
*For any* query, the fallback O(n) implementation must return identical results to the spatial index.
**Validates: Requirements 10.3**

### Property 8: Empty Chunk Cleanup
*For any* chunk that becomes empty after entity removal, the chunk must be removed from the chunks map.
**Validates: Requirements 1.5**

## Error Handling

### Null Safety
- All consuming systems check `if (spatialIndex)` before operations
- Fallback to O(n) scanning when spatial index unavailable
- No crashes on null reference

### Invalid Entity Handling
- `updatePosition()` ignores unknown entity IDs (logs warning)
- `remove()` ignores unknown entity IDs (no-op)
- Re-adding existing entity removes old entry first

### Boundary Conditions
- Negative coordinates handled correctly (Math.floor works for negatives)
- Zero-radius queries return entities at exact center point
- Empty result sets returned as empty arrays (not null)

## Performance Considerations

### Space Complexity
- O(n) overall where n = total entities
- 4 maps: chunks, positions, types, entity-to-chunk
- Empty chunks automatically cleaned up

### Time Complexity Summary

| Operation | Best | Average | Worst | Notes |
|-----------|------|---------|-------|-------|
| add() | O(1) | O(1) | O(1) | Direct map/set insertion |
| remove() | O(1) | O(1) | O(1) | Direct map/set deletion |
| updatePosition() | O(1) | O(1) | O(1) | Only chunk update if boundary crossed |
| getEntitiesInRange() | O(1) | O(k) | O(n) | k = entities in radius, n = all entities |
| getEntitiesInChunk() | O(1) | O(m) | O(m) | m = entities in that chunk |

### Optimization Techniques

1. **Squared Distance**: Avoids sqrt() in range queries
2. **Lazy Chunk Updates**: Only updates chunk assignment when crossing boundaries
3. **Type-First Filtering**: Type check before distance calculation
4. **ID-Only Returns**: Returns entity IDs, not full objects (caller resolves)
5. **200ms Throttling**: Combat detection runs 5x/second, not every frame
6. **Camera Culling**: 192-unit radius culls distant parasites from updates

## Testing Strategy

### Unit Tests
- Add/remove/update operations on SpatialIndex
- Range queries with various radii
- Type filtering accuracy
- Chunk boundary crossing behavior
- Empty chunk cleanup

### Integration Tests
- UnitManager → SpatialIndex lifecycle
- ParasiteManager → SpatialIndex lifecycle
- CombatSystem query patterns
- Camera-based culling behavior

### Performance Tests
- Benchmark with 100, 500, 1000 entities
- Measure frame rate impact
- Compare O(k) vs O(n) query times
- Profile memory usage

## File Locations

| File | Purpose |
|------|---------|
| `client/src/game/SpatialIndex.ts` | Core implementation |
| `client/src/game/GameEngine.ts` | Initialization, ownership, throttling |
| `client/src/game/ParasiteManager.ts` | Parasite tracking, camera culling |
| `client/src/game/CombatSystem.ts` | Enemy detection queries |
| `client/src/game/UnitManager.ts` | Unit position tracking |
