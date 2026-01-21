/**
 * CoordinateDisplay - Shows camera/user position at top center
 * Toggle visibility with "c" key
 */

import { ArcRotateCamera } from '@babylonjs/core';

export class CoordinateDisplay {
    private cameraGetter: (() => ArcRotateCamera | null) | null = null;
    private container: HTMLDivElement | null = null;
    private coordText: HTMLSpanElement | null = null;
    private isVisible: boolean = false;
    private updateInterval: number | null = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;

    constructor() {
        this.createUI();
        this.setupKeyListener();
    }

    private createUI(): void {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'coord-display';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: #00ffff;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            padding: 8px 16px;
            border-radius: 4px;
            z-index: 9999;
            display: none;
            min-width: 200px;
            text-align: center;
        `;

        // Create coordinate text
        this.coordText = document.createElement('span');
        this.coordText.textContent = 'X: -- | Z: --';
        this.container.appendChild(this.coordText);

        document.body.appendChild(this.container);
    }

    private setupKeyListener(): void {
        this.keyHandler = (e: KeyboardEvent) => {
            // Only toggle on 'c' key, ignore if typing in input
            if (e.key.toLowerCase() === 'c' &&
                !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
                this.toggle();
            }
        };
        window.addEventListener('keydown', this.keyHandler);
    }

    /**
     * Set the camera getter function to track
     */
    public setCameraGetter(getter: () => ArcRotateCamera | null): void {
        this.cameraGetter = getter;
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

        // Update coordinates every 100ms
        this.updateInterval = window.setInterval(() => {
            if (this.coordText && this.cameraGetter) {
                const camera = this.cameraGetter();
                if (camera) {
                    // Use camera target (where you're looking on the ground)
                    const target = camera.getTarget();
                    this.coordText.textContent = `X: ${target.x.toFixed(1)} | Z: ${target.z.toFixed(1)}`;
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

        this.coordText = null;
        this.cameraGetter = null;
    }
}
