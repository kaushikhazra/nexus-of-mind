/**
 * Tests for WebSocket Error Handler and Graceful Degradation
 */

import { WebSocketErrorHandler } from '../WebSocketErrorHandler';
import { GracefulDegradationManager } from '../../game/GracefulDegradationManager';

describe('WebSocketErrorHandler', () => {
    let errorHandler: WebSocketErrorHandler;

    beforeEach(() => {
        errorHandler = new WebSocketErrorHandler({
            maxRetryAttempts: 3,
            retryDelay: 100,
            timeoutDuration: 1000,
            degradationThreshold: 2
        });
    });

    afterEach(async () => {
        await errorHandler.cleanup();
    });

    describe('Connection Error Handling', () => {
        it('should handle connection timeout errors', async () => {
            const timeoutError = new Error('Connection timeout');
            
            const result = await errorHandler.handleConnectionError(timeoutError, {
                operation: 'connect',
                retryCount: 0
            });

            expect(result.success).toBe(true);
            expect(result.strategy).toBe('retry');
        });

        it('should handle connection lost errors', async () => {
            const connectionError = new Error('WebSocket connection lost');
            
            const result = await errorHandler.handleConnectionError(connectionError, {
                operation: 'send_message',
                retryCount: 1
            });

            expect(result.success).toBe(true);
            expect(result.strategy).toBe('retry');
        });

        it('should escalate to graceful degradation after multiple failures', async () => {
            const connectionError = new Error('Connection failed');
            
            // Simulate multiple failures
            for (let i = 0; i < 3; i++) {
                await errorHandler.handleConnectionError(connectionError, {
                    operation: 'connect',
                    retryCount: i
                });
            }
            
            // Next failure should trigger degradation
            const result = await errorHandler.handleConnectionError(connectionError, {
                operation: 'connect',
                retryCount: 3
            });

            expect(result.success).toBe(true);
            expect(['graceful_degradation', 'fallback']).toContain(result.strategy);
        });

        it('should handle server errors with fallback', async () => {
            const serverError = new Error('Internal server error');
            
            const result = await errorHandler.handleConnectionError(serverError, {
                operation: 'server_error',
                retryCount: 0
            });

            expect(result.success).toBe(true);
            expect(['fallback', 'graceful_degradation']).toContain(result.strategy);
        });
    });

    describe('Message Error Handling', () => {
        it('should handle JSON serialization errors', async () => {
            const serializationError = new Error('JSON parse error');
            const invalidMessage = { type: 'test', data: 'invalid' };
            
            const result = await errorHandler.handleMessageError(
                serializationError,
                invalidMessage,
                { operation: 'message_parsing' }
            );

            expect(result.success).toBe(true);
            expect(['message_sanitization', 'message_queued']).toContain(result.strategy);
        });

        it('should handle validation errors', async () => {
            const validationError = new Error('Validation failed');
            const invalidMessage = { type: 'queen_death', data: {} };
            
            const result = await errorHandler.handleMessageError(
                validationError,
                invalidMessage,
                { operation: 'message_validation' }
            );

            expect(result.success).toBe(true);
            expect(['message_validation_fix', 'default_message_creation']).toContain(result.strategy);
        });

        it('should handle timeout errors by queuing messages', async () => {
            const timeoutError = new Error('Message timeout');
            const message = { type: 'queen_death', data: { queenId: 'test' } };
            
            const result = await errorHandler.handleMessageError(
                timeoutError,
                message,
                { operation: 'message_timeout' }
            );

            expect(result.success).toBe(true);
            expect(result.strategy).toBe('message_timeout_queue');
            expect(result.offlineMode).toBe(true);
        });
    });

    describe('System Health Monitoring', () => {
        it('should track system health status', () => {
            const health = errorHandler.getSystemHealth();
            
            expect(health).toHaveProperty('websocket');
            expect(health).toHaveProperty('message_processing');
            expect(health).toHaveProperty('data_validation');
            expect(health).toHaveProperty('offline_queue');
        });

        it('should provide error statistics', async () => {
            // Generate some errors
            await errorHandler.handleConnectionError(new Error('Test error 1'));
            await errorHandler.handleConnectionError(new Error('Test error 2'));
            
            const stats = errorHandler.getErrorStatistics();
            
            expect(stats).toHaveProperty('totalErrors');
            expect(stats).toHaveProperty('recentErrors');
            expect(stats).toHaveProperty('errorTypes');
            expect(stats).toHaveProperty('systemHealth');
            expect(stats.totalErrors).toBeGreaterThan(0);
        });
    });

    describe('Offline Queue Processing', () => {
        it('should process offline queue successfully', async () => {
            // Simulate queued messages by triggering timeout errors
            const timeoutError = new Error('Message timeout');
            const messages = [
                { type: 'queen_death', data: { queenId: 'test1' } },
                { type: 'queen_death', data: { queenId: 'test2' } }
            ];
            
            for (const message of messages) {
                await errorHandler.handleMessageError(timeoutError, message);
            }
            
            const result = await errorHandler.processOfflineQueue();
            
            expect(result).toHaveProperty('processed');
            expect(result).toHaveProperty('failed');
            expect(typeof result.processed).toBe('number');
            expect(typeof result.failed).toBe('number');
        });
    });
});

