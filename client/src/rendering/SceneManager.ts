/**
 * SceneManager - Scene creation and lifecycle management
 * 
 * Manages the Babylon.js scene creation, configuration, and cleanup.
 * Handles scene-level settings and optimization for low poly rendering.
 */

import { Scene, Engine, Vector3, Color3, Color4, MeshBuilder, StandardMaterial } from '@babylonjs/core';

export class SceneManager {
    private engine: Engine;
    private scene: Scene | null = null;

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

            // Add test objects to verify scene is working
            this.addTestObjects();

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
     * Add test objects to verify the scene is working
     */
    private addTestObjects(): void {
        if (!this.scene) return;

        console.log('🧪 Adding test objects...');

        // Create a test sphere (representing a unit)
        const testSphere = MeshBuilder.CreateSphere('testSphere', { diameter: 2 }, this.scene);
        testSphere.position = new Vector3(0, 1, 0);

        // Create material for the test sphere
        const testMaterial = new StandardMaterial('testMaterial', this.scene);
        testMaterial.diffuseColor = new Color3(0.2, 0.8, 0.2); // Green like worker unit
        testMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        testSphere.material = testMaterial;

        // Create a test ground plane
        const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, this.scene);
        ground.position = new Vector3(0, 0, 0);

        // Create material for the ground
        const groundMaterial = new StandardMaterial('groundMaterial', this.scene);
        groundMaterial.diffuseColor = new Color3(0.3, 0.6, 0.2); // Green terrain
        groundMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        ground.material = groundMaterial;

        // Create a test pyramid (representing a base)
        const testPyramid = MeshBuilder.CreateBox('testPyramid', { size: 2 }, this.scene);
        testPyramid.position = new Vector3(5, 1, 0);
        testPyramid.scaling = new Vector3(1, 1.5, 1); // Make it more pyramid-like

        // Create material for the pyramid
        const pyramidMaterial = new StandardMaterial('pyramidMaterial', this.scene);
        pyramidMaterial.diffuseColor = new Color3(1.0, 0.9, 0.2); // Yellow like base
        pyramidMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        testPyramid.material = pyramidMaterial;

        console.log('✅ Test objects added - sphere, ground, and pyramid');
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
     * Dispose of the scene and cleanup resources
     */
    public dispose(): void {
        if (this.scene) {
            console.log('🗑️ Disposing scene...');
            
            // Dispose all scene resources
            this.scene.dispose();
            this.scene = null;
            
            console.log('✅ Scene disposed');
        }
    }
}