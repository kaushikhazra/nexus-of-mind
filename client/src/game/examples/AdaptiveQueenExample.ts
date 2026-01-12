/**
 * AdaptiveQueenExample - Example usage of the Adaptive Queen Intelligence system
 * 
 * This example demonstrates how to integrate the AdaptiveQueen system into
 * an existing game setup, including WebSocket connection, UI integration,
 * and Queen monitoring.
 */

import { Scene, Engine, Vector3 } from '@babylonjs/core';
import { AdvancedDynamicTexture } from '@babylonjs/gui';
import { GameEngine } from '../GameEngine';
import { GameState } from '../GameState';
import { TerritoryManager } from '../TerritoryManager';
import { AdaptiveQueenIntegration, createAdaptiveQueenIntegration, checkAIBackendAvailability } from '../AdaptiveQueenIntegration';
import { AdaptiveQueen } from '../entities/AdaptiveQueen';

/**
 * Example class showing AdaptiveQueen integration
 */
export class AdaptiveQueenExample {
    private scene: Scene;
    private engine: Engine;
    private gameEngine: GameEngine;
    private gameState: GameState;
    private territoryManager: TerritoryManager;
    private guiTexture: AdvancedDynamicTexture;
    
    private adaptiveQueenIntegration?: AdaptiveQueenIntegration;
    private currentQueen?: AdaptiveQueen;

    constructor(scene: Scene, engine: Engine) {
        this.scene = scene;
        this.engine = engine;
        
        // Initialize game components (these would normally be created elsewhere)
        this.gameEngine = new GameEngine(this.engine.getRenderingCanvas()!);
        this.gameState = GameState.getInstance(); // Use singleton pattern
        this.territoryManager = new TerritoryManager();
        this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI('UI');
        
        console.log('🎮 AdaptiveQueenExample initialized');
    }

    /**
     * Initialize the example with AI learning capabilities
     */
    public async initializeWithAI(): Promise<void> {
        try {
            // Check if AI backend is available
            const backendAvailable = await checkAIBackendAvailability('ws://localhost:8000/ws');
            
            if (!backendAvailable) {
                console.warn('🧠 AI backend not available, falling back to standard Queens');
                await this.initializeWithoutAI();
                return;
            }
            
            // Initialize game engine and territory manager
            await this.initializeGameComponents();
            
            // Create and initialize AdaptiveQueen integration
            this.adaptiveQueenIntegration = await createAdaptiveQueenIntegration({
                gameEngine: this.gameEngine,
                territoryManager: this.territoryManager,
                gameState: this.gameState,
                guiTexture: this.guiTexture,
                websocketUrl: 'ws://localhost:8000/ws',
                enableLearning: true
            });
            
            console.log('🧠 AdaptiveQueen system initialized with AI learning');
            
            // Create a test territory with an AdaptiveQueen
            await this.createTestTerritory();
            
        } catch (error) {
            console.error('🧠 Failed to initialize with AI:', error);
            await this.initializeWithoutAI();
        }
    }

    /**
     * Initialize without AI learning (fallback mode)
     */
    public async initializeWithoutAI(): Promise<void> {
        // Initialize game components
        await this.initializeGameComponents();
        
        // Create AdaptiveQueen integration without learning
        this.adaptiveQueenIntegration = await createAdaptiveQueenIntegration({
            gameEngine: this.gameEngine,
            territoryManager: this.territoryManager,
            gameState: this.gameState,
            guiTexture: this.guiTexture,
            enableLearning: false
        });
        
        console.log('🎮 AdaptiveQueen system initialized without AI learning');
        
        // Create a test territory
        await this.createTestTerritory();
    }

    /**
     * Initialize core game components
     */
    private async initializeGameComponents(): Promise<void> {
        // Initialize game engine
        this.gameEngine.initialize();
        
        // Initialize territory manager
        this.territoryManager.initialize(this.gameEngine);
        
        console.log('🎮 Game components initialized');
    }

    /**
     * Create a test territory with a Queen for demonstration
     */
    private async createTestTerritory(): Promise<void> {
        // Create a territory at the center of the world
        const territory = this.territoryManager.createTerritory(0, 0);
        
        // Create a Queen for this territory
        const queen = this.territoryManager.createQueenForTerritory(territory.id, 1);
        
        if (queen && queen instanceof AdaptiveQueen) {
            this.currentQueen = queen;
            
            // Set the Queen to be monitored by the integration
            this.adaptiveQueenIntegration?.setQueenToMonitor(queen);
            
            console.log(`🧠 Created AdaptiveQueen ${queen.id} for demonstration`);
        } else if (queen) {
            console.log(`👑 Created standard Queen ${queen.id} for demonstration`);
        }
    }

    /**
     * Update the example (called each frame)
     */
    public update(deltaTime: number): void {
        // Update game components
        this.territoryManager.update(deltaTime);
        
        // Update AdaptiveQueen integration
        this.adaptiveQueenIntegration?.update(deltaTime);
    }

