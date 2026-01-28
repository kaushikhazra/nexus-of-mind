/**
 * HelpWindow - Main in-game help overlay component
 *
 * Provides a keyboard-triggered help window with tabbed content
 * for game navigation, controls, and enemy information.
 *
 * Triggers: H key to open, Escape key or close button to close.
 */

import {
    AdvancedDynamicTexture,
    Rectangle,
    TextBlock,
    StackPanel,
    Button,
    Control,
    ScrollViewer
} from '@babylonjs/gui';
import { HELP_COLORS, HELP_TYPOGRAPHY, HELP_DIMENSIONS } from './HelpStyles';
import { HelpTabNavigation } from './HelpTabNavigation';
import { HelpContentBuilder } from './HelpContentBuilder';

// ==================== Help Window ====================

export class HelpWindow {
    private guiTexture: AdvancedDynamicTexture;
    private mainContainer: Rectangle | null = null;
    private tabNavigation: HelpTabNavigation | null = null;
    private contentPanels: Map<string, StackPanel> = new Map();
    private scrollViewer: ScrollViewer | null = null;
    private isOpen: boolean = false;
    private isDisposed: boolean = false;

    // Keyboard event handlers
    private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

    constructor(guiTexture: AdvancedDynamicTexture) {
        this.guiTexture = guiTexture;
        this.initialize();
        this.setupKeyboardHandlers();
    }

    // ==================== Public Methods ====================

    /**
     * Show the help window
     */
    public show(): void {
        if (this.isDisposed || this.isOpen || !this.mainContainer) {
            return;
        }

        this.mainContainer.isVisible = true;
        this.isOpen = true;

        // Reset to default tab
        if (this.tabNavigation) {
            this.tabNavigation.resetToDefault();
            this.showTabContent('navigation');
        }
    }

    /**
     * Hide the help window
     */
    public hide(): void {
        if (this.isDisposed || !this.isOpen || !this.mainContainer) {
            return;
        }

        this.mainContainer.isVisible = false;
        this.isOpen = false;
    }

    /**
     * Check if the help window is currently visible
     */
    public isVisible(): boolean {
        return this.isOpen;
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        if (this.isDisposed) {
            return;
        }

        // Remove keyboard handlers
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }

        // Dispose tab navigation
        if (this.tabNavigation) {
            this.tabNavigation.dispose();
            this.tabNavigation = null;
        }

        // Clear content panels
        this.contentPanels.clear();

        // Remove from GUI
        if (this.mainContainer) {
            this.guiTexture.removeControl(this.mainContainer);
            this.mainContainer = null;
        }

