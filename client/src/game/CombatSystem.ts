/**
 * CombatSystem - Central combat coordinator for all combat actions
 *
 * Manages combat actions between Protector units and enemy targets including
 * Energy Parasites and AI opponent units. Coordinates validation, effects,
 * performance monitoring, and territorial combat through extracted modules.
 *
 * Refactored to use extracted modules for SOLID compliance.
 */

import { Vector3, Scene } from '@babylonjs/core';
import { AdvancedDynamicTexture } from '@babylonjs/gui';
import { Protector } from './entities/Protector';
import { EnergyParasite } from './entities/EnergyParasite';
import { EnergyManager } from './EnergyManager';
import { SpatialIndex } from './SpatialIndex';

// Import from extracted combat modules
import {
    CombatAction,
    CombatValidator,
    CombatEffectsCoordinator,
    CombatPerformanceMonitor,
    CombatTargetPrioritizer,
    CombatUINotificationManager,
    CombatTerritoryManager,
    CombatPhaseProcessor,
    DEFAULT_COMBAT_CONFIG
} from './combat';

import type {
    CombatTarget,
    TargetValidation,
    AttackResult,
    CombatConfig,
    CombatPerformanceMetrics,
    CombatPerformanceSummary,
    HiveAssaultResult,
    DetectionRangeValidation
} from './combat';

// Re-export types for backward compatibility
export type { CombatTarget, TargetValidation, AttackResult, CombatConfig, CombatPerformanceMetrics };
export { CombatAction };

/**
 * CombatSystem - Central coordinator for all combat actions and state management
 */
export class CombatSystem {
    private scene: Scene | null = null;
    private energyManager: EnergyManager;
    private activeCombats: Map<string, CombatAction> = new Map();
    private protectorRegistry: Map<string, Protector> = new Map();
    private lastCleanupTime: number = 0;
    private config: CombatConfig;

    // Extracted module instances
    private validator: CombatValidator;
    private effectsCoordinator: CombatEffectsCoordinator;
    private performanceMonitor: CombatPerformanceMonitor;
    private targetPrioritizer: CombatTargetPrioritizer;
    private uiNotifications: CombatUINotificationManager;
    private territoryManager: CombatTerritoryManager;
    private phaseProcessor: CombatPhaseProcessor;

    constructor(energyManager: EnergyManager, scene?: Scene, sharedUI?: AdvancedDynamicTexture) {
        this.energyManager = energyManager;
        this.config = { ...DEFAULT_COMBAT_CONFIG };

        // Initialize extracted modules
        this.validator = new CombatValidator(this.config, energyManager);
        this.effectsCoordinator = new CombatEffectsCoordinator(scene, sharedUI);
        this.performanceMonitor = new CombatPerformanceMonitor();
        this.targetPrioritizer = new CombatTargetPrioritizer(this.config);
        this.uiNotifications = new CombatUINotificationManager(energyManager);
        this.territoryManager = new CombatTerritoryManager(
            this.config, energyManager, this.effectsCoordinator,
            (p, t) => this.calculateDamage(p, t),
            (p) => this.canProtectorAttack(p)
        );
        this.phaseProcessor = new CombatPhaseProcessor(
            this.config, energyManager, this.effectsCoordinator,
            this.targetPrioritizer, this.uiNotifications,
            {
                getProtectorById: (id) => this.getProtectorById(id),
                getAllPotentialTargets: () => this.getAllPotentialTargets(),
                detectNearbyEnemies: (p, r) => this.detectNearbyEnemies(p, r),
                handleTargetDestruction: (t) => this.handleTargetDestruction(t),
                resumeMovementAfterCombat: (p) => this.resumeMovementAfterCombat(p),
                moveProtectorToAttackRange: (p, t) => this.moveProtectorToAttackRange(p, t),
                calculateDamage: (p, t) => this.calculateDamage(p, t)
            }
        );

        if (scene) this.scene = scene;
    }

