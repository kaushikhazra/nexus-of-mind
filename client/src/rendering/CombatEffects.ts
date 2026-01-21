/**
 * CombatEffects - Visual effects system for combat actions
 *
 * Provides energy beam effects, damage indicators, destruction effects,
 * and floating energy gain/loss numbers for the combat system.
 */

import { 
    Scene, Vector3, Mesh, MeshBuilder, StandardMaterial, Color3, 
    Animation, ParticleSystem, Texture, SphereParticleEmitter,
    LinesMesh, DynamicTexture, Color4
} from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock, Control } from '@babylonjs/gui';

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

export class CombatEffects {
    private scene: Scene;
    private activeEffects: Map<string, Mesh[]> = new Map();
    private effectMaterials: Map<string, StandardMaterial[]> = new Map();  // Track cloned materials for disposal
    private particleSystems: Map<string, ParticleSystem> = new Map();
    private floatingNumbers: Map<string, any> = new Map();
    private effectCounter: number = 0;

    // Materials
    private beamMaterial: StandardMaterial | null = null;
    private hitEffectMaterial: StandardMaterial | null = null;
    private explosionMaterial: StandardMaterial | null = null;

    // UI for floating numbers
    private advancedTexture: AdvancedDynamicTexture | null = null;
    private ownsUI: boolean = false;  // Track if we created the UI (for disposal)

    constructor(scene: Scene, sharedUI?: AdvancedDynamicTexture) {
        this.scene = scene;
        this.advancedTexture = sharedUI || null;
        this.initialize();
    }

    /**
     * Initialize the effects system
     */
    private initialize(): void {
        this.createMaterials();
        this.setupUI();
    }

    /**
     * Create materials for various effects
     */
    private createMaterials(): void {
        if (!this.scene) return;

        // Energy beam material
        this.beamMaterial = new StandardMaterial('energy_beam_material', this.scene);
        this.beamMaterial.diffuseColor = new Color3(1, 0.2, 0.1); // Red
        this.beamMaterial.emissiveColor = new Color3(1, 0.1, 0);
        this.beamMaterial.alpha = 0.8;
        this.beamMaterial.disableLighting = true;

        // Hit effect material
        this.hitEffectMaterial = new StandardMaterial('hit_effect_material', this.scene);
        this.hitEffectMaterial.diffuseColor = new Color3(1, 0.5, 0); // Orange
        this.hitEffectMaterial.emissiveColor = new Color3(1, 0.3, 0);
        this.hitEffectMaterial.alpha = 0.7;
        this.hitEffectMaterial.disableLighting = true;

        // Explosion material
        this.explosionMaterial = new StandardMaterial('explosion_material', this.scene);
        this.explosionMaterial.diffuseColor = new Color3(1, 0.2, 0); // Red-orange
        this.explosionMaterial.emissiveColor = new Color3(1, 0.5, 0);
        this.explosionMaterial.alpha = 0.6;
        this.explosionMaterial.disableLighting = true;
    }

    /**
     * Setup UI for floating numbers
     */
    private setupUI(): void {
        // UI will be set via setSharedUI() - don't create our own
        // This avoids the race condition where we create and then immediately dispose
    }

    /**
     * Set shared UI texture (for deferred initialization)
     * If we created our own UI, dispose it and use the shared one
     */
    public setSharedUI(sharedUI: AdvancedDynamicTexture): void {
        if (this.advancedTexture && this.ownsUI) {
            this.advancedTexture.dispose();
        }
        this.advancedTexture = sharedUI;
        this.ownsUI = false;
    }

    /**
     * Create energy beam effect from protector to target
     */
    public createEnergyBeam(config: EnergyBeamConfig): string {
        const effectId = this.generateEffectId();
        const effects: Mesh[] = [];

        // Create beam line
        const beam = this.createBeamLine(config.startPosition, config.endPosition, config.width || 0.2);
        if (beam && this.beamMaterial) {
            const clonedMaterial = this.beamMaterial.clone(`beam_material_${effectId}`);
            beam.material = clonedMaterial;
            this.trackMaterial(effectId, clonedMaterial);  // Track for disposal

            // Override color if specified
            if (config.color) {
                clonedMaterial.diffuseColor = config.color;
                clonedMaterial.emissiveColor = config.color.scale(0.8);
            }

            beam.renderingGroupId = 2; // Render on top of most objects
            effects.push(beam);

            // Add pulsing animation
            this.animateBeamPulse(beam, config.pulseSpeed || 2.0);
        }

        // Create beam impact effect at target
        const impactEffect = this.createBeamImpact(config.endPosition, effectId);
        if (impactEffect) {
            effects.push(impactEffect);
        }

        // Store effects
        this.activeEffects.set(effectId, effects);

        // Auto-cleanup after duration
        const duration = config.duration || 500; // 500ms default
        setTimeout(() => {
            this.removeEffect(effectId);
        }, duration);

        return effectId;
    }

