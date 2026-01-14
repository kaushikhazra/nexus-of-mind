/**
 * AdaptiveQueen - Enhanced Queen with AI learning capabilities
 * 
 * Extends the base Queen class with comprehensive learning data collection,
 * death data capture and transmission, strategy application, and behavioral adaptation.
 * Integrates with the Python AI backend for neural network learning.
 */

import { Vector3 } from '@babylonjs/core';
import { Queen, QueenConfig, QueenPhase } from './Queen';
import { WebSocketClient } from '../../networking/WebSocketClient';
import { GameState } from '../GameState';
import { Unit } from './Unit';

// Learning data interfaces
export interface QueenLearningData {
    generation: number;
    birthTime: number;
    deathTime?: number;
    survivalTime?: number;
    
    // Behavioral data
    hivePlacementLocation?: Vector3;
    hivePlacementReasoning: string;
    parasitesSpawned: number;
    parasiteSpawnTiming: number[];
    defensiveActions: DefensiveAction[];
    
    // Player interaction data
    playerEncounters: PlayerEncounter[];
    assaultAttempts: AssaultAttempt[];
    playerBehaviorObservations: PlayerBehaviorObservation[];
    
    // Learning outcomes
    strategiesAttempted: string[];
    strategiesSuccessful: string[];
    strategiesFailed: string[];
    adaptationsMade: Adaptation[];
}

export interface PlayerBehaviorObservation {
    timestamp: number;
    playerAction: string;
    gameContext: GameContext;
    queenResponse: string;
    effectiveness: number; // -1.0 to 1.0
}

export interface Adaptation {
    timestamp: number;
    trigger: string; // What caused the adaptation
    previousBehavior: string;
    newBehavior: string;
    reasoning: string;
    effectiveness?: number; // Measured after implementation
}

export interface DefensiveAction {
    timestamp: number;
    actionType: string;
    parasitesInvolved: number;
    targetLocation: Vector3;
    effectiveness: number;
}

export interface PlayerEncounter {
    timestamp: number;
    encounterType: 'scouting' | 'assault' | 'infiltration';
    playerUnits: UnitData[];
    queenResponse: string;
    outcome: 'success' | 'failure' | 'ongoing';
}

export interface AssaultAttempt {
    timestamp: number;
    startTime: number;
    endTime?: number;
    assaultType: 'direct' | 'flanking' | 'coordinated' | 'infiltration';
    playerUnits: UnitData[];
    queenDefense: string[];
    outcome: 'repelled' | 'successful' | 'ongoing';
    damageDealt: number;
    damageTaken: number;
}

export interface UnitData {
    id: string;
    type: string;
    position: Vector3;
    health: number;
    maxHealth: number;
    energy?: number;
}

export interface GameContext {
    timestamp: number;
    energyLevel: number;
    activeMining: MiningData[];
    territoryControl: number;
    playerUnitCount: number;
    exploredAreas: number;
}

export interface MiningData {
    location: Vector3;
    workersAssigned: number;
    efficiency: number;
    startTime: number;
}

export interface QueenDeathData {
    queenId: string;
    territoryId: string;
    generation: number;
    deathLocation: Vector3;
    deathCause: 'protector_assault' | 'worker_infiltration' | 'coordinated_attack' | 'energy_depletion';
    survivalTime: number;
    parasitesSpawned: number;
    hiveDiscoveryTime: number;
    playerUnits: {
        protectors: UnitData[];
        workers: UnitData[];
    };
    assaultPattern: AssaultPattern;
    gameState: GameStateSnapshot;
    timestamp: number;
}

export interface AssaultPattern {
    type: 'direct' | 'flanking' | 'coordinated' | 'infiltration';
    duration: number;
    approachVector: Vector3;
    unitCoordination: number; // 0.0 to 1.0
    timing: {
        scoutingPhase: number;
        preparationPhase: number;
        assaultPhase: number;
    };
    effectiveness: number; // 0.0 to 1.0
}

export interface GameStateSnapshot {
    timestamp: number;
    energyLevel: number;
    activeMining: MiningData[];
    protectorPositions: Vector3[];
    workerPositions: Vector3[];
    exploredAreas: Vector3[];
    territoryControl: number;
    playerActions: string[];
}

export interface QueenStrategy {
    generation: number;
    hivePlacement: HivePlacementStrategy;
    parasiteSpawning: SpawnStrategy;
    defensiveCoordination: DefensiveStrategy;
    predictiveBehavior?: PredictiveStrategy;
    complexityLevel: number;
}

