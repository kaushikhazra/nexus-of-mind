/**
 * EnergyLordsManager - Main orchestrator for the Energy Lords progression system
 *
 * Coordinates threshold monitoring, progress persistence, and victory handling.
 * Integrates with EnergyManager to track player energy production.
 */

import { EnergyManager } from '../EnergyManager';
import { ThresholdMonitor } from './ThresholdMonitor';
import { ProgressStorage } from './ProgressStorage';
import {
    SavedProgress,
    ProgressState,
    VictoryEventData,
    LevelDefinition,
    LEVEL_CONFIGS,
    TIER_CONFIGS,
    MAX_LEVEL,
    getNextLevelConfig,
    getLevelConfig,
    getTierForLevel,
    formatTimeMs
} from '../types/EnergyLordsTypes';

/**
 * Event types emitted by EnergyLordsManager
 */
export type EnergyLordsEvent =
    | { type: 'progress_update'; data: ProgressState }
    | { type: 'victory'; data: VictoryEventData }
    | { type: 'threshold_crossed'; data: { above: boolean; energy: number } }
    | { type: 'progress_loaded'; data: SavedProgress };

/**
 * Event listener callback type
 */
export type EnergyLordsEventListener = (event: EnergyLordsEvent) => void;

/**
 * EnergyLordsManager - Main progression system orchestrator
 */
export class EnergyLordsManager {
    private energyManager: EnergyManager;
    private monitor: ThresholdMonitor;
    private storage: ProgressStorage;

    // Current progress state
    private currentLevel: number = 0;
    private highestTitle: string = 'Initiate';
    private totalUpgradeBonus: number = 0;
    private completedLevels: number[] = [];

    // Runtime state
    private targetLevel: LevelDefinition | undefined;
    private isVictoryTriggered: boolean = false;
    private isInitialized: boolean = false;

    // Event listeners
    private listeners: EnergyLordsEventListener[] = [];

    constructor(
        energyManager: EnergyManager,
        backendUrl: string = 'http://localhost:8000',
        playerId: string = 'default'
    ) {
        this.energyManager = energyManager;
        this.monitor = new ThresholdMonitor();
        this.storage = new ProgressStorage(backendUrl, playerId);

        // Set up threshold state change callback
        this.monitor.setOnStateChange((isAbove, sustainedTime) => {
            this.emit({
                type: 'threshold_crossed',
                data: {
                    above: isAbove,
                    energy: this.energyManager.getTotalEnergy()
                }
            });
        });
    }

    /**
     * Initialize the manager by loading saved progress
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            const savedProgress = await this.storage.load();

            this.currentLevel = savedProgress.currentLevel;
            this.highestTitle = savedProgress.highestTitle;
            this.totalUpgradeBonus = savedProgress.totalUpgradeBonus;
            this.completedLevels = [...savedProgress.completedLevels];

            // Set the next target level
            this.targetLevel = getNextLevelConfig(this.currentLevel);

            this.isInitialized = true;

            console.log(`Energy Lords initialized: Level ${this.currentLevel}, Title: ${this.highestTitle}`);

            this.emit({
                type: 'progress_loaded',
                data: savedProgress
            });

        } catch (error) {
            console.error('Failed to initialize Energy Lords:', error);
            // Use defaults on failure
            this.targetLevel = getNextLevelConfig(0);
            this.isInitialized = true;
        }
    }

    /**
     * Update the progression system - call this from the game loop
     *
     * @param currentTime - Current game time in milliseconds (e.g., performance.now())
     */
    public update(currentTime: number): void {
        if (!this.isInitialized || this.isVictoryTriggered || !this.targetLevel) {
            return;
        }

        const currentEnergy = this.energyManager.getTotalEnergy();
        const stats = this.energyManager.getEnergyStats();

        // Only start counting once player has produced energy (not just starting energy)
        // AND current energy meets or exceeds threshold
        const hasProducedEnergy = stats.totalGeneration > 0;
        const effectiveEnergy = hasProducedEnergy ? currentEnergy : 0;

        // Update the threshold monitor (threshold is now directly in Joules)
        this.monitor.update(
            currentTime,
            effectiveEnergy,
            this.targetLevel.energyThreshold
        );

        // Check for victory condition
        if (this.monitor.hasReachedTarget(this.targetLevel.sustainTime)) {
            this.triggerVictory();
            return;
        }

        // Emit progress update
        this.emit({
            type: 'progress_update',
            data: this.getProgressState()
        });
    }