    /**
     * Create beam line mesh
     */
    private createBeamLine(start: Vector3, end: Vector3, width: number): Mesh | null {
        if (!this.scene) return null;

        // Create cylinder beam
        const distance = Vector3.Distance(start, end);
        const beam = MeshBuilder.CreateCylinder('energy_beam', {
            height: distance,
            diameter: width,
            tessellation: 8
        }, this.scene);

        // Position and orient beam
        const midPoint = Vector3.Lerp(start, end, 0.5);
        beam.position = midPoint;

        // Orient beam to point from start to end
        const direction = end.subtract(start).normalize();
        const up = Vector3.Up();
        const right = Vector3.Cross(up, direction).normalize();
        const forward = Vector3.Cross(right, direction).normalize();

        // Set rotation to align with direction
        beam.lookAt(end);
        beam.rotate(Vector3.Right(), Math.PI / 2); // Align cylinder axis with direction

        return beam;
    }

    /**
     * Create beam impact effect
     */
    private createBeamImpact(position: Vector3, effectId: string): Mesh | null {
        if (!this.scene || !this.hitEffectMaterial) return null;

        // Create small sphere for impact
        const impact = MeshBuilder.CreateSphere('beam_impact', {
            diameter: 1.0,
            segments: 8
        }, this.scene);

        impact.position = position.clone();
        const clonedMaterial = this.hitEffectMaterial.clone('impact_material');
        impact.material = clonedMaterial;
        this.trackMaterial(effectId, clonedMaterial);  // Track for disposal
        impact.renderingGroupId = 2;

        // Add scaling animation
        this.animateImpactScale(impact);

        return impact;
    }

