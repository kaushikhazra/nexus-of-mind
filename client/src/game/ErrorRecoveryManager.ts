/**
 * ErrorRecoveryManager - Comprehensive error handling and recovery for Queen & Territory System
 * 
 * Implements error detection and recovery mechanisms for:
 * - Territory overlap detection and correction
 * - Queen lifecycle corruption recovery
 * - Hive construction failure retry logic
 * - Parasite control consistency validation
 */

import { Vector3 } from '@babylonjs/core';
import { TerritoryManager, Territory } from './TerritoryManager';
import { Queen, QueenPhase } from './entities/Queen';
import { Hive } from './entities/Hive';
import { ParasiteManager } from './ParasiteManager';
import { GameEngine } from './GameEngine';

export interface ErrorRecoveryConfig {
    maxRetryAttempts: number;
    retryDelayMs: number;
    validationIntervalMs: number;
    enableLogging: boolean;
}

export interface TerritoryOverlapError {
    territory1: Territory;
    territory2: Territory;
    overlapArea: number;
    detectedAt: number;
}

export interface QueenCorruptionError {
    queen: Queen;
    expectedPhase: QueenPhase;
    actualPhase: QueenPhase;
    corruptionType: 'invalid_phase' | 'missing_hive' | 'invalid_vulnerability' | 'stuck_growth';
    detectedAt: number;
}

export interface HiveConstructionError {
    hive: Hive;
    errorType: 'timeout' | 'invalid_position' | 'construction_stuck' | 'missing_queen';
    attemptCount: number;
    lastAttemptAt: number;
}

export interface ParasiteControlError {
    parasiteId: string;
    expectedQueenId: string | null;
    actualQueenId: string | null;
    territoryId: string;
    errorType: 'orphaned_parasite' | 'wrong_queen' | 'duplicate_control' | 'missing_territory';
    detectedAt: number;
}

export interface ErrorRecoveryStats {
    territoryOverlapErrors: number;
    queenCorruptionErrors: number;
    hiveConstructionErrors: number;
    parasiteControlErrors: number;
    totalRecoveryAttempts: number;
    successfulRecoveries: number;
    lastValidationTime: number;
}

export class ErrorRecoveryManager {
    private territoryManager: TerritoryManager;
    private parasiteManager: ParasiteManager;
    private gameEngine: GameEngine;
    
    private config: ErrorRecoveryConfig;
    private stats: ErrorRecoveryStats;
    
    // Error tracking
    private territoryOverlapErrors: Map<string, TerritoryOverlapError> = new Map();
    private queenCorruptionErrors: Map<string, QueenCorruptionError> = new Map();
    private hiveConstructionErrors: Map<string, HiveConstructionError> = new Map();
    private parasiteControlErrors: Map<string, ParasiteControlError> = new Map();
    
    // Retry tracking
    private hiveRetryAttempts: Map<string, number> = new Map();
    private queenRecoveryAttempts: Map<string, number> = new Map();
    
    // Validation timing
    private lastValidationTime: number = 0;
    private validationTimer: NodeJS.Timeout | null = null;
    
    constructor(
        territoryManager: TerritoryManager,
        parasiteManager: ParasiteManager,
        gameEngine: GameEngine,
        config: Partial<ErrorRecoveryConfig> = {}
    ) {
        this.territoryManager = territoryManager;
        this.parasiteManager = parasiteManager;
        this.gameEngine = gameEngine;
        
        // Default configuration
        this.config = {
            maxRetryAttempts: 3,
            retryDelayMs: 5000, // 5 seconds
            validationIntervalMs: 10000, // 10 seconds
            enableLogging: true,
            ...config
        };
        
        // Initialize stats
        this.stats = {
            territoryOverlapErrors: 0,
            queenCorruptionErrors: 0,
            hiveConstructionErrors: 0,
            parasiteControlErrors: 0,
            totalRecoveryAttempts: 0,
            successfulRecoveries: 0,
            lastValidationTime: 0
        };
        
        this.startValidationTimer();
        this.log('ErrorRecoveryManager initialized');
    }

