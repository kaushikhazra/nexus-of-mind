/**
 * MineralReserveUI - Display mineral reserves information
 * 
 * Shows mineral reserve statistics below the energy bar.
 * Simple display without mining operations or help text.
 */

import { Scene } from '@babylonjs/core';
import { TerrainGenerator } from '../rendering/TerrainGenerator';

export interface MineralReserveUIConfig {
    containerId: string;
    terrainGenerator: TerrainGenerator;
}

export class MineralReserveUI {
    private config: MineralReserveUIConfig;
    private container: HTMLElement | null = null;
    private reservePanel: HTMLElement | null = null;

    constructor(config: MineralReserveUIConfig) {
        this.config = config;
        this.initialize();
    }

    /**
     * Initialize mineral reserve UI
     */
    private initialize(): void {
        this.createUI();
        this.setupUpdateTimer();
        console.log('💎 Mineral Reserve UI initialized');
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

        // Create mineral reserve panel (linear format like energy bar)
        this.reservePanel = document.createElement('div');
        this.reservePanel.className = 'mineral-reserve-panel';
        this.reservePanel.innerHTML = `
            <div class="reserve-content">
                <span class="reserve-stat">
                    <span class="stat-label">VIS</span>
                    <span class="stat-value" id="visible-deposits">0</span>
                </span>
                <span class="reserve-stat">
                    <span class="stat-label">CAP</span>
                    <span class="stat-value" id="total-capacity">0E</span>
                </span>
                <span class="reserve-stat">
                    <span class="stat-label">AVG</span>
                    <span class="stat-value" id="avg-capacity">0E</span>
                </span>
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
                top: 80px;
                right: 20px;
                height: 40px;
                min-width: 250px;
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
                gap: 20px;
            }

            .reserve-stat {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 12px;
                letter-spacing: 0.5px;
            }

            .stat-label {
                color: #00ffff;
                opacity: 0.8;
                font-weight: normal;
                text-transform: uppercase;
            }

            .stat-value {
                color: #00ff88;
                font-weight: bold;
                text-shadow: 0 0 5px rgba(0, 255, 136, 0.6);
                min-width: 30px;
                text-align: right;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Setup update timer for reserve statistics
     */
    private setupUpdateTimer(): void {
        // Update stats every 2 seconds
        setInterval(() => {
            this.updateReserveStats();
        }, 2000);
        
        // Initial update
        this.updateReserveStats();
    }

    /**
     * Update mineral reserve statistics display
     */
    private updateReserveStats(): void {
        const visibleDepositsElement = document.getElementById('visible-deposits');
        const totalCapacityElement = document.getElementById('total-capacity');
        const avgCapacityElement = document.getElementById('avg-capacity');

        // Get mineral deposit data
        const visibleDeposits = this.config.terrainGenerator.getVisibleMineralDeposits();
        const totalDeposits = this.config.terrainGenerator.getAllMineralDeposits();

        // Calculate statistics
        let totalCapacity = 0;
        let totalRemaining = 0;
        
        for (const deposit of visibleDeposits) {
            const stats = deposit.getStats();
            totalCapacity += stats.capacity;
            totalRemaining += stats.remaining;
        }

        const avgCapacity = visibleDeposits.length > 0 ? Math.round(totalCapacity / visibleDeposits.length) : 0;

        // Update display
        if (visibleDepositsElement) {
            visibleDepositsElement.textContent = visibleDeposits.length.toString();
        }

        if (totalCapacityElement) {
            totalCapacityElement.textContent = `${Math.round(totalRemaining)}E`;
        }

        if (avgCapacityElement) {
            avgCapacityElement.textContent = `${avgCapacity}E`;
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
        // Remove UI elements
        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        console.log('💎 Mineral Reserve UI disposed');
    }
}