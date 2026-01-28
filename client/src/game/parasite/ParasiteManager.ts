/**
 * ParasiteManager - Manages energy and combat parasite spawning and lifecycle
 *
 * Refactored to delegate to extracted modules for SOLID compliance.
 * Coordinates spawning, performance optimization, territory integration,
 * and statistics collection through dedicated managers.
 */

import { Scene, Vector3 } from '@babylonjs/core';
import { EnergyParasite } from '../entities/EnergyParasite';
import { CombatParasite } from '../entities/CombatParasite';
import { MineralDeposit } from '../../world/MineralDeposit';
import { MaterialManager } from '../../rendering/MaterialManager';
import { Worker } from '../entities/Worker';
import { Protector } from '../entities/Protector';
import { ParasiteType } from '../types/ParasiteTypes';
import { TerritoryManager } from '../TerritoryManager';
import { Queen } from '../entities/Queen';
import { GameEngine } from '../GameEngine';

import type {
    ParasiteManagerConfig,
    ParasiteSpawnConfig,
    TerritorialParasiteConfig,
    LifecycleStats,
    PerformanceStats,
    RenderingMetrics,
    TerritorialStats,
    ParasiteControlValidation
} from './ParasiteInterfaces';
import { DEFAULT_SPAWN_CONFIG } from './ParasiteInterfaces';
import { ParasitePerformanceOptimizer } from './ParasitePerformance';
import { ParasiteTerritoryManager } from './ParasiteTerritory';
import { ParasiteSpawner } from './ParasiteSpawner';
import { ParasiteStatisticsCollector } from './ParasiteStatistics';
import { ParasiteUpdater } from './ParasiteUpdater';

// Re-export for backwards compatibility
export type { TerritorialParasiteConfig, ParasiteManagerConfig, ParasiteSpawnConfig };

type ParasiteEntity = EnergyParasite | CombatParasite;

export class ParasiteManager {
    private scene: Scene;
    private materialManager: MaterialManager;
    private terrainGenerator: any = null;
    private parasites: Map<string, ParasiteEntity> = new Map();

    // Delegated managers
    private spawner: ParasiteSpawner;
    private performanceOptimizer: ParasitePerformanceOptimizer;
    private territoryIntegration: ParasiteTerritoryManager;
    private statistics: ParasiteStatisticsCollector;
    private updater: ParasiteUpdater;

    // Configuration
    private spawnConfig: ParasiteSpawnConfig = { ...DEFAULT_SPAWN_CONFIG };
    private depositParasiteCount: Map<string, number> = new Map();

    // Cache
    private gameEngine: GameEngine | null = null;
    private cachedCameraTarget: Vector3 = new Vector3(0, 0, 0);
    private lastCameraTargetUpdate: number = 0;
    private cachedDeposits: MineralDeposit[] = [];
    private depositDistances: { deposit: MineralDeposit; distance: number }[] = [];
    private lastDepositCacheTime: number = 0;

    private readonly CAMERA_TARGET_UPDATE_INTERVAL = 100;
    private readonly DEPOSIT_CACHE_INTERVAL = 1000;

    constructor(config: ParasiteManagerConfig) {
        this.scene = config.scene;
        this.materialManager = config.materialManager;
        this.terrainGenerator = config.terrainGenerator || null;

        this.spawner = new ParasiteSpawner(config.scene, config.materialManager);
        this.performanceOptimizer = new ParasitePerformanceOptimizer();
        this.territoryIntegration = new ParasiteTerritoryManager();
        this.statistics = new ParasiteStatisticsCollector();
        this.updater = new ParasiteUpdater();

        if (this.terrainGenerator) {
            this.spawner.setTerrainGenerator(this.terrainGenerator);
        }
    }

    public setTerrainGenerator(terrainGenerator: any): void {
        this.terrainGenerator = terrainGenerator;
        this.spawner.setTerrainGenerator(terrainGenerator);
        for (const parasite of this.parasites.values()) {
            parasite.setTerrainGenerator(terrainGenerator);
        }
    }

    public update(deltaTime: number, mineralDeposits: MineralDeposit[], workers: Worker[], protectors: Protector[]): void {
        const currentTime = Date.now();
        const now = performance.now();

        const spatialIndex = GameEngine.getInstance()?.getSpatialIndex() || null;
        this.updater.updateParasites(deltaTime, this.parasites, workers, protectors, spatialIndex);

        if (now - this.lastCameraTargetUpdate >= this.CAMERA_TARGET_UPDATE_INTERVAL) {
            this.updateCachedCameraTarget();
            this.lastCameraTargetUpdate = now;
        }

        if (now - this.lastDepositCacheTime >= this.DEPOSIT_CACHE_INTERVAL) {
            this.updateDepositCache(mineralDeposits);
            this.lastDepositCacheTime = now;
        }

        this.cleanupDeadParasites();

        if (Math.floor(currentTime / 10000) !== Math.floor((currentTime - deltaTime * 1000) / 10000)) {
            this.statistics.cleanupOrphanedTracking(this.parasites);
        }

        this.performanceOptimizer.checkAndOptimize(this.getParasites());
    }

