/**
 * GameUIStyles - Centralized styling for HTML-based game UI components
 *
 * Provides DRY-compliant styling constants and factory functions for
 * consistent UI appearance across WorkerCreationUI, ProtectorCreationUI,
 * BuildingPlacementUI, and EnergyLordsHUD components.
 */

import { UI_FONT_FAMILY } from '../base/UITheme';

// ==================== Color Palette ====================

export const UI_COLORS = {
    // Primary UI colors (cyan theme)
    primary: '#00ffff',
    primaryDark: 'rgba(0, 255, 255, 0.4)',
    primaryGlow: 'rgba(0, 255, 255, 0.2)',
    primaryText: '#00ffff',

    // Secondary colors (green theme)
    secondary: '#00ff88',
    secondaryDark: 'rgba(0, 255, 136, 0.4)',
    secondaryGlow: 'rgba(0, 255, 136, 0.2)',

    // Danger colors (red theme)
    danger: '#ff4444',
    dangerDark: 'rgba(255, 68, 68, 0.4)',
    dangerGlow: 'rgba(255, 68, 68, 0.2)',
    dangerMuted: '#ff6666',

    // Warning colors (orange/yellow)
    warning: '#ffff00',
    warningAlt: '#ff8800',

    // Background colors
    panelBg: 'rgba(0, 10, 20, 0.3)',
    panelBgAlt: 'rgba(10, 0, 30, 0.85)',
    buttonBg: 'rgba(0, 20, 40, 0.4)',
    buttonBgHover: 'rgba(0, 40, 80, 0.6)',
    buttonBgDisabled: 'rgba(100, 0, 0, 0.3)',

    // Text colors
    textPrimary: '#ffffff',
    textSecondary: '#cccccc',
    textMuted: '#a0a0a0',
    textSuccess: '#88ff88',
    textError: '#ff8888',

    // Energy Lords specific
    energyLords: {
        primary: 'rgba(180, 130, 255, 0.6)',
        text: '#e0d0ff',
        glow: 'rgba(150, 100, 255, 0.3)',
        gold: '#ffd700'
    }
} as const;

// ==================== Typography ====================

export const UI_TYPOGRAPHY = {
    fontFamily: UI_FONT_FAMILY,

    sizes: {
        xs: '10px',
        sm: '11px',
        base: '12px',
        md: '14px',
        lg: '16px'
    },

    weights: {
        normal: '400',
        semibold: '600',
        bold: '700'
    },

    letterSpacing: {
        normal: '0.5px',
        wide: '1px'
    }
} as const;

// ==================== Dimensions ====================

export const UI_DIMENSIONS = {
    panel: {
        minWidth: '200px',
        borderRadius: '8px',
        padding: '12px',
        gap: '8px'
    },

    button: {
        padding: '10px 12px',
        borderRadius: '4px'
    },

    border: {
        width: '1px',
        widthThick: '2px'
    }
} as const;

// ==================== Style Factories ====================

/**
 * Generate panel base styles
 */
export function getPanelStyles(variant: 'cyan' | 'red' | 'purple' = 'cyan'): string {
    const colors = {
        cyan: { border: UI_COLORS.primaryDark, text: UI_COLORS.primaryText, glow: UI_COLORS.primaryGlow },
        red: { border: UI_COLORS.dangerDark, text: UI_COLORS.dangerMuted, glow: UI_COLORS.dangerGlow },
        purple: { border: UI_COLORS.energyLords.primary, text: UI_COLORS.energyLords.text, glow: UI_COLORS.energyLords.glow }
    };

    const c = colors[variant];

    return `
        background: ${UI_COLORS.panelBg};
        border: ${UI_DIMENSIONS.border.width} solid ${c.border};
        border-radius: ${UI_DIMENSIONS.panel.borderRadius};
        padding: ${UI_DIMENSIONS.panel.padding};
        font-family: ${UI_TYPOGRAPHY.fontFamily};
        color: ${c.text};
        backdrop-filter: blur(8px);
        box-shadow: 0 0 15px ${c.glow};
        min-width: ${UI_DIMENSIONS.panel.minWidth};
        font-size: ${UI_TYPOGRAPHY.sizes.base};
    `.trim();
}

/**
 * Generate header/title styles
 */
export function getHeaderStyles(variant: 'cyan' | 'red' | 'purple' = 'cyan'): string {
    const colors = {
        cyan: { text: UI_COLORS.primaryText, glow: 'rgba(0, 255, 255, 0.6)' },
        red: { text: UI_COLORS.dangerMuted, glow: 'rgba(255, 100, 100, 0.6)' },
        purple: { text: UI_COLORS.energyLords.gold, glow: 'rgba(255, 215, 0, 0.5)' }
    };

    const c = colors[variant];

    return `
        font-size: ${UI_TYPOGRAPHY.sizes.md};
        font-weight: ${UI_TYPOGRAPHY.weights.bold};
        text-align: center;
        margin-bottom: 12px;
        color: ${c.text};
        text-shadow: 0 0 8px ${c.glow};
        letter-spacing: ${UI_TYPOGRAPHY.letterSpacing.wide};
    `.trim();
}

/**
 * Generate button styles
 */
