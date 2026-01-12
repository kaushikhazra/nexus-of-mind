/**
 * Queen - Powerful stationary entity that controls territories
 *
 * Queens are the central antagonists of the territory system, controlling
 * all parasites within their territory and following a structured lifecycle
 * from underground growth to active control. They implement the CombatTarget
 * interface to be attackable by protectors during their vulnerable phases.
 */

import { Vector3 } from '@babylonjs/core';
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
    generation: number; // For future AI learning
    growthDuration: number; // 60-120 seconds
    health: number; // 40-100 hits
    position?: Vector3; // Optional initial position
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
 * Queen class - Implements CombatTarget for protector attacks
 */
export class Queen implements CombatTarget {
    // CombatTarget interface properties
    public readonly id: string;
    public position: Vector3;
    public health: number;
    public maxHealth: number;

    // Queen-specific properties
    private territory: Territory;
    private hive: Hive | null = null;
    private currentPhase: QueenPhase;
    private generation: number;
    
    // Growth phase tracking
    private growthStartTime: number = 0;
    private growthDuration: number;
    private growthProgress: number = 0.0; // 0.0 to 1.0
    private phaseStartTime: number = 0;
    
    // Parasite control
    private controlledParasites: Set<string> = new Set();
    private maxControlledParasites: number = 100; // Reasonable limit for performance
    
    // State management
    private isActive: boolean = true;
    private lastUpdateTime: number = 0;
    
    // Event callbacks
    private onDestroyedCallbacks: ((queen: Queen) => void)[] = [];
    private onPhaseChangeCallbacks: ((queen: Queen, oldPhase: QueenPhase, newPhase: QueenPhase) => void)[] = [];
    private onGrowthProgressCallbacks: ((queen: Queen, progress: number) => void)[] = [];

    constructor(config: QueenConfig) {
        // Generate unique Queen ID
        this.id = this.generateQueenId(config.territory.id, config.generation);
        
        // Set position - default to territory center if not provided
        this.position = config.position ? config.position.clone() : config.territory.centerPosition.clone();
        
        // Health configuration (40-100 hits as per requirements)
        this.maxHealth = Math.max(40, Math.min(100, config.health));
        this.health = this.maxHealth;
        
        // Territory and generation
        this.territory = config.territory;
        this.generation = config.generation;
        
        // Growth configuration (60-120 seconds as per requirements)
        this.growthDuration = Math.max(60, Math.min(120, config.growthDuration));
        
        // Initialize in underground growth phase
        this.currentPhase = QueenPhase.UNDERGROUND_GROWTH;
        this.phaseStartTime = performance.now();
        this.startGrowthPhase();
    }

    /**
     * Generate unique Queen ID
     */
    private generateQueenId(territoryId: string, generation: number): string {
        return `queen_${territoryId}_gen${generation}_${Date.now()}`;
    }

    /**
     * Update Queen (called each frame)
     */
    public update(deltaTime: number): void {
        if (!this.isActive) {
            return;
        }

        const currentTime = performance.now();
        this.lastUpdateTime = currentTime;

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

        // Validate health
        if (this.health <= 0) {
            this.onDestroyed();
        }
    }

    /**
     * Start underground growth phase
     */
    private startGrowthPhase(): void {
        this.currentPhase = QueenPhase.UNDERGROUND_GROWTH;
        this.phaseStartTime = performance.now();
        this.growthStartTime = performance.now();
        this.growthProgress = 0.0;
        
        // Queen is invisible and invulnerable during growth
        this.position.y = -10; // Underground position
        
        console.log(`👑 Queen ${this.id} started underground growth phase (${this.growthDuration}s)`);
    }

    /**
     * Update underground growth phase
     */
    private updateGrowthPhase(deltaTime: number): void {
        const currentTime = performance.now();
        const elapsedTime = (currentTime - this.growthStartTime) / 1000; // Convert to seconds
        
        // Update growth progress (0.0 to 1.0)
        this.growthProgress = Math.min(1.0, elapsedTime / this.growthDuration);
        
        // Notify growth progress callbacks
        this.onGrowthProgressCallbacks.forEach(callback => callback(this, this.growthProgress));
        
        // Check if growth is complete
        if (this.growthProgress >= 1.0) {
            this.startHiveConstruction();
        }
    }

