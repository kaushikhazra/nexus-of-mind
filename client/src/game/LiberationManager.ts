/**
 * LiberationManager - Territory Liberation System
 * 
 * Manages territory liberation mechanics after Queen death:
 * - 3-5 minute liberation periods with parasite-free guarantee
 * - 25% mining speed bonus during liberation
 * - Energy rewards for Queen kills (50-100 energy)
 * - Liberation timer tracking and status management
 */

import { Vector3 } from '@babylonjs/core';
import { EnergyManager } from './EnergyManager';
import { TerritoryManager, Territory } from './TerritoryManager';

export interface LiberationStatus {
    isLiberated: boolean;
    liberationStartTime: number;
    liberationDuration: number;
    timeRemaining: number;
    miningBonus: number; // 0.25 for 25% bonus
    energyReward: number; // 50-100 energy for Queen kill
}

export interface LiberationEvent {
    territoryId: string;
    timestamp: number;
    queenId: string;
    energyReward: number;
    liberationDuration: number;
    cause: 'queen_death' | 'hive_destruction';
}

export class LiberationManager {
    private activeLiberations: Map<string, LiberationStatus> = new Map();
    private energyManager: EnergyManager;
    private territoryManager: TerritoryManager | null = null;
    
    // Liberation constants (requirements 5.1, 5.2, 5.4)
    private readonly LIBERATION_DURATION_MIN = 180; // 3 minutes
    private readonly LIBERATION_DURATION_MAX = 300; // 5 minutes
    private readonly MINING_BONUS = 0.25; // 25% faster mining
    private readonly ENERGY_REWARD_MIN = 50; // Minimum energy reward
    private readonly ENERGY_REWARD_MAX = 100; // Maximum energy reward
    
    // Event tracking
    private liberationHistory: LiberationEvent[] = [];
    private onLiberationStartCallbacks: ((territoryId: string, status: LiberationStatus) => void)[] = [];
    private onLiberationEndCallbacks: ((territoryId: string) => void)[] = [];
    private onEnergyRewardCallbacks: ((territoryId: string, reward: number) => void)[] = [];

    constructor(energyManager: EnergyManager) {
        this.energyManager = energyManager;
    }

    /**
     * Set territory manager reference for integration
     */
    public setTerritoryManager(territoryManager: TerritoryManager): void {
        this.territoryManager = territoryManager;
    }

    /**
     * Start liberation for a territory (called when Queen is killed)
     * Requirements: 5.1, 5.2, 5.4
     */
    public startLiberation(
        territoryId: string, 
        queenId: string,
        cause: 'queen_death' | 'hive_destruction' = 'queen_death'
    ): LiberationStatus {
        // Calculate random liberation duration (3-5 minutes)
        const duration = this.LIBERATION_DURATION_MIN + 
                        Math.random() * (this.LIBERATION_DURATION_MAX - this.LIBERATION_DURATION_MIN);
        
        // Calculate random energy reward (50-100 energy)
        const energyReward = this.ENERGY_REWARD_MIN + 
                           Math.random() * (this.ENERGY_REWARD_MAX - this.ENERGY_REWARD_MIN);
        
        const currentTime = performance.now() / 1000; // Convert to seconds
        
        const liberationStatus: LiberationStatus = {
            isLiberated: true,
            liberationStartTime: currentTime,
            liberationDuration: duration,
            timeRemaining: duration,
            miningBonus: this.MINING_BONUS,
            energyReward: Math.floor(energyReward)
        };
        
        // Store liberation status
        this.activeLiberations.set(territoryId, liberationStatus);
        
        // Award energy reward immediately upon Queen kill
        this.energyManager.generateEnergy(
            `territory_${territoryId}`, 
            liberationStatus.energyReward, 
            `queen_kill_reward_${queenId}`
        );
        
        // Record liberation event
        const liberationEvent: LiberationEvent = {
            territoryId,
            timestamp: currentTime,
            queenId,
            energyReward: liberationStatus.energyReward,
            liberationDuration: duration,
            cause
        };
        this.liberationHistory.push(liberationEvent);
        
        // Keep only last 50 liberation events for memory efficiency
        if (this.liberationHistory.length > 50) {
            this.liberationHistory.shift();
        }
        
        // Notify listeners
        this.onLiberationStartCallbacks.forEach(callback => 
            callback(territoryId, liberationStatus)
        );
        this.onEnergyRewardCallbacks.forEach(callback => 
            callback(territoryId, liberationStatus.energyReward)
        );
        
        console.log(`🏴 Territory ${territoryId} liberated for ${Math.floor(duration)}s, awarded ${liberationStatus.energyReward} energy`);
        
        return liberationStatus;
    }

