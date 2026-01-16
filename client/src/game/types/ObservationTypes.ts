/**
 * ObservationTypes - Type definitions for continuous learning observation data
 *
 * These types define the game state data collected every 500ms and batched
 * every 10-20 seconds for transmission to the AI backend.
 */

/**
 * Basic position in 2D space
 */
export interface Position {
    x: number;
    y: number;
}

/**
 * Position with unit identification and optional health
 */
export interface UnitPosition extends Position {
    id: string;
    health?: number;
}

/**
 * Mining site position with resource and worker information
 */
export interface MiningPosition extends Position {
    id: string;
    resourceRemaining: number;
    workersAssigned: number;
}

/**
 * Combat event record
 */
export interface CombatEvent {
    timestamp: number;
    location: Position;
    parasitesInvolved: number;
    playerUnitsInvolved: number;
    outcome: 'queen_win' | 'player_win' | 'draw';
}

/**
 * Mining interruption event
 */
export interface MiningInterruptionEvent {
    timestamp: number;
    miningPosition: Position;
    duration: number; // How long the interruption lasted
    workersAffected: number;
}

/**
 * Player state data for observation
 */
export interface PlayerStateData {
    energy: number;
    maxEnergy: number;
    miningSites: MiningPosition[];
    workers: UnitPosition[];
    protectors: UnitPosition[];
    basePosition: Position;
    baseHealth: number;
    miningEfficiency: number; // Resources per second
}

/**
 * Queen/Hive state data for observation
 */
export interface QueenStateData {
    position: Position;
    health: number;
    parasites: UnitPosition[];
    hivePosition: Position;
    hiveDiscovered: boolean;
    lastSpawnTime: number;
    parasiteCount: number;
    /** Queen's current energy level for spawning (normalized 0-1) */
    energyLevel: number;
}

/**
 * Event data collected during observation window
 */
export interface ObservationEvents {
    miningInterruptions: MiningInterruptionEvent[];
    miningInterruptionCount: number;
    parasitesKilled: number;
    parasitesSpawned: number;
    playerUnitsKilled: number;
    combatEncounters: CombatEvent[];
    failedAttacks: number;
}

/**
 * Single game state snapshot collected every 500ms
 */
export interface GameStateSnapshot {
    timestamp: number;
    gameTime: number;
    player: PlayerStateData;
    queen: QueenStateData;
}

/**
 * Aggregated observation data sent to backend every 10-20 seconds
 */
export interface ObservationData {
    timestamp: number;
    gameTime: number;
    sequenceNumber: number;

    // Player state (aggregated from snapshots)
    player: PlayerStateData;

    // Queen state (aggregated from snapshots)
    queen: QueenStateData;

    // Events during observation window
    events: ObservationEvents;

    // Snapshot count for this batch
    snapshotCount: number;

    // Window duration in milliseconds
    windowDuration: number;
}

/**
 * Configuration for observation collection
 */
export interface ObservationCollectorConfig {
    /** Interval between snapshots in milliseconds (default: 500) */
    snapshotInterval: number;

    /** Interval between batch transmissions in milliseconds (default: 15000) */
    batchInterval: number;

    /** Maximum snapshots to buffer before forcing transmission */
    maxBufferSize: number;

    /** Combat event window in milliseconds (default: 20000) */
    combatEventWindow: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_OBSERVATION_CONFIG: ObservationCollectorConfig = {
    snapshotInterval: 500,
    batchInterval: 15000, // 15 seconds
    maxBufferSize: 60,    // 30 seconds worth at 500ms intervals
    combatEventWindow: 20000 // 20 seconds
};

/**
 * WebSocket message type for observation data
 */
export interface ObservationMessage {
    type: 'observation_data';
    payload: ObservationData;
    sequence: number;
}

/**
 * Heartbeat message type
 */
export interface HeartbeatMessage {
    type: 'heartbeat';
    timestamp: number;
    status: 'alive';
}

/**
 * Utility class for observation data operations
 */
export class ObservationUtils {
    /**
     * Calculate player mining efficiency from mining sites
     */
    static calculateMiningEfficiency(miningSites: MiningPosition[]): number {
        if (miningSites.length === 0) return 0;

        // Estimate resources per second based on workers and resource availability
        let totalEfficiency = 0;
        for (const site of miningSites) {
            if (site.resourceRemaining > 0 && site.workersAssigned > 0) {
                // Base mining rate per worker (can be tuned)
                const baseRate = 0.5;
                totalEfficiency += site.workersAssigned * baseRate;
            }
        }
        return totalEfficiency;
    }

    /**
     * Calculate average distance of workers from base
     */
    static calculateAvgWorkerDistance(workers: UnitPosition[], basePosition: Position): number {
        if (workers.length === 0) return 0;

        let totalDistance = 0;
        for (const worker of workers) {
            const dx = worker.x - basePosition.x;
            const dy = worker.y - basePosition.y;
            totalDistance += Math.sqrt(dx * dx + dy * dy);
        }
        return totalDistance / workers.length;
    }

    /**
     * Calculate centroid of unit positions
     */
    static calculateCentroid(positions: Position[]): Position {
        if (positions.length === 0) return { x: 0, y: 0 };

        let sumX = 0;
        let sumY = 0;
        for (const pos of positions) {
            sumX += pos.x;
            sumY += pos.y;
        }
        return {
            x: sumX / positions.length,
            y: sumY / positions.length
        };
    }

    /**
     * Determine combat outcome based on casualties
     */
    static determineCombatOutcome(
        parasitesLost: number,
        playerUnitsLost: number
    ): 'queen_win' | 'player_win' | 'draw' {
        if (parasitesLost === 0 && playerUnitsLost > 0) return 'queen_win';
        if (playerUnitsLost === 0 && parasitesLost > 0) return 'player_win';
        if (playerUnitsLost > parasitesLost) return 'queen_win';
        if (parasitesLost > playerUnitsLost) return 'player_win';
        return 'draw';
    }

    /**
     * Create an empty observation events object
     */
    static createEmptyEvents(): ObservationEvents {
        return {
            miningInterruptions: [],
            miningInterruptionCount: 0,
            parasitesKilled: 0,
            parasitesSpawned: 0,
            playerUnitsKilled: 0,
            combatEncounters: [],
            failedAttacks: 0
        };
    }
}
