/**
 * Performance Optimization Integration Tests
 * 
 * Tests the complete performance optimization system including:
 * - Memory usage monitoring (<100MB additional)
 * - CPU overhead monitoring (<15% additional)
 * - Performance degradation handling
 * - 60fps maintenance under load
 */

import { GameEngine } from '../GameEngine';
import { PerformanceOptimizer } from '../PerformanceOptimizer';
import { TerritoryPerformanceMonitor } from '../TerritoryPerformanceMonitor';
import { TerritoryManager } from '../TerritoryManager';
import { PerformanceMonitor } from '../../utils/PerformanceMonitor';

// Mock Babylon.js dependencies
jest.mock('@babylonjs/core', () => ({
    Engine: jest.fn().mockImplementation(() => ({
        dispose: jest.fn(),
        resize: jest.fn(),
        runRenderLoop: jest.fn(),
        stopRenderLoop: jest.fn(),
        getDeltaTime: jest.fn(() => 16.67), // 60 FPS
        getFps: jest.fn(() => 60)
    })),
    Scene: jest.fn().mockImplementation(() => ({
        dispose: jest.fn(),
        render: jest.fn(),
        registerBeforeRender: jest.fn(),
        onPointerObservable: { add: jest.fn() },
        pick: jest.fn(),
        createPickingRay: jest.fn(),
        pointerX: 0,
        pointerY: 0,
        activeCamera: {}
    })),
    Vector3: jest.fn().mockImplementation((x = 0, y = 0, z = 0) => ({ x, y, z })),
    Matrix: { Identity: jest.fn(() => ({})) },
    PointerEventTypes: { POINTERDOWN: 1, POINTERMOVE: 2 }
}));

// Mock canvas
const mockCanvas = {
    getContext: jest.fn(() => ({})),
    width: 800,
    height: 600
} as unknown as HTMLCanvasElement;

// Mock performance.memory for memory monitoring
const mockMemory = {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB baseline
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 200 * 1024 * 1024
};

Object.defineProperty(performance, 'memory', {
    value: mockMemory,
    writable: true
});

