/**
 * HelpTabNavigation - Tab bar component for help window
 *
 * Manages horizontal tab navigation with active/inactive states.
 */

import { StackPanel, Button, Control } from '@babylonjs/gui';
import { HELP_COLORS, HELP_TYPOGRAPHY, HELP_DIMENSIONS, HELP_TABS, TabDefinition } from './HelpStyles';

// ==================== Tab Navigation ====================

export class HelpTabNavigation {
    private tabContainer: StackPanel;
    private tabs: Map<string, Button> = new Map();
    private activeTabId: string = 'navigation';
    private onTabSelected: ((tabId: string) => void) | null = null;

    constructor() {
        this.tabContainer = this.createTabContainer();
        this.createTabs();
    }

    /**
     * Get the tab container panel
     */
    public getContainer(): StackPanel {
        return this.tabContainer;
    }

    /**
     * Set callback for tab selection
     */
    public setOnTabSelected(callback: (tabId: string) => void): void {
        this.onTabSelected = callback;
    }

    /**
     * Select a tab by ID
     */
    public selectTab(tabId: string): void {
        if (!this.tabs.has(tabId)) {
            return;
        }

        // Update visual states
        for (const [id, button] of this.tabs.entries()) {
            const isActive = id === tabId;
            this.applyTabStyle(button, isActive);
        }

        this.activeTabId = tabId;

        // Notify listener
        if (this.onTabSelected) {
            this.onTabSelected(tabId);
        }
    }

    /**
     * Get the currently active tab ID
     */
    public getActiveTabId(): string {
        return this.activeTabId;
    }

    /**
     * Reset to default tab (Navigation)
     */
    public resetToDefault(): void {
        this.selectTab('navigation');
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.tabs.clear();
        this.onTabSelected = null;
    }

    // ==================== Private Methods ====================

    private createTabContainer(): StackPanel {
        const container = new StackPanel('help_tab_container');
        container.isVertical = false;
        container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        container.heightInPixels = HELP_DIMENSIONS.tabBarHeight;
        container.spacing = HELP_DIMENSIONS.tabGap;
        return container;
    }

    private createTabs(): void {
        for (const tabDef of HELP_TABS) {
            const tab = this.createTab(tabDef);
            this.tabs.set(tabDef.id, tab);
            this.tabContainer.addControl(tab);
        }

        // Set initial active state
        this.applyTabStyle(this.tabs.get('navigation')!, true);
    }

    private createTab(definition: TabDefinition): Button {
        const tab = Button.CreateSimpleButton(`tab_${definition.id}`, definition.label);

        tab.widthInPixels = HELP_DIMENSIONS.tabWidth;
        tab.heightInPixels = HELP_DIMENSIONS.tabHeight;
        tab.cornerRadius = 5;
        tab.thickness = 1;
        tab.fontSize = HELP_TYPOGRAPHY.bodySize;
        tab.fontFamily = HELP_TYPOGRAPHY.fontFamily;
        tab.fontWeight = 'bold';

        // Default to inactive style
        this.applyTabStyle(tab, false);

        // Click handler
        tab.onPointerUpObservable.add(() => {
            this.selectTab(definition.id);
        });

        // Hover effects
        tab.onPointerEnterObservable.add(() => {
            if (definition.id !== this.activeTabId) {
                tab.background = HELP_COLORS.tabHover;
            }
        });

        tab.onPointerOutObservable.add(() => {
            if (definition.id !== this.activeTabId) {
                tab.background = HELP_COLORS.tabInactive;
            }
        });

        return tab;
    }

    private applyTabStyle(button: Button, isActive: boolean): void {
        if (isActive) {
            button.background = HELP_COLORS.tabActive;
            button.color = HELP_COLORS.tabActive;
            if (button.textBlock) {
                button.textBlock.color = HELP_COLORS.tabActiveText;
            }
        } else {
            button.background = HELP_COLORS.tabInactive;
            button.color = HELP_COLORS.tabInactiveText;
            if (button.textBlock) {
                button.textBlock.color = HELP_COLORS.tabInactiveText;
            }
        }
    }
}
