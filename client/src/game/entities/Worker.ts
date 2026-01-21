/**
 * Worker - Worker unit specialization with mining and building capabilities
 *
 * Workers are the backbone of resource gathering and construction. They excel at
 * mining minerals efficiently and constructing buildings, making them essential
 * for economic development and base expansion.
 */

import { Vector3 } from '@babylonjs/core';
import { Unit, UnitConfig } from './Unit';
import { GameEngine } from '../GameEngine';

// NN v2: Chunk size for spatial mapping (matches SpatialIndex chunk size)
const CHUNK_SIZE = 64;
const CHUNKS_PER_AXIS = 16; // 16x16 chunk territory = 256 chunks

export class Worker extends Unit {
    // Worker-specific properties
    private miningEfficiency: number = 1.0; // Mining speed multiplier
    private isMiningTracked: boolean = false; // NN v2: Track if registered with UnitManager
    private buildingEfficiency: number = 1.0; // Building speed multiplier
    private carryCapacity: number = 5; // Amount of resources that can be carried
    private currentCarriedResources: number = 0;

    // NN v2: Chunk tracking for observation collection
    private currentChunkId: number = -1;

    constructor(position: Vector3, config?: Partial<UnitConfig>) {
        const workerConfig: UnitConfig = {
            unitType: 'worker',
            position,
            energyStorage: {
                capacity: 50, // 5x multiplier (was 10)
                initialEnergy: 25, // 5x multiplier (was 5) - Start with 50% energy
                transferRate: 2.0,
                efficiency: 1.0
            },
            maxHealth: 60, // Fragile colonizer - not adapted to planet
            movementSpeed: 4.0, // Moderate movement speed
            actionCooldown: 0.5, // Quick action cooldown for efficiency
            ...config
        };

        super(workerConfig);
    }

    /**
     * Workers can mine minerals
     */
    public canMine(): boolean {
        return true;
    }

    /**
     * Workers can construct buildings
     */
    public canBuild(): boolean {
        return true;
    }

    /**
     * Get mining range for workers
     */
    public getMiningRange(): number {
        return 3.0; // Workers can mine within 3 units
    }

    /**
     * Get mining energy cost for workers
     */
    public getMiningEnergyCost(): number {
        return 0.4; // Slightly more efficient than base cost due to specialization
    }

    /**
     * Get worker-specific special abilities
     */
    public getSpecialAbilities(): string[] {
        return [
            'efficient_mining',
            'construction',
            'resource_carrying',
            'repair_buildings'
        ];
    }

    /**
     * Enhanced mining with efficiency bonus
     * Also notifies UnitManager for event-driven tracking (NN v2)
     */
    public async startMining(target: any): Promise<boolean> {
        const success = await super.startMining(target);

        if (success && this.currentMiningAction) {
            // Apply mining efficiency bonus

            // NN v2: Register with UnitManager for event-driven tracking
            if (!this.isMiningTracked) {
                const gameEngine = GameEngine.getInstance();
                const unitManager = gameEngine?.getUnitManager();
                if (unitManager) {
                    unitManager.onWorkerStartMining(this);
                    this.isMiningTracked = true;
                }
            }
        }

        return success;
    }

    /**
     * Stop mining action - also notifies UnitManager (NN v2)
     */
    public stopMining(): void {
        // NN v2: Unregister from UnitManager before stopping
        if (this.isMiningTracked) {
            const gameEngine = GameEngine.getInstance();
            const unitManager = gameEngine?.getUnitManager();
            if (unitManager) {
                unitManager.onWorkerStopMining(this);
            }
            this.isMiningTracked = false;
        }

        super.stopMining();
    }

    /**
     * Enhanced building with efficiency bonus
     */
    public async startBuilding(buildingType: string, position: Vector3): Promise<boolean> {
        const success = await super.startBuilding(buildingType, position);

        if (success && this.currentBuildingAction) {
            // Apply building efficiency bonus
        }

        return success;
    }

    /**
     * Repair damaged buildings (future feature)
     */
    public async startRepair(target: any): Promise<boolean> {
        if (!this.canPerformAction()) {
            return false;
        }

        // TODO: Implement repair functionality
        return false;
    }

