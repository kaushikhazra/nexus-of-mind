/**
 * ObjectPool - Memory optimization through object reuse
 * 
 * Object pool for reusing objects to reduce GC pressure.
 * Useful for frequently created/destroyed objects like particles or UI elements.
 */

import { Vector3 } from '@babylonjs/core';

// ==================== Object Pool ====================

/**
 * Object pool for reusing objects to reduce GC pressure
 * Useful for frequently created/destroyed objects like particles or UI elements
 */
export class ObjectPool<T> {
    private pool: T[] = [];
    private createFn: () => T;
    private resetFn?: (obj: T) => void;
    private maxSize: number;

    constructor(
        createFn: () => T,
        resetFn?: (obj: T) => void,
        maxSize: number = 100
    ) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxSize = maxSize;
    }

    /**
     * Get an object from the pool (or create new if pool is empty)
     */
    public get(): T {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.createFn();
    }

    /**
     * Return an object to the pool for reuse
     */
    public release(obj: T): void {
        if (this.pool.length < this.maxSize) {
            if (this.resetFn) {
                this.resetFn(obj);
            }
            this.pool.push(obj);
        }
    }

    /**
     * Get pool statistics
     */
    public getStats(): { poolSize: number; maxSize: number } {
        return {
            poolSize: this.pool.length,
            maxSize: this.maxSize
        };
    }

    /**
     * Clear the pool
     */
    public clear(): void {
        this.pool = [];
    }
}

/**
 * Create a Vector3 object pool for zero-allocation vector operations
 * 
 * @param initialSize Initial pool size
 * @param maxSize Maximum pool size
 * @returns Vector3 object pool
 */
export function createVector3Pool(initialSize: number = 10, maxSize: number = 100): ObjectPool<Vector3> {
    const pool = new ObjectPool<Vector3>(
        () => new Vector3(),
        (vector) => vector.set(0, 0, 0),
        maxSize
    );

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
        pool.release(new Vector3());
    }

    return pool;
}