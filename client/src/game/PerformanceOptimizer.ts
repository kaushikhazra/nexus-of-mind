/**
 * PerformanceOptimizer - System-wide performance optimization and degradation handling
 * 
 * Coordinates performance optimization across all game systems including territory system,
 * combat system, and rendering. Provides automatic performance degradation handling
 * to maintain 60fps performance under various load conditions.
 */

import { GameEngine } from './GameEngine';
import { PerformanceMonitor, PerformanceMetrics } from '../utils/PerformanceMonitor';
import { TerritoryPerformanceMonitor, TerritoryPerformanceMetrics } from './TerritoryPerformanceMonitor';
import { TerritoryManager } from './TerritoryManager';
import { CombatSystem } from './CombatSystem';
import { ParasiteManager } from './ParasiteManager';

export interface SystemPerformanceMetrics {
    // Overall system metrics
    totalMemoryUsage: number; // MB
    totalCPUOverhead: number; // % of frame time
    currentFPS: number;
    frameTime: number; // ms
    
    // System-specific metrics
    territoryMetrics: TerritoryPerformanceMetrics | null;
    combatMetrics: any | null; // From CombatSystem
    parasiteMetrics: any | null; // From ParasiteManager
    
    // Performance status
    overallGrade: 'excellent' | 'good' | 'warning' | 'critical';
    canMaintain60FPS: boolean;
    isWithinMemoryLimits: boolean;
    isWithinCPULimits: boolean;
    
    // Optimization status
    activeOptimizations: string[];
    optimizationLevel: number;
    
    timestamp: number;
}

export interface PerformanceThresholds {
    // Memory thresholds
    maxTotalMemoryUsage: number; // 200MB total additional
    maxTerritoryMemoryUsage: number; // 100MB for territory system
    
    // CPU thresholds
    maxTotalCPUOverhead: number; // 20% total additional
    maxTerritoryCPUOverhead: number; // 15% for territory system
    
    // FPS thresholds
    targetFPS: number; // 60
    warningFPS: number; // 50
    criticalFPS: number; // 40
    
    // Entity limits for performance
    maxActiveTerritories: number; // 25
    maxActiveQueens: number; // 15
    maxActiveCombats: number; // 20
    maxActiveParasites: number; // 100
}

export class PerformanceOptimizer {
    private gameEngine: GameEngine;
    private performanceMonitor: PerformanceMonitor;
    private territoryPerformanceMonitor: TerritoryPerformanceMonitor | null = null;
    
    // Performance tracking
    private metrics: SystemPerformanceMetrics[] = [];
    private currentMetrics: SystemPerformanceMetrics | null = null;
    private lastUpdateTime: number = 0;
    private updateInterval: number = 1000; // Update every second
    
    // Baseline measurements
    private baselineMemoryUsage: number = 0;
    private baselineCPUUsage: number = 0;
    private hasBaseline: boolean = false;
    
    // Performance thresholds
    private thresholds: PerformanceThresholds = {
        maxTotalMemoryUsage: 200, // 200MB total additional
        maxTerritoryMemoryUsage: 100, // 100MB for territory system
        maxTotalCPUOverhead: 20, // 20% total additional
        maxTerritoryCPUOverhead: 15, // 15% for territory system
        targetFPS: 60,
        warningFPS: 50,
        criticalFPS: 40,
        maxActiveTerritories: 25,
        maxActiveQueens: 15,
        maxActiveCombats: 20,
        maxActiveParasites: 100
    };
    
    // Optimization state
    private globalOptimizationLevel: number = 0; // 0-3
    private activeOptimizations: Set<string> = new Set();
    private degradationActive: boolean = false;
    
    // System references
    private territoryManager: TerritoryManager | null = null;
    private combatSystem: CombatSystem | null = null;
    private parasiteManager: ParasiteManager | null = null;
    
    // Callbacks
    private onPerformanceWarning?: (metrics: SystemPerformanceMetrics) => void;
    private onPerformanceCritical?: (metrics: SystemPerformanceMetrics) => void;
    private onOptimizationApplied?: (level: number, optimizations: string[]) => void;

