/**
 * HelpWindow - HTML-based in-game help overlay
 *
 * Provides a keyboard-triggered help window with tabbed content
 * for game navigation, controls, and enemy information.
 *
 * Triggers: H key to open, Escape key or close button to close.
 */

import { AdvancedDynamicTexture } from '@babylonjs/gui';
import { UI_FONT_FAMILY } from '../base/UITheme';

// ==================== Types ====================

interface TabContent {
    id: string;
    label: string;
    content: string;
}

// ==================== Constants ====================

const HELP_COLORS = {
    primary: '#00ffff',
    primaryGlow: 'rgba(0, 255, 255, 0.3)',
    background: 'rgba(0, 20, 40, 0.85)',
    text: '#ffffff',
    secondaryText: '#cccccc',
    tabActive: '#00ffff',
    tabActiveText: '#000000',
    tabInactive: 'transparent',
    tableRowAlt: 'rgba(0, 255, 255, 0.08)'
};

// ==================== Tab Content ====================

const TABS: TabContent[] = [
    {
        id: 'navigation',
        label: 'Navigation',
        content: `
            <div class="help-section">
                <div class="help-section-title">CAMERA MOVEMENT</div>
                <table class="help-table">
                    <tr><td class="help-key">W / Arrow Up</td><td>Move camera forward</td></tr>
                    <tr><td class="help-key">S / Arrow Down</td><td>Move camera backward</td></tr>
                    <tr><td class="help-key">A / Arrow Left</td><td>Rotate camera left</td></tr>
                    <tr><td class="help-key">D / Arrow Right</td><td>Rotate camera right</td></tr>
                </table>
            </div>
            <div class="help-section">
                <div class="help-section-title">ZOOM & VIEW</div>
                <table class="help-table">
                    <tr><td class="help-key">Mouse Wheel</td><td>Zoom in/out</td></tr>
                    <tr><td class="help-key">Mouse Drag</td><td>Rotate camera view</td></tr>
                    <tr><td class="help-key">H Key</td><td>Open this help window</td></tr>
                    <tr><td class="help-key">Escape</td><td>Close help / Cancel action</td></tr>
                </table>
            </div>
        `
    },
    {
        id: 'controls',
        label: 'Controls',
        content: `
            <div class="help-section">
                <div class="help-section-title">BUILDINGS</div>
                <div class="help-text">
                    <div><strong>Placing Buildings:</strong></div>
                    <div class="help-indent">1. Click a building button in the panel</div>
                    <div class="help-indent">2. Move mouse to preview placement location</div>
                    <div class="help-indent">3. Left-click to place (requires energy)</div>
                    <div class="help-indent">4. Press ESC to cancel placement</div>
                    <div style="margin-top: 8px;"><strong>Packing Power Plants:</strong></div>
                    <div class="help-indent">Select a power plant, then click "Pack" button</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">UNITS</div>
                <table class="help-table">
                    <tr><td class="help-key">Workers</td><td>Created from Base, mine minerals</td></tr>
                    <tr><td class="help-key">Protectors</td><td>Created from Base, combat units</td></tr>
                </table>
            </div>
            <div class="help-section">
                <div class="help-section-title">UNIT MOVEMENT</div>
                <table class="help-table">
                    <tr><td class="help-key">Left-click unit</td><td>Select the unit</td></tr>
                    <tr><td class="help-key">Left-click mineral</td><td>Move worker to mine</td></tr>
                    <tr><td class="help-key">Left-click terrain</td><td>Move protector (auto-attacks)</td></tr>
                    <tr><td class="help-key">Right-click</td><td>View information tooltip</td></tr>
                </table>
            </div>
        `
    },
    {
        id: 'enemy',
        label: 'Enemy',
        content: `
            <div class="help-section">
                <div class="help-section-title">ENERGY PARASITES</div>
                <div class="help-text">
                    The planet is home to hostile Energy Parasites that protect the Adaptive Queen. They hunt your units for energy.
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">PARASITE TYPES</div>
                <div class="help-subheader">Combat Parasites</div>
                <div class="help-text help-indent">
                    <div>- Aggressive, combat-focused behavior</div>
                    <div>- Prioritize attacking your Protectors</div>
                </div>
                <div class="help-subheader">Energy Parasites</div>
                <div class="help-text help-indent">
                    <div>- Target your Workers specifically</div>
                    <div>- Steal energy, weaker but more numerous</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">STRATEGY TIPS</div>
                <div class="help-text help-indent">
                    <div>- Keep Protectors near your Workers</div>
                    <div>- Parasites patrol around their hive territory</div>
                    <div>- Destroying parasites rewards energy</div>
                    <div>- The Queen adapts to your tactics over time</div>
                </div>
            </div>
        `
    }
];

