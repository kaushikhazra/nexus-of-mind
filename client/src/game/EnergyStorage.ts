/**
 * EnergyStorage - Energy storage component for units and buildings
 * 
 * Manages individual entity energy storage with capacity limits, transfer rates,
 * and integration with the global energy economy system.
 */

import { EnergyManager } from './EnergyManager';

export interface EnergyStorageConfig {
    capacity: number;
    initialEnergy?: number;
    transferRate?: number;  // Energy per second transfer rate
    efficiency?: number;    // Storage efficiency (0-1, energy loss during storage)
}

export interface EnergyStorageStats {
    current: number;
    capacity: number;
    percentage: number;
    transferRate: number;
    efficiency: number;
    isLow: boolean;
    isEmpty: boolean;
    isFull: boolean;
}

export class EnergyStorage {
    private entityId: string;
    private currentEnergy: number;
    private capacity: number;
    private transferRate: number;
    private efficiency: number;
    private energyManager: EnergyManager;
    
    // Thresholds
    private lowEnergyThreshold: number = 0.2; // 20% of capacity
    private criticalEnergyThreshold: number = 0.05; // 5% of capacity
    
    // Event callbacks
    private onEnergyChangeCallbacks: ((stats: EnergyStorageStats) => void)[] = [];
    private onLowEnergyCallbacks: (() => void)[] = [];
    private onEnergyDepletedCallbacks: (() => void)[] = [];
    private onEnergyFullCallbacks: (() => void)[] = [];

    constructor(entityId: string, config: EnergyStorageConfig) {
        this.entityId = entityId;
        this.capacity = config.capacity;
        this.currentEnergy = config.initialEnergy || 0;
        this.transferRate = config.transferRate || 10; // Default 10 energy/second
        this.efficiency = config.efficiency || 1.0; // Default 100% efficiency
        this.energyManager = EnergyManager.getInstance();
        
        // Ensure initial energy doesn't exceed capacity
        if (this.currentEnergy > this.capacity) {
            this.currentEnergy = this.capacity;
        }
    }

    /**
     * Check if storage can accept energy
     */
    public canReceiveEnergy(amount: number): boolean {
        if (amount <= 0) return false;
        return (this.currentEnergy + amount) <= this.capacity;
    }

    /**
     * Check if storage has enough energy
     */
    public hasEnergy(amount: number): boolean {
        if (amount <= 0) return true;
        return this.currentEnergy >= amount;
    }

    /**
     * Add energy to storage
     */
    public addEnergy(amount: number, source: string = 'unknown'): number {
        if (amount <= 0) {
            return 0;
        }

        // Calculate actual energy that can be stored (considering efficiency)
        const efficientAmount = amount * this.efficiency;
        const availableSpace = this.capacity - this.currentEnergy;
        const actualAmount = Math.min(efficientAmount, availableSpace);

        if (actualAmount <= 0) {
            return 0;
        }

        // Add energy
        this.currentEnergy += actualAmount;
        
        // Notify changes
        this.notifyEnergyChange();
        this.checkEnergyLevels();
        
        return actualAmount;
    }

    /**
     * Remove energy from storage
     */
    public removeEnergy(amount: number, purpose: string = 'unknown'): boolean {
        if (amount < 0) {
            return false;
        }

        // Allow zero energy consumption (for free actions like worker movement)
        if (amount === 0) {
            return true;
        }

        if (!this.hasEnergy(amount)) {
            return false;
        }

        // Remove energy
        this.currentEnergy -= amount;
        
        // Energy removal logged only occasionally to avoid spam
        // console.log(`⚡ Energy removed from ${this.entityId}: -${amount} for ${purpose} (${this.currentEnergy}/${this.capacity})`);
        
        // Notify changes
        this.notifyEnergyChange();
        this.checkEnergyLevels();
        
        return true;
    }

    /**
     * Transfer energy to another storage
     */
    public transferTo(targetStorage: EnergyStorage, amount: number): boolean {
        if (!this.hasEnergy(amount)) {
            return false;
        }

        if (!targetStorage.canReceiveEnergy(amount)) {
            return false;
        }

        // Remove from source
        if (!this.removeEnergy(amount, `transfer_to_${targetStorage.entityId}`)) {
            return false;
        }

        // Add to target
        const actualTransferred = targetStorage.addEnergy(amount, `transfer_from_${this.entityId}`);
        
        // If target couldn't accept all energy, refund the difference
        if (actualTransferred < amount) {
            const refund = amount - actualTransferred;
            this.addEnergy(refund, 'transfer_refund');
        }

        return actualTransferred > 0;
    }

