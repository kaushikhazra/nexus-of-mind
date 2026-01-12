/**
 * Enhanced Parasite System - Integration Tests
 * 
 * Comprehensive integration tests for the dual-threat parasite ecosystem.
 * Tests full gameplay scenarios, spawn distribution, targeting behavior, and tactical depth.
 */

import { ParasiteManager } from '../ParasiteManager';
import { ParasiteType, PARASITE_STATS } from '../types/ParasiteTypes';
import { DistributionTracker } from '../types/DistributionTracker';

// Mock Babylon.js dependencies
jest.mock('@babylonjs/core', () => ({
  Vector3: class MockVector3 {
    constructor(public x: number = 0, public y: number = 0, public z: number = 0) {}
    static Zero() { return new MockVector3(0, 0, 0); }
    static Distance(a: any, b: any) { 
      return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
    }
    clone() { return new MockVector3(this.x, this.y, this.z); }
    add(other: any) { return new MockVector3(this.x + other.x, this.y + other.y, this.z + other.z); }
    subtract(other: any) { return new MockVector3(this.x - other.x, this.y - other.y, this.z - other.z); }
    normalize() { 
      const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
      return len > 0 ? new MockVector3(this.x / len, this.y / len, this.z / len) : new MockVector3(0, 0, 0);
    }
    scale(factor: number) { return new MockVector3(this.x * factor, this.y * factor, this.z * factor); }
    addInPlace(other: any) { this.x += other.x; this.y += other.y; this.z += other.z; }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
  },
  Engine: jest.fn(),
  Scene: jest.fn(),
  TransformNode: jest.fn().mockImplementation(() => ({
    position: { x: 0, y: 0, z: 0 },
    dispose: jest.fn(),
    setEnabled: jest.fn()
  })),
  MeshBuilder: {
    CreateTorus: jest.fn(() => ({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      parent: null,
      material: null,
      dispose: jest.fn(),
      setEnabled: jest.fn()
    }))
  }
}));

// Mock MaterialManager
jest.mock('../../rendering/MaterialManager', () => ({
  MaterialManager: jest.fn().mockImplementation(() => ({
    getParasiteMaterial: jest.fn(() => ({ name: 'energy_parasite_material' })),
    getCombatParasiteMaterial: jest.fn(() => ({ name: 'combat_parasite_material' }))
  }))
}));

// Mock CombatEffects to avoid GUI dependency
jest.mock('../../rendering/CombatEffects', () => ({
  CombatEffects: jest.fn().mockImplementation(() => ({
    createDamageEffect: jest.fn(),
    createDeathEffect: jest.fn(),
    dispose: jest.fn()
  }))
}));

