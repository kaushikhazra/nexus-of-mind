/**
 * AdaptiveQueenIntegration - Integration helper for Adaptive Queen Intelligence
 * 
 * Provides easy integration of the AdaptiveQueen system with the existing game engine.
 * Handles WebSocket connection setup, UI initialization, and Queen management.
 */

import { AdvancedDynamicTexture } from '@babylonjs/gui';
import { AdaptiveQueen } from './entities/AdaptiveQueen';
import { WebSocketClient } from '../networking/WebSocketClient';
import { LearningProgressUI } from '../ui/LearningProgressUI';
import { TerritoryManager } from './TerritoryManager';
import { GameState } from './GameState';
import { GameEngine } from './GameEngine';
import { ObservationCollector } from './systems/ObservationCollector';
import { ObservationData, SpawnDecision } from './types/ObservationTypes';

export interface AdaptiveQueenIntegrationConfig {
    gameEngine: GameEngine;
    territoryManager: TerritoryManager;
    gameState: GameState;
    guiTexture: AdvancedDynamicTexture;
    websocketUrl?: string;
    enableLearning?: boolean;
}

/**
 * AdaptiveQueenIntegration class - Manages AI learning system integration
 */
export class AdaptiveQueenIntegration {
    private gameEngine: GameEngine;
    private territoryManager: TerritoryManager;
    private gameState: GameState;
    private guiTexture: AdvancedDynamicTexture;
    
    private websocketClient: WebSocketClient;
    private learningProgressUI: LearningProgressUI;

    private enableLearning: boolean;
    private isInitialized: boolean = false;
    private currentQueen?: AdaptiveQueen;

    // Observation collector for chunk-based data
    private observationCollector: ObservationCollector;
    private currentTerritoryId: string = '';
    private useChunkObservations: boolean = true; // Feature flag for chunk-based system

    // Default WebSocket URL for AI backend
    private readonly DEFAULT_WEBSOCKET_URL = 'ws://localhost:8000/ws';

    constructor(config: AdaptiveQueenIntegrationConfig) {
        this.gameEngine = config.gameEngine;
        this.territoryManager = config.territoryManager;
        this.gameState = config.gameState;
        this.guiTexture = config.guiTexture;
        this.enableLearning = config.enableLearning !== false;

        // Initialize WebSocket client
        const websocketUrl = config.websocketUrl || this.DEFAULT_WEBSOCKET_URL;
        this.websocketClient = new WebSocketClient({
            url: websocketUrl,
            clientId: `game_client_${Date.now()}`,
            reconnectInterval: 5000,
            maxReconnectAttempts: 10,
            heartbeatInterval: 30000,
            messageTimeout: 30000
        });
        
        // Initialize learning progress UI
        this.learningProgressUI = new LearningProgressUI({
            parentTexture: this.guiTexture,
            visible: this.enableLearning
        });

        // Initialize observation collector
        this.observationCollector = new ObservationCollector();
        this.setupObservationCallbacks();

        // AdaptiveQueenIntegration created silently
    }

    /**
     * Initialize the adaptive Queen system
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.warn('🧠 AdaptiveQueenIntegration already initialized');
            return;
        }
        
        try {
            // Connect to AI backend if learning is enabled
            if (this.enableLearning) {
                await this.connectToAIBackend();
            }
            
            // Initialize territory manager with AI learning capabilities
            this.territoryManager.initializeAILearning(this.websocketClient, this.gameState);
            this.territoryManager.setAILearningEnabled(this.enableLearning);
            
            // Set up event handlers
            this.setupEventHandlers();
            
            this.isInitialized = true;
            // AdaptiveQueenIntegration initialized successfully
            
        } catch (error) {
            console.error('🧠 Failed to initialize AdaptiveQueenIntegration:', error);
            
            // Fallback to non-learning mode
            this.enableLearning = false;
            this.territoryManager.setAILearningEnabled(false);
            this.learningProgressUI.hide();
            
            console.log('🧠 Falling back to standard Queen behavior');
        }
    }

    /**
     * Connect to AI backend WebSocket server
     */
    private async connectToAIBackend(): Promise<void> {
        try {
            await this.websocketClient.connect();
            console.log('🧠 Connected to AI backend');
            
            // Test connection with health check
            const healthResponse = await this.websocketClient.healthCheck();
            console.log('🧠 AI backend health check:', healthResponse);
            
        } catch (error) {
            console.error('🧠 Failed to connect to AI backend:', error);
            throw error;
        }
    }

