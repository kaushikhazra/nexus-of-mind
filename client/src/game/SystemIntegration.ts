/**
 * SystemIntegration - Complete end-to-end integration for Adaptive Queen Intelligence
 * 
 * Manages the full learning cycle from Queen death to strategy application,
 * with comprehensive logging, debugging, and error recovery.
 */

import { GameEngine } from './GameEngine';
import { TerritoryManager } from './TerritoryManager';
import { GameState } from './GameState';
import { AdaptiveQueenIntegration } from './AdaptiveQueenIntegration';
import { AdaptiveQueen } from './entities/AdaptiveQueen';
import { WebSocketClient } from '../networking/WebSocketClient';
import { Logger, LogCategory, integrationLogger } from '../utils/Logger';
import { DebugUI } from '../ui/DebugUI';
import { AdvancedDynamicTexture } from '@babylonjs/gui';

export interface SystemIntegrationConfig {
    gameEngine: GameEngine;
    territoryManager: TerritoryManager;
    gameState: GameState;
    guiTexture: AdvancedDynamicTexture;
    enableDebugUI?: boolean;
    enableAILearning?: boolean;
    websocketUrl?: string;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface LearningCycleMetrics {
    cycleId: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    queenId: string;
    generation: number;
    deathCause: string;
    survivalTime: number;
    learningPhases: {
        deathAnalysis: { startTime: number; endTime?: number; success: boolean };
        neuralTraining: { startTime: number; endTime?: number; success: boolean };
        strategyGeneration: { startTime: number; endTime?: number; success: boolean };
        strategyApplication: { startTime: number; endTime?: number; success: boolean };
    };
    errors: Array<{ phase: string; error: string; timestamp: number }>;
    performanceMetrics: {
        fpsImpact: number;
        memoryUsage: number;
        networkLatency: number;
    };
}

/**
 * Complete system integration for end-to-end AI learning
 */
export class SystemIntegration {
    private gameEngine: GameEngine;
    private territoryManager: TerritoryManager;
    private gameState: GameState;
    private guiTexture: AdvancedDynamicTexture;
    
    private adaptiveQueenIntegration!: AdaptiveQueenIntegration;
    private debugUI?: DebugUI;
    private logger: Logger;
    
    private isInitialized: boolean = false;
    private enableDebugUI: boolean;
    private enableAILearning: boolean;
    
    // Learning cycle tracking
    private activeLearningCycles: Map<string, LearningCycleMetrics> = new Map();
    private completedCycles: LearningCycleMetrics[] = [];
    private cycleCounter: number = 0;
    
    // Performance monitoring
    private performanceBaseline: { fps: number; memory: number } | null = null;
    private integrationStartTime: number = 0;

    constructor(config: SystemIntegrationConfig) {
        this.gameEngine = config.gameEngine;
        this.territoryManager = config.territoryManager;
        this.gameState = config.gameState;
        this.guiTexture = config.guiTexture;
        this.enableDebugUI = config.enableDebugUI !== false;
        this.enableAILearning = config.enableAILearning !== false;
        
        // Initialize logger with appropriate level
        this.logger = Logger.getInstance({
            level: this.getLogLevel(config.logLevel || 'info'),
            enableConsole: true,
            enableStorage: true,
            enableRemote: this.enableAILearning,
            remoteEndpoint: config.websocketUrl?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:8000'
        });
        
        integrationLogger.info('SystemIntegration created', {
            enableDebugUI: this.enableDebugUI,
            enableAILearning: this.enableAILearning,
            websocketUrl: config.websocketUrl
        });
    }

    /**
     * Initialize the complete system integration
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            integrationLogger.warn('SystemIntegration already initialized');
            return;
        }
        
        this.integrationStartTime = Date.now();
        integrationLogger.info('Starting SystemIntegration initialization');
        
        try {
            // Establish performance baseline
            await this.establishPerformanceBaseline();
            
            // Initialize AdaptiveQueenIntegration
            await this.initializeAdaptiveQueenIntegration();
            
            // Initialize Debug UI if enabled
            if (this.enableDebugUI) {
                await this.initializeDebugUI();
            }
            
            // Set up event handlers for end-to-end learning cycle
            this.setupLearningCycleHandlers();
            
            // Set up performance monitoring
            this.setupPerformanceMonitoring();
            
            // Test system connectivity
            await this.testSystemConnectivity();
            
            this.isInitialized = true;
            
            const initializationTime = Date.now() - this.integrationStartTime;
            integrationLogger.info('SystemIntegration initialized successfully', {
                initializationTime,
                aiLearningEnabled: this.enableAILearning,
                debugUIEnabled: this.enableDebugUI
            });
            
        } catch (error) {
            integrationLogger.error('SystemIntegration initialization failed', error);
            throw error;
        }
    }

    /**
     * Establish performance baseline for monitoring
     */
    private async establishPerformanceBaseline(): Promise<void> {
        integrationLogger.info('Establishing performance baseline');
        
        const performanceMonitor = this.gameEngine.getPerformanceMonitor();
        if (performanceMonitor) {
            // Wait a moment for stable readings
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const summary = performanceMonitor.getPerformanceSummary();
            this.performanceBaseline = {
                fps: summary.averageFPS,
                memory: 0 // Memory usage tracked separately
            };
            
            integrationLogger.info('Performance baseline established', this.performanceBaseline);
        }
    }

