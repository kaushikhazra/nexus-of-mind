/**
 * ParasiteManager - Manages energy and combat parasite spawning and lifecycle
 * 
 * Enhanced Implementation:
 * - Spawns both Energy and Combat parasites with 75/25 distribution
 * - Uses DistributionTracker to maintain spawn ratios
 * - Factory pattern for creating different parasite types
 * - Manages parasite lifecycle and cleanup
 * - Handles combat interactions with protectors
 * - Integrates with existing game systems
 */

import { Scene, Vector3 } from '@babylonjs/core';
import { EnergyParasite, EnergyParasiteConfig } from './entities/EnergyParasite';
import { CombatParasite, CombatParasiteConfig } from './entities/CombatParasite';
import { MineralDeposit } from '../world/MineralDeposit';
import { MaterialManager } from '../rendering/MaterialManager';
import { Worker } from './entities/Worker';
import { Protector } from './entities/Protector';
import { DistributionTracker } from './types/DistributionTracker';
import { ParasiteType, DEFAULT_SPAWN_DISTRIBUTION } from './types/ParasiteTypes';
import { TerritoryManager, Territory } from './TerritoryManager';
import { Queen } from './entities/Queen';
import { SpatialIndex } from './SpatialIndex';
import { GameEngine } from './GameEngine';
import { StrategyExecutor } from './systems/StrategyExecutor';
import { SpawnDecision, SwarmBehavior, TargetPriority, FormationType } from './types/StrategyTypes';

export interface TerritorialParasiteConfig {
    territory: Territory;
    queen: Queen | null;
    spawnStrategy: 'defensive' | 'aggressive' | 'balanced';
    spawnRate: number; // Multiplier for base spawn rate
}

export interface ParasiteManagerConfig {
    scene: Scene;
    materialManager: MaterialManager;
    terrainGenerator?: any; // Optional terrain generator for height detection
}

export interface ParasiteSpawnConfig {
    baseSpawnInterval: number;    // Base time between spawns (ms)
    maxParasitesPerDeposit: number; // Max parasites per mineral deposit
    spawnRadius: number;          // How close to deposit to spawn
    activeMiningMultiplier: number; // Spawn rate multiplier when workers present
}

// Pending respawn tracking
interface PendingRespawn {
    parasiteId: string;
    deathTime: number;
    respawnPosition: Vector3;
}

export class ParasiteManager {
    private scene: Scene;
    private materialManager: MaterialManager;
    private terrainGenerator: any = null;
    private parasites: Map<string, EnergyParasite | CombatParasite> = new Map();
    
    // Territory integration
    private territoryManager: TerritoryManager | null = null;
    private territorialConfigs: Map<string, TerritorialParasiteConfig> = new Map();
    
    // Distribution tracking for spawn ratios
    private distributionTracker: DistributionTracker;

    // Respawn configuration
    private readonly RESPAWN_DELAY = 30000; // 30 seconds delay before respawn
    private readonly RESPAWN_DISTANCE = 15; // 15 meters away from death point
    private pendingRespawns: PendingRespawn[] = [];

    // Spawning configuration
    private spawnConfig: ParasiteSpawnConfig = {
        baseSpawnInterval: 0,        // Immediate spawn - no delay!
        maxParasitesPerDeposit: 1,   // Max 1 parasite per deposit
        spawnRadius: 65,             // Spawn 65 units from deposit (outside 50-unit detection range)
        activeMiningMultiplier: 1.5  // Only slightly faster when workers mining
    };

    // Spawn tracking
    private lastSpawnAttempt: Map<string, number> = new Map(); // depositId -> timestamp
    private depositParasiteCount: Map<string, number> = new Map(); // depositId -> count
    
    // Enhanced type tracking for performance optimization
    private parasiteCountByType: Map<ParasiteType, number> = new Map();
    private parasitesByDeposit: Map<string, Set<string>> = new Map(); // depositId -> Set<parasiteId>
    
    // Performance optimization tracking
    private lastPerformanceCheck: number = 0;
    private readonly PERFORMANCE_CHECK_INTERVAL = 1000; // Check every second
    private renderingOptimizationLevel: number = 0; // 0 = no optimization, 1 = basic, 2 = aggressive
    private maxActiveParasites: number = 10; // Dynamic limit based on performance

    // Strategy executor for AI-controlled spawning and behavior
    private strategyExecutor: StrategyExecutor | null = null;
    private currentSwarmBehavior: SwarmBehavior | null = null;

    constructor(config: ParasiteManagerConfig) {
        this.scene = config.scene;
        this.materialManager = config.materialManager;
        this.terrainGenerator = config.terrainGenerator || null;
        
        // Initialize distribution tracker with default 75/25 ratio
        this.distributionTracker = new DistributionTracker(DEFAULT_SPAWN_DISTRIBUTION);
        
        // Initialize type tracking
        this.parasiteCountByType.set(ParasiteType.ENERGY, 0);
        this.parasiteCountByType.set(ParasiteType.COMBAT, 0);
        
        // Initialize performance tracking
        this.lastPerformanceCheck = Date.now();
        
        // ParasiteManager initialized with distribution tracking
    }
    
    /**
     * Update terrain generator for existing parasites
     */
    public setTerrainGenerator(terrainGenerator: any): void {
        this.terrainGenerator = terrainGenerator;

        // Update existing parasites
        for (const parasite of this.parasites.values()) {
            parasite.setTerrainGenerator(terrainGenerator);
        }

        // ParasiteManager terrain generator updated
    }

    /**
     * Set strategy executor for AI-controlled spawning and behavior
     */
    public setStrategyExecutor(executor: StrategyExecutor): void {
        this.strategyExecutor = executor;

        // Subscribe to spawn decisions
        executor.setOnSpawnDecision((decision: SpawnDecision) => {
            this.handleStrategySpawn(decision);
        });

        // Subscribe to swarm behavior changes
        executor.setOnSwarmBehaviorChange((behavior: SwarmBehavior) => {
            this.handleSwarmBehaviorChange(behavior);
        });

        console.log('[ParasiteManager] ✅ Strategy executor connected');
    }

    /**
     * Handle spawn decision from strategy executor
     */
    private handleStrategySpawn(decision: SpawnDecision): void {
        // Convert Position (x, y) to Vector3 (x, 0, z) - y becomes z in 3D space
        const spawnCenter = new Vector3(decision.position.x, 0, decision.position.y);

        console.log(`[ParasiteManager] 🎯 Strategy spawn: ${decision.count} parasites at (${spawnCenter.x.toFixed(1)}, ${spawnCenter.z.toFixed(1)})`);

        // Find the nearest territory/queen for this spawn
        const territory = this.findNearestTerritory(spawnCenter);
        if (!territory || !territory.queen) {
            console.warn('[ParasiteManager] No territory/queen found for strategy spawn');
            return;
        }

        // Spawn parasites at the strategy-specified location
        for (let i = 0; i < decision.count; i++) {
            // Add small random offset for each parasite in burst
            const offset = new Vector3(
                (Math.random() - 0.5) * 10,
                0,
                (Math.random() - 0.5) * 10
            );
            const spawnPos = spawnCenter.add(offset);

            this.spawnParasiteAtPosition(spawnPos, territory, territory.queen);
        }
    }

