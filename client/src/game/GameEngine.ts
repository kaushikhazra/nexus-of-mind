/**
 * GameEngine - Re-export from refactored engine module
 * 
 * This file has been refactored into focused modules:
 * - EngineCore: Babylon.js engine and scene management
 * - SystemManager: Game systems coordination and lifecycle
 * - InputHandler: Input event management and delegation
 * - GameEngine: Main facade coordinating all subsystems
 */

// Re-export the refactored GameEngine for backward compatibility
export { GameEngine } from './engine/GameEngine';