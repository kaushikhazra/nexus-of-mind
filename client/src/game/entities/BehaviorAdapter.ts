/**
 * BehaviorAdapter - Handles strategy application and behavioral adaptation for AdaptiveQueen
 * 
 * This class manages the application of learned strategies from the AI backend,
 * translating high-level strategic decisions into concrete behavioral changes
 * for the Queen during gameplay.
 */

import { Vector3 } from '@babylonjs/core';
import { 
    HivePlacementStrategy, 
    SpawnStrategy, 
    DefensiveStrategy, 
    PredictiveStrategy,
    GameContext 
} from './AdaptiveQueen';

export interface BehaviorState {
    currentBehavior: string;
    adaptationLevel: number;
    lastAdaptation: number;
    behaviorHistory: string[];
}

export interface StrategicDecision {
    timestamp: number;
    decisionType: string;
    reasoning: string;
    expectedOutcome: string;
    actualOutcome?: string;
    effectiveness?: number;
}

/**
 * BehaviorAdapter class - Manages strategic behavior adaptation
 */
export class BehaviorAdapter {
    private hivePlacementStrategy?: HivePlacementStrategy;
    private spawnStrategy?: SpawnStrategy;
    private defensiveStrategy?: DefensiveStrategy;
    private predictiveStrategy?: PredictiveStrategy;
    
    private behaviorState: BehaviorState;
    private strategicDecisions: StrategicDecision[] = [];
    private adaptationThreshold = 0.3; // Minimum effectiveness to trigger adaptation
    
    // Timing and state management
    private lastSpawnTime = 0;
    private lastDefensiveAction = 0;
    private lastPrediction = 0;
    
    // Behavioral parameters
    private spawnCooldown = 5000; // 5 seconds between spawns
    private defensiveCooldown = 3000; // 3 seconds between defensive actions
    private predictionInterval = 10000; // 10 seconds between predictions

    constructor() {
        this.behaviorState = {
            currentBehavior: 'default',
            adaptationLevel: 0.0,
            lastAdaptation: Date.now(),
            behaviorHistory: ['default']
        };
    }

    /**
     * Set hive placement strategy
     */
    public setHivePlacementStrategy(strategy: HivePlacementStrategy): void {
        this.hivePlacementStrategy = strategy;
        this.recordStrategicDecision('hive_placement', strategy.placementReasoning, 'Improved hive survival');
        console.log(`🧠 BehaviorAdapter: Applied hive placement strategy - ${strategy.placementReasoning}`);
    }

    /**
     * Set parasite spawning strategy
     */
    public setSpawnStrategy(strategy: SpawnStrategy): void {
        this.spawnStrategy = strategy;
        this.recordStrategicDecision('spawn_strategy', strategy.distributionPattern, 'Optimized parasite deployment');
        console.log(`🧠 BehaviorAdapter: Applied spawn strategy - ${strategy.distributionPattern}`);
    }

    /**
     * Set defensive coordination strategy
     */
    public setDefensiveStrategy(strategy: DefensiveStrategy): void {
        this.defensiveStrategy = strategy;
        this.recordStrategicDecision('defensive_strategy', 'Coordinated defense', 'Enhanced territorial protection');
        console.log(`🧠 BehaviorAdapter: Applied defensive strategy with coordination level ${strategy.coordinationLevel}`);
    }

    /**
     * Set predictive behavior strategy
     */
    public setPredictiveStrategy(strategy: PredictiveStrategy): void {
        this.predictiveStrategy = strategy;
        this.recordStrategicDecision('predictive_strategy', 'Anticipatory behavior', 'Proactive threat response');
        console.log(`🧠 BehaviorAdapter: Applied predictive strategy with ${strategy.predictionHorizon}s horizon`);
    }

    /**
     * Update behavior adapter (called each frame)
     */
    public update(deltaTime: number, gameContext: GameContext): void {
        const currentTime = Date.now();
        
        // Update spawn behavior
        if (this.spawnStrategy && this.shouldExecuteSpawn(currentTime, gameContext)) {
            this.executeSpawnBehavior(gameContext);
        }
        
        // Update defensive behavior
        if (this.defensiveStrategy && this.shouldExecuteDefense(currentTime, gameContext)) {
            this.executeDefensiveBehavior(gameContext);
        }
        
        // Update predictive behavior
        if (this.predictiveStrategy && this.shouldExecutePrediction(currentTime, gameContext)) {
            this.executePredictiveBehavior(gameContext);
        }
        
        // Evaluate and adapt behaviors
        this.evaluateBehaviorEffectiveness(gameContext);
    }

