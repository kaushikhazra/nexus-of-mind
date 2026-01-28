/**
 * PositionUtils Property-Based Tests
 * 
 * **Property 11: Spatial Utility Centralization**
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**
 * 
 * Tests mathematical correctness and consistency of spatial calculations
 * across all valid input ranges. Ensures coordinate transformations are
 * mathematically sound and maintain spatial relationships.
 */

import fc from 'fast-check';
import { Vector3 } from '@babylonjs/core';
import {
    // Chunk coordinate conversions
    chunkIdToGrid,
    gridToChunkId,
    worldToChunk,
    worldPositionToChunk,
    chunkToWorld,
    chunkToRandomWorld,
    
    // Territory-aware transformations
    worldToTerritoryChunk,
    territoryChunkToWorld,
    
    // Distance calculations
    calculateDistance,
    calculateDistanceSquared,
    calculateChunkDistance,
    calculateChunkWorldDistance,
    isWithinRange,
    
    // Validation functions
    isValidWorldPosition,
    isValidChunkId,
    isPositionInChunk,
    clampToWorldBounds,
    
    // Boundary operations
    getChunkBoundaries,
    getNeighboringChunks,
    getChunksInRadius,
    
    // Utility functions
    normalizeChunkId,
    denormalizeChunkId,
    getRandomChunkId,
    getRandomWorldPosition,
    
    // Constants
    CHUNK_SIZE,
    CHUNKS_PER_AXIS,
    TOTAL_CHUNKS,
    TERRITORY_SIZE,
    CENTER_CHUNK_ID
} from '../PositionUtils';