    /**
     * Drain energy over time (for maintenance, decay, etc.)
     */
    public drainEnergy(amount: number, reason: string = 'drain'): number {
        const actualDrain = Math.min(amount, this.currentEnergy);
        
        if (actualDrain > 0) {
            this.currentEnergy -= actualDrain;

            this.notifyEnergyChange();
            this.checkEnergyLevels();
        }
        
        return actualDrain;
    }

    /**
     * Get current energy amount
     */
    public getCurrentEnergy(): number {
        return this.currentEnergy;
    }

    /**
     * Get storage capacity
     */
    public getCapacity(): number {
        return this.capacity;
    }

    /**
     * Get energy percentage (0-1)
     */
    public getEnergyPercentage(): number {
        return this.capacity > 0 ? this.currentEnergy / this.capacity : 0;
    }

    /**
     * Get comprehensive storage statistics
     */
    public getStats(): EnergyStorageStats {
        const percentage = this.getEnergyPercentage();
        
        return {
            current: this.currentEnergy,
            capacity: this.capacity,
            percentage,
            transferRate: this.transferRate,
            efficiency: this.efficiency,
            isLow: percentage <= this.lowEnergyThreshold,
            isEmpty: this.currentEnergy <= 0,
            isFull: this.currentEnergy >= this.capacity
        };
    }

    /**
     * Set storage capacity (for upgrades)
     */
    public setCapacity(newCapacity: number): void {
        if (newCapacity < 0) {
            return;
        }

        const oldCapacity = this.capacity;
        this.capacity = newCapacity;
        
        // If new capacity is smaller, cap current energy
        if (this.currentEnergy > this.capacity) {
            this.currentEnergy = this.capacity;
        }

        this.notifyEnergyChange();
    }

    /**
     * Set energy efficiency (for upgrades)
     */
    public setEfficiency(newEfficiency: number): void {
        if (newEfficiency < 0 || newEfficiency > 1) {
            return;
        }

        this.efficiency = newEfficiency;
    }

    /**
     * Check energy levels and trigger callbacks
     */
    private checkEnergyLevels(): void {
        const percentage = this.getEnergyPercentage();
        
        if (this.currentEnergy <= 0) {
            this.onEnergyDepletedCallbacks.forEach(callback => callback());
        } else if (percentage <= this.criticalEnergyThreshold) {
            this.onLowEnergyCallbacks.forEach(callback => callback());
        } else if (this.currentEnergy >= this.capacity) {
            this.onEnergyFullCallbacks.forEach(callback => callback());
        }
    }

    /**
     * Notify listeners of energy changes
     */
    private notifyEnergyChange(): void {
        const stats = this.getStats();
        this.onEnergyChangeCallbacks.forEach(callback => callback(stats));
    }

    /**
     * Subscribe to energy change events
     */
    public onEnergyChange(callback: (stats: EnergyStorageStats) => void): void {
        this.onEnergyChangeCallbacks.push(callback);
    }

    /**
     * Subscribe to low energy warnings
     */
    public onLowEnergy(callback: () => void): void {
        this.onLowEnergyCallbacks.push(callback);
    }

    /**
     * Subscribe to energy depletion alerts
     */
    public onEnergyDepleted(callback: () => void): void {
        this.onEnergyDepletedCallbacks.push(callback);
    }

    /**
     * Subscribe to energy full notifications
     */
    public onEnergyFull(callback: () => void): void {
        this.onEnergyFullCallbacks.push(callback);
    }

    /**
     * Get entity ID
     */
    public getEntityId(): string {
        return this.entityId;
    }

    /**
     * Dispose storage
     */
    public dispose(): void {
        this.onEnergyChangeCallbacks = [];
        this.onLowEnergyCallbacks = [];
        this.onEnergyDepletedCallbacks = [];
        this.onEnergyFullCallbacks = [];
    }
}