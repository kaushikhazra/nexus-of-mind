/**
 * TerritoryVisualUI - Territory boundary visualization and status indicators
 *
 * Provides visual feedback for territory boundaries, entry/exit notifications,
 * liberation timer countdown, and Queen status communication.
 *
 * Refactored to delegate to extracted modules for SOLID compliance.
 */

import { Vector3 } from '@babylonjs/core';
import type { TerritoryManager, Territory } from '../../game/TerritoryManager';
import type { LiberationManager } from '../../game/LiberationManager';
import type { QueenPhase } from '../../game/entities/Queen';
import type { TerritoryVisualUIConfig, TerritoryDisplayInfo } from './TerritoryVisualUIInterfaces';
import { DEFAULT_TERRITORY_UI_CONFIG } from './TerritoryVisualUIInterfaces';
import { injectTerritoryUIStyles } from './TerritoryUIStyles';
import { TerritoryStatusDisplay } from './TerritoryStatusDisplay';

export class TerritoryVisualUI {
    private territoryManager: TerritoryManager | null = null;
    private liberationManager: LiberationManager | null = null;
    private container: HTMLElement | null = null;
    private config: TerritoryVisualUIConfig;

    private mainContainer: HTMLElement | null = null;
    private boundaryIndicator: HTMLElement | null = null;
    private liberationDisplay: HTMLElement | null = null;
    private queenStatusDisplay: HTMLElement | null = null;
    private territoryEntryNotification: HTMLElement | null = null;

    private currentTerritoryId: string | null = null;
    private lastPlayerPosition: Vector3 | null = null;
    private territoryDisplays: Map<string, HTMLElement> = new Map();
    private statusDisplay: TerritoryStatusDisplay | null = null;

    private updateInterval: number | null = null;
    private isVisible: boolean = true;

    constructor(config: TerritoryVisualUIConfig) {
        this.config = { ...DEFAULT_TERRITORY_UI_CONFIG, ...config } as TerritoryVisualUIConfig;
        this.initialize();
    }

    private initialize(): void {
        this.container = document.getElementById(this.config.containerId);
        if (!this.container) return;

        this.createUI();
        this.startUpdates();
    }

    public setTerritoryManager(territoryManager: TerritoryManager): void {
        this.territoryManager = territoryManager;
        this.liberationManager = territoryManager.getLiberationManager();
    }

    public setPlayerPosition(position: Vector3): void {
        this.lastPlayerPosition = position;
        this.checkTerritoryEntry(position);
    }

    private createUI(): void {
        if (!this.container) return;

        this.container.innerHTML = '';

        this.mainContainer = document.createElement('div');
        this.mainContainer.className = 'territory-visual-ui';
        this.mainContainer.style.cssText = `
            position: fixed; top: 50%; left: 20px; transform: translateY(-50%);
            z-index: 900; display: flex; flex-direction: column; gap: 12px;
            max-width: 320px; font-family: 'Orbitron', monospace; pointer-events: none;
        `;

        this.territoryEntryNotification = document.createElement('div');
        this.territoryEntryNotification.className = 'territory-entry-notification';
        this.territoryEntryNotification.style.cssText = `
            position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
            z-index: 1100; background: rgba(0, 20, 40, 0.9); border: 2px solid rgba(0, 255, 255, 0.8);
            border-radius: 8px; padding: 12px 20px; font-family: 'Orbitron', monospace;
            color: #00ffff; font-size: 14px; font-weight: 700; text-align: center;
            backdrop-filter: blur(10px); box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
            opacity: 0; transition: all 0.5s ease; pointer-events: none;
        `;

        this.boundaryIndicator = this.createDisplayElement('rgba(0, 40, 80, 0.85)', 'rgba(0, 150, 255, 0.6)', 'rgba(0, 150, 255, 0.2)');
        this.liberationDisplay = this.createDisplayElement('rgba(0, 80, 0, 0.85)', 'rgba(0, 255, 0, 0.6)', 'rgba(0, 255, 0, 0.2)');
        this.queenStatusDisplay = this.createDisplayElement('rgba(80, 0, 80, 0.85)', 'rgba(255, 0, 255, 0.6)', 'rgba(255, 0, 255, 0.2)');

        this.mainContainer.appendChild(this.boundaryIndicator);
        this.mainContainer.appendChild(this.liberationDisplay);
        this.mainContainer.appendChild(this.queenStatusDisplay);

        this.container.appendChild(this.mainContainer);
        this.container.appendChild(this.territoryEntryNotification);

        injectTerritoryUIStyles();

        this.statusDisplay = new TerritoryStatusDisplay(
            this.boundaryIndicator,
            this.liberationDisplay,
            this.queenStatusDisplay,
            this.config
        );
    }

