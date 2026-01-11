/**
 * ParasiteManager - Manages energy parasite spawning and lifecycle
 * 
 * Phase 1 Implementation:
 * - Spawns parasites near mineral deposits
 * - Manages parasite lifecycle and cleanup
 * - Handles combat interactions with protectors
 * - Integrates with existing game systems
 */

import { Scene, Vector3 } from '@babylonjs/core';
import { EnergyParasite, EnergyParasiteConfig } from './entities/EnergyParasite';
import { MineralDeposit } from '../world/MineralDeposit';
import { MaterialManager } from '../rendering/MaterialManager';
import { Worker } from './entities/Worker';
import { Protector } from './entities/Protector';

export interface ParasiteManagerConfig {
    scene: Scene;
    materialManager: MaterialManager;
    terrainGenerator?: any; // Optional terrain generator for height detection
}

export interface ParasiteSpawnConfig {
    baseSpawnInterval: number;    // Base time between spawns (ms)
    maxParasitesPerDeposit: number; // Max parasites per mineral deposit
    spawnRadius: number;          // How close to deposit to spawn
    activeMiningMultiplier: number; // Spawn rate multiplier when workers present
}

// Pending respawn tracking
interface PendingRespawn {
    parasiteId: string;
    deathTime: number;
    respawnPosition: Vector3;
}

export class ParasiteManager {
    private scene: Scene;
    private materialManager: MaterialManager;
    private terrainGenerator: any = null;
    private parasites: Map<string, EnergyParasite> = new Map();

    // Respawn configuration
    private readonly RESPAWN_DELAY = 30000; // 30 seconds delay before respawn
    private readonly RESPAWN_DISTANCE = 15; // 15 meters away from death point
    private pendingRespawns: PendingRespawn[] = [];

    // Spawning configuration
    private spawnConfig: ParasiteSpawnConfig = {
        baseSpawnInterval: 0,        // Immediate spawn - no delay!
        maxParasitesPerDeposit: 1,   // Max 1 parasite per deposit
        spawnRadius: 65,             // Spawn 65 units from deposit (outside 50-unit detection range)
        activeMiningMultiplier: 1.5  // Only slightly faster when workers mining
    };

    // Spawn tracking
    private lastSpawnAttempt: Map<string, number> = new Map(); // depositId -> timestamp
    private depositParasiteCount: Map<string, number> = new Map(); // depositId -> count
    
    constructor(config: ParasiteManagerConfig) {
        this.scene = config.scene;
        this.materialManager = config.materialManager;
        this.terrainGenerator = config.terrainGenerator || null;
        
        // ParasiteManager initialized
    }
    
    /**
     * Update terrain generator for existing parasites
     */
    public setTerrainGenerator(terrainGenerator: any): void {
        this.terrainGenerator = terrainGenerator;
        
        // Update existing parasites
        for (const parasite of this.parasites.values()) {
            parasite.setTerrainGenerator(terrainGenerator);
        }
        
        // ParasiteManager terrain generator updated
    }
    
    /**
     * Update all parasites and handle spawning
     */
    public update(deltaTime: number, mineralDeposits: MineralDeposit[], workers: Worker[], protectors: Protector[]): void {
        const currentTime = Date.now();

        // Update existing parasites
        this.updateParasites(deltaTime, workers);

        // Handle spawning for each mineral deposit
        for (const deposit of mineralDeposits) {
            if (deposit.isVisible() && !deposit.isDepleted()) {
                this.updateSpawning(deposit, workers, currentTime);
            }
        }

        // Process pending respawns
        this.processPendingRespawns(currentTime);

        // Clean up dead parasites (adds them to pending respawn queue)
        this.cleanupDeadParasites();
    }

    /**
     * Process pending respawns after delay has passed
     */
    private processPendingRespawns(currentTime: number): void {
        const readyToRespawn: PendingRespawn[] = [];
        const stillPending: PendingRespawn[] = [];

        for (const pending of this.pendingRespawns) {
            if (currentTime - pending.deathTime >= this.RESPAWN_DELAY) {
                readyToRespawn.push(pending);
            } else {
                stillPending.push(pending);
            }
        }

        // Update pending list
        this.pendingRespawns = stillPending;

        // Process respawns
        for (const pending of readyToRespawn) {
            const parasite = this.parasites.get(pending.parasiteId);
            if (parasite) {
                parasite.respawn(pending.respawnPosition);
            }
        }
    }
    
    /**
     * Update all existing parasites
     */
    private updateParasites(deltaTime: number, workers: Worker[]): void {
        for (const parasite of this.parasites.values()) {
            if (parasite.isAlive()) {
                // Get workers near this parasite's territory
                const nearbyWorkers = workers.filter(worker => {
                    const distance = Vector3.Distance(worker.getPosition(), parasite.getTerritoryCenter());
                    return distance <= parasite.getTerritoryRadius() * 1.5; // Slightly larger detection range
                });
                
                parasite.update(deltaTime, nearbyWorkers);
            }
        }
    }
    
