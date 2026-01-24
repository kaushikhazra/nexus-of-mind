/**
 * Integration test for IntroductionScreen component wiring
 * Tests that all components work together properly
 */

import { IntroductionScreen } from '../IntroductionScreen';
import { TypewriterEffect } from '../TypewriterEffect';
import { PreferenceManager } from '../PreferenceManager';
import { StoryContentParser } from '../StoryContentParser';

// Mock DOM environment
const mockContainer = {
    id: 'test-introduction-container',
    style: { cssText: '', display: 'none' },
    innerHTML: '',
    children: { length: 0 },
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
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
        htmlFor: ''
    })),
    writable: true
});

Object.defineProperty(document.body, 'appendChild', {
    value: jest.fn(),
    writable: true
});

// Mock window methods
Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
Object.defineProperty(window, 'addEventListener', { value: jest.fn(), writable: true });
Object.defineProperty(window, 'removeEventListener', { value: jest.fn(), writable: true });
Object.defineProperty(window, 'ResizeObserver', { 
    value: jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        disconnect: jest.fn()
    })),
    writable: true 
});

// Mock performance
Object.defineProperty(window, 'performance', {
    value: { now: jest.fn().mockReturnValue(1000) },
    writable: true
});

// Mock requestAnimationFrame
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

describe('IntroductionScreen Integration', () => {
    let introScreen: IntroductionScreen;
    let mockOnComplete: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockOnComplete = jest.fn();
        
        // Reset container
        mockContainer.innerHTML = '';
        mockContainer.style.display = 'none';
        (mockContainer.children as any).length = 0;
    });

    afterEach(() => {
        if (introScreen) {
            introScreen.dispose();
        }
    });

    describe('Component Wiring', () => {
        test('should successfully wire all components together', () => {
            expect(() => {
                introScreen = new IntroductionScreen({
                    containerId: 'test-introduction-container',
                    onComplete: mockOnComplete,
                    skipPreferenceKey: 'test-integration'
                });
            }).not.toThrow();

            // Verify IntroductionScreen was created
            expect(introScreen).toBeDefined();
            expect(introScreen.getState()).toBeDefined();
            expect(introScreen.getStoryContent()).toBeDefined();
            expect(introScreen.getPreferenceManager()).toBeDefined();
        });

        test('should integrate TypewriterEffect properly', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-typewriter-integration'
            });

            // Show the screen to initialize typewriter
            introScreen.show();

            // Verify typewriter effect is created and accessible
            const typewriterEffect = introScreen.getTypewriterEffect();
            expect(typewriterEffect).toBeDefined();
            expect(typewriterEffect).toBeInstanceOf(TypewriterEffect);
        });

        test('should integrate PreferenceManager properly', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-preference-integration'
            });

            const preferenceManager = introScreen.getPreferenceManager();
            expect(preferenceManager).toBeDefined();
            expect(preferenceManager).toBeInstanceOf(PreferenceManager);

            // Test preference functionality
            expect(typeof preferenceManager.getSkipIntroduction()).toBe('boolean');
            expect(typeof preferenceManager.setSkipIntroduction).toBe('function');
        });

        test('should integrate StoryContentParser properly', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-story-integration'
            });

            const storyContent = introScreen.getStoryContent();
            expect(storyContent).toBeDefined();
            expect(storyContent?.pages).toBeDefined();
            expect(storyContent?.metadata).toBeDefined();

            // Verify story content is valid
            expect(StoryContentParser.validateStoryContent(storyContent!)).toBe(true);
        });

        test('should handle component lifecycle properly', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-lifecycle-integration'
            });

            // Test show/hide lifecycle
            expect(() => {
                introScreen.show();
                expect(introScreen.getState().isVisible).toBe(true);
                
                introScreen.hide();
                expect(introScreen.getState().isVisible).toBe(false);
            }).not.toThrow();

            // Test disposal
            expect(() => {
                introScreen.dispose();
            }).not.toThrow();
        });

        test('should handle responsive design integration', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-responsive-integration'
            });

            // Test viewport detection
            const viewportInfo = introScreen.getViewportInfo();
            expect(viewportInfo).toBeDefined();
            expect(typeof viewportInfo.width).toBe('number');
            expect(typeof viewportInfo.height).toBe('number');
            expect(typeof viewportInfo.isMobile).toBe('boolean');
            expect(typeof viewportInfo.isTablet).toBe('boolean');
            expect(typeof viewportInfo.isDesktop).toBe('boolean');

            // Test layout update
            expect(() => {
                introScreen.updateLayout();
            }).not.toThrow();
        });

        test('should handle preference state integration', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-preference-state-integration'
            });

            // Test preference checking
            const shouldSkip = introScreen.shouldSkipIntroduction();
            expect(typeof shouldSkip).toBe('boolean');

            // Test preference reset
            expect(() => {
                introScreen.resetPreferences();
            }).not.toThrow();

            // Test preference clearing
            expect(() => {
                introScreen.clearPreferences();
            }).not.toThrow();
        });
    });

    describe('Error Handling Integration', () => {
        test('should handle missing container gracefully', () => {
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
        });

        test('should handle localStorage unavailability gracefully', () => {
            // Mock localStorage to throw error
            const originalLocalStorage = window.localStorage;
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
                    })
                },
                writable: true
            });

            expect(() => {
                introScreen = new IntroductionScreen({
                    containerId: 'test-introduction-container',
                    onComplete: mockOnComplete,
                    skipPreferenceKey: 'test-storage-error'
                });
            }).not.toThrow();

            // Restore localStorage
            Object.defineProperty(window, 'localStorage', {
                value: originalLocalStorage,
                writable: true
            });
        });
    });

    describe('Integration Flow', () => {
        test('should complete full integration flow', async () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-full-flow'
            });

            // Show introduction
            introScreen.show();
            expect(introScreen.getState().isVisible).toBe(true);

            // Verify story content is loaded
            const storyContent = introScreen.getStoryContent();
            expect(storyContent?.pages.length).toBeGreaterThan(0);

            // Verify current page is displayed
            const currentPage = introScreen.getCurrentPage();
            expect(currentPage).toBeDefined();
            expect(currentPage?.title).toBeDefined();
            expect(currentPage?.content).toBeDefined();

            // Verify typewriter effect is ready
            const typewriterEffect = introScreen.getTypewriterEffect();
            expect(typewriterEffect).toBeDefined();

            // Verify preference manager is working
            const preferenceManager = introScreen.getPreferenceManager();
            expect(preferenceManager.getSkipIntroduction()).toBe(false);

            // Test preference change
            preferenceManager.setSkipIntroduction(true);
            expect(preferenceManager.getSkipIntroduction()).toBe(true);

            // Hide and dispose
            introScreen.hide();
            expect(introScreen.getState().isVisible).toBe(false);

            introScreen.dispose();
        });
    });
});