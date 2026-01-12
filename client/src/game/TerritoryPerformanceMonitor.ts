/**
 * TerritoryPerformanceMonitor - Performance monitoring for Queen & Territory System
 * 
 * Monitors territory system performance including memory usage, CPU overhead,
 * and frame rate impact. Provides optimization suggestions and performance
 * degradation handling to maintain 60fps performance.
 */

import { TerritoryManager } from './TerritoryManager';
import { Queen } from './entities/Queen';
import { Hive } from './entities/Hive';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

export interface TerritoryPerformanceMetrics {
    // Memory metrics
    territoryMemoryUsage: number; // MB
    queenMemoryUsage: number; // MB
    hiveMemoryUsage: number; // MB
    totalTerritoryMemory: number; // MB
    
    // CPU metrics
    territoryUpdateTime: number; // ms per frame
    queenUpdateTime: number; // ms per frame
    hiveUpdateTime: number; // ms per frame
    totalCPUOverhead: number; // ms per frame
    cpuOverheadPercentage: number; // % of frame time
    
    // Entity counts
    activeTerritories: number;
    activeQueens: number;
    activeHives: number;
    totalQueenGenerations: number;
    
    // Performance status
    isWithinMemoryLimit: boolean; // <100MB additional
    isWithinCPULimit: boolean; // <15% additional
    canMaintain60FPS: boolean;
    performanceGrade: 'excellent' | 'good' | 'warning' | 'critical';
    
    timestamp: number;
}

export interface TerritoryPerformanceThresholds {
    maxMemoryUsage: number; // 100MB
    maxCPUOverheadPercentage: number; // 15%
    targetFPS: number; // 60
    warningFPS: number; // 50
    criticalFPS: number; // 40
    maxTerritories: number; // Performance limit
    maxQueensPerFrame: number; // Update limit
}

export class TerritoryPerformanceMonitor {
    private territoryManager: TerritoryManager;
    private performanceMonitor: PerformanceMonitor;
    
    // Performance tracking
    private metrics: TerritoryPerformanceMetrics[] = [];
    private currentMetrics: TerritoryPerformanceMetrics | null = null;
    private lastUpdateTime: number = 0;
    private updateInterval: number = 1000; // Update every second
    
    // Performance measurement
    private frameStartTime: number = 0;
    private territoryUpdateStartTime: number = 0;
    private queenUpdateStartTime: number = 0;
    private hiveUpdateStartTime: number = 0;
    
    // Memory baseline (measured before territory system)
    private baselineMemoryUsage: number = 0;
    private hasBaselineMeasurement: boolean = false;
    
    // Performance thresholds
    private thresholds: TerritoryPerformanceThresholds = {
        maxMemoryUsage: 100, // 100MB additional
        maxCPUOverheadPercentage: 15, // 15% additional
        targetFPS: 60,
        warningFPS: 50,
        criticalFPS: 40,
        maxTerritories: 25, // Reasonable limit for 60fps
        maxQueensPerFrame: 10 // Limit Queen updates per frame
    };
    
    // Performance degradation handling
    private degradationActive: boolean = false;
    private optimizationLevel: number = 0; // 0 = none, 1 = light, 2 = moderate, 3 = aggressive
    
    // Callbacks
    private onPerformanceWarning?: (metrics: TerritoryPerformanceMetrics) => void;
    private onPerformanceCritical?: (metrics: TerritoryPerformanceMetrics) => void;
    private onOptimizationApplied?: (level: number, description: string) => void;

    constructor(territoryManager: TerritoryManager, performanceMonitor: PerformanceMonitor) {
        this.territoryManager = territoryManager;
        this.performanceMonitor = performanceMonitor;
    }

    /**
     * Start territory performance monitoring
     */
    public startMonitoring(): void {
        // Measure baseline memory usage before territory system is active
        if (!this.hasBaselineMeasurement) {
            this.measureBaselineMemory();
        }
        
        console.log('🏰 Territory Performance Monitor started');
    }

    /**
     * Stop territory performance monitoring
     */
    public stopMonitoring(): void {
        this.degradationActive = false;
        this.optimizationLevel = 0;
        console.log('🏰 Territory Performance Monitor stopped');
    }

    /**
     * Measure baseline memory usage
     */
    private measureBaselineMemory(): void {
        if ('memory' in performance) {
            const memInfo = (performance as any).memory;
            this.baselineMemoryUsage = memInfo.usedJSHeapSize / (1024 * 1024); // MB
            this.hasBaselineMeasurement = true;
            console.log(`📊 Baseline memory usage: ${this.baselineMemoryUsage.toFixed(1)}MB`);
        }
    }

    /**
     * Start frame measurement (call at beginning of territory update)
     */
    public startFrameMeasurement(): void {
        this.frameStartTime = performance.now();
    }