    private createDisplayElement(bg: string, border: string, shadow: string): HTMLElement {
        const el = document.createElement('div');
        el.style.cssText = `
            background: ${bg}; border: 1px solid ${border}; border-radius: 8px;
            padding: 10px 12px; backdrop-filter: blur(10px); box-shadow: 0 0 15px ${shadow};
            font-size: 11px; letter-spacing: 0.5px; min-width: 280px; display: none;
        `;
        return el;
    }

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

    private checkTerritoryEntry(playerPosition: Vector3): void {
        if (!this.territoryManager) return;

        const currentTerritory = this.territoryManager.getTerritoryAt(playerPosition.x, playerPosition.z);
        const newTerritoryId = currentTerritory?.id || null;

        if (newTerritoryId !== this.currentTerritoryId) {
            if (this.currentTerritoryId && !newTerritoryId) {
                this.showTerritoryNotification('Exited Territory', 'territory-exit');
            } else if (!this.currentTerritoryId && newTerritoryId) {
                const territoryInfo = this.getTerritoryDisplayInfo(currentTerritory!);
                this.showTerritoryNotification(
                    `Entered ${this.statusDisplay?.getTerritoryStatusText(territoryInfo) || 'Unknown'} Territory`,
                    'territory-enter'
                );
            } else if (this.currentTerritoryId && newTerritoryId && this.currentTerritoryId !== newTerritoryId) {
                const territoryInfo = this.getTerritoryDisplayInfo(currentTerritory!);
                this.showTerritoryNotification(
                    `Entered ${this.statusDisplay?.getTerritoryStatusText(territoryInfo) || 'Unknown'} Territory`,
                    'territory-change'
                );
            }

            this.currentTerritoryId = newTerritoryId;
        }
    }

    private showTerritoryNotification(message: string, type: string): void {
        if (!this.territoryEntryNotification) return;

        this.territoryEntryNotification.textContent = message;

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

        this.territoryEntryNotification.classList.add('show');
        this.territoryEntryNotification.classList.remove('hide');

        window.setTimeout(() => {
            if (this.territoryEntryNotification) {
                this.territoryEntryNotification.classList.add('hide');
                this.territoryEntryNotification.classList.remove('show');
            }
        }, 3000);
    }

    private updateDisplay(): void {
        if (!this.territoryManager || !this.lastPlayerPosition || !this.statusDisplay) return;

        const currentTerritory = this.territoryManager.getTerritoryAt(
            this.lastPlayerPosition.x,
            this.lastPlayerPosition.z
        );

        this.statusDisplay.updateBoundaryIndicator(currentTerritory, (t) => this.getTerritoryDisplayInfo(t));
        this.statusDisplay.updateLiberationDisplay(currentTerritory, this.liberationManager);
        this.statusDisplay.updateQueenStatusDisplay(currentTerritory);
    }

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
                queenStatus.hasQueen = true;
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

    public setVisible(visible: boolean): void {
        this.isVisible = visible;

        if (this.container) {
            this.container.style.display = visible ? 'block' : 'none';
        }
    }

    public updateConfig(newConfig: Partial<TerritoryVisualUIConfig>): void {
        this.config = { ...this.config, ...newConfig };

        if (this.statusDisplay) {
            this.statusDisplay.updateConfig(this.config);
        }

        if (newConfig.updateInterval) {
            this.startUpdates();
        }
    }

    public dispose(): void {
        if (this.updateInterval) {
            window.clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        this.territoryDisplays.clear();

        if (this.container) {
            this.container.innerHTML = '';
        }

        this.territoryManager = null;
        this.liberationManager = null;
    }
}
