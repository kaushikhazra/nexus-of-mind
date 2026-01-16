/**
 * EnergyParasite - Hostile creature that drains energy from workers
 *
 * Energy Parasites are the basic parasite type that:
 * - Spawns near mineral deposits
 * - Has territorial behavior (patrols territory radius)
 * - Attacks workers within territory (drains energy)
 * - Can be killed by protectors
 *
 * Extends the base Parasite class with worker-targeting behavior.
 */

import { Vector3, Scene, Color3 } from '@babylonjs/core';
import { MaterialManager } from '../../rendering/MaterialManager';
import { Worker } from './Worker';
import { MineralDeposit } from '../../world/MineralDeposit';
import { Parasite, ParasiteConfig, ParasiteState, TargetType } from './Parasite';
import { TargetPriority, FormationType } from '../types/StrategyTypes';

// Re-export for backward compatibility
export { ParasiteState } from './Parasite';

export interface EnergyParasiteConfig extends ParasiteConfig {
    materialManager: MaterialManager;
    homeDeposit: MineralDeposit;
}

export class EnergyParasite extends Parasite {
    // Home deposit reference
    protected homeDeposit: MineralDeposit;

    // Worker targeting
    protected currentTarget: Worker | null = null;

    // Feeding behavior
    protected drainRate: number = 2; // 2 energy/sec (balanced for longer fights)
    protected feedingStartTime: number = 0;
    protected lastFeedTime: number = 0;

    // Drain beam visual effect
    protected drainBeam: any | null = null;

    // Lifecycle
    protected maxLifetime: number = 180000; // 3 minutes

    // Strategy-controlled behavior
    protected aggressionLevel: number = 0.5;
    protected strategyTargetPriority: TargetPriority = TargetPriority.MINERS;
    protected strategyFormation: FormationType = FormationType.SWARM;

    constructor(config: EnergyParasiteConfig) {
        super(config);

        this.homeDeposit = config.homeDeposit;
        this.materialManager = config.materialManager;

        // Energy Parasite stats (native toughness)
        this.health = 60;
        this.maxHealth = 60;
        this.speed = 4; // Slower for recognizable combat
        this.regenRate = 1; // 1 HP/sec native healing

        this.lastFeedTime = this.spawnTime;

        // Create mesh
        this.createMesh();
    }

    // ==================== Abstract Method Implementations ====================

    /**
     * Energy Parasites are yellow/gold colored
     */
    public getColor(): Color3 {
        return new Color3(1.0, 0.85, 0.2); // Yellow/Gold
    }

    /**
     * Energy Parasites only target workers
     */
    public getTargetPriority(): TargetType[] {
        return [TargetType.WORKER];
    }

    // ==================== Segment Configuration ====================

    protected getSegmentCount(): number {
        return 4;
    }

    protected getSegmentSpacing(): number {
        return 0.3;
    }

    protected getSegmentSizeMultiplier(index: number): number {
        // Decrease by 20% each ring from head to tail
        return 1.0 - (index * 0.2);
    }

    // ==================== Update Loop ====================

    /**
     * Update parasite behavior (called each frame)
     */
    public update(deltaTime: number, nearbyWorkers: Worker[]): void {
        // Reset movement flag
        this.isMoving = false;

        // Update behavior based on current state
        switch (this.state) {
            case ParasiteState.SPAWNING:
                this.updateSpawning(deltaTime);
                break;
            case ParasiteState.PATROLLING:
                this.updatePatrollingWithWorkers(deltaTime, nearbyWorkers);
                break;
            case ParasiteState.HUNTING:
                this.updateHunting(deltaTime, nearbyWorkers);
                break;
            case ParasiteState.FEEDING:
                this.updateFeeding(deltaTime);
                break;
            case ParasiteState.RETURNING:
                this.updateReturning(deltaTime);
                break;
        }
    }

    // ==================== State Updates ====================

    /**
     * Handle spawning state (brief delay)
     */
    protected updateSpawning(deltaTime: number): void {
        const currentTime = Date.now();
        if (currentTime - this.lastStateChange > 1000) {
            this.setState(ParasiteState.PATROLLING);
        }
    }

    /**
     * Handle patrolling behavior with worker detection
     */
    protected updatePatrollingWithWorkers(deltaTime: number, nearbyWorkers: Worker[]): void {
        // Check for workers in territory
        const workersInTerritory = nearbyWorkers.filter(worker => {
            const distance = Vector3.Distance(worker.getPosition(), this.territoryCenter);
            return distance <= this.territoryRadius && worker.canBeTargetedByParasites();
        });

        if (workersInTerritory.length > 0) {
            // Found a target - start hunting
            this.currentTarget = workersInTerritory[0];
            this.setState(ParasiteState.HUNTING);
            return;
        }

        // Continue roaming (use base class smooth movement)
        this.updateRoaming(deltaTime);
    }

    /**
     * Handle hunting behavior
     */
    protected updateHunting(deltaTime: number, nearbyWorkers: Worker[]): void {
        if (!this.currentTarget) {
            this.setState(ParasiteState.PATROLLING);
            return;
        }

        // Check if target is still valid
        if (!this.currentTarget.canBeTargetedByParasites()) {
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
            return;
        }

        const targetPosition = this.currentTarget.getPosition();
        const distanceToTarget = Vector3.Distance(this.position, targetPosition);

        // Check if target left territory
        if (Vector3.Distance(targetPosition, this.territoryCenter) > this.territoryRadius) {
            this.currentTarget = null;
            this.setState(ParasiteState.RETURNING);
            return;
        }

        // Check if reached target (within 3 units for feeding)
        if (distanceToTarget <= 3.0) {
            this.setState(ParasiteState.FEEDING);
            this.feedingStartTime = Date.now();
            return;
        }

        // Move towards target (uses smooth movement from base class)
        this.moveTowards(targetPosition, deltaTime);
        this.updateTerrainSlope();
        this.updateSegmentAnimation();
    }