    /**
     * Start periodic validation timer
     */
    private startValidationTimer(): void {
        if (this.validationTimer) {
            clearInterval(this.validationTimer);
        }
        
        this.validationTimer = setInterval(() => {
            this.performSystemValidation();
        }, this.config.validationIntervalMs);
    }

    /**
     * Perform comprehensive system validation
     */
    public performSystemValidation(): void {
        const startTime = performance.now();
        this.lastValidationTime = startTime;
        this.stats.lastValidationTime = startTime;
        
        this.log('Starting system validation...');
        
        // 1. Territory overlap detection
        this.detectTerritoryOverlaps();
        
        // 2. Queen lifecycle corruption detection
        this.detectQueenCorruption();
        
        // 3. Hive construction failure detection
        this.detectHiveConstructionFailures();
        
        // 4. Parasite control consistency validation
        this.validateParasiteControl();
        
        // 5. Process recovery attempts
        this.processRecoveryAttempts();
        
        const endTime = performance.now();
        this.log(`System validation completed in ${(endTime - startTime).toFixed(2)}ms`);
    }

    /**
     * Detect territory overlaps and schedule correction
     */
    private detectTerritoryOverlaps(): void {
        const territories = this.territoryManager.getAllTerritories();
        if (!territories || !Array.isArray(territories)) {
            return; // Handle null/undefined territories gracefully
        }
        
        const overlapsFound: TerritoryOverlapError[] = [];
        
        // Check all territory pairs for overlaps
        for (let i = 0; i < territories.length; i++) {
            for (let j = i + 1; j < territories.length; j++) {
                const territory1 = territories[i];
                const territory2 = territories[j];
                
                const overlapArea = this.calculateTerritoryOverlap(territory1, territory2);
                if (overlapArea > 0) {
                    const errorKey = `${territory1.id}_${territory2.id}`;
                    
                    if (!this.territoryOverlapErrors.has(errorKey)) {
                        const error: TerritoryOverlapError = {
                            territory1,
                            territory2,
                            overlapArea,
                            detectedAt: performance.now()
                        };
                        
                        this.territoryOverlapErrors.set(errorKey, error);
                        overlapsFound.push(error);
                        this.stats.territoryOverlapErrors++;
                        
                        this.log(`Territory overlap detected: ${territory1.id} and ${territory2.id} (${overlapArea.toFixed(2)} sq units)`);
                    }
                }
            }
        }
        
        // Schedule corrections for new overlaps
        for (const error of overlapsFound) {
            this.scheduleTerritoryCorrectionAttempt(error);
        }
    }

    /**
     * Calculate overlap area between two territories
     */
    private calculateTerritoryOverlap(territory1: Territory, territory2: Territory): number {
        const bounds1 = territory1.chunkBounds;
        const bounds2 = territory2.chunkBounds;
        
        // Calculate intersection rectangle
        const intersectionMinX = Math.max(bounds1.minX, bounds2.minX);
        const intersectionMaxX = Math.min(bounds1.maxX, bounds2.maxX);
        const intersectionMinZ = Math.max(bounds1.minZ, bounds2.minZ);
        const intersectionMaxZ = Math.min(bounds1.maxZ, bounds2.maxZ);
        
        // Check if there's an actual intersection
        if (intersectionMinX >= intersectionMaxX || intersectionMinZ >= intersectionMaxZ) {
            return 0; // No overlap
        }
        
        // Calculate overlap area
        const overlapWidth = intersectionMaxX - intersectionMinX;
        const overlapHeight = intersectionMaxZ - intersectionMinZ;
        return overlapWidth * overlapHeight;
    }

    /**
     * Schedule territory overlap correction attempt
     */
    private scheduleTerritoryCorrectionAttempt(error: TerritoryOverlapError): void {
        setTimeout(() => {
            this.attemptTerritoryOverlapCorrection(error);
        }, this.config.retryDelayMs);
    }

