/**
 * CombatParasite - Enhanced parasite that hunts protectors
 *
 * Combat Parasites are stronger variants that:
 * - Target protectors first, workers second
 * - Have 2x the health of Energy Parasites (4 hits)
 * - Have distinct visual appearance (6 rings, 2 larger at front, red color)
 * - Display enhanced aggression behavior
 *
 * Extends the base Parasite class with protector-targeting behavior.
 */

import { Vector3, Color3, TransformNode, MeshBuilder, Mesh } from '@babylonjs/core';
import { Parasite, ParasiteConfig, ParasiteState, TargetType } from './Parasite';
import { MaterialManager } from '../../rendering/MaterialManager';
import { Worker } from './Worker';
import { Protector } from './Protector';
import { MineralDeposit } from '../../world/MineralDeposit';
import { ParasiteType, PARASITE_STATS, TARGETING_BEHAVIORS } from '../types/ParasiteTypes';

export interface CombatParasiteConfig extends ParasiteConfig {
    materialManager: MaterialManager;
    homeDeposit: MineralDeposit;
}

export class CombatParasite extends Parasite {
    // Combat-specific properties
    protected parasiteType: ParasiteType = ParasiteType.COMBAT;
    protected stats = PARASITE_STATS[ParasiteType.COMBAT];
    protected targetingBehavior = TARGETING_BEHAVIORS[ParasiteType.COMBAT];

    // Home deposit reference
    protected homeDeposit: MineralDeposit;

    // Enhanced combat properties
    protected attackDamage: number;
    protected energyReward: number;
    protected visualScale: number;

    // Targeting system
    private targetSwitchCooldown: number;
    private lastTargetSwitchTime: number = 0;
    private availableProtectors: Protector[] = [];
    private availableWorkers: Worker[] = [];
    private combatTarget: Worker | Protector | null = null;

    // Enhanced aggression
    private aggressionLevel: number = 0.85;
    private engagementDistance: number = 3.5;
    private retreatThreshold: number = 0.15;
    private lastAggressionUpdate: number = 0;
    private targetLockDuration: number = 3000;
    private lastTargetLockTime: number = 0;

    // Feeding behavior (inherited pattern)
    protected drainRate: number = 3;
    protected feedingStartTime: number = 0;
    protected lastFeedTime: number = 0;
    protected drainBeam: any | null = null;

    // For compatibility with EnergyParasite patterns
    protected currentTarget: Worker | null = null;

    constructor(config: CombatParasiteConfig) {
        super(config);

        this.homeDeposit = config.homeDeposit;
        this.materialManager = config.materialManager;

        // Apply Combat Parasite stats
        this.health = this.stats.health;
        this.maxHealth = this.stats.maxHealth;
        this.speed = this.stats.speed;
        this.attackDamage = this.stats.attackDamage;
        this.energyReward = this.stats.energyReward;
        this.visualScale = this.stats.visualScale;
        this.targetSwitchCooldown = this.targetingBehavior.targetSwitchCooldown;

        // Update territory ranges for aggressive hunting
        this.territoryRadius = this.targetingBehavior.maxTargetDistance;

        this.lastFeedTime = this.spawnTime;

        // Create combat parasite mesh
        this.createCombatParasiteMesh();
    }

    // ==================== Abstract Method Implementations ====================

    /**
     * Combat Parasites are red colored
     */
    public getColor(): Color3 {
        return new Color3(0.9, 0.2, 0.2); // Red
    }

    /**
     * Combat Parasites target protectors first, then workers
     */
    public getTargetPriority(): TargetType[] {
        return [TargetType.PROTECTOR, TargetType.WORKER];
    }

    // ==================== Segment Configuration ====================

    protected getSegmentCount(): number {
        return 6;
    }

    protected getSegmentSpacing(): number {
        return 0.36;
    }

    protected getSegmentSizeMultiplier(index: number): number {
        if (index < 2) {
            // First 2 rings are larger (attack formation)
            return 1.2 - (index * 0.1);
        } else {
            // Remaining rings taper down
            return 1.0 - ((index - 2) * 0.2);
        }
    }

    // ==================== Custom Mesh Creation ====================