    /**
     * Handle parasite spawning for a mineral deposit
     */
    private updateSpawning(deposit: MineralDeposit, workers: Worker[], currentTime: number): void {
        const depositId = deposit.getId();
        
        // Check if we've reached max parasites for this deposit
        const currentCount = this.depositParasiteCount.get(depositId) || 0;
        if (currentCount >= this.spawnConfig.maxParasitesPerDeposit) {
            return;
        }
        
        // Check if enough time has passed since last spawn attempt
        let lastSpawn = this.lastSpawnAttempt.get(depositId);
        if (lastSpawn === undefined) {
            // First time seeing this deposit - randomly decide if this deposit can spawn parasites
            const canSpawnParasites = Math.random() < 0.375; // 37.5% chance (50% more parasites)
            
            if (!canSpawnParasites) {
                // Mark this deposit as non-spawning by setting a very high timestamp
                this.lastSpawnAttempt.set(depositId, Number.MAX_SAFE_INTEGER);
                return;
            }
            
            // This deposit can spawn parasites - set initial delay to prevent immediate spawning
            this.lastSpawnAttempt.set(depositId, currentTime);
            return; // Skip spawning this frame
        }
        
        // Skip deposits marked as non-spawning
        if (lastSpawn === Number.MAX_SAFE_INTEGER) {
            return;
        }
        
        // Calculate spawn interval based on activity
        const workersNearDeposit = workers.filter(worker => {
            const distance = Vector3.Distance(worker.getPosition(), deposit.getPosition());
            return distance <= 20; // Workers within 20 units
        });
        
        const hasActiveMiners = workersNearDeposit.length > 0;
        const spawnInterval = hasActiveMiners 
            ? this.spawnConfig.baseSpawnInterval / this.spawnConfig.activeMiningMultiplier
            : this.spawnConfig.baseSpawnInterval;
        
        if (currentTime - lastSpawn < spawnInterval) {
            return;
        }
        
        // Attempt to spawn parasite
        this.spawnParasite(deposit);
        this.lastSpawnAttempt.set(depositId, currentTime);
    }
    
    /**
     * Spawn a new parasite near a mineral deposit
     */
    private spawnParasite(deposit: MineralDeposit): void {
        const depositPosition = deposit.getPosition();
        
        // Generate random spawn position near deposit
        const angle = Math.random() * Math.PI * 2;
        const distance = 5 + Math.random() * (this.spawnConfig.spawnRadius - 5); // 5-15 units from deposit
        
        const spawnOffset = new Vector3(
            Math.cos(angle) * distance,
            0.5, // Slightly above ground
            Math.sin(angle) * distance
        );
        
        const spawnPosition = depositPosition.add(spawnOffset);
        
        // Create parasite
        const parasiteConfig: EnergyParasiteConfig = {
            position: spawnPosition,
            scene: this.scene,
            materialManager: this.materialManager,
            homeDeposit: deposit
        };
        
        const parasite = new EnergyParasite(parasiteConfig);
        
        // Set terrain generator with fallback
        if (this.terrainGenerator) {
            parasite.setTerrainGenerator(this.terrainGenerator);
        } else {
        }
        
        this.parasites.set(parasite.getId(), parasite);
        
        // Update tracking
        const depositId = deposit.getId();
        const currentCount = this.depositParasiteCount.get(depositId) || 0;
        this.depositParasiteCount.set(depositId, currentCount + 1);
        
        // Parasite spawned silently
    }
    
    /**
     * Handle protector attacking a parasite (DEPRECATED - use CombatSystem instead)
     * This method is kept for backward compatibility but should not be used
     * with the new CombatSystem integration.
     */
    public handleProtectorAttack(protector: Protector, targetPosition: Vector3): boolean {
        // Deprecated: Use CombatSystem.initiateAttack instead
        
        // Find parasite at target position
        const targetParasite = this.findParasiteAt(targetPosition, 2.0); // 2 unit tolerance
        
        if (!targetParasite) {
            return false; // No parasite found
        }
        
        // Delegate to CombatSystem for proper handling
        const gameEngine = require('./GameEngine').GameEngine.getInstance();
        const combatSystem = gameEngine?.getCombatSystem();
        
        if (combatSystem) {
            return combatSystem.initiateAttack(protector, targetParasite);
        }
        
        // Fallback to old behavior if CombatSystem not available
        // Check if protector is in range
        const distance = Vector3.Distance(protector.getPosition(), targetParasite.getPosition());
        if (distance > 15) { // 15 unit attack range
            return false;
        }
        
        // Check if protector has enough energy
        const attackCost = 5; // 5 energy per attack
        if (!protector.getEnergyStorage().hasEnergy(attackCost)) {
            return false;
        }
        
        // Consume energy and attack
        protector.getEnergyStorage().removeEnergy(attackCost, 'parasite_attack');
        const parasiteDestroyed = targetParasite.takeDamage(1); // 1 damage per attack
        
        if (parasiteDestroyed) {
            // Award energy for successful kill
            const killReward = 2; // 2 energy reward
            protector.getEnergyStorage().addEnergy(killReward, 'parasite_kill_reward');
            
            // Update tracking
            const depositId = targetParasite.getHomeDeposit().getId();
            const currentCount = this.depositParasiteCount.get(depositId) || 0;
            this.depositParasiteCount.set(depositId, Math.max(0, currentCount - 1));
            
            // Parasite destroyed silently
        }
        
        return true; // Attack successful
    }
    
