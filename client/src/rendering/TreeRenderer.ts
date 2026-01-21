/**
 * TreeRenderer - Alien Mushroom Tree vegetation for sci-fi atmosphere
 *
 * Creates low-poly bioluminescent mushroom trees with glowing spots
 * that fit the game's sci-fi aesthetic.
 *
 * Fix 23: GPU-optimized glow animation using ShaderMaterial + thin instances
 * - Glow spots use thin instances for single draw call
 * - Pulsing animation runs entirely on GPU via shader
 * - updateAnimations() is O(1) instead of O(n*m)
 */

import {
    Scene,
    Mesh,
    MeshBuilder,
    StandardMaterial,
    ShaderMaterial,
    Color3,
    Vector3,
    TransformNode,
    Effect
} from '@babylonjs/core';

export interface TreeVisual {
    rootNode: TransformNode;
    trunk: Mesh;
    cap: Mesh;
    glowSpotIndices: number[];  // Indices into the instance buffer for this tree's spots
}

export interface TreeConfig {
    position: Vector3;
    scale?: number;
    rotation?: number;
    capColor?: Color3;
    glowColor?: Color3;
}

// Instance data for a single glow spot: x, y, z, phase, size, colorR, colorG, colorB
const FLOATS_PER_INSTANCE = 8;

export class TreeRenderer {
    private scene: Scene;

    // Tree visuals management
    private treeVisuals: Map<string, TreeVisual> = new Map();
    private treeIdCounter: number = 0;

    // Materials for tree structure
    private trunkMaterial: StandardMaterial | null = null;
    private capMaterial: StandardMaterial | null = null;
    private rootMaterial: StandardMaterial | null = null;

    // Fix 23: GPU-based glow animation
    private glowShaderMaterial: ShaderMaterial | null = null;
    private glowBaseMesh: Mesh | null = null;
    private glowInstanceData: number[] = [];  // Dynamic array for instance data
    private glowInstanceBuffer: Float32Array | null = null;
    private instancesDirty: boolean = false;  // Flag to rebuild instances

    // Default colors
    private readonly defaultCapColor = new Color3(0.4, 0.2, 0.5); // Purple
    private readonly defaultGlowColor = new Color3(0.2, 0.9, 0.8); // Cyan-teal

    constructor(scene: Scene) {
        this.scene = scene;
        this.initializeMaterials();
        this.initializeGlowShader();
        this.initializeGlowBaseMesh();
    }

    /**
     * Initialize materials for tree structure (trunk, cap, etc.)
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

        // Root/base material
        this.rootMaterial = new StandardMaterial('treeRootMaterial', this.scene);
        this.rootMaterial.diffuseColor = new Color3(0.15, 0.12, 0.14);
        this.rootMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    }

    /**
     * Fix 23: Initialize custom shader for GPU-animated glow spots
     */
    private initializeGlowShader(): void {
        // Register custom shader code with Babylon.js
        // Note: No conditionals - this shader is only used for thin instances
        Effect.ShadersStore['glowSpotVertexShader'] = `
            precision highp float;

            // Babylon.js standard attributes
            attribute vec3 position;
            attribute vec3 normal;

            // Thin instance attributes - automatically provided by Babylon.js
            attribute vec4 world0;
            attribute vec4 world1;
            attribute vec4 world2;
            attribute vec4 world3;

            // Custom instance attribute for color and phase
            attribute vec4 instanceColor;

            // Babylon.js standard uniforms
            uniform mat4 viewProjection;

            // Custom uniforms
            uniform float time;

            // Output to fragment shader
            varying vec3 vColor;

            void main() {
                // Get instance data
                float phase = instanceColor.a;
                vec3 glowColor = instanceColor.rgb;

                // Calculate pulse based on time and per-instance phase
                float pulse = sin(time * 1.5 + phase) * 0.15 + 0.85;
                vColor = glowColor * (0.8 + pulse * 0.4);

                // Build world matrix from thin instance data
                mat4 instanceWorld = mat4(world0, world1, world2, world3);

                // Apply pulse scaling to local position
                vec3 scaledPos = position * pulse;

                // Transform to world space then to clip space
                vec4 worldPos = instanceWorld * vec4(scaledPos, 1.0);
                gl_Position = viewProjection * worldPos;
            }
        `;

        Effect.ShadersStore['glowSpotFragmentShader'] = `
            precision highp float;

            varying vec3 vColor;

            void main() {
                gl_FragColor = vec4(vColor, 1.0);
            }
        `;

        // Create the shader material
        this.glowShaderMaterial = new ShaderMaterial(
            'glowSpotShader',
            this.scene,
            {
                vertex: 'glowSpot',
                fragment: 'glowSpot'
            },
            {
                attributes: ['position', 'normal', 'world0', 'world1', 'world2', 'world3', 'instanceColor'],
                uniforms: ['viewProjection', 'time'],
                needAlphaBlending: false
            }
        );

        // Initialize time uniform
        this.glowShaderMaterial.setFloat('time', 0);

        // Disable backface culling for small spheres
        this.glowShaderMaterial.backFaceCulling = false;
    }

