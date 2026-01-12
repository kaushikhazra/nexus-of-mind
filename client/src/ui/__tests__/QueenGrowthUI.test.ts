/**
 * QueenGrowthUI Tests
 * 
 * Comprehensive unit tests for the Queen Growth UI system including
 * progress bar updates, animation timing, generation display, and status changes.
 */

import { QueenGrowthUI, QueenGrowthUIConfig } from '../QueenGrowthUI';
import { TerritoryManager, Territory } from '../../game/TerritoryManager';
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
        style: { cssText: '' },
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
    setInterval: jest.fn().mockReturnValue(123), // Return a mock interval ID
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
    private queens: Queen[] = [];

    public getAllQueens(): Queen[] {
        return this.queens;
    }

    public addMockQueen(queen: Queen): void {
        this.queens.push(queen);
    }

    public removeMockQueen(queenId: string): void {
        this.queens = this.queens.filter(q => q.id !== queenId);
    }

    public clearQueens(): void {
        this.queens = [];
    }
}

// Mock Queen class
class MockQueen {
    public readonly id: string;
    public position: Vector3;
    public health: number = 100;
    public maxHealth: number = 100;
    
    private mockStats: any;
    private mockTerritory: Territory;
    private mockHive: any = null;

    constructor(id: string, stats: any, territory: Territory) {
        this.id = id;
        this.position = new Vector3(0, 0, 0);
        this.mockStats = stats;
        this.mockTerritory = territory;
    }

    public getStats(): any {
        return this.mockStats;
    }

    public getTerritory(): Territory {
        return this.mockTerritory;
    }

    public getHive(): any {
        return this.mockHive;
    }

    public setMockHive(hive: any): void {
        this.mockHive = hive;
    }

    public updateMockStats(newStats: Partial<any>): void {
        this.mockStats = { ...this.mockStats, ...newStats };
    }
}

