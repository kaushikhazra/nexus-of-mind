/**
 * CombatParasite - Enhanced parasite that hunts protectors
 * 
 * Combat Parasites are stronger variants that specifically target protectors first,
 * with workers as secondary targets. They have 2x the health of Energy Parasites
 * and distinct visual appearance to enable strategic decision-making.
 */

import { Vector3 } from '@babylonjs/core';
import { EnergyParasite, EnergyParasiteConfig, ParasiteState } from './EnergyParasite';
import { Worker } from './Worker';
import { Protector } from './Protector';
import { ParasiteType, PARASITE_STATS, TARGETING_BEHAVIORS } from '../types/ParasiteTypes';

export interface CombatParasiteConfig extends EnergyParasiteConfig {
    // Combat Parasites use the same base config as Energy Parasites
    // but with different stats and targeting behavior
}

export class CombatParasite extends EnergyParasite {
    // Combat-specific properties
    protected parasiteType: ParasiteType = ParasiteType.COMBAT;
    protected stats = PARASITE_STATS[ParasiteType.COMBAT];
    protected targetingBehavior = TARGETING_BEHAVIORS[ParasiteType.COMBAT];
    
    // Enhanced properties from stats
    public health: number;
    public maxHealth: number;
    protected speed: number;
    protected attackDamage: number;
    protected energyReward: number;
    protected visualScale: number;
    
    // Targeting system
    private targetSwitchCooldown: number;
    private lastTargetSwitchTime: number = 0;
    private availableProtectors: Protector[] = [];
    private availableWorkers: Worker[] = [];
    private combatTarget: Worker | Protector | null = null; // Combat Parasite's own target tracking
    
    // Enhanced aggression and engagement patterns
    private aggressionLevel: number = 0.85; // High aggression for persistent hunting
    private engagementDistance: number = 3.5; // Slightly larger engagement distance
    private retreatThreshold: number = 0.15; // Retreat when health drops below 15%
    private lastAggressionUpdate: number = 0;
    private targetLockDuration: number = 3000; // 3 seconds of target lock for persistence
    private lastTargetLockTime: number = 0; // Track when target was locked

    constructor(config: CombatParasiteConfig) {
        super(config);
        
        // Apply Combat Parasite stats
        this.health = this.stats.health;
        this.maxHealth = this.stats.maxHealth;
        this.speed = this.stats.speed;
        this.attackDamage = this.stats.attackDamage;
        this.energyReward = this.stats.energyReward;
        this.visualScale = this.stats.visualScale;
        this.targetSwitchCooldown = this.targetingBehavior.targetSwitchCooldown;
        
        // Update territory ranges for more aggressive hunting
        this.territoryRadius = this.targetingBehavior.maxTargetDistance;
        
        // Recreate mesh with Combat Parasite appearance
        this.createCombatParasiteMesh();
    }

    /**
     * Create the Combat Parasite mesh with distinct visual appearance
     * 20% larger than Energy Parasites with different material
     */
    private createCombatParasiteMesh(): void {
        if (!this.scene) return;
        
        // Dispose existing mesh components
        if (this.segments && this.segments.length > 0) {
            this.segments.forEach(segment => {
                if (segment) {
                    segment.dispose();
                }
            });
        }
        if (this.parentNode) {
            this.parentNode.dispose();
        }
        
        // Create parent node for click detection
        const { TransformNode } = require('@babylonjs/core');
        this.parentNode = new TransformNode(`combat_parasite_${this.id}`, this.scene);
        if (this.parentNode) {
            this.parentNode.position = this.position.clone();
        }
        
        // Create 4 ring segments with 20% larger scale
        const { MeshBuilder } = require('@babylonjs/core');
        this.segments = [];
        this.segmentPositions = [];
        
        for (let i = 0; i < 4; i++) {
            // Calculate progressively smaller size from head (i=0) to tail (i=3)
            const sizeMultiplier = (1.0 - (i * 0.2)) * this.visualScale; // Apply 20% larger scale
            const ringDiameter = 0.8 * sizeMultiplier;
            const ringThickness = 0.2 * sizeMultiplier;
            
            // Create torus ring with larger size
            const segment = MeshBuilder.CreateTorus(`combat_parasite_segment_${this.id}_${i}`, {
                diameter: ringDiameter,
                thickness: ringThickness,
                tessellation: 8 // Low poly
            }, this.scene);
            
            // Make this segment a child of the parent node for click detection
            segment.parent = this.parentNode;
            
            // Position rings in a line (slightly more spaced due to larger size)
            const segmentPos = new Vector3(0, 0, -i * 0.36); // Increased spacing for larger rings
            segment.position = segmentPos;
            
            // Rotate rings to lay flat (like wheels)
            segment.rotation.x = Math.PI / 2;
            
            this.segments.push(segment);
            // Initialize segment positions in world coordinates for trailing effect
            this.segmentPositions.push(this.position.clone().add(segmentPos));
        }
        
        // Apply distinct Combat Parasite material
        this.material = this.getCombatParasiteMaterial();
        if (this.material) {
            this.segments.forEach(segment => {
                segment.material = this.material;
            });
        }
    }

