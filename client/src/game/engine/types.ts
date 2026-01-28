/**
 * Shared types for the game engine module
 */

/**
 * Interface for throttled system updates (round-robin scheduling)
 */
export interface ThrottledSystem {
    name: string;
    interval: number;      // ms between updates
    lastUpdate: number;    // timestamp of last update
    update: () => void;    // update function
}

/**
 * Interface for game systems that can be managed by SystemManager
 */
export interface GameSystem {
    update(deltaTime: number): void;
    dispose(): void;
    getName(): string;
}

/**
 * Configuration options for EngineCore initialization
 */
export interface EngineConfig {
    preserveDrawingBuffer?: boolean;
    stencil?: boolean;
    antialias?: boolean;
    alpha?: boolean;
    premultipliedAlpha?: boolean;
    powerPreference?: 'default' | 'high-performance' | 'low-power';
}