describe('GracefulDegradationManager', () => {
    let degradationManager: GracefulDegradationManager;

    beforeEach(() => {
        degradationManager = new GracefulDegradationManager({
            enableLocalFallback: true,
            enableRuleBasedAI: true,
            enableOfflineMode: true,
            cacheStrategies: true
        });
    });

    afterEach(async () => {
        await degradationManager.cleanup();
    });

    describe('Backend Availability Management', () => {
        it('should handle backend unavailable notification', () => {
            degradationManager.notifyBackendUnavailable();
            
            const status = degradationManager.getSystemStatus();
            expect(status.backendAvailable).toBe(false);
            expect(status.fallbackMode).toBe('graceful');
        });

        it('should handle backend available notification', () => {
            // First make it unavailable
            degradationManager.notifyBackendUnavailable();
            
            // Then make it available again
            degradationManager.notifyBackendAvailable();
            
            const status = degradationManager.getSystemStatus();
            expect(status.backendAvailable).toBe(true);
            expect(status.fallbackMode).toBe('none');
        });
    });

    describe('Fallback Strategy Generation', () => {
        it('should generate rule-based strategy for protector assault', async () => {
            const strategy = await degradationManager.generateFallbackStrategy({
                generation: 3,
                deathCause: 'protector_assault',
                survivalTime: 45
            });

            expect(strategy).toHaveProperty('generation', 3);
            expect(strategy).toHaveProperty('hivePlacement');
            expect(strategy).toHaveProperty('parasiteSpawning');
            expect(strategy).toHaveProperty('defensiveCoordination');
            expect(strategy).toHaveProperty('source');
            expect(['cached', 'rule_based', 'default']).toContain(strategy.source);
        });

        it('should generate appropriate strategy for different generations', async () => {
            const earlyGenStrategy = await degradationManager.generateFallbackStrategy({
                generation: 2,
                deathCause: 'worker_infiltration'
            });

            const lateGenStrategy = await degradationManager.generateFallbackStrategy({
                generation: 10,
                deathCause: 'coordinated_attack'
            });

            expect(earlyGenStrategy.complexity).toBe('basic');
            expect(['tactical', 'strategic', 'advanced']).toContain(lateGenStrategy.complexity);
        });

        it('should handle Queen death in degraded mode', async () => {
            // Set to degraded mode
            degradationManager.notifyBackendUnavailable();
            
            const deathData = {
                queenId: 'test_queen',
                generation: 5,
                deathCause: 'protector_assault',
                survivalTime: 120
            };

            const result = await degradationManager.handleQueenDeath(deathData);

            expect(result).toHaveProperty('type', 'queen_strategy');
            expect(result).toHaveProperty('data');
            expect(result.data).toHaveProperty('queenId', 'test_queen');
            expect(result.data).toHaveProperty('generation', 6);
            expect(result.data).toHaveProperty('strategies');
            expect(result.data).toHaveProperty('fallbackMode', true);
        });
    });

    describe('System Status and Monitoring', () => {
        it('should provide system status information', () => {
            const status = degradationManager.getSystemStatus();
            
            expect(status).toHaveProperty('backendAvailable');
            expect(status).toHaveProperty('degradationLevel');
            expect(status).toHaveProperty('activeFeatures');
            expect(status).toHaveProperty('disabledFeatures');
            expect(status).toHaveProperty('fallbackMode');
        });

        it('should provide degradation information', () => {
            degradationManager.notifyBackendUnavailable();
            
            const info = degradationManager.getDegradationInfo();
            
            expect(info).toHaveProperty('degradationLevel');
            expect(info).toHaveProperty('fallbackMode');
            expect(info).toHaveProperty('backendUnavailableTime');
            expect(info).toHaveProperty('activeFeatures');
            expect(info).toHaveProperty('disabledFeatures');
        });

        it('should test fallback capabilities', async () => {
            const testResult = await degradationManager.testFallbackCapabilities();
            
            expect(testResult).toHaveProperty('testResults');
            expect(testResult).toHaveProperty('systemStatus');
            expect(testResult).toHaveProperty('degradationInfo');
            expect(Array.isArray(testResult.testResults)).toBe(true);
            expect(testResult.testResults.length).toBeGreaterThan(0);
        });
    });

    describe('Strategy Caching', () => {
        it('should cache and retrieve strategies', async () => {
            const strategy = await degradationManager.generateFallbackStrategy({
                generation: 5,
                deathCause: 'coordinated_attack',
                survivalTime: 200
            });

            // Cache the strategy
            degradationManager.cacheStrategy(strategy, { deathCause: 'coordinated_attack' });

            // Generate again - should use cached version
            const cachedStrategy = await degradationManager.generateFallbackStrategy({
                generation: 5,
                deathCause: 'coordinated_attack',
                survivalTime: 200
            });

            expect(cachedStrategy.source).toBe('cached');
        });

        it('should clear cache when requested', () => {
            degradationManager.clearCache();
            
            // Should not throw any errors
            expect(() => degradationManager.clearCache()).not.toThrow();
        });
    });
});

