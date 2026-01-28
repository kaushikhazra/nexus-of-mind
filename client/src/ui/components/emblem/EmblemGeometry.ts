/**
 * EmblemGeometry - Geometric Emblem Creation for Introduction Screen
 *
 * Creates procedurally generated geometric emblems with neon glow effects
 * for the Empire and Energy Lords story pages. Uses Babylon.js primitives
 * to create SciFi-styled emblems with pulsing animations.
 *
 * Refactored to delegate to extracted modules for SOLID compliance.
 *
 * Requirements: 9.2, 9.3, 9.5, 9.10
 */

import {
    Scene,
    AbstractMesh,
    Mesh,
    Vector3,
    Color3,
    Animation,
    StandardMaterial,
    MeshBuilder
} from '@babylonjs/core';
import { MaterialManager } from '../../../rendering/MaterialManager';
import type { EmblemConfig, EmblemColorTheme } from './EmblemInterfaces';
import { DEFAULT_EMBLEM_CONFIG } from './EmblemInterfaces';
import { EmblemMaterialManager } from './EmblemMaterials';
import { EmblemShapeFactory } from './EmblemShapes';
import { EmblemComplexShapeFactory } from './EmblemComplexShapes';
import { KorenthiFaceFactory } from './KorenthiFaceShapes';
import { EnergyLordsEmblemFactory } from './EnergyLordsEmblem';
import { addPulsingAnimation } from './EmblemAnimations';

// Re-export for backwards compatibility
export type { EmblemDesign, EmblemConfig } from './EmblemInterfaces';

/**
 * EmblemGeometry - Main emblem creation coordinator
 */
export class EmblemGeometry {
    private scene: Scene;
    private materialManager: MaterialManager;
    private emblemMaterials: EmblemMaterialManager;
    private shapeFactory: EmblemShapeFactory;
    private complexShapeFactory: EmblemComplexShapeFactory;
    private korenthiFaceFactory: KorenthiFaceFactory;
    private energyLordsFactory: EnergyLordsEmblemFactory;

    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;

