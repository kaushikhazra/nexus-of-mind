/**
 * IntroductionPlanetModels - Planet and terrain model creation for introduction screens
 *
 * Creates desert planet, terrain closeup, and orbital system models.
 * Extracted from IntroductionModels.ts for SOLID compliance.
 *
 * Requirements: 9.4 - Planet and terrain visualization
 */

import {
    AbstractMesh,
    Mesh,
    MeshBuilder,
    Vector3,
    Color3
} from '@babylonjs/core';
import { ModelCreationContext, createOptimizedMaterial } from './IntroductionModelTypes';

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
 * Create orbital system model using PlanetRenderer for planet
 * Requirements: 9.4 - Orbital mining system visualization
 */
export function createOrbitalSystem(context: ModelCreationContext): AbstractMesh {
    const { scene, isLowPerformanceMode } = context;

    const system = new Mesh('orbitalSystem', scene);

    // Central planet - use PlanetRenderer if available
    if (context.planetRenderer) {
        try {
            const planet = context.planetRenderer.createDesertPlanet({
                radius: 1.0,
                textureType: 'desert',
                atmosphereGlow: !isLowPerformanceMode,
                cloudLayer: false,
                rotationSpeed: 0.3
            });
            planet.parent = system;
        } catch (error) {
            console.warn('Failed to create orbital planet with renderer, using fallback:', error);
            createSimplifiedOrbitalPlanet(context, system);
        }
    } else {
        createSimplifiedOrbitalPlanet(context, system);
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
