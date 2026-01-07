/**
 * Scout - Scout unit specialization with exploration and discovery abilities
 * 
 * Scouts are fast, energy-efficient units designed for exploration and reconnaissance.
 * They excel at discovering hidden mineral deposits and mapping unknown territories,
 * providing crucial intelligence for strategic planning.
 */

import { Vector3 } from '@babylonjs/core';
import { Unit, UnitConfig } from './Unit';

export class Scout extends Unit {
    // Scout-specific properties
    private explorationRadius: number = 8.0; // How far scout can see/explore
    private discoveryEfficiency: number = 1.0; // Discovery speed multiplier
    private stealthLevel: number = 1.0; // Stealth capability (future combat feature)
    private exploredAreas: Set<string> = new Set(); // Track explored coordinates
    private discoveredDeposits: string[] = []; // Track discovered mineral deposits

    constructor(position: Vector3, config?: Partial<UnitConfig>) {
        const scoutConfig: UnitConfig = {
            unitType: 'scout',
            position,
            energyStorage: {
                capacity: 40, // 5x multiplier (was 8)
                initialEnergy: 30, // 5x multiplier (was 6) - Start with 75% energy for immediate exploration
                transferRate: 3.0, // Fast energy transfer for quick missions
                efficiency: 1.2 // High efficiency for extended exploration
            },
            maxHealth: 60, // Lowest health - scouts avoid combat
            movementSpeed: 7.0, // Fastest movement speed
            actionCooldown: 0.3, // Very quick actions for rapid exploration
            ...config
        };

        super(scoutConfig);
        
        console.log(`🔍 Scout unit ${this.getId()} ready for exploration and reconnaissance`);
    }

    /**
     * Scouts cannot mine (not their specialization)
     */
    public canMine(): boolean {
        return false;
    }

    /**
     * Scouts cannot build (not their specialization)
     */
    public canBuild(): boolean {
        return false;
    }

    /**
     * Scouts don't mine, so no mining range
     */
    public getMiningRange(): number {
        return 0;
    }

    /**
     * Scouts don't mine, so no mining energy cost
     */
    public getMiningEnergyCost(): number {
        return 0;
    }

    /**
     * Get scout-specific special abilities
     */
    public getSpecialAbilities(): string[] {
        return [
            'fast_movement',
            'mineral_discovery',
            'area_exploration',
            'stealth_movement',
            'long_range_scouting'
        ];
    }

    /**
     * Enhanced movement with speed bonus
     */
    public async startMovement(targetPosition: Vector3): Promise<boolean> {
        const success = await super.startMovement(targetPosition);
        
        if (success && this.currentMovementAction) {
            console.log(`🏃 Scout ${this.getId()} moving at high speed to ${targetPosition.toString()}`);
            
            // Mark areas as explored during movement
            this.markAreaAsExplored(this.getPosition());
            this.markAreaAsExplored(targetPosition);
        }
        
        return success;
    }

    /**
     * Discover hidden mineral deposits in the area
     */
    public async discoverMinerals(terrainGenerator: any): Promise<number> {
        if (!this.canPerformAction()) {
            return 0;
        }

        const discoveryCost = 1.0; // 1 energy per discovery attempt
        if (this.energyStorage.getCurrentEnergy() < discoveryCost) {
            console.warn(`⚠️ Scout ${this.getId()} insufficient energy for mineral discovery`);
            return 0;
        }

        // Consume energy for discovery
        if (!this.energyStorage.removeEnergy(discoveryCost, 'mineral_discovery')) {
            return 0;
        }

        let discoveredCount = 0;
        
        try {
            // Get nearby mineral deposits
            const nearbyDeposits = terrainGenerator.getMineralDepositsNear(
                this.getPosition(), 
                this.explorationRadius
            );

            // Discover hidden deposits
            for (const deposit of nearbyDeposits) {
                if (!deposit.isVisible() && !this.discoveredDeposits.includes(deposit.getId())) {
                    // Attempt to discover based on efficiency
                    if (Math.random() < this.discoveryEfficiency * 0.7) { // 70% base chance
                        const scene = null; // TODO: Get scene reference
                        const materialManager = null; // TODO: Get material manager reference
                        
                        if (deposit.discover(scene, materialManager)) {
                            this.discoveredDeposits.push(deposit.getId());
                            discoveredCount++;
                            console.log(`💎 Scout ${this.getId()} discovered hidden mineral deposit!`);
                        }
                    }
                }
            }

            this.lastActionTime = performance.now();
            
            if (discoveredCount > 0) {
                console.log(`🔍 Scout ${this.getId()} discovered ${discoveredCount} mineral deposits`);
            } else {
                console.log(`🔍 Scout ${this.getId()} found no new mineral deposits in area`);
            }

        } catch (error) {
            console.error(`❌ Discovery error for scout ${this.getId()}:`, error);
        }

        return discoveredCount;
    }