        // Initialize delegated factories
        this.emblemMaterials = new EmblemMaterialManager(scene, materialManager);
        this.shapeFactory = new EmblemShapeFactory(scene);
        this.complexShapeFactory = new EmblemComplexShapeFactory(scene);
        this.korenthiFaceFactory = new KorenthiFaceFactory(scene);
        this.energyLordsFactory = new EnergyLordsEmblemFactory(scene);
    }

    /**
     * Create Korenthi Empire emblem with hexagonal base and inner elements
     * Requirements: 9.2, 9.3 - Empire emblem with neon glow effects
     */
    public createEmpireEmblem(): AbstractMesh {
        const emblem = new Mesh('empireEmblem', this.scene);
        const s = 1.5; // Scale factor

        // Base shape - Truncated inverted pyramid
        const baseShape = MeshBuilder.CreateCylinder('korenthiBase', {
            height: 2.0 * s,
            diameterTop: 2.42 * s,
            diameterBottom: 1.45 * s,
            tessellation: 4
        }, this.scene);
        baseShape.rotation.y = Math.PI / 4;
        baseShape.parent = emblem;

        // Crown - Pointed pyramid on top
        const crown = MeshBuilder.CreateCylinder('korenthiCrown', {
            height: 0.6 * s,
            diameterTop: 0,
            diameterBottom: 2.42 * s,
            tessellation: 4
        }, this.scene);
        crown.position.y = 1.3 * s;
        crown.rotation.y = Math.PI / 4;
        crown.parent = emblem;

        // Eyes
        const leftEye = this.createEyeMesh('leftEye', s);
        leftEye.position = new Vector3(-0.3 * s, 0.4 * s, -0.75 * s);
        leftEye.parent = emblem;

        const rightEye = this.createEyeMesh('rightEye', s);
        rightEye.position = new Vector3(0.3 * s, 0.4 * s, -0.75 * s);
        rightEye.parent = emblem;

        // Central ridge
        const centralRidge = this.createFacialFeature('centralRidge', 0.08 * s, 0.5 * s, 0.1 * s);
        centralRidge.position = new Vector3(0, 0.05 * s, -0.7 * s);
        centralRidge.parent = emblem;

        // Mouth band
        const mouthBand = this.createFacialFeature('mouthBand', 0.5 * s, 0.05 * s, 0.1 * s);
        mouthBand.position = new Vector3(0, -0.5 * s, -0.6 * s);
        mouthBand.parent = emblem;

        // Ears
        const leftEar = this.createEarMesh('leftEar', s);
        leftEar.position = new Vector3(-0.81 * s, 0.2 * s, 0.0 * s);
        leftEar.parent = emblem;

        const rightEar = this.createEarMesh('rightEar', s);
        rightEar.position = new Vector3(0.81 * s, 0.2 * s, 0.0 * s);
        rightEar.parent = emblem;

        // Back planks
        const backPlanks = this.createBackPlanks(s, emblem);

        // Apply materials
        this.applyEmpireMaskMaterials(
            baseShape, crown, leftEye, rightEye,
            centralRidge, mouthBand, leftEar, rightEar, backPlanks
        );

        return emblem;
    }

    private createEyeMesh(name: string, scale: number): Mesh {
        return MeshBuilder.CreateBox(name, {
            width: 0.4 * scale,
            height: 0.06 * scale,
            depth: 0.12 * scale
        }, this.scene);
    }

    private createFacialFeature(name: string, width: number, height: number, depth: number): Mesh {
        return MeshBuilder.CreateBox(name, { width, height, depth }, this.scene);
    }

    private createEarMesh(name: string, scale: number): Mesh {
        return MeshBuilder.CreateBox(name, {
            width: 0.2 * scale,
            height: 0.75 * scale,
            depth: 0.45 * scale
        }, this.scene);
    }

    private createBackPlanks(scale: number, parent: AbstractMesh): Mesh[] {
        const positions = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75];
        const planks: Mesh[] = [];

        positions.forEach((xPos, i) => {
            const plank = MeshBuilder.CreateBox(`backPlank_${i}`, {
                width: 0.12 * scale,
                height: 2.0 * scale,
                depth: 0.68 * scale
            }, this.scene);
            plank.position = new Vector3(xPos * scale, 0.0 * scale, 0.54 * scale);
            plank.parent = parent;
            planks.push(plank);
        });

        return planks;
    }

    private applyEmpireMaskMaterials(
        baseShape: Mesh, crown: Mesh, leftEye: Mesh, rightEye: Mesh,
        centralRidge: Mesh, mouthBand: Mesh, leftEar: Mesh, rightEar: Mesh,
        backPlanks: Mesh[]
    ): void {
        // Base material - Polished obsidian
        const baseMaterial = new StandardMaterial('maskBaseMat', this.scene);
        baseMaterial.diffuseColor = new Color3(0.15, 0.15, 0.18);
        baseMaterial.specularColor = new Color3(0.3, 0.3, 0.35);
        baseMaterial.specularPower = 32;
        baseMaterial.emissiveColor = new Color3(0.02, 0.02, 0.02);
        baseShape.material = baseMaterial;

        // Crown material - Dark emerald
        const crownMaterial = new StandardMaterial('maskCrownMat', this.scene);
        crownMaterial.diffuseColor = new Color3(0.02, 0.12, 0.06);
        crownMaterial.specularColor = new Color3(0.05, 0.2, 0.1);
        crownMaterial.emissiveColor = new Color3(0.01, 0.04, 0.02);
        crown.material = crownMaterial;

        // Eye material - Bright gold
        const eyeMaterial = new StandardMaterial('maskEyeMat', this.scene);
        eyeMaterial.diffuseColor = new Color3(0.85, 0.65, 0.1);
        eyeMaterial.specularColor = new Color3(1.0, 0.9, 0.5);
        eyeMaterial.emissiveColor = new Color3(0.4, 0.3, 0.05);
        leftEye.material = eyeMaterial;
        rightEye.material = eyeMaterial;

        // Feature material - Antique gold
        const featureMaterial = new StandardMaterial('maskFeatureMat', this.scene);
        featureMaterial.diffuseColor = new Color3(0.6, 0.45, 0.1);
        featureMaterial.specularColor = new Color3(0.8, 0.6, 0.2);
        featureMaterial.emissiveColor = new Color3(0.1, 0.08, 0.02);
        centralRidge.material = featureMaterial;
        mouthBand.material = featureMaterial;

        // Ear material - Dark bronze
        const earMaterial = new StandardMaterial('maskEarMat', this.scene);
        earMaterial.diffuseColor = new Color3(0.25, 0.2, 0.1);
        earMaterial.specularColor = new Color3(0.4, 0.3, 0.15);
        earMaterial.emissiveColor = new Color3(0.02, 0.015, 0.005);
        leftEar.material = earMaterial;
        rightEar.material = earMaterial;

        // Plank material - Dark emerald
        const plankMaterial = new StandardMaterial('maskPlankMat', this.scene);
        plankMaterial.diffuseColor = new Color3(0.02, 0.12, 0.06);
        plankMaterial.specularColor = new Color3(0.05, 0.2, 0.1);
        plankMaterial.emissiveColor = new Color3(0.01, 0.04, 0.02);
        backPlanks.forEach(plank => plank.material = plankMaterial);
    }

    /**
     * Create Energy Lords emblem with octagonal base and energy-themed elements
     * Requirements: 9.2, 9.3 - Energy Lords emblem with cyan/gold neon effects
     */
    public createEnergyLordsEmblem(): AbstractMesh {
        return this.energyLordsFactory.createEnergyLordsEmblem();
    }

    /**
     * Create Biohazard Warning Sign
     */
    public createRadiationSign(): AbstractMesh {
        return this.energyLordsFactory.createRadiationSign();
    }

    /**
     * Add pulsing animation effects for emblems
     * Requirements: 9.3, 9.10 - Pulsing animation effects
     */
    public addPulsingAnimation(emblem: AbstractMesh, speed: number = 1.0): Animation {
        return addPulsingAnimation(emblem, speed);
    }

    /**
     * Create a simple geometric emblem for testing or fallback
     * Requirements: 9.5 - Basic geometric shape creation
     */
    public createSimpleEmblem(name: string, shape: 'hexagon' | 'octagon' = 'hexagon'): AbstractMesh {
        const segments = shape === 'hexagon' ? 6 : 8;
        const config: EmblemConfig = {
            ...DEFAULT_EMBLEM_CONFIG,
            segments
        };

        const emblem = this.shapeFactory.createPolygonalBase(name, config);

        const material = this.materialManager.createCustomMaterial(
            `${name}_material`,
            new Color3(0, 1, 1),
            {
                emissive: new Color3(0, 0.3, 0.3),
                specular: new Color3(0.2, 0.6, 0.6),
                roughness: 0.4
            }
        );
        emblem.material = material;

        addPulsingAnimation(emblem, config.pulseSpeed);

        return emblem;
    }

    /**
     * Dispose of created materials and resources
     */
    public dispose(): void {
        console.log('EmblemGeometry disposed');
    }
}