    constructor(gameEngine: GameEngine, performanceMonitor: PerformanceMonitor) {
        this.gameEngine = gameEngine;
        this.performanceMonitor = performanceMonitor;
    }

    /**
     * Initialize performance optimizer with system references
     */
    public initialize(): void {
        // Get system references
        this.territoryManager = this.gameEngine.getTerritoryManager();
        this.combatSystem = this.gameEngine.getCombatSystem();
        this.parasiteManager = this.gameEngine.getParasiteManager();
        
        // Get territory performance monitor
        if (this.territoryManager) {
            this.territoryPerformanceMonitor = this.territoryManager.getPerformanceMonitor();
        }
        
        // Measure baseline performance
        this.measureBaseline();
        
        console.log('⚡ Performance Optimizer initialized');
    }

    /**
     * Start performance optimization monitoring
     */
    public startMonitoring(): void {
        // Set up performance monitor callbacks
        this.performanceMonitor.onWarning((metrics) => {
            this.handlePerformanceWarning(metrics);
        });
        
        this.performanceMonitor.onCritical((metrics) => {
            this.handlePerformanceCritical(metrics);
        });
        
        console.log('⚡ Performance Optimizer monitoring started');
    }

    /**
     * Stop performance optimization monitoring
     */
    public stopMonitoring(): void {
        this.degradationActive = false;
        this.globalOptimizationLevel = 0;
        this.activeOptimizations.clear();
        console.log('⚡ Performance Optimizer monitoring stopped');
    }

    /**
     * Measure baseline performance before systems are fully active
     */
    private measureBaseline(): void {
        if ('memory' in performance) {
            const memInfo = (performance as any).memory;
            this.baselineMemoryUsage = memInfo.usedJSHeapSize / (1024 * 1024); // MB
        }
        
        const mainMetrics = this.performanceMonitor.getCurrentMetrics();
        if (mainMetrics) {
            this.baselineCPUUsage = mainMetrics.frameTime;
        }
        
        this.hasBaseline = true;
        console.log(`⚡ Baseline: Memory ${this.baselineMemoryUsage.toFixed(1)}MB, CPU ${this.baselineCPUUsage.toFixed(2)}ms`);
    }

    /**
     * Update performance optimization (called each frame)
     */
    public update(deltaTime: number): void {
        const now = performance.now();
        
        // Update metrics every interval
        if (now - this.lastUpdateTime >= this.updateInterval) {
            this.collectSystemMetrics();
            this.analyzePerformance();
            this.applyOptimizations();
            this.lastUpdateTime = now;
        }
    }

