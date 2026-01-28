/**
 * Unit Rendering Module - Barrel exports
 */

// Materials
export { UnitMaterialManager } from './UnitMaterials';
export type { UnitTypeConfig } from './UnitMaterials';

// Mesh factories
export { WorkerMeshFactory, ProtectorMeshFactory } from './UnitMeshFactories';

// Main renderer
export { UnitRenderer, type UnitVisual } from './UnitRenderer';