    /**
     * Fix 23: Initialize base mesh for thin instances
     */
    private initializeGlowBaseMesh(): void {
        // Create a single low-poly sphere as the base for all glow spots
        this.glowBaseMesh = MeshBuilder.CreateSphere('glowSpotBase', {
            diameter: 1.0,  // Unit size, will be scaled per instance
            segments: 4     // Low poly for performance
        }, this.scene);

        this.glowBaseMesh.material = this.glowShaderMaterial;

        // The base mesh itself is invisible; only instances render
        this.glowBaseMesh.isVisible = true;  // Must be true for thin instances to render
        this.glowBaseMesh.alwaysSelectAsActiveMesh = true;  // Ensure it's always processed
    }

    /**
     * Add a glow spot instance to the buffer
     * Returns the index of this instance
     */
    private addGlowSpotInstance(
        worldX: number,
        worldY: number,
        worldZ: number,
        size: number,
        phase: number,
        color: Color3
    ): number {
        const index = this.glowInstanceData.length / FLOATS_PER_INSTANCE;

        // Store: x, y, z, phase, size, colorR, colorG, colorB
        this.glowInstanceData.push(
            worldX, worldY, worldZ,
            phase,
            size,
            color.r, color.g, color.b
        );

        this.instancesDirty = true;
        return index;
    }

    /**
     * Rebuild thin instance buffer from instance data
     */
    private rebuildInstanceBuffer(): void {
        if (!this.glowBaseMesh || this.glowInstanceData.length === 0) {
            // No instances - hide base mesh
            if (this.glowBaseMesh) {
                this.glowBaseMesh.thinInstanceCount = 0;
            }
            return;
        }

        const instanceCount = this.glowInstanceData.length / FLOATS_PER_INSTANCE;

        // Create matrices buffer (16 floats per instance for 4x4 matrix)
        const matricesData = new Float32Array(instanceCount * 16);

        // Create custom attribute buffer for color + phase (4 floats: r, g, b, phase)
        const colorData = new Float32Array(instanceCount * 4);

        for (let i = 0; i < instanceCount; i++) {
            const dataOffset = i * FLOATS_PER_INSTANCE;
            const matrixOffset = i * 16;
            const colorOffset = i * 4;

            const x = this.glowInstanceData[dataOffset];
            const y = this.glowInstanceData[dataOffset + 1];
            const z = this.glowInstanceData[dataOffset + 2];
            const phase = this.glowInstanceData[dataOffset + 3];
            const size = this.glowInstanceData[dataOffset + 4];
            const r = this.glowInstanceData[dataOffset + 5];
            const g = this.glowInstanceData[dataOffset + 6];
            const b = this.glowInstanceData[dataOffset + 7];

            // Build a translation + scale matrix (column-major order for WebGL)
            // Matrix format:
            // [sx,  0,  0, 0]   column 0: matrix0
            // [ 0, sy,  0, 0]   column 1: matrix1
            // [ 0,  0, sz, 0]   column 2: matrix2
            // [tx, ty, tz, 1]   column 3: matrix3

            matricesData[matrixOffset + 0] = size;  // scale X
            matricesData[matrixOffset + 1] = 0;
            matricesData[matrixOffset + 2] = 0;
            matricesData[matrixOffset + 3] = 0;

            matricesData[matrixOffset + 4] = 0;
            matricesData[matrixOffset + 5] = size;  // scale Y
            matricesData[matrixOffset + 6] = 0;
            matricesData[matrixOffset + 7] = 0;

            matricesData[matrixOffset + 8] = 0;
            matricesData[matrixOffset + 9] = 0;
            matricesData[matrixOffset + 10] = size;  // scale Z
            matricesData[matrixOffset + 11] = 0;

            matricesData[matrixOffset + 12] = x;   // translate X
            matricesData[matrixOffset + 13] = y;   // translate Y
            matricesData[matrixOffset + 14] = z;   // translate Z
            matricesData[matrixOffset + 15] = 1;

            // Store color and phase
            colorData[colorOffset + 0] = r;
            colorData[colorOffset + 1] = g;
            colorData[colorOffset + 2] = b;
            colorData[colorOffset + 3] = phase;
        }

        // Set thin instance buffers
        // 'matrix' is the special name that Babylon.js uses for world matrices
        // It automatically maps to world0, world1, world2, world3 attributes
        this.glowBaseMesh.thinInstanceSetBuffer('matrix', matricesData, 16, false);

        // Register and set custom attribute for color + phase
        this.glowBaseMesh.thinInstanceRegisterAttribute('instanceColor', 4);
        this.glowBaseMesh.thinInstanceSetBuffer('instanceColor', colorData, 4, false);

        this.instancesDirty = false;
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

        // ===== 6. BIOLUMINESCENT GLOW SPOTS (via thin instances) =====
        const glowSpotIndices: number[] = [];
        const spotCount = 8 + Math.floor(Math.random() * 5); // 8-12 spots

        // Determine glow color
        const glowColor = config.glowColor || this.defaultGlowColor;
        const emissiveColor = new Color3(
            glowColor.r * 1.5,
            glowColor.g * 1.5,
            glowColor.b * 1.5
        );

        // Tree world position for calculating glow spot world positions
        const treeWorldPos = config.position;

        for (let i = 0; i < spotCount; i++) {
            // Distribute spots on the dome surface
            const theta = (i / spotCount) * Math.PI * 2; // Around the cap
            const phi = 0.2 + Math.random() * 0.5; // Height on dome (0.2-0.7)

            const spotRadius = 0.9; // Radius of cap
            const localX = Math.cos(theta) * Math.sin(phi * Math.PI) * spotRadius;
            const localZ = Math.sin(theta) * Math.sin(phi * Math.PI) * spotRadius;
            const localY = 1.65 + Math.cos(phi * Math.PI) * spotRadius * 0.5;

            // Calculate world position (accounting for tree scale)
            const worldX = treeWorldPos.x + localX * scale;
            const worldY = treeWorldPos.y + localY * scale;
            const worldZ = treeWorldPos.z + localZ * scale;

            const spotSize = (0.08 + Math.random() * 0.08) * scale;
            const phase = i * 0.3; // Phase offset for staggered pulsing

            const instanceIndex = this.addGlowSpotInstance(
                worldX, worldY, worldZ,
                spotSize,
                phase,
                emissiveColor
            );
            glowSpotIndices.push(instanceIndex);
        }

        // ===== 7. TOP SPOT (larger, at apex) =====
        const topSpotWorldY = treeWorldPos.y + 2.15 * scale;
        const topSpotSize = 0.15 * scale;
        const topSpotPhase = spotCount * 0.3;

        const topSpotIndex = this.addGlowSpotInstance(
            treeWorldPos.x, topSpotWorldY, treeWorldPos.z,
            topSpotSize,
            topSpotPhase,
            emissiveColor
        );
        glowSpotIndices.push(topSpotIndex);

        // Store tree visual (no longer stores individual glow meshes)
        const treeVisual: TreeVisual = {
            rootNode,
            trunk,
            cap,
            glowSpotIndices
        };
        this.treeVisuals.set(treeId, treeVisual);

        return treeId;
    }

