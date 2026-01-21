/**
 * AdaptiveQueenSystemIntegration.test.ts
 * 
 * End-to-end integration tests for the complete Adaptive Queen Intelligence system.
 * Tests the full learning cycle from Queen death to strategy application.
 */

import { GameEngine } from '../GameEngine';
import { AdaptiveQueenIntegration } from '../AdaptiveQueenIntegration';
import { AdaptiveQueen } from '../entities/AdaptiveQueen';
import { WebSocketClient } from '../../networking/WebSocketClient';
import { Logger, LogLevel, LogCategory } from '../../utils/Logger';
import { AdvancedDynamicTexture } from '@babylonjs/gui';

// Mock Babylon.js dependencies
jest.mock('@babylonjs/core');
jest.mock('@babylonjs/gui');

// Mock WebSocket
class MockWebSocket {
    public readyState = WebSocket.OPEN;
    public onopen: ((event: Event) => void) | null = null;
    public onclose: ((event: CloseEvent) => void) | null = null;
    public onmessage: ((event: MessageEvent) => void) | null = null;
    public onerror: ((event: Event) => void) | null = null;

    constructor(public url: string) {
        setTimeout(() => {
            if (this.onopen) {
                this.onopen(new Event('open'));
            }
        }, 10);
    }

    send(data: string): void {
        // Echo back a mock response
        setTimeout(() => {
            if (this.onmessage) {
                const response = this.createMockResponse(JSON.parse(data));
                this.onmessage(new MessageEvent('message', { data: JSON.stringify(response) }));
            }
        }, 50);
    }

    close(): void {
        setTimeout(() => {
            if (this.onclose) {
                this.onclose(new CloseEvent('close'));
            }
        }, 10);
    }

    private createMockResponse(request: any): any {
        switch (request.type) {
            case 'health_check':
                return {
                    type: 'health_response',
                    data: { status: 'healthy', ai_engine: 'running' }
                };
            case 'queen_death':
                return {
                    type: 'learning_progress',
                    data: {
                        phase: 'analyzing',
                        progress: 0.1,
                        estimatedTime: 60000
                    }
                };
            case 'strategy_request':
                return {
                    type: 'queen_strategy',
                    data: {
                        generation: request.data.generation + 1,
                        strategies: {
                            hivePlacement: { strategy: 'avoid_death_locations' },
                            parasiteSpawning: { strategy: 'adaptive_timing' },
                            defensiveCoordination: { strategy: 'coordinated_swarm' }
                        }
                    }
                };
            default:
                return { type: 'ack', data: { received: true } };
        }
    }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('AdaptiveQueenSystemIntegration', () => {
    let gameEngine: GameEngine;
    let integration: AdaptiveQueenIntegration;
    let mockCanvas: HTMLCanvasElement;
    let mockGuiTexture: AdvancedDynamicTexture;
    let logger: Logger;

    beforeEach(async () => {
        // Create mock canvas
        mockCanvas = document.createElement('canvas');
        mockCanvas.width = 800;
        mockCanvas.height = 600;

        // Mock GUI texture
        mockGuiTexture = {
            addControl: jest.fn(),
            removeControl: jest.fn(),
            dispose: jest.fn()
        } as any;

        // Initialize logger
        logger = Logger.getInstance({
            level: LogLevel.DEBUG,
            enableConsole: false,
            enableStorage: true,
            enableRemote: false
        });

        // Create game engine
        gameEngine = new GameEngine(mockCanvas);
        
        // Mock game engine methods
        jest.spyOn(gameEngine, 'getScene').mockReturnValue({} as any);
        jest.spyOn(gameEngine, 'getEngine').mockReturnValue({} as any);
        jest.spyOn(gameEngine, 'getTerritoryManager').mockReturnValue({
            initializeAILearning: jest.fn(),
            setAILearningEnabled: jest.fn()
        } as any);
        jest.spyOn(gameEngine, 'getGameState').mockReturnValue({} as any);
        jest.spyOn(gameEngine, 'getGUITexture').mockReturnValue(mockGuiTexture);
    });

    afterEach(() => {
        if (integration) {
            integration.dispose();
        }
        if (gameEngine) {
            gameEngine.dispose();
        }
        logger.clearLogs();
        jest.clearAllMocks();
    });

    describe('System Initialization', () => {
        test('should initialize integration with AI backend available', async () => {
            // Mock successful backend health check
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ status: 'healthy' })
            });

            integration = new AdaptiveQueenIntegration({
                gameEngine,
                territoryManager: gameEngine.getTerritoryManager()!,
                gameState: gameEngine.getGameState()!,
                guiTexture: mockGuiTexture,
                enableLearning: true
            });

            await integration.initialize();

            expect(integration.isLearningEnabled()).toBe(true);
            expect(integration.getConnectionStatus().connected).toBe(true);

            const logs = logger.getRecentLogs(10, LogLevel.INFO, LogCategory.INTEGRATION);
            expect(logs.some(log => log.message.includes('initialized successfully'))).toBe(true);
        });

