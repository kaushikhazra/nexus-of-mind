/**
 * BaseBuildingMeshFactory - Complex base building mesh creation
 *
 * Creates the multi-part 3D mesh for base buildings with command dome,
 * pillars, antenna, landing pads, and energy conduits.
 */

import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode } from '@babylonjs/core';
import type { BuildingMeshResult } from './BuildingRendererInterfaces';
import type { BuildingMaterials } from './BuildingMaterials';

export class BaseBuildingMeshFactory {
    private scene: Scene;
    private materials: BuildingMaterials;

    constructor(scene: Scene, materials: BuildingMaterials) {
        this.scene = scene;
        this.materials = materials;
    }

    public createComplexBaseMesh(buildingId: string, rootNode: TransformNode): BuildingMeshResult {
        const platform = MeshBuilder.CreateCylinder(`base_platform_${buildingId}`, {
            diameter: 5,
            height: 0.4,
            tessellation: 6
        }, this.scene);
        platform.parent = rootNode;
        platform.position.y = 0.2;
        platform.material = this.materials.baseMaterial;

        const upperPlatform = MeshBuilder.CreateCylinder(`base_upper_${buildingId}`, {
            diameter: 3.5,
            height: 0.3,
            tessellation: 6
        }, this.scene);
        upperPlatform.parent = rootNode;
        upperPlatform.position.y = 0.55;
        upperPlatform.material = this.materials.baseMaterial;

        this.createSupportPillars(buildingId, rootNode);
        this.createCommandDome(buildingId, rootNode);

        const { energyCore, energyCoreMaterial } = this.createEnergyCore(buildingId, rootNode);
        const antennaRotator = this.createAntennaTower(buildingId, rootNode);
        this.createLandingPads(buildingId, rootNode);
        this.createEnergyConduits(buildingId, rootNode);

        return {
            mainMesh: platform,
            energyCore,
            energyCoreMaterial,
            antennaRotator
        };
    }

    private createSupportPillars(buildingId: string, rootNode: TransformNode): void {
        const pillarPositions = [
            new Vector3(1.8, 0, 0),
            new Vector3(-1.8, 0, 0),
            new Vector3(0, 0, 1.8),
            new Vector3(0, 0, -1.8)
        ];

        for (let i = 0; i < pillarPositions.length; i++) {
            const pillar = MeshBuilder.CreateCylinder(`base_pillar_${buildingId}_${i}`, {
                diameter: 0.25,
                height: 1.2,
                tessellation: 6
            }, this.scene);
            pillar.parent = rootNode;
            pillar.position = pillarPositions[i].clone();
            pillar.position.y = 0.6;
            pillar.material = this.materials.basePillarMaterial;

            const pillarCap = MeshBuilder.CreateSphere(`base_pillar_cap_${buildingId}_${i}`, {
                diameter: 0.35,
                segments: 6
            }, this.scene);
            pillarCap.parent = rootNode;
            pillarCap.position = pillarPositions[i].clone();
            pillarCap.position.y = 1.2;
            pillarCap.material = this.materials.baseGlowMaterial;
        }
    }

    private createCommandDome(buildingId: string, rootNode: TransformNode): void {
        const dome = MeshBuilder.CreateSphere(`base_dome_${buildingId}`, {
            diameter: 2.2,
            segments: 8,
            slice: 0.5
        }, this.scene);
        dome.parent = rootNode;
        dome.position.y = 0.7;
        dome.material = this.materials.baseDomeMaterial;
    }

