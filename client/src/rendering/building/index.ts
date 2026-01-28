/**
 * BuildingRenderer module - Barrel exports
 *
 * Re-exports all public APIs from the building rendering system.
 */

export { BuildingRenderer } from './BuildingRenderer';
export { BuildingMaterials } from './BuildingMaterials';
export { BaseBuildingMeshFactory } from './BaseBuildingMeshFactory';
export { PowerPlantMeshFactory } from './PowerPlantMeshFactory';
export { BuildingAnimator } from './BuildingAnimator';

export type {
    BuildingVisual,
    BuildingMeshResult,
    BuildingConfig,
    BuildingRenderingStats
} from './BuildingRendererInterfaces';
