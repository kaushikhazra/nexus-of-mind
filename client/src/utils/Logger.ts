/**
 * Logger - Comprehensive logging and debugging system
 * 
 * Provides structured logging with different levels, categories, and output targets.
 * Supports both development and production logging configurations.
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    CRITICAL = 4
}

export enum LogCategory {
    GAME_ENGINE = 'GameEngine',
    AI_LEARNING = 'AILearning',
    NETWORKING = 'Networking',
    PERFORMANCE = 'Performance',
    COMBAT = 'Combat',
    TERRITORY = 'Territory',
    UNITS = 'Units',
    ENERGY = 'Energy',
    UI = 'UI',
    INTEGRATION = 'Integration'
}

export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    category: LogCategory;
    message: string;
    data?: any;
    stack?: string;
}

export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableStorage: boolean;
    enableRemote: boolean;
    maxStorageEntries: number;
    remoteEndpoint?: string;
    categories?: LogCategory[];
}

/**
 * Comprehensive logging system for debugging and monitoring
 */
export class Logger {
    private static instance: Logger | null = null;
    private config: LoggerConfig;
    private logEntries: LogEntry[] = [];
    private remoteQueue: LogEntry[] = [];
    private isRemoteAvailable: boolean = false;

    private readonly DEFAULT_CONFIG: LoggerConfig = {
        level: LogLevel.INFO,
        enableConsole: true,
        enableStorage: true,
        enableRemote: false,
        maxStorageEntries: 1000,
        categories: Object.values(LogCategory)
    };

