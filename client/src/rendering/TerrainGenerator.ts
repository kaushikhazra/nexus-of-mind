/**
 * TerrainGenerator - Core terrain generation with chunk-based infinite system
 * 
 * Manages procedural terrain generation using Perlin noise and biome mapping.
 * Handles chunk loading/unloading based on camera position for infinite worlds.
 */

import { Scene, Vector3, Color3 } from '@babylonjs/core';
import { MaterialManager } from './MaterialManager';
import { CameraController } from './CameraController';
import { NoiseGenerator } from '../utils/NoiseGenerator';
import { TerrainChunk, ChunkData } from './TerrainChunk';
import { MineralDeposit, MineralDepositConfig } from '../world/MineralDeposit';
import { TreeRenderer } from './TreeRenderer';

export interface TerrainConfig {
    chunkSize: number;
    chunkResolution: number;
    loadRadius: number;
    unloadRadius: number;
    seed: number;
    mineralDensity: number; // Minerals per chunk (average)
    mineralCapacityRange: [number, number]; // Min/max energy per deposit
    treeDensity: number; // Trees per chunk (average)
}

export class TerrainGenerator {
    private scene: Scene;
    private materialManager: MaterialManager;
    private cameraController: CameraController;
    private noiseGenerator: NoiseGenerator;
    