    /**
     * Get distinct material for Combat Parasites
     * Uses MaterialManager's dedicated Combat Parasite material
     */
    private getCombatParasiteMaterial() {
        return this.materialManager.getCombatParasiteMaterial();
    }

    /**
     * Enhanced update with Combat Parasite targeting logic
     */
    public update(deltaTime: number, nearbyWorkers: Worker[], nearbyProtectors?: Protector[]): void {
        const currentTime = Date.now();

        // Reset movement flag at start of frame
        this.isMoving = false;

        // Update available targets
        this.updateAvailableTargets(nearbyWorkers, nearbyProtectors || []);

        // Update behavior based on current state with Combat Parasite logic
        switch (this.state) {
            case ParasiteState.SPAWNING:
                this.updateSpawning(deltaTime, currentTime);
                break;
            case ParasiteState.PATROLLING:
                this.updateCombatPatrolling(deltaTime);
                break;
            case ParasiteState.HUNTING:
                this.updateCombatHunting(deltaTime);
                break;
            case ParasiteState.FEEDING:
                this.updateCombatFeeding(deltaTime);
                break;
            case ParasiteState.RETURNING:
                this.updateReturning(deltaTime);
                break;
        }
        
        // Update position to follow terrain height
        this.updateTerrainHeight();
        
        // Update segment positions with trailing effect (call parent method)
        this.updateSegmentPositions();
    }

    /**
     * Update segment positions (extracted from parent class logic)
     */
    private updateSegmentPositions(): void {
        if (this.segments && this.segments.length > 0 && this.parentNode) {
            // Update parent node position
            this.parentNode.position = this.position.clone();
            
            const time = Date.now() * 0.002; // Slower wave animation
            const waveSpeed = 1.5; // Slower wave speed
            
            for (let i = 0; i < this.segments.length; i++) {
                if (i === 0) {
                    // Head segment follows the main position (relative to parent at origin)
                    const segmentPos = Vector3.Zero();
                    this.segments[i].position = segmentPos;
                    this.segmentPositions[i] = this.position.clone();
                } else {
                    // Body segments trail behind in the opposite direction of movement
                    const prevSegmentPos = this.segmentPositions[i - 1];
                    
                    // Calculate trailing position based on current facing direction
                    const currentRotation = this.segments[0].rotation.y; // Use head's rotation
                    
                    // Dynamic distance based on movement (inertia effect)
                    const baseDistance = 0.36; // Increased for larger Combat Parasite
                    const currentSpeed = this.speed;
                    const maxSpeed = 3.0;
                    const speedRatio = Math.min(currentSpeed / maxSpeed, 1.0);
                    const inertiaMultiplier = 1.0 + (speedRatio * 0.5);
                    
                    // Add organic squeezing wave effect (subtle)
                    const segmentPhase = i * 0.8; // Phase offset for each segment
                    const squeezeWave = Math.sin(time * waveSpeed + segmentPhase) * 0.15;
                    const squeezeMultiplier = 1.0 + squeezeWave;
                    
                    const trailingDistance = baseDistance * inertiaMultiplier * squeezeMultiplier;
                    
                    // Trail behind the previous segment (opposite to facing direction)
                    const trailOffset = new Vector3(
                        -Math.sin(currentRotation) * trailingDistance,
                        0,
                        -Math.cos(currentRotation) * trailingDistance
                    );
                    
                    // Calculate world position for segment tracking
                    const segmentWorldPos = prevSegmentPos.add(trailOffset);
                    this.segmentPositions[i] = segmentWorldPos;
                    
                    // Convert to local position relative to parent node
                    const segmentLocalPos = segmentWorldPos.subtract(this.position);
                    this.segments[i].position = segmentLocalPos;
                }
            }
        }
    }

