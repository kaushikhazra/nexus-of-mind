/**
 * InputHandler - Input event management and delegation
 * 
 * Handles all pointer and keyboard events, mouse picking, and selection logic.
 * Implements event delegation patterns for loose coupling between input
 * handling and game systems.
 */

import { Scene, PointerEventTypes, Vector3, Matrix } from '@babylonjs/core';
import { UnitManager } from '../UnitManager';
import { ParasiteManager } from '../ParasiteManager';
import { Worker } from '../entities/Worker';
import { Protector } from '../entities/Protector';
import { ProtectorSelectionUI } from '../../ui/ProtectorSelectionUI';

export class InputHandler {
    private scene: Scene;
    private unitManager: UnitManager | null = null;
    private parasiteManager: ParasiteManager | null = null;
    private protectorSelectionUI: ProtectorSelectionUI | null = null;
    private terrainGenerator: any = null;

    constructor(scene: Scene) {
        this.scene = scene;
        this.setupEventHandlers();
    }

    /**
     * Set the unit manager for unit selection and command handling
     */
    public setUnitManager(unitManager: UnitManager): void {
        this.unitManager = unitManager;
    }

    /**
     * Set the parasite manager for combat target handling
     */
    public setParasiteManager(parasiteManager: ParasiteManager): void {
        this.parasiteManager = parasiteManager;
    }

    /**
     * Set the protector selection UI for tooltips
     */
    public setProtectorSelectionUI(protectorSelectionUI: ProtectorSelectionUI): void {
        this.protectorSelectionUI = protectorSelectionUI;
    }

    /**
     * Set the terrain generator for height calculations
     */
    public setTerrainGenerator(terrainGenerator: any): void {
        this.terrainGenerator = terrainGenerator;
    }

