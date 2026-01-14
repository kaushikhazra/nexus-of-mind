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
                top: 320px;
                left: 20px;
                z-index: 1000;
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
                    <span class="button-cost">${this.PROTECTOR_ENERGY_COST}E</span>
                </button>
            </div>
        `;

        this.container.appendChild(this.creationPanel);
        
        // Get references to interactive elements
        this.createButton = document.getElementById('create-protector-btn');
        
        this.applyStyles();
    }

    /**
     * Apply SciFi styling to UI elements - MATCHES CONSTRUCTION PANEL
     */
    private applyStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .protector-creation-panel {
                background: rgba(20, 0, 10, 0.3);
                border: 1px solid rgba(255, 100, 100, 0.4);
                border-radius: 8px;
                padding: 12px;
                font-family: 'Orbitron', monospace;
                color: #ff6666;
                backdrop-filter: blur(8px);
                box-shadow: 0 0 15px rgba(255, 100, 100, 0.2);
                min-width: 200px;
                font-size: 12px;
            }

            .protector-creation-panel .creation-header {
                font-size: 14px;
                font-weight: 700;
                text-align: center;
                margin-bottom: 12px;
                color: #ff6666;
                text-shadow: 0 0 8px rgba(255, 100, 100, 0.6);
                letter-spacing: 1px;
            }

            .protector-creation-panel .creation-title {
                font-size: 14px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                text-shadow: 0 0 10px rgba(255, 100, 100, 0.8);
            }

            .protector-creation-panel .creation-content {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .create-protector-button {
                background: rgba(40, 0, 20, 0.4);
                border: 1px solid #ff4444;
                border-radius: 4px;
                color: #ff4444;
                padding: 10px 12px;
                font-family: 'Orbitron', monospace;
                font-size: 11px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .create-protector-button:hover:not(:disabled) {
                background: rgba(80, 0, 40, 0.6);
                box-shadow: 0 0 10px #ff444440;
            }

            .create-protector-button:active:not(:disabled) {
                transform: translateY(0);
                box-shadow: 0 0 15px rgba(255, 68, 68, 0.3);
            }

            .create-protector-button:disabled {
                background: rgba(100, 0, 0, 0.3);
                border-color: #aa2222;
                color: #aa2222;
                cursor: not-allowed;
                opacity: 0.6;
                box-shadow: 0 0 10px rgba(170, 34, 34, 0.2);
            }

            .create-protector-button .button-text {
                font-size: 11px;
                line-height: 1;
            }

            .create-protector-button .button-cost {
                font-size: 10px;
                opacity: 0.8;
                line-height: 1;
                font-weight: 600;
            }

            .create-protector-button:disabled .button-cost {
                color: #cc4444;
            }
        `;
        document.head.appendChild(style);
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
        // Update UI state every second
        setInterval(() => {
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
     * Show user feedback message
     */
    private showFeedback(message: string, type: 'success' | 'error'): void {
        // Create temporary feedback element
        const feedback = document.createElement('div');
        feedback.className = `creation-feedback ${type}`;
        feedback.textContent = message;
        feedback.style.cssText = `
            position: absolute;
            top: -30px;
            left: 50%;
            transform: translateX(-50%);
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            z-index: 1001;
            animation: feedbackFade 2s ease-out forwards;
            ${type === 'success' 
                ? 'background: rgba(0, 255, 0, 0.8); color: #000; border: 1px solid #00ff00;'
                : 'background: rgba(255, 0, 0, 0.8); color: #fff; border: 1px solid #ff0000;'
            }
        `;

        // Add animation keyframes if not already added
        if (!document.querySelector('#feedback-animation')) {
            const animationStyle = document.createElement('style');
            animationStyle.id = 'feedback-animation';
            animationStyle.textContent = `
                @keyframes feedbackFade {
                    0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
                    20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                }
            `;
            document.head.appendChild(animationStyle);
        }

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
     * Update UI state based on current game state
     */
    private updateUI(): void {
        // Update button state based on energy availability
        if (this.createButton) {
            const currentEnergy = this.config.energyManager.getTotalEnergy();
            const canAfford = currentEnergy >= this.PROTECTOR_ENERGY_COST;
            
            (this.createButton as HTMLButtonElement).disabled = !canAfford;
            
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
        // Remove UI elements
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
}