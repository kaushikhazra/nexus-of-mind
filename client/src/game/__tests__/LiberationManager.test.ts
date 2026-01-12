/**
 * LiberationManager Tests
 * 
 * Tests for the Territory Liberation System functionality including:
 * - Liberation period management (3-5 minutes)
 * - Mining speed bonus (25% during liberation)
 * - Energy rewards for Queen kills (50-100 energy)
 */

import { Vector3 } from '@babylonjs/core';
import { LiberationManager } from '../LiberationManager';
import { EnergyManager } from '../EnergyManager';
import { TerritoryManager, Territory } from '../TerritoryManager';

describe('LiberationManager', () => {
    let liberationManager: LiberationManager;
    let energyManager: EnergyManager;
    let territoryManager: TerritoryManager;
    let mockTerritory: Territory;

    beforeEach(() => {
        // Initialize energy manager
        energyManager = EnergyManager.getInstance();
        energyManager.initialize(100, 0);

        // Initialize liberation manager
        liberationManager = new LiberationManager(energyManager);

        // Initialize territory manager
        territoryManager = new TerritoryManager();
        liberationManager.setTerritoryManager(territoryManager);

        // Create mock territory
        mockTerritory = territoryManager.createTerritory(512, 512);
    });

    afterEach(() => {
        liberationManager.dispose();
        territoryManager.dispose();
        energyManager.dispose();
    });

    describe('Liberation Period Management', () => {
        test('should start liberation with correct duration (3-5 minutes)', () => {
            const status = liberationManager.startLiberation(mockTerritory.id, 'test_queen');

            expect(status.isLiberated).toBe(true);
            expect(status.liberationDuration).toBeGreaterThanOrEqual(180); // 3 minutes
            expect(status.liberationDuration).toBeLessThanOrEqual(300); // 5 minutes
            expect(status.timeRemaining).toBe(status.liberationDuration);
        });

        test('should provide 25% mining bonus during liberation', () => {
            liberationManager.startLiberation(mockTerritory.id, 'test_queen');

            const position = new Vector3(400, 0, 300); // Inside territory
            const bonus = liberationManager.getMiningBonusAt(position);

            expect(bonus).toBe(0.25); // 25% bonus
        });

        test('should provide no mining bonus outside liberated territories', () => {
            liberationManager.startLiberation(mockTerritory.id, 'test_queen');

            const position = new Vector3(2000, 0, 2000); // Outside territory
            const bonus = liberationManager.getMiningBonusAt(position);

            expect(bonus).toBe(0);
        });

        test('should award energy rewards between 50-100 energy', () => {
            const initialEnergy = energyManager.getTotalEnergy();
            
            const status = liberationManager.startLiberation(mockTerritory.id, 'test_queen');

            expect(status.energyReward).toBeGreaterThanOrEqual(50);
            expect(status.energyReward).toBeLessThanOrEqual(100);

            // Energy should be awarded immediately
            const finalEnergy = energyManager.getTotalEnergy();
            expect(finalEnergy).toBe(initialEnergy + status.energyReward);
        });

        test('should track liberation status correctly', () => {
            expect(liberationManager.isTerritoryLiberated(mockTerritory.id)).toBe(false);

            liberationManager.startLiberation(mockTerritory.id, 'test_queen');

            expect(liberationManager.isTerritoryLiberated(mockTerritory.id)).toBe(true);
        });

        test('should update liberation timers correctly', () => {
            const status = liberationManager.startLiberation(mockTerritory.id, 'test_queen');
            const initialTimeRemaining = status.timeRemaining;

            // Simulate 10 seconds passing
            liberationManager.updateLiberations(10);

            const updatedStatus = liberationManager.getLiberationStatus(mockTerritory.id);
            expect(updatedStatus?.timeRemaining).toBeLessThan(initialTimeRemaining);
        });

        test('should end liberation when timer expires', () => {
            const status = liberationManager.startLiberation(mockTerritory.id, 'test_queen');

            // Simulate time passing beyond liberation duration
            liberationManager.updateLiberations(status.liberationDuration + 1);

            expect(liberationManager.isTerritoryLiberated(mockTerritory.id)).toBe(false);
            expect(liberationManager.getLiberationStatus(mockTerritory.id)).toBeNull();
        });
    });

    describe('Liberation Statistics', () => {
        test('should track liberation history', () => {
            liberationManager.startLiberation(mockTerritory.id, 'queen1');
            liberationManager.startLiberation('territory2', 'queen2');

            const history = liberationManager.getLiberationHistory();
            expect(history).toHaveLength(2);
            expect(history[0].territoryId).toBe(mockTerritory.id);
            expect(history[0].queenId).toBe('queen1');
            expect(history[1].territoryId).toBe('territory2');
            expect(history[1].queenId).toBe('queen2');
        });

        test('should calculate total energy rewards correctly', () => {
            const status1 = liberationManager.startLiberation(mockTerritory.id, 'queen1');
            const status2 = liberationManager.startLiberation('territory2', 'queen2');

            const totalRewards = liberationManager.getTotalEnergyRewards();
            expect(totalRewards).toBe(status1.energyReward + status2.energyReward);
        });

        test('should provide comprehensive liberation statistics', () => {
            liberationManager.startLiberation(mockTerritory.id, 'queen1');
            liberationManager.startLiberation('territory2', 'queen2');

            const stats = liberationManager.getLiberationStats();
            expect(stats.totalLiberations).toBe(2);
            expect(stats.activeLiberations).toBe(2);
            expect(stats.totalEnergyRewards).toBeGreaterThan(0);
            expect(stats.averageLiberationDuration).toBeGreaterThanOrEqual(180);
            expect(stats.averageLiberationDuration).toBeLessThanOrEqual(300);
            expect(stats.averageEnergyReward).toBeGreaterThanOrEqual(50);
            expect(stats.averageEnergyReward).toBeLessThanOrEqual(100);
        });
    });

    describe('Event System', () => {
        test('should trigger liberation start events', () => {
            const startCallback = jest.fn();
            liberationManager.onLiberationStart(startCallback);

            const status = liberationManager.startLiberation(mockTerritory.id, 'test_queen');

            expect(startCallback).toHaveBeenCalledWith(mockTerritory.id, status);
        });

        test('should trigger liberation end events', () => {
            const endCallback = jest.fn();
            liberationManager.onLiberationEnd(endCallback);

            const status = liberationManager.startLiberation(mockTerritory.id, 'test_queen');
            liberationManager.updateLiberations(status.liberationDuration + 1);

            expect(endCallback).toHaveBeenCalledWith(mockTerritory.id);
        });

        test('should trigger energy reward events', () => {
            const rewardCallback = jest.fn();
            liberationManager.onEnergyReward(rewardCallback);

            const status = liberationManager.startLiberation(mockTerritory.id, 'test_queen');

            expect(rewardCallback).toHaveBeenCalledWith(mockTerritory.id, status.energyReward);
        });
    });

    describe('Edge Cases', () => {
        test('should handle multiple liberations of same territory', () => {
            const status1 = liberationManager.startLiberation(mockTerritory.id, 'queen1');
            const status2 = liberationManager.startLiberation(mockTerritory.id, 'queen2');

            // Second liberation should overwrite the first
            expect(liberationManager.getLiberationStatus(mockTerritory.id)?.energyReward).toBe(status2.energyReward);
        });

        test('should handle force ending liberation', () => {
            liberationManager.startLiberation(mockTerritory.id, 'test_queen');
            expect(liberationManager.isTerritoryLiberated(mockTerritory.id)).toBe(true);

            const success = liberationManager.forceEndLiberation(mockTerritory.id);
            expect(success).toBe(true);
            expect(liberationManager.isTerritoryLiberated(mockTerritory.id)).toBe(false);
        });

        test('should handle clearing all liberations', () => {
            liberationManager.startLiberation(mockTerritory.id, 'queen1');
            liberationManager.startLiberation('territory2', 'queen2');

            expect(liberationManager.getLiberatedTerritories()).toHaveLength(2);

            liberationManager.clearAllLiberations();

            expect(liberationManager.getLiberatedTerritories()).toHaveLength(0);
            expect(liberationManager.getLiberationHistory()).toHaveLength(0);
        });

        test('should handle mining bonus without territory manager', () => {
            const standaloneManager = new LiberationManager(energyManager);
            standaloneManager.startLiberation('test_territory', 'test_queen');

            const bonus = standaloneManager.getMiningBonusAt(new Vector3(0, 0, 0));
            expect(bonus).toBe(0); // Should return 0 without territory manager
        });
    });
});