    /**
     * Check if spawn behavior should be executed
     */
    private shouldExecuteSpawn(currentTime: number, gameContext: GameContext): boolean {
        if (currentTime - this.lastSpawnTime < this.spawnCooldown) {
            return false;
        }
        
        if (!this.spawnStrategy) {
            return false;
        }
        
        // Check if adaptive spawning conditions are met
        if (this.spawnStrategy.responseToMining && gameContext.activeMining.length > 0) {
            return true;
        }
        
        // Check timing pattern
        if (this.spawnStrategy.timingPattern.length > 0) {
            const elapsedTime = (currentTime - gameContext.timestamp) / 1000;
            return this.spawnStrategy.timingPattern.some(timing => 
                Math.abs(elapsedTime - timing) < 2.0 // Within 2 seconds of timing
            );
        }
        
        return false;
    }

    /**
     * Execute spawn behavior based on strategy
     */
    private executeSpawnBehavior(gameContext: GameContext): void {
        if (!this.spawnStrategy) {
            return;
        }
        
        this.lastSpawnTime = Date.now();
        
        // Determine spawn parameters based on strategy
        const spawnCount = this.calculateSpawnCount(gameContext);
        const spawnLocations = this.calculateSpawnLocations(gameContext);
        
        console.log(`🧠 BehaviorAdapter: Executing spawn behavior - ${spawnCount} parasites at ${spawnLocations.length} locations`);
        
        // Record decision
        this.recordStrategicDecision(
            'parasite_spawn',
            `Spawning ${spawnCount} parasites using ${this.spawnStrategy.distributionPattern}`,
            'Increased territorial pressure'
        );
        
        // Update behavior state
        this.updateBehaviorState('spawning');
    }

    /**
     * Check if defensive behavior should be executed
     */
    private shouldExecuteDefense(currentTime: number, gameContext: GameContext): boolean {
        if (currentTime - this.lastDefensiveAction < this.defensiveCooldown) {
            return false;
        }
        
        // Check if under threat (simplified threat detection)
        const threatLevel = this.assessThreatLevel(gameContext);
        return threatLevel > 0.3; // Threshold for defensive action
    }

    /**
     * Execute defensive behavior based on strategy
     */
    private executeDefensiveBehavior(gameContext: GameContext): void {
        if (!this.defensiveStrategy) {
            return;
        }
        
        this.lastDefensiveAction = Date.now();
        
        const threatLevel = this.assessThreatLevel(gameContext);
        const defensiveAction = this.selectDefensiveAction(threatLevel);
        
        console.log(`🧠 BehaviorAdapter: Executing defensive behavior - ${defensiveAction} (threat level: ${threatLevel.toFixed(2)})`);
        
        // Record decision
        this.recordStrategicDecision(
            'defensive_action',
            `Executing ${defensiveAction} in response to threat level ${threatLevel.toFixed(2)}`,
            'Territorial defense'
        );
        
        // Update behavior state
        this.updateBehaviorState('defending');
    }

    /**
     * Check if predictive behavior should be executed
     */
    private shouldExecutePrediction(currentTime: number, gameContext: GameContext): boolean {
        if (currentTime - this.lastPrediction < this.predictionInterval) {
            return false;
        }
        
        // Only execute predictions if confidence is high enough
        return this.predictiveStrategy!.confidenceLevel > 0.6;
    }

    /**
     * Execute predictive behavior based on strategy
     */
    private executePredictiveBehavior(gameContext: GameContext): void {
        if (!this.predictiveStrategy) {
            return;
        }
        
        this.lastPrediction = Date.now();
        
        const predictions = this.generatePredictions(gameContext);
        const counterMeasures = this.selectCounterMeasures(predictions);
        
        console.log(`🧠 BehaviorAdapter: Executing predictive behavior - ${predictions.length} predictions, ${counterMeasures.length} counter-measures`);
        
        // Record decision
        this.recordStrategicDecision(
            'predictive_action',
            `Anticipating ${predictions.join(', ')} and preparing ${counterMeasures.join(', ')}`,
            'Proactive threat mitigation'
        );
        
        // Update behavior state
        this.updateBehaviorState('predicting');
    }

