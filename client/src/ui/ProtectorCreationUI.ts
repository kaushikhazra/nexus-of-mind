/**
 * ProtectorCreationUI - User interface for creating protector units
 *
 * Provides a button interface for spawning protectors with energy cost validation.
 * Integrates with the existing UI system and follows SciFi design theme.
 */

import { EnergyManager } from '../game/EnergyManager';
import { UnitManager } from '../game/UnitManager';
import { BuildingManager } from '../game/BuildingManager';
import { TerrainGenerator } from '../rendering/TerrainGenerator';
import { Vector3 } from '@babylonjs/core';
import {
    UI_COLORS,
    getPanelStyles,
    getHeaderStyles,
    getButtonStyles,
    getButtonHoverStyles,
    getButtonBaseStyles,
    getFeedbackStyles,
    injectSharedStyles
} from './styles';

export interface ProtectorCreationUIConfig {
    containerId: string;
    energyManager: EnergyManager;
    unitManager: UnitManager;
    buildingManager: BuildingManager;
    terrainGenerator: TerrainGenerator;
}

export class ProtectorCreationUI {
    private config: ProtectorCreationUIConfig;
    private container: HTMLElement | null = null;
    private creationPanel: HTMLElement | null = null;
    private createButton: HTMLElement | null = null;
    private updateIntervalId: number | null = null; // Fix: Track interval for cleanup

    // Configuration
    private readonly PROTECTOR_ENERGY_COST = 50;

    constructor(config: ProtectorCreationUIConfig) {
        this.config = config;
        this.initialize();
    }

    /**
     * Initialize protector creation UI
     */
    private initialize(): void {
        this.createUI();
        this.setupEventListeners();
        this.setupUpdateTimer();
    }

    /**
     * Create UI elements
     */
    private createUI(): void {
        // Get or create container
        this.container = document.getElementById(this.config.containerId);
        if (!this.container) {
            // Container not found - creating dynamically
            this.container = document.createElement('div');
            this.container.id = this.config.containerId;
            this.container.style.cssText = `
                position: fixed;
                top: 280px;
                left: 20px;
                z-index: 1100;
            `;
            document.body.appendChild(this.container);
        }

        // Clear existing content
        this.container.innerHTML = '';

        // Create protector creation panel
        this.creationPanel = document.createElement('div');
        this.creationPanel.className = 'protector-creation-panel';
        this.creationPanel.innerHTML = `
            <div class="creation-header">
                <span class="creation-title">◊ DEFENSE ◊</span>
            </div>
            <div class="creation-content">
                <button id="create-protector-btn" class="create-protector-button">
                    <span class="button-text">CREATE PROTECTOR</span>
                    <span class="button-cost" style="margin-left: 8px;">${this.PROTECTOR_ENERGY_COST}E</span>
                </button>
            </div>
        `;

        this.container.appendChild(this.creationPanel);
        
        // Get references to interactive elements
        this.createButton = document.getElementById('create-protector-btn');
        
        this.applyStyles();
    }

    /**
     * Apply SciFi styling to UI elements - uses centralized GameUIStyles
     */
    private applyStyles(): void {
        // Inject shared animations (feedbackFade, etc.)
        injectSharedStyles();

        // Apply panel styles (red variant for defense)
        if (this.creationPanel) {
            this.creationPanel.style.cssText = getPanelStyles('red');
            this.creationPanel.classList.add('game-ui-panel-red');
        }

        // Apply header styles
        const header = this.creationPanel?.querySelector('.creation-header') as HTMLElement;
        if (header) {
            header.style.cssText = getHeaderStyles('red');
        }

        // Apply button styles
        if (this.createButton) {
            this.createButton.style.cssText = getButtonStyles(UI_COLORS.danger);

            // Add hover handlers
            this.createButton.addEventListener('mouseenter', () => {
                if (!(this.createButton as HTMLButtonElement).disabled) {
                    const hover = getButtonHoverStyles(UI_COLORS.danger);
                    (this.createButton as HTMLElement).style.background = hover.background;
                    (this.createButton as HTMLElement).style.boxShadow = hover.boxShadow;
                }
            });

            this.createButton.addEventListener('mouseleave', () => {
                const base = getButtonBaseStyles();
                (this.createButton as HTMLElement).style.background = base.background;
                (this.createButton as HTMLElement).style.boxShadow = base.boxShadow;
            });
        }
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        if (this.createButton) {
            this.createButton.addEventListener('click', () => {
                this.handleProtectorCreation();
            });
        }
    }

    /**
     * Setup update timer for UI state
     */
    private setupUpdateTimer(): void {
        // Fix: Store interval ID for cleanup
        this.updateIntervalId = window.setInterval(() => {
            this.updateUI();
        }, 1000);

        // Initial update
        this.updateUI();
    }

