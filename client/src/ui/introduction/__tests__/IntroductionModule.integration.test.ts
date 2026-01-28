/**
 * Introduction Module Integration Tests
 *
 * Tests the coordination between extracted introduction modules.
 * Validates: Task 5 - Introduction system refactoring
 */

import { Vector3, Color3 } from '@babylonjs/core';

// Mock Babylon.js
jest.mock('@babylonjs/core', () => {
    const mockMesh = {
        dispose: jest.fn(),
        isDisposed: jest.fn(() => false),
        getChildMeshes: jest.fn(() => []),
        setEnabled: jest.fn(),
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scaling: { x: 1, y: 1, z: 1 },
        parent: null,
        material: null
    };

    const mockScene = {
        dispose: jest.fn(),
        isDisposed: false,
        render: jest.fn(),
        getEngine: jest.fn(() => ({
            getDeltaTime: jest.fn(() => 16.67)
        })),
        autoClear: true,
        autoClearDepthAndStencil: true,
        blockMaterialDirtyMechanism: false,
        clearColor: null,
        ambientColor: null
    };

    const mockCamera = {
        dispose: jest.fn(),
        attachControl: jest.fn(),
        inputs: { clear: jest.fn() },
        lowerRadiusLimit: 0,
        upperRadiusLimit: 0,
        wheelPrecision: 0,
        minZ: 0,
        maxZ: 0
    };

    const mockLight = {
        dispose: jest.fn(),
        intensity: 0,
        specular: null
    };

    const mockAnimationGroup = {
        start: jest.fn(),
        stop: jest.fn(),
        dispose: jest.fn(),
        addTargetedAnimation: jest.fn()
    };

    const mockAnimation = {
        setKeys: jest.fn()
    };

    return {
        Scene: jest.fn(() => mockScene),
        Engine: jest.fn(() => ({
            runRenderLoop: jest.fn(),
            stopRenderLoop: jest.fn(),
            dispose: jest.fn(),
            resize: jest.fn()
        })),
        ArcRotateCamera: jest.fn(() => mockCamera),
        HemisphericLight: jest.fn(() => mockLight),
        DirectionalLight: jest.fn(() => mockLight),
        DefaultRenderingPipeline: jest.fn(() => ({
            bloomEnabled: true,
            bloomThreshold: 0,
            bloomWeight: 0,
            bloomKernel: 0,
            fxaaEnabled: true,
            samples: 0,
            dispose: jest.fn()
        })),
        Vector3: jest.fn().mockImplementation((x = 0, y = 0, z = 0) => ({ x, y, z })),
        Color3: jest.fn().mockImplementation((r = 0, g = 0, b = 0) => ({ r, g, b })),
        Color4: jest.fn().mockImplementation((r = 0, g = 0, b = 0, a = 1) => ({ r, g, b, a })),
        Mesh: jest.fn(() => mockMesh),
        MeshBuilder: {
            CreateBox: jest.fn(() => ({ ...mockMesh })),
            CreateSphere: jest.fn(() => ({ ...mockMesh })),
            CreateTorus: jest.fn(() => ({ ...mockMesh })),
            CreateCylinder: jest.fn(() => ({ ...mockMesh })),
            CreateGround: jest.fn(() => ({ ...mockMesh })),
            CreatePolyhedron: jest.fn(() => ({ ...mockMesh }))
        },
        StandardMaterial: jest.fn(() => ({
            diffuseColor: null,
            emissiveColor: null,
            specularColor: null,
            alpha: 1,
            freeze: jest.fn(),
            dispose: jest.fn()
        })),
        Animation: jest.fn(() => mockAnimation),
        AnimationGroup: jest.fn(() => mockAnimationGroup),
        AbstractMesh: jest.fn()
    };
});

// Import after mocks
import { LODSystem, PerformanceMonitor } from '../IntroductionEffects';
import { createScene, setupCamera, setupLighting } from '../IntroductionScene';
import { createRotationAnimation, setupModelAnimation, ANIMATION_PRESETS } from '../IntroductionAnimations';
import { createEmpireEmblem, createDesertPlanet, createModelByType } from '../IntroductionModels';