    /**
     * Update available targets with protector priority
     */
    private updateAvailableTargets(nearbyWorkers: Worker[], nearbyProtectors: Protector[]): void {
        // Use targeting behavior configuration for range checks
        const maxTargetDistance = this.targetingBehavior.maxTargetDistance;
        
        // Filter protectors in territory that can be targeted
        this.availableProtectors = nearbyProtectors.filter(protector => {
            const distance = Vector3.Distance(protector.getPosition(), this.territoryCenter);
            return distance <= maxTargetDistance && this.canTargetUnit(protector);
        });

        // Filter workers in territory that can be targeted
        this.availableWorkers = nearbyWorkers.filter(worker => {
            const distance = Vector3.Distance(worker.getPosition(), this.territoryCenter);
            return distance <= maxTargetDistance && worker.canBeTargetedByParasites();
        });
    }

    /**
     * Check if a unit can be targeted (enhanced validation for protectors and workers)
     */
    private canTargetUnit(unit: any): boolean {
        // Basic health check
        if (unit.getHealth && unit.getHealth() <= 0) {
            return false;
        }
        
        // Check if unit is within targeting distance
        const distance = Vector3.Distance(unit.getPosition(), this.position);
        if (distance > this.targetingBehavior.maxTargetDistance) {
            return false;
        }
        
        // For protectors, check if they're alive and not in an immune state
        if (this.availableProtectors.includes(unit)) {
            // Additional protector-specific checks can be added here
            return true;
        }
        
        // For workers, use existing targeting logic
        if (this.availableWorkers.includes(unit)) {
            return unit.canBeTargetedByParasites();
        }
        
        return false;
    }

    /**
     * Combat Parasite patrolling with protector-first targeting and enhanced aggression
     */
    private updateCombatPatrolling(deltaTime: number): void {
        // Update aggression level based on nearby threats and health
        this.updateAggressionLevel();
        
        // Priority 1: Target protectors first (primary targets)
        if (this.availableProtectors.length > 0) {
            this.combatTarget = this.selectBestTarget(this.availableProtectors);
            this.currentTarget = this.combatTarget as Worker; // Set parent's target for compatibility
            this.lastTargetLockTime = Date.now(); // Set target lock time
            this.setState(ParasiteState.HUNTING);
            return;
        }

        // Priority 2: Target workers as fallback (secondary targets)
        // Only target workers if aggression level is high enough (prevents passive behavior)
        if (this.availableWorkers.length > 0 && this.aggressionLevel > 0.6) {
            this.combatTarget = this.selectBestTarget(this.availableWorkers);
            this.currentTarget = this.combatTarget as Worker; // Set parent's target for compatibility
            this.lastTargetLockTime = Date.now(); // Set target lock time
            this.setState(ParasiteState.HUNTING);
            return;
        }

        // Enhanced patrolling with more dynamic movement
        this.moveTowards(this.patrolTarget, deltaTime);
        
        // Check if reached patrol target
        if (Vector3.Distance(this.position, this.patrolTarget) < 1.5) { // Slightly larger threshold
            this.patrolTarget = this.generateEnhancedPatrolTarget();
        }
    }

    /**
     * Select the best target from available targets (closest first)
     */
    private selectBestTarget(targets: any[]): any {
        if (targets.length === 0) {
            return null;
        }

        let closestTarget = targets[0];
        let closestDistance = Vector3.Distance(this.position, closestTarget.getPosition());

        for (let i = 1; i < targets.length; i++) {
            const distance = Vector3.Distance(this.position, targets[i].getPosition());
            if (distance < closestDistance) {
                closestTarget = targets[i];
                closestDistance = distance;
            }
        }

        return closestTarget;
    }

