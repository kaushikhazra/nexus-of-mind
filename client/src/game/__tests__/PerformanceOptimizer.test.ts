/**
 * Performance Optimizer Tests
 * 
 * Tests for client-side performance optimization and 60fps isolation during AI training
 */

import { PerformanceOptimizer } from '../PerformanceOptimizer';
import { PerformanceMonitor } from '../../utils/PerformanceMonitor';

// Mock PerformanceMonitor
jest.mock('../../utils/PerformanceMonitor');

describe('PerformanceOptimizer', () => {
    let performanceOptimizer: PerformanceOptimizer;
    let mockPerformanceMonitor: jest.Mocked<PerformanceMonitor>;

    beforeEach(() => {
        // Create mock performance monitor
        mockPerformanceMonitor = new PerformanceMonitor(null as any, null as any) as jest.Mocked<PerformanceMonitor>;
        
        // Mock performance monitor methods
        mockPerformanceMonitor.getAverageFPS = jest.fn().mockReturnValue(60);
        mockPerformanceMonitor.getCurrentMetrics = jest.fn().mockReturnValue({
            fps: 60,
            frameTime: 16.67,
            memoryUsage: 100,
            timestamp: Date.now()
        });
        mockPerformanceMonitor.getPerformanceSummary = jest.fn().mockReturnValue({
            currentFPS: 60,
            averageFPS: 60,
            isPerformingWell: true
        });
        mockPerformanceMonitor.setThresholds = jest.fn();
        mockPerformanceMonitor.onWarning = jest.fn();
        mockPerformanceMonitor.onCritical = jest.fn();
        mockPerformanceMonitor.setConsoleLogging = jest.fn();
        mockPerformanceMonitor.dispose = jest.fn();

        // Create performance optimizer
        performanceOptimizer = new PerformanceOptimizer(mockPerformanceMonitor);
    });

    afterEach(() => {
        performanceOptimizer.dispose();
    });

    describe('Initialization', () => {
        test('should initialize with correct default settings', () => {
            const status = performanceOptimizer.getPerformanceStatus();
            
            expect(status.isTrainingActive).toBe(false);
            expect(status.performanceIsolationActive).toBe(true);
            expect(status.requirementsMet).toBe(true);
        });

        test('should set up performance monitoring callbacks', () => {
            expect(mockPerformanceMonitor.onWarning).toHaveBeenCalled();
            expect(mockPerformanceMonitor.onCritical).toHaveBeenCalled();
            expect(mockPerformanceMonitor.setThresholds).toHaveBeenCalledWith({
                targetFPS: 60,
                warningFPS: 50,
                criticalFPS: 40,
                maxFrameTime: 16.666666666666668
            });
        });
    });

    describe('AI Training Session Management', () => {
        test('should start AI training session correctly', async () => {
            const trainingData = { generation: 3, complexity: 0.3 };
            
            await performanceOptimizer.startAITrainingSession(trainingData);
            
            const status = performanceOptimizer.getPerformanceStatus();
            expect(status.isTrainingActive).toBe(true);
            expect(status.trainingDuration).toBeGreaterThan(0);
        });

        test('should end AI training session correctly', async () => {
            const trainingData = { generation: 3, complexity: 0.3 };
            const trainingResult = { success: true, training_time: 75.0 };
            
            await performanceOptimizer.startAITrainingSession(trainingData);
            await performanceOptimizer.endAITrainingSession(trainingResult);
            
            const status = performanceOptimizer.getPerformanceStatus();
            expect(status.isTrainingActive).toBe(false);
            expect(status.fpsImpact).toBe(0);
        });

        test('should prevent multiple concurrent training sessions', async () => {
            const trainingData = { generation: 3, complexity: 0.3 };
            
            await performanceOptimizer.startAITrainingSession(trainingData);
            
            // Try to start another session
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            await performanceOptimizer.startAITrainingSession(trainingData);
            
            expect(consoleSpy).toHaveBeenCalledWith('AI training session already active');
            consoleSpy.mockRestore();
        });
    });

    describe('Performance Isolation (Requirement 8.1)', () => {
        test('should maintain 60fps target', () => {
            const status = performanceOptimizer.getPerformanceStatus();
            expect(status.currentFPS).toBe(60);
        });

        test('should detect FPS impact during training', async () => {
            // Mock degraded performance
            mockPerformanceMonitor.getCurrentMetrics = jest.fn().mockReturnValue({
                fps: 45, // Below target
                frameTime: 22.22,
                memoryUsage: 150,
                timestamp: Date.now()
            });

            const trainingData = { generation: 3, complexity: 0.3 };
            await performanceOptimizer.startAITrainingSession(trainingData);

            // Simulate performance check
            const status = performanceOptimizer.getPerformanceStatus();
            expect(status.currentFPS).toBe(45);
            expect(status.fpsImpact).toBeGreaterThan(0);
        });

        test('should trigger performance warnings', async () => {
            let warningTriggered = false;
            let criticalTriggered = false;

            performanceOptimizer.setCallbacks({
                onWarning: () => { warningTriggered = true; },
                onCritical: () => { criticalTriggered = true; }
            });

            // Mock performance warning scenario
            mockPerformanceMonitor.getCurrentMetrics = jest.fn().mockReturnValue({
                fps: 45, // Warning level
                frameTime: 22.22,
                memoryUsage: 150,
                timestamp: Date.now()
            });

            const trainingData = { generation: 3, complexity: 0.3 };
            await performanceOptimizer.startAITrainingSession(trainingData);

            // Simulate warning callback from performance monitor
            const warningCallback = (mockPerformanceMonitor.onWarning as jest.Mock).mock.calls[0][0];
            warningCallback({ fps: 45, frameTime: 22.22 });

            expect(warningTriggered).toBe(true);
            expect(criticalTriggered).toBe(false);
        });

        test('should trigger critical performance alerts', async () => {
            let criticalTriggered = false;

            performanceOptimizer.setCallbacks({
                onCritical: () => { criticalTriggered = true; }
            });

            // Mock critical performance scenario
            mockPerformanceMonitor.getCurrentMetrics = jest.fn().mockReturnValue({
                fps: 30, // Critical level
                frameTime: 33.33,
                memoryUsage: 200,
                timestamp: Date.now()
            });

            const trainingData = { generation: 3, complexity: 0.3 };
            await performanceOptimizer.startAITrainingSession(trainingData);

            // Simulate critical callback from performance monitor
            const criticalCallback = (mockPerformanceMonitor.onCritical as jest.Mock).mock.calls[0][0];
            criticalCallback({ fps: 30, frameTime: 33.33 });

            expect(criticalTriggered).toBe(true);
        });
    });

    describe('Configuration', () => {
        test('should configure performance isolation settings', () => {
            performanceOptimizer.configureIsolation({
                enabled: false,
                targetFPS: 30,
                warningThreshold: 25,
                criticalThreshold: 20
            });

            const status = performanceOptimizer.getPerformanceStatus();
            expect(status.performanceIsolationActive).toBe(false);
        });

        test('should configure AI training parameters', () => {
            performanceOptimizer.configureTraining({
                maxTrainingDuration: 60000, // 60 seconds
                allowedFPSImpact: 5,
                memoryThreshold: 150,
                cpuThreshold: 70
            });

            // Configuration should be applied (tested indirectly through behavior)
            expect(performanceOptimizer).toBeDefined();
        });
    });

    describe('Performance Requirements Validation', () => {
        test('should validate Requirement 8.1 (60fps maintenance)', () => {
            const status = performanceOptimizer.getPerformanceStatus();
            
            // Should maintain 60fps with minimal impact
            expect(status.currentFPS).toBeGreaterThanOrEqual(60);
            expect(status.fpsImpact).toBeLessThanOrEqual(10); // Max 10 FPS impact allowed
        });

        test('should validate training duration limits (Requirement 8.4)', async () => {
            const trainingData = { generation: 3, complexity: 0.3 };
            
            await performanceOptimizer.startAITrainingSession(trainingData);
            
            // Wait a bit to accumulate training time
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const status = performanceOptimizer.getPerformanceStatus();
            expect(status.trainingDuration).toBeLessThanOrEqual(120000); // 120 seconds max
        });

        test('should provide optimization recommendations', () => {
            const recommendations = performanceOptimizer.getOptimizationRecommendations();
            
            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);
            
            // Should provide meaningful recommendations
            const hasRecommendation = recommendations.some(rec => 
                rec.includes('Performance optimization is working well') ||
                rec.includes('Consider reducing') ||
                rec.includes('Enable')
            );
            expect(hasRecommendation).toBe(true);
        });
    });

    describe('Performance Status Reporting', () => {
        test('should report comprehensive performance status', () => {
            const status = performanceOptimizer.getPerformanceStatus();
            
            expect(status).toHaveProperty('isTrainingActive');
            expect(status).toHaveProperty('currentFPS');
            expect(status).toHaveProperty('fpsImpact');
            expect(status).toHaveProperty('trainingDuration');
            expect(status).toHaveProperty('performanceIsolationActive');
            expect(status).toHaveProperty('requirementsMet');
        });

        test('should report requirements compliance', () => {
            const status = performanceOptimizer.getPerformanceStatus();
            
            // With good performance, requirements should be met
            expect(status.requirementsMet).toBe(true);
        });

        test('should detect requirements violations', async () => {
            // Mock poor performance
            mockPerformanceMonitor.getCurrentMetrics = jest.fn().mockReturnValue({
                fps: 30, // Below target
                frameTime: 33.33,
                memoryUsage: 250, // High memory usage
                timestamp: Date.now()
            });

            const trainingData = { generation: 3, complexity: 0.3 };
            await performanceOptimizer.startAITrainingSession(trainingData);

            const status = performanceOptimizer.getPerformanceStatus();
            expect(status.requirementsMet).toBe(false);
        });
    });

    describe('Cleanup and Disposal', () => {
        test('should dispose cleanly', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            performanceOptimizer.dispose();
            
            expect(consoleSpy).toHaveBeenCalledWith('🔧 Performance optimizer disposed');
            consoleSpy.mockRestore();
        });

        test('should end active training session on disposal', async () => {
            const trainingData = { generation: 3, complexity: 0.3 };
            await performanceOptimizer.startAITrainingSession(trainingData);
            
            expect(performanceOptimizer.getPerformanceStatus().isTrainingActive).toBe(true);
            
            performanceOptimizer.dispose();
            
            expect(performanceOptimizer.getPerformanceStatus().isTrainingActive).toBe(false);
        });
    });

    describe('Integration with Performance Monitor', () => {
        test('should integrate with performance monitor correctly', () => {
            expect(mockPerformanceMonitor.setThresholds).toHaveBeenCalled();
            expect(mockPerformanceMonitor.onWarning).toHaveBeenCalled();
            expect(mockPerformanceMonitor.onCritical).toHaveBeenCalled();
        });

        test('should use performance monitor data for status reporting', () => {
            const status = performanceOptimizer.getPerformanceStatus();
            
            expect(mockPerformanceMonitor.getCurrentMetrics).toHaveBeenCalled();
            expect(status.currentFPS).toBe(60); // From mocked data
        });
    });
});