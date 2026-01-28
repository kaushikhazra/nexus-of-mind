/**
 * Error Recovery Module - Barrel exports
 */

// Interfaces and types
export type {
    ErrorRecoveryConfig,
    TerritoryOverlapError,
    QueenCorruptionError,
    HiveConstructionError,
    ParasiteControlError,
    ErrorRecoveryStats
} from './ErrorRecoveryInterfaces';

export { DEFAULT_ERROR_RECOVERY_CONFIG, createInitialStats } from './ErrorRecoveryInterfaces';

// Recovery modules
export { TerritoryOverlapRecovery } from './TerritoryOverlapRecovery';
export { QueenCorruptionRecovery } from './QueenCorruptionRecovery';
export { HiveConstructionRecovery } from './HiveConstructionRecovery';
export { ParasiteControlRecovery } from './ParasiteControlRecovery';

// Main coordinator
export { ErrorRecoveryManager } from './ErrorRecoveryManager';
