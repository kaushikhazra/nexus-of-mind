/**
 * Parasite - Abstract base class for all parasite types
 *
 * This class consolidates shared behavior across EnergyParasite, CombatParasite, and Queen:
 * - Movement system (moveTowards)
 * - Segment wave animation (updateSegmentAnimation)
 * - Patrol/roaming behavior (updatePatrolling, generatePatrolTarget)
 * - Terrain following
 * - Visual mesh management
 *
 * Subclasses define what makes each type unique:
 * - Color (getColor)
 * - Targeting behavior (getTargetPriority)
 * - Segment configuration (getSegmentCount, getSegmentSpacing)
 * - Special abilities (Queen spawning, etc.)
 */

import { Vector3, Scene, Mesh, MeshBuilder, Material, TransformNode, Color3 } from '@babylonjs/core';
import { MaterialManager } from '../../rendering/MaterialManager';
import { CombatTarget } from '../CombatSystem';

/**
 * Target types for parasite targeting system
 */
export enum TargetType {
    WORKER = 'worker',
    PROTECTOR = 'protector'
}

/**
 * Parasite states shared across all types
 */
export enum ParasiteState {
    SPAWNING = 'spawning',
    PATROLLING = 'patrolling',
    HUNTING = 'hunting',
    FEEDING = 'feeding',
    RETURNING = 'returning'
}

/**
 * Base configuration for all parasites
 */
export interface ParasiteConfig {
    position: Vector3;
    scene: Scene;
    materialManager?: MaterialManager;
}

/**
 * Abstract base class for all parasite types
 */
export abstract class Parasite implements CombatTarget {
    // CombatTarget interface properties
    public id: string;
    public position: Vector3;
    public health: number;
    public maxHealth: number;

    // Scene and rendering
    protected scene: Scene;
    protected materialManager: MaterialManager | null = null;

    // Visual representation
    protected segments: Mesh[] = [];
    protected segmentPositions: Vector3[] = [];
    protected parentNode: TransformNode | null = null;
    protected material: Material | null = null;

    // Movement
    protected speed: number = 2;
    protected isMoving: boolean = false;
    protected facingAngle: number = 0;

    // Patrol/Territory behavior
    protected territoryCenter: Vector3;
    protected territoryRadius: number = 50;
    protected patrolTarget: Vector3;
    protected patrolPauseTime: number = 0;
    protected patrolPauseDuration: number = 2;
    protected isPatrolPaused: boolean = false;

    // State management
    protected state: ParasiteState = ParasiteState.SPAWNING;
    protected lastStateChange: number = 0;

    // Terrain following
    protected terrainGenerator: any = null;

    // Lifecycle
    protected spawnTime: number;

