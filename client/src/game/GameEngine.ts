/**
 * GameEngine - Core game engine with Babylon.js initialization
 *
 * Manages the main game loop, scene initialization, and component coordination.
 * Implements singleton pattern for centralized game engine management.
 */

import { Engine, Scene, PointerEventTypes, Vector3, Matrix } from '@babylonjs/core';
import { SceneManager } from '../rendering/SceneManager';
import { CameraController } from '../rendering/CameraController';
import { LightingSetup } from '../rendering/LightingSetup';
import { MaterialManager } from '../rendering/MaterialManager';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { EnergyManager } from './EnergyManager';
import { EnergyDisplay } from '../ui/EnergyDisplay';
import { GameState } from './GameState';
import { UnitManager } from './UnitManager';
import { UnitRenderer } from '../rendering/UnitRenderer';
import { BuildingManager } from './BuildingManager';
import { BuildingRenderer } from '../rendering/BuildingRenderer';
import { MiningAnalysisTooltip } from '../ui/MiningAnalysisTooltip';
import { ProtectorSelectionUI } from '../ui/ProtectorSelectionUI';
import { ParasiteManager } from './ParasiteManager';
import { TreeRenderer } from '../rendering/TreeRenderer';
import { Worker } from './entities/Worker';
import { Protector } from './entities/Protector';
import { CombatSystem } from './CombatSystem';

export class GameEngine {
    private static instance: GameEngine | null = null;

    private engine: Engine | null = null;
    private scene: Scene | null = null;
    private canvas: HTMLCanvasElement;

    // Core managers
    private sceneManager: SceneManager | null = null;
    private cameraController: CameraController | null = null;
    private lightingSetup: LightingSetup | null = null;
    private materialManager: MaterialManager | null = null;
    private performanceMonitor: PerformanceMonitor | null = null;

    // Energy system
    private energyManager: EnergyManager | null = null;
    private energyDisplay: EnergyDisplay | null = null;

    // Game state
    private gameState: GameState | null = null;

    // Unit system
    private unitManager: UnitManager | null = null;
    private unitRenderer: UnitRenderer | null = null;

    // Building system
    private buildingManager: BuildingManager | null = null;
    private buildingRenderer: BuildingRenderer | null = null;

    // Combat system
    private parasiteManager: ParasiteManager | null = null;
    private combatSystem: CombatSystem | null = null;

    // Vegetation system
    private treeRenderer: TreeRenderer | null = null;

    // UI systems
    private miningAnalysisTooltip: MiningAnalysisTooltip | null = null;
    private protectorSelectionUI: ProtectorSelectionUI | null = null;

    private isInitialized: boolean = false;
    private isRunning: boolean = false;

    constructor(canvas: HTMLCanvasElement) {
        if (GameEngine.instance) {
            throw new Error('GameEngine is a singleton. Use GameEngine.getInstance()');
        }

        this.canvas = canvas;
        GameEngine.instance = this;
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): GameEngine | null {
        return GameEngine.instance;
    }

