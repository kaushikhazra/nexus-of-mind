/**
 * EnergyConsumer - Interface and base class for energy-consuming actions
 * 
 * Provides consistent interface for all actions that consume energy,
 * with validation, cost calculation, and integration with energy storage.
 */

import { EnergyStorage } from './EnergyStorage';
import { EnergyManager } from './EnergyManager';

export interface EnergyConsumerConfig {
    baseCost: number;
    costPerSecond?: number;
    costMultiplier?: number;
    requiresReservation?: boolean;
    canPartialExecute?: boolean;
}

export interface EnergyConsumptionResult {
    success: boolean;
    energyConsumed: number;
    energyRequired: number;
    reason?: string;
    canRetry: boolean;
}

export abstract class EnergyConsumer {
    protected entityId: string;
    protected actionName: string;
    protected config: EnergyConsumerConfig;
    protected energyManager: EnergyManager;
    protected energyStorage: EnergyStorage | null = null;
    
    // Reservation system for multi-step actions
    protected reservedEnergy: number = 0;
    protected reservationId: string | null = null;

    constructor(entityId: string, actionName: string, config: EnergyConsumerConfig) {
        this.entityId = entityId;
        this.actionName = actionName;
        this.config = config;
        this.energyManager = EnergyManager.getInstance();
    }

    /**
     * Set energy storage for this consumer
     */
    public setEnergyStorage(storage: EnergyStorage): void {
        this.energyStorage = storage;
    }

    /**
     * Calculate energy cost for this action
     */
    public abstract calculateEnergyCost(...args: any[]): number;

    /**
     * Execute the energy-consuming action
     */
    public abstract executeAction(...args: any[]): Promise<EnergyConsumptionResult>;

    /**
     * Validate if action can be executed with current energy
     */
    public canExecute(...args: any[]): boolean {
        const requiredEnergy = this.calculateEnergyCost(...args);
        
        if (this.energyStorage) {
            return this.energyStorage.hasEnergy(requiredEnergy);
        } else {
            return this.energyManager.canConsumeEnergy(this.entityId, requiredEnergy);
        }
    }

    /**
     * Reserve energy for multi-step actions
     */
    protected reserveEnergy(amount: number): boolean {
        if (this.reservedEnergy > 0) {
            console.warn(`⚠️ Energy already reserved for ${this.actionName}: ${this.reservedEnergy}`);
            return false;
        }

        if (!this.canExecute()) {
            console.warn(`⚠️ Cannot reserve energy for ${this.actionName}: insufficient energy`);
            return false;
        }

        if (this.energyStorage) {
            if (this.energyStorage.removeEnergy(amount, `reserve_${this.actionName}`)) {
                this.reservedEnergy = amount;
                this.reservationId = `reserve_${this.entityId}_${Date.now()}`;
                return true;
            }
        } else {
            if (this.energyManager.consumeEnergy(this.entityId, amount, `reserve_${this.actionName}`)) {
                this.reservedEnergy = amount;
                this.reservationId = `reserve_${this.entityId}_${Date.now()}`;
                return true;
            }
        }

        return false;
    }

    /**
     * Use reserved energy
     */
    protected useReservedEnergy(amount: number): boolean {
        if (this.reservedEnergy < amount) {
            console.warn(`⚠️ Insufficient reserved energy for ${this.actionName}: need ${amount}, have ${this.reservedEnergy}`);
            return false;
        }

        this.reservedEnergy -= amount;

        return true;
    }

    /**
     * Release reserved energy (refund unused energy)
     */
    protected releaseReservedEnergy(): void {
        if (this.reservedEnergy > 0) {
            if (this.energyStorage) {
                this.energyStorage.addEnergy(this.reservedEnergy, `refund_${this.actionName}`);
            } else {
                this.energyManager.generateEnergy(this.entityId, this.reservedEnergy, `refund_${this.actionName}`);
            }

            this.reservedEnergy = 0;
            this.reservationId = null;
        }
    }

    /**
     * Consume energy from storage or global system
     */
    protected consumeEnergy(amount: number, purpose: string): boolean {
        if (this.energyStorage) {
            return this.energyStorage.removeEnergy(amount, purpose);
        } else {
            return this.energyManager.consumeEnergy(this.entityId, amount, purpose);
        }
    }

