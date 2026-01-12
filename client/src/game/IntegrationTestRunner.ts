/**
 * IntegrationTestRunner - Client-side integration testing for end-to-end learning cycle
 * 
 * Provides automated testing of the complete AI learning system from the client perspective.
 */

import { SystemIntegration } from './SystemIntegration';
import { AdaptiveQueen } from './entities/AdaptiveQueen';
import { WebSocketClient } from '../networking/WebSocketClient';
import { integrationLogger } from '../utils/Logger';

export interface IntegrationTestConfig {
    systemIntegration: SystemIntegration;
    enableAutomatedTesting?: boolean;
    testInterval?: number; // seconds
    maxTestCycles?: number;
}

export interface TestCycleResult {
    testId: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    success: boolean;
    phases: {
        queenCreation: { success: boolean; duration: number };
        queenDeath: { success: boolean; duration: number };
        strategyReceived: { success: boolean; duration: number };
        strategyApplication: { success: boolean; duration: number };
    };
    errors: string[];
    performanceMetrics: {
        fpsImpact: number;
        memoryUsage: number;
        networkLatency: number;
    };
}

/**
 * Client-side integration test runner for AI learning system
 */
export class IntegrationTestRunner {
    private systemIntegration: SystemIntegration;
    private enableAutomatedTesting: boolean;
    private testInterval: number;
    private maxTestCycles: number;
    
    private isRunning: boolean = false;
    private testCycles: TestCycleResult[] = [];
    private currentTestId: string | null = null;
    private testTimer: number | null = null;
    private cycleCounter: number = 0;

    constructor(config: IntegrationTestConfig) {
        this.systemIntegration = config.systemIntegration;
        this.enableAutomatedTesting = config.enableAutomatedTesting !== false;
        this.testInterval = config.testInterval || 300; // 5 minutes default
        this.maxTestCycles = config.maxTestCycles || 10;
        
        integrationLogger.info('IntegrationTestRunner created', {
            enableAutomatedTesting: this.enableAutomatedTesting,
            testInterval: this.testInterval,
            maxTestCycles: this.maxTestCycles
        });
    }

    /**
     * Start automated integration testing
     */
    public startAutomatedTesting(): void {
        if (!this.enableAutomatedTesting) {
            integrationLogger.warn('Automated testing is disabled');
            return;
        }
        
        if (this.isRunning) {
            integrationLogger.warn('Automated testing is already running');
            return;
        }
        
        this.isRunning = true;
        integrationLogger.info('Starting automated integration testing', {
            testInterval: this.testInterval,
            maxTestCycles: this.maxTestCycles
        });
        
        // Start first test immediately
        this.runTestCycle();
        
        // Schedule periodic tests
        this.testTimer = window.setInterval(() => {
            if (this.cycleCounter < this.maxTestCycles) {
                this.runTestCycle();
            } else {
                this.stopAutomatedTesting();
                integrationLogger.info('Maximum test cycles reached, stopping automated testing');
            }
        }, this.testInterval * 1000);
    }

    /**
     * Stop automated integration testing
     */
    public stopAutomatedTesting(): void {
        if (!this.isRunning) {
            return;
        }
        
        this.isRunning = false;
        
        if (this.testTimer) {
            clearInterval(this.testTimer);
            this.testTimer = null;
        }
        
        integrationLogger.info('Stopped automated integration testing', {
            totalCycles: this.cycleCounter,
            successfulCycles: this.testCycles.filter(c => c.success).length
        });
    }

    /**
     * Run a single test cycle
     */
    public async runTestCycle(): Promise<TestCycleResult> {
        const testId = `integration_test_${++this.cycleCounter}_${Date.now()}`;
        this.currentTestId = testId;
        
        integrationLogger.info('Starting integration test cycle', { testId });
        
        const testResult: TestCycleResult = {
            testId,
            startTime: Date.now(),
            success: false,
            phases: {
                queenCreation: { success: false, duration: 0 },
                queenDeath: { success: false, duration: 0 },
                strategyReceived: { success: false, duration: 0 },
                strategyApplication: { success: false, duration: 0 }
            },
            errors: [],
            performanceMetrics: {
                fpsImpact: 0,
                memoryUsage: 0,
                networkLatency: 0
            }
        };
        
        try {
            // Phase 1: Test Queen creation
            await this.testQueenCreation(testResult);
            
            // Phase 2: Test Queen death and learning trigger
            await this.testQueenDeath(testResult);
            
            // Phase 3: Test strategy reception
            await this.testStrategyReception(testResult);
            
            // Phase 4: Test strategy application
            await this.testStrategyApplication(testResult);
            
            testResult.success = Object.values(testResult.phases).every(phase => phase.success);
            
        } catch (error) {
            testResult.errors.push(`Test cycle failed: ${error}`);
            integrationLogger.error('Integration test cycle failed', { testId, error });
        }
        
        testResult.endTime = Date.now();
        testResult.duration = testResult.endTime - testResult.startTime;
        
        // Collect performance metrics
        this.collectPerformanceMetrics(testResult);
        
        this.testCycles.push(testResult);
        
        // Keep only last 20 test cycles
        if (this.testCycles.length > 20) {
            this.testCycles = this.testCycles.slice(-20);
        }
        
        integrationLogger.info('Integration test cycle completed', {
            testId,
            success: testResult.success,
            duration: testResult.duration,
            phases: Object.keys(testResult.phases).map(phase => ({
                phase,
                success: testResult.phases[phase as keyof typeof testResult.phases].success
            }))
        });
        
        this.currentTestId = null;
        return testResult;
    }

