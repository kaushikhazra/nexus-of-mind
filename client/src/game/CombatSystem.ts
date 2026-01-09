/**
 * CombatSystem - Central combat coordinator for all combat actions
 *
 * Manages combat actions between Protector units and enemy targets including
 * Energy Parasites and AI opponent units. Handles target validation, range
 * checking, energy costs, and combat state management.
 */

import { Vector3 } from '@babylonjs/core';
import { Protector } from './entities/Protector';
import { EnergyParasite } from './entities/EnergyParasite';
import { EnergyManager } from './EnergyManager';

export interface CombatTarget {
    id: string;
    position: Vector3;
    health: number;
    maxHealth: number;
    takeDamage(amount: number): boolean; // Returns true if destroyed
    onDestroyed(): void;
}

export interface TargetValidation {
    isValid: boolean;
    reason: 'valid' | 'friendly' | 'out_of_range' | 'invalid_type' | 'insufficient_energy';
    requiredEnergy?: number;
    currentRange?: number;
    maxRange?: number;
}

export interface AttackResult {
    success: boolean;
    damageDealt: number;
    targetDestroyed: boolean;
    energyConsumed: number;
    energyRewarded: number;
}

export interface CombatConfig {
    protectorAttackRange: number; // 8 units
    attackEnergyCost: number; // 5 energy per attack
    attackCooldown: number; // 1000ms between attacks
    parasiteReward: number; // 10 energy for destroying parasite
    aiUnitRewards: {
        worker: number; // 15 energy
        scout: number; // 12 energy
        protector: number; // 20 energy
    };
}

/**
 * CombatAction - Represents an ongoing combat action between a protector and target
 */
export class CombatAction {
    public protectorId: string;
    public targetId: string;
    public state: 'approaching' | 'attacking' | 'completed';
    public startTime: number;
    public lastAttackTime: number;

    constructor(protectorId: string, targetId: string) {
        this.protectorId = protectorId;
        this.targetId = targetId;
        this.state = 'approaching';
        this.startTime = performance.now();
        this.lastAttackTime = 0;
    }

    /**
     * Update combat action state
     */
    public setState(newState: 'approaching' | 'attacking' | 'completed'): void {
        this.state = newState;
    }

    /**
     * Record attack execution
     */
    public recordAttack(): void {
        this.lastAttackTime = performance.now();
        this.state = 'attacking';
    }

    /**
     * Check if action is completed or timed out
     */
    public isCompleted(): boolean {
        return this.state === 'completed' || 
               (performance.now() - this.startTime > 30000); // 30 second timeout
    }

    /**
     * Get action duration in seconds
     */
    public getDuration(): number {
        return (performance.now() - this.startTime) / 1000;
    }
}

/**
 * CombatSystem - Central coordinator for all combat actions and state management
 */
export class CombatSystem {
    private energyManager: EnergyManager;
    private activeCombats: Map<string, CombatAction> = new Map();
    
    // Combat configuration
    private config: CombatConfig = {
        protectorAttackRange: 8,
        attackEnergyCost: 5,
        attackCooldown: 1000,
        parasiteReward: 10,
        aiUnitRewards: {
            worker: 15,
            scout: 12,
            protector: 20
        }
    };

    constructor(energyManager: EnergyManager) {
        this.energyManager = energyManager;
    }

    /**
     * Initiate an attack action between a protector and target
     */
    public initiateAttack(protector: Protector, target: CombatTarget): boolean {
        // Validate the attack
        const validation = this.validateTarget(protector, target);
        if (!validation.isValid) {
            console.warn(`❌ Attack validation failed: ${validation.reason}`);
            return false;
        }

        // Check if protector is already in combat
        const existingCombat = this.getActiveCombatForProtector(protector.getId());
        if (existingCombat) {
            // Cancel existing combat and start new one
            this.cancelCombat(existingCombat.protectorId, existingCombat.targetId);
        }

        // Create new combat action
        const combatId = this.generateCombatId(protector.getId(), target.id);
        const combatAction = new CombatAction(protector.getId(), target.id);
        this.activeCombats.set(combatId, combatAction);

        // Check if protector is in range
        const distance = Vector3.Distance(protector.getPosition(), target.position);
        if (distance <= this.config.protectorAttackRange) {
            // In range - start attacking immediately
            combatAction.setState('attacking');
            this.executeAttack(protector, target, combatAction);
        } else {
            // Out of range - protector needs to move closer
            combatAction.setState('approaching');
            this.moveProtectorToAttackRange(protector, target);
        }

        return true;
    }

