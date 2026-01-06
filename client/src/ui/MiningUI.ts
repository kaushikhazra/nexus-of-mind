/**
 * MiningUI - User interface for mining operations
 * 
 * Provides click-to-mine functionality and mining status display.
 * Integrates with the existing UI system and follows SciFi design theme.
 */

import { Scene, Vector3, Ray, PickingInfo, Observer, PointerInfo } from '@babylonjs/core';
import { UnitManager } from '../game/UnitManager';
import { TerrainGenerator } from '../rendering/TerrainGenerator';
import { MineralDeposit } from '../world/MineralDeposit';
import { Worker } from '../game/entities/Worker';

export interface MiningUIConfig {
    containerId: string;
    scene: Scene;
    unitManager: UnitManager;
    terrainGenerator: TerrainGenerator;
}

export class MiningUI {
    private config: MiningUIConfig;
    private container: HTMLElement | null = null;
    private statusPanel: HTMLElement | null = null;
    private selectedWorkers: Worker[] = [];
    private highlightedDeposit: MineralDeposit | null = null;
    
    // Babylon.js observers
    private clickObserver: Observer<PointerInfo> | null = null;
    private hoverObserver: Observer<PointerInfo> | null = null;

    constructor(config: MiningUIConfig) {
        this.config = config;
        this.initialize();
    }

    /**
     * Initialize mining UI
     */
    private initialize(): void {
        this.createUI();
        this.setupEventListeners();
        console.log('⛏️ Mining UI initialized');
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

        // Create mining status panel
        this.statusPanel = document.createElement('div');
        this.statusPanel.className = 'mining-status-panel';
        this.statusPanel.innerHTML = `
            <div class="mining-header">
                <span class="mining-title">MINING OPERATIONS</span>
            </div>
            <div class="mining-content">
                <div class="mining-instructions">
                    <p>1. Select workers by clicking on them</p>
                    <p>2. Click on mineral deposits to assign mining</p>
                    <p>3. Watch energy generation increase</p>
                </div>
                <div class="mining-stats" id="mining-stats">
                    <div class="stat-row">
                        <span>Selected Workers:</span>
                        <span id="selected-count">0</span>
                    </div>
                    <div class="stat-row">
                        <span>Active Miners:</span>
                        <span id="active-miners">0</span>
                    </div>
                    <div class="stat-row">
                        <span>Mining Rate:</span>
                        <span id="mining-rate">0.0 E/s</span>
                    </div>
                </div>
            </div>
        `;

        this.container.appendChild(this.statusPanel);
        this.applyStyles();
    }

    /**
     * Apply SciFi styling to UI elements
     */
    private applyStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .mining-status-panel {
                position: fixed;
                top: 120px;
                right: 20px;
                width: 280px;
                background: linear-gradient(135deg, rgba(0, 20, 40, 0.95), rgba(0, 40, 80, 0.95));
                border: 2px solid #00ffff;
                border-radius: 8px;
                font-family: 'Orbitron', monospace;
                color: #00ffff;
                box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
                backdrop-filter: blur(10px);
                z-index: 1000;
            }

            .mining-header {
                background: linear-gradient(90deg, rgba(0, 255, 255, 0.2), rgba(0, 150, 255, 0.2));
                padding: 12px;
                border-bottom: 1px solid #00ffff;
                text-align: center;
            }

            .mining-title {
                font-size: 14px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                text-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
            }

            .mining-content {
                padding: 15px;
            }

            .mining-instructions {
                margin-bottom: 15px;
                font-size: 11px;
                line-height: 1.4;
                opacity: 0.8;
            }

            .mining-instructions p {
                margin: 5px 0;
                padding-left: 10px;
                border-left: 2px solid rgba(0, 255, 255, 0.3);
            }

            .mining-stats {
                border-top: 1px solid rgba(0, 255, 255, 0.3);
                padding-top: 10px;
            }

            .stat-row {
                display: flex;
                justify-content: space-between;
                margin: 8px 0;
                font-size: 12px;
            }

            .stat-row span:first-child {
                opacity: 0.8;
            }

            .stat-row span:last-child {
                color: #00ff88;
                font-weight: bold;
                text-shadow: 0 0 5px rgba(0, 255, 136, 0.6);
            }

            .deposit-highlight {
                animation: depositPulse 2s infinite;
            }

