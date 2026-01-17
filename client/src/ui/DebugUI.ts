/**
 * DebugUI - Comprehensive debugging interface for development
 * 
 * Provides real-time monitoring, log viewing, performance metrics,
 * and AI learning insights for debugging and development.
 */

import { AdvancedDynamicTexture, Control, Rectangle, TextBlock, Button, StackPanel, ScrollViewer, Grid } from '@babylonjs/gui';
import { Logger, LogLevel, LogCategory, LogEntry } from '../utils/Logger';
import { GameEngine } from '../game/GameEngine';
import { AdaptiveQueenIntegration } from '../game/AdaptiveQueenIntegration';

export interface DebugUIConfig {
    parentTexture: AdvancedDynamicTexture;
    gameEngine: GameEngine;
    visible?: boolean;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

/**
 * Comprehensive debugging UI for development and monitoring
 */
export class DebugUI {
    private parentTexture: AdvancedDynamicTexture;
    private gameEngine: GameEngine;
    private logger: Logger;
    
    private mainPanel: Rectangle | null = null;
    private contentPanel: StackPanel | null = null;
    private logViewer: ScrollViewer | null = null;
    private logText: TextBlock | null = null;
    private statsText: TextBlock | null = null;
    private aiStatsText: TextBlock | null = null;
    
    private isVisible: boolean = false;
    private isMinimized: boolean = false;
    private currentTab: 'logs' | 'performance' | 'ai' | 'network' = 'logs';
    private logUpdateInterval: number | null = null;
    private statsUpdateInterval: number | null = null;
    
    private readonly PANEL_WIDTH = '400px';
    private readonly PANEL_HEIGHT = '600px';
    private readonly UPDATE_INTERVAL = 1000; // 1 second

    constructor(config: DebugUIConfig) {
        this.parentTexture = config.parentTexture;
        this.gameEngine = config.gameEngine;
        this.logger = Logger.getInstance();
        this.isVisible = config.visible !== false;
        
        this.createUI(config.position || 'top-right');
        
        if (this.isVisible) {
            this.show();
        }
    }

    /**
     * Create the debug UI components
     */
    private createUI(position: string): void {
        // Main panel
        this.mainPanel = new Rectangle('debugPanel');
        this.mainPanel.widthInPixels = parseInt(this.PANEL_WIDTH);
        this.mainPanel.heightInPixels = parseInt(this.PANEL_HEIGHT);
        this.mainPanel.cornerRadius = 10;
        this.mainPanel.color = '#ffffff';
        this.mainPanel.background = 'rgba(0, 0, 0, 0.8)';
        this.mainPanel.thickness = 2;
        
        // Position the panel
        this.positionPanel(position);
        
        this.parentTexture.addControl(this.mainPanel);

        // Create header
        this.createHeader();
        
        // Create tab buttons
        this.createTabButtons();
        
        // Create content area
        this.createContentArea();
        
        // Create initial content
        this.updateContent();
    }

    /**
     * Position the debug panel
     */
    private positionPanel(position: string): void {
        if (!this.mainPanel) return;
        
        switch (position) {
            case 'top-left':
                this.mainPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
                this.mainPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
                this.mainPanel.leftInPixels = 20;
                this.mainPanel.topInPixels = 20;
                break;
            case 'top-right':
                this.mainPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
                this.mainPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
                this.mainPanel.leftInPixels = -20;
                this.mainPanel.topInPixels = 20;
                break;
            case 'bottom-left':
                this.mainPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
                this.mainPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
                this.mainPanel.leftInPixels = 20;
                this.mainPanel.topInPixels = -20;
                break;
            case 'bottom-right':
                this.mainPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
                this.mainPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
                this.mainPanel.leftInPixels = -20;
                this.mainPanel.topInPixels = -20;
                break;
        }
    }