    /**
     * Get current energy availability
     */
    protected getCurrentEnergy(): number {
        if (this.energyStorage) {
            return this.energyStorage.getCurrentEnergy();
        } else {
            return this.energyManager.getTotalEnergy();
        }
    }

    /**
     * Create consumption result
     */
    protected createResult(
        success: boolean, 
        energyConsumed: number, 
        energyRequired: number, 
        reason?: string
    ): EnergyConsumptionResult {
        return {
            success,
            energyConsumed,
            energyRequired,
            reason,
            canRetry: !success && this.getCurrentEnergy() >= energyRequired
        };
    }

    /**
     * Get action configuration
     */
    public getConfig(): EnergyConsumerConfig {
        return { ...this.config };
    }

    /**
     * Get entity ID
     */
    public getEntityId(): string {
        return this.entityId;
    }

    /**
     * Get action name
     */
    public getActionName(): string {
        return this.actionName;
    }

    /**
     * Get reserved energy amount
     */
    public getReservedEnergy(): number {
        return this.reservedEnergy;
    }

    /**
     * Dispose consumer and release any reserved energy
     */
    public dispose(): void {
        this.releaseReservedEnergy();
    }
}

/**
 * Simple energy consumer for basic actions
 */
export class SimpleEnergyConsumer extends EnergyConsumer {
    constructor(entityId: string, actionName: string, config: EnergyConsumerConfig) {
        super(entityId, actionName, config);
    }

    /**
     * Calculate energy cost (simple fixed cost)
     */
    public calculateEnergyCost(): number {
        return this.config.baseCost * (this.config.costMultiplier || 1);
    }

    /**
     * Execute simple energy consumption
     */
    public async executeAction(): Promise<EnergyConsumptionResult> {
        const requiredEnergy = this.calculateEnergyCost();
        
        if (!this.canExecute()) {
            return this.createResult(
                false, 
                0, 
                requiredEnergy, 
                'Insufficient energy'
            );
        }

        if (this.consumeEnergy(requiredEnergy, this.actionName)) {
            return this.createResult(true, requiredEnergy, requiredEnergy);
        } else {
            return this.createResult(
                false, 
                0, 
                requiredEnergy, 
                'Energy consumption failed'
            );
        }
    }
}

/**
 * Continuous energy consumer for ongoing actions
 */
export class ContinuousEnergyConsumer extends EnergyConsumer {
    private isActive: boolean = false;
    private consumptionInterval: number | null = null;
    private totalConsumed: number = 0;

    constructor(entityId: string, actionName: string, config: EnergyConsumerConfig) {
        super(entityId, actionName, config);
        
        if (!config.costPerSecond) {
            throw new Error('ContinuousEnergyConsumer requires costPerSecond in config');
        }
    }

    /**
     * Calculate energy cost per second
     */
    public calculateEnergyCost(): number {
        return (this.config.costPerSecond || 0) * (this.config.costMultiplier || 1);
    }

    /**
     * Start continuous energy consumption
     */
    public async executeAction(): Promise<EnergyConsumptionResult> {
        if (this.isActive) {
            return this.createResult(false, 0, 0, 'Already active');
        }

        const costPerSecond = this.calculateEnergyCost();
        
        if (!this.canExecute()) {
            return this.createResult(false, 0, costPerSecond, 'Insufficient energy');
        }

        this.isActive = true;
        this.totalConsumed = 0;
        
        // Start continuous consumption
        this.consumptionInterval = window.setInterval(() => {
            if (!this.consumeEnergy(costPerSecond, this.actionName)) {
                this.stopConsumption();
            } else {
                this.totalConsumed += costPerSecond;
            }
        }, 1000);

        return this.createResult(true, 0, costPerSecond);
    }

    /**
     * Stop continuous energy consumption
     */
    public stopConsumption(): void {
        if (this.consumptionInterval) {
            clearInterval(this.consumptionInterval);
            this.consumptionInterval = null;
        }

        this.isActive = false;
    }

    /**
     * Check if consumption is active
     */
    public isConsuming(): boolean {
        return this.isActive;
    }

    /**
     * Get total energy consumed
     */
    public getTotalConsumed(): number {
        return this.totalConsumed;
    }

    /**
     * Dispose and stop consumption
     */
    public dispose(): void {
        this.stopConsumption();
        super.dispose();
    }
}