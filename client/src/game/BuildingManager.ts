/**
 * BuildingManager - Building placement and management system
 * 
 * Manages building lifecycle, placement validation, construction progress,
 * and integration with the unit system for worker-based construction.
 */

import { Vector3 } from '@babylonjs/core';
import { Building } from './entities/Building';
import { BuildingAction, BuildingType } from './actions/BuildingAction';
import { GameState } from './GameState';
import { BuildingRenderer, BuildingVisual } from '../rendering/BuildingRenderer';
import { EnergyManager } from './EnergyManager';

export interface BuildingPlacement {
    buildingType: BuildingType;
    position: Vector3;
    constructorId: string;
    isValid: boolean;
    reason?: string;
}

export interface BuildingManagerStats {
    totalBuildings: number;
    activeBuildings: number;
    completedBuildings: number;
    underConstruction: number;
    buildingsByType: { [key: string]: number };
    totalEnergyGeneration: number;
}

export class BuildingManager {
    private gameState: GameState;
    private buildingRenderer: BuildingRenderer;
    private energyManager: EnergyManager;
    
    // Building management
    private buildings: Map<string, Building> = new Map();
    private constructionActions: Map<string, BuildingAction> = new Map();
    
    // Placement validation
    private minBuildingDistance: number = 5.0; // Minimum distance between buildings
    private maxBuildingDistance: number = 15.0; // Maximum distance from constructor

    // Energy Lords upgrade bonus (percentage, e.g., 10 = 10% bonus)
    private energyGenerationBonus: number = 0;

    constructor(gameState: GameState, buildingRenderer: BuildingRenderer, energyManager: EnergyManager) {
        this.gameState = gameState;
        this.buildingRenderer = buildingRenderer;
        this.energyManager = energyManager;
    }

    /**
     * Validate building placement
     */
    public validatePlacement(buildingTypeId: string, position: Vector3, constructorId: string): BuildingPlacement {
        const buildingType = BuildingAction.getBuildingType(buildingTypeId);
        
        if (!buildingType) {
            return {
                buildingType: buildingType!,
                position,
                constructorId,
                isValid: false,
                reason: `Unknown building type: ${buildingTypeId}`
            };
        }

        // Check if position is clear (no other buildings nearby)
        for (const building of this.buildings.values()) {
            const distance = Vector3.Distance(position, building.getPosition());
            if (distance < this.minBuildingDistance) {
                return {
                    buildingType,
                    position,
                    constructorId,
                    isValid: false,
                    reason: `Too close to existing building (${distance.toFixed(1)}m < ${this.minBuildingDistance}m)`
                };
            }
        }

        // Check if constructor is within range (if constructor exists)
        const constructor = this.gameState.getUnit(constructorId);
        if (constructor) {
            const distance = Vector3.Distance(position, constructor.position);
            if (distance > this.maxBuildingDistance) {
                return {
                    buildingType,
                    position,
                    constructorId,
                    isValid: false,
                    reason: `Too far from constructor (${distance.toFixed(1)}m > ${this.maxBuildingDistance}m)`
                };
            }
        }

        // Check if constructor has enough energy
        const energyCost = buildingType.energyCost;
        if (!this.energyManager.canConsumeEnergy(constructorId, energyCost)) {
            return {
                buildingType,
                position,
                constructorId,
                isValid: false,
                reason: `Insufficient energy (need ${energyCost}, have ${this.energyManager.getTotalEnergy()})`
            };
        }

        return {
            buildingType,
            position,
            constructorId,
            isValid: true
        };
    }