    /**
     * Combat Parasite hunting with enhanced target switching logic and persistence
     */
    private updateCombatHunting(deltaTime: number): void {
        if (!this.combatTarget) {
            this.setState(ParasiteState.PATROLLING);
            return;
        }

        const currentTime = Date.now();
        const targetPosition = this.combatTarget.getPosition();
        const distanceToTarget = Vector3.Distance(this.position, targetPosition);

        // Enhanced target switching logic with persistence
        if (currentTime - this.lastTargetSwitchTime > this.targetSwitchCooldown) {
            const betterTarget = this.findBetterTargetEnhanced();
            if (betterTarget) {
                this.combatTarget = betterTarget;
                this.currentTarget = betterTarget as Worker; // Update parent's target
                this.lastTargetSwitchTime = currentTime;
            }
        }

        // Check if current target is still valid
        if (!this.isValidTarget(this.combatTarget)) {
            this.combatTarget = null;
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
            return;
        }

        // Enhanced territorial behavior - more persistent pursuit based on aggression
        const pursuitDistance = this.targetingBehavior.pursuitDistance * this.aggressionLevel;
        if (Vector3.Distance(targetPosition, this.territoryCenter) > pursuitDistance) {
            // Don't give up immediately - try to find closer targets first
            const closerTargets = this.findTargetsInTerritory();
            if (closerTargets.length > 0) {
                this.combatTarget = this.selectBestTarget(closerTargets);
                this.currentTarget = this.combatTarget as Worker;
            } else {
                this.combatTarget = null;
                this.currentTarget = null;
                this.setState(ParasiteState.RETURNING);
            }
            return;
        }

        // Check if reached target (enhanced engagement distance)
        if (distanceToTarget <= this.engagementDistance) {
            this.setState(ParasiteState.FEEDING);
            this.feedingStartTime = Date.now();
            return;
        }

        // Enhanced movement with dynamic speed based on aggression and health
        const dynamicSpeed = this.calculateDynamicSpeed();
        this.moveTowardsEnhanced(targetPosition, deltaTime, dynamicSpeed);
    }

    /**
     * Enhanced target switching logic with persistence
     */
    private findBetterTargetEnhanced(): Worker | Protector | null {
        // If currently targeting a worker, check if any protectors are available (higher priority)
        if (this.combatTarget && this.availableWorkers.includes(this.combatTarget as Worker)) {
            if (this.availableProtectors.length > 0) {
                // Switch to protector (higher priority target)
                return this.selectBestTarget(this.availableProtectors);
            }
        }

        // If currently targeting a protector, consider switching based on tactical advantage
        if (this.combatTarget && this.availableProtectors.includes(this.combatTarget as Protector)) {
            // Use target lock duration to prevent excessive switching
            const currentTime = Date.now();
            if (currentTime - this.lastTargetLockTime < this.targetLockDuration) {
                return null; // Stay locked on current target
            }
            
            if (this.availableProtectors.length > 1) {
                // Enhanced target selection considering distance, health, and tactical position
                const bestProtector = this.selectTacticalTarget(this.availableProtectors);
                const currentDistance = Vector3.Distance(this.position, this.combatTarget.getPosition());
                const bestDistance = Vector3.Distance(this.position, bestProtector.getPosition());
                
                // Switch if the new target offers significant tactical advantage
                // Consider distance, but also factor in aggression level
                const distanceThreshold = 8 - (this.aggressionLevel * 3); // More aggressive = smaller threshold
                if (bestDistance < currentDistance - distanceThreshold) {
                    this.lastTargetLockTime = currentTime; // Reset target lock timer
                    return bestProtector;
                }
            }
        }

        return null; // No better target found
    }

