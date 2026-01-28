/**
 * BuildingRenderer - Re-export from refactored module location
 *
 * This file re-exports the BuildingRenderer from its new modular location
 * for backwards compatibility with existing imports.
 */

export { BuildingRenderer } from './building/BuildingRenderer';

export type {
    BuildingVisual,
    BuildingMeshResult,
    BuildingConfig,
    BuildingRenderingStats
} from './building/BuildingRendererInterfaces';
