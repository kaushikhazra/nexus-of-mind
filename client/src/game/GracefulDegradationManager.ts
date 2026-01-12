/**
 * Graceful Degradation Manager for Adaptive Queen Intelligence
 * Handles fallback behavior when AI backend is unavailable
 */

export interface DegradationConfig {
    enableLocalFallback: boolean;
    enableRuleBasedAI: boolean;
    enableOfflineMode: boolean;
    cacheStrategies: boolean;
    maxCacheSize: number;
    degradationThreshold: number;
}

export interface FallbackStrategy {
    generation: number;
    hivePlacement: string;
    parasiteSpawning: string;
    defensiveCoordination: string;
    complexity: string;
    source: 'cached' | 'rule_based' | 'default';
}

export interface SystemStatus {
    backendAvailable: boolean;
    degradationLevel: number;
    activeFeatures: string[];
    disabledFeatures: string[];
    fallbackMode: string;
    lastBackendContact: number;
}

export class GracefulDegradationManager {
    private config: DegradationConfig;
    private systemStatus: SystemStatus;
    private strategyCache: Map<string, FallbackStrategy> = new Map();
    private ruleBasedStrategies: Map<string, any> = new Map();
    private degradationLevel: number = 0;
    private backendUnavailableTime: number = 0;
    private lastSuccessfulContact: number = Date.now();

    constructor(config: Partial<DegradationConfig> = {}) {
        this.config = {
            enableLocalFallback: true,
            enableRuleBasedAI: true,
            enableOfflineMode: true,
            cacheStrategies: true,
            maxCacheSize: 50,
            degradationThreshold: 30000, // 30 seconds
            ...config
        };

        this.systemStatus = {
            backendAvailable: true,
            degradationLevel: 0,
            activeFeatures: ['neural_network', 'real_time_learning', 'adaptive_difficulty'],
            disabledFeatures: [],
            fallbackMode: 'none',
            lastBackendContact: Date.now()
        };

        this.initializeRuleBasedStrategies();
        this.loadCachedStrategies();
    }

    private initializeRuleBasedStrategies(): void {
        // Basic rule-based strategies for different scenarios
        this.ruleBasedStrategies.set('protector_assault', {
            hivePlacement: 'hidden_defensive',
            parasiteSpawning: 'aggressive_early',
            defensiveCoordination: 'swarm_defense',
            reasoning: 'Counter direct assault with hidden placement and aggressive spawning'
        });

        this.ruleBasedStrategies.set('worker_infiltration', {
            hivePlacement: 'perimeter_focused',
            parasiteSpawning: 'detection_focused',
            defensiveCoordination: 'perimeter_patrol',
            reasoning: 'Counter infiltration with perimeter defense and detection'
        });

        this.ruleBasedStrategies.set('coordinated_attack', {
            hivePlacement: 'mobile_adaptive',
            parasiteSpawning: 'distributed_spawning',
            defensiveCoordination: 'flexible_response',
            reasoning: 'Counter coordination with mobility and distributed defense'
        });

        this.ruleBasedStrategies.set('energy_depletion', {
            hivePlacement: 'resource_focused',
            parasiteSpawning: 'conservative_spawning',
            defensiveCoordination: 'efficiency_focused',
            reasoning: 'Counter energy issues with resource efficiency'
        });

        this.ruleBasedStrategies.set('default', {
            hivePlacement: 'balanced_placement',
            parasiteSpawning: 'standard_spawning',
            defensiveCoordination: 'standard_defense',
            reasoning: 'Balanced approach for unknown scenarios'
        });
    }

    private loadCachedStrategies(): void {
        try {
            const cached = localStorage.getItem('queen_strategy_cache');
            if (cached) {
                const strategies = JSON.parse(cached);
                for (const [key, strategy] of Object.entries(strategies)) {
                    this.strategyCache.set(key, strategy as FallbackStrategy);
                }
                console.log(`Loaded ${this.strategyCache.size} cached strategies`);
            }
        } catch (error) {
            console.error('Failed to load cached strategies:', error);
        }
    }

