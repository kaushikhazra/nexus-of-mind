/**
 * UnitMaterials - Material management for unit rendering
 *
 * Handles creation and management of materials for different unit types.
 * Extracted from UnitRenderer.ts for SOLID compliance.
 */

import { Scene, StandardMaterial, Color3 } from '@babylonjs/core';

/**
 * Unit type configuration
 */
export interface UnitTypeConfig {
    color: Color3;
    accentColor: Color3;
    radius: number;
    segments: number;
}

/**
 * UnitMaterialManager - Manages unit rendering materials
 */
export class UnitMaterialManager {
    private scene: Scene;

    // Materials for different unit types
    public workerMaterial: StandardMaterial | null = null;
    public scoutMaterial: StandardMaterial | null = null;
    public protectorMaterial: StandardMaterial | null = null;
    public selectionMaterial: StandardMaterial | null = null;
    public energyIndicatorMaterial: StandardMaterial | null = null;

    // Accent materials
    public workerAccentMaterial: StandardMaterial | null = null;
    public scoutAccentMaterial: StandardMaterial | null = null;
    public protectorAccentMaterial: StandardMaterial | null = null;

    // Protector-specific materials
    public protectorGunMaterial: StandardMaterial | null = null;
    public protectorGunGlowMaterial: StandardMaterial | null = null;
    public protectorVisorMaterial: StandardMaterial | null = null;

    // Cached base emissive colors
    public workerBaseEmissive: Color3 | null = null;
    public scoutBaseEmissive: Color3 | null = null;
    public protectorBaseEmissive: Color3 | null = null;

    // Unit type configurations
    public readonly unitConfigs = {
        worker: { color: new Color3(0.2, 0.5, 0.2), accentColor: new Color3(0.4, 0.4, 0.4), radius: 0.35, segments: 8 },
        scout: { color: new Color3(0.2, 0.2, 0.8), accentColor: new Color3(0.3, 0.3, 0.5), radius: 0.25, segments: 6 },
        protector: { color: new Color3(0.8, 0.2, 0.2), accentColor: new Color3(0.5, 0.3, 0.3), radius: 0.4, segments: 10 }
    };

    constructor(scene: Scene) {
        this.scene = scene;
        this.initializeMaterials();
    }

