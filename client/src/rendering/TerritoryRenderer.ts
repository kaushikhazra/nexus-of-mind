/**
 * TerritoryRenderer - 3D territory boundary visualization and visual effects
 * 
 * Manages 3D visualization of territory boundaries, Queen status indicators,
 * liberation effects, and territory entry/exit visual feedback in the game world.
 */

import {
    Scene,
    Mesh,
    MeshBuilder,
    StandardMaterial,
    Color3,
    Color4,
    Vector3,
    TransformNode,
    Animation,
    IAnimationKey,
    LinesMesh,
    DynamicTexture,
    ParticleSystem,
    Texture
} from '@babylonjs/core';
import { MaterialManager } from './MaterialManager';
import { TerritoryManager, Territory } from '../game/TerritoryManager';
import { Queen, QueenPhase } from '../game/entities/Queen';

export interface TerritoryVisual {
    territory: Territory;
    boundaryLines: LinesMesh[];
    boundaryMarkers: Mesh[];
    statusIndicator: Mesh | null;
    liberationEffect: ParticleSystem | null;
    queenStatusBeacon: Mesh | null;
    rootNode: TransformNode;
    isVisible: boolean;
}

export interface TerritoryRendererConfig {
    showBoundaries: boolean;
    showStatusIndicators: boolean;
    showLiberationEffects: boolean;
    maxVisibleTerritories: number;
    boundaryOpacity: number;
    updateInterval: number;
}

export class TerritoryRenderer {
    private scene: Scene;
    private materialManager: MaterialManager;
    private territoryManager: TerritoryManager | null = null;
    
    // Territory visuals management
    private territoryVisuals: Map<string, TerritoryVisual> = new Map();
    private playerPosition: Vector3 | null = null;
    
    // Materials for territory visualization
    private boundaryMaterial: StandardMaterial | null = null;
    private liberatedBoundaryMaterial: StandardMaterial | null = null;
    private queenControlledBoundaryMaterial: StandardMaterial | null = null;
    private contestedBoundaryMaterial: StandardMaterial | null = null;
    
    // Status indicator materials
    private queenBeaconMaterial: StandardMaterial | null = null;
    private liberationBeaconMaterial: StandardMaterial | null = null;
    
    // Configuration
    private config: TerritoryRendererConfig;
    
    // Update management
    private updateInterval: number | null = null;

    constructor(scene: Scene, materialManager: MaterialManager, config?: Partial<TerritoryRendererConfig>) {
        this.scene = scene;
        this.materialManager = materialManager;
        
        this.config = {
            showBoundaries: true,
            showStatusIndicators: true,
            showLiberationEffects: true,
            maxVisibleTerritories: 9, // 3x3 grid around player
            boundaryOpacity: 0.6,
            updateInterval: 2000, // Update every 2 seconds
            ...config
        };
        
        this.initializeMaterials();
        this.startUpdates();
    }

    /**
     * Set territory manager reference
     */
    public setTerritoryManager(territoryManager: TerritoryManager): void {
        this.territoryManager = territoryManager;
    }

    /**
     * Set player position for territory visibility culling
     */
    public setPlayerPosition(position: Vector3): void {
        this.playerPosition = position;
    }