    /**
     * Start hive construction phase
     */
    private startHiveConstruction(): void {
        const oldPhase = this.currentPhase;
        this.currentPhase = QueenPhase.HIVE_CONSTRUCTION;
        this.phaseStartTime = performance.now();
        
        // Select random hive location within territory
        this.selectHiveLocation();
        
        // Queen is still invulnerable during construction
        console.log(`👑 Queen ${this.id} started hive construction phase`);
        
        // Notify phase change
        this.onPhaseChangeCallbacks.forEach(callback => callback(this, oldPhase, this.currentPhase));
    }

    /**
     * Update hive construction phase
     */
    private updateConstructionPhase(deltaTime: number): void {
        // If we don't have a hive yet, create one
        if (!this.hive) {
            this.createHive();
        }

        // Update hive construction
        if (this.hive) {
            this.hive.update(deltaTime);
            
            // Check if hive construction is complete
            if (this.hive.isHiveConstructed()) {
                this.startActiveControl();
            }
        } else {
            // Fallback: simulate construction time if hive creation failed
            const currentTime = performance.now();
            const elapsedTime = (currentTime - this.phaseStartTime) / 1000;
            const constructionDuration = 12.5; // Average of 10-15 seconds
            
            if (elapsedTime >= constructionDuration) {
                this.startActiveControl();
            }
        }
    }

    /**
     * Start active control phase
     */
    private startActiveControl(): void {
        const oldPhase = this.currentPhase;
        this.currentPhase = QueenPhase.ACTIVE_CONTROL;
        this.phaseStartTime = performance.now();
        
        // Queen becomes vulnerable and visible
        this.position.y = 2.0; // Above ground position
        
        console.log(`👑 Queen ${this.id} entered active control phase - now vulnerable!`);
        
        // Notify phase change
        this.onPhaseChangeCallbacks.forEach(callback => callback(this, oldPhase, this.currentPhase));
    }

    /**
     * Update active control phase
     */
    private updateControlPhase(deltaTime: number): void {
        // Active control phase - Queen manages parasites and defends territory
        // This is where the Queen is vulnerable to attack
        
        // TODO: Implement parasite management logic
        // TODO: Implement defensive behaviors
        // TODO: Integrate with ParasiteManager for territorial control
    }

    /**
     * Select random hive location within territory boundaries (requirement 4.6)
     */
    private selectHiveLocation(): void {
        const bounds = this.territory.chunkBounds;
        const margin = 50; // Stay away from territory edges
        
        // Ensure we have valid bounds for random selection
        const availableWidth = bounds.maxX - bounds.minX - 2 * margin;
        const availableHeight = bounds.maxZ - bounds.minZ - 2 * margin;
        
        if (availableWidth <= 0 || availableHeight <= 0) {
            console.warn(`Territory ${this.territory.id} too small for hive placement, using center`);
            this.position = this.territory.centerPosition.clone();
            return;
        }
        
        // Random position within territory bounds with margin (requirement 4.6)
        const randomX = bounds.minX + margin + Math.random() * availableWidth;
        const randomZ = bounds.minZ + margin + Math.random() * availableHeight;
        
        // Set position (Y will be set when hive construction completes)
        this.position.x = randomX;
        this.position.z = randomZ;
        this.position.y = 0; // Ground level during construction
        
        console.log(`👑 Queen ${this.id} selected hive location at (${Math.round(randomX)}, ${Math.round(randomZ)})`);
    }

