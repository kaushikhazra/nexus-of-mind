/**
 * CombatAction - Combat state machine for individual combat actions
 *
 * Represents an ongoing combat action between a protector and target.
 * Manages combat phases: detecting -> turning -> firing -> cooldown.
 * Extracted from CombatSystem.ts for SOLID compliance.
 */

import { Vector3 } from '@babylonjs/core';

/**
 * Combat action state types
 */
export type CombatState =
    | 'moving'
    | 'detecting'
    | 'turning'
    | 'firing'
    | 'cooldown'
    | 'engaging'
    | 'resuming_movement'
    | 'completed';

/**
 * CombatAction - Represents an ongoing combat action between a protector and target
 *
 * Combat phases:
 * 1. detecting - Enemy detected, starting engagement
 * 2. turning - Rotating to face the target
 * 3. firing - Executing the laser attack
 * 4. cooldown - Waiting before next attack cycle
 */
export class CombatAction {
    public protectorId: string;
    public targetId: string;
    public state: CombatState;
    public startTime: number;
    public lastAttackTime: number;
    public phaseStartTime: number; // When current phase started
    public originalDestination: Vector3 | null;
    public detectionTriggered: boolean;

    // Phase durations (ms)
    public static readonly TURN_DURATION = 300; // Time to turn towards target
    public static readonly FIRE_DURATION = 250; // Laser beam duration
    public static readonly COOLDOWN_DURATION = 1000; // Wait before next detection
    public static readonly TIMEOUT_DURATION = 30000; // 30 second timeout

    constructor(protectorId: string, targetId: string, originalDestination?: Vector3) {
        this.protectorId = protectorId;
        this.targetId = targetId;
        this.state = 'detecting';
        this.startTime = performance.now();
        this.phaseStartTime = performance.now();
        this.lastAttackTime = 0;
        this.originalDestination = originalDestination || null;
        this.detectionTriggered = false;
    }

    /**
     * Update combat action state and reset phase timer
     */
    public setState(newState: CombatState): void {
        this.state = newState;
        this.phaseStartTime = performance.now();
    }

    /**
     * Get time elapsed in current phase (ms)
     */
    public getPhaseElapsed(): number {
        return performance.now() - this.phaseStartTime;
    }

    /**
     * Record attack execution
     */
    public recordAttack(): void {
        this.lastAttackTime = performance.now();
    }

    /**
     * Check if action is completed or timed out
     */
    public isCompleted(): boolean {
        return this.state === 'completed' ||
               (performance.now() - this.startTime > CombatAction.TIMEOUT_DURATION);
    }

    /**
     * Get action duration in seconds
     */
    public getDuration(): number {
        return (performance.now() - this.startTime) / 1000;
    }

    /**
     * Check if combat is in an active combat phase
     */
    public isInActiveCombat(): boolean {
        return this.state === 'detecting' ||
               this.state === 'turning' ||
               this.state === 'firing' ||
               this.state === 'cooldown';
    }

    /**
     * Check if turn phase is complete
     */
    public isTurnPhaseComplete(): boolean {
        return this.getPhaseElapsed() >= CombatAction.TURN_DURATION;
    }

    /**
     * Check if fire phase is complete
     */
    public isFirePhaseComplete(): boolean {
        return this.getPhaseElapsed() >= CombatAction.FIRE_DURATION;
    }

    /**
     * Check if cooldown phase is complete
     */
    public isCooldownPhaseComplete(): boolean {
        return this.getPhaseElapsed() >= CombatAction.COOLDOWN_DURATION;
    }
}
