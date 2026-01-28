/**
 * IntroductionModels - 3D model creation facade for introduction screens
 *
 * Coordinates model creation by delegating to specialized model modules.
 * This facade maintains backward compatibility while keeping modules focused.
 *
 * Requirements: 9.3-9.5 - Model creation for introduction pages
 */

import { AbstractMesh, MeshBuilder, Color3 } from '@babylonjs/core';

// Re-export types from shared module
export type { ModelType, ModelConfig, ModelCreationContext } from './IntroductionModelTypes';
export { createOptimizedMaterial, getCachedMaterial } from './IntroductionModelTypes';

import type { ModelType, ModelCreationContext } from './IntroductionModelTypes';
import { createOptimizedMaterial } from './IntroductionModelTypes';

// Import from specialized model modules
import { createEmpireEmblem, createEnergyLordsEmblem } from './IntroductionEmblemModels';
import { createDesertPlanet, createTerrainCloseup, createOrbitalSystem } from './IntroductionPlanetModels';
import { createParasites, createProtector } from './IntroductionCreatureModels';
import { createRadiationSign } from './IntroductionSignModels';

// Re-export all model creation functions for backward compatibility
export {
    createEmpireEmblem,
    createEnergyLordsEmblem,
    createDesertPlanet,
    createTerrainCloseup,
    createOrbitalSystem,
    createParasites,
    createProtector,
    createRadiationSign
};

/**
 * Create model by type - main entry point for model creation
 * Delegates to appropriate specialized module based on model type
 */
export async function createModelByType(
    modelType: ModelType,
    context: ModelCreationContext,
    pageIndex: number
): Promise<AbstractMesh | null> {
    switch (modelType) {
        case 'empire-emblem':
            return createEmpireEmblem(context);
        case 'desert-planet':
            return createDesertPlanet(context);
        case 'terrain-closeup':
            return createTerrainCloseup(context);
        case 'radiation-sign':
            return createRadiationSign(context);
        case 'energy-lords-emblem':
            return createEnergyLordsEmblem(context);
        case 'parasites':
            return createParasites(context);
        case 'orbital-system':
            return createOrbitalSystem(context);
        case 'protector':
            return createProtector(context);
        default:
            console.warn(`Unknown model type: ${modelType}`);
            return null;
    }
}

/**
 * Create placeholder model for loading failures
 */
export function createPlaceholder(context: ModelCreationContext, text: string): AbstractMesh {
    const { scene } = context;

    const placeholder = MeshBuilder.CreateBox('placeholder', { size: 2 }, scene);

    const material = createOptimizedMaterial(context, 'placeholderMaterial',
        new Color3(0.3, 0.3, 0.3), {
            emissive: new Color3(0.1, 0.1, 0.1)
        });
    placeholder.material = material;

    return placeholder;
}
