/**
 * ParasiteUpdater - Parasite update loop logic
 *
 * Handles the per-frame update of parasites including spatial queries
 * and nearby entity detection.
 * Extracted from ParasiteManager.ts for SOLID compliance.
 */

import { Vector3 } from '@babylonjs/core';
import { EnergyParasite } from '../entities/EnergyParasite';
import { CombatParasite } from '../entities/CombatParasite';
import { Worker } from '../entities/Worker';
import { Protector } from '../entities/Protector';
import { GameEngine } from '../GameEngine';
import { SpatialIndex } from '../SpatialIndex';

type ParasiteEntity = EnergyParasite | CombatParasite;

/**
 * ParasiteUpdater - Handles parasite update loop
 */
export class ParasiteUpdater {
    // Cached Maps for unit lookups
    private cachedWorkerMap: Map<string, Worker> = new Map();
    private cachedProtectorMap: Map<string, Protector> = new Map();

    // Cached arrays for updateParasites()
    private cachedParasiteIds: string[] = [];
    private cachedNearbyWorkers: Worker[] = [];
    private cachedNearbyProtectors: Protector[] = [];
    private cachedWorkerIds: string[] = [];
    private cachedProtectorIds: string[] = [];

    /**
     * Update all parasites near the camera
     */
    public updateParasites(
        deltaTime: number,
        parasites: Map<string, ParasiteEntity>,
        workers: Worker[],
        protectors: Protector[],
        spatialIndex: SpatialIndex | null
    ): void {
        if (parasites.size === 0) {
            return;
        }

        const gameEngine = GameEngine.getInstance();
        const cameraController = gameEngine?.getCameraController();
        const cameraTarget = cameraController?.getCamera()?.getTarget();

        if (!cameraTarget) {
            return;
        }

        // Build ID->Object maps
        this.cachedWorkerMap.clear();
        for (const worker of workers) {
            this.cachedWorkerMap.set(worker.getId(), worker);
        }
        this.cachedProtectorMap.clear();
        for (const protector of protectors) {
            this.cachedProtectorMap.set(protector.getId(), protector);
        }

        // Get parasites in nearby chunks
        if (spatialIndex) {
            spatialIndex.getEntitiesInRangeTo(
                cameraTarget,
                192,
                ['parasite', 'combat_parasite'],
                this.cachedParasiteIds
            );
        } else {
            this.cachedParasiteIds.length = 0;
            for (const key of parasites.keys()) {
                this.cachedParasiteIds.push(key);
            }
        }

        // Update only nearby parasites
        for (const parasiteId of this.cachedParasiteIds) {
            const parasite = parasites.get(parasiteId);

            if (!parasite || !parasite.isAlive()) {
                continue;
            }

            this.updateSingleParasite(
                deltaTime,
                parasite,
                workers,
                protectors,
                spatialIndex
            );
        }
    }

    /**
     * Update a single parasite
     */
    private updateSingleParasite(
        deltaTime: number,
        parasite: ParasiteEntity,
        workers: Worker[],
        protectors: Protector[],
        spatialIndex: SpatialIndex | null
    ): void {
        const parasitePosition = parasite.getTerritoryCenter();
        const searchRadius = parasite.getTerritoryRadius() * 1.5;

        this.cachedNearbyWorkers.length = 0;
        this.cachedNearbyProtectors.length = 0;

        if (spatialIndex) {
            spatialIndex.getEntitiesInRangeTo(parasitePosition, searchRadius, 'worker', this.cachedWorkerIds);
            for (const id of this.cachedWorkerIds) {
                const worker = this.cachedWorkerMap.get(id);
                if (worker) {
                    this.cachedNearbyWorkers.push(worker);
                }
            }

            spatialIndex.getEntitiesInRangeTo(parasitePosition, searchRadius, 'protector', this.cachedProtectorIds);
            for (const id of this.cachedProtectorIds) {
                const protector = this.cachedProtectorMap.get(id);
                if (protector) {
                    this.cachedNearbyProtectors.push(protector);
                }
            }
        } else {
            for (const worker of workers) {
                const distance = Vector3.Distance(worker.getPositionRef(), parasitePosition);
                if (distance <= searchRadius) {
                    this.cachedNearbyWorkers.push(worker);
                }
            }
            for (const protector of protectors) {
                const distance = Vector3.Distance(protector.getPositionRef(), parasitePosition);
                if (distance <= searchRadius) {
                    this.cachedNearbyProtectors.push(protector);
                }
            }
        }

        if (parasite instanceof CombatParasite) {
            parasite.update(deltaTime, this.cachedNearbyWorkers, this.cachedNearbyProtectors);
        } else {
            parasite.update(deltaTime, this.cachedNearbyWorkers);
        }

        if (spatialIndex) {
            spatialIndex.updatePosition(parasite.getId(), parasite.getPositionRef());
        }
    }
}
