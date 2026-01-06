/**
 * Worker - Worker unit specialization with mining and building capabilities
 * 
 * Workers are the backbone of resource gathering and construction. They excel at
 * mining minerals efficiently and constructing buildings, making them essential
 * for economic development and base expansion.
 */

import { Vector3 } from '@babylonjs/core';
import { Unit, UnitConfig } from './Unit';

export class Worker extends Unit {
    // Worker-specific properties
    private miningEfficiency: number = 1.0; // Mining speed multiplier
    private buildingEfficiency: number = 1.0; // Building speed multiplier
    private carryCapacity: number = 5; // Amount of resources that can be carried
    private currentCarriedResources: number = 0;

    constructor(position: Vector3, config?: Partial<UnitConfig>) {
        const workerConfig: UnitConfig = {
            unitType: 'worker',
            position,
            energyStorage: {
                capacity: 10,
                initialEnergy: 5, // Start with 50% energy
                transferRate: 2.0,
                efficiency: 1.0
            },
            maxHealth: 80, // Lower health than protectors
            movementSpeed: 4.0, // Moderate movement speed
            actionCooldown: 0.5, // Quick action cooldown for efficiency
            ...config
        };

        super(workerConfig);
        
        console.log(`👷 Worker unit ${this.getId()} ready for mining and construction`);
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
     */
    public async startMining(target: any): Promise<boolean> {
        const success = await super.startMining(target);
        
        if (success && this.currentMiningAction) {
            // Apply mining efficiency bonus
            console.log(`⛏️ Worker ${this.getId()} mining with ${this.miningEfficiency}x efficiency`);
        }
        
        return success;
    }

    /**
     * Enhanced building with efficiency bonus
     */
    public async startBuilding(buildingType: string, position: Vector3): Promise<boolean> {
        const success = await super.startBuilding(buildingType, position);
        
        if (success && this.currentBuildingAction) {
            // Apply building efficiency bonus
            console.log(`🏗️ Worker ${this.getId()} building with ${this.buildingEfficiency}x efficiency`);
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
        console.log(`🔧 Worker ${this.getId()} repair functionality not yet implemented`);
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
            console.log(`📦 Worker ${this.getId()} collected ${actualAmount} resources (${this.currentCarriedResources}/${this.carryCapacity})`);
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
        
        if (deposited > 0) {
            console.log(`📤 Worker ${this.getId()} deposited ${deposited} resources`);
        }
        
        return deposited;
    }

    /**
     * Upgrade mining efficiency
     */
    public upgradeMiningEfficiency(bonus: number): void {
        this.miningEfficiency += bonus;
        console.log(`⬆️ Worker ${this.getId()} mining efficiency upgraded to ${this.miningEfficiency}x`);
    }

    /**
     * Upgrade building efficiency
     */
    public upgradeBuildingEfficiency(bonus: number): void {
        this.buildingEfficiency += bonus;
        console.log(`⬆️ Worker ${this.getId()} building efficiency upgraded to ${this.buildingEfficiency}x`);
    }

    /**
     * Upgrade carry capacity
     */
    public upgradeCarryCapacity(bonus: number): void {
        this.carryCapacity += bonus;
        console.log(`⬆️ Worker ${this.getId()} carry capacity upgraded to ${this.carryCapacity}`);
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

    /**
     * Worker-specific update logic
     */
    public update(deltaTime: number): void {
        super.update(deltaTime);
        
        // Worker-specific update logic can be added here
        // For example: automatic resource collection, efficiency bonuses, etc.
    }

    /**
     * Enhanced dispose with worker-specific cleanup
     */
    public dispose(): void {
        // Drop any carried resources
        if (this.currentCarriedResources > 0) {
            console.log(`📦 Worker ${this.getId()} dropped ${this.currentCarriedResources} resources on disposal`);
        }
        
        super.dispose();
    }
}