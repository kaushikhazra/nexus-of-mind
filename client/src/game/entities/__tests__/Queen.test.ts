/**
 * Queen - Unit Tests
 * 
 * Tests for the Queen entity class to verify proper lifecycle management,
 * CombatTarget interface implementation, and territorial control mechanics.
 */

import { Vector3 } from '@babylonjs/core';
import { Queen, QueenPhase, QueenConfig } from '../Queen';
import { Territory } from '../../TerritoryManager';

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
    }))
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

// Mock Territory
const createMockTerritory = (): Territory => ({
    id: 'territory_0_0',
    centerPosition: new MockVector3(512, 0, 512),
    size: 1024,
    chunkBounds: {
        minX: 0,
        maxX: 1024,
        minZ: 0,
        maxZ: 1024,
        chunkCoords: []
    },
    queen: null,
    hive: null,
    controlStatus: 'contested',
    liberationTimer: 0,
    liberationStartTime: 0,
    parasiteCount: 0
});

describe('Queen', () => {
    let queen: Queen;
    let mockTerritory: Territory;
    let config: QueenConfig;

    beforeEach(() => {
        mockTerritory = createMockTerritory();
        config = {
            territory: mockTerritory,
            generation: 1,
            health: 75, // Mid-range health (40-100)
            growthDuration: 90 // Mid-range growth (60-120 seconds)
        };

        queen = new Queen(config);
    });

    afterEach(() => {
        if (queen) {
            queen.dispose();
        }
    });

    describe('Initialization', () => {
        test('should create Queen with correct initial properties', () => {
            expect(queen.id).toBeDefined();
            expect(queen.health).toBe(75);
            expect(queen.maxHealth).toBe(75);
            expect(queen.position).toBeDefined();
            expect(queen.getGeneration()).toBe(1);
        });

        test('should start in underground growth phase', () => {
            expect(queen.getCurrentPhase()).toBe(QueenPhase.UNDERGROUND_GROWTH);
            expect(queen.isVulnerable()).toBe(false);
        });

        test('should clamp health to valid range (40-100)', () => {
            const lowHealthConfig = { ...config, health: 20 };
            const lowHealthQueen = new Queen(lowHealthConfig);
            expect(lowHealthQueen.maxHealth).toBe(40);
            
            const highHealthConfig = { ...config, health: 150 };
            const highHealthQueen = new Queen(highHealthConfig);
            expect(highHealthQueen.maxHealth).toBe(100);
            
            lowHealthQueen.dispose();
            highHealthQueen.dispose();
        });

        test('should clamp growth duration to valid range (60-120 seconds)', () => {
            const shortGrowthConfig = { ...config, growthDuration: 30 };
            const shortGrowthQueen = new Queen(shortGrowthConfig);
            expect(shortGrowthQueen.getGrowthTimeRemaining()).toBeGreaterThan(59); // Allow for small timing precision
            
            const longGrowthConfig = { ...config, growthDuration: 200 };
            const longGrowthQueen = new Queen(longGrowthConfig);
            expect(longGrowthQueen.getGrowthTimeRemaining()).toBeLessThanOrEqual(120);
            
            shortGrowthQueen.dispose();
            longGrowthQueen.dispose();
        });

        test('should use territory center position by default', () => {
            expect(queen.position.x).toBe(mockTerritory.centerPosition.x);
            expect(queen.position.z).toBe(mockTerritory.centerPosition.z);
        });

        test('should use custom position if provided', () => {
            const customPosition = new MockVector3(100, 0, 200);
            const customConfig = { ...config, position: customPosition };
            const customQueen = new Queen(customConfig);
            
            expect(customQueen.position.x).toBe(100);
            expect(customQueen.position.z).toBe(200);
            
            customQueen.dispose();
        });
    });

    describe('CombatTarget Interface', () => {
        test('should implement CombatTarget interface correctly', () => {
            expect(queen.id).toBeDefined();
            expect(queen.position).toBeDefined();
            expect(queen.health).toBeDefined();
            expect(queen.maxHealth).toBeDefined();
            expect(typeof queen.takeDamage).toBe('function');
            expect(typeof queen.onDestroyed).toBe('function');
        });

        test('should be invulnerable during underground growth phase', () => {
            expect(queen.getCurrentPhase()).toBe(QueenPhase.UNDERGROUND_GROWTH);
            
            const initialHealth = queen.health;
            const wasDestroyed = queen.takeDamage(50);
            
            expect(queen.health).toBe(initialHealth); // No damage taken
            expect(wasDestroyed).toBe(false);
        });

        test('should be invulnerable during hive construction phase', () => {
            // Force Queen into construction phase for testing
            queen['currentPhase'] = QueenPhase.HIVE_CONSTRUCTION;
            
            const initialHealth = queen.health;
            const wasDestroyed = queen.takeDamage(50);
            
            expect(queen.health).toBe(initialHealth); // No damage taken
            expect(wasDestroyed).toBe(false);
        });

        test('should be vulnerable during active control phase', () => {
            // Force Queen into active control phase for testing
            queen['currentPhase'] = QueenPhase.ACTIVE_CONTROL;
            
            const initialHealth = queen.health;
            const wasDestroyed = queen.takeDamage(25);
            
            expect(queen.health).toBe(initialHealth - 25);
            expect(wasDestroyed).toBe(false);
        });

        test('should be destroyed when health reaches zero', () => {
            // Force Queen into active control phase for testing
            queen['currentPhase'] = QueenPhase.ACTIVE_CONTROL;
            
            const wasDestroyed = queen.takeDamage(queen.maxHealth);
            
            expect(queen.health).toBe(0);
            expect(wasDestroyed).toBe(true);
            expect(queen.isActiveQueen()).toBe(false);
        });
    });

    describe('Lifecycle Management', () => {
        test('should track growth progress during underground phase', () => {
            expect(queen.getCurrentPhase()).toBe(QueenPhase.UNDERGROUND_GROWTH);
            expect(queen.getGrowthProgress()).toBe(0);
            expect(queen.getGrowthTimeRemaining()).toBeGreaterThan(0);
        });

        test('should remain stationary throughout lifecycle', () => {
            expect(queen.isStationary()).toBe(true);
        });

        test('should provide correct vulnerability status per phase', () => {
            // Underground growth - invulnerable
            expect(queen.getCurrentPhase()).toBe(QueenPhase.UNDERGROUND_GROWTH);
            expect(queen.isVulnerable()).toBe(false);
            
            // Hive construction - invulnerable
            queen['currentPhase'] = QueenPhase.HIVE_CONSTRUCTION;
            expect(queen.isVulnerable()).toBe(false);
            
            // Active control - vulnerable
            queen['currentPhase'] = QueenPhase.ACTIVE_CONTROL;
            expect(queen.isVulnerable()).toBe(true);
        });
    });

    describe('Parasite Control', () => {
        beforeEach(() => {
            // Set Queen to active control phase for parasite control tests
            queen['currentPhase'] = QueenPhase.ACTIVE_CONTROL;
        });

        test('should add parasites to control during active phase', () => {
            const parasiteId = 'parasite_1';
            
            queen.addControlledParasite(parasiteId);
            
            expect(queen.getControlledParasiteCount()).toBe(1);
            expect(queen.getControlledParasites()).toContain(parasiteId);
        });

        test('should remove parasites from control', () => {
            const parasiteId = 'parasite_1';
            
            queen.addControlledParasite(parasiteId);
            expect(queen.getControlledParasiteCount()).toBe(1);
            
            queen.removeControlledParasite(parasiteId);
            expect(queen.getControlledParasiteCount()).toBe(0);
            expect(queen.getControlledParasites()).not.toContain(parasiteId);
        });

        test('should not add parasites during non-active phases', () => {
            queen['currentPhase'] = QueenPhase.UNDERGROUND_GROWTH;
            
            queen.addControlledParasite('parasite_1');
            
            expect(queen.getControlledParasiteCount()).toBe(0);
        });

        test('should respect maximum parasite control limit', () => {
            const maxLimit = queen['maxControlledParasites'];
            
            // Add parasites up to the limit
            for (let i = 0; i < maxLimit + 10; i++) {
                queen.addControlledParasite(`parasite_${i}`);
            }
            
            expect(queen.getControlledParasiteCount()).toBe(maxLimit);
        });
    });

    describe('Territory Integration', () => {
        test('should reference correct territory', () => {
            expect(queen.getTerritory()).toBe(mockTerritory);
        });

        test('should update territory parasite count when controlling parasites', () => {
            queen['currentPhase'] = QueenPhase.ACTIVE_CONTROL;
            
            queen.addControlledParasite('parasite_1');
            queen.addControlledParasite('parasite_2');
            
            expect(mockTerritory.parasiteCount).toBe(2);
        });

        test('should clear territory references on destruction', () => {
            queen['currentPhase'] = QueenPhase.ACTIVE_CONTROL;
            
            // Destroy the Queen
            queen.takeDamage(queen.maxHealth);
            
            expect(mockTerritory.controlStatus).toBe('liberated');
            expect(mockTerritory.queen).toBe(null);
            expect(mockTerritory.hive).toBe(null);
            expect(mockTerritory.parasiteCount).toBe(0);
        });
    });

    describe('Statistics and Status', () => {
        test('should provide comprehensive stats', () => {
            const stats = queen.getStats();
            
            expect(stats.id).toBe(queen.id);
            expect(stats.generation).toBe(1);
            expect(stats.currentPhase).toBe(QueenPhase.UNDERGROUND_GROWTH);
            expect(stats.health).toBe(queen.health);
            expect(stats.maxHealth).toBe(queen.maxHealth);
            expect(stats.territoryId).toBe(mockTerritory.id);
            expect(stats.isVulnerable).toBe(false);
            expect(stats.position).toBeDefined();
        });

        test('should track time in current phase', () => {
            const stats1 = queen.getStats();
            expect(stats1.timeInCurrentPhase).toBeGreaterThanOrEqual(0);
            
            // Simulate some time passing
            setTimeout(() => {
                const stats2 = queen.getStats();
                expect(stats2.timeInCurrentPhase).toBeGreaterThan(stats1.timeInCurrentPhase);
            }, 10);
        });
    });

    describe('Event System', () => {
        test('should notify destruction callbacks', () => {
            const destructionCallback = jest.fn();
            queen.onQueenDestroyed(destructionCallback);
            
            queen['currentPhase'] = QueenPhase.ACTIVE_CONTROL;
            queen.takeDamage(queen.maxHealth);
            
            expect(destructionCallback).toHaveBeenCalledWith(queen);
        });

        test('should notify phase change callbacks', () => {
            const phaseChangeCallback = jest.fn();
            queen.onPhaseChange(phaseChangeCallback);
            
            // Manually trigger phase change for testing
            queen['startHiveConstruction']();
            
            expect(phaseChangeCallback).toHaveBeenCalledWith(
                queen,
                QueenPhase.UNDERGROUND_GROWTH,
                QueenPhase.HIVE_CONSTRUCTION
            );
        });

        test('should notify growth progress callbacks', () => {
            const growthCallback = jest.fn();
            queen.onGrowthProgress(growthCallback);
            
            // Simulate growth progress update
            queen['onGrowthProgressCallbacks'].forEach(callback => callback(queen, 0.5));
            
            expect(growthCallback).toHaveBeenCalledWith(queen, 0.5);
        });
    });

    describe('Resource Management', () => {
        test('should dispose properly', () => {
            queen['currentPhase'] = QueenPhase.ACTIVE_CONTROL; // Set to active phase for parasite control
            queen.addControlledParasite('parasite_1');
            expect(queen.getControlledParasiteCount()).toBe(1);
            
            queen.dispose();
            
            expect(queen.isActiveQueen()).toBe(false);
            expect(queen.getControlledParasiteCount()).toBe(0);
        });

        test('should clear all callbacks on dispose', () => {
            const destructionCallback = jest.fn();
            const phaseChangeCallback = jest.fn();
            const growthCallback = jest.fn();
            
            queen.onQueenDestroyed(destructionCallback);
            queen.onPhaseChange(phaseChangeCallback);
            queen.onGrowthProgress(growthCallback);
            
            queen.dispose();
            
            // Callbacks should be cleared
            expect(queen['onDestroyedCallbacks']).toHaveLength(0);
            expect(queen['onPhaseChangeCallbacks']).toHaveLength(0);
            expect(queen['onGrowthProgressCallbacks']).toHaveLength(0);
        });
    });
});