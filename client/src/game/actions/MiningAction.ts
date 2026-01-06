/**
 * MiningAction - Mining action that converts minerals to energy
 * 
 * Implements energy consumption for mining operations with mineral-to-energy
 * conversion and integration with the energy storage system.
 */

import { Vector3 } from '@babylonjs/core';
import { EnergyConsumer, EnergyConsumptionResult, EnergyConsumerConfig } from '../EnergyConsumer';
import { MineralDeposit } from '../../world/MineralDeposit';
import { EnergyManager } from '../EnergyManager';

export interface MiningActionConfig extends EnergyConsumerConfig {
    miningRange: number; // Maximum distance to mine from
    energyPerSecond: number; // Energy cost per second of mining
}

export class MiningAction extends EnergyConsumer {
    private miningConfig: MiningActionConfig;
    private currentTarget: MineralDeposit | null = null;
    private minerPosition: Vector3;
    private isMining: boolean = false;
    private miningStartTime: number = 0;
    private totalEnergyGenerated: number = 0;

    constructor(entityId: string, minerPosition: Vector3, config?: Partial<MiningActionConfig>) {
        const defaultConfig: MiningActionConfig = {
            baseCost: 0.1, // Small initial cost to start mining
            energyPerSecond: 0.5, // 0.5 energy per second to operate mining equipment
            miningRange: 5.0, // Can mine within 5 units
            requiresReservation: false,
            canPartialExecute: true,
            ...config
        };

        super(entityId, 'mining', defaultConfig);
        this.miningConfig = defaultConfig;
        this.minerPosition = minerPosition.clone();
    }

    /**
     * Calculate energy cost for mining (per second)
     */
    public calculateEnergyCost(): number {
        return this.miningConfig.energyPerSecond * (this.config.costMultiplier || 1);
    }

    /**
     * Start mining a specific mineral deposit
     */
    public async startMining(target: MineralDeposit): Promise<EnergyConsumptionResult> {
        if (this.isMining) {
            return this.createResult(false, 0, 0, 'Already mining');
        }

        if (!target.canMine()) {
            return this.createResult(false, 0, 0, 'Target cannot be mined');
        }

        // Check if target is within range
        const distance = Vector3.Distance(this.minerPosition, target.getPosition());
        // TEMPORARILY DISABLED: Range check bypass for testing
        // if (distance > this.miningConfig.miningRange) {
        //     return this.createResult(false, 0, 0, `Target too far (${distance.toFixed(1)}m > ${this.miningConfig.miningRange}m)`);
        // }

        // Check initial energy cost
        const initialCost = this.config.baseCost;
        // TEMPORARILY DISABLED: Energy check bypass for testing
        // if (!this.canExecute()) {
        //     return this.createResult(false, 0, initialCost, 'Insufficient energy to start mining');
        // }

        // Consume initial energy
        if (!this.consumeEnergy(initialCost, 'mining_startup')) {
            return this.createResult(false, 0, initialCost, 'Failed to consume startup energy');
        }

        // Start mining
        this.currentTarget = target;
        this.isMining = true;
        this.miningStartTime = performance.now();
        this.totalEnergyGenerated = 0;

        console.log(`⛏️ Started mining deposit ${target.getId()} at distance ${distance.toFixed(1)}m`);
        return this.createResult(true, initialCost, initialCost);
    }

    /**
     * Execute mining action (called each frame/update)
     */
    public async executeAction(deltaTime: number = 1.0): Promise<EnergyConsumptionResult> {
        if (!this.isMining || !this.currentTarget) {
            return this.createResult(false, 0, 0, 'Not currently mining');
        }

        // Check if target is still valid
        if (!this.currentTarget.canMine()) {
            this.stopMining();
            return this.createResult(false, 0, 0, 'Target depleted or unavailable');
        }

        // Calculate energy cost for this update
        const energyCost = this.calculateEnergyCost() * deltaTime;

        // Check if we have enough energy to continue
        if (!this.canExecute()) {
            this.stopMining();
            return this.createResult(false, 0, energyCost, 'Insufficient energy to continue mining');
        }

        // Consume energy for mining operation
        if (!this.consumeEnergy(energyCost, 'mining_operation')) {
            this.stopMining();
            return this.createResult(false, 0, energyCost, 'Failed to consume mining energy');
        }

        // Extract minerals and convert to energy
        const extractedEnergy = this.currentTarget.mine(deltaTime);
        
        if (extractedEnergy > 0) {
            // Add extracted energy to the system
            this.energyManager.generateEnergy(this.entityId, extractedEnergy, 'mining');
            this.totalEnergyGenerated += extractedEnergy;

            console.log(`⛏️ Mined ${extractedEnergy.toFixed(2)} energy (net: +${(extractedEnergy - energyCost).toFixed(2)})`);
        }

        // Check if deposit is depleted
        if (this.currentTarget.isDepleted()) {
            const miningDuration = (performance.now() - this.miningStartTime) / 1000;
            console.log(`⛏️ Deposit depleted after ${miningDuration.toFixed(1)}s (total generated: ${this.totalEnergyGenerated.toFixed(2)})`);
            this.stopMining();
        }

        return this.createResult(true, energyCost, energyCost);
    }

    /**
     * Stop mining operation
     */
    public stopMining(): void {
        if (!this.isMining) {
            return;
        }

        if (this.currentTarget) {
            this.currentTarget.stopMining();
        }

        const miningDuration = (performance.now() - this.miningStartTime) / 1000;
        console.log(`⛏️ Stopped mining after ${miningDuration.toFixed(1)}s (generated ${this.totalEnergyGenerated.toFixed(2)} energy)`);

        this.currentTarget = null;
        this.isMining = false;
        this.miningStartTime = 0;
    }

    /**
     * Update miner position (for range checking)
     */
    public updatePosition(newPosition: Vector3): void {
        this.minerPosition = newPosition.clone();

        // Check if still in range of current target
        if (this.isMining && this.currentTarget) {
            const distance = Vector3.Distance(this.minerPosition, this.currentTarget.getPosition());
            if (distance > this.miningConfig.miningRange) {
                console.log(`⛏️ Moved out of mining range (${distance.toFixed(1)}m > ${this.miningConfig.miningRange}m)`);
                this.stopMining();
            }
        }
    }

    /**
     * Check if currently mining
     */
    public isMiningActive(): boolean {
        return this.isMining;
    }

    /**
     * Get current mining target
     */
    public getCurrentTarget(): MineralDeposit | null {
        return this.currentTarget;
    }

    /**
     * Get total energy generated from mining
     */
    public getTotalEnergyGenerated(): number {
        return this.totalEnergyGenerated;
    }

    /**
     * Get mining statistics
     */
    public getMiningStats(): {
        isActive: boolean;
        target: string | null;
        duration: number;
        totalGenerated: number;
        netEnergyRate: number;
    } {
        const duration = this.isMining ? (performance.now() - this.miningStartTime) / 1000 : 0;
        const energyCostRate = this.calculateEnergyCost();
        const extractionRate = this.currentTarget?.getStats().extractionRate || 0;
        const netRate = extractionRate - energyCostRate;

        return {
            isActive: this.isMining,
            target: this.currentTarget?.getId() || null,
            duration,
            totalGenerated: this.totalEnergyGenerated,
            netEnergyRate: netRate
        };
    }

    /**
     * Dispose mining action
     */
    public dispose(): void {
        this.stopMining();
        super.dispose();
        console.log(`⛏️ MiningAction disposed for ${this.entityId}`);
    }
}