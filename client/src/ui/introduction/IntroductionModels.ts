/**
 * IntroductionModels - 3D model creation for introduction screens
 *
 * Creates optimized 3D models for each introduction page type.
 * Uses specialized component renderers for high-quality visuals.
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
    Material,
    VertexData
} from '@babylonjs/core';
import { MaterialManager } from '../../rendering/MaterialManager';

// Import unit rendering for Protector model
import { ProtectorMeshFactory } from '../../rendering/unit/UnitMeshFactories';
import { UnitMaterialManager } from '../../rendering/unit/UnitMaterials';

// Import specialized renderers
import { EmblemGeometry } from '../components/EmblemGeometry';
import { PlanetRenderer } from '../components/PlanetRenderer';
import { ParasiteRenderer } from '../components/ParasiteRenderer';
import { TerrainRenderer } from '../components/TerrainRenderer';

// ==================== Types ====================

export type ModelType =
    | 'empire-emblem'
    | 'desert-planet'
    | 'terrain-closeup'
    | 'radiation-sign'
    | 'energy-lords-emblem'
    | 'parasites'
    | 'orbital-system'
    | 'protector';

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
    // Specialized renderers
    emblemGeometry?: EmblemGeometry;
    planetRenderer?: PlanetRenderer;
    parasiteRenderer?: ParasiteRenderer;
    terrainRenderer?: TerrainRenderer;
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
        case 'protector':
            return createProtector(context);
        default:
            console.warn(`Unknown model type: ${modelType}`);
            return null;
    }
}

/**
 * Create Empire emblem model using EmblemGeometry renderer
 * Requirements: 9.3 - Empire faction emblem
 */
export function createEmpireEmblem(context: ModelCreationContext): AbstractMesh {
    // Use specialized renderer if available
    if (context.emblemGeometry) {
        try {
            return context.emblemGeometry.createEmpireEmblem();
        } catch (error) {
            console.warn('Failed to create Empire emblem with renderer, using fallback:', error);
        }
    }

    // Fallback to simplified version
    return createSimplifiedEmpireEmblem(context);
}

/**
 * Simplified Empire emblem fallback
 */
