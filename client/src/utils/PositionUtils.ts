/**
 * PositionUtils - Centralized spatial calculation utilities
 * 
 * This module provides optimized, reusable functions for all position-related
 * calculations throughout the game. It eliminates code duplication and ensures
 * consistent spatial operations across all systems.
 * 
 * Key Features:
 * - Chunk-to-world and world-to-chunk conversions
 * - Optimized distance calculations with zero-allocation patterns
 * - Coordinate system transformations
 * - Spatial validation and bounds checking
 */

import { Vector3 } from '@babylonjs/core';

// ==================== Constants ====================

/** World units per chunk */
export const CHUNK_SIZE = 64;

/** Number of chunks per axis (16x16 grid) */
export const CHUNKS_PER_AXIS = 16;

/** Total number of chunks in the world */
export const TOTAL_CHUNKS = 256;

/** Total territory size in world units */
export const TERRITORY_SIZE = 1024;

/** Center chunk ID (grid position 8,8 = world origin 0,0) */
export const CENTER_CHUNK_ID = 136;

// ==================== Cached Vectors for Zero-Allocation Operations ====================

/**
 * Pre-allocated vectors for zero-allocation distance calculations.
 * These vectors are reused to avoid garbage collection pressure during
 * frequent spatial operations (60fps gameplay requirement).
 */
const _tempVector1 = new Vector3();
const _tempVector2 = new Vector3();
const _tempVector3 = new Vector3();

// ==================== Chunk Coordinate Conversions ====================

/**
 * Convert chunk ID to chunk grid coordinates
 * @param chunkId Chunk ID (0-255)
 * @returns Grid coordinates {chunkX, chunkZ} (0-15 each) or {-1, -1} if invalid
 */
export function chunkIdToGrid(chunkId: number): { chunkX: number; chunkZ: number } {
    if (chunkId < 0 || chunkId >= TOTAL_CHUNKS) {
        return { chunkX: -1, chunkZ: -1 };
    }

    const chunkX = chunkId % CHUNKS_PER_AXIS;
    const chunkZ = Math.floor(chunkId / CHUNKS_PER_AXIS);

    return { chunkX, chunkZ };
}

/**
 * Convert chunk grid coordinates to chunk ID
 * @param chunkX X grid coordinate (0-15)
 * @param chunkZ Z grid coordinate (0-15)
 * @returns Chunk ID (0-255) or -1 if invalid coordinates
 */
export function gridToChunkId(chunkX: number, chunkZ: number): number {
    if (chunkX < 0 || chunkX >= CHUNKS_PER_AXIS ||
        chunkZ < 0 || chunkZ >= CHUNKS_PER_AXIS) {
        return -1;
    }

    return chunkZ * CHUNKS_PER_AXIS + chunkX;
}

/**
 * Convert world position to chunk ID
 * @param x World X position
 * @param z World Z position
 * @returns Chunk ID (0-255) or -1 if out of bounds
 */
export function worldToChunk(x: number, z: number): number {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);

    return gridToChunkId(chunkX, chunkZ);
}

/**
 * Convert world position to chunk ID using Vector3
 * @param position World position as Vector3
 * @returns Chunk ID (0-255) or -1 if out of bounds
 */
export function worldPositionToChunk(position: Vector3): number {
    return worldToChunk(position.x, position.z);
}

/**
 * Convert chunk ID to world position (center of chunk)
 * @param chunkId Chunk ID (0-255)
 * @returns Vector3 at center of chunk, or null if invalid
 */
export function chunkToWorld(chunkId: number): Vector3 | null {
    const grid = chunkIdToGrid(chunkId);

    if (grid.chunkX < 0) {
        return null;
    }

    // Calculate center of chunk in world coordinates
    const worldX = (grid.chunkX * CHUNK_SIZE) + (CHUNK_SIZE / 2);
    const worldZ = (grid.chunkZ * CHUNK_SIZE) + (CHUNK_SIZE / 2);

    return new Vector3(worldX, 0, worldZ);
}

/**
 * Convert chunk ID to random position within chunk
 * @param chunkId Chunk ID (0-255)
 * @param padding Padding from chunk edges (default: 5 units)
 * @returns Vector3 at random position within chunk, or null if invalid
 */
export function chunkToRandomWorld(chunkId: number, padding: number = 5): Vector3 | null {
    const grid = chunkIdToGrid(chunkId);

    if (grid.chunkX < 0) {
        return null;
    }

    // Calculate chunk boundaries with padding
    const minX = grid.chunkX * CHUNK_SIZE + padding;
    const maxX = (grid.chunkX + 1) * CHUNK_SIZE - padding;
    const minZ = grid.chunkZ * CHUNK_SIZE + padding;
    const maxZ = (grid.chunkZ + 1) * CHUNK_SIZE - padding;

    // Random position within padded boundaries
    const worldX = minX + Math.random() * (maxX - minX);
    const worldZ = minZ + Math.random() * (maxZ - minZ);

    return new Vector3(worldX, 0, worldZ);
}

