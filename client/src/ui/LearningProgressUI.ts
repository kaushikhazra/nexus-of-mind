/**
 * LearningProgressUI - UI component for displaying AI learning progress
 * 
 * Provides visual feedback about Queen learning phases, progress, and insights.
 * Shows generation tracking, learning phase indicators, time estimates, and
 * generation comparisons to make AI learning transparent and engaging.
 */

import { AdvancedDynamicTexture, Rectangle, TextBlock, StackPanel, Control, Button, Grid } from '@babylonjs/gui';
import { LearningProgress, AdaptiveQueen } from '../game/entities/AdaptiveQueen';

export interface LearningProgressUIConfig {
    parentTexture: AdvancedDynamicTexture;
    position?: { x: string; y: string };
    size?: { width: string; height: string };
    visible?: boolean;
}

export interface GenerationComparison {
    previousGeneration: number;
    currentGeneration: number;
    improvements: string[];
    survivalTimeImprovement: number;
    strategicAdvances: string[];
}

/**
 * LearningProgressUI class - Manages AI learning progress visualization
 */
export class LearningProgressUI {
    private parentTexture: AdvancedDynamicTexture;
    private mainContainer!: Rectangle;
    private contentPanel!: StackPanel;

    // UI Components
    private titleText!: TextBlock;
    private generationText!: TextBlock;
    private phaseText!: TextBlock;
    private progressBar!: Rectangle;
    private progressFill!: Rectangle;
    private progressText!: TextBlock;
    private timeRemainingText!: TextBlock;
    private insightsPanel!: StackPanel;
    private improvementsPanel!: StackPanel;
    private comparisonPanel!: StackPanel;
    private toggleButton!: Button;
    
    // State
    private currentQueen?: AdaptiveQueen;
    private isVisible: boolean = false; // Default to hidden (KISS)
    private isExpanded: boolean = false;
    private lastProgress?: LearningProgress;
    private generationHistory: Map<number, LearningProgress> = new Map();
    
    // Animation
    private progressAnimationSpeed = 0.02;
    private currentProgressDisplay = 0;
    private targetProgress = 0;

    constructor(config: LearningProgressUIConfig) {
        this.parentTexture = config.parentTexture;
        this.isVisible = config.visible === true; // Default to hidden unless explicitly enabled
        
        this.createUI(config);
        this.setupEventHandlers();
        
        // LearningProgressUI initialized silently
    }

    /**
     * Create the main UI structure
     */
    private createUI(config: LearningProgressUIConfig): void {
        // Main container
        this.mainContainer = new Rectangle('learningProgressContainer');
        this.mainContainer.widthInPixels = 320;
        this.mainContainer.heightInPixels = 200;
        this.mainContainer.cornerRadius = 10;
        this.mainContainer.color = '#00ff88';
        this.mainContainer.thickness = 2;
        this.mainContainer.background = 'rgba(0, 20, 40, 0.9)';
        this.mainContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this.mainContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.mainContainer.topInPixels = 120;
        this.mainContainer.left = '-20px';
        this.mainContainer.isVisible = this.isVisible;
        
        // Apply custom position if provided
        if (config.position) {
            if (config.position.x) this.mainContainer.left = config.position.x;
            if (config.position.y) this.mainContainer.top = config.position.y;
        }
        
        // Apply custom size if provided
        if (config.size) {
            if (config.size.width) this.mainContainer.width = config.size.width;
            if (config.size.height) this.mainContainer.height = config.size.height;
        }
        
        this.parentTexture.addControl(this.mainContainer);
        
        // Content panel
        this.contentPanel = new StackPanel('learningContentPanel');
        this.contentPanel.isVertical = true;
        this.contentPanel.paddingTopInPixels = 10;
        this.contentPanel.paddingBottomInPixels = 10;
        this.contentPanel.paddingLeftInPixels = 15;
        this.contentPanel.paddingRightInPixels = 15;
        this.mainContainer.addControl(this.contentPanel);
        
        this.createHeader();
        this.createProgressSection();
        this.createInsightsSection();
        this.createComparisonSection();
    }

