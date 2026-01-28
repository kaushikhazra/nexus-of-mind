/**
 * Introduction Module - Barrel exports
 *
 * Re-exports all introduction-related components for clean imports.
 */

// Scene setup and management
export {
    createScene,
    setupCamera,
    setupLighting,
    setupPostProcessing,
    startRenderLoop,
    createSceneComponents,
    reducePostProcessingQuality,
    disablePostProcessing,
    restorePostProcessingQuality
} from './IntroductionScene';

export type {
    SceneConfig,
    CameraConfig,
    LightingConfig,
    PostProcessingConfig,
    SceneComponents
} from './IntroductionScene';

// Model creation
export {
    createModelByType,
    createEmpireEmblem,
    createDesertPlanet,
    createTerrainCloseup,
    createRadiationSign,
    createEnergyLordsEmblem,
    createParasites,
    createOrbitalSystem,
    createPlaceholder
} from './IntroductionModels';

export type {
    ModelType,
    ModelConfig,
    ModelCreationContext
} from './IntroductionModels';

// Animation systems
export {
    createRotationAnimation,
    createPulsingAnimation,
    createWrithingAnimation,
    createAnimationGroup,
    setupModelAnimation,
    addAdditionalEffects,
    addPulsingEffect,
    addWrithingEffect,
    startAnimation,
    stopAnimation,
    disposeAnimationGroup,
    getAnimationPreset,
    ANIMATION_PRESETS
} from './IntroductionAnimations';

export type {
    ModelAnimation,
    AnimationContext
} from './IntroductionAnimations';

// Performance and effects
export {
    LODSystem,
    PerformanceMonitor
} from './IntroductionEffects';

export type {
    PerformanceMetrics,
    LODLevel
} from './IntroductionEffects';
