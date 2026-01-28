/**
 * CombatPerformance - Performance monitoring for combat system
 *
 * Tracks and reports performance metrics including attack processing times,
 * validation rates, and frame time impact. Extracted from CombatSystem.ts
 * for SOLID compliance.
 */

import type { CombatPerformanceMetrics, CombatPerformanceSummary } from './CombatInterfaces';

/**
 * Default performance metrics
 */
export function createDefaultMetrics(): CombatPerformanceMetrics {
    return {
        activeCombatCount: 0,
        attacksPerSecond: 0,
        averageAttackProcessingTime: 0,
        targetValidationsPerSecond: 0,
        combatStateCleanups: 0,
        lastUpdateTime: 0,
        frameTimeImpact: 0
    };
}

/**
 * CombatPerformanceMonitor - Tracks and reports combat system performance
 */
export class CombatPerformanceMonitor {
    private metrics: CombatPerformanceMetrics;
    private attackTimings: number[] = [];
    private validationTimings: number[] = [];
    private lastMetricsReset: number = 0;
    private metricsResetInterval: number;

    constructor(metricsResetInterval: number = 5000) {
        this.metrics = createDefaultMetrics();
        this.metricsResetInterval = metricsResetInterval;
    }

    /**
     * Update active combat count
     */
    public setActiveCombatCount(count: number): void {
        this.metrics.activeCombatCount = count;
    }

    /**
     * Increment combat state cleanups counter
     */
    public incrementCleanups(): void {
        this.metrics.combatStateCleanups++;
    }

    /**
     * Record attack timing for performance monitoring
     */
    public recordAttackTiming(startTime: number): void {
        const processingTime = performance.now() - startTime;
        this.attackTimings.push(processingTime);
    }

    /**
     * Add validation timings from external source
     */
    public addValidationTimings(timings: number[]): void {
        this.validationTimings.push(...timings);
    }

    /**
     * Record frame time impact
     */
    public recordFrameTimeImpact(updateStartTime: number): void {
        const updateEndTime = performance.now();
        this.metrics.frameTimeImpact = updateEndTime - updateStartTime;
        this.metrics.lastUpdateTime = updateEndTime;
    }

    /**
     * Update performance metrics
     */
    public updateMetrics(): void {
        const now = performance.now();

        // Reset metrics every interval
        if (!this.lastMetricsReset || now - this.lastMetricsReset > this.metricsResetInterval) {
            const timeDelta = (now - this.lastMetricsReset) / 1000; // seconds

            // Calculate attacks per second
            this.metrics.attacksPerSecond = timeDelta > 0
                ? this.attackTimings.length / timeDelta
                : 0;

            // Calculate average attack processing time
            if (this.attackTimings.length > 0) {
                const totalTime = this.attackTimings.reduce((sum, time) => sum + time, 0);
                this.metrics.averageAttackProcessingTime = totalTime / this.attackTimings.length;
            } else {
                this.metrics.averageAttackProcessingTime = 0;
            }

            // Calculate validations per second
            this.metrics.targetValidationsPerSecond = timeDelta > 0
                ? this.validationTimings.length / timeDelta
                : 0;

            // Reset timing arrays
            this.attackTimings = [];
            this.validationTimings = [];
            this.lastMetricsReset = now;
        }
    }

    /**
     * Get current performance metrics
     */
    public getMetrics(): CombatPerformanceMetrics {
        return { ...this.metrics };
    }

    /**
     * Get combat performance summary for external monitoring
     */
    public getPerformanceSummary(): CombatPerformanceSummary {
        const recommendations: string[] = [];
        let isPerformingWell = true;

        if (this.metrics.frameTimeImpact > 5.0) {
            isPerformingWell = false;
            recommendations.push('Reduce number of simultaneous combat actions');
        }

        if (this.metrics.averageAttackProcessingTime > 2.0) {
            isPerformingWell = false;
            recommendations.push('Optimize attack processing logic');
        }

        if (this.metrics.activeCombatCount > 20) {
            isPerformingWell = false;
            recommendations.push('Limit maximum concurrent combat actions');
        }

        if (this.metrics.targetValidationsPerSecond > 100) {
            isPerformingWell = false;
            recommendations.push('Cache target validation results');
        }

        return {
            isPerformingWell,
            activeCombats: this.metrics.activeCombatCount,
            attacksPerSecond: Math.round(this.metrics.attacksPerSecond * 10) / 10,
            averageProcessingTime: Math.round(this.metrics.averageAttackProcessingTime * 100) / 100,
            frameImpact: Math.round(this.metrics.frameTimeImpact * 100) / 100,
            recommendations
        };
    }

    /**
     * Check combat performance (silent monitoring)
     */
    public checkPerformance(): void {
        // Performance monitoring without logging
        // Could be extended to emit events or trigger alerts
    }

    /**
     * Reset all metrics
     */
    public reset(): void {
        this.metrics = createDefaultMetrics();
        this.attackTimings = [];
        this.validationTimings = [];
        this.lastMetricsReset = 0;
    }
}
