/**
 * CombatEffectInterfaces - Type definitions for combat visual effects
 *
 * Contains all interfaces and types used by the combat effects system.
 */

import { Scene, Vector3, Color3, Mesh, StandardMaterial, ParticleSystem } from '@babylonjs/core';
import { TextBlock } from '@babylonjs/gui';

export interface EffectConfig {
    scene: Scene;
    duration?: number;
    intensity?: number;
    color?: Color3;
}

export interface EnergyBeamConfig extends EffectConfig {
    startPosition: Vector3;
    endPosition: Vector3;
    width?: number;
    pulseSpeed?: number;
}

export interface DamageEffectConfig extends EffectConfig {
    targetPosition: Vector3;
    damageAmount: number;
    effectType?: 'hit' | 'critical' | 'blocked';
}

export interface DestructionEffectConfig extends EffectConfig {
    position: Vector3;
    targetSize: number;
    explosionType?: 'small' | 'medium' | 'large';
}

export interface FloatingNumberConfig {
    position: Vector3;
    value: number;
    type: 'damage' | 'energy_gain' | 'energy_loss';
    scene: Scene;
}

export interface EffectTrackingData {
    meshes: Mesh[];
    materials: StandardMaterial[];
    particleSystem?: ParticleSystem;
    floatingNumber?: TextBlock;
}
