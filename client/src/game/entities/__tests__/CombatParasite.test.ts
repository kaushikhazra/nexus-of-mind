/**
 * CombatParasite - Unit Tests
 * 
 * Tests for the Combat Parasite entity class to verify proper inheritance,
 * targeting behavior, and visual differentiation from Energy Parasites.
 */

import { Vector3 } from '@babylonjs/core';
import { CombatParasite } from '../CombatParasite';
import { ParasiteType, PARASITE_STATS } from '../../types/ParasiteTypes';

// Mock dependencies
jest.mock('@babylonjs/core', () => ({
    Vector3: jest.fn().mockImplementation((x = 0, y = 0, z = 0) => ({
        x, y, z,
        clone: jest.fn().mockReturnThis(),
        add: jest.fn().mockReturnThis(),
        subtract: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        scale: jest.fn().mockReturnThis(),
        addInPlace: jest.fn()
    })),
    MeshBuilder: {
        CreateTorus: jest.fn(() => ({
            parent: null,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            material: null,
            dispose: jest.fn()
        }))
    },
    TransformNode: jest.fn().mockImplementation(() => ({
        position: { x: 0, y: 0, z: 0 },
        setEnabled: jest.fn(),
        dispose: jest.fn()
    })),
    Color3: jest.fn().mockImplementation((r = 0, g = 0, b = 0) => ({ r, g, b }))
}));

// Create a mock Vector3 constructor for use in tests
const MockVector3 = jest.fn().mockImplementation((x = 0, y = 0, z = 0) => ({
    x, y, z,
    clone: jest.fn().mockReturnThis(),
    add: jest.fn().mockReturnThis(),
    subtract: jest.fn().mockReturnThis(),
    normalize: jest.fn().mockReturnThis(),
    scale: jest.fn().mockReturnThis(),
    addInPlace: jest.fn()
}));

// Mock MaterialManager
const mockMaterialManager = {
    createCustomMaterial: jest.fn(() => ({
        dispose: jest.fn()
    })),
    getCombatParasiteMaterial: jest.fn(() => ({
        dispose: jest.fn(),
        name: 'combatParasite'
    })),
    getParasiteMaterial: jest.fn(() => ({
        dispose: jest.fn(),
        name: 'parasite'
    }))
};

// Mock Scene
const mockScene = {};

// Mock MineralDeposit
const mockHomeDeposit = {
    getId: () => 'test-deposit',
    getPosition: () => new MockVector3(0, 0, 0)
};

