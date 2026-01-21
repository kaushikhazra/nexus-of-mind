/**
 * QueenGrowthUI - Top-right display for Queen growth progress and status
 * 
 * Provides real-time Queen growth information with progress bars, generation tracking,
 * and smooth animations. Integrates with TerritoryManager to track all active Queens.
 */

import { TerritoryManager } from '../game/TerritoryManager';
import { Queen } from '../game/entities/Queen';

export interface QueenGrowthUIConfig {
    containerId: string;
    updateInterval?: number;
    showAllQueens?: boolean;
    maxDisplayQueens?: number;
}

export interface QueenDisplayInfo {
    queen: Queen;
    energy: {
        current: number;
        max: number;
    };
}

export class QueenGrowthUI {
    private territoryManager: TerritoryManager | null = null;
    private container: HTMLElement | null = null;
    private config: QueenGrowthUIConfig;
    
    // UI elements
    private mainContainer: HTMLElement | null = null;
    private queenDisplays: Map<string, HTMLElement> = new Map();
    
    // Update management
    private updateInterval: number | null = null;
    private lastUpdateTime: number = 0;
    private isVisible: boolean = true;

    // Energy display throttling (1-second updates)
    private lastEnergyUpdateTime: number = 0;
    private cachedEnergyValues: Map<string, { current: number; max: number }> = new Map();

    constructor(config: QueenGrowthUIConfig) {
        this.config = {
            updateInterval: 500, // Update every 0.5 seconds for smooth progress
            showAllQueens: true,
            maxDisplayQueens: 5, // Limit to prevent UI clutter
            ...config
        };
        
        this.initialize();
    }