    /**
     * Attempt to correct territory overlap
     */
    private attemptTerritoryOverlapCorrection(error: TerritoryOverlapError): void {
        this.stats.totalRecoveryAttempts++;
        
        try {
            // Strategy: Recalculate territory boundaries to ensure proper alignment
            const territory1 = error.territory1;
            const territory2 = error.territory2;
            
            // Recalculate boundaries for both territories
            const territoryGrid = (this.territoryManager as any).territoryGrid;
            if (territoryGrid) {
                // Recalculate chunk bounds for territory1
                const newBounds1 = territoryGrid.calculateChunkBounds(
                    territory1.centerPosition.x,
                    territory1.centerPosition.z
                );
                territory1.chunkBounds = newBounds1;
                
                // Recalculate chunk bounds for territory2
                const newBounds2 = territoryGrid.calculateChunkBounds(
                    territory2.centerPosition.x,
                    territory2.centerPosition.z
                );
                territory2.chunkBounds = newBounds2;
                
                // Verify correction was successful
                const remainingOverlap = this.calculateTerritoryOverlap(territory1, territory2);
                if (remainingOverlap === 0) {
                    // Correction successful
                    const errorKey = `${territory1.id}_${territory2.id}`;
                    this.territoryOverlapErrors.delete(errorKey);
                    this.stats.successfulRecoveries++;
                    
                    this.log(`Territory overlap corrected: ${territory1.id} and ${territory2.id}`);
                } else {
                    this.log(`Territory overlap correction failed: ${territory1.id} and ${territory2.id} (${remainingOverlap.toFixed(2)} sq units remaining)`);
                }
            }
        } catch (correctionError) {
            this.log(`Error during territory overlap correction: ${correctionError}`);
        }
    }

    /**
     * Detect Queen lifecycle corruption
     */
    private detectQueenCorruption(): void {
        const queens = this.territoryManager.getAllQueens();
        if (!queens || !Array.isArray(queens)) {
            return; // Handle null/undefined queens gracefully
        }
        
        const corruptionsFound: QueenCorruptionError[] = [];
        
        for (const queen of queens) {
            if (!queen || !queen.isActiveQueen()) {
                continue; // Skip null/undefined or inactive queens
            }
            
            const currentPhase = queen.getCurrentPhase();
            const corruption = this.validateQueenState(queen, currentPhase);
            
            if (corruption) {
                const errorKey = queen.id;
                
                if (!this.queenCorruptionErrors.has(errorKey)) {
                    this.queenCorruptionErrors.set(errorKey, corruption);
                    corruptionsFound.push(corruption);
                    this.stats.queenCorruptionErrors++;
                    
                    this.log(`Queen corruption detected: ${queen.id} - ${corruption.corruptionType}`);
                }
            }
        }
        
        // Schedule recovery for new corruptions
        for (const error of corruptionsFound) {
            this.scheduleQueenRecoveryAttempt(error);
        }
    }

    /**
     * Validate Queen state and detect corruption
     */
    private validateQueenState(queen: Queen, currentPhase: QueenPhase): QueenCorruptionError | null {
        const currentTime = performance.now();
        
        // Check for invalid vulnerability state
        if (currentPhase === QueenPhase.UNDERGROUND_GROWTH && queen.isVulnerable()) {
            return {
                queen,
                expectedPhase: currentPhase,
                actualPhase: currentPhase,
                corruptionType: 'invalid_vulnerability',
                detectedAt: currentTime
            };
        }
        
        // Check for missing hive during active control
        if (currentPhase === QueenPhase.ACTIVE_CONTROL && !queen.getHive()) {
            return {
                queen,
                expectedPhase: currentPhase,
                actualPhase: currentPhase,
                corruptionType: 'missing_hive',
                detectedAt: currentTime
            };
        }
        
        // Check for stuck growth phase (growth should complete within reasonable time)
        if (currentPhase === QueenPhase.UNDERGROUND_GROWTH) {
            const growthTimeRemaining = queen.getGrowthTimeRemaining();
            const growthProgress = queen.getGrowthProgress();
            
            // If growth progress hasn't changed in a long time, it might be stuck
            if (growthProgress < 1.0 && growthTimeRemaining <= 0) {
                return {
                    queen,
                    expectedPhase: QueenPhase.HIVE_CONSTRUCTION,
                    actualPhase: currentPhase,
                    corruptionType: 'stuck_growth',
                    detectedAt: currentTime
                };
            }
        }
        
        return null; // No corruption detected
    }

