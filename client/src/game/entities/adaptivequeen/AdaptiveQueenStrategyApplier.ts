/**
 * AdaptiveQueenStrategyApplier - Strategy application for Queen learning system
 *
 * Handles applying learned strategies to Queen behavior.
 */

import { Vector3 } from '@babylonjs/core';
import type {
    QueenLearningData,
    QueenStrategy,
    HivePlacementStrategy,
    SpawnStrategy,
    DefensiveStrategy,
    PredictiveStrategy,
    LearningProgress
} from './AdaptiveQueenInterfaces';

export class AdaptiveQueenStrategyApplier {
    private learningData: QueenLearningData;
    private currentStrategy?: QueenStrategy;
    private learningProgress: LearningProgress;
    private learningCallbacks: ((progress: LearningProgress) => void)[] = [];

    constructor(learningData: QueenLearningData, learningProgress: LearningProgress) {
        this.learningData = learningData;
        this.learningProgress = learningProgress;
    }

    public async applyStrategy(
        strategy: QueenStrategy,
        position: Vector3,
        setPosition: (x: number, z: number) => void
    ): Promise<void> {
        this.currentStrategy = strategy;

        console.log(`🧠 Applying learning strategy (Gen ${strategy.generation})`);

        if (strategy.hivePlacement) {
            this.applyHivePlacementStrategy(strategy.hivePlacement, position, setPosition);
        }

        if (strategy.parasiteSpawning) {
            this.applySpawnStrategy(strategy.parasiteSpawning);
        }

        if (strategy.defensiveCoordination) {
            this.applyDefensiveStrategy(strategy.defensiveCoordination);
        }

        if (strategy.predictiveBehavior) {
            this.applyPredictiveStrategy(strategy.predictiveBehavior);
        }

        this.learningData.strategiesAttempted.push(`Gen${strategy.generation}_Strategy`);

        this.learningProgress.currentPhase = 'complete';
        this.learningProgress.progress = 1.0;
        this.notifyLearningProgress();
    }

    private applyHivePlacementStrategy(
        strategy: HivePlacementStrategy,
        position: Vector3,
        setPosition: (x: number, z: number) => void
    ): void {
        if (strategy.preferredLocations.length > 0) {
            const preferredLocation = strategy.preferredLocations[0];
            setPosition(preferredLocation.x, preferredLocation.z);

            this.learningData.hivePlacementReasoning = strategy.placementReasoning;

            console.log(`🧠 Applied hive placement strategy: ${strategy.placementReasoning}`);
        }
    }

    private applySpawnStrategy(strategy: SpawnStrategy): void {
        this.learningData.parasiteSpawnTiming = strategy.timingPattern;
        console.log(`🧠 Applied spawn strategy: ${strategy.distributionPattern}`);
    }

    private applyDefensiveStrategy(strategy: DefensiveStrategy): void {
        console.log(`🧠 Applied defensive strategy with coordination level: ${strategy.coordinationLevel}`);
    }

    private applyPredictiveStrategy(strategy: PredictiveStrategy): void {
        console.log(`🧠 Applied predictive strategy with ${strategy.predictionHorizon}s horizon`);
    }

    public applyLearnedBehaviors(deltaTime: number): void {
        if (!this.currentStrategy) return;

        if (this.currentStrategy.predictiveBehavior) {
            this.executePredictiveBehavior(deltaTime);
        }

        if (this.currentStrategy.parasiteSpawning.adaptiveSpawning) {
            this.executeAdaptiveSpawning(deltaTime);
        }

        if (this.currentStrategy.defensiveCoordination.adaptiveDefense) {
            this.executeAdaptiveDefense(deltaTime);
        }
    }

    private executePredictiveBehavior(deltaTime: number): void {
        // Implement predictive behavior based on learned patterns
    }

    private executeAdaptiveSpawning(deltaTime: number): void {
        // Implement adaptive parasite spawning based on learned patterns
    }

    private executeAdaptiveDefense(deltaTime: number): void {
        // Implement adaptive defensive coordination based on learned patterns
    }

    public updateLearningProgress(progress: LearningProgress): void {
        this.learningProgress = progress;
        this.notifyLearningProgress();
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

    public onLearningProgress(callback: (progress: LearningProgress) => void): void {
        this.learningCallbacks.push(callback);
    }

    public getCurrentStrategy(): QueenStrategy | undefined {
        return this.currentStrategy;
    }

    public getLearningProgress(): LearningProgress {
        return { ...this.learningProgress };
    }

    public clearCallbacks(): void {
        this.learningCallbacks = [];
    }
}
