/**
 * ErrorRecoveryInterfaces - Type definitions for error recovery system
 *
 * Contains all interfaces and types used by the error recovery system.
 */

import type { Territory } from '../TerritoryManager';
import type { Queen, QueenPhase } from '../entities/Queen';
import type { Hive } from '../entities/Hive';

export interface ErrorRecoveryConfig {
    maxRetryAttempts: number;
    retryDelayMs: number;
    validationIntervalMs: number;
    enableLogging: boolean;
}

export const DEFAULT_ERROR_RECOVERY_CONFIG: ErrorRecoveryConfig = {
    maxRetryAttempts: 3,
    retryDelayMs: 5000,
    validationIntervalMs: 10000,
    enableLogging: false
};

export interface TerritoryOverlapError {
    territory1: Territory;
    territory2: Territory;
    overlapArea: number;
    detectedAt: number;
}

export interface QueenCorruptionError {
    queen: Queen;
    expectedPhase: QueenPhase;
    actualPhase: QueenPhase;
    corruptionType: 'invalid_phase' | 'missing_hive' | 'invalid_vulnerability' | 'stuck_growth';
    detectedAt: number;
}

export interface HiveConstructionError {
    hive: Hive;
    errorType: 'timeout' | 'invalid_position' | 'construction_stuck' | 'missing_queen';
    attemptCount: number;
    lastAttemptAt: number;
}

export interface ParasiteControlError {
    parasiteId: string;
    expectedQueenId: string | null;
    actualQueenId: string | null;
    territoryId: string;
    errorType: 'orphaned_parasite' | 'wrong_queen' | 'duplicate_control' | 'missing_territory';
    detectedAt: number;
}

export interface ErrorRecoveryStats {
    territoryOverlapErrors: number;
    queenCorruptionErrors: number;
    hiveConstructionErrors: number;
    parasiteControlErrors: number;
    totalRecoveryAttempts: number;
    successfulRecoveries: number;
    lastValidationTime: number;
}

export function createInitialStats(): ErrorRecoveryStats {
    return {
        territoryOverlapErrors: 0,
        queenCorruptionErrors: 0,
        hiveConstructionErrors: 0,
        parasiteControlErrors: 0,
        totalRecoveryAttempts: 0,
        successfulRecoveries: 0,
        lastValidationTime: 0
    };
}
