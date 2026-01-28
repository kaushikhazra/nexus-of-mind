/**
 * RoundRobinScheduler Unit Tests
 *
 * Tests for round-robin system update scheduling.
 * Validates: Requirements 6.4 - Performance utility testing
 */

import { RoundRobinScheduler, ThrottledSystem } from '../RoundRobinScheduler';

describe('RoundRobinScheduler', () => {
    let scheduler: RoundRobinScheduler;

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('constructor', () => {
        test('should create scheduler with systems', () => {
            const systems: ThrottledSystem[] = [
                { name: 'test', interval: 100, lastUpdate: 0, update: jest.fn() }
            ];

            scheduler = new RoundRobinScheduler({ systems });

            const stats = scheduler.getStats();
            expect(stats.totalSystems).toBe(1);
        });

        test('should default maxSystemsPerFrame to 1', () => {
            const systems: ThrottledSystem[] = [
                { name: 'test1', interval: 100, lastUpdate: 0, update: jest.fn() },
                { name: 'test2', interval: 100, lastUpdate: 0, update: jest.fn() }
            ];

            scheduler = new RoundRobinScheduler({ systems });
            scheduler.update(0.016);

            // Only one system should be checked per frame by default
            const stats = scheduler.getStats();
            expect(stats.currentIndex).toBe(1);
        });

        test('should respect maxSystemsPerFrame config', () => {
            const systems: ThrottledSystem[] = [
                { name: 'test1', interval: 100, lastUpdate: 0, update: jest.fn() },
                { name: 'test2', interval: 100, lastUpdate: 0, update: jest.fn() }
            ];

            scheduler = new RoundRobinScheduler({ systems, maxSystemsPerFrame: 2 });
            scheduler.update(0.016);

            // Both systems should be checked
            const stats = scheduler.getStats();
            expect(stats.currentIndex).toBe(0); // Wrapped around
        });
    });

    describe('update', () => {
        test('should call system update when interval is met', () => {
            const updateFn = jest.fn();
            const systems: ThrottledSystem[] = [
                { name: 'test', interval: 100, lastUpdate: 0, update: updateFn }
            ];

            scheduler = new RoundRobinScheduler({ systems });

            // Advance time past interval
            jest.advanceTimersByTime(150);
            scheduler.update(0.016);

            expect(updateFn).toHaveBeenCalledTimes(1);
        });

        test('should not call system update when interval not met', () => {
            const updateFn = jest.fn();
            const currentTime = performance.now();
            const systems: ThrottledSystem[] = [
                { name: 'test', interval: 100, lastUpdate: currentTime, update: updateFn }
            ];

            scheduler = new RoundRobinScheduler({ systems });
            scheduler.update(0.016);

            expect(updateFn).not.toHaveBeenCalled();
        });

        test('should rotate through systems in round-robin fashion', () => {
            const update1 = jest.fn();
            const update2 = jest.fn();
            const update3 = jest.fn();

            const systems: ThrottledSystem[] = [
                { name: 'test1', interval: 100, lastUpdate: 0, update: update1 },
                { name: 'test2', interval: 100, lastUpdate: 0, update: update2 },
                { name: 'test3', interval: 100, lastUpdate: 0, update: update3 }
            ];

            scheduler = new RoundRobinScheduler({ systems, maxSystemsPerFrame: 1 });

            // First update - should try system 1
            jest.advanceTimersByTime(150);
            scheduler.update(0.016);

            // Second update - should try system 2
            jest.advanceTimersByTime(150);
            scheduler.update(0.016);

            // Third update - should try system 3
            jest.advanceTimersByTime(150);
            scheduler.update(0.016);

            // Fourth update - should wrap to system 1
            jest.advanceTimersByTime(150);
            scheduler.update(0.016);

            const stats = scheduler.getStats();
            expect(stats.currentIndex).toBe(1); // After 4 updates, index is 4 % 3 = 1
        });

        test('should handle empty systems array', () => {
            scheduler = new RoundRobinScheduler({ systems: [] });

            expect(() => scheduler.update(0.016)).not.toThrow();
        });

        test('should pass deltaTime to system update', () => {
            const updateFn = jest.fn();
            const systems: ThrottledSystem[] = [
                { name: 'test', interval: 100, lastUpdate: 0, update: updateFn }
            ];

            scheduler = new RoundRobinScheduler({ systems });
            jest.advanceTimersByTime(150);
            scheduler.update(0.016);

            expect(updateFn).toHaveBeenCalledWith(0.016);
        });

        test('should catch and log errors in system updates', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const errorFn = jest.fn(() => {
                throw new Error('Test error');
            });

            const systems: ThrottledSystem[] = [
                { name: 'errorSystem', interval: 100, lastUpdate: 0, update: errorFn }
            ];

            scheduler = new RoundRobinScheduler({ systems });
            jest.advanceTimersByTime(150);

            expect(() => scheduler.update(0.016)).not.toThrow();
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('addSystem', () => {
        test('should add new system to scheduler', () => {
            scheduler = new RoundRobinScheduler({ systems: [] });

            scheduler.addSystem({
                name: 'newSystem',
                interval: 100,
                lastUpdate: 0,
                update: jest.fn()
            });

            const stats = scheduler.getStats();
            expect(stats.totalSystems).toBe(1);
        });
    });

    describe('removeSystem', () => {
        test('should remove system by name', () => {
            const systems: ThrottledSystem[] = [
                { name: 'test1', interval: 100, lastUpdate: 0, update: jest.fn() },
                { name: 'test2', interval: 100, lastUpdate: 0, update: jest.fn() }
            ];

            scheduler = new RoundRobinScheduler({ systems });
            scheduler.removeSystem('test1');

            const stats = scheduler.getStats();
            expect(stats.totalSystems).toBe(1);
            expect(stats.systemStats[0].name).toBe('test2');
        });

        test('should handle removing non-existent system', () => {
            const systems: ThrottledSystem[] = [
                { name: 'test', interval: 100, lastUpdate: 0, update: jest.fn() }
            ];

            scheduler = new RoundRobinScheduler({ systems });

            expect(() => scheduler.removeSystem('nonexistent')).not.toThrow();
            expect(scheduler.getStats().totalSystems).toBe(1);
        });

        test('should adjust currentIndex when removing system', () => {
            const systems: ThrottledSystem[] = [
                { name: 'test1', interval: 100, lastUpdate: 0, update: jest.fn() },
                { name: 'test2', interval: 100, lastUpdate: 0, update: jest.fn() }
            ];

            scheduler = new RoundRobinScheduler({ systems });

            // Move index to end
            jest.advanceTimersByTime(150);
            scheduler.update(0.016);
            jest.advanceTimersByTime(150);
            scheduler.update(0.016);

            // Remove first system - index should be adjusted
            scheduler.removeSystem('test1');

            const stats = scheduler.getStats();
            expect(stats.currentIndex).toBe(0);
        });
    });

    describe('getStats', () => {
        test('should return complete statistics', () => {
            const systems: ThrottledSystem[] = [
                { name: 'test1', interval: 100, lastUpdate: 0, update: jest.fn() },
                { name: 'test2', interval: 200, lastUpdate: 0, update: jest.fn() }
            ];

            scheduler = new RoundRobinScheduler({ systems });
            const stats = scheduler.getStats();

            expect(stats).toHaveProperty('totalSystems', 2);
            expect(stats).toHaveProperty('currentIndex', 0);
            expect(stats).toHaveProperty('frameCount', 0);
            expect(stats).toHaveProperty('systemStats');
            expect(stats.systemStats).toHaveLength(2);
        });

        test('should track frame count', () => {
            scheduler = new RoundRobinScheduler({ systems: [] });

            scheduler.update(0.016);
            scheduler.update(0.016);
            scheduler.update(0.016);

            const stats = scheduler.getStats();
            expect(stats.frameCount).toBe(3);
        });
    });
});