    /**
     * Update aggression level based on health, nearby threats, and combat situation
     */
    private updateAggressionLevel(): void {
        const currentTime = Date.now();
        
        // Only update aggression every 500ms to prevent jitter
        if (currentTime - this.lastAggressionUpdate < 500) {
            return;
        }
        
        this.lastAggressionUpdate = currentTime;
        
        // Base aggression starts high but is more balanced
        let newAggression = 0.80; // Slightly reduced from 0.85 for better balance
        
        // Reduce aggression when health is low (tactical retreat)
        const healthRatio = this.health / this.maxHealth;
        if (healthRatio < this.retreatThreshold) {
            newAggression *= 0.4; // Slightly less defensive to maintain engagement
        } else if (healthRatio < 0.5) {
            newAggression *= 0.75; // Less severe reduction
        }
        
        // Increase aggression when multiple targets are available
        const totalTargets = this.availableProtectors.length + this.availableWorkers.length;
        if (totalTargets > 2) {
            newAggression = Math.min(0.95, newAggression * 1.15); // Capped at 0.95 for balance
        }
        
        // Moderate aggression increase when protectors are nearby (primary targets)
        if (this.availableProtectors.length > 0) {
            newAggression = Math.min(0.95, newAggression * 1.08); // Reduced from 1.1
        }
        
        // Enhanced: reduce aggression if target is locked to prevent over-aggressive switching
        if (this.combatTarget && (currentTime - this.lastTargetLockTime) < this.targetLockDuration * 0.5) {
            newAggression *= 0.95; // Slight reduction during target lock
        }
        
        // Smooth aggression changes to prevent erratic behavior
        this.aggressionLevel = this.aggressionLevel * 0.8 + newAggression * 0.2;
    }

    /**
     * Generate enhanced patrol target with more dynamic movement patterns
     */
    private generateEnhancedPatrolTarget(): Vector3 {
        // Enhanced patrol pattern that considers aggression level and nearby threats
        const angle = Math.random() * Math.PI * 2;
        
        // Balanced patrol distance - not too aggressive, maintains territory consistency
        const maxDistance = this.territoryRadius * (0.65 + this.aggressionLevel * 0.25); // More conservative range
        const distance = Math.random() * maxDistance;
        
        const offset = new Vector3(
            Math.cos(angle) * distance,
            0,
            Math.sin(angle) * distance
        );
        
        return this.territoryCenter.add(offset);
    }

    /**
     * Calculate dynamic speed based on aggression, health, and combat situation
     */
    private calculateDynamicSpeed(): number {
        let dynamicSpeed = this.speed;
        
        // Increase speed when highly aggressive (more responsive hunting)
        dynamicSpeed *= (0.85 + this.aggressionLevel * 0.3); // Reduced speed variance for better balance
        
        // Reduce speed when injured (tactical caution)
        const healthRatio = this.health / this.maxHealth;
        if (healthRatio < 0.5) {
            dynamicSpeed *= (0.7 + healthRatio * 0.3); // Less severe speed reduction
        }
        
        // Moderate speed increase when pursuing high-priority targets (protectors)
        if (this.combatTarget && this.availableProtectors.includes(this.combatTarget as Protector)) {
            dynamicSpeed *= 1.1; // Reduced from 1.15 for better balance
        }
        
        // Enhanced speed balancing: consider distance to target
        if (this.combatTarget) {
            const distanceToTarget = Vector3.Distance(this.position, this.combatTarget.getPosition());
            const maxDistance = this.targetingBehavior.maxTargetDistance;
            const distanceRatio = distanceToTarget / maxDistance;
            
            // Increase speed when target is far away, decrease when close for better engagement
            const distanceSpeedModifier = 0.9 + (distanceRatio * 0.2); // 0.9x to 1.1x based on distance
            dynamicSpeed *= distanceSpeedModifier;
        }
        
        return Math.max(1.8, Math.min(3.5, dynamicSpeed)); // Tightened speed range for better balance
    }

    /**
     * Enhanced movement with dynamic speed and improved pathfinding
     */
    private moveTowardsEnhanced(target: Vector3, deltaTime: number, dynamicSpeed: number): void {
        const direction = target.subtract(this.position).normalize();
        const movement = direction.scale(dynamicSpeed * deltaTime);
        
        // Track that we're moving
        this.isMoving = movement.length() > 0.01;
        
        // Enhanced facing calculation with smoother rotation
        if (this.isMoving) {
            const facingAngle = Math.atan2(direction.x, direction.z);
            
            // Apply rotation to all segments with smoother interpolation
            if (this.segments && this.segments.length > 0) {
                this.segments.forEach((segment, index) => {
                    // Smooth rotation interpolation for more organic movement
                    const currentRotation = segment.rotation.y;
                    const rotationDiff = facingAngle - currentRotation;
                    
                    // Normalize rotation difference to [-π, π]
                    let normalizedDiff = rotationDiff;
                    while (normalizedDiff > Math.PI) normalizedDiff -= 2 * Math.PI;
                    while (normalizedDiff < -Math.PI) normalizedDiff += 2 * Math.PI;
                    
                    // Apply smooth rotation (faster for head, slower for tail)
                    const rotationSpeed = 8.0 - (index * 1.5); // Head rotates faster
                    const maxRotationChange = rotationSpeed * deltaTime;
                    const rotationChange = Math.sign(normalizedDiff) * Math.min(Math.abs(normalizedDiff), maxRotationChange);
                    
                    segment.rotation.y = currentRotation + rotationChange;
                    segment.rotation.x = Math.PI / 2; // Keep ring orientation
                });
            }
        }
        
        this.position.addInPlace(movement);
    }

