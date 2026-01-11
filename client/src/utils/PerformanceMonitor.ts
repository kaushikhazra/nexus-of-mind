/**
 * PerformanceMonitor - FPS monitoring and performance tracking
 * 
 * Monitors game performance metrics including FPS, memory usage, render times,
 * and combat-specific performance metrics. Provides optimization suggestions 
 * and performance warnings with special focus on maintaining 60fps during combat.
 */

import { Scene, Engine } from '@babylonjs/core';
import { CombatSystem, CombatPerformanceMetrics } from '../game/CombatSystem';

export interface PerformanceMetrics {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
    memoryUsage?: number;
    timestamp: number;
    // Combat-specific metrics
    combatMetrics?: CombatPerformanceMetrics;
}

export interface PerformanceThresholds {
    targetFPS: number;
    warningFPS: number;
    criticalFPS: number;
    maxFrameTime: number;
}

export class PerformanceMonitor {
    private scene: Scene;
    private engine: Engine;
    private combatSystem: CombatSystem | null = null;
    private isMonitoring: boolean = false;
    
    // Performance tracking
    private metrics: PerformanceMetrics[] = [];
    private currentMetrics: PerformanceMetrics | null = null;
    private lastUpdateTime: number = 0;
    private updateInterval: number = 1000; // Update every second
    
    // Combat performance tracking
    private combatPerformanceHistory: CombatPerformanceMetrics[] = [];
    private lastCombatCheck: number = 0;
    private combatCheckInterval: number = 500; // Check combat performance every 500ms
    
    // Performance thresholds
    private thresholds: PerformanceThresholds = {
        targetFPS: 60,
        warningFPS: 45,
        criticalFPS: 30,
        maxFrameTime: 16.67 // 60 FPS = 16.67ms per frame
    };
    
    // Combat performance thresholds
    private combatThresholds = {
        maxCombatFrameImpact: 5.0, // Max 5ms per frame for combat processing
        maxAttackProcessingTime: 2.0, // Max 2ms per attack
        maxActiveCombats: 20, // Max 20 simultaneous combats for 60fps
        maxValidationsPerSecond: 100 // Max 100 validations per second
    };
    
    // Monitoring callbacks
    private onPerformanceWarning?: (metrics: PerformanceMetrics) => void;
    private onPerformanceCritical?: (metrics: PerformanceMetrics) => void;

    constructor(scene: Scene, engine: Engine) {
        this.scene = scene;
        this.engine = engine;
    }

    /**
     * Set combat system for combat-specific performance monitoring
     */
    public setCombatSystem(combatSystem: CombatSystem): void {
        this.combatSystem = combatSystem;
    }

    /**
     * Start performance monitoring
     */
    public startMonitoring(): void {
        if (this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = true;
        this.lastUpdateTime = performance.now();
        
        // Register render loop callback
        this.scene.registerBeforeRender(() => {
            this.updateMetrics();
        });

        // Start console logging (can be disabled in production)
        this.startConsoleLogging();
    }

    /**
     * Stop performance monitoring
     */
    public stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
    }

    /**
     * Update performance metrics
     */
    private updateMetrics(): void {
        if (!this.isMonitoring) return;

        const now = performance.now();
        
        // Update metrics every interval
        if (now - this.lastUpdateTime >= this.updateInterval) {
            this.collectMetrics();
            this.checkPerformanceThresholds();
            this.lastUpdateTime = now;
        }
        
        // Check combat performance more frequently
        if (this.combatSystem && now - this.lastCombatCheck >= this.combatCheckInterval) {
            this.checkCombatPerformance();
            this.lastCombatCheck = now;
        }
    }

    /**
     * Collect current performance metrics
     */
    private collectMetrics(): void {
        const fps = this.engine.getFps();
        const frameTime = 1000 / fps; // ms per frame
        
        // Get render statistics (simplified approach)
        const drawCalls = this.scene.getActiveMeshes().length; // Approximation
        const triangles = this.scene.getTotalVertices() / 3; // Approximation

        // Get memory usage (if available)
        let memoryUsage: number | undefined;
        if ('memory' in performance) {
            const memInfo = (performance as any).memory;
            memoryUsage = memInfo.usedJSHeapSize / (1024 * 1024); // MB
        }

        // Get combat metrics if combat system is available
        let combatMetrics: CombatPerformanceMetrics | undefined;
        if (this.combatSystem) {
            combatMetrics = this.combatSystem.getPerformanceMetrics();
        }

        this.currentMetrics = {
            fps: Math.round(fps * 10) / 10,
            frameTime: Math.round(frameTime * 100) / 100,
            drawCalls,
            triangles: Math.round(triangles),
            memoryUsage,
            timestamp: performance.now(),
            combatMetrics
        };

        // Store metrics history (keep last 60 seconds)
        this.metrics.push(this.currentMetrics);
        if (this.metrics.length > 60) {
            this.metrics.shift();
        }

        // Store combat metrics history if available
        if (combatMetrics) {
            this.combatPerformanceHistory.push(combatMetrics);
            if (this.combatPerformanceHistory.length > 120) { // Keep 2 minutes of combat history
                this.combatPerformanceHistory.shift();
            }
        }
    }

