/**
 * CombatSystem - Central combat coordinator for all combat actions
 *
 * Manages combat actions between Protector units and enemy targets including
 * Energy Parasites and AI opponent units. Handles target validation, range
 * checking, energy costs, and combat state management.
 */

import { Vector3, Scene } from '@babylonjs/core';
import { Protector } from './entities/Protector';
import { EnergyParasite } from './entities/EnergyParasite';
import { EnergyManager } from './EnergyManager';
import { CombatEffects } from '../rendering/CombatEffects';

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
    protectorDetectionRange: number; // 10 units - auto-detection range
    protectorAttackRange: number; // 8 units - attack range
    attackEnergyCost: number; // 5 energy per attack
    attackCooldown: number; // 1000ms between attacks
    parasiteReward: number; // 10 energy for destroying parasite
    aiUnitRewards: {
        worker: number; // 15 energy
        scout: number; // 12 energy
        protector: number; // 20 energy
    };
    autoAttackEnabled: boolean; // Global auto-attack toggle
}

/**
 * Combat performance metrics for monitoring system performance during combat
 */
export interface CombatPerformanceMetrics {
    activeCombatCount: number;
    attacksPerSecond: number;
    averageAttackProcessingTime: number; // milliseconds
    targetValidationsPerSecond: number;
    combatStateCleanups: number;
    lastUpdateTime: number;
    frameTimeImpact: number; // milliseconds added to frame time
}

/**
 * CombatAction - Represents an ongoing combat action between a protector and target
 *
 * Combat phases:
 * 1. detecting - Enemy detected, starting engagement
 * 2. turning - Rotating to face the target
 * 3. firing - Executing the laser attack
 * 4. cooldown - Waiting before next attack cycle
 */
export class CombatAction {
    public protectorId: string;
    public targetId: string;
    public state: 'moving' | 'detecting' | 'turning' | 'firing' | 'cooldown' | 'engaging' | 'resuming_movement' | 'completed';
    public startTime: number;
    public lastAttackTime: number;
    public phaseStartTime: number; // When current phase started
    public originalDestination: Vector3 | null;
    public detectionTriggered: boolean;

    // Phase durations (ms)
    public static readonly TURN_DURATION = 300; // Time to turn towards target
    public static readonly FIRE_DURATION = 250; // Laser beam duration
    public static readonly COOLDOWN_DURATION = 1000; // Wait before next detection

    constructor(protectorId: string, targetId: string, originalDestination?: Vector3) {
        this.protectorId = protectorId;
        this.targetId = targetId;
        this.state = 'detecting';
        this.startTime = performance.now();
        this.phaseStartTime = performance.now();
        this.lastAttackTime = 0;
        this.originalDestination = originalDestination || null;
        this.detectionTriggered = false;
    }

    /**
     * Update combat action state and reset phase timer
     */
    public setState(newState: 'moving' | 'detecting' | 'turning' | 'firing' | 'cooldown' | 'engaging' | 'resuming_movement' | 'completed'): void {
        this.state = newState;
        this.phaseStartTime = performance.now();
    }

    /**
     * Get time elapsed in current phase (ms)
     */
    public getPhaseElapsed(): number {
        return performance.now() - this.phaseStartTime;
    }

