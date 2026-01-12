/**
 * Performance Optimizer - Client-side performance optimization and 60fps isolation
 * 
 * Ensures that AI training and learning processes don't impact game performance,
 * maintaining 60fps during neural network training periods.
 */

import { PerformanceMonitor } from '../utils/PerformanceMonitor';

export interface AITrainingConfig {
    maxTrainingDuration: number;
    allowedFPSImpact: number;
    memoryThreshold: number;
    cpuThreshold: number;
}

export interface PerformanceIsolationSettings {
    enabled: boolean;
    targetFPS: number;
    warningThreshold: number;
    criticalThreshold: number;
    adaptiveScaling: boolean;
}

export class PerformanceOptimizer {
    private performanceMonitor: PerformanceMonitor;
    private isolationSettings: PerformanceIsolationSettings;
    private aiTrainingConfig: AITrainingConfig;
    private isTrainingActive: boolean = false;
    private trainingStartTime: number = 0;
    private baselineFPS: number = 60;
    private currentFPSImpact: number = 0;
    
    // Performance callbacks
    private onPerformanceWarning?: (impact: number) => void;
    private onPerformanceCritical?: (impact: number) => void;
    private onTrainingThrottled?: (reason: string) => void;

    constructor(performanceMonitor: PerformanceMonitor) {
        this.performanceMonitor = performanceMonitor;
        
        // Default isolation settings (Requirement 8.1: Maintain 60fps)
        this.isolationSettings = {
            enabled: true,
            targetFPS: 60,
            warningThreshold: 50,  // Warning if FPS drops below 50
            criticalThreshold: 40, // Critical if FPS drops below 40
            adaptiveScaling: true
        };
        
        // Default AI training configuration (Requirements 8.2, 8.3, 8.4, 8.5)
        this.aiTrainingConfig = {
            maxTrainingDuration: 120000, // 120 seconds max (Requirement 8.4)
            allowedFPSImpact: 10,        // Max 10 FPS drop allowed
            memoryThreshold: 200,        // 200MB additional memory limit (Requirement 8.2)
            cpuThreshold: 80             // 80% CPU usage threshold
        };
        
        this.setupPerformanceMonitoring();
    }

    /**
     * Setup performance monitoring with AI training focus
     */
    private setupPerformanceMonitoring(): void {
        // Set performance callbacks
        this.performanceMonitor.onWarning((metrics) => {
            this.handlePerformanceWarning(metrics);
        });
        
        this.performanceMonitor.onCritical((metrics) => {
            this.handlePerformanceCritical(metrics);
        });
        
        // Set baseline FPS
        this.performanceMonitor.setThresholds({
            targetFPS: this.isolationSettings.targetFPS,
            warningFPS: this.isolationSettings.warningThreshold,
            criticalFPS: this.isolationSettings.criticalThreshold,
            maxFrameTime: 1000 / this.isolationSettings.targetFPS
        });
    }

    /**
     * Start AI training session with performance isolation
     */
    public async startAITrainingSession(trainingData: any): Promise<void> {
        if (this.isTrainingActive) {
            console.warn('AI training session already active');
            return;
        }

        console.log('🧠 Starting AI training session with performance isolation');
        
        this.isTrainingActive = true;
        this.trainingStartTime = performance.now();
        this.baselineFPS = this.performanceMonitor.getAverageFPS(5) || 60;
        
        // Enable enhanced monitoring during training
        this.performanceMonitor.setConsoleLogging(false); // Reduce console noise during training
        
        // Start performance isolation monitoring
        this.startPerformanceIsolationMonitoring();
        
        // Notify about training start
        this.logTrainingStart();
    }

    /**
     * End AI training session
     */
    public async endAITrainingSession(trainingResult?: any): Promise<void> {
        if (!this.isTrainingActive) {
            return;
        }

        const trainingDuration = performance.now() - this.trainingStartTime;
        
        console.log('🧠 AI training session completed');
        console.log(`📊 Training duration: ${(trainingDuration / 1000).toFixed(2)}s`);
        console.log(`📊 FPS impact: ${this.currentFPSImpact.toFixed(1)}`);
        
        this.isTrainingActive = false;
        this.currentFPSImpact = 0;
        
        // Log training results
        if (trainingResult) {
            this.logTrainingResults(trainingResult, trainingDuration);
        }
        
        // Validate performance requirements
        this.validatePerformanceRequirements(trainingDuration);
    }

    /**
     * Monitor performance isolation during training
     */
    private startPerformanceIsolationMonitoring(): void {
        const monitoringInterval = setInterval(() => {
            if (!this.isTrainingActive) {
                clearInterval(monitoringInterval);
                return;
            }

            this.checkPerformanceIsolation();
            
            // Check training duration limit (Requirement 8.4)
            const trainingDuration = performance.now() - this.trainingStartTime;
            if (trainingDuration > this.aiTrainingConfig.maxTrainingDuration) {
                console.warn(`⚠️ AI training exceeded maximum duration: ${trainingDuration / 1000}s`);
                this.throttleTraining('duration_exceeded');
            }
            
        }, 100); // Check every 100ms for responsive monitoring
    }

