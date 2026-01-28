/**
 * FloatingNumberEffects - Floating damage and energy number visualization
 *
 * Creates animated floating text for damage, energy gain, and energy loss.
 */

import { Scene, Vector3 } from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock, Control } from '@babylonjs/gui';
import type { FloatingNumberConfig } from './CombatEffectInterfaces';

export class FloatingNumberEffects {
    private scene: Scene;
    private advancedTexture: AdvancedDynamicTexture | null = null;
    private ownsUI: boolean = false;
    private floatingNumbers: Map<string, TextBlock> = new Map();

    constructor(scene: Scene, sharedUI?: AdvancedDynamicTexture) {
        this.scene = scene;
        this.advancedTexture = sharedUI || null;
    }

    public setSharedUI(sharedUI: AdvancedDynamicTexture): void {
        if (this.advancedTexture && this.ownsUI) {
            this.advancedTexture.dispose();
        }
        this.advancedTexture = sharedUI;
        this.ownsUI = false;
    }

    public createFloatingNumber(config: FloatingNumberConfig, effectId: string): TextBlock | null {
        if (!this.advancedTexture) return null;

        const textBlock = new TextBlock();
        textBlock.text = this.formatFloatingNumber(config.value, config.type);
        textBlock.color = this.getFloatingNumberColor(config.type);
        textBlock.fontSize = this.getFloatingNumberSize(config.type);
        textBlock.fontFamily = 'Orbitron, monospace';
        textBlock.fontWeight = 'bold';
        textBlock.outlineWidth = 2;
        textBlock.outlineColor = 'black';

        const screenPos = this.worldToScreen(config.position);
        if (screenPos) {
            textBlock.leftInPixels = screenPos.x - 50;
            textBlock.topInPixels = screenPos.y - 30;
        }

        textBlock.widthInPixels = 100;
        textBlock.heightInPixels = 30;
        textBlock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        textBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;

        this.advancedTexture.addControl(textBlock);

        this.animateFloatingNumber(textBlock, config.type);

        this.floatingNumbers.set(effectId, textBlock);

        return textBlock;
    }

    public removeFloatingNumber(effectId: string): void {
        const textBlock = this.floatingNumbers.get(effectId);
        if (textBlock && this.advancedTexture) {
            this.advancedTexture.removeControl(textBlock);
            this.floatingNumbers.delete(effectId);
        }
    }

    public clearAll(): void {
        for (const [effectId, textBlock] of this.floatingNumbers) {
            if (this.advancedTexture) {
                this.advancedTexture.removeControl(textBlock);
            }
        }
        this.floatingNumbers.clear();
    }

    private formatFloatingNumber(value: number, type: string): string {
        switch (type) {
            case 'damage':
                return `-${Math.round(value)}`;
            case 'energy_gain':
                return `+${Math.round(value)}J`;
            case 'energy_loss':
                return `-${Math.round(value)}J`;
            default:
                return `${Math.round(value)}`;
        }
    }

    private getFloatingNumberColor(type: string): string {
        switch (type) {
            case 'damage': return '#ff4444';
            case 'energy_gain': return '#00ff00';
            case 'energy_loss': return '#ffaa00';
            default: return '#ffffff';
        }
    }

    private getFloatingNumberSize(type: string): number {
        switch (type) {
            case 'damage': return 18;
            case 'energy_gain': return 16;
            case 'energy_loss': return 16;
            default: return 14;
        }
    }

    private animateFloatingNumber(textBlock: TextBlock, type: string): void {
        const startY = textBlock.topInPixels;
        const endY = startY - 60;
        const duration = 2000;
        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const easeProgress = 1 - Math.pow(1 - progress, 3);

            textBlock.topInPixels = startY + (endY - startY) * easeProgress;
            textBlock.alpha = 1 - progress;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    private worldToScreen(worldPos: Vector3): { x: number; y: number } | null {
        if (!this.scene) return null;

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

    public dispose(): void {
        this.clearAll();
        if (this.advancedTexture && this.ownsUI) {
            this.advancedTexture.dispose();
        }
        this.advancedTexture = null;
    }
}
