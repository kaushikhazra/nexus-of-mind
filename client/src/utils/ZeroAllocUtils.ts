/**
 * ZeroAllocUtils - Zero-allocation vector operations
 * 
 * This module provides reusable zero-allocation vector operations to reduce
 * garbage collection pressure during frequent calculations (60fps requirement).
 * 
 * WHY: Creating new Vector3 objects every frame causes GC pressure,
 * leading to frame drops. Reusing these vectors maintains smooth 60fps.
 */

import { Vector3 } from '@babylonjs/core';

// ==================== Pre-allocated Vectors ====================

/**
 * Pre-allocated vectors for zero-allocation operations.
 * These vectors are reused to avoid garbage collection pressure during
 * frequent calculations (60fps requirement). Use these for temporary
 * calculations where the result is immediately used or copied.
 */
const _tempVector1 = new Vector3();
const _tempVector2 = new Vector3();
const _tempVector3 = new Vector3();
const _tempVector4 = new Vector3();

// ==================== Zero-Allocation Vector Operations ====================

/**
 * Calculate direction between two points without allocation
 * Modifies the result vector in-place to avoid creating new objects
 * 
 * @param from Starting position
 * @param to Target position
 * @param result Vector3 to store the result (modified in-place)
 */
export function getDirectionZeroAlloc(from: Vector3, to: Vector3, result: Vector3): void {
    to.subtractToRef(from, result);
    result.normalize();
}

/**
 * Calculate midpoint between two positions without allocation
 * 
 * @param pos1 First position
 * @param pos2 Second position
 * @param result Vector3 to store the result (modified in-place)
 */
export function getMidpointZeroAlloc(pos1: Vector3, pos2: Vector3, result: Vector3): void {
    pos1.addToRef(pos2, result);
    result.scaleInPlace(0.5);
}

/**
 * Lerp between two positions without allocation
 * 
 * @param start Starting position
 * @param end Ending position
 * @param t Interpolation factor (0-1)
 * @param result Vector3 to store the result (modified in-place)
 */
export function lerpZeroAlloc(start: Vector3, end: Vector3, t: number, result: Vector3): void {
    Vector3.LerpToRef(start, end, t, result);
}

/**
 * Calculate offset position without allocation
 * 
 * @param position Base position
 * @param offset Offset to apply
 * @param result Vector3 to store the result (modified in-place)
 */
export function addOffsetZeroAlloc(position: Vector3, offset: Vector3, result: Vector3): void {
    position.addToRef(offset, result);
}

/**
 * Scale vector without allocation
 * 
 * @param vector Vector to scale
 * @param scale Scale factor
 * @param result Vector3 to store the result (modified in-place)
 */
export function scaleVectorZeroAlloc(vector: Vector3, scale: number, result: Vector3): void {
    vector.scaleToRef(scale, result);
}

/**
 * Get a temporary vector for calculations (use immediately, don't store)
 * Returns one of the pre-allocated temporary vectors
 * 
 * @param index Which temporary vector to use (0-3)
 * @returns Pre-allocated Vector3 for temporary use
 */
export function getTempVector(index: number = 0): Vector3 {
    switch (index) {
        case 0: return _tempVector1;
        case 1: return _tempVector2;
        case 2: return _tempVector3;
        case 3: return _tempVector4;
        default: return _tempVector1;
    }
}