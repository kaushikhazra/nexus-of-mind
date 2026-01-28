/**
 * ParasiteControlRecovery - Parasite control consistency validation
 *
 * Validates and recovers parasite control assignments to Queens.
 */

import type { TerritoryManager } from '../TerritoryManager';
import type { ParasiteManager } from '../ParasiteManager';
import type { Queen } from '../entities/Queen';
import type { ParasiteControlError, ErrorRecoveryConfig, ErrorRecoveryStats } from './ErrorRecoveryInterfaces';

export class ParasiteControlRecovery {
    private territoryManager: TerritoryManager;
    private parasiteManager: ParasiteManager;
    private config: ErrorRecoveryConfig;
    private controlErrors: Map<string, ParasiteControlError> = new Map();

    constructor(territoryManager: TerritoryManager, parasiteManager: ParasiteManager, config: ErrorRecoveryConfig) {
        this.territoryManager = territoryManager;
        this.parasiteManager = parasiteManager;
        this.config = config;
    }

    public validateControl(stats: ErrorRecoveryStats, log: (msg: string) => void): void {
        const parasites = this.parasiteManager.getAllParasites();
        if (!parasites || !Array.isArray(parasites)) {
            return;
        }

        const errorsFound: ParasiteControlError[] = [];

        for (const parasite of parasites) {
            if (!parasite || !parasite.isAlive()) {
                continue;
            }

            const parasitePosition = parasite.getPosition();
            const territory = this.territoryManager.getTerritoryAt(parasitePosition.x, parasitePosition.z);
            const parasiteId = parasite.getId();

            let error: ParasiteControlError | null = null;

            if (!territory) {
                error = {
                    parasiteId,
                    expectedQueenId: null,
                    actualQueenId: this.findQueenControllingParasite(parasiteId),
                    territoryId: 'none',
                    errorType: 'missing_territory',
                    detectedAt: performance.now()
                };
            } else {
                const expectedQueen = territory.queen;
                const actualQueenId = this.findQueenControllingParasite(parasiteId);

                if (!expectedQueen) {
                    if (actualQueenId) {
                        error = {
                            parasiteId,
                            expectedQueenId: null,
                            actualQueenId,
                            territoryId: territory.id,
                            errorType: 'orphaned_parasite',
                            detectedAt: performance.now()
                        };
                    }
                } else {
                    const expectedQueenId = expectedQueen.id;

                    if (actualQueenId !== expectedQueenId) {
                        error = {
                            parasiteId,
                            expectedQueenId,
                            actualQueenId,
                            territoryId: territory.id,
                            errorType: actualQueenId ? 'wrong_queen' : 'orphaned_parasite',
                            detectedAt: performance.now()
                        };
                    }
                }
            }

            if (error) {
                const errorKey = parasiteId;

                if (!this.controlErrors.has(errorKey)) {
                    this.controlErrors.set(errorKey, error);
                    errorsFound.push(error);
                    stats.parasiteControlErrors++;

                    log(`Parasite control error detected: ${parasiteId} - ${error.errorType}`);
                }
            }
        }

        for (const error of errorsFound) {
            this.attemptRecovery(error, stats, log);
        }
    }

    private findQueenControllingParasite(parasiteId: string): string | null {
        const territories = this.territoryManager.getAllTerritories();
        if (!territories || !Array.isArray(territories)) {
            return null;
        }

        for (const territory of territories) {
            if (!territory) {
                continue;
            }

            const queen = territory.queen;
            if (queen && queen.isActiveQueen()) {
                const controlledParasites = queen.getControlledParasites();
                if (controlledParasites && controlledParasites.includes(parasiteId)) {
                    return queen.id;
                }
            }
        }

        return null;
    }

    private findQueenById(queenId: string): Queen | null {
        const territories = this.territoryManager.getAllTerritories();
        if (!territories || !Array.isArray(territories)) {
            return null;
        }

        for (const territory of territories) {
            if (!territory) {
                continue;
            }

            const queen = territory.queen;
            if (queen && queen.id === queenId) {
                return queen;
            }
        }

        return null;
    }

    private attemptRecovery(error: ParasiteControlError, stats: ErrorRecoveryStats, log: (msg: string) => void): void {
        stats.totalRecoveryAttempts++;

        try {
            let recoverySuccessful = false;

            switch (error.errorType) {
                case 'orphaned_parasite':
                    if (error.expectedQueenId) {
                        const territory = this.territoryManager.getTerritory(error.territoryId);
                        const queen = territory?.queen;
                        if (queen && queen.isActiveQueen()) {
                            queen.addControlledParasite(error.parasiteId);
                            recoverySuccessful = true;
                            log(`Orphaned parasite ${error.parasiteId} assigned to Queen ${queen.id}`);
                        }
                    } else if (error.actualQueenId) {
                        const wrongQueen = this.findQueenById(error.actualQueenId);
                        if (wrongQueen) {
                            wrongQueen.removeControlledParasite(error.parasiteId);
                            recoverySuccessful = true;
                            log(`Parasite ${error.parasiteId} removed from wrong Queen ${error.actualQueenId}`);
                        }
                    }
                    break;

                case 'wrong_queen':
                    if (error.expectedQueenId && error.actualQueenId) {
                        const wrongQueen = this.findQueenById(error.actualQueenId);
                        const correctQueen = this.findQueenById(error.expectedQueenId);

                        if (wrongQueen && correctQueen) {
                            wrongQueen.removeControlledParasite(error.parasiteId);
                            correctQueen.addControlledParasite(error.parasiteId);
                            recoverySuccessful = true;
                            log(`Parasite ${error.parasiteId} transferred from Queen ${error.actualQueenId} to Queen ${error.expectedQueenId}`);
                        }
                    }
                    break;

                case 'missing_territory':
                    if (error.actualQueenId) {
                        const queen = this.findQueenById(error.actualQueenId);
                        if (queen) {
                            queen.removeControlledParasite(error.parasiteId);
                            recoverySuccessful = true;
                            log(`Parasite ${error.parasiteId} removed from Queen control (outside territories)`);
                        }
                    }
                    break;

                case 'duplicate_control':
                    if (error.expectedQueenId) {
                        const territories = this.territoryManager.getAllTerritories();
                        if (!territories || !Array.isArray(territories)) {
                            break;
                        }

                        for (const territory of territories) {
                            if (!territory) {
                                continue;
                            }

                            const queen = territory.queen;
                            if (queen && queen.id !== error.expectedQueenId) {
                                const controlledParasites = queen.getControlledParasites();
                                if (controlledParasites.includes(error.parasiteId)) {
                                    queen.removeControlledParasite(error.parasiteId);
                                }
                            }
                        }
                        recoverySuccessful = true;
                        log(`Duplicate control removed for parasite ${error.parasiteId}`);
                    }
                    break;
            }

            if (recoverySuccessful) {
                this.controlErrors.delete(error.parasiteId);
                stats.successfulRecoveries++;
            }

        } catch (recoveryError) {
            log(`Error during parasite control recovery: ${recoveryError}`);
        }
    }

    public getErrorCount(): number {
        return this.controlErrors.size;
    }

    public clear(): void {
        this.controlErrors.clear();
    }

    public updateConfig(config: ErrorRecoveryConfig): void {
        this.config = config;
    }
}
