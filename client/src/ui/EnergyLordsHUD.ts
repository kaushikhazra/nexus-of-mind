/**
 * EnergyLordsHUD - Progress display for Energy Lords progression system
 *
 * Shows current title, tier progress, energy threshold target, sustained time progress,
 * and visual progress bar toward the current level goal.
 */

import { EnergyLordsManager, EnergyLordsEvent } from '../game/systems/EnergyLordsManager';
import {
    ProgressState,
    formatTime,
    formatTimeMs,
    formatEnergy,
    getTierForLevel,
    getRankInTier,
    TIER_CONFIGS
} from '../game/types/EnergyLordsTypes';

export interface EnergyLordsHUDConfig {
    containerId: string;
    updateInterval?: number;
}

export class EnergyLordsHUD {
    private container: HTMLElement | null = null;
    private config: EnergyLordsHUDConfig;
    private energyLordsManager: EnergyLordsManager | null = null;

    // UI elements
    private titleElement: HTMLElement | null = null;
    private tierProgressElement: HTMLElement | null = null;
    private targetElement: HTMLElement | null = null;
    private currentEnergyElement: HTMLElement | null = null;
    private progressBarFill: HTMLElement | null = null;
    private sustainedTimeElement: HTMLElement | null = null;
    private statusElement: HTMLElement | null = null;

    // Update management
    private updateInterval: number | null = null;
    private isVisible: boolean = true;

    constructor(config: EnergyLordsHUDConfig) {
        this.config = {
            updateInterval: 500, // Update every 500ms to match threshold check
            ...config
        };

        this.initialize();
    }

    /**
     * Initialize the HUD
     */
    private initialize(): void {
        this.container = document.getElementById(this.config.containerId);

        if (!this.container) {
            // Create container if it doesn't exist
            this.container = document.createElement('div');
            this.container.id = this.config.containerId;
            this.container.style.cssText = `
                position: fixed;
                top: 420px;
                left: 20px;
                z-index: 1000;
            `;
            document.body.appendChild(this.container);
        }

        this.createUI();
    }

    /**
     * Connect to the EnergyLordsManager
     */
    public setManager(manager: EnergyLordsManager): void {
        this.energyLordsManager = manager;

        // Subscribe to events
        manager.addEventListener((event: EnergyLordsEvent) => {
            this.handleEvent(event);
        });

        // Start periodic updates
        this.startUpdates();

        // Initial update
        this.updateDisplay();
    }