// ==================== Help Window Class ====================

export class HelpWindow {
    private guiTexture: AdvancedDynamicTexture;
    private container: HTMLElement | null = null;
    private isOpen: boolean = false;
    private isDisposed: boolean = false;
    private activeTabId: string = 'navigation';
    private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
    private styleElement: HTMLStyleElement | null = null;

    constructor(guiTexture: AdvancedDynamicTexture) {
        this.guiTexture = guiTexture;
        this.initialize();
        this.setupKeyboardHandlers();
    }

    // ==================== Public Methods ====================

    public show(): void {
        if (this.isDisposed || this.isOpen || !this.container) return;
        this.container.style.display = 'flex';
        this.isOpen = true;
        this.selectTab('navigation');
    }

    public hide(): void {
        if (this.isDisposed || !this.isOpen || !this.container) return;
        this.container.style.display = 'none';
        this.isOpen = false;
    }

    public isVisible(): boolean {
        return this.isOpen;
    }

    public dispose(): void {
        if (this.isDisposed) return;

        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }

        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        if (this.styleElement && this.styleElement.parentNode) {
            this.styleElement.parentNode.removeChild(this.styleElement);
        }

        this.isDisposed = true;
    }

    // ==================== Private Methods ====================

    private initialize(): void {
        this.injectStyles();
        this.createContainer();
    }

    private injectStyles(): void {
        if (document.getElementById('help-window-styles')) return;

        this.styleElement = document.createElement('style');
        this.styleElement.id = 'help-window-styles';
        this.styleElement.textContent = `
            .help-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                pointer-events: none;
            }

            .help-window {
                background: ${HELP_COLORS.background};
                border: 2px solid ${HELP_COLORS.primary};
                border-radius: 10px;
                width: 620px;
                max-height: 520px;
                font-family: ${UI_FONT_FAMILY};
                color: ${HELP_COLORS.text};
                box-shadow: 0 0 30px ${HELP_COLORS.primaryGlow};
                pointer-events: auto;
                display: flex;
                flex-direction: column;
            }

            .help-header {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 14px 16px;
                position: relative;
                border-bottom: 1px solid rgba(0, 255, 255, 0.2);
            }

            .help-title {
                font-size: 18px;
                font-weight: bold;
                color: ${HELP_COLORS.primary};
                text-shadow: 0 0 10px ${HELP_COLORS.primaryGlow};
                letter-spacing: 2px;
            }

            .help-close-btn {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                width: 28px;
                height: 28px;
                background: transparent;
                border: 1px solid ${HELP_COLORS.primary};
                border-radius: 4px;
                color: ${HELP_COLORS.primary};
                font-family: ${UI_FONT_FAMILY};
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .help-close-btn:hover {
                background: rgba(0, 255, 255, 0.2);
                box-shadow: 0 0 10px ${HELP_COLORS.primaryGlow};
            }

            .help-tabs {
                display: flex;
                justify-content: center;
                gap: 8px;
                padding: 12px 16px;
                border-bottom: 1px solid rgba(0, 255, 255, 0.2);
            }

            .help-tab {
                padding: 8px 24px;
                background: ${HELP_COLORS.tabInactive};
                border: 1px solid ${HELP_COLORS.primary};
                border-radius: 4px;
                color: ${HELP_COLORS.primary};
                font-family: ${UI_FONT_FAMILY};
                font-size: 12px;
                font-weight: bold;
                letter-spacing: 1px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .help-tab:hover {
                background: rgba(0, 255, 255, 0.15);
            }

            .help-tab.active {
                background: ${HELP_COLORS.tabActive};
                color: ${HELP_COLORS.tabActiveText};
            }

            .help-content {
                flex: 1;
                overflow-y: auto;
                padding: 16px 20px;
            }

            .help-content::-webkit-scrollbar {
                width: 8px;
            }

            .help-content::-webkit-scrollbar-track {
                background: rgba(0, 255, 255, 0.1);
                border-radius: 4px;
            }

            .help-content::-webkit-scrollbar-thumb {
                background: ${HELP_COLORS.primary};
                border-radius: 4px;
            }

            .help-section {
                margin-bottom: 18px;
            }

            .help-section:last-child {
                margin-bottom: 0;
            }

            .help-section-title {
                font-size: 14px;
                font-weight: bold;
                color: ${HELP_COLORS.primary};
                margin-bottom: 10px;
                letter-spacing: 1px;
            }

            .help-subheader {
                font-size: 13px;
                font-weight: bold;
                color: ${HELP_COLORS.primary};
                margin: 10px 0 6px 0;
            }

            .help-table {
                width: 100%;
                border-collapse: collapse;
            }

            .help-table tr:nth-child(odd) {
                background: ${HELP_COLORS.tableRowAlt};
            }

            .help-table td {
                padding: 8px 12px;
                font-size: 12px;
                vertical-align: middle;
            }

            .help-table .help-key {
                color: ${HELP_COLORS.primary};
                font-weight: bold;
                width: 160px;
                letter-spacing: 0.5px;
            }

            .help-text {
                font-size: 12px;
                line-height: 1.6;
                color: ${HELP_COLORS.text};
            }

            .help-text strong {
                color: ${HELP_COLORS.primary};
            }

            .help-indent {
                padding-left: 16px;
            }

            .help-indent > div {
                margin: 4px 0;
                color: ${HELP_COLORS.secondaryText};
            }
        `;
        document.head.appendChild(this.styleElement);
    }

    private createContainer(): void {
        this.container = document.createElement('div');
        this.container.className = 'help-overlay';
        this.container.innerHTML = `
            <div class="help-window">
                <div class="help-header">
                    <div class="help-title">◊ IN-GAME HELP ◊</div>
                    <button class="help-close-btn">X</button>
                </div>
                <div class="help-tabs">
                    ${TABS.map(tab => `
                        <button class="help-tab${tab.id === 'navigation' ? ' active' : ''}" data-tab="${tab.id}">
                            ${tab.label}
                        </button>
                    `).join('')}
                </div>
                <div class="help-content">
                    ${TABS[0].content}
                </div>
            </div>
        `;

        // Add event listeners
        const closeBtn = this.container.querySelector('.help-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        const tabs = this.container.querySelectorAll('.help-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const tabId = target.dataset.tab;
                if (tabId) this.selectTab(tabId);
            });
        });

        document.body.appendChild(this.container);
    }

    private selectTab(tabId: string): void {
        if (!this.container) return;

        this.activeTabId = tabId;

        // Update tab buttons
        const tabs = this.container.querySelectorAll('.help-tab');
        tabs.forEach(tab => {
            const element = tab as HTMLElement;
            if (element.dataset.tab === tabId) {
                element.classList.add('active');
            } else {
                element.classList.remove('active');
            }
        });

        // Update content
        const content = this.container.querySelector('.help-content');
        const tabData = TABS.find(t => t.id === tabId);
        if (content && tabData) {
            content.innerHTML = tabData.content;
        }
    }

    private setupKeyboardHandlers(): void {
        this.keydownHandler = (event: KeyboardEvent) => {
            if (event.code === 'KeyH' && !this.isOpen) {
                this.show();
                event.preventDefault();
                event.stopPropagation();
            }

            if (event.code === 'Escape' && this.isOpen) {
                this.hide();
                event.preventDefault();
                event.stopPropagation();
            }
        };

        window.addEventListener('keydown', this.keydownHandler);
    }
}