    private constructor(config?: Partial<LoggerConfig>) {
        this.config = { ...this.DEFAULT_CONFIG, ...config };
        this.initializeRemoteLogging();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(config?: Partial<LoggerConfig>): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        }
        return Logger.instance;
    }

    /**
     * Initialize remote logging if enabled
     */
    private async initializeRemoteLogging(): Promise<void> {
        if (!this.config.enableRemote || !this.config.remoteEndpoint) {
            return;
        }

        try {
            const response = await fetch(`${this.config.remoteEndpoint}/health`, {
                method: 'GET',
                timeout: 5000
            } as any);
            
            this.isRemoteAvailable = response.ok;
            
            if (this.isRemoteAvailable) {
                // Send queued logs
                await this.flushRemoteQueue();
                
                // Set up periodic flushing
                setInterval(() => this.flushRemoteQueue(), 30000); // Every 30 seconds
            }
        } catch (error) {
            this.isRemoteAvailable = false;
        }
    }

    /**
     * Log a debug message
     */
    public debug(category: LogCategory, message: string, data?: any): void {
        this.log(LogLevel.DEBUG, category, message, data);
    }

    /**
     * Log an info message
     */
    public info(category: LogCategory, message: string, data?: any): void {
        this.log(LogLevel.INFO, category, message, data);
    }

    /**
     * Log a warning message
     */
    public warn(category: LogCategory, message: string, data?: any): void {
        this.log(LogLevel.WARN, category, message, data);
    }

    /**
     * Log an error message
     */
    public error(category: LogCategory, message: string, error?: Error | any): void {
        const stack = error instanceof Error ? error.stack : undefined;
        this.log(LogLevel.ERROR, category, message, error, stack);
    }

    /**
     * Log a critical message
     */
    public critical(category: LogCategory, message: string, error?: Error | any): void {
        const stack = error instanceof Error ? error.stack : undefined;
        this.log(LogLevel.CRITICAL, category, message, error, stack);
    }

    /**
     * Core logging method
     */
    private log(level: LogLevel, category: LogCategory, message: string, data?: any, stack?: string): void {
        // Check if logging is enabled for this level and category
        if (level < this.config.level || !this.config.categories?.includes(category)) {
            return;
        }

        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            category,
            message,
            data,
            stack
        };

        // Console logging
        if (this.config.enableConsole) {
            this.logToConsole(entry);
        }

        // Storage logging
        if (this.config.enableStorage) {
            this.logToStorage(entry);
        }

        // Remote logging
        if (this.config.enableRemote) {
            this.logToRemote(entry);
        }
    }

    /**
     * Log to browser console
     */
    private logToConsole(entry: LogEntry): void {
        const timestamp = new Date(entry.timestamp).toISOString();
        const prefix = `[${timestamp}] [${LogLevel[entry.level]}] [${entry.category}]`;
        const message = `${prefix} ${entry.message}`;

        switch (entry.level) {
            case LogLevel.DEBUG:
                console.debug(message, entry.data);
                break;
            case LogLevel.INFO:
                console.info(message, entry.data);
                break;
            case LogLevel.WARN:
                console.warn(message, entry.data);
                break;
            case LogLevel.ERROR:
                console.error(message, entry.data, entry.stack);
                break;
            case LogLevel.CRITICAL:
                console.error(`🚨 CRITICAL: ${message}`, entry.data, entry.stack);
                break;
        }
    }

    /**
     * Log to local storage
     */
    private logToStorage(entry: LogEntry): void {
        this.logEntries.push(entry);

        // Maintain storage limit
        if (this.logEntries.length > this.config.maxStorageEntries) {
            this.logEntries = this.logEntries.slice(-this.config.maxStorageEntries);
        }

        // Persist critical errors to localStorage
        if (entry.level >= LogLevel.ERROR) {
            try {
                const criticalLogs = JSON.parse(localStorage.getItem('nexus_critical_logs') || '[]');
                criticalLogs.push(entry);
                
                // Keep only last 50 critical logs
                const recentCriticalLogs = criticalLogs.slice(-50);
                localStorage.setItem('nexus_critical_logs', JSON.stringify(recentCriticalLogs));
            } catch (error) {
                // Ignore localStorage errors
            }
        }
    }

    /**
     * Log to remote endpoint
     */
    private logToRemote(entry: LogEntry): void {
        this.remoteQueue.push(entry);

        // If remote is available and queue is getting large, flush immediately
        if (this.isRemoteAvailable && this.remoteQueue.length >= 10) {
            this.flushRemoteQueue();
        }
    }

    /**
     * Flush remote log queue
     */
    private async flushRemoteQueue(): Promise<void> {
        if (!this.isRemoteAvailable || this.remoteQueue.length === 0 || !this.config.remoteEndpoint) {
            return;
        }

        const logsToSend = [...this.remoteQueue];
        this.remoteQueue = [];

        try {
            await fetch(`${this.config.remoteEndpoint}/logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    logs: logsToSend,
                    source: 'nexus-client'
                })
            });
        } catch (error) {
            // Re-queue logs if sending failed
            this.remoteQueue.unshift(...logsToSend);
            this.isRemoteAvailable = false;
        }
    }

    /**
     * Get recent log entries
     */
    public getRecentLogs(count: number = 100, level?: LogLevel, category?: LogCategory): LogEntry[] {
        let filteredLogs = this.logEntries;

        if (level !== undefined) {
            filteredLogs = filteredLogs.filter(entry => entry.level >= level);
        }

        if (category !== undefined) {
            filteredLogs = filteredLogs.filter(entry => entry.category === category);
        }

        return filteredLogs.slice(-count);
    }

    /**
     * Get log statistics
     */
    public getLogStatistics(): {
        totalEntries: number;
        entriesByLevel: Record<string, number>;
        entriesByCategory: Record<string, number>;
        queuedRemoteLogs: number;
        isRemoteAvailable: boolean;
    } {
        const entriesByLevel: Record<string, number> = {};
        const entriesByCategory: Record<string, number> = {};

        for (const entry of this.logEntries) {
            const levelName = LogLevel[entry.level];
            entriesByLevel[levelName] = (entriesByLevel[levelName] || 0) + 1;
            entriesByCategory[entry.category] = (entriesByCategory[entry.category] || 0) + 1;
        }

        return {
            totalEntries: this.logEntries.length,
            entriesByLevel,
            entriesByCategory,
            queuedRemoteLogs: this.remoteQueue.length,
            isRemoteAvailable: this.isRemoteAvailable
        };
    }

    /**
     * Export logs as JSON
     */
    public exportLogs(level?: LogLevel, category?: LogCategory): string {
        const logs = this.getRecentLogs(this.logEntries.length, level, category);
        return JSON.stringify(logs, null, 2);
    }

    /**
     * Clear stored logs
     */
    public clearLogs(): void {
        this.logEntries = [];
        this.remoteQueue = [];
        
        try {
            localStorage.removeItem('nexus_critical_logs');
        } catch (error) {
            // Ignore localStorage errors
        }
    }

    /**
     * Update logger configuration
     */
    public updateConfig(config: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...config };
        
        if (config.enableRemote && config.remoteEndpoint) {
            this.initializeRemoteLogging();
        }
    }

    /**
     * Create a category-specific logger
     */
    public createCategoryLogger(category: LogCategory): CategoryLogger {
        return new CategoryLogger(this, category);
    }
}

/**
 * Category-specific logger for convenience
 */
export class CategoryLogger {
    constructor(private logger: Logger, private category: LogCategory) {}

    public debug(message: string, data?: any): void {
        this.logger.debug(this.category, message, data);
    }

    public info(message: string, data?: any): void {
        this.logger.info(this.category, message, data);
    }

    public warn(message: string, data?: any): void {
        this.logger.warn(this.category, message, data);
    }

    public error(message: string, error?: Error | any): void {
        this.logger.error(this.category, message, error);
    }

    public critical(message: string, error?: Error | any): void {
        this.logger.critical(this.category, message, error);
    }
}

// Export convenience functions
export const logger = Logger.getInstance();

export const gameEngineLogger = logger.createCategoryLogger(LogCategory.GAME_ENGINE);
export const aiLearningLogger = logger.createCategoryLogger(LogCategory.AI_LEARNING);
export const networkingLogger = logger.createCategoryLogger(LogCategory.NETWORKING);
export const performanceLogger = logger.createCategoryLogger(LogCategory.PERFORMANCE);
export const combatLogger = logger.createCategoryLogger(LogCategory.COMBAT);
export const territoryLogger = logger.createCategoryLogger(LogCategory.TERRITORY);
export const unitsLogger = logger.createCategoryLogger(LogCategory.UNITS);
export const energyLogger = logger.createCategoryLogger(LogCategory.ENERGY);
export const uiLogger = logger.createCategoryLogger(LogCategory.UI);
export const integrationLogger = logger.createCategoryLogger(LogCategory.INTEGRATION);