    /**
     * Schedule Queen recovery attempt
     */
    private scheduleQueenRecoveryAttempt(error: QueenCorruptionError): void {
        setTimeout(() => {
            this.attemptQueenRecovery(error);
        }, this.config.retryDelayMs);
    }

    /**
     * Attempt to recover corrupted Queen
     */
    private attemptQueenRecovery(error: QueenCorruptionError): void {
        const queenId = error.queen.id;
        const attemptCount = (this.queenRecoveryAttempts.get(queenId) || 0) + 1;
        this.queenRecoveryAttempts.set(queenId, attemptCount);
        this.stats.totalRecoveryAttempts++;
        
        if (attemptCount > this.config.maxRetryAttempts) {
            this.log(`Queen recovery max attempts reached for ${queenId}, giving up`);
            return;
        }
        
        try {
            let recoverySuccessful = false;
            
            switch (error.corruptionType) {
                case 'invalid_vulnerability':
                    // Force Queen back to proper invulnerable state during growth
                    if (error.queen.getCurrentPhase() === QueenPhase.UNDERGROUND_GROWTH) {
                        // Reset Queen position to underground
                        error.queen.position.y = -10;
                        recoverySuccessful = true;
                        this.log(`Queen ${queenId} vulnerability state corrected`);
                    }
                    break;
                    
                case 'missing_hive':
                    // Force hive creation for Queen in active control
                    if (error.queen.getCurrentPhase() === QueenPhase.ACTIVE_CONTROL) {
                        // Trigger hive construction phase again
                        (error.queen as any).startHiveConstruction?.();
                        recoverySuccessful = true;
                        this.log(`Queen ${queenId} hive construction restarted`);
                    }
                    break;
                    
                case 'stuck_growth':
                    // Force growth completion
                    (error.queen as any).growthProgress = 1.0;
                    (error.queen as any).startHiveConstruction?.();
                    recoverySuccessful = true;
                    this.log(`Queen ${queenId} stuck growth phase forced to completion`);
                    break;
                    
                case 'invalid_phase':
                    // Reset Queen to appropriate phase based on current state
                    const hive = error.queen.getHive();
                    if (hive && hive.isHiveConstructed()) {
                        (error.queen as any).currentPhase = QueenPhase.ACTIVE_CONTROL;
                    } else if (hive) {
                        (error.queen as any).currentPhase = QueenPhase.HIVE_CONSTRUCTION;
                    } else {
                        (error.queen as any).currentPhase = QueenPhase.UNDERGROUND_GROWTH;
                    }
                    recoverySuccessful = true;
                    this.log(`Queen ${queenId} phase corrected to ${(error.queen as any).currentPhase}`);
                    break;
            }
            
            if (recoverySuccessful) {
                this.queenCorruptionErrors.delete(queenId);
                this.queenRecoveryAttempts.delete(queenId);
                this.stats.successfulRecoveries++;
            } else {
                // Schedule another attempt
                this.scheduleQueenRecoveryAttempt(error);
            }
            
        } catch (recoveryError) {
            this.log(`Error during Queen recovery: ${recoveryError}`);
            // Schedule another attempt
            this.scheduleQueenRecoveryAttempt(error);
        }
    }