    // Chunk management
    private chunks: Map<string, TerrainChunk> = new Map();
    private mineralDeposits: Map<string, MineralDeposit[]> = new Map(); // Deposits per chunk
    private treesPerChunk: Map<string, string[]> = new Map(); // Tree IDs per chunk
    private treeRenderer: TreeRenderer | null = null;
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
            mineralDensity: 18, // Increased 200% more from 6 - Average 18 deposits per chunk for very rich gameplay
            mineralCapacityRange: [20, 80], // 20-80 energy per deposit
            treeDensity: 8, // Average 8 trees per chunk
            ...config
        };

        this.noiseGenerator = new NoiseGenerator(this.config.seed);
    }

    /**
     * Initialize terrain system and generate initial chunks
     */
    public initialize(): void {
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

            // Generate mineral deposits for this chunk
            this.generateMineralDeposits(chunkX, chunkZ);

            // Generate trees for this chunk
            this.generateTrees(chunkX, chunkZ);

            // Store chunk
            this.chunks.set(chunkKey, chunk);

        } catch (error) {
            console.error(`❌ Failed to load chunk at (${chunkX}, ${chunkZ}):`, error);
        }
    }

    /**
     * Generate mineral deposits for a chunk
     */
    private generateMineralDeposits(chunkX: number, chunkZ: number): void {
        const chunkKey = this.getChunkKey(chunkX, chunkZ);
        const deposits: MineralDeposit[] = [];

        // Use seeded random for consistent generation
        const chunkSeed = this.config.seed + chunkX * 1000 + chunkZ;
        const random = this.createSeededRandom(chunkSeed);

        // Determine number of deposits (Poisson-like distribution)
        const baseCount = Math.floor(this.config.mineralDensity);
        const extraChance = this.config.mineralDensity - baseCount;
        const depositCount = baseCount + (random() < extraChance ? 1 : 0);

        const worldStartX = chunkX * this.config.chunkSize;
        const worldStartZ = chunkZ * this.config.chunkSize;

        for (let i = 0; i < depositCount; i++) {
            // Random position within chunk (with some margin from edges)
            const margin = 5;
            const localX = margin + random() * (this.config.chunkSize - 2 * margin);
            const localZ = margin + random() * (this.config.chunkSize - 2 * margin);
            
            const worldX = worldStartX + localX;
            const worldZ = worldStartZ + localZ;
            const worldY = this.getHeightAtPosition(worldX, worldZ);

            // Get biome for this position
            const biome = this.getBiomeAtPosition(worldX, worldZ);

            // Adjust mineral properties based on biome
            const biomeMultiplier = this.getBiomeMineralMultiplier(biome);
            const [minCapacity, maxCapacity] = this.config.mineralCapacityRange;
            const capacity = (minCapacity + random() * (maxCapacity - minCapacity)) * biomeMultiplier;

            // Some deposits are hidden (require scouting)
            const isVisible = random() > 0.3; // 70% visible, 30% hidden

            // Create mineral deposit
            const depositConfig: MineralDepositConfig = {
                position: new Vector3(worldX, worldY, worldZ),
                capacity: Math.round(capacity),
                extractionRate: 2.8 + random() * 0.3, // 2.8-3.1 minerals/second
                biome,
                visible: isVisible,
                size: 0.8 + random() * 0.4 // 0.8-1.2 size variation
            };

            const deposit = new MineralDeposit(depositConfig);
            deposit.initializeVisual(this.scene, this.materialManager);
            deposits.push(deposit);
        }

        // Store deposits for this chunk
        this.mineralDeposits.set(chunkKey, deposits);
    }

    /**
     * Set tree renderer for vegetation spawning
     */
    public setTreeRenderer(treeRenderer: TreeRenderer): void {
        this.treeRenderer = treeRenderer;

        // Generate trees for any chunks that were loaded before tree renderer was set
        for (const chunkKey of this.chunks.keys()) {
            if (!this.treesPerChunk.has(chunkKey)) {
                const [chunkX, chunkZ] = chunkKey.split('_').map(Number);
                this.generateTrees(chunkX, chunkZ);
            }
        }
    }

    /**
     * Generate trees for a chunk
     */
    private generateTrees(chunkX: number, chunkZ: number): void {
        if (!this.treeRenderer) return;

        const chunkKey = this.getChunkKey(chunkX, chunkZ);
        const treeIds: string[] = [];

        // Use seeded random for consistent generation (offset from mineral seed)
        const chunkSeed = this.config.seed + chunkX * 1000 + chunkZ + 50000;
        const random = this.createSeededRandom(chunkSeed);

        // Determine number of trees
        const baseCount = Math.floor(this.config.treeDensity);
        const extraChance = this.config.treeDensity - baseCount;
        const treeCount = baseCount + (random() < extraChance ? 1 : 0);

        const worldStartX = chunkX * this.config.chunkSize;
        const worldStartZ = chunkZ * this.config.chunkSize;

        // Color variations
        const capColors = [
            { r: 0.4, g: 0.2, b: 0.5 },   // Purple
            { r: 0.3, g: 0.25, b: 0.5 },  // Blue-purple
            { r: 0.5, g: 0.2, b: 0.4 },   // Pink-purple
            { r: 0.2, g: 0.3, b: 0.45 },  // Teal-blue
        ];

        const glowColors = [
            { r: 0.2, g: 0.9, b: 0.8 },   // Cyan
            { r: 0.3, g: 1.0, b: 0.5 },   // Green
            { r: 0.9, g: 0.8, b: 0.2 },   // Yellow
            { r: 0.8, g: 0.3, b: 0.9 },   // Magenta
        ];

        for (let i = 0; i < treeCount; i++) {
            // Random position within chunk
            const margin = 3;
            const localX = margin + random() * (this.config.chunkSize - 2 * margin);
            const localZ = margin + random() * (this.config.chunkSize - 2 * margin);

            const worldX = worldStartX + localX;
            const worldZ = worldStartZ + localZ;
            const worldY = this.getHeightAtPosition(worldX, worldZ);

            // Get biome - trees prefer vegetation biomes
            const biome = this.getBiomeAtPosition(worldX, worldZ);

            // Skip some trees in non-vegetation biomes
            if (biome === 'rocky' && random() > 0.3) continue; // 30% chance in rocky
            if (biome === 'desert' && random() > 0.2) continue; // 20% chance in desert

            // Random scale and colors
            const scale = 0.5 + random() * 1.0;
            const capColor = capColors[Math.floor(random() * capColors.length)];
            const glowColor = glowColors[Math.floor(random() * glowColors.length)];

            const treeId = this.treeRenderer.createTree({
                position: new Vector3(worldX, worldY, worldZ),
                scale,
                capColor: new Color3(capColor.r, capColor.g, capColor.b),
                glowColor: new Color3(glowColor.r, glowColor.g, glowColor.b)
            });

            treeIds.push(treeId);
        }

        // Store tree IDs for this chunk
        this.treesPerChunk.set(chunkKey, treeIds);
    }

    /**
     * Get mineral capacity multiplier based on biome
     */
    private getBiomeMineralMultiplier(biome: string): number {
        switch (biome) {
            case 'rocky': return 1.5; // Rocky areas have richer deposits
            case 'desert': return 1.2; // Desert has moderate deposits
            case 'vegetation': return 0.8; // Vegetation areas have fewer minerals
            default: return 1.0;
        }
    }

    /**
     * Create seeded random number generator
     */
    private createSeededRandom(seed: number): () => number {
        let state = seed;
        return () => {
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        };
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
            chunk.dispose();
            this.chunks.delete(chunkKey);
        }

        // Dispose mineral deposits for this chunk
        const deposits = this.mineralDeposits.get(chunkKey);
        if (deposits) {
            deposits.forEach(deposit => deposit.dispose());
            this.mineralDeposits.delete(chunkKey);
        }

        // Remove trees for this chunk
        const treeIds = this.treesPerChunk.get(chunkKey);
        if (treeIds && this.treeRenderer) {
            treeIds.forEach(treeId => this.treeRenderer!.removeTree(treeId));
            this.treesPerChunk.delete(chunkKey);
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
     * Get all mineral deposits within a radius of a position
     */
    public getMineralDepositsNear(position: Vector3, radius: number): MineralDeposit[] {
        const nearbyDeposits: MineralDeposit[] = [];

        for (const deposits of this.mineralDeposits.values()) {
            for (const deposit of deposits) {
                const distance = Vector3.Distance(position, deposit.getPosition());
                if (distance <= radius) {
                    nearbyDeposits.push(deposit);
                }
            }
        }

        return nearbyDeposits;
    }

    /**
     * Get all visible mineral deposits
     */
    public getVisibleMineralDeposits(): MineralDeposit[] {
        const visibleDeposits: MineralDeposit[] = [];

        for (const deposits of this.mineralDeposits.values()) {
            for (const deposit of deposits) {
                if (deposit.isVisible()) {
                    visibleDeposits.push(deposit);
                }
            }
        }

        return visibleDeposits;
    }

    /**
     * Get all mineral deposits (including hidden ones)
     */
    public getAllMineralDeposits(): MineralDeposit[] {
        const allDeposits: MineralDeposit[] = [];

        for (const deposits of this.mineralDeposits.values()) {
            allDeposits.push(...deposits);
        }

        return allDeposits;
    }

    /**
     * Get mineral deposit by ID
     */
    public getMineralDepositById(depositId: string): MineralDeposit | null {
        for (const deposits of this.mineralDeposits.values()) {
            for (const deposit of deposits) {
                if (deposit.getId() === depositId) {
                    return deposit;
                }
            }
        }
        return null;
    }

    /**
     * Get current terrain statistics
     */
    public getStats(): {
        loadedChunks: number;
        totalMineralDeposits: number;
        visibleMineralDeposits: number;
        seed: number;
        config: TerrainConfig;
    } {
        const allDeposits = this.getAllMineralDeposits();
        const visibleDeposits = allDeposits.filter(d => d.isVisible());

        return {
            loadedChunks: this.chunks.size,
            totalMineralDeposits: allDeposits.length,
            visibleMineralDeposits: visibleDeposits.length,
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
    }

    /**
     * Force update of all chunks (useful for config changes)
     */
    public forceUpdate(): void {
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
        // Dispose all chunks
        for (const chunk of this.chunks.values()) {
            chunk.dispose();
        }
        this.chunks.clear();

        // Dispose all mineral deposits
        for (const deposits of this.mineralDeposits.values()) {
            deposits.forEach(deposit => deposit.dispose());
        }
        this.mineralDeposits.clear();

        // Remove all trees
        if (this.treeRenderer) {
            for (const treeIds of this.treesPerChunk.values()) {
                treeIds.forEach(treeId => this.treeRenderer!.removeTree(treeId));
            }
        }
        this.treesPerChunk.clear();
    }
}