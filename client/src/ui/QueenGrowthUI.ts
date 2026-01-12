/**
 * QueenGrowthUI - Top-right display for Queen growth progress and status
 * 
 * Provides real-time Queen growth information with progress bars, generation tracking,
 * and smooth animations. Integrates with TerritoryManager to track all active Queens.
 */

import { TerritoryManager } from '../game/TerritoryManager';
import { Queen, QueenPhase } from '../game/entities/Queen';

export interface QueenGrowthUIConfig {
    containerId: string;
    updateInterval?: number;
    showAllQueens?: boolean;
    maxDisplayQueens?: number;
}

export interface QueenDisplayInfo {
    queen: Queen;
    territoryId: string;
    generation: number;
    phase: QueenPhase;
    progress: number;
    timeRemaining: number;
    isVulnerable: boolean;
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
            top: 20px;
            right: 20px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-width: 280px;
            font-family: 'Orbitron', monospace;
            pointer-events: none;
        `;

        this.container.appendChild(this.mainContainer);
        this.addUIStyles();
    }

    /**
     * Add CSS styles for Queen growth UI
     */
    private addUIStyles(): void {
        if (!document.querySelector('#queen-growth-ui-styles')) {
            const style = document.createElement('style');
            style.id = 'queen-growth-ui-styles';
            style.textContent = `
                .queen-display {
                    background: rgba(20, 0, 40, 0.85);
                    border: 1px solid rgba(255, 0, 255, 0.6);
                    border-radius: 8px;
                    padding: 10px 12px;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 0 15px rgba(255, 0, 255, 0.2);
                    transition: all 0.3s ease;
                    font-size: 11px;
                    letter-spacing: 0.5px;
                    min-width: 260px;
                }

                .queen-display:hover {
                    background: rgba(30, 0, 50, 0.9);
                    box-shadow: 0 0 25px rgba(255, 0, 255, 0.4);
                    transform: translateX(-5px);
                }

