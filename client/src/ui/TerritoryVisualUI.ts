/**
 * TerritoryVisualUI - Territory boundary visualization and status indicators
 * 
 * Provides visual feedback for territory boundaries, entry/exit notifications,
 * liberation timer countdown, and Queen status communication. Integrates with
 * TerritoryManager and LiberationManager for real-time territory status updates.
 */

import { TerritoryManager, Territory } from '../game/TerritoryManager';
import { LiberationManager } from '../game/LiberationManager';
import { Queen, QueenPhase } from '../game/entities/Queen';
import { Vector3 } from '@babylonjs/core';

export interface TerritoryVisualUIConfig {
    containerId: string;
    updateInterval?: number;
    showBoundaryIndicators?: boolean;
    showLiberationTimer?: boolean;
    showQueenStatus?: boolean;
    maxDisplayTerritories?: number;
}

export interface TerritoryDisplayInfo {
    territory: Territory;
    isPlayerInside: boolean;
    liberationStatus: {
        isLiberated: boolean;
        timeRemaining: number;
        miningBonus: number;
    };
    queenStatus: {
        hasQueen: boolean;
        phase: QueenPhase | null;
        isVulnerable: boolean;
        generation: number;
    };
    distanceFromPlayer: number;
}

export class TerritoryVisualUI {
    private territoryManager: TerritoryManager | null = null;
    private liberationManager: LiberationManager | null = null;
    private container: HTMLElement | null = null;
    private config: TerritoryVisualUIConfig;
    
    // UI elements
    private mainContainer: HTMLElement | null = null;
    private boundaryIndicator: HTMLElement | null = null;
    private liberationDisplay: HTMLElement | null = null;
    private queenStatusDisplay: HTMLElement | null = null;
    private territoryEntryNotification: HTMLElement | null = null;
    
    // State tracking
    private currentTerritoryId: string | null = null;
    private lastPlayerPosition: Vector3 | null = null;
    private territoryDisplays: Map<string, HTMLElement> = new Map();
    
    // Update management
    private updateInterval: number | null = null;
    private isVisible: boolean = true;

    constructor(config: TerritoryVisualUIConfig) {
        this.config = {
            updateInterval: 1000, // Update every 1 second
            showBoundaryIndicators: true,
            showLiberationTimer: true,
            showQueenStatus: true,
            maxDisplayTerritories: 3, // Show nearby territories
            ...config
        };
        
        this.initialize();
    }

    /**
     * Initialize the territory visual UI
     */
    private initialize(): void {
        this.container = document.getElementById(this.config.containerId);

        if (!this.container) {
            console.error(`TerritoryVisualUI: Container ${this.config.containerId} not found`);
            return;
        }

        this.createUI();
        this.startUpdates();
    }

    /**
     * Set territory manager reference
     */
    public setTerritoryManager(territoryManager: TerritoryManager): void {
        this.territoryManager = territoryManager;
        this.liberationManager = territoryManager.getLiberationManager();
    }

    /**
     * Set player position for territory tracking
     */
    public setPlayerPosition(position: Vector3): void {
        this.lastPlayerPosition = position;
        this.checkTerritoryEntry(position);
    }

