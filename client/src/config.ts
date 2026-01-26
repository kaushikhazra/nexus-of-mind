/**
 * Application Configuration
 *
 * Centralizes environment-specific configuration values.
 * Uses environment variables with sensible defaults for local development.
 */

// Backend server configuration
export const BACKEND_CONFIG = {
    // WebSocket URL for real-time communication with AI backend
    WEBSOCKET_URL: process.env.WEBSOCKET_URL || 'ws://localhost:8000/ws',

    // HTTP URL for REST API calls
    HTTP_URL: process.env.BACKEND_URL || 'http://localhost:8000',

    // Health check endpoint
    HEALTH_ENDPOINT: '/health'
};

// Convenience getters
export const getWebSocketUrl = (): string => BACKEND_CONFIG.WEBSOCKET_URL;
export const getBackendUrl = (): string => BACKEND_CONFIG.HTTP_URL;
export const getHealthUrl = (): string => `${BACKEND_CONFIG.HTTP_URL}${BACKEND_CONFIG.HEALTH_ENDPOINT}`;
