/**
 * CombatTerritory - Territory-specific combat logic for Queen and Hive assault
 *
 * Handles coordinated assaults on territorial targets including difficulty
 * scaling and multi-protector coordination.
 * Extracted from CombatSystem.ts for SOLID compliance.
 */

import { Vector3 } from '@babylonjs/core';
import type { CombatTarget, AttackResult, HiveAssaultResult, CombatConfig } from './CombatInterfaces';
import { Protector } from '../entities/Protector';
import { EnergyManager } from '../EnergyManager';
import { CombatEffectsCoordinator } from './CombatEffectsCoordinator';

/**
 * CombatTerritoryManager - Handles territory-specific combat operations
 */
export class CombatTerritoryManager {
    private config: CombatConfig;
    private energyManager: EnergyManager;
    private effectsCoordinator: CombatEffectsCoordinator;
    private calculateDamageFn: (protector: Protector, target: CombatTarget) => number;
    private canProtectorAttackFn: (protector: Protector) => boolean;

    constructor(
        config: CombatConfig,
        energyManager: EnergyManager,
        effectsCoordinator: CombatEffectsCoordinator,
        calculateDamageFn: (protector: Protector, target: CombatTarget) => number,
        canProtectorAttackFn: (protector: Protector) => boolean
    ) {
        this.config = config;
        this.energyManager = energyManager;
        this.effectsCoordinator = effectsCoordinator;
        this.calculateDamageFn = calculateDamageFn;
        this.canProtectorAttackFn = canProtectorAttackFn;
    }

    /**
     * Update configuration reference
     */
    public updateConfig(config: CombatConfig): void {
        this.config = config;
    }

    /**
     * Coordinate multi-protector hive assault
     * Implements difficulty scaling for single vs multiple protectors
     */
    public coordinateHiveAssault(hive: any, protectors: Protector[]): HiveAssaultResult {
        const { Hive } = require('../entities/Hive');

        if (!(hive instanceof Hive) || !hive.isHiveConstructed()) {
            return {
                success: false,
                totalDamage: 0,
                energyConsumed: 0,
                assaultDifficulty: 'hard',
                recommendedProtectors: 3
            };
        }

        const protectorCount = protectors.length;
        let assaultDifficulty: 'easy' | 'moderate' | 'hard' = 'hard';
        let recommendedProtectors = 3;

        // Calculate assault difficulty based on protector count and hive defenses
        const defensiveParasites = hive.getActiveDefensiveParasiteCount();

        // Difficulty scaling algorithm
        if (protectorCount >= 3) {
            assaultDifficulty = 'easy';
            recommendedProtectors = 3;
        } else if (protectorCount === 2) {
            assaultDifficulty = 'moderate';
            recommendedProtectors = 3;
        } else {
            assaultDifficulty = 'hard';
            recommendedProtectors = Math.max(3, Math.ceil(defensiveParasites / 20));
        }

        // Execute coordinated attack
        const attackResult = this.coordinateMultiProtectorDamage(hive, protectors);

        return {
            success: attackResult.success,
            totalDamage: attackResult.damageDealt,
            energyConsumed: attackResult.energyConsumed,
            assaultDifficulty,
            recommendedProtectors
        };
    }

    /**
     * Coordinate damage from multiple protectors attacking the same target
     */
    public coordinateMultiProtectorDamage(
        target: CombatTarget,
        attackingProtectors: Protector[]
    ): AttackResult {
        const result: AttackResult = {
            success: false,
            damageDealt: 0,
            targetDestroyed: false,
            energyConsumed: 0,
            energyRewarded: 0
        };

        let totalDamage = 0;
        let totalEnergyConsumed = 0;
        const validAttackers: Protector[] = [];

        // Validate all attacking protectors and calculate total damage
        for (const protector of attackingProtectors) {
            if (this.canProtectorAttackFn(protector)) {
                // Consume energy for this protector's attack
                const energyConsumed = this.config.attackEnergyCost;
                if (this.energyManager.consumeEnergy(protector.getId(), energyConsumed, 'combat_attack')) {
                    const damage = this.calculateDamageFn(protector, target);
                    totalDamage += damage;
                    totalEnergyConsumed += energyConsumed;
                    validAttackers.push(protector);

                    // Create laser beam visual effect for each attacker
                    this.effectsCoordinator.createAttackEffect(protector.getPosition(), target.position);

                    // Make protector face the target
                    protector.faceTarget(target.position);
                }
            }
        }

        // If no valid attackers, return failed result
        if (validAttackers.length === 0) {
            return result;
        }

        // Apply accumulated damage to target
        const targetDestroyed = target.takeDamage(totalDamage);

        result.success = true;
        result.damageDealt = totalDamage;
        result.targetDestroyed = targetDestroyed;
        result.energyConsumed = totalEnergyConsumed;

        // Handle target destruction
        if (targetDestroyed) {
            this.effectsCoordinator.createDestructionEffect(target.position);
        }

        return result;
    }

