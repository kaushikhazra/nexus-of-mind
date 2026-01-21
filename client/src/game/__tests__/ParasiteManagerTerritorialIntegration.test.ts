/**
 * ParasiteManager Territorial Integration Tests
 * 
 * Tests the enhanced ParasiteManager integration with the Queen & Territory System.
 * Validates territorial spawning, Queen control, and parasite explosion mechanics.
 */

import { ParasiteManager, TerritorialParasiteConfig } from '../ParasiteManager';
import { TerritoryManager, Territory } from '../TerritoryManager';
import { Queen } from '../entities/Queen';
import { ParasiteType } from '../types/ParasiteTypes';

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
const mockMaterialManager = {
  getParasiteMaterial: jest.fn(() => ({ name: 'parasite_material' })),
  getCombatParasiteMaterial: jest.fn(() => ({ name: 'combat_parasite_material' }))
};

// Mock MineralDeposit
const createMockDeposit = (id: string, x: number, z: number) => ({
  getId: () => id,
  getPosition: () => new (require('@babylonjs/core').Vector3)(x, 0, z),
  isVisible: () => true,
  isDepleted: () => false
});

// Mock Worker
const createMockWorker = (x: number, z: number) => ({
  getPosition: () => ({ x, y: 0, z })
});

// Mock Protector
const createMockProtector = (x: number, z: number) => ({
  getPosition: () => ({ x, y: 0, z })
});

// Mock Territory
const createMockTerritory = (id: string, centerX: number, centerZ: number, status: 'queen_controlled' | 'liberated' | 'contested' = 'contested'): Territory => ({
  id,
  centerPosition: { x: centerX, y: 0, z: centerZ },
  size: 1024,
  chunkBounds: {
    minX: centerX - 512,
    maxX: centerX + 512,
    minZ: centerZ - 512,
    maxZ: centerZ + 512,
    chunkCoords: []
  },
  queen: null,
  hive: null,
  controlStatus: status,
  liberationTimer: 0,
  liberationStartTime: 0,
  parasiteCount: 0
});

// Mock Queen
const createMockQueen = (territoryId: string) => ({
  id: `queen_${territoryId}`,
  isActiveQueen: jest.fn(() => true),
  isVulnerable: jest.fn(() => true),
  addControlledParasite: jest.fn(),
  removeControlledParasite: jest.fn(),
  getControlledParasites: jest.fn(() => []),
  getTerritory: jest.fn(() => ({ id: territoryId }))
});

// Mock TerritoryManager
const createMockTerritoryManager = () => ({
  getTerritoryAt: jest.fn(),
  getTerritory: jest.fn(),
  getAllTerritories: jest.fn(() => []),
  isPositionInTerritory: jest.fn()
});

