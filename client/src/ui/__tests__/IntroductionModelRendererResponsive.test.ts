/**
 * IntroductionModelRenderer Responsive Design Tests
 * 
 * Tests for task 22: Responsive design behavior on various screen sizes
 * - Mobile device compatibility
 * - Tablet and desktop layouts
 * - Container resize handling
 * - Viewport adaptation
 * 
 * Requirements: 9.7 - Responsive design that collapses model area on mobile devices
 */

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

describe('IntroductionModelRenderer Responsive Design Tests', () => {
    let mockMaterialManager: any;
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
        // Store original viewport dimensions
        originalInnerWidth = window.innerWidth;
        originalInnerHeight = window.innerHeight;

        // Mock MaterialManager
        const { MaterialManager } = require('../../rendering/MaterialManager');
        mockMaterialManager = new MaterialManager();

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
        // Restore original viewport dimensions
        Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
        Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
        
        jest.restoreAllMocks();
    });

    describe('Mobile Device Compatibility', () => {
        test('should handle iPhone SE dimensions (375x667)', () => {
            Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });

            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '300px'; // Shorter for mobile
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                expect(renderer.isInitialized()).toBe(true);
                
                // Should create canvas with fixed dimensions
                const canvas = container.querySelector('canvas');
                expect(canvas?.width).toBe(300);
                expect(canvas?.height).toBe(400);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });

        test('should handle iPhone 12 dimensions (390x844)', () => {
            Object.defineProperty(window, 'innerWidth', { value: 390, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 844, writable: true });

            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '350px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                expect(renderer.isInitialized()).toBe(true);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });

        test('should handle mobile landscape orientation', () => {
            Object.defineProperty(window, 'innerWidth', { value: 667, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 375, writable: true });

            const container = document.createElement('div');
            container.style.width = '250px';
            container.style.height = '200px'; // Shorter for landscape
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                expect(renderer.isInitialized()).toBe(true);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });

        test('should handle Android device dimensions (360x640)', () => {
            Object.defineProperty(window, 'innerWidth', { value: 360, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 640, writable: true });

            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '300px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                expect(renderer.isInitialized()).toBe(true);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });
    });

    describe('Tablet Device Compatibility', () => {
        test('should handle iPad dimensions (768x1024)', () => {
            Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 1024, writable: true });

            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '400px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                expect(renderer.isInitialized()).toBe(true);
                
                // Should maintain full functionality on tablet
                const canvas = container.querySelector('canvas');
                expect(canvas?.width).toBe(300);
                expect(canvas?.height).toBe(400);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });

        test('should handle iPad Pro dimensions (1024x1366)', () => {
            Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 1366, writable: true });

            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '400px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                expect(renderer.isInitialized()).toBe(true);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });

        test('should handle tablet landscape orientation', () => {
            Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '400px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                expect(renderer.isInitialized()).toBe(true);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });
    });

    describe('Desktop Compatibility', () => {
        test('should handle standard desktop dimensions (1920x1080)', () => {
            Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '400px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                expect(renderer.isInitialized()).toBe(true);
                
                // Should have full functionality on desktop
                const canvas = container.querySelector('canvas');
                expect(canvas?.width).toBe(300);
                expect(canvas?.height).toBe(400);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });

        test('should handle 4K desktop dimensions (3840x2160)', () => {
            Object.defineProperty(window, 'innerWidth', { value: 3840, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 2160, writable: true });

            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '400px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                expect(renderer.isInitialized()).toBe(true);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });

        test('should handle ultrawide desktop dimensions (2560x1080)', () => {
            Object.defineProperty(window, 'innerWidth', { value: 2560, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '400px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                expect(renderer.isInitialized()).toBe(true);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });
    });

    describe('Container Resize Handling', () => {
        test('should handle container size changes', () => {
            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '400px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                expect(renderer.isInitialized()).toBe(true);
                
                // Change container size
                container.style.width = '400px';
                container.style.height = '500px';
                
                // Trigger resize event
                const resizeEvent = new Event('resize');
                window.dispatchEvent(resizeEvent);
                
                // Should still be functional
                expect(renderer.isInitialized()).toBe(true);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });

        test('should handle multiple rapid resize events', () => {
            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '400px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                expect(renderer.isInitialized()).toBe(true);
                
                // Simulate rapid resize events
                for (let i = 0; i < 10; i++) {
                    const resizeEvent = new Event('resize');
                    window.dispatchEvent(resizeEvent);
                }
                
                // Should handle rapid resizes gracefully
                expect(renderer.isInitialized()).toBe(true);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });

        test('should handle extreme container dimensions', () => {
            const testCases = [
                { width: '100px', height: '100px' },   // Very small
                { width: '50px', height: '50px' },     // Extremely small
                { width: '800px', height: '600px' },   // Large
                { width: '1000px', height: '800px' }   // Very large
            ];

            testCases.forEach(({ width, height }) => {
                const container = document.createElement('div');
                container.style.width = width;
                container.style.height = height;
                document.body.appendChild(container);

                try {
                    const config: IntroductionModelRendererConfig = {
                        container,
                        materialManager: mockMaterialManager,
                        enableFallbacks: true
                    };

                    const renderer = new IntroductionModelRenderer(config);
                    
                    // Should handle extreme dimensions gracefully
                    expect(renderer.isInitialized()).toBe(true);
                    
                    renderer.dispose();
                } finally {
                    document.body.removeChild(container);
                }
            });
        });
    });

    describe('Viewport Adaptation', () => {
        test('should adapt to orientation changes', async () => {
            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '400px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                // Portrait orientation
                Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
                Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });
                
                await renderer.loadModelForPage(0);
                expect(renderer.getCurrentModel()).toBeTruthy();
                
                // Landscape orientation
                Object.defineProperty(window, 'innerWidth', { value: 667, writable: true });
                Object.defineProperty(window, 'innerHeight', { value: 375, writable: true });
                
                const resizeEvent = new Event('resize');
                window.dispatchEvent(resizeEvent);
                
                // Should maintain functionality
                expect(renderer.isInitialized()).toBe(true);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });

        test('should handle zoom level changes', () => {
            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '400px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                // Simulate zoom changes by changing viewport dimensions
                const zoomLevels = [
                    { width: 1920, height: 1080 }, // 100%
                    { width: 1536, height: 864 },  // 125%
                    { width: 1280, height: 720 },  // 150%
                    { width: 960, height: 540 }    // 200%
                ];

                zoomLevels.forEach(({ width, height }) => {
                    Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
                    Object.defineProperty(window, 'innerHeight', { value: height, writable: true });
                    
                    const resizeEvent = new Event('resize');
                    window.dispatchEvent(resizeEvent);
                    
                    expect(renderer.isInitialized()).toBe(true);
                });
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });

        test('should maintain aspect ratio across different viewports', async () => {
            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '400px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                await renderer.loadModelForPage(1); // Desert planet
                
                const viewports = [
                    { width: 320, height: 568 },   // iPhone SE
                    { width: 768, height: 1024 },  // iPad
                    { width: 1920, height: 1080 }  // Desktop
                ];

                viewports.forEach(({ width, height }) => {
                    Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
                    Object.defineProperty(window, 'innerHeight', { value: height, writable: true });
                    
                    const resizeEvent = new Event('resize');
                    window.dispatchEvent(resizeEvent);
                    
                    // Canvas should maintain fixed dimensions
                    const canvas = container.querySelector('canvas');
                    expect(canvas?.width).toBe(300);
                    expect(canvas?.height).toBe(400);
                });
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });
    });

    describe('Performance Across Screen Sizes', () => {
        test('should maintain performance on mobile devices', async () => {
            Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });

            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '300px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                await renderer.loadModelForPage(0);
                
                const metrics = renderer.getPerformanceMetrics();
                expect(metrics?.fps).toBeGreaterThanOrEqual(30); // Lower threshold for mobile
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });

        test('should optimize for high-DPI displays', () => {
            Object.defineProperty(window, 'devicePixelRatio', { value: 2, writable: true });
            Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '400px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                expect(renderer.isInitialized()).toBe(true);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
                Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });
            }
        });

        test('should handle low-end device constraints', () => {
            // Mock low-end device conditions
            Object.defineProperty(performance, 'memory', {
                value: {
                    usedJSHeapSize: 400 * 1024 * 1024, // 400MB
                    totalJSHeapSize: 450 * 1024 * 1024, // 450MB
                    jsHeapSizeLimit: 500 * 1024 * 1024 // 500MB (low-end device)
                },
                configurable: true
            });

            Object.defineProperty(window, 'innerWidth', { value: 360, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 640, writable: true });

            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '300px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                const status = renderer.getStatus();
                
                // Should detect memory constraints and enable low performance mode
                expect(status.hasMemoryConstraints).toBe(true);
                expect(status.isLowPerformanceMode).toBe(true);
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });
    });

    describe('Accessibility and Usability', () => {
        test('should maintain accessibility across screen sizes', () => {
            const screenSizes = [
                { width: 320, height: 568, name: 'Small mobile' },
                { width: 768, height: 1024, name: 'Tablet' },
                { width: 1920, height: 1080, name: 'Desktop' }
            ];

            screenSizes.forEach(({ width, height, name }) => {
                Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
                Object.defineProperty(window, 'innerHeight', { value: height, writable: true });

                const container = document.createElement('div');
                container.style.width = '300px';
                container.style.height = '400px';
                document.body.appendChild(container);

                try {
                    const config: IntroductionModelRendererConfig = {
                        container,
                        materialManager: mockMaterialManager,
                        enableFallbacks: true
                    };

                    const renderer = new IntroductionModelRenderer(config);
                    
                    // Should be accessible on all screen sizes
                    expect(renderer.isInitialized()).toBe(true);
                    
                    // Canvas should be properly sized
                    const canvas = container.querySelector('canvas');
                    expect(canvas).toBeTruthy();
                    
                    renderer.dispose();
                } finally {
                    document.body.removeChild(container);
                }
            });
        });

        test('should handle touch interactions on mobile', async () => {
            Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });

            const container = document.createElement('div');
            container.style.width = '300px';
            container.style.height = '400px';
            document.body.appendChild(container);

            try {
                const config: IntroductionModelRendererConfig = {
                    container,
                    materialManager: mockMaterialManager,
                    enableFallbacks: true
                };

                const renderer = new IntroductionModelRenderer(config);
                
                await renderer.loadModelForPage(0);
                
                // Should handle touch events gracefully
                const canvas = container.querySelector('canvas');
                expect(canvas).toBeTruthy();
                
                // Simulate touch events
                const touchEvent = new TouchEvent('touchstart', {
                    touches: [new Touch({
                        identifier: 0,
                        target: canvas!,
                        clientX: 150,
                        clientY: 200
                    })]
                });
                
                expect(() => {
                    canvas?.dispatchEvent(touchEvent);
                }).not.toThrow();
                
                renderer.dispose();
            } finally {
                document.body.removeChild(container);
            }
        });
    });
});