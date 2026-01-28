/**
 * GameEngine - Main facade coordinating engine subsystems
 * 
 * Slim facade that coordinates EngineCore, SystemManager, and InputHandler.
 * Maintains public API compatibility while delegating responsibilities
 * to focused subsystems. Implements singleton pattern for centralized
 * game engine management.
 */

import { Vector3 } from '@babylonjs/core';
import { AdvancedDynamicTexture } from '@babylonjs/gui';
import { EngineCore } from './EngineCore';
import { SystemManager } from './SystemManager';
import { InputHandler } from './InputHandler';
import { UIManager, UIComponents } from './UIManager';
import { AdaptiveQueenIntegration, createAdaptiveQueenIntegration } from '../AdaptiveQueenIntegration';
import { FPSCounter } from '../../ui/FPSCounter';
import { CoordinateDisplay } from '../../ui/CoordinateDisplay';
import { HelpWindow } from '../../ui/help';
import { getWebSocketUrl } from '../../config';
import { Protector } from '../entities/Protector';

export class GameEngine {
    private static instance: GameEngine | null = null;

    private canvas: HTMLCanvasElement;
    
    // Core subsystems
    private engineCore: EngineCore | null = null;
    private systemManager: SystemManager | null = null;
    private inputHandler: InputHandler | null = null;
    private uiManager: UIManager | null = null;

    // UI components (managed by UIManager)
    private uiComponents: UIComponents | null = null;
    private fpsCounter: FPSCounter | null = null;
    private coordinateDisplay: CoordinateDisplay | null = null;

    // Advanced systems
    private adaptiveQueenIntegration: AdaptiveQueenIntegration | null = null;
    private guiTexture: AdvancedDynamicTexture | null = null;
    private helpWindow: HelpWindow | null = null;