    /**
     * Simulate Queen death for learning demonstration
     */
    public async simulateQueenDeath(): Promise<void> {
        if (!this.currentQueen) {
            console.warn('🧠 No Queen available to simulate death');
            return;
        }
        
        console.log('🧠 Simulating Queen death for learning demonstration...');
        
        // Force Queen to active control phase to make it vulnerable
        this.currentQueen['currentPhase'] = 'active_control' as any;
        this.currentQueen.position.y = 2.0; // Above ground
        
        // Deal fatal damage
        await this.currentQueen.takeDamage(this.currentQueen.maxHealth);
        
        console.log('🧠 Queen death simulated - AI should now learn from this event');
    }

    /**
     * Create a new Queen generation for testing
     */
    public async createNextGeneration(): Promise<void> {
        if (!this.currentQueen) {
            console.warn('🧠 No current Queen to create next generation from');
            return;
        }
        
        const territoryId = this.currentQueen.getTerritory().id;
        const nextGeneration = this.currentQueen.getGeneration() + 1;
        
        // Create next generation Queen
        const newQueen = this.territoryManager.createQueenForTerritory(territoryId, nextGeneration);
        
        if (newQueen instanceof AdaptiveQueen) {
            this.currentQueen = newQueen;
            this.adaptiveQueenIntegration?.setQueenToMonitor(newQueen);
            
            console.log(`🧠 Created next generation AdaptiveQueen ${newQueen.id} (Gen ${nextGeneration})`);
        }
    }

    /**
     * Toggle AI learning on/off
     */
    public toggleAILearning(): void {
        if (!this.adaptiveQueenIntegration) {
            console.warn('🧠 AdaptiveQueen integration not available');
            return;
        }
        
        const currentState = this.adaptiveQueenIntegration.isLearningEnabled();
        this.adaptiveQueenIntegration.setLearningEnabled(!currentState);
        
        console.log(`🧠 AI learning ${!currentState ? 'enabled' : 'disabled'}`);
    }

    /**
     * Toggle learning progress UI visibility
     */
    public toggleLearningUI(): void {
        this.adaptiveQueenIntegration?.toggleLearningUI();
    }

    /**
     * Get AI statistics for debugging
     */
    public getAIStatistics(): any {
        return this.adaptiveQueenIntegration?.getAIStatistics() || {};
    }

    /**
     * Get current Queen information
     */
    public getCurrentQueenInfo(): any {
        if (!this.currentQueen) {
            return null;
        }
        
        return {
            id: this.currentQueen.id,
            generation: this.currentQueen.getGeneration(),
            phase: this.currentQueen.getCurrentPhase(),
            health: this.currentQueen.health,
            maxHealth: this.currentQueen.maxHealth,
            isLearningEnabled: this.currentQueen.isLearningEnabled(),
            learningProgress: this.currentQueen.getLearningProgress(),
            currentStrategy: this.currentQueen.getCurrentStrategy()
        };
    }

    /**
     * Dispose example and cleanup resources
     */
    public dispose(): void {
        this.adaptiveQueenIntegration?.dispose();
        this.guiTexture.dispose();
        
        console.log('🎮 AdaptiveQueenExample disposed');
    }
}

/**
 * Helper function to create and run the example
 */
export async function runAdaptiveQueenExample(scene: Scene, engine: Engine): Promise<AdaptiveQueenExample> {
    const example = new AdaptiveQueenExample(scene, engine);
    
    try {
        await example.initializeWithAI();
    } catch (error) {
        console.error('Failed to initialize AdaptiveQueen example:', error);
        await example.initializeWithoutAI();
    }
    
    return example;
}

/**
 * Example usage in a game loop
 */
export function setupAdaptiveQueenGameLoop(example: AdaptiveQueenExample): void {
    // Set up render loop
    const engine = example['engine'];
    engine.runRenderLoop(() => {
        const deltaTime = engine.getDeltaTime();
        example.update(deltaTime);
        example['scene'].render();
    });
    
    // Set up keyboard controls for testing
    window.addEventListener('keydown', (event) => {
        switch (event.key) {
            case '1':
                example.simulateQueenDeath();
                break;
            case '2':
                example.createNextGeneration();
                break;
            case '3':
                example.toggleAILearning();
                break;
            case '4':
                example.toggleLearningUI();
                break;
            case '5':
                console.log('AI Statistics:', example.getAIStatistics());
                break;
            case '6':
                console.log('Current Queen:', example.getCurrentQueenInfo());
                break;
        }
    });
    
    console.log(`
🎮 AdaptiveQueen Example Controls:
1 - Simulate Queen Death
2 - Create Next Generation
3 - Toggle AI Learning
4 - Toggle Learning UI
5 - Show AI Statistics
6 - Show Current Queen Info
    `);
}