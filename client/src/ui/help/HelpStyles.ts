/**
 * HelpStyles - Styling constants for the in-game help system
 *
 * Provides consistent theming that matches the existing UI patterns
 * while maintaining visual distinction from PlayerStatsUI.
 */

import { DEFAULT_THEME } from '../base/UITheme';

// ==================== Color Constants ====================

export const HELP_COLORS = {
    primary: DEFAULT_THEME.primaryColor,           // #00ff88
    background: 'rgba(0, 20, 40, 0.95)',           // Slightly more opaque for readability
    text: DEFAULT_THEME.textColor,                 // #ffffff
    secondaryText: DEFAULT_THEME.secondaryTextColor, // #cccccc
    closeButton: DEFAULT_THEME.errorColor,         // #ff4444
    closeButtonHover: 'rgba(255, 68, 68, 0.3)',
    tabActive: DEFAULT_THEME.primaryColor,
    tabActiveText: '#000000',
    tabInactive: 'transparent',
    tabInactiveText: DEFAULT_THEME.primaryColor,
    tabHover: 'rgba(0, 255, 136, 0.2)',
    sectionHeader: DEFAULT_THEME.primaryColor,
    tableBorder: 'rgba(0, 255, 136, 0.3)',
    tableRowAlt: 'rgba(0, 255, 136, 0.05)'
};

// ==================== Typography Constants ====================

export const HELP_TYPOGRAPHY = {
    fontFamily: "'Orbitron', 'Segoe UI', monospace",
    titleSize: 18,
    headerSize: 14,
    subHeaderSize: 13,
    bodySize: 12,
    tableSize: 11,
    smallSize: 10
};

// ==================== Dimension Constants ====================

export const HELP_DIMENSIONS = {
    windowWidth: 650,
    windowHeight: 500,
    cornerRadius: 10,
    borderWidth: 2,
    titleBarHeight: 45,
    tabBarHeight: 40,
    contentPadding: 20,
    sectionGap: 15,
    itemGap: 8,
    tabGap: 5,
    closeButtonSize: 30,
    tabWidth: 120,
    tabHeight: 32
};

// ==================== Tab Definitions ====================

export interface TabDefinition {
    id: string;
    label: string;
}

export const HELP_TABS: TabDefinition[] = [
    { id: 'navigation', label: 'Navigation' },
    { id: 'controls', label: 'Controls' },
    { id: 'enemy', label: 'Enemy' }
];
