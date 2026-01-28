/**
 * IntroductionModels - 3D model creation for introduction screens
 *
 * Creates optimized 3D models for each introduction page type.
 * Extracted from IntroductionModelRenderer.ts for SOLID compliance.
 *
 * Requirements: 9.3-9.5 - Model creation for introduction pages
 */

import {
    AbstractMesh,
    Scene,
    Mesh,
    MeshBuilder,
    Vector3,
    Color3,
    StandardMaterial,
    Material
} from '@babylonjs/core';
import { MaterialManager } from '../../rendering/MaterialManager';

// ==================== Types ====================

export type ModelType =
    | 'empire-emblem'
    | 'desert-planet'
    | 'terrain-closeup'
    | 'radiation-sign'
    | 'energy-lords-emblem'
    | 'parasites'
    | 'orbital-system';

export interface ModelConfig {
    modelType: ModelType;
    scale?: number;
    position?: Vector3;
}

export interface ModelCreationContext {
    scene: Scene;
    materialManager: MaterialManager | null;
    isLowPerformanceMode: boolean;
    materialCache: Map<string, Material>;
}

// ==================== Material Helpers ====================

/**
 * Get or create a cached material
 */
function getCachedMaterial(
    context: ModelCreationContext,
    key: string,
    createFn: () => Material
): Material {
    if (context.materialCache.has(key)) {
        return context.materialCache.get(key)!;
    }
    const material = createFn();
    context.materialCache.set(key, material);
    return material;
}

/**
 * Create an optimized standard material
 */
function createOptimizedMaterial(
    context: ModelCreationContext,
    name: string,
    color: Color3,
    options: { emissive?: Color3; specular?: Color3; alpha?: number } = {}
): Material {
    return getCachedMaterial(context, name, () => {
        if (context.materialManager) {
            return context.materialManager.createCustomMaterial(name, color, options);
        }

        const material = new StandardMaterial(name, context.scene);
        material.diffuseColor = color;
        material.emissiveColor = options.emissive || new Color3(0, 0, 0);
        material.specularColor = options.specular || new Color3(0.2, 0.2, 0.2);
        if (options.alpha !== undefined) {
            material.alpha = options.alpha;
        }
        material.freeze();
        return material;
    });
}

// ==================== Model Creation Functions ====================

/**
 * Create model by type
 */
export async function createModelByType(
    modelType: ModelType,
    context: ModelCreationContext,
    pageIndex: number
): Promise<AbstractMesh | null> {
    switch (modelType) {
        case 'empire-emblem':
            return createEmpireEmblem(context);
        case 'desert-planet':
            return createDesertPlanet(context);
        case 'terrain-closeup':
            return createTerrainCloseup(context);
        case 'radiation-sign':
            return createRadiationSign(context);
        case 'energy-lords-emblem':
            return createEnergyLordsEmblem(context);
        case 'parasites':
            return createParasites(context);
        case 'orbital-system':
            return createOrbitalSystem(context);
        default:
            console.warn(`Unknown model type: ${modelType}`);
            return null;
    }
}

/**
 * Create Empire emblem model
 * Requirements: 9.3 - Empire faction emblem
 */
export function createEmpireEmblem(context: ModelCreationContext): AbstractMesh {
    const { scene, isLowPerformanceMode } = context;

    // Create parent mesh
    const emblem = new Mesh('empireEmblem', scene);

    // Outer ring
    const segments = isLowPerformanceMode ? 24 : 48;
    const outerRing = MeshBuilder.CreateTorus('outerRing', {
        diameter: 3,
        thickness: 0.15,
        tessellation: segments
    }, scene);

    const ringMaterial = createOptimizedMaterial(context, 'empireRing', new Color3(0.8, 0.6, 0.2), {
        emissive: new Color3(0.2, 0.15, 0.05),
        specular: new Color3(0.5, 0.4, 0.2)
    });
    outerRing.material = ringMaterial;
    outerRing.parent = emblem;

    // Inner star shape (simplified)
    const innerStar = MeshBuilder.CreateCylinder('innerStar', {
        height: 0.1,
        diameterTop: 1.5,
        diameterBottom: 1.5,
        tessellation: 6
    }, scene);

    const starMaterial = createOptimizedMaterial(context, 'empireStar', new Color3(0.9, 0.7, 0.3), {
        emissive: new Color3(0.3, 0.2, 0.1)
    });
    innerStar.material = starMaterial;
    innerStar.parent = emblem;

    return emblem;
}

/**
 * Create desert planet model
 * Requirements: 9.4 - Desert planet visualization
 */