    /**
     * Initialize materials for territory visualization
     */
    private initializeMaterials(): void {
        // Default boundary material (contested territories)
        this.contestedBoundaryMaterial = new StandardMaterial('contestedBoundaryMaterial', this.scene);
        this.contestedBoundaryMaterial.diffuseColor = new Color3(1, 0.5, 0); // Orange
        this.contestedBoundaryMaterial.emissiveColor = new Color3(0.3, 0.15, 0);
        this.contestedBoundaryMaterial.alpha = this.config.boundaryOpacity;
        this.contestedBoundaryMaterial.needDepthPrePass = true;

        // Liberated territory boundary material
        this.liberatedBoundaryMaterial = new StandardMaterial('liberatedBoundaryMaterial', this.scene);
        this.liberatedBoundaryMaterial.diffuseColor = new Color3(0, 1, 0); // Green
        this.liberatedBoundaryMaterial.emissiveColor = new Color3(0, 0.4, 0);
        this.liberatedBoundaryMaterial.alpha = this.config.boundaryOpacity;
        this.liberatedBoundaryMaterial.needDepthPrePass = true;

        // Queen controlled territory boundary material
        this.queenControlledBoundaryMaterial = new StandardMaterial('queenControlledBoundaryMaterial', this.scene);
        this.queenControlledBoundaryMaterial.diffuseColor = new Color3(1, 0, 0); // Red
        this.queenControlledBoundaryMaterial.emissiveColor = new Color3(0.4, 0, 0);
        this.queenControlledBoundaryMaterial.alpha = this.config.boundaryOpacity;
        this.queenControlledBoundaryMaterial.needDepthPrePass = true;

        // Queen beacon material (floating above hive/territory center)
        this.queenBeaconMaterial = new StandardMaterial('queenBeaconMaterial', this.scene);
        this.queenBeaconMaterial.diffuseColor = new Color3(1, 0, 1); // Magenta
        this.queenBeaconMaterial.emissiveColor = new Color3(0.8, 0, 0.8);
        this.queenBeaconMaterial.disableLighting = true;

        // Liberation beacon material
        this.liberationBeaconMaterial = new StandardMaterial('liberationBeaconMaterial', this.scene);
        this.liberationBeaconMaterial.diffuseColor = new Color3(0, 1, 1); // Cyan
        this.liberationBeaconMaterial.emissiveColor = new Color3(0, 0.8, 0.8);
        this.liberationBeaconMaterial.disableLighting = true;
    }

    /**
     * Start periodic updates
     */
    private startUpdates(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = window.setInterval(() => {
            this.updateTerritoryVisuals();
        }, this.config.updateInterval);
    }

    /**
     * Update territory visuals based on current state
     */
    private updateTerritoryVisuals(): void {
        if (!this.territoryManager || !this.playerPosition) return;

        // Get territories near player
        const nearbyTerritories = this.territoryManager.getTerritoriesInRange(
            this.playerPosition,
            2048 // Show territories within 2048 units (2 territory widths)
        );

        // Limit to max visible territories
        const visibleTerritories = nearbyTerritories
            .slice(0, this.config.maxVisibleTerritories);

        const activeVisualIds = new Set<string>();

        // Update or create visuals for visible territories
        for (const territory of visibleTerritories) {
            this.updateTerritoryVisual(territory);
            activeVisualIds.add(territory.id);
        }

        // Remove visuals for territories that are no longer visible
        for (const [territoryId, visual] of this.territoryVisuals) {
            if (!activeVisualIds.has(territoryId)) {
                this.removeTerritoryVisual(territoryId);
            }
        }
    }

    /**
     * Update or create visual for a specific territory
     */
    private updateTerritoryVisual(territory: Territory): void {
        let visual = this.territoryVisuals.get(territory.id);
        
        if (!visual) {
            visual = this.createTerritoryVisual(territory);
            this.territoryVisuals.set(territory.id, visual);
        }

        // Update visual based on territory state
        this.updateTerritoryState(visual);
    }

    /**
     * Create visual representation for a territory
     */
    private createTerritoryVisual(territory: Territory): TerritoryVisual {
        // Create root node for territory visual
        const rootNode = new TransformNode(`territory_visual_${territory.id}`, this.scene);
        // Position at territory center above terrain
        rootNode.position = new Vector3(
            territory.centerPosition.x,
            5, // Above terrain level
            territory.centerPosition.z
        );

        // Create boundary visualization
        const boundaryLines = this.createTerritoryBoundary(territory, rootNode);
        const boundaryMarkers = this.createBoundaryMarkers(territory, rootNode);

        // Create status indicator (will be updated based on territory state)
        const statusIndicator = this.createStatusIndicator(territory, rootNode);

        const visual: TerritoryVisual = {
            territory,
            boundaryLines,
            boundaryMarkers,
            statusIndicator,
            liberationEffect: null,
            queenStatusBeacon: null,
            rootNode,
            isVisible: true
        };

        return visual;
    }

