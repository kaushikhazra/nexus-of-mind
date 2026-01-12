/**
 * Hive - Above-ground structure that houses the Queen and makes it vulnerable
 *
 * Hives are the physical manifestation of Queen control, providing targetable
 * structures for player assault missions. They implement the CombatTarget
 * interface to be attackable by protectors and spawn defensive swarms when
 * constructed.
 */

import { Vector3 } from '@babylonjs/core';
import { CombatTarget } from '../CombatSystem';
import { Territory } from '../TerritoryManager';
import { Queen } from './Queen';

export interface HiveConfig {
    position: Vector3;
    territory: Territory;
    queen: Queen;
    health: number; // 20-30 hits
    constructionDuration: number; // 10-15 seconds
}

export interface HiveStats {
    id: string;
    position: Vector3;
    health: number;
    maxHealth: number;
    isConstructed: boolean;
    constructionProgress: number;
    constructionTimeRemaining: number;
    defensiveParasites: number;
    territoryId: string;
    queenId: string;
}

/**
 * Hive class - Implements CombatTarget for protector attacks
 */
export class Hive implements CombatTarget {
    // CombatTarget interface properties
    public readonly id: string;
    public position: Vector3;
    public health: number;
    public maxHealth: number;

    // Hive-specific properties
    private territory: Territory;
    private queen: Queen;
    
    // Construction tracking
    private isConstructed: boolean = false;
    private constructionStartTime: number = 0;
    private constructionDuration: number;
    private constructionProgress: number = 0.0; // 0.0 to 1.0
    private constructionElapsedTime: number = 0.0; // Track elapsed time in seconds
    
    // Defensive systems
    private defensiveParasites: string[] = [];
    private swarmSize: number; // 50+ parasites
    private swarmSpawned: boolean = false;
    
    // State management
    private isActive: boolean = true;
    private lastUpdateTime: number = 0;
    
    // Event callbacks
    private onDestroyedCallbacks: ((hive: Hive) => void)[] = [];
    private onConstructionCompleteCallbacks: ((hive: Hive) => void)[] = [];
    private onConstructionProgressCallbacks: ((hive: Hive, progress: number) => void)[] = [];

    constructor(config: HiveConfig) {
        // Generate unique Hive ID
        this.id = this.generateHiveId(config.territory.id, config.queen.id);
        
        // Set position
        this.position = config.position.clone();
        
        // Health configuration (20-30 hits as per requirements)
        this.maxHealth = Math.max(20, Math.min(30, config.health));
        this.health = this.maxHealth;
        
        // Territory and Queen references
        this.territory = config.territory;
        this.queen = config.queen;
        
        // Construction configuration (10-15 seconds as per requirements)
        this.constructionDuration = Math.max(10, Math.min(15, config.constructionDuration));
        
        // Defensive swarm size (50+ parasites as per requirements)
        this.swarmSize = 50 + Math.floor(Math.random() * 20); // 50-70 parasites
        
        console.log(`🏠 Hive ${this.id} created at ${this.position.x}, ${this.position.z} (${this.constructionDuration}s construction)`);
    }

    /**
     * Generate unique Hive ID
     */
    private generateHiveId(territoryId: string, queenId: string): string {
        return `hive_${territoryId}_${queenId}_${Date.now()}`;
    }

    /**
     * Start hive construction process
     */
    public startConstruction(): void {
        if (this.isConstructed) {
            console.warn(`🏠 Hive ${this.id} is already constructed`);
            return;
        }

        this.constructionStartTime = performance.now();
        this.constructionProgress = 0.0;
        this.constructionElapsedTime = 0.0;
        
        console.log(`🏠 Hive ${this.id} construction started (${this.constructionDuration}s)`);
    }

    /**
     * Update hive (called each frame)
     */
    public update(deltaTime: number): void {
        if (!this.isActive) {
            return;
        }

        const currentTime = performance.now();
        this.lastUpdateTime = currentTime;

        // Update construction if not completed
        if (!this.isConstructed && this.constructionStartTime > 0) {
            this.updateConstruction(deltaTime);
        }

        // Validate health
        if (this.health <= 0) {
            this.onDestroyed();
        }
    }

    /**
     * Update construction progress
     */
    private updateConstruction(deltaTime: number): void {
        // Add deltaTime to elapsed time
        this.constructionElapsedTime += deltaTime;
        
        // Update construction progress (0.0 to 1.0)
        this.constructionProgress = Math.min(1.0, this.constructionElapsedTime / this.constructionDuration);
        
        // Notify construction progress callbacks
        this.onConstructionProgressCallbacks.forEach(callback => callback(this, this.constructionProgress));
        
        // Check if construction is complete
        if (this.constructionProgress >= 1.0) {
            this.completeConstruction();
        }
    }

