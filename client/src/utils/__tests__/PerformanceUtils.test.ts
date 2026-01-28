/**
 * PerformanceUtils Unit Tests
 *
 * Tests for throttle, debounce, frame timer, and system update intervals.
 * Validates: Requirements 6.4 - Performance utility testing
 */

import {
    throttle,
    debounce,
    createFrameTimer,
    SYSTEM_UPDATE_INTERVALS
} from '../PerformanceUtils';

// Mock timers for testing
jest.useFakeTimers();

describe('PerformanceUtils', () => {
    beforeEach(() => {
        jest.clearAllTimers();
    });

    describe('throttle', () => {
        test('should call function immediately on first invocation', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);

            throttled();

            expect(fn).toHaveBeenCalledTimes(1);
        });

        test('should not call function again within interval', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);

            throttled();
            throttled();
            throttled();

            expect(fn).toHaveBeenCalledTimes(1);
        });

        test('should call function again after interval passes', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);

            // First call
            throttled();
            expect(fn).toHaveBeenCalledTimes(1);

            // Advance time past interval
            jest.advanceTimersByTime(101);

            // Second call should work
            throttled();
            expect(fn).toHaveBeenCalledTimes(2);
        });

        test('should pass arguments to throttled function', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);

            throttled('arg1', 'arg2');

            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
        });

        test('should respect interval for multiple calls over time', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);

            // Call every 50ms for 500ms
            for (let i = 0; i < 10; i++) {
                throttled();
                jest.advanceTimersByTime(50);
            }

            // Should be called approximately 5 times (every 100ms)
            expect(fn.mock.calls.length).toBeGreaterThanOrEqual(4);
            expect(fn.mock.calls.length).toBeLessThanOrEqual(6);
        });
    });

    describe('debounce', () => {
        test('should not call function immediately', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced();

            expect(fn).not.toHaveBeenCalled();
        });

        test('should call function after delay', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced();
            jest.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledTimes(1);
        });

        test('should reset timer on subsequent calls', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced();
            jest.advanceTimersByTime(50);
            debounced();
            jest.advanceTimersByTime(50);
            debounced();
            jest.advanceTimersByTime(50);

            expect(fn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(50);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        test('should pass arguments to debounced function', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced('arg1', 'arg2');
            jest.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
        });

        test('should use last arguments when called multiple times', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced('first');
            jest.advanceTimersByTime(50);
            debounced('second');
            jest.advanceTimersByTime(50);
            debounced('third');
            jest.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledWith('third');
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('createFrameTimer', () => {
        // Note: createFrameTimer uses requestAnimationFrame which is not easily testable
        // with fake timers. These tests verify the API structure.

        test('should return timer control object with correct methods', () => {
            const timer = createFrameTimer(() => {});

            expect(timer).toHaveProperty('start');
            expect(timer).toHaveProperty('stop');
            expect(timer).toHaveProperty('isRunning');
            expect(typeof timer.start).toBe('function');
            expect(typeof timer.stop).toBe('function');
            expect(typeof timer.isRunning).toBe('function');
        });

        test('should not be running initially', () => {
            const timer = createFrameTimer(() => {});

            expect(timer.isRunning()).toBe(false);
        });

        test('should accept custom target FPS', () => {
            // Just verify it doesn't throw with custom FPS
            expect(() => createFrameTimer(() => {}, 30)).not.toThrow();
            expect(() => createFrameTimer(() => {}, 60)).not.toThrow();
            expect(() => createFrameTimer(() => {}, 120)).not.toThrow();
        });
    });

    describe('SYSTEM_UPDATE_INTERVALS', () => {
        test('should have all required interval types', () => {
            expect(SYSTEM_UPDATE_INTERVALS).toHaveProperty('CRITICAL');
            expect(SYSTEM_UPDATE_INTERVALS).toHaveProperty('IMPORTANT');
            expect(SYSTEM_UPDATE_INTERVALS).toHaveProperty('NORMAL');
            expect(SYSTEM_UPDATE_INTERVALS).toHaveProperty('BACKGROUND');
            expect(SYSTEM_UPDATE_INTERVALS).toHaveProperty('SLOW');
        });

        test('should have correct frequency values', () => {
            expect(SYSTEM_UPDATE_INTERVALS.CRITICAL).toBe(16);   // ~60 Hz
            expect(SYSTEM_UPDATE_INTERVALS.IMPORTANT).toBe(33);  // ~30 Hz
            expect(SYSTEM_UPDATE_INTERVALS.NORMAL).toBe(100);    // ~10 Hz
            expect(SYSTEM_UPDATE_INTERVALS.BACKGROUND).toBe(200); // ~5 Hz
            expect(SYSTEM_UPDATE_INTERVALS.SLOW).toBe(1000);     // ~1 Hz
        });

        test('should have intervals in ascending order', () => {
            expect(SYSTEM_UPDATE_INTERVALS.CRITICAL).toBeLessThan(SYSTEM_UPDATE_INTERVALS.IMPORTANT);
            expect(SYSTEM_UPDATE_INTERVALS.IMPORTANT).toBeLessThan(SYSTEM_UPDATE_INTERVALS.NORMAL);
            expect(SYSTEM_UPDATE_INTERVALS.NORMAL).toBeLessThan(SYSTEM_UPDATE_INTERVALS.BACKGROUND);
            expect(SYSTEM_UPDATE_INTERVALS.BACKGROUND).toBeLessThan(SYSTEM_UPDATE_INTERVALS.SLOW);
        });

        test('intervals should be positive numbers', () => {
            Object.values(SYSTEM_UPDATE_INTERVALS).forEach(interval => {
                expect(typeof interval).toBe('number');
                expect(interval).toBeGreaterThan(0);
            });
        });
    });
});