    /**
     * Check performance against thresholds
     */
    private checkPerformanceThresholds(): void {
        if (!this.currentMetrics) return;

        const { fps, combatMetrics } = this.currentMetrics;

        // Check for performance warnings
        if (fps < this.thresholds.criticalFPS) {
            this.triggerPerformanceCritical();
        } else if (fps < this.thresholds.warningFPS) {
            this.triggerPerformanceWarning();
        }

        // Check combat-specific performance if in combat
        if (combatMetrics && combatMetrics.activeCombatCount > 0) {
            this.checkCombatSpecificThresholds(combatMetrics);
        }
    }

    /**
     * Check combat-specific performance thresholds
     */
    private checkCombatSpecificThresholds(combatMetrics: CombatPerformanceMetrics): void {
        const issues: string[] = [];

        if (combatMetrics.frameTimeImpact > this.combatThresholds.maxCombatFrameImpact) {
            issues.push(`Combat frame impact: ${combatMetrics.frameTimeImpact.toFixed(2)}ms (max: ${this.combatThresholds.maxCombatFrameImpact}ms)`);
        }

        if (combatMetrics.averageAttackProcessingTime > this.combatThresholds.maxAttackProcessingTime) {
            issues.push(`Attack processing: ${combatMetrics.averageAttackProcessingTime.toFixed(2)}ms (max: ${this.combatThresholds.maxAttackProcessingTime}ms)`);
        }

        if (combatMetrics.activeCombatCount > this.combatThresholds.maxActiveCombats) {
            issues.push(`Active combats: ${combatMetrics.activeCombatCount} (max: ${this.combatThresholds.maxActiveCombats})`);
        }

        if (combatMetrics.targetValidationsPerSecond > this.combatThresholds.maxValidationsPerSecond) {
            issues.push(`Validations/sec: ${combatMetrics.targetValidationsPerSecond.toFixed(1)} (max: ${this.combatThresholds.maxValidationsPerSecond})`);
        }

    }

    /**
     * Check combat performance and provide specific monitoring
     */
    private checkCombatPerformance(): void {
        // Combat performance monitoring available via getPerformanceSummary()
    }

    /**
     * Trigger performance warning
     */
    private triggerPerformanceWarning(): void {
        if (!this.currentMetrics) return;

        if (this.onPerformanceWarning) {
            this.onPerformanceWarning(this.currentMetrics);
        }
    }

    /**
     * Trigger performance critical alert
     */
    private triggerPerformanceCritical(): void {
        if (!this.currentMetrics) return;

        // Suggest optimizations
        this.suggestOptimizations();
        
        if (this.onPerformanceCritical) {
            this.onPerformanceCritical(this.currentMetrics);
        }
    }

    /**
     * Suggest performance optimizations
     */
    private suggestOptimizations(): void {
        if (!this.currentMetrics) return;

        const suggestions: string[] = [];
        
        // General performance suggestions
        if (this.currentMetrics.drawCalls > 1000) {
            suggestions.push('Consider mesh instancing to reduce draw calls');
        }
        
        if (this.currentMetrics.triangles > 100000) {
            suggestions.push('Consider LOD (Level of Detail) for distant objects');
        }
        
        if (this.currentMetrics.memoryUsage && this.currentMetrics.memoryUsage > 512) {
            suggestions.push('High memory usage detected - consider texture compression');
        }

        // Combat-specific suggestions
        if (this.currentMetrics.combatMetrics) {
            const combat = this.currentMetrics.combatMetrics;
            
            if (combat.activeCombatCount > 15) {
                suggestions.push('Limit simultaneous combat actions to improve performance');
            }
            
            if (combat.frameTimeImpact > 5.0) {
                suggestions.push('Optimize combat processing - consider batching attacks');
            }
            
            if (combat.targetValidationsPerSecond > 80) {
                suggestions.push('Cache target validation results to reduce computation');
            }
        }

    }

