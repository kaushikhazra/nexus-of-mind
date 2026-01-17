/**
 * UnitManager - Central unit management system with selection and command handling
 *
 * Manages unit lifecycle, selection, command queuing, and interaction with the
 * rendering system. Provides the interface between player input and unit actions.
 */

import { Vector3 } from '@babylonjs/core';
import { Unit } from './entities/Unit';
import { Worker } from './entities/Worker';
import { Scout } from './entities/Scout';
import { Protector } from './entities/Protector';
import { GameState } from './GameState';
import { UnitRenderer, UnitVisual } from '../rendering/UnitRenderer';
import { GameEngine } from './GameEngine';
import { CombatSystem } from './CombatSystem';
import { SpatialIndex } from './SpatialIndex';

export interface UnitCommand {
    id: string;
    unitId: string;
    commandType: 'move' | 'mine' | 'build' | 'patrol' | 'stop';
    targetPosition?: Vector3;
    targetId?: string;
    parameters?: any;
    priority: number;
    createdAt: number;
}

export interface UnitManagerStats {
    totalUnits: number;
    activeUnits: number;
    selectedUnits: number;
    unitsByType: { [key: string]: number };
    commandsQueued: number;
    commandsExecuted: number;
}

export class UnitManager {
    private gameState: GameState;
    private unitRenderer: UnitRenderer;
    private terrainGenerator: any = null;
    private combatSystem: CombatSystem | null = null;
    private territoryManager: any = null; // TerritoryManager for mining bonus

    // Unit management
    private units: Map<string, Unit> = new Map();
    private selectedUnits: Set<string> = new Set();

    // Command system
    private commandQueue: UnitCommand[] = [];
    private commandIdCounter: number = 0;
    private commandsExecuted: number = 0;

    // Unit creation counters
    private unitCounters = {
        worker: 0,
        scout: 0,
        protector: 0
    };

    constructor(gameState: GameState, unitRenderer: UnitRenderer) {
        this.gameState = gameState;
        this.unitRenderer = unitRenderer;
    }

    /**
     * Set terrain generator for height detection
     */
    public setTerrainGenerator(terrainGenerator: any): void {
        this.terrainGenerator = terrainGenerator;

        // Update existing units
        for (const unit of this.units.values()) {
            unit.setTerrainGenerator(terrainGenerator);
        }
    }

    /**
     * Set combat system for auto-attack integration
     */
    public setCombatSystem(combatSystem: CombatSystem): void {
        this.combatSystem = combatSystem;
    }

    /**
     * Set territory manager for mining bonus integration
     */
    public setTerritoryManager(territoryManager: any): void {
        this.territoryManager = territoryManager;
        
        // Update existing units with territory manager
        for (const unit of this.units.values()) {
            if (unit.setTerritoryManager) {
                unit.setTerritoryManager(territoryManager);
            }
        }
    }

    /**
     * Create a new unit
     */
    public createUnit(unitType: 'worker' | 'scout' | 'protector', position: Vector3): Unit | null {
        try {
            let unit: Unit;

            // Create unit based on type
            switch (unitType) {
                case 'worker':
                    unit = new Worker(position);
                    break;
                case 'scout':
                    unit = new Scout(position);
                    break;
                case 'protector':
                    unit = new Protector(position);
                    break;
                default:
                    return null;
            }

            // Add to units map
            this.units.set(unit.getId(), unit);

            // Set terrain generator for height detection
            if (this.terrainGenerator) {
                unit.setTerrainGenerator(this.terrainGenerator);
            }

            // Set territory manager for mining bonus
            if (this.territoryManager && unit.setTerritoryManager) {
                unit.setTerritoryManager(this.territoryManager);
            }

            // Update counter
            this.unitCounters[unitType]++;

            // Create visual representation
            const unitVisual = this.unitRenderer.createUnitVisual(unit);
            if (!unitVisual) {
                this.units.delete(unit.getId());
                return null;
            }

            // Add to game state
            this.gameState.addUnit(unit);

            // Setup unit event callbacks
            this.setupUnitCallbacks(unit);

            // Register protectors with combat system
            if (unitType === 'protector') {
                const gameEngine = GameEngine.getInstance();
                const combatSystem = gameEngine?.getCombatSystem();
                if (combatSystem) {
                    combatSystem.registerProtector(unit as Protector);
                }
            }

            // Add to spatial index for O(1) lookups
            const gameEngine = GameEngine.getInstance();
            const spatialIndex = gameEngine?.getSpatialIndex();
            if (spatialIndex) {
                spatialIndex.add(unit.getId(), position, unitType);
            }

            return unit;

        } catch (error) {
            return null;
        }
    }

