/**
 * SpatialIndex - Chunk-based spatial indexing for O(1) entity lookups
 *
 * Divides the world into 64-unit chunks (matching terrain chunk size) for
 * efficient proximity queries instead of O(n) distance scanning.
 */

import { Vector3 } from '@babylonjs/core';

export type EntityType = 'worker' | 'scout' | 'protector' | 'parasite' | 'combat_parasite' | 'queen' | 'hive' | 'building';

export class SpatialIndex {
    private static readonly CHUNK_SIZE = 64;

    // chunkKey -> Set of entityIds in that chunk
    private chunks: Map<string, Set<string>> = new Map();

    // entityId -> current position
    private entityPositions: Map<string, Vector3> = new Map();

    // entityId -> entity type for filtering
    private entityTypes: Map<string, EntityType> = new Map();

    // entityId -> current chunk key (for fast updates)
    private entityChunks: Map<string, string> = new Map();

    /**
     * Get chunk key from world coordinates
     */
    private getChunkKey(x: number, z: number): string {
        const chunkX = Math.floor(x / SpatialIndex.CHUNK_SIZE);
        const chunkZ = Math.floor(z / SpatialIndex.CHUNK_SIZE);
        return `${chunkX},${chunkZ}`;
    }

    /**
     * Get chunk coordinates from chunk key
     */
    private parseChunkKey(key: string): { chunkX: number; chunkZ: number } {
        const [chunkX, chunkZ] = key.split(',').map(Number);
        return { chunkX, chunkZ };
    }

    /**
     * Get or create chunk set
     */
    private getOrCreateChunk(chunkKey: string): Set<string> {
        let chunk = this.chunks.get(chunkKey);
        if (!chunk) {
            chunk = new Set();
            this.chunks.set(chunkKey, chunk);
        }
        return chunk;
    }

    /**
     * Add an entity to the spatial index
     */
    public add(entityId: string, position: Vector3, entityType: EntityType): void {
        // Remove if already exists (handles re-adds)
        if (this.entityPositions.has(entityId)) {
            this.remove(entityId);
        }

        const chunkKey = this.getChunkKey(position.x, position.z);
        const chunk = this.getOrCreateChunk(chunkKey);

        chunk.add(entityId);
        this.entityPositions.set(entityId, position.clone());
        this.entityTypes.set(entityId, entityType);
        this.entityChunks.set(entityId, chunkKey);

        // Debug log (commented out to reduce console noise)
        // console.log(`[SpatialIndex] add: type=${entityType}, id=${entityId.slice(0, 20)}, pos=(${position.x.toFixed(1)}, ${position.z.toFixed(1)}), chunk=${chunkKey}`);
    }

    /**
     * Remove an entity from the spatial index
     */
    public remove(entityId: string): void {
        const chunkKey = this.entityChunks.get(entityId);
        if (chunkKey) {
            const chunk = this.chunks.get(chunkKey);
            if (chunk) {
                chunk.delete(entityId);
                // Clean up empty chunks
                if (chunk.size === 0) {
                    this.chunks.delete(chunkKey);
                }
            }
        }

        this.entityPositions.delete(entityId);
        this.entityTypes.delete(entityId);
        this.entityChunks.delete(entityId);
    }

    /**
     * Update entity position (efficient - only updates if chunk changed)
     */
    public updatePosition(entityId: string, newPosition: Vector3): void {
        const oldChunkKey = this.entityChunks.get(entityId);
        if (!oldChunkKey) {
            // Entity not in index, ignore
            return;
        }

        const newChunkKey = this.getChunkKey(newPosition.x, newPosition.z);

        // Update position
        this.entityPositions.set(entityId, newPosition.clone());

        // Only update chunks if chunk changed
        if (oldChunkKey !== newChunkKey) {
            // Remove from old chunk
            const oldChunk = this.chunks.get(oldChunkKey);
            if (oldChunk) {
                oldChunk.delete(entityId);
                if (oldChunk.size === 0) {
                    this.chunks.delete(oldChunkKey);
                }
            }

            // Add to new chunk
            const newChunk = this.getOrCreateChunk(newChunkKey);
            newChunk.add(entityId);
            this.entityChunks.set(entityId, newChunkKey);
        }
    }

