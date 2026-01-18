/**
 * ObservationCollector - Chunk-based observation collection for Queen NN
 *
 * Collects raw game state data every 15 seconds and formats it for backend
 * preprocessing. The backend converts this into 28 normalized features for the NN.
 *
 * Key responsibilities:
 * - Track 15-second observation windows
 * - Collect mining worker positions and chunk IDs (O(1) via UnitManager Set)
 * - Collect protector positions and chunk IDs
 * - Track parasite counts at window start/end for rate calculation
 * - Capture Queen energy state for spawn capacity
 * - Track player energy trends
 */

import {
    ObservationData,
    WorkerObservation,
    ProtectorObservation,
    ParasiteObservation,
    QueenEnergyObservation,
    PlayerEnergyObservation,
    ParasiteSnapshot,
    ObservationConfig,
    DEFAULT_OBSERVATION_CONFIG
} from '../types/ObservationTypes';
import { GameEngine } from '../GameEngine';
import { Worker } from '../entities/Worker';
import { Protector } from '../entities/Protector';
import { Queen } from '../entities/Queen';
import { EnergyParasite } from '../entities/EnergyParasite';
import { CombatParasite } from '../entities/CombatParasite';

export class ObservationCollector {
    private config: ObservationConfig;

    // Window tracking
    private windowStartTime: number = 0;
    private isWindowActive: boolean = false;

    // Snapshots at window boundaries
    private startSnapshot: ParasiteSnapshot | null = null;
    private playerEnergyStart: number = 0;

    // Callback for when observation is ready
    private onObservationReadyCallbacks: ((data: ObservationData) => void)[] = [];

    // Cached references
    private gameEngine: GameEngine | null = null;

    constructor(config: Partial<ObservationConfig> = {}) {
        this.config = { ...DEFAULT_OBSERVATION_CONFIG, ...config };
    }

    /**
     * Start a new observation window
     * Called when Queen enters active control or at regular intervals
     */
    public startWindow(territoryId: string): void {
        this.windowStartTime = performance.now();
        this.isWindowActive = true;

        // Capture start snapshots
        this.startSnapshot = this.captureParasiteSnapshot();
        this.playerEnergyStart = this.getPlayerEnergy();
    }

    /**
     * Update the collector (called from game loop)
     * Checks if window has elapsed and triggers observation collection
     */
    public update(deltaTime: number, territoryId: string): void {
        if (!this.isWindowActive) {
            return;
        }

        const elapsed = (performance.now() - this.windowStartTime) / 1000;

        if (elapsed >= this.config.windowDuration) {
            // Window complete - collect and emit observation
            const observation = this.collectObservation(territoryId);
            this.emitObservation(observation);

            // Start new window
            this.startWindow(territoryId);
        }
    }

    /**
     * Collect complete observation data
     */
    public collectObservation(territoryId: string): ObservationData {
        // Cache game engine reference
        if (!this.gameEngine) {
            this.gameEngine = GameEngine.getInstance();
        }

        return {
            timestamp: Date.now(),
            miningWorkers: this.collectMiningWorkers(),
            protectors: this.collectProtectors(),
            parasitesStart: this.snapshotToObservations(this.startSnapshot),
            parasitesEnd: this.collectCurrentParasites(),
            queenEnergy: this.collectQueenEnergy(territoryId),
            playerEnergy: {
                start: this.playerEnergyStart,
                end: this.getPlayerEnergy()
            },
            territoryId
        };
    }

    /**
     * Collect mining workers with positions and chunk IDs
     * Uses O(1) Set access from UnitManager
     */
    private collectMiningWorkers(): WorkerObservation[] {
        const unitManager = this.gameEngine?.getUnitManager();
        if (!unitManager) {
            return [];
        }

        const miningWorkers = unitManager.getMiningWorkers();
        const observations: WorkerObservation[] = [];

        for (const worker of miningWorkers) {
            const pos = worker.getPosition();
            observations.push({
                x: pos.x,
                z: pos.z,
                chunkId: worker.getChunkId()
            });
        }

        return observations;
    }

    /**
     * Collect protectors with positions and chunk IDs
     */
    private collectProtectors(): ProtectorObservation[] {
        const unitManager = this.gameEngine?.getUnitManager();
        if (!unitManager) {
            return [];
        }

        const protectors = unitManager.getUnitsByType('protector') as Protector[];
        const observations: ProtectorObservation[] = [];

        for (const protector of protectors) {
            const pos = protector.getPosition();
            observations.push({
                x: pos.x,
                z: pos.z,
                chunkId: this.calculateChunkId(pos.x, pos.z)
            });
        }

        return observations;
    }

    /**
     * Collect current parasites with chunk IDs
     */
    private collectCurrentParasites(): ParasiteObservation[] {
        const parasiteManager = this.gameEngine?.getParasiteManager();
        if (!parasiteManager) {
            return [];
        }

        const parasites = parasiteManager.getParasites();
        const observations: ParasiteObservation[] = [];

        for (const parasite of parasites) {
            const pos = parasite.getPosition();
            const type = parasite instanceof CombatParasite ? 'combat' : 'energy';
            observations.push({
                chunkId: this.calculateChunkId(pos.x, pos.z),
                type
            });
        }

        return observations;
    }