    private saveCachedStrategies(): void {
        try {
            const strategies = Object.fromEntries(this.strategyCache);
            localStorage.setItem('queen_strategy_cache', JSON.stringify(strategies));
        } catch (error) {
            console.error('Failed to save cached strategies:', error);
        }
    }

    public notifyBackendUnavailable(): void {
        if (this.systemStatus.backendAvailable) {
            console.warn('Backend became unavailable, initiating graceful degradation');
            this.backendUnavailableTime = Date.now();
            this.systemStatus.backendAvailable = false;
            this.systemStatus.lastBackendContact = this.lastSuccessfulContact;
            
            this.initiateDegradation();
        }
    }

    public notifyBackendAvailable(): void {
        if (!this.systemStatus.backendAvailable) {
            console.log('Backend became available, restoring full functionality');
            this.systemStatus.backendAvailable = true;
            this.lastSuccessfulContact = Date.now();
            this.backendUnavailableTime = 0;
            
            this.restoreFullFunctionality();
        }
    }

    private initiateDegradation(): void {
        const unavailableTime = Date.now() - this.backendUnavailableTime;
        
        if (unavailableTime > this.config.degradationThreshold) {
            this.escalateDegradation();
        } else {
            this.beginGracefulDegradation();
        }
    }

    private beginGracefulDegradation(): void {
        this.degradationLevel = 1;
        this.systemStatus.degradationLevel = 1;
        this.systemStatus.fallbackMode = 'graceful';
        
        // Disable real-time learning but keep cached strategies
        this.systemStatus.disabledFeatures = ['real_time_learning'];
        this.systemStatus.activeFeatures = ['cached_strategies', 'rule_based_ai', 'offline_mode'];
        
        console.log('Initiated graceful degradation - using cached strategies and rule-based AI');
    }

    private escalateDegradation(): void {
        this.degradationLevel = Math.min(this.degradationLevel + 1, 3);
        this.systemStatus.degradationLevel = this.degradationLevel;
        
        switch (this.degradationLevel) {
            case 2:
                this.systemStatus.fallbackMode = 'rule_based';
                this.systemStatus.disabledFeatures = ['neural_network', 'real_time_learning', 'adaptive_difficulty'];
                this.systemStatus.activeFeatures = ['rule_based_ai', 'cached_strategies', 'offline_mode'];
                console.log('Escalated to rule-based AI mode');
                break;
                
            case 3:
                this.systemStatus.fallbackMode = 'minimal';
                this.systemStatus.disabledFeatures = ['neural_network', 'real_time_learning', 'adaptive_difficulty', 'strategy_adaptation'];
                this.systemStatus.activeFeatures = ['basic_ai', 'offline_mode'];
                console.log('Escalated to minimal AI mode');
                break;
        }
    }

    private restoreFullFunctionality(): void {
        this.degradationLevel = 0;
        this.systemStatus.degradationLevel = 0;
        this.systemStatus.fallbackMode = 'none';
        this.systemStatus.disabledFeatures = [];
        this.systemStatus.activeFeatures = ['neural_network', 'real_time_learning', 'adaptive_difficulty'];
        
        console.log('Restored full AI functionality');
    }

    public async generateFallbackStrategy(context: {
        generation: number;
        deathCause?: string;
        survivalTime?: number;
        previousStrategies?: string[];
    }): Promise<FallbackStrategy> {
        
        // Try cached strategy first
        if (this.config.cacheStrategies) {
            const cachedStrategy = this.getCachedStrategy(context);
            if (cachedStrategy) {
                console.log('Using cached fallback strategy');
                return cachedStrategy;
            }
        }
        
        // Use rule-based strategy
        if (this.config.enableRuleBasedAI) {
            const ruleBasedStrategy = this.generateRuleBasedStrategy(context);
            if (ruleBasedStrategy) {
                console.log('Generated rule-based fallback strategy');
                return ruleBasedStrategy;
            }
        }
        
        // Use default strategy as last resort
        console.log('Using default fallback strategy');
        return this.generateDefaultStrategy(context);
    }

