/**
 * MiningAnalysisTooltip - Proximity-based mining potential analysis
 * 
 * Shows mining potential analysis when mouse hovers near mineral clusters.
 * Provides strategic information before base placement commitment.
 */

import { Scene, Vector3 } from '@babylonjs/core';
import { GameEngine } from '../game/GameEngine';
import { MineralDeposit } from '../world/MineralDeposit';

export interface MiningTooltipAnalysis {
    nearbyNodes: MineralDeposit[];
    potentialWorkers: number;
    efficiency: 'high' | 'medium' | 'low';
    totalCapacity: number;
    recommendedBasePosition: Vector3;
}

export class MiningAnalysisTooltip {
    private scene: Scene;
    private tooltipElement: HTMLElement | null = null;
    private isVisible: boolean = false;
    private currentAnalysis: MiningTooltipAnalysis | null = null;
    
    // Constants
    private readonly PROXIMITY_THRESHOLD = 15; // Distance to show tooltip
    private readonly WORKER_MINING_RANGE = 5; // Worker mining range
    private readonly WORKER_SPAWN_DISTANCE = 3; // Distance workers spawn from base
    
    // Mouse tracking
    private pointerObserver: any = null;
    private lastMousePosition: Vector3 | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
        this.initialize();
    }

    /**
     * Initialize the tooltip system
     */
    private initialize(): void {
        this.createTooltipElement();
        this.setupMouseTracking();
        console.log('🔍 MiningAnalysisTooltip initialized');
    }

    /**
     * Create the tooltip HTML element
     */
    private createTooltipElement(): void {
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.id = 'mining-analysis-tooltip';
        this.tooltipElement.style.cssText = `
            position: fixed;
            background: rgba(0, 10, 20, 0.3);
            border: 1px solid rgba(0, 255, 255, 0.4);
            border-radius: 8px;
            padding: 12px;
            font-family: 'Orbitron', monospace;
            color: #00ffff;
            backdrop-filter: blur(8px);
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.2);
            font-size: 11px;
            pointer-events: none;
            z-index: 1000;
            display: none;
            min-width: 200px;
            max-width: 280px;
        `;

        document.body.appendChild(this.tooltipElement);
    }

    /**
     * Setup mouse tracking for proximity detection
     */
    private setupMouseTracking(): void {
        if (!this.scene) return;

        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === 1) { // POINTERMOVE
                this.handleMouseMove();
            }
        });
    }

    /**
     * Handle mouse movement for proximity detection
     */
    private handleMouseMove(): void {
        if (!this.scene) return;

        // Get world position from mouse
        const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        
        if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
            this.lastMousePosition = pickInfo.pickedPoint.clone();
            
            // Check proximity to mineral clusters
            const analysis = this.analyzeProximityToMinerals(this.lastMousePosition);
            
            if (analysis && analysis.nearbyNodes.length > 0) {
                this.showTooltip(analysis);
                this.updateTooltipPosition();
            } else {
                this.hideTooltip();
            }
        } else {
            this.hideTooltip();
        }
    }

    /**
     * Analyze proximity to mineral clusters
     */
    private analyzeProximityToMinerals(mousePosition: Vector3): MiningTooltipAnalysis | null {
        const gameEngine = GameEngine.getInstance();
        const terrainGenerator = gameEngine?.getTerrainGenerator();
        
        if (!terrainGenerator) return null;

        // Get all mineral deposits
        const allDeposits = terrainGenerator.getAllMineralDeposits();
        const nearbyNodes: MineralDeposit[] = [];

        // Find mineral nodes within proximity threshold
        for (const deposit of allDeposits) {
            const distance = Vector3.Distance(mousePosition, deposit.getPosition());
            if (distance <= this.PROXIMITY_THRESHOLD) {
                nearbyNodes.push(deposit);
            }
        }

        if (nearbyNodes.length === 0) return null;

        // Calculate optimal base position (center of nearby nodes)
        const recommendedBasePosition = this.calculateOptimalBasePosition(nearbyNodes, mousePosition);
        
        // Analyze mining potential from recommended base position
        const miningAnalysis = this.analyzeMiningPotentialFromPosition(recommendedBasePosition, allDeposits);

        return {
            nearbyNodes,
            potentialWorkers: miningAnalysis.workerCount,
            efficiency: miningAnalysis.efficiency,
            totalCapacity: miningAnalysis.totalCapacity,
            recommendedBasePosition
        };
    }

    /**
     * Calculate optimal base position for nearby mineral nodes
     */
    private calculateOptimalBasePosition(nearbyNodes: MineralDeposit[], mousePosition: Vector3): Vector3 {
        if (nearbyNodes.length === 1) {
            // Single node: place base at optimal distance
            const nodePos = nearbyNodes[0].getPosition();
            const direction = mousePosition.subtract(nodePos).normalize();
            return nodePos.add(direction.scale(this.WORKER_MINING_RANGE - 1));
        }

        // Multiple nodes: find center point
        let centerX = 0, centerZ = 0;
        for (const node of nearbyNodes) {
            const pos = node.getPosition();
            centerX += pos.x;
            centerZ += pos.z;
        }
        
        centerX /= nearbyNodes.length;
        centerZ /= nearbyNodes.length;
        
        return new Vector3(centerX, mousePosition.y, centerZ);
    }

    /**
     * Analyze mining potential from a specific base position
     */
    private analyzeMiningPotentialFromPosition(basePosition: Vector3, allDeposits: MineralDeposit[]): {
        workerCount: number;
        efficiency: 'high' | 'medium' | 'low';
        totalCapacity: number;
    } {
        const reachableNodes: MineralDeposit[] = [];
        let totalCapacity = 0;

        // Calculate worker spawn positions
        const workerPositions = this.calculateWorkerFormationPositions(basePosition);

        // Check which mineral nodes are reachable by workers
        for (const deposit of allDeposits) {
            const depositPosition = deposit.getPosition();
            let canReach = false;

            for (const workerPos of workerPositions) {
                const distance = Vector3.Distance(workerPos, depositPosition);
                if (distance <= this.WORKER_MINING_RANGE) {
                    canReach = true;
                    break;
                }
            }

            if (canReach) {
                reachableNodes.push(deposit);
                totalCapacity += deposit.getCapacity();
            }
        }

        // Calculate worker count and efficiency
        const workerCount = Math.min(10, reachableNodes.length * 2);
        
        let efficiency: 'high' | 'medium' | 'low';
        if (workerCount >= 8) {
            efficiency = 'high';
        } else if (workerCount >= 4) {
            efficiency = 'medium';
        } else {
            efficiency = 'low';
        }

        return { workerCount, efficiency, totalCapacity };
    }

    /**
     * Calculate worker formation positions around base
     */
    private calculateWorkerFormationPositions(basePosition: Vector3): Vector3[] {
        const positions: Vector3[] = [];
        const workerCount = 10;
        const radius = this.WORKER_SPAWN_DISTANCE;
        
        for (let i = 0; i < workerCount; i++) {
            const angle = (Math.PI / (workerCount - 1)) * i - Math.PI / 2;
            const x = basePosition.x + Math.cos(angle) * radius;
            const z = basePosition.z + Math.sin(angle) * radius;
            const y = basePosition.y;
            
            positions.push(new Vector3(x, y, z));
        }
        
        return positions;
    }

    /**
     * Show tooltip with mining analysis
     */
    private showTooltip(analysis: MiningTooltipAnalysis): void {
        if (!this.tooltipElement) return;

        this.currentAnalysis = analysis;
        this.isVisible = true;

        // Create tooltip content
        const content = this.createTooltipContent(analysis);
        this.tooltipElement.innerHTML = content;
        this.tooltipElement.style.display = 'block';
    }

    /**
     * Create tooltip content HTML
     */
    private createTooltipContent(analysis: MiningTooltipAnalysis): string {
        const efficiencyColor = this.getEfficiencyColor(analysis.efficiency);
        const efficiencyText = analysis.efficiency.toUpperCase();
        
        return `
            <div style="font-size: 12px; font-weight: 700; text-align: center; margin-bottom: 8px; color: #00ffff; text-shadow: 0 0 8px rgba(0, 255, 255, 0.6);">
                ◊ MINING ANALYSIS ◊
            </div>
            
            <div style="margin-bottom: 6px;">
                <span style="color: #00ccff;">Mineral Nodes:</span> 
                <span style="color: #ffffff; font-weight: 600;">${analysis.nearbyNodes.length}</span>
            </div>
            
            <div style="margin-bottom: 6px;">
                <span style="color: #00ccff;">Workers Can Mine:</span> 
                <span style="color: #ffffff; font-weight: 600;">${analysis.potentialWorkers}/10</span>
            </div>
            
            <div style="margin-bottom: 6px;">
                <span style="color: #00ccff;">Efficiency:</span> 
                <span style="color: ${efficiencyColor}; font-weight: 600;">${efficiencyText}</span>
            </div>
            
            <div style="margin-bottom: 8px;">
                <span style="color: #00ccff;">Total Capacity:</span> 
                <span style="color: #ffffff; font-weight: 600;">${analysis.totalCapacity.toFixed(0)}J</span>
            </div>
            
            <div style="font-size: 10px; color: #888888; text-align: center; border-top: 1px solid rgba(0, 255, 255, 0.2); padding-top: 6px;">
                ${this.getRecommendationText(analysis.efficiency)}
            </div>
        `;
    }

    /**
     * Get efficiency color
     */
    private getEfficiencyColor(efficiency: 'high' | 'medium' | 'low'): string {
        switch (efficiency) {
            case 'high': return '#00ff00';   // Green
            case 'medium': return '#ffff00'; // Yellow
            case 'low': return '#ff8800';    // Orange
        }
    }

    /**
     * Get recommendation text based on efficiency
     */
    private getRecommendationText(efficiency: 'high' | 'medium' | 'low'): string {
        switch (efficiency) {
            case 'high': return 'Excellent base location - high mining yield';
            case 'medium': return 'Good base location - moderate mining yield';
            case 'low': return 'Poor base location - consider other areas';
        }
    }

    /**
     * Update tooltip position to follow mouse
     */
    private updateTooltipPosition(): void {
        if (!this.tooltipElement || !this.isVisible) return;

        const mouseX = this.scene.pointerX;
        const mouseY = this.scene.pointerY;
        
        // Offset tooltip to avoid covering cursor
        const offsetX = 15;
        const offsetY = -10;
        
        // Ensure tooltip stays within viewport
        const tooltipRect = this.tooltipElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let finalX = mouseX + offsetX;
        let finalY = mouseY + offsetY;
        
        // Adjust if tooltip would go off-screen
        if (finalX + tooltipRect.width > viewportWidth) {
            finalX = mouseX - tooltipRect.width - offsetX;
        }
        
        if (finalY < 0) {
            finalY = mouseY + 20; // Show below cursor
        }
        
        this.tooltipElement.style.left = `${finalX}px`;
        this.tooltipElement.style.top = `${finalY}px`;
    }

    /**
     * Hide tooltip
     */
    private hideTooltip(): void {
        if (!this.tooltipElement) return;

        this.isVisible = false;
        this.currentAnalysis = null;
        this.tooltipElement.style.display = 'none';
    }

    /**
     * Set tooltip visibility
     */
    public setEnabled(enabled: boolean): void {
        if (!enabled) {
            this.hideTooltip();
        }
        // Mouse tracking continues, but tooltip won't show when disabled
    }

    /**
     * Dispose tooltip system
     */
    public dispose(): void {
        // Remove pointer observer
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }

        // Remove tooltip element
        if (this.tooltipElement && this.tooltipElement.parentNode) {
            this.tooltipElement.parentNode.removeChild(this.tooltipElement);
            this.tooltipElement = null;
        }

        console.log('🔍 MiningAnalysisTooltip disposed');
    }
}