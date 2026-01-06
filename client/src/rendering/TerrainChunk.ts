/**
 * TerrainChunk - Individual terrain chunk management and lifecycle
 * 
 * Manages creation, positioning, and disposal of individual terrain chunks.
 * Handles mesh generation from height maps and material application.
 */

import { Scene, Mesh, Vector3, VertexData, StandardMaterial } from '@babylonjs/core';
import { MaterialManager } from './MaterialManager';

export interface ChunkData {
    heights: number[][];
    biomes: string[][];
}

export class TerrainChunk {
    private scene: Scene;
    private materialManager: MaterialManager;
    private mesh: Mesh | null = null;
    private chunkX: number;
    private chunkZ: number;
    private size: number;
    private resolution: number;

    constructor(
        scene: Scene,
        materialManager: MaterialManager,
        chunkX: number,
        chunkZ: number,
        size: number = 64,
        resolution: number = 64
    ) {
        this.scene = scene;
        this.materialManager = materialManager;
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.size = size;
        this.resolution = resolution;
    }

    /**
     * Create terrain mesh from height and biome data
     */
    public create(chunkData: ChunkData): void {
        if (this.mesh) {
            console.warn(`Chunk at (${this.chunkX}, ${this.chunkZ}) already exists`);
            return;
        }

        try {
            // Generate mesh geometry
            const vertexData = this.generateVertexData(chunkData);
            
            // Create mesh
            this.mesh = new Mesh(`terrainChunk_${this.chunkX}_${this.chunkZ}`, this.scene);
            vertexData.applyToMesh(this.mesh);

            // Position chunk in world space
            const worldX = this.chunkX * this.size;
            const worldZ = this.chunkZ * this.size;
            this.mesh.position = new Vector3(worldX, 0, worldZ);

            // Apply material based on dominant biome
            this.applyMaterial(chunkData.biomes);

            // Optimize mesh
            this.mesh.freezeWorldMatrix();
            this.mesh.doNotSyncBoundingInfo = true;

            console.log(`✅ Terrain chunk created at (${this.chunkX}, ${this.chunkZ})`);

        } catch (error) {
            console.error(`❌ Failed to create terrain chunk at (${this.chunkX}, ${this.chunkZ}):`, error);
            throw error;
        }
    }

    /**
     * Generate vertex data from height and biome information with boundary blending
     */
    private generateVertexData(chunkData: ChunkData): VertexData {
        const { heights, biomes } = chunkData;
        const vertexData = new VertexData();

        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        const step = this.size / this.resolution;

        // Generate vertices - use world coordinates for consistent positioning
        for (let i = 0; i <= this.resolution; i++) {
            for (let j = 0; j <= this.resolution; j++) {
                // World position for this vertex
                const worldX = this.chunkX * this.size + (i * step);
                const worldZ = this.chunkZ * this.size + (j * step);
                
                // Local position within chunk
                const x = i * step;
                const z = j * step;
                const y = heights[i][j];

                // Position (local to chunk)
                positions.push(x, y, z);

                // Color based on biome with blending for boundaries
                const biome = biomes[i][j];
                const color = this.getBiomeColorWithBlending(biome, i, j, biomes);
                colors.push(color.r, color.g, color.b, 1.0);

                // Calculate normal (will be recalculated for flat shading)
                normals.push(0, 1, 0);
            }
        }

        // Generate indices for triangles
        for (let i = 0; i < this.resolution; i++) {
            for (let j = 0; j < this.resolution; j++) {
                const topLeft = i * (this.resolution + 1) + j;
                const topRight = topLeft + 1;
                const bottomLeft = (i + 1) * (this.resolution + 1) + j;
                const bottomRight = bottomLeft + 1;

                // First triangle
                indices.push(topLeft, bottomLeft, topRight);
                // Second triangle
                indices.push(topRight, bottomLeft, bottomRight);
            }
        }

        // Set vertex data
        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.colors = colors;

        // Calculate flat normals for low poly aesthetic
        VertexData.ComputeNormals(positions, indices, normals);
        vertexData.normals = normals;

        return vertexData;
    }

    /**
     * Get color values for biome type with natural variation
     */
    private getBiomeColor(biome: string): { r: number; g: number; b: number } {
        const palette = this.materialManager.getColorPalette();
        
        // Add some random variation to make biomes look more natural
        const variation = 0.1; // 10% color variation
        const randomR = (Math.random() - 0.5) * variation;
        const randomG = (Math.random() - 0.5) * variation;
        const randomB = (Math.random() - 0.5) * variation;
        
        switch (biome) {
            case 'vegetation':
                return {
                    r: Math.max(0, Math.min(1, palette.terrain.vegetation.r + randomR)),
                    g: Math.max(0, Math.min(1, palette.terrain.vegetation.g + randomG)),
                    b: Math.max(0, Math.min(1, palette.terrain.vegetation.b + randomB))
                };
            case 'desert':
                return {
                    r: Math.max(0, Math.min(1, palette.terrain.desert.r + randomR)),
                    g: Math.max(0, Math.min(1, palette.terrain.desert.g + randomG)),
                    b: Math.max(0, Math.min(1, palette.terrain.desert.b + randomB))
                };
            case 'rocky':
                return {
                    r: Math.max(0, Math.min(1, palette.terrain.rocky.r + randomR)),
                    g: Math.max(0, Math.min(1, palette.terrain.rocky.g + randomG)),
                    b: Math.max(0, Math.min(1, palette.terrain.rocky.b + randomB))
                };
            default:
                return { r: 0.5, g: 0.5, b: 0.5 }; // Gray fallback
        }
    }

