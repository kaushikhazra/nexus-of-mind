/**
 * DestructionEffects - Explosion and destruction visualization
 *
 * Creates explosion effects with animated meshes and particle systems.
 */

import {
    Scene, Vector3, Mesh, MeshBuilder, StandardMaterial, Animation,
    ParticleSystem, DynamicTexture
} from '@babylonjs/core';
import type { DestructionEffectConfig } from './CombatEffectInterfaces';
import type { CombatEffectMaterials } from './CombatEffectMaterials';

export class DestructionEffects {
    private scene: Scene;
    private materials: CombatEffectMaterials;

    constructor(scene: Scene, materials: CombatEffectMaterials) {
        this.scene = scene;
        this.materials = materials;
    }

    public createDestructionEffect(
        config: DestructionEffectConfig,
        effectId: string,
        trackMaterial: (id: string, mat: StandardMaterial) => void
    ): { meshes: Mesh[]; particles: ParticleSystem | null } {
        const meshes: Mesh[] = [];

        const explosion = this.createExplosion(
            config.position,
            config.targetSize,
            config.explosionType || 'medium',
            effectId,
            trackMaterial
        );
        if (explosion) {
            meshes.push(explosion);
        }

        const particles = this.createExplosionParticles(config.position, config.explosionType || 'medium');

        return { meshes, particles };
    }

    private createExplosion(
        position: Vector3,
        targetSize: number,
        explosionType: string,
        effectId: string,
        trackMaterial: (id: string, mat: StandardMaterial) => void
    ): Mesh | null {
        if (!this.scene || !this.materials.explosionMaterial) return null;

        let explosionSize = targetSize * 2;
        switch (explosionType) {
            case 'small': explosionSize = targetSize * 1.5; break;
            case 'medium': explosionSize = targetSize * 2.0; break;
            case 'large': explosionSize = targetSize * 3.0; break;
        }

        const explosion = MeshBuilder.CreateSphere('explosion', {
            diameter: explosionSize,
            segments: 16
        }, this.scene);

        explosion.position = position.clone();
        const clonedMaterial = this.materials.explosionMaterial.clone('explosion_material');
        explosion.material = clonedMaterial;
        trackMaterial(effectId, clonedMaterial);
        explosion.renderingGroupId = 2;

        this.animateExplosion(explosion);

        return explosion;
    }

    private createExplosionParticles(position: Vector3, explosionType: string): ParticleSystem | null {
        if (!this.scene) return null;

        let particleCount = 100;
        switch (explosionType) {
            case 'small': particleCount = 50; break;
            case 'medium': particleCount = 100; break;
            case 'large': particleCount = 200; break;
        }

        const particles = new ParticleSystem('explosion_particles', particleCount, this.scene);

        const emitter = MeshBuilder.CreateSphere('explosion_emitter', { diameter: 0.1 }, this.scene);
        emitter.position = position.clone();
        emitter.isVisible = false;
        particles.emitter = emitter;

        particles.particleTexture = this.createParticleTexture('#ff4400');
        particles.minEmitBox = new Vector3(-0.2, -0.2, -0.2);
        particles.maxEmitBox = new Vector3(0.2, 0.2, 0.2);
        particles.minSize = 0.2;
        particles.maxSize = 0.8;
        particles.minLifeTime = 0.5;
        particles.maxLifeTime = 1.5;
        particles.emitRate = particleCount * 2;
        particles.gravity = new Vector3(0, -5, 0);
        particles.direction1 = new Vector3(-2, 1, -2);
        particles.direction2 = new Vector3(2, 3, 2);
        particles.minEmitPower = 3;
        particles.maxEmitPower = 8;

        particles.start();

        setTimeout(() => {
            particles.stop();
            setTimeout(() => {
                particles.dispose();
                emitter.dispose();
            }, 2000);
        }, 100);

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

    private animateExplosion(explosion: Mesh): void {
        if (!this.scene) return;

        const frameRate = 30;
        const duration = 1.0;

        const scaleAnimation = new Animation('explosionScale', 'scaling', frameRate, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        const alphaAnimation = new Animation('explosionAlpha', 'material.alpha', frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);

        const scaleKeys = [];
        scaleKeys.push({ frame: 0, value: new Vector3(0.1, 0.1, 0.1) });
        scaleKeys.push({ frame: frameRate * 0.2, value: new Vector3(1.5, 1.5, 1.5) });
        scaleKeys.push({ frame: frameRate * duration, value: new Vector3(2.0, 2.0, 2.0) });

        const alphaKeys = [];
        alphaKeys.push({ frame: 0, value: 0.0 });
        alphaKeys.push({ frame: frameRate * 0.1, value: 0.8 });
        alphaKeys.push({ frame: frameRate * 0.3, value: 0.6 });
        alphaKeys.push({ frame: frameRate * duration, value: 0.0 });

        scaleAnimation.setKeys(scaleKeys);
        alphaAnimation.setKeys(alphaKeys);

        explosion.animations = [scaleAnimation, alphaAnimation];
        this.scene.beginAnimation(explosion, 0, frameRate * duration, false);
    }
}
