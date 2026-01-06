/**
 * Nexus of Mind - Main Application Entry Point
 * 
 * Initializes the game engine and starts the 3D world rendering.
 * This is the primary entry point for the AI-powered RTS game.
 */

import { GameEngine } from './game/GameEngine';
import { BuildingAction } from './game/actions/BuildingAction';
import { MovementAction } from './game/actions/MovementAction';
import { Vector3 } from '@babylonjs/core';

/**
 * Application initialization and startup
 */
class Application {
    private gameEngine: GameEngine | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private loadingScreen: HTMLElement | null = null;

    /**
     * Initialize the application
     */
    public async init(): Promise<void> {
        console.log('🚀 Nexus of Mind - Initializing...');
        
        try {
            // Get canvas element
            this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
            this.loadingScreen = document.getElementById('loadingScreen');
            
            if (!this.canvas) {
                throw new Error('Canvas element not found');
            }

            // Update loading progress
            this.updateLoadingProgress(25, 'Setting up 3D Engine...');

            // Initialize game engine
            this.gameEngine = new GameEngine(this.canvas);
            await this.gameEngine.initialize();

            this.updateLoadingProgress(75, 'Loading 3D World...');

            // Start the game
            await this.gameEngine.start();

            this.updateLoadingProgress(100, 'Ready!');

            // Hide loading screen after a brief delay
            setTimeout(() => {
                this.hideLoadingScreen();
            }, 500);

            console.log('✅ Nexus of Mind - Initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            this.showError('Failed to initialize 3D world. Please refresh the page.');
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
     * Cleanup on page unload
     */
    public dispose(): void {
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
    
    // Expose testing functions to global scope for browser console
    (window as any).testEnergySystem = () => {
        const gameEngine = (app as any).gameEngine;
        if (!gameEngine) {
            console.log('❌ Game engine not available');
            return;
        }
        
        const energyManager = gameEngine.getEnergyManager();
        const terrainGenerator = gameEngine.getTerrainGenerator();
        const gameState = gameEngine.getGameState();
        
        if (!energyManager || !terrainGenerator || !gameState) {
            console.log('❌ Energy system, terrain, or game state not available');
            return;
        }
        
        console.log('⚡ Testing Energy System...');
        
        // Show current energy stats
        const stats = energyManager.getEnergyStats();
        console.log('📊 Current Energy Stats:', stats);
        
        // Show mineral deposits
        const deposits = terrainGenerator.getVisibleMineralDeposits();
        console.log(`💎 Found ${deposits.length} visible mineral deposits`);
        
        if (deposits.length > 0) {
            const deposit = deposits[0];
            console.log('💎 First deposit stats:', deposit.getStats());
            
            // Test mining
            console.log('⛏️ Testing mining...');
            const miningEnergy = deposit.mine(1.0); // Mine for 1 second
            if (miningEnergy > 0) {
                energyManager.generateEnergy('test_miner', miningEnergy, 'test_mining');
                console.log(`✅ Mined ${miningEnergy} energy!`);
            }
        }
        
        // Test energy consumption
        console.log('⚡ Testing energy consumption...');
        const consumed = energyManager.consumeEnergy('test_consumer', 10, 'test_action');
        console.log(`${consumed ? '✅' : '❌'} Energy consumption test: ${consumed}`);
        
        // Show final stats
        const finalStats = energyManager.getEnergyStats();
        console.log('📊 Final Energy Stats:', finalStats);
    };
    
    // Test building system
    (window as any).testBuildingSystem = () => {
        const gameEngine = (app as any).gameEngine;
        if (!gameEngine) {
            console.log('❌ Game engine not available');
            return;
        }
        
        const buildingManager = gameEngine.getBuildingManager();
        const energyManager = gameEngine.getEnergyManager();
        
        if (!buildingManager || !energyManager) {
            console.log('❌ Building manager or energy manager not available');
            return;
        }
        
        console.log('🏗️ Testing Building System...');
        
        // Show available building types
        const buildingTypes = buildingManager.getAvailableBuildingTypes();
        console.log('🏗️ Available building types:', buildingTypes);
        
        // Show current energy
        console.log(`⚡ Current energy: ${energyManager.getTotalEnergy()}`);
        
        const gameState = gameEngine.getGameState();
        if (!gameState) {
            console.log('❌ Game state not available');
            return;
        }
        
        // Create a test unit
        const testUnit = gameState.createUnit('worker', new (window as any).Vector3(0, 0, 0));
        console.log('👤 Created test worker unit:', testUnit.id);
        
        // Create a test building
        const testBuilding = gameState.createBuilding('base', new (window as any).Vector3(10, 0, 10), testUnit.id);
        console.log('🏗️ Created test base building:', testBuilding.id);
        
        // Show game stats
        const gameStats = gameState.getGameStats();
        console.log('📊 Game Stats:', gameStats);
    };
    
    // Test movement system
    (window as any).testMovementSystem = () => {
        const gameEngine = (app as any).gameEngine;
        if (!gameEngine) {
            console.log('❌ Game engine not available');
            return;
        }
        
        const gameState = gameEngine.getGameState();
        const energyManager = gameEngine.getEnergyManager();
        
        if (!gameState || !energyManager) {
            console.log('❌ Game state or energy manager not available');
            return;
        }
        
        console.log('🚶 Testing Movement System...');
        
        // Show movement costs
        const movementCosts = (window as any).MovementAction?.getUnitMovementCosts() || {};
        console.log('🚶 Unit movement costs:', movementCosts);
        
        // Show current energy
        console.log(`⚡ Current energy: ${energyManager.getTotalEnergy()}`);
        
        // Show all units
        const units = gameState.getAllUnits();
        console.log(`👥 Total units: ${units.length}`);
        
        units.forEach((unit: any, index: number) => {
            console.log(`👤 Unit ${index + 1}: ${unit.unitType} at ${unit.position.toString()}`);
        });
    };
    
    // Test unit system
    (window as any).testUnitSystem = () => {
        const gameEngine = (app as any).gameEngine;
        if (!gameEngine) {
            console.log('❌ Game engine not available');
            return;
        }
        
        const unitManager = gameEngine.getUnitManager();
        const energyManager = gameEngine.getEnergyManager();
        
        if (!unitManager || !energyManager) {
            console.log('❌ Unit manager or energy manager not available');
            return;
        }
        
        console.log('👥 Testing Unit System...');
        
        // Show current energy
        console.log(`⚡ Current energy: ${energyManager.getTotalEnergy()}`);
        
        // Create test units
        const worker = unitManager.createUnit('worker', new (window as any).Vector3(5, 0, 5));
        const scout = unitManager.createUnit('scout', new (window as any).Vector3(-5, 0, 5));
        const protector = unitManager.createUnit('protector', new (window as any).Vector3(0, 0, -5));
        
        if (worker && scout && protector) {
            console.log(`✅ Created units: Worker ${worker.getId()}, Scout ${scout.getId()}, Protector ${protector.getId()}`);
            
            // Show unit stats
            console.log('👷 Worker stats:', worker.getStats());
            console.log('🔍 Scout stats:', scout.getStats());
            console.log('🛡️ Protector stats:', protector.getStats());
            
            // Test unit selection
            unitManager.selectUnits([worker.getId(), scout.getId()]);
            console.log('👆 Selected worker and scout');
            
            // Test movement command
            unitManager.issueCommand('move', new (window as any).Vector3(10, 0, 10));
            console.log('🚶 Issued movement command to selected units');
        }
        
        // Show unit manager stats
        const stats = unitManager.getStats();
        console.log('📊 Unit Manager Stats:', stats);
    };
    
    // Test unit actions
    (window as any).testUnitActions = () => {
        const gameEngine = (app as any).gameEngine;
        if (!gameEngine) {
            console.log('❌ Game engine not available');
            return;
        }
        
        const unitManager = gameEngine.getUnitManager();
        const terrainGenerator = gameEngine.getTerrainGenerator();
        
        if (!unitManager || !terrainGenerator) {
            console.log('❌ Unit manager or terrain generator not available');
            return;
        }
        
        console.log('⚡ Testing Unit Actions...');
        
        // Get all units
        const units = unitManager.getAllUnits();
        console.log(`👥 Found ${units.length} units`);
        
        // Test mining with workers
        const workers = unitManager.getUnitsByType('worker');
        if (workers.length > 0) {
            const worker = workers[0];
            const deposits = terrainGenerator.getVisibleMineralDeposits();
            
            if (deposits.length > 0) {
                console.log(`⛏️ Testing mining with worker ${worker.getId()}`);
                worker.startMining(deposits[0]);
            }
        }
        
        // Test exploration with scouts
        const scouts = unitManager.getUnitsByType('scout');
        if (scouts.length > 0) {
            const scout = scouts[0];
            console.log(`🔍 Testing exploration with scout ${scout.getId()}`);
            scout.discoverMinerals(terrainGenerator);
        }
        
        // Test shield with protectors
        const protectors = unitManager.getUnitsByType('protector');
        if (protectors.length > 0) {
            const protector = protectors[0];
            console.log(`🛡️ Testing shield with protector ${protector.getId()}`);
            protector.activateShield();
        }
    };
    
    // Expose terrain stats function
    (window as any).showTerrainStats = () => {
        const gameEngine = (app as any).gameEngine;
        if (!gameEngine) {
            console.log('❌ Game engine not available');
            return;
        }
        
        const terrainGenerator = gameEngine.getTerrainGenerator();
        if (!terrainGenerator) {
            console.log('❌ Terrain generator not available');
            return;
        }
        
        const stats = terrainGenerator.getStats();
        console.log('🌍 Terrain Stats:', stats);
        
        const deposits = terrainGenerator.getAllMineralDeposits();
        console.log(`💎 Total mineral deposits: ${deposits.length}`);
        
        deposits.slice(0, 5).forEach((deposit: any, index: number) => {
            console.log(`💎 Deposit ${index + 1}:`, deposit.getStats());
        });
    };
    
    console.log('🧪 Test functions available:');
    console.log('  - testEnergySystem() - Test energy generation and consumption');
    console.log('  - testBuildingSystem() - Test building creation and energy costs');
    console.log('  - testMovementSystem() - Test unit movement and energy consumption');
    console.log('  - testUnitSystem() - Test unit creation and management');
    console.log('  - testUnitActions() - Test unit-specific actions (mining, exploration, combat)');
    console.log('  - showTerrainStats() - Show terrain and mineral deposit information');
});

// Handle window resize
window.addEventListener('resize', () => {
    // Engine will handle resize automatically
    console.log('Window resized');
});