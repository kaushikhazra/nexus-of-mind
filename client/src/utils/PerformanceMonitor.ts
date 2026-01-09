/**
 * PerformanceMonitor - FPS monitoring and performance tracking
 * 
 * Monitors game performance metrics including FPS, memory usage, and render times.
 * Provides optimization suggestions and performance warnings.
 */

import { Scene, Engine } from '@babylonjs/core';

export interface PerformanceMetrics {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
    memoryUsage?: number;
    timestamp: number;
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
    private isMonitoring: boolean = false;
    
    // Performance tracking
    private metrics: PerformanceMetrics[] = [];
    private currentMetrics: PerformanceMetrics | null = null;
    private lastUpdateTime: number = 0;
    private updateInterval: number = 1000; // Update every second
    
    // Performance thresholds
    private thresholds: PerformanceThresholds = {
        targetFPS: 60,
        warningFPS: 45,
        criticalFPS: 30,
        maxFrameTime: 16.67 // 60 FPS = 16.67ms per frame
    };
    
    // Monitoring callbacks
    private onPerformanceWarning?: (metrics: PerformanceMetrics) => void;
    private onPerformanceCritical?: (metrics: PerformanceMetrics) => void;

    constructor(scene: Scene, engine: Engine) {
        this.scene = scene;
        this.engine = engine;
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

        this.currentMetrics = {
            fps: Math.round(fps * 10) / 10,
            frameTime: Math.round(frameTime * 100) / 100,
            drawCalls,
            triangles: Math.round(triangles),
            memoryUsage,
            timestamp: performance.now()
        };

        // Store metrics history (keep last 60 seconds)
        this.metrics.push(this.currentMetrics);
        if (this.metrics.length > 60) {
            this.metrics.shift();
        }
    }

    /**
     * Check performance against thresholds
     */
    private checkPerformanceThresholds(): void {
        if (!this.currentMetrics) return;

        const { fps } = this.currentMetrics;

        // Check for performance warnings
        if (fps < this.thresholds.criticalFPS) {
            this.triggerPerformanceCritical();
        } else if (fps < this.thresholds.warningFPS) {
            this.triggerPerformanceWarning();
        }
    }

    /**
     * Trigger performance warning
     */
    private triggerPerformanceWarning(): void {
        if (!this.currentMetrics) return;

        console.warn(`⚠️ Performance Warning: FPS dropped to ${this.currentMetrics.fps}`);
        
        if (this.onPerformanceWarning) {
            this.onPerformanceWarning(this.currentMetrics);
        }
    }

    /**
     * Trigger performance critical alert
     */
    private triggerPerformanceCritical(): void {
        if (!this.currentMetrics) return;

        console.error(`🚨 Performance Critical: FPS dropped to ${this.currentMetrics.fps}`);
        
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
        // Performance optimization suggestions would be logged here
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

        return {
            currentFPS: Math.round(currentFPS * 10) / 10,
            averageFPS: Math.round(averageFPS * 10) / 10,
            minFPS: Math.round(minFPS * 10) / 10,
            maxFPS: Math.round(maxFPS * 10) / 10,
            isPerformingWell
        };
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