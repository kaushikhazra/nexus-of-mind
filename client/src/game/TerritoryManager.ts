/**
 * TerritoryManager - Territory Grid Foundation
 * 
 * Manages the 16x16 chunk territory grid system that divides the game world
 * into 1024x1024 unit territories. Each territory can be controlled by a Queen
 * and provides the foundation for territorial warfare mechanics.
 */

import { Vector3 } from '@babylonjs/core';
import { GameEngine } from './GameEngine';

export interface ChunkBounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    chunkCoords: { x: number, z: number }[];
}

export interface Territory {
    id: string;
    centerPosition: Vector3;
    size: number; // 1024 units
    chunkBounds: ChunkBounds;
    queen: any | null; // Will be Queen type when implemented
    hive: any | null; // Will be Hive type when implemented
    controlStatus: 'queen_controlled' | 'liberated' | 'contested';
    liberationTimer: number; // seconds remaining
    liberationStartTime: number;
    parasiteCount: number;
}

export class TerritoryGrid {
    private gridSize: number; // Territory size in chunks (16)
    private chunkSize: number; // Chunk size in units (64)
    private territories: Map<string, Territory> = new Map();
    
    constructor(gridSize: number = 16, chunkSize: number = 64) {
        this.gridSize = gridSize;
        this.chunkSize = chunkSize;
    }

    /**
     * Get territory coordinates for a world position
     */
    public getTerritoryCoordsAt(x: number, z: number): { territoryX: number, territoryZ: number } {
        const territorySize = this.gridSize * this.chunkSize; // 1024 units
        
        // Calculate territory coordinates (can be negative)
        const territoryX = Math.floor(x / territorySize);
        const territoryZ = Math.floor(z / territorySize);
        
        return { territoryX, territoryZ };
    }

    /**
     * Get territory ID for a world position
     */
    public getTerritoryIdAt(x: number, z: number): string {
        const coords = this.getTerritoryCoordsAt(x, z);
        return `territory_${coords.territoryX}_${coords.territoryZ}`;
    }

    /**
     * Calculate chunk bounds for a territory center
     */
    public calculateChunkBounds(centerX: number, centerZ: number): ChunkBounds {
        const territorySize = this.gridSize * this.chunkSize; // 1024 units
        const halfSize = territorySize / 2; // 512 units
        
        // Calculate territory boundaries
        const minX = centerX - halfSize;
        const maxX = centerX + halfSize;
        const minZ = centerZ - halfSize;
        const maxZ = centerZ + halfSize;
        
        // Ensure boundaries align with chunk grid (64-unit chunks)
        const alignedMinX = Math.floor(minX / this.chunkSize) * this.chunkSize;
        const alignedMaxX = Math.ceil(maxX / this.chunkSize) * this.chunkSize;
        const alignedMinZ = Math.floor(minZ / this.chunkSize) * this.chunkSize;
        const alignedMaxZ = Math.ceil(maxZ / this.chunkSize) * this.chunkSize;
        
        // Generate chunk coordinates within territory
        const chunkCoords: { x: number, z: number }[] = [];
        for (let chunkX = alignedMinX; chunkX < alignedMaxX; chunkX += this.chunkSize) {
            for (let chunkZ = alignedMinZ; chunkZ < alignedMaxZ; chunkZ += this.chunkSize) {
                chunkCoords.push({
                    x: Math.floor(chunkX / this.chunkSize),
                    z: Math.floor(chunkZ / this.chunkSize)
                });
            }
        }
        
        return {
            minX: alignedMinX,
            maxX: alignedMaxX,
            minZ: alignedMinZ,
            maxZ: alignedMaxZ,
            chunkCoords
        };
    }

    /**
     * Get neighboring territories for a territory ID
     */
    public getNeighboringTerritories(territoryId: string): Territory[] {
        const neighbors: Territory[] = [];
        
        // Parse territory coordinates from ID
        const match = territoryId.match(/territory_(-?\d+)_(-?\d+)/);
        if (!match) return neighbors;
        
        const centerX = parseInt(match[1]);
        const centerZ = parseInt(match[2]);
        
        // Check all 8 neighboring positions
        const offsets = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        for (const [dx, dz] of offsets) {
            const neighborId = `territory_${centerX + dx}_${centerZ + dz}`;
            const neighbor = this.territories.get(neighborId);
            if (neighbor) {
                neighbors.push(neighbor);
            }
        }
        
        return neighbors;
    }

    /**
     * Check if a position is within a territory
     */
    public isPositionInTerritory(position: Vector3, territory: Territory): boolean {
        const bounds = territory.chunkBounds;
        return position.x >= bounds.minX && position.x < bounds.maxX &&
               position.z >= bounds.minZ && position.z < bounds.maxZ;
    }

    /**
     * Add territory to grid
     */
    public addTerritory(territory: Territory): void {
        this.territories.set(territory.id, territory);
    }

    /**
     * Get territory by ID
     */
    public getTerritory(territoryId: string): Territory | null {
        return this.territories.get(territoryId) || null;
    }

    /**
     * Get all territories
     */
    public getAllTerritories(): Territory[] {
        return Array.from(this.territories.values());
    }
}

export class TerritoryManager {
    private territories: Map<string, Territory> = new Map();
    private territoryGrid: TerritoryGrid;
    private gameEngine: GameEngine | null = null;
    
    // Territory constants
    private readonly TERRITORY_SIZE_CHUNKS = 16;
    private readonly CHUNK_SIZE = 64;
    private readonly TERRITORY_SIZE_UNITS = 1024;
    
