/**
 * ObservationCollector - Collects game state for continuous learning
 *
 * Collects game state snapshots every 500ms (local only, no network calls).
 * Aggregates snapshots into observation batches every 10-20 seconds.
 * Sends batched data to AI backend for training.
 */

import { Vector3 } from '@babylonjs/core';
import {
    Position,
    UnitPosition,
    MiningPosition,
    CombatEvent,
    MiningInterruptionEvent,
    PlayerStateData,
    QueenStateData,
    ObservationEvents,
    GameStateSnapshot,
    ObservationData,
    ObservationCollectorConfig,
    DEFAULT_OBSERVATION_CONFIG,
    ObservationUtils
} from '../types/ObservationTypes';
import { GameState } from '../GameState';
import { UnitManager } from '../UnitManager';
import { ParasiteManager } from '../ParasiteManager';
import { TerritoryManager } from '../TerritoryManager';
import { EnergyManager } from '../EnergyManager';
import { SpatialIndex } from '../SpatialIndex';
import { Worker } from '../entities/Worker';
import { Protector } from '../entities/Protector';
import { WebSocketClient } from '../../networking/WebSocketClient';

/**
 * Callback type for when observation data is ready to send
 */
export type ObservationCallback = (data: ObservationData) => void;

/**
 * ObservationCollector - Game state collection system for continuous learning
 */
export class ObservationCollector {
    private config: ObservationCollectorConfig;

    // Dependencies
    private gameState: GameState;
    private unitManager: UnitManager;
    private parasiteManager: ParasiteManager;
    private territoryManager: TerritoryManager;
    private energyManager: EnergyManager;
    private spatialIndex: SpatialIndex | null = null;
    private websocketClient: WebSocketClient | null = null;

    // Timing
    private lastSnapshotTime: number = 0;
    private lastBatchTime: number = 0;

    // Buffering
    private snapshotBuffer: GameStateSnapshot[] = [];
    private sequenceNumber: number = 0;

    // Event tracking (accumulated between batches)
    private accumulatedEvents: ObservationEvents;
    private previousMiningState: Map<string, { workersAssigned: number; lastActiveTime: number }> = new Map();

    // State
    private isEnabled: boolean = true;
    private onObservationReady?: ObservationCallback;

    constructor(
        gameState: GameState,
        unitManager: UnitManager,
        parasiteManager: ParasiteManager,
        territoryManager: TerritoryManager,
        energyManager: EnergyManager,
        spatialIndex?: SpatialIndex | null,
        config?: Partial<ObservationCollectorConfig>
    ) {
        this.gameState = gameState;
        this.unitManager = unitManager;
        this.parasiteManager = parasiteManager;
        this.territoryManager = territoryManager;
        this.energyManager = energyManager;
        this.spatialIndex = spatialIndex || null;

        // Merge with defaults
        this.config = { ...DEFAULT_OBSERVATION_CONFIG, ...config };

        // Initialize accumulated events
        this.accumulatedEvents = ObservationUtils.createEmptyEvents();
    }

    /**
     * Set WebSocket client for sending observations
     */
    public setWebSocketClient(client: WebSocketClient): void {
        this.websocketClient = client;
    }

    /**
     * Set callback for when observation data is ready
     */
    public setOnObservationReady(callback: ObservationCallback): void {
        this.onObservationReady = callback;
    }

