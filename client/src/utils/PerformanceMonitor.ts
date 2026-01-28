/**
 * PerformanceMonitor - Performance tracking and monitoring utilities
 * 
 * Tracks FPS, frame time, memory usage, and other performance indicators
 * to help identify performance bottlenecks and ensure 60fps gameplay.
 */

// ==================== Interfaces ====================

export interface PerformanceMetrics {
    /** Current frame rate */
    fps: number;
    /** Frame time in milliseconds */
    frameTime: number;
    /** Memory usage in MB */
    memoryUsage: number;
    /** Number of draw calls */
    drawCalls: number;
    /** Number of active entities */
    entityCount: number;
}

export interface PerformanceThresholds {
    /** Minimum acceptable FPS */
    minFPS: number;
    /** Maximum acceptable frame time (ms) */
    maxFrameTime: number;
    /** Maximum acceptable memory usage (MB) */
    maxMemoryUsage: number;
}

// ==================== Performance Monitor ====================

/**
 * Performance monitor for tracking game performance metrics
 * 
 * Tracks FPS, frame time, memory usage, and other performance indicators
 * to help identify performance bottlenecks and ensure 60fps gameplay.
 */
export class PerformanceMonitor {
    private frameCount: number = 0;
    private lastTime: number = 0;
    private frameTimeHistory: number[] = [];
    private fpsHistory: number[] = [];
    private readonly historySize: number = 60; // Keep 1 second of history at 60fps
    
    private thresholds: PerformanceThresholds;
    private warningCallbacks: Array<(metric: string, value: number, threshold: number) => void> = [];

    constructor(thresholds?: Partial<PerformanceThresholds>) {
        this.thresholds = {
            minFPS: 30,
            maxFrameTime: 33.33, // ~30fps
            maxMemoryUsage: 512,
            ...thresholds
        };
    }

    /**
     * Update performance metrics (call once per frame)
     */
    public update(): void {
        const currentTime = performance.now();
        
        if (this.lastTime > 0) {
            const frameTime = currentTime - this.lastTime;
            const fps = 1000 / frameTime;
            
            // Update history
            this.frameTimeHistory.push(frameTime);
            this.fpsHistory.push(fps);
            
            // Maintain history size
            if (this.frameTimeHistory.length > this.historySize) {
                this.frameTimeHistory.shift();
                this.fpsHistory.shift();
            }
            
            // Check thresholds
            this.checkThresholds(fps, frameTime);
        }
        
        this.lastTime = currentTime;
        this.frameCount++;
    }

    /**
     * Get current performance metrics
     */
    public getMetrics(): PerformanceMetrics {
        const fps = this.getAverageFPS();
        const frameTime = this.getAverageFrameTime();
        const memoryUsage = this.getMemoryUsage();
        
        return {
            fps,
            frameTime,
            memoryUsage,
            drawCalls: 0, // Would need engine integration
            entityCount: 0 // Would need game state integration
        };
    }

    /**
     * Get average FPS over recent history
     */
    public getAverageFPS(): number {
        if (this.fpsHistory.length === 0) return 0;
        
        const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
        return sum / this.fpsHistory.length;
    }

    /**
     * Get average frame time over recent history
     */
    public getAverageFrameTime(): number {
        if (this.frameTimeHistory.length === 0) return 0;
        
        const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
        return sum / this.frameTimeHistory.length;
    }

    /**
     * Get current memory usage (if available)
     */
    public getMemoryUsage(): number {
        if ('memory' in performance) {
            const memory = (performance as any).memory;
            return memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
        }
        return 0;
    }

    /**
     * Check if performance is within acceptable thresholds
     */
    private checkThresholds(fps: number, frameTime: number): void {
        if (fps < this.thresholds.minFPS) {
            this.triggerWarning('fps', fps, this.thresholds.minFPS);
        }
        
        if (frameTime > this.thresholds.maxFrameTime) {
            this.triggerWarning('frameTime', frameTime, this.thresholds.maxFrameTime);
        }
        
        const memoryUsage = this.getMemoryUsage();
        if (memoryUsage > this.thresholds.maxMemoryUsage) {
            this.triggerWarning('memoryUsage', memoryUsage, this.thresholds.maxMemoryUsage);
        }
    }

    /**
     * Trigger performance warning
     */
    private triggerWarning(metric: string, value: number, threshold: number): void {
        this.warningCallbacks.forEach(callback => {
            try {
                callback(metric, value, threshold);
            } catch (error) {
                console.error('Error in performance warning callback:', error);
            }
        });
    }

    /**
     * Add callback for performance warnings
     */
    public onPerformanceWarning(callback: (metric: string, value: number, threshold: number) => void): void {
        this.warningCallbacks.push(callback);
    }

    /**
     * Get performance summary
     */
    public getSummary(): string {
        const metrics = this.getMetrics();
        return `FPS: ${metrics.fps.toFixed(1)}, Frame Time: ${metrics.frameTime.toFixed(2)}ms, Memory: ${metrics.memoryUsage.toFixed(1)}MB`;
    }

    /**
     * Reset performance history
     */
    public reset(): void {
        this.frameTimeHistory = [];
        this.fpsHistory = [];
        this.frameCount = 0;
        this.lastTime = 0;
    }
}

// ==================== Utility Functions ====================

/**
 * Measure execution time of a function
 * 
 * @param func Function to measure
 * @param label Optional label for logging
 * @returns Execution time in milliseconds
 */
export function measureExecutionTime<T>(func: () => T, label?: string): { result: T; time: number } {
    const start = performance.now();
    const result = func();
    const time = performance.now() - start;
    
    if (label) {
        console.log(`[Performance] ${label}: ${time.toFixed(2)}ms`);
    }
    
    return { result, time };
}

/**
 * Check if the current frame rate is acceptable
 * 
 * @param targetFPS Target frame rate (default: 60)
 * @param tolerance Tolerance percentage (default: 0.8 = 80%)
 * @returns True if frame rate is acceptable
 */
export function isFrameRateAcceptable(targetFPS: number = 60, tolerance: number = 0.8): boolean {
    // This would need integration with the actual engine to get real FPS
    // For now, return true as a placeholder
    // TODO: Integrate with actual performance monitoring
    return true;
}