/**
 * IntroductionModelTypes - Shared types for introduction model creation
 *
 * Contains type definitions and material helpers used across all model modules.
 * Extracted from IntroductionModels.ts for SOLID compliance.
 *
 * Requirements: 9.3-9.5 - Shared types for model creation
 */

import {
    Scene,
    Color3,
    StandardMaterial,
    Material,
    Vector3
} from '@babylonjs/core';
import { MaterialManager } from '../../rendering/MaterialManager';

// Import specialized renderers
import { EmblemGeometry } from '../components/EmblemGeometry';
import { PlanetRenderer } from '../components/PlanetRenderer';
import { ParasiteRenderer } from '../components/ParasiteRenderer';
import { TerrainRenderer } from '../components/TerrainRenderer';

// ==================== Types ====================

export type ModelType =
    | 'empire-emblem'
    | 'desert-planet'
    | 'terrain-closeup'
    | 'radiation-sign'
    | 'energy-lords-emblem'
    | 'parasites'
    | 'orbital-system'
    | 'protector';

export interface ModelConfig {
    modelType: ModelType;
    scale?: number;
    position?: Vector3;
}

export interface ModelCreationContext {
    scene: Scene;
    materialManager: MaterialManager | null;
    isLowPerformanceMode: boolean;
    materialCache: Map<string, Material>;
    // Specialized renderers
    emblemGeometry?: EmblemGeometry;
    planetRenderer?: PlanetRenderer;
    parasiteRenderer?: ParasiteRenderer;
    terrainRenderer?: TerrainRenderer;
}

// ==================== Material Helpers ====================

/**
 * Get or create a cached material
 */
export function getCachedMaterial(
    context: ModelCreationContext,
    key: string,
    createFn: () => Material
): Material {
    if (context.materialCache.has(key)) {
        return context.materialCache.get(key)!;
    }
    const material = createFn();
    context.materialCache.set(key, material);
    return material;
}

/**
 * Create an optimized standard material
 */
export function createOptimizedMaterial(
    context: ModelCreationContext,
    name: string,
    color: Color3,
    options: { emissive?: Color3; specular?: Color3; alpha?: number } = {}
): Material {
    return getCachedMaterial(context, name, () => {
        if (context.materialManager) {
            return context.materialManager.createCustomMaterial(name, color, options);
        }

        const material = new StandardMaterial(name, context.scene);
        material.diffuseColor = color;
        material.emissiveColor = options.emissive || new Color3(0, 0, 0);
        material.specularColor = options.specular || new Color3(0.2, 0.2, 0.2);
        if (options.alpha !== undefined) {
            material.alpha = options.alpha;
        }
        material.freeze();
        return material;
    });
}