describe('Integration Tests', () => {
    let errorHandler: WebSocketErrorHandler;
    let degradationManager: GracefulDegradationManager;

    beforeEach(() => {
        errorHandler = new WebSocketErrorHandler();
        degradationManager = new GracefulDegradationManager();
    });

    afterEach(async () => {
        await errorHandler.cleanup();
        await degradationManager.cleanup();
    });

    it('should integrate error handling with graceful degradation', async () => {
        // Simulate connection error that triggers degradation
        const connectionError = new Error('Backend unavailable');
        
        const errorResult = await errorHandler.handleConnectionError(connectionError, {
            operation: 'connect'
        });

        if (errorResult.strategy === 'graceful_degradation') {
            // Notify degradation manager
            degradationManager.notifyBackendUnavailable();
            
            // Test that degradation manager can handle Queen death
            const deathData = {
                queenId: 'integration_test_queen',
                generation: 3,
                deathCause: 'protector_assault',
                survivalTime: 90
            };

            const degradationResult = await degradationManager.handleQueenDeath(deathData);
            
            expect(degradationResult).toHaveProperty('type', 'queen_strategy');
            expect(degradationResult.data.fallbackMode).toBe(true);
        }

        expect(errorResult.success).toBe(true);
    });

    it('should handle multiple error types in sequence', async () => {
        // Connection error
        const connectionResult = await errorHandler.handleConnectionError(
            new Error('Connection lost')
        );
        expect(connectionResult.success).toBe(true);

        // Message error
        const messageResult = await errorHandler.handleMessageError(
            new Error('Invalid JSON'),
            { invalid: 'data' }
        );
        expect(messageResult.success).toBe(true);

        // Check system health after multiple errors
        const health = errorHandler.getSystemHealth();
        expect(health).toBeDefined();
        
        const stats = errorHandler.getErrorStatistics();
        expect(stats.totalErrors).toBeGreaterThan(0);
    });
});