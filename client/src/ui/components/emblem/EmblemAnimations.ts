/**
 * EmblemAnimations - Animation effects for emblems
 *
 * Handles pulsing, rotation, and other animation effects for emblems.
 * Extracted from EmblemGeometry.ts for SOLID compliance.
 */

import { AbstractMesh, Animation, Vector3, SineEase, EasingFunction } from '@babylonjs/core';

/**
 * Animation configuration
 */
export interface AnimationConfig {
    frameRate: number;
    cycleDuration: number;
    minScale: number;
    maxScale: number;
}

/**
 * Default animation configuration
 */
export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
    frameRate: 30,
    cycleDuration: 2.0,
    minScale: 1.0,
    maxScale: 1.15
};

/**
 * Add pulsing animation effects for emblems
 */
export function addPulsingAnimation(emblem: AbstractMesh, speed: number = 1.0): Animation {
    const config = DEFAULT_ANIMATION_CONFIG;

    const pulseAnimation = new Animation(
        'emblemPulse',
        'scaling',
        config.frameRate,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CYCLE
    );

    const cycleDuration = config.cycleDuration / speed;
    const totalFrames = config.frameRate * cycleDuration;

    const keys = [
        { frame: 0, value: new Vector3(config.minScale, config.minScale, config.minScale) },
        { frame: totalFrames * 0.5, value: new Vector3(config.maxScale, config.maxScale, config.maxScale) },
        { frame: totalFrames, value: new Vector3(config.minScale, config.minScale, config.minScale) }
    ];

    pulseAnimation.setKeys(keys);

    const easingFunction = new SineEase();
    easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    pulseAnimation.setEasingFunction(easingFunction);

    emblem.animations.push(pulseAnimation);

    return pulseAnimation;
}

/**
 * Add rotation animation for emblem elements
 */
export function addRotationAnimation(emblem: AbstractMesh, axis: 'x' | 'y' | 'z' = 'y', speed: number = 1.0): Animation {
    const rotationProperty = `rotation.${axis}`;

    const rotateAnimation = new Animation(
        `emblemRotate_${axis}`,
        rotationProperty,
        30,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CYCLE
    );

    const cycleDuration = 10.0 / speed;
    const totalFrames = 30 * cycleDuration;

    const keys = [
        { frame: 0, value: 0 },
        { frame: totalFrames, value: Math.PI * 2 }
    ];

    rotateAnimation.setKeys(keys);
    emblem.animations.push(rotateAnimation);

    return rotateAnimation;
}

/**
 * Add glow intensity animation
 */
export function addGlowAnimation(emblem: AbstractMesh, minIntensity: number = 0.3, maxIntensity: number = 1.0): Animation {
    const glowAnimation = new Animation(
        'emblemGlow',
        'material.emissiveColor',
        30,
        Animation.ANIMATIONTYPE_COLOR3,
        Animation.ANIMATIONLOOPMODE_CYCLE
    );

    // This animation will be applied to materials with emissive color
    // Actual implementation depends on material system
    emblem.animations.push(glowAnimation);

    return glowAnimation;
}

/**
 * Add hover/bob animation for floating effect
 */
export function addHoverAnimation(emblem: AbstractMesh, amplitude: number = 0.1, speed: number = 1.0): Animation {
    const hoverAnimation = new Animation(
        'emblemHover',
        'position.y',
        30,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CYCLE
    );

    const baseY = emblem.position.y;
    const cycleDuration = 3.0 / speed;
    const totalFrames = 30 * cycleDuration;

    const keys = [
        { frame: 0, value: baseY },
        { frame: totalFrames * 0.5, value: baseY + amplitude },
        { frame: totalFrames, value: baseY }
    ];

    hoverAnimation.setKeys(keys);

    const easingFunction = new SineEase();
    easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    hoverAnimation.setEasingFunction(easingFunction);

    emblem.animations.push(hoverAnimation);

    return hoverAnimation;
}

/**
 * Create combined animation set for emblems
 */
export function createEmblemAnimationSet(emblem: AbstractMesh, options: {
    pulse?: boolean;
    rotate?: boolean;
    hover?: boolean;
    speed?: number;
}): Animation[] {
    const animations: Animation[] = [];
    const speed = options.speed || 1.0;

    if (options.pulse !== false) {
        animations.push(addPulsingAnimation(emblem, speed));
    }

    if (options.rotate) {
        animations.push(addRotationAnimation(emblem, 'y', speed * 0.5));
    }

    if (options.hover) {
        animations.push(addHoverAnimation(emblem, 0.1, speed));
    }

    return animations;
}
