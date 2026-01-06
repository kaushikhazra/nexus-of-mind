/**
 * Unit - Base unit class with energy integration and common functionality
 * 
 * Provides the foundation for all unit types with energy management, positioning,
 * action handling, and lifecycle management. Integrates seamlessly with the
 * existing energy economy system.
 */

import { Vector3 } from '@babylonjs/core';
import { EnergyStorage, EnergyStorageConfig } from '../EnergyStorage';
import { MiningAction } from '../actions/MiningAction';
import { MovementAction } from '../actions/MovementAction';
import { BuildingAction } from '../actions/BuildingAction';

export interface UnitConfig {
    unitType: 'worker' | 'scout' | 'protector';
    position: Vector3;
    energyStorage: EnergyStorageConfig;
    maxHealth?: number;
    movementSpeed?: number;
    actionCooldown?: number;
}

export interface UnitStats {
    id: string;
    unitType: string;
    position: Vector3;
    health: number;
    maxHealth: number;
    energyStorage: any;
    currentAction: string | null;
    isSelected: boolean;
    isActive: boolean;
    createdAt: number;
}

export abstract class Unit {
    protected id: string;
    protected unitType: 'worker' | 'scout' | 'protector';
    protected position: Vector3;
    protected energyStorage: EnergyStorage;
    
    // Unit properties
    protected health: number;
    protected maxHealth: number;
    protected movementSpeed: number;
    protected actionCooldown: number;
    protected lastActionTime: number = 0;
    
    // State management
    protected isActive: boolean = true;
    protected isSelected: boolean = false;
    protected createdAt: number;
    
    // Current actions
    protected currentMiningAction: MiningAction | null = null;
    protected currentMovementAction: MovementAction | null = null;
    protected currentBuildingAction: BuildingAction | null = null;
    
    // Event callbacks
    protected onDestroyedCallbacks: ((unit: Unit) => void)[] = [];
    protected onEnergyDepletedCallbacks: ((unit: Unit) => void)[] = [];
    protected onActionCompleteCallbacks: ((unit: Unit, action: string) => void)[] = [];

    constructor(config: UnitConfig) {
        this.id = this.generateUnitId(config.unitType);
        this.unitType = config.unitType;
        this.position = config.position.clone();
        this.maxHealth = config.maxHealth || 100;
        this.health = this.maxHealth;
        this.movementSpeed = config.movementSpeed || 5.0;
        this.actionCooldown = config.actionCooldown || 1.0; // 1 second default
        this.createdAt = performance.now();
        
        // Initialize energy storage
        this.energyStorage = new EnergyStorage(this.id, config.energyStorage);
        this.setupEnergyCallbacks();
        
        console.log(`👤 ${this.unitType} unit ${this.id} created at ${this.position.toString()}`);
    }

