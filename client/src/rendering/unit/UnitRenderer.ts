/**
 * UnitRenderer - 3D unit visualization coordinator
 *
 * Manages the 3D representation of all units with color coding, energy level indicators,
 * and efficient rendering for multiple units while maintaining 60fps performance.
 * Refactored to delegate to extracted modules for SOLID compliance.
 */

import {
    Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3,
    TransformNode, Animation, IAnimationKey, LinesMesh
} from '@babylonjs/core';
import { MaterialManager } from '../MaterialManager';
import { Unit } from '../../game/entities/Unit';
import { GameEngine } from '../../game/GameEngine';
import { UnitMaterialManager } from './UnitMaterials';
import { WorkerMeshFactory, ProtectorMeshFactory } from './UnitMeshFactories';

export interface UnitVisual {
    unit: Unit;
    mesh: Mesh;
    material: StandardMaterial;
    energyIndicator: Mesh;
    selectionIndicator: Mesh;
    miningConnectionLine: Mesh | null;
    rootNode: TransformNode;
    lastPosition: Vector3;
    energyCore: Mesh | null;
    energyCoreMaterial: StandardMaterial | null;
    miningLinePoints?: Vector3[];
    miningLineMaterial?: StandardMaterial | null;
}

export class UnitRenderer {
    private scene: Scene;
    private materialManager: MaterialManager;
    private unitMaterials: UnitMaterialManager;
    private workerFactory: WorkerMeshFactory;
    private protectorFactory: ProtectorMeshFactory;
    private unitVisuals: Map<string, UnitVisual> = new Map();