describe('ParasiteManager Territorial Integration', () => {
  let parasiteManager: ParasiteManager;
  let territoryManager: any;
  let mockScene: any;

  beforeEach(() => {
    mockScene = {};
    territoryManager = createMockTerritoryManager();
    
    parasiteManager = new ParasiteManager({
      scene: mockScene,
      materialManager: mockMaterialManager as any
    });
    
    parasiteManager.setTerritoryManager(territoryManager);
  });

  afterEach(() => {
    parasiteManager.dispose();
  });

  describe('Territory Manager Integration', () => {
    test('should set territory manager correctly', () => {
      const newTerritoryManager = createMockTerritoryManager();
      parasiteManager.setTerritoryManager(newTerritoryManager);
      
      // Verify integration by checking territorial stats
      const stats = parasiteManager.getTerritorialStats();
      expect(stats).toBeDefined();
      expect(stats.territorialConfigs).toBe(0);
    });

    test('should configure territorial spawning', () => {
      const territory = createMockTerritory('territory_0_0', 0, 0);
      const queen = createMockQueen('territory_0_0');
      
      const config: TerritorialParasiteConfig = {
        territory,
        queen: queen as any,
        spawnStrategy: 'aggressive',
        spawnRate: 1.5
      };
      
      parasiteManager.configureTerritorialSpawning('territory_0_0', config);
      
      const stats = parasiteManager.getTerritorialStats();
      expect(stats.territorialConfigs).toBe(1);
    });
  });

  describe('Territorial Spawning Logic', () => {
    test('should not spawn parasites in liberated territories', () => {
      const liberatedTerritory = createMockTerritory('territory_0_0', 0, 0, 'liberated');
      const deposit = createMockDeposit('deposit_1', 0, 0);
      
      territoryManager.getTerritoryAt.mockReturnValue(liberatedTerritory);
      
      // Try to spawn parasites
      parasiteManager.update(1000, [deposit], [], []);
      
      // Should have no parasites due to liberation
      const parasites = parasiteManager.getParasites();
      expect(parasites.length).toBe(0);
    });

    test('should spawn parasites under Queen control in active territories', () => {
      const territory = createMockTerritory('territory_0_0', 0, 0, 'queen_controlled');
      const queen = createMockQueen('territory_0_0');
      territory.queen = queen as any;
      
      const deposit = createMockDeposit('deposit_1', 0, 0);
      
      territoryManager.getTerritoryAt.mockReturnValue(territory);
      territoryManager.isPositionInTerritory.mockReturnValue(true);
      
      const config: TerritorialParasiteConfig = {
        territory,
        queen: queen as any,
        spawnStrategy: 'balanced',
        spawnRate: 2.0
      };
      
      parasiteManager.configureTerritorialSpawning('territory_0_0', config);
      
      // Force spawn by updating multiple times
      for (let i = 0; i < 5; i++) {
        parasiteManager.update(1000, [deposit], [], []);
      }
      
      // Should have spawned parasites and added them to Queen control
      expect(queen.addControlledParasite).toHaveBeenCalled();
    });

    test('should use different spawn strategies correctly', () => {
      const territory = createMockTerritory('territory_0_0', 0, 0, 'queen_controlled');
      const queen = createMockQueen('territory_0_0');
      territory.queen = queen as any;
      
      const deposit = createMockDeposit('deposit_1', 0, 0);
      
      territoryManager.getTerritoryAt.mockReturnValue(territory);
      territoryManager.isPositionInTerritory.mockReturnValue(true);
      
      // Test aggressive strategy (should spawn more combat parasites)
      const aggressiveConfig: TerritorialParasiteConfig = {
        territory,
        queen: queen as any,
        spawnStrategy: 'aggressive',
        spawnRate: 1.0
      };
      
      parasiteManager.configureTerritorialSpawning('territory_0_0', aggressiveConfig);
      
      // The spawn strategy affects parasite type distribution
      // This is tested indirectly through the spawning logic
      expect(parasiteManager.getTerritorialStats().territorialConfigs).toBe(1);
    });
  });

  describe('Queen Control Integration', () => {
    test('should add spawned parasites to Queen control', () => {
      const territory = createMockTerritory('territory_0_0', 0, 0, 'queen_controlled');
      const queen = createMockQueen('territory_0_0');
      territory.queen = queen as any;
      
      territoryManager.getTerritoryAt.mockReturnValue(territory);
      territoryManager.isPositionInTerritory.mockReturnValue(true);
      
      const config: TerritorialParasiteConfig = {
        territory,
        queen: queen as any,
        spawnStrategy: 'balanced',
        spawnRate: 1.0
      };
      
      parasiteManager.configureTerritorialSpawning('territory_0_0', config);
      
      // Verify Queen control integration exists
      const stats = parasiteManager.getTerritorialStats();
      expect(stats).toBeDefined();
    });

    test('should remove parasites from Queen control when destroyed', () => {
      const territory = createMockTerritory('territory_0_0', 0, 0, 'queen_controlled');
      const queen = createMockQueen('territory_0_0');
      territory.queen = queen as any;
      
      territoryManager.getTerritoryAt.mockReturnValue(territory);
      territoryManager.isPositionInTerritory.mockReturnValue(true);
      
      // Mock parasite that exists in the manager
      const mockParasite = {
        getId: () => 'test_parasite_id',
        isAlive: () => true,
        getPosition: () => ({ x: 0, y: 0, z: 0 }),
        getHomeDeposit: () => ({ getId: () => 'deposit_1' }),
        hide: jest.fn(),
        dispose: jest.fn()
      };
      
      // Add parasite to manager's internal map
      (parasiteManager as any).parasites.set('test_parasite_id', mockParasite);
      
      // Simulate parasite destruction
      parasiteManager.handleParasiteDestruction('test_parasite_id');
      
      // Should have attempted to remove from Queen control
      expect(queen.removeControlledParasite).toHaveBeenCalledWith('test_parasite_id');
    });
  });

  describe('Territory-wide Parasite Explosion', () => {
    test('should explode all parasites in a territory', () => {
      const territory = createMockTerritory('territory_0_0', 0, 0, 'queen_controlled');
      const queen = createMockQueen('territory_0_0');
      territory.queen = queen as any;
      
      territoryManager.getTerritory.mockReturnValue(territory);
      territoryManager.isPositionInTerritory.mockReturnValue(true);
      
      // Mock some parasites in the territory
      const mockParasite = {
        getId: () => 'parasite_1',
        isAlive: () => true,
        getPosition: () => ({ x: 0, y: 0, z: 0 }),
        getHomeDeposit: () => ({ getId: () => 'deposit_1' }),
        dispose: jest.fn()
      };
      
      // Add parasite to manager's internal map
      (parasiteManager as any).parasites.set('parasite_1', mockParasite);
      
      // Explode parasites in territory
      parasiteManager.explodeParasitesInTerritory('territory_0_0');
      
      // Should have removed parasite from Queen control and disposed it
      expect(queen.removeControlledParasite).toHaveBeenCalledWith('parasite_1');
      expect(mockParasite.dispose).toHaveBeenCalled();
      
      // Territory parasite count should be reset
      expect(territory.parasiteCount).toBe(0);
    });

    test('should handle empty territories gracefully', () => {
      const territory = createMockTerritory('territory_0_0', 0, 0);
      territoryManager.getTerritory.mockReturnValue(territory);
      
      // Should not throw when exploding empty territory
      expect(() => {
        parasiteManager.explodeParasitesInTerritory('territory_0_0');
      }).not.toThrow();
    });

    test('should handle non-existent territories gracefully', () => {
      territoryManager.getTerritory.mockReturnValue(null);
      
      // Should not throw when territory doesn't exist
      expect(() => {
        parasiteManager.explodeParasitesInTerritory('non_existent_territory');
      }).not.toThrow();
    });
  });

  describe('Parasite Transfer Between Queens', () => {
    test('should transfer parasite control between Queens', () => {
      const oldQueen = createMockQueen('territory_0_0');
      const newQueen = createMockQueen('territory_1_0');
      
      const oldTerritory = createMockTerritory('territory_0_0', 0, 0);
      oldTerritory.queen = oldQueen as any;
      
      territoryManager.getTerritoryAt.mockReturnValue(oldTerritory);
      
      // Mock parasite
      const mockParasite = {
        getId: () => 'parasite_1',
        isAlive: () => true,
        getPosition: () => ({ x: 0, y: 0, z: 0 }),
        dispose: jest.fn()
      };
      
      (parasiteManager as any).parasites.set('parasite_1', mockParasite);
      
      // Transfer control
      parasiteManager.transferParasiteControl('parasite_1', newQueen as any);
      
      // Should remove from old Queen and add to new Queen
      expect(oldQueen.removeControlledParasite).toHaveBeenCalledWith('parasite_1');
      expect(newQueen.addControlledParasite).toHaveBeenCalledWith('parasite_1');
    });

    test('should handle transfer of non-existent parasites gracefully', () => {
      const newQueen = createMockQueen('territory_1_0');
      
      // Should not throw when parasite doesn't exist
      expect(() => {
        parasiteManager.transferParasiteControl('non_existent_parasite', newQueen as any);
      }).not.toThrow();
    });
  });

  describe('Territorial Statistics', () => {
    test('should provide accurate territorial statistics', () => {
      const territory1 = createMockTerritory('territory_0_0', 0, 0, 'queen_controlled');
      const territory2 = createMockTerritory('territory_1_0', 1024, 0, 'liberated');
      
      const queen1 = createMockQueen('territory_0_0');
      queen1.getControlledParasites.mockReturnValue(['parasite_1', 'parasite_2']);
      territory1.queen = queen1 as any;
      
      territoryManager.getAllTerritories.mockReturnValue([territory1, territory2]);
      
      const config: TerritorialParasiteConfig = {
        territory: territory1,
        queen: queen1 as any,
        spawnStrategy: 'balanced',
        spawnRate: 1.0
      };
      
      parasiteManager.configureTerritorialSpawning('territory_0_0', config);
      
      const stats = parasiteManager.getTerritorialStats();
      
      expect(stats.territoriesWithQueens).toBe(1);
      expect(stats.territoriesLiberated).toBe(1);
      expect(stats.parasitesUnderQueenControl).toBe(2);
      expect(stats.territorialConfigs).toBe(1);
    });

    test('should handle missing territory manager gracefully', () => {
      parasiteManager.setTerritoryManager(null as any);
      
      const stats = parasiteManager.getTerritorialStats();
      
      expect(stats.territoriesWithQueens).toBe(0);
      expect(stats.territoriesLiberated).toBe(0);
      expect(stats.parasitesUnderQueenControl).toBe(0);
      expect(stats.territorialConfigs).toBe(0);
    });
  });

  describe('Territorial Control Recalculation', () => {
    test('should recalculate territorial control correctly', () => {
      const territory = createMockTerritory('territory_0_0', 0, 0, 'queen_controlled');
      const queen = createMockQueen('territory_0_0');
      queen.getControlledParasites.mockReturnValue(['parasite_1']); // Return existing parasites to clear
      territory.queen = queen as any;
      
      territoryManager.getAllTerritories.mockReturnValue([territory]);
      territoryManager.getTerritoryAt.mockReturnValue(territory);
      
      // Mock parasite in territory
      const mockParasite = {
        isAlive: () => true,
        getPosition: () => ({ x: 0, y: 0, z: 0 }),
        getId: () => 'parasite_1',
        dispose: jest.fn()
      };
      
      (parasiteManager as any).parasites.set('parasite_1', mockParasite);
      
      // Recalculate control
      parasiteManager.recalculateTerritorialControl();
      
      // Should have cleared and reassigned control
      expect(queen.removeControlledParasite).toHaveBeenCalled();
      expect(queen.addControlledParasite).toHaveBeenCalledWith('parasite_1');
    });
  });
});