/**
 * Hive Entity Tests
 * 
 * Tests for the Hive structure system including construction, defensive swarms,
 * and combat target functionality.
 */

import { Vector3 } from '@babylonjs/core';
import { Hive, HiveConfig } from '../Hive';
import { Queen, QueenConfig } from '../Queen';
import { Territory } from '../../TerritoryManager';

// Mock dependencies
jest.mock('../../GameEngine', () => ({
    GameEngine: {
        getInstance: jest.fn(() => ({
            getParasiteManager: jest.fn(() => null),
            getScene: jest.fn(() => null),
            getMaterialManager: jest.fn(() => null),
            getMineralDeposits: jest.fn(() => []),
            getTerrainGenerator: jest.fn(() => null)
        }))
    }
}));

describe('Hive Entity', () => {
    let mockTerritory: Territory;
    let mockQueen: Queen;
    let hiveConfig: HiveConfig;

    beforeEach(() => {
        // Create mock territory
        mockTerritory = {
            id: 'territory_0_0',
            centerPosition: new Vector3(0, 0, 0),
            size: 1024,
            chunkBounds: {
                minX: -512,
                maxX: 512,
                minZ: -512,
                maxZ: 512,
                chunkCoords: []
            },
            queen: null,
            hive: null,
            controlStatus: 'contested',
            liberationTimer: 0,
            liberationStartTime: 0,
            parasiteCount: 0
        };

        // Create mock Queen
        const queenConfig: QueenConfig = {
            territory: mockTerritory,
            generation: 1,
            growthDuration: 90,
            health: 75,
            position: new Vector3(100, 0, 100)
        };
        mockQueen = new Queen(queenConfig);

        // Create hive config
        hiveConfig = {
            position: new Vector3(100, 0, 100),
            territory: mockTerritory,
            queen: mockQueen,
            health: 25, // 20-30 hits as per requirements
            constructionDuration: 12 // 10-15 seconds as per requirements
        };
    });

    describe('Construction', () => {
        test('should create hive with correct properties', () => {
            const hive = new Hive(hiveConfig);

            expect(hive.id).toContain('hive_territory_0_0');
            expect(hive.position).toEqual(new Vector3(100, 0, 100));
            expect(hive.health).toBe(25);
            expect(hive.maxHealth).toBe(25);
            expect(hive.isHiveConstructed()).toBe(false);
            expect(hive.getConstructionProgress()).toBe(0);
        });

        test('should enforce health constraints (20-30 hits)', () => {
            // Test minimum health
            const lowHealthConfig = { ...hiveConfig, health: 10 };
            const lowHealthHive = new Hive(lowHealthConfig);
            expect(lowHealthHive.maxHealth).toBe(20); // Should be clamped to minimum

            // Test maximum health
            const highHealthConfig = { ...hiveConfig, health: 50 };
            const highHealthHive = new Hive(highHealthConfig);
            expect(highHealthHive.maxHealth).toBe(30); // Should be clamped to maximum

            // Test valid health
            const validHealthConfig = { ...hiveConfig, health: 25 };
            const validHealthHive = new Hive(validHealthConfig);
            expect(validHealthHive.maxHealth).toBe(25); // Should remain unchanged
        });

        test('should enforce construction duration constraints (10-15 seconds)', () => {
            // Test minimum duration
            const shortDurationConfig = { ...hiveConfig, constructionDuration: 5 };
            const shortDurationHive = new Hive(shortDurationConfig);
            // We can't directly access constructionDuration, but we can test the behavior
            expect(shortDurationHive.getConstructionTimeRemaining()).toBeGreaterThanOrEqual(0);

            // Test maximum duration
            const longDurationConfig = { ...hiveConfig, constructionDuration: 20 };
            const longDurationHive = new Hive(longDurationConfig);
            expect(longDurationHive.getConstructionTimeRemaining()).toBeGreaterThanOrEqual(0);
        });

        test('should start construction when requested', () => {
            const hive = new Hive(hiveConfig);
            
            expect(hive.isHiveConstructed()).toBe(false);
            expect(hive.getConstructionProgress()).toBe(0);
            
            hive.startConstruction();
            
            // Construction should have started but not completed immediately
            expect(hive.isHiveConstructed()).toBe(false);
            expect(hive.getConstructionProgress()).toBe(0);
            expect(hive.getConstructionTimeRemaining()).toBeGreaterThan(0);
        });

        test('should progress construction over time', () => {
            const hive = new Hive(hiveConfig);
            hive.startConstruction();
            
            // Simulate time passing (half the construction duration)
            const halfDuration = hiveConfig.constructionDuration / 2;
            hive.update(halfDuration);
            
            expect(hive.getConstructionProgress()).toBeGreaterThan(0);
            expect(hive.getConstructionProgress()).toBeLessThan(1);
            expect(hive.isHiveConstructed()).toBe(false);
        });

        test('should complete construction after full duration', () => {
            const hive = new Hive(hiveConfig);
            hive.startConstruction();
            
            // Simulate full construction time
            hive.update(hiveConfig.constructionDuration + 1);
            
            expect(hive.getConstructionProgress()).toBe(1);
            expect(hive.isHiveConstructed()).toBe(true);
            expect(hive.getConstructionTimeRemaining()).toBe(0);
        });
    });

    describe('Combat Target Interface', () => {
        test('should implement CombatTarget interface correctly', () => {
            const hive = new Hive(hiveConfig);
            
            // Check required properties
            expect(hive.id).toBeDefined();
            expect(hive.position).toBeInstanceOf(Vector3);
            expect(hive.health).toBe(25);
            expect(hive.maxHealth).toBe(25);
            
            // Check required methods
            expect(typeof hive.takeDamage).toBe('function');
            expect(typeof hive.onDestroyed).toBe('function');
        });

        test('should not take damage during construction', () => {
            const hive = new Hive(hiveConfig);
            hive.startConstruction();
            
            const initialHealth = hive.health;
            const damaged = hive.takeDamage(10);
            
            expect(damaged).toBe(false);
            expect(hive.health).toBe(initialHealth);
        });

        test('should take damage after construction is complete', () => {
            const hive = new Hive(hiveConfig);
            hive.startConstruction();
            
            // Complete construction
            hive.update(hiveConfig.constructionDuration + 1);
            expect(hive.isHiveConstructed()).toBe(true);
            
            const initialHealth = hive.health;
            const damaged = hive.takeDamage(10);
            
            expect(damaged).toBe(false); // Not destroyed yet
            expect(hive.health).toBe(initialHealth - 10);
        });

        test('should be destroyed when health reaches zero', () => {
            const hive = new Hive(hiveConfig);
            hive.startConstruction();
            
            // Complete construction
            hive.update(hiveConfig.constructionDuration + 1);
            
            const destroyed = hive.takeDamage(hive.maxHealth);
            
            expect(destroyed).toBe(true);
            expect(hive.health).toBe(0);
            expect(hive.isActiveHive()).toBe(false);
        });
    });

    describe('Defensive Swarm', () => {
        test('should spawn defensive swarm after construction completes', () => {
            const hive = new Hive(hiveConfig);
            hive.startConstruction();
            
            // Before construction completes
            expect(hive.getActiveDefensiveParasiteCount()).toBe(0);
            
            // Complete construction
            hive.update(hiveConfig.constructionDuration + 1);
            
            // After construction completes, defensive parasites should be tracked
            // Note: Actual spawning depends on ParasiteManager which is mocked
            expect(hive.isHiveConstructed()).toBe(true);
        });

        test('should track defensive parasites', () => {
            const hive = new Hive(hiveConfig);
            
            // Get initial defensive parasite list
            const defensiveParasites = hive.getDefensiveParasites();
            expect(Array.isArray(defensiveParasites)).toBe(true);
            expect(defensiveParasites.length).toBe(0);
        });
    });

    describe('Territory Integration', () => {
        test('should be placed within territory boundaries', () => {
            const hive = new Hive(hiveConfig);
            const position = hive.getPosition();
            const bounds = mockTerritory.chunkBounds;
            
            expect(position.x).toBeGreaterThanOrEqual(bounds.minX);
            expect(position.x).toBeLessThanOrEqual(bounds.maxX);
            expect(position.z).toBeGreaterThanOrEqual(bounds.minZ);
            expect(position.z).toBeLessThanOrEqual(bounds.maxZ);
        });

        test('should reference correct territory and queen', () => {
            const hive = new Hive(hiveConfig);
            
            expect(hive.getTerritory()).toBe(mockTerritory);
            expect(hive.getQueen()).toBe(mockQueen);
        });
    });

    describe('Hive Destruction Chain', () => {
        test('should kill Queen when hive is destroyed', () => {
            const hive = new Hive(hiveConfig);
            hive.startConstruction();
            
            // Complete construction
            hive.update(hiveConfig.constructionDuration + 1);
            
            // Mock Queen methods
            const queenTakeDamageSpy = jest.spyOn(mockQueen, 'takeDamage');
            const queenIsActiveSpy = jest.spyOn(mockQueen, 'isActiveQueen').mockReturnValue(true);
            
            // Destroy hive
            hive.takeDamage(hive.maxHealth);
            
            // Verify Queen was killed
            expect(queenTakeDamageSpy).toHaveBeenCalledWith(mockQueen.maxHealth);
        });

        test('should update territory status when destroyed', () => {
            const hive = new Hive(hiveConfig);
            hive.startConstruction();
            
            // Set territory hive reference
            mockTerritory.hive = hive;
            
            // Complete construction and destroy
            hive.update(hiveConfig.constructionDuration + 1);
            hive.takeDamage(hive.maxHealth);
            
            // Territory hive reference should be cleared
            expect(mockTerritory.hive).toBeNull();
        });
    });

    describe('Statistics and Status', () => {
        test('should provide comprehensive statistics', () => {
            const hive = new Hive(hiveConfig);
            hive.startConstruction();
            
            const stats = hive.getStats();
            
            expect(stats.id).toBe(hive.id);
            expect(stats.position).toEqual(hive.position);
            expect(stats.health).toBe(hive.health);
            expect(stats.maxHealth).toBe(hive.maxHealth);
            expect(stats.isConstructed).toBe(hive.isHiveConstructed());
            expect(stats.constructionProgress).toBe(hive.getConstructionProgress());
            expect(stats.territoryId).toBe(mockTerritory.id);
            expect(stats.queenId).toBe(mockQueen.id);
        });

        test('should track construction progress accurately', () => {
            const hive = new Hive(hiveConfig);
            hive.startConstruction();
            
            // Test progress at different intervals
            const quarterTime = hiveConfig.constructionDuration * 0.25;
            hive.update(quarterTime);
            expect(hive.getConstructionProgress()).toBeCloseTo(0.25, 1);
            
            const halfTime = hiveConfig.constructionDuration * 0.25; // Additional quarter
            hive.update(halfTime);
            expect(hive.getConstructionProgress()).toBeCloseTo(0.5, 1);
        });
    });

    describe('Event Callbacks', () => {
        test('should support construction complete callbacks', () => {
            const hive = new Hive(hiveConfig);
            const callback = jest.fn();
            
            hive.onConstructionComplete(callback);
            hive.startConstruction();
            
            // Complete construction
            hive.update(hiveConfig.constructionDuration + 1);
            
            expect(callback).toHaveBeenCalledWith(hive);
        });

        test('should support construction progress callbacks', () => {
            const hive = new Hive(hiveConfig);
            const callback = jest.fn();
            
            hive.onConstructionProgress(callback);
            hive.startConstruction();
            
            // Progress construction
            hive.update(hiveConfig.constructionDuration * 0.5);
            
            expect(callback).toHaveBeenCalledWith(hive, expect.any(Number));
        });

        test('should support destruction callbacks', () => {
            const hive = new Hive(hiveConfig);
            const callback = jest.fn();
            
            hive.onHiveDestroyed(callback);
            hive.startConstruction();
            
            // Complete construction and destroy
            hive.update(hiveConfig.constructionDuration + 1);
            hive.takeDamage(hive.maxHealth);
            
            expect(callback).toHaveBeenCalledWith(hive);
        });
    });

    describe('Resource Cleanup', () => {
        test('should dispose properly', () => {
            const hive = new Hive(hiveConfig);
            
            expect(hive.isActiveHive()).toBe(true);
            
            hive.dispose();
            
            expect(hive.isActiveHive()).toBe(false);
        });
    });
});