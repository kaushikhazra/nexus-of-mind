/**
 * BuildingRendererInterfaces - Type definitions for building rendering
 *
 * Contains all interfaces for building visualization system.
 */

import type { Mesh, StandardMaterial, TransformNode } from '@babylonjs/core';
import type { Building } from '../../game/entities/Building';

export interface BuildingVisual {
    building: Building;
    mesh: Mesh;
    material: StandardMaterial;
    constructionIndicator: Mesh;
    energyIndicator: Mesh | null;
    rootNode: TransformNode;
    energyCore: Mesh | null;
    energyCoreMaterial: StandardMaterial | null;
    antennaRotator: Mesh | null;
    containmentRing: Mesh | null;
}

export interface BuildingMeshResult {
    mainMesh: Mesh;
    energyCore: Mesh;
    energyCoreMaterial: StandardMaterial;
    antennaRotator?: Mesh;
    containmentRing?: Mesh;
}

export interface BuildingConfig {
    color: { r: number; g: number; b: number };
    shape: string;
    size: { width?: number; height?: number; depth?: number; diameter?: number };
}

export interface BuildingRenderingStats {
    totalBuildings: number;
    activeBuildings: number;
    completedBuildings: number;
    buildingsByType: { [key: string]: number };
}