    /**
     * Start territory update measurement
     */
    public startTerritoryUpdateMeasurement(): void {
        this.territoryUpdateStartTime = performance.now();
    }

    /**
     * End territory update measurement
     */
    public endTerritoryUpdateMeasurement(): void {
        // Measurement handled in collectMetrics()
    }

    /**
     * Start Queen update measurement
     */
    public startQueenUpdateMeasurement(): void {
        this.queenUpdateStartTime = performance.now();
    }

    /**
     * End Queen update measurement
     */
    public endQueenUpdateMeasurement(): void {
        // Measurement handled in collectMetrics()
    }

    /**
     * Start Hive update measurement
     */
    public startHiveUpdateMeasurement(): void {
        this.hiveUpdateStartTime = performance.now();
    }

    /**
     * End Hive update measurement
     */
    public endHiveUpdateMeasurement(): void {
        // Measurement handled in collectMetrics()
    }

    /**
     * Update performance monitoring (call each frame)
     */
    public update(deltaTime: number): void {
        const now = performance.now();
        
        // Update metrics every interval
        if (now - this.lastUpdateTime >= this.updateInterval) {
            this.collectMetrics();
            this.checkPerformanceThresholds();
            this.applyPerformanceOptimizations();
            this.lastUpdateTime = now;
        }
    }

    /**
     * Collect current territory performance metrics
     */
    private collectMetrics(): void {
        const now = performance.now();
        
        // Get current memory usage
        let currentMemoryUsage = 0;
        if ('memory' in performance) {
            const memInfo = (performance as any).memory;
            currentMemoryUsage = memInfo.usedJSHeapSize / (1024 * 1024); // MB
        }
        
        // Calculate territory system memory usage
        const territoryMemoryUsage = Math.max(0, currentMemoryUsage - this.baselineMemoryUsage);
        
        // Get entity counts
        const territories = this.territoryManager.getAllTerritories();
        const queens = this.territoryManager.getAllQueens();
        const hives = territories.filter(t => t.hive !== null);
        
        // Calculate CPU timing (simplified - actual measurement would be more complex)
        const territoryUpdateTime = this.territoryUpdateStartTime > 0 ? 
            now - this.territoryUpdateStartTime : 0;
        const queenUpdateTime = this.queenUpdateStartTime > 0 ? 
            now - this.queenUpdateStartTime : 0;
        const hiveUpdateTime = this.hiveUpdateStartTime > 0 ? 
            now - this.hiveUpdateStartTime : 0;
        
        const totalCPUOverhead = territoryUpdateTime + queenUpdateTime + hiveUpdateTime;
        
        // Get current FPS from main performance monitor
        const mainMetrics = this.performanceMonitor.getCurrentMetrics();
        const currentFPS = mainMetrics?.fps || 60;
        const frameTime = mainMetrics?.frameTime || 16.67; // ms
        
        // Calculate CPU overhead percentage
        const cpuOverheadPercentage = frameTime > 0 ? (totalCPUOverhead / frameTime) * 100 : 0;
        
        // Estimate memory breakdown (simplified)
        const queenMemoryUsage = queens.length * 0.5; // ~0.5MB per Queen
        const hiveMemoryUsage = hives.length * 0.3; // ~0.3MB per Hive
        const baseMemoryUsage = territories.length * 0.1; // ~0.1MB per Territory
        
        // Performance status checks
        const isWithinMemoryLimit = territoryMemoryUsage <= this.thresholds.maxMemoryUsage;
        const isWithinCPULimit = cpuOverheadPercentage <= this.thresholds.maxCPUOverheadPercentage;
        const canMaintain60FPS = currentFPS >= this.thresholds.targetFPS;
        
        // Determine performance grade
        let performanceGrade: 'excellent' | 'good' | 'warning' | 'critical';
        if (currentFPS >= this.thresholds.targetFPS && isWithinMemoryLimit && isWithinCPULimit) {
            performanceGrade = 'excellent';
        } else if (currentFPS >= this.thresholds.warningFPS && territoryMemoryUsage <= this.thresholds.maxMemoryUsage * 1.2) {
            performanceGrade = 'good';
        } else if (currentFPS >= this.thresholds.criticalFPS) {
            performanceGrade = 'warning';
        } else {
            performanceGrade = 'critical';
        }
        
        this.currentMetrics = {
            territoryMemoryUsage,
            queenMemoryUsage,
            hiveMemoryUsage,
            totalTerritoryMemory: territoryMemoryUsage,
            territoryUpdateTime,
            queenUpdateTime,
            hiveUpdateTime,
            totalCPUOverhead,
            cpuOverheadPercentage,
            activeTerritories: territories.length,
            activeQueens: queens.length,
            activeHives: hives.length,
            totalQueenGenerations: this.calculateTotalGenerations(queens),
            isWithinMemoryLimit,
            isWithinCPULimit,
            canMaintain60FPS,
            performanceGrade,
            timestamp: now
        };
        
        // Store metrics history (keep last 60 seconds)
        this.metrics.push(this.currentMetrics);
        if (this.metrics.length > 60) {
            this.metrics.shift();
        }
        
        // Reset measurement timers
        this.territoryUpdateStartTime = 0;
        this.queenUpdateStartTime = 0;
        this.hiveUpdateStartTime = 0;
    }

