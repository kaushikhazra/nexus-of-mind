/**
 * AdaptiveQueen - Enhanced Queen with AI learning capabilities
 *
 * Extends the base Queen class with comprehensive learning data collection,
 * death data capture and transmission, strategy application, and behavioral adaptation.
 * Integrates with the Python AI backend for neural network learning.
 *
 * Refactored to delegate to extracted modules for SOLID compliance.
 */

import { Vector3 } from '@babylonjs/core';
import { Queen, QueenPhase } from '../Queen';
import type { WebSocketClient } from '../../../networking/WebSocketClient';
import type { GameState } from '../../GameState';
import type {
    QueenLearningData,
    QueenStrategy,
    QueenDeathData,
    AssaultPattern,
    GameStateSnapshot,
    LearningProgress,
    AdaptiveQueenConfig
} from './AdaptiveQueenInterfaces';
import { createInitialLearningData, createInitialLearningProgress } from './AdaptiveQueenInterfaces';
import { AdaptiveQueenDataCollector } from './AdaptiveQueenDataCollector';
import { AdaptiveQueenStrategyApplier } from './AdaptiveQueenStrategyApplier';

export class AdaptiveQueen extends Queen {
    private learningData: QueenLearningData;
    private websocketClient: WebSocketClient;
    private gameState: GameState;
    private enableLearning: boolean;

    private learningProgress: LearningProgress;
    private learningCallbacks: ((progress: LearningProgress) => void)[] = [];

    private observationTimer: NodeJS.Timeout | null = null;
    private behaviorUpdateInterval = 1000;

    private dataCollector: AdaptiveQueenDataCollector;
    private strategyApplier: AdaptiveQueenStrategyApplier;

    constructor(config: AdaptiveQueenConfig) {
        super(config);

        this.websocketClient = config.websocketClient;
        this.gameState = config.gameState;
        this.enableLearning = config.enableLearning === true;

        this.learningData = createInitialLearningData(config.generation);
        this.learningProgress = createInitialLearningProgress();

        this.dataCollector = new AdaptiveQueenDataCollector(this.gameState, this.learningData);
        this.strategyApplier = new AdaptiveQueenStrategyApplier(this.learningData, this.learningProgress);

        this.strategyApplier.onLearningProgress((progress) => {
            this.learningProgress = progress;
            this.notifyLearningProgress();
        });

        if (this.enableLearning) {
            this.startDataCollection();
            this.requestLearningStrategy();
        }

        console.log(`🧠 AdaptiveQueen ${this.id} initialized with learning ${this.enableLearning ? 'enabled' : 'disabled'}`);
    }

    private startDataCollection(): void {
        if (this.observationTimer) {
            return;
        }

        this.observationTimer = setInterval(() => {
            this.dataCollector.collectBehaviorData(this.isActiveQueen(), this.position, this.health);
        }, this.behaviorUpdateInterval);
    }

    private stopDataCollection(): void {
        if (this.observationTimer) {
            clearInterval(this.observationTimer);
            this.observationTimer = null;
        }
    }

    public async onDeath(): Promise<void> {
        console.log(`🧠 AdaptiveQueen ${this.id} death - collecting learning data`);

        this.stopDataCollection();

        this.learningData.deathTime = Date.now();
        this.learningData.survivalTime = this.learningData.deathTime - this.learningData.birthTime;
        this.learningData.hivePlacementLocation = this.position.clone();

        const deathData = this.collectDeathData();

        if (this.enableLearning) {
            try {
                await this.transmitDeathData(deathData);
            } catch (error) {
                console.error('Failed to transmit death data:', error);
            }
        }

        await super.onDeath();
    }

    private collectDeathData(): QueenDeathData {
        const deathCause = this.determineDeathCause();
        const assaultPattern = this.analyzeAssaultPattern();
        const gameStateSnapshot = this.captureGameStateSnapshot();

        return {
            queenId: this.id,
            territoryId: this.getTerritory().id,
            generation: this.getGeneration(),
            deathLocation: this.position.clone(),
            deathCause: deathCause,
            survivalTime: this.learningData.survivalTime || 0,
            parasitesSpawned: this.learningData.parasitesSpawned,
            hiveDiscoveryTime: this.dataCollector.hiveDiscoveryTime,
            playerUnits: {
                protectors: this.dataCollector.getNearbyPlayerUnits().filter(u => u.type === 'protector'),
                workers: this.dataCollector.getNearbyPlayerUnits().filter(u => u.type === 'worker')
            },
            assaultPattern: assaultPattern,
            gameState: gameStateSnapshot,
            timestamp: Date.now()
        };
    }

    private determineDeathCause(): 'protector_assault' | 'worker_infiltration' | 'coordinated_attack' | 'energy_depletion' {
        const nearbyUnits = this.dataCollector.getNearbyPlayerUnits();
        const protectors = nearbyUnits.filter(u => u.type === 'protector');
        const workers = nearbyUnits.filter(u => u.type === 'worker');

        if (protectors.length > 3) {
            return 'coordinated_attack';
        } else if (protectors.length > 0) {
            return 'protector_assault';
        } else if (workers.length > 0) {
            return 'worker_infiltration';
        } else {
            return 'energy_depletion';
        }
    }

