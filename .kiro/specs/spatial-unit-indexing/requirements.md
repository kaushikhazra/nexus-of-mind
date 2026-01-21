# Spatial Unit Indexing - Requirements Document

## Introduction

This specification implements a chunk-based spatial partitioning system for efficient entity lookup and range queries in the RTS game. The system reduces entity proximity checks from O(n) to O(k) where k = entities in the search radius, dramatically improving performance as entity counts scale.

## Glossary

- **Spatial Index**: A data structure that organizes entities by their spatial position for efficient range queries
- **Chunk**: A fixed-size grid cell (64x64 units) that groups entities by location
- **Range Query**: Finding all entities within a specified radius of a center point
- **Entity Type**: Classification of game entities (worker, scout, protector, parasite, combat_parasite, queen, hive, building)
- **Camera Culling**: Optimization that only processes entities near the camera view

## Requirements

### Requirement 1: Chunk-Based Spatial Partitioning

**User Story:** As a developer, I want entities organized into spatial chunks, so that range queries only examine relevant portions of the game world instead of all entities.

#### Acceptance Criteria

1. WHEN the spatial index is created, THE System SHALL use a chunk size of 64 units (aligned with terrain chunks)
2. WHEN an entity is added, THE System SHALL assign it to the correct chunk based on its world position
3. WHEN an entity moves, THE System SHALL update its chunk assignment only if it crosses a chunk boundary
4. WHEN an entity is removed, THE System SHALL remove it from its assigned chunk
5. WHEN a chunk becomes empty, THE System SHALL clean up the empty chunk from memory

### Requirement 2: Entity Position Tracking

**User Story:** As a developer, I want the spatial index to track entity positions, so that range queries can calculate accurate distances.

#### Acceptance Criteria

1. WHEN an entity is added, THE System SHALL store its position, type, and chunk assignment
2. WHEN an entity position is updated, THE System SHALL update the stored position in O(1) time
3. WHEN position update occurs within the same chunk, THE System SHALL NOT modify chunk membership
4. WHEN position update crosses chunk boundary, THE System SHALL update chunk membership atomically
5. THE System SHALL support Vector3 positions for full 3D coordinate tracking

### Requirement 3: Range Query Operations

**User Story:** As a developer, I want to query entities within a radius, so that game systems can efficiently find nearby entities.

#### Acceptance Criteria

1. WHEN a range query is performed, THE System SHALL only examine chunks that intersect the query radius
2. WHEN a range query specifies type filters, THE System SHALL return only matching entity types
3. WHEN a range query is performed, THE System SHALL use squared distance comparison (avoiding sqrt)
4. WHEN multiple type filters are specified, THE System SHALL return entities matching any of the types
5. THE Range query SHALL return entity IDs only, not full entity objects

### Requirement 4: Type-Filtered Queries

**User Story:** As a developer, I want to filter queries by entity type, so that game systems can find specific entity categories efficiently.

#### Acceptance Criteria

1. WHEN filtering by 'worker', THE System SHALL return only worker unit entities
2. WHEN filtering by 'parasite' or 'combat_parasite', THE System SHALL return only those parasite types
3. WHEN filtering by multiple types, THE System SHALL return the union of matching entities
4. WHEN no type filter is specified, THE System SHALL return all entities in range
5. THE Type filter SHALL use O(1) lookup per entity

### Requirement 5: Integration with UnitManager

**User Story:** As a developer, I want units automatically tracked in the spatial index, so that combat and AI systems can find nearby units.

#### Acceptance Criteria

1. WHEN a unit is created, THE UnitManager SHALL add it to the spatial index
2. WHEN a unit moves, THE UnitManager SHALL update its position in the spatial index
3. WHEN a unit is destroyed, THE UnitManager SHALL remove it from the spatial index
4. THE System SHALL track worker, scout, and protector unit types
5. THE System SHALL maintain unit tracking without impacting frame rate

### Requirement 6: Integration with ParasiteManager

**User Story:** As a developer, I want parasites tracked in the spatial index, so that unit targeting and combat systems can efficiently detect nearby threats.

#### Acceptance Criteria

1. WHEN a parasite spawns, THE ParasiteManager SHALL add it to the spatial index
2. WHEN a parasite moves, THE ParasiteManager SHALL update its position in the spatial index
3. WHEN a parasite dies, THE ParasiteManager SHALL remove it from the spatial index
4. THE System SHALL track both 'parasite' (energy) and 'combat_parasite' types
5. WHEN parasites respawn, THE System SHALL re-add them to the spatial index

### Requirement 7: Integration with CombatSystem

**User Story:** As a developer, I want the combat system to use spatial queries for enemy detection, so that protectors efficiently find nearby targets.

#### Acceptance Criteria

1. WHEN a protector checks for enemies, THE CombatSystem SHALL use spatial index range query
2. WHEN spatial index is unavailable, THE CombatSystem SHALL fall back to O(n) legacy scanning
3. THE CombatSystem SHALL query for parasite, combat_parasite, queen, and hive entity types
4. THE Detection range SHALL be 10 units for protector auto-attack
5. THE Enemy detection SHALL run at most every 200ms (throttled)

### Requirement 8: Camera-Based Update Culling

**User Story:** As a player, I want smooth performance even with many parasites, so that gameplay remains responsive.

#### Acceptance Criteria

1. WHEN updating parasites, THE ParasiteManager SHALL only update those within 192 units of the camera
2. WHEN a parasite is outside camera range, THE System SHALL skip its AI and behavior updates
3. WHEN camera moves, THE System SHALL re-evaluate which parasites to update
4. THE Culling radius of 192 units SHALL cover approximately 3x3 chunk area
5. THE System SHALL maintain full position tracking for culled parasites (for combat system queries)

### Requirement 9: Performance Requirements

**User Story:** As a player, I want the game to maintain 60fps with hundreds of entities, so that gameplay remains smooth and enjoyable.

#### Acceptance Criteria

1. THE add() operation SHALL complete in O(1) time
2. THE remove() operation SHALL complete in O(1) time
3. THE updatePosition() operation SHALL complete in O(1) average time
4. THE getEntitiesInRange() operation SHALL complete in O(k) time where k = entities in radius
5. THE System SHALL maintain 60fps with 100+ active entities

### Requirement 10: Graceful Degradation

**User Story:** As a developer, I want systems to work even if spatial index fails, so that the game remains playable.

#### Acceptance Criteria

1. WHEN spatial index is null, THE consuming systems SHALL fall back to O(n) scanning
2. WHEN fallback occurs, THE System SHALL log a warning for debugging
3. THE Fallback behavior SHALL produce identical results to spatial index queries
4. THE System SHALL not crash if spatial index operations fail
5. THE Fallback mode SHALL be transparent to gameplay
