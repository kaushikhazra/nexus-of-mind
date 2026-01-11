/**
 * UnitRenderer - 3D unit visualization with low poly aesthetic and energy feedback
 * 
 * Manages the 3D representation of all units with color coding, energy level indicators,
 * and efficient rendering for multiple units while maintaining 60fps performance.
 */

import { 
    Scene, 
    Mesh, 
    MeshBuilder, 
    StandardMaterial, 
    Color3, 
    Vector3,
    TransformNode,
    Animation,
    IAnimationKey
} from '@babylonjs/core';
import { MaterialManager } from './MaterialManager';
import { Unit } from '../game/entities/Unit';
import { GameEngine } from '../game/GameEngine';
import { Worker } from '../game/entities/Worker';
import { Scout } from '../game/entities/Scout';
import { Protector } from '../game/entities/Protector';

export interface UnitVisual {
    unit: Unit;
    mesh: Mesh;
    material: StandardMaterial;
    energyIndicator: Mesh;
    selectionIndicator: Mesh;
    miningConnectionLine: Mesh | null; // Visual line to mining target
    rootNode: TransformNode;
    lastPosition: Vector3; // Track last position for rotation
    energyCore: Mesh | null; // Inner glow sphere for energy visualization
    energyCoreMaterial: StandardMaterial | null; // Material for the energy core
}

export class UnitRenderer {
    private scene: Scene;
    private materialManager: MaterialManager;
    
    // Unit visuals management
    private unitVisuals: Map<string, UnitVisual> = new Map();
    
    // Materials for different unit types
    private workerMaterial: StandardMaterial | null = null;
    private scoutMaterial: StandardMaterial | null = null;
    private protectorMaterial: StandardMaterial | null = null;
    private selectionMaterial: StandardMaterial | null = null;
    private energyIndicatorMaterial: StandardMaterial | null = null;
    
    // Unit type configurations
    private readonly unitConfigs = {
        worker: {
            color: new Color3(0.2, 0.5, 0.2), // Green
            accentColor: new Color3(0.4, 0.4, 0.4), // Gray for engine/hands
            radius: 0.35,
            segments: 8 // Low poly
        },
        scout: {
            color: new Color3(0.2, 0.2, 0.8), // Blue
            accentColor: new Color3(0.3, 0.3, 0.5),
            radius: 0.25, // Smaller and faster
            segments: 6 // Lower poly for speed appearance
        },
        protector: {
            color: new Color3(0.8, 0.2, 0.2), // Red
            accentColor: new Color3(0.5, 0.3, 0.3),
            radius: 0.4, // Slightly larger than worker
            segments: 10 // Slightly higher poly for imposing appearance
        }
    };

    // Accent materials for unit parts (engine, hands)
    private workerAccentMaterial: StandardMaterial | null = null;
    private scoutAccentMaterial: StandardMaterial | null = null;
    private protectorAccentMaterial: StandardMaterial | null = null;

    // Protector-specific materials
    private protectorGunMaterial: StandardMaterial | null = null;
    private protectorGunGlowMaterial: StandardMaterial | null = null;
    private protectorVisorMaterial: StandardMaterial | null = null;

    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;
        
