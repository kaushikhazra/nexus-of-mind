/**
 * CombatUI - User interface elements for combat system
 *
 * Provides visual feedback for combat actions including attack cursors,
 * range indicators, energy cost previews, and combat status displays.
 * Integrates with the CombatSystem to provide comprehensive UI feedback.
 */

import { Scene, Vector3, Mesh, AbstractMesh, MeshBuilder, StandardMaterial, Color3, LinesMesh, PointerEventTypes } from '@babylonjs/core';
import { CombatSystem, CombatTarget, TargetValidation } from '../game/CombatSystem';
import { Protector } from '../game/entities/Protector';
import { EnergyManager } from '../game/EnergyManager';
import { CombatEffects, EnergyBeamConfig, DamageEffectConfig, DestructionEffectConfig, FloatingNumberConfig } from '../rendering/CombatEffects';

export interface CombatUIConfig {
    scene: Scene;
    combatSystem: CombatSystem;
    energyManager: EnergyManager;
    combatEffects: CombatEffects;
    containerId?: string;
}

export interface CursorState {
    type: 'default' | 'move' | 'auto_engage' | 'detecting' | 'insufficient_energy';
    destination?: Vector3;
    detectedTarget?: CombatTarget;
    protector?: Protector;
    validation?: TargetValidation;
}

export class CombatUI {
    private scene: Scene;
    private combatSystem: CombatSystem;
    private energyManager: EnergyManager;
    private combatEffects: CombatEffects;
    private container: HTMLElement | null = null;

    // Cursor state management
    private currentCursorState: CursorState = { type: 'default' };
    private pointerObserver: any = null;

    // Range indicators
    private rangeIndicators: Map<string, Mesh[]> = new Map();
    private detectionRangeIndicators: Map<string, Mesh[]> = new Map();
    private combatRangeMaterial: StandardMaterial | null = null;
    private detectionRangeMaterial: StandardMaterial | null = null;
    private selectedProtectors: Set<string> = new Set();

    // Movement destination indicators
    private destinationIndicators: Map<string, Mesh> = new Map();
    private destinationMaterial: StandardMaterial | null = null;

    // Auto-engagement status displays
    private engagementStatusElements: Map<string, HTMLElement> = new Map();

    // Enemy detection indicators
    private detectionIndicators: Map<string, Mesh> = new Map();
    private engagementHighlights: Map<string, Mesh> = new Map();

    // Visual feedback materials
    private validTargetMaterial: StandardMaterial | null = null;
    private invalidTargetMaterial: StandardMaterial | null = null;
    private detectedEnemyMaterial: StandardMaterial | null = null;

    constructor(config: CombatUIConfig) {
        this.scene = config.scene;
        this.combatSystem = config.combatSystem;
        this.energyManager = config.energyManager;
        this.combatEffects = config.combatEffects;

        if (config.containerId) {
            this.container = document.getElementById(config.containerId);
        }

        this.initialize();
    }

    /**
     * Initialize combat UI system
     */
    private initialize(): void {
        this.createMaterials();
        this.createEngagementStatusDisplay();
        this.setupMouseInteraction();
        this.setupCursorStyles();
    }