    /**
     * Test Queen creation phase
     */
    private async testQueenCreation(testResult: TestCycleResult): Promise<void> {
        const phaseStart = Date.now();
        
        try {
            integrationLogger.debug('Testing Queen creation phase');
            
            // Check if system integration is properly initialized
            if (!this.systemIntegration.getIsInitialized()) {
                throw new Error('SystemIntegration not initialized');
            }
            
            // Verify AI learning is enabled
            const aiStats = this.systemIntegration.getAIStatistics();
            if (!aiStats.learningEnabled) {
                throw new Error('AI learning is not enabled');
            }
            
            // Check WebSocket connection
            const connectionStatus = this.systemIntegration.getAdaptiveQueenIntegration().getConnectionStatus();
            if (!connectionStatus.connected) {
                throw new Error('WebSocket not connected to AI backend');
            }
            
            testResult.phases.queenCreation.success = true;
            integrationLogger.debug('Queen creation phase passed');
            
        } catch (error) {
            testResult.errors.push(`Queen creation phase failed: ${error}`);
            integrationLogger.error('Queen creation phase failed', error);
        }
        
        testResult.phases.queenCreation.duration = Date.now() - phaseStart;
    }

    /**
     * Test Queen death and learning trigger phase
     */
    private async testQueenDeath(testResult: TestCycleResult): Promise<void> {
        const phaseStart = Date.now();
        
        try {
            integrationLogger.debug('Testing Queen death phase');
            
            // Trigger a test learning cycle
            await this.systemIntegration.triggerTestLearningCycle();
            
            // Wait a moment for the message to be processed
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check that the learning cycle was initiated
            const cycleDetails = this.systemIntegration.getLearningCycleDetails();
            if (cycleDetails.active.length === 0) {
                throw new Error('No active learning cycles found after triggering test');
            }
            
            testResult.phases.queenDeath.success = true;
            integrationLogger.debug('Queen death phase passed');
            
        } catch (error) {
            testResult.errors.push(`Queen death phase failed: ${error}`);
            integrationLogger.error('Queen death phase failed', error);
        }
        
        testResult.phases.queenDeath.duration = Date.now() - phaseStart;
    }

