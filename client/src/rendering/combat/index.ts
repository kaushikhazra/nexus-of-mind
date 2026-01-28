/**
 * Combat Effects Module - Barrel exports
 */

// Interfaces
export type {
    EffectConfig,
    EnergyBeamConfig,
    DamageEffectConfig,
    DestructionEffectConfig,
    FloatingNumberConfig,
    EffectTrackingData
} from './CombatEffectInterfaces';

// Materials
export { CombatEffectMaterials } from './CombatEffectMaterials';

// Effect creators
export { EnergyBeamEffects } from './EnergyBeamEffects';
export { DamageEffects } from './DamageEffects';
export { DestructionEffects } from './DestructionEffects';
export { FloatingNumberEffects } from './FloatingNumberEffects';

// Main coordinator
export { CombatEffects } from './CombatEffects';
