/**
 * CombatRangeIndicators - Range indicator management for combat UI
 *
 * Handles creation and management of combat and detection range indicators.
 */

import { Scene, Mesh, MeshBuilder, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { Protector } from '../../game/entities/Protector';
import type { CombatUIMaterials } from './CombatUIMaterials';

export class CombatRangeIndicators {
    private scene: Scene;
    private materials: CombatUIMaterials;

    private rangeIndicators: Map<string, Mesh[]> = new Map();
    private detectionRangeIndicators: Map<string, Mesh[]> = new Map();
    private destinationIndicators: Map<string, Mesh> = new Map();

    constructor(scene: Scene, materials: CombatUIMaterials) {
        this.scene = scene;
        this.materials = materials;
    }

    public showRangeIndicators(protectorIds: string[], getProtectorById: (id: string) => Protector | null): Set<string> {
        this.clearAllIndicators();

        for (const protectorId of protectorIds) {
            const protector = getProtectorById(protectorId);
            if (protector) {
                const combatIndicators = this.createRangeIndicator(protector, protector.getCombatRange(), this.materials.combatRangeMaterial);
                const detectionIndicators = this.createRangeIndicator(protector, protector.getDetectionRange(), this.materials.detectionRangeMaterial);

                this.rangeIndicators.set(protectorId, combatIndicators);
                this.detectionRangeIndicators.set(protectorId, detectionIndicators);
            }
        }

        return new Set(protectorIds);
    }

    private createRangeIndicator(protector: Protector, range: number, material: StandardMaterial | null): Mesh[] {
        if (!material) return [];

        const indicators: Mesh[] = [];
        const position = protector.getPosition();

        const rangeCircle = this.createRangeCircle(position, range);
        if (rangeCircle) {
            rangeCircle.material = material;
            rangeCircle.renderingGroupId = 1;
            indicators.push(rangeCircle);
        }

        return indicators;
    }

    private createRangeCircle(center: Vector3, radius: number): Mesh | null {
        const points: Vector3[] = [];
        const segments = 32;

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = center.x + Math.cos(angle) * radius;
            const z = center.z + Math.sin(angle) * radius;
            points.push(new Vector3(x, center.y + 0.1, z));
        }

        return MeshBuilder.CreateLines('combat_range_circle', { points }, this.scene);
    }

    public showDestinationIndicator(protectorId: string, destination: Vector3): void {
        this.clearDestinationIndicator(protectorId);

        if (!this.materials.destinationMaterial) return;

        const marker = MeshBuilder.CreateSphere(`destination_${protectorId}`, { diameter: 1 }, this.scene);
        marker.position = destination.clone();
        marker.position.y += 0.5;
        marker.material = this.materials.destinationMaterial;
        marker.renderingGroupId = 1;

        this.destinationIndicators.set(protectorId, marker);

        setTimeout(() => {
            this.clearDestinationIndicator(protectorId);
        }, 5000);
    }

    public clearDestinationIndicator(protectorId: string): void {
        const indicator = this.destinationIndicators.get(protectorId);
        if (indicator) {
            indicator.dispose();
            this.destinationIndicators.delete(protectorId);
        }
    }

    public clearAllIndicators(): void {
        for (const indicators of this.rangeIndicators.values()) {
            for (const indicator of indicators) {
                indicator.dispose();
            }
        }
        this.rangeIndicators.clear();

        for (const indicators of this.detectionRangeIndicators.values()) {
            for (const indicator of indicators) {
                indicator.dispose();
            }
        }
        this.detectionRangeIndicators.clear();

        for (const indicator of this.destinationIndicators.values()) {
            indicator.dispose();
        }
        this.destinationIndicators.clear();
    }

    public dispose(): void {
        this.clearAllIndicators();
    }
}
