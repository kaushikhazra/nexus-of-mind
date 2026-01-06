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
        
        // Main energy display with advanced SciFi styling
        const energyPanel = document.createElement('div');
        energyPanel.className = 'energy-panel';
        energyPanel.style.cssText = `
            background: linear-gradient(135deg, rgba(0, 10, 30, 0.95) 0%, rgba(0, 30, 60, 0.95) 100%);
            border: 2px solid #00ffff;
            border-radius: 12px;
            padding: 16px;
            font-family: 'Orbitron', 'Courier New', monospace;
            color: #00ffff;
            min-width: 240px;
            box-shadow: 
                0 0 20px rgba(0, 255, 255, 0.4),
                inset 0 0 20px rgba(0, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            position: relative;
            overflow: hidden;
        `;

        // Add animated background pattern
        const bgPattern = document.createElement('div');
        bgPattern.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 2px,
                    rgba(0, 255, 255, 0.03) 2px,
                    rgba(0, 255, 255, 0.03) 4px
                );
            pointer-events: none;
            z-index: 0;
        `;
        energyPanel.appendChild(bgPattern);

        // Content container
        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = 'position: relative; z-index: 1;';

        // Energy header with SciFi styling
        const energyHeader = document.createElement('div');
        energyHeader.style.cssText = `
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 12px;
            text-align: center;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #00ffff;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
            border-bottom: 1px solid rgba(0, 255, 255, 0.3);
            padding-bottom: 8px;
        `;
        energyHeader.innerHTML = '◊ ENERGY CORE ◊';

        // Energy value display with holographic effect
        this.energyValueElement = document.createElement('div');
        this.energyValueElement.style.cssText = `
            font-size: 28px;
            font-weight: 900;
            text-align: center;
            margin: 16px 0;
            color: #00ff00;
            text-shadow: 
                0 0 10px rgba(0, 255, 0, 0.8),
                0 0 20px rgba(0, 255, 0, 0.4);
            font-family: 'Orbitron', monospace;
            letter-spacing: 1px;
        `;
        this.energyValueElement.textContent = '0 J';

        // Energy bar with advanced styling
        const energyBarContainer = document.createElement('div');
        energyBarContainer.style.cssText = `
            width: 100%;
            height: 24px;
            background: rgba(0, 0, 0, 0.6);
            border: 2px solid #00ffff;
            border-radius: 12px;
            overflow: hidden;
            margin: 16px 0;
            position: relative;
            box-shadow: inset 0 0 10px rgba(0, 255, 255, 0.2);
        `;

        // Energy bar background glow
        const energyBarGlow = document.createElement('div');
        energyBarGlow.style.cssText = `
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: linear-gradient(90deg, #00ffff, #00ff00, #ffff00, #ff0000);
            border-radius: 12px;
            opacity: 0.3;
            z-index: 0;
        `;
        energyBarContainer.appendChild(energyBarGlow);

        this.energyBarFillElement = document.createElement('div');
        this.energyBarFillElement.style.cssText = `
            height: 100%;
            background: linear-gradient(90deg, 
                rgba(0, 255, 0, 0.9) 0%, 
                rgba(0, 255, 255, 0.9) 50%, 
                rgba(255, 255, 0, 0.9) 80%, 
                rgba(255, 0, 0, 0.9) 100%);
            width: 100%;
            transition: width 0.5s ease;
            position: relative;
            z-index: 1;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.6);
        `;

        // Add animated energy flow effect
        const energyFlow = document.createElement('div');
        energyFlow.style.cssText = `
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, 
                transparent 0%, 
                rgba(255, 255, 255, 0.4) 50%, 
                transparent 100%);
            animation: energyFlow 2s infinite linear;
            z-index: 2;
        `;
        this.energyBarFillElement.appendChild(energyFlow);

        energyBarContainer.appendChild(this.energyBarFillElement);

        // Details section with SciFi styling
        let detailsSection: HTMLElement | null = null;
        if (this.config.showDetails) {
            detailsSection = document.createElement('div');
            detailsSection.style.cssText = `
                font-size: 11px;
                margin-top: 12px;
                border-top: 1px solid rgba(0, 255, 255, 0.4);
                padding-top: 12px;
                font-family: 'Orbitron', monospace;
                letter-spacing: 0.5px;
            `;

            // Generation rate
            const generationRow = document.createElement('div');
            generationRow.style.cssText = `
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 6px;
                padding: 4px 0;
                border-left: 2px solid rgba(0, 255, 0, 0.6);
                padding-left: 8px;
            `;
            generationRow.innerHTML = '<span>⚡ GENERATION:</span><span id="generation-rate" style="color: #00ff00; font-weight: bold;">0 J/s</span>';
            this.generationRateElement = generationRow.querySelector('#generation-rate');

            // Consumption rate
            const consumptionRow = document.createElement('div');
            consumptionRow.style.cssText = `
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 6px;
                padding: 4px 0;
                border-left: 2px solid rgba(255, 165, 0, 0.6);
                padding-left: 8px;
            `;
            consumptionRow.innerHTML = '<span>⚡ CONSUMPTION:</span><span id="consumption-rate" style="color: #ffaa00; font-weight: bold;">0 J/s</span>';
            this.consumptionRateElement = consumptionRow.querySelector('#consumption-rate');

            // Efficiency
            const efficiencyRow = document.createElement('div');
            efficiencyRow.style.cssText = `
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 6px;
                padding: 4px 0;
                border-left: 2px solid rgba(0, 255, 255, 0.6);
                padding-left: 8px;
            `;
            efficiencyRow.innerHTML = '<span>◊ EFFICIENCY:</span><span id="efficiency" style="color: #00ffff; font-weight: bold;">100%</span>';
            this.efficiencyElement = efficiencyRow.querySelector('#efficiency');

            detailsSection.appendChild(generationRow);
            detailsSection.appendChild(consumptionRow);
            detailsSection.appendChild(efficiencyRow);
        }

        // Transaction history with SciFi styling
        if (this.config.showHistory) {
            this.transactionHistoryElement = document.createElement('div');
            this.transactionHistoryElement.style.cssText = `
                font-size: 9px;
                margin-top: 12px;
                border-top: 1px solid rgba(0, 255, 255, 0.4);
                padding-top: 8px;
                max-height: 120px;
                overflow-y: auto;
                font-family: 'Orbitron', monospace;
            `;
            
            const historyTitle = document.createElement('div');
            historyTitle.textContent = '◊ TRANSACTION LOG ◊';
            historyTitle.style.cssText = `
                font-weight: bold; 
                margin-bottom: 6px; 
                color: #00ffff;
                text-align: center;
                letter-spacing: 1px;
            `;
            this.transactionHistoryElement.appendChild(historyTitle);
        }

        // Assemble UI
        contentContainer.appendChild(energyHeader);
        contentContainer.appendChild(this.energyValueElement);
        contentContainer.appendChild(energyBarContainer);
        
        if (detailsSection) {
            contentContainer.appendChild(detailsSection);
        }
        
        if (this.transactionHistoryElement) {
            contentContainer.appendChild(this.transactionHistoryElement);
        }

        energyPanel.appendChild(contentContainer);
        this.container.appendChild(energyPanel);

        // Add CSS animations
        this.addSciFiAnimations();
    }

    /**
     * Add SciFi CSS animations
     */
    private addSciFiAnimations(): void {
        if (!document.querySelector('#scifi-energy-animations')) {
            const style = document.createElement('style');
            style.id = 'scifi-energy-animations';
            style.textContent = `
                @keyframes energyFlow {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }
                
                @keyframes energyPulse {
                    0%, 100% { 
                        box-shadow: 
                            0 0 20px rgba(0, 255, 255, 0.4),
                            inset 0 0 20px rgba(0, 255, 255, 0.1);
                    }
                    50% { 
                        box-shadow: 
                            0 0 30px rgba(0, 255, 255, 0.6),
                            inset 0 0 30px rgba(0, 255, 255, 0.2);
                    }
                }
                
                @keyframes textGlow {
                    0%, 100% { 
                        text-shadow: 
                            0 0 10px rgba(0, 255, 255, 0.8),
                            0 0 20px rgba(0, 255, 255, 0.4);
                    }
                    50% { 
                        text-shadow: 
                            0 0 15px rgba(0, 255, 255, 1),
                            0 0 30px rgba(0, 255, 255, 0.6);
                    }
                }
                
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0.3; }
                }
                
                .energy-panel {
                    animation: energyPulse 3s infinite ease-in-out;
                }
                
                .energy-panel:hover {
                    animation: energyPulse 1s infinite ease-in-out;
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