    /**
     * Spawn a parasite at a specific position (for strategy-controlled spawning)
     */
    private spawnParasiteAtPosition(position: Vector3, territory: Territory, queen: Queen): void {
        // Determine type based on current swarm behavior
        let parasiteType: ParasiteType;
        if (this.currentSwarmBehavior) {
            // Higher aggression = more combat parasites
            const combatChance = 0.25 + (this.currentSwarmBehavior.aggression * 0.5); // 25-75%
            parasiteType = Math.random() < combatChance ? ParasiteType.COMBAT : ParasiteType.ENERGY;
        } else {
            parasiteType = this.distributionTracker.getNextParasiteType();
        }

        // Find nearest deposit for home assignment
        const nearestDeposit = this.findNearestDeposit(position);
        if (!nearestDeposit) {
            console.warn('[ParasiteManager] No deposit found for strategy spawn');
            return;
        }

        // Create parasite
        const parasite = this.createParasite(parasiteType, {
            position: position,
            scene: this.scene,
            materialManager: this.materialManager,
            homeDeposit: nearestDeposit
        });

        if (this.terrainGenerator) {
            parasite.setTerrainGenerator(this.terrainGenerator);
        }

        this.parasites.set(parasite.getId(), parasite);

        // Add to spatial index
        const gameEngine = GameEngine.getInstance();
        const spatialIndex = gameEngine?.getSpatialIndex();
        if (spatialIndex) {
            const entityType = parasiteType === ParasiteType.COMBAT ? 'combat_parasite' : 'parasite';
            spatialIndex.add(parasite.getId(), position, entityType);
        }

        // Add to Queen control
        queen.addControlledParasite(parasite.getId());

        // Apply current swarm behavior to new parasite
        if (this.currentSwarmBehavior) {
            this.applyBehaviorToParasite(parasite, this.currentSwarmBehavior);
        }

        // Update tracking
        this.distributionTracker.recordSpawn(parasiteType, nearestDeposit.getId());
        const currentTypeCount = this.parasiteCountByType.get(parasiteType) || 0;
        this.parasiteCountByType.set(parasiteType, currentTypeCount + 1);
    }

    /**
     * Handle swarm behavior change from strategy executor
     */
    private handleSwarmBehaviorChange(behavior: SwarmBehavior): void {
        console.log(`[ParasiteManager] 🐝 Swarm behavior updated: aggression=${(behavior.aggression * 100).toFixed(0)}%, target=${behavior.targetPriority}, formation=${behavior.formation}`);

        this.currentSwarmBehavior = behavior;

        // Apply to all existing parasites
        for (const parasite of this.parasites.values()) {
            this.applyBehaviorToParasite(parasite, behavior);
        }
    }

    /**
     * Apply swarm behavior to a single parasite
     */
    private applyBehaviorToParasite(parasite: EnergyParasite | CombatParasite, behavior: SwarmBehavior): void {
        // Set aggression level (affects attack range and pursuit)
        if ('setAggression' in parasite) {
            (parasite as any).setAggression(behavior.aggression);
        }

        // Set target priority
        if ('setTargetPriority' in parasite) {
            (parasite as any).setTargetPriority(behavior.targetPriority);
        }

        // Set formation behavior
        if ('setFormation' in parasite) {
            (parasite as any).setFormation(behavior.formation);
        }
    }

    /**
     * Find nearest territory to a position
     */
    private findNearestTerritory(position: Vector3): Territory | null {
        if (!this.territoryManager) return null;

        const territories = this.territoryManager.getAllTerritories();
        let nearest: Territory | null = null;
        let nearestDist = Infinity;

        for (const territory of territories) {
            const dist = Vector3.Distance(position, territory.centerPosition);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = territory;
            }
        }

