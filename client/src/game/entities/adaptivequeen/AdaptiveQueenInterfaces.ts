/**
 * AdaptiveQueenInterfaces - Type definitions for adaptive queen learning system
 *
 * Contains all interfaces and types for the Queen's AI learning capabilities.
 */

import { Vector3 } from '@babylonjs/core';
import type { QueenConfig } from '../Queen';
import type { WebSocketClient } from '../../../networking/WebSocketClient';
import type { GameState } from '../../GameState';

export interface QueenLearningData {
    generation: number;
    birthTime: number;
    deathTime?: number;
    survivalTime?: number;
    hivePlacementLocation?: Vector3;
    hivePlacementReasoning: string;
    parasitesSpawned: number;
    parasiteSpawnTiming: number[];
    defensiveActions: DefensiveAction[];
    playerEncounters: PlayerEncounter[];
    assaultAttempts: AssaultAttempt[];
    playerBehaviorObservations: PlayerBehaviorObservation[];
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
    effectiveness: number;
}

export interface Adaptation {
    timestamp: number;
    trigger: string;
    previousBehavior: string;
    newBehavior: string;
    reasoning: string;
    effectiveness?: number;
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
    unitCoordination: number;
    timing: {
        scoutingPhase: number;
        preparationPhase: number;
        assaultPhase: number;
    };
    effectiveness: number;
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
    predictionHorizon: number;
    anticipatedActions: string[];
    counterMeasures: string[];
    confidenceLevel: number;
}

export interface LearningProgress {
    currentPhase: 'analyzing' | 'processing' | 'generating' | 'complete';
    progress: number;
    estimatedTimeRemaining: number;
    insights: string[];
    improvements: string[];
}

export interface AdaptiveQueenConfig extends QueenConfig {
    websocketClient: WebSocketClient;
    gameState: GameState;
    enableLearning?: boolean;
}

export function createInitialLearningData(generation: number): QueenLearningData {
    return {
        generation,
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
}

export function createInitialLearningProgress(): LearningProgress {
    return {
        currentPhase: 'analyzing',
        progress: 0.0,
        estimatedTimeRemaining: 0,
        insights: [],
        improvements: []
    };
}
