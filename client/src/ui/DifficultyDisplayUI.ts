/**
 * Difficulty Display UI - Shows current difficulty and player progress information
 */

import { DifficultyManager, DifficultyStatus } from '../game/DifficultyManager';

export class DifficultyDisplayUI {
    private difficultyManager: DifficultyManager;
    private container: HTMLElement | null = null;
    private updateInterval: number | null = null;
    
    constructor(difficultyManager: DifficultyManager) {
        this.difficultyManager = difficultyManager;
        this.createUI();
        this.startUpdateLoop();
    }
    
    private createUI(): void {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'difficulty-display';
        this.container.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            min-width: 250px;
            z-index: 1000;
            border: 1px solid #333;
            backdrop-filter: blur(5px);
        `;
        
        // Add to document
        if (document.body) {
            document.body.appendChild(this.container);
        }
        
        // Initial update
        this.updateDisplay();
    }
    
    private updateDisplay(): void {
        if (!this.container) return;
        
        const difficulty = this.difficultyManager.getCurrentDifficulty();
        const difficultyDesc = this.difficultyManager.getDifficultyDescription();
        const difficultyPercent = this.difficultyManager.getDifficultyPercentage();
        const skillDesc = this.difficultyManager.getSkillLevelDescription();
        const engagementDesc = this.difficultyManager.getEngagementDescription();
        const isOptimal = this.difficultyManager.isInOptimalChallenge();
        const trends = this.difficultyManager.getPerformanceTrends();
        const status = this.difficultyManager.getDifficultyStatus();
        
        // Create difficulty bar
        const difficultyBar = this.createDifficultyBar(difficulty);
        
        // Create performance trend indicator
        const trendIndicator = this.createTrendIndicator(trends);
        
        // Create engagement indicator
        const engagementIndicator = this.createEngagementIndicator(isOptimal);
        
        this.container.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; color: #74c0fc;">
                🎯 AI Difficulty System
            </div>
            
            <div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Difficulty:</span>
                    <span style="color: ${this.getDifficultyColor(difficulty)}; font-weight: bold;">
                        ${difficultyDesc} (${difficultyPercent})
                    </span>
                </div>
                ${difficultyBar}
            </div>
            
            <div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Skill Level:</span>
                    <span style="color: #51cf66;">${skillDesc}</span>
                </div>
            </div>
            
            <div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Engagement:</span>
                    <span style="color: ${isOptimal ? '#51cf66' : '#ffd43b'};">${engagementDesc}</span>
                </div>
                ${engagementIndicator}
            </div>
            
            <div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Performance:</span>
                    <span>${trendIndicator}</span>
                </div>
            </div>
            
            ${this.createStatusDetails(status)}
            
            <div style="margin-top: 10px; font-size: 10px; color: #888; text-align: center;">
                AI adapts to your playstyle in real-time
            </div>
        `;
    }
    
    private createDifficultyBar(difficulty: number): string {
        const percentage = Math.round(difficulty * 100);
        const color = this.getDifficultyColor(difficulty);
        
        return `
            <div style="background: #333; height: 6px; border-radius: 3px; overflow: hidden; margin-top: 4px;">
                <div style="
                    background: ${color};
                    height: 100%;
                    width: ${percentage}%;
                    transition: width 0.5s ease;
                "></div>
            </div>
        `;
    }
    
    private createTrendIndicator(trends: { improving: boolean; stable: boolean; declining: boolean }): string {
        if (trends.improving) {
            return '<span style="color: #51cf66;">📈 Improving</span>';
        } else if (trends.declining) {
            return '<span style="color: #ff6b6b;">📉 Declining</span>';
        } else {
            return '<span style="color: #ffd43b;">📊 Stable</span>';
        }
    }
    
    private createEngagementIndicator(isOptimal: boolean): string {
        const color = isOptimal ? '#51cf66' : '#ffd43b';
        const icon = isOptimal ? '🎯' : '⚡';
        const text = isOptimal ? 'Optimal Challenge' : 'Adjusting...';
        
        return `
            <div style="margin-top: 4px; font-size: 10px; color: ${color};">
                ${icon} ${text}
            </div>
        `;
    }
    
