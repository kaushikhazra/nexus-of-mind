/**
 * ParasiteTypes Test Suite
 * 
 * Tests for the enhanced parasite system type definitions and utilities
 */

import {
    ParasiteType,
    PARASITE_STATS,
    TARGETING_BEHAVIORS,
    DEFAULT_SPAWN_DISTRIBUTION,
    ParasiteTypeUtils
} from '../ParasiteTypes';

describe('ParasiteTypes', () => {
    describe('ParasiteType enum', () => {
        test('should have ENERGY and COMBAT types', () => {
            expect(ParasiteType.ENERGY).toBe('energy');
            expect(ParasiteType.COMBAT).toBe('combat');
        });
    });

    describe('PARASITE_STATS configuration', () => {
        test('should have stats for both parasite types', () => {
            expect(PARASITE_STATS[ParasiteType.ENERGY]).toBeDefined();
            expect(PARASITE_STATS[ParasiteType.COMBAT]).toBeDefined();
        });

        test('Combat Parasites should be stronger than Energy Parasites', () => {
            const energyStats = PARASITE_STATS[ParasiteType.ENERGY];
            const combatStats = PARASITE_STATS[ParasiteType.COMBAT];

            expect(combatStats.health).toBeGreaterThan(energyStats.health);
            expect(combatStats.maxHealth).toBeGreaterThan(energyStats.maxHealth);
            expect(combatStats.speed).toBeGreaterThan(energyStats.speed);
            expect(combatStats.energyReward).toBeGreaterThan(energyStats.energyReward);
            expect(combatStats.visualScale).toBeGreaterThan(energyStats.visualScale);
        });

        test('Energy Parasites should not deal direct damage', () => {
            expect(PARASITE_STATS[ParasiteType.ENERGY].attackDamage).toBe(0);
        });

        test('Combat Parasites should deal damage', () => {
            expect(PARASITE_STATS[ParasiteType.COMBAT].attackDamage).toBeGreaterThan(0);
        });
    });

    describe('TARGETING_BEHAVIORS configuration', () => {
        test('should have targeting behaviors for both parasite types', () => {
            expect(TARGETING_BEHAVIORS[ParasiteType.ENERGY]).toBeDefined();
            expect(TARGETING_BEHAVIORS[ParasiteType.COMBAT]).toBeDefined();
        });

        test('Energy Parasites should target workers first', () => {
            const energyBehavior = TARGETING_BEHAVIORS[ParasiteType.ENERGY];
            expect(energyBehavior.primaryTargets).toContain('worker');
            expect(energyBehavior.primaryTargets).not.toContain('protector');
        });

        test('Combat Parasites should target protectors first', () => {
            const combatBehavior = TARGETING_BEHAVIORS[ParasiteType.COMBAT];
            expect(combatBehavior.primaryTargets).toContain('protector');
            expect(combatBehavior.secondaryTargets).toContain('worker');
        });

        test('Combat Parasites should be more aggressive', () => {
            const energyBehavior = TARGETING_BEHAVIORS[ParasiteType.ENERGY];
            const combatBehavior = TARGETING_BEHAVIORS[ParasiteType.COMBAT];

            expect(combatBehavior.targetSwitchCooldown).toBeLessThan(energyBehavior.targetSwitchCooldown);
            expect(combatBehavior.maxTargetDistance).toBeGreaterThan(energyBehavior.maxTargetDistance);
            expect(combatBehavior.pursuitDistance).toBeGreaterThan(energyBehavior.pursuitDistance);
        });
    });

    describe('DEFAULT_SPAWN_DISTRIBUTION', () => {
        test('should have 75% Energy and 25% Combat distribution', () => {
            expect(DEFAULT_SPAWN_DISTRIBUTION.energyParasiteRate).toBe(0.75);
            expect(DEFAULT_SPAWN_DISTRIBUTION.combatParasiteRate).toBe(0.25);
        });

        test('should have 10% distribution accuracy tolerance', () => {
            expect(DEFAULT_SPAWN_DISTRIBUTION.distributionAccuracy).toBe(0.10);
        });

        test('rates should sum to 1.0', () => {
            const sum = DEFAULT_SPAWN_DISTRIBUTION.energyParasiteRate + 
                       DEFAULT_SPAWN_DISTRIBUTION.combatParasiteRate;
            expect(sum).toBe(1.0);
        });
    });

    describe('ParasiteTypeUtils', () => {
        test('getStats should return correct stats for each type', () => {
            const energyStats = ParasiteTypeUtils.getStats(ParasiteType.ENERGY);
            const combatStats = ParasiteTypeUtils.getStats(ParasiteType.COMBAT);

            expect(energyStats).toEqual(PARASITE_STATS[ParasiteType.ENERGY]);
            expect(combatStats).toEqual(PARASITE_STATS[ParasiteType.COMBAT]);
        });

        test('getTargetingBehavior should return correct behavior for each type', () => {
            const energyBehavior = ParasiteTypeUtils.getTargetingBehavior(ParasiteType.ENERGY);
            const combatBehavior = ParasiteTypeUtils.getTargetingBehavior(ParasiteType.COMBAT);

            expect(energyBehavior).toEqual(TARGETING_BEHAVIORS[ParasiteType.ENERGY]);
            expect(combatBehavior).toEqual(TARGETING_BEHAVIORS[ParasiteType.COMBAT]);
        });

        test('isValidTarget should correctly identify valid targets', () => {
            // Energy Parasites should target workers
            expect(ParasiteTypeUtils.isValidTarget(ParasiteType.ENERGY, 'worker')).toBe(true);
            expect(ParasiteTypeUtils.isValidTarget(ParasiteType.ENERGY, 'protector')).toBe(false);

            // Combat Parasites should target both protectors and workers
            expect(ParasiteTypeUtils.isValidTarget(ParasiteType.COMBAT, 'protector')).toBe(true);
            expect(ParasiteTypeUtils.isValidTarget(ParasiteType.COMBAT, 'worker')).toBe(true);
        });

        test('getTargetPriority should return correct priorities', () => {
            // Energy Parasites: workers have priority 0
            expect(ParasiteTypeUtils.getTargetPriority(ParasiteType.ENERGY, 'worker')).toBe(0);
            expect(ParasiteTypeUtils.getTargetPriority(ParasiteType.ENERGY, 'protector')).toBe(Number.MAX_SAFE_INTEGER);

            // Combat Parasites: protectors have priority 0, workers have priority 1
            expect(ParasiteTypeUtils.getTargetPriority(ParasiteType.COMBAT, 'protector')).toBe(0);
            expect(ParasiteTypeUtils.getTargetPriority(ParasiteType.COMBAT, 'worker')).toBe(1);
        });

        test('targetsProtectorsFirst should return correct values', () => {
            expect(ParasiteTypeUtils.targetsProtectorsFirst(ParasiteType.ENERGY)).toBe(false);
            expect(ParasiteTypeUtils.targetsProtectorsFirst(ParasiteType.COMBAT)).toBe(true);
        });

        test('getAllValidTargets should return all valid targets', () => {
            const energyTargets = ParasiteTypeUtils.getAllValidTargets(ParasiteType.ENERGY);
            const combatTargets = ParasiteTypeUtils.getAllValidTargets(ParasiteType.COMBAT);

            expect(energyTargets).toEqual(['worker']);
            expect(combatTargets).toEqual(['protector', 'worker']);
        });
    });
});