    public setScene(scene: Scene, sharedUI?: AdvancedDynamicTexture): void {
        this.scene = scene;
        this.effectsCoordinator.setScene(scene, sharedUI);
    }

    public setSharedUI(sharedUI: AdvancedDynamicTexture): void {
        this.effectsCoordinator.setSharedUI(sharedUI);
    }

    // ==================== Protector Registration ====================

    public registerProtector(protector: Protector): void {
        this.protectorRegistry.set(protector.getId(), protector);
    }

    public unregisterProtector(protectorId: string): void {
        this.protectorRegistry.delete(protectorId);
        this.handleProtectorDestruction(protectorId);
    }

    private getProtectorById(protectorId: string): Protector | null {
        return this.protectorRegistry.get(protectorId) || null;
    }

    // ==================== Attack Initiation ====================

    public initiateAttack(protector: Protector, target: CombatTarget): boolean {
        const validation = this.validator.validateTarget(protector, target);
        if (!validation.isValid) {
            if (validation.reason === 'insufficient_energy') {
                this.uiNotifications.showEnergyShortage(protector.getId(), validation.requiredEnergy || this.config.attackEnergyCost);
            }
            return false;
        }

        const existingCombat = this.getActiveCombatForProtector(protector.getId());
        if (existingCombat) this.cancelCombat(existingCombat.protectorId, existingCombat.targetId);

        const combatAction = new CombatAction(protector.getId(), target.id);
        this.activeCombats.set(this.generateCombatId(protector.getId(), target.id), combatAction);

        const distance = Vector3.Distance(protector.getPosition(), target.position);
        if (distance <= this.config.protectorAttackRange) {
            combatAction.setState('detecting');
        } else {
            combatAction.setState('engaging');
            this.moveProtectorToAttackRange(protector, target);
        }
        return true;
    }

    public initiateAutoAttack(protector: Protector, target: CombatTarget, originalDestination?: Vector3): boolean {
        if (!this.config.autoAttackEnabled) return false;
        if (!this.validator.validateTargetForAutoDetection(target).isValid) return false;

        const existingCombat = this.getActiveCombatForProtector(protector.getId());
        if (existingCombat) this.cancelCombat(existingCombat.protectorId, existingCombat.targetId);

        const combatAction = new CombatAction(protector.getId(), target.id, originalDestination);
        combatAction.detectionTriggered = true;
        this.activeCombats.set(this.generateCombatId(protector.getId(), target.id), combatAction);

        protector.stopMovement();
        const distance = Vector3.Distance(protector.getPosition(), target.position);
        combatAction.setState(distance <= this.config.protectorAttackRange ? 'detecting' : 'engaging');
        if (distance > this.config.protectorAttackRange) this.moveProtectorToAttackRange(protector, target);
        return true;
    }

    // ==================== Enemy Detection ====================

    public detectNearbyEnemies(protector: Protector, range: number = this.config.protectorDetectionRange): CombatTarget[] {
        const position = protector.getPosition();
        const enemies: CombatTarget[] = [];

        const gameEngine = require('./GameEngine').GameEngine.getInstance();
        const spatialIndex = gameEngine?.getSpatialIndex() as SpatialIndex | null;

        if (spatialIndex) {
            const entityIds = spatialIndex.getEntitiesInRange(position, range, ['parasite', 'combat_parasite', 'queen', 'hive']);
            for (const entityId of entityIds) {
                const target = this.resolveEntityToCombatTarget(entityId, gameEngine);
                if (target && this.validator.validateTargetForAutoDetection(target).isValid) {
                    enemies.push(target);
                }
            }
        } else {
            for (const target of this.getAllPotentialTargets()) {
                if (Vector3.Distance(position, target.position) <= range &&
                    this.validator.validateTargetForAutoDetection(target).isValid) {
                    enemies.push(target);
                }
            }
        }
        return enemies;
    }