    /**
     * Start building construction
     */
    public async startConstruction(buildingTypeId: string, position: Vector3, constructorId: string): Promise<Building | null> {
        // Validate placement
        const placement = this.validatePlacement(buildingTypeId, position, constructorId);
        if (!placement.isValid) {
            return null;
        }

        try {
            // Create building entity
            const building = new Building(placement.buildingType, position, constructorId);
            
            // Create construction action
            const constructionAction = new BuildingAction(buildingTypeId, position, constructorId);
            const result = await constructionAction.startConstruction();
            
            if (!result.success) {
                building.dispose();
                return null;
            }

            // Add to buildings map
            this.buildings.set(building.getId(), building);
            this.constructionActions.set(building.getId(), constructionAction);

            // Create visual representation
            const buildingVisual = this.buildingRenderer.createBuildingVisual(building);
            if (!buildingVisual) {
                this.buildings.delete(building.getId());
                this.constructionActions.delete(building.getId());
                building.dispose();
                constructionAction.dispose();
                return null;
            }

            // Setup building event callbacks
            this.setupBuildingCallbacks(building);

            return building;

        } catch (error) {
            return null;
        }
    }

    /**
     * Setup event callbacks for a building
     */
    private setupBuildingCallbacks(building: Building): void {
        building.onCompleted((completedBuilding) => {
            // Remove construction action
            const constructionAction = this.constructionActions.get(completedBuilding.getId());
            if (constructionAction) {
                constructionAction.dispose();
                this.constructionActions.delete(completedBuilding.getId());
            }
            
            // Setup energy generation if applicable
            this.setupEnergyGeneration(completedBuilding);
        });

        building.onDestroyed((destroyedBuilding) => {
            this.handleBuildingDestroyed(destroyedBuilding);
        });

        building.onEnergyGenerated((generatingBuilding, amount) => {
            // Add generated energy to global system
            this.energyManager.generateEnergy(generatingBuilding.getId(), amount, 'building_generation');
        });
    }

    /**
     * Setup energy generation for completed building
     */
    private setupEnergyGeneration(building: Building): void {
        const energyGeneration = building.getEnergyGeneration();
        if (energyGeneration > 0) {
            // Building is now generating energy
        }
    }

    /**
     * Handle building destruction
     */
    private handleBuildingDestroyed(building: Building): void {
        const buildingId = building.getId();
        
        // Remove visual
        this.buildingRenderer.removeBuildingVisual(buildingId);
        
        // Remove construction action if still active
        const constructionAction = this.constructionActions.get(buildingId);
        if (constructionAction) {
            constructionAction.dispose();
            this.constructionActions.delete(buildingId);
        }
        
        // Remove from buildings map
        this.buildings.delete(buildingId);
    }

    /**
     * Update all buildings and construction actions
     */
    public update(deltaTime: number): void {
        // Update all buildings
        for (const building of this.buildings.values()) {
            if (building.isActiveBuilding()) {
                building.update(deltaTime);
            }
        }

        // Transfer energy from power plants to global pool
        this.transferPowerPlantEnergy();

        // Update construction actions
        for (const [buildingId, constructionAction] of this.constructionActions.entries()) {
            const building = this.buildings.get(buildingId);
            if (building && constructionAction.isConstructionActive()) {
                // Update construction progress
                constructionAction.executeAction(deltaTime).then(result => {
                    if (result.success) {
                        const progress = constructionAction.getConstructionProgress();
                        building.setConstructionProgress(progress);
                    }
                });
            }
        }

        // Update building renderer
        this.buildingRenderer.updateAllVisuals();
    }

    // Conversion rate: materials consumed per second by power plants
    private static readonly MATERIALS_CONSUMPTION_RATE = 1.0; // 1 material/second per power plant
    // Conversion ratio: energy produced per material consumed
    private static readonly MATERIALS_TO_ENERGY_RATIO = 5.0; // 5 energy per 1 material

