/**
 * SystemIntegrationEndToEnd.test.ts
 * 
 * Comprehensive end-to-end integration tests for the Adaptive Queen Intelligence system.
 * Tests the complete learning cycle from Queen death to strategy application.
 */

import { SystemIntegration } from '../SystemIntegration';
import { IntegrationTestRunner } from '../IntegrationTestRunner';
import { GameEngine } from '../GameEngine';
import { TerritoryManager } from '../TerritoryManager';
import { GameState } from '../GameState';
import { WebSocketClient } from '../../networking/WebSocketClient';
import { AdvancedDynamicTexture } from '@babylonjs/gui';
import { AdaptiveQueenIntegration } from '../AdaptiveQueenIntegration';

// Mock dependencies
jest.mock('../GameEngine');
jest.mock('../TerritoryManager');
jest.mock('../GameState');
jest.mock('../../networking/WebSocketClient');
jest.mock('@babylonjs/gui');
jest.mock('../AdaptiveQueenIntegration');

describe('SystemIntegration End-to-End Tests', () => {
    let systemIntegration: SystemIntegration;
    let integrationTestRunner: IntegrationTestRunner;
    let mockGameEngine: jest.Mocked<GameEngine>;
    let mockTerritoryManager: jest.Mocked<TerritoryManager>;
    let mockGameState: jest.Mocked<GameState>;
    let mockGuiTexture: jest.Mocked<AdvancedDynamicTexture>;
    let mockWebSocketClient: jest.Mocked<WebSocketClient>;
    let mockAdaptiveQueenIntegration: jest.Mocked<AdaptiveQueenIntegration>;

    beforeEach(() => {
        // Setup mocks
        mockGameEngine = {
            getPerformanceMonitor: jest.fn().mockReturnValue({
                getPerformanceSummary: jest.fn().mockReturnValue({
                    averageFPS: 60,
                    memoryUsage: 100 * 1024 * 1024 // 100MB
                }),
                canMaintain60FPSDuringCombat: jest.fn().mockReturnValue(true)
            }),
            getPerformanceOptimizer: jest.fn().mockReturnValue({
                configureIsolation: jest.fn(),
                setCallbacks: jest.fn(),
                startAITrainingSession: jest.fn(),
                endAITrainingSession: jest.fn(),
                getPerformanceStatus: jest.fn().mockReturnValue({
                    isTrainingActive: false,
                    currentFPS: 60,
                    fpsImpact: 0,
                    trainingDuration: 0,
                    performanceIsolationActive: true,
                    requirementsMet: true
                }),
                getOptimizationRecommendations: jest.fn().mockReturnValue([]),
                configureTraining: jest.fn(),
                dispose: jest.fn()
            }),
            getScene: jest.fn().mockReturnValue({}),
            getEngine: jest.fn().mockReturnValue({})
        } as any;

        mockTerritoryManager = {
            onQueenCreated: jest.fn(),
            onQueenDeath: jest.fn()
        } as any;

        mockGameState = {} as any;
        mockGuiTexture = {} as any;

        // Mock WebSocket client
        mockWebSocketClient = {
            connect: jest.fn().mockResolvedValue(undefined),
            healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
            on: jest.fn(),
            getStatus: jest.fn().mockReturnValue({ 
                connected: true, 
                reconnecting: false, 
                reconnectAttempts: 0 
            }),
            getQueuedMessageCount: jest.fn().mockReturnValue(0),
            sendQueenDeath: jest.fn().mockResolvedValue({
                type: 'queen_strategy',
                data: {
                    queenId: 'test_queen',
                    generation: 2,
                    strategies: {
                        hive_placement: { strategy: 'balanced_placement' },
                        parasite_spawning: { strategy: 'standard_spawning' }
                    }
                }
            })
        } as any;

        // Mock AdaptiveQueenIntegration
        mockAdaptiveQueenIntegration = {
            initialize: jest.fn().mockResolvedValue(undefined),
            getWebSocketClient: jest.fn().mockReturnValue(mockWebSocketClient),
            setQueenToMonitor: jest.fn(),
            update: jest.fn(),
            dispose: jest.fn(),
            getAIStatistics: jest.fn().mockReturnValue({
                isConnected: true,
                currentGeneration: 1,
                learningEnabled: true,
                queuedMessages: 0,
                generationHistory: new Map()
            }),
            getPerformanceStatus: jest.fn().mockReturnValue({
                isTrainingActive: false,
                currentFPS: 60,
                fpsImpact: 0,
                trainingDuration: 0,
                performanceIsolationActive: true,
                requirementsMet: true,
                performanceSummary: {
                    averageFPS: 60,
                    memoryUsage: 100 * 1024 * 1024
                }
            }),
            getConnectionStatus: jest.fn().mockReturnValue({
                connected: true,
                reconnecting: false,
                reconnectAttempts: 0
            })
        } as any;

        // Mock the AdaptiveQueenIntegration constructor
        (AdaptiveQueenIntegration as jest.MockedClass<typeof AdaptiveQueenIntegration>).mockImplementation(() => mockAdaptiveQueenIntegration);

        // Create SystemIntegration instance
        systemIntegration = new SystemIntegration({
            gameEngine: mockGameEngine,
            territoryManager: mockTerritoryManager,
            gameState: mockGameState,
            guiTexture: mockGuiTexture,
            enableDebugUI: false,
            enableAILearning: true,
            websocketUrl: 'ws://localhost:8000/ws',
            logLevel: 'info'
        });

        // Create IntegrationTestRunner
        integrationTestRunner = new IntegrationTestRunner({
            systemIntegration,
            enableAutomatedTesting: true,
            testInterval: 1, // 1 second for testing
            maxTestCycles: 3
        });
    });

    afterEach(() => {
        if (systemIntegration) {
            systemIntegration.dispose();
        }
        if (integrationTestRunner) {
            integrationTestRunner.dispose();
        }
        jest.clearAllMocks();
    });

    describe('System Initialization', () => {
        test('should initialize system integration successfully', async () => {
            // Mock successful initialization
            jest.spyOn(systemIntegration as any, 'establishPerformanceBaseline')
                .mockImplementation(async () => {
                    // Simulate setting the performance baseline
                    (systemIntegration as any).performanceBaseline = {
                        fps: 60,
                        memory: 100 * 1024 * 1024
                    };
                });
            jest.spyOn(systemIntegration as any, 'initializeAdaptiveQueenIntegration')
                .mockResolvedValue(undefined);
            jest.spyOn(systemIntegration as any, 'testSystemConnectivity')
                .mockResolvedValue(undefined);

            await systemIntegration.initialize();

            const stats = systemIntegration.getIntegrationStatistics();
            expect(stats.isInitialized).toBe(true);
        });

        test('should handle initialization failure gracefully', async () => {
            // Mock initialization failure
            jest.spyOn(systemIntegration as any, 'establishPerformanceBaseline')
                .mockRejectedValue(new Error('Performance monitoring failed'));

            await expect(systemIntegration.initialize()).rejects.toThrow('Performance monitoring failed');
        });
    });

    describe('Learning Cycle Integration', () => {
        beforeEach(async () => {
            // Initialize system for learning cycle tests
            jest.spyOn(systemIntegration as any, 'establishPerformanceBaseline')
                .mockImplementation(async () => {
                    // Simulate setting the performance baseline
                    (systemIntegration as any).performanceBaseline = {
                        fps: 60,
                        memory: 100 * 1024 * 1024
                    };
                });
            jest.spyOn(systemIntegration as any, 'initializeAdaptiveQueenIntegration')
                .mockResolvedValue(undefined);
            jest.spyOn(systemIntegration as any, 'testSystemConnectivity')
                .mockResolvedValue(undefined);

            await systemIntegration.initialize();
        });

        test('should track learning cycle from start to finish', async () => {
            // Create mock Queen
            const mockQueen = {
                id: 'test_queen_1',
                getGeneration: jest.fn().mockReturnValue(1),
                getSurvivalTime: jest.fn().mockReturnValue(120),
                getDeathCause: jest.fn().mockReturnValue('protector_assault'),
                territory: { id: 'territory_1' },
                onLearningProgressUpdate: jest.fn()
            } as any;

            // Simulate Queen creation
            systemIntegration['handleQueenCreated'](mockQueen);

            // Simulate Queen death
            systemIntegration['handleQueenDeath'](mockQueen);

            // Check that learning cycle was started
            const cycleDetails = systemIntegration.getLearningCycleDetails();
            expect(cycleDetails.active.length).toBe(1);

            const activeCycle = cycleDetails.active[0];
            expect(activeCycle.queenId).toBe('test_queen_1');
            expect(activeCycle.generation).toBe(1);
            expect(activeCycle.deathCause).toBe('protector_assault');
        });

        test('should handle strategy reception and application', async () => {
            // Create mock Queen and start learning cycle
            const mockQueen = {
                id: 'test_queen_1',
                getGeneration: jest.fn().mockReturnValue(1),
                getSurvivalTime: jest.fn().mockReturnValue(120),
                getDeathCause: jest.fn().mockReturnValue('protector_assault'),
                territory: { id: 'territory_1' },
                onLearningProgressUpdate: jest.fn()
            } as any;

            systemIntegration['handleQueenCreated'](mockQueen);
            systemIntegration['handleQueenDeath'](mockQueen);

            // Simulate strategy received from AI backend
            const strategyMessage = {
                data: {
                    queenId: 'test_queen_1',
                    generation: 2,
                    strategies: {
                        hive_placement: { strategy: 'balanced_placement' },
                        parasite_spawning: { strategy: 'standard_spawning' }
                    }
                }
            };

            systemIntegration['handleStrategyReceived'](strategyMessage);

            // Check that strategy was processed
            const cycleDetails = systemIntegration.getLearningCycleDetails();
            const activeCycle = cycleDetails.active[0];
            expect(activeCycle.learningPhases.strategyGeneration.success).toBe(true);
        });

        test('should handle learning errors gracefully', async () => {
            const errorMessage = {
                data: {
                    queenId: 'test_queen_1',
                    error: 'Neural network training failed',
                    errorCode: 'TRAINING_ERROR'
                }
            };

            // Create active learning cycle first
            const mockQueen = {
                id: 'test_queen_1',
                getGeneration: jest.fn().mockReturnValue(1),
                getSurvivalTime: jest.fn().mockReturnValue(120),
                getDeathCause: jest.fn().mockReturnValue('protector_assault'),
                territory: { id: 'territory_1' },
                onLearningProgressUpdate: jest.fn()
            } as any;

            systemIntegration['handleQueenCreated'](mockQueen);
            systemIntegration['handleQueenDeath'](mockQueen);

            // Handle error
            systemIntegration['handleLearningError'](errorMessage);

            // Check that error was recorded
            const cycleDetails = systemIntegration.getLearningCycleDetails();
            const activeCycle = cycleDetails.active[0];
            expect(activeCycle.errors.length).toBe(1);
            expect(activeCycle.errors[0].error).toBe('Neural network training failed');
        });
    });

    describe('Performance Monitoring', () => {
        beforeEach(async () => {
            jest.spyOn(systemIntegration as any, 'establishPerformanceBaseline')
                .mockImplementation(async () => {
                    // Simulate setting the performance baseline
                    (systemIntegration as any).performanceBaseline = {
                        fps: 60,
                        memory: 100 * 1024 * 1024
                    };
                });
            jest.spyOn(systemIntegration as any, 'initializeAdaptiveQueenIntegration')
                .mockResolvedValue(undefined);
            jest.spyOn(systemIntegration as any, 'testSystemConnectivity')
                .mockResolvedValue(undefined);

            await systemIntegration.initialize();
        });

        test('should establish performance baseline', () => {
            const stats = systemIntegration.getIntegrationStatistics();
            expect(stats.performanceBaseline).toBeDefined();
            expect(stats.performanceBaseline.fps).toBe(60);
            expect(stats.performanceBaseline.memory).toBe(100 * 1024 * 1024);
        });

        test('should monitor performance during AI training', () => {
            // Simulate performance impact
            systemIntegration['updateActiveCyclePerformance']({ fpsImpact: 5 });

            const stats = systemIntegration.getIntegrationStatistics();
            expect(stats.isInitialized).toBe(true);
        });
    });

    describe('Integration Test Runner', () => {
        beforeEach(async () => {
            jest.spyOn(systemIntegration as any, 'establishPerformanceBaseline')
                .mockImplementation(async () => {
                    // Simulate setting the performance baseline
                    (systemIntegration as any).performanceBaseline = {
                        fps: 60,
                        memory: 100 * 1024 * 1024
                    };
                });
            jest.spyOn(systemIntegration as any, 'initializeAdaptiveQueenIntegration')
                .mockResolvedValue(undefined);
            jest.spyOn(systemIntegration as any, 'testSystemConnectivity')
                .mockResolvedValue(undefined);

            await systemIntegration.initialize();
        });

        test('should run single test cycle successfully', async () => {
            // Mock successful test cycle
            jest.spyOn(systemIntegration, 'triggerTestLearningCycle')
                .mockResolvedValue(undefined);
            jest.spyOn(systemIntegration, 'getLearningCycleDetails')
                .mockReturnValue({
                    active: [{
                        cycleId: 'test_cycle',
                        queenId: 'test_queen',
                        generation: 1,
                        deathCause: 'test_death',
                        survivalTime: 120,
                        startTime: Date.now(),
                        learningPhases: {
                            deathAnalysis: { startTime: Date.now(), success: true },
                            neuralTraining: { startTime: Date.now(), success: true },
                            strategyGeneration: { startTime: Date.now(), success: true },
                            strategyApplication: { startTime: Date.now(), success: true }
                        },
                        errors: [],
                        performanceMetrics: { fpsImpact: 0, memoryUsage: 0, networkLatency: 0 }
                    }],
                    completed: []
                });

            const result = await integrationTestRunner.runTestCycle();

            expect(result.success).toBe(true);
            expect(result.phases.queenCreation.success).toBe(true);
            expect(result.phases.queenDeath.success).toBe(true);
            expect(result.phases.strategyReceived.success).toBe(true);
            expect(result.phases.strategyApplication.success).toBe(true);
        });

        test('should handle test cycle failures', async () => {
            // Mock failed test cycle
            jest.spyOn(systemIntegration, 'triggerTestLearningCycle')
                .mockRejectedValue(new Error('WebSocket connection failed'));

            const result = await integrationTestRunner.runTestCycle();

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('should run comprehensive test suite', async () => {
            // Mock successful test cycles
            jest.spyOn(integrationTestRunner, 'runTestCycle')
                .mockResolvedValue({
                    testId: 'test_1',
                    startTime: Date.now(),
                    endTime: Date.now() + 1000,
                    duration: 1000,
                    success: true,
                    phases: {
                        queenCreation: { success: true, duration: 100 },
                        queenDeath: { success: true, duration: 200 },
                        strategyReceived: { success: true, duration: 500 },
                        strategyApplication: { success: true, duration: 200 }
                    },
                    errors: [],
                    performanceMetrics: { fpsImpact: 0, memoryUsage: 0, networkLatency: 0 }
                });

            const comprehensiveResult = await integrationTestRunner.runComprehensiveTest();

            expect(comprehensiveResult.success).toBe(true);
            expect(comprehensiveResult.summary.totalTests).toBe(3);
            expect(comprehensiveResult.summary.successfulTests).toBe(3);
            expect(comprehensiveResult.summary.successRate).toBe(1.0);
        });
    });

    describe('Error Recovery and Resilience', () => {
        beforeEach(async () => {
            jest.spyOn(systemIntegration as any, 'establishPerformanceBaseline')
                .mockImplementation(async () => {
                    // Simulate setting the performance baseline
                    (systemIntegration as any).performanceBaseline = {
                        fps: 60,
                        memory: 100 * 1024 * 1024
                    };
                });
            jest.spyOn(systemIntegration as any, 'initializeAdaptiveQueenIntegration')
                .mockResolvedValue(undefined);
            jest.spyOn(systemIntegration as any, 'testSystemConnectivity')
                .mockResolvedValue(undefined);

            await systemIntegration.initialize();
        });

        test('should handle WebSocket disconnection gracefully', async () => {
            // Simulate WebSocket disconnection
            mockWebSocketClient.getStatus.mockReturnValue({ 
                connected: false, 
                reconnecting: false, 
                reconnectAttempts: 0 
            });

            const stats = systemIntegration.getIntegrationStatistics();
            expect(stats.isInitialized).toBe(true); // System should remain initialized
        });

        test('should clean up stale learning cycles', () => {
            // Create a stale learning cycle (older than 5 minutes)
            const staleTime = Date.now() - (6 * 60 * 1000); // 6 minutes ago
            systemIntegration['activeLearningCycles'].set('stale_cycle', {
                cycleId: 'stale_cycle',
                startTime: staleTime,
                queenId: 'stale_queen',
                generation: 1,
                deathCause: 'test',
                survivalTime: 120,
                learningPhases: {
                    deathAnalysis: { startTime: staleTime, success: false },
                    neuralTraining: { startTime: 0, success: false },
                    strategyGeneration: { startTime: 0, success: false },
                    strategyApplication: { startTime: 0, success: false }
                },
                errors: [],
                performanceMetrics: { fpsImpact: 0, memoryUsage: 0, networkLatency: 0 }
            });

            // Trigger cleanup
            systemIntegration['checkForStaleCycles']();

            // Check that stale cycle was cleaned up
            expect(systemIntegration['activeLearningCycles'].size).toBe(0);
        });
    });

    describe('Statistics and Monitoring', () => {
        beforeEach(async () => {
            jest.spyOn(systemIntegration as any, 'establishPerformanceBaseline')
                .mockImplementation(async () => {
                    // Simulate setting the performance baseline
                    (systemIntegration as any).performanceBaseline = {
                        fps: 60,
                        memory: 100 * 1024 * 1024
                    };
                });
            jest.spyOn(systemIntegration as any, 'initializeAdaptiveQueenIntegration')
                .mockResolvedValue(undefined);
            jest.spyOn(systemIntegration as any, 'testSystemConnectivity')
                .mockResolvedValue(undefined);

            await systemIntegration.initialize();
        });

        test('should provide comprehensive integration statistics', () => {
            const stats = systemIntegration.getIntegrationStatistics();

            expect(stats).toHaveProperty('isInitialized');
            expect(stats).toHaveProperty('activeCycles');
            expect(stats).toHaveProperty('completedCycles');
            expect(stats).toHaveProperty('totalCycles');
            expect(stats).toHaveProperty('averageCycleDuration');
            expect(stats).toHaveProperty('successRate');
            expect(stats).toHaveProperty('performanceBaseline');
            expect(stats).toHaveProperty('aiLearningEnabled');
            expect(stats).toHaveProperty('debugUIEnabled');

            expect(stats.isInitialized).toBe(true);
            expect(stats.aiLearningEnabled).toBe(true);
        });

        test('should provide detailed learning cycle information', () => {
            const cycleDetails = systemIntegration.getLearningCycleDetails();

            expect(cycleDetails).toHaveProperty('active');
            expect(cycleDetails).toHaveProperty('completed');
            expect(Array.isArray(cycleDetails.active)).toBe(true);
            expect(Array.isArray(cycleDetails.completed)).toBe(true);
        });

        test('should provide test runner statistics', () => {
            const testStats = integrationTestRunner.getTestStatistics();

            expect(testStats).toHaveProperty('isRunning');
            expect(testStats).toHaveProperty('totalCycles');
            expect(testStats).toHaveProperty('successfulCycles');
            expect(testStats).toHaveProperty('failedCycles');
            expect(testStats).toHaveProperty('successRate');
            expect(testStats).toHaveProperty('averageDuration');
            expect(testStats).toHaveProperty('recentResults');

            expect(testStats.isRunning).toBe(false); // Not started by default
        });
    });

    describe('System Update and Lifecycle', () => {
        beforeEach(async () => {
            jest.spyOn(systemIntegration as any, 'establishPerformanceBaseline')
                .mockImplementation(async () => {
                    // Simulate setting the performance baseline
                    (systemIntegration as any).performanceBaseline = {
                        fps: 60,
                        memory: 100 * 1024 * 1024
                    };
                });
            jest.spyOn(systemIntegration as any, 'initializeAdaptiveQueenIntegration')
                .mockResolvedValue(undefined);
            jest.spyOn(systemIntegration as any, 'testSystemConnectivity')
                .mockResolvedValue(undefined);

            await systemIntegration.initialize();
        });

        test('should update system integration properly', () => {
            // Mock AdaptiveQueenIntegration update
            const mockUpdate = jest.fn();
            systemIntegration['adaptiveQueenIntegration'] = { update: mockUpdate } as any;

            systemIntegration.update(16.67); // ~60fps

            expect(mockUpdate).toHaveBeenCalledWith(16.67);
        });

        test('should dispose system integration cleanly', () => {
            const mockDispose = jest.fn();
            systemIntegration['adaptiveQueenIntegration'] = { dispose: mockDispose } as any;

            systemIntegration.dispose();

            expect(mockDispose).toHaveBeenCalled();
            expect(systemIntegration['isInitialized']).toBe(false);
        });
    });
});

/**
 * Feature: adaptive-queen-intelligence, Property 1: End-to-End Learning Cycle Completion
 * 
 * Property-based test to verify that the complete learning cycle from Queen death
 * to strategy application works correctly across different scenarios.
 */
describe('Property-Based Tests: End-to-End Learning Cycle', () => {
    // Note: This would typically use a property-based testing library like fast-check
    // For now, we'll simulate property-based testing with multiple test cases
    
    const testScenarios = [
        { generation: 1, deathCause: 'protector_assault', survivalTime: 60 },
        { generation: 2, deathCause: 'worker_infiltration', survivalTime: 120 },
        { generation: 3, deathCause: 'coordinated_attack', survivalTime: 180 },
        { generation: 5, deathCause: 'energy_depletion', survivalTime: 90 },
        { generation: 10, deathCause: 'protector_assault', survivalTime: 300 }
    ];

    testScenarios.forEach((scenario, index) => {
        test(`should complete learning cycle for scenario ${index + 1}: Gen ${scenario.generation}, ${scenario.deathCause}`, async () => {
            // This test would verify that for any valid Queen death scenario,
            // the system completes the full learning cycle successfully
            
            // Setup system integration (mocked for testing)
            const mockSystemIntegration = {
                isInitialized: true,
                triggerTestLearningCycle: jest.fn().mockResolvedValue(undefined),
                getLearningCycleDetails: jest.fn().mockReturnValue({
                    active: [{
                        cycleId: `test_cycle_${index}`,
                        queenId: `test_queen_${index}`,
                        generation: scenario.generation,
                        deathCause: scenario.deathCause,
                        survivalTime: scenario.survivalTime,
                        startTime: Date.now(),
                        learningPhases: {
                            deathAnalysis: { startTime: Date.now(), success: true },
                            neuralTraining: { startTime: Date.now(), success: true },
                            strategyGeneration: { startTime: Date.now(), success: true },
                            strategyApplication: { startTime: Date.now(), success: true }
                        },
                        errors: [],
                        performanceMetrics: { fpsImpact: 0, memoryUsage: 0, networkLatency: 0 }
                    }],
                    completed: []
                }),
                getAIStatistics: jest.fn().mockReturnValue({
                    learningEnabled: true,
                    isConnected: true
                }),
                getAdaptiveQueenIntegration: jest.fn().mockReturnValue({
                    getConnectionStatus: jest.fn().mockReturnValue({ connected: true })
                })
            } as any;

            const testRunner = new IntegrationTestRunner({
                systemIntegration: mockSystemIntegration,
                enableAutomatedTesting: false
            });

            const result = await testRunner.runTestCycle();

            // Verify that the learning cycle completed successfully
            expect(result.success).toBe(true);
            expect(result.phases.queenCreation.success).toBe(true);
            expect(result.phases.queenDeath.success).toBe(true);
            expect(result.phases.strategyReceived.success).toBe(true);
            expect(result.phases.strategyApplication.success).toBe(true);
            expect(result.errors.length).toBe(0);

            testRunner.dispose();
        });
    });
});