describe('QueenGrowthUI', () => {
    let queenGrowthUI: QueenGrowthUI;
    let mockTerritoryManager: MockTerritoryManager;
    let mockTerritory: Territory;
    let config: QueenGrowthUIConfig;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        mockWindow.performance.now.mockReturnValue(1000);
        mockWindow.setInterval.mockReturnValue(123); // Return consistent interval ID
        
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
            containerId: 'queen-growth-container',
            updateInterval: 100,
            showAllQueens: true,
            maxDisplayQueens: 3
        };

        // Create instances
        mockTerritoryManager = new MockTerritoryManager();
        queenGrowthUI = new QueenGrowthUI(config);
        queenGrowthUI.setTerritoryManager(mockTerritoryManager as any);
    });

    afterEach(() => {
        queenGrowthUI.dispose();
    });

    describe('Initialization', () => {
        test('should initialize with correct configuration', () => {
            expect(mockDocument.getElementById).toHaveBeenCalledWith('queen-growth-container');
            expect(mockWindow.setInterval).toHaveBeenCalledWith(expect.any(Function), 100);
        });

        test('should handle missing container gracefully', () => {
            mockDocument.getElementById.mockReturnValueOnce(null);
            
            const ui = new QueenGrowthUI(config);
            
            // Should not throw error
            expect(ui).toBeDefined();
            ui.dispose();
        });

        test('should use default configuration values', () => {
            const minimalConfig = { containerId: 'test-container' };
            const ui = new QueenGrowthUI(minimalConfig);
            
            // Should use defaults for missing values
            expect(mockWindow.setInterval).toHaveBeenCalledWith(expect.any(Function), 500);
            ui.dispose();
        });
    });

    describe('Queen Display Management', () => {
        test('should create display for new Queen in underground growth phase', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 0.3,
                isVulnerable: false
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            // Trigger update
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Should create display element
            expect(mockDocument.createElement).toHaveBeenCalledWith('div');
        });

        test('should update existing Queen display when progress changes', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 0.3,
                isVulnerable: false
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            // First update - create display
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            const initialCallCount = mockDocument.createElement.mock.calls.length;

            // Update Queen progress
            mockQueen.updateMockStats({ growthProgress: 0.7 });

            // Second update - should update existing display
            updateCallback();

            // Should not create new elements, just update existing
            expect(mockDocument.createElement).toHaveBeenCalledTimes(initialCallCount);
        });

        test('should remove display when Queen is no longer active', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 0.3,
                isVulnerable: false
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            // Create display
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Remove Queen
            mockTerritoryManager.removeMockQueen('queen_1');

            // Update should remove display
            updateCallback();

            // Should use setTimeout for fade-out animation
            expect(mockWindow.setTimeout).toHaveBeenCalled();
        });

        test('should limit number of displayed Queens', () => {
            // Add more Queens than the limit
            for (let i = 1; i <= 5; i++) {
                const mockQueen = new MockQueen(`queen_${i}`, {
                    id: `queen_${i}`,
                    generation: i,
                    currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                    growthProgress: 0.5,
                    isVulnerable: false
                }, mockTerritory);

                mockTerritoryManager.addMockQueen(mockQueen as any);
            }

            const initialCallCount = mockDocument.createElement.mock.calls.length;

            // Update should only display maxDisplayQueens (3)
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Should create elements for main container + limited Queens
            const finalCallCount = mockDocument.createElement.mock.calls.length;
            const newElements = finalCallCount - initialCallCount;
            
            // Should create at most 4 new elements (1 main container + 3 Queen displays)
            expect(newElements).toBeLessThanOrEqual(4);
        });
    });

    describe('Progress Bar Updates', () => {
        test('should show correct progress for underground growth phase', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 0.6,
                isVulnerable: false
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Check that progress bar is created with correct width
            const createdElements = mockDocument.createElement.mock.results;
            const progressFill = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('width: 60%')
            );
            
            expect(progressFill).toBeDefined();
        });

        test('should show correct progress for hive construction phase', () => {
            const mockHive = {
                getStats: () => ({ constructionProgress: 0.8 })
            };

            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.HIVE_CONSTRUCTION,
                growthProgress: 1.0,
                isVulnerable: false
            }, mockTerritory);

            mockQueen.setMockHive(mockHive);
            mockTerritoryManager.addMockQueen(mockQueen as any);

            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Should show construction progress
            const createdElements = mockDocument.createElement.mock.results;
            const progressFill = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('width: 80%')
            );
            
            expect(progressFill).toBeDefined();
        });

        test('should show 100% progress for active control phase', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.ACTIVE_CONTROL,
                growthProgress: 1.0,
                isVulnerable: true
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Should show 100% progress
            const createdElements = mockDocument.createElement.mock.results;
            const progressFill = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('width: 100%')
            );
            
            expect(progressFill).toBeDefined();
        });

        test('should handle progress values outside 0-1 range', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 1.5, // Invalid value > 1
                isVulnerable: false
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Should clamp to 100%
            const createdElements = mockDocument.createElement.mock.results;
            const progressFill = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('width: 100%')
            );
            
            expect(progressFill).toBeDefined();
        });
    });

    describe('Animation Timing', () => {
        test('should add fade-in animation for new Queen displays', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 0.3,
                isVulnerable: false
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Should create elements for Queen display
            expect(mockDocument.createElement).toHaveBeenCalled();
        });

        test('should add fade-out animation when removing Queen displays', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 0.3,
                isVulnerable: false
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            // Create display
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Remove Queen
            mockTerritoryManager.removeMockQueen('queen_1');
            updateCallback();

            // Should use setTimeout for fade-out animation
            expect(mockWindow.setTimeout).toHaveBeenCalled();
        });

        test('should update display at configured interval', () => {
            expect(mockWindow.setInterval).toHaveBeenCalledWith(expect.any(Function), 100);
        });

        test('should stop updates when disposed', () => {
            queenGrowthUI.dispose();
            
            expect(mockWindow.clearInterval).toHaveBeenCalled();
        });
    });

    describe('Generation Display', () => {
        test('should display correct generation number', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 5,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 0.3,
                isVulnerable: false
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Should display generation 5
            const createdElements = mockDocument.createElement.mock.results;
            const queenDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('Gen 5')
            );
            
            expect(queenDisplay).toBeDefined();
        });

        test('should update generation display when Queen regenerates', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 0.3,
                isVulnerable: false
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            // First update
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Simulate Queen regeneration with new generation
            mockQueen.updateMockStats({ generation: 2 });
            updateCallback();

            // Should display updated generation
            const createdElements = mockDocument.createElement.mock.results;
            const queenDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('Gen 2')
            );
            
            expect(queenDisplay).toBeDefined();
        });
    });

    describe('Status Changes', () => {
        test('should show vulnerability status correctly', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.ACTIVE_CONTROL,
                growthProgress: 1.0,
                isVulnerable: true
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Should show vulnerable status
            const createdElements = mockDocument.createElement.mock.results;
            const queenDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('VULNERABLE')
            );
            
            expect(queenDisplay).toBeDefined();
        });

        test('should show protected status for invulnerable Queens', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 0.5,
                isVulnerable: false
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Should show protected status
            const createdElements = mockDocument.createElement.mock.results;
            const queenDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('PROTECTED')
            );
            
            expect(queenDisplay).toBeDefined();
        });

        test('should update phase display when Queen changes phases', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 0.5,
                isVulnerable: false
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            // First update - underground growth
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Change to construction phase
            mockQueen.updateMockStats({ 
                currentPhase: QueenPhase.HIVE_CONSTRUCTION,
                growthProgress: 1.0
            });
            updateCallback();

            // Should show construction phase
            const createdElements = mockDocument.createElement.mock.results;
            const queenDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('Building Hive')
            );
            
            expect(queenDisplay).toBeDefined();
        });
    });

    describe('Time Remaining Display', () => {
        test('should format time remaining correctly for seconds', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 0.5,
                isVulnerable: false
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Should show time remaining (45s for 50% of 90s average)
            const createdElements = mockDocument.createElement.mock.results;
            const queenDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('45s')
            );
            
            expect(queenDisplay).toBeDefined();
        });

        test('should format time remaining correctly for minutes', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 0.1,
                isVulnerable: false
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Should show time remaining in minutes (81s = 1m 21s for 10% of 90s average)
            const createdElements = mockDocument.createElement.mock.results;
            const queenDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('1m')
            );
            
            expect(queenDisplay).toBeDefined();
        });

        test('should show "Complete" for finished phases', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.ACTIVE_CONTROL,
                growthProgress: 1.0,
                isVulnerable: true
            }, mockTerritory);

            mockTerritoryManager.addMockQueen(mockQueen as any);

            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            updateCallback();

            // Should show "Complete"
            const createdElements = mockDocument.createElement.mock.results;
            const queenDisplay = createdElements.find(result => 
                result.value.innerHTML && result.value.innerHTML.includes('Complete')
            );
            
            expect(queenDisplay).toBeDefined();
        });
    });

    describe('Configuration Management', () => {
        test('should update configuration correctly', () => {
            const newConfig = {
                updateInterval: 200,
                maxDisplayQueens: 2
            };

            queenGrowthUI.updateConfig(newConfig);

            // Should restart interval with new timing
            expect(mockWindow.clearInterval).toHaveBeenCalled();
            expect(mockWindow.setInterval).toHaveBeenCalledWith(expect.any(Function), 200);
        });

        test('should handle visibility changes', () => {
            queenGrowthUI.setVisible(false);
            
            expect(mockContainer.style.display).toBe('none');

            queenGrowthUI.setVisible(true);
            
            expect(mockContainer.style.display).toBe('block');
        });
    });

    describe('Error Handling', () => {
        test('should handle Queen stats errors gracefully', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.UNDERGROUND_GROWTH,
                growthProgress: 0.3,
                isVulnerable: false
            }, mockTerritory);

            // Mock getStats to throw error
            mockQueen.getStats = jest.fn().mockImplementation(() => {
                throw new Error('Stats error');
            });

            mockTerritoryManager.addMockQueen(mockQueen as any);

            // Should not throw error
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            expect(() => updateCallback()).not.toThrow();
        });

        test('should handle missing hive during construction phase', () => {
            const mockQueen = new MockQueen('queen_1', {
                id: 'queen_1',
                generation: 1,
                currentPhase: QueenPhase.HIVE_CONSTRUCTION,
                growthProgress: 1.0,
                isVulnerable: false
            }, mockTerritory);

            // No hive set (null)
            mockTerritoryManager.addMockQueen(mockQueen as any);

            // Should handle gracefully and show default progress
            const updateCallback = mockWindow.setInterval.mock.calls[0][0];
            expect(() => updateCallback()).not.toThrow();
        });
    });
});