export function createDesertPlanet(context: ModelCreationContext): AbstractMesh {
    const { scene, isLowPerformanceMode } = context;

    const planet = new Mesh('desertPlanet', scene);

    // Planet sphere
    const segments = isLowPerformanceMode ? 16 : 32;
    const sphere = MeshBuilder.CreateSphere('planetSphere', {
        diameter: 4,
        segments
    }, scene);

    const planetMaterial = createOptimizedMaterial(context, 'desertSurface', new Color3(0.8, 0.6, 0.4), {
        specular: new Color3(0.1, 0.1, 0.1)
    });
    sphere.material = planetMaterial;
    sphere.parent = planet;

    // Atmosphere glow (simplified)
    if (!isLowPerformanceMode) {
        const atmosphere = MeshBuilder.CreateSphere('atmosphere', {
            diameter: 4.2,
            segments: 16
        }, scene);

        const atmosphereMaterial = createOptimizedMaterial(context, 'atmosphereGlow',
            new Color3(0.9, 0.7, 0.5), {
                emissive: new Color3(0.1, 0.05, 0.02),
                alpha: 0.2
            });
        atmosphere.material = atmosphereMaterial;
        atmosphere.parent = planet;
    }

    return planet;
}

/**
 * Create terrain closeup model
 * Requirements: 9.4 - Terrain surface visualization
 */
export function createTerrainCloseup(context: ModelCreationContext): AbstractMesh {
    const { scene, isLowPerformanceMode } = context;

    const terrain = new Mesh('terrainCloseup', scene);

    // Ground plane with height variation
    const subdivisions = isLowPerformanceMode ? 10 : 20;
    const ground = MeshBuilder.CreateGround('ground', {
        width: 6,
        height: 6,
        subdivisions
    }, scene);

    const groundMaterial = createOptimizedMaterial(context, 'terrainGround', new Color3(0.5, 0.4, 0.3), {
        specular: new Color3(0.05, 0.05, 0.05)
    });
    ground.material = groundMaterial;
    ground.parent = terrain;

    // Add some rocks (simplified)
    const rockCount = isLowPerformanceMode ? 3 : 6;
    for (let i = 0; i < rockCount; i++) {
        const rock = MeshBuilder.CreatePolyhedron(`rock_${i}`, {
            type: 1,
            size: 0.2 + Math.random() * 0.3
        }, scene);

        rock.position = new Vector3(
            (Math.random() - 0.5) * 4,
            0.2,
            (Math.random() - 0.5) * 4
        );

        const rockMaterial = createOptimizedMaterial(context, `rockMat_${i}`,
            new Color3(0.4 + Math.random() * 0.1, 0.35 + Math.random() * 0.1, 0.3));
        rock.material = rockMaterial;
        rock.parent = terrain;
    }

    return terrain;
}

/**
 * Create radiation sign model
 * Requirements: 9.5 - Warning/radiation indicator
 */
export function createRadiationSign(context: ModelCreationContext): AbstractMesh {
    const { scene } = context;

    const sign = new Mesh('radiationSign', scene);

    // Triangular warning shape
    const triangle = MeshBuilder.CreateCylinder('warningTriangle', {
        height: 0.2,
        diameterTop: 0,
        diameterBottom: 3,
        tessellation: 3
    }, scene);
    triangle.rotation.x = Math.PI / 2;

    const warningMaterial = createOptimizedMaterial(context, 'warningYellow',
        new Color3(1, 0.8, 0), {
            emissive: new Color3(0.3, 0.24, 0)
        });
    triangle.material = warningMaterial;
    triangle.parent = sign;

    // Radiation symbol (simplified circle)
    const symbol = MeshBuilder.CreateTorus('radiationSymbol', {
        diameter: 1,
        thickness: 0.1,
        tessellation: 24
    }, scene);
    symbol.position.z = 0.15;

    const symbolMaterial = createOptimizedMaterial(context, 'radiationBlack',
        new Color3(0.1, 0.1, 0.1));
    symbol.material = symbolMaterial;
    symbol.parent = sign;

    return sign;
}

/**
 * Create Energy Lords emblem model
 * Requirements: 9.3 - Energy Lords faction emblem
 */
export function createEnergyLordsEmblem(context: ModelCreationContext): AbstractMesh {
    const { scene, isLowPerformanceMode } = context;

    const emblem = new Mesh('energyLordsEmblem', scene);

    // Energy crystal shape
    const crystal = MeshBuilder.CreatePolyhedron('crystal', {
        type: 2,
        size: 1.5
    }, scene);

    const crystalMaterial = createOptimizedMaterial(context, 'energyCrystal',
        new Color3(0.3, 0.5, 1), {
            emissive: new Color3(0.1, 0.2, 0.5),
            specular: new Color3(0.8, 0.8, 1),
            alpha: 0.9
        });
    crystal.material = crystalMaterial;
    crystal.parent = emblem;

    // Energy rings
    if (!isLowPerformanceMode) {
        for (let i = 0; i < 3; i++) {
            const ring = MeshBuilder.CreateTorus(`energyRing_${i}`, {
                diameter: 2 + i * 0.5,
                thickness: 0.05,
                tessellation: 32
            }, scene);
            ring.rotation.x = Math.PI / 2 + (i * 0.3);
            ring.rotation.y = i * 0.5;

            const ringMaterial = createOptimizedMaterial(context, `energyRingMat_${i}`,
                new Color3(0.5, 0.7, 1), {
                    emissive: new Color3(0.2, 0.3, 0.5),
                    alpha: 0.6
                });
            ring.material = ringMaterial;
            ring.parent = emblem;
        }
    }

    return emblem;
}