    /**
     * Select tactical target considering combat advantages
     */
    private selectTacticalTarget(targets: any[]): any {
        if (targets.length === 0) {
            return null;
        }

        let bestTarget = targets[0];
        let bestScore = this.calculateTargetScore(bestTarget);

        for (let i = 1; i < targets.length; i++) {
            const score = this.calculateTargetScore(targets[i]);
            if (score > bestScore) {
                bestTarget = targets[i];
                bestScore = score;
            }
        }

        return bestTarget;
    }

    /**
     * Calculate tactical score for target selection
     */
    private calculateTargetScore(target: any): number {
        const distance = Vector3.Distance(this.position, target.getPosition());
        const maxDistance = this.targetingBehavior.maxTargetDistance;
        
        // Base score favors closer targets
        let score = (maxDistance - distance) / maxDistance;
        
        // Bonus for protectors (primary targets)
        if (this.availableProtectors.includes(target)) {
            score += 0.5;
        }
        
        // Bonus for targets with lower health (if available)
        if (target.getHealth && target.getMaxHealth) {
            const healthRatio = target.getHealth() / target.getMaxHealth();
            score += (1.0 - healthRatio) * 0.3; // Prefer damaged targets
        }
        
        return score;
    }

    /**
     * Find all valid targets within territory
     */
    private findTargetsInTerritory(): any[] {
        const allTargets = [...this.availableProtectors, ...this.availableWorkers];
        return allTargets.filter(target => {
            const distance = Vector3.Distance(target.getPosition(), this.territoryCenter);
            return distance <= this.territoryRadius;
        });
    }

    /**
     * Check if a target is still valid for targeting
     */
    private isValidTarget(target: any): boolean {
        if (!target) {
            return false;
        }

        // Check if target is a protector
        if (this.availableProtectors.includes(target)) {
            return this.canTargetUnit(target);
        }

        // Check if target is a worker
        if (this.availableWorkers.includes(target)) {
            return target.canBeTargetedByParasites();
        }

        return false;
    }

    /**
     * Combat Parasite feeding/attacking behavior with enhanced coordination
     */
    private updateCombatFeeding(deltaTime: number): void {
        if (!this.combatTarget) {
            this.setState(ParasiteState.PATROLLING);
            return;
        }

        const targetPosition = this.combatTarget.getPosition();
        const distanceToTarget = Vector3.Distance(this.position, targetPosition);

        // Enhanced engagement distance check
        if (distanceToTarget > this.engagementDistance + 1.5) {
            this.combatTarget = null;
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
            return;
        }

        // Different behavior based on target type with enhanced coordination
        if (this.availableProtectors.includes(this.combatTarget as Protector)) {
            this.attackProtectorEnhanced(this.combatTarget as Protector, deltaTime);
        } else if (this.availableWorkers.includes(this.combatTarget as Worker)) {
            this.drainWorkerEnergyEnhanced(this.combatTarget as Worker, deltaTime);
        }

        // Create/update visual effect
        this.updateDrainBeam(targetPosition);
    }

