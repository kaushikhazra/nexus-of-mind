/**
 * EnergyParasite - Hostile creature that drains energy from workers
 * 
 * Phase 1 Implementation:
 * - Spawns near mineral deposits
 * - Territorial behavior (patrols 15-unit radius)
 * - Attacks workers within territory
 * - Simple energy drain (1 energy/sec)
 * - Can be killed by protectors
 */

import { Vector3, Scene, Mesh, MeshBuilder, Material, TransformNode } from '@babylonjs/core';
import { MaterialManager } from '../../rendering/MaterialManager';
import { Worker } from './Worker';
import { MineralDeposit } from '../../world/MineralDeposit';

export interface EnergyParasiteConfig {
    position: Vector3;
    scene: Scene;
    materialManager: MaterialManager;
    homeDeposit: MineralDeposit; // The mineral deposit this parasite guards
}

export enum ParasiteState {
    SPAWNING = 'spawning',
    PATROLLING = 'patrolling', 
    HUNTING = 'hunting',
    FEEDING = 'feeding',
    RETURNING = 'returning'
}

export class EnergyParasite {
    private id: string;
    private position: Vector3;
    private scene: Scene;
    private materialManager: MaterialManager;
    private homeDeposit: MineralDeposit;
    
    // Territorial behavior
    private territoryCenter: Vector3;
    private territoryRadius: number = 15; // 15-unit radius territory
    private patrolTarget: Vector3;
    
    // State management
    private state: ParasiteState = ParasiteState.SPAWNING;
    private currentTarget: Worker | null = null;
    private lastStateChange: number = 0;
    
    // Combat and feeding
    private health: number = 2; // Takes 2 hits to kill (Phase 1)
    private maxHealth: number = 2;
    private drainRate: number = 1; // 1 energy/sec (Phase 1)
    private feedingStartTime: number = 0;
    
    // Movement
    private speed: number = 2; // Units per second
    private lastPosition: Vector3;
    
    // Visual representation
    private mesh: Mesh | null = null;
    private material: Material | null = null;
    
    // Lifecycle
    private spawnTime: number;
    private lastFeedTime: number = 0;
    private maxLifetime: number = 180000; // 3 minutes without feeding
    
