/**
 * LightingSetup - SciFi atmosphere lighting configuration
 * 
 * Configures directional and ambient lighting to create an appropriate
 * SciFi atmosphere while maintaining optimal visibility for low poly
 * flat shaded materials.
 */

import { Scene, DirectionalLight, HemisphericLight, Vector3, Color3 } from '@babylonjs/core';

export class LightingSetup {
    private scene: Scene;
    private directionalLight: DirectionalLight | null = null;
    private ambientLight: HemisphericLight | null = null;

    // Lighting configuration
    private readonly DIRECTIONAL_INTENSITY = 1.2;
    private readonly AMBIENT_INTENSITY = 0.8;
    private readonly DIRECTIONAL_COLOR = new Color3(1.0, 1.0, 1.0); // Bright white
    private readonly AMBIENT_COLOR = new Color3(0.4, 0.5, 0.7); // Brighter blue ambient
    private readonly GROUND_COLOR = new Color3(0.2, 0.2, 0.3); // Lighter ground reflection

    constructor(scene: Scene) {
        this.scene = scene;
        console.log('💡 LightingSetup created');
    }

    /**
     * Setup SciFi atmosphere lighting
     */
    public setupLighting(): void {
        try {
            console.log('💡 Setting up SciFi lighting...');

            // Create directional light (main light source)
            this.createDirectionalLight();

            // Create ambient light (fill lighting)
            this.createAmbientLight();

            // Configure lighting for low poly materials
            this.configureLowPolyLighting();

            console.log('✅ SciFi lighting setup complete');

        } catch (error) {
            console.error('❌ Failed to setup lighting:', error);
            throw error;
        }
    }

    /**
     * Create main directional light
     */
    private createDirectionalLight(): void {
        // Create directional light from top-front-right
        this.directionalLight = new DirectionalLight(
            'mainLight',
            new Vector3(-0.5, -1, -0.5),
            this.scene
        );

        // Configure directional light properties
        this.directionalLight.intensity = this.DIRECTIONAL_INTENSITY;
        this.directionalLight.diffuse = this.DIRECTIONAL_COLOR;
        this.directionalLight.specular = new Color3(0.2, 0.2, 0.3); // Subtle specular

        // Position the light for optimal low poly shading
        this.directionalLight.position = new Vector3(10, 20, 10);

        console.log('☀️ Directional light created');
    }

    /**
     * Create ambient hemispheric light
     */
    private createAmbientLight(): void {
        // Create hemispheric light for ambient illumination
        this.ambientLight = new HemisphericLight(
            'ambientLight',
            new Vector3(0, 1, 0),
            this.scene
        );

        // Configure ambient light properties
        this.ambientLight.intensity = this.AMBIENT_INTENSITY;
        this.ambientLight.diffuse = this.AMBIENT_COLOR;
        this.ambientLight.specular = new Color3(0, 0, 0); // No specular from ambient
        this.ambientLight.groundColor = this.GROUND_COLOR;

        console.log('🌙 Ambient light created');
    }

    /**
     * Configure lighting specifically for low poly flat shading
     */
    private configureLowPolyLighting(): void {
        // Ensure lighting works well with flat shading
        // Flat shading uses face normals instead of vertex normals
        // This creates the distinctive low poly look

        // Adjust light directions for optimal flat shading visibility
        if (this.directionalLight) {
            // Ensure light direction creates good contrast on flat surfaces
            this.directionalLight.direction = new Vector3(-0.3, -0.8, -0.5).normalize();
        }

        // Configure scene lighting mode for performance
        this.scene.lightsEnabled = true;
        this.scene.shadowsEnabled = false; // Disable shadows for performance

        console.log('🎨 Lighting configured for low poly flat shading');
    }

    /**
     * Update lighting for different times of day (future enhancement)
     */
    public setTimeOfDay(timeOfDay: 'dawn' | 'day' | 'dusk' | 'night'): void {
        if (!this.directionalLight || !this.ambientLight) return;

        switch (timeOfDay) {
            case 'dawn':
                this.directionalLight.diffuse = new Color3(1.0, 0.8, 0.6);
                this.ambientLight.diffuse = new Color3(0.4, 0.3, 0.5);
                break;
            case 'day':
                this.directionalLight.diffuse = this.DIRECTIONAL_COLOR;
                this.ambientLight.diffuse = this.AMBIENT_COLOR;
                break;
            case 'dusk':
                this.directionalLight.diffuse = new Color3(1.0, 0.6, 0.4);
                this.ambientLight.diffuse = new Color3(0.3, 0.2, 0.4);
                break;
            case 'night':
                this.directionalLight.intensity = 0.2;
                this.ambientLight.diffuse = new Color3(0.1, 0.1, 0.3);
                break;
        }

        console.log(`🌅 Lighting updated for ${timeOfDay}`);
    }

    /**
     * Get directional light
     */
    public getDirectionalLight(): DirectionalLight | null {
        return this.directionalLight;
    }

    /**
     * Get ambient light
     */
    public getAmbientLight(): HemisphericLight | null {
        return this.ambientLight;
    }

    /**
     * Enable/disable shadows (future enhancement)
     */
    public setShadowsEnabled(enabled: boolean): void {
        this.scene.shadowsEnabled = enabled;
        
        if (enabled && this.directionalLight) {
            // Future: Setup shadow generator
            console.log('🌑 Shadows enabled (placeholder)');
        } else {
            console.log('☀️ Shadows disabled');
        }
    }

    /**
     * Dispose lighting resources
     */
    public dispose(): void {
        console.log('🗑️ Disposing lighting...');

        if (this.directionalLight) {
            this.directionalLight.dispose();
            this.directionalLight = null;
        }

        if (this.ambientLight) {
            this.ambientLight.dispose();
            this.ambientLight = null;
        }

        console.log('✅ Lighting disposed');
    }
}