    /**
     * Calculate total Queen generations across all territories
     */
    private calculateTotalGenerations(queens: Queen[]): number {
        return queens.reduce((total, queen) => total + queen.getGeneration(), 0);
    }

    /**
     * Check performance against thresholds
     */
    private checkPerformanceThresholds(): void {
        if (!this.currentMetrics) return;
        
        const { performanceGrade, totalTerritoryMemory, cpuOverheadPercentage } = this.currentMetrics;
        
        // Trigger performance warnings
        if (performanceGrade === 'critical') {
            this.triggerPerformanceCritical();
        } else if (performanceGrade === 'warning') {
            this.triggerPerformanceWarning();
        }
        
        // Log performance issues
        if (totalTerritoryMemory > this.thresholds.maxMemoryUsage) {
            console.warn(`🏰 Territory memory usage: ${totalTerritoryMemory.toFixed(1)}MB (limit: ${this.thresholds.maxMemoryUsage}MB)`);
        }
        
        if (cpuOverheadPercentage > this.thresholds.maxCPUOverheadPercentage) {
            console.warn(`🏰 Territory CPU overhead: ${cpuOverheadPercentage.toFixed(1)}% (limit: ${this.thresholds.maxCPUOverheadPercentage}%)`);
        }
    }

    /**
     * Apply performance optimizations based on current performance
     */
    private applyPerformanceOptimizations(): void {
        if (!this.currentMetrics) return;
        
        const { performanceGrade, activeTerritories, activeQueens } = this.currentMetrics;
        
        // Determine required optimization level
        let requiredLevel = 0;
        if (performanceGrade === 'warning') {
            requiredLevel = 1;
        } else if (performanceGrade === 'critical') {
            requiredLevel = 2;
        }
        
        // Apply optimizations if needed
        if (requiredLevel > this.optimizationLevel) {
            this.applyOptimizationLevel(requiredLevel);
        } else if (requiredLevel < this.optimizationLevel && performanceGrade === 'excellent') {
            // Reduce optimization level if performance improved
            this.applyOptimizationLevel(Math.max(0, this.optimizationLevel - 1));
        }
    }

    /**
     * Apply specific optimization level
     */
    private applyOptimizationLevel(level: number): void {
        if (level === this.optimizationLevel) return;
        
        const previousLevel = this.optimizationLevel;
        this.optimizationLevel = level;
        
        let description = '';
        
        switch (level) {
            case 0:
                // No optimizations - full quality
                description = 'Full quality mode restored';
                this.degradationActive = false;
                break;
                
            case 1:
                // Light optimizations
                description = 'Light optimizations applied: Reduced Queen update frequency';
                this.degradationActive = true;
                // Reduce Queen update frequency to every other frame
                break;
                
            case 2:
                // Moderate optimizations
                description = 'Moderate optimizations applied: Limited territory updates, reduced visual effects';
                this.degradationActive = true;
                // Limit territory updates, reduce visual effects
                break;
                
            case 3:
                // Aggressive optimizations
                description = 'Aggressive optimizations applied: Minimal territory processing';
                this.degradationActive = true;
                // Minimal processing, disable non-essential features
                break;
        }
        
        console.log(`🏰 Performance optimization level changed: ${previousLevel} → ${level} (${description})`);
        
        if (this.onOptimizationApplied) {
            this.onOptimizationApplied(level, description);
        }
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
        
        // Suggest specific territory system optimizations
        this.suggestTerritoryOptimizations();
        
        if (this.onPerformanceCritical) {
            this.onPerformanceCritical(this.currentMetrics);
        }
    }

