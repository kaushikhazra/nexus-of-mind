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
    TransformNode,
    VertexData
} from '@babylonjs/core';
import { MaterialManager } from './MaterialManager';
import { Building } from '../game/entities/Building';

export interface BuildingVisual {
    building: Building;
    mesh: Mesh;
    material: StandardMaterial;
    constructionIndicator: Mesh;
    energyIndicator: Mesh | null; // Optional energy indicator
    rootNode: TransformNode;
    energyCore: Mesh | null; // Inner energy core for base/power plant
    energyCoreMaterial: StandardMaterial | null;
    antennaRotator: Mesh | null; // Rotating antenna element (base)
    containmentRing: Mesh | null; // Rotating containment ring (power plant)
}

export class BuildingRenderer {
    private scene: Scene;
    private materialManager: MaterialManager;
    
    // Building visuals management
    private buildingVisuals: Map<string, BuildingVisual> = new Map();
    
    // Materials for different building types
    private baseMaterial: StandardMaterial | null = null;
    private baseDomeMaterial: StandardMaterial | null = null;
    private baseGlowMaterial: StandardMaterial | null = null;
    private basePillarMaterial: StandardMaterial | null = null;
    private baseAntennaMaterial: StandardMaterial | null = null;
    private powerPlantMaterial: StandardMaterial | null = null;
    private powerPlantCoreMaterial: StandardMaterial | null = null;
    private powerPlantGlowMaterial: StandardMaterial | null = null;
    private powerPlantStructMaterial: StandardMaterial | null = null;
    private constructionMaterial: StandardMaterial | null = null;
    private energyIndicatorMaterial: StandardMaterial | null = null;
    
    // Building type configurations
    private readonly buildingConfigs = {
        base: {
            color: new Color3(0.2, 0.6, 0.8), // Cyan/teal for sci-fi look
            shape: 'complex', // New complex multi-part design
            size: { width: 5, height: 3.5, depth: 5 }
        },
        powerPlant: {
            color: new Color3(1.0, 0.5, 0.1), // Bright orange
            shape: 'reactor', // Complex fusion reactor design
            size: { diameter: 3, height: 2.5 } // Smaller than base (5x3.5)
        }
    };

    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;

