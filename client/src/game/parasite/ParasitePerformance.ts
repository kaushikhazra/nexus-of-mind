/**
 * ParasitePerformance - Performance optimization for parasites
 *
 * Handles performance monitoring and rendering optimization for parasites.
 * Extracted from ParasiteManager.ts for SOLID compliance.
 */

import { Vector3 } from '@babylonjs/core';
import { EnergyParasite } from '../entities/EnergyParasite';
import { CombatParasite } from '../entities/CombatParasite';
import { GameEngine } from '../GameEngine';

type ParasiteType = EnergyParasite | CombatParasite;
type RenderingLevel = 'full' | 'reduced' | 'minimal' | 'hidden';

/**
 * ParasitePerformanceOptimizer - Manages parasite rendering optimization
 */
export class ParasitePerformanceOptimizer {
    private lastPerformanceCheck: number = 0;
    private readonly PERFORMANCE_CHECK_INTERVAL = 1000;
    private renderingOptimizationLevel: number = 0;
    private maxActiveParasites: number = 10;

    /**
     * Check and optimize performance based on current frame rate
     */
    public checkAndOptimize(parasites: ParasiteType[]): void {
        const currentTime = Date.now();

        if (currentTime - this.lastPerformanceCheck < this.PERFORMANCE_CHECK_INTERVAL) {
            return;
        }

        this.lastPerformanceCheck = currentTime;

        const gameEngine = GameEngine.getInstance();
        const engine = gameEngine?.getEngine();

        if (!engine) {
            return;
        }

        const currentFPS = engine.getFps();
        const activeParasiteCount = parasites.filter(p => p.isAlive()).length;

        let newOptimizationLevel = 0;

        if (currentFPS < 45 && activeParasiteCount > 5) {
            newOptimizationLevel = 2;
            this.maxActiveParasites = Math.max(5, Math.floor(activeParasiteCount * 0.7));
        } else if (currentFPS < 55 && activeParasiteCount > 7) {
            newOptimizationLevel = 1;
            this.maxActiveParasites = Math.max(7, Math.floor(activeParasiteCount * 0.85));
        } else if (currentFPS >= 58) {
            newOptimizationLevel = 0;
            this.maxActiveParasites = Math.min(10, this.maxActiveParasites + 1);
        }

        if (newOptimizationLevel !== this.renderingOptimizationLevel) {
            this.renderingOptimizationLevel = newOptimizationLevel;
            this.applyRenderingOptimizations(parasites);
        }
    }

    /**
     * Apply rendering optimizations based on current optimization level
     */
    private applyRenderingOptimizations(parasites: ParasiteType[]): void {
        switch (this.renderingOptimizationLevel) {
            case 0:
                this.enableAllParasiteRendering(parasites);
                break;
            case 1:
                this.applyBasicOptimizations(parasites);
                break;
            case 2:
                this.applyAggressiveOptimizations(parasites);
                break;
        }
    }

    /**
     * Enable full rendering for all parasites
     */
    private enableAllParasiteRendering(parasites: ParasiteType[]): void {
        for (const parasite of parasites) {
            this.setParasiteRenderingLevel(parasite, 'full');
        }
    }

    /**
     * Apply basic performance optimizations
     */
    private applyBasicOptimizations(parasites: ParasiteType[]): void {
        const gameEngine = GameEngine.getInstance();
        const cameraController = gameEngine?.getCameraController();

        if (!cameraController) {
            return;
        }

        const cameraPosition = cameraController.getCamera()?.position;
        if (!cameraPosition) {
            return;
        }

        const parasitesWithDistance = parasites.map(parasite => ({
            parasite,
            distance: Vector3.Distance(parasite.getPosition(), cameraPosition)
        }));

        parasitesWithDistance.sort((a, b) => a.distance - b.distance);

        for (const { parasite, distance } of parasitesWithDistance) {
            if (distance > 100) {
                this.setParasiteRenderingLevel(parasite, 'minimal');
            } else if (distance > 50) {
                this.setParasiteRenderingLevel(parasite, 'reduced');
            } else {
                this.setParasiteRenderingLevel(parasite, 'full');
            }
        }
    }

    /**
     * Apply aggressive performance optimizations
     */
    private applyAggressiveOptimizations(parasites: ParasiteType[]): void {
        const gameEngine = GameEngine.getInstance();
        const cameraController = gameEngine?.getCameraController();

        if (!cameraController) {
            return;
        }

        const cameraPosition = cameraController.getCamera()?.position;
        if (!cameraPosition) {
            return;
        }

        const parasitesWithPriority = parasites.map(parasite => {
            const distance = Vector3.Distance(parasite.getPosition(), cameraPosition);
            const isCombat = parasite instanceof CombatParasite;
            const priority = (isCombat ? 1000 : 0) - distance;

            return { parasite, distance, priority };
        });

        parasitesWithPriority.sort((a, b) => b.priority - a.priority);

        const maxRenderCount = Math.min(this.maxActiveParasites, parasitesWithPriority.length);

        for (let i = 0; i < parasitesWithPriority.length; i++) {
            const { parasite, distance } = parasitesWithPriority[i];

            if (i >= maxRenderCount) {
                this.setParasiteRenderingLevel(parasite, 'hidden');
            } else if (distance > 75) {
                this.setParasiteRenderingLevel(parasite, 'minimal');
            } else if (distance > 40) {
                this.setParasiteRenderingLevel(parasite, 'reduced');
            } else {
                this.setParasiteRenderingLevel(parasite, 'full');
            }
        }
    }

    /**
     * Set rendering level for a specific parasite
     */
    private setParasiteRenderingLevel(parasite: ParasiteType, level: RenderingLevel): void {
        if (typeof (parasite as any).setRenderingLevel === 'function') {
            (parasite as any).setRenderingLevel(level);
        } else {
            if (level === 'hidden') {
                parasite.hide();
            } else {
                parasite.show();
            }
        }
    }

    /**
     * Force performance optimization check
     */
    public forceCheck(parasites: ParasiteType[]): void {
        this.lastPerformanceCheck = 0;
        this.checkAndOptimize(parasites);
    }

    /**
     * Set maximum active parasites
     */
    public setMaxActiveParasites(max: number): void {
        this.maxActiveParasites = Math.max(1, Math.min(20, max));
    }

    /**
     * Get current optimization level
     */
    public getOptimizationLevel(): number {
        return this.renderingOptimizationLevel;
    }

    /**
     * Get max active parasites
     */
    public getMaxActiveParasites(): number {
        return this.maxActiveParasites;
    }

    /**
     * Get last performance check time
     */
    public getLastPerformanceCheck(): number {
        return this.lastPerformanceCheck;
    }
}