    /**
     * Create materials for visual feedback
     */
    private createMaterials(): void {
        if (!this.scene) return;

        // Combat range indicator material (8 units)
        this.combatRangeMaterial = new StandardMaterial('combat_range_material', this.scene);
        this.combatRangeMaterial.diffuseColor = new Color3(1, 0.5, 0); // Orange
        this.combatRangeMaterial.alpha = 0.3;
        this.combatRangeMaterial.wireframe = true;
        this.combatRangeMaterial.emissiveColor = new Color3(0.3, 0.15, 0);
        this.combatRangeMaterial.disableLighting = true;

        // Detection range indicator material (10 units)
        this.detectionRangeMaterial = new StandardMaterial('detection_range_material', this.scene);
        this.detectionRangeMaterial.diffuseColor = new Color3(0, 0.8, 1); // Cyan
        this.detectionRangeMaterial.alpha = 0.2;
        this.detectionRangeMaterial.wireframe = true;
        this.detectionRangeMaterial.emissiveColor = new Color3(0, 0.2, 0.3);
        this.detectionRangeMaterial.disableLighting = true;

        // Movement destination indicator material
        this.destinationMaterial = new StandardMaterial('destination_material', this.scene);
        this.destinationMaterial.diffuseColor = new Color3(0, 1, 0); // Green
        this.destinationMaterial.alpha = 0.6;
        this.destinationMaterial.emissiveColor = new Color3(0, 0.4, 0);
        this.destinationMaterial.disableLighting = true;

        // Valid target material
        this.validTargetMaterial = new StandardMaterial('valid_target_material', this.scene);
        this.validTargetMaterial.diffuseColor = new Color3(0, 1, 0); // Green
        this.validTargetMaterial.alpha = 0.4;
        this.validTargetMaterial.emissiveColor = new Color3(0, 0.3, 0);
        this.validTargetMaterial.disableLighting = true;

        // Invalid target material
        this.invalidTargetMaterial = new StandardMaterial('invalid_target_material', this.scene);
        this.invalidTargetMaterial.diffuseColor = new Color3(1, 0, 0); // Red
        this.invalidTargetMaterial.alpha = 0.4;
        this.invalidTargetMaterial.emissiveColor = new Color3(0.3, 0, 0);
        this.invalidTargetMaterial.disableLighting = true;

        // Detected enemy material
        this.detectedEnemyMaterial = new StandardMaterial('detected_enemy_material', this.scene);
        this.detectedEnemyMaterial.diffuseColor = new Color3(1, 1, 0); // Yellow
        this.detectedEnemyMaterial.alpha = 0.5;
        this.detectedEnemyMaterial.emissiveColor = new Color3(0.3, 0.3, 0);
        this.detectedEnemyMaterial.disableLighting = true;
    }

    /**
     * Create auto-engagement status display
     */
    private createEngagementStatusDisplay(): void {
        // This will be used to show auto-engagement status for protectors
        // Status messages like "Moving to destination", "Enemy detected", "Engaging target"
    }

