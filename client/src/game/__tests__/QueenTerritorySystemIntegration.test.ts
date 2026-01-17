/**
 * Queen & Territory System - Complete Integration Tests
 * 
 * Tests the complete integration of all Queen & Territory System components
 * with GameEngine and validates cross-system communication and event propagation.
 * 
 * This test suite validates:
 * - System component integration with GameEngine
 * - Cross-system communication between TerritoryManager and LiberationManager
 * - Basic Queen lifecycle functionality
 * - Territory liberation mechanics
 * - UI component integration
 */

import { Vector3 } from '@babylonjs/core';
import { TerritoryManager } from '../TerritoryManager';
import { LiberationManager } from '../LiberationManager';
import { Queen, QueenPhase } from '../entities/Queen';
import { ParasiteManager } from '../ParasiteManager';
import { CombatSystem } from '../CombatSystem';
import { UnitManager } from '../UnitManager';
import { EnergyManager } from '../EnergyManager';
import { GameState } from '../GameState';

// Mock GameEngine for integration testing
class MockGameEngine {
    private territoryManager: TerritoryManager | null = null;
    private liberationManager: LiberationManager | null = null;
    private parasiteManager: ParasiteManager | null = null;
    private combatSystem: CombatSystem | null = null;
    private unitManager: UnitManager | null = null;
    private energyManager: EnergyManager | null = null;
    private gameState: GameState | null = null;

    public getTerritoryManager(): TerritoryManager | null {
        return this.territoryManager;
    }

    public setTerritoryManager(manager: TerritoryManager): void {
        this.territoryManager = manager;
    }

    public getLiberationManager(): LiberationManager | null {
        return this.liberationManager;
    }

    public setLiberationManager(manager: LiberationManager): void {
        this.liberationManager = manager;
    }

    public getParasiteManager(): ParasiteManager | null {
        return this.parasiteManager;
    }

    public setParasiteManager(manager: ParasiteManager): void {
        this.parasiteManager = manager;
    }

    public getCombatSystem(): CombatSystem | null {
        return this.combatSystem;
    }

    public setCombatSystem(system: CombatSystem): void {
        this.combatSystem = system;
    }

    public getUnitManager(): UnitManager | null {
        return this.unitManager;
    }

    public setUnitManager(manager: UnitManager): void {
        this.unitManager = manager;
    }

    public getEnergyManager(): EnergyManager | null {
        return this.energyManager;
    }

    public setEnergyManager(manager: EnergyManager): void {
        this.energyManager = manager;
    }

    public getGameState(): GameState | null {
        return this.gameState;
    }

    public setGameState(state: GameState): void {
        this.gameState = state;
    }
}

// Mock EnergyManager for testing
class MockEnergyManager {
    private energy: number = 500;
    private minerals: number = 15;

    public generateEnergy(source: string, amount: number, reason: string): void {
        this.energy += amount;
    }

    public getEnergy(): number {
        return this.energy;
    }

    public getMinerals(): number {
        return this.minerals;
    }

    public update(): void {
        // Mock update
    }

    public dispose(): void {
        // Mock dispose
    }
}

