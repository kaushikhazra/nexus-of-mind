/**
 * Combat Module - Barrel exports for combat system components
 */

// Interfaces and types
export type {
    CombatTarget,
    TargetValidation,
    AttackResult,
    CombatConfig,
    CombatPerformanceMetrics,
    CombatPerformanceSummary,
    HiveAssaultResult,
    DetectionRangeValidation
} from './CombatInterfaces';

export { DEFAULT_COMBAT_CONFIG } from './CombatInterfaces';

// Combat Action state machine
export { CombatAction } from './CombatAction';
export type { CombatState } from './CombatAction';

// Validation
export { CombatValidator } from './CombatValidation';

// Visual effects
export { CombatEffectsCoordinator, DEFAULT_ATTACK_EFFECT_CONFIG } from './CombatEffectsCoordinator';
export type { AttackEffectConfig } from './CombatEffectsCoordinator';

// Performance monitoring
export { CombatPerformanceMonitor, createDefaultMetrics } from './CombatPerformance';

// Target prioritization
export { CombatTargetPrioritizer } from './CombatTargetPriority';
export type { PrioritizedTarget } from './CombatTargetPriority';

// UI notifications
export { CombatUINotificationManager, DEFAULT_NOTIFICATION_CONFIG } from './CombatUINotifications';
export type { NotificationConfig } from './CombatUINotifications';

// Territory combat
export { CombatTerritoryManager } from './CombatTerritory';

// Phase processing
export { CombatPhaseProcessor } from './CombatPhaseProcessor';
export type { PhaseProcessorCallbacks } from './CombatPhaseProcessor';
