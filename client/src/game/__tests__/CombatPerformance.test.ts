/**
 * Combat Performance Tests
 * 
 * Tests for combat system performance monitoring and 60fps maintenance
 */

import { CombatSystem, CombatPerformanceMetrics } from '../CombatSystem';
import { EnergyManager } from '../EnergyManager';
import { Protector } from '../entities/Protector';
import { EnergyParasite } from '../entities/EnergyParasite';
import { Vector3 } from '@babylonjs/core';

// Mock Babylon.js Vector3 for testing
jest.mock('@babylonjs/core', () => ({
    Vector3: {
        Distance: jest.fn((a, b) => {
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dz = a.z - b.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }),
        Zero: () => ({ x: 0, y: 0, z: 0 })
    }
}));

describe('Combat Performance Monitoring', () => {
    let combatSystem: CombatSystem;
    let energyManager: EnergyManager;
    let mockProtector: jest.Mocked<Protector>;
    let mockParasite: jest.Mocked<EnergyParasite>;

    beforeEach(() => {
        // Initialize energy manager
        energyManager = EnergyManager.getInstance();
        energyManager.initialize(1000);

        // Initialize combat system
        combatSystem = new CombatSystem(energyManager);

        // Create mock protector
        mockProtector = {
            getId: jest.fn().mockReturnValue('protector_1'),
            getPosition: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
            getProtectorStats: jest.fn().mockReturnValue({
                attackDamage: 25,
                combatExperience: 0,
                lastActionTime: 0
            }),
            startMovement: jest.fn(),
            stopMovement: jest.fn()
        } as any;

        // Create mock parasite
        mockParasite = {
            id: 'parasite_1',
            position: { x: 5, y: 0, z: 0 },
            health: 100,
            maxHealth: 100,
            takeDamage: jest.fn().mockReturnValue(false),
            onDestroyed: jest.fn()
        } as any;

        // Register protector
        combatSystem.registerProtector(mockProtector);
    });

    afterEach(() => {
        combatSystem.dispose();
        energyManager.dispose();
    });

    describe('Performance Metrics Collection', () => {
        test('should initialize with zero performance metrics', () => {
            const metrics = combatSystem.getPerformanceMetrics();
            
            expect(metrics.activeCombatCount).toBe(0);
            expect(metrics.attacksPerSecond).toBe(0);
            expect(metrics.averageAttackProcessingTime).toBe(0);
            expect(metrics.targetValidationsPerSecond).toBe(0);
            expect(metrics.combatStateCleanups).toBe(0);
        });

        test('should track active combat count', () => {
            // Initiate combat
            combatSystem.initiateAttack(mockProtector, mockParasite);
            
            // Update to collect metrics
            combatSystem.update(0.016); // 60fps frame time
            
            const metrics = combatSystem.getPerformanceMetrics();
            expect(metrics.activeCombatCount).toBe(1);
        });

        test('should measure target validation performance', () => {
            const startTime = performance.now();
            
            // Perform multiple validations
            for (let i = 0; i < 10; i++) {
                combatSystem.validateTarget(mockProtector, mockParasite);
            }
            
            // Update metrics
            combatSystem.update(0.016);
            
            const metrics = combatSystem.getPerformanceMetrics();
            expect(metrics.targetValidationsPerSecond).toBeGreaterThan(0);
        });

        test('should measure attack processing time', () => {
            // Initiate and execute attack
            combatSystem.initiateAttack(mockProtector, mockParasite);
            
            // Update multiple times to trigger metrics calculation
            for (let i = 0; i < 10; i++) {
                combatSystem.update(0.016);
            }
            
            const metrics = combatSystem.getPerformanceMetrics();
            expect(metrics.averageAttackProcessingTime).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Performance Summary', () => {
        test('should provide performance summary', () => {
            const summary = combatSystem.getPerformanceSummary();
            
            expect(summary).toHaveProperty('isPerformingWell');
            expect(summary).toHaveProperty('activeCombats');
            expect(summary).toHaveProperty('attacksPerSecond');
            expect(summary).toHaveProperty('averageProcessingTime');
            expect(summary).toHaveProperty('frameImpact');
            expect(summary).toHaveProperty('recommendations');
            
            expect(Array.isArray(summary.recommendations)).toBe(true);
        });

        test('should identify performance issues', () => {
            // Simulate high load by creating many combat actions
            for (let i = 0; i < 25; i++) {
                const mockParasiteHigh = {
                    id: `parasite_${i}`,
                    position: { x: i, y: 0, z: 0 },
                    health: 100,
                    maxHealth: 100,
                    takeDamage: jest.fn().mockReturnValue(false),
                    onDestroyed: jest.fn()
                } as any;
                
                combatSystem.initiateAttack(mockProtector, mockParasiteHigh);
            }
            
            combatSystem.update(0.016);
            const summary = combatSystem.getPerformanceSummary();
            
            expect(summary.isPerformingWell).toBe(false);
            expect(summary.recommendations.length).toBeGreaterThan(0);
        });
    });

    describe('Frame Time Impact', () => {
        test('should measure frame time impact', () => {
            // Initiate combat
            combatSystem.initiateAttack(mockProtector, mockParasite);
            
            // Update and measure
            combatSystem.update(0.016);
            
            const metrics = combatSystem.getPerformanceMetrics();
            expect(metrics.frameTimeImpact).toBeGreaterThanOrEqual(0);
        });

        test('should warn about high frame impact', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            // Create many simultaneous combats to increase frame impact
            for (let i = 0; i < 30; i++) {
                const mockParasiteMany = {
                    id: `parasite_many_${i}`,
                    position: { x: i * 2, y: 0, z: 0 },
                    health: 100,
                    maxHealth: 100,
                    takeDamage: jest.fn().mockReturnValue(false),
                    onDestroyed: jest.fn()
                } as any;
                
                combatSystem.initiateAttack(mockProtector, mockParasiteMany);
            }
            
            // Update multiple times to trigger performance checks
            for (let i = 0; i < 5; i++) {
                combatSystem.update(0.016);
            }
            
            // Should have performance warnings
            expect(consoleSpy).toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });
    });

    describe('60fps Maintenance', () => {
        test('should maintain reasonable performance with moderate combat load', () => {
            // Create moderate combat load (10 simultaneous combats)
            for (let i = 0; i < 10; i++) {
                const mockParasiteMod = {
                    id: `parasite_mod_${i}`,
                    position: { x: i * 3, y: 0, z: 0 },
                    health: 100,
                    maxHealth: 100,
                    takeDamage: jest.fn().mockReturnValue(false),
                    onDestroyed: jest.fn()
                } as any;
                
                combatSystem.initiateAttack(mockProtector, mockParasiteMod);
            }
            
            // Measure performance over multiple frames
            const frameImpacts: number[] = [];
            for (let i = 0; i < 10; i++) {
                combatSystem.update(0.016);
                const metrics = combatSystem.getPerformanceMetrics();
                frameImpacts.push(metrics.frameTimeImpact);
            }
            
            // Average frame impact should be reasonable for 60fps
            const avgFrameImpact = frameImpacts.reduce((sum, impact) => sum + impact, 0) / frameImpacts.length;
            expect(avgFrameImpact).toBeLessThan(5.0); // Less than 5ms per frame
        });

        test('should provide optimization recommendations for high load', () => {
            // Create excessive combat load
            for (let i = 0; i < 50; i++) {
                const mockParasiteHeavy = {
                    id: `parasite_heavy_${i}`,
                    position: { x: i * 4, y: 0, z: 0 },
                    health: 100,
                    maxHealth: 100,
                    takeDamage: jest.fn().mockReturnValue(false),
                    onDestroyed: jest.fn()
                } as any;
                
                combatSystem.initiateAttack(mockProtector, mockParasiteHeavy);
            }
            
            combatSystem.update(0.016);
            const summary = combatSystem.getPerformanceSummary();
            
            expect(summary.isPerformingWell).toBe(false);
            expect(summary.recommendations).toContain('Reduce number of simultaneous combat actions');
        });
    });

    describe('Metrics Reset and History', () => {
        test('should reset metrics periodically', async () => {
            // Perform some operations
            combatSystem.initiateAttack(mockProtector, mockParasite);
            combatSystem.update(0.016);
            
            const initialMetrics = combatSystem.getPerformanceMetrics();
            
            // Wait for metrics reset interval (simulated)
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Update again to trigger reset
            combatSystem.update(0.016);
            
            const resetMetrics = combatSystem.getPerformanceMetrics();
            
            // Metrics should be updated/reset
            expect(resetMetrics.lastUpdateTime).toBeGreaterThan(initialMetrics.lastUpdateTime);
        });
    });
});