    /**
     * Detect hive construction failures
     */
    private detectHiveConstructionFailures(): void {
        const territories = this.territoryManager.getAllTerritories();
        if (!territories || !Array.isArray(territories)) {
            return; // Handle null/undefined territories gracefully
        }
        
        const failuresFound: HiveConstructionError[] = [];
        
        for (const territory of territories) {
            if (!territory) {
                continue; // Skip null/undefined territories
            }
            
            const queen = territory.queen;
            const hive = territory.hive;
            
            if (!queen || !queen.isActiveQueen()) {
                continue;
            }
            
            // Check for construction timeout
            if (queen.getCurrentPhase() === QueenPhase.HIVE_CONSTRUCTION && hive) {
                const constructionTimeRemaining = hive.getConstructionTimeRemaining();
                const constructionProgress = hive.getConstructionProgress();
                
                // If construction has been running too long without progress
                if (constructionProgress < 1.0 && constructionTimeRemaining <= -5) { // 5 seconds overtime
                    const errorKey = hive.id;
                    
                    if (!this.hiveConstructionErrors.has(errorKey)) {
                        const error: HiveConstructionError = {
                            hive,
                            errorType: 'timeout',
                            attemptCount: 0,
                            lastAttemptAt: performance.now()
                        };
                        
                        this.hiveConstructionErrors.set(errorKey, error);
                        failuresFound.push(error);
                        this.stats.hiveConstructionErrors++;
                        
                        this.log(`Hive construction timeout detected: ${hive.id}`);
                    }
                }
            }
            
            // Check for missing hive when Queen is in construction phase
            if (queen.getCurrentPhase() === QueenPhase.HIVE_CONSTRUCTION && !hive) {
                const errorKey = `missing_hive_${queen.id}`;
                
                if (!this.hiveConstructionErrors.has(errorKey)) {
                    const error: HiveConstructionError = {
                        hive: null as any, // Will be created during recovery
                        errorType: 'missing_queen',
                        attemptCount: 0,
                        lastAttemptAt: performance.now()
                    };
                    
                    this.hiveConstructionErrors.set(errorKey, error);
                    failuresFound.push(error);
                    this.stats.hiveConstructionErrors++;
                    
                    this.log(`Missing hive detected for Queen: ${queen.id}`);
                }
            }
        }
        
        // Schedule recovery for new failures
        for (const error of failuresFound) {
            this.scheduleHiveRecoveryAttempt(error);
        }
    }

    /**
     * Schedule hive construction recovery attempt
     */
    private scheduleHiveRecoveryAttempt(error: HiveConstructionError): void {
        setTimeout(() => {
            this.attemptHiveRecovery(error);
        }, this.config.retryDelayMs);
    }

    /**
     * Attempt to recover failed hive construction
     */
    private attemptHiveRecovery(error: HiveConstructionError): void {
        const errorKey = error.hive?.id || `missing_hive_${error.lastAttemptAt}`;
        const attemptCount = (this.hiveRetryAttempts.get(errorKey) || 0) + 1;
        this.hiveRetryAttempts.set(errorKey, attemptCount);
        this.stats.totalRecoveryAttempts++;
        
        if (attemptCount > this.config.maxRetryAttempts) {
            this.log(`Hive recovery max attempts reached for ${errorKey}, giving up`);
            return;
        }
        
        try {
            let recoverySuccessful = false;
            
            switch (error.errorType) {
                case 'timeout':
                    // Force construction completion
                    if (error.hive) {
                        (error.hive as any).constructionProgress = 1.0;
                        (error.hive as any).isConstructed = true;
                        (error.hive as any).completeConstruction?.();
                        recoverySuccessful = true;
                        this.log(`Hive ${error.hive.id} construction forced to completion`);
                    }
                    break;
                    
                case 'missing_queen':
                    // Find Queen and create missing hive
                    const territories = this.territoryManager.getAllTerritories();
                    if (!territories || !Array.isArray(territories)) {
                        break; // Handle null/undefined territories gracefully
                    }
                    
                    for (const territory of territories) {
                        if (!territory) {
                            continue; // Skip null/undefined territories
                        }
                        
                        const queen = territory.queen;
                        if (queen && queen.getCurrentPhase() === QueenPhase.HIVE_CONSTRUCTION && !territory.hive) {
                            // Force hive creation
                            (queen as any).createHive?.();
                            recoverySuccessful = true;
                            this.log(`Missing hive created for Queen ${queen.id}`);
                            break;
                        }
                    }
                    break;
                    
                case 'construction_stuck':
                    // Restart construction process
                    if (error.hive) {
                        (error.hive as any).constructionStartTime = performance.now();
                        (error.hive as any).constructionProgress = 0.0;
                        (error.hive as any).constructionElapsedTime = 0.0;
                        recoverySuccessful = true;
                        this.log(`Hive ${error.hive.id} construction restarted`);
                    }
                    break;
                    
                case 'invalid_position':
                    // Select new hive location
                    if (error.hive) {
                        const queen = error.hive.getQueen();
                        (queen as any).selectHiveLocation?.();
                        recoverySuccessful = true;
                        this.log(`Hive ${error.hive.id} position corrected`);
                    }
                    break;
            }
            
            if (recoverySuccessful) {
                this.hiveConstructionErrors.delete(errorKey);
                this.hiveRetryAttempts.delete(errorKey);
                this.stats.successfulRecoveries++;
            } else {
                // Schedule another attempt
                error.attemptCount = attemptCount;
                error.lastAttemptAt = performance.now();
                this.scheduleHiveRecoveryAttempt(error);
            }
            
        } catch (recoveryError) {
            this.log(`Error during hive recovery: ${recoveryError}`);
            // Schedule another attempt
            error.attemptCount = attemptCount;
            error.lastAttemptAt = performance.now();
            this.scheduleHiveRecoveryAttempt(error);
        }
    }

