/**
 * Protector - Protector unit specialization with combat and defense capabilities
 * 
 * Protectors are heavily armored combat units designed for base defense and tactical
 * combat. They have the highest health and energy storage but consume more energy
 * for movement and actions, making them powerful but resource-intensive.
 */

import { Vector3 } from '@babylonjs/core';
import { Unit, UnitConfig } from './Unit';

export interface CombatTarget {
    id: string;
    position: Vector3;
    health: number;
    isEnemy: boolean;
}

export class Protector extends Unit {
    // Protector-specific properties
    private attackDamage: number = 25; // Base attack damage
    private attackRange: number = 6.0; // Combat range
    private defenseRating: number = 5; // Damage reduction
    private shieldActive: boolean = false;
    private shieldStrength: number = 50; // Shield hit points
    private maxShieldStrength: number = 50;
    private combatExperience: number = 0; // Gained through combat
    
    // Combat state
    private currentTarget: CombatTarget | null = null;
    private lastAttackTime: number = 0;
    private attackCooldown: number = 2.0; // 2 seconds between attacks
    private isInCombat: boolean = false;

    constructor(position: Vector3, config?: Partial<UnitConfig>) {
        const protectorConfig: UnitConfig = {
            unitType: 'protector',
            position,
            energyStorage: {
                capacity: 12,
                initialEnergy: 8, // Start with good energy for immediate combat
                transferRate: 1.5, // Slower energy transfer due to heavy systems
                efficiency: 0.9 // Slightly less efficient due to armor weight
            },
            maxHealth: 120, // Highest health of all units
            movementSpeed: 3.0, // Slowest movement due to armor
            actionCooldown: 1.0, // Moderate action cooldown
            ...config
        };

        super(protectorConfig);
        
        console.log(`🛡️ Protector unit ${this.getId()} ready for combat and defense`);
    }

    /**
     * Protectors cannot mine (not their specialization)
     */
    public canMine(): boolean {
        return false;
    }

    /**
     * Protectors cannot build (not their specialization)
     */
    public canBuild(): boolean {
        return false;
    }

    /**
     * Protectors don't mine, so no mining range
     */
    public getMiningRange(): number {
        return 0;
    }

    /**
     * Protectors don't mine, so no mining energy cost
     */
    public getMiningEnergyCost(): number {
        return 0;
    }

    /**
     * Get protector-specific special abilities
     */
    public getSpecialAbilities(): string[] {
        return [
            'combat_attack',
            'shield_defense',
            'area_patrol',
            'base_defense',
            'heavy_armor'
        ];
    }

    /**
     * Attack a target
     */
    public async attackTarget(target: CombatTarget): Promise<boolean> {
        if (!this.canPerformAction() || !this.canAttack()) {
            return false;
        }

        // Check if target is in range
        const distance = Vector3.Distance(this.getPosition(), target.position);
        if (distance > this.attackRange) {
            console.warn(`⚠️ Protector ${this.getId()} target out of range (${distance.toFixed(1)} > ${this.attackRange})`);
            return false;
        }

        // Calculate energy cost based on target type and distance
        const energyCost = this.calculateAttackEnergyCost(target, distance);
        if (this.energyStorage.getCurrentEnergy() < energyCost) {
            console.warn(`⚠️ Protector ${this.getId()} insufficient energy for attack (need ${energyCost})`);
            return false;
        }

        // Consume energy for attack
        if (!this.energyStorage.removeEnergy(energyCost, 'combat_attack')) {
            return false;
        }

        // Execute attack
        this.currentTarget = target;
        this.lastAttackTime = performance.now();
        this.lastActionTime = performance.now();
        this.isInCombat = true;

        // Calculate actual damage (base damage + experience bonus - target defense)
        const experienceBonus = Math.floor(this.combatExperience / 10);
        const actualDamage = Math.max(1, this.attackDamage + experienceBonus);

        console.log(`⚔️ Protector ${this.getId()} attacks ${target.id} for ${actualDamage} damage (cost: ${energyCost} energy)`);

        // Gain combat experience
        this.combatExperience += 1;

        // TODO: Apply damage to target (would need target reference)
        // target.takeDamage(actualDamage);

        return true;
    }

    /**
     * Calculate energy cost for attack based on target and distance
     */
    private calculateAttackEnergyCost(target: CombatTarget, distance: number): number {
        let baseCost = 3.0; // Base attack energy cost
        
        // Distance modifier (further targets cost more energy)
        const distanceModifier = 1 + (distance / this.attackRange) * 0.5;
        
        // Target type modifier (future: different costs for different target types)
        const targetModifier = 1.0;
        
        return baseCost * distanceModifier * targetModifier;
    }

    /**
     * Check if protector can attack
     */
    private canAttack(): boolean {
        const now = performance.now();
        const timeSinceLastAttack = (now - this.lastAttackTime) / 1000;
        
        return timeSinceLastAttack >= this.attackCooldown;
    }

    /**
     * Activate energy shield
     */
    public async activateShield(): Promise<boolean> {
        if (this.shieldActive) {
            console.log(`🛡️ Protector ${this.getId()} shield already active`);
            return true;
        }

        const activationCost = 2.0; // 2 energy to activate shield
        if (this.energyStorage.getCurrentEnergy() < activationCost) {
            console.warn(`⚠️ Protector ${this.getId()} insufficient energy for shield activation`);
            return false;
        }

        // Consume energy for shield activation
        if (!this.energyStorage.removeEnergy(activationCost, 'shield_activation')) {
            return false;
        }

        this.shieldActive = true;
        this.shieldStrength = this.maxShieldStrength;
        this.lastActionTime = performance.now();

        console.log(`🛡️ Protector ${this.getId()} shield activated (${this.shieldStrength} strength)`);
        return true;
    }