    /**
     * Create Combat Parasite mesh with 6 rings, 2 larger at front
     */
    private createCombatParasiteMesh(): void {
        if (!this.scene) return;

        // Dispose existing mesh
        if (this.segments && this.segments.length > 0) {
            this.segments.forEach(segment => segment?.dispose());
        }
        if (this.parentNode) {
            this.parentNode.dispose();
        }

        // Create parent node
        this.parentNode = new TransformNode(`combat_parasite_${this.id}`, this.scene);
        this.parentNode.position = this.position.clone();

        // Create segments
        this.segments = [];
        this.segmentPositions = [];

        for (let i = 0; i < 6; i++) {
            let sizeMultiplier: number;
            let zPosition: number;

            if (i < 2) {
                sizeMultiplier = 1.2 - (i * 0.1);
                zPosition = -i * 0.35;
            } else {
                sizeMultiplier = 1.0 - ((i - 2) * 0.2);
                zPosition = -0.7 - ((i - 2) * 0.28);
            }

            const ringDiameter = 0.8 * sizeMultiplier;
            const ringThickness = 0.2 * sizeMultiplier;

            const segment = MeshBuilder.CreateTorus(`combat_parasite_segment_${this.id}_${i}`, {
                diameter: ringDiameter,
                thickness: ringThickness,
                tessellation: 8
            }, this.scene);

            segment.parent = this.parentNode;
            segment.position = new Vector3(0, 0, zPosition);
            segment.rotation.x = Math.PI / 2;

            this.segments.push(segment);
            this.segmentPositions.push(this.position.clone().add(segment.position));
        }

        // Apply materials
        this.applyCombatMaterials();
    }

    /**
     * Apply alternating combat parasite materials
     */
    private applyCombatMaterials(): void {
        if (!this.materialManager) return;

        const mainMaterial = this.materialManager.getCombatParasiteMaterial?.() || null;
        const altMaterial = this.materialManager.getCombatParasiteAltMaterial?.() || mainMaterial;

        if (mainMaterial) {
            this.segments.forEach((segment, index) => {
                segment.material = (index % 2 === 1) ? altMaterial : mainMaterial;
            });
        }
    }

    // ==================== Update Loop ====================

