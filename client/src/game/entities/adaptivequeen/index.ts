/**
 * AdaptiveQueen module - Barrel exports
 *
 * Re-exports all public APIs from the adaptive queen learning system.
 */

export { AdaptiveQueen } from './AdaptiveQueen';
export { AdaptiveQueenDataCollector } from './AdaptiveQueenDataCollector';
export { AdaptiveQueenStrategyApplier } from './AdaptiveQueenStrategyApplier';

export type {
    QueenLearningData,
    PlayerBehaviorObservation,
    Adaptation,
    DefensiveAction,
    PlayerEncounter,
    AssaultAttempt,
    UnitData,
    GameContext,
    MiningData,
    QueenDeathData,
    AssaultPattern,
    GameStateSnapshot,
    QueenStrategy,
    HivePlacementStrategy,
    SpawnStrategy,
    DefensiveStrategy,
    PredictiveStrategy,
    LearningProgress,
    AdaptiveQueenConfig
} from './AdaptiveQueenInterfaces';

export {
    createInitialLearningData,
    createInitialLearningProgress
} from './AdaptiveQueenInterfaces';
