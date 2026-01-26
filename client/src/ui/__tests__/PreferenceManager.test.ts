/**
 * PreferenceManager Tests
 * 
 * Tests for the PreferenceManager class focusing on localStorage-based
 * preference storage and error handling.
 * 
 * @jest-environment jsdom
 */

import { PreferenceManager } from '../PreferenceManager';

describe('PreferenceManager', () => {
    let preferenceManager: PreferenceManager;
    const testStorageKey = 'test-preferences';

    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        
        preferenceManager = new PreferenceManager({
            storageKey: testStorageKey,
            fallbackToMemory: true
        });
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('Initialization', () => {
        test('should create PreferenceManager with default preferences', () => {
            expect(preferenceManager).toBeDefined();
            expect(preferenceManager.getSkipIntroduction()).toBe(false);
            expect(preferenceManager.isStorageAvailable()).toBe(true);
            expect(preferenceManager.getStorageMechanism()).toBe('localStorage');
        });

        test('should validate preferences structure', () => {
            expect(preferenceManager.validatePreferences()).toBe(true);
        });
    });

    describe('Skip Introduction Preference', () => {
        test('should get and set skip introduction preference', () => {
            // Initially false
            expect(preferenceManager.getSkipIntroduction()).toBe(false);
            
            // Set to true
            const success = preferenceManager.setSkipIntroduction(true);
            expect(success).toBe(true);
            expect(preferenceManager.getSkipIntroduction()).toBe(true);
            
            // Set back to false
            preferenceManager.setSkipIntroduction(false);
            expect(preferenceManager.getSkipIntroduction()).toBe(false);
        });

        test('should persist preferences across instances', () => {
            // Set preference in first instance
            preferenceManager.setSkipIntroduction(true);
            
            // Create new instance
            const newPreferenceManager = new PreferenceManager({
                storageKey: testStorageKey,
                fallbackToMemory: true
            });
            
            // Should load the saved preference
            expect(newPreferenceManager.getSkipIntroduction()).toBe(true);
        });
    });

    describe('Preference Management', () => {
        test('should reset preferences to defaults', () => {
            // Set some preferences
            preferenceManager.setSkipIntroduction(true);
            expect(preferenceManager.getSkipIntroduction()).toBe(true);
            
            // Reset to defaults
            const success = preferenceManager.resetToDefaults();
            expect(success).toBe(true);
            expect(preferenceManager.getSkipIntroduction()).toBe(false);
        });

        test('should clear all preferences', () => {
            // Set some preferences
            preferenceManager.setSkipIntroduction(true);
            expect(preferenceManager.getSkipIntroduction()).toBe(true);
            
            // Clear preferences
            const success = preferenceManager.clearPreferences();
            expect(success).toBe(true);
            
            // Should return to defaults after clearing
            expect(preferenceManager.getSkipIntroduction()).toBe(false);
        });

        test('should get all preferences', () => {
            preferenceManager.setSkipIntroduction(true);
            
            const allPreferences = preferenceManager.getAllPreferences();
            expect(allPreferences).toBeDefined();
            expect(allPreferences?.skipIntroduction).toBe(true);
            expect(allPreferences?.version).toBe('1.0.0');
            expect(typeof allPreferences?.lastUpdated).toBe('number');
        });
    });

    describe('Error Handling', () => {
        test('should handle localStorage unavailability gracefully', () => {
            // Mock localStorage to throw an error
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = jest.fn(() => {
                throw new Error('localStorage not available');
            });
            
            // Create new instance that should fall back to memory
            const fallbackManager = new PreferenceManager({
                storageKey: 'test-fallback',
                fallbackToMemory: true
            });
            
            // Should still work with memory storage
            expect(fallbackManager.getStorageMechanism()).toBe('memory');
            const success = fallbackManager.setSkipIntroduction(true);
            expect(success).toBe(true);
            expect(fallbackManager.getSkipIntroduction()).toBe(true);
            
            // Restore original localStorage
            localStorage.setItem = originalSetItem;
        });

        test('should repair corrupted preferences', () => {
            // Manually set corrupted data in localStorage
            localStorage.setItem(testStorageKey, '{"invalid": "data"}');
            
            // Create new instance
            const corruptedManager = new PreferenceManager({
                storageKey: testStorageKey,
                fallbackToMemory: true
            });
            
            // Should detect corruption and repair
            expect(corruptedManager.validatePreferences()).toBe(false);
            const repaired = corruptedManager.repairPreferences();
            expect(repaired).toBe(true);
            expect(corruptedManager.validatePreferences()).toBe(true);
            expect(corruptedManager.getSkipIntroduction()).toBe(false);
        });
    });

    describe('Storage Mechanisms', () => {
        test('should report correct storage mechanism', () => {
            expect(preferenceManager.getStorageMechanism()).toBe('localStorage');
            expect(preferenceManager.isStorageAvailable()).toBe(true);
        });

        test('should handle memory fallback when localStorage fails', () => {
            // Mock localStorage to be unavailable
            const originalGetItem = localStorage.getItem;
            const originalSetItem = localStorage.setItem;
            
            localStorage.getItem = jest.fn(() => {
                throw new Error('localStorage not available');
            });
            localStorage.setItem = jest.fn(() => {
                throw new Error('localStorage not available');
            });
            
            // Create manager with fallback enabled
            const memoryManager = new PreferenceManager({
                storageKey: 'memory-test',
                fallbackToMemory: true
            });
            
            expect(memoryManager.getStorageMechanism()).toBe('memory');
            expect(memoryManager.isStorageAvailable()).toBe(false);
            
            // Should still work with memory storage
            const success = memoryManager.setSkipIntroduction(true);
            expect(success).toBe(true);
            expect(memoryManager.getSkipIntroduction()).toBe(true);
            
            // Restore localStorage
            localStorage.getItem = originalGetItem;
            localStorage.setItem = originalSetItem;
        });
    });
});