    /**
     * Handle feeding behavior
     */
    protected updateFeeding(deltaTime: number): void {
        if (!this.currentTarget) {
            this.setState(ParasiteState.PATROLLING);
            return;
        }

        const targetPosition = this.currentTarget.getPosition();
        const distanceToTarget = Vector3.Distance(this.position, targetPosition);

        // Check if target moved away
        if (distanceToTarget > 5.0) {
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
            return;
        }

        // Drain energy from worker
        const energyDrained = this.drainRate * deltaTime;
        const actualDrained = this.currentTarget.drainEnergy(energyDrained, 'parasite_feeding');

        if (actualDrained > 0) {
            this.lastFeedTime = Date.now();
        }

        // Create/update visual drain beam
        this.updateDrainBeam(this.currentTarget.getPosition());

        // Update terrain and animation while feeding
        this.updateTerrainSlope();
        this.updateSegmentAnimation();

        // Check if worker fled (low energy)
        const workerEnergy = this.currentTarget.getEnergyStorage().getCurrentEnergy();
        const workerMaxEnergy = this.currentTarget.getEnergyStorage().getCapacity();
        if (workerEnergy < workerMaxEnergy * 0.4) {
            // Make worker flee
            this.currentTarget.fleeFromDanger(this.position, 25);
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
        }
    }

    /**
     * Handle returning to territory
     */
    protected updateReturning(deltaTime: number): void {
        this.moveTowards(this.territoryCenter, deltaTime);
        this.updateTerrainSlope();
        this.updateSegmentAnimation();

        // Check if back in territory
        if (Vector3.Distance(this.position, this.territoryCenter) <= this.territoryRadius * 0.5) {
            this.setState(ParasiteState.PATROLLING);
        }
    }

    // ==================== State Management Override ====================

    /**
     * Override setState to handle drain beam cleanup
     */
    protected setState(newState: ParasiteState): void {
        if (this.state !== newState) {
            // Remove drain beam when leaving feeding state
            if (this.state === ParasiteState.FEEDING && newState !== ParasiteState.FEEDING) {
                this.removeDrainBeam();
            }

            super.setState(newState);
        }
    }

    // ==================== Drain Beam Visual ====================

    /**
     * Create or update visual drain beam
     */
    protected updateDrainBeam(targetPosition: Vector3): void {
        if (!this.scene) return;

        // Remove existing beam
        if (this.drainBeam) {
            this.drainBeam.dispose();
            this.drainBeam = null;
        }

        // Create new beam
        const { MeshBuilder, Color3, StandardMaterial } = require('@babylonjs/core');

        const points = [this.position.clone(), targetPosition.clone()];
        this.drainBeam = MeshBuilder.CreateLines(`drain_beam_${this.id}`, {
            points: points
        }, this.scene);

        // Create red material for the beam
        const beamMaterial = new StandardMaterial(`drain_beam_material_${this.id}`, this.scene);
        beamMaterial.emissiveColor = new Color3(1, 0.2, 0.2);
        beamMaterial.disableLighting = true;
        this.drainBeam.material = beamMaterial;

        this.drainBeam.alpha = 0.8;
    }

    /**
     * Remove visual drain beam
     */
    protected removeDrainBeam(): void {
        if (this.drainBeam) {
            this.drainBeam.dispose();
            this.drainBeam = null;
        }
    }

    // ==================== Getters ====================

    public getHomeDeposit(): MineralDeposit { return this.homeDeposit; }

    /**
     * Get energy reward for killing this Energy Parasite
     */
    public getEnergyReward(): number {
        const { PARASITE_STATS, ParasiteType } = require('../types/ParasiteTypes');
        return PARASITE_STATS[ParasiteType.ENERGY].energyReward;
    }

    // ==================== Visibility Override ====================

    /**
     * Hide parasite (override to handle drain beam)
     */
    public hide(): void {
        this.removeDrainBeam();
        super.hide();
    }

    // ==================== Respawn Override ====================

    /**
     * Respawn at new position
     */
    public respawn(newPosition: Vector3): void {
        super.respawn(newPosition);
        this.currentTarget = null;
        this.feedingStartTime = 0;
    }

    // ==================== Cleanup Override ====================

    /**
     * Dispose parasite
     */
    public dispose(): void {
        this.removeDrainBeam();
        super.dispose();
    }

    // ==================== Strategy Control ====================

    /**
     * Set aggression level from strategy (0-1)
     * Higher aggression = more pursuit, faster drain
     */
    public setAggression(level: number): void {
        this.aggressionLevel = Math.max(0, Math.min(1, level));
        // Adjust drain rate based on aggression (1.5-3 range)
        this.drainRate = 1.5 + (level * 1.5);
    }

    /**
     * Set target priority from strategy
     */
    public setTargetPriority(priority: TargetPriority): void {
        this.strategyTargetPriority = priority;
    }

    /**
     * Set formation behavior from strategy
     */
    public setFormation(formation: FormationType): void {
        this.strategyFormation = formation;
    }

    /**
     * Get current aggression level
     */
    public getAggression(): number {
        return this.aggressionLevel;
    }

    /**
     * Get strategy-controlled target priority
     */
    public getStrategyTargetPriority(): TargetPriority {
        return this.strategyTargetPriority;
    }

    /**
     * Get strategy-controlled formation
     */
    public getStrategyFormation(): FormationType {
        return this.strategyFormation;
    }
}
