/**
 * CombatEngagementIndicators - Enemy detection and engagement indicators
 *
 * Handles visual indicators for enemy detection, engagement highlights,
 * and engagement transitions.
 */

import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3, LinesMesh } from '@babylonjs/core';
import type { CombatUIMaterials } from './CombatUIMaterials';

export class CombatEngagementIndicators {
    private scene: Scene;
    private materials: CombatUIMaterials;

    private detectionIndicators: Map<string, Mesh> = new Map();
    private engagementHighlights: Map<string, Mesh> = new Map();
    private engagementStatusElements: Map<string, HTMLElement> = new Map();

    constructor(scene: Scene, materials: CombatUIMaterials) {
        this.scene = scene;
        this.materials = materials;
    }

    public showEnemyDetectionIndicator(protectorId: string, enemyId: string, enemyPosition: Vector3): void {
        if (!this.materials.detectedEnemyMaterial) return;

        const indicatorId = `detection_${protectorId}_${enemyId}`;

        const detectionRing = MeshBuilder.CreateTorus(indicatorId, {
            diameter: 2,
            thickness: 0.2,
            tessellation: 16
        }, this.scene);

        detectionRing.position = enemyPosition.clone();
        detectionRing.position.y += 0.5;
        detectionRing.material = this.materials.detectedEnemyMaterial;
        detectionRing.renderingGroupId = 2;

        this.animateDetectionIndicator(detectionRing);
        this.detectionIndicators.set(indicatorId, detectionRing);

        setTimeout(() => {
            this.clearEnemyDetectionIndicator(protectorId, enemyId);
        }, 3000);
    }

    public clearEnemyDetectionIndicator(protectorId: string, enemyId: string): void {
        const indicatorId = `detection_${protectorId}_${enemyId}`;

        const indicator = this.detectionIndicators.get(indicatorId);
        if (indicator) {
            indicator.dispose();
            this.detectionIndicators.delete(indicatorId);
        }
    }

    private animateDetectionIndicator(mesh: Mesh): void {
        setTimeout(() => {
            if (mesh && !mesh.isDisposed()) {
                this.scene.beginAnimation(mesh.material, 0, 30, false);
            }
        }, 2500);
    }

    public highlightEngagedEnemy(enemyId: string, enemyPosition: Vector3): void {
        if (!this.materials.validTargetMaterial) return;

        const highlightId = `engaged_${enemyId}`;

        const highlight = MeshBuilder.CreateSphere(highlightId, { diameter: 3 }, this.scene);
        highlight.position = enemyPosition.clone();
        highlight.material = this.materials.validTargetMaterial;
        highlight.renderingGroupId = 1;

        if (highlight.material instanceof StandardMaterial) {
            highlight.material.wireframe = true;
            highlight.material.alpha = 0.6;
        }

        this.engagementHighlights.set(highlightId, highlight);
    }

    public clearEngagedEnemyHighlight(enemyId: string): void {
        const highlightId = `engaged_${enemyId}`;

        const highlight = this.engagementHighlights.get(highlightId);
        if (highlight) {
            highlight.dispose();
            this.engagementHighlights.delete(highlightId);
        }
    }

    public showEngagementTransition(protectorId: string, protectorPosition: Vector3, enemyPosition: Vector3): void {
        const points = [protectorPosition, enemyPosition];
        const engagementLine = MeshBuilder.CreateLines(`engagement_${protectorId}`, { points }, this.scene);

        if (this.materials.validTargetMaterial) {
            engagementLine.color = new Color3(0, 1, 0);
        }

        engagementLine.renderingGroupId = 1;

        setTimeout(() => {
            if (engagementLine && !engagementLine.isDisposed()) {
                engagementLine.dispose();
            }
        }, 1500);
    }

    public updateEngagementStatus(protectorId: string, status: string, color: string, worldToScreen: (pos: Vector3) => { x: number; y: number } | null, getProtectorPosition: () => Vector3 | null): void {
        const existingElement = this.engagementStatusElements.get(protectorId);
        if (existingElement && existingElement.parentNode) {
            existingElement.parentNode.removeChild(existingElement);
        }

        const position = getProtectorPosition();
        if (!position) return;

        const statusElement = document.createElement('div');
        statusElement.style.cssText = `
            position: fixed;
            background: rgba(0, 10, 20, 0.9);
            border: 1px solid ${color};
            border-radius: 4px;
            padding: 4px 8px;
            font-family: 'Orbitron', monospace;
            font-size: 10px;
            color: ${color};
            pointer-events: none;
            z-index: 999;
            box-shadow: 0 0 8px ${color}40;
            backdrop-filter: blur(2px);
        `;
        statusElement.textContent = status;

        const screenPos = worldToScreen(position);
        if (screenPos) {
            statusElement.style.left = `${screenPos.x - 50}px`;
            statusElement.style.top = `${screenPos.y - 40}px`;
        }

        document.body.appendChild(statusElement);
        this.engagementStatusElements.set(protectorId, statusElement);

        setTimeout(() => {
            const currentElement = this.engagementStatusElements.get(protectorId);
            if (currentElement === statusElement && statusElement.parentNode) {
                statusElement.parentNode.removeChild(statusElement);
                this.engagementStatusElements.delete(protectorId);
            }
        }, 3000);
    }

    public clearAllIndicators(): void {
        for (const indicator of this.detectionIndicators.values()) {
            indicator.dispose();
        }
        this.detectionIndicators.clear();

        for (const highlight of this.engagementHighlights.values()) {
            highlight.dispose();
        }
        this.engagementHighlights.clear();

        for (const element of this.engagementStatusElements.values()) {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }
        this.engagementStatusElements.clear();
    }

    public dispose(): void {
        this.clearAllIndicators();
    }
}
