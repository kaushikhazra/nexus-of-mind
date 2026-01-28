/**
 * PowerPlantMeshFactory - Complex power plant mesh creation
 *
 * Creates the multi-part 3D mesh for power plant buildings with reactor core,
 * containment rings, cooling fins, and energy beacons.
 */

import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';
import type { BuildingMeshResult } from './BuildingRendererInterfaces';
import type { BuildingMaterials } from './BuildingMaterials';

export class PowerPlantMeshFactory {
    private scene: Scene;
    private materials: BuildingMaterials;

    constructor(scene: Scene, materials: BuildingMaterials) {
        this.scene = scene;
        this.materials = materials;
    }

    public createComplexPowerPlantMesh(buildingId: string, rootNode: TransformNode): BuildingMeshResult {
        const basePlatform = MeshBuilder.CreateCylinder(`pp_base_${buildingId}`, {
            diameter: 3,
            height: 0.2,
            tessellation: 6
        }, this.scene);
        basePlatform.parent = rootNode;
        basePlatform.position.y = 0.1;
        basePlatform.material = this.materials.powerPlantStructMaterial;

        this.createEnergyOutputNodes(buildingId, rootNode);
        this.createSupportStruts(buildingId, rootNode);
        this.createReactorShell(buildingId, rootNode);

        const { energyCore, energyCoreMaterial } = this.createPlasmaCore(buildingId, rootNode);
        const containmentRing = this.createContainmentRings(buildingId, rootNode);

        this.createReactorTopCap(buildingId, rootNode);
        this.createCoolingFins(buildingId, rootNode);
        this.createEnergyBeacon(buildingId, rootNode);

        return {
            mainMesh: basePlatform,
            energyCore,
            energyCoreMaterial,
            containmentRing
        };
    }

    private createEnergyOutputNodes(buildingId: string, rootNode: TransformNode): void {
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const nodeDistance = 1.3;

            const node = MeshBuilder.CreateSphere(`pp_node_${buildingId}_${i}`, {
                diameter: 0.2,
                segments: 6
            }, this.scene);
            node.parent = rootNode;
            node.position.x = Math.cos(angle) * nodeDistance;
            node.position.z = Math.sin(angle) * nodeDistance;
            node.position.y = 0.2;
            node.material = this.materials.powerPlantGlowMaterial;
        }
    }

    private createSupportStruts(buildingId: string, rootNode: TransformNode): void {
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;

            const strut = MeshBuilder.CreateCylinder(`pp_strut_${buildingId}_${i}`, {
                diameter: 0.1,
                height: 0.8,
                tessellation: 6
            }, this.scene);
            strut.parent = rootNode;
            strut.position.x = Math.cos(angle) * 0.7;
            strut.position.z = Math.sin(angle) * 0.7;
            strut.position.y = 0.5;
            strut.rotation.x = Math.sin(angle) * 0.3;
            strut.rotation.z = -Math.cos(angle) * 0.3;
            strut.material = this.materials.powerPlantStructMaterial;
        }
    }

    private createReactorShell(buildingId: string, rootNode: TransformNode): void {
        const reactorShell = MeshBuilder.CreateCylinder(`pp_reactor_${buildingId}`, {
            diameter: 1.4,
            height: 1.2,
            tessellation: 8
        }, this.scene);
        reactorShell.parent = rootNode;
        reactorShell.position.y = 1.1;
        reactorShell.material = this.materials.powerPlantMaterial;
    }

    private createPlasmaCore(buildingId: string, rootNode: TransformNode): { energyCore: Mesh; energyCoreMaterial: StandardMaterial } {
        const energyCore = MeshBuilder.CreateSphere(`pp_core_${buildingId}`, {
            diameter: 0.7,
            segments: 8
        }, this.scene);
        energyCore.parent = rootNode;
        energyCore.position.y = 1.1;

        const energyCoreMaterial = new StandardMaterial(`pp_core_mat_${buildingId}`, this.scene);
        energyCoreMaterial.diffuseColor = new Color3(1.0, 0.7, 0.2);
        energyCoreMaterial.emissiveColor = new Color3(1.5, 0.9, 0.3);
        energyCoreMaterial.disableLighting = true;
        energyCore.material = energyCoreMaterial;

        return { energyCore, energyCoreMaterial };
    }

    private createContainmentRings(buildingId: string, rootNode: TransformNode): Mesh {
        const containmentRing = MeshBuilder.CreateTorus(`pp_ring_${buildingId}`, {
            diameter: 1.6,
            thickness: 0.08,
            tessellation: 16
        }, this.scene);
        containmentRing.parent = rootNode;
        containmentRing.position.y = 1.1;
        containmentRing.rotation.x = Math.PI / 2;
        containmentRing.material = this.materials.powerPlantGlowMaterial;

        const containmentRing2 = MeshBuilder.CreateTorus(`pp_ring2_${buildingId}`, {
            diameter: 1.5,
            thickness: 0.06,
            tessellation: 16
        }, this.scene);
        containmentRing2.parent = containmentRing;
        containmentRing2.rotation.x = Math.PI / 2;
        containmentRing2.material = this.materials.powerPlantGlowMaterial;

        return containmentRing;
    }

    private createReactorTopCap(buildingId: string, rootNode: TransformNode): void {
        const topCap = MeshBuilder.CreateCylinder(`pp_cap_${buildingId}`, {
            diameterTop: 0.6,
            diameterBottom: 1.0,
            height: 0.3,
            tessellation: 8
        }, this.scene);
        topCap.parent = rootNode;
        topCap.position.y = 1.85;
        topCap.material = this.materials.powerPlantStructMaterial;
    }

    private createCoolingFins(buildingId: string, rootNode: TransformNode): void {
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;

            const fin = MeshBuilder.CreateBox(`pp_fin_${buildingId}_${i}`, {
                width: 0.6,
                height: 0.5,
                depth: 0.05
            }, this.scene);
            fin.parent = rootNode;
            fin.position.x = Math.cos(angle) * 0.5;
            fin.position.z = Math.sin(angle) * 0.5;
            fin.position.y = 2.0;
            fin.rotation.y = angle;
            fin.rotation.x = -0.4;
            fin.material = this.materials.powerPlantStructMaterial;
        }
    }

    private createEnergyBeacon(buildingId: string, rootNode: TransformNode): void {
        const beacon = MeshBuilder.CreateSphere(`pp_beacon_${buildingId}`, {
            diameter: 0.25,
            segments: 6
        }, this.scene);
        beacon.parent = rootNode;
        beacon.position.y = 2.3;
        beacon.material = this.materials.powerPlantGlowMaterial;

        const beaconRing = MeshBuilder.CreateTorus(`pp_beacon_ring_${buildingId}`, {
            diameter: 0.4,
            thickness: 0.04,
            tessellation: 8
        }, this.scene);
        beaconRing.parent = rootNode;
        beaconRing.position.y = 2.3;
        beaconRing.rotation.x = Math.PI / 2;
        beaconRing.material = this.materials.powerPlantGlowMaterial;
    }
}