function createSimplifiedEmpireEmblem(context: ModelCreationContext): AbstractMesh {
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
 * Create desert planet model using PlanetRenderer
 * Requirements: 9.4 - Desert planet visualization
 */
export function createDesertPlanet(context: ModelCreationContext): AbstractMesh {
    // Use specialized renderer if available
    if (context.planetRenderer) {
        try {
            return context.planetRenderer.createDesertPlanet({
                radius: 1.8,
                textureType: 'desert',
                atmosphereGlow: false,
                cloudLayer: false,
                rotationSpeed: 0.5
            });
        } catch (error) {
            console.warn('Failed to create desert planet with renderer, using fallback:', error);
        }
    }

    // Fallback to simplified version
    return createSimplifiedDesertPlanet(context);
}

/**
 * Simplified desert planet fallback
 */
function createSimplifiedDesertPlanet(context: ModelCreationContext): AbstractMesh {
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

    return planet;
}

/**
 * Create terrain closeup model using TerrainRenderer
 * Requirements: 9.4 - Terrain surface visualization
 */
export function createTerrainCloseup(context: ModelCreationContext): AbstractMesh {
    // Use specialized renderer if available
    if (context.terrainRenderer) {
        try {
            return context.terrainRenderer.createTerrainCloseup({
                chunkSize: 12,
                heightScale: 1.5,
                mineralDeposits: true,
                atmosphericEffects: !context.isLowPerformanceMode,
                toxicGlow: true
            });
        } catch (error) {
            console.warn('Failed to create terrain with renderer, using fallback:', error);
        }
    }

    // Fallback to simplified version
    return createSimplifiedTerrainCloseup(context);
}

/**
 * Simplified terrain closeup fallback
 */
function createSimplifiedTerrainCloseup(context: ModelCreationContext): AbstractMesh {
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
 * Create radiation sign model - proper radioactive trefoil symbol
 * Requirements: 9.5 - Warning/radiation indicator
 *
 * Structure: Outer ring, inner ring, and three 120° arc blades
 */
export function createRadiationSign(context: ModelCreationContext): AbstractMesh {
    const { scene, isLowPerformanceMode } = context;

    const sign = new Mesh('radiationSign', scene);

    // Yellow emissive material for the radioactive symbol
    const radioactiveMaterial = createOptimizedMaterial(context, 'radioactiveYellow',
        new Color3(1, 0.85, 0), {
            emissive: new Color3(0.4, 0.34, 0),
            specular: new Color3(0.3, 0.25, 0)
        });

    const tessellation = isLowPerformanceMode ? 32 : 64;

    // Outer ring - rotate to face camera (XZ plane -> XY plane facing -Z)
    const outerRing = MeshBuilder.CreateTorus('outerRing', {
        diameter: 3.5,
        thickness: 0.12,
        tessellation
    }, scene);
    outerRing.rotation.x = Math.PI / 2; // Rotate to face camera
    outerRing.material = radioactiveMaterial;
    outerRing.parent = sign;

    // Inner ring (center circle)
    const innerRing = MeshBuilder.CreateTorus('innerRing', {
        diameter: 0.8,
        thickness: 0.12,
        tessellation
    }, scene);
    innerRing.rotation.x = Math.PI / 2; // Rotate to face camera
    innerRing.material = radioactiveMaterial;
    innerRing.parent = sign;

    // Create three 60° arc blades with 60° gaps (equal distribution)
    const bladeCount = 3;
    const arcAngle = Math.PI / 3; // 60 degrees per blade
    const innerRadius = 0.5;
    const outerRadius = 1.6;

    // Create blade material with backface culling disabled
    const bladeMaterial = createOptimizedMaterial(context, 'radioactiveBlade',
        new Color3(1, 0.85, 0), {
            emissive: new Color3(0.4, 0.34, 0),
            specular: new Color3(0.3, 0.25, 0)
        });
    (bladeMaterial as StandardMaterial).backFaceCulling = false;

    for (let i = 0; i < bladeCount; i++) {
        // Each blade starts at i * 120° (blade + gap = 120°)
        const startAngle = (i * (Math.PI * 2 / 3));

        // Create blade as a 3D extruded arc segment with same thickness as rings
        const blade = createArcBlade(
            scene,
            `blade_${i}`,
            innerRadius,
            outerRadius,
            startAngle,
            arcAngle, // 60 degrees
            isLowPerformanceMode ? 12 : 24,
            0.12 // Same thickness as the rings
        );
        blade.rotation.x = Math.PI / 2; // Rotate to face camera
        blade.position.z = 0.05; // Slight offset to prevent z-fighting
        blade.material = bladeMaterial;
        blade.parent = sign;
    }

    return sign;
}

/**
 * Create an arc-shaped blade for the radioactive symbol with thickness
 * Creates a 3D extruded arc shape matching the torus ring thickness
 */
function createArcBlade(
    scene: Scene,
    name: string,
    innerRadius: number,
    outerRadius: number,
    startAngle: number,
    arcAngle: number,
    segments: number,
    thickness: number = 0.12
): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    const halfThickness = thickness / 2;

    // Generate vertices for top and bottom faces
    for (let i = 0; i <= segments; i++) {
        const angle = startAngle + (arcAngle * i / segments);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Top face vertices (Y = +halfThickness)
        // Inner vertex
        positions.push(innerRadius * cos, halfThickness, innerRadius * sin);
        normals.push(0, 1, 0);
        // Outer vertex
        positions.push(outerRadius * cos, halfThickness, outerRadius * sin);
        normals.push(0, 1, 0);

        // Bottom face vertices (Y = -halfThickness)
        // Inner vertex
        positions.push(innerRadius * cos, -halfThickness, innerRadius * sin);
        normals.push(0, -1, 0);
        // Outer vertex
        positions.push(outerRadius * cos, -halfThickness, outerRadius * sin);
        normals.push(0, -1, 0);
    }

    // Generate triangles for top and bottom faces
    for (let i = 0; i < segments; i++) {
        const baseIndex = i * 4;

        // Top face triangles
        indices.push(baseIndex, baseIndex + 1, baseIndex + 5);
        indices.push(baseIndex, baseIndex + 5, baseIndex + 4);

        // Bottom face triangles (reversed winding)
        indices.push(baseIndex + 2, baseIndex + 6, baseIndex + 7);
        indices.push(baseIndex + 2, baseIndex + 7, baseIndex + 3);
    }

    // Add side faces (inner edge, outer edge, start cap, end cap)
    const vertexCount = (segments + 1) * 4;

    // Inner edge
    for (let i = 0; i < segments; i++) {
        const baseIndex = i * 4;
        // Inner edge quad (connecting top inner to bottom inner)
        indices.push(baseIndex, baseIndex + 4, baseIndex + 6);
        indices.push(baseIndex, baseIndex + 6, baseIndex + 2);
    }

    // Outer edge
    for (let i = 0; i < segments; i++) {
        const baseIndex = i * 4;
        // Outer edge quad (connecting top outer to bottom outer)
        indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 7);
        indices.push(baseIndex + 1, baseIndex + 7, baseIndex + 5);
    }

    // Create the mesh
    const blade = new Mesh(name, scene);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.applyToMesh(blade);

    // Recompute normals for proper lighting
    blade.createNormals(true);

    return blade;
}