    /**
     * Deactivate energy shield
     */
    public deactivateShield(): void {
        if (!this.shieldActive) {
            return;
        }

        this.shieldActive = false;
        console.log(`🛡️ Protector ${this.getId()} shield deactivated`);
    }

    /**
     * Update shield (consumes energy over time)
     */
    private updateShield(deltaTime: number): void {
        if (!this.shieldActive) {
            return;
        }

        const shieldEnergyCost = 1.0 * deltaTime; // 1 energy per second
        if (this.energyStorage.getCurrentEnergy() < shieldEnergyCost) {
            console.log(`🛡️ Protector ${this.getId()} shield deactivated - insufficient energy`);
            this.deactivateShield();
            return;
        }

        // Consume energy for shield maintenance
        this.energyStorage.removeEnergy(shieldEnergyCost, 'shield_maintenance');

        // Regenerate shield strength slowly
        if (this.shieldStrength < this.maxShieldStrength) {
            const regenRate = 5.0 * deltaTime; // 5 shield points per second
            this.shieldStrength = Math.min(this.maxShieldStrength, this.shieldStrength + regenRate);
        }
    }

    /**
     * Take damage with shield protection
     */
    public takeDamage(amount: number): void {
        let actualDamage = amount;

        // Apply defense rating
        actualDamage = Math.max(1, actualDamage - this.defenseRating);

        // Shield absorbs damage first
        if (this.shieldActive && this.shieldStrength > 0) {
            const shieldAbsorbed = Math.min(actualDamage, this.shieldStrength);
            this.shieldStrength -= shieldAbsorbed;
            actualDamage -= shieldAbsorbed;

            console.log(`🛡️ Protector ${this.getId()} shield absorbed ${shieldAbsorbed} damage (${this.shieldStrength} shield remaining)`);

            if (this.shieldStrength <= 0) {
                this.deactivateShield();
            }
        }

        // Apply remaining damage to health
        if (actualDamage > 0) {
            super.takeDamage(actualDamage);
        }
    }

    /**
     * Patrol an area for threats
     */
    public async startPatrol(centerPosition: Vector3, radius: number): Promise<boolean> {
        if (!this.canPerformAction()) {
            return false;
        }

        const patrolCost = 0.5; // 0.5 energy to start patrol
        if (this.energyStorage.getCurrentEnergy() < patrolCost) {
            console.warn(`⚠️ Protector ${this.getId()} insufficient energy for patrol`);
            return false;
        }

        // Consume energy for patrol setup
        if (!this.energyStorage.removeEnergy(patrolCost, 'patrol_setup')) {
            return false;
        }

        // TODO: Implement patrol logic with waypoints
        console.log(`👮 Protector ${this.getId()} started patrol around ${centerPosition.toString()} (radius: ${radius})`);
        
        this.lastActionTime = performance.now();
        return true;
    }

    /**
     * Upgrade attack damage
     */
    public upgradeAttackDamage(bonus: number): void {
        this.attackDamage += bonus;
        console.log(`⬆️ Protector ${this.getId()} attack damage upgraded to ${this.attackDamage}`);
    }

    /**
     * Upgrade defense rating
     */
    public upgradeDefenseRating(bonus: number): void {
        this.defenseRating += bonus;
        console.log(`⬆️ Protector ${this.getId()} defense rating upgraded to ${this.defenseRating}`);
    }

    /**
     * Upgrade shield strength
     */
    public upgradeShieldStrength(bonus: number): void {
        this.maxShieldStrength += bonus;
        this.shieldStrength = Math.min(this.shieldStrength + bonus, this.maxShieldStrength);
        console.log(`⬆️ Protector ${this.getId()} shield strength upgraded to ${this.maxShieldStrength}`);
    }

    /**
     * Get protector-specific statistics
     */
    public getProtectorStats(): any {
        const baseStats = this.getStats();
        return {
            ...baseStats,
            attackDamage: this.attackDamage,
            attackRange: this.attackRange,
            defenseRating: this.defenseRating,
            shieldActive: this.shieldActive,
            shieldStrength: this.shieldStrength,
            maxShieldStrength: this.maxShieldStrength,
            combatExperience: this.combatExperience,
            isInCombat: this.isInCombat,
            currentTarget: this.currentTarget?.id || null
        };
    }

    /**
     * Check if protector is in combat
     */
    public isInCombatState(): boolean {
        return this.isInCombat;
    }

    /**
     * Exit combat state
     */
    public exitCombat(): void {
        this.isInCombat = false;
        this.currentTarget = null;
        console.log(`⚔️ Protector ${this.getId()} exited combat`);
    }

    /**
     * Protector-specific update logic
     */
    public update(deltaTime: number): void {
        super.update(deltaTime);
        
        // Update shield
        this.updateShield(deltaTime);
        
        // Check combat state timeout
        if (this.isInCombat) {
            const now = performance.now();
            const timeSinceLastAttack = (now - this.lastAttackTime) / 1000;
            
            // Exit combat if no recent attacks
            if (timeSinceLastAttack > 10.0) { // 10 seconds timeout
                this.exitCombat();
            }
        }
    }

    /**
     * Enhanced dispose with protector-specific cleanup
     */
    public dispose(): void {
        // Deactivate shield
        this.deactivateShield();
        
        // Clear combat state
        this.exitCombat();
        
        console.log(`🛡️ Protector ${this.getId()} combat systems shut down`);
        super.dispose();
    }
}