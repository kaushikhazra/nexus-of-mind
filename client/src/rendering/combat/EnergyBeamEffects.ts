/**
 * EnergyBeamEffects - Energy beam visualization for combat
 *
 * Creates animated energy beam effects from attackers to targets.
 */

import {
    Scene, Vector3, Mesh, MeshBuilder, StandardMaterial, Animation
} from '@babylonjs/core';
import type { EnergyBeamConfig } from './CombatEffectInterfaces';
import type { CombatEffectMaterials } from './CombatEffectMaterials';

export class EnergyBeamEffects {
    private scene: Scene;
    private materials: CombatEffectMaterials;

    constructor(scene: Scene, materials: CombatEffectMaterials) {
        this.scene = scene;
        this.materials = materials;
    }

    public createEnergyBeam(
        config: EnergyBeamConfig,
        effectId: string,
        trackMaterial: (id: string, mat: StandardMaterial) => void
    ): Mesh[] {
        const effects: Mesh[] = [];

        const beam = this.createBeamLine(config.startPosition, config.endPosition, config.width || 0.2);
        if (beam && this.materials.beamMaterial) {
            const clonedMaterial = this.materials.beamMaterial.clone(`beam_material_${effectId}`);
            beam.material = clonedMaterial;
            trackMaterial(effectId, clonedMaterial);

            if (config.color) {
                clonedMaterial.diffuseColor = config.color;
                clonedMaterial.emissiveColor = config.color.scale(0.8);
            }

            beam.renderingGroupId = 2;
            effects.push(beam);

            this.animateBeamPulse(beam, config.pulseSpeed || 2.0);
        }

        const impactEffect = this.createBeamImpact(config.endPosition, effectId, trackMaterial);
        if (impactEffect) {
            effects.push(impactEffect);
        }

        return effects;
    }

    private createBeamLine(start: Vector3, end: Vector3, width: number): Mesh | null {
        if (!this.scene) return null;

        const distance = Vector3.Distance(start, end);
        const beam = MeshBuilder.CreateCylinder('energy_beam', {
            height: distance,
            diameter: width,
            tessellation: 8
        }, this.scene);

        const midPoint = Vector3.Lerp(start, end, 0.5);
        beam.position = midPoint;

        beam.lookAt(end);
        beam.rotate(Vector3.Right(), Math.PI / 2);

        return beam;
    }

    private createBeamImpact(
        position: Vector3,
        effectId: string,
        trackMaterial: (id: string, mat: StandardMaterial) => void
    ): Mesh | null {
        if (!this.scene || !this.materials.hitEffectMaterial) return null;

        const impact = MeshBuilder.CreateSphere('beam_impact', {
            diameter: 1.0,
            segments: 8
        }, this.scene);

        impact.position = position.clone();
        const clonedMaterial = this.materials.hitEffectMaterial.clone('impact_material');
        impact.material = clonedMaterial;
        trackMaterial(effectId, clonedMaterial);
        impact.renderingGroupId = 2;

        this.animateImpactScale(impact);

        return impact;
    }

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

    private animateImpactScale(impact: Mesh): void {
        if (!this.scene) return;

        const frameRate = 30;
        const duration = 0.3;

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
}
