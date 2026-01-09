/**
 * MovementAction - Energy consumption for unit movement
 * 
 * Implements energy costs for unit movement with distance-based calculation,
 * pathfinding integration, and real-time energy consumption during movement.
 */

import { Vector3 } from '@babylonjs/core';
import { EnergyConsumer, EnergyConsumptionResult, EnergyConsumerConfig } from '../EnergyConsumer';

export interface MovementActionConfig extends EnergyConsumerConfig {
    energyPerUnit: number; // Energy cost per unit distance
    maxSpeed: number; // Maximum movement speed (units per second)
    unitType: string; // Unit type for different movement costs
}

export interface MovementPath {
    waypoints: Vector3[];
    totalDistance: number;
    estimatedTime: number;
    estimatedEnergyCost: number;
}

export class MovementAction extends EnergyConsumer {
    private movementConfig: MovementActionConfig;
    private currentPosition: Vector3;
    private targetPosition: Vector3 | null = null;
    private movementPath: MovementPath | null = null;
    
    // Movement state
    private isMoving: boolean = false;
    
    // Range-based movement (for mining)
    private targetObject: any = null; // Object to move toward
    private stopAtRange: number | null = null; // Stop when within this range
    private movementStartTime: number = 0;
    private distanceTraveled: number = 0;
    private totalEnergyConsumed: number = 0;
    private currentWaypointIndex: number = 0;
    
    // Unit type energy costs
    public static readonly UNIT_MOVEMENT_COSTS: { [key: string]: number } = {
        worker: 0,      // No energy cost for movement (testing configuration)
        scout: 0.3,     // Scouts are more energy efficient
        protector: 0.8  // Protectors consume more energy due to weight
    };

    constructor(entityId: string, unitType: string, initialPosition: Vector3, config?: Partial<MovementActionConfig>) {
        const energyPerUnit = MovementAction.UNIT_MOVEMENT_COSTS[unitType] || 0.5;
        
        const movementConfig: MovementActionConfig = {
            baseCost: 0,    // No startup cost for movement (testing configuration)
            energyPerUnit,
            maxSpeed: 5.0, // 5 units per second default
            unitType,
            requiresReservation: false,
            canPartialExecute: true,
            ...config
        };

        super(entityId, `movement_${unitType}`, movementConfig);
        this.movementConfig = movementConfig;
        this.currentPosition = initialPosition.clone();
    }

    /**
     * Calculate energy cost for a specific distance
     */
    public calculateEnergyCost(distance?: number): number {
        const dist = distance || (this.movementPath?.totalDistance || 0);
        return dist * this.movementConfig.energyPerUnit * (this.config.costMultiplier || 1);
    }

    /**
     * Plan movement to target position
     */
    public planMovement(targetPosition: Vector3): MovementPath {
        // Simple direct path for now (can be enhanced with pathfinding later)
        const waypoints = [this.currentPosition.clone(), targetPosition.clone()];
        const totalDistance = Vector3.Distance(this.currentPosition, targetPosition);
        const estimatedTime = totalDistance / this.movementConfig.maxSpeed;
        const estimatedEnergyCost = this.calculateEnergyCost(totalDistance);

        return {
            waypoints,
            totalDistance,
            estimatedTime,
            estimatedEnergyCost
        };
    }

    /**
     * Start movement to target position
     */
    public async startMovement(targetPosition: Vector3): Promise<EnergyConsumptionResult> {
        return this.startMovementInternal(targetPosition, null, null);
    }

    /**
     * Start movement toward an object, stopping when within range
     */
    public async startMovementToRange(targetObject: any, stopAtRange: number): Promise<EnergyConsumptionResult> {
        const targetPosition = targetObject.getPosition();
        return this.startMovementInternal(targetPosition, targetObject, stopAtRange);
    }

    /**
     * Internal movement start method
     */
    private async startMovementInternal(targetPosition: Vector3, targetObject: any = null, stopAtRange: number | null = null): Promise<EnergyConsumptionResult> {
        if (this.isMoving) {
            return this.createResult(false, 0, 0, 'Already moving');
        }

        // Store range-based movement parameters
        this.targetObject = targetObject;
        this.stopAtRange = stopAtRange;

        // Plan the movement path
        this.movementPath = this.planMovement(targetPosition);
        this.targetPosition = targetPosition.clone();

        // Check if we have enough energy for the journey
        const totalEnergyCost = this.movementPath.estimatedEnergyCost;
        if (!this.canExecute()) {
            return this.createResult(false, 0, totalEnergyCost, 'Insufficient energy for movement');
        }

        // Consume startup energy
        const startupCost = this.config.baseCost;
        if (!this.consumeEnergy(startupCost, 'movement_startup')) {
            return this.createResult(false, 0, startupCost, 'Failed to consume startup energy');
        }

        // Start movement
        this.isMoving = true;
        this.movementStartTime = performance.now();
        this.distanceTraveled = 0;
        this.totalEnergyConsumed = startupCost;
        this.currentWaypointIndex = 0;

        return this.createResult(true, startupCost, totalEnergyCost);
    }