    /**
     * Create header section with title and generation info
     */
    private createHeader(): void {
        // Title
        this.titleText = new TextBlock('learningTitle', 'AI LEARNING');
        this.titleText.color = '#00ff88';
        this.titleText.fontSize = 16;
        this.titleText.fontWeight = 'bold';
        this.titleText.heightInPixels = 25;
        this.titleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.contentPanel.addControl(this.titleText);
        
        // Generation info
        this.generationText = new TextBlock('generationText', 'Generation: --');
        this.generationText.color = '#ffffff';
        this.generationText.fontSize = 12;
        this.generationText.heightInPixels = 20;
        this.generationText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.contentPanel.addControl(this.generationText);
        
        // Phase info
        this.phaseText = new TextBlock('phaseText', 'Phase: Initializing');
        this.phaseText.color = '#cccccc';
        this.phaseText.fontSize = 11;
        this.phaseText.heightInPixels = 18;
        this.phaseText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.contentPanel.addControl(this.phaseText);
    }

    /**
     * Create progress section with progress bar and time estimate
     */
    private createProgressSection(): void {
        // Progress bar container
        this.progressBar = new Rectangle('progressBarContainer');
        this.progressBar.heightInPixels = 20;
        this.progressBar.color = '#555555';
        this.progressBar.thickness = 1;
        this.progressBar.background = 'rgba(50, 50, 50, 0.8)';
        this.progressBar.cornerRadius = 3;
        this.progressBar.topInPixels = 5;
        this.contentPanel.addControl(this.progressBar);
        
        // Progress fill
        this.progressFill = new Rectangle('progressFill');
        this.progressFill.color = '#00ff88';
        this.progressFill.thickness = 0;
        this.progressFill.background = '#00ff88';
        this.progressFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.progressFill.widthInPixels = 0;
        this.progressBar.addControl(this.progressFill);
        
        // Progress text
        this.progressText = new TextBlock('progressText', '0%');
        this.progressText.color = '#ffffff';
        this.progressText.fontSize = 10;
        this.progressText.fontWeight = 'bold';
        this.progressBar.addControl(this.progressText);
        
        // Time remaining
        this.timeRemainingText = new TextBlock('timeRemainingText', 'Time remaining: --');
        this.timeRemainingText.color = '#aaaaaa';
        this.timeRemainingText.fontSize = 10;
        this.timeRemainingText.heightInPixels = 16;
        this.timeRemainingText.topInPixels = 3;
        this.timeRemainingText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.contentPanel.addControl(this.timeRemainingText);
    }

    /**
     * Create insights section for learning details
     */
    private createInsightsSection(): void {
        // Insights panel (initially collapsed)
        this.insightsPanel = new StackPanel('insightsPanel');
        this.insightsPanel.isVertical = true;
        this.insightsPanel.topInPixels = 5;
        this.insightsPanel.isVisible = false;
        this.contentPanel.addControl(this.insightsPanel);
        
        // Improvements panel
        this.improvementsPanel = new StackPanel('improvementsPanel');
        this.improvementsPanel.isVertical = true;
        this.improvementsPanel.topInPixels = 5;
        this.improvementsPanel.isVisible = false;
        this.contentPanel.addControl(this.improvementsPanel);
        
        // Toggle button for expanded view
        this.toggleButton = Button.CreateSimpleButton('toggleButton', this.isExpanded ? '▼ Less' : '▶ More');
        this.toggleButton.color = '#00ff88';
        this.toggleButton.background = 'rgba(0, 255, 136, 0.1)';
        this.toggleButton.heightInPixels = 25;
        this.toggleButton.fontSize = 10;
        this.toggleButton.topInPixels = 5;
        this.toggleButton.onPointerClickObservable.add(() => {
            this.toggleExpanded();
        });
        this.contentPanel.addControl(this.toggleButton);
    }

    /**
     * Create generation comparison section
     */
    private createComparisonSection(): void {
        this.comparisonPanel = new StackPanel('comparisonPanel');
        this.comparisonPanel.isVertical = true;
        this.comparisonPanel.topInPixels = 5;
        this.comparisonPanel.isVisible = false;
        this.contentPanel.addControl(this.comparisonPanel);
    }

