/**
 * CombatUI - Re-export from refactored module location
 *
 * This file re-exports the CombatUI from its new modular location
 * for backwards compatibility with existing imports.
 */

export { CombatUI } from './combat/CombatUI';

export type {
    CombatUIConfig,
    CursorState
} from './combat/CombatUIInterfaces';