    /**
     * Create territory boundary lines
     */
    private createTerritoryBoundary(territory: Territory, rootNode: TransformNode): LinesMesh[] {
        const bounds = territory.chunkBounds;
        const lines: LinesMesh[] = [];

        if (!this.config.showBoundaries) return lines;

        // Create boundary rectangle at ground level
        const corners = [
            new Vector3(bounds.minX - territory.centerPosition.x, 0.5, bounds.minZ - territory.centerPosition.z),
            new Vector3(bounds.maxX - territory.centerPosition.x, 0.5, bounds.minZ - territory.centerPosition.z),
            new Vector3(bounds.maxX - territory.centerPosition.x, 0.5, bounds.maxZ - territory.centerPosition.z),
            new Vector3(bounds.minX - territory.centerPosition.x, 0.5, bounds.maxZ - territory.centerPosition.z),
            new Vector3(bounds.minX - territory.centerPosition.x, 0.5, bounds.minZ - territory.centerPosition.z) // Close the loop
        ];

        // Create main boundary line
        const boundaryLine = MeshBuilder.CreateLines(`boundary_${territory.id}`, {
            points: corners
        }, this.scene);
        boundaryLine.parent = rootNode;
        boundaryLine.material = this.getBoundaryMaterial(territory.controlStatus);
        lines.push(boundaryLine);

        // Create corner markers (small vertical lines)
        for (let i = 0; i < 4; i++) {
            const corner = corners[i];
            const markerPoints = [
                corner,
                corner.add(new Vector3(0, 2, 0)) // 2 units high
            ];

            const cornerMarker = MeshBuilder.CreateLines(`corner_${territory.id}_${i}`, {
                points: markerPoints
            }, this.scene);
            cornerMarker.parent = rootNode;
            cornerMarker.material = this.getBoundaryMaterial(territory.controlStatus);
            lines.push(cornerMarker);
        }

        return lines;
    }

    /**
     * Create boundary markers (small cubes at corners)
     */
    private createBoundaryMarkers(territory: Territory, rootNode: TransformNode): Mesh[] {
        const markers: Mesh[] = [];
        const bounds = territory.chunkBounds;

        if (!this.config.showStatusIndicators) return markers;

        // Create small markers at territory corners
        const cornerPositions = [
            new Vector3(bounds.minX - territory.centerPosition.x, 1, bounds.minZ - territory.centerPosition.z),
            new Vector3(bounds.maxX - territory.centerPosition.x, 1, bounds.minZ - territory.centerPosition.z),
            new Vector3(bounds.maxX - territory.centerPosition.x, 1, bounds.maxZ - territory.centerPosition.z),
            new Vector3(bounds.minX - territory.centerPosition.x, 1, bounds.maxZ - territory.centerPosition.z)
        ];

        for (let i = 0; i < cornerPositions.length; i++) {
            const marker = MeshBuilder.CreateBox(`marker_${territory.id}_${i}`, {
                size: 1
            }, this.scene);
            marker.parent = rootNode;
            marker.position = cornerPositions[i];
            marker.material = this.getBoundaryMaterial(territory.controlStatus);
            markers.push(marker);
        }

        return markers;
    }

    /**
     * Create status indicator for territory center
     * Currently disabled - Hive mesh serves as the visual indicator
     */
    private createStatusIndicator(territory: Territory, rootNode: TransformNode): Mesh | null {
        // Beacon removed - Hive mesh provides visual indicator
        return null;
    }

