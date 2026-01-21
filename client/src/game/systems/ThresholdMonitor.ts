/**
 * ThresholdMonitor - Energy threshold monitoring with 500ms check interval
 *
 * Monitors energy levels at fixed intervals and tracks how long
 * the player has sustained energy above the threshold.
 * Timer resets to zero if energy drops below threshold.
 */

import { THRESHOLD_CHECK_INTERVAL } from '../types/EnergyLordsTypes';

/**
 * Callback type for threshold state changes
 */
export type ThresholdCallback = (isAbove: boolean, sustainedTime: number) => void;

/**
 * ThresholdMonitor - Tracks sustained time above energy threshold
 */
export class ThresholdMonitor {
    private checkInterval: number;
    private sustainedTime: number = 0;
    private lastCheckTime: number = 0;
    private isAboveThreshold: boolean = false;
    private onStateChange?: ThresholdCallback;

    constructor(checkInterval: number = THRESHOLD_CHECK_INTERVAL) {
        this.checkInterval = checkInterval;
    }

    /**
     * Update the monitor with current game time and energy level
     *
     * @param currentTime - Current game time in milliseconds
     * @param currentEnergy - Current total energy level
     * @param threshold - Required energy threshold
     */
    public update(currentTime: number, currentEnergy: number, threshold: number): void {
        // Check if enough time has passed since last check
        if (currentTime - this.lastCheckTime < this.checkInterval) {
            return;
        }

        this.lastCheckTime = currentTime;

        const wasAbove = this.isAboveThreshold;
        this.isAboveThreshold = currentEnergy >= threshold;

        if (this.isAboveThreshold) {
            // Above threshold - increment sustained time
            this.sustainedTime += this.checkInterval;
        } else {
            // Below threshold - reset sustained time
            this.sustainedTime = 0;
        }

        // Notify on state change
        if (wasAbove !== this.isAboveThreshold && this.onStateChange) {
            this.onStateChange(this.isAboveThreshold, this.sustainedTime);
        }
    }

    /**
     * Get the current sustained time in milliseconds
     */
    public getSustainedTime(): number {
        return this.sustainedTime;
    }

    /**
     * Get sustained time in seconds
     */
    public getSustainedTimeSeconds(): number {
        return this.sustainedTime / 1000;
    }

    /**
     * Check if currently above threshold
     */
    public getIsAboveThreshold(): boolean {
        return this.isAboveThreshold;
    }

    /**
     * Reset the monitor state
     */
    public reset(): void {
        this.sustainedTime = 0;
        this.lastCheckTime = 0;
        this.isAboveThreshold = false;
    }

    /**
     * Set callback for threshold state changes
     */
    public setOnStateChange(callback: ThresholdCallback): void {
        this.onStateChange = callback;
    }

    /**
     * Get the check interval
     */
    public getCheckInterval(): number {
        return this.checkInterval;
    }

    /**
     * Calculate progress percentage toward a target time
     *
     * @param targetTimeSeconds - Target time in seconds
     * @returns Progress as a percentage (0-100)
     */
    public getProgressPercent(targetTimeSeconds: number): number {
        if (targetTimeSeconds <= 0) return 100;
        const percent = (this.sustainedTime / (targetTimeSeconds * 1000)) * 100;
        return Math.min(100, Math.max(0, percent));
    }

    /**
     * Check if target time has been reached
     *
     * @param targetTimeSeconds - Target time in seconds
     * @returns True if sustained time >= target time
     */
    public hasReachedTarget(targetTimeSeconds: number): boolean {
        return this.sustainedTime >= targetTimeSeconds * 1000;
    }
}
