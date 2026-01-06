/**
 * Nexus of Mind - Main Application Entry Point
 * 
 * Initializes the game engine and starts the 3D world rendering.
 * This is the primary entry point for the AI-powered RTS game.
 */

import { GameEngine } from './game/GameEngine';

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
    
    // Expose testing functions to global scope for browser console
    (window as any).testEnergySystem = () => {
        const gameEngine = (app as any).gameEngine;
        if (!gameEngine) {
            console.log('❌ Game engine not available');
            return;
        }
        
        const energyManager = gameEngine.getEnergyManager();
        const terrainGenerator = gameEngine.getTerrainGenerator();
        
        if (!energyManager || !terrainGenerator) {
            console.log('❌ Energy system or terrain not available');
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
        
        deposits.slice(0, 5).forEach((deposit, index) => {
            console.log(`💎 Deposit ${index + 1}:`, deposit.getStats());
        });
    };
    
    console.log('🧪 Test functions available:');
    console.log('  - testEnergySystem() - Test energy generation and consumption');
    console.log('  - showTerrainStats() - Show terrain and mineral deposit information');
});

// Handle window resize
window.addEventListener('resize', () => {
    // Engine will handle resize automatically
    console.log('Window resized');
});