/**
 * DamageEffects - Damage indicator visualization for combat
 *
 * Creates hit, critical hit, and blocked effects with animations.
 */

import {
    Scene, Vector3, Mesh, MeshBuilder, StandardMaterial, Animation,
    ParticleSystem, DynamicTexture
} from '@babylonjs/core';
import type { DamageEffectConfig } from './CombatEffectInterfaces';
import type { CombatEffectMaterials } from './CombatEffectMaterials';

export class DamageEffects {
    private scene: Scene;
    private materials: CombatEffectMaterials;

    constructor(scene: Scene, materials: CombatEffectMaterials) {
        this.scene = scene;
        this.materials = materials;
    }

    public createDamageEffect(
        config: DamageEffectConfig,
        effectId: string,
        trackMaterial: (id: string, mat: StandardMaterial) => void
    ): { meshes: Mesh[]; particles: ParticleSystem | null } {
        const meshes: Mesh[] = [];
        let damageIndicator: Mesh | null = null;

        switch (config.effectType || 'hit') {
            case 'hit':
                damageIndicator = this.createHitEffect(config.targetPosition, effectId, trackMaterial);
                break;
            case 'critical':
                damageIndicator = this.createCriticalHitEffect(config.targetPosition, effectId, trackMaterial);
                break;
            case 'blocked':
                damageIndicator = this.createBlockedEffect(config.targetPosition, effectId, trackMaterial);
                break;
        }

        if (damageIndicator) {
            meshes.push(damageIndicator);
        }

        const particles = this.createDamageParticles(config.targetPosition, config.effectType || 'hit');

        return { meshes, particles };
    }

    private createHitEffect(
        position: Vector3,
        effectId: string,
        trackMaterial: (id: string, mat: StandardMaterial) => void
    ): Mesh | null {
        if (!this.scene || !this.materials.hitEffectMaterial) return null;

        const hit = MeshBuilder.CreateSphere('hit_effect', {
            diameter: 2.0,
            segments: 8
        }, this.scene);

        hit.position = position.clone();
        hit.position.y += 1;
        const clonedMaterial = this.materials.hitEffectMaterial.clone('hit_material');
        hit.material = clonedMaterial;
        trackMaterial(effectId, clonedMaterial);
        hit.renderingGroupId = 2;

        this.animateHitEffect(hit);

        return hit;
    }

    private createCriticalHitEffect(
        position: Vector3,
        effectId: string,
        trackMaterial: (id: string, mat: StandardMaterial) => void
    ): Mesh | null {
        if (!this.scene) return null;

        const critical = MeshBuilder.CreateSphere('critical_hit', {
            diameter: 3.0,
            segments: 12
        }, this.scene);

        critical.position = position.clone();
        critical.position.y += 1.5;

        const criticalMaterial = this.materials.createCriticalMaterial(effectId);
        critical.material = criticalMaterial;
        trackMaterial(effectId, criticalMaterial);
        critical.renderingGroupId = 2;

        this.animateCriticalEffect(critical);

        return critical;
    }

    private createBlockedEffect(
        position: Vector3,
        effectId: string,
        trackMaterial: (id: string, mat: StandardMaterial) => void
    ): Mesh | null {
        if (!this.scene) return null;

        const blocked = MeshBuilder.CreateBox('blocked_effect', {
            size: 2.0
        }, this.scene);

        blocked.position = position.clone();
        blocked.position.y += 1;

        const blockedMaterial = this.materials.createBlockedMaterial(effectId);
        blocked.material = blockedMaterial;
        trackMaterial(effectId, blockedMaterial);
        blocked.renderingGroupId = 2;

        this.animateBlockedEffect(blocked);

        return blocked;
    }

    private createDamageParticles(position: Vector3, effectType: string): ParticleSystem | null {
        if (!this.scene) return null;

        const particles = new ParticleSystem('damage_particles', 50, this.scene);

        const emitter = MeshBuilder.CreateSphere('particle_emitter', { diameter: 0.1 }, this.scene);
        emitter.position = position.clone();
        emitter.isVisible = false;
        particles.emitter = emitter;

        switch (effectType) {
            case 'hit':
                particles.particleTexture = this.createParticleTexture('#ff6600');
                break;
            case 'critical':
                particles.particleTexture = this.createParticleTexture('#ffff00');
                break;
            case 'blocked':
                particles.particleTexture = this.createParticleTexture('#6666ff');
                break;
        }

        particles.minEmitBox = new Vector3(-0.5, 0, -0.5);
        particles.maxEmitBox = new Vector3(0.5, 0, 0.5);
        particles.minSize = 0.1;
        particles.maxSize = 0.3;
        particles.minLifeTime = 0.3;
        particles.maxLifeTime = 0.8;
        particles.emitRate = 100;
        particles.gravity = new Vector3(0, -9.8, 0);
        particles.direction1 = new Vector3(-1, 1, -1);
        particles.direction2 = new Vector3(1, 1, 1);
        particles.minEmitPower = 2;
        particles.maxEmitPower = 4;

        particles.start();

        setTimeout(() => {
            particles.stop();
            setTimeout(() => {
                particles.dispose();
                emitter.dispose();
            }, 1000);
        }, 200);

        return particles;
    }

