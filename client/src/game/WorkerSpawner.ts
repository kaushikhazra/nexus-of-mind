/**
 * WorkerSpawner - Handles worker creation and spawning logic
 * 
 * Manages worker spawning near base buildings with proper positioning
 * and integration with the unit management system.
 */

import { Vector3 } from '@babylonjs/core';
import { UnitManager } from './UnitManager';
import { BuildingManager } from './BuildingManager';
import { Worker } from './entities/Worker';

export interface WorkerSpawnResult {
    success: boolean;
    worker?: Worker;
    message: string;
    position?: Vector3;
}

export class WorkerSpawner {
    private unitManager: UnitManager;
    private buildingManager: BuildingManager;

    constructor(unitManager: UnitManager, buildingManager: BuildingManager) {
        this.unitManager = unitManager;
        this.buildingManager = buildingManager;
        console.log('👷 WorkerSpawner initialized');
    }

    /**
     * Spawn a new worker near the player's base
     */
    public spawnWorker(): WorkerSpawnResult {
        try {
            // Find spawn position near base
            const spawnPosition = this.findSpawnPosition();
            if (!spawnPosition) {
                return {
                    success: false,
                    message: 'No suitable spawn location found'
                };
            }

            // Create worker using UnitManager
            const worker = this.unitManager.createUnit('worker', spawnPosition);
            if (!worker) {
                return {
                    success: false,
                    message: 'Failed to create worker unit'
                };
            }

            console.log(`👷 Worker spawned successfully at ${spawnPosition.toString()}`);
            
            return {
                success: true,
                worker: worker as Worker,
                message: 'Worker created successfully',
                position: spawnPosition
            };

        } catch (error) {
            console.error('❌ Error spawning worker:', error);
            return {
                success: false,
                message: `Spawn error: ${error}`
            };
        }
    }

    /**
     * Find a suitable spawn position near the player's base
     */
    private findSpawnPosition(): Vector3 | null {
        // Try to find player's base building
        const basePosition = this.findBasePosition();
        
        if (basePosition) {
            // Spawn near the base with some random offset
            return this.calculateSpawnNearBase(basePosition);
        } else {
            // No base found, spawn at origin with offset
            console.warn('⚠️ No base building found, spawning at origin');
            return this.calculateSpawnAtOrigin();
        }
    }

    /**
     * Find the position of the player's base building
     */
    private findBasePosition(): Vector3 | null {
        try {
            // Get all buildings from BuildingManager
            const buildings = this.buildingManager.getAllBuildings();
            
            // Look for base buildings
            const baseBuildingTypes = ['base', 'command_center', 'headquarters'];
            
            for (const building of buildings) {
                const buildingType = building.getBuildingType();
                if (baseBuildingTypes.includes(buildingType.id.toLowerCase())) {
                    const position = building.getPosition();
                    console.log(`🏗️ Found base building at ${position.toString()}`);
                    return position;
                }
            }
            
            // If no specific base building, use any building as reference
            if (buildings.length > 0) {
                const position = buildings[0].getPosition();
                console.log(`🏗️ Using first building as spawn reference at ${position.toString()}`);
                return position;
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Error finding base position:', error);
            return null;
        }
    }

    /**
     * Calculate spawn position near base building
     */
    private calculateSpawnNearBase(basePosition: Vector3): Vector3 {
        // Spawn 5-10 units away from base in a random direction
        const distance = 5 + Math.random() * 5; // 5-10 units
        const angle = Math.random() * Math.PI * 2; // Random angle
        
        const spawnX = basePosition.x + Math.cos(angle) * distance;
        const spawnZ = basePosition.z + Math.sin(angle) * distance;
        const spawnY = basePosition.y; // Same height as base
        
        const spawnPosition = new Vector3(spawnX, spawnY, spawnZ);
        console.log(`📍 Calculated spawn position near base: ${spawnPosition.toString()}`);
        
        return spawnPosition;
    }

    /**
     * Calculate spawn position at origin (fallback)
     */
    private calculateSpawnAtOrigin(): Vector3 {
        // Spawn near origin with random offset
        const offsetX = (Math.random() - 0.5) * 10; // -5 to +5
        const offsetZ = (Math.random() - 0.5) * 10; // -5 to +5
        
        const spawnPosition = new Vector3(offsetX, 0, offsetZ);
        console.log(`📍 Calculated spawn position at origin: ${spawnPosition.toString()}`);
        
        return spawnPosition;
    }

    /**
     * Validate spawn position is clear (future enhancement)
     */
    private isPositionClear(position: Vector3): boolean {
        // TODO: Implement collision detection with other units/buildings
        // For now, assume all positions are clear
        return true;
    }

    /**
     * Get spawn statistics
     */
    public getSpawnStats(): {
        totalWorkers: number;
        basePosition: Vector3 | null;
        lastSpawnPosition: Vector3 | null;
    } {
        const workers = this.unitManager.getUnitsByType('worker');
        const basePosition = this.findBasePosition();
        
        return {
            totalWorkers: workers.length,
            basePosition,
            lastSpawnPosition: null // Could track this if needed
        };
    }

    /**
     * Check if spawning is possible
     */
    public canSpawn(): boolean {
        // Basic checks - could be expanded
        try {
            const spawnPosition = this.findSpawnPosition();
            return spawnPosition !== null;
        } catch (error) {
            console.error('❌ Error checking spawn capability:', error);
            return false;
        }
    }
}