    /**
     * Execute movement progress (called each frame/update)
     */
    public async executeAction(deltaTime: number = 1.0): Promise<EnergyConsumptionResult> {
        if (!this.isMoving || !this.movementPath || !this.targetPosition) {
            return this.createResult(false, 0, 0, 'Not currently moving');
        }

        // Calculate movement distance for this frame
        const movementDistance = this.movementConfig.maxSpeed * deltaTime;
        const energyCostThisFrame = this.calculateEnergyCost(movementDistance);

        // Check if we have enough energy to continue
        if (!this.canExecute()) {
            this.stopMovement();
            return this.createResult(false, 0, energyCostThisFrame, 'Insufficient energy to continue movement');
        }

        // Consume energy for movement
        if (!this.consumeEnergy(energyCostThisFrame, 'movement_progress')) {
            this.stopMovement();
            return this.createResult(false, 0, energyCostThisFrame, 'Failed to consume movement energy');
        }

        // For range-based movement, check distance to target object
        if (this.targetObject && this.stopAtRange !== null) {
            const currentTargetPosition = this.targetObject.getPosition();
            const distanceToTarget = Vector3.Distance(this.currentPosition, currentTargetPosition);
            
            if (distanceToTarget <= this.stopAtRange) {
                // We're within range - stop here
                this.distanceTraveled += Vector3.Distance(this.currentPosition, this.currentPosition);
                this.totalEnergyConsumed += energyCostThisFrame;

                this.completeMovement();
                return this.createResult(true, energyCostThisFrame, energyCostThisFrame, 'Movement completed - within range');
            }
            
            // Update target position if object moved
            this.targetPosition = currentTargetPosition.clone();
        }

        // Ensure we have a valid target position
        if (!this.targetPosition) {
            this.stopMovement();
            return this.createResult(false, 0, energyCostThisFrame, 'No valid target position');
        }

        // Update position toward target
        const direction = this.targetPosition.subtract(this.currentPosition).normalize();
        const newPosition = this.currentPosition.add(direction.scale(movementDistance));
        
        // Check if we've reached the exact target position (for position-based movement)
        const remainingDistance = Vector3.Distance(newPosition, this.targetPosition);
        
        if (remainingDistance <= movementDistance && !this.targetObject) {
            // Reached exact target position (position-based movement only)
            this.currentPosition = this.targetPosition.clone();
            this.distanceTraveled += remainingDistance;
            this.totalEnergyConsumed += energyCostThisFrame;
            
            this.completeMovement();
            return this.createResult(true, energyCostThisFrame, energyCostThisFrame, 'Movement completed');
        } else {
            // Continue moving
            this.currentPosition = newPosition;
            this.distanceTraveled += movementDistance;
            this.totalEnergyConsumed += energyCostThisFrame;
        }

        return this.createResult(true, energyCostThisFrame, energyCostThisFrame);
    }

    /**
     * Complete movement
     */
    private completeMovement(): void {
        this.isMoving = false;
        this.targetPosition = null;
        this.movementPath = null;
        this.targetObject = null;
        this.stopAtRange = null;
    }

    /**
     * Stop movement (can be resumed later)
     */
    public stopMovement(): void {
        if (!this.isMoving) {
            return;
        }

        this.isMoving = false;
        this.targetObject = null;
        this.stopAtRange = null;
    }

    /**
     * Update current position (for external position updates)
     */
    public updatePosition(newPosition: Vector3): void {
        this.currentPosition = newPosition.clone();
    }

    /**
     * Get current position
     */
    public getCurrentPosition(): Vector3 {
        return this.currentPosition.clone();
    }

    /**
     * Get target position
     */
    public getTargetPosition(): Vector3 | null {
        return this.targetPosition?.clone() || null;
    }

    /**
     * Check if currently moving
     */
    public isMovementActive(): boolean {
        return this.isMoving;
    }

    /**
     * Get movement progress (0-1)
     */
    public getMovementProgress(): number {
        if (!this.movementPath || this.movementPath.totalDistance === 0) {
            return 0;
        }
        return Math.min(this.distanceTraveled / this.movementPath.totalDistance, 1.0);
    }

    /**
     * Get estimated time to reach target
     */
    public getEstimatedTimeToTarget(): number {
        if (!this.isMoving || !this.movementPath || !this.targetPosition) {
            return 0;
        }

        const remainingDistance = Vector3.Distance(this.currentPosition, this.targetPosition);
        return remainingDistance / this.movementConfig.maxSpeed;
    }

    /**
     * Get movement statistics
     */
    public getMovementStats(): {
        isActive: boolean;
        currentPosition: Vector3;
        targetPosition: Vector3 | null;
        progress: number;
        distanceTraveled: number;
        totalDistance: number;
        energyConsumed: number;
        estimatedTimeToTarget: number;
        unitType: string;
    } {
        return {
            isActive: this.isMoving,
            currentPosition: this.currentPosition.clone(),
            targetPosition: this.targetPosition?.clone() || null,
            progress: this.getMovementProgress(),
            distanceTraveled: this.distanceTraveled,
            totalDistance: this.movementPath?.totalDistance || 0,
            energyConsumed: this.totalEnergyConsumed,
            estimatedTimeToTarget: this.getEstimatedTimeToTarget(),
            unitType: this.movementConfig.unitType
        };
    }

    /**
     * Get unit movement cost for a unit type
     */
    public static getMovementCost(unitType: string): number {
        return MovementAction.UNIT_MOVEMENT_COSTS[unitType] || 0.5;
    }

    /**
     * Get all unit types and their movement costs
     */
    public static getUnitMovementCosts(): { [key: string]: number } {
        return { ...MovementAction.UNIT_MOVEMENT_COSTS };
    }

    /**
     * Dispose movement action
     */
    public dispose(): void {
        this.stopMovement();
        super.dispose();
    }
}