    /**
     * Get biome color with boundary blending for seamless chunk transitions
     */
    private getBiomeColorWithBlending(
        biome: string, 
        i: number, 
        j: number, 
        biomes: string[][]
    ): { r: number; g: number; b: number } {
        const baseColor = this.getBiomeColor(biome);
        
        // Check if we're near chunk boundaries (first/last few vertices)
        const blendDistance = 3; // Blend over 3 vertices at boundaries
        const maxIndex = this.resolution;
        
        const nearLeftEdge = i < blendDistance;
        const nearRightEdge = i > maxIndex - blendDistance;
        const nearTopEdge = j < blendDistance;
        const nearBottomEdge = j > maxIndex - blendDistance;
        
        // If not near any boundary, return base color
        if (!nearLeftEdge && !nearRightEdge && !nearTopEdge && !nearBottomEdge) {
            return baseColor;
        }
        
        // Blend with neighboring biomes for smooth transitions
        let blendedColor = { ...baseColor };
        let blendCount = 1;
        
        // Sample neighboring biomes and blend colors
        const sampleRadius = 2;
        for (let di = -sampleRadius; di <= sampleRadius; di++) {
            for (let dj = -sampleRadius; dj <= sampleRadius; dj++) {
                const ni = i + di;
                const nj = j + dj;
                
                if (ni >= 0 && ni <= maxIndex && nj >= 0 && nj <= maxIndex) {
                    const neighborBiome = biomes[ni][nj];
                    if (neighborBiome !== biome) {
                        const neighborColor = this.getBiomeColor(neighborBiome);
                        const distance = Math.sqrt(di * di + dj * dj);
                        const weight = 1.0 / (1.0 + distance);
                        
                        blendedColor.r += neighborColor.r * weight;
                        blendedColor.g += neighborColor.g * weight;
                        blendedColor.b += neighborColor.b * weight;
                        blendCount += weight;
                    }
                }
            }
        }
        
        // Normalize blended color
        blendedColor.r /= blendCount;
        blendedColor.g /= blendCount;
        blendedColor.b /= blendCount;
        
        return blendedColor;
    }

    /**
     * Apply material based on dominant biome in chunk
     */
    private applyMaterial(biomes: string[][]): void {
        if (!this.mesh) return;

        // Count biome occurrences to find dominant biome
        const biomeCounts: { [key: string]: number } = {};
        
        for (let i = 0; i < biomes.length; i++) {
            for (let j = 0; j < biomes[i].length; j++) {
                const biome = biomes[i][j];
                biomeCounts[biome] = (biomeCounts[biome] || 0) + 1;
            }
        }

        // Find dominant biome
        let dominantBiome = 'vegetation';
        let maxCount = 0;
        
        for (const [biome, count] of Object.entries(biomeCounts)) {
            if (count > maxCount) {
                maxCount = count;
                dominantBiome = biome;
            }
        }

        // Apply appropriate material
        let material: StandardMaterial;
        switch (dominantBiome) {
            case 'vegetation':
                material = this.materialManager.getTerrainVegetationMaterial();
                break;
            case 'desert':
                material = this.materialManager.getTerrainDesertMaterial();
                break;
            case 'rocky':
                material = this.materialManager.getTerrainRockyMaterial();
                break;
            default:
                material = this.materialManager.getTerrainVegetationMaterial();
        }

        this.mesh.material = material;
    }

    /**
     * Get chunk coordinates
     */
    public getCoordinates(): { x: number; z: number } {
        return { x: this.chunkX, z: this.chunkZ };
    }

    /**
     * Get world position of chunk center
     */
    public getWorldPosition(): Vector3 {
        const worldX = this.chunkX * this.size + this.size / 2;
        const worldZ = this.chunkZ * this.size + this.size / 2;
        return new Vector3(worldX, 0, worldZ);
    }

    /**
     * Get distance from chunk to a world position
     */
    public getDistanceToPosition(position: Vector3): number {
        const chunkCenter = this.getWorldPosition();
        return Vector3.Distance(chunkCenter, position);
    }

    /**
     * Check if chunk is within specified distance of position
     */
    public isWithinDistance(position: Vector3, distance: number): boolean {
        return this.getDistanceToPosition(position) <= distance;
    }

    /**
     * Get the mesh (if created)
     */
    public getMesh(): Mesh | null {
        return this.mesh;
    }

    /**
     * Check if chunk is created
     */
    public isCreated(): boolean {
        return this.mesh !== null;
    }

    /**
     * Update chunk visibility based on camera distance
     */
    public updateVisibility(cameraPosition: Vector3, maxDistance: number): void {
        if (!this.mesh) return;

        const distance = this.getDistanceToPosition(cameraPosition);
        this.mesh.setEnabled(distance <= maxDistance);
    }

    /**
     * Dispose of chunk resources
     */
    public dispose(): void {
        if (this.mesh) {
            console.log(`🗑️ Disposing terrain chunk at (${this.chunkX}, ${this.chunkZ})`);
            
            this.mesh.dispose();
            this.mesh = null;
            
            console.log(`✅ Terrain chunk disposed at (${this.chunkX}, ${this.chunkZ})`);
        }
    }
}