    /**
     * Capture parasite snapshot for rate calculation
     */
    private captureParasiteSnapshot(): ParasiteSnapshot {
        const parasiteManager = this.gameEngine?.getParasiteManager();
        const energyByChunk = new Map<number, number>();
        const combatByChunk = new Map<number, number>();

        if (parasiteManager) {
            const parasites = parasiteManager.getParasites();

            for (const parasite of parasites) {
                const pos = parasite.getPosition();
                const chunkId = this.calculateChunkId(pos.x, pos.z);
                const isCombat = parasite instanceof CombatParasite;

                if (isCombat) {
                    combatByChunk.set(chunkId, (combatByChunk.get(chunkId) || 0) + 1);
                } else {
                    energyByChunk.set(chunkId, (energyByChunk.get(chunkId) || 0) + 1);
                }
            }
        }

        return {
            energyByChunk,
            combatByChunk,
            timestamp: Date.now()
        };
    }

    /**
     * Convert parasite snapshot to observation array
     */
    private snapshotToObservations(snapshot: ParasiteSnapshot | null): ParasiteObservation[] {
        if (!snapshot) {
            return [];
        }

        const observations: ParasiteObservation[] = [];

        // Add energy parasites
        for (const [chunkId, count] of snapshot.energyByChunk) {
            for (let i = 0; i < count; i++) {
                observations.push({ chunkId, type: 'energy' });
            }
        }

        // Add combat parasites
        for (const [chunkId, count] of snapshot.combatByChunk) {
            for (let i = 0; i < count; i++) {
                observations.push({ chunkId, type: 'combat' });
            }
        }

        return observations;
    }

    /**
     * Collect Queen energy state
     */
    private collectQueenEnergy(territoryId: string): QueenEnergyObservation {
        const territoryManager = this.gameEngine?.getTerritoryManager();
        if (!territoryManager) {
            return { current: 0, max: 100 };
        }

        const territory = territoryManager.getTerritory(territoryId);
        const queen = territory?.queen;

        if (!queen || !queen.isActiveQueen()) {
            return { current: 0, max: 100 };
        }

        const energyState = queen.getEnergyState();
        return {
            current: energyState.current,
            max: energyState.max
        };
    }

    /**
     * Get current player energy
     */
    private getPlayerEnergy(): number {
        const gameState = this.gameEngine?.getGameState();
        if (!gameState) {
            return 0;
        }

        return gameState.getEnergy();
    }

    /**
     * Calculate chunk ID from world position
     */
    private calculateChunkId(x: number, z: number): number {
        const chunkX = Math.floor(x / this.config.chunkSize);
        const chunkZ = Math.floor(z / this.config.chunkSize);

        // Bounds check
        if (chunkX < 0 || chunkX >= this.config.chunksPerAxis ||
            chunkZ < 0 || chunkZ >= this.config.chunksPerAxis) {
            return -1;
        }

        return chunkZ * this.config.chunksPerAxis + chunkX;
    }

    /**
     * Emit observation to all registered callbacks
     */
    private emitObservation(observation: ObservationData): void {
        for (const callback of this.onObservationReadyCallbacks) {
            callback(observation);
        }
    }

    /**
     * Register callback for when observation is ready
     */
    public onObservationReady(callback: (data: ObservationData) => void): void {
        this.onObservationReadyCallbacks.push(callback);
    }

    /**
     * Force collection and emission of observation (for testing)
     */
    public forceCollect(territoryId: string): ObservationData {
        const observation = this.collectObservation(territoryId);
        this.emitObservation(observation);
        return observation;
    }

    /**
     * Check if window is currently active
     */
    public isActive(): boolean {
        return this.isWindowActive;
    }

    /**
     * Get time remaining in current window
     */
    public getTimeRemaining(): number {
        if (!this.isWindowActive) {
            return 0;
        }

        const elapsed = (performance.now() - this.windowStartTime) / 1000;
        return Math.max(0, this.config.windowDuration - elapsed);
    }

    /**
     * Stop the observation window
     */
    public stopWindow(): void {
        this.isWindowActive = false;
        this.startSnapshot = null;
    }

    /**
     * Get observation statistics for debugging
     */
    public getStats(): {
        isActive: boolean;
        timeRemaining: number;
        windowDuration: number;
        callbackCount: number;
    } {
        return {
            isActive: this.isWindowActive,
            timeRemaining: this.getTimeRemaining(),
            windowDuration: this.config.windowDuration,
            callbackCount: this.onObservationReadyCallbacks.length
        };
    }

    /**
     * Dispose and cleanup
     */
    public dispose(): void {
        this.isWindowActive = false;
        this.startSnapshot = null;
        this.onObservationReadyCallbacks = [];
        this.gameEngine = null;
    }
}
