/**
 * TerrainGenerator - Core terrain generation with chunk-based infinite system
 * 
 * Manages procedural terrain generation using Perlin noise and biome mapping.
 * Handles chunk loading/unloading based on camera position for infinite worlds.
 */

import { Scene, Vector3 } from '@babylonjs/core';
import { MaterialManager } from './MaterialManager';
import { CameraController } from './CameraController';
import { NoiseGenerator } from '../utils/NoiseGenerator';
import { TerrainChunk, ChunkData } from './TerrainChunk';

export interface TerrainConfig {
    chunkSize: number;
    chunkResolution: number;
    loadRadius: number;
    unloadRadius: number;
    seed: number;
}

export class TerrainGenerator {
    private scene: Scene;
    private materialManager: MaterialManager;
    private cameraController: CameraController;
    private noiseGenerator: NoiseGenerator;
    
    // Chunk management
    private chunks: Map<string, TerrainChunk> = new Map();
    private config: TerrainConfig;
    private lastCameraPosition: Vector3 = Vector3.Zero();
    private updateThreshold: number = 10; // Update when camera moves 10 units

    constructor(
        scene: Scene,
        materialManager: MaterialManager,
        cameraController: CameraController,
        config: Partial<TerrainConfig> = {}
    ) {
        this.scene = scene;
        this.materialManager = materialManager;
        this.cameraController = cameraController;

        // Default configuration
        this.config = {
            chunkSize: 64,
            chunkResolution: 128, // Higher resolution for more natural appearance
            loadRadius: 3, // Load 7x7 grid of chunks
            unloadRadius: 5, // Unload chunks beyond this distance
            seed: 12345,
            ...config
        };

        this.noiseGenerator = new NoiseGenerator(this.config.seed);
        
        console.log('🌍 TerrainGenerator created with config:', this.config);
    }

    /**
     * Initialize terrain system and generate initial chunks
     */
    public initialize(): void {
        console.log('🌍 Initializing terrain system...');

        // Get initial camera position
        const camera = this.cameraController.getCamera();
        if (camera) {
            this.lastCameraPosition = camera.position.clone();
        }

        // Generate initial chunks around camera
        this.updateChunks();

        // Set up update system
        this.scene.registerBeforeRender(() => {
            this.update();
        });

        console.log('✅ Terrain system initialized');
    }

    /**
     * Update terrain chunks based on camera position
     */
    private update(): void {
        const camera = this.cameraController.getCamera();
        if (!camera) return;

        const currentPosition = camera.position;
        const distance = Vector3.Distance(currentPosition, this.lastCameraPosition);

        // Only update if camera moved significantly
        if (distance > this.updateThreshold) {
            this.updateChunks();
            this.lastCameraPosition = currentPosition.clone();
        }
    }

    /**
     * Update chunk loading/unloading based on camera position
     */
    private updateChunks(): void {
        const camera = this.cameraController.getCamera();
        if (!camera) return;

        const cameraPosition = camera.position;
        
        // Convert camera position to chunk coordinates
        const cameraChunkX = Math.floor(cameraPosition.x / this.config.chunkSize);
        const cameraChunkZ = Math.floor(cameraPosition.z / this.config.chunkSize);

        // Load chunks within load radius
        this.loadChunksAroundPosition(cameraChunkX, cameraChunkZ);

        // Unload chunks beyond unload radius
        this.unloadDistantChunks(cameraPosition);
    }

    /**
     * Load chunks in a grid around the specified chunk coordinates
     */
    private loadChunksAroundPosition(centerChunkX: number, centerChunkZ: number): void {
        const radius = this.config.loadRadius;

        for (let x = centerChunkX - radius; x <= centerChunkX + radius; x++) {
            for (let z = centerChunkZ - radius; z <= centerChunkZ + radius; z++) {
                const chunkKey = this.getChunkKey(x, z);
                
                // Skip if chunk already exists
                if (this.chunks.has(chunkKey)) {
                    continue;
                }

                // Create and load chunk
                this.loadChunk(x, z);
            }
        }
    }

