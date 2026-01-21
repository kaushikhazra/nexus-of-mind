/**
 * GameState - Central game state management including energy economy
 * 
 * Manages the overall game state, entity tracking, and integration between
 * all game systems including energy, terrain, units, and buildings.
 */

import { Vector3 } from '@babylonjs/core';
import { EnergyManager } from './EnergyManager';
import { EnergyStorage } from './EnergyStorage';
import { MineralDeposit } from '../world/MineralDeposit';
import { MiningAction } from './actions/MiningAction';
import { BuildingAction, BuildingType } from './actions/BuildingAction';
import { MovementAction } from './actions/MovementAction';

export interface GameEntity {
    id: string;
    type: 'unit' | 'building' | 'deposit';
    position: Vector3;
    energyStorage?: EnergyStorage;
    isActive: boolean;
    metadata: any;
}

export interface GameUnit extends GameEntity {
    type: 'unit';
    unitType: 'worker' | 'scout' | 'protector';
    currentAction?: MiningAction | MovementAction | BuildingAction;
    health: number;
    maxHealth: number;
}

export interface GameBuilding extends GameEntity {
    type: 'building';
    buildingType: BuildingType;
    constructionProgress: number; // 0-1, 1 = complete
    energyGeneration?: number; // energy per second
}

export interface GameStats {
    totalEntities: number;
    activeUnits: number;
    completedBuildings: number;
    totalMineralDeposits: number;
    visibleMineralDeposits: number;
    totalEnergyGenerated: number;
    totalEnergyConsumed: number;
    currentEnergyLevel: number;
    gameTime: number; // seconds since game start
}

export class GameState {
    private static instance: GameState | null = null;
    
    // Core systems
    private energyManager: EnergyManager;
    
    // Entity management
    private entities: Map<string, GameEntity> = new Map();
    private units: Map<string, GameUnit> = new Map();
    private buildings: Map<string, GameBuilding> = new Map();
    private mineralDeposits: Map<string, MineralDeposit> = new Map();
    private mineralDepositsArray: MineralDeposit[] = [];  // Maintained alongside Map for zero-allocation access
    
    // Game state
    private gameStartTime: number = 0;
    private isGameActive: boolean = false;
    private gameSpeed: number = 1.0; // Game speed multiplier
    
    // Statistics tracking
    private totalEnergyGenerated: number = 0;
    private totalEnergyConsumed: number = 0;
    private entityIdCounter: number = 0;

    private constructor() {
        this.energyManager = EnergyManager.getInstance();
        this.setupEnergyCallbacks();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): GameState {
        if (!GameState.instance) {
            GameState.instance = new GameState();
        }
        return GameState.instance;
    }

    /**
     * Initialize game state
     */
    public initialize(): void {
        this.gameStartTime = performance.now();
        this.isGameActive = true;

        // Initialize energy system with starting energy and minerals
        this.energyManager.initialize(500, 15);
    }

    /**
     * Setup energy system callbacks
     */
    private setupEnergyCallbacks(): void {
        this.energyManager.onEnergyChange((stats) => {
            // Track energy statistics
            this.totalEnergyGenerated = stats.totalGeneration;
            this.totalEnergyConsumed = stats.totalConsumption;
        });

        this.energyManager.onLowEnergy((entityId, currentEnergy) => {
            // TODO: Trigger low energy UI warnings or AI responses
        });

        this.energyManager.onEnergyDepleted((entityId) => {
            // TODO: Handle energy depletion (stop actions, emergency protocols)
        });
    }

    /**
     * Update game state (called each frame)
     */
    public update(deltaTime: number): void {
        if (!this.isGameActive) {
            return;
        }

        // Apply game speed
        const adjustedDeltaTime = deltaTime * this.gameSpeed;

        // Update energy system
        this.energyManager.update();

        // Update all active units
        for (const unit of this.units.values()) {
            if (unit.isActive && unit.currentAction) {
                this.updateUnitAction(unit, adjustedDeltaTime);
            }
        }

        // Update buildings (energy generation)
        for (const building of this.buildings.values()) {
            if (building.isActive && building.constructionProgress >= 1.0) {
                this.updateBuildingGeneration(building, adjustedDeltaTime);
            }
        }
    }