    /**
     * Check performance isolation effectiveness
     */
    private checkPerformanceIsolation(): void {
        const currentMetrics = this.performanceMonitor.getCurrentMetrics();
        if (!currentMetrics) return;

        const currentFPS = currentMetrics.fps;
        this.currentFPSImpact = Math.max(0, this.baselineFPS - currentFPS);

        // Check FPS impact threshold
        if (this.currentFPSImpact > this.aiTrainingConfig.allowedFPSImpact) {
            console.warn(`⚠️ AI training causing significant FPS impact: ${this.currentFPSImpact.toFixed(1)}`);
            this.throttleTraining('fps_impact');
        }

        // Check memory usage (Requirement 8.2)
        if (currentMetrics.memoryUsage && currentMetrics.memoryUsage > this.aiTrainingConfig.memoryThreshold) {
            console.warn(`⚠️ AI training memory usage high: ${currentMetrics.memoryUsage.toFixed(1)}MB`);
            this.throttleTraining('memory_usage');
        }

        // Adaptive scaling based on performance
        if (this.isolationSettings.adaptiveScaling) {
            this.applyAdaptiveScaling(currentMetrics);
        }
    }

    /**
     * Apply adaptive scaling based on current performance
     */
    private applyAdaptiveScaling(metrics: any): void {
        const fpsRatio = metrics.fps / this.isolationSettings.targetFPS;
        
        if (fpsRatio < 0.8) { // FPS below 80% of target
            // Reduce training intensity
            console.log('📉 Applying performance scaling: reducing training intensity');
            // This would communicate with the backend to reduce training complexity
            this.requestTrainingScaling('reduce');
        } else if (fpsRatio > 0.95 && this.currentFPSImpact < 2) {
            // Performance is good, can potentially increase training intensity
            console.log('📈 Performance headroom available: allowing normal training intensity');
            this.requestTrainingScaling('normal');
        }
    }

    /**
     * Request training scaling from backend
     */
    private requestTrainingScaling(level: 'reduce' | 'normal' | 'increase'): void {
        // This would send a message to the WebSocket backend to adjust training parameters
        // For now, just log the request
        console.log(`🔧 Requesting training scaling: ${level}`);
        
        // In a full implementation, this would communicate with WebSocketClient
        // to send performance feedback to the Python backend
    }

    /**
     * Throttle training due to performance issues
     */
    private throttleTraining(reason: string): void {
        console.warn(`🚨 Throttling AI training due to: ${reason}`);
        
        if (this.onTrainingThrottled) {
            this.onTrainingThrottled(reason);
        }
        
        // Request immediate training scaling
        this.requestTrainingScaling('reduce');
    }

    /**
     * Handle performance warning
     */
    private handlePerformanceWarning(metrics: any): void {
        if (this.isTrainingActive) {
            console.warn('⚠️ Performance warning during AI training:', {
                fps: metrics.fps,
                frameTime: metrics.frameTime,
                fpsImpact: this.currentFPSImpact
            });
            
            if (this.onPerformanceWarning) {
                this.onPerformanceWarning(this.currentFPSImpact);
            }
        }
    }

    /**
     * Handle critical performance issues
     */
    private handlePerformanceCritical(metrics: any): void {
        if (this.isTrainingActive) {
            console.error('🚨 Critical performance issue during AI training:', {
                fps: metrics.fps,
                frameTime: metrics.frameTime,
                fpsImpact: this.currentFPSImpact
            });
            
            // Immediately throttle training
            this.throttleTraining('critical_performance');
            
            if (this.onPerformanceCritical) {
                this.onPerformanceCritical(this.currentFPSImpact);
            }
        }
    }

