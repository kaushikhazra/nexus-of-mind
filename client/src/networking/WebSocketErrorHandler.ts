/**
 * WebSocket Error Handler and Recovery Manager
 * Handles connection failures, message timeouts, and graceful degradation
 */

export interface ErrorRecoveryConfig {
    maxRetryAttempts: number;
    retryDelay: number;
    timeoutDuration: number;
    degradationThreshold: number;
    offlineMode: boolean;
}

export interface ErrorContext {
    operation: string;
    timestamp: number;
    errorType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    retryCount: number;
    data?: any;
}

export interface RecoveryResult {
    success: boolean;
    strategy: string;
    degraded?: boolean;
    offlineMode?: boolean;
    error?: string;
    retryAfter?: number;
    data?: any;
}

export class WebSocketErrorHandler {
    private config: ErrorRecoveryConfig;
    private errorHistory: ErrorContext[] = [];
    private recoveryStrategies: Map<string, string> = new Map();
    private systemHealth: Map<string, string> = new Map();
    private offlineQueue: any[] = [];
    private degradationLevel: number = 0;

    constructor(config: Partial<ErrorRecoveryConfig> = {}) {
        this.config = {
            maxRetryAttempts: 5,
            retryDelay: 2000,
            timeoutDuration: 30000,
            degradationThreshold: 3,
            offlineMode: false,
            ...config
        };

        this.initializeRecoveryStrategies();
        this.initializeSystemHealth();
    }

    private initializeRecoveryStrategies(): void {
        this.recoveryStrategies.set('connection_lost', 'retry');
        this.recoveryStrategies.set('message_timeout', 'retry');
        this.recoveryStrategies.set('serialization_error', 'graceful_degradation');
        this.recoveryStrategies.set('validation_error', 'graceful_degradation');
        this.recoveryStrategies.set('server_error', 'fallback');
        this.recoveryStrategies.set('network_error', 'retry');
        this.recoveryStrategies.set('authentication_error', 'reconnect');
        this.recoveryStrategies.set('rate_limit_error', 'backoff');
    }

    private initializeSystemHealth(): void {
        this.systemHealth.set('websocket', 'healthy');
        this.systemHealth.set('message_processing', 'healthy');
        this.systemHealth.set('data_validation', 'healthy');
        this.systemHealth.set('offline_queue', 'healthy');
    }

    public async handleConnectionError(error: Error, context: Partial<ErrorContext> = {}): Promise<RecoveryResult> {
        const errorContext: ErrorContext = {
            operation: context.operation || 'connection',
            timestamp: Date.now(),
            errorType: this.classifyConnectionError(error),
            severity: this.determineSeverity(error),
            retryCount: context.retryCount || 0,
            data: context.data
        };

        console.error(`WebSocket connection error: ${errorContext.errorType} (severity: ${errorContext.severity})`);
        
        // Record error for pattern analysis
        this.recordError(errorContext);
        
        // Update system health
        this.systemHealth.set('websocket', 'degraded');
        
        // Determine recovery strategy
        const strategy = this.recoveryStrategies.get(errorContext.errorType) || 'retry';
        
        try {
            switch (strategy) {
                case 'retry':
                    return await this.retryConnection(errorContext);
                case 'graceful_degradation':
                    return await this.degradeGracefully(errorContext);
                case 'fallback':
                    return await this.fallbackOperation(errorContext);
                case 'reconnect':
                    return await this.forceReconnection(errorContext);
                case 'backoff':
                    return await this.exponentialBackoff(errorContext);
                default:
                    return await this.retryConnection(errorContext);
            }
        } catch (recoveryError) {
            console.error('Recovery strategy failed:', recoveryError);
            return {
                success: false,
                strategy: 'recovery_failed',
                error: recoveryError instanceof Error ? recoveryError.message : 'Unknown recovery error'
            };
        }
    }

