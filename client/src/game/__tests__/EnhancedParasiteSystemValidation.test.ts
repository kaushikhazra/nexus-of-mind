/**
 * Enhanced Parasite System - Validation Tests
 * 
 * Focused validation tests for the dual-threat parasite ecosystem.
 * Tests core functionality, configuration, and integration points.
 */

import { ParasiteType, PARASITE_STATS, TARGETING_BEHAVIORS } from '../types/ParasiteTypes';
import { DistributionTracker } from '../types/DistributionTracker';

describe('Enhanced Parasite System - Validation Tests', () => {
  
  describe('Parasite Configuration', () => {
    test('should have correct Energy Parasite stats', () => {
      const energyStats = PARASITE_STATS[ParasiteType.ENERGY];
      
      expect(energyStats.health).toBe(2);
      expect(energyStats.maxHealth).toBe(2);
      expect(energyStats.speed).toBe(2.0);
      expect(energyStats.attackDamage).toBe(0); // Energy drain only
      expect(energyStats.energyReward).toBe(2);
      expect(energyStats.visualScale).toBe(1.0);
    });

    test('should have correct Combat Parasite stats', () => {
      const combatStats = PARASITE_STATS[ParasiteType.COMBAT];
      
      expect(combatStats.health).toBe(4);
      expect(combatStats.maxHealth).toBe(4);
      expect(combatStats.speed).toBe(2.5);
      expect(combatStats.attackDamage).toBe(2);
      expect(combatStats.energyReward).toBe(4);
      expect(combatStats.visualScale).toBe(1.2); // 20% larger
    });

    test('should maintain 2x relationship between parasite types', () => {
      const energyStats = PARASITE_STATS[ParasiteType.ENERGY];
      const combatStats = PARASITE_STATS[ParasiteType.COMBAT];
      
      // Combat Parasites should have 2x health and reward
      expect(combatStats.health).toBe(energyStats.health * 2);
      expect(combatStats.maxHealth).toBe(energyStats.maxHealth * 2);
      expect(combatStats.energyReward).toBe(energyStats.energyReward * 2);
      
      // Combat Parasites should be 20% larger visually
      expect(combatStats.visualScale).toBe(1.2);
      expect(energyStats.visualScale).toBe(1.0);
    });
  });

  describe('Targeting Behavior Configuration', () => {
    test('should have correct Energy Parasite targeting behavior', () => {
      const energyTargeting = TARGETING_BEHAVIORS[ParasiteType.ENERGY];
      
      expect(energyTargeting.primaryTargets).toEqual(['worker']);
      expect(energyTargeting.secondaryTargets).toEqual([]);
      expect(energyTargeting.targetSwitchCooldown).toBe(2000);
      expect(energyTargeting.maxTargetDistance).toBe(50);
      expect(energyTargeting.pursuitDistance).toBe(60);
    });

    test('should have correct Combat Parasite targeting behavior', () => {
      const combatTargeting = TARGETING_BEHAVIORS[ParasiteType.COMBAT];
      
      expect(combatTargeting.primaryTargets).toEqual(['protector']);
      expect(combatTargeting.secondaryTargets).toEqual(['worker']);
      expect(combatTargeting.targetSwitchCooldown).toBe(1500); // More aggressive
      expect(combatTargeting.maxTargetDistance).toBe(60);
      expect(combatTargeting.pursuitDistance).toBe(75);
    });

    test('should demonstrate targeting priority differences', () => {
      const energyTargeting = TARGETING_BEHAVIORS[ParasiteType.ENERGY];
      const combatTargeting = TARGETING_BEHAVIORS[ParasiteType.COMBAT];
      
      // Energy Parasites target workers first
      expect(energyTargeting.primaryTargets[0]).toBe('worker');
      
      // Combat Parasites target protectors first
      expect(combatTargeting.primaryTargets[0]).toBe('protector');
      
      // Combat Parasites have workers as fallback
      expect(combatTargeting.secondaryTargets).toContain('worker');
      
      // Combat Parasites are more aggressive (shorter cooldown)
      expect(combatTargeting.targetSwitchCooldown).toBeLessThan(energyTargeting.targetSwitchCooldown);
    });
  });

  describe('Distribution Tracker', () => {
    test('should maintain 75/25 distribution over many spawns', () => {
      const tracker = new DistributionTracker();
      const spawnTypes = [];
      
      // Simulate 200 spawns for better statistical accuracy
      for (let i = 0; i < 200; i++) {
        const nextType = tracker.getNextParasiteType();
        spawnTypes.push(nextType);
        tracker.recordSpawn(nextType, `deposit_${i % 5}`); // Use mock deposit IDs
      }
      
      // Count distribution
      const energyCount = spawnTypes.filter(type => type === ParasiteType.ENERGY).length;
      const combatCount = spawnTypes.filter(type => type === ParasiteType.COMBAT).length;
      
      const energyRatio = energyCount / 200;
      const combatRatio = combatCount / 200;
      
      // Should be close to 75/25 distribution (±8% tolerance for randomness)
      expect(energyRatio).toBeGreaterThan(0.67); // 75% - 8%
      expect(energyRatio).toBeLessThan(0.83);    // 75% + 8%
      expect(combatRatio).toBeGreaterThan(0.17); // 25% - 8%
      expect(combatRatio).toBeLessThan(0.33);    // 25% + 8%
      
      // Total should equal 200
      expect(energyCount + combatCount).toBe(200);
    });

    test('should enforce distribution accuracy over rolling window', () => {
      const tracker = new DistributionTracker();
      
      // Force many Energy spawns first
      for (let i = 0; i < 15; i++) {
        tracker.recordSpawn(ParasiteType.ENERGY, `deposit_${i}`);
      }
      
      // Next spawn should be Combat to balance distribution
      const nextType = tracker.getNextParasiteType();
      expect(nextType).toBe(ParasiteType.COMBAT);
    });

    test('should handle edge cases in distribution tracking', () => {
      const tracker = new DistributionTracker();
      
      // Test with no history
      const firstType = tracker.getNextParasiteType();
      expect([ParasiteType.ENERGY, ParasiteType.COMBAT]).toContain(firstType);
      
      // Test with single spawn
      tracker.recordSpawn(ParasiteType.ENERGY, 'deposit_1');
      const secondType = tracker.getNextParasiteType();
      expect([ParasiteType.ENERGY, ParasiteType.COMBAT]).toContain(secondType);
    });
  });

  describe('Strategic Depth Validation', () => {
    test('should provide different threat profiles for each parasite type', () => {
      const energyStats = PARASITE_STATS[ParasiteType.ENERGY];
      const combatStats = PARASITE_STATS[ParasiteType.COMBAT];
      const energyTargeting = TARGETING_BEHAVIORS[ParasiteType.ENERGY];
      const combatTargeting = TARGETING_BEHAVIORS[ParasiteType.COMBAT];
      
      // Energy Parasites threaten mining operations
      expect(energyTargeting.primaryTargets).toContain('worker');
      expect(energyStats.attackDamage).toBe(0); // No direct damage, energy drain
      
      // Combat Parasites threaten defense units
      expect(combatTargeting.primaryTargets).toContain('protector');
      expect(combatStats.attackDamage).toBeGreaterThan(0); // Direct damage
      
      // Different durability creates different tactical challenges
      expect(combatStats.health).toBeGreaterThan(energyStats.health);
      
      // Different rewards create strategic trade-offs
      expect(combatStats.energyReward).toBeGreaterThan(energyStats.energyReward);
    });

    test('should create dual-threat ecosystem requirements', () => {
      // Players need both workers (for mining) and protectors (for defense)
      // Energy Parasites threaten mining efficiency
      // Combat Parasites threaten defensive capability
      // This creates strategic depth where players must balance:
      // 1. Mining operations (workers) vs Defense (protectors)
      // 2. Energy allocation between unit creation and combat
      // 3. Positioning of protectors to defend workers vs combat parasites
      
      const energyTargeting = TARGETING_BEHAVIORS[ParasiteType.ENERGY];
      const combatTargeting = TARGETING_BEHAVIORS[ParasiteType.COMBAT];
      
      // Verify different target priorities create strategic complexity
      expect(energyTargeting.primaryTargets[0]).not.toBe(combatTargeting.primaryTargets[0]);
      
      // Verify fallback targeting creates tactical flexibility
      expect(combatTargeting.secondaryTargets).toContain('worker');
      
      // Verify different engagement ranges create positioning challenges
      expect(combatTargeting.maxTargetDistance).not.toBe(energyTargeting.maxTargetDistance);
    });
  });

  describe('Performance and Balance Validation', () => {
    test('should have balanced parasite stats for fair gameplay', () => {
      const energyStats = PARASITE_STATS[ParasiteType.ENERGY];
      const combatStats = PARASITE_STATS[ParasiteType.COMBAT];
      
      // Combat Parasites are stronger but should be proportionally rewarding
      const healthRatio = combatStats.health / energyStats.health;
      const rewardRatio = combatStats.energyReward / energyStats.energyReward;
      
      expect(healthRatio).toBe(rewardRatio); // 2x health = 2x reward
      
      // Speed differences should be reasonable (not too extreme)
      const speedRatio = combatStats.speed / energyStats.speed;
      expect(speedRatio).toBeGreaterThan(1.0); // Combat should be faster
      expect(speedRatio).toBeLessThan(1.5); // But not too much faster
    });

    test('should have reasonable targeting parameters', () => {
      const energyTargeting = TARGETING_BEHAVIORS[ParasiteType.ENERGY];
      const combatTargeting = TARGETING_BEHAVIORS[ParasiteType.COMBAT];
      
      // Target switch cooldowns should be reasonable
      expect(energyTargeting.targetSwitchCooldown).toBeGreaterThan(1000); // At least 1 second
      expect(energyTargeting.targetSwitchCooldown).toBeLessThan(5000); // Less than 5 seconds
      
      expect(combatTargeting.targetSwitchCooldown).toBeGreaterThan(1000);
      expect(combatTargeting.targetSwitchCooldown).toBeLessThan(5000);
      
      // Pursuit distances should be reasonable
      expect(energyTargeting.pursuitDistance).toBeGreaterThan(energyTargeting.maxTargetDistance);
      expect(combatTargeting.pursuitDistance).toBeGreaterThan(combatTargeting.maxTargetDistance);
    });
  });

  describe('Integration Points Validation', () => {
    test('should have consistent parasite type enumeration', () => {
      // Verify enum values are consistent
      expect(ParasiteType.ENERGY).toBe('energy');
      expect(ParasiteType.COMBAT).toBe('combat');
      
      // Verify all stats have corresponding entries
      expect(PARASITE_STATS[ParasiteType.ENERGY]).toBeDefined();
      expect(PARASITE_STATS[ParasiteType.COMBAT]).toBeDefined();
      
      // Verify all targeting behaviors have corresponding entries
      expect(TARGETING_BEHAVIORS[ParasiteType.ENERGY]).toBeDefined();
      expect(TARGETING_BEHAVIORS[ParasiteType.COMBAT]).toBeDefined();
    });

    test('should support extensibility for future parasite types', () => {
      // Configuration structure should support adding new types
      const statKeys = Object.keys(PARASITE_STATS);
      const targetingKeys = Object.keys(TARGETING_BEHAVIORS);
      
      expect(statKeys.length).toBe(2); // Currently Energy and Combat
      expect(targetingKeys.length).toBe(2);
      
      // Keys should match
      expect(statKeys.sort()).toEqual(targetingKeys.sort());
      
      // Structure should be consistent
      for (const type of statKeys) {
        const stats = PARASITE_STATS[type as ParasiteType];
        expect(stats).toHaveProperty('health');
        expect(stats).toHaveProperty('maxHealth');
        expect(stats).toHaveProperty('speed');
        expect(stats).toHaveProperty('attackDamage');
        expect(stats).toHaveProperty('energyReward');
        expect(stats).toHaveProperty('visualScale');
      }
    });
  });

  describe('End-to-End Validation', () => {
    test('should demonstrate complete dual-threat ecosystem', () => {
      // This test validates that all components work together
      // to create the intended dual-threat gameplay experience
      
      const tracker = new DistributionTracker();
      const gameplayScenario = {
        energyParasites: 0,
        combatParasites: 0,
        totalSpawns: 0
      };
      
      // Simulate 50 spawn decisions
      for (let i = 0; i < 50; i++) {
        const nextType = tracker.getNextParasiteType();
        tracker.recordSpawn(nextType, `deposit_${i % 3}`); // Use mock deposit IDs
        
        if (nextType === ParasiteType.ENERGY) {
          gameplayScenario.energyParasites++;
        } else {
          gameplayScenario.combatParasites++;
        }
        gameplayScenario.totalSpawns++;
      }
      
      // Verify dual-threat ecosystem is established
      expect(gameplayScenario.energyParasites).toBeGreaterThan(0);
      expect(gameplayScenario.combatParasites).toBeGreaterThan(0);
      expect(gameplayScenario.totalSpawns).toBe(50);
      
      // Verify distribution is reasonable
      const energyRatio = gameplayScenario.energyParasites / gameplayScenario.totalSpawns;
      const combatRatio = gameplayScenario.combatParasites / gameplayScenario.totalSpawns;
      
      // Should trend toward 75/25 but allow for variance in smaller samples
      expect(energyRatio).toBeGreaterThan(0.5); // At least 50% energy
      expect(combatRatio).toBeGreaterThan(0.1); // At least 10% combat
      
      // Verify strategic depth elements
      const energyStats = PARASITE_STATS[ParasiteType.ENERGY];
      const combatStats = PARASITE_STATS[ParasiteType.COMBAT];
      const energyTargeting = TARGETING_BEHAVIORS[ParasiteType.ENERGY];
      const combatTargeting = TARGETING_BEHAVIORS[ParasiteType.COMBAT];
      
      // Different targets create different threats
      expect(energyTargeting.primaryTargets[0]).toBe('worker'); // Mining threat
      expect(combatTargeting.primaryTargets[0]).toBe('protector'); // Defense threat
      
      // Different durability creates different tactical challenges
      expect(combatStats.health).toBeGreaterThan(energyStats.health);
      
      // Proportional rewards maintain balance
      expect(combatStats.energyReward / combatStats.health).toBe(energyStats.energyReward / energyStats.health);
    });
  });
});