    /**
     * Collect comprehensive system performance metrics
     */
    private collectSystemMetrics(): void {
        const now = performance.now();
        
        // Get main performance metrics
        const mainMetrics = this.performanceMonitor.getCurrentMetrics();
        if (!mainMetrics) return;
        
        // Get current memory usage
        let currentMemoryUsage = 0;
        if ('memory' in performance) {
            const memInfo = (performance as any).memory;
            currentMemoryUsage = memInfo.usedJSHeapSize / (1024 * 1024); // MB
        }
        
        // Calculate total additional memory usage
        const totalMemoryUsage = Math.max(0, currentMemoryUsage - this.baselineMemoryUsage);
        
        // Calculate total CPU overhead
        const totalCPUOverhead = Math.max(0, mainMetrics.frameTime - this.baselineCPUUsage);
        const totalCPUOverheadPercentage = this.baselineCPUUsage > 0 ? 
            (totalCPUOverhead / this.baselineCPUUsage) * 100 : 0;
        
        // Get territory performance metrics
        const territoryMetrics = this.territoryPerformanceMonitor?.getCurrentMetrics() || null;
        
        // Get combat metrics (if available)
        const combatMetrics = this.combatSystem?.getPerformanceMetrics() || null;
        
        // Get parasite metrics (simplified)
        const parasiteMetrics = this.parasiteManager ? {
            activeParasites: this.parasiteManager.getActiveParasiteCount(),
            spawnRate: this.parasiteManager.getCurrentSpawnRate(),
            memoryUsage: this.parasiteManager.getActiveParasiteCount() * 0.1 // Estimate
        } : null;
        
        // Determine overall performance grade
        let overallGrade: 'excellent' | 'good' | 'warning' | 'critical';
        const currentFPS = mainMetrics.fps;
        
        if (currentFPS >= this.thresholds.targetFPS && 
            totalMemoryUsage <= this.thresholds.maxTotalMemoryUsage &&
            totalCPUOverheadPercentage <= this.thresholds.maxTotalCPUOverhead) {
            overallGrade = 'excellent';
        } else if (currentFPS >= this.thresholds.warningFPS && 
                   totalMemoryUsage <= this.thresholds.maxTotalMemoryUsage * 1.2) {
            overallGrade = 'good';
        } else if (currentFPS >= this.thresholds.criticalFPS) {
            overallGrade = 'warning';
        } else {
            overallGrade = 'critical';
        }
        
        // Performance status checks
        const canMaintain60FPS = currentFPS >= this.thresholds.targetFPS;
        const isWithinMemoryLimits = totalMemoryUsage <= this.thresholds.maxTotalMemoryUsage;
        const isWithinCPULimits = totalCPUOverheadPercentage <= this.thresholds.maxTotalCPUOverhead;
        
        this.currentMetrics = {
            totalMemoryUsage,
            totalCPUOverhead: totalCPUOverheadPercentage,
            currentFPS,
            frameTime: mainMetrics.frameTime,
            territoryMetrics,
            combatMetrics,
            parasiteMetrics,
            overallGrade,
            canMaintain60FPS,
            isWithinMemoryLimits,
            isWithinCPULimits,
            activeOptimizations: Array.from(this.activeOptimizations),
            optimizationLevel: this.globalOptimizationLevel,
            timestamp: now
        };
        
        // Store metrics history (keep last 60 seconds)
        this.metrics.push(this.currentMetrics);
        if (this.metrics.length > 60) {
            this.metrics.shift();
        }
    }

    /**
     * Analyze performance and determine required optimizations
     */
    private analyzePerformance(): void {
        if (!this.currentMetrics) return;
        
        const { overallGrade, totalMemoryUsage, totalCPUOverhead, currentFPS } = this.currentMetrics;
        
        // Log performance issues
        if (totalMemoryUsage > this.thresholds.maxTotalMemoryUsage) {
            console.warn(`⚡ Total memory usage: ${totalMemoryUsage.toFixed(1)}MB (limit: ${this.thresholds.maxTotalMemoryUsage}MB)`);
        }
        
        if (totalCPUOverhead > this.thresholds.maxTotalCPUOverhead) {
            console.warn(`⚡ Total CPU overhead: ${totalCPUOverhead.toFixed(1)}% (limit: ${this.thresholds.maxTotalCPUOverhead}%)`);
        }
        
        if (currentFPS < this.thresholds.targetFPS) {
            console.warn(`⚡ FPS below target: ${currentFPS.toFixed(1)} (target: ${this.thresholds.targetFPS})`);
        }
        
        // Trigger callbacks based on performance grade
        if (overallGrade === 'critical' && this.onPerformanceCritical) {
            this.onPerformanceCritical(this.currentMetrics);
        } else if (overallGrade === 'warning' && this.onPerformanceWarning) {
            this.onPerformanceWarning(this.currentMetrics);
        }
    }

    /**
     * Apply performance optimizations based on current performance
     */
    private applyOptimizations(): void {
        if (!this.currentMetrics) return;
        
        const { overallGrade } = this.currentMetrics;
        
        // Determine required optimization level
        let requiredLevel = 0;
        if (overallGrade === 'warning') {
            requiredLevel = 1;
        } else if (overallGrade === 'critical') {
            requiredLevel = 2;
        }
        
        // Apply optimizations if needed
        if (requiredLevel > this.globalOptimizationLevel) {
            this.applyOptimizationLevel(requiredLevel);
        } else if (requiredLevel < this.globalOptimizationLevel && overallGrade === 'excellent') {
            // Reduce optimization level if performance improved
            this.applyOptimizationLevel(Math.max(0, this.globalOptimizationLevel - 1));
        }
    }

