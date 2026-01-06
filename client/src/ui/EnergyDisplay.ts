/**
 * EnergyDisplay - Basic energy UI display for current energy levels
 * 
 * Provides real-time energy information display with efficient updates
 * and integration with the energy management system.
 */

import { EnergyManager, EnergyStats } from '../game/EnergyManager';

export interface EnergyDisplayConfig {
    containerId: string;
    updateInterval?: number;
    showDetails?: boolean;
    showHistory?: boolean;
}

export class EnergyDisplay {
    private energyManager: EnergyManager;
    private container: HTMLElement | null = null;
    private config: EnergyDisplayConfig;
    
    // UI elements
    private energyValueElement: HTMLElement | null = null;
    private energyBarElement: HTMLElement | null = null;
    private energyBarFillElement: HTMLElement | null = null;
    private generationRateElement: HTMLElement | null = null;
    private consumptionRateElement: HTMLElement | null = null;
    private efficiencyElement: HTMLElement | null = null;
    private transactionHistoryElement: HTMLElement | null = null;
    
    // Update management
    private updateInterval: number | null = null;
    private lastUpdateTime: number = 0;
    private isVisible: boolean = true;

    constructor(config: EnergyDisplayConfig) {
        this.config = {
            updateInterval: 100, // Update every 100ms for smooth display
            showDetails: true,
            showHistory: false,
            ...config
        };
        
        this.energyManager = EnergyManager.getInstance();
        this.initialize();
    }

    /**
     * Initialize the energy display UI
     */
    private initialize(): void {
        this.container = document.getElementById(this.config.containerId);
        
        if (!this.container) {
            console.error(`⚠️ Energy display container not found: ${this.config.containerId}`);
            return;
        }

        this.createUI();
        this.startUpdates();
        this.subscribeToEnergyEvents();
        
        console.log('⚡ EnergyDisplay initialized');
    }

