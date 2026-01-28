/**
 * BuildingPlacementValidator - Placement validation and mining analysis
 *
 * Validates building positions and analyzes mining potential for base placement.
 */

import { Vector3 } from '@babylonjs/core';
import { GameEngine } from '../../game/GameEngine';
import type { MiningAnalysis } from './BuildingPlacementInterfaces';
import { PLACEMENT_CONSTANTS } from './BuildingPlacementInterfaces';
import type { MineralDeposit } from '../../world/MineralDeposit';

export class BuildingPlacementValidator {
    public isValidPosition(position: Vector3): boolean {
        if (position.length() > PLACEMENT_CONSTANTS.MAX_PLACEMENT_DISTANCE) {
            return false;
        }

        const gameEngine = GameEngine.getInstance();
        const gameState = gameEngine?.getGameState();

        if (gameState) {
            const allBuildings = gameState.getAllBuildings();
            for (const building of allBuildings) {
                const distance = Vector3.Distance(position, building.position);
                if (distance < PLACEMENT_CONSTANTS.MIN_BUILDING_DISTANCE) {
                    return false;
                }
            }
        }

        return true;
    }

    public analyzeMiningPotential(basePosition: Vector3): MiningAnalysis {
        const gameEngine = GameEngine.getInstance();
        const terrainGenerator = gameEngine?.getTerrainGenerator();

        if (!terrainGenerator) {
            return {
                reachableNodes: [],
                workerCount: 0,
                efficiency: 'low',
                totalCapacity: 0
            };
        }

        const allDeposits = terrainGenerator.getAllMineralDeposits();
        const reachableNodes: MineralDeposit[] = [];
        let totalCapacity = 0;

        const workerPositions = this.calculateWorkerFormationPositions(basePosition);

        for (const deposit of allDeposits) {
            const depositPosition = deposit.getPosition();
            let canReach = false;

            for (const workerPos of workerPositions) {
                const distance = Vector3.Distance(workerPos, depositPosition);
                if (distance <= PLACEMENT_CONSTANTS.WORKER_MINING_RANGE) {
                    canReach = true;
                    break;
                }
            }

            if (canReach) {
                reachableNodes.push(deposit);
                totalCapacity += deposit.getCapacity();
            }
        }

        const workerCount = Math.min(10, reachableNodes.length * 2);

        let efficiency: 'high' | 'medium' | 'low';
        if (workerCount >= 8) {
            efficiency = 'high';
        } else if (workerCount >= 4) {
            efficiency = 'medium';
        } else {
            efficiency = 'low';
        }

        return {
            reachableNodes,
            workerCount,
            efficiency,
            totalCapacity
        };
    }

    public calculateWorkerFormationPositions(basePosition: Vector3): Vector3[] {
        const positions: Vector3[] = [];
        const workerCount = 10;
        const radius = PLACEMENT_CONSTANTS.WORKER_SPAWN_DISTANCE;

        for (let i = 0; i < workerCount; i++) {
            const angle = (Math.PI / (workerCount - 1)) * i - Math.PI / 2;
            const x = basePosition.x + Math.cos(angle) * radius;
            const z = basePosition.z + Math.sin(angle) * radius;
            const y = basePosition.y;

            positions.push(new Vector3(x, y, z));
        }

        return positions;
    }

    public getEfficiencyColor(efficiency: 'high' | 'medium' | 'low'): string {
        switch (efficiency) {
            case 'high': return '#00ff00';
            case 'medium': return '#ffff00';
            case 'low': return '#ff8800';
        }
    }
}
