/**
 * QueenEnergySystem - Energy-based spawn limiting for the Queen
 *
 * The Queen has an energy reserve that:
 * - Regenerates passively from the planetary environment
 * - Is consumed when spawning parasites
 * - Naturally throttles spawn rate without arbitrary caps
 *
 * This creates strategic depth where the Queen (and NN) must manage
 * energy for optimal spawn timing.
 */

import { ParasiteType } from '../types/ParasiteTypes';
import {
    QueenEnergyConfig,
    QueenEnergyState,
    EnergyEvent,
    DEFAULT_QUEEN_ENERGY_CONFIG,
    DEFAULT_SPAWN_COSTS,
} from '../types/QueenEnergyTypes';

/**
 * Callback for energy change events
 */
export type EnergyChangeCallback = (event: EnergyEvent) => void;

/**
 * QueenEnergySystem - Manages Queen's spawn energy
 */
export class QueenEnergySystem {
    private currentEnergy: number;
    private maxEnergy: number;
    private regenRate: number;
    private spawnCosts: Map<ParasiteType, number>;

    // Event tracking
    private onEnergyChange?: EnergyChangeCallback;
    private lastRegenTime: number = 0;

    // Stats
    private totalEnergyRegenerated: number = 0;
    private totalEnergySpent: number = 0;
    private spawnsDenied: number = 0;

    constructor(config: Partial<QueenEnergyConfig> = {}) {
        const fullConfig = { ...DEFAULT_QUEEN_ENERGY_CONFIG, ...config };

        this.maxEnergy = fullConfig.maxEnergy;
        this.currentEnergy = this.maxEnergy * fullConfig.startingEnergyPercent;
        this.regenRate = fullConfig.regenRate;

        // Initialize spawn costs
        this.spawnCosts = new Map();
        for (const [type, cost] of Object.entries(DEFAULT_SPAWN_COSTS)) {
            this.spawnCosts.set(type as ParasiteType, cost);
        }
        // Override with any custom costs from config
        if (config.spawnCosts) {
            for (const [type, cost] of config.spawnCosts) {
                this.spawnCosts.set(type, cost);
            }
        }

        this.lastRegenTime = performance.now();

        console.log(`[QueenEnergySystem] Initialized: ${this.currentEnergy.toFixed(1)}/${this.maxEnergy} energy, regen: ${this.regenRate}/sec`);
    }

    /**
     * Update energy (called from game loop)
     * @param deltaTime Time since last update in seconds
     */
    public update(deltaTime: number): void {
        const previousEnergy = this.currentEnergy;

        // Passive regeneration
        const regenAmount = this.regenRate * deltaTime;
        this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + regenAmount);

        // Track total regenerated
        const actualRegen = this.currentEnergy - previousEnergy;
        if (actualRegen > 0) {
            this.totalEnergyRegenerated += actualRegen;
        }
    }

    /**
     * Check if spawn is affordable
     * @param parasiteType Type of parasite to spawn
     * @returns true if enough energy is available
     */
    public canAffordSpawn(parasiteType: ParasiteType): boolean {
        const cost = this.getSpawnCost(parasiteType);
        return this.currentEnergy >= cost;
    }

    /**
     * Consume energy for spawn
     * @param parasiteType Type of parasite being spawned
     * @returns true if spawn was successful, false if insufficient energy
     */
    public consumeForSpawn(parasiteType: ParasiteType): boolean {
        const cost = this.getSpawnCost(parasiteType);

        if (this.currentEnergy >= cost) {
            const energyBefore = this.currentEnergy;
            this.currentEnergy -= cost;
            this.totalEnergySpent += cost;

            // Fire event
            if (this.onEnergyChange) {
                this.onEnergyChange({
                    timestamp: performance.now(),
                    type: 'spawn',
                    amount: -cost,
                    energyBefore,
                    energyAfter: this.currentEnergy,
                    parasiteType,
                });
            }

            console.log(`[QueenEnergySystem] Spawned ${parasiteType}: -${cost} energy (${this.currentEnergy.toFixed(1)}/${this.maxEnergy})`);
            return true;
        }

        // Insufficient energy
        this.spawnsDenied++;
        console.log(`[QueenEnergySystem] Spawn denied: ${parasiteType} costs ${cost}, have ${this.currentEnergy.toFixed(1)}`);
        return false;
    }

    /**
     * Get spawn cost for a parasite type
     */
    public getSpawnCost(parasiteType: ParasiteType): number {
        return this.spawnCosts.get(parasiteType) || DEFAULT_SPAWN_COSTS[parasiteType] || 20;
    }

    /**
     * Get normalized energy level for NN observation (0-1)
     */
    public getNormalizedEnergy(): number {
        return this.currentEnergy / this.maxEnergy;
    }

    /**
     * Get current energy state
     */
    public getState(): QueenEnergyState {
        return {
            currentEnergy: this.currentEnergy,
            maxEnergy: this.maxEnergy,
            regenRate: this.regenRate,
            normalizedEnergy: this.getNormalizedEnergy(),
        };
    }

    /**
     * Get current energy
     */
    public getCurrentEnergy(): number {
        return this.currentEnergy;
    }

    /**
     * Get max energy
     */
    public getMaxEnergy(): number {
        return this.maxEnergy;
    }

    /**
     * Get regen rate
     */
    public getRegenRate(): number {
        return this.regenRate;
    }

    /**
     * Set callback for energy change events
     */
    public setOnEnergyChange(callback: EnergyChangeCallback): void {
        this.onEnergyChange = callback;
    }

    /**
     * Get statistics
     */
    public getStats(): {
        totalRegenerated: number;
        totalSpent: number;
        spawnsDenied: number;
    } {
        return {
            totalRegenerated: this.totalEnergyRegenerated,
            totalSpent: this.totalEnergySpent,
            spawnsDenied: this.spawnsDenied,
        };
    }

    /**
     * Reset energy to starting value
     */
    public reset(): void {
        const energyBefore = this.currentEnergy;
        this.currentEnergy = this.maxEnergy * 0.5; // Reset to 50%

        if (this.onEnergyChange) {
            this.onEnergyChange({
                timestamp: performance.now(),
                type: 'reset',
                amount: this.currentEnergy - energyBefore,
                energyBefore,
                energyAfter: this.currentEnergy,
            });
        }

        console.log(`[QueenEnergySystem] Reset to ${this.currentEnergy.toFixed(1)}/${this.maxEnergy}`);
    }

    /**
     * Set energy directly (for testing/debug)
     */
    public setEnergy(amount: number): void {
        this.currentEnergy = Math.max(0, Math.min(this.maxEnergy, amount));
    }

    /**
     * Update configuration
     */
    public updateConfig(config: Partial<QueenEnergyConfig>): void {
        if (config.maxEnergy !== undefined) {
            this.maxEnergy = config.maxEnergy;
            this.currentEnergy = Math.min(this.currentEnergy, this.maxEnergy);
        }
        if (config.regenRate !== undefined) {
            this.regenRate = config.regenRate;
        }
        if (config.spawnCosts) {
            for (const [type, cost] of config.spawnCosts) {
                this.spawnCosts.set(type, cost);
            }
        }

        console.log(`[QueenEnergySystem] Config updated: max=${this.maxEnergy}, regen=${this.regenRate}`);
    }
}