    /**
     * Update unit action
     */
    private async updateUnitAction(unit: GameUnit, deltaTime: number): Promise<void> {
        if (!unit.currentAction) {
            return;
        }

        try {
            const result = await unit.currentAction.executeAction(deltaTime);
            
            if (!result.success) {
                // Clear failed action
                unit.currentAction.dispose();
                unit.currentAction = undefined;
            }
        } catch (error) {
            // Clear problematic action
            if (unit.currentAction) {
                unit.currentAction.dispose();
                unit.currentAction = undefined;
            }
        }
    }

    /**
     * Update building energy generation
     */
    private updateBuildingGeneration(building: GameBuilding, deltaTime: number): void {
        if (building.energyGeneration && building.energyGeneration > 0) {
            const energyGenerated = building.energyGeneration * deltaTime;
            this.energyManager.generateEnergy(building.id, energyGenerated, 'building_generation');
        }
    }

    /**
     * Create a new unit
     */
    public createUnit(unitType: 'worker' | 'scout' | 'protector', position: Vector3): GameUnit {
        const unitId = this.generateEntityId('unit');
        
        // Create energy storage for unit
        const storageCapacity = this.getUnitStorageCapacity(unitType);
        const energyStorage = new EnergyStorage(unitId, {
            capacity: storageCapacity,
            initialEnergy: storageCapacity // Start with full energy for immediate use
        });

        const unit: GameUnit = {
            id: unitId,
            type: 'unit',
            unitType,
            position: position.clone(),
            energyStorage,
            isActive: true,
            health: 100,
            maxHealth: 100,
            metadata: {
                createdAt: performance.now(),
                unitType
            }
        };

        this.entities.set(unitId, unit);
        this.units.set(unitId, unit);

        return unit;
    }

    /**
     * Create a new building
     */
    public createBuilding(buildingTypeId: string, position: Vector3, constructorId: string): GameBuilding {
        const buildingId = this.generateEntityId('building');
        const buildingType = BuildingAction.getBuildingType(buildingTypeId);
        
        if (!buildingType) {
            throw new Error(`Unknown building type: ${buildingTypeId}`);
        }

        // Create energy storage for building
        const energyStorage = buildingType.energyStorage ? new EnergyStorage(buildingId, {
            capacity: buildingType.energyStorage,
            initialEnergy: 0
        }) : undefined;

        const building: GameBuilding = {
            id: buildingId,
            type: 'building',
            buildingType,
            position: position.clone(),
            energyStorage,
            isActive: true,
            constructionProgress: 0,
            energyGeneration: buildingType.energyGeneration,
            metadata: {
                createdAt: performance.now(),
                constructorId,
                buildingTypeId
            }
        };

        this.entities.set(buildingId, building);
        this.buildings.set(buildingId, building);

        return building;
    }

    /**
     * Add mineral deposit to game state
     */
    public addMineralDeposit(deposit: MineralDeposit): void {
        const depositId = deposit.getId();

        const entity: GameEntity = {
            id: depositId,
            type: 'deposit',
            position: deposit.getPosition(),
            isActive: !deposit.isDepleted(),
            metadata: {
                deposit,
                biome: deposit.getBiome(),
                capacity: deposit.getCapacity()
            }
        };

        this.entities.set(depositId, entity);
        this.mineralDeposits.set(depositId, deposit);
        this.mineralDepositsArray.push(deposit);  // Keep array in sync
    }

    /**
     * Get unit storage capacity by type
     */
    private getUnitStorageCapacity(unitType: 'worker' | 'scout' | 'protector'): number {
        const capacities: { [key in 'worker' | 'scout' | 'protector']: number } = {
            worker: 50, // 5x multiplier (was 10)
            scout: 40, // 5x multiplier (was 8)
            protector: 60 // 5x multiplier (was 12)
        };
        return capacities[unitType];
    }

    /**
     * Generate unique entity ID
     */
    private generateEntityId(type: string): string {
        return `${type}_${++this.entityIdCounter}_${Date.now()}`;
    }

