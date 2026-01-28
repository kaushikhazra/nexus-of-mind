/**
 * TerritoryOverlapRecovery - Territory overlap detection and correction
 *
 * Detects and corrects overlapping territories in the game world.
 */

import type { TerritoryManager, Territory } from '../TerritoryManager';
import type { TerritoryOverlapError, ErrorRecoveryConfig, ErrorRecoveryStats } from './ErrorRecoveryInterfaces';

export class TerritoryOverlapRecovery {
    private territoryManager: TerritoryManager;
    private config: ErrorRecoveryConfig;
    private overlapErrors: Map<string, TerritoryOverlapError> = new Map();

    constructor(territoryManager: TerritoryManager, config: ErrorRecoveryConfig) {
        this.territoryManager = territoryManager;
        this.config = config;
    }

    public detectOverlaps(stats: ErrorRecoveryStats, log: (msg: string) => void): void {
        const territories = this.territoryManager.getAllTerritories();
        if (!territories || !Array.isArray(territories)) {
            return;
        }

        const overlapsFound: TerritoryOverlapError[] = [];

        for (let i = 0; i < territories.length; i++) {
            for (let j = i + 1; j < territories.length; j++) {
                const territory1 = territories[i];
                const territory2 = territories[j];

                const overlapArea = this.calculateOverlap(territory1, territory2);
                if (overlapArea > 0) {
                    const errorKey = `${territory1.id}_${territory2.id}`;

                    if (!this.overlapErrors.has(errorKey)) {
                        const error: TerritoryOverlapError = {
                            territory1,
                            territory2,
                            overlapArea,
                            detectedAt: performance.now()
                        };

                        this.overlapErrors.set(errorKey, error);
                        overlapsFound.push(error);
                        stats.territoryOverlapErrors++;

                        log(`Territory overlap detected: ${territory1.id} and ${territory2.id} (${overlapArea.toFixed(2)} sq units)`);
                    }
                }
            }
        }

        for (const error of overlapsFound) {
            this.scheduleCorrection(error, stats, log);
        }
    }

    private calculateOverlap(territory1: Territory, territory2: Territory): number {
        const bounds1 = territory1.chunkBounds;
        const bounds2 = territory2.chunkBounds;

        const intersectionMinX = Math.max(bounds1.minX, bounds2.minX);
        const intersectionMaxX = Math.min(bounds1.maxX, bounds2.maxX);
        const intersectionMinZ = Math.max(bounds1.minZ, bounds2.minZ);
        const intersectionMaxZ = Math.min(bounds1.maxZ, bounds2.maxZ);

        if (intersectionMinX >= intersectionMaxX || intersectionMinZ >= intersectionMaxZ) {
            return 0;
        }

        const overlapWidth = intersectionMaxX - intersectionMinX;
        const overlapHeight = intersectionMaxZ - intersectionMinZ;
        return overlapWidth * overlapHeight;
    }

    private scheduleCorrection(error: TerritoryOverlapError, stats: ErrorRecoveryStats, log: (msg: string) => void): void {
        setTimeout(() => {
            this.attemptCorrection(error, stats, log);
        }, this.config.retryDelayMs);
    }

    private attemptCorrection(error: TerritoryOverlapError, stats: ErrorRecoveryStats, log: (msg: string) => void): void {
        stats.totalRecoveryAttempts++;

        try {
            const territory1 = error.territory1;
            const territory2 = error.territory2;

            const territoryGrid = (this.territoryManager as any).territoryGrid;
            if (territoryGrid) {
                const newBounds1 = territoryGrid.calculateChunkBounds(
                    territory1.centerPosition.x,
                    territory1.centerPosition.z
                );
                territory1.chunkBounds = newBounds1;

                const newBounds2 = territoryGrid.calculateChunkBounds(
                    territory2.centerPosition.x,
                    territory2.centerPosition.z
                );
                territory2.chunkBounds = newBounds2;

                const remainingOverlap = this.calculateOverlap(territory1, territory2);
                if (remainingOverlap === 0) {
                    const errorKey = `${territory1.id}_${territory2.id}`;
                    this.overlapErrors.delete(errorKey);
                    stats.successfulRecoveries++;

                    log(`Territory overlap corrected: ${territory1.id} and ${territory2.id}`);
                } else {
                    log(`Territory overlap correction failed: ${territory1.id} and ${territory2.id} (${remainingOverlap.toFixed(2)} sq units remaining)`);
                }
            }
        } catch (correctionError) {
            log(`Error during territory overlap correction: ${correctionError}`);
        }
    }

    public processRecoveries(stats: ErrorRecoveryStats): void {
        for (const error of this.overlapErrors.values()) {
            const currentOverlap = this.calculateOverlap(error.territory1, error.territory2);
            if (currentOverlap === 0) {
                const errorKey = `${error.territory1.id}_${error.territory2.id}`;
                this.overlapErrors.delete(errorKey);
                stats.successfulRecoveries++;
            }
        }
    }

    public getErrorCount(): number {
        return this.overlapErrors.size;
    }

    public clear(): void {
        this.overlapErrors.clear();
    }

    public updateConfig(config: ErrorRecoveryConfig): void {
        this.config = config;
    }
}
