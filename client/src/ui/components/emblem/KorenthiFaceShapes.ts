/**
 * KorenthiFaceShapes - Korenthi face and mask shape creation
 *
 * Contains methods for creating Korenthi alien face and mask shapes.
 * Extracted from EmblemGeometry.ts for SOLID compliance.
 */

import { Scene, Mesh, Vector3, MeshBuilder } from '@babylonjs/core';

/**
 * KorenthiFaceFactory - Creates Korenthi face and mask shapes
 */
export class KorenthiFaceFactory {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Create Korenthi mask emblem - angular geometric design
     */
    public createKorenthiMask(name: string, size: number): Mesh {
        const maskGroup = new Mesh(`${name}_group`, this.scene);

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

        // Upper head (crown area)
        const upperHead = MeshBuilder.CreateCylinder(`${name}_upperHead`, {
            height: size * 0.25,
            diameterTop: size * 0.85,
            diameterBottom: size * 1.0,
            tessellation: 6
        }, this.scene);
        upperHead.position.y = size * 0.5;
        upperHead.parent = maskGroup;

        // Lower face (chin area)
        const lowerFace = MeshBuilder.CreateCylinder(`${name}_lowerFace`, {
            height: size * 0.4,
            diameterTop: size * 0.7,
            diameterBottom: size * 0.3,
            tessellation: 6
        }, this.scene);
        lowerFace.position.y = -size * 0.45;
        lowerFace.parent = maskGroup;

        // Eyes - Horizontal slits
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

        // Central vertical ridge (T-shape)
        const centralRidgeVert = MeshBuilder.CreateBox(`${name}_centralRidgeV`, {
            width: size * 0.08,
            height: size * 0.5,
            depth: size * 0.12
        }, this.scene);
        centralRidgeVert.position = new Vector3(0, size * 0.1, size * 0.28);
        centralRidgeVert.parent = maskGroup;

        const centralRidgeHorz = MeshBuilder.CreateBox(`${name}_centralRidgeH`, {
            width: size * 0.35,
            height: size * 0.06,
            depth: size * 0.1
        }, this.scene);
        centralRidgeHorz.position = new Vector3(0, size * 0.38, size * 0.28);
        centralRidgeHorz.parent = maskGroup;

        // Horizontal band
        const horizBand = MeshBuilder.CreateBox(`${name}_horizBand`, {
            width: size * 0.75,
            height: size * 0.05,
            depth: size * 0.08
        }, this.scene);
        horizBand.position = new Vector3(0, -size * 0.05, size * 0.28);
        horizBand.parent = maskGroup;

        // Chin point
        const chinPoint = MeshBuilder.CreateCylinder(`${name}_chin`, {
            height: size * 0.2,
            diameterTop: size * 0.15,
            diameterBottom: 0,
            tessellation: 4
        }, this.scene);
        chinPoint.position.y = -size * 0.7;
        chinPoint.parent = maskGroup;

        // Back ridges
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

        // Diagonal side lines
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
     * Create a Korenthi face - an advanced alien species
     */
    public createKorenthiFace(name: string, size: number): Mesh {
        const faceGroup = new Mesh(`${name}_group`, this.scene);

        // Cranium - Elongated for advanced intelligence
        const cranium = MeshBuilder.CreateSphere(`${name}_cranium`, {
            diameter: size * 1.0,
            segments: 16
        }, this.scene);
        cranium.scaling = new Vector3(0.7, 1.3, 0.65);
        cranium.position.y = size * 0.4;
        cranium.parent = faceGroup;

        // Face plate - Smooth, geometric lower face
        const facePlate = MeshBuilder.CreateCylinder(`${name}_facePlate`, {
            height: size * 0.6,
            diameterTop: size * 0.65,
            diameterBottom: size * 0.35,
            tessellation: 6
        }, this.scene);
        facePlate.position.y = -size * 0.15;
        facePlate.parent = faceGroup;

        // Left eye
        const leftEye = MeshBuilder.CreateSphere(`${name}_leftEye`, {
            diameter: size * 0.22,
            segments: 12
        }, this.scene);
        leftEye.scaling = new Vector3(1.4, 0.6, 0.5);
        leftEye.position = new Vector3(-size * 0.22, size * 0.1, size * 0.28);
        leftEye.rotation.z = -0.2;
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

        // Third eye / Consciousness node
        const thirdEye = MeshBuilder.CreateSphere(`${name}_thirdEye`, {
            diameter: size * 0.15,
            segments: 12
        }, this.scene);
        thirdEye.position = new Vector3(0, size * 0.45, size * 0.35);
        thirdEye.parent = faceGroup;

        // Brow ridges
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

        // Nose
        const nose = MeshBuilder.CreateCylinder(`${name}_nose`, {
            height: size * 0.15,
            diameterTop: size * 0.06,
            diameterBottom: size * 0.1,
            tessellation: 3
        }, this.scene);
        nose.position = new Vector3(0, -size * 0.05, size * 0.32);
        nose.rotation.x = -0.3;
        nose.parent = faceGroup;

        // Chin
        const chin = MeshBuilder.CreateCylinder(`${name}_chin`, {
            height: size * 0.25,
            diameterTop: size * 0.3,
            diameterBottom: 0,
            tessellation: 4
        }, this.scene);
        chin.position.y = -size * 0.55;
        chin.parent = faceGroup;

        // Cranial ridges
        const centralRidge = MeshBuilder.CreateBox(`${name}_centralRidge`, {
            width: size * 0.06,
            height: size * 0.5,
            depth: size * 0.04
        }, this.scene);
        centralRidge.position = new Vector3(0, size * 0.7, size * 0.1);
        centralRidge.parent = faceGroup;

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
}
