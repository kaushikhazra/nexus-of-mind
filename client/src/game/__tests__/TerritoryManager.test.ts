/**
 * TerritoryManager Tests - Territory Grid Foundation
 * 
 * Tests the basic functionality of the TerritoryManager including
 * territory creation, coordinate mapping, and chunk alignment.
 */

import { Vector3 } from '@babylonjs/core';
import { TerritoryManager, TerritoryGrid } from '../TerritoryManager';

describe('TerritoryManager', () => {
    let territoryManager: TerritoryManager;

    beforeEach(() => {
        territoryManager = new TerritoryManager();
    });

    afterEach(() => {
        territoryManager.dispose();
    });

    describe('Territory Creation', () => {
        test('should create territory with correct size and alignment', () => {
            const territory = territoryManager.createTerritory(512, 512);
            
            expect(territory).toBeDefined();
            expect(territory.size).toBe(1024); // 16 chunks * 64 units
            expect(territory.centerPosition.x).toBe(512);
            expect(territory.centerPosition.z).toBe(512);
            expect(territory.controlStatus).toBe('contested');
        });

        test('should align territory center to grid', () => {
            // Test various positions that should align to the same territory
            const territory1 = territoryManager.createTerritory(100, 100);
            const territory2 = territoryManager.createTerritory(200, 200);
            
            // Both should align to the same territory center
            expect(territory1.centerPosition.x).toBe(512);
            expect(territory1.centerPosition.z).toBe(512);
            expect(territory2.centerPosition.x).toBe(512);
            expect(territory2.centerPosition.z).toBe(512);
            expect(territory1.id).toBe(territory2.id);
        });

        test('should create different territories for different grid positions', () => {
            const territory1 = territoryManager.createTerritory(512, 512);
            const territory2 = territoryManager.createTerritory(1536, 1536);
            
            expect(territory1.id).not.toBe(territory2.id);
            expect(territory1.centerPosition.x).toBe(512);
            expect(territory1.centerPosition.z).toBe(512);
            expect(territory2.centerPosition.x).toBe(1536);
            expect(territory2.centerPosition.z).toBe(1536);
        });
    });

    describe('Territory Lookup', () => {
        test('should find territory at position', () => {
            const createdTerritory = territoryManager.createTerritory(512, 512);
            
            const foundTerritory = territoryManager.getTerritoryAt(400, 300);
            expect(foundTerritory).toBeDefined();
            expect(foundTerritory!.id).toBe(createdTerritory.id);
        });

        test('should return null for non-existent territory', () => {
            const territory = territoryManager.getTerritoryAt(2000, 2000);
            expect(territory).toBeNull();
        });

        test('should correctly identify position within territory', () => {
            const territory = territoryManager.createTerritory(512, 512);
            
            // Position within territory bounds
            expect(territoryManager.isPositionInTerritory(
                new Vector3(400, 0, 300), 
                territory.id
            )).toBe(true);
            
            // Position outside territory bounds
            expect(territoryManager.isPositionInTerritory(
                new Vector3(1200, 0, 1200), 
                territory.id
            )).toBe(false);
        });
    });

    describe('Liberation Mechanics', () => {
        test('should liberate territory correctly', () => {
            const territory = territoryManager.createTerritory(512, 512);
            
            territoryManager.liberateTerritory(territory.id);
            
            expect(territory.controlStatus).toBe('liberated');
            expect(territory.liberationTimer).toBeGreaterThan(180); // At least 3 minutes
            expect(territory.liberationTimer).toBeLessThanOrEqual(300); // At most 5 minutes
            expect(territory.queen).toBeNull();
            expect(territory.hive).toBeNull();
        });

        test('should provide mining bonus during liberation', () => {
            const territory = territoryManager.createTerritory(512, 512);
            const position = new Vector3(400, 0, 300);
            
            // No bonus initially
            expect(territoryManager.getMiningBonusAt(position)).toBe(0);
            
            // Liberate territory
            territoryManager.liberateTerritory(territory.id);
            
            // Should have 25% bonus
            expect(territoryManager.getMiningBonusAt(position)).toBe(0.25);
        });

        test('should end liberation after timer expires', () => {
            const territory = territoryManager.createTerritory(512, 512);
            territoryManager.liberateTerritory(territory.id);
            
            // Simulate time passing beyond liberation duration
            const originalTimer = territory.liberationTimer;
            territoryManager.update(originalTimer + 1);
            
            expect(territory.controlStatus).toBe('contested');
            expect(territory.liberationTimer).toBe(0);
        });
    });
});

describe('TerritoryGrid', () => {
    let territoryGrid: TerritoryGrid;

    beforeEach(() => {
        territoryGrid = new TerritoryGrid(16, 64);
    });

    describe('Coordinate Mapping', () => {
        test('should calculate correct territory coordinates', () => {
            const coords1 = territoryGrid.getTerritoryCoordsAt(512, 512);
            expect(coords1.territoryX).toBe(0);
            expect(coords1.territoryZ).toBe(0);
            
            const coords2 = territoryGrid.getTerritoryCoordsAt(1536, 1536);
            expect(coords2.territoryX).toBe(1);
            expect(coords2.territoryZ).toBe(1);
            
            const coords3 = territoryGrid.getTerritoryCoordsAt(-512, -512);
            expect(coords3.territoryX).toBe(-1);
            expect(coords3.territoryZ).toBe(-1);
        });

        test('should generate correct territory IDs', () => {
            const id1 = territoryGrid.getTerritoryIdAt(512, 512);
            expect(id1).toBe('territory_0_0');
            
            const id2 = territoryGrid.getTerritoryIdAt(1536, 1536);
            expect(id2).toBe('territory_1_1');
            
            const id3 = territoryGrid.getTerritoryIdAt(-512, -512);
            expect(id3).toBe('territory_-1_-1');
        });
    });

    describe('Chunk Bounds Calculation', () => {
        test('should calculate aligned chunk bounds', () => {
            const bounds = territoryGrid.calculateChunkBounds(512, 512);
            
            // Bounds should be aligned to 64-unit chunks
            expect(bounds.minX % 64).toBe(0);
            expect(bounds.maxX % 64).toBe(0);
            expect(bounds.minZ % 64).toBe(0);
            expect(bounds.maxZ % 64).toBe(0);
            
            // Territory should be 1024 units (16 chunks * 64 units)
            expect(bounds.maxX - bounds.minX).toBe(1024);
            expect(bounds.maxZ - bounds.minZ).toBe(1024);
        });

        test('should generate correct number of chunk coordinates', () => {
            const bounds = territoryGrid.calculateChunkBounds(512, 512);
            
            // Should have 16x16 = 256 chunks
            expect(bounds.chunkCoords.length).toBe(256);
        });

        test('should handle edge cases with non-aligned centers', () => {
            const bounds = territoryGrid.calculateChunkBounds(100, 200);
            
            // Should still align to chunk boundaries (use Math.abs to handle -0 vs 0)
            expect(Math.abs(bounds.minX % 64)).toBe(0);
            expect(Math.abs(bounds.maxX % 64)).toBe(0);
            expect(Math.abs(bounds.minZ % 64)).toBe(0);
            expect(Math.abs(bounds.maxZ % 64)).toBe(0);
        });
    });
});