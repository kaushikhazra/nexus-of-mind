/**
 * CombatEffects - Visual effects coordinator for combat actions
 *
 * Provides energy beam effects, damage indicators, destruction effects,
 * and floating energy gain/loss numbers for the combat system.
 * Refactored to delegate to extracted modules for SOLID compliance.
 */

import { Scene, Mesh, StandardMaterial, ParticleSystem } from '@babylonjs/core';
import { AdvancedDynamicTexture } from '@babylonjs/gui';
import type {
    EnergyBeamConfig,
    DamageEffectConfig,
    DestructionEffectConfig,
    FloatingNumberConfig
} from './CombatEffectInterfaces';
import { CombatEffectMaterials } from './CombatEffectMaterials';
import { EnergyBeamEffects } from './EnergyBeamEffects';
import { DamageEffects } from './DamageEffects';
import { DestructionEffects } from './DestructionEffects';
import { FloatingNumberEffects } from './FloatingNumberEffects';

export class CombatEffects {
    private scene: Scene;
    private materials: CombatEffectMaterials;
    private beamEffects: EnergyBeamEffects;
    private damageEffects: DamageEffects;
    private destructionEffects: DestructionEffects;
    private floatingNumberEffects: FloatingNumberEffects;

    private activeEffects: Map<string, Mesh[]> = new Map();
    private effectMaterials: Map<string, StandardMaterial[]> = new Map();
    private particleSystems: Map<string, ParticleSystem> = new Map();
    private effectCounter: number = 0;

    constructor(scene: Scene, sharedUI?: AdvancedDynamicTexture) {
        this.scene = scene;
        this.materials = new CombatEffectMaterials(scene);
        this.beamEffects = new EnergyBeamEffects(scene, this.materials);
        this.damageEffects = new DamageEffects(scene, this.materials);
        this.destructionEffects = new DestructionEffects(scene, this.materials);
        this.floatingNumberEffects = new FloatingNumberEffects(scene, sharedUI);
    }

    public setSharedUI(sharedUI: AdvancedDynamicTexture): void {
        this.floatingNumberEffects.setSharedUI(sharedUI);
    }

    public createEnergyBeam(config: EnergyBeamConfig): string {
        const effectId = this.generateEffectId();

        const effects = this.beamEffects.createEnergyBeam(
            config,
            effectId,
            (id, mat) => this.trackMaterial(id, mat)
        );

        this.activeEffects.set(effectId, effects);

        const duration = config.duration || 500;
        setTimeout(() => {
            this.removeEffect(effectId);
        }, duration);

        return effectId;
    }

    public createDamageEffect(config: DamageEffectConfig): string {
        const effectId = this.generateEffectId();

        const { meshes, particles } = this.damageEffects.createDamageEffect(
            config,
            effectId,
            (id, mat) => this.trackMaterial(id, mat)
        );

        this.activeEffects.set(effectId, meshes);
        if (particles) {
            this.particleSystems.set(effectId, particles);
        }

        const duration = config.duration || 1000;
        setTimeout(() => {
            this.removeEffect(effectId);
        }, duration);

        return effectId;
    }

    public createDestructionEffect(config: DestructionEffectConfig): string {
        const effectId = this.generateEffectId();

        const { meshes, particles } = this.destructionEffects.createDestructionEffect(
            config,
            effectId,
            (id, mat) => this.trackMaterial(id, mat)
        );

        this.activeEffects.set(effectId, meshes);
        if (particles) {
            this.particleSystems.set(effectId, particles);
        }

        const duration = config.duration || 2000;
        setTimeout(() => {
            this.removeEffect(effectId);
        }, duration);

        return effectId;
    }

    public createFloatingNumber(config: FloatingNumberConfig): string {
        const effectId = this.generateEffectId();

        this.floatingNumberEffects.createFloatingNumber(config, effectId);

        setTimeout(() => {
            this.floatingNumberEffects.removeFloatingNumber(effectId);
        }, 2000);

        return effectId;
    }

    public removeEffect(effectId: string): void {
        const materials = this.effectMaterials.get(effectId);
        if (materials) {
            for (const material of materials) {
                material.dispose();
            }
            this.effectMaterials.delete(effectId);
        }

        const effects = this.activeEffects.get(effectId);
        if (effects) {
            for (const effect of effects) {
                effect.dispose();
            }
            this.activeEffects.delete(effectId);
        }

        const particles = this.particleSystems.get(effectId);
        if (particles) {
            particles.dispose();
            this.particleSystems.delete(effectId);
        }

        this.floatingNumberEffects.removeFloatingNumber(effectId);
    }

    public clearAllEffects(): void {
        for (const [effectId, materials] of this.effectMaterials) {
            for (const material of materials) {
                material.dispose();
            }
        }
        this.effectMaterials.clear();

        for (const [effectId, effects] of this.activeEffects) {
            for (const effect of effects) {
                effect.dispose();
            }
        }
        this.activeEffects.clear();

        for (const [effectId, particles] of this.particleSystems) {
            particles.dispose();
        }
        this.particleSystems.clear();

        this.floatingNumberEffects.clearAll();
    }

    public update(deltaTime: number): void {
        // Most animations are handled by Babylon.js animation system
    }

    public dispose(): void {
        this.clearAllEffects();
        this.materials.dispose();
        this.floatingNumberEffects.dispose();
    }

    private generateEffectId(): string {
        return `effect_${++this.effectCounter}_${Date.now()}`;
    }

    private trackMaterial(effectId: string, material: StandardMaterial): void {
        if (!this.effectMaterials.has(effectId)) {
            this.effectMaterials.set(effectId, []);
        }
        this.effectMaterials.get(effectId)!.push(material);
    }
}
