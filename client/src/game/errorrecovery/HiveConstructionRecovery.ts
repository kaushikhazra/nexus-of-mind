/**
 * HiveConstructionRecovery - Hive construction failure detection and recovery
 *
 * Detects and recovers from hive construction failures.
 */

import type { TerritoryManager } from '../TerritoryManager';
import { QueenPhase } from '../entities/Queen';
import type { HiveConstructionError, ErrorRecoveryConfig, ErrorRecoveryStats } from './ErrorRecoveryInterfaces';

export class HiveConstructionRecovery {
    private territoryManager: TerritoryManager;
    private config: ErrorRecoveryConfig;
    private constructionErrors: Map<string, HiveConstructionError> = new Map();
    private retryAttempts: Map<string, number> = new Map();

    constructor(territoryManager: TerritoryManager, config: ErrorRecoveryConfig) {
        this.territoryManager = territoryManager;
        this.config = config;
    }

    public detectFailures(stats: ErrorRecoveryStats, log: (msg: string) => void): void {
        const territories = this.territoryManager.getAllTerritories();
        if (!territories || !Array.isArray(territories)) {
            return;
        }

        const failuresFound: HiveConstructionError[] = [];

        for (const territory of territories) {
            if (!territory) {
                continue;
            }

            const queen = territory.queen;
            const hive = territory.hive;

            if (!queen || !queen.isActiveQueen()) {
                continue;
            }

            if (queen.getCurrentPhase() === QueenPhase.HIVE_CONSTRUCTION && hive) {
                const constructionTimeRemaining = hive.getConstructionTimeRemaining();
                const constructionProgress = hive.getConstructionProgress();

                if (constructionProgress < 1.0 && constructionTimeRemaining <= -5) {
                    const errorKey = hive.id;

                    if (!this.constructionErrors.has(errorKey)) {
                        const error: HiveConstructionError = {
                            hive,
                            errorType: 'timeout',
                            attemptCount: 0,
                            lastAttemptAt: performance.now()
                        };

                        this.constructionErrors.set(errorKey, error);
                        failuresFound.push(error);
                        stats.hiveConstructionErrors++;

                        log(`Hive construction timeout detected: ${hive.id}`);
                    }
                }
            }

            if (queen.getCurrentPhase() === QueenPhase.HIVE_CONSTRUCTION && !hive) {
                const errorKey = `missing_hive_${queen.id}`;

                if (!this.constructionErrors.has(errorKey)) {
                    const error: HiveConstructionError = {
                        hive: null as any,
                        errorType: 'missing_queen',
                        attemptCount: 0,
                        lastAttemptAt: performance.now()
                    };

                    this.constructionErrors.set(errorKey, error);
                    failuresFound.push(error);
                    stats.hiveConstructionErrors++;

                    log(`Missing hive detected for Queen: ${queen.id}`);
                }
            }
        }

        for (const error of failuresFound) {
            this.scheduleRecovery(error, stats, log);
        }
    }

    private scheduleRecovery(error: HiveConstructionError, stats: ErrorRecoveryStats, log: (msg: string) => void): void {
        setTimeout(() => {
            this.attemptRecovery(error, stats, log);
        }, this.config.retryDelayMs);
    }

    private attemptRecovery(error: HiveConstructionError, stats: ErrorRecoveryStats, log: (msg: string) => void): void {
        const errorKey = error.hive?.id || `missing_hive_${error.lastAttemptAt}`;
        const attemptCount = (this.retryAttempts.get(errorKey) || 0) + 1;
        this.retryAttempts.set(errorKey, attemptCount);
        stats.totalRecoveryAttempts++;

        if (attemptCount > this.config.maxRetryAttempts) {
            log(`Hive recovery max attempts reached for ${errorKey}, giving up`);
            return;
        }

        try {
            let recoverySuccessful = false;

            switch (error.errorType) {
                case 'timeout':
                    if (error.hive) {
                        (error.hive as any).constructionProgress = 1.0;
                        (error.hive as any).isConstructed = true;
                        (error.hive as any).completeConstruction?.();
                        recoverySuccessful = true;
                        log(`Hive ${error.hive.id} construction forced to completion`);
                    }
                    break;

                case 'missing_queen':
                    const territories = this.territoryManager.getAllTerritories();
                    if (!territories || !Array.isArray(territories)) {
                        break;
                    }

                    for (const territory of territories) {
                        if (!territory) {
                            continue;
                        }

                        const queen = territory.queen;
                        if (queen && queen.getCurrentPhase() === QueenPhase.HIVE_CONSTRUCTION && !territory.hive) {
                            (queen as any).createHive?.();
                            recoverySuccessful = true;
                            log(`Missing hive created for Queen ${queen.id}`);
                            break;
                        }
                    }
                    break;

                case 'construction_stuck':
                    if (error.hive) {
                        (error.hive as any).constructionStartTime = performance.now();
                        (error.hive as any).constructionProgress = 0.0;
                        (error.hive as any).constructionElapsedTime = 0.0;
                        recoverySuccessful = true;
                        log(`Hive ${error.hive.id} construction restarted`);
                    }
                    break;

                case 'invalid_position':
                    if (error.hive) {
                        const queen = error.hive.getQueen();
                        (queen as any).selectHiveLocation?.();
                        recoverySuccessful = true;
                        log(`Hive ${error.hive.id} position corrected`);
                    }
                    break;
            }

            if (recoverySuccessful) {
                this.constructionErrors.delete(errorKey);
                this.retryAttempts.delete(errorKey);
                stats.successfulRecoveries++;
            } else {
                error.attemptCount = attemptCount;
                error.lastAttemptAt = performance.now();
                this.scheduleRecovery(error, stats, log);
            }

        } catch (recoveryError) {
            log(`Error during hive recovery: ${recoveryError}`);
            error.attemptCount = attemptCount;
            error.lastAttemptAt = performance.now();
            this.scheduleRecovery(error, stats, log);
        }
    }

    public processRecoveries(stats: ErrorRecoveryStats): void {
        for (const [errorKey, error] of this.constructionErrors.entries()) {
            if (error.hive && error.hive.isHiveConstructed()) {
                this.constructionErrors.delete(errorKey);
                this.retryAttempts.delete(errorKey);
                stats.successfulRecoveries++;
            }
        }
    }

    public getErrorCount(): number {
        return this.constructionErrors.size;
    }

    public clear(): void {
        this.constructionErrors.clear();
        this.retryAttempts.clear();
    }

    public updateConfig(config: ErrorRecoveryConfig): void {
        this.config = config;
    }
}
