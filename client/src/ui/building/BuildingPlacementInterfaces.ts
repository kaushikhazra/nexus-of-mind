/**
 * BuildingPlacementInterfaces - Type definitions for building placement
 *
 * Contains all interfaces and types used by the building placement system.
 */

import { Scene } from '@babylonjs/core';
import type { BuildingManager } from '../../game/BuildingManager';
import type { EnergyManager } from '../../game/EnergyManager';
import type { MineralDeposit } from '../../world/MineralDeposit';

export type BuildingType = 'base' | 'powerPlant';

export interface MiningAnalysis {
    reachableNodes: MineralDeposit[];
    workerCount: number;
    efficiency: 'high' | 'medium' | 'low';
    totalCapacity: number;
}

export interface BuildingPlacementConfig {
    containerId: string;
    scene: Scene;
    buildingManager: BuildingManager;
    energyManager: EnergyManager;
}

export interface BuildingCosts {
    base: number;
    powerPlant: number;
}

export const DEFAULT_BUILDING_COSTS: BuildingCosts = {
    base: 50,
    powerPlant: 30
};

export const PLACEMENT_CONSTANTS = {
    WORKER_MINING_RANGE: 5,
    WORKER_SPAWN_DISTANCE: 3,
    MIN_BUILDING_DISTANCE: 8,
    MAX_PLACEMENT_DISTANCE: 100,
    MOUSE_MOVE_THROTTLE_INTERVAL: 100
};
