/**
 * EmblemComplexShapes - Complex shape creation for emblems
 *
 * Contains methods for creating complex geometric shapes like circuit rays,
 * hexagonal clusters, cityscapes, and low-poly faces.
 * Extracted from EmblemGeometry.ts for SOLID compliance.
 */

import { Scene, Mesh, Vector3, MeshBuilder } from '@babylonjs/core';

/**
 * Circuit ray segment definition
 */
interface CircuitSegment {
    len: number;
    bend: string;
}

/**
 * Circuit ray pattern definition
 */
interface RayPattern {
    angle: number;
    segments: CircuitSegment[];
    hasArrow: boolean;
}

/**
 * EmblemComplexShapeFactory - Creates complex geometric shapes for emblems
 */
export class EmblemComplexShapeFactory {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Create circuit board style rays with right-angle bends and endpoint circles
     */
    public createCircuitBoardRays(name: string, maxLength: number): Mesh {
        const raysGroup = new Mesh(`${name}_group`, this.scene);

        const rayPatterns: RayPattern[] = [
            { angle: Math.PI / 2, segments: [{ len: 0.8, bend: 'up' }, { len: 0.6, bend: 'none' }], hasArrow: true },
            { angle: Math.PI / 2 + 0.3, segments: [{ len: 1.0, bend: 'none' }], hasArrow: false },
            { angle: Math.PI / 2 - 0.3, segments: [{ len: 1.0, bend: 'none' }], hasArrow: false },
            { angle: Math.PI / 4, segments: [{ len: 1.2, bend: 'right' }, { len: 0.4, bend: 'none' }], hasArrow: false },
            { angle: 3 * Math.PI / 4, segments: [{ len: 1.2, bend: 'left' }, { len: 0.4, bend: 'none' }], hasArrow: false },
            { angle: 0, segments: [{ len: 1.5, bend: 'none' }], hasArrow: false },
            { angle: Math.PI, segments: [{ len: 1.5, bend: 'none' }], hasArrow: false },
            { angle: 0.2, segments: [{ len: 1.0, bend: 'up' }, { len: 0.5, bend: 'none' }], hasArrow: false },
            { angle: Math.PI - 0.2, segments: [{ len: 1.0, bend: 'up' }, { len: 0.5, bend: 'none' }], hasArrow: false },
            { angle: -Math.PI / 4, segments: [{ len: 1.1, bend: 'right' }, { len: 0.3, bend: 'none' }], hasArrow: false },
            { angle: -3 * Math.PI / 4, segments: [{ len: 1.1, bend: 'left' }, { len: 0.3, bend: 'none' }], hasArrow: false },
            { angle: -Math.PI / 2, segments: [{ len: 0.9, bend: 'none' }], hasArrow: false },
            { angle: -Math.PI / 2 + 0.25, segments: [{ len: 0.7, bend: 'down' }, { len: 0.4, bend: 'none' }], hasArrow: false },
            { angle: -Math.PI / 2 - 0.25, segments: [{ len: 0.7, bend: 'down' }, { len: 0.4, bend: 'none' }], hasArrow: false },
        ];

        rayPatterns.forEach((pattern, i) => {
            const rayMesh = this.createSingleCircuitRay(
                `${name}_ray_${i}`,
                pattern.angle,
                pattern.segments,
                maxLength,
                pattern.hasArrow
            );
            rayMesh.parent = raysGroup;
        });

        return raysGroup;
    }