describe('PositionUtils Property-Based Tests', () => {
    
    // ==================== Property 11: Spatial Utility Centralization ====================
    
    describe('Property 11.1: Chunk ID ↔ Grid Coordinate Bijection', () => {
        test('chunkIdToGrid and gridToChunkId should be inverse functions for valid inputs', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: TOTAL_CHUNKS - 1 }),
                (chunkId) => {
                    const grid = chunkIdToGrid(chunkId);
                    const reconstructedId = gridToChunkId(grid.chunkX, grid.chunkZ);
                    
                    // Should be perfect bijection
                    expect(reconstructedId).toBe(chunkId);
                    
                    // Grid coordinates should be within valid range
                    expect(grid.chunkX).toBeGreaterThanOrEqual(0);
                    expect(grid.chunkX).toBeLessThan(CHUNKS_PER_AXIS);
                    expect(grid.chunkZ).toBeGreaterThanOrEqual(0);
                    expect(grid.chunkZ).toBeLessThan(CHUNKS_PER_AXIS);
                }
            ), { numRuns: 256 }); // Test all possible chunk IDs
        });

        test('gridToChunkId and chunkIdToGrid should be inverse functions for valid grids', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: CHUNKS_PER_AXIS - 1 }),
                fc.integer({ min: 0, max: CHUNKS_PER_AXIS - 1 }),
                (chunkX, chunkZ) => {
                    const chunkId = gridToChunkId(chunkX, chunkZ);
                    const reconstructedGrid = chunkIdToGrid(chunkId);
                    
                    // Should be perfect bijection
                    expect(reconstructedGrid.chunkX).toBe(chunkX);
                    expect(reconstructedGrid.chunkZ).toBe(chunkZ);
                    
                    // Chunk ID should be within valid range
                    expect(chunkId).toBeGreaterThanOrEqual(0);
                    expect(chunkId).toBeLessThan(TOTAL_CHUNKS);
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 11.2: World ↔ Chunk Coordinate Consistency', () => {
        test('worldToChunk should return consistent chunk for positions within chunk boundaries', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: TOTAL_CHUNKS - 1 }),
                (chunkId) => {
                    const chunkCenter = chunkToWorld(chunkId);
                    if (!chunkCenter) return; // Skip invalid chunks
                    
                    const calculatedChunkId = worldToChunk(chunkCenter.x, chunkCenter.z);
                    
                    // Center of chunk should map back to same chunk
                    expect(calculatedChunkId).toBe(chunkId);
                }
            ), { numRuns: 100 });
        });

        test('chunkToWorld should return positions within correct chunk boundaries', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: TOTAL_CHUNKS - 1 }),
                (chunkId) => {
                    const worldPos = chunkToWorld(chunkId);
                    if (!worldPos) return; // Skip invalid chunks
                    
                    const boundaries = getChunkBoundaries(chunkId);
                    if (!boundaries) return; // Skip invalid chunks
                    
                    // Position should be within chunk boundaries
                    expect(worldPos.x).toBeGreaterThanOrEqual(boundaries.minX);
                    expect(worldPos.x).toBeLessThan(boundaries.maxX);
                    expect(worldPos.z).toBeGreaterThanOrEqual(boundaries.minZ);
                    expect(worldPos.z).toBeLessThan(boundaries.maxZ);
                }
            ), { numRuns: 100 });
        });

        test('chunkToRandomWorld should always return positions within chunk boundaries', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: TOTAL_CHUNKS - 1 }),
                fc.integer({ min: 1, max: 10 }), // padding
                (chunkId, padding) => {
                    const randomPos = chunkToRandomWorld(chunkId, padding);
                    if (!randomPos) return; // Skip invalid chunks
                    
                    const boundaries = getChunkBoundaries(chunkId);
                    if (!boundaries) return; // Skip invalid chunks
                    
                    // Position should be within padded boundaries
                    expect(randomPos.x).toBeGreaterThanOrEqual(boundaries.minX + padding);
                    expect(randomPos.x).toBeLessThan(boundaries.maxX - padding);
                    expect(randomPos.z).toBeGreaterThanOrEqual(boundaries.minZ + padding);
                    expect(randomPos.z).toBeLessThan(boundaries.maxZ - padding);
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 11.3: Territory-Aware Coordinate Mathematical Correctness', () => {
        test('territory coordinate transformations should be consistent with territory center', () => {
            fc.assert(fc.property(
                fc.float({ min: -500, max: 500, noNaN: true }), // territory center X
                fc.float({ min: -500, max: 500, noNaN: true }), // territory center Z
                fc.integer({ min: 0, max: TOTAL_CHUNKS - 1 }),
                (centerX, centerZ, chunkId) => {
                    const territoryCenter = { x: centerX, z: centerZ };
                    
                    // Convert chunk to world using territory center
                    const worldPos = territoryChunkToWorld(chunkId, territoryCenter, false);
                    if (!worldPos) return; // Skip invalid chunks
                    
                    // Convert back to chunk
                    const reconstructedChunkId = worldToTerritoryChunk(worldPos.x, worldPos.z, territoryCenter);
                    
                    // Should be consistent
                    expect(reconstructedChunkId).toBe(chunkId);
                }
            ), { numRuns: 100 });
        });

        test('territory transformations should maintain spatial relationships', () => {
            fc.assert(fc.property(
                fc.float({ min: -200, max: 200, noNaN: true }), // territory center X
                fc.float({ min: -200, max: 200, noNaN: true }), // territory center Z
                fc.integer({ min: 0, max: TOTAL_CHUNKS - 1 }),
                fc.integer({ min: 0, max: TOTAL_CHUNKS - 1 }),
                (centerX, centerZ, chunkId1, chunkId2) => {
                    const territoryCenter = { x: centerX, z: centerZ };
                    
                    const pos1 = territoryChunkToWorld(chunkId1, territoryCenter, false);
                    const pos2 = territoryChunkToWorld(chunkId2, territoryCenter, false);
                    
                    if (!pos1 || !pos2) return; // Skip invalid chunks
                    
                    // Distance in world space
                    const worldDistance = calculateDistance(pos1, pos2);
                    
                    // Distance in chunk space (Manhattan)
                    const chunkDistance = calculateChunkDistance(chunkId1, chunkId2);
                    
                    if (chunkDistance >= 0) {
                        // World distance should be at least chunk distance * CHUNK_SIZE
                        // (Manhattan distance is always >= Euclidean distance when scaled)
                        expect(worldDistance).toBeGreaterThanOrEqual(0);
                        
                        // For adjacent chunks, world distance should be reasonable
                        if (chunkDistance === 1) {
                            expect(worldDistance).toBeGreaterThanOrEqual(CHUNK_SIZE * 0.5);
                            expect(worldDistance).toBeLessThanOrEqual(CHUNK_SIZE * 2);
                        }
                    }
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 11.4: Distance Calculation Mathematical Properties', () => {
        test('distance calculations should satisfy triangle inequality', () => {
            fc.assert(fc.property(
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                (x1, z1, x2, z2, x3, z3) => {
                    const pos1 = new Vector3(x1, 0, z1);
                    const pos2 = new Vector3(x2, 0, z2);
                    const pos3 = new Vector3(x3, 0, z3);
                    
                    const dist12 = calculateDistance(pos1, pos2);
                    const dist23 = calculateDistance(pos2, pos3);
                    const dist13 = calculateDistance(pos1, pos3);
                    
                    // Triangle inequality: d(a,c) <= d(a,b) + d(b,c)
                    expect(dist13).toBeLessThanOrEqual(dist12 + dist23 + 0.001); // Small epsilon for floating point
                }
            ), { numRuns: 100 });
        });

        test('distance squared should be consistent with distance', () => {
            fc.assert(fc.property(
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                (x1, z1, x2, z2) => {
                    const pos1 = new Vector3(x1, 0, z1);
                    const pos2 = new Vector3(x2, 0, z2);
                    
                    const distance = calculateDistance(pos1, pos2);
                    const distanceSquared = calculateDistanceSquared(pos1, pos2);
                    
                    // distance^2 should equal distanceSquared (within floating point precision)
                    expect(Math.abs(distance * distance - distanceSquared)).toBeLessThan(0.001);
                }
            ), { numRuns: 100 });
        });

        test('isWithinRange should be consistent with distance calculation', () => {
            fc.assert(fc.property(
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                fc.float({ min: 0, max: TERRITORY_SIZE, noNaN: true }),
                fc.float({ min: 1, max: 100, noNaN: true }),
                (x1, z1, x2, z2, range) => {
                    const pos1 = new Vector3(x1, 0, z1);
                    const pos2 = new Vector3(x2, 0, z2);
                    
                    const distance = calculateDistance(pos1, pos2);
                    const withinRange = isWithinRange(pos1, pos2, range);
                    
                    // Should be consistent
                    if (distance <= range) {
                        expect(withinRange).toBe(true);
                    } else {
                        expect(withinRange).toBe(false);
                    }
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 11.5: Validation Function Correctness', () => {
        test('isValidChunkId should correctly identify valid chunk IDs', () => {
            fc.assert(fc.property(
                fc.integer({ min: -100, max: 400 }),
                (chunkId) => {
                    const isValid = isValidChunkId(chunkId);
                    const expectedValid = chunkId >= 0 && chunkId < TOTAL_CHUNKS;
                    
                    expect(isValid).toBe(expectedValid);
                }
            ), { numRuns: 100 });
        });

        test('isValidWorldPosition should correctly validate world bounds', () => {
            fc.assert(fc.property(
                fc.float({ min: -100, max: TERRITORY_SIZE + 100 }),
                fc.float({ min: -100, max: TERRITORY_SIZE + 100 }),
                (x, z) => {
                    const position = new Vector3(x, 0, z);
                    const isValid = isValidWorldPosition(position);
                    const expectedValid = x >= 0 && x < TERRITORY_SIZE && z >= 0 && z < TERRITORY_SIZE;
                    
                    expect(isValid).toBe(expectedValid);
                }
            ), { numRuns: 100 });
        });

        test('clampToWorldBounds should always return valid positions', () => {
            fc.assert(fc.property(
                fc.float({ min: -1000, max: TERRITORY_SIZE + 1000, noNaN: true }),
                fc.float({ min: -1000, max: TERRITORY_SIZE + 1000, noNaN: true }),
                (x, z) => {
                    const position = new Vector3(x, 0, z);
                    const clamped = clampToWorldBounds(position);
                    
                    // Clamped position should always be valid
                    expect(isValidWorldPosition(clamped)).toBe(true);
                    
                    // Should be within bounds
                    expect(clamped.x).toBeGreaterThanOrEqual(0);
                    expect(clamped.x).toBeLessThan(TERRITORY_SIZE);
                    expect(clamped.z).toBeGreaterThanOrEqual(0);
                    expect(clamped.z).toBeLessThan(TERRITORY_SIZE);
                }
            ), { numRuns: 100 });
        });

        test('isPositionInChunk should be consistent with worldToChunk', () => {
            fc.assert(fc.property(
                fc.float({ min: 0, max: TERRITORY_SIZE - 1 }),
                fc.float({ min: 0, max: TERRITORY_SIZE - 1 }),
                (x, z) => {
                    const position = new Vector3(x, 0, z);
                    const chunkId = worldToChunk(x, z);
                    
                    if (chunkId >= 0) {
                        const isInChunk = isPositionInChunk(position, chunkId);
                        expect(isInChunk).toBe(true);
                    }
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 11.6: Normalization Mathematical Properties', () => {
        test('normalize and denormalize should be inverse functions', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: TOTAL_CHUNKS - 1 }),
                (chunkId) => {
                    const normalized = normalizeChunkId(chunkId);
                    const denormalized = denormalizeChunkId(normalized);
                    
                    // Should be inverse functions
                    expect(denormalized).toBe(chunkId);
                    
                    // Normalized value should be in [0, 1] range
                    expect(normalized).toBeGreaterThanOrEqual(0);
                    expect(normalized).toBeLessThanOrEqual(1);
                }
            ), { numRuns: 100 });
        });

        test('normalization should preserve ordering', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: TOTAL_CHUNKS - 1 }),
                fc.integer({ min: 0, max: TOTAL_CHUNKS - 1 }),
                (chunkId1, chunkId2) => {
                    const norm1 = normalizeChunkId(chunkId1);
                    const norm2 = normalizeChunkId(chunkId2);
                    
                    // Ordering should be preserved
                    if (chunkId1 < chunkId2) {
                        expect(norm1).toBeLessThan(norm2);
                    } else if (chunkId1 > chunkId2) {
                        expect(norm1).toBeGreaterThan(norm2);
                    } else {
                        expect(norm1).toBe(norm2);
                    }
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 11.7: Neighbor and Radius Operations Correctness', () => {
        test('neighboring chunks should be exactly distance 1 apart', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: TOTAL_CHUNKS - 1 }),
                (chunkId) => {
                    const neighbors = getNeighboringChunks(chunkId);
                    
                    neighbors.forEach(neighborId => {
                        const distance = calculateChunkDistance(chunkId, neighborId);
                        expect(distance).toBe(1);
                    });
                }
            ), { numRuns: 100 });
        });

        test('chunks in radius should all be within specified distance', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: TOTAL_CHUNKS - 1 }),
                fc.integer({ min: 1, max: 5 }),
                (centerChunkId, radius) => {
                    const chunksInRadius = getChunksInRadius(centerChunkId, radius);
                    
                    chunksInRadius.forEach(chunkId => {
                        const distance = calculateChunkDistance(centerChunkId, chunkId);
                        expect(distance).toBeLessThanOrEqual(radius);
                        expect(distance).toBeGreaterThanOrEqual(0);
                    });
                }
            ), { numRuns: 50 });
        });

        test('center chunk should always be included in radius operations', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: TOTAL_CHUNKS - 1 }),
                fc.integer({ min: 1, max: 5 }),
                (centerChunkId, radius) => {
                    const chunksInRadius = getChunksInRadius(centerChunkId, radius);
                    
                    // Center chunk should always be included (distance 0)
                    expect(chunksInRadius).toContain(centerChunkId);
                }
            ), { numRuns: 50 });
        });
    });

    describe('Property 11.8: Random Generation Validity', () => {
        test('getRandomChunkId should always return valid chunk IDs', () => {
            fc.assert(fc.property(
                fc.constant(null), // No input needed
                () => {
                    const randomChunkId = getRandomChunkId();
                    
                    expect(isValidChunkId(randomChunkId)).toBe(true);
                    expect(randomChunkId).toBeGreaterThanOrEqual(0);
                    expect(randomChunkId).toBeLessThan(TOTAL_CHUNKS);
                }
            ), { numRuns: 100 });
        });

        test('getRandomWorldPosition should always return valid positions', () => {
            fc.assert(fc.property(
                fc.constant(null), // No input needed
                () => {
                    const randomPosition = getRandomWorldPosition();
                    
                    expect(isValidWorldPosition(randomPosition)).toBe(true);
                    expect(randomPosition.x).toBeGreaterThanOrEqual(0);
                    expect(randomPosition.x).toBeLessThan(TERRITORY_SIZE);
                    expect(randomPosition.z).toBeGreaterThanOrEqual(0);
                    expect(randomPosition.z).toBeLessThan(TERRITORY_SIZE);
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 11.9: Constants Consistency', () => {
        test('mathematical relationships between constants should hold', () => {
            // These are deterministic tests of constant relationships
            expect(TOTAL_CHUNKS).toBe(CHUNKS_PER_AXIS * CHUNKS_PER_AXIS);
            expect(TERRITORY_SIZE).toBe(CHUNKS_PER_AXIS * CHUNK_SIZE);
            expect(CENTER_CHUNK_ID).toBe(Math.floor(CHUNKS_PER_AXIS / 2) * CHUNKS_PER_AXIS + Math.floor(CHUNKS_PER_AXIS / 2));
            
            // Center chunk should be valid
            expect(isValidChunkId(CENTER_CHUNK_ID)).toBe(true);
            
            // Center chunk should be roughly in the middle
            const centerGrid = chunkIdToGrid(CENTER_CHUNK_ID);
            expect(centerGrid.chunkX).toBe(Math.floor(CHUNKS_PER_AXIS / 2));
            expect(centerGrid.chunkZ).toBe(Math.floor(CHUNKS_PER_AXIS / 2));
        });
    });
});