/**
 * Create Energy Lords emblem model - nuclear reactor fuel rod arrangement
 * Requirements: 9.3 - Energy Lords faction emblem
 *
 * Structure: Vertical fuel rods arranged in circular pattern inside containment cylinder
 * Rod color matches mineral color from game palette (0.2, 0.6, 1.0 - bright blue)
 */
export function createEnergyLordsEmblem(context: ModelCreationContext): AbstractMesh {
    const { scene, isLowPerformanceMode } = context;

    const emblem = new Mesh('energyLordsEmblem', scene);
    const segments = isLowPerformanceMode ? 16 : 32;

    // Uranium green color for fuel rods (darker)
    const uraniumGreen = new Color3(0.2, 0.5, 0.15);

    // Fuel rod material - uranium green glow (dimmer)
    const fuelRodMaterial = new StandardMaterial('fuelRodMaterial', scene);
    fuelRodMaterial.diffuseColor = uraniumGreen;
    fuelRodMaterial.emissiveColor = new Color3(0.1, 0.3, 0.08);
    fuelRodMaterial.specularColor = new Color3(0.2, 0.4, 0.15);
    fuelRodMaterial.specularPower = 64;

    // Inner core rod material - slightly brighter uranium glow
    const coreRodMaterial = new StandardMaterial('coreRodMaterial', scene);
    coreRodMaterial.diffuseColor = new Color3(0.25, 0.5, 0.2);
    coreRodMaterial.emissiveColor = new Color3(0.15, 0.4, 0.1);
    coreRodMaterial.disableLighting = true;

    const rodHeight = 3.0;
    const rodRadius = 0.08;
    const containmentDiameter = 2.4;

    // Central fuel rod (brightest)
    const centralRod = MeshBuilder.CreateCylinder('centralRod', {
        height: rodHeight,
        diameter: rodRadius * 2.5,
        tessellation: segments
    }, scene);
    centralRod.material = coreRodMaterial;
    centralRod.parent = emblem;

    // Inner ring of fuel rods (6 rods)
    const innerRingRadius = 0.4;
    const innerRodCount = 6;
    for (let i = 0; i < innerRodCount; i++) {
        const angle = (i / innerRodCount) * Math.PI * 2;
        const rod = MeshBuilder.CreateCylinder(`innerRod_${i}`, {
            height: rodHeight,
            diameter: rodRadius * 2,
            tessellation: isLowPerformanceMode ? 8 : 12
        }, scene);
        rod.position.x = Math.cos(angle) * innerRingRadius;
        rod.position.z = Math.sin(angle) * innerRingRadius;
        rod.material = fuelRodMaterial;
        rod.parent = emblem;
    }

    // Outer ring of fuel rods (12 rods)
    const outerRingRadius = 0.85;
    const outerRodCount = 12;
    for (let i = 0; i < outerRodCount; i++) {
        const angle = (i / outerRodCount) * Math.PI * 2;
        const rod = MeshBuilder.CreateCylinder(`outerRod_${i}`, {
            height: rodHeight,
            diameter: rodRadius * 2,
            tessellation: isLowPerformanceMode ? 8 : 12
        }, scene);
        rod.position.x = Math.cos(angle) * outerRingRadius;
        rod.position.z = Math.sin(angle) * outerRingRadius;
        rod.material = fuelRodMaterial;
        rod.parent = emblem;
    }

    // Containment cylinder (transparent, reduced reflection)
    const containmentMaterial = new StandardMaterial('containmentMaterial', scene);
    containmentMaterial.diffuseColor = new Color3(0.15, 0.2, 0.25);
    containmentMaterial.emissiveColor = new Color3(0.02, 0.04, 0.06);
    containmentMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    containmentMaterial.alpha = 0.2;
    containmentMaterial.backFaceCulling = false;

    const containmentCylinder = MeshBuilder.CreateCylinder('containment', {
        height: rodHeight * 1.1,
        diameter: containmentDiameter,
        tessellation: segments,
        sideOrientation: Mesh.DOUBLESIDE
    }, scene);
    containmentCylinder.material = containmentMaterial;
    containmentCylinder.parent = emblem;

    // Metal end caps - cones at top and bottom (dark carbon steel)
    const metalMaterial = new StandardMaterial('metalCapMaterial', scene);
    metalMaterial.diffuseColor = new Color3(0.2, 0.22, 0.25);
    metalMaterial.specularColor = new Color3(0.4, 0.4, 0.45);
    metalMaterial.specularPower = 32;

    const coneHeight = 0.6;
    const coneRadius = containmentDiameter / 2;

    // Top cone (pointing up)
    const topCone = MeshBuilder.CreateCylinder('topCone', {
        height: coneHeight,
        diameterTop: 0,
        diameterBottom: coneRadius * 2,
        tessellation: segments
    }, scene);
    topCone.position.y = (rodHeight * 0.55) + (coneHeight / 2);
    topCone.material = metalMaterial;
    topCone.parent = emblem;

    // Bottom cone (pointing down)
    const bottomCone = MeshBuilder.CreateCylinder('bottomCone', {
        height: coneHeight,
        diameterTop: coneRadius * 2,
        diameterBottom: 0,
        tessellation: segments
    }, scene);
    bottomCone.position.y = -(rodHeight * 0.55) - (coneHeight / 2);
    bottomCone.material = metalMaterial;
    bottomCone.parent = emblem;

    // Green indicator lights on cones
    const greenLightMaterial = new StandardMaterial('greenLightMaterial', scene);
    greenLightMaterial.diffuseColor = new Color3(0.2, 1.0, 0.3);
    greenLightMaterial.emissiveColor = new Color3(0.1, 0.8, 0.2);
    greenLightMaterial.disableLighting = true;

    const lightCount = 4;
    const lightRadius = 0.07;
    const lightDistFromCenter = coneRadius * 0.6;
    const topLightY = (rodHeight * 0.55) + (coneHeight * 0.3);
    const bottomLightY = -(rodHeight * 0.55) - (coneHeight * 0.3);

    for (let i = 0; i < lightCount; i++) {
        const angle = (i / lightCount) * Math.PI * 2;

        // Top cone lights
        const topLight = MeshBuilder.CreateSphere(`topLight_${i}`, {
            diameter: lightRadius * 2,
            segments: 8
        }, scene);
        topLight.position.x = Math.cos(angle) * lightDistFromCenter;
        topLight.position.z = Math.sin(angle) * lightDistFromCenter;
        topLight.position.y = topLightY;
        topLight.material = greenLightMaterial;
        topLight.parent = emblem;

        // Bottom cone lights
        const bottomLight = MeshBuilder.CreateSphere(`bottomLight_${i}`, {
            diameter: lightRadius * 2,
            segments: 8
        }, scene);
        bottomLight.position.x = Math.cos(angle) * lightDistFromCenter;
        bottomLight.position.z = Math.sin(angle) * lightDistFromCenter;
        bottomLight.position.y = bottomLightY;
        bottomLight.material = greenLightMaterial;
        bottomLight.parent = emblem;
    }

    return emblem;
}


