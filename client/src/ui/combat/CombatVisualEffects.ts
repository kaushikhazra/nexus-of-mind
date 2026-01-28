/**
 * CombatVisualEffects - Visual effects for combat actions
 *
 * Handles energy beams, damage effects, destruction effects, and floating numbers.
 */

import { Scene, Vector3, Color3 } from '@babylonjs/core';
import type { CombatEffects, EnergyBeamConfig, DamageEffectConfig, DestructionEffectConfig, FloatingNumberConfig } from '../../rendering/CombatEffects';

export class CombatVisualEffects {
    private scene: Scene;
    private combatEffects: CombatEffects;

    constructor(scene: Scene, combatEffects: CombatEffects) {
        this.scene = scene;
        this.combatEffects = combatEffects;
    }

    public createEnergyBeamEffect(protectorPosition: Vector3, targetPosition: Vector3, color?: Color3): string {
        const beamConfig: EnergyBeamConfig = {
            scene: this.scene,
            startPosition: protectorPosition,
            endPosition: targetPosition,
            width: 0.3,
            pulseSpeed: 3.0,
            duration: 800,
            color: color || new Color3(0, 1, 1)
        };

        return this.combatEffects.createEnergyBeam(beamConfig);
    }

    public createDamageEffect(targetPosition: Vector3, damageAmount: number, effectType: 'hit' | 'critical' | 'blocked' = 'hit'): string {
        const damageConfig: DamageEffectConfig = {
            scene: this.scene,
            targetPosition: targetPosition,
            damageAmount: damageAmount,
            effectType: effectType,
            duration: 1200
        };

        return this.combatEffects.createDamageEffect(damageConfig);
    }

    public createDestructionEffect(targetPosition: Vector3, targetSize: number, explosionType: 'small' | 'medium' | 'large' = 'medium'): string {
        const destructionConfig: DestructionEffectConfig = {
            scene: this.scene,
            position: targetPosition,
            targetSize: targetSize,
            explosionType: explosionType,
            duration: 2500
        };

        return this.combatEffects.createDestructionEffect(destructionConfig);
    }

    public createFloatingEnergyNumber(position: Vector3, energyChange: number, isGain: boolean = true): string {
        const numberConfig: FloatingNumberConfig = {
            position: position,
            value: Math.abs(energyChange),
            type: isGain ? 'energy_gain' : 'energy_loss',
            scene: this.scene
        };

        return this.combatEffects.createFloatingNumber(numberConfig);
    }

    public createFloatingDamageNumber(position: Vector3, damage: number): string {
        const numberConfig: FloatingNumberConfig = {
            position: position,
            value: damage,
            type: 'damage',
            scene: this.scene
        };

        return this.combatEffects.createFloatingNumber(numberConfig);
    }

    public playCompleteAttackSequence(
        protectorPosition: Vector3,
        targetPosition: Vector3,
        damage: number,
        energyCost: number,
        targetDestroyed: boolean = false,
        energyReward: number = 0
    ): void {
        this.createEnergyBeamEffect(protectorPosition, targetPosition);

        setTimeout(() => {
            this.createDamageEffect(targetPosition, damage, damage > 2 ? 'critical' : 'hit');
            this.createFloatingDamageNumber(targetPosition, damage);
        }, 200);

        this.createFloatingEnergyNumber(protectorPosition, energyCost, false);

        if (targetDestroyed) {
            setTimeout(() => {
                this.createDestructionEffect(targetPosition, 2.0, 'medium');

                if (energyReward > 0) {
                    setTimeout(() => {
                        this.createFloatingEnergyNumber(targetPosition, energyReward, true);
                    }, 500);
                }
            }, 600);
        }
    }
}
