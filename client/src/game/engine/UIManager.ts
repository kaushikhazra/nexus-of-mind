/**
 * UIManager - Manages all UI system initialization and coordination
 * 
 * Extracted from GameEngine to maintain the 500-line limit.
 * Handles initialization of all UI components including energy display,
 * territory visualization, protector selection, and victory screens.
 */

import { Scene } from '@babylonjs/core';
import { EnergyDisplay } from '../../ui/EnergyDisplay';
import { MiningAnalysisTooltip } from '../../ui/MiningAnalysisTooltip';
import { ProtectorSelectionUI } from '../../ui/ProtectorSelectionUI';
import { QueenGrowthUI } from '../../ui/QueenGrowthUI';
import { TerritoryVisualUI } from '../../ui/TerritoryVisualUI';
import { EnergyLordsHUD } from '../../ui/EnergyLordsHUD';
import { VictoryScreen } from '../../ui/VictoryScreen';
import { EnergyLordsEvent } from '../systems/EnergyLordsManager';
import { SystemManager } from './SystemManager';
import { InputHandler } from './InputHandler';

export interface UIComponents {
    energyDisplay: EnergyDisplay | null;
    miningAnalysisTooltip: MiningAnalysisTooltip | null;
    protectorSelectionUI: ProtectorSelectionUI | null;
    queenGrowthUI: QueenGrowthUI | null;
    territoryVisualUI: TerritoryVisualUI | null;
    energyLordsHUD: EnergyLordsHUD | null;
    victoryScreen: VictoryScreen | null;
}

export class UIManager {
    private components: UIComponents = {
        energyDisplay: null,
        miningAnalysisTooltip: null,
        protectorSelectionUI: null,
        queenGrowthUI: null,
        territoryVisualUI: null,
        energyLordsHUD: null,
        victoryScreen: null
    };

    /**
     * Initialize all UI systems
     */
    public initializeUI(scene: Scene, systemManager: SystemManager, inputHandler: InputHandler): UIComponents {
        this.initializeEnergyUI();
        this.initializeEnergyLordsUI(systemManager);
        this.initializeMiningAnalysisTooltip(scene);
        this.initializeProtectorSelectionUI(inputHandler);
        this.initializeQueenGrowthUI(systemManager);
        this.initializeTerritoryVisualUI(scene);

        return this.components;
    }

    /**
     * Initialize energy UI display
     */
    private initializeEnergyUI(): void {
        // Create energy display container if it doesn't exist
        let energyContainer = document.getElementById('energy-display');
        if (!energyContainer) {
            energyContainer = document.createElement('div');
            energyContainer.id = 'energy-display';
            energyContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
            `;
            document.body.appendChild(energyContainer);
        }

        this.components.energyDisplay = new EnergyDisplay({
            containerId: 'energy-display',
            showDetails: true,
            showHistory: false
        });
    }

    /**
     * Initialize Energy Lords progression UI
     */
    private initializeEnergyLordsUI(systemManager: SystemManager): void {
        const energyLordsManager = systemManager.getEnergyLordsManager();
        if (!energyLordsManager) {
            return;
        }

        // Create HUD container
        let hudContainer = document.getElementById('energy-lords-hud');
        if (!hudContainer) {
            hudContainer = document.createElement('div');
            hudContainer.id = 'energy-lords-hud';
            hudContainer.style.cssText = `
                position: fixed;
                top: 420px;
                left: 20px;
                z-index: 1000;
            `;
            document.body.appendChild(hudContainer);
        }

        this.components.energyLordsHUD = new EnergyLordsHUD({
            containerId: 'energy-lords-hud'
        });
        this.components.energyLordsHUD.setManager(energyLordsManager);

        // Initialize Victory Screen
        this.components.victoryScreen = new VictoryScreen({
            onContinue: () => {
                window.location.reload();
            }
        });

        // Subscribe to victory events
        energyLordsManager.addEventListener((event: EnergyLordsEvent) => {
            if (event.type === 'victory' && this.components.victoryScreen) {
                this.components.victoryScreen.show(event.data);
            }
        });
    }

    /**
     * Initialize mining analysis tooltip
     */
    private initializeMiningAnalysisTooltip(scene: Scene): void {
        this.components.miningAnalysisTooltip = new MiningAnalysisTooltip(scene);
    }

    /**
     * Initialize protector selection UI
     */
    private initializeProtectorSelectionUI(inputHandler: InputHandler): void {
        this.components.protectorSelectionUI = new ProtectorSelectionUI();
        
        // Wire with input handler
        inputHandler.setProtectorSelectionUI(this.components.protectorSelectionUI);
    }

    /**
     * Initialize Queen growth UI
     */
    private initializeQueenGrowthUI(systemManager: SystemManager): void {
        let queenGrowthContainer = document.getElementById('queen-growth-display');
        if (!queenGrowthContainer) {
            queenGrowthContainer = document.createElement('div');
            queenGrowthContainer.id = 'queen-growth-display';
            queenGrowthContainer.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 1000;
            `;
            document.body.appendChild(queenGrowthContainer);
        }

        this.components.queenGrowthUI = new QueenGrowthUI({
            containerId: 'queen-growth-display'
        });

        // Connect territory manager to Queen growth UI
        const territoryManager = systemManager.getTerritoryManager();
        if (this.components.queenGrowthUI && territoryManager) {
            this.components.queenGrowthUI.setTerritoryManager(territoryManager);
        }
    }

    /**
     * Initialize territory visual UI
     */
    private initializeTerritoryVisualUI(scene: Scene): void {
        this.components.territoryVisualUI = new TerritoryVisualUI({ 
            containerId: 'territory-visual-display' 
        });
    }

    /**
     * Get UI components
     */
    public getComponents(): UIComponents {
        return this.components;
    }

    /**
     * Dispose of all UI components
     */
    public dispose(): void {
        this.components.victoryScreen?.dispose();
        this.components.energyLordsHUD?.dispose();
        this.components.territoryVisualUI?.dispose();
        this.components.queenGrowthUI?.dispose();
        this.components.miningAnalysisTooltip?.dispose();
        this.components.protectorSelectionUI?.dispose();
        this.components.energyDisplay?.dispose();

        // Reset all components to null
        this.components = {
            energyDisplay: null,
            miningAnalysisTooltip: null,
            protectorSelectionUI: null,
            queenGrowthUI: null,
            territoryVisualUI: null,
            energyLordsHUD: null,
            victoryScreen: null
        };
    }
}