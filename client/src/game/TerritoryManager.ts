/**
 * TerritoryManager - Territory Grid Foundation
 * 
 * Manages the 16x16 chunk territory grid system that divides the game world
 * into 1024x1024 unit territories. Each territory can be controlled by a Queen
 * and provides the foundation for territorial warfare mechanics.
 */

import { Vector3 } from '@babylonjs/core';
import { GameEngine } from './GameEngine';
import { Queen } from './entities/Queen';
import { AdaptiveQueen } from './entities/AdaptiveQueen';
import { Hive } from './entities/Hive';
import { LiberationManager } from './LiberationManager';
import { EnergyManager } from './EnergyManager';
import { TerritoryPerformanceMonitor } from './TerritoryPerformanceMonitor';
import { ErrorRecoveryManager } from './ErrorRecoveryManager';
import { WebSocketClient } from '../networking/WebSocketClient';
import { GameState } from './GameState';

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
    queen: Queen | null;
    hive: Hive | null;
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
    private liberationManager: LiberationManager | null = null;
    private performanceMonitor: TerritoryPerformanceMonitor | null = null;
    private errorRecoveryManager: ErrorRecoveryManager | null = null;
    
    // Territory constants
    private readonly TERRITORY_SIZE_CHUNKS = 16;
    private readonly CHUNK_SIZE = 64;
    private readonly TERRITORY_SIZE_UNITS = 1024;
    
    // Liberation mechanics (now handled by LiberationManager)
    private readonly LIBERATION_DURATION_MIN = 180; // 3 minutes
    private readonly LIBERATION_DURATION_MAX = 300; // 5 minutes
    private readonly LIBERATION_MINING_BONUS = 0.25; // 25% faster mining
    
    // Queen generation tracking for regeneration cycle
    private territoryGenerations: Map<string, number> = new Map();
    
    // AI Learning dependencies
    private websocketClient?: WebSocketClient;
    private gameState?: GameState;
    private enableAILearning: boolean = false;
    
    constructor() {
        this.territoryGrid = new TerritoryGrid(this.TERRITORY_SIZE_CHUNKS, this.CHUNK_SIZE);
    }

    /**
     * Initialize territory manager with game engine reference
     */
    public initialize(gameEngine: GameEngine): void {
        this.gameEngine = gameEngine;
        
        // Initialize liberation manager
        const energyManager = gameEngine.getEnergyManager();
        if (energyManager) {
            this.liberationManager = new LiberationManager(energyManager);
            this.liberationManager.setTerritoryManager(this);
        }
        
        // Initialize performance monitor
        const mainPerformanceMonitor = gameEngine.getPerformanceMonitor();
        if (mainPerformanceMonitor) {
            this.performanceMonitor = new TerritoryPerformanceMonitor(this, mainPerformanceMonitor);
            this.performanceMonitor.startMonitoring();
            
            // Set up performance callbacks
            this.performanceMonitor.onWarning((metrics) => {
                console.warn(`🏰 Territory Performance Warning: ${metrics.performanceGrade} - Memory: ${metrics.totalTerritoryMemory.toFixed(1)}MB, CPU: ${metrics.cpuOverheadPercentage.toFixed(1)}%`);
            });
            
            this.performanceMonitor.onCritical((metrics) => {
                console.error(`🏰 Territory Performance Critical: ${metrics.performanceGrade} - Memory: ${metrics.totalTerritoryMemory.toFixed(1)}MB, CPU: ${metrics.cpuOverheadPercentage.toFixed(1)}%`);
            });
            
            this.performanceMonitor.onOptimization((level, description) => {
                console.log(`🏰 Territory Performance Optimization: Level ${level} - ${description}`);
            });
        }
        
        // Initialize error recovery manager
        const parasiteManager = gameEngine.getParasiteManager();
        if (parasiteManager) {
            this.errorRecoveryManager = new ErrorRecoveryManager(this, parasiteManager, gameEngine);
        }
        
        console.log('🏰 TerritoryManager initialized');
    }

    /**
     * Initialize AI learning capabilities
     */
    public initializeAILearning(websocketClient: WebSocketClient, gameState: GameState): void {
        this.websocketClient = websocketClient;
        this.gameState = gameState;
        this.enableAILearning = true;
        
        console.log('🧠 TerritoryManager: AI learning capabilities initialized');
    }

    /**
     * Enable or disable AI learning
     */
    public setAILearningEnabled(enabled: boolean): void {
        this.enableAILearning = enabled && this.websocketClient && this.gameState;
        console.log(`🧠 TerritoryManager: AI learning ${this.enableAILearning ? 'enabled' : 'disabled'}`);
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
    public liberateTerritory(territoryId: string, queenId?: string): void {
        const territory = this.territories.get(territoryId);
        if (!territory) return;
        
        // Use LiberationManager to handle liberation
        if (this.liberationManager && queenId) {
            this.liberationManager.startLiberation(territoryId, queenId, 'queen_death');
        }
        
        // Set territory status
        territory.controlStatus = 'liberated';
        territory.liberationStartTime = performance.now() / 1000; // Convert to seconds
        
        // Get liberation status from LiberationManager for timer
        const liberationStatus = this.liberationManager?.getLiberationStatus(territoryId);
        if (liberationStatus) {
            territory.liberationTimer = liberationStatus.timeRemaining;
        } else {
            // Fallback to old behavior if LiberationManager not available
            const duration = this.LIBERATION_DURATION_MIN + 
                            Math.random() * (this.LIBERATION_DURATION_MAX - this.LIBERATION_DURATION_MIN);
            territory.liberationTimer = duration;
        }
        
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
        
        // Start performance measurement
        if (this.performanceMonitor) {
            this.performanceMonitor.startFrameMeasurement();
            this.performanceMonitor.startTerritoryUpdateMeasurement();
        }
        
        // Update liberation manager
        if (this.liberationManager) {
            this.liberationManager.updateLiberations(deltaTime);
        }
        
        // Update all Queens and Hives first
        this.updateQueensAndHives(deltaTime);
        
        // End territory update measurement
        if (this.performanceMonitor) {
            this.performanceMonitor.endTerritoryUpdateMeasurement();
        }
        
        for (const territory of this.territories.values()) {
            // Update liberation timers using LiberationManager
            if (territory.controlStatus === 'liberated' && territory.liberationTimer > 0) {
                // Get updated status from LiberationManager
                const liberationStatus = this.liberationManager?.getLiberationStatus(territory.id);
                if (liberationStatus) {
                    territory.liberationTimer = liberationStatus.timeRemaining;
                    
                    // Check if liberation ended according to LiberationManager
                    if (!liberationStatus.isLiberated || liberationStatus.timeRemaining <= 0) {
                        territory.controlStatus = 'contested';
                        territory.liberationTimer = 0;
                        territory.liberationStartTime = 0;
                        
                        // Spawn new Queen when liberation ends (requirement 4.3)
                        const previousGeneration = this.getPreviousGeneration(territory.id);
                        this.createQueenForTerritory(territory.id, previousGeneration + 1);
                    }
                } else {
                    // Fallback to old timer behavior if LiberationManager not available
                    territory.liberationTimer -= deltaTime;
                    
                    if (territory.liberationTimer <= 0) {
                        territory.controlStatus = 'contested';
                        territory.liberationTimer = 0;
                        territory.liberationStartTime = 0;
                        
                        const previousGeneration = this.getPreviousGeneration(territory.id);
                        this.createQueenForTerritory(territory.id, previousGeneration + 1);
                    }
                }
            }
        }
        
        // Update performance monitoring
        if (this.performanceMonitor) {
            this.performanceMonitor.update(deltaTime);
        }
        
        // Update error recovery system
        if (this.errorRecoveryManager) {
            // Error recovery runs its own validation timer, no need to update every frame
        }
    }

    /**
     * Get mining bonus for a position (25% during liberation)
     */
    public getMiningBonusAt(position: Vector3): number {
        // Use LiberationManager if available
        if (this.liberationManager) {
            return this.liberationManager.getMiningBonusAt(position);
        }
        
        // Fallback to old behavior
        const territory = this.getTerritoryAt(position.x, position.z);
        if (!territory) return 0;
        
        return territory.controlStatus === 'liberated' ? this.LIBERATION_MINING_BONUS : 0;
    }

    /**
     * Check if a territory is currently liberated
     */
    public isTerritoryLiberated(territoryId: string): boolean {
        // Use LiberationManager if available
        if (this.liberationManager) {
            return this.liberationManager.isTerritoryLiberated(territoryId);
        }
        
        // Fallback to old behavior
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
     * Get liberation manager
     */
    public getLiberationManager(): LiberationManager | null {
        return this.liberationManager;
    }

    /**
     * Get territory performance monitor
     */
    public getPerformanceMonitor(): TerritoryPerformanceMonitor | null {
        return this.performanceMonitor;
    }

    /**
     * Get error recovery manager
     */
    public getErrorRecoveryManager(): ErrorRecoveryManager | null {
        return this.errorRecoveryManager;
    }

    /**
     * Get previous generation number for a territory
     */
    private getPreviousGeneration(territoryId: string): number {
        return this.territoryGenerations.get(territoryId) || 0;
    }

    /**
     * Set generation number for a territory
     */
    private setTerritoryGeneration(territoryId: string, generation: number): void {
        this.territoryGenerations.set(territoryId, generation);
    }

    /**
     * Create a Queen for a territory with proper regeneration cycle handling
     */
    public createQueenForTerritory(territoryId: string, generation: number = 1): Queen | null {
        const territory = this.territories.get(territoryId);
        if (!territory) {
            console.error(`Cannot create Queen: Territory ${territoryId} not found`);
            return null;
        }

        // Don't create Queen if one already exists
        if (territory.queen) {
            console.warn(`Territory ${territoryId} already has a Queen`);
            return territory.queen;
        }

        // Create Queen with random health (40-100 hits) and growth duration (60-120 seconds)
        // Requirements 4.4: Growth phase 60-120 seconds
        const queenConfig = {
            territory,
            generation,
            health: 40 + Math.random() * 60, // 40-100 hits (requirement 2.1)
            growthDuration: 60 + Math.random() * 60 // 60-120 seconds (requirement 4.4)
        };

        let queen: Queen;
        
        // Use AdaptiveQueen if AI learning is enabled and dependencies are available
        if (this.enableAILearning && this.websocketClient && this.gameState) {
            const adaptiveConfig = {
                ...queenConfig,
                websocketClient: this.websocketClient,
                gameState: this.gameState,
                enableLearning: true
            };
            queen = new AdaptiveQueen(adaptiveConfig);
            console.log(`🧠 Created AdaptiveQueen ${queen.id} for territory ${territoryId} (Gen ${generation}) with AI learning`);
        } else {
            queen = new Queen(queenConfig);
            console.log(`👑 Created Queen ${queen.id} for territory ${territoryId} (Gen ${generation})`);
        }
        
        territory.queen = queen;
        territory.controlStatus = 'queen_controlled';

        // Track generation for regeneration cycle
        this.setTerritoryGeneration(territoryId, generation);

        // Set up Queen destruction callback to handle territory liberation
        queen.onQueenDestroyed((destroyedQueen) => {
            this.handleQueenDestruction(destroyedQueen);
        });
        
        return queen;
    }

    /**
     * Handle Queen destruction and trigger liberation cycle (requirements 4.1, 4.2, 4.3)
     */
    private handleQueenDestruction(queen: Queen): void {
        const territory = queen.getTerritory();
        
        console.log(`👑 Handling destruction of Queen ${queen.id} in territory ${territory.id}`);
        
        // Territory should already be liberated by Queen.onDestroyed()
        // This method ensures proper cleanup and regeneration cycle setup
        
        // Ensure territory is properly liberated with Queen ID for energy rewards
        if (territory.controlStatus !== 'liberated') {
            this.liberateTerritory(territory.id, queen.id);
        }
        
        // The regeneration cycle will be handled by the update() method
        // when the liberation timer expires
    }

    /**
     * Remove Queen from territory (called when Queen is destroyed)
     */
    public removeQueenFromTerritory(territoryId: string): void {
        const territory = this.territories.get(territoryId);
        if (!territory) return;

        if (territory.queen) {
            territory.queen.dispose();
            territory.queen = null;
        }
        
        if (territory.hive) {
            territory.hive.dispose();
            territory.hive = null;
        }
    }

    /**
     * Get all active Queens
     */
    public getAllQueens(): Queen[] {
        const queens: Queen[] = [];
        for (const territory of this.territories.values()) {
            if (territory.queen) {
                queens.push(territory.queen);
            }
        }
        return queens;
    }

    /**
     * Update all Queens and Hives in territories
     */
    private updateQueensAndHives(deltaTime: number): void {
        // Start Queen update measurement
        if (this.performanceMonitor) {
            this.performanceMonitor.startQueenUpdateMeasurement();
        }
        
        // Get optimization level for performance degradation handling
        const optimizationLevel = this.performanceMonitor?.getOptimizationLevel() || 0;
        
        // Apply performance optimizations based on level
        let queensToUpdate = this.territories.values();
        let updateFrequency = 1; // Update every frame by default
        
        if (optimizationLevel >= 1) {
            // Light optimization: Update Queens every other frame
            updateFrequency = 2;
        }
        
        if (optimizationLevel >= 2) {
            // Moderate optimization: Update Queens every 3rd frame
            updateFrequency = 3;
        }
        
        if (optimizationLevel >= 3) {
            // Aggressive optimization: Update Queens every 4th frame
            updateFrequency = 4;
        }
        
        // Frame-based update limiting
        const frameCount = Math.floor(performance.now() / 16.67); // Approximate frame count
        const shouldUpdateThisFrame = frameCount % updateFrequency === 0;
        
        if (shouldUpdateThisFrame) {
            for (const territory of queensToUpdate) {
                // Update Queen
                if (territory.queen) {
                    territory.queen.update(deltaTime);
                    
                    // Check if Queen was destroyed and handle cleanup
                    if (!territory.queen.isActiveQueen()) {
                        this.removeQueenFromTerritory(territory.id);
                    }
                }
            }
        }
        
        // End Queen update measurement
        if (this.performanceMonitor) {
            this.performanceMonitor.endQueenUpdateMeasurement();
        }
        
        // Start Hive update measurement
        if (this.performanceMonitor) {
            this.performanceMonitor.startHiveUpdateMeasurement();
        }
        
        // Update Hives (always update for construction timing)
        for (const territory of this.territories.values()) {
            if (territory.hive) {
                territory.hive.update(deltaTime);
                
                // Check if Hive was destroyed and handle cleanup
                if (!territory.hive.isActiveHive()) {
                    territory.hive = null;
                }
            }
        }
        
        // End Hive update measurement
        if (this.performanceMonitor) {
            this.performanceMonitor.endHiveUpdateMeasurement();
        }
    }

    /**
     * Dispose territory manager
     */
    public dispose(): void {
        // Dispose error recovery manager
        if (this.errorRecoveryManager) {
            this.errorRecoveryManager.dispose();
            this.errorRecoveryManager = null;
        }
        
        // Stop performance monitoring
        if (this.performanceMonitor) {
            this.performanceMonitor.dispose();
            this.performanceMonitor = null;
        }
        
        // Dispose all Queens and Hives
        for (const territory of this.territories.values()) {
            if (territory.queen) {
                territory.queen.dispose();
            }
            if (territory.hive) {
                territory.hive.dispose();
            }
        }
        
        // Dispose liberation manager
        if (this.liberationManager) {
            this.liberationManager.dispose();
            this.liberationManager = null;
        }
        
        this.territories.clear();
        this.territoryGenerations.clear();
        this.gameEngine = null;
    }
}