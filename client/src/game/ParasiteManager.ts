/**
 * ParasiteManager - Re-export from refactored module location
 *
 * This file re-exports the ParasiteManager from its new modular location
 * for backwards compatibility with existing imports.
 */

export {
    ParasiteManager,
    type TerritorialParasiteConfig,
    type ParasiteManagerConfig,
    type ParasiteSpawnConfig
} from './parasite/ParasiteManager';