    private resolveEntityToCombatTarget(entityId: string, gameEngine: any): CombatTarget | null {
        const pm = gameEngine?.getParasiteManager();
        if (pm) { const p = pm.getParasiteById(entityId); if (p?.isAlive()) return p; }
        const tm = gameEngine?.getTerritoryManager();
        if (tm) {
            for (const t of tm.getAllTerritories()) {
                if (t.queen?.id === entityId && t.queen.isVulnerable()) return t.queen;
                if (t.hive?.id === entityId && t.hive.isHiveConstructed()) return t.hive;
            }
        }
        return null;
    }

    // ==================== Combat Execution ====================

    public executeAttack(protector: Protector, target: CombatTarget, combatAction: CombatAction): AttackResult {
        const startTime = performance.now();
        const attacking = this.getProtectorsAttackingTarget(target.id);

        if (attacking.length > 1) {
            const instances = attacking.map(c => this.getProtectorById(c.protectorId)).filter(Boolean) as Protector[];
            const result = this.territoryManager.coordinateMultiProtectorDamage(target, instances);
            if (result.targetDestroyed) { this.handleTargetDestruction(target); combatAction.setState('completed'); }
            this.performanceMonitor.recordAttackTiming(startTime);
            return result;
        }

        const result: AttackResult = { success: false, damageDealt: 0, targetDestroyed: false, energyConsumed: 0, energyRewarded: 0 };
        if (!this.canProtectorAttack(protector)) { this.performanceMonitor.recordAttackTiming(startTime); return result; }

        if (!this.energyManager.consumeEnergy(protector.getId(), this.config.attackEnergyCost, 'combat_attack')) {
            this.uiNotifications.showEnergyShortage(protector.getId(), this.config.attackEnergyCost);
            this.performanceMonitor.recordAttackTiming(startTime);
            return result;
        }

        result.energyConsumed = this.config.attackEnergyCost;
        const damage = this.calculateDamage(protector, target);
        this.effectsCoordinator.createAttackEffect(protector.getPosition(), target.position);
        protector.faceTarget(target.position);
        result.targetDestroyed = target.takeDamage(damage);
        result.success = true;
        result.damageDealt = damage;
        combatAction.recordAttack();

        if (result.targetDestroyed) {
            this.effectsCoordinator.createDestructionEffect(target.position);
            this.handleTargetDestruction(target);
            combatAction.setState('completed');
        }
        this.performanceMonitor.recordAttackTiming(startTime);
        return result;
    }

    public calculateDamage(attacker: Protector, target: CombatTarget): number {
        const stats = attacker.getProtectorStats();
        return (stats.attackDamage || 25) + Math.floor((stats.combatExperience || 0) / 10);
    }

    private canProtectorAttack(protector: Protector): boolean {
        if (!this.energyManager.canConsumeEnergy(protector.getId(), this.config.attackEnergyCost)) return false;
        const stats = protector.getProtectorStats();
        return performance.now() - (stats.lastActionTime || 0) >= this.config.attackCooldown;
    }

    // ==================== Combat State Management ====================

    public getProtectorsAttackingTarget(targetId: string): CombatAction[] {
        return Array.from(this.activeCombats.values()).filter(c => c.targetId === targetId && c.isInActiveCombat());
    }

    public handleTargetDestruction(target: CombatTarget): void {
        const { Queen } = require('./entities/Queen');
        const { Hive } = require('./entities/Hive');
        const affected: string[] = [];

        for (const [id, c] of this.activeCombats) {
            if (c.targetId === target.id) { this.activeCombats.delete(id); affected.push(c.protectorId); }
        }
        for (const pid of affected) {
            const p = this.getProtectorById(pid);
            if (p) { p.clearFacingTarget(); this.resumeMovementAfterCombat(p); }
        }

        if (target instanceof Queen) console.log(`👑 Queen ${target.id} destroyed`);
        else if (target instanceof Hive) console.log(`🏠 Hive ${target.id} destroyed`);
        else if (target instanceof EnergyParasite) {
            require('./GameEngine').GameEngine.getInstance()?.getParasiteManager()?.handleParasiteDestruction(target.id);
        }
        target.onDestroyed();
    }

