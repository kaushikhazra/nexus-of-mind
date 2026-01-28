/**
 * CombatUI - User interface elements for combat system
 *
 * Provides visual feedback for combat actions including attack cursors,
 * range indicators, energy cost previews, and combat status displays.
 *
 * Refactored to delegate to extracted modules for SOLID compliance.
 */

import { Scene, Vector3, AbstractMesh, PointerEventTypes, Color3 } from '@babylonjs/core';
import type { CombatSystem, CombatTarget } from '../../game/CombatSystem';
import type { Protector } from '../../game/entities/Protector';
import type { EnergyManager } from '../../game/EnergyManager';
import type { CombatEffects } from '../../rendering/CombatEffects';
import type { CombatUIConfig, CursorState } from './CombatUIInterfaces';
import { CombatUIMaterials } from './CombatUIMaterials';
import { CombatRangeIndicators } from './CombatRangeIndicators';
import { CombatEngagementIndicators } from './CombatEngagementIndicators';
import { CombatVisualEffects } from './CombatVisualEffects';

export class CombatUI {
    private scene: Scene;
    private combatSystem: CombatSystem;
    private energyManager: EnergyManager;
    private combatEffects: CombatEffects;
    private container: HTMLElement | null = null;

    private currentCursorState: CursorState = { type: 'default' };
    private pointerObserver: any = null;
    private selectedProtectors: Set<string> = new Set();

    private materials: CombatUIMaterials;
    private rangeIndicators: CombatRangeIndicators;
    private engagementIndicators: CombatEngagementIndicators;
    private visualEffects: CombatVisualEffects;

    constructor(config: CombatUIConfig) {
        this.scene = config.scene;
        this.combatSystem = config.combatSystem;
        this.energyManager = config.energyManager;
        this.combatEffects = config.combatEffects;

        if (config.containerId) {
            this.container = document.getElementById(config.containerId);
        }

        this.materials = new CombatUIMaterials(this.scene);
        this.rangeIndicators = new CombatRangeIndicators(this.scene, this.materials);
        this.engagementIndicators = new CombatEngagementIndicators(this.scene, this.materials);
        this.visualEffects = new CombatVisualEffects(this.scene, this.combatEffects);

        this.initialize();
    }

    private initialize(): void {
        this.setupMouseInteraction();
        this.setupCursorStyles();
    }

    private setupCursorStyles(): void {
        if (!document.querySelector('#combat-cursor-styles')) {
            const style = document.createElement('style');
            style.id = 'combat-cursor-styles';
            style.textContent = `
                .combat-cursor-move { cursor: pointer !important; }
                .combat-cursor-auto-engage { cursor: crosshair !important; }
                .combat-cursor-detecting { cursor: help !important; }
                .combat-cursor-insufficient-energy { cursor: no-drop !important; }
                .combat-cursor-default { cursor: default !important; }
            `;
            document.head.appendChild(style);
        }
    }