    /**
     * Explore an area and mark it as explored
     */
    public async exploreArea(centerPosition: Vector3): Promise<boolean> {
        if (!this.canPerformAction()) {
            return false;
        }

        const explorationCost = 0.5; // 0.5 energy per area exploration
        if (this.energyStorage.getCurrentEnergy() < explorationCost) {
            console.warn(`⚠️ Scout ${this.getId()} insufficient energy for area exploration`);
            return false;
        }

        // Consume energy for exploration
        if (!this.energyStorage.removeEnergy(explorationCost, 'area_exploration')) {
            return false;
        }

        // Mark area as explored
        this.markAreaAsExplored(centerPosition);
        
        // Mark surrounding areas as explored based on exploration radius
        const gridSize = 2; // 2x2 unit grid
        for (let x = -this.explorationRadius; x <= this.explorationRadius; x += gridSize) {
            for (let z = -this.explorationRadius; z <= this.explorationRadius; z += gridSize) {
                const distance = Math.sqrt(x * x + z * z);
                if (distance <= this.explorationRadius) {
                    const explorePos = centerPosition.add(new Vector3(x, 0, z));
                    this.markAreaAsExplored(explorePos);
                }
            }
        }

        this.lastActionTime = performance.now();
        console.log(`🗺️ Scout ${this.getId()} explored area around ${centerPosition.toString()}`);
        
        return true;
    }

    /**
     * Mark an area as explored
     */
    private markAreaAsExplored(position: Vector3): void {
        const gridSize = 2; // 2x2 unit grid for exploration tracking
        const gridX = Math.floor(position.x / gridSize);
        const gridZ = Math.floor(position.z / gridSize);
        const areaKey = `${gridX}_${gridZ}`;
        
        if (!this.exploredAreas.has(areaKey)) {
            this.exploredAreas.add(areaKey);
        }
    }

    /**
     * Check if an area has been explored
     */
    public isAreaExplored(position: Vector3): boolean {
        const gridSize = 2;
        const gridX = Math.floor(position.x / gridSize);
        const gridZ = Math.floor(position.z / gridSize);
        const areaKey = `${gridX}_${gridZ}`;
        
        return this.exploredAreas.has(areaKey);
    }

    /**
     * Get exploration coverage percentage in a region
     */
    public getExplorationCoverage(centerPosition: Vector3, radius: number): number {
        const gridSize = 2;
        let totalAreas = 0;
        let exploredAreas = 0;

        for (let x = -radius; x <= radius; x += gridSize) {
            for (let z = -radius; z <= radius; z += gridSize) {
                const distance = Math.sqrt(x * x + z * z);
                if (distance <= radius) {
                    totalAreas++;
                    const checkPos = centerPosition.add(new Vector3(x, 0, z));
                    if (this.isAreaExplored(checkPos)) {
                        exploredAreas++;
                    }
                }
            }
        }

        return totalAreas > 0 ? exploredAreas / totalAreas : 0;
    }

    /**
     * Upgrade exploration radius
     */
    public upgradeExplorationRadius(bonus: number): void {
        this.explorationRadius += bonus;
        console.log(`⬆️ Scout ${this.getId()} exploration radius upgraded to ${this.explorationRadius}`);
    }

    /**
     * Upgrade discovery efficiency
     */
    public upgradeDiscoveryEfficiency(bonus: number): void {
        this.discoveryEfficiency += bonus;
        console.log(`⬆️ Scout ${this.getId()} discovery efficiency upgraded to ${this.discoveryEfficiency}x`);
    }

    /**
     * Upgrade stealth level (for future combat features)
     */
    public upgradeStealthLevel(bonus: number): void {
        this.stealthLevel += bonus;
        console.log(`⬆️ Scout ${this.getId()} stealth level upgraded to ${this.stealthLevel}x`);
    }

    /**
     * Get scout-specific statistics
     */
    public getScoutStats(): any {
        const baseStats = this.getStats();
        return {
            ...baseStats,
            explorationRadius: this.explorationRadius,
            discoveryEfficiency: this.discoveryEfficiency,
            stealthLevel: this.stealthLevel,
            areasExplored: this.exploredAreas.size,
            depositsDiscovered: this.discoveredDeposits.length,
            exploredAreasList: Array.from(this.exploredAreas)
        };
    }

    /**
     * Get list of discovered mineral deposits
     */
    public getDiscoveredDeposits(): string[] {
        return [...this.discoveredDeposits];
    }

    /**
     * Get total areas explored
     */
    public getTotalAreasExplored(): number {
        return this.exploredAreas.size;
    }

    /**
     * Scout-specific update logic
     */
    public update(deltaTime: number): void {
        super.update(deltaTime);
        
        // Auto-explore current area if not moving and has energy
        if (!this.getCurrentAction() && this.energyStorage.getCurrentEnergy() > 2) {
            const currentPos = this.getPosition();
            if (!this.isAreaExplored(currentPos)) {
                // Auto-explore current area
                this.exploreArea(currentPos);
            }
        }
    }

    /**
     * Enhanced dispose with scout-specific cleanup
     */
    public dispose(): void {
        // Clear exploration data
        this.exploredAreas.clear();
        this.discoveredDeposits = [];
        
        console.log(`🔍 Scout ${this.getId()} exploration data cleared`);
        super.dispose();
    }
}