    /**
     * Handle parasite destruction (called by CombatSystem)
     * Instead of destroying, respawn the parasite 15m away from death point
     */
    public handleParasiteDestruction(parasiteId: string): void {
        const parasite = this.parasites.get(parasiteId);
        if (!parasite) {
            return; // Parasite not found
        }

        // Check if already pending respawn
        if (this.pendingRespawns.some(p => p.parasiteId === parasiteId)) {
            return; // Already queued for respawn
        }

        // Calculate respawn position 15m away in a random direction
        const deathPosition = parasite.getPosition();
        const randomAngle = Math.random() * Math.PI * 2;

        const respawnX = deathPosition.x + Math.cos(randomAngle) * this.RESPAWN_DISTANCE;
        const respawnZ = deathPosition.z + Math.sin(randomAngle) * this.RESPAWN_DISTANCE;

        // Get terrain height at respawn position
        let respawnY = 0.5;
        if (this.terrainGenerator && this.terrainGenerator.getHeightAtPosition) {
            respawnY = this.terrainGenerator.getHeightAtPosition(respawnX, respawnZ) + 0.5;
        }

        const respawnPosition = new Vector3(respawnX, respawnY, respawnZ);

        // Hide the parasite while waiting to respawn
        parasite.hide();

        // Add to pending respawn queue
        this.pendingRespawns.push({
            parasiteId,
            deathTime: Date.now(),
            respawnPosition
        });

    }

    /**
     * Find parasite at a specific position
     */
    private findParasiteAt(position: Vector3, tolerance: number): EnergyParasite | null {
        for (const parasite of this.parasites.values()) {
            if (parasite.isAlive()) {
                const distance = Vector3.Distance(parasite.getPosition(), position);
                if (distance <= tolerance) {
                    return parasite;
                }
            }
        }
        return null;
    }
    
    /**
     * Clean up dead parasites - respawn them 15m away instead of removing
     */
    private cleanupDeadParasites(): void {
        for (const [id, parasite] of this.parasites.entries()) {
            if (!parasite.isAlive()) {
                // Respawn 15m away instead of disposing
                this.handleParasiteDestruction(id);
            }
        }
    }
    
    /**
     * Get parasite by ID
     */
    public getParasiteById(parasiteId: string): EnergyParasite | null {
        return this.parasites.get(parasiteId) || null;
    }

    /**
     * Get all active parasites
     */
    public getParasites(): EnergyParasite[] {
        return Array.from(this.parasites.values()).filter(p => p.isAlive());
    }

    /**
     * Get all active parasites (alias for CombatSystem compatibility)
     */
    public getAllParasites(): EnergyParasite[] {
        return this.getParasites();
    }
    
    /**
     * Get parasites near a position
     */
    public getParasitesNear(position: Vector3, radius: number): EnergyParasite[] {
        return this.getParasites().filter(parasite => {
            const distance = Vector3.Distance(parasite.getPosition(), position);
            return distance <= radius;
        });
    }
    
    /**
     * Get parasite count for a deposit
     */
    public getParasiteCountForDeposit(depositId: string): number {
        return this.depositParasiteCount.get(depositId) || 0;
    }
    
    /**
     * Update spawn configuration
     */
    public updateSpawnConfig(config: Partial<ParasiteSpawnConfig>): void {
        this.spawnConfig = { ...this.spawnConfig, ...config };
        // Spawn config updated silently
    }
    
    /**
     * Dispose all parasites and cleanup
     */
    public dispose(): void {
        for (const parasite of this.parasites.values()) {
            parasite.dispose();
        }
        
        this.parasites.clear();
        this.lastSpawnAttempt.clear();
        this.depositParasiteCount.clear();
        
        // ParasiteManager disposed silently
    }
}