        return nearest;
    }

    /**
     * Find nearest mineral deposit to a position
     */
    private findNearestDeposit(position: Vector3): MineralDeposit | null {
        // Get all deposits from tracked parasites' home deposits
        let nearest: MineralDeposit | null = null;
        let nearestDist = Infinity;

        // First try to get deposits from existing parasites
        for (const parasite of this.parasites.values()) {
            const deposit = parasite.getHomeDeposit();
            if (deposit) {
                const dist = Vector3.Distance(position, deposit.getPosition());
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = deposit;
                }
            }
        }

        // If no parasites exist yet, use the last spawn attempt deposits
        if (!nearest && this.lastSpawnAttempt.size > 0) {
            // Return null - will be handled by caller
            return null;
        }

        return nearest;
    }

    /**
     * Update all parasites and handle spawning
     */
    public update(deltaTime: number, mineralDeposits: MineralDeposit[], workers: Worker[], protectors: Protector[]): void {
        const currentTime = Date.now();

        // Update existing parasites (pass protectors to Combat Parasites)
        this.updateParasites(deltaTime, workers, protectors);

        // Get camera position to prioritize nearby deposits for spawning
        const gameEngine = GameEngine.getInstance();
        const cameraController = gameEngine?.getCameraController();
        const camera = cameraController?.getCamera();
        const cameraTarget = camera?.getTarget() || new Vector3(0, 0, 0);

        // Filter to visible, non-depleted deposits and sort by distance to camera
        const nearbyDeposits = mineralDeposits
            .filter(d => d.isVisible() && !d.isDepleted())
            .map(d => ({
                deposit: d,
                distance: Vector3.Distance(d.getPosition(), cameraTarget)
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 20) // Only process 20 nearest deposits
            .map(item => item.deposit);

        // Handle spawning for nearby deposits only
        for (const deposit of nearbyDeposits) {
            this.updateSpawning(deposit, workers, currentTime);
        }

        // Process pending respawns
        this.processPendingRespawns(currentTime);

        // Clean up dead parasites (adds them to pending respawn queue)
        this.cleanupDeadParasites();
        
        // Periodic cleanup of orphaned tracking data (every 10 seconds)
        if (Math.floor(currentTime / 10000) !== Math.floor((currentTime - deltaTime * 1000) / 10000)) {
            this.cleanupOrphanedTracking();
        }
        
        // Performance monitoring and optimization (every second)
        if (currentTime - this.lastPerformanceCheck >= this.PERFORMANCE_CHECK_INTERVAL) {
            this.checkAndOptimizePerformance();
            this.lastPerformanceCheck = currentTime;
        }
    }

    /**
     * Process pending respawns after delay has passed
     */
    private processPendingRespawns(currentTime: number): void {
        const readyToRespawn: PendingRespawn[] = [];
        const stillPending: PendingRespawn[] = [];

        for (const pending of this.pendingRespawns) {
            if (currentTime - pending.deathTime >= this.RESPAWN_DELAY) {
                readyToRespawn.push(pending);
            } else {
                stillPending.push(pending);
            }
        }

        // Update pending list
        this.pendingRespawns = stillPending;

        // Process respawns
        for (const pending of readyToRespawn) {
            const parasite = this.parasites.get(pending.parasiteId);
            if (parasite) {
                parasite.respawn(pending.respawnPosition);
                
                // Update tracking when parasite respawns
                const parasiteType = parasite instanceof CombatParasite ? ParasiteType.COMBAT : ParasiteType.ENERGY;
                const depositId = parasite.getHomeDeposit().getId();
                
                // Update deposit tracking
                const currentCount = this.depositParasiteCount.get(depositId) || 0;
                this.depositParasiteCount.set(depositId, currentCount + 1);
                
                // Update type tracking
                const currentTypeCount = this.parasiteCountByType.get(parasiteType) || 0;
                this.parasiteCountByType.set(parasiteType, currentTypeCount + 1);
                
                // Update deposit-specific tracking
                if (!this.parasitesByDeposit.has(depositId)) {
                    this.parasitesByDeposit.set(depositId, new Set());
                }
                this.parasitesByDeposit.get(depositId)!.add(parasite.getId());
                
                // Re-add to spatial index after respawn
                const gameEngine = GameEngine.getInstance();
                const spatialIndex = gameEngine?.getSpatialIndex();
                if (spatialIndex) {
                    const parasiteEntityType = parasiteType === ParasiteType.COMBAT ? 'combat_parasite' : 'parasite';
                    spatialIndex.add(parasite.getId(), pending.respawnPosition, parasiteEntityType);
                }

                // Add to Queen control if respawning in a Queen-controlled territory
                if (this.territoryManager) {
                    const respawnPosition = pending.respawnPosition;
                    const territory = this.territoryManager.getTerritoryAt(respawnPosition.x, respawnPosition.z);
                    if (territory?.queen && territory.queen.isActiveQueen()) {
                        territory.queen.addControlledParasite(parasite.getId());
                    }
                }
            }
        }
    }
    
    /**
     * Update parasites near the camera using spatial index for O(1) chunk lookups
     * Only parasites within nearby chunks are updated - distant parasites are skipped
     */
    private updateParasites(deltaTime: number, workers: Worker[], protectors: Protector[]): void {
        // Early exit if no parasites
        if (this.parasites.size === 0) {
            return;
        }

        // Get game engine and spatial index
        const gameEngine = GameEngine.getInstance();
        const spatialIndex = gameEngine?.getSpatialIndex();
        const cameraController = gameEngine?.getCameraController();
        const cameraTarget = cameraController?.getCamera()?.getTarget();

        if (!cameraTarget) {
            return;
        }

        // Build ID->Object maps for O(1) lookups (done once per frame)
        const workerMap = new Map<string, Worker>();
        for (const worker of workers) {
            workerMap.set(worker.getId(), worker);
        }
        const protectorMap = new Map<string, Protector>();
        for (const protector of protectors) {
            protectorMap.set(protector.getId(), protector);
        }

        // Get parasites in nearby chunks using spatial index (3x3 chunk area = 192x192 units)
        let parasiteIdsToUpdate: string[] = [];

        if (spatialIndex) {
            // Use spatial index to get parasites in chunks near camera
            // Search radius covers ~3 chunks (192 units)
            parasiteIdsToUpdate = spatialIndex.getEntitiesInRange(
                cameraTarget,
                192, // 3 chunks radius
                ['parasite', 'combat_parasite']
            );
        } else {
            // Fallback: update all parasites if no spatial index
            parasiteIdsToUpdate = Array.from(this.parasites.keys());
        }

        // Update only nearby parasites
        for (const parasiteId of parasiteIdsToUpdate) {
            const parasite = this.parasites.get(parasiteId);

            if (!parasite || !parasite.isAlive()) {
                continue;
            }

            const parasitePosition = parasite.getTerritoryCenter();
            const searchRadius = parasite.getTerritoryRadius() * 1.5;

            let nearbyWorkers: Worker[] = [];
            let nearbyProtectors: Protector[] = [];

            // Use spatial index for O(1) lookups if available
            if (spatialIndex) {
                // Get nearby worker IDs from spatial index
                const workerIds = spatialIndex.getEntitiesInRange(parasitePosition, searchRadius, 'worker');
                nearbyWorkers = workerIds
                    .map(id => workerMap.get(id))
                    .filter((w): w is Worker => w !== undefined);

                // Get nearby protector IDs from spatial index
                const protectorIds = spatialIndex.getEntitiesInRange(parasitePosition, searchRadius, 'protector');
                nearbyProtectors = protectorIds
                    .map(id => protectorMap.get(id))
                    .filter((p): p is Protector => p !== undefined);
            } else {
                // Fallback to O(n) filtering if spatial index not available
                nearbyWorkers = workers.filter(worker => {
                    const distance = Vector3.Distance(worker.getPosition(), parasitePosition);
                    return distance <= searchRadius;
                });
                nearbyProtectors = protectors.filter(protector => {
                    const distance = Vector3.Distance(protector.getPosition(), parasitePosition);
                    return distance <= searchRadius;
                });
            }

            // Update parasite with appropriate targets
            if (parasite instanceof CombatParasite) {
                parasite.update(deltaTime, nearbyWorkers, nearbyProtectors);
            } else {
                parasite.update(deltaTime, nearbyWorkers);
            }

            // Update spatial index with new position
            if (spatialIndex) {
                spatialIndex.updatePosition(parasite.getId(), parasite.getPosition());
            }
        }
    }
    
    /**
     * Set territory manager for territorial control integration
     */
    public setTerritoryManager(territoryManager: TerritoryManager): void {
        this.territoryManager = territoryManager;
    }

    /**
     * Configure territorial spawning for a specific territory
     */
    public configureTerritorialSpawning(territoryId: string, config: TerritorialParasiteConfig): void {
        this.territorialConfigs.set(territoryId, config);
    }

    /**
     * Override spawning to respect territorial control
     */
    protected updateSpawning(deposit: MineralDeposit, workers: Worker[], currentTime: number): void {
        // Check if this deposit is in a territory
        const territory = this.territoryManager?.getTerritoryAt(deposit.getPosition().x, deposit.getPosition().z);
        
        if (territory) {
            // Use territorial spawning logic
            this.updateTerritorialSpawning(deposit, workers, currentTime, territory);
        } else {
            // Use original spawning logic for non-territorial areas
            this.updateOriginalSpawning(deposit, workers, currentTime);
        }
    }

    /**
     * Original spawning logic (renamed from updateSpawning)
     */
    private updateOriginalSpawning(deposit: MineralDeposit, workers: Worker[], currentTime: number): void {
        const depositId = deposit.getId();
        
        // Check performance limits first
        const activeParasiteCount = this.getParasites().length;
        if (activeParasiteCount >= this.maxActiveParasites) {
            return; // Don't spawn if at performance limit
        }
        
        // Check if we've reached max parasites for this deposit
        const currentCount = this.depositParasiteCount.get(depositId) || 0;
        if (currentCount >= this.spawnConfig.maxParasitesPerDeposit) {
            return;
        }
        
        // Check if enough time has passed since last spawn attempt
        let lastSpawn = this.lastSpawnAttempt.get(depositId);
        if (lastSpawn === undefined) {
            // First time seeing this deposit - randomly decide if this deposit can spawn parasites
            const canSpawnParasites = Math.random() < 0.375; // 37.5% chance (50% more parasites)
            
            if (!canSpawnParasites) {
                // Mark this deposit as non-spawning by setting a very high timestamp
                this.lastSpawnAttempt.set(depositId, Number.MAX_SAFE_INTEGER);
                return;
            }
            
            // This deposit can spawn parasites - set initial delay to prevent immediate spawning
            this.lastSpawnAttempt.set(depositId, currentTime);
            return; // Skip spawning this frame
        }
        
        // Skip deposits marked as non-spawning
        if (lastSpawn === Number.MAX_SAFE_INTEGER) {
            return;
        }
        
        // Calculate spawn interval based on activity and performance
        // Use spatial index for O(1) lookup if available
        const gameEngine = GameEngine.getInstance();
        const spatialIndex = gameEngine?.getSpatialIndex();
        let hasActiveMiners = false;

        if (spatialIndex) {
            const nearbyWorkerIds = spatialIndex.getEntitiesInRange(deposit.getPosition(), 20, 'worker');
            hasActiveMiners = nearbyWorkerIds.length > 0;
        } else {
            const workersNearDeposit = workers.filter(worker => {
                const distance = Vector3.Distance(worker.getPosition(), deposit.getPosition());
                return distance <= 20;
            });
            hasActiveMiners = workersNearDeposit.length > 0;
        }
        let spawnInterval = hasActiveMiners 
            ? this.spawnConfig.baseSpawnInterval / this.spawnConfig.activeMiningMultiplier
            : this.spawnConfig.baseSpawnInterval;
        
        // Increase spawn interval if performance optimization is active
        if (this.renderingOptimizationLevel > 0) {
            spawnInterval *= (1 + this.renderingOptimizationLevel * 0.5); // 50% longer per optimization level
        }
        
        if (currentTime - lastSpawn < spawnInterval) {
            return;
        }
        
        // Attempt to spawn parasite
        this.spawnParasite(deposit);
        this.lastSpawnAttempt.set(depositId, currentTime);
    }

    /**
     * Territorial spawning logic - respects Queen control and territory status
     */
    private updateTerritorialSpawning(deposit: MineralDeposit, workers: Worker[], currentTime: number, territory: Territory): void {
        const depositId = deposit.getId();
        
        // Don't spawn parasites in liberated territories (requirement 4.2)
        if (territory.controlStatus === 'liberated') {
            return;
        }
        
        // Check if territory has an active Queen
        const queen = territory.queen;
        if (!queen || !queen.isActiveQueen()) {
            // No active Queen - use original spawning logic but with reduced rate
            this.updateOriginalSpawning(deposit, workers, currentTime);
            return;
        }
        
        // Check performance limits first
        const activeParasiteCount = this.getParasites().length;
        if (activeParasiteCount >= this.maxActiveParasites) {
            return; // Don't spawn if at performance limit
        }
        
        // Get territorial configuration
        const territorialConfig = this.territorialConfigs.get(territory.id);
        const spawnRateMultiplier = territorialConfig?.spawnRate || 1.0;
        
        // Check if we've reached max parasites for this deposit
        const currentCount = this.depositParasiteCount.get(depositId) || 0;
        if (currentCount >= this.spawnConfig.maxParasitesPerDeposit) {
            return;
        }
        
        // Check if enough time has passed since last spawn attempt
        let lastSpawn = this.lastSpawnAttempt.get(depositId);
        if (lastSpawn === undefined) {
            // First time seeing this deposit in this territory
            // Queen-controlled territories have higher spawn probability
            const canSpawnParasites = Math.random() < 0.75; // 75% chance (higher than normal)
            
            if (!canSpawnParasites) {
                this.lastSpawnAttempt.set(depositId, Number.MAX_SAFE_INTEGER);
                return;
            }
            
            this.lastSpawnAttempt.set(depositId, currentTime);
            return;
        }
        
        // Skip deposits marked as non-spawning
        if (lastSpawn === Number.MAX_SAFE_INTEGER) {
            return;
        }
        
        // Calculate spawn interval based on Queen control and activity
        // Use spatial index for O(1) lookup if available
        const gameEngine = GameEngine.getInstance();
        const spatialIndex = gameEngine?.getSpatialIndex();
        let hasActiveMiners = false;

        if (spatialIndex) {
            const nearbyWorkerIds = spatialIndex.getEntitiesInRange(deposit.getPosition(), 20, 'worker');
            hasActiveMiners = nearbyWorkerIds.length > 0;
        } else {
            const workersNearDeposit = workers.filter(worker => {
                const distance = Vector3.Distance(worker.getPosition(), deposit.getPosition());
                return distance <= 20;
            });
            hasActiveMiners = workersNearDeposit.length > 0;
        }
        let spawnInterval = hasActiveMiners 
            ? this.spawnConfig.baseSpawnInterval / this.spawnConfig.activeMiningMultiplier
            : this.spawnConfig.baseSpawnInterval;
        
        // Apply territorial spawn rate multiplier
        spawnInterval = spawnInterval / spawnRateMultiplier;
        
        // Increase spawn interval if performance optimization is active
        if (this.renderingOptimizationLevel > 0) {
            spawnInterval *= (1 + this.renderingOptimizationLevel * 0.5);
        }
        
        if (currentTime - lastSpawn < spawnInterval) {
            return;
        }
        
        // Attempt to spawn parasite under Queen control
        this.spawnTerritorialParasite(deposit, territory, queen);
        this.lastSpawnAttempt.set(depositId, currentTime);
    }

    /**
     * Spawn a parasite under Queen control within a territory
     */
    private spawnTerritorialParasite(deposit: MineralDeposit, territory: Territory, queen: Queen): void {
        const depositPosition = deposit.getPosition();
        
        // Generate random spawn position near deposit
        const angle = Math.random() * Math.PI * 2;
        const distance = 5 + Math.random() * (this.spawnConfig.spawnRadius - 5);
        
        const spawnOffset = new Vector3(
            Math.cos(angle) * distance,
            0.5,
            Math.sin(angle) * distance
        );
        
        const spawnPosition = depositPosition.add(spawnOffset);
        
        // Get territorial configuration for spawn strategy
        const territorialConfig = this.territorialConfigs.get(territory.id);
        const spawnStrategy = territorialConfig?.spawnStrategy || 'balanced';
        
        // Determine parasite type based on spawn strategy
        let parasiteType: ParasiteType;
        switch (spawnStrategy) {
            case 'defensive':
                // More combat parasites for defense
                parasiteType = Math.random() < 0.6 ? ParasiteType.COMBAT : ParasiteType.ENERGY;
                break;
            case 'aggressive':
                // Even more combat parasites for aggression
                parasiteType = Math.random() < 0.8 ? ParasiteType.COMBAT : ParasiteType.ENERGY;
                break;
            case 'balanced':
            default:
                // Use distribution tracker for balanced spawning
                parasiteType = this.distributionTracker.getNextParasiteType();
                break;
        }
        
        // Create parasite using factory pattern
        const parasite = this.createParasite(parasiteType, {
            position: spawnPosition,
            scene: this.scene,
            materialManager: this.materialManager,
            homeDeposit: deposit
        });
        
        // Set terrain generator with fallback
        if (this.terrainGenerator) {
            parasite.setTerrainGenerator(this.terrainGenerator);
        }
        
        this.parasites.set(parasite.getId(), parasite);

        // Add to spatial index for O(1) lookups
        const gameEngine = GameEngine.getInstance();
        const spatialIndex = gameEngine?.getSpatialIndex();
        if (spatialIndex) {
            const parasiteEntityType = parasiteType === ParasiteType.COMBAT ? 'combat_parasite' : 'parasite';
            spatialIndex.add(parasite.getId(), spawnPosition, parasiteEntityType);
        }

        // Add parasite to Queen's control (requirement 2.3)
        queen.addControlledParasite(parasite.getId());
        
        // Record spawn in distribution tracker
        this.distributionTracker.recordSpawn(parasiteType, deposit.getId());
        
        // Update enhanced tracking
        const depositId = deposit.getId();
        const currentCount = this.depositParasiteCount.get(depositId) || 0;
        this.depositParasiteCount.set(depositId, currentCount + 1);
        
        // Update type tracking
        const currentTypeCount = this.parasiteCountByType.get(parasiteType) || 0;
        this.parasiteCountByType.set(parasiteType, currentTypeCount + 1);
        
        // Update deposit-specific tracking
        if (!this.parasitesByDeposit.has(depositId)) {
            this.parasitesByDeposit.set(depositId, new Set());
        }
        this.parasitesByDeposit.get(depositId)!.add(parasite.getId());
    }

    /**
     * Explode all parasites in a territory (requirement 2.6)
     */
    public explodeParasitesInTerritory(territoryId: string): void {
        if (!this.territoryManager) return;
        
        const territory = this.territoryManager.getTerritory(territoryId);
        if (!territory) return;
        
        const parasitesToExplode: string[] = [];
        
        // Find all parasites in the territory
        for (const [parasiteId, parasite] of this.parasites.entries()) {
            if (parasite.isAlive()) {
                const parasitePosition = parasite.getPosition();
                if (this.territoryManager.isPositionInTerritory(parasitePosition, territoryId)) {
                    parasitesToExplode.push(parasiteId);
                }
            }
        }
        
        // Remove all parasites in the territory immediately
        for (const parasiteId of parasitesToExplode) {
            const parasite = this.parasites.get(parasiteId);
            if (parasite) {
                // Remove from Queen control if applicable
                if (territory.queen) {
                    territory.queen.removeControlledParasite(parasiteId);
                }
                
                // Update tracking
                const parasiteType = parasite instanceof CombatParasite ? ParasiteType.COMBAT : ParasiteType.ENERGY;
                const depositId = parasite.getHomeDeposit().getId();
                
                // Update deposit tracking
                const currentCount = this.depositParasiteCount.get(depositId) || 0;
                this.depositParasiteCount.set(depositId, Math.max(0, currentCount - 1));
                
                // Update type tracking
                const currentTypeCount = this.parasiteCountByType.get(parasiteType) || 0;
                this.parasiteCountByType.set(parasiteType, Math.max(0, currentTypeCount - 1));
                
                // Update deposit-specific tracking
                const depositParasites = this.parasitesByDeposit.get(depositId);
                if (depositParasites) {
                    depositParasites.delete(parasiteId);
                }
                
                // Remove from spatial index
                const gameEngine = GameEngine.getInstance();
                const spatialIndex = gameEngine?.getSpatialIndex();
                if (spatialIndex) {
                    spatialIndex.remove(parasiteId);
                }

                // Dispose the parasite
                parasite.dispose();
                this.parasites.delete(parasiteId);
            }
        }

        // Clear territory parasite count
        territory.parasiteCount = 0;
        
        console.log(`💥 Exploded ${parasitesToExplode.length} parasites in territory ${territoryId}`);
    }

    /**
     * Get all parasites in a specific territory
     */
    public getParasitesInTerritory(territoryId: string): (EnergyParasite | CombatParasite)[] {
        if (!this.territoryManager) return [];
        
        const territory = this.territoryManager.getTerritory(territoryId);
        if (!territory) return [];
        
        const territoryParasites: (EnergyParasite | CombatParasite)[] = [];
        
        for (const parasite of this.parasites.values()) {
            if (parasite.isAlive()) {
                const parasitePosition = parasite.getPosition();
                if (this.territoryManager.isPositionInTerritory(parasitePosition, territoryId)) {
                    territoryParasites.push(parasite);
                }
            }
        }
        
        return territoryParasites;
    }

    /**
     * Transfer parasite control from one Queen to another
     */
    public transferParasiteControl(parasiteId: string, newQueen: Queen): void {
        const parasite = this.parasites.get(parasiteId);
        if (!parasite || !parasite.isAlive()) return;
        
        // Remove from current Queen's control
        const currentTerritory = this.territoryManager?.getTerritoryAt(
            parasite.getPosition().x, 
            parasite.getPosition().z
        );
        
        if (currentTerritory?.queen) {
            currentTerritory.queen.removeControlledParasite(parasiteId);
        }
        
        // Add to new Queen's control
        newQueen.addControlledParasite(parasiteId);
    }

    /**
     * Check if spawning should occur in a territory
     */
    private shouldSpawnInTerritory(territory: Territory): boolean {
        // Don't spawn in liberated territories
        if (territory.controlStatus === 'liberated') {
            return false;
        }
        
        // Don't spawn if no active Queen
        if (!territory.queen || !territory.queen.isActiveQueen()) {
            return false;
        }
        
        // Check if Queen is in active control phase
        return territory.queen.isVulnerable(); // Only spawn when Queen is vulnerable/active
    }

    /**
     * Get spawn rate multiplier for a territory based on Queen control
     */
    private getSpawnRateForTerritory(territory: Territory): number {
        const territorialConfig = this.territorialConfigs.get(territory.id);
        if (!territorialConfig) {
            return 1.0; // Default rate
        }
        
        // Apply Queen control bonus
        if (territory.queen && territory.queen.isActiveQueen()) {
            return territorialConfig.spawnRate * 1.5; // 50% faster spawning under Queen control
        }
        
        return territorialConfig.spawnRate;
    }
    
    /**
     * Spawn a new parasite near a mineral deposit using distribution tracking
     */
    private spawnParasite(deposit: MineralDeposit): void {
        const depositPosition = deposit.getPosition();
        
        // Generate random spawn position near deposit
        const angle = Math.random() * Math.PI * 2;
        const distance = 5 + Math.random() * (this.spawnConfig.spawnRadius - 5); // 5-15 units from deposit
        
        const spawnOffset = new Vector3(
            Math.cos(angle) * distance,
            0.5, // Slightly above ground
            Math.sin(angle) * distance
        );
        
        const spawnPosition = depositPosition.add(spawnOffset);
        
        // Determine parasite type using distribution tracker
        const parasiteType = this.distributionTracker.getNextParasiteType();
        
        // Create parasite using factory pattern
        const parasite = this.createParasite(parasiteType, {
            position: spawnPosition,
            scene: this.scene,
            materialManager: this.materialManager,
            homeDeposit: deposit
        });
        
        // Set terrain generator with fallback
        if (this.terrainGenerator) {
            parasite.setTerrainGenerator(this.terrainGenerator);
        }
        
        this.parasites.set(parasite.getId(), parasite);

        // Add to spatial index for O(1) lookups
        const gameEngine = GameEngine.getInstance();
        const spatialIndex = gameEngine?.getSpatialIndex();
        if (spatialIndex) {
            const parasiteEntityType = parasiteType === ParasiteType.COMBAT ? 'combat_parasite' : 'parasite';
            spatialIndex.add(parasite.getId(), spawnPosition, parasiteEntityType);
        }

        // Record spawn in distribution tracker
        this.distributionTracker.recordSpawn(parasiteType, deposit.getId());

        // Update enhanced tracking
        const depositId = deposit.getId();
        const currentCount = this.depositParasiteCount.get(depositId) || 0;
        this.depositParasiteCount.set(depositId, currentCount + 1);

        // Update type tracking
        const currentTypeCount = this.parasiteCountByType.get(parasiteType) || 0;
        this.parasiteCountByType.set(parasiteType, currentTypeCount + 1);

        // Update deposit-specific tracking
        if (!this.parasitesByDeposit.has(depositId)) {
            this.parasitesByDeposit.set(depositId, new Set());
        }
        this.parasitesByDeposit.get(depositId)!.add(parasite.getId());

        // Parasite spawned with enhanced type tracking
    }
    
    /**
     * Factory method for creating parasites based on type
     */
    private createParasite(type: ParasiteType, config: EnergyParasiteConfig | CombatParasiteConfig): EnergyParasite | CombatParasite {
        switch (type) {
            case ParasiteType.ENERGY:
                return new EnergyParasite(config as EnergyParasiteConfig);
            case ParasiteType.COMBAT:
                return new CombatParasite(config as CombatParasiteConfig);
            default:
                throw new Error(`Unknown parasite type: ${type}`);
        }
    }
    
    /**
     * Handle protector attacking a parasite (DEPRECATED - use CombatSystem instead)
     * This method is kept for backward compatibility but should not be used
     * with the new CombatSystem integration.
     */
    public handleProtectorAttack(protector: Protector, targetPosition: Vector3): boolean {
        // Deprecated: Use CombatSystem.initiateAttack instead
        
        // Find parasite at target position
        const targetParasite = this.findParasiteAt(targetPosition, 2.0); // 2 unit tolerance
        
        if (!targetParasite) {
            return false; // No parasite found
        }
        
        // Delegate to CombatSystem for proper handling
        const gameEngine = GameEngine.getInstance();
        const combatSystem = gameEngine?.getCombatSystem();
        
        if (combatSystem) {
            return combatSystem.initiateAttack(protector, targetParasite);
        }
        
        // Fallback to old behavior if CombatSystem not available
        // Check if protector is in range
        const distance = Vector3.Distance(protector.getPosition(), targetParasite.getPosition());
        if (distance > 15) { // 15 unit attack range
            return false;
        }
        
        // Check if protector has enough energy
        const attackCost = 5; // 5 energy per attack
        if (!protector.getEnergyStorage().hasEnergy(attackCost)) {
            return false;
        }
        
        // Consume energy and attack
        protector.getEnergyStorage().removeEnergy(attackCost, 'parasite_attack');
        const parasiteDestroyed = targetParasite.takeDamage(1); // 1 damage per attack
        
        if (parasiteDestroyed) {
            // Award energy for successful kill
            const killReward = 2; // 2 energy reward
            protector.getEnergyStorage().addEnergy(killReward, 'parasite_kill_reward');
            
            // Update tracking
            const depositId = targetParasite.getHomeDeposit().getId();
            const currentCount = this.depositParasiteCount.get(depositId) || 0;
            this.depositParasiteCount.set(depositId, Math.max(0, currentCount - 1));
            
            // Parasite destroyed silently
        }
        
        return true; // Attack successful
    }
    
    /**
     * Handle parasite destruction (called by CombatSystem)
     * Instead of destroying, respawn the parasite 15m away from death point
     */
    public handleParasiteDestruction(parasiteId: string): void {
        const parasite = this.parasites.get(parasiteId);
        if (!parasite) {
            return; // Parasite not found
        }

        // Check if already pending respawn
        if (this.pendingRespawns.some(p => p.parasiteId === parasiteId)) {
            return; // Already queued for respawn
        }

        // Remove from Queen control if applicable
        if (this.territoryManager) {
            const parasitePosition = parasite.getPosition();
            const territory = this.territoryManager.getTerritoryAt(parasitePosition.x, parasitePosition.z);
            if (territory?.queen) {
                territory.queen.removeControlledParasite(parasiteId);
            }
        }

        // Update tracking before hiding parasite
        const parasiteType = parasite instanceof CombatParasite ? ParasiteType.COMBAT : ParasiteType.ENERGY;
        const depositId = parasite.getHomeDeposit().getId();
        
        // Update deposit tracking
        const currentCount = this.depositParasiteCount.get(depositId) || 0;
        this.depositParasiteCount.set(depositId, Math.max(0, currentCount - 1));
        
        // Update type tracking
        const currentTypeCount = this.parasiteCountByType.get(parasiteType) || 0;
        this.parasiteCountByType.set(parasiteType, Math.max(0, currentTypeCount - 1));
        
        // Update deposit-specific tracking
        const depositParasites = this.parasitesByDeposit.get(depositId);
        if (depositParasites) {
            depositParasites.delete(parasiteId);
        }

        // Remove from spatial index while hidden
        const gameEngine = GameEngine.getInstance();
        const spatialIndex = gameEngine?.getSpatialIndex();
        if (spatialIndex) {
            spatialIndex.remove(parasiteId);
        }

        // Calculate respawn position 15m away in a random direction
        const deathPosition = parasite.getPosition();
        const randomAngle = Math.random() * Math.PI * 2;

        const respawnX = deathPosition.x + Math.cos(randomAngle) * this.RESPAWN_DISTANCE;
        const respawnZ = deathPosition.z + Math.sin(randomAngle) * this.RESPAWN_DISTANCE;

        // Get terrain height at respawn position
        let respawnY = 0.5;
        if (this.terrainGenerator && this.terrainGenerator.getHeightAtPosition) {
            respawnY = this.terrainGenerator.getHeightAtPosition(respawnX, respawnZ) + 0.5;
        }

        const respawnPosition = new Vector3(respawnX, respawnY, respawnZ);

        // Hide the parasite while waiting to respawn
        parasite.hide();

        // Add to pending respawn queue
        this.pendingRespawns.push({
            parasiteId,
            deathTime: Date.now(),
            respawnPosition
        });

    }

    /**
     * Find parasite at a specific position
     */
    private findParasiteAt(position: Vector3, tolerance: number): EnergyParasite | CombatParasite | null {
        for (const parasite of this.parasites.values()) {
            if (parasite.isAlive()) {
                const distance = Vector3.Distance(parasite.getPosition(), position);
                if (distance <= tolerance) {
                    return parasite;
                }
            }
        }
        return null;
    }
    
    /**
     * Clean up dead parasites - respawn them 15m away instead of removing
     */
    private cleanupDeadParasites(): void {
        for (const [id, parasite] of this.parasites.entries()) {
            if (!parasite.isAlive()) {
                // Respawn 15m away instead of disposing
                this.handleParasiteDestruction(id);
            }
        }
    }
    
    /**
     * Get parasite by ID
     */
    public getParasiteById(parasiteId: string): EnergyParasite | CombatParasite | null {
        return this.parasites.get(parasiteId) || null;
    }

    /**
     * Get all active parasites
     */
    public getParasites(): (EnergyParasite | CombatParasite)[] {
        return Array.from(this.parasites.values()).filter(p => p.isAlive());
    }

    /**
     * Get all active parasites (alias for CombatSystem compatibility)
     */
    public getAllParasites(): (EnergyParasite | CombatParasite)[] {
        return this.getParasites();
    }
    
    /**
     * Get parasites near a position
     */
    public getParasitesNear(position: Vector3, radius: number): (EnergyParasite | CombatParasite)[] {
        return this.getParasites().filter(parasite => {
            const distance = Vector3.Distance(parasite.getPosition(), position);
            return distance <= radius;
        });
    }
    
    /**
     * Get parasite count for a deposit
     */
    public getParasiteCountForDeposit(depositId: string): number {
        return this.depositParasiteCount.get(depositId) || 0;
    }
    
    /**
     * Update spawn configuration
     */
    public updateSpawnConfig(config: Partial<ParasiteSpawnConfig>): void {
        this.spawnConfig = { ...this.spawnConfig, ...config };
        // Spawn config updated silently
    }
    
    /**
     * Get distribution tracker for monitoring spawn ratios
     */
    public getDistributionTracker(): DistributionTracker {
        return this.distributionTracker;
    }
    
    /**
     * Get spawn distribution statistics
     */
    /**
     * Get spawn distribution statistics
     */
    public getDistributionStats(): any {
        return this.distributionTracker.getDistributionStats();
    }
    
    /**
     * Reset distribution tracking
     */
    public resetDistribution(): void {
        this.distributionTracker.reset();
    }
    
    /**
     * Get parasites by type
     */
    public getParasitesByType(type: ParasiteType): (EnergyParasite | CombatParasite)[] {
        return this.getParasites().filter(parasite => {
            if (parasite instanceof CombatParasite) {
                return type === ParasiteType.COMBAT;
            } else {
                return type === ParasiteType.ENERGY;
            }
        });
    }
    
    /**
     * Get parasite count by type
     */
    public getParasiteCountByType(type: ParasiteType): number {
        return this.parasiteCountByType.get(type) || 0;
    }
    
    /**
     * Get parasites for a specific deposit
     */
    public getParasitesForDeposit(depositId: string): (EnergyParasite | CombatParasite)[] {
        const parasiteIds = this.parasitesByDeposit.get(depositId);
        if (!parasiteIds) {
            return [];
        }
        
        const parasites: (EnergyParasite | CombatParasite)[] = [];
        for (const parasiteId of parasiteIds) {
            const parasite = this.parasites.get(parasiteId);
            if (parasite && parasite.isAlive()) {
                parasites.push(parasite);
            }
        }
        
        return parasites;
    }
    
    /**
     * Clean up orphaned tracking data
     */
    private cleanupOrphanedTracking(): void {
        // Clean up deposit tracking for removed parasites
        for (const [depositId, parasiteIds] of this.parasitesByDeposit.entries()) {
            const validIds = new Set<string>();
            for (const parasiteId of parasiteIds) {
                if (this.parasites.has(parasiteId)) {
                    validIds.add(parasiteId);
                }
            }
            this.parasitesByDeposit.set(depositId, validIds);
        }
        
        // Recalculate type counts from actual parasites
        this.parasiteCountByType.set(ParasiteType.ENERGY, 0);
        this.parasiteCountByType.set(ParasiteType.COMBAT, 0);
        
        for (const parasite of this.parasites.values()) {
            if (parasite.isAlive()) {
                const type = parasite instanceof CombatParasite ? ParasiteType.COMBAT : ParasiteType.ENERGY;
                const currentCount = this.parasiteCountByType.get(type) || 0;
                this.parasiteCountByType.set(type, currentCount + 1);
            }
        }
    }
    
    /**
     * Check and optimize performance based on current frame rate and parasite count
     */
    private checkAndOptimizePerformance(): void {
        // Get current FPS from engine if available
        const gameEngine = GameEngine.getInstance();
        const engine = gameEngine?.getEngine();
        
        if (!engine) {
            return;
        }
        
        const currentFPS = engine.getFps();
        const activeParasiteCount = this.getParasites().length;
        
        // Determine optimization level based on performance
        let newOptimizationLevel = 0;
        
        if (currentFPS < 45 && activeParasiteCount > 5) {
            // Aggressive optimization needed
            newOptimizationLevel = 2;
            this.maxActiveParasites = Math.max(5, Math.floor(activeParasiteCount * 0.7));
        } else if (currentFPS < 55 && activeParasiteCount > 7) {
            // Basic optimization needed
            newOptimizationLevel = 1;
            this.maxActiveParasites = Math.max(7, Math.floor(activeParasiteCount * 0.85));
        } else if (currentFPS >= 58) {
            // Performance is good, can increase limits
            newOptimizationLevel = 0;
            this.maxActiveParasites = Math.min(10, this.maxActiveParasites + 1);
        }
        
        // Apply optimization if level changed
        if (newOptimizationLevel !== this.renderingOptimizationLevel) {
            this.renderingOptimizationLevel = newOptimizationLevel;
            this.applyRenderingOptimizations();
        }
    }
    
    /**
     * Apply rendering optimizations based on current optimization level
     */
    private applyRenderingOptimizations(): void {
        const parasites = this.getParasites();
        
        switch (this.renderingOptimizationLevel) {
            case 0: // No optimization
                this.enableAllParasiteRendering(parasites);
                break;
                
            case 1: // Basic optimization
                this.applyBasicOptimizations(parasites);
                break;
                
            case 2: // Aggressive optimization
                this.applyAggressiveOptimizations(parasites);
                break;
        }
    }
    
    /**
     * Enable full rendering for all parasites
     */
    private enableAllParasiteRendering(parasites: (EnergyParasite | CombatParasite)[]): void {
        for (const parasite of parasites) {
            this.setParasiteRenderingLevel(parasite, 'full');
        }
    }
    
    /**
     * Apply basic performance optimizations
     */
    private applyBasicOptimizations(parasites: (EnergyParasite | CombatParasite)[]): void {
        // Sort parasites by distance from camera
        const gameEngine = GameEngine.getInstance();
        const cameraController = gameEngine?.getCameraController();
        
        if (!cameraController) {
            return;
        }
        
        const cameraPosition = cameraController.getCamera()?.position;
        if (!cameraPosition) {
            return;
        }
        
        const parasitesWithDistance = parasites.map(parasite => ({
            parasite,
            distance: Vector3.Distance(parasite.getPosition(), cameraPosition)
        }));
        
        parasitesWithDistance.sort((a, b) => a.distance - b.distance);
        
        // Apply different rendering levels based on distance and priority
        for (let i = 0; i < parasitesWithDistance.length; i++) {
            const { parasite, distance } = parasitesWithDistance[i];
            
            if (distance > 100) {
                // Very far parasites - minimal rendering
                this.setParasiteRenderingLevel(parasite, 'minimal');
            } else if (distance > 50) {
                // Far parasites - reduced rendering
                this.setParasiteRenderingLevel(parasite, 'reduced');
            } else {
                // Close parasites - full rendering
                this.setParasiteRenderingLevel(parasite, 'full');
            }
        }
    }
    
    /**
     * Apply aggressive performance optimizations
     */
    private applyAggressiveOptimizations(parasites: (EnergyParasite | CombatParasite)[]): void {
        // Sort parasites by priority (combat parasites and close ones first)
        const gameEngine = GameEngine.getInstance();
        const cameraController = gameEngine?.getCameraController();
        
        if (!cameraController) {
            return;
        }
        
        const cameraPosition = cameraController.getCamera()?.position;
        if (!cameraPosition) {
            return;
        }
        
        const parasitesWithPriority = parasites.map(parasite => {
            const distance = Vector3.Distance(parasite.getPosition(), cameraPosition);
            const isCombat = parasite instanceof CombatParasite;
            const priority = (isCombat ? 1000 : 0) - distance; // Combat parasites get priority, then by distance
            
            return { parasite, distance, priority };
        });
        
        parasitesWithPriority.sort((a, b) => b.priority - a.priority);
        
        // Only render the most important parasites
        const maxRenderCount = Math.min(this.maxActiveParasites, parasitesWithPriority.length);
        
        for (let i = 0; i < parasitesWithPriority.length; i++) {
            const { parasite, distance } = parasitesWithPriority[i];
            
            if (i >= maxRenderCount) {
                // Hide excess parasites
                this.setParasiteRenderingLevel(parasite, 'hidden');
            } else if (distance > 75) {
                // Far but important parasites - minimal rendering
                this.setParasiteRenderingLevel(parasite, 'minimal');
            } else if (distance > 40) {
                // Medium distance - reduced rendering
                this.setParasiteRenderingLevel(parasite, 'reduced');
            } else {
                // Close and important - full rendering
                this.setParasiteRenderingLevel(parasite, 'full');
            }
        }
    }
    
    /**
     * Set rendering level for a specific parasite
     */
    private setParasiteRenderingLevel(parasite: EnergyParasite | CombatParasite, level: 'full' | 'reduced' | 'minimal' | 'hidden'): void {
        // This method would call into the parasite's rendering system
        // For now, we'll implement a basic version that affects visibility

        if (typeof (parasite as any).setRenderingLevel === 'function') {
            (parasite as any).setRenderingLevel(level);
        } else {
            // Fallback: control visibility based on level
            if (level === 'hidden') {
                parasite.hide();
            } else {
                // Show parasite for all non-hidden levels (full, reduced, minimal)
                parasite.show();
            }
        }
    }
    public getLifecycleStats(): {
        totalParasites: number;
        energyParasites: number;
        combatParasites: number;
        pendingRespawns: number;
        parasitesByDeposit: Map<string, number>;
        distributionAccuracy: number;
    } {
        const parasitesByDeposit = new Map<string, number>();
        for (const [depositId, parasiteIds] of this.parasitesByDeposit.entries()) {
            parasitesByDeposit.set(depositId, parasiteIds.size);
        }
        
        const distributionStats = this.distributionTracker.getDistributionStats();
        
        return {
            totalParasites: this.parasites.size,
            energyParasites: this.getParasiteCountByType(ParasiteType.ENERGY),
            combatParasites: this.getParasiteCountByType(ParasiteType.COMBAT),
            pendingRespawns: this.pendingRespawns.length,
            parasitesByDeposit,
            distributionAccuracy: distributionStats.isAccurate ? 1.0 : 0.0
        };
    }
    
    /**
     * Get performance statistics
     */
    public getPerformanceStats(): {
        optimizationLevel: number;
        maxActiveParasites: number;
        activeParasites: number;
        renderingOptimizations: string;
        lastPerformanceCheck: number;
    } {
        const optimizationNames = ['None', 'Basic', 'Aggressive'];
        
        return {
            optimizationLevel: this.renderingOptimizationLevel,
            maxActiveParasites: this.maxActiveParasites,
            activeParasites: this.getParasites().length,
            renderingOptimizations: optimizationNames[this.renderingOptimizationLevel] || 'Unknown',
            lastPerformanceCheck: this.lastPerformanceCheck
        };
    }
    
    /**
     * Force performance optimization check (for testing)
     */
    public forcePerformanceCheck(): void {
        this.checkAndOptimizePerformance();
    }
    
    /**
     * Set maximum active parasites (for testing/configuration)
     */
    public setMaxActiveParasites(max: number): void {
        this.maxActiveParasites = Math.max(1, Math.min(20, max)); // Clamp between 1-20
    }
    
    /**
     * Optimize material usage for better performance
     */
    public optimizeMaterials(): void {
        // Share materials between parasites of the same type to reduce memory usage
        const energyMaterial = this.materialManager.getParasiteMaterial();
        const combatMaterial = this.materialManager.getCombatParasiteMaterial();
        
        for (const parasite of this.parasites.values()) {
            if (parasite instanceof CombatParasite) {
                // Ensure combat parasites use the shared combat material
                if (typeof (parasite as any).updateMaterial === 'function') {
                    (parasite as any).updateMaterial(combatMaterial);
                }
            } else {
                // Ensure energy parasites use the shared energy material
                if (typeof (parasite as any).updateMaterial === 'function') {
                    (parasite as any).updateMaterial(energyMaterial);
                }
            }
        }
    }
    
    /**
     * Get rendering performance metrics
     */
    public getRenderingMetrics(): {
        totalMeshes: number;
        visibleMeshes: number;
        hiddenMeshes: number;
        materialInstances: number;
    } {
        let totalMeshes = 0;
        let visibleMeshes = 0;
        let hiddenMeshes = 0;
        const materialSet = new Set<string>();
        
        for (const parasite of this.parasites.values()) {
            // Count meshes (each parasite has multiple segments)
            const meshCount = (parasite as any).segments?.length || 1;
            totalMeshes += meshCount;
            
            // Check visibility
            if ((parasite as any).isHidden && (parasite as any).isHidden()) {
                hiddenMeshes += meshCount;
            } else {
                visibleMeshes += meshCount;
            }
            
            // Track unique materials
            if ((parasite as any).material) {
                materialSet.add((parasite as any).material.name || 'unknown');
            }
        }
        
        return {
            totalMeshes,
            visibleMeshes,
            hiddenMeshes,
            materialInstances: materialSet.size
        };
    }
    
    /**
     * Get territorial statistics for monitoring
     */
    public getTerritorialStats(): {
        territoriesWithQueens: number;
        territoriesLiberated: number;
        parasitesUnderQueenControl: number;
        territorialConfigs: number;
    } {
        if (!this.territoryManager) {
            return {
                territoriesWithQueens: 0,
                territoriesLiberated: 0,
                parasitesUnderQueenControl: 0,
                territorialConfigs: 0
            };
        }
        
        const territories = this.territoryManager.getAllTerritories();
        let territoriesWithQueens = 0;
        let territoriesLiberated = 0;
        let parasitesUnderQueenControl = 0;
        
        for (const territory of territories) {
            if (territory.queen && territory.queen.isActiveQueen()) {
                territoriesWithQueens++;
                parasitesUnderQueenControl += territory.queen.getControlledParasites().length;
            }
            if (territory.controlStatus === 'liberated') {
                territoriesLiberated++;
            }
        }
        
        return {
            territoriesWithQueens,
            territoriesLiberated,
            parasitesUnderQueenControl,
            territorialConfigs: this.territorialConfigs.size
        };
    }

    /**
     * Validate parasite control consistency (called by ErrorRecoveryManager)
     */
    public validateParasiteControlConsistency(): {
        orphanedParasites: string[];
        wrongQueenControl: Array<{ parasiteId: string; expectedQueenId: string; actualQueenId: string }>;
        duplicateControl: string[];
    } {
        const orphanedParasites: string[] = [];
        const wrongQueenControl: Array<{ parasiteId: string; expectedQueenId: string; actualQueenId: string }> = [];
        const duplicateControl: string[] = [];
        
        if (!this.territoryManager) {
            return { orphanedParasites, wrongQueenControl, duplicateControl };
        }
        
        // Track which Queens control which parasites
        const queenControlMap = new Map<string, string[]>(); // queenId -> parasiteIds
        const parasiteQueenMap = new Map<string, string>(); // parasiteId -> queenId
        
        // Build control maps from Queen perspective
        const territories = this.territoryManager.getAllTerritories();
        for (const territory of territories) {
            const queen = territory.queen;
            if (queen && queen.isActiveQueen()) {
                const controlledParasites = queen.getControlledParasites();
                queenControlMap.set(queen.id, controlledParasites);
                
                for (const parasiteId of controlledParasites) {
                    if (parasiteQueenMap.has(parasiteId)) {
                        // Duplicate control detected
                        duplicateControl.push(parasiteId);
                    } else {
                        parasiteQueenMap.set(parasiteId, queen.id);
                    }
                }
            }
        }
        
        // Validate each parasite's control status
        for (const parasite of this.parasites.values()) {
            if (!parasite.isAlive()) {
                continue;
            }
            
            const parasiteId = parasite.getId();
            const parasitePosition = parasite.getPosition();
            const territory = this.territoryManager.getTerritoryAt(parasitePosition.x, parasitePosition.z);
            
            if (!territory) {
                // Parasite outside any territory
                if (parasiteQueenMap.has(parasiteId)) {
                    orphanedParasites.push(parasiteId);
                }
                continue;
            }
            
            const expectedQueen = territory.queen;
            const actualQueenId = parasiteQueenMap.get(parasiteId);
            
            if (!expectedQueen) {
                // Territory has no Queen
                if (actualQueenId) {
                    orphanedParasites.push(parasiteId);
                }
            } else {
                // Territory has Queen - check control consistency
                const expectedQueenId = expectedQueen.id;
                
                if (actualQueenId !== expectedQueenId) {
                    if (actualQueenId) {
                        wrongQueenControl.push({
                            parasiteId,
                            expectedQueenId,
                            actualQueenId
                        });
                    } else {
                        orphanedParasites.push(parasiteId);
                    }
                }
            }
        }
        
        return { orphanedParasites, wrongQueenControl, duplicateControl };
    }

    /**
     * Force recalculation of all parasite control relationships
     */
    public recalculateParasiteControl(): void {
        if (!this.territoryManager) return;
        
        // Clear all Queen control first
        const territories = this.territoryManager.getAllTerritories();
        for (const territory of territories) {
            if (territory.queen && territory.queen.isActiveQueen()) {
                const controlledParasites = territory.queen.getControlledParasites();
                for (const parasiteId of controlledParasites) {
                    territory.queen.removeControlledParasite(parasiteId);
                }
            }
        }
        
        // Reassign parasites to Queens based on current positions
        for (const parasite of this.parasites.values()) {
            if (parasite.isAlive()) {
                const parasitePosition = parasite.getPosition();
                const territory = this.territoryManager.getTerritoryAt(parasitePosition.x, parasitePosition.z);
                
                if (territory?.queen && territory.queen.isActiveQueen()) {
                    territory.queen.addControlledParasite(parasite.getId());
                }
            }
        }
        
        console.log('🔧 Parasite control relationships recalculated');
    }

    /**
     * Get active parasite count for performance monitoring
     */
    public getActiveParasiteCount(): number {
        return this.getParasites().length;
    }

    /**
     * Get current spawn rate for performance monitoring
     */
    public getCurrentSpawnRate(): number {
        // Return approximate spawns per second based on spawn interval
        const baseInterval = this.spawnConfig.baseSpawnInterval;
        return baseInterval > 0 ? 1000 / baseInterval : 0; // Convert ms to spawns per second
    }

    /**
     * Dispose all parasites and cleanup
     */
    public dispose(): void {
        // Remove all parasites from spatial index
        const gameEngine = GameEngine.getInstance();
        const spatialIndex = gameEngine?.getSpatialIndex();

        for (const parasite of this.parasites.values()) {
            if (spatialIndex) {
                spatialIndex.remove(parasite.getId());
            }
            if (parasite && typeof parasite.dispose === 'function') {
                parasite.dispose();
            }
        }

        this.parasites.clear();
        this.lastSpawnAttempt.clear();
        this.depositParasiteCount.clear();
        this.parasiteCountByType.clear();
        this.parasitesByDeposit.clear();
        this.pendingRespawns.length = 0;
        
        // Clear territorial configurations
        this.territorialConfigs.clear();
        this.territoryManager = null;
        
        // ParasiteManager disposed silently
    }
}