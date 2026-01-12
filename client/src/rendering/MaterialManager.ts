/**
 * MaterialManager - Low poly material creation and management
 * 
 * Factory pattern for creating consistent low poly materials with flat shading.
 * Manages the color palette and material properties for the SciFi aesthetic.
 */

import { Scene, StandardMaterial, Color3, Material } from '@babylonjs/core';

export interface ColorPalette {
    // Unit colors
    worker: Color3;      // Green
    scout: Color3;       // Blue  
    protector: Color3;   // Red
    parasite: Color3;    // Dark purple
    combatParasite: Color3; // Darker, more aggressive
    
    // Building colors
    base: Color3;        // Yellow
    powerPlant: Color3;  // Orange
    
    // Environment colors
    terrain: {
        vegetation: Color3;  // Green shades
        desert: Color3;      // Sand yellow
        rocky: Color3;       // Mud brown
    };
    
    // Resource colors
    mineral: Color3;     // Bright blue
    flora: Color3;       // Green vegetation
    stem: Color3;        // Brown stems
    
    // Effect colors
    energy: Color3;      // Blue/white
    shield: Color3;      // Translucent matching unit colors
}

export class MaterialManager {
    private scene: Scene;
    private materials: Map<string, StandardMaterial> = new Map();
    private colorPalette: ColorPalette = {
        // Unit colors (primary colors for instant recognition)
        worker: new Color3(0.2, 0.8, 0.2),      // Bright green
        scout: new Color3(0.2, 0.4, 1.0),       // Bright blue
        protector: new Color3(1.0, 0.2, 0.2),   // Bright red
        parasite: new Color3(0.4, 0.1, 0.6),    // Dark purple
        combatParasite: new Color3(0.2, 0.1, 0.1), // Dark red-brown (more aggressive)
        
        // Building colors (warm colors for infrastructure)
        base: new Color3(1.0, 0.9, 0.2),        // Bright yellow
        powerPlant: new Color3(1.0, 0.6, 0.1),  // Orange
        
        // Environment colors (natural earth tones)
        terrain: {
            vegetation: new Color3(0.3, 0.6, 0.2),  // Forest green
            desert: new Color3(0.8, 0.7, 0.4),      // Sand yellow
            rocky: new Color3(0.4, 0.3, 0.2)        // Mud brown
        },
        
        // Resource colors
        mineral: new Color3(0.2, 0.6, 1.0),     // Bright blue minerals
        flora: new Color3(0.2, 0.7, 0.3),       // Vegetation green
        stem: new Color3(0.4, 0.2, 0.1),        // Brown stems
        
        // Effect colors
        energy: new Color3(0.6, 0.9, 1.0),      // Light blue energy
        shield: new Color3(0.8, 0.8, 1.0)       // Translucent white-blue
    };

    constructor(scene: Scene) {
        this.scene = scene;
    }


    /**
     * Create a low poly material with flat shading
     */
    public createLowPolyMaterial(name: string, color: Color3, options?: {
        emissive?: Color3;
        specular?: Color3;
        roughness?: number;
        metallic?: boolean;
    }): StandardMaterial {
        // Check if material already exists
        if (this.materials.has(name)) {
            return this.materials.get(name)!;
        }

        // Create new standard material
        const material = new StandardMaterial(name, this.scene);

        // Configure for low poly flat shading
        material.diffuseColor = color;
        material.specularColor = options?.specular || new Color3(0.1, 0.1, 0.1);
        material.emissiveColor = options?.emissive || new Color3(0, 0, 0);
        
        // Configure for low poly appearance
        // Note: flatShading property doesn't exist in current Babylon.js
        // We'll achieve flat shading through vertex normals instead
        
        // Disable textures for pure vertex color rendering
        material.disableLighting = false; // Keep lighting for depth
        
        // Configure material properties
        material.roughness = options?.roughness || 0.8;
        
        // Optimize for performance
        material.freeze(); // Freeze material for better performance
        
        // Store material
        this.materials.set(name, material);
        
        return material;
    }

    /**
     * Get material for worker units
     */
    public getWorkerMaterial(): StandardMaterial {
        return this.createLowPolyMaterial('worker', this.colorPalette.worker);
    }

    /**
     * Get material for scout units
     */
    public getScoutMaterial(): StandardMaterial {
        return this.createLowPolyMaterial('scout', this.colorPalette.scout);
    }

    /**
     * Get material for protector units
     */
    public getProtectorMaterial(): StandardMaterial {
        return this.createLowPolyMaterial('protector', this.colorPalette.protector);
    }

