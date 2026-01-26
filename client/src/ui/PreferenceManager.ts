/**
 * PreferenceManager - Local storage-based preference management
 * 
 * Handles persistent storage of user preferences using browser localStorage.
 * Provides error handling for localStorage unavailability and implements
 * methods for getting/setting skip introduction preference.
 * 
 * Requirements: 3.2, 3.3, 3.4
 */

export interface PreferenceManagerConfig {
    storageKey: string;
    fallbackToMemory?: boolean;
}

export interface PreferenceData {
    skipIntroduction: boolean;
    version: string;
    lastUpdated: number;
}

export class PreferenceManager {
    private storageKey: string;
    private fallbackToMemory: boolean;
    private memoryStorage: Map<string, any> = new Map();
    private isLocalStorageAvailable: boolean;

    constructor(config: PreferenceManagerConfig) {
        this.storageKey = config.storageKey;
        this.fallbackToMemory = config.fallbackToMemory ?? true;
        this.isLocalStorageAvailable = this.checkLocalStorageAvailability();
        
        // Initialize with default preferences if none exist
        this.initializeDefaults();
    }

    /**
     * Check if localStorage is available and functional
     * Requirements: 3.4 - Error handling for localStorage unavailability
     */
    private checkLocalStorageAvailability(): boolean {
        try {
            const testKey = '__preference_manager_test__';
            const testValue = 'test';
            
            localStorage.setItem(testKey, testValue);
            const retrieved = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            
            return retrieved === testValue;
        } catch (error) {
            console.warn('localStorage is not available:', error);
            return false;
        }
    }

    /**
     * Initialize default preferences if none exist
     * Requirements: 3.2 - Preference storage
     */
    private initializeDefaults(): void {
        const existing = this.getPreferences();
        if (!existing) {
            const defaultPreferences: PreferenceData = {
                skipIntroduction: false,
                version: '1.0.0',
                lastUpdated: Date.now()
            };
            this.setPreferences(defaultPreferences);
        }
    }

    /**
     * Get all preferences from storage
     * Requirements: 3.2, 3.3 - Preference retrieval
     */
    private getPreferences(): PreferenceData | null {
        try {
            let data: string | null = null;
            
            if (this.isLocalStorageAvailable) {
                data = localStorage.getItem(this.storageKey);
            } else if (this.fallbackToMemory) {
                data = this.memoryStorage.get(this.storageKey) || null;
            }
            
            if (!data) {
                return null;
            }
            
            const parsed = JSON.parse(data) as PreferenceData;
            
            // Validate the structure
            if (typeof parsed.skipIntroduction !== 'boolean') {
                console.warn('Invalid preference data structure, resetting to defaults');
                return null;
            }
            
            return parsed;
        } catch (error) {
            console.error('Error reading preferences:', error);
            return null;
        }
    }

    /**
     * Set all preferences in storage
     * Requirements: 3.2, 3.4 - Preference storage with error handling
     */
    private setPreferences(preferences: PreferenceData): boolean {
        try {
            const data = JSON.stringify(preferences);
            
            if (this.isLocalStorageAvailable) {
                localStorage.setItem(this.storageKey, data);
            } else if (this.fallbackToMemory) {
                this.memoryStorage.set(this.storageKey, data);
            } else {
                console.warn('No storage mechanism available for preferences');
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error saving preferences:', error);
            
            // Try fallback to memory storage if localStorage fails
            if (this.isLocalStorageAvailable && this.fallbackToMemory) {
                try {
                    const data = JSON.stringify(preferences);
                    this.memoryStorage.set(this.storageKey, data);
                    console.warn('Fell back to memory storage for preferences');
                    return true;
                } catch (memoryError) {
                    console.error('Memory storage fallback also failed:', memoryError);
                }
            }
            
            return false;
        }
    }

    /**
     * Get the skip introduction preference
     * Requirements: 3.2, 3.3 - Getting skip introduction preference
     */
    public getSkipIntroduction(): boolean {
        const preferences = this.getPreferences();
        return preferences?.skipIntroduction ?? false;
    }

    /**
     * Set the skip introduction preference
     * Requirements: 3.2, 3.3 - Setting skip introduction preference
     */
    public setSkipIntroduction(skip: boolean): boolean {
        const preferences = this.getPreferences() || {
            skipIntroduction: false,
            version: '1.0.0',
            lastUpdated: Date.now()
        };
        
        preferences.skipIntroduction = skip;
        preferences.lastUpdated = Date.now();
        
        const success = this.setPreferences(preferences);
        
        if (success) {
            console.log(`Skip introduction preference set to: ${skip}`);
        } else {
            console.error('Failed to save skip introduction preference');
        }
        
        return success;
    }

    /**
     * Clear all preferences (useful for testing)
     * Requirements: 3.5 - Preference reset functionality for testing
     */
    public clearPreferences(): boolean {
        try {
            if (this.isLocalStorageAvailable) {
                localStorage.removeItem(this.storageKey);
            }
            
            if (this.fallbackToMemory) {
                this.memoryStorage.delete(this.storageKey);
            }
            
            console.log('Preferences cleared successfully');
            return true;
        } catch (error) {
            console.error('Error clearing preferences:', error);
            return false;
        }
    }

    /**
     * Reset preferences to defaults
     * Requirements: 3.5 - Preference reset functionality for testing
     */
    public resetToDefaults(): boolean {
        const defaultPreferences: PreferenceData = {
            skipIntroduction: false,
            version: '1.0.0',
            lastUpdated: Date.now()
        };
        
        const success = this.setPreferences(defaultPreferences);
        
        if (success) {
            console.log('Preferences reset to defaults');
        } else {
            console.error('Failed to reset preferences to defaults');
        }
        
        return success;
    }

    /**
     * Check if localStorage is currently available
     * Requirements: 3.4 - Error handling for localStorage unavailability
     */
    public isStorageAvailable(): boolean {
        return this.isLocalStorageAvailable;
    }

    /**
     * Get storage mechanism being used
     * Requirements: 3.4 - Error handling information
     */
    public getStorageMechanism(): 'localStorage' | 'memory' | 'none' {
        if (this.isLocalStorageAvailable) {
            return 'localStorage';
        } else if (this.fallbackToMemory) {
            return 'memory';
        } else {
            return 'none';
        }
    }

    /**
     * Get all preference data for debugging
     * Requirements: 3.5 - Testing support
     */
    public getAllPreferences(): PreferenceData | null {
        return this.getPreferences();
    }

    /**
     * Validate preference data structure
     * Requirements: 3.4 - Error handling
     */
    public validatePreferences(): boolean {
        const preferences = this.getPreferences();
        
        if (!preferences) {
            return false;
        }
        
        // Check required fields
        if (typeof preferences.skipIntroduction !== 'boolean') {
            return false;
        }
        
        if (typeof preferences.version !== 'string') {
            return false;
        }
        
        if (typeof preferences.lastUpdated !== 'number') {
            return false;
        }
        
        return true;
    }

    /**
     * Repair corrupted preferences by resetting to defaults
     * Requirements: 3.4 - Error handling
     */
    public repairPreferences(): boolean {
        if (!this.validatePreferences()) {
            console.warn('Preferences are corrupted, repairing...');
            return this.resetToDefaults();
        }
        
        return true;
    }
}