/**
 * MineralDeposit - Mineral deposits that generate energy when mined
 * 
 * Represents finite mineral resources in the world that can be extracted
 * for energy generation. Integrates with terrain generation and provides
 * visual feedback for resource availability.
 */

import { Vector3, Mesh, MeshBuilder, StandardMaterial, Color3, Scene } from '@babylonjs/core';
import { MaterialManager } from '../rendering/MaterialManager';

export interface MineralDepositConfig {
    position: Vector3;
    capacity: number;
    extractionRate?: number;
    biome?: string;
    visible?: boolean;
    size?: number;
}

export interface MineralDepositStats {
    capacity: number;
    remaining: number;
    extracted: number;
    percentage: number;
    extractionRate: number;
    isVisible: boolean;
    isDepleted: boolean;
    biome: string;
}

export class MineralDeposit {
    private id: string;
    private position: Vector3;
    private capacity: number;
    private remaining: number;
    private extractionRate: number;
    private biome: string;
    private visible: boolean;
    private size: number;
    
    // Visual representation
    private mesh: Mesh | null = null;
    private material: StandardMaterial | null = null;
    private scene: Scene | null = null;
    
    // Mining state
    private isBeingMined: boolean = false;
    private lastMiningTime: number = 0;
    private totalExtracted: number = 0;
    
    // Event callbacks
    private onDepletedCallbacks: ((deposit: MineralDeposit) => void)[] = [];
    private onDiscoveredCallbacks: ((deposit: MineralDeposit) => void)[] = [];
    private onMinedCallbacks: ((deposit: MineralDeposit, amount: number) => void)[] = [];