    /**
     * Record attack execution
     */
    public recordAttack(): void {
        this.lastAttackTime = performance.now();
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
    private scene: Scene | null = null;
    private energyManager: EnergyManager;
    private combatEffects: CombatEffects | null = null;
    private activeCombats: Map<string, CombatAction> = new Map();
    private protectorRegistry: Map<string, Protector> = new Map();
    private lastCleanupTime: number = 0;
    
    // Performance monitoring
    private performanceMetrics: CombatPerformanceMetrics = {
        activeCombatCount: 0,
        attacksPerSecond: 0,
        averageAttackProcessingTime: 0,
        targetValidationsPerSecond: 0,
        combatStateCleanups: 0,
        lastUpdateTime: 0,
        frameTimeImpact: 0
    };
    private attackTimings: number[] = [];
    private validationTimings: number[] = [];
    private lastMetricsReset: number = 0;
    private metricsResetInterval: number = 5000; // Reset metrics every 5 seconds
    
    // Combat configuration
    private config: CombatConfig = {
        protectorDetectionRange: 10, // 10 units - auto-detection range
        protectorAttackRange: 8, // 8 units - attack range
        attackEnergyCost: 1,
        attackCooldown: 1000,
        parasiteReward: 10,
        aiUnitRewards: {
            worker: 15,
            scout: 12,
            protector: 20
        },
        autoAttackEnabled: true // Global auto-attack toggle
    };

    constructor(energyManager: EnergyManager, scene?: Scene) {
        this.energyManager = energyManager;
        if (scene) {
            this.scene = scene;
            this.combatEffects = new CombatEffects(scene);
        }
    }

    /**
     * Set scene for visual effects (can be called after construction)
     */
    public setScene(scene: Scene): void {
        this.scene = scene;
        if (!this.combatEffects) {
            this.combatEffects = new CombatEffects(scene);
        }
    }

    /**
     * Create laser beam effects from both guns to target
     */
    private createAttackEffect(attackerPos: Vector3, targetPos: Vector3): void {
        if (!this.combatEffects) return;

        // Calculate direction to target for gun offset
        const direction = targetPos.subtract(attackerPos).normalize();

        // Calculate perpendicular direction (left/right offset)
        const perpendicular = new Vector3(-direction.z, 0, direction.x).normalize();

        // Gun parameters (matching UnitRenderer protector mesh)
        const gunHeight = 0.4; // Height of guns from ground
        const gunSideOffset = 0.35; // Distance from center to each gun
        const gunForwardOffset = 0.1; // Guns slightly forward

        // Calculate left gun position
        const leftGunPos = attackerPos.clone()
            .add(new Vector3(0, gunHeight, 0))
            .add(perpendicular.scale(gunSideOffset))
            .add(direction.scale(gunForwardOffset));

        // Calculate right gun position
        const rightGunPos = attackerPos.clone()
            .add(new Vector3(0, gunHeight, 0))
            .add(perpendicular.scale(-gunSideOffset))
            .add(direction.scale(gunForwardOffset));

        // Target position (slightly above ground)
        const targetHitPos = targetPos.clone().add(new Vector3(0, 0.5, 0));

        // Create left gun laser
        this.combatEffects.createEnergyBeam({
            scene: this.scene!,
            startPosition: leftGunPos,
            endPosition: targetHitPos,
            duration: 250,
            width: 0.08
        });

        // Create right gun laser (slight delay for visual effect)
        setTimeout(() => {
            if (this.combatEffects) {
                this.combatEffects.createEnergyBeam({
                    scene: this.scene!,
                    startPosition: rightGunPos,
                    endPosition: targetHitPos,
                    duration: 250,
                    width: 0.08
                });
            }
        }, 50);
    }

    /**
     * Create explosion effect when target is destroyed
     */
    private createDestructionEffect(position: Vector3): void {
        if (!this.combatEffects) return;

        this.combatEffects.createDestructionEffect({
            scene: this.scene!,
            position: position.clone(),
            targetSize: 1.5,
            explosionType: 'small',
            duration: 1500
        });
    }

    /**
     * Register a protector with the combat system
     */
    public registerProtector(protector: Protector): void {
        this.protectorRegistry.set(protector.getId(), protector);
    }

    /**
     * Unregister a protector from the combat system
     */
    public unregisterProtector(protectorId: string): void {
        this.protectorRegistry.delete(protectorId);
        // Also clean up any combat actions involving this protector
        this.handleProtectorDestruction(protectorId);
    }

    /**
     * Get protector instance by ID
     */
    private getProtectorById(protectorId: string): Protector | null {
        return this.protectorRegistry.get(protectorId) || null;
    }

    /**
     * Initiate an attack action between a protector and target
     */
    public initiateAttack(protector: Protector, target: CombatTarget): boolean {
        // Validate the attack
        const validation = this.validateTarget(protector, target);
        if (!validation.isValid) {
            // Show energy shortage feedback if that's the reason
            if (validation.reason === 'insufficient_energy') {
                this.showEnergyShortageUI(protector.getId(), validation.requiredEnergy || this.config.attackEnergyCost);
            }
            
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
            // In range - start detection phase (will turn, then fire)
            combatAction.setState('detecting');
        } else {
            // Out of range - protector needs to move closer
            combatAction.setState('engaging');
            this.moveProtectorToAttackRange(protector, target);
        }

        return true;
    }

    /**
     * Initiate automatic attack when enemy is detected during movement
     */
    public initiateAutoAttack(protector: Protector, detectedTarget: CombatTarget, originalDestination?: Vector3): boolean {
        if (!this.config.autoAttackEnabled) {
            return false;
        }

        // Validate the target for auto-attack (skip energy check - we check per-shot)
        const targetValidation = this.validateTargetForAutoDetection(detectedTarget);
        if (!targetValidation.isValid) {
            return false;
        }

        // Check if protector is already in combat
        const existingCombat = this.getActiveCombatForProtector(protector.getId());
        if (existingCombat) {
            // Cancel existing combat and start new one
            this.cancelCombat(existingCombat.protectorId, existingCombat.targetId);
        }

        // Create new combat action with original destination for resumption
        const combatId = this.generateCombatId(protector.getId(), detectedTarget.id);
        const combatAction = new CombatAction(protector.getId(), detectedTarget.id, originalDestination);
        combatAction.detectionTriggered = true;
        this.activeCombats.set(combatId, combatAction);

        // Stop current movement to engage target
        protector.stopMovement();

        // Check if target is in combat range
        const distance = Vector3.Distance(protector.getPosition(), detectedTarget.position);
        if (distance <= this.config.protectorAttackRange) {
            // In range - start detection phase (will turn, then fire)
            combatAction.setState('detecting');
        } else {
            // Out of range - move to attack range first
            combatAction.setState('engaging');
            this.moveProtectorToAttackRange(protector, detectedTarget);
        }

        return true;
    }

    /**
     * Detect nearby enemies within detection range
     */
    public detectNearbyEnemies(protector: Protector, detectionRange: number = this.config.protectorDetectionRange): CombatTarget[] {
        const startTime = performance.now();
        const protectorPosition = protector.getPosition();
        const nearbyEnemies: CombatTarget[] = [];

        // Validate detection range (must be larger than combat range for smooth engagement)

        // Get all potential targets from the game world
        const allTargets = this.getAllPotentialTargets();

        for (const target of allTargets) {
            const distance = Vector3.Distance(protectorPosition, target.position);
            
            // Check if target is within detection range
            if (distance <= detectionRange) {
                // Use enhanced validation for auto-detection
                const validation = this.validateTargetForAutoDetection(target);
                if (validation.isValid) {
                    nearbyEnemies.push(target);
                }
            }
        }

        // Record detection timing for performance monitoring
        this.recordValidationTiming(startTime);

        return nearbyEnemies;
    }

    /**
     * Resume movement after combat completion
     */
    public resumeMovementAfterCombat(protector: Protector): void {
        const activeCombat = this.getActiveCombatForProtector(protector.getId());
        
        if (activeCombat && activeCombat.originalDestination) {
            const originalDestination = activeCombat.originalDestination;
            
            // Mark combat as resuming movement
            activeCombat.setState('resuming_movement');
            
            // Check if protector has reached the original destination
            const currentPosition = protector.getPosition();
            const distanceToDestination = Vector3.Distance(currentPosition, originalDestination);
            
            if (distanceToDestination > 1.0) { // 1 unit tolerance
                // Resume movement to original destination
                protector.startMovement(originalDestination);
            } else {
                // Already at destination, complete the combat action
                activeCombat.setState('completed');
            }
        }
    }

    /**
     * Validate if a target is valid for attack
     */
    public validateTarget(protector: Protector, target: CombatTarget): TargetValidation {
        const startTime = performance.now();
        
        // Check for null/undefined inputs
        if (!protector || !target) {
            this.recordValidationTiming(startTime);
            throw new Error('Protector and target must be provided');
        }
        
        // Check for invalid positions (NaN values)
        const protectorPos = protector.getPosition();
        const targetPos = target.position;
        
        if (isNaN(protectorPos.x) || isNaN(protectorPos.y) || isNaN(protectorPos.z) ||
            isNaN(targetPos.x) || isNaN(targetPos.y) || isNaN(targetPos.z)) {
            this.recordValidationTiming(startTime);
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }
        
        // Check if target is a friendly unit (reject friendly units)
        if (this.isFriendlyUnit(target)) {
            this.recordValidationTiming(startTime);
            return {
                isValid: false,
                reason: 'friendly'
            };
        }

        // Check if target is a valid enemy type
        if (!this.isValidEnemyTarget(target)) {
            this.recordValidationTiming(startTime);
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }

        // Check if protector has enough energy using global EnergyManager
        if (!this.energyManager.canConsumeEnergy(protector.getId(), this.config.attackEnergyCost)) {
            this.recordValidationTiming(startTime);
            return {
                isValid: false,
                reason: 'insufficient_energy',
                requiredEnergy: this.config.attackEnergyCost
            };
        }

        // Check range
        const distance = Vector3.Distance(protectorPos, targetPos);
        if (distance > this.config.protectorAttackRange) {
            this.recordValidationTiming(startTime);
            return {
                isValid: false,
                reason: 'out_of_range',
                currentRange: distance,
                maxRange: this.config.protectorAttackRange
            };
        }
        
        this.recordValidationTiming(startTime);
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
        const startTime = performance.now();
        
        // Check if multiple protectors are attacking the same target
        const attackingProtectors = this.getProtectorsAttackingTarget(target.id);
        
        if (attackingProtectors.length > 1) {
            // Multiple protectors attacking - use coordinated damage system
            const protectorInstances = attackingProtectors
                .map(combat => this.getProtectorById(combat.protectorId))
                .filter(p => p !== null) as Protector[];
            
            const result = this.coordinateMultiProtectorDamage(target, protectorInstances);
            this.recordAttackTiming(startTime);
            return result;
        }

        // Single protector attack - use existing logic
        const result: AttackResult = {
            success: false,
            damageDealt: 0,
            targetDestroyed: false,
            energyConsumed: 0,
            energyRewarded: 0
        };

        // Check if protector can attack (cooldown, energy, etc.)
        if (!this.canProtectorAttack(protector)) {
            this.recordAttackTiming(startTime);
            return result;
        }

        // Consume energy for attack using global EnergyManager (5 energy per attack as specified)
        const energyConsumed = this.config.attackEnergyCost;
        if (!this.energyManager.consumeEnergy(protector.getId(), energyConsumed, 'combat_attack')) {
            // Show energy shortage feedback
            this.showEnergyShortageUI(protector.getId(), energyConsumed);
            this.recordAttackTiming(startTime);
            return result;
        }

        result.energyConsumed = energyConsumed;

        // Calculate and apply damage
        const damage = this.calculateDamage(protector, target);

        // Create laser beam visual effect
        this.createAttackEffect(protector.getPosition(), target.position);

        // Make protector face the target
        protector.faceTarget(target.position);

        const targetDestroyed = target.takeDamage(damage);

        result.success = true;
        result.damageDealt = damage;
        result.targetDestroyed = targetDestroyed;

        // Record attack in combat action
        combatAction.recordAttack();

        // Handle target destruction
        if (targetDestroyed) {
            // Create explosion effect
            this.createDestructionEffect(target.position);
            // No energy reward for kills - energy only from mining and power plants

            // Clean up combat action
            this.handleTargetDestruction(target);
            combatAction.setState('completed');
        }

        this.recordAttackTiming(startTime);
        return result;
    }

    /**
     * Get all protectors attacking a specific target
     */
    public getProtectorsAttackingTarget(targetId: string): CombatAction[] {
        const attackingProtectors: CombatAction[] = [];

        for (const combat of this.activeCombats.values()) {
            // Check if in any active combat phase (detecting, turning, firing, cooldown)
            const isInCombat = combat.targetId === targetId &&
                (combat.state === 'detecting' || combat.state === 'turning' ||
                 combat.state === 'firing' || combat.state === 'cooldown');
            if (isInCombat) {
                attackingProtectors.push(combat);
            }
        }

        return attackingProtectors;
    }

    /**
     * Coordinate damage from multiple protectors attacking the same target
     */
    public coordinateMultiProtectorDamage(target: CombatTarget, attackingProtectors: Protector[]): AttackResult {
        const result: AttackResult = {
            success: false,
            damageDealt: 0,
            targetDestroyed: false,
            energyConsumed: 0,
            energyRewarded: 0
        };

        let totalDamage = 0;
        let totalEnergyConsumed = 0;
        const validAttackers: Protector[] = [];

        // Validate all attacking protectors and calculate total damage
        for (const protector of attackingProtectors) {
            if (this.canProtectorAttack(protector)) {
                // Consume energy for this protector's attack
                const energyConsumed = this.config.attackEnergyCost;
                if (this.energyManager.consumeEnergy(protector.getId(), energyConsumed, 'combat_attack')) {
                    const damage = this.calculateDamage(protector, target);
                    totalDamage += damage;
                    totalEnergyConsumed += energyConsumed;
                    validAttackers.push(protector);

                    // Create laser beam visual effect for each attacker
                    this.createAttackEffect(protector.getPosition(), target.position);

                    // Make protector face the target
                    protector.faceTarget(target.position);

                    // Update protector's combat action
                    const combatAction = this.getActiveCombatForProtector(protector.getId());
                    if (combatAction) {
                        combatAction.recordAttack();
                    }
                }
            }
        }

        // If no valid attackers, return failed result
        if (validAttackers.length === 0) {
            return result;
        }

        // Apply accumulated damage to target
        const targetDestroyed = target.takeDamage(totalDamage);

        result.success = true;
        result.damageDealt = totalDamage;
        result.targetDestroyed = targetDestroyed;
        result.energyConsumed = totalEnergyConsumed;

        // Handle target destruction
        if (targetDestroyed) {
            // Create explosion effect
            this.createDestructionEffect(target.position);
            // No energy reward for kills - energy only from mining and power plants

            // Clean up all combat actions targeting this destroyed target
            this.handleTargetDestruction(target);
        }

        return result;
    }

    /**
     * Handle target destruction cleanup
     */
    public handleTargetDestruction(target: CombatTarget): void {
        const { Queen } = require('./entities/Queen');
        const { Hive } = require('./entities/Hive');
        
        // Get all protectors that were attacking this target
        const affectedProtectors: string[] = [];
        
        // Cancel all pending attacks on this target
        const combatsToCancel: string[] = [];
        
        for (const [combatId, combat] of this.activeCombats) {
            if (combat.targetId === target.id) {
                combatsToCancel.push(combatId);
                affectedProtectors.push(combat.protectorId);
            }
        }

        // Remove all combat actions targeting this destroyed target
        for (const combatId of combatsToCancel) {
            this.activeCombats.delete(combatId);
        }

        // Resume movement for affected protectors if they have original destinations
        for (const protectorId of affectedProtectors) {
            const protector = this.getProtectorById(protectorId);
            if (protector) {
                // Clear facing target so protector faces movement direction
                protector.clearFacingTarget();
                this.resumeMovementAfterCombat(protector);
            }
        }

        // Handle specific target types
        if (target instanceof Queen) {
            console.log(`👑 Queen ${target.id} destroyed - territory liberation initiated`);
            // Queen destruction is handled by the Queen itself and TerritoryManager
        } else if (target instanceof Hive) {
            console.log(`🏠 Hive ${target.id} destroyed - Queen elimination triggered`);
            // Hive destruction triggers Queen death, handled by the Hive itself
        } else if (target instanceof EnergyParasite) {
            // Handle parasite destruction
            const gameEngine = require('./GameEngine').GameEngine.getInstance();
            const parasiteManager = gameEngine?.getParasiteManager();
            if (parasiteManager) {
                parasiteManager.handleParasiteDestruction(target.id);
            }
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

        // Remove from protector registry
        this.protectorRegistry.delete(protectorId);
    }

    /**
     * Handle combat interruption scenarios gracefully
     */
    public handleCombatInterruption(protectorId: string, targetId: string, reason: 'out_of_range' | 'energy_depleted' | 'target_invalid' | 'protector_destroyed' | 'target_destroyed'): void {
        const combatId = this.generateCombatId(protectorId, targetId);
        const combat = this.activeCombats.get(combatId);
        
        if (!combat) {
            return; // Combat already cleaned up
        }

        // Mark combat as completed
        combat.setState('completed');

        // Remove from active combats
        this.activeCombats.delete(combatId);
        
        // Handle specific interruption scenarios
        switch (reason) {
            case 'out_of_range':
                // Protector could attempt to move back into range or resume original movement
                const protector = this.getProtectorById(protectorId);
                if (protector) {
                    // Stop current movement and resume original destination if available
                    protector.stopMovement();
                    if (combat.originalDestination) {
                        this.resumeMovementAfterCombat(protector);
                    }
                }
                break;
                
            case 'energy_depleted':
                // Show energy shortage feedback and resume movement if possible
                this.showEnergyShortageUI(protectorId, this.config.attackEnergyCost);
                const protectorForEnergy = this.getProtectorById(protectorId);
                if (protectorForEnergy && combat.originalDestination) {
                    this.resumeMovementAfterCombat(protectorForEnergy);
                }
                break;
                
            case 'target_invalid':
                // Target became invalid (e.g., became friendly) - resume movement
                const protectorForInvalid = this.getProtectorById(protectorId);
                if (protectorForInvalid && combat.originalDestination) {
                    this.resumeMovementAfterCombat(protectorForInvalid);
                }
                break;
                
            case 'protector_destroyed':
                // Already handled by handleProtectorDestruction
                break;
                
            case 'target_destroyed':
                // Already handled by handleTargetDestruction
                break;
        }
    }

    /**
     * Clean up all combat state (emergency cleanup)
     */
    public cleanupAllCombatState(): void {
        const combatCount = this.activeCombats.size;
        
        // Clear all active combats
        this.activeCombats.clear();
        
        // Clear protector registry
        this.protectorRegistry.clear();
    }

    /**
     * Validate and clean up stale combat actions
     */
    public validateAndCleanupStaleCombats(): void {
        const staleCombats: string[] = [];
        const now = performance.now();
        
        for (const [combatId, combat] of this.activeCombats) {
            // Check if combat has been running too long (30 seconds timeout)
            if (now - combat.startTime > 30000) {
                staleCombats.push(combatId);
                continue;
            }
            
            // Check if protector still exists
            const protector = this.getProtectorById(combat.protectorId);
            if (!protector) {
                staleCombats.push(combatId);
                continue;
            }
            
            // Additional validation could be added here
            // (e.g., check if target still exists, if protector is still alive, etc.)
        }
        
        // Remove stale combats
        for (const combatId of staleCombats) {
            this.activeCombats.delete(combatId);
        }
    }

    /**
     * Show energy shortage UI feedback
     */
    private showEnergyShortageUI(protectorId: string, requiredEnergy: number): void {
        const currentEnergy = this.energyManager.getTotalEnergy();
        
        // Create a temporary UI notification for energy shortage
        this.createEnergyShortageNotification(protectorId, requiredEnergy, currentEnergy);
        
        // Also trigger the energy manager's low energy callback
        this.energyManager.onLowEnergy((entityId: string, energy: number) => {
            // This will trigger existing UI warnings in EnergyDisplay
        });
    }

    /**
     * Create temporary energy shortage notification
     */
    private createEnergyShortageNotification(protectorId: string, requiredEnergy: number, currentEnergy: number): void {
        // Create a floating notification element - positioned under energy/mineral bars
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 120px;
            right: 20px;
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 5px;
            font-family: 'Orbitron', monospace;
            font-size: 12px;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 0 15px rgba(255, 0, 0, 0.5);
            border: 2px solid #ff4444;
            text-align: center;
            pointer-events: none;
            animation: energyShortageAlert 2s ease-out forwards;
        `;

        notification.innerHTML = `
            <div>INSUFFICIENT ENERGY</div>
            <div style="font-size: 10px; margin-top: 3px;">
                Need: ${requiredEnergy} | Have: ${Math.round(currentEnergy)}
            </div>
        `;

        // Add CSS animation if not exists
        if (!document.querySelector('#energy-shortage-animation')) {
            const style = document.createElement('style');
            style.id = 'energy-shortage-animation';
            style.textContent = `
                @keyframes energyShortageAlert {
                    0% {
                        opacity: 0;
                        transform: scale(0.8);
                    }
                    20% {
                        opacity: 1;
                        transform: scale(1.05);
                    }
                    40% {
                        transform: scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add to document
        document.body.appendChild(notification);
        
        // Remove after animation completes
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
    }

    /**
     * Update combat system (called from game loop)
     */
    public update(deltaTime: number): void {
        const updateStartTime = performance.now();

        // Update performance metrics
        this.updatePerformanceMetrics();

        // Clean up completed or timed out combat actions
        const combatsToRemove: string[] = [];

        for (const [combatId, combat] of this.activeCombats) {
            if (combat.isCompleted()) {
                combatsToRemove.push(combatId);
            } else {
                // Process combat phases
                this.processCombatPhase(combat);
            }
        }

        // Remove completed combats
        for (const combatId of combatsToRemove) {
            this.activeCombats.delete(combatId);
            this.performanceMetrics.combatStateCleanups++;
        }

        // Periodically validate and cleanup stale combats (every 5 seconds)
        const now = performance.now();
        if (!this.lastCleanupTime || now - this.lastCleanupTime > 5000) {
            this.validateAndCleanupStaleCombats();
            this.lastCleanupTime = now;
        }
        
        // Record frame time impact
        const updateEndTime = performance.now();
        this.performanceMetrics.frameTimeImpact = updateEndTime - updateStartTime;
        this.performanceMetrics.lastUpdateTime = updateEndTime;
        
        // Check for performance issues during combat
        this.checkCombatPerformance();
    }

    /**
     * Update protector facing direction towards current combat target
     */
    private updateProtectorFacing(combat: CombatAction): void {
        const protector = this.getProtectorById(combat.protectorId);
        if (!protector) return;

        // Find the current target position
        const allTargets = this.getAllPotentialTargets();
        const target = allTargets.find(t => t.id === combat.targetId);

        if (target && target.health > 0) {
            // Update facing to track the target's current position
            protector.faceTarget(target.position);
        }
    }

    /**
     * Process combat phases: detecting -> turning -> firing -> cooldown -> loop
     */
    private processCombatPhase(combat: CombatAction): void {
        const protector = this.getProtectorById(combat.protectorId);
        if (!protector) {
            combat.setState('completed');
            return;
        }

        // Find the current target
        const allTargets = this.getAllPotentialTargets();
        const target = allTargets.find(t => t.id === combat.targetId);

        // Check if target is still valid
        if (!target || target.health <= 0) {
            // Target destroyed - look for new targets
            const nearbyEnemies = this.detectNearbyEnemies(protector, this.config.protectorDetectionRange);
            if (nearbyEnemies.length > 0) {
                const newTarget = this.selectTargetConsistently(protector, nearbyEnemies);
                if (newTarget) {
                    combat.targetId = newTarget.id;
                    combat.setState('detecting'); // Start fresh detection cycle
                    return;
                }
            }
            // No more targets - complete combat
            combat.setState('completed');
            protector.clearFacingTarget();
            this.resumeMovementAfterCombat(protector);
            return;
        }

        // Check if still in range
        const distance = Vector3.Distance(protector.getPosition(), target.position);
        if (distance > this.config.protectorAttackRange) {
            combat.setState('engaging');
            this.moveProtectorToAttackRange(protector, target);
            return;
        }

        const phaseElapsed = combat.getPhaseElapsed();

        switch (combat.state) {
            case 'detecting':
                // Phase 1: Detection - immediately transition to turning
                protector.faceTarget(target.position);
                combat.setState('turning');
                break;

            case 'turning':
                // Phase 2: Turning towards target
                protector.faceTarget(target.position);
                if (phaseElapsed >= CombatAction.TURN_DURATION) {
                    // Done turning - fire!
                    combat.setState('firing');
                    this.executeAttackVisuals(protector, target, combat);
                }
                break;

            case 'firing':
                // Phase 3: Firing laser (visuals already triggered)
                if (phaseElapsed >= CombatAction.FIRE_DURATION) {
                    // Laser done - enter cooldown
                    combat.setState('cooldown');
                }
                break;

            case 'cooldown':
                // Phase 4: Cooldown - wait before next detection cycle
                if (phaseElapsed >= CombatAction.COOLDOWN_DURATION) {
                    // Cooldown done - start new detection cycle
                    combat.setState('detecting');
                }
                break;

            case 'engaging':
                // Moving to get in range - check if we've arrived
                if (distance <= this.config.protectorAttackRange) {
                    combat.setState('detecting');
                }
                break;

            default:
                // Other states (moving, resuming_movement, completed) - no action needed
                break;
        }
    }

    /**
     * Execute attack visuals and damage (called during firing phase)
     */
    private executeAttackVisuals(protector: Protector, target: CombatTarget, combat: CombatAction): void {
        // Check if we have enough energy
        if (!this.energyManager.canConsumeEnergy(protector.getId(), this.config.attackEnergyCost)) {
            // Not enough energy - show warning and skip attack
            this.showEnergyShortageUI(protector.getId(), this.config.attackEnergyCost);
            return;
        }

        // Consume energy
        this.energyManager.consumeEnergy(protector.getId(), this.config.attackEnergyCost, 'combat_attack');

        // Create laser beam visual effect
        this.createAttackEffect(protector.getPosition(), target.position);

        // Calculate and apply damage
        const damage = this.calculateDamage(protector, target);
        const targetDestroyed = target.takeDamage(damage);

        // Record the attack
        combat.recordAttack();

        // Handle target destruction
        if (targetDestroyed) {
            this.createDestructionEffect(target.position);
            // No energy reward for kills - energy only from mining and power plants
            this.handleTargetDestruction(target);
        }
    }

    /**
     * Check if a protector can attack (cooldown, energy, etc.)
     */
    private canProtectorAttack(protector: Protector): boolean {
        const protectorStats = protector.getProtectorStats();
        
        // Check global energy using EnergyManager (5 energy per attack as specified)
        if (!this.energyManager.canConsumeEnergy(protector.getId(), this.config.attackEnergyCost)) {
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
     * Check if target is a friendly unit (reject friendly units)
     */
    private isFriendlyUnit(target: CombatTarget): boolean {
        // Import unit classes to check instanceof
        const { Worker } = require('./entities/Worker');
        const { Scout } = require('./entities/Scout');
        const { Protector } = require('./entities/Protector');

        // Check if target is any of our friendly unit types
        return target instanceof Worker || 
               target instanceof Scout || 
               target instanceof Protector;
    }

    /**
     * Check if target is a valid enemy
     */
    private isValidEnemyTarget(target: CombatTarget): boolean {
        // Energy Parasites are valid targets
        if (target instanceof EnergyParasite) {
            return true;
        }

        // Queens are valid targets when vulnerable
        const { Queen } = require('./entities/Queen');
        if (target instanceof Queen) {
            return (target as any).isVulnerable();
        }

        // Hives are valid targets when constructed
        const { Hive } = require('./entities/Hive');
        if (target instanceof Hive) {
            return (target as any).isHiveConstructed();
        }

        // TODO: Add AI unit validation when AI units are implemented
        // For now, accept any target that implements CombatTarget interface
        // but is not a friendly unit
        return target.id !== undefined && 
               target.position !== undefined && 
               typeof target.health === 'number' &&
               !this.isFriendlyUnit(target);
    }

    /**
     * Validate target type only (without range/energy checks)
     */
    private validateTargetType(target: CombatTarget): TargetValidation {
        // Check for null/undefined inputs
        if (!target) {
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }
        
        // Check for invalid positions (NaN values)
        const targetPos = target.position;
        
        if (isNaN(targetPos.x) || isNaN(targetPos.y) || isNaN(targetPos.z)) {
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }
        
        // Check if target is a friendly unit (reject friendly units)
        if (this.isFriendlyUnit(target)) {
            return {
                isValid: false,
                reason: 'friendly'
            };
        }

        // Check if target is a valid enemy type
        if (!this.isValidEnemyTarget(target)) {
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }
        
        return {
            isValid: true,
            reason: 'valid'
        };
    }

    /**
     * Validate target for auto-detection (type and basic checks only)
     * This is used during enemy detection to filter valid targets before prioritization
     */
    public validateTargetForAutoDetection(target: CombatTarget): TargetValidation {
        const startTime = performance.now();
        
        // Use the existing type validation logic
        const validation = this.validateTargetType(target);
        
        // Additional checks specific to auto-detection
        if (validation.isValid) {
            // Check if target is already destroyed
            if (target.health <= 0) {
                this.recordValidationTiming(startTime);
                return {
                    isValid: false,
                    reason: 'invalid_type' // Destroyed targets are invalid
                };
            }

            // Check if target has valid health values
            if (isNaN(target.health) || isNaN(target.maxHealth) || target.maxHealth <= 0) {
                this.recordValidationTiming(startTime);
                return {
                    isValid: false,
                    reason: 'invalid_type'
                };
            }
        }
        
        this.recordValidationTiming(startTime);
        return validation;
    }

    /**
     * Enhanced friendly unit detection for auto-detection
     */
    public isFriendlyUnitForAutoDetection(target: CombatTarget): boolean {
        return this.isFriendlyUnit(target);
    }

    /**
     * Enhanced enemy target validation for auto-detection
     */
    public isValidEnemyTargetForAutoDetection(target: CombatTarget): boolean {
        return this.isValidEnemyTarget(target);
    }

    /**
     * Get all potential targets from the game world
     */
    private getAllPotentialTargets(): CombatTarget[] {
        const targets: CombatTarget[] = [];

        try {
            // Get Energy Parasites from ParasiteManager
            const gameEngine = require('./GameEngine').GameEngine.getInstance();
            const parasiteManager = gameEngine?.getParasiteManager();
            
            if (parasiteManager) {
                const parasites = parasiteManager.getAllParasites();
                targets.push(...parasites);
            }

            // Get Queens and Hives from TerritoryManager
            const territoryManager = gameEngine?.getTerritoryManager();
            if (territoryManager) {
                const territories = territoryManager.getAllTerritories();
                for (const territory of territories) {
                    // Add vulnerable Queens as targets
                    if (territory.queen && territory.queen.isVulnerable()) {
                        targets.push(territory.queen);
                    }
                    
                    // Add constructed Hives as targets
                    if (territory.hive && territory.hive.isHiveConstructed()) {
                        targets.push(territory.hive);
                    }
                }
            }

            // TODO: Add AI units when they are implemented
            // const aiUnitManager = gameEngine?.getAIUnitManager();
            // if (aiUnitManager) {
            //     const aiUnits = aiUnitManager.getAllEnemyUnits();
            //     targets.push(...aiUnits);
            // }

        } catch (error) {
            // Silently handle errors getting targets
        }

        return targets;
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
     * Validate detection range configuration
     */
    public validateDetectionRangeConfig(): {
        isValid: boolean;
        detectionRange: number;
        combatRange: number;
        issues: string[];
    } {
        const issues: string[] = [];
        const detectionRange = this.config.protectorDetectionRange;
        const combatRange = this.config.protectorAttackRange;

        // Detection range should be larger than combat range for smooth engagement
        if (detectionRange <= combatRange) {
            issues.push(`Detection range (${detectionRange}) should be larger than combat range (${combatRange})`);
        }

        // Detection range should be reasonable (not too large to avoid performance issues)
        if (detectionRange > 50) {
            issues.push(`Detection range (${detectionRange}) is very large and may impact performance`);
        }

        // Detection range should be positive
        if (detectionRange <= 0) {
            issues.push(`Detection range (${detectionRange}) must be positive`);
        }

        return {
            isValid: issues.length === 0,
            detectionRange,
            combatRange,
            issues
        };
    }

    /**
     * Update detection range with validation
     */
    public updateDetectionRange(newDetectionRange: number): boolean {
        if (newDetectionRange <= 0) {
            return false;
        }

        this.config.protectorDetectionRange = newDetectionRange;
        return true;
    }

    /**
     * Get detection range for auto-attack
     */
    public getDetectionRange(): number {
        return this.config.protectorDetectionRange;
    }

    /**
     * Check for enemy detection during protector movement
     * This method should be called during protector movement updates
     */
    public checkMovementDetection(protector: Protector): CombatTarget | null {
        if (!this.config.autoAttackEnabled) {
            return null;
        }

        // Only check detection if protector is moving and auto-attack is enabled
        const protectorStats = protector.getProtectorStats();
        if (protectorStats.combatState !== 'moving' || !protectorStats.autoAttackEnabled) {
            return null;
        }

        // Detect nearby enemies
        const nearbyEnemies = this.detectNearbyEnemies(protector, this.config.protectorDetectionRange);
        
        if (nearbyEnemies.length > 0) {
            // Use consistent target selection
            const selectedTarget = this.selectTargetConsistently(protector, nearbyEnemies);
            
            if (selectedTarget) {
                return selectedTarget;
            }
        }

        return null;
    }

    /**
     * Prioritize targets by distance (closest first)
     */
    private prioritizeClosestTarget(protector: Protector, targets: CombatTarget[]): CombatTarget | null {
        if (targets.length === 0) {
            return null;
        }

        const protectorPosition = protector.getPosition();
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
     * Prioritize targets using comprehensive prioritization logic
     * Returns targets sorted by priority (highest priority first)
     */
    public prioritizeTargets(protector: Protector, targets: CombatTarget[]): CombatTarget[] {
        if (targets.length === 0) {
            return [];
        }

        const protectorPosition = protector.getPosition();
        
        // Create priority objects with target and calculated priority score
        const targetPriorities = targets.map(target => {
            const distance = Vector3.Distance(protectorPosition, target.position);
            const priority = this.calculateTargetPriority(target, distance);
            
            return {
                target,
                distance,
                priority,
                id: target.id
            };
        });

        // Sort by priority (highest first), then by distance (closest first) as tiebreaker
        targetPriorities.sort((a, b) => {
            if (Math.abs(a.priority - b.priority) < 0.001) { // Priorities are essentially equal
                return a.distance - b.distance; // Closer target wins
            }
            return b.priority - a.priority; // Higher priority wins
        });

        // Return sorted targets
        return targetPriorities.map(tp => tp.target);
    }

    /**
     * Calculate priority score for a target
     * Higher score = higher priority
     */
    private calculateTargetPriority(target: CombatTarget, distance: number): number {
        let priority = 100; // Base priority

        // Distance factor (closer targets get higher priority)
        const maxDetectionRange = this.config.protectorDetectionRange;
        const distanceFactor = (maxDetectionRange - distance) / maxDetectionRange;
        priority += distanceFactor * 50; // Up to 50 bonus points for proximity

        // Health factor (weaker targets get slightly higher priority for quick elimination)
        const healthRatio = target.health / target.maxHealth;
        const healthFactor = (1 - healthRatio) * 20; // Up to 20 bonus points for low health
        priority += healthFactor;

        // Target type factor
        if (target instanceof EnergyParasite) {
            priority += 30; // Energy Parasites get priority due to energy reward
        }

        // Queen and Hive priority (high-value targets)
        const { Queen } = require('./entities/Queen');
        const { Hive } = require('./entities/Hive');
        
        if (target instanceof Queen) {
            priority += 100; // Queens are highest priority targets
        } else if (target instanceof Hive) {
            priority += 80; // Hives are high priority targets
        }

        // TODO: Add AI unit type priorities when implemented
        // Different AI unit types could have different threat levels

        return priority;
    }

    /**
     * Get the highest priority target from a list
     */
    public getHighestPriorityTarget(protector: Protector, targets: CombatTarget[]): CombatTarget | null {
        const prioritizedTargets = this.prioritizeTargets(protector, targets);
        return prioritizedTargets.length > 0 ? prioritizedTargets[0] : null;
    }

    /**
     * Ensure consistent target selection behavior
     * This method provides deterministic target selection for the same input
     */
    public selectTargetConsistently(protector: Protector, targets: CombatTarget[]): CombatTarget | null {
        if (targets.length === 0) {
            return null;
        }

        if (targets.length === 1) {
            return targets[0];
        }

        // Use prioritization logic
        const prioritizedTargets = this.prioritizeTargets(protector, targets);
        
        // If multiple targets have the same priority, use ID-based tiebreaker for consistency
        const topTarget = prioritizedTargets[0];
        const topPriority = this.calculateTargetPriority(topTarget, Vector3.Distance(protector.getPosition(), topTarget.position));
        
        // Find all targets with the same top priority
        const topPriorityTargets = prioritizedTargets.filter(target => {
            const distance = Vector3.Distance(protector.getPosition(), target.position);
            const priority = this.calculateTargetPriority(target, distance);
            return Math.abs(priority - topPriority) < 0.001;
        });

        if (topPriorityTargets.length === 1) {
            return topPriorityTargets[0];
        }

        // Use lexicographic ID sorting for deterministic selection
        topPriorityTargets.sort((a, b) => a.id.localeCompare(b.id));
        
        return topPriorityTargets[0];
    }

    /**
     * Get combat range for attacks
     */
    public getCombatRange(): number {
        return this.config.protectorAttackRange;
    }

    /**
     * Update combat configuration
     */
    public updateConfig(newConfig: Partial<CombatConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get combat performance metrics
     */
    public getPerformanceMetrics(): CombatPerformanceMetrics {
        return { ...this.performanceMetrics };
    }

    /**
     * Update performance metrics
     */
    private updatePerformanceMetrics(): void {
        const now = performance.now();
        
        // Update active combat count
        this.performanceMetrics.activeCombatCount = this.activeCombats.size;
        
        // Reset metrics every interval
        if (!this.lastMetricsReset || now - this.lastMetricsReset > this.metricsResetInterval) {
            const timeDelta = (now - this.lastMetricsReset) / 1000; // seconds
            
            // Calculate attacks per second
            this.performanceMetrics.attacksPerSecond = this.attackTimings.length / timeDelta;
            
            // Calculate average attack processing time
            if (this.attackTimings.length > 0) {
                const totalTime = this.attackTimings.reduce((sum, time) => sum + time, 0);
                this.performanceMetrics.averageAttackProcessingTime = totalTime / this.attackTimings.length;
            } else {
                this.performanceMetrics.averageAttackProcessingTime = 0;
            }
            
            // Calculate validations per second
            this.performanceMetrics.targetValidationsPerSecond = this.validationTimings.length / timeDelta;
            
            // Reset timing arrays
            this.attackTimings = [];
            this.validationTimings = [];
            this.lastMetricsReset = now;
        }
    }

    /**
     * Record attack timing for performance monitoring
     */
    private recordAttackTiming(startTime: number): void {
        const processingTime = performance.now() - startTime;
        this.attackTimings.push(processingTime);
    }

    /**
     * Record validation timing for performance monitoring
     */
    private recordValidationTiming(startTime: number): void {
        const processingTime = performance.now() - startTime;
        this.validationTimings.push(processingTime);
    }

    /**
     * Check combat performance and warn if issues detected
     */
    private checkCombatPerformance(): void {
        // Performance monitoring without logging
    }

    /**
     * Get combat performance summary for external monitoring
     */
    public getPerformanceSummary(): {
        isPerformingWell: boolean;
        activeCombats: number;
        attacksPerSecond: number;
        averageProcessingTime: number;
        frameImpact: number;
        recommendations: string[];
    } {
        const metrics = this.performanceMetrics;
        const recommendations: string[] = [];
        
        // Determine if performing well
        let isPerformingWell = true;
        
        if (metrics.frameTimeImpact > 5.0) {
            isPerformingWell = false;
            recommendations.push('Reduce number of simultaneous combat actions');
        }
        
        if (metrics.averageAttackProcessingTime > 2.0) {
            isPerformingWell = false;
            recommendations.push('Optimize attack processing logic');
        }
        
        if (metrics.activeCombatCount > 20) {
            isPerformingWell = false;
            recommendations.push('Limit maximum concurrent combat actions');
        }
        
        if (metrics.targetValidationsPerSecond > 100) {
            isPerformingWell = false;
            recommendations.push('Cache target validation results');
        }
        
        return {
            isPerformingWell,
            activeCombats: metrics.activeCombatCount,
            attacksPerSecond: Math.round(metrics.attacksPerSecond * 10) / 10,
            averageProcessingTime: Math.round(metrics.averageAttackProcessingTime * 100) / 100,
            frameImpact: Math.round(metrics.frameTimeImpact * 100) / 100,
            recommendations
        };
    }

    // Enhanced CombatSystem Integration for Queen & Territory System

    /**
     * Validate Queen as combat target
     */
    public validateQueenTarget(protector: Protector, queen: any): TargetValidation {
        const { Queen } = require('./entities/Queen');
        
        if (!(queen instanceof Queen)) {
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }

        // Check if Queen is vulnerable (only during active control phase)
        if (!queen.isVulnerable()) {
            return {
                isValid: false,
                reason: 'invalid_type' // Invulnerable Queens are treated as invalid targets
            };
        }

        // Use standard target validation for range and energy checks
        return this.validateTarget(protector, queen);
    }

    /**
     * Validate Hive as combat target
     */
    public validateHiveTarget(protector: Protector, hive: any): TargetValidation {
        const { Hive } = require('./entities/Hive');
        
        if (!(hive instanceof Hive)) {
            return {
                isValid: false,
                reason: 'invalid_type'
            };
        }

        // Check if Hive is constructed (only constructed hives can be attacked)
        if (!hive.isHiveConstructed()) {
            return {
                isValid: false,
                reason: 'invalid_type' // Unconstructed Hives are treated as invalid targets
            };
        }

        // Use standard target validation for range and energy checks
        return this.validateTarget(protector, hive);
    }

    /**
     * Coordinate multi-protector hive assault
     * Implements difficulty scaling for single vs multiple protectors
     */
    public coordinateHiveAssault(hive: any, protectors: Protector[]): {
        success: boolean;
        totalDamage: number;
        energyConsumed: number;
        assaultDifficulty: 'easy' | 'moderate' | 'hard';
        recommendedProtectors: number;
    } {
        const { Hive } = require('./entities/Hive');
        
        if (!(hive instanceof Hive) || !hive.isHiveConstructed()) {
            return {
                success: false,
                totalDamage: 0,
                energyConsumed: 0,
                assaultDifficulty: 'hard',
                recommendedProtectors: 3
            };
        }

        const protectorCount = protectors.length;
        let assaultDifficulty: 'easy' | 'moderate' | 'hard' = 'hard';
        let recommendedProtectors = 3;

        // Calculate assault difficulty based on protector count and hive defenses
        const defensiveParasites = hive.getActiveDefensiveParasiteCount();
        const hiveHealth = hive.health;
        
        // Difficulty scaling algorithm
        if (protectorCount >= 3) {
            assaultDifficulty = 'easy';
            recommendedProtectors = 3;
        } else if (protectorCount === 2) {
            assaultDifficulty = 'moderate';
            recommendedProtectors = 3;
        } else {
            assaultDifficulty = 'hard';
            recommendedProtectors = Math.max(3, Math.ceil(defensiveParasites / 20));
        }

        // Execute coordinated attack using existing multi-protector damage system
        const attackResult = this.coordinateMultiProtectorDamage(hive, protectors);

        return {
            success: attackResult.success,
            totalDamage: attackResult.damageDealt,
            energyConsumed: attackResult.energyConsumed,
            assaultDifficulty,
            recommendedProtectors
        };
    }

    /**
     * Calculate hive assault damage with difficulty scaling
     */
    public calculateHiveAssaultDamage(hive: any, protectors: Protector[]): number {
        const { Hive } = require('./entities/Hive');
        
        if (!(hive instanceof Hive)) {
            return 0;
        }

        let totalDamage = 0;
        const protectorCount = protectors.length;

        // Calculate base damage from all protectors
        for (const protector of protectors) {
            const baseDamage = this.calculateDamage(protector, hive);
            totalDamage += baseDamage;
        }

        // Apply multi-protector coordination bonus
        if (protectorCount >= 2) {
            const coordinationBonus = Math.min(0.5, (protectorCount - 1) * 0.15); // Up to 50% bonus
            totalDamage *= (1 + coordinationBonus);
        }

        // Apply difficulty scaling - single protectors are less effective against hives
        if (protectorCount === 1) {
            totalDamage *= 0.6; // 40% damage reduction for solo assault
        }

        return Math.floor(totalDamage);
    }

    /**
     * Prioritize targets with territorial awareness
     * Queens and Hives get higher priority, especially in contested territories
     */
    public prioritizeTargetsWithTerritory(protector: Protector, targets: CombatTarget[]): CombatTarget[] {
        if (targets.length === 0) {
            return [];
        }

        const protectorPosition = protector.getPosition();
        const { Queen } = require('./entities/Queen');
        const { Hive } = require('./entities/Hive');
        
        // Create priority objects with enhanced territorial scoring
        const targetPriorities = targets.map(target => {
            const distance = Vector3.Distance(protectorPosition, target.position);
            let priority = this.calculateTargetPriority(target, distance);
            
            // Additional territorial priority bonuses
            if (target instanceof Queen) {
                // Queens in active control phase get maximum priority
                if ((target as any).isVulnerable()) {
                    priority += 150; // Highest priority for vulnerable Queens
                }
            } else if (target instanceof Hive) {
                // Hives get high priority, especially when constructed
                if ((target as any).isHiveConstructed()) {
                    priority += 120; // High priority for constructed Hives
                    
                    // Bonus for hives with many defensive parasites (bigger threat)
                    const defensiveCount = (target as any).getActiveDefensiveParasiteCount();
                    priority += Math.min(30, defensiveCount * 0.5);
                }
            }
            
            return {
                target,
                distance,
                priority,
                id: target.id
            };
        });

        // Sort by priority (highest first), then by distance (closest first) as tiebreaker
        targetPriorities.sort((a, b) => {
            if (Math.abs(a.priority - b.priority) < 0.001) {
                return a.distance - b.distance;
            }
            return b.priority - a.priority;
        });

        return targetPriorities.map(tp => tp.target);
    }

    /**
     * Get defensive priority level for a territory
     * Higher values indicate more dangerous territories requiring more protectors
     */
    public getDefensivePriorityInTerritory(territory: any): number {
        let priority = 0;

        // Base priority for any territory
        priority += 10;

        // Queen presence increases priority significantly
        if (territory.queen) {
            if (territory.queen.isVulnerable()) {
                priority += 50; // High priority for territories with vulnerable Queens
            } else {
                priority += 20; // Medium priority for territories with growing Queens
            }
        }

        // Hive presence increases priority
        if (territory.hive) {
            if (territory.hive.isHiveConstructed()) {
                priority += 40; // High priority for territories with constructed Hives
                
                // Additional priority based on defensive swarm size
                const defensiveCount = territory.hive.getActiveDefensiveParasiteCount();
                priority += Math.min(20, defensiveCount * 0.3);
            } else {
                priority += 15; // Medium priority for territories with constructing Hives
            }
        }

        // Parasite count increases priority
        priority += Math.min(30, territory.parasiteCount * 0.5);

        // Liberation status affects priority
        if (territory.controlStatus === 'liberated') {
            priority -= 30; // Lower priority for liberated territories
        } else if (territory.controlStatus === 'contested') {
            priority += 10; // Slightly higher priority for contested territories
        }

        return Math.max(0, priority);
    }

    /**
     * Dispose combat system
     */
    public dispose(): void {
        this.activeCombats.clear();
    }
}