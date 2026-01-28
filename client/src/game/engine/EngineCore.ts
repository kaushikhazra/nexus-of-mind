/**
 * EngineCore - Babylon.js engine and scene management
 * 
 * Handles low-level Babylon.js engine initialization, scene creation,
 * lighting setup, and render loop management. This class is focused
 * solely on the Babylon.js engine concerns.
 */

import { Engine, Scene } from '@babylonjs/core';
import '@babylonjs/inspector';
import { SceneManager } from '../../rendering/SceneManager';
import { CameraController } from '../../rendering/CameraController';
import { LightingSetup } from '../../rendering/LightingSetup';
import { MaterialManager } from '../../rendering/MaterialManager';
import type { EngineConfig } from './types';

export class EngineCore {
    private engine: Engine | null = null;
    private scene: Scene | null = null;
    private canvas: HTMLCanvasElement;
    
    // Core rendering components
    private sceneManager: SceneManager | null = null;
    private cameraController: CameraController | null = null;
    private lightingSetup: LightingSetup | null = null;
    private materialManager: MaterialManager | null = null;
    
    private isInitialized: boolean = false;
    private isRenderLoopRunning: boolean = false;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    /**
     * Initialize the Babylon.js engine and scene
     */
    public async initialize(config?: EngineConfig): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Initialize WebGL engine with optimized settings
            const engineConfig = {
                preserveDrawingBuffer: true,
                stencil: true,
                antialias: true,
                alpha: false,
                premultipliedAlpha: false,
                powerPreference: 'high-performance' as const,
                ...config
            };

            this.engine = new Engine(this.canvas, true, engineConfig);

            if (!this.engine) {
                throw new Error('Failed to create Babylon.js engine');
            }

            // Initialize scene manager
            this.sceneManager = new SceneManager(this.engine);
            this.scene = await this.sceneManager.createScene();

            // Initialize core rendering components
            this.cameraController = new CameraController(this.scene, this.canvas);
            this.lightingSetup = new LightingSetup(this.scene);
            this.materialManager = new MaterialManager(this.scene);

            // Setup components
            this.cameraController.setupCamera();
            this.lightingSetup.setupLighting();

            // Initialize procedural terrain system
            this.sceneManager.initializeTerrain(this.materialManager, this.cameraController);

            // Handle window resize
            window.addEventListener('resize', () => {
                this.engine?.resize();
            });

            this.isInitialized = true;

        } catch (error) {
            throw new Error(`Failed to initialize EngineCore: ${error}`);
        }
    }

    /**
     * Start the render loop
     */
    public startRenderLoop(updateCallback?: (deltaTime: number) => void): void {
        if (!this.engine || !this.scene) {
            throw new Error('EngineCore must be initialized before starting render loop');
        }

        if (this.isRenderLoopRunning) {
            return;
        }

        this.engine.runRenderLoop(() => {
            if (this.scene && this.engine) {
                // Calculate delta time
                const deltaTime = this.engine.getDeltaTime() / 1000; // Convert to seconds

                // Call update callback if provided
                if (updateCallback) {
                    updateCallback(deltaTime);
                }

                // Render the scene
                this.scene.render();
            }
        });

        this.isRenderLoopRunning = true;
    }

    /**
     * Stop the render loop
     */
    public stopRenderLoop(): void {
        if (this.engine && this.isRenderLoopRunning) {
            this.engine.stopRenderLoop();
            this.isRenderLoopRunning = false;
        }
    }

    /**
     * Get the Babylon.js engine
     */
    public getEngine(): Engine | null {
        return this.engine;
    }

    /**
     * Get the Babylon.js scene
     */
    public getScene(): Scene | null {
        return this.scene;
    }

    /**
     * Get the camera controller
     */
    public getCameraController(): CameraController | null {
        return this.cameraController;
    }

    /**
     * Get the material manager
     */
    public getMaterialManager(): MaterialManager | null {
        return this.materialManager;
    }

    /**
     * Get the scene manager
     */
    public getSceneManager(): SceneManager | null {
        return this.sceneManager;
    }

    /**
     * Get terrain generator from scene manager
     */
    public getTerrainGenerator(): any {
        return this.sceneManager?.getTerrainGenerator();
    }

    /**
     * Check if engine is initialized
     */
    public isEngineInitialized(): boolean {
        return this.isInitialized;
    }

    /**
     * Check if render loop is running
     */
    public isRenderLoopActive(): boolean {
        return this.isRenderLoopRunning;
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.stopRenderLoop();

        // Dispose components in reverse order
        this.materialManager?.dispose();
        this.lightingSetup?.dispose();
        this.cameraController?.dispose();
        this.sceneManager?.dispose();

        // Dispose engine
        if (this.engine) {
            this.engine.dispose();
            this.engine = null;
        }

        this.scene = null;
        this.isInitialized = false;
        this.isRenderLoopRunning = false;
    }
}