    /**
     * Create a single circuit ray with optional bends
     */
    private createSingleCircuitRay(
        name: string,
        angle: number,
        segments: CircuitSegment[],
        maxLength: number,
        hasArrow: boolean
    ): Mesh {
        const rayGroup = new Mesh(`${name}_group`, this.scene);
        const lineThickness = 0.04;
        const startRadius = 1.0;

        let currentX = Math.cos(angle) * startRadius;
        let currentZ = Math.sin(angle) * startRadius;
        let currentAngle = angle;

        segments.forEach((seg, segIndex) => {
            const segmentLength = seg.len * maxLength * 0.4;

            const line = MeshBuilder.CreateBox(`${name}_seg_${segIndex}`, {
                width: lineThickness,
                height: lineThickness,
                depth: segmentLength
            }, this.scene);

            const midX = currentX + Math.cos(currentAngle) * segmentLength / 2;
            const midZ = currentZ + Math.sin(currentAngle) * segmentLength / 2;
            line.position = new Vector3(midX, 0, midZ);
            line.rotation.y = -currentAngle + Math.PI / 2;
            line.parent = rayGroup;

            currentX += Math.cos(currentAngle) * segmentLength;
            currentZ += Math.sin(currentAngle) * segmentLength;

            if (segIndex < segments.length - 1 && seg.bend !== 'none') {
                const joint = MeshBuilder.CreateBox(`${name}_joint_${segIndex}`, {
                    width: lineThickness * 2,
                    height: lineThickness * 2,
                    depth: lineThickness * 2
                }, this.scene);
                joint.position = new Vector3(currentX, 0, currentZ);
                joint.parent = rayGroup;

                if (seg.bend === 'up') currentAngle += Math.PI / 4;
                else if (seg.bend === 'down') currentAngle -= Math.PI / 4;
                else if (seg.bend === 'left') currentAngle += Math.PI / 2;
                else if (seg.bend === 'right') currentAngle -= Math.PI / 2;
            }
        });

        const endpoint = MeshBuilder.CreateSphere(`${name}_endpoint`, {
            diameter: 0.12,
            segments: 8
        }, this.scene);
        endpoint.position = new Vector3(currentX, 0, currentZ);
        endpoint.parent = rayGroup;

        if (hasArrow) {
            const arrow = MeshBuilder.CreateCylinder(`${name}_arrow`, {
                height: 0.15,
                diameterTop: 0,
                diameterBottom: 0.12,
                tessellation: 3
            }, this.scene);
            arrow.position = new Vector3(currentX, 0, currentZ + 0.1);
            arrow.rotation.x = Math.PI / 2;
            arrow.parent = rayGroup;
        }

        return rayGroup;
    }

    /**
     * Create hexagonal cluster (group of hexagons)
     */
    public createHexagonalCluster(name: string, centerX: number, centerZ: number, count: number): Mesh {
        const clusterGroup = new Mesh(`${name}_group`, this.scene);

        const hexSize = 0.18;
        const spacing = hexSize * 1.8;

        const positions = [
            { x: 0, z: 0 },
            { x: spacing * 0.866, z: spacing * 0.5 },
            { x: spacing * 0.866, z: -spacing * 0.5 },
            { x: 0, z: spacing },
            { x: 0, z: -spacing },
            { x: -spacing * 0.5, z: spacing * 0.75 },
            { x: -spacing * 0.5, z: -spacing * 0.75 },
            { x: spacing * 0.866 * 2, z: 0 },
        ];

        for (let i = 0; i < Math.min(count, positions.length); i++) {
            const hex = MeshBuilder.CreateCylinder(`${name}_hex_${i}`, {
                height: 0.06,
                diameter: hexSize * (0.8 + Math.random() * 0.4),
                tessellation: 6
            }, this.scene);

            hex.position = new Vector3(
                centerX + positions[i].x,
                0,
                centerZ + positions[i].z
            );
            hex.parent = clusterGroup;
        }

        return clusterGroup;
    }

    /**
     * Create cityscape-style vertical bars at the top
     */
    public createCityscapeBars(name: string, centerX: number, centerZ: number, barCount: number): Mesh {
        const cityGroup = new Mesh(`${name}_group`, this.scene);

        const barWidth = 0.08;
        const spacing = 0.15;
        const startX = centerX - (barCount - 1) * spacing / 2;

        const heights = [0.4, 0.6, 0.9, 1.2, 1.5, 1.2, 0.9, 0.6, 0.4];

        for (let i = 0; i < barCount; i++) {
            const height = heights[i] || 0.5;

            const bar = MeshBuilder.CreateBox(`${name}_bar_${i}`, {
                width: barWidth,
                height: height,
                depth: barWidth
            }, this.scene);

            bar.position = new Vector3(
                startX + i * spacing,
                height / 2,
                centerZ
            );
            bar.parent = cityGroup;

            if (Math.random() > 0.5) {
                const cap = MeshBuilder.CreateBox(`${name}_cap_${i}`, {
                    width: barWidth * 1.3,
                    height: 0.04,
                    depth: barWidth * 1.3
                }, this.scene);
                cap.position = new Vector3(
                    startX + i * spacing,
                    height + 0.02,
                    centerZ
                );
                cap.parent = cityGroup;
            }
        }

        return cityGroup;
    }

