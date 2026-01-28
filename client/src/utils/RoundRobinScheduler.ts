/**
 * RoundRobinScheduler - System update scheduling for frame rate optimization
 * 
 * Distributes non-critical system updates across multiple frames to maintain
 * 60fps performance. Instead of updating all systems every frame, this scheduler
 * updates a subset of systems each frame in a round-robin fashion.
 * 
 * WHY: Updating all systems every frame can cause frame drops. By distributing
 * updates across frames, we maintain smooth 60fps while still updating all systems
 * at their required intervals.
 */

// ==================== Interfaces ====================

export interface ThrottledSystem {
    /** System name for debugging */
    name: string;
    /** Update interval in milliseconds */
    interval: number;
    /** Last update timestamp */
    lastUpdate: number;
    /** Update function to call */
    update: (deltaTime?: number) => void;
}

export interface SchedulerConfig {
    /** Systems to schedule */
    systems: ThrottledSystem[];
    /** Maximum systems to update per frame (default: 1) */
    maxSystemsPerFrame?: number;
    /** Enable debug logging */
    debug?: boolean;
}

// ==================== Round-Robin System Scheduler ====================

/**
 * Round-robin scheduler for system updates
 * 
 * Distributes non-critical system updates across multiple frames to maintain
 * 60fps performance. Instead of updating all systems every frame, this scheduler
 * updates a subset of systems each frame in a round-robin fashion.
 * 
 * WHY: Updating all systems every frame can cause frame drops. By distributing
 * updates across frames, we maintain smooth 60fps while still updating all systems
 * at their required intervals.
 */
export class RoundRobinScheduler {
    private systems: ThrottledSystem[];
    private currentIndex: number = 0;
    private maxSystemsPerFrame: number;
    private debug: boolean;
    private frameCount: number = 0;

    constructor(config: SchedulerConfig) {
        this.systems = config.systems;
        this.maxSystemsPerFrame = config.maxSystemsPerFrame || 1;
        this.debug = config.debug || false;
    }

    /**
     * Update systems using round-robin scheduling
     * Call this once per frame from the main game loop
     * 
     * @param deltaTime Frame delta time in seconds
     */
    public update(deltaTime: number): void {
        if (this.systems.length === 0) return;

        const currentTime = performance.now();
        let systemsUpdated = 0;

        // Update up to maxSystemsPerFrame systems per frame
        while (systemsUpdated < this.maxSystemsPerFrame && systemsUpdated < this.systems.length) {
            const system = this.systems[this.currentIndex];
            
            // Check if system needs update based on its interval
            if (currentTime - system.lastUpdate >= system.interval) {
                try {
                    system.update(deltaTime);
                    system.lastUpdate = currentTime;
                    
                    if (this.debug) {
                        console.log(`[RoundRobin] Updated ${system.name} at frame ${this.frameCount}`);
                    }
                } catch (error) {
                    console.error(`[RoundRobin] Error updating system ${system.name}:`, error);
                }
            }

            // Move to next system
            this.currentIndex = (this.currentIndex + 1) % this.systems.length;
            systemsUpdated++;
        }

        this.frameCount++;
    }

    /**
     * Add a new system to the scheduler
     */
    public addSystem(system: ThrottledSystem): void {
        this.systems.push(system);
    }

    /**
     * Remove a system from the scheduler
     */
    public removeSystem(systemName: string): void {
        const index = this.systems.findIndex(s => s.name === systemName);
        if (index >= 0) {
            this.systems.splice(index, 1);
            
            // Adjust current index if necessary
            if (this.currentIndex >= this.systems.length) {
                this.currentIndex = 0;
            }
        }
    }

    /**
     * Get scheduler statistics
     */
    public getStats(): {
        totalSystems: number;
        currentIndex: number;
        frameCount: number;
        systemStats: Array<{
            name: string;
            interval: number;
            timeSinceLastUpdate: number;
        }>;
    } {
        const currentTime = performance.now();
        
        return {
            totalSystems: this.systems.length,
            currentIndex: this.currentIndex,
            frameCount: this.frameCount,
            systemStats: this.systems.map(system => ({
                name: system.name,
                interval: system.interval,
                timeSinceLastUpdate: currentTime - system.lastUpdate
            }))
        };
    }
}

/**
 * Create a round-robin scheduler with common game systems
 * 
 * @param systems Array of systems to schedule
 * @param maxSystemsPerFrame Maximum systems to update per frame
 * @returns Configured RoundRobinScheduler
 */
export function createGameSystemScheduler(
    systems: ThrottledSystem[],
    maxSystemsPerFrame: number = 1
): RoundRobinScheduler {
    return new RoundRobinScheduler({
        systems,
        maxSystemsPerFrame,
        debug: false // Set to true for debugging
    });
}