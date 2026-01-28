/**
 * CombatEffects - Re-export from refactored module location
 *
 * This file re-exports the CombatEffects from its new modular location
 * for backwards compatibility with existing imports.
 */

export { CombatEffects } from './combat/CombatEffects';

export type {
    EffectConfig,
    EnergyBeamConfig,
    DamageEffectConfig,
    DestructionEffectConfig,
    FloatingNumberConfig,
    EffectTrackingData
} from './combat/CombatEffectInterfaces';
