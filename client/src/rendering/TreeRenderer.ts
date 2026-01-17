/**
 * TreeRenderer - Alien Mushroom Tree vegetation for sci-fi atmosphere
 *
 * Creates low-poly bioluminescent mushroom trees with glowing spots
 * that fit the game's sci-fi aesthetic.
 */

import {
    Scene,
    Mesh,
    MeshBuilder,
    StandardMaterial,
    Color3,
    Vector3,
    TransformNode
} from '@babylonjs/core';

export interface TreeVisual {
    rootNode: TransformNode;
    trunk: Mesh;
    cap: Mesh;
    glowSpots: Mesh[];
}

export interface TreeConfig {
    position: Vector3;
    scale?: number;
    rotation?: number;
    capColor?: Color3;
    glowColor?: Color3;
}

export class TreeRenderer {
    private scene: Scene;

    // Tree visuals management
    private treeVisuals: Map<string, TreeVisual> = new Map();
    private treeIdCounter: number = 0;

    // Materials
    private trunkMaterial: StandardMaterial | null = null;
    private capMaterial: StandardMaterial | null = null;
    private glowSpotMaterial: StandardMaterial | null = null;
    private rootMaterial: StandardMaterial | null = null;

    // Default colors (can be varied per tree)
    private readonly defaultCapColor = new Color3(0.4, 0.2, 0.5); // Purple
    private readonly defaultGlowColor = new Color3(0.2, 0.9, 0.8); // Cyan-teal

    constructor(scene: Scene) {
        this.scene = scene;
        this.initializeMaterials();
    }

    /**
     * Initialize materials for tree rendering
     */
    private initializeMaterials(): void {
        // Trunk material (dark organic brownish-purple)
        this.trunkMaterial = new StandardMaterial('treeTrunkMaterial', this.scene);
        this.trunkMaterial.diffuseColor = new Color3(0.2, 0.15, 0.18);
        this.trunkMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        this.trunkMaterial.emissiveColor = new Color3(0.02, 0.01, 0.02);

        // Cap material (purple, semi-transparent)
        this.capMaterial = new StandardMaterial('treeCapMaterial', this.scene);
        this.capMaterial.diffuseColor = this.defaultCapColor;
        this.capMaterial.specularColor = new Color3(0.3, 0.2, 0.3);
        this.capMaterial.emissiveColor = this.defaultCapColor.scale(0.15);
        this.capMaterial.alpha = 0.85;

        // Glow spots material (bright bioluminescent)
        this.glowSpotMaterial = new StandardMaterial('treeGlowMaterial', this.scene);
        this.glowSpotMaterial.diffuseColor = this.defaultGlowColor;
        this.glowSpotMaterial.emissiveColor = new Color3(0.3, 1.2, 1.0);
        this.glowSpotMaterial.disableLighting = true;

        // Root/base material
        this.rootMaterial = new StandardMaterial('treeRootMaterial', this.scene);
        this.rootMaterial.diffuseColor = new Color3(0.15, 0.12, 0.14);
        this.rootMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    }

