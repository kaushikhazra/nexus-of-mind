/**
 * EmblemInterfaces - Type definitions for emblem system
 *
 * Contains all interfaces and types used by the emblem creation system.
 * Extracted from EmblemGeometry.ts for SOLID compliance.
 */

import { Color3 } from '@babylonjs/core';

/**
 * Emblem design configuration
 */
export interface EmblemDesign {
    primaryShape: 'hexagon' | 'octagon' | 'star' | 'diamond';
    innerElements: ('ring' | 'cross' | 'triangle' | 'circle')[];
    glowIntensity: number;
    colors: {
        primary: string;
        secondary: string;
        glow: string;
    };
}

/**
 * Emblem creation configuration
 */
export interface EmblemConfig {
    size: number;
    height: number;
    segments: number;
    glowIntensity: number;
    pulseSpeed: number; // Animation speed multiplier
}

/**
 * Color theme for materials
 */
export interface EmblemColorTheme {
    primary: Color3;
    secondary: Color3;
    glow: Color3;
    accent?: Color3;
}

/**
 * Material options for emblem elements
 */
export interface MaterialOptions {
    emissive: Color3;
    specular: Color3;
    roughness: number;
}

/**
 * Default emblem configuration
 */
export const DEFAULT_EMBLEM_CONFIG: EmblemConfig = {
    size: 2.0,
    height: 0.2,
    segments: 6,
    glowIntensity: 0.6,
    pulseSpeed: 1.0
};

/**
 * Cyan color theme for Korenthi emblems
 */
export const CYAN_THEME: EmblemColorTheme = {
    primary: new Color3(0, 1, 1),
    secondary: new Color3(0, 0.7, 0.9),
    glow: new Color3(0, 0.5, 0.6)
};

/**
 * Emerald color theme for Energy Lords
 */
export const EMERALD_THEME: EmblemColorTheme = {
    primary: new Color3(0.02, 0.12, 0.06),
    secondary: new Color3(0, 0.6, 0.6),
    glow: new Color3(0.01, 0.04, 0.02),
    accent: new Color3(0, 0.3, 0.35)
};

/**
 * Gold/Black theme for Empire
 */
export const GOLD_BLACK_THEME: EmblemColorTheme = {
    primary: new Color3(0.15, 0.15, 0.18),
    secondary: new Color3(0.85, 0.65, 0.1),
    glow: new Color3(0.4, 0.3, 0.05),
    accent: new Color3(0.02, 0.12, 0.06)
};
