/**
 * Emblem Module - Barrel exports for emblem system
 */

// Interfaces and types
export type {
    EmblemDesign,
    EmblemConfig,
    EmblemColorTheme,
    MaterialOptions
} from './EmblemInterfaces';

export {
    DEFAULT_EMBLEM_CONFIG,
    CYAN_THEME,
    EMERALD_THEME,
    GOLD_BLACK_THEME
} from './EmblemInterfaces';

// Animations
export type { AnimationConfig } from './EmblemAnimations';
export {
    DEFAULT_ANIMATION_CONFIG,
    addPulsingAnimation,
    addRotationAnimation,
    addGlowAnimation,
    addHoverAnimation,
    createEmblemAnimationSet
} from './EmblemAnimations';

// Materials
export { EmblemMaterialManager } from './EmblemMaterials';

// Shape factories
export { EmblemShapeFactory } from './EmblemShapes';
export { EmblemComplexShapeFactory } from './EmblemComplexShapes';
export { KorenthiFaceFactory } from './KorenthiFaceShapes';
export { EnergyLordsEmblemFactory } from './EnergyLordsEmblem';

// Main emblem geometry class
export { EmblemGeometry } from './EmblemGeometry';
