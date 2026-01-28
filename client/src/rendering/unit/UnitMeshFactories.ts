/**
 * UnitMeshFactories - Mesh creation for different unit types
 *
 * Handles creation of detailed meshes for workers and protectors.
 * Extracted from UnitRenderer.ts for SOLID compliance.
 */

import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';
import { UnitMaterialManager } from './UnitMaterials';

/**
 * WorkerMeshFactory - Creates worker robot meshes
 */
export class WorkerMeshFactory {
    private scene: Scene;
    private materials: UnitMaterialManager;

    constructor(scene: Scene, materials: UnitMaterialManager) {
        this.scene = scene;
        this.materials = materials;
    }

    public createWorkerMesh(unitId: string, config: any, rootNode: TransformNode): Mesh {
        const radius = config.radius;

        const body = MeshBuilder.CreateSphere(`unit_${unitId}`, {
            diameter: radius * 2,
            segments: config.segments
        }, this.scene);
        body.parent = rootNode;
        body.position.y = radius + 0.1;
        body.material = this.materials.workerMaterial;

        const energyCore = MeshBuilder.CreateSphere(`energyCore_${unitId}`, {
            diameter: radius * 1.4,
            segments: 8
        }, this.scene);
        energyCore.parent = body;
        energyCore.position.y = 0;
        energyCore.renderingGroupId = 1;

        const coreMaterial = new StandardMaterial(`energyCoreMat_${unitId}`, this.scene);
        coreMaterial.diffuseColor = new Color3(0.5, 1.0, 0.5);
        coreMaterial.emissiveColor = new Color3(0.8, 1.8, 0.8);
        coreMaterial.specularColor = new Color3(0.5, 0.5, 0.5);
        coreMaterial.disableLighting = true;
        energyCore.material = coreMaterial;

        (body as any).energyCore = energyCore;
        (body as any).energyCoreMaterial = coreMaterial;

        const camera = MeshBuilder.CreateCylinder(`camera_${unitId}`, {
            diameter: radius * 0.5, height: radius * 0.6, tessellation: 8
        }, this.scene);
        camera.parent = body;
        camera.position.z = radius * 0.85;
        camera.position.y = radius * 0.1;
        camera.rotation.x = Math.PI / 2;
        camera.material = this.materials.workerAccentMaterial;

        const cameraLens = MeshBuilder.CreateCylinder(`cameraLens_${unitId}`, {
            diameter: radius * 0.35, height: radius * 0.15, tessellation: 8
        }, this.scene);
        cameraLens.parent = camera;
        cameraLens.position.y = radius * 0.3;
        const lensMaterial = new StandardMaterial(`lensMat_${unitId}`, this.scene);
        lensMaterial.diffuseColor = new Color3(0.2, 0.8, 1);
        lensMaterial.emissiveColor = new Color3(0.15, 0.5, 0.6);
        cameraLens.material = lensMaterial;

        const leftHand = this.createClawHand(`leftHand_${unitId}`, radius);
        leftHand.parent = body;
        leftHand.position.x = radius * 0.9;
        leftHand.position.y = -radius * 0.1;
        leftHand.rotation.z = -Math.PI / 8;

        const rightHand = this.createClawHand(`rightHand_${unitId}`, radius);
        rightHand.parent = body;
        rightHand.position.x = -radius * 0.9;
        rightHand.position.y = -radius * 0.1;
        rightHand.rotation.z = Math.PI / 8;
        rightHand.scaling.x = -1;

        return body;
    }

