/**
 * SceneManager - Scene creation and lifecycle management
 * 
 * Manages the Babylon.js scene creation, configuration, and cleanup.
 * Handles scene-level settings and optimization for low poly rendering.
 */

import { Scene, Engine, Vector3, Color3, Color4, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import { TerrainGenerator } from './TerrainGenerator';
import { MaterialManager } from './MaterialManager';
import { CameraController } from './CameraController';

export class SceneManager {
    private engine: Engine;
    private scene: Scene | null = null;
    private terrainGenerator: TerrainGenerator | null = null;

    constructor(engine: Engine) {
        this.engine = engine;
        console.log('🎬 SceneManager created');
    }

    /**
     * Create and configure the main scene
     */
    public async createScene(): Promise<Scene> {
        if (this.scene) {
            console.warn('Scene already exists');
            return this.scene;
        }

        try {
            console.log('🎬 Creating Babylon.js scene...');

            // Create scene
            this.scene = new Scene(this.engine);

            // Configure scene for low poly aesthetic
            this.configureScene();

            // Setup scene optimization
            this.optimizeScene();

            console.log('✅ Scene created successfully');
            return this.scene;

        } catch (error) {
            console.error('❌ Failed to create scene:', error);
            throw error;
        }
    }

    /**
     * Initialize procedural terrain system
     */
    public initializeTerrain(materialManager: MaterialManager, cameraController: CameraController): void {
        if (!this.scene) {
            console.error('❌ Cannot initialize terrain: Scene not created');
            return;
        }

        try {
            console.log('🌍 Initializing procedural terrain...');

            // Create terrain generator
            this.terrainGenerator = new TerrainGenerator(
                this.scene,
                materialManager,
                cameraController,
                {
                    chunkSize: 64,
                    chunkResolution: 64,
                    loadRadius: 3,
                    unloadRadius: 5,
                    seed: 12345
                }
            );

            // Initialize terrain system
            this.terrainGenerator.initialize();

            console.log('✅ Procedural terrain initialized');

        } catch (error) {
            console.error('❌ Failed to initialize terrain:', error);
            throw error;
        }
    }

    /**
     * Configure scene settings for low poly SciFi aesthetic
     */
    private configureScene(): void {
        if (!this.scene) return;

        // Set background color - dark space-like background
        this.scene.clearColor = new Color4(0.05, 0.05, 0.15, 1.0); // Dark blue-black

        // Configure fog for depth and atmosphere
        this.scene.fogMode = Scene.FOGMODE_EXP2;
        this.scene.fogColor = new Color3(0.1, 0.1, 0.2);
        this.scene.fogDensity = 0.01;

        // Disable automatic camera/light creation
        // Note: createDefaultCameraOrLight is a method, not a property
        // We'll handle camera and lighting setup manually

        // Configure physics (disabled for now, can be enabled later)
        // this.scene.enablePhysics(new Vector3(0, -9.81, 0), new CannonJSPlugin());

        console.log('⚙️ Scene configured for low poly SciFi aesthetic');
    }

    /**
     * Optimize scene for performance
     */
    private optimizeScene(): void {
        if (!this.scene) return;

        // Enable culling optimizations
        // Note: frustumCullingEnabled may not exist in current API
        // Scene culling is typically enabled by default

        // Optimize for low poly rendering
        this.scene.skipPointerMovePicking = true;
        this.scene.skipPointerDownPicking = false;
        this.scene.skipPointerUpPicking = true;

        // Configure render optimization
        this.scene.autoClear = true;
        this.scene.autoClearDepthAndStencil = true;

        // Set target FPS
        this.scene.getEngine().setHardwareScalingLevel(1.0);

        // Register performance monitoring
        this.scene.registerBeforeRender(() => {
            // Performance monitoring will be handled by PerformanceMonitor
        });

        console.log('⚡ Scene optimized for performance');
    }

    /**
     * Get the current scene
     */
    public getScene(): Scene | null {
        return this.scene;
    }

    /**
     * Get the terrain generator
     */
    public getTerrainGenerator(): TerrainGenerator | null {
        return this.terrainGenerator;
    }

    /**
     * Dispose of the scene and cleanup resources
     */
    public dispose(): void {
        if (this.scene) {
            console.log('🗑️ Disposing scene...');
            
            // Dispose terrain system first
            if (this.terrainGenerator) {
                this.terrainGenerator.dispose();
                this.terrainGenerator = null;
            }
            
            // Dispose all scene resources
            this.scene.dispose();
            this.scene = null;
            
            console.log('✅ Scene disposed');
        }
    }
}