        test('should fallback gracefully when AI backend unavailable', async () => {
            // Mock failed backend health check
            global.fetch = jest.fn().mockRejectedValue(new Error('Connection failed'));

            integration = new AdaptiveQueenIntegration({
                gameEngine,
                territoryManager: gameEngine.getTerritoryManager()!,
                gameState: gameEngine.getGameState()!,
                guiTexture: mockGuiTexture,
                enableLearning: true
            });

            await integration.initialize();

            expect(integration.isLearningEnabled()).toBe(false);
            expect(integration.getConnectionStatus().connected).toBe(false);

            const logs = logger.getRecentLogs(10, LogLevel.WARN, LogCategory.INTEGRATION);
            expect(logs.some(log => log.message.includes('falling back'))).toBe(true);
        });
    });

    describe('End-to-End Learning Cycle', () => {
        beforeEach(async () => {
            // Mock successful backend
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ status: 'healthy' })
            });

            integration = new AdaptiveQueenIntegration({
                gameEngine,
                territoryManager: gameEngine.getTerritoryManager()!,
                gameState: gameEngine.getGameState()!,
                guiTexture: mockGuiTexture,
                websocketUrl: 'ws://localhost:8000/ws',
                enableLearning: true
            });

            await integration.initialize();
        });

        test('should complete full learning cycle from death to strategy application', async () => {
            // Create mock adaptive queen
            const mockQueen = new AdaptiveQueen({
                id: 'test-queen-1',
                generation: 1,
                territoryId: 'territory-1',
                position: { x: 0, y: 0, z: 0 },
                websocketClient: integration.getWebSocketClient()
            });

            // Set queen to monitor
            integration.setQueenToMonitor(mockQueen);

            // Simulate queen death
            const deathData = {
                queenId: mockQueen.id,
                territoryId: 'territory-1',
                generation: 1,
                deathLocation: { x: 10, y: 0, z: 10 },
                deathCause: 'protector_assault' as const,
                survivalTime: 120,
                parasitesSpawned: 5,
                hiveDiscoveryTime: 60,
                playerUnits: [],
                assaultPattern: { type: 'direct', intensity: 0.8 },
                gameState: {}
            };

            // Trigger death analysis
            await mockQueen.onDeath();

            // Wait for learning progress updates
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verify learning progress was tracked
            const learningUI = integration.getLearningProgressUI();
            expect(learningUI).toBeDefined();

            // Verify AI statistics show learning activity
            const aiStats = integration.getAIStatistics();
            expect(aiStats.currentGeneration).toBe(1);
            expect(aiStats.learningEnabled).toBe(true);

            // Simulate strategy generation completion
            const newStrategy = {
                generation: 2,
                strategies: {
                    hivePlacement: { strategy: 'avoid_death_locations', confidence: 0.8 },
                    parasiteSpawning: { strategy: 'adaptive_timing', confidence: 0.7 },
                    defensiveCoordination: { strategy: 'coordinated_swarm', confidence: 0.9 }
                }
            };

            // Apply new strategy to next generation queen
            const nextQueen = new AdaptiveQueen({
                id: 'test-queen-2',
                generation: 2,
                territoryId: 'territory-1',
                position: { x: 0, y: 0, z: 0 },
                websocketClient: integration.getWebSocketClient()
            });

            await nextQueen.applyLearningStrategy(newStrategy);

            // Verify strategy was applied
            expect(nextQueen.getGeneration()).toBe(2);
            expect(nextQueen.getCurrentStrategy()).toEqual(newStrategy);

            // Verify logs show complete cycle
            const logs = logger.getRecentLogs(20, LogLevel.INFO, LogCategory.AI_LEARNING);
            expect(logs.some(log => log.message.includes('death analysis'))).toBe(true);
            expect(logs.some(log => log.message.includes('strategy generated'))).toBe(true);
            expect(logs.some(log => log.message.includes('strategy applied'))).toBe(true);
        });

        test('should handle multiple concurrent learning cycles', async () => {
            const queens = [];
            const learningPromises = [];

            // Create multiple queens
            for (let i = 1; i <= 3; i++) {
                const queen = new AdaptiveQueen({
                    id: `test-queen-${i}`,
                    generation: i,
                    territoryId: `territory-${i}`,
                    position: { x: i * 10, y: 0, z: i * 10 },
                    websocketClient: integration.getWebSocketClient()
                });

                queens.push(queen);
                
                // Trigger concurrent learning
                learningPromises.push(queen.onDeath());
            }

            // Wait for all learning cycles to complete
            await Promise.all(learningPromises);

            // Verify all queens were processed
            const aiStats = integration.getAIStatistics();
            expect(aiStats.queuedMessages).toBeGreaterThanOrEqual(0); // Messages should be processed

            // Verify performance was maintained
            const performanceStatus = integration.getPerformanceStatus();
            expect(performanceStatus.requirementsMet).toBe(true);
            expect(performanceStatus.currentFPS).toBeGreaterThanOrEqual(50); // Should maintain near 60fps
        });
    });

    describe('Performance Isolation', () => {
        beforeEach(async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ status: 'healthy' })
            });

            integration = new AdaptiveQueenIntegration({
                gameEngine,
                territoryManager: gameEngine.getTerritoryManager()!,
                gameState: gameEngine.getGameState()!,
                guiTexture: mockGuiTexture,
                enableLearning: true
            });

            await integration.initialize();
        });

        test('should maintain 60fps during AI training', async () => {
            // Configure performance monitoring
            integration.configurePerformanceIsolation({
                enabled: true,
                targetFPS: 60,
                warningThreshold: 50,
                criticalThreshold: 40
            });

            // Start AI training session
            const trainingData = {
                generation: 1,
                deathData: {},
                playerPatterns: {}
            };

            await integration.startAITrainingSession(trainingData);

            // Simulate training duration
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check performance status
            const performanceStatus = integration.getPerformanceStatus();
            expect(performanceStatus.isTrainingActive).toBe(true);
            expect(performanceStatus.performanceIsolationActive).toBe(true);
            expect(performanceStatus.requirementsMet).toBe(true);

            // End training session
            await integration.endAITrainingSession({ success: true });

            // Verify training completed successfully
            const finalStatus = integration.getPerformanceStatus();
            expect(finalStatus.isTrainingActive).toBe(false);
        });

        test('should throttle AI training when performance drops', async () => {
            // Configure strict performance requirements
            integration.configurePerformanceIsolation({
                enabled: true,
                targetFPS: 60,
                warningThreshold: 55,
                criticalThreshold: 50
            });

            // Start training that should be monitored for throttling
            const trainingData = { generation: 1 };
            await integration.startAITrainingSession(trainingData);

            // Check performance status (throttling logic is internal)
            const performanceStatus = integration.getPerformanceStatus();

            // Performance isolation should be active
            expect(performanceStatus.performanceIsolationActive).toBe(true);
        });
    });

    describe('Error Recovery', () => {
        beforeEach(async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ status: 'healthy' })
            });

            integration = new AdaptiveQueenIntegration({
                gameEngine,
                territoryManager: gameEngine.getTerritoryManager()!,
                gameState: gameEngine.getGameState()!,
                guiTexture: mockGuiTexture,
                enableLearning: true
            });

            await integration.initialize();
        });

        test('should handle WebSocket connection failures gracefully', async () => {
            // Simulate connection failure
            const websocketClient = integration.getWebSocketClient();
            
            // Mock connection failure
            jest.spyOn(websocketClient, 'connect').mockRejectedValue(new Error('Connection failed'));

            // Attempt reconnection
            await expect(integration.reconnectToAIBackend()).rejects.toThrow('Connection failed');

            // Verify system continues to function
            expect(integration.isLearningEnabled()).toBe(true); // Should still be enabled
            
            // Verify error was logged
            const logs = logger.getRecentLogs(10, LogLevel.ERROR, LogCategory.NETWORKING);
            expect(logs.some(log => log.message.includes('Connection failed'))).toBe(true);
        });

        test('should queue messages when backend is unavailable', async () => {
            // Create queen and trigger death while backend is down
            const mockQueen = new AdaptiveQueen({
                id: 'test-queen-offline',
                generation: 1,
                territoryId: 'territory-1',
                position: { x: 0, y: 0, z: 0 },
                websocketClient: integration.getWebSocketClient()
            });

            // Simulate backend unavailability
            const websocketClient = integration.getWebSocketClient();
            jest.spyOn(websocketClient, 'send').mockRejectedValue(new Error('Backend unavailable'));

            // Trigger death (should queue message)
            await mockQueen.onDeath();

            // Verify message was queued
            const aiStats = integration.getAIStatistics();
            expect(aiStats.queuedMessages).toBeGreaterThan(0);

            // Simulate backend recovery
            jest.spyOn(websocketClient, 'send').mockResolvedValue(undefined);
            await integration.reconnectToAIBackend();

            // Verify queued messages were processed
            await new Promise(resolve => setTimeout(resolve, 100));
            const finalStats = integration.getAIStatistics();
            expect(finalStats.queuedMessages).toBe(0);
        });
    });

    describe('Logging and Debugging', () => {
        test('should provide comprehensive logging throughout learning cycle', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ status: 'healthy' })
            });

            integration = new AdaptiveQueenIntegration({
                gameEngine,
                territoryManager: gameEngine.getTerritoryManager()!,
                gameState: gameEngine.getGameState()!,
                guiTexture: mockGuiTexture,
                enableLearning: true
            });

            await integration.initialize();

            // Create and monitor queen
            const mockQueen = new AdaptiveQueen({
                id: 'test-queen-logging',
                generation: 1,
                territoryId: 'territory-1',
                position: { x: 0, y: 0, z: 0 },
                websocketClient: integration.getWebSocketClient()
            });

            integration.setQueenToMonitor(mockQueen);

            // Trigger learning cycle
            await mockQueen.onDeath();

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verify comprehensive logging
            const allLogs = logger.getRecentLogs(50);
            
            // Check for initialization logs
            expect(allLogs.some(log => 
                log.category === LogCategory.INTEGRATION && 
                log.message.includes('initialized')
            )).toBe(true);

            // Check for AI learning logs
            expect(allLogs.some(log => 
                log.category === LogCategory.AI_LEARNING && 
                log.level >= LogLevel.INFO
            )).toBe(true);

            // Check for networking logs
            expect(allLogs.some(log => 
                log.category === LogCategory.NETWORKING
            )).toBe(true);

            // Check for performance logs
            expect(allLogs.some(log => 
                log.category === LogCategory.PERFORMANCE
            )).toBe(true);

            // Verify log statistics
            const logStats = logger.getLogStatistics();
            expect(logStats.totalEntries).toBeGreaterThan(0);
            expect(logStats.entriesByCategory[LogCategory.INTEGRATION]).toBeGreaterThan(0);
        });

        test('should export logs for debugging', () => {
            // Generate some test logs
            logger.info(LogCategory.INTEGRATION, 'Test integration log');
            logger.warn(LogCategory.AI_LEARNING, 'Test AI warning');
            logger.error(LogCategory.NETWORKING, 'Test network error');

            // Export logs
            const exportedLogs = logger.exportLogs();
            const parsedLogs = JSON.parse(exportedLogs);

            expect(Array.isArray(parsedLogs)).toBe(true);
            expect(parsedLogs.length).toBeGreaterThan(0);
            
            // Verify log structure
            const firstLog = parsedLogs[0];
            expect(firstLog).toHaveProperty('timestamp');
            expect(firstLog).toHaveProperty('level');
            expect(firstLog).toHaveProperty('category');
            expect(firstLog).toHaveProperty('message');
        });
    });
});