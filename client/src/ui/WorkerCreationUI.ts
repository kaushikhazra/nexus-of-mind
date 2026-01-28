/**
 * WorkerCreationUI - User interface for creating worker units
 *
 * Provides a button interface for spawning workers with energy cost validation.
 * Integrates with the existing UI system and follows SciFi design theme.
 */

import { EnergyManager } from '../game/EnergyManager';
import { UnitManager } from '../game/UnitManager';
import { BuildingManager } from '../game/BuildingManager';
import { TerrainGenerator } from '../rendering/TerrainGenerator';
import { WorkerSpawner } from '../game/WorkerSpawner';
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

export interface WorkerCreationUIConfig {
    containerId: string;
    energyManager: EnergyManager;
    unitManager: UnitManager;
    buildingManager: BuildingManager;
    terrainGenerator: TerrainGenerator;
}

export class WorkerCreationUI {
    private config: WorkerCreationUIConfig;
    private container: HTMLElement | null = null;
    private creationPanel: HTMLElement | null = null;
    private createButton: HTMLElement | null = null;
    private workerSpawner: WorkerSpawner;
    
    // Configuration
    private readonly WORKER_ENERGY_COST = 25;

    constructor(config: WorkerCreationUIConfig) {
        this.config = config;
        this.workerSpawner = new WorkerSpawner(config.unitManager, config.buildingManager, config.terrainGenerator);
        this.initialize();
    }

    /**
     * Initialize worker creation UI
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
            console.warn(`⚠️ Container ${this.config.containerId} not found, creating dynamically`);
            this.container = document.createElement('div');
            this.container.id = this.config.containerId;
            this.container.style.cssText = `
                position: fixed;
                top: 200px;
                left: 20px;
                z-index: 1000;
            `;
            document.body.appendChild(this.container);
        }

        // Clear existing content
        this.container.innerHTML = '';

        // Create worker creation panel
        this.creationPanel = document.createElement('div');
        this.creationPanel.className = 'worker-creation-panel';
        this.creationPanel.innerHTML = `
            <div class="creation-header">
                <span class="creation-title">◊ WORKFORCE ◊</span>
            </div>
            <div class="creation-content">
                <button id="create-worker-btn" class="create-worker-button">
                    <span class="button-text">CREATE WORKER</span>
                    <span class="button-cost">${this.WORKER_ENERGY_COST}E</span>
                </button>
            </div>
        `;

        this.container.appendChild(this.creationPanel);
        
        // Get references to interactive elements
        this.createButton = document.getElementById('create-worker-btn');
        
        this.applyStyles();
    }

    /**
     * Apply SciFi styling to UI elements - uses centralized GameUIStyles
     */
    private applyStyles(): void {
        // Inject shared animations (feedbackFade, etc.)
        injectSharedStyles();

        // Apply panel styles
        if (this.creationPanel) {
            this.creationPanel.style.cssText = getPanelStyles('cyan');
            this.creationPanel.classList.add('game-ui-panel');
        }

        // Apply header styles
        const header = this.creationPanel?.querySelector('.creation-header') as HTMLElement;
        if (header) {
            header.style.cssText = getHeaderStyles('cyan');
        }

        // Apply button styles
        if (this.createButton) {
            this.createButton.style.cssText = getButtonStyles(UI_COLORS.secondary);

            // Add hover handlers
            this.createButton.addEventListener('mouseenter', () => {
                if (!(this.createButton as HTMLButtonElement).disabled) {
                    const hover = getButtonHoverStyles(UI_COLORS.secondary);
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
                this.handleWorkerCreation();
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
     * Handle worker creation button click
     */
    private handleWorkerCreation(): void {
        // Validate energy availability
        const currentEnergy = this.config.energyManager.getTotalEnergy();
        if (currentEnergy < this.WORKER_ENERGY_COST) {
            console.warn(`⚠️ Insufficient energy for worker creation: ${currentEnergy}/${this.WORKER_ENERGY_COST}`);
            this.showFeedback('Insufficient Energy!', 'error');
            return;
        }

        // Consume energy
        const energyConsumed = this.config.energyManager.consumeEnergy(
            'worker_creation',
            this.WORKER_ENERGY_COST,
            'worker_spawning'
        );

        if (!energyConsumed) {
            console.error('❌ Failed to consume energy for worker creation');
            this.showFeedback('Energy Consumption Failed!', 'error');
            return;
        }

        // Create worker (will be implemented in Phase 2)
        this.createWorker();
        
        // Update UI immediately
        this.updateUI();
        
        // Ensure UI remains visible after worker creation
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
     * Create worker using WorkerSpawner
     */
    private createWorker(): void {
        const spawnResult = this.workerSpawner.spawnWorker();

        if (spawnResult.success) {
            this.showFeedback('Worker Created!', 'success');
        } else {
            console.error(`❌ Worker creation failed: ${spawnResult.message}`);
            this.showFeedback(`Creation Failed: ${spawnResult.message}`, 'error');
        }
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
            const canAfford = currentEnergy >= this.WORKER_ENERGY_COST;

            (this.createButton as HTMLButtonElement).disabled = !canAfford;

            // Apply appropriate button style based on state
            this.createButton.style.cssText = getButtonStyles(
                canAfford ? UI_COLORS.secondary : UI_COLORS.danger,
                !canAfford
            );

            // Update button text based on affordability
            const buttonText = this.createButton.querySelector('.button-text');
            const buttonCost = this.createButton.querySelector('.button-cost');

            if (buttonText && buttonCost) {
                if (canAfford) {
                    buttonText.textContent = 'CREATE WORKER';
                    buttonCost.textContent = `${this.WORKER_ENERGY_COST}E`;
                } else {
                    buttonText.textContent = 'INSUFFICIENT ENERGY';
                    buttonCost.textContent = `${this.WORKER_ENERGY_COST}E`;
                }
            }
        }
    }

    /**
     * Get current worker count
     */
    public getWorkerCount(): number {
        return this.config.unitManager.getUnitsByType('worker').length;
    }

    /**
     * Show/hide worker creation UI
     */
    public setVisible(visible: boolean): void {
        if (this.container) {
            this.container.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Dispose worker creation UI and cleanup resources
     */
    public dispose(): void {
        // Remove UI elements
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
}