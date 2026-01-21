/**
 * FPSCounter - Simple FPS display for performance tracking
 * Toggle visibility with "f" key
 */

import { Engine } from '@babylonjs/core';

export class FPSCounter {
    private engine: Engine;
    private container: HTMLDivElement | null = null;
    private fpsText: HTMLSpanElement | null = null;
    private isVisible: boolean = false;
    private updateInterval: number | null = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;

    constructor(engine: Engine) {
        this.engine = engine;
        this.createUI();
        this.setupKeyListener();
    }

    private createUI(): void {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'fps-counter';
        this.container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            padding: 8px 12px;
            border-radius: 4px;
            z-index: 9999;
            display: none;
            min-width: 80px;
            text-align: right;
        `;

        // Create FPS text
        this.fpsText = document.createElement('span');
        this.fpsText.textContent = 'FPS: --';
        this.container.appendChild(this.fpsText);

        document.body.appendChild(this.container);
    }

    private setupKeyListener(): void {
        this.keyHandler = (e: KeyboardEvent) => {
            // Only toggle on 'f' key, ignore if typing in input
            if (e.key.toLowerCase() === 'f' &&
                !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
                this.toggle();
            }
        };
        window.addEventListener('keydown', this.keyHandler);
    }

    public toggle(): void {
        this.isVisible = !this.isVisible;

        if (this.container) {
            this.container.style.display = this.isVisible ? 'block' : 'none';
        }

        if (this.isVisible) {
            this.startUpdating();
        } else {
            this.stopUpdating();
        }
    }

    public show(): void {
        if (!this.isVisible) {
            this.toggle();
        }
    }

    public hide(): void {
        if (this.isVisible) {
            this.toggle();
        }
    }

    private startUpdating(): void {
        if (this.updateInterval !== null) return;

        // Update FPS every 100ms
        this.updateInterval = window.setInterval(() => {
            if (this.fpsText) {
                const fps = this.engine.getFps().toFixed(0);
                this.fpsText.textContent = `FPS: ${fps}`;

                // Color code based on FPS
                const fpsNum = parseInt(fps);
                if (fpsNum >= 55) {
                    this.fpsText.style.color = '#00ff00'; // Green
                } else if (fpsNum >= 30) {
                    this.fpsText.style.color = '#ffff00'; // Yellow
                } else {
                    this.fpsText.style.color = '#ff0000'; // Red
                }
            }
        }, 100);
    }

    private stopUpdating(): void {
        if (this.updateInterval !== null) {
            window.clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    public dispose(): void {
        this.stopUpdating();

        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }

        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
            this.container = null;
        }

        this.fpsText = null;
    }
}
