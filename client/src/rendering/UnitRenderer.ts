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
            color: new Color3(0.2, 0.8, 0.2), // Green
            radius: 0.3, // Much smaller - more realistic scale
            segments: 8 // Low poly
        },
        scout: {
            color: new Color3(0.2, 0.2, 0.8), // Blue
            radius: 0.25, // Smaller and faster
            segments: 6 // Lower poly for speed appearance
        },
        protector: {
            color: new Color3(0.8, 0.2, 0.2), // Red
            radius: 0.4, // Slightly larger than worker
            segments: 10 // Slightly higher poly for imposing appearance
        }
    };

    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;
        
        this.initializeMaterials();
        console.log('🎨 UnitRenderer initialized');
    }

    /**
     * Initialize materials for unit rendering
     */
    private initializeMaterials(): void {
        // Worker material (Green)
        this.workerMaterial = new StandardMaterial('workerMaterial', this.scene);
        this.workerMaterial.diffuseColor = this.unitConfigs.worker.color;
        this.workerMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        this.workerMaterial.emissiveColor = this.unitConfigs.worker.color.scale(0.1);

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

        console.log('🎨 Unit materials initialized');
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

            // Create main unit mesh (sphere)
            const mesh = MeshBuilder.CreateSphere(`unit_${unitId}`, {
                diameter: config.radius * 2,
                segments: config.segments
            }, this.scene);

            mesh.parent = rootNode;
            mesh.position.y = config.radius; // Raise above ground

            // Apply material based on unit type
            const material = this.getUnitMaterial(unitType);
            if (material) {
                mesh.material = material;
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

            // Create unit visual object
            const unitVisual: UnitVisual = {
                unit,
                mesh,
                material: material!,
                energyIndicator,
                selectionIndicator,
                miningConnectionLine: null, // Will be created when mining starts
                rootNode
            };

            // Store unit visual
            this.unitVisuals.set(unitId, unitVisual);

            // Update initial visual state
            this.updateUnitVisual(unitVisual);

            console.log(`🎨 Created visual for ${unitType} unit ${unitId}`);
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
     * Update unit visual based on unit state
     */
    public updateUnitVisual(unitVisual: UnitVisual): void {
        const unit = unitVisual.unit;
        
        // Update position
        unitVisual.rootNode.position = unit.getPosition();
        
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
     * Update energy level visualization
     */
    private updateEnergyVisualization(unitVisual: UnitVisual): void {
        const energyStats = unitVisual.unit.getEnergyStorage().getStats();
        const energyPercentage = energyStats.percentage;
        
        // Scale energy indicator based on energy level
        const scale = 0.5 + (energyPercentage * 0.5); // 0.5 to 1.0 scale
        unitVisual.energyIndicator.scaling = new Vector3(scale, scale, scale);
        
        // Change color based on energy level
        if (this.energyIndicatorMaterial) {
            if (energyPercentage < 0.2) {
                // Low energy - red
                this.energyIndicatorMaterial.diffuseColor = new Color3(1, 0, 0);
                this.energyIndicatorMaterial.emissiveColor = new Color3(0.3, 0, 0);
            } else if (energyPercentage < 0.5) {
                // Medium energy - yellow
                this.energyIndicatorMaterial.diffuseColor = new Color3(1, 1, 0);
                this.energyIndicatorMaterial.emissiveColor = new Color3(0.3, 0.3, 0);
            } else {
                // High energy - cyan
                this.energyIndicatorMaterial.diffuseColor = new Color3(0, 1, 1);
                this.energyIndicatorMaterial.emissiveColor = new Color3(0, 0.3, 0.3);
            }
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
        // Subtle bobbing animation for mining
        const mesh = unitVisual.mesh;
        const originalY = mesh.position.y;
        
        // Create mining bobbing animation
        Animation.CreateAndStartAnimation(
            'miningBob',
            mesh,
            'position.y',
            30,
            30,
            originalY,
            originalY + 0.1,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        // Add mining glow effect to material
        if (unitVisual.material) {
            const originalEmissive = unitVisual.material.emissiveColor.clone();
            const miningGlow = originalEmissive.scale(2.0); // Brighter glow while mining
            
            Animation.CreateAndStartAnimation(
                'miningGlow',
                unitVisual.material,
                'emissiveColor',
                30,
                60,
                originalEmissive,
                miningGlow,
                Animation.ANIMATIONLOOPMODE_CYCLE
            );
        }

        // Add subtle rotation to indicate activity
        Animation.CreateAndStartAnimation(
            'miningRotate',
            mesh,
            'rotation.y',
            30,
            120, // Slower rotation than building
            mesh.rotation.y,
            mesh.rotation.y + Math.PI * 2,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );
    }

    /**
     * Animate movement action
     */
    private animateMovement(unitVisual: UnitVisual): void {
        // Slight forward lean during movement
        const mesh = unitVisual.mesh;
        
        Animation.CreateAndStartAnimation(
            'movementLean',
            mesh,
            'rotation.x',
            30,
            15,
            0,
            0.1,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );
    }

    /**
     * Animate building action
     */
    private animateBuilding(unitVisual: UnitVisual): void {
        // Slight rotation during building
        const mesh = unitVisual.mesh;
        
        Animation.CreateAndStartAnimation(
            'buildingRotate',
            mesh,
            'rotation.y',
            30,
            60,
            0,
            Math.PI * 2,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );
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
        
        console.log(`⚡ Created mining connection line for worker ${unitVisual.unit.getId()}`);
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
        unitVisual.mesh.dispose();
        unitVisual.energyIndicator.dispose();
        unitVisual.selectionIndicator.dispose();
        if (unitVisual.miningConnectionLine) {
            unitVisual.miningConnectionLine.dispose();
        }
        unitVisual.rootNode.dispose();

        // Remove from map
        this.unitVisuals.delete(unitId);

        console.log(`🗑️ Removed visual for unit ${unitId}`);
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
        console.log('🗑️ Disposing UnitRenderer...');

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

        console.log('✅ UnitRenderer disposed');
    }
}