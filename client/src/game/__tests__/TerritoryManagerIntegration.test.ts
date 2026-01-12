/**
 * TerritoryManager Integration Tests
 * 
 * Tests the integration of TerritoryManager with GameEngine
 * and verifies the territory system works correctly in the game context.
 */

import { Vector3 } from '@babylonjs/core';
import { TerritoryManager } from '../TerritoryManager';

// Mock GameEngine for testing
class MockGameEngine {
    private territoryManager: TerritoryManager | null = null;

    public getTerritoryManager(): TerritoryManager | null {
        return this.territoryManager;
    }

    public setTerritoryManager(manager: TerritoryManager): void {
        this.territoryManager = manager;
    }
}

describe('TerritoryManager Integration', () => {
    let mockGameEngine: MockGameEngine;
    let territoryManager: TerritoryManager;

    beforeEach(() => {
        mockGameEngine = new MockGameEngine();
        territoryManager = new TerritoryManager();
        territoryManager.initialize(mockGameEngine as any);
        mockGameEngine.setTerritoryManager(territoryManager);
    });

    afterEach(() => {
        territoryManager.dispose();
    });

    describe('GameEngine Integration', () => {
        test('should initialize correctly with GameEngine', () => {
            expect(mockGameEngine.getTerritoryManager()).toBe(territoryManager);
        });

        test('should handle multiple territory creation', () => {
            // Create territories at different positions
            const territory1 = territoryManager.createTerritory(512, 512);
            const territory2 = territoryManager.createTerritory(1536, 1536);
            const territory3 = territoryManager.createTerritory(-512, -512);

            expect(territoryManager.getAllTerritories()).toHaveLength(3);
            expect(territory1.id).toBe('territory_0_0');
            expect(territory2.id).toBe('territory_1_1');
            expect(territory3.id).toBe('territory_-1_-1');
        });

        test('should handle territory updates correctly', () => {
            const territory = territoryManager.createTerritory(512, 512);
            territoryManager.liberateTerritory(territory.id);

            const initialTimer = territory.liberationTimer;
            expect(initialTimer).toBeGreaterThan(0);

            // Simulate 1 second passing
            territoryManager.update(1.0);

            expect(territory.liberationTimer).toBe(initialTimer - 1.0);
        });

        test('should provide correct mining bonuses', () => {
            const territory = territoryManager.createTerritory(512, 512);
            const position = new Vector3(400, 0, 300);

            // No bonus initially
            expect(territoryManager.getMiningBonusAt(position)).toBe(0);

            // Liberate territory
            territoryManager.liberateTerritory(territory.id);

            // Should have 25% bonus
            expect(territoryManager.getMiningBonusAt(position)).toBe(0.25);

            // End liberation
            territoryManager.update(territory.liberationTimer + 1);

            // No bonus after liberation ends
            expect(territoryManager.getMiningBonusAt(position)).toBe(0);
        });
    });

    describe('Territory Grid System', () => {
        test('should handle world positions correctly', () => {
            // Test various world positions
            const testPositions = [
                { x: 0, z: 0, expectedId: 'territory_0_0' },
                { x: 1000, z: 1000, expectedId: 'territory_0_0' },
                { x: 1024, z: 1024, expectedId: 'territory_1_1' },
                { x: -100, z: -100, expectedId: 'territory_-1_-1' },
                { x: 2048, z: 2048, expectedId: 'territory_2_2' }
            ];

            for (const pos of testPositions) {
                const territory = territoryManager.createTerritory(pos.x, pos.z);
                expect(territory.id).toBe(pos.expectedId);
            }
        });

        test('should maintain territory boundaries correctly', () => {
            const territory = territoryManager.createTerritory(512, 512);

            // Test positions within territory
            const insidePositions = [
                new Vector3(100, 0, 100),
                new Vector3(500, 0, 500),
                new Vector3(1000, 0, 1000)
            ];

            for (const pos of insidePositions) {
                expect(territoryManager.isPositionInTerritory(pos, territory.id)).toBe(true);
            }

            // Test positions outside territory
            const outsidePositions = [
                new Vector3(1100, 0, 1100),
                new Vector3(-100, 0, -100),
                new Vector3(2000, 0, 2000)
            ];

            for (const pos of outsidePositions) {
                expect(territoryManager.isPositionInTerritory(pos, territory.id)).toBe(false);
            }
        });

        test('should find territories in range correctly', () => {
            // Create a grid of territories
            territoryManager.createTerritory(512, 512);     // territory_0_0
            territoryManager.createTerritory(1536, 512);    // territory_1_0
            territoryManager.createTerritory(512, 1536);    // territory_0_1
            territoryManager.createTerritory(1536, 1536);   // territory_1_1

            const centerPosition = new Vector3(1024, 0, 1024);
            const territoriesInRange = territoryManager.getTerritoriesInRange(centerPosition, 800);

            // Should find all 4 territories within range
            expect(territoriesInRange).toHaveLength(4);
        });
    });

    describe('Performance Characteristics', () => {
        test('should handle large numbers of territories efficiently', () => {
            const startTime = performance.now();

            // Create 100 territories
            for (let i = 0; i < 10; i++) {
                for (let j = 0; j < 10; j++) {
                    territoryManager.createTerritory(i * 1024, j * 1024);
                }
            }

            const creationTime = performance.now() - startTime;
            expect(creationTime).toBeLessThan(100); // Should complete in less than 100ms

            // Test lookup performance
            const lookupStartTime = performance.now();
            for (let i = 0; i < 1000; i++) {
                const x = Math.random() * 10240;
                const z = Math.random() * 10240;
                territoryManager.getTerritoryAt(x, z);
            }
            const lookupTime = performance.now() - lookupStartTime;
            expect(lookupTime).toBeLessThan(50); // Should complete 1000 lookups in less than 50ms
        });

        test('should update territories efficiently', () => {
            // Create multiple territories with liberation timers
            for (let i = 0; i < 20; i++) {
                const territory = territoryManager.createTerritory(i * 1024, 0);
                territoryManager.liberateTerritory(territory.id);
            }

            const updateStartTime = performance.now();
            
            // Update 100 times (simulating 100 frames)
            for (let i = 0; i < 100; i++) {
                territoryManager.update(0.016); // 60fps = ~16ms per frame
            }

            const updateTime = performance.now() - updateStartTime;
            expect(updateTime).toBeLessThan(50); // Should complete 100 updates in less than 50ms
        });
    });
});