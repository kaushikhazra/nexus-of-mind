/**
 * CombatUINotifications - UI notifications for combat events
 *
 * Handles display of energy shortage warnings and other combat-related
 * UI feedback. Extracted from CombatSystem.ts for SOLID compliance.
 */

import { EnergyManager } from '../EnergyManager';

/**
 * Notification configuration
 */
export interface NotificationConfig {
    displayDuration: number;
    animationName: string;
    topOffset: string;
    rightOffset: string;
}

/**
 * Default notification configuration
 */
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
    displayDuration: 2000,
    animationName: 'energyShortageAlert',
    topOffset: '120px',
    rightOffset: '20px'
};

/**
 * CombatUINotificationManager - Manages combat-related UI notifications
 */
export class CombatUINotificationManager {
    private config: NotificationConfig;
    private energyManager: EnergyManager;
    private animationStyleAdded: boolean = false;

    constructor(energyManager: EnergyManager, config?: Partial<NotificationConfig>) {
        this.config = { ...DEFAULT_NOTIFICATION_CONFIG, ...config };
        this.energyManager = energyManager;
    }

    /**
     * Show energy shortage UI feedback
     */
    public showEnergyShortage(protectorId: string, requiredEnergy: number): void {
        const currentEnergy = this.energyManager.getTotalEnergy();

        // Create a temporary UI notification for energy shortage
        this.createEnergyShortageNotification(protectorId, requiredEnergy, currentEnergy);

        // Also trigger the energy manager's low energy callback
        this.energyManager.onLowEnergy((entityId: string, energy: number) => {
            // This will trigger existing UI warnings in EnergyDisplay
        });
    }

    /**
     * Create temporary energy shortage notification
     */
    private createEnergyShortageNotification(
        protectorId: string,
        requiredEnergy: number,
        currentEnergy: number
    ): void {
        // Create a floating notification element - positioned under energy/mineral bars
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: ${this.config.topOffset};
            right: ${this.config.rightOffset};
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 5px;
            font-family: 'Orbitron', monospace;
            font-size: 12px;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 0 15px rgba(255, 0, 0, 0.5);
            border: 2px solid #ff4444;
            text-align: center;
            pointer-events: none;
            animation: ${this.config.animationName} ${this.config.displayDuration}ms ease-out forwards;
        `;

        notification.innerHTML = `
            <div>INSUFFICIENT ENERGY</div>
            <div style="font-size: 10px; margin-top: 3px;">
                Need: ${requiredEnergy} | Have: ${Math.round(currentEnergy)}
            </div>
        `;

        // Add CSS animation if not exists
        this.ensureAnimationStyleExists();

        // Add to document
        document.body.appendChild(notification);

        // Remove after animation completes
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, this.config.displayDuration);
    }

    /**
     * Ensure animation style exists in document
     */
    private ensureAnimationStyleExists(): void {
        if (this.animationStyleAdded) return;

        const styleId = `${this.config.animationName}-style`;
        if (!document.querySelector(`#${styleId}`)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                @keyframes ${this.config.animationName} {
                    0% {
                        opacity: 0;
                        transform: scale(0.8);
                    }
                    20% {
                        opacity: 1;
                        transform: scale(1.05);
                    }
                    40% {
                        transform: scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                }
            `;
            document.head.appendChild(style);
            this.animationStyleAdded = true;
        }
    }

    /**
     * Show combat interruption notification
     */
    public showCombatInterruption(reason: string): void {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: ${this.config.topOffset};
            right: ${this.config.rightOffset};
            background: rgba(255, 165, 0, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 5px;
            font-family: 'Orbitron', monospace;
            font-size: 11px;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 0 15px rgba(255, 165, 0, 0.5);
            border: 2px solid #ffaa44;
            text-align: center;
            pointer-events: none;
            animation: ${this.config.animationName} ${this.config.displayDuration}ms ease-out forwards;
        `;

        notification.innerHTML = `
            <div>COMBAT INTERRUPTED</div>
            <div style="font-size: 10px; margin-top: 3px;">
                ${this.formatInterruptionReason(reason)}
            </div>
        `;

        this.ensureAnimationStyleExists();
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, this.config.displayDuration);
    }

    /**
     * Format interruption reason for display
     */
    private formatInterruptionReason(reason: string): string {
        const reasonMap: Record<string, string> = {
            'out_of_range': 'Target out of range',
            'energy_depleted': 'Energy depleted',
            'target_invalid': 'Invalid target',
            'protector_destroyed': 'Protector lost',
            'target_destroyed': 'Target eliminated'
        };
        return reasonMap[reason] || reason;
    }

    /**
     * Show target destroyed notification
     */
    public showTargetDestroyed(targetType: string): void {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: ${this.config.topOffset};
            right: ${this.config.rightOffset};
            background: rgba(0, 200, 0, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 5px;
            font-family: 'Orbitron', monospace;
            font-size: 11px;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 0 15px rgba(0, 200, 0, 0.5);
            border: 2px solid #00ff44;
            text-align: center;
            pointer-events: none;
            animation: ${this.config.animationName} ${this.config.displayDuration}ms ease-out forwards;
        `;

        notification.innerHTML = `
            <div>TARGET ELIMINATED</div>
            <div style="font-size: 10px; margin-top: 3px;">
                ${targetType} destroyed
            </div>
        `;

        this.ensureAnimationStyleExists();
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, this.config.displayDuration);
    }
}
