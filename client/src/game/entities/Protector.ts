/**
 * Protector - Protector unit specialization with combat and defense capabilities
 *
 * Protectors are heavily armored combat units designed for base defense and tactical
 * combat. They have the highest health and energy storage but consume more energy
 * for movement and actions, making them powerful but resource-intensive.
 */

import { Vector3 } from '@babylonjs/core';
import { Unit, UnitConfig } from './Unit';
import { CombatTarget } from '../CombatSystem';
import { EnergyManager } from '../EnergyManager';
import { EnergyParasite } from './EnergyParasite';

export class Protector extends Unit {
    // Protector-specific properties
    private attackDamage: number = 25; // Base attack damage
    private attackRange: number = 8.0; // Combat range (matches design specification)
    private detectionRange: number = 10.0; // Auto-detection range (larger than combat range)
    private defenseRating: number = 5; // Damage reduction
    private shieldActive: boolean = false;
    private shieldStrength: number = 50; // Shield hit points
    private maxShieldStrength: number = 50;
    private combatExperience: number = 0; // Gained through combat

    // Combat state for movement-based auto-attack
    private currentTarget: CombatTarget | null = null;
    private lastAttackTime: number = 0;
    private attackCooldown: number = 2.0; // 2 seconds between attacks
    private isInCombat: boolean = false;
    private isPursuing: boolean = false; // Track if currently pursuing a moving target
    private pursuitStartTime: number = 0;
    private maxPursuitTime: number = 15000; // 15 seconds max pursuit time
    private lastTargetPosition: Vector3 | null = null;
    
    // Movement-based auto-attack properties
    private originalDestination: Vector3 | null = null; // Where protector was originally moving
    private combatState: 'moving' | 'detecting' | 'engaging' | 'attacking' = 'moving';
    private autoAttackEnabled: boolean = true;

    // Target facing - used for combat animations
    private facingTargetPosition: Vector3 | null = null;

    // Energy management
    private energyManager: EnergyManager;

    constructor(position: Vector3, config?: Partial<UnitConfig>) {
        const protectorConfig: UnitConfig = {
            unitType: 'protector',
            position,
            energyStorage: {
                capacity: 60, // 5x multiplier (was 12)
                initialEnergy: 40, // 5x multiplier (was 8) - Start with good energy for immediate combat
                transferRate: 1.5, // Slower energy transfer due to heavy systems
                efficiency: 0.9 // Slightly less efficient due to armor weight
            },
            maxHealth: 120, // Highest health of all units
            movementSpeed: 7.0, // Same speed as other units
            actionCooldown: 1.0, // Moderate action cooldown
            ...config
        };

        super(protectorConfig);
        
        // Initialize energy manager
        this.energyManager = EnergyManager.getInstance();
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
     * Move to a specific location (click-to-move command)
     */
    public async moveToLocation(destination: Vector3): Promise<boolean> {
        if (!this.canPerformAction()) {
            return false;
        }

        // Clear facing target so protector faces movement direction
        this.clearFacingTarget();

        // Store original destination for potential resumption after combat
        this.originalDestination = destination.clone();
        this.combatState = 'moving';

        // Start movement to the destination
        const success = await this.startMovement(destination);
        
        return success;
    }

    /**
     * Detect nearby enemies within detection range
     */
    public detectNearbyEnemies(): CombatTarget[] {
        if (!this.autoAttackEnabled) {
            return [];
        }

        // Get CombatSystem instance to use its detection method
        const gameEngine = require('../GameEngine').GameEngine.getInstance();
        const combatSystem = gameEngine?.getCombatSystem();
        
        if (!combatSystem) {
            return [];
        }

        return combatSystem.detectNearbyEnemies(this, this.detectionRange);
    }

    /**
     * Check if target is within detection range
     */
    public isInDetectionRange(target: CombatTarget): boolean {
        const distance = Vector3.Distance(this.getPosition(), target.position);
        return distance <= this.detectionRange;
    }

    /**
     * Check if target is within combat range
     */
    public isInCombatRange(target: CombatTarget): boolean {
        const distance = Vector3.Distance(this.getPosition(), target.position);
        return distance <= this.attackRange;
    }

    /**
     * Prioritize targets by distance (closest first)
     */
    public prioritizeTargets(targets: CombatTarget[]): CombatTarget | null {
        if (targets.length === 0) {
            return null;
        }

        const protectorPosition = this.getPosition();
        let closestTarget = targets[0];
        let closestDistance = Vector3.Distance(protectorPosition, closestTarget.position);

        for (let i = 1; i < targets.length; i++) {
            const distance = Vector3.Distance(protectorPosition, targets[i].position);
            if (distance < closestDistance) {
                closestTarget = targets[i];
                closestDistance = distance;
            }
        }

        return closestTarget;
    }

    /**
     * Automatically engage a detected target
     */
    public autoEngageTarget(target: CombatTarget): boolean {
        if (!this.autoAttackEnabled || !this.canPerformAction()) {
            return false;
        }

        // Get CombatSystem instance to initiate auto-attack
        const gameEngine = require('../GameEngine').GameEngine.getInstance();
        const combatSystem = gameEngine?.getCombatSystem();
        
        if (!combatSystem) {
            return false;
        }

        // Set combat state
        this.combatState = 'detecting';
        this.currentTarget = target;

        // Initiate auto-attack through combat system
        return combatSystem.initiateAutoAttack(this, target, this.originalDestination);
    }

    /**
     * Resume original movement after combat completion
     */
    public async resumeOriginalMovement(): Promise<boolean> {
        if (!this.originalDestination) {
            return false;
        }

        const currentPosition = this.getPosition();
        const distanceToDestination = Vector3.Distance(currentPosition, this.originalDestination);
        
        // Check if already at destination (within 1 unit tolerance)
        if (distanceToDestination <= 1.0) {
            this.originalDestination = null;
            this.combatState = 'moving';
            return true;
        }

        // Resume movement to original destination
        this.combatState = 'moving';
        const success = await this.startMovement(this.originalDestination);

        return success;
    }

    /**
     * Get detection range
     */
    public getDetectionRange(): number {
        return this.detectionRange;
    }

    /**
     * Get combat range
     */
    public getCombatRange(): number {
        return this.attackRange;
    }

    /**
     * Set auto-attack enabled/disabled
     */
    public setAutoAttackEnabled(enabled: boolean): void {
        this.autoAttackEnabled = enabled;
    }

    /**
     * Check if auto-attack is enabled
     */
    public isAutoAttackEnabled(): boolean {
        return this.autoAttackEnabled;
    }

    /**
     * Get current combat state
     */
    public getCombatState(): 'moving' | 'detecting' | 'engaging' | 'attacking' {
        return this.combatState;
    }

    /**
     * Set combat state
     */
    public setCombatState(state: 'moving' | 'detecting' | 'engaging' | 'attacking'): void {
        this.combatState = state;
    }

    /**
     * Get original destination
     */
    public getOriginalDestination(): Vector3 | null {
        return this.originalDestination;
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
            return false;
        }

        // Calculate energy cost based on target type and distance
        const energyCost = this.calculateAttackEnergyCost(target, distance);
        if (this.energyStorage.getCurrentEnergy() < energyCost) {
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

        // Calculate actual damage (base damage + experience bonus)
        const experienceBonus = Math.floor(this.combatExperience / 10);
        const actualDamage = Math.max(1, this.attackDamage + experienceBonus);

        // Gain combat experience
        this.combatExperience += 1;

        // Apply damage to target
        const targetDestroyed = target.takeDamage(actualDamage);
        
        if (targetDestroyed) {
            this.exitCombat();
        }

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
            return true;
        }

        const activationCost = 2.0; // 2 energy to activate shield
        if (this.energyStorage.getCurrentEnergy() < activationCost) {
            return false;
        }

        // Consume energy for shield activation
        if (!this.energyStorage.removeEnergy(activationCost, 'shield_activation')) {
            return false;
        }

        this.shieldActive = true;
        this.shieldStrength = this.maxShieldStrength;
        this.lastActionTime = performance.now();

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
            return false;
        }

