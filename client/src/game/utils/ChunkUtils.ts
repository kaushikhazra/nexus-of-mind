/**
 * ChunkUtils - Utility functions for chunk-based spatial operations
 *
 * The game world is divided into a 16x16 grid of chunks (256 total).
 * Each chunk is 64x64 world units.
 * Territory size: 1024x1024 units (16 chunks × 64 units)
 *
 * Chunk ID layout (0-255):
 *   0   1   2  ...  15
 *  16  17  18 ...  31
 *  ...
 * 240 241 242 ... 255
 */

import { Vector3 } from '@babylonjs/core';

// Chunk configuration constants
export const CHUNK_SIZE = 64;           // World units per chunk
export const CHUNKS_PER_AXIS = 16;      // 16x16 grid
export const TOTAL_CHUNKS = 256;        // 16 × 16
export const TERRITORY_SIZE = 1024;     // 16 × 64
export const CENTER_CHUNK_ID = 136;     // Grid (8,8) = world (0,0)

/**
 * Convert chunk ID to chunk grid coordinates
 * @param chunkId Chunk ID (0-255)
 * @returns { chunkX, chunkZ } grid coordinates (0-15 each)
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
 * @returns Chunk ID (0-255) or -1 if invalid
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
export function positionToChunkId(x: number, z: number): number {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);

    return gridToChunkId(chunkX, chunkZ);
}

/**
 * Convert chunk ID to world position (center of chunk)
 * @param chunkId Chunk ID (0-255)
 * @returns Vector3 at center of chunk, or null if invalid
 */
export function chunkIdToPosition(chunkId: number): Vector3 | null {
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
 * Convert chunk ID to a random position within the chunk
 * @param chunkId Chunk ID (0-255)
 * @param padding Padding from chunk edges (default: 5 units)
 * @returns Vector3 at random position within chunk, or null if invalid
 */
export function chunkIdToRandomPosition(chunkId: number, padding: number = 5): Vector3 | null {
    const grid = chunkIdToGrid(chunkId);

    if (grid.chunkX < 0) {
        return null;
    }

    // Calculate chunk boundaries
    const minX = grid.chunkX * CHUNK_SIZE + padding;
    const maxX = (grid.chunkX + 1) * CHUNK_SIZE - padding;
    const minZ = grid.chunkZ * CHUNK_SIZE + padding;
    const maxZ = (grid.chunkZ + 1) * CHUNK_SIZE - padding;

    // Random position within padded boundaries
    const worldX = minX + Math.random() * (maxX - minX);
    const worldZ = minZ + Math.random() * (maxZ - minZ);

    return new Vector3(worldX, 0, worldZ);
}

/**
 * Get chunk boundaries in world coordinates
 * @param chunkId Chunk ID (0-255)
 * @returns Boundaries { minX, maxX, minZ, maxZ } or null if invalid
 */
export function getChunkBoundaries(chunkId: number): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
} | null {
    const grid = chunkIdToGrid(chunkId);

    if (grid.chunkX < 0) {
        return null;
    }

    return {
        minX: grid.chunkX * CHUNK_SIZE,
        maxX: (grid.chunkX + 1) * CHUNK_SIZE,
        minZ: grid.chunkZ * CHUNK_SIZE,
        maxZ: (grid.chunkZ + 1) * CHUNK_SIZE
    };
}

/**
 * Check if a position is within a specific chunk
 * @param x World X position
 * @param z World Z position
 * @param chunkId Target chunk ID
 * @returns true if position is within the chunk
 */
export function isPositionInChunk(x: number, z: number, chunkId: number): boolean {
    return positionToChunkId(x, z) === chunkId;
}

/**
 * Get neighboring chunk IDs (4-directional)
 * @param chunkId Center chunk ID
 * @returns Array of valid neighboring chunk IDs
 */
export function getNeighboringChunks(chunkId: number): number[] {
    const grid = chunkIdToGrid(chunkId);

    if (grid.chunkX < 0) {
        return [];
    }

    const neighbors: number[] = [];

    // North (z - 1)
    if (grid.chunkZ > 0) {
        neighbors.push(gridToChunkId(grid.chunkX, grid.chunkZ - 1));
    }

    // South (z + 1)
    if (grid.chunkZ < CHUNKS_PER_AXIS - 1) {
        neighbors.push(gridToChunkId(grid.chunkX, grid.chunkZ + 1));
    }

    // West (x - 1)
    if (grid.chunkX > 0) {
        neighbors.push(gridToChunkId(grid.chunkX - 1, grid.chunkZ));
    }

    // East (x + 1)
    if (grid.chunkX < CHUNKS_PER_AXIS - 1) {
        neighbors.push(gridToChunkId(grid.chunkX + 1, grid.chunkZ));
    }

    return neighbors;
}

/**
 * Calculate distance between two chunks (in chunk units)
 * @param chunkId1 First chunk ID
 * @param chunkId2 Second chunk ID
 * @returns Manhattan distance in chunk units, or -1 if invalid
 */
export function chunkDistance(chunkId1: number, chunkId2: number): number {
    const grid1 = chunkIdToGrid(chunkId1);
    const grid2 = chunkIdToGrid(chunkId2);

    if (grid1.chunkX < 0 || grid2.chunkX < 0) {
        return -1;
    }

    return Math.abs(grid1.chunkX - grid2.chunkX) + Math.abs(grid1.chunkZ - grid2.chunkZ);
}

/**
 * Normalize chunk ID for NN input (0-1 range)
 * @param chunkId Chunk ID (0-255)
 * @returns Normalized value (0-1)
 */
export function normalizeChunkId(chunkId: number): number {
    if (chunkId < 0 || chunkId >= TOTAL_CHUNKS) {
        return 0;
    }

    return chunkId / (TOTAL_CHUNKS - 1); // 0-255 → 0-1
}

// ==================== Territory-Aware Chunk Conversion ====================
// These methods handle the coordinate transformation between:
// - World space: Centered around territory center (can be negative)
// - Chunk space: [0, 1024] range divided into 16x16 chunks of 64 units each

/**
 * Convert world coordinates to chunk ID (for outgoing observations)
 *
 * Formula: worldPosition → chunkSpace → chunkId
 *   chunkSpace = worldPosition - territoryCenter + 512
 *   chunkId = floor(chunkSpace / 64)
 *
 * @param worldX World X coordinate
 * @param worldZ World Z coordinate
 * @param territoryCenter Territory center position {x, z}
 * @returns Chunk ID (0-255) or -1 if out of bounds
 */
export function coordinateToChunk(
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

    // Convert grid to chunk ID
    return chunkZ * CHUNKS_PER_AXIS + chunkX;
}

/**
 * Convert chunk ID to world coordinates (for incoming spawn decisions)
 *
 * Formula: chunkId → chunkSpace → worldPosition
 *   chunkSpace = (chunkGrid * 64) + 32  (center of chunk)
 *   worldPosition = chunkSpace - 512 + territoryCenter
 *
 * @param chunkId Chunk ID (0-255)
 * @param territoryCenter Territory center position {x, z}
 * @param randomize If true, returns random position within chunk; if false, returns center
 * @param padding Padding from chunk edges when randomizing (default: 5)
 * @returns World position as Vector3, or null if invalid chunk ID
 */
export function chunkToCoordinate(
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