    /**
     * Create hive at selected location
     */
    private createHive(): void {
        if (this.hive) {
            return; // Already have a hive
        }

        // Create hive configuration
        const hiveConfig = {
            position: this.position.clone(),
            territory: this.territory,
            queen: this,
            health: 20 + Math.random() * 10, // 20-30 hits as per requirements
            constructionDuration: 10 + Math.random() * 5 // 10-15 seconds as per requirements
        };

        // Create hive instance
        this.hive = new Hive(hiveConfig);
        
        // Start hive construction
        this.hive.startConstruction();
        
        // Update territory reference
        this.territory.hive = this.hive;
        
        console.log(`👑 Queen ${this.id} created hive at ${this.position.x}, ${this.position.z}`);
    }

    // CombatTarget interface implementation
    
    /**
     * Take damage from protector attacks
     * Returns true if Queen is destroyed
     */
    public takeDamage(amount: number): boolean {
        // Queen is only vulnerable during active control phase
        if (!this.isVulnerable()) {
            console.log(`👑 Queen ${this.id} is invulnerable in ${this.currentPhase} phase`);
            return false;
        }

        // Apply damage
        this.health = Math.max(0, this.health - amount);
        
        console.log(`👑 Queen ${this.id} took ${amount} damage (${this.health}/${this.maxHealth} remaining)`);
        
        // Check if destroyed
        if (this.health <= 0) {
            this.onDestroyed();
            return true;
        }
        
        return false;
    }

    /**
     * Handle Queen destruction
     */
    public onDestroyed(): void {
        if (!this.isActive) {
            return; // Already destroyed
        }

        console.log(`👑 Queen ${this.id} has been destroyed!`);
        
        this.isActive = false;
        
        // Trigger territory-wide parasite explosion (as per requirements 2.6, 4.1)
        this.explodeAllParasites();
        
        // Liberate territory (requirements 4.1, 4.2)
        this.liberateTerritory();
        
        // Notify destruction callbacks
        this.onDestroyedCallbacks.forEach(callback => callback(this));
        
        // Trigger Queen regeneration cycle (requirement 4.3)
        this.triggerRegeneration();
    }

    /**
     * Explode all parasites in territory (requirement 2.6, 4.1)
     */
    private explodeAllParasites(): void {
        // TODO: Integrate with ParasiteManager to destroy all parasites in territory
        console.log(`💥 Exploding all ${this.controlledParasites.size} parasites in territory ${this.territory.id}`);
        
        // Clear controlled parasites immediately (requirement 4.1)
        this.controlledParasites.clear();
        
        // Update territory parasite count
        this.territory.parasiteCount = 0;
    }

    /**
     * Liberate territory after Queen death (requirements 4.1, 4.2)
     */
    private liberateTerritory(): void {
        // Update territory status to liberated (requirement 4.2)
        this.territory.controlStatus = 'liberated';
        this.territory.queen = null;
        this.territory.hive = null;
        this.territory.parasiteCount = 0;
        
        // The TerritoryManager will handle the actual liberation through LiberationManager
        // This ensures proper energy rewards and timer management
        console.log(`🏳️ Territory ${this.territory.id} liberation initiated by Queen ${this.id} death`);
        
        // Dispose hive if it exists
        if (this.hive) {
            this.hive.dispose();
            this.hive = null;
        }
    }

    /**
     * Trigger Queen regeneration cycle (requirement 4.3)
     */
    private triggerRegeneration(): void {
        // The TerritoryManager will handle spawning a new Queen when the liberation period ends
        // This ensures the regeneration cycle: Death -> Liberation (3-5 min) -> New Queen Growth
        console.log(`🔄 Queen regeneration cycle triggered for territory ${this.territory.id}`);
        
        // Energy rewards are now handled by LiberationManager through TerritoryManager
        // The new Queen will be created by TerritoryManager.update() when liberationTimer reaches 0
        // New Queen will start in UNDERGROUND_GROWTH phase with random 60-120 second duration
    }

    /**
     * Get liberation status for territory (requirement 4.2)
     */
    public getLiberationStatus(): { isLiberated: boolean, timeRemaining: number } {
        return {
            isLiberated: this.territory.controlStatus === 'liberated',
            timeRemaining: this.territory.liberationTimer
        };
    }

    // Parasite control methods