    private createParticleTexture(color: string): DynamicTexture {
        const texture = new DynamicTexture('particle_texture', { width: 64, height: 64 }, this.scene);
        const context = texture.getContext();

        context.fillStyle = color;
        context.beginPath();
        context.arc(32, 32, 30, 0, 2 * Math.PI);
        context.fill();

        texture.update();
        return texture;
    }

    private animateHitEffect(hit: Mesh): void {
        if (!this.scene) return;

        const frameRate = 30;
        const duration = 0.5;

        const scaleAnimation = new Animation('hitScale', 'scaling', frameRate, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        const alphaAnimation = new Animation('hitAlpha', 'material.alpha', frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);

        const scaleKeys = [];
        scaleKeys.push({ frame: 0, value: new Vector3(0.1, 0.1, 0.1) });
        scaleKeys.push({ frame: frameRate * 0.1, value: new Vector3(1.2, 1.2, 1.2) });
        scaleKeys.push({ frame: frameRate * duration, value: new Vector3(0.5, 0.5, 0.5) });

        const alphaKeys = [];
        alphaKeys.push({ frame: 0, value: 0.0 });
        alphaKeys.push({ frame: frameRate * 0.1, value: 0.8 });
        alphaKeys.push({ frame: frameRate * duration, value: 0.0 });

        scaleAnimation.setKeys(scaleKeys);
        alphaAnimation.setKeys(alphaKeys);

        hit.animations = [scaleAnimation, alphaAnimation];
        this.scene.beginAnimation(hit, 0, frameRate * duration, false);
    }

    private animateCriticalEffect(critical: Mesh): void {
        if (!this.scene) return;

        const frameRate = 30;
        const duration = 0.8;

        const scaleAnimation = new Animation('criticalScale', 'scaling', frameRate, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        const rotationAnimation = new Animation('criticalRotation', 'rotation.y', frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        const alphaAnimation = new Animation('criticalAlpha', 'material.alpha', frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);

        const scaleKeys = [];
        scaleKeys.push({ frame: 0, value: new Vector3(0.1, 0.1, 0.1) });
        scaleKeys.push({ frame: frameRate * 0.2, value: new Vector3(1.8, 1.8, 1.8) });
        scaleKeys.push({ frame: frameRate * duration, value: new Vector3(0.3, 0.3, 0.3) });

        const rotationKeys = [];
        rotationKeys.push({ frame: 0, value: 0 });
        rotationKeys.push({ frame: frameRate * duration, value: Math.PI * 4 });

        const alphaKeys = [];
        alphaKeys.push({ frame: 0, value: 0.0 });
        alphaKeys.push({ frame: frameRate * 0.1, value: 1.0 });
        alphaKeys.push({ frame: frameRate * duration, value: 0.0 });

        scaleAnimation.setKeys(scaleKeys);
        rotationAnimation.setKeys(rotationKeys);
        alphaAnimation.setKeys(alphaKeys);

        critical.animations = [scaleAnimation, rotationAnimation, alphaAnimation];
        this.scene.beginAnimation(critical, 0, frameRate * duration, false);
    }

    private animateBlockedEffect(blocked: Mesh): void {
        if (!this.scene) return;

        const frameRate = 30;
        const duration = 0.4;

        const scaleAnimation = new Animation('blockedScale', 'scaling', frameRate, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        const positionAnimation = new Animation('blockedShake', 'position.x', frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        const alphaAnimation = new Animation('blockedAlpha', 'material.alpha', frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);

        const originalX = blocked.position.x;

        const scaleKeys = [];
        scaleKeys.push({ frame: 0, value: new Vector3(1.0, 1.0, 1.0) });
        scaleKeys.push({ frame: frameRate * 0.1, value: new Vector3(1.3, 1.3, 1.3) });
        scaleKeys.push({ frame: frameRate * duration, value: new Vector3(0.8, 0.8, 0.8) });

        const shakeKeys = [];
        shakeKeys.push({ frame: 0, value: originalX });
        shakeKeys.push({ frame: frameRate * 0.05, value: originalX + 0.2 });
        shakeKeys.push({ frame: frameRate * 0.1, value: originalX - 0.2 });
        shakeKeys.push({ frame: frameRate * 0.15, value: originalX + 0.1 });
        shakeKeys.push({ frame: frameRate * duration, value: originalX });

        const alphaKeys = [];
        alphaKeys.push({ frame: 0, value: 0.0 });
        alphaKeys.push({ frame: frameRate * 0.05, value: 0.9 });
        alphaKeys.push({ frame: frameRate * duration, value: 0.0 });

        scaleAnimation.setKeys(scaleKeys);
        positionAnimation.setKeys(shakeKeys);
        alphaAnimation.setKeys(alphaKeys);

        blocked.animations = [scaleAnimation, positionAnimation, alphaAnimation];
        this.scene.beginAnimation(blocked, 0, frameRate * duration, false);
    }
}
