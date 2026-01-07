/**
 * GameEngine - Core game engine with Babylon.js initialization
 * 
 * Manages the main game loop, scene initialization, and component coordination.
 * Implements singleton pattern for centralized game engine management.
 */

import { Engine, Scene, PointerEventTypes, Vector3 } from '@babylonjs/core';
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
import { ParasiteManager } from './ParasiteManager';
import { Worker } from './entities/Worker';
import { Protector } from './entities/Protector';

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
    
    // UI systems
    private miningAnalysisTooltip: MiningAnalysisTooltip | null = null;
    
    private isInitialized: boolean = false;
    private isRunning: boolean = false;

    constructor(canvas: HTMLCanvasElement) {
        if (GameEngine.instance) {
            throw new Error('GameEngine is a singleton. Use GameEngine.getInstance()');
        }
        
        this.canvas = canvas;
        GameEngine.instance = this;
        
        console.log('🎮 GameEngine created');
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
            console.log('🔧 Initializing Babylon.js engine...');
            
            // Initialize WebGL engine (WebGPU support can be added later)
            console.log('🚀 Using WebGL engine');
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
            
            // Set terrain generator after terrain is initialized (delayed)
            setTimeout(() => {
                const terrainGen = this.getTerrainGenerator();
                if (terrainGen && this.unitManager && this.parasiteManager) {
                    this.unitManager.setTerrainGenerator(terrainGen);
                    this.parasiteManager.setTerrainGenerator(terrainGen);
                    console.log('🌍 Terrain generator set on UnitManager and ParasiteManager (delayed)');
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
            
            // Setup terrain integration with game state
            this.setupTerrainIntegration();
            
            // Setup mouse interaction for unit selection and mining assignment
            this.setupMouseInteraction();
            
            // Handle window resize
            window.addEventListener('resize', () => {
                this.engine?.resize();
            });

            this.isInitialized = true;
            console.log('✅ GameEngine initialized successfully');

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
            console.log('▶️ Starting game engine...');

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
                    
                    this.scene.render();
                }
            });

            this.isRunning = true;
            console.log('✅ Game engine started - render loop active');

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

        console.log('⏹️ Stopping game engine...');

        if (this.engine) {
            this.engine.stopRenderLoop();
        }

        this.performanceMonitor?.stopMonitoring();
        this.isRunning = false;

        console.log('✅ Game engine stopped');
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

        console.log(`🌍 Integrated ${deposits.length} mineral deposits with game state`);
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

        console.log('⚡ Energy UI initialized');
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
        console.log('🔍 Mining analysis tooltip initialized');
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

        console.log('🖱️ Setting up mouse interaction for unit selection and mining assignment');

        // Add pointer observable for mouse clicks
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
                this.handleMouseClick(pointerInfo);
            }
        });
    }

    /**
     * Handle mouse click for unit selection and mining assignment
     */
    private handleMouseClick(pointerInfo: any): void {
        if (!this.scene || !this.unitManager) return;

        // Get the pick result
        const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        
        if (!pickInfo || !pickInfo.hit) {
            // Clicked on empty space - clear selection
            this.unitManager.clearSelection();
            console.log('🖱️ Clicked empty space - cleared selection');
            return;
        }

        const pickedMesh = pickInfo.pickedMesh;
        if (!pickedMesh) return;

        console.log(`🖱️ Clicked on mesh: ${pickedMesh.name}`);

        // Check if clicked on a unit
        if (pickedMesh.name.startsWith('unit_')) {
            this.handleUnitClick(pickedMesh);
        }
        // Check if clicked on a mineral deposit (chunk)
        else if (pickedMesh.name.startsWith('mineral_chunk_')) {
            this.handleMineralDepositClick(pickedMesh);
        }
        // Clicked on something else - clear selection
        else {
            this.unitManager.clearSelection();
            console.log('🖱️ Clicked on non-interactive object - cleared selection');
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
        console.log(`👆 Selected ${unit.getUnitType()} unit: ${unitId}`);
    }

    /**
     * Handle clicking on a mineral deposit
     */
    private handleMineralDepositClick(mineralMesh: any): void {
        if (!this.unitManager) return;

        const selectedUnits = this.unitManager.getSelectedUnits();
        
        if (selectedUnits.length === 0) {
            console.log('🖱️ Clicked mineral deposit but no units selected');
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
        
        console.log(`🖱️ Clicked mineral chunk: ${mineralMesh.name}, extracted deposit ID: ${depositId} with ${selectedUnits.length} selected units`);
        
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

        console.log(`💎 Found mineral deposit at ${mineralDeposit.getPosition().toString()}`);

        // Assign selected workers to mine this deposit
        let assignedCount = 0;
        for (const unit of selectedUnits) {
            if (unit.getUnitType() === 'worker') {
                console.log(`⛏️ Issuing mining command to worker ${unit.getId()}`);
                // Issue mining command
                this.unitManager.issueCommand('mine', undefined, depositId);
                assignedCount++;
                console.log(`⛏️ Assigned worker ${unit.getId()} to mine deposit ${depositId}`);
            } else {
                console.log(`⚠️ Unit ${unit.getId()} is not a worker (${unit.getUnitType()}), skipping mining assignment`);
            }
        }

        if (assignedCount > 0) {
            console.log(`✅ Assigned ${assignedCount} workers to mineral deposit`);
        } else {
            console.log('⚠️ No workers selected for mining assignment');
        }
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        console.log('🗑️ Disposing GameEngine...');

        this.stop();

        // Dispose components in reverse order
        this.parasiteManager?.dispose();
        this.buildingManager?.dispose();
        this.buildingRenderer?.dispose();
        this.unitManager?.dispose();
        this.unitRenderer?.dispose();
        this.gameState?.dispose();
        this.energyDisplay?.dispose();
        this.miningAnalysisTooltip?.dispose();
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

        console.log('✅ GameEngine disposed');
    }
}