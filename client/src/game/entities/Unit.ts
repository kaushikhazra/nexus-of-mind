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

    // Flee/danger management
    protected lastFleeTime: number = 0;
    protected fleeImmunityDuration: number = 10000; // 10 seconds immunity after fleeing

    // Current actions
    protected currentMiningAction: MiningAction | null = null;
    protected currentMovementAction: MovementAction | null = null;
    protected currentBuildingAction: BuildingAction | null = null;

    // Pending actions (for chaining movement -> action)
    protected pendingMiningTarget: any = null;

    // Terrain following
    protected terrainGenerator: any = null; // TerrainGenerator for height detection

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
            this.stopAllActions();
            this.onEnergyDepletedCallbacks.forEach(callback => callback(this));
        });

        this.energyStorage.onLowEnergy(() => {
            // If energy is critically low (< 10%), try to flee to safety
            const currentEnergy = this.energyStorage.getCurrentEnergy();
            const maxEnergy = this.energyStorage.getCapacity();
            if (currentEnergy < maxEnergy * 0.1) { // 10% critical threshold
                // Flee to a random safe direction (no specific danger source)
                const randomDirection = new Vector3(
                    (Math.random() - 0.5) * 2,
                    0, // Keep Y at 0 for ground level
                    (Math.random() - 0.5) * 2
                ).normalize();
                const safeTarget = this.position.add(randomDirection.scale(15));

                // Set proper terrain height
                const terrainHeight = this.getTerrainHeight(safeTarget.x, safeTarget.z);
                safeTarget.y = terrainHeight + 1.0; // Increased unit height above terrain

                this.startMovement(safeTarget);
            }
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

        // Update position to follow terrain height
        this.updateTerrainHeight();

        // Update energy storage
        // Energy storage updates are handled by the energy system

        // Passive energy recovery when safe
        this.updateEnergyRecovery(deltaTime);

        // Check health status
        if (this.health <= 0) {
            this.destroy();
        }
    }

    /**
     * Passive energy recovery when unit is safe
     */
    private updateEnergyRecovery(deltaTime: number): void {
        const currentEnergy = this.energyStorage.getCurrentEnergy();
        const maxEnergy = this.energyStorage.getCapacity();

        // Only recover if energy is low and unit is not actively doing energy-consuming actions
        if (currentEnergy < maxEnergy * 0.8 && !this.currentMiningAction && !this.currentBuildingAction) {
            const recoveryRate = 0.5; // 0.5 energy per second recovery
            const recoveryAmount = recoveryRate * deltaTime;

            if (this.energyStorage.canReceiveEnergy(recoveryAmount)) {
                this.energyStorage.addEnergy(recoveryAmount, 'passive_recovery');
            }
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
                    this.currentMiningAction.dispose();
                    this.currentMiningAction = null;
                    this.onActionCompleteCallbacks.forEach(callback => callback(this, 'mining'));
                }
            } catch (error) {
                this.stopMining();
            }
        }

        // Update movement action
        if (this.currentMovementAction) {
            try {
                const result = await this.currentMovementAction.executeAction(deltaTime);

                // Update position during movement for smooth visuals
                this.position = this.currentMovementAction.getCurrentPosition();

                // Ensure terrain following during movement
                this.updateTerrainHeight();

                if (!result.success || result.reason === 'Movement completed') {
                    this.currentMovementAction.dispose();
                    this.currentMovementAction = null;

                    // Check if there's a pending mining target
                    if (this.pendingMiningTarget) {
                        const miningTarget = this.pendingMiningTarget;
                        this.pendingMiningTarget = null;

                        // Start mining now that we're in position
                        this.startMiningImmediate(miningTarget);
                    }

                    this.onActionCompleteCallbacks.forEach(callback => callback(this, 'movement'));
                }
            } catch (error) {
                this.stopMovement();
            }
        }

        // Update building action
        if (this.currentBuildingAction) {
            try {
                const result = await this.currentBuildingAction.executeAction(deltaTime);
                if (!result.success || result.reason === 'Construction completed') {
                    this.currentBuildingAction.dispose();
                    this.currentBuildingAction = null;
                    this.onActionCompleteCallbacks.forEach(callback => callback(this, 'building'));
                }
            } catch (error) {
                this.stopBuilding();
            }
        }
    }

    /**
     * Start mining immediately (used after movement to target)
     */
    private async startMiningImmediate(target: any): Promise<boolean> {
        try {
            // Check if we're close enough to mine
            const distance = Vector3.Distance(this.position, target.getPosition());
            const miningRange = this.getMiningRange();

            if (distance > miningRange) {
                // Still too far - move closer and try again
                // Start another movement toward the target
                const moveSuccess = await this.startMovementForMining(target);
                if (moveSuccess) {
                    // Keep the pending mining target so we try again after this movement
                    this.pendingMiningTarget = target;
                    return true;
                } else {
                    return false;
                }
            }

            // We're close enough - start mining
            this.currentMiningAction = new MiningAction(this.id, this.position, {
                miningRange: this.getMiningRange(),
                energyPerSecond: this.getMiningEnergyCost()
            });

            this.currentMiningAction.setEnergyStorage(this.energyStorage);
            this.currentMiningAction.updatePosition(this.position);

            const result = await this.currentMiningAction.startMining(target);

            if (result.success) {
                this.lastActionTime = performance.now();
                return true;
            } else {
                this.currentMiningAction.dispose();
                this.currentMiningAction = null;
                return false;
            }
        } catch (error) {
            return false;
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
     * Check if unit can move (basic movement capability without cooldown)
     */
    public canMove(): boolean {
        return this.isActive &&
               this.health > 0 &&
               this.energyStorage.getCurrentEnergy() > 0;
    }

    /**
     * Start mining action (if unit supports it) - includes movement to target
     */
    public async startMining(target: any): Promise<boolean> {
        if (!this.canMine()) {
            return false;
        }

        // Stop current mining if active
        this.stopMining();

        try {
            // Check if target is within mining range
            const distance = Vector3.Distance(this.position, target.getPosition());
            const miningRange = this.getMiningRange();

            // Calculate energy cost for the journey
            const energyCostPerUnit = 0; // No energy cost for movement (testing configuration)
            const estimatedEnergyCost = distance * energyCostPerUnit;
            const currentEnergy = this.energyStorage.getCurrentEnergy();

            if (distance > miningRange) {
                // Target is too far - move closer first
                // Start range-based movement - worker will stop when within mining range
                const moveSuccess = await this.startMovementForMining(target);

                if (!moveSuccess) {
                    return false;
                }

                // Set a flag to start mining when movement completes
                this.pendingMiningTarget = target;
                return true;
            }

            // Target is within range - start mining immediately
            this.currentMiningAction = new MiningAction(this.id, this.position, {
                miningRange: this.getMiningRange(),
                energyPerSecond: this.getMiningEnergyCost()
            });

            this.currentMiningAction.setEnergyStorage(this.energyStorage);

            // Update the mining action's position to current position
            this.currentMiningAction.updatePosition(this.position);

            const result = await this.currentMiningAction.startMining(target);

            if (result.success) {
                this.lastActionTime = performance.now();
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
     * Start movement action for mining (bypasses cooldown)
     */
    public async startMovementForMining(target: any): Promise<boolean> {
        // Only check if unit can move, skip cooldown check for mining movement
        if (!this.canMove()) {
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

            // Use range-based movement - stop when within mining range
            const result = await this.currentMovementAction.startMovementToRange(target, this.getMiningRange() * 0.9);

            if (result.success) {
                return true;
            } else {
                this.currentMovementAction.dispose();
                this.currentMovementAction = null;
                return false;
            }
        } catch (error) {
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
                return true;
            } else {
                this.currentMovementAction.dispose();
                this.currentMovementAction = null;
                return false;
            }
        } catch (error) {
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
                return true;
            } else {
                this.currentBuildingAction.dispose();
                this.currentBuildingAction = null;
                return false;
            }
        } catch (error) {
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
        }

        // Clear pending mining target
        if (this.pendingMiningTarget) {
            this.pendingMiningTarget = null;
        }
    }

    /**
     * Stop movement action
     */
    public stopMovement(): void {
        if (this.currentMovementAction) {
            this.position = this.currentMovementAction.getCurrentPosition();

            // Ensure terrain following when stopping
            this.updateTerrainHeight();

            this.currentMovementAction.dispose();
            this.currentMovementAction = null;
        }
    }

    /**
     * Stop building action
     */
    public stopBuilding(): void {
        if (this.currentBuildingAction) {
            this.currentBuildingAction.dispose();
            this.currentBuildingAction = null;
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

        if (this.health <= 0) {
            this.destroy();
        }
    }

    /**
     * Heal unit
     */
    public heal(amount: number): void {
        this.health = Math.min(this.maxHealth, this.health + amount);
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

    /**
     * Drain energy from this unit (used by parasites)
     */
    public drainEnergy(amount: number, reason: string): number {
        return this.energyStorage.drainEnergy(amount, reason);
    }

    /**
     * Make unit flee from danger (used when energy is low or under attack)
     */
    public fleeFromDanger(dangerPosition: Vector3, fleeDistance: number = 20): void {
        // Stop all current actions
        this.stopAllActions();

        // Calculate flee direction (away from danger)
        const fleeDirection = this.position.subtract(dangerPosition).normalize();
        const fleeTarget = this.position.add(fleeDirection.scale(fleeDistance));

        // Set proper terrain height for flee target
        const terrainHeight = this.getTerrainHeight(fleeTarget.x, fleeTarget.z);
        fleeTarget.y = terrainHeight + 1.0; // Increased unit height above terrain

        // Start movement away from danger
        this.startMovement(fleeTarget);

        // Set flee immunity
        this.lastFleeTime = Date.now();
    }

    /**
     * Check if unit can be targeted by parasites (not recently fled)
     */
    public canBeTargetedByParasites(): boolean {
        const timeSinceFlee = Date.now() - this.lastFleeTime;
        const isImmune = timeSinceFlee < this.fleeImmunityDuration;

        return !isImmune && this.isActive && this.health > 0;
    }

    /**
     * Set terrain generator for height detection
     */
    public setTerrainGenerator(terrainGenerator: any): void {
        this.terrainGenerator = terrainGenerator;
    }

    /**
     * Get terrain height at position
     */
    protected getTerrainHeight(x: number, z: number): number {
        if (this.terrainGenerator) {
            return this.terrainGenerator.getHeightAtPosition(x, z);
        }
        return 0.5; // Default height if no terrain generator
    }

    /**
     * Update position to follow terrain height
     */
    protected updateTerrainHeight(): void {
        if (this.terrainGenerator) {
            const terrainHeight = this.getTerrainHeight(this.position.x, this.position.z);
            const newY = terrainHeight + 1.0; // 1.0 unit above terrain

            // Only update if there's a significant difference to avoid jitter
            if (Math.abs(this.position.y - newY) > 0.05) {
                this.position.y = newY;
            }
        } else {
            // Fallback if no terrain generator
            if (this.position.y < 1.0) {
                this.position.y = 1.0;
            }
        }
    }
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
    }
}
