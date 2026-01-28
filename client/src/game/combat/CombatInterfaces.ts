/**
 * CombatInterfaces - Type definitions for combat system
 *
 * Contains all interfaces and types used by the combat system.
 * Extracted from CombatSystem.ts for SOLID compliance.
 */

import { Vector3 } from '@babylonjs/core';

/**
 * Represents a valid combat target
 */
export interface CombatTarget {
    id: string;
    position: Vector3;
    health: number;
    maxHealth: number;
    takeDamage(amount: number): boolean; // Returns true if destroyed
    onDestroyed(): void;
}

/**
 * Result of target validation
 */
export interface TargetValidation {
    isValid: boolean;
    reason: 'valid' | 'friendly' | 'out_of_range' | 'invalid_type' | 'insufficient_energy';
    requiredEnergy?: number;
    currentRange?: number;
    maxRange?: number;
}

/**
 * Result of an attack action
 */
export interface AttackResult {
    success: boolean;
    damageDealt: number;
    targetDestroyed: boolean;
    energyConsumed: number;
    energyRewarded: number;
}

/**
 * Combat system configuration
 */
export interface CombatConfig {
    protectorDetectionRange: number; // 10 units - auto-detection range
    protectorAttackRange: number; // 8 units - attack range
    attackEnergyCost: number; // 5 energy per attack
    attackCooldown: number; // 1000ms between attacks
    parasiteReward: number; // 10 energy for destroying parasite
    aiUnitRewards: {
        worker: number; // 15 energy
        scout: number; // 12 energy
        protector: number; // 20 energy
    };
    autoAttackEnabled: boolean; // Global auto-attack toggle
}

/**
 * Combat performance metrics for monitoring system performance during combat
 */
export interface CombatPerformanceMetrics {
    activeCombatCount: number;
    attacksPerSecond: number;
    averageAttackProcessingTime: number; // milliseconds
    targetValidationsPerSecond: number;
    combatStateCleanups: number;
    lastUpdateTime: number;
    frameTimeImpact: number; // milliseconds added to frame time
}

/**
 * Performance summary for external monitoring
 */
export interface CombatPerformanceSummary {
    isPerformingWell: boolean;
    activeCombats: number;
    attacksPerSecond: number;
    averageProcessingTime: number;
    frameImpact: number;
    recommendations: string[];
}

/**
 * Hive assault result
 */
export interface HiveAssaultResult {
    success: boolean;
    totalDamage: number;
    energyConsumed: number;
    assaultDifficulty: 'easy' | 'moderate' | 'hard';
    recommendedProtectors: number;
}

/**
 * Detection range validation result
 */
export interface DetectionRangeValidation {
    isValid: boolean;
    detectionRange: number;
    combatRange: number;
    issues: string[];
}

/**
 * Default combat configuration
 */
export const DEFAULT_COMBAT_CONFIG: CombatConfig = {
    protectorDetectionRange: 10,
    protectorAttackRange: 8,
    attackEnergyCost: 1,
    attackCooldown: 1000,
    parasiteReward: 10,
    aiUnitRewards: {
        worker: 15,
        scout: 12,
        protector: 20
    },
    autoAttackEnabled: true
};