    /**
     * Enable or disable observation collection
     */
    public setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        if (!enabled) {
            this.snapshotBuffer = [];
            this.accumulatedEvents = ObservationUtils.createEmptyEvents();
        }
    }

    /**
     * Check if observation collection is enabled
     */
    public getIsEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Update the collector (called from game loop)
     * @param currentTime Current game time in milliseconds
     */
    public update(currentTime: number): void {
        if (!this.isEnabled) return;

        // Collect snapshot every 500ms (local only, no network)
        if (currentTime - this.lastSnapshotTime >= this.config.snapshotInterval) {
            this.collectSnapshot(currentTime);
            this.lastSnapshotTime = currentTime;
        }

        // Send batch every 10-20 seconds
        if (currentTime - this.lastBatchTime >= this.config.batchInterval) {
            this.sendBatch(currentTime);
            this.lastBatchTime = currentTime;
        }

        // Force send if buffer is full
        if (this.snapshotBuffer.length >= this.config.maxBufferSize) {
            this.sendBatch(currentTime);
        }
    }

    /**
     * Collect a game state snapshot
     */
    private collectSnapshot(currentTime: number): void {
        const snapshot: GameStateSnapshot = {
            timestamp: currentTime,
            gameTime: this.gameState.getGameTime(),
            player: this.collectPlayerState(),
            queen: this.collectQueenState()
        };

        this.snapshotBuffer.push(snapshot);

        // Track events (mining interruptions, etc.)
        this.trackEvents(snapshot);
    }

    /**
     * Collect player state data
     */
    private collectPlayerState(): PlayerStateData {
        const workers = this.unitManager.getUnitsByType('worker') as Worker[];
        const protectors = this.unitManager.getUnitsByType('protector') as Protector[];
        const deposits = this.gameState.getAllMineralDeposits();
        const stats = this.gameState.getGameStats();

        // Get base position (first building or center)
        const buildings = this.gameState.getAllBuildings();
        const baseBuilding = buildings.find(b => b.buildingType?.id === 'base') || buildings[0];
        const basePosition = baseBuilding
            ? this.vector3ToPosition(baseBuilding.position)
            : { x: 0, y: 0 };

        // Collect mining sites (all deposits with resources)
        const miningSites: MiningPosition[] = deposits
            .filter(d => d.getRemaining() > 0)
            .map(d => {
                const pos = d.getPosition();
                return {
                    id: d.getId(),
                    x: pos.x,
                    y: pos.z,
                    resourceRemaining: d.getRemaining(),
                    workersAssigned: this.countWorkersAtDeposit(workers, d)
                };
            });

        // Collect worker positions
        const workerPositions: UnitPosition[] = workers.map(w => {
            const pos = w.getPosition();
            return {
                id: w.getId(),
                x: pos.x,
                y: pos.z,
                health: w.getHealth()
            };
        });

        // Collect protector positions
        const protectorPositions: UnitPosition[] = protectors.map(p => {
            const pos = p.getPosition();
            return {
                id: p.getId(),
                x: pos.x,
                y: pos.z,
                health: p.getHealth()
            };
        });

        // Use a reasonable max energy estimate (starting energy * 2)
        const maxEnergy = 1000;

        return {
            energy: stats.currentEnergyLevel,
            maxEnergy: maxEnergy,
            miningSites,
            workers: workerPositions,
            protectors: protectorPositions,
            basePosition,
            baseHealth: 1.0, // TODO: Track base health when implemented
            miningEfficiency: ObservationUtils.calculateMiningEfficiency(miningSites)
        };
    }

    // Track if we've logged the spatial index status
    private hasLoggedSpatialIndexStatus: boolean = false;

    /**
     * Count workers near a mineral deposit using SpatialIndex for O(1) lookup
     */
    private countWorkersAtDeposit(workers: Worker[], deposit: any): number {
        const depositPos = deposit.getPosition();
        const miningRange = 10; // Approximate mining range

        // Use SpatialIndex for O(1) chunk-based lookup instead of O(n) scan
        if (this.spatialIndex) {
            if (!this.hasLoggedSpatialIndexStatus) {
                console.log('[ObservationCollector] ✅ Using SpatialIndex for O(1) lookups');
                this.hasLoggedSpatialIndexStatus = true;
            }
            const workerIds = this.spatialIndex.getEntitiesInRange(depositPos, miningRange, 'worker');
            return workerIds.length;
        }

        // Fallback to O(n) scan if no spatial index
        if (!this.hasLoggedSpatialIndexStatus) {
            console.warn('[ObservationCollector] ⚠️ FALLBACK: Using O(n) scan - SpatialIndex not available');
            this.hasLoggedSpatialIndexStatus = true;
        }
        return workers.filter(w => {
            const workerPos = w.getPosition();
            const dx = workerPos.x - depositPos.x;
            const dz = workerPos.z - depositPos.z;
            const distSquared = dx * dx + dz * dz;
            return distSquared <= miningRange * miningRange; // Avoid sqrt
        }).length;
    }

    /**
     * Collect Queen/Hive state data
     */
    private collectQueenState(): QueenStateData {
        const queens = this.territoryManager.getAllQueens();
        const parasites = this.parasiteManager.getParasites();

        // Get first active queen (primary focus)
        const activeQueen = queens.find(q => q.isActiveQueen());

        if (!activeQueen) {
            // No active Queen - return empty state
            return {
                position: { x: 0, y: 0 },
                health: 0,
                parasites: [],
                hivePosition: { x: 0, y: 0 },
                hiveDiscovered: false,
                lastSpawnTime: 0,
                parasiteCount: 0
            };
        }

        const queenPos = activeQueen.getPosition();
        const hive = activeQueen.getHive();
        const hivePos = hive ? hive.getPosition() : queenPos;
        const queenStats = activeQueen.getStats();

        // Collect parasite positions
        const parasitePositions: UnitPosition[] = parasites.map(p => {
            const pos = p.getPosition();
            return {
                id: p.getId(),
                x: pos.x,
                y: pos.z,
                health: p.getHealth()
            };
        });

        return {
            position: { x: queenPos.x, y: queenPos.z },
            health: queenStats.health / queenStats.maxHealth, // Normalized
            parasites: parasitePositions,
            hivePosition: { x: hivePos.x, y: hivePos.z },
            hiveDiscovered: false, // TODO: Implement hive discovery tracking
            lastSpawnTime: 0, // TODO: Track spawn time
            parasiteCount: parasites.length
        };
    }

    /**
     * Track events between snapshots
     */
    private trackEvents(snapshot: GameStateSnapshot): void {
        // Track mining interruptions
        this.trackMiningInterruptions(snapshot);
    }

    /**
     * Track mining interruptions by comparing current state to previous
     */
    private trackMiningInterruptions(snapshot: GameStateSnapshot): void {
        const currentTime = snapshot.timestamp;

        for (const site of snapshot.player.miningSites) {
            const previousState = this.previousMiningState.get(site.id);

            if (previousState) {
                // Check if workers left the site (possible interruption)
                if (previousState.workersAssigned > 0 && site.workersAssigned === 0) {
                    // Mining was interrupted
                    const interruptionDuration = currentTime - previousState.lastActiveTime;

                    this.accumulatedEvents.miningInterruptions.push({
                        timestamp: currentTime,
                        miningPosition: { x: site.x, y: site.y },
                        duration: interruptionDuration,
                        workersAffected: previousState.workersAssigned
                    });

                    this.accumulatedEvents.miningInterruptionCount++;
                }
            }

            // Update previous state
            this.previousMiningState.set(site.id, {
                workersAssigned: site.workersAssigned,
                lastActiveTime: site.workersAssigned > 0 ? currentTime : (previousState?.lastActiveTime || currentTime)
            });
        }
    }

    /**
     * Record a parasite death
     */
    public recordParasiteDeath(): void {
        this.accumulatedEvents.parasitesKilled++;
    }

    /**
     * Record a parasite spawn
     */
    public recordParasiteSpawn(): void {
        this.accumulatedEvents.parasitesSpawned++;
    }

    /**
     * Record a player unit death
     */
    public recordPlayerUnitDeath(): void {
        this.accumulatedEvents.playerUnitsKilled++;
    }

    /**
     * Record a failed attack
     */
    public recordFailedAttack(): void {
        this.accumulatedEvents.failedAttacks++;
    }

    /**
     * Record a combat encounter
     */
    public recordCombatEncounter(
        location: Position,
        parasitesInvolved: number,
        playerUnitsInvolved: number,
        outcome: 'queen_win' | 'player_win' | 'draw'
    ): void {
        // Only keep events within the combat window
        const currentTime = performance.now();
        const windowStart = currentTime - this.config.combatEventWindow;

        // Clean up old events
        this.accumulatedEvents.combatEncounters = this.accumulatedEvents.combatEncounters
            .filter(e => e.timestamp >= windowStart);

        // Add new event
        this.accumulatedEvents.combatEncounters.push({
            timestamp: currentTime,
            location,
            parasitesInvolved,
            playerUnitsInvolved,
            outcome
        });
    }

    /**
     * Send batched observation data to backend
     */
    private sendBatch(currentTime: number): void {
        if (this.snapshotBuffer.length === 0) return;

        // Aggregate snapshots into observation data
        const observationData = this.aggregateSnapshots(currentTime);

        // Send via WebSocket if available
        if (this.websocketClient) {
            console.log(`[ObservationCollector] Sending batch #${this.sequenceNumber} to server (${this.snapshotBuffer.length} snapshots, ${observationData.windowDuration.toFixed(0)}ms window)`);
            this.websocketClient.send({
                type: 'observation_data',
                data: observationData
            }).catch(err => {
                console.warn('Failed to send observation data:', err);
            });
        }

        // Call callback if set
        if (this.onObservationReady) {
            this.onObservationReady(observationData);
        }

        // Reset for next batch
        this.snapshotBuffer = [];
        this.accumulatedEvents = ObservationUtils.createEmptyEvents();
        this.sequenceNumber++;
    }

    /**
     * Aggregate snapshots into observation data
     */
    private aggregateSnapshots(currentTime: number): ObservationData {
        // Use the most recent snapshot for current state
        const latestSnapshot = this.snapshotBuffer[this.snapshotBuffer.length - 1];
        const firstSnapshot = this.snapshotBuffer[0];

        return {
            timestamp: currentTime,
            gameTime: latestSnapshot.gameTime,
            sequenceNumber: this.sequenceNumber,
            player: latestSnapshot.player,
            queen: latestSnapshot.queen,
            events: { ...this.accumulatedEvents },
            snapshotCount: this.snapshotBuffer.length,
            windowDuration: currentTime - firstSnapshot.timestamp
        };
    }

    /**
     * Convert Vector3 to Position
     */
    private vector3ToPosition(v: Vector3): Position {
        return { x: v.x, y: v.z };
    }

    /**
     * Get current buffer size
     */
    public getBufferSize(): number {
        return this.snapshotBuffer.length;
    }

    /**
     * Get current sequence number
     */
    public getSequenceNumber(): number {
        return this.sequenceNumber;
    }

    /**
     * Get accumulated events (for debugging)
     */
    public getAccumulatedEvents(): ObservationEvents {
        return { ...this.accumulatedEvents };
    }

    /**
     * Get configuration
     */
    public getConfig(): ObservationCollectorConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    public updateConfig(config: Partial<ObservationCollectorConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Force an immediate batch send (for testing)
     */
    public forceSend(): void {
        if (this.snapshotBuffer.length > 0) {
            this.sendBatch(performance.now());
        }
    }

    /**
     * Reset the collector state
     */
    public reset(): void {
        this.snapshotBuffer = [];
        this.accumulatedEvents = ObservationUtils.createEmptyEvents();
        this.previousMiningState.clear();
        this.lastSnapshotTime = 0;
        this.lastBatchTime = 0;
        this.sequenceNumber = 0;
    }

    /**
     * Dispose the collector
     */
    public dispose(): void {
        this.setEnabled(false);
        this.websocketClient = null;
        this.onObservationReady = undefined;
    }
}
