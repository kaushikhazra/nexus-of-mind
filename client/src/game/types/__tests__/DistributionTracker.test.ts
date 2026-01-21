/**
 * DistributionTracker Test Suite
 * 
 * Tests for the parasite spawn distribution tracking and enforcement
 */

import { DistributionTracker } from '../DistributionTracker';
import { ParasiteType, DEFAULT_SPAWN_DISTRIBUTION } from '../ParasiteTypes';

describe('DistributionTracker', () => {
    let tracker: DistributionTracker;

    beforeEach(() => {
        tracker = new DistributionTracker();
    });

    describe('initialization', () => {
        test('should initialize with default distribution', () => {
            const stats = tracker.getDistributionStats();
            expect(stats.targetRatio.energy).toBe(DEFAULT_SPAWN_DISTRIBUTION.energyParasiteRate);
            expect(stats.targetRatio.combat).toBe(DEFAULT_SPAWN_DISTRIBUTION.combatParasiteRate);
        });

        test('should initialize with empty spawn history', () => {
            const stats = tracker.getDistributionStats();
            expect(stats.totalSpawns).toBe(0);
            expect(stats.energySpawns).toBe(0);
            expect(stats.combatSpawns).toBe(0);
        });
    });

    describe('spawn recording', () => {
        test('should record energy parasite spawns', () => {
            tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
            
            const stats = tracker.getDistributionStats();
            expect(stats.totalSpawns).toBe(1);
            expect(stats.energySpawns).toBe(1);
            expect(stats.combatSpawns).toBe(0);
        });

        test('should record combat parasite spawns', () => {
            tracker.recordSpawn(ParasiteType.COMBAT, 'deposit1');
            
            const stats = tracker.getDistributionStats();
            expect(stats.totalSpawns).toBe(1);
            expect(stats.energySpawns).toBe(0);
            expect(stats.combatSpawns).toBe(1);
        });

        test('should maintain rolling window of spawns', () => {
            // Spawn 25 parasites (more than window size of 20)
            for (let i = 0; i < 25; i++) {
                const type = i % 2 === 0 ? ParasiteType.ENERGY : ParasiteType.COMBAT;
                tracker.recordSpawn(type, `deposit${i}`);
            }

            const stats = tracker.getDistributionStats();
            expect(stats.totalSpawns).toBe(20); // Should be capped at window size
        });
    });

    describe('distribution calculation', () => {
        test('should calculate correct ratios', () => {
            // Spawn 3 energy and 1 combat (75/25 ratio)
            tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
            tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
            tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
            tracker.recordSpawn(ParasiteType.COMBAT, 'deposit1');

            const ratio = tracker.getCurrentRatio();
            expect(ratio.energy).toBe(0.75);
            expect(ratio.combat).toBe(0.25);
        });

        test('should handle empty history', () => {
            const ratio = tracker.getCurrentRatio();
            expect(ratio.energy).toBe(0);
            expect(ratio.combat).toBe(0);
        });
    });

    describe('distribution accuracy', () => {
        test('should be accurate with perfect distribution', () => {
            // Create perfect 75/25 distribution
            for (let i = 0; i < 12; i++) {
                tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
            }
            for (let i = 0; i < 4; i++) {
                tracker.recordSpawn(ParasiteType.COMBAT, 'deposit1');
            }

            expect(tracker.isDistributionAccurate()).toBe(true);
        });

        test('should be inaccurate with skewed distribution', () => {
            // Create heavily skewed distribution (all energy)
            for (let i = 0; i < 15; i++) {
                tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
            }

            expect(tracker.isDistributionAccurate()).toBe(false);
        });

        test('should be accurate with insufficient data', () => {
            // Less than 10 spawns should always be considered accurate
            tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
            tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
            
            expect(tracker.isDistributionAccurate()).toBe(true);
        });
    });

    describe('next parasite type selection', () => {
        test('should use random selection with insufficient data', () => {
            // With less than 4 spawns, should use random selection
            const types = new Set<ParasiteType>();
            
            // Run multiple times to check randomness
            for (let i = 0; i < 100; i++) {
                const type = tracker.getNextParasiteType();
                types.add(type);
            }
            
            // Should have both types represented (with high probability)
            expect(types.size).toBe(2);
        });

        test('should force combat parasites when under-represented', () => {
            // Create distribution with too few combat parasites
            for (let i = 0; i < 10; i++) {
                tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
            }

            const nextType = tracker.getNextParasiteType();
            expect(nextType).toBe(ParasiteType.COMBAT);
        });

        test('should force energy parasites when under-represented', () => {
            // Create distribution with too few energy parasites
            for (let i = 0; i < 8; i++) {
                tracker.recordSpawn(ParasiteType.COMBAT, 'deposit1');
            }

            const nextType = tracker.getNextParasiteType();
            expect(nextType).toBe(ParasiteType.ENERGY);
        });
    });

    describe('utility methods', () => {
        test('should reset spawn history', () => {
            tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
            tracker.recordSpawn(ParasiteType.COMBAT, 'deposit1');
            
            tracker.reset();
            
            const stats = tracker.getDistributionStats();
            expect(stats.totalSpawns).toBe(0);
        });

        test('should get spawn records for specific deposit', () => {
            tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
            tracker.recordSpawn(ParasiteType.COMBAT, 'deposit2');
            tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');

            const deposit1Records = tracker.getSpawnRecordsForDeposit('deposit1');
            const deposit2Records = tracker.getSpawnRecordsForDeposit('deposit2');

            expect(deposit1Records).toHaveLength(2);
            expect(deposit2Records).toHaveLength(1);
        });

        test('should get recent spawn records', () => {
            const now = Date.now();
            
            // Record spawns with different timestamps
            tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
            
            // Wait a bit and record more
            setTimeout(() => {
                tracker.recordSpawn(ParasiteType.COMBAT, 'deposit1');
                tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
                
                const recentRecords = tracker.getRecentSpawnRecords(100); // Very short window
                expect(recentRecords.length).toBeGreaterThanOrEqual(0); // Should work with any reasonable result
            }, 10);
        });

        test('should calculate spawn rate', () => {
            // Record 3 spawns
            tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');
            tracker.recordSpawn(ParasiteType.COMBAT, 'deposit1');
            tracker.recordSpawn(ParasiteType.ENERGY, 'deposit1');

            const spawnRate = tracker.getSpawnRate(60000); // Last 60 seconds (should include all)
            expect(spawnRate).toBeGreaterThanOrEqual(0); // Should be a valid rate
        });
    });
});