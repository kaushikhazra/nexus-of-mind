/**
 * EnergyManager - Global energy and materials economy management
 *
 * Manages the central economy system:
 * - Energy: Powers all game actions (combat, buildings, etc.)
 * - Materials: Mined from deposits, consumed by power plants to generate energy
 */

export interface EnergyTransaction {
    id: string;
    entityId: string;
    amount: number;
    type: 'generation' | 'consumption' | 'transfer';
    resource: 'energy' | 'materials';
    action: string;
    timestamp: number;
    success: boolean;
}

export interface EnergyStats {
    totalEnergy: number;
    totalMaterials: number;
    totalGeneration: number;
    totalConsumption: number;
    transactionCount: number;
    averageConsumptionRate: number;
    energyEfficiency: number;
}

export class EnergyManager {
    private static instance: EnergyManager | null = null;

    // Energy tracking
    private totalSystemEnergy: number = 0;
    private energyGenerationRate: number = 0;
    private energyConsumptionRate: number = 0;

    // Materials tracking (mined resources used by power plants)
    private totalMaterials: number = 0;
    private materialsGenerationRate: number = 0;
    private materialsConsumptionRate: number = 0;

    // Transaction history
    private transactions: EnergyTransaction[] = [];
    private transactionId: number = 0;

    // Performance tracking
    private lastUpdateTime: number = 0;
    private updateInterval: number = 1000; // Update rates every second

    // Event callbacks
    private onEnergyChangeCallbacks: ((stats: EnergyStats) => void)[] = [];
    private onLowEnergyCallbacks: ((entityId: string, currentEnergy: number) => void)[] = [];
    private onEnergyDepletedCallbacks: ((entityId: string) => void)[] = [];
    private onMaterialsChangeCallbacks: ((materials: number) => void)[] = [];

    private constructor() {
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): EnergyManager {
        if (!EnergyManager.instance) {
            EnergyManager.instance = new EnergyManager();
        }
        return EnergyManager.instance;
    }

    /**
     * Initialize energy system with starting values
     */
    public initialize(initialEnergy: number = 100, initialMaterials: number = 0): void {
        this.totalSystemEnergy = initialEnergy;
        this.totalMaterials = initialMaterials;
        this.lastUpdateTime = performance.now();

        this.notifyEnergyChange();
        this.notifyMaterialsChange();
    }

    /**
     * Validate if an energy transaction is possible
     */
    public canConsumeEnergy(entityId: string, amount: number): boolean {
        if (amount < 0) {
            return false;
        }

        // For now, check against total system energy
        // Later this will check specific entity storage
        return this.totalSystemEnergy >= amount;
    }

    /**
     * Consume energy for an action
     */
    public consumeEnergy(entityId: string, amount: number, action: string): boolean {
        if (!this.canConsumeEnergy(entityId, amount)) {
            this.recordTransaction(entityId, -amount, 'consumption', 'energy', action, false);
            return false;
        }

        // Deduct energy
        this.totalSystemEnergy -= amount;
        this.energyConsumptionRate += amount;

        // Record successful transaction
        this.recordTransaction(entityId, -amount, 'consumption', 'energy', action, true);

        this.notifyEnergyChange();

        // Check for low energy warnings
        this.checkEnergyLevels(entityId);

        return true;
    }

    /**
     * Generate energy (from power plants consuming materials)
     */
    public generateEnergy(entityId: string, amount: number, source: string): void {
        if (amount <= 0) {
            return;
        }

        // Add energy to system
        this.totalSystemEnergy += amount;
        this.energyGenerationRate += amount;

        // Record transaction
        this.recordTransaction(entityId, amount, 'generation', 'energy', source, true);

        this.notifyEnergyChange();
    }

    /**
     * Transfer energy between entities
     */
    public transferEnergy(fromEntityId: string, toEntityId: string, amount: number): boolean {
        if (!this.canConsumeEnergy(fromEntityId, amount)) {
            return false;
        }

        // For now, just record the transaction (no actual entity-to-entity transfer yet)
        this.recordTransaction(fromEntityId, -amount, 'transfer', 'energy', `transfer_to_${toEntityId}`, true);
        this.recordTransaction(toEntityId, amount, 'transfer', 'energy', `transfer_from_${fromEntityId}`, true);

        this.notifyEnergyChange();

        return true;
    }

    // ==================== MATERIALS MANAGEMENT ====================

    /**
     * Check if materials can be consumed
     */
    public canConsumeMaterials(amount: number): boolean {
        if (amount < 0) {
            return false;
        }
        return this.totalMaterials >= amount;
    }

    /**
     * Generate materials (from mining)
     */
    public generateMaterials(entityId: string, amount: number, source: string): void {
        if (amount <= 0) {
            return;
        }

        this.totalMaterials += amount;
        this.materialsGenerationRate += amount;

        this.recordTransaction(entityId, amount, 'generation', 'materials', source, true);
        this.notifyMaterialsChange();
        this.notifyEnergyChange();
    }

    /**
     * Consume materials (by power plants to generate energy)
     */
    public consumeMaterials(entityId: string, amount: number, action: string): boolean {
        if (!this.canConsumeMaterials(amount)) {
            return false;
        }

        this.totalMaterials -= amount;
        this.materialsConsumptionRate += amount;

        this.recordTransaction(entityId, -amount, 'consumption', 'materials', action, true);
        this.notifyMaterialsChange();
        this.notifyEnergyChange();

        return true;
    }