    constructor(config: MineralDepositConfig) {
        this.id = `mineral_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.position = config.position.clone();
        this.capacity = config.capacity;
        this.remaining = config.capacity;
        this.extractionRate = config.extractionRate || 2.0; // 2 energy per second default
        this.biome = config.biome || 'unknown';
        this.visible = config.visible !== false; // Default to visible
        this.size = config.size || 1.0;
        
        console.log(`💎 MineralDeposit created: ${this.id} at ${this.position.toString()} (${this.capacity} energy)`);
    }

    /**
     * Initialize visual representation
     */
    public initializeVisual(scene: Scene, materialManager: MaterialManager): void {
        this.scene = scene;
        
        if (!this.visible) {
            return; // Hidden deposits have no visual representation until discovered
        }
        
        this.createMesh(materialManager);
    }

    /**
     * Create the 3D mesh for the mineral deposit
     */
    private createMesh(materialManager: MaterialManager): void {
        if (!this.scene) return;

        // Create crystal-like geometry using a tapered cylinder
        this.mesh = MeshBuilder.CreateCylinder(`mineral_${this.id}`, {
            diameterTop: this.size * 0.3,      // Narrow top
            diameterBottom: this.size,          // Wider bottom
            height: this.size * 1.8,            // Tall crystal
            tessellation: 6,                    // Hexagonal for crystal look
            subdivisions: 1                     // Low poly
        }, this.scene);

        // Position the mesh
        this.mesh.position = this.position.clone();
        this.mesh.position.y += (this.size * 1.8) / 2; // Raise above ground

        // Get or create mineral material
        this.material = materialManager.getMineralMaterial();
        if (this.material) {
            this.mesh.material = this.material;
        }

        // Add some rotation for visual interest
        this.mesh.rotation.y = Math.random() * Math.PI * 2;
        this.mesh.rotation.x = (Math.random() - 0.5) * 0.2; // Slight tilt
        this.mesh.rotation.z = (Math.random() - 0.5) * 0.2;

        console.log(`💎 Crystal visual created for mineral deposit ${this.id}`);
    }

    /**
     * Update visual based on remaining capacity
     */
    private updateVisual(): void {
        if (!this.mesh || !this.material) return;

        const percentage = this.remaining / this.capacity;
        
        // Scale mesh based on remaining minerals
        const scale = Math.max(0.2, percentage); // Minimum 20% scale
        this.mesh.scaling = new Vector3(scale, scale, scale);
        
        // Change material properties based on depletion
        if (percentage < 0.2) {
            // Nearly depleted - darker, less emissive
            this.material.emissiveColor = new Color3(0.1, 0.3, 0.5);
        } else if (percentage < 0.5) {
            // Half depleted - medium glow
            this.material.emissiveColor = new Color3(0.2, 0.5, 0.8);
        } else {
            // Rich deposit - bright glow
            this.material.emissiveColor = new Color3(0.3, 0.7, 1.0);
        }
    }

    /**
     * Attempt to mine energy from this deposit
     */
    public mine(deltaTime: number): number {
        if (this.remaining <= 0) {
            console.warn(`⚠️ Cannot mine depleted deposit ${this.id}`);
            return 0;
        }

        if (!this.visible) {
            console.warn(`⚠️ Cannot mine hidden deposit ${this.id} - must be discovered first`);
            return 0;
        }

        // Calculate energy to extract based on time and extraction rate
        const energyToExtract = Math.min(
            this.extractionRate * deltaTime,
            this.remaining
        );

        if (energyToExtract <= 0) {
            return 0;
        }

        // Extract energy
        this.remaining -= energyToExtract;
        this.totalExtracted += energyToExtract;
        this.lastMiningTime = performance.now();
        this.isBeingMined = true;

        // Update visual representation
        this.updateVisual();

        // Trigger callbacks
        this.onMinedCallbacks.forEach(callback => callback(this, energyToExtract));

        // Check if depleted
        if (this.remaining <= 0) {
            this.onDepletedCallbacks.forEach(callback => callback(this));
            console.log(`💎 Mineral deposit ${this.id} depleted after extracting ${this.totalExtracted} energy`);
        }

        console.log(`💎 Mined ${energyToExtract.toFixed(2)} energy from ${this.id} (${this.remaining.toFixed(2)} remaining)`);
        return energyToExtract;
    }

    /**
     * Discover a hidden mineral deposit
     */
    public discover(scene: Scene, materialManager: MaterialManager): boolean {
        if (this.visible) {
            return false; // Already visible
        }

        this.visible = true;
        this.scene = scene;
        this.createMesh(materialManager);
        
        this.onDiscoveredCallbacks.forEach(callback => callback(this));
        console.log(`💎 Mineral deposit ${this.id} discovered!`);
        
        return true;
    }

    /**
     * Check if deposit can be mined
     */
    public canMine(): boolean {
        return this.remaining > 0 && this.visible;
    }

    /**
     * Get deposit statistics
     */
    public getStats(): MineralDepositStats {
        return {
            capacity: this.capacity,
            remaining: this.remaining,
            extracted: this.totalExtracted,
            percentage: this.capacity > 0 ? this.remaining / this.capacity : 0,
            extractionRate: this.extractionRate,
            isVisible: this.visible,
            isDepleted: this.remaining <= 0,
            biome: this.biome
        };
    }

    /**
     * Get deposit ID
     */
    public getId(): string {
        return this.id;
    }

    /**
     * Get deposit position
     */
    public getPosition(): Vector3 {
        return this.position.clone();
    }

    /**
     * Get remaining energy
     */
    public getRemaining(): number {
        return this.remaining;
    }

    /**
     * Get total capacity
     */
    public getCapacity(): number {
        return this.capacity;
    }

    /**
     * Check if deposit is visible
     */
    public isVisible(): boolean {
        return this.visible;
    }

    /**
     * Check if deposit is depleted
     */
    public isDepleted(): boolean {
        return this.remaining <= 0;
    }

    /**
     * Get biome type
     */
    public getBiome(): string {
        return this.biome;
    }

    /**
     * Check if currently being mined
     */
    public isCurrentlyBeingMined(): boolean {
        const now = performance.now();
        return this.isBeingMined && (now - this.lastMiningTime) < 2000; // 2 second timeout
    }

    /**
     * Stop mining (called when miner moves away)
     */
    public stopMining(): void {
        this.isBeingMined = false;
        console.log(`💎 Stopped mining deposit ${this.id}`);
    }

    /**
     * Subscribe to depletion events
     */
    public onDepleted(callback: (deposit: MineralDeposit) => void): void {
        this.onDepletedCallbacks.push(callback);
    }

    /**
     * Subscribe to discovery events
     */
    public onDiscovered(callback: (deposit: MineralDeposit) => void): void {
        this.onDiscoveredCallbacks.push(callback);
    }

    /**
     * Subscribe to mining events
     */
    public onMined(callback: (deposit: MineralDeposit, amount: number) => void): void {
        this.onMinedCallbacks.push(callback);
    }

    /**
     * Dispose mineral deposit and cleanup resources
     */
    public dispose(): void {
        if (this.mesh) {
            this.mesh.dispose();
            this.mesh = null;
        }

        if (this.material) {
            // Don't dispose material as it's shared from MaterialManager
            this.material = null;
        }

        this.onDepletedCallbacks = [];
        this.onDiscoveredCallbacks = [];
        this.onMinedCallbacks = [];

        console.log(`💎 MineralDeposit ${this.id} disposed`);
    }
}