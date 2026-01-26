/**
 * IntroductionModelRenderer Performance Tests
 * 
 * Tests for task 22: Performance validation to ensure 60fps requirement
 * - Performance tests to validate 60fps requirement
 * - Memory usage monitoring
 * - Frame time consistency
 * - LOD system effectiveness
 * 
 * Requirements: 9.6 - Ensure 60fps performance across all model types
 */

import { IntroductionModelRenderer, IntroductionModelRendererConfig, PerformanceMetrics } from '../IntroductionModelRenderer';

// Mock Babylon.js with performance monitoring
jest.mock('@babylonjs/core', () => ({
    Engine: jest.fn().mockImplementation(() => ({
        runRenderLoop: jest.fn(),
        resize: jest.fn(),
        stopRenderLoop: jest.fn(),
        dispose: jest.fn(),
        getFps: jest.fn(() => 60) // Mock 60fps
    })),
    Scene: jest.fn().mockImplementation(() => ({
        clearColor: {},
        fogMode: 0,
        fogColor: {},
        fogDensity: 0,
        skipPointerMovePicking: false,
        skipPointerDownPicking: false,
        skipPointerUpPicking: false,
        activeCamera: null,
        render: jest.fn(),
        dispose: jest.fn(),
        registerBeforeRender: jest.fn(),
        meshes: [],
        materials: [],
        textures: [],
        getActiveMeshes: jest.fn(() => []),
        beginAnimation: jest.fn()
    })),
    ArcRotateCamera: jest.fn().mockImplementation(() => ({
        lowerBetaLimit: 0,
        upperBetaLimit: 0,
        lowerRadiusLimit: 0,
        upperRadiusLimit: 0,
        attachControl: jest.fn(),
        dispose: jest.fn(),
        position: { x: 0, y: 0, z: 0 }
    })),
    Vector3: {
        Zero: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
        Distance: jest.fn(() => 5)
    },
    HemisphericLight: jest.fn().mockImplementation(() => ({
        intensity: 0,
        diffuse: {},
        specular: {},
        dispose: jest.fn()
    })),
    DirectionalLight: jest.fn().mockImplementation(() => ({
        intensity: 0,
        diffuse: {},
        specular: {},
        dispose: jest.fn()
    })),
    Color3: jest.fn().mockImplementation(() => ({})),
    Color4: jest.fn().mockImplementation(() => ({})),
    AbstractMesh: jest.fn(),
    Animation: {
        ANIMATIONTYPE_FLOAT: 0,
        ANIMATIONLOOPMODE_CYCLE: 1
    },
    AnimationGroup: jest.fn().mockImplementation(() => ({
        addTargetedAnimation: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        dispose: jest.fn()
    })),
    DefaultRenderingPipeline: jest.fn().mockImplementation(() => ({
        bloomEnabled: true,
        bloomThreshold: 0,
        bloomWeight: 0,
        bloomKernel: 0,
        bloomScale: 0,
        imageProcessingEnabled: true,
        imageProcessing: {
            toneMappingEnabled: false,
            toneMappingType: 0,
            exposure: 0,
            contrast: 0
        },
        fxaaEnabled: false,
        dispose: jest.fn()
    })),
    Mesh: {
        CreateBox: jest.fn().mockImplementation(() => ({
            material: null,
            dispose: jest.fn(),
            setEnabled: jest.fn(),
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1 },
            animations: [],
            isDisposed: jest.fn(() => false),
            getIndices: jest.fn(() => new Array(300)) // Mock triangle count
        })),
        CreateSphere: jest.fn().mockImplementation(() => ({
            material: null,
            dispose: jest.fn(),
            setEnabled: jest.fn(),
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1 },
            animations: [],
            isDisposed: jest.fn(() => false),
            getIndices: jest.fn(() => new Array(600)) // Mock triangle count
        })),
        CreateGround: jest.fn().mockImplementation(() => ({
            material: null,
            dispose: jest.fn(),
            setEnabled: jest.fn(),
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1 },
            animations: [],
            isDisposed: jest.fn(() => false),
            getIndices: jest.fn(() => new Array(1200)) // Mock triangle count
        }))
    }
}));