    /**
     * Power plants consume materials to generate energy
     */
    private transferPowerPlantEnergy(): void {
        for (const building of this.buildings.values()) {
            if (building.isComplete() && building.getEnergyGeneration() > 0) {
                // Calculate materials needed for this frame
                // Using deltaTime approximation (assuming ~60fps)
                const deltaTime = 1 / 60;
                const materialsNeeded = BuildingManager.MATERIALS_CONSUMPTION_RATE * deltaTime;

                // Check if we have materials to consume
                if (this.energyManager.canConsumeMaterials(materialsNeeded)) {
                    // Consume materials
                    if (this.energyManager.consumeMaterials(building.getId(), materialsNeeded, 'power_plant_conversion')) {
                        // Generate energy from materials (with upgrade bonus applied)
                        const baseEnergy = materialsNeeded * BuildingManager.MATERIALS_TO_ENERGY_RATIO;
                        const bonusMultiplier = 1 + (this.energyGenerationBonus / 100);
                        const energyGenerated = baseEnergy * bonusMultiplier;
                        this.energyManager.generateEnergy(building.getId(), energyGenerated, 'power_plant');
                    }
                }
            }
        }
    }

    /**
     * Get building by ID
     */
    public getBuilding(buildingId: string): Building | null {
        return this.buildings.get(buildingId) || null;
    }

    /**
     * Get all buildings
     */
    public getAllBuildings(): Building[] {
        return Array.from(this.buildings.values());
    }

    /**
     * Get buildings by type
     */
    public getBuildingsByType(buildingTypeId: string): Building[] {
        return Array.from(this.buildings.values()).filter(
            building => building.getBuildingType().id === buildingTypeId
        );
    }

    /**
     * Get completed buildings
     */
    public getCompletedBuildings(): Building[] {
        return Array.from(this.buildings.values()).filter(building => building.isComplete());
    }

    /**
     * Get buildings under construction
     */
    public getBuildingsUnderConstruction(): Building[] {
        return Array.from(this.buildings.values()).filter(building => !building.isComplete());
    }

    /**
     * Get available building types
     */
    public getAvailableBuildingTypes(): BuildingType[] {
        return BuildingAction.getAvailableBuildingTypes();
    }

    /**
     * Cancel construction
     */
    public cancelConstruction(buildingId: string): boolean {
        const constructionAction = this.constructionActions.get(buildingId);
        const building = this.buildings.get(buildingId);
        
        if (constructionAction && building) {
            constructionAction.cancelConstruction();
            building.destroy();
            return true;
        }
        
        return false;
    }

    /**
     * Get total energy generation from all buildings
     */
    public getTotalEnergyGeneration(): number {
        let totalGeneration = 0;

        for (const building of this.buildings.values()) {
            if (building.isComplete()) {
                totalGeneration += building.getEnergyGeneration();
            }
        }

        return totalGeneration;
    }

    /**
     * Set the energy generation bonus from Energy Lords progression
     * @param bonus - Percentage bonus (e.g., 10 = 10% more energy)
     */
    public setEnergyGenerationBonus(bonus: number): void {
        this.energyGenerationBonus = bonus;
        console.log(`Power plant efficiency upgraded: +${bonus}%`);
    }

    /**
     * Get current energy generation bonus
     */
    public getEnergyGenerationBonus(): number {
        return this.energyGenerationBonus;
    }

    /**
     * Get building manager statistics
     */
    public getStats(): BuildingManagerStats {
        const buildingsByType: { [key: string]: number } = {};
        let activeBuildings = 0;
        let completedBuildings = 0;
        let underConstruction = 0;

        for (const building of this.buildings.values()) {
            const buildingType = building.getBuildingType().id;
            buildingsByType[buildingType] = (buildingsByType[buildingType] || 0) + 1;
            
            if (building.isActiveBuilding()) {
                activeBuildings++;
            }
            
            if (building.isComplete()) {
                completedBuildings++;
            } else {
                underConstruction++;
            }
        }

        return {
            totalBuildings: this.buildings.size,
            activeBuildings,
            completedBuildings,
            underConstruction,
            buildingsByType,
            totalEnergyGeneration: this.getTotalEnergyGeneration()
        };
    }

    /**
     * Dispose building manager
     */
    public dispose(): void {
        // Dispose all construction actions
        for (const constructionAction of this.constructionActions.values()) {
            constructionAction.dispose();
        }
        this.constructionActions.clear();

        // Dispose all buildings
        for (const building of this.buildings.values()) {
            building.dispose();
        }
        this.buildings.clear();
    }
}