        this.initializeMaterials();
    }

    /**
     * Initialize materials for unit rendering
     */
    private initializeMaterials(): void {
        // Worker material (Green, semi-transparent to show inner energy core)
        this.workerMaterial = new StandardMaterial('workerMaterial', this.scene);
        this.workerMaterial.diffuseColor = this.unitConfigs.worker.color;
        this.workerMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
        this.workerMaterial.emissiveColor = this.unitConfigs.worker.color.scale(0.05);
        this.workerMaterial.alpha = 0.35; // More transparent to better show energy core
        this.workerMaterial.needDepthPrePass = true; // Enable proper transparency sorting
        this.workerMaterial.separateCullingPass = true; // Better transparency rendering

        // Scout material (Blue)
        this.scoutMaterial = new StandardMaterial('scoutMaterial', this.scene);
        this.scoutMaterial.diffuseColor = this.unitConfigs.scout.color;
        this.scoutMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        this.scoutMaterial.emissiveColor = this.unitConfigs.scout.color.scale(0.1);

        // Protector material (Red, semi-transparent like worker)
        this.protectorMaterial = new StandardMaterial('protectorMaterial', this.scene);
        this.protectorMaterial.diffuseColor = this.unitConfigs.protector.color;
        this.protectorMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
        this.protectorMaterial.emissiveColor = this.unitConfigs.protector.color.scale(0.05);
        this.protectorMaterial.alpha = 0.35; // Semi-transparent to show energy core
        this.protectorMaterial.needDepthPrePass = true; // Enable proper transparency sorting
        this.protectorMaterial.separateCullingPass = true; // Better transparency rendering

        // Selection indicator material
        this.selectionMaterial = new StandardMaterial('selectionMaterial', this.scene);
        this.selectionMaterial.diffuseColor = new Color3(1, 1, 0); // Yellow
        this.selectionMaterial.emissiveColor = new Color3(0.3, 0.3, 0);
        this.selectionMaterial.wireframe = true;

        // Energy indicator material
        this.energyIndicatorMaterial = new StandardMaterial('energyIndicatorMaterial', this.scene);
        this.energyIndicatorMaterial.diffuseColor = new Color3(0, 1, 1); // Cyan
        this.energyIndicatorMaterial.emissiveColor = new Color3(0, 0.3, 0.3);

        // Accent materials for unit parts (engine, hands)
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

        // Protector gun body material (dark metallic)
        this.protectorGunMaterial = new StandardMaterial('protectorGunMaterial', this.scene);
        this.protectorGunMaterial.diffuseColor = new Color3(0.2, 0.2, 0.25); // Dark gunmetal
        this.protectorGunMaterial.specularColor = new Color3(0.4, 0.4, 0.5);
        this.protectorGunMaterial.emissiveColor = new Color3(0.05, 0.05, 0.08);

        // Protector gun glow material (energy barrel - cyan/blue)
        this.protectorGunGlowMaterial = new StandardMaterial('protectorGunGlowMaterial', this.scene);
        this.protectorGunGlowMaterial.diffuseColor = new Color3(0.2, 0.8, 1.0); // Cyan
        this.protectorGunGlowMaterial.emissiveColor = new Color3(0.3, 0.9, 1.2); // Strong cyan glow
        this.protectorGunGlowMaterial.specularColor = new Color3(0.5, 0.9, 1.0);
        this.protectorGunGlowMaterial.disableLighting = true;

        // Protector visor material (menacing red glow)
        this.protectorVisorMaterial = new StandardMaterial('protectorVisorMaterial', this.scene);
        this.protectorVisorMaterial.diffuseColor = new Color3(1.0, 0.2, 0.1); // Red
        this.protectorVisorMaterial.emissiveColor = new Color3(0.8, 0.1, 0.0); // Strong red glow
        this.protectorVisorMaterial.disableLighting = true;
    }

    /**
     * Create visual representation for a unit
     */
    public createUnitVisual(unit: Unit): UnitVisual | null {
        const unitId = unit.getId();
        
        if (this.unitVisuals.has(unitId)) {
            console.warn(`⚠️ Unit visual already exists for ${unitId}`);
            return this.unitVisuals.get(unitId) || null;
        }

        try {
            // Create root node for unit
            const rootNode = new TransformNode(`unit_root_${unitId}`, this.scene);
            rootNode.position = unit.getPosition();

            // Get unit type configuration
            const unitType = unit.getUnitType() as keyof typeof this.unitConfigs;
            const config = this.unitConfigs[unitType];
            
            if (!config) {
                console.error(`❌ Unknown unit type: ${unitType}`);
                return null;
            }

            // Create main unit mesh based on unit type
            let mesh: Mesh;
            const material = this.getUnitMaterial(unitType);

            if (unitType === 'worker') {
                // Create detailed worker robot
                mesh = this.createWorkerMesh(unitId, config, rootNode);
            } else if (unitType === 'protector') {
                // Create detailed protector warrior
                mesh = this.createProtectorMesh(unitId, config, rootNode);
            } else {
                // Create simple sphere for other unit types
                mesh = MeshBuilder.CreateSphere(`unit_${unitId}`, {
                    diameter: config.radius * 2,
                    segments: config.segments
                }, this.scene);
                mesh.parent = rootNode;
                mesh.position.y = config.radius;
                if (material) {
                    mesh.material = material;
                }
            }

            // Create energy indicator (small sphere above unit) - HIDDEN for cleaner visuals
            const energyIndicator = MeshBuilder.CreateSphere(`energy_${unitId}`, {
                diameter: 0.3,
                segments: 4
            }, this.scene);

            energyIndicator.parent = rootNode;
            energyIndicator.position.y = config.radius * 2 + 0.5;
            energyIndicator.material = this.energyIndicatorMaterial;
            energyIndicator.setEnabled(false); // Hide energy indicator for cleaner appearance

            // Create selection indicator (wireframe sphere)
            const selectionIndicator = MeshBuilder.CreateSphere(`selection_${unitId}`, {
                diameter: config.radius * 2.5,
                segments: 8
            }, this.scene);

            selectionIndicator.parent = rootNode;
            selectionIndicator.position.y = config.radius;
            selectionIndicator.material = this.selectionMaterial;
            selectionIndicator.setEnabled(false); // Hidden by default

            // Get energy core references for workers and protectors
            let energyCore: Mesh | null = null;
            let energyCoreMaterial: StandardMaterial | null = null;
            if (unitType === 'worker' || unitType === 'protector') {
                energyCore = (mesh as any).energyCore || null;
                energyCoreMaterial = (mesh as any).energyCoreMaterial || null;
            }

            // Create unit visual object
            const unitVisual: UnitVisual = {
                unit,
                mesh,
                material: material!,
                energyIndicator,
                selectionIndicator,
                miningConnectionLine: null, // Will be created when mining starts
                rootNode,
                lastPosition: unit.getPosition().clone(),
                energyCore,
                energyCoreMaterial
            };

            // Store unit visual
            this.unitVisuals.set(unitId, unitVisual);

            // Update initial visual state
            this.updateUnitVisual(unitVisual);

            return unitVisual;

        } catch (error) {
            console.error(`❌ Failed to create unit visual for ${unitId}:`, error);
            return null;
        }
    }

    /**
     * Get material for unit type
     */
    private getUnitMaterial(unitType: string): StandardMaterial | null {
        switch (unitType) {
            case 'worker': return this.workerMaterial;
            case 'scout': return this.scoutMaterial;
            case 'protector': return this.protectorMaterial;
            default: return null;
        }
    }

    /**
     * Create detailed worker robot mesh
     * Design: Spherical body + front camera + two side-mounted claw hands + inner energy core
     */
    private createWorkerMesh(unitId: string, config: any, rootNode: TransformNode): Mesh {
        const radius = config.radius;

        // Create body (main sphere - semi-transparent)
        const body = MeshBuilder.CreateSphere(`unit_${unitId}`, {
            diameter: radius * 2,
            segments: config.segments
        }, this.scene);
        body.parent = rootNode;
        body.position.y = radius + 0.1; // Slightly above ground
        body.material = this.workerMaterial;

        // Create inner energy core (glowing sphere inside the body)
        const energyCore = MeshBuilder.CreateSphere(`energyCore_${unitId}`, {
            diameter: radius * 1.4, // Larger to be more visible through outer shell
            segments: 8
        }, this.scene);
        energyCore.parent = body;
        energyCore.position.y = 0; // Centered in body
        energyCore.renderingGroupId = 1; // Render after outer shell for proper visibility

        // Energy core material - starts green (full energy), very bright like a light
        const coreMaterial = new StandardMaterial(`energyCoreMat_${unitId}`, this.scene);
        coreMaterial.diffuseColor = new Color3(0.5, 1.0, 0.5); // Bright green
        coreMaterial.emissiveColor = new Color3(0.8, 1.8, 0.8); // Very strong green glow (increased)
        coreMaterial.specularColor = new Color3(0.5, 0.5, 0.5); // Some specular for shine
        coreMaterial.disableLighting = true; // Make it self-illuminating
        energyCore.material = coreMaterial;

        // Store reference to energy core on the body mesh for later access
        (body as any).energyCore = energyCore;
        (body as any).energyCoreMaterial = coreMaterial;

        // Create camera (cylinder at the front)
        const camera = MeshBuilder.CreateCylinder(`camera_${unitId}`, {
            diameter: radius * 0.5,
            height: radius * 0.6,
            tessellation: 8 // Slightly smoother for camera look
        }, this.scene);
        camera.parent = body;
        camera.position.z = radius * 0.85; // In front of the body
        camera.position.y = radius * 0.1; // Slightly above center
        camera.rotation.x = Math.PI / 2; // Rotate to point forward
        camera.material = this.workerAccentMaterial;

        // Create camera lens (glowing eye)
        const cameraLens = MeshBuilder.CreateCylinder(`cameraLens_${unitId}`, {
            diameter: radius * 0.35,
            height: radius * 0.15,
            tessellation: 8
        }, this.scene);
        cameraLens.parent = camera;
        cameraLens.position.y = radius * 0.3; // At the front of camera
        const lensMaterial = new StandardMaterial(`lensMat_${unitId}`, this.scene);
        lensMaterial.diffuseColor = new Color3(0.2, 0.8, 1); // Cyan glow
        lensMaterial.emissiveColor = new Color3(0.15, 0.5, 0.6); // Brighter glow for visibility
        cameraLens.material = lensMaterial;

        // Create left hand/claw (longer)
        const leftHand = this.createClawHand(`leftHand_${unitId}`, radius);
        leftHand.parent = body;
        leftHand.position.x = radius * 0.9; // Left side
        leftHand.position.y = -radius * 0.1;
        leftHand.rotation.z = -Math.PI / 8; // Angle outward slightly

        // Create right hand/claw (longer)
        const rightHand = this.createClawHand(`rightHand_${unitId}`, radius);
        rightHand.parent = body;
        rightHand.position.x = -radius * 0.9; // Right side
        rightHand.position.y = -radius * 0.1;
        rightHand.rotation.z = Math.PI / 8; // Angle outward slightly
        rightHand.scaling.x = -1; // Mirror the claw

        return body;
    }

    /**
     * Create a claw hand for the worker robot (longer arms)
     */
    private createClawHand(name: string, bodyRadius: number): Mesh {
        // Create arm segment (longer)
        const arm = MeshBuilder.CreateCylinder(`${name}_arm`, {
            diameter: bodyRadius * 0.12,
            height: bodyRadius * 0.9, // Longer arm
            tessellation: 6
        }, this.scene);
        arm.rotation.z = Math.PI / 2; // Horizontal
        arm.position.x = bodyRadius * 0.5;
        arm.material = this.workerAccentMaterial;

        // Create claw base
        const clawBase = MeshBuilder.CreateBox(`${name}_clawBase`, {
            width: bodyRadius * 0.18,
            height: bodyRadius * 0.22,
            depth: bodyRadius * 0.18
        }, this.scene);
        clawBase.parent = arm;
        clawBase.position.x = bodyRadius * 0.5;
        clawBase.material = this.workerAccentMaterial;

        // Create upper claw finger (longer)
        const upperFinger = MeshBuilder.CreateBox(`${name}_upperFinger`, {
            width: bodyRadius * 0.35, // Longer finger
            height: bodyRadius * 0.06,
            depth: bodyRadius * 0.1
        }, this.scene);
        upperFinger.parent = clawBase;
        upperFinger.position.x = bodyRadius * 0.2;
        upperFinger.position.y = bodyRadius * 0.1;
        upperFinger.rotation.z = -Math.PI / 10; // Angle inward
        upperFinger.material = this.workerAccentMaterial;

        // Create lower claw finger (longer)
        const lowerFinger = MeshBuilder.CreateBox(`${name}_lowerFinger`, {
            width: bodyRadius * 0.35, // Longer finger
            height: bodyRadius * 0.06,
            depth: bodyRadius * 0.1
        }, this.scene);
        lowerFinger.parent = clawBase;
        lowerFinger.position.x = bodyRadius * 0.2;
        lowerFinger.position.y = -bodyRadius * 0.1;
        lowerFinger.rotation.z = Math.PI / 10; // Angle inward
        lowerFinger.material = this.workerAccentMaterial;

        return arm;
    }

    /**
     * Create detailed protector warrior mesh
     * Design: Spherical body + combat visor + energy blade arm + shield arm + inner energy core
     */
    private createProtectorMesh(unitId: string, config: any, rootNode: TransformNode): Mesh {
        const radius = config.radius;

        // Create body (main sphere - semi-transparent)
        const body = MeshBuilder.CreateSphere(`unit_${unitId}`, {
            diameter: radius * 2,
            segments: config.segments
        }, this.scene);
        body.parent = rootNode;
        body.position.y = radius + 0.1; // Slightly above ground
        body.material = this.protectorMaterial;

        // Create inner energy core (glowing sphere inside the body)
        const energyCore = MeshBuilder.CreateSphere(`energyCore_${unitId}`, {
            diameter: radius * 1.2, // Slightly smaller than body
            segments: 8
        }, this.scene);
        energyCore.parent = body;
        energyCore.position.y = 0; // Centered in body

        // Energy core material - purple for protector (combat energy)
        const coreMaterial = new StandardMaterial(`energyCoreMat_${unitId}`, this.scene);
        coreMaterial.diffuseColor = new Color3(0.8, 0.2, 1.0); // Bright purple
        coreMaterial.emissiveColor = new Color3(0.9, 0.3, 1.2); // Strong purple glow
        coreMaterial.specularColor = new Color3(0.5, 0.5, 0.5);
        coreMaterial.disableLighting = true;
        energyCore.material = coreMaterial;

        // Store reference to energy core on the body mesh for later access
        (body as any).energyCore = energyCore;
        (body as any).energyCoreMaterial = coreMaterial;

        // Create combat visor (angular, menacing - replaces worker's camera)
        const visor = this.createCombatVisor(`visor_${unitId}`, radius);
        visor.parent = body;
        visor.position.z = radius * 0.75; // In front of the body
        visor.position.y = radius * 0.15; // Slightly above center

        // Create left laser gun (pointing forward toward visor direction)
        const leftGun = this.createLaserGun(`leftGun_${unitId}`, radius);
        leftGun.parent = body;
        leftGun.position.x = radius * 0.7; // Left side
        leftGun.position.y = -radius * 0.1;
        leftGun.position.z = radius * 0.2; // Slightly forward
        leftGun.rotation.x = Math.PI / 2; // Tilt forward (barrel points toward visor)

        // Create right laser gun (pointing forward toward visor direction)
        const rightGun = this.createLaserGun(`rightGun_${unitId}`, radius);
        rightGun.parent = body;
        rightGun.position.x = -radius * 0.7; // Right side
        rightGun.position.y = -radius * 0.1;
        rightGun.position.z = radius * 0.2; // Slightly forward
        rightGun.rotation.x = Math.PI / 2; // Tilt forward (barrel points toward visor)

        return body;
    }

    /**
     * Create combat visor for the protector (angular, menacing design)
     */
    private createCombatVisor(name: string, bodyRadius: number): Mesh {
        // Create visor base (angular box shape)
        const visorBase = MeshBuilder.CreateBox(`${name}_base`, {
            width: bodyRadius * 0.8,
            height: bodyRadius * 0.25,
            depth: bodyRadius * 0.3
        }, this.scene);
        visorBase.material = this.protectorAccentMaterial;

        // Create visor slit (glowing red eye)
        const visorSlit = MeshBuilder.CreateBox(`${name}_slit`, {
            width: bodyRadius * 0.6,
            height: bodyRadius * 0.08,
            depth: bodyRadius * 0.15
        }, this.scene);
        visorSlit.parent = visorBase;
        visorSlit.position.z = bodyRadius * 0.1; // Front of visor
        visorSlit.material = this.protectorVisorMaterial;

        // Create side angular plates for menacing look
        const leftPlate = MeshBuilder.CreateBox(`${name}_leftPlate`, {
            width: bodyRadius * 0.15,
            height: bodyRadius * 0.35,
            depth: bodyRadius * 0.2
        }, this.scene);
        leftPlate.parent = visorBase;
        leftPlate.position.x = bodyRadius * 0.45;
        leftPlate.position.y = bodyRadius * 0.05;
        leftPlate.rotation.z = -Math.PI / 8; // Angle outward
        leftPlate.material = this.protectorAccentMaterial;

        const rightPlate = MeshBuilder.CreateBox(`${name}_rightPlate`, {
            width: bodyRadius * 0.15,
            height: bodyRadius * 0.35,
            depth: bodyRadius * 0.2
        }, this.scene);
        rightPlate.parent = visorBase;
        rightPlate.position.x = -bodyRadius * 0.45;
        rightPlate.position.y = bodyRadius * 0.05;
        rightPlate.rotation.z = Math.PI / 8; // Angle outward
        rightPlate.material = this.protectorAccentMaterial;

        return visorBase;
    }

    /**
     * Create laser gun for the protector
     */
    private createLaserGun(name: string, bodyRadius: number): Mesh {
        // Create arm/mount segment
        const arm = MeshBuilder.CreateCylinder(`${name}_arm`, {
            diameter: bodyRadius * 0.12,
            height: bodyRadius * 0.5,
            tessellation: 6
        }, this.scene);
        arm.rotation.z = Math.PI / 2; // Horizontal
        arm.position.x = bodyRadius * 0.3;
        arm.material = this.protectorAccentMaterial;

        // Create gun body (main housing)
        const gunBody = MeshBuilder.CreateBox(`${name}_body`, {
            width: bodyRadius * 0.6,
            height: bodyRadius * 0.2,
            depth: bodyRadius * 0.18
        }, this.scene);
        gunBody.parent = arm;
        gunBody.position.x = bodyRadius * 0.45;
        gunBody.material = this.protectorGunMaterial;

        // Create gun barrel (cylinder)
        const barrel = MeshBuilder.CreateCylinder(`${name}_barrel`, {
            diameter: bodyRadius * 0.1,
            height: bodyRadius * 0.5,
            tessellation: 8
        }, this.scene);
        barrel.parent = gunBody;
        barrel.position.x = bodyRadius * 0.4;
        barrel.position.z = 0;
        barrel.rotation.z = Math.PI / 2; // Point forward
        barrel.material = this.protectorGunMaterial;

        // Create barrel tip (glowing energy muzzle)
        const muzzle = MeshBuilder.CreateCylinder(`${name}_muzzle`, {
            diameter: bodyRadius * 0.14,
            height: bodyRadius * 0.08,
            tessellation: 8
        }, this.scene);
        muzzle.parent = barrel;
        muzzle.position.y = bodyRadius * 0.28;
        muzzle.material = this.protectorGunGlowMaterial;

        // Create inner barrel glow (energy core of the gun)
        const innerGlow = MeshBuilder.CreateCylinder(`${name}_innerGlow`, {
            diameter: bodyRadius * 0.06,
            height: bodyRadius * 0.52,
            tessellation: 8
        }, this.scene);
        innerGlow.parent = barrel;
        innerGlow.position.y = 0;
        innerGlow.material = this.protectorGunGlowMaterial;

        // Create gun top detail (sight/sensor)
        const sight = MeshBuilder.CreateBox(`${name}_sight`, {
            width: bodyRadius * 0.15,
            height: bodyRadius * 0.08,
            depth: bodyRadius * 0.06
        }, this.scene);
        sight.parent = gunBody;
        sight.position.y = bodyRadius * 0.12;
        sight.position.x = bodyRadius * 0.1;
        sight.material = this.protectorAccentMaterial;

        // Create small red indicator light on sight
        const indicator = MeshBuilder.CreateSphere(`${name}_indicator`, {
            diameter: bodyRadius * 0.04,
            segments: 4
        }, this.scene);
        indicator.parent = sight;
        indicator.position.y = bodyRadius * 0.04;
        indicator.position.x = bodyRadius * 0.05;
        indicator.material = this.protectorVisorMaterial; // Red glow

        // Create gun grip/handle detail
        const grip = MeshBuilder.CreateBox(`${name}_grip`, {
            width: bodyRadius * 0.08,
            height: bodyRadius * 0.15,
            depth: bodyRadius * 0.1
        }, this.scene);
        grip.parent = gunBody;
        grip.position.y = -bodyRadius * 0.15;
        grip.position.x = -bodyRadius * 0.1;
        grip.material = this.protectorAccentMaterial;

        return arm;
    }

    /**
     * Update unit visual based on unit state
     */
    public updateUnitVisual(unitVisual: UnitVisual): void {
        const unit = unitVisual.unit;
        const currentPosition = unit.getPosition();

        // Update position
        unitVisual.rootNode.position = currentPosition;

        // Update rotation to face movement direction
        this.updateFacingDirection(unitVisual, currentPosition);

        // Update energy level visualization
        this.updateEnergyVisualization(unitVisual);

        // Update selection state
        this.updateSelectionVisualization(unitVisual);

        // Update health visualization
        this.updateHealthVisualization(unitVisual);

        // Update action feedback
        this.updateActionVisualization(unitVisual);

        // Update mining connection visualization
        this.updateMiningConnectionVisualization(unitVisual);
    }

    /**
     * Update unit facing direction based on movement or combat target
     */
    private updateFacingDirection(unitVisual: UnitVisual, currentPosition: Vector3): void {
        const unit = unitVisual.unit;
        let targetRotationY: number | null = null;

        // Check if this is a Protector with a combat facing target
        if (unit.getUnitType() === 'protector') {
            const protector = unit as any; // Cast to access Protector-specific methods
            if (protector.getFacingTarget) {
                const facingTarget = protector.getFacingTarget();
                if (facingTarget) {
                    // Face the combat target
                    const deltaX = facingTarget.x - currentPosition.x;
                    const deltaZ = facingTarget.z - currentPosition.z;
                    targetRotationY = Math.atan2(deltaX, deltaZ);
                }
            }
        }

        // If no combat target, face movement direction
        if (targetRotationY === null) {
            const lastPosition = unitVisual.lastPosition;
            const deltaX = currentPosition.x - lastPosition.x;
            const deltaZ = currentPosition.z - lastPosition.z;
            const moveDistance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);

            // Only rotate if moved a meaningful distance (avoid jitter)
            if (moveDistance > 0.01) {
                targetRotationY = Math.atan2(deltaX, deltaZ);
            }
        }

        // Apply rotation if we have a target
        if (targetRotationY !== null) {
            // Smoothly interpolate rotation for natural turning
            const currentRotationY = unitVisual.mesh.rotation.y;
            const rotationDiff = targetRotationY - currentRotationY;

            // Normalize rotation difference to [-PI, PI]
            let normalizedDiff = rotationDiff;
            while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
            while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;

            // Smooth rotation (lerp factor controls turn speed) - faster for combat
            const turnSpeed = 0.2;
            unitVisual.mesh.rotation.y += normalizedDiff * turnSpeed;
        }

        // Update last position
        unitVisual.lastPosition = currentPosition.clone();
    }

    /**
     * Update energy level visualization
     */
    private updateEnergyVisualization(unitVisual: UnitVisual): void {
        const energyStats = unitVisual.unit.getEnergyStorage().getStats();
        const energyPercentage = energyStats.percentage;

        // Update inner energy core color - bright like a light
        if (unitVisual.energyCoreMaterial) {
            const unitType = unitVisual.unit.getUnitType();
            const coreColor = unitType === 'protector'
                ? this.getProtectorEnergyColor(energyPercentage)
                : this.getEnergyColor(energyPercentage);
            unitVisual.energyCoreMaterial.diffuseColor = coreColor;
            unitVisual.energyCoreMaterial.emissiveColor = coreColor.scale(1.5); // Extra bright glow
        }

        // Scale energy indicator based on energy level (hidden but kept for compatibility)
        const scale = 0.5 + (energyPercentage * 0.5);
        unitVisual.energyIndicator.scaling = new Vector3(scale, scale, scale);
    }

    /**
     * Get energy color based on percentage (bright green -> yellow -> red)
     */
    private getEnergyColor(percentage: number): Color3 {
        if (percentage > 0.5) {
            // Bright Green to Yellow (100% -> 50%)
            const t = (percentage - 0.5) * 2; // 0 to 1 as percentage goes from 50% to 100%
            return new Color3(
                1.0 - (t * 0.5),       // 1.0 -> 0.5 (less red = more green)
                1.0,                    // stays bright
                0.3 * t                 // 0 -> 0.3 (slight cyan tint at full)
            );
        } else {
            // Yellow to Bright Red (50% -> 0%)
            const t = percentage * 2; // 0 to 1 as percentage goes from 0% to 50%
            return new Color3(
                1.0,                    // stays at 1.0 (full red)
                t * 1.0,                // 0 -> 1.0 (green increases toward yellow)
                0.0                     // no blue
            );
        }
    }

    /**
     * Get protector energy color based on percentage (bright purple -> grey)
     */
    private getProtectorEnergyColor(percentage: number): Color3 {
        // Purple color scheme: bright purple at full, grey at empty
        // Full energy: bright vibrant purple (0.8, 0.2, 1.0)
        // Empty energy: grey (0.3, 0.3, 0.3) - powered down look

        return new Color3(
            0.3 + (percentage * 0.5),  // 0.3 -> 0.8 (red component)
            0.3 - (percentage * 0.1),  // 0.3 -> 0.2 (green: grey at 0, low at full)
            0.3 + (percentage * 0.7)   // 0.3 -> 1.0 (blue: grey at 0, purple at full)
        );
    }

    /**
     * Update selection visualization
     */
    private updateSelectionVisualization(unitVisual: UnitVisual): void {
        const isSelected = unitVisual.unit.isSelectedUnit();
        unitVisual.selectionIndicator.setEnabled(isSelected);
        
        if (isSelected) {
            // Animate selection indicator
            this.animateSelectionIndicator(unitVisual.selectionIndicator);
        }
    }

    /**
     * Update health visualization
     */
    private updateHealthVisualization(unitVisual: UnitVisual): void {
        const healthPercentage = unitVisual.unit.getHealth() / unitVisual.unit.getMaxHealth();
        
        // Scale unit slightly based on health
        const healthScale = 0.8 + (healthPercentage * 0.2); // 0.8 to 1.0 scale
        unitVisual.mesh.scaling = new Vector3(healthScale, healthScale, healthScale);
        
        // Adjust material emissive based on health
        const baseEmissive = this.getBaseEmissiveColor(unitVisual.unit.getUnitType());
        if (baseEmissive && unitVisual.material) {
            unitVisual.material.emissiveColor = baseEmissive.scale(healthPercentage);
        }
    }

    /**
     * Update action visualization
     */
    private updateActionVisualization(unitVisual: UnitVisual): void {
        const currentAction = unitVisual.unit.getCurrentAction();
        
        // Add subtle animation based on current action
        if (currentAction === 'mining') {
            this.animateMining(unitVisual);
        } else if (currentAction === 'movement') {
            this.animateMovement(unitVisual);
        } else if (currentAction === 'building') {
            this.animateBuilding(unitVisual);
        }
    }

    /**
     * Get base emissive color for unit type
     */
    private getBaseEmissiveColor(unitType: string): Color3 | null {
        const config = this.unitConfigs[unitType as keyof typeof this.unitConfigs];
        return config ? config.color.scale(0.1) : null;
    }

    /**
     * Animate selection indicator
     */
    private animateSelectionIndicator(mesh: Mesh): void {
        // Simple pulsing animation
        const animationKeys: IAnimationKey[] = [];
        animationKeys.push({ frame: 0, value: 1.0 });
        animationKeys.push({ frame: 30, value: 1.2 });
        animationKeys.push({ frame: 60, value: 1.0 });

        const scaleAnimation = Animation.CreateAndStartAnimation(
            'selectionPulse',
            mesh,
            'scaling',
            30, // 30 FPS
            60, // 60 frames (2 seconds)
            mesh.scaling,
            new Vector3(1.2, 1.2, 1.2),
            Animation.ANIMATIONLOOPMODE_CYCLE
        );
    }

    /**
     * Animate mining action with enhanced visual feedback
     */
    private animateMining(unitVisual: UnitVisual): void {
        // Mining animation disabled - unit should stay stable while mining
        // The mining connection line provides visual feedback instead
    }

    /**
     * Animate movement action
     */
    private animateMovement(unitVisual: UnitVisual): void {
        // Movement animation disabled - rotation is handled by updateFacingDirection
    }

    /**
     * Animate building action
     */
    private animateBuilding(unitVisual: UnitVisual): void {
        // Building animation disabled - unit should stay stable while building
    }

    /**
     * Update mining connection visualization
     */
    private updateMiningConnectionVisualization(unitVisual: UnitVisual): void {
        const currentAction = unitVisual.unit.getCurrentAction();
        
        if (currentAction === 'mining') {
            // Get the mining target from the unit
            const miningTarget = this.getMiningTarget(unitVisual.unit);
            
            if (miningTarget && !unitVisual.miningConnectionLine) {
                // Create mining connection line
                this.createMiningConnectionLine(unitVisual, miningTarget);
            } else if (miningTarget && unitVisual.miningConnectionLine) {
                // Update existing connection line
                this.updateMiningConnectionLine(unitVisual, miningTarget);
            }
        } else {
            // Remove mining connection line if not mining
            if (unitVisual.miningConnectionLine) {
                unitVisual.miningConnectionLine.dispose();
                unitVisual.miningConnectionLine = null;
            }
        }
    }

    /**
     * Get mining target from unit (helper method)
     */
    private getMiningTarget(unit: Unit): any {
        // Try to get the mining target from the unit's current mining action
        // This is a simplified approach - in a full implementation, 
        // the Unit class would expose the current mining target
        const stats = unit.getStats();
        if (stats.currentAction === 'mining') {
            // For now, we'll find the nearest mineral deposit as a proxy
            // In a full implementation, the unit would track its mining target
            const gameEngine = GameEngine.getInstance();
            const terrainGenerator = gameEngine?.getTerrainGenerator();
            
            if (terrainGenerator) {
                const nearbyDeposits = terrainGenerator.getMineralDepositsNear(unit.getPosition(), 5);
                return nearbyDeposits.length > 0 ? nearbyDeposits[0] : null;
            }
        }
        return null;
    }

    /**
     * Create mining connection line with energy generation feedback
     */
    private createMiningConnectionLine(unitVisual: UnitVisual, miningTarget: any): void {
        if (!miningTarget) return;

        const unitPos = unitVisual.unit.getPosition();
        const targetPos = miningTarget.getPosition();
        
        // Create a simple line mesh between unit and target
        const points = [
            unitPos.add(new Vector3(0, 0.5, 0)), // Start slightly above unit
            targetPos.add(new Vector3(0, 0.5, 0))  // End slightly above target
        ];

        const connectionLine = MeshBuilder.CreateLines(`mining_line_${unitVisual.unit.getId()}`, {
            points: points
        }, this.scene);

        // Style the connection line
        const lineMaterial = new StandardMaterial(`mining_line_mat_${unitVisual.unit.getId()}`, this.scene);
        lineMaterial.emissiveColor = new Color3(0, 1, 0.5); // Green-cyan mining beam
        lineMaterial.disableLighting = true;
        connectionLine.material = lineMaterial;
        connectionLine.alpha = 0.6;

        // Add pulsing animation to the line to show energy flow
        Animation.CreateAndStartAnimation(
            'miningLinePulse',
            lineMaterial,
            'emissiveColor',
            30,
            60,
            new Color3(0, 1, 0.5),
            new Color3(0, 1.5, 1),
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        // Add alpha pulsing for energy flow effect
        Animation.CreateAndStartAnimation(
            'miningLineFlow',
            connectionLine,
            'alpha',
            30,
            45,
            0.3,
            0.8,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        unitVisual.miningConnectionLine = connectionLine;
    }

    /**
     * Update mining connection line position
     */
    private updateMiningConnectionLine(unitVisual: UnitVisual, miningTarget: any): void {
        if (!unitVisual.miningConnectionLine || !miningTarget) return;

        const unitPos = unitVisual.unit.getPosition();
        const targetPos = miningTarget.getPosition();
        
        // Update line points
        const points = [
            unitPos.add(new Vector3(0, 0.5, 0)),
            targetPos.add(new Vector3(0, 0.5, 0))
        ];

        // Recreate the line with new points (Babylon.js lines need to be recreated to update)
        unitVisual.miningConnectionLine.dispose();
        this.createMiningConnectionLine(unitVisual, miningTarget);
    }

    /**
     * Update all unit visuals
     */
    public updateAllVisuals(): void {
        for (const unitVisual of this.unitVisuals.values()) {
            if (unitVisual.unit.isActiveUnit()) {
                this.updateUnitVisual(unitVisual);
            }
        }
    }

    /**
     * Remove unit visual
     */
    public removeUnitVisual(unitId: string): void {
        const unitVisual = this.unitVisuals.get(unitId);
        if (!unitVisual) {
            return;
        }

        // Dispose all meshes
        if (unitVisual.energyCore) {
            unitVisual.energyCore.dispose();
        }
        if (unitVisual.energyCoreMaterial) {
            unitVisual.energyCoreMaterial.dispose();
        }
        unitVisual.mesh.dispose();
        unitVisual.energyIndicator.dispose();
        unitVisual.selectionIndicator.dispose();
        if (unitVisual.miningConnectionLine) {
            unitVisual.miningConnectionLine.dispose();
        }
        unitVisual.rootNode.dispose();

        // Remove from map
        this.unitVisuals.delete(unitId);
    }

    /**
     * Get unit visual by ID
     */
    public getUnitVisual(unitId: string): UnitVisual | null {
        return this.unitVisuals.get(unitId) || null;
    }

    /**
     * Get all unit visuals
     */
    public getAllUnitVisuals(): UnitVisual[] {
        return Array.from(this.unitVisuals.values());
    }

    /**
     * Set unit selection
     */
    public setUnitSelection(unitId: string, selected: boolean): void {
        const unitVisual = this.unitVisuals.get(unitId);
        if (unitVisual) {
            unitVisual.unit.setSelected(selected);
            this.updateSelectionVisualization(unitVisual);
        }
    }

    /**
     * Get rendering statistics
     */
    public getRenderingStats(): {
        totalUnits: number;
        activeUnits: number;
        selectedUnits: number;
        unitsByType: { [key: string]: number };
    } {
        const stats = {
            totalUnits: this.unitVisuals.size,
            activeUnits: 0,
            selectedUnits: 0,
            unitsByType: {} as { [key: string]: number }
        };

        for (const unitVisual of this.unitVisuals.values()) {
            const unit = unitVisual.unit;
            const unitType = unit.getUnitType();

            if (unit.isActiveUnit()) {
                stats.activeUnits++;
            }

            if (unit.isSelectedUnit()) {
                stats.selectedUnits++;
            }

            stats.unitsByType[unitType] = (stats.unitsByType[unitType] || 0) + 1;
        }

        return stats;
    }

    /**
     * Dispose unit renderer
     */
    public dispose(): void {

        // Remove all unit visuals
        for (const unitId of this.unitVisuals.keys()) {
            this.removeUnitVisual(unitId);
        }

        // Dispose materials
        this.workerMaterial?.dispose();
        this.scoutMaterial?.dispose();
        this.protectorMaterial?.dispose();
        this.selectionMaterial?.dispose();
        this.energyIndicatorMaterial?.dispose();
        this.workerAccentMaterial?.dispose();
        this.scoutAccentMaterial?.dispose();
        this.protectorAccentMaterial?.dispose();

        // Dispose protector-specific materials
        this.protectorGunMaterial?.dispose();
        this.protectorGunGlowMaterial?.dispose();
        this.protectorVisorMaterial?.dispose();
    }
}