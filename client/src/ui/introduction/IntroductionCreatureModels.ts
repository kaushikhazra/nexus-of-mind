/**
 * IntroductionCreatureModels - Creature model creation for introduction screens
 *
 * Creates Parasites and Protector unit models.
 * Extracted from IntroductionModels.ts for SOLID compliance.
 *
 * Requirements: 9.5 - Creature and unit visualization
 */

import {
    AbstractMesh,
    Mesh,
    MeshBuilder,
    Vector3,
    Color3
} from '@babylonjs/core';
import { ModelCreationContext, createOptimizedMaterial } from './IntroductionModelTypes';

// Import unit rendering for Protector model
import { ProtectorMeshFactory } from '../../rendering/unit/UnitMeshFactories';
import { UnitMaterialManager } from '../../rendering/unit/UnitMaterials';

/**
 * Create parasites model using ParasiteRenderer
 * Requirements: 9.5 - Parasite visualization
 */
export function createParasites(context: ModelCreationContext): AbstractMesh {
    // Use specialized renderer if available
    if (context.parasiteRenderer) {
        try {
            // Use single ring worm for focused display
            const count = context.isLowPerformanceMode ? 1 : 3;
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