    /**
     * Get material for energy parasites (bronze/brown body)
     */
    public getParasiteMaterial(): StandardMaterial {
        return this.createLowPolyMaterial('parasite', new Color3(0.4, 0.25, 0.15), {
            emissive: new Color3(0.05, 0.03, 0.02), // Subtle bronze glow
            specular: new Color3(0.3, 0.2, 0.1)     // Metallic reflections
        });
    }

    /**
     * Get material for combat parasites (darker, more aggressive appearance)
     */
    public getCombatParasiteMaterial(): StandardMaterial {
        return this.createLowPolyMaterial('combatParasite', this.colorPalette.combatParasite, {
            emissive: new Color3(0.1, 0.05, 0.05), // Subtle red glow
            specular: new Color3(0.4, 0.2, 0.2),   // Red-tinted reflections
            roughness: 0.7
        });
    }

    /**
     * Get material for parasite crystals (translucent cyan)
     */
    public getParasiteCrystalMaterial(): StandardMaterial {
        const material = this.createLowPolyMaterial('parasiteCrystal', new Color3(0.1, 0.8, 0.7), {
            emissive: new Color3(0.05, 0.4, 0.35),
            specular: new Color3(0.2, 1.0, 0.9)
        });
        
        // Make crystals translucent
        material.alpha = 0.7;
        material.transparencyMode = Material.MATERIAL_ALPHABLEND;
        
        return material;
    }

    /**
     * Get material for parasite energy orbs (bright cyan)
     */
    public getParasiteOrbMaterial(): StandardMaterial {
        const material = this.createLowPolyMaterial('parasiteOrb', new Color3(0.2, 1.0, 0.9), {
            emissive: new Color3(0.1, 0.6, 0.5)
        });
        
        material.disableLighting = true; // Pure emissive glow
        
        return material;
    }

    /**
     * Get material for base building
     */
    public getBaseMaterial(): StandardMaterial {
        return this.createLowPolyMaterial('base', this.colorPalette.base, {
            emissive: new Color3(0.1, 0.1, 0.0) // Slight glow
        });
    }

    /**
     * Get material for power plant building
     */
    public getPowerPlantMaterial(): StandardMaterial {
        return this.createLowPolyMaterial('powerPlant', this.colorPalette.powerPlant, {
            emissive: new Color3(0.1, 0.05, 0.0) // Orange glow
        });
    }

    /**
     * Get material for terrain (vegetation)
     */
    public getTerrainVegetationMaterial(): StandardMaterial {
        return this.createLowPolyMaterial('terrainVegetation', this.colorPalette.terrain.vegetation);
    }

    /**
     * Get material for terrain (desert)
     */
    public getTerrainDesertMaterial(): StandardMaterial {
        return this.createLowPolyMaterial('terrainDesert', this.colorPalette.terrain.desert);
    }

    /**
     * Get material for terrain (rocky)
     */
    public getTerrainRockyMaterial(): StandardMaterial {
        return this.createLowPolyMaterial('terrainRocky', this.colorPalette.terrain.rocky);
    }

    /**
     * Get material for mineral deposits
     */
    public getMineralMaterial(): StandardMaterial {
        return this.createLowPolyMaterial('mineral', this.colorPalette.mineral, {
            emissive: new Color3(0.1, 0.3, 0.5), // Blue glow
            specular: new Color3(0.2, 0.4, 0.6)  // Blue-tinted reflections
        });
    }

    /**
     * Get material for flora
     */
    public getFloraMaterial(): StandardMaterial {
        return this.createLowPolyMaterial('flora', this.colorPalette.flora);
    }

    /**
     * Get material for stems
     */
    public getStemMaterial(): StandardMaterial {
        return this.createLowPolyMaterial('stem', this.colorPalette.stem);
    }

    /**
     * Create a custom material with specific color
     */
    public createCustomMaterial(name: string, color: Color3, options?: {
        emissive?: Color3;
        specular?: Color3;
        roughness?: number;
        metallic?: boolean;
        transparent?: boolean;
        alpha?: number;
    }): StandardMaterial {
        const material = this.createLowPolyMaterial(name, color, options);
        
        // Handle transparency
        if (options?.transparent) {
            material.alpha = options.alpha || 0.5;
            material.transparencyMode = Material.MATERIAL_ALPHABLEND;
        }
        
        return material;
    }

    /**
     * Get the color palette
     */
    public getColorPalette(): ColorPalette {
        return this.colorPalette;
    }

    /**
     * Get a material by name
     */
    public getMaterial(name: string): StandardMaterial | undefined {
        return this.materials.get(name);
    }

    /**
     * List all created materials
     */
    public listMaterials(): string[] {
        return Array.from(this.materials.keys());
    }

    /**
     * Dispose of all materials
     */
    public dispose(): void {

        // Dispose all materials
        for (const [name, material] of this.materials) {
            material.dispose();
        }

        this.materials.clear();
    }
}