            @keyframes depositPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Setup event listeners for mining interactions
     */
    private setupEventListeners(): void {
        // Click event for mining assignment
        this.clickObserver = this.config.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === 1) { // POINTERDOWN
                this.handleClick(pointerInfo.pickInfo);
            }
        });

        // Hover event for deposit highlighting
        this.hoverObserver = this.config.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === 4) { // POINTERMOVE
                this.handleHover(pointerInfo.pickInfo);
            }
        });

        // Update stats periodically
        setInterval(() => {
            this.updateStats();
        }, 1000);
    }

    /**
     * Handle click events for mining assignment
     */
    private handleClick(pickInfo: PickingInfo | null): void {
        if (!pickInfo || !pickInfo.hit) return;

        const pickedMesh = pickInfo.pickedMesh;
        if (!pickedMesh) return;

        // Check if clicked on a unit (for selection)
        if (pickedMesh.name.includes('unit_')) {
            this.handleUnitSelection(pickedMesh);
            return;
        }

        // Check if clicked on a mineral deposit (for mining assignment)
        if (pickedMesh.name.includes('mineral_')) {
            this.handleMiningAssignment(pickInfo.pickedPoint);
            return;
        }
    }

    /**
     * Handle unit selection
     */
    private handleUnitSelection(mesh: any): void {
        // Extract unit ID from mesh name
        const unitId = mesh.name.replace('unit_', '');
        const unit = this.config.unitManager.getUnit(unitId);

        if (unit && unit instanceof Worker) {
            // Toggle selection
            const index = this.selectedWorkers.findIndex(w => w.getId() === unit.getId());
            if (index >= 0) {
                this.selectedWorkers.splice(index, 1);
                console.log(`👷 Deselected worker ${unit.getId()}`);
            } else {
                this.selectedWorkers.push(unit);
                console.log(`👷 Selected worker ${unit.getId()}`);
            }

            this.updateStats();
        }
    }

    /**
     * Handle mining assignment
     */
    private handleMiningAssignment(clickPosition: Vector3 | null): void {
        if (!clickPosition || this.selectedWorkers.length === 0) {
            console.log('⛏️ No workers selected or invalid click position');
            return;
        }

        // Find nearest mineral deposit to click position
        const deposits = this.config.terrainGenerator.getVisibleMineralDeposits();
        let nearestDeposit: MineralDeposit | null = null;
        let nearestDistance = Infinity;

        for (const deposit of deposits) {
            const distance = Vector3.Distance(clickPosition, deposit.getPosition());
            if (distance < nearestDistance && distance < 5.0) { // Within 5 units
                nearestDistance = distance;
                nearestDeposit = deposit;
            }
        }

        if (!nearestDeposit) {
            console.log('⛏️ No mineral deposit found near click position');
            return;
        }

        // Assign selected workers to mine the deposit
        this.assignWorkersToMining(nearestDeposit);
    }

    /**
     * Assign workers to mine a specific deposit
     */
    private async assignWorkersToMining(deposit: MineralDeposit): Promise<void> {
        console.log(`⛏️ Assigning ${this.selectedWorkers.length} workers to mine deposit ${deposit.getId()}`);

        for (const worker of this.selectedWorkers) {
            try {
                // Stop current actions
                worker.stopAllActions();

                // Start mining
                const success = await worker.startMining(deposit);
                if (success) {
                    console.log(`⛏️ Worker ${worker.getId()} started mining deposit ${deposit.getId()}`);
                } else {
                    console.warn(`⚠️ Worker ${worker.getId()} failed to start mining`);
                }
            } catch (error) {
                console.error(`❌ Error assigning worker ${worker.getId()} to mining:`, error);
            }
        }

        // Clear selection after assignment
        this.selectedWorkers = [];
        this.updateStats();
    }

    /**
     * Handle hover events for deposit highlighting
     */
    private handleHover(pickInfo: PickingInfo | null): void {
        // Remove previous highlight
        if (this.highlightedDeposit) {
            // TODO: Remove highlight visual effect
            this.highlightedDeposit = null;
        }

        if (!pickInfo || !pickInfo.hit || !pickInfo.pickedMesh) return;

        // Check if hovering over mineral deposit
        if (pickInfo.pickedMesh.name.includes('mineral_')) {
            // TODO: Add highlight visual effect
            console.log('💎 Hovering over mineral deposit');
        }
    }

    /**
     * Update mining statistics display
     */
    private updateStats(): void {
        const selectedCountElement = document.getElementById('selected-count');
        const activeMinersElement = document.getElementById('active-miners');
        const miningRateElement = document.getElementById('mining-rate');

        if (selectedCountElement) {
            selectedCountElement.textContent = this.selectedWorkers.length.toString();
        }

        // Count active miners
        const allWorkers = this.config.unitManager.getUnitsByType('worker') as Worker[];
        const activeMiners = allWorkers.filter(worker => worker.getCurrentAction() === 'mining');
        
        if (activeMinersElement) {
            activeMinersElement.textContent = activeMiners.length.toString();
        }

        // Calculate total mining rate
        let totalMiningRate = 0;
        for (const worker of activeMiners) {
            // Get mining stats if available
            const stats = worker.getStats();
            if (stats.currentAction === 'mining') {
                totalMiningRate += 2.0; // Approximate mining rate
            }
        }

        if (miningRateElement) {
            miningRateElement.textContent = `${totalMiningRate.toFixed(1)} E/s`;
        }
    }

    /**
     * Get selected workers
     */
    public getSelectedWorkers(): Worker[] {
        return [...this.selectedWorkers];
    }

    /**
     * Clear worker selection
     */
    public clearSelection(): void {
        this.selectedWorkers = [];
        this.updateStats();
    }

    /**
     * Show/hide mining UI
     */
    public setVisible(visible: boolean): void {
        if (this.container) {
            this.container.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Dispose mining UI and cleanup resources
     */
    public dispose(): void {
        // Remove observers
        if (this.clickObserver) {
            this.config.scene.onPointerObservable.remove(this.clickObserver);
            this.clickObserver = null;
        }

        if (this.hoverObserver) {
            this.config.scene.onPointerObservable.remove(this.hoverObserver);
            this.hoverObserver = null;
        }

        // Remove UI elements
        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        this.selectedWorkers = [];
        console.log('⛏️ Mining UI disposed');
    }
}