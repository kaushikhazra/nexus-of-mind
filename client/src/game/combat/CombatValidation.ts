/**
 * CombatValidation - Target validation logic for combat system
 *
 * Handles validation of combat targets including friendly unit detection,
 * enemy type validation, range checking, and energy requirements.
 * Extracted from CombatSystem.ts for SOLID compliance.
 */

import { Vector3 } from '@babylonjs/core';
import type { CombatTarget, TargetValidation, CombatConfig } from './CombatInterfaces';
import { EnergyParasite } from '../entities/EnergyParasite';
import { Protector } from '../entities/Protector';
import { EnergyManager } from '../EnergyManager';

/**
 * CombatValidator - Handles all target validation logic
 */
export class CombatValidator {
    private config: CombatConfig;
    private energyManager: EnergyManager;
    private validationTimings: number[] = [];

    constructor(config: CombatConfig, energyManager: EnergyManager) {
        this.config = config;
        this.energyManager = energyManager;
    }

    /**
     * Update configuration reference
     */
    public updateConfig(config: CombatConfig): void {
        this.config = config;
    }

    /**
     * Validate if a target is valid for attack
     */
    public validateTarget(protector: Protector, target: CombatTarget): TargetValidation {
        const startTime = performance.now();

        // Check for null/undefined inputs
        if (!protector || !target) {
            this.recordValidationTiming(startTime);
            throw new Error('Protector and target must be provided');
        }

        // Check for invalid positions (NaN values)
        const protectorPos = protector.getPosition();
        const targetPos = target.position;

        if (isNaN(protectorPos.x) || isNaN(protectorPos.y) || isNaN(protectorPos.z) ||
            isNaN(targetPos.x) || isNaN(targetPos.y) || isNaN(targetPos.z)) {
            this.recordValidationTiming(startTime);
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }

        // Check if target is a friendly unit (reject friendly units)
        if (this.isFriendlyUnit(target)) {
            this.recordValidationTiming(startTime);
            return {
                isValid: false,
                reason: 'friendly'
            };
        }

        // Check if target is a valid enemy type
        if (!this.isValidEnemyTarget(target)) {
            this.recordValidationTiming(startTime);
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }

        // Check if protector has enough energy using global EnergyManager
        if (!this.energyManager.canConsumeEnergy(protector.getId(), this.config.attackEnergyCost)) {
            this.recordValidationTiming(startTime);
            return {
                isValid: false,
                reason: 'insufficient_energy',
                requiredEnergy: this.config.attackEnergyCost
            };
        }

        // Check range
        const distance = Vector3.Distance(protectorPos, targetPos);
        if (distance > this.config.protectorAttackRange) {
            this.recordValidationTiming(startTime);
            return {
                isValid: false,
                reason: 'out_of_range',
                currentRange: distance,
                maxRange: this.config.protectorAttackRange
            };
        }

        this.recordValidationTiming(startTime);
        return {
            isValid: true,
            reason: 'valid',
            currentRange: distance,
            maxRange: this.config.protectorAttackRange
        };
    }

    /**
     * Validate target type only (without range/energy checks)
     */
    public validateTargetType(target: CombatTarget): TargetValidation {
        // Check for null/undefined inputs
        if (!target) {
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }

        // Check for invalid positions (NaN values)
        const targetPos = target.position;

        if (isNaN(targetPos.x) || isNaN(targetPos.y) || isNaN(targetPos.z)) {
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }

        // Check if target is a friendly unit (reject friendly units)
        if (this.isFriendlyUnit(target)) {
            return {
                isValid: false,
                reason: 'friendly'
            };
        }

        // Check if target is a valid enemy type
        if (!this.isValidEnemyTarget(target)) {
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }

        return {
            isValid: true,
            reason: 'valid'
        };
    }

    /**
     * Validate target for auto-detection (type and basic checks only)
     * Used during enemy detection to filter valid targets before prioritization
     */
    public validateTargetForAutoDetection(target: CombatTarget): TargetValidation {
        const startTime = performance.now();

        // Use the existing type validation logic
        const validation = this.validateTargetType(target);

        // Additional checks specific to auto-detection
        if (validation.isValid) {
            // Check if target is already destroyed
            if (target.health <= 0) {
                this.recordValidationTiming(startTime);
                return {
                    isValid: false,
                    reason: 'invalid_type' // Destroyed targets are invalid
                };
            }

            // Check if target has valid health values
            if (isNaN(target.health) || isNaN(target.maxHealth) || target.maxHealth <= 0) {
                this.recordValidationTiming(startTime);
                return {
                    isValid: false,
                    reason: 'invalid_type'
                };
            }
        }

        this.recordValidationTiming(startTime);
        return validation;
    }

    /**
     * Validate Queen as combat target
     */
    public validateQueenTarget(protector: Protector, queen: any): TargetValidation {
        const { Queen } = require('../entities/Queen');

        if (!(queen instanceof Queen)) {
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }

        // Check if Queen is vulnerable (only during active control phase)
        if (!queen.isVulnerable()) {
            return {
                isValid: false,
                reason: 'invalid_type' // Invulnerable Queens are treated as invalid targets
            };
        }

        // Use standard target validation for range and energy checks
        return this.validateTarget(protector, queen);
    }

    /**
     * Validate Hive as combat target
     */
    public validateHiveTarget(protector: Protector, hive: any): TargetValidation {
        const { Hive } = require('../entities/Hive');

        if (!(hive instanceof Hive)) {
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }

        // Check if Hive is constructed (only constructed hives can be attacked)
        if (!hive.isHiveConstructed()) {
            return {
                isValid: false,
                reason: 'invalid_type' // Unconstructed Hives are treated as invalid targets
            };
        }

        // Use standard target validation for range and energy checks
        return this.validateTarget(protector, hive);
    }

    /**
     * Check if target is a friendly unit (reject friendly units)
     */
    public isFriendlyUnit(target: CombatTarget): boolean {
        // Import unit classes to check instanceof
        const { Worker } = require('../entities/Worker');
        const { Scout } = require('../entities/Scout');
        const { Protector } = require('../entities/Protector');

        // Check if target is any of our friendly unit types
        return target instanceof Worker ||
               target instanceof Scout ||
               target instanceof Protector;
    }

    /**
     * Check if target is a valid enemy
     */
    public isValidEnemyTarget(target: CombatTarget): boolean {
        // Energy Parasites are valid targets
        if (target instanceof EnergyParasite) {
            return true;
        }

        // Queens are valid targets when vulnerable
        const { Queen } = require('../entities/Queen');
        if (target instanceof Queen) {
            return (target as any).isVulnerable();
        }

        // Hives are valid targets when constructed
        const { Hive } = require('../entities/Hive');
        if (target instanceof Hive) {
            return (target as any).isHiveConstructed();
        }

        // Accept any target that implements CombatTarget interface
        // but is not a friendly unit
        return target.id !== undefined &&
               target.position !== undefined &&
               typeof target.health === 'number' &&
               !this.isFriendlyUnit(target);
    }

    /**
     * Record validation timing for performance monitoring
     */
    private recordValidationTiming(startTime: number): void {
        const processingTime = performance.now() - startTime;
        this.validationTimings.push(processingTime);
    }

    /**
     * Get and reset validation timings
     */
    public getAndResetValidationTimings(): number[] {
        const timings = [...this.validationTimings];
        this.validationTimings = [];
        return timings;
    }
}
