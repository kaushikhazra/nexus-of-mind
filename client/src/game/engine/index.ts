/**
 * Game Engine Module - Clean imports for refactored engine components
 * 
 * This module provides a clean interface to the refactored GameEngine components:
 * - EngineCore: Babylon.js engine and scene management
 * - SystemManager: Game systems coordination and lifecycle
 * - InputHandler: Input event management and delegation
 * - GameEngine: Main facade coordinating all subsystems
 */

export { EngineCore } from './EngineCore';
export { SystemManager } from './SystemManager';
export { InputHandler } from './InputHandler';
export { UIManager } from './UIManager';
export { GameEngine } from './GameEngine';

// Re-export types for external consumers
export type { ThrottledSystem } from './types';
export type { UIComponents } from './UIManager';