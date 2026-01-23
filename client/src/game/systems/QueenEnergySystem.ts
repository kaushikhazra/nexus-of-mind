/**
 * QueenEnergySystem - Manages Queen's spawn energy resource
 *
 * The Queen has an energy reserve that:
 * - Regenerates passively from the planetary environment (10.0/sec)
 * - Is consumed when spawning parasites (8 for energy, 15 for combat)
 * - Naturally throttles spawn rate based on resource availability
 *
 * This system provides spawn capacity inputs to the NN:
 * - energy_capacity = floor(current/8) / 12 → 0-1
 * - combat_capacity = floor(current/15) / 6 → 0-1
 */

import {
    QueenEnergyConfig,
    SpawnCapacity,
    SpawnableParasiteType,
    QueenEnergyState,
    DEFAULT_QUEEN_ENERGY_CONFIG,
    MAX_AFFORDABLE
} from '../types/QueenEnergyTypes';

export class QueenEnergySystem {
    private currentEnergy: number;
    private readonly config: QueenEnergyConfig;

    // Callbacks for energy events
    private onEnergyChangeCallbacks: ((current: number, max: number) => void)[] = [];
    private onSpawnRejectedCallbacks: ((type: SpawnableParasiteType, required: number, available: number) => void)[] = [];

    constructor(config: Partial<QueenEnergyConfig> = {}) {
        this.config = { ...DEFAULT_QUEEN_ENERGY_CONFIG, ...config };
        this.currentEnergy = this.config.startingEnergy;
    }

    /**
     * Update energy (called from game loop)
     * Handles passive regeneration from planetary environment
     * @param deltaTime Time since last update in seconds
     */
    public update(deltaTime: number): void {
        const previousEnergy = this.currentEnergy;

        // Passive regeneration (capped at max)
        this.currentEnergy = Math.min(
            this.config.maxEnergy,
            this.currentEnergy + (this.config.regenRate * deltaTime)
        );

        // Notify if energy changed significantly (avoid spam for tiny changes)
        if (Math.floor(previousEnergy) !== Math.floor(this.currentEnergy)) {
            this.notifyEnergyChange();
        }
    }

    /**
     * Check if Queen can afford to spawn a parasite of given type
     */
    public canAffordSpawn(type: SpawnableParasiteType): boolean {
        const cost = this.getSpawnCost(type);
        return this.currentEnergy >= cost;
    }

    /**
     * Consume energy for spawning a parasite
     * @returns true if spawn was successful, false if insufficient energy
     */
    public consumeForSpawn(type: SpawnableParasiteType): boolean {
        const cost = this.getSpawnCost(type);

        if (this.currentEnergy >= cost) {
            this.currentEnergy -= cost;
            this.notifyEnergyChange();
            return true;
        }

        // Reject spawn - insufficient energy
        this.onSpawnRejectedCallbacks.forEach(cb => cb(type, cost, this.currentEnergy));
        return false;
    }

    /**
     * Get spawn capacity for a parasite type (normalized 0-1)
     *
     * Formula: floor(current_energy / cost) / max_affordable
     * - 1.0 = full spawn capacity (can spawn maximum possible)
     * - 0.0 = cannot spawn any of this type
     */
    public getSpawnCapacity(type: SpawnableParasiteType): number {
        const cost = this.getSpawnCost(type);
        const maxAffordable = type === 'energy' ? MAX_AFFORDABLE.energy : MAX_AFFORDABLE.combat;

        const currentAffordable = Math.floor(this.currentEnergy / cost);
        return Math.min(1.0, currentAffordable / maxAffordable);
    }

    /**
     * Get spawn capacities for both parasite types
     */
    public getSpawnCapacities(): SpawnCapacity {
        return {
            energy: this.getSpawnCapacity('energy'),
            combat: this.getSpawnCapacity('combat')
        };
    }

    /**
     * Get the spawn cost for a parasite type
     */
    public getSpawnCost(type: SpawnableParasiteType): number {
        return type === 'energy'
            ? this.config.energyParasiteCost
            : this.config.combatParasiteCost;
    }

    /**
     * Get current energy level
     */
    public getCurrentEnergy(): number {
        return this.currentEnergy;
    }

    /**
     * Get maximum energy capacity
     */
    public getMaxEnergy(): number {
        return this.config.maxEnergy;
    }

    /**
     * Get energy as percentage (0-1)
     */
    public getEnergyPercentage(): number {
        return this.currentEnergy / this.config.maxEnergy;
    }

    /**
     * Get regeneration rate (energy per second)
     */
    public getRegenRate(): number {
        return this.config.regenRate;
    }

    /**
     * Get complete energy state for observation data
     */
    public getEnergyState(): QueenEnergyState {
        return {
            current: this.currentEnergy,
            max: this.config.maxEnergy,
            spawnCapacity: this.getSpawnCapacities()
        };
    }

    /**
     * Get number of parasites affordable for each type
     */
    public getAffordableCounts(): { energy: number; combat: number } {
        return {
            energy: Math.floor(this.currentEnergy / this.config.energyParasiteCost),
            combat: Math.floor(this.currentEnergy / this.config.combatParasiteCost)
        };
    }

    /**
     * Set energy directly (for testing or special scenarios)
     */
    public setEnergy(amount: number): void {
        this.currentEnergy = Math.max(0, Math.min(this.config.maxEnergy, amount));
        this.notifyEnergyChange();
    }

    /**
     * Add energy (for bonuses or special events)
     */
    public addEnergy(amount: number): void {
        this.currentEnergy = Math.min(this.config.maxEnergy, this.currentEnergy + amount);
        this.notifyEnergyChange();
    }

    // Event subscription methods

    /**
     * Subscribe to energy change events
     */
    public onEnergyChange(callback: (current: number, max: number) => void): void {
        this.onEnergyChangeCallbacks.push(callback);
    }

    /**
     * Subscribe to spawn rejection events
     */
    public onSpawnRejected(callback: (type: SpawnableParasiteType, required: number, available: number) => void): void {
        this.onSpawnRejectedCallbacks.push(callback);
    }

    /**
     * Notify all energy change listeners
     */
    private notifyEnergyChange(): void {
        this.onEnergyChangeCallbacks.forEach(cb => cb(this.currentEnergy, this.config.maxEnergy));
    }

    /**
     * Get debug/stats information
     */
    public getStats(): {
        currentEnergy: number;
        maxEnergy: number;
        regenRate: number;
        energyPercentage: number;
        spawnCapacity: SpawnCapacity;
        affordableCounts: { energy: number; combat: number };
        costs: { energy: number; combat: number };
    } {
        return {
            currentEnergy: this.currentEnergy,
            maxEnergy: this.config.maxEnergy,
            regenRate: this.config.regenRate,
            energyPercentage: this.getEnergyPercentage(),
            spawnCapacity: this.getSpawnCapacities(),
            affordableCounts: this.getAffordableCounts(),
            costs: {
                energy: this.config.energyParasiteCost,
                combat: this.config.combatParasiteCost
            }
        };
    }

    /**
     * Dispose and cleanup
     */
    public dispose(): void {
        this.onEnergyChangeCallbacks = [];
        this.onSpawnRejectedCallbacks = [];
    }
}