/**
 * Create parasites model using ParasiteRenderer
 * Requirements: 9.5 - Parasite visualization
 */
export function createParasites(context: ModelCreationContext): AbstractMesh {
    // Use specialized renderer if available
    if (context.parasiteRenderer) {
        try {
            // Use the ring worm group which creates detailed parasite models
            const count = context.isLowPerformanceMode ? 1 : 1;
            return context.parasiteRenderer.createRingWormGroup(count);
        } catch (error) {
            console.warn('Failed to create parasites with renderer, using fallback:', error);
        }
    }

    // Fallback to simplified version
    return createSimplifiedParasites(context);
}

/**
 * Simplified parasites fallback
 */
function createSimplifiedParasites(context: ModelCreationContext): AbstractMesh {
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
 * Create orbital system model using PlanetRenderer for planet
 * Requirements: 9.4 - Orbital mining system visualization
 */
export function createOrbitalSystem(context: ModelCreationContext): AbstractMesh {
    const { scene, isLowPerformanceMode } = context;

    const system = new Mesh('orbitalSystem', scene);

    // Central planet - use PlanetRenderer if available
    let planet: AbstractMesh;
    if (context.planetRenderer) {
        try {
            planet = context.planetRenderer.createDesertPlanet({
                radius: 1.0,
                textureType: 'desert',
                atmosphereGlow: !isLowPerformanceMode,
                cloudLayer: false,
                rotationSpeed: 0.3
            });
            planet.parent = system;
        } catch (error) {
            console.warn('Failed to create orbital planet with renderer, using fallback:', error);
            planet = createSimplifiedOrbitalPlanet(context, system);
        }
    } else {
        planet = createSimplifiedOrbitalPlanet(context, system);
    }

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
 * Create simplified orbital planet fallback
 */
function createSimplifiedOrbitalPlanet(context: ModelCreationContext, parent: Mesh): AbstractMesh {
    const { scene, isLowPerformanceMode } = context;

    const planet = MeshBuilder.CreateSphere('centralPlanet', {
        diameter: 2,
        segments: isLowPerformanceMode ? 16 : 24
    }, scene);

    const planetMaterial = createOptimizedMaterial(context, 'orbitalPlanet',
        new Color3(0.5, 0.4, 0.6));
    planet.material = planetMaterial;
    planet.parent = parent;

    return planet;
}

/**
 * Create Protector unit model - uses the exact same model from the game
 * Uses ProtectorMeshFactory from UnitMeshFactories.ts
 */
export function createProtector(context: ModelCreationContext): AbstractMesh {
    const { scene } = context;

    // Create the materials manager and mesh factory (same as in-game)
    const unitMaterials = new UnitMaterialManager(scene);
    const protectorFactory = new ProtectorMeshFactory(scene, unitMaterials);

    // Create a root node for animation (this will be animated, rotation starts at 0)
    const animationRoot = new Mesh('protectorRoot', scene);

    // Create an offset node for initial rotation (child of animation root)
    // This keeps the initial facing direction while animation rotates the parent
    const offsetNode = new Mesh('protectorOffset', scene);
    offsetNode.parent = animationRoot;
    offsetNode.rotation.y = Math.PI; // Face forward (toward camera)

    // Get the protector config (same as in-game)
    const config = {
        radius: 1.5, // Slightly larger for introduction display
        segments: 16
    };

    // Create the exact same protector mesh as in-game, parented to offset node
    protectorFactory.createProtectorMesh('intro', config, offsetNode);

    // Scale for introduction display (smaller than before)
    animationRoot.scaling = new Vector3(1.25, 1.25, 1.25);

    // Center the model (in-game it's raised for ground placement)
    animationRoot.position.y = -config.radius * 1.25;

    return animationRoot;
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
