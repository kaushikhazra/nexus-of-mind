/**
 * CombatUIInterfaces - Type definitions for combat UI system
 *
 * Contains all interfaces for combat UI visualization.
 */

import type { Scene, Vector3 } from '@babylonjs/core';
import type { CombatSystem, CombatTarget, TargetValidation } from '../../game/CombatSystem';
import type { Protector } from '../../game/entities/Protector';
import type { EnergyManager } from '../../game/EnergyManager';
import type { CombatEffects } from '../../rendering/CombatEffects';

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

export type CursorType = 'default' | 'move' | 'auto_engage' | 'detecting' | 'insufficient_energy';