        this.initializeMaterials();
    }

    /**
     * Initialize materials for building rendering
     */
    private initializeMaterials(): void {
        // Base platform material (Dark metallic)
        this.baseMaterial = new StandardMaterial('baseMaterial', this.scene);
        this.baseMaterial.diffuseColor = new Color3(0.15, 0.2, 0.25);
        this.baseMaterial.specularColor = new Color3(0.4, 0.4, 0.4);
        this.baseMaterial.emissiveColor = new Color3(0.02, 0.05, 0.08);

        // Base dome material (Semi-transparent cyan)
        this.baseDomeMaterial = new StandardMaterial('baseDomeMaterial', this.scene);
        this.baseDomeMaterial.diffuseColor = new Color3(0.3, 0.7, 0.9);
        this.baseDomeMaterial.specularColor = new Color3(0.6, 0.6, 0.6);
        this.baseDomeMaterial.emissiveColor = new Color3(0.1, 0.2, 0.3);
        this.baseDomeMaterial.alpha = 0.6;

        // Base glow/energy material (Bright cyan glow)
        this.baseGlowMaterial = new StandardMaterial('baseGlowMaterial', this.scene);
        this.baseGlowMaterial.diffuseColor = new Color3(0.3, 0.8, 1.0);
        this.baseGlowMaterial.emissiveColor = new Color3(0.4, 1.2, 1.5);
        this.baseGlowMaterial.disableLighting = true;

        // Base pillar material (Metallic gray)
        this.basePillarMaterial = new StandardMaterial('basePillarMaterial', this.scene);
        this.basePillarMaterial.diffuseColor = new Color3(0.3, 0.35, 0.4);
        this.basePillarMaterial.specularColor = new Color3(0.5, 0.5, 0.5);
        this.basePillarMaterial.emissiveColor = new Color3(0.03, 0.04, 0.05);

        // Base antenna material (Silver with glow)
        this.baseAntennaMaterial = new StandardMaterial('baseAntennaMaterial', this.scene);
        this.baseAntennaMaterial.diffuseColor = new Color3(0.6, 0.65, 0.7);
        this.baseAntennaMaterial.specularColor = new Color3(0.8, 0.8, 0.8);
        this.baseAntennaMaterial.emissiveColor = new Color3(0.1, 0.15, 0.2);

        // Power Plant main shell material (Semi-transparent orange)
        this.powerPlantMaterial = new StandardMaterial('powerPlantMaterial', this.scene);
        this.powerPlantMaterial.diffuseColor = new Color3(0.9, 0.4, 0.1);
        this.powerPlantMaterial.specularColor = new Color3(0.4, 0.3, 0.2);
        this.powerPlantMaterial.emissiveColor = new Color3(0.15, 0.05, 0.0);
        this.powerPlantMaterial.alpha = 0.7;

        // Power Plant plasma core material (Bright glowing orange/yellow)
        this.powerPlantCoreMaterial = new StandardMaterial('powerPlantCoreMaterial', this.scene);
        this.powerPlantCoreMaterial.diffuseColor = new Color3(1.0, 0.7, 0.2);
        this.powerPlantCoreMaterial.emissiveColor = new Color3(1.5, 0.8, 0.2);
        this.powerPlantCoreMaterial.disableLighting = true;

        // Power Plant glow material (Energy nodes and rings)
        this.powerPlantGlowMaterial = new StandardMaterial('powerPlantGlowMaterial', this.scene);
        this.powerPlantGlowMaterial.diffuseColor = new Color3(1.0, 0.6, 0.1);
        this.powerPlantGlowMaterial.emissiveColor = new Color3(1.2, 0.5, 0.1);
        this.powerPlantGlowMaterial.disableLighting = true;

        // Power Plant structure material (Dark metallic)
        this.powerPlantStructMaterial = new StandardMaterial('powerPlantStructMaterial', this.scene);
        this.powerPlantStructMaterial.diffuseColor = new Color3(0.2, 0.18, 0.15);
        this.powerPlantStructMaterial.specularColor = new Color3(0.4, 0.35, 0.3);
        this.powerPlantStructMaterial.emissiveColor = new Color3(0.03, 0.02, 0.01);

        // Construction material (Gray, semi-transparent)
        this.constructionMaterial = new StandardMaterial('constructionMaterial', this.scene);
        this.constructionMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);
        this.constructionMaterial.alpha = 0.7;
        this.constructionMaterial.wireframe = true;

        // Energy indicator material
        this.energyIndicatorMaterial = new StandardMaterial('buildingEnergyMaterial', this.scene);
        this.energyIndicatorMaterial.diffuseColor = new Color3(0, 1, 0); // Green
        this.energyIndicatorMaterial.emissiveColor = new Color3(0, 0.3, 0);
    }

    /**
     * Create complex multi-part base building mesh
     */
    private createComplexBaseMesh(buildingId: string, rootNode: TransformNode): {
        mainMesh: Mesh;
        energyCore: Mesh;
        energyCoreMaterial: StandardMaterial;
        antennaRotator: Mesh;
    } {
        // ===== 1. MAIN HEXAGONAL PLATFORM (foundation) =====
        const platform = MeshBuilder.CreateCylinder(`base_platform_${buildingId}`, {
            diameter: 5,
            height: 0.4,
            tessellation: 6 // Hexagonal
        }, this.scene);
        platform.parent = rootNode;
        platform.position.y = 0.2;
        platform.material = this.baseMaterial;

        // ===== 2. UPPER PLATFORM (second tier) =====
        const upperPlatform = MeshBuilder.CreateCylinder(`base_upper_${buildingId}`, {
            diameter: 3.5,
            height: 0.3,
            tessellation: 6
        }, this.scene);
        upperPlatform.parent = rootNode;
        upperPlatform.position.y = 0.55;
        upperPlatform.material = this.baseMaterial;

        // ===== 3. SUPPORT PILLARS (4 pillars at corners) =====
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
            pillar.material = this.basePillarMaterial;

            // Pillar cap (small sphere on top)
            const pillarCap = MeshBuilder.CreateSphere(`base_pillar_cap_${buildingId}_${i}`, {
                diameter: 0.35,
                segments: 6
            }, this.scene);
            pillarCap.parent = rootNode;
            pillarCap.position = pillarPositions[i].clone();
            pillarCap.position.y = 1.2;
            pillarCap.material = this.baseGlowMaterial;
        }

        // ===== 4. CENTRAL COMMAND DOME (semi-transparent) =====
        const dome = MeshBuilder.CreateSphere(`base_dome_${buildingId}`, {
            diameter: 2.2,
            segments: 8,
            slice: 0.5 // Half sphere (dome)
        }, this.scene);
        dome.parent = rootNode;
        dome.position.y = 0.7;
        dome.material = this.baseDomeMaterial;

        // ===== 5. INNER ENERGY CORE (glowing sphere inside dome) =====
        const energyCore = MeshBuilder.CreateSphere(`base_core_${buildingId}`, {
            diameter: 0.9,
            segments: 8
        }, this.scene);
        energyCore.parent = rootNode;
        energyCore.position.y = 1.1;

        // Create dedicated energy core material
        const energyCoreMaterial = new StandardMaterial(`base_core_mat_${buildingId}`, this.scene);
        energyCoreMaterial.diffuseColor = new Color3(0.3, 0.9, 1.0);
        energyCoreMaterial.emissiveColor = new Color3(0.5, 1.5, 1.8);
        energyCoreMaterial.disableLighting = true;
        energyCore.material = energyCoreMaterial;

        // ===== 6. ANTENNA TOWER =====
        const antennaPole = MeshBuilder.CreateCylinder(`base_antenna_pole_${buildingId}`, {
            diameter: 0.15,
            height: 1.5,
            tessellation: 6
        }, this.scene);
        antennaPole.parent = rootNode;
        antennaPole.position.y = 2.4;
        antennaPole.material = this.baseAntennaMaterial;

        // ===== 7. ROTATING ANTENNA DISH/RADAR =====
        const antennaRotator = MeshBuilder.CreateTorus(`base_antenna_ring_${buildingId}`, {
            diameter: 0.8,
            thickness: 0.08,
            tessellation: 8
        }, this.scene);
        antennaRotator.parent = rootNode;
        antennaRotator.position.y = 3.0;
        antennaRotator.rotation.x = Math.PI / 2; // Horizontal ring
        antennaRotator.material = this.baseGlowMaterial;

        // Antenna tip (beacon)
        const antennaBeacon = MeshBuilder.CreateSphere(`base_beacon_${buildingId}`, {
            diameter: 0.2,
            segments: 6
        }, this.scene);
        antennaBeacon.parent = rootNode;
        antennaBeacon.position.y = 3.2;
        antennaBeacon.material = this.baseGlowMaterial;

        // ===== 8. LANDING PAD EXTENSIONS (4 pads) =====
        const padAngles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
        for (let i = 0; i < padAngles.length; i++) {
            const angle = padAngles[i];
            const padDistance = 2.8;

            // Landing pad
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
            pad.material = this.basePillarMaterial;

            // Pad glow light
            const padLight = MeshBuilder.CreateSphere(`base_pad_light_${buildingId}_${i}`, {
                diameter: 0.15,
                segments: 6
            }, this.scene);
            padLight.parent = rootNode;
            padLight.position.x = Math.cos(angle) * padDistance;
            padLight.position.z = Math.sin(angle) * padDistance;
            padLight.position.y = 0.2;
            padLight.material = this.baseGlowMaterial;
        }

        // ===== 9. ENERGY CONDUITS (connecting lines from pillars to dome) =====
        for (let i = 0; i < pillarPositions.length; i++) {
            const conduit = MeshBuilder.CreateCylinder(`base_conduit_${buildingId}_${i}`, {
                diameter: 0.08,
                height: 1.0,
                tessellation: 6
            }, this.scene);
            conduit.parent = rootNode;

            // Position conduit at angle from pillar to dome
            const pillarPos = pillarPositions[i];
            conduit.position.x = pillarPos.x * 0.5;
            conduit.position.z = pillarPos.z * 0.5;
            conduit.position.y = 1.0;

            // Rotate to point toward center
            const angleToCenter = Math.atan2(-pillarPos.z, -pillarPos.x);
            conduit.rotation.z = Math.PI / 4; // 45 degree angle
            conduit.rotation.y = angleToCenter + Math.PI / 2;
            conduit.material = this.baseGlowMaterial;
        }

        return {
            mainMesh: platform,
            energyCore,
            energyCoreMaterial,
            antennaRotator
        };
    }

    /**
     * Create complex fusion reactor power plant mesh
     */
    private createComplexPowerPlantMesh(buildingId: string, rootNode: TransformNode): {
        mainMesh: Mesh;
        energyCore: Mesh;
        energyCoreMaterial: StandardMaterial;
        containmentRing: Mesh;
    } {
        // ===== 1. HEXAGONAL BASE PLATFORM =====
        const basePlatform = MeshBuilder.CreateCylinder(`pp_base_${buildingId}`, {
            diameter: 3,
            height: 0.2,
            tessellation: 6
        }, this.scene);
        basePlatform.parent = rootNode;
        basePlatform.position.y = 0.1;
        basePlatform.material = this.powerPlantStructMaterial;

        // ===== 2. ENERGY OUTPUT NODES (6 around the base) =====
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
            node.material = this.powerPlantGlowMaterial;
        }

        // ===== 3. SUPPORT STRUTS (6 angled legs) =====
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + Math.PI / 6; // Offset by 30 degrees

            const strut = MeshBuilder.CreateCylinder(`pp_strut_${buildingId}_${i}`, {
                diameter: 0.1,
                height: 0.8,
                tessellation: 6
            }, this.scene);
            strut.parent = rootNode;
            strut.position.x = Math.cos(angle) * 0.7;
            strut.position.z = Math.sin(angle) * 0.7;
            strut.position.y = 0.5;
            // Angle the struts outward
            strut.rotation.x = Math.sin(angle) * 0.3;
            strut.rotation.z = -Math.cos(angle) * 0.3;
            strut.material = this.powerPlantStructMaterial;
        }

        // ===== 4. MAIN REACTOR CYLINDER (semi-transparent shell) =====
        const reactorShell = MeshBuilder.CreateCylinder(`pp_reactor_${buildingId}`, {
            diameter: 1.4,
            height: 1.2,
            tessellation: 8
        }, this.scene);
        reactorShell.parent = rootNode;
        reactorShell.position.y = 1.1;
        reactorShell.material = this.powerPlantMaterial;

        // ===== 5. INNER PLASMA CORE (bright glowing) =====
        const energyCore = MeshBuilder.CreateSphere(`pp_core_${buildingId}`, {
            diameter: 0.7,
            segments: 8
        }, this.scene);
        energyCore.parent = rootNode;
        energyCore.position.y = 1.1;

        // Create dedicated plasma core material
        const energyCoreMaterial = new StandardMaterial(`pp_core_mat_${buildingId}`, this.scene);
        energyCoreMaterial.diffuseColor = new Color3(1.0, 0.7, 0.2);
        energyCoreMaterial.emissiveColor = new Color3(1.5, 0.9, 0.3);
        energyCoreMaterial.disableLighting = true;
        energyCore.material = energyCoreMaterial;

        // ===== 6. ROTATING CONTAINMENT RING =====
        const containmentRing = MeshBuilder.CreateTorus(`pp_ring_${buildingId}`, {
            diameter: 1.6,
            thickness: 0.08,
            tessellation: 16
        }, this.scene);
        containmentRing.parent = rootNode;
        containmentRing.position.y = 1.1;
        containmentRing.rotation.x = Math.PI / 2;
        containmentRing.material = this.powerPlantGlowMaterial;

        // Secondary containment ring (perpendicular)
        const containmentRing2 = MeshBuilder.CreateTorus(`pp_ring2_${buildingId}`, {
            diameter: 1.5,
            thickness: 0.06,
            tessellation: 16
        }, this.scene);
        containmentRing2.parent = containmentRing; // Parent to first ring for combined rotation
        containmentRing2.rotation.x = Math.PI / 2;
        containmentRing2.material = this.powerPlantGlowMaterial;

        // ===== 7. REACTOR TOP CAP =====
        const topCap = MeshBuilder.CreateCylinder(`pp_cap_${buildingId}`, {
            diameterTop: 0.6,
            diameterBottom: 1.0,
            height: 0.3,
            tessellation: 8
        }, this.scene);
        topCap.parent = rootNode;
        topCap.position.y = 1.85;
        topCap.material = this.powerPlantStructMaterial;

        // ===== 8. COOLING FINS (3 angled panels) =====
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
            fin.rotation.x = -0.4; // Angle outward
            fin.material = this.powerPlantStructMaterial;
        }

        // ===== 9. ENERGY BEACON (top) =====
        const beacon = MeshBuilder.CreateSphere(`pp_beacon_${buildingId}`, {
            diameter: 0.25,
            segments: 6
        }, this.scene);
        beacon.parent = rootNode;
        beacon.position.y = 2.3;
        beacon.material = this.powerPlantGlowMaterial;

        // Beacon glow ring
        const beaconRing = MeshBuilder.CreateTorus(`pp_beacon_ring_${buildingId}`, {
            diameter: 0.4,
            thickness: 0.04,
            tessellation: 8
        }, this.scene);
        beaconRing.parent = rootNode;
        beaconRing.position.y = 2.3;
        beaconRing.rotation.x = Math.PI / 2;
        beaconRing.material = this.powerPlantGlowMaterial;

        return {
            mainMesh: basePlatform,
            energyCore,
            energyCoreMaterial,
            containmentRing
        };
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
            let energyCore: Mesh | null = null;
            let energyCoreMaterial: StandardMaterial | null = null;
            let antennaRotator: Mesh | null = null;
            let containmentRing: Mesh | null = null;

            if (config.shape === 'complex') {
                // Create complex multi-part base building
                const result = this.createComplexBaseMesh(buildingId, rootNode);
                mesh = result.mainMesh;
                energyCore = result.energyCore;
                energyCoreMaterial = result.energyCoreMaterial;
                antennaRotator = result.antennaRotator;

            } else if (config.shape === 'reactor') {
                // Create complex fusion reactor power plant
                const result = this.createComplexPowerPlantMesh(buildingId, rootNode);
                mesh = result.mainMesh;
                energyCore = result.energyCore;
                energyCoreMaterial = result.energyCoreMaterial;
                containmentRing = result.containmentRing;

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
            if (config.shape === 'pyramid') {
                // Pyramid is already positioned with base at y=0, no adjustment needed
                mesh.position.y = 0;
            } else if (config.shape === 'cylinder') {
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

            // Create building visual object
            const buildingVisual: BuildingVisual = {
                building,
                mesh,
                material: material!,
                constructionIndicator,
                energyIndicator: null, // No energy indicator for clean design
                rootNode,
                energyCore,
                energyCoreMaterial,
                antennaRotator,
                containmentRing
            };

            // Store building visual
            this.buildingVisuals.set(buildingId, buildingVisual);

            // Update initial visual state
            this.updateBuildingVisual(buildingVisual);

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

        // Update base-specific animations
        this.updateBaseAnimations(buildingVisual);
    }

    /**
     * Update building-specific animations (antenna rotation, energy core pulse, containment rings)
     */
    private updateBaseAnimations(buildingVisual: BuildingVisual): void {
        const building = buildingVisual.building;
        const buildingType = building.getBuildingType();
        const time = performance.now() / 1000;

        // Base building animations
        if (buildingType.id === 'base') {
            // Rotate antenna
            if (buildingVisual.antennaRotator) {
                buildingVisual.antennaRotator.rotation.z += 0.02; // Slow rotation
            }

            // Pulse energy core based on energy storage
            if (buildingVisual.energyCore && buildingVisual.energyCoreMaterial) {
                const energyStorage = building.getEnergyStorage();

                if (energyStorage) {
                    const energyPercent = energyStorage.getCurrentEnergy() / energyStorage.getCapacity();
                    const pulseIntensity = 0.3 + energyPercent * 0.7;
                    const pulse = Math.sin(time * 2) * 0.15 + 0.85;
                    const baseIntensity = pulseIntensity * pulse;

                    buildingVisual.energyCoreMaterial.emissiveColor = new Color3(
                        0.3 * baseIntensity,
                        1.2 * baseIntensity,
                        1.5 * baseIntensity
                    );

                    const coreScale = 0.95 + pulse * 0.1;
                    buildingVisual.energyCore.scaling = new Vector3(coreScale, coreScale, coreScale);
                } else {
                    const pulse = Math.sin(time * 2) * 0.2 + 0.8;
                    buildingVisual.energyCoreMaterial.emissiveColor = new Color3(0.4 * pulse, 1.2 * pulse, 1.5 * pulse);
                }
            }
        }

        // Power plant animations
        if (buildingType.id === 'powerPlant') {
            // Rotate containment rings
            if (buildingVisual.containmentRing) {
                buildingVisual.containmentRing.rotation.z += 0.03; // Faster rotation for power plant
                buildingVisual.containmentRing.rotation.y += 0.015; // Wobble effect
            }

            // Pulse plasma core based on energy generation
            if (buildingVisual.energyCore && buildingVisual.energyCoreMaterial) {
                const energyGeneration = building.getEnergyGeneration();

                // Faster pulse for power plants (energy generation speed)
                const pulseSpeed = 3 + energyGeneration * 0.5;
                const pulse = Math.sin(time * pulseSpeed) * 0.2 + 0.8;

                // Orange/yellow glow for plasma
                buildingVisual.energyCoreMaterial.emissiveColor = new Color3(
                    1.5 * pulse,
                    0.9 * pulse,
                    0.3 * pulse
                );

                // Core scale pulsing
                const coreScale = 0.9 + pulse * 0.15;
                buildingVisual.energyCore.scaling = new Vector3(coreScale, coreScale, coreScale);
            }
        }
    }

    /**
     * Update construction progress visualization - INSTANT BUILDING PLACEMENT
     */
    private updateConstructionVisualization(buildingVisual: BuildingVisual): void {
        // Buildings appear instantly at full size - no construction animation
        buildingVisual.mesh.scaling = new Vector3(1, 1, 1); // Always full size
        
        // Always hide construction indicator for instant placement
        buildingVisual.constructionIndicator.setEnabled(false);
        
        // Always full opacity for instant placement
        if (buildingVisual.material) {
            buildingVisual.material.alpha = 1.0; // Full opacity
        }
    }

    /**
     * Update energy generation visualization
     */
    private updateEnergyVisualization(buildingVisual: BuildingVisual): void {
        const building = buildingVisual.building;
        const energyGeneration = building.getEnergyGeneration();
        
        if (energyGeneration > 0 && building.isComplete() && buildingVisual.energyIndicator) {
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
        } else if (buildingVisual.energyIndicator) {
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

        // Remove from map
        this.buildingVisuals.delete(buildingId);
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
        // Remove all building visuals
        for (const buildingId of this.buildingVisuals.keys()) {
            this.removeBuildingVisual(buildingId);
        }

        // Dispose materials
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