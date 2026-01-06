/**
 * BuildingRenderer - 3D building visualization with construction progress
 * 
 * Manages the 3D representation of buildings with low poly aesthetic,
 * construction progress visualization, and energy generation indicators.
 */

import { 
    Scene, 
    Mesh, 
    MeshBuilder, 
    StandardMaterial, 
    Color3, 
    Vector3,
    TransformNode
} from '@babylonjs/core';
import { MaterialManager } from './MaterialManager';
import { Building } from '../game/entities/Building';

export interface BuildingVisual {
    building: Building;
    mesh: Mesh;
    material: StandardMaterial;
    constructionIndicator: Mesh;
    energyIndicator: Mesh;
    rootNode: TransformNode;
}

export class BuildingRenderer {
    private scene: Scene;
    private materialManager: MaterialManager;
    
    // Building visuals management
    private buildingVisuals: Map<string, BuildingVisual> = new Map();
    
    // Materials for different building types
    private baseMaterial: StandardMaterial | null = null;
    private powerPlantMaterial: StandardMaterial | null = null;
    private constructionMaterial: StandardMaterial | null = null;
    private energyIndicatorMaterial: StandardMaterial | null = null;
    
    // Building type configurations
    private readonly buildingConfigs = {
        base: {
            color: new Color3(0.8, 0.8, 0.2), // Yellow
            shape: 'pyramid',
            size: { width: 3, height: 2, depth: 3 }
        },
        powerPlant: {
            color: new Color3(0.8, 0.4, 0.2), // Orange
            shape: 'cylinder',
            size: { diameter: 2.5, height: 1.5 }
        }
    };

    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;
        
