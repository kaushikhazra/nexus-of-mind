/**
 * CombatTargetPriority - Target prioritization and selection for combat
 *
 * Handles target prioritization, consistent target selection, and
 * territorial awareness for combat decisions.
 * Extracted from CombatSystem.ts for SOLID compliance.
 */

import { Vector3 } from '@babylonjs/core';
import type { CombatTarget, CombatConfig } from './CombatInterfaces';
import { EnergyParasite } from '../entities/EnergyParasite';
import { Protector } from '../entities/Protector';

/**
 * Target with priority information
 */
export interface PrioritizedTarget {
    target: CombatTarget;
    distance: number;
    priority: number;
    id: string;
}

/**
 * CombatTargetPrioritizer - Handles target prioritization logic
 */
export class CombatTargetPrioritizer {
    private config: CombatConfig;

    constructor(config: CombatConfig) {
        this.config = config;
    }

    /**
     * Update configuration reference
     */
    public updateConfig(config: CombatConfig): void {
        this.config = config;
    }

    /**
     * Prioritize targets by distance (closest first)
     */
    public prioritizeClosestTarget(protector: Protector, targets: CombatTarget[]): CombatTarget | null {
        if (targets.length === 0) {
            return null;
        }

        const protectorPosition = protector.getPosition();
        let closestTarget = targets[0];
        let closestDistance = Vector3.Distance(protectorPosition, closestTarget.position);

        for (let i = 1; i < targets.length; i++) {
            const distance = Vector3.Distance(protectorPosition, targets[i].position);
            if (distance < closestDistance) {
                closestTarget = targets[i];
                closestDistance = distance;
            }
        }

        return closestTarget;
    }

    /**
     * Prioritize targets using comprehensive prioritization logic
     * Returns targets sorted by priority (highest priority first)
     */
    public prioritizeTargets(protector: Protector, targets: CombatTarget[]): CombatTarget[] {
        if (targets.length === 0) {
            return [];
        }

        const protectorPosition = protector.getPosition();

        // Create priority objects with target and calculated priority score
        const targetPriorities = targets.map(target => {
            const distance = Vector3.Distance(protectorPosition, target.position);
            const priority = this.calculateTargetPriority(target, distance);

            return {
                target,
                distance,
                priority,
                id: target.id
            };
        });

        // Sort by priority (highest first), then by distance (closest first) as tiebreaker
        targetPriorities.sort((a, b) => {
            if (Math.abs(a.priority - b.priority) < 0.001) { // Priorities are essentially equal
                return a.distance - b.distance; // Closer target wins
            }
            return b.priority - a.priority; // Higher priority wins
        });

        // Return sorted targets
        return targetPriorities.map(tp => tp.target);
    }

    /**
     * Calculate priority score for a target
     * Higher score = higher priority
     */
    public calculateTargetPriority(target: CombatTarget, distance: number): number {
        let priority = 100; // Base priority

        // Distance factor (closer targets get higher priority)
        const maxDetectionRange = this.config.protectorDetectionRange;
        const distanceFactor = (maxDetectionRange - distance) / maxDetectionRange;
        priority += distanceFactor * 50; // Up to 50 bonus points for proximity

        // Health factor (weaker targets get slightly higher priority for quick elimination)
        const healthRatio = target.health / target.maxHealth;
        const healthFactor = (1 - healthRatio) * 20; // Up to 20 bonus points for low health
        priority += healthFactor;

        // Target type factor
        if (target instanceof EnergyParasite) {
            priority += 30; // Energy Parasites get priority due to energy reward
        }

        // Queen and Hive priority (high-value targets)
        const { Queen } = require('../entities/Queen');
        const { Hive } = require('../entities/Hive');

        if (target instanceof Queen) {
            priority += 100; // Queens are highest priority targets
        } else if (target instanceof Hive) {
            priority += 80; // Hives are high priority targets
        }

        return priority;
    }

    /**
     * Get the highest priority target from a list
     */
    public getHighestPriorityTarget(protector: Protector, targets: CombatTarget[]): CombatTarget | null {
        const prioritizedTargets = this.prioritizeTargets(protector, targets);
        return prioritizedTargets.length > 0 ? prioritizedTargets[0] : null;
    }

