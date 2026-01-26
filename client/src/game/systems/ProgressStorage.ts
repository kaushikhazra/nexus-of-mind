/**
 * ProgressStorage - API client for Energy Lords progression persistence
 *
 * Communicates with the Python backend to save/load player progress
 * using SQLite database storage.
 */

import { SavedProgress } from '../types/EnergyLordsTypes';
import { getBackendUrl } from '../../config';

/**
 * API response structure
 */
interface ProgressResponse {
    success: boolean;
    data?: SavedProgress;
    message?: string;
}

/**
 * Default progress for new players
 */
const DEFAULT_PROGRESS: SavedProgress = {
    currentLevel: 0,
    highestTitle: 'Initiate',
    totalUpgradeBonus: 0,
    completedLevels: []
};

/**
 * ProgressStorage - Handles persistence of player progress via backend API
 */
export class ProgressStorage {
    private baseUrl: string;
    private playerId: string;

    constructor(baseUrl: string = getBackendUrl(), playerId: string = 'default') {
        this.baseUrl = baseUrl;
        this.playerId = playerId;
    }

    /**
     * Load player progress from backend
     *
     * @returns Saved progress or default values
     */
    public async load(): Promise<SavedProgress> {
        try {
            const response = await fetch(
                `${this.baseUrl}/api/progress?player_id=${encodeURIComponent(this.playerId)}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                console.warn(`Failed to load progress: ${response.status}`);
                return { ...DEFAULT_PROGRESS };
            }

            const result: ProgressResponse = await response.json();

            if (result.success && result.data) {
                console.log(`Loaded progress: Level ${result.data.currentLevel}, Title: ${result.data.highestTitle}`);
                return result.data;
            }

            return { ...DEFAULT_PROGRESS };

        } catch (error) {
            // Backend not available - this is expected when running without the server
            console.warn('Backend not available, using default progress. Start backend with: python -m server.main');
            return { ...DEFAULT_PROGRESS };
        }
    }

    /**
     * Save player progress to backend
     *
     * @param progress - Progress data to save
     * @returns True if successful
     */
    public async save(progress: SavedProgress): Promise<boolean> {
        try {
            const response = await fetch(
                `${this.baseUrl}/api/progress?player_id=${encodeURIComponent(this.playerId)}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(progress)
                }
            );

            if (!response.ok) {
                console.error(`Failed to save progress: ${response.status}`);
                return false;
            }

            const result: ProgressResponse = await response.json();

            if (result.success) {
                console.log(`Saved progress: Level ${progress.currentLevel}, Title: ${progress.highestTitle}`);
                return true;
            }

            return false;

        } catch (error) {
            // Backend not available - progress won't be persisted
            console.warn('Backend not available, progress not saved');
            return false;
        }
    }

    /**
     * Reset player progress to initial state
     *
     * @returns True if successful
     */
    public async clear(): Promise<boolean> {
        try {
            const response = await fetch(
                `${this.baseUrl}/api/progress?player_id=${encodeURIComponent(this.playerId)}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                console.error(`Failed to reset progress: ${response.status}`);
                return false;
            }

            const result: ProgressResponse = await response.json();

            if (result.success) {
                console.log('Progress reset successfully');
                return true;
            }

            return false;

        } catch (error) {
            // Backend not available
            console.warn('Backend not available, progress not reset');
            return false;
        }
    }

    /**
     * Check if backend is available
     *
     * @returns True if backend responds
     */
    public async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000) // 3 second timeout
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get the player ID
     */
    public getPlayerId(): string {
        return this.playerId;
    }

    /**
     * Set the player ID (for future multiplayer support)
     */
    public setPlayerId(playerId: string): void {
        this.playerId = playerId;
    }
}
