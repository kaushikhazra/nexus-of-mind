/**
 * EnergyLordsTypes - Type definitions for the Energy Lords Progression System
 *
 * Defines 60 levels organized into 12 tiers, with exponential energy scaling
 * (1000 × 1.08^(level-1)) and tiered sustain times (1-15 minutes).
 */

/**
 * Roman numerals for tier ranks
 */
export const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V'] as const;

/**
 * Definition for a tier (group of 5 levels)
 */
export interface TierDefinition {
    id: number;           // 0-11
    name: string;         // "Spark", "Ember", etc.
    startLevel: number;   // First level in tier
    endLevel: number;     // Last level in tier
    sustainTime: number;  // Seconds required for all levels in tier
}

/**
 * Definition for a single progression level
 */
export interface LevelDefinition {
    level: number;
    energyThreshold: number;  // in Joules
    sustainTime: number;      // in seconds
    title: string;
    upgradeBonus: number;     // percentage increase to power generator
    tierIndex: number;        // 0-11, -1 for Initiate
    rankInTier: number;       // 1-5, 0 for Initiate
    isTierCompletion: boolean; // true for levels 5, 10, 15, etc.
}

/**
 * Player's saved progress data
 */
export interface SavedProgress {
    currentLevel: number;
    highestTitle: string;
    totalUpgradeBonus: number;
    completedLevels: number[];
}

/**
 * Current progress state during gameplay
 */
export interface ProgressState {
    currentLevel: number;
    targetLevel: LevelDefinition;
    sustainedTime: number;      // in milliseconds
    currentEnergy: number;
    isAboveThreshold: boolean;
    progressPercent: number;
}

/**
 * Victory event data
 */
export interface VictoryEventData {
    levelCompleted: number;
    newTitle: string;
    upgradeBonus: number;
    totalUpgradeBonus: number;
    isTierCompletion: boolean;
    previousTierName?: string;
    newTierName?: string;
}

/**
 * Tier configurations - 12 tiers with increasing sustain times
 * Time caps at 15 minutes for the final two tiers
 */
export const TIER_CONFIGS: TierDefinition[] = [
    { id: 0, name: "Spark", startLevel: 1, endLevel: 5, sustainTime: 60 },
    { id: 1, name: "Ember", startLevel: 6, endLevel: 10, sustainTime: 120 },
    { id: 2, name: "Flame", startLevel: 11, endLevel: 15, sustainTime: 180 },
    { id: 3, name: "Blaze", startLevel: 16, endLevel: 20, sustainTime: 240 },
    { id: 4, name: "Inferno", startLevel: 21, endLevel: 25, sustainTime: 300 },
    { id: 5, name: "Nova", startLevel: 26, endLevel: 30, sustainTime: 420 },
    { id: 6, name: "Pulsar", startLevel: 31, endLevel: 35, sustainTime: 540 },
    { id: 7, name: "Quasar", startLevel: 36, endLevel: 40, sustainTime: 660 },
    { id: 8, name: "Nebula", startLevel: 41, endLevel: 45, sustainTime: 780 },
    { id: 9, name: "Star", startLevel: 46, endLevel: 50, sustainTime: 840 },
    { id: 10, name: "Supernova", startLevel: 51, endLevel: 55, sustainTime: 900 },
    { id: 11, name: "Nexus", startLevel: 56, endLevel: 60, sustainTime: 900 }
];

/**
 * Generate all 61 level configurations (0 = Initiate, 1-60 = playable levels)
 */
function generateLevelConfigs(): LevelDefinition[] {
    const levels: LevelDefinition[] = [
        {
            level: 0,
            energyThreshold: 0,
            sustainTime: 0,
            title: "Initiate",
            upgradeBonus: 0,
            tierIndex: -1,
            rankInTier: 0,
            isTierCompletion: false
        }
    ];

    for (let level = 1; level <= 60; level++) {
        const tierIndex = Math.floor((level - 1) / 5);
        const tier = TIER_CONFIGS[tierIndex];
        const rankInTier = ((level - 1) % 5) + 1;
        const isTierCompletion = level % 5 === 0;

        levels.push({
            level,
            energyThreshold: Math.round(1000 * Math.pow(1.08, level - 1)),
            sustainTime: tier.sustainTime,
            title: `${tier.name} ${ROMAN_NUMERALS[rankInTier - 1]}`,
            upgradeBonus: isTierCompletion ? 3.5 : 1,
            tierIndex,
            rankInTier,
            isTierCompletion
        });
    }

    return levels;
}

/**
 * Level configurations - generated from tier configs
 * Energy formula: 1000 × 1.08^(level-1) Joules
 */
export const LEVEL_CONFIGS: LevelDefinition[] = generateLevelConfigs();

/**
 * Check interval for threshold monitoring (milliseconds)
 */
export const THRESHOLD_CHECK_INTERVAL = 500;

/**
 * Maximum level in the progression system
 */
export const MAX_LEVEL = 60;

/**
 * Get level definition by level number
 */
export function getLevelConfig(level: number): LevelDefinition | undefined {
    return LEVEL_CONFIGS.find(config => config.level === level);
}

/**
 * Get the next level definition for progression
 */
export function getNextLevelConfig(currentLevel: number): LevelDefinition | undefined {
    if (currentLevel >= MAX_LEVEL) {
        return undefined;
    }
    return LEVEL_CONFIGS.find(config => config.level === currentLevel + 1);
}

/**
 * Get tier definition for a given level
 */
export function getTierForLevel(level: number): TierDefinition | undefined {
    if (level <= 0) return undefined;
    const tierIndex = Math.floor((level - 1) / 5);
    return TIER_CONFIGS[tierIndex];
}

/**
 * Get rank within tier (1-5) for a given level
 */
export function getRankInTier(level: number): number {
    if (level <= 0) return 0;
    return ((level - 1) % 5) + 1;
}

/**
 * Check if a level is a tier completion (every 5th level)
 */
export function isTierCompletion(level: number): boolean {
    return level > 0 && level % 5 === 0;
}

/**
 * Format title for a given level
 */
export function formatTitle(level: number): string {
    if (level <= 0) return "Initiate";
    const tier = getTierForLevel(level);
    const rank = getRankInTier(level);
    if (!tier) return "Unknown";
    return `${tier.name} ${ROMAN_NUMERALS[rank - 1]}`;
}

/**
 * Calculate total upgrade bonus from completed levels
 */
export function calculateTotalUpgradeBonus(completedLevels: number[]): number {
    return completedLevels.reduce((total, level) => {
        const config = getLevelConfig(level);
        return total + (config?.upgradeBonus || 0);
    }, 0);
}

/**
 * Format time in seconds to MM:SS display
 */
export function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format time in milliseconds to MM:SS display
 */
export function formatTimeMs(milliseconds: number): string {
    return formatTime(milliseconds / 1000);
}

/**
 * Format energy with thousands separator
 */
export function formatEnergy(joules: number): string {
    return Math.round(joules).toLocaleString();
}
