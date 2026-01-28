/**
 * IntroductionSignModels - Warning sign model creation for introduction screens
 *
 * Creates radiation sign and other warning indicator models.
 * Extracted from IntroductionModels.ts for SOLID compliance.
 *
 * Requirements: 9.5 - Warning/radiation indicator visualization
 */

import {
    AbstractMesh,
    Scene,
    Mesh,
    MeshBuilder,
    VertexData,
    Color3,
    StandardMaterial
} from '@babylonjs/core';
import { ModelCreationContext, createOptimizedMaterial } from './IntroductionModelTypes';

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

    // Add side faces (inner edge, outer edge)
    for (let i = 0; i < segments; i++) {
        const baseIndex = i * 4;
        // Inner edge quad (connecting top inner to bottom inner)
        indices.push(baseIndex, baseIndex + 4, baseIndex + 6);
        indices.push(baseIndex, baseIndex + 6, baseIndex + 2);
    }

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
