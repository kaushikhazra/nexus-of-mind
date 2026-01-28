/**
 * EmblemShapes - Base shape creation for emblems
 *
 * Contains methods for creating basic geometric shapes used in emblems.
 * Extracted from EmblemGeometry.ts for SOLID compliance.
 */

import { Scene, Mesh, Vector3, Color3, CSG, MeshBuilder } from '@babylonjs/core';
import type { EmblemConfig } from './EmblemInterfaces';

/**
 * EmblemShapeFactory - Creates basic geometric shapes for emblems
 */
export class EmblemShapeFactory {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Create polygonal base shape (hexagon or octagon)
     */
    public createPolygonalBase(name: string, config: EmblemConfig): Mesh {
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
    public createInnerRing(name: string, diameter: number, height: number): Mesh {
        const ring = MeshBuilder.CreateTorus(name, {
            diameter: diameter,
            thickness: diameter * 0.1,
            tessellation: 16
        }, this.scene);

        ring.scaling.y = height / (diameter * 0.1);

        return ring;
    }

    /**
     * Create central cross element for Empire emblem
     */
    public createCentralCross(name: string, size: number, height: number): Mesh {
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

        const horizontalCSG = CSG.FromMesh(horizontalBar);
        const verticalCSG = CSG.FromMesh(verticalBar);
        const crossCSG = horizontalCSG.union(verticalCSG);

        const cross = crossCSG.toMesh(`${name}_combined`, horizontalBar.material, this.scene);

        horizontalBar.dispose();
        verticalBar.dispose();

        return cross;
    }

    /**
     * Create corner triangles for Empire emblem
     */
    public createCornerTriangles(name: string, radius: number, height: number, sides: number): Mesh {
        const trianglesGroup = new Mesh(`${name}_group`, this.scene);

        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides;
            const triangle = MeshBuilder.CreateCylinder(`${name}_${i}`, {
                height: height,
                diameterTop: 0,
                diameterBottom: radius * 0.3,
                tessellation: 3
            }, this.scene);

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
    public createEnergyCore(name: string, diameter: number, height: number): Mesh {
        const core = MeshBuilder.CreateSphere(name, {
            diameter: diameter,
            segments: 16
        }, this.scene);

        core.scaling.y = height / diameter;

        return core;
    }

    /**
     * Create energy rays (star pattern) for Energy Lords emblem
     */
    public createEnergyRays(name: string, radius: number, height: number, rayCount: number): Mesh {
        const raysGroup = new Mesh(`${name}_group`, this.scene);

        for (let i = 0; i < rayCount; i++) {
            const angle = (i * 2 * Math.PI) / rayCount;

            const ray = MeshBuilder.CreateCylinder(`${name}_${i}`, {
                height: height,
                diameterTop: 0,
                diameterBottom: radius * 0.15,
                tessellation: 4
            }, this.scene);

            const x = Math.cos(angle) * radius * 0.5;
            const z = Math.sin(angle) * radius * 0.5;
            ray.position = new Vector3(x, 0, z);
            ray.rotation.y = angle;
            ray.scaling.z = 2.0;

            ray.parent = raysGroup;
        }

        return raysGroup;
    }

    /**
     * Create outer ring with energy nodes for Energy Lords emblem
     */
    public createEnergyNodesRing(name: string, radius: number, height: number, nodeCount: number): Mesh {
        const nodesGroup = new Mesh(`${name}_group`, this.scene);

        for (let i = 0; i < nodeCount; i++) {
            const angle = (i * 2 * Math.PI) / nodeCount;

            const node = MeshBuilder.CreateSphere(`${name}_node_${i}`, {
                diameter: radius * 0.1,
                segments: 8
            }, this.scene);

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            node.position = new Vector3(x, 0, z);

            node.parent = nodesGroup;
        }

        return nodesGroup;
    }

    /**
     * Create a single glowing outer ring
     */
    public createGlowingOuterRing(name: string, diameter: number, thickness: number): Mesh {
        const ring = MeshBuilder.CreateTorus(name, {
            diameter: diameter,
            thickness: thickness,
            tessellation: 96
        }, this.scene);

        ring.scaling.y = 0.3;

        return ring;
    }

    /**
     * Create concentric ring for outer border
     */
    public createConcentricRing(name: string, diameter: number, thickness: number): Mesh {
        const ring = MeshBuilder.CreateTorus(name, {
            diameter: diameter,
            thickness: thickness,
            tessellation: 64
        }, this.scene);

        ring.scaling.y = 0.1;

        return ring;
    }
}
