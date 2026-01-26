/**
 * Nexus of Mind - Main Application Entry Point
 *
 * Initializes the game engine and starts the 3D world rendering.
 * This is the primary entry point for the AI-powered RTS game.
 */

import { GameEngine } from './game/GameEngine';
import { BuildingAction } from './game/actions/BuildingAction';
import { MovementAction } from './game/actions/MovementAction';
import { BuildingPlacementUI } from './ui/BuildingPlacementUI';
import { MineralReserveUI } from './ui/MiningUI';
import { WorkerCreationUI } from './ui/WorkerCreationUI';
import { ProtectorCreationUI } from './ui/ProtectorCreationUI';
import { IntroductionScreen } from './ui/IntroductionScreen';
import { PreferenceManager } from './ui/PreferenceManager';
import { Vector3 } from '@babylonjs/core';

/**
 * Application initialization and startup
 */
class Application {
    private gameEngine: GameEngine | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private loadingScreen: HTMLElement | null = null;
    private buildingPlacementUI: BuildingPlacementUI | null = null;
    private mineralReserveUI: MineralReserveUI | null = null;
    private workerCreationUI: WorkerCreationUI | null = null;
    private protectorCreationUI: ProtectorCreationUI | null = null;
    private introductionScreen: IntroductionScreen | null = null;
    private preferenceManager!: PreferenceManager;

    /**
     * Initialize the application
     */
    public async init(): Promise<void> {
        try {
            // Initialize preference manager
            this.preferenceManager = new PreferenceManager({ storageKey: 'nexus-of-mind-preferences' });

            // Check if introduction should be shown
            const shouldShowIntroduction = !this.preferenceManager.getSkipIntroduction();
            
            if (shouldShowIntroduction) {
                // Show introduction screen first
                await this.showIntroductionScreen();
            } else {
                // Skip directly to game initialization
                await this.initializeGame();
            }

        } catch (error) {
            this.showError('Neural Core Initialization Failed. Please refresh the page.');
        }
    }

    /**
     * Show the introduction screen
     */
    private async showIntroductionScreen(): Promise<void> {
        this.introductionScreen = new IntroductionScreen({
            containerId: 'introduction-screen',
            onComplete: () => {
                this.hideIntroductionScreen();
                this.initializeGame();
            }
        });

        this.introductionScreen.show();
    }

    /**
     * Hide the introduction screen
     */
    private hideIntroductionScreen(): void {
        if (this.introductionScreen) {
            this.introductionScreen.hide();
            this.introductionScreen.dispose();
            this.introductionScreen = null;
        }
    }

    /**
     * Initialize the game engine and UI components
     */
    private async initializeGame(): Promise<void> {
        try {
            // Get canvas element
            this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
            this.loadingScreen = document.getElementById('loadingScreen');

            if (!this.canvas) {
                throw new Error('Canvas element not found');
            }

            // Update loading progress
            this.updateLoadingProgress(25, 'Initializing Quantum Tunnel...');

            // Initialize game engine
            this.gameEngine = new GameEngine(this.canvas);
            await this.gameEngine.initialize();

            this.updateLoadingProgress(75, 'Generating Neural Pathways...');

            // Start the game
            await this.gameEngine.start();

            this.updateLoadingProgress(100, 'Neural Core Online!');

            // Initialize building placement UI
            this.initializeBuildingPlacementUI();

            // Initialize mineral reserve UI
            this.initializeMineralReserveUI();

            // Initialize worker creation UI
            this.initializeWorkerCreationUI();

            // Initialize protector creation UI
            this.initializeProtectorCreationUI();

            // Hide loading screen after a brief delay
            setTimeout(() => {
                this.hideLoadingScreen();
            }, 500);

        } catch (error) {
            this.showError('Neural Core Initialization Failed. Please refresh the page.');
        }
    }

    /**
     * Update loading progress
     */
    private updateLoadingProgress(percent: number, text: string): void {
        const progressBar = document.getElementById('loadingProgress');
        const loadingText = document.getElementById('loadingText');

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }

