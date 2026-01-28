/**
 * IntroductionEffects - Performance optimization systems for introduction renderer
 *
 * Contains LODSystem and PerformanceMonitor for maintaining 60fps during intro screens.
 * Extracted from IntroductionModelRenderer.ts for SOLID compliance.
 *
 * Requirements: 9.6 - Performance monitoring and optimization
 */

import { AbstractMesh, Scene } from '@babylonjs/core';

// ==================== Types ====================

export interface PerformanceMetrics {
    fps: number;
    frameTime: number;
    isLowPerformance: boolean;
    suggestedAction: 'none' | 'reduce-quality' | 'disable-effects';
}

export interface LODLevel {
    mesh: AbstractMesh;
    distance: number;
}

// ==================== LODSystem ====================

/**
 * Level of Detail management for introduction models
 * Requirements: 9.6 - Performance optimization for complex models
 */
export class LODSystem {
    private lodLevels: Map<string, LODLevel[]> = new Map();
    private currentLODLevel: Map<string, number> = new Map();
    private scene: Scene | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Register LOD levels for a model type
     */
    public registerLOD(modelType: string, levels: LODLevel[]): void {
        this.lodLevels.set(modelType, levels);
        this.currentLODLevel.set(modelType, 0);
    }

    /**
     * Update LOD based on camera distance
     */
    public updateLOD(modelType: string, cameraDistance: number): void {
        const levels = this.lodLevels.get(modelType);
        if (!levels || levels.length === 0) return;

        // Find appropriate LOD level based on distance
        let targetLevel = 0;
        for (let i = 0; i < levels.length; i++) {
            if (cameraDistance >= levels[i].distance) {
                targetLevel = i;
            }
        }

        const currentLevel = this.currentLODLevel.get(modelType) ?? 0;
        if (targetLevel !== currentLevel) {
            this.switchLODLevel(modelType, targetLevel);
        }
    }

    /**
     * Switch to a specific LOD level
     */
    private switchLODLevel(modelType: string, level: number): void {
        const levels = this.lodLevels.get(modelType);
        if (!levels) return;

        // Hide all levels
        levels.forEach((lodLevel, index) => {
            if (lodLevel.mesh) {
                lodLevel.mesh.setEnabled(index === level);
            }
        });

        this.currentLODLevel.set(modelType, level);
    }

    /**
     * Get current LOD level for a model type
     */
    public getCurrentLevel(modelType: string): number {
        return this.currentLODLevel.get(modelType) ?? 0;
    }

    /**
     * Clear LOD levels for a model type
     */
    public clearModelLOD(modelType: string): void {
        const levels = this.lodLevels.get(modelType);
        if (levels) {
            levels.forEach(level => {
                if (level.mesh && !level.mesh.isDisposed()) {
                    level.mesh.dispose();
                }
            });
        }
        this.lodLevels.delete(modelType);
        this.currentLODLevel.delete(modelType);
    }

    /**
     * Dispose LOD system
     */
    public dispose(): void {
        this.lodLevels.forEach((levels) => {
            levels.forEach(level => {
                if (level.mesh && !level.mesh.isDisposed()) {
                    level.mesh.dispose();
                }
            });
        });
        this.lodLevels.clear();
        this.currentLODLevel.clear();
        this.scene = null;
    }
}

// ==================== PerformanceMonitor ====================

/**
 * Performance monitoring for introduction renderer
 * Requirements: 9.6 - Monitor FPS and suggest optimizations
 */
export class PerformanceMonitor {
    private scene: Scene | null = null;
    private frameTimeHistory: number[] = [];
    private readonly historySize = 30;
    private readonly lowFPSThreshold = 30;
    private readonly criticalFPSThreshold = 20;
    private onPerformanceChange: ((isLow: boolean) => void) | null = null;
    private wasLowPerformance = false;
    private monitorInterval: ReturnType<typeof setInterval> | null = null;

    constructor(scene: Scene, onPerformanceChange?: (isLow: boolean) => void) {
        this.scene = scene;
        this.onPerformanceChange = onPerformanceChange ?? null;
        this.startMonitoring();
    }

    /**
     * Start performance monitoring
     */
    private startMonitoring(): void {
        if (!this.scene) return;

        this.monitorInterval = setInterval(() => {
            this.updateMetrics();
        }, 1000); // Update every second
    }

    /**
     * Update performance metrics
     */
    private updateMetrics(): void {
        if (!this.scene || !this.scene.getEngine()) return;

        const engine = this.scene.getEngine();
        const frameTime = engine.getDeltaTime();

        this.frameTimeHistory.push(frameTime);
        if (this.frameTimeHistory.length > this.historySize) {
            this.frameTimeHistory.shift();
        }

        // Check for performance issues
        const metrics = this.getMetrics();
        const isCurrentlyLow = metrics.isLowPerformance;

        if (isCurrentlyLow !== this.wasLowPerformance) {
            this.wasLowPerformance = isCurrentlyLow;
            if (this.onPerformanceChange) {
                this.onPerformanceChange(isCurrentlyLow);
            }
        }
    }

    /**
     * Get current performance metrics
     */
    public getMetrics(): PerformanceMetrics {
        if (this.frameTimeHistory.length === 0) {
            return {
                fps: 60,
                frameTime: 16.67,
                isLowPerformance: false,
                suggestedAction: 'none'
            };
        }

        const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
        const fps = 1000 / avgFrameTime;
        const isLowPerformance = fps < this.lowFPSThreshold;

        let suggestedAction: 'none' | 'reduce-quality' | 'disable-effects' = 'none';
        if (fps < this.criticalFPSThreshold) {
            suggestedAction = 'disable-effects';
        } else if (fps < this.lowFPSThreshold) {
            suggestedAction = 'reduce-quality';
        }

        return {
            fps: Math.round(fps),
            frameTime: avgFrameTime,
            isLowPerformance,
            suggestedAction
        };
    }

    /**
     * Reset performance history
     */
    public reset(): void {
        this.frameTimeHistory = [];
        this.wasLowPerformance = false;
    }

    /**
     * Dispose performance monitor
     */
    public dispose(): void {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        this.frameTimeHistory = [];
        this.onPerformanceChange = null;
        this.scene = null;
    }
}