    /**
     * Validate parasite control consistency
     */
    private validateParasiteControl(): void {
        const parasites = this.parasiteManager.getAllParasites();
        if (!parasites || !Array.isArray(parasites)) {
            return; // Handle null/undefined parasites gracefully
        }
        
        const errorsFound: ParasiteControlError[] = [];
        
        for (const parasite of parasites) {
            if (!parasite || !parasite.isAlive()) {
                continue; // Skip null/undefined or dead parasites
            }
            
            const parasitePosition = parasite.getPosition();
            const territory = this.territoryManager.getTerritoryAt(parasitePosition.x, parasitePosition.z);
            const parasiteId = parasite.getId();
            
            let error: ParasiteControlError | null = null;
            
            if (!territory) {
                // Parasite outside any territory
                error = {
                    parasiteId,
                    expectedQueenId: null,
                    actualQueenId: this.findQueenControllingParasite(parasiteId),
                    territoryId: 'none',
                    errorType: 'missing_territory',
                    detectedAt: performance.now()
                };
            } else {
                const expectedQueen = territory.queen;
                const actualQueenId = this.findQueenControllingParasite(parasiteId);
                
                if (!expectedQueen) {
                    // Territory has no Queen but parasite might be controlled
                    if (actualQueenId) {
                        error = {
                            parasiteId,
                            expectedQueenId: null,
                            actualQueenId,
                            territoryId: territory.id,
                            errorType: 'orphaned_parasite',
                            detectedAt: performance.now()
                        };
                    }
                } else {
                    // Territory has Queen - check control consistency
                    const expectedQueenId = expectedQueen.id;
                    
                    if (actualQueenId !== expectedQueenId) {
                        error = {
                            parasiteId,
                            expectedQueenId,
                            actualQueenId,
                            territoryId: territory.id,
                            errorType: actualQueenId ? 'wrong_queen' : 'orphaned_parasite',
                            detectedAt: performance.now()
                        };
                    }
                }
            }
            
            if (error) {
                const errorKey = parasiteId;
                
                if (!this.parasiteControlErrors.has(errorKey)) {
                    this.parasiteControlErrors.set(errorKey, error);
                    errorsFound.push(error);
                    this.stats.parasiteControlErrors++;
                    
                    this.log(`Parasite control error detected: ${parasiteId} - ${error.errorType}`);
                }
            }
        }
        
        // Process recovery for all control errors
        for (const error of errorsFound) {
            this.attemptParasiteControlRecovery(error);
        }
    }