    /**
     * Show enemy detection indicator
     */
    public showEnemyDetectionIndicator(protectorId: string, enemyId: string, enemyPosition: Vector3): void {
        // Create a visual indicator showing that an enemy has been detected
        if (!this.scene || !this.detectedEnemyMaterial) return;

        const indicatorId = `detection_${protectorId}_${enemyId}`;
        
        // Create detection pulse effect around enemy
        const detectionRing = MeshBuilder.CreateTorus(indicatorId, {
            diameter: 2,
            thickness: 0.2,
            tessellation: 16
        }, this.scene);
        
        detectionRing.position = enemyPosition.clone();
        detectionRing.position.y += 0.5; // Slightly above enemy
        detectionRing.material = this.detectedEnemyMaterial;
        detectionRing.renderingGroupId = 2; // Render on top of everything
        
        // Add pulsing animation
        this.animateDetectionIndicator(detectionRing);
        
        // Store for cleanup
        if (!this.detectionIndicators) {
            this.detectionIndicators = new Map();
        }
        this.detectionIndicators.set(indicatorId, detectionRing);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            this.clearEnemyDetectionIndicator(protectorId, enemyId);
        }, 3000);
    }

    /**
     * Clear enemy detection indicator
     */
    public clearEnemyDetectionIndicator(protectorId: string, enemyId: string): void {
        const indicatorId = `detection_${protectorId}_${enemyId}`;
        
        if (this.detectionIndicators && this.detectionIndicators.has(indicatorId)) {
            const indicator = this.detectionIndicators.get(indicatorId);
            if (indicator) {
                indicator.dispose();
            }
            this.detectionIndicators.delete(indicatorId);
        }
    }

    /**
     * Animate detection indicator with pulsing effect
     */
    private animateDetectionIndicator(mesh: Mesh): void {
        if (!this.scene) return;

        // Create pulsing scale animation
        const animationKeys = [];
        animationKeys.push({ frame: 0, value: 1 });
        animationKeys.push({ frame: 30, value: 1.3 });
        animationKeys.push({ frame: 60, value: 1 });

        const scaleAnimation = this.scene.beginAnimation(mesh, 0, 60, true);
        
        // Fade out animation
        setTimeout(() => {
            if (mesh && !mesh.isDisposed()) {
                const fadeKeys = [];
                fadeKeys.push({ frame: 0, value: 1 });
                fadeKeys.push({ frame: 30, value: 0 });
                
                this.scene.beginAnimation(mesh.material, 0, 30, false);
            }
        }, 2500);
    }

    /**
     * Highlight enemy during auto-engagement
     */
    public highlightEngagedEnemy(enemyId: string, enemyPosition: Vector3): void {
        if (!this.scene || !this.validTargetMaterial) return;

        const highlightId = `engaged_${enemyId}`;
        
        // Create engagement highlight around enemy
        const highlight = MeshBuilder.CreateSphere(highlightId, { diameter: 3 }, this.scene);
        highlight.position = enemyPosition.clone();
        highlight.material = this.validTargetMaterial;
        highlight.renderingGroupId = 1;
        
        // Make it wireframe for better visibility
        if (highlight.material instanceof StandardMaterial) {
            highlight.material.wireframe = true;
            highlight.material.alpha = 0.6;
        }
        
        // Store for cleanup
        if (!this.engagementHighlights) {
            this.engagementHighlights = new Map();
        }
        this.engagementHighlights.set(highlightId, highlight);
    }

    /**
     * Clear enemy engagement highlight
     */
    public clearEngagedEnemyHighlight(enemyId: string): void {
        const highlightId = `engaged_${enemyId}`;
        
        if (this.engagementHighlights && this.engagementHighlights.has(highlightId)) {
            const highlight = this.engagementHighlights.get(highlightId);
            if (highlight) {
                highlight.dispose();
            }
            this.engagementHighlights.delete(highlightId);
        }
    }

    /**
     * Show engagement transition visual effect
     */
    public showEngagementTransition(protectorId: string, protectorPosition: Vector3, enemyPosition: Vector3): void {
        if (!this.scene) return;

        // Create a line connecting protector to enemy to show engagement
        const points = [protectorPosition, enemyPosition];
        const engagementLine = MeshBuilder.CreateLines(`engagement_${protectorId}`, { points }, this.scene);
        
        if (this.validTargetMaterial) {
            // Create a material for the engagement line
            const lineMaterial = this.validTargetMaterial.clone(`engagement_line_${protectorId}`);
            lineMaterial.alpha = 0.8;
            lineMaterial.emissiveColor = new Color3(0, 1, 0);
            engagementLine.color = new Color3(0, 1, 0);
        }
        
        engagementLine.renderingGroupId = 1;
        
        // Animate the line (fade in and out)
        this.animateEngagementLine(engagementLine);
        
        // Auto-remove after animation
        setTimeout(() => {
            if (engagementLine && !engagementLine.isDisposed()) {
                engagementLine.dispose();
            }
        }, 1500);
    }

    /**
     * Animate engagement line
     */
    private animateEngagementLine(line: LinesMesh): void {
        if (!this.scene) return;

        // Fade in then fade out
        const fadeInKeys = [];
        fadeInKeys.push({ frame: 0, value: 0 });
        fadeInKeys.push({ frame: 15, value: 1 });
        fadeInKeys.push({ frame: 45, value: 1 });
        fadeInKeys.push({ frame: 60, value: 0 });

        this.scene.beginAnimation(line, 0, 60, false);
    }

    /**
     * Create energy beam effect for protector attacks (maintains existing visual effects)
     */
    public createEnergyBeamEffect(protectorPosition: Vector3, targetPosition: Vector3, color?: Color3): string {
        const beamConfig: EnergyBeamConfig = {
            scene: this.scene,
            startPosition: protectorPosition,
            endPosition: targetPosition,
            width: 0.3,
            pulseSpeed: 3.0,
            duration: 800,
            color: color || new Color3(0, 1, 1) // Default cyan
        };

        return this.combatEffects.createEnergyBeam(beamConfig);
    }

    /**
     * Create damage effect on target (maintains existing visual effects)
     */
    public createDamageEffect(targetPosition: Vector3, damageAmount: number, effectType: 'hit' | 'critical' | 'blocked' = 'hit'): string {
        const damageConfig: DamageEffectConfig = {
            scene: this.scene,
            targetPosition: targetPosition,
            damageAmount: damageAmount,
            effectType: effectType,
            duration: 1200
        };

        return this.combatEffects.createDamageEffect(damageConfig);
    }

    /**
     * Create destruction effect and animations (maintains existing visual effects)
     */
    public createDestructionEffect(targetPosition: Vector3, targetSize: number, explosionType: 'small' | 'medium' | 'large' = 'medium'): string {
        const destructionConfig: DestructionEffectConfig = {
            scene: this.scene,
            position: targetPosition,
            targetSize: targetSize,
            explosionType: explosionType,
            duration: 2500
        };

        return this.combatEffects.createDestructionEffect(destructionConfig);
    }

    /**
     * Create floating energy gain/loss numbers (maintains existing visual effects)
     */
    public createFloatingEnergyNumber(position: Vector3, energyChange: number, isGain: boolean = true): string {
        const numberConfig: FloatingNumberConfig = {
            position: position,
            value: Math.abs(energyChange),
            type: isGain ? 'energy_gain' : 'energy_loss',
            scene: this.scene
        };

        return this.combatEffects.createFloatingNumber(numberConfig);
    }

    /**
     * Create floating damage numbers (maintains existing visual effects)
     */
    public createFloatingDamageNumber(position: Vector3, damage: number): string {
        const numberConfig: FloatingNumberConfig = {
            position: position,
            value: damage,
            type: 'damage',
            scene: this.scene
        };

        return this.combatEffects.createFloatingNumber(numberConfig);
    }

    /**
     * Handle complete combat sequence with all visual effects
     */
    public playCompleteAttackSequence(protectorPosition: Vector3, targetPosition: Vector3, damage: number, energyCost: number, targetDestroyed: boolean = false, energyReward: number = 0): void {
        // 1. Energy beam effect
        this.createEnergyBeamEffect(protectorPosition, targetPosition);

        // 2. Damage effect on target (slight delay)
        setTimeout(() => {
            this.createDamageEffect(targetPosition, damage, damage > 2 ? 'critical' : 'hit');
            this.createFloatingDamageNumber(targetPosition, damage);
        }, 200);

        // 3. Energy cost display
        this.createFloatingEnergyNumber(protectorPosition, energyCost, false);

        // 4. Destruction effect if target destroyed
        if (targetDestroyed) {
            setTimeout(() => {
                this.createDestructionEffect(targetPosition, 2.0, 'medium');
                
                // Energy reward if applicable
                if (energyReward > 0) {
                    setTimeout(() => {
                        this.createFloatingEnergyNumber(targetPosition, energyReward, true);
                    }, 500);
                }
            }, 600);
        }
    }

    /**
     * Setup cursor styles for different movement and combat states
     */
    private setupCursorStyles(): void {
        // Add CSS for custom cursors
        if (!document.querySelector('#combat-cursor-styles')) {
            const style = document.createElement('style');
            style.id = 'combat-cursor-styles';
            style.textContent = `
                .combat-cursor-move {
                    cursor: pointer !important;
                }
                .combat-cursor-auto-engage {
                    cursor: crosshair !important;
                }
                .combat-cursor-detecting {
                    cursor: help !important;
                }
                .combat-cursor-insufficient-energy {
                    cursor: no-drop !important;
                }
                .combat-cursor-default {
                    cursor: default !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Setup mouse interaction for combat feedback
     */
    private setupMouseInteraction(): void {
        if (!this.scene) return;

        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            switch (pointerInfo.type) {
                case PointerEventTypes.POINTERMOVE:
                    this.handleMouseMove(pointerInfo);
                    break;
                case PointerEventTypes.POINTERDOWN:
                    this.handleMouseClick(pointerInfo);
                    break;
            }
        });
    }

    /**
     * Handle mouse move for cursor state updates
     */
    private handleMouseMove(pointerInfo: any): void {
        if (this.selectedProtectors.size === 0) {
            this.updateCursorState({ type: 'default' });
            return;
        }

        // For movement-based system, show move cursor by default
        this.updateCursorState({ type: 'move' });
    }

    /**
     * Handle mouse click for movement commands
     */
    private handleMouseClick(pointerInfo: any): void {
        if (this.selectedProtectors.size === 0) return;

        const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        
        if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
            const destination = pickInfo.pickedPoint;
            
            // Issue movement commands to all selected protectors
            for (const protectorId of this.selectedProtectors) {
                const protector = this.getProtectorById(protectorId);
                if (protector) {
                    // Use the new movement-based command instead of direct attack
                    protector.moveToLocation(destination);
                    this.showDestinationIndicator(protectorId, destination);
                    this.updateEngagementStatus(protectorId, 'Moving to destination');
                }
            }
        }
    }

    /**
     * Update cursor state and visual feedback
     */
    private updateCursorState(newState: CursorState): void {
        this.currentCursorState = newState;

        // Update cursor style
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (canvas) {
            // Remove all combat cursor classes
            canvas.classList.remove(
                'combat-cursor-default',
                'combat-cursor-move',
                'combat-cursor-auto-engage',
                'combat-cursor-detecting',
                'combat-cursor-insufficient-energy'
            );

            // Add appropriate cursor class
            canvas.classList.add(`combat-cursor-${newState.type.replace('_', '-')}`);
        }
    }

    /**
     * Show movement destination indicator
     */
    public showDestinationIndicator(protectorId: string, destination: Vector3): void {
        // Remove existing destination indicator for this protector
        this.clearDestinationIndicator(protectorId);

        if (!this.scene || !this.destinationMaterial) return;

        // Create destination marker
        const marker = MeshBuilder.CreateSphere(`destination_${protectorId}`, { diameter: 1 }, this.scene);
        marker.position = destination.clone();
        marker.position.y += 0.5; // Slightly above ground
        marker.material = this.destinationMaterial;
        marker.renderingGroupId = 1; // Render on top

        this.destinationIndicators.set(protectorId, marker);

        // Auto-remove after a few seconds
        setTimeout(() => {
            this.clearDestinationIndicator(protectorId);
        }, 5000);
    }

    /**
     * Clear destination indicator for a protector
     */
    public clearDestinationIndicator(protectorId: string): void {
        const indicator = this.destinationIndicators.get(protectorId);
        if (indicator) {
            indicator.dispose();
            this.destinationIndicators.delete(protectorId);
        }
    }

    /**
     * Update auto-engagement status for a protector
     */
    public updateEngagementStatus(protectorId: string, status: string, color: string = '#00aaff'): void {
        // Remove existing status element
        const existingElement = this.engagementStatusElements.get(protectorId);
        if (existingElement && existingElement.parentNode) {
            existingElement.parentNode.removeChild(existingElement);
        }

        const protector = this.getProtectorById(protectorId);
        if (!protector) return;

        const statusElement = document.createElement('div');
        statusElement.style.cssText = `
            position: fixed;
            background: rgba(0, 10, 20, 0.9);
            border: 1px solid ${color};
            border-radius: 4px;
            padding: 4px 8px;
            font-family: 'Orbitron', monospace;
            font-size: 10px;
            color: ${color};
            pointer-events: none;
            z-index: 999;
            box-shadow: 0 0 8px ${color}40;
            backdrop-filter: blur(2px);
        `;
        statusElement.textContent = status;

        // Position above protector
        const screenPos = this.worldToScreen(protector.getPosition());
        if (screenPos) {
            statusElement.style.left = `${screenPos.x - 50}px`;
            statusElement.style.top = `${screenPos.y - 40}px`;
        }

        document.body.appendChild(statusElement);
        this.engagementStatusElements.set(protectorId, statusElement);

        // Auto-remove after 3 seconds unless updated
        setTimeout(() => {
            const currentElement = this.engagementStatusElements.get(protectorId);
            if (currentElement === statusElement && statusElement.parentNode) {
                statusElement.parentNode.removeChild(statusElement);
                this.engagementStatusElements.delete(protectorId);
            }
        }, 3000);
    }

    /**
     * Show combat and detection range indicators for selected protectors
     */
    public showRangeIndicators(protectorIds: string[]): void {
        // Clear existing indicators
        this.clearRangeIndicators();

        for (const protectorId of protectorIds) {
            const protector = this.getProtectorById(protectorId);
            if (protector) {
                // Create both detection range (10 units) and combat range (8 units) indicators
                const combatIndicators = this.createRangeIndicator(protector, protector.getCombatRange(), this.combatRangeMaterial);
                const detectionIndicators = this.createRangeIndicator(protector, protector.getDetectionRange(), this.detectionRangeMaterial);
                
                this.rangeIndicators.set(protectorId, combatIndicators);
                this.detectionRangeIndicators.set(protectorId, detectionIndicators);
            }
        }

        // Update selected protectors set
        this.selectedProtectors = new Set(protectorIds);
    }

    /**
     * Create range indicator for a protector
     */
    private createRangeIndicator(protector: Protector, range: number, material: StandardMaterial | null): Mesh[] {
        if (!this.scene || !material) return [];

        const indicators: Mesh[] = [];
        const position = protector.getPosition();

        // Create range circle
        const rangeCircle = this.createRangeCircle(position, range);
        if (rangeCircle) {
            rangeCircle.material = material;
            rangeCircle.renderingGroupId = 1; // Render on top
            indicators.push(rangeCircle);
        }

        return indicators;
    }

    /**
     * Create a range circle indicator
     */
    private createRangeCircle(center: Vector3, radius: number): Mesh | null {
        if (!this.scene) return null;

        const points: Vector3[] = [];
        const segments = 32;

        // Create circle points
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = center.x + Math.cos(angle) * radius;
            const z = center.z + Math.sin(angle) * radius;
            points.push(new Vector3(x, center.y + 0.1, z)); // Slightly above ground
        }

        return MeshBuilder.CreateLines('combat_range_circle', { points }, this.scene);
    }

    /**
     * Clear all range indicators
     */
    public clearRangeIndicators(): void {
        // Clear combat range indicators
        for (const [protectorId, indicators] of this.rangeIndicators) {
            for (const indicator of indicators) {
                indicator.dispose();
            }
        }
        this.rangeIndicators.clear();

        // Clear detection range indicators
        for (const [protectorId, indicators] of this.detectionRangeIndicators) {
            for (const indicator of indicators) {
                indicator.dispose();
            }
        }
        this.detectionRangeIndicators.clear();

        // Clear destination indicators
        for (const [protectorId, indicator] of this.destinationIndicators) {
            indicator.dispose();
        }
        this.destinationIndicators.clear();

        // Clear enemy detection indicators
        for (const [indicatorId, indicator] of this.detectionIndicators) {
            indicator.dispose();
        }
        this.detectionIndicators.clear();

        // Clear engagement highlights
        for (const [highlightId, highlight] of this.engagementHighlights) {
            highlight.dispose();
        }
        this.engagementHighlights.clear();

        // Clear engagement status elements
        for (const [protectorId, element] of this.engagementStatusElements) {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }
        this.engagementStatusElements.clear();

        this.selectedProtectors.clear();

        // Reset cursor state
        this.updateCursorState({ type: 'default' });
    }

    /**
     * Create floating combat status indicator (legacy method for compatibility)
     */
    public createCombatStatusIndicator(protectorId: string, message: string, color: string = '#ffaa00'): void {
        this.updateEngagementStatus(protectorId, message, color);
    }

    /**
     * Convert world position to screen coordinates
     */
    private worldToScreen(worldPos: Vector3): { x: number; y: number } | null {
        if (!this.scene) return null;

        const camera = this.scene.activeCamera;
        if (!camera) return null;

        const engine = this.scene.getEngine();
        const screenPos = Vector3.Project(
            worldPos,
            camera.getWorldMatrix(),
            camera.getProjectionMatrix(),
            camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
        );

        return { x: screenPos.x, y: screenPos.y };
    }

    /**
     * Get combat target from picked mesh
     */
    private getTargetFromMesh(mesh: AbstractMesh): CombatTarget | null {
        // This would need to be implemented based on how targets are identified
        // For now, return null - this should be connected to the actual target system
        
        // Example implementation:
        // Check if mesh has metadata indicating it's a combat target
        if (mesh.metadata && mesh.metadata.combatTarget) {
            return mesh.metadata.combatTarget as CombatTarget;
        }

        return null;
    }

    /**
     * Get protector by ID
     */
    private getProtectorById(protectorId: string): Protector | null {
        // This would need to be implemented based on how protectors are managed
        // For now, return null - this should be connected to the actual unit system
        
        // This should integrate with UnitManager or GameState to get protector instances
        return null;
    }

    /**
     * Update UI for combat system events
     */
    public update(deltaTime: number): void {
        // Update any animated elements or time-based UI changes
        // This could include pulsing range indicators, updating status displays, etc.
    }

    /**
     * Set UI visibility
     */
    public setVisible(visible: boolean): void {
        if (visible) {
            // Show UI elements - no energy cost preview in movement-based system
        } else {
            // Hide UI elements
            this.clearRangeIndicators();
        }
    }

    /**
     * Dispose combat UI
     */
    public dispose(): void {
        // Remove pointer observer
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }

        // Clear range indicators
        this.clearRangeIndicators();

        // Remove engagement status elements
        for (const [protectorId, element] of this.engagementStatusElements) {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }
        this.engagementStatusElements.clear();

        // Dispose materials
        if (this.combatRangeMaterial) {
            this.combatRangeMaterial.dispose();
            this.combatRangeMaterial = null;
        }
        if (this.detectionRangeMaterial) {
            this.detectionRangeMaterial.dispose();
            this.detectionRangeMaterial = null;
        }
        if (this.destinationMaterial) {
            this.destinationMaterial.dispose();
            this.destinationMaterial = null;
        }
        if (this.validTargetMaterial) {
            this.validTargetMaterial.dispose();
            this.validTargetMaterial = null;
        }
        if (this.invalidTargetMaterial) {
            this.invalidTargetMaterial.dispose();
            this.invalidTargetMaterial = null;
        }
        if (this.detectedEnemyMaterial) {
            this.detectedEnemyMaterial.dispose();
            this.detectedEnemyMaterial = null;
        }

        // Reset cursor
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (canvas) {
            canvas.classList.remove(
                'combat-cursor-default',
                'combat-cursor-move',
                'combat-cursor-auto-engage',
                'combat-cursor-detecting',
                'combat-cursor-insufficient-energy'
            );
        }
    }
}