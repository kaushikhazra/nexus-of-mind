/**
 * Building - Building entity with energy generation and storage capabilities
 *
 * Represents constructed buildings in the game world with 3D visualization,
 * energy generation/storage, and integration with the unit and energy systems.
 */

import { Vector3 } from '@babylonjs/core';
import { EnergyStorage, EnergyStorageConfig } from '../EnergyStorage';
import { BuildingType } from '../actions/BuildingAction';

export interface BuildingStats {
    id: string;
    buildingType: string;
    position: Vector3;
    constructionProgress: number;
    isComplete: boolean;
    energyStorage: any;
    energyGeneration: number;
    health: number;
    maxHealth: number;
    createdAt: number;
}

export class Building {
    private id: string;
    private buildingType: BuildingType;
    private position: Vector3;
    private energyStorage: EnergyStorage | null = null;

    // Building properties
    private constructionProgress: number = 0; // 0-1, 1 = complete
    private health: number;
    private maxHealth: number;
    private energyGeneration: number = 0; // Energy per second
    private createdAt: number;

    // State management
    private isActive: boolean = true;
    private constructorId: string;

    // Event callbacks
    private onCompletedCallbacks: ((building: Building) => void)[] = [];
    private onDestroyedCallbacks: ((building: Building) => void)[] = [];
    private onEnergyGeneratedCallbacks: ((building: Building, amount: number) => void)[] = [];

    constructor(buildingType: BuildingType, position: Vector3, constructorId: string) {
        this.id = this.generateBuildingId(buildingType.id);
        this.buildingType = buildingType;
        this.position = position.clone();
        this.constructorId = constructorId;
        this.maxHealth = 200; // Buildings are sturdy
        this.health = this.maxHealth;
        this.energyGeneration = buildingType.energyGeneration || 0;
        this.createdAt = performance.now();

        // Initialize energy storage if building has storage capacity
        if (buildingType.energyStorage && buildingType.energyStorage > 0) {
            const storageConfig: EnergyStorageConfig = {
                capacity: buildingType.energyStorage,
                initialEnergy: 0,
                transferRate: 5.0, // Buildings have good transfer rates
                efficiency: 1.0 // Perfect efficiency for buildings
            };

            this.energyStorage = new EnergyStorage(this.id, storageConfig);
        }
    }

    /**
     * Generate unique building ID
     */
    private generateBuildingId(buildingType: string): string {
        return `building_${buildingType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Update building (called each frame)
     * Note: Energy generation is handled by BuildingManager using materials
     */
    public update(deltaTime: number): void {
        if (!this.isActive) {
            return;
        }

        // Check health status
        if (this.health <= 0) {
            this.destroy();
        }
    }

    /**
     * Set construction progress
     */
    public setConstructionProgress(progress: number): void {
        this.constructionProgress = Math.max(0, Math.min(1, progress));

        if (this.constructionProgress >= 1.0 && !this.isComplete()) {
            this.completeConstruction();
        }
    }

    /**
     * Complete construction
     */
    private completeConstruction(): void {
        this.constructionProgress = 1.0;

        this.onCompletedCallbacks.forEach(callback => callback(this));
    }

    /**
     * Take damage
     */
    public takeDamage(amount: number): void {
        this.health = Math.max(0, this.health - amount);

        if (this.health <= 0) {
            this.destroy();
        }
    }

    /**
     * Repair building
     */
    public repair(amount: number): void {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    /**
     * Destroy building
     */
    public destroy(): void {
        if (!this.isActive) {
            return;
        }

        this.isActive = false;
        this.onDestroyedCallbacks.forEach(callback => callback(this));
    }

    /**
     * Check if construction is complete
     */
    public isComplete(): boolean {
        return this.constructionProgress >= 1.0;
    }

    /**
     * Check if building is active
     */
    public isActiveBuilding(): boolean {
        return this.isActive;
    }

    /**
     * Get building statistics
     */
    public getStats(): BuildingStats {
        return {
            id: this.id,
            buildingType: this.buildingType.name,
            position: this.position.clone(),
            constructionProgress: this.constructionProgress,
            isComplete: this.isComplete(),
            energyStorage: this.energyStorage?.getStats() || null,
            energyGeneration: this.energyGeneration,
            health: this.health,
            maxHealth: this.maxHealth,
            createdAt: this.createdAt
        };
    }

    // Getters
    public getId(): string { return this.id; }
    public getBuildingType(): BuildingType { return this.buildingType; }
    public getPosition(): Vector3 { return this.position.clone(); }
    public getConstructionProgress(): number { return this.constructionProgress; }
    public getHealth(): number { return this.health; }
    public getMaxHealth(): number { return this.maxHealth; }
    public getEnergyStorage(): EnergyStorage | null { return this.energyStorage; }
    public getEnergyGeneration(): number { return this.energyGeneration; }
    public getConstructorId(): string { return this.constructorId; }
    public getCreatedAt(): number { return this.createdAt; }

    /**
     * Subscribe to completion events
     */
    public onCompleted(callback: (building: Building) => void): void {
        this.onCompletedCallbacks.push(callback);
    }

    /**
     * Subscribe to destruction events
     */
    public onDestroyed(callback: (building: Building) => void): void {
        this.onDestroyedCallbacks.push(callback);
    }

    /**
     * Subscribe to energy generation events
     */
    public onEnergyGenerated(callback: (building: Building, amount: number) => void): void {
        this.onEnergyGeneratedCallbacks.push(callback);
    }

    /**
     * Dispose building and cleanup resources
     */
    public dispose(): void {
        this.energyStorage?.dispose();

        this.onCompletedCallbacks = [];
        this.onDestroyedCallbacks = [];
        this.onEnergyGeneratedCallbacks = [];
    }
}