    private createEnergyCore(buildingId: string, rootNode: TransformNode): { energyCore: Mesh; energyCoreMaterial: StandardMaterial } {
        const energyCore = MeshBuilder.CreateSphere(`base_core_${buildingId}`, {
            diameter: 0.9,
            segments: 8
        }, this.scene);
        energyCore.parent = rootNode;
        energyCore.position.y = 1.1;

        const energyCoreMaterial = new StandardMaterial(`base_core_mat_${buildingId}`, this.scene);
        energyCoreMaterial.diffuseColor = new Color3(0.3, 0.9, 1.0);
        energyCoreMaterial.emissiveColor = new Color3(0.5, 1.5, 1.8);
        energyCoreMaterial.disableLighting = true;
        energyCore.material = energyCoreMaterial;

        return { energyCore, energyCoreMaterial };
    }

    private createAntennaTower(buildingId: string, rootNode: TransformNode): Mesh {
        const antennaPole = MeshBuilder.CreateCylinder(`base_antenna_pole_${buildingId}`, {
            diameter: 0.15,
            height: 1.5,
            tessellation: 6
        }, this.scene);
        antennaPole.parent = rootNode;
        antennaPole.position.y = 2.4;
        antennaPole.material = this.materials.baseAntennaMaterial;

        const antennaRotator = MeshBuilder.CreateTorus(`base_antenna_ring_${buildingId}`, {
            diameter: 0.8,
            thickness: 0.08,
            tessellation: 8
        }, this.scene);
        antennaRotator.parent = rootNode;
        antennaRotator.position.y = 3.0;
        antennaRotator.rotation.x = Math.PI / 2;
        antennaRotator.material = this.materials.baseGlowMaterial;

        const antennaBeacon = MeshBuilder.CreateSphere(`base_beacon_${buildingId}`, {
            diameter: 0.2,
            segments: 6
        }, this.scene);
        antennaBeacon.parent = rootNode;
        antennaBeacon.position.y = 3.2;
        antennaBeacon.material = this.materials.baseGlowMaterial;

        return antennaRotator;
    }

    private createLandingPads(buildingId: string, rootNode: TransformNode): void {
        const padAngles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
        for (let i = 0; i < padAngles.length; i++) {
            const angle = padAngles[i];
            const padDistance = 2.8;

            const pad = MeshBuilder.CreateBox(`base_pad_${buildingId}_${i}`, {
                width: 0.8,
                height: 0.1,
                depth: 0.8
            }, this.scene);
            pad.parent = rootNode;
            pad.position.x = Math.cos(angle) * padDistance;
            pad.position.z = Math.sin(angle) * padDistance;
            pad.position.y = 0.1;
            pad.rotation.y = angle;
            pad.material = this.materials.basePillarMaterial;

            const padLight = MeshBuilder.CreateSphere(`base_pad_light_${buildingId}_${i}`, {
                diameter: 0.15,
                segments: 6
            }, this.scene);
            padLight.parent = rootNode;
            padLight.position.x = Math.cos(angle) * padDistance;
            padLight.position.z = Math.sin(angle) * padDistance;
            padLight.position.y = 0.2;
            padLight.material = this.materials.baseGlowMaterial;
        }
    }

    private createEnergyConduits(buildingId: string, rootNode: TransformNode): void {
        const pillarPositions = [
            new Vector3(1.8, 0, 0),
            new Vector3(-1.8, 0, 0),
            new Vector3(0, 0, 1.8),
            new Vector3(0, 0, -1.8)
        ];

        for (let i = 0; i < pillarPositions.length; i++) {
            const conduit = MeshBuilder.CreateCylinder(`base_conduit_${buildingId}_${i}`, {
                diameter: 0.08,
                height: 1.0,
                tessellation: 6
            }, this.scene);
            conduit.parent = rootNode;

            const pillarPos = pillarPositions[i];
            conduit.position.x = pillarPos.x * 0.5;
            conduit.position.z = pillarPos.z * 0.5;
            conduit.position.y = 1.0;

            const angleToCenter = Math.atan2(-pillarPos.z, -pillarPos.x);
            conduit.rotation.z = Math.PI / 4;
            conduit.rotation.y = angleToCenter + Math.PI / 2;
            conduit.material = this.materials.baseGlowMaterial;
        }
    }
}
