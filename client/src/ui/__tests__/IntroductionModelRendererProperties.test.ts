/**
 * IntroductionModelRenderer Property-Based Tests
 * 
 * Tests for task 22: Property-based tests for 3D models
 * - Property 13: 3D Model Rendering Consistency
 * - Property 14: Model Animation Behavior  
 * - Property 15: Model Performance Consistency
 * - Property 16: Layout Integration Consistency
 * - Property 17: Asset Reuse Consistency
 * 
 * Requirements: 9.6, 9.7, 9.8
 */

import fc from 'fast-check';
import { IntroductionModelRenderer, IntroductionModelRendererConfig } from '../IntroductionModelRenderer';

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

describe('IntroductionModelRenderer Property-Based Tests', () => {
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

    /**
     * Property 13: 3D Model Rendering Consistency
     * For any story page displayed, the Introduction Screen should render the contextually 
     * appropriate 3D model in the dedicated 300px model area with proper lighting and materials
     * Validates: Requirements 9.1, 9.2
     */
    describe('Property 13: 3D Model Rendering Consistency', () => {
        test('should render contextually appropriate 3D model for any valid page index', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: 5 }), // Valid page indices
                async (pageIndex) => {
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        await renderer.loadModelForPage(pageIndex);
                        
                        // Should have loaded a model
                        expect(renderer.getCurrentModel()).toBeTruthy();
                        expect(renderer.getCurrentPageIndex()).toBe(pageIndex);
                        
                        // Should be initialized and not in fallback mode
                        expect(renderer.isInitialized()).toBe(true);
                        expect(renderer.isInFallbackMode()).toBe(false);
                        
                        // Should have proper canvas dimensions (300px model area)
                        const canvas = container.querySelector('canvas');
                        expect(canvas?.width).toBe(300);
                        expect(canvas?.height).toBe(400);
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 50 });
        });

        test('should handle invalid page indices gracefully', () => {
            fc.assert(fc.property(
                fc.integer({ min: -100, max: 100 }).filter(n => n < 0 || n > 5), // Invalid page indices
                async (invalidPageIndex) => {
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        await renderer.loadModelForPage(invalidPageIndex);
                        
                        // Should fallback to text-only mode for invalid pages
                        expect(container.innerHTML).toContain('3D MODEL DESCRIPTION');
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 20 });
        });

        test('should maintain consistent model state across different page loads', () => {
            fc.assert(fc.property(
                fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 2, maxLength: 6 }),
                async (pageSequence) => {
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        for (const pageIndex of pageSequence) {
                            await renderer.loadModelForPage(pageIndex);
                            
                            // Each page should have its own model
                            expect(renderer.getCurrentPageIndex()).toBe(pageIndex);
                            expect(renderer.getCurrentModel()).toBeTruthy();
                        }
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 30 });
        });
    });

    /**
     * Property 14: Model Animation Behavior
     * For any 3D model loaded, the model should animate with slow rotation at approximately 
     * 0.5 RPM and any additional effects specific to the model type
     * Validates: Requirements 9.3
     */
    describe('Property 14: Model Animation Behavior', () => {
        test('should apply rotation animation to any loaded model', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: 5 }),
                async (pageIndex) => {
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        await renderer.loadModelForPage(pageIndex);
                        
                        const model = renderer.getCurrentModel();
                        expect(model).toBeTruthy();
                        
                        // Model should have animations applied
                        expect(model?.animations).toBeDefined();
                        
                        // Should be able to start animation without error
                        expect(() => {
                            renderer.startAnimation();
                        }).not.toThrow();
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 50 });
        });

        test('should handle animation state transitions consistently', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: 5 }),
                fc.array(fc.boolean(), { minLength: 3, maxLength: 10 }),
                async (pageIndex, animationStates) => {
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        await renderer.loadModelForPage(pageIndex);
                        
                        // Test animation start/stop sequence
                        for (const shouldAnimate of animationStates) {
                            if (shouldAnimate) {
                                expect(() => renderer.startAnimation()).not.toThrow();
                            } else {
                                expect(() => renderer.stopAnimation()).not.toThrow();
                            }
                        }
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 30 });
        });
    });

    /**
     * Property 15: Model Performance Consistency
     * For any 3D model rendered, the Introduction Screen should maintain 60fps performance 
     * and load models efficiently for the current page only
     * Validates: Requirements 9.6, 9.8
     */
    describe('Property 15: Model Performance Consistency', () => {
        test('should maintain 60fps performance for any model type', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: 5 }),
                async (pageIndex) => {
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        await renderer.loadModelForPage(pageIndex);
                        
                        const metrics = renderer.getPerformanceMetrics();
                        
                        // Should maintain target FPS
                        expect(metrics?.fps).toBeGreaterThanOrEqual(60);
                        expect(metrics?.frameTime).toBeLessThanOrEqual(16.67); // 60fps = 16.67ms per frame
                        
                        // Should have reasonable resource usage
                        expect(metrics?.triangleCount).toBeLessThan(10000); // Reasonable limit
                        expect(metrics?.drawCalls).toBeLessThan(50); // Reasonable limit
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 50 });
        });

        test('should load models efficiently with caching', () => {
            fc.assert(fc.property(
                fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 2, maxLength: 8 }),
                async (pageSequence) => {
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        const loadTimes: number[] = [];
                        
                        for (const pageIndex of pageSequence) {
                            const startTime = performance.now();
                            await renderer.loadModelForPage(pageIndex);
                            const endTime = performance.now();
                            
                            loadTimes.push(endTime - startTime);
                        }
                        
                        // Cache should be populated
                        const cacheStats = renderer.getCacheStatistics();
                        expect(cacheStats.modelCacheSize).toBeGreaterThan(0);
                        
                        // Performance should remain consistent
                        const metrics = renderer.getPerformanceMetrics();
                        expect(metrics?.fps).toBeGreaterThanOrEqual(45); // Allow some variance
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 20 });
        });

        test('should handle performance mode changes consistently', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: 5 }),
                fc.array(fc.boolean(), { minLength: 2, maxLength: 6 }),
                async (pageIndex, performanceModes) => {
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        await renderer.loadModelForPage(pageIndex);
                        
                        // Test performance mode changes
                        for (const lowPerformanceMode of performanceModes) {
                            renderer.setPerformanceMode(lowPerformanceMode);
                            expect(renderer.isInLowPerformanceMode()).toBe(lowPerformanceMode);
                            
                            // Should maintain functionality in any performance mode
                            const metrics = renderer.getPerformanceMetrics();
                            expect(metrics?.fps).toBeGreaterThan(0);
                        }
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 30 });
        });
    });

    /**
     * Property 16: Layout Integration Consistency
     * For any screen size, the Introduction Screen should properly integrate the 3D model area 
     * with the story content area, including the soft dividing line with SciFi glow effect
     * Validates: Requirements 9.4, 9.7
     */
    describe('Property 16: Layout Integration Consistency', () => {
        test('should handle different container dimensions consistently', () => {
            fc.assert(fc.property(
                fc.integer({ min: 200, max: 800 }), // Width
                fc.integer({ min: 200, max: 600 }), // Height
                (width, height) => {
                    const testContainer = document.createElement('div');
                    testContainer.style.width = `${width}px`;
                    testContainer.style.height = `${height}px`;
                    document.body.appendChild(testContainer);
                    
                    try {
                        const testConfig = { ...config, container: testContainer };
                        const renderer = new IntroductionModelRenderer(testConfig);
                        
                        // Should initialize successfully with any reasonable dimensions
                        expect(renderer.isInitialized()).toBe(true);
                        
                        // Canvas should be created with proper dimensions
                        const canvas = testContainer.querySelector('canvas');
                        expect(canvas).toBeTruthy();
                        expect(canvas?.width).toBe(300); // Fixed model area width
                        expect(canvas?.height).toBe(400); // Fixed model area height
                        
                        renderer.dispose();
                        
                    } finally {
                        document.body.removeChild(testContainer);
                    }
                }
            ), { numRuns: 30 });
        });

        test('should maintain layout consistency across different viewport sizes', () => {
            fc.assert(fc.property(
                fc.integer({ min: 320, max: 1920 }), // Viewport width
                fc.integer({ min: 240, max: 1080 }), // Viewport height
                (viewportWidth, viewportHeight) => {
                    // Mock viewport size
                    Object.defineProperty(window, 'innerWidth', { value: viewportWidth, writable: true });
                    Object.defineProperty(window, 'innerHeight', { value: viewportHeight, writable: true });
                    
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        // Should handle any viewport size
                        expect(renderer.isInitialized()).toBe(true);
                        
                        // Should respond to resize events
                        const resizeEvent = new Event('resize');
                        expect(() => {
                            window.dispatchEvent(resizeEvent);
                        }).not.toThrow();
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 25 });
        });

        test('should handle responsive design breakpoints consistently', () => {
            fc.assert(fc.property(
                fc.constantFrom(
                    { width: 320, height: 568 },   // Mobile portrait
                    { width: 568, height: 320 },   // Mobile landscape
                    { width: 768, height: 1024 },  // Tablet portrait
                    { width: 1024, height: 768 },  // Tablet landscape
                    { width: 1920, height: 1080 }  // Desktop
                ),
                (viewport) => {
                    Object.defineProperty(window, 'innerWidth', { value: viewport.width, writable: true });
                    Object.defineProperty(window, 'innerHeight', { value: viewport.height, writable: true });
                    
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        expect(renderer.isInitialized()).toBe(true);
                        
                        // Should maintain functionality across all breakpoints
                        const status = renderer.getStatus();
                        expect(status.isInitialized).toBe(true);
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 25 });
        });
    });

    /**
     * Property 17: Asset Reuse Consistency
     * For any 3D model created, the system should utilize existing game assets 
     * (MaterialManager, terrain textures, Babylon.js engine) for visual consistency with the main game
     * Validates: Requirements 9.5, 9.9, 9.10
     */
    describe('Property 17: Asset Reuse Consistency', () => {
        test('should use MaterialManager consistently for any model type', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: 5 }),
                async (pageIndex) => {
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        await renderer.loadModelForPage(pageIndex);
                        
                        // Should have used MaterialManager for material creation
                        expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalled();
                        
                        // Should maintain visual consistency
                        const model = renderer.getCurrentModel();
                        expect(model).toBeTruthy();
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 50 });
        });

        test('should reuse materials efficiently across different models', () => {
            fc.assert(fc.property(
                fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 2, maxLength: 6 }),
                async (pageSequence) => {
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        const initialCallCount = mockMaterialManager.createCustomMaterial.mock.calls.length;
                        
                        for (const pageIndex of pageSequence) {
                            await renderer.loadModelForPage(pageIndex);
                        }
                        
                        const finalCallCount = mockMaterialManager.createCustomMaterial.mock.calls.length;
                        
                        // Should have created materials, but efficiently reused when possible
                        expect(finalCallCount).toBeGreaterThan(initialCallCount);
                        
                        // Cache should show material reuse
                        const cacheStats = renderer.getCacheStatistics();
                        expect(cacheStats.materialCacheSize).toBeGreaterThan(0);
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 20 });
        });

        test('should integrate with existing Babylon.js engine consistently', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: 5 }),
                fc.array(fc.boolean(), { minLength: 2, maxLength: 5 }), // Animation states
                async (pageIndex, animationStates) => {
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        await renderer.loadModelForPage(pageIndex);
                        
                        // Should have valid Babylon.js instances
                        expect(renderer.getEngine()).toBeTruthy();
                        expect(renderer.getScene()).toBeTruthy();
                        
                        // Should handle Babylon.js operations consistently
                        for (const shouldAnimate of animationStates) {
                            if (shouldAnimate) {
                                expect(() => renderer.startAnimation()).not.toThrow();
                            } else {
                                expect(() => renderer.stopAnimation()).not.toThrow();
                            }
                        }
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 30 });
        });

        test('should maintain color palette consistency across all models', () => {
            fc.assert(fc.property(
                fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 3, maxLength: 6 }),
                async (pageSequence) => {
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        for (const pageIndex of pageSequence) {
                            await renderer.loadModelForPage(pageIndex);
                            
                            // Should request color palette for visual consistency
                            expect(mockMaterialManager.getColorPalette).toHaveBeenCalled();
                        }
                        
                        // Should maintain consistent material usage
                        expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalled();
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 20 });
        });
    });

    describe('Property Test Error Handling', () => {
        test('should handle random error conditions gracefully', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: 5 }),
                fc.boolean(), // Should simulate error
                async (pageIndex, shouldError) => {
                    if (shouldError) {
                        // Mock component to throw error
                        const { EmblemGeometry } = require('../components/EmblemGeometry');
                        const mockEmblemGeometry = new EmblemGeometry();
                        mockEmblemGeometry.createEmpireEmblem.mockImplementationOnce(() => {
                            throw new Error('Random test error');
                        });
                    }
                    
                    const renderer = new IntroductionModelRenderer(config);
                    
                    try {
                        await renderer.loadModelForPage(pageIndex);
                        
                        if (shouldError && pageIndex === 0) {
                            // Should fallback to text-only mode on error
                            expect(container.innerHTML).toContain('3D MODEL DESCRIPTION');
                        } else {
                            // Should work normally
                            expect(renderer.getCurrentPageIndex()).toBe(pageIndex);
                        }
                        
                    } finally {
                        renderer.dispose();
                    }
                }
            ), { numRuns: 40 });
        });
    });
});