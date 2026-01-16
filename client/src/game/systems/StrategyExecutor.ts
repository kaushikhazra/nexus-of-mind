/**
 * StrategyExecutor - Applies AI strategies to Queen behavior
 *
 * Receives strategy updates from the AI backend and translates them
 * into Queen spawn decisions and swarm behavior commands.
 * Implements smooth transitions between strategies.
 */

import { Vector3 } from '@babylonjs/core';
import {
    StrategyUpdate,
    SpawnDecision,
    SwarmBehavior,
    TargetPriority,
    FormationType,
    AttackTiming,
    DEFAULT_STRATEGY,
    STRATEGY_STALENESS_THRESHOLD,
    STRATEGY_TRANSITION_DURATION,
    StrategyUtils
} from '../types/StrategyTypes';
import { Position } from '../types/ObservationTypes';

/**
 * Map boundaries for converting normalized positions to world positions
 */
export interface MapBounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

/**
 * Callback for when a new spawn decision is ready
 */
export type SpawnDecisionCallback = (decision: SpawnDecision) => void;

/**
 * Callback for when swarm behavior changes
 */
export type SwarmBehaviorCallback = (behavior: SwarmBehavior) => void;

/**
 * StrategyExecutor - Translates AI strategies into Queen actions
 */
export class StrategyExecutor {
    // Strategy state
    private currentStrategy: StrategyUpdate | null = null;
    private previousStrategy: StrategyUpdate | null = null;
    private interpolatedStrategy: StrategyUpdate | null = null;

    // Transition state
    private transitionStartTime: number = 0;
    private transitionDuration: number = STRATEGY_TRANSITION_DURATION;
    private isTransitioning: boolean = false;

    // Map bounds for position conversion
    private mapBounds: MapBounds;

    // Callbacks
    private onSpawnDecision?: SpawnDecisionCallback;
    private onSwarmBehaviorChange?: SwarmBehaviorCallback;

    // Spawn timing
    private lastSpawnTime: number = 0;
    private spawnAccumulator: number = 0;

    // State
    private isEnabled: boolean = true;

    constructor(mapBounds: MapBounds) {
        this.mapBounds = mapBounds;
    }

    /**
     * Apply a new strategy update from the AI backend
     */
    public applyStrategy(strategy: StrategyUpdate): void {
        if (!this.isEnabled) return;

        // Store previous strategy for interpolation
        this.previousStrategy = this.currentStrategy || { ...DEFAULT_STRATEGY };
        this.currentStrategy = strategy;

        // Start transition
        this.transitionStartTime = performance.now();
        this.isTransitioning = true;

        // Log strategy reception
        console.log(`[StrategyExecutor] 📥 RECEIVED strategy v${strategy.version} (confidence: ${(strategy.confidence * 100).toFixed(0)}%)`);
        console.log(`[StrategyExecutor]    Spawn: zone(${strategy.spawn.zone.x.toFixed(2)}, ${strategy.spawn.zone.y.toFixed(2)}), rate=${strategy.spawn.rate.toFixed(2)}, burst=${strategy.spawn.burstSize}`);
        console.log(`[StrategyExecutor]    Tactics: aggression=${(strategy.tactics.aggression * 100).toFixed(0)}%, target=${strategy.tactics.targetPriority}, formation=${strategy.tactics.formation}`);
        console.log(`[StrategyExecutor]    Starting ${this.transitionDuration}ms transition...`);
    }

    /**
     * Update the executor (called from game loop)
     * @param deltaTime Time since last update in seconds
     */
    public update(deltaTime: number): void {
        if (!this.isEnabled) return;

        // Handle strategy transition
        this.updateTransition();

        // Process spawn timing
        this.updateSpawning(deltaTime);
    }

