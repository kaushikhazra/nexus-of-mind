/**
 * ProtectorSelectionUI - Displays Protector stats when selected
 *
 * Shows energy, health, and combat statistics in a tooltip-style panel
 * similar to the mining analysis tooltip, appearing near the mouse pointer.
 */

import { Protector } from '../game/entities/Protector';

export class ProtectorSelectionUI {
    private tooltipElement: HTMLElement | null = null;
    private currentProtector: Protector | null = null;
    private updateInterval: number | null = null;
    private isVisible: boolean = false;
    private mouseX: number = 0;
    private mouseY: number = 0;

    constructor() {
        this.initialize();
    }

    /**
     * Initialize the UI
     */
    private initialize(): void {
        this.createTooltipElement();
    }

    /**
     * Create the tooltip HTML element
     */
    private createTooltipElement(): void {
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.id = 'protector-selection-tooltip';
        this.tooltipElement.style.cssText = `
            position: fixed;
            background: rgba(0, 10, 20, 0.3);
            border: 1px solid rgba(0, 255, 255, 0.4);
            border-radius: 8px;
            padding: 12px;
            font-family: 'Orbitron', monospace;
            color: #00ffff;
            backdrop-filter: blur(8px);
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.2);
            font-size: 11px;
            pointer-events: none;
            z-index: 1000;
            display: none;
            min-width: 180px;
            max-width: 220px;
        `;

        document.body.appendChild(this.tooltipElement);
    }

    /**
     * Show the UI for a selected Protector (called on hover)
     */
    public show(protector: Protector, mouseX: number, mouseY: number): void {
        // Update mouse position for tooltip placement
        this.mouseX = mouseX;
        this.mouseY = mouseY;

        // If already showing the same protector, just update position
        if (this.isVisible && this.currentProtector === protector) {
            this.updatePosition();
            return;
        }

        this.currentProtector = protector;
        this.isVisible = true;

        if (this.tooltipElement) {
            this.tooltipElement.style.display = 'block';
        }

        // Start update interval for real-time stats
        this.startUpdateInterval();

        // Initial update
        this.updateContent();

        // Position tooltip near mouse
        this.updatePosition();
    }

    /**
     * Hide the UI
     */
    public hide(): void {
        // Skip if already hidden
        if (!this.isVisible) return;

        this.isVisible = false;
        this.currentProtector = null;

        if (this.tooltipElement) {
            this.tooltipElement.style.display = 'none';
        }

        this.stopUpdateInterval();
    }

    /**
     * Update tooltip position near mouse pointer
     */
    private updatePosition(): void {
        if (!this.tooltipElement || !this.isVisible) return;

        // Offset tooltip slightly below and to the right of mouse
        const offsetX = 20;
        const offsetY = 15;

        // Get tooltip dimensions
        const tooltipRect = this.tooltipElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let finalX = this.mouseX + offsetX;
        let finalY = this.mouseY + offsetY;

        // Adjust if tooltip would go off-screen to the right
        if (finalX + tooltipRect.width > viewportWidth) {
            finalX = this.mouseX - tooltipRect.width - offsetX;
        }

        // Adjust if tooltip would go off-screen at the bottom
        if (finalY + tooltipRect.height > viewportHeight) {
            finalY = this.mouseY - tooltipRect.height - offsetY;
        }

        // Ensure tooltip doesn't go off-screen to the left or top
        finalX = Math.max(10, finalX);
        finalY = Math.max(10, finalY);

        this.tooltipElement.style.left = `${finalX}px`;
        this.tooltipElement.style.top = `${finalY}px`;
    }

    /**
     * Start the update interval for real-time stats
     */
    private startUpdateInterval(): void {
        this.stopUpdateInterval();

        // Update every 100ms for smooth energy display
        this.updateInterval = window.setInterval(() => {
            if (this.isVisible && this.currentProtector) {
                this.updateContent();
            }
        }, 100);
    }