    /**
     * Trigger victory when sustained time is reached
     */
    private async triggerVictory(): Promise<void> {
        if (!this.targetLevel || this.isVictoryTriggered) {
            return;
        }

        this.isVictoryTriggered = true;

        // Check if this is a tier completion (levels 5, 10, 15, etc.)
        const isTierCompletion = this.targetLevel.isTierCompletion;

        // Get tier information for celebration
        const currentTier = getTierForLevel(this.targetLevel.level);
        const previousTierName = currentTier?.name;

        // Next tier starts at level + 1 (if tier completion)
        const nextTier = isTierCompletion ? getTierForLevel(this.targetLevel.level + 1) : undefined;
        const newTierName = nextTier?.name;

        // Update progress
        this.currentLevel = this.targetLevel.level;
        this.highestTitle = this.targetLevel.title;
        this.totalUpgradeBonus += this.targetLevel.upgradeBonus;
        this.completedLevels.push(this.targetLevel.level);

        // Create victory data with tier information
        const victoryData: VictoryEventData = {
            levelCompleted: this.targetLevel.level,
            newTitle: this.targetLevel.title,
            upgradeBonus: this.targetLevel.upgradeBonus,
            totalUpgradeBonus: this.totalUpgradeBonus,
            isTierCompletion,
            previousTierName,
            newTierName
        };

        if (isTierCompletion) {
            console.log(`TIER COMPLETE! Mastered ${previousTierName}, unlocked ${newTierName || 'MAX LEVEL'}!`);
        }
        console.log(`Victory! New title: ${this.highestTitle}, Total upgrade: +${this.totalUpgradeBonus.toFixed(1)}%`);

        // Save progress
        await this.saveProgress();

        // Emit victory event
        this.emit({
            type: 'victory',
            data: victoryData
        });
    }

    /**
     * Save current progress to backend
     */
    public async saveProgress(): Promise<boolean> {
        const progress: SavedProgress = {
            currentLevel: this.currentLevel,
            highestTitle: this.highestTitle,
            totalUpgradeBonus: this.totalUpgradeBonus,
            completedLevels: [...this.completedLevels]
        };

        return await this.storage.save(progress);
    }

    /**
     * Get the current progress state
     */
    public getProgressState(): ProgressState {
        const currentEnergy = this.energyManager.getTotalEnergy();
        const stats = this.energyManager.getEnergyStats();
        const threshold = this.targetLevel?.energyThreshold || 0;

        // Only consider above threshold if player has produced energy
        const hasProducedEnergy = stats.totalGeneration > 0;
        const isAbove = hasProducedEnergy && currentEnergy >= threshold;

        return {
            currentLevel: this.currentLevel,
            targetLevel: this.targetLevel || LEVEL_CONFIGS[0],
            sustainedTime: this.monitor.getSustainedTime(),
            currentEnergy,
            isAboveThreshold: isAbove,
            progressPercent: this.targetLevel
                ? this.monitor.getProgressPercent(this.targetLevel.sustainTime)
                : 0
        };
    }

    /**
     * Get the current level
     */
    public getCurrentLevel(): number {
        return this.currentLevel;
    }

    /**
     * Get the current title
     */
    public getCurrentTitle(): string {
        return this.highestTitle;
    }

    /**
     * Get the total upgrade bonus percentage
     */
    public getTotalUpgradeBonus(): number {
        return this.totalUpgradeBonus;
    }

    /**
     * Get the target level configuration
     */
    public getTargetLevel(): LevelDefinition | undefined {
        return this.targetLevel;
    }

    /**
     * Check if player has completed all levels
     */
    public isMaxLevel(): boolean {
        return this.currentLevel >= MAX_LEVEL;
    }

    /**
     * Check if a victory has been triggered this session
     */
    public hasTriggeredVictory(): boolean {
        return this.isVictoryTriggered;
    }

    /**
     * Reset for a new game session (after victory)
     */
    public resetForNewSession(): void {
        this.monitor.reset();
        this.isVictoryTriggered = false;
        this.targetLevel = getNextLevelConfig(this.currentLevel);
    }

    /**
     * Get formatted time strings for display
     */
    public getFormattedTimes(): { sustained: string; required: string } {
        const sustainedMs = this.monitor.getSustainedTime();
        const requiredSec = this.targetLevel?.sustainTime || 0;

        return {
            sustained: formatTimeMs(sustainedMs),
            required: formatTimeMs(requiredSec * 1000)
        };
    }

    /**
     * Subscribe to events
     */
    public addEventListener(listener: EnergyLordsEventListener): void {
        this.listeners.push(listener);
    }

    /**
     * Unsubscribe from events
     */
    public removeEventListener(listener: EnergyLordsEventListener): void {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Emit an event to all listeners
     */
    private emit(event: EnergyLordsEvent): void {
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in EnergyLords event listener:', error);
            }
        });
    }

    /**
     * Reset all progress (for testing/debug)
     */
    public async resetAllProgress(): Promise<void> {
        this.currentLevel = 0;
        this.highestTitle = 'Initiate';
        this.totalUpgradeBonus = 0;
        this.completedLevels = [];
        this.targetLevel = getNextLevelConfig(0);
        this.monitor.reset();
        this.isVictoryTriggered = false;

        await this.storage.clear();

        console.log('Energy Lords progress reset');
    }

    /**
     * Dispose the manager
     */
    public dispose(): void {
        this.listeners = [];
        this.isInitialized = false;
    }
}
