/**
 * GameEngine - Core game engine with Babylon.js initialization
 * 
 * Manages the main game loop, scene initialization, and component coordination.
 * Implements singleton pattern for centralized game engine management.
 */

import { Engine, Scene } from '@babylonjs/core';
import { SceneManager } from '../rendering/SceneManager';
import { CameraController } from '../rendering/CameraController';
import { LightingSetup } from '../rendering/LightingSetup';
import { MaterialManager } from '../rendering/MaterialManager';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { EnergyManager } from './EnergyManager';
import { EnergyDisplay } from '../ui/EnergyDisplay';
import { GameState } from './GameState';

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
            this.energyManager.initialize(100); // Start with 100 energy

            // Initialize game state
            this.gameState = GameState.getInstance();
            this.gameState.initialize();

            // Setup components
            this.cameraController.setupCamera();
            this.lightingSetup.setupLighting();
            
            // Initialize procedural terrain system
            this.sceneManager.initializeTerrain(this.materialManager, this.cameraController);
            
            // Initialize energy UI
            this.initializeEnergyUI();
            
            // Setup terrain integration with game state
            this.setupTerrainIntegration();
            
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
            this.engine.runRenderLoop(() => {
                if (this.scene && this.engine) {
                    // Calculate delta time
                    const deltaTime = this.engine.getDeltaTime() / 1000; // Convert to seconds
                    
                    // Update game state
                    if (this.gameState) {
                        this.gameState.update(deltaTime);
                    }
                    
                    // Update energy system
                    if (this.energyManager) {
                        this.energyManager.update();
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
     * Dispose of all resources
     */
    public dispose(): void {
        console.log('🗑️ Disposing GameEngine...');

        this.stop();

        // Dispose components in reverse order
        this.gameState?.dispose();
        this.energyDisplay?.dispose();
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