    /**
     * Update territory visual state
     */
    private updateTerritoryState(visual: TerritoryVisual): void {
        const territory = visual.territory;

        // Update boundary materials
        const boundaryMaterial = this.getBoundaryMaterial(territory.controlStatus);
        for (const line of visual.boundaryLines) {
            line.material = boundaryMaterial;
        }
        for (const marker of visual.boundaryMarkers) {
            marker.material = boundaryMaterial;
        }

        // Update status indicator
        if (visual.statusIndicator) {
            visual.statusIndicator.material = this.getStatusBeaconMaterial(territory.controlStatus);
        }

        // Update Queen status beacon
        this.updateQueenStatusBeacon(visual);

        // Update liberation effects
        this.updateLiberationEffects(visual);
    }

    /**
     * Update Queen status beacon
     * Currently disabled - Hive mesh serves as the visual indicator
     */
    private updateQueenStatusBeacon(visual: TerritoryVisual): void {
        // Queen beacon removed - Hive mesh provides visual indicator
        if (visual.queenStatusBeacon) {
            visual.queenStatusBeacon.dispose();
            visual.queenStatusBeacon = null;
        }
    }

    /**
     * Update Queen beacon color based on phase and vulnerability
     */
    private updateQueenBeaconColor(beacon: Mesh, phase: QueenPhase, isVulnerable: boolean): void {
        if (!beacon.material || !(beacon.material instanceof StandardMaterial)) return;

        const material = beacon.material as StandardMaterial;

        switch (phase) {
            case QueenPhase.UNDERGROUND_GROWTH:
                // Brown/earth color for underground
                material.diffuseColor = new Color3(0.6, 0.4, 0.2);
                material.emissiveColor = new Color3(0.3, 0.2, 0.1);
                break;
            case QueenPhase.HIVE_CONSTRUCTION:
                // Orange for construction
                material.diffuseColor = new Color3(1, 0.5, 0);
                material.emissiveColor = new Color3(0.5, 0.25, 0);
                break;
            case QueenPhase.ACTIVE_CONTROL:
                if (isVulnerable) {
                    // Bright red for vulnerable Queen
                    material.diffuseColor = new Color3(1, 0, 0);
                    material.emissiveColor = new Color3(0.8, 0, 0);
                } else {
                    // Dark red for protected Queen
                    material.diffuseColor = new Color3(0.6, 0, 0);
                    material.emissiveColor = new Color3(0.3, 0, 0);
                }
                break;
        }
    }

    /**
     * Update liberation effects
     */
    private updateLiberationEffects(visual: TerritoryVisual): void {
        const territory = visual.territory;

        if (territory.controlStatus === 'liberated' && this.config.showLiberationEffects) {
            if (!visual.liberationEffect) {
                // Create liberation particle effect
                visual.liberationEffect = this.createLiberationParticleEffect(visual.rootNode);
            }
        } else if (visual.liberationEffect) {
            // Remove liberation effect
            visual.liberationEffect.dispose();
            visual.liberationEffect = null;
        }
    }

    /**
     * Create liberation particle effect
     */
    private createLiberationParticleEffect(rootNode: TransformNode): ParticleSystem {
        const particleSystem = new ParticleSystem('liberationEffect', 50, this.scene);
        
        // Set emitter using position since TransformNode is not directly assignable
        particleSystem.emitter = rootNode.position.clone();
        particleSystem.minEmitBox = new Vector3(-500, 0, -500);
        particleSystem.maxEmitBox = new Vector3(500, 0, 500);

        // Particle appearance
        particleSystem.particleTexture = new Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', this.scene);
        particleSystem.color1 = new Color4(0, 1, 0, 1); // Green
        particleSystem.color2 = new Color4(0, 1, 1, 1); // Cyan
        particleSystem.colorDead = new Color4(0, 0.5, 0.5, 1);

        // Particle behavior
        particleSystem.minSize = 0.5;
        particleSystem.maxSize = 2;
        particleSystem.minLifeTime = 2;
        particleSystem.maxLifeTime = 4;
        particleSystem.emitRate = 10;

        // Movement
        particleSystem.direction1 = new Vector3(0, 1, 0);
        particleSystem.direction2 = new Vector3(0, 2, 0);
        particleSystem.minEmitPower = 1;
        particleSystem.maxEmitPower = 3;
        particleSystem.gravity = new Vector3(0, -1, 0);

        particleSystem.start();
        return particleSystem;
    }

