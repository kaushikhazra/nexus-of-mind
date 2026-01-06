/**
 * BuildingPlacementUI - Interactive building placement system
 * 
 * Provides UI controls for placing buildings in the 3D world with mouse interaction.
 * Handles preview visualization, energy cost validation, and placement confirmation.
 */

import { Scene, Vector3, Mesh, MeshBuilder, StandardMaterial, Color3, PointerEventTypes } from '@babylonjs/core';
import { GameEngine } from '../game/GameEngine';
import { BuildingManager } from '../game/BuildingManager';
import { EnergyManager } from '../game/EnergyManager';

export type BuildingType = 'base' | 'power_plant';

export interface BuildingPlacementConfig {
    containerId: string;
    scene: Scene;
    buildingManager: BuildingManager;
    energyManager: EnergyManager;
}

export class BuildingPlacementUI {
    private scene: Scene;
    private buildingManager: BuildingManager;
    private energyManager: EnergyManager;
    private container: HTMLElement | null = null;
    
    // Placement state
    private isPlacementMode: boolean = false;
    private currentBuildingType: BuildingType | null = null;
    private previewMesh: Mesh | null = null;
    private previewMaterial: StandardMaterial | null = null;
    
    // Mouse interaction
    private pointerObserver: any = null;
    private currentMousePosition: Vector3 | null = null;
    
    // UI elements
    private buildingButtons: Map<BuildingType, HTMLElement> = new Map();
    private cancelButton: HTMLElement | null = null;
    private statusText: HTMLElement | null = null;

    constructor(config: BuildingPlacementConfig) {
        this.scene = config.scene;
        this.buildingManager = config.buildingManager;
        this.energyManager = config.energyManager;
        
        this.container = document.getElementById(config.containerId);
        
        if (!this.container) {
            console.error(`⚠️ Building placement container not found: ${config.containerId}`);
            return;
        }

        this.initialize();
    }

    /**
     * Initialize the building placement UI
     */
    private initialize(): void {
        this.createUI();
        this.setupMouseInteraction();
        this.createPreviewMaterials();
        
        console.log('🏗️ BuildingPlacementUI initialized');
    }

    /**
     * Create the UI elements
     */
    private createUI(): void {
        if (!this.container) return;

        // Clear existing content
        this.container.innerHTML = '';
        
        // Main building panel
        const buildingPanel = document.createElement('div');
        buildingPanel.className = 'building-panel';
        buildingPanel.style.cssText = `
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
        `;

        // Title
        const title = document.createElement('div');
        title.style.cssText = `
            font-size: 14px;
            font-weight: 700;
            text-align: center;
            margin-bottom: 12px;
            color: #00ffff;
            text-shadow: 0 0 8px rgba(0, 255, 255, 0.6);
            letter-spacing: 1px;
        `;
        title.textContent = '◊ CONSTRUCTION ◊';

        // Building buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 12px;
        `;

        // Base building button
        const baseButton = this.createBuildingButton('base', 'BUILD BASE', '50J', '#ffff00');
        this.buildingButtons.set('base', baseButton);
        buttonsContainer.appendChild(baseButton);

        // Power plant building button
        const powerPlantButton = this.createBuildingButton('power_plant', 'BUILD POWER PLANT', '75J', '#ff8800');
        this.buildingButtons.set('power_plant', powerPlantButton);
        buttonsContainer.appendChild(powerPlantButton);

        // Cancel button (initially hidden)
        this.cancelButton = document.createElement('button');
        this.cancelButton.style.cssText = `
            background: rgba(255, 0, 0, 0.2);
            border: 1px solid #ff4444;
            border-radius: 4px;
            color: #ff4444;
            padding: 8px 12px;
            font-family: 'Orbitron', monospace;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: none;
        `;
        this.cancelButton.textContent = 'CANCEL PLACEMENT';
        this.cancelButton.addEventListener('click', () => this.cancelPlacement());

        // Status text
        this.statusText = document.createElement('div');
        this.statusText.style.cssText = `
            font-size: 10px;
            color: #00ccff;
            text-align: center;
            margin-top: 8px;
            min-height: 20px;
        `;
        this.statusText.textContent = 'Select a building to construct';

        // Assemble UI
        buildingPanel.appendChild(title);
        buildingPanel.appendChild(buttonsContainer);
        buildingPanel.appendChild(this.cancelButton);
        buildingPanel.appendChild(this.statusText);

        this.container.appendChild(buildingPanel);
    }

    /**
     * Create a building button
     */
    private createBuildingButton(type: BuildingType, label: string, cost: string, color: string): HTMLElement {
        const button = document.createElement('button');
        button.style.cssText = `
            background: rgba(0, 20, 40, 0.4);
            border: 1px solid ${color};
            border-radius: 4px;
            color: ${color};
            padding: 10px 12px;
            font-family: 'Orbitron', monospace;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;

        const costSpan = document.createElement('span');
        costSpan.style.cssText = 'font-weight: 600;';
        costSpan.textContent = cost;

        button.appendChild(labelSpan);
        button.appendChild(costSpan);

        // Hover effects
        button.addEventListener('mouseenter', () => {
            button.style.background = `rgba(0, 40, 80, 0.6)`;
            button.style.boxShadow = `0 0 10px ${color}40`;
        });

        button.addEventListener('mouseleave', () => {
            button.style.background = 'rgba(0, 20, 40, 0.4)';
            button.style.boxShadow = 'none';
        });

        // Click handler
        button.addEventListener('click', () => this.startBuildingPlacement(type));

        return button;
    }

