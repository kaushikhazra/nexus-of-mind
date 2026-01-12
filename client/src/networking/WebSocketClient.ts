/**
 * Enhanced WebSocket Client for Adaptive Queen Intelligence
 * Supports reconnection, message queuing, and error handling
 */

import { WebSocketErrorHandler, ErrorRecoveryConfig } from './WebSocketErrorHandler';
import { GracefulDegradationManager } from '../game/GracefulDegradationManager';

export interface WebSocketMessage {
    type: string;
    timestamp?: number;
    data?: any;
    messageId?: string;
    clientId?: string;
}

export interface ConnectionOptions {
    url: string;
    clientId?: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    heartbeatInterval?: number;
    messageTimeout?: number;
}

export interface ConnectionStatus {
    connected: boolean;
    reconnecting: boolean;
    reconnectAttempts: number;
    lastError?: string;
    clientId?: string;
}

export class WebSocketClient {
    private websocket: WebSocket | null = null;
    private options: Required<ConnectionOptions>;
    private status: ConnectionStatus;
    private messageQueue: WebSocketMessage[] = [];
    private pendingMessages: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private messageHandlers: Map<string, Function[]> = new Map();
    private isShuttingDown = false;
    private errorHandler: WebSocketErrorHandler;
    private degradationManager: GracefulDegradationManager;

    constructor(options: ConnectionOptions) {
        this.options = {
            url: options.url,
            clientId: options.clientId || this.generateClientId(),
            reconnectInterval: options.reconnectInterval || 5000,
            maxReconnectAttempts: options.maxReconnectAttempts || 10,
            heartbeatInterval: options.heartbeatInterval || 30000,
            messageTimeout: options.messageTimeout || 30000
        };

        this.status = {
            connected: false,
            reconnecting: false,
            reconnectAttempts: 0
        };

        // Initialize error handling and graceful degradation
        this.errorHandler = new WebSocketErrorHandler({
            maxRetryAttempts: this.options.maxReconnectAttempts,
            retryDelay: this.options.reconnectInterval,
            timeoutDuration: this.options.messageTimeout
        });

        this.degradationManager = new GracefulDegradationManager({
            enableLocalFallback: true,
            enableRuleBasedAI: true,
            enableOfflineMode: true
        });
    }

