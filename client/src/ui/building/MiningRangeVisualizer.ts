/**
 * MiningRangeVisualizer - Mining range indicator visualization
 *
 * Shows dotted circles and connection lines for mining range preview.
 */

import {
    Scene, Vector3, Mesh, MeshBuilder, StandardMaterial, Color3, LinesMesh
} from '@babylonjs/core';
import type { MiningAnalysis } from './BuildingPlacementInterfaces';
import { PLACEMENT_CONSTANTS } from './BuildingPlacementInterfaces';

export class MiningRangeVisualizer {
    private scene: Scene;
    private miningRangeIndicators: Mesh[] = [];
    private miningRangeMaterial: StandardMaterial | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
        this.createMaterial();
    }

    private createMaterial(): void {
        this.miningRangeMaterial = new StandardMaterial('mining_range_material', this.scene);
        this.miningRangeMaterial.diffuseColor = new Color3(0, 1, 0);
        this.miningRangeMaterial.alpha = 0.3;
        this.miningRangeMaterial.wireframe = true;
        this.miningRangeMaterial.emissiveColor = new Color3(0, 0.3, 0);
        this.miningRangeMaterial.disableLighting = true;
    }

    public showIndicators(analysis: MiningAnalysis, basePosition: Vector3): void {
        this.clearIndicators();

        if (!this.miningRangeMaterial) return;

        for (const deposit of analysis.reachableNodes) {
            const depositPosition = deposit.getPosition();

            const circle = this.createDottedCircle(depositPosition, PLACEMENT_CONSTANTS.WORKER_MINING_RANGE);
            if (circle) {
                circle.material = this.miningRangeMaterial;
                circle.renderingGroupId = 1;
                this.miningRangeIndicators.push(circle);
            }

            const line = this.createConnectionLine(basePosition, depositPosition);
            if (line) {
                line.color = new Color3(0, 1, 0);
                line.renderingGroupId = 1;
                this.miningRangeIndicators.push(line);
            }
        }
    }

    private createDottedCircle(center: Vector3, radius: number): Mesh | null {
        const points: Vector3[] = [];
        const dotCount = 16;

        for (let i = 0; i < dotCount; i++) {
            const startAngle = (i / dotCount) * Math.PI * 2;
            const endAngle = startAngle + (Math.PI * 2) / (dotCount * 2);

            for (let j = 0; j <= 4; j++) {
                const angle = startAngle + (endAngle - startAngle) * (j / 4);
                const x = center.x + Math.cos(angle) * radius;
                const z = center.z + Math.sin(angle) * radius;
                points.push(new Vector3(x, center.y + 0.1, z));
            }
        }

        if (points.length > 0) {
            return MeshBuilder.CreateLines('mining_range_circle', { points }, this.scene);
        }

        return null;
    }

    private createConnectionLine(basePosition: Vector3, nodePosition: Vector3): LinesMesh | null {
        const points = [
            new Vector3(basePosition.x, basePosition.y + 1, basePosition.z),
            new Vector3(nodePosition.x, nodePosition.y + 1, nodePosition.z)
        ];

        return MeshBuilder.CreateLines('mining_connection_line', { points }, this.scene);
    }

    public clearIndicators(): void {
        for (const indicator of this.miningRangeIndicators) {
            indicator.dispose();
        }
        this.miningRangeIndicators = [];
    }

    public dispose(): void {
        this.clearIndicators();
        if (this.miningRangeMaterial) {
            this.miningRangeMaterial.dispose();
            this.miningRangeMaterial = null;
        }
    }
}
