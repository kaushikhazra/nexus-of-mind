/**
 * BuildingPlacementUI - Re-export from refactored module location
 *
 * This file re-exports the BuildingPlacementUI from its new modular location
 * for backwards compatibility with existing imports.
 */

export { BuildingPlacementUI } from './building/BuildingPlacementUI';

export type {
    BuildingType,
    MiningAnalysis,
    BuildingPlacementConfig,
    BuildingCosts
} from './building/BuildingPlacementInterfaces';

export { DEFAULT_BUILDING_COSTS, PLACEMENT_CONSTANTS } from './building/BuildingPlacementInterfaces';
