/**
 * HelpStyles - Styling constants for the in-game help system
 *
 * Provides consistent theming that matches the existing UI patterns
 * while maintaining visual distinction from PlayerStatsUI.
 */

import { DEFAULT_THEME, UI_FONT_FAMILY } from '../base/UITheme';

// ==================== Color Constants ====================

// Using cyan/blue theme to match Construction panel
const CYAN_PRIMARY = '#00ffff';

export const HELP_COLORS = {
    primary: CYAN_PRIMARY,                         // Cyan blue
    background: 'rgba(0, 20, 40, 0.75)',           // Semi-transparent for better game visibility
    text: DEFAULT_THEME.textColor,                 // #ffffff
    secondaryText: DEFAULT_THEME.secondaryTextColor, // #cccccc
    closeButton: CYAN_PRIMARY,                     // Blue close button
    closeButtonHover: 'rgba(0, 255, 255, 0.3)',
    tabActive: CYAN_PRIMARY,
    tabActiveText: '#000000',
    tabInactive: 'transparent',
    tabInactiveText: CYAN_PRIMARY,
    tabHover: 'rgba(0, 255, 255, 0.2)',
    sectionHeader: CYAN_PRIMARY,
    tableBorder: 'rgba(0, 255, 255, 0.3)',
    tableRowAlt: 'rgba(0, 255, 255, 0.05)'
};

// ==================== Typography Constants ====================

export const HELP_TYPOGRAPHY = {
    fontFamily: UI_FONT_FAMILY,
    titleSize: 18,
    headerSize: 15,
    subHeaderSize: 14,
    bodySize: 13,
    tableSize: 12,
    smallSize: 11
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