        this.isDisposed = true;
    }

    // ==================== Initialization ====================

    private initialize(): void {
        this.createMainContainer();
        this.createTitleBar();
        this.createTabNavigation();
        this.createContentArea();
        this.createContentPanels();
    }

    private createMainContainer(): void {
        this.mainContainer = new Rectangle('help_window_container');

        // Positioning - centered
        this.mainContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.mainContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;

        // Size
        this.mainContainer.widthInPixels = HELP_DIMENSIONS.windowWidth;
        this.mainContainer.heightInPixels = HELP_DIMENSIONS.windowHeight;

        // Styling
        this.mainContainer.cornerRadius = HELP_DIMENSIONS.cornerRadius;
        this.mainContainer.color = HELP_COLORS.primary;
        this.mainContainer.thickness = HELP_DIMENSIONS.borderWidth;
        this.mainContainer.background = HELP_COLORS.background;

        // Initially hidden
        this.mainContainer.isVisible = false;

        // Add shadow effect
        this.mainContainer.shadowColor = 'rgba(0, 255, 136, 0.3)';
        this.mainContainer.shadowBlur = 20;
        this.mainContainer.shadowOffsetX = 0;
        this.mainContainer.shadowOffsetY = 0;

        this.guiTexture.addControl(this.mainContainer);
    }

    private createTitleBar(): void {
        if (!this.mainContainer) return;

        // Title bar container
        const titleBar = new Rectangle('help_title_bar');
        titleBar.heightInPixels = HELP_DIMENSIONS.titleBarHeight;
        titleBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        titleBar.thickness = 0;
        titleBar.background = 'transparent';

        // Title text with diamond icons
        const title = new TextBlock('help_title', '◊ IN-GAME HELP ◊');
        title.color = HELP_COLORS.primary;
        title.fontSize = HELP_TYPOGRAPHY.titleSize;
        title.fontFamily = HELP_TYPOGRAPHY.fontFamily;
        title.fontWeight = 'bold';
        title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        title.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        titleBar.addControl(title);

        // Close button
        const closeButton = this.createCloseButton();
        titleBar.addControl(closeButton);

        this.mainContainer.addControl(titleBar);
    }

    private createCloseButton(): Button {
        const closeButton = Button.CreateSimpleButton('help_close_btn', 'X');

        closeButton.widthInPixels = HELP_DIMENSIONS.closeButtonSize;
        closeButton.heightInPixels = HELP_DIMENSIONS.closeButtonSize;
        closeButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        closeButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        closeButton.left = '-10px';

        closeButton.cornerRadius = 5;
        closeButton.thickness = 1;
        closeButton.color = HELP_COLORS.closeButton;
        closeButton.background = 'transparent';
        closeButton.fontSize = HELP_TYPOGRAPHY.headerSize;
        closeButton.fontFamily = HELP_TYPOGRAPHY.fontFamily;
        closeButton.fontWeight = 'bold';

        if (closeButton.textBlock) {
            closeButton.textBlock.color = HELP_COLORS.closeButton;
        }

        // Hover effects
        closeButton.onPointerEnterObservable.add(() => {
            closeButton.background = HELP_COLORS.closeButtonHover;
        });

        closeButton.onPointerOutObservable.add(() => {
            closeButton.background = 'transparent';
        });

        // Click handler
        closeButton.onPointerUpObservable.add(() => {
            this.hide();
        });

        return closeButton;
    }

    private createTabNavigation(): void {
        if (!this.mainContainer) return;

        this.tabNavigation = new HelpTabNavigation();

        // Position below title bar
        const tabContainer = this.tabNavigation.getContainer();
        tabContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        tabContainer.topInPixels = HELP_DIMENSIONS.titleBarHeight + 5;

        // Set up tab selection callback
        this.tabNavigation.setOnTabSelected((tabId: string) => {
            this.showTabContent(tabId);
        });

        this.mainContainer.addControl(tabContainer);
    }

    private createContentArea(): void {
        if (!this.mainContainer) return;

        // Create scroll viewer for content
        this.scrollViewer = new ScrollViewer('help_scroll_viewer');
        this.scrollViewer.widthInPixels = HELP_DIMENSIONS.windowWidth - 40;
        this.scrollViewer.heightInPixels = HELP_DIMENSIONS.windowHeight - HELP_DIMENSIONS.titleBarHeight - HELP_DIMENSIONS.tabBarHeight - 30;
        this.scrollViewer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.scrollViewer.topInPixels = HELP_DIMENSIONS.titleBarHeight + HELP_DIMENSIONS.tabBarHeight + 15;
        this.scrollViewer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;

        this.scrollViewer.thickness = 0;
        this.scrollViewer.barSize = 10;
        this.scrollViewer.barColor = HELP_COLORS.primary;
        this.scrollViewer.barBackground = 'rgba(0, 255, 136, 0.1)';

        this.mainContainer.addControl(this.scrollViewer);
    }

    private createContentPanels(): void {
        // Create content for each tab
        const navigationContent = HelpContentBuilder.buildNavigationContent();
        const controlsContent = HelpContentBuilder.buildControlsContent();
        const enemyContent = HelpContentBuilder.buildEnemyContent();

        this.contentPanels.set('navigation', navigationContent);
        this.contentPanels.set('controls', controlsContent);
        this.contentPanels.set('enemy', enemyContent);

        // Add all panels to scroll viewer, hide all except first
        if (this.scrollViewer) {
            this.scrollViewer.addControl(navigationContent);
            this.scrollViewer.addControl(controlsContent);
            this.scrollViewer.addControl(enemyContent);
        }

        // Hide non-default tabs
        controlsContent.isVisible = false;
        enemyContent.isVisible = false;
    }

    private showTabContent(tabId: string): void {
        // Hide all panels
        for (const [id, panel] of this.contentPanels.entries()) {
            panel.isVisible = id === tabId;
        }

        // Reset scroll position
        if (this.scrollViewer) {
            this.scrollViewer.verticalBar.value = 0;
        }
    }

    // ==================== Keyboard Handling ====================

    private setupKeyboardHandlers(): void {
        this.keydownHandler = (event: KeyboardEvent) => {
            // H key opens help (only if not already open)
            if (event.code === 'KeyH' && !this.isOpen) {
                this.show();
                event.preventDefault();
                event.stopPropagation();
            }

            // Escape key closes help (only if open)
            if (event.code === 'Escape' && this.isOpen) {
                this.hide();
                event.preventDefault();
                event.stopPropagation();
            }
        };

        window.addEventListener('keydown', this.keydownHandler);
    }
}
