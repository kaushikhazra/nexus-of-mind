/**
 * IntroductionModelRenderer Error Handling Tests
 * 
 * Tests for task 21: Error Handling and Fallbacks
 * - Graceful fallbacks for WebGL/Babylon.js initialization failures
 * - Loading states and error messages for model failures
 * - Fallback to text-only mode if 3D rendering fails
 * - Memory constraints and cleanup edge cases
 */

import { IntroductionModelRenderer } from '../IntroductionModelRenderer';

// Mock Babylon.js modules
jest.mock('@babylonjs/core', () => ({
    Engine: jest.fn(),
    Scene: jest.fn(),
    ArcRotateCamera: jest.fn(),
    Vector3: {
        Zero: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
        Distance: jest.fn(() => 5)
    },
    HemisphericLight: jest.fn(),
    DirectionalLight: jest.fn(),
    Color3: jest.fn(),
    Color4: jest.fn(),
    AbstractMesh: jest.fn(),
    Animation: {
        ANIMATIONTYPE_FLOAT: 0,
        ANIMATIONLOOPMODE_CYCLE: 1
    },
    AnimationGroup: jest.fn(),
    DefaultRenderingPipeline: jest.fn(),
    Mesh: {
        CreateBox: jest.fn(),
        CreateSphere: jest.fn()
    },
    Material: jest.fn()
}));

// Mock MaterialManager
jest.mock('../rendering/MaterialManager', () => ({
    MaterialManager: jest.fn().mockImplementation(() => ({
        createCustomMaterial: jest.fn(),
        getColorPalette: jest.fn(() => ({
            terrain: { desert: { r: 0.8, g: 0.7, b: 0.4 } }
        })),
        dispose: jest.fn()
    }))
}));

// Mock component renderers
jest.mock('../components/EmblemGeometry', () => ({
    EmblemGeometry: jest.fn().mockImplementation(() => ({
        createEmpireEmblem: jest.fn(),
        createEnergyLordsEmblem: jest.fn(),
        createSimpleEmblem: jest.fn(),
        dispose: jest.fn()
    }))
}));

jest.mock('../components/PlanetRenderer', () => ({
    PlanetRenderer: jest.fn().mockImplementation(() => ({
        createDesertPlanet: jest.fn(),
        createOrbitalSystem: jest.fn(),
        dispose: jest.fn()
    }))
}));

jest.mock('../components/ParasiteRenderer', () => ({
    ParasiteRenderer: jest.fn().mockImplementation(() => ({
        createParasiteGroup: jest.fn(),
        dispose: jest.fn()
    }))
}));

jest.mock('../components/TerrainRenderer', () => ({
    TerrainRenderer: jest.fn().mockImplementation(() => ({
        createTerrainCloseup: jest.fn(),
        dispose: jest.fn()
    }))
}));