    /**
     * Get boundary material based on territory status
     */
    private getBoundaryMaterial(controlStatus: string): StandardMaterial {
        switch (controlStatus) {
            case 'queen_controlled':
                return this.queenControlledBoundaryMaterial!;
            case 'liberated':
                return this.liberatedBoundaryMaterial!;
            case 'contested':
                return this.contestedBoundaryMaterial!;
            default:
                return this.contestedBoundaryMaterial!;
        }
    }

    /**
     * Get status beacon material based on territory status
     */
    private getStatusBeaconMaterial(controlStatus: string): StandardMaterial {
        switch (controlStatus) {
            case 'queen_controlled':
                return this.queenBeaconMaterial!;
            case 'liberated':
                return this.liberationBeaconMaterial!;
            case 'contested':
                return this.contestedBoundaryMaterial!;
            default:
                return this.contestedBoundaryMaterial!;
        }
    }

    /**
     * Animate status beacon with pulsing effect
     */
    private animateStatusBeacon(beacon: Mesh): void {
        // Pulsing scale animation
        Animation.CreateAndStartAnimation(
            'beaconPulse',
            beacon,
            'scaling',
            30,
            60,
            new Vector3(1, 1, 1),
            new Vector3(1.2, 1.2, 1.2),
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        // Floating animation
        Animation.CreateAndStartAnimation(
            'beaconFloat',
            beacon,
            'position.y',
            30,
            90,
            8,
            10,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );
    }

    /**
     * Remove territory visual
     */
    private removeTerritoryVisual(territoryId: string): void {
        const visual = this.territoryVisuals.get(territoryId);
        if (!visual) return;

        // Dispose all visual elements
        for (const line of visual.boundaryLines) {
            line.dispose();
        }
        for (const marker of visual.boundaryMarkers) {
            marker.dispose();
        }
        if (visual.statusIndicator) {
            visual.statusIndicator.dispose();
        }
        if (visual.liberationEffect) {
            visual.liberationEffect.dispose();
        }
        if (visual.queenStatusBeacon) {
            visual.queenStatusBeacon.dispose();
        }
        visual.rootNode.dispose();

        this.territoryVisuals.delete(territoryId);
    }

    /**
     * Set configuration
     */
    public updateConfig(newConfig: Partial<TerritoryRendererConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Update existing visuals if needed
        for (const visual of this.territoryVisuals.values()) {
            this.updateTerritoryState(visual);
        }

        if (newConfig.updateInterval) {
            this.startUpdates();
        }
    }

    /**
     * Get rendering statistics
     */
    public getRenderingStats(): {
        totalTerritories: number;
        visibleTerritories: number;
        territoriesByStatus: { [key: string]: number };
    } {
        const stats = {
            totalTerritories: this.territoryVisuals.size,
            visibleTerritories: 0,
            territoriesByStatus: {} as { [key: string]: number }
        };

        for (const visual of this.territoryVisuals.values()) {
            if (visual.isVisible) {
                stats.visibleTerritories++;
            }

            const status = visual.territory.controlStatus;
            stats.territoriesByStatus[status] = (stats.territoriesByStatus[status] || 0) + 1;
        }

        return stats;
    }

    /**
     * Dispose territory renderer
     */
    public dispose(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        // Remove all territory visuals
        for (const territoryId of this.territoryVisuals.keys()) {
            this.removeTerritoryVisual(territoryId);
        }

        // Dispose materials
        this.boundaryMaterial?.dispose();
        this.liberatedBoundaryMaterial?.dispose();
        this.queenControlledBoundaryMaterial?.dispose();
        this.contestedBoundaryMaterial?.dispose();
        this.queenBeaconMaterial?.dispose();
        this.liberationBeaconMaterial?.dispose();
    }
}