    private updateCachedCameraTarget(): void {
        if (!this.gameEngine) {
            this.gameEngine = GameEngine.getInstance();
        }
        const target = this.gameEngine?.getCameraController()?.getCamera()?.getTarget();
        if (target) {
            this.cachedCameraTarget.copyFrom(target);
        }
    }

    private updateDepositCache(mineralDeposits: MineralDeposit[]): void {
        this.depositDistances.length = 0;
        for (const d of mineralDeposits) {
            if (d.isVisible() && !d.isDepleted()) {
                this.depositDistances.push({ deposit: d, distance: Vector3.Distance(d.getPosition(), this.cachedCameraTarget) });
            }
        }
        this.depositDistances.sort((a, b) => a.distance - b.distance);
        this.cachedDeposits.length = 0;
        const limit = Math.min(20, this.depositDistances.length);
        for (let i = 0; i < limit; i++) {
            this.cachedDeposits.push(this.depositDistances[i].deposit);
        }
    }

    public setTerritoryManager(territoryManager: TerritoryManager): void {
        this.territoryIntegration.setTerritoryManager(territoryManager);
        this.spawner.setTerritoryManager(territoryManager);
    }

    public configureTerritorialSpawning(territoryId: string, config: TerritorialParasiteConfig): void {
        this.territoryIntegration.configureTerritorialSpawning(territoryId, config);
    }

    public spawnAtChunk(chunkId: number, spawnType: 'energy' | 'combat', queen: Queen): boolean {
        return this.spawner.spawnAtChunk(chunkId, spawnType, queen, (parasite, position, entityType) => {
            this.parasites.set(parasite.getId(), parasite);
            const spatialIndex = GameEngine.getInstance()?.getSpatialIndex();
            if (spatialIndex) {
                spatialIndex.add(parasite.getId(), position, entityType);
            }
            const parasiteType = parasite instanceof CombatParasite ? ParasiteType.COMBAT : ParasiteType.ENERGY;
            this.statistics.incrementTypeCount(parasiteType);
        });
    }

    public explodeParasitesInTerritory(territoryId: string): void {
        const territoryManager = this.territoryIntegration.getTerritoryManager();
        if (!territoryManager) return;
        const territory = territoryManager.getTerritory(territoryId);
        if (!territory) return;

        const toExplode: string[] = [];
        for (const [id, p] of this.parasites.entries()) {
            if (p.isAlive() && territoryManager.isPositionInTerritory(p.getPosition(), territoryId)) {
                toExplode.push(id);
            }
        }

        for (const id of toExplode) {
            const p = this.parasites.get(id);
            if (p) {
                territory.queen?.removeControlledParasite(id);
                this.removeParasite(id, p);
            }
        }
        territory.parasiteCount = 0;
        console.log(`💥 Exploded ${toExplode.length} parasites in territory ${territoryId}`);
    }

    private removeParasite(parasiteId: string, parasite: ParasiteEntity): void {
        const parasiteType = parasite instanceof CombatParasite ? ParasiteType.COMBAT : ParasiteType.ENERGY;
        const homeDeposit = parasite.getHomeDeposit();

        if (homeDeposit) {
            const depositId = homeDeposit.getId();
            const currentCount = this.depositParasiteCount.get(depositId) || 0;
            this.depositParasiteCount.set(depositId, Math.max(0, currentCount - 1));
            this.statistics.removeParasiteFromDeposit(depositId, parasiteId);
        }

        this.statistics.decrementTypeCount(parasiteType);
        GameEngine.getInstance()?.getSpatialIndex()?.remove(parasiteId);
        parasite.dispose();
        this.parasites.delete(parasiteId);
    }

    public handleParasiteDestruction(parasiteId: string): void {
        const parasite = this.parasites.get(parasiteId);
        if (!parasite) return;

        const tm = this.territoryIntegration.getTerritoryManager();
        if (tm) {
            const pos = parasite.getPosition();
            const territory = tm.getTerritoryAt(pos.x, pos.z);
            territory?.queen?.removeControlledParasite(parasiteId);
        }
        this.removeParasite(parasiteId, parasite);
    }

    private cleanupDeadParasites(): void {
        for (const [id, p] of this.parasites.entries()) {
            if (!p.isAlive()) {
                this.handleParasiteDestruction(id);
            }
        }
    }

