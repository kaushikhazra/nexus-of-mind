/**
 * EmblemGeometry - Geometric Emblem Creation for Introduction Screen
 * 
 * Creates procedurally generated geometric emblems with neon glow effects
 * for the Empire and Energy Lords story pages. Uses Babylon.js primitives
 * to create SciFi-styled emblems with pulsing animations.
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
    Material,
    CSG,
    MeshBuilder,
    SineEase,
    EasingFunction
} from '@babylonjs/core';
import { MaterialManager } from '../../rendering/MaterialManager';

export interface EmblemDesign {
    primaryShape: 'hexagon' | 'octagon' | 'star' | 'diamond';
    innerElements: ('ring' | 'cross' | 'triangle' | 'circle')[];
    glowIntensity: number;
    colors: {
        primary: string;
        secondary: string;
        glow: string;
    };
}

export interface EmblemConfig {
    size: number;
    height: number;
    segments: number;
    glowIntensity: number;
    pulseSpeed: number; // Animation speed multiplier
}

export class EmblemGeometry {
    private scene: Scene;
    private materialManager: MaterialManager;

    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;
    }

    /**
     * Create Korenthi Empire emblem with hexagonal base and inner elements
     * Requirements: 9.2, 9.3 - Empire emblem with neon glow effects
     *
     * Based on the Korenthi Consciousness design:
     * - Single glowing outer ring
     * - Detailed low-poly geometric face at center (front-facing)
     * - Circuit board rays with right-angle bends and endpoint circles
     * - Hexagonal clusters on left and right sides
     * - Cityscape vertical bars at the top
     */
    public createEmpireEmblem(): AbstractMesh {
        const emblem = new Mesh('empireEmblem', this.scene);
        const s = 1.5; // Scale factor - increased for zoomed out camera

        // === BASE SHAPE - Truncated inverted pyramid (20% wider) ===
        const baseShape = MeshBuilder.CreateCylinder('korenthiBase', {
            height: 2.0 * s,
            diameterTop: 2.42 * s,
            diameterBottom: 1.45 * s,
            tessellation: 4
        }, this.scene);
        baseShape.rotation.y = Math.PI / 4;
        baseShape.parent = emblem;

        // === CROWN - Pointed pyramid on top (20% wider, 20% taller) ===
        const crown = MeshBuilder.CreateCylinder('korenthiCrown', {
            height: 0.6 * s,
            diameterTop: 0,
            diameterBottom: 2.42 * s,
            tessellation: 4
        }, this.scene);
        crown.position.y = 1.3 * s;
        crown.rotation.y = Math.PI / 4;
        crown.parent = emblem;

        // === EYES - Straight horizontal lines ===
        // Left eye
        const leftEye = MeshBuilder.CreateBox('leftEye', {
            width: 0.4 * s,
            height: 0.06 * s,
            depth: 0.12 * s
        }, this.scene);
        leftEye.position = new Vector3(-0.3 * s, 0.4 * s, -0.75 * s);
        leftEye.parent = emblem;

        // Right eye
        const rightEye = MeshBuilder.CreateBox('rightEye', {
            width: 0.4 * s,
            height: 0.06 * s,
            depth: 0.12 * s
        }, this.scene);
        rightEye.position = new Vector3(0.3 * s, 0.4 * s, -0.75 * s);
        rightEye.parent = emblem;

        // === CENTRAL RIDGE (||) ===
        const centralRidge = MeshBuilder.CreateBox('centralRidge', {
            width: 0.08 * s,
            height: 0.5 * s,
            depth: 0.1 * s
        }, this.scene);
        centralRidge.position = new Vector3(0, 0.05 * s, -0.7 * s);
        centralRidge.parent = emblem;

        // === MOUTH BAND (----) ===
        const mouthBand = MeshBuilder.CreateBox('mouthBand', {
            width: 0.5 * s,
            height: 0.05 * s,
            depth: 0.1 * s
        }, this.scene);
        mouthBand.position = new Vector3(0, -0.5 * s, -0.6 * s);
        mouthBand.parent = emblem;

        // === EARS - Rectangular bars on sides ===
        const leftEar = MeshBuilder.CreateBox('leftEar', {
            width: 0.2 * s,
            height: 0.75 * s,
            depth: 0.45 * s
        }, this.scene);
        leftEar.position = new Vector3(-0.81 * s, 0.2 * s, 0.0 * s);
        leftEar.parent = emblem;

        const rightEar = MeshBuilder.CreateBox('rightEar', {
            width: 0.2 * s,
            height: 0.75 * s,
            depth: 0.45 * s
        }, this.scene);
        rightEar.position = new Vector3(0.81 * s, 0.2 * s, 0.0 * s);
        rightEar.parent = emblem;

        // === BACK PLANKS - 6 vertical bars on back of head ===
        const backPlankPositions = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75];
        const backPlanks: Mesh[] = [];

        backPlankPositions.forEach((xPos, i) => {
            const plank = MeshBuilder.CreateBox(`backPlank_${i}`, {
                width: 0.12 * s,
                height: 2.0 * s,
                depth: 0.68 * s
            }, this.scene);
            plank.position = new Vector3(xPos * s, 0.0 * s, 0.54 * s);
            plank.parent = emblem;
            backPlanks.push(plank);
        });

        // === APPLY MATERIALS - Gold & Black Regal Emperor ===

        // Base & Crown - Polished obsidian with gold highlights
        const baseMaterial = new StandardMaterial('maskBaseMat', this.scene);
        baseMaterial.diffuseColor = new Color3(0.15, 0.15, 0.18);
        baseMaterial.specularColor = new Color3(0.3, 0.3, 0.35);
        baseMaterial.specularPower = 32;
        baseMaterial.emissiveColor = new Color3(0.02, 0.02, 0.02);
        baseMaterial.ambientColor = new Color3(0.08, 0.08, 0.1);
        baseShape.material = baseMaterial;

        // Crown - Dark emerald
        const crownMaterial = new StandardMaterial('maskCrownMat', this.scene);
        crownMaterial.diffuseColor = new Color3(0.02, 0.12, 0.06);
        crownMaterial.specularColor = new Color3(0.05, 0.2, 0.1);
        crownMaterial.specularPower = 32;
        crownMaterial.emissiveColor = new Color3(0.01, 0.04, 0.02);
        crownMaterial.ambientColor = new Color3(0.01, 0.06, 0.03);
        crown.material = crownMaterial;

        // Eyes - Bright gold, glowing with power
        const eyeMaterial = new StandardMaterial('maskEyeMat', this.scene);
        eyeMaterial.diffuseColor = new Color3(0.85, 0.65, 0.1);
        eyeMaterial.specularColor = new Color3(1.0, 0.9, 0.5);
        eyeMaterial.specularPower = 64;
        eyeMaterial.emissiveColor = new Color3(0.4, 0.3, 0.05);
        eyeMaterial.ambientColor = new Color3(0.3, 0.2, 0.05);

        // Nose & Mouth - Antique gold accents
        const featureMaterial = new StandardMaterial('maskFeatureMat', this.scene);
        featureMaterial.diffuseColor = new Color3(0.6, 0.45, 0.1);
        featureMaterial.specularColor = new Color3(0.8, 0.6, 0.2);
        featureMaterial.specularPower = 32;
        featureMaterial.emissiveColor = new Color3(0.1, 0.08, 0.02);
        featureMaterial.ambientColor = new Color3(0.2, 0.15, 0.05);

        // Ears - Dark bronze, subtle
        const earMaterial = new StandardMaterial('maskEarMat', this.scene);
        earMaterial.diffuseColor = new Color3(0.25, 0.2, 0.1);
        earMaterial.specularColor = new Color3(0.4, 0.3, 0.15);
        earMaterial.specularPower = 16;
        earMaterial.emissiveColor = new Color3(0.02, 0.015, 0.005);
        earMaterial.ambientColor = new Color3(0.1, 0.08, 0.04);

        // Back planks - Dark emerald
        const plankMaterial = new StandardMaterial('maskPlankMat', this.scene);
        plankMaterial.diffuseColor = new Color3(0.02, 0.12, 0.06);
        plankMaterial.specularColor = new Color3(0.05, 0.2, 0.1);
        plankMaterial.specularPower = 24;
        plankMaterial.emissiveColor = new Color3(0.01, 0.04, 0.02);
        plankMaterial.ambientColor = new Color3(0.01, 0.06, 0.03);

        // Apply glowing gold to eyes
        [leftEye, rightEye].forEach(mesh => {
            mesh.material = eyeMaterial;
        });

        // Apply antique gold to nose and mouth
        [centralRidge, mouthBand].forEach(mesh => {
            mesh.material = featureMaterial;
        });

        // Apply dark bronze to ears
        [leftEar, rightEar].forEach(mesh => {
            mesh.material = earMaterial;
        });

        // Apply dark gold to back planks
        backPlanks.forEach(mesh => {
            mesh.material = plankMaterial;
        });

        return emblem;
    }

    /**
     * Create Korenthi mask emblem - angular geometric design
     * Based on the concept: hexagonal mask with eye slits, central ridge, back ridges
     */
    private createKorenthiMask(name: string, size: number): Mesh {
        const maskGroup = new Mesh(`${name}_group`, this.scene);

        // === MAIN HEAD SHAPE - Hexagonal, tapered ===
        // Front face plate
        const frontPlate = MeshBuilder.CreateCylinder(`${name}_frontPlate`, {
            height: size * 0.4,
            diameterTop: size * 1.0,
            diameterBottom: size * 0.7,
            tessellation: 6
        }, this.scene);
        frontPlate.position.z = size * 0.1;
        frontPlate.rotation.x = Math.PI / 2;
        frontPlate.parent = maskGroup;

        // Upper head (crown area) - wider
        const upperHead = MeshBuilder.CreateCylinder(`${name}_upperHead`, {
            height: size * 0.25,
            diameterTop: size * 0.85,
            diameterBottom: size * 1.0,
            tessellation: 6
        }, this.scene);
        upperHead.position.y = size * 0.5;
        upperHead.parent = maskGroup;

        // Lower face (chin area) - tapered
        const lowerFace = MeshBuilder.CreateCylinder(`${name}_lowerFace`, {
            height: size * 0.4,
            diameterTop: size * 0.7,
            diameterBottom: size * 0.3,
            tessellation: 6
        }, this.scene);
        lowerFace.position.y = -size * 0.45;
        lowerFace.parent = maskGroup;

        // === EYES - Horizontal slits ===
        const eyeWidth = size * 0.28;
        const eyeHeight = size * 0.06;
        const eyeDepth = size * 0.15;

        const leftEye = MeshBuilder.CreateBox(`${name}_leftEye`, {
            width: eyeWidth,
            height: eyeHeight,
            depth: eyeDepth
        }, this.scene);
        leftEye.position = new Vector3(-size * 0.22, size * 0.15, size * 0.25);
        leftEye.parent = maskGroup;

        const rightEye = MeshBuilder.CreateBox(`${name}_rightEye`, {
            width: eyeWidth,
            height: eyeHeight,
            depth: eyeDepth
        }, this.scene);
        rightEye.position = new Vector3(size * 0.22, size * 0.15, size * 0.25);
        rightEye.parent = maskGroup;

        // === CENTRAL VERTICAL RIDGE (T-shape) ===
        // Vertical part
        const centralRidgeVert = MeshBuilder.CreateBox(`${name}_centralRidgeV`, {
            width: size * 0.08,
            height: size * 0.5,
            depth: size * 0.12
        }, this.scene);
        centralRidgeVert.position = new Vector3(0, size * 0.1, size * 0.28);
        centralRidgeVert.parent = maskGroup;

        // Top horizontal part of T
        const centralRidgeHorz = MeshBuilder.CreateBox(`${name}_centralRidgeH`, {
            width: size * 0.35,
            height: size * 0.06,
            depth: size * 0.1
        }, this.scene);
        centralRidgeHorz.position = new Vector3(0, size * 0.38, size * 0.28);
        centralRidgeHorz.parent = maskGroup;

        // === HORIZONTAL BAND (across face) ===
        const horizBand = MeshBuilder.CreateBox(`${name}_horizBand`, {
            width: size * 0.75,
            height: size * 0.05,
            depth: size * 0.08
        }, this.scene);
        horizBand.position = new Vector3(0, -size * 0.05, size * 0.28);
        horizBand.parent = maskGroup;

        // === CHIN POINT ===
        const chinPoint = MeshBuilder.CreateCylinder(`${name}_chin`, {
            height: size * 0.2,
            diameterTop: size * 0.15,
            diameterBottom: 0,
            tessellation: 4
        }, this.scene);
        chinPoint.position.y = -size * 0.7;
        chinPoint.parent = maskGroup;

        // === BACK RIDGES (neural pathways) ===
        const ridgeCount = 5;
        const ridgeSpacing = size * 0.12;
        const startX = -ridgeSpacing * (ridgeCount - 1) / 2;

        for (let i = 0; i < ridgeCount; i++) {
            const ridge = MeshBuilder.CreateBox(`${name}_backRidge_${i}`, {
                width: size * 0.04,
                height: size * 0.7,
                depth: size * 0.08
            }, this.scene);
            ridge.position = new Vector3(
                startX + i * ridgeSpacing,
                size * 0.05,
                -size * 0.18
            );
            ridge.parent = maskGroup;
        }

        // === DIAGONAL SIDE LINES ===
        const leftDiag = MeshBuilder.CreateBox(`${name}_leftDiag`, {
            width: size * 0.04,
            height: size * 0.35,
            depth: size * 0.06
        }, this.scene);
        leftDiag.position = new Vector3(-size * 0.38, size * 0.2, size * 0.15);
        leftDiag.rotation.z = 0.3;
        leftDiag.parent = maskGroup;

        const rightDiag = MeshBuilder.CreateBox(`${name}_rightDiag`, {
            width: size * 0.04,
            height: size * 0.35,
            depth: size * 0.06
        }, this.scene);
        rightDiag.position = new Vector3(size * 0.38, size * 0.2, size * 0.15);
        rightDiag.rotation.z = -0.3;
        rightDiag.parent = maskGroup;

        return maskGroup;
    }

    /**
     * Apply materials to the mask emblem
     */
    private applyMaskMaterials(mask: AbstractMesh): void {
        const cyanBase = new Color3(0.3, 0.8, 0.9);      // Main body
        const cyanBright = new Color3(0.5, 1, 1);        // Highlights
        const cyanGlow = new Color3(0, 0.5, 0.6);        // Emissive
        const cyanEyes = new Color3(0.7, 1, 1);          // Eyes - brightest

        const children = mask.getChildMeshes();
        children.forEach((child) => {
            const childName = child.name.toLowerCase();

            if (childName.includes('eye')) {
                // Eyes - bright glowing slits
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`,
                    cyanEyes,
                    { emissive: new Color3(0.4, 0.9, 1), specular: new Color3(1, 1, 1), roughness: 0.1 }
                );
            } else if (childName.includes('ridge') || childName.includes('diag')) {
                // Ridges and lines - accent glow
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`,
                    cyanBright,
                    { emissive: new Color3(0.2, 0.7, 0.8), specular: new Color3(0.6, 1, 1), roughness: 0.2 }
                );
            } else if (childName.includes('band') || childName.includes('centralridge')) {
                // Central features - medium glow
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`,
                    cyanBright,
                    { emissive: new Color3(0.15, 0.6, 0.7), specular: new Color3(0.5, 0.9, 0.9), roughness: 0.25 }
                );
            } else {
                // Main body - base cyan
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`,
                    cyanBase,
                    { emissive: cyanGlow, specular: new Color3(0.3, 0.6, 0.6), roughness: 0.4 }
                );
            }
        });
    }

    /**
     * Create a Korenthi face - an advanced alien species who mastered Artificial Consciousness
     * Features: Elongated cranium (intelligence), serene expression (peaceful),
     * third eye node (consciousness mastery), elegant geometry (sophistication)
     */
    private createKorenthiFace(name: string, size: number): Mesh {
        const faceGroup = new Mesh(`${name}_group`, this.scene);

        // === CRANIUM - Elongated for advanced intelligence ===
        const cranium = MeshBuilder.CreateSphere(`${name}_cranium`, {
            diameter: size * 1.0,
            segments: 16
        }, this.scene);
        // Elongate upward - large brain for consciousness mastery
        cranium.scaling = new Vector3(0.7, 1.3, 0.65);
        cranium.position.y = size * 0.4;
        cranium.parent = faceGroup;

        // === FACE PLATE - Smooth, geometric lower face ===
        const facePlate = MeshBuilder.CreateCylinder(`${name}_facePlate`, {
            height: size * 0.6,
            diameterTop: size * 0.65,
            diameterBottom: size * 0.35,
            tessellation: 6  // Hexagonal - geometric sophistication
        }, this.scene);
        facePlate.position.y = -size * 0.15;
        facePlate.parent = faceGroup;

        // === EYES - Large, almond-shaped (wisdom and perception) ===
        // Left eye
        const leftEye = MeshBuilder.CreateSphere(`${name}_leftEye`, {
            diameter: size * 0.22,
            segments: 12
        }, this.scene);
        leftEye.scaling = new Vector3(1.4, 0.6, 0.5); // Almond shape
        leftEye.position = new Vector3(-size * 0.22, size * 0.1, size * 0.28);
        leftEye.rotation.z = -0.2; // Slight tilt outward
        leftEye.parent = faceGroup;

        // Right eye
        const rightEye = MeshBuilder.CreateSphere(`${name}_rightEye`, {
            diameter: size * 0.22,
            segments: 12
        }, this.scene);
        rightEye.scaling = new Vector3(1.4, 0.6, 0.5);
        rightEye.position = new Vector3(size * 0.22, size * 0.1, size * 0.28);
        rightEye.rotation.z = 0.2;
        rightEye.parent = faceGroup;

        // === THIRD EYE / CONSCIOUSNESS NODE - Their mastery of AI ===
        const thirdEye = MeshBuilder.CreateSphere(`${name}_thirdEye`, {
            diameter: size * 0.15,
            segments: 12
        }, this.scene);
        thirdEye.position = new Vector3(0, size * 0.45, size * 0.35);
        thirdEye.parent = faceGroup;

        // === BROW RIDGES - Elegant, angular ===
        const leftBrow = MeshBuilder.CreateBox(`${name}_leftBrow`, {
            width: size * 0.28,
            height: size * 0.04,
            depth: size * 0.08
        }, this.scene);
        leftBrow.position = new Vector3(-size * 0.2, size * 0.25, size * 0.3);
        leftBrow.rotation.z = -0.15;
        leftBrow.parent = faceGroup;

        const rightBrow = MeshBuilder.CreateBox(`${name}_rightBrow`, {
            width: size * 0.28,
            height: size * 0.04,
            depth: size * 0.08
        }, this.scene);
        rightBrow.position = new Vector3(size * 0.2, size * 0.25, size * 0.3);
        rightBrow.rotation.z = 0.15;
        rightBrow.parent = faceGroup;

        // === NOSE - Minimal, refined (evolved beyond base needs) ===
        const nose = MeshBuilder.CreateCylinder(`${name}_nose`, {
            height: size * 0.15,
            diameterTop: size * 0.06,
            diameterBottom: size * 0.1,
            tessellation: 3  // Triangular
        }, this.scene);
        nose.position = new Vector3(0, -size * 0.05, size * 0.32);
        nose.rotation.x = -0.3;
        nose.parent = faceGroup;

        // === CHIN - Pointed, elegant ===
        const chin = MeshBuilder.CreateCylinder(`${name}_chin`, {
            height: size * 0.25,
            diameterTop: size * 0.3,
            diameterBottom: 0,
            tessellation: 4  // Diamond shape
        }, this.scene);
        chin.position.y = -size * 0.55;
        chin.parent = faceGroup;

        // === CRANIAL RIDGES - Geometric patterns suggesting neural paths ===
        const centralRidge = MeshBuilder.CreateBox(`${name}_centralRidge`, {
            width: size * 0.06,
            height: size * 0.5,
            depth: size * 0.04
        }, this.scene);
        centralRidge.position = new Vector3(0, size * 0.7, size * 0.1);
        centralRidge.parent = faceGroup;

        // Side ridges
        const leftCranialRidge = MeshBuilder.CreateBox(`${name}_leftCranialRidge`, {
            width: size * 0.04,
            height: size * 0.35,
            depth: size * 0.03
        }, this.scene);
        leftCranialRidge.position = new Vector3(-size * 0.2, size * 0.6, size * 0.15);
        leftCranialRidge.rotation.z = 0.3;
        leftCranialRidge.parent = faceGroup;

        const rightCranialRidge = MeshBuilder.CreateBox(`${name}_rightCranialRidge`, {
            width: size * 0.04,
            height: size * 0.35,
            depth: size * 0.03
        }, this.scene);
        rightCranialRidge.position = new Vector3(size * 0.2, size * 0.6, size * 0.15);
        rightCranialRidge.rotation.z = -0.3;
        rightCranialRidge.parent = faceGroup;

        return faceGroup;
    }

    /**
     * Apply materials to Korenthi face elements
     */
    private applyKorenthiFaceMaterials(face: AbstractMesh, ring: AbstractMesh): void {
        const cyanPrimary = new Color3(0.5, 0.9, 1.0);    // Light cyan - skin
        const cyanBright = new Color3(0.2, 1, 1);         // Bright cyan - glow elements
        const cyanGlow = new Color3(0, 0.6, 0.7);         // Emissive glow

        // Ring material - bright with strong glow
        const ringMaterial = this.materialManager.createCustomMaterial(
            'korenthiRingMat',
            cyanBright,
            {
                emissive: new Color3(0, 0.8, 0.9),
                specular: new Color3(0.5, 1, 1),
                roughness: 0.1
            }
        );
        ring.material = ringMaterial;

        // Apply materials to face children
        const children = face.getChildMeshes();
        children.forEach((child) => {
            const childName = child.name.toLowerCase();

            if (childName.includes('thirdeye') && !childName.includes('ring')) {
                // Third eye - brightest, most emissive (consciousness node)
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`,
                    new Color3(0.8, 1, 1),
                    {
                        emissive: new Color3(0.3, 0.9, 1),
                        specular: new Color3(1, 1, 1),
                        roughness: 0.05
                    }
                );
            } else if (childName.includes('eye')) {
                // Eyes - glowing, wise
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`,
                    new Color3(0.6, 1, 1),
                    {
                        emissive: new Color3(0.2, 0.7, 0.8),
                        specular: new Color3(0.8, 1, 1),
                        roughness: 0.1
                    }
                );
            } else if (childName.includes('ridge') || childName.includes('ring')) {
                // Ridges and rings - geometric accents
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`,
                    cyanBright,
                    {
                        emissive: new Color3(0, 0.5, 0.6),
                        specular: new Color3(0.4, 0.8, 0.8),
                        roughness: 0.2
                    }
                );
            } else {
                // Main face/cranium - softer, skin-like
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`,
                    cyanPrimary,
                    {
                        emissive: cyanGlow,
                        specular: new Color3(0.3, 0.6, 0.6),
                        roughness: 0.4
                    }
                );
            }
        });
    }

    /**
     * Apply Korenthi cyan neon materials - simplified version with just ring and face
     */
    private applySimpleKorenthiMaterials(ring: AbstractMesh, face: AbstractMesh): void {
        const cyanBright = new Color3(0.4, 1, 1);
        const cyanLight = new Color3(0.6, 1, 1);
        const cyanGlow = new Color3(0, 0.7, 0.8);

        // Outer ring - bright cyan with strong glow
        const ringMaterial = this.materialManager.createCustomMaterial(
            'korenthiRingSimple',
            cyanBright,
            {
                emissive: new Color3(cyanGlow.r * 1.5, cyanGlow.g * 1.5, cyanGlow.b * 1.5),
                specular: new Color3(0.5, 1, 1),
                roughness: 0.15
            }
        );
        ring.material = ringMaterial;

        // Face - light cyan with medium glow
        this.applyMaterialToChildren(face, 'korenthiFaceSimple', cyanLight, cyanGlow);
    }

    /**
     * Create a single glowing outer ring
     */
    private createGlowingOuterRing(name: string, diameter: number, thickness: number): Mesh {
        const ring = MeshBuilder.CreateTorus(name, {
            diameter: diameter,
            thickness: thickness,
            tessellation: 96
        }, this.scene);

        ring.scaling.y = 0.3; // Flatten slightly for depth

        return ring;
    }

    /**
     * Create detailed low-poly geometric face with triangular facets
     * Designed to look like an AI/consciousness representation
     */
    private createDetailedLowPolyFace(name: string, size: number): Mesh {
        const faceGroup = new Mesh(`${name}_group`, this.scene);

        // Create main head shape - elongated icosphere for geometric look
        const head = MeshBuilder.CreateIcoSphere(`${name}_head`, {
            radius: size * 0.55,
            subdivisions: 2,
            flat: true // Flat shading for low-poly look
        }, this.scene);
        head.scaling = new Vector3(0.85, 1.1, 0.7); // Narrower, taller, flatter
        head.parent = faceGroup;

        // Create forehead ridge (angular)
        const forehead = MeshBuilder.CreateBox(`${name}_forehead`, {
            width: size * 0.5,
            height: size * 0.15,
            depth: size * 0.1
        }, this.scene);
        forehead.position = new Vector3(0, size * 0.35, size * 0.25);
        forehead.rotation.x = 0.3;
        forehead.parent = faceGroup;

        // Create angular eye sockets (left)
        const leftEyeSocket = MeshBuilder.CreateBox(`${name}_leftEyeSocket`, {
            width: size * 0.18,
            height: size * 0.08,
            depth: size * 0.15
        }, this.scene);
        leftEyeSocket.position = new Vector3(-size * 0.18, size * 0.12, size * 0.32);
        leftEyeSocket.rotation.z = -0.15;
        leftEyeSocket.parent = faceGroup;

        // Create angular eye sockets (right)
        const rightEyeSocket = MeshBuilder.CreateBox(`${name}_rightEyeSocket`, {
            width: size * 0.18,
            height: size * 0.08,
            depth: size * 0.15
        }, this.scene);
        rightEyeSocket.position = new Vector3(size * 0.18, size * 0.12, size * 0.32);
        rightEyeSocket.rotation.z = 0.15;
        rightEyeSocket.parent = faceGroup;

        // Create nose bridge (triangular)
        const noseBridge = MeshBuilder.CreateCylinder(`${name}_noseBridge`, {
            height: size * 0.25,
            diameterTop: size * 0.06,
            diameterBottom: size * 0.12,
            tessellation: 3
        }, this.scene);
        noseBridge.position = new Vector3(0, 0, size * 0.35);
        noseBridge.rotation.x = Math.PI / 2;
        noseBridge.rotation.z = Math.PI / 6;
        noseBridge.parent = faceGroup;

        // Create chin (angular point)
        const chin = MeshBuilder.CreateCylinder(`${name}_chin`, {
            height: size * 0.2,
            diameterTop: size * 0.25,
            diameterBottom: 0,
            tessellation: 4
        }, this.scene);
        chin.position = new Vector3(0, -size * 0.45, size * 0.15);
        chin.rotation.x = -0.3;
        chin.parent = faceGroup;

        // Create cheekbones (angular planes)
        const leftCheek = MeshBuilder.CreateBox(`${name}_leftCheek`, {
            width: size * 0.15,
            height: size * 0.2,
            depth: size * 0.08
        }, this.scene);
        leftCheek.position = new Vector3(-size * 0.28, -size * 0.05, size * 0.28);
        leftCheek.rotation.y = 0.4;
        leftCheek.parent = faceGroup;

        const rightCheek = MeshBuilder.CreateBox(`${name}_rightCheek`, {
            width: size * 0.15,
            height: size * 0.2,
            depth: size * 0.08
        }, this.scene);
        rightCheek.position = new Vector3(size * 0.28, -size * 0.05, size * 0.28);
        rightCheek.rotation.y = -0.4;
        rightCheek.parent = faceGroup;

        // Create neck/collar base
        const neck = MeshBuilder.CreateCylinder(`${name}_neck`, {
            height: size * 0.3,
            diameterTop: size * 0.35,
            diameterBottom: size * 0.5,
            tessellation: 6
        }, this.scene);
        neck.position = new Vector3(0, -size * 0.65, 0);
        neck.parent = faceGroup;

        return faceGroup;
    }

    /**
     * Create circuit board style rays with right-angle bends and endpoint circles
     */
    private createCircuitBoardRays(name: string, maxLength: number): Mesh {
        const raysGroup = new Mesh(`${name}_group`, this.scene);

        // Define circuit ray patterns (angle, segments with bends)
        const rayPatterns = [
            // Top rays
            { angle: Math.PI / 2, segments: [{ len: 0.8, bend: 'up' }, { len: 0.6, bend: 'none' }], hasArrow: true },
            { angle: Math.PI / 2 + 0.3, segments: [{ len: 1.0, bend: 'none' }], hasArrow: false },
            { angle: Math.PI / 2 - 0.3, segments: [{ len: 1.0, bend: 'none' }], hasArrow: false },
            // Upper diagonal rays
            { angle: Math.PI / 4, segments: [{ len: 1.2, bend: 'right' }, { len: 0.4, bend: 'none' }], hasArrow: false },
            { angle: 3 * Math.PI / 4, segments: [{ len: 1.2, bend: 'left' }, { len: 0.4, bend: 'none' }], hasArrow: false },
            // Side rays
            { angle: 0, segments: [{ len: 1.5, bend: 'none' }], hasArrow: false },
            { angle: Math.PI, segments: [{ len: 1.5, bend: 'none' }], hasArrow: false },
            { angle: 0.2, segments: [{ len: 1.0, bend: 'up' }, { len: 0.5, bend: 'none' }], hasArrow: false },
            { angle: Math.PI - 0.2, segments: [{ len: 1.0, bend: 'up' }, { len: 0.5, bend: 'none' }], hasArrow: false },
            // Lower diagonal rays
            { angle: -Math.PI / 4, segments: [{ len: 1.1, bend: 'right' }, { len: 0.3, bend: 'none' }], hasArrow: false },
            { angle: -3 * Math.PI / 4, segments: [{ len: 1.1, bend: 'left' }, { len: 0.3, bend: 'none' }], hasArrow: false },
            // Bottom rays
            { angle: -Math.PI / 2, segments: [{ len: 0.9, bend: 'none' }], hasArrow: false },
            { angle: -Math.PI / 2 + 0.25, segments: [{ len: 0.7, bend: 'down' }, { len: 0.4, bend: 'none' }], hasArrow: false },
            { angle: -Math.PI / 2 - 0.25, segments: [{ len: 0.7, bend: 'down' }, { len: 0.4, bend: 'none' }], hasArrow: false },
        ];

        rayPatterns.forEach((pattern, i) => {
            const rayMesh = this.createSingleCircuitRay(
                `${name}_ray_${i}`,
                pattern.angle,
                pattern.segments,
                maxLength,
                pattern.hasArrow
            );
            rayMesh.parent = raysGroup;
        });

        return raysGroup;
    }

    /**
     * Create a single circuit ray with optional bends
     */
    private createSingleCircuitRay(
        name: string,
        angle: number,
        segments: { len: number; bend: string }[],
        maxLength: number,
        hasArrow: boolean
    ): Mesh {
        const rayGroup = new Mesh(`${name}_group`, this.scene);
        const lineThickness = 0.04;
        const startRadius = 1.0; // Start from edge of face

        let currentX = Math.cos(angle) * startRadius;
        let currentZ = Math.sin(angle) * startRadius;
        let currentAngle = angle;

        segments.forEach((seg, segIndex) => {
            const segmentLength = seg.len * maxLength * 0.4;

            // Create line segment
            const line = MeshBuilder.CreateBox(`${name}_seg_${segIndex}`, {
                width: lineThickness,
                height: lineThickness,
                depth: segmentLength
            }, this.scene);

            // Position at midpoint of segment
            const midX = currentX + Math.cos(currentAngle) * segmentLength / 2;
            const midZ = currentZ + Math.sin(currentAngle) * segmentLength / 2;
            line.position = new Vector3(midX, 0, midZ);
            line.rotation.y = -currentAngle + Math.PI / 2;
            line.parent = rayGroup;

            // Update current position
            currentX += Math.cos(currentAngle) * segmentLength;
            currentZ += Math.sin(currentAngle) * segmentLength;

            // Add bend joint if not the last segment
            if (segIndex < segments.length - 1 && seg.bend !== 'none') {
                const joint = MeshBuilder.CreateBox(`${name}_joint_${segIndex}`, {
                    width: lineThickness * 2,
                    height: lineThickness * 2,
                    depth: lineThickness * 2
                }, this.scene);
                joint.position = new Vector3(currentX, 0, currentZ);
                joint.parent = rayGroup;

                // Adjust angle based on bend direction
                if (seg.bend === 'up') currentAngle += Math.PI / 4;
                else if (seg.bend === 'down') currentAngle -= Math.PI / 4;
                else if (seg.bend === 'left') currentAngle += Math.PI / 2;
                else if (seg.bend === 'right') currentAngle -= Math.PI / 2;
            }
        });

        // Add endpoint circle
        const endpoint = MeshBuilder.CreateSphere(`${name}_endpoint`, {
            diameter: 0.12,
            segments: 8
        }, this.scene);
        endpoint.position = new Vector3(currentX, 0, currentZ);
        endpoint.parent = rayGroup;

        // Add arrow tip if specified
        if (hasArrow) {
            const arrow = MeshBuilder.CreateCylinder(`${name}_arrow`, {
                height: 0.15,
                diameterTop: 0,
                diameterBottom: 0.12,
                tessellation: 3
            }, this.scene);
            arrow.position = new Vector3(currentX, 0, currentZ + 0.1);
            arrow.rotation.x = Math.PI / 2;
            arrow.parent = rayGroup;
        }

        return rayGroup;
    }

    /**
     * Create hexagonal cluster (group of hexagons)
     */
    private createHexagonalCluster(name: string, centerX: number, centerZ: number, count: number): Mesh {
        const clusterGroup = new Mesh(`${name}_group`, this.scene);

        // Create honeycomb-like pattern
        const hexSize = 0.18;
        const spacing = hexSize * 1.8;

        // Offset positions for honeycomb pattern
        const positions = [
            { x: 0, z: 0 },
            { x: spacing * 0.866, z: spacing * 0.5 },
            { x: spacing * 0.866, z: -spacing * 0.5 },
            { x: 0, z: spacing },
            { x: 0, z: -spacing },
            { x: -spacing * 0.5, z: spacing * 0.75 },
            { x: -spacing * 0.5, z: -spacing * 0.75 },
            { x: spacing * 0.866 * 2, z: 0 },
        ];

        for (let i = 0; i < Math.min(count, positions.length); i++) {
            const hex = MeshBuilder.CreateCylinder(`${name}_hex_${i}`, {
                height: 0.06,
                diameter: hexSize * (0.8 + Math.random() * 0.4),
                tessellation: 6
            }, this.scene);

            hex.position = new Vector3(
                centerX + positions[i].x,
                0,
                centerZ + positions[i].z
            );
            hex.parent = clusterGroup;
        }

        return clusterGroup;
    }

    /**
     * Create cityscape-style vertical bars at the top
     */
    private createCityscapeBars(name: string, centerX: number, centerZ: number, barCount: number): Mesh {
        const cityGroup = new Mesh(`${name}_group`, this.scene);

        const barWidth = 0.08;
        const spacing = 0.15;
        const startX = centerX - (barCount - 1) * spacing / 2;

        // Heights that create a cityscape silhouette (taller in middle)
        const heights = [0.4, 0.6, 0.9, 1.2, 1.5, 1.2, 0.9, 0.6, 0.4];

        for (let i = 0; i < barCount; i++) {
            const height = heights[i] || 0.5;

            const bar = MeshBuilder.CreateBox(`${name}_bar_${i}`, {
                width: barWidth,
                height: height,
                depth: barWidth
            }, this.scene);

            bar.position = new Vector3(
                startX + i * spacing,
                height / 2,
                centerZ
            );
            bar.parent = cityGroup;

            // Add small top cap to some bars
            if (Math.random() > 0.5) {
                const cap = MeshBuilder.CreateBox(`${name}_cap_${i}`, {
                    width: barWidth * 1.3,
                    height: 0.04,
                    depth: barWidth * 1.3
                }, this.scene);
                cap.position = new Vector3(
                    startX + i * spacing,
                    height + 0.02,
                    centerZ
                );
                cap.parent = cityGroup;
            }
        }

        return cityGroup;
    }

    /**
     * Apply Korenthi cyan neon materials to all emblem elements (V2)
     */
    private applyKorenthiMaterialsV2(
        ring: AbstractMesh,
        face: AbstractMesh,
        rays: AbstractMesh,
        leftHex: AbstractMesh,
        rightHex: AbstractMesh,
        cityscape: AbstractMesh
    ): void {
        const cyanBright = new Color3(0.4, 1, 1); // Bright cyan
        const cyanMid = new Color3(0.2, 0.85, 0.9); // Medium cyan
        const cyanLight = new Color3(0.6, 1, 1); // Light cyan for face
        const cyanGlow = new Color3(0, 0.7, 0.8); // Cyan glow/emissive

        // Outer ring - bright cyan with strong glow
        const ringMaterial = this.materialManager.createCustomMaterial(
            'korenthiRingV2',
            cyanBright,
            {
                emissive: new Color3(cyanGlow.r * 1.5, cyanGlow.g * 1.5, cyanGlow.b * 1.5),
                specular: new Color3(0.5, 1, 1),
                roughness: 0.15
            }
        );
        ring.material = ringMaterial;

        // Face - light cyan with medium glow
        this.applyMaterialToChildren(face, 'korenthiFaceV2', cyanLight, cyanGlow);

        // Circuit rays - bright cyan with strong glow
        this.applyMaterialToChildren(rays, 'korenthiRayV2', cyanBright, new Color3(cyanGlow.r * 1.3, cyanGlow.g * 1.3, cyanGlow.b * 1.3));

        // Hexagon clusters - medium cyan
        this.applyMaterialToChildren(leftHex, 'korenthiHexLeftV2', cyanMid, cyanGlow);
        this.applyMaterialToChildren(rightHex, 'korenthiHexRightV2', cyanMid, cyanGlow);

        // Cityscape bars - bright cyan with intense glow
        this.applyMaterialToChildren(cityscape, 'korenthiCityV2', cyanBright, new Color3(cyanGlow.r * 1.4, cyanGlow.g * 1.4, cyanGlow.b * 1.4));
    }

    /**
     * Create concentric ring for outer border
     */
    private createConcentricRing(name: string, diameter: number, thickness: number): Mesh {
        const ring = MeshBuilder.CreateTorus(name, {
            diameter: diameter,
            thickness: thickness,
            tessellation: 64
        }, this.scene);

        ring.scaling.y = 0.1; // Flatten the ring
        
        return ring;
    }

    /**
     * Create low-poly geometric face at center
     */
    private createLowPolyFace(name: string, size: number): Mesh {
        const faceGroup = new Mesh(`${name}_group`, this.scene);

        // Create head as low-poly sphere (icosphere style)
        const head = MeshBuilder.CreateIcoSphere(`${name}_head`, {
            radius: size * 0.5,
            subdivisions: 2, // Low poly
            flat: true // Flat shading for geometric look
        }, this.scene);
        head.scaling.y = 1.2; // Elongate slightly
        head.parent = faceGroup;

        // Create angular eyes (triangular indents)
        const leftEye = MeshBuilder.CreateBox(`${name}_leftEye`, {
            width: size * 0.15,
            height: size * 0.08,
            depth: size * 0.1
        }, this.scene);
        leftEye.position = new Vector3(-size * 0.15, size * 0.1, size * 0.4);
        leftEye.rotation.x = -0.2;
        leftEye.parent = faceGroup;

        const rightEye = MeshBuilder.CreateBox(`${name}_rightEye`, {
            width: size * 0.15,
            height: size * 0.08,
            depth: size * 0.1
        }, this.scene);
        rightEye.position = new Vector3(size * 0.15, size * 0.1, size * 0.4);
        rightEye.rotation.x = -0.2;
        rightEye.parent = faceGroup;

        // Create angular nose (pyramid)
        const nose = MeshBuilder.CreateCylinder(`${name}_nose`, {
            height: size * 0.2,
            diameterTop: 0,
            diameterBottom: size * 0.12,
            tessellation: 3
        }, this.scene);
        nose.position = new Vector3(0, -size * 0.05, size * 0.45);
        nose.rotation.x = Math.PI / 2;
        nose.parent = faceGroup;

        // Create geometric neck/collar
        const neck = MeshBuilder.CreateCylinder(`${name}_neck`, {
            height: size * 0.4,
            diameterTop: size * 0.4,
            diameterBottom: size * 0.5,
            tessellation: 6
        }, this.scene);
        neck.position.y = -size * 0.5;
        neck.parent = faceGroup;

        return faceGroup;
    }

    /**
     * Create circuit-like rays emanating from center
     */
    private createCircuitRays(name: string, length: number, rayCount: number): Mesh {
        const raysGroup = new Mesh(`${name}_group`, this.scene);

        for (let i = 0; i < rayCount; i++) {
            const angle = (i * 2 * Math.PI) / rayCount;
            
            // Create ray as thin line with segments
            const rayLength = length * (0.7 + Math.random() * 0.3); // Vary length
            const segments = Math.floor(2 + Math.random() * 3); // 2-4 segments
            
            // Create main ray line
            const ray = MeshBuilder.CreateBox(`${name}_${i}`, {
                width: 0.05,
                height: 0.05,
                depth: rayLength
            }, this.scene);

            // Position and orient ray
            const x = Math.cos(angle) * (rayLength / 2 + 0.8);
            const z = Math.sin(angle) * (rayLength / 2 + 0.8);
            ray.position = new Vector3(x, 0, z);
            ray.rotation.y = angle;

            ray.parent = raysGroup;

            // Add circuit-like segments/joints
            for (let j = 1; j < segments; j++) {
                const segmentPos = (j / segments) * rayLength - rayLength / 2;
                const joint = MeshBuilder.CreateBox(`${name}_${i}_joint_${j}`, {
                    width: 0.12,
                    height: 0.12,
                    depth: 0.12
                }, this.scene);
                
                joint.position = new Vector3(
                    Math.cos(angle) * (segmentPos + rayLength / 2 + 0.8),
                    0,
                    Math.sin(angle) * (segmentPos + rayLength / 2 + 0.8)
                );
                joint.parent = raysGroup;
            }

            // Add decorative elements at ray ends
            if (Math.random() > 0.5) {
                const endShape = Math.random() > 0.5 ? 'diamond' : 'circle';
                let endElement: Mesh;
                
                if (endShape === 'diamond') {
                    endElement = MeshBuilder.CreateCylinder(`${name}_${i}_end`, {
                        height: 0.05,
                        diameterTop: 0,
                        diameterBottom: 0.25,
                        tessellation: 4
                    }, this.scene);
                } else {
                    endElement = MeshBuilder.CreateSphere(`${name}_${i}_end`, {
                        diameter: 0.2,
                        segments: 8
                    }, this.scene);
                }
                
                endElement.position = new Vector3(
                    Math.cos(angle) * (rayLength + 0.8),
                    0,
                    Math.sin(angle) * (rayLength + 0.8)
                );
                endElement.parent = raysGroup;
            }
        }

        return raysGroup;
    }

    /**
     * Create scattered hexagonal elements
     */
    private createScatteredHexagons(name: string, radius: number, count: number): Mesh {
        const hexagonsGroup = new Mesh(`${name}_group`, this.scene);

        for (let i = 0; i < count; i++) {
            const angle = (i * 2 * Math.PI) / count;
            const distance = radius * (0.6 + Math.random() * 0.4);
            
            // Create hexagon
            const hexagon = MeshBuilder.CreateCylinder(`${name}_${i}`, {
                height: 0.1,
                diameter: 0.3 + Math.random() * 0.2,
                tessellation: 6
            }, this.scene);

            // Position hexagon
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            hexagon.position = new Vector3(x, 0, z);
            hexagon.rotation.y = Math.random() * Math.PI;

            hexagon.parent = hexagonsGroup;
        }

        return hexagonsGroup;
    }

    /**
     * Create connection nodes on circuit rays
     */
    private createConnectionNodes(name: string, radius: number, count: number): Mesh {
        const nodesGroup = new Mesh(`${name}_group`, this.scene);

        for (let i = 0; i < count; i++) {
            const angle = (i * 2 * Math.PI) / count;
            
            // Create node as small sphere
            const node = MeshBuilder.CreateSphere(`${name}_${i}`, {
                diameter: 0.15,
                segments: 8
            }, this.scene);

            // Position node on circle
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            node.position = new Vector3(x, 0, z);

            node.parent = nodesGroup;
        }

        return nodesGroup;
    }

    /**
     * Apply Korenthi cyan neon materials to all emblem elements
     */
    private applyKorenthiMaterials(
        ring1: AbstractMesh,
        ring2: AbstractMesh,
        face: AbstractMesh,
        rays: AbstractMesh,
        hexagons: AbstractMesh,
        nodes: AbstractMesh
    ): void {
        const cyanColor = new Color3(0, 1, 1); // Bright cyan
        const darkCyan = new Color3(0, 0.7, 0.9); // Darker cyan
        const lightCyan = new Color3(0.5, 1, 1); // Light cyan
        const cyanGlow = new Color3(0, 0.6, 0.7); // Cyan glow

        // Outer rings - bright cyan with strong glow
        const ringMaterial = this.materialManager.createCustomMaterial(
            'korenthiRing',
            cyanColor,
            {
                emissive: new Color3(cyanGlow.r * 1.2, cyanGlow.g * 1.2, cyanGlow.b * 1.2),
                specular: new Color3(0.4, 1, 1),
                roughness: 0.2
            }
        );
        ring1.material = ringMaterial;
        ring2.material = ringMaterial;

        // Face - light cyan with medium glow
        this.applyMaterialToChildren(face, 'korenthiFace', lightCyan, cyanGlow);

        // Circuit rays - cyan with strong glow
        this.applyMaterialToChildren(rays, 'korenthiRay', cyanColor, new Color3(cyanGlow.r * 1.5, cyanGlow.g * 1.5, cyanGlow.b * 1.5));

        // Hexagons - darker cyan with subtle glow
        this.applyMaterialToChildren(hexagons, 'korenthiHex', darkCyan, new Color3(cyanGlow.r * 0.7, cyanGlow.g * 0.7, cyanGlow.b * 0.7));

        // Nodes - bright cyan with intense glow
        this.applyMaterialToChildren(nodes, 'korenthiNode', cyanColor, new Color3(cyanGlow.r * 2, cyanGlow.g * 2, cyanGlow.b * 2));
    }

    /**
     * Create Energy Lords emblem with octagonal base and energy-themed elements
     * Requirements: 9.2, 9.3 - Energy Lords emblem with cyan/gold neon effects
     */
    public createEnergyLordsEmblem(): AbstractMesh {
        // Create container for the atom model
        const atom = new Mesh('energyLordsAtom', this.scene);

        // Materials
        // Nucleus - glowing red
        const nucleusMaterial = new StandardMaterial('nucleusMat', this.scene);
        nucleusMaterial.diffuseColor = new Color3(1, 0.2, 0.1);
        nucleusMaterial.emissiveColor = new Color3(0.8, 0.1, 0.05);
        nucleusMaterial.specularColor = new Color3(0.5, 0.2, 0.1);
        nucleusMaterial.specularPower = 64;

        // Orbital rings - dark grey (matte)
        const orbitalMaterial = new StandardMaterial('orbitalMat', this.scene);
        orbitalMaterial.diffuseColor = new Color3(0.15, 0.15, 0.15);
        orbitalMaterial.emissiveColor = new Color3(0.05, 0.05, 0.05);
        orbitalMaterial.specularColor = new Color3(0, 0, 0);

        // Central nucleus
        const nucleus = MeshBuilder.CreateSphere('nucleus', {
            diameter: 0.4,
            segments: 16
        }, this.scene);
        nucleus.material = nucleusMaterial;
        nucleus.parent = atom;

        // Fading red glow - multiple concentric spheres with decreasing opacity
        // Use pure emissive (no diffuse) to avoid lighting-based color shifts
        const glowLayers = 5;
        for (let i = 1; i <= glowLayers; i++) {
            const layerMaterial = new StandardMaterial(`glowLayer${i}Mat`, this.scene);
            layerMaterial.diffuseColor = new Color3(0, 0, 0); // No diffuse - pure glow
            layerMaterial.emissiveColor = new Color3(1, 0.1, 0.05); // Pure red glow
            layerMaterial.alpha = 0.4 - (i * 0.07); // Fades from 0.33 to 0.05
            layerMaterial.backFaceCulling = false;
            layerMaterial.specularColor = new Color3(0, 0, 0);
            layerMaterial.disableLighting = true; // Ignore scene lights

            const glowSphere = MeshBuilder.CreateSphere(`glowLayer${i}`, {
                diameter: 0.4 + (i * 0.2), // Grows outward
                segments: 12
            }, this.scene);
            glowSphere.material = layerMaterial;
            glowSphere.parent = atom;
        }

        // 3 orbital rings at different angles
        const orbitRadius = 1.8;
        const orbitTubeThickness = 0.04; // Thin rings

        // All rings meet at Y axis and rotate around Y axis
        // Torus default: hole faces Y, ring lies on XZ plane

        // Ring 1 - flat on XZ plane (no rotation)
        const orbit0 = MeshBuilder.CreateTorus('orbit_0', {
            diameter: orbitRadius * 2,
            thickness: orbitTubeThickness,
            tessellation: 48
        }, this.scene);
        orbit0.material = orbitalMaterial;
        orbit0.parent = atom;

        // Ring 2 - tilted 60° around Z axis
        const orbit1 = MeshBuilder.CreateTorus('orbit_1', {
            diameter: orbitRadius * 2,
            thickness: orbitTubeThickness,
            tessellation: 48
        }, this.scene);
        orbit1.rotation.z = Math.PI / 3; // 60°
        orbit1.material = orbitalMaterial;
        orbit1.parent = atom;

        // Ring 3 - tilted -60° around Z axis
        const orbit2 = MeshBuilder.CreateTorus('orbit_2', {
            diameter: orbitRadius * 2,
            thickness: orbitTubeThickness,
            tessellation: 48
        }, this.scene);
        orbit2.rotation.z = -Math.PI / 3; // -60°
        orbit2.material = orbitalMaterial;
        orbit2.parent = atom;

        // Rotate whole atom so rings are perpendicular to Z axis (facing camera)
        atom.rotation.x = Math.PI / 2;

        // Mark to skip LOD (prevents cloning issues)
        (atom as any).skipLOD = true;

        return atom;
    }

    /**
     * Create Biohazard Warning Sign
     * Used for "The Challenge" pages to represent the hostile/toxic environment
     * Building step by step
     */
    public createRadiationSign(): AbstractMesh {
        // Create container
        const biohazardSign = new Mesh('biohazardSign', this.scene);

        // Yellow material - matte finish
        const yellowMaterial = new StandardMaterial('yellowMat', this.scene);
        yellowMaterial.diffuseColor = new Color3(1, 0.85, 0);
        yellowMaterial.emissiveColor = new Color3(0.3, 0.25, 0);
        yellowMaterial.specularColor = new Color3(0, 0, 0); // No specular for matte
        yellowMaterial.specularPower = 0;
        yellowMaterial.backFaceCulling = false;

        // Flat ring using torus - 50% bigger, keeping ring thickness same
        // Torus: diameter is the ring's center circle, thickness is the tube diameter
        const ring = MeshBuilder.CreateTorus('ring', {
            diameter: 3.75,     // 50% bigger (2.5 * 1.5)
            thickness: 0.5,     // Tube thickness (same)
            tessellation: 48
        }, this.scene);
        ring.rotation.x = Math.PI / 2; // Rotate to face Z axis
        ring.scaling.y = 0.2;          // Flatten the torus to make it look like a flat ring
        ring.material = yellowMaterial;
        ring.parent = biohazardSign;

        // Small hollow ring in the center
        const centerRing = MeshBuilder.CreateTorus('centerRing', {
            diameter: 0.6,
            thickness: 0.15,
            tessellation: 32
        }, this.scene);
        centerRing.rotation.x = Math.PI / 2; // Rotate to face Z axis
        centerRing.scaling.y = 0.2; // Flatten like the outer ring
        centerRing.material = yellowMaterial;
        centerRing.parent = biohazardSign;

        // 3 arcs at 120 degree intervals - extending from center circle to outer ring
        const innerRadius = 0.35; // Just outside center circle (0.6 diameter = 0.3 radius)
        const outerRadius = 1.75; // Extends to touch outer ring (3.75 diameter, 0.5 thickness)
        const arcRadius = (innerRadius + outerRadius) / 2; // Middle of arc path
        const arcTubeRadius = (outerRadius - innerRadius) / 2; // Tube spans from inner to outer
        const arcSpan = Math.PI * 0.3; // Arc spans about 54 degrees (50% reduced)

        for (let i = 0; i < 3; i++) {
            const startAngle = (i * 2 * Math.PI) / 3 - arcSpan / 2 - Math.PI / 6; // 30° clockwise

            // Create arc path
            const arcPath: Vector3[] = [];
            const segments = 20;
            for (let j = 0; j <= segments; j++) {
                const angle = startAngle + (j / segments) * arcSpan;
                arcPath.push(new Vector3(
                    Math.cos(angle) * arcRadius,
                    0,
                    Math.sin(angle) * arcRadius
                ));
            }

            const arc = MeshBuilder.CreateTube(`arc_${i}`, {
                path: arcPath,
                radius: arcTubeRadius,
                tessellation: 16,
                cap: Mesh.CAP_ALL
            }, this.scene);
            arc.rotation.x = Math.PI / 2; // Face Z axis
            arc.scaling.y = 0.15; // Flatten to match ring thickness
            arc.material = yellowMaterial;
            arc.parent = biohazardSign;
        }

        // Add pulsing animation
        this.addPulsingAnimation(biohazardSign, 1.0);

        return biohazardSign;
    }

    /**
     * Create polygonal base shape (hexagon or octagon)
     * Requirements: 9.5 - Geometric shape creation using Babylon.js primitives
     */
    private createPolygonalBase(name: string, config: EmblemConfig): Mesh {
        // Create polygon using cylinder with specified segments
        const base = MeshBuilder.CreateCylinder(name, {
            height: config.height,
            diameterTop: config.size,
            diameterBottom: config.size,
            tessellation: config.segments,
            subdivisions: 1
        }, this.scene);

        return base;
    }

    /**
     * Create inner ring element
     */
    private createInnerRing(name: string, diameter: number, height: number): Mesh {
        // Create ring using torus
        const ring = MeshBuilder.CreateTorus(name, {
            diameter: diameter,
            thickness: diameter * 0.1,
            tessellation: 16
        }, this.scene);

        // Flatten the ring
        ring.scaling.y = height / (diameter * 0.1);
        
        return ring;
    }

    /**
     * Create central cross element for Empire emblem
     */
    private createCentralCross(name: string, size: number, height: number): Mesh {
        // Create cross using two intersecting boxes
        const horizontalBar = MeshBuilder.CreateBox(`${name}_horizontal`, {
            width: size,
            height: height,
            depth: size * 0.2
        }, this.scene);

        const verticalBar = MeshBuilder.CreateBox(`${name}_vertical`, {
            width: size * 0.2,
            height: height,
            depth: size
        }, this.scene);

        // Combine using CSG for clean intersection
        const horizontalCSG = CSG.FromMesh(horizontalBar);
        const verticalCSG = CSG.FromMesh(verticalBar);
        const crossCSG = horizontalCSG.union(verticalCSG);
        
        const cross = crossCSG.toMesh(`${name}_combined`, horizontalBar.material, this.scene);
        
        // Clean up temporary meshes
        horizontalBar.dispose();
        verticalBar.dispose();

        return cross;
    }

    /**
     * Create corner triangles for Empire emblem
     */
    private createCornerTriangles(name: string, radius: number, height: number, sides: number): Mesh {
        const trianglesGroup = new Mesh(`${name}_group`, this.scene);

        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides;
            const triangle = MeshBuilder.CreateCylinder(`${name}_${i}`, {
                height: height,
                diameterTop: 0,
                diameterBottom: radius * 0.3,
                tessellation: 3
            }, this.scene);

            // Position triangle at corner
            const x = Math.cos(angle) * radius * 0.7;
            const z = Math.sin(angle) * radius * 0.7;
            triangle.position = new Vector3(x, 0, z);
            triangle.rotation.y = angle + Math.PI / 2;

            triangle.parent = trianglesGroup;
        }

        return trianglesGroup;
    }

    /**
     * Create energy core (central glowing sphere) for Energy Lords emblem
     */
    private createEnergyCore(name: string, diameter: number, height: number): Mesh {
        const core = MeshBuilder.CreateSphere(name, {
            diameter: diameter,
            segments: 16
        }, this.scene);

        // Slightly flatten to match emblem proportions
        core.scaling.y = height / diameter;

        return core;
    }

    /**
     * Create energy rays (star pattern) for Energy Lords emblem
     */
    private createEnergyRays(name: string, radius: number, height: number, rayCount: number): Mesh {
        const raysGroup = new Mesh(`${name}_group`, this.scene);

        for (let i = 0; i < rayCount; i++) {
            const angle = (i * 2 * Math.PI) / rayCount;
            
            // Create ray as elongated diamond
            const ray = MeshBuilder.CreateCylinder(`${name}_${i}`, {
                height: height,
                diameterTop: 0,
                diameterBottom: radius * 0.15,
                tessellation: 4 // Diamond shape
            }, this.scene);

            // Position and orient ray
            const x = Math.cos(angle) * radius * 0.5;
            const z = Math.sin(angle) * radius * 0.5;
            ray.position = new Vector3(x, 0, z);
            ray.rotation.y = angle;
            ray.scaling.z = 2.0; // Elongate the ray

            ray.parent = raysGroup;
        }

        return raysGroup;
    }

    /**
     * Create outer ring with energy nodes for Energy Lords emblem
     */
    private createEnergyNodesRing(name: string, radius: number, height: number, nodeCount: number): Mesh {
        const nodesGroup = new Mesh(`${name}_group`, this.scene);

        for (let i = 0; i < nodeCount; i++) {
            const angle = (i * 2 * Math.PI) / nodeCount;
            
            // Create energy node as small glowing sphere
            const node = MeshBuilder.CreateSphere(`${name}_node_${i}`, {
                diameter: radius * 0.1,
                segments: 8
            }, this.scene);

            // Position node on ring
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            node.position = new Vector3(x, 0, z);

            node.parent = nodesGroup;
        }

        return nodesGroup;
    }

    /**
     * Apply Empire neon materials with cyan glow effects
     * Requirements: 9.5 - Neon glow material system using existing MaterialManager
     */
    private applyEmpireNeonMaterials(
        base: AbstractMesh, 
        ring: AbstractMesh, 
        cross: AbstractMesh, 
        triangles: AbstractMesh
    ): void {
        // Empire primary color: Cyan
        const primaryColor = new Color3(0, 1, 1); // Cyan
        const secondaryColor = new Color3(0, 0.7, 0.9); // Darker cyan
        const glowColor = new Color3(0, 0.5, 0.6); // Cyan glow

        // Base material - primary cyan with strong glow
        const baseMaterial = this.materialManager.createCustomMaterial(
            'empireEmblemBase',
            primaryColor,
            {
                emissive: glowColor,
                specular: new Color3(0.3, 0.8, 0.8),
                roughness: 0.3
            }
        );
        base.material = baseMaterial;

        // Ring material - secondary cyan with medium glow
        const ringMaterial = this.materialManager.createCustomMaterial(
            'empireEmblemRing',
            secondaryColor,
            {
                emissive: new Color3(glowColor.r * 0.7, glowColor.g * 0.7, glowColor.b * 0.7),
                specular: new Color3(0.2, 0.6, 0.6),
                roughness: 0.4
            }
        );
        ring.material = ringMaterial;

        // Cross material - bright cyan with intense glow
        const crossMaterial = this.materialManager.createCustomMaterial(
            'empireEmblemCross',
            new Color3(0.2, 1, 1), // Brighter cyan
            {
                emissive: new Color3(glowColor.r * 1.2, glowColor.g * 1.2, glowColor.b * 1.2),
                specular: new Color3(0.4, 1, 1),
                roughness: 0.2
            }
        );
        cross.material = crossMaterial;

        // Triangle materials - alternating cyan shades
        this.applyMaterialToChildren(triangles, 'empireEmblemTriangle', secondaryColor, glowColor);
    }

    /**
     * Apply Energy Lords neon materials with cyan/gold dual-color effects
     * Requirements: 9.5 - Neon glow material system with dual colors
     */
    private applyEnergyLordsNeonMaterials(
        base: AbstractMesh,
        core: AbstractMesh,
        rays: AbstractMesh,
        nodes: AbstractMesh
    ): void {
        // Energy Lords colors: Dark emerald theme (consistent with Empire emblem)
        const darkEmerald = new Color3(0.02, 0.12, 0.06);
        const emeraldGlow = new Color3(0.01, 0.04, 0.02);
        const cyanAccent = new Color3(0, 0.6, 0.6); // Subtle cyan accent
        const cyanGlow = new Color3(0, 0.3, 0.35);

        // Base material - dark emerald foundation
        const baseMaterial = this.materialManager.createCustomMaterial(
            'energyLordsEmblemBase',
            darkEmerald,
            {
                emissive: emeraldGlow,
                specular: new Color3(0.05, 0.2, 0.1),
                roughness: 0.3
            }
        );
        base.material = baseMaterial;

        // Core material - cyan energy center
        const coreMaterial = this.materialManager.createCustomMaterial(
            'energyLordsEmblemCore',
            cyanAccent,
            {
                emissive: new Color3(cyanGlow.r * 1.5, cyanGlow.g * 1.5, cyanGlow.b * 1.5),
                specular: new Color3(0.2, 0.6, 0.6),
                roughness: 0.1
            }
        );
        core.material = coreMaterial;

        // Rays material - dark emerald energy beams
        this.applyMaterialToChildren(rays, 'energyLordsEmblemRay', darkEmerald, emeraldGlow);

        // Nodes material - cyan energy points
        this.applyMaterialToChildren(nodes, 'energyLordsEmblemNode', cyanAccent, cyanGlow);
    }

    /**
     * Apply material to all child meshes
     */
    private applyMaterialToChildren(
        parent: AbstractMesh, 
        materialBaseName: string, 
        color: Color3, 
        glowColor: Color3
    ): void {
        const children = parent.getChildMeshes();
        
        children.forEach((child, index) => {
            const material = this.materialManager.createCustomMaterial(
                `${materialBaseName}_${index}`,
                color,
                {
                    emissive: glowColor,
                    specular: new Color3(color.r * 0.5, color.g * 0.5, color.b * 0.5),
                    roughness: 0.3
                }
            );
            child.material = material;
        });
    }

    /**
     * Add pulsing animation effects for emblems
     * Requirements: 9.3, 9.10 - Pulsing animation effects
     */
    public addPulsingAnimation(emblem: AbstractMesh, speed: number = 1.0): Animation {
        const pulseAnimation = new Animation(
            'emblemPulse',
            'scaling',
            30, // 30 FPS
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        // Create pulsing effect: scale from 1.0 to 1.15 and back
        const frameRate = 30;
        const cycleDuration = 2.0 / speed; // 2 seconds per cycle, adjusted by speed
        const totalFrames = frameRate * cycleDuration;

        const keys = [
            { 
                frame: 0, 
                value: new Vector3(1.0, 1.0, 1.0) 
            },
            { 
                frame: totalFrames * 0.5, 
                value: new Vector3(1.15, 1.15, 1.15) 
            },
            { 
                frame: totalFrames, 
                value: new Vector3(1.0, 1.0, 1.0) 
            }
        ];

        pulseAnimation.setKeys(keys);

        // Apply smooth easing for organic pulsing effect
        const easingFunction = new SineEase();
        easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        pulseAnimation.setEasingFunction(easingFunction);

        // Add animation to emblem
        emblem.animations.push(pulseAnimation);

        return pulseAnimation;
    }

    /**
     * Create a simple geometric emblem for testing or fallback
     * Requirements: 9.5 - Basic geometric shape creation
     */
    public createSimpleEmblem(name: string, shape: 'hexagon' | 'octagon' = 'hexagon'): AbstractMesh {
        const segments = shape === 'hexagon' ? 6 : 8;
        const config: EmblemConfig = {
            size: 2.0,
            height: 0.2,
            segments: segments,
            glowIntensity: 0.6,
            pulseSpeed: 1.0
        };

        const emblem = this.createPolygonalBase(name, config);
        
        // Apply simple cyan material
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

        // Add basic pulsing
        this.addPulsingAnimation(emblem, config.pulseSpeed);

        return emblem;
    }

    /**
     * Dispose of created materials and resources
     */
    public dispose(): void {
        // Materials are managed by MaterialManager, no additional cleanup needed
        console.log('EmblemGeometry disposed');
    }
}