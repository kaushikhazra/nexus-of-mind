/**
 * Building Placement Module - Barrel exports
 */

// Interfaces and types
export type {
    BuildingType,
    MiningAnalysis,
    BuildingPlacementConfig,
    BuildingCosts
} from './BuildingPlacementInterfaces';

export {
    DEFAULT_BUILDING_COSTS,
    PLACEMENT_CONSTANTS
} from './BuildingPlacementInterfaces';

// Modules
export { BuildingPreviewManager } from './BuildingPreviewManager';
export { MiningRangeVisualizer } from './MiningRangeVisualizer';
export { BuildingPlacementValidator } from './BuildingPlacementValidator';
export { BuildingSpawner } from './BuildingSpawner';

// Main UI
export { BuildingPlacementUI } from './BuildingPlacementUI';