        // Consume energy for patrol setup
        if (!this.energyStorage.removeEnergy(patrolCost, 'patrol_setup')) {
            return false;
        }

        // TODO: Implement patrol logic with waypoints

        this.lastActionTime = performance.now();
        return true;
    }

    /**
     * Upgrade attack damage
     */
    public upgradeAttackDamage(bonus: number): void {
        this.attackDamage += bonus;
    }

    /**
     * Upgrade defense rating
     */
    public upgradeDefenseRating(bonus: number): void {
        this.defenseRating += bonus;
    }

    /**
     * Upgrade shield strength
     */
    public upgradeShieldStrength(bonus: number): void {
        this.maxShieldStrength += bonus;
        this.shieldStrength = Math.min(this.shieldStrength + bonus, this.maxShieldStrength);
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
            detectionRange: this.detectionRange,
            defenseRating: this.defenseRating,
            shieldActive: this.shieldActive,
            shieldStrength: this.shieldStrength,
            maxShieldStrength: this.maxShieldStrength,
            combatExperience: this.combatExperience,
            isInCombat: this.isInCombat,
            isPursuing: this.isPursuing,
            currentTarget: this.currentTarget?.id || null,
            combatState: this.combatState,
            autoAttackEnabled: this.autoAttackEnabled,
            originalDestination: this.originalDestination
        };
    }

    /**
     * Set facing target for combat animations
     * The UnitRenderer will use this to rotate the protector towards the target
     */
    public faceTarget(targetPosition: Vector3): void {
        this.facingTargetPosition = targetPosition.clone();
    }

    /**
     * Get the current facing target position
     */
    public getFacingTarget(): Vector3 | null {
        return this.facingTargetPosition;
    }

    /**
     * Clear the facing target
     */
    public clearFacingTarget(): void {
        this.facingTargetPosition = null;
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
        
        // Resume original movement if available (async call, don't wait)
        if (this.originalDestination) {
            this.resumeOriginalMovement().catch(() => {
                // Failed to resume movement
            });
        } else {
            this.combatState = 'moving';
        }
    }

    /**
     * Protector-specific update logic
     */
    public update(deltaTime: number): void {
        super.update(deltaTime);

        // Update shield
        this.updateShield(deltaTime);

        // Auto-detection during movement
        if (this.combatState === 'moving' && this.autoAttackEnabled && this.currentMovementAction) {
            this.updateAutoDetection();
        }

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
     * Update auto-detection during movement
     */
    private updateAutoDetection(): void {
        // Detect nearby enemies
        const nearbyEnemies = this.detectNearbyEnemies();
        
        if (nearbyEnemies.length > 0) {
            // Prioritize closest enemy
            const closestEnemy = this.prioritizeTargets(nearbyEnemies);
            
            if (closestEnemy) {
                // Automatically engage the detected enemy
                this.autoEngageTarget(closestEnemy);
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

        // Clear movement-based auto-attack state
        this.originalDestination = null;
        this.combatState = 'moving';
        this.autoAttackEnabled = false;

        super.dispose();
    }
}
