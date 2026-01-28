/**
 * SystemManager - Game systems coordination and lifecycle management
 * 
 * Manages initialization, updates, and disposal of all game systems.
 * Implements round-robin scheduling for throttled systems to maintain
 * 60fps performance while distributing non-critical updates across frames.
 */

import { Scene, Vector3 } from '@babylonjs/core';
import { EnergyManager } from '../EnergyManager';
import { GameState } from '../GameState';
import { UnitManager } from '../UnitManager';
import { UnitRenderer } from '../../rendering/UnitRenderer';
import { BuildingManager } from '../BuildingManager';
import { BuildingRenderer } from '../../rendering/BuildingRenderer';
import { ParasiteManager } from '../ParasiteManager';
import { CombatSystem } from '../CombatSystem';
import { TerritoryManager } from '../TerritoryManager';
import { TerritoryRenderer } from '../../rendering/TerritoryRenderer';
import { LiberationManager } from '../LiberationManager';
import { TreeRenderer } from '../../rendering/TreeRenderer';
import { SpatialIndex } from '../SpatialIndex';
import { EnergyLordsManager } from '../systems/EnergyLordsManager';
import { MaterialManager } from '../../rendering/MaterialManager';
import { Worker } from '../entities/Worker';
import { Protector } from '../entities/Protector';
import type { ThrottledSystem } from './types';

export class SystemManager {
    private scene: Scene;
    private materialManager: MaterialManager;
    
    // Core game systems
    private energyManager: EnergyManager | null = null;
    private gameState: GameState | null = null;
    private unitManager: UnitManager | null = null;
    private unitRenderer: UnitRenderer | null = null;
    private buildingManager: BuildingManager | null = null;
    private buildingRenderer: BuildingRenderer | null = null;
    private parasiteManager: ParasiteManager | null = null;
    private combatSystem: CombatSystem | null = null;
    private territoryManager: TerritoryManager | null = null;
    private territoryRenderer: TerritoryRenderer | null = null;
    private liberationManager: LiberationManager | null = null;
    private treeRenderer: TreeRenderer | null = null;
    private spatialIndex: SpatialIndex | null = null;
    private energyLordsManager: EnergyLordsManager | null = null;
    
    // Round-robin throttled system updates
    private throttledSystems: ThrottledSystem[] = [];
    private currentSystemIndex: number = 0;
    private lastDeltaTime: number = 0;
    
    // Pending upgrade bonus to apply after BuildingManager is created
    private pendingUpgradeBonus: number = 0;
    
