/**
 * IntroductionScene - Scene setup and management for introduction renderer
 *
 * Handles Babylon.js scene creation, camera setup, lighting, and post-processing.
 * Extracted from IntroductionModelRenderer.ts for SOLID compliance.
 *
 * Requirements: 9.1-9.3 - 3D scene setup with appropriate camera and lighting
 */

import {
    Scene,
    Engine,
    ArcRotateCamera,
    HemisphericLight,
    DirectionalLight,
    Vector3,
    Color3,
    Color4,
    DefaultRenderingPipeline
} from '@babylonjs/core';

// ==================== Types ====================

export interface SceneConfig {
    clearColor?: Color4;
    ambientColor?: Color3;
}

export interface CameraConfig {
    alpha?: number;
    beta?: number;
    radius?: number;
    target?: Vector3;
    lowerRadiusLimit?: number;
    upperRadiusLimit?: number;
    wheelPrecision?: number;
    minZ?: number;
    maxZ?: number;
}

export interface LightingConfig {
    hemisphericIntensity?: number;
    hemisphericDirection?: Vector3;
    directionalIntensity?: number;
    directionalDirection?: Vector3;
    specularColor?: Color3;
}

export interface PostProcessingConfig {
    bloomEnabled?: boolean;
    bloomThreshold?: number;
    bloomWeight?: number;
    bloomKernel?: number;
    fxaaEnabled?: boolean;
    samples?: number;
}

export interface SceneComponents {
    scene: Scene;
    camera: ArcRotateCamera;
    hemisphericLight: HemisphericLight;
    directionalLight: DirectionalLight;
    renderingPipeline: DefaultRenderingPipeline | null;
}

// ==================== Default Configurations ====================

const DEFAULT_SCENE_CONFIG: SceneConfig = {
    clearColor: new Color4(0, 0, 0, 0),
    ambientColor: new Color3(0.1, 0.1, 0.15)
};

const DEFAULT_CAMERA_CONFIG: CameraConfig = {
    alpha: Math.PI / 2,
    beta: Math.PI / 2.5,
    radius: 8,
    target: Vector3.Zero(),
    lowerRadiusLimit: 5,
    upperRadiusLimit: 15,
    wheelPrecision: 100,
    minZ: 0.1,
    maxZ: 1000
};

const DEFAULT_LIGHTING_CONFIG: LightingConfig = {
    hemisphericIntensity: 0.7,
    hemisphericDirection: new Vector3(0, 1, 0),
    directionalIntensity: 0.5,
    directionalDirection: new Vector3(-1, -2, -1),
    specularColor: new Color3(0.2, 0.2, 0.3)
};

const DEFAULT_POST_PROCESSING_CONFIG: PostProcessingConfig = {
    bloomEnabled: true,
    bloomThreshold: 0.8,
    bloomWeight: 0.3,
    bloomKernel: 64,
    fxaaEnabled: true,
    samples: 4
};

// ==================== Scene Creation Functions ====================

/**
 * Create and configure the Babylon.js scene
 * Requirements: 9.1 - Scene setup with transparent background
 */
export function createScene(engine: Engine, config: SceneConfig = {}): Scene {
    const mergedConfig = { ...DEFAULT_SCENE_CONFIG, ...config };

    const scene = new Scene(engine);
    scene.clearColor = mergedConfig.clearColor!;
    scene.ambientColor = mergedConfig.ambientColor!;

    // Performance optimizations
    scene.autoClear = false;
    scene.autoClearDepthAndStencil = true;
    scene.blockMaterialDirtyMechanism = true;

    return scene;
}

/**
 * Setup and configure the arc rotate camera
 * Requirements: 9.2 - Camera setup for model viewing
 */
export function setupCamera(
    scene: Scene,
    canvas: HTMLCanvasElement,
    config: CameraConfig = {}
): ArcRotateCamera {
    const mergedConfig = { ...DEFAULT_CAMERA_CONFIG, ...config };

    const camera = new ArcRotateCamera(
        'introCamera',
        mergedConfig.alpha!,
        mergedConfig.beta!,
        mergedConfig.radius!,
        mergedConfig.target!,
        scene
    );

    // Camera limits
    camera.lowerRadiusLimit = mergedConfig.lowerRadiusLimit!;
    camera.upperRadiusLimit = mergedConfig.upperRadiusLimit!;
    camera.wheelPrecision = mergedConfig.wheelPrecision!;
    camera.minZ = mergedConfig.minZ!;
    camera.maxZ = mergedConfig.maxZ!;

    // Disable user controls (intro is automated)
    camera.attachControl(canvas, false);
    camera.inputs.clear();

    return camera;
}

