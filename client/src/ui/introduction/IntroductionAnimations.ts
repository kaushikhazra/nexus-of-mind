/**
 * IntroductionAnimations - Animation systems for introduction models
 *
 * Handles rotation animations, pulsing effects, and other visual animations.
 * Extracted from IntroductionModelRenderer.ts for SOLID compliance.
 *
 * Requirements: 9.3 - Model animation with slow rotation (~0.5 RPM)
 */

import {
    AbstractMesh,
    Animation,
    AnimationGroup,
    Scene,
    Vector3
} from '@babylonjs/core';

// ==================== Types ====================

export interface ModelAnimation {
    rotationSpeed: number;
    additionalEffects?: 'pulsing' | 'writhing' | 'orbital' | 'mining-beam';
}

export interface AnimationContext {
    scene: Scene;
    animationGroup: AnimationGroup | null;
}

// ==================== Animation Creation ====================

/**
 * Create a rotation animation for a mesh
 * Requirements: 9.3 - Slow rotation at approximately 0.5 RPM
 */
export function createRotationAnimation(rotationSpeedRPM: number): Animation {
    const rotationAnimation = new Animation(
        'modelRotation',
        'rotation.y',
        30, // 30 FPS animation
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_RELATIVE
    );

    // Calculate rotation per cycle: RPM to radians per second
    // At 0.5 RPM, we want 0.5 * 2π radians per 60 seconds = π/60 radians per second
    const radiansPerSecond = (rotationSpeedRPM * 2 * Math.PI) / 60;

    // Animation runs for 30 frames (1 second), then loops and ADDS to current rotation
    const keys = [
        { frame: 0, value: 0 },
        { frame: 30, value: radiansPerSecond }
    ];

    rotationAnimation.setKeys(keys);

    return rotationAnimation;
}

/**
 * Create a pulsing scale animation for emblems
 */
export function createPulsingAnimation(): Animation {
    const pulseAnimation = new Animation(
        'modelPulse',
        'scaling',
        30,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CYCLE
    );

    const keys = [
        { frame: 0, value: new Vector3(1, 1, 1) },
        { frame: 30, value: new Vector3(1.1, 1.1, 1.1) },
        { frame: 60, value: new Vector3(1, 1, 1) }
    ];

    pulseAnimation.setKeys(keys);

    return pulseAnimation;
}

/**
 * Create a writhing animation for organic models
 */
export function createWrithingAnimation(): Animation {
    const writheAnimation = new Animation(
        'modelWrithe',
        'scaling',
        30,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CYCLE
    );

    const keys = [
        { frame: 0, value: new Vector3(1, 1, 1) },
        { frame: 15, value: new Vector3(1.05, 0.95, 1.02) },
        { frame: 30, value: new Vector3(0.98, 1.03, 0.99) },
        { frame: 45, value: new Vector3(1.02, 0.97, 1.01) },
        { frame: 60, value: new Vector3(1, 1, 1) }
    ];

    writheAnimation.setKeys(keys);

    return writheAnimation;
}

// ==================== Animation Group Management ====================

/**
 * Create an animation group for a model
 */
export function createAnimationGroup(scene: Scene, name: string = 'modelAnimationGroup'): AnimationGroup {
    return new AnimationGroup(name, scene);
}

/**
 * Setup model animation with rotation and optional effects
 * Requirements: 9.3 - Model animation with slow rotation
 */
export function setupModelAnimation(
    model: AbstractMesh,
    animationConfig: ModelAnimation,
    scene: Scene
): AnimationGroup {
    const animationGroup = createAnimationGroup(scene);

    // Add rotation animation
    const rotationAnimation = createRotationAnimation(animationConfig.rotationSpeed);
    animationGroup.addTargetedAnimation(rotationAnimation, model);

    // Add additional effects if specified
    if (animationConfig.additionalEffects) {
        addAdditionalEffects(model, animationConfig.additionalEffects, animationGroup);
    }

    return animationGroup;
}

/**
 * Add additional visual effects to models
 * Requirements: 9.3 - Additional effects for specific model types
 */
export function addAdditionalEffects(
    model: AbstractMesh,
    effectType: ModelAnimation['additionalEffects'],
    animationGroup: AnimationGroup
): void {
    switch (effectType) {
        case 'pulsing':
            addPulsingEffect(model, animationGroup);
            break;
        case 'writhing':
            addWrithingEffect(model, animationGroup);
            break;
        case 'orbital':
            // Orbital effects handled by orbital system model
            break;
        case 'mining-beam':
            // Mining beam effects handled by orbital system model
            break;
    }
}

/**
 * Add pulsing effect for emblems
 */
export function addPulsingEffect(model: AbstractMesh, animationGroup: AnimationGroup): void {
    const pulseAnimation = createPulsingAnimation();
    animationGroup.addTargetedAnimation(pulseAnimation, model);
}

/**
 * Add writhing effect for organic models
 */
export function addWrithingEffect(model: AbstractMesh, animationGroup: AnimationGroup): void {
    const writheAnimation = createWrithingAnimation();
    animationGroup.addTargetedAnimation(writheAnimation, model);
}

// ==================== Animation Control ====================

/**
 * Start an animation group (looping)
 */
export function startAnimation(animationGroup: AnimationGroup | null): void {
    if (animationGroup) {
        animationGroup.start(true); // Loop animation
    }
}

/**
 * Stop an animation group
 */
export function stopAnimation(animationGroup: AnimationGroup | null): void {
    if (animationGroup) {
        animationGroup.stop();
    }
}

/**
 * Dispose an animation group
 */
export function disposeAnimationGroup(animationGroup: AnimationGroup | null): void {
    if (animationGroup) {
        animationGroup.dispose();
    }
}

// ==================== Animation Presets ====================

/**
 * Default animation configurations for different model types
 */
export const ANIMATION_PRESETS: Record<string, ModelAnimation> = {
    'empire-emblem': { rotationSpeed: 0.5, additionalEffects: 'pulsing' },
    'desert-planet': { rotationSpeed: 0.3 },
    'terrain-closeup': { rotationSpeed: 0.2 },
    'radiation-sign': { rotationSpeed: 0.4, additionalEffects: 'pulsing' },
    'energy-lords-emblem': { rotationSpeed: 0.5, additionalEffects: 'pulsing' },
    'parasites': { rotationSpeed: 0.3, additionalEffects: 'writhing' },
    'orbital-system': { rotationSpeed: 0.2, additionalEffects: 'orbital' },
    'default': { rotationSpeed: 0.2 }
};

/**
 * Get animation preset for a model type
 */
export function getAnimationPreset(modelType: string): ModelAnimation {
    return ANIMATION_PRESETS[modelType] || ANIMATION_PRESETS['default'];
}
