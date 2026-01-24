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

    // Regeneration (native biology)
    protected regenRate: number = 0; // HP per second, subclasses override

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
    protected roamHeight: number = 1.0; // Height above terrain

    // Lifecycle
    protected spawnTime: number;

    // Cached vector for zero-allocation segment animation (Fix 21)
    protected cachedWorldOffset: Vector3 = new Vector3();

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

        // Initialize patrol target to territory center
        // Subclasses can override generatePatrolTarget() for custom patterns
        // The first updateRoaming() call will generate a proper patrol target
        this.patrolTarget = this.position.clone();

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

    // ==================== Shared Roaming System ====================

    /**
     * Smooth roaming behavior with terrain following
     * This is the core movement implementation shared by all parasites
     * Uses direct parentNode position updates for smooth movement
     */
    protected updateRoaming(deltaTime: number): void {
        if (!this.parentNode) return;

        // Handle patrol pause - still update terrain slope while paused
        if (this.isPatrolPaused) {
            this.patrolPauseTime -= deltaTime;
            if (this.patrolPauseTime <= 0) {
                this.isPatrolPaused = false;
                this.patrolTarget = this.generatePatrolTarget();
            }
            // Regenerate health while idle (native biology)
            this.updateRegeneration(deltaTime);
            // Update terrain slope even while paused
            this.updateTerrainSlope();
            this.updateSegmentAnimation();
            return;
        }

        // Calculate movement toward patrol target
        const currentX = this.parentNode.position.x;
        const currentZ = this.parentNode.position.z;
        const dx = this.patrolTarget.x - currentX;
        const dz = this.patrolTarget.z - currentZ;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Check if reached patrol target
        if (distance < 1.0) {
            this.isPatrolPaused = true;
            this.patrolPauseTime = this.patrolPauseDuration + Math.random() * 2;
            return;
        }

        // Move toward target with proper ratio (prevents overshooting)
        this.isMoving = true;
        const moveDistance = this.speed * deltaTime;
        const ratio = Math.min(moveDistance / distance, 1);

        const newX = currentX + dx * ratio;
        const newZ = currentZ + dz * ratio;

        // Get terrain height at new position
        const terrainHeight = this.getTerrainHeight(newX, newZ);

        // Update parentNode position directly (smooth, no sync issues)
        this.parentNode.position.x = newX;
        this.parentNode.position.z = newZ;
        this.parentNode.position.y = terrainHeight + this.roamHeight;

        // Rotate to face movement direction (only if significant change to prevent oscillation)
        const targetRotation = Math.atan2(dx, dz);
        const currentRotation = this.parentNode.rotation.y;
        let rotationDiff = targetRotation - currentRotation;
        
        // Normalize rotation difference to [-PI, PI]
        while (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
        while (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
        
        // Only update rotation if change is significant (prevents oscillation)
        if (Math.abs(rotationDiff) > 0.1) {
            this.parentNode.rotation.y = targetRotation;
        }

        // Sync logical position
        this.position.x = newX;
        this.position.z = newZ;
        this.position.y = terrainHeight + this.roamHeight;

        // Update terrain slope (pitch and roll)
        this.updateTerrainSlope();

        // Update segment animation
        this.updateSegmentAnimation();
    }

    /**
     * Regenerate health over time (native biology advantage)
     * Should be called during idle/patrol states, not during active combat
     */
    protected updateRegeneration(deltaTime: number): void {
        if (this.regenRate > 0 && this.health < this.maxHealth) {
            this.health = Math.min(
                this.maxHealth,
                this.health + this.regenRate * deltaTime
            );
        }
    }

    /**
     * Update rotation to follow terrain slope
     * Calculates pitch (forward/back tilt) and roll (left/right tilt)
     */
    protected updateTerrainSlope(): void {
        if (!this.parentNode) return;
        // getTerrainHeight() has fallback to GameEngine if terrainGenerator not set

        const x = this.parentNode.position.x;
        const z = this.parentNode.position.z;
        const sampleDistance = 2.0;
        const facingAngle = this.parentNode.rotation.y;

        // Calculate forward and right direction vectors
        const forwardX = Math.sin(facingAngle);
        const forwardZ = Math.cos(facingAngle);
        const rightX = Math.cos(facingAngle);
        const rightZ = -Math.sin(facingAngle);

        // Sample terrain heights
        const frontHeight = this.getTerrainHeight(x + forwardX * sampleDistance, z + forwardZ * sampleDistance);
        const backHeight = this.getTerrainHeight(x - forwardX * sampleDistance, z - forwardZ * sampleDistance);
        const rightHeight = this.getTerrainHeight(x + rightX * sampleDistance, z + rightZ * sampleDistance);
        const leftHeight = this.getTerrainHeight(x - rightX * sampleDistance, z - rightZ * sampleDistance);

        // Calculate pitch (forward/back tilt) and roll (left/right tilt)
        const pitchDiff = backHeight - frontHeight;
        const targetPitch = Math.atan2(pitchDiff, sampleDistance * 2);
        const rollDiff = leftHeight - rightHeight;
        const targetRoll = Math.atan2(rollDiff, sampleDistance * 2);

        // Smooth interpolation
        const smoothFactor = 0.1;
        this.parentNode.rotation.x = this.parentNode.rotation.x + (targetPitch - this.parentNode.rotation.x) * smoothFactor;
        this.parentNode.rotation.z = this.parentNode.rotation.z + (targetRoll - this.parentNode.rotation.z) * smoothFactor;

        // Clamp to prevent extreme tilting (±30 degrees)
        const maxTilt = Math.PI / 6;
        this.parentNode.rotation.x = Math.max(-maxTilt, Math.min(maxTilt, this.parentNode.rotation.x));
        this.parentNode.rotation.z = Math.max(-maxTilt, Math.min(maxTilt, this.parentNode.rotation.z));
    }

    /**
     * Move towards a target position (legacy method for hunting/returning states)
     * Subclasses can use this for non-patrol movement
     */
    protected moveTowards(target: Vector3, deltaTime: number): void {
        if (!this.parentNode) return;

        const currentX = this.parentNode.position.x;
        const currentZ = this.parentNode.position.z;
        const dx = target.x - currentX;
        const dz = target.z - currentZ;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < 0.1) return;

        this.isMoving = true;
        const moveDistance = this.speed * deltaTime;
        const ratio = Math.min(moveDistance / distance, 1);

        const newX = currentX + dx * ratio;
        const newZ = currentZ + dz * ratio;
        const terrainHeight = this.getTerrainHeight(newX, newZ);

        // Update parentNode position directly
        this.parentNode.position.x = newX;
        this.parentNode.position.z = newZ;
        this.parentNode.position.y = terrainHeight + this.roamHeight;
        // Rotate to face movement direction (only if significant change to prevent oscillation)
        const targetRotation = Math.atan2(dx, dz);
        const currentRotation = this.parentNode.rotation.y;
        let rotationDiff = targetRotation - currentRotation;
        
        // Normalize rotation difference to [-PI, PI]
        while (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
        while (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
        
        // Only update rotation if change is significant (prevents oscillation)
        if (Math.abs(rotationDiff) > 0.1) {
            this.parentNode.rotation.y = targetRotation;
        }

        // Sync logical position
        this.position.x = newX;
        this.position.z = newZ;
        this.position.y = terrainHeight + this.roamHeight;
    }

    // ==================== Shared Segment Animation ====================

    /**
     * Update segment positions with wave/contraction animation
     * This creates the worm-like movement effect shared by all parasites
     * Note: parentNode rotation handles facing direction, segments only need local positioning
     * Fix 21: Zero-allocation version - uses set()/copyFrom()/addToRef() instead of creating new Vector3
     */
    protected updateSegmentAnimation(): void {
        if (!this.segments || this.segments.length === 0 || !this.parentNode) return;

        const time = Date.now() * 0.002;
        const waveSpeed = this.getWaveSpeed();
        const baseSpacing = this.getSegmentSpacing();

        for (let i = 0; i < this.segments.length; i++) {
            if (i === 0) {
                // Head segment at origin (relative to parent)
                // Fix 21: Use set() instead of Vector3.Zero() to avoid allocation
                this.segments[i].position.set(0, 0, 0);
                // Only set X rotation for torus orientation - Y rotation inherited from parent
                this.segments[i].rotation.x = Math.PI / 2;
                this.segments[i].rotation.y = 0;
                // Fix 21: Use copyFrom() instead of clone() to avoid allocation
                this.segmentPositions[i].copyFrom(this.position);
            } else {
                // Body segments trail behind along local -Z axis (parent handles world rotation)

                // Dynamic distance based on movement (inertia effect)
                const maxSpeed = 3.0;
                const speedRatio = Math.min(this.speed / maxSpeed, 1.0);
                const inertiaMultiplier = 1.0 + (speedRatio * 0.5);

                // Add organic squeezing wave effect (scaled by segment count)
                // Fewer segments = more wiggle, Queen (12 rings) = base wiggle
                const segmentCount = this.getSegmentCount();
                const wiggleScale = Math.min(2.0, 12 / segmentCount); // Clamped 1x-2x
                const baseWiggle = 0.0375;
                const segmentPhase = i * 0.8;
                const squeezeWave = Math.sin(time * waveSpeed + segmentPhase) * baseWiggle * wiggleScale;
                const squeezeMultiplier = 1.0 + squeezeWave;

                const trailingDistance = baseSpacing * inertiaMultiplier * squeezeMultiplier;

                // Trail along local -Z axis (parentNode rotation handles world facing)
                // Fix 21: Use set() instead of new Vector3() to avoid allocation
                this.segments[i].position.set(0, 0, -i * trailingDistance);
                this.segments[i].rotation.x = Math.PI / 2;
                this.segments[i].rotation.y = 0;

                // Track world position for other systems
                // Fix 21: Use cached worldOffset and set() instead of new Vector3()
                const worldRotation = this.parentNode.rotation.y;
                this.cachedWorldOffset.set(
                    -Math.sin(worldRotation) * i * trailingDistance,
                    0,
                    -Math.cos(worldRotation) * i * trailingDistance
                );
                // Fix 21: Use addToRef() instead of add() to avoid allocation
                this.position.addToRef(this.cachedWorldOffset, this.segmentPositions[i]);
            }
        }
    }

    // ==================== Patrol Target Generation ====================

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
     * Falls back to GameEngine terrain generator if not directly set
     */
    protected getTerrainHeight(x: number, z: number): number {
        // Try direct terrain generator first
        if (this.terrainGenerator?.getHeightAtPosition) {
            return this.terrainGenerator.getHeightAtPosition(x, z);
        }

        // Fallback to GameEngine terrain generator
        try {
            const gameEngine = require('../GameEngine').GameEngine.getInstance();
            const terrainGen = gameEngine?.getTerrainGenerator();
            if (terrainGen?.getHeightAtPosition) {
                return terrainGen.getHeightAtPosition(x, z);
            }
        } catch (e) {
            // Ignore errors from GameEngine access
        }

        return 0.5; // Default height if no terrain available
    }

    /**
     * Update position to follow terrain height
     * Used by hunting/feeding states that don't call updateRoaming()
     */
    protected updateTerrainHeight(): void {
        const terrainHeight = this.getTerrainHeight(this.position.x, this.position.z);
        const newY = terrainHeight + this.roamHeight;

        this.position.y = newY;
        if (this.parentNode) {
            this.parentNode.position.y = newY;
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
    /** Returns position reference without cloning (Fix 22 - zero allocation) */
    public getPositionRef(): Vector3 { return this.position; }
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