    /**
     * Stop the update interval
     */
    private stopUpdateInterval(): void {
        if (this.updateInterval !== null) {
            window.clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Update the tooltip content
     */
    private updateContent(): void {
        if (!this.tooltipElement || !this.currentProtector) return;

        const stats = this.currentProtector.getProtectorStats();
        const energyStorage = this.currentProtector.getEnergyStorage();

        const currentEnergy = energyStorage.getCurrentEnergy();
        const maxEnergy = energyStorage.getCapacity();
        const energyPercent = (currentEnergy / maxEnergy) * 100;

        const currentHealth = stats.health;
        const maxHealth = stats.maxHealth;
        const healthPercent = (currentHealth / maxHealth) * 100;

        // Determine energy bar color based on level
        let energyColor = '#00ff00'; // Green
        if (energyPercent < 25) {
            energyColor = '#ff4444'; // Red
        } else if (energyPercent < 50) {
            energyColor = '#ffaa00'; // Orange
        } else if (energyPercent < 75) {
            energyColor = '#ffff00'; // Yellow
        }

        // Determine health bar color
        let healthColor = '#00ff00'; // Green
        if (healthPercent < 25) {
            healthColor = '#ff4444'; // Red
        } else if (healthPercent < 50) {
            healthColor = '#ffaa00'; // Orange
        }

        // Combat state indicator
        const combatState = stats.combatState;
        let stateText = 'IDLE';
        let stateColor = '#888888';

        switch (combatState) {
            case 'moving':
                stateText = 'MOVING';
                stateColor = '#00ccff';
                break;
            case 'detecting':
                stateText = 'DETECTING';
                stateColor = '#ffff00';
                break;
            case 'engaging':
                stateText = 'ENGAGING';
                stateColor = '#ff8800';
                break;
            case 'attacking':
                stateText = 'ATTACKING';
                stateColor = '#ff4444';
                break;
        }

        // Shield status
        const shieldStatus = stats.shieldActive
            ? `<span style="color: #00ffff;">${stats.shieldStrength.toFixed(0)}/${stats.maxShieldStrength}</span>`
            : '<span style="color: #666666;">INACTIVE</span>';

        this.tooltipElement.innerHTML = `
            <div style="font-size: 12px; font-weight: 700; text-align: center; margin-bottom: 10px; color: #00ffff; text-shadow: 0 0 8px rgba(0, 255, 255, 0.6);">
                ◊ PROTECTOR ◊
            </div>

            <!-- Energy Bar -->
            <div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span style="color: #00ccff;">Energy:</span>
                    <span style="color: ${energyColor}; font-weight: 600;">${currentEnergy.toFixed(1)} / ${maxEnergy.toFixed(0)}</span>
                </div>
                <div style="background: rgba(0, 0, 0, 0.4); border-radius: 3px; height: 6px; overflow: hidden;">
                    <div style="background: ${energyColor}; height: 100%; width: ${energyPercent}%; transition: width 0.1s ease; box-shadow: 0 0 6px ${energyColor}40;"></div>
                </div>
            </div>

            <!-- Health Bar -->
            <div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span style="color: #00ccff;">Health:</span>
                    <span style="color: ${healthColor}; font-weight: 600;">${currentHealth.toFixed(0)} / ${maxHealth}</span>
                </div>
                <div style="background: rgba(0, 0, 0, 0.4); border-radius: 3px; height: 6px; overflow: hidden;">
                    <div style="background: ${healthColor}; height: 100%; width: ${healthPercent}%; transition: width 0.1s ease; box-shadow: 0 0 6px ${healthColor}40;"></div>
                </div>
            </div>

            <!-- Combat Stats -->
            <div style="border-top: 1px solid rgba(0, 255, 255, 0.2); padding-top: 8px; margin-top: 4px;">
                <div style="margin-bottom: 4px;">
                    <span style="color: #00ccff;">Status:</span>
                    <span style="color: ${stateColor}; font-weight: 600;">${stateText}</span>
                </div>

                <div style="margin-bottom: 4px;">
                    <span style="color: #00ccff;">Attack:</span>
                    <span style="color: #ffffff; font-weight: 600;">${stats.attackDamage} DMG</span>
                </div>

                <div style="margin-bottom: 4px;">
                    <span style="color: #00ccff;">Range:</span>
                    <span style="color: #ffffff; font-weight: 600;">${stats.attackRange.toFixed(1)} units</span>
                </div>

                <div style="margin-bottom: 4px;">
                    <span style="color: #00ccff;">Defense:</span>
                    <span style="color: #ffffff; font-weight: 600;">${stats.defenseRating}</span>
                </div>

                <div style="margin-bottom: 4px;">
                    <span style="color: #00ccff;">Shield:</span>
                    ${shieldStatus}
                </div>
            </div>

            <!-- Auto-Attack Status -->
            <div style="font-size: 10px; color: ${stats.autoAttackEnabled ? '#00ff00' : '#ff4444'}; text-align: center; border-top: 1px solid rgba(0, 255, 255, 0.2); padding-top: 6px; margin-top: 6px;">
                AUTO-ATTACK: ${stats.autoAttackEnabled ? 'ENABLED' : 'DISABLED'}
            </div>
        `;
    }

    /**
     * Check if UI is currently visible
     */
    public isShowing(): boolean {
        return this.isVisible;
    }

    /**
     * Get the currently displayed Protector
     */
    public getCurrentProtector(): Protector | null {
        return this.currentProtector;
    }

    /**
     * Dispose the UI
     */
    public dispose(): void {
        this.stopUpdateInterval();

        if (this.tooltipElement && this.tooltipElement.parentNode) {
            this.tooltipElement.parentNode.removeChild(this.tooltipElement);
            this.tooltipElement = null;
        }

        this.currentProtector = null;
    }
}