    /**
     * Create the UI elements
     */
    private createUI(): void {
        if (!this.container) return;

        // Clear existing content
        this.container.innerHTML = '';
        
        // Main energy display
        const energyPanel = document.createElement('div');
        energyPanel.className = 'energy-panel';
        energyPanel.style.cssText = `
            background: rgba(0, 20, 40, 0.9);
            border: 2px solid #00ffff;
            border-radius: 8px;
            padding: 12px;
            font-family: 'Courier New', monospace;
            color: #00ffff;
            min-width: 200px;
            box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
        `;

        // Energy value display
        const energyHeader = document.createElement('div');
        energyHeader.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 8px;
            text-align: center;
        `;
        energyHeader.textContent = 'ENERGY SYSTEM';

        this.energyValueElement = document.createElement('div');
        this.energyValueElement.style.cssText = `
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 10px;
            color: #00ff00;
        `;
        this.energyValueElement.textContent = '0 J';

        // Energy bar
        const energyBarContainer = document.createElement('div');
        energyBarContainer.style.cssText = `
            width: 100%;
            height: 20px;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid #00ffff;
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 10px;
        `;

        this.energyBarFillElement = document.createElement('div');
        this.energyBarFillElement.style.cssText = `
            height: 100%;
            background: linear-gradient(90deg, #00ff00, #ffff00, #ff0000);
            width: 100%;
            transition: width 0.3s ease;
        `;

        energyBarContainer.appendChild(this.energyBarFillElement);

        // Details section
        let detailsSection: HTMLElement | null = null;
        if (this.config.showDetails) {
            detailsSection = document.createElement('div');
            detailsSection.style.cssText = `
                font-size: 12px;
                margin-top: 8px;
                border-top: 1px solid #00ffff;
                padding-top: 8px;
            `;

            // Generation rate
            const generationRow = document.createElement('div');
            generationRow.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 4px;';
            generationRow.innerHTML = '<span>Generation:</span><span id="generation-rate">0 J/s</span>';
            this.generationRateElement = generationRow.querySelector('#generation-rate');

            // Consumption rate
            const consumptionRow = document.createElement('div');
            consumptionRow.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 4px;';
            consumptionRow.innerHTML = '<span>Consumption:</span><span id="consumption-rate">0 J/s</span>';
            this.consumptionRateElement = consumptionRow.querySelector('#consumption-rate');

            // Efficiency
            const efficiencyRow = document.createElement('div');
            efficiencyRow.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 4px;';
            efficiencyRow.innerHTML = '<span>Efficiency:</span><span id="efficiency">100%</span>';
            this.efficiencyElement = efficiencyRow.querySelector('#efficiency');

            detailsSection.appendChild(generationRow);
            detailsSection.appendChild(consumptionRow);
            detailsSection.appendChild(efficiencyRow);
        }

        // Transaction history
        if (this.config.showHistory) {
            this.transactionHistoryElement = document.createElement('div');
            this.transactionHistoryElement.style.cssText = `
                font-size: 10px;
                margin-top: 8px;
                border-top: 1px solid #00ffff;
                padding-top: 8px;
                max-height: 100px;
                overflow-y: auto;
            `;
            
            const historyTitle = document.createElement('div');
            historyTitle.textContent = 'Recent Transactions:';
            historyTitle.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
            this.transactionHistoryElement.appendChild(historyTitle);
        }

        // Assemble UI
        energyPanel.appendChild(energyHeader);
        energyPanel.appendChild(this.energyValueElement);
        energyPanel.appendChild(energyBarContainer);
        
        if (detailsSection) {
            energyPanel.appendChild(detailsSection);
        }
        
        if (this.transactionHistoryElement) {
            energyPanel.appendChild(this.transactionHistoryElement);
        }

        this.container.appendChild(energyPanel);
    }

    /**
     * Start periodic updates
     */
    private startUpdates(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = window.setInterval(() => {
            if (this.isVisible) {
                this.updateDisplay();
            }
        }, this.config.updateInterval);
    }

    /**
     * Subscribe to energy system events
     */
    private subscribeToEnergyEvents(): void {
        this.energyManager.onEnergyChange((stats: EnergyStats) => {
            this.updateDisplayWithStats(stats);
        });

        this.energyManager.onLowEnergy((entityId: string, currentEnergy: number) => {
            this.showLowEnergyWarning(currentEnergy);
        });

        this.energyManager.onEnergyDepleted((entityId: string) => {
            this.showEnergyDepletedAlert();
        });
    }

    /**
     * Update the display with current energy stats
     */
    private updateDisplay(): void {
        const stats = this.energyManager.getEnergyStats();
        this.updateDisplayWithStats(stats);
    }

    /**
     * Update display with provided stats
     */
    private updateDisplayWithStats(stats: EnergyStats): void {
        // Update energy value
        if (this.energyValueElement) {
            this.energyValueElement.textContent = `${Math.round(stats.totalEnergy)} J`;
            
            // Color based on energy level
            if (stats.totalEnergy < 20) {
                this.energyValueElement.style.color = '#ff0000'; // Red for low energy
            } else if (stats.totalEnergy < 50) {
                this.energyValueElement.style.color = '#ffff00'; // Yellow for medium energy
            } else {
                this.energyValueElement.style.color = '#00ff00'; // Green for good energy
            }
        }

        // Update energy bar (assuming max 200 energy for display)
        if (this.energyBarFillElement) {
            const maxDisplayEnergy = 200;
            const percentage = Math.min(stats.totalEnergy / maxDisplayEnergy, 1) * 100;
            this.energyBarFillElement.style.width = `${percentage}%`;
        }

        // Update details
        if (this.config.showDetails) {
            if (this.generationRateElement) {
                this.generationRateElement.textContent = `${stats.totalGeneration.toFixed(1)} J/s`;
            }
            
            if (this.consumptionRateElement) {
                this.consumptionRateElement.textContent = `${stats.totalConsumption.toFixed(1)} J/s`;
            }
            
            if (this.efficiencyElement) {
                const efficiency = (stats.energyEfficiency * 100).toFixed(1);
                this.efficiencyElement.textContent = `${efficiency}%`;
                
                // Color based on efficiency
                if (stats.energyEfficiency < 0.5) {
                    this.efficiencyElement.style.color = '#ff0000';
                } else if (stats.energyEfficiency < 0.8) {
                    this.efficiencyElement.style.color = '#ffff00';
                } else {
                    this.efficiencyElement.style.color = '#00ff00';
                }
            }
        }

        // Update transaction history
        if (this.config.showHistory && this.transactionHistoryElement) {
            this.updateTransactionHistory();
        }
    }

    /**
     * Update transaction history display
     */
    private updateTransactionHistory(): void {
        if (!this.transactionHistoryElement) return;

        const transactions = this.energyManager.getRecentTransactions(5);
        const historyContent = transactions.map(txn => {
            const sign = txn.amount >= 0 ? '+' : '';
            const color = txn.success ? (txn.amount >= 0 ? '#00ff00' : '#ffaa00') : '#ff0000';
            return `<div style="color: ${color};">${sign}${txn.amount.toFixed(1)} J - ${txn.action}</div>`;
        }).join('');

        // Keep title and update content
        const title = this.transactionHistoryElement.querySelector('div');
        this.transactionHistoryElement.innerHTML = '';
        if (title) {
            this.transactionHistoryElement.appendChild(title);
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = historyContent;
        this.transactionHistoryElement.appendChild(contentDiv);
    }

    /**
     * Show low energy warning
     */
    private showLowEnergyWarning(currentEnergy: number): void {
        if (this.energyValueElement) {
            this.energyValueElement.style.animation = 'blink 1s infinite';
            
            // Add CSS animation if not exists
            if (!document.querySelector('#energy-warning-style')) {
                const style = document.createElement('style');
                style.id = 'energy-warning-style';
                style.textContent = `
                    @keyframes blink {
                        0%, 50% { opacity: 1; }
                        51%, 100% { opacity: 0.3; }
                    }
                `;
                document.head.appendChild(style);
            }
        }
    }

    /**
     * Show energy depleted alert
     */
    private showEnergyDepletedAlert(): void {
        if (this.energyValueElement) {
            this.energyValueElement.style.color = '#ff0000';
            this.energyValueElement.style.animation = 'blink 0.5s infinite';
        }
    }

    /**
     * Set display visibility
     */
    public setVisible(visible: boolean): void {
        this.isVisible = visible;
        
        if (this.container) {
            this.container.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<EnergyDisplayConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        if (newConfig.updateInterval) {
            this.startUpdates();
        }
    }

    /**
     * Dispose energy display
     */
    public dispose(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        if (this.container) {
            this.container.innerHTML = '';
        }

        console.log('⚡ EnergyDisplay disposed');
    }
}