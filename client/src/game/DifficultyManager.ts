/**
 * Difficulty Manager - Client-side integration with Adaptive Difficulty System
 */

export interface DifficultyModifiers {
    strategy_complexity: number;
    reaction_speed: number;
    resource_efficiency: number;
    adaptation_rate: number;
    predictive_ability: number;
    coordination_level: number;
    learning_rate: number;
}

export interface PlayerPerformanceData {
    player_won: boolean;
    survival_time: number;
    queens_killed: number;
    resources_gathered: number;
    units_created: number;
    combat_encounters: number;
    strategic_decisions: string[];
    adaptation_indicators: Record<string, any>;
    game_duration: number;
    difficulty_level: number;
}

export interface DifficultyStatus {
    current_difficulty: number;
    target_success_rate: number;
    actual_success_rate: number;
    player_skill_level: number;
    learning_progress: {
        current_phase: string;
        learning_rate: number;
        is_plateaued: boolean;
        plateau_duration: number;
        phase_history: any[];
        total_progress: number;
    };
    recent_adjustments: any[];
    performance_trends: {
        survival_time_trend: number;
        success_rate_trend: number;
        consistency_trend: number;
    };
    engagement_status: {
        level: number;
        status: string;
    };
}

export class DifficultyManager {
    private currentDifficulty: number = 0.5;
    private difficultyModifiers: DifficultyModifiers = {
        strategy_complexity: 0.5,
        reaction_speed: 0.75,
        resource_efficiency: 0.65,
        adaptation_rate: 0.6,
        predictive_ability: 0.2,
        coordination_level: 0.7,
        learning_rate: 0.55
    };
    private difficultyStatus: DifficultyStatus | null = null;
    private websocketClient: any; // WebSocketClient reference
    
    constructor(websocketClient: any) {
        this.websocketClient = websocketClient;
        this.setupMessageHandlers();
    }
    
    private setupMessageHandlers(): void {
        // Listen for difficulty adjustment messages
        this.websocketClient.on('difficulty_adjustment', (data: any) => {
            this.handleDifficultyAdjustment(data);
        });
        
        // Listen for difficulty status updates
        this.websocketClient.on('difficulty_status', (data: any) => {
            this.handleDifficultyStatus(data);
        });
    }
    
    private handleDifficultyAdjustment(data: any): void {
        console.log('Difficulty adjustment received:', data);
        
        if (data.difficultyResult) {
            this.currentDifficulty = data.difficultyResult.current_difficulty;
            
            if (data.difficultyResult.adjustment_made) {
                console.log(`Difficulty adjusted to ${this.currentDifficulty.toFixed(3)} - ${data.difficultyResult.adjustment_reason}`);
                
                // Show UI notification about difficulty change
                this.showDifficultyChangeNotification(
                    data.difficultyResult.adjustment_reason,
                    this.currentDifficulty
                );
            }
        }
        
        if (data.difficultyModifiers) {
            this.difficultyModifiers = data.difficultyModifiers;
        }
        
        if (data.difficultyInsights) {
            this.difficultyStatus = data.difficultyInsights;
        }
    }
    
    private handleDifficultyStatus(data: any): void {
        console.log('Difficulty status received:', data);
        
        if (data.currentDifficulty !== undefined) {
            this.currentDifficulty = data.currentDifficulty;
        }
        
        if (data.difficultyModifiers) {
            this.difficultyModifiers = data.difficultyModifiers;
        }
        
        if (data.difficultyInsights) {
            this.difficultyStatus = data.difficultyInsights;
        }
    }
    
    private showDifficultyChangeNotification(reason: string, newDifficulty: number): void {
        // Create a user-friendly message based on the adjustment reason
        let message = '';
        let color = '#ffffff';
        
        switch (reason) {
            case 'success_rate_too_high':
                message = `Challenge increased! The AI is adapting to your skills.`;
                color = '#ff6b6b';
                break;
            case 'success_rate_too_low':
                message = `Challenge reduced. The AI is giving you more breathing room.`;
                color = '#51cf66';
                break;
            case 'player_frustrated':
                message = `AI difficulty lowered to reduce frustration.`;
                color = '#51cf66';
                break;
            case 'player_bored':
                message = `AI ramping up the challenge to keep things interesting!`;
                color = '#ff6b6b';
                break;
            case 'skill_improving':
                message = `Your skills are improving! AI difficulty increased.`;
                color = '#ffd43b';
                break;
            case 'learning_progress':
                message = `AI adapting to your learning progress.`;
                color = '#74c0fc';
                break;
            default:
                message = `AI difficulty adjusted to ${(newDifficulty * 100).toFixed(0)}%`;
                color = '#ffffff';
        }
        
        // Show notification in game UI (implementation depends on UI framework)
        this.displayNotification(message, color);
    }
    
