/**
 * ChunkUtils - Chunk boundary and neighbor operations
 *
 * Provides utilities for working with chunk boundaries, neighbors, and
 * radius-based chunk queries. Extracted from PositionUtils for file size compliance.
 */

import {
    CHUNK_SIZE,
    CHUNKS_PER_AXIS,
    chunkIdToGrid,
    gridToChunkId
} from './PositionUtils';

// ==================== Chunk Boundary Operations ====================

/**
 * Get chunk boundaries in world coordinates
 * @param chunkId Chunk ID (0-255)
 * @returns Boundaries {minX, maxX, minZ, maxZ} or null if invalid
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

// ==================== Chunk Neighbor Operations ====================

/**
 * Get neighboring chunk IDs (4-directional: North, South, East, West)
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
 * Get all chunks within a specified radius (Manhattan distance)
 * @param centerChunkId Center chunk ID
 * @param radius Radius in chunk units
 * @returns Array of chunk IDs within radius
 */
export function getChunksInRadius(centerChunkId: number, radius: number): number[] {
    const centerGrid = chunkIdToGrid(centerChunkId);

    if (centerGrid.chunkX < 0) {
        return [];
    }

    const chunks: number[] = [];

    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            // Manhattan distance check
            if (Math.abs(dx) + Math.abs(dz) <= radius) {
                const chunkX = centerGrid.chunkX + dx;
                const chunkZ = centerGrid.chunkZ + dz;

                const chunkId = gridToChunkId(chunkX, chunkZ);
                if (chunkId >= 0) {
                    chunks.push(chunkId);
                }
            }
        }
    }

    return chunks;
}

/**
 * Get all chunks within a specified radius (Euclidean distance)
 * @param centerChunkId Center chunk ID
 * @param radius Radius in chunk units
 * @returns Array of chunk IDs within Euclidean radius
 */
export function getChunksInEuclideanRadius(centerChunkId: number, radius: number): number[] {
    const centerGrid = chunkIdToGrid(centerChunkId);

    if (centerGrid.chunkX < 0) {
        return [];
    }

    const chunks: number[] = [];
    const radiusSquared = radius * radius;

    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
        for (let dz = -Math.ceil(radius); dz <= Math.ceil(radius); dz++) {
            // Euclidean distance check
            if (dx * dx + dz * dz <= radiusSquared) {
                const chunkX = centerGrid.chunkX + dx;
                const chunkZ = centerGrid.chunkZ + dz;

                const chunkId = gridToChunkId(chunkX, chunkZ);
                if (chunkId >= 0) {
                    chunks.push(chunkId);
                }
            }
        }
    }

    return chunks;
}

/**
 * Get 8-directional neighbors (includes diagonals)
 * @param chunkId Center chunk ID
 * @returns Array of valid neighboring chunk IDs (up to 8)
 */
export function get8DirectionalNeighbors(chunkId: number): number[] {
    const grid = chunkIdToGrid(chunkId);

    if (grid.chunkX < 0) {
        return [];
    }

    const neighbors: number[] = [];

    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            // Skip center
            if (dx === 0 && dz === 0) continue;

            const neighborId = gridToChunkId(grid.chunkX + dx, grid.chunkZ + dz);
            if (neighborId >= 0) {
                neighbors.push(neighborId);
            }
        }
    }

    return neighbors;
}