    /**
     * Add a parasite to Queen's control
     */
    public addControlledParasite(parasiteId: string): void {
        if (this.currentPhase !== QueenPhase.ACTIVE_CONTROL) {
            return; // Can only control parasites during active phase
        }

        if (this.controlledParasites.size >= this.maxControlledParasites) {
            console.warn(`👑 Queen ${this.id} at maximum parasite control limit (${this.maxControlledParasites})`);
            return;
        }

        this.controlledParasites.add(parasiteId);
        this.territory.parasiteCount = this.controlledParasites.size;
    }

    /**
     * Remove a parasite from Queen's control
     */
    public removeControlledParasite(parasiteId: string): void {
        this.controlledParasites.delete(parasiteId);
        this.territory.parasiteCount = this.controlledParasites.size;
    }

    /**
     * Get all controlled parasite IDs
     */
    public getControlledParasites(): string[] {
        return Array.from(this.controlledParasites);
    }

    /**
     * Get number of controlled parasites
     */
    public getControlledParasiteCount(): number {
        return this.controlledParasites.size;
    }

    // Status and query methods

    /**
     * Check if Queen is vulnerable to attack (requirement 2.4)
     */
    public isVulnerable(): boolean {
        return this.currentPhase === QueenPhase.ACTIVE_CONTROL && this.isActive;
    }

    /**
     * Check if Queen remains stationary (requirement 2.2)
     */
    public isStationary(): boolean {
        return true; // Queens never move from their hive location
    }

    /**
     * Get Queen's territory
     */
    public getTerritory(): Territory {
        return this.territory;
    }

    /**
     * Get Queen's hive
     */
    public getHive(): Hive | null {
        return this.hive;
    }

    /**
     * Set Queen's hive reference
     */
    public setHive(hive: Hive): void {
        this.hive = hive;
    }

    /**
     * Get current phase
     */
    public getCurrentPhase(): QueenPhase {
        return this.currentPhase;
    }

    /**
     * Get growth progress (0.0 to 1.0)
     */
    public getGrowthProgress(): number {
        return this.growthProgress;
    }

    /**
     * Get time remaining in growth phase (seconds)
     */
    public getGrowthTimeRemaining(): number {
        if (this.currentPhase !== QueenPhase.UNDERGROUND_GROWTH) {
            return 0;
        }

        const elapsedTime = (performance.now() - this.growthStartTime) / 1000;
        return Math.max(0, this.growthDuration - elapsedTime);
    }

    /**
     * Get generation number
     */
    public getGeneration(): number {
        return this.generation;
    }

    /**
     * Get comprehensive Queen statistics
     */
    public getStats(): QueenStats {
        const currentTime = performance.now();
        const timeInCurrentPhase = (currentTime - this.phaseStartTime) / 1000;

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

    /**
     * Check if Queen is active
     */
    public isActiveQueen(): boolean {
        return this.isActive;
    }

    // Event subscription methods

    /**
     * Subscribe to Queen destroyed events
     */
    public onQueenDestroyed(callback: (queen: Queen) => void): void {
        this.onDestroyedCallbacks.push(callback);
    }

    /**
     * Subscribe to phase change events
     */
    public onPhaseChange(callback: (queen: Queen, oldPhase: QueenPhase, newPhase: QueenPhase) => void): void {
        this.onPhaseChangeCallbacks.push(callback);
    }

    /**
     * Subscribe to growth progress events
     */
    public onGrowthProgress(callback: (queen: Queen, progress: number) => void): void {
        this.onGrowthProgressCallbacks.push(callback);
    }

    /**
     * Dispose Queen and cleanup resources
     */
    public dispose(): void {
        this.isActive = false;
        this.controlledParasites.clear();
        
        // Dispose hive if it exists
        if (this.hive) {
            this.hive.dispose();
            this.hive = null;
        }
        
        // Clear all callbacks
        this.onDestroyedCallbacks = [];
        this.onPhaseChangeCallbacks = [];
        this.onGrowthProgressCallbacks = [];
    }
}