/**
 * EnergyDisplay - Basic energy UI display for current energy levels
 * 
 * Provides real-time energy information display with efficient updates
 * and integration with the energy management system.
 */

import { EnergyManager, EnergyStats } from '../game/EnergyManager';
import { QueenEnergySystem } from '../game/systems/QueenEnergySystem';
import { ParasiteManager } from '../game/ParasiteManager';
import { ParasiteType } from '../game/types/ParasiteTypes';

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

    // Queen stats UI elements
    private queenStatsContainer: HTMLElement | null = null;
    private queenEnergyElement: HTMLElement | null = null;
    private queenEnergyBarElement: HTMLElement | null = null;
    private energyParasiteCountElement: HTMLElement | null = null;
    private combatParasiteCountElement: HTMLElement | null = null;

    // Queen system references
    private queenEnergySystem: QueenEnergySystem | null = null;
    private parasiteManager: ParasiteManager | null = null;
    
    // Update management
    private updateInterval: number | null = null;
    private lastUpdateTime: number = 0;
    private isVisible: boolean = true;

    constructor(config: EnergyDisplayConfig) {
        this.config = {
            updateInterval: 1000, // Update every 1 second
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

        // Create Queen stats section (initially hidden until systems are set)
        this.createQueenStatsUI();

        // Add minimal CSS animations
        this.addMinimalAnimations();
    }

    /**
     * Create Queen stats UI section
     */
    private createQueenStatsUI(): void {
        if (!this.container) return;

        this.queenStatsContainer = document.createElement('div');
        this.queenStatsContainer.className = 'queen-stats-hud';
        this.queenStatsContainer.style.cssText = `
            background: rgba(20, 0, 10, 0.3);
            border: 1px solid rgba(255, 100, 100, 0.4);
            border-radius: 6px;
            padding: 6px 12px;
            font-family: 'Orbitron', monospace;
            color: #ff6666;
            backdrop-filter: blur(8px);
            box-shadow: 0 0 10px rgba(255, 100, 100, 0.15);
            font-size: 11px;
            letter-spacing: 0.5px;
            margin-top: 6px;
            display: none;
        `;

        // Queen energy bar
        const queenEnergyBarContainer = document.createElement('div');
        queenEnergyBarContainer.style.cssText = `
            width: 100%;
            height: 3px;
            background: rgba(0, 0, 0, 0.4);
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 6px;
        `;

        this.queenEnergyBarElement = document.createElement('div');
        this.queenEnergyBarElement.style.cssText = `
            height: 100%;
            background: linear-gradient(90deg,
                rgba(255, 50, 50, 0.8) 0%,
                rgba(255, 150, 50, 0.8) 50%,
                rgba(255, 200, 50, 0.8) 100%);
            width: 50%;
            transition: width 0.3s ease;
        `;
        queenEnergyBarContainer.appendChild(this.queenEnergyBarElement);

        // Stats line
        const statsLine = document.createElement('div');
        statsLine.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
        `;

        // Label
        const labelSpan = document.createElement('span');
        labelSpan.style.cssText = 'color: #ff8888; font-size: 10px;';
        labelSpan.textContent = 'QUEEN';

        // Queen energy
        this.queenEnergyElement = document.createElement('span');
        this.queenEnergyElement.style.cssText = `
            font-size: 12px;
            font-weight: 700;
            color: #ffaa00;
            text-shadow: 0 0 6px rgba(255, 170, 0, 0.6);
        `;
        this.queenEnergyElement.textContent = '50/100';

        // Energy parasites
        const energyParasiteContainer = document.createElement('span');
        energyParasiteContainer.style.cssText = 'color: #ffcc00;';
        energyParasiteContainer.innerHTML = '⚡';
        this.energyParasiteCountElement = document.createElement('span');
        this.energyParasiteCountElement.style.cssText = 'font-weight: 600; margin-left: 2px;';
        this.energyParasiteCountElement.textContent = '0';
        energyParasiteContainer.appendChild(this.energyParasiteCountElement);

        // Combat parasites
        const combatParasiteContainer = document.createElement('span');
        combatParasiteContainer.style.cssText = 'color: #ff4444;';
        combatParasiteContainer.innerHTML = '⚔';
        this.combatParasiteCountElement = document.createElement('span');
        this.combatParasiteCountElement.style.cssText = 'font-weight: 600; margin-left: 2px;';
        this.combatParasiteCountElement.textContent = '0';
        combatParasiteContainer.appendChild(this.combatParasiteCountElement);

        // Assemble
        statsLine.appendChild(labelSpan);
        statsLine.appendChild(this.queenEnergyElement);
        statsLine.appendChild(energyParasiteContainer);
        statsLine.appendChild(combatParasiteContainer);

        this.queenStatsContainer.appendChild(queenEnergyBarContainer);
        this.queenStatsContainer.appendChild(statsLine);
        this.container.appendChild(this.queenStatsContainer);
    }

    /**
     * Set Queen energy system and parasite manager for display
     */
    public setQueenSystems(queenEnergySystem: QueenEnergySystem, parasiteManager: ParasiteManager): void {
        this.queenEnergySystem = queenEnergySystem;
        this.parasiteManager = parasiteManager;

        // Show Queen stats container
        if (this.queenStatsContainer) {
            this.queenStatsContainer.style.display = 'block';
        }

        console.log('[EnergyDisplay] Queen systems connected - showing Queen stats');
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
     * Event updates are throttled to avoid excessive UI updates
     */
    private subscribeToEnergyEvents(): void {
        // Throttle energy change events - only update if 1 second has passed
        this.energyManager.onEnergyChange((stats: EnergyStats) => {
            const now = performance.now();
            if (now - this.lastUpdateTime >= 1000) {
                this.updateDisplayWithStats(stats);
                this.lastUpdateTime = now;
            }
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
        this.updateQueenStats();
    }

    /**
     * Update Queen stats display
     */
    private updateQueenStats(): void {
        if (!this.queenEnergySystem || !this.parasiteManager) return;

        // Update Queen energy
        const energyState = this.queenEnergySystem.getState();
        if (this.queenEnergyElement) {
            this.queenEnergyElement.textContent = `${Math.round(energyState.currentEnergy)}/${energyState.maxEnergy}`;

            // Color based on energy level
            if (energyState.normalizedEnergy < 0.2) {
                this.queenEnergyElement.style.color = '#ff4444';
            } else if (energyState.normalizedEnergy < 0.5) {
                this.queenEnergyElement.style.color = '#ffaa00';
            } else {
                this.queenEnergyElement.style.color = '#ffdd00';
            }
        }

        // Update Queen energy bar
        if (this.queenEnergyBarElement) {
            this.queenEnergyBarElement.style.width = `${energyState.normalizedEnergy * 100}%`;
        }

        // Update parasite counts
        if (this.energyParasiteCountElement) {
            const energyCount = this.parasiteManager.getParasiteCountByType(ParasiteType.ENERGY);
            this.energyParasiteCountElement.textContent = String(energyCount);
        }

        if (this.combatParasiteCountElement) {
            const combatCount = this.parasiteManager.getParasiteCountByType(ParasiteType.COMBAT);
            this.combatParasiteCountElement.textContent = String(combatCount);
        }
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