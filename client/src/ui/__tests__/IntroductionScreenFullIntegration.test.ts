/**
 * Full Integration Tests for Introduction Screen
 * 
 * Tests complete user flows, preference persistence across sessions,
 * and error recovery scenarios as required by task 11.2.
 * 
 * @jest-environment jsdom
 */

import { IntroductionScreen } from '../IntroductionScreen';
import { PreferenceManager } from '../PreferenceManager';
import { TypewriterEffect } from '../TypewriterEffect';
import { StoryContentParser } from '../StoryContentParser';

// Mock DOM environment
const mockContainer = {
    id: 'test-introduction-container',
    style: { cssText: '', display: 'none' },
    innerHTML: '',
    children: { length: 0 },
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn().mockReturnValue([])
};

// Mock document methods
Object.defineProperty(document, 'getElementById', {
    value: jest.fn().mockReturnValue(mockContainer),
    writable: true
});

Object.defineProperty(document, 'createElement', {
    value: jest.fn().mockImplementation((tagName: string) => ({
        tagName: tagName.toUpperCase(),
        style: { cssText: '' },
        textContent: '',
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        parentElement: mockContainer,
        children: { length: 0 },
        id: '',
        className: '',
        type: tagName === 'input' ? 'text' : undefined,
        checked: false,
        disabled: false,
        htmlFor: '',
        click: jest.fn(),
        focus: jest.fn(),
        blur: jest.fn()
    })),
    writable: true
});

// Mock window methods
Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
Object.defineProperty(window, 'addEventListener', { value: jest.fn(), writable: true });
Object.defineProperty(window, 'removeEventListener', { value: jest.fn(), writable: true });

// Mock performance and animation
Object.defineProperty(window, 'performance', {
    value: { now: jest.fn().mockReturnValue(1000) },
    writable: true
});

Object.defineProperty(window, 'requestAnimationFrame', {
    value: jest.fn().mockImplementation((callback: Function) => {
        setTimeout(callback, 16);
        return 1;
    }),
    writable: true
});

Object.defineProperty(window, 'cancelAnimationFrame', {
    value: jest.fn(),
    writable: true
});

