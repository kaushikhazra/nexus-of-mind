/**
 * Game Types - Main Export File
 *
 * This file exports all types, enums, interfaces, and utilities for the game,
 * providing a single import point for other modules.
 */

// Core type definitions and enums
export { ParasiteType, PARASITE_STATS, TARGETING_BEHAVIORS, DEFAULT_SPAWN_DISTRIBUTION, ParasiteTypeUtils } from './ParasiteTypes';

// Observation types for continuous learning
export type {
    Position,
    UnitPosition,
    MiningPosition,
    CombatEvent,
    MiningInterruptionEvent,
    PlayerStateData,
    QueenStateData,
    ObservationEvents,
    GameStateSnapshot,
    ObservationData,
    ObservationCollectorConfig,
    ObservationMessage,
    HeartbeatMessage
} from './ObservationTypes';

export { DEFAULT_OBSERVATION_CONFIG, ObservationUtils } from './ObservationTypes';

// Strategy types for Queen control
export { TargetPriority, FormationType, AttackTiming } from './StrategyTypes';

export type {
    SpawnControl,
    TacticalControl,
    StrategyDebugInfo,
    StrategyUpdate,
    StrategyUpdateMessage,
    SpawnDecision,
    SwarmBehavior
} from './StrategyTypes';

export {
    DEFAULT_STRATEGY,
    STRATEGY_STALENESS_THRESHOLD,
    STRATEGY_TRANSITION_DURATION,
    StrategyUtils
} from './StrategyTypes';
export type { 
    UnitType,
    ParasiteStats,
    TargetingBehavior,
    ParasiteSpawnDistribution,
    ParasiteSpawnRecord,
    ParasiteConfig,
    DistributionTracker as IDistributionTracker
} from './ParasiteTypes';

// Distribution tracking implementation
export { DistributionTracker } from './DistributionTracker';

// Re-export commonly used types for convenience
export type {
    ParasiteStats as Stats,
    TargetingBehavior as Targeting,
    ParasiteSpawnDistribution as SpawnDistribution,
    ParasiteConfig as Config
} from './ParasiteTypes';