    /**
     * Update liberation timers (called each frame)
     */
    public updateLiberations(deltaTime: number): void {
        const expiredTerritories: string[] = [];
        
        for (const [territoryId, status] of this.activeLiberations.entries()) {
            // Update time remaining by subtracting deltaTime
            status.timeRemaining = Math.max(0, status.timeRemaining - deltaTime);
            
            // Check if liberation period has ended
            if (status.timeRemaining <= 0) {
                status.isLiberated = false;
                expiredTerritories.push(territoryId);
            }
        }
        
        // Handle expired liberations
        for (const territoryId of expiredTerritories) {
            this.endLiberation(territoryId);
        }
    }

    /**
     * End liberation for a territory
     */
    private endLiberation(territoryId: string): void {
        const status = this.activeLiberations.get(territoryId);
        if (!status) return;
        
        // Remove from active liberations
        this.activeLiberations.delete(territoryId);
        
        // Notify listeners
        this.onLiberationEndCallbacks.forEach(callback => callback(territoryId));
        
        console.log(`🏴 Territory ${territoryId} liberation ended`);
    }

    /**
     * Check if a territory is currently liberated
     * Requirement: 5.1
     */
    public isTerritoryLiberated(territoryId: string): boolean {
        const status = this.activeLiberations.get(territoryId);
        return status ? status.isLiberated && status.timeRemaining > 0 : false;
    }

    /**
     * Get liberation status for a territory
     */
    public getLiberationStatus(territoryId: string): LiberationStatus | null {
        return this.activeLiberations.get(territoryId) || null;
    }

    /**
     * Get mining bonus at a specific position
     * Requirement: 5.2 - 25% mining speed bonus during liberation
     */
    public getMiningBonusAt(position: Vector3): number {
        if (!this.territoryManager) {
            return 0;
        }
        
        // Get territory at position
        const territory = this.territoryManager.getTerritoryAt(position.x, position.z);
        if (!territory) {
            return 0;
        }
        
        // Check if territory is liberated
        const status = this.activeLiberations.get(territory.id);
        if (!status || !status.isLiberated || status.timeRemaining <= 0) {
            return 0;
        }
        
        return status.miningBonus;
    }

    /**
     * Get all currently liberated territories
     */
    public getLiberatedTerritories(): string[] {
        const liberated: string[] = [];
        
        for (const [territoryId, status] of this.activeLiberations.entries()) {
            if (status.isLiberated && status.timeRemaining > 0) {
                liberated.push(territoryId);
            }
        }
        
        return liberated;
    }

    /**
     * Get liberation history
     */
    public getLiberationHistory(): LiberationEvent[] {
        return [...this.liberationHistory];
    }

    /**
     * Get total energy rewards given
     */
    public getTotalEnergyRewards(): number {
        return this.liberationHistory.reduce((total, event) => total + event.energyReward, 0);
    }

    /**
     * Get liberation statistics
     */
    public getLiberationStats(): {
        totalLiberations: number;
        activeLiberations: number;
        totalEnergyRewards: number;
        averageLiberationDuration: number;
        averageEnergyReward: number;
    } {
        const totalLiberations = this.liberationHistory.length;
        const activeLiberations = this.activeLiberations.size;
        const totalEnergyRewards = this.getTotalEnergyRewards();
        
        const averageLiberationDuration = totalLiberations > 0 
            ? this.liberationHistory.reduce((sum, event) => sum + event.liberationDuration, 0) / totalLiberations
            : 0;
            
        const averageEnergyReward = totalLiberations > 0
            ? totalEnergyRewards / totalLiberations
            : 0;
        
        return {
            totalLiberations,
            activeLiberations,
            totalEnergyRewards,
            averageLiberationDuration,
            averageEnergyReward
        };
    }

    /**
     * Subscribe to liberation start events
     */
    public onLiberationStart(callback: (territoryId: string, status: LiberationStatus) => void): void {
        this.onLiberationStartCallbacks.push(callback);
    }

    /**
     * Subscribe to liberation end events
     */
    public onLiberationEnd(callback: (territoryId: string) => void): void {
        this.onLiberationEndCallbacks.push(callback);
    }

    /**
     * Subscribe to energy reward events
     */
    public onEnergyReward(callback: (territoryId: string, reward: number) => void): void {
        this.onEnergyRewardCallbacks.push(callback);
    }

    /**
     * Force end liberation for a territory (for testing or special cases)
     */
    public forceEndLiberation(territoryId: string): boolean {
        if (!this.activeLiberations.has(territoryId)) {
            return false;
        }
        
        this.endLiberation(territoryId);
        return true;
    }

    /**
     * Clear all liberations (for testing or game reset)
     */
    public clearAllLiberations(): void {
        const territoryIds = Array.from(this.activeLiberations.keys());
        
        for (const territoryId of territoryIds) {
            this.endLiberation(territoryId);
        }
        
        this.activeLiberations.clear();
        this.liberationHistory = [];
    }

    /**
     * Dispose liberation manager
     */
    public dispose(): void {
        this.clearAllLiberations();
        this.onLiberationStartCallbacks = [];
        this.onLiberationEndCallbacks = [];
        this.onEnergyRewardCallbacks = [];
        this.territoryManager = null;
    }
}