    /**
     * Suggest territory-specific performance optimizations
     */
    private suggestTerritoryOptimizations(): void {
        if (!this.currentMetrics) return;
        
        const suggestions: string[] = [];
        const { activeTerritories, activeQueens, activeHives, totalTerritoryMemory, cpuOverheadPercentage } = this.currentMetrics;
        
        // Territory-specific suggestions
        if (activeTerritories > this.thresholds.maxTerritories) {
            suggestions.push(`Reduce active territories: ${activeTerritories} (recommended: <${this.thresholds.maxTerritories})`);
        }
        
        if (activeQueens > this.thresholds.maxQueensPerFrame) {
            suggestions.push(`Limit Queen updates per frame: ${activeQueens} (recommended: <${this.thresholds.maxQueensPerFrame})`);
        }
        
        if (totalTerritoryMemory > this.thresholds.maxMemoryUsage) {
            suggestions.push(`Territory memory usage too high: ${totalTerritoryMemory.toFixed(1)}MB (limit: ${this.thresholds.maxMemoryUsage}MB)`);
        }
        
        if (cpuOverheadPercentage > this.thresholds.maxCPUOverheadPercentage) {
            suggestions.push(`Territory CPU overhead too high: ${cpuOverheadPercentage.toFixed(1)}% (limit: ${this.thresholds.maxCPUOverheadPercentage}%)`);
        }
        
        // General optimization suggestions
        if (activeHives > 10) {
            suggestions.push('Consider reducing Hive visual complexity or update frequency');
        }
        
        if (activeQueens > 5) {
            suggestions.push('Consider staggering Queen lifecycle updates across frames');
        }
        
        if (suggestions.length > 0) {
            console.warn('🏰 Territory Performance Suggestions:');
            suggestions.forEach(suggestion => console.warn(`  - ${suggestion}`));
        }
    }

    /**
     * Get current territory performance metrics
     */
    public getCurrentMetrics(): TerritoryPerformanceMetrics | null {
        return this.currentMetrics;
    }

    /**
     * Get territory performance history
     */
    public getMetricsHistory(): TerritoryPerformanceMetrics[] {
        return [...this.metrics];
    }

    /**
     * Get performance summary
     */
    public getPerformanceSummary(): {
        memoryUsage: number;
        cpuOverhead: number;
        performanceGrade: string;
        activeTerritories: number;
        activeQueens: number;
        canMaintain60FPS: boolean;
        optimizationLevel: number;
        suggestions: string[];
    } {
        if (!this.currentMetrics) {
            return {
                memoryUsage: 0,
                cpuOverhead: 0,
                performanceGrade: 'unknown',
                activeTerritories: 0,
                activeQueens: 0,
                canMaintain60FPS: true,
                optimizationLevel: 0,
                suggestions: []
            };
        }
        
        const suggestions: string[] = [];
        const { totalTerritoryMemory, cpuOverheadPercentage, activeTerritories, activeQueens } = this.currentMetrics;
        
        if (totalTerritoryMemory > this.thresholds.maxMemoryUsage * 0.8) {
            suggestions.push('Memory usage approaching limit');
        }
        
        if (cpuOverheadPercentage > this.thresholds.maxCPUOverheadPercentage * 0.8) {
            suggestions.push('CPU overhead approaching limit');
        }
        
        if (activeTerritories > this.thresholds.maxTerritories * 0.8) {
            suggestions.push('Consider limiting active territories');
        }
        
        return {
            memoryUsage: this.currentMetrics.totalTerritoryMemory,
            cpuOverhead: this.currentMetrics.cpuOverheadPercentage,
            performanceGrade: this.currentMetrics.performanceGrade,
            activeTerritories: this.currentMetrics.activeTerritories,
            activeQueens: this.currentMetrics.activeQueens,
            canMaintain60FPS: this.currentMetrics.canMaintain60FPS,
            optimizationLevel: this.optimizationLevel,
            suggestions
        };
    }

    /**
     * Check if performance degradation is active
     */
    public isDegradationActive(): boolean {
        return this.degradationActive;
    }

    /**
     * Get current optimization level
     */
    public getOptimizationLevel(): number {
        return this.optimizationLevel;
    }

    /**
     * Set performance warning callback
     */
    public onWarning(callback: (metrics: TerritoryPerformanceMetrics) => void): void {
        this.onPerformanceWarning = callback;
    }

    /**
     * Set performance critical callback
     */
    public onCritical(callback: (metrics: TerritoryPerformanceMetrics) => void): void {
        this.onPerformanceCritical = callback;
    }

    /**
     * Set optimization applied callback
     */
    public onOptimization(callback: (level: number, description: string) => void): void {
        this.onOptimizationApplied = callback;
    }

    /**
     * Set performance thresholds
     */
    public setThresholds(thresholds: Partial<TerritoryPerformanceThresholds>): void {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    /**
     * Force performance optimization level (for testing)
     */
    public forceOptimizationLevel(level: number): void {
        this.applyOptimizationLevel(Math.max(0, Math.min(3, level)));
    }

    /**
     * Reset performance monitoring
     */
    public reset(): void {
        this.metrics = [];
        this.currentMetrics = null;
        this.degradationActive = false;
        this.optimizationLevel = 0;
        this.measureBaselineMemory();
    }

    /**
     * Dispose territory performance monitor
     */
    public dispose(): void {
        this.stopMonitoring();
        this.metrics = [];
        this.currentMetrics = null;
    }
}