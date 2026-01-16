/**
 * StrategyTypes - Type definitions for Queen strategy updates from AI backend
 *
 * These types define the strategy data received from the neural network
 * every 10-20 seconds to control Queen behavior.
 */

import { Position } from './ObservationTypes';

/**
 * Target priority for swarm attacks
 */
export enum TargetPriority {
    MINERS = 'MINERS',         // Focus on disrupting resource collection
    PROTECTORS = 'PROTECTORS', // Eliminate defensive units first
    BASE = 'BASE',             // Direct assault on player structures
    BALANCED = 'BALANCED'      // Distribute attacks evenly
}

/**
 * Formation type for swarm behavior
 */
export enum FormationType {
    SWARM = 'SWARM',           // All parasites converge on target
    FLANK = 'FLANK',           // Split forces to attack from multiple angles
    SURROUND = 'SURROUND',     // Encircle target area
    DEFENSIVE = 'DEFENSIVE'    // Protect hive and territory
}

/**
 * Attack timing strategy
 */
export enum AttackTiming {
    IMMEDIATE = 'IMMEDIATE',       // Attack as soon as possible
    DELAYED = 'DELAYED',           // Wait for better opportunity
    OPPORTUNISTIC = 'OPPORTUNISTIC' // Attack when conditions favor
}

/**
 * Spawn control parameters
 */
export interface SpawnControl {
    /** Primary spawn location (normalized coordinates) */
    zone: Position;

    /** Parasites per second (0.1 - 2.0) */
    rate: number;

    /** Parasites per burst (1-10) */
    burstSize: number;

    /** Alternative spawn points for multi-location spawning */
    secondaryZones?: Position[];
}

/**
 * Tactical control parameters
 */
export interface TacticalControl {
    /** Aggression level: 0 (defensive) to 1 (offensive) */
    aggression: number;

    /** Which targets to prioritize */
    targetPriority: TargetPriority;

    /** How to organize the swarm */
    formation: FormationType;

    /** When to engage */
    attackTiming: AttackTiming;
}

/**
 * Debug information from training (optional)
 */
export interface StrategyDebugInfo {
    /** Reward signal from last observation */
    rewardSignal: number;

    /** Training loss value */
    trainingLoss: number;

    /** Feature importance weights (20 values) */
    featureImportance: number[];

    /** Model confidence in this strategy */
    modelConfidence: number;
}

/**
 * Complete strategy update from backend
 */
export interface StrategyUpdate {
    /** Timestamp when strategy was generated */
    timestamp: number;

    /** Incremental strategy version number */
    version: number;

    /** Model confidence in this strategy (0-1) */
    confidence: number;

    /** Spawn control parameters */
    spawn: SpawnControl;

    /** Tactical control parameters */
    tactics: TacticalControl;

    /** Debug info (optional, for development) */
    debug?: StrategyDebugInfo;
}

/**
 * WebSocket message type for strategy updates
 */
export interface StrategyUpdateMessage {
    type: 'strategy_update';
    payload: StrategyUpdate;
    inResponseTo: number; // Sequence number of observation that triggered this
}

/**
 * Spawn decision for Queen to execute
 */
export interface SpawnDecision {
    /** World position to spawn at */
    position: Position;

    /** Number of parasites to spawn */
    count: number;

    /** Spawn rate (parasites per second) */
    rate: number;

    /** Whether this is a burst spawn */
    isBurst: boolean;
}

/**
 * Swarm behavior parameters for parasites
 */
export interface SwarmBehavior {
    /** Aggression level (0-1) */
    aggression: number;

    /** Current target priority */
    targetPriority: TargetPriority;

    /** Current formation type */
    formation: FormationType;

    /** Attack timing mode */
    attackTiming: AttackTiming;
}

/**
 * Default fallback strategy when backend is unavailable
 */
export const DEFAULT_STRATEGY: StrategyUpdate = {
    timestamp: 0,
    version: 0,
    confidence: 0.5,
    spawn: {
        zone: { x: 0.5, y: 0.5 }, // Center of territory
        rate: 0.5, // Moderate spawn rate
        burstSize: 3
    },
    tactics: {
        aggression: 0.7, // Moderately aggressive
        targetPriority: TargetPriority.MINERS,
        formation: FormationType.SWARM,
        attackTiming: AttackTiming.OPPORTUNISTIC
    }
};

/**
 * Strategy staleness threshold in milliseconds
 * If strategy is older than this, fall back to default
 */
export const STRATEGY_STALENESS_THRESHOLD = 30000; // 30 seconds