describe('Queen & Territory System - Complete Integration', () => {
    let mockGameEngine: MockGameEngine;
    let mockEnergyManager: MockEnergyManager;
    let territoryManager: TerritoryManager;

    beforeEach(() => {
        mockGameEngine = new MockGameEngine();
        mockEnergyManager = new MockEnergyManager();
        
        // Initialize core managers
        territoryManager = new TerritoryManager();
        
        // Set up energy manager in mock game engine
        mockGameEngine.setEnergyManager(mockEnergyManager as any);
        
        // Initialize territory system (this will create its own LiberationManager)
        territoryManager.initialize(mockGameEngine as any);
        
        // Set up cross-references
        mockGameEngine.setTerritoryManager(territoryManager);
        mockGameEngine.setLiberationManager(territoryManager.getLiberationManager());
    });

    afterEach(() => {
        territoryManager.dispose();
    });

    describe('System Integration', () => {
        test('should integrate TerritoryManager with GameEngine correctly', () => {
            // Verify territory manager is properly integrated
            expect(mockGameEngine.getTerritoryManager()).toBe(territoryManager);
            
            // Verify territory manager has a liberation manager
            expect(territoryManager.getLiberationManager()).toBeDefined();
            expect(territoryManager.getLiberationManager()).not.toBeNull();
        });

        test('should create territories successfully', () => {
            const territory = territoryManager.createTerritory(512, 512);
            
            expect(territory).toBeDefined();
            expect(territory.id).toBe('territory_0_0');
            expect(territory.centerPosition.x).toBe(512);
            expect(territory.centerPosition.z).toBe(512);
        });

        test('should handle territory liberation', () => {
            const territory = territoryManager.createTerritory(512, 512);
            
            // Liberate territory
            territoryManager.liberateTerritory(territory.id);
            
            // Verify liberation state
            expect(territory.controlStatus).toBe('liberated');
            expect(territory.liberationTimer).toBeGreaterThan(0);
            
            // Verify liberation manager is aware
            const liberationManager = territoryManager.getLiberationManager();
            expect(liberationManager).toBeDefined();
            
            const liberationStatus = liberationManager!.getLiberationStatus(territory.id);
            expect(liberationStatus).toBeDefined();
            expect(liberationStatus!.isLiberated).toBe(true);
        });

        test('should provide mining bonuses during liberation', () => {
            const territory = territoryManager.createTerritory(512, 512);
            const testPosition = new Vector3(400, 0, 300);
            
            // No bonus initially
            expect(territoryManager.getMiningBonusAt(testPosition)).toBe(0);
            
            // Liberate territory
            territoryManager.liberateTerritory(territory.id);
            
            // Should have 25% bonus
            expect(territoryManager.getMiningBonusAt(testPosition)).toBe(0.25);
        });
    });

    describe('Queen Integration', () => {
        test('should create Queens through TerritoryManager', () => {
            const territory = territoryManager.createTerritory(512, 512);
            
            // Create Queen through TerritoryManager
            const queen = territoryManager.createQueenForTerritory(territory.id, 1);
            
            expect(queen).toBeDefined();
            expect(queen!.getGeneration()).toBe(1);
            expect(queen!.getCurrentPhase()).toBe(QueenPhase.UNDERGROUND_GROWTH);
            expect(territory.queen).toBe(queen);
        });

        test('should handle Queen lifecycle phases', () => {
            const territory = territoryManager.createTerritory(512, 512);
            const queen = territoryManager.createQueenForTerritory(territory.id, 1);
            
            expect(queen).toBeDefined();
            
            // Initial phase
            expect(queen!.getCurrentPhase()).toBe(QueenPhase.UNDERGROUND_GROWTH);
            expect(queen!.isVulnerable()).toBe(false);
            
            // Manually progress through phases for testing
            queen!.update(120); // Complete growth phase
            expect(queen!.getCurrentPhase()).toBe(QueenPhase.HIVE_CONSTRUCTION);
            
            queen!.update(20); // Complete construction phase
            expect(queen!.getCurrentPhase()).toBe(QueenPhase.ACTIVE_CONTROL);
            expect(queen!.isVulnerable()).toBe(true);
        });
    });

    describe('System Updates', () => {
        test('should update all systems correctly', () => {
            const territory = territoryManager.createTerritory(512, 512);
            const queen = territoryManager.createQueenForTerritory(territory.id, 1);
            
            expect(queen).toBeDefined();
            
            // System update should not throw errors
            expect(() => {
                territoryManager.update(1.0);
            }).not.toThrow();
            
            // Liberation manager should also update
            const liberationManager = territoryManager.getLiberationManager();
            expect(() => {
                liberationManager!.updateLiberations(1.0);
            }).not.toThrow();
        });

        test('should handle multiple territories', () => {
            // Create multiple territories
            const territories = [];
            for (let i = 0; i < 5; i++) {
                const territory = territoryManager.createTerritory(i * 1024, 0);
                territories.push(territory);
            }
            
            expect(territoryManager.getAllTerritories()).toHaveLength(5);
            
            // Update should handle all territories
            expect(() => {
                territoryManager.update(1.0);
            }).not.toThrow();
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid operations gracefully', () => {
            // Test with invalid territory ID
            expect(() => {
                territoryManager.liberateTerritory('invalid_territory');
            }).not.toThrow();
            
            // Test with null Queen
            const territory = territoryManager.createTerritory(512, 512);
            territory.queen = null;
            
            expect(() => {
                territoryManager.update(1.0);
            }).not.toThrow();
        });

        test('should handle system disposal correctly', () => {
            const territory = territoryManager.createTerritory(512, 512);
            territoryManager.createQueenForTerritory(territory.id, 1);
            
            expect(territoryManager.getAllTerritories()).toHaveLength(1);
            
            // Dispose should clean up properly
            territoryManager.dispose();
            expect(territoryManager.getAllTerritories()).toHaveLength(0);
        });
    });
});