/**
 * ParasiteTypes - Type definitions and configurations for the Enhanced Parasite System
 * 
 * This file defines the core types, enums, and configurations for both Energy and Combat Parasites.
 * It provides the foundation for the dual-threat parasite ecosystem with distinct behaviors,
 * targeting priorities, and visual characteristics.
 */

import { Vector3 } from '@babylonjs/core';

/**
 * Enumeration of parasite types in the enhanced system
 */
export enum ParasiteType {
    ENERGY = 'energy',
    COMBAT = 'combat'
}

/**
 * Unit types that can be targeted by parasites
 */
export type UnitType = 'worker' | 'scout' | 'protector';

/**
 * Statistical configuration for each parasite type
 */
export interface ParasiteStats {
    health: number;
    maxHealth: number;
    speed: number;
    attackDamage: number;
    energyReward: number;
    visualScale: number;
}

/**
 * Configuration object defining stats for each parasite type
 */
export const PARASITE_STATS: Record<ParasiteType, ParasiteStats> = {
    [ParasiteType.ENERGY]: {
        health: 2,
        maxHealth: 2,
        speed: 2.0,
        attackDamage: 0, // Energy drain only, no direct damage
        energyReward: 2,
        visualScale: 1.0
    },
    [ParasiteType.COMBAT]: {
        health: 4,
        maxHealth: 4,
        speed: 2.5, // Faster than Energy Parasites for hunting capability
        attackDamage: 2,
        energyReward: 4, // 2x reward for 2x difficulty
        visualScale: 1.2 // 20% larger than Energy Parasites
    }
};

/**
 * Targeting behavior configuration for parasites
 */
export interface TargetingBehavior {
    primaryTargets: UnitType[];
    secondaryTargets: UnitType[];
    targetSwitchCooldown: number; // milliseconds
    maxTargetDistance: number;
    pursuitDistance: number;
}

/**
 * Configuration object defining targeting behaviors for each parasite type
 */
export const TARGETING_BEHAVIORS: Record<ParasiteType, TargetingBehavior> = {
    [ParasiteType.ENERGY]: {
        primaryTargets: ['worker'],
        secondaryTargets: [],
        targetSwitchCooldown: 2000, // 2 seconds
        maxTargetDistance: 50,
        pursuitDistance: 60
    },
    [ParasiteType.COMBAT]: {
        primaryTargets: ['protector'],
        secondaryTargets: ['worker'],
        targetSwitchCooldown: 1500, // 1.5 seconds (more aggressive target switching)
        maxTargetDistance: 60, // Larger detection range for better hunting
        pursuitDistance: 75 // Larger pursuit distance for more persistent hunting
    }
};

/**
 * Spawn distribution configuration for the enhanced parasite system
 */
export interface ParasiteSpawnDistribution {
    energyParasiteRate: number; // 0.75 (75%)
    combatParasiteRate: number; // 0.25 (25%)
    distributionAccuracy: number; // Tolerance for ratio enforcement (±10%)
}

/**
 * Default spawn distribution configuration
 */
export const DEFAULT_SPAWN_DISTRIBUTION: ParasiteSpawnDistribution = {
    energyParasiteRate: 0.75,
    combatParasiteRate: 0.25,
    distributionAccuracy: 0.10 // ±10% tolerance
};

/**
 * Record of parasite spawn for distribution tracking
 */
export interface ParasiteSpawnRecord {
    parasiteId: string;
    parasiteType: ParasiteType;
    spawnTime: number;
    depositId: string;
}

/**
 * Configuration for parasite creation
 */
export interface ParasiteConfig {
    position: Vector3;
    scene: any; // Babylon.js Scene
    materialManager: any; // MaterialManager instance
    homeDeposit: any; // MineralDeposit instance
    parasiteType: ParasiteType;
    stats: ParasiteStats;
    targetingBehavior: TargetingBehavior;
}

/**
 * Interface for distribution tracking and enforcement
 */
export interface DistributionTracker {
    getNextParasiteType(): ParasiteType;
    recordSpawn(parasiteType: ParasiteType, depositId: string): void;
    getCurrentRatio(): { energy: number; combat: number };
    isDistributionAccurate(): boolean;
    reset(): void;
}

/**
 * Utility functions for parasite type operations
 */
export class ParasiteTypeUtils {
    /**
     * Get stats for a specific parasite type
     */
    static getStats(parasiteType: ParasiteType): ParasiteStats {
        return PARASITE_STATS[parasiteType];
    }

    /**
     * Get targeting behavior for a specific parasite type
     */
    static getTargetingBehavior(parasiteType: ParasiteType): TargetingBehavior {
        return TARGETING_BEHAVIORS[parasiteType];
    }

    /**
     * Check if a unit type is a valid target for a parasite type
     */
    static isValidTarget(parasiteType: ParasiteType, unitType: UnitType): boolean {
        const behavior = TARGETING_BEHAVIORS[parasiteType];
        return behavior.primaryTargets.includes(unitType) || 
               behavior.secondaryTargets.includes(unitType);
    }

    /**
     * Get target priority for a unit type (lower number = higher priority)
     */
    static getTargetPriority(parasiteType: ParasiteType, unitType: UnitType): number {
        const behavior = TARGETING_BEHAVIORS[parasiteType];
        
        const primaryIndex = behavior.primaryTargets.indexOf(unitType);
        if (primaryIndex !== -1) {
            return primaryIndex; // 0 = highest priority
        }
        
        const secondaryIndex = behavior.secondaryTargets.indexOf(unitType);
        if (secondaryIndex !== -1) {
            return behavior.primaryTargets.length + secondaryIndex;
        }
        
        return Number.MAX_SAFE_INTEGER; // Invalid target
    }

    /**
     * Determine if a parasite type should target protectors first
     */
    static targetsProtectorsFirst(parasiteType: ParasiteType): boolean {
        const behavior = TARGETING_BEHAVIORS[parasiteType];
        return behavior.primaryTargets.includes('protector');
    }

    /**
     * Get all valid target types for a parasite type
     */
    static getAllValidTargets(parasiteType: ParasiteType): UnitType[] {
        const behavior = TARGETING_BEHAVIORS[parasiteType];
        return [...behavior.primaryTargets, ...behavior.secondaryTargets];
    }
}