/**
 * Transition duration for smooth strategy changes (milliseconds)
 */
export const STRATEGY_TRANSITION_DURATION = 1500; // 1.5 seconds

/**
 * Utility class for strategy operations
 */
export class StrategyUtils {
    /**
     * Check if a strategy is stale
     */
    static isStale(strategy: StrategyUpdate): boolean {
        return Date.now() - strategy.timestamp > STRATEGY_STALENESS_THRESHOLD;
    }

    /**
     * Interpolate between two strategies for smooth transitions
     * @param from Previous strategy
     * @param to New strategy
     * @param t Interpolation factor (0-1)
     */
    static interpolate(from: StrategyUpdate, to: StrategyUpdate, t: number): StrategyUpdate {
        // Clamp t to [0, 1]
        t = Math.max(0, Math.min(1, t));

        return {
            timestamp: to.timestamp,
            version: to.version,
            confidence: from.confidence + (to.confidence - from.confidence) * t,
            spawn: {
                zone: {
                    x: from.spawn.zone.x + (to.spawn.zone.x - from.spawn.zone.x) * t,
                    y: from.spawn.zone.y + (to.spawn.zone.y - from.spawn.zone.y) * t
                },
                rate: from.spawn.rate + (to.spawn.rate - from.spawn.rate) * t,
                burstSize: Math.round(from.spawn.burstSize + (to.spawn.burstSize - from.spawn.burstSize) * t),
                secondaryZones: to.spawn.secondaryZones
            },
            tactics: {
                aggression: from.tactics.aggression + (to.tactics.aggression - from.tactics.aggression) * t,
                // Discrete values snap at t >= 0.5
                targetPriority: t >= 0.5 ? to.tactics.targetPriority : from.tactics.targetPriority,
                formation: t >= 0.5 ? to.tactics.formation : from.tactics.formation,
                attackTiming: t >= 0.5 ? to.tactics.attackTiming : from.tactics.attackTiming
            },
            debug: to.debug
        };
    }

    /**
     * Convert NN output (0-1) to target priority enum
     */
    static outputToTargetPriority(value: number): TargetPriority {
        if (value < 0.25) return TargetPriority.MINERS;
        if (value < 0.5) return TargetPriority.PROTECTORS;
        if (value < 0.75) return TargetPriority.BASE;
        return TargetPriority.BALANCED;
    }

    /**
     * Convert NN output (0-1) to formation type enum
     */
    static outputToFormation(value: number): FormationType {
        if (value < 0.25) return FormationType.SWARM;
        if (value < 0.5) return FormationType.FLANK;
        if (value < 0.75) return FormationType.SURROUND;
        return FormationType.DEFENSIVE;
    }

    /**
     * Convert NN output (0-1) to attack timing enum
     */
    static outputToAttackTiming(value: number): AttackTiming {
        if (value < 0.33) return AttackTiming.IMMEDIATE;
        if (value < 0.67) return AttackTiming.DELAYED;
        return AttackTiming.OPPORTUNISTIC;
    }

    /**
     * Convert spawn rate output (0-1) to actual rate (0.1-2.0)
     */
    static outputToSpawnRate(value: number): number {
        return 0.1 + value * 1.9; // Map [0,1] to [0.1, 2.0]
    }

    /**
     * Convert burst size output (0-1) to actual count (1-10)
     */
    static outputToBurstSize(value: number): number {
        return Math.round(1 + value * 9); // Map [0,1] to [1, 10]
    }

    /**
     * Convert normalized position (0-1) to world position
     * @param normalized Normalized position (0-1 range)
     * @param mapBounds Map boundaries {minX, maxX, minY, maxY}
     */
    static normalizedToWorldPosition(
        normalized: Position,
        mapBounds: { minX: number; maxX: number; minY: number; maxY: number }
    ): Position {
        return {
            x: mapBounds.minX + normalized.x * (mapBounds.maxX - mapBounds.minX),
            y: mapBounds.minY + normalized.y * (mapBounds.maxY - mapBounds.minY)
        };
    }

    /**
     * Get a human-readable description of the strategy
     */
    static describe(strategy: StrategyUpdate): string {
        const parts = [
            `Aggression: ${(strategy.tactics.aggression * 100).toFixed(0)}%`,
            `Target: ${strategy.tactics.targetPriority}`,
            `Formation: ${strategy.tactics.formation}`,
            `Spawn Rate: ${strategy.spawn.rate.toFixed(1)}/s`,
            `Confidence: ${(strategy.confidence * 100).toFixed(0)}%`
        ];
        return parts.join(' | ');
    }
}