    /**
     * Validate if a target is valid for attack
     */
    public validateTarget(protector: Protector, target: CombatTarget): TargetValidation {
        // Check if target is a valid enemy type
        if (!this.isValidEnemyTarget(target)) {
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }

        // Check if protector has enough energy
        const protectorEnergy = protector.getEnergyStorage().getCurrentEnergy();
        if (protectorEnergy < this.config.attackEnergyCost) {
            return {
                isValid: false,
                reason: 'insufficient_energy',
                requiredEnergy: this.config.attackEnergyCost
            };
        }

        // Check range (for UI feedback, not blocking)
        const distance = Vector3.Distance(protector.getPosition(), target.position);
        
        return {
            isValid: true,
            reason: 'valid',
            currentRange: distance,
            maxRange: this.config.protectorAttackRange
        };
    }

    /**
     * Calculate damage for an attack
     */
    public calculateDamage(attacker: Protector, target: CombatTarget): number {
        // Base damage from protector stats
        const protectorStats = attacker.getProtectorStats();
        let baseDamage = protectorStats.attackDamage || 25;

        // Add experience bonus
        const experienceBonus = Math.floor((protectorStats.combatExperience || 0) / 10);
        baseDamage += experienceBonus;

        // Target-specific modifiers
        if (target instanceof EnergyParasite) {
            // Parasites take full damage
            return baseDamage;
        }

        // Default damage for other targets
        return baseDamage;
    }

    /**
     * Execute an attack action
     */
    public executeAttack(protector: Protector, target: CombatTarget, combatAction: CombatAction): AttackResult {
        const result: AttackResult = {
            success: false,
            damageDealt: 0,
            targetDestroyed: false,
            energyConsumed: 0,
            energyRewarded: 0
        };

        // Check if protector can attack (cooldown, energy, etc.)
        if (!this.canProtectorAttack(protector)) {
            return result;
        }

        // Consume energy for attack
        const energyConsumed = this.config.attackEnergyCost;
        if (!protector.getEnergyStorage().removeEnergy(energyConsumed, 'combat_attack')) {
            return result;
        }

        result.energyConsumed = energyConsumed;

        // Calculate and apply damage
        const damage = this.calculateDamage(protector, target);
        const targetDestroyed = target.takeDamage(damage);

        result.success = true;
        result.damageDealt = damage;
        result.targetDestroyed = targetDestroyed;

        // Record attack in combat action
        combatAction.recordAttack();

        // Handle target destruction
        if (targetDestroyed) {
            const energyReward = this.getEnergyReward(target);
            if (energyReward > 0) {
                this.energyManager.generateEnergy(protector.getId(), energyReward, 'combat_victory');
                result.energyRewarded = energyReward;
            }

            // Clean up combat action
            this.handleTargetDestruction(target);
            combatAction.setState('completed');
        }

        return result;
    }

    /**
     * Handle target destruction cleanup
     */
    public handleTargetDestruction(target: CombatTarget): void {
        // Cancel all pending attacks on this target
        const combatsToCancel: string[] = [];
        
        for (const [combatId, combat] of this.activeCombats) {
            if (combat.targetId === target.id) {
                combatsToCancel.push(combatId);
            }
        }

        // Remove all combat actions targeting this destroyed target
        for (const combatId of combatsToCancel) {
            this.activeCombats.delete(combatId);
        }

        // Notify target of destruction
        target.onDestroyed();
    }