// ==================== Territory-Aware Coordinate Transformations ====================

/**
 * Convert world coordinates to chunk ID relative to territory center
 * Used for AI observations and territorial calculations
 * 
 * @param worldX World X coordinate
 * @param worldZ World Z coordinate
 * @param territoryCenter Territory center position {x, z}
 * @returns Chunk ID (0-255) or -1 if out of bounds
 */
export function worldToTerritoryChunk(
    worldX: number,
    worldZ: number,
    territoryCenter: { x: number; z: number }
): number {
    // Convert world space to chunk space [0, 1024]
    const chunkSpaceX = worldX - territoryCenter.x + (TERRITORY_SIZE / 2);
    const chunkSpaceZ = worldZ - territoryCenter.z + (TERRITORY_SIZE / 2);

    // Convert chunk space to grid position
    const chunkX = Math.floor(chunkSpaceX / CHUNK_SIZE);
    const chunkZ = Math.floor(chunkSpaceZ / CHUNK_SIZE);

    // Bounds check
    if (chunkX < 0 || chunkX >= CHUNKS_PER_AXIS ||
        chunkZ < 0 || chunkZ >= CHUNKS_PER_AXIS) {
        return -1;
    }

    return chunkZ * CHUNKS_PER_AXIS + chunkX;
}

/**
 * Convert chunk ID to world coordinates relative to territory center
 * Used for AI spawn decisions and territorial positioning
 * 
 * @param chunkId Chunk ID (0-255)
 * @param territoryCenter Territory center position {x, z}
 * @param randomize If true, returns random position within chunk
 * @param padding Padding from chunk edges when randomizing (default: 5)
 * @returns World position as Vector3, or null if invalid chunk ID
 */
export function territoryChunkToWorld(
    chunkId: number,
    territoryCenter: { x: number; z: number },
    randomize: boolean = true,
    padding: number = 5
): Vector3 | null {
    // Validate chunk ID
    if (chunkId < 0 || chunkId >= TOTAL_CHUNKS) {
        return null;
    }

    // Convert chunk ID to grid position
    const chunkX = chunkId % CHUNKS_PER_AXIS;
    const chunkZ = Math.floor(chunkId / CHUNKS_PER_AXIS);

    // Calculate position in chunk space [0, 1024]
    let chunkSpaceX: number;
    let chunkSpaceZ: number;

    if (randomize) {
        // Random position within chunk (with padding)
        const minX = chunkX * CHUNK_SIZE + padding;
        const maxX = (chunkX + 1) * CHUNK_SIZE - padding;
        const minZ = chunkZ * CHUNK_SIZE + padding;
        const maxZ = (chunkZ + 1) * CHUNK_SIZE - padding;

        chunkSpaceX = minX + Math.random() * (maxX - minX);
        chunkSpaceZ = minZ + Math.random() * (maxZ - minZ);
    } else {
        // Center of chunk
        chunkSpaceX = chunkX * CHUNK_SIZE + (CHUNK_SIZE / 2);
        chunkSpaceZ = chunkZ * CHUNK_SIZE + (CHUNK_SIZE / 2);
    }

    // Convert chunk space to world space
    const worldX = chunkSpaceX - (TERRITORY_SIZE / 2) + territoryCenter.x;
    const worldZ = chunkSpaceZ - (TERRITORY_SIZE / 2) + territoryCenter.z;

    return new Vector3(worldX, 0, worldZ);
}

// ==================== Optimized Distance Calculations ====================

/**
 * Calculate distance between two positions (standard Euclidean distance)
 * Uses cached vectors to avoid allocation during frequent calculations
 * 
 * @param pos1 First position
 * @param pos2 Second position
 * @returns Distance in world units
 */
export function calculateDistance(pos1: Vector3, pos2: Vector3): number {
    return Vector3.Distance(pos1, pos2);
}

/**
 * Calculate squared distance between two positions (faster than distance)
 * Use when you only need to compare distances without knowing exact values
 * 
 * @param pos1 First position
 * @param pos2 Second position
 * @returns Squared distance (avoid sqrt calculation)
 */
export function calculateDistanceSquared(pos1: Vector3, pos2: Vector3): number {
    const dx = pos2.x - pos1.x;
    const dz = pos2.z - pos1.z;
    return dx * dx + dz * dz;
}

/**
 * Calculate distance between two chunks (Manhattan distance in chunk units)
 * @param chunkId1 First chunk ID
 * @param chunkId2 Second chunk ID
 * @returns Manhattan distance in chunk units, or -1 if invalid
 */
export function calculateChunkDistance(chunkId1: number, chunkId2: number): number {
    const grid1 = chunkIdToGrid(chunkId1);
    const grid2 = chunkIdToGrid(chunkId2);

    if (grid1.chunkX < 0 || grid2.chunkX < 0) {
        return -1;
    }

    return Math.abs(grid1.chunkX - grid2.chunkX) + Math.abs(grid1.chunkZ - grid2.chunkZ);
}