    private analyzeAssaultPattern(): AssaultPattern {
        const nearbyUnits = this.dataCollector.getNearbyPlayerUnits();
        const currentAssault = this.dataCollector.getCurrentAssault();
        const assaultDuration = currentAssault ?
            (Date.now() - currentAssault.startTime) / 1000 : 0;

        const assaultType = this.classifyAssaultType(nearbyUnits);

        return {
            type: assaultType,
            duration: assaultDuration,
            approachVector: this.dataCollector.calculateApproachVector(nearbyUnits, this.position),
            unitCoordination: this.dataCollector.calculateUnitCoordination(nearbyUnits),
            timing: {
                scoutingPhase: Math.max(0, this.dataCollector.hiveDiscoveryTime / 1000),
                preparationPhase: Math.max(0, (this.dataCollector.getAssaultStartTime() - this.dataCollector.hiveDiscoveryTime) / 1000),
                assaultPhase: assaultDuration
            },
            effectiveness: this.health <= 0 ? 1.0 : 0.5
        };
    }

    private classifyAssaultType(units: { type: string }[]): 'direct' | 'flanking' | 'coordinated' | 'infiltration' {
        if (units.length > 3) {
            return 'coordinated';
        } else if (units.length > 1) {
            return 'direct';
        } else {
            return 'infiltration';
        }
    }

    private captureGameStateSnapshot(): GameStateSnapshot {
        return {
            timestamp: Date.now(),
            energyLevel: this.gameState.getEnergyLevel(),
            activeMining: this.dataCollector.getActiveMiningData(),
            protectorPositions: this.dataCollector.getPlayerUnitPositions('protector'),
            workerPositions: this.dataCollector.getPlayerUnitPositions('worker'),
            exploredAreas: this.dataCollector.getExploredAreas(),
            territoryControl: this.calculateTerritoryControl(),
            playerActions: this.dataCollector.getRecentPlayerActions()
        };
    }

    private calculateTerritoryControl(): number {
        return 0.5;
    }

    private async transmitDeathData(deathData: QueenDeathData): Promise<void> {
        try {
            const response = await this.websocketClient.sendQueenDeath(deathData);
            console.log(`🧠 Death data transmitted for Queen ${this.id}:`, response);

            this.learningProgress.currentPhase = 'processing';
            this.learningProgress.progress = 0.1;
            this.notifyLearningProgress();
        } catch (error) {
            console.error('Failed to transmit death data:', error);
            throw error;
        }
    }

    private async requestLearningStrategy(): Promise<void> {
        if (!this.enableLearning) {
            return;
        }

        try {
            this.websocketClient.on('queen_strategy', (message: any) => {
                if (message.data.queenId === this.id) {
                    this.applyLearningStrategy(message.data.strategy);
                }
            });

            this.websocketClient.on('learning_progress', (message: any) => {
                if (message.data.queenId === this.id) {
                    this.strategyApplier.updateLearningProgress(message.data.progress);
                }
            });
        } catch (error) {
            console.error('Failed to request learning strategy:', error);
        }
    }

    public async applyLearningStrategy(strategy: QueenStrategy): Promise<void> {
        await this.strategyApplier.applyStrategy(
            strategy,
            this.position,
            (x: number, z: number) => {
                this.position.x = x;
                this.position.z = z;
            }
        );
    }

    private notifyLearningProgress(): void {
        this.learningCallbacks.forEach(callback => {
            try {
                callback(this.learningProgress);
            } catch (error) {
                console.error('Error in learning progress callback:', error);
            }
        });
    }

    public update(deltaTime: number): void {
        super.update(deltaTime);

        if (this.getCurrentPhase() === QueenPhase.ACTIVE_CONTROL && this.strategyApplier.getCurrentStrategy()) {
            this.strategyApplier.applyLearnedBehaviors(deltaTime);
        }
    }

    public getLearningData(): QueenLearningData {
        return { ...this.learningData };
    }

    public getLearningProgress(): LearningProgress {
        return { ...this.learningProgress };
    }

    public getCurrentStrategy(): QueenStrategy | undefined {
        return this.strategyApplier.getCurrentStrategy();
    }

    public onLearningProgress(callback: (progress: LearningProgress) => void): void {
        this.learningCallbacks.push(callback);
    }

    public isLearningEnabled(): boolean {
        return this.enableLearning;
    }

    public setLearningEnabled(enabled: boolean): void {
        this.enableLearning = enabled;

        if (enabled) {
            this.startDataCollection();
            this.requestLearningStrategy();
        } else {
            this.stopDataCollection();
        }
    }

    public getSurvivalTime(): number {
        return (Date.now() - this.learningData.birthTime) / 1000;
    }

    public getDeathCause(): string {
        return this.determineDeathCause();
    }

    public dispose(): void {
        this.stopDataCollection();
        this.learningCallbacks = [];
        this.strategyApplier.clearCallbacks();
        super.dispose();
    }
}