    /**
     * Update strategy transition interpolation
     */
    private updateTransition(): void {
        if (!this.isTransitioning || !this.currentStrategy || !this.previousStrategy) {
            this.interpolatedStrategy = this.currentStrategy;
            return;
        }

        const elapsed = performance.now() - this.transitionStartTime;
        const t = Math.min(1, elapsed / this.transitionDuration);

        // Interpolate strategies
        this.interpolatedStrategy = StrategyUtils.interpolate(
            this.previousStrategy,
            this.currentStrategy,
            t
        );

        // Check if transition is complete
        if (t >= 1) {
            this.isTransitioning = false;

            // Log strategy implementation
            const behavior = this.getSwarmBehavior();
            console.log(`[StrategyExecutor] ✅ IMPLEMENTED strategy v${this.currentStrategy?.version || 0}`);
            console.log(`[StrategyExecutor]    Active behavior: aggression=${(behavior.aggression * 100).toFixed(0)}%, target=${behavior.targetPriority}, formation=${behavior.formation}`);

            // Notify of behavior change when transition completes
            if (this.onSwarmBehaviorChange) {
                this.onSwarmBehaviorChange(behavior);
            }
        }
    }

    /**
     * Update spawn timing and trigger spawns
     */
    private updateSpawning(deltaTime: number): void {
        const strategy = this.getEffectiveStrategy();
        if (!strategy) return;

        // Accumulate spawn time
        this.spawnAccumulator += deltaTime * strategy.spawn.rate;

        // Trigger spawn when accumulator reaches 1
        while (this.spawnAccumulator >= 1) {
            this.spawnAccumulator -= 1;
            this.triggerSpawn();
        }
    }

    /**
     * Trigger a spawn decision
     */
    private triggerSpawn(): void {
        if (!this.onSpawnDecision) return;

        const decision = this.getSpawnDecision();
        this.onSpawnDecision(decision);
        this.lastSpawnTime = performance.now();
    }

    /**
     * Get current spawn decision based on strategy
     */
    public getSpawnDecision(): SpawnDecision {
        const strategy = this.getEffectiveStrategy();

        // Convert normalized spawn zone to world position
        const worldPosition = this.normalizedToWorld(strategy.spawn.zone);

        return {
            position: worldPosition,
            count: strategy.spawn.burstSize,
            rate: strategy.spawn.rate,
            isBurst: strategy.spawn.burstSize > 1
        };
    }

    /**
     * Get current swarm behavior based on strategy
     */
    public getSwarmBehavior(): SwarmBehavior {
        const strategy = this.getEffectiveStrategy();

        return {
            aggression: strategy.tactics.aggression,
            targetPriority: strategy.tactics.targetPriority,
            formation: strategy.tactics.formation,
            attackTiming: strategy.tactics.attackTiming
        };
    }

    /**
     * Get the effective strategy (interpolated or current)
     */
    public getEffectiveStrategy(): StrategyUpdate {
        // Use interpolated during transition
        if (this.isTransitioning && this.interpolatedStrategy) {
            return this.interpolatedStrategy;
        }

        // Use current if available and not stale
        if (this.currentStrategy && !StrategyUtils.isStale(this.currentStrategy)) {
            return this.currentStrategy;
        }

        // Fall back to default
        return DEFAULT_STRATEGY;
    }

    /**
     * Convert normalized position (0-1) to world position
     */
    private normalizedToWorld(normalized: Position): Position {
        return {
            x: this.mapBounds.minX + normalized.x * (this.mapBounds.maxX - this.mapBounds.minX),
            y: this.mapBounds.minZ + normalized.y * (this.mapBounds.maxZ - this.mapBounds.minZ)
        };
    }

    /**
     * Convert world position to Vector3 (for Babylon.js)
     */
    public positionToVector3(pos: Position, height: number = 0): Vector3 {
        return new Vector3(pos.x, height, pos.y);
    }

    /**
     * Set callback for spawn decisions
     */
    public setOnSpawnDecision(callback: SpawnDecisionCallback): void {
        this.onSpawnDecision = callback;
    }

    /**
     * Set callback for swarm behavior changes
     */
    public setOnSwarmBehaviorChange(callback: SwarmBehaviorCallback): void {
        this.onSwarmBehaviorChange = callback;
    }