    /**
     * Calculate spawn count based on game context
     */
    private calculateSpawnCount(gameContext: GameContext): number {
        if (!this.spawnStrategy) {
            return 1;
        }
        
        // Base spawn count
        let spawnCount = 2;
        
        // Adjust based on mining activity
        if (this.spawnStrategy.responseToMining) {
            spawnCount += gameContext.activeMining.length;
        }
        
        // Adjust based on player unit count
        spawnCount += Math.floor(gameContext.playerUnitCount / 3);
        
        // Cap spawn count to prevent overwhelming
        return Math.min(spawnCount, 8);
    }

    /**
     * Calculate spawn locations based on strategy
     */
    private calculateSpawnLocations(gameContext: GameContext): Vector3[] {
        const locations: Vector3[] = [];
        
        // Add mining-focused locations if strategy calls for it
        if (this.spawnStrategy?.responseToMining && gameContext.activeMining.length > 0) {
            gameContext.activeMining.forEach(mining => {
                locations.push(mining.location);
            });
        }
        
        // Add default spawn locations if none specified
        if (locations.length === 0) {
            locations.push(new Vector3(0, 0, 0)); // Territory center
        }
        
        return locations;
    }

    /**
     * Assess current threat level
     */
    private assessThreatLevel(gameContext: GameContext): number {
        let threatLevel = 0.0;
        
        // Factor in player unit count
        threatLevel += Math.min(gameContext.playerUnitCount / 10, 0.5);
        
        // Factor in territory control
        threatLevel += (1.0 - gameContext.territoryControl) * 0.3;
        
        // Factor in energy level (higher energy = higher threat)
        threatLevel += Math.min(gameContext.energyLevel / 1000, 0.2);
        
        return Math.min(threatLevel, 1.0);
    }

    /**
     * Select appropriate defensive action
     */
    private selectDefensiveAction(threatLevel: number): string {
        if (!this.defensiveStrategy) {
            return 'basic_defense';
        }
        
        if (threatLevel > 0.7) {
            return this.defensiveStrategy.swarmTactics[0] || 'coordinated_swarm';
        } else if (threatLevel > 0.4) {
            return this.defensiveStrategy.counterAssaultPatterns[0] || 'counter_assault';
        } else {
            return 'patrol_defense';
        }
    }

    /**
     * Generate predictions based on game context
     */
    private generatePredictions(gameContext: GameContext): string[] {
        if (!this.predictiveStrategy) {
            return [];
        }
        
        const predictions: string[] = [];
        
        // Predict based on anticipated actions
        this.predictiveStrategy.anticipatedActions.forEach(action => {
            if (this.shouldPredictAction(action, gameContext)) {
                predictions.push(action);
            }
        });
        
        return predictions;
    }

    /**
     * Check if action should be predicted
     */
    private shouldPredictAction(action: string, gameContext: GameContext): boolean {
        // Simple prediction logic based on game state
        switch (action) {
            case 'mining_expansion':
                return gameContext.activeMining.length < 3 && gameContext.energyLevel > 300;
            case 'assault_preparation':
                return gameContext.playerUnitCount > 5;
            case 'exploration':
                return gameContext.exploredAreas < 5;
            default:
                return Math.random() > 0.5; // Random prediction for unknown actions
        }
    }

    /**
     * Select counter-measures for predictions
     */
    private selectCounterMeasures(predictions: string[]): string[] {
        if (!this.predictiveStrategy) {
            return [];
        }
        
        const counterMeasures: string[] = [];
        
        predictions.forEach(prediction => {
            const counter = this.getCounterMeasure(prediction);
            if (counter) {
                counterMeasures.push(counter);
            }
        });
        
        return counterMeasures;
    }

    /**
     * Get counter-measure for a prediction
     */
    private getCounterMeasure(prediction: string): string | null {
        if (!this.predictiveStrategy) {
            return null;
        }
        
        // Map predictions to counter-measures
        const counterMap: { [key: string]: string } = {
            'mining_expansion': 'preemptive_spawn',
            'assault_preparation': 'defensive_positioning',
            'exploration': 'territorial_patrol'
        };
        
        return counterMap[prediction] || this.predictiveStrategy.counterMeasures[0] || null;
    }