    private generateClientId(): string {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    public async connect(): Promise<void> {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                const wsUrl = this.options.clientId 
                    ? `${this.options.url}/${this.options.clientId}`
                    : this.options.url;

                this.websocket = new WebSocket(wsUrl);

                this.websocket.onopen = () => {
                    console.log(`WebSocket connected to ${wsUrl}`);
                    this.status.connected = true;
                    this.status.reconnecting = false;
                    this.status.reconnectAttempts = 0;
                    this.status.lastError = undefined;

                    // Notify degradation manager that backend is available
                    this.degradationManager.notifyBackendAvailable();

                    this.startHeartbeat();
                    this.processMessageQueue();
                    this.emit('connected', { clientId: this.options.clientId });
                    resolve();
                };

                this.websocket.onmessage = (event) => {
                    this.handleMessage(event);
                };

                this.websocket.onclose = (event) => {
                    console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
                    this.handleDisconnection();
                    
                    // Notify degradation manager
                    this.degradationManager.notifyBackendUnavailable();
                    
                    if (!this.isShuttingDown) {
                        this.attemptReconnection();
                    }
                };

                this.websocket.onerror = async (error) => {
                    console.error('WebSocket error:', error);
                    this.status.lastError = 'Connection error';
                    
                    // Use error handler for connection errors
                    try {
                        const recoveryResult = await this.errorHandler.handleConnectionError(
                            new Error('WebSocket connection error'),
                            { operation: 'connect', retryCount: this.status.reconnectAttempts }
                        );
                        
                        if (recoveryResult.success && recoveryResult.strategy === 'graceful_degradation') {
                            this.degradationManager.notifyBackendUnavailable();
                        }
                    } catch (handlerError) {
                        console.error('Error handler failed:', handlerError);
                    }
                    
                    this.emit('error', error);
                    reject(error);
                };

            } catch (error) {
                console.error('Failed to create WebSocket connection:', error);
                reject(error);
            }
        });
    }

    private async handleMessage(event: MessageEvent): Promise<void> {
        try {
            const message: WebSocketMessage = JSON.parse(event.data);
            
            // Handle system messages
            switch (message.type) {
                case 'pong':
                    this.handlePong(message);
                    break;
                case 'heartbeat':
                    this.handleHeartbeat(message);
                    break;
                case 'reconnect_confirmation':
                    this.handleReconnectConfirmation(message);
                    break;
                case 'error':
                    await this.handleServerError(message);
                    break;
                default:
                    // Handle response to pending message
                    if (message.messageId && this.pendingMessages.has(message.messageId)) {
                        const pending = this.pendingMessages.get(message.messageId)!;
                        clearTimeout(pending.timeout);
                        this.pendingMessages.delete(message.messageId);
                        pending.resolve(message);
                    }
                    
                    // Emit to registered handlers
                    this.emit(message.type, message);
                    break;
            }
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            
            // Use error handler for message parsing errors
            try {
                const recoveryResult = await this.errorHandler.handleMessageError(
                    error instanceof Error ? error : new Error('Message parsing failed'),
                    event.data,
                    { operation: 'message_parsing' }
                );
                
                if (recoveryResult.success && recoveryResult.data) {
                    // Try to emit the recovered message
                    this.emit('message_recovered', recoveryResult.data);
                }
            } catch (handlerError) {
                console.error('Message error handler failed:', handlerError);
            }
        }
    }

    private handlePong(message: WebSocketMessage): void {
        const responseTime = message.data?.responseTime || 0;
        console.log(`Pong received - Response time: ${responseTime}ms`);
        this.emit('pong', message);
    }

    private handleHeartbeat(message: WebSocketMessage): void {
        // Respond to server heartbeat
        this.send({
            type: 'heartbeat_response',
            timestamp: Date.now()
        });
    }

    private handleReconnectConfirmation(message: WebSocketMessage): void {
        console.log(`Reconnection confirmed - Queued messages: ${message.data?.queuedMessages || 0}`);
        this.emit('reconnected', message);
    }

    private async handleServerError(message: WebSocketMessage): Promise<void> {
        console.error('Server error:', message.data?.error);
        this.status.lastError = message.data?.error || 'Unknown server error';
        
        // Use error handler for server errors
        try {
            const recoveryResult = await this.errorHandler.handleConnectionError(
                new Error(message.data?.error || 'Server error'),
                { operation: 'server_error', data: message.data }
            );
            
            if (recoveryResult.success && recoveryResult.strategy === 'graceful_degradation') {
                this.degradationManager.notifyBackendUnavailable();
            }
        } catch (handlerError) {
            console.error('Server error handler failed:', handlerError);
        }
        
        this.emit('serverError', message);
    }

    private handleDisconnection(): void {
        this.status.connected = false;
        this.stopHeartbeat();
        this.emit('disconnected', { clientId: this.options.clientId });
    }

    private attemptReconnection(): void {
        if (this.status.reconnectAttempts >= this.options.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.emit('reconnectionFailed', { attempts: this.status.reconnectAttempts });
            return;
        }

        this.status.reconnecting = true;
        this.status.reconnectAttempts++;

        console.log(`Attempting reconnection ${this.status.reconnectAttempts}/${this.options.maxReconnectAttempts}`);
        this.emit('reconnecting', { attempt: this.status.reconnectAttempts });

        this.reconnectTimer = setTimeout(() => {
            this.connect().catch((error) => {
                console.error('Reconnection failed:', error);
                this.attemptReconnection();
            });
        }, this.options.reconnectInterval);
    }

    public async send(message: WebSocketMessage, expectResponse: boolean = false): Promise<WebSocketMessage | void> {
        // Add timestamp and client ID
        message.timestamp = message.timestamp || Date.now();
        message.clientId = this.options.clientId;

        if (expectResponse) {
            message.messageId = this.generateMessageId();
        }

        if (!this.status.connected || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            // Check if we should use graceful degradation
            if (message.type === 'queen_death') {
                try {
                    const fallbackResponse = await this.degradationManager.handleQueenDeath(message.data);
                    if (fallbackResponse) {
                        console.log('Using graceful degradation for Queen death processing');
                        return fallbackResponse;
                    }
                } catch (degradationError) {
                    console.error('Graceful degradation failed:', degradationError);
                }
            }
            
            // Queue message for later delivery
            this.messageQueue.push(message);
            console.log('Message queued (connection not available):', message.type);
            return;
        }

        try {
            this.websocket.send(JSON.stringify(message));

            if (expectResponse && message.messageId) {
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(async () => {
                        this.pendingMessages.delete(message.messageId!);
                        
                        // Use error handler for message timeout
                        try {
                            const recoveryResult = await this.errorHandler.handleMessageError(
                                new Error('Message timeout'),
                                message,
                                { operation: 'message_timeout' }
                            );
                            
                            if (recoveryResult.success) {
                                resolve(recoveryResult.data);
                            } else {
                                reject(new Error('Message timeout'));
                            }
                        } catch (handlerError) {
                            reject(new Error('Message timeout'));
                        }
                    }, this.options.messageTimeout);

                    this.pendingMessages.set(message.messageId!, { resolve, reject, timeout });
                });
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            
            // Use error handler for send failures
            try {
                const recoveryResult = await this.errorHandler.handleMessageError(
                    error instanceof Error ? error : new Error('Send failed'),
                    message,
                    { operation: 'message_send' }
                );
                
                if (recoveryResult.success && recoveryResult.strategy === 'message_queued') {
                    // Message was queued for retry
                    this.messageQueue.push(message);
                    return;
                }
            } catch (handlerError) {
                console.error('Send error handler failed:', handlerError);
            }
            
            // Queue message for retry
            this.messageQueue.push(message);
            throw error;
        }
    }

    private async processMessageQueue(): Promise<void> {
        if (this.messageQueue.length === 0) {
            return;
        }

        console.log(`Processing ${this.messageQueue.length} queued messages`);
        const messages = [...this.messageQueue];
        this.messageQueue = [];

        for (const message of messages) {
            try {
                await this.send(message);
            } catch (error) {
                console.error('Failed to send queued message:', error);
                // Re-queue failed message
                this.messageQueue.push(message);
            }
        }
        
        // Process any messages that were handled by error recovery
        try {
            const processResult = await this.errorHandler.processOfflineQueue();
            console.log(`Processed ${processResult.processed} offline messages, ${processResult.failed} failed`);
        } catch (error) {
            console.error('Failed to process offline queue:', error);
        }
    }

    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private startHeartbeat(): void {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            this.send({
                type: 'ping',
                timestamp: Date.now()
            });
        }, this.options.heartbeatInterval);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    public on(eventType: string, handler: Function): void {
        if (!this.messageHandlers.has(eventType)) {
            this.messageHandlers.set(eventType, []);
        }
        this.messageHandlers.get(eventType)!.push(handler);
    }

    public off(eventType: string, handler: Function): void {
        const handlers = this.messageHandlers.get(eventType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    private emit(eventType: string, data: any): void {
        const handlers = this.messageHandlers.get(eventType);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${eventType}:`, error);
                }
            });
        }
    }

    public getStatus(): ConnectionStatus {
        return { ...this.status };
    }

    public getQueuedMessageCount(): number {
        return this.messageQueue.length;
    }

    public async disconnect(): Promise<void> {
        this.isShuttingDown = true;
        
        // Clear timers
        this.stopHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Clear pending messages
        this.pendingMessages.forEach(({ reject, timeout }) => {
            clearTimeout(timeout);
            reject(new Error('Connection closed'));
        });
        this.pendingMessages.clear();

        // Close WebSocket
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        this.status.connected = false;
        this.status.reconnecting = false;
        
        // Cleanup error handler and degradation manager
        await this.errorHandler.cleanup();
        await this.degradationManager.cleanup();
    }

    // Enhanced status methods
    public getSystemHealth(): any {
        return {
            connection: this.getStatus(),
            errorHandler: this.errorHandler.getSystemHealth(),
            degradation: this.degradationManager.getDegradationInfo(),
            messageQueue: this.getQueuedMessageCount()
        };
    }

    public getErrorStatistics(): any {
        return this.errorHandler.getErrorStatistics();
    }

    public async testFallbackCapabilities(): Promise<any> {
        return await this.degradationManager.testFallbackCapabilities();
    }

    // Convenience methods for specific message types
    public async sendQueenDeath(deathData: any): Promise<WebSocketMessage> {
        return await this.send({
            type: 'queen_death',
            data: deathData
        }, true) as WebSocketMessage;
    }

    public async sendQueenSuccess(successData: any): Promise<WebSocketMessage> {
        return await this.send({
            type: 'queen_success',
            data: successData
        }, true) as WebSocketMessage;
    }

    public async requestLearningProgress(queenId: string): Promise<WebSocketMessage> {
        return await this.send({
            type: 'learning_progress_request',
            data: { queenId }
        }, true) as WebSocketMessage;
    }

    public async healthCheck(): Promise<WebSocketMessage> {
        return await this.send({
            type: 'health_check'
        }, true) as WebSocketMessage;
    }
}