    /**
     * Find which Queen is controlling a specific parasite
     */
    private findQueenControllingParasite(parasiteId: string): string | null {
        const territories = this.territoryManager.getAllTerritories();
        if (!territories || !Array.isArray(territories)) {
            return null; // Handle null/undefined territories gracefully
        }
        
        for (const territory of territories) {
            if (!territory) {
                continue; // Skip null/undefined territories
            }
            
            const queen = territory.queen;
            if (queen && queen.isActiveQueen()) {
                const controlledParasites = queen.getControlledParasites();
                if (controlledParasites && controlledParasites.includes(parasiteId)) {
                    return queen.id;
                }
            }
        }
        
        return null;
    }

    /**
     * Attempt to recover parasite control consistency
     */
    private attemptParasiteControlRecovery(error: ParasiteControlError): void {
        this.stats.totalRecoveryAttempts++;
        
        try {
            let recoverySuccessful = false;
            
            switch (error.errorType) {
                case 'orphaned_parasite':
                    // Assign parasite to correct Queen or remove from wrong Queen
                    if (error.expectedQueenId) {
                        const territory = this.territoryManager.getTerritory(error.territoryId);
                        const queen = territory?.queen;
                        if (queen && queen.isActiveQueen()) {
                            queen.addControlledParasite(error.parasiteId);
                            recoverySuccessful = true;
                            this.log(`Orphaned parasite ${error.parasiteId} assigned to Queen ${queen.id}`);
                        }
                    } else if (error.actualQueenId) {
                        // Remove from wrong Queen
                        const wrongQueen = this.findQueenById(error.actualQueenId);
                        if (wrongQueen) {
                            wrongQueen.removeControlledParasite(error.parasiteId);
                            recoverySuccessful = true;
                            this.log(`Parasite ${error.parasiteId} removed from wrong Queen ${error.actualQueenId}`);
                        }
                    }
                    break;
                    
                case 'wrong_queen':
                    // Transfer parasite to correct Queen
                    if (error.expectedQueenId && error.actualQueenId) {
                        const wrongQueen = this.findQueenById(error.actualQueenId);
                        const correctQueen = this.findQueenById(error.expectedQueenId);
                        
                        if (wrongQueen && correctQueen) {
                            wrongQueen.removeControlledParasite(error.parasiteId);
                            correctQueen.addControlledParasite(error.parasiteId);
                            recoverySuccessful = true;
                            this.log(`Parasite ${error.parasiteId} transferred from Queen ${error.actualQueenId} to Queen ${error.expectedQueenId}`);
                        }
                    }
                    break;
                    
                case 'missing_territory':
                    // Remove parasite from any Queen control since it's outside territories
                    if (error.actualQueenId) {
                        const queen = this.findQueenById(error.actualQueenId);
                        if (queen) {
                            queen.removeControlledParasite(error.parasiteId);
                            recoverySuccessful = true;
                            this.log(`Parasite ${error.parasiteId} removed from Queen control (outside territories)`);
                        }
                    }
                    break;
                    
                case 'duplicate_control':
                    // Remove duplicate control (keep only the correct Queen)
                    if (error.expectedQueenId) {
                        const territories = this.territoryManager.getAllTerritories();
                        if (!territories || !Array.isArray(territories)) {
                            break; // Handle null/undefined territories gracefully
                        }
                        
                        for (const territory of territories) {
                            if (!territory) {
                                continue; // Skip null/undefined territories
                            }
                            
                            const queen = territory.queen;
                            if (queen && queen.id !== error.expectedQueenId) {
                                const controlledParasites = queen.getControlledParasites();
                                if (controlledParasites.includes(error.parasiteId)) {
                                    queen.removeControlledParasite(error.parasiteId);
                                }
                            }
                        }
                        recoverySuccessful = true;
                        this.log(`Duplicate control removed for parasite ${error.parasiteId}`);
                    }
                    break;
            }
            
            if (recoverySuccessful) {
                this.parasiteControlErrors.delete(error.parasiteId);
                this.stats.successfulRecoveries++;
            }
            
        } catch (recoveryError) {
            this.log(`Error during parasite control recovery: ${recoveryError}`);
        }
    }