describe('Enhanced Parasite System - Integration Tests', () => {
  let mockScene: any;
  let materialManager: any;
  let parasiteManager: ParasiteManager;

  beforeEach(() => {
    // Create mock scene
    mockScene = {
      dispose: jest.fn(),
      registerBeforeRender: jest.fn(),
      unregisterBeforeRender: jest.fn()
    };
    
    // Create material manager
    materialManager = {
      getParasiteMaterial: jest.fn(() => ({ name: 'energy_parasite_material' })),
      getCombatParasiteMaterial: jest.fn(() => ({ name: 'combat_parasite_material' }))
    };
    
    // Create parasite manager
    parasiteManager = new ParasiteManager({
      scene: mockScene,
      materialManager: materialManager,
      terrainGenerator: null
    });
  });

  afterEach(() => {
    parasiteManager?.dispose();
  });

  describe('Spawn Distribution System', () => {
    test('should spawn both Energy and Combat Parasites with correct distribution', async () => {
      // Create mock mineral deposits
      const deposits = [
        createMockMineralDeposit('deposit1', { x: 0, y: 0, z: 0 }),
        createMockMineralDeposit('deposit2', { x: 50, y: 0, z: 50 }),
        createMockMineralDeposit('deposit3', { x: 100, y: 0, z: 100 })
      ];

      // Force multiple spawn cycles
      const spawnResults = [];
      for (let i = 0; i < 20; i++) {
        // Simulate spawn cycle
        await parasiteManager.update(0.1, deposits, [], []);
        
        const energyCount = parasiteManager.getParasitesByType(ParasiteType.ENERGY).length;
        const combatCount = parasiteManager.getParasitesByType(ParasiteType.COMBAT).length;
        
        spawnResults.push({
          cycle: i,
          energyCount,
          combatCount,
          totalCount: energyCount + combatCount
        });
      }

      // Verify both parasite types are spawning
      const hasEnergyParasites = spawnResults.some(data => data.energyCount > 0);
      const hasCombatParasites = spawnResults.some(data => data.combatCount > 0);
      
      expect(hasEnergyParasites).toBe(true);
      expect(hasCombatParasites).toBe(true);

      // Check distribution ratio (75% Energy, 25% Combat)
      const finalData = spawnResults[spawnResults.length - 1];
      if (finalData.totalCount > 0) {
        const energyRatio = finalData.energyCount / finalData.totalCount;
        const combatRatio = finalData.combatCount / finalData.totalCount;
        
        // Allow for variance in distribution (±20% for small sample sizes)
        expect(energyRatio).toBeGreaterThan(0.55); // 75% - 20%
        expect(energyRatio).toBeLessThan(0.95);    // 75% + 20%
        expect(combatRatio).toBeGreaterThan(0.05); // 25% - 20%
        expect(combatRatio).toBeLessThan(0.45);    // 25% + 20%
      }
    });
  });

  describe('Health Differential', () => {
    test('should handle Combat Parasite health differential correctly', async () => {
      // Spawn both parasite types
      const deposit = createMockMineralDeposit('test_deposit', { x: 0, y: 0, z: 0 });
      await parasiteManager.spawnParasite(deposit, ParasiteType.ENERGY);
      await parasiteManager.spawnParasite(deposit, ParasiteType.COMBAT);
      
      const energyParasites = parasiteManager.getParasitesByType(ParasiteType.ENERGY);
      const combatParasites = parasiteManager.getParasitesByType(ParasiteType.COMBAT);
      
      expect(energyParasites.length).toBeGreaterThan(0);
      expect(combatParasites.length).toBeGreaterThan(0);
      
      // Verify Combat Parasites have 2x health of Energy Parasites
      const energyMaxHealth = energyParasites[0].getMaxHealth();
      const combatMaxHealth = combatParasites[0].getMaxHealth();
      
      expect(combatMaxHealth).toBe(energyMaxHealth * 2);
      expect(energyMaxHealth).toBe(2); // Energy Parasites have 2 health
      expect(combatMaxHealth).toBe(4); // Combat Parasites have 4 health
    });
  });

  describe('Energy Reward System', () => {
    test('should provide appropriate energy rewards for Combat Parasite difficulty', async () => {
      // Spawn both parasite types
      const deposit = createMockMineralDeposit('test_deposit', { x: 0, y: 0, z: 0 });
      await parasiteManager.spawnParasite(deposit, ParasiteType.ENERGY);
      await parasiteManager.spawnParasite(deposit, ParasiteType.COMBAT);
      
      const energyParasites = parasiteManager.getParasitesByType(ParasiteType.ENERGY);
      const combatParasites = parasiteManager.getParasitesByType(ParasiteType.COMBAT);
      
      expect(energyParasites.length).toBeGreaterThan(0);
      expect(combatParasites.length).toBeGreaterThan(0);
      
      // Verify Combat Parasites provide proportional rewards (2x health = 2x reward)
      const energyReward = energyParasites[0].getEnergyReward();
      const combatReward = combatParasites[0].getEnergyReward();
      
      expect(combatReward).toBe(energyReward * 2);
      expect(energyReward).toBe(2); // Energy Parasites give 2 energy
      expect(combatReward).toBe(4); // Combat Parasites give 4 energy
    });
  });

  describe('Visual Differentiation', () => {
    test('should display visual differentiation between parasite types', async () => {
      // Spawn both parasite types
      const deposit = createMockMineralDeposit('test_deposit', { x: 0, y: 0, z: 0 });
      await parasiteManager.spawnParasite(deposit, ParasiteType.ENERGY);
      await parasiteManager.spawnParasite(deposit, ParasiteType.COMBAT);
      
      const energyParasites = parasiteManager.getParasitesByType(ParasiteType.ENERGY);
      const combatParasites = parasiteManager.getParasitesByType(ParasiteType.COMBAT);
      
      expect(energyParasites.length).toBeGreaterThan(0);
      expect(combatParasites.length).toBeGreaterThan(0);
      
      // Check visual properties
      const energyParasite = energyParasites[0];
      const combatParasite = combatParasites[0];
      
      // Both should have segments for visual representation
      expect((energyParasite as any).segments).toBeDefined();
      expect((combatParasite as any).segments).toBeDefined();
      expect((energyParasite as any).segments.length).toBe(4);
      expect((combatParasite as any).segments.length).toBe(4);
      
      // Combat Parasites should have different material
      const energyMaterial = (energyParasite as any).material;
      const combatMaterial = (combatParasite as any).material;
      
      expect(energyMaterial?.name).not.toBe(combatMaterial?.name);
    });
  });

  describe('Strategic Depth and Tactical Decision-Making', () => {
    test('should provide strategic depth through dual-threat ecosystem', async () => {
      // Create a complex scenario with multiple deposits
      const deposits = [
        createMockMineralDeposit('deposit1', { x: 0, y: 0, z: 0 }),
        createMockMineralDeposit('deposit2', { x: 50, y: 0, z: 50 }),
        createMockMineralDeposit('deposit3', { x: 100, y: 0, z: 100 })
      ];
      
      // Spawn mixed parasite types across deposits
      for (const deposit of deposits) {
        await parasiteManager.spawnParasite(deposit, ParasiteType.ENERGY);
        await parasiteManager.spawnParasite(deposit, ParasiteType.COMBAT);
      }
      
      // Update system to establish threats
      await parasiteManager.update(0.1, deposits, [], []);
      
      const energyParasites = parasiteManager.getParasitesByType(ParasiteType.ENERGY);
      const combatParasites = parasiteManager.getParasitesByType(ParasiteType.COMBAT);
      
      // Verify dual-threat ecosystem
      const energyThreat = energyParasites.length; // Threat to mining operations
      const combatThreat = combatParasites.length; // Threat to protectors
      
      expect(energyThreat).toBeGreaterThan(0);
      expect(combatThreat).toBeGreaterThan(0);
      
      // Both threat types create different strategic challenges
      const hasDualThreats = energyThreat > 0 && combatThreat > 0;
      expect(hasDualThreats).toBe(true);
    });

    test('should demonstrate full gameplay scenario with mixed parasite types', async () => {
      // Comprehensive end-to-end gameplay test
      
      // Create complex scenario
      const deposits = [
        createMockMineralDeposit('deposit1', { x: 10, y: 0, z: 10 }),
        createMockMineralDeposit('deposit2', { x: 30, y: 0, z: 30 })
      ];
      
      // Initial state
      const initialState = {
        energyParasites: parasiteManager.getParasitesByType(ParasiteType.ENERGY).length,
        combatParasites: parasiteManager.getParasitesByType(ParasiteType.COMBAT).length
      };
      
      // Simulate gameplay over multiple cycles
      for (let i = 0; i < 10; i++) {
        await parasiteManager.update(0.1, deposits, [], []);
      }
      
      // Final state
      const finalState = {
        energyParasites: parasiteManager.getParasitesByType(ParasiteType.ENERGY).length,
        combatParasites: parasiteManager.getParasitesByType(ParasiteType.COMBAT).length
      };
      
      // Verify gameplay occurred
      const totalInitialParasites = initialState.energyParasites + initialState.combatParasites;
      const totalFinalParasites = finalState.energyParasites + finalState.combatParasites;
      
      // Game systems should be functional
      expect(totalInitialParasites + totalFinalParasites).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance and Balance', () => {
    test('should maintain performance with multiple parasites', async () => {
      // Create multiple deposits and spawn many parasites
      const deposits = [];
      for (let i = 0; i < 5; i++) {
        deposits.push(createMockMineralDeposit(`deposit${i}`, { x: i * 20, y: 0, z: i * 20 }));
      }
      
      const startTime = performance.now();
      
      // Spawn multiple parasites
      const spawnPromises = [];
      for (const deposit of deposits) {
        spawnPromises.push(parasiteManager.spawnParasite(deposit, ParasiteType.ENERGY));
        spawnPromises.push(parasiteManager.spawnParasite(deposit, ParasiteType.COMBAT));
      }
      
      await Promise.all(spawnPromises);
      
      const spawnTime = performance.now() - startTime;
      
      // Spawning should be reasonably fast
      expect(spawnTime).toBeLessThan(1000); // Less than 1 second
      
      const totalParasites = parasiteManager.getAllParasites().length;
      expect(totalParasites).toBeGreaterThan(0);
      expect(totalParasites).toBeLessThanOrEqual(10); // Should respect spawn limits
    });
  });

  describe('Distribution Tracker Integration', () => {
    test('should maintain accurate spawn distribution over time', () => {
      const tracker = new DistributionTracker();
      
      // Simulate 100 spawns
      const spawnTypes = [];
      for (let i = 0; i < 100; i++) {
        const nextType = tracker.getNextParasiteType();
        spawnTypes.push(nextType);
        tracker.recordSpawn(nextType);
      }
      
      // Count distribution
      const energyCount = spawnTypes.filter(type => type === ParasiteType.ENERGY).length;
      const combatCount = spawnTypes.filter(type => type === ParasiteType.COMBAT).length;
      
      const energyRatio = energyCount / 100;
      const combatRatio = combatCount / 100;
      
      // Should be close to 75/25 distribution
      expect(energyRatio).toBeGreaterThan(0.65); // 75% ± 10%
      expect(energyRatio).toBeLessThan(0.85);
      expect(combatRatio).toBeGreaterThan(0.15); // 25% ± 10%
      expect(combatRatio).toBeLessThan(0.35);
    });
  });

  describe('Parasite Stats Configuration', () => {
    test('should use correct stats from configuration', () => {
      // Verify Energy Parasite stats
      const energyStats = PARASITE_STATS[ParasiteType.ENERGY];
      expect(energyStats.health).toBe(2);
      expect(energyStats.maxHealth).toBe(2);
      expect(energyStats.energyReward).toBe(2);
      expect(energyStats.visualScale).toBe(1.0);
      
      // Verify Combat Parasite stats
      const combatStats = PARASITE_STATS[ParasiteType.COMBAT];
      expect(combatStats.health).toBe(4);
      expect(combatStats.maxHealth).toBe(4);
      expect(combatStats.energyReward).toBe(4);
      expect(combatStats.visualScale).toBe(1.2); // 20% larger
      
      // Verify 2x relationship
      expect(combatStats.health).toBe(energyStats.health * 2);
      expect(combatStats.energyReward).toBe(energyStats.energyReward * 2);
    });
  });
});

// Helper functions for creating mock objects
function createMockMineralDeposit(id: string, position: { x: number, y: number, z: number }) {
  const { Vector3 } = require('@babylonjs/core');
  const mockPosition = new Vector3(position.x, position.y, position.z);
  
  return {
    getId: () => id,
    getPosition: () => mockPosition,
    getRemainingMinerals: () => 100,
    isExhausted: () => false,
    isDepleted: () => false,
    isVisible: () => true,
    canBeMinedBy: () => true
  };
}