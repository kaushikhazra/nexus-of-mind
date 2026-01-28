/**
 * BuildingSpawner - Worker spawning and assignment for bases
 *
 * Handles spawning workers for newly placed bases and auto-assigning to mining.
 */

import { Vector3 } from '@babylonjs/core';
import { GameEngine } from '../../game/GameEngine';
import { PLACEMENT_CONSTANTS } from './BuildingPlacementInterfaces';
import { BuildingPlacementValidator } from './BuildingPlacementValidator';

export class BuildingSpawner {
    private validator: BuildingPlacementValidator;

    constructor() {
        this.validator = new BuildingPlacementValidator();
    }

    public spawnWorkersForBase(basePosition: Vector3): void {
        const gameEngine = GameEngine.getInstance();
        const unitManager = gameEngine?.getUnitManager();

        if (!unitManager) {
            console.error(`Cannot spawn workers: UnitManager not available`);
            return;
        }

        const workerPositions = this.validator.calculateWorkerFormationPositions(basePosition);
        const spawnedWorkers: any[] = [];

        for (let i = 0; i < 10; i++) {
            const workerPosition = workerPositions[i];
            const worker = unitManager.createUnit('worker', workerPosition);
            if (worker) {
                spawnedWorkers.push(worker);
            } else {
                console.error(`Failed to spawn worker ${i + 1}/10`);
            }
        }

        this.autoAssignWorkersToMining(spawnedWorkers, basePosition);
    }

    private autoAssignWorkersToMining(workers: any[], basePosition: Vector3): void {
        const gameEngine = GameEngine.getInstance();
        const terrainGenerator = gameEngine?.getTerrainGenerator();
        const unitManager = gameEngine?.getUnitManager();

        if (!terrainGenerator || !unitManager) {
            console.warn(`Cannot auto-assign mining: TerrainGenerator or UnitManager not available`);
            return;
        }

        const allDeposits = terrainGenerator.getAllMineralDeposits();
        const reachableDeposits: any[] = [];

        for (const worker of workers) {
            const workerPosition = worker.getPosition();

            for (const deposit of allDeposits) {
                const distance = Vector3.Distance(workerPosition, deposit.getPosition());
                if (distance <= PLACEMENT_CONSTANTS.WORKER_MINING_RANGE && !reachableDeposits.includes(deposit)) {
                    reachableDeposits.push(deposit);
                }
            }
        }

        if (reachableDeposits.length === 0) {
            return;
        }

        let assignedCount = 0;
        for (let i = 0; i < workers.length && reachableDeposits.length > 0; i++) {
            const worker = workers[i];
            const depositIndex = i % reachableDeposits.length;
            const targetDeposit = reachableDeposits[depositIndex];

            const distance = Vector3.Distance(worker.getPosition(), targetDeposit.getPosition());
            if (distance <= PLACEMENT_CONSTANTS.WORKER_MINING_RANGE) {
                unitManager.selectUnits([worker.getId()]);
                unitManager.issueCommand('mine', undefined, targetDeposit.getId());
                assignedCount++;
            }
        }

        unitManager.clearSelection();
    }
}