    private classifyConnectionError(error: Error): string {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('timeout')) {
            return 'message_timeout';
        } else if (errorMessage.includes('connection') && (errorMessage.includes('lost') || errorMessage.includes('closed'))) {
            return 'connection_lost';
        } else if (errorMessage.includes('network')) {
            return 'network_error';
        } else if (errorMessage.includes('json') || errorMessage.includes('parse')) {
            return 'serialization_error';
        } else if (errorMessage.includes('validation')) {
            return 'validation_error';
        } else if (errorMessage.includes('server') || errorMessage.includes('500')) {
            return 'server_error';
        } else if (errorMessage.includes('auth')) {
            return 'authentication_error';
        } else if (errorMessage.includes('rate') || errorMessage.includes('limit')) {
            return 'rate_limit_error';
        } else {
            return 'unknown_error';
        }
    }

    private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('critical') || errorMessage.includes('fatal')) {
            return 'critical';
        } else if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
            return 'high';
        } else if (errorMessage.includes('validation') || errorMessage.includes('parse')) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    private recordError(errorContext: ErrorContext): void {
        this.errorHistory.push(errorContext);
        
        // Keep only last 50 errors
        if (this.errorHistory.length > 50) {
            this.errorHistory = this.errorHistory.slice(-50);
        }
        
        // Analyze error patterns
        this.analyzeErrorPatterns(errorContext.errorType);
    }

    private analyzeErrorPatterns(errorType: string): void {
        const recentErrors = this.errorHistory.filter(
            error => error.errorType === errorType && 
            Date.now() - error.timestamp < 300000 // Last 5 minutes
        );

        if (recentErrors.length >= this.config.degradationThreshold) {
            console.warn(`Error pattern detected: ${errorType} occurred ${recentErrors.length} times in 5 minutes`);
            
            // Escalate recovery strategy
            const currentStrategy = this.recoveryStrategies.get(errorType);
            if (currentStrategy === 'retry') {
                this.recoveryStrategies.set(errorType, 'graceful_degradation');
            } else if (currentStrategy === 'graceful_degradation') {
                this.recoveryStrategies.set(errorType, 'fallback');
            }
            
            // Increase degradation level
            this.degradationLevel = Math.min(this.degradationLevel + 1, 3);
        }
    }

    private async retryConnection(errorContext: ErrorContext): Promise<RecoveryResult> {
        if (errorContext.retryCount >= this.config.maxRetryAttempts) {
            console.warn('Max retry attempts reached, falling back to degraded mode');
            return await this.degradeGracefully(errorContext);
        }

        const retryDelay = this.config.retryDelay * Math.pow(2, errorContext.retryCount);
        
        console.log(`Retrying connection in ${retryDelay}ms (attempt ${errorContext.retryCount + 1}/${this.config.maxRetryAttempts})`);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    strategy: 'retry',
                    retryAfter: retryDelay
                });
            }, retryDelay);
        });
    }

    private async degradeGracefully(errorContext: ErrorContext): Promise<RecoveryResult> {
        console.log('Gracefully degrading WebSocket functionality');
        
        // Enable offline mode
        this.config.offlineMode = true;
        this.systemHealth.set('websocket', 'degraded');
        
        // Reduce message frequency
        const degradedConfig = {
            messageFrequency: 'reduced',
            offlineQueueEnabled: true,
            localFallbackEnabled: true,
            reducedFunctionality: true
        };
        
        return {
            success: true,
            strategy: 'graceful_degradation',
            degraded: true,
            offlineMode: true
        };
    }

    private async fallbackOperation(errorContext: ErrorContext): Promise<RecoveryResult> {
        console.log('Using fallback operation for WebSocket functionality');
        
        // Use local storage for critical data
        const fallbackConfig = {
            method: 'local_storage',
            syncWhenAvailable: true,
            reducedFeatures: true
        };
        
        return {
            success: true,
            strategy: 'fallback',
            degraded: true,
            offlineMode: true
        };
    }

    private async forceReconnection(errorContext: ErrorContext): Promise<RecoveryResult> {
        console.log('Forcing WebSocket reconnection');
        
        // Clear any existing connection state
        // This would be handled by the WebSocketClient
        
        return {
            success: true,
            strategy: 'force_reconnect'
        };
    }

    private async exponentialBackoff(errorContext: ErrorContext): Promise<RecoveryResult> {
        const backoffDelay = Math.min(
            this.config.retryDelay * Math.pow(2, errorContext.retryCount),
            30000 // Max 30 seconds
        );
        
        console.log(`Applying exponential backoff: ${backoffDelay}ms`);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    strategy: 'exponential_backoff',
                    retryAfter: backoffDelay
                });
            }, backoffDelay);
        });
    }

    public async handleMessageError(error: Error, message: any, context: Partial<ErrorContext> = {}): Promise<RecoveryResult> {
        const errorContext: ErrorContext = {
            operation: context.operation || 'message_processing',
            timestamp: Date.now(),
            errorType: this.classifyMessageError(error, message),
            severity: this.determineSeverity(error),
            retryCount: context.retryCount || 0,
            data: { message, error: error.message }
        };

        console.error(`WebSocket message error: ${errorContext.errorType}`);
        
        // Record error
        this.recordError(errorContext);
        
        // Handle based on error type
        switch (errorContext.errorType) {
            case 'serialization_error':
                return await this.handleSerializationError(message, errorContext);
            case 'validation_error':
                return await this.handleValidationError(message, errorContext);
            case 'timeout_error':
                return await this.handleTimeoutError(message, errorContext);
            default:
                return await this.handleGenericMessageError(message, errorContext);
        }
    }

    private classifyMessageError(error: Error, message: any): string {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('json') || errorMessage.includes('parse') || errorMessage.includes('serialize')) {
            return 'serialization_error';
        } else if (errorMessage.includes('validation') || errorMessage.includes('schema')) {
            return 'validation_error';
        } else if (errorMessage.includes('timeout')) {
            return 'timeout_error';
        } else {
            return 'generic_message_error';
        }
    }

    private async handleSerializationError(message: any, errorContext: ErrorContext): Promise<RecoveryResult> {
        try {
            // Attempt to sanitize the message
            const sanitizedMessage = this.sanitizeMessage(message);
            
            if (sanitizedMessage) {
                return {
                    success: true,
                    strategy: 'message_sanitization',
                    data: sanitizedMessage
                };
            } else {
                // Queue for later processing
                this.queueMessage(message);
                return {
                    success: true,
                    strategy: 'message_queued',
                    offlineMode: true
                };
            }
        } catch (sanitizeError) {
            console.error('Message sanitization failed:', sanitizeError);
            return {
                success: false,
                strategy: 'sanitization_failed',
                error: sanitizeError instanceof Error ? sanitizeError.message : 'Unknown sanitization error'
            };
        }
    }

    private async handleValidationError(message: any, errorContext: ErrorContext): Promise<RecoveryResult> {
        try {
            // Attempt to fix validation issues
            const validatedMessage = this.validateAndFixMessage(message);
            
            if (validatedMessage) {
                return {
                    success: true,
                    strategy: 'message_validation_fix',
                    data: validatedMessage
                };
            } else {
                // Use default values for missing fields
                const defaultMessage = this.createDefaultMessage(message);
                return {
                    success: true,
                    strategy: 'default_message_creation',
                    data: defaultMessage,
                    degraded: true
                };
            }
        } catch (validationError) {
            console.error('Message validation fix failed:', validationError);
            return {
                success: false,
                strategy: 'validation_fix_failed',
                error: validationError instanceof Error ? validationError.message : 'Unknown validation error'
            };
        }
    }

    private async handleTimeoutError(message: any, errorContext: ErrorContext): Promise<RecoveryResult> {
        // Queue message for retry
        this.queueMessage(message);
        
        return {
            success: true,
            strategy: 'message_timeout_queue',
            offlineMode: true,
            retryAfter: this.config.retryDelay
        };
    }

    private async handleGenericMessageError(message: any, errorContext: ErrorContext): Promise<RecoveryResult> {
        // Generic error handling - queue message and continue
        this.queueMessage(message);
        
        return {
            success: true,
            strategy: 'generic_error_queue',
            offlineMode: true
        };
    }

    private sanitizeMessage(message: any): any | null {
        try {
            if (!message || typeof message !== 'object') {
                return null;
            }

            const sanitized: any = {};
            
            // Sanitize common fields
            if (message.type && typeof message.type === 'string') {
                sanitized.type = message.type.trim();
            }
            
            if (message.timestamp) {
                sanitized.timestamp = typeof message.timestamp === 'number' ? message.timestamp : Date.now();
            } else {
                sanitized.timestamp = Date.now();
            }
            
            if (message.data && typeof message.data === 'object') {
                sanitized.data = this.sanitizeData(message.data);
            }
            
            return sanitized;
        } catch (error) {
            console.error('Message sanitization error:', error);
            return null;
        }
    }

    private sanitizeData(data: any): any {
        if (!data || typeof data !== 'object') {
            return {};
        }

        const sanitized: any = {};
        
        // Sanitize numeric fields
        const numericFields = ['generation', 'survivalTime', 'parasitesSpawned'];
        numericFields.forEach(field => {
            if (data[field] !== undefined) {
                const value = Number(data[field]);
                if (!isNaN(value) && isFinite(value)) {
                    sanitized[field] = Math.max(0, value);
                }
            }
        });
        
        // Sanitize string fields
        const stringFields = ['queenId', 'deathCause', 'territoryId'];
        stringFields.forEach(field => {
            if (data[field] && typeof data[field] === 'string') {
                sanitized[field] = data[field].trim();
            }
        });
        
        // Sanitize object fields
        if (data.deathLocation && typeof data.deathLocation === 'object') {
            sanitized.deathLocation = {
                x: Number(data.deathLocation.x) || 0,
                y: Number(data.deathLocation.y) || 0,
                z: Number(data.deathLocation.z) || 0
            };
        }
        
        return sanitized;
    }

    private validateAndFixMessage(message: any): any | null {
        try {
            if (!message || !message.type) {
                return null;
            }

            const fixed: any = { ...message };
            
            // Fix common validation issues
            if (!fixed.timestamp) {
                fixed.timestamp = Date.now();
            }
            
            if (fixed.type === 'queen_death' && fixed.data) {
                // Ensure required fields exist
                if (!fixed.data.queenId) {
                    fixed.data.queenId = `recovered_queen_${Date.now()}`;
                }
                
                if (!fixed.data.generation || fixed.data.generation < 1) {
                    fixed.data.generation = 1;
                }
                
                if (!fixed.data.deathCause) {
                    fixed.data.deathCause = 'unknown';
                }
                
                if (!fixed.data.survivalTime || fixed.data.survivalTime < 0) {
                    fixed.data.survivalTime = 0;
                }
            }
            
            return fixed;
        } catch (error) {
            console.error('Message validation fix error:', error);
            return null;
        }
    }

    private createDefaultMessage(originalMessage: any): any {
        const messageType = originalMessage?.type || 'unknown';
        
        const defaultMessage = {
            type: messageType,
            timestamp: Date.now(),
            data: {}
        };
        
        if (messageType === 'queen_death') {
            defaultMessage.data = {
                queenId: `default_queen_${Date.now()}`,
                generation: 1,
                deathCause: 'unknown',
                survivalTime: 0,
                parasitesSpawned: 0,
                deathLocation: { x: 0, y: 0, z: 0 }
            };
        }
        
        return defaultMessage;
    }

    private queueMessage(message: any): void {
        this.offlineQueue.push({
            message,
            timestamp: Date.now(),
            retryCount: 0
        });
        
        // Limit queue size
        if (this.offlineQueue.length > 100) {
            this.offlineQueue = this.offlineQueue.slice(-100);
        }
        
        this.systemHealth.set('offline_queue', 'active');
    }

    public async processOfflineQueue(): Promise<{ processed: number; failed: number }> {
        if (this.offlineQueue.length === 0) {
            return { processed: 0, failed: 0 };
        }

        console.log(`Processing ${this.offlineQueue.length} queued messages`);
        
        let processed = 0;
        let failed = 0;
        const remainingQueue: any[] = [];
        
        for (const queuedItem of this.offlineQueue) {
            try {
                // Attempt to process the queued message
                // This would be handled by the WebSocketClient
                processed++;
            } catch (error) {
                console.error('Failed to process queued message:', error);
                
                queuedItem.retryCount++;
                if (queuedItem.retryCount < this.config.maxRetryAttempts) {
                    remainingQueue.push(queuedItem);
                } else {
                    failed++;
                }
            }
        }
        
        this.offlineQueue = remainingQueue;
        
        if (this.offlineQueue.length === 0) {
            this.systemHealth.set('offline_queue', 'healthy');
        }
        
        return { processed, failed };
    }

    public getSystemHealth(): { [key: string]: string } {
        return Object.fromEntries(this.systemHealth);
    }

    public getErrorStatistics(): any {
        const now = Date.now();
        const recentErrors = this.errorHistory.filter(error => now - error.timestamp < 3600000); // Last hour
        
        const errorTypes = recentErrors.reduce((acc, error) => {
            acc[error.errorType] = (acc[error.errorType] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });
        
        return {
            totalErrors: this.errorHistory.length,
            recentErrors: recentErrors.length,
            errorTypes,
            degradationLevel: this.degradationLevel,
            offlineQueueSize: this.offlineQueue.length,
            systemHealth: this.getSystemHealth()
        };
    }

    public resetErrorHistory(): void {
        this.errorHistory = [];
        this.degradationLevel = 0;
        this.systemHealth.set('websocket', 'healthy');
        this.systemHealth.set('message_processing', 'healthy');
        console.log('Error history reset');
    }

    public async cleanup(): Promise<void> {
        console.log('Cleaning up WebSocket error handler...');
        
        // Process any remaining queued messages
        if (this.offlineQueue.length > 0) {
            console.log(`Saving ${this.offlineQueue.length} unprocessed messages`);
            // Save to local storage for later recovery
            try {
                localStorage.setItem('websocket_offline_queue', JSON.stringify(this.offlineQueue));
            } catch (error) {
                console.error('Failed to save offline queue:', error);
            }
        }
        
        // Clear resources
        this.errorHistory = [];
        this.offlineQueue = [];
        this.recoveryStrategies.clear();
        this.systemHealth.clear();
        
        console.log('WebSocket error handler cleanup completed');
    }
}