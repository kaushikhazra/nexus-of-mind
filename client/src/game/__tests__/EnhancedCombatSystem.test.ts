/**
 * Enhanced CombatSystem Tests for Queen & Territory System Integration
 * 
 * Tests the new Queen and Hive combat target functionality without GUI dependencies.
 */

import { Vector3 } from '@babylonjs/core';
import { CombatSystem, CombatTarget, TargetValidation } from '../CombatSystem';
import { EnergyManager } from '../EnergyManager';
import { Queen, QueenPhase } from '../entities/Queen';
import { Hive } from '../entities/Hive';
import { Protector } from '../entities/Protector';

// Mock classes for testing
class MockEnergyManager {
    private totalSystemEnergy: number = 100;

    canConsumeEnergy(entityId: string, amount: number): boolean {
        return this.totalSystemEnergy >= amount;
    }

    consumeEnergy(entityId: string, amount: number, action: string): boolean {
        if (!this.canConsumeEnergy(entityId, amount)) {
            return false;
        }
        this.totalSystemEnergy -= amount;
        return true;
    }

    getTotalEnergy(): number {
        return this.totalSystemEnergy;
    }

    onLowEnergy(callback: (entityId: string, energy: number) => void): void {
        // Mock implementation
    }
}

class MockProtector {
    private id: string;
    private position: Vector3;

    constructor(id: string, position: Vector3) {
        this.id = id;
        this.position = position;
    }

    getId(): string {
        return this.id;
    }

    getPosition(): Vector3 {
        return this.position;
    }

    getProtectorStats() {
        return {
            attackDamage: 25,
            combatExperience: 0,
            lastActionTime: 0,
            combatState: 'idle',
            autoAttackEnabled: true
        };
    }

    faceTarget(position: Vector3): void {
        // Mock implementation
    }

    clearFacingTarget(): void {
        // Mock implementation
    }

    startMovement(destination: Vector3): void {
        // Mock implementation
    }

    stopMovement(): void {
        // Mock implementation
    }
}

class MockTerritory {
    public id: string = 'territory_0_0';
    public centerPosition: Vector3 = new Vector3(0, 0, 0);
    public size: number = 1024;
    public chunkBounds = {
        minX: -512,
        maxX: 512,
        minZ: -512,
        maxZ: 512,
        chunkCoords: []
    };
    public queen: Queen | null = null;
    public hive: Hive | null = null;
    public controlStatus: 'queen_controlled' | 'liberated' | 'contested' = 'contested';
    public liberationTimer: number = 0;
    public liberationStartTime: number = 0;
    public parasiteCount: number = 0;
}