    public handleProtectorDestruction(protectorId: string): void {
        for (const [id, c] of this.activeCombats) { if (c.protectorId === protectorId) this.activeCombats.delete(id); }
        this.protectorRegistry.delete(protectorId);
    }

    public handleCombatInterruption(protectorId: string, targetId: string, reason: string): void {
        const combatId = this.generateCombatId(protectorId, targetId);
        const combat = this.activeCombats.get(combatId);
        if (!combat) return;
        combat.setState('completed');
        this.activeCombats.delete(combatId);

        if (['out_of_range', 'energy_depleted', 'target_invalid'].includes(reason)) {
            const p = this.getProtectorById(protectorId);
            if (p) { p.stopMovement(); if (combat.originalDestination) this.resumeMovementAfterCombat(p); }
            if (reason === 'energy_depleted') this.uiNotifications.showEnergyShortage(protectorId, this.config.attackEnergyCost);
        }
    }

    public resumeMovementAfterCombat(protector: Protector): void {
        const combat = this.getActiveCombatForProtector(protector.getId());
        if (combat?.originalDestination) {
            combat.setState('resuming_movement');
            if (Vector3.Distance(protector.getPosition(), combat.originalDestination) > 1.0) {
                protector.startMovement(combat.originalDestination);
            } else {
                combat.setState('completed');
            }
        }
    }

    // ==================== Update Loop ====================

    public update(deltaTime: number): void {
        const startTime = performance.now();
        this.performanceMonitor.setActiveCombatCount(this.activeCombats.size);
        this.performanceMonitor.updateMetrics();

        const toRemove: string[] = [];
        for (const [id, combat] of this.activeCombats) {
            if (combat.isCompleted()) toRemove.push(id);
            else this.phaseProcessor.processCombatPhase(combat);
        }
        for (const id of toRemove) { this.activeCombats.delete(id); this.performanceMonitor.incrementCleanups(); }

        if (performance.now() - this.lastCleanupTime > 5000) {
            this.validateAndCleanupStaleCombats();
            this.lastCleanupTime = performance.now();
        }
        this.performanceMonitor.recordFrameTimeImpact(startTime);
    }

    // ==================== Utility Methods ====================

    private getAllPotentialTargets(): CombatTarget[] {
        const targets: CombatTarget[] = [];
        try {
            const ge = require('./GameEngine').GameEngine.getInstance();
            if (ge?.getParasiteManager()) targets.push(...ge.getParasiteManager().getAllParasites());
            if (ge?.getTerritoryManager()) {
                for (const t of ge.getTerritoryManager().getAllTerritories()) {
                    if (t.queen?.isVulnerable()) targets.push(t.queen);
                    if (t.hive?.isHiveConstructed()) targets.push(t.hive);
                }
            }
        } catch {}
        return targets;
    }

    private moveProtectorToAttackRange(protector: Protector, target: CombatTarget): void {
        const dir = target.position.subtract(protector.getPosition()).normalize();
        protector.startMovement(target.position.subtract(dir.scale(this.config.protectorAttackRange * 0.8)));
    }

    private cancelCombat(protectorId: string, targetId: string): void {
        this.activeCombats.delete(this.generateCombatId(protectorId, targetId));
    }

    private getActiveCombatForProtector(protectorId: string): CombatAction | null {
        for (const c of this.activeCombats.values()) if (c.protectorId === protectorId) return c;
        return null;
    }

    private generateCombatId(protectorId: string, targetId: string): string {
        return `combat_${protectorId}_${targetId}`;
    }

    public validateAndCleanupStaleCombats(): void {
        const now = performance.now();
        for (const [id, c] of this.activeCombats) {
            if (now - c.startTime > 30000 || !this.getProtectorById(c.protectorId)) this.activeCombats.delete(id);
        }
    }

    public cleanupAllCombatState(): void { this.activeCombats.clear(); this.protectorRegistry.clear(); }

    // ==================== Public API Delegations ====================

