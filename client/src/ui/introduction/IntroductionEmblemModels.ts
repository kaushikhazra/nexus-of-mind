/**
 * IntroductionEmblemModels - Emblem model creation for introduction screens
 *
 * Creates Empire and Energy Lords emblem models.
 * Extracted from IntroductionModels.ts for SOLID compliance.
 *
 * Requirements: 9.3 - Faction emblem visualization
 */

import {
    AbstractMesh,
    Mesh,
    MeshBuilder,
    Color3,
    StandardMaterial
} from '@babylonjs/core';
import { ModelCreationContext, createOptimizedMaterial } from './IntroductionModelTypes';

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