    /**
     * Initialize the Queen growth UI
     */
    private initialize(): void {
        this.container = document.getElementById(this.config.containerId);

        if (!this.container) {
            console.error(`QueenGrowthUI: Container ${this.config.containerId} not found`);
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
        
        // Subscribe to Queen events if possible
        this.subscribeToQueenEvents();
    }

    /**
     * Create the main UI structure
     */
    private createUI(): void {
        if (!this.container) return;

        // Clear existing content
        this.container.innerHTML = '';
        
        // Main container for Queen displays
        this.mainContainer = document.createElement('div');
        this.mainContainer.className = 'queen-growth-ui';
        this.mainContainer.style.cssText = `
            position: fixed;
            top: 68px;
            right: 160px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-family: 'Orbitron', monospace;
            pointer-events: none;
        `;

        this.container.appendChild(this.mainContainer);
        this.addUIStyles();
    }

    /**
     * Add CSS styles for Queen energy UI
     */
    private addUIStyles(): void {
        if (!document.querySelector('#queen-growth-ui-styles')) {
            const style = document.createElement('style');
            style.id = 'queen-growth-ui-styles';
            style.textContent = `
                .queen-display {
                    height: 40px;
                    min-width: 120px;
                    background: rgba(0, 10, 20, 0.2);
                    border: 1px solid rgba(255, 70, 0, 0.4);
                    border-radius: 6px;
                    backdrop-filter: blur(8px);
                    box-shadow: 0 0 10px rgba(255, 70, 0, 0.15);
                    display: flex;
                    align-items: center;
                    padding: 6px 12px;
                    font-size: 12px;
                    color: #ff4500;
                    font-weight: bold;
                    letter-spacing: 0.5px;
                    text-shadow: 0 0 5px rgba(255, 70, 0, 0.6);
                }

                .fade-in {
                    animation: fadeIn 0.3s ease;
                }

                .fade-out {
                    animation: fadeOut 0.3s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
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
            (window as any).clearInterval(this.updateInterval);
        }

        this.updateInterval = (window as any).setInterval(() => {
            if (this.isVisible && this.territoryManager) {
                this.updateDisplay();
            }
        }, this.config.updateInterval);
    }

    /**
     * Subscribe to Queen events for real-time updates
     */
    private subscribeToQueenEvents(): void {
        // Note: This would require Queen event system to be implemented
        // For now, we rely on periodic updates
    }

    /**
     * Update the display with current Queen information
     */
    private updateDisplay(): void {
        if (!this.territoryManager || !this.mainContainer) return;

        const queens = this.territoryManager.getAllQueens();
        const activeQueenDisplays = new Set<string>();

        // Limit number of displayed Queens
        const displayQueens = queens.slice(0, this.config.maxDisplayQueens || 5);

        // Update or create displays for active Queens
        for (const queen of displayQueens) {
            const queenInfo = this.getQueenDisplayInfo(queen);
            if (queenInfo) {
                this.updateQueenDisplay(queenInfo);
                activeQueenDisplays.add(queen.id);
            }
        }

        // Remove displays for Queens that are no longer active
        for (const [queenId, displayElement] of this.queenDisplays) {
            if (!activeQueenDisplays.has(queenId)) {
                this.removeQueenDisplay(queenId);
            }
        }
    }

    /**
     * Get display information for a Queen
     */
    private getQueenDisplayInfo(queen: Queen): QueenDisplayInfo | null {
        try {
            const energy = this.getThrottledEnergyValues(queen);
            return { queen, energy };
        } catch (error) {
            console.error('Error getting Queen display info:', error);
            return null;
        }
    }

    /**
     * Get energy values with 1-second throttling
     */
    private getThrottledEnergyValues(queen: Queen): { current: number; max: number } {
        const now = performance.now();
        const timeSinceLastUpdate = now - this.lastEnergyUpdateTime;

        // Update energy values every 3 seconds (matches regen rate)
        if (timeSinceLastUpdate >= 3000) {
            this.lastEnergyUpdateTime = now;

            const energySystem = queen.getEnergySystem();
            const current = energySystem.getCurrentEnergy();
            const max = energySystem.getMaxEnergy();

            this.cachedEnergyValues.set(queen.id, { current, max });
            return { current, max };
        }

        // Return cached value if available
        const cached = this.cachedEnergyValues.get(queen.id);
        if (cached) {
            return cached;
        }

        // First time - fetch and cache
        const energySystem = queen.getEnergySystem();
        const current = energySystem.getCurrentEnergy();
        const max = energySystem.getMaxEnergy();

        this.cachedEnergyValues.set(queen.id, { current, max });
        return { current, max };
    }

    /**
     * Update or create display for a specific Queen
     */
    private updateQueenDisplay(queenInfo: QueenDisplayInfo): void {
        let displayElement = this.queenDisplays.get(queenInfo.queen.id);
        
        if (!displayElement) {
            displayElement = this.createQueenDisplay(queenInfo);
            this.queenDisplays.set(queenInfo.queen.id, displayElement);
            this.mainContainer!.appendChild(displayElement);
            displayElement.classList.add('fade-in');
        } else {
            this.updateQueenDisplayContent(displayElement, queenInfo);
        }
    }

    /**
     * Create a new Queen display element
     */
    private createQueenDisplay(queenInfo: QueenDisplayInfo): HTMLElement {
        const displayElement = document.createElement('div');
        displayElement.className = 'queen-display';
        displayElement.setAttribute('data-queen-id', queenInfo.queen.id);
        
        this.updateQueenDisplayContent(displayElement, queenInfo);
        
        return displayElement;
    }

    /**
     * Update the content of a Queen display element
     */
    private updateQueenDisplayContent(element: HTMLElement, queenInfo: QueenDisplayInfo): void {
        element.innerHTML = `Queen ⚡: ${Math.floor(queenInfo.energy.current)}/${queenInfo.energy.max}`;
    }

    /**
     * Remove Queen display
     */
    private removeQueenDisplay(queenId: string): void {
        const displayElement = this.queenDisplays.get(queenId);
        if (displayElement) {
            displayElement.classList.add('fade-out');

            (window as any).setTimeout(() => {
                if (displayElement.parentNode && displayElement.parentNode.removeChild) {
                    displayElement.parentNode.removeChild(displayElement);
                }
                this.queenDisplays.delete(queenId);
                this.cachedEnergyValues.delete(queenId);  // Clean up cached energy
            }, 500); // Match fade-out animation duration
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
    public updateConfig(newConfig: Partial<QueenGrowthUIConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        if (newConfig.updateInterval) {
            this.startUpdates();
        }
    }

    /**
     * Dispose Queen growth UI
     */
    public dispose(): void {
        if (this.updateInterval) {
            (window as any).clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        // Clear all Queen displays
        this.queenDisplays.clear();
        this.cachedEnergyValues.clear();

        if (this.container) {
            this.container.innerHTML = '';
        }

        this.territoryManager = null;
    }
}