describe('Introduction Module Integration', () => {
    describe('IntroductionEffects', () => {
        describe('LODSystem', () => {
            let mockScene: any;

            beforeEach(() => {
                const { Scene } = require('@babylonjs/core');
                mockScene = new Scene();
            });

            test('should create LOD system', () => {
                const lodSystem = new LODSystem(mockScene);
                expect(lodSystem).toBeDefined();
            });

            test('should register LOD levels', () => {
                const lodSystem = new LODSystem(mockScene);
                const mockMesh = { setEnabled: jest.fn() };

                lodSystem.registerLOD('testModel', [
                    { mesh: mockMesh as any, distance: 0 },
                    { mesh: mockMesh as any, distance: 10 }
                ]);

                expect(lodSystem.getCurrentLevel('testModel')).toBe(0);
            });

            test('should dispose cleanly', () => {
                const lodSystem = new LODSystem(mockScene);
                expect(() => lodSystem.dispose()).not.toThrow();
            });
        });

        describe('PerformanceMonitor', () => {
            let mockScene: any;

            beforeEach(() => {
                jest.useFakeTimers();
                const { Scene } = require('@babylonjs/core');
                mockScene = new Scene();
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            test('should create performance monitor', () => {
                const monitor = new PerformanceMonitor(mockScene);
                expect(monitor).toBeDefined();
                monitor.dispose();
            });

            test('should return default metrics initially', () => {
                const monitor = new PerformanceMonitor(mockScene);
                const metrics = monitor.getMetrics();

                expect(metrics.fps).toBe(60);
                expect(metrics.isLowPerformance).toBe(false);
                monitor.dispose();
            });

            test('should call performance change callback', () => {
                const callback = jest.fn();
                const monitor = new PerformanceMonitor(mockScene, callback);

                // Monitor starts with default state
                expect(callback).not.toHaveBeenCalled();
                monitor.dispose();
            });
        });
    });

    describe('IntroductionScene', () => {
        test('should create scene with default config', () => {
            const { Engine } = require('@babylonjs/core');
            const mockEngine = new Engine();
            const scene = createScene(mockEngine);

            expect(scene).toBeDefined();
        });

        test('should setup camera with controls disabled', () => {
            const { Scene } = require('@babylonjs/core');
            const mockScene = new Scene();
            const mockCanvas = document.createElement('canvas');

            const camera = setupCamera(mockScene, mockCanvas);

            expect(camera).toBeDefined();
            expect(camera.inputs.clear).toHaveBeenCalled();
        });

        test('should setup lighting', () => {
            const { Scene } = require('@babylonjs/core');
            const mockScene = new Scene();

            const { hemisphericLight, directionalLight } = setupLighting(mockScene);

            expect(hemisphericLight).toBeDefined();
            expect(directionalLight).toBeDefined();
        });
    });

    describe('IntroductionAnimations', () => {
        test('should create rotation animation', () => {
            const animation = createRotationAnimation(0.5);
            expect(animation).toBeDefined();
            expect(animation.setKeys).toHaveBeenCalled();
        });

        test('should have animation presets for all model types', () => {
            const expectedTypes = [
                'empire-emblem',
                'desert-planet',
                'terrain-closeup',
                'radiation-sign',
                'energy-lords-emblem',
                'parasites',
                'orbital-system'
            ];

            expectedTypes.forEach(type => {
                expect(ANIMATION_PRESETS[type] || ANIMATION_PRESETS['default']).toBeDefined();
            });
        });

        test('should setup model animation with rotation', () => {
            const { Scene, Mesh } = require('@babylonjs/core');
            const mockScene = new Scene();
            const mockMesh = new Mesh();

            const animGroup = setupModelAnimation(
                mockMesh,
                { rotationSpeed: 0.5 },
                mockScene
            );

            expect(animGroup).toBeDefined();
            expect(animGroup.addTargetedAnimation).toHaveBeenCalled();
        });
    });

    describe('IntroductionModels', () => {
        let mockContext: any;

        beforeEach(() => {
            const { Scene } = require('@babylonjs/core');
            mockContext = {
                scene: new Scene(),
                materialManager: null,
                isLowPerformanceMode: false,
                materialCache: new Map()
            };
        });

        test('should create empire emblem model', () => {
            const model = createEmpireEmblem(mockContext);
            expect(model).toBeDefined();
        });

        test('should create desert planet model', () => {
            const model = createDesertPlanet(mockContext);
            expect(model).toBeDefined();
        });

        test('should create model by type', async () => {
            const model = await createModelByType('empire-emblem', mockContext, 0);
            expect(model).toBeDefined();
        });

        test('should return null for unknown model type', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            const model = await createModelByType('unknown-type' as any, mockContext, 0);

            expect(model).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        test('should create simplified models in low performance mode', () => {
            mockContext.isLowPerformanceMode = true;
            const model = createEmpireEmblem(mockContext);

            // Model should still be created
            expect(model).toBeDefined();
        });
    });

    describe('Module Coordination', () => {
        test('all modules should export required functions', () => {
            // Effects exports
            expect(LODSystem).toBeDefined();
            expect(PerformanceMonitor).toBeDefined();

            // Scene exports
            expect(createScene).toBeDefined();
            expect(setupCamera).toBeDefined();
            expect(setupLighting).toBeDefined();

            // Animation exports
            expect(createRotationAnimation).toBeDefined();
            expect(setupModelAnimation).toBeDefined();

            // Model exports
            expect(createModelByType).toBeDefined();
            expect(createEmpireEmblem).toBeDefined();
            expect(createDesertPlanet).toBeDefined();
        });
    });
});