    /**
     * Setup event callbacks for a unit
     */
    private setupUnitCallbacks(unit: Unit): void {
        unit.onDestroyed((destroyedUnit) => {
            this.handleUnitDestroyed(destroyedUnit);
        });

        unit.onEnergyDepleted((depletedUnit) => {
            this.stopUnit(depletedUnit.getId());
        });

        unit.onActionComplete((completedUnit, action) => {
            // Action completed
        });
    }

    /**
     * Handle unit destruction
     */
    private handleUnitDestroyed(unit: Unit): void {
        const unitId = unit.getId();

        // Remove from spatial index
        const gameEngine = GameEngine.getInstance();
        const spatialIndex = gameEngine?.getSpatialIndex();
        if (spatialIndex) {
            spatialIndex.remove(unitId);
        }

        // Unregister protectors from combat system
        if (unit instanceof Protector) {
            const combatSystem = gameEngine?.getCombatSystem();
            if (combatSystem) {
                combatSystem.unregisterProtector(unitId);
            }
        }

        // Remove from selection
        this.selectedUnits.delete(unitId);

        // Remove visual
        this.unitRenderer.removeUnitVisual(unitId);

        // Remove from units map
        this.units.delete(unitId);

        // Remove from game state
        this.gameState.removeUnit(unitId);

        // Cancel any queued commands for this unit
        this.commandQueue = this.commandQueue.filter(cmd => cmd.unitId !== unitId);
    }

    /**
     * Select units
     */
    public selectUnits(unitIds: string[]): void {
        // Clear current selection
        this.clearSelection();

        // Add new selection
        for (const unitId of unitIds) {
            const unit = this.units.get(unitId);
            if (unit && unit.isActiveUnit()) {
                this.selectedUnits.add(unitId);
                this.unitRenderer.setUnitSelection(unitId, true);
            }
        }
    }

    /**
     * Add unit to selection
     */
    public addToSelection(unitId: string): void {
        const unit = this.units.get(unitId);
        if (unit && unit.isActiveUnit()) {
            this.selectedUnits.add(unitId);
            this.unitRenderer.setUnitSelection(unitId, true);
        }
    }

    /**
     * Remove unit from selection
     */
    public removeFromSelection(unitId: string): void {
        this.selectedUnits.delete(unitId);
        this.unitRenderer.setUnitSelection(unitId, false);
    }

    /**
     * Clear all selections
     */
    public clearSelection(): void {
        for (const unitId of this.selectedUnits) {
            this.unitRenderer.setUnitSelection(unitId, false);
        }
        this.selectedUnits.clear();
    }

    /**
     * Get selected units
     */
    public getSelectedUnits(): Unit[] {
        const selectedUnits: Unit[] = [];
        for (const unitId of this.selectedUnits) {
            const unit = this.units.get(unitId);
            if (unit) {
                selectedUnits.push(unit);
            }
        }
        return selectedUnits;
    }

    /**
     * Issue command to selected units
     */
    public issueCommand(
        commandType: UnitCommand['commandType'],
        targetPosition?: Vector3,
        targetId?: string,
        parameters?: any
    ): void {
        const selectedUnits = this.getSelectedUnits();

        if (selectedUnits.length === 0) {
            return;
        }

        // Create commands for each selected unit
        for (const unit of selectedUnits) {
            const command: UnitCommand = {
                id: this.generateCommandId(),
                unitId: unit.getId(),
                commandType,
                targetPosition: targetPosition?.clone(),
                targetId,
                parameters,
                priority: 1,
                createdAt: performance.now()
            };

            this.commandQueue.push(command);
        }
    }

    /**
     * Generate unique command ID
     */
    private generateCommandId(): string {
        return `cmd_${++this.commandIdCounter}_${Date.now()}`;
    }

    /**
     * Process command queue
     */
    public processCommands(): void {
        if (this.commandQueue.length === 0) {
            return;
        }

        // Sort commands by priority (higher priority first)
        this.commandQueue.sort((a, b) => b.priority - a.priority);

        // Process commands
        const commandsToRemove: number[] = [];

        for (let i = 0; i < this.commandQueue.length; i++) {
            const command = this.commandQueue[i];
            const unit = this.units.get(command.unitId);

            if (!unit || !unit.isActiveUnit()) {
                commandsToRemove.push(i);
                continue;
            }

            const executed = this.executeCommand(unit, command);
            if (executed) {
                commandsToRemove.push(i);
                this.commandsExecuted++;
            }
        }

        // Remove processed commands (in reverse order to maintain indices)
        for (let i = commandsToRemove.length - 1; i >= 0; i--) {
            this.commandQueue.splice(commandsToRemove[i], 1);
        }
    }

