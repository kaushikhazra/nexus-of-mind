/**
 * ParasiteSpawner - Parasite spawning logic
 *
 * Handles chunk-based spawning and factory creation of parasites.
 * Extracted from ParasiteManager.ts for SOLID compliance.
 */

import { Scene, Vector3 } from '@babylonjs/core';
import { EnergyParasite, EnergyParasiteConfig } from '../entities/EnergyParasite';
import { CombatParasite, CombatParasiteConfig } from '../entities/CombatParasite';
import { MineralDeposit } from '../../world/MineralDeposit';
import { MaterialManager } from '../../rendering/MaterialManager';
import { ParasiteType } from '../types/ParasiteTypes';
import { Queen } from '../entities/Queen';
import { GameEngine } from '../GameEngine';
import { TerritoryManager } from '../TerritoryManager';
import { chunkToCoordinate } from '../utils/ChunkUtils';
import type { EntityType } from '../SpatialIndex';

type ParasiteEntity = EnergyParasite | CombatParasite;

/**
 * ParasiteSpawner - Handles parasite creation and spawning
 */
export class ParasiteSpawner {
    private scene: Scene;
    private materialManager: MaterialManager;
    private terrainGenerator: any = null;
    private territoryManager: TerritoryManager | null = null;

    constructor(scene: Scene, materialManager: MaterialManager) {
        this.scene = scene;
        this.materialManager = materialManager;
    }

    /**
     * Set terrain generator
     */
    public setTerrainGenerator(terrainGenerator: any): void {
        this.terrainGenerator = terrainGenerator;
    }

    /**
     * Set territory manager
     */
    public setTerritoryManager(territoryManager: TerritoryManager | null): void {
        this.territoryManager = territoryManager;
    }

    /**
     * Spawn a parasite at a specific chunk location
     */
    public spawnAtChunk(
        chunkId: number,
        spawnType: 'energy' | 'combat',
        queen: Queen,
        onRegister: (parasite: ParasiteEntity, position: Vector3, entityType: EntityType) => void
    ): boolean {
        console.log(`🐛 spawnAtChunk called: chunk=${chunkId}, type=${spawnType}`);

        if (chunkId < 0 || chunkId >= 256) {
            console.log(`🐛 FAIL: Invalid chunk ID ${chunkId}`);
            return false;
        }

        if (!queen || !queen.isActiveQueen()) {
            console.log(`🐛 FAIL: Queen not active`);
            return false;
        }

        const energySystem = queen.getEnergySystem();
        if (!energySystem.canAffordSpawn(spawnType)) {
            console.log(`🐛 FAIL: Can't afford spawn (energy: ${energySystem.getCurrentEnergy()})`);
            return false;
        }

        const territory = queen.getTerritory();
        const territoryCenter = {
            x: territory.centerPosition.x,
            z: territory.centerPosition.z
        };

        const spawnPosition = chunkToCoordinate(chunkId, territoryCenter, true, 5);
        if (!spawnPosition) {
            console.log(`🐛 FAIL: Could not convert chunk ${chunkId} to position`);
            return false;
        }
        console.log(`🐛 Chunk ${chunkId} → world (${spawnPosition.x.toFixed(1)}, ${spawnPosition.z.toFixed(1)})`);

        if (this.terrainGenerator && this.terrainGenerator.getHeightAtPosition) {
            spawnPosition.y = this.terrainGenerator.getHeightAtPosition(spawnPosition.x, spawnPosition.z) + 0.5;
        } else {
            spawnPosition.y = 0.5;
        }

        if (this.territoryManager && !this.territoryManager.isPositionInTerritory(spawnPosition, territory.id)) {
            console.log(`🐛 FAIL: Position not in Queen's territory`);
            return false;
        }

        if (!energySystem.consumeForSpawn(spawnType)) {
            console.log(`🐛 FAIL: Energy consumption failed`);
            return false;
        }

        const parasiteType = spawnType === 'combat' ? ParasiteType.COMBAT : ParasiteType.ENERGY;
        const homeDeposit = this.findNearestDeposit(spawnPosition);

        const parasite = this.createParasite(parasiteType, {
            position: spawnPosition,
            scene: this.scene,
            materialManager: this.materialManager,
            homeDeposit: homeDeposit || undefined
        });

        if (this.terrainGenerator) {
            parasite.setTerrainGenerator(this.terrainGenerator);
        }

        const entityType = parasiteType === ParasiteType.COMBAT ? 'combat_parasite' : 'parasite';
        onRegister(parasite, spawnPosition, entityType);

        queen.addControlledParasite(parasite.getId());

        console.log(`🐛 SUCCESS: Spawned ${spawnType} parasite at (${spawnPosition.x.toFixed(1)}, ${spawnPosition.z.toFixed(1)})`);
        return true;
    }

    /**
     * Factory method for creating parasites based on type
     */
    public createParasite(type: ParasiteType, config: EnergyParasiteConfig | CombatParasiteConfig): ParasiteEntity {
        switch (type) {
            case ParasiteType.ENERGY:
                return new EnergyParasite(config as EnergyParasiteConfig);
            case ParasiteType.COMBAT:
                return new CombatParasite(config as CombatParasiteConfig);
            default:
                throw new Error(`Unknown parasite type: ${type}`);
        }
    }

    /**
     * Find nearest mineral deposit to a position
     */
    private findNearestDeposit(position: Vector3): MineralDeposit | null {
        const gameEngine = GameEngine.getInstance();
        const terrainGenerator = gameEngine?.getTerrainGenerator();

        if (!terrainGenerator || !terrainGenerator.getMineralDeposits) {
            return null;
        }

        const deposits = terrainGenerator.getMineralDeposits();
        let nearestDeposit: MineralDeposit | null = null;
        let nearestDistance = Infinity;

        for (const deposit of deposits) {
            if (!deposit.isDepleted()) {
                const distance = Vector3.Distance(position, deposit.getPosition());
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestDeposit = deposit;
                }
            }
        }

        return nearestDeposit;
    }
}