    /**
     * Start console logging of performance metrics
     */
    private startConsoleLogging(): void {
        const logInterval = 5000; // Log every 5 seconds
        
        setInterval(() => {
            if (this.isMonitoring && this.currentMetrics) {
                const { fps, frameTime, drawCalls, triangles, memoryUsage } = this.currentMetrics;
                
                // Disable performance logging to reduce console noise
                // console.log(`📊 Performance: ${fps} FPS | ${frameTime}ms | ${drawCalls} draws | ${triangles} tris${memoryUsage ? ` | ${memoryUsage.toFixed(1)}MB` : ''}`);
            }
        }, logInterval);
    }

    /**
     * Get current performance metrics
     */
    public getCurrentMetrics(): PerformanceMetrics | null {
        return this.currentMetrics;
    }

    /**
     * Get performance history
     */
    public getMetricsHistory(): PerformanceMetrics[] {
        return [...this.metrics];
    }

    /**
     * Get average FPS over last N seconds
     */
    public getAverageFPS(seconds: number = 10): number {
        const cutoffTime = performance.now() - (seconds * 1000);
        const recentMetrics = this.metrics.filter(m => m.timestamp > cutoffTime);
        
        if (recentMetrics.length === 0) return 0;
        
        const totalFPS = recentMetrics.reduce((sum, m) => sum + m.fps, 0);
        return Math.round((totalFPS / recentMetrics.length) * 10) / 10;
    }

    /**
     * Set performance thresholds
     */
    public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    /**
     * Set performance warning callback
     */
    public onWarning(callback: (metrics: PerformanceMetrics) => void): void {
        this.onPerformanceWarning = callback;
    }

    /**
     * Set performance critical callback
     */
    public onCritical(callback: (metrics: PerformanceMetrics) => void): void {
        this.onPerformanceCritical = callback;
    }

    /**
     * Enable/disable console logging
     */
    public setConsoleLogging(enabled: boolean): void {
        // Implementation would control console logging
    }

    /**
     * Get performance summary
     */
    public getPerformanceSummary(): {
        currentFPS: number;
        averageFPS: number;
        minFPS: number;
        maxFPS: number;
        isPerformingWell: boolean;
        combatPerformance?: {
            activeCombats: number;
            attacksPerSecond: number;
            frameImpact: number;
            isOptimal: boolean;
        };
    } {
        if (this.metrics.length === 0) {
            return {
                currentFPS: 0,
                averageFPS: 0,
                minFPS: 0,
                maxFPS: 0,
                isPerformingWell: false
            };
        }

        const fpsList = this.metrics.map(m => m.fps);
        const currentFPS = this.currentMetrics?.fps || 0;
        const averageFPS = fpsList.reduce((sum, fps) => sum + fps, 0) / fpsList.length;
        const minFPS = Math.min(...fpsList);
        const maxFPS = Math.max(...fpsList);
        const isPerformingWell = averageFPS >= this.thresholds.warningFPS;

        const result: any = {
            currentFPS: Math.round(currentFPS * 10) / 10,
            averageFPS: Math.round(averageFPS * 10) / 10,
            minFPS: Math.round(minFPS * 10) / 10,
            maxFPS: Math.round(maxFPS * 10) / 10,
            isPerformingWell
        };

        // Add combat performance if available
        if (this.currentMetrics?.combatMetrics) {
            const combat = this.currentMetrics.combatMetrics;
            result.combatPerformance = {
                activeCombats: combat.activeCombatCount,
                attacksPerSecond: Math.round(combat.attacksPerSecond * 10) / 10,
                frameImpact: Math.round(combat.frameTimeImpact * 100) / 100,
                isOptimal: combat.frameTimeImpact < this.combatThresholds.maxCombatFrameImpact &&
                          combat.averageAttackProcessingTime < this.combatThresholds.maxAttackProcessingTime &&
                          combat.activeCombatCount < this.combatThresholds.maxActiveCombats
            };
        }

        return result;
    }

    /**
     * Get combat performance history for analysis
     */
    public getCombatPerformanceHistory(): CombatPerformanceMetrics[] {
        return [...this.combatPerformanceHistory];
    }

    /**
     * Check if system can maintain 60fps during combat
     */
    public canMaintain60FPSDuringCombat(): boolean {
        if (!this.combatSystem) return true;

        const combatSummary = this.combatSystem.getPerformanceSummary();
        const currentFPS = this.currentMetrics?.fps || 0;

        // System can maintain 60fps if:
        // 1. Current FPS is above target when combat is active
        // 2. Combat frame impact is minimal
        // 3. No performance warnings from combat system
        return combatSummary.activeCombats === 0 || 
               (currentFPS >= this.thresholds.targetFPS && 
                combatSummary.frameImpact < this.combatThresholds.maxCombatFrameImpact &&
                combatSummary.isPerformingWell);
    }

    /**
     * Dispose performance monitor
     */
    public dispose(): void {
        this.stopMonitoring();
        this.metrics = [];
        this.currentMetrics = null;
    }
}