    /**
     * Handle protector creation button click
     */
    private handleProtectorCreation(): void {
        // Validate energy availability
        const currentEnergy = this.config.energyManager.getTotalEnergy();
        if (currentEnergy < this.PROTECTOR_ENERGY_COST) {
            console.warn(`⚠️ Insufficient energy for protector creation: ${currentEnergy}/${this.PROTECTOR_ENERGY_COST}`);
            this.showFeedback('Insufficient Energy!', 'error');
            return;
        }

        // Consume energy
        const energyConsumed = this.config.energyManager.consumeEnergy(
            'protector_creation',
            this.PROTECTOR_ENERGY_COST,
            'protector_spawning'
        );

        if (!energyConsumed) {
            console.error('❌ Failed to consume energy for protector creation');
            this.showFeedback('Energy Consumption Failed!', 'error');
            return;
        }

        // Create protector
        this.createProtector();
        
        // Update UI immediately
        this.updateUI();
        
        // Ensure UI remains visible after protector creation
        this.ensureUIVisible();
    }

    /**
     * Ensure UI remains visible (debugging helper)
     */
    private ensureUIVisible(): void {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }

    /**
     * Create protector near base building
     */
    private createProtector(): void {
        // Find spawn position near base
        const spawnPosition = this.findSpawnPosition();
        
        if (!spawnPosition) {
            console.error('❌ Could not find valid spawn position for protector');
            this.showFeedback('No Valid Spawn Location!', 'error');
            return;
        }

        // Create protector unit
        const protector = this.config.unitManager.createUnit('protector', spawnPosition);

        if (protector) {
            console.log(`✅ Protector created: ${protector.getId()} at ${spawnPosition.toString()}`);
            this.showFeedback('Protector Created!', 'success');
        } else {
            console.error('❌ Protector creation failed');
            this.showFeedback('Creation Failed!', 'error');
        }
    }

    /**
     * Find valid spawn position near base building
     */
    private findSpawnPosition(): Vector3 | null {
        // Get all base buildings
        const buildings = this.config.buildingManager.getBuildingsByType('base');
        
        if (buildings.length === 0) {
            console.warn('⚠️ No base buildings found for protector spawn');
            return new Vector3(0, 0, 0); // Default spawn at origin
        }

        // Use first base building as spawn reference
        const baseBuilding = buildings[0];
        const basePosition = baseBuilding.getPosition();

        // Generate spawn position around base (offset by 8-12 units)
        const angle = Math.random() * Math.PI * 2;
        const distance = 8 + Math.random() * 4; // 8-12 units from base
        
        const spawnX = basePosition.x + Math.cos(angle) * distance;
        const spawnZ = basePosition.z + Math.sin(angle) * distance;
        
        // Get terrain height at spawn position
        let spawnY = 0;
        if (this.config.terrainGenerator && this.config.terrainGenerator.getHeightAtPosition) {
            spawnY = this.config.terrainGenerator.getHeightAtPosition(spawnX, spawnZ);
        }

        return new Vector3(spawnX, spawnY, spawnZ);
    }

    /**
     * Show user feedback message - uses centralized GameUIStyles
     */
    private showFeedback(message: string, type: 'success' | 'error'): void {
        // Create temporary feedback element
        const feedback = document.createElement('div');
        feedback.className = `creation-feedback ${type}`;
        feedback.textContent = message;
        feedback.style.cssText = getFeedbackStyles(type);

        // Add to panel and remove after animation
        if (this.creationPanel) {
            this.creationPanel.style.position = 'relative';
            this.creationPanel.appendChild(feedback);
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 2000);
        }
    }

    /**
     * Update UI state based on current game state - uses centralized GameUIStyles
     */
    private updateUI(): void {
        // Update button state based on energy availability
        if (this.createButton) {
            const currentEnergy = this.config.energyManager.getTotalEnergy();
            const canAfford = currentEnergy >= this.PROTECTOR_ENERGY_COST;

            (this.createButton as HTMLButtonElement).disabled = !canAfford;

            // Apply appropriate button style based on state
            this.createButton.style.cssText = getButtonStyles(UI_COLORS.danger, !canAfford);

            // Update button text based on affordability
            const buttonText = this.createButton.querySelector('.button-text');
            const buttonCost = this.createButton.querySelector('.button-cost');

            if (buttonText && buttonCost) {
                if (canAfford) {
                    buttonText.textContent = 'CREATE PROTECTOR';
                    buttonCost.textContent = `${this.PROTECTOR_ENERGY_COST}E`;
                } else {
                    buttonText.textContent = 'INSUFFICIENT ENERGY';
                    buttonCost.textContent = `${this.PROTECTOR_ENERGY_COST}E`;
                }
            }
        }
    }

    /**
     * Get current protector count
     */
    public getProtectorCount(): number {
        return this.config.unitManager.getUnitsByType('protector').length;
    }

    /**
     * Show/hide protector creation UI
     */
    public setVisible(visible: boolean): void {
        if (this.container) {
            this.container.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Dispose protector creation UI and cleanup resources
     */
    public dispose(): void {
        // Fix: Clear interval to prevent memory leak
        if (this.updateIntervalId !== null) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = null;
        }

        // Remove UI elements
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
}