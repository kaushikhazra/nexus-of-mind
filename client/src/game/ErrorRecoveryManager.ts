/**
 * ErrorRecoveryManager - Re-export from refactored module location
 *
 * This file re-exports the ErrorRecoveryManager from its new modular location
 * for backwards compatibility with existing imports.
 */

export { ErrorRecoveryManager } from './errorrecovery/ErrorRecoveryManager';

export type {
    ErrorRecoveryConfig,
    TerritoryOverlapError,
    QueenCorruptionError,
    HiveConstructionError,
    ParasiteControlError,
    ErrorRecoveryStats
} from './errorrecovery/ErrorRecoveryInterfaces';