    /**
     * Get current total materials
     */
    public getTotalMaterials(): number {
        return this.totalMaterials;
    }

    /**
     * Notify listeners of materials changes
     */
    private notifyMaterialsChange(): void {
        this.onMaterialsChangeCallbacks.forEach(callback => callback(this.totalMaterials));
    }

    /**
     * Subscribe to materials change events
     */
    public onMaterialsChange(callback: (materials: number) => void): void {
        this.onMaterialsChangeCallbacks.push(callback);
    }

    /**
     * Get current total system energy
     */
    public getTotalEnergy(): number {
        return this.totalSystemEnergy;
    }

    /**
     * Get current energy generation rate (per second)
     */
    public getGenerationRate(): number {
        return this.energyGenerationRate;
    }

    /**
     * Get current energy consumption rate (per second)
     */
    public getConsumptionRate(): number {
        return this.energyConsumptionRate;
    }

    /**
     * Get comprehensive energy and materials statistics
     */
    public getEnergyStats(): EnergyStats {
        const successfulTransactions = this.transactions.filter(t => t.success && t.resource === 'energy');
        const totalGeneration = successfulTransactions
            .filter(t => t.type === 'generation')
            .reduce((sum, t) => sum + t.amount, 0);
        const totalConsumption = Math.abs(successfulTransactions
            .filter(t => t.type === 'consumption')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0));

        return {
            totalEnergy: this.totalSystemEnergy,
            totalMaterials: this.totalMaterials,
            totalGeneration,
            totalConsumption,
            transactionCount: this.transactions.length,
            averageConsumptionRate: this.energyConsumptionRate,
            energyEfficiency: totalGeneration > 0 ? (totalGeneration - totalConsumption) / totalGeneration : 0
        };
    }

    /**
     * Get recent transaction history
     */
    public getRecentTransactions(count: number = 10): EnergyTransaction[] {
        return this.transactions.slice(-count);
    }

    /**
     * Update energy and materials rates (called from game loop)
     */
    public update(): void {
        const now = performance.now();

        if (now - this.lastUpdateTime >= this.updateInterval) {
            // Reset rates for next measurement period
            this.energyGenerationRate = 0;
            this.energyConsumptionRate = 0;
            this.materialsGenerationRate = 0;
            this.materialsConsumptionRate = 0;
            this.lastUpdateTime = now;
        }
    }

    /**
     * Record a transaction
     */
    private recordTransaction(
        entityId: string,
        amount: number,
        type: EnergyTransaction['type'],
        resource: 'energy' | 'materials',
        action: string,
        success: boolean
    ): void {
        const transaction: EnergyTransaction = {
            id: `txn_${++this.transactionId}`,
            entityId,
            amount,
            type,
            resource,
            action,
            timestamp: performance.now(),
            success
        };

        this.transactions.push(transaction);

        // Keep only last 100 transactions for memory efficiency
        if (this.transactions.length > 100) {
            this.transactions.shift();
        }
    }

    /**
     * Check energy levels and trigger warnings
     */
    private checkEnergyLevels(entityId: string): void {
        const lowEnergyThreshold = 20;
        const criticalEnergyThreshold = 5;
        
        if (this.totalSystemEnergy <= criticalEnergyThreshold) {
            this.onEnergyDepletedCallbacks.forEach(callback => callback(entityId));
        } else if (this.totalSystemEnergy <= lowEnergyThreshold) {
            this.onLowEnergyCallbacks.forEach(callback => callback(entityId, this.totalSystemEnergy));
        }
    }

    /**
     * Notify listeners of energy changes
     */
    private notifyEnergyChange(): void {
        const stats = this.getEnergyStats();
        this.onEnergyChangeCallbacks.forEach(callback => callback(stats));
    }

    /**
     * Subscribe to energy change events
     */
    public onEnergyChange(callback: (stats: EnergyStats) => void): void {
        this.onEnergyChangeCallbacks.push(callback);
    }

    /**
     * Subscribe to low energy warnings
     */
    public onLowEnergy(callback: (entityId: string, currentEnergy: number) => void): void {
        this.onLowEnergyCallbacks.push(callback);
    }

    /**
     * Subscribe to energy depletion alerts
     */
    public onEnergyDepleted(callback: (entityId: string) => void): void {
        this.onEnergyDepletedCallbacks.push(callback);
    }

    /**
     * Reset energy system (for testing or game restart)
     */
    public reset(): void {
        this.totalSystemEnergy = 0;
        this.energyGenerationRate = 0;
        this.energyConsumptionRate = 0;
        this.totalMaterials = 0;
        this.materialsGenerationRate = 0;
        this.materialsConsumptionRate = 0;
        this.transactions = [];
        this.transactionId = 0;

        this.notifyEnergyChange();
        this.notifyMaterialsChange();
    }

    /**
     * Dispose energy manager
     */
    public dispose(): void {
        this.onEnergyChangeCallbacks = [];
        this.onLowEnergyCallbacks = [];
        this.onEnergyDepletedCallbacks = [];
        this.onMaterialsChangeCallbacks = [];
        this.transactions = [];

        EnergyManager.instance = null;
    }
}