    /**
     * Initialize AdaptiveQueenIntegration
     */
    private async initializeAdaptiveQueenIntegration(): Promise<void> {
        integrationLogger.info('Initializing AdaptiveQueenIntegration');
        
        this.adaptiveQueenIntegration = new AdaptiveQueenIntegration({
            gameEngine: this.gameEngine,
            territoryManager: this.territoryManager,
            gameState: this.gameState,
            guiTexture: this.guiTexture,
            enableLearning: this.enableAILearning
        });
        
        await this.adaptiveQueenIntegration.initialize();
        integrationLogger.info('AdaptiveQueenIntegration initialized');
    }

    /**
     * Initialize Debug UI
     */
    private async initializeDebugUI(): Promise<void> {
        integrationLogger.info('Initializing Debug UI');
        
        this.debugUI = new DebugUI({
            parentTexture: this.guiTexture,
            gameEngine: this.gameEngine,
            visible: true,
            position: 'top-right'
        });
        
        integrationLogger.info('Debug UI initialized');
    }

    /**
     * Set up event handlers for complete learning cycle
     */
    private setupLearningCycleHandlers(): void {
        integrationLogger.info('Setting up learning cycle handlers');
        
        // Monitor Queen creation
        this.territoryManager.onQueenCreated = (queen: AdaptiveQueen) => {
            this.handleQueenCreated(queen);
        };
        
        // Monitor Queen death (start of learning cycle)
        this.territoryManager.onQueenDeath = (queen: AdaptiveQueen) => {
            this.handleQueenDeath(queen);
        };
        
        // Monitor strategy application - only if adaptiveQueenIntegration is available
        if (this.adaptiveQueenIntegration) {
            const websocketClient = this.adaptiveQueenIntegration.getWebSocketClient();
            if (websocketClient) {
                websocketClient.on('queen_strategy', (message: any) => {
                    this.handleStrategyReceived(message);
                });
                
                // Monitor learning progress
                websocketClient.on('learning_progress', (message: any) => {
                    this.handleLearningProgress(message);
                });
                
                // Monitor errors
                websocketClient.on('error', (error: any) => {
                    this.handleLearningError(error);
                });
            }
        }
        
        integrationLogger.info('Learning cycle handlers set up');
    }

    /**
     * Set up performance monitoring during AI training
     */
    private setupPerformanceMonitoring(): void {
        integrationLogger.info('Setting up performance monitoring');
        
        const performanceOptimizer = this.gameEngine.getPerformanceOptimizer();
        if (performanceOptimizer) {
            performanceOptimizer.setCallbacks({
                onWarning: (impact: number) => {
                    integrationLogger.warn('Performance warning during AI training', { fpsImpact: impact });
                    this.updateActiveCyclePerformance({ fpsImpact: impact });
                },
                onCritical: (impact: number) => {
                    integrationLogger.error('Critical performance issue during AI training', { fpsImpact: impact });
                    this.updateActiveCyclePerformance({ fpsImpact: impact });
                },
                onThrottled: (reason: string) => {
                    integrationLogger.warn('AI training throttled', { reason });
                }
            });
        }
        
        integrationLogger.info('Performance monitoring set up');
    }

    /**
     * Test system connectivity and functionality
     */
    private async testSystemConnectivity(): Promise<void> {
        integrationLogger.info('Testing system connectivity');
        
        if (!this.enableAILearning) {
            integrationLogger.info('AI learning disabled, skipping connectivity test');
            return;
        }
        
        try {
            const websocketClient = this.adaptiveQueenIntegration.getWebSocketClient();
            const healthResponse = await websocketClient.healthCheck();
            
            integrationLogger.info('System connectivity test passed', healthResponse);
        } catch (error) {
            integrationLogger.warn('System connectivity test failed', error);
            // Continue with degraded functionality
        }
    }

