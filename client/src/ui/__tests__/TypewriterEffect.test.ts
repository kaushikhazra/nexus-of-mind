/**
 * TypewriterEffect Unit Tests
 * 
 * Tests the core functionality of the TypewriterEffect component including
 * character-by-character animation, timing consistency, and control methods.
 */

import { TypewriterEffect, TypewriterEffectConfig } from '../TypewriterEffect';

// Mock requestAnimationFrame and cancelAnimationFrame for testing
global.requestAnimationFrame = jest.fn((callback) => {
    return setTimeout(callback, 16); // ~60fps
});

global.cancelAnimationFrame = jest.fn((id) => {
    clearTimeout(id);
});

// Mock performance.now for consistent timing tests
const mockPerformanceNow = jest.fn();
global.performance = { now: mockPerformanceNow } as any;

describe('TypewriterEffect', () => {
    let container: HTMLElement;
    let typewriter: TypewriterEffect;

    beforeEach(() => {
        // Create a test container element
        container = document.createElement('div');
        document.body.appendChild(container);
        
        // Reset performance.now mock
        mockPerformanceNow.mockReturnValue(0);
        
        // Clear any existing timers
        jest.clearAllTimers();
        jest.useFakeTimers();
    });

    afterEach(() => {
        if (typewriter) {
            typewriter.dispose();
        }
        document.body.removeChild(container);
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        test('should create TypewriterEffect with default configuration', () => {
            typewriter = new TypewriterEffect(container);
            
            expect(typewriter).toBeDefined();
            expect(typewriter.getSpeed()).toBe(30); // Default speed
            expect(typewriter.isAnimating()).toBe(false);
            expect(typewriter.isAnimationComplete()).toBe(false);
        });

        test('should create TypewriterEffect with custom configuration', () => {
            const config: TypewriterEffectConfig = {
                speed: 50,
                onComplete: jest.fn()
            };
            
            typewriter = new TypewriterEffect(container, config);
            
            expect(typewriter.getSpeed()).toBe(50);
        });
    });

    describe('Text Animation', () => {
        test('should start animation when typeText is called', () => {
            typewriter = new TypewriterEffect(container, { speed: 60 }); // 60 chars/sec for faster testing
            
            const testText = 'Hello World';
            typewriter.typeText(testText);
            
            expect(typewriter.isAnimating()).toBe(true);
            expect(typewriter.isAnimationComplete()).toBe(false);
            expect(typewriter.getCurrentText()).toBe(testText);
        });

        test('should display characters progressively', (done) => {
            typewriter = new TypewriterEffect(container, { 
                speed: 1000, // Very fast for testing
                onCharacterTyped: (char, index) => {
                    // Check that characters are being added progressively
                    expect(container.textContent).toBe('Test'.substring(0, index + 1));
                    if (index === 3) { // Last character
                        done();
                    }
                }
            });
            
            const testText = 'Test';
            typewriter.typeText(testText);
            
            // Initially empty
            expect(container.textContent).toBe('');
            
            // Advance time significantly to trigger character additions
            mockPerformanceNow.mockReturnValue(100);
            jest.advanceTimersByTime(100);
        });

        test('should call completion callback when animation finishes', (done) => {
            const onComplete = jest.fn(() => {
                expect(typewriter.isAnimationComplete()).toBe(true);
                expect(typewriter.isAnimating()).toBe(false);
                expect(container.textContent).toBe('Done');
                done();
            });
            
            typewriter = new TypewriterEffect(container, { 
                speed: 1000, // Very fast for immediate completion
                onComplete 
            });
            
            typewriter.typeText('Done');
            
            // Advance time significantly to complete animation
            mockPerformanceNow.mockReturnValue(1000);
            jest.advanceTimersByTime(1000);
        });
    });

    describe('Animation Control', () => {
        test('should stop animation when stop() is called', () => {
            typewriter = new TypewriterEffect(container, { speed: 30 });
            
            typewriter.typeText('Test text');
            expect(typewriter.isAnimating()).toBe(true);
            
            typewriter.stop();
            expect(typewriter.isAnimating()).toBe(false);
        });

        test('should complete animation immediately when complete() is called', () => {
            const onComplete = jest.fn();
            typewriter = new TypewriterEffect(container, { 
                speed: 10, // Slow speed
                onComplete 
            });
            
            const testText = 'Complete immediately';
            typewriter.typeText(testText);
            
            typewriter.complete();
            
            expect(container.textContent).toBe(testText);
            expect(typewriter.isAnimationComplete()).toBe(true);
            expect(typewriter.isAnimating()).toBe(false);
            expect(onComplete).toHaveBeenCalled();
        });

        test('should reset properly when reset() is called', () => {
            typewriter = new TypewriterEffect(container, { speed: 30 });
            
            typewriter.typeText('Test');
            typewriter.reset();
            
            expect(container.textContent).toBe('');
            expect(typewriter.getCurrentText()).toBe('');
            expect(typewriter.isAnimating()).toBe(false);
            expect(typewriter.isAnimationComplete()).toBe(false);
        });
    });

    describe('Configuration Updates', () => {
        test('should update speed when setSpeed() is called', () => {
            typewriter = new TypewriterEffect(container, { speed: 30 });
            
            expect(typewriter.getSpeed()).toBe(30);
            
            typewriter.setSpeed(60);
            expect(typewriter.getSpeed()).toBe(60);
        });

        test('should update configuration when updateConfig() is called', () => {
            typewriter = new TypewriterEffect(container, { speed: 30 });
            
            const newCallback = jest.fn();
            typewriter.updateConfig({ 
                speed: 45,
                onComplete: newCallback
            });
            
            expect(typewriter.getSpeed()).toBe(45);
        });
    });

    describe('Progress Tracking', () => {
        test('should track progress correctly', () => {
            typewriter = new TypewriterEffect(container, { speed: 1000 });
            
            const testText = 'Test';
            typewriter.typeText(testText);
            
            expect(typewriter.getProgress()).toBe(0);
            
            // Complete the animation
            typewriter.complete();
            expect(typewriter.getProgress()).toBe(1);
        });

        test('should return correct displayed text', () => {
            typewriter = new TypewriterEffect(container, { speed: 30 });
            
            container.textContent = 'Partial';
            expect(typewriter.getDisplayedText()).toBe('Partial');
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty text', () => {
            const onComplete = jest.fn();
            typewriter = new TypewriterEffect(container, { onComplete });
            
            typewriter.typeText('');
            
            expect(typewriter.getProgress()).toBe(1);
            expect(container.textContent).toBe('');
        });

        test('should handle multiple typeText calls', () => {
            typewriter = new TypewriterEffect(container, { speed: 30 });
            
            typewriter.typeText('First');
            typewriter.typeText('Second');
            
            expect(typewriter.getCurrentText()).toBe('Second');
            expect(typewriter.isAnimating()).toBe(true);
        });

        test('should dispose properly', () => {
            typewriter = new TypewriterEffect(container, { speed: 30 });
            
            typewriter.typeText('Test');
            typewriter.dispose();
            
            expect(typewriter.isAnimating()).toBe(false);
            expect(container.textContent).toBe('');
        });
    });

    describe('Timing Consistency', () => {
        test('should maintain consistent timing regardless of text length', () => {
            const shortText = 'Hi';
            const longText = 'This is a much longer text that should still maintain consistent character timing';
            
            // Test short text
            typewriter = new TypewriterEffect(container, { speed: 60 }); // 60 chars/sec = ~16.67ms per char
            typewriter.typeText(shortText);
            
            // Advance by one character interval
            mockPerformanceNow.mockReturnValue(17);
            jest.advanceTimersByTime(17);
            
            const shortProgress = typewriter.getProgress();
            typewriter.dispose();
            
            // Test long text
            typewriter = new TypewriterEffect(container, { speed: 60 });
            typewriter.typeText(longText);
            
            // Reset time and advance by same interval
            mockPerformanceNow.mockReturnValue(0);
            mockPerformanceNow.mockReturnValue(17);
            jest.advanceTimersByTime(17);
            
            const longProgress = typewriter.getProgress();
            
            // Progress per character should be consistent (accounting for text length differences)
            expect(shortProgress * shortText.length).toBeCloseTo(longProgress * longText.length, 1);
        });
    });
});