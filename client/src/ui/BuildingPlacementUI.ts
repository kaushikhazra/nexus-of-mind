/**
 * BuildingPlacementUI - Interactive building placement system
 * 
 * Provides UI controls for placing buildings in the 3D world with mouse interaction.
 * Handles preview visualization, energy cost validation, and placement confirmation.
 */

import { Scene, Vector3, Mesh, MeshBuilder, StandardMaterial, Color3, PointerEventTypes, Animation, VertexData, LinesMesh } from '@babylonjs/core';
import { GameEngine } from '../game/GameEngine';
import { BuildingManager } from '../game/BuildingManager';
import { EnergyManager } from '../game/EnergyManager';
import { MineralDeposit } from '../world/MineralDeposit';

export type BuildingType = 'base' | 'powerPlant';

export interface MiningAnalysis {
    reachableNodes: MineralDeposit[];
    workerCount: number;
    efficiency: 'high' | 'medium' | 'low';
    totalCapacity: number;
}

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
    
    // Mining range visualization
    private miningRangeIndicators: Mesh[] = [];
    private miningRangeMaterial: StandardMaterial | null = null;
    private currentMiningAnalysis: MiningAnalysis | null = null;
    
    // Constants
    private readonly WORKER_MINING_RANGE = 5; // Units that workers can mine from
    private readonly WORKER_SPAWN_DISTANCE = 3; // Distance workers spawn from base

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

        // Create power plant building button
        const powerPlantButton = this.createBuildingButton('powerPlant', 'BUILD POWER PLANT', '30J', '#ff8800');
        this.buildingButtons.set('powerPlant', powerPlantButton);
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
        
        // Clear mining range indicators
        this.clearMiningRangeIndicators();
        this.currentMiningAnalysis = null;
        
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
            // Create pyramid preview for base
            const positions = [
                // Base vertices (bottom face)
                -2, 0, -2,  // 0: back-left
                 2, 0, -2,  // 1: back-right
                 2, 0,  2,  // 2: front-right
                -2, 0,  2,  // 3: front-left
                // Apex vertex (top)
                 0, 3, 0    // 4: apex
            ];
            
            const indices = [
                // Base (bottom face) - two triangles
                0, 2, 1,  0, 3, 2,
                // Side faces
                0, 1, 4,  // back face
                1, 2, 4,  // right face
                2, 3, 4,  // front face
                3, 0, 4   // left face
            ];
            
            // Calculate normals for proper lighting
            const normals = [];
            for (let i = 0; i < positions.length; i += 3) {
                normals.push(0, 1, 0); // Simple upward normals
            }
            
            this.previewMesh = new Mesh('building_preview', this.scene);
            const vertexData = new VertexData();
            vertexData.positions = positions;
            vertexData.indices = indices;
            vertexData.normals = normals;
            vertexData.applyToMesh(this.previewMesh);
            
        } else if (buildingType === 'powerPlant') {
            this.previewMesh = MeshBuilder.CreateCylinder('building_preview', {
                diameter: 3,
                height: 4,
                tessellation: 8
            }, this.scene);
        }

        if (this.previewMesh && this.previewMaterial) {
            this.previewMesh.material = this.previewMaterial;
            this.previewMesh.position.y = this.getPreviewHeight();
            this.previewMesh.isPickable = false; // Don't interfere with mouse picking
            this.previewMesh.renderingGroupId = 1; // Render on top of terrain
            
            // Ensure preview is visible
            this.previewMesh.visibility = 1.0;
            
            // Add subtle animation to make preview more visible
            this.animatePreview();
        }
    }

    /**
     * Add subtle animation to preview mesh
     */
    private animatePreview(): void {
        if (!this.previewMesh || !this.scene) return;

        // Create subtle floating animation
        const frameRate = 30;
        
        // Create animation for Y position (floating effect)
        const animationY = new Animation(
            'previewFloat',
            'position.y',
            frameRate,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        // Start with current Y position (will be updated by mouse move)
        const baseY = this.previewMesh.position.y;
        const animationKeys = [];
        animationKeys.push({ frame: 0, value: baseY });
        animationKeys.push({ frame: frameRate, value: baseY + 0.3 });
        animationKeys.push({ frame: frameRate * 2, value: baseY });

        animationY.setKeys(animationKeys);
        this.previewMesh.animations = [animationY];
        
        // Start animation
        this.scene.beginAnimation(this.previewMesh, 0, frameRate * 2, true);
    }

    /**
     * Create preview materials
     */
    private createPreviewMaterials(): void {
        if (!this.scene) return;

        this.previewMaterial = new StandardMaterial('building_preview_material', this.scene);
        this.previewMaterial.diffuseColor = new Color3(0, 1, 1); // Cyan
        this.previewMaterial.alpha = 0.7; // More opaque for better visibility
        this.previewMaterial.wireframe = false;
        this.previewMaterial.emissiveColor = new Color3(0, 0.5, 0.5); // Stronger glow
        this.previewMaterial.disableLighting = true; // Always visible regardless of lighting
        
        // Create mining range indicator material
        this.miningRangeMaterial = new StandardMaterial('mining_range_material', this.scene);
        this.miningRangeMaterial.diffuseColor = new Color3(0, 1, 0); // Green
        this.miningRangeMaterial.alpha = 0.3;
        this.miningRangeMaterial.wireframe = true;
        this.miningRangeMaterial.emissiveColor = new Color3(0, 0.3, 0);
        this.miningRangeMaterial.disableLighting = true;
    }

    /**
     * Analyze mining potential for base placement
     */
    private analyzeMiningPotential(basePosition: Vector3): MiningAnalysis {
        const gameEngine = GameEngine.getInstance();
        const terrainGenerator = gameEngine?.getTerrainGenerator();
        
        if (!terrainGenerator) {
            return {
                reachableNodes: [],
                workerCount: 0,
                efficiency: 'low',
                totalCapacity: 0
            };
        }

        // Get all mineral deposits
        const allDeposits = terrainGenerator.getAllMineralDeposits();
        const reachableNodes: MineralDeposit[] = [];
        let totalCapacity = 0;

        // Calculate worker spawn positions (3 units in front of base)
        const workerPositions = this.calculateWorkerFormationPositions(basePosition);

        // Check which mineral nodes are reachable by workers
        for (const deposit of allDeposits) {
            const depositPosition = deposit.getPosition();
            let canReach = false;

            // Check if any worker position can reach this deposit
            for (const workerPos of workerPositions) {
                const distance = Vector3.Distance(workerPos, depositPosition);
                if (distance <= this.WORKER_MINING_RANGE) {
                    canReach = true;
                    break;
                }
            }

            if (canReach) {
                reachableNodes.push(deposit);
                totalCapacity += deposit.getCapacity();
            }
        }

        // Calculate how many workers can actually mine (based on node distribution)
        const workerCount = Math.min(10, reachableNodes.length * 2); // Assume 2 workers per node max

        // Determine efficiency rating
        let efficiency: 'high' | 'medium' | 'low';
        if (workerCount >= 8) {
            efficiency = 'high';
        } else if (workerCount >= 4) {
            efficiency = 'medium';
        } else {
            efficiency = 'low';
        }

        return {
            reachableNodes,
            workerCount,
            efficiency,
            totalCapacity
        };
    }

    /**
     * Calculate worker formation positions around base
     */
    private calculateWorkerFormationPositions(basePosition: Vector3): Vector3[] {
        const positions: Vector3[] = [];
        const workerCount = 10;
        const radius = this.WORKER_SPAWN_DISTANCE;
        
        // Create semi-circle formation in front of base
        for (let i = 0; i < workerCount; i++) {
            const angle = (Math.PI / (workerCount - 1)) * i - Math.PI / 2; // Semi-circle from -90° to +90°
            const x = basePosition.x + Math.cos(angle) * radius;
            const z = basePosition.z + Math.sin(angle) * radius;
            const y = basePosition.y; // Same height as base
            
            positions.push(new Vector3(x, y, z));
        }
        
        return positions;
    }

    /**
     * Show mining range indicators for base placement
     */
    private showMiningRangeIndicators(analysis: MiningAnalysis): void {
        // Clear existing indicators
        this.clearMiningRangeIndicators();

        if (!this.scene || !this.miningRangeMaterial) return;

        // Create dotted circles around reachable mineral nodes
        for (const deposit of analysis.reachableNodes) {
            const depositPosition = deposit.getPosition();
            
            // Create dotted circle around mineral node
            const circle = this.createDottedCircle(depositPosition, this.WORKER_MINING_RANGE);
            if (circle) {
                circle.material = this.miningRangeMaterial;
                circle.renderingGroupId = 1; // Render on top
                this.miningRangeIndicators.push(circle);
            }

            // Create line from base to mineral node
            const line = this.createConnectionLine(this.currentMousePosition!, depositPosition);
            if (line) {
                line.color = new Color3(0, 1, 0); // Green connection line
                line.renderingGroupId = 1;
                this.miningRangeIndicators.push(line);
            }
        }
    }

    /**
     * Create dotted circle around mineral node
     */
    private createDottedCircle(center: Vector3, radius: number): Mesh | null {
        if (!this.scene) return null;

        const points: Vector3[] = [];
        const segments = 32;
        const dotCount = 16; // Number of dots in circle

        // Create dotted circle by creating segments with gaps
        for (let i = 0; i < dotCount; i++) {
            const startAngle = (i / dotCount) * Math.PI * 2;
            const endAngle = startAngle + (Math.PI * 2) / (dotCount * 2); // Half segment for dot effect
            
            for (let j = 0; j <= 4; j++) { // 4 points per dot segment
                const angle = startAngle + (endAngle - startAngle) * (j / 4);
                const x = center.x + Math.cos(angle) * radius;
                const z = center.z + Math.sin(angle) * radius;
                points.push(new Vector3(x, center.y + 0.1, z)); // Slightly above ground
            }
        }

        if (points.length > 0) {
            const circle = MeshBuilder.CreateLines('mining_range_circle', { points }, this.scene);
            return circle;
        }

        return null;
    }

    /**
     * Create connection line between base and mineral node
     */
    private createConnectionLine(basePosition: Vector3, nodePosition: Vector3): LinesMesh | null {
        if (!this.scene) return null;

        const points = [
            new Vector3(basePosition.x, basePosition.y + 1, basePosition.z), // Slightly above base
            new Vector3(nodePosition.x, nodePosition.y + 1, nodePosition.z)   // Slightly above node
        ];

        return MeshBuilder.CreateLines('mining_connection_line', { points }, this.scene);
    }

    /**
     * Clear mining range indicators
     */
    private clearMiningRangeIndicators(): void {
        for (const indicator of this.miningRangeIndicators) {
            indicator.dispose();
        }
        this.miningRangeIndicators = [];
    }

    /**
     * Get preview height based on building type
     */
    private getPreviewHeight(): number {
        if (!this.currentBuildingType) return 3.0;
        
        switch (this.currentBuildingType) {
            case 'base': return 0; // Pyramid sits on ground (base at y=0)
            case 'powerPlant': return 2.0; // Cylinder center positioned above terrain
            default: return 3.0;
        }
    }

    /**
     * Update preview color based on validity
     */
    private updatePreviewColor(isValid: boolean): void {
        if (!this.previewMaterial) return;
        
        if (isValid) {
            // Green for valid placement
            this.previewMaterial.diffuseColor = new Color3(0, 1, 0);
            this.previewMaterial.emissiveColor = new Color3(0, 0.3, 0);
        } else {
            // Red for invalid placement
            this.previewMaterial.diffuseColor = new Color3(1, 0, 0);
            this.previewMaterial.emissiveColor = new Color3(0.3, 0, 0);
        }
    }

    /**
     * Update preview color based on mining efficiency for base placement
     */
    private updatePreviewColorForMining(isValid: boolean, efficiency: 'high' | 'medium' | 'low'): void {
        if (!this.previewMaterial) return;
        
        if (!isValid) {
            // Red for invalid placement
            this.previewMaterial.diffuseColor = new Color3(1, 0, 0);
            this.previewMaterial.emissiveColor = new Color3(0.3, 0, 0);
            return;
        }

        // Color based on mining efficiency
        switch (efficiency) {
            case 'high':
                // Bright green for high efficiency
                this.previewMaterial.diffuseColor = new Color3(0, 1, 0);
                this.previewMaterial.emissiveColor = new Color3(0, 0.4, 0);
                break;
            case 'medium':
                // Yellow for medium efficiency
                this.previewMaterial.diffuseColor = new Color3(1, 1, 0);
                this.previewMaterial.emissiveColor = new Color3(0.3, 0.3, 0);
                break;
            case 'low':
                // Orange for low efficiency
                this.previewMaterial.diffuseColor = new Color3(1, 0.5, 0);
                this.previewMaterial.emissiveColor = new Color3(0.3, 0.15, 0);
                break;
        }
    }

    /**
     * Get color for efficiency text
     */
    private getEfficiencyColor(efficiency: 'high' | 'medium' | 'low'): string {
        switch (efficiency) {
            case 'high': return '#00ff00';   // Green
            case 'medium': return '#ffff00'; // Yellow
            case 'low': return '#ff8800';    // Orange
        }
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
            
            // Position preview above the actual terrain height
            const terrainHeight = this.currentMousePosition.y;
            const buildingHeight = this.getPreviewHeight();
            const finalY = terrainHeight + buildingHeight;
            this.previewMesh.position.y = finalY;
            
            // Check if position is valid and update preview color
            const isValid = this.isValidBuildingPosition(this.currentMousePosition);
            
            // For base placement, analyze mining potential
            if (this.currentBuildingType === 'base') {
                this.currentMiningAnalysis = this.analyzeMiningPotential(this.currentMousePosition);
                this.showMiningRangeIndicators(this.currentMiningAnalysis);
                
                // Update preview color based on mining efficiency
                this.updatePreviewColorForMining(isValid, this.currentMiningAnalysis.efficiency);
                
                // Update status with mining information
                if (isValid) {
                    const cost = this.getBuildingCost(this.currentBuildingType);
                    const workerText = `${this.currentMiningAnalysis.workerCount} workers can mine`;
                    const efficiencyText = this.currentMiningAnalysis.efficiency.toUpperCase();
                    this.updateStatus(`${workerText} - ${efficiencyText} efficiency - Click to place BASE (${cost}J)`, this.getEfficiencyColor(this.currentMiningAnalysis.efficiency));
                } else {
                    this.updateStatus('Invalid placement location - too close to other buildings', '#ff4444');
                }
            } else {
                // For non-base buildings, use standard validation
                this.updatePreviewColor(isValid);
                
                if (isValid) {
                    const cost = this.getBuildingCost(this.currentBuildingType!);
                    this.updateStatus(`Click to place ${this.currentBuildingType?.toUpperCase()} (${cost}J)`, '#00ff00');
                } else {
                    this.updateStatus('Invalid placement location - too close to other buildings', '#ff4444');
                }
            }
        }
    }

    /**
     * Handle mouse click for building placement
     */
    private handleMouseClick(pointerInfo: any): void {
        console.log(`🖱️ Mouse click detected in placement mode`);
        
        if (!this.currentMousePosition || !this.currentBuildingType) {
            console.warn(`⚠️ Missing position or building type:`, {
                position: this.currentMousePosition,
                buildingType: this.currentBuildingType
            });
            return;
        }

        console.log(`🖱️ Click at position: ${this.currentMousePosition.toString()}`);

        // Validate placement
        if (!this.isValidBuildingPosition(this.currentMousePosition)) {
            console.warn(`❌ Invalid placement position`);
            this.updateStatus('Invalid placement location!', '#ff4444');
            return;
        }

        // Check energy cost again
        const cost = this.getBuildingCost(this.currentBuildingType);
        if (this.energyManager.getTotalEnergy() < cost) {
            console.warn(`❌ Insufficient energy: need ${cost}, have ${this.energyManager.getTotalEnergy()}`);
            this.updateStatus('Insufficient energy!', '#ff4444');
            return;
        }

        console.log(`✅ Placement validation passed, proceeding with building placement`);

        // Place the building
        this.placeBuilding(this.currentBuildingType, this.currentMousePosition);
    }

    /**
     * Check if building position is valid
     */
    private isValidBuildingPosition(position: Vector3): boolean {
        // Basic validation rules
        
        // 1. Check if position is within reasonable bounds
        const maxDistance = 100; // Maximum distance from origin
        if (position.length() > maxDistance) {
            return false;
        }
        
        // 2. Check minimum distance from other buildings
        const minBuildingDistance = 8; // Minimum 8 units between buildings
        const gameEngine = GameEngine.getInstance();
        const gameState = gameEngine?.getGameState();
        
        if (gameState) {
            const allBuildings = gameState.getAllBuildings();
            for (const building of allBuildings) {
                const distance = Vector3.Distance(position, building.position);
                if (distance < minBuildingDistance) {
                    return false;
                }
            }
        }
        
        // 3. Check if position is not on steep terrain (basic check)
        // For now, we'll assume all positions are valid terrain-wise
        // This can be enhanced with actual terrain analysis
        
        return true;
    }

    /**
     * Place the building at the specified position
     */
    private placeBuilding(buildingType: BuildingType, position: Vector3): void {
        const cost = this.getBuildingCost(buildingType);
        
        console.log(`🏗️ Attempting to place ${buildingType} at ${position.toString()} for ${cost}J`);
        
        // Consume energy
        const success = this.energyManager.consumeEnergy('building_construction', cost, `build_${buildingType}`);
        
        if (!success) {
            console.error(`❌ Energy consumption failed for ${buildingType}`);
            this.updateStatus('Energy consumption failed!', '#ff4444');
            return;
        }

        console.log(`✅ Energy consumed: ${cost}J`);

        // IMMEDIATELY remove preview mesh to prevent visual issues
        if (this.previewMesh) {
            console.log(`🗑️ Removing preview mesh before building creation`);
            this.previewMesh.dispose();
            this.previewMesh = null;
        }

        // Create the building through GameState and BuildingManager
        const gameEngine = GameEngine.getInstance();
        const gameState = gameEngine?.getGameState();
        const buildingManager = gameEngine?.getBuildingManager();
        
        if (gameState && buildingManager) {
            console.log(`🏗️ Creating building through GameState and BuildingManager...`);
            
            // Create building in GameState
            const gameBuilding = gameState.createBuilding(buildingType, position, 'player');
            console.log(`✅ GameState building created:`, gameBuilding);
            
            // Start construction through BuildingManager
            buildingManager.startConstruction(buildingType, position, 'player').then(building => {
                if (building) {
                    console.log(`✅ BuildingManager construction completed instantly:`, building.getId());
                } else {
                    console.warn(`⚠️ BuildingManager construction failed`);
                }
            });
            
            this.updateStatus(`${buildingType.toUpperCase()} constructed!`, '#00ff00');
        } else {
            console.error(`❌ GameState or BuildingManager not available`);
            this.updateStatus('Failed to create building!', '#ff4444');
        }

        // Exit placement mode (this will clean up any remaining UI state)
        this.cancelPlacement();
    }

    /**
     * Get building energy cost
     */
    private getBuildingCost(buildingType: BuildingType): number {
        switch (buildingType) {
            case 'base': return 50;
            case 'powerPlant': return 30;
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

        // Remove mining range material
        if (this.miningRangeMaterial) {
            this.miningRangeMaterial.dispose();
            this.miningRangeMaterial = null;
        }

        // Clear mining range indicators
        this.clearMiningRangeIndicators();

        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }

        console.log('🏗️ BuildingPlacementUI disposed');
    }
}