    private createClawHand(name: string, bodyRadius: number): Mesh {
        const arm = MeshBuilder.CreateCylinder(`${name}_arm`, {
            diameter: bodyRadius * 0.12, height: bodyRadius * 0.9, tessellation: 6
        }, this.scene);
        arm.rotation.z = Math.PI / 2;
        arm.position.x = bodyRadius * 0.5;
        arm.material = this.materials.workerAccentMaterial;

        const clawBase = MeshBuilder.CreateBox(`${name}_clawBase`, {
            width: bodyRadius * 0.18, height: bodyRadius * 0.22, depth: bodyRadius * 0.18
        }, this.scene);
        clawBase.parent = arm;
        clawBase.position.x = bodyRadius * 0.5;
        clawBase.material = this.materials.workerAccentMaterial;

        const upperFinger = MeshBuilder.CreateBox(`${name}_upperFinger`, {
            width: bodyRadius * 0.35, height: bodyRadius * 0.06, depth: bodyRadius * 0.1
        }, this.scene);
        upperFinger.parent = clawBase;
        upperFinger.position.x = bodyRadius * 0.2;
        upperFinger.position.y = bodyRadius * 0.1;
        upperFinger.rotation.z = -Math.PI / 10;
        upperFinger.material = this.materials.workerAccentMaterial;

        const lowerFinger = MeshBuilder.CreateBox(`${name}_lowerFinger`, {
            width: bodyRadius * 0.35, height: bodyRadius * 0.06, depth: bodyRadius * 0.1
        }, this.scene);
        lowerFinger.parent = clawBase;
        lowerFinger.position.x = bodyRadius * 0.2;
        lowerFinger.position.y = -bodyRadius * 0.1;
        lowerFinger.rotation.z = Math.PI / 10;
        lowerFinger.material = this.materials.workerAccentMaterial;

        return arm;
    }
}

/**
 * ProtectorMeshFactory - Creates protector warrior meshes
 */
export class ProtectorMeshFactory {
    private scene: Scene;
    private materials: UnitMaterialManager;

    constructor(scene: Scene, materials: UnitMaterialManager) {
        this.scene = scene;
        this.materials = materials;
    }

    public createProtectorMesh(unitId: string, config: any, rootNode: TransformNode): Mesh {
        const radius = config.radius;

        const body = MeshBuilder.CreateSphere(`unit_${unitId}`, {
            diameter: radius * 2, segments: config.segments
        }, this.scene);
        body.parent = rootNode;
        body.position.y = radius + 0.1;
        body.material = this.materials.protectorMaterial;

        const energyCore = MeshBuilder.CreateSphere(`energyCore_${unitId}`, {
            diameter: radius * 1.2, segments: 8
        }, this.scene);
        energyCore.parent = body;
        energyCore.position.y = 0;

        const coreMaterial = new StandardMaterial(`energyCoreMat_${unitId}`, this.scene);
        coreMaterial.diffuseColor = new Color3(0.8, 0.2, 1.0);
        coreMaterial.emissiveColor = new Color3(0.9, 0.3, 1.2);
        coreMaterial.specularColor = new Color3(0.5, 0.5, 0.5);
        coreMaterial.disableLighting = true;
        energyCore.material = coreMaterial;

        (body as any).energyCore = energyCore;
        (body as any).energyCoreMaterial = coreMaterial;

        const visor = this.createCombatVisor(`visor_${unitId}`, radius);
        visor.parent = body;
        visor.position.z = radius * 0.75;
        visor.position.y = radius * 0.15;

        const leftGun = this.createLaserGun(`leftGun_${unitId}`, radius);
        leftGun.parent = body;
        leftGun.position.x = radius * 0.7;
        leftGun.position.y = -radius * 0.1;
        leftGun.position.z = radius * 0.2;
        leftGun.rotation.x = Math.PI / 2;

        const rightGun = this.createLaserGun(`rightGun_${unitId}`, radius);
        rightGun.parent = body;
        rightGun.position.x = -radius * 0.7;
        rightGun.position.y = -radius * 0.1;
        rightGun.position.z = radius * 0.2;
        rightGun.rotation.x = Math.PI / 2;

        return body;
    }