export interface HivePlacementStrategy {
    preferredLocations: Vector3[];
    avoidanceZones: Vector3[];
    placementReasoning: string;
    adaptationLevel: number;
}

export interface SpawnStrategy {
    timingPattern: number[];
    distributionPattern: string;
    responseToMining: boolean;
    adaptiveSpawning: boolean;
}

export interface DefensiveStrategy {
    coordinationLevel: number;
    swarmTactics: string[];
    counterAssaultPatterns: string[];
    adaptiveDefense: boolean;
}

export interface PredictiveStrategy {
    predictionHorizon: number; // seconds
    anticipatedActions: string[];
    counterMeasures: string[];
    confidenceLevel: number;
}

export interface LearningProgress {
    currentPhase: 'analyzing' | 'processing' | 'generating' | 'complete';
    progress: number; // 0.0 to 1.0
    estimatedTimeRemaining: number; // seconds
    insights: string[];
    improvements: string[];
}

export interface AdaptiveQueenConfig extends QueenConfig {
    websocketClient: WebSocketClient;
    gameState: GameState;
    enableLearning?: boolean;
}

/**
 * AdaptiveQueen class - Enhanced Queen with AI learning capabilities
 */
export class AdaptiveQueen extends Queen {
    private learningData: QueenLearningData;
    private currentStrategy?: QueenStrategy;
    private websocketClient: WebSocketClient;
    private gameState: GameState;
    private enableLearning: boolean;
    
    // Learning progress tracking
    private learningProgress: LearningProgress;
    private learningCallbacks: ((progress: LearningProgress) => void)[] = [];
    
    // Data collection timers
    private observationTimer: NodeJS.Timeout | null = null;
    private behaviorUpdateInterval = 1000; // 1 second
    
    // Death analysis data
    private hiveDiscoveryTime: number = 0;
    private assaultStartTime: number = 0;
    private currentAssault: AssaultAttempt | null = null;

    constructor(config: AdaptiveQueenConfig) {
        super(config);
        
        this.websocketClient = config.websocketClient;
        this.gameState = config.gameState;
        this.enableLearning = config.enableLearning === true; // Default to disabled (KISS)
        
        // Initialize learning data
        this.learningData = {
            generation: config.generation,
            birthTime: Date.now(),
            hivePlacementReasoning: 'Initial random placement',
            parasitesSpawned: 0,
            parasiteSpawnTiming: [],
            defensiveActions: [],
            playerEncounters: [],
            assaultAttempts: [],
            playerBehaviorObservations: [],
            strategiesAttempted: [],
            strategiesSuccessful: [],
            strategiesFailed: [],
            adaptationsMade: []
        };
        
        // Initialize learning progress
        this.learningProgress = {
            currentPhase: 'analyzing',
            progress: 0.0,
            estimatedTimeRemaining: 0,
            insights: [],
            improvements: []
        };
        
        // Start data collection if learning is enabled
        if (this.enableLearning) {
            this.startDataCollection();
            this.requestLearningStrategy();
        }
        
        console.log(`🧠 AdaptiveQueen ${this.id} initialized with learning ${this.enableLearning ? 'enabled' : 'disabled'}`);
    }

    /**
     * Start continuous data collection
     */
    private startDataCollection(): void {
        if (this.observationTimer) {
            return;
        }
        
        this.observationTimer = setInterval(() => {
            this.collectBehaviorData();
        }, this.behaviorUpdateInterval);
    }

    /**
     * Stop data collection
     */
    private stopDataCollection(): void {
        if (this.observationTimer) {
            clearInterval(this.observationTimer);
            this.observationTimer = null;
        }
    }

    /**
     * Collect ongoing behavior data
     */
    private collectBehaviorData(): void {
        if (!this.isActiveQueen()) {
            return;
        }
        
        const gameContext = this.captureGameContext();
        
        // Observe player behavior
        this.observePlayerBehavior(gameContext);
        
        // Track encounters
        this.trackPlayerEncounters(gameContext);
        
        // Monitor assault attempts
        this.monitorAssaultAttempts(gameContext);
    }