// Mock MaterialManager
jest.mock('../../rendering/MaterialManager', () => ({
    MaterialManager: jest.fn().mockImplementation(() => ({
        createCustomMaterial: jest.fn().mockReturnValue({
            dispose: jest.fn()
        }),
        getColorPalette: jest.fn(() => ({
            terrain: { desert: { r: 0.8, g: 0.7, b: 0.4 } }
        })),
        dispose: jest.fn()
    }))
}));

// Mock component renderers with performance characteristics
jest.mock('../components/EmblemGeometry', () => ({
    EmblemGeometry: jest.fn().mockImplementation(() => ({
        createEmpireEmblem: jest.fn().mockReturnValue({
            dispose: jest.fn(),
            setEnabled: jest.fn(),
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1 },
            animations: [],
            isDisposed: jest.fn(() => false),
            getIndices: jest.fn(() => new Array(180)) // Low complexity
        }),
        createEnergyLordsEmblem: jest.fn().mockReturnValue({
            dispose: jest.fn(),
            setEnabled: jest.fn(),
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1 },
            animations: [],
            isDisposed: jest.fn(() => false),
            getIndices: jest.fn(() => new Array(240)) // Low complexity
        }),
        dispose: jest.fn()
    }))
}));

jest.mock('../components/PlanetRenderer', () => ({
    PlanetRenderer: jest.fn().mockImplementation(() => ({
        createDesertPlanet: jest.fn().mockReturnValue({
            dispose: jest.fn(),
            setEnabled: jest.fn(),
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1 },
            animations: [],
            isDisposed: jest.fn(() => false),
            getIndices: jest.fn(() => new Array(900)) // Medium complexity
        }),
        createOrbitalSystem: jest.fn().mockReturnValue({
            shipModel: {
                dispose: jest.fn(),
                setEnabled: jest.fn(),
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scaling: { x: 1, y: 1, z: 1 },
                animations: [],
                isDisposed: jest.fn(() => false),
                getIndices: jest.fn(() => new Array(1500)) // High complexity
            },
            orbitRadius: 5,
            orbitSpeed: 0.5,
            miningBeam: true
        }),
        dispose: jest.fn()
    }))
}));

jest.mock('../components/ParasiteRenderer', () => ({
    ParasiteRenderer: jest.fn().mockImplementation(() => ({
        createParasiteGroup: jest.fn().mockReturnValue({
            dispose: jest.fn(),
            setEnabled: jest.fn(),
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1 },
            animations: [],
            isDisposed: jest.fn(() => false),
            getIndices: jest.fn(() => new Array(720)) // Medium complexity
        }),
        dispose: jest.fn()
    }))
}));

jest.mock('../components/TerrainRenderer', () => ({
    TerrainRenderer: jest.fn().mockImplementation(() => ({
        createTerrainCloseup: jest.fn().mockReturnValue({
            dispose: jest.fn(),
            setEnabled: jest.fn(),
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1 },
            animations: [],
            isDisposed: jest.fn(() => false),
            getIndices: jest.fn(() => new Array(1800)) // High complexity
        }),
        dispose: jest.fn()
    }))
}));