    /**
     * Start building placement mode
     */
    private startBuildingPlacement(buildingType: BuildingType): void {
        // Check energy cost
        const cost = this.getBuildingCost(buildingType);
        if (this.energyManager.getTotalEnergy() < cost) {
            this.updateStatus(`Insufficient energy! Need ${cost}J`, '#ff4444');
            return;
        }

        this.isPlacementMode = true;
        this.currentBuildingType = buildingType;
        
        // Update UI
        this.buildingButtons.forEach(button => {
            button.style.display = 'none';
        });
        
        if (this.cancelButton) {
            this.cancelButton.style.display = 'block';
        }
        
        this.updateStatus('Move mouse to position, click to place', '#00ff00');
        
        // Create preview mesh
        this.createPreviewMesh(buildingType);
        
        console.log(`🏗️ Started placement mode for ${buildingType}`);
    }

    /**
     * Cancel building placement
     */
    private cancelPlacement(): void {
        this.isPlacementMode = false;
        this.currentBuildingType = null;
        
        // Remove preview mesh
        if (this.previewMesh) {
            this.previewMesh.dispose();
            this.previewMesh = null;
        }
        
        // Update UI
        this.buildingButtons.forEach(button => {
            button.style.display = 'flex';
        });
        
        if (this.cancelButton) {
            this.cancelButton.style.display = 'none';
        }
        
        this.updateStatus('Select a building to construct', '#00ccff');
        
        console.log('🏗️ Cancelled placement mode');
    }

    /**
     * Create preview mesh for building placement
     */
    private createPreviewMesh(buildingType: BuildingType): void {
        if (!this.scene) return;

        // Remove existing preview
        if (this.previewMesh) {
            this.previewMesh.dispose();
        }

        // Create preview mesh based on building type
        if (buildingType === 'base') {
            this.previewMesh = MeshBuilder.CreateBox('building_preview', {
                width: 4,
                height: 3,
                depth: 4
            }, this.scene);
        } else if (buildingType === 'power_plant') {
            this.previewMesh = MeshBuilder.CreateCylinder('building_preview', {
                diameter: 3,
                height: 4,
                tessellation: 8
            }, this.scene);
        }

        if (this.previewMesh && this.previewMaterial) {
            this.previewMesh.material = this.previewMaterial;
            this.previewMesh.position.y = 1.5; // Hover above ground
            this.previewMesh.isPickable = false; // Don't interfere with mouse picking
        }
    }

    /**
     * Create preview materials
     */
    private createPreviewMaterials(): void {
        if (!this.scene) return;

        this.previewMaterial = new StandardMaterial('building_preview_material', this.scene);
        this.previewMaterial.diffuseColor = new Color3(0, 1, 1); // Cyan
        this.previewMaterial.alpha = 0.5;
        this.previewMaterial.wireframe = true;
    }

