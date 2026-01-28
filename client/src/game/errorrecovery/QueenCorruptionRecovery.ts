/**
 * QueenCorruptionRecovery - Queen lifecycle corruption detection and recovery
 *
 * Detects and recovers from Queen state corruption issues.
 */

import type { TerritoryManager } from '../TerritoryManager';
import { Queen, QueenPhase } from '../entities/Queen';
import type { QueenCorruptionError, ErrorRecoveryConfig, ErrorRecoveryStats } from './ErrorRecoveryInterfaces';

export class QueenCorruptionRecovery {
    private territoryManager: TerritoryManager;
    private config: ErrorRecoveryConfig;
    private corruptionErrors: Map<string, QueenCorruptionError> = new Map();
    private recoveryAttempts: Map<string, number> = new Map();

    constructor(territoryManager: TerritoryManager, config: ErrorRecoveryConfig) {
        this.territoryManager = territoryManager;
        this.config = config;
    }

    public detectCorruption(stats: ErrorRecoveryStats, log: (msg: string) => void): void {
        const queens = this.territoryManager.getAllQueens();
        if (!queens || !Array.isArray(queens)) {
            return;
        }

        const corruptionsFound: QueenCorruptionError[] = [];

        for (const queen of queens) {
            if (!queen || !queen.isActiveQueen()) {
                continue;
            }

            const currentPhase = queen.getCurrentPhase();
            const corruption = this.validateQueenState(queen, currentPhase);

            if (corruption) {
                const errorKey = queen.id;

                if (!this.corruptionErrors.has(errorKey)) {
                    this.corruptionErrors.set(errorKey, corruption);
                    corruptionsFound.push(corruption);
                    stats.queenCorruptionErrors++;

                    log(`Queen corruption detected: ${queen.id} - ${corruption.corruptionType}`);
                }
            }
        }

        for (const error of corruptionsFound) {
            this.scheduleRecovery(error, stats, log);
        }
    }

    private validateQueenState(queen: Queen, currentPhase: QueenPhase): QueenCorruptionError | null {
        const currentTime = performance.now();

        if (currentPhase === QueenPhase.UNDERGROUND_GROWTH && queen.isVulnerable()) {
            return {
                queen,
                expectedPhase: currentPhase,
                actualPhase: currentPhase,
                corruptionType: 'invalid_vulnerability',
                detectedAt: currentTime
            };
        }

        if (currentPhase === QueenPhase.ACTIVE_CONTROL && !queen.getHive()) {
            return {
                queen,
                expectedPhase: currentPhase,
                actualPhase: currentPhase,
                corruptionType: 'missing_hive',
                detectedAt: currentTime
            };
        }

        if (currentPhase === QueenPhase.UNDERGROUND_GROWTH) {
            const growthTimeRemaining = queen.getGrowthTimeRemaining();
            const growthProgress = queen.getGrowthProgress();

            if (growthProgress < 1.0 && growthTimeRemaining <= 0) {
                return {
                    queen,
                    expectedPhase: QueenPhase.HIVE_CONSTRUCTION,
                    actualPhase: currentPhase,
                    corruptionType: 'stuck_growth',
                    detectedAt: currentTime
                };
            }
        }

        return null;
    }

    private scheduleRecovery(error: QueenCorruptionError, stats: ErrorRecoveryStats, log: (msg: string) => void): void {
        setTimeout(() => {
            this.attemptRecovery(error, stats, log);
        }, this.config.retryDelayMs);
    }

    private attemptRecovery(error: QueenCorruptionError, stats: ErrorRecoveryStats, log: (msg: string) => void): void {
        const queenId = error.queen.id;
        const attemptCount = (this.recoveryAttempts.get(queenId) || 0) + 1;
        this.recoveryAttempts.set(queenId, attemptCount);
        stats.totalRecoveryAttempts++;

        if (attemptCount > this.config.maxRetryAttempts) {
            log(`Queen recovery max attempts reached for ${queenId}, giving up`);
            return;
        }

        try {
            let recoverySuccessful = false;

            switch (error.corruptionType) {
                case 'invalid_vulnerability':
                    if (error.queen.getCurrentPhase() === QueenPhase.UNDERGROUND_GROWTH) {
                        error.queen.position.y = -10;
                        recoverySuccessful = true;
                        log(`Queen ${queenId} vulnerability state corrected`);
                    }
                    break;

                case 'missing_hive':
                    if (error.queen.getCurrentPhase() === QueenPhase.ACTIVE_CONTROL) {
                        (error.queen as any).startHiveConstruction?.();
                        recoverySuccessful = true;
                        log(`Queen ${queenId} hive construction restarted`);
                    }
                    break;

                case 'stuck_growth':
                    (error.queen as any).growthProgress = 1.0;
                    (error.queen as any).startHiveConstruction?.();
                    recoverySuccessful = true;
                    log(`Queen ${queenId} stuck growth phase forced to completion`);
                    break;

                case 'invalid_phase':
                    const hive = error.queen.getHive();
                    if (hive && hive.isHiveConstructed()) {
                        (error.queen as any).currentPhase = QueenPhase.ACTIVE_CONTROL;
                    } else if (hive) {
                        (error.queen as any).currentPhase = QueenPhase.HIVE_CONSTRUCTION;
                    } else {
                        (error.queen as any).currentPhase = QueenPhase.UNDERGROUND_GROWTH;
                    }
                    recoverySuccessful = true;
                    log(`Queen ${queenId} phase corrected to ${(error.queen as any).currentPhase}`);
                    break;
            }

            if (recoverySuccessful) {
                this.corruptionErrors.delete(queenId);
                this.recoveryAttempts.delete(queenId);
                stats.successfulRecoveries++;
            } else {
                this.scheduleRecovery(error, stats, log);
            }

        } catch (recoveryError) {
            log(`Error during Queen recovery: ${recoveryError}`);
            this.scheduleRecovery(error, stats, log);
        }
    }

    public processRecoveries(stats: ErrorRecoveryStats): void {
        for (const [queenId, error] of this.corruptionErrors.entries()) {
            const currentCorruption = this.validateQueenState(error.queen, error.queen.getCurrentPhase());
            if (!currentCorruption) {
                this.corruptionErrors.delete(queenId);
                this.recoveryAttempts.delete(queenId);
                stats.successfulRecoveries++;
            }
        }
    }

    public getErrorCount(): number {
        return this.corruptionErrors.size;
    }

    public clear(): void {
        this.corruptionErrors.clear();
        this.recoveryAttempts.clear();
    }

    public updateConfig(config: ErrorRecoveryConfig): void {
        this.config = config;
    }
}