    private createCombatVisor(name: string, bodyRadius: number): Mesh {
        const visorBase = MeshBuilder.CreateBox(`${name}_base`, {
            width: bodyRadius * 0.8, height: bodyRadius * 0.25, depth: bodyRadius * 0.3
        }, this.scene);
        visorBase.material = this.materials.protectorAccentMaterial;

        const visorSlit = MeshBuilder.CreateBox(`${name}_slit`, {
            width: bodyRadius * 0.6, height: bodyRadius * 0.08, depth: bodyRadius * 0.15
        }, this.scene);
        visorSlit.parent = visorBase;
        visorSlit.position.z = bodyRadius * 0.1;
        visorSlit.material = this.materials.protectorVisorMaterial;

        const leftPlate = MeshBuilder.CreateBox(`${name}_leftPlate`, {
            width: bodyRadius * 0.15, height: bodyRadius * 0.35, depth: bodyRadius * 0.2
        }, this.scene);
        leftPlate.parent = visorBase;
        leftPlate.position.x = bodyRadius * 0.45;
        leftPlate.position.y = bodyRadius * 0.05;
        leftPlate.rotation.z = -Math.PI / 8;
        leftPlate.material = this.materials.protectorAccentMaterial;

        const rightPlate = MeshBuilder.CreateBox(`${name}_rightPlate`, {
            width: bodyRadius * 0.15, height: bodyRadius * 0.35, depth: bodyRadius * 0.2
        }, this.scene);
        rightPlate.parent = visorBase;
        rightPlate.position.x = -bodyRadius * 0.45;
        rightPlate.position.y = bodyRadius * 0.05;
        rightPlate.rotation.z = Math.PI / 8;
        rightPlate.material = this.materials.protectorAccentMaterial;

        return visorBase;
    }

    private createLaserGun(name: string, bodyRadius: number): Mesh {
        const arm = MeshBuilder.CreateCylinder(`${name}_arm`, {
            diameter: bodyRadius * 0.12, height: bodyRadius * 0.5, tessellation: 6
        }, this.scene);
        arm.rotation.z = Math.PI / 2;
        arm.position.x = bodyRadius * 0.3;
        arm.material = this.materials.protectorAccentMaterial;

        const gunBody = MeshBuilder.CreateBox(`${name}_body`, {
            width: bodyRadius * 0.6, height: bodyRadius * 0.2, depth: bodyRadius * 0.18
        }, this.scene);
        gunBody.parent = arm;
        gunBody.position.x = bodyRadius * 0.45;
        gunBody.material = this.materials.protectorGunMaterial;

        const barrel = MeshBuilder.CreateCylinder(`${name}_barrel`, {
            diameter: bodyRadius * 0.1, height: bodyRadius * 0.5, tessellation: 8
        }, this.scene);
        barrel.parent = gunBody;
        barrel.position.x = bodyRadius * 0.4;
        barrel.rotation.z = Math.PI / 2;
        barrel.material = this.materials.protectorGunMaterial;

        const muzzle = MeshBuilder.CreateCylinder(`${name}_muzzle`, {
            diameter: bodyRadius * 0.14, height: bodyRadius * 0.08, tessellation: 8
        }, this.scene);
        muzzle.parent = barrel;
        muzzle.position.y = bodyRadius * 0.28;
        muzzle.material = this.materials.protectorGunGlowMaterial;

        const innerGlow = MeshBuilder.CreateCylinder(`${name}_innerGlow`, {
            diameter: bodyRadius * 0.06, height: bodyRadius * 0.52, tessellation: 8
        }, this.scene);
        innerGlow.parent = barrel;
        innerGlow.material = this.materials.protectorGunGlowMaterial;

        const sight = MeshBuilder.CreateBox(`${name}_sight`, {
            width: bodyRadius * 0.15, height: bodyRadius * 0.08, depth: bodyRadius * 0.06
        }, this.scene);
        sight.parent = gunBody;
        sight.position.y = bodyRadius * 0.12;
        sight.position.x = bodyRadius * 0.1;
        sight.material = this.materials.protectorAccentMaterial;

        const indicator = MeshBuilder.CreateSphere(`${name}_indicator`, {
            diameter: bodyRadius * 0.04, segments: 4
        }, this.scene);
        indicator.parent = sight;
        indicator.position.y = bodyRadius * 0.04;
        indicator.position.x = bodyRadius * 0.05;
        indicator.material = this.materials.protectorVisorMaterial;

        const grip = MeshBuilder.CreateBox(`${name}_grip`, {
            width: bodyRadius * 0.08, height: bodyRadius * 0.15, depth: bodyRadius * 0.1
        }, this.scene);
        grip.parent = gunBody;
        grip.position.y = -bodyRadius * 0.15;
        grip.position.x = -bodyRadius * 0.1;
        grip.material = this.materials.protectorAccentMaterial;

        return arm;
    }
}