    /**
     * Setup mouse interaction for building placement
     */
    private setupMouseInteraction(): void {
        if (!this.scene) return;

        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            if (!this.isPlacementMode) return;

            switch (pointerInfo.type) {
                case PointerEventTypes.POINTERMOVE:
                    this.handleMouseMove(pointerInfo);
                    break;
                case PointerEventTypes.POINTERDOWN:
                    this.handleMouseClick(pointerInfo);
                    break;
            }
        });
    }

    /**
     * Handle mouse move for preview positioning
     */
    private handleMouseMove(pointerInfo: any): void {
        if (!this.previewMesh || !this.scene) return;

        // Get world position from mouse
        const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        
        if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
            this.currentMousePosition = pickInfo.pickedPoint.clone();
            this.previewMesh.position.x = this.currentMousePosition.x;
            this.previewMesh.position.z = this.currentMousePosition.z;
            
            // Check if position is valid
            const isValid = this.isValidBuildingPosition(this.currentMousePosition);
            if (this.previewMaterial) {
                this.previewMaterial.diffuseColor = isValid ? 
                    new Color3(0, 1, 0) : // Green for valid
                    new Color3(1, 0, 0);  // Red for invalid
            }
        }
    }

    /**
     * Handle mouse click for building placement
     */
    private handleMouseClick(pointerInfo: any): void {
        if (!this.currentMousePosition || !this.currentBuildingType) return;

        // Validate placement
        if (!this.isValidBuildingPosition(this.currentMousePosition)) {
            this.updateStatus('Invalid placement location!', '#ff4444');
            return;
        }

        // Check energy cost again
        const cost = this.getBuildingCost(this.currentBuildingType);
        if (this.energyManager.getTotalEnergy() < cost) {
            this.updateStatus('Insufficient energy!', '#ff4444');
            return;
        }

        // Place the building
        this.placeBuilding(this.currentBuildingType, this.currentMousePosition);
    }

    /**
     * Check if building position is valid
     */
    private isValidBuildingPosition(position: Vector3): boolean {
        // Basic validation - can be expanded
        // Check if position is not too close to other buildings
        // Check if position is on valid terrain
        return true; // For now, allow all positions
    }

    /**
     * Place the building at the specified position
     */
    private placeBuilding(buildingType: BuildingType, position: Vector3): void {
        const cost = this.getBuildingCost(buildingType);
        
        // Consume energy
        const success = this.energyManager.consumeEnergy('building_construction', cost, `build_${buildingType}`);
        
        if (!success) {
            this.updateStatus('Energy consumption failed!', '#ff4444');
            return;
        }

        // Create the building through BuildingManager
        const gameEngine = GameEngine.getInstance();
        const gameState = gameEngine?.getGameState();
        
        if (gameState) {
            const building = gameState.createBuilding(buildingType, position, 'player');
            console.log(`🏗️ Placed ${buildingType} at ${position.toString()}`);
            this.updateStatus(`${buildingType.toUpperCase()} constructed!`, '#00ff00');
        }

        // Exit placement mode
        this.cancelPlacement();
    }

    /**
     * Get building energy cost
     */
    private getBuildingCost(buildingType: BuildingType): number {
        switch (buildingType) {
            case 'base': return 50;
            case 'power_plant': return 75;
            default: return 0;
        }
    }

    /**
     * Update status text
     */
    private updateStatus(message: string, color: string = '#00ccff'): void {
        if (this.statusText) {
            this.statusText.textContent = message;
            this.statusText.style.color = color;
        }
    }

    /**
     * Set UI visibility
     */
    public setVisible(visible: boolean): void {
        if (this.container) {
            this.container.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Dispose building placement UI
     */
    public dispose(): void {
        // Remove pointer observer
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }

        // Remove preview mesh
        if (this.previewMesh) {
            this.previewMesh.dispose();
            this.previewMesh = null;
        }

        // Remove preview material
        if (this.previewMaterial) {
            this.previewMaterial.dispose();
            this.previewMaterial = null;
        }

        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }

        console.log('🏗️ BuildingPlacementUI disposed');
    }
}