    /**
     * Animate beam pulsing effect
     */
    private animateBeamPulse(beam: Mesh, speed: number): void {
        if (!this.scene) return;

        const frameRate = 30;
        const animation = new Animation(
            'beamPulse',
            'material.alpha',
            frameRate,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        const keys = [];
        keys.push({ frame: 0, value: 0.3 });
        keys.push({ frame: frameRate / (speed * 2), value: 0.9 });
        keys.push({ frame: frameRate / speed, value: 0.3 });

        animation.setKeys(keys);
        beam.animations = [animation];
        this.scene.beginAnimation(beam, 0, frameRate / speed, true);
    }

    /**
     * Animate impact scaling effect
     */
    private animateImpactScale(impact: Mesh): void {
        if (!this.scene) return;

        const frameRate = 30;
        const duration = 0.3; // 300ms

        // Scale animation
        const scaleAnimation = new Animation(
            'impactScale',
            'scaling',
            frameRate,
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const scaleKeys = [];
        scaleKeys.push({ frame: 0, value: new Vector3(0.1, 0.1, 0.1) });
        scaleKeys.push({ frame: frameRate * 0.1, value: new Vector3(1.5, 1.5, 1.5) });
        scaleKeys.push({ frame: frameRate * duration, value: new Vector3(0.1, 0.1, 0.1) });

        scaleAnimation.setKeys(scaleKeys);

        // Alpha animation
        const alphaAnimation = new Animation(
            'impactAlpha',
            'material.alpha',
            frameRate,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const alphaKeys = [];
        alphaKeys.push({ frame: 0, value: 0.0 });
        alphaKeys.push({ frame: frameRate * 0.05, value: 1.0 });
        alphaKeys.push({ frame: frameRate * duration, value: 0.0 });

        alphaAnimation.setKeys(alphaKeys);

        impact.animations = [scaleAnimation, alphaAnimation];
        this.scene.beginAnimation(impact, 0, frameRate * duration, false);
    }

    /**
     * Create damage effect on target
     */
    public createDamageEffect(config: DamageEffectConfig): string {
        const effectId = this.generateEffectId();
        const effects: Mesh[] = [];

        // Create damage indicator based on type
        let damageIndicator: Mesh | null = null;

        switch (config.effectType || 'hit') {
            case 'hit':
                damageIndicator = this.createHitEffect(config.targetPosition, effectId);
                break;
            case 'critical':
                damageIndicator = this.createCriticalHitEffect(config.targetPosition, effectId);
                break;
            case 'blocked':
                damageIndicator = this.createBlockedEffect(config.targetPosition, effectId);
                break;
        }

        if (damageIndicator) {
            effects.push(damageIndicator);
        }

        // Create particle effect
        const particles = this.createDamageParticles(config.targetPosition, config.effectType || 'hit');
        if (particles) {
            this.particleSystems.set(effectId, particles);
        }

        // Store effects
        this.activeEffects.set(effectId, effects);

        // Auto-cleanup
        const duration = config.duration || 1000;
        setTimeout(() => {
            this.removeEffect(effectId);
        }, duration);

        return effectId;
    }

    /**
     * Create hit effect
     */
    private createHitEffect(position: Vector3, effectId: string): Mesh | null {
        if (!this.scene || !this.hitEffectMaterial) return null;

        const hit = MeshBuilder.CreateSphere('hit_effect', {
            diameter: 2.0,
            segments: 8
        }, this.scene);

        hit.position = position.clone();
        hit.position.y += 1; // Slightly above target
        const clonedMaterial = this.hitEffectMaterial.clone('hit_material');
        hit.material = clonedMaterial;
        this.trackMaterial(effectId, clonedMaterial);  // Track for disposal
        hit.renderingGroupId = 2;

        // Add hit animation
        this.animateHitEffect(hit);

        return hit;
    }

    /**
     * Create critical hit effect
     */
    private createCriticalHitEffect(position: Vector3, effectId: string): Mesh | null {
        if (!this.scene) return null;

        const critical = MeshBuilder.CreateSphere('critical_hit', {
            diameter: 3.0,
            segments: 12
        }, this.scene);

        critical.position = position.clone();
        critical.position.y += 1.5;

        // Create special critical material
        const criticalMaterial = new StandardMaterial('critical_material', this.scene);
        criticalMaterial.diffuseColor = new Color3(1, 1, 0); // Yellow
        criticalMaterial.emissiveColor = new Color3(1, 0.8, 0);
        criticalMaterial.alpha = 0.8;
        criticalMaterial.disableLighting = true;

        critical.material = criticalMaterial;
        this.trackMaterial(effectId, criticalMaterial);  // Track for disposal
        critical.renderingGroupId = 2;

        // Add critical animation (more dramatic)
        this.animateCriticalEffect(critical);

        return critical;
    }

    /**
     * Create blocked effect
     */
    private createBlockedEffect(position: Vector3, effectId: string): Mesh | null {
        if (!this.scene) return null;

        const blocked = MeshBuilder.CreateBox('blocked_effect', {
            size: 2.0
        }, this.scene);

        blocked.position = position.clone();
        blocked.position.y += 1;

        // Create blocked material
        const blockedMaterial = new StandardMaterial('blocked_material', this.scene);
        blockedMaterial.diffuseColor = new Color3(0.5, 0.5, 1); // Blue
        blockedMaterial.emissiveColor = new Color3(0.3, 0.3, 0.8);
        blockedMaterial.alpha = 0.7;
        blockedMaterial.disableLighting = true;

        blocked.material = blockedMaterial;
        this.trackMaterial(effectId, blockedMaterial);  // Track for disposal
        blocked.renderingGroupId = 2;

        // Add blocked animation
        this.animateBlockedEffect(blocked);

        return blocked;
    }

    /**
     * Create damage particle system
     */
    private createDamageParticles(position: Vector3, effectType: string): ParticleSystem | null {
        if (!this.scene) return null;

        const particles = new ParticleSystem('damage_particles', 50, this.scene);
        
        // Create emitter
        const emitter = MeshBuilder.CreateSphere('particle_emitter', { diameter: 0.1 }, this.scene);
        emitter.position = position.clone();
        emitter.isVisible = false;
        particles.emitter = emitter;

        // Configure particles based on effect type
        switch (effectType) {
            case 'hit':
                particles.particleTexture = this.createParticleTexture('#ff6600'); // Orange
                break;
            case 'critical':
                particles.particleTexture = this.createParticleTexture('#ffff00'); // Yellow
                break;
            case 'blocked':
                particles.particleTexture = this.createParticleTexture('#6666ff'); // Blue
                break;
        }

        // Particle properties
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

        // Start particles
        particles.start();

        // Stop after short duration
        setTimeout(() => {
            particles.stop();
            setTimeout(() => {
                particles.dispose();
                emitter.dispose();
            }, 1000);
        }, 200);

        return particles;
    }

    /**
     * Create particle texture
     */
    private createParticleTexture(color: string): DynamicTexture {
        const texture = new DynamicTexture('particle_texture', { width: 64, height: 64 }, this.scene);
        const context = texture.getContext();
        
        // Draw simple circle
        context.fillStyle = color;
        context.beginPath();
        context.arc(32, 32, 30, 0, 2 * Math.PI);
        context.fill();
        
        texture.update();
        return texture;
    }

    /**
     * Animate hit effect
     */
    private animateHitEffect(hit: Mesh): void {
        if (!this.scene) return;

        const frameRate = 30;
        const duration = 0.5;

        // Scale and fade animation
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

    /**
     * Animate critical effect
     */
    private animateCriticalEffect(critical: Mesh): void {
        if (!this.scene) return;

        const frameRate = 30;
        const duration = 0.8;

        // More dramatic scaling and rotation
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

    /**
     * Animate blocked effect
     */
    private animateBlockedEffect(blocked: Mesh): void {
        if (!this.scene) return;

        const frameRate = 30;
        const duration = 0.4;

        // Quick flash and shake
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

    /**
     * Create destruction effect and remove target
     */
    public createDestructionEffect(config: DestructionEffectConfig): string {
        const effectId = this.generateEffectId();
        const effects: Mesh[] = [];

        // Create explosion effect
        const explosion = this.createExplosion(config.position, config.targetSize, config.explosionType || 'medium', effectId);
        if (explosion) {
            effects.push(explosion);
        }

        // Create explosion particles
        const explosionParticles = this.createExplosionParticles(config.position, config.explosionType || 'medium');
        if (explosionParticles) {
            this.particleSystems.set(effectId, explosionParticles);
        }

        // Store effects
        this.activeEffects.set(effectId, effects);

        // Auto-cleanup
        const duration = config.duration || 2000;
        setTimeout(() => {
            this.removeEffect(effectId);
        }, duration);

        return effectId;
    }

    /**
     * Create explosion visual
     */
    private createExplosion(position: Vector3, targetSize: number, explosionType: string, effectId: string): Mesh | null {
        if (!this.scene || !this.explosionMaterial) return null;

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
        const clonedMaterial = this.explosionMaterial.clone('explosion_material');
        explosion.material = clonedMaterial;
        this.trackMaterial(effectId, clonedMaterial);  // Track for disposal
        explosion.renderingGroupId = 2;

        // Add explosion animation
        this.animateExplosion(explosion);

        return explosion;
    }

    /**
     * Create explosion particle system
     */
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

        // Stop after burst
        setTimeout(() => {
            particles.stop();
            setTimeout(() => {
                particles.dispose();
                emitter.dispose();
            }, 2000);
        }, 100);

        return particles;
    }

    /**
     * Animate explosion effect
     */
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

    /**
     * Create floating energy gain/loss numbers
     */
    public createFloatingNumber(config: FloatingNumberConfig): string {
        if (!this.advancedTexture) return '';

        const effectId = this.generateEffectId();

        // Create text block
        const textBlock = new TextBlock();
        textBlock.text = this.formatFloatingNumber(config.value, config.type);
        textBlock.color = this.getFloatingNumberColor(config.type);
        textBlock.fontSize = this.getFloatingNumberSize(config.type);
        textBlock.fontFamily = 'Orbitron, monospace';
        textBlock.fontWeight = 'bold';
        textBlock.outlineWidth = 2;
        textBlock.outlineColor = 'black';

        // Convert world position to screen coordinates
        const screenPos = this.worldToScreen(config.position);
        if (screenPos) {
            textBlock.leftInPixels = screenPos.x - 50;
            textBlock.topInPixels = screenPos.y - 30;
        }

        textBlock.widthInPixels = 100;
        textBlock.heightInPixels = 30;
        textBlock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        textBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;

        this.advancedTexture.addControl(textBlock);

        // Animate floating number
        this.animateFloatingNumber(textBlock, config.type);

        // Store reference
        this.floatingNumbers.set(effectId, textBlock);

        // Auto-cleanup
        setTimeout(() => {
            this.removeFloatingNumber(effectId);
        }, 2000);

        return effectId;
    }

    /**
     * Format floating number text
     */
    private formatFloatingNumber(value: number, type: string): string {
        switch (type) {
            case 'damage':
                return `-${Math.round(value)}`;
            case 'energy_gain':
                return `+${Math.round(value)}J`;
            case 'energy_loss':
                return `-${Math.round(value)}J`;
            default:
                return `${Math.round(value)}`;
        }
    }

    /**
     * Get floating number color
     */
    private getFloatingNumberColor(type: string): string {
        switch (type) {
            case 'damage': return '#ff4444';
            case 'energy_gain': return '#00ff00';
            case 'energy_loss': return '#ffaa00';
            default: return '#ffffff';
        }
    }

    /**
     * Get floating number size
     */
    private getFloatingNumberSize(type: string): number {
        switch (type) {
            case 'damage': return 18;
            case 'energy_gain': return 16;
            case 'energy_loss': return 16;
            default: return 14;
        }
    }

    /**
     * Animate floating number
     */
    private animateFloatingNumber(textBlock: TextBlock, type: string): void {
        const startY = textBlock.topInPixels;
        const endY = startY - 60; // Float upward
        const duration = 2000; // 2 seconds
        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out animation
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Update position
            textBlock.topInPixels = startY + (endY - startY) * easeProgress;
            
            // Fade out
            textBlock.alpha = 1 - progress;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Convert world position to screen coordinates
     */
    private worldToScreen(worldPos: Vector3): { x: number; y: number } | null {
        if (!this.scene) return null;

        const camera = this.scene.activeCamera;
        if (!camera) return null;

        const engine = this.scene.getEngine();
        const screenPos = Vector3.Project(
            worldPos,
            camera.getWorldMatrix(),
            camera.getProjectionMatrix(),
            camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
        );

        return { x: screenPos.x, y: screenPos.y };
    }

    /**
     * Remove effect by ID
     */
    public removeEffect(effectId: string): void {
        // Dispose tracked materials FIRST (before mesh disposal)
        const materials = this.effectMaterials.get(effectId);
        if (materials) {
            for (const material of materials) {
                material.dispose();
            }
            this.effectMaterials.delete(effectId);
        }

        // Remove mesh effects
        const effects = this.activeEffects.get(effectId);
        if (effects) {
            for (const effect of effects) {
                effect.dispose();
            }
            this.activeEffects.delete(effectId);
        }

        // Remove particle systems
        const particles = this.particleSystems.get(effectId);
        if (particles) {
            particles.dispose();
            this.particleSystems.delete(effectId);
        }

        // Remove floating numbers
        this.removeFloatingNumber(effectId);
    }

    /**
     * Remove floating number by ID
     */
    private removeFloatingNumber(effectId: string): void {
        const textBlock = this.floatingNumbers.get(effectId);
        if (textBlock && this.advancedTexture) {
            this.advancedTexture.removeControl(textBlock);
            this.floatingNumbers.delete(effectId);
        }
    }

    /**
     * Generate unique effect ID
     */
    private generateEffectId(): string {
        return `effect_${++this.effectCounter}_${Date.now()}`;
    }

    /**
     * Track a cloned material for later disposal
     */
    private trackMaterial(effectId: string, material: StandardMaterial): void {
        if (!this.effectMaterials.has(effectId)) {
            this.effectMaterials.set(effectId, []);
        }
        this.effectMaterials.get(effectId)!.push(material);
    }

    /**
     * Clear all active effects
     */
    public clearAllEffects(): void {
        // Dispose all tracked materials FIRST
        for (const [effectId, materials] of this.effectMaterials) {
            for (const material of materials) {
                material.dispose();
            }
        }
        this.effectMaterials.clear();

        // Clear mesh effects
        for (const [effectId, effects] of this.activeEffects) {
            for (const effect of effects) {
                effect.dispose();
            }
        }
        this.activeEffects.clear();

        // Clear particle systems
        for (const [effectId, particles] of this.particleSystems) {
            particles.dispose();
        }
        this.particleSystems.clear();

        // Clear floating numbers
        for (const [effectId, textBlock] of this.floatingNumbers) {
            if (this.advancedTexture) {
                this.advancedTexture.removeControl(textBlock);
            }
        }
        this.floatingNumbers.clear();
    }

    /**
     * Update effects system
     */
    public update(deltaTime: number): void {
        // Update any time-based effects or animations
        // Most animations are handled by Babylon.js animation system
    }

    /**
     * Dispose effects system
     */
    public dispose(): void {
        // Clear all active effects
        this.clearAllEffects();

        // Dispose materials
        if (this.beamMaterial) {
            this.beamMaterial.dispose();
            this.beamMaterial = null;
        }
        if (this.hitEffectMaterial) {
            this.hitEffectMaterial.dispose();
            this.hitEffectMaterial = null;
        }
        if (this.explosionMaterial) {
            this.explosionMaterial.dispose();
            this.explosionMaterial = null;
        }

        // Dispose UI only if we own it (created it ourselves)
        if (this.advancedTexture && this.ownsUI) {
            this.advancedTexture.dispose();
        }
        this.advancedTexture = null;
    }
}