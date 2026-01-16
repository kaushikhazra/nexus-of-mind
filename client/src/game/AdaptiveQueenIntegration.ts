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
import { StrategyExecutor, MapBounds } from './systems/StrategyExecutor';
import { StrategyUpdate, StrategyUpdateMessage } from './types/StrategyTypes';
import { UnitManager } from './UnitManager';
import { ParasiteManager } from './ParasiteManager';
import { EnergyManager } from './EnergyManager';
import { QueenEnergySystem } from './systems/QueenEnergySystem';

export interface AdaptiveQueenIntegrationConfig {
    gameEngine: GameEngine;
    territoryManager: TerritoryManager;
    gameState: GameState;
    guiTexture: AdvancedDynamicTexture;
    websocketUrl?: string;
    enableLearning?: boolean;
    // New: Dependencies for continuous learning
    unitManager?: UnitManager;
    parasiteManager?: ParasiteManager;
    energyManager?: EnergyManager;
    mapBounds?: MapBounds;
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

    // Continuous learning systems
    private observationCollector: ObservationCollector | null = null;
    private strategyExecutor: StrategyExecutor | null = null;
    private unitManager: UnitManager | null = null;
    private parasiteManager: ParasiteManager | null = null;
    private energyManager: EnergyManager | null = null;

    // Queen energy system for spawn cost control
    private queenEnergySystem: QueenEnergySystem | null = null;

    private enableLearning: boolean;
    private enableContinuousLearning: boolean = true;
    private isInitialized: boolean = false;
    private currentQueen?: AdaptiveQueen;

    // Default WebSocket URL for AI backend
    private readonly DEFAULT_WEBSOCKET_URL = 'ws://localhost:8000/ws';

    // Default map bounds (can be overridden)
    private readonly DEFAULT_MAP_BOUNDS: MapBounds = {
        minX: -100,
        maxX: 100,
        minZ: -100,
        maxZ: 100
    };

    constructor(config: AdaptiveQueenIntegrationConfig) {
        this.gameEngine = config.gameEngine;
        this.territoryManager = config.territoryManager;
        this.gameState = config.gameState;
        this.guiTexture = config.guiTexture;
        this.enableLearning = config.enableLearning !== false;

        // Store dependencies for continuous learning
        this.unitManager = config.unitManager || null;
        this.parasiteManager = config.parasiteManager || null;
        this.energyManager = config.energyManager || null;

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

        // Initialize continuous learning systems only if learning is enabled and dependencies available
        this.enableContinuousLearning = this.enableLearning;
        if (this.enableLearning) {
            this.initializeContinuousLearning(config.mapBounds || this.DEFAULT_MAP_BOUNDS);
        }

        // AdaptiveQueenIntegration created silently
    }

    /**
     * Initialize continuous learning systems (ObservationCollector + StrategyExecutor)
     */
    private initializeContinuousLearning(mapBounds: MapBounds): void {
        // Only initialize if all dependencies are available
        if (!this.unitManager || !this.parasiteManager || !this.energyManager) {
            console.log('Continuous learning: Missing dependencies, will be initialized later');
            return;
        }

        try {
            // Create observation collector with SpatialIndex for O(1) lookups
            const spatialIndex = this.gameEngine.getSpatialIndex();
            this.observationCollector = new ObservationCollector(
                this.gameState,
                this.unitManager,
                this.parasiteManager,
                this.territoryManager,
                this.energyManager,
                spatialIndex
            );
            this.observationCollector.setWebSocketClient(this.websocketClient);

            // Create strategy executor
            this.strategyExecutor = new StrategyExecutor(mapBounds);

            // Wire strategy executor to parasite manager for spawn and behavior control
            this.parasiteManager.setStrategyExecutor(this.strategyExecutor);

            // Create Queen energy system for spawn cost control
            this.queenEnergySystem = new QueenEnergySystem({
                maxEnergy: 100,
                startingEnergyPercent: 0.5,  // Start at 50%
                regenRate: 3.0               // 3 energy per second
            });

            // Wire energy system to parasite manager
            this.parasiteManager.setQueenEnergySystem(this.queenEnergySystem);

            // Set up callback for when observation data triggers a strategy update
            this.observationCollector.setOnObservationReady((data) => {
                // Observation sent to backend via WebSocket
            });

            console.log('Continuous learning systems initialized (with Queen energy system)');
        } catch (error) {
            console.error('Failed to initialize continuous learning:', error);
        }
    }

