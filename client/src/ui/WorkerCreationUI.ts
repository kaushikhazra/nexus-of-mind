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
        console.log('👷 Worker Creation UI initialized');
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
        
        console.log('👷 Worker Creation UI elements created and attached');
    }

    /**
     * Apply SciFi styling to UI elements - MATCHES CONSTRUCTION PANEL
     */
    private applyStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .worker-creation-panel {
                background: rgba(0, 10, 20, 0.3);
                border: 1px solid rgba(0, 255, 255, 0.4);
                border-radius: 8px;
                padding: 12px;
                font-family: 'Orbitron', monospace;
                color: #00ffff;
                backdrop-filter: blur(8px);
                box-shadow: 0 0 15px rgba(0, 255, 255, 0.2);
                min-width: 200px;
                font-size: 12px;
            }

            .creation-header {
                font-size: 14px;
                font-weight: 700;
                text-align: center;
                margin-bottom: 12px;
                color: #00ffff;
                text-shadow: 0 0 8px rgba(0, 255, 255, 0.6);
                letter-spacing: 1px;
            }

            .creation-title {
                font-size: 14px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                text-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
            }

            .creation-content {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .create-worker-button {
                background: rgba(0, 20, 40, 0.4);
                border: 1px solid #00ff88;
                border-radius: 4px;
                color: #00ff88;
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

            .create-worker-button:hover:not(:disabled) {
                background: rgba(0, 40, 80, 0.6);
                box-shadow: 0 0 10px #00ff8840;
            }

            .create-worker-button:active:not(:disabled) {
                transform: translateY(0);
                box-shadow: 0 0 15px rgba(0, 255, 136, 0.3);
            }

            .create-worker-button:disabled {
                background: rgba(100, 0, 0, 0.3);
                border-color: #ff4444;
                color: #ff4444;
                cursor: not-allowed;
                opacity: 0.6;
                box-shadow: 0 0 10px rgba(255, 68, 68, 0.2);
            }

            .button-text {
                font-size: 11px;
                line-height: 1;
            }

            .button-cost {
                font-size: 10px;
                opacity: 0.8;
                line-height: 1;
                font-weight: 600;
            }

            .create-worker-button:disabled .button-cost {
                color: #ff6666;
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
        console.log('👷 Worker creation requested');

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

        console.log(`✅ Energy consumed: ${this.WORKER_ENERGY_COST}E`);

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
            console.log('👷 UI visibility ensured after worker creation');
        }
    }

    /**
     * Create worker using WorkerSpawner
     */
    private createWorker(): void {
        console.log('👷 Creating worker...');
        
        const spawnResult = this.workerSpawner.spawnWorker();
        
        if (spawnResult.success) {
            console.log(`✅ Worker created successfully: ${spawnResult.worker?.getId()}`);
            this.showFeedback('Worker Created!', 'success');
            
            // Log spawn details
            if (spawnResult.position) {
                console.log(`📍 Worker spawned at: ${spawnResult.position.toString()}`);
            }
        } else {
            console.error(`❌ Worker creation failed: ${spawnResult.message}`);
            this.showFeedback(`Creation Failed: ${spawnResult.message}`, 'error');
        }
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
            const canAfford = currentEnergy >= this.WORKER_ENERGY_COST;
            
            (this.createButton as HTMLButtonElement).disabled = !canAfford;
            
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

        console.log('👷 Worker Creation UI disposed');
    }
}