/**
 * ErrorRecoveryManager Tests
 * 
 * Tests error detection and recovery mechanisms for:
 * - Territory overlap detection and correction
 * - Queen lifecycle corruption recovery
 * - Hive construction failure retry logic
 * - Parasite control consistency validation
 */

import { Vector3 } from '@babylonjs/core';
import { ErrorRecoveryManager } from '../ErrorRecoveryManager';
import { TerritoryManager, Territory } from '../TerritoryManager';
import { ParasiteManager } from '../ParasiteManager';
import { GameEngine } from '../GameEngine';
import { Queen, QueenPhase } from '../entities/Queen';
import { Hive } from '../entities/Hive';

// Mock dependencies
jest.mock('../GameEngine');
jest.mock('../TerritoryManager');
jest.mock('../ParasiteManager');
jest.mock('../entities/Queen');
jest.mock('../entities/Hive');

describe('ErrorRecoveryManager', () => {
    let errorRecoveryManager: ErrorRecoveryManager;
    let mockTerritoryManager: jest.Mocked<TerritoryManager>;
    let mockParasiteManager: jest.Mocked<ParasiteManager>;
    let mockGameEngine: jest.Mocked<GameEngine>;

    beforeEach(() => {
        // Create mocks with default return values
        mockTerritoryManager = {
            getAllTerritories: jest.fn().mockReturnValue([]),
            getAllQueens: jest.fn().mockReturnValue([]),
            getTerritory: jest.fn().mockReturnValue(null),
            getTerritoryAt: jest.fn().mockReturnValue(null),
            isPositionInTerritory: jest.fn().mockReturnValue(false)
        } as any;

        mockParasiteManager = {
            getAllParasites: jest.fn().mockReturnValue([]),
            validateParasiteControlConsistency: jest.fn().mockReturnValue(true),
            recalculateParasiteControl: jest.fn()
        } as any;

        mockGameEngine = {} as any;

        // Create ErrorRecoveryManager with test configuration
        errorRecoveryManager = new ErrorRecoveryManager(
            mockTerritoryManager,
            mockParasiteManager,
            mockGameEngine,
            {
                maxRetryAttempts: 2,
                retryDelayMs: 100, // Short delay for tests
                validationIntervalMs: 50, // Short interval for tests
                enableLogging: false // Disable logging for tests
            }
        );
    });

    afterEach(() => {
        errorRecoveryManager.dispose();
        jest.clearAllMocks();
    });

    describe('Territory Overlap Detection', () => {
        it('should detect territory overlaps', () => {
            // Create overlapping territories
            const territory1: Territory = {
                id: 'territory_0_0',
                centerPosition: new Vector3(512, 0, 512),
                size: 1024,
                chunkBounds: {
                    minX: 0,
                    maxX: 1024,
                    minZ: 0,
                    maxZ: 1024,
                    chunkCoords: []
                },
                queen: null,
                hive: null,
                controlStatus: 'contested',
                liberationTimer: 0,
                liberationStartTime: 0,
                parasiteCount: 0
            };

            const territory2: Territory = {
                id: 'territory_1_0',
                centerPosition: new Vector3(1024, 0, 512),
                size: 1024,
                chunkBounds: {
                    minX: 512, // Overlaps with territory1
                    maxX: 1536,
                    minZ: 0,
                    maxZ: 1024,
                    chunkCoords: []
                },
                queen: null,
                hive: null,
                controlStatus: 'contested',
                liberationTimer: 0,
                liberationStartTime: 0,
                parasiteCount: 0
            };

            mockTerritoryManager.getAllTerritories.mockReturnValue([territory1, territory2]);

            // Perform validation
            errorRecoveryManager.performSystemValidation();

            // Check that overlap was detected
            const errors = errorRecoveryManager.getCurrentErrors();
            expect(errors.territoryOverlaps).toBe(1);
        });

        it('should not detect overlaps for non-overlapping territories', () => {
            // Create non-overlapping territories
            const territory1: Territory = {
                id: 'territory_0_0',
                centerPosition: new Vector3(512, 0, 512),
                size: 1024,
                chunkBounds: {
                    minX: 0,
                    maxX: 1024,
                    minZ: 0,
                    maxZ: 1024,
                    chunkCoords: []
                },
                queen: null,
                hive: null,
                controlStatus: 'contested',
                liberationTimer: 0,
                liberationStartTime: 0,
                parasiteCount: 0
            };

            const territory2: Territory = {
                id: 'territory_1_0',
                centerPosition: new Vector3(1536, 0, 512),
                size: 1024,
                chunkBounds: {
                    minX: 1024, // No overlap
                    maxX: 2048,
                    minZ: 0,
                    maxZ: 1024,
                    chunkCoords: []
                },
                queen: null,
                hive: null,
                controlStatus: 'contested',
                liberationTimer: 0,
                liberationStartTime: 0,
                parasiteCount: 0
            };

            mockTerritoryManager.getAllTerritories.mockReturnValue([territory1, territory2]);

            // Perform validation
            errorRecoveryManager.performSystemValidation();

            // Check that no overlap was detected
            const errors = errorRecoveryManager.getCurrentErrors();
            expect(errors.territoryOverlaps).toBe(0);
        });
    });

    describe('Queen Corruption Detection', () => {
        it('should detect Queen with invalid vulnerability state', () => {
            const mockQueen = {
                id: 'queen_1',
                isActiveQueen: jest.fn().mockReturnValue(true),
                getCurrentPhase: jest.fn().mockReturnValue(QueenPhase.UNDERGROUND_GROWTH),
                isVulnerable: jest.fn().mockReturnValue(true), // Should be false during growth
                getHive: jest.fn().mockReturnValue(null),
                getGrowthTimeRemaining: jest.fn().mockReturnValue(30),
                getGrowthProgress: jest.fn().mockReturnValue(0.5)
            } as any;

            mockTerritoryManager.getAllQueens.mockReturnValue([mockQueen]);

            // Perform validation
            errorRecoveryManager.performSystemValidation();

            // Check that corruption was detected
            const errors = errorRecoveryManager.getCurrentErrors();
            expect(errors.queenCorruptions).toBe(1);
        });

        it('should detect Queen missing hive during active control', () => {
            const mockQueen = {
                id: 'queen_2',
                isActiveQueen: jest.fn().mockReturnValue(true),
                getCurrentPhase: jest.fn().mockReturnValue(QueenPhase.ACTIVE_CONTROL),
                isVulnerable: jest.fn().mockReturnValue(true),
                getHive: jest.fn().mockReturnValue(null), // Should have hive during active control
                getGrowthTimeRemaining: jest.fn().mockReturnValue(0),
                getGrowthProgress: jest.fn().mockReturnValue(1.0)
            } as any;

            mockTerritoryManager.getAllQueens.mockReturnValue([mockQueen]);

            // Perform validation
            errorRecoveryManager.performSystemValidation();

            // Check that corruption was detected
            const errors = errorRecoveryManager.getCurrentErrors();
            expect(errors.queenCorruptions).toBe(1);
        });

        it('should detect stuck growth phase', () => {
            const mockQueen = {
                id: 'queen_3',
                isActiveQueen: jest.fn().mockReturnValue(true),
                getCurrentPhase: jest.fn().mockReturnValue(QueenPhase.UNDERGROUND_GROWTH),
                isVulnerable: jest.fn().mockReturnValue(false),
                getHive: jest.fn().mockReturnValue(null),
                getGrowthTimeRemaining: jest.fn().mockReturnValue(0), // Time expired
                getGrowthProgress: jest.fn().mockReturnValue(0.8) // But not complete
            } as any;

            mockTerritoryManager.getAllQueens.mockReturnValue([mockQueen]);

            // Perform validation
            errorRecoveryManager.performSystemValidation();

            // Check that corruption was detected
            const errors = errorRecoveryManager.getCurrentErrors();
            expect(errors.queenCorruptions).toBe(1);
        });
    });

    describe('Hive Construction Failure Detection', () => {
        it('should detect hive construction timeout', () => {
            const mockHive = {
                id: 'hive_1',
                isHiveConstructed: jest.fn().mockReturnValue(false),
                getConstructionProgress: jest.fn().mockReturnValue(0.5),
                getConstructionTimeRemaining: jest.fn().mockReturnValue(-10) // Overtime
            } as any;

            const mockQueen = {
                id: 'queen_4',
                isActiveQueen: jest.fn().mockReturnValue(true),
                getCurrentPhase: jest.fn().mockReturnValue(QueenPhase.HIVE_CONSTRUCTION)
            } as any;

            const territory: Territory = {
                id: 'territory_1',
                centerPosition: new Vector3(0, 0, 0),
                size: 1024,
                chunkBounds: {
                    minX: 0,
                    maxX: 1024,
                    minZ: 0,
                    maxZ: 1024,
                    chunkCoords: []
                },
                queen: mockQueen,
                hive: mockHive,
                controlStatus: 'queen_controlled',
                liberationTimer: 0,
                liberationStartTime: 0,
                parasiteCount: 0
            };

            mockTerritoryManager.getAllTerritories.mockReturnValue([territory]);

            // Perform validation
            errorRecoveryManager.performSystemValidation();

            // Check that construction failure was detected
            const errors = errorRecoveryManager.getCurrentErrors();
            expect(errors.hiveConstructionFailures).toBe(1);
        });

        it('should detect missing hive during construction phase', () => {
            const mockQueen = {
                id: 'queen_5',
                isActiveQueen: jest.fn().mockReturnValue(true),
                getCurrentPhase: jest.fn().mockReturnValue(QueenPhase.HIVE_CONSTRUCTION)
            } as any;

            const territory: Territory = {
                id: 'territory_2',
                centerPosition: new Vector3(0, 0, 0),
                size: 1024,
                chunkBounds: {
                    minX: 0,
                    maxX: 1024,
                    minZ: 0,
                    maxZ: 1024,
                    chunkCoords: []
                },
                queen: mockQueen,
                hive: null, // Missing hive
                controlStatus: 'queen_controlled',
                liberationTimer: 0,
                liberationStartTime: 0,
                parasiteCount: 0
            };

            mockTerritoryManager.getAllTerritories.mockReturnValue([territory]);

            // Perform validation
            errorRecoveryManager.performSystemValidation();

            // Check that construction failure was detected
            const errors = errorRecoveryManager.getCurrentErrors();
            expect(errors.hiveConstructionFailures).toBe(1);
        });
    });

    describe('Parasite Control Validation', () => {
        it('should detect orphaned parasites', () => {
            const mockParasite = {
                getId: jest.fn().mockReturnValue('parasite_1'),
                isAlive: jest.fn().mockReturnValue(true),
                getPosition: jest.fn().mockReturnValue(new Vector3(100, 0, 100))
            } as any;

            mockParasiteManager.getAllParasites.mockReturnValue([mockParasite]);
            mockTerritoryManager.getTerritoryAt.mockReturnValue(null); // No territory

            // Perform validation
            errorRecoveryManager.performSystemValidation();

            // Check that control error was detected
            const errors = errorRecoveryManager.getCurrentErrors();
            expect(errors.parasiteControlErrors).toBe(1);
        });

        it('should detect wrong Queen control', () => {
            const mockParasite = {
                getId: jest.fn().mockReturnValue('parasite_2'),
                isAlive: jest.fn().mockReturnValue(true),
                getPosition: jest.fn().mockReturnValue(new Vector3(100, 0, 100))
            } as any;

            const mockCorrectQueen = {
                id: 'correct_queen',
                isActiveQueen: jest.fn().mockReturnValue(true),
                getCurrentPhase: jest.fn().mockReturnValue(QueenPhase.ACTIVE_CONTROL),
                getControlledParasites: jest.fn().mockReturnValue([])
            } as any;

            const mockWrongQueen = {
                id: 'wrong_queen',
                isActiveQueen: jest.fn().mockReturnValue(true),
                getCurrentPhase: jest.fn().mockReturnValue(QueenPhase.ACTIVE_CONTROL),
                getControlledParasites: jest.fn().mockReturnValue(['parasite_2'])
            } as any;

            const territory: Territory = {
                id: 'territory_3',
                centerPosition: new Vector3(0, 0, 0),
                size: 1024,
                chunkBounds: {
                    minX: 0,
                    maxX: 1024,
                    minZ: 0,
                    maxZ: 1024,
                    chunkCoords: []
                },
                queen: mockCorrectQueen,
                hive: null,
                controlStatus: 'queen_controlled',
                liberationTimer: 0,
                liberationStartTime: 0,
                parasiteCount: 0
            };

            const wrongTerritory: Territory = {
                id: 'territory_4',
                centerPosition: new Vector3(2000, 0, 2000),
                size: 1024,
                chunkBounds: {
                    minX: 1500,
                    maxX: 2500,
                    minZ: 1500,
                    maxZ: 2500,
                    chunkCoords: []
                },
                queen: mockWrongQueen,
                hive: null,
                controlStatus: 'queen_controlled',
                liberationTimer: 0,
                liberationStartTime: 0,
                parasiteCount: 0
            };

            mockParasiteManager.getAllParasites.mockReturnValue([mockParasite]);
            mockTerritoryManager.getTerritoryAt.mockReturnValue(territory);
            mockTerritoryManager.getAllTerritories.mockReturnValue([territory, wrongTerritory]);

            // Perform validation
            errorRecoveryManager.performSystemValidation();

            // Check that control error was detected
            const errors = errorRecoveryManager.getCurrentErrors();
            expect(errors.parasiteControlErrors).toBe(1);
        });
    });

    describe('Error Recovery', () => {
        it('should track recovery statistics', () => {
            const stats = errorRecoveryManager.getStats();
            
            expect(stats).toHaveProperty('territoryOverlapErrors');
            expect(stats).toHaveProperty('queenCorruptionErrors');
            expect(stats).toHaveProperty('hiveConstructionErrors');
            expect(stats).toHaveProperty('parasiteControlErrors');
            expect(stats).toHaveProperty('totalRecoveryAttempts');
            expect(stats).toHaveProperty('successfulRecoveries');
            expect(stats).toHaveProperty('lastValidationTime');
        });

        it('should clear errors when requested', () => {
            // First create some errors
            const territory1: Territory = {
                id: 'territory_0_0',
                centerPosition: new Vector3(512, 0, 512),
                size: 1024,
                chunkBounds: {
                    minX: 0,
                    maxX: 1024,
                    minZ: 0,
                    maxZ: 1024,
                    chunkCoords: []
                },
                queen: null,
                hive: null,
                controlStatus: 'contested',
                liberationTimer: 0,
                liberationStartTime: 0,
                parasiteCount: 0
            };

            const territory2: Territory = {
                id: 'territory_1_0',
                centerPosition: new Vector3(1024, 0, 512),
                size: 1024,
                chunkBounds: {
                    minX: 512, // Overlaps with territory1
                    maxX: 1536,
                    minZ: 0,
                    maxZ: 1024,
                    chunkCoords: []
                },
                queen: null,
                hive: null,
                controlStatus: 'contested',
                liberationTimer: 0,
                liberationStartTime: 0,
                parasiteCount: 0
            };

            mockTerritoryManager.getAllTerritories.mockReturnValue([territory1, territory2]);
            mockTerritoryManager.getAllQueens.mockReturnValue([]);
            mockParasiteManager.getAllParasites.mockReturnValue([]);

            // Perform validation to create errors
            errorRecoveryManager.performSystemValidation();

            // Verify errors exist
            let errors = errorRecoveryManager.getCurrentErrors();
            expect(errors.territoryOverlaps).toBe(1);

            // Clear errors
            errorRecoveryManager.clearErrors();

            // Verify errors are cleared
            errors = errorRecoveryManager.getCurrentErrors();
            expect(errors.territoryOverlaps).toBe(0);
            expect(errors.queenCorruptions).toBe(0);
            expect(errors.hiveConstructionFailures).toBe(0);
            expect(errors.parasiteControlErrors).toBe(0);
        });

        it('should update configuration', () => {
            const newConfig = {
                maxRetryAttempts: 5,
                retryDelayMs: 2000,
                enableLogging: true
            };

            errorRecoveryManager.updateConfig(newConfig);

            // Configuration update is internal, but we can test that it doesn't throw
            expect(() => errorRecoveryManager.updateConfig(newConfig)).not.toThrow();
        });
    });

    describe('Integration', () => {
        it('should handle empty system gracefully', () => {
            mockTerritoryManager.getAllTerritories.mockReturnValue([]);
            mockTerritoryManager.getAllQueens.mockReturnValue([]);
            mockParasiteManager.getAllParasites.mockReturnValue([]);

            // Should not throw
            expect(() => errorRecoveryManager.performSystemValidation()).not.toThrow();

            // Should have no errors
            const errors = errorRecoveryManager.getCurrentErrors();
            expect(errors.territoryOverlaps).toBe(0);
            expect(errors.queenCorruptions).toBe(0);
            expect(errors.hiveConstructionFailures).toBe(0);
            expect(errors.parasiteControlErrors).toBe(0);
        });

        it('should handle null/undefined values gracefully', () => {
            mockTerritoryManager.getAllTerritories.mockReturnValue([]);
            mockTerritoryManager.getAllQueens.mockReturnValue([null as any]);
            mockParasiteManager.getAllParasites.mockReturnValue([undefined as any]);

            // Should not throw
            expect(() => errorRecoveryManager.performSystemValidation()).not.toThrow();
        });
    });
});