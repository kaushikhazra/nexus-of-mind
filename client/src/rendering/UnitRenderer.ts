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

        // Scout material (Blue)
        this.scoutMaterial = new StandardMaterial('scoutMaterial', this.scene);
        this.scoutMaterial.diffuseColor = this.unitConfigs.scout.color;
        this.scoutMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        this.scoutMaterial.emissiveColor = this.unitConfigs.scout.color.scale(0.1);

        // Protector material (Red)
        this.protectorMaterial = new StandardMaterial('protectorMaterial', this.scene);
        this.protectorMaterial.diffuseColor = this.unitConfigs.protector.color;
        this.protectorMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        this.protectorMaterial.emissiveColor = this.unitConfigs.protector.color.scale(0.1);

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

            // Get energy core references for workers
            let energyCore: Mesh | null = null;
            let energyCoreMaterial: StandardMaterial | null = null;
            if (unitType === 'worker') {
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
            diameter: radius * 1.2, // Slightly smaller than body
            segments: 8
        }, this.scene);
        energyCore.parent = body;
        energyCore.position.y = 0; // Centered in body

        // Energy core material - starts green (full energy), very bright like a light
        const coreMaterial = new StandardMaterial(`energyCoreMat_${unitId}`, this.scene);
        coreMaterial.diffuseColor = new Color3(0.5, 1.0, 0.5); // Bright green
        coreMaterial.emissiveColor = new Color3(0.6, 1.5, 0.6); // Very strong green glow (>1 for bloom effect)
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
     * Update unit facing direction based on movement
     */
    private updateFacingDirection(unitVisual: UnitVisual, currentPosition: Vector3): void {
        const lastPosition = unitVisual.lastPosition;

        // Calculate movement direction (ignoring Y axis for ground movement)
        const deltaX = currentPosition.x - lastPosition.x;
        const deltaZ = currentPosition.z - lastPosition.z;
        const moveDistance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);

        // Only rotate if moved a meaningful distance (avoid jitter)
        if (moveDistance > 0.01) {
            // Calculate target rotation angle (facing movement direction)
            const targetRotationY = Math.atan2(deltaX, deltaZ);

            // Smoothly interpolate rotation for natural turning
            const currentRotationY = unitVisual.mesh.rotation.y;
            const rotationDiff = targetRotationY - currentRotationY;

            // Normalize rotation difference to [-PI, PI]
            let normalizedDiff = rotationDiff;
            while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
            while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;

            // Smooth rotation (lerp factor controls turn speed)
            const turnSpeed = 0.15;
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

        // Update inner energy core color (for workers) - bright like a light
        if (unitVisual.energyCoreMaterial) {
            const coreColor = this.getEnergyColor(energyPercentage);
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
    }
}