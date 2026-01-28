/**
 * ParasiteStatistics - Statistics and metrics for parasites
 *
 * Handles lifecycle statistics, rendering metrics, and distribution tracking.
 * Extracted from ParasiteManager.ts for SOLID compliance.
 */

import { EnergyParasite } from '../entities/EnergyParasite';
import { CombatParasite } from '../entities/CombatParasite';
import { DistributionTracker } from '../types/DistributionTracker';
import { ParasiteType, DEFAULT_SPAWN_DISTRIBUTION } from '../types/ParasiteTypes';
import type {
    LifecycleStats,
    PerformanceStats,
    RenderingMetrics
} from './ParasiteInterfaces';

type ParasiteEntity = EnergyParasite | CombatParasite;

/**
 * ParasiteStatisticsCollector - Collects and reports parasite statistics
 */
export class ParasiteStatisticsCollector {
    private distributionTracker: DistributionTracker;
    private parasiteCountByType: Map<ParasiteType, number> = new Map();
    private parasitesByDeposit: Map<string, Set<string>> = new Map();

    constructor() {
        this.distributionTracker = new DistributionTracker(DEFAULT_SPAWN_DISTRIBUTION);
        this.parasiteCountByType.set(ParasiteType.ENERGY, 0);
        this.parasiteCountByType.set(ParasiteType.COMBAT, 0);
    }

    /**
     * Update type count when parasite is added
     */
    public incrementTypeCount(type: ParasiteType): void {
        const current = this.parasiteCountByType.get(type) || 0;
        this.parasiteCountByType.set(type, current + 1);
    }

    /**
     * Update type count when parasite is removed
     */
    public decrementTypeCount(type: ParasiteType): void {
        const current = this.parasiteCountByType.get(type) || 0;
        this.parasiteCountByType.set(type, Math.max(0, current - 1));
    }

    /**
     * Get parasite count by type
     */
    public getParasiteCountByType(type: ParasiteType): number {
        return this.parasiteCountByType.get(type) || 0;
    }

    /**
     * Add parasite to deposit tracking
     */
    public addParasiteToDeposit(depositId: string, parasiteId: string): void {
        if (!this.parasitesByDeposit.has(depositId)) {
            this.parasitesByDeposit.set(depositId, new Set());
        }
        this.parasitesByDeposit.get(depositId)!.add(parasiteId);
    }

    /**
     * Remove parasite from deposit tracking
     */
    public removeParasiteFromDeposit(depositId: string, parasiteId: string): void {
        const depositParasites = this.parasitesByDeposit.get(depositId);
        if (depositParasites) {
            depositParasites.delete(parasiteId);
        }
    }

    /**
     * Get parasites for a specific deposit
     */
    public getParasiteIdsForDeposit(depositId: string): Set<string> | undefined {
        return this.parasitesByDeposit.get(depositId);
    }

    /**
     * Get distribution tracker
     */
    public getDistributionTracker(): DistributionTracker {
        return this.distributionTracker;
    }

    /**
     * Get distribution stats
     */
    public getDistributionStats(): any {
        return this.distributionTracker.getDistributionStats();
    }

    /**
     * Reset distribution
     */
    public resetDistribution(): void {
        this.distributionTracker.reset();
    }

    /**
     * Get lifecycle statistics
     */
    public getLifecycleStats(totalParasites: number): LifecycleStats {
        const parasitesByDeposit = new Map<string, number>();
        for (const [depositId, parasiteIds] of this.parasitesByDeposit.entries()) {
            parasitesByDeposit.set(depositId, parasiteIds.size);
        }

        const distributionStats = this.distributionTracker.getDistributionStats();

        return {
            totalParasites,
            energyParasites: this.getParasiteCountByType(ParasiteType.ENERGY),
            combatParasites: this.getParasiteCountByType(ParasiteType.COMBAT),
            parasitesByDeposit,
            distributionAccuracy: distributionStats.isAccurate ? 1.0 : 0.0
        };
    }

    /**
     * Get performance statistics
     */
    public getPerformanceStats(
        optimizationLevel: number,
        maxActiveParasites: number,
        activeParasites: number,
        lastPerformanceCheck: number
    ): PerformanceStats {
        const optimizationNames = ['None', 'Basic', 'Aggressive'];

        return {
            optimizationLevel,
            maxActiveParasites,
            activeParasites,
            renderingOptimizations: optimizationNames[optimizationLevel] || 'Unknown',
            lastPerformanceCheck
        };
    }

    /**
     * Get rendering metrics
     */
    public getRenderingMetrics(parasites: Map<string, ParasiteEntity>): RenderingMetrics {
        let totalMeshes = 0;
        let visibleMeshes = 0;
        let hiddenMeshes = 0;
        const materialSet = new Set<string>();

        for (const parasite of parasites.values()) {
            const meshCount = (parasite as any).segments?.length || 1;
            totalMeshes += meshCount;

            if ((parasite as any).isHidden && (parasite as any).isHidden()) {
                hiddenMeshes += meshCount;
            } else {
                visibleMeshes += meshCount;
            }

            if ((parasite as any).material) {
                materialSet.add((parasite as any).material.name || 'unknown');
            }
        }

        return {
            totalMeshes,
            visibleMeshes,
            hiddenMeshes,
            materialInstances: materialSet.size
        };
    }

    /**
     * Clean up orphaned tracking data
     */
    public cleanupOrphanedTracking(parasites: Map<string, ParasiteEntity>): void {
        for (const [depositId, parasiteIds] of this.parasitesByDeposit.entries()) {
            const validIds = new Set<string>();
            for (const parasiteId of parasiteIds) {
                if (parasites.has(parasiteId)) {
                    validIds.add(parasiteId);
                }
            }
            this.parasitesByDeposit.set(depositId, validIds);
        }

        this.parasiteCountByType.set(ParasiteType.ENERGY, 0);
        this.parasiteCountByType.set(ParasiteType.COMBAT, 0);

        for (const parasite of parasites.values()) {
            if (parasite.isAlive()) {
                const type = parasite instanceof CombatParasite ? ParasiteType.COMBAT : ParasiteType.ENERGY;
                const currentCount = this.parasiteCountByType.get(type) || 0;
                this.parasiteCountByType.set(type, currentCount + 1);
            }
        }
    }

    /**
     * Clear all data
     */
    public dispose(): void {
        this.parasiteCountByType.clear();
        this.parasitesByDeposit.clear();
    }
}
