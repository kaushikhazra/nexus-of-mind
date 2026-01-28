/**
 * BuildingPreviewManager - Preview mesh creation and management
 *
 * Handles creation and animation of building preview meshes for placement.
 */

import {
    Scene, Vector3, Mesh, MeshBuilder, StandardMaterial, Color3, Animation, VertexData
} from '@babylonjs/core';
import type { BuildingType } from './BuildingPlacementInterfaces';

export class BuildingPreviewManager {
    private scene: Scene;
    private previewMesh: Mesh | null = null;
    private previewMaterial: StandardMaterial | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
        this.createPreviewMaterial();
    }

    private createPreviewMaterial(): void {
        this.previewMaterial = new StandardMaterial('building_preview_material', this.scene);
        this.previewMaterial.diffuseColor = new Color3(0, 1, 1);
        this.previewMaterial.alpha = 0.7;
        this.previewMaterial.wireframe = false;
        this.previewMaterial.emissiveColor = new Color3(0, 0.5, 0.5);
        this.previewMaterial.disableLighting = true;
    }

    public createPreview(buildingType: BuildingType): Mesh | null {
        this.disposePreview();

        if (buildingType === 'base') {
            this.createPyramidPreview();
        } else if (buildingType === 'powerPlant') {
            this.createCylinderPreview();
        }

        if (this.previewMesh && this.previewMaterial) {
            this.previewMesh.material = this.previewMaterial;
            this.previewMesh.isPickable = false;
            this.previewMesh.renderingGroupId = 1;
            this.previewMesh.visibility = 1.0;
            this.animatePreview();
        }

        return this.previewMesh;
    }

    private createPyramidPreview(): void {
        const positions = [
            -2, 0, -2,   2, 0, -2,   2, 0, 2,  -2, 0, 2,
             0, 3, 0
        ];

        const indices = [
            0, 2, 1,  0, 3, 2,
            0, 1, 4,  1, 2, 4,
            2, 3, 4,  3, 0, 4
        ];

        const normals: number[] = [];
        for (let i = 0; i < positions.length; i += 3) {
            normals.push(0, 1, 0);
        }

        this.previewMesh = new Mesh('building_preview', this.scene);
        const vertexData = new VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.normals = normals;
        vertexData.applyToMesh(this.previewMesh);
    }

    private createCylinderPreview(): void {
        this.previewMesh = MeshBuilder.CreateCylinder('building_preview', {
            diameter: 3,
            height: 4,
            tessellation: 8
        }, this.scene);
    }

    private animatePreview(): void {
        if (!this.previewMesh) return;

        const frameRate = 30;
        const animationY = new Animation(
            'previewFloat',
            'position.y',
            frameRate,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        const baseY = this.previewMesh.position.y;
        const animationKeys = [
            { frame: 0, value: baseY },
            { frame: frameRate, value: baseY + 0.3 },
            { frame: frameRate * 2, value: baseY }
        ];

        animationY.setKeys(animationKeys);
        this.previewMesh.animations = [animationY];
        this.scene.beginAnimation(this.previewMesh, 0, frameRate * 2, true);
    }

    public updatePosition(x: number, y: number, z: number): void {
        if (this.previewMesh) {
            this.previewMesh.position.x = x;
            this.previewMesh.position.y = y;
            this.previewMesh.position.z = z;
        }
    }

    public updateColorValid(): void {
        if (this.previewMaterial) {
            this.previewMaterial.diffuseColor = new Color3(0, 1, 0);
            this.previewMaterial.emissiveColor = new Color3(0, 0.3, 0);
        }
    }

    public updateColorInvalid(): void {
        if (this.previewMaterial) {
            this.previewMaterial.diffuseColor = new Color3(1, 0, 0);
            this.previewMaterial.emissiveColor = new Color3(0.3, 0, 0);
        }
    }

    public updateColorForEfficiency(isValid: boolean, efficiency: 'high' | 'medium' | 'low'): void {
        if (!this.previewMaterial) return;

        if (!isValid) {
            this.updateColorInvalid();
            return;
        }

        switch (efficiency) {
            case 'high':
                this.previewMaterial.diffuseColor = new Color3(0, 1, 0);
                this.previewMaterial.emissiveColor = new Color3(0, 0.4, 0);
                break;
            case 'medium':
                this.previewMaterial.diffuseColor = new Color3(1, 1, 0);
                this.previewMaterial.emissiveColor = new Color3(0.3, 0.3, 0);
                break;
            case 'low':
                this.previewMaterial.diffuseColor = new Color3(1, 0.5, 0);
                this.previewMaterial.emissiveColor = new Color3(0.3, 0.15, 0);
                break;
        }
    }

    public getPreviewHeight(buildingType: BuildingType | null): number {
        if (!buildingType) return 3.0;

        switch (buildingType) {
            case 'base': return 0;
            case 'powerPlant': return 2.0;
            default: return 3.0;
        }
    }

    public disposePreview(): void {
        if (this.previewMesh) {
            this.previewMesh.dispose();
            this.previewMesh = null;
        }
    }

    public dispose(): void {
        this.disposePreview();
        if (this.previewMaterial) {
            this.previewMaterial.dispose();
            this.previewMaterial = null;
        }
    }
}
