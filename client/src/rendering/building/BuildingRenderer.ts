/**
 * BuildingRenderer - 3D building visualization with construction progress
 *
 * Manages the 3D representation of buildings with low poly aesthetic,
 * construction progress visualization, and energy generation indicators.
 *
 * Refactored to delegate to extracted modules for SOLID compliance.
 */

import { Scene, Mesh, MeshBuilder, Vector3, TransformNode, Color3 } from '@babylonjs/core';
import type { MaterialManager } from '../MaterialManager';
import type { Building } from '../../game/entities/Building';
import type { BuildingVisual, BuildingRenderingStats } from './BuildingRendererInterfaces';
import { BuildingMaterials } from './BuildingMaterials';
import { BaseBuildingMeshFactory } from './BaseBuildingMeshFactory';
import { PowerPlantMeshFactory } from './PowerPlantMeshFactory';
import { BuildingAnimator } from './BuildingAnimator';

export class BuildingRenderer {
    private scene: Scene;
    private materialManager: MaterialManager;
    private buildingVisuals: Map<string, BuildingVisual> = new Map();

    private materials: BuildingMaterials;
    private baseMeshFactory: BaseBuildingMeshFactory;
    private powerPlantMeshFactory: PowerPlantMeshFactory;
    private animator: BuildingAnimator;

    private readonly buildingConfigs = {
        base: {
            color: new Color3(0.2, 0.6, 0.8),
            shape: 'complex',
            size: { width: 5, height: 3.5, depth: 5 }
        },
        powerPlant: {
            color: new Color3(1.0, 0.5, 0.1),
            shape: 'reactor',
            size: { diameter: 3, height: 2.5 }
        }
    };

    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;

