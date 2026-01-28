/**
 * ParasiteTerritory - Territory integration for parasites
 *
 * Handles territory-related operations for parasites including
 * Queen control, territorial spawning, and control validation.
 * Extracted from ParasiteManager.ts for SOLID compliance.
 */

import { Vector3 } from '@babylonjs/core';
import { EnergyParasite } from '../entities/EnergyParasite';
import { CombatParasite } from '../entities/CombatParasite';
import { TerritoryManager, Territory } from '../TerritoryManager';
import { Queen } from '../entities/Queen';
import type {
    TerritorialParasiteConfig,
    TerritorialStats,
    ParasiteControlValidation
} from './ParasiteInterfaces';

type ParasiteType = EnergyParasite | CombatParasite;

/**
 * ParasiteTerritoryManager - Manages parasite-territory relationships
 */
export class ParasiteTerritoryManager {
    private territoryManager: TerritoryManager | null = null;
    private territorialConfigs: Map<string, TerritorialParasiteConfig> = new Map();

    /**
     * Set territory manager
     */
    public setTerritoryManager(territoryManager: TerritoryManager): void {
        this.territoryManager = territoryManager;
    }

    /**
     * Get territory manager
     */
    public getTerritoryManager(): TerritoryManager | null {
        return this.territoryManager;
    }

    /**
     * Configure territorial spawning for a specific territory
     */
    public configureTerritorialSpawning(territoryId: string, config: TerritorialParasiteConfig): void {
        this.territorialConfigs.set(territoryId, config);
    }

    /**
     * Check if spawning should occur in a territory
     */
    public shouldSpawnInTerritory(territory: Territory): boolean {
        if (territory.controlStatus === 'liberated') {
            return false;
        }

        if (!territory.queen || !territory.queen.isActiveQueen()) {
            return false;
        }

        return territory.queen.isVulnerable();
    }

    /**
     * Get spawn rate multiplier for a territory
     */
    public getSpawnRateForTerritory(territory: Territory): number {
        const territorialConfig = this.territorialConfigs.get(territory.id);
        if (!territorialConfig) {
            return 1.0;
        }

        if (territory.queen && territory.queen.isActiveQueen()) {
            return territorialConfig.spawnRate * 1.5;
        }

        return territorialConfig.spawnRate;
    }

    /**
     * Get all parasites in a specific territory
     */
    public getParasitesInTerritory(
        territoryId: string,
        parasites: Map<string, ParasiteType>
    ): ParasiteType[] {
        if (!this.territoryManager) return [];

        const territory = this.territoryManager.getTerritory(territoryId);
        if (!territory) return [];

        const territoryParasites: ParasiteType[] = [];

        for (const parasite of parasites.values()) {
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
    public transferParasiteControl(parasiteId: string, newQueen: Queen, parasite: ParasiteType): void {
        if (!parasite || !parasite.isAlive()) return;

        const currentTerritory = this.territoryManager?.getTerritoryAt(
            parasite.getPosition().x,
            parasite.getPosition().z
        );

        if (currentTerritory?.queen) {
            currentTerritory.queen.removeControlledParasite(parasiteId);
        }

        newQueen.addControlledParasite(parasiteId);
    }

    /**
     * Get territorial statistics
     */
    public getTerritorialStats(): TerritorialStats {
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
     * Validate parasite control consistency
     */
    public validateParasiteControlConsistency(
        parasites: Map<string, ParasiteType>
    ): ParasiteControlValidation {
        const orphanedParasites: string[] = [];
        const wrongQueenControl: Array<{ parasiteId: string; expectedQueenId: string; actualQueenId: string }> = [];
        const duplicateControl: string[] = [];

        if (!this.territoryManager) {
            return { orphanedParasites, wrongQueenControl, duplicateControl };
        }

        const parasiteQueenMap = new Map<string, string>();

        const territories = this.territoryManager.getAllTerritories();
        for (const territory of territories) {
            const queen = territory.queen;
            if (queen && queen.isActiveQueen()) {
                const controlledParasites = queen.getControlledParasites();

                for (const parasiteId of controlledParasites) {
                    if (parasiteQueenMap.has(parasiteId)) {
                        duplicateControl.push(parasiteId);
                    } else {
                        parasiteQueenMap.set(parasiteId, queen.id);
                    }
                }
            }
        }

        for (const parasite of parasites.values()) {
            if (!parasite.isAlive()) {
                continue;
            }

            const parasiteId = parasite.getId();
            const parasitePosition = parasite.getPosition();
            const territory = this.territoryManager.getTerritoryAt(parasitePosition.x, parasitePosition.z);

            if (!territory) {
                if (parasiteQueenMap.has(parasiteId)) {
                    orphanedParasites.push(parasiteId);
                }
                continue;
            }

            const expectedQueen = territory.queen;
            const actualQueenId = parasiteQueenMap.get(parasiteId);

            if (!expectedQueen) {
                if (actualQueenId) {
                    orphanedParasites.push(parasiteId);
                }
            } else {
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
     * Recalculate all parasite control relationships
     */
    public recalculateParasiteControl(parasites: Map<string, ParasiteType>): void {
        if (!this.territoryManager) return;

        const territories = this.territoryManager.getAllTerritories();
        for (const territory of territories) {
            if (territory.queen && territory.queen.isActiveQueen()) {
                const controlledParasites = territory.queen.getControlledParasites();
                for (const parasiteId of controlledParasites) {
                    territory.queen.removeControlledParasite(parasiteId);
                }
            }
        }

        for (const parasite of parasites.values()) {
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
     * Clear all configurations
     */
    public dispose(): void {
        this.territorialConfigs.clear();
        this.territoryManager = null;
    }
}