    /**
     * Test strategy reception phase
     */
    private async testStrategyReception(testResult: TestCycleResult): Promise<void> {
        const phaseStart = Date.now();
        
        try {
            integrationLogger.debug('Testing strategy reception phase');
            
            // Wait for strategy response (with timeout)
            const timeout = 60000; // 60 seconds
            const startWait = Date.now();
            let strategyReceived = false;
            
            while (Date.now() - startWait < timeout && !strategyReceived) {
                // Check if any learning cycles have completed
                const cycleDetails = this.systemIntegration.getLearningCycleDetails();
                
                for (const cycle of cycleDetails.active) {
                    if (cycle.learningPhases.strategyGeneration.success) {
                        strategyReceived = true;
                        break;
                    }
                }
                
                if (!strategyReceived) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            if (!strategyReceived) {
                throw new Error('Strategy not received within timeout period');
            }
            
            testResult.phases.strategyReceived.success = true;
            integrationLogger.debug('Strategy reception phase passed');
            
        } catch (error) {
            testResult.errors.push(`Strategy reception phase failed: ${error}`);
            integrationLogger.error('Strategy reception phase failed', error);
        }
        
        testResult.phases.strategyReceived.duration = Date.now() - phaseStart;
    }

    /**
     * Test strategy application phase
     */
    private async testStrategyApplication(testResult: TestCycleResult): Promise<void> {
        const phaseStart = Date.now();
        
        try {
            integrationLogger.debug('Testing strategy application phase');
            
            // Check if strategy application would work
            // (In a real scenario, this would involve creating a new Queen and applying the strategy)
            
            // For now, we'll check that the system is ready for strategy application
            const cycleDetails = this.systemIntegration.getLearningCycleDetails();
            let applicationReady = false;
            
            for (const cycle of cycleDetails.active) {
                if (cycle.learningPhases.strategyGeneration.success) {
                    applicationReady = true;
                    break;
                }
            }
            
            if (!applicationReady) {
                throw new Error('System not ready for strategy application');
            }
            
            testResult.phases.strategyApplication.success = true;
            integrationLogger.debug('Strategy application phase passed');
            
        } catch (error) {
            testResult.errors.push(`Strategy application phase failed: ${error}`);
            integrationLogger.error('Strategy application phase failed', error);
        }
        
        testResult.phases.strategyApplication.duration = Date.now() - phaseStart;
    }

    /**
     * Collect performance metrics for the test
     */
    private collectPerformanceMetrics(testResult: TestCycleResult): void {
        try {
            const performanceStatus = this.systemIntegration.getPerformanceStatus();
            
            testResult.performanceMetrics = {
                fpsImpact: performanceStatus.fpsImpact || 0,
                memoryUsage: performanceStatus.performanceSummary?.memoryUsage || 0,
                networkLatency: 0 // Would need to measure actual network latency
            };
            
        } catch (error) {
            integrationLogger.warn('Failed to collect performance metrics', error);
        }
    }

    /**
     * Run a comprehensive system test
     */
    public async runComprehensiveTest(): Promise<{
        success: boolean;
        results: TestCycleResult[];
        summary: {
            totalTests: number;
            successfulTests: number;
            failedTests: number;
            successRate: number;
            averageDuration: number;
        };
    }> {
        integrationLogger.info('Starting comprehensive integration test');
        
        const testResults: TestCycleResult[] = [];
        const numTests = 3; // Run 3 test cycles
        
        for (let i = 0; i < numTests; i++) {
            integrationLogger.info(`Running comprehensive test ${i + 1}/${numTests}`);
            
            const result = await this.runTestCycle();
            testResults.push(result);
            
            // Wait between tests
            if (i < numTests - 1) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        const successfulTests = testResults.filter(r => r.success).length;
        const failedTests = testResults.length - successfulTests;
        const averageDuration = testResults.reduce((sum, r) => sum + (r.duration || 0), 0) / testResults.length;
        
        const summary = {
            totalTests: testResults.length,
            successfulTests,
            failedTests,
            successRate: successfulTests / testResults.length,
            averageDuration
        };
        
        integrationLogger.info('Comprehensive integration test completed', summary);
        
        return {
            success: summary.successRate >= 0.8, // 80% success rate required
            results: testResults,
            summary
        };
    }

    /**
     * Get test statistics
     */
    public getTestStatistics(): {
        isRunning: boolean;
        totalCycles: number;
        successfulCycles: number;
        failedCycles: number;
        successRate: number;
        averageDuration: number;
        recentResults: TestCycleResult[];
    } {
        const successfulCycles = this.testCycles.filter(c => c.success).length;
        const failedCycles = this.testCycles.length - successfulCycles;
        const averageDuration = this.testCycles.length > 0 
            ? this.testCycles.reduce((sum, c) => sum + (c.duration || 0), 0) / this.testCycles.length
            : 0;
        
        return {
            isRunning: this.isRunning,
            totalCycles: this.cycleCounter,
            successfulCycles,
            failedCycles,
            successRate: this.testCycles.length > 0 ? successfulCycles / this.testCycles.length : 0,
            averageDuration,
            recentResults: this.testCycles.slice(-5) // Last 5 results
        };
    }

    /**
     * Get current test status
     */
    public getCurrentTestStatus(): {
        currentTestId: string | null;
        isRunning: boolean;
        nextTestIn?: number; // seconds
    } {
        let nextTestIn: number | undefined;
        
        if (this.isRunning && this.testTimer) {
            // This is approximate since we don't track exact timing
            nextTestIn = this.testInterval;
        }
        
        return {
            currentTestId: this.currentTestId,
            isRunning: this.isRunning,
            nextTestIn
        };
    }

    /**
     * Export test results for analysis
     */
    public exportTestResults(): string {
        const exportData = {
            timestamp: Date.now(),
            statistics: this.getTestStatistics(),
            testCycles: this.testCycles,
            configuration: {
                enableAutomatedTesting: this.enableAutomatedTesting,
                testInterval: this.testInterval,
                maxTestCycles: this.maxTestCycles
            }
        };
        
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Dispose of the test runner
     */
    public dispose(): void {
        this.stopAutomatedTesting();
        this.testCycles = [];
        this.currentTestId = null;
        
        integrationLogger.info('IntegrationTestRunner disposed');
    }
}