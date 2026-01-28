/**
 * CombatEffectMaterials - Material management for combat effects
 *
 * Creates and manages materials used by energy beams, damage indicators,
 * and explosion effects.
 */

import { Scene, StandardMaterial, Color3 } from '@babylonjs/core';

export class CombatEffectMaterials {
    private scene: Scene;

    public beamMaterial: StandardMaterial | null = null;
    public hitEffectMaterial: StandardMaterial | null = null;
    public explosionMaterial: StandardMaterial | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
        this.createMaterials();
    }

    private createMaterials(): void {
        if (!this.scene) return;

        // Energy beam material
        this.beamMaterial = new StandardMaterial('energy_beam_material', this.scene);
        this.beamMaterial.diffuseColor = new Color3(1, 0.2, 0.1);
        this.beamMaterial.emissiveColor = new Color3(1, 0.1, 0);
        this.beamMaterial.alpha = 0.8;
        this.beamMaterial.disableLighting = true;

        // Hit effect material
        this.hitEffectMaterial = new StandardMaterial('hit_effect_material', this.scene);
        this.hitEffectMaterial.diffuseColor = new Color3(1, 0.5, 0);
        this.hitEffectMaterial.emissiveColor = new Color3(1, 0.3, 0);
        this.hitEffectMaterial.alpha = 0.7;
        this.hitEffectMaterial.disableLighting = true;

        // Explosion material
        this.explosionMaterial = new StandardMaterial('explosion_material', this.scene);
        this.explosionMaterial.diffuseColor = new Color3(1, 0.2, 0);
        this.explosionMaterial.emissiveColor = new Color3(1, 0.5, 0);
        this.explosionMaterial.alpha = 0.6;
        this.explosionMaterial.disableLighting = true;
    }

    public createCriticalMaterial(effectId: string): StandardMaterial {
        const criticalMaterial = new StandardMaterial(`critical_material_${effectId}`, this.scene);
        criticalMaterial.diffuseColor = new Color3(1, 1, 0);
        criticalMaterial.emissiveColor = new Color3(1, 0.8, 0);
        criticalMaterial.alpha = 0.8;
        criticalMaterial.disableLighting = true;
        return criticalMaterial;
    }

    public createBlockedMaterial(effectId: string): StandardMaterial {
        const blockedMaterial = new StandardMaterial(`blocked_material_${effectId}`, this.scene);
        blockedMaterial.diffuseColor = new Color3(0.5, 0.5, 1);
        blockedMaterial.emissiveColor = new Color3(0.3, 0.3, 0.8);
        blockedMaterial.alpha = 0.7;
        blockedMaterial.disableLighting = true;
        return blockedMaterial;
    }

    public dispose(): void {
        this.beamMaterial?.dispose();
        this.hitEffectMaterial?.dispose();
        this.explosionMaterial?.dispose();
        this.beamMaterial = null;
        this.hitEffectMaterial = null;
        this.explosionMaterial = null;
    }
}
