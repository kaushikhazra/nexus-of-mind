/**
 * AdaptiveQueen - Re-export from refactored module location
 *
 * This file re-exports the AdaptiveQueen from its new modular location
 * for backwards compatibility with existing imports.
 */

export { AdaptiveQueen } from './adaptivequeen/AdaptiveQueen';

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
} from './adaptivequeen/AdaptiveQueenInterfaces';

export {
    createInitialLearningData,
    createInitialLearningProgress
} from './adaptivequeen/AdaptiveQueenInterfaces';
