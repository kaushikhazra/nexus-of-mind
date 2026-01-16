/**
 * Queen Energy System Types
 *
 * Defines configuration and types for the Queen's energy-based spawn limiting system.
 * Spawning costs energy, which regenerates passively from the planetary environment.
 */

import { ParasiteType } from './ParasiteTypes';

/**
 * Configuration for the Queen Energy System
 */
export interface QueenEnergyConfig {
    /** Maximum energy capacity */
    maxEnergy: number;

    /** Starting energy (percentage of max, 0-1) */
    startingEnergyPercent: number;

    /** Energy regeneration rate (energy per second) */
    regenRate: number;

    /** Energy cost per parasite type */
    spawnCosts: Map<ParasiteType, number>;
}

/**
 * Default energy costs per parasite type
 */
export const DEFAULT_SPAWN_COSTS: Record<ParasiteType, number> = {
    [ParasiteType.ENERGY]: 15,    // Basic parasite - cheaper
    [ParasiteType.COMBAT]: 25,    // Combat parasite - more expensive
};

/**
 * Default Queen Energy configuration
 */
export const DEFAULT_QUEEN_ENERGY_CONFIG: QueenEnergyConfig = {
    maxEnergy: 100,
    startingEnergyPercent: 0.5,  // Start at 50%
    regenRate: 3.0,              // 3 energy per second (~5 seconds for 1 Energy Parasite)
    spawnCosts: new Map(Object.entries(DEFAULT_SPAWN_COSTS).map(
        ([key, value]) => [key as ParasiteType, value]
    )),
};

/**
 * Energy state snapshot for observation
 */
export interface QueenEnergyState {
    currentEnergy: number;
    maxEnergy: number;
    regenRate: number;
    normalizedEnergy: number;  // 0-1 for NN input
}

/**
 * Energy event for logging/debugging
 */
export interface EnergyEvent {
    timestamp: number;
    type: 'regen' | 'spawn' | 'reset';
    amount: number;
    energyBefore: number;
    energyAfter: number;
    parasiteType?: ParasiteType;
}