    private isInitialized: boolean = false;

    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;
    }

    /**
     * Initialize all game systems
     */
    public async initialize(terrainGenerator?: any): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Initialize spatial index for O(1) entity lookups
            this.spatialIndex = new SpatialIndex();

            // Initialize energy system
            this.energyManager = EnergyManager.getInstance();
            this.energyManager.initialize(500, 15); // Start with 500 energy, 15 minerals

            // Initialize Energy Lords progression system
            this.energyLordsManager = new EnergyLordsManager(this.energyManager);
            await this.energyLordsManager.initialize();

            // Store upgrade bonus to apply after BuildingManager is created
            this.pendingUpgradeBonus = this.energyLordsManager.getTotalUpgradeBonus();

            // Initialize game state
            this.gameState = GameState.getInstance();
            this.gameState.initialize();

            // Initialize unit system
            this.unitRenderer = new UnitRenderer(this.scene, this.materialManager);
            this.unitManager = new UnitManager(this.gameState, this.unitRenderer);

            // Initialize building system
            this.buildingRenderer = new BuildingRenderer(this.scene, this.materialManager);
            this.buildingManager = new BuildingManager(this.gameState, this.buildingRenderer, this.energyManager);

            // Apply Energy Lords upgrade bonus to power plants
            if (this.pendingUpgradeBonus > 0) {
                this.buildingManager.setEnergyGenerationBonus(this.pendingUpgradeBonus);
            }

            // Initialize combat system
            this.parasiteManager = new ParasiteManager({
                scene: this.scene,
                materialManager: this.materialManager,
                terrainGenerator: terrainGenerator
            });

            // Initialize central combat system with scene for visual effects
            this.combatSystem = new CombatSystem(this.energyManager, this.scene);

            // Register combat system with UnitManager for auto-attack integration
            if (this.unitManager) {
                this.unitManager.setCombatSystem(this.combatSystem);
            }

            // Initialize vegetation system
            this.treeRenderer = new TreeRenderer(this.scene);

            // Initialize territory system
            this.territoryManager = new TerritoryManager();
            // Territory manager initialization will be completed by the facade

            // Initialize territory renderer
            this.territoryRenderer = new TerritoryRenderer(this.scene, this.materialManager);
            this.territoryRenderer.setTerritoryManager(this.territoryManager);

            // Initialize liberation manager
            this.liberationManager = new LiberationManager(this.energyManager);
            this.liberationManager.setTerritoryManager(this.territoryManager);

            // Connect systems
            this.connectSystems(terrainGenerator);

            // Initialize throttled systems for round-robin updates
            this.initializeThrottledSystems();

            this.isInitialized = true;

        } catch (error) {
            throw new Error(`Failed to initialize SystemManager: ${error}`);
        }
    }

    /**
     * Connect systems that depend on each other
     */
    private connectSystems(terrainGenerator?: any): void {
        // Connect territory manager to unit manager for mining bonus
        if (this.unitManager && this.territoryManager) {
            this.unitManager.setTerritoryManager(this.territoryManager);
        }

        // Connect territory manager to parasite manager for territorial control
        if (this.parasiteManager && this.territoryManager) {
            this.parasiteManager.setTerritoryManager(this.territoryManager);
        }

        // Set terrain generator after terrain is initialized (delayed)
        if (terrainGenerator) {
            setTimeout(() => {
                if (this.unitManager && this.parasiteManager) {
                    this.unitManager.setTerrainGenerator(terrainGenerator);
                    this.parasiteManager.setTerrainGenerator(terrainGenerator);

                    // Set tree renderer on terrain for infinite tree spawning
                    if (this.treeRenderer) {
                        terrainGenerator.setTreeRenderer(this.treeRenderer);
                    }
                }
            }, 1000); // 1 second delay to ensure terrain is ready
        }
    }

    /**
     * Initialize throttled systems for round-robin updates
     * These systems don't need 60 Hz updates, so we spread them across frames
     */
    private initializeThrottledSystems(): void {
        this.throttledSystems = [
            {
                name: 'energy',
                interval: 100,  // 10 Hz
                lastUpdate: 0,
                update: () => this.energyManager?.update()
            },
            {
                name: 'territory',
                interval: 100,  // 10 Hz
                lastUpdate: 0,
                update: () => this.territoryManager?.update(this.lastDeltaTime)
            },
            {
                name: 'liberation',
                interval: 200,  // 5 Hz
                lastUpdate: 0,
                update: () => this.liberationManager?.updateLiberations(this.lastDeltaTime)
            },
            {
                name: 'energyLords',
                interval: 100,  // 10 Hz
                lastUpdate: 0,
                update: () => this.energyLordsManager?.update(performance.now())
            }
        ];
    }

    /**
     * Update all game systems (called every frame)
     */
    public update(deltaTime: number): void {
        if (!this.isInitialized) {
            return;
        }

        this.lastDeltaTime = deltaTime;

        // === 60 Hz UPDATES (critical for gameplay) ===

        // Update game state
        if (this.gameState) {
            this.gameState.update(deltaTime);
        }

        // Update unit system
        if (this.unitManager) {
            this.unitManager.update(deltaTime);
        }

        // Update building system
        if (this.buildingManager) {
            this.buildingManager.update(deltaTime);
        }

        // Update combat system (parasites)
        if (this.parasiteManager && this.gameState && this.unitManager) {
            const mineralDeposits = this.gameState.getAllMineralDeposits();
            const workers = this.unitManager.getUnitsByType('worker') as Worker[];
            const protectors = this.unitManager.getUnitsByType('protector') as Protector[];
            this.parasiteManager.update(deltaTime, mineralDeposits, workers, protectors);
        }

        // Update central combat system with auto-attack integration
        if (this.combatSystem) {
            this.combatSystem.update(deltaTime);
        }

        // Update vegetation animations
        if (this.treeRenderer) {
            this.treeRenderer.updateAnimations();
        }

        // === ROUND-ROBIN THROTTLED UPDATES ===
        this.updateThrottledSystems();
    }

    /**
     * Update throttled systems using round-robin scheduling
     */
    private updateThrottledSystems(): void {
        if (this.throttledSystems.length === 0) {
            return;
        }

        const now = performance.now();

        // Guard: Clamp to valid range before access
        if (this.currentSystemIndex < 0 || this.currentSystemIndex >= this.throttledSystems.length) {
            this.currentSystemIndex = 0;
        }

        const system = this.throttledSystems[this.currentSystemIndex];
        if (now - system.lastUpdate >= system.interval) {
            system.update();
            system.lastUpdate = now;
        }

        // Move to next system for next frame
        this.currentSystemIndex = (this.currentSystemIndex + 1) % this.throttledSystems.length;
    }

    /**
     * Get energy manager
     */
    public getEnergyManager(): EnergyManager | null {
        return this.energyManager;
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
     * Get territory manager
     */
    public getTerritoryManager(): TerritoryManager | null {
        return this.territoryManager;
    }

    /**
     * Get territory renderer
     */
    public getTerritoryRenderer(): TerritoryRenderer | null {
        return this.territoryRenderer;
    }

    /**
     * Get liberation manager
     */
    public getLiberationManager(): LiberationManager | null {
        return this.liberationManager;
    }

    /**
     * Get spatial index
     */
    public getSpatialIndex(): SpatialIndex | null {
        return this.spatialIndex;
    }

    /**
     * Get Energy Lords manager
     */
    public getEnergyLordsManager(): EnergyLordsManager | null {
        return this.energyLordsManager;
    }

    /**
     * Get tree renderer
     */
    public getTreeRenderer(): TreeRenderer | null {
        return this.treeRenderer;
    }

    /**
     * Complete territory manager initialization (called by facade)
     */
    public initializeTerritoryManager(gameEngine: any): void {
        if (this.territoryManager) {
            this.territoryManager.initialize(gameEngine);
            
            // Set initial player position at camera target (0, 0, 0)
            if (this.territoryRenderer) {
                this.territoryRenderer.setPlayerPosition(new Vector3(0, 0, 0));
            }
        }
    }

    /**
     * Check if systems are initialized
     */
    public isSystemsInitialized(): boolean {
        return this.isInitialized;
    }

    /**
     * Dispose of all systems
     */
    public dispose(): void {
        // Dispose systems in reverse order
        this.energyLordsManager?.dispose();
        this.liberationManager?.dispose();
        this.territoryRenderer?.dispose();
        this.territoryManager?.dispose();
        this.treeRenderer?.dispose();
        this.combatSystem?.dispose();
        this.parasiteManager?.dispose();
        this.buildingManager?.dispose();
        this.buildingRenderer?.dispose();
        this.unitManager?.dispose();
        this.unitRenderer?.dispose();
        this.gameState?.dispose();
        this.energyManager?.dispose();
        this.spatialIndex = null;

        // Clear throttled systems
        this.throttledSystems = [];
        this.currentSystemIndex = 0;

        this.isInitialized = false;
    }
}