export function getButtonStyles(color: string, disabled: boolean = false): string {
    if (disabled) {
        return `
            background: ${UI_COLORS.buttonBgDisabled};
            border: ${UI_DIMENSIONS.border.width} solid ${UI_COLORS.danger};
            border-radius: ${UI_DIMENSIONS.button.borderRadius};
            color: ${UI_COLORS.danger};
            padding: ${UI_DIMENSIONS.button.padding};
            font-family: ${UI_TYPOGRAPHY.fontFamily};
            font-size: ${UI_TYPOGRAPHY.sizes.sm};
            font-weight: ${UI_TYPOGRAPHY.weights.bold};
            text-transform: uppercase;
            letter-spacing: ${UI_TYPOGRAPHY.letterSpacing.wide};
            cursor: not-allowed;
            opacity: 0.6;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `.trim();
    }

    return `
        background: ${UI_COLORS.buttonBg};
        border: ${UI_DIMENSIONS.border.width} solid ${color};
        border-radius: ${UI_DIMENSIONS.button.borderRadius};
        color: ${color};
        padding: ${UI_DIMENSIONS.button.padding};
        font-family: ${UI_TYPOGRAPHY.fontFamily};
        font-size: ${UI_TYPOGRAPHY.sizes.sm};
        font-weight: ${UI_TYPOGRAPHY.weights.bold};
        text-transform: uppercase;
        letter-spacing: ${UI_TYPOGRAPHY.letterSpacing.wide};
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `.trim();
}

/**
 * Generate button hover styles (for event handlers)
 */
export function getButtonHoverStyles(color: string): { background: string; boxShadow: string } {
    return {
        background: UI_COLORS.buttonBgHover,
        boxShadow: `0 0 10px ${color}40`
    };
}

/**
 * Generate button base styles (for resetting from hover)
 */
export function getButtonBaseStyles(): { background: string; boxShadow: string } {
    return {
        background: UI_COLORS.buttonBg,
        boxShadow: 'none'
    };
}

// ==================== CSS Injection ====================

let stylesInjected = false;

/**
 * Inject shared CSS animations and keyframes into document head
 * Call once during app initialization
 */
export function injectSharedStyles(): void {
    if (stylesInjected) return;

    const style = document.createElement('style');
    style.id = 'game-ui-shared-styles';
    style.textContent = `
        /* Feedback animation for success/error messages */
        @keyframes feedbackFade {
            0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
            20% { opacity: 1; transform: translateX(-50%) translateY(0); }
            80% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }

        /* Progress bar glow animation */
        @keyframes progressGlow {
            0%, 100% { box-shadow: 0 0 10px rgba(160, 128, 255, 0.5); }
            50% { box-shadow: 0 0 20px rgba(160, 128, 255, 0.8); }
        }

        /* Gold pulse animation for titles */
        @keyframes pulseGold {
            0%, 100% { text-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
            50% { text-shadow: 0 0 20px rgba(255, 215, 0, 0.8); }
        }

        /* Panel hover enhancement */
        .game-ui-panel:hover {
            box-shadow: 0 0 25px rgba(0, 255, 255, 0.3);
        }

        .game-ui-panel-red:hover {
            box-shadow: 0 0 25px rgba(255, 100, 100, 0.3);
        }

        .game-ui-panel-purple:hover {
            box-shadow: 0 0 30px rgba(150, 100, 255, 0.5), inset 0 0 40px rgba(100, 50, 200, 0.2);
        }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
}

/**
 * Get feedback message styles
 */
export function getFeedbackStyles(type: 'success' | 'error'): string {
    const styles = {
        success: {
            background: 'rgba(0, 255, 0, 0.8)',
            color: '#000',
            border: '1px solid #00ff00'
        },
        error: {
            background: 'rgba(255, 0, 0, 0.8)',
            color: '#fff',
            border: '1px solid #ff0000'
        }
    };

    const s = styles[type];

    return `
        position: absolute;
        top: -30px;
        left: 50%;
        transform: translateX(-50%);
        padding: 5px 10px;
        border-radius: 4px;
        font-size: ${UI_TYPOGRAPHY.sizes.xs};
        font-weight: ${UI_TYPOGRAPHY.weights.bold};
        text-transform: uppercase;
        letter-spacing: ${UI_TYPOGRAPHY.letterSpacing.normal};
        z-index: 1001;
        animation: feedbackFade 2s ease-out forwards;
        background: ${s.background};
        color: ${s.color};
        border: ${s.border};
    `.trim();
}

/**
 * Get status element styles
 */
export function getStatusStyles(state: 'sustaining' | 'below'): string {
    const styles = {
        sustaining: {
            background: 'rgba(100, 255, 100, 0.2)',
            color: '#88ff88',
            border: 'rgba(100, 255, 100, 0.3)'
        },
        below: {
            background: 'rgba(255, 100, 100, 0.2)',
            color: '#ff8888',
            border: 'rgba(255, 100, 100, 0.3)'
        }
    };

    const s = styles[state];

    return `
        margin-top: 10px;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: ${UI_TYPOGRAPHY.sizes.xs};
        text-align: center;
        text-transform: uppercase;
        letter-spacing: ${UI_TYPOGRAPHY.letterSpacing.wide};
        background: ${s.background};
        color: ${s.color};
        border: 1px solid ${s.border};
    `.trim();
}