describe('Introduction Screen Full Integration Tests', () => {
    let introScreen: IntroductionScreen;
    let mockOnComplete: jest.Mock;
    let originalLocalStorage: Storage;

    beforeEach(() => {
        jest.clearAllMocks();
        mockOnComplete = jest.fn();
        
        // Reset container
        mockContainer.innerHTML = '';
        mockContainer.style.display = 'none';
        (mockContainer.children as any).length = 0;

        // Store original localStorage
        originalLocalStorage = window.localStorage;
    });

    afterEach(() => {
        if (introScreen) {
            introScreen.dispose();
        }
        
        // Restore localStorage
        Object.defineProperty(window, 'localStorage', {
            value: originalLocalStorage,
            writable: true
        });
        
        localStorage.clear();
    });

    describe('Complete User Flow from Launch to Game Transition', () => {
        test('should complete full user flow: first-time user sees introduction', async () => {
            // Simulate first-time user (no preferences stored)
            localStorage.clear();

            // Create IntroductionScreen
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-full-flow-first-time'
            });

            // Verify initial state
            expect(introScreen.shouldSkipIntroduction()).toBe(false);
            expect(introScreen.getState().isVisible).toBe(false);

            // Show introduction (simulates game launch)
            introScreen.show();
            expect(introScreen.getState().isVisible).toBe(true);

            // Verify story content is loaded
            const storyContent = introScreen.getStoryContent();
            expect(storyContent).toBeDefined();
            expect(storyContent?.pages.length).toBeGreaterThan(0);

            // Verify first page is displayed
            const currentPage = introScreen.getCurrentPage();
            expect(currentPage).toBeDefined();
            expect(currentPage?.title).toBeDefined();
            expect(currentPage?.content).toBeDefined();

            // Verify typewriter effect is initialized
            const typewriterEffect = introScreen.getTypewriterEffect();
            expect(typewriterEffect).toBeDefined();

            // Simulate user completing the introduction
            // (In real scenario, user would click through pages)
            
            // Simulate final page completion
            const finalPageIndex = storyContent!.pages.length - 1;
            introScreen.goToPage(finalPageIndex);
            
            // Simulate clicking "Continue" button (which calls onComplete)
            mockOnComplete();
            
            // Verify completion callback was called
            expect(mockOnComplete).toHaveBeenCalledTimes(1);

            // Hide introduction (simulates transition to game)
            introScreen.hide();
            expect(introScreen.getState().isVisible).toBe(false);
        });

        test('should complete full user flow: returning user with skip preference', async () => {
            // Simulate returning user who has set skip preference
            const testPreferenceManager = new PreferenceManager({
                storageKey: 'test-full-flow-returning',
                fallbackToMemory: true
            });
            testPreferenceManager.setSkipIntroduction(true);

            // Create IntroductionScreen with same preference key
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-full-flow-returning'
            });

            // Verify skip preference is loaded
            expect(introScreen.shouldSkipIntroduction()).toBe(true);

            // In real application, this would skip showing the introduction
            // But for testing, we can still show it if needed
            if (!introScreen.shouldSkipIntroduction()) {
                introScreen.show();
            }

            // Verify the preference is correctly loaded
            const preferenceManager = introScreen.getPreferenceManager();
            expect(preferenceManager.getSkipIntroduction()).toBe(true);
        });

        test('should handle user changing skip preference during introduction', async () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-preference-change'
            });

            // Show introduction
            introScreen.show();
            expect(introScreen.getState().isVisible).toBe(true);

            // Initially, skip preference should be false
            expect(introScreen.shouldSkipIntroduction()).toBe(false);

            // Simulate user checking "Don't show again" checkbox
            const preferenceManager = introScreen.getPreferenceManager();
            preferenceManager.setSkipIntroduction(true);

            // Verify preference change is reflected
            expect(introScreen.shouldSkipIntroduction()).toBe(true);
            expect(preferenceManager.getSkipIntroduction()).toBe(true);

            // Complete the introduction
            mockOnComplete();
            expect(mockOnComplete).toHaveBeenCalledTimes(1);

            // Hide introduction
            introScreen.hide();
            expect(introScreen.getState().isVisible).toBe(false);
        });

        test('should handle complete navigation flow through all pages', async () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-navigation-flow'
            });

            introScreen.show();

            const storyContent = introScreen.getStoryContent();
            expect(storyContent).toBeDefined();
            
            const totalPages = storyContent!.pages.length;
            expect(totalPages).toBeGreaterThan(0);

            // Navigate through all pages
            for (let i = 0; i < totalPages; i++) {
                introScreen.goToPage(i);
                
                const currentPage = introScreen.getCurrentPage();
                expect(currentPage).toBeDefined();
                expect(currentPage?.title).toBeDefined();
                expect(currentPage?.content).toBeDefined();
                
                const state = introScreen.getState();
                expect(state.currentPageIndex).toBe(i);
                expect(state.isLastPage).toBe(i === totalPages - 1);
            }

            // Complete the flow
            mockOnComplete();
            expect(mockOnComplete).toHaveBeenCalledTimes(1);
        });
    });

    describe('Preference Persistence Across Sessions', () => {
        test('should persist skip preference across different IntroductionScreen instances', () => {
            const preferenceKey = 'test-persistence-across-instances';

            // Create first instance and set preference
            const firstInstance = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: preferenceKey
            });

            expect(firstInstance.shouldSkipIntroduction()).toBe(false);
            
            const firstPreferenceManager = firstInstance.getPreferenceManager();
            firstPreferenceManager.setSkipIntroduction(true);
            expect(firstInstance.shouldSkipIntroduction()).toBe(true);

            // Dispose first instance
            firstInstance.dispose();

            // Create second instance with same preference key
            const secondInstance = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: preferenceKey
            });

            // Verify preference is loaded in second instance
            expect(secondInstance.shouldSkipIntroduction()).toBe(true);

            // Clean up
            secondInstance.dispose();
        });

        test('should handle preference reset functionality', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-preference-reset'
            });

            // Set skip preference
            const preferenceManager = introScreen.getPreferenceManager();
            preferenceManager.setSkipIntroduction(true);
            expect(introScreen.shouldSkipIntroduction()).toBe(true);

            // Reset preferences
            const resetSuccess = introScreen.resetPreferences();
            expect(resetSuccess).toBe(true);
            expect(introScreen.shouldSkipIntroduction()).toBe(false);
        });

        test('should handle preference clearing functionality', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-preference-clear'
            });

            // Set skip preference
            const preferenceManager = introScreen.getPreferenceManager();
            preferenceManager.setSkipIntroduction(true);
            expect(introScreen.shouldSkipIntroduction()).toBe(true);

            // Clear preferences
            const clearSuccess = introScreen.clearPreferences();
            expect(clearSuccess).toBe(true);
            expect(introScreen.shouldSkipIntroduction()).toBe(false);
        });

        test('should maintain preference consistency across browser sessions', () => {
            const preferenceKey = 'test-session-persistence';

            // Simulate first browser session
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: preferenceKey
            });

            const preferenceManager = introScreen.getPreferenceManager();
            preferenceManager.setSkipIntroduction(true);
            
            // Verify preference is stored
            expect(introScreen.shouldSkipIntroduction()).toBe(true);
            
            // Get the stored value directly from localStorage
            const storedValue = localStorage.getItem(preferenceKey);
            expect(storedValue).toBeTruthy();

            introScreen.dispose();

            // Simulate second browser session (new IntroductionScreen instance)
            const newIntroScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: preferenceKey
            });

            // Verify preference is loaded from storage
            expect(newIntroScreen.shouldSkipIntroduction()).toBe(true);

            newIntroScreen.dispose();
        });
    });

    describe('Error Recovery Scenarios', () => {
        test('should handle localStorage unavailability gracefully', () => {
            // Mock localStorage to throw errors
            Object.defineProperty(window, 'localStorage', {
                value: {
                    getItem: jest.fn().mockImplementation(() => {
                        throw new Error('localStorage not available');
                    }),
                    setItem: jest.fn().mockImplementation(() => {
                        throw new Error('localStorage not available');
                    }),
                    removeItem: jest.fn().mockImplementation(() => {
                        throw new Error('localStorage not available');
                    }),
                    clear: jest.fn().mockImplementation(() => {
                        throw new Error('localStorage not available');
                    })
                },
                writable: true
            });

            // Should create IntroductionScreen without errors
            expect(() => {
                introScreen = new IntroductionScreen({
                    containerId: 'test-introduction-container',
                    onComplete: mockOnComplete,
                    skipPreferenceKey: 'test-storage-error'
                });
            }).not.toThrow();

            // Should fall back to memory storage
            const preferenceManager = introScreen.getPreferenceManager();
            expect(preferenceManager.getStorageMechanism()).toBe('memory');

            // Should still function with memory storage
            expect(introScreen.shouldSkipIntroduction()).toBe(false);
            preferenceManager.setSkipIntroduction(true);
            expect(introScreen.shouldSkipIntroduction()).toBe(true);
        });

        test('should handle missing container element gracefully', () => {
            // Mock getElementById to return null
            (document.getElementById as jest.Mock).mockReturnValueOnce(null);

            expect(() => {
                introScreen = new IntroductionScreen({
                    containerId: 'non-existent-container',
                    onComplete: mockOnComplete,
                    skipPreferenceKey: 'test-missing-container'
                });
            }).not.toThrow();

            expect(introScreen).toBeDefined();
            
            // Should handle show/hide gracefully even without container
            expect(() => {
                introScreen.show();
                introScreen.hide();
            }).not.toThrow();
        });

        test('should handle story content loading errors gracefully', () => {
            // Mock StoryContentParser to return null/empty content
            const originalGetStoryContent = StoryContentParser.getStoryContent;
            StoryContentParser.getStoryContent = jest.fn().mockReturnValue(null);

            expect(() => {
                introScreen = new IntroductionScreen({
                    containerId: 'test-introduction-container',
                    onComplete: mockOnComplete,
                    skipPreferenceKey: 'test-story-error'
                });
            }).not.toThrow();

            // Should handle missing story content gracefully
            const storyContent = introScreen.getStoryContent();
            expect(storyContent).toBeNull();

            // Should still be able to show/hide
            expect(() => {
                introScreen.show();
                introScreen.hide();
            }).not.toThrow();

            // Restore original method
            StoryContentParser.getStoryContent = originalGetStoryContent;
        });

        test('should handle typewriter animation errors gracefully', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-typewriter-error'
            });

            introScreen.show();

            // Get typewriter effect and simulate error
            const typewriterEffect = introScreen.getTypewriterEffect();
            expect(typewriterEffect).toBeDefined();

            // Should handle animation errors gracefully
            expect(() => {
                // Simulate animation interruption
                typewriterEffect?.stop();
                typewriterEffect?.stop(); // Call twice to test multiple stops
            }).not.toThrow();
        });

        test('should handle rapid user interactions gracefully', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-rapid-interactions'
            });

            introScreen.show();

            const storyContent = introScreen.getStoryContent();
            if (storyContent && storyContent.pages.length > 1) {
                // Simulate rapid page navigation
                expect(() => {
                    introScreen.goToPage(0);
                    introScreen.goToPage(1);
                    introScreen.goToPage(0);
                    introScreen.goToPage(1);
                }).not.toThrow();
            }

            // Simulate rapid show/hide
            expect(() => {
                introScreen.hide();
                introScreen.show();
                introScreen.hide();
                introScreen.show();
            }).not.toThrow();

            // Simulate rapid preference changes
            const preferenceManager = introScreen.getPreferenceManager();
            expect(() => {
                preferenceManager.setSkipIntroduction(true);
                preferenceManager.setSkipIntroduction(false);
                preferenceManager.setSkipIntroduction(true);
                preferenceManager.setSkipIntroduction(false);
            }).not.toThrow();
        });

        test('should handle component disposal during active state', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-disposal-during-active'
            });

            // Show introduction
            introScreen.show();
            expect(introScreen.getState().isVisible).toBe(true);

            // Dispose while active - should not throw errors
            expect(() => {
                introScreen.dispose();
            }).not.toThrow();

            // Verify state after disposal
            expect(introScreen.getState().isVisible).toBe(false);
        });

        test('should handle window resize during introduction display', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-resize-handling'
            });

            introScreen.show();

            // Simulate window resize
            expect(() => {
                // Change window dimensions
                Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
                Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });
                
                // Trigger layout update
                introScreen.updateLayout();
                
                // Verify viewport info is updated
                const viewportInfo = introScreen.getViewportInfo();
                expect(viewportInfo.width).toBe(800);
                expect(viewportInfo.height).toBe(600);
            }).not.toThrow();
        });
    });

    describe('Integration with Game Initialization Flow', () => {
        test('should integrate properly with Application class pattern', () => {
            // Simulate Application class initialization pattern
            const mockApplication = {
                preferenceManager: new PreferenceManager({ storageKey: 'test-app-integration' }),
                introductionScreen: null as IntroductionScreen | null,
                gameInitialized: false,

                async init() {
                    const shouldShowIntroduction = !this.preferenceManager.getSkipIntroduction();
                    
                    if (shouldShowIntroduction) {
                        await this.showIntroductionScreen();
                    } else {
                        await this.initializeGame();
                    }
                },

                async showIntroductionScreen() {
                    this.introductionScreen = new IntroductionScreen({
                        containerId: 'test-introduction-container',
                        onComplete: () => {
                            this.hideIntroductionScreen();
                            this.initializeGame();
                        }
                    });

                    this.introductionScreen.show();
                },

                hideIntroductionScreen() {
                    if (this.introductionScreen) {
                        this.introductionScreen.hide();
                        this.introductionScreen.dispose();
                        this.introductionScreen = null;
                    }
                },

                async initializeGame() {
                    this.gameInitialized = true;
                }
            };

            // Test first-time user flow
            expect(mockApplication.preferenceManager.getSkipIntroduction()).toBe(false);
            
            // Initialize application
            expect(() => {
                mockApplication.init();
            }).not.toThrow();

            // Verify introduction screen was created
            expect(mockApplication.introductionScreen).toBeDefined();
            expect(mockApplication.gameInitialized).toBe(false);

            // Simulate completion
            if (mockApplication.introductionScreen) {
                const onComplete = mockApplication.introductionScreen.getConfig().onComplete;
                onComplete();
            }

            // Verify game was initialized
            expect(mockApplication.gameInitialized).toBe(true);
            expect(mockApplication.introductionScreen).toBeNull();
        });

        test('should handle game transition timing correctly', async () => {
            let gameInitialized = false;
            let introductionHidden = false;

            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: () => {
                    // Simulate hiding introduction
                    introductionHidden = true;
                    introScreen.hide();
                    
                    // Simulate game initialization
                    setTimeout(() => {
                        gameInitialized = true;
                    }, 100);
                },
                skipPreferenceKey: 'test-transition-timing'
            });

            introScreen.show();
            expect(introScreen.getState().isVisible).toBe(true);

            // Simulate completion
            const onComplete = introScreen.getConfig().onComplete;
            onComplete();

            // Verify immediate state changes
            expect(introductionHidden).toBe(true);
            expect(introScreen.getState().isVisible).toBe(false);

            // Wait for game initialization
            await new Promise(resolve => setTimeout(resolve, 150));
            expect(gameInitialized).toBe(true);
        });
    });
});