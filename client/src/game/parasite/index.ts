/**
 * Parasite Module - Barrel exports for parasite system
 */

// Interfaces and types
export type {
    TerritorialParasiteConfig,
    ParasiteManagerConfig,
    ParasiteSpawnConfig,
    LifecycleStats,
    PerformanceStats,
    RenderingMetrics,
    TerritorialStats,
    ParasiteControlValidation
} from './ParasiteInterfaces';

export { DEFAULT_SPAWN_CONFIG } from './ParasiteInterfaces';

// Performance optimization
export { ParasitePerformanceOptimizer } from './ParasitePerformance';

// Territory integration
export { ParasiteTerritoryManager } from './ParasiteTerritory';

// Spawning
export { ParasiteSpawner } from './ParasiteSpawner';

// Statistics
export { ParasiteStatisticsCollector } from './ParasiteStatistics';

// Updater
export { ParasiteUpdater } from './ParasiteUpdater';

// Main manager
export { ParasiteManager } from './ParasiteManager';