    /**
     * Observe and record player behavior patterns
     */
    private observePlayerBehavior(gameContext: GameContext): void {
        // Analyze player actions and record observations
        const playerActions = this.analyzePlayerActions(gameContext);
        
        playerActions.forEach(action => {
            const observation: PlayerBehaviorObservation = {
                timestamp: Date.now(),
                playerAction: action.type,
                gameContext: gameContext,
                queenResponse: this.determineQueenResponse(action),
                effectiveness: this.evaluateResponseEffectiveness(action)
            };
            
            this.learningData.playerBehaviorObservations.push(observation);
        });
        
        // Limit observation history to prevent memory bloat
        if (this.learningData.playerBehaviorObservations.length > 1000) {
            this.learningData.playerBehaviorObservations = this.learningData.playerBehaviorObservations.slice(-500);
        }
    }

    /**
     * Track player encounters with the Queen's territory
     */
    private trackPlayerEncounters(gameContext: GameContext): void {
        const nearbyUnits = this.getNearbyPlayerUnits();
        
        if (nearbyUnits.length > 0) {
            const encounterType = this.classifyEncounterType(nearbyUnits, gameContext);
            
            const encounter: PlayerEncounter = {
                timestamp: Date.now(),
                encounterType: encounterType,
                playerUnits: nearbyUnits,
                queenResponse: this.getCurrentDefensiveResponse(),
                outcome: 'ongoing'
            };
            
            this.learningData.playerEncounters.push(encounter);
        }
    }

    /**
     * Monitor and analyze assault attempts
     */
    private monitorAssaultAttempts(gameContext: GameContext): void {
        const nearbyUnits = this.getNearbyPlayerUnits();
        const isUnderAssault = this.isUnderAssault(nearbyUnits);
        
        if (isUnderAssault && !this.currentAssault) {
            // Start new assault tracking
            this.assaultStartTime = Date.now();
            this.currentAssault = {
                timestamp: Date.now(),
                startTime: this.assaultStartTime,
                assaultType: this.classifyAssaultType(nearbyUnits),
                playerUnits: nearbyUnits,
                queenDefense: this.getCurrentDefensiveStrategies(),
                outcome: 'ongoing',
                damageDealt: 0,
                damageTaken: 0
            };
        } else if (!isUnderAssault && this.currentAssault) {
            // End assault tracking
            this.currentAssault.endTime = Date.now();
            this.currentAssault.outcome = this.health > 0 ? 'repelled' : 'successful';
            this.learningData.assaultAttempts.push(this.currentAssault);
            this.currentAssault = null;
        }
        
        // Update ongoing assault
        if (this.currentAssault) {
            this.currentAssault.playerUnits = nearbyUnits;
            this.currentAssault.queenDefense = this.getCurrentDefensiveStrategies();
        }
    }

    /**
     * Enhanced death handling with comprehensive data capture
     */
    public async onDeath(): Promise<void> {
        console.log(`🧠 AdaptiveQueen ${this.id} death - collecting learning data`);
        
        // Stop data collection
        this.stopDataCollection();
        
        // Update learning data
        this.learningData.deathTime = Date.now();
        this.learningData.survivalTime = this.learningData.deathTime - this.learningData.birthTime;
        this.learningData.hivePlacementLocation = this.position.clone();
        
        // Collect comprehensive death data
        const deathData = this.collectDeathData();
        
        // Send death data to AI backend for learning
        if (this.enableLearning) {
            try {
                await this.transmitDeathData(deathData);
            } catch (error) {
                console.error('Failed to transmit death data:', error);
            }
        }
        
        // Call parent death handler
        await super.onDeath();
    }