    /**
     * Record strategic decision
     */
    private recordStrategicDecision(decisionType: string, reasoning: string, expectedOutcome: string): void {
        const decision: StrategicDecision = {
            timestamp: Date.now(),
            decisionType,
            reasoning,
            expectedOutcome
        };
        
        this.strategicDecisions.push(decision);
        
        // Limit decision history
        if (this.strategicDecisions.length > 100) {
            this.strategicDecisions = this.strategicDecisions.slice(-50);
        }
    }

    /**
     * Update behavior state
     */
    private updateBehaviorState(newBehavior: string): void {
        if (this.behaviorState.currentBehavior !== newBehavior) {
            this.behaviorState.behaviorHistory.push(newBehavior);
            this.behaviorState.currentBehavior = newBehavior;
            this.behaviorState.lastAdaptation = Date.now();
            
            // Limit behavior history
            if (this.behaviorState.behaviorHistory.length > 20) {
                this.behaviorState.behaviorHistory = this.behaviorState.behaviorHistory.slice(-10);
            }
        }
    }

    /**
     * Evaluate behavior effectiveness and adapt if necessary
     */
    private evaluateBehaviorEffectiveness(gameContext: GameContext): void {
        // Simple effectiveness evaluation based on recent outcomes
        const recentDecisions = this.strategicDecisions.slice(-5);
        
        if (recentDecisions.length === 0) {
            return;
        }
        
        const avgEffectiveness = recentDecisions
            .filter(d => d.effectiveness !== undefined)
            .reduce((sum, d) => sum + (d.effectiveness || 0), 0) / recentDecisions.length;
        
        // Adapt if effectiveness is below threshold
        if (avgEffectiveness < this.adaptationThreshold) {
            this.adaptBehavior(gameContext);
        }
        
        // Update adaptation level
        this.behaviorState.adaptationLevel = avgEffectiveness;
    }

    /**
     * Adapt behavior based on poor performance
     */
    private adaptBehavior(gameContext: GameContext): void {
        console.log(`🧠 BehaviorAdapter: Adapting behavior due to low effectiveness`);
        
        // Increase spawn frequency if spawning is ineffective
        if (this.spawnStrategy && this.behaviorState.currentBehavior === 'spawning') {
            this.spawnCooldown = Math.max(2000, this.spawnCooldown * 0.8);
        }
        
        // Increase defensive sensitivity if defense is ineffective
        if (this.defensiveStrategy && this.behaviorState.currentBehavior === 'defending') {
            this.defensiveCooldown = Math.max(1000, this.defensiveCooldown * 0.8);
        }
        
        // Adjust prediction confidence if predictions are ineffective
        if (this.predictiveStrategy && this.behaviorState.currentBehavior === 'predicting') {
            this.predictiveStrategy.confidenceLevel = Math.max(0.3, this.predictiveStrategy.confidenceLevel * 0.9);
        }
        
        this.behaviorState.lastAdaptation = Date.now();
    }

    /**
     * Get current behavior state
     */
    public getBehaviorState(): BehaviorState {
        return { ...this.behaviorState };
    }

    /**
     * Get strategic decisions history
     */
    public getStrategicDecisions(): StrategicDecision[] {
        return [...this.strategicDecisions];
    }

    /**
     * Get current strategies
     */
    public getCurrentStrategies(): {
        hive?: HivePlacementStrategy;
        spawn?: SpawnStrategy;
        defensive?: DefensiveStrategy;
        predictive?: PredictiveStrategy;
    } {
        return {
            hive: this.hivePlacementStrategy,
            spawn: this.spawnStrategy,
            defensive: this.defensiveStrategy,
            predictive: this.predictiveStrategy
        };
    }

    /**
     * Reset all strategies
     */
    public resetStrategies(): void {
        this.hivePlacementStrategy = undefined;
        this.spawnStrategy = undefined;
        this.defensiveStrategy = undefined;
        this.predictiveStrategy = undefined;
        
        this.behaviorState.currentBehavior = 'default';
        this.behaviorState.adaptationLevel = 0.0;
        this.strategicDecisions = [];
        
        console.log(`🧠 BehaviorAdapter: All strategies reset`);
    }

    /**
     * Dispose behavior adapter
     */
    public dispose(): void {
        this.resetStrategies();
    }
}