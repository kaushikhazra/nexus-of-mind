/**
 * UIButtonFactory - Standardized button creation and styling
 * 
 * Provides consistent button creation with standardized styling and behavior.
 */

import { Button } from '@babylonjs/gui';
import { UITheme } from './UITheme';

// ==================== Button Configuration ====================

export interface ButtonConfig {
    /** Button text content */
    text: string;
    /** Click event handler */
    onClick: () => void;
    /** Button width (default: auto) */
    width?: string | number;
    /** Button height (default: 40px) */
    height?: string | number;
    /** Button style variant */
    variant?: 'primary' | 'secondary' | 'success' | 'error' | 'outline';
    /** Whether button is disabled */
    disabled?: boolean;
    /** Tooltip text */
    tooltip?: string;
}

// ==================== Button Factory ====================

/**
 * Create a standardized button with consistent styling
 */
export function createButton(config: ButtonConfig, theme: UITheme, eventHandlers: Array<() => void>): Button {
    const button = Button.CreateSimpleButton(`btn_${Date.now()}`, config.text);
    
    // Apply size
    if (config.width !== undefined) {
        if (typeof config.width === 'number') {
            button.widthInPixels = config.width;
        } else {
            button.width = config.width;
        }
    } else {
        button.width = '200px';
    }
    
    if (config.height !== undefined) {
        if (typeof config.height === 'number') {
            button.heightInPixels = config.height;
        } else {
            button.height = config.height;
        }
    } else {
        button.heightInPixels = 40;
    }

    // Apply styling based on variant
    applyButtonStyling(button, config.variant || 'primary', theme);

    // Setup click handler
    const clickHandler = () => {
        if (!config.disabled) {
            config.onClick();
        }
    };
    button.onPointerUpObservable.add(clickHandler);
    
    // Store handler for cleanup
    eventHandlers.push(() => {
        button.onPointerUpObservable.clear();
    });

    // Apply disabled state
    if (config.disabled) {
        setButtonDisabled(button, true);
    }

    return button;
}

/**
 * Apply consistent button styling based on variant
 */
export function applyButtonStyling(button: Button, variant: 'primary' | 'secondary' | 'success' | 'error' | 'outline', theme: UITheme): void {
    // Base styling
    button.cornerRadius = 5;
    button.fontSize = 14;
    button.fontWeight = 'bold';
    
    switch (variant) {
        case 'primary':
            button.color = theme.primaryColor;
            button.background = theme.primaryColor;
            button.textBlock!.color = '#000000';
            break;
            
        case 'secondary':
            button.color = theme.secondaryColor;
            button.background = theme.secondaryColor;
            button.textBlock!.color = theme.textColor;
            break;
            
        case 'success':
            button.color = theme.successColor;
            button.background = theme.successColor;
            button.textBlock!.color = '#000000';
            break;
            
        case 'error':
            button.color = theme.errorColor;
            button.background = theme.errorColor;
            button.textBlock!.color = '#ffffff';
            break;
            
        case 'outline':
            button.color = theme.primaryColor;
            button.background = 'transparent';
            button.thickness = 2;
            button.textBlock!.color = theme.primaryColor;
            break;
    }

    // Hover effects
    button.onPointerEnterObservable.add(() => {
        if (variant === 'outline') {
            button.background = theme.primaryColor;
            button.textBlock!.color = '#000000';
        } else {
            button.alpha = 0.8;
        }
    });

    button.onPointerOutObservable.add(() => {
        if (variant === 'outline') {
            button.background = 'transparent';
            button.textBlock!.color = theme.primaryColor;
        } else {
            button.alpha = 1.0;
        }
    });
}

/**
 * Set button disabled state
 */
export function setButtonDisabled(button: Button, disabled: boolean): void {
    button.alpha = disabled ? 0.5 : 1.0;
    button.isEnabled = !disabled;
}