    private setupMouseInteraction(): void {
        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            switch (pointerInfo.type) {
                case PointerEventTypes.POINTERMOVE:
                    this.handleMouseMove(pointerInfo);
                    break;
                case PointerEventTypes.POINTERDOWN:
                    this.handleMouseClick(pointerInfo);
                    break;
            }
        });
    }

    private handleMouseMove(pointerInfo: any): void {
        if (this.selectedProtectors.size === 0) {
            this.updateCursorState({ type: 'default' });
            return;
        }
        this.updateCursorState({ type: 'move' });
    }

    private handleMouseClick(pointerInfo: any): void {
        if (this.selectedProtectors.size === 0) return;

        const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);

        if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
            const destination = pickInfo.pickedPoint;

            for (const protectorId of this.selectedProtectors) {
                const protector = this.getProtectorById(protectorId);
                if (protector) {
                    protector.moveToLocation(destination);
                    this.showDestinationIndicator(protectorId, destination);
                    this.updateEngagementStatus(protectorId, 'Moving to destination');
                }
            }
        }
    }

    private updateCursorState(newState: CursorState): void {
        this.currentCursorState = newState;

        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (canvas) {
            canvas.classList.remove(
                'combat-cursor-default',
                'combat-cursor-move',
                'combat-cursor-auto-engage',
                'combat-cursor-detecting',
                'combat-cursor-insufficient-energy'
            );
            canvas.classList.add(`combat-cursor-${newState.type.replace('_', '-')}`);
        }
    }

    public showEnemyDetectionIndicator(protectorId: string, enemyId: string, enemyPosition: Vector3): void {
        this.engagementIndicators.showEnemyDetectionIndicator(protectorId, enemyId, enemyPosition);
    }

    public clearEnemyDetectionIndicator(protectorId: string, enemyId: string): void {
        this.engagementIndicators.clearEnemyDetectionIndicator(protectorId, enemyId);
    }

    public highlightEngagedEnemy(enemyId: string, enemyPosition: Vector3): void {
        this.engagementIndicators.highlightEngagedEnemy(enemyId, enemyPosition);
    }

    public clearEngagedEnemyHighlight(enemyId: string): void {
        this.engagementIndicators.clearEngagedEnemyHighlight(enemyId);
    }

    public showEngagementTransition(protectorId: string, protectorPosition: Vector3, enemyPosition: Vector3): void {
        this.engagementIndicators.showEngagementTransition(protectorId, protectorPosition, enemyPosition);
    }

    public createEnergyBeamEffect(protectorPosition: Vector3, targetPosition: Vector3, color?: Color3): string {
        return this.visualEffects.createEnergyBeamEffect(protectorPosition, targetPosition, color);
    }

    public createDamageEffect(targetPosition: Vector3, damageAmount: number, effectType: 'hit' | 'critical' | 'blocked' = 'hit'): string {
        return this.visualEffects.createDamageEffect(targetPosition, damageAmount, effectType);
    }

    public createDestructionEffect(targetPosition: Vector3, targetSize: number, explosionType: 'small' | 'medium' | 'large' = 'medium'): string {
        return this.visualEffects.createDestructionEffect(targetPosition, targetSize, explosionType);
    }

    public createFloatingEnergyNumber(position: Vector3, energyChange: number, isGain: boolean = true): string {
        return this.visualEffects.createFloatingEnergyNumber(position, energyChange, isGain);
    }

    public createFloatingDamageNumber(position: Vector3, damage: number): string {
        return this.visualEffects.createFloatingDamageNumber(position, damage);
    }

    public playCompleteAttackSequence(protectorPosition: Vector3, targetPosition: Vector3, damage: number, energyCost: number, targetDestroyed: boolean = false, energyReward: number = 0): void {
        this.visualEffects.playCompleteAttackSequence(protectorPosition, targetPosition, damage, energyCost, targetDestroyed, energyReward);
    }

    public showDestinationIndicator(protectorId: string, destination: Vector3): void {
        this.rangeIndicators.showDestinationIndicator(protectorId, destination);
    }

    public clearDestinationIndicator(protectorId: string): void {
        this.rangeIndicators.clearDestinationIndicator(protectorId);
    }

    public updateEngagementStatus(protectorId: string, status: string, color: string = '#00aaff'): void {
        const protector = this.getProtectorById(protectorId);
        this.engagementIndicators.updateEngagementStatus(
            protectorId,
            status,
            color,
            (pos) => this.worldToScreen(pos),
            () => protector ? protector.getPosition() : null
        );
    }

    public showRangeIndicators(protectorIds: string[]): void {
        this.selectedProtectors = this.rangeIndicators.showRangeIndicators(
            protectorIds,
            (id) => this.getProtectorById(id)
        );
    }

    public clearRangeIndicators(): void {
        this.rangeIndicators.clearAllIndicators();
        this.engagementIndicators.clearAllIndicators();
        this.selectedProtectors.clear();
        this.updateCursorState({ type: 'default' });
    }

    public createCombatStatusIndicator(protectorId: string, message: string, color: string = '#ffaa00'): void {
        this.updateEngagementStatus(protectorId, message, color);
    }

    private worldToScreen(worldPos: Vector3): { x: number; y: number } | null {
        const camera = this.scene.activeCamera;
        if (!camera) return null;

        const engine = this.scene.getEngine();
        const screenPos = Vector3.Project(
            worldPos,
            camera.getWorldMatrix(),
            camera.getProjectionMatrix(),
            camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
        );

        return { x: screenPos.x, y: screenPos.y };
    }

    private getTargetFromMesh(mesh: AbstractMesh): CombatTarget | null {
        if (mesh.metadata && mesh.metadata.combatTarget) {
            return mesh.metadata.combatTarget as CombatTarget;
        }
        return null;
    }

    private getProtectorById(protectorId: string): Protector | null {
        return null;
    }

    public update(deltaTime: number): void {
        // Update any animated elements or time-based UI changes
    }

    public setVisible(visible: boolean): void {
        if (!visible) {
            this.clearRangeIndicators();
        }
    }

    public dispose(): void {
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }

        this.clearRangeIndicators();
        this.rangeIndicators.dispose();
        this.engagementIndicators.dispose();
        this.materials.dispose();

        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (canvas) {
            canvas.classList.remove(
                'combat-cursor-default',
                'combat-cursor-move',
                'combat-cursor-auto-engage',
                'combat-cursor-detecting',
                'combat-cursor-insufficient-energy'
            );
        }
    }
}
