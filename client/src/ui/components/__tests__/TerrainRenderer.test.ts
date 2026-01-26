/**
 * TerrainRenderer Component Tests
 * 
 * Tests the terrain generation logic extracted from TerrainGenerator
 * for creating close-up terrain views in the Introduction Screen.
 */

import { Scene, Engine, NullEngine, Vector3, Mesh } from '@babylonjs/core';
import { TerrainRenderer, TerrainConfig } from '../TerrainRenderer';
import { MaterialManager } from '../../../rendering/MaterialManager';

// Mock MaterialManager
jest.mock('../../../rendering/MaterialManager');

describe('TerrainRenderer', () => {
    let engine: Engine;
    let scene: Scene;
    let materialManager: MaterialManager;
    let terrainRenderer: TerrainRenderer;

    beforeEach(() => {
        // Create null engine for testing
        engine = new NullEngine();
        scene = new Scene(engine);
        
        // Create mock material manager
        materialManager = new MaterialManager(scene);
        
        // Mock material manager methods
        (materialManager.getColorPalette as jest.Mock).mockReturnValue({
            terrain: {
                vegetation: { r: 0.3, g: 0.6, b: 0.2 },
                desert: { r: 0.8, g: 0.7, b: 0.4 },
                rocky: { r: 0.4, g: 0.3, b: 0.2 }
            }
        });
        
        (materialManager.getTerrainVegetationMaterial as jest.Mock).mockReturnValue({});
        (materialManager.getTerrainDesertMaterial as jest.Mock).mockReturnValue({});
        (materialManager.getTerrainRockyMaterial as jest.Mock).mockReturnValue({});
        (materialManager.getMineralMaterial as jest.Mock).mockReturnValue({});
        
        terrainRenderer = new TerrainRenderer(scene, materialManager);
    });

    afterEach(() => {
        scene.dispose();
        engine.dispose();
    });

    describe('Terrain Creation', () => {
        it('should create terrain mesh with basic configuration', () => {
            const config: TerrainConfig = {
                chunkSize: 10,
                heightScale: 1.0,
                mineralDeposits: false,
                atmosphericEffects: false,
                toxicGlow: false
            };

            const terrainMesh = terrainRenderer.createTerrainCloseup(config);

            expect(terrainMesh).toBeInstanceOf(Mesh);
            expect(terrainMesh.name).toBe('terrain_closeup_mesh');
            expect(terrainMesh.parent).toBeTruthy();
        });

        it('should create terrain with mineral deposits when enabled', () => {
            const config: TerrainConfig = {
                chunkSize: 10,
                heightScale: 1.0,
                mineralDeposits: true,
                atmosphericEffects: false,
                toxicGlow: false
            };

            const terrainMesh = terrainRenderer.createTerrainCloseup(config);

            expect(terrainMesh).toBeInstanceOf(Mesh);
            expect(terrainMesh.parent).toBeTruthy();
            
            // Check that mineral material was requested
            expect(materialManager.getMineralMaterial).toHaveBeenCalled();
        });

        it('should create terrain with atmospheric effects when enabled', () => {
            const config: TerrainConfig = {
                chunkSize: 10,
                heightScale: 1.0,
                mineralDeposits: false,
                atmosphericEffects: true,
                toxicGlow: false
            };

            const terrainMesh = terrainRenderer.createTerrainCloseup(config);

            expect(terrainMesh).toBeInstanceOf(Mesh);
            expect(terrainMesh.parent).toBeTruthy();
        });

        it('should create terrain with toxic glow when enabled', () => {
            const config: TerrainConfig = {
                chunkSize: 10,
                heightScale: 1.0,
                mineralDeposits: false,
                atmosphericEffects: false,
                toxicGlow: true
            };

            const terrainMesh = terrainRenderer.createTerrainCloseup(config);

            expect(terrainMesh).toBeInstanceOf(Mesh);
            expect(terrainMesh.parent).toBeTruthy();
        });

        it('should create terrain with all features enabled', () => {
            const config: TerrainConfig = {
                chunkSize: 15,
                heightScale: 2.0,
                mineralDeposits: true,
                atmosphericEffects: true,
                toxicGlow: true
            };

            const terrainMesh = terrainRenderer.createTerrainCloseup(config);

            expect(terrainMesh).toBeInstanceOf(Mesh);
            expect(terrainMesh.parent).toBeTruthy();
            
            // Check that materials were requested
            expect(materialManager.getMineralMaterial).toHaveBeenCalled();
        });
    });

    describe('Terrain Properties', () => {
        it('should use appropriate terrain material based on dominant biome', () => {
            const config: TerrainConfig = {
                chunkSize: 10,
                heightScale: 1.0,
                mineralDeposits: false,
                atmosphericEffects: false,
                toxicGlow: false
            };

            terrainRenderer.createTerrainCloseup(config);

            // Should call one of the terrain material methods
            const materialCalls = [
                (materialManager.getTerrainVegetationMaterial as jest.Mock).mock.calls.length,
                (materialManager.getTerrainDesertMaterial as jest.Mock).mock.calls.length,
                (materialManager.getTerrainRockyMaterial as jest.Mock).mock.calls.length
            ];

            expect(materialCalls.some(calls => calls > 0)).toBe(true);
        });

        it('should handle different chunk sizes', () => {
            const smallConfig: TerrainConfig = {
                chunkSize: 5,
                heightScale: 1.0,
                mineralDeposits: false,
                atmosphericEffects: false,
                toxicGlow: false
            };

            const largeConfig: TerrainConfig = {
                chunkSize: 20,
                heightScale: 1.0,
                mineralDeposits: false,
                atmosphericEffects: false,
                toxicGlow: false
            };

            const smallTerrain = terrainRenderer.createTerrainCloseup(smallConfig);
            const largeTerrain = terrainRenderer.createTerrainCloseup(largeConfig);

            expect(smallTerrain).toBeInstanceOf(Mesh);
            expect(largeTerrain).toBeInstanceOf(Mesh);
        });

        it('should handle different height scales', () => {
            const flatConfig: TerrainConfig = {
                chunkSize: 10,
                heightScale: 0.5,
                mineralDeposits: false,
                atmosphericEffects: false,
                toxicGlow: false
            };

            const tallConfig: TerrainConfig = {
                chunkSize: 10,
                heightScale: 3.0,
                mineralDeposits: false,
                atmosphericEffects: false,
                toxicGlow: false
            };

            const flatTerrain = terrainRenderer.createTerrainCloseup(flatConfig);
            const tallTerrain = terrainRenderer.createTerrainCloseup(tallConfig);

            expect(flatTerrain).toBeInstanceOf(Mesh);
            expect(tallTerrain).toBeInstanceOf(Mesh);
        });
    });

    describe('Error Handling', () => {
        it('should handle material manager errors gracefully', () => {
            // Mock material manager to throw error
            (materialManager.getTerrainVegetationMaterial as jest.Mock).mockImplementation(() => {
                throw new Error('Material creation failed');
            });

            const config: TerrainConfig = {
                chunkSize: 10,
                heightScale: 1.0,
                mineralDeposits: false,
                atmosphericEffects: false,
                toxicGlow: false
            };

            // Should not throw error
            expect(() => {
                terrainRenderer.createTerrainCloseup(config);
            }).not.toThrow();
        });

        it('should handle particle system creation failures', () => {
            const config: TerrainConfig = {
                chunkSize: 10,
                heightScale: 1.0,
                mineralDeposits: false,
                atmosphericEffects: true, // This might fail in test environment
                toxicGlow: false
            };

            // Should not throw error even if particle system fails
            expect(() => {
                terrainRenderer.createTerrainCloseup(config);
            }).not.toThrow();
        });
    });

    describe('Integration with MaterialManager', () => {
        it('should request color palette from MaterialManager', () => {
            const config: TerrainConfig = {
                chunkSize: 10,
                heightScale: 1.0,
                mineralDeposits: false,
                atmosphericEffects: false,
                toxicGlow: false
            };

            terrainRenderer.createTerrainCloseup(config);

            expect(materialManager.getColorPalette).toHaveBeenCalled();
        });

        it('should use MaterialManager for terrain materials', () => {
            const config: TerrainConfig = {
                chunkSize: 10,
                heightScale: 1.0,
                mineralDeposits: false,
                atmosphericEffects: false,
                toxicGlow: false
            };

            terrainRenderer.createTerrainCloseup(config);

            // Should call at least one terrain material method
            const totalCalls = [
                (materialManager.getTerrainVegetationMaterial as jest.Mock).mock.calls.length,
                (materialManager.getTerrainDesertMaterial as jest.Mock).mock.calls.length,
                (materialManager.getTerrainRockyMaterial as jest.Mock).mock.calls.length
            ].reduce((sum, calls) => sum + calls, 0);

            expect(totalCalls).toBeGreaterThan(0);
        });

        it('should use MaterialManager for mineral materials when deposits enabled', () => {
            const config: TerrainConfig = {
                chunkSize: 10,
                heightScale: 1.0,
                mineralDeposits: true,
                atmosphericEffects: false,
                toxicGlow: false
            };

            terrainRenderer.createTerrainCloseup(config);

            expect(materialManager.getMineralMaterial).toHaveBeenCalled();
        });
    });
});