    /**
     * Enhanced protector attack with improved damage coordination
     */
    private attackProtectorEnhanced(protector: Protector, deltaTime: number): void {
        // Enhanced damage calculation with coordination consideration
        const baseDamagePerSecond = this.attackDamage;
        
        // Coordinate damage to prevent overkill when multiple Combat Parasites attack same target
        // This addresses requirement 4.4: coordinate damage properly
        const protectorHealth = protector.getHealth();
        const estimatedDamageThisFrame = baseDamagePerSecond * deltaTime;
        
        // Apply damage with coordination logic
        let actualDamage = estimatedDamageThisFrame;
        
        // Enhanced coordination: reduce damage if target is nearly dead to prevent overkill
        // This allows multiple parasites to share kills more effectively
        const healthThreshold = estimatedDamageThisFrame * 3; // 3 frames worth of damage
        if (protectorHealth <= healthThreshold) {
            // Scale damage down based on remaining health to allow other parasites to contribute
            const healthRatio = protectorHealth / healthThreshold;
            actualDamage = estimatedDamageThisFrame * Math.max(0.3, healthRatio); // Minimum 30% damage
        }
        
        // Apply coordinated damage to protector
        protector.takeDamage(actualDamage);
        
        // Update last feed time to prevent starvation
        this.lastFeedTime = Date.now();
        
        // Check if protector is destroyed
        if (protector.getHealth() <= 0) {
            this.combatTarget = null;
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
        }
    }

    /**
     * Enhanced worker energy drain with improved efficiency
     */
    private drainWorkerEnergyEnhanced(worker: Worker, deltaTime: number): void {
        // Enhanced energy drain rate based on aggression level
        const enhancedDrainRate = this.drainRate * (0.8 + this.aggressionLevel * 0.4);
        const energyDrained = enhancedDrainRate * deltaTime;
        const actualDrained = worker.drainEnergy(energyDrained, 'combat_parasite_feeding');
        
        if (actualDrained > 0) {
            this.lastFeedTime = Date.now();
        }
        
        // Enhanced worker flee logic with better threshold
        const workerEnergy = worker.getEnergyStorage().getCurrentEnergy();
        const workerMaxEnergy = worker.getEnergyStorage().getCapacity();
        const fleeThreshold = 0.35 + (this.aggressionLevel * 0.1); // More aggressive = higher flee threshold
        
        if (workerEnergy < workerMaxEnergy * fleeThreshold) {
            worker.fleeFromDanger(this.position, 30); // Increased flee distance
            this.combatTarget = null;
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
        }
    }

    /**
     * Get Combat Parasite type
     */
    public getParasiteType(): ParasiteType {
        return this.parasiteType;
    }

    /**
     * Get energy reward for killing this Combat Parasite
     */
    public getEnergyReward(): number {
        return this.energyReward;
    }

    /**
     * Override takeDamage to use Combat Parasite health values
     */
    public takeDamage(damage: number): boolean {
        this.health -= damage;

        if (this.health <= 0) {
            // Combat Parasite destroyed - ParasiteManager will handle respawn
            return true;
        }

        return false; // Still alive
    }

    /**
     * Respawn with Combat Parasite stats
     */
    public respawn(newPosition: Vector3): void {
        // Reset health to Combat Parasite values
        this.health = this.stats.maxHealth;
        this.maxHealth = this.stats.maxHealth;

        // Call parent respawn logic
        super.respawn(newPosition);

        // Recreate Combat Parasite mesh at new position
        this.createCombatParasiteMesh();
    }

    /**
     * Get Combat Parasite specific stats including enhanced behavioral parameters
     */
    public getCombatParasiteStats(): any {
        const baseStats = {
            id: this.id,
            position: this.position,
            health: this.health,
            maxHealth: this.maxHealth,
            state: this.state,
            territoryCenter: this.territoryCenter,
            territoryRadius: this.territoryRadius
        };

        return {
            ...baseStats,
            parasiteType: this.parasiteType,
            attackDamage: this.attackDamage,
            energyReward: this.energyReward,
            visualScale: this.visualScale,
            targetingBehavior: this.targetingBehavior,
            availableProtectors: this.availableProtectors.length,
            availableWorkers: this.availableWorkers.length,
            currentTargetType: this.combatTarget ? 
                (this.availableProtectors.includes(this.combatTarget as Protector) ? 'protector' : 'worker') : 
                null,
            // Enhanced behavioral stats
            aggressionLevel: this.aggressionLevel,
            engagementDistance: this.engagementDistance,
            retreatThreshold: this.retreatThreshold,
            dynamicSpeed: this.calculateDynamicSpeed(),
            healthRatio: this.health / this.maxHealth
        };
    }
}