    /**
     * Late initialization of continuous learning (when dependencies become available)
     */
    public initializeContinuousLearningWithDependencies(
        unitManager: UnitManager,
        parasiteManager: ParasiteManager,
        energyManager: EnergyManager,
        mapBounds?: MapBounds
    ): void {
        this.unitManager = unitManager;
        this.parasiteManager = parasiteManager;
        this.energyManager = energyManager;
        this.initializeContinuousLearning(mapBounds || this.DEFAULT_MAP_BOUNDS);
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

            console.log('Falling back to standard Queen behavior');
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
            console.log('AI backend connected');
        });

        this.websocketClient.on('disconnected', () => {
            console.log('AI backend disconnected');
        });

        this.websocketClient.on('reconnected', () => {
            console.log('AI backend reconnected');
        });

        this.websocketClient.on('error', (error: any) => {
            console.error('AI backend error:', error);
        });

        // Handle strategy updates from continuous learning
        this.websocketClient.on('strategy_update', (message: any) => {
            console.log(`[AdaptiveQueenIntegration] 📡 Strategy update received from server`);
            if (message.payload) {
                this.handleStrategyUpdate(message.payload);
            }
        });
    }

    /**
     * Handle incoming strategy update from AI backend
     */
    private handleStrategyUpdate(strategyData: any): void {
        if (!this.strategyExecutor) return;

        try {
            // Convert backend response to StrategyUpdate
            const strategy: StrategyUpdate = {
                timestamp: strategyData.timestamp || Date.now(),
                version: strategyData.version || 0,
                confidence: strategyData.confidence || 0.5,
                spawn: {
                    zone: strategyData.spawn?.zone || { x: 0.5, y: 0.5 },
                    rate: strategyData.spawn?.rate || 0.5,
                    burstSize: strategyData.spawn?.burstSize || 3,
                    secondaryZones: strategyData.spawn?.secondaryZones
                },
                tactics: {
                    aggression: strategyData.tactics?.aggression || 0.5,
                    targetPriority: strategyData.tactics?.targetPriority || 'MINERS',
                    formation: strategyData.tactics?.formation || 'SWARM',
                    attackTiming: strategyData.tactics?.attackTiming || 'OPPORTUNISTIC'
                },
                debug: strategyData.debug
            };

            this.strategyExecutor.applyStrategy(strategy);
            // Strategy update applied
        } catch (error) {
            console.error('Failed to apply strategy update:', error);
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

        const currentTime = performance.now();

        // Update Queen energy system (passive regeneration)
        if (this.queenEnergySystem) {
            this.queenEnergySystem.update(deltaTime);
        }

        // Update continuous learning systems
        if (this.enableContinuousLearning) {
            // Collect observations (handles its own timing)
            if (this.observationCollector) {
                this.observationCollector.update(currentTime);
            }

            // Update strategy executor (handles spawning timing)
            if (this.strategyExecutor) {
                this.strategyExecutor.update(deltaTime);
            }
        }

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
     * Enable or disable continuous learning
     */
    public setContinuousLearningEnabled(enabled: boolean): void {
        this.enableContinuousLearning = enabled;
        if (this.observationCollector) {
            this.observationCollector.setEnabled(enabled);
        }
        if (this.strategyExecutor) {
            this.strategyExecutor.setEnabled(enabled);
        }
        console.log(`Continuous learning ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if continuous learning is enabled
     */
    public isContinuousLearningEnabled(): boolean {
        return this.enableContinuousLearning;
    }

    /**
     * Get the observation collector for external access
     */
    public getObservationCollector(): ObservationCollector | null {
        return this.observationCollector;
    }

    /**
     * Get the strategy executor for external access
     */
    public getStrategyExecutor(): StrategyExecutor | null {
        return this.strategyExecutor;
    }

    /**
     * Get the Queen energy system for external access
     */
    public getQueenEnergySystem(): QueenEnergySystem | null {
        return this.queenEnergySystem;
    }

    /**
     * Get current strategy info for debugging
     */
    public getStrategyDebugInfo(): any {
        if (!this.strategyExecutor) {
            return { status: 'not_available' };
        }
        return this.strategyExecutor.getDebugInfo();
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
     * Reset the neural network to initial random state
     * Clears all training history and deletes saved model
     */
    public async resetNeuralNetwork(): Promise<{ success: boolean; message: string }> {
        console.log('🧠 Requesting neural network reset...');

        try {
            const response = await this.websocketClient.send({
                type: 'reset_nn',
                data: { confirm: true }
            }, true);

            if (response && (response as any).data?.status === 'success') {
                console.log('🧠 ✅ Neural network reset successfully!');
                console.log('🧠    Model file deleted:', (response as any).data?.deleted_model_file);

                // Reset local strategy executor
                if (this.strategyExecutor) {
                    this.strategyExecutor.resetToDefault();
                }

                return {
                    success: true,
                    message: (response as any).data?.message || 'Reset successful'
                };
            } else {
                const errorMsg = (response as any)?.data?.message || 'Unknown error';
                console.error('🧠 ❌ Neural network reset failed:', errorMsg);
                return { success: false, message: errorMsg };
            }
        } catch (error) {
            console.error('🧠 ❌ Neural network reset error:', error);
            return { success: false, message: String(error) };
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
        // Dispose continuous learning systems
        if (this.observationCollector) {
            this.observationCollector.dispose();
            this.observationCollector = null;
        }
        if (this.strategyExecutor) {
            this.strategyExecutor.dispose();
            this.strategyExecutor = null;
        }

        // Disconnect WebSocket
        this.websocketClient.disconnect();

        // Clear references
        this.currentQueen = undefined;
        this.isInitialized = false;

        console.log('AdaptiveQueenIntegration disposed');
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