    /**
     * Create the main UI structure
     */
    private createUI(): void {
        if (!this.container) return;

        // Clear existing content
        this.container.innerHTML = '';
        
        // Main container for territory visuals
        this.mainContainer = document.createElement('div');
        this.mainContainer.className = 'territory-visual-ui';
        this.mainContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 20px;
            transform: translateY(-50%);
            z-index: 900;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 320px;
            font-family: 'Orbitron', monospace;
            pointer-events: none;
        `;

        // Territory entry notification (top of screen)
        this.territoryEntryNotification = document.createElement('div');
        this.territoryEntryNotification.className = 'territory-entry-notification';
        this.territoryEntryNotification.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1100;
            background: rgba(0, 20, 40, 0.9);
            border: 2px solid rgba(0, 255, 255, 0.8);
            border-radius: 8px;
            padding: 12px 20px;
            font-family: 'Orbitron', monospace;
            color: #00ffff;
            font-size: 14px;
            font-weight: 700;
            text-align: center;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
            opacity: 0;
            transition: all 0.5s ease;
            pointer-events: none;
        `;

        // Boundary indicator (left side)
        this.boundaryIndicator = document.createElement('div');
        this.boundaryIndicator.className = 'boundary-indicator';
        this.boundaryIndicator.style.cssText = `
            background: rgba(0, 40, 80, 0.85);
            border: 1px solid rgba(0, 150, 255, 0.6);
            border-radius: 8px;
            padding: 10px 12px;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 15px rgba(0, 150, 255, 0.2);
            font-size: 11px;
            letter-spacing: 0.5px;
            min-width: 280px;
            display: none;
        `;

        // Liberation timer display
        this.liberationDisplay = document.createElement('div');
        this.liberationDisplay.className = 'liberation-display';
        this.liberationDisplay.style.cssText = `
            background: rgba(0, 80, 0, 0.85);
            border: 1px solid rgba(0, 255, 0, 0.6);
            border-radius: 8px;
            padding: 10px 12px;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.2);
            font-size: 11px;
            letter-spacing: 0.5px;
            min-width: 280px;
            display: none;
        `;

        // Queen status display
        this.queenStatusDisplay = document.createElement('div');
        this.queenStatusDisplay.className = 'queen-status-display';
        this.queenStatusDisplay.style.cssText = `
            background: rgba(80, 0, 80, 0.85);
            border: 1px solid rgba(255, 0, 255, 0.6);
            border-radius: 8px;
            padding: 10px 12px;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 15px rgba(255, 0, 255, 0.2);
            font-size: 11px;
            letter-spacing: 0.5px;
            min-width: 280px;
            display: none;
        `;

        // Assemble UI
        this.mainContainer.appendChild(this.boundaryIndicator);
        this.mainContainer.appendChild(this.liberationDisplay);
        this.mainContainer.appendChild(this.queenStatusDisplay);
        
        this.container.appendChild(this.mainContainer);
        this.container.appendChild(this.territoryEntryNotification);

        this.addUIStyles();
    }

