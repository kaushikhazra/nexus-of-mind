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
}

export interface ParasiteSpawnConfig {
    baseSpawnInterval: number;    // Base time between spawns (ms)
    maxParasitesPerDeposit: number; // Max parasites per mineral deposit
    spawnRadius: number;          // How close to deposit to spawn
    activeMiningMultiplier: number; // Spawn rate multiplier when workers present
}

export class ParasiteManager {
    private scene: Scene;
    private materialManager: MaterialManager;
    private parasites: Map<string, EnergyParasite> = new Map();
    
    // Spawning configuration
    private spawnConfig: ParasiteSpawnConfig = {
        baseSpawnInterval: 75000,    // 75 seconds base interval
        maxParasitesPerDeposit: 3,   // Max 3 parasites per deposit
        spawnRadius: 15,             // Spawn within 15 units of deposit
        activeMiningMultiplier: 2.0  // 2x spawn rate when workers mining
    };
    
    // Spawn tracking
    private lastSpawnAttempt: Map<string, number> = new Map(); // depositId -> timestamp
    private depositParasiteCount: Map<string, number> = new Map(); // depositId -> count
    
    constructor(config: ParasiteManagerConfig) {
        this.scene = config.scene;
        this.materialManager = config.materialManager;
        
        console.log('🟣 ParasiteManager initialized');
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
        
        // Clean up dead parasites
        this.cleanupDeadParasites();
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
        
        // Calculate spawn interval based on activity
        const workersNearDeposit = workers.filter(worker => {
            const distance = Vector3.Distance(worker.getPosition(), deposit.getPosition());
            return distance <= 20; // Workers within 20 units
        });
        
        const hasActiveMiners = workersNearDeposit.length > 0;
        const spawnInterval = hasActiveMiners 
            ? this.spawnConfig.baseSpawnInterval / this.spawnConfig.activeMiningMultiplier
            : this.spawnConfig.baseSpawnInterval;
        
        // Check if enough time has passed since last spawn attempt
        const lastSpawn = this.lastSpawnAttempt.get(depositId) || 0;
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
        this.parasites.set(parasite.getId(), parasite);
        
        // Update tracking
        const depositId = deposit.getId();
        const currentCount = this.depositParasiteCount.get(depositId) || 0;
        this.depositParasiteCount.set(depositId, currentCount + 1);
        
        console.log(`🟣 Spawned parasite ${parasite.getId()} near deposit ${depositId} (${currentCount + 1}/${this.spawnConfig.maxParasitesPerDeposit})`);
    }
    
    /**
     * Handle protector attacking a parasite
     */
    public handleProtectorAttack(protector: Protector, targetPosition: Vector3): boolean {
        // Find parasite at target position
        const targetParasite = this.findParasiteAt(targetPosition, 2.0); // 2 unit tolerance
        
        if (!targetParasite) {
            return false; // No parasite found
        }
        
        // Check if protector is in range
        const distance = Vector3.Distance(protector.getPosition(), targetParasite.getPosition());
        if (distance > 15) { // 15 unit attack range
            console.log(`🟣 Protector ${protector.getId()} too far from parasite (${distance.toFixed(1)}m > 15m)`);
            return false;
        }
        
        // Check if protector has enough energy
        const attackCost = 5; // 5 energy per attack
        if (!protector.getEnergyStorage().hasEnergy(attackCost)) {
            console.log(`🟣 Protector ${protector.getId()} insufficient energy for attack (need ${attackCost})`);
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
            
            console.log(`🟣 Protector ${protector.getId()} destroyed parasite ${targetParasite.getId()} (cost: ${attackCost}, reward: ${killReward})`);
        }
        
        return true; // Attack successful
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
     * Clean up dead parasites
     */
    private cleanupDeadParasites(): void {
        const deadParasites: string[] = [];
        
        for (const [id, parasite] of this.parasites.entries()) {
            if (!parasite.isAlive()) {
                // Update deposit count
                const depositId = parasite.getHomeDeposit().getId();
                const currentCount = this.depositParasiteCount.get(depositId) || 0;
                this.depositParasiteCount.set(depositId, Math.max(0, currentCount - 1));
                
                parasite.dispose();
                deadParasites.push(id);
            }
        }
        
        // Remove from tracking
        for (const id of deadParasites) {
            this.parasites.delete(id);
        }
        
        if (deadParasites.length > 0) {
            console.log(`🟣 Cleaned up ${deadParasites.length} dead parasites`);
        }
    }
    
    /**
     * Get all active parasites
     */
    public getParasites(): EnergyParasite[] {
        return Array.from(this.parasites.values()).filter(p => p.isAlive());
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
        console.log('🟣 ParasiteManager spawn config updated:', this.spawnConfig);
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
        
        console.log('🟣 ParasiteManager disposed');
    }
}