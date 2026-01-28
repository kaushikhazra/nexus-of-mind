/**
 * UIComponentBase - Base class for all UI components
 *
 * Provides consistent patterns for UI component creation, lifecycle management,
 * and common functionality. Eliminates code duplication across UI components
 * and ensures standardized behavior throughout the application.
 */

import {
    AdvancedDynamicTexture,
    Rectangle,
    TextBlock,
    StackPanel,
    Control,
    Button,
    Grid
} from '@babylonjs/gui';

// Import from extracted modules
import { UITheme, DEFAULT_THEME } from './UITheme';
import { ButtonConfig, createButton, applyButtonStyling, setButtonDisabled } from './UIButtonFactory';
import { createHorizontalPanel, createVerticalPanel, createGrid, createSpacer } from './UILayoutHelpers';
import { createProgressBar, updateProgressBar } from './UIProgressBar';

// Re-export for backward compatibility
export { DEFAULT_THEME } from './UITheme';
export type { UITheme } from './UITheme';
export type { ButtonConfig } from './UIButtonFactory';

// ==================== Base Configuration Interfaces ====================

export interface UIComponentConfig {
    /** Parent texture to attach this component to */
    parentTexture: AdvancedDynamicTexture;
    /** Position configuration */
    position?: {
        x?: string;
        y?: string;
        horizontalAlignment?: number;
        verticalAlignment?: number;
    };
    /** Size configuration */
    size?: {
        width?: string | number;
        height?: string | number;
    };
    /** Initial visibility state */
    visible?: boolean;
    /** Component styling theme */
    theme?: UITheme;
}

export interface LabelConfig {
    /** Label text content */
    text: string;
    /** Font size (default: 12) */
    fontSize?: number;
    /** Text color (uses theme if not specified) */
    color?: string;
    /** Font weight */
    fontWeight?: string;
    /** Text alignment */
    alignment?: number;
    /** Height in pixels */
    height?: number;
}

// ==================== Base UI Component Class ====================

/**
 * Abstract base class for all UI components
 * Provides common functionality and enforces consistent patterns
 */
export abstract class UIComponentBase {
    protected parentTexture: AdvancedDynamicTexture;
    protected mainContainer: Rectangle;
    protected contentPanel: StackPanel;
    protected theme: UITheme;
    protected isVisible: boolean = false;
    protected isDisposed: boolean = false;

    // Event handlers for cleanup
    protected eventHandlers: Array<() => void> = [];

    constructor(config: UIComponentConfig) {
        this.parentTexture = config.parentTexture;
        this.theme = config.theme || DEFAULT_THEME;
        this.isVisible = config.visible || false;

        // Create main container
        this.mainContainer = this.createMainContainer(config);
        this.contentPanel = this.createContentPanel();

        // Add to parent texture
        this.parentTexture.addControl(this.mainContainer);

        // Setup component-specific content
        this.setupComponent();

        // Apply initial visibility
        this.mainContainer.isVisible = this.isVisible;
    }

    // ==================== Abstract Methods ====================

    /**
     * Setup component-specific content
     * Must be implemented by subclasses
     */
    protected abstract setupComponent(): void;

    // ==================== Container Creation ====================

    /**
     * Create the main container for this component
     */
    protected createMainContainer(config: UIComponentConfig): Rectangle {
        const container = new Rectangle(`${this.constructor.name}_container`);

        // Default styling
        container.cornerRadius = 10;
        container.color = this.theme.primaryColor;
        container.thickness = 2;
        container.background = this.theme.backgroundColor;

        // Apply position configuration
        if (config.position) {
            if (config.position.x !== undefined) container.left = config.position.x;
            if (config.position.y !== undefined) container.top = config.position.y;
            if (config.position.horizontalAlignment !== undefined) {
                container.horizontalAlignment = config.position.horizontalAlignment;
            }
            if (config.position.verticalAlignment !== undefined) {
                container.verticalAlignment = config.position.verticalAlignment;
            }
        } else {
            // Default positioning
            container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
            container.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        }

        // Apply size configuration
        if (config.size) {
            if (config.size.width !== undefined) {
                if (typeof config.size.width === 'number') {
                    container.widthInPixels = config.size.width;
                } else {
                    container.width = config.size.width;
                }
            }
            if (config.size.height !== undefined) {
                if (typeof config.size.height === 'number') {
                    container.heightInPixels = config.size.height;
                } else {
                    container.height = config.size.height;
                }
            }
        } else {
            // Default size
            container.widthInPixels = 300;
            container.heightInPixels = 200;
        }

        return container;
    }

    /**
     * Create the main content panel
     */
    protected createContentPanel(): StackPanel {
        const panel = new StackPanel(`${this.constructor.name}_content`);
        panel.isVertical = true;
        panel.paddingTopInPixels = 10;
        panel.paddingBottomInPixels = 10;
        panel.paddingLeftInPixels = 15;
        panel.paddingRightInPixels = 15;

        this.mainContainer.addControl(panel);
        return panel;
    }

    // ==================== Button Creation (delegates to UIButtonFactory) ====================