    private initializeMaterials(): void {
        // Worker material
        this.workerMaterial = new StandardMaterial('workerMaterial', this.scene);
        this.workerMaterial.diffuseColor = this.unitConfigs.worker.color;
        this.workerMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
        this.workerMaterial.emissiveColor = this.unitConfigs.worker.color.scale(0.05);
        this.workerMaterial.alpha = 0.35;
        this.workerMaterial.needDepthPrePass = true;
        this.workerMaterial.separateCullingPass = true;

        // Scout material
        this.scoutMaterial = new StandardMaterial('scoutMaterial', this.scene);
        this.scoutMaterial.diffuseColor = this.unitConfigs.scout.color;
        this.scoutMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        this.scoutMaterial.emissiveColor = this.unitConfigs.scout.color.scale(0.1);

        // Protector material
        this.protectorMaterial = new StandardMaterial('protectorMaterial', this.scene);
        this.protectorMaterial.diffuseColor = this.unitConfigs.protector.color;
        this.protectorMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
        this.protectorMaterial.emissiveColor = this.unitConfigs.protector.color.scale(0.05);
        this.protectorMaterial.alpha = 0.35;
        this.protectorMaterial.needDepthPrePass = true;
        this.protectorMaterial.separateCullingPass = true;

        // Selection indicator material
        this.selectionMaterial = new StandardMaterial('selectionMaterial', this.scene);
        this.selectionMaterial.diffuseColor = new Color3(1, 1, 0);
        this.selectionMaterial.emissiveColor = new Color3(0.3, 0.3, 0);
        this.selectionMaterial.wireframe = true;

        // Energy indicator material
        this.energyIndicatorMaterial = new StandardMaterial('energyIndicatorMaterial', this.scene);
        this.energyIndicatorMaterial.diffuseColor = new Color3(0, 1, 1);
        this.energyIndicatorMaterial.emissiveColor = new Color3(0, 0.3, 0.3);

        // Accent materials
        this.workerAccentMaterial = new StandardMaterial('workerAccentMaterial', this.scene);
        this.workerAccentMaterial.diffuseColor = this.unitConfigs.worker.accentColor;
        this.workerAccentMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
        this.workerAccentMaterial.emissiveColor = new Color3(0.05, 0.05, 0.05);

        this.scoutAccentMaterial = new StandardMaterial('scoutAccentMaterial', this.scene);
        this.scoutAccentMaterial.diffuseColor = this.unitConfigs.scout.accentColor;
        this.scoutAccentMaterial.specularColor = new Color3(0.2, 0.2, 0.2);

        this.protectorAccentMaterial = new StandardMaterial('protectorAccentMaterial', this.scene);
        this.protectorAccentMaterial.diffuseColor = this.unitConfigs.protector.accentColor;
        this.protectorAccentMaterial.specularColor = new Color3(0.2, 0.2, 0.2);

        // Protector gun materials
        this.protectorGunMaterial = new StandardMaterial('protectorGunMaterial', this.scene);
        this.protectorGunMaterial.diffuseColor = new Color3(0.2, 0.2, 0.25);
        this.protectorGunMaterial.specularColor = new Color3(0.4, 0.4, 0.5);
        this.protectorGunMaterial.emissiveColor = new Color3(0.05, 0.05, 0.08);

        this.protectorGunGlowMaterial = new StandardMaterial('protectorGunGlowMaterial', this.scene);
        this.protectorGunGlowMaterial.diffuseColor = new Color3(0.2, 0.8, 1.0);
        this.protectorGunGlowMaterial.emissiveColor = new Color3(0.3, 0.9, 1.2);
        this.protectorGunGlowMaterial.specularColor = new Color3(0.5, 0.9, 1.0);
        this.protectorGunGlowMaterial.disableLighting = true;

        this.protectorVisorMaterial = new StandardMaterial('protectorVisorMaterial', this.scene);
        this.protectorVisorMaterial.diffuseColor = new Color3(1.0, 0.2, 0.1);
        this.protectorVisorMaterial.emissiveColor = new Color3(0.8, 0.1, 0.0);
        this.protectorVisorMaterial.disableLighting = true;

        // Cache base emissive colors
        this.workerBaseEmissive = this.unitConfigs.worker.color.scale(0.1);
        this.scoutBaseEmissive = this.unitConfigs.scout.color.scale(0.1);
        this.protectorBaseEmissive = this.unitConfigs.protector.color.scale(0.1);
    }

    public getUnitMaterial(unitType: string): StandardMaterial | null {
        switch (unitType) {
            case 'worker': return this.workerMaterial;
            case 'scout': return this.scoutMaterial;
            case 'protector': return this.protectorMaterial;
            default: return null;
        }
    }

    public getBaseEmissiveColor(unitType: string): Color3 | null {
        switch (unitType) {
            case 'worker': return this.workerBaseEmissive;
            case 'scout': return this.scoutBaseEmissive;
            case 'protector': return this.protectorBaseEmissive;
            default: return null;
        }
    }

    public dispose(): void {
        this.workerMaterial?.dispose();
        this.scoutMaterial?.dispose();
        this.protectorMaterial?.dispose();
        this.selectionMaterial?.dispose();
        this.energyIndicatorMaterial?.dispose();
        this.workerAccentMaterial?.dispose();
        this.scoutAccentMaterial?.dispose();
        this.protectorAccentMaterial?.dispose();
        this.protectorGunMaterial?.dispose();
        this.protectorGunGlowMaterial?.dispose();
        this.protectorVisorMaterial?.dispose();
    }
}