describe('IntroductionModelRenderer Error Handling', () => {
    let container: HTMLElement;
    let mockMaterialManager: any;

    beforeEach(() => {
        // Create container element
        container = document.createElement('div');
        container.style.width = '300px';
        container.style.height = '400px';
        document.body.appendChild(container);

        // Mock MaterialManager
        mockMaterialManager = {
            createCustomMaterial: jest.fn(),
            getColorPalette: jest.fn(() => ({
                terrain: { desert: { r: 0.8, g: 0.7, b: 0.4 } }
            })),
            dispose: jest.fn()
        };

        // Reset all mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    describe('WebGL Support Detection', () => {
        test('should detect WebGL support correctly', () => {
            // Mock WebGL context
            const mockCanvas = document.createElement('canvas');
            const mockGL = {
                getExtension: jest.fn(() => ({})),
                getParameter: jest.fn((param) => {
                    if (param === 'MAX_TEXTURE_SIZE') return 2048;
                    if (param === 'MAX_VERTEX_ATTRIBS') return 16;
                    return null;
                })
            };
            
            jest.spyOn(document, 'createElement').mockReturnValue(mockCanvas);
            jest.spyOn(mockCanvas, 'getContext').mockReturnValue(mockGL as any);

            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager
            });

            const status = renderer.getStatus();
            expect(status.hasWebGLSupport).toBe(true);
        });

        test('should handle WebGL not supported', () => {
            // Mock no WebGL support
            const mockCanvas = document.createElement('canvas');
            jest.spyOn(document, 'createElement').mockReturnValue(mockCanvas);
            jest.spyOn(mockCanvas, 'getContext').mockReturnValue(null);

            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager
            });

            const status = renderer.getStatus();
            expect(status.hasWebGLSupport).toBe(false);
            expect(status.isInFallbackMode).toBe(true);
        });
    });

    describe('Babylon.js Initialization Failures', () => {
        test('should handle Engine creation failure', () => {
            const { Engine } = require('@babylonjs/core');
            Engine.mockImplementation(() => {
                throw new Error('Engine creation failed');
            });

            const onErrorSpy = jest.fn();
            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager,
                onError: onErrorSpy
            });

            expect(onErrorSpy).toHaveBeenCalledWith(
                expect.any(Error),
                true // fallbackMode
            );

            const status = renderer.getStatus();
            expect(status.isInFallbackMode).toBe(true);
        });

        test('should handle Scene creation failure', () => {
            const { Scene } = require('@babylonjs/core');
            Scene.mockImplementation(() => {
                throw new Error('Scene creation failed');
            });

            const onErrorSpy = jest.fn();
            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager,
                onError: onErrorSpy
            });

            expect(onErrorSpy).toHaveBeenCalledWith(
                expect.any(Error),
                true // fallbackMode
            );
        });
    });

    describe('Model Loading Failures', () => {
        test('should handle model creation failure with fallback', async () => {
            // Mock successful initialization but failed model creation
            const mockEngine = { dispose: jest.fn(), stopRenderLoop: jest.fn() };
            const mockScene = { dispose: jest.fn(), render: jest.fn() };
            const mockCamera = { dispose: jest.fn() };

            const { Engine, Scene, ArcRotateCamera } = require('@babylonjs/core');
            Engine.mockReturnValue(mockEngine);
            Scene.mockReturnValue(mockScene);
            ArcRotateCamera.mockReturnValue(mockCamera);

            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager
            });

            // Mock component failure
            const mockEmblemGeometry = {
                createEmpireEmblem: jest.fn(() => {
                    throw new Error('Model creation failed');
                }),
                createSimpleEmblem: jest.fn(() => null),
                dispose: jest.fn()
            };

            // Inject mock component
            (renderer as any).emblemGeometry = mockEmblemGeometry;

            await renderer.loadModelForPage(0); // Empire emblem page

            // Should fallback to text-only mode
            expect(container.innerHTML).toContain('3D MODEL DESCRIPTION');
            expect(container.innerHTML).toContain('Korenthi Empire Emblem');
        });

        test('should retry model loading on transient failures', async () => {
            const mockEngine = { dispose: jest.fn(), stopRenderLoop: jest.fn() };
            const mockScene = { dispose: jest.fn(), render: jest.fn() };
            const mockCamera = { dispose: jest.fn() };

            const { Engine, Scene, ArcRotateCamera } = require('@babylonjs/core');
            Engine.mockReturnValue(mockEngine);
            Scene.mockReturnValue(mockScene);
            ArcRotateCamera.mockReturnValue(mockCamera);

            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager
            });

            let callCount = 0;
            const mockEmblemGeometry = {
                createEmpireEmblem: jest.fn(() => {
                    callCount++;
                    if (callCount === 1) {
                        throw new Error('Transient failure');
                    }
                    return { dispose: jest.fn(), setEnabled: jest.fn() };
                }),
                dispose: jest.fn()
            };

            (renderer as any).emblemGeometry = mockEmblemGeometry;

            await renderer.loadModelForPage(0);

            // Should have retried
            expect(mockEmblemGeometry.createEmpireEmblem).toHaveBeenCalledTimes(2);
        });
    });

    describe('Memory Constraints Handling', () => {
        test('should detect memory constraints', () => {
            // Mock performance.memory API
            Object.defineProperty(performance, 'memory', {
                value: {
                    usedJSHeapSize: 800 * 1024 * 1024, // 800MB
                    totalJSHeapSize: 900 * 1024 * 1024, // 900MB
                    jsHeapSizeLimit: 1000 * 1024 * 1024 // 1GB
                },
                configurable: true
            });

            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager
            });

            const status = renderer.getStatus();
            expect(status.hasMemoryConstraints).toBe(true);
            expect(status.isLowPerformanceMode).toBe(true);
        });
    });

    describe('Loading States', () => {
        test('should show and hide loading states', async () => {
            const onLoadingStateChangeSpy = jest.fn();
            
            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager,
                onLoadingStateChange: onLoadingStateChangeSpy
            });

            // Mock successful components
            const mockEmblemGeometry = {
                createEmpireEmblem: jest.fn(() => ({ 
                    dispose: jest.fn(), 
                    setEnabled: jest.fn() 
                })),
                dispose: jest.fn()
            };
            (renderer as any).emblemGeometry = mockEmblemGeometry;

            await renderer.loadModelForPage(0);

            // Should have called loading state callbacks
            expect(onLoadingStateChangeSpy).toHaveBeenCalledWith(true);
            expect(onLoadingStateChangeSpy).toHaveBeenCalledWith(false);
        });
    });

    describe('Text-Only Fallback Mode', () => {
        test('should show text-only mode with appropriate descriptions', () => {
            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager
            });

            renderer.forceFallbackMode();

            // Load a page to trigger text-only display
            renderer.loadModelForPage(1); // Desert planet page

            expect(container.innerHTML).toContain('3D MODEL DESCRIPTION');
            expect(container.innerHTML).toContain('Desert Planet');
            expect(container.innerHTML).toContain('barren world rich in radioactive minerals');
        });

        test('should provide different descriptions for each page', () => {
            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager
            });

            renderer.forceFallbackMode();

            // Test different pages
            const pageDescriptions = [
                'Korenthi Empire Emblem',
                'Desert Planet',
                'Mining Terrain',
                'Energy Lords Emblem',
                'Parasitic Organisms',
                'Orbital Mining System'
            ];

            pageDescriptions.forEach((expectedText, pageIndex) => {
                renderer.loadModelForPage(pageIndex);
                expect(container.innerHTML).toContain(expectedText);
            });
        });
    });

    describe('Cleanup and Disposal', () => {
        test('should handle disposal errors gracefully', () => {
            const mockEngine = { 
                dispose: jest.fn(() => { throw new Error('Disposal error'); }),
                stopRenderLoop: jest.fn()
            };
            const mockScene = { 
                dispose: jest.fn(() => { throw new Error('Scene disposal error'); })
            };

            const { Engine, Scene } = require('@babylonjs/core');
            Engine.mockReturnValue(mockEngine);
            Scene.mockReturnValue(mockScene);

            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager
            });

            // Should not throw despite disposal errors
            expect(() => renderer.dispose()).not.toThrow();

            const status = renderer.getStatus();
            expect(status.isInitialized).toBe(false);
        });

        test('should clear caches on disposal', () => {
            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager
            });

            // Add items to cache
            const mockModel = { dispose: jest.fn(), isDisposed: () => false };
            (renderer as any).modelCache.set('test', mockModel);

            renderer.dispose();

            expect(mockModel.dispose).toHaveBeenCalled();
            
            const cacheStats = renderer.getCacheStatistics();
            expect(cacheStats.modelCacheSize).toBe(0);
        });
    });

    describe('Recovery Mechanisms', () => {
        test('should attempt recovery from error state', () => {
            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager
            });

            // Force error state
            renderer.forceFallbackMode();
            expect(renderer.isInFallbackMode()).toBe(true);

            // Attempt recovery
            const recovered = renderer.attemptRecovery();
            
            // Recovery success depends on WebGL support
            const status = renderer.getStatus();
            if (status.hasWebGLSupport) {
                expect(recovered).toBe(true);
            } else {
                expect(recovered).toBe(false);
            }
        });
    });

    describe('Error State Tracking', () => {
        test('should track error count and retry attempts', async () => {
            const renderer = new IntroductionModelRenderer({
                container,
                materialManager: mockMaterialManager
            });

            // Mock failing component
            const mockEmblemGeometry = {
                createEmpireEmblem: jest.fn(() => {
                    throw new Error('Persistent failure');
                }),
                dispose: jest.fn()
            };
            (renderer as any).emblemGeometry = mockEmblemGeometry;

            await renderer.loadModelForPage(0);

            const errorState = renderer.getErrorState();
            expect(errorState.errorCount).toBeGreaterThan(0);
            expect(errorState.lastError).toBeTruthy();
        });
    });
});