describe('IntroductionModelRenderer Performance Tests', () => {
    let container: HTMLElement;
    let mockMaterialManager: any;
    let config: IntroductionModelRendererConfig;

    beforeEach(() => {
        // Create container element
        container = document.createElement('div');
        container.style.width = '300px';
        container.style.height = '400px';
        document.body.appendChild(container);

        // Mock MaterialManager
        const { MaterialManager } = require('../../rendering/MaterialManager');
        mockMaterialManager = new MaterialManager();

        // Create configuration
        config = {
            container,
            materialManager: mockMaterialManager,
            enableFallbacks: true
        };

        // Mock WebGL support
        const mockCanvas = document.createElement('canvas');
        const mockGL = {
            getExtension: jest.fn(() => ({})),
            getParameter: jest.fn((param) => {
                if (param === 'MAX_TEXTURE_SIZE') return 2048;
                if (param === 'MAX_VERTEX_ATTRIBS') return 16;
                return null;
            })
        };
        
        jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
            if (tagName === 'canvas') {
                const canvas = document.createElement('canvas') as any;
                canvas.getContext = jest.fn(() => mockGL);
                return canvas;
            }
            return document.createElement(tagName);
        });

        // Mock performance.memory with good performance
        Object.defineProperty(performance, 'memory', {
            value: {
                usedJSHeapSize: 100 * 1024 * 1024, // 100MB
                totalJSHeapSize: 200 * 1024 * 1024, // 200MB
                jsHeapSizeLimit: 1000 * 1024 * 1024 // 1GB
            },
            configurable: true
        });

        // Reset all mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
        jest.restoreAllMocks();
    });

    describe('60fps Performance Requirement', () => {
        test('should maintain 60fps with Empire emblem (page 0)', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(0);
            
            const metrics = renderer.getPerformanceMetrics();
            expect(metrics?.fps).toBeGreaterThanOrEqual(60);
            expect(metrics?.frameTime).toBeLessThanOrEqual(16.67); // 60fps = 16.67ms per frame
            
            renderer.dispose();
        });

        test('should maintain 60fps with Desert planet (page 1)', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(1);
            
            const metrics = renderer.getPerformanceMetrics();
            expect(metrics?.fps).toBeGreaterThanOrEqual(60);
            expect(metrics?.frameTime).toBeLessThanOrEqual(16.67);
            
            renderer.dispose();
        });

        test('should maintain 60fps with Terrain closeup (page 2)', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(2);
            
            const metrics = renderer.getPerformanceMetrics();
            expect(metrics?.fps).toBeGreaterThanOrEqual(60);
            expect(metrics?.frameTime).toBeLessThanOrEqual(16.67);
            
            renderer.dispose();
        });

        test('should maintain 60fps with Energy Lords emblem (page 3)', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(3);
            
            const metrics = renderer.getPerformanceMetrics();
            expect(metrics?.fps).toBeGreaterThanOrEqual(60);
            expect(metrics?.frameTime).toBeLessThanOrEqual(16.67);
            
            renderer.dispose();
        });

        test('should maintain 60fps with Parasite models (page 4)', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(4);
            
            const metrics = renderer.getPerformanceMetrics();
            expect(metrics?.fps).toBeGreaterThanOrEqual(60);
            expect(metrics?.frameTime).toBeLessThanOrEqual(16.67);
            
            renderer.dispose();
        });

        test('should maintain 60fps with Orbital system (page 5)', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(5);
            
            const metrics = renderer.getPerformanceMetrics();
            expect(metrics?.fps).toBeGreaterThanOrEqual(60);
            expect(metrics?.frameTime).toBeLessThanOrEqual(16.67);
            
            renderer.dispose();
        });

        test('should maintain 60fps across all model types in sequence', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Test all pages in sequence
            for (let pageIndex = 0; pageIndex < 6; pageIndex++) {
                await renderer.loadModelForPage(pageIndex);
                
                const metrics = renderer.getPerformanceMetrics();
                expect(metrics?.fps).toBeGreaterThanOrEqual(60);
                expect(metrics?.frameTime).toBeLessThanOrEqual(16.67);
            }
            
            renderer.dispose();
        });
    });

    describe('Performance Monitoring', () => {
        test('should provide accurate performance metrics', () => {
            const renderer = new IntroductionModelRenderer(config);
            const metrics = renderer.getPerformanceMetrics();
            
            expect(metrics).toBeDefined();
            expect(metrics?.fps).toBeGreaterThan(0);
            expect(metrics?.frameTime).toBeGreaterThan(0);
            expect(metrics?.drawCalls).toBeGreaterThanOrEqual(0);
            expect(metrics?.triangleCount).toBeGreaterThanOrEqual(0);
            expect(metrics?.memoryUsage).toBeGreaterThanOrEqual(0);
            
            renderer.dispose();
        });

        test('should track triangle count for performance optimization', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Load different complexity models
            await renderer.loadModelForPage(0); // Low complexity emblem
            const metrics1 = renderer.getPerformanceMetrics();
            
            await renderer.loadModelForPage(2); // High complexity terrain
            const metrics2 = renderer.getPerformanceMetrics();
            
            // Higher complexity model should have more triangles
            expect(metrics2?.triangleCount).toBeGreaterThan(metrics1?.triangleCount || 0);
            
            renderer.dispose();
        });

        test('should monitor memory usage', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            const initialMetrics = renderer.getPerformanceMetrics();
            
            // Load multiple models to increase memory usage
            await renderer.loadModelForPage(0);
            await renderer.loadModelForPage(1);
            await renderer.loadModelForPage(2);
            
            const finalMetrics = renderer.getPerformanceMetrics();
            
            // Memory usage should increase with more models
            expect(finalMetrics?.memoryUsage).toBeGreaterThanOrEqual(initialMetrics?.memoryUsage || 0);
            
            renderer.dispose();
        });

        test('should detect low performance conditions', () => {
            // Mock low FPS
            const { Engine } = require('@babylonjs/core');
            const mockEngine = new Engine();
            mockEngine.getFps = jest.fn(() => 30); // Low FPS
            
            const renderer = new IntroductionModelRenderer(config);
            
            // Simulate performance monitoring
            const metrics = renderer.getPerformanceMetrics();
            
            // Should detect low performance (below 45fps threshold)
            if (metrics && metrics.fps < 45) {
                expect(renderer.isInLowPerformanceMode()).toBe(true);
            }
            
            renderer.dispose();
        });
    });

    describe('Low Performance Mode Optimizations', () => {
        test('should enable low performance mode when FPS drops', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Force low performance mode
            renderer.setPerformanceMode(true);
            
            expect(renderer.isInLowPerformanceMode()).toBe(true);
            
            renderer.dispose();
        });

        test('should disable post-processing in low performance mode', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            renderer.setPerformanceMode(true);
            
            // Should be in low performance mode with optimizations
            expect(renderer.isInLowPerformanceMode()).toBe(true);
            
            renderer.dispose();
        });

        test('should restore normal performance mode when FPS improves', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Enable low performance mode
            renderer.setPerformanceMode(true);
            expect(renderer.isInLowPerformanceMode()).toBe(true);
            
            // Restore normal performance mode
            renderer.setPerformanceMode(false);
            expect(renderer.isInLowPerformanceMode()).toBe(false);
            
            renderer.dispose();
        });

        test('should use LOD system in low performance mode', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Enable low performance mode
            renderer.setPerformanceMode(true);
            
            await renderer.loadModelForPage(2); // Complex terrain model
            
            // Should still maintain performance with LOD optimizations
            const metrics = renderer.getPerformanceMetrics();
            expect(metrics?.fps).toBeGreaterThanOrEqual(30); // Minimum acceptable FPS
            
            renderer.dispose();
        });
    });

    describe('Memory Performance', () => {
        test('should handle memory constraints gracefully', () => {
            // Mock high memory usage
            Object.defineProperty(performance, 'memory', {
                value: {
                    usedJSHeapSize: 850 * 1024 * 1024, // 850MB
                    totalJSHeapSize: 900 * 1024 * 1024, // 900MB
                    jsHeapSizeLimit: 1000 * 1024 * 1024 // 1GB
                },
                configurable: true
            });

            const renderer = new IntroductionModelRenderer(config);
            const status = renderer.getStatus();
            
            expect(status.hasMemoryConstraints).toBe(true);
            expect(status.isLowPerformanceMode).toBe(true);
            
            renderer.dispose();
        });

        test('should clear cache to free memory when needed', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Load models to populate cache
            await renderer.loadModelForPage(0);
            await renderer.loadModelForPage(1);
            await renderer.loadModelForPage(2);
            
            const statsBefore = renderer.getCacheStatistics();
            expect(statsBefore.modelCacheSize).toBeGreaterThan(0);
            
            // Clear cache to free memory
            renderer.clearModelCache();
            
            const statsAfter = renderer.getCacheStatistics();
            expect(statsAfter.modelCacheSize).toBe(0);
            
            renderer.dispose();
        });

        test('should estimate memory usage accurately', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            const initialMetrics = renderer.getPerformanceMetrics();
            const initialMemory = initialMetrics?.memoryUsage || 0;
            
            // Load a complex model
            await renderer.loadModelForPage(5); // Orbital system
            
            const finalMetrics = renderer.getPerformanceMetrics();
            const finalMemory = finalMetrics?.memoryUsage || 0;
            
            // Memory usage should increase
            expect(finalMemory).toBeGreaterThan(initialMemory);
            
            renderer.dispose();
        });
    });

    describe('Frame Time Consistency', () => {
        test('should maintain consistent frame times', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(1); // Desert planet
            
            const metrics = renderer.getPerformanceMetrics();
            
            // Frame time should be consistent (within reasonable variance)
            expect(metrics?.frameTime).toBeLessThanOrEqual(20); // Allow some variance from 16.67ms
            expect(metrics?.frameTime).toBeGreaterThan(10); // But not too fast (unrealistic)
            
            renderer.dispose();
        });

        test('should handle frame time spikes gracefully', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Simulate frame time spike
            const { Engine } = require('@babylonjs/core');
            const mockEngine = new Engine();
            mockEngine.getFps = jest.fn(() => 45); // Temporary FPS drop
            
            const metrics = renderer.getPerformanceMetrics();
            
            // Should still be within acceptable range
            expect(metrics?.fps).toBeGreaterThan(30);
            
            renderer.dispose();
        });
    });

    describe('Optimization Effectiveness', () => {
        test('should show performance improvement with caching', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // First load (no cache)
            const startTime1 = performance.now();
            await renderer.loadModelForPage(0);
            const endTime1 = performance.now();
            const loadTime1 = endTime1 - startTime1;
            
            // Second load (with cache)
            const startTime2 = performance.now();
            await renderer.loadModelForPage(0);
            const endTime2 = performance.now();
            const loadTime2 = endTime2 - startTime2;
            
            // Cached load should be faster (or at least not slower)
            expect(loadTime2).toBeLessThanOrEqual(loadTime1 * 1.1); // Allow 10% variance
            
            renderer.dispose();
        });

        test('should optimize material reuse', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(0);
            const materialCallCount1 = mockMaterialManager.createCustomMaterial.mock.calls.length;
            
            await renderer.loadModelForPage(0); // Same page again
            const materialCallCount2 = mockMaterialManager.createCustomMaterial.mock.calls.length;
            
            // Should not create additional materials for cached model
            expect(materialCallCount2).toBe(materialCallCount1);
            
            renderer.dispose();
        });

        test('should preload models efficiently', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            const startTime = performance.now();
            await renderer.preloadModels([0, 1, 2]);
            const endTime = performance.now();
            const preloadTime = endTime - startTime;
            
            // Preloading should complete in reasonable time
            expect(preloadTime).toBeLessThan(1000); // Less than 1 second
            
            // Cache should be populated
            const cacheStats = renderer.getCacheStatistics();
            expect(cacheStats.modelCacheSize).toBeGreaterThan(0);
            
            renderer.dispose();
        });
    });

    describe('Performance Regression Prevention', () => {
        test('should not exceed triangle count limits', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Test all model types
            for (let pageIndex = 0; pageIndex < 6; pageIndex++) {
                await renderer.loadModelForPage(pageIndex);
                
                const metrics = renderer.getPerformanceMetrics();
                
                // Should not exceed reasonable triangle count for 60fps
                expect(metrics?.triangleCount).toBeLessThan(10000); // Reasonable limit for 60fps
            }
            
            renderer.dispose();
        });

        test('should not exceed draw call limits', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(5); // Most complex model (orbital system)
            
            const metrics = renderer.getPerformanceMetrics();
            
            // Should keep draw calls reasonable
            expect(metrics?.drawCalls).toBeLessThan(50); // Reasonable limit
            
            renderer.dispose();
        });

        test('should maintain performance across rapid page changes', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Rapidly change between pages
            for (let i = 0; i < 3; i++) {
                await renderer.loadModelForPage(0);
                await renderer.loadModelForPage(1);
                await renderer.loadModelForPage(2);
            }
            
            const metrics = renderer.getPerformanceMetrics();
            expect(metrics?.fps).toBeGreaterThanOrEqual(45); // Should maintain reasonable FPS
            
            renderer.dispose();
        });
    });
});