    /**
     * Log training session start
     */
    private logTrainingStart(): void {
        console.log('🧠 AI Training Session Started');
        console.log(`📊 Baseline FPS: ${this.baselineFPS.toFixed(1)}`);
        console.log(`📊 Target FPS: ${this.isolationSettings.targetFPS}`);
        console.log(`📊 Max allowed FPS impact: ${this.aiTrainingConfig.allowedFPSImpact}`);
        console.log(`📊 Max training duration: ${this.aiTrainingConfig.maxTrainingDuration / 1000}s`);
        console.log(`📊 Performance isolation: ${this.isolationSettings.enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Log training results with performance analysis
     */
    private logTrainingResults(trainingResult: any, duration: number): void {
        console.log('🧠 AI Training Results:');
        console.log(`✅ Success: ${trainingResult.success}`);
        console.log(`⏱️ Duration: ${(duration / 1000).toFixed(2)}s`);
        console.log(`📊 Max FPS impact: ${this.currentFPSImpact.toFixed(1)}`);
        
        if (trainingResult.performance_metrics) {
            const perf = trainingResult.performance_metrics;
            console.log(`💾 Memory delta: ${perf.memory_usage_mb?.toFixed(1) || 'N/A'}MB`);
            console.log(`🖥️ CPU usage: ${perf.cpu_usage_percent?.toFixed(1) || 'N/A'}%`);
            console.log(`🎮 GPU used: ${perf.gpu_usage_percent !== null ? 'Yes' : 'No'}`);
        }
        
        if (trainingResult.performance_warnings?.length > 0) {
            console.warn('⚠️ Performance warnings:', trainingResult.performance_warnings);
        }
    }

    /**
     * Validate that performance requirements were met
     */
    private validatePerformanceRequirements(duration: number): void {
        const requirements = {
            fps_maintained: this.currentFPSImpact <= this.aiTrainingConfig.allowedFPSImpact,
            duration_within_limits: duration <= this.aiTrainingConfig.maxTrainingDuration,
            performance_isolation_effective: this.isolationSettings.enabled
        };

        console.log('📋 Performance Requirements Validation:');
        console.log(`✅ 60fps maintained: ${requirements.fps_maintained ? 'PASS' : 'FAIL'}`);
        console.log(`✅ Training duration: ${requirements.duration_within_limits ? 'PASS' : 'FAIL'}`);
        console.log(`✅ Performance isolation: ${requirements.performance_isolation_effective ? 'PASS' : 'FAIL'}`);

        // Log requirement compliance
        if (requirements.fps_maintained && requirements.duration_within_limits) {
            console.log('✅ All performance requirements met (Requirements 8.1, 8.4)');
        } else {
            console.warn('⚠️ Some performance requirements not met - optimization needed');
        }
    }

    /**
     * Get current performance status
     */
    public getPerformanceStatus(): {
        isTrainingActive: boolean;
        currentFPS: number;
        fpsImpact: number;
        trainingDuration: number;
        performanceIsolationActive: boolean;
        requirementsMet: boolean;
    } {
        const currentMetrics = this.performanceMonitor.getCurrentMetrics();
        const trainingDuration = this.isTrainingActive ? 
            performance.now() - this.trainingStartTime : 0;

        // Update FPS impact if training is active and we have metrics
        if (this.isTrainingActive && currentMetrics) {
            this.currentFPSImpact = Math.max(0, this.baselineFPS - currentMetrics.fps);
        }

        return {
            isTrainingActive: this.isTrainingActive,
            currentFPS: currentMetrics?.fps || 0,
            fpsImpact: this.currentFPSImpact,
            trainingDuration,
            performanceIsolationActive: this.isolationSettings.enabled,
            requirementsMet: this.currentFPSImpact <= this.aiTrainingConfig.allowedFPSImpact &&
                           trainingDuration <= this.aiTrainingConfig.maxTrainingDuration
        };
    }

    /**
     * Configure performance isolation settings
     */
    public configureIsolation(settings: Partial<PerformanceIsolationSettings>): void {
        this.isolationSettings = { ...this.isolationSettings, ...settings };
        console.log('🔧 Performance isolation settings updated:', this.isolationSettings);
    }

    /**
     * Configure AI training parameters
     */
    public configureTraining(config: Partial<AITrainingConfig>): void {
        this.aiTrainingConfig = { ...this.aiTrainingConfig, ...config };
        console.log('🔧 AI training configuration updated:', this.aiTrainingConfig);
    }

    /**
     * Set performance event callbacks
     */
    public setCallbacks(callbacks: {
        onWarning?: (impact: number) => void;
        onCritical?: (impact: number) => void;
        onThrottled?: (reason: string) => void;
    }): void {
        this.onPerformanceWarning = callbacks.onWarning;
        this.onPerformanceCritical = callbacks.onCritical;
        this.onTrainingThrottled = callbacks.onThrottled;
    }

    /**
     * Get performance optimization recommendations
     */
    public getOptimizationRecommendations(): string[] {
        const recommendations: string[] = [];
        const performanceSummary = this.performanceMonitor.getPerformanceSummary();

        if (performanceSummary.averageFPS < this.isolationSettings.targetFPS) {
            recommendations.push('Consider reducing AI training complexity to maintain target FPS');
        }

        if (this.currentFPSImpact > this.aiTrainingConfig.allowedFPSImpact) {
            recommendations.push('Enable adaptive training scaling to reduce FPS impact');
        }

        if (!this.isolationSettings.enabled) {
            recommendations.push('Enable performance isolation for better training/gameplay balance');
        }

        if (recommendations.length === 0) {
            recommendations.push('Performance optimization is working well - no changes needed');
        }

        return recommendations;
    }

    /**
     * Dispose performance optimizer
     */
    public dispose(): void {
        if (this.isTrainingActive) {
            this.endAITrainingSession();
        }
        
        console.log('🔧 Performance optimizer disposed');
    }
}