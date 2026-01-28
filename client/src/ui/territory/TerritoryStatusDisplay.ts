/**
 * TerritoryStatusDisplay - Status display components for territory UI
 *
 * Handles rendering of boundary, liberation, and queen status displays.
 */

import type { Territory } from '../../game/TerritoryManager';
import type { LiberationManager } from '../../game/LiberationManager';
import { QueenPhase } from '../../game/entities/Queen';
import type { TerritoryDisplayInfo, TerritoryVisualUIConfig } from './TerritoryVisualUIInterfaces';

export class TerritoryStatusDisplay {
    private boundaryIndicator: HTMLElement | null = null;
    private liberationDisplay: HTMLElement | null = null;
    private queenStatusDisplay: HTMLElement | null = null;
    private config: TerritoryVisualUIConfig;

    constructor(
        boundaryIndicator: HTMLElement | null,
        liberationDisplay: HTMLElement | null,
        queenStatusDisplay: HTMLElement | null,
        config: TerritoryVisualUIConfig
    ) {
        this.boundaryIndicator = boundaryIndicator;
        this.liberationDisplay = liberationDisplay;
        this.queenStatusDisplay = queenStatusDisplay;
        this.config = config;
    }

    public updateConfig(config: TerritoryVisualUIConfig): void {
        this.config = config;
    }

    public updateBoundaryIndicator(territory: Territory | null, getTerritoryDisplayInfo: (t: Territory) => TerritoryDisplayInfo): void {
        if (!this.boundaryIndicator || !this.config.showBoundaryIndicators) return;

        if (territory) {
            const territoryInfo = getTerritoryDisplayInfo(territory);

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

    public updateLiberationDisplay(territory: Territory | null, liberationManager: LiberationManager | null): void {
        if (!this.liberationDisplay || !this.config.showLiberationTimer) return;

        if (territory && territory.controlStatus === 'liberated') {
            const liberationStatus = liberationManager?.getLiberationStatus(territory.id);

            if (liberationStatus && liberationStatus.isLiberated) {
                const timeRemaining = liberationStatus.timeRemaining;
                const miningBonus = Math.round(liberationStatus.miningBonus * 100);
                const progress = 1 - (timeRemaining / 300);

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

    public updateQueenStatusDisplay(territory: Territory | null): void {
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

    public getTerritoryStatusText(territoryInfo: TerritoryDisplayInfo): string {
        switch (territoryInfo.territory.controlStatus) {
            case 'queen_controlled': return 'Queen Controlled';
            case 'liberated': return 'Liberated';
            case 'contested': return 'Contested';
            default: return 'Unknown';
        }
    }

    private getStatusClass(status: string): string {
        switch (status) {
            case 'queen_controlled': return 'status-queen-controlled';
            case 'liberated': return 'status-liberated';
            case 'contested': return 'status-contested';
            default: return '';
        }
    }

    private getPhaseClass(phase: QueenPhase): string {
        switch (phase) {
            case QueenPhase.UNDERGROUND_GROWTH: return 'phase-underground';
            case QueenPhase.HIVE_CONSTRUCTION: return 'phase-construction';
            case QueenPhase.ACTIVE_CONTROL: return 'phase-active';
            default: return '';
        }
    }

    private getPhaseDisplayName(phase: QueenPhase): string {
        switch (phase) {
            case QueenPhase.UNDERGROUND_GROWTH: return 'Growing';
            case QueenPhase.HIVE_CONSTRUCTION: return 'Building Hive';
            case QueenPhase.ACTIVE_CONTROL: return 'Active';
            default: return 'Unknown';
        }
    }

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

    private formatTerritoryCoords(territoryId: string): string {
        const match = territoryId.match(/territory_(-?\d+)_(-?\d+)/);
        if (match) {
            return `(${match[1]}, ${match[2]})`;
        }
        return territoryId;
    }

    private formatTime(seconds: number): string {
        if (seconds <= 0) {
            return '0:00';
        }

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}
