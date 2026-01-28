/**
 * BuildingMaterials - Material management for building rendering
 *
 * Handles creation and management of all materials used for building visualization.
 */

import { Scene, StandardMaterial, Color3 } from '@babylonjs/core';

export class BuildingMaterials {
    public baseMaterial: StandardMaterial | null = null;
    public baseDomeMaterial: StandardMaterial | null = null;
    public baseGlowMaterial: StandardMaterial | null = null;
    public basePillarMaterial: StandardMaterial | null = null;
    public baseAntennaMaterial: StandardMaterial | null = null;
    public powerPlantMaterial: StandardMaterial | null = null;
    public powerPlantCoreMaterial: StandardMaterial | null = null;
    public powerPlantGlowMaterial: StandardMaterial | null = null;
    public powerPlantStructMaterial: StandardMaterial | null = null;
    public constructionMaterial: StandardMaterial | null = null;
    public energyIndicatorMaterial: StandardMaterial | null = null;

    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
        this.initializeMaterials();
    }

    private initializeMaterials(): void {
        this.baseMaterial = new StandardMaterial('baseMaterial', this.scene);
        this.baseMaterial.diffuseColor = new Color3(0.15, 0.2, 0.25);
        this.baseMaterial.specularColor = new Color3(0.4, 0.4, 0.4);
        this.baseMaterial.emissiveColor = new Color3(0.02, 0.05, 0.08);

        this.baseDomeMaterial = new StandardMaterial('baseDomeMaterial', this.scene);
        this.baseDomeMaterial.diffuseColor = new Color3(0.3, 0.7, 0.9);
        this.baseDomeMaterial.specularColor = new Color3(0.6, 0.6, 0.6);
        this.baseDomeMaterial.emissiveColor = new Color3(0.1, 0.2, 0.3);
        this.baseDomeMaterial.alpha = 0.6;

        this.baseGlowMaterial = new StandardMaterial('baseGlowMaterial', this.scene);
        this.baseGlowMaterial.diffuseColor = new Color3(0.3, 0.8, 1.0);
        this.baseGlowMaterial.emissiveColor = new Color3(0.4, 1.2, 1.5);
        this.baseGlowMaterial.disableLighting = true;

        this.basePillarMaterial = new StandardMaterial('basePillarMaterial', this.scene);
        this.basePillarMaterial.diffuseColor = new Color3(0.3, 0.35, 0.4);
        this.basePillarMaterial.specularColor = new Color3(0.5, 0.5, 0.5);
        this.basePillarMaterial.emissiveColor = new Color3(0.03, 0.04, 0.05);

        this.baseAntennaMaterial = new StandardMaterial('baseAntennaMaterial', this.scene);
        this.baseAntennaMaterial.diffuseColor = new Color3(0.6, 0.65, 0.7);
        this.baseAntennaMaterial.specularColor = new Color3(0.8, 0.8, 0.8);
        this.baseAntennaMaterial.emissiveColor = new Color3(0.1, 0.15, 0.2);

        this.powerPlantMaterial = new StandardMaterial('powerPlantMaterial', this.scene);
        this.powerPlantMaterial.diffuseColor = new Color3(0.9, 0.4, 0.1);
        this.powerPlantMaterial.specularColor = new Color3(0.4, 0.3, 0.2);
        this.powerPlantMaterial.emissiveColor = new Color3(0.15, 0.05, 0.0);
        this.powerPlantMaterial.alpha = 0.7;

        this.powerPlantCoreMaterial = new StandardMaterial('powerPlantCoreMaterial', this.scene);
        this.powerPlantCoreMaterial.diffuseColor = new Color3(1.0, 0.7, 0.2);
        this.powerPlantCoreMaterial.emissiveColor = new Color3(1.5, 0.8, 0.2);
        this.powerPlantCoreMaterial.disableLighting = true;

        this.powerPlantGlowMaterial = new StandardMaterial('powerPlantGlowMaterial', this.scene);
        this.powerPlantGlowMaterial.diffuseColor = new Color3(1.0, 0.6, 0.1);
        this.powerPlantGlowMaterial.emissiveColor = new Color3(1.2, 0.5, 0.1);
        this.powerPlantGlowMaterial.disableLighting = true;

        this.powerPlantStructMaterial = new StandardMaterial('powerPlantStructMaterial', this.scene);
        this.powerPlantStructMaterial.diffuseColor = new Color3(0.2, 0.18, 0.15);
        this.powerPlantStructMaterial.specularColor = new Color3(0.4, 0.35, 0.3);
        this.powerPlantStructMaterial.emissiveColor = new Color3(0.03, 0.02, 0.01);

        this.constructionMaterial = new StandardMaterial('constructionMaterial', this.scene);
        this.constructionMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);
        this.constructionMaterial.alpha = 0.7;
        this.constructionMaterial.wireframe = true;

        this.energyIndicatorMaterial = new StandardMaterial('buildingEnergyMaterial', this.scene);
        this.energyIndicatorMaterial.diffuseColor = new Color3(0, 1, 0);
        this.energyIndicatorMaterial.emissiveColor = new Color3(0, 0.3, 0);
    }

    public getMaterialForBuildingType(buildingTypeId: string): StandardMaterial | null {
        switch (buildingTypeId) {
            case 'base': return this.baseMaterial;
            case 'powerPlant': return this.powerPlantMaterial;
            default: return this.baseMaterial;
        }
    }

    public dispose(): void {
        this.baseMaterial?.dispose();
        this.baseDomeMaterial?.dispose();
        this.baseGlowMaterial?.dispose();
        this.basePillarMaterial?.dispose();
        this.baseAntennaMaterial?.dispose();
        this.powerPlantMaterial?.dispose();
        this.powerPlantCoreMaterial?.dispose();
        this.powerPlantGlowMaterial?.dispose();
        this.powerPlantStructMaterial?.dispose();
        this.constructionMaterial?.dispose();
        this.energyIndicatorMaterial?.dispose();
    }
}