    /**
     * Create a cluster of trees at a location
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
     * Fix 23: Update tree animations - O(1) cost!
     * Only updates the time uniform; GPU shader handles all animation
     */
    public updateAnimations(): void {
        // Rebuild instance buffer if dirty (trees added/removed)
        if (this.instancesDirty) {
            this.rebuildInstanceBuffer();
        }

        // Single uniform update - GPU does all the animation work
        if (this.glowShaderMaterial) {
            this.glowShaderMaterial.setFloat('time', performance.now() / 1000);
        }
    }

    /**
     * Remove a tree
     */
    public removeTree(treeId: string): void {
        const treeVisual = this.treeVisuals.get(treeId);
        if (!treeVisual) return;

        // Dispose tree structure meshes
        treeVisual.trunk.dispose();
        treeVisual.cap.dispose();
        treeVisual.rootNode.dispose();

        // Mark instances as needing removal
        // For simplicity, we'll mark the instance data for rebuild
        // In a production system, you'd want a more efficient removal strategy
        for (const index of treeVisual.glowSpotIndices) {
            // Mark this instance as removed by setting size to 0
            // The instance will be invisible but still in buffer
            const dataOffset = index * FLOATS_PER_INSTANCE;
            if (dataOffset < this.glowInstanceData.length) {
                this.glowInstanceData[dataOffset + 4] = 0; // Set size to 0
            }
        }
        this.instancesDirty = true;

        this.treeVisuals.delete(treeId);
    }

    /**
     * Get count of trees
     */
    public getTreeCount(): number {
        return this.treeVisuals.size;
    }

    /**
     * Get count of glow spot instances
     */
    public getGlowSpotCount(): number {
        return this.glowInstanceData.length / FLOATS_PER_INSTANCE;
    }

    /**
     * Dispose all trees and materials
     */
    public dispose(): void {
        // Remove all trees
        for (const treeId of this.treeVisuals.keys()) {
            this.removeTree(treeId);
        }

        // Clear instance data
        this.glowInstanceData = [];
        this.glowInstanceBuffer = null;

        // Dispose glow system
        this.glowBaseMesh?.dispose();
        this.glowShaderMaterial?.dispose();

        // Dispose materials
        this.trunkMaterial?.dispose();
        this.capMaterial?.dispose();
        this.rootMaterial?.dispose();
    }
}
