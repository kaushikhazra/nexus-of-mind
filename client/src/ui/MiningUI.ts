/**
 * MineralReserveUI - Display current mineral (materials) count
 *
 * Shows the player's current mineral reserves below the energy bar.
 */

import { EnergyManager } from '../game/EnergyManager';

export interface MineralReserveUIConfig {
    containerId: string;
}

export class MineralReserveUI {
    private config: MineralReserveUIConfig;
    private container: HTMLElement | null = null;
    private reservePanel: HTMLElement | null = null;
    private energyManager: EnergyManager;
    private updateIntervalId: number | null = null; // Fix: Track interval for cleanup

    constructor(config: MineralReserveUIConfig) {
        this.config = config;
        this.energyManager = EnergyManager.getInstance();
        this.initialize();
    }

    /**
     * Initialize mineral reserve UI
     */
    private initialize(): void {
        this.createUI();
        this.setupUpdateTimer();
    }

    /**
     * Create UI elements
     */
    private createUI(): void {
        // Get or create container
        this.container = document.getElementById(this.config.containerId);
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = this.config.containerId;
            document.body.appendChild(this.container);
        }

        // Create simple mineral display panel
        this.reservePanel = document.createElement('div');
        this.reservePanel.className = 'mineral-reserve-panel';
        this.reservePanel.innerHTML = `
            <div class="reserve-content">
                <span class="mineral-label">Mineral:</span>
                <span class="mineral-value" id="mineral-count">0</span>
            </div>
        `;

        this.container.appendChild(this.reservePanel);
        this.applyStyles();
    }

    /**
     * Apply SciFi styling to UI elements
     */
    private applyStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .mineral-reserve-panel {
                position: fixed;
                top: 68px;
                right: 20px;
                height: 40px;
                min-width: 120px;
                background: rgba(0, 10, 20, 0.2);
                border: 1px solid rgba(0, 255, 255, 0.4);
                border-radius: 6px;
                font-family: 'Orbitron', monospace;
                color: #00ffff;
                backdrop-filter: blur(8px);
                box-shadow: 0 0 10px rgba(0, 255, 255, 0.15);
                z-index: 1000;
                display: flex;
                align-items: center;
            }

            .reserve-content {
                display: flex;
                align-items: center;
                width: 100%;
                padding: 6px 12px;
                gap: 8px;
            }

            .mineral-label {
                color: #00ffff;
                opacity: 0.9;
                font-size: 12px;
                letter-spacing: 0.5px;
            }

            .mineral-value {
                color: #00ff88;
                font-weight: bold;
                font-size: 14px;
                text-shadow: 0 0 5px rgba(0, 255, 136, 0.6);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Setup update timer for mineral display
     */
    private setupUpdateTimer(): void {
        // Fix: Store interval ID for cleanup
        this.updateIntervalId = window.setInterval(() => {
            this.updateMineralDisplay();
        }, 500);

        // Initial update
        this.updateMineralDisplay();
    }

    /**
     * Update mineral count display
     */
    private updateMineralDisplay(): void {
        const mineralElement = document.getElementById('mineral-count');

        if (mineralElement) {
            const totalMaterials = this.energyManager.getTotalMaterials();
            mineralElement.textContent = Math.floor(totalMaterials).toString();
        }
    }

    /**
     * Show/hide mineral reserve UI
     */
    public setVisible(visible: boolean): void {
        if (this.container) {
            this.container.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Dispose mineral reserve UI and cleanup resources
     */
    public dispose(): void {
        // Fix: Clear interval to prevent memory leak
        if (this.updateIntervalId !== null) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = null;
        }

        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
}