    /**
     * Create header with title and controls
     */
    private createHeader(): void {
        if (!this.mainPanel) return;
        
        const headerGrid = new Grid('debugHeader');
        headerGrid.heightInPixels = 40;
        headerGrid.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        headerGrid.addColumnDefinition(0.7);
        headerGrid.addColumnDefinition(0.15);
        headerGrid.addColumnDefinition(0.15);
        headerGrid.addRowDefinition(1);
        
        // Title
        const title = new TextBlock('debugTitle', '🔧 Debug Console');
        title.color = '#00ff88';
        title.fontSize = '16px';
        title.fontWeight = 'bold';
        title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        title.paddingLeftInPixels = 10;
        headerGrid.addControl(title, 0, 0);
        
        // Minimize button
        const minimizeBtn = Button.CreateSimpleButton('minimizeBtn', this.isMinimized ? '□' : '_');
        minimizeBtn.color = '#ffffff';
        minimizeBtn.background = 'rgba(255, 255, 255, 0.1)';
        minimizeBtn.onPointerClickObservable.add(() => {
            this.toggleMinimize();
        });
        headerGrid.addControl(minimizeBtn, 0, 1);
        
        // Close button
        const closeBtn = Button.CreateSimpleButton('closeBtn', '✕');
        closeBtn.color = '#ff4444';
        closeBtn.background = 'rgba(255, 68, 68, 0.1)';
        closeBtn.onPointerClickObservable.add(() => {
            this.hide();
        });
        headerGrid.addControl(closeBtn, 0, 2);
        
        this.mainPanel.addControl(headerGrid);
    }

    /**
     * Create tab buttons
     */
    private createTabButtons(): void {
        if (!this.mainPanel) return;
        
        const tabGrid = new Grid('debugTabs');
        tabGrid.heightInPixels = 35;
        tabGrid.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        tabGrid.topInPixels = 40;
        tabGrid.addColumnDefinition(0.25);
        tabGrid.addColumnDefinition(0.25);
        tabGrid.addColumnDefinition(0.25);
        tabGrid.addColumnDefinition(0.25);
        tabGrid.addRowDefinition(1);
        
        const tabs = [
            { id: 'logs', label: 'Logs' },
            { id: 'performance', label: 'Perf' },
            { id: 'ai', label: 'AI' },
            { id: 'network', label: 'Net' }
        ];
        
        tabs.forEach((tab, index) => {
            const tabBtn = Button.CreateSimpleButton(`tab_${tab.id}`, tab.label);
            tabBtn.color = this.currentTab === tab.id ? '#00ff88' : '#ffffff';
            tabBtn.background = this.currentTab === tab.id ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 255, 255, 0.1)';
            tabBtn.fontSize = '12px';
            
            tabBtn.onPointerClickObservable.add(() => {
                this.switchTab(tab.id as any);
            });
            
            tabGrid.addControl(tabBtn, 0, index);
        });
        
        this.mainPanel.addControl(tabGrid);
    }

    /**
     * Create content area
     */
    private createContentArea(): void {
        if (!this.mainPanel) return;
        
        this.contentPanel = new StackPanel('debugContent');
        this.contentPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.contentPanel.topInPixels = 75;
        this.contentPanel.heightInPixels = parseInt(this.PANEL_HEIGHT) - 85;
        this.contentPanel.paddingTopInPixels = 10;
        this.contentPanel.paddingLeftInPixels = 10;
        this.contentPanel.paddingRightInPixels = 10;
        
        this.mainPanel.addControl(this.contentPanel);
    }

    /**
     * Switch to a different tab
     */
    private switchTab(tab: 'logs' | 'performance' | 'ai' | 'network'): void {
        this.currentTab = tab;
        this.updateTabButtons();
        this.updateContent();
    }

