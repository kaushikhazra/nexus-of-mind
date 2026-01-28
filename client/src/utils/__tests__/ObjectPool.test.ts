/**
 * ObjectPool Unit Tests
 *
 * Tests for object pooling to reduce GC pressure.
 * Validates: Requirements 6.4 - Performance utility testing
 */

import { ObjectPool, createVector3Pool } from '../ObjectPool';
import { Vector3 } from '@babylonjs/core';

// Mock Vector3 for testing
jest.mock('@babylonjs/core', () => ({
    Vector3: jest.fn().mockImplementation(function(this: any, x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.set = jest.fn().mockImplementation(function(this: any, x: number, y: number, z: number) {
            this.x = x;
            this.y = y;
            this.z = z;
            return this;
        });
    })
}));

describe('ObjectPool', () => {
    describe('basic operations', () => {
        test('should create objects when pool is empty', () => {
            const createFn = jest.fn(() => ({ value: 1 }));
            const pool = new ObjectPool(createFn);

            const obj = pool.get();

            expect(createFn).toHaveBeenCalledTimes(1);
            expect(obj).toEqual({ value: 1 });
        });

        test('should reuse objects from pool', () => {
            const createFn = jest.fn(() => ({ value: 1 }));
            const pool = new ObjectPool(createFn);

            const obj1 = pool.get();
            pool.release(obj1);
            const obj2 = pool.get();

            // Create should only be called once - obj2 should be reused
            expect(createFn).toHaveBeenCalledTimes(1);
            expect(obj1).toBe(obj2);
        });

        test('should call reset function when releasing', () => {
            const resetFn = jest.fn();
            const pool = new ObjectPool(() => ({ value: 1 }), resetFn);

            const obj = pool.get();
            pool.release(obj);

            expect(resetFn).toHaveBeenCalledWith(obj);
        });

        test('should respect maxSize limit', () => {
            const pool = new ObjectPool(() => ({ value: 1 }), undefined, 2);

            const obj1 = pool.get();
            const obj2 = pool.get();
            const obj3 = pool.get();

            pool.release(obj1);
            pool.release(obj2);
            pool.release(obj3); // Should not be added (pool is full)

            const stats = pool.getStats();
            expect(stats.poolSize).toBe(2);
        });
    });

    describe('getStats', () => {
        test('should return current pool statistics', () => {
            const pool = new ObjectPool(() => ({}), undefined, 100);

            const obj1 = pool.get();
            const obj2 = pool.get();
            pool.release(obj1);

            const stats = pool.getStats();
            expect(stats.poolSize).toBe(1);
            expect(stats.maxSize).toBe(100);
        });
    });

    describe('clear', () => {
        test('should empty the pool', () => {
            const pool = new ObjectPool(() => ({}));

            pool.release(pool.get());
            pool.release(pool.get());
            pool.release(pool.get());

            expect(pool.getStats().poolSize).toBe(3);

            pool.clear();

            expect(pool.getStats().poolSize).toBe(0);
        });
    });

    describe('createVector3Pool', () => {
        test('should create pool with initial size', () => {
            const pool = createVector3Pool(5, 100);

            const stats = pool.getStats();
            expect(stats.poolSize).toBe(5);
            expect(stats.maxSize).toBe(100);
        });

        test('should reset vectors to zero when released', () => {
            const pool = createVector3Pool(0, 10);

            const vec = pool.get();
            vec.x = 10;
            vec.y = 20;
            vec.z = 30;

            pool.release(vec);

            // Vector should have been reset
            expect(vec.set).toHaveBeenCalledWith(0, 0, 0);
        });
    });
});
