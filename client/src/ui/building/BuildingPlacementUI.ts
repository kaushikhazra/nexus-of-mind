/**
 * BuildingPlacementUI - Interactive building placement system coordinator
 *
 * Provides UI controls for placing buildings in the 3D world with mouse interaction.
 * Refactored to delegate to extracted modules for SOLID compliance.
 */

import { Scene, Vector3, PointerEventTypes } from '@babylonjs/core';
import { GameEngine } from '../../game/GameEngine';
import type { EnergyManager } from '../../game/EnergyManager';
import type {
    BuildingType,
    BuildingPlacementConfig,
    MiningAnalysis
} from './BuildingPlacementInterfaces';
import { DEFAULT_BUILDING_COSTS, PLACEMENT_CONSTANTS } from './BuildingPlacementInterfaces';
import { BuildingPreviewManager } from './BuildingPreviewManager';
import { MiningRangeVisualizer } from './MiningRangeVisualizer';
import { BuildingPlacementValidator } from './BuildingPlacementValidator';
import { BuildingSpawner } from './BuildingSpawner';
import {
    UI_COLORS,
    UI_TYPOGRAPHY,
    UI_DIMENSIONS,
    getPanelStyles,
    getHeaderStyles,
    getButtonStyles,
    getButtonHoverStyles,
    getButtonBaseStyles,
    injectSharedStyles
} from '../styles';

export class BuildingPlacementUI {
    private scene: Scene;
    private energyManager: EnergyManager;
    private container: HTMLElement | null = null;

    private previewManager: BuildingPreviewManager;
    private rangeVisualizer: MiningRangeVisualizer;
    private validator: BuildingPlacementValidator;
    private spawner: BuildingSpawner;

    private isPlacementMode: boolean = false;
    private currentBuildingType: BuildingType | null = null;
    private currentMousePosition: Vector3 | null = null;
    private currentMiningAnalysis: MiningAnalysis | null = null;

    private pointerObserver: any = null;
    private lastMouseMoveTime: number = 0;

    private buildingButtons: Map<BuildingType, HTMLElement> = new Map();
    private cancelButton: HTMLElement | null = null;
    private statusText: HTMLElement | null = null;

    constructor(config: BuildingPlacementConfig) {
        this.scene = config.scene;
        this.energyManager = config.energyManager;
        this.container = document.getElementById(config.containerId);

        this.previewManager = new BuildingPreviewManager(config.scene);
        this.rangeVisualizer = new MiningRangeVisualizer(config.scene);
        this.validator = new BuildingPlacementValidator();
        this.spawner = new BuildingSpawner();

        if (!this.container) {
            console.error(`Building placement container not found: ${config.containerId}`);
            return;
        }

        this.initialize();
    }

    private initialize(): void {
        this.createUI();
        this.setupMouseInteraction();
    }

