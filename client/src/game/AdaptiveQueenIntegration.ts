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
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { PerformanceOptimizer } from './PerformanceOptimizer';

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
    private performanceMonitor: PerformanceMonitor;
    private performanceOptimizer: PerformanceOptimizer;
    
    private enableLearning: boolean;
    private isInitialized: boolean = false;
    private currentQueen?: AdaptiveQueen;
    
    // Default WebSocket URL for AI backend
    private readonly DEFAULT_WEBSOCKET_URL = 'ws://localhost:8000/ws';

    constructor(config: AdaptiveQueenIntegrationConfig) {
        this.gameEngine = config.gameEngine;
        this.territoryManager = config.territoryManager;
        this.gameState = config.gameState;
        this.guiTexture = config.guiTexture;
        this.enableLearning = config.enableLearning !== false;
        
        // Initialize performance monitoring (Requirement 8.1: Maintain 60fps)
        const scene = this.gameEngine.getScene();
        const engine = this.gameEngine.getEngine();
        
        if (!scene || !engine) {
            throw new Error('GameEngine scene or engine not available for performance monitoring');
        }
        
        this.performanceMonitor = new PerformanceMonitor(scene, engine);
        this.performanceOptimizer = new PerformanceOptimizer(this.performanceMonitor);
        
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
        
        console.log('🧠 AdaptiveQueenIntegration created with performance monitoring');
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
            // Start performance monitoring (Requirement 8.1)
            this.performanceMonitor.startMonitoring();
            
            // Configure performance optimization for AI training
            this.performanceOptimizer.configureIsolation({
                enabled: true,
                targetFPS: 60,
                warningThreshold: 50,
                criticalThreshold: 40,
                adaptiveScaling: true
            });
            
            // Set up performance callbacks
            this.performanceOptimizer.setCallbacks({
                onWarning: (impact) => {
                    console.warn(`⚠️ Performance warning during AI training: ${impact} FPS impact`);
                },
                onCritical: (impact) => {
                    console.error(`🚨 Critical performance issue: ${impact} FPS impact`);
                },
                onThrottled: (reason) => {
                    console.warn(`🚨 AI training throttled: ${reason}`);
                }
            });
            
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
            console.log('🧠 AdaptiveQueenIntegration initialized successfully with performance monitoring');
            
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
     * Start AI training session with performance monitoring (Requirement 8.1)
     */
    public async startAITrainingSession(trainingData: any): Promise<void> {
        await this.performanceOptimizer.startAITrainingSession(trainingData);
    }

    /**
     * End AI training session
     */
    public async endAITrainingSession(trainingResult?: any): Promise<void> {
        await this.performanceOptimizer.endAITrainingSession(trainingResult);
    }

    /**
     * Get current performance status (Requirements 8.1, 8.2, 8.3, 8.4, 8.5)
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
        const optimizerStatus = this.performanceOptimizer.getPerformanceStatus();
        const performanceSummary = this.performanceMonitor.getPerformanceSummary();
        
        return {
            ...optimizerStatus,
            performanceSummary
        };
    }

    /**
     * Get performance optimization recommendations
     */
    public getPerformanceRecommendations(): string[] {
        return this.performanceOptimizer.getOptimizationRecommendations();
    }

    /**
     * Configure performance isolation settings
     */
    public configurePerformanceIsolation(settings: {
        enabled?: boolean;
        targetFPS?: number;
        warningThreshold?: number;
        criticalThreshold?: number;
        adaptiveScaling?: boolean;
    }): void {
        this.performanceOptimizer.configureIsolation(settings);
    }

    /**
     * Configure AI training performance parameters
     */
    public configureAITrainingPerformance(config: {
        maxTrainingDuration?: number;
        allowedFPSImpact?: number;
        memoryThreshold?: number;
        cpuThreshold?: number;
    }): void {
        this.performanceOptimizer.configureTraining(config);
    }

    /**
     * Check if system can maintain 60fps during AI training (Requirement 8.1)
     */
    public canMaintain60FPSDuringTraining(): boolean {
        return this.performanceMonitor.canMaintain60FPSDuringCombat(); // Reuse combat performance check
    }

    /**
     * Dispose integration and cleanup resources
     */
    public dispose(): void {
        // Stop performance monitoring
        this.performanceMonitor.dispose();
        this.performanceOptimizer.dispose();
        
        // Disconnect WebSocket
        this.websocketClient.disconnect();
        
        // Dispose UI
        this.learningProgressUI.dispose();
        
        // Clear references
        this.currentQueen = undefined;
        this.isInitialized = false;
        
        console.log('🧠 AdaptiveQueenIntegration disposed with performance monitoring cleanup');
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