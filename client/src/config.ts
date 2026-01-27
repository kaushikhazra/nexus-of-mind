/**
 * Application Configuration
 *
 * Centralizes environment-specific configuration values.
 * Detects environment based on hostname for easy deployment.
 */

// Detect if running locally
const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Backend server configuration
export const BACKEND_CONFIG = {
    // WebSocket URL for real-time communication with AI backend
    WEBSOCKET_URL: isLocalhost
        ? 'ws://localhost:8010/ws'
        : `wss://${typeof window !== 'undefined' ? window.location.host : 'localhost:8010'}/ws`,

    // HTTP URL for REST API calls
    HTTP_URL: isLocalhost
        ? 'http://localhost:8010'
        : `https://${typeof window !== 'undefined' ? window.location.host : 'localhost:8010'}`,

    // Health check endpoint
    HEALTH_ENDPOINT: '/health'
};

// Convenience getters
export const getWebSocketUrl = (): string => BACKEND_CONFIG.WEBSOCKET_URL;
export const getBackendUrl = (): string => BACKEND_CONFIG.HTTP_URL;
export const getHealthUrl = (): string => `${BACKEND_CONFIG.HTTP_URL}${BACKEND_CONFIG.HEALTH_ENDPOINT}`;