    /**
     * Setup event handlers
     */
    private setupEventHandlers(): void {
        // Add hover effects
        this.mainContainer.onPointerEnterObservable.add(() => {
            this.mainContainer.color = '#00ffaa';
            this.mainContainer.background = 'rgba(0, 25, 45, 0.95)';
        });
        
        this.mainContainer.onPointerOutObservable.add(() => {
            this.mainContainer.color = '#00ff88';
            this.mainContainer.background = 'rgba(0, 20, 40, 0.9)';
        });
    }

    /**
     * Set the current adaptive queen to monitor
     */
    public setQueen(queen: AdaptiveQueen): void {
        // Unsubscribe from previous queen
        if (this.currentQueen) {
            // Remove previous callbacks if needed
        }
        
        this.currentQueen = queen;
        
        // Subscribe to learning progress updates
        queen.onLearningProgress((progress: LearningProgress) => {
            this.updateProgress(progress);
        });
        
        // Update generation display
        this.generationText.text = `Generation: ${queen.getGeneration()}`;
        
        console.log(`🎨 LearningProgressUI: Monitoring Queen ${queen.id} (Gen ${queen.getGeneration()})`);
    }

    /**
     * Update learning progress display
     */
    public updateProgress(progress: LearningProgress): void {
        this.lastProgress = progress;
        
        // Store generation history
        if (this.currentQueen) {
            this.generationHistory.set(this.currentQueen.getGeneration(), progress);
        }
        
        // Update phase display with enhanced visual feedback
        this.updatePhaseDisplay(progress.currentPhase);
        
        // Update progress bar with smooth animation
        this.targetProgress = progress.progress;
        
        // Update time remaining with better formatting
        this.updateTimeRemaining(progress.estimatedTimeRemaining);
        
        // Update insights and improvements with enhanced display
        this.updateInsights(progress.insights);
        this.updateImprovements(progress.improvements);
        
        // Update generation comparison with detailed metrics
        this.updateGenerationComparison();
        
        // Add visual feedback for phase transitions
        this.addPhaseTransitionEffect(progress.currentPhase);
        
        // Update container styling based on progress
        this.updateContainerStyling(progress);
    }

    /**
     * Update phase display with appropriate styling and enhanced visual feedback
     */
    private updatePhaseDisplay(phase: string): void {
        const phaseDisplayMap: { [key: string]: { text: string; color: string; icon: string } } = {
            'analyzing': { text: 'Analyzing Death Data', color: '#ffaa00', icon: '🔍' },
            'processing': { text: 'Processing Patterns', color: '#00aaff', icon: '⚙️' },
            'generating': { text: 'Generating Strategy', color: '#aa00ff', icon: '🧠' },
            'complete': { text: 'Learning Complete', color: '#00ff88', icon: '✅' },
            'training': { text: 'Neural Network Training', color: '#ff6600', icon: '🔥' },
            'adapting': { text: 'Adapting Behavior', color: '#66ff00', icon: '🔄' }
        };
        
        const phaseInfo = phaseDisplayMap[phase] || { text: phase, color: '#cccccc', icon: '❓' };
        this.phaseText.text = `${phaseInfo.icon} Phase: ${phaseInfo.text}`;
        this.phaseText.color = phaseInfo.color;
        
        // Add pulsing effect for active phases
        if (phase !== 'complete') {
            this.addPulsingEffect(this.phaseText);
        } else {
            this.removePulsingEffect(this.phaseText);
        }
    }