    /**
     * Handle Queen creation
     */
    private handleQueenCreated(queen: AdaptiveQueen): void {
        integrationLogger.info('Queen created', {
            queenId: queen.id,
            generation: queen.getGeneration(),
            territoryId: queen.getTerritory()?.id
        });

        // Set up monitoring for this Queen - only if adaptiveQueenIntegration is available
        if (this.adaptiveQueenIntegration) {
            this.adaptiveQueenIntegration.setQueenToMonitor(queen);
        }

        // Set up Queen-specific event handlers
        queen.onLearningProgress((learningProgress) => {
            integrationLogger.debug('Queen learning progress update', {
                queenId: queen.id,
                progress: learningProgress.progress
            });
        });
    }

    /**
     * Handle Queen death - start of learning cycle
     */
    private handleQueenDeath(queen: AdaptiveQueen): void {
        const cycleId = `cycle_${++this.cycleCounter}_${Date.now()}`;
        const currentTime = Date.now();
        
        integrationLogger.info('Queen death - starting learning cycle', {
            cycleId,
            queenId: queen.id,
            generation: queen.getGeneration(),
            survivalTime: queen.getSurvivalTime()
        });
        
        // Create learning cycle metrics
        const cycleMetrics: LearningCycleMetrics = {
            cycleId,
            startTime: currentTime,
            queenId: queen.id,
            generation: queen.getGeneration(),
            deathCause: queen.getDeathCause() || 'unknown',
            survivalTime: queen.getSurvivalTime(),
            learningPhases: {
                deathAnalysis: { startTime: currentTime, success: false },
                neuralTraining: { startTime: 0, success: false },
                strategyGeneration: { startTime: 0, success: false },
                strategyApplication: { startTime: 0, success: false }
            },
            errors: [],
            performanceMetrics: {
                fpsImpact: 0,
                memoryUsage: this.getCurrentMemoryUsage(),
                networkLatency: 0
            }
        };
        
        this.activeLearningCycles.set(cycleId, cycleMetrics);
        
        // Mark death analysis phase as started
        cycleMetrics.learningPhases.deathAnalysis.startTime = currentTime;
    }

    /**
     * Handle strategy received from AI backend
     */
    private handleStrategyReceived(message: any): void {
        const queenId = message.data?.queenId;
        const generation = message.data?.generation;
        
        integrationLogger.info('Strategy received from AI backend', {
            queenId,
            generation,
            strategies: Object.keys(message.data?.strategies || {})
        });
        
        // Find active learning cycle for this Queen
        const activeCycle = this.findActiveCycleByQueenId(queenId);
        if (activeCycle) {
            const currentTime = Date.now();
            
            // Mark strategy generation as complete
            activeCycle.learningPhases.strategyGeneration.endTime = currentTime;
            activeCycle.learningPhases.strategyGeneration.success = true;
            
            // Start strategy application phase
            activeCycle.learningPhases.strategyApplication.startTime = currentTime;
            
            integrationLogger.info('Learning cycle: strategy generation completed', {
                cycleId: activeCycle.cycleId,
                phase: 'strategy_generation'
            });
        }
        
        // Apply strategy to next Queen (when created)
        this.scheduleStrategyApplication(message.data);
    }

    /**
     * Handle learning progress updates
     */
    private handleLearningProgress(message: any): void {
        const queenId = message.data?.queenId;
        const phase = message.data?.phase;
        const progress = message.data?.progress;
        
        integrationLogger.debug('Learning progress update', {
            queenId,
            phase,
            progress
        });
        
        // Update active learning cycle
        const activeCycle = this.findActiveCycleByQueenId(queenId);
        if (activeCycle) {
            const currentTime = Date.now();
            
            switch (phase) {
                case 'death_analysis':
                    if (progress >= 1.0) {
                        activeCycle.learningPhases.deathAnalysis.endTime = currentTime;
                        activeCycle.learningPhases.deathAnalysis.success = true;
                        activeCycle.learningPhases.neuralTraining.startTime = currentTime;
                    }
                    break;
                    
                case 'neural_training':
                    if (progress >= 1.0) {
                        activeCycle.learningPhases.neuralTraining.endTime = currentTime;
                        activeCycle.learningPhases.neuralTraining.success = true;
                        activeCycle.learningPhases.strategyGeneration.startTime = currentTime;
                    }
                    break;
            }
        }
    }