    /**
     * Update tab button appearances
     */
    private updateTabButtons(): void {
        if (!this.mainPanel) return;
        
        const tabGrid = this.mainPanel.getChildByName('debugTabs') as Grid;
        if (!tabGrid) return;
        
        const tabs = ['logs', 'performance', 'ai', 'network'];
        tabs.forEach((tab, index) => {
            const tabBtn = tabGrid.getChildByName(`tab_${tab}`) as Button;
            if (tabBtn) {
                tabBtn.color = this.currentTab === tab ? '#00ff88' : '#ffffff';
                tabBtn.background = this.currentTab === tab ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 255, 255, 0.1)';
            }
        });
    }

    /**
     * Update content based on current tab
     */
    private updateContent(): void {
        if (!this.contentPanel) return;
        
        // Clear existing content
        this.contentPanel.clearControls();
        
        switch (this.currentTab) {
            case 'logs':
                this.createLogsContent();
                break;
            case 'performance':
                this.createPerformanceContent();
                break;
            case 'ai':
                this.createAIContent();
                break;
            case 'network':
                this.createNetworkContent();
                break;
        }
    }

    /**
     * Create logs tab content
     */
    private createLogsContent(): void {
        if (!this.contentPanel) return;
        
        // Log level filter buttons
        const filterGrid = new Grid('logFilters');
        filterGrid.heightInPixels = 30;
        filterGrid.addColumnDefinition(0.2);
        filterGrid.addColumnDefinition(0.2);
        filterGrid.addColumnDefinition(0.2);
        filterGrid.addColumnDefinition(0.2);
        filterGrid.addColumnDefinition(0.2);
        filterGrid.addRowDefinition(1);
        
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
        levels.forEach((level, index) => {
            const btn = Button.CreateSimpleButton(`filter_${level}`, level);
            btn.fontSize = '10px';
            btn.color = '#ffffff';
            btn.background = 'rgba(255, 255, 255, 0.1)';
            filterGrid.addControl(btn, 0, index);
        });
        
        this.contentPanel.addControl(filterGrid);
        
        // Log viewer
        this.logViewer = new ScrollViewer('logViewer');
        this.logViewer.heightInPixels = parseInt(this.PANEL_HEIGHT) - 150;
        this.logViewer.background = 'rgba(0, 0, 0, 0.3)';
        this.logViewer.barColor = '#00ff88';
        this.logViewer.barBackground = 'rgba(255, 255, 255, 0.1)';
        
        this.logText = new TextBlock('logText', 'Loading logs...');
        this.logText.color = '#ffffff';
        this.logText.fontSize = '10px';
        this.logText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.logText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.logText.textWrapping = true;
        this.logText.resizeToFit = true;
        
        this.logViewer.addControl(this.logText);
        this.contentPanel.addControl(this.logViewer);
        
        this.updateLogs();
    }

    /**
     * Create performance tab content
     */
    private createPerformanceContent(): void {
        if (!this.contentPanel) return;
        
        this.statsText = new TextBlock('statsText', 'Loading performance data...');
        this.statsText.color = '#ffffff';
        this.statsText.fontSize = '12px';
        this.statsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.statsText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.statsText.textWrapping = true;
        this.statsText.heightInPixels = parseInt(this.PANEL_HEIGHT) - 120;
        
        this.contentPanel.addControl(this.statsText);
        
        this.updatePerformanceStats();
    }

    /**
     * Create AI tab content
     */
    private createAIContent(): void {
        if (!this.contentPanel) return;
        
        this.aiStatsText = new TextBlock('aiStatsText', 'Loading AI data...');
        this.aiStatsText.color = '#ffffff';
        this.aiStatsText.fontSize = '12px';
        this.aiStatsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.aiStatsText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.aiStatsText.textWrapping = true;
        this.aiStatsText.heightInPixels = parseInt(this.PANEL_HEIGHT) - 120;
        
        this.contentPanel.addControl(this.aiStatsText);
        
        this.updateAIStats();
    }

    /**
     * Create network tab content
     */
    private createNetworkContent(): void {
        if (!this.contentPanel) return;
        
        const networkText = new TextBlock('networkText', 'Network monitoring coming soon...');
        networkText.color = '#ffffff';
        networkText.fontSize = '12px';
        networkText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        networkText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        
        this.contentPanel.addControl(networkText);
    }

    /**
     * Update logs display
     */
    private updateLogs(): void {
        if (!this.logText) return;
        
        const recentLogs = this.logger.getRecentLogs(50);
        const logLines = recentLogs.map(entry => {
            const timestamp = new Date(entry.timestamp).toLocaleTimeString();
            const level = LogLevel[entry.level].padEnd(8);
            const category = entry.category.padEnd(12);
            return `[${timestamp}] [${level}] [${category}] ${entry.message}`;
        });
        
        this.logText.text = logLines.join('\n');
        
        // Auto-scroll to bottom
        if (this.logViewer) {
            this.logViewer.verticalBar.value = 1;
        }
    }

    /**
     * Update performance statistics
     */
    private updatePerformanceStats(): void {
        if (!this.statsText) return;

        let stats = '🎯 PERFORMANCE METRICS\n\n';
        stats += 'Press F to toggle FPS counter\n\n';

        const logStats = this.logger.getLogStatistics();
        stats += `📊 LOGGING STATISTICS\n`;
        stats += `Total Entries: ${logStats.totalEntries}\n`;
        stats += `Remote Queue: ${logStats.queuedRemoteLogs}\n`;
        stats += `Remote Available: ${logStats.isRemoteAvailable ? 'Yes' : 'No'}\n`;

        this.statsText.text = stats;
    }

    /**
     * Update AI statistics
     */
    private updateAIStats(): void {
        if (!this.aiStatsText) return;
        
        const integration = this.gameEngine.getAdaptiveQueenIntegration();
        
        let stats = '🧠 AI LEARNING SYSTEM\n\n';
        
        if (integration) {
            const aiStats = integration.getAIStatistics();
            const connectionStatus = integration.getConnectionStatus();
            
            stats += `🔗 CONNECTION STATUS\n`;
            stats += `Connected: ${aiStats.isConnected ? 'Yes' : 'No'}\n`;
            stats += `Learning Enabled: ${aiStats.learningEnabled ? 'Yes' : 'No'}\n`;
            stats += `Queued Messages: ${aiStats.queuedMessages}\n\n`;
            
            stats += `👑 QUEEN STATUS\n`;
            stats += `Current Generation: ${aiStats.currentGeneration}\n`;
            
            const currentQueen = integration.getCurrentQueen();
            if (currentQueen) {
                stats += `Queen ID: ${currentQueen.id}\n`;
                stats += `Phase: ${currentQueen.getCurrentPhase()}\n`;
                stats += `Learning Progress: ${(currentQueen.getLearningProgress().progress * 100).toFixed(1)}%\n`;
            } else {
                stats += `No active Queen\n`;
            }
            
            stats += `\n📈 GENERATION HISTORY\n`;
            const history = aiStats.generationHistory;
            if (history.size > 0) {
                Array.from(history.entries()).slice(-5).forEach(([gen, data]) => {
                    stats += `Gen ${gen}: ${data.survivalTime || 'N/A'}s\n`;
                });
            } else {
                stats += `No generation data yet\n`;
            }
            
        } else {
            stats += `AI Integration not available\n`;
            stats += `Check backend connection\n`;
        }
        
        this.aiStatsText.text = stats;
    }

    /**
     * Show the debug UI
     */
    public show(): void {
        if (this.mainPanel) {
            this.mainPanel.isVisible = true;
            this.isVisible = true;
            
            // Start update intervals
            this.startUpdateIntervals();
        }
    }

    /**
     * Hide the debug UI
     */
    public hide(): void {
        if (this.mainPanel) {
            this.mainPanel.isVisible = false;
            this.isVisible = false;
            
            // Stop update intervals
            this.stopUpdateIntervals();
        }
    }

    /**
     * Toggle visibility
     */
    public toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Toggle minimize state
     */
    private toggleMinimize(): void {
        this.isMinimized = !this.isMinimized;
        
        if (this.mainPanel && this.contentPanel) {
            if (this.isMinimized) {
                this.mainPanel.heightInPixels = 40;
                this.contentPanel.isVisible = false;
            } else {
                this.mainPanel.heightInPixels = parseInt(this.PANEL_HEIGHT);
                this.contentPanel.isVisible = true;
            }
        }
        
        // Update minimize button text
        const headerGrid = this.mainPanel?.getChildByName('debugHeader') as Grid;
        const minimizeBtn = headerGrid?.getChildByName('minimizeBtn') as Button;
        if (minimizeBtn) {
            minimizeBtn.textBlock!.text = this.isMinimized ? '□' : '_';
        }
    }

    /**
     * Start update intervals
     */
    private startUpdateIntervals(): void {
        this.stopUpdateIntervals(); // Clear existing intervals
        
        this.logUpdateInterval = window.setInterval(() => {
            if (this.currentTab === 'logs') {
                this.updateLogs();
            }
        }, this.UPDATE_INTERVAL);
        
        this.statsUpdateInterval = window.setInterval(() => {
            if (this.currentTab === 'performance') {
                this.updatePerformanceStats();
            } else if (this.currentTab === 'ai') {
                this.updateAIStats();
            }
        }, this.UPDATE_INTERVAL);
    }

    /**
     * Stop update intervals
     */
    private stopUpdateIntervals(): void {
        if (this.logUpdateInterval) {
            clearInterval(this.logUpdateInterval);
            this.logUpdateInterval = null;
        }
        
        if (this.statsUpdateInterval) {
            clearInterval(this.statsUpdateInterval);
            this.statsUpdateInterval = null;
        }
    }

    /**
     * Check if debug UI is visible
     */
    public isDebugVisible(): boolean {
        return this.isVisible;
    }

    /**
     * Dispose of the debug UI
     */
    public dispose(): void {
        this.stopUpdateIntervals();
        
        if (this.mainPanel) {
            this.parentTexture.removeControl(this.mainPanel);
            this.mainPanel.dispose();
        }
        
        this.mainPanel = null;
        this.contentPanel = null;
        this.logViewer = null;
        this.logText = null;
        this.statsText = null;
        this.aiStatsText = null;
    }
}