    /**
     * Create detailed low-poly geometric face with triangular facets
     */
    public createDetailedLowPolyFace(name: string, size: number): Mesh {
        const faceGroup = new Mesh(`${name}_group`, this.scene);

        const head = MeshBuilder.CreateIcoSphere(`${name}_head`, {
            radius: size * 0.55,
            subdivisions: 2,
            flat: true
        }, this.scene);
        head.scaling = new Vector3(0.85, 1.1, 0.7);
        head.parent = faceGroup;

        const forehead = MeshBuilder.CreateBox(`${name}_forehead`, {
            width: size * 0.5,
            height: size * 0.15,
            depth: size * 0.1
        }, this.scene);
        forehead.position = new Vector3(0, size * 0.35, size * 0.25);
        forehead.rotation.x = 0.3;
        forehead.parent = faceGroup;

        const leftEyeSocket = MeshBuilder.CreateBox(`${name}_leftEyeSocket`, {
            width: size * 0.18,
            height: size * 0.08,
            depth: size * 0.15
        }, this.scene);
        leftEyeSocket.position = new Vector3(-size * 0.18, size * 0.12, size * 0.32);
        leftEyeSocket.rotation.z = -0.15;
        leftEyeSocket.parent = faceGroup;

        const rightEyeSocket = MeshBuilder.CreateBox(`${name}_rightEyeSocket`, {
            width: size * 0.18,
            height: size * 0.08,
            depth: size * 0.15
        }, this.scene);
        rightEyeSocket.position = new Vector3(size * 0.18, size * 0.12, size * 0.32);
        rightEyeSocket.rotation.z = 0.15;
        rightEyeSocket.parent = faceGroup;

        const noseBridge = MeshBuilder.CreateCylinder(`${name}_noseBridge`, {
            height: size * 0.25,
            diameterTop: size * 0.06,
            diameterBottom: size * 0.12,
            tessellation: 3
        }, this.scene);
        noseBridge.position = new Vector3(0, 0, size * 0.35);
        noseBridge.rotation.x = Math.PI / 2;
        noseBridge.rotation.z = Math.PI / 6;
        noseBridge.parent = faceGroup;

        const chin = MeshBuilder.CreateCylinder(`${name}_chin`, {
            height: size * 0.2,
            diameterTop: size * 0.25,
            diameterBottom: 0,
            tessellation: 4
        }, this.scene);
        chin.position = new Vector3(0, -size * 0.45, size * 0.15);
        chin.rotation.x = -0.3;
        chin.parent = faceGroup;

        const leftCheek = MeshBuilder.CreateBox(`${name}_leftCheek`, {
            width: size * 0.15,
            height: size * 0.2,
            depth: size * 0.08
        }, this.scene);
        leftCheek.position = new Vector3(-size * 0.28, -size * 0.05, size * 0.28);
        leftCheek.rotation.y = 0.4;
        leftCheek.parent = faceGroup;

        const rightCheek = MeshBuilder.CreateBox(`${name}_rightCheek`, {
            width: size * 0.15,
            height: size * 0.2,
            depth: size * 0.08
        }, this.scene);
        rightCheek.position = new Vector3(size * 0.28, -size * 0.05, size * 0.28);
        rightCheek.rotation.y = -0.4;
        rightCheek.parent = faceGroup;

        const neck = MeshBuilder.CreateCylinder(`${name}_neck`, {
            height: size * 0.3,
            diameterTop: size * 0.35,
            diameterBottom: size * 0.5,
            tessellation: 6
        }, this.scene);
        neck.position = new Vector3(0, -size * 0.65, 0);
        neck.parent = faceGroup;

        return faceGroup;
    }

    /**
     * Create low-poly geometric face at center
     */
    public createLowPolyFace(name: string, size: number): Mesh {
        const faceGroup = new Mesh(`${name}_group`, this.scene);

        const head = MeshBuilder.CreateIcoSphere(`${name}_head`, {
            radius: size * 0.5,
            subdivisions: 2,
            flat: true
        }, this.scene);
        head.scaling.y = 1.2;
        head.parent = faceGroup;

        const leftEye = MeshBuilder.CreateBox(`${name}_leftEye`, {
            width: size * 0.15,
            height: size * 0.08,
            depth: size * 0.1
        }, this.scene);
        leftEye.position = new Vector3(-size * 0.15, size * 0.1, size * 0.4);
        leftEye.rotation.x = -0.2;
        leftEye.parent = faceGroup;

        const rightEye = MeshBuilder.CreateBox(`${name}_rightEye`, {
            width: size * 0.15,
            height: size * 0.08,
            depth: size * 0.1
        }, this.scene);
        rightEye.position = new Vector3(size * 0.15, size * 0.1, size * 0.4);
        rightEye.rotation.x = -0.2;
        rightEye.parent = faceGroup;

        const nose = MeshBuilder.CreateCylinder(`${name}_nose`, {
            height: size * 0.2,
            diameterTop: 0,
            diameterBottom: size * 0.12,
            tessellation: 3
        }, this.scene);
        nose.position = new Vector3(0, -size * 0.05, size * 0.45);
        nose.rotation.x = Math.PI / 2;
        nose.parent = faceGroup;

        const neck = MeshBuilder.CreateCylinder(`${name}_neck`, {
            height: size * 0.4,
            diameterTop: size * 0.4,
            diameterBottom: size * 0.5,
            tessellation: 6
        }, this.scene);
        neck.position.y = -size * 0.5;
        neck.parent = faceGroup;

        return faceGroup;
    }

