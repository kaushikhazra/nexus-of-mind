/**
 * TerrainRenderer - Mini terrain chunk generation for Introduction Screen
 * 
 * Extracts terrain generation logic from TerrainGenerator to create
 * close-up terrain views with mineral deposits and atmospheric effects
 * for the Introduction Screen 3D model visualization.
 */

import { 
    Scene, 
    Mesh, 
    Vector3, 
    VertexData, 
    StandardMaterial, 
    Color3,
    Color4,
    MeshBuilder,
    TransformNode,
    ParticleSystem,
    Texture,
    Animation
} from '@babylonjs/core';
import { MaterialManager } from '../../rendering/MaterialManager';
import { NoiseGenerator } from '../../utils/NoiseGenerator';

export interface TerrainConfig {
    chunkSize: number;
    heightScale: number;
    mineralDeposits: boolean;
    atmosphericEffects: boolean;
    toxicGlow: boolean;
}

export interface ChunkData {
    heights: number[][];
    biomes: string[][];
}

export class TerrainRenderer {
    private scene: Scene;
    private materialManager: MaterialManager;
    private noiseGenerator: NoiseGenerator;
    
    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;
        this.noiseGenerator = new NoiseGenerator(42); // Fixed seed for consistent terrain
    }

    /**
     * Create a close-up terrain view for the Introduction Screen
     */
    public createTerrainCloseup(config: TerrainConfig): Mesh {
        // Generate mini terrain chunk data
        const chunkData = this.generateMiniTerrain(config.chunkSize);
        
        // Create the terrain mesh
        const terrainMesh = this.createTerrainMesh(chunkData, config);
        
        // Create container for all terrain elements
        const terrainContainer = new TransformNode('terrain_closeup', this.scene);
        terrainMesh.parent = terrainContainer;
        
        // Add mineral deposits if enabled
        if (config.mineralDeposits) {
            const mineralDeposits = this.addMineralDeposits(terrainContainer, config.chunkSize);
            mineralDeposits.forEach(deposit => {
                deposit.parent = terrainContainer;
            });
        }
        
        // Add atmospheric effects if enabled
        if (config.atmosphericEffects) {
            const particleSystem = this.createAtmosphericParticles();
            if (particleSystem) {
                // Use the terrain mesh as emitter instead of container
                particleSystem.emitter = terrainMesh;
            }
        }
        
        // Add toxic glow effect if enabled
        if (config.toxicGlow) {
            this.addToxicGlowEffect(terrainMesh);
        }
        
        // Return the terrain mesh (the main visual element)
        return terrainMesh;
    }

    /**
     * Generate height and biome data for a mini terrain chunk
     */
    private generateMiniTerrain(size: number): ChunkData {
        const resolution = 32; // Lower resolution for close-up view
        const heights: number[][] = [];
        const biomes: string[][] = [];
        
        const step = size / resolution;
        
        // Generate heights and biomes
        for (let i = 0; i <= resolution; i++) {
            heights[i] = [];
            biomes[i] = [];
            
            for (let j = 0; j <= resolution; j++) {
                const x = i * step - size / 2; // Center the terrain
                const z = j * step - size / 2;
                
                // Generate height using noise
                const height = this.generateHeight(x, z);
                const biome = this.getBiomeType(height);
                
                heights[i][j] = height;
                biomes[i][j] = biome;
            }
        }
        
        return { heights, biomes };
    }

    /**
     * Generate height value for terrain at given coordinates
     */
    private generateHeight(x: number, z: number): number {
        // Base terrain with multiple noise layers for complexity
        const baseNoise = this.fractalNoise2D(x, z, 4, 0.4, 0.02);
        
        // Add fine detail noise for surface variation
        const detailNoise = this.fractalNoise2D(x * 0.1, z * 0.1, 3, 0.3, 0.1);
        
        // Add micro-detail for natural surface roughness
        const microNoise = this.fractalNoise2D(x * 0.5, z * 0.5, 2, 0.2, 0.2);
        
        // Combine all noise layers
        let combinedNoise = baseNoise + (detailNoise * 0.3) + (microNoise * 0.1);
        
        // Convert from [-1, 1] to [0, 8] height range for close-up view
        return Math.max(0, (combinedNoise + 1) * 4);
    }

    /**
     * Generate fractal noise with multiple octaves
     */
    private fractalNoise2D(
        x: number, 
        y: number, 
        octaves: number = 4, 
        persistence: number = 0.4, 
        scale: number = 0.02
    ): number {
        let value = 0;
        let amplitude = 1;
        let frequency = scale;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.noiseGenerator.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2.1;
        }

        return value / maxValue;
    }

    /**
     * Get biome type based on height value
     */
    private getBiomeType(height: number): 'vegetation' | 'desert' | 'rocky' {
        if (height < 3) {
            return 'vegetation';  // Low areas - green
        } else if (height < 6) {
            return 'desert';      // Mid areas - yellow
        } else {
            return 'rocky';       // High areas - brown
        }
    }

    /**
     * Create terrain mesh from chunk data
     */
    private createTerrainMesh(chunkData: ChunkData, config: TerrainConfig): Mesh {
        const { heights, biomes } = chunkData;
        const vertexData = new VertexData();
        
        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        
        const resolution = heights.length - 1;
        const step = config.chunkSize / resolution;
        
        // Generate vertices
        for (let i = 0; i <= resolution; i++) {
            for (let j = 0; j <= resolution; j++) {
                const x = i * step - config.chunkSize / 2;
                const z = j * step - config.chunkSize / 2;
                const y = heights[i][j] * config.heightScale;
                
                positions.push(x, y, z);
                
                // Color based on biome
                const biome = biomes[i][j];
                const color = this.getBiomeColor(biome);
                colors.push(color.r, color.g, color.b, 1.0);
                
                // Normal (will be recalculated)
                normals.push(0, 1, 0);
            }
        }
        
        // Generate indices for triangles
        for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
                const topLeft = i * (resolution + 1) + j;
                const topRight = topLeft + 1;
                const bottomLeft = (i + 1) * (resolution + 1) + j;
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
        
        // Create mesh
        const mesh = new Mesh('terrain_closeup_mesh', this.scene);
        vertexData.applyToMesh(mesh);
        
        // Apply material based on dominant biome
        this.applyTerrainMaterial(mesh, biomes);
        
        return mesh;
    }

    /**
     * Get color values for biome type
     */
    private getBiomeColor(biome: string): { r: number; g: number; b: number } {
        const palette = this.materialManager.getColorPalette();
        
        // Add some variation for natural look
        const variation = 0.1;
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
                return { r: 0.5, g: 0.5, b: 0.5 };
        }
    }

    /**
     * Apply material based on dominant biome in terrain
     */
    private applyTerrainMaterial(mesh: Mesh, biomes: string[][]): void {
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
        
        mesh.material = material;
    }

    /**
     * Add mineral deposits to the terrain
     */
    private addMineralDeposits(parent: TransformNode, chunkSize: number): Mesh[] {
        const deposits: Mesh[] = [];
        const depositCount = 3 + Math.floor(Math.random() * 3); // 3-5 deposits
        
        for (let i = 0; i < depositCount; i++) {
            // Random position within terrain bounds
            const x = (Math.random() - 0.5) * chunkSize * 0.8;
            const z = (Math.random() - 0.5) * chunkSize * 0.8;
            const y = this.generateHeight(x, z) * 0.5; // Use height scale
            
            // Create mineral cluster
            const cluster = this.createMineralCluster(x, y, z);
            cluster.parent = parent;
            deposits.push(cluster);
        }
        
        return deposits;
    }

    /**
     * Create a mineral deposit cluster
     */
    private createMineralCluster(x: number, y: number, z: number): Mesh {
        // Create cluster container
        const clusterNode = new TransformNode('mineral_cluster', this.scene);
        clusterNode.position = new Vector3(x, y, z);
        
        // Create 2-4 mineral chunks
        const chunkCount = 2 + Math.floor(Math.random() * 3);
        const chunks: Mesh[] = [];
        
        for (let i = 0; i < chunkCount; i++) {
            // Create irregular mineral chunk
            const chunk = MeshBuilder.CreatePolyhedron('mineral_chunk', {
                type: 1, // Octahedron
                size: 0.3 + Math.random() * 0.4
            }, this.scene);
            
            // Make chunks irregular
            chunk.scaling.x = 0.5 + Math.random() * 1.0;
            chunk.scaling.y = 0.4 + Math.random() * 0.8;
            chunk.scaling.z = 0.5 + Math.random() * 1.0;
            
            // Position in cluster
            const angle = (i / chunkCount) * Math.PI * 2 + Math.random() * 0.8;
            const distance = 0.2 * Math.random();
            
            chunk.position.x = Math.cos(angle) * distance;
            chunk.position.z = Math.sin(angle) * distance;
            chunk.position.y = (chunk.scaling.y * 0.3) / 2;
            
            // Random rotation
            chunk.rotation.y = Math.random() * Math.PI * 2;
            chunk.rotation.x = (Math.random() - 0.5) * 0.8;
            chunk.rotation.z = (Math.random() - 0.5) * 0.8;
            
            // Apply mineral material
            chunk.material = this.materialManager.getMineralMaterial();
            chunk.parent = clusterNode;
            chunks.push(chunk);
        }
        
        // Return the first chunk as representative mesh
        return chunks[0];
    }

    /**
     * Create atmospheric particle effects
     */
    private createAtmosphericParticles(): ParticleSystem | null {
        try {
            const particleSystem = new ParticleSystem('atmospheric_particles', 50, this.scene);
            
            // Create particle texture (simple white dot)
            const particleTexture = new Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', this.scene);
            particleSystem.particleTexture = particleTexture;
            
            // Particle properties
            particleSystem.minEmitBox = new Vector3(-5, 0, -5);
            particleSystem.maxEmitBox = new Vector3(5, 8, 5);
            
            particleSystem.color1 = new Color4(0.8, 0.6, 0.2, 1.0); // Orange-yellow
            particleSystem.color2 = new Color4(0.6, 0.8, 0.3, 1.0); // Yellow-green
            particleSystem.colorDead = new Color4(0.4, 0.4, 0.2, 0.0); // Dim yellow
            
            particleSystem.minSize = 0.05;
            particleSystem.maxSize = 0.15;
            
            particleSystem.minLifeTime = 2.0;
            particleSystem.maxLifeTime = 4.0;
            
            particleSystem.emitRate = 10;
            
            // Gravity and direction
            particleSystem.gravity = new Vector3(0, -0.5, 0);
            particleSystem.direction1 = new Vector3(-0.2, 0.5, -0.2);
            particleSystem.direction2 = new Vector3(0.2, 1.0, 0.2);
            
            particleSystem.minEmitPower = 0.2;
            particleSystem.maxEmitPower = 0.5;
            
            particleSystem.start();
            
            return particleSystem;
        } catch (error) {
            console.warn('Failed to create atmospheric particles:', error);
            return null;
        }
    }

    /**
     * Add toxic glow effect to terrain
     */
    private addToxicGlowEffect(terrainMesh: Mesh): void {
        if (!terrainMesh.material) return;
        
        const material = terrainMesh.material as StandardMaterial;
        
        // Add subtle toxic glow
        material.emissiveColor = new Color3(0.1, 0.3, 0.1); // Green glow
        
        // Create pulsing animation
        const glowAnimation = Animation.CreateAndStartAnimation(
            'toxicGlow',
            material,
            'emissiveColor',
            30, // 30 FPS
            60, // 2 seconds duration
            new Color3(0.1, 0.3, 0.1), // Start color
            new Color3(0.2, 0.5, 0.2), // End color
            Animation.ANIMATIONLOOPMODE_CYCLE
        );
        
        if (glowAnimation) {
            // Create animation keys for pulsing effect
            const keys = [
                { frame: 0, value: new Color3(0.1, 0.3, 0.1) },
                { frame: 30, value: new Color3(0.2, 0.5, 0.2) },
                { frame: 60, value: new Color3(0.1, 0.3, 0.1) }
            ];
            
            // Create the animation manually since setKeys might not be available
            const animation = new Animation(
                'toxicGlowAnimation',
                'emissiveColor',
                30,
                Animation.ANIMATIONTYPE_COLOR3,
                Animation.ANIMATIONLOOPMODE_CYCLE
            );
            animation.setKeys(keys);
            material.animations = [animation];
            this.scene.beginAnimation(material, 0, 60, true);
        }
    }
}