    /**
     * Collect resources from mining or other sources
     */
    public collectResources(amount: number): boolean {
        const availableSpace = this.carryCapacity - this.currentCarriedResources;
        const actualAmount = Math.min(amount, availableSpace);

        if (actualAmount > 0) {
            this.currentCarriedResources += actualAmount;
            return true;
        }

        return false;
    }

    /**
     * Deposit carried resources
     */
    public depositResources(): number {
        const deposited = this.currentCarriedResources;
        this.currentCarriedResources = 0;

        return deposited;
    }

    /**
     * Upgrade mining efficiency
     */
    public upgradeMiningEfficiency(bonus: number): void {
        this.miningEfficiency += bonus;
    }

    /**
     * Upgrade building efficiency
     */
    public upgradeBuildingEfficiency(bonus: number): void {
        this.buildingEfficiency += bonus;
    }

    /**
     * Upgrade carry capacity
     */
    public upgradeCarryCapacity(bonus: number): void {
        this.carryCapacity += bonus;
    }

    /**
     * Get worker-specific statistics
     */
    public getWorkerStats(): any {
        const baseStats = this.getStats();
        return {
            ...baseStats,
            miningEfficiency: this.miningEfficiency,
            buildingEfficiency: this.buildingEfficiency,
            carryCapacity: this.carryCapacity,
            currentCarriedResources: this.currentCarriedResources,
            resourceUtilization: this.currentCarriedResources / this.carryCapacity
        };
    }

    /**
     * Check if worker is carrying resources
     */
    public isCarryingResources(): boolean {
        return this.currentCarriedResources > 0;
    }

    /**
     * Check if worker is at full capacity
     */
    public isAtFullCapacity(): boolean {
        return this.currentCarriedResources >= this.carryCapacity;
    }

    /**
     * Get available carry space
     */
    public getAvailableCarrySpace(): number {
        return this.carryCapacity - this.currentCarriedResources;
    }

    // ==================== NN v2: Chunk Tracking ====================

    /**
     * Calculate chunk ID from world position
     * Chunk grid: 16x16 (256 chunks), each chunk 64x64 units
     * @param x World X position
     * @param z World Z position
     * @returns Chunk ID (0-255) or -1 if out of bounds
     */
    private calculateChunkId(x: number, z: number): number {
        // Convert to chunk coordinates (floor division)
        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkZ = Math.floor(z / CHUNK_SIZE);

        // Bounds check (0-15 for both axes)
        if (chunkX < 0 || chunkX >= CHUNKS_PER_AXIS ||
            chunkZ < 0 || chunkZ >= CHUNKS_PER_AXIS) {
            return -1; // Out of bounds
        }

        // Calculate flat chunk ID: z * width + x
        return chunkZ * CHUNKS_PER_AXIS + chunkX;
    }

    /**
     * Get current chunk ID
     * @returns Chunk ID (0-255) or -1 if not in valid chunk
     */
    public getChunkId(): number {
        return this.currentChunkId;
    }

    /**
     * Update chunk ID based on current position
     * Called in update loop
     */
    private updateChunkId(): void {
        const pos = this.getPosition();
        this.currentChunkId = this.calculateChunkId(pos.x, pos.z);
    }

    /**
     * Worker-specific update logic
     */
    public update(deltaTime: number): void {
        super.update(deltaTime);

        // NN v2: Update chunk ID for observation tracking
        this.updateChunkId();

        // Worker-specific update logic can be added here
        // For example: automatic resource collection, efficiency bonuses, etc.
    }

    /**
     * Enhanced dispose with worker-specific cleanup
     */
    public dispose(): void {
        // NN v2: Ensure we're unregistered from mining tracking
        if (this.isMiningTracked) {
            const gameEngine = GameEngine.getInstance();
            const unitManager = gameEngine?.getUnitManager();
            if (unitManager) {
                unitManager.onWorkerStopMining(this);
            }
            this.isMiningTracked = false;
        }

        // Drop any carried resources
        super.dispose();
    }
}
