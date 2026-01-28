/**
 * CombatUIMaterials - Material management for combat UI
 *
 * Handles creation and management of all materials used for combat UI visualization.
 */

import { Scene, StandardMaterial, Color3 } from '@babylonjs/core';

export class CombatUIMaterials {
    public combatRangeMaterial: StandardMaterial | null = null;
    public detectionRangeMaterial: StandardMaterial | null = null;
    public destinationMaterial: StandardMaterial | null = null;
    public validTargetMaterial: StandardMaterial | null = null;
    public invalidTargetMaterial: StandardMaterial | null = null;
    public detectedEnemyMaterial: StandardMaterial | null = null;

    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
        this.createMaterials();
    }

    private createMaterials(): void {
        this.combatRangeMaterial = new StandardMaterial('combat_range_material', this.scene);
        this.combatRangeMaterial.diffuseColor = new Color3(1, 0.5, 0);
        this.combatRangeMaterial.alpha = 0.3;
        this.combatRangeMaterial.wireframe = true;
        this.combatRangeMaterial.emissiveColor = new Color3(0.3, 0.15, 0);
        this.combatRangeMaterial.disableLighting = true;

        this.detectionRangeMaterial = new StandardMaterial('detection_range_material', this.scene);
        this.detectionRangeMaterial.diffuseColor = new Color3(0, 0.8, 1);
        this.detectionRangeMaterial.alpha = 0.2;
        this.detectionRangeMaterial.wireframe = true;
        this.detectionRangeMaterial.emissiveColor = new Color3(0, 0.2, 0.3);
        this.detectionRangeMaterial.disableLighting = true;

        this.destinationMaterial = new StandardMaterial('destination_material', this.scene);
        this.destinationMaterial.diffuseColor = new Color3(0, 1, 0);
        this.destinationMaterial.alpha = 0.6;
        this.destinationMaterial.emissiveColor = new Color3(0, 0.4, 0);
        this.destinationMaterial.disableLighting = true;

        this.validTargetMaterial = new StandardMaterial('valid_target_material', this.scene);
        this.validTargetMaterial.diffuseColor = new Color3(0, 1, 0);
        this.validTargetMaterial.alpha = 0.4;
        this.validTargetMaterial.emissiveColor = new Color3(0, 0.3, 0);
        this.validTargetMaterial.disableLighting = true;

        this.invalidTargetMaterial = new StandardMaterial('invalid_target_material', this.scene);
        this.invalidTargetMaterial.diffuseColor = new Color3(1, 0, 0);
        this.invalidTargetMaterial.alpha = 0.4;
        this.invalidTargetMaterial.emissiveColor = new Color3(0.3, 0, 0);
        this.invalidTargetMaterial.disableLighting = true;

        this.detectedEnemyMaterial = new StandardMaterial('detected_enemy_material', this.scene);
        this.detectedEnemyMaterial.diffuseColor = new Color3(1, 1, 0);
        this.detectedEnemyMaterial.alpha = 0.5;
        this.detectedEnemyMaterial.emissiveColor = new Color3(0.3, 0.3, 0);
        this.detectedEnemyMaterial.disableLighting = true;
    }

    public dispose(): void {
        this.combatRangeMaterial?.dispose();
        this.detectionRangeMaterial?.dispose();
        this.destinationMaterial?.dispose();
        this.validTargetMaterial?.dispose();
        this.invalidTargetMaterial?.dispose();
        this.detectedEnemyMaterial?.dispose();

        this.combatRangeMaterial = null;
        this.detectionRangeMaterial = null;
        this.destinationMaterial = null;
        this.validTargetMaterial = null;
        this.invalidTargetMaterial = null;
        this.detectedEnemyMaterial = null;
    }
}