        this.materials = new BuildingMaterials(scene);
        this.baseMeshFactory = new BaseBuildingMeshFactory(scene, this.materials);
        this.powerPlantMeshFactory = new PowerPlantMeshFactory(scene, this.materials);
        this.animator = new BuildingAnimator(this.materials);
    }

    public createBuildingVisual(building: Building): BuildingVisual | null {
        const buildingId = building.getId();

        if (this.buildingVisuals.has(buildingId)) {
            console.warn(`⚠️ Building visual already exists for ${buildingId}`);
            return this.buildingVisuals.get(buildingId) || null;
        }

        try {
            const rootNode = new TransformNode(`building_root_${buildingId}`, this.scene);
            rootNode.position = building.getPosition();

            const buildingType = building.getBuildingType();
            const configKey = buildingType.id as keyof typeof this.buildingConfigs;
            const config = this.buildingConfigs[configKey];

            if (!config) {
                console.error(`❌ Unknown building type: ${buildingType.id}`);
                return null;
            }

            let mesh: Mesh;
            let energyCore: Mesh | null = null;
            let energyCoreMaterial = null;
            let antennaRotator: Mesh | null = null;
            let containmentRing: Mesh | null = null;

            if (config.shape === 'complex') {
                const result = this.baseMeshFactory.createComplexBaseMesh(buildingId, rootNode);
                mesh = result.mainMesh;
                energyCore = result.energyCore;
                energyCoreMaterial = result.energyCoreMaterial;
                antennaRotator = result.antennaRotator || null;
            } else if (config.shape === 'reactor') {
                const result = this.powerPlantMeshFactory.createComplexPowerPlantMesh(buildingId, rootNode);
                mesh = result.mainMesh;
                energyCore = result.energyCore;
                energyCoreMaterial = result.energyCoreMaterial;
                containmentRing = result.containmentRing || null;
            } else if (config.shape === 'cylinder') {
                const cylinderConfig = config.size as { diameter: number; height: number };
                mesh = MeshBuilder.CreateCylinder(`building_${buildingId}`, {
                    diameter: cylinderConfig.diameter,
                    height: cylinderConfig.height,
                    tessellation: 8
                }, this.scene);
            } else {
                mesh = MeshBuilder.CreateBox(`building_${buildingId}`, {
                    width: 2,
                    height: 1.5,
                    depth: 2
                }, this.scene);
            }

            mesh.parent = rootNode;

            if (config.shape === 'cylinder') {
                const cylinderConfig = config.size as { diameter: number; height: number };
                mesh.position.y = cylinderConfig.height / 2;
            } else if (config.shape !== 'pyramid' && config.shape !== 'complex' && config.shape !== 'reactor') {
                const boxConfig = config.size as { width: number; height: number; depth: number };
                mesh.position.y = boxConfig.height / 2;
            }

            const material = this.materials.getMaterialForBuildingType(buildingType.id);
            if (material) {
                mesh.material = material;
            }

            const constructionIndicator = mesh.clone(`construction_${buildingId}`);
            constructionIndicator.parent = rootNode;
            constructionIndicator.material = this.materials.constructionMaterial;
            constructionIndicator.scaling = new Vector3(1.1, 1.1, 1.1);

            const buildingVisual: BuildingVisual = {
                building,
                mesh,
                material: material!,
                constructionIndicator,
                energyIndicator: null,
                rootNode,
                energyCore,
                energyCoreMaterial,
                antennaRotator,
                containmentRing
            };

            this.buildingVisuals.set(buildingId, buildingVisual);
            this.updateBuildingVisual(buildingVisual);

            return buildingVisual;
        } catch (error) {
            console.error(`❌ Failed to create building visual for ${buildingId}:`, error);
            return null;
        }
    }

    public updateBuildingVisual(buildingVisual: BuildingVisual): void {
        const building = buildingVisual.building;

        buildingVisual.rootNode.position = building.getPosition();

        this.animator.updateConstructionVisualization(buildingVisual);
        this.animator.updateEnergyVisualization(buildingVisual);

        const baseEmissive = this.getBaseEmissiveColor(building.getBuildingType().id);
        this.animator.updateHealthVisualization(buildingVisual, baseEmissive);
        this.animator.updateBuildingAnimations(buildingVisual);
    }

    private getBaseEmissiveColor(buildingTypeId: string): { r: number; g: number; b: number } | null {
        const config = this.buildingConfigs[buildingTypeId as keyof typeof this.buildingConfigs];
        if (config) {
            return {
                r: config.color.r * 0.1,
                g: config.color.g * 0.1,
                b: config.color.b * 0.1
            };
        }
        return null;
    }

    public updateAllVisuals(): void {
        for (const buildingVisual of this.buildingVisuals.values()) {
            if (buildingVisual.building.isActiveBuilding()) {
                this.updateBuildingVisual(buildingVisual);
            }
        }
    }

    public removeBuildingVisual(buildingId: string): void {
        const buildingVisual = this.buildingVisuals.get(buildingId);
        if (!buildingVisual) {
            return;
        }

        buildingVisual.mesh.dispose();
        buildingVisual.constructionIndicator.dispose();
        if (buildingVisual.energyIndicator) {
            buildingVisual.energyIndicator.dispose();
        }
        if (buildingVisual.energyCore) {
            buildingVisual.energyCore.dispose();
        }
        if (buildingVisual.energyCoreMaterial) {
            buildingVisual.energyCoreMaterial.dispose();
        }
        if (buildingVisual.antennaRotator) {
            buildingVisual.antennaRotator.dispose();
        }
        if (buildingVisual.containmentRing) {
            buildingVisual.containmentRing.dispose();
        }
        buildingVisual.rootNode.dispose();

        this.buildingVisuals.delete(buildingId);
    }

    public getBuildingVisual(buildingId: string): BuildingVisual | null {
        return this.buildingVisuals.get(buildingId) || null;
    }

    public getAllBuildingVisuals(): BuildingVisual[] {
        return Array.from(this.buildingVisuals.values());
    }

    public getRenderingStats(): BuildingRenderingStats {
        const stats: BuildingRenderingStats = {
            totalBuildings: this.buildingVisuals.size,
            activeBuildings: 0,
            completedBuildings: 0,
            buildingsByType: {}
        };

        for (const buildingVisual of this.buildingVisuals.values()) {
            const building = buildingVisual.building;
            const buildingType = building.getBuildingType().id;

            if (building.isActiveBuilding()) {
                stats.activeBuildings++;
            }

            if (building.isComplete()) {
                stats.completedBuildings++;
            }

            stats.buildingsByType[buildingType] = (stats.buildingsByType[buildingType] || 0) + 1;
        }

        return stats;
    }

    public dispose(): void {
        for (const buildingId of this.buildingVisuals.keys()) {
            this.removeBuildingVisual(buildingId);
        }

        this.materials.dispose();
    }
}
