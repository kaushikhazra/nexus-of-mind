/**
 * Queen - Powerful entity that controls territories and spawns parasites
 *
 * Queens are the central antagonists of the territory system:
 * - Control all parasites within their territory
 * - Follow a structured lifecycle (underground growth → hive construction → active control)
 * - Patrol around their hive in the active phase
 * - Can be attacked by protectors during vulnerable phases
 *
 * Extends the base Parasite class with Queen-specific phases and spawning.
 */

import { Vector3, MeshBuilder, Mesh, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';
import { Parasite, ParasiteConfig, ParasiteState, TargetType } from './Parasite';
import { CombatTarget } from '../CombatSystem';
import { Territory } from '../TerritoryManager';
import { Hive } from './Hive';

export enum QueenPhase {
    UNDERGROUND_GROWTH = 'underground_growth',
    HIVE_CONSTRUCTION = 'hive_construction',
    ACTIVE_CONTROL = 'active_control'
}

export interface QueenConfig {
    territory: Territory;
    generation: number;
    growthDuration: number;
    health: number;
    position?: Vector3;
}

export interface QueenStats {
    id: string;
    generation: number;
    currentPhase: QueenPhase;
    health: number;
    maxHealth: number;
    growthProgress: number;
    timeInCurrentPhase: number;
    controlledParasites: number;
    territoryId: string;
    isVulnerable: boolean;
    position: Vector3;
}

/**
 * Queen class - Extends Parasite with phase-based lifecycle and spawning
 */
export class Queen extends Parasite {
    // Queen-specific properties
    private territory: Territory;
    private hive: Hive | null = null;
    private currentPhase: QueenPhase;
    private generation: number;

    // Growth phase tracking
    private growthStartTime: number = 0;
    private growthDuration: number;
    private growthProgress: number = 0.0;
    private phaseStartTime: number = 0;

    // Parasite control
    private controlledParasites: Set<string> = new Set();
    private maxControlledParasites: number = 100;

    // State management
    private isActive: boolean = true;
    private lastUpdateTime: number = 0;

    // Patrol behavior (Queen-specific)
    private hivePosition: Vector3 = new Vector3(0, 0, 0);
    private patrolMinRadius: number = 8;
    private moveSpeed: number = 5;

    // Event callbacks
    private onDestroyedCallbacks: ((queen: Queen) => void)[] = [];
    private onPhaseChangeCallbacks: ((queen: Queen, oldPhase: QueenPhase, newPhase: QueenPhase) => void)[] = [];
    private onGrowthProgressCallbacks: ((queen: Queen, progress: number) => void)[] = [];

    constructor(config: QueenConfig) {
        // Create base config for Parasite
        const gameEngine = require('../GameEngine').GameEngine.getInstance();
        const scene = gameEngine?.getScene();

        super({
            position: config.position ? config.position.clone() : config.territory.centerPosition.clone(),
            scene: scene
        });

        // Override ID for Queen
        this.id = this.generateQueenId(config.territory.id, config.generation);

        // Queen floats higher above terrain than other parasites
        this.roamHeight = 1.5;

        // Health configuration (40-100 hits)
        this.maxHealth = Math.max(40, Math.min(100, config.health));
        this.health = this.maxHealth;

        // Territory and generation
        this.territory = config.territory;
        this.generation = config.generation;

        // Growth configuration
        this.growthDuration = config.growthDuration;

        // Queen movement speed
        this.speed = this.moveSpeed;

        // Territory radius for Queen patrol
        this.territoryRadius = 20;

        // Initialize in underground growth phase
        this.currentPhase = QueenPhase.UNDERGROUND_GROWTH;
        this.phaseStartTime = performance.now();

        // Create visual mesh
        this.createQueenMesh();

        this.startGrowthPhase();
    }

    // ==================== Abstract Method Implementations ====================

    /**
     * Queens are purple/crimson colored
     */
    public getColor(): Color3 {
        return new Color3(0.6, 0.2, 0.8); // Purple
    }

    /**
     * Queens target workers and protectors
     */
    public getTargetPriority(): TargetType[] {
        return [TargetType.WORKER, TargetType.PROTECTOR];
    }

    // ==================== Segment Configuration ====================

    protected getSegmentCount(): number {
        return 12; // Larger than parasites
    }

    protected getSegmentSpacing(): number {
        return 0.5; // Wider spacing
    }

    protected getBaseScale(): number {
        return 1.5; // Larger overall
    }

    protected getSegmentSizeMultiplier(index: number): number {
        if (index < 3) {
            // First 3 rings are larger (head)
            return 1.3 - (index * 0.1);
        } else {
            // Remaining rings taper down
            return 1.0 - ((index - 3) * 0.08);
        }
    }

    protected getWaveSpeed(): number {
        return 1.2; // Slightly slower for larger body
    }

    // ==================== Queen Mesh Creation ====================

    /**
     * Create Queen mesh with 12 rings
     */
    private createQueenMesh(): void {
        if (!this.scene) {
            console.warn('👑 Queen: No scene available for mesh creation');
            return;
        }

        // Store hive position for patrolling
        this.hivePosition = this.position.clone();

        // Set initial patrol target
        this.patrolTarget = this.generatePatrolTarget();

        // Create parent node
        this.parentNode = new TransformNode(`queen_${this.id}`, this.scene);
        this.parentNode.position = this.position.clone();

        // Get terrain height
        const gameEngine = require('../GameEngine').GameEngine.getInstance();
        const terrainGenerator = gameEngine?.getTerrainGenerator();
        let terrainHeight = 10;
        if (terrainGenerator?.getHeightAtPosition) {
            terrainHeight = terrainGenerator.getHeightAtPosition(this.position.x, this.position.z);
        }
        this.parentNode.position.y = terrainHeight + this.roamHeight;

        // Create 12 ring segments
        this.segments = [];
        this.segmentPositions = [];
        const baseScale = this.getBaseScale();

        // Base colors - black and crimson
        const blackBase = { r: 0.1, g: 0.05, b: 0.05 };
        const crimsonBase = { r: 0.7, g: 0.0, b: 0.1 };

        for (let i = 0; i < 12; i++) {
            const sizeMultiplier = this.getSegmentSizeMultiplier(i);

            let zPosition: number;
            if (i < 3) {
                zPosition = -i * 0.5;
            } else {
                zPosition = -1.5 - ((i - 3) * 0.4);
            }

            const ringDiameter = 1.2 * sizeMultiplier * baseScale;
            const ringThickness = 0.3 * sizeMultiplier * baseScale;

            const segment = MeshBuilder.CreateTorus(`queen_segment_${this.id}_${i}`, {
                diameter: ringDiameter,
                thickness: ringThickness,
                tessellation: 12
            }, this.scene);

            segment.parent = this.parentNode;
            const segmentPos = new Vector3(0, 0, zPosition * baseScale);
            segment.position = segmentPos;
            segment.rotation.x = Math.PI / 2;

            // Alternating black and crimson materials
            const material = new StandardMaterial(`queen_mat_${this.id}_${i}`, this.scene);
            const baseColor = (i % 2 === 0) ? blackBase : crimsonBase;
            material.diffuseColor = new Color3(baseColor.r, baseColor.g, baseColor.b);
            material.emissiveColor = new Color3(baseColor.r * 0.3, baseColor.g * 0.3, baseColor.b * 0.3);
            segment.material = material;

            this.segments.push(segment);
            this.segmentPositions.push(this.position.clone().add(segmentPos));
        }

        // Queen mesh created silently
    }

    // ==================== Queen Patrol Behavior ====================

    /**
     * Override patrol target generation to patrol around hive position
     */
    protected generatePatrolTarget(): Vector3 {
        const angle = Math.random() * Math.PI * 2;
        const radius = this.patrolMinRadius + Math.random() * (this.territoryRadius - this.patrolMinRadius);

        return new Vector3(
            this.hivePosition.x + Math.cos(angle) * radius,
            this.hivePosition.y,
            this.hivePosition.z + Math.sin(angle) * radius
        );
    }

    // ==================== Update Loop ====================

    /**
     * Update Queen (called each frame)
     */
    public update(deltaTime: number): void {
        if (!this.isActive) return;

        this.lastUpdateTime = performance.now();
        this.isMoving = false;

        // Update current phase
        switch (this.currentPhase) {
            case QueenPhase.UNDERGROUND_GROWTH:
                this.updateGrowthPhase(deltaTime);
                break;
            case QueenPhase.HIVE_CONSTRUCTION:
                this.updateConstructionPhase(deltaTime);
                break;
            case QueenPhase.ACTIVE_CONTROL:
                this.updateControlPhase(deltaTime);
                break;
        }

        // Update roaming movement
        this.updateRoaming(deltaTime);

        // Validate health
        if (this.health <= 0) {
            this.onDestroyed();
        }
    }

    // ==================== Phase Management ====================

    private generateQueenId(territoryId: string, generation: number): string {
        return `queen_${territoryId}_gen${generation}_${Date.now()}`;
    }

    private startGrowthPhase(): void {
        this.currentPhase = QueenPhase.UNDERGROUND_GROWTH;
        this.phaseStartTime = performance.now();
        this.growthStartTime = performance.now();
        this.growthProgress = 0.0;

        if (this.growthDuration <= 0) {
            // Queen instant spawn - skipping growth phase
            this.growthProgress = 1.0;
            this.startHiveConstruction();
            return;
        }

        // Hide underground during growth phase
        this.position.y = -10;
        if (this.parentNode) {
            this.parentNode.position.y = -10;
        }
        // Queen started underground growth phase
    }

    private updateGrowthPhase(deltaTime: number): void {
        const elapsedTime = (performance.now() - this.growthStartTime) / 1000;
        this.growthProgress = Math.min(1.0, elapsedTime / this.growthDuration);

        this.onGrowthProgressCallbacks.forEach(cb => cb(this, this.growthProgress));

        if (this.growthProgress >= 1.0) {
            this.startHiveConstruction();
        }
    }

    private startHiveConstruction(): void {
        const oldPhase = this.currentPhase;
        this.currentPhase = QueenPhase.HIVE_CONSTRUCTION;
        this.phaseStartTime = performance.now();

        this.selectHiveLocation();
        // Queen started hive construction phase

        this.onPhaseChangeCallbacks.forEach(cb => cb(this, oldPhase, this.currentPhase));
    }

    private updateConstructionPhase(deltaTime: number): void {
        if (!this.hive) {
            this.createHive();
        }

        if (this.hive) {
            this.hive.update(deltaTime);
            if (this.hive.isHiveConstructed()) {
                this.startActiveControl();
            }
        } else {
            const elapsedTime = (performance.now() - this.phaseStartTime) / 1000;
            if (elapsedTime >= 12.5) {
                this.startActiveControl();
            }
        }
    }

    private startActiveControl(): void {
        const oldPhase = this.currentPhase;
        this.currentPhase = QueenPhase.ACTIVE_CONTROL;
        this.phaseStartTime = performance.now();

        // Get proper terrain height
        const gameEngine = require('../GameEngine').GameEngine.getInstance();
        const terrainGenerator = gameEngine?.getTerrainGenerator();
        let terrainHeight = 10;
        if (terrainGenerator?.getHeightAtPosition) {
            terrainHeight = terrainGenerator.getHeightAtPosition(this.position.x, this.position.z);
        }

        this.position.y = terrainHeight + this.roamHeight;

        // Sync parentNode position
        if (this.parentNode) {
            this.parentNode.position.x = this.position.x;
            this.parentNode.position.y = this.position.y;
            this.parentNode.position.z = this.position.z;
        }

        // Queen entered active control phase

        this.onPhaseChangeCallbacks.forEach(cb => cb(this, oldPhase, this.currentPhase));
    }

    private updateControlPhase(deltaTime: number): void {
        // Active control - Queen is vulnerable
    }

    private selectHiveLocation(): void {
        this.position = this.territory.centerPosition.clone();

        // Get proper terrain height
        const gameEngine = require('../GameEngine').GameEngine.getInstance();
        const terrainGenerator = gameEngine?.getTerrainGenerator();
        let terrainHeight = 10;
        if (terrainGenerator?.getHeightAtPosition) {
            terrainHeight = terrainGenerator.getHeightAtPosition(this.position.x, this.position.z);
        }

        this.position.y = terrainHeight + this.roamHeight;
        this.hivePosition = this.position.clone();

        // Sync parentNode position
        if (this.parentNode) {
            this.parentNode.position.x = this.position.x;
            this.parentNode.position.y = this.position.y;
            this.parentNode.position.z = this.position.z;
        }

        // Queen selected hive location
    }

    private createHive(): void {
        if (this.hive) return;

        const hiveConfig = {
            position: this.position.clone(),
            territory: this.territory,
            queen: this,
            health: 20 + Math.random() * 10,
            constructionDuration: 10 + Math.random() * 5
        };

        this.hive = new Hive(hiveConfig);
        this.hive.startConstruction();
        this.territory.hive = this.hive;

        // Queen created hive
    }

    // ==================== CombatTarget Interface ====================

    public takeDamage(amount: number): boolean {
        if (!this.isVulnerable()) {
            // Queen is invulnerable
            return false;
        }

        this.health = Math.max(0, this.health - amount);
        // Queen took damage

        if (this.health <= 0) {
            this.onDestroyed();
            return true;
        }
        return false;
    }

    public onDestroyed(): void {
        if (!this.isActive) return;

        console.log(`👑 Queen ${this.id} has been destroyed!`);
        this.isActive = false;

        this.explodeAllParasites();
        this.liberateTerritory();
        this.onDestroyedCallbacks.forEach(cb => cb(this));
        this.triggerRegeneration();
    }

    public async onDeath(): Promise<void> {
        this.onDestroyed();
    }

    private explodeAllParasites(): void {
        console.log(`💥 Exploding all ${this.controlledParasites.size} parasites in territory ${this.territory.id}`);
        this.controlledParasites.clear();
        this.territory.parasiteCount = 0;
    }

    private liberateTerritory(): void {
        this.territory.controlStatus = 'liberated';
        this.territory.queen = null;
        this.territory.hive = null;
        this.territory.parasiteCount = 0;

        console.log(`🏳️ Territory ${this.territory.id} liberation initiated`);

        if (this.hive) {
            this.hive.dispose();
            this.hive = null;
        }
    }

    private triggerRegeneration(): void {
        console.log(`🔄 Queen regeneration cycle triggered for territory ${this.territory.id}`);
    }

    // ==================== Parasite Control ====================

    public addControlledParasite(parasiteId: string): void {
        if (this.currentPhase !== QueenPhase.ACTIVE_CONTROL) return;
        if (this.controlledParasites.size >= this.maxControlledParasites) return;

        this.controlledParasites.add(parasiteId);
        this.territory.parasiteCount = this.controlledParasites.size;
    }

    public removeControlledParasite(parasiteId: string): void {
        this.controlledParasites.delete(parasiteId);
        this.territory.parasiteCount = this.controlledParasites.size;
    }

    public getControlledParasites(): string[] {
        return Array.from(this.controlledParasites);
    }

    public getControlledParasiteCount(): number {
        return this.controlledParasites.size;
    }

    // ==================== Status Methods ====================

    public isVulnerable(): boolean {
        return this.currentPhase === QueenPhase.ACTIVE_CONTROL && this.isActive;
    }

    public isStationary(): boolean {
        return true;
    }

    public getTerritory(): Territory {
        return this.territory;
    }

    public getHive(): Hive | null {
        return this.hive;
    }

    public setHive(hive: Hive): void {
        this.hive = hive;
    }

    public getCurrentPhase(): QueenPhase {
        return this.currentPhase;
    }

    public getGrowthProgress(): number {
        return this.growthProgress;
    }

    public getGrowthTimeRemaining(): number {
        if (this.currentPhase !== QueenPhase.UNDERGROUND_GROWTH) return 0;
        const elapsedTime = (performance.now() - this.growthStartTime) / 1000;
        return Math.max(0, this.growthDuration - elapsedTime);
    }

    public getGeneration(): number {
        return this.generation;
    }

    public getLiberationStatus(): { isLiberated: boolean, timeRemaining: number } {
        return {
            isLiberated: this.territory.controlStatus === 'liberated',
            timeRemaining: this.territory.liberationTimer
        };
    }

    public getStats(): QueenStats {
        const timeInCurrentPhase = (performance.now() - this.phaseStartTime) / 1000;

        return {
            id: this.id,
            generation: this.generation,
            currentPhase: this.currentPhase,
            health: this.health,
            maxHealth: this.maxHealth,
            growthProgress: this.growthProgress,
            timeInCurrentPhase,
            controlledParasites: this.controlledParasites.size,
            territoryId: this.territory.id,
            isVulnerable: this.isVulnerable(),
            position: this.position.clone()
        };
    }

    public isActiveQueen(): boolean {
        return this.isActive;
    }

    // ==================== Event Subscriptions ====================

    public onQueenDestroyed(callback: (queen: Queen) => void): void {
        this.onDestroyedCallbacks.push(callback);
    }

    public onPhaseChange(callback: (queen: Queen, oldPhase: QueenPhase, newPhase: QueenPhase) => void): void {
        this.onPhaseChangeCallbacks.push(callback);
    }

    public onGrowthProgress(callback: (queen: Queen, progress: number) => void): void {
        this.onGrowthProgressCallbacks.push(callback);
    }

    // ==================== Cleanup ====================

    public dispose(): void {
        this.isActive = false;
        this.controlledParasites.clear();

        if (this.hive) {
            this.hive.dispose();
            this.hive = null;
        }

        this.onDestroyedCallbacks = [];
        this.onPhaseChangeCallbacks = [];
        this.onGrowthProgressCallbacks = [];

        super.dispose();
    }
}