    private createUI(): void {
        if (!this.container) return;

        // Inject shared animations
        injectSharedStyles();

        this.container.innerHTML = '';

        const buildingPanel = document.createElement('div');
        buildingPanel.className = 'building-panel game-ui-panel';
        buildingPanel.style.cssText = getPanelStyles('cyan');

        const title = document.createElement('div');
        title.style.cssText = getHeaderStyles('cyan');
        title.textContent = '◊ CONSTRUCTION ◊';

        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: ${UI_DIMENSIONS.panel.gap};
            margin-bottom: 12px;
        `;

        const baseButton = this.createBuildingButton('base', 'BUILD BASE', '50J', UI_COLORS.warning);
        this.buildingButtons.set('base', baseButton);
        buttonsContainer.appendChild(baseButton);

        const powerPlantButton = this.createBuildingButton('powerPlant', 'BUILD POWER PLANT', '30J', UI_COLORS.warningAlt);
        this.buildingButtons.set('powerPlant', powerPlantButton);
        buttonsContainer.appendChild(powerPlantButton);

        this.cancelButton = document.createElement('button');
        this.cancelButton.style.cssText = `
            ${getButtonStyles(UI_COLORS.danger)}
            display: none;
        `;
        this.cancelButton.textContent = 'CANCEL PLACEMENT';
        this.cancelButton.addEventListener('click', () => this.cancelPlacement());

        this.statusText = document.createElement('div');
        this.statusText.style.cssText = `
            font-size: ${UI_TYPOGRAPHY.sizes.xs};
            color: ${UI_COLORS.primary};
            text-align: center;
            margin-top: 8px;
            min-height: 20px;
        `;
        this.statusText.textContent = 'Select a building to construct';

        buildingPanel.appendChild(title);
        buildingPanel.appendChild(buttonsContainer);
        buildingPanel.appendChild(this.cancelButton);
        buildingPanel.appendChild(this.statusText);

        this.container.appendChild(buildingPanel);
    }

    private createBuildingButton(type: BuildingType, label: string, cost: string, color: string): HTMLElement {
        const button = document.createElement('button');
        button.style.cssText = getButtonStyles(color);

        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;

        const costSpan = document.createElement('span');
        costSpan.style.cssText = `font-weight: ${UI_TYPOGRAPHY.weights.semibold}; margin-left: 8px;`;
        costSpan.textContent = cost;

        button.appendChild(labelSpan);
        button.appendChild(costSpan);

        button.addEventListener('mouseenter', () => {
            const hover = getButtonHoverStyles(color);
            button.style.background = hover.background;
            button.style.boxShadow = hover.boxShadow;
        });

        button.addEventListener('mouseleave', () => {
            const base = getButtonBaseStyles();
            button.style.background = base.background;
            button.style.boxShadow = base.boxShadow;
        });

        button.addEventListener('click', () => this.startBuildingPlacement(type));

        return button;
    }

    private startBuildingPlacement(buildingType: BuildingType): void {
        const cost = DEFAULT_BUILDING_COSTS[buildingType];
        if (this.energyManager.getTotalEnergy() < cost) {
            this.updateStatus(`Insufficient energy! Need ${cost}J`, '#ff4444');
            return;
        }

        this.isPlacementMode = true;
        this.currentBuildingType = buildingType;

        this.buildingButtons.forEach(button => {
            button.style.display = 'none';
        });

        if (this.cancelButton) {
            this.cancelButton.style.display = 'block';
        }

        this.updateStatus('Move mouse to position, click to place', '#00ff00');
        this.previewManager.createPreview(buildingType);
    }

    private cancelPlacement(): void {
        this.isPlacementMode = false;
        this.currentBuildingType = null;
        this.currentMiningAnalysis = null;

        this.previewManager.disposePreview();
        this.rangeVisualizer.clearIndicators();

        this.buildingButtons.forEach(button => {
            button.style.display = 'flex';
        });

        if (this.cancelButton) {
            this.cancelButton.style.display = 'none';
        }

        this.updateStatus('Select a building to construct', '#00ccff');
    }

    private setupMouseInteraction(): void {
        if (!this.scene) return;

        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            if (!this.isPlacementMode) return;

            switch (pointerInfo.type) {
                case PointerEventTypes.POINTERMOVE:
                    this.handleMouseMove();
                    break;
                case PointerEventTypes.POINTERDOWN:
                    this.handleMouseClick();
                    break;
            }
        });
    }

    private handleMouseMove(): void {
        const now = performance.now();
        if (now - this.lastMouseMoveTime < PLACEMENT_CONSTANTS.MOUSE_MOVE_THROTTLE_INTERVAL) {
            return;
        }
        this.lastMouseMoveTime = now;

        const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);

        if (pickInfo?.hit && pickInfo.pickedPoint) {
            this.currentMousePosition = pickInfo.pickedPoint.clone();

            const terrainHeight = this.currentMousePosition.y;
            const buildingHeight = this.previewManager.getPreviewHeight(this.currentBuildingType);
            const finalY = terrainHeight + buildingHeight;

            this.previewManager.updatePosition(
                this.currentMousePosition.x,
                finalY,
                this.currentMousePosition.z
            );

            const isValid = this.validator.isValidPosition(this.currentMousePosition);

            if (this.currentBuildingType === 'base') {
                this.currentMiningAnalysis = this.validator.analyzeMiningPotential(this.currentMousePosition);
                this.rangeVisualizer.showIndicators(this.currentMiningAnalysis, this.currentMousePosition);
                this.previewManager.updateColorForEfficiency(isValid, this.currentMiningAnalysis.efficiency);

                if (isValid) {
                    const cost = DEFAULT_BUILDING_COSTS[this.currentBuildingType];
                    const workerText = `${this.currentMiningAnalysis.workerCount} workers can mine`;
                    const efficiencyText = this.currentMiningAnalysis.efficiency.toUpperCase();
                    this.updateStatus(
                        `${workerText} - ${efficiencyText} efficiency - Click to place BASE (${cost}J)`,
                        this.validator.getEfficiencyColor(this.currentMiningAnalysis.efficiency)
                    );
                } else {
                    this.updateStatus('Invalid placement location - too close to other buildings', '#ff4444');
                }
            } else {
                if (isValid) {
                    this.previewManager.updateColorValid();
                    const cost = DEFAULT_BUILDING_COSTS[this.currentBuildingType!];
                    this.updateStatus(`Click to place ${this.currentBuildingType?.toUpperCase()} (${cost}J)`, '#00ff00');
                } else {
                    this.previewManager.updateColorInvalid();
                    this.updateStatus('Invalid placement location - too close to other buildings', '#ff4444');
                }
            }
        }
    }

    private handleMouseClick(): void {
        if (!this.currentMousePosition || !this.currentBuildingType) {
            return;
        }

        if (!this.validator.isValidPosition(this.currentMousePosition)) {
            this.updateStatus('Invalid placement location!', '#ff4444');
            return;
        }

        const cost = DEFAULT_BUILDING_COSTS[this.currentBuildingType];
        if (this.energyManager.getTotalEnergy() < cost) {
            this.updateStatus('Insufficient energy!', '#ff4444');
            return;
        }

        this.placeBuilding(this.currentBuildingType, this.currentMousePosition);
    }

    private placeBuilding(buildingType: BuildingType, position: Vector3): void {
        const cost = DEFAULT_BUILDING_COSTS[buildingType];

        const success = this.energyManager.consumeEnergy('building_construction', cost, `build_${buildingType}`);

        if (!success) {
            this.updateStatus('Energy consumption failed!', '#ff4444');
            return;
        }

        this.previewManager.disposePreview();
        this.rangeVisualizer.clearIndicators();

        const gameEngine = GameEngine.getInstance();
        const gameState = gameEngine?.getGameState();
        const buildingManager = gameEngine?.getBuildingManager();

        if (gameState && buildingManager) {
            gameState.createBuilding(buildingType, position, 'player');

            buildingManager.startConstruction(buildingType, position, 'player').then(building => {
                if (building && buildingType === 'base') {
                    this.spawner.spawnWorkersForBase(position);
                }
            });

            this.updateStatus(`${buildingType.toUpperCase()} constructed!`, '#00ff00');
        } else {
            this.updateStatus('Failed to create building!', '#ff4444');
        }

        this.cancelPlacement();
    }

    private updateStatus(message: string, color: string = '#00ccff'): void {
        if (this.statusText) {
            this.statusText.textContent = message;
            this.statusText.style.color = color;
        }
    }

    public setVisible(visible: boolean): void {
        if (this.container) {
            this.container.style.display = visible ? 'block' : 'none';
        }
    }

    public dispose(): void {
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }

        this.previewManager.dispose();
        this.rangeVisualizer.dispose();

        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
