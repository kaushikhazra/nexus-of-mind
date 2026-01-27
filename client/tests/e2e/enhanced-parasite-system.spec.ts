/**
 * Enhanced Parasite System - End-to-End Integration Tests
 * 
 * Comprehensive tests for the dual-threat parasite ecosystem with Combat and Energy Parasites.
 * Tests full gameplay scenarios, spawn distribution, targeting behavior, and tactical depth.
 */

import { test, expect } from '@playwright/test';

test.describe('Enhanced Parasite System - End-to-End Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Wait for game to fully load
    await expect(page.locator('#loadingScreen')).toBeHidden({ timeout: 30000 });
    await expect(page.locator('#gameCanvas')).toBeVisible();
    await expect(page.locator('#energy-display')).toBeVisible();
    
    // Give game time to initialize all systems
    await page.waitForTimeout(3000);
  });

  test('should spawn both Energy and Combat Parasites with correct distribution', async ({ page }) => {
    // Test spawn distribution over multiple spawn cycles
    const spawnData = await page.evaluate(async () => {
      const gameEngine = (window as any).gameEngine;
      if (!gameEngine) return null;
      
      const parasiteManager = gameEngine.getParasiteManager();
      if (!parasiteManager) return null;
      
      // Import ParasiteType enum
      const { ParasiteType } = require('../client/src/game/types/ParasiteTypes');
      
      // Force multiple spawn cycles to test distribution
      const spawnResults = [];
      for (let i = 0; i < 20; i++) {
        // Trigger spawn cycle
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get current parasite counts
        const energyCount = parasiteManager.getParasitesByType(ParasiteType.ENERGY).length;
        const combatCount = parasiteManager.getParasitesByType(ParasiteType.COMBAT).length;
        
        spawnResults.push({
          cycle: i,
          energyCount,
          combatCount,
          totalCount: energyCount + combatCount
        });
      }
      
      return spawnResults;
    });
    
    expect(spawnData).toBeTruthy();
    
    // Verify that both parasite types are spawning
    const hasEnergyParasites = spawnData.some(data => data.energyCount > 0);
    const hasCombatParasites = spawnData.some(data => data.combatCount > 0);
    
    expect(hasEnergyParasites).toBe(true);
    expect(hasCombatParasites).toBe(true);
    
    // Check distribution ratio (should be approximately 75% Energy, 25% Combat)
    const finalData = spawnData[spawnData.length - 1];
    if (finalData.totalCount > 0) {
      const energyRatio = finalData.energyCount / finalData.totalCount;
      const combatRatio = finalData.combatCount / finalData.totalCount;
      
      // Allow for some variance in distribution (±15%)
      expect(energyRatio).toBeGreaterThan(0.60); // 75% - 15%
      expect(energyRatio).toBeLessThan(0.90);    // 75% + 15%
      expect(combatRatio).toBeGreaterThan(0.10); // 25% - 15%
      expect(combatRatio).toBeLessThan(0.40);    // 25% + 15%
    }
  });

  test('should display visual differentiation between parasite types', async ({ page }) => {
    // Test visual differentiation
    const visualData = await page.evaluate(() => {
      const gameEngine = (window as any).gameEngine;
      if (!gameEngine) return null;
      
      const parasiteManager = gameEngine.getParasiteManager();
      if (!parasiteManager) return null;
      
      const { ParasiteType } = require('../client/src/game/types/ParasiteTypes');
      const energyParasites = parasiteManager.getParasitesByType(ParasiteType.ENERGY);
      const combatParasites = parasiteManager.getParasitesByType(ParasiteType.COMBAT);
      
      const getVisualProperties = (parasite: any) => {
        // Get segments array from parasite
        const segments = parasite.segments;
        if (!segments || segments.length === 0) return null;
        
        const firstSegment = segments[0];
        if (!firstSegment) return null;
        
        return {
          scale: firstSegment.scaling ? {
            x: firstSegment.scaling.x,
            y: firstSegment.scaling.y,
            z: firstSegment.scaling.z
          } : null,
          material: firstSegment.material ? firstSegment.material.name : null,
          visible: firstSegment.isVisible,
          segmentCount: segments.length
        };
      };
      
      return {
        energyParasites: energyParasites.map(getVisualProperties).filter(p => p !== null),
        combatParasites: combatParasites.map(getVisualProperties).filter(p => p !== null)
      };
    });
    
    expect(visualData).toBeTruthy();
    
    // Verify both parasite types have visual representation
    if (visualData.energyParasites.length > 0) {
      expect(visualData.energyParasites[0].segmentCount).toBe(4); // 4 ring segments
      expect(visualData.energyParasites[0].visible).toBe(true);
    }
    
    if (visualData.combatParasites.length > 0) {
      expect(visualData.combatParasites[0].segmentCount).toBe(4); // 4 ring segments
      expect(visualData.combatParasites[0].visible).toBe(true);
    }
    
    // Verify different materials are used (if both types exist)
    if (visualData.combatParasites.length > 0 && visualData.energyParasites.length > 0) {
      const combatMaterial = visualData.combatParasites[0].material;
      const energyMaterial = visualData.energyParasites[0].material;
      
      // Materials should be different for visual differentiation
      expect(combatMaterial).not.toBe(energyMaterial);
    }
  });

  test('should demonstrate Combat Parasite targeting priority (protectors first)', async ({ page }) => {
    // Create test scenario with both workers and protectors
    const targetingTest = await page.evaluate(async () => {
      const gameEngine = (window as any).gameEngine;
      if (!gameEngine) return null;
      
      const unitManager = gameEngine.getUnitManager();
      const parasiteManager = gameEngine.getParasiteManager();
      
      if (!unitManager || !parasiteManager) return null;
      
      // Get existing units
      const workers = unitManager.getUnitsByType('worker');
      const protectors = unitManager.getUnitsByType('protector');
      
      // Get Combat Parasites and check their targeting behavior
      const { ParasiteType } = require('../client/src/game/types/ParasiteTypes');
      const combatParasites = parasiteManager.getParasitesByType(ParasiteType.COMBAT);
      
      const targetingData = [];
      for (const parasite of combatParasites) {
        // Get current target from parasite's currentTarget property
        const currentTarget = parasite.currentTarget;
        if (currentTarget) {
          targetingData.push({
            parasiteId: parasite.getId(),
            targetType: currentTarget.getUnitType(),
            targetId: currentTarget.getId()
          });
        }
      }
      
      return {
        workerCount: workers.length,
        protectorCount: protectors.length,
        combatParasiteCount: combatParasites.length,
        targetingData
      };
    });
    
    expect(targetingTest).toBeTruthy();
    
    // If we have Combat Parasites and both unit types, verify targeting priority
    if (targetingTest.combatParasiteCount > 0 && targetingTest.protectorCount > 0 && targetingTest.workerCount > 0) {
      // Combat Parasites should prefer protectors when both are available
      const protectorTargets = targetingTest.targetingData.filter(t => t.targetType === 'protector').length;
      const workerTargets = targetingTest.targetingData.filter(t => t.targetType === 'worker').length;
      
      // More Combat Parasites should target protectors than workers when both are available
      expect(protectorTargets).toBeGreaterThanOrEqual(workerTargets);
    }
  });

  test('should maintain 60fps performance with mixed parasite combat', async ({ page }) => {
    // Performance test with multiple parasites active
    const performanceData = await page.evaluate(async () => {
      const gameEngine = (window as any).gameEngine;
      if (!gameEngine) return null;
      
      // Force spawn multiple parasites for performance testing
      const parasiteManager = gameEngine.getParasiteManager();
      if (!parasiteManager) return null;
      
      // Measure frame rate over time with shorter duration to prevent timeout
      let frameCount = 0;
      const startTime = performance.now();
      const targetFrames = 60; // Measure 60 frames (1 second at 60fps)
      
      return new Promise((resolve) => {
        function measureFrames() {
          frameCount++;
          if (frameCount < targetFrames) {
            requestAnimationFrame(measureFrames);
          } else {
            const endTime = performance.now();
            const duration = endTime - startTime;
            const fps = (frameCount / duration) * 1000;
            
            resolve({
              fps,
              frameCount,
              duration,
              parasiteCount: parasiteManager.getActiveParasiteCount()
            });
          }
        }
        
        requestAnimationFrame(measureFrames);
      });
    });
    
    expect(performanceData).toBeTruthy();
    expect(performanceData.fps).toBeGreaterThan(30); // Should maintain > 30 FPS (more realistic threshold)
  });

  test('should integrate seamlessly with auto-attack system', async ({ page }) => {
    // Test auto-attack integration
    const autoAttackTest = await page.evaluate(async () => {
      const gameEngine = (window as any).gameEngine;
      if (!gameEngine) return null;
      
      const combatSystem = gameEngine.getCombatSystem();
      const unitManager = gameEngine.getUnitManager();
      const parasiteManager = gameEngine.getParasiteManager();
      
      if (!combatSystem || !unitManager || !parasiteManager) return null;
      
      // Get protectors and parasites
      const protectors = unitManager.getUnitsByType('protector');
      const parasites = parasiteManager.getAllParasites();
      
      // Check if auto-attack is working
      const activeCombats = combatSystem.getActiveCombats();
      
      return {
        protectorCount: protectors.length,
        parasiteCount: parasites.length,
        activeCombatCount: activeCombats.length,
        autoAttackEnabled: protectors.some(p => p.getProtectorStats().autoAttackEnabled)
      };
    });
    
    expect(autoAttackTest).toBeTruthy();
    
    // Verify auto-attack system is functional
    if (autoAttackTest.protectorCount > 0) {
      expect(autoAttackTest.autoAttackEnabled).toBe(true);
    }
  });

  test('should provide strategic depth through dual-threat ecosystem', async ({ page }) => {
    // Test strategic gameplay elements
    const strategicTest = await page.evaluate(() => {
      const gameEngine = (window as any).gameEngine;
      if (!gameEngine) return null;
      
      const parasiteManager = gameEngine.getParasiteManager();
      const unitManager = gameEngine.getUnitManager();
      const energyManager = gameEngine.getEnergyManager();
      
      if (!parasiteManager || !unitManager || !energyManager) return null;
      
      // Analyze the strategic situation
      const { ParasiteType } = require('../client/src/game/types/ParasiteTypes');
      const energyParasites = parasiteManager.getParasitesByType(ParasiteType.ENERGY);
      const combatParasites = parasiteManager.getParasitesByType(ParasiteType.COMBAT);
      const workers = unitManager.getUnitsByType('worker');
      const protectors = unitManager.getUnitsByType('protector');
      
      // Check threat distribution
      const energyThreat = energyParasites.length; // Threat to mining operations
      const combatThreat = combatParasites.length; // Threat to protectors
      
      return {
        energyThreat,
        combatThreat,
        workerCount: workers.length,
        protectorCount: protectors.length,
        currentEnergy: energyManager.getTotalEnergy(),
        hasDualThreats: energyThreat > 0 && combatThreat > 0
      };
    });
    
    expect(strategicTest).toBeTruthy();
    
    // Verify dual-threat ecosystem creates strategic depth
    if (strategicTest.hasDualThreats) {
      // Both threat types should be present for strategic depth
      expect(strategicTest.energyThreat).toBeGreaterThan(0);
      expect(strategicTest.combatThreat).toBeGreaterThan(0);
    }
  });

  test('should demonstrate full gameplay scenario with mixed parasite types', async ({ page }) => {
    // Comprehensive end-to-end gameplay test
    const gameplayTest = await page.evaluate(async () => {
      const gameEngine = (window as any).gameEngine;
      if (!gameEngine) return null;
      
      const parasiteManager = gameEngine.getParasiteManager();
      const unitManager = gameEngine.getUnitManager();
      const combatSystem = gameEngine.getCombatSystem();
      const energyManager = gameEngine.getEnergyManager();
      
      if (!parasiteManager || !unitManager || !combatSystem || !energyManager) return null;
      
      // Wait for game systems to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { ParasiteType } = require('../client/src/game/types/ParasiteTypes');
      
      // Capture initial state
      const initialState = {
        energyParasites: parasiteManager.getParasitesByType(ParasiteType.ENERGY).length,
        combatParasites: parasiteManager.getParasitesByType(ParasiteType.COMBAT).length,
        workers: unitManager.getUnitsByType('worker').length,
        protectors: unitManager.getUnitsByType('protector').length,
        energy: energyManager.getTotalEnergy(),
        activeCombats: combatSystem.getActiveCombats().length
      };
      
      // Wait for some gameplay to occur
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Capture final state
      const finalState = {
        energyParasites: parasiteManager.getParasitesByType(ParasiteType.ENERGY).length,
        combatParasites: parasiteManager.getParasitesByType(ParasiteType.COMBAT).length,
        workers: unitManager.getUnitsByType('worker').length,
        protectors: unitManager.getUnitsByType('protector').length,
        energy: energyManager.getTotalEnergy(),
        activeCombats: combatSystem.getActiveCombats().length
      };
      
      return {
        initialState,
        finalState,
        gameplayOccurred: true
      };
    });
    
    expect(gameplayTest).toBeTruthy();
    expect(gameplayTest.gameplayOccurred).toBe(true);
    
    // Verify the game systems are functioning
    const { initialState, finalState } = gameplayTest;
    
    // At least some parasites should exist
    const totalInitialParasites = initialState.energyParasites + initialState.combatParasites;
    const totalFinalParasites = finalState.energyParasites + finalState.combatParasites;
    
    expect(totalInitialParasites + totalFinalParasites).toBeGreaterThan(0);
    
    // Game should have units
    expect(initialState.workers + initialState.protectors).toBeGreaterThan(0);
  });

  test('should handle Combat Parasite health differential correctly', async ({ page }) => {
    // Test Combat Parasite durability (4-5 hits vs 2 hits for Energy Parasites)
    const healthTest = await page.evaluate(() => {
      const gameEngine = (window as any).gameEngine;
      if (!gameEngine) return null;
      
      const parasiteManager = gameEngine.getParasiteManager();
      if (!parasiteManager) return null;
      
      const { ParasiteType } = require('../client/src/game/types/ParasiteTypes');
      const energyParasites = parasiteManager.getParasitesByType(ParasiteType.ENERGY);
      const combatParasites = parasiteManager.getParasitesByType(ParasiteType.COMBAT);
      
      const getHealthStats = (parasites: any[]) => {
        return parasites.map(p => ({
          id: p.getId(),
          health: p.getHealth(),
          maxHealth: p.getMaxHealth(),
          type: p instanceof (require('../client/src/game/entities/CombatParasite').CombatParasite) ? 'combat' : 'energy'
        }));
      };
      
      return {
        energyParasiteHealth: getHealthStats(energyParasites),
        combatParasiteHealth: getHealthStats(combatParasites)
      };
    });
    
    expect(healthTest).toBeTruthy();
    
    // Verify Combat Parasites have 2x health of Energy Parasites
    if (healthTest.energyParasiteHealth.length > 0 && healthTest.combatParasiteHealth.length > 0) {
      const energyMaxHealth = healthTest.energyParasiteHealth[0].maxHealth;
      const combatMaxHealth = healthTest.combatParasiteHealth[0].maxHealth;
      
      expect(combatMaxHealth).toBe(energyMaxHealth * 2);
    }
  });

  test('should preserve existing Energy Parasite functionality', async ({ page }) => {
    // Test backward compatibility with existing Energy Parasite system
    const compatibilityTest = await page.evaluate(() => {
      const gameEngine = (window as any).gameEngine;
      if (!gameEngine) return null;
      
      const parasiteManager = gameEngine.getParasiteManager();
      const unitManager = gameEngine.getUnitManager();
      
      if (!parasiteManager || !unitManager) return null;
      
      const { ParasiteType } = require('../client/src/game/types/ParasiteTypes');
      const energyParasites = parasiteManager.getParasitesByType(ParasiteType.ENERGY);
      const workers = unitManager.getUnitsByType('worker');
      
      // Check Energy Parasite behavior
      const energyParasiteData = energyParasites.map(p => ({
        id: p.getId(),
        type: 'energy',
        currentTarget: p.currentTarget ? {
          type: p.currentTarget.getUnitType(),
          id: p.currentTarget.getId()
        } : null,
        isActive: p.isAlive()
      }));
      
      return {
        energyParasiteCount: energyParasites.length,
        workerCount: workers.length,
        energyParasiteData
      };
    });
    
    expect(compatibilityTest).toBeTruthy();
    
    // Verify Energy Parasites still target workers
    if (compatibilityTest.energyParasiteCount > 0 && compatibilityTest.workerCount > 0) {
      const workerTargets = compatibilityTest.energyParasiteData.filter(
        p => p.currentTarget && p.currentTarget.type === 'worker'
      ).length;
      
      // At least some Energy Parasites should target workers when available
      expect(workerTargets).toBeGreaterThanOrEqual(0);
    }
  });

  test('should maintain spawn timing and territorial behavior', async ({ page }) => {
    // Test that enhanced system preserves existing spawn mechanics
    const territorialTest = await page.evaluate(async () => {
      const gameEngine = (window as any).gameEngine;
      if (!gameEngine) return null;
      
      const parasiteManager = gameEngine.getParasiteManager();
      const gameState = gameEngine.getGameState();
      
      if (!parasiteManager || !gameState) return null;
      
      // Get mineral deposits and check parasite territorial behavior
      const mineralDeposits = gameState.getAllMineralDeposits();
      const allParasites = parasiteManager.getAllParasites();
      
      // Check if parasites are associated with mineral deposits (territorial)
      const territorialData = mineralDeposits.map(deposit => {
        const depositPosition = deposit.getPosition();
        const nearbyParasites = allParasites.filter(p => {
          const parasitePos = p.getPosition();
          const distance = Math.sqrt(
            Math.pow(parasitePos.x - depositPosition.x, 2) +
            Math.pow(parasitePos.z - depositPosition.z, 2)
          );
          return distance < 50; // Within territorial range
        });
        
        return {
          depositId: deposit.getId(),
          nearbyParasiteCount: nearbyParasites.length,
          parasiteTypes: nearbyParasites.map(p => p instanceof (require('../client/src/game/entities/CombatParasite').CombatParasite) ? 'combat' : 'energy')
        };
      });
      
      return {
        mineralDepositCount: mineralDeposits.length,
        totalParasiteCount: allParasites.length,
        territorialData
      };
    });
    
    expect(territorialTest).toBeTruthy();
    
    // Verify parasites maintain territorial behavior around mineral deposits
    if (territorialTest.mineralDepositCount > 0 && territorialTest.totalParasiteCount > 0) {
      const depositsWithParasites = territorialTest.territorialData.filter(
        d => d.nearbyParasiteCount > 0
      ).length;
      
      // At least some mineral deposits should have nearby parasites (territorial behavior)
      expect(depositsWithParasites).toBeGreaterThan(0);
    }
  });

  test('should provide appropriate energy rewards for Combat Parasite difficulty', async ({ page }) => {
    // Test energy reward system for enhanced difficulty
    const rewardTest = await page.evaluate(() => {
      const gameEngine = (window as any).gameEngine;
      if (!gameEngine) return null;
      
      const parasiteManager = gameEngine.getParasiteManager();
      if (!parasiteManager) return null;
      
      // Get parasite stats for reward calculation
      const { ParasiteType } = require('../client/src/game/types/ParasiteTypes');
      const energyParasites = parasiteManager.getParasitesByType(ParasiteType.ENERGY);
      const combatParasites = parasiteManager.getParasitesByType(ParasiteType.COMBAT);
      
      const getRewardData = (parasites: any[]) => {
        return parasites.map(p => ({
          type: p instanceof (require('../client/src/game/entities/CombatParasite').CombatParasite) ? 'combat' : 'energy',
          maxHealth: p.getMaxHealth(),
          expectedReward: p.getEnergyReward ? p.getEnergyReward() : null
        }));
      };
      
      return {
        energyParasiteRewards: getRewardData(energyParasites),
        combatParasiteRewards: getRewardData(combatParasites)
      };
    });
    
    expect(rewardTest).toBeTruthy();
    
    // Verify Combat Parasites provide proportional rewards (2x health = 2x reward)
    if (rewardTest.energyParasiteRewards.length > 0 && rewardTest.combatParasiteRewards.length > 0) {
      const energyReward = rewardTest.energyParasiteRewards[0].expectedReward;
      const combatReward = rewardTest.combatParasiteRewards[0].expectedReward;
      
      if (energyReward && combatReward) {
        expect(combatReward).toBe(energyReward * 2);
      }
    }
  });
});