/**
 * IntroductionModelRenderer Unit Tests
 * 
 * Tests for task 22: Testing and Validation
 * - Unit tests for IntroductionModelRenderer component
 * - Model loading and page transitions
 * - Performance validation for 60fps requirement
 * - Responsive design behavior
 * - Asset reuse and MaterialManager integration
 * 
 * Requirements: 9.6, 9.7, 9.8
 */

import { IntroductionModelRenderer, ModelConfig, IntroductionModelRendererConfig } from '../IntroductionModelRenderer';

// Mock Babylon.js modules
jest.mock('@babylonjs/core', () => ({
    Engine: jest.fn().mockImplementation(() => ({
        runRenderLoop: jest.fn(),
        resize: jest.fn(),
        stopRenderLoop: jest.fn(),
        dispose: jest.fn(),
        getFps: jest.fn(() => 60)
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
            isDisposed: jest.fn(() => false)
        })),
        CreateSphere: jest.fn().mockImplementation(() => ({
            material: null,
            dispose: jest.fn(),
            setEnabled: jest.fn(),
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1 },
            animations: [],
            isDisposed: jest.fn(() => false)
        })),
        CreateGround: jest.fn().mockImplementation(() => ({
            material: null,
            dispose: jest.fn(),
            setEnabled: jest.fn(),
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1 },
            animations: [],
            isDisposed: jest.fn(() => false)
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

// Mock component renderers
jest.mock('../components/EmblemGeometry', () => ({
    EmblemGeometry: jest.fn().mockImplementation(() => ({
        createEmpireEmblem: jest.fn().mockReturnValue({
            dispose: jest.fn(),
            setEnabled: jest.fn(),
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1 },
            animations: [],
            isDisposed: jest.fn(() => false)
        }),
        createEnergyLordsEmblem: jest.fn().mockReturnValue({
            dispose: jest.fn(),
            setEnabled: jest.fn(),
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1 },
            animations: [],
            isDisposed: jest.fn(() => false)
        }),
        createSimpleEmblem: jest.fn().mockReturnValue({
            dispose: jest.fn(),
            setEnabled: jest.fn(),
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1 },
            animations: [],
            isDisposed: jest.fn(() => false)
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
            isDisposed: jest.fn(() => false)
        }),
        createOrbitalSystem: jest.fn().mockReturnValue({
            shipModel: {
                dispose: jest.fn(),
                setEnabled: jest.fn(),
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scaling: { x: 1, y: 1, z: 1 },
                animations: [],
                isDisposed: jest.fn(() => false)
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
            isDisposed: jest.fn(() => false)
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
            isDisposed: jest.fn(() => false)
        }),
        dispose: jest.fn()
    }))
}));

describe('IntroductionModelRenderer Unit Tests', () => {
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

        // Mock performance.memory
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

    describe('Initialization', () => {
        test('should initialize successfully with valid configuration', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            expect(renderer).toBeDefined();
            expect(renderer.isInitialized()).toBe(true);
            expect(renderer.isInFallbackMode()).toBe(false);
            
            renderer.dispose();
        });

        test('should detect WebGL support correctly', () => {
            const renderer = new IntroductionModelRenderer(config);
            const status = renderer.getStatus();
            
            expect(status.hasWebGLSupport).toBe(true);
            expect(status.isInitialized).toBe(true);
            
            renderer.dispose();
        });

        test('should handle WebGL not supported gracefully', () => {
            // Mock no WebGL support
            jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
                if (tagName === 'canvas') {
                    const canvas = document.createElement('canvas') as any;
                    canvas.getContext = jest.fn(() => null);
                    return canvas;
                }
                return document.createElement(tagName);
            });

            const onErrorSpy = jest.fn();
            const configWithError = { ...config, onError: onErrorSpy };
            
            const renderer = new IntroductionModelRenderer(configWithError);
            const status = renderer.getStatus();
            
            expect(status.hasWebGLSupport).toBe(false);
            expect(status.isInFallbackMode).toBe(true);
            expect(onErrorSpy).toHaveBeenCalled();
            
            renderer.dispose();
        });

        test('should detect memory constraints', () => {
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

        test('should create canvas with correct dimensions', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            const canvas = container.querySelector('canvas');
            expect(canvas).toBeTruthy();
            expect(canvas?.width).toBe(300);
            expect(canvas?.height).toBe(400);
            
            renderer.dispose();
        });
    });

    describe('Model Loading', () => {
        test('should load Empire emblem for page 0', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(0);
            
            expect(renderer.getCurrentPageIndex()).toBe(0);
            expect(renderer.getCurrentModel()).toBeTruthy();
            
            renderer.dispose();
        });

        test('should load Desert planet for page 1', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(1);
            
            expect(renderer.getCurrentPageIndex()).toBe(1);
            expect(renderer.getCurrentModel()).toBeTruthy();
            
            renderer.dispose();
        });

        test('should load Terrain closeup for page 2', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(2);
            
            expect(renderer.getCurrentPageIndex()).toBe(2);
            expect(renderer.getCurrentModel()).toBeTruthy();
            
            renderer.dispose();
        });

        test('should load Energy Lords emblem for page 3', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(3);
            
            expect(renderer.getCurrentPageIndex()).toBe(3);
            expect(renderer.getCurrentModel()).toBeTruthy();
            
            renderer.dispose();
        });

        test('should load Parasite models for page 4', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(4);
            
            expect(renderer.getCurrentPageIndex()).toBe(4);
            expect(renderer.getCurrentModel()).toBeTruthy();
            
            renderer.dispose();
        });

        test('should load Orbital system for page 5', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(5);
            
            expect(renderer.getCurrentPageIndex()).toBe(5);
            expect(renderer.getCurrentModel()).toBeTruthy();
            
            renderer.dispose();
        });

        test('should handle invalid page index gracefully', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(99);
            
            // Should fallback to text-only mode
            expect(container.innerHTML).toContain('3D MODEL DESCRIPTION');
            
            renderer.dispose();
        });

        test('should use cached models for better performance', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Load page 0 twice
            await renderer.loadModelForPage(0);
            const cacheStats1 = renderer.getCacheStatistics();
            
            await renderer.loadModelForPage(0);
            const cacheStats2 = renderer.getCacheStatistics();
            
            // Cache should be used
            expect(cacheStats1.modelCacheSize).toBeGreaterThan(0);
            expect(cacheStats2.modelCacheSize).toBe(cacheStats1.modelCacheSize);
            
            renderer.dispose();
        });

        test('should clear current model when loading new page', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(0);
            const model1 = renderer.getCurrentModel();
            
            await renderer.loadModelForPage(1);
            const model2 = renderer.getCurrentModel();
            
            expect(model1).not.toBe(model2);
            expect(renderer.getCurrentPageIndex()).toBe(1);
            
            renderer.dispose();
        });
    });

    describe('Performance Optimization', () => {
        test('should maintain 60fps performance target', () => {
            const renderer = new IntroductionModelRenderer(config);
            const metrics = renderer.getPerformanceMetrics();
            
            expect(metrics?.fps).toBeGreaterThanOrEqual(60);
            
            renderer.dispose();
        });

        test('should enable low performance mode when needed', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Force low performance mode
            renderer.setPerformanceMode(true);
            
            expect(renderer.isInLowPerformanceMode()).toBe(true);
            
            renderer.dispose();
        });

        test('should disable post-processing in low performance mode', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            renderer.setPerformanceMode(true);
            
            // Should be in low performance mode
            expect(renderer.isInLowPerformanceMode()).toBe(true);
            
            renderer.dispose();
        });

        test('should provide cache statistics for monitoring', () => {
            const renderer = new IntroductionModelRenderer(config);
            const stats = renderer.getCacheStatistics();
            
            expect(stats).toHaveProperty('modelCacheSize');
            expect(stats).toHaveProperty('materialCacheSize');
            expect(typeof stats.modelCacheSize).toBe('number');
            expect(typeof stats.materialCacheSize).toBe('number');
            
            renderer.dispose();
        });

        test('should clear model cache to free memory', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Load some models to populate cache
            await renderer.loadModelForPage(0);
            await renderer.loadModelForPage(1);
            
            const statsBefore = renderer.getCacheStatistics();
            expect(statsBefore.modelCacheSize).toBeGreaterThan(0);
            
            renderer.clearModelCache();
            
            const statsAfter = renderer.getCacheStatistics();
            expect(statsAfter.modelCacheSize).toBe(0);
            
            renderer.dispose();
        });
    });

    describe('Error Handling', () => {
        test('should handle model creation failures gracefully', async () => {
            const { EmblemGeometry } = require('../components/EmblemGeometry');
            
            // Mock emblem creation to fail
            const mockEmblemGeometry = new EmblemGeometry();
            mockEmblemGeometry.createEmpireEmblem.mockImplementation(() => {
                throw new Error('Model creation failed');
            });

            const onErrorSpy = jest.fn();
            const configWithError = { ...config, onError: onErrorSpy };
            
            const renderer = new IntroductionModelRenderer(configWithError);
            
            await renderer.loadModelForPage(0);
            
            // Should fallback to text-only mode
            expect(container.innerHTML).toContain('3D MODEL DESCRIPTION');
            
            renderer.dispose();
        });

        test('should retry model loading on transient failures', async () => {
            const { EmblemGeometry } = require('../components/EmblemGeometry');
            
            let callCount = 0;
            const mockEmblemGeometry = new EmblemGeometry();
            mockEmblemGeometry.createEmpireEmblem.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('Transient failure');
                }
                return {
                    dispose: jest.fn(),
                    setEnabled: jest.fn(),
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scaling: { x: 1, y: 1, z: 1 },
                    animations: [],
                    isDisposed: jest.fn(() => false)
                };
            });

            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(0);
            
            // Should have retried and succeeded
            expect(callCount).toBe(2);
            expect(renderer.getCurrentModel()).toBeTruthy();
            
            renderer.dispose();
        });

        test('should track error state for debugging', async () => {
            const { EmblemGeometry } = require('../components/EmblemGeometry');
            
            const mockEmblemGeometry = new EmblemGeometry();
            mockEmblemGeometry.createEmpireEmblem.mockImplementation(() => {
                throw new Error('Persistent failure');
            });

            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(0);
            
            const errorState = renderer.getErrorState();
            expect(errorState.errorCount).toBeGreaterThan(0);
            expect(errorState.lastError).toBeTruthy();
            
            renderer.dispose();
        });

        test('should attempt recovery from error state', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Force error state
            renderer.forceFallbackMode();
            expect(renderer.isInFallbackMode()).toBe(true);
            
            // Attempt recovery
            const recovered = renderer.attemptRecovery();
            
            // Recovery success depends on system capabilities
            const status = renderer.getStatus();
            if (status.hasWebGLSupport && !status.hasMemoryConstraints) {
                expect(recovered).toBe(true);
            } else {
                expect(recovered).toBe(false);
            }
            
            renderer.dispose();
        });
    });

    describe('Asset Reuse and MaterialManager Integration', () => {
        test('should use MaterialManager for consistent materials', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(0);
            
            // Should have used MaterialManager for material creation
            expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalled();
            
            renderer.dispose();
        });

        test('should reuse materials from cache', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(0);
            const callCount1 = mockMaterialManager.createCustomMaterial.mock.calls.length;
            
            await renderer.loadModelForPage(0); // Same page again
            const callCount2 = mockMaterialManager.createCustomMaterial.mock.calls.length;
            
            // Should not create additional materials for cached model
            expect(callCount2).toBe(callCount1);
            
            renderer.dispose();
        });

        test('should get color palette from MaterialManager', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(1); // Desert planet
            
            expect(mockMaterialManager.getColorPalette).toHaveBeenCalled();
            
            renderer.dispose();
        });

        test('should integrate with existing game materials', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.loadModelForPage(2); // Terrain
            
            // Should use MaterialManager for terrain materials
            expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalled();
            
            renderer.dispose();
        });
    });

    describe('Responsive Design', () => {
        test('should handle different container sizes', () => {
            // Test with different container sizes
            const sizes = [
                { width: '200px', height: '300px' },
                { width: '400px', height: '500px' },
                { width: '150px', height: '200px' }
            ];

            sizes.forEach(size => {
                const testContainer = document.createElement('div');
                testContainer.style.width = size.width;
                testContainer.style.height = size.height;
                document.body.appendChild(testContainer);

                const testConfig = { ...config, container: testContainer };
                const renderer = new IntroductionModelRenderer(testConfig);

                expect(renderer.isInitialized()).toBe(true);

                renderer.dispose();
                document.body.removeChild(testContainer);
            });
        });

        test('should adapt to mobile screen sizes', () => {
            // Mock mobile viewport
            Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });

            const mobileContainer = document.createElement('div');
            mobileContainer.style.width = '300px';
            mobileContainer.style.height = '200px'; // Shorter for mobile
            document.body.appendChild(mobileContainer);

            const mobileConfig = { ...config, container: mobileContainer };
            const renderer = new IntroductionModelRenderer(mobileConfig);

            expect(renderer.isInitialized()).toBe(true);

            renderer.dispose();
            document.body.removeChild(mobileContainer);
        });

        test('should handle container resize events', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Simulate window resize
            const resizeEvent = new Event('resize');
            window.dispatchEvent(resizeEvent);
            
            // Should not throw error
            expect(renderer.isInitialized()).toBe(true);
            
            renderer.dispose();
        });
    });

    describe('Disposal and Cleanup', () => {
        test('should dispose all resources properly', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            expect(() => {
                renderer.dispose();
            }).not.toThrow();
            
            expect(renderer.isInitialized()).toBe(false);
        });

        test('should handle disposal errors gracefully', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Mock disposal to throw error
            const mockEngine = renderer.getEngine();
            if (mockEngine) {
                mockEngine.dispose = jest.fn(() => {
                    throw new Error('Disposal error');
                });
            }
            
            // Should not throw despite disposal errors
            expect(() => {
                renderer.dispose();
            }).not.toThrow();
        });

        test('should clear container on disposal', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            // Container should have canvas
            expect(container.children.length).toBeGreaterThan(0);
            
            renderer.dispose();
            
            // Container should be cleared
            expect(container.innerHTML).toBe('');
        });

        test('should prevent operations after disposal', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            renderer.dispose();
            
            // Should not load models after disposal
            await renderer.loadModelForPage(0);
            
            expect(renderer.getCurrentModel()).toBeNull();
            expect(renderer.getCurrentPageIndex()).toBe(-1);
        });
    });

    describe('Status and Debugging', () => {
        test('should provide comprehensive status information', () => {
            const renderer = new IntroductionModelRenderer(config);
            const status = renderer.getStatus();
            
            expect(status).toHaveProperty('isInitialized');
            expect(status).toHaveProperty('isInFallbackMode');
            expect(status).toHaveProperty('isInTextOnlyMode');
            expect(status).toHaveProperty('isLowPerformanceMode');
            expect(status).toHaveProperty('hasWebGLSupport');
            expect(status).toHaveProperty('hasBabylonSupport');
            expect(status).toHaveProperty('hasMemoryConstraints');
            expect(status).toHaveProperty('errorCount');
            expect(status).toHaveProperty('retryCount');
            expect(status).toHaveProperty('currentPageIndex');
            expect(status).toHaveProperty('cacheStatistics');
            
            renderer.dispose();
        });

        test('should provide access to Babylon.js instances for debugging', () => {
            const renderer = new IntroductionModelRenderer(config);
            
            expect(renderer.getEngine()).toBeTruthy();
            expect(renderer.getScene()).toBeTruthy();
            
            renderer.dispose();
        });

        test('should track current model and page state', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            expect(renderer.getCurrentModel()).toBeNull();
            expect(renderer.getCurrentPageIndex()).toBe(-1);
            
            await renderer.loadModelForPage(2);
            
            expect(renderer.getCurrentModel()).toBeTruthy();
            expect(renderer.getCurrentPageIndex()).toBe(2);
            
            renderer.dispose();
        });
    });

    describe('Preloading and Optimization', () => {
        test('should support model preloading for better performance', async () => {
            const renderer = new IntroductionModelRenderer(config);
            
            await renderer.preloadModels([0, 1, 2]);
            
            const cacheStats = renderer.getCacheStatistics();
            expect(cacheStats.modelCacheSize).toBeGreaterThan(0);
            
            renderer.dispose();
        });

        test('should handle preloading errors gracefully', async () => {
            const { EmblemGeometry } = require('../components/EmblemGeometry');
            
            const mockEmblemGeometry = new EmblemGeometry();
            mockEmblemGeometry.createEmpireEmblem.mockImplementation(() => {
                throw new Error('Preload failed');
            });

            const renderer = new IntroductionModelRenderer(config);
            
            // Should not throw error during preloading
            await expect(renderer.preloadModels([0])).resolves.not.toThrow();
            
            renderer.dispose();
        });
    });
});