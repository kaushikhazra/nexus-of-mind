/**
 * ParasiteRenderer - Organic Parasite Model Creation for Introduction Screen
 * 
 * Creates organic parasite shapes with dark materials and red pulsing vein effects
 * for the parasite threat story page. Uses Babylon.js CSG operations to create
 * complex organic forms with writhing animations.
 * 
 * Requirements: 9.2, 9.3, 9.10
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
    CSG,
    MeshBuilder,
    SineEase,
    EasingFunction,
    DynamicTexture,
    Texture,
    Tools,
    BezierCurveEase
} from '@babylonjs/core';
import { MaterialManager } from '../../rendering/MaterialManager';

export interface ParasiteConfig {
    count: number;
    organicShapes: ('blob' | 'tendril' | 'spore' | 'cluster')[];
    pulsing: boolean;
    writhing: boolean;
    redVeins: boolean;
}

export interface OrganicShapeConfig {
    size: number;
    deformation: number; // How much to deform from base shape (0-1)
    segments: number;
    pulseIntensity: number;
    writhingSpeed: number; // Animation speed multiplier
}

export interface VeinConfig {
    color: Color3;
    intensity: number;
    pulseSpeed: number;
    density: number; // Vein coverage (0-1)
}

export class ParasiteRenderer {
    private scene: Scene;
    private materialManager: MaterialManager;

    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;
    }

    /**
     * Create multi-ring worm parasite (copied from game's Parasite.ts)
     * This is the actual in-game parasite model with torus segments
     */
    public createRingWormParasite(name: string = 'ringWormParasite', segmentCount: number = 6): AbstractMesh {
        const parasiteGroup = new Mesh(name, this.scene);

        // Configuration (matching game's Parasite.ts)
        const baseScale = 1.5; // Slightly larger for intro screen visibility
        const baseSpacing = 0.3;

        // Bronze/brown parasite material (matching MaterialManager.getParasiteMaterial)
        const parasiteMaterial = new StandardMaterial(`${name}_material`, this.scene);
        parasiteMaterial.diffuseColor = new Color3(0.4, 0.25, 0.15); // Bronze/brown
        parasiteMaterial.emissiveColor = new Color3(0.08, 0.04, 0.02); // Subtle bronze glow
        parasiteMaterial.specularColor = new Color3(0.3, 0.2, 0.1); // Metallic reflections
        parasiteMaterial.specularPower = 16;

        // Create segments (torus rings) - tapers from head to tail
        for (let i = 0; i < segmentCount; i++) {
            // Size multiplier: tapers from 1.0 at head to smaller at tail
            const sizeMultiplier = 1.0 - (i * 0.12);
            const ringDiameter = 0.8 * sizeMultiplier * baseScale;
            const ringThickness = 0.2 * sizeMultiplier * baseScale;

            const segment = MeshBuilder.CreateTorus(`${name}_segment_${i}`, {
                diameter: ringDiameter,
                thickness: ringThickness,
                tessellation: 16 // Higher tessellation for intro screen quality
            }, this.scene);

            segment.material = parasiteMaterial;
            segment.parent = parasiteGroup;

            // Position along Z axis (negative Z = towards tail)
            segment.position = new Vector3(0, 0, -i * baseSpacing * baseScale);
            segment.rotation.x = Math.PI / 2; // Face forward
        }

        return parasiteGroup;
    }

    /**
     * Create a single ring worm parasite for the introduction screen
     * Tilted towards the camera for better visibility
     */
    public createRingWormGroup(count: number = 1): AbstractMesh {
        const groupContainer = new Mesh('ringWormGroup', this.scene);

        // Create single parasite with 6 segments
        const parasite = this.createRingWormParasite('ringWorm_0', 6);

        // Center position
        parasite.position = new Vector3(0, 0, 0);

        // Flip 180 degrees so big ring (head) faces camera, then tilt 20 degrees downward
        const tiltAngle = 20 * (Math.PI / 180); // Convert 20 degrees to radians
        parasite.rotation = new Vector3(tiltAngle, Math.PI, 0);

        parasite.parent = groupContainer;

        // Note: Animation is handled by IntroductionModelRenderer via MODEL_PAGE_MAPPING

        return groupContainer;
    }

    /**
     * Create group of organic parasite models with various shapes
     * Requirements: 9.2, 9.3 - Organic parasite models with dark materials and red pulsing effects
     */
    public createParasiteGroup(config: ParasiteConfig): AbstractMesh {
        const parasiteGroup = new Mesh('parasiteGroup', this.scene);
        
        // Create multiple parasites with different shapes and positions
        for (let i = 0; i < config.count; i++) {
            const shapeType = config.organicShapes[i % config.organicShapes.length];
            const parasite = this.createSingleParasite(shapeType, i);
            
            // Position parasites in a loose cluster
            const angle = (i / config.count) * Math.PI * 2;
            const radius = 1.5 + Math.random() * 1.0; // Random radius between 1.5 and 2.5
            const height = (Math.random() - 0.5) * 1.0; // Random height variation
            
            parasite.position = new Vector3(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
            );
            
            // Random rotation for organic variety
            parasite.rotation = new Vector3(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            
            parasite.parent = parasiteGroup;
            
            // Apply organic material with red veins
            this.applyOrganicMaterial(parasite, config.redVeins);
            
            // Add writhing animation if enabled
            if (config.writhing) {
                this.createWrithingAnimation(parasite, 0.4 + Math.random() * 0.4); // Varied speed
            }
            
            // Add pulsing effects if enabled
            if (config.pulsing) {
                this.addPulsingVeins(parasite, 0.8 + Math.random() * 0.4); // Varied intensity
            }
        }
        
        return parasiteGroup;
    }

    /**
     * Create single parasite based on shape type
     * Requirements: 9.2 - Multiple organic parasite shapes
     */
    private createSingleParasite(shapeType: 'blob' | 'tendril' | 'spore' | 'cluster', index: number): AbstractMesh {
        switch (shapeType) {
            case 'blob':
                return this.createOrganicBlob(`parasiteBlob_${index}`);
            case 'tendril':
                return this.createTendrilShape(`parasiteTendril_${index}`);
            case 'spore':
                return this.createSporeCluster(`parasiteSpore_${index}`);
            case 'cluster':
                return this.createOrganicCluster(`parasiteCluster_${index}`);
            default:
                return this.createOrganicBlob(`parasiteDefault_${index}`);
        }
    }

    /**
     * Create organic blob shape using CSG operations
     * Requirements: 9.2, 9.10 - Organic shape creation using Babylon.js CSG operations
     */
    public createOrganicBlob(name: string = 'organicBlob'): AbstractMesh {
        // Create base sphere
        const baseSphere = MeshBuilder.CreateSphere(`${name}_base`, {
            diameter: 1.5,
            segments: 16
        }, this.scene);
        
        // Create additional spheres for organic deformation
        const deformSphere1 = MeshBuilder.CreateSphere(`${name}_deform1`, {
            diameter: 1.0,
            segments: 12
        }, this.scene);
        deformSphere1.position = new Vector3(0.4, 0.2, 0.3);
        
        const deformSphere2 = MeshBuilder.CreateSphere(`${name}_deform2`, {
            diameter: 0.8,
            segments: 10
        }, this.scene);
        deformSphere2.position = new Vector3(-0.3, -0.2, 0.4);
        
        const deformSphere3 = MeshBuilder.CreateSphere(`${name}_deform3`, {
            diameter: 0.6,
            segments: 8
        }, this.scene);
        deformSphere3.position = new Vector3(0.2, 0.4, -0.3);
        
        // Use CSG to combine spheres into organic blob
        const baseCSG = CSG.FromMesh(baseSphere);
        const deform1CSG = CSG.FromMesh(deformSphere1);
        const deform2CSG = CSG.FromMesh(deformSphere2);
        const deform3CSG = CSG.FromMesh(deformSphere3);
        
        // Union all spheres to create organic blob
        const combinedCSG = baseCSG
            .union(deform1CSG)
            .union(deform2CSG)
            .union(deform3CSG);
        
        const organicBlob = combinedCSG.toMesh(name, baseSphere.material, this.scene);
        
        // Clean up temporary meshes
        baseSphere.dispose();
        deformSphere1.dispose();
        deformSphere2.dispose();
        deformSphere3.dispose();
        
        return organicBlob;
    }

    /**
     * Create tendril-like elongated organic shape
     * Requirements: 9.2 - Tendril parasite shapes
     */
    public createTendrilShape(name: string = 'tendrilShape'): AbstractMesh {
        // Create main tendril body using elongated ellipsoid
        const tendrilBody = MeshBuilder.CreateSphere(`${name}_body`, {
            diameter: 1.0,
            segments: 12
        }, this.scene);
        
        // Stretch to create tendril shape
        tendrilBody.scaling = new Vector3(0.3, 2.5, 0.4);
        
        // Create bulbous head
        const tendrilHead = MeshBuilder.CreateSphere(`${name}_head`, {
            diameter: 0.8,
            segments: 10
        }, this.scene);
        tendrilHead.position = new Vector3(0, 1.0, 0);
        tendrilHead.scaling = new Vector3(1.2, 0.8, 1.1);
        
        // Create smaller appendages
        const appendage1 = MeshBuilder.CreateSphere(`${name}_appendage1`, {
            diameter: 0.4,
            segments: 8
        }, this.scene);
        appendage1.position = new Vector3(0.3, 0.5, 0.2);
        appendage1.scaling = new Vector3(0.5, 1.5, 0.5);
        
        const appendage2 = MeshBuilder.CreateSphere(`${name}_appendage2`, {
            diameter: 0.3,
            segments: 6
        }, this.scene);
        appendage2.position = new Vector3(-0.2, -0.3, 0.3);
        appendage2.scaling = new Vector3(0.4, 1.2, 0.4);
        
        // Combine using CSG
        const bodyCSG = CSG.FromMesh(tendrilBody);
        const headCSG = CSG.FromMesh(tendrilHead);
        const appendage1CSG = CSG.FromMesh(appendage1);
        const appendage2CSG = CSG.FromMesh(appendage2);
        
        const tendrilCSG = bodyCSG
            .union(headCSG)
            .union(appendage1CSG)
            .union(appendage2CSG);
        
        const tendril = tendrilCSG.toMesh(name, tendrilBody.material, this.scene);
        
        // Clean up temporary meshes
        tendrilBody.dispose();
        tendrilHead.dispose();
        appendage1.dispose();
        appendage2.dispose();
        
        return tendril;
    }

    /**
     * Create spore cluster with multiple small organic pods
     * Requirements: 9.2 - Spore cluster parasite shapes
     */
    public createSporeCluster(name: string = 'sporeCluster'): AbstractMesh {
        const clusterGroup = new Mesh(name, this.scene);
        
        // Create central mass
        const centralMass = MeshBuilder.CreateSphere(`${name}_center`, {
            diameter: 0.8,
            segments: 12
        }, this.scene);
        centralMass.scaling = new Vector3(1.2, 0.8, 1.0);
        centralMass.parent = clusterGroup;
        
        // Create multiple spores around the central mass
        const sporeCount = 6;
        for (let i = 0; i < sporeCount; i++) {
            const spore = MeshBuilder.CreateSphere(`${name}_spore_${i}`, {
                diameter: 0.3 + Math.random() * 0.2, // Varied sizes
                segments: 8
            }, this.scene);
            
            // Position spores around central mass
            const angle = (i / sporeCount) * Math.PI * 2;
            const radius = 0.6 + Math.random() * 0.3;
            const height = (Math.random() - 0.5) * 0.4;
            
            spore.position = new Vector3(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
            );
            
            // Random deformation for organic variety
            spore.scaling = new Vector3(
                0.8 + Math.random() * 0.4,
                0.7 + Math.random() * 0.6,
                0.8 + Math.random() * 0.4
            );
            
            spore.parent = clusterGroup;
        }
        
        return clusterGroup;
    }

    /**
     * Create complex organic cluster with multiple interconnected parts
     * Requirements: 9.2 - Complex organic cluster shapes
     */
    private createOrganicCluster(name: string): AbstractMesh {
        // Create main body
        const mainBody = this.createOrganicBlob(`${name}_mainBody`);
        
        // Create secondary masses
        const secondary1 = this.createOrganicBlob(`${name}_secondary1`);
        secondary1.scaling = new Vector3(0.7, 0.8, 0.6);
        secondary1.position = new Vector3(1.2, 0.3, 0.5);
        
        const secondary2 = this.createOrganicBlob(`${name}_secondary2`);
        secondary2.scaling = new Vector3(0.5, 0.6, 0.7);
        secondary2.position = new Vector3(-0.8, -0.4, 0.8);
        
        // Create connecting tendrils
        const connector1 = this.createTendrilShape(`${name}_connector1`);
        connector1.scaling = new Vector3(0.3, 0.5, 0.3);
        connector1.position = new Vector3(0.6, 0.1, 0.2);
        connector1.rotation = new Vector3(0, 0, Math.PI / 4);
        
        // Combine into cluster group
        const clusterGroup = new Mesh(name, this.scene);
        mainBody.parent = clusterGroup;
        secondary1.parent = clusterGroup;
        secondary2.parent = clusterGroup;
        connector1.parent = clusterGroup;
        
        return clusterGroup;
    }

    /**
     * Apply organic material with dark colors and optional red veins
     * Requirements: 9.3 - Dark materials with red pulsing vein effects
     */
    public applyOrganicMaterial(mesh: AbstractMesh, includeVeins: boolean = true): void {
        // Dark organic base colors
        const baseColor = new Color3(0.15, 0.08, 0.12); // Dark purple-brown
        const emissiveColor = new Color3(0.05, 0.02, 0.08); // Very dark glow
        
        // Create base organic material
        const organicMaterial = this.materialManager.createCustomMaterial(
            `organicMaterial_${mesh.name}`,
            baseColor,
            {
                emissive: emissiveColor,
                specular: new Color3(0.1, 0.05, 0.1), // Minimal specular for organic look
                roughness: 0.9 // Very rough, non-reflective surface
            }
        );
        
        // Add red vein texture if requested
        if (includeVeins) {
            const veinTexture = this.createRedVeinTexture(mesh.name);
            organicMaterial.emissiveTexture = veinTexture;
        }
        
        // Apply material to mesh and all children
        this.applyMaterialRecursively(mesh, organicMaterial);
    }

    /**
     * Create red pulsing vein texture for organic materials
     * Requirements: 9.3, 9.10 - Red pulsing vein effects
     */
    private createRedVeinTexture(meshName: string): DynamicTexture {
        const textureSize = 256;
        const texture = new DynamicTexture(`redVeinTexture_${meshName}`, textureSize, this.scene, false);
        
        const context = texture.getContext();
        const imageData = new ImageData(textureSize, textureSize);
        
        // Generate vein-like patterns using noise
        for (let y = 0; y < textureSize; y++) {
            for (let x = 0; x < textureSize; x++) {
                const index = (y * textureSize + x) * 4;
                
                // Create vein patterns using multiple noise octaves
                const veinNoise1 = this.organicNoise(x * 0.02, y * 0.02) * 0.5 + 0.5;
                const veinNoise2 = this.organicNoise(x * 0.05, y * 0.05) * 0.3 + 0.7;
                const veinNoise3 = this.organicNoise(x * 0.1, y * 0.1) * 0.2 + 0.8;
                
                // Combine noise to create vein-like structures
                const veinIntensity = veinNoise1 * veinNoise2 * veinNoise3;
                
                // Create red vein color based on intensity
                const redIntensity = veinIntensity > 0.7 ? (veinIntensity - 0.7) * 3.33 : 0; // Threshold for veins
                
                imageData.data[index] = Math.floor(redIntensity * 255 * 0.8);     // Red channel
                imageData.data[index + 1] = Math.floor(redIntensity * 255 * 0.1); // Green channel (minimal)
                imageData.data[index + 2] = Math.floor(redIntensity * 255 * 0.2); // Blue channel (minimal)
                imageData.data[index + 3] = Math.floor(redIntensity * 255);       // Alpha (vein visibility)
            }
        }
        
        context.putImageData(imageData, 0, 0);
        texture.update();
        
        // Configure texture properties
        texture.wrapU = Texture.WRAP_ADDRESSMODE;
        texture.wrapV = Texture.WRAP_ADDRESSMODE;
        
        return texture;
    }

    /**
     * Organic noise function for vein pattern generation
     */
    private organicNoise(x: number, y: number): number {
        // Multi-octave noise for organic patterns
        const noise1 = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const noise2 = Math.sin(x * 93.9898 + y * 47.233) * 23421.6314;
        const noise3 = Math.sin(x * 67.1234 + y * 89.567) * 12345.6789;
        
        const combined = (noise1 + noise2 * 0.5 + noise3 * 0.25) / 1.75;
        return combined - Math.floor(combined);
    }

    /**
     * Apply material recursively to mesh and all children
     */
    private applyMaterialRecursively(mesh: AbstractMesh, material: Material): void {
        mesh.material = material;
        
        // Apply to all child meshes
        const children = mesh.getChildMeshes();
        children.forEach(child => {
            child.material = material;
        });
    }

    /**
     * Add pulsing vein effects to parasite
     * Requirements: 9.3, 9.10 - Red pulsing vein effects
     */
    public addPulsingVeins(mesh: AbstractMesh, intensity: number = 1.0): Animation {
        const pulseAnimation = new Animation(
            `veinPulse_${mesh.name}`,
            'material.emissiveTexture.level',
            30, // 30 FPS
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        // Create pulsing effect for vein intensity
        const frameRate = 30;
        const cycleDuration = 1.5; // 1.5 seconds per pulse cycle
        const totalFrames = frameRate * cycleDuration;

        const keys = [
            { 
                frame: 0, 
                value: 0.2 * intensity 
            },
            { 
                frame: totalFrames * 0.3, 
                value: 1.0 * intensity 
            },
            { 
                frame: totalFrames * 0.7, 
                value: 0.6 * intensity 
            },
            { 
                frame: totalFrames, 
                value: 0.2 * intensity 
            }
        ];

        pulseAnimation.setKeys(keys);

        // Apply organic easing for natural pulsing
        const easingFunction = new SineEase();
        easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        pulseAnimation.setEasingFunction(easingFunction);

        // Add animation to mesh
        mesh.animations.push(pulseAnimation);

        return pulseAnimation;
    }

    /**
     * Create writhing animation system for organic movement
     * Requirements: 9.3, 9.10 - Writhing animation system for organic movement
     */
    public createWrithingAnimation(mesh: AbstractMesh, speed: number = 1.0): Animation[] {
        const animations: Animation[] = [];
        
        // Create multiple animation channels for complex writhing motion
        
        // Rotation writhing (slow, organic rotation)
        const rotationAnimation = new Animation(
            `writhingRotation_${mesh.name}`,
            'rotation',
            30,
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        const rotationFrameRate = 30;
        const rotationCycleDuration = 4.0 / speed; // 4 seconds per cycle, adjusted by speed
        const rotationTotalFrames = rotationFrameRate * rotationCycleDuration;

        const rotationKeys = [
            { 
                frame: 0, 
                value: new Vector3(0, 0, 0) 
            },
            { 
                frame: rotationTotalFrames * 0.25, 
                value: new Vector3(Math.PI / 8, Math.PI / 6, -Math.PI / 10) 
            },
            { 
                frame: rotationTotalFrames * 0.5, 
                value: new Vector3(-Math.PI / 10, -Math.PI / 8, Math.PI / 6) 
            },
            { 
                frame: rotationTotalFrames * 0.75, 
                value: new Vector3(Math.PI / 6, -Math.PI / 10, -Math.PI / 8) 
            },
            { 
                frame: rotationTotalFrames, 
                value: new Vector3(0, 0, 0) 
            }
        ];

        rotationAnimation.setKeys(rotationKeys);
        
        // Apply smooth organic easing
        const rotationEasing = new BezierCurveEase(0.25, 0.1, 0.75, 0.9);
        rotationAnimation.setEasingFunction(rotationEasing);
        
        animations.push(rotationAnimation);
        mesh.animations.push(rotationAnimation);

        // Scaling writhing (subtle breathing/pulsing effect)
        const scalingAnimation = new Animation(
            `writhingScaling_${mesh.name}`,
            'scaling',
            30,
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        const scalingCycleDuration = 3.0 / speed; // 3 seconds per cycle
        const scalingTotalFrames = rotationFrameRate * scalingCycleDuration;

        const scalingKeys = [
            { 
                frame: 0, 
                value: new Vector3(1.0, 1.0, 1.0) 
            },
            { 
                frame: scalingTotalFrames * 0.33, 
                value: new Vector3(1.05, 0.98, 1.02) 
            },
            { 
                frame: scalingTotalFrames * 0.66, 
                value: new Vector3(0.98, 1.03, 0.99) 
            },
            { 
                frame: scalingTotalFrames, 
                value: new Vector3(1.0, 1.0, 1.0) 
            }
        ];

        scalingAnimation.setKeys(scalingKeys);
        
        // Apply different easing for scaling
        const scalingEasing = new SineEase();
        scalingEasing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        scalingAnimation.setEasingFunction(scalingEasing);
        
        animations.push(scalingAnimation);
        mesh.animations.push(scalingAnimation);

        // Position writhing (subtle floating movement)
        const positionAnimation = new Animation(
            `writhingPosition_${mesh.name}`,
            'position.y',
            30,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        const positionCycleDuration = 2.5 / speed; // 2.5 seconds per cycle
        const positionTotalFrames = rotationFrameRate * positionCycleDuration;
        const originalY = mesh.position.y;

        const positionKeys = [
            { 
                frame: 0, 
                value: originalY 
            },
            { 
                frame: positionTotalFrames * 0.5, 
                value: originalY + 0.1 
            },
            { 
                frame: positionTotalFrames, 
                value: originalY 
            }
        ];

        positionAnimation.setKeys(positionKeys);
        
        // Apply gentle easing for floating effect
        const positionEasing = new SineEase();
        positionEasing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        positionAnimation.setEasingFunction(positionEasing);
        
        animations.push(positionAnimation);
        mesh.animations.push(positionAnimation);

        return animations;
    }

    /**
     * Dispose of created resources
     */
    public dispose(): void {
        // Materials and textures are managed by MaterialManager and Babylon.js
        // No additional cleanup needed
        console.log('ParasiteRenderer disposed');
    }
}