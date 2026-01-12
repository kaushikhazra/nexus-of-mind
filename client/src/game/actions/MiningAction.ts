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
import { TerritoryManager } from '../TerritoryManager';

export interface MiningActionConfig extends EnergyConsumerConfig {
    miningRange: number; // Maximum distance to mine from
    energyPerSecond: number; // Energy cost per second of mining
    territoryManager?: TerritoryManager; // For liberation mining bonus
}

export class MiningAction extends EnergyConsumer {
    private miningConfig: MiningActionConfig;
    private currentTarget: MineralDeposit | null = null;
    private minerPosition: Vector3;
    private isMining: boolean = false;
    private miningStartTime: number = 0;
    private totalEnergyGenerated: number = 0;
    private territoryManager: TerritoryManager | null = null;

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
        this.territoryManager = config?.territoryManager || null;
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

        // Check if target is within mining range
        const distance = Vector3.Distance(this.minerPosition, target.getPosition());
        if (distance > this.miningConfig.miningRange) {
            return this.createResult(false, 0, 0, `Target too far (${distance.toFixed(1)}m > ${this.miningConfig.miningRange}m)`);
        }

        // Check initial energy cost
        const initialCost = this.config.baseCost;
        if (!this.canExecute()) {
            return this.createResult(false, 0, initialCost, 'Insufficient energy to start mining');
        }

        // Consume initial energy
        if (!this.consumeEnergy(initialCost, 'mining_startup')) {
            return this.createResult(false, 0, initialCost, 'Failed to consume startup energy');
        }

        // Start mining
        this.currentTarget = target;
        this.isMining = true;
        this.miningStartTime = performance.now();
        this.totalEnergyGenerated = 0;

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

        // Extract minerals (materials, not energy directly)
        // Apply liberation mining bonus if available (requirement 5.2)
        let miningSpeedMultiplier = 1.0;
        if (this.territoryManager) {
            const liberationBonus = this.territoryManager.getMiningBonusAt(this.minerPosition);
            miningSpeedMultiplier = 1.0 + liberationBonus; // 1.25x speed during liberation
        }
        
        const extractedMaterials = this.currentTarget.mine(deltaTime * miningSpeedMultiplier);

        if (extractedMaterials > 0) {
            // Add extracted materials to the system (power plants convert to energy)
            this.energyManager.generateMaterials(this.entityId, extractedMaterials, 'mining');
            this.totalEnergyGenerated += extractedMaterials; // Track total mined
        }

        // Check if deposit is depleted
        if (this.currentTarget.isDepleted()) {
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
     * Set territory manager for liberation bonus integration
     */
    public setTerritoryManager(territoryManager: TerritoryManager): void {
        this.territoryManager = territoryManager;
    }

    /**
     * Get current mining speed multiplier (including liberation bonus)
     */
    public getMiningSpeedMultiplier(): number {
        if (!this.territoryManager) {
            return 1.0;
        }
        
        const liberationBonus = this.territoryManager.getMiningBonusAt(this.minerPosition);
        return 1.0 + liberationBonus;
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
        miningSpeedMultiplier: number;
        liberationBonus: number;
    } {
        const duration = this.isMining ? (performance.now() - this.miningStartTime) / 1000 : 0;
        const energyCostRate = this.calculateEnergyCost();
        const extractionRate = this.currentTarget?.getStats().extractionRate || 0;
        const speedMultiplier = this.getMiningSpeedMultiplier();
        const netRate = (extractionRate * speedMultiplier) - energyCostRate;
        const liberationBonus = this.territoryManager?.getMiningBonusAt(this.minerPosition) || 0;

        return {
            isActive: this.isMining,
            target: this.currentTarget?.getId() || null,
            duration,
            totalGenerated: this.totalEnergyGenerated,
            netEnergyRate: netRate,
            miningSpeedMultiplier: speedMultiplier,
            liberationBonus
        };
    }

    /**
     * Dispose mining action
     */
    public dispose(): void {
        this.stopMining();
        super.dispose();
    }
}