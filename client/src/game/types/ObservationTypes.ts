/**
 * ObservationTypes - Type definitions for Queen NN observation data
 *
 * The observation system collects raw data from the game state every 15 seconds
 * and sends it to the backend for preprocessing into 28 normalized features.
 *
 * Data flow:
 * Frontend (raw data) → Backend (preprocessing) → NN (28 features) → Decision
 */

/**
 * Mining worker data with position and chunk ID
 */
export interface WorkerObservation {
    /** World X position */
    x: number;
    /** World Z position */
    z: number;
    /** Chunk ID (0-255) based on position */
    chunkId: number;
}

/**
 * Protector data with position and chunk ID
 */
export interface ProtectorObservation {
    /** World X position */
    x: number;
    /** World Z position */
    z: number;
    /** Chunk ID (0-255) based on position */
    chunkId: number;
}

/**
 * Parasite data with chunk and type
 */
export interface ParasiteObservation {
    /** Chunk ID (0-255) */
    chunkId: number;
    /** Parasite type: 'energy' or 'combat' */
    type: 'energy' | 'combat';
}

/**
 * Queen energy state for spawn capacity calculation
 */
export interface QueenEnergyObservation {
    /** Current energy level (0-100) */
    current: number;
    /** Maximum energy capacity (100) */
    max: number;
}

/**
 * Player energy at observation window boundaries
 * Used to calculate energy rate: (end - start) / max(start, end)
 */
export interface PlayerEnergyObservation {
    /** Player energy at window start */
    start: number;
    /** Player energy at window end */
    end: number;
}

/**
 * Parasite count snapshot for rate calculation
 * Tracked per chunk at window start/end
 */
export interface ParasiteSnapshot {
    /** Energy parasite count per chunk */
    energyByChunk: Map<number, number>;
    /** Combat parasite count per chunk */
    combatByChunk: Map<number, number>;
    /** Timestamp of snapshot */
    timestamp: number;
}

/**
 * Complete observation data sent to backend every 15 seconds
 *
 * Backend will preprocess this into 28 normalized features:
 * - 25 values: Top 5 chunks × 5 values each
 *   - Normalized chunk ID
 *   - Mining worker density
 *   - Protector density
 *   - Energy parasite rate
 *   - Combat parasite rate
 * - 2 values: Spawn capacities (energy, combat)
 * - 1 value: Player energy rate
 */
export interface ObservationData {
    /** Timestamp of observation */
    timestamp: number;

    /** All currently mining workers with positions and chunk IDs */
    miningWorkers: WorkerObservation[];

    /** All protectors with positions and chunk IDs */
    protectors: ProtectorObservation[];

    /** Parasites at window start (for rate calculation) */
    parasitesStart: ParasiteObservation[];

    /** Parasites at window end (current state) */
    parasitesEnd: ParasiteObservation[];

    /** Queen energy state */
    queenEnergy: QueenEnergyObservation;

    /** Player energy at window boundaries */
    playerEnergy: PlayerEnergyObservation;

    /** Territory ID being observed */
    territoryId: string;
}

/**
 * Spawn decision returned from backend after NN inference
 */
export interface SpawnDecision {
    /** Target chunk ID (0-255) */
    spawnChunk: number;
    /** Parasite type to spawn */
    spawnType: 'energy' | 'combat';
    /** Confidence score (optional, for debugging) */
    confidence?: number;
}

/**
 * Configuration for observation collection
 */
export interface ObservationConfig {
    /** Observation window duration in seconds (default: 15) */
    windowDuration: number;
    /** Chunk size in world units (default: 64) */
    chunkSize: number;
    /** Chunks per axis (default: 16, total 256 chunks) */
    chunksPerAxis: number;
}

/**
 * Default observation configuration
 */
export const DEFAULT_OBSERVATION_CONFIG: ObservationConfig = {
    windowDuration: 15,
    chunkSize: 64,
    chunksPerAxis: 16
};