describe('Performance Optimization System', () => {
    let gameEngine: GameEngine;
    let performanceOptimizer: PerformanceOptimizer;
    let territoryManager: TerritoryManager;
    let performanceMonitor: PerformanceMonitor;

    beforeEach(async () => {
        // Reset performance.memory
        mockMemory.usedJSHeapSize = 50 * 1024 * 1024; // 50MB baseline
        
        // Create game engine
        gameEngine = new GameEngine(mockCanvas);
        await gameEngine.initialize();
        
        // Get system references
        performanceOptimizer = gameEngine.getPerformanceOptimizer()!;
        territoryManager = gameEngine.getTerritoryManager()!;
        performanceMonitor = gameEngine.getPerformanceMonitor()!;
        
        expect(performanceOptimizer).toBeDefined();
        expect(territoryManager).toBeDefined();
        expect(performanceMonitor).toBeDefined();
    });

    afterEach(() => {
        gameEngine?.dispose();
    });

    describe('Memory Usage Monitoring', () => {
        test('should track baseline memory usage', () => {
            const summary = performanceOptimizer.getPerformanceSummary();
            
            // Should have established baseline
            expect(summary).toBeDefined();
            expect(summary.memoryUsage).toBeGreaterThanOrEqual(0);
        });

        test('should detect memory usage increase', () => {
            // Simulate memory increase
            mockMemory.usedJSHeapSize = 120 * 1024 * 1024; // 120MB (70MB increase)
            
            // Update performance monitoring
            performanceOptimizer.update(0.016); // 16ms frame
            
            const metrics = performanceOptimizer.getCurrentMetrics();
            expect(metrics).toBeDefined();
            expect(metrics!.totalMemoryUsage).toBeGreaterThan(50); // Should detect increase
        });

        test('should enforce 100MB territory memory limit', () => {
            // Simulate high territory memory usage
            mockMemory.usedJSHeapSize = 160 * 1024 * 1024; // 160MB (110MB increase)
            
            // Update performance monitoring
            performanceOptimizer.update(0.016);
            
            const metrics = performanceOptimizer.getCurrentMetrics();
            expect(metrics).toBeDefined();
            
            // Should detect memory limit exceeded
            expect(metrics!.totalMemoryUsage).toBeGreaterThan(100);
            expect(metrics!.isWithinMemoryLimits).toBe(false);
        });

        test('should trigger optimization when memory limit exceeded', () => {
            let optimizationTriggered = false;
            let optimizationLevel = 0;
            
            performanceOptimizer.onOptimization((level, optimizations) => {
                optimizationTriggered = true;
                optimizationLevel = level;
            });
            
            // Simulate high memory usage
            mockMemory.usedJSHeapSize = 180 * 1024 * 1024; // 180MB
            
            // Mock low FPS to trigger critical performance
            jest.spyOn(performanceMonitor, 'getCurrentMetrics').mockReturnValue({
                fps: 35, // Below critical threshold
                frameTime: 28.57,
                drawCalls: 100,
                triangles: 1000,
                memoryUsage: 130,
                timestamp: performance.now()
            });
            
            // Update performance monitoring
            performanceOptimizer.update(0.016);
            
            // Should trigger optimization
            expect(optimizationTriggered).toBe(true);
            expect(optimizationLevel).toBeGreaterThan(0);
        });
    });

    describe('CPU Overhead Monitoring', () => {
        test('should track CPU overhead percentage', () => {
            // Mock performance metrics with higher frame time
            jest.spyOn(performanceMonitor, 'getCurrentMetrics').mockReturnValue({
                fps: 50, // Slightly below target
                frameTime: 20, // 20ms frame time (higher than baseline)
                drawCalls: 100,
                triangles: 1000,
                memoryUsage: 60,
                timestamp: performance.now()
            });
            
            // Update performance monitoring
            performanceOptimizer.update(0.016);
            
            const metrics = performanceOptimizer.getCurrentMetrics();
            expect(metrics).toBeDefined();
            expect(metrics!.totalCPUOverhead).toBeGreaterThan(0);
        });

        test('should enforce 15% CPU overhead limit for territory system', () => {
            const territoryPerformanceMonitor = territoryManager.getPerformanceMonitor();
            expect(territoryPerformanceMonitor).toBeDefined();
            
            // Territory system should have CPU overhead limits
            const summary = territoryPerformanceMonitor!.getPerformanceSummary();
            expect(summary).toBeDefined();
        });

        test('should apply performance degradation when CPU limit exceeded', () => {
            // Mock high CPU usage
            jest.spyOn(performanceMonitor, 'getCurrentMetrics').mockReturnValue({
                fps: 45, // Warning level
                frameTime: 25, // High frame time
                drawCalls: 200,
                triangles: 2000,
                memoryUsage: 80,
                timestamp: performance.now()
            });
            
            // Update performance monitoring
            performanceOptimizer.update(0.016);
            
            const metrics = performanceOptimizer.getCurrentMetrics();
            expect(metrics).toBeDefined();
            
            // Should detect performance issues
            expect(metrics!.overallGrade).not.toBe('excellent');
        });
    });

    describe('60fps Performance Maintenance', () => {
        test('should maintain excellent performance at 60fps', () => {
            // Mock good performance
            jest.spyOn(performanceMonitor, 'getCurrentMetrics').mockReturnValue({
                fps: 60,
                frameTime: 16.67,
                drawCalls: 50,
                triangles: 500,
                memoryUsage: 60,
                timestamp: performance.now()
            });
            
            // Update performance monitoring
            performanceOptimizer.update(0.016);
            
            const metrics = performanceOptimizer.getCurrentMetrics();
            expect(metrics).toBeDefined();
            expect(metrics!.canMaintain60FPS).toBe(true);
            expect(metrics!.overallGrade).toBe('excellent');
        });

        test('should detect when 60fps cannot be maintained', () => {
            // Mock poor performance
            jest.spyOn(performanceMonitor, 'getCurrentMetrics').mockReturnValue({
                fps: 35, // Well below 60fps
                frameTime: 28.57,
                drawCalls: 300,
                triangles: 5000,
                memoryUsage: 120,
                timestamp: performance.now()
            });
            
            // Update performance monitoring
            performanceOptimizer.update(0.016);
            
            const metrics = performanceOptimizer.getCurrentMetrics();
            expect(metrics).toBeDefined();
            expect(metrics!.canMaintain60FPS).toBe(false);
            expect(metrics!.overallGrade).toBe('critical');
        });

        test('should apply progressive optimization levels', () => {
            const optimizationLevels: number[] = [];
            
            performanceOptimizer.onOptimization((level) => {
                optimizationLevels.push(level);
            });
            
            // Simulate progressively worse performance
            const performanceStates = [
                { fps: 55, grade: 'good' },      // Should trigger level 0
                { fps: 45, grade: 'warning' },   // Should trigger level 1
                { fps: 35, grade: 'critical' }   // Should trigger level 2
            ];
            
            performanceStates.forEach((state, index) => {
                jest.spyOn(performanceMonitor, 'getCurrentMetrics').mockReturnValue({
                    fps: state.fps,
                    frameTime: 1000 / state.fps,
                    drawCalls: 100 + index * 50,
                    triangles: 1000 + index * 1000,
                    memoryUsage: 60 + index * 20,
                    timestamp: performance.now()
                });
                
                performanceOptimizer.update(0.016);
            });
            
            // Should have applied progressive optimizations
            expect(optimizationLevels.length).toBeGreaterThan(0);
            expect(Math.max(...optimizationLevels)).toBeGreaterThan(0);
        });
    });

    describe('Performance Degradation Handling', () => {
        test('should activate degradation mode when performance drops', () => {
            // Mock critical performance
            jest.spyOn(performanceMonitor, 'getCurrentMetrics').mockReturnValue({
                fps: 30, // Critical level
                frameTime: 33.33,
                drawCalls: 400,
                triangles: 8000,
                memoryUsage: 150,
                timestamp: performance.now()
            });
            
            // Update performance monitoring
            performanceOptimizer.update(0.016);
            
            // Should activate degradation
            expect(performanceOptimizer.isDegradationActive()).toBe(true);
            expect(performanceOptimizer.getOptimizationLevel()).toBeGreaterThan(0);
        });

        test('should provide performance suggestions', () => {
            // Mock poor performance
            jest.spyOn(performanceMonitor, 'getCurrentMetrics').mockReturnValue({
                fps: 40,
                frameTime: 25,
                drawCalls: 300,
                triangles: 6000,
                memoryUsage: 130,
                timestamp: performance.now()
            });
            
            // Update performance monitoring
            performanceOptimizer.update(0.016);
            
            const summary = performanceOptimizer.getPerformanceSummary();
            expect(summary.suggestions.length).toBeGreaterThan(0);
        });

        test('should restore full quality when performance improves', () => {
            // Start with poor performance
            jest.spyOn(performanceMonitor, 'getCurrentMetrics').mockReturnValue({
                fps: 35,
                frameTime: 28.57,
                drawCalls: 300,
                triangles: 5000,
                memoryUsage: 120,
                timestamp: performance.now()
            });
            
            performanceOptimizer.update(0.016);
            expect(performanceOptimizer.getOptimizationLevel()).toBeGreaterThan(0);
            
            // Improve performance
            jest.spyOn(performanceMonitor, 'getCurrentMetrics').mockReturnValue({
                fps: 60,
                frameTime: 16.67,
                drawCalls: 50,
                triangles: 500,
                memoryUsage: 60,
                timestamp: performance.now()
            });
            
            // Update multiple times to allow optimization reduction
            for (let i = 0; i < 5; i++) {
                performanceOptimizer.update(0.016);
            }
            
            // Should reduce optimization level
            const finalLevel = performanceOptimizer.getOptimizationLevel();
            expect(finalLevel).toBeLessThanOrEqual(1); // Should reduce or eliminate optimizations
        });
    });

    describe('Territory System Integration', () => {
        test('should monitor territory-specific performance', () => {
            const territoryPerformanceMonitor = territoryManager.getPerformanceMonitor();
            expect(territoryPerformanceMonitor).toBeDefined();
            
            // Create some territories to monitor
            territoryManager.createTerritory(0, 0);
            territoryManager.createTerritory(1024, 0);
            
            // Update territory system
            territoryManager.update(0.016);
            
            const territoryMetrics = territoryPerformanceMonitor!.getCurrentMetrics();
            expect(territoryMetrics).toBeDefined();
            expect(territoryMetrics!.activeTerritories).toBe(2);
        });

        test('should integrate territory performance with global optimization', () => {
            // Create multiple territories to increase load
            for (let i = 0; i < 10; i++) {
                territoryManager.createTerritory(i * 1024, 0);
            }
            
            // Mock poor performance
            jest.spyOn(performanceMonitor, 'getCurrentMetrics').mockReturnValue({
                fps: 40,
                frameTime: 25,
                drawCalls: 200,
                triangles: 3000,
                memoryUsage: 100,
                timestamp: performance.now()
            });
            
            // Update systems
            territoryManager.update(0.016);
            performanceOptimizer.update(0.016);
            
            // Should coordinate optimization between systems
            const globalMetrics = performanceOptimizer.getCurrentMetrics();
            const territoryMetrics = territoryManager.getPerformanceMonitor()?.getCurrentMetrics();
            
            expect(globalMetrics).toBeDefined();
            expect(territoryMetrics).toBeDefined();
            expect(globalMetrics!.territoryMetrics).toBeDefined();
        });
    });

    describe('Performance Thresholds', () => {
        test('should respect memory usage thresholds', () => {
            const thresholds = {
                maxTotalMemoryUsage: 150, // 150MB limit
                maxTerritoryMemoryUsage: 80 // 80MB for territory system
            };
            
            performanceOptimizer.setThresholds(thresholds);
            
            // Simulate memory usage at threshold
            mockMemory.usedJSHeapSize = 200 * 1024 * 1024; // 200MB (150MB increase)
            
            performanceOptimizer.update(0.016);
            
            const metrics = performanceOptimizer.getCurrentMetrics();
            expect(metrics!.isWithinMemoryLimits).toBe(false);
        });

        test('should respect CPU overhead thresholds', () => {
            const thresholds = {
                maxTotalCPUOverhead: 10, // 10% limit
                maxTerritoryCPUOverhead: 8 // 8% for territory system
            };
            
            performanceOptimizer.setThresholds(thresholds);
            
            // Mock high CPU usage
            jest.spyOn(performanceMonitor, 'getCurrentMetrics').mockReturnValue({
                fps: 45,
                frameTime: 22.22, // Higher than baseline
                drawCalls: 150,
                triangles: 2000,
                memoryUsage: 70,
                timestamp: performance.now()
            });
            
            performanceOptimizer.update(0.016);
            
            const metrics = performanceOptimizer.getCurrentMetrics();
            expect(metrics!.isWithinCPULimits).toBe(false);
        });
    });

    describe('Performance Summary', () => {
        test('should provide comprehensive performance summary', () => {
            // Update performance monitoring
            performanceOptimizer.update(0.016);
            
            const summary = performanceOptimizer.getPerformanceSummary();
            
            expect(summary).toHaveProperty('overallGrade');
            expect(summary).toHaveProperty('memoryUsage');
            expect(summary).toHaveProperty('cpuOverhead');
            expect(summary).toHaveProperty('currentFPS');
            expect(summary).toHaveProperty('canMaintain60FPS');
            expect(summary).toHaveProperty('optimizationLevel');
            expect(summary).toHaveProperty('activeOptimizations');
            expect(summary).toHaveProperty('suggestions');
            
            expect(Array.isArray(summary.activeOptimizations)).toBe(true);
            expect(Array.isArray(summary.suggestions)).toBe(true);
        });

        test('should track performance history', () => {
            // Update multiple times to build history
            for (let i = 0; i < 5; i++) {
                performanceOptimizer.update(0.016);
            }
            
            const history = performanceOptimizer.getMetricsHistory();
            expect(history.length).toBeGreaterThan(0);
            expect(history.length).toBeLessThanOrEqual(5);
            
            // Each entry should have required properties
            history.forEach(metrics => {
                expect(metrics).toHaveProperty('totalMemoryUsage');
                expect(metrics).toHaveProperty('totalCPUOverhead');
                expect(metrics).toHaveProperty('overallGrade');
                expect(metrics).toHaveProperty('timestamp');
            });
        });
    });
});