        this.initializeMaterials();
        console.log('🏗️ BuildingRenderer initialized');
    }

    /**
     * Initialize materials for building rendering
     */
    private initializeMaterials(): void {
        // Base material (Yellow)
        this.baseMaterial = new StandardMaterial('baseMaterial', this.scene);
        this.baseMaterial.diffuseColor = this.buildingConfigs.base.color;
        this.baseMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
        this.baseMaterial.emissiveColor = this.buildingConfigs.base.color.scale(0.1);

        // Power Plant material (Orange)
        this.powerPlantMaterial = new StandardMaterial('powerPlantMaterial', this.scene);
        this.powerPlantMaterial.diffuseColor = this.buildingConfigs.powerPlant.color;
        this.powerPlantMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
        this.powerPlantMaterial.emissiveColor = this.buildingConfigs.powerPlant.color.scale(0.1);

        // Construction material (Gray, semi-transparent)
        this.constructionMaterial = new StandardMaterial('constructionMaterial', this.scene);
        this.constructionMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);
        this.constructionMaterial.alpha = 0.7;
        this.constructionMaterial.wireframe = true;

        // Energy indicator material
        this.energyIndicatorMaterial = new StandardMaterial('buildingEnergyMaterial', this.scene);
        this.energyIndicatorMaterial.diffuseColor = new Color3(0, 1, 0); // Green
        this.energyIndicatorMaterial.emissiveColor = new Color3(0, 0.3, 0);

        console.log('🏗️ Building materials initialized');
    }

    /**
     * Create visual representation for a building
     */
    public createBuildingVisual(building: Building): BuildingVisual | null {
        const buildingId = building.getId();
        
        if (this.buildingVisuals.has(buildingId)) {
            console.warn(`⚠️ Building visual already exists for ${buildingId}`);
            return this.buildingVisuals.get(buildingId) || null;
        }

        try {
            // Create root node for building
            const rootNode = new TransformNode(`building_root_${buildingId}`, this.scene);
            rootNode.position = building.getPosition();

            // Get building type configuration
            const buildingType = building.getBuildingType();
            const configKey = buildingType.id as keyof typeof this.buildingConfigs;
            const config = this.buildingConfigs[configKey];
            
            if (!config) {
                console.error(`❌ Unknown building type: ${buildingType.id}`);
                return null;
            }

            // Create main building mesh based on type
            let mesh: Mesh;
            if (config.shape === 'pyramid') {
                // Create pyramid for base
                const pyramidConfig = config.size as { width: number; height: number; depth: number };
                mesh = MeshBuilder.CreateBox(`building_${buildingId}`, {
                    width: pyramidConfig.width,
                    height: pyramidConfig.height,
                    depth: pyramidConfig.depth
                }, this.scene);
                
                // TODO: Could create actual pyramid geometry for better visual
            } else if (config.shape === 'cylinder') {
                // Create cylinder for power plant
                const cylinderConfig = config.size as { diameter: number; height: number };
                mesh = MeshBuilder.CreateCylinder(`building_${buildingId}`, {
                    diameter: cylinderConfig.diameter,
                    height: cylinderConfig.height,
                    tessellation: 8 // Low poly
                }, this.scene);
            } else {
                // Default to box
                mesh = MeshBuilder.CreateBox(`building_${buildingId}`, {
                    width: 2,
                    height: 1.5,
                    depth: 2
                }, this.scene);
            }

            mesh.parent = rootNode;
            
            // Set position based on building type
            if (config.shape === 'cylinder') {
                const cylinderConfig = config.size as { diameter: number; height: number };
                mesh.position.y = cylinderConfig.height / 2;
            } else {
                const boxConfig = config.size as { width: number; height: number; depth: number };
                mesh.position.y = boxConfig.height / 2;
            }

            // Apply material based on building type
            const material = this.getBuildingMaterial(buildingType.id);
            if (material) {
                mesh.material = material;
            }

            // Create construction indicator (wireframe overlay)
            const constructionIndicator = mesh.clone(`construction_${buildingId}`);
            constructionIndicator.parent = rootNode;
            constructionIndicator.material = this.constructionMaterial;
            constructionIndicator.scaling = new Vector3(1.1, 1.1, 1.1); // Slightly larger

            // Create energy indicator (small sphere above building)
            const energyIndicator = MeshBuilder.CreateSphere(`building_energy_${buildingId}`, {
                diameter: 0.4,
                segments: 6
            }, this.scene);

            energyIndicator.parent = rootNode;
            energyIndicator.position.y = (config.size.height || 1.5) + 0.5;
            energyIndicator.material = this.energyIndicatorMaterial;

            // Create building visual object
            const buildingVisual: BuildingVisual = {
                building,
                mesh,
                material: material!,
                constructionIndicator,
                energyIndicator,
                rootNode
            };

            // Store building visual
            this.buildingVisuals.set(buildingId, buildingVisual);

            // Update initial visual state
            this.updateBuildingVisual(buildingVisual);

            console.log(`🏗️ Created visual for ${buildingType.name} building ${buildingId}`);
            return buildingVisual;

        } catch (error) {
            console.error(`❌ Failed to create building visual for ${buildingId}:`, error);
            return null;
        }
    }

    /**
     * Get material for building type
     */
    private getBuildingMaterial(buildingTypeId: string): StandardMaterial | null {
        switch (buildingTypeId) {
            case 'base': return this.baseMaterial;
            case 'powerPlant': return this.powerPlantMaterial;
            default: return this.baseMaterial;
        }
    }

    /**
     * Update building visual based on building state
     */
    public updateBuildingVisual(buildingVisual: BuildingVisual): void {
        const building = buildingVisual.building;
        
        // Update position
        buildingVisual.rootNode.position = building.getPosition();
        
        // Update construction progress
        this.updateConstructionVisualization(buildingVisual);
        
        // Update energy generation visualization
        this.updateEnergyVisualization(buildingVisual);
        
        // Update health visualization
        this.updateHealthVisualization(buildingVisual);
    }

    /**
     * Update construction progress visualization
     */
    private updateConstructionVisualization(buildingVisual: BuildingVisual): void {
        const progress = buildingVisual.building.getConstructionProgress();
        
        // Scale main mesh based on construction progress
        const scale = Math.max(0.1, progress); // Minimum 10% scale
        buildingVisual.mesh.scaling = new Vector3(scale, scale, scale);
        
        // Show/hide construction indicator
        if (progress < 1.0) {
            buildingVisual.constructionIndicator.setEnabled(true);
            buildingVisual.constructionIndicator.scaling = new Vector3(1.1, 1.1, 1.1);
        } else {
            buildingVisual.constructionIndicator.setEnabled(false);
        }
        
        // Adjust material opacity based on construction
        if (buildingVisual.material) {
            buildingVisual.material.alpha = 0.5 + (progress * 0.5); // 0.5 to 1.0 alpha
        }
    }

    /**
     * Update energy generation visualization
     */
    private updateEnergyVisualization(buildingVisual: BuildingVisual): void {
        const building = buildingVisual.building;
        const energyGeneration = building.getEnergyGeneration();
        
        if (energyGeneration > 0 && building.isComplete()) {
            // Show energy indicator for power-generating buildings
            buildingVisual.energyIndicator.setEnabled(true);
            
            // Pulse based on energy generation rate
            const pulseScale = 1.0 + (energyGeneration * 0.1);
            buildingVisual.energyIndicator.scaling = new Vector3(pulseScale, pulseScale, pulseScale);
            
            // Color based on generation rate
            if (this.energyIndicatorMaterial) {
                const intensity = Math.min(1.0, energyGeneration / 3.0); // Normalize to max 3 energy/sec
                this.energyIndicatorMaterial.emissiveColor = new Color3(0, intensity, 0);
            }
        } else {
            // Hide energy indicator for non-generating buildings
            buildingVisual.energyIndicator.setEnabled(false);
        }
    }

    /**
     * Update health visualization
     */
    private updateHealthVisualization(buildingVisual: BuildingVisual): void {
        const healthPercentage = buildingVisual.building.getHealth() / buildingVisual.building.getMaxHealth();
        
        // Adjust material emissive based on health
        if (buildingVisual.material) {
            const baseEmissive = this.getBaseEmissiveColor(buildingVisual.building.getBuildingType().id);
            if (baseEmissive) {
                buildingVisual.material.emissiveColor = baseEmissive.scale(healthPercentage);
            }
        }
    }

    /**
     * Get base emissive color for building type
     */
    private getBaseEmissiveColor(buildingTypeId: string): Color3 | null {
        const config = this.buildingConfigs[buildingTypeId as keyof typeof this.buildingConfigs];
        return config ? config.color.scale(0.1) : null;
    }

    /**
     * Update all building visuals
     */
    public updateAllVisuals(): void {
        for (const buildingVisual of this.buildingVisuals.values()) {
            if (buildingVisual.building.isActiveBuilding()) {
                this.updateBuildingVisual(buildingVisual);
            }
        }
    }

    /**
     * Remove building visual
     */
    public removeBuildingVisual(buildingId: string): void {
        const buildingVisual = this.buildingVisuals.get(buildingId);
        if (!buildingVisual) {
            return;
        }

        // Dispose all meshes
        buildingVisual.mesh.dispose();
        buildingVisual.constructionIndicator.dispose();
        buildingVisual.energyIndicator.dispose();
        buildingVisual.rootNode.dispose();

        // Remove from map
        this.buildingVisuals.delete(buildingId);

        console.log(`🗑️ Removed visual for building ${buildingId}`);
    }

    /**
     * Get building visual by ID
     */
    public getBuildingVisual(buildingId: string): BuildingVisual | null {
        return this.buildingVisuals.get(buildingId) || null;
    }

    /**
     * Get all building visuals
     */
    public getAllBuildingVisuals(): BuildingVisual[] {
        return Array.from(this.buildingVisuals.values());
    }

    /**
     * Get rendering statistics
     */
    public getRenderingStats(): {
        totalBuildings: number;
        activeBuildings: number;
        completedBuildings: number;
        buildingsByType: { [key: string]: number };
    } {
        const stats = {
            totalBuildings: this.buildingVisuals.size,
            activeBuildings: 0,
            completedBuildings: 0,
            buildingsByType: {} as { [key: string]: number }
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

    /**
     * Dispose building renderer
     */
    public dispose(): void {
        console.log('🗑️ Disposing BuildingRenderer...');

        // Remove all building visuals
        for (const buildingId of this.buildingVisuals.keys()) {
            this.removeBuildingVisual(buildingId);
        }

        // Dispose materials
        this.baseMaterial?.dispose();
        this.powerPlantMaterial?.dispose();
        this.constructionMaterial?.dispose();
        this.energyIndicatorMaterial?.dispose();

        console.log('✅ BuildingRenderer disposed');
    }
}