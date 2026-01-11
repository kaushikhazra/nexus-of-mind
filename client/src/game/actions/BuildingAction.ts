/**
 * BuildingAction - Building construction with energy costs
 * 
 * Implements energy consumption for building construction with reservation system,
 * progress tracking, and integration with the energy storage system.
 */

import { Vector3 } from '@babylonjs/core';
import { EnergyConsumer, EnergyConsumptionResult, EnergyConsumerConfig } from '../EnergyConsumer';

export interface BuildingType {
    id: string;
    name: string;
    energyCost: number;
    constructionTime: number; // seconds
    energyStorage?: number; // energy storage capacity when built
    energyGeneration?: number; // energy generation per second
}

export interface BuildingActionConfig extends EnergyConsumerConfig {
    buildingType: BuildingType;
    position: Vector3;
    constructorId: string;
}

export class BuildingAction extends EnergyConsumer {
    private buildingConfig: BuildingActionConfig;
    private buildingType: BuildingType;
    private position: Vector3;
    private constructorId: string;
    
    // Construction state
    private isConstructing: boolean = false;
    private constructionStartTime: number = 0;
    private constructionProgress: number = 0; // 0-1
    private energyInvested: number = 0;
    
    // Building types registry
    public static readonly BUILDING_TYPES: { [key: string]: BuildingType } = {
        base: {
            id: 'base',
            name: 'Base',
            energyCost: 50,
            constructionTime: 10, // 10 seconds
            energyStorage: 100
        },
        powerPlant: {
            id: 'powerPlant',
            name: 'Power Plant',
            energyCost: 30,
            constructionTime: 8, // 8 seconds
            energyStorage: 1000,
            energyGeneration: 2.0 // 2 energy per second
        }
    };

    constructor(buildingTypeId: string, position: Vector3, constructorId: string, config?: Partial<EnergyConsumerConfig>) {
        const buildingType = BuildingAction.BUILDING_TYPES[buildingTypeId];
        if (!buildingType) {
            throw new Error(`Unknown building type: ${buildingTypeId}`);
        }

        const buildingConfig: BuildingActionConfig = {
            baseCost: buildingType.energyCost,
            requiresReservation: true,
            canPartialExecute: false,
            buildingType,
            position: position.clone(),
            constructorId,
            ...config
        };

        super(constructorId, `building_${buildingType.name}`, buildingConfig);
        this.buildingConfig = buildingConfig;
        this.buildingType = buildingType;
        this.position = position.clone();
        this.constructorId = constructorId;
    }

    /**
     * Calculate total energy cost for building
     */
    public calculateEnergyCost(): number {
        return this.buildingType.energyCost * (this.config.costMultiplier || 1);
    }

    /**
     * Start building construction
     */
    public async startConstruction(): Promise<EnergyConsumptionResult> {
        if (this.isConstructing) {
            return this.createResult(false, 0, 0, 'Already constructing');
        }

        const totalCost = this.calculateEnergyCost();

        // Check if we have enough energy
        if (!this.canExecute()) {
            return this.createResult(false, 0, totalCost, 'Insufficient energy for construction');
        }

        // Reserve energy for construction
        if (!this.reserveEnergy(totalCost)) {
            return this.createResult(false, 0, totalCost, 'Failed to reserve energy for construction');
        }

        // Start construction
        this.isConstructing = true;
        this.constructionStartTime = performance.now();
        this.constructionProgress = 0;
        this.energyInvested = 0;

        return this.createResult(true, 0, totalCost);
    }

    /**
     * Execute construction progress (called each frame/update) - INSTANT COMPLETION
     */
    public async executeAction(deltaTime: number = 1.0): Promise<EnergyConsumptionResult> {
        if (!this.isConstructing) {
            return this.createResult(false, 0, 0, 'Not currently constructing');
        }

        // INSTANT CONSTRUCTION - complete immediately
        const totalCost = this.calculateEnergyCost();

        // Use all reserved energy at once
        if (!this.useReservedEnergy(totalCost)) {
            this.cancelConstruction();
            return this.createResult(false, 0, totalCost, 'Insufficient reserved energy');
        }

        // Set to complete immediately
        this.constructionProgress = 1.0;
        this.energyInvested = totalCost;

        // Complete construction immediately
        this.completeConstruction();
        return this.createResult(true, totalCost, totalCost, 'Construction completed instantly');
    }

    /**
     * Complete building construction
     */
    private completeConstruction(): void {
        this.isConstructing = false;

        // Release any remaining reserved energy (should be minimal)
        this.releaseReservedEnergy();
    }

    /**
     * Cancel construction and refund energy
     */
    public cancelConstruction(): void {
        if (!this.isConstructing) {
            return;
        }

        // Release reserved energy (automatic refund)
        this.releaseReservedEnergy();

        this.isConstructing = false;
        this.constructionProgress = 0;
        this.energyInvested = 0;
    }

    /**
     * Check if construction is active
     */
    public isConstructionActive(): boolean {
        return this.isConstructing;
    }

    /**
     * Get construction progress (0-1)
     */
    public getConstructionProgress(): number {
        return this.constructionProgress;
    }

    /**
     * Get building type
     */
    public getBuildingType(): BuildingType {
        return { ...this.buildingType };
    }

    /**
     * Get construction position
     */
    public getPosition(): Vector3 {
        return this.position.clone();
    }

    /**
     * Get constructor entity ID
     */
    public getConstructorId(): string {
        return this.constructorId;
    }

    /**
     * Get energy invested so far
     */
    public getEnergyInvested(): number {
        return this.energyInvested;
    }

    /**
     * Get estimated completion time
     */
    public getEstimatedCompletionTime(): number {
        if (!this.isConstructing) {
            return 0;
        }

        const elapsedTime = (performance.now() - this.constructionStartTime) / 1000;
        const remainingTime = this.buildingType.constructionTime - elapsedTime;
        return Math.max(0, remainingTime);
    }

    /**
     * Get construction statistics
     */
    public getConstructionStats(): {
        isActive: boolean;
        buildingType: string;
        progress: number;
        energyInvested: number;
        totalCost: number;
        estimatedCompletion: number;
        position: Vector3;
    } {
        return {
            isActive: this.isConstructing,
            buildingType: this.buildingType.name,
            progress: this.constructionProgress,
            energyInvested: this.energyInvested,
            totalCost: this.calculateEnergyCost(),
            estimatedCompletion: this.getEstimatedCompletionTime(),
            position: this.position.clone()
        };
    }

    /**
     * Get all available building types
     */
    public static getAvailableBuildingTypes(): BuildingType[] {
        return Object.values(BuildingAction.BUILDING_TYPES);
    }

    /**
     * Get building type by ID
     */
    public static getBuildingType(id: string): BuildingType | null {
        return BuildingAction.BUILDING_TYPES[id] || null;
    }

    /**
     * Dispose building action
     */
    public dispose(): void {
        this.cancelConstruction();
        super.dispose();
    }
}