    /**
     * Load a single chunk at specified coordinates
     */
    private loadChunk(chunkX: number, chunkZ: number): void {
        const chunkKey = this.getChunkKey(chunkX, chunkZ);
        
        try {
            // Create terrain chunk
            const chunk = new TerrainChunk(
                this.scene,
                this.materialManager,
                chunkX,
                chunkZ,
                this.config.chunkSize,
                this.config.chunkResolution
            );

            // Generate height and biome data
            const chunkData = this.generateChunkData(chunkX, chunkZ);

            // Create mesh
            chunk.create(chunkData);

            // Store chunk
            this.chunks.set(chunkKey, chunk);

            console.log(`🌱 Loaded terrain chunk at (${chunkX}, ${chunkZ})`);

        } catch (error) {
            console.error(`❌ Failed to load chunk at (${chunkX}, ${chunkZ}):`, error);
        }
    }

    /**
     * Generate height and biome data for a chunk
     */
    private generateChunkData(chunkX: number, chunkZ: number): ChunkData {
        const worldStartX = chunkX * this.config.chunkSize;
        const worldStartZ = chunkZ * this.config.chunkSize;

        return this.noiseGenerator.generateHeightMap(
            worldStartX,
            worldStartZ,
            this.config.chunkSize,
            this.config.chunkResolution
        );
    }

    /**
     * Unload chunks that are too far from camera
     */
    private unloadDistantChunks(cameraPosition: Vector3): void {
        const maxDistance = this.config.unloadRadius * this.config.chunkSize;
        const chunksToUnload: string[] = [];

        // Find chunks to unload
        for (const [chunkKey, chunk] of this.chunks) {
            if (!chunk.isWithinDistance(cameraPosition, maxDistance)) {
                chunksToUnload.push(chunkKey);
            }
        }

        // Unload distant chunks
        for (const chunkKey of chunksToUnload) {
            this.unloadChunk(chunkKey);
        }
    }

    /**
     * Unload a specific chunk
     */
    private unloadChunk(chunkKey: string): void {
        const chunk = this.chunks.get(chunkKey);
        if (chunk) {
            const coords = chunk.getCoordinates();
            chunk.dispose();
            this.chunks.delete(chunkKey);
            
            console.log(`🗑️ Unloaded terrain chunk at (${coords.x}, ${coords.z})`);
        }
    }

    /**
     * Generate chunk key from coordinates
     */
    private getChunkKey(chunkX: number, chunkZ: number): string {
        return `${chunkX}_${chunkZ}`;
    }

    /**
     * Get height at specific world coordinates
     */
    public getHeightAtPosition(x: number, z: number): number {
        return this.noiseGenerator.generateHeight(x, z);
    }

    /**
     * Get biome at specific world coordinates
     */
    public getBiomeAtPosition(x: number, z: number): string {
        const height = this.getHeightAtPosition(x, z);
        return this.noiseGenerator.getBiomeType(height);
    }

    /**
     * Get current terrain statistics
     */
    public getStats(): {
        loadedChunks: number;
        seed: number;
        config: TerrainConfig;
    } {
        return {
            loadedChunks: this.chunks.size,
            seed: this.noiseGenerator.getSeed(),
            config: { ...this.config }
        };
    }

    /**
     * Update terrain configuration
     */
    public updateConfig(newConfig: Partial<TerrainConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Update noise generator if seed changed
        if (newConfig.seed !== undefined) {
            this.noiseGenerator.setSeed(newConfig.seed);
        }
        
        console.log('🔧 Terrain config updated:', this.config);
    }

    /**
     * Force update of all chunks (useful for config changes)
     */
    public forceUpdate(): void {
        console.log('🔄 Forcing terrain update...');
        this.updateChunks();
    }

    /**
     * Get all loaded chunks
     */
    public getLoadedChunks(): TerrainChunk[] {
        return Array.from(this.chunks.values());
    }

    /**
     * Dispose of all terrain resources
     */
    public dispose(): void {
        console.log('🗑️ Disposing terrain system...');

        // Dispose all chunks
        for (const chunk of this.chunks.values()) {
            chunk.dispose();
        }
        this.chunks.clear();

        console.log('✅ Terrain system disposed');
    }
}