/**
 * Create parasites model
 * Requirements: 9.5 - Parasite visualization
 */
export function createParasites(context: ModelCreationContext): AbstractMesh {
    const { scene, isLowPerformanceMode } = context;

    const parasites = new Mesh('parasites', scene);

    // Create cluster of organic shapes
    const count = isLowPerformanceMode ? 5 : 10;
    for (let i = 0; i < count; i++) {
        const parasite = MeshBuilder.CreateSphere(`parasite_${i}`, {
            diameter: 0.3 + Math.random() * 0.4,
            segments: isLowPerformanceMode ? 8 : 16
        }, scene);

        // Spread in organic cluster pattern
        const angle = (i / count) * Math.PI * 2;
        const radius = 0.5 + Math.random() * 1.5;
        parasite.position = new Vector3(
            Math.cos(angle) * radius,
            (Math.random() - 0.5) * 1,
            Math.sin(angle) * radius
        );

        // Slight deformation for organic look
        parasite.scaling = new Vector3(
            0.8 + Math.random() * 0.4,
            0.8 + Math.random() * 0.4,
            0.8 + Math.random() * 0.4
        );

        const parasiteMaterial = createOptimizedMaterial(context, `parasiteMat_${i}`,
            new Color3(0.4 + Math.random() * 0.2, 0.2, 0.3 + Math.random() * 0.2), {
                emissive: new Color3(0.1, 0.05, 0.08)
            });
        parasite.material = parasiteMaterial;
        parasite.parent = parasites;
    }

    return parasites;
}

/**
 * Create orbital system model
 * Requirements: 9.4 - Orbital mining system visualization
 */
export function createOrbitalSystem(context: ModelCreationContext): AbstractMesh {
    const { scene, isLowPerformanceMode } = context;

    const system = new Mesh('orbitalSystem', scene);

    // Central planet
    const planet = MeshBuilder.CreateSphere('centralPlanet', {
        diameter: 2,
        segments: isLowPerformanceMode ? 16 : 24
    }, scene);

    const planetMaterial = createOptimizedMaterial(context, 'orbitalPlanet',
        new Color3(0.5, 0.4, 0.6));
    planet.material = planetMaterial;
    planet.parent = system;

    // Orbital rings
    const ringCount = isLowPerformanceMode ? 2 : 3;
    for (let i = 0; i < ringCount; i++) {
        const orbitRing = MeshBuilder.CreateTorus(`orbitRing_${i}`, {
            diameter: 3 + i * 1.5,
            thickness: 0.02,
            tessellation: isLowPerformanceMode ? 32 : 64
        }, scene);
        orbitRing.rotation.x = Math.PI / 2;

        const ringMaterial = createOptimizedMaterial(context, `orbitRingMat_${i}`,
            new Color3(0.3, 0.4, 0.5), {
                emissive: new Color3(0.05, 0.08, 0.1),
                alpha: 0.5
            });
        orbitRing.material = ringMaterial;
        orbitRing.parent = system;
    }

    // Mining ship (simplified)
    const ship = MeshBuilder.CreateBox('miningShip', {
        width: 0.3,
        height: 0.1,
        depth: 0.5
    }, scene);

    const shipMaterial = createOptimizedMaterial(context, 'shipMetal',
        new Color3(0.6, 0.6, 0.7), {
            specular: new Color3(0.4, 0.4, 0.4)
        });
    ship.material = shipMaterial;
    ship.position = new Vector3(4, 0, 0);
    ship.parent = system;

    return system;
}

/**
 * Create placeholder model for loading failures
 */
export function createPlaceholder(context: ModelCreationContext, text: string): AbstractMesh {
    const { scene } = context;

    const placeholder = MeshBuilder.CreateBox('placeholder', { size: 2 }, scene);

    const material = createOptimizedMaterial(context, 'placeholderMaterial',
        new Color3(0.3, 0.3, 0.3), {
            emissive: new Color3(0.1, 0.1, 0.1)
        });
    placeholder.material = material;

    return placeholder;
}