    constructor(config: EnergyParasiteConfig) {
        this.id = `parasite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.position = config.position.clone();
        this.scene = config.scene;
        this.materialManager = config.materialManager;
        this.homeDeposit = config.homeDeposit;
        
        // Set territory center to spawn position
        this.territoryCenter = this.position.clone();
        this.lastPosition = this.position.clone();
        
        // Initialize patrol target
        this.patrolTarget = this.generatePatrolTarget();
        
        this.spawnTime = Date.now();
        this.lastStateChange = this.spawnTime;
        this.lastFeedTime = this.spawnTime;
        
        this.createMesh();
        
        console.log(`🟣 EnergyParasite spawned: ${this.id} at ${this.position.toString()} (guarding ${this.homeDeposit.getId()})`);
    }
    
    /**
     * Create the 3D mesh for the parasite
     */
    private createMesh(): void {
        if (!this.scene) return;
        
        // Create a dark purple sphere (Phase 1: simple representation)
        this.mesh = MeshBuilder.CreateSphere(`parasite_${this.id}`, {
            diameter: 1.0, // 0.5 unit radius
            segments: 8 // Low poly
        }, this.scene);
        
        this.mesh.position = this.position.clone();
        
        // Create dark purple material with slight glow
        this.material = this.materialManager.getParasiteMaterial();
        if (this.material) {
            this.mesh.material = this.material;
        }
        
        console.log(`🟣 Parasite mesh created for ${this.id}`);
    }
    
    /**
     * Update parasite behavior (called each frame)
     */
    public update(deltaTime: number, nearbyWorkers: Worker[]): void {
        const currentTime = Date.now();
        
        // Check if parasite should die from starvation
        if (currentTime - this.lastFeedTime > this.maxLifetime) {
            console.log(`🟣 Parasite ${this.id} starved after ${this.maxLifetime/1000}s without feeding`);
            this.dispose();
            return;
        }
        
        // Update behavior based on current state
        switch (this.state) {
            case ParasiteState.SPAWNING:
                this.updateSpawning(deltaTime, currentTime);
                break;
            case ParasiteState.PATROLLING:
                this.updatePatrolling(deltaTime, nearbyWorkers);
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
        
        // Update mesh position
        if (this.mesh) {
            this.mesh.position = this.position.clone();
        }
    }
    
    /**
     * Handle spawning state (brief animation/delay)
     */
    private updateSpawning(deltaTime: number, currentTime: number): void {
        // Simple spawn delay of 1 second
        if (currentTime - this.lastStateChange > 1000) {
            this.setState(ParasiteState.PATROLLING);
        }
    }
    
    /**
     * Handle patrolling behavior
     */
    private updatePatrolling(deltaTime: number, nearbyWorkers: Worker[]): void {
        // Check for workers in territory
        const workersInTerritory = nearbyWorkers.filter(worker => 
            Vector3.Distance(worker.getPosition(), this.territoryCenter) <= this.territoryRadius
        );
        
        if (workersInTerritory.length > 0) {
            // Found a target - start hunting
            this.currentTarget = workersInTerritory[0]; // Target closest worker
            this.setState(ParasiteState.HUNTING);
            return;
        }
        
        // Continue patrolling
        this.moveTowards(this.patrolTarget, deltaTime);
        
        // Check if reached patrol target
        if (Vector3.Distance(this.position, this.patrolTarget) < 1.0) {
            this.patrolTarget = this.generatePatrolTarget();
        }
    }
    
    /**
     * Handle hunting behavior
     */
    private updateHunting(deltaTime: number, nearbyWorkers: Worker[]): void {
        if (!this.currentTarget) {
            this.setState(ParasiteState.PATROLLING);
            return;
        }
        
        const targetPosition = this.currentTarget.getPosition();
        const distanceToTarget = Vector3.Distance(this.position, targetPosition);
        
        // Check if target left territory
        if (Vector3.Distance(targetPosition, this.territoryCenter) > this.territoryRadius) {
            console.log(`🟣 Parasite ${this.id} lost target - worker left territory`);
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
        
        // Move towards target
        this.moveTowards(targetPosition, deltaTime);
    }
    
    /**
     * Handle feeding behavior
     */
    private updateFeeding(deltaTime: number): void {
        if (!this.currentTarget) {
            this.setState(ParasiteState.PATROLLING);
            return;
        }
        
        const targetPosition = this.currentTarget.getPosition();
        const distanceToTarget = Vector3.Distance(this.position, targetPosition);
        
        // Check if target moved away
        if (distanceToTarget > 5.0) {
            console.log(`🟣 Parasite ${this.id} lost feeding target - worker moved away`);
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
            return;
        }
        
        // Drain energy from worker
        const energyDrained = this.drainRate * deltaTime;
        const actualDrained = this.currentTarget.drainEnergy(energyDrained, 'parasite_feeding');
        
        if (actualDrained > 0) {
            this.lastFeedTime = Date.now();
            console.log(`🟣 Parasite ${this.id} drained ${actualDrained.toFixed(2)} energy from worker`);
        }
        
        // Check if worker fled (low energy)
        const workerEnergy = this.currentTarget.getEnergyStorage().getCurrentEnergy();
        const workerMaxEnergy = this.currentTarget.getEnergyStorage().getCapacity();
        if (workerEnergy < workerMaxEnergy * 0.2) { // 20% threshold
            console.log(`🟣 Worker fled from parasite ${this.id} due to low energy`);
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
        }
    }
    
    /**
     * Handle returning to territory
     */
    private updateReturning(deltaTime: number): void {
        this.moveTowards(this.territoryCenter, deltaTime);
        
        // Check if back in territory
        if (Vector3.Distance(this.position, this.territoryCenter) <= this.territoryRadius * 0.5) {
            this.setState(ParasiteState.PATROLLING);
        }
    }
    
    /**
     * Move towards a target position
     */
    private moveTowards(target: Vector3, deltaTime: number): void {
        const direction = target.subtract(this.position).normalize();
        const movement = direction.scale(this.speed * deltaTime);
        this.position.addInPlace(movement);
    }
    
    /**
     * Generate a random patrol target within territory
     */
    private generatePatrolTarget(): Vector3 {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * this.territoryRadius * 0.8; // Stay within 80% of territory
        
        const offset = new Vector3(
            Math.cos(angle) * distance,
            0,
            Math.sin(angle) * distance
        );
        
        return this.territoryCenter.add(offset);
    }
    
    /**
     * Change parasite state
     */
    private setState(newState: ParasiteState): void {
        if (this.state !== newState) {
            console.log(`🟣 Parasite ${this.id} state: ${this.state} → ${newState}`);
            this.state = newState;
            this.lastStateChange = Date.now();
        }
    }
    
    /**
     * Take damage from protector attack
     */
    public takeDamage(damage: number): boolean {
        this.health -= damage;
        console.log(`🟣 Parasite ${this.id} took ${damage} damage (${this.health}/${this.maxHealth} remaining)`);
        
        if (this.health <= 0) {
            console.log(`🟣 Parasite ${this.id} destroyed!`);
            this.dispose();
            return true; // Parasite destroyed
        }
        
        return false; // Still alive
    }
    
    // Getters
    public getId(): string { return this.id; }
    public getPosition(): Vector3 { return this.position.clone(); }
    public getState(): ParasiteState { return this.state; }
    public getHealth(): number { return this.health; }
    public getMaxHealth(): number { return this.maxHealth; }
    public getTerritoryCenter(): Vector3 { return this.territoryCenter.clone(); }
    public getTerritoryRadius(): number { return this.territoryRadius; }
    public getHomeDeposit(): MineralDeposit { return this.homeDeposit; }
    public isAlive(): boolean { return this.health > 0; }
    
    /**
     * Dispose parasite and cleanup resources
     */
    public dispose(): void {
        if (this.mesh) {
            this.mesh.dispose();
            this.mesh = null;
        }
        
        console.log(`🟣 EnergyParasite ${this.id} disposed`);
    }
}