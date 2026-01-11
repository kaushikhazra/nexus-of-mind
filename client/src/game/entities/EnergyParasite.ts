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
import { CombatTarget } from '../CombatSystem';

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

export class EnergyParasite implements CombatTarget {
    public id: string;
    public position: Vector3;
    private scene: Scene;
    private materialManager: MaterialManager;
    private homeDeposit: MineralDeposit;
    
    // Territorial behavior
    private territoryCenter: Vector3;
    private territoryRadius: number = 100; // 100-unit radius territory
    private patrolTarget: Vector3;
    
    // State management
    private state: ParasiteState = ParasiteState.SPAWNING;
    private currentTarget: Worker | null = null;
    private lastStateChange: number = 0;
    
    // Combat and feeding
    public health: number = 2; // Takes 2 hits to kill (Phase 1)
    public maxHealth: number = 2;
    private drainRate: number = 3; // 3 energy/sec (increased for more dramatic effect)
    private feedingStartTime: number = 0;
    
    // Movement
    private speed: number = 2; // Units per second
    private lastPosition: Vector3;
    private isMoving: boolean = false; // Track if worm is currently moving
    
    // Visual representation - 4 ring segments
    private segments: Mesh[] = [];
    private segmentPositions: Vector3[] = [];
    private parentNode: TransformNode | null = null; // Parent node for click detection
    private mesh: Mesh | null = null; // Keep for compatibility
    private material: Material | null = null;
    private drainBeam: any | null = null; // Visual effect for energy drain
    
    // Terrain following
    private terrainGenerator: any = null;
    
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
        
        // Get terrain generator from material manager (we'll need to pass it)
        this.terrainGenerator = null; // Will be set by ParasiteManager
        
        // Initialize patrol target
        this.patrolTarget = this.generatePatrolTarget();
        
        this.spawnTime = Date.now();
        this.lastStateChange = this.spawnTime;
        this.lastFeedTime = this.spawnTime;
        
        this.createMesh();
        
