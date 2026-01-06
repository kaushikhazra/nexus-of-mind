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

        // Create mineral reserve panel
        this.reservePanel = document.createElement('div');
        this.reservePanel.className = 'mineral-reserve-panel';
        this.reservePanel.innerHTML = `
            <div class="reserve-header">
                <span class="reserve-title">MINERAL RESERVES</span>
            </div>
            <div class="reserve-content">
                <div class="reserve-stats" id="reserve-stats">
                    <div class="stat-row">
                        <span>Visible Deposits:</span>
                        <span id="visible-deposits">0</span>
                    </div>
                    <div class="stat-row">
                        <span>Total Capacity:</span>
                        <span id="total-capacity">0 E</span>
                    </div>
                    <div class="stat-row">
                        <span>Average per Deposit:</span>
                        <span id="avg-capacity">0 E</span>
                    </div>
                </div>
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
                width: 220px;
                background: linear-gradient(135deg, rgba(0, 20, 40, 0.95), rgba(0, 40, 80, 0.95));
                border: 2px solid #00ffff;
                border-radius: 8px;
                font-family: 'Orbitron', monospace;
                color: #00ffff;
                box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
                backdrop-filter: blur(10px);
                z-index: 1000;
            }

            .reserve-header {
                background: linear-gradient(90deg, rgba(0, 255, 255, 0.2), rgba(0, 150, 255, 0.2));
                padding: 8px 12px;
                border-bottom: 1px solid #00ffff;
                text-align: center;
            }

            .reserve-title {
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                text-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
            }

            .reserve-content {
                padding: 12px;
            }

            .reserve-stats {
                font-size: 11px;
            }

            .stat-row {
                display: flex;
                justify-content: space-between;
                margin: 6px 0;
                line-height: 1.3;
            }

            .stat-row span:first-child {
                opacity: 0.8;
            }

            .stat-row span:last-child {
                color: #00ff88;
                font-weight: bold;
                text-shadow: 0 0 5px rgba(0, 255, 136, 0.6);
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
            totalCapacityElement.textContent = `${Math.round(totalRemaining)} E`;
        }

        if (avgCapacityElement) {
            avgCapacityElement.textContent = `${avgCapacity} E`;
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