    public handleProtectorAttack(protector: Protector, targetPosition: Vector3): boolean {
        const target = this.findParasiteAt(targetPosition, 2.0);
        if (!target) return false;

        const combatSystem = GameEngine.getInstance()?.getCombatSystem();
        if (combatSystem) return combatSystem.initiateAttack(protector, target);

        if (Vector3.Distance(protector.getPosition(), target.getPosition()) > 15) return false;
        if (!protector.getEnergyStorage().hasEnergy(5)) return false;

        protector.getEnergyStorage().removeEnergy(5, 'parasite_attack');
        if (target.takeDamage(1)) {
            protector.getEnergyStorage().addEnergy(2, 'parasite_kill_reward');
            const hd = target.getHomeDeposit();
            if (hd) {
                const c = this.depositParasiteCount.get(hd.getId()) || 0;
                this.depositParasiteCount.set(hd.getId(), Math.max(0, c - 1));
            }
        }
        return true;
    }

    private findParasiteAt(position: Vector3, tolerance: number): ParasiteEntity | null {
        for (const p of this.parasites.values()) {
            if (p.isAlive() && Vector3.Distance(p.getPosition(), position) <= tolerance) return p;
        }
        return null;
    }

    // Public getters
    public getParasiteById(id: string): ParasiteEntity | null { return this.parasites.get(id) || null; }
    public getParasites(): ParasiteEntity[] { return Array.from(this.parasites.values()).filter(p => p.isAlive()); }
    public getAllParasites(): ParasiteEntity[] { return this.getParasites(); }
    public getParasitesInTerritory(id: string): ParasiteEntity[] { return this.territoryIntegration.getParasitesInTerritory(id, this.parasites); }
    public getParasitesNear(pos: Vector3, radius: number): ParasiteEntity[] { return this.getParasites().filter(p => Vector3.Distance(p.getPosition(), pos) <= radius); }
    public getParasiteCountForDeposit(id: string): number { return this.depositParasiteCount.get(id) || 0; }
    public getParasitesByType(type: ParasiteType): ParasiteEntity[] { return this.getParasites().filter(p => (p instanceof CombatParasite) === (type === ParasiteType.COMBAT)); }
    public getParasiteCountByType(type: ParasiteType): number { return this.statistics.getParasiteCountByType(type); }
    public getParasitesForDeposit(depositId: string): ParasiteEntity[] {
        const ids = this.statistics.getParasiteIdsForDeposit(depositId);
        if (!ids) return [];
        return Array.from(ids).map(id => this.parasites.get(id)).filter((p): p is ParasiteEntity => p != null && p.isAlive());
    }
    public getActiveParasiteCount(): number { return this.getParasites().length; }
    public getCurrentSpawnRate(): number { return this.spawnConfig.baseSpawnInterval > 0 ? 1000 / this.spawnConfig.baseSpawnInterval : 0; }

    // Statistics
    public getDistributionTracker() { return this.statistics.getDistributionTracker(); }
    public getDistributionStats() { return this.statistics.getDistributionStats(); }
    public resetDistribution(): void { this.statistics.resetDistribution(); }
    public getLifecycleStats(): LifecycleStats { return this.statistics.getLifecycleStats(this.parasites.size); }
    public getRenderingMetrics(): RenderingMetrics { return this.statistics.getRenderingMetrics(this.parasites); }
    public getTerritorialStats(): TerritorialStats { return this.territoryIntegration.getTerritorialStats(); }
    public getPerformanceStats(): PerformanceStats {
        return this.statistics.getPerformanceStats(
            this.performanceOptimizer.getOptimizationLevel(),
            this.performanceOptimizer.getMaxActiveParasites(),
            this.getParasites().length,
            this.performanceOptimizer.getLastPerformanceCheck()
        );
    }

    // Configuration
    public updateSpawnConfig(config: Partial<ParasiteSpawnConfig>): void { this.spawnConfig = { ...this.spawnConfig, ...config }; }
    public transferParasiteControl(id: string, queen: Queen): void { const p = this.parasites.get(id); if (p) this.territoryIntegration.transferParasiteControl(id, queen, p); }
    public forcePerformanceCheck(): void { this.performanceOptimizer.forceCheck(this.getParasites()); }
    public setMaxActiveParasites(max: number): void { this.performanceOptimizer.setMaxActiveParasites(max); }
    public validateParasiteControlConsistency(): ParasiteControlValidation { return this.territoryIntegration.validateParasiteControlConsistency(this.parasites); }
    public recalculateParasiteControl(): void { this.territoryIntegration.recalculateParasiteControl(this.parasites); }

    public optimizeMaterials(): void {
        const em = this.materialManager.getParasiteMaterial();
        const cm = this.materialManager.getCombatParasiteMaterial();
        for (const p of this.parasites.values()) {
            if ((p as any).updateMaterial) {
                (p as any).updateMaterial(p instanceof CombatParasite ? cm : em);
            }
        }
    }

    public dispose(): void {
        const si = GameEngine.getInstance()?.getSpatialIndex();
        for (const p of this.parasites.values()) {
            si?.remove(p.getId());
            p.dispose?.();
        }
        this.parasites.clear();
        this.depositParasiteCount.clear();
        this.territoryIntegration.dispose();
        this.statistics.dispose();
    }
}
