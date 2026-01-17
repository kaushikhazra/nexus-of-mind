/**
 * MiningAnalysisTooltip - Proximity-based mining potential analysis
 *
 * Shows mining potential analysis when clicking on mineral clusters.
 * Provides strategic information before base placement commitment.
 * Fix 19: Changed from hover to click to eliminate scene.pick() on mouse move.
 */

import { Scene, Vector3, PointerEventTypes } from '@babylonjs/core';
import { GameEngine } from '../game/GameEngine';
import { MineralDeposit } from '../world/MineralDeposit';
import { MovementAction } from '../game/actions/MovementAction';

export interface MiningTooltipAnalysis {
    nearbyNodes: MineralDeposit[];
    potentialWorkers: number;
    efficiency: 'high' | 'medium' | 'low';
    totalCapacity: number;
    recommendedBasePosition: Vector3;
    // Movement analysis for selected workers
    selectedWorkerAnalysis?: WorkerMovementAnalysis[];
}

export interface WorkerMovementAnalysis {
    workerId: string;
    distance: number;
    movementCost: number;
    currentEnergy: number;
    canReach: boolean;
    energyAfterMovement: number;
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
     * Setup mouse tracking for click detection on mineral deposits
     */
    private setupMouseTracking(): void {
        if (!this.scene) return;

        // Fix 19: Right-click to show mining analysis, any click to hide
        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
                const event = pointerInfo.event as PointerEvent;
                if (event.button === 2) { // Right-click: show tooltip
                    this.handleRightClick();
                } else { // Left-click: hide tooltip
                    this.hideTooltip();
                }
            }
        });
    }

    /**
     * Handle right-click for mineral deposit detection
     */
    private handleRightClick(): void {
        if (!this.scene) return;

        // Get world position from mouse
        const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        
        if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
            const clickPosition = pickInfo.pickedPoint.clone();
            
            // Check if clicked on or near a mineral deposit
            if (this.isClickOnMineralDeposit(pickInfo, clickPosition)) {
                const analysis = this.analyzeProximityToMinerals(clickPosition);
                
                if (analysis && analysis.nearbyNodes.length > 0) {
                    this.showTooltip(analysis);
                    this.updateTooltipPosition();
                } else {
                    this.hideTooltip();
                }
            } else {
                // Clicked elsewhere - hide tooltip
                this.hideTooltip();
            }
        } else {
            this.hideTooltip();
        }
    }

    /**
     * Check if click was on a mineral deposit
     */
    private isClickOnMineralDeposit(pickInfo: any, clickPosition: Vector3): boolean {
        // Check if clicked mesh is a mineral chunk
        if (pickInfo.pickedMesh && pickInfo.pickedMesh.name.startsWith('mineral_chunk_')) {
            return true;
        }

        // Also check proximity to any mineral deposit (in case click was near but not exactly on mesh)
        const gameEngine = GameEngine.getInstance();
        const terrainGenerator = gameEngine?.getTerrainGenerator();
        
        if (!terrainGenerator) return false;

        const allDeposits = terrainGenerator.getAllMineralDeposits();
        for (const deposit of allDeposits) {
            const distance = Vector3.Distance(clickPosition, deposit.getPosition());
            if (distance <= 3) { // Close proximity threshold for clicks
                return true;
            }
        }

        return false;
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

        // Check if workers are selected and add movement analysis
        let selectedWorkerAnalysis: WorkerMovementAnalysis[] | undefined = undefined;
        const unitManager = gameEngine?.getUnitManager();
        if (unitManager) {
            const selectedUnits = unitManager.getSelectedUnits();
            const selectedWorkers = selectedUnits.filter(unit => unit.getUnitType() === 'worker');
            
            if (selectedWorkers.length > 0) {
                selectedWorkerAnalysis = this.analyzeWorkerMovement(selectedWorkers, mousePosition);
            }
        }

        return {
            nearbyNodes,
            potentialWorkers: miningAnalysis.workerCount,
            efficiency: miningAnalysis.efficiency,
            totalCapacity: miningAnalysis.totalCapacity,
            recommendedBasePosition,
            selectedWorkerAnalysis
        };
    }

    /**
     * Analyze movement cost for selected workers to a mineral deposit
     */
    private analyzeWorkerMovement(workers: any[], depositPosition: Vector3): WorkerMovementAnalysis[] {
        const analyses: WorkerMovementAnalysis[] = [];
        
        for (const worker of workers) {
            const workerPosition = worker.getPosition();
            const distance = Vector3.Distance(workerPosition, depositPosition);
            
            // Get worker's current energy
            const workerEnergy = worker.getEnergyStorage().getCurrentEnergy();
            
            // Calculate movement cost
            const movementCostPerUnit = MovementAction.getMovementCost('worker');
            const totalMovementCost = distance * movementCostPerUnit;
            
            // Check if worker can reach the deposit
            const canReach = workerEnergy >= totalMovementCost;
            const energyAfterMovement = workerEnergy - totalMovementCost;
            
            analyses.push({
                workerId: worker.getId(),
                distance,
                movementCost: totalMovementCost,
                currentEnergy: workerEnergy,
                canReach,
                energyAfterMovement
            });
        }
        
        return analyses;
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
        
        // Check if we have selected worker analysis
        const hasWorkerAnalysis = analysis.selectedWorkerAnalysis && analysis.selectedWorkerAnalysis.length > 0;
        
        if (hasWorkerAnalysis) {
            // Show worker movement analysis
            return this.createWorkerAnalysisContent(analysis);
        } else {
            // Show standard mining analysis
            return this.createStandardMiningContent(analysis, efficiencyColor, efficiencyText);
        }
    }

    /**
     * Create standard mining analysis content
     */
    private createStandardMiningContent(analysis: MiningTooltipAnalysis, efficiencyColor: string, efficiencyText: string): string {
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
     * Create worker movement analysis content
     */
    private createWorkerAnalysisContent(analysis: MiningTooltipAnalysis): string {
        const workerAnalyses = analysis.selectedWorkerAnalysis!;
        const multipleWorkers = workerAnalyses.length > 1;
        
        let content = `
            <div style="font-size: 12px; font-weight: 700; text-align: center; margin-bottom: 8px; color: #ffa500; text-shadow: 0 0 8px rgba(255, 165, 0, 0.6);">
                ◊ WORKER MOVEMENT ◊
            </div>
        `;

        // Add basic mining info
        content += `
            <div style="margin-bottom: 6px;">
                <span style="color: #ffcc66;">Mineral Nodes:</span> 
                <span style="color: #ffffff; font-weight: 600;">${analysis.nearbyNodes.length}</span>
            </div>
        `;

        // Add worker analysis
        for (let i = 0; i < workerAnalyses.length; i++) {
            const workerAnalysis = workerAnalyses[i];
            const statusColor = workerAnalysis.canReach ? '#00ff00' : '#ff4444';
            const statusIcon = workerAnalysis.canReach ? '✅' : '❌';
            const workerLabel = multipleWorkers ? `Worker ${i + 1}` : 'Selected Worker';
            
            if (i > 0) {
                content += `<div style="border-top: 1px solid rgba(255, 165, 0, 0.2); margin: 6px 0; padding-top: 6px;"></div>`;
            }
            
            content += `
                <div style="margin-bottom: 4px;">
                    <span style="color: #ffcc66;">${workerLabel}:</span> 
                    <span style="color: ${statusColor}; font-weight: 600;">${statusIcon}</span>
                </div>
                
                <div style="margin-bottom: 4px; margin-left: 10px;">
                    <span style="color: #ffcc66;">Distance:</span> 
                    <span style="color: #ffffff; font-weight: 600;">${workerAnalysis.distance.toFixed(1)} units</span>
                </div>
                
                <div style="margin-bottom: 4px; margin-left: 10px;">
                    <span style="color: #ffcc66;">Cost:</span> 
                    <span style="color: #ffffff; font-weight: 600;">${workerAnalysis.movementCost.toFixed(1)}J</span>
                </div>
                
                <div style="margin-bottom: 4px; margin-left: 10px;">
                    <span style="color: #ffcc66;">Energy:</span> 
                    <span style="color: #ffffff; font-weight: 600;">${workerAnalysis.currentEnergy.toFixed(1)}J</span>
                </div>
            `;
            
            if (workerAnalysis.canReach) {
                content += `
                    <div style="margin-bottom: 4px; margin-left: 10px;">
                        <span style="color: #ffcc66;">After Move:</span> 
                        <span style="color: #00ff00; font-weight: 600;">${workerAnalysis.energyAfterMovement.toFixed(1)}J</span>
                    </div>
                `;
            } else {
                const energyNeeded = workerAnalysis.movementCost - workerAnalysis.currentEnergy;
                content += `
                    <div style="margin-bottom: 4px; margin-left: 10px;">
                        <span style="color: #ffcc66;">Need:</span> 
                        <span style="color: #ff4444; font-weight: 600;">+${energyNeeded.toFixed(1)}J</span>
                    </div>
                `;
            }
        }

        // Add summary
        const canReachCount = workerAnalyses.filter(w => w.canReach).length;
        const summaryColor = canReachCount === workerAnalyses.length ? '#00ff00' : 
                           canReachCount > 0 ? '#ffff00' : '#ff4444';
        
        content += `
            <div style="font-size: 10px; color: ${summaryColor}; text-align: center; border-top: 1px solid rgba(255, 165, 0, 0.2); padding-top: 6px; margin-top: 8px;">
                ${canReachCount}/${workerAnalyses.length} workers can reach this deposit
            </div>
        `;

        return content;
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
     * Update tooltip position based on click location
     */
    private updateTooltipPosition(): void {
        if (!this.tooltipElement || !this.isVisible) return;

        const mouseX = this.scene.pointerX;
        const mouseY = this.scene.pointerY;
        
        // Offset tooltip to avoid covering the clicked area
        const offsetX = 20;
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
            finalY = mouseY + 30; // Show below click point
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
    }
}