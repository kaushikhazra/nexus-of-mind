/**
 * NoiseGenerator - Perlin noise implementation for natural terrain variation
 * 
 * Provides deterministic noise generation for procedural terrain height maps.
 * Uses seed-based generation for reproducible infinite worlds.
 */

export class NoiseGenerator {
    private permutation: number[] = [];
    private seed: number;

    constructor(seed: number = 12345) {
        this.seed = seed;
        this.initializePermutation();
    }

    /**
     * Initialize permutation table with seed-based randomization
     */
    private initializePermutation(): void {
        // Create base permutation array
        const basePermutation = Array.from({ length: 256 }, (_, i) => i);
        
        // Shuffle using seeded random
        let random = this.seededRandom(this.seed);
        for (let i = basePermutation.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [basePermutation[i], basePermutation[j]] = [basePermutation[j], basePermutation[i]];
        }
        
        // Duplicate for wrapping
        this.permutation = [...basePermutation, ...basePermutation];
    }

    /**
     * Seeded random number generator for deterministic results
     */
    private seededRandom(seed: number): () => number {
        let currentSeed = seed;
        return () => {
            currentSeed = (currentSeed * 9301 + 49297) % 233280;
            return currentSeed / 233280;
        };
    }

    /**
     * Fade function for smooth interpolation
     */
    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    /**
     * Linear interpolation
     */
    private lerp(a: number, b: number, t: number): number {
        return a + t * (b - a);
    }

    /**
     * Gradient function for Perlin noise
     */
    private grad(hash: number, x: number, y: number): number {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    /**
     * Generate 2D Perlin noise value at given coordinates
     */
    public noise2D(x: number, y: number): number {
        // Find unit grid cell containing point
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        // Get relative x, y coordinates within cell
        x -= Math.floor(x);
        y -= Math.floor(y);

        // Compute fade curves for x, y
        const u = this.fade(x);
        const v = this.fade(y);

        // Hash coordinates of 4 grid corners
        const A = this.permutation[X] + Y;
        const AA = this.permutation[A];
        const AB = this.permutation[A + 1];
        const B = this.permutation[X + 1] + Y;
        const BA = this.permutation[B];
        const BB = this.permutation[B + 1];

        // Blend results from 4 corners
        return this.lerp(
            this.lerp(
                this.grad(this.permutation[AA], x, y),
                this.grad(this.permutation[BA], x - 1, y),
                u
            ),
            this.lerp(
                this.grad(this.permutation[AB], x, y - 1),
                this.grad(this.permutation[BB], x - 1, y - 1),
                u
            ),
            v
        );
    }

    /**
     * Generate fractal noise with multiple octaves for natural terrain
     */
    public fractalNoise2D(
        x: number, 
        y: number, 
        octaves: number = 6, 
        persistence: number = 0.4, 
        scale: number = 0.008
    ): number {
        let value = 0;
        let amplitude = 1;
        let frequency = scale;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2.1; // Slightly irregular frequency for more natural look
        }

        // Normalize to [-1, 1] range
        return value / maxValue;
    }

    /**
     * Generate height value for terrain at given world coordinates
     */
    public generateHeight(x: number, z: number): number {
        // Base terrain with multiple noise layers for complexity
        const baseNoise = this.fractalNoise2D(x, z, 6, 0.4, 0.008);
        
        // Add fine detail noise for surface variation
        const detailNoise = this.fractalNoise2D(x * 0.1, z * 0.1, 4, 0.3, 0.05);
        
        // Add micro-detail for natural surface roughness
        const microNoise = this.fractalNoise2D(x * 0.5, z * 0.5, 3, 0.2, 0.1);
        
        // Ridge noise for more interesting terrain features
        const ridgeNoise = Math.abs(this.fractalNoise2D(x * 0.02, z * 0.02, 3, 0.5, 0.02));
        
        // Combine all noise layers
        let combinedNoise = baseNoise + (detailNoise * 0.3) + (microNoise * 0.1) + (ridgeNoise * 0.4);
        
        // Add some randomness to break up patterns
        const randomFactor = this.fractalNoise2D(x * 0.003, z * 0.003, 2, 0.6, 0.001);
        combinedNoise += randomFactor * 0.2;
        
        // Convert from [-1, 1] to [0, 15] height range for more dramatic terrain
        return Math.max(0, (combinedNoise + 1) * 7.5);
    }

    /**
     * Get biome type based on height value with more variation
     */
    public getBiomeType(height: number): 'vegetation' | 'desert' | 'rocky' {
        // Add some noise-based variation to biome boundaries for more natural transitions
        const biomeNoise = this.fractalNoise2D(height * 0.1, height * 0.1, 2, 0.5, 0.1);
        const adjustedHeight = height + (biomeNoise * 1.5);
        
        if (adjustedHeight < 5) {
            return 'vegetation';  // Low areas - green
        } else if (adjustedHeight < 10) {
            return 'desert';      // Mid areas - yellow
        } else {
            return 'rocky';       // High areas - brown
        }
    }

    /**
     * Generate height map for a terrain chunk
     */
    public generateHeightMap(
        startX: number, 
        startZ: number, 
        size: number, 
        resolution: number = 64
    ): { heights: number[][], biomes: string[][] } {
        const heights: number[][] = [];
        const biomes: string[][] = [];
        
        const step = size / resolution;
        
        for (let i = 0; i <= resolution; i++) {
            heights[i] = [];
            biomes[i] = [];
            
            for (let j = 0; j <= resolution; j++) {
                const worldX = startX + (i * step);
                const worldZ = startZ + (j * step);
                
                const height = this.generateHeight(worldX, worldZ);
                const biome = this.getBiomeType(height);
                
                heights[i][j] = height;
                biomes[i][j] = biome;
            }
        }
        
        return { heights, biomes };
    }

    /**
     * Get current seed value
     */
    public getSeed(): number {
        return this.seed;
    }

    /**
     * Change seed and reinitialize permutation table
     */
    public setSeed(newSeed: number): void {
        this.seed = newSeed;
        this.initializePermutation();
    }
}