        // EnergyParasite spawned silently
    }
    
    /**
     * Create the 4-ring worm parasite mesh
     */
    private createMesh(): void {
        if (!this.scene) return;
        
        // Create parent node for click detection with correct naming
        this.parentNode = new TransformNode(`parasite_${this.id}`, this.scene);
        this.parentNode.position = this.position.clone();
        
        // Create 4 ring segments (torus shapes)
        this.segments = [];
        this.segmentPositions = [];
        
        for (let i = 0; i < 4; i++) {
            // Calculate progressively smaller size from head (i=0) to tail (i=3)
            const sizeMultiplier = 1.0 - (i * 0.2); // Decrease by 20% each ring
            const ringDiameter = 0.8 * sizeMultiplier;
            const ringThickness = 0.2 * sizeMultiplier;
            
            // Create torus ring with decreasing size
            const segment = MeshBuilder.CreateTorus(`parasite_segment_${this.id}_${i}`, {
                diameter: ringDiameter,
                thickness: ringThickness,
                tessellation: 8 // Low poly
            }, this.scene);
            
            // Make this segment a child of the parent node for click detection
            segment.parent = this.parentNode;
            
            // Position rings in a line (start with original spacing)
            const segmentPos = new Vector3(0, 0, -i * 0.3); // Space rings 0.3 units apart
            segment.position = segmentPos;
            
            // Rotate rings to lay flat (like wheels)
            segment.rotation.x = Math.PI / 2;
            
            this.segments.push(segment);
            // Initialize segment positions in world coordinates for trailing effect
            this.segmentPositions.push(this.position.clone().add(segmentPos));
        }
        
        // Apply material to all segments
        this.material = this.materialManager.getParasiteMaterial();
        if (this.material) {
            this.segments.forEach(segment => {
                segment.material = this.material;
            });
        }
        
        // 4-ring worm parasite mesh created silently
    }
    
    /**
     * Update parasite behavior (called each frame)
     */
    public update(deltaTime: number, nearbyWorkers: Worker[]): void {
        const currentTime = Date.now();

        // Reset movement flag at start of frame (will be set to true if movement occurs)
        this.isMoving = false;

        // Parasites no longer starve - they only die when killed by Protectors
        // and will respawn 15m away after 30 seconds

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
        
        // Update position to follow terrain height
        this.updateTerrainHeight();
        
        // Update segment positions with trailing effect, inertia, and organic squeezing
        if (this.segments && this.segments.length > 0 && this.parentNode) {
            // Update parent node position
            this.parentNode.position = this.position.clone();
            
            const time = Date.now() * 0.002; // Slower wave animation (was 0.005)
            const waveSpeed = 1.5; // Slower wave speed (was 2.0)
            
            for (let i = 0; i < this.segments.length; i++) {
                if (i === 0) {
                    // Head segment follows the main position (relative to parent at origin)
                    const segmentPos = Vector3.Zero();
                    this.segments[i].position = segmentPos;
                    this.segmentPositions[i] = this.position.clone();
                } else {
                    // Body segments trail behind in the opposite direction of movement
                    const prevSegmentPos = this.segmentPositions[i - 1];
                    
                    // Calculate trailing position based on current facing direction
                    const currentRotation = this.segments[0].rotation.y; // Use head's rotation
                    
                    // Dynamic distance based on movement (inertia effect)
                    const baseDistance = 0.3;
                    const currentSpeed = this.speed;
                    const maxSpeed = 3.0;
                    const speedRatio = Math.min(currentSpeed / maxSpeed, 1.0);
                    const inertiaMultiplier = 1.0 + (speedRatio * 0.5);
                    
                    // Add organic squeezing wave effect (subtle)
                    const segmentPhase = i * 0.8; // Phase offset for each segment
                    const squeezeWave = Math.sin(time * waveSpeed + segmentPhase) * 0.15; // Reduced amplitude from 0.3 to 0.15
                    const squeezeMultiplier = 1.0 + squeezeWave; // Oscillate between 0.85x and 1.15x (was 0.7x to 1.3x)
                    
                    const trailingDistance = baseDistance * inertiaMultiplier * squeezeMultiplier;
                    
                    // Trail behind the previous segment (opposite to facing direction)
                    const trailOffset = new Vector3(
                        -Math.sin(currentRotation) * trailingDistance,
                        0,
                        -Math.cos(currentRotation) * trailingDistance
                    );
                    
                    // Calculate world position for segment tracking
                    const segmentWorldPos = prevSegmentPos.add(trailOffset);
                    this.segmentPositions[i] = segmentWorldPos;
                    
                    // Convert to local position relative to parent node
                    const segmentLocalPos = segmentWorldPos.subtract(this.position);
                    this.segments[i].position = segmentLocalPos;
                }
            }
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
        // Check for workers in territory that can be targeted
        const workersInTerritory = nearbyWorkers.filter(worker => {
            const distance = Vector3.Distance(worker.getPosition(), this.territoryCenter);
            return distance <= this.territoryRadius && worker.canBeTargetedByParasites();
        });
        
        if (workersInTerritory.length > 0) {
            // Found a target - start hunting
            this.currentTarget = workersInTerritory[0]; // Target closest available worker
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
        
        // Check if target is still valid (not immune)
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
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
            return;
        }
        
        // Drain energy from worker
        const energyDrained = this.drainRate * deltaTime;
        const workerEnergyBefore = this.currentTarget.getEnergyStorage().getCurrentEnergy();
        const actualDrained = this.currentTarget.drainEnergy(energyDrained, 'parasite_feeding');
        const workerEnergyAfter = this.currentTarget.getEnergyStorage().getCurrentEnergy();
        
        if (actualDrained > 0) {
            this.lastFeedTime = Date.now();
        }
        
        // Create/update visual drain beam
        this.updateDrainBeam(this.currentTarget.getPosition());
        
        // Check if worker fled (low energy)
        const workerEnergy = this.currentTarget.getEnergyStorage().getCurrentEnergy();
        const workerMaxEnergy = this.currentTarget.getEnergyStorage().getCapacity();
        if (workerEnergy < workerMaxEnergy * 0.4) { // 40% threshold (more responsive)
            
            // Make worker actually flee from this parasite
            this.currentTarget.fleeFromDanger(this.position, 25);
            
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
     * Move towards a target position with directional facing
     */
    private moveTowards(target: Vector3, deltaTime: number): void {
        const direction = target.subtract(this.position).normalize();
        const movement = direction.scale(this.speed * deltaTime);
        
        // Track that we're moving
        this.isMoving = movement.length() > 0.01;
        
        // Calculate facing angle (Y-axis rotation to face movement direction)
        if (this.isMoving) { // Only rotate if there's significant movement
            const facingAngle = Math.atan2(direction.x, direction.z);
            
            // Apply rotation to all segments so the whole worm faces the movement direction
            if (this.segments && this.segments.length > 0) {
                this.segments.forEach(segment => {
                    segment.rotation.y = facingAngle;
                    // Keep X rotation for ring orientation (laying flat)
                    segment.rotation.x = Math.PI / 2;
                });
            }
        }
        
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
            
            // Remove drain beam when leaving feeding state
            if (this.state === ParasiteState.FEEDING && newState !== ParasiteState.FEEDING) {
                this.removeDrainBeam();
            }
            
            this.state = newState;
            this.lastStateChange = Date.now();
        }
    }
    
    /**
     * Take damage from protector attack (implements CombatTarget interface)
     */
    public takeDamage(damage: number): boolean {
        this.health -= damage;

        if (this.health <= 0) {
            // Don't dispose - ParasiteManager will handle respawn
            return true; // Parasite killed (will respawn)
        }

        return false; // Still alive
    }

    /**
     * Handle destruction (implements CombatTarget interface)
     */
    public onDestroyed(): void {
        // Notify ParasiteManager of destruction for proper cleanup
        // This will be called by CombatSystem when the parasite is destroyed
        console.log(`🎯 EnergyParasite ${this.id} killed - will respawn nearby`);
    }

    /**
     * Hide the parasite (used while waiting to respawn)
     */
    public hide(): void {
        // Remove drain beam if feeding
        this.removeDrainBeam();

        // Hide parent node which hides all segments
        if (this.parentNode) {
            this.parentNode.setEnabled(false);
        }
        // Also hide individual segments
        for (const segment of this.segments) {
            if (segment) {
                segment.setEnabled(false);
            }
        }
    }

    /**
     * Show the parasite
     */
    public show(): void {
        // Show parent node which shows all segments
        if (this.parentNode) {
            this.parentNode.setEnabled(true);
        }
        // Also show individual segments
        for (const segment of this.segments) {
            if (segment) {
                segment.setEnabled(true);
            }
        }
    }

    /**
     * Respawn the parasite at a new position
     */
    public respawn(newPosition: Vector3): void {
        // Reset health
        this.health = this.maxHealth;

        // Update position
        this.position = newPosition.clone();

        // Update territory center to new location
        this.territoryCenter = newPosition.clone();

        // Move parent node to new position
        if (this.parentNode) {
            this.parentNode.position = newPosition.clone();
        }

        // Reset segment positions
        for (let i = 0; i < this.segments.length; i++) {
            const segmentPos = new Vector3(0, 0, -i * 0.3);
            this.segments[i].position = segmentPos;
            this.segmentPositions[i] = newPosition.clone().add(segmentPos);
        }

        // Show the parasite
        this.show();

        // Reset state
        this.state = ParasiteState.PATROLLING;
        this.currentTarget = null;
        this.feedingStartTime = 0;

        // Generate new patrol target around new territory
        this.patrolTarget = this.generatePatrolTarget();

        console.log(`🔄 Parasite ${this.id} respawned at (${newPosition.x.toFixed(1)}, ${newPosition.z.toFixed(1)})`);
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
     * Set terrain generator for height detection
     */
    public setTerrainGenerator(terrainGenerator: any): void {
        this.terrainGenerator = terrainGenerator;
    }
    
    /**
     * Get terrain height at position
     */
    private getTerrainHeight(x: number, z: number): number {
        if (this.terrainGenerator) {
            return this.terrainGenerator.getHeightAtPosition(x, z);
        }
        return 0.5; // Default height if no terrain generator
    }
    
    /**
     * Update position to follow terrain height (only when moving to prevent jitter)
     */
    private updateTerrainHeight(): void {
        // Only adjust terrain height when the worm is actually moving
        if (this.isMoving && this.terrainGenerator) {
            const terrainHeight = this.getTerrainHeight(this.position.x, this.position.z);
            const newY = terrainHeight + 1.0; // 1.0 unit above terrain
            
            // Only update if there's a significant difference to avoid jitter
            if (Math.abs(this.position.y - newY) > 0.1) {
                this.position.y = newY;
            }
        } else if (!this.terrainGenerator) {
            // Fallback if no terrain generator
            this.position.y = 1.0;
        }
        // When not moving, keep current Y position to prevent jitter
    }
    
    /**
     * Create or update visual drain beam
     */
    private updateDrainBeam(targetPosition: Vector3): void {
        if (!this.scene) return;
        
        // Remove existing beam
        if (this.drainBeam) {
            this.drainBeam.dispose();
            this.drainBeam = null;
        }
        
        // Create new beam (simple line)
        const { MeshBuilder, Color3, StandardMaterial } = require('@babylonjs/core');
        
        const points = [this.position.clone(), targetPosition.clone()];
        this.drainBeam = MeshBuilder.CreateLines(`drain_beam_${this.id}`, {
            points: points
        }, this.scene);
        
        // Create red material for the beam
        const beamMaterial = new StandardMaterial(`drain_beam_material_${this.id}`, this.scene);
        beamMaterial.emissiveColor = new Color3(1, 0.2, 0.2); // Red glow
        beamMaterial.disableLighting = true;
        this.drainBeam.material = beamMaterial;
        
        // Make beam slightly transparent and glowing
        this.drainBeam.alpha = 0.8;
    }
    
    /**
     * Remove visual drain beam
     */
    private removeDrainBeam(): void {
        if (this.drainBeam) {
            this.drainBeam.dispose();
            this.drainBeam = null;
        }
    }
    
    /**
     * Dispose parasite and cleanup resources
     */
    public dispose(): void {
        this.removeDrainBeam();
        
        // Dispose all ring segments
        if (this.segments) {
            this.segments.forEach(segment => {
                if (segment) {
                    segment.dispose();
                }
            });
            this.segments = [];
        }
        
        // Dispose parent node
        if (this.parentNode) {
            this.parentNode.dispose();
            this.parentNode = null;
        }
        
        if (this.mesh) {
            this.mesh.dispose();
            this.mesh = null;
        }
        
        // Parasite disposed silently
    }
}