    /**
     * Enhanced update with combat targeting logic
     */
    public update(deltaTime: number, nearbyWorkers: Worker[], nearbyProtectors?: Protector[]): void {
        this.isMoving = false;

        // Update available targets
        this.updateAvailableTargets(nearbyWorkers, nearbyProtectors || []);

        // Update behavior based on state
        switch (this.state) {
            case ParasiteState.SPAWNING:
                this.updateSpawning(deltaTime);
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
    }

    // ==================== State Updates ====================

    private updateSpawning(deltaTime: number): void {
        if (Date.now() - this.lastStateChange > 1000) {
            this.setState(ParasiteState.PATROLLING);
        }
    }

    /**
     * Combat patrolling with protector-first targeting
     */
    private updateCombatPatrolling(deltaTime: number): void {
        this.updateAggressionLevel();

        // Priority 1: Target protectors
        if (this.availableProtectors.length > 0) {
            this.combatTarget = this.selectBestTarget(this.availableProtectors);
            this.currentTarget = this.combatTarget as Worker;
            this.lastTargetLockTime = Date.now();
            this.setState(ParasiteState.HUNTING);
            return;
        }

        // Priority 2: Target workers (if aggression high enough)
        if (this.availableWorkers.length > 0 && this.aggressionLevel > 0.6) {
            this.combatTarget = this.selectBestTarget(this.availableWorkers);
            this.currentTarget = this.combatTarget as Worker;
            this.lastTargetLockTime = Date.now();
            this.setState(ParasiteState.HUNTING);
            return;
        }

        // Continue roaming (use base class smooth movement)
        this.updateRoaming(deltaTime);
    }

    /**
     * Override patrol target generation for aggression-based range
     */
    protected generatePatrolTarget(): Vector3 {
        const angle = Math.random() * Math.PI * 2;
        const maxDist = this.territoryRadius * (0.65 + this.aggressionLevel * 0.25);
        const distance = Math.random() * maxDist;

        return this.territoryCenter.add(new Vector3(
            Math.cos(angle) * distance,
            0,
            Math.sin(angle) * distance
        ));
    }

    /**
     * Combat hunting with enhanced target switching
     */
    private updateCombatHunting(deltaTime: number): void {
        if (!this.combatTarget) {
            this.setState(ParasiteState.PATROLLING);
            return;
        }

        const currentTime = Date.now();
        const targetPosition = this.combatTarget.getPosition();
        const distanceToTarget = Vector3.Distance(this.position, targetPosition);

        // Check for better target
        if (currentTime - this.lastTargetSwitchTime > this.targetSwitchCooldown) {
            const betterTarget = this.findBetterTarget();
            if (betterTarget) {
                this.combatTarget = betterTarget;
                this.currentTarget = betterTarget as Worker;
                this.lastTargetSwitchTime = currentTime;
            }
        }

        // Validate target
        if (!this.isValidTarget(this.combatTarget)) {
            this.combatTarget = null;
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
            return;
        }

        // Check territory bounds
        const pursuitDistance = this.targetingBehavior.pursuitDistance * this.aggressionLevel;
        if (Vector3.Distance(targetPosition, this.territoryCenter) > pursuitDistance) {
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

        // Check engagement range
        if (distanceToTarget <= this.engagementDistance) {
            this.setState(ParasiteState.FEEDING);
            this.feedingStartTime = Date.now();
            return;
        }

        // Move towards target (use base class smooth movement)
        this.moveTowards(targetPosition, deltaTime);
        this.updateTerrainSlope();
        this.updateSegmentAnimation();
    }

    /**
     * Combat feeding/attacking behavior
     */
    private updateCombatFeeding(deltaTime: number): void {
        if (!this.combatTarget) {
            this.setState(ParasiteState.PATROLLING);
            return;
        }

        const targetPosition = this.combatTarget.getPosition();
        const distanceToTarget = Vector3.Distance(this.position, targetPosition);

        if (distanceToTarget > this.engagementDistance + 1.5) {
            this.combatTarget = null;
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
            return;
        }

        // Attack based on target type
        if (this.availableProtectors.includes(this.combatTarget as Protector)) {
            this.attackProtector(this.combatTarget as Protector, deltaTime);
        } else if (this.availableWorkers.includes(this.combatTarget as Worker)) {
            this.drainWorkerEnergy(this.combatTarget as Worker, deltaTime);
        }

        this.updateDrainBeam(targetPosition);

        // Update terrain and animation while feeding
        this.updateTerrainSlope();
        this.updateSegmentAnimation();
    }

    private updateReturning(deltaTime: number): void {
        this.moveTowards(this.territoryCenter, deltaTime);
        this.updateTerrainSlope();
        this.updateSegmentAnimation();

        if (Vector3.Distance(this.position, this.territoryCenter) <= this.territoryRadius * 0.5) {
            this.setState(ParasiteState.PATROLLING);
        }
    }

    // ==================== Targeting System ====================

    private updateAvailableTargets(nearbyWorkers: Worker[], nearbyProtectors: Protector[]): void {
        const maxDistance = this.targetingBehavior.maxTargetDistance;

        this.availableProtectors = nearbyProtectors.filter(p => {
            const distance = Vector3.Distance(p.getPosition(), this.territoryCenter);
            return distance <= maxDistance && this.canTargetUnit(p);
        });

        this.availableWorkers = nearbyWorkers.filter(w => {
            const distance = Vector3.Distance(w.getPosition(), this.territoryCenter);
            return distance <= maxDistance && w.canBeTargetedByParasites();
        });
    }

    private canTargetUnit(unit: any): boolean {
        if (unit.getHealth && unit.getHealth() <= 0) return false;
        const distance = Vector3.Distance(unit.getPosition(), this.position);
        return distance <= this.targetingBehavior.maxTargetDistance;
    }

    private selectBestTarget(targets: any[]): any {
        if (targets.length === 0) return null;

        let closest = targets[0];
        let closestDist = Vector3.Distance(this.position, closest.getPosition());

        for (let i = 1; i < targets.length; i++) {
            const dist = Vector3.Distance(this.position, targets[i].getPosition());
            if (dist < closestDist) {
                closest = targets[i];
                closestDist = dist;
            }
        }
        return closest;
    }

    private findBetterTarget(): Worker | Protector | null {
        // If targeting worker, check for protectors
        if (this.combatTarget && this.availableWorkers.includes(this.combatTarget as Worker)) {
            if (this.availableProtectors.length > 0) {
                return this.selectBestTarget(this.availableProtectors);
            }
        }

        // Check target lock
        if (Date.now() - this.lastTargetLockTime < this.targetLockDuration) {
            return null;
        }

        return null;
    }

    private isValidTarget(target: any): boolean {
        if (!target) return false;
        if (this.availableProtectors.includes(target)) return this.canTargetUnit(target);
        if (this.availableWorkers.includes(target)) return target.canBeTargetedByParasites();
        return false;
    }

    private findTargetsInTerritory(): any[] {
        return [...this.availableProtectors, ...this.availableWorkers].filter(t => {
            return Vector3.Distance(t.getPosition(), this.territoryCenter) <= this.territoryRadius;
        });
    }

    // ==================== Aggression System ====================

    private updateAggressionLevel(): void {
        if (Date.now() - this.lastAggressionUpdate < 500) return;
        this.lastAggressionUpdate = Date.now();

        let newAggression = 0.80;

        const healthRatio = this.health / this.maxHealth;
        if (healthRatio < this.retreatThreshold) {
            newAggression *= 0.4;
        } else if (healthRatio < 0.5) {
            newAggression *= 0.75;
        }

        const totalTargets = this.availableProtectors.length + this.availableWorkers.length;
        if (totalTargets > 2) {
            newAggression = Math.min(0.95, newAggression * 1.15);
        }

        if (this.availableProtectors.length > 0) {
            newAggression = Math.min(0.95, newAggression * 1.08);
        }

        this.aggressionLevel = this.aggressionLevel * 0.8 + newAggression * 0.2;
    }


    // ==================== Combat Actions ====================

    private attackProtector(protector: Protector, deltaTime: number): void {
        const damage = this.attackDamage * deltaTime;

        const health = protector.getHealth();
        const threshold = damage * 3;
        let actualDamage = damage;

        if (health <= threshold) {
            actualDamage = damage * Math.max(0.3, health / threshold);
        }

        protector.takeDamage(actualDamage);
        this.lastFeedTime = Date.now();

        if (protector.getHealth() <= 0) {
            this.combatTarget = null;
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
        }
    }

    private drainWorkerEnergy(worker: Worker, deltaTime: number): void {
        const rate = this.drainRate * (0.8 + this.aggressionLevel * 0.4);
        const drained = worker.drainEnergy(rate * deltaTime, 'combat_parasite_feeding');

        if (drained > 0) {
            this.lastFeedTime = Date.now();
        }

        const energy = worker.getEnergyStorage().getCurrentEnergy();
        const maxEnergy = worker.getEnergyStorage().getCapacity();
        const fleeThreshold = 0.35 + (this.aggressionLevel * 0.1);

        if (energy < maxEnergy * fleeThreshold) {
            worker.fleeFromDanger(this.position, 30);
            this.combatTarget = null;
            this.currentTarget = null;
            this.setState(ParasiteState.PATROLLING);
        }
    }

    // ==================== Drain Beam ====================

    protected updateDrainBeam(targetPosition: Vector3): void {
        if (!this.scene) return;

        if (this.drainBeam) {
            this.drainBeam.dispose();
            this.drainBeam = null;
        }

        const { MeshBuilder, Color3: C3, StandardMaterial } = require('@babylonjs/core');

        this.drainBeam = MeshBuilder.CreateLines(`drain_beam_${this.id}`, {
            points: [this.position.clone(), targetPosition.clone()]
        }, this.scene);

        const mat = new StandardMaterial(`drain_mat_${this.id}`, this.scene);
        mat.emissiveColor = new C3(1, 0.2, 0.2);
        mat.disableLighting = true;
        this.drainBeam.material = mat;
        this.drainBeam.alpha = 0.8;
    }

    protected removeDrainBeam(): void {
        if (this.drainBeam) {
            this.drainBeam.dispose();
            this.drainBeam = null;
        }
    }

    // ==================== State Override ====================

    protected setState(newState: ParasiteState): void {
        if (this.state !== newState) {
            if (this.state === ParasiteState.FEEDING) {
                this.removeDrainBeam();
            }
            super.setState(newState);
        }
    }

    // ==================== Public API ====================

    public getParasiteType(): ParasiteType {
        return this.parasiteType;
    }

    public getEnergyReward(): number {
        return this.energyReward;
    }

    public getHomeDeposit(): MineralDeposit {
        return this.homeDeposit;
    }

    public takeDamage(damage: number): boolean {
        this.health -= damage;
        return this.health <= 0;
    }

    public respawn(newPosition: Vector3): void {
        this.health = this.stats.maxHealth;
        this.maxHealth = this.stats.maxHealth;
        super.respawn(newPosition);
        this.createCombatParasiteMesh();
    }

    public hide(): void {
        this.removeDrainBeam();
        super.hide();
    }

    public dispose(): void {
        this.removeDrainBeam();
        super.dispose();
    }

    public getCombatParasiteStats(): any {
        return {
            id: this.id,
            position: this.position,
            health: this.health,
            maxHealth: this.maxHealth,
            state: this.state,
            territoryCenter: this.territoryCenter,
            territoryRadius: this.territoryRadius,
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
            aggressionLevel: this.aggressionLevel,
            engagementDistance: this.engagementDistance,
            retreatThreshold: this.retreatThreshold,
            speed: this.speed,
            healthRatio: this.health / this.maxHealth
        };
    }
}