    /**
     * Collect comprehensive death data for AI learning
     */
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
            hiveDiscoveryTime: this.hiveDiscoveryTime,
            playerUnits: {
                protectors: this.getNearbyPlayerUnits().filter(u => u.type === 'protector'),
                workers: this.getNearbyPlayerUnits().filter(u => u.type === 'worker')
            },
            assaultPattern: assaultPattern,
            gameState: gameStateSnapshot,
            timestamp: Date.now()
        };
    }

    /**
     * Determine the primary cause of Queen death
     */
    private determineDeathCause(): 'protector_assault' | 'worker_infiltration' | 'coordinated_attack' | 'energy_depletion' {
        const nearbyUnits = this.getNearbyPlayerUnits();
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

    /**
     * Analyze the assault pattern that led to death
     */
    private analyzeAssaultPattern(): AssaultPattern {
        const nearbyUnits = this.getNearbyPlayerUnits();
        const assaultDuration = this.currentAssault ? 
            (Date.now() - this.currentAssault.startTime) / 1000 : 0;
        
        return {
            type: this.classifyAssaultType(nearbyUnits),
            duration: assaultDuration,
            approachVector: this.calculateApproachVector(nearbyUnits),
            unitCoordination: this.calculateUnitCoordination(nearbyUnits),
            timing: {
                scoutingPhase: Math.max(0, this.hiveDiscoveryTime / 1000),
                preparationPhase: Math.max(0, (this.assaultStartTime - this.hiveDiscoveryTime) / 1000),
                assaultPhase: assaultDuration
            },
            effectiveness: this.health <= 0 ? 1.0 : 0.5
        };
    }

    /**
     * Capture current game state snapshot
     */
    private captureGameStateSnapshot(): GameStateSnapshot {
        return {
            timestamp: Date.now(),
            energyLevel: this.gameState.getEnergyLevel(),
            activeMining: this.getActiveMiningData(),
            protectorPositions: this.getPlayerUnitPositions('protector'),
            workerPositions: this.getPlayerUnitPositions('worker'),
            exploredAreas: this.getExploredAreas(),
            territoryControl: this.calculateTerritoryControl(),
            playerActions: this.getRecentPlayerActions()
        };
    }

    /**
     * Transmit death data to AI backend
     */
    private async transmitDeathData(deathData: QueenDeathData): Promise<void> {
        try {
            const response = await this.websocketClient.sendQueenDeath(deathData);
            console.log(`🧠 Death data transmitted for Queen ${this.id}:`, response);
            
            // Update learning progress
            this.learningProgress.currentPhase = 'processing';
            this.learningProgress.progress = 0.1;
            this.notifyLearningProgress();
            
        } catch (error) {
            console.error('Failed to transmit death data:', error);
            throw error;
        }
    }

    /**
     * Request learning strategy from AI backend
     */
    private async requestLearningStrategy(): Promise<void> {
        if (!this.enableLearning) {
            return;
        }
        
        try {
            // Listen for strategy responses
            this.websocketClient.on('queen_strategy', (message: any) => {
                if (message.data.queenId === this.id) {
                    this.applyLearningStrategy(message.data.strategy);
                }
            });
            
            // Listen for learning progress updates
            this.websocketClient.on('learning_progress', (message: any) => {
                if (message.data.queenId === this.id) {
                    this.updateLearningProgress(message.data.progress);
                }
            });
            
        } catch (error) {
            console.error('Failed to request learning strategy:', error);
        }
    }

    /**
     * Apply learning strategy from AI backend
     */
    public async applyLearningStrategy(strategy: QueenStrategy): Promise<void> {
        this.currentStrategy = strategy;
        
        console.log(`🧠 Applying learning strategy for Queen ${this.id} (Gen ${strategy.generation})`);
        
        // Apply hive placement strategy
        if (strategy.hivePlacement) {
            this.applyHivePlacementStrategy(strategy.hivePlacement);
        }
        
        // Apply parasite spawning strategy
        if (strategy.parasiteSpawning) {
            this.applySpawnStrategy(strategy.parasiteSpawning);
        }
        
        // Apply defensive coordination strategy
        if (strategy.defensiveCoordination) {
            this.applyDefensiveStrategy(strategy.defensiveCoordination);
        }
        
        // Apply predictive behavior (advanced generations)
        if (strategy.predictiveBehavior) {
            this.applyPredictiveStrategy(strategy.predictiveBehavior);
        }
        
        // Record strategy application
        this.learningData.strategiesAttempted.push(`Gen${strategy.generation}_Strategy`);
        
        // Update learning progress
        this.learningProgress.currentPhase = 'complete';
        this.learningProgress.progress = 1.0;
        this.notifyLearningProgress();
    }

    /**
     * Apply hive placement strategy
     */
    private applyHivePlacementStrategy(strategy: HivePlacementStrategy): void {
        // Override the random hive placement with learned strategy
        if (strategy.preferredLocations.length > 0) {
            const preferredLocation = strategy.preferredLocations[0];
            this.position.x = preferredLocation.x;
            this.position.z = preferredLocation.z;
            
            this.learningData.hivePlacementReasoning = strategy.placementReasoning;
            
            console.log(`🧠 Applied hive placement strategy: ${strategy.placementReasoning}`);
        }
    }

    /**
     * Apply parasite spawning strategy
     */
    private applySpawnStrategy(strategy: SpawnStrategy): void {
        // Store spawning strategy for use during active control phase
        this.learningData.parasiteSpawnTiming = strategy.timingPattern;
        
        console.log(`🧠 Applied spawn strategy: ${strategy.distributionPattern}`);
    }

    /**
     * Apply defensive coordination strategy
     */
    private applyDefensiveStrategy(strategy: DefensiveStrategy): void {
        // Store defensive strategy for use during combat
        console.log(`🧠 Applied defensive strategy with coordination level: ${strategy.coordinationLevel}`);
    }

    /**
     * Apply predictive behavior strategy
     */
    private applyPredictiveStrategy(strategy: PredictiveStrategy): void {
        console.log(`🧠 Applied predictive strategy with ${strategy.predictionHorizon}s horizon`);
    }

    /**
     * Update learning progress from backend
     */
    private updateLearningProgress(progress: LearningProgress): void {
        this.learningProgress = progress;
        this.notifyLearningProgress();
    }

    /**
     * Notify learning progress callbacks
     */
    private notifyLearningProgress(): void {
        this.learningCallbacks.forEach(callback => {
            try {
                callback(this.learningProgress);
            } catch (error) {
                console.error('Error in learning progress callback:', error);
            }
        });
    }

    /**
     * Enhanced update method with learning behavior
     */
    public update(deltaTime: number): void {
        super.update(deltaTime);
        
        // Apply learned behaviors during active control
        if (this.getCurrentPhase() === QueenPhase.ACTIVE_CONTROL && this.currentStrategy) {
            this.applyLearnedBehaviors(deltaTime);
        }
    }

    /**
     * Apply learned behaviors during active control phase
     */
    private applyLearnedBehaviors(deltaTime: number): void {
        if (!this.currentStrategy) {
            return;
        }
        
        // Apply predictive behaviors
        if (this.currentStrategy.predictiveBehavior) {
            this.executePredictiveBehavior(deltaTime);
        }
        
        // Apply adaptive spawning
        if (this.currentStrategy.parasiteSpawning.adaptiveSpawning) {
            this.executeAdaptiveSpawning(deltaTime);
        }
        
        // Apply defensive coordination
        if (this.currentStrategy.defensiveCoordination.adaptiveDefense) {
            this.executeAdaptiveDefense(deltaTime);
        }
    }

    /**
     * Execute predictive behavior
     */
    private executePredictiveBehavior(deltaTime: number): void {
        // Implement predictive behavior based on learned patterns
        // This would involve anticipating player actions and preparing counter-measures
    }

    /**
     * Execute adaptive spawning
     */
    private executeAdaptiveSpawning(deltaTime: number): void {
        // Implement adaptive parasite spawning based on learned patterns
        // This would involve timing spawns based on player mining patterns
    }

    /**
     * Execute adaptive defense
     */
    private executeAdaptiveDefense(deltaTime: number): void {
        // Implement adaptive defensive coordination based on learned patterns
        // This would involve coordinating parasite swarms based on assault patterns
    }

    // Utility methods for data collection

    /**
     * Get nearby player units for analysis
     */
    private getNearbyPlayerUnits(): UnitData[] {
        // This would integrate with the game's unit management system
        // For now, return empty array as placeholder
        return [];
    }

    /**
     * Capture current game context
     */
    private captureGameContext(): GameContext {
        return {
            timestamp: Date.now(),
            energyLevel: this.gameState.getEnergyLevel(),
            activeMining: this.getActiveMiningData(),
            territoryControl: this.calculateTerritoryControl(),
            playerUnitCount: this.getNearbyPlayerUnits().length,
            exploredAreas: this.getExploredAreas().length
        };
    }

    /**
     * Analyze player actions from game context
     */
    private analyzePlayerActions(gameContext: GameContext): Array<{type: string, data: any}> {
        // Placeholder for player action analysis
        return [];
    }

    /**
     * Determine Queen's response to player action
     */
    private determineQueenResponse(action: {type: string, data: any}): string {
        // Placeholder for response determination
        return 'defensive_posture';
    }

    /**
     * Evaluate effectiveness of Queen's response
     */
    private evaluateResponseEffectiveness(action: {type: string, data: any}): number {
        // Placeholder for effectiveness evaluation
        return 0.5;
    }

    /**
     * Classify encounter type based on player units
     */
    private classifyEncounterType(units: UnitData[], context: GameContext): 'scouting' | 'assault' | 'infiltration' {
        if (units.length === 1 && units[0].type === 'worker') {
            return 'scouting';
        } else if (units.some(u => u.type === 'protector')) {
            return 'assault';
        } else {
            return 'infiltration';
        }
    }

    /**
     * Get current defensive response
     */
    private getCurrentDefensiveResponse(): string {
        return 'parasite_swarm';
    }

    /**
     * Check if Queen is under assault
     */
    private isUnderAssault(units: UnitData[]): boolean {
        return units.some(u => u.type === 'protector') && units.length > 1;
    }

    /**
     * Classify assault type
     */
    private classifyAssaultType(units: UnitData[]): 'direct' | 'flanking' | 'coordinated' | 'infiltration' {
        if (units.length > 3) {
            return 'coordinated';
        } else if (units.length > 1) {
            return 'direct';
        } else {
            return 'infiltration';
        }
    }

    /**
     * Get current defensive strategies
     */
    private getCurrentDefensiveStrategies(): string[] {
        return ['parasite_swarm', 'territorial_defense'];
    }

    /**
     * Calculate approach vector from player units
     */
    private calculateApproachVector(units: UnitData[]): Vector3 {
        if (units.length === 0) {
            return new Vector3(0, 0, 0);
        }
        
        const avgPosition = units.reduce((sum, unit) => {
            return sum.add(unit.position);
        }, new Vector3(0, 0, 0)).scale(1 / units.length);
        
        return avgPosition.subtract(this.position).normalize();
    }

    /**
     * Calculate unit coordination level
     */
    private calculateUnitCoordination(units: UnitData[]): number {
        if (units.length < 2) {
            return 0.0;
        }
        
        // Simple coordination metric based on unit proximity
        let totalDistance = 0;
        let pairCount = 0;
        
        for (let i = 0; i < units.length; i++) {
            for (let j = i + 1; j < units.length; j++) {
                totalDistance += Vector3.Distance(units[i].position, units[j].position);
                pairCount++;
            }
        }
        
        const avgDistance = totalDistance / pairCount;
        return Math.max(0, Math.min(1, 1 - (avgDistance / 100))); // Normalize to 0-1
    }

    /**
     * Get active mining data
     */
    private getActiveMiningData(): MiningData[] {
        // Placeholder - would integrate with mining system
        return [];
    }

    /**
     * Get player unit positions by type
     */
    private getPlayerUnitPositions(unitType: string): Vector3[] {
        return this.getNearbyPlayerUnits()
            .filter(u => u.type === unitType)
            .map(u => u.position);
    }

    /**
     * Get explored areas
     */
    private getExploredAreas(): Vector3[] {
        // Placeholder - would integrate with exploration system
        return [];
    }

    /**
     * Calculate territory control percentage
     */
    private calculateTerritoryControl(): number {
        // Placeholder - would integrate with territory system
        return 0.5;
    }

    /**
     * Get recent player actions
     */
    private getRecentPlayerActions(): string[] {
        // Placeholder - would integrate with action tracking system
        return [];
    }

    // Public API methods

    /**
     * Get current learning data
     */
    public getLearningData(): QueenLearningData {
        return { ...this.learningData };
    }

    /**
     * Get current learning progress
     */
    public getLearningProgress(): LearningProgress {
        return { ...this.learningProgress };
    }

    /**
     * Get current strategy
     */
    public getCurrentStrategy(): QueenStrategy | undefined {
        return this.currentStrategy;
    }

    /**
     * Subscribe to learning progress updates
     */
    public onLearningProgress(callback: (progress: LearningProgress) => void): void {
        this.learningCallbacks.push(callback);
    }

    /**
     * Check if learning is enabled
     */
    public isLearningEnabled(): boolean {
        return this.enableLearning;
    }

    /**
     * Enable or disable learning
     */
    public setLearningEnabled(enabled: boolean): void {
        this.enableLearning = enabled;
        
        if (enabled) {
            this.startDataCollection();
            this.requestLearningStrategy();
        } else {
            this.stopDataCollection();
        }
    }

    /**
     * Get survival time (time since spawn)
     */
    public getSurvivalTime(): number {
        return (Date.now() - this.learningData.birthTime) / 1000;
    }

    /**
     * Get death cause (reason for death)
     */
    public getDeathCause(): string {
        return this.determineDeathCause();
    }

    /**
     * Dispose AdaptiveQueen and cleanup resources
     */
    public dispose(): void {
        this.stopDataCollection();
        this.learningCallbacks = [];
        super.dispose();
    }
}