    /**
     * Enable or disable the executor
     */
    public setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
    }

    /**
     * Check if executor is enabled
     */
    public getIsEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Check if currently transitioning between strategies
     */
    public isInTransition(): boolean {
        return this.isTransitioning;
    }

    /**
     * Get transition progress (0-1)
     */
    public getTransitionProgress(): number {
        if (!this.isTransitioning) return 1;

        const elapsed = performance.now() - this.transitionStartTime;
        return Math.min(1, elapsed / this.transitionDuration);
    }

    /**
     * Get current strategy version
     */
    public getCurrentVersion(): number {
        return this.currentStrategy?.version || 0;
    }

    /**
     * Get current strategy confidence
     */
    public getCurrentConfidence(): number {
        return this.getEffectiveStrategy().confidence;
    }

    /**
     * Check if using fallback strategy
     */
    public isUsingFallback(): boolean {
        if (!this.currentStrategy) return true;
        return StrategyUtils.isStale(this.currentStrategy);
    }

    /**
     * Get secondary spawn zones (if available)
     */
    public getSecondarySpawnZones(): Position[] {
        const strategy = this.getEffectiveStrategy();
        if (!strategy.spawn.secondaryZones) return [];

        return strategy.spawn.secondaryZones.map(zone => this.normalizedToWorld(zone));
    }

    /**
     * Get all spawn positions as Vector3 (including secondary)
     */
    public getAllSpawnPositions(height: number = 1): Vector3[] {
        const positions: Vector3[] = [];

        // Primary spawn position
        const primary = this.getSpawnDecision().position;
        positions.push(this.positionToVector3(primary, height));

        // Secondary positions
        for (const secondary of this.getSecondarySpawnZones()) {
            positions.push(this.positionToVector3(secondary, height));
        }

        return positions;
    }

    /**
     * Update map bounds
     */
    public setMapBounds(bounds: MapBounds): void {
        this.mapBounds = bounds;
    }

    /**
     * Get current map bounds
     */
    public getMapBounds(): MapBounds {
        return { ...this.mapBounds };
    }

    /**
     * Set transition duration
     */
    public setTransitionDuration(duration: number): void {
        this.transitionDuration = duration;
    }

    /**
     * Force apply strategy without transition
     */
    public forceApplyStrategy(strategy: StrategyUpdate): void {
        this.currentStrategy = strategy;
        this.previousStrategy = strategy;
        this.interpolatedStrategy = strategy;
        this.isTransitioning = false;

        // Notify immediately
        if (this.onSwarmBehaviorChange) {
            this.onSwarmBehaviorChange(this.getSwarmBehavior());
        }
    }

    /**
     * Reset to default strategy
     */
    public resetToDefault(): void {
        this.forceApplyStrategy(DEFAULT_STRATEGY);
        this.spawnAccumulator = 0;
    }

    /**
     * Get debug info about current state
     */
    public getDebugInfo(): {
        version: number;
        confidence: number;
        isTransitioning: boolean;
        transitionProgress: number;
        usingFallback: boolean;
        spawnRate: number;
        aggression: number;
        targetPriority: TargetPriority;
        formation: FormationType;
    } {
        const strategy = this.getEffectiveStrategy();

        return {
            version: strategy.version,
            confidence: strategy.confidence,
            isTransitioning: this.isTransitioning,
            transitionProgress: this.getTransitionProgress(),
            usingFallback: this.isUsingFallback(),
            spawnRate: strategy.spawn.rate,
            aggression: strategy.tactics.aggression,
            targetPriority: strategy.tactics.targetPriority,
            formation: strategy.tactics.formation
        };
    }

    /**
     * Dispose the executor
     */
    public dispose(): void {
        this.setEnabled(false);
        this.currentStrategy = null;
        this.previousStrategy = null;
        this.interpolatedStrategy = null;
        this.onSpawnDecision = undefined;
        this.onSwarmBehaviorChange = undefined;
    }
}
