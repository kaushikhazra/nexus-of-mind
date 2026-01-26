/**
 * ChunkDebugVisualizer - Debug utility for visualizing chunk positions
 *
 * Creates visual markers (pins) at specified chunk positions to verify
 * coordinate conversion accuracy between chunk IDs and world positions.
 */

import { Vector3, Scene, Mesh, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';
import { GameEngine } from '../GameEngine';
import { chunkToCoordinate, chunkIdToGrid, CHUNK_SIZE, CHUNKS_PER_AXIS } from './ChunkUtils';

// Center chunk ID (grid 8,8 = world 0,0)
export const CENTER_CHUNK_ID = 136;

// Colors for different chunk markers
const CHUNK_COLORS: Color3[] = [
    new Color3(1, 0, 0),      // Red - Chunk 0
    new Color3(0, 1, 0),      // Green - Chunk 1
    new Color3(0, 0, 1),      // Blue - Chunk 2
    new Color3(1, 1, 0),      // Yellow - Chunk 3
    new Color3(1, 0, 1),      // Magenta - Chunk 4
    new Color3(0, 1, 1),      // Cyan - Chunk 5
    new Color3(1, 0.5, 0),    // Orange - Chunk 6
    new Color3(0.5, 0, 1),    // Purple - Chunk 7
];

/**
 * Debug marker mesh reference
 */
interface ChunkMarker {
    chunkId: number;
    pin: Mesh;
    label: Mesh;
}

/**
 * ChunkDebugVisualizer - Visual debugging for chunk coordinate system
 */
export class ChunkDebugVisualizer {
    private scene: Scene | null = null;
    private markers: ChunkMarker[] = [];
    private territoryCenter: { x: number; z: number } = { x: 0, z: 0 };

    /**
     * Initialize the visualizer with current game state
     */
    public initialize(): boolean {
        const gameEngine = GameEngine.getInstance();
        if (!gameEngine) {
            console.error('ChunkDebugVisualizer: GameEngine not available');
            return false;
        }

        this.scene = gameEngine.getScene();
        if (!this.scene) {
            console.error('ChunkDebugVisualizer: Scene not available');
            return false;
        }

        // Get territory center from territory manager
        const territoryManager = gameEngine.getTerritoryManager();
        if (territoryManager) {
            const territories = territoryManager.getAllTerritories();
            if (territories.length > 0) {
                const center = territories[0].centerPosition;
                if (center) {
                    this.territoryCenter = { x: center.x, z: center.z };
                }
            }
        }

        console.log(`ChunkDebugVisualizer initialized with territory center: (${this.territoryCenter.x}, ${this.territoryCenter.z})`);
        return true;
    }

    /**
     * Place a debug pin at a specific chunk
     * @param chunkId Chunk ID (0-255)
     */
    public placePin(chunkId: number): void {
        if (!this.scene) {
            if (!this.initialize()) {
                return;
            }
        }

        // Get world position for this chunk (center of chunk)
        const worldPos = chunkToCoordinate(chunkId, this.territoryCenter, false);
        if (!worldPos) {
            console.error(`Invalid chunk ID: ${chunkId}`);
            return;
        }

        // Get terrain height at position
        const gameEngine = GameEngine.getInstance();
        const terrainGenerator = gameEngine?.getTerrainGenerator();
        let height = 0;
        if (terrainGenerator && terrainGenerator.getHeightAtPosition) {
            height = terrainGenerator.getHeightAtPosition(worldPos.x, worldPos.z) || 0;
        }

        // Create pin mesh (tall cylinder with sphere on top)
        const pinHeight = 20;
        const pinRadius = 2;

        // Cylinder (pin body)
        const cylinder = MeshBuilder.CreateCylinder(`chunk_pin_${chunkId}_body`, {
            height: pinHeight,
            diameter: pinRadius,
            tessellation: 8
        }, this.scene!);
        cylinder.position = new Vector3(worldPos.x, height + pinHeight / 2, worldPos.z);

        // Sphere (pin head)
        const sphere = MeshBuilder.CreateSphere(`chunk_pin_${chunkId}_head`, {
            diameter: pinRadius * 3,
            segments: 8
        }, this.scene!);
        sphere.position = new Vector3(worldPos.x, height + pinHeight + pinRadius * 1.5, worldPos.z);

        // Create material with chunk-specific color
        const colorIndex = chunkId % CHUNK_COLORS.length;
        const material = new StandardMaterial(`chunk_pin_${chunkId}_mat`, this.scene!);
        material.diffuseColor = CHUNK_COLORS[colorIndex];
        material.emissiveColor = CHUNK_COLORS[colorIndex].scale(0.5);
        material.specularColor = new Color3(0.3, 0.3, 0.3);

        cylinder.material = material;
        sphere.material = material;

        // Store marker reference
        this.markers.push({
            chunkId,
            pin: cylinder,
            label: sphere
        });

        // Get grid coordinates for logging
        const grid = chunkIdToGrid(chunkId);

        console.log(`Chunk ${chunkId} pin placed:`);
        console.log(`  Grid: (${grid.chunkX}, ${grid.chunkZ})`);
        console.log(`  World: (${worldPos.x.toFixed(1)}, ${worldPos.z.toFixed(1)})`);
        console.log(`  Height: ${height.toFixed(1)}`);
        console.log(`  Color: ${['Red', 'Green', 'Blue', 'Yellow', 'Magenta', 'Cyan', 'Orange', 'Purple'][colorIndex]}`);
    }

    /**
     * Place pins at multiple chunks
     * @param chunkIds Array of chunk IDs
     */
    public placePins(chunkIds: number[]): void {
        for (const chunkId of chunkIds) {
            this.placePin(chunkId);
        }
    }

    /**
     * Place a debug pin at exact world coordinates
     * @param worldX World X coordinate
     * @param worldZ World Z coordinate
     */
    public placePinAtWorld(worldX: number, worldZ: number): void {
        if (!this.scene) {
            if (!this.initialize()) {
                return;
            }
        }

        // Get terrain height at position
        const gameEngine = GameEngine.getInstance();
        const terrainGenerator = gameEngine?.getTerrainGenerator();
        let height = 0;
        if (terrainGenerator && terrainGenerator.getHeightAtPosition) {
            height = terrainGenerator.getHeightAtPosition(worldX, worldZ) || 0;
        }

        // Create a distinct marker (white cone pointing down)
        const pinHeight = 25;

        const cone = MeshBuilder.CreateCylinder(`world_pin_${worldX}_${worldZ}`, {
            height: pinHeight,
            diameterTop: 0,
            diameterBottom: 8,
            tessellation: 8
        }, this.scene!);
        cone.position = new Vector3(worldX, height + pinHeight / 2, worldZ);

        // White material for world origin marker
        const material = new StandardMaterial(`world_pin_mat`, this.scene!);
        material.diffuseColor = new Color3(1, 1, 1);
        material.emissiveColor = new Color3(0.5, 0.5, 0.5);
        cone.material = material;

        console.log(`World origin pin placed at: (${worldX}, ${worldZ}), height: ${height.toFixed(1)}`);
    }

    /**
     * Remove all debug pins
     */
    public clearPins(): void {
        for (const marker of this.markers) {
            marker.pin.dispose();
            marker.label.dispose();
        }
        this.markers = [];
        console.log('All chunk debug pins cleared');
    }

    /**
     * Show chunk grid boundaries (optional - for comprehensive debugging)
     */
    public showChunkBoundaries(): void {
        if (!this.scene) {
            if (!this.initialize()) {
                return;
            }
        }

        // Create grid lines for chunk boundaries
        const halfTerritory = 512; // TERRITORY_SIZE / 2
        const startX = this.territoryCenter.x - halfTerritory;
        const startZ = this.territoryCenter.z - halfTerritory;

        console.log(`Chunk grid boundaries from (${startX}, ${startZ}) to (${startX + 1024}, ${startZ + 1024})`);
        console.log(`Each chunk is ${CHUNK_SIZE}x${CHUNK_SIZE} units`);
        console.log(`Grid is ${CHUNKS_PER_AXIS}x${CHUNKS_PER_AXIS} chunks`);
    }

    /**
     * Print chunk info without creating visual
     */
    public printChunkInfo(chunkId: number): void {
        const grid = chunkIdToGrid(chunkId);
        const worldPos = chunkToCoordinate(chunkId, this.territoryCenter, false);

        console.log(`Chunk ${chunkId}:`);
        console.log(`  Grid position: (${grid.chunkX}, ${grid.chunkZ})`);
        if (worldPos) {
            console.log(`  World center: (${worldPos.x.toFixed(1)}, ${worldPos.z.toFixed(1)})`);
        }
    }
}

// Create global instance for console access
let debugVisualizer: ChunkDebugVisualizer | null = null;

/**
 * Get or create the debug visualizer instance
 */
export function getChunkDebugVisualizer(): ChunkDebugVisualizer {
    if (!debugVisualizer) {
        debugVisualizer = new ChunkDebugVisualizer();
    }
    return debugVisualizer;
}

// Expose to window for console debugging
if (typeof window !== 'undefined') {
    (window as any).chunkDebug = {
        placePin: (chunkId: number) => getChunkDebugVisualizer().placePin(chunkId),
        placePins: (chunkIds: number[]) => getChunkDebugVisualizer().placePins(chunkIds),
        clear: () => getChunkDebugVisualizer().clearPins(),
        info: (chunkId: number) => getChunkDebugVisualizer().printChunkInfo(chunkId),
        showBoundaries: () => getChunkDebugVisualizer().showChunkBoundaries(),

        // Place pin at world origin (0, 0) - corner of 4 chunks
        origin: () => {
            console.log('%c[ChunkDebug] Placing pin at WORLD ORIGIN (0, 0)', 'color: #ffff00');
            console.log('  Origin is at corner of chunks 119, 120, 135, 136');
            getChunkDebugVisualizer().placePinAtWorld(0, 0);
        },

        // Place pins at the 4 chunks surrounding origin
        center: () => {
            console.log('%c[ChunkDebug] Placing pins at 4 chunks around origin (0,0)', 'color: #ffff00');
            // The 4 chunks that meet at (0, 0)
            const chunks = [119, 120, 135, 136];
            console.log('  Chunk 119 (7,7): center (-32, -32)');
            console.log('  Chunk 120 (8,7): center (32, -32)');
            console.log('  Chunk 135 (7,8): center (-32, 32)');
            console.log('  Chunk 136 (8,8): center (32, 32)');
            getChunkDebugVisualizer().placePins(chunks);
        },

        // Place pins around center for reference grid
        grid: () => {
            console.log('%c[ChunkDebug] Placing reference grid around origin', 'color: #ffff00');
            // 3x3 grid of chunks around origin
            const chunks = [
                102, 103, 104,  // Row above (grid y=6)
                118, 119, 120,  // Row with origin corner (grid y=7)
                134, 135, 136,  // Row below origin corner (grid y=8)
            ];
            getChunkDebugVisualizer().placePins(chunks);
        },

        // Test function to verify math step-by-step
        testMath: (chunkId: number) => {
            const CHUNK_SIZE = 64;
            const CHUNKS_PER_AXIS = 16;
            const TERRITORY_SIZE = 1024;

            const chunkX = chunkId % CHUNKS_PER_AXIS;
            const chunkZ = Math.floor(chunkId / CHUNKS_PER_AXIS);

            const chunkSpaceX = chunkX * CHUNK_SIZE + (CHUNK_SIZE / 2);
            const chunkSpaceZ = chunkZ * CHUNK_SIZE + (CHUNK_SIZE / 2);

            const worldX = chunkSpaceX - (TERRITORY_SIZE / 2);
            const worldZ = chunkSpaceZ - (TERRITORY_SIZE / 2);

            console.log(`Chunk ${chunkId} math test:`);
            console.log(`  Grid: chunkX=${chunkX}, chunkZ=${chunkZ}`);
            console.log(`  Chunk space: (${chunkSpaceX}, ${chunkSpaceZ})`);
            console.log(`  World (with center 0,0): (${worldX}, ${worldZ})`);
            console.log(`  Expected X spacing: 64 units between chunks`);
        },

        // Constants
        CENTER: CENTER_CHUNK_ID
    };

    console.log('%c[ChunkDebug] World (0,0) is at corner of chunks 119,120,135,136', 'color: #00ff88; font-weight: bold');
    console.log('  origin()    → white pin at exact (0,0)');
    console.log('  center()    → 4 chunks around origin');
    console.log('  grid()      → 9 chunks around origin');
    console.log('  placePin(n) → pin at chunk n');
    console.log('  clear()     → remove all pins');
}
