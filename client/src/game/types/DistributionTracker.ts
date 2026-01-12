/**
 * DistributionTracker - Manages parasite spawn distribution to maintain 75/25 ratio
 * 
 * This class ensures that Energy Parasites spawn at 75% rate and Combat Parasites
 * at 25% rate, with accuracy tracking over a rolling window of spawns.
 */

import { 
    ParasiteType, 
    ParasiteSpawnDistribution, 
    ParasiteSpawnRecord,
    DEFAULT_SPAWN_DISTRIBUTION,
    DistributionTracker as IDistributionTracker
} from './ParasiteTypes';

export class DistributionTracker implements IDistributionTracker {
    private spawnHistory: ParasiteType[] = [];
    private spawnRecords: ParasiteSpawnRecord[] = [];
    private targetDistribution: ParasiteSpawnDistribution;
    private readonly windowSize: number = 20; // Track last 20 spawns for accuracy

    constructor(distribution?: ParasiteSpawnDistribution) {
        this.targetDistribution = distribution || DEFAULT_SPAWN_DISTRIBUTION;
    }

    /**
     * Determine the next parasite type to spawn based on current distribution
     */
    public getNextParasiteType(): ParasiteType {
        // If we haven't spawned enough to track distribution, use random selection
        if (this.spawnHistory.length < 4) {
            return Math.random() < this.targetDistribution.combatParasiteRate 
                ? ParasiteType.COMBAT 
                : ParasiteType.ENERGY;
        }

        const currentRatio = this.getCurrentRatio();
        const targetRatio = this.targetDistribution;

        // Check if we need to force a specific type to maintain distribution
        const combatDeficit = targetRatio.combatParasiteRate - currentRatio.combat;
        const energyDeficit = targetRatio.energyParasiteRate - currentRatio.energy;

        // If combat parasites are significantly under-represented, force spawn one
        if (combatDeficit > targetRatio.distributionAccuracy) {
            return ParasiteType.COMBAT;
        }

        // If energy parasites are significantly under-represented, force spawn one
        if (energyDeficit > targetRatio.distributionAccuracy) {
            return ParasiteType.ENERGY;
        }

        // Distribution is within acceptable range, use weighted random selection
        return Math.random() < targetRatio.combatParasiteRate 
            ? ParasiteType.COMBAT 
            : ParasiteType.ENERGY;
    }

    /**
     * Record a parasite spawn for distribution tracking
     */
    public recordSpawn(parasiteType: ParasiteType, depositId: string): void {
        const spawnRecord: ParasiteSpawnRecord = {
            parasiteId: `${parasiteType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            parasiteType,
            spawnTime: Date.now(),
            depositId
        };

        // Add to spawn history (rolling window)
        this.spawnHistory.push(parasiteType);
        if (this.spawnHistory.length > this.windowSize) {
            this.spawnHistory.shift(); // Remove oldest entry
        }

        // Add to detailed records
        this.spawnRecords.push(spawnRecord);
        
        // Keep records manageable (last 100 spawns)
        if (this.spawnRecords.length > 100) {
            this.spawnRecords.shift();
        }
    }

    /**
     * Get current distribution ratio from spawn history
     */
    public getCurrentRatio(): { energy: number; combat: number } {
        if (this.spawnHistory.length === 0) {
            return { energy: 0, combat: 0 };
        }

        const energyCount = this.spawnHistory.filter(type => type === ParasiteType.ENERGY).length;
        const combatCount = this.spawnHistory.filter(type => type === ParasiteType.COMBAT).length;
        const total = this.spawnHistory.length;

        return {
            energy: energyCount / total,
            combat: combatCount / total
        };
    }

    /**
     * Check if current distribution is within acceptable accuracy
     */
    public isDistributionAccurate(): boolean {
        if (this.spawnHistory.length < 10) {
            return true; // Not enough data to judge accuracy
        }

        const currentRatio = this.getCurrentRatio();
        const targetRatio = this.targetDistribution;

        const energyAccuracy = Math.abs(currentRatio.energy - targetRatio.energyParasiteRate);
        const combatAccuracy = Math.abs(currentRatio.combat - targetRatio.combatParasiteRate);

        return energyAccuracy <= targetRatio.distributionAccuracy &&
               combatAccuracy <= targetRatio.distributionAccuracy;
    }

    /**
     * Reset distribution tracking
     */
    public reset(): void {
        this.spawnHistory = [];
        this.spawnRecords = [];
    }

    /**
     * Get distribution statistics for debugging/monitoring
     */
    public getDistributionStats(): {
        totalSpawns: number;
        energySpawns: number;
        combatSpawns: number;
        currentRatio: { energy: number; combat: number };
        targetRatio: { energy: number; combat: number };
        isAccurate: boolean;
        windowSize: number;
    } {
        const currentRatio = this.getCurrentRatio();
        const energyCount = this.spawnHistory.filter(type => type === ParasiteType.ENERGY).length;
        const combatCount = this.spawnHistory.filter(type => type === ParasiteType.COMBAT).length;

        return {
            totalSpawns: this.spawnHistory.length,
            energySpawns: energyCount,
            combatSpawns: combatCount,
            currentRatio,
            targetRatio: {
                energy: this.targetDistribution.energyParasiteRate,
                combat: this.targetDistribution.combatParasiteRate
            },
            isAccurate: this.isDistributionAccurate(),
            windowSize: this.windowSize
        };
    }

    /**
     * Update target distribution configuration
     */
    public updateDistribution(distribution: ParasiteSpawnDistribution): void {
        this.targetDistribution = distribution;
    }

    /**
     * Get spawn records for a specific deposit
     */
    public getSpawnRecordsForDeposit(depositId: string): ParasiteSpawnRecord[] {
        return this.spawnRecords.filter(record => record.depositId === depositId);
    }

    /**
     * Get recent spawn records within a time window
     */
    public getRecentSpawnRecords(timeWindowMs: number): ParasiteSpawnRecord[] {
        const cutoffTime = Date.now() - timeWindowMs;
        return this.spawnRecords.filter(record => record.spawnTime >= cutoffTime);
    }

    /**
     * Calculate spawn rate over time
     */
    public getSpawnRate(timeWindowMs: number = 60000): number {
        const recentSpawns = this.getRecentSpawnRecords(timeWindowMs);
        return recentSpawns.length / (timeWindowMs / 1000); // spawns per second
    }
}