    /**
     * Setup mouse interaction for unit selection and command issuing
     */
    private setupEventHandlers(): void {
        // Add pointer observable for mouse clicks
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
                const event = pointerInfo.event as PointerEvent;
                if (event.button === 2) {
                    // Right-click: Show Protector tooltip
                    this.handleRightClick();
                } else {
                    // Left-click: Normal click handling
                    this.handleMouseClick(pointerInfo);
                }
            }
        });
    }

    /**
     * Handle right-click for Protector info tooltip
     * Replaces hover-based detection to eliminate scene.pick() on mouse move
     */
    private handleRightClick(): void {
        if (!this.unitManager || !this.protectorSelectionUI) return;

        const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);

        if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
            const meshName = pickInfo.pickedMesh.name;

            // Check if right-clicked on a unit
            if (meshName.startsWith('unit_')) {
                const unitId = meshName.replace('unit_', '');
                const unit = this.unitManager.getUnit(unitId);

                if (unit && unit.getUnitType() === 'protector') {
                    // Show tooltip for Protector
                    this.protectorSelectionUI.show(
                        unit as Protector,
                        this.scene.pointerX,
                        this.scene.pointerY
                    );
                    return;
                }
            }
        }

        // Right-clicked elsewhere - hide tooltip
        this.protectorSelectionUI.hide();
    }

    /**
     * Handle mouse click for unit selection and combat/mining assignment
     */
    private handleMouseClick(pointerInfo: any): void {
        if (!this.unitManager) return;

        // Hide Protector tooltip on left-click (user clicked elsewhere)
        if (this.protectorSelectionUI) {
            this.protectorSelectionUI.hide();
        }

        // Get the pick result
        const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);

        if (!pickInfo || !pickInfo.hit) {
            // Clicked on empty space - issue move commands to selected units
            this.handleEmptySpaceClick();
            return;
        }

        const pickedMesh = pickInfo.pickedMesh;
        if (!pickedMesh) return;

        // Check if clicked on a unit
        if (pickedMesh.name.startsWith('unit_')) {
            this.handleUnitClick(pickedMesh);
        }
        // Check if clicked on a parasite (combat target)
        else if (pickedMesh.name.startsWith('parasite_')) {
            this.handleParasiteClick(pickedMesh);
        }
        // Check if clicked on a mineral deposit (mining target)
        else if (pickedMesh.name.startsWith('mineral_chunk_')) {
            this.handleMineralDepositClick(pickedMesh);
        }
        // Check if clicked on terrain (should be treated as movement command)
        else if (pickedMesh.name.startsWith('terrainChunk_') || 
                 pickedMesh.name.startsWith('ground') || 
                 pickedMesh.name.startsWith('terrain')) {
            this.handleTerrainClick(pickInfo);
        }
        // Clicked on something else - clear selection
        else {
            this.unitManager.clearSelection();
            this.protectorSelectionUI?.hide();
        }
    }

    /**
     * Handle clicking on empty space
     */
    private handleEmptySpaceClick(): void {
        if (!this.unitManager) return;

        const selectedUnits = this.unitManager.getSelectedUnits();
        if (selectedUnits.length === 0) {
            return;
        }

        // Get the world position where the user clicked
        const ray = this.scene.createPickingRay(
            this.scene.pointerX, 
            this.scene.pointerY, 
            Matrix.Identity(), 
            this.scene.activeCamera
        );
        
        // Intersect with ground plane (y = 0)
        const groundPlane = new Vector3(0, 1, 0); // Normal pointing up
        const groundPoint = new Vector3(0, 0, 0); // Point on plane
        
        // Calculate intersection with ground plane
        const denominator = Vector3.Dot(ray.direction, groundPlane);
        if (Math.abs(denominator) > 0.0001) {
            const t = Vector3.Dot(groundPoint.subtract(ray.origin), groundPlane) / denominator;
            if (t >= 0) {
                const clickPosition = ray.origin.add(ray.direction.scale(t));
                
                // Adjust height using terrain generator if available
                if (this.terrainGenerator) {
                    const terrainHeight = this.terrainGenerator.getHeightAtPosition(clickPosition.x, clickPosition.z);
                    clickPosition.y = terrainHeight + 0.5; // Slightly above ground
                }
                
                // Issue move commands to selected units (only Protectors can move to empty terrain)
                for (const unit of selectedUnits) {
                    // Workers should only move when clicking on minerals, not empty terrain
                    if (unit.getUnitType() === 'worker') {
                        continue;
                    }
                    this.unitManager.issueCommand('move', clickPosition, undefined, undefined);
                }

                // Clear selection to hide selection mesh after issuing move commands
                this.unitManager.clearSelection();
                this.protectorSelectionUI?.hide();
                return;
            }
        }

        // Clear selection if click position calculation failed
        this.unitManager.clearSelection();
        this.protectorSelectionUI?.hide();
    }

    /**
     * Handle clicking on a unit
     */
    private handleUnitClick(unitMesh: any): void {
        if (!this.unitManager) return;

        // Extract unit ID from mesh name (format: "unit_<unitId>")
        const unitId = unitMesh.name.replace('unit_', '');
        const unit = this.unitManager.getUnit(unitId);

        if (!unit) {
            return;
        }

        // Select the clicked unit (single selection for now)
        this.unitManager.selectUnits([unitId]);
    }

    /**
     * Handle clicking on a parasite (issues move commands for auto-attack)
     */
    private handleParasiteClick(parasiteMesh: any): void {
        if (!this.unitManager || !this.parasiteManager) return;

        const selectedUnits = this.unitManager.getSelectedUnits();
        if (selectedUnits.length === 0) {
            return;
        }

        let parasiteId: string;
        
        // Handle both direct parasite mesh clicks and segment clicks
        if (parasiteMesh.name.startsWith('parasite_segment_')) {
            // Clicked on a segment - get the parent node
            const parent = parasiteMesh.parent;
            if (parent && parent.name.startsWith('parasite_')) {
                parasiteId = parent.name.replace('parasite_', '');
            } else {
                // Fallback: extract from segment name
                const nameParts = parasiteMesh.name.split('_');
                if (nameParts.length >= 4) {
                    parasiteId = nameParts.slice(2, -1).join('_');
                } else {
                    return;
                }
            }
        } else if (parasiteMesh.name.startsWith('parasite_')) {
            // Direct parasite mesh click
            parasiteId = parasiteMesh.name.replace('parasite_', '');
        } else {
            return;
        }
        
        // Verify parasite exists and get its position
        const parasite = this.parasiteManager.getParasiteById(parasiteId);
        if (!parasite) {
            return;
        }

        // Get parasite position for movement command
        const parasitePosition = parasite.getPosition();

        // Issue move commands to selected protectors (auto-attack will trigger during movement)
        for (const unit of selectedUnits) {
            if (unit.getUnitType() === 'protector') {
                // Issue move command to parasite location - auto-attack will engage during movement
                this.unitManager.issueCommand('move', parasitePosition);
            }
        }
    }

    /**
     * Handle clicking on a mineral deposit
     */
    private handleMineralDepositClick(mineralMesh: any): void {
        if (!this.unitManager) return;

        const selectedUnits = this.unitManager.getSelectedUnits();
        if (selectedUnits.length === 0) {
            return;
        }

        // Extract mineral deposit ID from mesh name (format: "mineral_chunk_<depositId>_<chunkIndex>")
        const nameParts = mineralMesh.name.split('_');
        if (nameParts.length < 4) {
            return;
        }

        // Reconstruct the deposit ID (everything between "mineral_chunk_" and the last "_<chunkIndex>")
        const depositId = nameParts.slice(2, -1).join('_');

        // Get the mineral deposit from terrain generator
        if (!this.terrainGenerator) {
            return;
        }

        const mineralDeposit = this.terrainGenerator.getMineralDepositById(depositId);
        if (!mineralDeposit) {
            return;
        }

        // Assign selected workers to mine this deposit
        for (const unit of selectedUnits) {
            if (unit.getUnitType() === 'worker') {
                // Issue mining command
                this.unitManager.issueCommand('mine', undefined, depositId);
            }
        }
    }

    /**
     * Handle clicking on terrain (treat as movement command)
     */
    private handleTerrainClick(pickInfo: any): void {
        if (!this.unitManager) return;

        const selectedUnits = this.unitManager.getSelectedUnits();
        if (selectedUnits.length === 0) {
            return;
        }

        // Get the world position where the user clicked on terrain
        const clickPosition = pickInfo.pickedPoint;
        if (!clickPosition) {
            return;
        }

        // Adjust height using terrain generator if available
        if (this.terrainGenerator) {
            const terrainHeight = this.terrainGenerator.getHeightAtPosition(clickPosition.x, clickPosition.z);
            clickPosition.y = terrainHeight + 0.5; // Slightly above ground
        }

        // Issue move commands to selected units (only Protectors can move to empty terrain)
        for (const unit of selectedUnits) {
            // Workers should only move when clicking on minerals, not empty terrain
            if (unit.getUnitType() === 'worker') {
                continue;
            }
            this.unitManager.issueCommand('move', clickPosition, undefined, undefined);
        }

        // Clear selection to hide selection mesh after issuing move commands
        this.unitManager.clearSelection();
        this.protectorSelectionUI?.hide();
    }

    /**
     * Dispose of input handler resources
     */
    public dispose(): void {
        // Remove event listeners if needed
        // Babylon.js observables are automatically cleaned up when scene is disposed
    }
}