    /**
     * Set up event handlers for Queen monitoring
     */
    private setupEventHandlers(): void {
        // Note: TerritoryManager doesn't have onQueenCreated event yet
        // This would need to be added to TerritoryManager for full integration
        // For now, we'll monitor Queens through other means

        // Handle WebSocket connection events
        this.websocketClient.on('connected', () => {
            console.log('🧠 AI backend connected');
        });

        this.websocketClient.on('disconnected', () => {
            console.log('🧠 AI backend disconnected');
        });

        this.websocketClient.on('reconnected', () => {
            console.log('🧠 AI backend reconnected');
        });

        this.websocketClient.on('error', (error: any) => {
            console.error('🧠 AI backend error:', error);
        });

        // Handle spawn_decision messages from backend
        this.websocketClient.on('spawn_decision', (decision: SpawnDecision) => {
            this.handleSpawnDecision(decision);
        });
    }

    /**
     * Set up observation collector callbacks
     */
    private setupObservationCallbacks(): void {
        this.observationCollector.onObservationReady((data: ObservationData) => {
            this.sendObservationToBackend(data);
        });
    }

    /**
     * Send observation data to backend for processing
     */
    private async sendObservationToBackend(observation: ObservationData): Promise<void> {
        if (!this.enableLearning || !this.websocketClient.getStatus().connected) {
            return;
        }

        try {
            await this.websocketClient.send({
                type: 'observation_data',
                data: observation
            });
        } catch (error) {
            console.error('🧠 Failed to send observation data:', error);
        }
    }

    /**
     * Handle spawn decision from backend
     */
    private handleSpawnDecision(decision: SpawnDecision): void {
        if (!this.currentTerritoryId) {
            return;
        }

        const territory = this.territoryManager.getTerritory(this.currentTerritoryId);
        const queen = territory?.queen;

        if (!queen || !queen.isActiveQueen()) {
            return;
        }

        // Check if Queen can afford the spawn
        const energySystem = queen.getEnergySystem();
        if (!energySystem.canAffordSpawn(decision.spawnType)) {
            return;
        }

        // Execute spawn via ParasiteManager
        const parasiteManager = this.gameEngine.getParasiteManager();
        if (parasiteManager && typeof (parasiteManager as any).spawnAtChunk === 'function') {
            (parasiteManager as any).spawnAtChunk(decision.spawnChunk, decision.spawnType, queen);
        }
    }

    /**
     * Monitor an AdaptiveQueen for learning progress
     */
    private monitorAdaptiveQueen(queen: AdaptiveQueen): void {
        this.currentQueen = queen;
        
        // Connect UI to Queen
        this.learningProgressUI.setQueen(queen);
        
        // Show learning UI if hidden
        if (this.enableLearning) {
            this.learningProgressUI.show();
        }
        
        console.log(`🧠 Now monitoring AdaptiveQueen ${queen.id} (Gen ${queen.getGeneration()})`);
    }

    /**
     * Manually set a Queen to monitor (useful for integration)
     */
    public setQueenToMonitor(queen: AdaptiveQueen): void {
        this.monitorAdaptiveQueen(queen);
    }

    /**
     * Update the integration (called each frame)
     */
    public update(deltaTime: number): void {
        if (!this.isInitialized) {
            return;
        }

        // Update learning progress UI
        this.learningProgressUI.update(deltaTime);

        // Update observation collector
        if (this.useChunkObservations && this.currentTerritoryId) {
            this.observationCollector.update(deltaTime, this.currentTerritoryId);
        }
    }

    /**
     * Start observation collection for a territory
     */
    public startObservationForTerritory(territoryId: string): void {
        this.currentTerritoryId = territoryId;
        this.observationCollector.startWindow(territoryId);
    }

    /**
     * Stop observation collection
     */
    public stopObservation(): void {
        this.observationCollector.stopWindow();
        this.currentTerritoryId = '';
    }

    /**
     * Enable/disable chunk-based observation system
     */
    public setChunkObservationsEnabled(enabled: boolean): void {
        this.useChunkObservations = enabled;
        if (!enabled) {
            this.observationCollector.stopWindow();
        }
    }

    /**
     * Get observation collector for direct access
     */
    public getObservationCollector(): ObservationCollector {
        return this.observationCollector;
    }

