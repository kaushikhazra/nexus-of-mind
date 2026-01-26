/**
 * IntroductionModelRenderer Integration Test
 * 
 * Tests the integration between IntroductionScreen and IntroductionModelRenderer
 * to ensure model loading and cleanup work correctly.
 */

import { IntroductionScreen } from '../IntroductionScreen';

// Mock Babylon.js modules to avoid import issues in test environment
jest.mock('@babylonjs/core', () => ({
    Engine: jest.fn().mockImplementation(() => ({
        runRenderLoop: jest.fn(),
        resize: jest.fn(),
        stopRenderLoop: jest.fn(),
        dispose: jest.fn()
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
        dispose: jest.fn()
    })),
    ArcRotateCamera: jest.fn().mockImplementation(() => ({
        lowerBetaLimit: 0,
        upperBetaLimit: 0,
        lowerRadiusLimit: 0,
        upperRadiusLimit: 0,
        attachControl: jest.fn(),
        dispose: jest.fn()
    })),
    Vector3: {
        Zero: jest.fn(() => ({ x: 0, y: 0, z: 0 }))
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
    Animation: jest.fn().mockImplementation(() => ({
        setKeys: jest.fn()
    })),
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
            dispose: jest.fn()
        })),
        CreateSphere: jest.fn().mockImplementation(() => ({
            material: null,
            scaling: {},
            dispose: jest.fn()
        })),
        CreateGround: jest.fn().mockImplementation(() => ({
            material: null,
            dispose: jest.fn()
        })),
        CreateCylinder: jest.fn().mockImplementation(() => ({
            material: null,
            dispose: jest.fn()
        }))
    }
}));

// Mock MaterialManager
jest.mock('../rendering/MaterialManager', () => ({
    MaterialManager: jest.fn().mockImplementation(() => ({
        createCustomMaterial: jest.fn().mockReturnValue({
            dispose: jest.fn()
        }),
        dispose: jest.fn()
    }))
}));

// Mock IntroductionModelRenderer
jest.mock('../IntroductionModelRenderer', () => ({
    IntroductionModelRenderer: jest.fn().mockImplementation(() => ({
        loadModelForPage: jest.fn().mockResolvedValue(undefined),
        startAnimation: jest.fn(),
        stopAnimation: jest.fn(),
        dispose: jest.fn(),
        getCurrentModel: jest.fn().mockReturnValue(null),
        getCurrentPageIndex: jest.fn().mockReturnValue(-1),
        isInitialized: jest.fn().mockReturnValue(true),
        getEngine: jest.fn().mockReturnValue({}),
        getScene: jest.fn().mockReturnValue({})
    }))
}));

