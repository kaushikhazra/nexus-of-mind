/**
 * ParasiteInterfaces - Type definitions for parasite system
 *
 * Contains all interfaces and types used by the ParasiteManager.
 * Extracted from ParasiteManager.ts for SOLID compliance.
 */

import { Scene, Vector3 } from '@babylonjs/core';
import { MaterialManager } from '../../rendering/MaterialManager';
import { Territory } from '../TerritoryManager';
import { Queen } from '../entities/Queen';

/**
 * Territorial parasite configuration
 */
export interface TerritorialParasiteConfig {
    territory: Territory;
    queen: Queen | null;
    spawnStrategy: 'defensive' | 'aggressive' | 'balanced';
    spawnRate: number;
}

/**
 * Parasite manager configuration
 */
export interface ParasiteManagerConfig {
    scene: Scene;
    materialManager: MaterialManager;
    terrainGenerator?: any;
}

/**
 * Parasite spawn configuration
 */
export interface ParasiteSpawnConfig {
    baseSpawnInterval: number;
    maxParasitesPerDeposit: number;
    spawnRadius: number;
    activeMiningMultiplier: number;
}

/**
 * Default spawn configuration
 */
export const DEFAULT_SPAWN_CONFIG: ParasiteSpawnConfig = {
    baseSpawnInterval: 0,
    maxParasitesPerDeposit: 1,
    spawnRadius: 65,
    activeMiningMultiplier: 1.5
};

/**
 * Lifecycle statistics
 */
export interface LifecycleStats {
    totalParasites: number;
    energyParasites: number;
    combatParasites: number;
    parasitesByDeposit: Map<string, number>;
    distributionAccuracy: number;
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
    optimizationLevel: number;
    maxActiveParasites: number;
    activeParasites: number;
    renderingOptimizations: string;
    lastPerformanceCheck: number;
}

/**
 * Rendering metrics
 */
export interface RenderingMetrics {
    totalMeshes: number;
    visibleMeshes: number;
    hiddenMeshes: number;
    materialInstances: number;
}

/**
 * Territorial statistics
 */
export interface TerritorialStats {
    territoriesWithQueens: number;
    territoriesLiberated: number;
    parasitesUnderQueenControl: number;
    territorialConfigs: number;
}

/**
 * Parasite control validation result
 */
export interface ParasiteControlValidation {
    orphanedParasites: string[];
    wrongQueenControl: Array<{ parasiteId: string; expectedQueenId: string; actualQueenId: string }>;
    duplicateControl: string[];
}