describe('Enhanced CombatSystem - Queen & Territory Integration', () => {
    let combatSystem: CombatSystem;
    let mockEnergyManager: MockEnergyManager;
    let mockProtector: MockProtector;
    let mockTerritory: MockTerritory;

    beforeEach(() => {
        mockEnergyManager = new MockEnergyManager();
        combatSystem = new CombatSystem(mockEnergyManager as any);
        mockProtector = new MockProtector('protector_1', new Vector3(0, 0, 0));
        mockTerritory = new MockTerritory();
    });

    describe('Queen Target Validation', () => {
        test('should validate vulnerable Queen as valid target', () => {
            // Create Queen in active control phase (vulnerable)
            const queenConfig = {
                territory: mockTerritory as any,
                generation: 1,
                health: 75,
                growthDuration: 90
            };
            const queen = new Queen(queenConfig);
            
            // Force Queen to active control phase to make it vulnerable
            queen['currentPhase'] = QueenPhase.ACTIVE_CONTROL;
            queen['position'].y = 2.0; // Above ground

            const validation = combatSystem.validateQueenTarget(mockProtector as any, queen);
            
            expect(validation.isValid).toBe(true);
            expect(validation.reason).toBe('valid');
        });

        test('should reject invulnerable Queen as invalid target', () => {
            // Create Queen in underground growth phase (invulnerable)
            const queenConfig = {
                territory: mockTerritory as any,
                generation: 1,
                health: 75,
                growthDuration: 90
            };
            const queen = new Queen(queenConfig);
            
            // Queen starts in underground growth phase (invulnerable)
            expect(queen.isVulnerable()).toBe(false);

            const validation = combatSystem.validateQueenTarget(mockProtector as any, queen);
            
            expect(validation.isValid).toBe(false);
            expect(validation.reason).toBe('invalid_type');
        });

        test('should reject non-Queen objects', () => {
            const fakeQueen = {
                id: 'fake',
                position: new Vector3(0, 0, 0),
                health: 50,
                maxHealth: 100
            };

            const validation = combatSystem.validateQueenTarget(mockProtector as any, fakeQueen);
            
            expect(validation.isValid).toBe(false);
            expect(validation.reason).toBe('invalid_type');
        });
    });

    describe('Hive Target Validation', () => {
        test('should validate constructed Hive as valid target', () => {
            // Create Queen first
            const queenConfig = {
                territory: mockTerritory as any,
                generation: 1,
                health: 75,
                growthDuration: 90
            };
            const queen = new Queen(queenConfig);

            // Create constructed Hive close to protector (within attack range)
            const hiveConfig = {
                position: new Vector3(5, 0, 0), // Close to protector at (0,0,0)
                territory: mockTerritory as any,
                queen: queen,
                health: 25,
                constructionDuration: 12
            };
            const hive = new Hive(hiveConfig);
            
            // Force Hive to constructed state
            hive['isConstructed'] = true;

            const validation = combatSystem.validateHiveTarget(mockProtector as any, hive);
            
            expect(validation.isValid).toBe(true);
            expect(validation.reason).toBe('valid');
        });

        test('should reject unconstructed Hive as invalid target', () => {
            // Create Queen first
            const queenConfig = {
                territory: mockTerritory as any,
                generation: 1,
                health: 75,
                growthDuration: 90
            };
            const queen = new Queen(queenConfig);

            // Create unconstructed Hive
            const hiveConfig = {
                position: new Vector3(100, 0, 100),
                territory: mockTerritory as any,
                queen: queen,
                health: 25,
                constructionDuration: 12
            };
            const hive = new Hive(hiveConfig);
            
            // Hive starts unconstructed
            expect(hive.isHiveConstructed()).toBe(false);

            const validation = combatSystem.validateHiveTarget(mockProtector as any, hive);
            
            expect(validation.isValid).toBe(false);
            expect(validation.reason).toBe('invalid_type');
        });

        test('should reject non-Hive objects', () => {
            const fakeHive = {
                id: 'fake',
                position: new Vector3(0, 0, 0),
                health: 25,
                maxHealth: 30
            };

            const validation = combatSystem.validateHiveTarget(mockProtector as any, fakeHive);
            
            expect(validation.isValid).toBe(false);
            expect(validation.reason).toBe('invalid_type');
        });
    });

    describe('Multi-Protector Hive Assault', () => {
        test('should coordinate multi-protector assault with difficulty scaling', () => {
            // Create Queen and constructed Hive
            const queenConfig = {
                territory: mockTerritory as any,
                generation: 1,
                health: 75,
                growthDuration: 90
            };
            const queen = new Queen(queenConfig);

            const hiveConfig = {
                position: new Vector3(100, 0, 100),
                territory: mockTerritory as any,
                queen: queen,
                health: 25,
                constructionDuration: 12
            };
            const hive = new Hive(hiveConfig);
            hive['isConstructed'] = true;

            // Create multiple protectors
            const protectors = [
                new MockProtector('protector_1', new Vector3(90, 0, 90)),
                new MockProtector('protector_2', new Vector3(110, 0, 90)),
                new MockProtector('protector_3', new Vector3(100, 0, 80))
            ];

            const assaultResult = combatSystem.coordinateHiveAssault(hive, protectors as any);
            
            expect(assaultResult.success).toBe(true);
            expect(assaultResult.assaultDifficulty).toBe('easy'); // 3+ protectors = easy
            expect(assaultResult.recommendedProtectors).toBe(3);
            expect(assaultResult.totalDamage).toBeGreaterThan(0);
        });

        test('should scale difficulty for single protector assault', () => {
            // Create Queen and constructed Hive
            const queenConfig = {
                territory: mockTerritory as any,
                generation: 1,
                health: 75,
                growthDuration: 90
            };
            const queen = new Queen(queenConfig);

            const hiveConfig = {
                position: new Vector3(100, 0, 100),
                territory: mockTerritory as any,
                queen: queen,
                health: 25,
                constructionDuration: 12
            };
            const hive = new Hive(hiveConfig);
            hive['isConstructed'] = true;

            // Single protector assault
            const protectors = [
                new MockProtector('protector_1', new Vector3(90, 0, 90))
            ];

            const assaultResult = combatSystem.coordinateHiveAssault(hive, protectors as any);
            
            expect(assaultResult.success).toBe(true);
            expect(assaultResult.assaultDifficulty).toBe('hard'); // Single protector = hard
            expect(assaultResult.recommendedProtectors).toBeGreaterThanOrEqual(3);
        });

        test('should calculate reduced damage for single protector', () => {
            // Create Queen and constructed Hive
            const queenConfig = {
                territory: mockTerritory as any,
                generation: 1,
                health: 75,
                growthDuration: 90
            };
            const queen = new Queen(queenConfig);

            const hiveConfig = {
                position: new Vector3(100, 0, 100),
                territory: mockTerritory as any,
                queen: queen,
                health: 25,
                constructionDuration: 12
            };
            const hive = new Hive(hiveConfig);

            const singleProtector = [new MockProtector('protector_1', new Vector3(90, 0, 90))];
            const multipleProtectors = [
                new MockProtector('protector_1', new Vector3(90, 0, 90)),
                new MockProtector('protector_2', new Vector3(110, 0, 90))
            ];

            const singleDamage = combatSystem.calculateHiveAssaultDamage(hive, singleProtector as any);
            const multiDamage = combatSystem.calculateHiveAssaultDamage(hive, multipleProtectors as any);

            // Single protector should do less damage per protector due to difficulty scaling
            expect(singleDamage).toBeLessThan(multiDamage / 2); // Less than half the multi-protector damage
        });
    });

    describe('Target Prioritization with Territory Awareness', () => {
        test('should prioritize Queens over other targets', () => {
            // Create vulnerable Queen
            const queenConfig = {
                territory: mockTerritory as any,
                generation: 1,
                health: 75,
                growthDuration: 90
            };
            const queen = new Queen(queenConfig);
            queen['currentPhase'] = QueenPhase.ACTIVE_CONTROL;
            queen['position'] = new Vector3(50, 2, 50);

            // Create mock parasite
            const parasite = {
                id: 'parasite_1',
                position: new Vector3(40, 0, 40),
                health: 20,
                maxHealth: 20,
                takeDamage: jest.fn(),
                onDestroyed: jest.fn()
            };

            const targets = [parasite, queen];
            const prioritized = combatSystem.prioritizeTargetsWithTerritory(mockProtector as any, targets);

            // Queen should be first (highest priority)
            expect(prioritized[0]).toBe(queen);
            expect(prioritized[1]).toBe(parasite);
        });

        test('should prioritize constructed Hives over parasites', () => {
            // Create Queen and constructed Hive
            const queenConfig = {
                territory: mockTerritory as any,
                generation: 1,
                health: 75,
                growthDuration: 90
            };
            const queen = new Queen(queenConfig);

            const hiveConfig = {
                position: new Vector3(60, 0, 60),
                territory: mockTerritory as any,
                queen: queen,
                health: 25,
                constructionDuration: 12
            };
            const hive = new Hive(hiveConfig);
            hive['isConstructed'] = true;

            // Create mock parasite
            const parasite = {
                id: 'parasite_1',
                position: new Vector3(40, 0, 40),
                health: 20,
                maxHealth: 20,
                takeDamage: jest.fn(),
                onDestroyed: jest.fn()
            };

            const targets = [parasite, hive];
            const prioritized = combatSystem.prioritizeTargetsWithTerritory(mockProtector as any, targets);

            // Hive should be first (higher priority than parasites)
            expect(prioritized[0]).toBe(hive);
            expect(prioritized[1]).toBe(parasite);
        });
    });

    describe('Defensive Priority Calculation', () => {
        test('should calculate high priority for territories with vulnerable Queens', () => {
            const territoryWithQueen = {
                ...mockTerritory,
                queen: {
                    isVulnerable: () => true
                },
                parasiteCount: 10
            };

            const priority = combatSystem.getDefensivePriorityInTerritory(territoryWithQueen);
            
            expect(priority).toBeGreaterThan(50); // Base + Queen + parasites
        });

        test('should calculate lower priority for liberated territories', () => {
            const liberatedTerritory = {
                ...mockTerritory,
                controlStatus: 'liberated' as const,
                parasiteCount: 5
            };

            const priority = combatSystem.getDefensivePriorityInTerritory(liberatedTerritory);
            
            expect(priority).toBeLessThan(30); // Reduced priority for liberated
        });

        test('should increase priority based on defensive swarm size', () => {
            const territoryWithLargeSwarm = {
                ...mockTerritory,
                hive: {
                    isHiveConstructed: () => true,
                    getActiveDefensiveParasiteCount: () => 60
                },
                parasiteCount: 60
            };

            const territoryWithSmallSwarm = {
                ...mockTerritory,
                hive: {
                    isHiveConstructed: () => true,
                    getActiveDefensiveParasiteCount: () => 10
                },
                parasiteCount: 10
            };

            const largePriority = combatSystem.getDefensivePriorityInTerritory(territoryWithLargeSwarm);
            const smallPriority = combatSystem.getDefensivePriorityInTerritory(territoryWithSmallSwarm);
            
            expect(largePriority).toBeGreaterThan(smallPriority);
        });
    });
});