describe('CombatParasite', () => {
    let combatParasite: CombatParasite;
    let config: any;

    beforeEach(() => {
        config = {
            position: new MockVector3(10, 1, 10),
            scene: mockScene,
            materialManager: mockMaterialManager,
            homeDeposit: mockHomeDeposit
        };

        combatParasite = new CombatParasite(config);
    });

    afterEach(() => {
        if (combatParasite) {
            combatParasite.dispose();
        }
    });

    describe('Initialization', () => {
        test('should create Combat Parasite with correct type', () => {
            expect(combatParasite.getParasiteType()).toBe(ParasiteType.COMBAT);
        });

        test('should have 2x health of Energy Parasites', () => {
            const combatStats = PARASITE_STATS[ParasiteType.COMBAT];
            const energyStats = PARASITE_STATS[ParasiteType.ENERGY];
            
            expect(combatParasite.getHealth()).toBe(combatStats.health);
            expect(combatParasite.getMaxHealth()).toBe(combatStats.maxHealth);
            expect(combatStats.health).toBe(energyStats.health * 2);
        });

        test('should have correct energy reward (2x for 2x difficulty)', () => {
            const combatStats = PARASITE_STATS[ParasiteType.COMBAT];
            const energyStats = PARASITE_STATS[ParasiteType.ENERGY];
            
            expect(combatParasite.getEnergyReward()).toBe(combatStats.energyReward);
            expect(combatStats.energyReward).toBe(energyStats.energyReward * 2);
        });

        test('should have distinct visual scale (20% larger)', () => {
            const combatStats = PARASITE_STATS[ParasiteType.COMBAT];
            expect(combatStats.visualScale).toBe(1.2);
        });

        test('should create distinct material', () => {
            expect(mockMaterialManager.getCombatParasiteMaterial).toHaveBeenCalled();
        });
    });

    describe('Combat Stats', () => {
        test('should have correct attack damage', () => {
            const stats = combatParasite.getCombatParasiteStats();
            expect(stats.attackDamage).toBe(PARASITE_STATS[ParasiteType.COMBAT].attackDamage);
        });

        test('should have faster speed than Energy Parasites', () => {
            const combatStats = PARASITE_STATS[ParasiteType.COMBAT];
            const energyStats = PARASITE_STATS[ParasiteType.ENERGY];
            
            expect(combatStats.speed).toBeGreaterThan(energyStats.speed);
        });

        test('should have correct targeting behavior configuration', () => {
            const stats = combatParasite.getCombatParasiteStats();
            expect(stats.targetingBehavior.primaryTargets).toContain('protector');
            expect(stats.targetingBehavior.secondaryTargets).toContain('worker');
        });
    });

    describe('Damage System', () => {
        test('should take damage and track health correctly', () => {
            const initialHealth = combatParasite.getHealth();
            const damage = 1;
            
            const isDestroyed = combatParasite.takeDamage(damage);
            
            expect(combatParasite.getHealth()).toBe(initialHealth - damage);
            expect(isDestroyed).toBe(false); // Should still be alive
        });

        test('should be destroyed when health reaches zero', () => {
            const maxHealth = combatParasite.getMaxHealth();
            
            const isDestroyed = combatParasite.takeDamage(maxHealth);
            
            expect(combatParasite.getHealth()).toBeLessThanOrEqual(0);
            expect(isDestroyed).toBe(true);
        });

        test('should require 2x more damage than Energy Parasite to destroy', () => {
            const combatHealth = PARASITE_STATS[ParasiteType.COMBAT].health;
            const energyHealth = PARASITE_STATS[ParasiteType.ENERGY].health;
            
            expect(combatHealth).toBe(energyHealth * 2);
        });
    });

    describe('Inheritance', () => {
        test('should inherit from EnergyParasite', () => {
            expect(combatParasite).toHaveProperty('id');
            expect(combatParasite).toHaveProperty('position');
            expect(combatParasite.getPosition).toBeDefined();
            expect(combatParasite.isAlive).toBeDefined();
        });

        test('should have access to parent methods', () => {
            expect(typeof combatParasite.getPosition).toBe('function');
            expect(typeof combatParasite.getTerritoryCenter).toBe('function');
            expect(typeof combatParasite.getTerritoryRadius).toBe('function');
            expect(typeof combatParasite.isAlive).toBe('function');
        });

        test('should override parent stats with Combat Parasite values', () => {
            const stats = combatParasite.getCombatParasiteStats();
            const combatStats = PARASITE_STATS[ParasiteType.COMBAT];
            
            expect(stats.health).toBe(combatStats.health);
            expect(stats.maxHealth).toBe(combatStats.maxHealth);
            expect(stats.attackDamage).toBe(combatStats.attackDamage);
            expect(stats.energyReward).toBe(combatStats.energyReward);
        });
    });

    describe('Visual Differentiation', () => {
        test('should use distinct material from Energy Parasites', () => {
            expect(mockMaterialManager.getCombatParasiteMaterial).toHaveBeenCalled();
        });

        test('should have larger visual scale', () => {
            const stats = combatParasite.getCombatParasiteStats();
            expect(stats.visualScale).toBe(1.2); // 20% larger
        });
    });

    describe('Type System Integration', () => {
        test('should return correct parasite type', () => {
            expect(combatParasite.getParasiteType()).toBe(ParasiteType.COMBAT);
        });

        test('should provide combat-specific stats', () => {
            const stats = combatParasite.getCombatParasiteStats();
            
            expect(stats).toHaveProperty('parasiteType', ParasiteType.COMBAT);
            expect(stats).toHaveProperty('attackDamage');
            expect(stats).toHaveProperty('energyReward');
            expect(stats).toHaveProperty('visualScale');
            expect(stats).toHaveProperty('targetingBehavior');
        });
    });
});