    private displayNotification(message: string, color: string): void {
        // This would integrate with your game's notification system
        console.log(`[DIFFICULTY] ${message}`);
        
        // Example implementation for a simple notification
        // You would replace this with your actual UI notification system
        if (typeof window !== 'undefined' && document) {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: ${color};
                padding: 12px 20px;
                border-radius: 8px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                z-index: 10000;
                max-width: 300px;
                border-left: 4px solid ${color};
                animation: slideIn 0.3s ease-out;
            `;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            // Remove notification after 4 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 4000);
        }
    }
    
    /**
     * Send game outcome data to the server for difficulty adjustment
     */
    public async reportGameOutcome(outcomeData: PlayerPerformanceData): Promise<void> {
        try {
            console.log('Reporting game outcome for difficulty adjustment:', outcomeData);
            
            await this.websocketClient.send({
                type: 'game_outcome',
                timestamp: Date.now() / 1000,
                data: outcomeData
            });
            
        } catch (error) {
            console.error('Failed to report game outcome:', error);
        }
    }
    
    /**
     * Request current difficulty status from server
     */
    public async requestDifficultyStatus(): Promise<void> {
        try {
            await this.websocketClient.send({
                type: 'difficulty_status_request',
                timestamp: Date.now() / 1000
            });
            
        } catch (error) {
            console.error('Failed to request difficulty status:', error);
        }
    }
    
    /**
     * Get current difficulty level (0.0 to 1.0)
     */
    public getCurrentDifficulty(): number {
        return this.currentDifficulty;
    }
    
    /**
     * Get current difficulty modifiers for Queen strategy
     */
    public getDifficultyModifiers(): DifficultyModifiers {
        return { ...this.difficultyModifiers };
    }
    
    /**
     * Get detailed difficulty status
     */
    public getDifficultyStatus(): DifficultyStatus | null {
        return this.difficultyStatus;
    }
    
    /**
     * Get difficulty level as percentage string for UI display
     */
    public getDifficultyPercentage(): string {
        return `${(this.currentDifficulty * 100).toFixed(0)}%`;
    }
    
    /**
     * Get difficulty level description for UI
     */
    public getDifficultyDescription(): string {
        const difficulty = this.currentDifficulty;
        
        if (difficulty < 0.2) return 'Very Easy';
        if (difficulty < 0.4) return 'Easy';
        if (difficulty < 0.6) return 'Normal';
        if (difficulty < 0.8) return 'Hard';
        return 'Very Hard';
    }
    
    /**
     * Get player skill level description
     */
    public getSkillLevelDescription(): string {
        if (!this.difficultyStatus) return 'Unknown';
        
        const skillLevel = this.difficultyStatus.player_skill_level;
        
        if (skillLevel < 0.2) return 'Beginner';
        if (skillLevel < 0.4) return 'Novice';
        if (skillLevel < 0.6) return 'Intermediate';
        if (skillLevel < 0.8) return 'Advanced';
        return 'Expert';
    }
    
    /**
     * Get engagement status description
     */
    public getEngagementDescription(): string {
        if (!this.difficultyStatus) return 'Unknown';
        
        const engagement = this.difficultyStatus.engagement_status.level;
        
        if (engagement < 0.3) return 'Low Engagement';
        if (engagement < 0.6) return 'Moderate Engagement';
        if (engagement < 0.8) return 'High Engagement';
        return 'Optimal Engagement';
    }
    
    /**
     * Check if player is in optimal challenge zone
     */
    public isInOptimalChallenge(): boolean {
        if (!this.difficultyStatus) return false;
        
        const successRate = this.difficultyStatus.actual_success_rate;
        const engagement = this.difficultyStatus.engagement_status.level;
        
        // Optimal challenge: 30-60% success rate with high engagement
        return successRate >= 0.3 && successRate <= 0.6 && engagement >= 0.7;
    }
    
    /**
     * Get performance trend indicators
     */
    public getPerformanceTrends(): { improving: boolean; stable: boolean; declining: boolean } {
        if (!this.difficultyStatus) {
            return { improving: false, stable: true, declining: false };
        }
        
        const trends = this.difficultyStatus.performance_trends;
        const survivalTrend = trends.survival_time_trend;
        const successTrend = trends.success_rate_trend;
        
        const overallTrend = (survivalTrend + successTrend) / 2;
        
        return {
            improving: overallTrend > 0.05,
            stable: Math.abs(overallTrend) <= 0.05,
            declining: overallTrend < -0.05
        };
    }
    
    /**
     * Create performance data from game session
     */
    public createPerformanceData(gameSession: {
        playerWon: boolean;
        survivalTime: number;
        queensKilled: number;
        resourcesGathered: number;
        unitsCreated: number;
        combatEncounters: number;
        strategicDecisions: string[];
        gameDuration: number;
    }): PlayerPerformanceData {
        return {
            player_won: gameSession.playerWon,
            survival_time: gameSession.survivalTime,
            queens_killed: gameSession.queensKilled,
            resources_gathered: gameSession.resourcesGathered,
            units_created: gameSession.unitsCreated,
            combat_encounters: gameSession.combatEncounters,
            strategic_decisions: gameSession.strategicDecisions,
            adaptation_indicators: this.detectAdaptationIndicators(gameSession),
            game_duration: gameSession.gameDuration,
            difficulty_level: this.currentDifficulty
        };
    }
    
    private detectAdaptationIndicators(gameSession: any): Record<string, any> {
        const indicators: Record<string, any> = {};
        
        // Detect if player learned patterns
        if (gameSession.strategicDecisions.length > 2) {
            indicators.learned_pattern = true;
        }
        
        // Detect efficiency improvements
        if (gameSession.resourcesGathered / gameSession.gameDuration > 2.0) {
            indicators.improved_efficiency = true;
        }
        
        // Detect tactical adaptation
        if (gameSession.combatEncounters > 2 && gameSession.queensKilled > 0) {
            indicators.tactical_adaptation = true;
        }
        
        return indicators;
    }
}