    /**
     * Enable or disable AI learning
     */
    public setLearningEnabled(enabled: boolean): void {
        this.enableLearning = enabled;
        
        if (this.isInitialized) {
            this.territoryManager.setAILearningEnabled(enabled);
            
            if (enabled) {
                this.learningProgressUI.show();
            } else {
                this.learningProgressUI.hide();
            }
        }
        
        console.log(`🧠 AI learning ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if AI learning is enabled
     */
    public isLearningEnabled(): boolean {
        return this.enableLearning;
    }

    /**
     * Get current WebSocket connection status
     */
    public getConnectionStatus(): any {
        return this.websocketClient.getStatus();
    }

    /**
     * Get current monitored Queen
     */
    public getCurrentQueen(): AdaptiveQueen | undefined {
        return this.currentQueen;
    }

    /**
     * Get learning progress UI
     */
    public getLearningProgressUI(): LearningProgressUI {
        return this.learningProgressUI;
    }

    /**
     * Get WebSocket client for advanced usage
     */
    public getWebSocketClient(): WebSocketClient {
        return this.websocketClient;
    }

    /**
     * Toggle learning progress UI visibility
     */
    public toggleLearningUI(): void {
        this.learningProgressUI.toggleVisibility();
    }

    /**
     * Force reconnection to AI backend
     */
    public async reconnectToAIBackend(): Promise<void> {
        if (!this.enableLearning) {
            console.warn('🧠 AI learning is disabled, cannot reconnect');
            return;
        }
        
        try {
            await this.websocketClient.disconnect();
            await this.websocketClient.connect();
            console.log('🧠 Reconnected to AI backend');
        } catch (error) {
            console.error('🧠 Failed to reconnect to AI backend:', error);
        }
    }

    /**
     * Get AI learning statistics
     */
    public getAIStatistics(): {
        isConnected: boolean;
        currentGeneration: number;
        learningEnabled: boolean;
        queuedMessages: number;
        generationHistory: Map<number, any>;
    } {
        return {
            isConnected: this.websocketClient.getStatus().connected,
            currentGeneration: this.currentQueen?.getGeneration() || 0,
            learningEnabled: this.enableLearning,
            queuedMessages: this.websocketClient.getQueuedMessageCount(),
            generationHistory: this.learningProgressUI.getGenerationHistory()
        };
    }

    /**
     * Start AI training session (placeholder - performance monitoring removed for simplicity)
     */
    public async startAITrainingSession(trainingData: any): Promise<void> {
        // Performance monitoring removed - KISS principle
    }

    /**
     * End AI training session (placeholder)
     */
    public async endAITrainingSession(trainingResult?: any): Promise<void> {
        // Performance monitoring removed - KISS principle
    }

    /**
     * Get current performance status (stub)
     */
    public getPerformanceStatus(): {
        isTrainingActive: boolean;
        currentFPS: number;
        fpsImpact: number;
        trainingDuration: number;
        performanceIsolationActive: boolean;
        requirementsMet: boolean;
        performanceSummary: any;
    } {
        return {
            isTrainingActive: false,
            currentFPS: 60,
            fpsImpact: 0,
            trainingDuration: 0,
            performanceIsolationActive: false,
            requirementsMet: true,
            performanceSummary: {}
        };
    }

    /**
     * Get performance optimization recommendations (stub)
     */
    public getPerformanceRecommendations(): string[] {
        return [];
    }

    /**
     * Configure performance isolation settings (stub)
     */
    public configurePerformanceIsolation(settings: {
        enabled?: boolean;
        targetFPS?: number;
        warningThreshold?: number;
        criticalThreshold?: number;
        adaptiveScaling?: boolean;
    }): void {
        // Performance monitoring removed - KISS principle
    }

    /**
     * Configure AI training performance parameters (stub)
     */
    public configureAITrainingPerformance(config: {
        maxTrainingDuration?: number;
        allowedFPSImpact?: number;
        memoryThreshold?: number;
        cpuThreshold?: number;
    }): void {
        // Performance monitoring removed - KISS principle
    }

    /**
     * Check if system can maintain 60fps during AI training (stub)
     */
    public canMaintain60FPSDuringTraining(): boolean {
        return true;
    }

    /**
     * Dispose integration and cleanup resources
     */
    public dispose(): void {
        // Disconnect WebSocket
        this.websocketClient.disconnect();

        // Dispose UI
        this.learningProgressUI.dispose();

        // Dispose observation collector
        this.observationCollector.dispose();

        // Clear references
        this.currentQueen = undefined;
        this.currentTerritoryId = '';
        this.isInitialized = false;

        console.log('🧠 AdaptiveQueenIntegration disposed');
    }
}

/**
 * Helper function to create and initialize AdaptiveQueenIntegration
 */
export async function createAdaptiveQueenIntegration(config: AdaptiveQueenIntegrationConfig): Promise<AdaptiveQueenIntegration> {
    const integration = new AdaptiveQueenIntegration(config);
    await integration.initialize();
    return integration;
}

/**
 * Helper function to check if AI backend is available
 */
export async function checkAIBackendAvailability(websocketUrl?: string): Promise<boolean> {
    const testClient = new WebSocketClient({
        url: websocketUrl || 'ws://localhost:8000/ws',
        clientId: 'test_client',
        maxReconnectAttempts: 1
    });
    
    try {
        await testClient.connect();
        await testClient.healthCheck();
        await testClient.disconnect();
        return true;
    } catch (error) {
        return false;
    }
}