    /**
     * Complete hive construction
     */
    private completeConstruction(): void {
        if (this.isConstructed) {
            return; // Already completed
        }

        this.isConstructed = true;
        this.constructionProgress = 1.0;
        
        // Spawn defensive swarm (requirement 3.2)
        this.spawnDefensiveSwarm();
        
        // Make Queen vulnerable now that hive is constructed
        this.queen.setHive(this);
        
        console.log(`🏠 Hive ${this.id} construction completed! Spawned ${this.swarmSize} defensive parasites`);
        
        // Notify construction complete callbacks
        this.onConstructionCompleteCallbacks.forEach(callback => callback(this));
    }

    /**
     * Spawn defensive parasite swarm (50+ parasites)
     */
    private spawnDefensiveSwarm(): void {
        if (this.swarmSpawned) {
            return; // Already spawned
        }

        // Get ParasiteManager to spawn defensive parasites
        const gameEngine = require('../GameEngine').GameEngine.getInstance();
        const parasiteManager = gameEngine?.getParasiteManager();
        
        if (!parasiteManager) {
            console.warn(`🏠 Hive ${this.id} cannot spawn defensive swarm - ParasiteManager not found`);
            return;
        }

        // Spawn parasites in a circle around the hive
        const spawnRadius = 8; // 8 units around hive
        const parasitesPerRing = 10;
        const rings = Math.ceil(this.swarmSize / parasitesPerRing);
        
        let spawnedCount = 0;
        
        for (let ring = 0; ring < rings && spawnedCount < this.swarmSize; ring++) {
            const currentRadius = spawnRadius + (ring * 3); // Each ring 3 units further out
            const parasitesInRing = Math.min(parasitesPerRing, this.swarmSize - spawnedCount);
            
            for (let i = 0; i < parasitesInRing; i++) {
                const angle = (i / parasitesInRing) * Math.PI * 2;
                const spawnX = this.position.x + Math.cos(angle) * currentRadius;
                const spawnZ = this.position.z + Math.sin(angle) * currentRadius;
                
                // Get terrain height for spawn position
                let spawnY = this.position.y;
                const terrainGenerator = gameEngine?.getTerrainGenerator();
                if (terrainGenerator && terrainGenerator.getHeightAtPosition) {
                    spawnY = terrainGenerator.getHeightAtPosition(spawnX, spawnZ) + 0.5;
                }
                
                const spawnPosition = new Vector3(spawnX, spawnY, spawnZ);
                
                // Spawn parasite (mix of Energy and Combat types)
                const parasiteType = Math.random() < 0.5 ? 'energy' : 'combat';
                const parasite = this.spawnDefensiveParasite(spawnPosition, parasiteType);
                
                if (parasite) {
                    this.defensiveParasites.push(parasite.getId());
                    spawnedCount++;
                }
            }
        }
        
        this.swarmSpawned = true;
        console.log(`🏠 Hive ${this.id} spawned ${spawnedCount} defensive parasites`);
    }

    /**
     * Spawn a single defensive parasite
     */
    private spawnDefensiveParasite(position: Vector3, type: 'energy' | 'combat'): any {
        const gameEngine = require('../GameEngine').GameEngine.getInstance();
        const scene = gameEngine?.getScene();
        const materialManager = gameEngine?.getMaterialManager();
        
        if (!scene || !materialManager) {
            return null;
        }

        // Create parasite config
        const parasiteConfig = {
            position: position,
            scene: scene,
            materialManager: materialManager,
            homeDeposit: this.getClosestMineralDeposit() // Use closest deposit as home
        };

        // Create appropriate parasite type
        if (type === 'combat') {
            const { CombatParasite } = require('./CombatParasite');
            return new CombatParasite(parasiteConfig);
        } else {
            const { EnergyParasite } = require('./EnergyParasite');
            return new EnergyParasite(parasiteConfig);
        }
    }

    /**
     * Get closest mineral deposit for defensive parasites
     */
    private getClosestMineralDeposit(): any {
        const gameEngine = require('../GameEngine').GameEngine.getInstance();
        const mineralDeposits = gameEngine?.getMineralDeposits() || [];
        
        if (mineralDeposits.length === 0) {
            return null;
        }

        // Find closest deposit to hive
        let closestDeposit = mineralDeposits[0];
        let closestDistance = Vector3.Distance(this.position, closestDeposit.getPosition());
        
        for (const deposit of mineralDeposits) {
            const distance = Vector3.Distance(this.position, deposit.getPosition());
            if (distance < closestDistance) {
                closestDistance = distance;
                closestDeposit = deposit;
            }
        }
        
        return closestDeposit;
    }

    /**
     * Update defensive swarm behavior
     */
    private updateDefensiveSwarm(): void {
        // Remove dead parasites from defensive list
        const gameEngine = require('../GameEngine').GameEngine.getInstance();
        const parasiteManager = gameEngine?.getParasiteManager();
        
        if (!parasiteManager) {
            return;
        }

        // Filter out dead parasites
        this.defensiveParasites = this.defensiveParasites.filter(parasiteId => {
            const parasite = parasiteManager.getParasiteById(parasiteId);
            return parasite && parasite.isAlive();
        });
    }

    // CombatTarget interface implementation
    