    // Liberation mechanics
    private readonly LIBERATION_DURATION_MIN = 180; // 3 minutes
    private readonly LIBERATION_DURATION_MAX = 300; // 5 minutes
    private readonly LIBERATION_MINING_BONUS = 0.25; // 25% faster mining
    
    constructor() {
        this.territoryGrid = new TerritoryGrid(this.TERRITORY_SIZE_CHUNKS, this.CHUNK_SIZE);
    }

    /**
     * Initialize territory manager with game engine reference
     */
    public initialize(gameEngine: GameEngine): void {
        this.gameEngine = gameEngine;
    }

    /**
     * Create a new territory at the specified center coordinates
     */
    public createTerritory(centerX: number, centerZ: number): Territory {
        // Ensure center coordinates align with territory grid
        const territorySize = this.TERRITORY_SIZE_UNITS;
        const alignedCenterX = Math.floor(centerX / territorySize) * territorySize + territorySize / 2;
        const alignedCenterZ = Math.floor(centerZ / territorySize) * territorySize + territorySize / 2;
        
        const territoryId = this.territoryGrid.getTerritoryIdAt(alignedCenterX, alignedCenterZ);
        
        // Check if territory already exists
        if (this.territories.has(territoryId)) {
            return this.territories.get(territoryId)!;
        }
        
        // Calculate chunk bounds
        const chunkBounds = this.territoryGrid.calculateChunkBounds(alignedCenterX, alignedCenterZ);
        
        const territory: Territory = {
            id: territoryId,
            centerPosition: new Vector3(alignedCenterX, 0, alignedCenterZ),
            size: this.TERRITORY_SIZE_UNITS,
            chunkBounds,
            queen: null,
            hive: null,
            controlStatus: 'contested',
            liberationTimer: 0,
            liberationStartTime: 0,
            parasiteCount: 0
        };
        
        this.territories.set(territoryId, territory);
        this.territoryGrid.addTerritory(territory);
        
        return territory;
    }

    /**
     * Get territory at a specific world position
     */
    public getTerritoryAt(x: number, z: number): Territory | null {
        const territoryId = this.territoryGrid.getTerritoryIdAt(x, z);
        return this.territories.get(territoryId) || null;
    }

    /**
     * Liberate a territory (called when Queen is killed)
     */
    public liberateTerritory(territoryId: string): void {
        const territory = this.territories.get(territoryId);
        if (!territory) return;
        
        // Set liberation status
        territory.controlStatus = 'liberated';
        territory.liberationStartTime = performance.now() / 1000; // Convert to seconds
        
        // Random liberation duration between 3-5 minutes
        const duration = this.LIBERATION_DURATION_MIN + 
                        Math.random() * (this.LIBERATION_DURATION_MAX - this.LIBERATION_DURATION_MIN);
        territory.liberationTimer = duration;
        
        // Clear Queen and Hive references
        territory.queen = null;
        territory.hive = null;
        territory.parasiteCount = 0;
    }

    /**
     * Check if a position is within a specific territory
     */
    public isPositionInTerritory(position: Vector3, territoryId: string): boolean {
        const territory = this.territories.get(territoryId);
        if (!territory) return false;
        
        return this.territoryGrid.isPositionInTerritory(position, territory);
    }

    /**
     * Get all territories within a radius of a position
     */
    public getTerritoriesInRange(position: Vector3, radius: number): Territory[] {
        const territoriesInRange: Territory[] = [];
        
        for (const territory of this.territories.values()) {
            const distance = Vector3.Distance(position, territory.centerPosition);
            if (distance <= radius) {
                territoriesInRange.push(territory);
            }
        }
        
        return territoriesInRange;
    }

    /**
     * Update territory system (called each frame)
     */
    public update(deltaTime: number): void {
        const currentTime = performance.now() / 1000; // Convert to seconds
        
        for (const territory of this.territories.values()) {
            // Update liberation timers
            if (territory.controlStatus === 'liberated' && territory.liberationTimer > 0) {
                territory.liberationTimer -= deltaTime;
                
                // Check if liberation period has ended
                if (territory.liberationTimer <= 0) {
                    territory.controlStatus = 'contested';
                    territory.liberationTimer = 0;
                    territory.liberationStartTime = 0;
                    
                    // TODO: Trigger new Queen spawning when Queen system is implemented
                }
            }
        }
    }

    /**
     * Get mining bonus for a position (25% during liberation)
     */
    public getMiningBonusAt(position: Vector3): number {
        const territory = this.getTerritoryAt(position.x, position.z);
        if (!territory) return 0;
        
        return territory.controlStatus === 'liberated' ? this.LIBERATION_MINING_BONUS : 0;
    }

    /**
     * Check if a territory is currently liberated
     */
    public isTerritoryLiberated(territoryId: string): boolean {
        const territory = this.territories.get(territoryId);
        return territory ? territory.controlStatus === 'liberated' : false;
    }

    /**
     * Get all territories
     */
    public getAllTerritories(): Territory[] {
        return Array.from(this.territories.values());
    }

    /**
     * Get territory by ID
     */
    public getTerritory(territoryId: string): Territory | null {
        return this.territories.get(territoryId) || null;
    }

    /**
     * Get neighboring territories for a territory
     */
    public getNeighboringTerritories(territoryId: string): Territory[] {
        return this.territoryGrid.getNeighboringTerritories(territoryId);
    }

    /**
     * Dispose territory manager
     */
    public dispose(): void {
        this.territories.clear();
        this.gameEngine = null;
    }
}