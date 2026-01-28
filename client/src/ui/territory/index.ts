/**
 * TerritoryVisualUI module - Barrel exports
 *
 * Re-exports all public APIs from the territory visual UI system.
 */

export { TerritoryVisualUI } from './TerritoryVisualUI';
export { TerritoryStatusDisplay } from './TerritoryStatusDisplay';
export { injectTerritoryUIStyles } from './TerritoryUIStyles';

export type {
    TerritoryVisualUIConfig,
    TerritoryDisplayInfo
} from './TerritoryVisualUIInterfaces';

export { DEFAULT_TERRITORY_UI_CONFIG } from './TerritoryVisualUIInterfaces';
