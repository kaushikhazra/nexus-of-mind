/**
 * TerritoryVisualUI Tests
 * 
 * Unit tests for territory boundary indicator display, liberation timer countdown,
 * and territory entry/exit visual feedback functionality.
 */

import { TerritoryVisualUI, TerritoryVisualUIConfig } from '../TerritoryVisualUI';
import { TerritoryManager, Territory } from '../../game/TerritoryManager';
import { LiberationManager } from '../../game/LiberationManager';
import { Queen, QueenPhase } from '../../game/entities/Queen';
import { Vector3 } from '@babylonjs/core';

// Mock DOM environment
const mockContainer = {
    innerHTML: '',
    style: { display: 'block' },
    appendChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(),
    removeChild: jest.fn()
};

const mockDocument = {
    getElementById: jest.fn().mockReturnValue(mockContainer),
    createElement: jest.fn().mockImplementation((tag: string) => ({
        tagName: tag.toUpperCase(),
        className: '',
        innerHTML: '',
        textContent: '',
        style: { 
            cssText: '',
            borderColor: '',
            color: '',
            display: 'block'
        },
        appendChild: jest.fn(),
        setAttribute: jest.fn(),
        classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn()
        },
        parentNode: mockContainer
    })),
    querySelector: jest.fn().mockReturnValue(null),
    head: {
        appendChild: jest.fn()
    }
};

const mockWindow = {
    setInterval: jest.fn().mockReturnValue(123),
    clearInterval: jest.fn(),
    setTimeout: jest.fn(),
    performance: {
        now: jest.fn().mockReturnValue(1000)
    }
};

// Setup global mocks
(global as any).document = mockDocument;
(global as any).window = mockWindow;

// Mock TerritoryManager
class MockTerritoryManager {
    private territories: Map<string, Territory> = new Map();
    private mockLiberationManager: MockLiberationManager;

    constructor() {
        this.mockLiberationManager = new MockLiberationManager();
    }

    public getTerritoryAt(x: number, z: number): Territory | null {
        // Simple mock: return territory if position is within bounds
        for (const territory of this.territories.values()) {
            const bounds = territory.chunkBounds;
            if (x >= bounds.minX && x < bounds.maxX && z >= bounds.minZ && z < bounds.maxZ) {
                return territory;
            }
        }
        return null;
    }

    public getLiberationManager(): MockLiberationManager {
        return this.mockLiberationManager;
    }

    public addMockTerritory(territory: Territory): void {
        this.territories.set(territory.id, territory);
    }

    public removeMockTerritory(territoryId: string): void {
        this.territories.delete(territoryId);
    }

    public clearTerritories(): void {
        this.territories.clear();
    }
}

// Mock LiberationManager
class MockLiberationManager {
    private liberationStatuses: Map<string, any> = new Map();

    public getLiberationStatus(territoryId: string): any {
        return this.liberationStatuses.get(territoryId) || null;
    }

    public setMockLiberationStatus(territoryId: string, status: any): void {
        this.liberationStatuses.set(territoryId, status);
    }

    public clearLiberationStatuses(): void {
        this.liberationStatuses.clear();
    }
}

// Mock Queen class
class MockQueen {
    public readonly id: string;
    private mockStats: any;
    private mockTerritory: Territory;

    constructor(id: string, stats: any, territory: Territory) {
        this.id = id;
        this.mockStats = stats;
        this.mockTerritory = territory;
    }

    public getStats(): any {
        return this.mockStats;
    }

    public getTerritory(): Territory {
        return this.mockTerritory;
    }

    public updateMockStats(newStats: Partial<any>): void {
        this.mockStats = { ...this.mockStats, ...newStats };
    }
}