    // Throttling for spatial index checks
    private lastDetectionCheckTime: number = 0;
    private readonly DETECTION_CHECK_INTERVAL: number = 200; // Check every 200ms

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
            return;
        }

        try {
            // Initialize engine core (Babylon.js engine and scene)
            this.engineCore = new EngineCore(this.canvas);
            await this.engineCore.initialize();

            const scene = this.engineCore.getScene();
            const materialManager = this.engineCore.getMaterialManager();
            
            if (!scene || !materialManager) {
                throw new Error('Failed to initialize engine core components');
            }

            // Initialize system manager (game systems coordination)
            this.systemManager = new SystemManager(scene, materialManager);
            await this.systemManager.initialize(this.engineCore.getTerrainGenerator());

            // Initialize input handler (input event management)
            this.inputHandler = new InputHandler(scene);
            this.wireInputHandler();

            // Initialize UI manager and components
            this.uiManager = new UIManager();
            this.uiComponents = this.uiManager.initializeUI(scene, this.systemManager, this.inputHandler);

            // Initialize FPS counter and coordinate display
            this.fpsCounter = new FPSCounter(this.engineCore.getEngine()!);
            this.coordinateDisplay = new CoordinateDisplay();
            this.coordinateDisplay.setCameraGetter(() => this.engineCore?.getCameraController()?.getCamera() || null);

            // Initialize GUI texture for advanced UI components
            this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("MainUI", true, scene);

            // Share GUI texture with combat system to avoid duplicate fullscreen UIs
            const combatSystem = this.systemManager.getCombatSystem();
            if (combatSystem && this.guiTexture) {
                combatSystem.setSharedUI(this.guiTexture);
            }

            // Initialize in-game help window (H key to open, Escape to close)
            if (this.guiTexture) {
                this.helpWindow = new HelpWindow(this.guiTexture);
            }

            // Complete territory manager initialization
            this.systemManager.initializeTerritoryManager(this);

            // Setup terrain integration with game state
            this.setupTerrainIntegration();

            // Initialize Adaptive Queen Intelligence Integration
            await this.initializeAdaptiveQueenIntegration();

            this.isInitialized = true;

        } catch (error) {
            throw new Error(`Failed to initialize GameEngine: ${error}`);
        }
    }

    /**
     * Wire input handler with game systems
     */
    private wireInputHandler(): void {
        if (!this.inputHandler || !this.systemManager) {
            return;
        }

        this.inputHandler.setUnitManager(this.systemManager.getUnitManager()!);
        this.inputHandler.setParasiteManager(this.systemManager.getParasiteManager()!);
        this.inputHandler.setTerrainGenerator(this.engineCore?.getTerrainGenerator());
    }

    /**
     * Initialize Adaptive Queen Intelligence Integration
     */
    private async initializeAdaptiveQueenIntegration(): Promise<void> {
        const territoryManager = this.systemManager?.getTerritoryManager();
        const gameState = this.systemManager?.getGameState();
        
        if (!territoryManager || !gameState || !this.guiTexture) {
            console.warn('🧠 Cannot initialize AdaptiveQueenIntegration: missing dependencies');
            return;
        }

        try {
            const enableLearning = true;

            this.adaptiveQueenIntegration = await createAdaptiveQueenIntegration({
                gameEngine: this,
                territoryManager: territoryManager,
                gameState: gameState,
                guiTexture: this.guiTexture,
                websocketUrl: getWebSocketUrl(),
                enableLearning: enableLearning
            });
            
        } catch (error) {
            console.warn('🧠 Failed to initialize AdaptiveQueenIntegration, falling back to standard behavior:', error);
            
            // Create integration without learning capabilities
            this.adaptiveQueenIntegration = new AdaptiveQueenIntegration({
                gameEngine: this,
                territoryManager: territoryManager,
                gameState: gameState,
                guiTexture: this.guiTexture,
                enableLearning: false
            });
        }
    }

    /**
     * Setup terrain integration with game state
     */
    private setupTerrainIntegration(): void {
        const terrainGenerator = this.engineCore?.getTerrainGenerator();
        const gameState = this.systemManager?.getGameState();
        const territoryManager = this.systemManager?.getTerritoryManager();
        
        if (!terrainGenerator || !gameState) {
            return;
        }

        // Add existing mineral deposits to game state
        const deposits = terrainGenerator.getAllMineralDeposits();
        deposits.forEach((deposit: any) => {
            gameState.addMineralDeposit(deposit);
        });

        // Create single territory at initial camera position (0, 0) with Queen
        if (territoryManager) {
            territoryManager.createTerritory(0, 0, true); // skipAlignment for dev
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
            return;
        }

        try {
            if (!this.engineCore || !this.systemManager) {
                throw new Error('Engine core or system manager not initialized');
            }

            // Start render loop with update callback
            this.engineCore.startRenderLoop((deltaTime: number) => {
                // Update all game systems
                this.systemManager!.update(deltaTime);

                // Update territory renderer player position
                const territoryRenderer = this.systemManager!.getTerritoryRenderer();
                const cameraController = this.engineCore!.getCameraController();
                if (territoryRenderer && cameraController) {
                    const camera = cameraController.getCamera();
                    if (camera) {
                        territoryRenderer.setPlayerPosition(camera.getTarget());
                    }
                }

                // Update Adaptive Queen Integration
                if (this.adaptiveQueenIntegration) {
                    this.adaptiveQueenIntegration.update(deltaTime);
                }

                // Handle movement-combat transitions
                this.handleMovementCombatTransitions();
            });

            this.isRunning = true;

        } catch (error) {
            throw new Error(`Failed to start GameEngine: ${error}`);
        }
    }

    /**
     * Handle movement-combat transitions for auto-attack
     */
    private handleMovementCombatTransitions(): void {
        const combatSystem = this.systemManager?.getCombatSystem();
        const unitManager = this.systemManager?.getUnitManager();
        
        if (!combatSystem || !unitManager) {
            return;
        }

        // Throttle detection checks to every 200ms
        const now = performance.now();
        if (now - this.lastDetectionCheckTime < this.DETECTION_CHECK_INTERVAL) {
            return;
        }
        this.lastDetectionCheckTime = now;

        // Get all active protectors
        const protectors = unitManager.getUnitsByType('protector') as Protector[];

        for (const protector of protectors) {
            // Skip if protector is already in combat
            const activeCombats = combatSystem.getActiveCombats();
            const isInCombat = activeCombats.some(c => c.protectorId === protector.getId());
            if (isInCombat) {
                continue;
            }

            // Only check for auto-detection if protector is moving
            const protectorStats = protector.getProtectorStats();
            if (protectorStats.combatState === 'moving' && protectorStats.autoAttackEnabled) {
                // Check for enemy detection during movement
                const detectedTarget = combatSystem.checkMovementDetection(protector);

                if (detectedTarget) {
                    // Get protector's original destination for movement resumption
                    const originalDestination = protector.getOriginalDestination();

                    // Initiate auto-attack with original destination tracking
                    combatSystem.initiateAutoAttack(
                        protector,
                        detectedTarget,
                        originalDestination || undefined
                    );
                }
            }
        }
    }

    /**
     * Handle protector attacking a parasite (public API compatibility)
     */
    public handleProtectorAttack(protectorId: string, targetPosition: Vector3): boolean {
        const parasiteManager = this.systemManager?.getParasiteManager();
        const unitManager = this.systemManager?.getUnitManager();
        
        if (!parasiteManager || !unitManager) {
            return false;
        }

        const protector = unitManager.getUnit(protectorId);
        if (!protector || protector.getUnitType() !== 'protector') {
            return false;
        }

        return parasiteManager.handleProtectorAttack(protector as Protector, targetPosition);
    }

    /**
     * Stop the game engine
     */
    public stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.engineCore?.stopRenderLoop();
        this.isRunning = false;
    }

    // === PUBLIC API GETTERS (maintain compatibility) ===

    public getScene() { return this.engineCore?.getScene() || null; }
    public getEngine() { return this.engineCore?.getEngine() || null; }
    public getMaterialManager() { return this.engineCore?.getMaterialManager() || null; }
    public getCameraController() { return this.engineCore?.getCameraController() || null; }
    public getTerrainGenerator() { return this.engineCore?.getTerrainGenerator(); }
    
    public getEnergyManager() { return this.systemManager?.getEnergyManager() || null; }
    public getGameState() { return this.systemManager?.getGameState() || null; }
    public getUnitManager() { return this.systemManager?.getUnitManager() || null; }
    public getBuildingManager() { return this.systemManager?.getBuildingManager() || null; }
    public getParasiteManager() { return this.systemManager?.getParasiteManager() || null; }
    public getCombatSystem() { return this.systemManager?.getCombatSystem() || null; }
    public getTerritoryManager() { return this.systemManager?.getTerritoryManager() || null; }
    public getLiberationManager() { return this.systemManager?.getLiberationManager() || null; }
    public getSpatialIndex() { return this.systemManager?.getSpatialIndex() || null; }
    public getEnergyLordsManager() { return this.systemManager?.getEnergyLordsManager() || null; }
    
    public getQueenGrowthUI() { return this.uiComponents?.queenGrowthUI || null; }
    public getTerritoryVisualUI() { return this.uiComponents?.territoryVisualUI || null; }
    public getAdaptiveQueenIntegration() { return this.adaptiveQueenIntegration; }
    public getGUITexture() { return this.guiTexture; }
    public getHelpWindow() { return this.helpWindow; }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.stop();

        // Dispose UI systems
        this.uiManager?.dispose();
        this.adaptiveQueenIntegration?.dispose();
        this.helpWindow?.dispose();
        this.guiTexture?.dispose();
        this.fpsCounter?.dispose();
        this.coordinateDisplay?.dispose();

        // Dispose core subsystems
        this.inputHandler?.dispose();
        this.systemManager?.dispose();
        this.engineCore?.dispose();

        this.isInitialized = false;
        GameEngine.instance = null;
    }
}