    /**
     * Initialize the game engine
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.warn('GameEngine already initialized');
            return;
        }

        try {
            // Initialize WebGL engine (WebGPU support can be added later)
            this.engine = new Engine(this.canvas, true, {
                preserveDrawingBuffer: true,
                stencil: true,
                antialias: true,
                alpha: false,
                premultipliedAlpha: false,
                powerPreference: 'high-performance'
            });

            if (!this.engine) {
                throw new Error('Failed to create Babylon.js engine');
            }

            // Initialize scene manager
            this.sceneManager = new SceneManager(this.engine);
            this.scene = await this.sceneManager.createScene();

            // Initialize core components
            this.cameraController = new CameraController(this.scene, this.canvas);
            this.lightingSetup = new LightingSetup(this.scene);
            this.materialManager = new MaterialManager(this.scene);
            this.performanceMonitor = new PerformanceMonitor(this.scene, this.engine);

            // Initialize energy system
            this.energyManager = EnergyManager.getInstance();
            this.energyManager.initialize(500); // Start with 500 energy (5x multiplier)

            // Initialize game state
            this.gameState = GameState.getInstance();
            this.gameState.initialize();

            // Initialize unit system
            this.unitRenderer = new UnitRenderer(this.scene, this.materialManager);
            this.unitManager = new UnitManager(this.gameState, this.unitRenderer);

            // Initialize building system
            this.buildingRenderer = new BuildingRenderer(this.scene, this.materialManager);
            this.buildingManager = new BuildingManager(this.gameState, this.buildingRenderer, this.energyManager);

            // Initialize combat system
            this.parasiteManager = new ParasiteManager({
                scene: this.scene,
                materialManager: this.materialManager,
                terrainGenerator: this.getTerrainGenerator()
            });

            // Initialize central combat system
            this.combatSystem = new CombatSystem(this.energyManager);
            
            // Connect combat system to performance monitor for combat-specific monitoring
            if (this.performanceMonitor) {
                this.performanceMonitor.setCombatSystem(this.combatSystem);
            }
            
            // Register combat system with UnitManager for auto-attack integration
            if (this.unitManager) {
                this.unitManager.setCombatSystem(this.combatSystem);
            }

            // Initialize vegetation system
            this.treeRenderer = new TreeRenderer(this.scene);

            // Set terrain generator after terrain is initialized (delayed)
            setTimeout(() => {
                const terrainGen = this.getTerrainGenerator();
                if (terrainGen && this.unitManager && this.parasiteManager) {
                    this.unitManager.setTerrainGenerator(terrainGen);
                    this.parasiteManager.setTerrainGenerator(terrainGen);

                    // Set tree renderer on terrain for infinite tree spawning
                    if (this.treeRenderer) {
                        terrainGen.setTreeRenderer(this.treeRenderer);
                    }
                } else {
                    console.warn('⚠️ Terrain generator not available after delay');
                }
            }, 1000); // 1 second delay to ensure terrain is ready

            // Setup components
            this.cameraController.setupCamera();
            this.lightingSetup.setupLighting();

            // Initialize procedural terrain system
            this.sceneManager.initializeTerrain(this.materialManager, this.cameraController);

            // Initialize energy UI
            this.initializeEnergyUI();

            // Initialize mining analysis tooltip
            this.initializeMiningAnalysisTooltip();

            // Initialize protector selection UI
            this.initializeProtectorSelectionUI();

            // Setup terrain integration with game state
            this.setupTerrainIntegration();

            // Setup mouse interaction for unit selection and mining assignment
            this.setupMouseInteraction();

            // Handle window resize
            window.addEventListener('resize', () => {
                this.engine?.resize();
            });

            this.isInitialized = true;

        } catch (error) {
            console.error('❌ Failed to initialize GameEngine:', error);
            throw error;
        }
    }

    /**
     * Start the game engine and render loop
     */
    public async start(): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('GameEngine must be initialized before starting');
        }

        if (this.isRunning) {
            console.warn('GameEngine already running');
            return;
        }

        try {
            if (!this.engine || !this.scene) {
                throw new Error('Engine or scene not initialized');
            }

            // Start performance monitoring
            this.performanceMonitor?.startMonitoring();

            // Start render loop
            this.engine.runRenderLoop(async () => {
                if (this.scene && this.engine) {
                    // Calculate delta time
                    const deltaTime = this.engine.getDeltaTime() / 1000; // Convert to seconds

                    // Update game state
                    if (this.gameState) {
                        this.gameState.update(deltaTime);
                    }

                    // Update unit system (async for command processing)
                    if (this.unitManager) {
                        await this.unitManager.update(deltaTime);
                    }

                    // Update building system
                    if (this.buildingManager) {
                        this.buildingManager.update(deltaTime);
                    }

                    // Update energy system
                    if (this.energyManager) {
                        this.energyManager.update();
                    }

                    // Update combat system
                    if (this.parasiteManager && this.gameState && this.unitManager) {
                        const mineralDeposits = this.gameState.getAllMineralDeposits();
                        const workers = this.unitManager.getUnitsByType('worker') as Worker[];
                        const protectors = this.unitManager.getUnitsByType('protector') as Protector[];
                        this.parasiteManager.update(deltaTime, mineralDeposits, workers, protectors);
                    }

                    // Update central combat system with auto-attack integration
                    if (this.combatSystem && this.unitManager) {
                        // Handle movement-combat transitions for all protectors
                        this.handleMovementCombatTransitions();
                        
                        // Update combat system
                        this.combatSystem.update(deltaTime);
                    }

                    // Update vegetation animations
                    if (this.treeRenderer) {
                        this.treeRenderer.updateAnimations();
                    }

                    this.scene.render();
                }
            });

            this.isRunning = true;

        } catch (error) {
            console.error('❌ Failed to start GameEngine:', error);
            throw error;
        }
    }

    /**
     * Stop the game engine
     */
    public stop(): void {
        if (!this.isRunning) {
            return;
        }

        if (this.engine) {
            this.engine.stopRenderLoop();
        }

        this.performanceMonitor?.stopMonitoring();
        this.isRunning = false;
    }

    /**
     * Setup terrain integration with game state
     */
    private setupTerrainIntegration(): void {
        const terrainGenerator = this.sceneManager?.getTerrainGenerator();
        if (!terrainGenerator || !this.gameState) {
            return;
        }

        // Add existing mineral deposits to game state
        const deposits = terrainGenerator.getAllMineralDeposits();
        if (this.gameState) {
            deposits.forEach(deposit => {
                this.gameState!.addMineralDeposit(deposit);
            });
        }
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

        // Initialize energy display
        this.energyDisplay = new EnergyDisplay({
            containerId: 'energy-display',
            showDetails: true,
            showHistory: false
        });
    }

    /**
     * Initialize mining analysis tooltip
     */
    private initializeMiningAnalysisTooltip(): void {
        if (!this.scene) {
            console.error('❌ Cannot initialize mining analysis tooltip: Scene not available');
            return;
        }

        this.miningAnalysisTooltip = new MiningAnalysisTooltip(this.scene);
    }

    /**
     * Initialize protector selection UI
     */
    private initializeProtectorSelectionUI(): void {
        this.protectorSelectionUI = new ProtectorSelectionUI();
    }

    /**
     * Get the current scene
     */
    public getScene(): Scene | null {
        return this.scene;
    }

    /**
     * Get the engine
     */
    public getEngine(): Engine | null {
        return this.engine;
    }

    /**
     * Get material manager
     */
    public getMaterialManager(): MaterialManager | null {
        return this.materialManager;
    }

    /**
     * Get camera controller
     */
    public getCameraController(): CameraController | null {
        return this.cameraController;
    }

    /**
     * Get energy manager
     */
    public getEnergyManager(): EnergyManager | null {
        return this.energyManager;
    }

    /**
     * Get terrain generator (for testing mineral deposits)
     */
    public getTerrainGenerator(): any {
        return this.sceneManager?.getTerrainGenerator();
    }

    /**
     * Get game state
     */
    public getGameState(): GameState | null {
        return this.gameState;
    }

    /**
     * Get unit manager
     */
    public getUnitManager(): UnitManager | null {
        return this.unitManager;
    }

    /**
     * Get building manager
     */
    public getBuildingManager(): BuildingManager | null {
        return this.buildingManager;
    }

    /**
     * Get parasite manager
     */
    public getParasiteManager(): ParasiteManager | null {
        return this.parasiteManager;
    }

    /**
     * Get combat system
     */
    public getCombatSystem(): CombatSystem | null {
        return this.combatSystem;
    }
    /**
     * Handle movement-combat transitions for auto-attack system
     * This method checks for enemy detection during protector movement
     * and initiates auto-attack when enemies are detected within range
     */
    private handleMovementCombatTransitions(): void {
        if (!this.combatSystem || !this.unitManager) {
            return;
        }

        // Get all active protectors
        const protectors = this.unitManager.getUnitsByType('protector') as Protector[];
        
        for (const protector of protectors) {
            // Only check for auto-detection if protector is moving
            const protectorStats = protector.getProtectorStats();
            if (protectorStats.combatState === 'moving' && protectorStats.autoAttackEnabled) {
                
                // Check for enemy detection during movement
                const detectedTarget = this.combatSystem.checkMovementDetection(protector);
                
                if (detectedTarget) {
                    // Get protector's original destination for movement resumption
                    const originalDestination = protector.getOriginalDestination();
                    
                    // Initiate auto-attack with original destination tracking
                    const autoAttackInitiated = this.combatSystem.initiateAutoAttack(
                        protector, 
                        detectedTarget, 
                        originalDestination || undefined
                    );
                    
                    if (autoAttackInitiated) {
                        console.log(`🎯 Auto-attack transition: ${protector.getId()} engaging ${detectedTarget.id}`);
                    }
                }
            }
        }
    }

    /**
     * Handle protector attacking a parasite
     */
    public handleProtectorAttack(protectorId: string, targetPosition: Vector3): boolean {
        if (!this.parasiteManager || !this.unitManager) {
            return false;
        }

        const protector = this.unitManager.getUnit(protectorId);
        if (!protector || protector.getUnitType() !== 'protector') {
            return false;
        }

        return this.parasiteManager.handleProtectorAttack(protector as Protector, targetPosition);
    }

    /**
     * Setup mouse interaction for unit selection and mining assignment
     */
    private setupMouseInteraction(): void {
        if (!this.scene || !this.unitManager) {
            console.error('❌ Cannot setup mouse interaction: Scene or UnitManager not available');
            return;
        }

        // Add pointer observable for mouse clicks
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
                this.handleMouseClick(pointerInfo);
            } else if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
                this.handleMouseMove();
            }
        });
    }

    /**
     * Handle mouse move for hover detection (Protector tooltip)
     */
    private handleMouseMove(): void {
        if (!this.scene || !this.unitManager || !this.protectorSelectionUI) return;

        const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);

        if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
            const meshName = pickInfo.pickedMesh.name;

            // Check if hovering over a unit
            if (meshName.startsWith('unit_')) {
                const unitId = meshName.replace('unit_', '');
                const unit = this.unitManager.getUnit(unitId);

                if (unit && unit.getUnitType() === 'protector') {
                    // Show tooltip for Protector
                    this.protectorSelectionUI.show(
                        unit as Protector,
                        this.scene.pointerX,
                        this.scene.pointerY
                    );
                    return;
                }
            }
        }

        // Hide tooltip if not hovering over a Protector
        this.protectorSelectionUI.hide();
    }

    /**
     * Handle mouse click for unit selection and combat/mining assignment
     */
    private handleMouseClick(pointerInfo: any): void {
        if (!this.scene || !this.unitManager) return;

        // Get the pick result
        const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);

        if (!pickInfo || !pickInfo.hit) {
            // Clicked on empty space - issue move commands to selected units
            const selectedUnits = this.unitManager.getSelectedUnits();
            if (selectedUnits.length > 0) {
                // Get the world position where the user clicked
                const ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, Matrix.Identity(), this.scene.activeCamera);
                
                // Intersect with ground plane (y = 0)
                const groundPlane = new Vector3(0, 1, 0); // Normal pointing up
                const groundPoint = new Vector3(0, 0, 0); // Point on plane
                
                // Calculate intersection with ground plane
                const denominator = Vector3.Dot(ray.direction, groundPlane);
                if (Math.abs(denominator) > 0.0001) {
                    const t = Vector3.Dot(groundPoint.subtract(ray.origin), groundPlane) / denominator;
                    if (t >= 0) {
                        const clickPosition = ray.origin.add(ray.direction.scale(t));
                        
                        // Adjust height using terrain generator if available
                        const terrainGenerator = this.getTerrainGenerator();
                        if (terrainGenerator) {
                            const terrainHeight = terrainGenerator.getHeightAtPosition(clickPosition.x, clickPosition.z);
                            clickPosition.y = terrainHeight + 0.5; // Slightly above ground
                        }
                        
                        // Issue move commands to selected units (only Protectors can move to empty terrain)
                        let moveCommandsIssued = 0;
                        let workersSkipped = 0;
                        for (const unit of selectedUnits) {
                            // Workers should only move when clicking on minerals, not empty terrain
                            if (unit.getUnitType() === 'worker') {
                                workersSkipped++;
                                continue;
                            }
                            this.unitManager.issueCommand('move', clickPosition, undefined, undefined);
                            moveCommandsIssued++;
                        }

                        if (moveCommandsIssued > 0) {
                            console.log(`🚶 Issued ${moveCommandsIssued} move commands to (${clickPosition.x.toFixed(1)}, ${clickPosition.z.toFixed(1)})`);
                        }
                        if (workersSkipped > 0) {
                            console.log(`💡 ${workersSkipped} worker(s) ignored - click on minerals to move workers`);
                        }
                        
                        // Clear selection to hide selection mesh after issuing move commands
                        this.unitManager.clearSelection();
                        this.protectorSelectionUI?.hide();
                        return;
                    }
                }
            }

            // Clear selection if no units selected or click position calculation failed
            const currentSelectedUnits = this.unitManager.getSelectedUnits();
            if (currentSelectedUnits.length > 0) {
                console.log(`👋 Cleared selection of ${currentSelectedUnits.length} unit(s)`);
            }
            this.unitManager.clearSelection();
            this.protectorSelectionUI?.hide();
            return;
        }

        const pickedMesh = pickInfo.pickedMesh;
        if (!pickedMesh) return;

        // Check if clicked on a unit
        if (pickedMesh.name.startsWith('unit_')) {
            this.handleUnitClick(pickedMesh);
        }
        // Check if clicked on a parasite (combat target) - handle both parent and segments
        else if (pickedMesh.name.startsWith('parasite_')) {
            this.handleParasiteClick(pickedMesh);
        }
        // Check if clicked on a mineral deposit (mining target)
        else if (pickedMesh.name.startsWith('mineral_chunk_')) {
            this.handleMineralDepositClick(pickedMesh);
        }
        // Check if clicked on terrain (should be treated as movement command)
        else if (pickedMesh.name.startsWith('terrainChunk_') || pickedMesh.name.startsWith('ground') || pickedMesh.name.startsWith('terrain')) {
            this.handleTerrainClick(pickInfo);
        }
        // Clicked on something else - clear selection
        else {
            const currentSelectedUnits = this.unitManager.getSelectedUnits();
            if (currentSelectedUnits.length > 0) {
                console.log(`👋 Cleared selection - clicked on: ${pickedMesh.name}`);
            }
            this.unitManager.clearSelection();
            this.protectorSelectionUI?.hide();
        }
    }

    /**
     * Handle clicking on a unit
     */
    private handleUnitClick(unitMesh: any): void {
        if (!this.unitManager) return;

        // Extract unit ID from mesh name (format: "unit_<unitId>")
        const unitId = unitMesh.name.replace('unit_', '');
        const unit = this.unitManager.getUnit(unitId);

        if (!unit) {
            console.warn(`⚠️ Unit not found for mesh: ${unitMesh.name}`);
            return;
        }

        // Select the clicked unit (single selection for now)
        this.unitManager.selectUnits([unitId]);
        console.log(`👆 Selected ${unit.getUnitType()}: ${unitId}`);

        if (unit.getUnitType() === 'protector') {
            console.log(`💡 Protector selected! Click anywhere to move - auto-attack will engage enemies during movement.`);
        } else if (unit.getUnitType() === 'worker') {
            console.log(`💡 Worker selected! Click on mineral deposits (blue crystals) to mine them.`);
        }
    }

    /**
     * Handle clicking on a parasite (now issues move commands for auto-attack)
     */
    private handleParasiteClick(parasiteMesh: any): void {
        if (!this.unitManager || !this.parasiteManager) return;

        const selectedUnits = this.unitManager.getSelectedUnits();

        if (selectedUnits.length === 0) {
            return;
        }

        let parasiteId: string;
        
        // Handle both direct parasite mesh clicks and segment clicks
        if (parasiteMesh.name.startsWith('parasite_segment_')) {
            // Clicked on a segment - get the parent node
            const parent = parasiteMesh.parent;
            if (parent && parent.name.startsWith('parasite_')) {
                parasiteId = parent.name.replace('parasite_', '');
            } else {
                // Fallback: extract from segment name (format: "parasite_segment_<parasiteId>_<segmentIndex>")
                const nameParts = parasiteMesh.name.split('_');
                if (nameParts.length >= 4) {
                    parasiteId = nameParts.slice(2, -1).join('_');
                } else {
                    console.warn(`⚠️ Invalid parasite segment name format: ${parasiteMesh.name}`);
                    return;
                }
            }
        } else if (parasiteMesh.name.startsWith('parasite_')) {
            // Direct parasite mesh click
            parasiteId = parasiteMesh.name.replace('parasite_', '');
        } else {
            console.warn(`⚠️ Invalid parasite mesh name: ${parasiteMesh.name}`);
            return;
        }
        
        // Verify parasite exists and get its position
        const parasite = this.parasiteManager.getParasiteById(parasiteId);
        if (!parasite) {
            console.warn(`⚠️ Parasite not found: ${parasiteId}`);
            return;
        }

        // Get parasite position for movement command
        const parasitePosition = parasite.getPosition();

        // Issue move commands to selected protectors (auto-attack will trigger during movement)
        let moveCommandsIssued = 0;
        for (const unit of selectedUnits) {
            if (unit.getUnitType() === 'protector') {
                // Issue move command to parasite location - auto-attack will engage during movement
                this.unitManager.issueCommand('move', parasitePosition);
                moveCommandsIssued++;
            }
        }

        if (moveCommandsIssued > 0) {
            console.log(`🎯 Issued ${moveCommandsIssued} move commands toward parasite ${parasiteId} (auto-attack will engage)`);
        } else {
            console.log(`⚠️ No protectors selected to move toward parasite ${parasiteId}. Select protectors first!`);
        }
    }

    /**
     * Handle clicking on a mineral deposit
     */
    private handleMineralDepositClick(mineralMesh: any): void {
        if (!this.unitManager) return;

        const selectedUnits = this.unitManager.getSelectedUnits();

        if (selectedUnits.length === 0) {
            return;
        }

        // Extract mineral deposit ID from mesh name (format: "mineral_chunk_<depositId>_<chunkIndex>")
        const nameParts = mineralMesh.name.split('_');
        if (nameParts.length < 4) {
            console.warn(`⚠️ Invalid mineral chunk name format: ${mineralMesh.name}`);
            return;
        }

        // Reconstruct the deposit ID (everything between "mineral_chunk_" and the last "_<chunkIndex>")
        const depositId = nameParts.slice(2, -1).join('_');

        // Get the mineral deposit from terrain generator
        const terrainGenerator = this.getTerrainGenerator();
        if (!terrainGenerator) {
            console.error('❌ Terrain generator not available for mineral deposit lookup');
            return;
        }

        const mineralDeposit = terrainGenerator.getMineralDepositById(depositId);
        if (!mineralDeposit) {
            console.warn(`⚠️ Mineral deposit not found: ${depositId}`);
            return;
        }

        // Assign selected workers to mine this deposit
        let assignedCount = 0;
        for (const unit of selectedUnits) {
            if (unit.getUnitType() === 'worker') {
                // Issue mining command
                this.unitManager.issueCommand('mine', undefined, depositId);
                assignedCount++;
            }
        }
    }

    /**
     * Handle clicking on terrain (treat as movement command)
     */
    private handleTerrainClick(pickInfo: any): void {
        if (!this.unitManager) return;

        const selectedUnits = this.unitManager.getSelectedUnits();
        if (selectedUnits.length === 0) {
            return;
        }

        // Get the world position where the user clicked on terrain
        const clickPosition = pickInfo.pickedPoint;
        if (!clickPosition) {
            console.warn('⚠️ Could not determine click position on terrain');
            return;
        }

        // Adjust height using terrain generator if available
        const terrainGenerator = this.getTerrainGenerator();
        if (terrainGenerator) {
            const terrainHeight = terrainGenerator.getHeightAtPosition(clickPosition.x, clickPosition.z);
            clickPosition.y = terrainHeight + 0.5; // Slightly above ground
        }

        // Issue move commands to selected units (only Protectors can move to empty terrain)
        let moveCommandsIssued = 0;
        let workersSkipped = 0;
        for (const unit of selectedUnits) {
            // Workers should only move when clicking on minerals, not empty terrain
            if (unit.getUnitType() === 'worker') {
                workersSkipped++;
                continue;
            }
            this.unitManager.issueCommand('move', clickPosition, undefined, undefined);
            moveCommandsIssued++;
        }

        if (moveCommandsIssued > 0) {
            console.log(`🚶 Issued ${moveCommandsIssued} move commands to (${clickPosition.x.toFixed(1)}, ${clickPosition.z.toFixed(1)})`);
        }
        if (workersSkipped > 0) {
            console.log(`💡 ${workersSkipped} worker(s) ignored - click on minerals to move workers`);
        }

        // Clear selection to hide selection mesh after issuing move commands
        this.unitManager.clearSelection();
        this.protectorSelectionUI?.hide();
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.stop();

        // Dispose components in reverse order
        this.treeRenderer?.dispose();
        this.combatSystem?.dispose();
        this.parasiteManager?.dispose();
        this.buildingManager?.dispose();
        this.buildingRenderer?.dispose();
        this.unitManager?.dispose();
        this.unitRenderer?.dispose();
        this.gameState?.dispose();
        this.energyDisplay?.dispose();
        this.miningAnalysisTooltip?.dispose();
        this.protectorSelectionUI?.dispose();
        this.energyManager?.dispose();
        this.performanceMonitor?.dispose();
        this.materialManager?.dispose();
        this.lightingSetup?.dispose();
        this.cameraController?.dispose();
        this.sceneManager?.dispose();

        // Dispose engine
        if (this.engine) {
            this.engine.dispose();
            this.engine = null;
        }

        this.scene = null;
        this.isInitialized = false;
        GameEngine.instance = null;
    }
}
