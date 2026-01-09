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
    private netRateElement: HTMLElement | null = null;
    
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
    }

    /**
     * Create the UI elements
     */
    private createUI(): void {
        if (!this.container) return;

        // Clear existing content
        this.container.innerHTML = '';
        
        // Linear horizontal HUD
        const energyHUD = document.createElement('div');
        energyHUD.className = 'energy-hud';
        energyHUD.style.cssText = `
            background: rgba(0, 10, 20, 0.2);
            border: 1px solid rgba(0, 255, 255, 0.4);
            border-radius: 6px;
            padding: 6px 12px;
            font-family: 'Orbitron', monospace;
            color: #00ffff;
            backdrop-filter: blur(8px);
            box-shadow: 0 0 10px rgba(0, 255, 255, 0.15);
            font-size: 12px;
            letter-spacing: 0.5px;
            white-space: nowrap;
        `;

        // Energy bar at the top (thin)
        const energyBarContainer = document.createElement('div');
        energyBarContainer.style.cssText = `
            width: 100%;
            height: 3px;
            background: rgba(0, 0, 0, 0.4);
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 6px;
            position: relative;
        `;

        this.energyBarFillElement = document.createElement('div');
        this.energyBarFillElement.style.cssText = `
            height: 100%;
            background: linear-gradient(90deg, 
                rgba(0, 255, 0, 0.8) 0%, 
                rgba(0, 255, 255, 0.8) 50%, 
                rgba(255, 255, 0, 0.8) 80%, 
                rgba(255, 0, 0, 0.8) 100%);
            width: 100%;
            transition: width 0.3s ease;
        `;

        energyBarContainer.appendChild(this.energyBarFillElement);

        // Linear stats display
        const statsLine = document.createElement('div');
        statsLine.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 11px;
        `;

        // Energy value
        this.energyValueElement = document.createElement('span');
        this.energyValueElement.style.cssText = `
            font-size: 14px;
            font-weight: 700;
            color: #00ff00;
            text-shadow: 0 0 6px rgba(0, 255, 0, 0.6);
        `;
        this.energyValueElement.textContent = '0J';

        // Generation
        const genContainer = document.createElement('span');
        genContainer.style.cssText = 'color: #00ff88;';
        genContainer.innerHTML = '+GEN ';
        this.generationRateElement = document.createElement('span');
        this.generationRateElement.style.cssText = 'font-weight: 600;';
        this.generationRateElement.textContent = '0.0';
        genContainer.appendChild(this.generationRateElement);

        // Consumption
        const conContainer = document.createElement('span');
        conContainer.style.cssText = 'color: #ffaa00;';
        conContainer.innerHTML = '-CON ';
        this.consumptionRateElement = document.createElement('span');
        this.consumptionRateElement.style.cssText = 'font-weight: 600;';
        this.consumptionRateElement.textContent = '0.0';
        conContainer.appendChild(this.consumptionRateElement);

        // Efficiency
        const effContainer = document.createElement('span');
        effContainer.style.cssText = 'color: #00ccff;';
        effContainer.innerHTML = 'EFF ';
        this.efficiencyElement = document.createElement('span');
        this.efficiencyElement.style.cssText = 'font-weight: 600;';
        this.efficiencyElement.textContent = '0%';
        effContainer.appendChild(this.efficiencyElement);

        // Net rate
        const netContainer = document.createElement('span');
        netContainer.style.cssText = 'color: #ffffff;';
        netContainer.innerHTML = 'NET ';
        this.netRateElement = document.createElement('span');
        this.netRateElement.style.cssText = 'font-weight: 600;';
        this.netRateElement.textContent = '0.0';
        netContainer.appendChild(this.netRateElement);

        // Assemble linear layout
        statsLine.appendChild(this.energyValueElement);
        statsLine.appendChild(genContainer);
        statsLine.appendChild(conContainer);
        statsLine.appendChild(effContainer);
        statsLine.appendChild(netContainer);

        // Assemble HUD
        energyHUD.appendChild(energyBarContainer);
        energyHUD.appendChild(statsLine);

        this.container.appendChild(energyHUD);

        // Add minimal CSS animations
        this.addMinimalAnimations();
    }

    /**
     * Add minimal CSS animations for HUD
     */
    private addMinimalAnimations(): void {
        if (!document.querySelector('#minimal-hud-animations')) {
            const style = document.createElement('style');
            style.id = 'minimal-hud-animations';
            style.textContent = `
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0.3; }
                }
                
                .energy-hud {
                    transition: all 0.3s ease;
                }
                
                .energy-hud:hover {
                    background: rgba(0, 15, 30, 0.5);
                    box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
                }
            `;
            document.head.appendChild(style);
        }
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
        // Update energy value (format: 100J)
        if (this.energyValueElement) {
            this.energyValueElement.textContent = `${Math.round(stats.totalEnergy)}J`;
            
            // Color based on energy level
            if (stats.totalEnergy < 20) {
                this.energyValueElement.style.color = '#ff4444'; // Red for low energy
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

        // Update linear stats (format: 0.0 for rates, 0% for efficiency)
        if (this.generationRateElement) {
            this.generationRateElement.textContent = `${stats.totalGeneration.toFixed(1)}`;
            this.generationRateElement.style.color = '#00ff88';
        }
        
        if (this.consumptionRateElement) {
            this.consumptionRateElement.textContent = `${stats.totalConsumption.toFixed(1)}`;
            this.consumptionRateElement.style.color = '#ffaa00';
        }
        
        if (this.efficiencyElement) {
            const efficiency = Math.round(stats.energyEfficiency * 100);
            this.efficiencyElement.textContent = `${efficiency}%`;
            
            // Color based on efficiency
            if (stats.energyEfficiency < 0.5) {
                this.efficiencyElement.style.color = '#ff4444';
            } else if (stats.energyEfficiency < 0.8) {
                this.efficiencyElement.style.color = '#ffaa00';
            } else {
                this.efficiencyElement.style.color = '#00ccff';
            }
        }

        // Update net rate (generation - consumption)
        if (this.netRateElement) {
            const netRate = stats.totalGeneration - stats.totalConsumption;
            this.netRateElement.textContent = `${netRate.toFixed(1)}`;
            
            // Color based on net rate
            if (netRate > 0) {
                this.netRateElement.style.color = '#00ff88'; // Green for positive
            } else if (netRate < 0) {
                this.netRateElement.style.color = '#ff6644'; // Red for negative
            } else {
                this.netRateElement.style.color = '#ffffff'; // White for neutral
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
    }
}