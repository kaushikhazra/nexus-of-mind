/**
 * LearningProgressUI Tests
 * 
 * Tests for the Learning Progress UI system functionality
 */

import { LearningProgressUI } from '../LearningProgressUI';
import { LearningProgress } from '../../game/entities/AdaptiveQueen';
import { AdvancedDynamicTexture } from '@babylonjs/gui';

// Mock Babylon.js GUI components
jest.mock('@babylonjs/gui', () => ({
    AdvancedDynamicTexture: {
        CreateFullscreenUI: jest.fn(() => ({
            addControl: jest.fn(),
            removeControl: jest.fn()
        }))
    },
    Rectangle: jest.fn().mockImplementation(() => ({
        widthInPixels: 320,
        heightInPixels: 200,
        cornerRadius: 10,
        color: '#00ff88',
        thickness: 2,
        background: 'rgba(0, 20, 40, 0.9)',
        horizontalAlignment: 0,
        verticalAlignment: 0,
        topInPixels: 120,
        rightInPixels: 20,
        isVisible: true,
        addControl: jest.fn(),
        onPointerEnterObservable: { add: jest.fn() },
        onPointerOutObservable: { add: jest.fn() }
    })),
    TextBlock: jest.fn().mockImplementation((name, text) => ({
        text: text || '',
        color: '#ffffff',
        fontSize: 12,
        heightInPixels: 20,
        textHorizontalAlignment: 0,
        alpha: 1.0
    })),
    StackPanel: jest.fn().mockImplementation(() => ({
        isVertical: true,
        paddingTopInPixels: 10,
        paddingBottomInPixels: 10,
        paddingLeftInPixels: 15,
        paddingRightInPixels: 15,
        addControl: jest.fn(),
        clearControls: jest.fn(),
        isVisible: true,
        topInPixels: 5
    })),
    Button: {
        CreateSimpleButton: jest.fn().mockImplementation((name, text) => ({
            text: text,
            color: '#00ff88',
            background: 'rgba(0, 255, 136, 0.1)',
            heightInPixels: 25,
            fontSize: 10,
            topInPixels: 5,
            onPointerClickObservable: { add: jest.fn() },
            textBlock: { text: text }
        }))
    },
    Control: {
        HORIZONTAL_ALIGNMENT_CENTER: 0,
        HORIZONTAL_ALIGNMENT_LEFT: 1,
        HORIZONTAL_ALIGNMENT_RIGHT: 2,
        VERTICAL_ALIGNMENT_TOP: 0,
        VERTICAL_ALIGNMENT_CENTER: 1,
        VERTICAL_ALIGNMENT_BOTTOM: 2
    }
}));

