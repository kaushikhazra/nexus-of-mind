/**
 * CombatPhaseProcessor - Combat phase state machine processing
 *
 * Handles the processing of combat phases: detecting -> turning -> firing -> cooldown.
 * Extracted from CombatSystem.ts for SOLID compliance.
 */

import { Vector3 } from '@babylonjs/core';
import { Protector } from '../entities/Protector';
import type { CombatTarget, CombatConfig } from './CombatInterfaces';
import { CombatAction } from './CombatAction';
import { CombatEffectsCoordinator } from './CombatEffectsCoordinator';
import { CombatTargetPrioritizer } from './CombatTargetPriority';
import { CombatUINotificationManager } from './CombatUINotifications';
import { EnergyManager } from '../EnergyManager';

/**
 * Callbacks for phase processor to communicate with main system
 */
export interface PhaseProcessorCallbacks {
    getProtectorById: (protectorId: string) => Protector | null;
    getAllPotentialTargets: () => CombatTarget[];
    detectNearbyEnemies: (protector: Protector, range: number) => CombatTarget[];
    handleTargetDestruction: (target: CombatTarget) => void;
    resumeMovementAfterCombat: (protector: Protector) => void;
    moveProtectorToAttackRange: (protector: Protector, target: CombatTarget) => void;
    calculateDamage: (protector: Protector, target: CombatTarget) => number;
}

/**
 * CombatPhaseProcessor - Processes combat action phases
 */
export class CombatPhaseProcessor {
    private config: CombatConfig;
    private energyManager: EnergyManager;
    private effectsCoordinator: CombatEffectsCoordinator;
    private targetPrioritizer: CombatTargetPrioritizer;
    private uiNotifications: CombatUINotificationManager;
    private callbacks: PhaseProcessorCallbacks;

    constructor(
        config: CombatConfig,
        energyManager: EnergyManager,
        effectsCoordinator: CombatEffectsCoordinator,
        targetPrioritizer: CombatTargetPrioritizer,
        uiNotifications: CombatUINotificationManager,
        callbacks: PhaseProcessorCallbacks
    ) {
        this.config = config;
        this.energyManager = energyManager;
        this.effectsCoordinator = effectsCoordinator;
        this.targetPrioritizer = targetPrioritizer;
        this.uiNotifications = uiNotifications;
        this.callbacks = callbacks;
    }

    /**
     * Update configuration reference
     */
    public updateConfig(config: CombatConfig): void {
        this.config = config;
    }

    /**
     * Process a single combat phase
     */
    public processCombatPhase(combat: CombatAction): void {
        const protector = this.callbacks.getProtectorById(combat.protectorId);
        if (!protector) {
            combat.setState('completed');
            return;
        }

        const allTargets = this.callbacks.getAllPotentialTargets();
        const target = allTargets.find(t => t.id === combat.targetId);

        // Check if target is still valid
        if (!target || target.health <= 0) {
            this.handleTargetLostOrDestroyed(protector, combat);
            return;
        }

        // Check if still in range
        const distance = Vector3.Distance(protector.getPosition(), target.position);
        if (distance > this.config.protectorAttackRange) {
            combat.setState('engaging');
            this.callbacks.moveProtectorToAttackRange(protector, target);
            return;
        }

        // Process current phase
        this.processCurrentPhase(combat, protector, target);
    }

    /**
     * Handle target lost or destroyed scenario
     */
    private handleTargetLostOrDestroyed(protector: Protector, combat: CombatAction): void {
        // Look for new targets
        const nearbyEnemies = this.callbacks.detectNearbyEnemies(
            protector,
            this.config.protectorDetectionRange
        );

        if (nearbyEnemies.length > 0) {
            const newTarget = this.targetPrioritizer.selectTargetConsistently(protector, nearbyEnemies);
            if (newTarget) {
                combat.targetId = newTarget.id;
                combat.setState('detecting'); // Start fresh detection cycle
                return;
            }
        }

        // No more targets - complete combat
        combat.setState('completed');
        protector.clearFacingTarget();
        this.callbacks.resumeMovementAfterCombat(protector);
    }

    /**
     * Process the current combat phase
     */
    private processCurrentPhase(combat: CombatAction, protector: Protector, target: CombatTarget): void {
        switch (combat.state) {
            case 'detecting':
                this.processDetectingPhase(combat, protector, target);
                break;

            case 'turning':
                this.processTurningPhase(combat, protector, target);
                break;

            case 'firing':
                this.processFiringPhase(combat);
                break;

            case 'cooldown':
                this.processCooldownPhase(combat);
                break;

            case 'engaging':
                this.processEngagingPhase(combat, protector, target);
                break;

            default:
                // Other states (moving, resuming_movement, completed) - no action needed
                break;
        }
    }

    /**
     * Process detecting phase - immediately transition to turning
     */
    private processDetectingPhase(combat: CombatAction, protector: Protector, target: CombatTarget): void {
        protector.faceTarget(target.position);
        combat.setState('turning');
    }

    /**
     * Process turning phase - rotate to face target
     */
    private processTurningPhase(combat: CombatAction, protector: Protector, target: CombatTarget): void {
        protector.faceTarget(target.position);
        if (combat.isTurnPhaseComplete()) {
            combat.setState('firing');
            this.executeAttackVisuals(protector, target, combat);
        }
    }

    /**
     * Process firing phase - laser beam active
     */
    private processFiringPhase(combat: CombatAction): void {
        if (combat.isFirePhaseComplete()) {
            combat.setState('cooldown');
        }
    }

    /**
     * Process cooldown phase - wait before next cycle
     */
    private processCooldownPhase(combat: CombatAction): void {
        if (combat.isCooldownPhaseComplete()) {
            combat.setState('detecting');
        }
    }

    /**
     * Process engaging phase - moving to attack range
     */
    private processEngagingPhase(combat: CombatAction, protector: Protector, target: CombatTarget): void {
        const distance = Vector3.Distance(protector.getPosition(), target.position);
        if (distance <= this.config.protectorAttackRange) {
            combat.setState('detecting');
        }
    }

    /**
     * Execute attack visuals and damage (called during firing phase)
     */
    private executeAttackVisuals(protector: Protector, target: CombatTarget, combat: CombatAction): void {
        // Check if we have enough energy
        if (!this.energyManager.canConsumeEnergy(protector.getId(), this.config.attackEnergyCost)) {
            this.uiNotifications.showEnergyShortage(protector.getId(), this.config.attackEnergyCost);
            return;
        }

        // Consume energy
        this.energyManager.consumeEnergy(protector.getId(), this.config.attackEnergyCost, 'combat_attack');

        // Create laser beam visual effect
        this.effectsCoordinator.createAttackEffect(protector.getPosition(), target.position);

        // Calculate and apply damage
        const damage = this.callbacks.calculateDamage(protector, target);
        const targetDestroyed = target.takeDamage(damage);

        // Record the attack
        combat.recordAttack();

        // Handle target destruction
        if (targetDestroyed) {
            this.effectsCoordinator.createDestructionEffect(target.position);
            this.callbacks.handleTargetDestruction(target);
        }
    }
}