    /**
     * Create a single alien mushroom tree
     */
    public createTree(config: TreeConfig): string {
        const treeId = `tree_${this.treeIdCounter++}`;
        const scale = config.scale || 1.0;
        const rotation = config.rotation || Math.random() * Math.PI * 2;

        // Create root node
        const rootNode = new TransformNode(`tree_root_${treeId}`, this.scene);
        rootNode.position = config.position.clone();
        rootNode.rotation.y = rotation;
        rootNode.scaling = new Vector3(scale, scale, scale);

        // ===== 1. ROOT BASE =====
        const rootBase = MeshBuilder.CreateCylinder(`tree_base_${treeId}`, {
            diameterTop: 0.5,
            diameterBottom: 0.8,
            height: 0.15,
            tessellation: 6
        }, this.scene);
        rootBase.parent = rootNode;
        rootBase.position.y = 0.075;
        rootBase.material = this.rootMaterial;

        // ===== 2. THICK TRUNK =====
        const trunk = MeshBuilder.CreateCylinder(`tree_trunk_${treeId}`, {
            diameterTop: 0.35,
            diameterBottom: 0.5,
            height: 1.5,
            tessellation: 6
        }, this.scene);
        trunk.parent = rootNode;
        trunk.position.y = 0.9;
        trunk.material = this.trunkMaterial;

        // ===== 3. TRUNK RINGS (organic detail) =====
        const ringHeights = [0.4, 0.8, 1.2];
        for (let i = 0; i < ringHeights.length; i++) {
            const ring = MeshBuilder.CreateTorus(`tree_ring_${treeId}_${i}`, {
                diameter: 0.45 - (i * 0.03),
                thickness: 0.04,
                tessellation: 8
            }, this.scene);
            ring.parent = rootNode;
            ring.position.y = ringHeights[i];
            ring.rotation.x = Math.PI / 2;
            ring.material = this.rootMaterial;
        }

        // ===== 4. MUSHROOM CAP (dome) =====
        const cap = MeshBuilder.CreateSphere(`tree_cap_${treeId}`, {
            diameter: 2.0,
            segments: 8,
            slice: 0.5 // Half sphere
        }, this.scene);
        cap.parent = rootNode;
        cap.position.y = 1.65;

        // Create custom cap material if colors specified
        if (config.capColor) {
            const customCapMat = new StandardMaterial(`tree_cap_mat_${treeId}`, this.scene);
            customCapMat.diffuseColor = config.capColor;
            customCapMat.specularColor = new Color3(0.3, 0.2, 0.3);
            customCapMat.emissiveColor = config.capColor.scale(0.15);
            customCapMat.alpha = 0.85;
            cap.material = customCapMat;
        } else {
            cap.material = this.capMaterial;
        }

        // ===== 5. CAP UNDERSIDE (gill-like structure) =====
        const capUnder = MeshBuilder.CreateCylinder(`tree_cap_under_${treeId}`, {
            diameterTop: 1.8,
            diameterBottom: 0.4,
            height: 0.3,
            tessellation: 8
        }, this.scene);
        capUnder.parent = rootNode;
        capUnder.position.y = 1.5;
        capUnder.material = this.trunkMaterial;

        // ===== 6. BIOLUMINESCENT GLOW SPOTS =====
        const glowSpots: Mesh[] = [];
        const spotCount = 8 + Math.floor(Math.random() * 5); // 8-12 spots

        // Create glow material (custom if color specified)
        let spotMaterial = this.glowSpotMaterial;
        if (config.glowColor) {
            spotMaterial = new StandardMaterial(`tree_glow_mat_${treeId}`, this.scene);
            spotMaterial.diffuseColor = config.glowColor;
            spotMaterial.emissiveColor = new Color3(
                config.glowColor.r * 1.5,
                config.glowColor.g * 1.5,
                config.glowColor.b * 1.5
            );
            spotMaterial.disableLighting = true;
        }

        for (let i = 0; i < spotCount; i++) {
            // Distribute spots on the dome surface
            const theta = (i / spotCount) * Math.PI * 2; // Around the cap
            const phi = 0.2 + Math.random() * 0.5; // Height on dome (0.2-0.7)

            const spotRadius = 0.9; // Radius of cap
            const x = Math.cos(theta) * Math.sin(phi * Math.PI) * spotRadius;
            const z = Math.sin(theta) * Math.sin(phi * Math.PI) * spotRadius;
            const y = Math.cos(phi * Math.PI) * spotRadius * 0.5;

            const spotSize = 0.08 + Math.random() * 0.08; // Varied sizes
            const spot = MeshBuilder.CreateSphere(`tree_spot_${treeId}_${i}`, {
                diameter: spotSize,
                segments: 4
            }, this.scene);
            spot.parent = rootNode;
            spot.position.x = x;
            spot.position.z = z;
            spot.position.y = 1.65 + y;
            spot.material = spotMaterial;

            glowSpots.push(spot);
        }

        // ===== 7. TOP SPOT (larger, at apex) =====
        const topSpot = MeshBuilder.CreateSphere(`tree_top_spot_${treeId}`, {
            diameter: 0.15,
            segments: 6
        }, this.scene);
        topSpot.parent = rootNode;
        topSpot.position.y = 2.15;
        topSpot.material = spotMaterial;
        glowSpots.push(topSpot);

        // Store tree visual
        const treeVisual: TreeVisual = {
            rootNode,
            trunk,
            cap,
            glowSpots
        };
        this.treeVisuals.set(treeId, treeVisual);

        return treeId;
    }