                .queen-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                    color: #ff00ff;
                    font-weight: 700;
                    font-size: 12px;
                }

                .queen-generation {
                    color: #ffaa00;
                    font-size: 10px;
                    font-weight: 600;
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
                    animation: pulse-danger 2s infinite;
                }

                .progress-container {
                    margin: 6px 0;
                }

                .progress-label {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 4px;
                    font-size: 10px;
                    color: #cccccc;
                }

                .progress-bar {
                    width: 100%;
                    height: 6px;
                    background: rgba(0, 0, 0, 0.6);
                    border-radius: 3px;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }

                .progress-fill {
                    height: 100%;
                    transition: width 0.5s ease;
                    border-radius: 2px;
                }

                .progress-underground {
                    background: linear-gradient(90deg, 
                        rgba(139, 69, 19, 0.8) 0%, 
                        rgba(210, 180, 140, 0.8) 100%);
                }

                .progress-construction {
                    background: linear-gradient(90deg, 
                        rgba(255, 165, 0, 0.8) 0%, 
                        rgba(255, 215, 0, 0.8) 100%);
                }

                .progress-active {
                    background: linear-gradient(90deg, 
                        rgba(255, 0, 0, 0.8) 0%, 
                        rgba(255, 100, 100, 0.8) 100%);
                }

                .queen-stats {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 10px;
                    color: #aaaaaa;
                    margin-top: 4px;
                }

                .vulnerability-indicator {
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 600;
                }

                .vulnerable {
                    background: rgba(255, 0, 0, 0.8);
                    color: #fff;
                    animation: pulse-danger 1.5s infinite;
                }

                .invulnerable {
                    background: rgba(0, 100, 0, 0.8);
                    color: #fff;
                }

                @keyframes pulse-danger {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }

                .fade-in {
                    animation: fadeIn 0.5s ease;
                }

                .fade-out {
                    animation: fadeOut 0.5s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }

                @keyframes fadeOut {
                    from { opacity: 1; transform: translateX(0); }
                    to { opacity: 0; transform: translateX(20px); }
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
            const stats = queen.getStats();
            const territory = queen.getTerritory();
            
            // Calculate progress and time remaining based on phase
            let progress = 0;
            let timeRemaining = 0;
            
            switch (stats.currentPhase) {
                case QueenPhase.UNDERGROUND_GROWTH:
                    progress = stats.growthProgress;
                    // Estimate time remaining based on growth progress
                    const totalGrowthTime = 90; // Average of 60-120 seconds
                    timeRemaining = (1 - progress) * totalGrowthTime;
                    break;
                    
                case QueenPhase.HIVE_CONSTRUCTION:
                    // For construction, we need to get hive construction progress
                    const hive = queen.getHive();
                    if (hive) {
                        const hiveStats = hive.getStats();
                        progress = hiveStats.constructionProgress;
                        const avgConstructionTime = 12.5; // Average of 10-15 seconds
                        timeRemaining = (1 - progress) * avgConstructionTime;
                    } else {
                        progress = 0;
                        timeRemaining = 12.5;
                    }
                    break;
                    
                case QueenPhase.ACTIVE_CONTROL:
                    progress = 1.0; // Fully active
                    timeRemaining = 0;
                    break;
            }

            return {
                queen,
                territoryId: territory.id,
                generation: stats.generation,
                phase: stats.currentPhase,
                progress: Math.max(0, Math.min(1, progress)),
                timeRemaining: Math.max(0, timeRemaining),
                isVulnerable: stats.isVulnerable
            };
        } catch (error) {
            console.error('Error getting Queen display info:', error);
            return null;
        }
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
        const phaseClass = this.getPhaseClass(queenInfo.phase);
        const progressClass = this.getProgressClass(queenInfo.phase);
        
        element.innerHTML = `
            <div class="queen-header">
                <span>👑 Queen ${queenInfo.generation}</span>
                <span class="queen-generation">Gen ${queenInfo.generation}</span>
            </div>
            
            <div class="queen-phase ${phaseClass}">
                ${this.getPhaseDisplayName(queenInfo.phase)}
            </div>
            
            <div class="progress-container">
                <div class="progress-label">
                    <span>${this.getProgressLabel(queenInfo.phase)}</span>
                    <span>${this.formatTimeRemaining(queenInfo.timeRemaining)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${progressClass}" style="width: ${queenInfo.progress * 100}%"></div>
                </div>
            </div>
            
            <div class="queen-stats">
                <span>Territory: ${this.formatTerritoryId(queenInfo.territoryId)}</span>
                <span class="vulnerability-indicator ${queenInfo.isVulnerable ? 'vulnerable' : 'invulnerable'}">
                    ${queenInfo.isVulnerable ? 'VULNERABLE' : 'PROTECTED'}
                </span>
            </div>
        `;
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
     * Get CSS class for progress bar
     */
    private getProgressClass(phase: QueenPhase): string {
        switch (phase) {
            case QueenPhase.UNDERGROUND_GROWTH:
                return 'progress-underground';
            case QueenPhase.HIVE_CONSTRUCTION:
                return 'progress-construction';
            case QueenPhase.ACTIVE_CONTROL:
                return 'progress-active';
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
                return 'Growing Underground';
            case QueenPhase.HIVE_CONSTRUCTION:
                return 'Building Hive';
            case QueenPhase.ACTIVE_CONTROL:
                return 'Active Control';
            default:
                return 'Unknown Phase';
        }
    }

    /**
     * Get progress label for Queen phase
     */
    private getProgressLabel(phase: QueenPhase): string {
        switch (phase) {
            case QueenPhase.UNDERGROUND_GROWTH:
                return 'Growth Progress';
            case QueenPhase.HIVE_CONSTRUCTION:
                return 'Construction Progress';
            case QueenPhase.ACTIVE_CONTROL:
                return 'Fully Active';
            default:
                return 'Progress';
        }
    }

    /**
     * Format time remaining display
     */
    private formatTimeRemaining(seconds: number): string {
        if (seconds <= 0) {
            return 'Complete';
        }
        
        if (seconds < 60) {
            return `${Math.ceil(seconds)}s`;
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.ceil(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    }

    /**
     * Format territory ID for display
     */
    private formatTerritoryId(territoryId: string): string {
        // Extract coordinates from territory ID (e.g., "territory_0_1" -> "0,1")
        const match = territoryId.match(/territory_(-?\d+)_(-?\d+)/);
        if (match) {
            return `${match[1]},${match[2]}`;
        }
        return territoryId;
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

        if (this.container) {
            this.container.innerHTML = '';
        }

        this.territoryManager = null;
    }
}