    /**
     * Apply specific optimization level across all systems
     */
    private applyOptimizationLevel(level: number): void {
        if (level === this.globalOptimizationLevel) return;
        
        const previousLevel = this.globalOptimizationLevel;
        this.globalOptimizationLevel = level;
        
        // Clear previous optimizations
        this.activeOptimizations.clear();
        
        // Apply optimizations based on level
        switch (level) {
            case 0:
                // No optimizations - full quality
                this.degradationActive = false;
                break;
                
            case 1:
                // Light optimizations
                this.degradationActive = true;
                this.activeOptimizations.add('Reduced update frequencies');
                this.activeOptimizations.add('Limited visual effects');
                
                // Apply to territory system
                if (this.territoryPerformanceMonitor) {
                    this.territoryPerformanceMonitor.forceOptimizationLevel(1);
                }
                break;
                
            case 2:
                // Moderate optimizations
                this.degradationActive = true;
                this.activeOptimizations.add('Aggressive update limiting');
                this.activeOptimizations.add('Reduced entity counts');
                this.activeOptimizations.add('Minimal visual effects');
                
                // Apply to territory system
                if (this.territoryPerformanceMonitor) {
                    this.territoryPerformanceMonitor.forceOptimizationLevel(2);
                }
                
                // Apply to combat system
                if (this.combatSystem) {
                    // Limit active combats
                    // this.combatSystem.setMaxActiveCombats(15);
                }
                break;
                
            case 3:
                // Aggressive optimizations
                this.degradationActive = true;
                this.activeOptimizations.add('Minimal processing');
                this.activeOptimizations.add('Emergency performance mode');
                this.activeOptimizations.add('Disabled non-essential features');
                
                // Apply to all systems
                if (this.territoryPerformanceMonitor) {
                    this.territoryPerformanceMonitor.forceOptimizationLevel(3);
                }
                break;
        }
        
        const optimizationList = Array.from(this.activeOptimizations);
        console.log(`⚡ Global optimization level: ${previousLevel} → ${level} (${optimizationList.join(', ')})`);
        
        if (this.onOptimizationApplied) {
            this.onOptimizationApplied(level, optimizationList);
        }
    }

    /**
     * Handle performance warning from main performance monitor
     */
    private handlePerformanceWarning(metrics: PerformanceMetrics): void {
        console.warn(`⚡ System Performance Warning: ${metrics.fps.toFixed(1)} FPS`);
        
        // Suggest optimizations
        this.suggestSystemOptimizations();
    }

    /**
     * Handle performance critical from main performance monitor
     */
    private handlePerformanceCritical(metrics: PerformanceMetrics): void {
        console.error(`⚡ System Performance Critical: ${metrics.fps.toFixed(1)} FPS`);
        
        // Force optimization level increase
        this.applyOptimizationLevel(Math.min(3, this.globalOptimizationLevel + 1));
        
        // Suggest optimizations
        this.suggestSystemOptimizations();
    }

    /**
     * Suggest system-wide performance optimizations
     */
    private suggestSystemOptimizations(): void {
        if (!this.currentMetrics) return;
        
        const suggestions: string[] = [];
        const { totalMemoryUsage, totalCPUOverhead, territoryMetrics, parasiteMetrics } = this.currentMetrics;
        
        // Memory suggestions
        if (totalMemoryUsage > this.thresholds.maxTotalMemoryUsage) {
            suggestions.push(`Reduce total memory usage: ${totalMemoryUsage.toFixed(1)}MB (limit: ${this.thresholds.maxTotalMemoryUsage}MB)`);
        }
        
        // CPU suggestions
        if (totalCPUOverhead > this.thresholds.maxTotalCPUOverhead) {
            suggestions.push(`Reduce total CPU overhead: ${totalCPUOverhead.toFixed(1)}% (limit: ${this.thresholds.maxTotalCPUOverhead}%)`);
        }
        
        // Territory-specific suggestions
        if (territoryMetrics && territoryMetrics.activeTerritories > this.thresholds.maxActiveTerritories) {
            suggestions.push(`Limit active territories: ${territoryMetrics.activeTerritories} (max: ${this.thresholds.maxActiveTerritories})`);
        }
        
        if (territoryMetrics && territoryMetrics.activeQueens > this.thresholds.maxActiveQueens) {
            suggestions.push(`Limit active Queens: ${territoryMetrics.activeQueens} (max: ${this.thresholds.maxActiveQueens})`);
        }
        
        // Parasite suggestions
        if (parasiteMetrics && parasiteMetrics.activeParasites > this.thresholds.maxActiveParasites) {
            suggestions.push(`Limit active parasites: ${parasiteMetrics.activeParasites} (max: ${this.thresholds.maxActiveParasites})`);
        }
        
        if (suggestions.length > 0) {
            console.warn('⚡ System Performance Suggestions:');
            suggestions.forEach(suggestion => console.warn(`  - ${suggestion}`));
        }
    }

