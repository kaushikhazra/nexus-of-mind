# Implementation Plan: Spatial Unit Indexing

## Overview

This implementation plan adds a chunk-based spatial partitioning system to efficiently query entities by location. The system enables O(k) range queries instead of O(n) full scans, integrated with UnitManager, ParasiteManager, and CombatSystem.

## Tasks

- [x] 1. Create SpatialIndex core implementation
  - [x] 1.1 Create new file `client/src/game/SpatialIndex.ts`
    - Define CHUNK_SIZE constant (64 units)
    - Define EntityType union type
    - Create SpatialIndex class with Map-based data structures
    - _Requirements: 1.1, 2.1_

  - [x] 1.2 Implement add() operation
    - Calculate chunk coordinates from position
    - Add entity to chunk set
    - Store position, type, and chunk assignment in maps
    - Handle re-add by removing existing entry first
    - _Requirements: 1.2, 2.1, 9.1_

  - [x] 1.3 Implement remove() operation
    - Look up current chunk from entityChunks map
    - Remove entity from chunk set
    - Clean up empty chunks
    - Remove from all tracking maps
    - _Requirements: 1.4, 1.5, 9.2_

  - [x] 1.4 Implement updatePosition() operation
    - Calculate new chunk coordinates
    - If same chunk: update position map only (O(1))
    - If different chunk: remove from old, add to new
    - Clean up empty chunks
    - _Requirements: 1.3, 2.2, 2.3, 2.4, 9.3_

  - [x] 1.5 Implement getEntitiesInRange() query
    - Calculate bounding chunk range from center and radius
    - Iterate only over relevant chunks
    - Apply type filter if specified
    - Use squared distance comparison
    - Return entity IDs only
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 9.4_

  - [x] 1.6 Implement getEntitiesInChunk() query
    - Direct chunk lookup by coordinates
    - Apply type filter if specified
    - Return entity IDs in chunk
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 1.7 Implement getStats() utility
    - Return entity count, chunk count, average entities per chunk
    - Used for debugging and monitoring
    - _Requirements: N/A (utility)_

- [x] 2. Integrate with GameEngine
  - [x] 2.1 Add SpatialIndex instance to GameEngine
    - Create SpatialIndex in constructor
    - Add getter method for access
    - _Requirements: N/A (infrastructure)_

  - [x] 2.2 Add detection throttling
    - Add lastDetectionCheckTime tracking
    - Add DETECTION_CHECK_INTERVAL constant (200ms)
    - Skip detection checks if within interval
    - _Requirements: 7.5_

  - [x] 2.3 Pass SpatialIndex to managers
    - Pass to UnitManager via setter
    - Pass to ParasiteManager via setter
    - Pass to CombatSystem via setter
    - _Requirements: 5.1, 6.1, 7.1_

- [x] 3. Checkpoint - Core implementation complete
  - SpatialIndex class fully implemented
  - All operations O(1) except range query
  - GameEngine owns and distributes instance
  - Detection throttling in place

- [x] 4. Integrate with UnitManager
  - [x] 4.1 Add SpatialIndex reference and setter
    - Add private spatialIndex field
    - Add setSpatialIndex() method
    - _Requirements: 5.1_

  - [x] 4.2 Add units on creation
    - Call spatialIndex.add() when creating workers, scouts, protectors
    - Map UnitType to EntityType
    - _Requirements: 5.1, 5.4_

  - [x] 4.3 Update positions on unit move
    - Call spatialIndex.updatePosition() in update loop
    - Only update if unit has moved
    - _Requirements: 5.2_

  - [x] 4.4 Remove units on destruction
    - Call spatialIndex.remove() when unit destroyed
    - _Requirements: 5.3_

- [x] 5. Integrate with ParasiteManager
  - [x] 5.1 Add SpatialIndex reference and setter
    - Add private spatialIndex field
    - Add setSpatialIndex() method
    - _Requirements: 6.1_

  - [x] 5.2 Add parasites on spawn
    - Call spatialIndex.add() for energy parasites with type 'parasite'
    - Call spatialIndex.add() for combat parasites with type 'combat_parasite'
    - _Requirements: 6.1, 6.4_

  - [x] 5.3 Update positions on parasite move
    - Call spatialIndex.updatePosition() in update loop
    - _Requirements: 6.2_

  - [x] 5.4 Remove parasites on death
    - Call spatialIndex.remove() when parasite killed
    - Call spatialIndex.remove() on cleanup
    - _Requirements: 6.3_

  - [x] 5.5 Re-add parasites on respawn
    - Call spatialIndex.add() when respawning dead parasites
    - _Requirements: 6.5_

  - [x] 5.6 Implement camera-based culling
    - Get camera target position
    - Query parasites within 192-unit radius
    - Only update parasites in query result
    - Skip distant parasites entirely
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 6. Integrate with CombatSystem
  - [x] 6.1 Add SpatialIndex reference and setter
    - Add private spatialIndex field
    - Add setSpatialIndex() method
    - _Requirements: 7.1_

  - [x] 6.2 Use spatial query for enemy detection
    - Query for nearby enemies using getEntitiesInRange()
    - Filter by ['parasite', 'combat_parasite', 'queen', 'hive']
    - Use 10-unit detection range
    - _Requirements: 7.1, 7.3, 7.4_

  - [x] 6.3 Implement fallback mechanism
    - Check if spatialIndex is available
    - Fall back to O(n) scanning if null
    - Log warning on fallback
    - _Requirements: 7.2, 10.1, 10.2, 10.3, 10.4_

- [x] 7. Checkpoint - Full integration complete
  - All managers integrated with SpatialIndex
  - Camera culling working for parasites
  - Combat detection using spatial queries
  - Fallback mechanisms in place

- [x] 8. Performance optimization pass
  - [x] 8.1 Remove redundant Array.from() conversions
    - Eliminate wasteful copies in update loops
    - Use iterators directly where possible
    - _Requirements: 9.5_

  - [x] 8.2 Apply throttling to all detection checks
    - Ensure 200ms interval applied consistently
    - Verify no per-frame detection scans
    - _Requirements: 7.5, 9.5_

  - [x] 8.3 Verify chunk boundary updates are lazy
    - Confirm position updates within chunk don't modify sets
    - Profile to verify O(1) average case
    - _Requirements: 2.3, 9.3_

- [x] 9. Final checkpoint - Implementation complete
  - All requirements satisfied
  - Performance targets met (60fps with 100+ entities)
  - Fallback mechanisms tested
  - No TypeScript compilation errors

## Notes

- Chunk size (64 units) matches terrain chunk size for cache coherency
- Camera culling radius (192 units) = 3 chunks, covers typical visible area
- Detection throttling (200ms) reduces CPU overhead by ~92% vs per-frame
- Entity IDs returned instead of objects to avoid memory allocation
- Empty chunks cleaned up automatically to prevent memory leaks

## Key Commits

- `958a767` - feat: Add spatial indexing and fix parasite spawning near player
- `492c837` - fix: Resolve TypeScript errors and merge spatial indexing fixes
- `e431290` - perf: Optimize spatial index usage and throttle UI updates
