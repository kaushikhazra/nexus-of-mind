/**
 * CombatEffectsCoordinator - Visual effects coordination for combat
 *
 * Handles creation of laser beams, destruction effects, and other visual
 * feedback during combat. Extracted from CombatSystem.ts for SOLID compliance.
 */

import { Vector3, Scene } from '@babylonjs/core';
import { AdvancedDynamicTexture } from '@babylonjs/gui';
import { CombatEffects } from '../../rendering/CombatEffects';

/**
 * Configuration for attack effects
 */
export interface AttackEffectConfig {
    gunHeight: number;
    gunSideOffset: number;
    gunForwardOffset: number;
    beamDuration: number;
    beamWidth: number;
    secondBeamDelay: number;
}

/**
 * Default attack effect configuration
 */
export const DEFAULT_ATTACK_EFFECT_CONFIG: AttackEffectConfig = {
    gunHeight: 0.4,
    gunSideOffset: 0.35,
    gunForwardOffset: 0.1,
    beamDuration: 250,
    beamWidth: 0.08,
    secondBeamDelay: 50
};

/**
 * CombatEffectsCoordinator - Manages visual effects during combat
 */
export class CombatEffectsCoordinator {
    private scene: Scene | null = null;
    private combatEffects: CombatEffects | null = null;
    private config: AttackEffectConfig;

    constructor(scene?: Scene, sharedUI?: AdvancedDynamicTexture, config?: Partial<AttackEffectConfig>) {
        this.config = { ...DEFAULT_ATTACK_EFFECT_CONFIG, ...config };
        if (scene) {
            this.setScene(scene, sharedUI);
        }
    }

    /**
     * Set scene for visual effects (can be called after construction)
     */
    public setScene(scene: Scene, sharedUI?: AdvancedDynamicTexture): void {
        this.scene = scene;
        if (!this.combatEffects) {
            this.combatEffects = new CombatEffects(scene, sharedUI);
        }
    }

    /**
     * Set shared UI texture (for deferred initialization after UI is created)
     */
    public setSharedUI(sharedUI: AdvancedDynamicTexture): void {
        if (this.combatEffects) {
            this.combatEffects.setSharedUI(sharedUI);
        }
    }

    /**
     * Check if effects are initialized
     */
    public isInitialized(): boolean {
        return this.combatEffects !== null && this.scene !== null;
    }

    /**
     * Create laser beam effects from both guns to target
     */
    public createAttackEffect(attackerPos: Vector3, targetPos: Vector3): void {
        if (!this.combatEffects || !this.scene) return;

        // Calculate direction to target for gun offset
        const direction = targetPos.subtract(attackerPos).normalize();

        // Calculate perpendicular direction (left/right offset)
        const perpendicular = new Vector3(-direction.z, 0, direction.x).normalize();

        // Calculate left gun position
        const leftGunPos = attackerPos.clone()
            .add(new Vector3(0, this.config.gunHeight, 0))
            .add(perpendicular.scale(this.config.gunSideOffset))
            .add(direction.scale(this.config.gunForwardOffset));

        // Calculate right gun position
        const rightGunPos = attackerPos.clone()
            .add(new Vector3(0, this.config.gunHeight, 0))
            .add(perpendicular.scale(-this.config.gunSideOffset))
            .add(direction.scale(this.config.gunForwardOffset));

        // Target position (slightly above ground)
        const targetHitPos = targetPos.clone().add(new Vector3(0, 0.5, 0));

        // Create left gun laser
        this.combatEffects.createEnergyBeam({
            scene: this.scene,
            startPosition: leftGunPos,
            endPosition: targetHitPos,
            duration: this.config.beamDuration,
            width: this.config.beamWidth
        });

        // Create right gun laser (slight delay for visual effect)
        setTimeout(() => {
            if (this.combatEffects && this.scene) {
                this.combatEffects.createEnergyBeam({
                    scene: this.scene,
                    startPosition: rightGunPos,
                    endPosition: targetHitPos,
                    duration: this.config.beamDuration,
                    width: this.config.beamWidth
                });
            }
        }, this.config.secondBeamDelay);
    }

    /**
     * Create explosion effect when target is destroyed
     */
    public createDestructionEffect(position: Vector3): void {
        if (!this.combatEffects || !this.scene) return;

        this.combatEffects.createDestructionEffect({
            scene: this.scene,
            position: position.clone(),
            targetSize: 1.5,
            explosionType: 'small',
            duration: 1500
        });
    }

    /**
     * Create large destruction effect for high-value targets
     */
    public createLargeDestructionEffect(position: Vector3): void {
        if (!this.combatEffects || !this.scene) return;

        this.combatEffects.createDestructionEffect({
            scene: this.scene,
            position: position.clone(),
            targetSize: 3.0,
            explosionType: 'large',
            duration: 2500
        });
    }

    /**
     * Get the underlying CombatEffects instance
     */
    public getCombatEffects(): CombatEffects | null {
        return this.combatEffects;
    }

    /**
     * Dispose of effects resources
     */
    public dispose(): void {
        this.combatEffects = null;
        this.scene = null;
    }
}