    /**
     * Get all entity IDs within a radius of a position
     * Returns only IDs - caller must resolve to actual entities
     */
    public getEntitiesInRange(
        center: Vector3,
        radius: number,
        typeFilter?: EntityType | EntityType[]
    ): string[] {
        const results: string[] = [];

        // Calculate chunk range to search
        const minChunkX = Math.floor((center.x - radius) / SpatialIndex.CHUNK_SIZE);
        const maxChunkX = Math.floor((center.x + radius) / SpatialIndex.CHUNK_SIZE);
        const minChunkZ = Math.floor((center.z - radius) / SpatialIndex.CHUNK_SIZE);
        const maxChunkZ = Math.floor((center.z + radius) / SpatialIndex.CHUNK_SIZE);

        const radiusSquared = radius * radius;
        const typeSet = typeFilter
            ? new Set(Array.isArray(typeFilter) ? typeFilter : [typeFilter])
            : null;

        // Check only relevant chunks
        for (let cx = minChunkX; cx <= maxChunkX; cx++) {
            for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
                const chunkKey = `${cx},${cz}`;
                const chunk = this.chunks.get(chunkKey);

                if (chunk) {
                    for (const entityId of chunk) {
                        // Type filter
                        if (typeSet) {
                            const entityType = this.entityTypes.get(entityId);
                            if (!entityType || !typeSet.has(entityType)) {
                                continue;
                            }
                        }

                        // Distance check (squared for performance)
                        const pos = this.entityPositions.get(entityId);
                        if (pos) {
                            const dx = pos.x - center.x;
                            const dz = pos.z - center.z;
                            const distSquared = dx * dx + dz * dz;

                            if (distSquared <= radiusSquared) {
                                results.push(entityId);
                            }
                        }
                    }
                }
            }
        }

        // Debug log (commented out to reduce console noise)
        // console.log(`[SpatialIndex] getEntitiesInRange: center=(${center.x.toFixed(1)}, ${center.z.toFixed(1)}), radius=${radius}, filter=${typeFilter || 'all'}, found=${results.length}`, results.slice(0, 5));

        return results;
    }

    /**
     * Get all entities in a specific chunk
     */
    public getEntitiesInChunk(
        chunkX: number,
        chunkZ: number,
        typeFilter?: EntityType | EntityType[]
    ): string[] {
        const chunkKey = `${chunkX},${chunkZ}`;
        const chunk = this.chunks.get(chunkKey);

        if (!chunk) {
            return [];
        }

        if (!typeFilter) {
            return Array.from(chunk);
        }

        const typeSet = new Set(Array.isArray(typeFilter) ? typeFilter : [typeFilter]);
        const results: string[] = [];

        for (const entityId of chunk) {
            const entityType = this.entityTypes.get(entityId);
            if (entityType && typeSet.has(entityType)) {
                results.push(entityId);
            }
        }

        return results;
    }

    /**
     * Get position of an entity
     */
    public getPosition(entityId: string): Vector3 | undefined {
        return this.entityPositions.get(entityId);
    }

    /**
     * Get type of an entity
     */
    public getType(entityId: string): EntityType | undefined {
        return this.entityTypes.get(entityId);
    }

    /**
     * Check if entity exists in index
     */
    public has(entityId: string): boolean {
        return this.entityPositions.has(entityId);
    }

    /**
     * Get count of tracked entities
     */
    public getEntityCount(): number {
        return this.entityPositions.size;
    }

    /**
     * Get count of active chunks
     */
    public getChunkCount(): number {
        return this.chunks.size;
    }

    /**
     * Get statistics for debugging
     */
    public getStats(): {
        entityCount: number;
        chunkCount: number;
        avgEntitiesPerChunk: number;
    } {
        const entityCount = this.entityPositions.size;
        const chunkCount = this.chunks.size;
        const avgEntitiesPerChunk = chunkCount > 0 ? entityCount / chunkCount : 0;

        return {
            entityCount,
            chunkCount,
            avgEntitiesPerChunk
        };
    }

    /**
     * Clear all data
     */
    public clear(): void {
        this.chunks.clear();
        this.entityPositions.clear();
        this.entityTypes.clear();
        this.entityChunks.clear();
    }

    /**
     * Dispose and cleanup
     */
    public dispose(): void {
        this.clear();
    }
}