/**
 * Calculate Euclidean distance between chunk centers
 * @param chunkId1 First chunk ID
 * @param chunkId2 Second chunk ID
 * @returns Euclidean distance in world units, or -1 if invalid
 */
export function calculateChunkWorldDistance(chunkId1: number, chunkId2: number): number {
    const pos1 = chunkToWorld(chunkId1);
    const pos2 = chunkToWorld(chunkId2);

    if (!pos1 || !pos2) {
        return -1;
    }

    return calculateDistance(pos1, pos2);
}

/**
 * Check if two positions are within a specified range
 * More efficient than calculating exact distance when you only need range check
 * 
 * @param pos1 First position
 * @param pos2 Second position
 * @param range Maximum range to check
 * @returns true if positions are within range
 */
export function isWithinRange(pos1: Vector3, pos2: Vector3, range: number): boolean {
    const distanceSquared = calculateDistanceSquared(pos1, pos2);
    return distanceSquared <= (range * range);
}

/**
 * Get direction vector from one position to another (zero-allocation)
 * Modifies the result vector in-place to avoid creating new objects
 * 
 * @param from Starting position
 * @param to Target position
 * @param result Vector3 to store the result (modified in-place)
 */
export function getDirection(from: Vector3, to: Vector3, result: Vector3): void {
    to.subtractToRef(from, result);
    result.normalize();
}

/**
 * Get normalized direction vector from one position to another
 * Creates a new Vector3 - use getDirection() for zero-allocation version
 * 
 * @param from Starting position
 * @param to Target position
 * @returns Normalized direction vector
 */
export function getDirectionVector(from: Vector3, to: Vector3): Vector3 {
    const direction = to.subtract(from);
    direction.normalize();
    return direction;
}

// ==================== Spatial Validation and Bounds Checking ====================

/**
 * Check if a position is within the world bounds
 * @param position Position to check
 * @returns true if position is within valid world bounds
 */
export function isValidWorldPosition(position: Vector3): boolean {
    return position.x >= 0 && position.x < TERRITORY_SIZE &&
           position.z >= 0 && position.z < TERRITORY_SIZE;
}

/**
 * Check if a chunk ID is valid
 * @param chunkId Chunk ID to validate
 * @returns true if chunk ID is within valid range (0-255)
 */
export function isValidChunkId(chunkId: number): boolean {
    return chunkId >= 0 && chunkId < TOTAL_CHUNKS;
}

/**
 * Check if a position is within a specific chunk
 * @param position World position to check
 * @param chunkId Target chunk ID
 * @returns true if position is within the specified chunk
 */
export function isPositionInChunk(position: Vector3, chunkId: number): boolean {
    return worldPositionToChunk(position) === chunkId;
}

/**
 * Clamp a position to world bounds
 * @param position Position to clamp
 * @returns Clamped position within world bounds
 */
export function clampToWorldBounds(position: Vector3): Vector3 {
    // Handle NaN values by defaulting to 0
    const x = isNaN(position.x) ? 0 : Math.max(0, Math.min(TERRITORY_SIZE - 1, position.x));
    const z = isNaN(position.z) ? 0 : Math.max(0, Math.min(TERRITORY_SIZE - 1, position.z));
    
    return new Vector3(x, position.y, z);
}

// ==================== Chunk Boundary and Neighbor Operations ====================
// Re-exported from ChunkUtils for backward compatibility
export {
    getChunkBoundaries,
    getNeighboringChunks,
    getChunksInRadius,
    getChunksInEuclideanRadius,
    get8DirectionalNeighbors
} from './ChunkUtils';

// ==================== Utility Functions ====================

/**
 * Normalize chunk ID for neural network input (0-1 range)
 * @param chunkId Chunk ID (0-255)
 * @returns Normalized value (0-1)
 */
export function normalizeChunkId(chunkId: number): number {
    if (chunkId < 0 || chunkId >= TOTAL_CHUNKS) {
        return 0;
    }

    return chunkId / (TOTAL_CHUNKS - 1); // 0-255 → 0-1
}

/**
 * Convert normalized value back to chunk ID
 * @param normalized Normalized value (0-1)
 * @returns Chunk ID (0-255)
 */
export function denormalizeChunkId(normalized: number): number {
    return Math.round(normalized * (TOTAL_CHUNKS - 1));
}

/**
 * Get a random valid chunk ID
 * @returns Random chunk ID (0-255)
 */
export function getRandomChunkId(): number {
    return Math.floor(Math.random() * TOTAL_CHUNKS);
}

/**
 * Get a random position within the world bounds
 * @returns Random Vector3 position within world bounds
 */
export function getRandomWorldPosition(): Vector3 {
    return new Vector3(
        Math.random() * TERRITORY_SIZE,
        0,
        Math.random() * TERRITORY_SIZE
    );
}