    private getCachedStrategy(context: any): FallbackStrategy | null {
        // Look for cached strategy based on generation and death cause
        const cacheKey = `gen_${context.generation}_${context.deathCause || 'unknown'}`;
        const cached = this.strategyCache.get(cacheKey);
        
        if (cached) {
            return {
                ...cached,
                source: 'cached'
            };
        }
        
        // Look for similar generation strategy
        const similarKey = Array.from(this.strategyCache.keys()).find(key => 
            key.startsWith(`gen_${context.generation}_`)
        );
        
        if (similarKey) {
            const similar = this.strategyCache.get(similarKey);
            if (similar) {
                return {
                    ...similar,
                    source: 'cached'
                };
            }
        }
        
        return null;
    }

    private generateRuleBasedStrategy(context: any): FallbackStrategy | null {
        const deathCause = context.deathCause || 'default';
        const baseStrategy = this.ruleBasedStrategies.get(deathCause) || this.ruleBasedStrategies.get('default');
        
        if (!baseStrategy) {
            return null;
        }
        
        // Adjust strategy based on generation
        const adjustedStrategy = this.adjustStrategyForGeneration(baseStrategy, context.generation);
        
        // Adjust based on survival time
        const finalStrategy = this.adjustStrategyForSurvival(adjustedStrategy, context.survivalTime || 0);
        
        return {
            generation: context.generation,
            hivePlacement: finalStrategy.hivePlacement,
            parasiteSpawning: finalStrategy.parasiteSpawning,
            defensiveCoordination: finalStrategy.defensiveCoordination,
            complexity: this.getComplexityForGeneration(context.generation),
            source: 'rule_based'
        };
    }

    private adjustStrategyForGeneration(baseStrategy: any, generation: number): any {
        const adjusted = { ...baseStrategy };
        
        if (generation <= 3) {
            // Early generations - simple strategies
            adjusted.complexity = 'basic';
        } else if (generation <= 7) {
            // Mid generations - tactical strategies
            adjusted.complexity = 'tactical';
            adjusted.hivePlacement = this.enhanceStrategy(adjusted.hivePlacement, 'tactical');
            adjusted.parasiteSpawning = this.enhanceStrategy(adjusted.parasiteSpawning, 'tactical');
        } else {
            // Advanced generations - strategic approaches
            adjusted.complexity = 'strategic';
            adjusted.hivePlacement = this.enhanceStrategy(adjusted.hivePlacement, 'strategic');
            adjusted.parasiteSpawning = this.enhanceStrategy(adjusted.parasiteSpawning, 'strategic');
            adjusted.defensiveCoordination = this.enhanceStrategy(adjusted.defensiveCoordination, 'strategic');
        }
        
        return adjusted;
    }

    private enhanceStrategy(baseStrategy: string, level: string): string {
        const enhancements = {
            tactical: {
                'hidden_defensive': 'adaptive_hidden',
                'aggressive_early': 'timed_aggressive',
                'swarm_defense': 'coordinated_swarm',
                'standard_spawning': 'tactical_spawning'
            },
            strategic: {
                'adaptive_hidden': 'predictive_hidden',
                'timed_aggressive': 'strategic_aggressive',
                'coordinated_swarm': 'intelligent_swarm',
                'tactical_spawning': 'strategic_spawning'
            }
        };
        
        return enhancements[level]?.[baseStrategy] || baseStrategy;
    }

    private adjustStrategyForSurvival(strategy: any, survivalTime: number): any {
        const adjusted = { ...strategy };
        
        if (survivalTime < 60) {
            // Died quickly - more defensive
            adjusted.hivePlacement = 'ultra_defensive';
            adjusted.parasiteSpawning = 'immediate_spawning';
        } else if (survivalTime > 300) {
            // Survived long - more aggressive
            adjusted.parasiteSpawning = 'patient_buildup';
            adjusted.defensiveCoordination = 'offensive_defense';
        }
        
        return adjusted;
    }

    private getComplexityForGeneration(generation: number): string {
        if (generation <= 3) return 'basic';
        if (generation <= 7) return 'tactical';
        if (generation <= 15) return 'strategic';
        return 'advanced';
    }

    private generateDefaultStrategy(context: any): FallbackStrategy {
        return {
            generation: context.generation,
            hivePlacement: 'balanced_placement',
            parasiteSpawning: 'standard_spawning',
            defensiveCoordination: 'standard_defense',
            complexity: this.getComplexityForGeneration(context.generation),
            source: 'default'
        };
    }