    /**
     * Get current system performance metrics
     */
    public getCurrentMetrics(): SystemPerformanceMetrics | null {
        return this.currentMetrics;
    }

    /**
     * Get system performance history
     */
    public getMetricsHistory(): SystemPerformanceMetrics[] {
        return [...this.metrics];
    }

    /**
     * Get performance summary
     */
    public getPerformanceSummary(): {
        overallGrade: string;
        memoryUsage: number;
        cpuOverhead: number;
        currentFPS: number;
        canMaintain60FPS: boolean;
        optimizationLevel: number;
        activeOptimizations: string[];
        suggestions: string[];
    } {
        if (!this.currentMetrics) {
            return {
                overallGrade: 'unknown',
                memoryUsage: 0,
                cpuOverhead: 0,
                currentFPS: 60,
                canMaintain60FPS: true,
                optimizationLevel: 0,
                activeOptimizations: [],
                suggestions: []
            };
        }
        
        const suggestions: string[] = [];
        const { totalMemoryUsage, totalCPUOverhead } = this.currentMetrics;
        
        if (totalMemoryUsage > this.thresholds.maxTotalMemoryUsage * 0.8) {
            suggestions.push('Memory usage approaching limit');
        }
        
        if (totalCPUOverhead > this.thresholds.maxTotalCPUOverhead * 0.8) {
            suggestions.push('CPU overhead approaching limit');
        }
        
        return {
            overallGrade: this.currentMetrics.overallGrade,
            memoryUsage: this.currentMetrics.totalMemoryUsage,
            cpuOverhead: this.currentMetrics.totalCPUOverhead,
            currentFPS: this.currentMetrics.currentFPS,
            canMaintain60FPS: this.currentMetrics.canMaintain60FPS,
            optimizationLevel: this.currentMetrics.optimizationLevel,
            activeOptimizations: this.currentMetrics.activeOptimizations,
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
        return this.globalOptimizationLevel;
    }

    /**
     * Set performance warning callback
     */
    public onWarning(callback: (metrics: SystemPerformanceMetrics) => void): void {
        this.onPerformanceWarning = callback;
    }

    /**
     * Set performance critical callback
     */
    public onCritical(callback: (metrics: SystemPerformanceMetrics) => void): void {
        this.onPerformanceCritical = callback;
    }

    /**
     * Set optimization applied callback
     */
    public onOptimization(callback: (level: number, optimizations: string[]) => void): void {
        this.onOptimizationApplied = callback;
    }

    /**
     * Set performance thresholds
     */
    public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    /**
     * Force optimization level (for testing)
     */
    public forceOptimizationLevel(level: number): void {
        this.applyOptimizationLevel(Math.max(0, Math.min(3, level)));
    }

    /**
     * Reset performance optimizer
     */
    public reset(): void {
        this.metrics = [];
        this.currentMetrics = null;
        this.degradationActive = false;
        this.globalOptimizationLevel = 0;
        this.activeOptimizations.clear();
        this.measureBaseline();
    }

    /**
     * Dispose performance optimizer
     */
    public dispose(): void {
        this.stopMonitoring();
        this.metrics = [];
        this.currentMetrics = null;
        this.activeOptimizations.clear();
    }
}