    /**
     * Take damage from protector attacks
     * Returns true if Hive is destroyed
     */
    public takeDamage(amount: number): boolean {
        // Hive can only be damaged when construction is complete
        if (!this.isConstructed) {
            console.log(`🏠 Hive ${this.id} is still under construction and cannot be damaged`);
            return false;
        }

        // Apply damage
        this.health = Math.max(0, this.health - amount);
        
        console.log(`🏠 Hive ${this.id} took ${amount} damage (${this.health}/${this.maxHealth} remaining)`);
        
        // Check if destroyed
        if (this.health <= 0) {
            this.onDestroyed();
            return true;
        }
        
        return false;
    }

    /**
     * Handle Hive destruction
     */
    public onDestroyed(): void {
        if (!this.isActive) {
            return; // Already destroyed
        }

        console.log(`🏠 Hive ${this.id} has been destroyed!`);
        
        this.isActive = false;
        
        // Kill the Queen when hive is destroyed (requirement 3.6)
        if (this.queen && this.queen.isActiveQueen()) {
            console.log(`👑 Killing Queen ${this.queen.id} due to hive destruction`);
            this.queen.takeDamage(this.queen.maxHealth); // Deal lethal damage
        }
        
        // Clean up defensive parasites
        this.cleanupDefensiveParasites();
        
        // Update territory status
        this.territory.hive = null;
        
        // Notify destruction callbacks
        this.onDestroyedCallbacks.forEach(callback => callback(this));
    }

    /**
     * Clean up defensive parasites when hive is destroyed
     */
    private cleanupDefensiveParasites(): void {
        const gameEngine = require('../GameEngine').GameEngine.getInstance();
        const parasiteManager = gameEngine?.getParasiteManager();
        
        if (!parasiteManager) {
            return;
        }

        // Destroy all defensive parasites
        for (const parasiteId of this.defensiveParasites) {
            const parasite = parasiteManager.getParasiteById(parasiteId);
            if (parasite && parasite.isAlive()) {
                parasite.takeDamage(parasite.maxHealth); // Deal lethal damage
            }
        }
        
        this.defensiveParasites = [];
        console.log(`🏠 Hive ${this.id} defensive swarm eliminated`);
    }

    // Status and query methods

    /**
     * Check if hive construction is complete
     */
    public isHiveConstructed(): boolean {
        return this.isConstructed;
    }

    /**
     * Get construction progress (0.0 to 1.0)
     */
    public getConstructionProgress(): number {
        return this.constructionProgress;
    }

    /**
     * Get construction time remaining (seconds)
     */
    public getConstructionTimeRemaining(): number {
        if (this.isConstructed || this.constructionStartTime === 0) {
            return 0;
        }

        return Math.max(0, this.constructionDuration - this.constructionElapsedTime);
    }

    /**
     * Get hive position
     */
    public getPosition(): Vector3 {
        return this.position.clone();
    }

    /**
     * Get defensive parasites
     */
    public getDefensiveParasites(): string[] {
        return [...this.defensiveParasites];
    }

    /**
     * Get number of active defensive parasites
     */
    public getActiveDefensiveParasiteCount(): number {
        this.updateDefensiveSwarm(); // Clean up dead parasites first
        return this.defensiveParasites.length;
    }

    /**
     * Get territory
     */
    public getTerritory(): Territory {
        return this.territory;
    }

    /**
     * Get Queen
     */
    public getQueen(): Queen {
        return this.queen;
    }

    /**
     * Check if hive is active
     */
    public isActiveHive(): boolean {
        return this.isActive;
    }

    /**
     * Get comprehensive hive statistics
     */
    public getStats(): HiveStats {
        return {
            id: this.id,
            position: this.position.clone(),
            health: this.health,
            maxHealth: this.maxHealth,
            isConstructed: this.isConstructed,
            constructionProgress: this.constructionProgress,
            constructionTimeRemaining: this.getConstructionTimeRemaining(),
            defensiveParasites: this.getActiveDefensiveParasiteCount(),
            territoryId: this.territory.id,
            queenId: this.queen.id
        };
    }

    // Event subscription methods

    /**
     * Subscribe to hive destroyed events
     */
    public onHiveDestroyed(callback: (hive: Hive) => void): void {
        this.onDestroyedCallbacks.push(callback);
    }

    /**
     * Subscribe to construction complete events
     */
    public onConstructionComplete(callback: (hive: Hive) => void): void {
        this.onConstructionCompleteCallbacks.push(callback);
    }

    /**
     * Subscribe to construction progress events
     */
    public onConstructionProgress(callback: (hive: Hive, progress: number) => void): void {
        this.onConstructionProgressCallbacks.push(callback);
    }

    /**
     * Dispose hive and cleanup resources
     */
    public dispose(): void {
        this.isActive = false;
        
        // Clean up defensive parasites
        this.cleanupDefensiveParasites();
        
        // Clear all callbacks
        this.onDestroyedCallbacks = [];
        this.onConstructionCompleteCallbacks = [];
        this.onConstructionProgressCallbacks = [];
        
        console.log(`🏠 Hive ${this.id} disposed`);
    }
}