    public cacheStrategy(strategy: FallbackStrategy, context: any): void {
        if (!this.config.cacheStrategies) {
            return;
        }
        
        const cacheKey = `gen_${strategy.generation}_${context.deathCause || 'unknown'}`;
        this.strategyCache.set(cacheKey, strategy);
        
        // Limit cache size
        if (this.strategyCache.size > this.config.maxCacheSize) {
            const firstKey = this.strategyCache.keys().next().value;
            this.strategyCache.delete(firstKey);
        }
        
        this.saveCachedStrategies();
    }

    public async handleQueenDeath(deathData: any): Promise<any> {
        if (this.systemStatus.backendAvailable) {
            // Backend is available, let it handle normally
            return null;
        }
        
        console.log('Handling Queen death in degraded mode');
        
        // Generate fallback strategy
        const fallbackStrategy = await this.generateFallbackStrategy({
            generation: deathData.generation,
            deathCause: deathData.deathCause,
            survivalTime: deathData.survivalTime,
            previousStrategies: []
        });
        
        // Cache the strategy for future use
        this.cacheStrategy(fallbackStrategy, deathData);
        
        // Return strategy in expected format
        return {
            type: 'queen_strategy',
            timestamp: Date.now(),
            data: {
                queenId: deathData.queenId,
                generation: deathData.generation + 1,
                strategies: {
                    hivePlacement: { strategy: fallbackStrategy.hivePlacement },
                    parasiteSpawning: { strategy: fallbackStrategy.parasiteSpawning },
                    defensiveCoordination: { strategy: fallbackStrategy.defensiveCoordination }
                },
                learningInsights: {
                    deathCause: deathData.deathCause,
                    fallbackMode: this.systemStatus.fallbackMode,
                    strategySource: fallbackStrategy.source,
                    degradationLevel: this.degradationLevel
                },
                estimatedTrainingTime: 0,
                fallbackMode: true
            }
        };
    }

    public getSystemStatus(): SystemStatus {
        return { ...this.systemStatus };
    }

    public getDegradationInfo(): any {
        const unavailableTime = this.systemStatus.backendAvailable ? 0 : Date.now() - this.backendUnavailableTime;
        
        return {
            degradationLevel: this.degradationLevel,
            fallbackMode: this.systemStatus.fallbackMode,
            backendUnavailableTime: unavailableTime,
            cachedStrategies: this.strategyCache.size,
            activeFeatures: this.systemStatus.activeFeatures,
            disabledFeatures: this.systemStatus.disabledFeatures,
            lastBackendContact: this.systemStatus.lastBackendContact
        };
    }

    public async testFallbackCapabilities(): Promise<any> {
        console.log('Testing fallback capabilities...');
        
        const testScenarios = [
            { generation: 1, deathCause: 'protector_assault', survivalTime: 30 },
            { generation: 5, deathCause: 'worker_infiltration', survivalTime: 180 },
            { generation: 10, deathCause: 'coordinated_attack', survivalTime: 300 }
        ];
        
        const results = [];
        
        for (const scenario of testScenarios) {
            try {
                const strategy = await this.generateFallbackStrategy(scenario);
                results.push({
                    scenario,
                    strategy,
                    success: true
                });
            } catch (error) {
                results.push({
                    scenario,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    success: false
                });
            }
        }
        
        return {
            testResults: results,
            systemStatus: this.getSystemStatus(),
            degradationInfo: this.getDegradationInfo()
        };
    }

    public clearCache(): void {
        this.strategyCache.clear();
        try {
            localStorage.removeItem('queen_strategy_cache');
        } catch (error) {
            console.error('Failed to clear strategy cache:', error);
        }
        console.log('Strategy cache cleared');
    }

    public async cleanup(): Promise<void> {
        console.log('Cleaning up graceful degradation manager...');
        
        // Save current cache
        this.saveCachedStrategies();
        
        // Clear resources
        this.strategyCache.clear();
        this.ruleBasedStrategies.clear();
        
        console.log('Graceful degradation manager cleanup completed');
    }
}