    /**
     * Create a standardized button with consistent styling
     */
    protected createButton(config: ButtonConfig): Button {
        return createButton(config, this.theme, this.eventHandlers);
    }

    /**
     * Apply consistent button styling based on variant
     */
    protected applyButtonStyling(button: Button, variant: 'primary' | 'secondary' | 'success' | 'error' | 'outline'): void {
        applyButtonStyling(button, variant, this.theme);
    }

    /**
     * Set button disabled state
     */
    protected setButtonDisabled(button: Button, disabled: boolean): void {
        setButtonDisabled(button, disabled);
    }

    // ==================== Label Creation ====================

    /**
     * Create a standardized text label
     */
    protected createLabel(config: LabelConfig): TextBlock {
        const label = new TextBlock(`lbl_${Date.now()}`, config.text);

        // Apply styling
        label.color = config.color || this.theme.textColor;
        label.fontSize = config.fontSize || 12;
        label.fontWeight = config.fontWeight || 'normal';
        label.heightInPixels = config.height || 20;

        if (config.alignment !== undefined) {
            label.textHorizontalAlignment = config.alignment;
        } else {
            label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        }

        return label;
    }

    /**
     * Create a title label with consistent styling
     */
    protected createTitle(text: string): TextBlock {
        return this.createLabel({
            text,
            fontSize: 16,
            fontWeight: 'bold',
            color: this.theme.primaryColor,
            alignment: Control.HORIZONTAL_ALIGNMENT_CENTER,
            height: 25
        });
    }

    /**
     * Create a subtitle label with consistent styling
     */
    protected createSubtitle(text: string): TextBlock {
        return this.createLabel({
            text,
            fontSize: 12,
            color: this.theme.secondaryTextColor,
            alignment: Control.HORIZONTAL_ALIGNMENT_LEFT,
            height: 18
        });
    }

    // ==================== Layout Helpers (delegates to UILayoutHelpers) ====================

    protected createHorizontalPanel(): StackPanel {
        return createHorizontalPanel();
    }

    protected createVerticalPanel(): StackPanel {
        return createVerticalPanel();
    }

    protected createGrid(rows: number, columns: number): Grid {
        return createGrid(rows, columns);
    }

    protected createSpacer(height: number = 10): Rectangle {
        return createSpacer(height);
    }

    // ==================== Progress Bar (delegates to UIProgressBar) ====================

    protected createProgressBar(width: number = 200, height: number = 20): {
        container: Rectangle;
        fill: Rectangle;
        text: TextBlock;
    } {
        return createProgressBar(width, height, this.theme);
    }

    protected updateProgressBar(
        progressBar: { fill: Rectangle; text: TextBlock },
        progress: number,
        containerWidth: number = 200
    ): void {
        updateProgressBar(progressBar, progress, containerWidth);
    }

    // ==================== Lifecycle Management ====================

    public show(): void {
        if (this.isDisposed) return;

        this.mainContainer.isVisible = true;
        this.isVisible = true;
        this.onShow();
    }

    public hide(): void {
        if (this.isDisposed) return;

        this.mainContainer.isVisible = false;
        this.isVisible = false;
        this.onHide();
    }

    public toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    public getIsVisible(): boolean {
        return this.isVisible;
    }

    public setPosition(x: string, y: string): void {
        if (this.isDisposed) return;

        this.mainContainer.left = x;
        this.mainContainer.top = y;
    }

    public setSize(width: string | number, height: string | number): void {
        if (this.isDisposed) return;

        if (typeof width === 'number') {
            this.mainContainer.widthInPixels = width;
        } else {
            this.mainContainer.width = width;
        }

        if (typeof height === 'number') {
            this.mainContainer.heightInPixels = height;
        } else {
            this.mainContainer.height = height;
        }
    }

    public setTheme(theme: Partial<UITheme>): void {
        this.theme = { ...this.theme, ...theme };
        this.onThemeChanged();
    }

    public dispose(): void {
        if (this.isDisposed) return;

        this.onDispose();

        this.eventHandlers.forEach(cleanup => cleanup());
        this.eventHandlers = [];

        if (this.parentTexture && this.mainContainer) {
            this.parentTexture.removeControl(this.mainContainer);
        }

        if (this.mainContainer) {
            this.mainContainer.dispose();
        }

        this.isDisposed = true;
    }

    // ==================== Lifecycle Hooks ====================

    protected onShow(): void {}
    protected onHide(): void {}

    protected onThemeChanged(): void {
        this.mainContainer.color = this.theme.primaryColor;
        this.mainContainer.background = this.theme.backgroundColor;
    }

    protected onDispose(): void {}

    // ==================== Utility Methods ====================

    protected getMainContainer(): Rectangle {
        return this.mainContainer;
    }

    protected getContentPanel(): StackPanel {
        return this.contentPanel;
    }

    public getIsDisposed(): boolean {
        return this.isDisposed;
    }

    protected addToContent(control: Control): void {
        this.contentPanel.addControl(control);
    }

    protected removeFromContent(control: Control): void {
        this.contentPanel.removeControl(control);
    }

    protected clearContent(): void {
        this.contentPanel.clearControls();
    }
}