    /**
     * Create a cluster of trees at a location
     * @param centerPosition - Center of the cluster
     * @param count - Number of trees in the cluster
     * @param spread - How spread out the trees are
     * @param getTerrainHeight - Optional function to get terrain height at x,z
     */
    public createTreeCluster(
        centerPosition: Vector3,
        count: number = 3,
        spread: number = 3,
        getTerrainHeight?: (x: number, z: number) => number
    ): string[] {
        const treeIds: string[] = [];

        // Color variations for variety
        const capColors = [
            new Color3(0.4, 0.2, 0.5),   // Purple
            new Color3(0.3, 0.25, 0.5),  // Blue-purple
            new Color3(0.5, 0.2, 0.4),   // Pink-purple
            new Color3(0.2, 0.3, 0.45),  // Teal-blue
        ];

        const glowColors = [
            new Color3(0.2, 0.9, 0.8),   // Cyan
            new Color3(0.3, 1.0, 0.5),   // Green
            new Color3(0.9, 0.8, 0.2),   // Yellow
            new Color3(0.8, 0.3, 0.9),   // Magenta
        ];

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
            const distance = spread * 0.3 + Math.random() * spread * 0.7;

            const x = centerPosition.x + Math.cos(angle) * distance;
            const z = centerPosition.z + Math.sin(angle) * distance;
            const y = getTerrainHeight ? getTerrainHeight(x, z) : centerPosition.y;

            const position = new Vector3(x, y, z);

            const scale = 0.6 + Math.random() * 0.8; // 0.6 to 1.4 scale
            const colorIndex = Math.floor(Math.random() * capColors.length);

            const treeId = this.createTree({
                position,
                scale,
                capColor: capColors[colorIndex],
                glowColor: glowColors[Math.floor(Math.random() * glowColors.length)]
            });

            treeIds.push(treeId);
        }

        return treeIds;
    }

    /**
     * Update tree animations (glow pulsing)
     */
    public updateAnimations(): void {
        const time = performance.now() / 1000;

        for (const [treeId, treeVisual] of this.treeVisuals) {
            // Pulse glow spots
            for (let i = 0; i < treeVisual.glowSpots.length; i++) {
                const spot = treeVisual.glowSpots[i];
                // Offset pulse for each spot
                const offset = i * 0.3;
                const pulse = Math.sin(time * 1.5 + offset) * 0.15 + 0.85;
                spot.scaling.set(pulse, pulse, pulse);  // Mutate existing, no allocation
            }
        }
    }

    /**
     * Remove a tree
     */
    public removeTree(treeId: string): void {
        const treeVisual = this.treeVisuals.get(treeId);
        if (!treeVisual) return;

        // Dispose all meshes
        treeVisual.trunk.dispose();
        treeVisual.cap.dispose();
        for (const spot of treeVisual.glowSpots) {
            spot.dispose();
        }
        treeVisual.rootNode.dispose();

        this.treeVisuals.delete(treeId);
    }

    /**
     * Get count of trees
     */
    public getTreeCount(): number {
        return this.treeVisuals.size;
    }

    /**
     * Dispose all trees and materials
     */
    public dispose(): void {
        // Remove all trees
        for (const treeId of this.treeVisuals.keys()) {
            this.removeTree(treeId);
        }

        // Dispose materials
        this.trunkMaterial?.dispose();
        this.capMaterial?.dispose();
        this.glowSpotMaterial?.dispose();
        this.rootMaterial?.dispose();
    }
}
