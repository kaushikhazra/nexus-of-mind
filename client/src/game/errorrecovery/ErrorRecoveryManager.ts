/**
 * ErrorRecoveryManager - Comprehensive error handling coordinator
 *
 * Implements error detection and recovery mechanisms for:
 * - Territory overlap detection and correction
 * - Queen lifecycle corruption recovery
 * - Hive construction failure retry logic
 * - Parasite control consistency validation
 *
 * Refactored to delegate to extracted modules for SOLID compliance.
 */

import type { TerritoryManager } from '../TerritoryManager';
import type { ParasiteManager } from '../ParasiteManager';
import type { GameEngine } from '../GameEngine';
import type { ErrorRecoveryConfig, ErrorRecoveryStats } from './ErrorRecoveryInterfaces';
import { DEFAULT_ERROR_RECOVERY_CONFIG, createInitialStats } from './ErrorRecoveryInterfaces';
import { TerritoryOverlapRecovery } from './TerritoryOverlapRecovery';
import { QueenCorruptionRecovery } from './QueenCorruptionRecovery';
import { HiveConstructionRecovery } from './HiveConstructionRecovery';
import { ParasiteControlRecovery } from './ParasiteControlRecovery';

export class ErrorRecoveryManager {
    private territoryManager: TerritoryManager;
    private parasiteManager: ParasiteManager;
    private gameEngine: GameEngine;

    private config: ErrorRecoveryConfig;
    private stats: ErrorRecoveryStats;

    private territoryRecovery: TerritoryOverlapRecovery;
    private queenRecovery: QueenCorruptionRecovery;
    private hiveRecovery: HiveConstructionRecovery;
    private parasiteRecovery: ParasiteControlRecovery;

    private lastValidationTime: number = 0;
    private validationTimer: NodeJS.Timeout | null = null;

    constructor(
        territoryManager: TerritoryManager,
        parasiteManager: ParasiteManager,
        gameEngine: GameEngine,
        config: Partial<ErrorRecoveryConfig> = {}
    ) {
        this.territoryManager = territoryManager;
        this.parasiteManager = parasiteManager;
        this.gameEngine = gameEngine;

        this.config = { ...DEFAULT_ERROR_RECOVERY_CONFIG, ...config };
        this.stats = createInitialStats();

        this.territoryRecovery = new TerritoryOverlapRecovery(territoryManager, this.config);
        this.queenRecovery = new QueenCorruptionRecovery(territoryManager, this.config);
        this.hiveRecovery = new HiveConstructionRecovery(territoryManager, this.config);
        this.parasiteRecovery = new ParasiteControlRecovery(territoryManager, parasiteManager, this.config);

        this.startValidationTimer();
        this.log('ErrorRecoveryManager initialized');
    }

    private startValidationTimer(): void {
        if (this.validationTimer) {
            clearInterval(this.validationTimer);
        }

        this.validationTimer = setInterval(() => {
            this.performSystemValidation();
        }, this.config.validationIntervalMs);
    }

    public performSystemValidation(): void {
        const startTime = performance.now();
        this.lastValidationTime = startTime;
        this.stats.lastValidationTime = startTime;

        this.log('Starting system validation...');

        this.territoryRecovery.detectOverlaps(this.stats, (msg) => this.log(msg));
        this.queenRecovery.detectCorruption(this.stats, (msg) => this.log(msg));
        this.hiveRecovery.detectFailures(this.stats, (msg) => this.log(msg));
        this.parasiteRecovery.validateControl(this.stats, (msg) => this.log(msg));
        this.processRecoveryAttempts();

        const endTime = performance.now();
        this.log(`System validation completed in ${(endTime - startTime).toFixed(2)}ms`);
    }

    private processRecoveryAttempts(): void {
        this.territoryRecovery.processRecoveries(this.stats);
        this.queenRecovery.processRecoveries(this.stats);
        this.hiveRecovery.processRecoveries(this.stats);
    }

    public getStats(): ErrorRecoveryStats {
        return { ...this.stats };
    }

    public getCurrentErrors(): {
        territoryOverlaps: number;
        queenCorruptions: number;
        hiveConstructionFailures: number;
        parasiteControlErrors: number;
    } {
        return {
            territoryOverlaps: this.territoryRecovery.getErrorCount(),
            queenCorruptions: this.queenRecovery.getErrorCount(),
            hiveConstructionFailures: this.hiveRecovery.getErrorCount(),
            parasiteControlErrors: this.parasiteRecovery.getErrorCount()
        };
    }

    public forceValidation(): void {
        this.performSystemValidation();
    }

    public clearErrors(): void {
        this.territoryRecovery.clear();
        this.queenRecovery.clear();
        this.hiveRecovery.clear();
        this.parasiteRecovery.clear();

        this.stats.territoryOverlapErrors = 0;
        this.stats.queenCorruptionErrors = 0;
        this.stats.hiveConstructionErrors = 0;
        this.stats.parasiteControlErrors = 0;
    }

    public updateConfig(newConfig: Partial<ErrorRecoveryConfig>): void {
        this.config = { ...this.config, ...newConfig };

        this.territoryRecovery.updateConfig(this.config);
        this.queenRecovery.updateConfig(this.config);
        this.hiveRecovery.updateConfig(this.config);
        this.parasiteRecovery.updateConfig(this.config);

        if (newConfig.validationIntervalMs) {
            this.startValidationTimer();
        }
    }

    private log(message: string): void {
        if (this.config.enableLogging) {
            console.log(`🔧 ErrorRecovery: ${message}`);
        }
    }

    public dispose(): void {
        if (this.validationTimer) {
            clearInterval(this.validationTimer);
            this.validationTimer = null;
        }

        this.clearErrors();
        this.log('ErrorRecoveryManager disposed');
    }
}