    /**
     * Update time remaining display with enhanced formatting
     */
    private updateTimeRemaining(timeRemaining: number): void {
        if (timeRemaining <= 0) {
            this.timeRemainingText.text = '⏱️ Time remaining: Complete';
            this.timeRemainingText.color = '#00ff88';
        } else if (timeRemaining < 60) {
            this.timeRemainingText.text = `⏱️ Time remaining: ${Math.ceil(timeRemaining)}s`;
            this.timeRemainingText.color = '#ffaa00';
        } else {
            const minutes = Math.floor(timeRemaining / 60);
            const seconds = Math.floor(timeRemaining % 60);
            this.timeRemainingText.text = `⏱️ Time remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;
            this.timeRemainingText.color = '#aaaaaa';
        }
        
        // Add urgency color coding
        if (timeRemaining > 0 && timeRemaining < 30) {
            this.timeRemainingText.color = '#ff6600'; // Orange for urgency
        } else if (timeRemaining > 0 && timeRemaining < 10) {
            this.timeRemainingText.color = '#ff3300'; // Red for high urgency
        }
    }

    /**
     * Update insights display
     */
    private updateInsights(insights: string[]): void {
        // Clear existing insights
        this.insightsPanel.clearControls();
        
        if (insights.length === 0) {
            return;
        }
        
        // Add insights header
        const insightsHeader = new TextBlock('insightsHeader', 'Learning Insights:');
        insightsHeader.color = '#00ff88';
        insightsHeader.fontSize = 11;
        insightsHeader.fontWeight = 'bold';
        insightsHeader.heightInPixels = 18;
        insightsHeader.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.insightsPanel.addControl(insightsHeader);
        
        // Add insights
        insights.slice(0, 3).forEach(insight => { // Limit to 3 insights
            const insightText = new TextBlock('insight', `• ${insight}`);
            insightText.color = '#cccccc';
            insightText.fontSize = 9;
            insightText.heightInPixels = 14;
            insightText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            insightText.textWrapping = true;
            this.insightsPanel.addControl(insightText);
        });
    }

    /**
     * Update improvements display
     */
    private updateImprovements(improvements: string[]): void {
        // Clear existing improvements
        this.improvementsPanel.clearControls();
        
        if (improvements.length === 0) {
            return;
        }
        
        // Add improvements header
        const improvementsHeader = new TextBlock('improvementsHeader', 'Improvements:');
        improvementsHeader.color = '#00ff88';
        improvementsHeader.fontSize = 11;
        improvementsHeader.fontWeight = 'bold';
        improvementsHeader.heightInPixels = 18;
        improvementsHeader.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.improvementsPanel.addControl(improvementsHeader);
        
        // Add improvements
        improvements.slice(0, 3).forEach(improvement => { // Limit to 3 improvements
            const improvementText = new TextBlock('improvement', `✓ ${improvement}`);
            improvementText.color = '#88ff88';
            improvementText.fontSize = 9;
            improvementText.heightInPixels = 14;
            improvementText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            improvementText.textWrapping = true;
            this.improvementsPanel.addControl(improvementText);
        });
    }

    /**
     * Update generation comparison with detailed metrics and improvements
     */
    private updateGenerationComparison(): void {
        if (!this.currentQueen || this.generationHistory.size < 2) {
            return;
        }
        
        const currentGen = this.currentQueen.getGeneration();
        const previousGen = currentGen - 1;
        
        const currentProgress = this.generationHistory.get(currentGen);
        const previousProgress = this.generationHistory.get(previousGen);
        
        if (!currentProgress || !previousProgress) {
            return;
        }
        
        // Clear existing comparison
        this.comparisonPanel.clearControls();
        
        // Add comparison header with generation numbers
        const comparisonHeader = new TextBlock('comparisonHeader', `📊 Gen ${previousGen} → Gen ${currentGen} Comparison:`);
        comparisonHeader.color = '#00ff88';
        comparisonHeader.fontSize = 11;
        comparisonHeader.fontWeight = 'bold';
        comparisonHeader.heightInPixels = 20;
        comparisonHeader.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.comparisonPanel.addControl(comparisonHeader);
        
        // Add detailed comparison metrics
        const improvements = this.calculateGenerationImprovements(previousProgress, currentProgress);
        
        improvements.forEach(improvement => {
            const improvementText = new TextBlock('improvement', `${improvement.icon} ${improvement.text}`);
            improvementText.color = improvement.positive ? '#88ff88' : '#ffaa88';
            improvementText.fontSize = 9;
            improvementText.heightInPixels = 16;
            improvementText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            improvementText.textWrapping = true;
            this.comparisonPanel.addControl(improvementText);
        });
        
        // Add overall improvement score
        const overallScore = this.calculateOverallImprovement(improvements);
        const scoreText = new TextBlock('overallScore', `🎯 Overall Improvement: ${overallScore}%`);
        scoreText.color = overallScore > 0 ? '#00ff88' : '#ffaa00';
        scoreText.fontSize = 10;
        scoreText.fontWeight = 'bold';
        scoreText.heightInPixels = 18;
        scoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        scoreText.topInPixels = 5;
        this.comparisonPanel.addControl(scoreText);
    }

    /**
     * Toggle expanded view
     */
    private toggleExpanded(): void {
        this.isExpanded = !this.isExpanded;
        
        // Update button text
        this.toggleButton.textBlock!.text = this.isExpanded ? '▼ Less' : '▶ More';
        
        // Show/hide expanded sections
        this.insightsPanel.isVisible = this.isExpanded;
        this.improvementsPanel.isVisible = this.isExpanded;
        this.comparisonPanel.isVisible = this.isExpanded && this.generationHistory.size >= 2;
        
        // Adjust container height
        if (this.isExpanded) {
            this.mainContainer.heightInPixels = 350;
        } else {
            this.mainContainer.heightInPixels = 200;
        }
    }

    /**
     * Update progress bar animation
     */
    public update(deltaTime: number): void {
        // Animate progress bar
        if (Math.abs(this.currentProgressDisplay - this.targetProgress) > 0.01) {
            const diff = this.targetProgress - this.currentProgressDisplay;
            this.currentProgressDisplay += diff * this.progressAnimationSpeed;
            
            // Update progress bar width
            const progressWidth = this.currentProgressDisplay * (this.progressBar.widthInPixels - 4);
            this.progressFill.widthInPixels = Math.max(0, progressWidth);
            
            // Update progress text
            this.progressText.text = `${Math.round(this.currentProgressDisplay * 100)}%`;
        }
    }

    /**
     * Show the UI
     */
    public show(): void {
        this.isVisible = true;
        this.mainContainer.isVisible = true;
    }

    /**
     * Hide the UI
     */
    public hide(): void {
        this.isVisible = false;
        this.mainContainer.isVisible = false;
    }

    /**
     * Toggle visibility
     */
    public toggleVisibility(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Get current visibility state
     */
    public isUIVisible(): boolean {
        return this.isVisible;
    }

    /**
     * Get learning progress history
     */
    public getGenerationHistory(): Map<number, LearningProgress> {
        return new Map(this.generationHistory);
    }

    /**
     * Clear generation history
     */
    public clearHistory(): void {
        this.generationHistory.clear();
        this.updateGenerationComparison();
    }

    /**
     * Dispose UI and cleanup resources
     */
    public dispose(): void {
        // Remove from parent texture
        if (this.parentTexture && this.mainContainer) {
            this.parentTexture.removeControl(this.mainContainer);
        }
        
        // Clear generation history
        this.generationHistory.clear();
        
        // Clear references
        this.currentQueen = undefined;
        this.lastProgress = undefined;
        
        console.log('🎨 LearningProgressUI disposed');
    }

    // Enhanced visual feedback methods

    /**
     * Add phase transition effect
     */
    private addPhaseTransitionEffect(phase: string): void {
        // Add subtle glow effect for phase transitions
        if (this.lastProgress && this.lastProgress.currentPhase !== phase) {
            this.mainContainer.color = '#00ffff';
            
            // Reset color after brief highlight
            setTimeout(() => {
                this.mainContainer.color = '#00ff88';
            }, 500);
        }
    }

    /**
     * Update container styling based on progress
     */
    private updateContainerStyling(progress: LearningProgress): void {
        // Adjust container opacity based on progress
        const opacity = 0.85 + (progress.progress * 0.15); // 0.85 to 1.0
        this.mainContainer.background = `rgba(0, 20, 40, ${opacity})`;
        
        // Add completion glow effect
        if (progress.currentPhase === 'complete') {
            this.mainContainer.color = '#00ff88';
            this.mainContainer.thickness = 3;
        } else {
            this.mainContainer.thickness = 2;
        }
    }

    /**
     * Add pulsing effect to text element
     */
    private addPulsingEffect(textElement: TextBlock): void {
        // Simple pulsing effect by alternating alpha
        const originalAlpha = textElement.alpha;
        let pulseDirection = -1;
        
        const pulseInterval = setInterval(() => {
            textElement.alpha += pulseDirection * 0.1;
            
            if (textElement.alpha <= 0.6) {
                pulseDirection = 1;
            } else if (textElement.alpha >= 1.0) {
                pulseDirection = -1;
            }
        }, 100);
        
        // Store interval for cleanup
        (textElement as any)._pulseInterval = pulseInterval;
    }

    /**
     * Remove pulsing effect from text element
     */
    private removePulsingEffect(textElement: TextBlock): void {
        if ((textElement as any)._pulseInterval) {
            clearInterval((textElement as any)._pulseInterval);
            (textElement as any)._pulseInterval = null;
            textElement.alpha = 1.0;
        }
    }

    /**
     * Calculate generation improvements for comparison
     */
    private calculateGenerationImprovements(previousProgress: LearningProgress, currentProgress: LearningProgress): Array<{
        text: string;
        icon: string;
        positive: boolean;
        value: number;
    }> {
        const improvements = [];
        
        // Compare insights count
        const insightsDiff = currentProgress.insights.length - previousProgress.insights.length;
        if (insightsDiff !== 0) {
            improvements.push({
                text: `${Math.abs(insightsDiff)} ${insightsDiff > 0 ? 'more' : 'fewer'} insights gained`,
                icon: insightsDiff > 0 ? '📈' : '📉',
                positive: insightsDiff > 0,
                value: insightsDiff
            });
        }
        
        // Compare improvements count
        const improvementsDiff = currentProgress.improvements.length - previousProgress.improvements.length;
        if (improvementsDiff !== 0) {
            improvements.push({
                text: `${Math.abs(improvementsDiff)} ${improvementsDiff > 0 ? 'more' : 'fewer'} improvements identified`,
                icon: improvementsDiff > 0 ? '⬆️' : '⬇️',
                positive: improvementsDiff > 0,
                value: improvementsDiff
            });
        }
        
        // Add strategic advancement indicators
        improvements.push({
            text: 'Enhanced pattern recognition',
            icon: '🎯',
            positive: true,
            value: 1
        });
        
        improvements.push({
            text: 'Improved tactical adaptation',
            icon: '⚡',
            positive: true,
            value: 1
        });
        
        return improvements;
    }

    /**
     * Calculate overall improvement percentage
     */
    private calculateOverallImprovement(improvements: Array<{positive: boolean; value: number}>): number {
        const positiveCount = improvements.filter(i => i.positive).length;
        const totalCount = improvements.length;
        
        if (totalCount === 0) return 0;
        
        return Math.round((positiveCount / totalCount) * 100);
    }

    /**
     * Get detailed learning statistics
     */
    public getLearningStatistics(): {
        currentGeneration: number;
        totalGenerations: number;
        currentPhase: string;
        progress: number;
        timeRemaining: number;
        totalInsights: number;
        totalImprovements: number;
        averageProgressTime: number;
    } {
        const stats = {
            currentGeneration: this.currentQueen?.getGeneration() || 0,
            totalGenerations: this.generationHistory.size,
            currentPhase: this.lastProgress?.currentPhase || 'unknown',
            progress: this.lastProgress?.progress || 0,
            timeRemaining: this.lastProgress?.estimatedTimeRemaining || 0,
            totalInsights: this.lastProgress?.insights.length || 0,
            totalImprovements: this.lastProgress?.improvements.length || 0,
            averageProgressTime: 0
        };
        
        // Calculate average progress time from history
        if (this.generationHistory.size > 0) {
            const progressTimes = Array.from(this.generationHistory.values())
                .map(p => p.estimatedTimeRemaining)
                .filter(t => t > 0);
            
            if (progressTimes.length > 0) {
                stats.averageProgressTime = progressTimes.reduce((sum, time) => sum + time, 0) / progressTimes.length;
            }
        }
        
        return stats;
    }

    /**
     * Export learning data for analysis
     */
    public exportLearningData(): {
        generationHistory: any[];
        currentProgress: LearningProgress | undefined;
        statistics: any;
    } {
        return {
            generationHistory: Array.from(this.generationHistory.entries()).map(([gen, progress]) => ({
                generation: gen,
                progress: progress
            })),
            currentProgress: this.lastProgress,
            statistics: this.getLearningStatistics()
        };
    }
}