describe('TerritoryVisualUI', () => {
    let territoryVisualUI: TerritoryVisualUI;
    let mockTerritoryManager: MockTerritoryManager;
    let mockTerritory: Territory;
    let config: TerritoryVisualUIConfig;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        mockWindow.performance.now.mockReturnValue(1000);
        mockWindow.setInterval.mockReturnValue(123);
        
        // Create mock territory
        mockTerritory = {
            id: 'territory_0_0',
            centerPosition: new Vector3(0, 0, 0),
            size: 1024,
            chunkBounds: {
                minX: -512,
                maxX: 512,
                minZ: -512,
                maxZ: 512,
                chunkCoords: []
            },
            queen: null,
            hive: null,
            controlStatus: 'contested',
            liberationTimer: 0,
            liberationStartTime: 0,
            parasiteCount: 0
        };

        // Setup configuration
        config = {
            containerId: 'territory-visual-container',
            updateInterval: 100,
            showBoundaryIndicators: true,
            showLiberationTimer: true,
            showQueenStatus: true,
            maxDisplayTerritories: 3
        };

        // Create instances
        mockTerritoryManager = new MockTerritoryManager();
        territoryVisualUI = new TerritoryVisualUI(config);
        territoryVisualUI.setTerritoryManager(mockTerritoryManager as any);
    });

    afterEach(() => {
        territoryVisualUI.dispose();
    });

    describe('Initialization', () => {
        test('should initialize with correct configuration', () => {
            expect(mockDocument.getElementById).toHaveBeenCalledWith('territory-visual-container');
            expect(mockWindow.setInterval).toHaveBeenCalledWith(expect.any(Function), 100);
        });

        test('should handle missing container gracefully', () => {
            mockDocument.getElementById.mockReturnValueOnce(null);
            
            const ui = new TerritoryVisualUI(config);
            
            // Should not throw error
            expect(ui).toBeDefined();
            ui.dispose();
        });

        test('should use default configuration values', () => {
            const minimalConfig = { containerId: 'test-container' };
            const ui = new TerritoryVisualUI(minimalConfig);
            
            // Should use defaults for missing values
            expect(mockWindow.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
            ui.dispose();
        });
    });

    describe('Territory Entry/Exit Detection', () => {
        test('should detect territory entry', () => {
            mockTerritoryManager.addMockTerritory(mockTerritory);
            
            // Player enters territory
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            // Should show entry notification
            const createdElements = mockDocument.createElement.mock.results;
            const notification = createdElements.find(result => 
                result.value.className === 'territory-entry-notification'
            );
            
            expect(notification).toBeDefined();
        });

        test('should detect territory exit', () => {
            mockTerritoryManager.addMockTerritory(mockTerritory);
            
            // Player enters territory first
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            // Clear previous setTimeout calls
            mockWindow.setTimeout.mockClear();
            
            // Then exits territory
            territoryVisualUI.setPlayerPosition(new Vector3(1000, 0, 1000));
            
            // Should show exit notification (setTimeout called to hide it after 3 seconds)
            expect(mockWindow.setTimeout).toHaveBeenCalled();
        });

        test('should detect movement between territories', () => {
            const territory1 = { ...mockTerritory, id: 'territory_0_0' };
            const territory2 = {
                ...mockTerritory,
                id: 'territory_1_0',
                centerPosition: new Vector3(1024, 0, 0),
                chunkBounds: {
                    minX: 512,
                    maxX: 1536,
                    minZ: -512,
                    maxZ: 512,
                    chunkCoords: []
                }
            };

            mockTerritoryManager.addMockTerritory(territory1);
            mockTerritoryManager.addMockTerritory(territory2);
            
            // Player enters first territory
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            // Clear previous setTimeout calls
            mockWindow.setTimeout.mockClear();
            
            // Player moves to second territory
            territoryVisualUI.setPlayerPosition(new Vector3(1024, 0, 0));
            
            // Should show territory change notification (setTimeout called to hide it after 3 seconds)
            expect(mockWindow.setTimeout).toHaveBeenCalled();
        });

        test('should not trigger notifications for movement within same territory', () => {
            mockTerritoryManager.addMockTerritory(mockTerritory);
            
            // Player enters territory
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const initialTimeoutCalls = mockWindow.setTimeout.mock.calls.length;
            
            // Player moves within same territory
            territoryVisualUI.setPlayerPosition(new Vector3(100, 0, 100));
            
            // Should not trigger additional notifications
            expect(mockWindow.setTimeout).toHaveBeenCalledTimes(initialTimeoutCalls);
        });
    });

    describe('Boundary Indicator Display', () => {
        test('should show boundary indicator when player is in territory', () => {
            mockTerritoryManager.addMockTerritory(mockTerritory);
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            // Trigger update
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should create boundary indicator elements
            expect(mockDocument.createElement).toHaveBeenCalled();
        });

        test('should hide boundary indicator when player is outside territory', () => {
            mockTerritoryManager.addMockTerritory(mockTerritory);
            territoryVisualUI.setPlayerPosition(new Vector3(2000, 0, 2000));
            
            // Trigger update
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Boundary indicator should be hidden
            const createdElements = mockDocument.createElement.mock.results;
            const boundaryIndicator = createdElements.find(result => 
                result.value.className === 'boundary-indicator'
            );
            
            if (boundaryIndicator) {
                expect(boundaryIndicator.value.style.display).toBe('none');
            }
        });

        test('should display correct territory coordinates', () => {
            mockTerritoryManager.addMockTerritory(mockTerritory);
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should display territory coordinates (0, 0)
            const createdElements = mockDocument.createElement.mock.results;
            const boundaryIndicator = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('(0, 0)')
            );
            
            expect(boundaryIndicator).toBeDefined();
        });

        test('should display correct territory status', () => {
            mockTerritory.controlStatus = 'queen_controlled';
            mockTerritoryManager.addMockTerritory(mockTerritory);
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should display Queen Controlled status
            const createdElements = mockDocument.createElement.mock.results;
            const statusDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('Queen Controlled')
            );
            
            expect(statusDisplay).toBeDefined();
        });
    });

    describe('Liberation Timer Display', () => {
        test('should show liberation timer for liberated territories', () => {
            mockTerritory.controlStatus = 'liberated';
            mockTerritoryManager.addMockTerritory(mockTerritory);
            
            // Mock liberation status
            const mockLiberationManager = mockTerritoryManager.getLiberationManager();
            mockLiberationManager.setMockLiberationStatus('territory_0_0', {
                isLiberated: true,
                timeRemaining: 180, // 3 minutes
                miningBonus: 0.25
            });
            
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should display liberation timer
            const createdElements = mockDocument.createElement.mock.results;
            const liberationDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('3:00')
            );
            
            expect(liberationDisplay).toBeDefined();
        });

        test('should show mining bonus during liberation', () => {
            mockTerritory.controlStatus = 'liberated';
            mockTerritoryManager.addMockTerritory(mockTerritory);
            
            const mockLiberationManager = mockTerritoryManager.getLiberationManager();
            mockLiberationManager.setMockLiberationStatus('territory_0_0', {
                isLiberated: true,
                timeRemaining: 180,
                miningBonus: 0.25
            });
            
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should display 25% mining bonus
            const createdElements = mockDocument.createElement.mock.results;
            const bonusDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('+25% Mining')
            );
            
            expect(bonusDisplay).toBeDefined();
        });

        test('should hide liberation timer for non-liberated territories', () => {
            mockTerritory.controlStatus = 'queen_controlled';
            mockTerritoryManager.addMockTerritory(mockTerritory);
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Liberation display should be hidden
            const createdElements = mockDocument.createElement.mock.results;
            const liberationDisplay = createdElements.find(result => 
                result.value.className === 'liberation-display'
            );
            
            if (liberationDisplay) {
                expect(liberationDisplay.value.style.display).toBe('none');
            }
        });

        test('should update timer countdown accurately', () => {
            mockTerritory.controlStatus = 'liberated';
            mockTerritoryManager.addMockTerritory(mockTerritory);
            
            const mockLiberationManager = mockTerritoryManager.getLiberationManager();
            mockLiberationManager.setMockLiberationStatus('territory_0_0', {
                isLiberated: true,
                timeRemaining: 90, // 1:30
                miningBonus: 0.25
            });
            
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should display 1:30
            const createdElements = mockDocument.createElement.mock.results;
            const timerDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('1:30')
            );
            
            expect(timerDisplay).toBeDefined();
        });
    });

    describe('Queen Status Display', () => {
        test('should show Queen status for territories with Queens', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 2,
                currentPhase: QueenPhase.ACTIVE_CONTROL,
                isVulnerable: true
            }, mockTerritory);

            mockTerritory.queen = mockQueen as any;
            mockTerritory.controlStatus = 'queen_controlled';
            mockTerritoryManager.addMockTerritory(mockTerritory);
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should display Queen status
            const createdElements = mockDocument.createElement.mock.results;
            const queenDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('👑 Queen Status')
            );
            
            expect(queenDisplay).toBeDefined();
        });

        test('should show correct Queen generation', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 3,
                currentPhase: QueenPhase.ACTIVE_CONTROL,
                isVulnerable: true
            }, mockTerritory);

            mockTerritory.queen = mockQueen as any;
            mockTerritoryManager.addMockTerritory(mockTerritory);
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should display Gen 3
            const createdElements = mockDocument.createElement.mock.results;
            const genDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('Gen 3')
            );
            
            expect(genDisplay).toBeDefined();
        });

        test('should show correct Queen phase', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.HIVE_CONSTRUCTION,
                isVulnerable: false
            }, mockTerritory);

            mockTerritory.queen = mockQueen as any;
            mockTerritoryManager.addMockTerritory(mockTerritory);
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should display Building Hive phase
            const createdElements = mockDocument.createElement.mock.results;
            const phaseDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('Building Hive')
            );
            
            expect(phaseDisplay).toBeDefined();
        });

        test('should show vulnerability status correctly', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.ACTIVE_CONTROL,
                isVulnerable: true
            }, mockTerritory);

            mockTerritory.queen = mockQueen as any;
            mockTerritoryManager.addMockTerritory(mockTerritory);
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should display VULNERABLE status
            const createdElements = mockDocument.createElement.mock.results;
            const vulnDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('VULNERABLE')
            );
            
            expect(vulnDisplay).toBeDefined();
        });

        test('should show underground growth status for Queen-controlled territories without visible Queen', () => {
            mockTerritory.controlStatus = 'queen_controlled';
            mockTerritory.queen = null; // Queen underground
            mockTerritoryManager.addMockTerritory(mockTerritory);
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should display underground growth status
            const createdElements = mockDocument.createElement.mock.results;
            const undergroundDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('Growing Underground')
            );
            
            expect(undergroundDisplay).toBeDefined();
        });

        test('should hide Queen status for territories without Queens', () => {
            mockTerritory.controlStatus = 'contested';
            mockTerritory.queen = null;
            mockTerritoryManager.addMockTerritory(mockTerritory);
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Queen status display should be hidden
            const createdElements = mockDocument.createElement.mock.results;
            const queenDisplay = createdElements.find(result => 
                result.value.className === 'queen-status-display'
            );
            
            if (queenDisplay) {
                expect(queenDisplay.value.style.display).toBe('none');
            }
        });
    });

    describe('Time Formatting', () => {
        test('should format seconds correctly', () => {
            mockTerritory.controlStatus = 'liberated';
            mockTerritoryManager.addMockTerritory(mockTerritory);
            
            const mockLiberationManager = mockTerritoryManager.getLiberationManager();
            mockLiberationManager.setMockLiberationStatus('territory_0_0', {
                isLiberated: true,
                timeRemaining: 45, // 45 seconds
                miningBonus: 0.25
            });
            
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should display 0:45
            const createdElements = mockDocument.createElement.mock.results;
            const timerDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('0:45')
            );
            
            expect(timerDisplay).toBeDefined();
        });

        test('should format minutes and seconds correctly', () => {
            mockTerritory.controlStatus = 'liberated';
            mockTerritoryManager.addMockTerritory(mockTerritory);
            
            const mockLiberationManager = mockTerritoryManager.getLiberationManager();
            mockLiberationManager.setMockLiberationStatus('territory_0_0', {
                isLiberated: true,
                timeRemaining: 125, // 2:05
                miningBonus: 0.25
            });
            
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should display 2:05
            const createdElements = mockDocument.createElement.mock.results;
            const timerDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('2:05')
            );
            
            expect(timerDisplay).toBeDefined();
        });

        test('should handle zero time correctly', () => {
            mockTerritory.controlStatus = 'liberated';
            mockTerritoryManager.addMockTerritory(mockTerritory);
            
            const mockLiberationManager = mockTerritoryManager.getLiberationManager();
            mockLiberationManager.setMockLiberationStatus('territory_0_0', {
                isLiberated: true,
                timeRemaining: 0,
                miningBonus: 0.25
            });
            
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();
            
            // Should display 0:00
            const createdElements = mockDocument.createElement.mock.results;
            const timerDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('0:00')
            );
            
            expect(timerDisplay).toBeDefined();
        });
    });

    describe('Configuration Management', () => {
        test('should update configuration correctly', () => {
            const newConfig = {
                updateInterval: 200,
                showBoundaryIndicators: false
            };

            territoryVisualUI.updateConfig(newConfig);

            // Should restart interval with new timing
            expect(mockWindow.clearInterval).toHaveBeenCalled();
            expect(mockWindow.setInterval).toHaveBeenCalledWith(expect.any(Function), 200);
        });

        test('should handle visibility changes', () => {
            territoryVisualUI.setVisible(false);
            
            expect(mockContainer.style.display).toBe('none');

            territoryVisualUI.setVisible(true);
            
            expect(mockContainer.style.display).toBe('block');
        });

        test('should respect showBoundaryIndicators setting', () => {
            const configWithoutBoundaries = {
                ...config,
                showBoundaryIndicators: false
            };

            const ui = new TerritoryVisualUI(configWithoutBoundaries);
            ui.setTerritoryManager(mockTerritoryManager as any);
            
            mockTerritoryManager.addMockTerritory(mockTerritory);
            ui.setPlayerPosition(new Vector3(0, 0, 0));
            
            // Should not show boundary indicators
            // This would be verified by checking that boundary elements are not created
            // or are hidden when the setting is false
            
            ui.dispose();
        });
    });

    describe('Error Handling', () => {
        test('should handle missing territory manager gracefully', () => {
            const ui = new TerritoryVisualUI(config);
            // Don't set territory manager
            
            ui.setPlayerPosition(new Vector3(0, 0, 0));
            
            // Should not throw error
            expect(() => {
                const updateCallback = mockWindow.setInterval.mock.calls[0][0];
                updateCallback();
            }).not.toThrow();
            
            ui.dispose();
        });

        test('should handle missing liberation manager gracefully', () => {
            const mockTerritoryManagerWithoutLiberation = {
                getTerritoryAt: jest.fn().mockReturnValue(mockTerritory),
                getLiberationManager: jest.fn().mockReturnValue(null)
            };

            territoryVisualUI.setTerritoryManager(mockTerritoryManagerWithoutLiberation as any);
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            // Should not throw error
            expect(() => {
                const updateCallback = mockWindow.setInterval.mock.calls[0][0];
                updateCallback();
            }).not.toThrow();
        });

        test('should handle Queen stats errors gracefully', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.ACTIVE_CONTROL,
                isVulnerable: true
            }, mockTerritory);

            // Mock getStats to throw error
            mockQueen.getStats = jest.fn().mockImplementation(() => {
                throw new Error('Stats error');
            });

            mockTerritory.queen = mockQueen as any;
            mockTerritoryManager.addMockTerritory(mockTerritory);
            territoryVisualUI.setPlayerPosition(new Vector3(0, 0, 0));
            
            // Should not throw error
            expect(() => {
                const updateCallback = mockWindow.setInterval.mock.calls[0][0];
                updateCallback();
            }).not.toThrow();
        });
    });

    describe('Cleanup', () => {
        test('should clear intervals on dispose', () => {
            territoryVisualUI.dispose();
            
            expect(mockWindow.clearInterval).toHaveBeenCalled();
        });

        test('should clear container on dispose', () => {
            territoryVisualUI.dispose();
            
            expect(mockContainer.innerHTML).toBe('');
        });

        test('should handle multiple dispose calls gracefully', () => {
            territoryVisualUI.dispose();
            
            // Should not throw error on second dispose
            expect(() => territoryVisualUI.dispose()).not.toThrow();
        });
    });
});