    private createStatusDetails(status: DifficultyStatus | null): string {
        if (!status) {
            return '<div style="margin-top: 8px; font-size: 10px; color: #888;">Loading status...</div>';
        }
        
        const successRate = Math.round(status.actual_success_rate * 100);
        const targetRate = Math.round(status.target_success_rate * 100);
        const learningPhase = status.learning_progress.current_phase;
        
        return `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #333;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px;">
                    <span>Success Rate:</span>
                    <span style="color: ${successRate >= targetRate ? '#51cf66' : '#ff6b6b'};">
                        ${successRate}% (target: ${targetRate}%)
                    </span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 10px;">
                    <span>Learning Phase:</span>
                    <span style="color: #74c0fc;">${this.formatLearningPhase(learningPhase)}</span>
                </div>
            </div>
        `;
    }
    
    private getDifficultyColor(difficulty: number): string {
        if (difficulty < 0.2) return '#51cf66'; // Green - Very Easy
        if (difficulty < 0.4) return '#69db7c'; // Light Green - Easy
        if (difficulty < 0.6) return '#ffd43b'; // Yellow - Normal
        if (difficulty < 0.8) return '#ff8787'; // Light Red - Hard
        return '#ff6b6b'; // Red - Very Hard
    }
    
    private formatLearningPhase(phase: string): string {
        switch (phase) {
            case 'initial': return 'Initial';
            case 'rapid_learning': return 'Rapid Learning';
            case 'steady_learning': return 'Steady Learning';
            case 'plateau': return 'Plateau';
            case 'declining': return 'Declining';
            default: return phase.charAt(0).toUpperCase() + phase.slice(1);
        }
    }
    
    private startUpdateLoop(): void {
        // Update display every 2 seconds
        this.updateInterval = window.setInterval(() => {
            this.updateDisplay();
        }, 2000);
    }
    
    public show(): void {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }
    
    public hide(): void {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
    
    public toggle(): void {
        if (this.container) {
            const isVisible = this.container.style.display !== 'none';
            this.container.style.display = isVisible ? 'none' : 'block';
        }
    }
    
    public destroy(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
            this.container = null;
        }
    }
    
    /**
     * Create a compact version for in-game overlay
     */
    public createCompactDisplay(): HTMLElement {
        const compact = document.createElement('div');
        compact.style.cssText = `
            background: rgba(0, 0, 0, 0.6);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            display: inline-block;
            backdrop-filter: blur(3px);
        `;
        
        const updateCompact = () => {
            const difficulty = this.difficultyManager.getCurrentDifficulty();
            const difficultyDesc = this.difficultyManager.getDifficultyDescription();
            const isOptimal = this.difficultyManager.isInOptimalChallenge();
            
            compact.innerHTML = `
                🎯 AI: ${difficultyDesc} ${isOptimal ? '🎯' : '⚡'}
            `;
            compact.style.borderLeft = `3px solid ${this.getDifficultyColor(difficulty)}`;
        };
        
        updateCompact();
        
        // Update compact display every 5 seconds
        setInterval(updateCompact, 5000);
        
        return compact;
    }
    
    /**
     * Show difficulty adjustment animation
     */
    public showAdjustmentAnimation(direction: 'up' | 'down', reason: string): void {
        if (!this.container) return;
        
        const animation = document.createElement('div');
        animation.style.cssText = `
            position: absolute;
            top: 50%;
            right: -40px;
            transform: translateY(-50%);
            color: ${direction === 'up' ? '#ff6b6b' : '#51cf66'};
            font-size: 20px;
            font-weight: bold;
            animation: difficultyPulse 2s ease-out;
            pointer-events: none;
        `;
        
        animation.textContent = direction === 'up' ? '↗️' : '↘️';
        animation.title = reason;
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes difficultyPulse {
                0% { opacity: 0; transform: translateY(-50%) scale(0.5); }
                50% { opacity: 1; transform: translateY(-50%) scale(1.2); }
                100% { opacity: 0; transform: translateY(-50%) scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        this.container.appendChild(animation);
        
        // Remove animation after completion
        setTimeout(() => {
            if (animation.parentNode) {
                animation.parentNode.removeChild(animation);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 2000);
    }
}