    /**
     * Ensure consistent target selection behavior
     * Provides deterministic target selection for the same input
     */
    public selectTargetConsistently(protector: Protector, targets: CombatTarget[]): CombatTarget | null {
        if (targets.length === 0) {
            return null;
        }

        if (targets.length === 1) {
            return targets[0];
        }

        // Use prioritization logic
        const prioritizedTargets = this.prioritizeTargets(protector, targets);

        // If multiple targets have the same priority, use ID-based tiebreaker for consistency
        const topTarget = prioritizedTargets[0];
        const topPriority = this.calculateTargetPriority(
            topTarget,
            Vector3.Distance(protector.getPosition(), topTarget.position)
        );

        // Find all targets with the same top priority
        const topPriorityTargets = prioritizedTargets.filter(target => {
            const distance = Vector3.Distance(protector.getPosition(), target.position);
            const priority = this.calculateTargetPriority(target, distance);
            return Math.abs(priority - topPriority) < 0.001;
        });

        if (topPriorityTargets.length === 1) {
            return topPriorityTargets[0];
        }

        // Use lexicographic ID sorting for deterministic selection
        topPriorityTargets.sort((a, b) => a.id.localeCompare(b.id));

        return topPriorityTargets[0];
    }

    /**
     * Prioritize targets with territorial awareness
     * Queens and Hives get higher priority, especially in contested territories
     */
    public prioritizeTargetsWithTerritory(protector: Protector, targets: CombatTarget[]): CombatTarget[] {
        if (targets.length === 0) {
            return [];
        }

        const protectorPosition = protector.getPosition();
        const { Queen } = require('../entities/Queen');
        const { Hive } = require('../entities/Hive');

        // Create priority objects with enhanced territorial scoring
        const targetPriorities = targets.map(target => {
            const distance = Vector3.Distance(protectorPosition, target.position);
            let priority = this.calculateTargetPriority(target, distance);

            // Additional territorial priority bonuses
            if (target instanceof Queen) {
                // Queens in active control phase get maximum priority
                if ((target as any).isVulnerable()) {
                    priority += 150; // Highest priority for vulnerable Queens
                }
            } else if (target instanceof Hive) {
                // Hives get high priority, especially when constructed
                if ((target as any).isHiveConstructed()) {
                    priority += 120; // High priority for constructed Hives

                    // Bonus for hives with many defensive parasites (bigger threat)
                    const defensiveCount = (target as any).getActiveDefensiveParasiteCount();
                    priority += Math.min(30, defensiveCount * 0.5);
                }
            }

            return {
                target,
                distance,
                priority,
                id: target.id
            };
        });

        // Sort by priority (highest first), then by distance (closest first) as tiebreaker
        targetPriorities.sort((a, b) => {
            if (Math.abs(a.priority - b.priority) < 0.001) {
                return a.distance - b.distance;
            }
            return b.priority - a.priority;
        });

        return targetPriorities.map(tp => tp.target);
    }

    /**
     * Get defensive priority level for a territory
     * Higher values indicate more dangerous territories requiring more protectors
     */
    public getDefensivePriorityInTerritory(territory: any): number {
        let priority = 0;

        // Base priority for any territory
        priority += 10;

        // Queen presence increases priority significantly
        if (territory.queen) {
            if (territory.queen.isVulnerable()) {
                priority += 50; // High priority for territories with vulnerable Queens
            } else {
                priority += 20; // Medium priority for territories with growing Queens
            }
        }

        // Hive presence increases priority
        if (territory.hive) {
            if (territory.hive.isHiveConstructed()) {
                priority += 40; // High priority for territories with constructed Hives

                // Additional priority based on defensive swarm size
                const defensiveCount = territory.hive.getActiveDefensiveParasiteCount();
                priority += Math.min(20, defensiveCount * 0.3);
            } else {
                priority += 15; // Medium priority for territories with constructing Hives
            }
        }

        // Parasite count increases priority
        priority += Math.min(30, territory.parasiteCount * 0.5);

        // Liberation status affects priority
        if (territory.controlStatus === 'liberated') {
            priority -= 30; // Lower priority for liberated territories
        } else if (territory.controlStatus === 'contested') {
            priority += 10; // Slightly higher priority for contested territories
        }

        return Math.max(0, priority);
    }
}