    /**
     * Handle learning errors
     */
    private handleLearningError(error: any): void {
        const queenId = error.data?.queenId;
        const errorMessage = error.data?.error || error.message || 'Unknown error';
        
        integrationLogger.error('Learning cycle error', {
            queenId,
            error: errorMessage,
            errorCode: error.data?.errorCode
        });
        
        // Update active learning cycle with error
        const activeCycle = this.findActiveCycleByQueenId(queenId);
        if (activeCycle) {
            activeCycle.errors.push({
                phase: this.getCurrentPhase(activeCycle),
                error: errorMessage,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Schedule strategy application for next Queen
     */
    private scheduleStrategyApplication(strategyData: any): void {
        // This would be called when a new Queen is created
        // For now, we'll store the strategy for later application
        integrationLogger.info('Strategy scheduled for application', {
            queenId: strategyData.queenId,
            generation: strategyData.generation
        });
    }

    /**
     * Complete a learning cycle
     */
    private completeLearningCycle(cycleId: string, success: boolean): void {
        const cycle = this.activeLearningCycles.get(cycleId);
        if (!cycle) return;
        
        const currentTime = Date.now();
        cycle.endTime = currentTime;
        cycle.duration = currentTime - cycle.startTime;
        
        // Mark strategy application as complete
        if (success) {
            cycle.learningPhases.strategyApplication.endTime = currentTime;
            cycle.learningPhases.strategyApplication.success = true;
        }
        
        // Move to completed cycles
        this.completedCycles.push(cycle);
        this.activeLearningCycles.delete(cycleId);
        
        // Keep only last 50 completed cycles
        if (this.completedCycles.length > 50) {
            this.completedCycles = this.completedCycles.slice(-50);
        }
        
        integrationLogger.info('Learning cycle completed', {
            cycleId,
            success,
            duration: cycle.duration,
            phases: Object.keys(cycle.learningPhases).map(phase => ({
                phase,
                success: cycle.learningPhases[phase as keyof typeof cycle.learningPhases].success
            }))
        });
    }

    /**
     * Find active learning cycle by Queen ID
     */
    private findActiveCycleByQueenId(queenId: string): LearningCycleMetrics | undefined {
        for (const cycle of this.activeLearningCycles.values()) {
            if (cycle.queenId === queenId) {
                return cycle;
            }
        }
        return undefined;
    }

    /**
     * Get current phase of a learning cycle
     */
    private getCurrentPhase(cycle: LearningCycleMetrics): string {
        const phases = cycle.learningPhases;
        
        if (!phases.deathAnalysis.endTime) return 'death_analysis';
        if (!phases.neuralTraining.endTime) return 'neural_training';
        if (!phases.strategyGeneration.endTime) return 'strategy_generation';
        if (!phases.strategyApplication.endTime) return 'strategy_application';
        
        return 'completed';
    }

    /**
     * Update performance metrics for active cycles
     */
    private updateActiveCyclePerformance(metrics: Partial<LearningCycleMetrics['performanceMetrics']>): void {
        for (const cycle of this.activeLearningCycles.values()) {
            Object.assign(cycle.performanceMetrics, metrics);
        }
    }

    /**
     * Get current memory usage
     */
    private getCurrentMemoryUsage(): number {
        // Memory usage tracking not available in current PerformanceMonitor
        return 0;
    }

    /**
     * Convert log level string to enum
     */
    private getLogLevel(level: string): number {
        switch (level.toLowerCase()) {
            case 'debug': return 0;
            case 'info': return 1;
            case 'warn': return 2;
            case 'error': return 3;
            default: return 1;
        }
    }

    /**
     * Update the system integration (called each frame)
     */
    public update(deltaTime: number): void {
        if (!this.isInitialized) return;
        
        // Update AdaptiveQueenIntegration
        this.adaptiveQueenIntegration.update(deltaTime);
        
        // Check for stale learning cycles (timeout after 5 minutes)
        this.checkForStaleCycles();
    }

    /**
     * Check for stale learning cycles and clean them up
     */
    private checkForStaleCycles(): void {
        const currentTime = Date.now();
        const CYCLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
        
        for (const [cycleId, cycle] of this.activeLearningCycles.entries()) {
            if (currentTime - cycle.startTime > CYCLE_TIMEOUT) {
                integrationLogger.warn('Learning cycle timed out', {
                    cycleId,
                    duration: currentTime - cycle.startTime
                });
                
                this.completeLearningCycle(cycleId, false);
            }
        }
    }

    /**
     * Get system integration statistics
     */
    public getIntegrationStatistics(): {
        isInitialized: boolean;
        activeCycles: number;
        completedCycles: number;
        totalCycles: number;
        averageCycleDuration: number;
        successRate: number;
        performanceBaseline: any;
        aiLearningEnabled: boolean;
        debugUIEnabled: boolean;
    } {
        const completedSuccessful = this.completedCycles.filter(c => 
            Object.values(c.learningPhases).every(phase => phase.success)
        ).length;
        
        const averageDuration = this.completedCycles.length > 0 
            ? this.completedCycles.reduce((sum, c) => sum + (c.duration || 0), 0) / this.completedCycles.length
            : 0;
        
        return {
            isInitialized: this.isInitialized,
            activeCycles: this.activeLearningCycles.size,
            completedCycles: this.completedCycles.length,
            totalCycles: this.cycleCounter,
            averageCycleDuration: averageDuration,
            successRate: this.completedCycles.length > 0 ? completedSuccessful / this.completedCycles.length : 0,
            performanceBaseline: this.performanceBaseline,
            aiLearningEnabled: this.enableAILearning,
            debugUIEnabled: this.enableDebugUI
        };
    }

    /**
     * Get detailed learning cycle information
     */
    public getLearningCycleDetails(): {
        active: LearningCycleMetrics[];
        completed: LearningCycleMetrics[];
    } {
        return {
            active: Array.from(this.activeLearningCycles.values()),
            completed: this.completedCycles
        };
    }

    /**
     * Toggle debug UI visibility
     */
    public toggleDebugUI(): void {
        if (this.debugUI) {
            this.debugUI.toggle();
        }
    }

    /**
     * Get debug UI instance
     */
    public getDebugUI(): DebugUI | undefined {
        return this.debugUI;
    }

    /**
     * Get AdaptiveQueenIntegration instance
     */
    public getAdaptiveQueenIntegration(): AdaptiveQueenIntegration {
        return this.adaptiveQueenIntegration;
    }

    /**
     * Check if system is initialized
     */
    public getIsInitialized(): boolean {
        return this.isInitialized;
    }

    /**
     * Get AI learning statistics
     */
    public getAIStatistics(): {
        learningEnabled: boolean;
        isConnected: boolean;
        currentGeneration: number;
        queuedMessages: number;
    } {
        if (!this.adaptiveQueenIntegration) {
            return {
                learningEnabled: false,
                isConnected: false,
                currentGeneration: 0,
                queuedMessages: 0
            };
        }

        const aiStats = this.adaptiveQueenIntegration.getAIStatistics();
        return {
            learningEnabled: this.enableAILearning,
            isConnected: aiStats.isConnected,
            currentGeneration: aiStats.currentGeneration,
            queuedMessages: aiStats.queuedMessages
        };
    }

    /**
     * Get performance status
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
        if (!this.adaptiveQueenIntegration) {
            return {
                isTrainingActive: false,
                currentFPS: 60,
                fpsImpact: 0,
                trainingDuration: 0,
                performanceIsolationActive: false,
                requirementsMet: true,
                performanceSummary: null
            };
        }

        return this.adaptiveQueenIntegration.getPerformanceStatus();
    }

    /**
     * Force a test learning cycle (for debugging)
     */
    public async triggerTestLearningCycle(): Promise<void> {
        if (!this.enableAILearning) {
            integrationLogger.warn('Cannot trigger test learning cycle - AI learning disabled');
            return;
        }
        
        if (!this.adaptiveQueenIntegration) {
            integrationLogger.warn('Cannot trigger test learning cycle - AdaptiveQueenIntegration not available');
            return;
        }
        
        integrationLogger.info('Triggering test learning cycle');
        
        const testData = {
            queenId: `test_queen_${Date.now()}`,
            generation: 1,
            deathCause: 'test_death',
            survivalTime: 120,
            territoryId: 'test_territory'
        };
        
        try {
            const websocketClient = this.adaptiveQueenIntegration.getWebSocketClient();
            if (websocketClient) {
                await websocketClient.sendQueenDeath(testData);
                integrationLogger.info('Test learning cycle triggered successfully');
            } else {
                integrationLogger.warn('WebSocket client not available for test learning cycle');
            }
        } catch (error) {
            integrationLogger.error('Failed to trigger test learning cycle', error);
        }
    }

    /**
     * Dispose of system integration
     */
    public dispose(): void {
        integrationLogger.info('Disposing SystemIntegration');
        
        // Dispose components
        if (this.debugUI) {
            this.debugUI.dispose();
        }
        
        if (this.adaptiveQueenIntegration) {
            this.adaptiveQueenIntegration.dispose();
        }
        
        // Clear data
        this.activeLearningCycles.clear();
        this.completedCycles = [];
        
        this.isInitialized = false;
        
        integrationLogger.info('SystemIntegration disposed');
    }
}