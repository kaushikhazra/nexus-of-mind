/**
 * UITheme - UI theming and color management
 *
 * Provides consistent theming and color management for UI components.
 * Central source of truth for styling constants used across both
 * Babylon.js GUI and HTML-based UI components.
 */

// ==================== Theme Interfaces ====================

export interface UITheme {
    /** Primary color for highlights and accents */
    primaryColor: string;
    /** Secondary color for borders and details */
    secondaryColor: string;
    /** Background color for containers */
    backgroundColor: string;
    /** Text color for primary content */
    textColor: string;
    /** Text color for secondary content */
    secondaryTextColor: string;
    /** Error/warning color */
    errorColor: string;
    /** Success/confirmation color */
    successColor: string;
}

// ==================== Shared Typography ====================

/**
 * Font family used across all UI components (both Babylon.js GUI and HTML)
 */
export const UI_FONT_FAMILY = "'Orbitron', 'Segoe UI', monospace";

// ==================== Default Theme ====================

export const DEFAULT_THEME: UITheme = {
    primaryColor: '#00ff88',
    secondaryColor: '#555555',
    backgroundColor: 'rgba(0, 20, 40, 0.9)',
    textColor: '#ffffff',
    secondaryTextColor: '#cccccc',
    errorColor: '#ff4444',
    successColor: '#44ff44'
};