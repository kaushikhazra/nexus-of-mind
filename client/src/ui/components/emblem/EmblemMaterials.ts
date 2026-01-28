/**
 * EmblemMaterials - Material application for emblems
 *
 * Handles creation and application of materials to emblem elements.
 * Extracted from EmblemGeometry.ts for SOLID compliance.
 */

import { Scene, AbstractMesh, Color3, StandardMaterial } from '@babylonjs/core';
import { MaterialManager } from '../../../rendering/MaterialManager';
import type { EmblemColorTheme, MaterialOptions } from './EmblemInterfaces';

/**
 * EmblemMaterialManager - Handles emblem material creation and application
 */
export class EmblemMaterialManager {
    private scene: Scene;
    private materialManager: MaterialManager;

    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;
    }

    /**
     * Apply material to all child meshes
     */
    public applyMaterialToChildren(
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
     * Apply Korenthi cyan neon materials to mask elements
     */
    public applyMaskMaterials(mask: AbstractMesh): void {
        const cyanBase = new Color3(0.3, 0.8, 0.9);
        const cyanBright = new Color3(0.5, 1, 1);
        const cyanGlow = new Color3(0, 0.5, 0.6);
        const cyanEyes = new Color3(0.7, 1, 1);

        const children = mask.getChildMeshes();
        children.forEach((child) => {
            const childName = child.name.toLowerCase();
            if (childName.includes('eye')) {
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`, cyanEyes,
                    { emissive: new Color3(0.4, 0.9, 1), specular: new Color3(1, 1, 1), roughness: 0.1 }
                );
            } else if (childName.includes('ridge') || childName.includes('diag')) {
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`, cyanBright,
                    { emissive: new Color3(0.2, 0.7, 0.8), specular: new Color3(0.6, 1, 1), roughness: 0.2 }
                );
            } else if (childName.includes('band') || childName.includes('centralridge')) {
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`, cyanBright,
                    { emissive: new Color3(0.15, 0.6, 0.7), specular: new Color3(0.5, 0.9, 0.9), roughness: 0.25 }
                );
            } else {
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`, cyanBase,
                    { emissive: cyanGlow, specular: new Color3(0.3, 0.6, 0.6), roughness: 0.4 }
                );
            }
        });
    }

    /**
     * Apply materials to Korenthi face elements
     */
    public applyKorenthiFaceMaterials(face: AbstractMesh, ring: AbstractMesh): void {
        const cyanPrimary = new Color3(0.5, 0.9, 1.0);
        const cyanBright = new Color3(0.2, 1, 1);
        const cyanGlow = new Color3(0, 0.6, 0.7);

        const ringMaterial = this.materialManager.createCustomMaterial(
            'korenthiRingMat', cyanBright,
            { emissive: new Color3(0, 0.8, 0.9), specular: new Color3(0.5, 1, 1), roughness: 0.1 }
        );
        ring.material = ringMaterial;

        const children = face.getChildMeshes();
        children.forEach((child) => {
            const childName = child.name.toLowerCase();
            if (childName.includes('thirdeye') && !childName.includes('ring')) {
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`, new Color3(0.8, 1, 1),
                    { emissive: new Color3(0.3, 0.9, 1), specular: new Color3(1, 1, 1), roughness: 0.05 }
                );
            } else if (childName.includes('eye')) {
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`, new Color3(0.6, 1, 1),
                    { emissive: new Color3(0.2, 0.7, 0.8), specular: new Color3(0.8, 1, 1), roughness: 0.1 }
                );
            } else if (childName.includes('ridge') || childName.includes('ring')) {
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`, cyanBright,
                    { emissive: new Color3(0, 0.5, 0.6), specular: new Color3(0.4, 0.8, 0.8), roughness: 0.2 }
                );
            } else {
                child.material = this.materialManager.createCustomMaterial(
                    `${child.name}_mat`, cyanPrimary,
                    { emissive: cyanGlow, specular: new Color3(0.3, 0.6, 0.6), roughness: 0.4 }
                );
            }
        });
    }

    /**
     * Apply simple Korenthi materials (ring and face only)
     */
    public applySimpleKorenthiMaterials(ring: AbstractMesh, face: AbstractMesh): void {
        const cyanBright = new Color3(0.4, 1, 1);
        const cyanLight = new Color3(0.6, 1, 1);
        const cyanGlow = new Color3(0, 0.7, 0.8);

        const ringMaterial = this.materialManager.createCustomMaterial(
            'korenthiRingSimple', cyanBright,
            { emissive: new Color3(cyanGlow.r * 1.5, cyanGlow.g * 1.5, cyanGlow.b * 1.5), specular: new Color3(0.5, 1, 1), roughness: 0.15 }
        );
        ring.material = ringMaterial;
        this.applyMaterialToChildren(face, 'korenthiFaceSimple', cyanLight, cyanGlow);
    }

    /**
     * Apply Korenthi V2 materials
     */
    public applyKorenthiMaterialsV2(
        ring: AbstractMesh, face: AbstractMesh, rays: AbstractMesh,
        leftHex: AbstractMesh, rightHex: AbstractMesh, cityscape: AbstractMesh
    ): void {
        const cyanBright = new Color3(0.4, 1, 1);
        const cyanMid = new Color3(0.2, 0.85, 0.9);
        const cyanLight = new Color3(0.6, 1, 1);
        const cyanGlow = new Color3(0, 0.7, 0.8);

        const ringMaterial = this.materialManager.createCustomMaterial(
            'korenthiRingV2', cyanBright,
            { emissive: new Color3(cyanGlow.r * 1.5, cyanGlow.g * 1.5, cyanGlow.b * 1.5), specular: new Color3(0.5, 1, 1), roughness: 0.15 }
        );
        ring.material = ringMaterial;

        this.applyMaterialToChildren(face, 'korenthiFaceV2', cyanLight, cyanGlow);
        this.applyMaterialToChildren(rays, 'korenthiRayV2', cyanBright, new Color3(cyanGlow.r * 1.3, cyanGlow.g * 1.3, cyanGlow.b * 1.3));
        this.applyMaterialToChildren(leftHex, 'korenthiHexLeftV2', cyanMid, cyanGlow);
        this.applyMaterialToChildren(rightHex, 'korenthiHexRightV2', cyanMid, cyanGlow);
        this.applyMaterialToChildren(cityscape, 'korenthiCityV2', cyanBright, new Color3(cyanGlow.r * 1.4, cyanGlow.g * 1.4, cyanGlow.b * 1.4));
    }

    /**
     * Apply Korenthi materials for all elements
     */
    public applyKorenthiMaterials(
        ring1: AbstractMesh, ring2: AbstractMesh, face: AbstractMesh,
        rays: AbstractMesh, hexagons: AbstractMesh, nodes: AbstractMesh
    ): void {
        const cyanColor = new Color3(0, 1, 1);
        const darkCyan = new Color3(0, 0.7, 0.9);
        const lightCyan = new Color3(0.5, 1, 1);
        const cyanGlow = new Color3(0, 0.6, 0.7);

        const ringMaterial = this.materialManager.createCustomMaterial(
            'korenthiRing', cyanColor,
            { emissive: new Color3(cyanGlow.r * 1.2, cyanGlow.g * 1.2, cyanGlow.b * 1.2), specular: new Color3(0.4, 1, 1), roughness: 0.2 }
        );
        ring1.material = ringMaterial;
        ring2.material = ringMaterial;

        this.applyMaterialToChildren(face, 'korenthiFace', lightCyan, cyanGlow);
        this.applyMaterialToChildren(rays, 'korenthiRay', cyanColor, new Color3(cyanGlow.r * 1.5, cyanGlow.g * 1.5, cyanGlow.b * 1.5));
        this.applyMaterialToChildren(hexagons, 'korenthiHex', darkCyan, new Color3(cyanGlow.r * 0.7, cyanGlow.g * 0.7, cyanGlow.b * 0.7));
        this.applyMaterialToChildren(nodes, 'korenthiNode', cyanColor, new Color3(cyanGlow.r * 2, cyanGlow.g * 2, cyanGlow.b * 2));
    }

    /**
     * Apply Empire neon materials
     */
    public applyEmpireNeonMaterials(
        base: AbstractMesh, ring: AbstractMesh, cross: AbstractMesh, triangles: AbstractMesh
    ): void {
        const primaryColor = new Color3(0, 1, 1);
        const secondaryColor = new Color3(0, 0.7, 0.9);
        const glowColor = new Color3(0, 0.5, 0.6);

        base.material = this.materialManager.createCustomMaterial(
            'empireEmblemBase', primaryColor,
            { emissive: glowColor, specular: new Color3(0.3, 0.8, 0.8), roughness: 0.3 }
        );
        ring.material = this.materialManager.createCustomMaterial(
            'empireEmblemRing', secondaryColor,
            { emissive: new Color3(glowColor.r * 0.7, glowColor.g * 0.7, glowColor.b * 0.7), specular: new Color3(0.2, 0.6, 0.6), roughness: 0.4 }
        );
        cross.material = this.materialManager.createCustomMaterial(
            'empireEmblemCross', new Color3(0.2, 1, 1),
            { emissive: new Color3(glowColor.r * 1.2, glowColor.g * 1.2, glowColor.b * 1.2), specular: new Color3(0.4, 1, 1), roughness: 0.2 }
        );
        this.applyMaterialToChildren(triangles, 'empireEmblemTriangle', secondaryColor, glowColor);
    }

    /**
     * Apply Energy Lords neon materials
     */
    public applyEnergyLordsNeonMaterials(
        base: AbstractMesh, core: AbstractMesh, rays: AbstractMesh, nodes: AbstractMesh
    ): void {
        const darkEmerald = new Color3(0.02, 0.12, 0.06);
        const emeraldGlow = new Color3(0.01, 0.04, 0.02);
        const cyanAccent = new Color3(0, 0.6, 0.6);
        const cyanGlow = new Color3(0, 0.3, 0.35);

        base.material = this.materialManager.createCustomMaterial(
            'energyLordsEmblemBase', darkEmerald,
            { emissive: emeraldGlow, specular: new Color3(0.05, 0.2, 0.1), roughness: 0.3 }
        );
        core.material = this.materialManager.createCustomMaterial(
            'energyLordsEmblemCore', cyanAccent,
            { emissive: new Color3(cyanGlow.r * 1.5, cyanGlow.g * 1.5, cyanGlow.b * 1.5), specular: new Color3(0.2, 0.6, 0.6), roughness: 0.1 }
        );
        this.applyMaterialToChildren(rays, 'energyLordsEmblemRay', darkEmerald, emeraldGlow);
        this.applyMaterialToChildren(nodes, 'energyLordsEmblemNode', cyanAccent, cyanGlow);
    }

    /**
     * Create a custom material with theme
     */
    public createThemedMaterial(name: string, theme: EmblemColorTheme): StandardMaterial {
        return this.materialManager.createCustomMaterial(name, theme.primary, {
            emissive: theme.glow,
            specular: new Color3(theme.primary.r * 0.5, theme.primary.g * 0.5, theme.primary.b * 0.5),
            roughness: 0.3
        }) as StandardMaterial;
    }
}
