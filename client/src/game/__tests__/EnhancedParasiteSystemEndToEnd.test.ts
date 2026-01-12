/**
 * Enhanced Parasite System - End-to-End Testing
 * 
 * Comprehensive end-to-end tests that validate full gameplay scenarios
 * with mixed parasite types, player experience, and tactical decision-making.
 */

import { ParasiteType, PARASITE_STATS, TARGETING_BEHAVIORS } from '../types/ParasiteTypes';
import { DistributionTracker } from '../types/DistributionTracker';

describe('Enhanced Parasite System - End-to-End Testing', () => {
  
  describe('Full Gameplay Scenarios with Mixed Parasite Types', () => {
    test('should create diverse tactical challenges in extended gameplay', () => {
      const tracker = new DistributionTracker();
      const gameplaySession = {
        totalSpawns: 0,
        energyParasites: 0,
        combatParasites: 0,
        playerDecisions: [] as string[],
        tacticalChallenges: [] as string[]
      };
      
      // Simulate 100 spawns representing an extended gameplay session
      for (let i = 0; i < 100; i++) {
        const nextType = tracker.getNextParasiteType();
        tracker.recordSpawn(nextType, `deposit_${i % 4}`);
        
        gameplaySession.totalSpawns++;
        
        if (nextType === ParasiteType.ENERGY) {
          gameplaySession.energyParasites++;
          gameplaySession.tacticalChallenges.push('mining_threat');
          gameplaySession.playerDecisions.push('protect_workers');
        } else {
          gameplaySession.combatParasites++;
          gameplaySession.tacticalChallenges.push('defense_threat');
          gameplaySession.playerDecisions.push('position_protectors');
        }
      }
      
      // Verify mixed parasite ecosystem is established
      expect(gameplaySession.energyParasites).toBeGreaterThan(50); // Should be majority
      expect(gameplaySession.combatParasites).toBeGreaterThan(15); // Should be significant minority
      expect(gameplaySession.totalSpawns).toBe(100);
      
      // Verify diverse tactical challenges are present
      const uniqueChallenges = new Set(gameplaySession.tacticalChallenges);
      expect(uniqueChallenges.has('mining_threat')).toBe(true);
      expect(uniqueChallenges.has('defense_threat')).toBe(true);
      
      // Verify diverse player decisions are required
      const uniqueDecisions = new Set(gameplaySession.playerDecisions);
      expect(uniqueDecisions.has('protect_workers')).toBe(true);
      expect(uniqueDecisions.has('position_protectors')).toBe(true);
      
      // Verify distribution trends toward target ratio
      const energyRatio = gameplaySession.energyParasites / gameplaySession.totalSpawns;
      const combatRatio = gameplaySession.combatParasites / gameplaySession.totalSpawns;
      
      expect(energyRatio).toBeGreaterThan(0.65); // Should trend toward 75%
      expect(energyRatio).toBeLessThan(0.85);
      expect(combatRatio).toBeGreaterThan(0.15); // Should trend toward 25%
      expect(combatRatio).toBeLessThan(0.35);
    });

    test('should demonstrate escalating difficulty through parasite variety', () => {
      // Simulate a gameplay progression where both parasite types create
      // increasingly complex tactical situations
      
      const scenarios = [
        { energyCount: 3, combatCount: 1, difficulty: 'easy' },
        { energyCount: 5, combatCount: 2, difficulty: 'medium' },
        { energyCount: 7, combatCount: 3, difficulty: 'hard' }
      ];
      
      scenarios.forEach(scenario => {
        const totalParasites = scenario.energyCount + scenario.combatCount;
        const combatRatio = scenario.combatCount / totalParasites;
        
        // Verify Combat Parasites create proportional difficulty increase
        if (scenario.difficulty === 'easy') {
          expect(combatRatio).toBeLessThan(0.3); // Low combat ratio = easier
        } else if (scenario.difficulty === 'medium') {
          expect(combatRatio).toBeGreaterThan(0.25); // Moderate combat ratio
          expect(combatRatio).toBeLessThan(0.35);
        } else if (scenario.difficulty === 'hard') {
          expect(combatRatio).toBeGreaterThanOrEqual(0.3); // Higher combat ratio = harder
        }
        
        // Verify total threat level scales appropriately
        const energyThreat = scenario.energyCount * PARASITE_STATS[ParasiteType.ENERGY].health;
        const combatThreat = scenario.combatCount * PARASITE_STATS[ParasiteType.COMBAT].health;
        const totalThreat = energyThreat + combatThreat;
        
        if (scenario.difficulty === 'easy') {
          expect(totalThreat).toBeLessThan(12);
        } else if (scenario.difficulty === 'medium') {
          expect(totalThreat).toBeGreaterThan(12);
          expect(totalThreat).toBeLessThan(20);
        } else {
          expect(totalThreat).toBeGreaterThan(20);
        }
      });
    });
  });

  describe('Player Experience with Dual-Threat Ecosystem', () => {
    test('should require different strategies for different parasite types', () => {
      const energyStats = PARASITE_STATS[ParasiteType.ENERGY];
      const combatStats = PARASITE_STATS[ParasiteType.COMBAT];
      const energyTargeting = TARGETING_BEHAVIORS[ParasiteType.ENERGY];
      const combatTargeting = TARGETING_BEHAVIORS[ParasiteType.COMBAT];
      
      // Energy Parasites require worker protection strategy
      expect(energyTargeting.primaryTargets).toContain('worker');
      expect(energyStats.attackDamage).toBe(0); // Energy drain, not direct damage
      
      // Combat Parasites require protector positioning strategy
      expect(combatTargeting.primaryTargets).toContain('protector');
      expect(combatStats.attackDamage).toBeGreaterThan(0); // Direct damage threat
      
      // Different durability requires different resource allocation
      expect(combatStats.health).toBe(energyStats.health * 2);
      expect(combatStats.energyReward).toBe(energyStats.energyReward * 2);
      
      // Different targeting ranges require different positioning
      expect(combatTargeting.maxTargetDistance).toBeGreaterThan(energyTargeting.maxTargetDistance);
      expect(combatTargeting.pursuitDistance).toBeGreaterThan(energyTargeting.pursuitDistance);
    });

    test('should create meaningful risk-reward trade-offs', () => {
      const energyStats = PARASITE_STATS[ParasiteType.ENERGY];
      const combatStats = PARASITE_STATS[ParasiteType.COMBAT];
      
      // Combat Parasites should provide proportional rewards for increased risk
      const energyRiskRewardRatio = energyStats.energyReward / energyStats.health;
      const combatRiskRewardRatio = combatStats.energyReward / combatStats.health;
      
      expect(energyRiskRewardRatio).toBe(combatRiskRewardRatio); // Equal risk/reward ratio
      expect(combatStats.energyReward).toBeGreaterThan(energyStats.energyReward); // Higher absolute reward
      
      // Speed differences create tactical timing considerations
      expect(combatStats.speed).toBeGreaterThan(energyStats.speed);
      
      // Visual scale differences enable strategic identification
      expect(combatStats.visualScale).toBeGreaterThan(energyStats.visualScale);
    });

    test('should enable tactical decision-making through clear differentiation', () => {
      const energyTargeting = TARGETING_BEHAVIORS[ParasiteType.ENERGY];
      const combatTargeting = TARGETING_BEHAVIORS[ParasiteType.COMBAT];
      
      // Players should be able to predict parasite behavior
      expect(energyTargeting.primaryTargets[0]).toBe('worker');
      expect(combatTargeting.primaryTargets[0]).toBe('protector');
      
      // Different cooldowns create different engagement patterns
      expect(combatTargeting.targetSwitchCooldown).toBeLessThan(energyTargeting.targetSwitchCooldown);
      
      // Fallback targeting creates strategic depth
      expect(combatTargeting.secondaryTargets).toContain('worker');
      expect(energyTargeting.secondaryTargets).toHaveLength(0); // No fallback
      
      // Different engagement ranges require different positioning
      const energyEngagementRange = energyTargeting.maxTargetDistance;
      const combatEngagementRange = combatTargeting.maxTargetDistance;
      
      expect(combatEngagementRange).toBeGreaterThan(energyEngagementRange);
    });
  });

  describe('Strategic Depth and Tactical Decision-Making', () => {
    test('should create multi-layered strategic considerations', () => {
      // Test that the dual-threat system creates multiple strategic layers:
      // 1. Unit composition (workers vs protectors)
      // 2. Positioning (protecting workers vs engaging combat parasites)
      // 3. Resource allocation (energy for units vs combat)
      // 4. Timing (when to engage vs when to retreat)
      
      const strategicLayers = {
        unitComposition: {
          workerProtection: TARGETING_BEHAVIORS[ParasiteType.ENERGY].primaryTargets.includes('worker'),
          protectorThreat: TARGETING_BEHAVIORS[ParasiteType.COMBAT].primaryTargets.includes('protector')
        },
        positioning: {
          energyParasiteRange: TARGETING_BEHAVIORS[ParasiteType.ENERGY].maxTargetDistance,
          combatParasiteRange: TARGETING_BEHAVIORS[ParasiteType.COMBAT].maxTargetDistance,
          pursuitDifference: TARGETING_BEHAVIORS[ParasiteType.COMBAT].pursuitDistance - 
                            TARGETING_BEHAVIORS[ParasiteType.ENERGY].pursuitDistance
        },
        resourceAllocation: {
          energyParasiteReward: PARASITE_STATS[ParasiteType.ENERGY].energyReward,
          combatParasiteReward: PARASITE_STATS[ParasiteType.COMBAT].energyReward,
          rewardDifference: PARASITE_STATS[ParasiteType.COMBAT].energyReward - 
                           PARASITE_STATS[ParasiteType.ENERGY].energyReward
        },
        timing: {
          energyTargetCooldown: TARGETING_BEHAVIORS[ParasiteType.ENERGY].targetSwitchCooldown,
          combatTargetCooldown: TARGETING_BEHAVIORS[ParasiteType.COMBAT].targetSwitchCooldown,
          aggressionDifference: TARGETING_BEHAVIORS[ParasiteType.ENERGY].targetSwitchCooldown - 
                               TARGETING_BEHAVIORS[ParasiteType.COMBAT].targetSwitchCooldown
        }
      };
      
      // Verify unit composition layer
      expect(strategicLayers.unitComposition.workerProtection).toBe(true);
      expect(strategicLayers.unitComposition.protectorThreat).toBe(true);
      
      // Verify positioning layer
      expect(strategicLayers.positioning.combatParasiteRange).toBeGreaterThan(
        strategicLayers.positioning.energyParasiteRange
      );
      expect(strategicLayers.positioning.pursuitDifference).toBeGreaterThan(0);
      
      // Verify resource allocation layer
      expect(strategicLayers.resourceAllocation.combatParasiteReward).toBeGreaterThan(
        strategicLayers.resourceAllocation.energyParasiteReward
      );
      expect(strategicLayers.resourceAllocation.rewardDifference).toBe(2);
      
      // Verify timing layer
      expect(strategicLayers.timing.aggressionDifference).toBeGreaterThan(0);
      expect(strategicLayers.timing.combatTargetCooldown).toBeLessThan(
        strategicLayers.timing.energyTargetCooldown
      );
    });

    test('should validate complete tactical decision tree', () => {
      // Simulate a complex tactical scenario where players must make
      // multiple interconnected decisions based on parasite types
      
      const tacticalScenario = {
        parasiteComposition: { energy: 4, combat: 2 },
        playerUnits: { workers: 3, protectors: 2 },
        energyAvailable: 20,
        decisions: [] as string[]
      };
      
      // Decision 1: Unit prioritization based on parasite threats
      if (tacticalScenario.parasiteComposition.combat > 0) {
        tacticalScenario.decisions.push('prioritize_protector_survival');
      }
      if (tacticalScenario.parasiteComposition.energy > tacticalScenario.parasiteComposition.combat) {
        tacticalScenario.decisions.push('maintain_mining_operations');
      }
      
      // Decision 2: Energy allocation based on threat assessment
      const combatThreat = tacticalScenario.parasiteComposition.combat * PARASITE_STATS[ParasiteType.COMBAT].health;
      const energyThreat = tacticalScenario.parasiteComposition.energy * PARASITE_STATS[ParasiteType.ENERGY].health;
      
      if (combatThreat >= energyThreat) {
        tacticalScenario.decisions.push('allocate_energy_for_combat');
      } else {
        tacticalScenario.decisions.push('allocate_energy_for_expansion');
      }
      
      // Decision 3: Positioning based on parasite targeting behaviors
      const combatTargeting = TARGETING_BEHAVIORS[ParasiteType.COMBAT];
      const energyTargeting = TARGETING_BEHAVIORS[ParasiteType.ENERGY];
      
      if (combatTargeting.maxTargetDistance > energyTargeting.maxTargetDistance) {
        tacticalScenario.decisions.push('maintain_safe_distance_from_combat_parasites');
      }
      
      // Verify tactical decision tree is comprehensive
      expect(tacticalScenario.decisions).toContain('prioritize_protector_survival');
      expect(tacticalScenario.decisions).toContain('maintain_mining_operations');
      expect(tacticalScenario.decisions).toContain('allocate_energy_for_combat');
      expect(tacticalScenario.decisions).toContain('maintain_safe_distance_from_combat_parasites');
      
      // Verify decisions are based on parasite differentiation
      expect(tacticalScenario.decisions.length).toBeGreaterThan(3);
      
      // Verify threat assessment is accurate
      expect(combatThreat).toBe(8); // 2 combat * 4 health each
      expect(energyThreat).toBe(8);  // 4 energy * 2 health each
    });
  });

  describe('Requirements Validation', () => {
    test('should validate all requirements are met in end-to-end scenarios', () => {
      // This test validates that all requirements from the specification
      // are satisfied in realistic gameplay scenarios
      
      const requirementsValidation = {
        // Requirement 1: Combat Parasite Entity
        combatParasiteHealth: PARASITE_STATS[ParasiteType.COMBAT].health,
        combatParasiteTargeting: TARGETING_BEHAVIORS[ParasiteType.COMBAT].primaryTargets[0],
        combatParasiteReward: PARASITE_STATS[ParasiteType.COMBAT].energyReward,
        combatParasiteVisual: PARASITE_STATS[ParasiteType.COMBAT].visualScale,
        
        // Requirement 2: Spawn Distribution System
        distributionTracker: new DistributionTracker(),
        
        // Requirement 3: Combat Targeting Logic
        combatPrimaryTarget: TARGETING_BEHAVIORS[ParasiteType.COMBAT].primaryTargets[0],
        combatSecondaryTarget: TARGETING_BEHAVIORS[ParasiteType.COMBAT].secondaryTargets[0],
        
        // Requirement 4: Enhanced Combat Mechanics
        combatParasiteAttackDamage: PARASITE_STATS[ParasiteType.COMBAT].attackDamage,
        
        // Requirement 5: Visual Differentiation
        energyVisualScale: PARASITE_STATS[ParasiteType.ENERGY].visualScale,
        combatVisualScale: PARASITE_STATS[ParasiteType.COMBAT].visualScale,
        
        // Requirement 6: Integration with Existing Systems
        energyParasiteHealth: PARASITE_STATS[ParasiteType.ENERGY].health,
        energyParasiteTargeting: TARGETING_BEHAVIORS[ParasiteType.ENERGY].primaryTargets[0]
      };
      
      // Validate Requirement 1: Combat Parasite Entity
      expect(requirementsValidation.combatParasiteHealth).toBe(4); // 4-5 hits health
      expect(requirementsValidation.combatParasiteTargeting).toBe('protector'); // Prioritize protectors
      expect(requirementsValidation.combatParasiteReward).toBe(4); // Appropriate energy reward
      expect(requirementsValidation.combatParasiteVisual).toBe(1.2); // Distinct visual appearance
      
      // Validate Requirement 2: Spawn Distribution System
      const spawnTypes = [];
      for (let i = 0; i < 40; i++) {
        const nextType = requirementsValidation.distributionTracker.getNextParasiteType();
        spawnTypes.push(nextType);
        requirementsValidation.distributionTracker.recordSpawn(nextType, `deposit_${i % 3}`);
      }
      
      const energyCount = spawnTypes.filter(t => t === ParasiteType.ENERGY).length;
      const combatCount = spawnTypes.filter(t => t === ParasiteType.COMBAT).length;
      const energyRatio = energyCount / 40;
      const combatRatio = combatCount / 40;
      
      expect(energyRatio).toBeGreaterThan(0.6); // Trending toward 75%
      expect(combatRatio).toBeGreaterThan(0.1); // Trending toward 25%
      
      // Validate Requirement 3: Combat Targeting Logic
      expect(requirementsValidation.combatPrimaryTarget).toBe('protector');
      expect(requirementsValidation.combatSecondaryTarget).toBe('worker');
      
      // Validate Requirement 4: Enhanced Combat Mechanics
      expect(requirementsValidation.combatParasiteAttackDamage).toBe(2);
      
      // Validate Requirement 5: Visual Differentiation
      expect(requirementsValidation.combatVisualScale).toBeGreaterThan(requirementsValidation.energyVisualScale);
      
      // Validate Requirement 6: Integration with Existing Systems
      expect(requirementsValidation.energyParasiteHealth).toBe(2); // Existing functionality preserved
      expect(requirementsValidation.energyParasiteTargeting).toBe('worker'); // Existing behavior preserved
    });
  });
});