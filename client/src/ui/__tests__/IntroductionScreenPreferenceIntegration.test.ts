/**
 * IntroductionScreen and PreferenceManager Integration Tests
 * 
 * Tests the integration between IntroductionScreen and PreferenceManager
 * to ensure preference persistence works correctly.
 * 
 * @jest-environment jsdom
 */

import { IntroductionScreen } from '../IntroductionScreen';
import { PreferenceManager } from '../PreferenceManager';

describe('IntroductionScreen and PreferenceManager Integration', () => {
    let container: HTMLElement;
    let introScreen: IntroductionScreen;
    let mockOnComplete: jest.Mock;

    beforeEach(() => {
        // Clear localStorage
        localStorage.clear();
        
        // Create container
        container = document.createElement('div');
        container.id = 'test-introduction-container';
        document.body.appendChild(container);
        
        // Mock completion callback
        mockOnComplete = jest.fn();
    });

    afterEach(() => {
        if (introScreen) {
            introScreen.dispose();
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        localStorage.clear();
    });

    describe('Preference Integration', () => {
        test('should initialize with default preference state', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro'
            });

            // Should start with skip introduction as false
            expect(introScreen.shouldSkipIntroduction()).toBe(false);
            
            // Should have access to preference manager
            const preferenceManager = introScreen.getPreferenceManager();
            expect(preferenceManager).toBeDefined();
            expect(preferenceManager.getSkipIntroduction()).toBe(false);
        });

        test('should load existing preferences on initialization', () => {
            // Set preference directly in localStorage
            const testPreferenceManager = new PreferenceManager({
                storageKey: 'test-skip-intro-existing',
                fallbackToMemory: true
            });
            testPreferenceManager.setSkipIntroduction(true);

            // Create IntroductionScreen with same preference key
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro-existing'
            });

            // Should load the existing preference
            expect(introScreen.shouldSkipIntroduction()).toBe(true);
        });

        test('should provide preference management methods', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro-methods'
            });

            // Test reset preferences
            const preferenceManager = introScreen.getPreferenceManager();
            preferenceManager.setSkipIntroduction(true);
            expect(introScreen.shouldSkipIntroduction()).toBe(true);

            const resetSuccess = introScreen.resetPreferences();
            expect(resetSuccess).toBe(true);
            expect(introScreen.shouldSkipIntroduction()).toBe(false);

            // Test clear preferences
            preferenceManager.setSkipIntroduction(true);
            const clearSuccess = introScreen.clearPreferences();
            expect(clearSuccess).toBe(true);
            expect(introScreen.shouldSkipIntroduction()).toBe(false);
        });

        test('should handle preference storage errors gracefully', () => {
            // Mock localStorage to throw errors
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = jest.fn(() => {
                throw new Error('Storage error');
            });

            // Should still create IntroductionScreen without errors
            expect(() => {
                introScreen = new IntroductionScreen({
                    containerId: 'test-introduction-container',
                    onComplete: mockOnComplete,
                    skipPreferenceKey: 'test-skip-intro-error'
                });
            }).not.toThrow();

            // Should fall back to memory storage
            const preferenceManager = introScreen.getPreferenceManager();
            expect(preferenceManager.getStorageMechanism()).toBe('memory');

            // Restore localStorage
            localStorage.setItem = originalSetItem;
        });
    });

    describe('UI Integration', () => {
        test('should create UI elements without errors', () => {
            expect(() => {
                introScreen = new IntroductionScreen({
                    containerId: 'test-introduction-container',
                    onComplete: mockOnComplete,
                    skipPreferenceKey: 'test-skip-intro-ui'
                });
            }).not.toThrow();

            // Should have created the container
            expect(container.children.length).toBeGreaterThan(0);
        });

        test('should have required methods for functionality', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro-methods'
            });

            // Should have all required methods
            expect(typeof introScreen.show).toBe('function');
            expect(typeof introScreen.hide).toBe('function');
            expect(typeof introScreen.dispose).toBe('function');
            expect(typeof introScreen.shouldSkipIntroduction).toBe('function');
            expect(typeof introScreen.resetPreferences).toBe('function');
            expect(typeof introScreen.clearPreferences).toBe('function');
            expect(typeof introScreen.getPreferenceManager).toBe('function');
            expect(typeof introScreen.getState).toBe('function');
            expect(typeof introScreen.getStoryContent).toBe('function');
        });

        test('should manage visibility state correctly', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro-visibility'
            });

            // Initially not visible
            expect(introScreen.getState().isVisible).toBe(false);

            // Show should make it visible
            introScreen.show();
            expect(introScreen.getState().isVisible).toBe(true);

            // Hide should make it not visible
            introScreen.hide();
            expect(introScreen.getState().isVisible).toBe(false);
        });
    });

    describe('Story Content Integration', () => {
        test('should load story content successfully', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro-story'
            });

            const storyContent = introScreen.getStoryContent();
            expect(storyContent).toBeDefined();
            expect(storyContent?.pages).toBeDefined();
            expect(storyContent?.pages.length).toBeGreaterThan(0);
            expect(storyContent?.metadata).toBeDefined();
        });

        test('should handle story content gracefully', () => {
            introScreen = new IntroductionScreen({
                containerId: 'test-introduction-container',
                onComplete: mockOnComplete,
                skipPreferenceKey: 'test-skip-intro-story-graceful'
            });

            const currentPage = introScreen.getCurrentPage();
            // Should either have a page or null (depending on initialization state)
            expect(currentPage === null || typeof currentPage === 'object').toBe(true);
        });
    });
});