    // Cached Color3 objects for zero-allocation updates
    private cachedEnergyColor: Color3 = new Color3();

    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;
        this.unitMaterials = new UnitMaterialManager(scene);
        this.workerFactory = new WorkerMeshFactory(scene, this.unitMaterials);
        this.protectorFactory = new ProtectorMeshFactory(scene, this.unitMaterials);
    }

    public createUnitVisual(unit: Unit): UnitVisual | null {
        const unitId = unit.getId();
        if (this.unitVisuals.has(unitId)) {
            return this.unitVisuals.get(unitId) || null;
        }

        try {
            const rootNode = new TransformNode(`unit_root_${unitId}`, this.scene);
            rootNode.position = unit.getPosition();

            const unitType = unit.getUnitType() as 'worker' | 'scout' | 'protector';
            const config = this.unitMaterials.unitConfigs[unitType];
            if (!config) return null;

            let mesh: Mesh;
            const material = this.unitMaterials.getUnitMaterial(unitType);

            if (unitType === 'worker') {
                mesh = this.workerFactory.createWorkerMesh(unitId, config, rootNode);
            } else if (unitType === 'protector') {
                mesh = this.protectorFactory.createProtectorMesh(unitId, config, rootNode);
            } else {
                mesh = MeshBuilder.CreateSphere(`unit_${unitId}`, {
                    diameter: config.radius * 2, segments: config.segments
                }, this.scene);
                mesh.parent = rootNode;
                mesh.position.y = config.radius;
                if (material) mesh.material = material;
            }

            const energyIndicator = MeshBuilder.CreateSphere(`energy_${unitId}`, {
                diameter: 0.3, segments: 4
            }, this.scene);
            energyIndicator.parent = rootNode;
            energyIndicator.position.y = config.radius * 2 + 0.5;
            energyIndicator.material = this.unitMaterials.energyIndicatorMaterial;
            energyIndicator.setEnabled(false);

            const selectionIndicator = MeshBuilder.CreateSphere(`selection_${unitId}`, {
                diameter: config.radius * 2.5, segments: 8
            }, this.scene);
            selectionIndicator.parent = rootNode;
            selectionIndicator.position.y = config.radius;
            selectionIndicator.material = this.unitMaterials.selectionMaterial;
            selectionIndicator.setEnabled(false);

            let energyCore: Mesh | null = null;
            let energyCoreMaterial: StandardMaterial | null = null;
            if (unitType === 'worker' || unitType === 'protector') {
                energyCore = (mesh as any).energyCore || null;
                energyCoreMaterial = (mesh as any).energyCoreMaterial || null;
            }

            const unitVisual: UnitVisual = {
                unit, mesh, material: material!, energyIndicator, selectionIndicator,
                miningConnectionLine: null, rootNode, lastPosition: unit.getPosition().clone(),
                energyCore, energyCoreMaterial
            };

            this.unitVisuals.set(unitId, unitVisual);
            this.updateUnitVisual(unitVisual);
            return unitVisual;
        } catch (error) {
            console.error(`Failed to create unit visual for ${unitId}:`, error);
            return null;
        }
    }

    public updateUnitVisual(unitVisual: UnitVisual): void {
        const unit = unitVisual.unit;
        const currentPosition = unit.getPosition();
        unitVisual.rootNode.position = currentPosition;

        this.updateFacingDirection(unitVisual, currentPosition);
        this.updateEnergyVisualization(unitVisual);
        this.updateSelectionVisualization(unitVisual);
        this.updateHealthVisualization(unitVisual);
        this.updateMiningConnectionVisualization(unitVisual);
    }

    private updateFacingDirection(unitVisual: UnitVisual, currentPosition: Vector3): void {
        const unit = unitVisual.unit;
        let targetRotationY: number | null = null;

        if (unit.getUnitType() === 'protector') {
            const protector = unit as any;
            if (protector.getFacingTarget) {
                const facingTarget = protector.getFacingTarget();
                if (facingTarget) {
                    const deltaX = facingTarget.x - currentPosition.x;
                    const deltaZ = facingTarget.z - currentPosition.z;
                    targetRotationY = Math.atan2(deltaX, deltaZ);
                }
            }
        }

        if (targetRotationY === null) {
            const lastPosition = unitVisual.lastPosition;
            const deltaX = currentPosition.x - lastPosition.x;
            const deltaZ = currentPosition.z - lastPosition.z;
            const moveDistance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
            if (moveDistance > 0.01) {
                targetRotationY = Math.atan2(deltaX, deltaZ);
            }
        }

        if (targetRotationY !== null) {
            const currentRotationY = unitVisual.mesh.rotation.y;
            let normalizedDiff = targetRotationY - currentRotationY;
            while (normalizedDiff > Math.PI) normalizedDiff -= 2 * Math.PI;
            while (normalizedDiff < -Math.PI) normalizedDiff += 2 * Math.PI;
            if (Math.abs(normalizedDiff) > 0.05) {
                unitVisual.mesh.rotation.y += normalizedDiff * 0.1;
            }
        }

        unitVisual.lastPosition.copyFrom(currentPosition);
    }

    private updateEnergyVisualization(unitVisual: UnitVisual): void {
        const energyStats = unitVisual.unit.getEnergyStorage().getStats();
        const energyPercentage = energyStats.percentage;

        if (unitVisual.energyCoreMaterial) {
            const unitType = unitVisual.unit.getUnitType();
            if (unitType === 'protector') {
                this.getProtectorEnergyColorInto(energyPercentage, this.cachedEnergyColor);
            } else {
                this.getEnergyColorInto(energyPercentage, this.cachedEnergyColor);
            }
            unitVisual.energyCoreMaterial.diffuseColor.copyFrom(this.cachedEnergyColor);
            unitVisual.energyCoreMaterial.emissiveColor.r = this.cachedEnergyColor.r * 1.5;
            unitVisual.energyCoreMaterial.emissiveColor.g = this.cachedEnergyColor.g * 1.5;
            unitVisual.energyCoreMaterial.emissiveColor.b = this.cachedEnergyColor.b * 1.5;
        }

        const scale = 0.5 + (energyPercentage * 0.5);
        unitVisual.energyIndicator.scaling.set(scale, scale, scale);
    }

    private getEnergyColorInto(percentage: number, target: Color3): void {
        if (percentage > 0.5) {
            const t = (percentage - 0.5) * 2;
            target.r = 1.0 - (t * 0.5);
            target.g = 1.0;
            target.b = 0.3 * t;
        } else {
            const t = percentage * 2;
            target.r = 1.0;
            target.g = t * 1.0;
            target.b = 0.0;
        }
    }

    private getProtectorEnergyColorInto(percentage: number, target: Color3): void {
        target.r = 0.3 + (percentage * 0.5);
        target.g = 0.3 - (percentage * 0.1);
        target.b = 0.3 + (percentage * 0.7);
    }

    private updateSelectionVisualization(unitVisual: UnitVisual): void {
        const isSelected = unitVisual.unit.isSelectedUnit();
        unitVisual.selectionIndicator.setEnabled(isSelected);
        if (isSelected) {
            this.animateSelectionIndicator(unitVisual.selectionIndicator);
        }
    }

    private updateHealthVisualization(unitVisual: UnitVisual): void {
        const healthPercentage = unitVisual.unit.getHealth() / unitVisual.unit.getMaxHealth();
        const healthScale = 0.8 + (healthPercentage * 0.2);
        unitVisual.mesh.scaling.set(healthScale, healthScale, healthScale);

        const baseEmissive = this.unitMaterials.getBaseEmissiveColor(unitVisual.unit.getUnitType());
        if (baseEmissive && unitVisual.material) {
            unitVisual.material.emissiveColor.r = baseEmissive.r * healthPercentage;
            unitVisual.material.emissiveColor.g = baseEmissive.g * healthPercentage;
            unitVisual.material.emissiveColor.b = baseEmissive.b * healthPercentage;
        }
    }

    private animateSelectionIndicator(mesh: Mesh): void {
        Animation.CreateAndStartAnimation(
            'selectionPulse', mesh, 'scaling', 30, 60,
            mesh.scaling, new Vector3(1.2, 1.2, 1.2), Animation.ANIMATIONLOOPMODE_CYCLE
        );
    }

    private updateMiningConnectionVisualization(unitVisual: UnitVisual): void {
        const currentAction = unitVisual.unit.getCurrentAction();
        if (currentAction === 'mining') {
            const miningTarget = this.getMiningTarget(unitVisual.unit);
            if (miningTarget && !unitVisual.miningConnectionLine) {
                this.createMiningConnectionLine(unitVisual, miningTarget);
            } else if (miningTarget && unitVisual.miningConnectionLine) {
                this.updateMiningConnectionLine(unitVisual, miningTarget);
            }
        } else if (unitVisual.miningConnectionLine) {
            unitVisual.miningConnectionLine.dispose();
            unitVisual.miningConnectionLine = null;
        }
    }

    private getMiningTarget(unit: Unit): any {
        const stats = unit.getStats();
        if (stats.currentAction === 'mining') {
            const gameEngine = GameEngine.getInstance();
            const terrainGenerator = gameEngine?.getTerrainGenerator();
            if (terrainGenerator) {
                const nearbyDeposits = terrainGenerator.getMineralDepositsNear(unit.getPosition(), 5);
                return nearbyDeposits.length > 0 ? nearbyDeposits[0] : null;
            }
        }
        return null;
    }

    private createMiningConnectionLine(unitVisual: UnitVisual, miningTarget: any): void {
        if (!miningTarget) return;
        if (!unitVisual.miningLinePoints) {
            unitVisual.miningLinePoints = [new Vector3(), new Vector3()];
        }

        const unitPos = unitVisual.unit.getPositionRef ? unitVisual.unit.getPositionRef() : unitVisual.unit.getPosition();
        const targetPos = miningTarget.getPositionRef ? miningTarget.getPositionRef() : miningTarget.getPosition();

        unitVisual.miningLinePoints[0].set(unitPos.x, unitPos.y + 0.5, unitPos.z);
        unitVisual.miningLinePoints[1].set(targetPos.x, targetPos.y + 0.5, targetPos.z);

        const connectionLine = MeshBuilder.CreateLines(`mining_line_${unitVisual.unit.getId()}`, {
            points: unitVisual.miningLinePoints, updatable: true
        }, this.scene);

        if (!unitVisual.miningLineMaterial) {
            unitVisual.miningLineMaterial = new StandardMaterial(`mining_line_mat_${unitVisual.unit.getId()}`, this.scene);
            unitVisual.miningLineMaterial.emissiveColor = new Color3(0, 1, 0.5);
            unitVisual.miningLineMaterial.disableLighting = true;
            Animation.CreateAndStartAnimation('miningLinePulse', unitVisual.miningLineMaterial, 'emissiveColor', 30, 60,
                new Color3(0, 1, 0.5), new Color3(0, 1.5, 1), Animation.ANIMATIONLOOPMODE_CYCLE);
        }

        connectionLine.material = unitVisual.miningLineMaterial;
        connectionLine.alpha = 0.6;
        Animation.CreateAndStartAnimation('miningLineFlow', connectionLine, 'alpha', 30, 45, 0.3, 0.8, Animation.ANIMATIONLOOPMODE_CYCLE);
        unitVisual.miningConnectionLine = connectionLine;
    }

    private updateMiningConnectionLine(unitVisual: UnitVisual, miningTarget: any): void {
        if (!unitVisual.miningConnectionLine || !miningTarget) return;
        if (!unitVisual.miningLinePoints) {
            unitVisual.miningLinePoints = [new Vector3(), new Vector3()];
        }

        const unitPos = unitVisual.unit.getPositionRef ? unitVisual.unit.getPositionRef() : unitVisual.unit.getPosition();
        const targetPos = miningTarget.getPositionRef ? miningTarget.getPositionRef() : miningTarget.getPosition();

        unitVisual.miningLinePoints[0].set(unitPos.x, unitPos.y + 0.5, unitPos.z);
        unitVisual.miningLinePoints[1].set(targetPos.x, targetPos.y + 0.5, targetPos.z);

        MeshBuilder.CreateLines(`mining_line_${unitVisual.unit.getId()}`, {
            points: unitVisual.miningLinePoints, instance: unitVisual.miningConnectionLine as LinesMesh
        }, this.scene);
    }

    public updateAllVisuals(): void {
        for (const unitVisual of this.unitVisuals.values()) {
            if (unitVisual.unit.isActiveUnit()) {
                this.updateUnitVisual(unitVisual);
            }
        }
    }

    public removeUnitVisual(unitId: string): void {
        const unitVisual = this.unitVisuals.get(unitId);
        if (!unitVisual) return;

        unitVisual.energyCore?.dispose();
        unitVisual.energyCoreMaterial?.dispose();
        unitVisual.mesh.dispose();
        unitVisual.energyIndicator.dispose();
        unitVisual.selectionIndicator.dispose();
        unitVisual.miningConnectionLine?.dispose();
        unitVisual.miningLineMaterial?.dispose();
        unitVisual.rootNode.dispose();

        this.unitVisuals.delete(unitId);
    }

    public getUnitVisual(unitId: string): UnitVisual | null {
        return this.unitVisuals.get(unitId) || null;
    }

    public getAllUnitVisuals(): UnitVisual[] {
        return Array.from(this.unitVisuals.values());
    }

    public setUnitSelection(unitId: string, selected: boolean): void {
        const unitVisual = this.unitVisuals.get(unitId);
        if (unitVisual) {
            unitVisual.unit.setSelected(selected);
            this.updateSelectionVisualization(unitVisual);
        }
    }

    public getRenderingStats(): { totalUnits: number; activeUnits: number; selectedUnits: number; unitsByType: { [key: string]: number } } {
        const stats = { totalUnits: this.unitVisuals.size, activeUnits: 0, selectedUnits: 0, unitsByType: {} as { [key: string]: number } };
        for (const unitVisual of this.unitVisuals.values()) {
            const unit = unitVisual.unit;
            const unitType = unit.getUnitType();
            if (unit.isActiveUnit()) stats.activeUnits++;
            if (unit.isSelectedUnit()) stats.selectedUnits++;
            stats.unitsByType[unitType] = (stats.unitsByType[unitType] || 0) + 1;
        }
        return stats;
    }

    public dispose(): void {
        for (const unitId of this.unitVisuals.keys()) {
            this.removeUnitVisual(unitId);
        }
        this.unitMaterials.dispose();
    }
}