    /**
     * Add CSS styles for territory visual UI
     */
    private addUIStyles(): void {
        if (!document.querySelector('#territory-visual-ui-styles')) {
            const style = document.createElement('style');
            style.id = 'territory-visual-ui-styles';
            style.textContent = `
                .territory-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    font-weight: 700;
                    font-size: 12px;
                }

                .territory-coords {
                    color: #aaaaaa;
                    font-size: 10px;
                    font-weight: 600;
                }

                .territory-status {
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .status-queen-controlled {
                    background: rgba(255, 0, 0, 0.8);
                    color: #fff;
                    border: 1px solid rgba(255, 0, 0, 0.6);
                    animation: pulse-danger 2s infinite;
                }

                .status-liberated {
                    background: rgba(0, 255, 0, 0.8);
                    color: #fff;
                    border: 1px solid rgba(0, 255, 0, 0.6);
                    animation: pulse-safe 3s infinite;
                }

                .status-contested {
                    background: rgba(255, 165, 0, 0.8);
                    color: #fff;
                    border: 1px solid rgba(255, 165, 0, 0.6);
                }

                .liberation-timer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin: 8px 0;
                }

                .timer-display {
                    font-size: 16px;
                    font-weight: 700;
                    color: #00ff00;
                    text-shadow: 0 0 8px rgba(0, 255, 0, 0.8);
                }

                .mining-bonus {
                    font-size: 10px;
                    color: #ffff00;
                    font-weight: 600;
                }

                .queen-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin: 6px 0;
                }

                .queen-phase {
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .phase-underground {
                    background: rgba(139, 69, 19, 0.8);
                    color: #deb887;
                    border: 1px solid rgba(139, 69, 19, 0.6);
                }

                .phase-construction {
                    background: rgba(255, 165, 0, 0.8);
                    color: #fff;
                    border: 1px solid rgba(255, 165, 0, 0.6);
                }

                .phase-active {
                    background: rgba(255, 0, 0, 0.8);
                    color: #fff;
                    border: 1px solid rgba(255, 0, 0, 0.6);
                    animation: pulse-danger 1.5s infinite;
                }

                .vulnerability-status {
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 600;
                }

                .vulnerable {
                    background: rgba(255, 0, 0, 0.8);
                    color: #fff;
                    animation: pulse-danger 1s infinite;
                }

                .invulnerable {
                    background: rgba(0, 100, 0, 0.8);
                    color: #fff;
                }

                .territory-entry-notification.show {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }

                .territory-entry-notification.hide {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-20px);
                }

                @keyframes pulse-danger {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }

                @keyframes pulse-safe {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.8; }
                }

                .fade-in {
                    animation: fadeIn 0.5s ease;
                }

                .fade-out {
                    animation: fadeOut 0.5s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateX(-20px); }
                    to { opacity: 1; transform: translateX(0); }
                }

                @keyframes fadeOut {
                    from { opacity: 1; transform: translateX(0); }
                    to { opacity: 0; transform: translateX(-20px); }
                }

                .progress-bar {
                    width: 100%;
                    height: 4px;
                    background: rgba(0, 0, 0, 0.6);
                    border-radius: 2px;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    margin: 4px 0;
                }

                .progress-fill {
                    height: 100%;
                    transition: width 0.5s ease;
                    border-radius: 1px;
                }

                .progress-liberation {
                    background: linear-gradient(90deg, 
                        rgba(0, 255, 0, 0.8) 0%, 
                        rgba(0, 255, 255, 0.8) 100%);
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
            window.clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        this.updateInterval = window.setInterval(() => {
            if (this.isVisible && this.territoryManager && this.lastPlayerPosition) {
                this.updateDisplay();
            }
        }, this.config.updateInterval);
    }

    /**
     * Check for territory entry/exit
     */
    private checkTerritoryEntry(playerPosition: Vector3): void {
        if (!this.territoryManager) return;

        const currentTerritory = this.territoryManager.getTerritoryAt(playerPosition.x, playerPosition.z);
        const newTerritoryId = currentTerritory?.id || null;

        // Check if player entered or exited a territory
        if (newTerritoryId !== this.currentTerritoryId) {
            if (this.currentTerritoryId && !newTerritoryId) {
                // Exited territory
                this.showTerritoryNotification('Exited Territory', 'territory-exit');
                setTimeout(() => {
                    // Additional exit processing if needed
                }, 100);
            } else if (!this.currentTerritoryId && newTerritoryId) {
                // Entered territory
                const territoryInfo = this.getTerritoryDisplayInfo(currentTerritory!);
                this.showTerritoryNotification(
                    `Entered ${this.getTerritoryStatusText(territoryInfo)} Territory`,
                    'territory-enter'
                );
            } else if (this.currentTerritoryId && newTerritoryId && this.currentTerritoryId !== newTerritoryId) {
                // Moved between territories
                const territoryInfo = this.getTerritoryDisplayInfo(currentTerritory!);
                this.showTerritoryNotification(
                    `Entered ${this.getTerritoryStatusText(territoryInfo)} Territory`,
                    'territory-change'
                );
                setTimeout(() => {
                    // Additional territory change processing if needed
                }, 100);
            }

            this.currentTerritoryId = newTerritoryId;
        }
    }

    /**
     * Show territory entry/exit notification
     */
    private showTerritoryNotification(message: string, type: string): void {
        if (!this.territoryEntryNotification) return;

        // Set message and styling based on type
        this.territoryEntryNotification.textContent = message;
        
        // Update styling based on notification type
        let borderColor = 'rgba(0, 255, 255, 0.8)';
        let textColor = '#00ffff';
        
        if (type === 'territory-exit') {
            borderColor = 'rgba(0, 255, 0, 0.8)';
            textColor = '#00ff00';
        } else if (type.includes('Queen Controlled')) {
            borderColor = 'rgba(255, 0, 0, 0.8)';
            textColor = '#ff4444';
        } else if (type.includes('Liberated')) {
            borderColor = 'rgba(0, 255, 0, 0.8)';
            textColor = '#00ff00';
        }

        this.territoryEntryNotification.style.borderColor = borderColor;
        this.territoryEntryNotification.style.color = textColor;

        // Show notification
        this.territoryEntryNotification.classList.add('show');
        this.territoryEntryNotification.classList.remove('hide');

        // Hide after 3 seconds
        window.setTimeout(() => {
            if (this.territoryEntryNotification) {
                this.territoryEntryNotification.classList.add('hide');
                this.territoryEntryNotification.classList.remove('show');
            }
        }, 3000);
    }

    /**
     * Update the display with current territory information
     */
    private updateDisplay(): void {
        if (!this.territoryManager || !this.lastPlayerPosition) return;

        // Get current territory
        const currentTerritory = this.territoryManager.getTerritoryAt(
            this.lastPlayerPosition.x, 
            this.lastPlayerPosition.z
        );

        // Update boundary indicator
        this.updateBoundaryIndicator(currentTerritory);

        // Update liberation display
        this.updateLiberationDisplay(currentTerritory);

        // Update Queen status display
        this.updateQueenStatusDisplay(currentTerritory);
    }

    /**
     * Update boundary indicator
     */
    private updateBoundaryIndicator(territory: Territory | null): void {
        if (!this.boundaryIndicator || !this.config.showBoundaryIndicators) return;

        if (territory) {
            const territoryInfo = this.getTerritoryDisplayInfo(territory);
            
            this.boundaryIndicator.innerHTML = `
                <div class="territory-header">
                    <span style="color: #00aaff;">🗺️ Territory</span>
                    <span class="territory-coords">${this.formatTerritoryCoords(territory.id)}</span>
                </div>
                
                <div class="territory-status ${this.getStatusClass(territory.controlStatus)}">
                    ${this.getTerritoryStatusText(territoryInfo)}
                </div>
                
                <div style="margin-top: 6px; font-size: 10px; color: #cccccc;">
                    Size: ${territory.size}x${territory.size} units
                </div>
            `;
            
            this.boundaryIndicator.style.display = 'block';
        } else {
            this.boundaryIndicator.style.display = 'none';
        }
    }

    /**
     * Update liberation display
     */
    private updateLiberationDisplay(territory: Territory | null): void {
        if (!this.liberationDisplay || !this.config.showLiberationTimer) return;

        if (territory && territory.controlStatus === 'liberated') {
            const liberationStatus = this.liberationManager?.getLiberationStatus(territory.id);
            
            if (liberationStatus && liberationStatus.isLiberated) {
                const timeRemaining = liberationStatus.timeRemaining;
                const miningBonus = Math.round(liberationStatus.miningBonus * 100);
                const progress = 1 - (timeRemaining / 300); // Assuming max 5 minutes
                
                this.liberationDisplay.innerHTML = `
                    <div class="territory-header">
                        <span style="color: #00ff00;">🕊️ Territory Liberated</span>
                    </div>
                    
                    <div class="liberation-timer">
                        <span class="timer-display">${this.formatTime(timeRemaining)}</span>
                        <span class="mining-bonus">+${miningBonus}% Mining</span>
                    </div>
                    
                    <div class="progress-bar">
                        <div class="progress-fill progress-liberation" style="width: ${progress * 100}%"></div>
                    </div>
                    
                    <div style="font-size: 10px; color: #aaffaa; text-align: center;">
                        Safe mining period - No parasites will spawn
                    </div>
                `;
                
                this.liberationDisplay.style.display = 'block';
            } else {
                this.liberationDisplay.style.display = 'none';
            }
        } else {
            this.liberationDisplay.style.display = 'none';
        }
    }

    /**
     * Update Queen status display
     */
    private updateQueenStatusDisplay(territory: Territory | null): void {
        if (!this.queenStatusDisplay || !this.config.showQueenStatus) return;

        if (territory && territory.queen) {
            try {
                const queen = territory.queen;
                const stats = queen.getStats();
                
                this.queenStatusDisplay.innerHTML = `
                    <div class="territory-header">
                        <span style="color: #ff00ff;">👑 Queen Status</span>
                        <span class="territory-coords">Gen ${stats.generation}</span>
                    </div>
                    
                    <div class="queen-info">
                        <div class="queen-phase ${this.getPhaseClass(stats.currentPhase)}">
                            ${this.getPhaseDisplayName(stats.currentPhase)}
                        </div>
                        <div class="vulnerability-status ${stats.isVulnerable ? 'vulnerable' : 'invulnerable'}">
                            ${stats.isVulnerable ? 'VULNERABLE' : 'PROTECTED'}
                        </div>
                    </div>
                    
                    <div style="font-size: 10px; color: #ffaaff; margin-top: 4px;">
                        ${this.getQueenStatusDescription(stats.currentPhase, stats.isVulnerable)}
                    </div>
                `;
                
                this.queenStatusDisplay.style.display = 'block';
            } catch (error) {
                // Handle Queen stats error gracefully
                this.queenStatusDisplay.innerHTML = `
                    <div class="territory-header">
                        <span style="color: #ff00ff;">👑 Queen Status</span>
                    </div>
                    
                    <div class="queen-phase phase-active">
                        Queen Present
                    </div>
                    
                    <div style="font-size: 10px; color: #ffaaff; margin-top: 4px;">
                        Queen detected - Status unavailable
                    </div>
                `;
                
                this.queenStatusDisplay.style.display = 'block';
            }
        } else if (territory && territory.controlStatus === 'queen_controlled') {
            // Territory is Queen controlled but Queen not visible (underground growth)
            this.queenStatusDisplay.innerHTML = `
                <div class="territory-header">
                    <span style="color: #ff00ff;">👑 Queen Status</span>
                </div>
                
                <div class="queen-phase phase-underground">
                    Growing Underground
                </div>
                
                <div style="font-size: 10px; color: #ffaaff; margin-top: 4px;">
                    Queen is regenerating underground - Invulnerable
                </div>
            `;
            
            this.queenStatusDisplay.style.display = 'block';
        } else {
            this.queenStatusDisplay.style.display = 'none';
        }
    }

    /**
     * Get territory display information
     */
    private getTerritoryDisplayInfo(territory: Territory): TerritoryDisplayInfo {
        const liberationStatus = this.liberationManager?.getLiberationStatus(territory.id) || {
            isLiberated: territory.controlStatus === 'liberated',
            timeRemaining: territory.liberationTimer,
            miningBonus: territory.controlStatus === 'liberated' ? 0.25 : 0
        };

        let queenStatus = {
            hasQueen: false,
            phase: null as QueenPhase | null,
            isVulnerable: false,
            generation: 0
        };

        if (territory.queen) {
            try {
                const stats = territory.queen.getStats();
                queenStatus = {
                    hasQueen: true,
                    phase: stats.currentPhase,
                    isVulnerable: stats.isVulnerable,
                    generation: stats.generation
                };
            } catch (error) {
                console.warn('Error getting Queen stats:', error);
                queenStatus.hasQueen = true; // Queen exists but stats unavailable
            }
        }

        return {
            territory,
            isPlayerInside: territory.id === this.currentTerritoryId,
            liberationStatus,
            queenStatus,
            distanceFromPlayer: this.lastPlayerPosition ? 
                Vector3.Distance(this.lastPlayerPosition, territory.centerPosition) : 0
        };
    }

    /**
     * Get territory status text
     */
    private getTerritoryStatusText(territoryInfo: TerritoryDisplayInfo): string {
        switch (territoryInfo.territory.controlStatus) {
            case 'queen_controlled':
                return 'Queen Controlled';
            case 'liberated':
                return 'Liberated';
            case 'contested':
                return 'Contested';
            default:
                return 'Unknown';
        }
    }

    /**
     * Get CSS class for territory status
     */
    private getStatusClass(status: string): string {
        switch (status) {
            case 'queen_controlled':
                return 'status-queen-controlled';
            case 'liberated':
                return 'status-liberated';
            case 'contested':
                return 'status-contested';
            default:
                return '';
        }
    }

    /**
     * Get CSS class for Queen phase
     */
    private getPhaseClass(phase: QueenPhase): string {
        switch (phase) {
            case QueenPhase.UNDERGROUND_GROWTH:
                return 'phase-underground';
            case QueenPhase.HIVE_CONSTRUCTION:
                return 'phase-construction';
            case QueenPhase.ACTIVE_CONTROL:
                return 'phase-active';
            default:
                return '';
        }
    }

    /**
     * Get display name for Queen phase
     */
    private getPhaseDisplayName(phase: QueenPhase): string {
        switch (phase) {
            case QueenPhase.UNDERGROUND_GROWTH:
                return 'Growing';
            case QueenPhase.HIVE_CONSTRUCTION:
                return 'Building Hive';
            case QueenPhase.ACTIVE_CONTROL:
                return 'Active';
            default:
                return 'Unknown';
        }
    }

    /**
     * Get Queen status description
     */
    private getQueenStatusDescription(phase: QueenPhase, isVulnerable: boolean): string {
        switch (phase) {
            case QueenPhase.UNDERGROUND_GROWTH:
                return 'Queen is regenerating underground - Cannot be attacked';
            case QueenPhase.HIVE_CONSTRUCTION:
                return 'Hive is being constructed - Queen still protected';
            case QueenPhase.ACTIVE_CONTROL:
                return isVulnerable ? 
                    'Queen is vulnerable - Hive can be attacked!' : 
                    'Queen is active but protected';
            default:
                return 'Queen status unknown';
        }
    }

    /**
     * Format territory coordinates for display
     */
    private formatTerritoryCoords(territoryId: string): string {
        const match = territoryId.match(/territory_(-?\d+)_(-?\d+)/);
        if (match) {
            return `(${match[1]}, ${match[2]})`;
        }
        return territoryId;
    }

    /**
     * Format time for display
     */
    private formatTime(seconds: number): string {
        if (seconds <= 0) {
            return '0:00';
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
    public updateConfig(newConfig: Partial<TerritoryVisualUIConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        if (newConfig.updateInterval) {
            this.startUpdates();
        }
    }

    /**
     * Dispose territory visual UI
     */
    public dispose(): void {
        if (this.updateInterval) {
            window.clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        // Clear all territory displays
        this.territoryDisplays.clear();

        if (this.container) {
            this.container.innerHTML = '';
        }

        this.territoryManager = null;
        this.liberationManager = null;
    }
}