    /**
     * Create the UI elements
     */
    private createUI(): void {
        if (!this.container) return;

        this.container.innerHTML = '';

        // Main HUD container
        const hud = document.createElement('div');
        hud.className = 'energy-lords-hud';
        hud.style.cssText = `
            background: rgba(10, 0, 30, 0.85);
            border: 2px solid rgba(180, 130, 255, 0.6);
            border-radius: 8px;
            padding: 12px 16px;
            font-family: 'Orbitron', 'Segoe UI', monospace;
            color: #e0d0ff;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 20px rgba(150, 100, 255, 0.3), inset 0 0 30px rgba(100, 50, 200, 0.1);
            min-width: 280px;
        `;

        // Title row
        const titleRow = document.createElement('div');
        titleRow.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
            border-bottom: 1px solid rgba(180, 130, 255, 0.3);
            padding-bottom: 8px;
        `;

        const titleLabel = document.createElement('span');
        titleLabel.style.cssText = `
            font-size: 10px;
            color: rgba(180, 130, 255, 0.7);
            text-transform: uppercase;
            letter-spacing: 1px;
        `;
        titleLabel.textContent = 'ENERGY LORD';

        this.titleElement = document.createElement('span');
        this.titleElement.style.cssText = `
            font-size: 14px;
            font-weight: 700;
            color: #ffd700;
            text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        `;
        this.titleElement.textContent = 'Initiate';

        titleRow.appendChild(titleLabel);
        titleRow.appendChild(this.titleElement);

        // Tier progress row
        const tierRow = document.createElement('div');
        tierRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 10px;
        `;

        this.tierProgressElement = document.createElement('div');
        this.tierProgressElement.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            color: rgba(180, 130, 255, 0.8);
        `;
        this.tierProgressElement.innerHTML = `
            <span>Tier: Spark</span>
            <div style="display: flex; gap: 2px;">
                <div style="width: 8px; height: 8px; background: rgba(255,215,0,0.3); border-radius: 2px;"></div>
                <div style="width: 8px; height: 8px; background: rgba(255,215,0,0.3); border-radius: 2px;"></div>
                <div style="width: 8px; height: 8px; background: rgba(255,215,0,0.3); border-radius: 2px;"></div>
                <div style="width: 8px; height: 8px; background: rgba(255,215,0,0.3); border-radius: 2px;"></div>
                <div style="width: 8px; height: 8px; background: rgba(255,215,0,0.3); border-radius: 2px;"></div>
            </div>
        `;

        tierRow.appendChild(this.tierProgressElement);

        // Target info
        const targetRow = document.createElement('div');
        targetRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 11px;
        `;

        const targetLabel = document.createElement('span');
        targetLabel.style.cssText = 'color: rgba(180, 130, 255, 0.8);';
        targetLabel.textContent = 'Target:';

        this.targetElement = document.createElement('span');
        this.targetElement.style.cssText = `
            color: #a0ffff;
            font-weight: 600;
        `;
        this.targetElement.textContent = '1,000 J for 1:00';

        targetRow.appendChild(targetLabel);
        targetRow.appendChild(this.targetElement);

        // Current energy
        const energyRow = document.createElement('div');
        energyRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            font-size: 11px;
        `;

        const energyLabel = document.createElement('span');
        energyLabel.style.cssText = 'color: rgba(180, 130, 255, 0.8);';
        energyLabel.textContent = 'Current:';

        this.currentEnergyElement = document.createElement('span');
        this.currentEnergyElement.style.cssText = `
            font-size: 16px;
            font-weight: 700;
            color: #00ff88;
            text-shadow: 0 0 8px rgba(0, 255, 136, 0.5);
        `;
        this.currentEnergyElement.textContent = '0 J';

        energyRow.appendChild(energyLabel);
        energyRow.appendChild(this.currentEnergyElement);

        // Progress bar
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            background: rgba(0, 0, 0, 0.4);
            border-radius: 4px;
            height: 8px;
            overflow: hidden;
            margin-bottom: 8px;
            border: 1px solid rgba(180, 130, 255, 0.3);
        `;

        this.progressBarFill = document.createElement('div');
        this.progressBarFill.style.cssText = `
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #6040ff 0%, #a080ff 50%, #ffd700 100%);
            transition: width 0.3s ease;
            box-shadow: 0 0 10px rgba(160, 128, 255, 0.5);
        `;

        progressContainer.appendChild(this.progressBarFill);

        // Sustained time
        const timeRow = document.createElement('div');
        timeRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
        `;

        const timeLabel = document.createElement('span');
        timeLabel.style.cssText = 'color: rgba(180, 130, 255, 0.8);';
        timeLabel.textContent = 'Sustained:';

        this.sustainedTimeElement = document.createElement('span');
        this.sustainedTimeElement.style.cssText = `
            color: #ffffff;
            font-weight: 600;
            font-family: monospace;
        `;
        this.sustainedTimeElement.textContent = '0:00 / 1:00';

        timeRow.appendChild(timeLabel);
        timeRow.appendChild(this.sustainedTimeElement);

        // Status indicator
        this.statusElement = document.createElement('div');
        this.statusElement.style.cssText = `
            margin-top: 10px;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 10px;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
            background: rgba(255, 100, 100, 0.2);
            color: #ff8888;
            border: 1px solid rgba(255, 100, 100, 0.3);
        `;
        this.statusElement.textContent = 'Below Threshold';

        // Assemble HUD
        hud.appendChild(titleRow);
        hud.appendChild(tierRow);
        hud.appendChild(targetRow);
        hud.appendChild(energyRow);
        hud.appendChild(progressContainer);
        hud.appendChild(timeRow);
        hud.appendChild(this.statusElement);

        this.container.appendChild(hud);

        // Add animations
        this.addAnimations();
    }

    /**
     * Add CSS animations
     */
    private addAnimations(): void {
        if (!document.querySelector('#energy-lords-hud-animations')) {
            const style = document.createElement('style');
            style.id = 'energy-lords-hud-animations';
            style.textContent = `
                .energy-lords-hud {
                    transition: all 0.3s ease;
                }

                .energy-lords-hud:hover {
                    box-shadow: 0 0 30px rgba(150, 100, 255, 0.5), inset 0 0 40px rgba(100, 50, 200, 0.2);
                }

                @keyframes pulse-gold {
                    0%, 100% { text-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
                    50% { text-shadow: 0 0 20px rgba(255, 215, 0, 0.8); }
                }

                @keyframes progress-glow {
                    0%, 100% { box-shadow: 0 0 10px rgba(160, 128, 255, 0.5); }
                    50% { box-shadow: 0 0 20px rgba(160, 128, 255, 0.8); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Handle events from EnergyLordsManager
     */
    private handleEvent(event: EnergyLordsEvent): void {
        switch (event.type) {
            case 'progress_update':
                this.updateDisplayWithState(event.data);
                break;
            case 'threshold_crossed':
                this.handleThresholdCrossed(event.data.above);
                break;
            case 'progress_loaded':
                this.updateDisplay();
                break;
        }
    }

    /**
     * Handle threshold crossed event
     */
    private handleThresholdCrossed(above: boolean): void {
        if (!this.statusElement) return;

        if (above) {
            this.statusElement.style.cssText = `
                margin-top: 10px;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 10px;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 1px;
                background: rgba(100, 255, 100, 0.2);
                color: #88ff88;
                border: 1px solid rgba(100, 255, 100, 0.3);
            `;
            this.statusElement.textContent = 'Sustaining...';
        } else {
            this.statusElement.style.cssText = `
                margin-top: 10px;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 10px;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 1px;
                background: rgba(255, 100, 100, 0.2);
                color: #ff8888;
                border: 1px solid rgba(255, 100, 100, 0.3);
            `;
            this.statusElement.textContent = 'Below Threshold';
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
            if (this.isVisible && this.energyLordsManager) {
                this.updateDisplay();
            }
        }, this.config.updateInterval);
    }

    /**
     * Update the display
     */
    private updateDisplay(): void {
        if (!this.energyLordsManager) return;

        const state = this.energyLordsManager.getProgressState();
        this.updateDisplayWithState(state);
    }

    /**
     * Update tier progress display
     */
    private updateTierProgress(targetLevel: number): void {
        if (!this.tierProgressElement) return;

        const tier = getTierForLevel(targetLevel);
        const rank = getRankInTier(targetLevel);

        if (!tier) {
            this.tierProgressElement.innerHTML = `<span style="color: #ffd700;">MAX LEVEL</span>`;
            return;
        }

        // Create tier progress dots
        let dotsHtml = '';
        for (let i = 1; i <= 5; i++) {
            const isCompleted = i < rank;
            const isCurrent = i === rank;
            const bgColor = isCompleted ? '#ffd700' : (isCurrent ? 'rgba(255,215,0,0.6)' : 'rgba(255,215,0,0.2)');
            const border = isCurrent ? '1px solid #ffd700' : 'none';
            dotsHtml += `<div style="width: 8px; height: 8px; background: ${bgColor}; border-radius: 2px; border: ${border};"></div>`;
        }

        this.tierProgressElement.innerHTML = `
            <span>Tier: ${tier.name}</span>
            <div style="display: flex; gap: 2px;">${dotsHtml}</div>
            <span style="color: #a0a0a0;">${rank}/5</span>
        `;
    }

    /**
     * Update display with progress state
     */
    private updateDisplayWithState(state: ProgressState): void {
        if (!this.energyLordsManager) return;

        // Update title
        if (this.titleElement) {
            this.titleElement.textContent = this.energyLordsManager.getCurrentTitle();
        }

        // Update tier progress
        this.updateTierProgress(state.targetLevel.level);

        // Update target
        if (this.targetElement && state.targetLevel) {
            const targetTime = formatTime(state.targetLevel.sustainTime);
            this.targetElement.textContent = `${formatEnergy(state.targetLevel.energyThreshold)} J for ${targetTime}`;
        }

        // Update current energy
        if (this.currentEnergyElement) {
            this.currentEnergyElement.textContent = `${formatEnergy(state.currentEnergy)} J`;

            // Color based on threshold
            if (state.isAboveThreshold) {
                this.currentEnergyElement.style.color = '#00ff88';
                this.currentEnergyElement.style.textShadow = '0 0 8px rgba(0, 255, 136, 0.5)';
            } else {
                this.currentEnergyElement.style.color = '#ff8888';
                this.currentEnergyElement.style.textShadow = '0 0 8px rgba(255, 136, 136, 0.5)';
            }
        }

        // Update progress bar
        if (this.progressBarFill) {
            this.progressBarFill.style.width = `${state.progressPercent}%`;

            // Gold color when near completion
            if (state.progressPercent > 90) {
                this.progressBarFill.style.background = 'linear-gradient(90deg, #ffd700 0%, #ffee88 50%, #ffffff 100%)';
                this.progressBarFill.style.animation = 'progress-glow 1s infinite';
            } else {
                this.progressBarFill.style.background = 'linear-gradient(90deg, #6040ff 0%, #a080ff 50%, #ffd700 100%)';
                this.progressBarFill.style.animation = 'none';
            }
        }

        // Update sustained time
        if (this.sustainedTimeElement && state.targetLevel) {
            const sustainedStr = formatTimeMs(state.sustainedTime);
            const requiredStr = formatTime(state.targetLevel.sustainTime);
            this.sustainedTimeElement.textContent = `${sustainedStr} / ${requiredStr}`;
        }

        // Update status
        if (this.statusElement) {
            if (state.isAboveThreshold) {
                this.statusElement.style.background = 'rgba(100, 255, 100, 0.2)';
                this.statusElement.style.color = '#88ff88';
                this.statusElement.style.borderColor = 'rgba(100, 255, 100, 0.3)';
                this.statusElement.textContent = 'Sustaining...';
            } else {
                this.statusElement.style.background = 'rgba(255, 100, 100, 0.2)';
                this.statusElement.style.color = '#ff8888';
                this.statusElement.style.borderColor = 'rgba(255, 100, 100, 0.3)';
                this.statusElement.textContent = 'Below Threshold';
            }
        }
    }

    /**
     * Set visibility
     */
    public setVisible(visible: boolean): void {
        this.isVisible = visible;

        if (this.container) {
            this.container.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Dispose the HUD
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