    public validateTarget(p: Protector, t: CombatTarget): TargetValidation { return this.validator.validateTarget(p, t); }
    public validateTargetForAutoDetection(t: CombatTarget): TargetValidation { return this.validator.validateTargetForAutoDetection(t); }
    public validateQueenTarget(p: Protector, q: any): TargetValidation { return this.validator.validateQueenTarget(p, q); }
    public validateHiveTarget(p: Protector, h: any): TargetValidation { return this.validator.validateHiveTarget(p, h); }
    public isFriendlyUnitForAutoDetection(t: CombatTarget): boolean { return this.validator.isFriendlyUnit(t); }
    public isValidEnemyTargetForAutoDetection(t: CombatTarget): boolean { return this.validator.isValidEnemyTarget(t); }
    public prioritizeTargets(p: Protector, t: CombatTarget[]): CombatTarget[] { return this.targetPrioritizer.prioritizeTargets(p, t); }
    public getHighestPriorityTarget(p: Protector, t: CombatTarget[]): CombatTarget | null { return this.targetPrioritizer.getHighestPriorityTarget(p, t); }
    public selectTargetConsistently(p: Protector, t: CombatTarget[]): CombatTarget | null { return this.targetPrioritizer.selectTargetConsistently(p, t); }
    public prioritizeTargetsWithTerritory(p: Protector, t: CombatTarget[]): CombatTarget[] { return this.targetPrioritizer.prioritizeTargetsWithTerritory(p, t); }
    public getDefensivePriorityInTerritory(t: any): number { return this.targetPrioritizer.getDefensivePriorityInTerritory(t); }
    public coordinateMultiProtectorDamage(t: CombatTarget, p: Protector[]): AttackResult { return this.territoryManager.coordinateMultiProtectorDamage(t, p); }
    public coordinateHiveAssault(h: any, p: Protector[]): HiveAssaultResult { return this.territoryManager.coordinateHiveAssault(h, p); }
    public calculateHiveAssaultDamage(h: any, p: Protector[]): number { return this.territoryManager.calculateHiveAssaultDamage(h, p); }

    public checkMovementDetection(protector: Protector): CombatTarget | null {
        if (!this.config.autoAttackEnabled) return null;
        const stats = protector.getProtectorStats();
        if (stats.combatState !== 'moving' || !stats.autoAttackEnabled) return null;
        const enemies = this.detectNearbyEnemies(protector);
        return enemies.length > 0 ? this.targetPrioritizer.selectTargetConsistently(protector, enemies) : null;
    }

    public getActiveCombats(): CombatAction[] { return Array.from(this.activeCombats.values()); }
    public getConfig(): CombatConfig { return { ...this.config }; }
    public getDetectionRange(): number { return this.config.protectorDetectionRange; }
    public getCombatRange(): number { return this.config.protectorAttackRange; }
    public getPerformanceMetrics(): CombatPerformanceMetrics { return this.performanceMonitor.getMetrics(); }
    public getPerformanceSummary(): CombatPerformanceSummary { return this.performanceMonitor.getPerformanceSummary(); }

    public updateConfig(c: Partial<CombatConfig>): void {
        this.config = { ...this.config, ...c };
        this.validator.updateConfig(this.config);
        this.targetPrioritizer.updateConfig(this.config);
        this.territoryManager.updateConfig(this.config);
        this.phaseProcessor.updateConfig(this.config);
    }

    public updateDetectionRange(r: number): boolean { if (r <= 0) return false; this.config.protectorDetectionRange = r; return true; }

    public validateDetectionRangeConfig(): DetectionRangeValidation {
        const issues: string[] = [];
        const { protectorDetectionRange: det, protectorAttackRange: att } = this.config;
        if (det <= att) issues.push(`Detection range (${det}) should be larger than combat range (${att})`);
        if (det > 50) issues.push(`Detection range (${det}) may impact performance`);
        if (det <= 0) issues.push(`Detection range (${det}) must be positive`);
        return { isValid: issues.length === 0, detectionRange: det, combatRange: att, issues };
    }

    public dispose(): void { this.activeCombats.clear(); this.effectsCoordinator.dispose(); }
}