    /**
     * Calculate hive assault damage with difficulty scaling
     */
    public calculateHiveAssaultDamage(hive: any, protectors: Protector[]): number {
        const { Hive } = require('../entities/Hive');

        if (!(hive instanceof Hive)) {
            return 0;
        }

        let totalDamage = 0;
        const protectorCount = protectors.length;

        // Calculate base damage from all protectors
        for (const protector of protectors) {
            const baseDamage = this.calculateDamageFn(protector, hive);
            totalDamage += baseDamage;
        }

        // Apply multi-protector coordination bonus
        if (protectorCount >= 2) {
            const coordinationBonus = Math.min(0.5, (protectorCount - 1) * 0.15); // Up to 50% bonus
            totalDamage *= (1 + coordinationBonus);
        }

        // Apply difficulty scaling - single protectors are less effective against hives
        if (protectorCount === 1) {
            totalDamage *= 0.6; // 40% damage reduction for solo assault
        }

        return Math.floor(totalDamage);
    }

    /**
     * Get assault difficulty assessment for a hive
     */
    public assessHiveAssaultDifficulty(hive: any, availableProtectors: number): {
        difficulty: 'easy' | 'moderate' | 'hard' | 'impossible';
        recommendedProtectors: number;
        hiveHealth: number;
        defensiveParasites: number;
    } {
        const { Hive } = require('../entities/Hive');

        if (!(hive instanceof Hive)) {
            return {
                difficulty: 'impossible',
                recommendedProtectors: 0,
                hiveHealth: 0,
                defensiveParasites: 0
            };
        }

        const hiveHealth = hive.health;
        const defensiveParasites = hive.getActiveDefensiveParasiteCount();

        // Calculate recommended protectors
        let recommendedProtectors = 3;
        if (defensiveParasites > 40) {
            recommendedProtectors = 5;
        } else if (defensiveParasites > 20) {
            recommendedProtectors = 4;
        }

        // Determine difficulty based on available protectors
        let difficulty: 'easy' | 'moderate' | 'hard' | 'impossible';
        if (availableProtectors >= recommendedProtectors) {
            difficulty = 'easy';
        } else if (availableProtectors >= recommendedProtectors - 1) {
            difficulty = 'moderate';
        } else if (availableProtectors >= 1) {
            difficulty = 'hard';
        } else {
            difficulty = 'impossible';
        }

        return {
            difficulty,
            recommendedProtectors,
            hiveHealth,
            defensiveParasites
        };
    }

    /**
     * Check if a Queen assault is advisable
     */
    public assessQueenAssault(queen: any, availableProtectors: number): {
        isAdvisable: boolean;
        reason: string;
        isVulnerable: boolean;
    } {
        const { Queen } = require('../entities/Queen');

        if (!(queen instanceof Queen)) {
            return {
                isAdvisable: false,
                reason: 'Not a valid Queen target',
                isVulnerable: false
            };
        }

        const isVulnerable = queen.isVulnerable();

        if (!isVulnerable) {
            return {
                isAdvisable: false,
                reason: 'Queen is not vulnerable - wait for active control phase',
                isVulnerable: false
            };
        }

        if (availableProtectors < 1) {
            return {
                isAdvisable: false,
                reason: 'No protectors available',
                isVulnerable: true
            };
        }

        return {
            isAdvisable: true,
            reason: 'Queen is vulnerable and protectors available',
            isVulnerable: true
        };
    }
}
