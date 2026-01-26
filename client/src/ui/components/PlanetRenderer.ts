/**
 * PlanetRenderer - Planet Creation for Introduction Screen
 * 
 * Creates spherical planets with UV texture mapping, atmosphere glow effects,
 * and cloud layers for the desert planet and orbital system story pages.
 * Uses existing game assets and materials for visual consistency.
 * 
 * Requirements: 9.2, 9.5, 9.10
 */

import {
    Scene,
    AbstractMesh,
    Mesh,
    Vector3,
    Color3,
    Color4,
    Animation,
    StandardMaterial,
    Material,
    MeshBuilder,
    Texture,
    DynamicTexture,
    SineEase,
    EasingFunction,
    ParticleSystem,
    Vector4,
    Tools
} from '@babylonjs/core';
import { MaterialManager } from '../../rendering/MaterialManager';

export interface PlanetConfig {
    radius: number;
    textureType: 'desert' | 'toxic';
    atmosphereGlow: boolean;
    cloudLayer: boolean;
    rotationSpeed: number; // RPM
}

export interface OrbitingShip {
    shipModel: AbstractMesh;
    orbitRadius: number;
    orbitSpeed: number; // RPM
    miningBeam: boolean;
}

export interface AtmosphereConfig {
    glowColor: Color3;
    glowIntensity: number;
    glowSize: number; // Multiplier for atmosphere size
}

export interface CloudConfig {
    opacity: number;
    speed: number; // Rotation speed multiplier
    density: number; // Cloud coverage (0-1)
}