    constructor(config: ParasiteConfig) {
        this.id = `parasite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.position = config.position.clone();
        this.scene = config.scene;
        this.materialManager = config.materialManager || null;

        // Initialize default health (subclasses override)
        this.health = 2;
        this.maxHealth = 2;

        // Set territory center to spawn position
        this.territoryCenter = this.position.clone();

        // Initialize patrol target
        this.patrolTarget = this.generatePatrolTarget();

        this.spawnTime = Date.now();
        this.lastStateChange = this.spawnTime;
    }

    // ==================== Abstract Methods ====================
    // Subclasses MUST implement these

    /**
     * Get the color for this parasite type
     * Used during mesh creation to apply appropriate material
     */
    abstract getColor(): Color3;

    /**
     * Get targeting priority for this parasite type
     * Returns array of target types in priority order
     */
    abstract getTargetPriority(): TargetType[];

    // ==================== Configurable Methods ====================
    // Subclasses can override these to customize behavior

    /**
     * Get number of body segments (rings)
     * Default: 4 (Energy Parasite)
     */
    protected getSegmentCount(): number {
        return 4;
    }

    /**
     * Get base spacing between segments
     * Default: 0.3 units
     */
    protected getSegmentSpacing(): number {
        return 0.3;
    }

    /**
     * Get base scale multiplier for segments
     * Default: 1.0 (normal size)
     */
    protected getBaseScale(): number {
        return 1.0;
    }

    /**
     * Get the size multiplier for a specific segment index
     * Default: Tapers from 1.0 at head to smaller at tail
     */
    protected getSegmentSizeMultiplier(index: number): number {
        return 1.0 - (index * 0.2);
    }

    /**
     * Get the wave animation speed multiplier
     * Default: 1.5
     */
    protected getWaveSpeed(): number {
        return 1.5;
    }

    // ==================== Shared Movement System ====================

    /**
     * Move towards a target position with directional facing
     * This is the core movement implementation shared by all parasites
     */
    protected moveTowards(target: Vector3, deltaTime: number): void {
        const direction = target.subtract(this.position).normalize();
        const movement = direction.scale(this.speed * deltaTime);

        // Track movement state
        this.isMoving = movement.length() > 0.01;

        // Calculate and apply facing angle
        if (this.isMoving) {
            this.facingAngle = Math.atan2(direction.x, direction.z);
            this.applyRotationToSegments(this.facingAngle);
        }

        this.position.addInPlace(movement);
    }

    /**
     * Apply rotation to all segments to face movement direction
     */
    protected applyRotationToSegments(angle: number): void {
        if (this.segments && this.segments.length > 0) {
            this.segments.forEach(segment => {
                segment.rotation.y = angle;
                segment.rotation.x = Math.PI / 2; // Keep ring orientation
            });
        }
    }

    // ==================== Shared Segment Animation ====================

    /**
     * Update segment positions with wave/contraction animation
     * This creates the worm-like movement effect shared by all parasites
     */
    protected updateSegmentAnimation(): void {
        if (!this.segments || this.segments.length === 0 || !this.parentNode) return;

        // Update parent node position
        this.parentNode.position = this.position.clone();

        const time = Date.now() * 0.002;
        const waveSpeed = this.getWaveSpeed();
        const baseSpacing = this.getSegmentSpacing();

        for (let i = 0; i < this.segments.length; i++) {
            if (i === 0) {
                // Head segment follows the main position (relative to parent at origin)
                this.segments[i].position = Vector3.Zero();
                this.segmentPositions[i] = this.position.clone();
            } else {
                // Body segments trail behind in the opposite direction of movement
                const prevSegmentPos = this.segmentPositions[i - 1];

                // Calculate trailing position based on current facing direction
                const currentRotation = this.segments[0].rotation.y;

                // Dynamic distance based on movement (inertia effect)
                const currentSpeed = this.speed;
                const maxSpeed = 3.0;
                const speedRatio = Math.min(currentSpeed / maxSpeed, 1.0);
                const inertiaMultiplier = 1.0 + (speedRatio * 0.5);

                // Add organic squeezing wave effect
                const segmentPhase = i * 0.8;
                const squeezeWave = Math.sin(time * waveSpeed + segmentPhase) * 0.15;
                const squeezeMultiplier = 1.0 + squeezeWave;

                const trailingDistance = baseSpacing * inertiaMultiplier * squeezeMultiplier;

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

    // ==================== Shared Patrol Behavior ====================

    /**
     * Update patrolling behavior - move between patrol points within territory
     */
    protected updatePatrolling(deltaTime: number): void {
        // Handle pause at patrol points
        if (this.isPatrolPaused) {
            this.patrolPauseTime -= deltaTime;
            if (this.patrolPauseTime <= 0) {
                this.isPatrolPaused = false;
                this.patrolTarget = this.generatePatrolTarget();
            }
            // Still animate while paused
            this.updateSegmentAnimation();
            return;
        }

        // Move towards patrol target
        this.moveTowards(this.patrolTarget, deltaTime);

        // Check if reached patrol target
        if (Vector3.Distance(this.position, this.patrolTarget) < 1.0) {
            this.isPatrolPaused = true;
            this.patrolPauseTime = this.patrolPauseDuration + Math.random() * 2;
        }

        // Update animation
        this.updateSegmentAnimation();
    }

    /**
     * Generate a random patrol target within territory
     * Subclasses can override for custom patrol patterns
     */
    protected generatePatrolTarget(): Vector3 {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * this.territoryRadius * 0.8;

        const offset = new Vector3(
            Math.cos(angle) * distance,
            0,
            Math.sin(angle) * distance
        );

        return this.territoryCenter.add(offset);
    }

    // ==================== Shared Mesh Creation ====================

    /**
     * Create the segmented worm mesh
     * Uses getColor(), getSegmentCount(), etc. from subclass
     */
    protected createMesh(): void {
        if (!this.scene) return;

        // Create parent node for click detection
        this.parentNode = new TransformNode(`parasite_${this.id}`, this.scene);
        this.parentNode.position = this.position.clone();

        // Create segments
        this.segments = [];
        this.segmentPositions = [];

        const segmentCount = this.getSegmentCount();
        const baseScale = this.getBaseScale();
        const baseSpacing = this.getSegmentSpacing();

        for (let i = 0; i < segmentCount; i++) {
            const sizeMultiplier = this.getSegmentSizeMultiplier(i);
            const ringDiameter = 0.8 * sizeMultiplier * baseScale;
            const ringThickness = 0.2 * sizeMultiplier * baseScale;

            const segment = MeshBuilder.CreateTorus(`parasite_segment_${this.id}_${i}`, {
                diameter: ringDiameter,
                thickness: ringThickness,
                tessellation: 8
            }, this.scene);

            segment.parent = this.parentNode;

            const segmentPos = new Vector3(0, 0, -i * baseSpacing * baseScale);
            segment.position = segmentPos;
            segment.rotation.x = Math.PI / 2;

            this.segments.push(segment);
            this.segmentPositions.push(this.position.clone().add(segmentPos));
        }

        // Apply material with parasite color
        this.applyMaterial();
    }

    /**
     * Apply material to all segments
     * Subclasses can override for custom material handling
     */
    protected applyMaterial(): void {
        if (this.materialManager) {
            this.material = this.materialManager.getParasiteMaterial();
            if (this.material) {
                this.segments.forEach(segment => {
                    segment.material = this.material;
                });
            }
        }
    }

    // ==================== Shared Terrain Following ====================

    /**
     * Set terrain generator for height detection
     */
    public setTerrainGenerator(terrainGenerator: any): void {
        this.terrainGenerator = terrainGenerator;
    }

    /**
     * Get terrain height at position
     */
    protected getTerrainHeight(x: number, z: number): number {
        if (this.terrainGenerator) {
            return this.terrainGenerator.getHeightAtPosition(x, z);
        }
        return 0.5;
    }

    /**
     * Update position to follow terrain height
     */
    protected updateTerrainHeight(): void {
        if (this.isMoving && this.terrainGenerator) {
            const terrainHeight = this.getTerrainHeight(this.position.x, this.position.z);
            const newY = terrainHeight + 1.0;

            if (Math.abs(this.position.y - newY) > 0.1) {
                this.position.y = newY;
            }
        } else if (!this.terrainGenerator) {
            this.position.y = 1.0;
        }
    }

    // ==================== Shared State Management ====================

    /**
     * Change parasite state
     */
    protected setState(newState: ParasiteState): void {
        if (this.state !== newState) {
            this.state = newState;
            this.lastStateChange = Date.now();
        }
    }

    // ==================== CombatTarget Interface ====================

    /**
     * Take damage from attacks
     * Returns true if parasite is destroyed
     */
    public takeDamage(damage: number): boolean {
        this.health -= damage;

        if (this.health <= 0) {
            return true; // Destroyed
        }

        return false; // Still alive
    }

    /**
     * Handle destruction
     */
    public onDestroyed(): void {
        // Base implementation - subclasses can override
    }

    // ==================== Visibility Management ====================

    /**
     * Hide the parasite
     */
    public hide(): void {
        if (this.parentNode) {
            this.parentNode.setEnabled(false);
        }
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
        if (this.parentNode) {
            this.parentNode.setEnabled(true);
        }
        for (const segment of this.segments) {
            if (segment) {
                segment.setEnabled(true);
            }
        }
    }

    // ==================== Respawn ====================

    /**
     * Respawn the parasite at a new position
     */
    public respawn(newPosition: Vector3): void {
        // Reset health
        this.health = this.maxHealth;

        // Update position
        this.position = newPosition.clone();
        this.territoryCenter = newPosition.clone();

        // Move parent node
        if (this.parentNode) {
            this.parentNode.position = newPosition.clone();
        }

        // Reset segment positions
        const baseSpacing = this.getSegmentSpacing();
        const baseScale = this.getBaseScale();
        for (let i = 0; i < this.segments.length; i++) {
            const segmentPos = new Vector3(0, 0, -i * baseSpacing * baseScale);
            this.segments[i].position = segmentPos;
            this.segmentPositions[i] = newPosition.clone().add(segmentPos);
        }

        // Show and reset state
        this.show();
        this.state = ParasiteState.PATROLLING;
        this.patrolTarget = this.generatePatrolTarget();
    }

    // ==================== Getters ====================

    public getId(): string { return this.id; }
    public getPosition(): Vector3 { return this.position.clone(); }
    public getState(): ParasiteState { return this.state; }
    public getHealth(): number { return this.health; }
    public getMaxHealth(): number { return this.maxHealth; }
    public getTerritoryCenter(): Vector3 { return this.territoryCenter.clone(); }
    public getTerritoryRadius(): number { return this.territoryRadius; }
    public isAlive(): boolean { return this.health > 0; }

    // ==================== Cleanup ====================

    /**
     * Dispose parasite and cleanup resources
     */
    public dispose(): void {
        // Dispose all segments
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
    }
}
