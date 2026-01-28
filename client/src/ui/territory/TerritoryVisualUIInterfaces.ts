/**
 * TerritoryVisualUIInterfaces - Type definitions for territory UI system
 *
 * Contains all interfaces for territory visual UI.
 */

import type { Territory } from '../../game/TerritoryManager';
import type { QueenPhase } from '../../game/entities/Queen';

export interface TerritoryVisualUIConfig {
    containerId: string;
    updateInterval?: number;
    showBoundaryIndicators?: boolean;
    showLiberationTimer?: boolean;
    showQueenStatus?: boolean;
    maxDisplayTerritories?: number;
}

export interface TerritoryDisplayInfo {
    territory: Territory;
    isPlayerInside: boolean;
    liberationStatus: {
        isLiberated: boolean;
        timeRemaining: number;
        miningBonus: number;
    };
    queenStatus: {
        hasQueen: boolean;
        phase: QueenPhase | null;
        isVulnerable: boolean;
        generation: number;
    };
    distanceFromPlayer: number;
}

export const DEFAULT_TERRITORY_UI_CONFIG: Partial<TerritoryVisualUIConfig> = {
    updateInterval: 1000,
    showBoundaryIndicators: true,
    showLiberationTimer: true,
    showQueenStatus: true,
    maxDisplayTerritories: 3
};