export class PlanetRenderer {
    private scene: Scene;
    private materialManager: MaterialManager;

    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;
    }

    /**
     * Create desert planet with UV texture mapping and optional atmosphere/clouds
     * Requirements: 9.2, 9.5 - Desert planet using existing terrain textures
     */
    public createDesertPlanet(config: PlanetConfig): AbstractMesh {
        // Create planet group to hold all components
        const planetGroup = new Mesh('desertPlanetGroup', this.scene);

        // Create base planet sphere with high segments for smooth appearance
        const planet = MeshBuilder.CreateSphere('desertPlanet', {
            diameter: config.radius * 2,
            segments: 64
        }, this.scene);
        planet.parent = planetGroup;

        // Apply desert material with procedural texture
        const desertMaterial = new StandardMaterial('desertPlanetMat', this.scene);

        // Create rich desert texture
        const desertTexture = this.createRichDesertTexture();
        desertMaterial.diffuseTexture = desertTexture;

        // Fully emissive - self-lit planet, no lighting dependency
        desertMaterial.diffuseColor = new Color3(0, 0, 0);
        desertMaterial.specularColor = new Color3(0, 0, 0);
        desertMaterial.specularPower = 0;
        desertMaterial.emissiveColor = new Color3(0.85, 0.7, 0.45);
        desertMaterial.ambientColor = new Color3(0, 0, 0);
        desertMaterial.disableLighting = true;

        planet.material = desertMaterial;

        // Add warm atmospheric glow
        if (config.atmosphereGlow) {
            const atmosphere = this.createDesertAtmosphere(config.radius);
            atmosphere.parent = planetGroup;
        }

        // Add subtle dust cloud layer
        if (config.cloudLayer) {
            const dustClouds = this.createDustClouds(config.radius);
            dustClouds.parent = planetGroup;
        }

        // Add rotation animation
        this.addPlanetRotation(planetGroup, config.rotationSpeed);

        return planetGroup;
    }

    /**
     * Create rich desert texture with dunes, craters, and terrain features
     */
    private createRichDesertTexture(): DynamicTexture {
        const size = 1024;
        const texture = new DynamicTexture('richDesertTexture', size, this.scene, false);
        const context = texture.getContext();
        const imageData = new ImageData(size, size);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const index = (y * size + x) * 4;

                // Multiple noise layers for terrain variety
                const nx = x / size;
                const ny = y / size;

                // Large scale dune patterns
                const dunes = this.fbmNoise(nx * 4, ny * 4, 4) * 0.4;

                // Medium scale terrain variation
                const terrain = this.fbmNoise(nx * 8, ny * 8, 3) * 0.3;

                // Small scale surface detail
                const detail = this.fbmNoise(nx * 20, ny * 20, 2) * 0.15;

                // Rocky outcrops
                const rocks = this.fbmNoise(nx * 12, ny * 12, 2);
                const rockMask = rocks > 0.6 ? (rocks - 0.6) * 2.5 : 0;

                // Crater-like depressions
                const craterNoise = this.fbmNoise(nx * 6, ny * 6, 2);
                const craterMask = craterNoise < 0.25 ? (0.25 - craterNoise) * 2 : 0;

                // Combine all features
                const combined = 0.5 + dunes + terrain + detail - craterMask * 0.2;

                // Desert color palette - sandy oranges and browns
                let r, g, b;

                if (rockMask > 0.1) {
                    // Rocky areas - darker brown
                    r = Math.floor((0.45 + combined * 0.15 - rockMask * 0.1) * 255);
                    g = Math.floor((0.35 + combined * 0.12 - rockMask * 0.1) * 255);
                    b = Math.floor((0.25 + combined * 0.08 - rockMask * 0.05) * 255);
                } else if (craterMask > 0.1) {
                    // Crater shadows - darker
                    r = Math.floor((0.5 + combined * 0.1) * 255);
                    g = Math.floor((0.38 + combined * 0.08) * 255);
                    b = Math.floor((0.22 + combined * 0.05) * 255);
                } else {
                    // Regular desert sand - warm orange/tan
                    r = Math.floor((0.75 + combined * 0.2) * 255);
                    g = Math.floor((0.55 + combined * 0.18) * 255);
                    b = Math.floor((0.3 + combined * 0.12) * 255);
                }

                // Clamp values
                imageData.data[index] = Math.min(255, Math.max(0, r));
                imageData.data[index + 1] = Math.min(255, Math.max(0, g));
                imageData.data[index + 2] = Math.min(255, Math.max(0, b));
                imageData.data[index + 3] = 255;
            }
        }

        context.putImageData(imageData, 0, 0);
        texture.update();

        texture.wrapU = Texture.WRAP_ADDRESSMODE;
        texture.wrapV = Texture.WRAP_ADDRESSMODE;

        return texture;
    }

    /**
     * Fractional Brownian Motion noise for natural terrain
     */
    private fbmNoise(x: number, y: number, octaves: number): number {
        let value = 0;
        let amplitude = 0.5;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.smoothNoise(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }

        return value / maxValue;
    }

    /**
     * Smooth noise with interpolation
     */
    private smoothNoise(x: number, y: number): number {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const fx = x - x0;
        const fy = y - y0;

        // Smoothstep interpolation
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);

        const n00 = this.hashNoise(x0, y0);
        const n10 = this.hashNoise(x0 + 1, y0);
        const n01 = this.hashNoise(x0, y0 + 1);
        const n11 = this.hashNoise(x0 + 1, y0 + 1);

        const nx0 = n00 * (1 - sx) + n10 * sx;
        const nx1 = n01 * (1 - sx) + n11 * sx;

        return nx0 * (1 - sy) + nx1 * sy;
    }

    /**
     * Hash-based noise for reproducible randomness
     */
    private hashNoise(x: number, y: number): number {
        const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return n - Math.floor(n);
    }

    /**
     * Create warm desert atmosphere glow
     */
    private createDesertAtmosphere(planetRadius: number): AbstractMesh {
        const atmosphereRadius = planetRadius * 1.15;

        const atmosphere = MeshBuilder.CreateSphere('desertAtmosphere', {
            diameter: atmosphereRadius * 2,
            segments: 32
        }, this.scene);

        const atmosphereMat = new StandardMaterial('desertAtmoMat', this.scene);
        atmosphereMat.diffuseColor = new Color3(1.0, 0.6, 0.3);
        atmosphereMat.emissiveColor = new Color3(0.4, 0.2, 0.08);
        atmosphereMat.specularColor = new Color3(0, 0, 0);
        atmosphereMat.alpha = 0.15;
        atmosphereMat.backFaceCulling = false;

        atmosphere.material = atmosphereMat;

        return atmosphere;
    }

    /**
     * Create subtle dust cloud layer
     */
    private createDustClouds(planetRadius: number): AbstractMesh {
        const cloudRadius = planetRadius * 1.08;

        const clouds = MeshBuilder.CreateSphere('dustClouds', {
            diameter: cloudRadius * 2,
            segments: 24
        }, this.scene);

        const cloudMat = new StandardMaterial('dustCloudMat', this.scene);

        // Create dust texture
        const dustTexture = this.createDustTexture();
        cloudMat.diffuseTexture = dustTexture;
        cloudMat.opacityTexture = dustTexture;

        cloudMat.diffuseColor = new Color3(0.9, 0.7, 0.5);
        cloudMat.emissiveColor = new Color3(0.1, 0.06, 0.03);
        cloudMat.specularColor = new Color3(0, 0, 0);
        cloudMat.alpha = 0.25;
        cloudMat.backFaceCulling = false;

        clouds.material = cloudMat;

        // Rotate clouds slightly differently
        this.addCloudRotation(clouds, 0.7);

        return clouds;
    }

    /**
     * Create dust cloud texture
     */
    private createDustTexture(): DynamicTexture {
        const size = 512;
        const texture = new DynamicTexture('dustTexture', size, this.scene, false);
        const context = texture.getContext();
        const imageData = new ImageData(size, size);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const index = (y * size + x) * 4;

                const nx = x / size;
                const ny = y / size;

                // Wispy cloud patterns
                const cloud1 = this.fbmNoise(nx * 6, ny * 6, 4);
                const cloud2 = this.fbmNoise(nx * 10 + 5, ny * 10 + 5, 3);

                const cloudValue = (cloud1 * 0.6 + cloud2 * 0.4);
                const alpha = cloudValue > 0.45 ? (cloudValue - 0.45) * 180 : 0;

                imageData.data[index] = 230;
                imageData.data[index + 1] = 180;
                imageData.data[index + 2] = 140;
                imageData.data[index + 3] = Math.min(255, alpha);
            }
        }

        context.putImageData(imageData, 0, 0);
        texture.update();

        texture.wrapU = Texture.WRAP_ADDRESSMODE;
        texture.wrapV = Texture.WRAP_ADDRESSMODE;

        return texture;
    }

    /**
     * Create orbital system with planet and orbiting mining ship
     * Requirements: 9.2, 9.6 - Planet with orbiting mining ship and energy beam connections
     */
    public createOrbitalSystem(planet: AbstractMesh): OrbitingShip {
        // Create mining ship model
        const ship = this.createMiningShip();
        
        // Set up orbital configuration
        const orbitRadius = 6; // Distance from planet center
        const orbitSpeed = 0.3; // RPM for orbital motion
        
        // Position ship at initial orbital position
        ship.position = new Vector3(orbitRadius, 0, 0);
        
        // Create orbital system group
        const orbitalSystem = new Mesh('orbitalSystem', this.scene);
        ship.parent = orbitalSystem;
        
        // Position orbital system relative to planet
        orbitalSystem.parent = planet;
        
        // Add orbital animation
        const orbitalAnimation = this.setupOrbitalAnimation(orbitalSystem, orbitRadius, orbitSpeed);
        
        // Start orbital animation immediately
        this.scene.beginAnimation(orbitalSystem, 0, 30, true);
        
        // Create mining beam effect
        const miningBeam = this.createMiningBeam(ship, planet);
        miningBeam.parent = orbitalSystem;

        return {
            shipModel: ship,
            orbitRadius: orbitRadius,
            orbitSpeed: orbitSpeed,
            miningBeam: true
        };
    }

    /**
     * Create angular mining ship model
     * Requirements: 9.6 - Angular mining ship model with energy cores
     */
    private createMiningShip(): AbstractMesh {
        const shipGroup = new Mesh('miningShip', this.scene);
        
        // Main hull (elongated box)
        const hull = MeshBuilder.CreateBox('shipHull', {
            width: 1.5,
            height: 0.4,
            depth: 0.6
        }, this.scene);
        
        // Ship material - metallic gray
        const shipMaterial = this.materialManager.createCustomMaterial(
            'miningShipMaterial',
            new Color3(0.6, 0.6, 0.7), // Metallic gray
            {
                emissive: new Color3(0.05, 0.05, 0.1), // Subtle blue glow
                specular: new Color3(0.8, 0.8, 0.9),   // Metallic reflections
                roughness: 0.3
            }
        );
        hull.material = shipMaterial;
        hull.parent = shipGroup;
        
        // Energy cores (glowing spheres)
        const coreCount = 3;
        for (let i = 0; i < coreCount; i++) {
            const core = MeshBuilder.CreateSphere(`energyCore_${i}`, {
                diameter: 0.2,
                segments: 8
            }, this.scene);
            
            // Energy core material - bright cyan glow
            const coreMaterial = this.materialManager.createCustomMaterial(
                `energyCoreMaterial_${i}`,
                new Color3(0.2, 1.0, 0.9), // Bright cyan
                {
                    emissive: new Color3(0.1, 0.6, 0.5), // Strong glow
                    specular: new Color3(0.2, 1.0, 0.9)
                }
            );
            core.material = coreMaterial;
            
            // Position cores along the hull
            core.position = new Vector3((i - 1) * 0.4, 0.1, 0);
            core.parent = shipGroup;
        }
        
        // Mining equipment (small boxes)
        const equipment = MeshBuilder.CreateBox('miningEquipment', {
            width: 0.3,
            height: 0.2,
            depth: 0.8
        }, this.scene);
        equipment.material = shipMaterial;
        equipment.position = new Vector3(0, -0.2, 0);
        equipment.parent = shipGroup;
        
        return shipGroup;
    }

    /**
     * Create mining beam effect connecting ship to planet surface
     * Requirements: 9.6 - Mining beam effects connecting ship to planet surface
     */
    private createMiningBeam(ship: AbstractMesh, planet: AbstractMesh): AbstractMesh {
        // Create beam as a cylinder connecting ship to planet
        const beamHeight = 4; // Approximate distance from ship to planet surface
        
        const beam = MeshBuilder.CreateCylinder('miningBeam', {
            height: beamHeight,
            diameterTop: 0.05,
            diameterBottom: 0.2,
            tessellation: 8
        }, this.scene);
        
        // Beam material - energy beam effect
        const beamMaterial = this.materialManager.createCustomMaterial(
            'miningBeamMaterial',
            new Color3(0.2, 0.8, 1.0), // Bright blue energy
            {
                emissive: new Color3(0.1, 0.4, 0.6), // Strong glow
                transparent: true,
                alpha: 0.7
            }
        );
        beamMaterial.transparencyMode = Material.MATERIAL_ALPHABLEND;
        beam.material = beamMaterial;
        
        // Position beam from ship toward planet center
        beam.position = new Vector3(0, -beamHeight / 2, 0);
        beam.parent = ship;
        
        // Add beam pulsing animation
        this.addBeamPulsingAnimation(beam);
        
        return beam;
    }

    /**
     * Setup orbital path animation with realistic physics
     * Requirements: 9.6 - Orbital path animation with realistic physics
     */
    private setupOrbitalAnimation(orbitalSystem: AbstractMesh, radius: number, speed: number): Animation {
        const orbitAnimation = new Animation(
            'orbitalMotion',
            'rotation.y',
            30, // 30 FPS
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_RELATIVE
        );

        // Calculate orbital speed: RPM to radians per frame
        const radiansPerFrame = (speed * 2 * Math.PI) / (60 * 30);
        
        const keys = [
            { frame: 0, value: 0 },
            { frame: 30, value: radiansPerFrame * 30 } // One second of orbital motion
        ];

        orbitAnimation.setKeys(keys);
        
        // Add animation to orbital system
        orbitalSystem.animations.push(orbitAnimation);
        
        return orbitAnimation;
    }

    /**
     * Add planet rotation animation
     * Requirements: 9.3 - Planet rotation animation
     */
    private addPlanetRotation(planet: AbstractMesh, rotationSpeedRPM: number): Animation {
        const rotationAnimation = new Animation(
            'planetRotation',
            'rotation.y',
            30, // 30 FPS
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_RELATIVE
        );

        // Calculate rotation speed: RPM to radians per frame
        const radiansPerFrame = (rotationSpeedRPM * 2 * Math.PI) / (60 * 30);
        
        const keys = [
            { frame: 0, value: 0 },
            { frame: 30, value: radiansPerFrame * 30 }
        ];

        rotationAnimation.setKeys(keys);
        
        // Add animation to planet
        planet.animations.push(rotationAnimation);
        
        // Start planet rotation animation immediately
        this.scene.beginAnimation(planet, 0, 30, true);
        
        return rotationAnimation;
    }

    /**
     * Add cloud rotation animation (different speed from planet)
     */
    private addCloudRotation(clouds: AbstractMesh, speedMultiplier: number): Animation {
        const cloudAnimation = new Animation(
            'cloudRotation',
            'rotation.y',
            30,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_RELATIVE
        );

        // Clouds rotate slower than planet for realistic effect
        const baseSpeed = 0.3; // Base RPM for clouds
        const radiansPerFrame = (baseSpeed * speedMultiplier * 2 * Math.PI) / (60 * 30);
        
        const keys = [
            { frame: 0, value: 0 },
            { frame: 30, value: radiansPerFrame * 30 }
        ];

        cloudAnimation.setKeys(keys);
        clouds.animations.push(cloudAnimation);
        
        // Start cloud rotation animation immediately
        this.scene.beginAnimation(clouds, 0, 30, true);
        
        return cloudAnimation;
    }

    /**
     * Add pulsing animation to mining beam
     */
    private addBeamPulsingAnimation(beam: AbstractMesh): Animation {
        const pulseAnimation = new Animation(
            'beamPulse',
            'material.alpha',
            30,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_RELATIVE
        );

        const keys = [
            { frame: 0, value: 0.4 },
            { frame: 15, value: 0.8 },
            { frame: 30, value: 0.4 }
        ];

        pulseAnimation.setKeys(keys);
        
        // Apply smooth easing
        const easingFunction = new SineEase();
        easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        pulseAnimation.setEasingFunction(easingFunction);
        
        beam.animations.push(pulseAnimation);
        
        // Start beam pulsing animation immediately
        this.scene.beginAnimation(beam, 0, 30, true);
        
        return pulseAnimation;
    }

    /**
     * Dispose of created resources
     */
    public dispose(): void {
        // Materials and textures are managed by MaterialManager and Babylon.js
        // No additional cleanup needed
        console.log('PlanetRenderer disposed');
    }
}