    /**
     * Get entity by ID
     */
    public getEntity(entityId: string): GameEntity | null {
        return this.entities.get(entityId) || null;
    }

    /**
     * Get unit by ID
     */
    public getUnit(unitId: string): GameUnit | null {
        return this.units.get(unitId) || null;
    }

    /**
     * Get building by ID
     */
    public getBuilding(buildingId: string): GameBuilding | null {
        return this.buildings.get(buildingId) || null;
    }

    /**
     * Get all units
     */
    public getAllUnits(): GameUnit[] {
        return Array.from(this.units.values());
    }

    /**
     * Get all buildings
     */
    public getAllBuildings(): GameBuilding[] {
        return Array.from(this.buildings.values());
    }

    /**
     * Add unit to game state
     */
    public addUnit(unit: any): void {
        // This will be implemented when we integrate with the existing GameState
    }

    /**
     * Remove unit from game state
     */
    public removeUnit(unitId: string): void {
        // This will be implemented when we integrate with the existing GameState
    }

    /**
     * Get mineral deposit by ID
     */
    public getMineralDeposit(depositId: string): any {
        return this.mineralDeposits.get(depositId) || null;
    }

    /**
     * Get all mineral deposits (zero allocation - returns existing array)
     */
    public getAllMineralDeposits(): MineralDeposit[] {
        return this.mineralDepositsArray;
    }

    /**
     * Get game statistics
     */
    public getGameStats(): GameStats {
        const activeUnits = Array.from(this.units.values()).filter(u => u.isActive).length;
        const completedBuildings = Array.from(this.buildings.values()).filter(b => b.constructionProgress >= 1.0).length;
        const visibleDeposits = Array.from(this.mineralDeposits.values()).filter(d => d.isVisible()).length;
        const gameTime = this.isGameActive ? (performance.now() - this.gameStartTime) / 1000 : 0;

        return {
            totalEntities: this.entities.size,
            activeUnits,
            completedBuildings,
            totalMineralDeposits: this.mineralDeposits.size,
            visibleMineralDeposits: visibleDeposits,
            totalEnergyGenerated: this.totalEnergyGenerated,
            totalEnergyConsumed: this.totalEnergyConsumed,
            currentEnergyLevel: this.energyManager.getTotalEnergy(),
            gameTime
        };
    }

    /**
     * Set game speed
     */
    public setGameSpeed(speed: number): void {
        this.gameSpeed = Math.max(0.1, Math.min(speed, 5.0)); // Clamp between 0.1x and 5x
    }

    /**
     * Pause/unpause game
     */
    public setGamePaused(paused: boolean): void {
        this.isGameActive = !paused;
    }

    /**
     * Check if game is active
     */
    public isActive(): boolean {
        return this.isGameActive;
    }

    /**
     * Get game time in seconds
     */
    public getGameTime(): number {
        return this.isGameActive ? (performance.now() - this.gameStartTime) / 1000 : 0;
    }

    /**
     * Get current energy level
     */
    public getEnergyLevel(): number {
        return this.energyManager.getTotalEnergy();
    }

    /**
     * Reset game state
     */
    public reset(): void {
        // Dispose all actions
        for (const unit of this.units.values()) {
            if (unit.currentAction) {
                unit.currentAction.dispose();
            }
            if (unit.energyStorage) {
                unit.energyStorage.dispose();
            }
        }

        for (const building of this.buildings.values()) {
            if (building.energyStorage) {
                building.energyStorage.dispose();
            }
        }

        // Clear all entities
        this.entities.clear();
        this.units.clear();
        this.buildings.clear();
        this.mineralDeposits.clear();
        this.mineralDepositsArray.length = 0;  // Clear array without allocation

        // Reset counters
        this.entityIdCounter = 0;
        this.totalEnergyGenerated = 0;
        this.totalEnergyConsumed = 0;

        // Reset energy system
        this.energyManager.reset();

        this.isGameActive = false;
    }

    /**
     * Dispose game state
     */
    public dispose(): void {
        this.reset();
        GameState.instance = null;
    }
}