    /**
     * Create circuit-like rays emanating from center
     */
    public createCircuitRays(name: string, length: number, rayCount: number): Mesh {
        const raysGroup = new Mesh(`${name}_group`, this.scene);

        for (let i = 0; i < rayCount; i++) {
            const angle = (i * 2 * Math.PI) / rayCount;

            const rayLength = length * (0.7 + Math.random() * 0.3);
            const segments = Math.floor(2 + Math.random() * 3);

            const ray = MeshBuilder.CreateBox(`${name}_${i}`, {
                width: 0.05,
                height: 0.05,
                depth: rayLength
            }, this.scene);

            const x = Math.cos(angle) * (rayLength / 2 + 0.8);
            const z = Math.sin(angle) * (rayLength / 2 + 0.8);
            ray.position = new Vector3(x, 0, z);
            ray.rotation.y = angle;

            ray.parent = raysGroup;

            for (let j = 1; j < segments; j++) {
                const segmentPos = (j / segments) * rayLength - rayLength / 2;
                const joint = MeshBuilder.CreateBox(`${name}_${i}_joint_${j}`, {
                    width: 0.12,
                    height: 0.12,
                    depth: 0.12
                }, this.scene);

                joint.position = new Vector3(
                    Math.cos(angle) * (segmentPos + rayLength / 2 + 0.8),
                    0,
                    Math.sin(angle) * (segmentPos + rayLength / 2 + 0.8)
                );
                joint.parent = raysGroup;
            }

            if (Math.random() > 0.5) {
                const endShape = Math.random() > 0.5 ? 'diamond' : 'circle';
                let endElement: Mesh;

                if (endShape === 'diamond') {
                    endElement = MeshBuilder.CreateCylinder(`${name}_${i}_end`, {
                        height: 0.05,
                        diameterTop: 0,
                        diameterBottom: 0.25,
                        tessellation: 4
                    }, this.scene);
                } else {
                    endElement = MeshBuilder.CreateSphere(`${name}_${i}_end`, {
                        diameter: 0.2,
                        segments: 8
                    }, this.scene);
                }

                endElement.position = new Vector3(
                    Math.cos(angle) * (rayLength + 0.8),
                    0,
                    Math.sin(angle) * (rayLength + 0.8)
                );
                endElement.parent = raysGroup;
            }
        }

        return raysGroup;
    }

    /**
     * Create scattered hexagonal elements
     */
    public createScatteredHexagons(name: string, radius: number, count: number): Mesh {
        const hexagonsGroup = new Mesh(`${name}_group`, this.scene);

        for (let i = 0; i < count; i++) {
            const angle = (i * 2 * Math.PI) / count;
            const distance = radius * (0.6 + Math.random() * 0.4);

            const hexagon = MeshBuilder.CreateCylinder(`${name}_${i}`, {
                height: 0.1,
                diameter: 0.3 + Math.random() * 0.2,
                tessellation: 6
            }, this.scene);

            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            hexagon.position = new Vector3(x, 0, z);
            hexagon.rotation.y = Math.random() * Math.PI;

            hexagon.parent = hexagonsGroup;
        }

        return hexagonsGroup;
    }

    /**
     * Create connection nodes on circuit rays
     */
    public createConnectionNodes(name: string, radius: number, count: number): Mesh {
        const nodesGroup = new Mesh(`${name}_group`, this.scene);

        for (let i = 0; i < count; i++) {
            const angle = (i * 2 * Math.PI) / count;

            const node = MeshBuilder.CreateSphere(`${name}_${i}`, {
                diameter: 0.15,
                segments: 8
            }, this.scene);

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            node.position = new Vector3(x, 0, z);

            node.parent = nodesGroup;
        }

        return nodesGroup;
    }
}