    /**
     * Handle protector destruction cleanup
     */
    public handleProtectorDestruction(protectorId: string): void {
        // Cancel all combat actions involving this protector
        const combatsToCancel: string[] = [];
        
        for (const [combatId, combat] of this.activeCombats) {
            if (combat.protectorId === protectorId) {
                combatsToCancel.push(combatId);
            }
        }

        // Remove all combat actions involving this destroyed protector
        for (const combatId of combatsToCancel) {
            this.activeCombats.delete(combatId);
        }
    }

    /**
     * Update combat system (called from game loop)
     */
    public update(deltaTime: number): void {
        // Clean up completed or timed out combat actions
        const combatsToRemove: string[] = [];
        
        for (const [combatId, combat] of this.activeCombats) {
            if (combat.isCompleted()) {
                combatsToRemove.push(combatId);
            }
        }

        // Remove completed combats
        for (const combatId of combatsToRemove) {
            this.activeCombats.delete(combatId);
        }
    }

    /**
     * Check if a protector can attack (cooldown, energy, etc.)
     */
    private canProtectorAttack(protector: Protector): boolean {
        const protectorStats = protector.getProtectorStats();
        
        // Check energy
        if (protectorStats.energyStorage.currentEnergy < this.config.attackEnergyCost) {
            return false;
        }

        // Check cooldown (if protector has lastAttackTime tracking)
        const now = performance.now();
        const timeSinceLastAttack = now - (protectorStats.lastActionTime || 0);
        if (timeSinceLastAttack < this.config.attackCooldown) {
            return false;
        }

        return true;
    }

    /**
     * Check if target is a valid enemy
     */
    private isValidEnemyTarget(target: CombatTarget): boolean {
        // Energy Parasites are valid targets
        if (target instanceof EnergyParasite) {
            return true;
        }

        // TODO: Add AI unit validation when AI units are implemented
        // For now, accept any target that implements CombatTarget interface
        return target.id !== undefined && target.position !== undefined && typeof target.health === 'number';
    }

    /**
     * Get energy reward for destroying a target
     */
    private getEnergyReward(target: CombatTarget): number {
        if (target instanceof EnergyParasite) {
            return this.config.parasiteReward;
        }

        // TODO: Add AI unit rewards based on unit type
        return 0;
    }

    /**
     * Move protector to attack range of target
     */
    private moveProtectorToAttackRange(protector: Protector, target: CombatTarget): void {
        // Calculate optimal attack position (just within range)
        const direction = target.position.subtract(protector.getPosition()).normalize();
        const optimalDistance = this.config.protectorAttackRange * 0.8; // 80% of max range
        const targetPosition = target.position.subtract(direction.scale(optimalDistance));

        // Issue movement command to protector
        protector.startMovement(targetPosition);
    }

    /**
     * Cancel a combat action
     */
    private cancelCombat(protectorId: string, targetId: string): void {
        const combatId = this.generateCombatId(protectorId, targetId);
        this.activeCombats.delete(combatId);
    }

    /**
     * Get active combat for a protector
     */
    private getActiveCombatForProtector(protectorId: string): CombatAction | null {
        for (const combat of this.activeCombats.values()) {
            if (combat.protectorId === protectorId) {
                return combat;
            }
        }
        return null;
    }

    /**
     * Generate unique combat ID
     */
    private generateCombatId(protectorId: string, targetId: string): string {
        return `combat_${protectorId}_${targetId}`;
    }

    /**
     * Get all active combat actions
     */
    public getActiveCombats(): CombatAction[] {
        return Array.from(this.activeCombats.values());
    }

    /**
     * Get combat configuration
     */
    public getConfig(): CombatConfig {
        return { ...this.config };
    }

    /**
     * Update combat configuration
     */
    public updateConfig(newConfig: Partial<CombatConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Dispose combat system
     */
    public dispose(): void {
        this.activeCombats.clear();
    }
}