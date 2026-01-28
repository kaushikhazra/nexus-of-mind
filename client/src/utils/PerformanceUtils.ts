/**
 * PerformanceUtils - Frame rate optimization helpers and constants
 * 
 * This module provides throttling, debouncing, and frame timing utilities
 * for maintaining 60fps gameplay performance.
 * 
 * Key Features:
 * - Throttle and debounce functions for rate limiting
 * - Frame-rate aware timers
 * - System update interval constants
 */

// ==================== Frame Rate Optimization Helpers ====================

/**
 * Throttle function calls to a maximum frequency
 * Useful for expensive operations that don't need to run every frame
 * 
 * @param func Function to throttle
 * @param interval Minimum interval between calls (ms)
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    interval: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    
    return (...args: Parameters<T>) => {
        const now = performance.now();
        if (now - lastCall >= interval) {
            lastCall = now;
            func(...args);
        }
    };
}

/**
 * Debounce function calls to avoid excessive execution
 * Useful for operations that should only happen after a period of inactivity
 * 
 * @param func Function to debounce
 * @param delay Delay before execution (ms)
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: number | undefined;
    
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => func(...args), delay);
    };
}

/**
 * Create a frame-rate aware timer
 * Automatically adjusts timing based on current frame rate
 * 
 * @param callback Function to call
 * @param targetFPS Target frame rate (default: 60)
 * @returns Timer control object
 */
export function createFrameTimer(
    callback: () => void,
    targetFPS: number = 60
): {
    start: () => void;
    stop: () => void;
    isRunning: () => boolean;
} {
    let animationId: number | null = null;
    let lastTime = 0;
    const interval = 1000 / targetFPS;
    
    function tick(currentTime: number) {
        if (currentTime - lastTime >= interval) {
            callback();
            lastTime = currentTime;
        }
        
        if (animationId !== null) {
            animationId = requestAnimationFrame(tick);
        }
    }
    
    return {
        start: () => {
            if (animationId === null) {
                lastTime = performance.now();
                animationId = requestAnimationFrame(tick);
            }
        },
        stop: () => {
            if (animationId !== null) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        },
        isRunning: () => animationId !== null
    };
}

// ==================== System Update Intervals ====================

/**
 * Get recommended update intervals for different system types
 * Based on performance requirements and update frequency needs
 */
export const SYSTEM_UPDATE_INTERVALS = {
    /** Critical systems that need high frequency updates */
    CRITICAL: 16,     // ~60 Hz
    /** Important systems that need regular updates */
    IMPORTANT: 33,    // ~30 Hz
    /** Normal systems with moderate update needs */
    NORMAL: 100,      // ~10 Hz
    /** Background systems with low update needs */
    BACKGROUND: 200,  // ~5 Hz
    /** Slow systems that rarely need updates */
    SLOW: 1000        // ~1 Hz
} as const;