describe('LearningProgressUI', () => {
    let mockTexture: AdvancedDynamicTexture;
    let learningProgressUI: LearningProgressUI;

    beforeEach(() => {
        mockTexture = {
            addControl: jest.fn(),
            removeControl: jest.fn()
        } as any;

        learningProgressUI = new LearningProgressUI({
            parentTexture: mockTexture,
            visible: true
        });
    });

    afterEach(() => {
        learningProgressUI.dispose();
    });

    describe('Initialization', () => {
        test('should create UI with default configuration', () => {
            expect(mockTexture.addControl).toHaveBeenCalled();
            expect(learningProgressUI.isUIVisible()).toBe(true);
        });

        test('should create UI with custom configuration', () => {
            const customUI = new LearningProgressUI({
                parentTexture: mockTexture,
                position: { x: '100px', y: '50px' },
                size: { width: '400px', height: '300px' },
                visible: false
            });

            expect(customUI.isUIVisible()).toBe(false);
            customUI.dispose();
        });
    });

    describe('Learning Progress Updates', () => {
        test('should update progress display correctly', () => {
            const mockProgress: LearningProgress = {
                currentPhase: 'analyzing',
                progress: 0.5,
                estimatedTimeRemaining: 60,
                insights: ['Pattern detected in player mining'],
                improvements: ['Enhanced hive placement strategy']
            };

            learningProgressUI.updateProgress(mockProgress);

            // Verify progress was stored
            expect(learningProgressUI.getLearningStatistics().progress).toBe(0.5);
            expect(learningProgressUI.getLearningStatistics().currentPhase).toBe('analyzing');
        });

        test('should handle phase transitions correctly', () => {
            const phases: Array<LearningProgress['currentPhase']> = ['analyzing', 'processing', 'generating', 'complete'];
            
            phases.forEach((phase, index) => {
                const mockProgress: LearningProgress = {
                    currentPhase: phase,
                    progress: (index + 1) * 0.25,
                    estimatedTimeRemaining: 60 - (index * 15),
                    insights: [`Insight for ${phase}`],
                    improvements: [`Improvement for ${phase}`]
                };

                learningProgressUI.updateProgress(mockProgress);
                expect(learningProgressUI.getLearningStatistics().currentPhase).toBe(phase);
            });
        });

        test('should calculate time remaining correctly', () => {
            const testCases = [
                { timeRemaining: 0, expectedPhase: 'complete' },
                { timeRemaining: 30, expectedPhase: 'urgent' },
                { timeRemaining: 90, expectedPhase: 'normal' }
            ];

            testCases.forEach(testCase => {
                const mockProgress: LearningProgress = {
                    currentPhase: 'processing',
                    progress: 0.5,
                    estimatedTimeRemaining: testCase.timeRemaining,
                    insights: [],
                    improvements: []
                };

                learningProgressUI.updateProgress(mockProgress);
                expect(learningProgressUI.getLearningStatistics().timeRemaining).toBe(testCase.timeRemaining);
            });
        });
    });

    describe('Generation Tracking', () => {
        test('should track generation history', () => {
            const mockQueen = {
                id: 'test-queen',
                getGeneration: () => 1,
                onLearningProgress: jest.fn()
            } as any;

            learningProgressUI.setQueen(mockQueen);

            const mockProgress: LearningProgress = {
                currentPhase: 'complete',
                progress: 1.0,
                estimatedTimeRemaining: 0,
                insights: ['Test insight'],
                improvements: ['Test improvement']
            };

            learningProgressUI.updateProgress(mockProgress);

            const history = learningProgressUI.getGenerationHistory();
            expect(history.size).toBe(1);
            expect(history.get(1)).toEqual(mockProgress);
        });

        test('should calculate generation improvements', () => {
            const mockQueen = {
                id: 'test-queen',
                getGeneration: () => 2,
                onLearningProgress: jest.fn()
            } as any;

            learningProgressUI.setQueen(mockQueen);

            // Add previous generation data
            const previousProgress: LearningProgress = {
                currentPhase: 'complete',
                progress: 1.0,
                estimatedTimeRemaining: 0,
                insights: ['Previous insight'],
                improvements: ['Previous improvement']
            };

            // Manually add to history to simulate previous generation
            learningProgressUI.getGenerationHistory().set(1, previousProgress);

            // Add current generation data
            const currentProgress: LearningProgress = {
                currentPhase: 'complete',
                progress: 1.0,
                estimatedTimeRemaining: 0,
                insights: ['New insight 1', 'New insight 2'],
                improvements: ['New improvement 1', 'New improvement 2']
            };

            learningProgressUI.updateProgress(currentProgress);

            const stats = learningProgressUI.getLearningStatistics();
            expect(stats.totalGenerations).toBe(2);
            expect(stats.totalInsights).toBe(2);
            expect(stats.totalImprovements).toBe(2);
        });
    });

    describe('UI Visibility and Interaction', () => {
        test('should toggle visibility correctly', () => {
            expect(learningProgressUI.isUIVisible()).toBe(true);
            
            learningProgressUI.hide();
            expect(learningProgressUI.isUIVisible()).toBe(false);
            
            learningProgressUI.show();
            expect(learningProgressUI.isUIVisible()).toBe(true);
            
            learningProgressUI.toggleVisibility();
            expect(learningProgressUI.isUIVisible()).toBe(false);
        });

        test('should handle UI updates correctly', () => {
            const deltaTime = 0.016; // 60fps
            
            // Should not throw errors during update
            expect(() => {
                learningProgressUI.update(deltaTime);
            }).not.toThrow();
        });
    });

    describe('Data Export and Statistics', () => {
        test('should export learning data correctly', () => {
            const mockQueen = {
                id: 'test-queen',
                getGeneration: () => 1,
                onLearningProgress: jest.fn()
            } as any;

            learningProgressUI.setQueen(mockQueen);

            const mockProgress: LearningProgress = {
                currentPhase: 'complete',
                progress: 1.0,
                estimatedTimeRemaining: 0,
                insights: ['Test insight'],
                improvements: ['Test improvement']
            };

            learningProgressUI.updateProgress(mockProgress);

            const exportedData = learningProgressUI.exportLearningData();
            
            expect(exportedData.generationHistory).toHaveLength(1);
            expect(exportedData.currentProgress).toEqual(mockProgress);
            expect(exportedData.statistics).toBeDefined();
            expect(exportedData.statistics.currentGeneration).toBe(1);
        });

        test('should calculate learning statistics correctly', () => {
            const mockQueen = {
                id: 'test-queen',
                getGeneration: () => 3,
                onLearningProgress: jest.fn()
            } as any;

            learningProgressUI.setQueen(mockQueen);

            const mockProgress: LearningProgress = {
                currentPhase: 'processing',
                progress: 0.75,
                estimatedTimeRemaining: 30,
                insights: ['Insight 1', 'Insight 2', 'Insight 3'],
                improvements: ['Improvement 1', 'Improvement 2']
            };

            learningProgressUI.updateProgress(mockProgress);

            const stats = learningProgressUI.getLearningStatistics();
            
            expect(stats.currentGeneration).toBe(3);
            expect(stats.currentPhase).toBe('processing');
            expect(stats.progress).toBe(0.75);
            expect(stats.timeRemaining).toBe(30);
            expect(stats.totalInsights).toBe(3);
            expect(stats.totalImprovements).toBe(2);
        });
    });

    describe('Error Handling', () => {
        test('should handle missing queen gracefully', () => {
            const mockProgress: LearningProgress = {
                currentPhase: 'analyzing',
                progress: 0.5,
                estimatedTimeRemaining: 60,
                insights: [],
                improvements: []
            };

            // Should not throw when no queen is set
            expect(() => {
                learningProgressUI.updateProgress(mockProgress);
            }).not.toThrow();
        });

        test('should handle invalid progress data gracefully', () => {
            const invalidProgress = {
                currentPhase: 'unknown_phase',
                progress: -1,
                estimatedTimeRemaining: -10,
                insights: null,
                improvements: undefined
            } as any;

            // Should not throw with invalid data
            expect(() => {
                learningProgressUI.updateProgress(invalidProgress);
            }).not.toThrow();
        });

        test('should cleanup resources on dispose', () => {
            learningProgressUI.dispose();
            
            expect(mockTexture.removeControl).toHaveBeenCalled();
            expect(learningProgressUI.getGenerationHistory().size).toBe(0);
        });
    });
});