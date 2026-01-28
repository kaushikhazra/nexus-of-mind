/**
 * EnergyLordsEmblem - Energy Lords emblem creation
 *
 * Contains methods for creating Energy Lords emblem and radiation sign.
 * Extracted from EmblemGeometry.ts for SOLID compliance.
 */

import { Scene, Mesh, Vector3, Color3, StandardMaterial, MeshBuilder } from '@babylonjs/core';
import { addPulsingAnimation } from './EmblemAnimations';

/**
 * EnergyLordsEmblemFactory - Creates Energy Lords emblem shapes
 */
export class EnergyLordsEmblemFactory {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Create Energy Lords emblem with octagonal base and energy-themed elements
     */
    public createEnergyLordsEmblem(): Mesh {
        const atom = new Mesh('energyLordsAtom', this.scene);

        // Nucleus material - glowing red
        const nucleusMaterial = new StandardMaterial('nucleusMat', this.scene);
        nucleusMaterial.diffuseColor = new Color3(1, 0.2, 0.1);
        nucleusMaterial.emissiveColor = new Color3(0.8, 0.1, 0.05);
        nucleusMaterial.specularColor = new Color3(0.5, 0.2, 0.1);
        nucleusMaterial.specularPower = 64;

        // Orbital rings material - dark grey (matte)
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

        // Fading red glow layers
        const glowLayers = 5;
        for (let i = 1; i <= glowLayers; i++) {
            const layerMaterial = new StandardMaterial(`glowLayer${i}Mat`, this.scene);
            layerMaterial.diffuseColor = new Color3(0, 0, 0);
            layerMaterial.emissiveColor = new Color3(1, 0.1, 0.05);
            layerMaterial.alpha = 0.4 - (i * 0.07);
            layerMaterial.backFaceCulling = false;
            layerMaterial.specularColor = new Color3(0, 0, 0);
            layerMaterial.disableLighting = true;

            const glowSphere = MeshBuilder.CreateSphere(`glowLayer${i}`, {
                diameter: 0.4 + (i * 0.2),
                segments: 12
            }, this.scene);
            glowSphere.material = layerMaterial;
            glowSphere.parent = atom;
        }

        // 3 orbital rings at different angles
        const orbitRadius = 1.8;
        const orbitTubeThickness = 0.04;

        // Ring 1 - flat on XZ plane
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
        orbit1.rotation.z = Math.PI / 3;
        orbit1.material = orbitalMaterial;
        orbit1.parent = atom;

        // Ring 3 - tilted -60° around Z axis
        const orbit2 = MeshBuilder.CreateTorus('orbit_2', {
            diameter: orbitRadius * 2,
            thickness: orbitTubeThickness,
            tessellation: 48
        }, this.scene);
        orbit2.rotation.z = -Math.PI / 3;
        orbit2.material = orbitalMaterial;
        orbit2.parent = atom;

        // Rotate whole atom so rings face camera
        atom.rotation.x = Math.PI / 2;

        // Mark to skip LOD
        (atom as any).skipLOD = true;

        return atom;
    }

    /**
     * Create Biohazard Warning Sign
     */
    public createRadiationSign(): Mesh {
        const biohazardSign = new Mesh('biohazardSign', this.scene);

        // Yellow material - matte finish
        const yellowMaterial = new StandardMaterial('yellowMat', this.scene);
        yellowMaterial.diffuseColor = new Color3(1, 0.85, 0);
        yellowMaterial.emissiveColor = new Color3(0.3, 0.25, 0);
        yellowMaterial.specularColor = new Color3(0, 0, 0);
        yellowMaterial.specularPower = 0;
        yellowMaterial.backFaceCulling = false;

        // Outer ring
        const ring = MeshBuilder.CreateTorus('ring', {
            diameter: 3.75,
            thickness: 0.5,
            tessellation: 48
        }, this.scene);
        ring.rotation.x = Math.PI / 2;
        ring.scaling.y = 0.2;
        ring.material = yellowMaterial;
        ring.parent = biohazardSign;

        // Center ring
        const centerRing = MeshBuilder.CreateTorus('centerRing', {
            diameter: 0.6,
            thickness: 0.15,
            tessellation: 32
        }, this.scene);
        centerRing.rotation.x = Math.PI / 2;
        centerRing.scaling.y = 0.2;
        centerRing.material = yellowMaterial;
        centerRing.parent = biohazardSign;

        // 3 arcs at 120 degree intervals
        const innerRadius = 0.35;
        const outerRadius = 1.75;
        const arcRadius = (innerRadius + outerRadius) / 2;
        const arcTubeRadius = (outerRadius - innerRadius) / 2;
        const arcSpan = Math.PI * 0.3;

        for (let i = 0; i < 3; i++) {
            const startAngle = (i * 2 * Math.PI) / 3 - arcSpan / 2 - Math.PI / 6;

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
            arc.rotation.x = Math.PI / 2;
            arc.scaling.y = 0.15;
            arc.material = yellowMaterial;
            arc.parent = biohazardSign;
        }

        // Add pulsing animation
        addPulsingAnimation(biohazardSign, 1.0);

        return biohazardSign;
    }
}