describe('IntroductionModelRenderer Integration', () => {
    let container: HTMLElement;
    let introScreen: IntroductionScreen;
    let mockOnComplete: jest.Mock;

    beforeEach(() => {
        // Set up DOM environment
        document.body.innerHTML = '';
        
        // Create container
        container = document.createElement('div');
        container.id = 'test-introduction-container';
        document.body.appendChild(container);

        // Mock window methods for responsive design
        Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
        Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
        Object.defineProperty(window, 'addEventListener', { value: jest.fn(), writable: true });
        Object.defineProperty(window, 'removeEventListener', { value: jest.fn(), writable: true });

        // Mock ResizeObserver
        global.ResizeObserver = jest.fn().mockImplementation(() => ({
            observe: jest.fn(),
            disconnect: jest.fn()
        }));

        // Create mock completion callback
        mockOnComplete = jest.fn();

        // Clear localStorage
        localStorage.clear();
    });

    afterEach(() => {
        if (introScreen) {
            introScreen.dispose();
        }
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    describe('Model Renderer Integration', () => {
        test('should initialize IntroductionModelRenderer when creating IntroductionScreen', () => {
            const { IntroductionModelRenderer } = require('../IntroductionModelRenderer');
            
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro'
            });

            // Should have created IntroductionModelRenderer instance
            expect(IntroductionModelRenderer).toHaveBeenCalled();
            
            // Should have model renderer in state
            const state = introScreen.getState();
            expect(state.modelRenderer).not.toBeNull();
            expect(state.isModelLoading).toBe(false);
            expect(state.currentModelType).toBeNull();
        });

        test('should provide access to model renderer instance', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro'
            });

            const modelRenderer = introScreen.getModelRenderer();
            expect(modelRenderer).not.toBeNull();
            expect(typeof modelRenderer?.loadModelForPage).toBe('function');
            expect(typeof modelRenderer?.dispose).toBe('function');
        });

        test('should provide model loading state access', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro'
            });

            // Initially not loading
            expect(introScreen.isModelLoading()).toBe(false);
            expect(introScreen.getCurrentModelType()).toBeNull();
        });

        test('should load model when displaying pages', async () => {
            const { IntroductionModelRenderer } = require('../IntroductionModelRenderer');
            
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro'
            });

            // Show the introduction screen (which displays first page)
            introScreen.show();

            // Wait for any async operations
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should have attempted to load model for page 0
            const mockInstance = IntroductionModelRenderer.mock.instances[0];
            expect(mockInstance.loadModelForPage).toHaveBeenCalledWith(0);
        });

        test('should dispose model renderer when IntroductionScreen is disposed', () => {
            const { IntroductionModelRenderer } = require('../IntroductionModelRenderer');
            
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro'
            });

            const mockInstance = IntroductionModelRenderer.mock.instances[0];

            // Dispose IntroductionScreen
            introScreen.dispose();

            // Should have disposed model renderer
            expect(mockInstance.dispose).toHaveBeenCalled();

            // State should be reset
            const state = introScreen.getState();
            expect(state.modelRenderer).toBeNull();
            expect(state.isModelLoading).toBe(false);
            expect(state.currentModelType).toBeNull();
        });

        test('should handle model renderer initialization errors gracefully', () => {
            const { IntroductionModelRenderer } = require('../IntroductionModelRenderer');
            
            // Mock IntroductionModelRenderer to throw error on construction
            IntroductionModelRenderer.mockImplementationOnce(() => {
                throw new Error('Failed to initialize 3D renderer');
            });

            // Should not throw error when creating IntroductionScreen
            expect(() => {
                introScreen = new IntroductionScreen({
                    containerId: 'test-introduction-container',
                    onComplete: mockOnComplete,
                    skipPreferenceKey: 'test-skip-intro'
                });
            }).not.toThrow();

            // Should have null model renderer in state
            const state = introScreen.getState();
            expect(state.modelRenderer).toBeNull();
        });

        test('should handle model loading errors gracefully', async () => {
            const { IntroductionModelRenderer } = require('../IntroductionModelRenderer');
            
            // Mock loadModelForPage to reject
            const mockLoadModelForPage = jest.fn().mockRejectedValue(new Error('Model loading failed'));
            IntroductionModelRenderer.mockImplementation(() => ({
                loadModelForPage: mockLoadModelForPage,
                startAnimation: jest.fn(),
                stopAnimation: jest.fn(),
                dispose: jest.fn(),
                getCurrentModel: jest.fn().mockReturnValue(null),
                getCurrentPageIndex: jest.fn().mockReturnValue(-1),
                isInitialized: jest.fn().mockReturnValue(true),
                getEngine: jest.fn().mockReturnValue({}),
                getScene: jest.fn().mockReturnValue({})
            }));

            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro'
            });

            // Show the introduction screen
            introScreen.show();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));

            // Should have attempted to load model but handled error gracefully
            expect(mockLoadModelForPage).toHaveBeenCalledWith(0);
            
            // Should not be in loading state after error
            expect(introScreen.isModelLoading()).toBe(false);
        });
    });

    describe('Model Area UI Integration', () => {
        test('should create model area in the UI', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro'
            });

            // Should have created model area
            const modelArea = container.querySelector('.introduction-model-area');
            expect(modelArea).not.toBeNull();
            expect(modelArea?.id).toBe('introduction-model-container');
        });

        test('should create dividing line between model and content areas', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro'
            });

            // Should have created dividing line
            const dividingLine = container.querySelector('.model-content-divider');
            expect(dividingLine).not.toBeNull();
        });

        test('should have proper layout structure with model and story areas', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro'
            });

            // Should have both model and story areas
            const modelArea = container.querySelector('.introduction-model-area');
            const storyArea = container.querySelector('.introduction-story-area');
            
            expect(modelArea).not.toBeNull();
            expect(storyArea).not.toBeNull();
            
            // Should be siblings in the page container
            const pageContainer = container.querySelector('.introduction-content');
            expect(pageContainer?.children).toContain(modelArea);
            expect(pageContainer?.children).toContain(storyArea);
        });
    });
});