    /**
     * Generate unique unit ID
     */
    private generateUnitId(unitType: string): string {
        return `${unitType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Setup energy system callbacks
     */
    private setupEnergyCallbacks(): void {
        this.energyStorage.onEnergyDepleted(() => {
            console.warn(`⚠️ Unit ${this.id} energy depleted - stopping all actions`);
            this.stopAllActions();
            this.onEnergyDepletedCallbacks.forEach(callback => callback(this));
        });

        this.energyStorage.onLowEnergy(() => {
            console.warn(`⚠️ Unit ${this.id} low on energy`);
        });
    }

    /**
     * Update unit (called each frame)
     */
    public update(deltaTime: number): void {
        if (!this.isActive) {
            return;
        }

        // Update current actions
        this.updateActions(deltaTime);
        
        // Update energy storage
        // Energy storage updates are handled by the energy system
        
        // Check health status
        if (this.health <= 0) {
            this.destroy();
        }
    }

    /**
     * Update all active actions
     */
    private async updateActions(deltaTime: number): Promise<void> {
        // Update mining action
        if (this.currentMiningAction) {
            try {
                const result = await this.currentMiningAction.executeAction(deltaTime);
                if (!result.success) {
                    console.log(`⛏️ Mining action completed/failed for ${this.id}: ${result.reason}`);
                    this.currentMiningAction.dispose();
                    this.currentMiningAction = null;
                    this.onActionCompleteCallbacks.forEach(callback => callback(this, 'mining'));
                }
            } catch (error) {
                console.error(`❌ Mining action error for ${this.id}:`, error);
                this.stopMining();
            }
        }

        // Update movement action
        if (this.currentMovementAction) {
            try {
                const result = await this.currentMovementAction.executeAction(deltaTime);
                if (!result.success || result.reason === 'Movement completed') {
                    console.log(`🚶 Movement action completed for ${this.id}`);
                    this.position = this.currentMovementAction.getCurrentPosition();
                    this.currentMovementAction.dispose();
                    this.currentMovementAction = null;
                    this.onActionCompleteCallbacks.forEach(callback => callback(this, 'movement'));
                }
            } catch (error) {
                console.error(`❌ Movement action error for ${this.id}:`, error);
                this.stopMovement();
            }
        }

        // Update building action
        if (this.currentBuildingAction) {
            try {
                const result = await this.currentBuildingAction.executeAction(deltaTime);
                if (!result.success || result.reason === 'Construction completed') {
                    console.log(`🏗️ Building action completed for ${this.id}`);
                    this.currentBuildingAction.dispose();
                    this.currentBuildingAction = null;
                    this.onActionCompleteCallbacks.forEach(callback => callback(this, 'building'));
                }
            } catch (error) {
                console.error(`❌ Building action error for ${this.id}:`, error);
                this.stopBuilding();
            }
        }
    }

    /**
     * Check if unit can perform an action (cooldown and energy check)
     */
    protected canPerformAction(): boolean {
        const now = performance.now();
        const timeSinceLastAction = (now - this.lastActionTime) / 1000;
        
        return this.isActive && 
               this.health > 0 && 
               timeSinceLastAction >= this.actionCooldown &&
               this.energyStorage.getCurrentEnergy() > 0;
    }

    /**
     * Start mining action (if unit supports it)
     */
    public async startMining(target: any): Promise<boolean> {
        if (!this.canPerformAction() || !this.canMine()) {
            return false;
        }

        // Stop current mining if active
        this.stopMining();

        try {
            this.currentMiningAction = new MiningAction(this.id, this.position, {
                miningRange: this.getMiningRange(),
                energyPerSecond: this.getMiningEnergyCost()
            });
            
            this.currentMiningAction.setEnergyStorage(this.energyStorage);
            const result = await this.currentMiningAction.startMining(target);
            
            if (result.success) {
                this.lastActionTime = performance.now();
                console.log(`⛏️ ${this.id} started mining`);
                return true;
            } else {
                this.currentMiningAction.dispose();
                this.currentMiningAction = null;
                return false;
            }
        } catch (error) {
            console.error(`❌ Failed to start mining for ${this.id}:`, error);
            return false;
        }
    }

    /**
     * Start movement action
     */
    public async startMovement(targetPosition: Vector3): Promise<boolean> {
        if (!this.canPerformAction()) {
            return false;
        }

        // Stop current movement if active
        this.stopMovement();

        try {
            this.currentMovementAction = new MovementAction(
                this.id, 
                this.unitType, 
                this.position, 
                {
                    maxSpeed: this.movementSpeed
                }
            );
            
            this.currentMovementAction.setEnergyStorage(this.energyStorage);
            const result = await this.currentMovementAction.startMovement(targetPosition);
            
            if (result.success) {
                this.lastActionTime = performance.now();
                console.log(`🚶 ${this.id} started movement to ${targetPosition.toString()}`);
                return true;
            } else {
                this.currentMovementAction.dispose();
                this.currentMovementAction = null;
                return false;
            }
        } catch (error) {
            console.error(`❌ Failed to start movement for ${this.id}:`, error);
            return false;
        }
    }

    /**
     * Start building action (if unit supports it)
     */
    public async startBuilding(buildingType: string, position: Vector3): Promise<boolean> {
        if (!this.canPerformAction() || !this.canBuild()) {
            return false;
        }

        // Stop current building if active
        this.stopBuilding();

        try {
            this.currentBuildingAction = new BuildingAction(buildingType, position, this.id);
            const result = await this.currentBuildingAction.startConstruction();
            
            if (result.success) {
                this.lastActionTime = performance.now();
                console.log(`🏗️ ${this.id} started building ${buildingType}`);
                return true;
            } else {
                this.currentBuildingAction.dispose();
                this.currentBuildingAction = null;
                return false;
            }
        } catch (error) {
            console.error(`❌ Failed to start building for ${this.id}:`, error);
            return false;
        }
    }

    /**
     * Stop mining action
     */
    public stopMining(): void {
        if (this.currentMiningAction) {
            this.currentMiningAction.dispose();
            this.currentMiningAction = null;
            console.log(`⛏️ ${this.id} stopped mining`);
        }
    }

    /**
     * Stop movement action
     */
    public stopMovement(): void {
        if (this.currentMovementAction) {
            this.position = this.currentMovementAction.getCurrentPosition();
            this.currentMovementAction.dispose();
            this.currentMovementAction = null;
            console.log(`🚶 ${this.id} stopped movement`);
        }
    }

    /**
     * Stop building action
     */
    public stopBuilding(): void {
        if (this.currentBuildingAction) {
            this.currentBuildingAction.dispose();
            this.currentBuildingAction = null;
            console.log(`🏗️ ${this.id} stopped building`);
        }
    }

    /**
     * Stop all actions
     */
    public stopAllActions(): void {
        this.stopMining();
        this.stopMovement();
        this.stopBuilding();
    }

    /**
     * Take damage
     */
    public takeDamage(amount: number): void {
        this.health = Math.max(0, this.health - amount);
        console.log(`💥 ${this.id} took ${amount} damage (${this.health}/${this.maxHealth} health)`);
        
        if (this.health <= 0) {
            this.destroy();
        }
    }

    /**
     * Heal unit
     */
    public heal(amount: number): void {
        this.health = Math.min(this.maxHealth, this.health + amount);
        console.log(`💚 ${this.id} healed ${amount} health (${this.health}/${this.maxHealth})`);
    }

    /**
     * Set selection state
     */
    public setSelected(selected: boolean): void {
        this.isSelected = selected;
    }

    /**
     * Destroy unit
     */
    public destroy(): void {
        if (!this.isActive) {
            return;
        }

        console.log(`💀 Unit ${this.id} destroyed`);
        
        this.stopAllActions();
        this.isActive = false;
        
        this.onDestroyedCallbacks.forEach(callback => callback(this));
    }

    // Abstract methods to be implemented by subclasses
    public abstract canMine(): boolean;
    public abstract canBuild(): boolean;
    public abstract getMiningRange(): number;
    public abstract getMiningEnergyCost(): number;
    public abstract getSpecialAbilities(): string[];

    // Getters
    public getId(): string { return this.id; }
    public getUnitType(): string { return this.unitType; }
    public getPosition(): Vector3 { return this.position.clone(); }
    public getHealth(): number { return this.health; }
    public getMaxHealth(): number { return this.maxHealth; }
    public getEnergyStorage(): EnergyStorage { return this.energyStorage; }
    public isActiveUnit(): boolean { return this.isActive; }
    public isSelectedUnit(): boolean { return this.isSelected; }
    public getCreatedAt(): number { return this.createdAt; }

    /**
     * Get current action status
     */
    public getCurrentAction(): string | null {
        if (this.currentMiningAction) return 'mining';
        if (this.currentMovementAction) return 'movement';
        if (this.currentBuildingAction) return 'building';
        return null;
    }

    /**
     * Get comprehensive unit statistics
     */
    public getStats(): UnitStats {
        return {
            id: this.id,
            unitType: this.unitType,
            position: this.position.clone(),
            health: this.health,
            maxHealth: this.maxHealth,
            energyStorage: this.energyStorage.getStats(),
            currentAction: this.getCurrentAction(),
            isSelected: this.isSelected,
            isActive: this.isActive,
            createdAt: this.createdAt
        };
    }

    /**
     * Subscribe to unit destroyed events
     */
    public onDestroyed(callback: (unit: Unit) => void): void {
        this.onDestroyedCallbacks.push(callback);
    }

    /**
     * Subscribe to energy depleted events
     */
    public onEnergyDepleted(callback: (unit: Unit) => void): void {
        this.onEnergyDepletedCallbacks.push(callback);
    }

    /**
     * Subscribe to action complete events
     */
    public onActionComplete(callback: (unit: Unit, action: string) => void): void {
        this.onActionCompleteCallbacks.push(callback);
    }

    /**
     * Dispose unit and cleanup resources
     */
    public dispose(): void {
        this.stopAllActions();
        this.energyStorage.dispose();
        
        this.onDestroyedCallbacks = [];
        this.onEnergyDepletedCallbacks = [];
        this.onActionCompleteCallbacks = [];
        
        console.log(`🗑️ Unit ${this.id} disposed`);
    }
}