/**
 * Setup scene lighting
 * Requirements: 9.2 - Appropriate lighting for model display
 */
export function setupLighting(
    scene: Scene,
    config: LightingConfig = {}
): { hemisphericLight: HemisphericLight; directionalLight: DirectionalLight } {
    const mergedConfig = { ...DEFAULT_LIGHTING_CONFIG, ...config };

    // Hemispheric light for ambient illumination
    const hemisphericLight = new HemisphericLight(
        'introHemiLight',
        mergedConfig.hemisphericDirection!,
        scene
    );
    hemisphericLight.intensity = mergedConfig.hemisphericIntensity!;
    hemisphericLight.specular = mergedConfig.specularColor!;

    // Directional light for shadows and depth
    const directionalLight = new DirectionalLight(
        'introDirLight',
        mergedConfig.directionalDirection!,
        scene
    );
    directionalLight.intensity = mergedConfig.directionalIntensity!;

    return { hemisphericLight, directionalLight };
}

/**
 * Setup post-processing effects
 * Requirements: 9.3 - Visual effects for enhanced presentation
 */
export function setupPostProcessing(
    scene: Scene,
    camera: ArcRotateCamera,
    config: PostProcessingConfig = {},
    isLowPerformanceMode: boolean = false
): DefaultRenderingPipeline | null {
    // Skip post-processing in low performance mode
    if (isLowPerformanceMode) {
        return null;
    }

    const mergedConfig = { ...DEFAULT_POST_PROCESSING_CONFIG, ...config };

    try {
        const pipeline = new DefaultRenderingPipeline(
            'introPipeline',
            true,
            scene,
            [camera]
        );

        // Bloom effect
        pipeline.bloomEnabled = mergedConfig.bloomEnabled!;
        pipeline.bloomThreshold = mergedConfig.bloomThreshold!;
        pipeline.bloomWeight = mergedConfig.bloomWeight!;
        pipeline.bloomKernel = mergedConfig.bloomKernel!;

        // Anti-aliasing
        pipeline.fxaaEnabled = mergedConfig.fxaaEnabled!;
        pipeline.samples = mergedConfig.samples!;

        return pipeline;
    } catch (error) {
        console.warn('Failed to create post-processing pipeline:', error);
        return null;
    }
}

/**
 * Start the render loop
 * Requirements: 9.6 - 60fps render loop
 */
export function startRenderLoop(engine: Engine, scene: Scene): void {
    engine.runRenderLoop(() => {
        if (scene && !scene.isDisposed) {
            scene.render();
        }
    });
}

/**
 * Create all scene components at once
 * Convenience function for full scene setup
 */
export function createSceneComponents(
    engine: Engine,
    canvas: HTMLCanvasElement,
    isLowPerformanceMode: boolean = false,
    sceneConfig?: SceneConfig,
    cameraConfig?: CameraConfig,
    lightingConfig?: LightingConfig,
    postProcessingConfig?: PostProcessingConfig
): SceneComponents {
    const scene = createScene(engine, sceneConfig);
    const camera = setupCamera(scene, canvas, cameraConfig);
    const { hemisphericLight, directionalLight } = setupLighting(scene, lightingConfig);
    const renderingPipeline = setupPostProcessing(scene, camera, postProcessingConfig, isLowPerformanceMode);

    return {
        scene,
        camera,
        hemisphericLight,
        directionalLight,
        renderingPipeline
    };
}

/**
 * Reduce post-processing quality for performance
 */
export function reducePostProcessingQuality(pipeline: DefaultRenderingPipeline | null): void {
    if (!pipeline) return;

    pipeline.bloomKernel = 32;
    pipeline.samples = 2;
    pipeline.fxaaEnabled = false;
}

/**
 * Disable post-processing effects
 */
export function disablePostProcessing(pipeline: DefaultRenderingPipeline | null): void {
    if (!pipeline) return;

    pipeline.bloomEnabled = false;
    pipeline.fxaaEnabled = false;
}

/**
 * Restore post-processing quality
 */
export function restorePostProcessingQuality(
    pipeline: DefaultRenderingPipeline | null,
    config: PostProcessingConfig = DEFAULT_POST_PROCESSING_CONFIG
): void {
    if (!pipeline) return;

    pipeline.bloomEnabled = config.bloomEnabled!;
    pipeline.bloomKernel = config.bloomKernel!;
    pipeline.samples = config.samples!;
    pipeline.fxaaEnabled = config.fxaaEnabled!;
}