    /**
     * Execute a command on a unit
     */
    private executeCommand(unit: Unit, command: UnitCommand): boolean {
        try {
            switch (command.commandType) {
                case 'move':
                    if (command.targetPosition) {
                        // Use moveToLocation for Protectors to enable auto-attack during movement
                        if (unit instanceof Protector) {
                            unit.moveToLocation(command.targetPosition);
                            return true;
                        } else {
                            // Use regular movement for other unit types
                            unit.startMovement(command.targetPosition);
                            return true;
                        }
                    }
                    break;

                case 'mine':
                    if (command.targetId) {
                        // Get mineral deposit from terrain generator via GameEngine
                        const gameEngine = GameEngine.getInstance();
                        const terrainGenerator = gameEngine?.getTerrainGenerator();

                        if (terrainGenerator) {
                            const target = terrainGenerator.getMineralDepositById(command.targetId);
                            if (target) {
                                unit.startMining(target);
                                return true;
                            }
                        }
                    }
                    break;

                case 'build':
                    if (command.targetPosition && command.parameters?.buildingType) {
                        unit.startBuilding(command.parameters.buildingType, command.targetPosition);
                        return true;
                    }
                    break;

                case 'patrol':
                    if (command.targetPosition && unit instanceof Protector) {
                        const radius = command.parameters?.radius || 10;
                        unit.startPatrol(command.targetPosition, radius);
                        return true;
                    }
                    break;

                case 'stop':
                    unit.stopAllActions();
                    return true;

                default:
                    return true; // Remove unknown commands
            }

        } catch (error) {
            return true; // Remove failed commands
        }

        return false; // Command not executed, keep in queue
    }

    /**
     * Stop a specific unit
     */
    public stopUnit(unitId: string): void {
        const unit = this.units.get(unitId);
        if (unit) {
            unit.stopAllActions();
        }
    }

    /**
     * Stop all selected units
     */
    public stopSelectedUnits(): void {
        for (const unitId of this.selectedUnits) {
            this.stopUnit(unitId);
        }
    }

    /**
     * Update all units
     */
    public update(deltaTime: number): void {
        const gameEngine = GameEngine.getInstance();
        const spatialIndex = gameEngine?.getSpatialIndex();

        // Update all units
        for (const unit of this.units.values()) {
            if (unit.isActiveUnit()) {
                unit.update(deltaTime);

                // Update spatial index with new position
                if (spatialIndex) {
                    spatialIndex.updatePosition(unit.getId(), unit.getPosition());
                }
            }
        }

        // Process command queue
        this.processCommands();

        // Update unit renderer
        this.unitRenderer.updateAllVisuals();
    }

    /**
     * Get unit by ID
     */
    public getUnit(unitId: string): Unit | null {
        return this.units.get(unitId) || null;
    }

    /**
     * Get all units
     */
    public getAllUnits(): Unit[] {
        return Array.from(this.units.values());
    }

    /**
     * Get units by type
     */
    public getUnitsByType(unitType: 'worker' | 'scout' | 'protector'): Unit[] {
        return Array.from(this.units.values()).filter(unit => unit.getUnitType() === unitType);
    }

    /**
     * Get active units
     */
    public getActiveUnits(): Unit[] {
        return Array.from(this.units.values()).filter(unit => unit.isActiveUnit());
    }

    /**
     * Get unit manager statistics
     */
    public getStats(): UnitManagerStats {
        const unitsByType: { [key: string]: number } = {};
        let activeUnits = 0;

        for (const unit of this.units.values()) {
            const unitType = unit.getUnitType();
            unitsByType[unitType] = (unitsByType[unitType] || 0) + 1;

            if (unit.isActiveUnit()) {
                activeUnits++;
            }
        }

        return {
            totalUnits: this.units.size,
            activeUnits,
            selectedUnits: this.selectedUnits.size,
            unitsByType,
            commandsQueued: this.commandQueue.length,
            commandsExecuted: this.commandsExecuted
        };
    }

    /**
     * Get unit creation counts
     */
    public getUnitCounts(): { [key: string]: number } {
        return { ...this.unitCounters };
    }

    /**
     * Clear all commands
     */
    public clearCommands(): void {
        this.commandQueue = [];
    }

    /**
     * Dispose unit manager
     */
    public dispose(): void {
        // Stop all units
        for (const unit of this.units.values()) {
            unit.dispose();
        }

        // Clear collections
        this.units.clear();
        this.selectedUnits.clear();
        this.commandQueue = [];
    }
}