        if (loadingText) {
            loadingText.textContent = text;
        }
    }

    /**
     * Hide loading screen
     */
    private hideLoadingScreen(): void {
        if (this.loadingScreen) {
            this.loadingScreen.classList.add('hidden');
        }
    }

    /**
     * Show error message
     */
    private showError(message: string): void {
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.textContent = message;
            loadingText.style.color = '#ff4444';
        }
    }

    /**
     * Initialize worker creation UI
     */
    private initializeWorkerCreationUI(): void {
        if (!this.gameEngine) {
            return;
        }

        const energyManager = this.gameEngine.getEnergyManager();
        const unitManager = this.gameEngine.getUnitManager();
        const buildingManager = this.gameEngine.getBuildingManager();
        const terrainGenerator = this.gameEngine.getTerrainGenerator();

        if (!energyManager || !unitManager || !buildingManager || !terrainGenerator) {
            return;
        }

        this.workerCreationUI = new WorkerCreationUI({
            containerId: 'worker-creation-ui',
            energyManager: energyManager,
            unitManager: unitManager,
            buildingManager: buildingManager,
            terrainGenerator: terrainGenerator
        });
    }

    /**
     * Initialize protector creation UI
     */
    private initializeProtectorCreationUI(): void {
        if (!this.gameEngine) {
            return;
        }

        const energyManager = this.gameEngine.getEnergyManager();
        const unitManager = this.gameEngine.getUnitManager();
        const buildingManager = this.gameEngine.getBuildingManager();
        const terrainGenerator = this.gameEngine.getTerrainGenerator();

        if (!energyManager || !unitManager || !buildingManager || !terrainGenerator) {
            return;
        }

        this.protectorCreationUI = new ProtectorCreationUI({
            containerId: 'protector-creation-ui',
            energyManager: energyManager,
            unitManager: unitManager,
            buildingManager: buildingManager,
            terrainGenerator: terrainGenerator
        });
    }

    /**
     * Initialize mineral reserve UI
     */
    private initializeMineralReserveUI(): void {
        this.mineralReserveUI = new MineralReserveUI({
            containerId: 'mineral-reserve-ui'
        });
    }

    /**
     * Initialize building placement UI
     */
    private initializeBuildingPlacementUI(): void {
        if (!this.gameEngine) {
            return;
        }

        const scene = this.gameEngine.getScene();
        const buildingManager = this.gameEngine.getBuildingManager();
        const energyManager = this.gameEngine.getEnergyManager();

        if (!scene || !buildingManager || !energyManager) {
            return;
        }

        this.buildingPlacementUI = new BuildingPlacementUI({
            containerId: 'building-placement-ui',
            scene: scene,
            buildingManager: buildingManager,
            energyManager: energyManager
        });
    }

    /**
     * Cleanup on page unload
     */
    public dispose(): void {
        if (this.introductionScreen) {
            this.introductionScreen.dispose();
            this.introductionScreen = null;
        }

        if (this.protectorCreationUI) {
            this.protectorCreationUI.dispose();
            this.protectorCreationUI = null;
        }

        if (this.workerCreationUI) {
            this.workerCreationUI.dispose();
            this.workerCreationUI = null;
        }

        if (this.mineralReserveUI) {
            this.mineralReserveUI.dispose();
            this.mineralReserveUI = null;
        }

        if (this.buildingPlacementUI) {
            this.buildingPlacementUI.dispose();
            this.buildingPlacementUI = null;
        }

        if (this.gameEngine) {
            this.gameEngine.dispose();
            this.gameEngine = null;
        }
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const app = new Application();

    // Handle page unload
    window.addEventListener('beforeunload', () => {
        app.dispose();
    });

    // Start the application
    await app.init();

    // Expose classes to global scope for testing
    (window as any).BuildingAction = BuildingAction;
    (window as any).MovementAction = MovementAction;
    (window as any).Vector3 = Vector3;
});

// Handle window resize
window.addEventListener('resize', () => {
    // Engine will handle resize automatically
});