    /**
     * Find Queen by ID
     */
    private findQueenById(queenId: string): Queen | null {
        const territories = this.territoryManager.getAllTerritories();
        if (!territories || !Array.isArray(territories)) {
            return null; // Handle null/undefined territories gracefully
        }
        
        for (const territory of territories) {
            if (!territory) {
                continue; // Skip null/undefined territories
            }
            
            const queen = territory.queen;
            if (queen && queen.id === queenId) {
                return queen;
            }
        }
        
        return null;
    }

    /**
     * Process all pending recovery attempts
     */
    private processRecoveryAttempts(): void {
        // Process territory overlap corrections
        for (const error of this.territoryOverlapErrors.values()) {
            // Check if overlap still exists
            const currentOverlap = this.calculateTerritoryOverlap(error.territory1, error.territory2);
            if (currentOverlap === 0) {
                // Overlap resolved
                const errorKey = `${error.territory1.id}_${error.territory2.id}`;
                this.territoryOverlapErrors.delete(errorKey);
                this.stats.successfulRecoveries++;
            }
        }
        
        // Process Queen corruption recoveries
        for (const [queenId, error] of this.queenCorruptionErrors.entries()) {
            // Check if corruption still exists
            const currentCorruption = this.validateQueenState(error.queen, error.queen.getCurrentPhase());
            if (!currentCorruption) {
                // Corruption resolved
                this.queenCorruptionErrors.delete(queenId);
                this.queenRecoveryAttempts.delete(queenId);
                this.stats.successfulRecoveries++;
            }
        }
        
        // Process hive construction recoveries
        for (const [errorKey, error] of this.hiveConstructionErrors.entries()) {
            // Check if construction issue is resolved
            if (error.hive && error.hive.isHiveConstructed()) {
                // Construction completed
                this.hiveConstructionErrors.delete(errorKey);
                this.hiveRetryAttempts.delete(errorKey);
                this.stats.successfulRecoveries++;
            }
        }
    }

    /**
     * Get error recovery statistics
     */
    public getStats(): ErrorRecoveryStats {
        return { ...this.stats };
    }

    /**
     * Get current error counts
     */
    public getCurrentErrors(): {
        territoryOverlaps: number;
        queenCorruptions: number;
        hiveConstructionFailures: number;
        parasiteControlErrors: number;
    } {
        return {
            territoryOverlaps: this.territoryOverlapErrors.size,
            queenCorruptions: this.queenCorruptionErrors.size,
            hiveConstructionFailures: this.hiveConstructionErrors.size,
            parasiteControlErrors: this.parasiteControlErrors.size
        };
    }

    /**
     * Force immediate validation and recovery
     */
    public forceValidation(): void {
        this.performSystemValidation();
    }

    /**
     * Clear all error tracking (for testing)
     */
    public clearErrors(): void {
        this.territoryOverlapErrors.clear();
        this.queenCorruptionErrors.clear();
        this.hiveConstructionErrors.clear();
        this.parasiteControlErrors.clear();
        this.hiveRetryAttempts.clear();
        this.queenRecoveryAttempts.clear();
        
        // Reset stats
        this.stats.territoryOverlapErrors = 0;
        this.stats.queenCorruptionErrors = 0;
        this.stats.hiveConstructionErrors = 0;
        this.stats.parasiteControlErrors = 0;
    }

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<ErrorRecoveryConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Restart validation timer if interval changed
        if (newConfig.validationIntervalMs) {
            this.startValidationTimer();
        }
    }

    /**
     * Log message if logging is enabled
     */
    private log(message: string): void {
        if (this.config.enableLogging) {
            console.log(`🔧 ErrorRecovery: ${message}`);
        }
    }

    /**
     * Dispose error recovery manager
     */
    public dispose(): void {
        if (this.validationTimer) {
            clearInterval(this.validationTimer);
            this.validationTimer = null;
        }
        
        this.clearErrors();
        this.log('ErrorRecoveryManager disposed');
    }
}