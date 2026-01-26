/**
 * AdaptiveQueenIntegration - Integration helper for Adaptive Queen Intelligence
 * 
 * Provides easy integration of the AdaptiveQueen system with the existing game engine.
 * Handles WebSocket connection setup, UI initialization, and Queen management.
 */

import { AdvancedDynamicTexture } from '@babylonjs/gui';
import { AdaptiveQueen } from './entities/AdaptiveQueen';
import { WebSocketClient } from '../networking/WebSocketClient';
import { TerritoryManager } from './TerritoryManager';
import { GameState } from './GameState';
import { GameEngine } from './GameEngine';
import { ObservationCollector } from './systems/ObservationCollector';
import { ObservationData, SpawnDecision } from './types/ObservationTypes';
import { getWebSocketUrl } from '../config';

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

    private enableLearning: boolean;
    private isInitialized: boolean = false;
    private currentQueen?: AdaptiveQueen;

    // Observation collector for chunk-based data
    private observationCollector: ObservationCollector;
    private currentTerritoryId: string = '';
    private useChunkObservations: boolean = true; // Feature flag for chunk-based system

    // Default WebSocket URL for AI backend (from config)
    private readonly DEFAULT_WEBSOCKET_URL = getWebSocketUrl();

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
            console.log('🧠 Observation ready, sending to backend...', {
                workers: data.miningWorkers?.length || 0,
                protectors: data.protectors?.length || 0,
                parasitesEnd: data.parasitesEnd?.length || 0
            });
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
    private handleSpawnDecision(decision: any): void {
        // Extract data from nested structure
        const data = decision.data || decision;
        const spawnChunk = data.spawnChunk;
        const spawnType = data.spawnType;
        const confidence = data.confidence;

        console.log('🧠 Spawn decision received:', { spawnChunk, spawnType, confidence: confidence?.toFixed(3) });

        if (!this.currentTerritoryId) {
            console.log('🧠 No current territory, ignoring spawn decision');
            return;
        }

        // Check for no-spawn decision (spawnChunk == -1)
        if (spawnChunk === -1) {
            console.log('🧠 NN decided NO SPAWN');
            return;
        }

        // Check for valid spawn decision (spawnChunk >= 0)
        if (spawnChunk < 0 || spawnType === null || spawnType === undefined) {
            console.log('🧠 Invalid spawn decision data');
            return;
        }

        const territory = this.territoryManager.getTerritory(this.currentTerritoryId);
        const queen = territory?.queen;

        if (!queen || !queen.isActiveQueen()) {
            console.log('🧠 No active Queen, ignoring spawn decision');
            return;
        }

        // Check if Queen can afford the spawn
        const energySystem = queen.getEnergySystem();
        if (!energySystem.canAffordSpawn(spawnType)) {
            console.log('🧠 Queen cannot afford spawn:', spawnType);
            return;
        }

        // Execute spawn via ParasiteManager
        const parasiteManager = this.gameEngine.getParasiteManager();
        if (parasiteManager && typeof (parasiteManager as any).spawnAtChunk === 'function') {
            console.log('🧠 Executing spawn at chunk', spawnChunk, 'type:', spawnType);
            (parasiteManager as any).spawnAtChunk(spawnChunk, spawnType, queen);
        }
    }

    /**
     * Monitor an AdaptiveQueen for learning progress
     */
    private monitorAdaptiveQueen(queen: AdaptiveQueen): void {
        this.currentQueen = queen;
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

        // Auto-start observation for active Queens
        if (this.useChunkObservations && !this.currentTerritoryId) {
            this.autoStartObservationForActiveQueen();
        }

        // Update observation collector
        if (this.useChunkObservations && this.currentTerritoryId) {
            this.observationCollector.update(deltaTime, this.currentTerritoryId);
        }
    }

    /**
     * Auto-detect and start observation for an active Queen
     */
    private autoStartObservationForActiveQueen(): void {
        const queens = this.territoryManager.getAllQueens();
        for (const queen of queens) {
            if (queen.isActiveQueen()) {
                const territory = queen.getTerritory();
                if (territory) {
                    console.log(`🧠 Auto-starting observation for territory ${territory.id}`);
                    this.startObservationForTerritory(territory.id);
                    this.currentQueen = queen as any;
                    break;
                }
            }
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
     * Get WebSocket client for advanced usage
     */
    public getWebSocketClient(): WebSocketClient {
        return this.websocketClient;
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
    } {
        return {
            isConnected: this.websocketClient.getStatus().connected,
            currentGeneration: this.currentQueen?.getGeneration() || 0,
            learningEnabled: this.enableLearning,
            queuedMessages: this.websocketClient.getQueuedMessageCount()
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
        url: websocketUrl || getWebSocketUrl(),
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