/**
 * AdaptiveQueenDataCollector - Data collection for Queen learning system
 *
 * Handles observation and collection of player behavior data for AI learning.
 */

import { Vector3 } from '@babylonjs/core';
import type { GameState } from '../../GameState';
import type {
    QueenLearningData,
    PlayerBehaviorObservation,
    PlayerEncounter,
    AssaultAttempt,
    GameContext,
    UnitData,
    MiningData
} from './AdaptiveQueenInterfaces';

export class AdaptiveQueenDataCollector {
    private gameState: GameState;
    private learningData: QueenLearningData;
    private currentAssault: AssaultAttempt | null = null;
    private assaultStartTime: number = 0;
    public hiveDiscoveryTime: number = 0;

    constructor(gameState: GameState, learningData: QueenLearningData) {
        this.gameState = gameState;
        this.learningData = learningData;
    }

    public collectBehaviorData(isActive: boolean, position: Vector3, health: number): void {
        if (!isActive) return;

        const gameContext = this.captureGameContext();

        this.observePlayerBehavior(gameContext);
        this.trackPlayerEncounters(gameContext);
        this.monitorAssaultAttempts(gameContext, health);
    }

    private observePlayerBehavior(gameContext: GameContext): void {
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

        if (this.learningData.playerBehaviorObservations.length > 1000) {
            this.learningData.playerBehaviorObservations = this.learningData.playerBehaviorObservations.slice(-500);
        }
    }

    private trackPlayerEncounters(gameContext: GameContext): void {
        const nearbyUnits = this.getNearbyPlayerUnits();

        if (nearbyUnits.length > 0) {
            const encounterType = this.classifyEncounterType(nearbyUnits, gameContext);

            const encounter: PlayerEncounter = {
                timestamp: Date.now(),
                encounterType: encounterType,
                playerUnits: nearbyUnits,
                queenResponse: 'defensive_posture',
                outcome: 'ongoing'
            };

            this.learningData.playerEncounters.push(encounter);
        }
    }

    private monitorAssaultAttempts(gameContext: GameContext, health: number): void {
        const nearbyUnits = this.getNearbyPlayerUnits();
        const isUnderAssault = this.isUnderAssault(nearbyUnits);

        if (isUnderAssault && !this.currentAssault) {
            this.assaultStartTime = Date.now();
            this.currentAssault = {
                timestamp: Date.now(),
                startTime: this.assaultStartTime,
                assaultType: this.classifyAssaultType(nearbyUnits),
                playerUnits: nearbyUnits,
                queenDefense: ['parasite_swarm', 'territorial_defense'],
                outcome: 'ongoing',
                damageDealt: 0,
                damageTaken: 0
            };
        } else if (!isUnderAssault && this.currentAssault) {
            this.currentAssault.endTime = Date.now();
            this.currentAssault.outcome = health > 0 ? 'repelled' : 'successful';
            this.learningData.assaultAttempts.push(this.currentAssault);
            this.currentAssault = null;
        }

        if (this.currentAssault) {
            this.currentAssault.playerUnits = nearbyUnits;
        }
    }

    public captureGameContext(): GameContext {
        return {
            timestamp: Date.now(),
            energyLevel: this.gameState.getEnergyLevel(),
            activeMining: this.getActiveMiningData(),
            territoryControl: 0.5,
            playerUnitCount: this.getNearbyPlayerUnits().length,
            exploredAreas: 0
        };
    }

    public getNearbyPlayerUnits(): UnitData[] {
        return [];
    }

    public getActiveMiningData(): MiningData[] {
        return [];
    }

    public getPlayerUnitPositions(unitType: string): Vector3[] {
        return this.getNearbyPlayerUnits()
            .filter(u => u.type === unitType)
            .map(u => u.position);
    }

    public getExploredAreas(): Vector3[] {
        return [];
    }

    public getRecentPlayerActions(): string[] {
        return [];
    }

    public getCurrentAssault(): AssaultAttempt | null {
        return this.currentAssault;
    }

    public getAssaultStartTime(): number {
        return this.assaultStartTime;
    }

    private analyzePlayerActions(gameContext: GameContext): Array<{type: string, data: any}> {
        return [];
    }

    private determineQueenResponse(action: {type: string, data: any}): string {
        return 'defensive_posture';
    }

    private evaluateResponseEffectiveness(action: {type: string, data: any}): number {
        return 0.5;
    }

    private classifyEncounterType(units: UnitData[], context: GameContext): 'scouting' | 'assault' | 'infiltration' {
        if (units.length === 1 && units[0].type === 'worker') {
            return 'scouting';
        } else if (units.some(u => u.type === 'protector')) {
            return 'assault';
        }
        return 'infiltration';
    }

    private isUnderAssault(units: UnitData[]): boolean {
        return units.some(u => u.type === 'protector') && units.length > 1;
    }

    private classifyAssaultType(units: UnitData[]): 'direct' | 'flanking' | 'coordinated' | 'infiltration' {
        if (units.length > 3) return 'coordinated';
        if (units.length > 1) return 'direct';
        return 'infiltration';
    }

    public calculateApproachVector(units: UnitData[], position: Vector3): Vector3 {
        if (units.length === 0) {
            return new Vector3(0, 0, 0);
        }

        const avgPosition = units.reduce((sum, unit) => {
            return sum.add(unit.position);
        }, new Vector3(0, 0, 0)).scale(1 / units.length);

        return avgPosition.subtract(position).normalize();
    }

    public calculateUnitCoordination(units: UnitData[]): number {
        if (units.length < 2) return 0.0;

        let totalDistance = 0;
        let pairCount = 0;

        for (let i = 0; i < units.length; i++) {
            for (let j = i + 1; j < units.length; j++) {
                totalDistance += Vector3.Distance(units[i].position, units[j].position);
                pairCount++;
            }
        }

        const avgDistance = totalDistance / pairCount;
        return Math.max(0, Math.min(1, 1 - (avgDistance / 100)));
    }
}
