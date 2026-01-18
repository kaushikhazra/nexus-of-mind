/**
 * QueenEnergyTypes - Type definitions for Queen Energy System
 *
 * The Queen Energy System manages spawn resource allocation:
 * - Energy regenerates passively (3.0/sec)
 * - Each parasite type has a spawn cost
 * - Spawn capacity = how many of each type can be afforded
 */

/**
 * Configuration for the Queen Energy System
 */
export interface QueenEnergyConfig {
    /** Maximum energy capacity */
    maxEnergy: number;
    /** Starting energy (typically 50% of max) */
    startingEnergy: number;
    /** Energy regenerated per second */
    regenRate: number;
    /** Energy cost to spawn an Energy Parasite */
    energyParasiteCost: number;
    /** Energy cost to spawn a Combat Parasite */
    combatParasiteCost: number;
}

/**
 * Spawn capacity for each parasite type (normalized 0-1)
 * - 1.0 = maximum spawn potential (can spawn max affordable)
 * - 0.0 = cannot spawn any of this type
 */
export interface SpawnCapacity {
    /** Energy Parasite spawn capacity: floor(current/15) / 6 */
    energy: number;
    /** Combat Parasite spawn capacity: floor(current/25) / 4 */
    combat: number;
}

/**
 * Parasite types that can be spawned
 */
export type SpawnableParasiteType = 'energy' | 'combat';

/**
 * Queen energy state snapshot for observation data
 */
export interface QueenEnergyState {
    /** Current energy level */
    current: number;
    /** Maximum energy capacity */
    max: number;
    /** Current spawn capacities */
    spawnCapacity: SpawnCapacity;
}

/**
 * Default configuration for the Queen Energy System
 *
 * Based on design spec:
 * - Max Energy: 100
 * - Starting Energy: 50 (50% of max)
 * - Regen Rate: 3.0 energy/second
 * - Energy Parasite Cost: 15 (max 6 affordable at full energy)
 * - Combat Parasite Cost: 25 (max 4 affordable at full energy)
 */
export const DEFAULT_QUEEN_ENERGY_CONFIG: QueenEnergyConfig = {
    maxEnergy: 100,
    startingEnergy: 50,
    regenRate: 3.0,
    energyParasiteCost: 15,
    combatParasiteCost: 25
};

/**
 * Maximum affordable counts at full energy
 * Used for spawn capacity normalization
 */
export const MAX_AFFORDABLE = {
    /** floor(100/15) = 6 Energy Parasites at full energy */
    energy: 6,
    /** floor(100/25) = 4 Combat Parasites at full energy */
    combat: 4
} as const;
