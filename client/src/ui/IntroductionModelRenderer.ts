/**
 * IntroductionModelRenderer - 3D Model Visualization for Introduction Screen
 * 
 * Manages dedicated Babylon.js canvas and engine for rendering contextual 3D models
 * during the introduction story presentation. Each story page displays an appropriate
 * 3D model that enhances the narrative experience.
 * 
 * Requirements: 9.5, 9.6, 9.8, 9.9
 */

import { 
    Engine, 
    Scene, 
    ArcRotateCamera, 
    Vector3, 
    HemisphericLight, 
    DirectionalLight,
    Color3,
    Color4,
    AbstractMesh,
    Animation,
    AnimationGroup,
    PostProcessRenderPipeline,
    DefaultRenderingPipeline,
    Mesh,
    Material
} from '@babylonjs/core';
import { MaterialManager } from '../rendering/MaterialManager';
import { EmblemGeometry } from './components/EmblemGeometry';
import { PlanetRenderer } from './components/PlanetRenderer';
import { ParasiteRenderer, ParasiteConfig } from './components/ParasiteRenderer';
import { TerrainRenderer } from './components/TerrainRenderer';

export interface ModelConfig {
    pageIndex: number;
    modelType: 'empire-emblem' | 'desert-planet' | 'terrain-closeup' | 'energy-lords-emblem' | 'parasites' | 'orbital-system';
    containerWidth: number;
    containerHeight: number;
}

export interface ModelAnimation {
    rotationSpeed: number; // RPM (rotations per minute)
    additionalEffects?: 'pulsing' | 'writhing' | 'orbital' | 'mining-beam';
}

export interface IntroductionModelRendererConfig {
    container: HTMLElement;
    materialManager?: MaterialManager;
    enableFallbacks?: boolean;
    onError?: (error: Error, fallbackMode: boolean) => void;
    onLoadingStateChange?: (isLoading: boolean) => void;
}

export interface ErrorState {
    hasWebGLSupport: boolean;
    hasBabylonSupport: boolean;
    hasMemoryConstraints: boolean;
    isInFallbackMode: boolean;
    lastError: Error | null;
    errorCount: number;
    maxRetries: number;
}

/**
 * Page-to-model mapping configuration
 * Requirements: 9.2 - Contextually appropriate 3D models for each story page
 */
const MODEL_PAGE_MAPPING: { [pageIndex: number]: { modelType: ModelConfig['modelType'], animation: ModelAnimation } } = {
    0: { // Page 1: The Empire and the Crisis
        modelType: 'empire-emblem',
        animation: { rotationSpeed: 0.5 }
    },
    1: { // Page 2: The Discovery
        modelType: 'desert-planet',
        animation: { rotationSpeed: 0.5 }
    },
    2: { // Page 3: The Challenge
        modelType: 'terrain-closeup',
        animation: { rotationSpeed: 0.3 }
    },
    3: { // Page 4: The Energy Lords
        modelType: 'energy-lords-emblem',
        animation: { rotationSpeed: 0.5, additionalEffects: 'pulsing' }
    },
    4: { // Page 5: The Threat
        modelType: 'parasites',
        animation: { rotationSpeed: 0.4, additionalEffects: 'writhing' }
    },
    5: { // Page 6: Your Mission
        modelType: 'orbital-system',
        animation: { rotationSpeed: 0.5, additionalEffects: 'orbital' }
    }
};

/**
 * Performance optimization interfaces and classes
 * Requirements: 9.6, 9.8 - Performance optimization and efficient model loading
 */

export interface LODLevel {
    distance: number;
    mesh: AbstractMesh;
    complexity: 'high' | 'medium' | 'low';
}

export interface PerformanceMetrics {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangleCount: number;
    memoryUsage: number;
}

export interface OptimizationSettings {
    targetFPS: number;
    maxTriangles: number;
    enableLOD: boolean;
    enableCaching: boolean;
    enablePostProcessing: boolean;
    lowPerformanceThreshold: number; // FPS threshold for low performance mode
}

/**
 * Level of Detail (LOD) system for complex models
 * Requirements: 9.6, 9.8 - LOD system for performance optimization
 */
class LODSystem {
    private scene: Scene;
    private camera: ArcRotateCamera;
    private lodLevels: Map<string, LODLevel[]> = new Map();

    constructor(scene: Scene, camera: ArcRotateCamera) {
        this.scene = scene;
        this.camera = camera;
    }

    /**
     * Register LOD levels for a model type
     */
    public registerLODLevels(modelType: string, levels: LODLevel[]): void {
        // Sort levels by distance (closest first)
        levels.sort((a, b) => a.distance - b.distance);
        this.lodLevels.set(modelType, levels);
    }

    /**
     * Get appropriate LOD level based on camera distance
     */
    public getLODLevel(modelType: string, targetPosition: Vector3): LODLevel | null {
        const levels = this.lodLevels.get(modelType);
        if (!levels || levels.length === 0) return null;

        const cameraDistance = Vector3.Distance(this.camera.position, targetPosition);
        
        // Find appropriate LOD level
        for (const level of levels) {
            if (cameraDistance <= level.distance) {
                return level;
            }
        }
        
        // Return lowest quality level if beyond all distances
        return levels[levels.length - 1];
    }

    /**
     * Create LOD levels for a base mesh
     */
    public createLODLevels(baseMesh: AbstractMesh, modelType: string): LODLevel[] {
        const levels: LODLevel[] = [];
        
        // High detail (close up)
        levels.push({
            distance: 8,
            mesh: baseMesh,
            complexity: 'high'
        });
        
        // Medium detail (normal viewing distance)
        const mediumMesh = this.createReducedMesh(baseMesh, 0.6, `${modelType}_medium`);
        levels.push({
            distance: 12,
            mesh: mediumMesh,
            complexity: 'medium'
        });
        
        // Low detail (far away)
        const lowMesh = this.createReducedMesh(baseMesh, 0.3, `${modelType}_low`);
        levels.push({
            distance: 20,
            mesh: lowMesh,
            complexity: 'low'
        });
        
        return levels;
    }

    /**
     * Create a reduced complexity version of a mesh
     */
    private createReducedMesh(originalMesh: AbstractMesh, complexityFactor: number, name: string): AbstractMesh {
        // For simple models, just reduce segments/tessellation
        if (originalMesh instanceof Mesh) {
            // Create simplified version with reduced vertex count
            const simplifiedMesh = originalMesh.clone(name, null, false);
            if (simplifiedMesh) {
                // Reduce scaling slightly for simpler appearance
                simplifiedMesh.scaling = originalMesh.scaling.scale(complexityFactor);
                return simplifiedMesh;
            }
        }
        
        // Fallback: return clone with reduced scaling
        const clonedMesh = originalMesh.clone(name, null, false);
        return clonedMesh || originalMesh;
    }

    public dispose(): void {
        this.lodLevels.clear();
    }
}

/**
 * Performance monitoring system
 * Requirements: 9.6 - Ensure 60fps performance across all model types
 */
class PerformanceMonitor {
    private scene: Scene;
    private engine: Engine;
    private metrics: PerformanceMetrics = {
        fps: 60,
        frameTime: 16.67,
        drawCalls: 0,
        triangleCount: 0,
        memoryUsage: 0
    };
    private frameTimeHistory: number[] = [];
    private maxHistoryLength: number = 60; // 1 second at 60fps
    private onPerformanceChange?: (isLowPerformance: boolean) => void;

    constructor(scene: Scene, engine: Engine) {
        this.scene = scene;
        this.engine = engine;
        this.startMonitoring();
    }

    /**
     * Start performance monitoring
     */
    private startMonitoring(): void {
        this.scene.registerBeforeRender(() => {
            this.updateMetrics();
        });
    }

    /**
     * Update performance metrics
     */
    private updateMetrics(): void {
        // Update FPS and frame time
        this.metrics.fps = this.engine.getFps();
        this.metrics.frameTime = 1000 / this.metrics.fps;
        
        // Track frame time history
        this.frameTimeHistory.push(this.metrics.frameTime);
        if (this.frameTimeHistory.length > this.maxHistoryLength) {
            this.frameTimeHistory.shift();
        }
        
        // Update draw calls and triangle count
        this.metrics.drawCalls = this.scene.getActiveMeshes().length;
        this.metrics.triangleCount = this.getTotalTriangleCount();
        
        // Estimate memory usage (rough approximation)
        this.metrics.memoryUsage = this.estimateMemoryUsage();
    }

    /**
     * Get total triangle count in scene
     */
    private getTotalTriangleCount(): number {
        let totalTriangles = 0;
        this.scene.meshes.forEach(mesh => {
            if (mesh instanceof Mesh) {
                const indices = mesh.getIndices();
                if (indices) {
                    totalTriangles += indices.length / 3;
                }
            }
        });
        return totalTriangles;
    }

    /**
     * Estimate memory usage (rough approximation)
     */
    private estimateMemoryUsage(): number {
        // Rough estimation based on mesh count and texture count
        const meshCount = this.scene.meshes.length;
        const materialCount = this.scene.materials.length;
        const textureCount = this.scene.textures.length;
        
        // Rough estimates in MB
        return (meshCount * 0.1) + (materialCount * 0.05) + (textureCount * 0.5);
    }

    /**
     * Get current performance metrics
     */
    public getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    /**
     * Check if performance is below threshold
     */
    public isLowPerformance(threshold: number = 45): boolean {
        if (this.frameTimeHistory.length < 30) return false; // Need enough samples
        
        // Calculate average FPS over recent frames
        const avgFrameTime = this.frameTimeHistory.reduce((sum, time) => sum + time, 0) / this.frameTimeHistory.length;
        const avgFPS = 1000 / avgFrameTime;
        
        return avgFPS < threshold;
    }

    /**
     * Set callback for performance changes
     */
    public onPerformanceChangeCallback(callback: (isLowPerformance: boolean) => void): void {
        this.onPerformanceChange = callback;
    }

    public dispose(): void {
        this.frameTimeHistory = [];
        this.onPerformanceChange = undefined;
    }
}

export class IntroductionModelRenderer {
    private container: HTMLElement;
    private canvas: HTMLCanvasElement | null = null;
    private engine: Engine | null = null;
    private scene: Scene | null = null;
    private camera: ArcRotateCamera | null = null;
    private materialManager: MaterialManager | null = null;
    private renderingPipeline: DefaultRenderingPipeline | null = null;
    
    // Current model state
    private currentModel: AbstractMesh | null = null;
    private currentAnimationGroup: AnimationGroup | null = null;
    private currentPageIndex: number = -1;
    private isDisposed: boolean = false;
    
    // Component helpers
    private emblemGeometry: EmblemGeometry | null = null;
    private planetRenderer: PlanetRenderer | null = null;
    private parasiteRenderer: ParasiteRenderer | null = null;
    private terrainRenderer: TerrainRenderer | null = null;
    
    // Lighting
    private hemisphericLight: HemisphericLight | null = null;
    private directionalLight: DirectionalLight | null = null;

    // Performance optimization properties
    private modelCache: Map<string, AbstractMesh> = new Map(); // Model caching for reuse
    private materialCache: Map<string, Material> = new Map(); // Material instance reuse
    private lodSystem: LODSystem | null = null; // Level of Detail system
    private performanceMonitor: PerformanceMonitor | null = null; // Performance monitoring
    private isLowPerformanceMode: boolean = false; // Fallback mode for low-end devices

    // Error handling and fallback properties
    private config: IntroductionModelRendererConfig;
    private errorState: ErrorState;
    private isInTextOnlyMode: boolean = false;
    private loadingStateElement: HTMLElement | null = null;
    private retryCount: number = 0;

    constructor(config: IntroductionModelRendererConfig) {
        this.config = {
            enableFallbacks: true,
            ...config
        };
        this.container = config.container;
        this.materialManager = config.materialManager || null;
        
        // Initialize error state
        this.errorState = {
            hasWebGLSupport: this.checkWebGLSupport(),
            hasBabylonSupport: true, // Will be checked during initialization
            hasMemoryConstraints: false,
            isInFallbackMode: false,
            lastError: null,
            errorCount: 0,
            maxRetries: 3
        };
        
        this.initialize();
    }

    /**
     * Check WebGL support before attempting to initialize Babylon.js
     * Requirements: 9.6, 9.8 - Graceful fallbacks for WebGL initialization failures
     */
    private checkWebGLSupport(): boolean {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            const hasWebGL = !!gl;
            
            if (hasWebGL && gl) {
                // Cast to WebGLRenderingContext for proper typing
                const webglContext = gl as WebGLRenderingContext;
                
                // Check for required WebGL extensions
                const requiredExtensions = ['OES_texture_float', 'OES_element_index_uint'];
                const hasRequiredExtensions = requiredExtensions.every(ext => 
                    webglContext.getExtension(ext) !== null
                );
                
                // Check WebGL capabilities
                const maxTextureSize = webglContext.getParameter(webglContext.MAX_TEXTURE_SIZE);
                const maxVertexAttribs = webglContext.getParameter(webglContext.MAX_VERTEX_ATTRIBS);
                
                console.log('WebGL Support Check:', {
                    hasWebGL,
                    hasRequiredExtensions,
                    maxTextureSize,
                    maxVertexAttribs
                });
                
                return hasWebGL && maxTextureSize >= 1024 && maxVertexAttribs >= 8;
            }
            
            return false;
        } catch (error) {
            console.warn('WebGL support check failed:', error);
            return false;
        }
    }

    /**
     * Check memory constraints and available resources
     * Requirements: 9.8 - Handle memory constraints and cleanup edge cases
     */
    private checkMemoryConstraints(): boolean {
        try {
            // Check available memory (if supported)
            if ('memory' in performance && (performance as any).memory) {
                const memory = (performance as any).memory;
                const usedMemory = memory.usedJSHeapSize;
                const totalMemory = memory.totalJSHeapSize;
                const memoryLimit = memory.jsHeapSizeLimit;
                
                const memoryUsageRatio = usedMemory / memoryLimit;
                const hasMemoryConstraints = memoryUsageRatio > 0.8; // 80% memory usage threshold
                
                console.log('Memory Check:', {
                    usedMemory: Math.round(usedMemory / 1024 / 1024) + 'MB',
                    totalMemory: Math.round(totalMemory / 1024 / 1024) + 'MB',
                    memoryLimit: Math.round(memoryLimit / 1024 / 1024) + 'MB',
                    memoryUsageRatio: Math.round(memoryUsageRatio * 100) + '%',
                    hasMemoryConstraints
                });
                
                return hasMemoryConstraints;
            }
            
            // Fallback: assume no memory constraints if API not available
            return false;
        } catch (error) {
            console.warn('Memory constraint check failed:', error);
            return false;
        }
    }

    /**
     * Show loading state in the container
     * Requirements: 9.8 - Implement loading states for model failures
     */
    private showLoadingState(message: string = 'Loading 3D Model...'): void {
        if (this.config.onLoadingStateChange) {
            this.config.onLoadingStateChange(true);
        }

        this.loadingStateElement = document.createElement('div');
        this.loadingStateElement.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.7);
            color: rgba(0, 255, 255, 0.8);
            font-family: 'Orbitron', monospace;
            font-size: 12px;
            text-align: center;
            z-index: 1000;
        `;
        
        this.loadingStateElement.innerHTML = `
            <div style="margin-bottom: 15px;">
                <div style="
                    width: 30px;
                    height: 30px;
                    border: 2px solid rgba(0, 255, 255, 0.3);
                    border-top: 2px solid rgba(0, 255, 255, 0.8);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 10px auto;
                "></div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </div>
            <div>${message}</div>
        `;
        
        this.container.appendChild(this.loadingStateElement);
    }

    /**
     * Hide loading state
     */
    private hideLoadingState(): void {
        if (this.config.onLoadingStateChange) {
            this.config.onLoadingStateChange(false);
        }

        if (this.loadingStateElement && this.loadingStateElement.parentNode) {
            this.loadingStateElement.parentNode.removeChild(this.loadingStateElement);
            this.loadingStateElement = null;
        }
    }

    /**
     * Show text-only fallback mode when 3D rendering fails
     * Requirements: 9.8 - Add fallback to text-only mode if 3D rendering fails
     */
    private showTextOnlyMode(pageIndex: number): void {
        this.isInTextOnlyMode = true;
        this.errorState.isInFallbackMode = true;
        
        const modelDescriptions = [
            'Korenthi Empire Emblem - A hexagonal symbol with neon cyan glow representing the ancient empire',
            'Desert Planet - A barren world rich in radioactive minerals, shrouded in toxic atmosphere',
            'Mining Terrain - Close-up view of crystalline mineral deposits glowing with energy',
            'Energy Lords Emblem - Guild symbol combining cyan and gold elements representing mastery over energy',
            'Parasitic Organisms - Dark organic forms with pulsing red veins, writhing with alien intelligence',
            'Orbital Mining System - Automated ships harvesting resources from planetary orbit'
        ];
        
        const description = modelDescriptions[pageIndex] || 'Interactive 3D Model';
        
        this.container.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                padding: 20px;
                color: rgba(200, 220, 255, 0.9);
                font-family: 'Orbitron', monospace;
                font-size: 11px;
                text-align: center;
                line-height: 1.6;
                background: linear-gradient(135deg, rgba(0, 20, 40, 0.8), rgba(0, 40, 60, 0.6));
                border: 1px solid rgba(0, 255, 255, 0.3);
                border-radius: 4px;
                box-shadow: inset 0 0 20px rgba(0, 255, 255, 0.1);
            ">
                <div style="
                    width: 60px;
                    height: 60px;
                    border: 2px solid rgba(0, 255, 255, 0.5);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 15px;
                    font-size: 24px;
                    background: rgba(0, 255, 255, 0.1);
                ">
                    🎮
                </div>
                <div style="
                    font-size: 10px;
                    color: rgba(0, 255, 255, 0.8);
                    margin-bottom: 10px;
                    font-weight: bold;
                ">
                    3D MODEL DESCRIPTION
                </div>
                <div style="
                    max-width: 250px;
                    margin-bottom: 10px;
                ">
                    ${description}
                </div>
                <div style="
                    font-size: 9px;
                    color: rgba(255, 255, 255, 0.5);
                    font-style: italic;
                ">
                    3D rendering unavailable - using text description
                </div>
            </div>
        `;
        
        console.log(`Switched to text-only mode for page ${pageIndex + 1}`);
    }
    /**
     * Initialize the dedicated Babylon.js canvas and engine for 300px model area
     * Requirements: 9.5, 9.6 - Dedicated Babylon.js canvas and engine initialization with performance optimization
     * Requirements: 9.6, 9.8 - Graceful fallbacks for WebGL/Babylon.js initialization failures
     */
    private initialize(): void {
        try {
            // Check WebGL support first
            if (!this.errorState.hasWebGLSupport) {
                throw new Error('WebGL is not supported or has insufficient capabilities');
            }

            // Check memory constraints
            this.errorState.hasMemoryConstraints = this.checkMemoryConstraints();
            if (this.errorState.hasMemoryConstraints) {
                console.warn('Memory constraints detected, enabling low performance mode');
                this.isLowPerformanceMode = true;
            }

            // Show loading state
            this.showLoadingState('Initializing 3D Renderer...');

            // Create dedicated canvas for model rendering
            this.canvas = document.createElement('canvas');
            this.canvas.style.cssText = `
                width: 100%;
                height: 100%;
                display: block;
                outline: none;
                touch-action: none;
            `;
            this.canvas.width = 300;
            this.canvas.height = 400;
            
            // Clear container and add canvas
            this.container.innerHTML = '';
            this.container.appendChild(this.canvas);
            
            // Initialize Babylon.js engine with optimized settings for performance
            const engineOptions = {
                preserveDrawingBuffer: false, // Optimize for performance
                stencil: false,
                antialias: !this.isLowPerformanceMode, // Disable antialiasing in low performance mode
                alpha: false,
                premultipliedAlpha: false,
                powerPreference: 'high-performance' as WebGLPowerPreference,
                doNotHandleContextLost: true, // Let main game handle context loss
                adaptToDeviceRatio: false, // Disable for consistent performance
                audioEngine: false // Disable audio engine for performance
            };

            this.engine = new Engine(this.canvas, true, engineOptions);

            if (!this.engine) {
                throw new Error('Failed to create Babylon.js engine for IntroductionModelRenderer');
            }

            // Test Babylon.js functionality
            this.errorState.hasBabylonSupport = this.testBabylonSupport();
            if (!this.errorState.hasBabylonSupport) {
                throw new Error('Babylon.js functionality test failed');
            }

            // Create scene
            this.createScene();
            
            // Setup camera, lighting, and post-processing
            this.setupCamera();
            this.setupLighting();
            
            // Setup post-processing only if not in low performance mode
            if (!this.isLowPerformanceMode) {
                this.setupPostProcessing();
            }
            
            // Initialize performance optimization systems
            this.initializePerformanceOptimizations();
            
            // Start render loop
            this.startRenderLoop();
            
            // Hide loading state
            this.hideLoadingState();
            
            console.log('IntroductionModelRenderer initialized successfully with performance optimizations');
            
        } catch (error) {
            this.handleInitializationError(error as Error);
        }
    }

    /**
     * Test Babylon.js functionality to ensure it works properly
     * Requirements: 9.6, 9.8 - Test Babylon.js functionality before proceeding
     */
    private testBabylonSupport(): boolean {
        try {
            if (!this.engine) return false;

            // Test basic scene creation
            const testScene = new Scene(this.engine);
            if (!testScene) return false;

            // Test basic mesh creation
            const testMesh = Mesh.CreateBox('test', 1, testScene);
            if (!testMesh) return false;

            // Test basic material creation
            const testMaterial = this.materialManager?.createCustomMaterial(
                'test_material',
                new Color3(1, 1, 1),
                {}
            );

            // Cleanup test objects
            testMesh.dispose();
            if (testMaterial) testMaterial.dispose();
            testScene.dispose();

            return true;
        } catch (error) {
            console.warn('Babylon.js functionality test failed:', error);
            return false;
        }
    }

    /**
     * Handle initialization errors with appropriate fallbacks
     * Requirements: 9.6, 9.8 - Error handling and fallbacks for initialization failures
     */
    private handleInitializationError(error: Error): void {
        this.errorState.lastError = error;
        this.errorState.errorCount++;
        
        console.error('IntroductionModelRenderer initialization failed:', error);
        
        // Hide loading state
        this.hideLoadingState();
        
        // Notify parent component of error
        if (this.config.onError) {
            this.config.onError(error, true);
        }

        // Determine fallback strategy based on error type
        if (this.shouldRetryInitialization()) {
            this.retryInitialization();
        } else {
            this.enterFallbackMode(error);
        }
    }

    /**
     * Determine if initialization should be retried
     * Requirements: 9.8 - Retry logic for transient failures
     */
    private shouldRetryInitialization(): boolean {
        return this.retryCount < this.errorState.maxRetries && 
               this.errorState.hasWebGLSupport && 
               !this.errorState.hasMemoryConstraints;
    }

    /**
     * Retry initialization with reduced settings
     * Requirements: 9.8 - Retry with fallback settings
     */
    private retryInitialization(): void {
        this.retryCount++;
        console.log(`Retrying initialization (attempt ${this.retryCount}/${this.errorState.maxRetries})`);
        
        // Enable low performance mode for retry
        this.isLowPerformanceMode = true;
        
        // Wait a bit before retrying
        setTimeout(() => {
            this.initialize();
        }, 1000);
    }

    /**
     * Enter fallback mode when initialization fails
     * Requirements: 9.8 - Fallback to text-only mode if 3D rendering fails
     */
    private enterFallbackMode(error: Error): void {
        console.warn('Entering fallback mode due to initialization failure:', error.message);
        
        this.errorState.isInFallbackMode = true;
        this.isInTextOnlyMode = true;
        
        // Show error message with fallback information
        this.showFallbackErrorMessage(error);
    }

    /**
     * Show fallback error message
     * Requirements: 9.8 - Error messages for model failures
     */
    private showFallbackErrorMessage(error: Error): void {
        const errorType = this.determineErrorType(error);
        const errorMessage = this.getErrorMessage(errorType);
        
        this.container.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: rgba(255, 200, 100, 0.9);
                font-family: 'Orbitron', monospace;
                font-size: 11px;
                text-align: center;
                padding: 20px;
                background: linear-gradient(135deg, rgba(40, 20, 0, 0.8), rgba(60, 30, 0, 0.6));
                border: 1px solid rgba(255, 200, 100, 0.3);
                border-radius: 4px;
                box-shadow: inset 0 0 20px rgba(255, 200, 100, 0.1);
            ">
                <div style="
                    width: 50px;
                    height: 50px;
                    border: 2px solid rgba(255, 200, 100, 0.5);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 15px;
                    font-size: 20px;
                    background: rgba(255, 200, 100, 0.1);
                ">
                    ⚠️
                </div>
                <div style="
                    font-size: 10px;
                    color: rgba(255, 200, 100, 0.8);
                    margin-bottom: 10px;
                    font-weight: bold;
                ">
                    3D RENDERING UNAVAILABLE
                </div>
                <div style="
                    max-width: 250px;
                    margin-bottom: 15px;
                    line-height: 1.4;
                ">
                    ${errorMessage}
                </div>
                <div style="
                    font-size: 9px;
                    color: rgba(255, 255, 255, 0.6);
                    font-style: italic;
                ">
                    Story content will continue with text descriptions
                </div>
            </div>
        `;
    }

    /**
     * Determine error type for appropriate messaging
     */
    private determineErrorType(error: Error): string {
        const message = error.message.toLowerCase();
        
        if (message.includes('webgl')) {
            return 'webgl';
        } else if (message.includes('memory') || message.includes('out of memory')) {
            return 'memory';
        } else if (message.includes('babylon')) {
            return 'babylon';
        } else {
            return 'unknown';
        }
    }

    /**
     * Get user-friendly error message based on error type
     */
    private getErrorMessage(errorType: string): string {
        switch (errorType) {
            case 'webgl':
                return 'Your browser or device does not support WebGL, which is required for 3D graphics. Please try updating your browser or enabling hardware acceleration.';
            case 'memory':
                return 'Insufficient memory available for 3D rendering. Try closing other browser tabs or applications to free up memory.';
            case 'babylon':
                return 'The 3D graphics engine could not be initialized. This may be due to browser compatibility issues or graphics driver problems.';
            default:
                return 'An unexpected error occurred while initializing 3D graphics. The introduction will continue with text descriptions instead.';
        }
    }

    /**
     * Initialize performance optimization systems
     * Requirements: 9.6, 9.8 - Performance optimization and efficient model loading
     */
    private initializePerformanceOptimizations(): void {
        if (!this.scene || !this.camera || !this.engine) return;

        // Initialize LOD system
        this.lodSystem = new LODSystem(this.scene, this.camera);
        
        // Initialize performance monitor
        this.performanceMonitor = new PerformanceMonitor(this.scene, this.engine);
        
        // Set up performance monitoring callback
        this.performanceMonitor.onPerformanceChangeCallback((isLowPerformance: boolean) => {
            if (isLowPerformance !== this.isLowPerformanceMode) {
                this.isLowPerformanceMode = isLowPerformance;
                this.handlePerformanceModeChange(isLowPerformance);
            }
        });

        // Initialize material cache with common materials
        this.initializeMaterialCache();
        
        console.log('Performance optimization systems initialized');
    }

    /**
     * Initialize material cache with reusable materials
     * Requirements: 9.8 - Optimize material instances and texture reuse
     */
    private initializeMaterialCache(): void {
        if (!this.materialManager) return;

        // Pre-create commonly used materials for reuse
        const commonMaterials = [
            'cyan_glow',
            'gold_glow', 
            'red_organic',
            'desert_planet',
            'metallic_ship',
            'energy_beam'
        ];

        commonMaterials.forEach(materialType => {
            const material = this.createOptimizedMaterial(materialType);
            if (material) {
                this.materialCache.set(materialType, material);
            }
        });
    }

    /**
     * Create optimized material with texture reuse
     */
    private createOptimizedMaterial(materialType: string): Material | null {
        if (!this.materialManager) return null;

        switch (materialType) {
            case 'cyan_glow':
                return this.materialManager.createCustomMaterial(
                    'cached_cyan_glow',
                    new Color3(0, 1, 1),
                    { emissive: new Color3(0, 0.5, 0.6) }
                );
            case 'gold_glow':
                return this.materialManager.createCustomMaterial(
                    'cached_gold_glow',
                    new Color3(1, 0.8, 0),
                    { emissive: new Color3(0.5, 0.4, 0) }
                );
            case 'red_organic':
                return this.materialManager.createCustomMaterial(
                    'cached_red_organic',
                    new Color3(0.15, 0.08, 0.12),
                    { emissive: new Color3(0.05, 0.02, 0.08) }
                );
            case 'desert_planet':
                return this.materialManager.createCustomMaterial(
                    'cached_desert_planet',
                    this.materialManager.getColorPalette().terrain.desert,
                    { emissive: new Color3(0.1, 0.08, 0.04) }
                );
            case 'metallic_ship':
                return this.materialManager.createCustomMaterial(
                    'cached_metallic_ship',
                    new Color3(0.6, 0.6, 0.7),
                    { emissive: new Color3(0.05, 0.05, 0.1) }
                );
            case 'energy_beam':
                return this.materialManager.createCustomMaterial(
                    'cached_energy_beam',
                    new Color3(0.2, 0.8, 1.0),
                    { emissive: new Color3(0.1, 0.4, 0.6), transparent: true, alpha: 0.7 }
                );
            default:
                return null;
        }
    }

    /**
     * Handle performance mode changes
     */
    private handlePerformanceModeChange(isLowPerformance: boolean): void {
        console.log(`Performance mode changed: ${isLowPerformance ? 'Low' : 'Normal'} performance`);
        
        if (isLowPerformance) {
            // Reduce quality for better performance
            this.enableLowPerformanceMode();
        } else {
            // Restore normal quality
            this.disableLowPerformanceMode();
        }
    }

    /**
     * Enable low performance mode optimizations
     */
    private enableLowPerformanceMode(): void {
        // Disable post-processing for better performance
        if (this.renderingPipeline) {
            this.renderingPipeline.bloomEnabled = false;
            this.renderingPipeline.fxaaEnabled = false;
        }
        
        // Reduce lighting quality
        if (this.hemisphericLight) {
            this.hemisphericLight.intensity *= 0.8;
        }
        if (this.directionalLight) {
            this.directionalLight.intensity *= 0.8;
        }
        
        // Use lower quality models if available
        if (this.currentModel && this.lodSystem) {
            const lodLevel = this.lodSystem.getLODLevel(
                MODEL_PAGE_MAPPING[this.currentPageIndex]?.modelType || 'default',
                Vector3.Zero()
            );
            if (lodLevel && lodLevel.complexity !== 'high') {
                this.switchToLODModel(lodLevel);
            }
        }
    }

    /**
     * Disable low performance mode (restore normal quality)
     */
    private disableLowPerformanceMode(): void {
        // Re-enable post-processing
        if (this.renderingPipeline) {
            this.renderingPipeline.bloomEnabled = true;
            this.renderingPipeline.fxaaEnabled = true;
        }
        
        // Restore lighting quality
        if (this.hemisphericLight) {
            this.hemisphericLight.intensity /= 0.8;
        }
        if (this.directionalLight) {
            this.directionalLight.intensity /= 0.8;
        }
        
        // Use high quality models
        if (this.currentModel && this.lodSystem) {
            const lodLevel = this.lodSystem.getLODLevel(
                MODEL_PAGE_MAPPING[this.currentPageIndex]?.modelType || 'default',
                Vector3.Zero()
            );
            if (lodLevel && lodLevel.complexity === 'high') {
                this.switchToLODModel(lodLevel);
            }
        }
    }

    /**
     * Switch to appropriate LOD model
     */
    private switchToLODModel(lodLevel: LODLevel): void {
        if (!this.currentModel || !this.scene) return;
        
        // Hide current model
        this.currentModel.setEnabled(false);
        
        // Show LOD model
        lodLevel.mesh.setEnabled(true);
        lodLevel.mesh.position = this.currentModel.position.clone();
        lodLevel.mesh.rotation = this.currentModel.rotation.clone();
        lodLevel.mesh.scaling = this.currentModel.scaling.clone();
        
        // Update current model reference
        this.currentModel = lodLevel.mesh;
    }
    private createScene(): void {
        if (!this.engine) {
            throw new Error('Engine not initialized');
        }

        this.scene = new Scene(this.engine);
        
        // Configure scene for SciFi aesthetic - match rgba(0, 10, 20)
        this.scene.clearColor = new Color4(0, 10/255, 20/255, 1.0);

        // Disable fog to keep background clean
        this.scene.fogMode = Scene.FOGMODE_NONE;
        
        // Optimize for performance
        this.scene.skipPointerMovePicking = true;
        this.scene.skipPointerDownPicking = true;
        this.scene.skipPointerUpPicking = true;
        
        // Create material manager if not provided
        if (!this.materialManager && this.scene) {
            this.materialManager = new MaterialManager(this.scene);
        }

        // Initialize component helpers
        if (this.scene && this.materialManager) {
            this.emblemGeometry = new EmblemGeometry(this.scene, this.materialManager);
            this.planetRenderer = new PlanetRenderer(this.scene, this.materialManager);
            this.parasiteRenderer = new ParasiteRenderer(this.scene, this.materialManager);
            this.terrainRenderer = new TerrainRenderer(this.scene, this.materialManager);
        }
    }

    /**
     * Setup camera with proper positioning for model viewing
     * Requirements: 9.5 - Camera setup for model viewing
     */
    private setupCamera(): void {
        if (!this.scene) return;

        // Create arc rotate camera for 360-degree model viewing
        this.camera = new ArcRotateCamera(
            'introModelCamera',
            -Math.PI / 2, // Alpha (horizontal rotation)
            Math.PI / 2,  // Beta - straight on (horizontal view)
            12,           // Radius (distance from target) - zoomed out
            Vector3.Zero(), // Target (center of scene)
            this.scene
        );

        // Configure camera limits and behavior
        this.camera.lowerBetaLimit = Math.PI / 6;   // Prevent camera from going too low
        this.camera.upperBetaLimit = Math.PI / 2;   // Prevent camera from going too high
        this.camera.lowerRadiusLimit = 4;           // Minimum zoom distance
        this.camera.upperRadiusLimit = 15;          // Maximum zoom distance
        
        // Disable user controls (models will rotate automatically)
        this.camera.attachControl(this.canvas, false);
        
        // Set camera as active
        this.scene.activeCamera = this.camera;
    }

    /**
     * Setup lighting with post-processing pipeline for enhanced visual appeal
     * Requirements: 9.5, 9.10 - Lighting and post-processing effects
     */
    private setupLighting(): void {
        if (!this.scene) return;

        // Hemispheric light for strong ambient illumination
        this.hemisphericLight = new HemisphericLight(
            'introHemisphericLight',
            new Vector3(0, 1, 0),
            this.scene
        );
        this.hemisphericLight.intensity = 1.2;
        this.hemisphericLight.diffuse = new Color3(1.0, 1.0, 1.0);
        this.hemisphericLight.specular = new Color3(0.8, 0.8, 0.8);
        this.hemisphericLight.groundColor = new Color3(0.4, 0.4, 0.5); // Fill from below

        // Directional light for highlights
        this.directionalLight = new DirectionalLight(
            'introDirectionalLight',
            new Vector3(-1, -1, -0.5),
            this.scene
        );
        this.directionalLight.intensity = 1.5;
        this.directionalLight.diffuse = new Color3(1.0, 1.0, 1.0);
        this.directionalLight.specular = new Color3(1.0, 1.0, 1.0);

        // Strong front light to illuminate the face
        const frontLight = new DirectionalLight(
            'introFrontLight',
            new Vector3(0, 0, 1),  // From front (camera direction)
            this.scene
        );
        frontLight.intensity = 2.0;
        frontLight.diffuse = new Color3(1.0, 1.0, 1.0);
        frontLight.specular = new Color3(1.0, 1.0, 1.0);
    }

    /**
     * Setup post-processing pipeline for bloom effects and atmospheric glow
     * Requirements: 9.10 - Post-processing effects for visual enhancement
     */
    private setupPostProcessing(): void {
        if (!this.scene || !this.camera) return;

        try {
            // Create default rendering pipeline for bloom and other effects
            this.renderingPipeline = new DefaultRenderingPipeline(
                'introRenderingPipeline',
                true, // HDR enabled
                this.scene,
                [this.camera]
            );

            // Disable all post-processing effects to avoid edge artifacts
            this.renderingPipeline.bloomEnabled = false;
            this.renderingPipeline.imageProcessingEnabled = false;
            this.renderingPipeline.fxaaEnabled = false;

        } catch (error) {
            console.warn('Post-processing setup failed, continuing without effects:', error);
        }
    }

    /**
     * Start the render loop for continuous model rendering
     * Requirements: 9.6 - Maintain 60fps performance
     */
    private startRenderLoop(): void {
        if (!this.engine || !this.scene) return;

        this.engine.runRenderLoop(() => {
            if (this.scene && !this.isDisposed) {
                this.scene.render();
            }
        });

        // Handle canvas resize
        window.addEventListener('resize', () => {
            if (this.engine && !this.isDisposed) {
                this.engine.resize();
            }
        });
    }

    /**
     * Load and display model for the specified page with performance optimizations
     * Requirements: 9.8 - Efficient model loading for current page only with caching
     * Requirements: 9.8 - Error handling and fallbacks for model loading failures
     */
    public async loadModelForPage(pageIndex: number): Promise<void> {
        if (this.isDisposed) {
            console.warn('Cannot load model: renderer is disposed');
            return;
        }

        // If in text-only mode, show text description instead
        if (this.isInTextOnlyMode || this.errorState.isInFallbackMode) {
            this.showTextOnlyMode(pageIndex);
            return;
        }

        if (!this.scene || !this.materialManager) {
            console.warn('Cannot load model: renderer is not properly initialized');
            this.showTextOnlyMode(pageIndex);
            return;
        }

        // Skip if already showing this page's model
        if (this.currentPageIndex === pageIndex && this.currentModel) {
            return;
        }

        try {
            // Show loading state
            this.showLoadingState(`Loading 3D Model for Page ${pageIndex + 1}...`);

            // Clear current model
            this.clearCurrentModel();

            // Get model configuration for this page
            const modelConfig = MODEL_PAGE_MAPPING[pageIndex];
            if (!modelConfig) {
                throw new Error(`No model configuration found for page ${pageIndex}`);
            }

            // Check cache first for efficient loading
            const cacheKey = `${modelConfig.modelType}_${pageIndex}`;
            let model: AbstractMesh | null = this.modelCache.get(cacheKey) || null;
            
            if (model && !model.isDisposed()) {
                // Use cached model
                console.log(`Using cached model for page ${pageIndex}: ${modelConfig.modelType}`);
                model.setEnabled(true);
                this.currentModel = model;
            } else {
                // Create new model with performance considerations
                model = await this.createOptimizedModelByType(modelConfig.modelType, pageIndex);
                if (!model) {
                    throw new Error(`Failed to create model of type: ${modelConfig.modelType}`);
                }
                
                // Cache the model for future use
                this.modelCache.set(cacheKey, model);
                this.currentModel = model;
            }

            // Set current page
            this.currentPageIndex = pageIndex;

            // Apply LOD system if available
            if (this.lodSystem && this.camera) {
                const lodLevels = this.lodSystem.createLODLevels(model, modelConfig.modelType);
                this.lodSystem.registerLODLevels(modelConfig.modelType, lodLevels);
                
                // Use appropriate LOD level based on performance mode
                const targetLOD = this.isLowPerformanceMode ? 
                    lodLevels.find(l => l.complexity === 'medium') || lodLevels[0] :
                    lodLevels[0]; // Use highest quality in normal mode
                
                if (targetLOD && targetLOD.mesh !== model) {
                    this.switchToLODModel(targetLOD);
                }
            }

            // Setup animation with performance considerations
            this.setupOptimizedModelAnimation(this.currentModel, modelConfig.animation);

            // Start animation
            this.startAnimation();

            // Hide loading state
            this.hideLoadingState();

            console.log(`Loaded optimized model for page ${pageIndex}: ${modelConfig.modelType}`);

        } catch (error) {
            this.handleModelLoadingError(error as Error, pageIndex);
        }
    }

    /**
     * Handle model loading errors with appropriate fallbacks
     * Requirements: 9.8 - Error handling for model loading failures
     */
    private handleModelLoadingError(error: Error, pageIndex: number): void {
        console.error(`Failed to load model for page ${pageIndex}:`, error);
        
        // Hide loading state
        this.hideLoadingState();
        
        // Update error state
        this.errorState.lastError = error;
        this.errorState.errorCount++;
        
        // Notify parent component
        if (this.config.onError) {
            this.config.onError(error, false);
        }

        // Check if we should retry or fallback
        if (this.shouldRetryModelLoading(error)) {
            this.retryModelLoading(pageIndex);
        } else {
            // Fallback to text-only mode for this model
            console.warn(`Falling back to text-only mode for page ${pageIndex} due to model loading failure`);
            this.showTextOnlyMode(pageIndex);
        }
    }

    /**
     * Determine if model loading should be retried
     */
    private shouldRetryModelLoading(error: Error): boolean {
        const message = error.message.toLowerCase();
        
        // Don't retry for certain types of errors
        if (message.includes('not found') || 
            message.includes('no model configuration') ||
            message.includes('disposed')) {
            return false;
        }
        
        // Retry for transient errors
        return this.retryCount < 2; // Allow up to 2 retries for model loading
    }

    /**
     * Retry model loading with simplified settings
     */
    private retryModelLoading(pageIndex: number): void {
        console.log(`Retrying model loading for page ${pageIndex}`);
        
        // Enable low performance mode for retry
        const wasLowPerformance = this.isLowPerformanceMode;
        this.isLowPerformanceMode = true;
        
        // Retry after a short delay
        setTimeout(async () => {
            try {
                await this.loadModelForPage(pageIndex);
            } catch (retryError) {
                console.error(`Model loading retry failed for page ${pageIndex}:`, retryError);
                this.showTextOnlyMode(pageIndex);
            } finally {
                // Restore original performance mode
                this.isLowPerformanceMode = wasLowPerformance;
            }
        }, 500);
    }

    /**
     * Create optimized model based on type with performance considerations
     * Requirements: 9.2, 9.6, 9.8 - Create contextually appropriate models with optimization
     */
    private async createOptimizedModelByType(modelType: ModelConfig['modelType'], pageIndex: number): Promise<AbstractMesh | null> {
        if (!this.scene || !this.materialManager) return null;

        // Performance-based model creation
        const useSimplified = this.isLowPerformanceMode;
        
        switch (modelType) {
            case 'empire-emblem':
                return this.createOptimizedEmpireEmblem(useSimplified);
            case 'desert-planet':
                return this.createOptimizedDesertPlanet(useSimplified);
            case 'terrain-closeup':
                return this.createOptimizedTerrainCloseup(useSimplified);
            case 'energy-lords-emblem':
                return this.createOptimizedEnergyLordsEmblem(useSimplified);
            case 'parasites':
                return this.createOptimizedParasiteModels(useSimplified);
            case 'orbital-system':
                return this.createOptimizedOrbitalSystem(useSimplified);
            default:
                console.warn(`Unknown model type: ${modelType}`);
                return null;
        }
    }

    /**
     * Create Empire emblem using EmblemGeometry component
     * Requirements: 9.2, 9.3 - Empire emblem with neon glow effects
     */
    private createEmpireEmblem(): AbstractMesh | null {
        if (!this.scene || !this.materialManager || !this.emblemGeometry) return null;

        try {
            return this.emblemGeometry.createEmpireEmblem();
        } catch (error) {
            console.warn('Failed to create Empire emblem:', error);
            return null;
        }
    }

    /**
     * Create desert planet using PlanetRenderer component
     * Requirements: 9.2, 9.5 - Desert planet using existing terrain textures
     */
    private createDesertPlanet(): AbstractMesh | null {
        if (!this.scene || !this.materialManager || !this.planetRenderer) return null;

        try {
            return this.planetRenderer.createDesertPlanet({
                radius: 1.8,
                textureType: 'desert',
                atmosphereGlow: false,
                cloudLayer: false,
                rotationSpeed: 0.5
            });
        } catch (error) {
            console.warn('Failed to create desert planet, using fallback:', error);
            // Fallback to simple sphere
            const planet = Mesh.CreateSphere('desertPlanetFallback', 16, 3, this.scene);
            const material = this.materialManager.createCustomMaterial(
                'desertPlanetFallbackMaterial',
                new Color3(0.8, 0.7, 0.4), // Sand color
                { emissive: new Color3(0.1, 0.08, 0.04) }
            );
            planet.material = material;
            return planet;
        }
    }

    /**
     * Create terrain closeup with mineral deposits and atmospheric effects
     * Requirements: 9.2, 9.5, 9.9, 9.10 - Close-up terrain view with effects
     */
    private createTerrainCloseup(): AbstractMesh | null {
        if (!this.scene || !this.materialManager || !this.terrainRenderer) return null;

        try {
            // Configure terrain for close-up view
            const terrainConfig = {
                chunkSize: 12,        // Small chunk for close-up detail
                heightScale: 1.5,     // Moderate height variation
                mineralDeposits: true, // Show mineral deposits
                atmosphericEffects: true, // Add particle effects
                toxicGlow: true       // Add toxic atmosphere glow
            };

            // Create terrain using TerrainRenderer
            const terrainMesh = this.terrainRenderer.createTerrainCloseup(terrainConfig);
            
            if (terrainMesh) {
                // Position terrain appropriately for viewing
                terrainMesh.position.y = -2; // Lower it slightly for better framing
                
                // Add rotation animation (0.3 RPM as specified in design)
                const rotationAnimation = this.createRotationAnimation(terrainMesh, 0.3);
                terrainMesh.animations = [rotationAnimation];
                this.scene.beginAnimation(terrainMesh, 0, 100, true);
                
                return terrainMesh;
            }
            
            return null;
        } catch (error) {
            console.error('Failed to create terrain closeup:', error);
            return null;
        }
    }

    /**
     * Create Energy Lords emblem using EmblemGeometry component
     * Requirements: 9.2, 9.3 - Energy Lords emblem with cyan/gold neon effects
     */
    private createEnergyLordsEmblem(): AbstractMesh | null {
        if (!this.scene || !this.materialManager || !this.emblemGeometry) return null;

        try {
            return this.emblemGeometry.createEnergyLordsEmblem();
        } catch (error) {
            console.warn('Failed to create Energy Lords emblem, using fallback:', error);
            // Fallback to simple emblem
            return this.emblemGeometry.createSimpleEmblem('energyLordsEmblemFallback', 'octagon');
        }
    }

    /**
     * Create organic parasite models using ParasiteRenderer component
     * Requirements: 9.2, 9.3 - Organic parasite models with dark materials and red pulsing effects
     */
    private createParasiteModels(): AbstractMesh | null {
        if (!this.scene || !this.materialManager || !this.parasiteRenderer) return null;

        try {
            // Create parasite group with multiple organic shapes
            const parasiteGroup = this.parasiteRenderer.createParasiteGroup({
                count: 4, // Multiple parasites for visual interest
                organicShapes: ['blob', 'tendril', 'spore', 'cluster'], // Variety of shapes
                pulsing: true, // Enable red vein pulsing effects
                writhing: true, // Enable organic writhing animations
                redVeins: true // Enable red vein textures
            });

            return parasiteGroup;
        } catch (error) {
            console.warn('Failed to create parasite models with ParasiteRenderer, using fallback:', error);
            
            // Fallback to simple placeholder
            const parasite = Mesh.CreateSphere('parasiteModelFallback', 12, 2, this.scene);
            parasite.scaling = new Vector3(1.2, 0.8, 1.0); // Organic deformation
            const material = this.materialManager.createCustomMaterial(
                'parasiteFallbackMaterial',
                new Color3(0.4, 0.1, 0.6), // Dark purple
                { emissive: new Color3(0.1, 0.02, 0.15) }
            );
            parasite.material = material;
            
            return parasite;
        }
    }

    /**
     * Create optimized Empire emblem with performance considerations
     * Requirements: 9.2, 9.3, 9.6, 9.8 - Empire emblem with performance optimization
     */
    private createOptimizedEmpireEmblem(useSimplified: boolean = false): AbstractMesh | null {
        if (!this.scene || !this.materialManager || !this.emblemGeometry) return null;

        try {
            // Always use the full emblem - no simplified fallback
            return this.emblemGeometry.createEmpireEmblem();
        } catch (error) {
            console.warn('Failed to create Empire emblem:', error);
            return null;
        }
    }

    /**
     * Create optimized desert planet with performance considerations
     * Requirements: 9.2, 9.5, 9.6, 9.8 - Desert planet with performance optimization
     */
    private createOptimizedDesertPlanet(useSimplified: boolean = false): AbstractMesh | null {
        if (!this.scene || !this.materialManager || !this.planetRenderer) return null;

        try {
            const config = {
                radius: 1.8,
                textureType: 'desert' as const,
                atmosphereGlow: false,
                cloudLayer: false,
                rotationSpeed: 0.5
            };

            return this.planetRenderer.createDesertPlanet(config);
        } catch (error) {
            console.warn('Failed to create optimized desert planet, using fallback:', error);
            // Fallback to simple sphere
            const planet = Mesh.CreateSphere('desertPlanetOptimizedFallback', useSimplified ? 8 : 16, 3, this.scene);
            this.applyOptimizedMaterial(planet, 'desert_planet');
            return planet;
        }
    }

    /**
     * Create optimized terrain closeup with performance considerations
     * Requirements: 9.2, 9.5, 9.6, 9.8, 9.9, 9.10 - Terrain with performance optimization
     */
    private createOptimizedTerrainCloseup(useSimplified: boolean = false): AbstractMesh | null {
        if (!this.scene || !this.materialManager || !this.terrainRenderer) return null;

        try {
            // Configure terrain based on performance mode
            const terrainConfig = {
                chunkSize: useSimplified ? 8 : 12,        // Smaller chunk for low performance
                heightScale: 1.5,
                mineralDeposits: !useSimplified,          // Disable deposits in low performance mode
                atmosphericEffects: !useSimplified,      // Disable particles in low performance mode
                toxicGlow: !useSimplified                 // Disable glow in low performance mode
            };

            const terrainMesh = this.terrainRenderer.createTerrainCloseup(terrainConfig);
            
            if (terrainMesh) {
                terrainMesh.position.y = -2;
                
                // Add rotation animation
                const rotationAnimation = this.createRotationAnimation(terrainMesh, 0.3);
                terrainMesh.animations = [rotationAnimation];
                this.scene.beginAnimation(terrainMesh, 0, 100, true);
                
                return terrainMesh;
            }
            
            return null;
        } catch (error) {
            console.error('Failed to create optimized terrain closeup:', error);
            return null;
        }
    }

    /**
     * Create optimized Energy Lords emblem with performance considerations
     * Requirements: 9.2, 9.3, 9.6, 9.8 - Energy Lords emblem with performance optimization
     */
    private createOptimizedEnergyLordsEmblem(useSimplified: boolean = false): AbstractMesh | null {
        if (!this.scene || !this.materialManager || !this.emblemGeometry) return null;

        try {
            if (useSimplified) {
                // Use simple emblem for low performance mode
                const emblem = this.emblemGeometry.createSimpleEmblem('energyLordsEmblemOptimized', 'octagon');
                this.applyOptimizedMaterial(emblem, 'gold_glow');
                return emblem;
            } else {
                // Use full quality emblem
                return this.emblemGeometry.createEnergyLordsEmblem();
            }
        } catch (error) {
            console.warn('Failed to create optimized Energy Lords emblem, using fallback:', error);
            const fallback = this.emblemGeometry.createSimpleEmblem('energyLordsEmblemFallback', 'octagon');
            this.applyOptimizedMaterial(fallback, 'gold_glow');
            return fallback;
        }
    }

    /**
     * Create optimized parasite models with performance considerations
     * Requirements: 9.2, 9.3, 9.6, 9.8 - Parasite models with performance optimization
     */
    private createOptimizedParasiteModels(useSimplified: boolean = false): AbstractMesh | null {
        if (!this.scene || !this.materialManager || !this.parasiteRenderer) return null;

        try {
            // Configure parasites based on performance mode
            const parasiteConfig: ParasiteConfig = {
                count: useSimplified ? 2 : 4,                    // Fewer parasites in low performance mode
                organicShapes: useSimplified ? 
                    ['blob', 'spore'] :                          // Simpler shapes in low performance mode
                    ['blob', 'tendril', 'spore', 'cluster'],
                pulsing: !useSimplified,                         // Disable pulsing in low performance mode
                writhing: !useSimplified,                        // Disable writhing in low performance mode
                redVeins: !useSimplified                         // Disable veins in low performance mode
            };

            return this.parasiteRenderer.createParasiteGroup(parasiteConfig);
        } catch (error) {
            console.warn('Failed to create optimized parasite models, using fallback:', error);
            
            // Fallback to simple placeholder
            const parasite = Mesh.CreateSphere('parasiteModelOptimizedFallback', useSimplified ? 8 : 12, 2, this.scene);
            parasite.scaling = new Vector3(1.2, 0.8, 1.0);
            this.applyOptimizedMaterial(parasite, 'red_organic');
            
            return parasite;
        }
    }

    /**
     * Create optimized orbital system with performance considerations
     * Requirements: 9.2, 9.6, 9.8 - Orbital system with performance optimization
     */
    private createOptimizedOrbitalSystem(useSimplified: boolean = false): AbstractMesh | null {
        if (!this.scene || !this.materialManager || !this.planetRenderer) return null;

        try {
            // Create base desert planet with performance considerations
            const planetConfig = {
                radius: 2.0,
                textureType: 'desert' as const,
                atmosphereGlow: !useSimplified,  // Disable glow in low performance mode
                cloudLayer: false,               // No clouds for clearer view
                rotationSpeed: 0.5
            };

            const planet = this.planetRenderer.createDesertPlanet(planetConfig);

            if (!useSimplified) {
                // Add orbiting mining ship only in normal performance mode
                const orbitingShip = this.planetRenderer.createOrbitalSystem(planet);
            }

            return planet;
        } catch (error) {
            console.warn('Failed to create optimized orbital system, using fallback:', error);
            // Fallback to simple planet with optional orbiting object
            const system = new Mesh('orbitalSystemOptimizedFallback', this.scene);
            
            // Central planet
            const planet = Mesh.CreateSphere('centralPlanetOptimizedFallback', useSimplified ? 8 : 16, 2, this.scene);
            this.applyOptimizedMaterial(planet, 'desert_planet');
            planet.parent = system;
            
            if (!useSimplified) {
                // Orbiting ship (simple box)
                const ship = Mesh.CreateBox('orbitingShipOptimizedFallback', 0.5, this.scene);
                this.applyOptimizedMaterial(ship, 'metallic_ship');
                ship.position = new Vector3(4, 0, 0);
                ship.parent = system;
            }
            
            return system;
        }
    }

    /**
     * Apply optimized material from cache
     * Requirements: 9.8 - Optimize material instances and texture reuse
     */
    private applyOptimizedMaterial(mesh: AbstractMesh, materialType: string): void {
        const cachedMaterial = this.materialCache.get(materialType);
        if (cachedMaterial) {
            mesh.material = cachedMaterial;
        } else {
            // Fallback to creating new material
            const newMaterial = this.createOptimizedMaterial(materialType);
            if (newMaterial) {
                mesh.material = newMaterial;
                this.materialCache.set(materialType, newMaterial);
            }
        }
    }

    /**
     * Setup optimized model animation with performance considerations
     * Requirements: 9.3, 9.6 - Model animation with performance optimization
     */
    private setupOptimizedModelAnimation(model: AbstractMesh, animationConfig: ModelAnimation): void {
        if (!this.scene) return;

        // Create rotation animation
        const rotationAnimation = this.createRotationAnimation(model, animationConfig.rotationSpeed);
        
        // Create animation group
        this.currentAnimationGroup = new AnimationGroup('modelAnimationGroup', this.scene);
        this.currentAnimationGroup.addTargetedAnimation(rotationAnimation, model);
        
        // Add additional effects only in normal performance mode
        if (animationConfig.additionalEffects && !this.isLowPerformanceMode) {
            this.addAdditionalEffects(model, animationConfig.additionalEffects);
        }
    }
    private createOrbitalSystem(): AbstractMesh | null {
        if (!this.scene || !this.materialManager || !this.planetRenderer) return null;

        try {
            // Create base desert planet
            const planet = this.planetRenderer.createDesertPlanet({
                radius: 2.0,
                textureType: 'desert',
                atmosphereGlow: true,
                cloudLayer: false, // No clouds for clearer view of mining operation
                rotationSpeed: 0.5
            });

            // Add orbiting mining ship
            const orbitingShip = this.planetRenderer.createOrbitalSystem(planet);

            return planet;
        } catch (error) {
            console.warn('Failed to create orbital system, using fallback:', error);
            // Fallback to simple planet with orbiting object
            const system = new Mesh('orbitalSystemFallback', this.scene);
            
            // Central planet
            const planet = Mesh.CreateSphere('centralPlanetFallback', 16, 2, this.scene);
            const planetMaterial = this.materialManager.createCustomMaterial(
                'centralPlanetFallbackMaterial',
                new Color3(0.8, 0.7, 0.4),
                { emissive: new Color3(0.1, 0.08, 0.04) }
            );
            planet.material = planetMaterial;
            planet.parent = system;
            
            // Orbiting ship (simple box)
            const ship = Mesh.CreateBox('orbitingShipFallback', 0.5, this.scene);
            const shipMaterial = this.materialManager.createCustomMaterial(
                'orbitingShipFallbackMaterial',
                new Color3(0.7, 0.7, 0.7),
                { emissive: new Color3(0.1, 0.1, 0.1) }
            );
            ship.material = shipMaterial;
            ship.position = new Vector3(4, 0, 0);
            ship.parent = system;
            
            return system;
        }
    }

    /**
     * Setup animation for the loaded model
     * Requirements: 9.3 - Model animation with slow rotation
     */
    private setupModelAnimation(model: AbstractMesh, animationConfig: ModelAnimation): void {
        if (!this.scene) return;

        // Create rotation animation
        const rotationAnimation = this.createRotationAnimation(model, animationConfig.rotationSpeed);
        
        // Create animation group
        this.currentAnimationGroup = new AnimationGroup('modelAnimationGroup', this.scene);
        this.currentAnimationGroup.addTargetedAnimation(rotationAnimation, model);
        
        // Add additional effects if specified
        if (animationConfig.additionalEffects) {
            this.addAdditionalEffects(model, animationConfig.additionalEffects);
        }
    }

    /**
     * Create rotation animation for model
     * Requirements: 9.3 - Slow rotation at approximately 0.5 RPM
     */
    private createRotationAnimation(mesh: AbstractMesh, rotationSpeedRPM: number): Animation {
        const rotationAnimation = new Animation(
            'modelRotation',
            'rotation.y',
            30, // 30 FPS animation
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_RELATIVE
        );

        // Calculate rotation per cycle: RPM to radians per second
        // At 0.5 RPM, we want 0.5 * 2π radians per 60 seconds = π/60 radians per second
        const radiansPerSecond = (rotationSpeedRPM * 2 * Math.PI) / 60;

        // Animation runs for 30 frames (1 second), then loops and ADDS to current rotation
        const keys = [
            { frame: 0, value: 0 },
            { frame: 30, value: radiansPerSecond }, // One second worth of rotation
        ];

        rotationAnimation.setKeys(keys);

        return rotationAnimation;
    }

    /**
     * Add additional visual effects to models
     * Requirements: 9.3 - Additional effects for specific model types
     */
    private addAdditionalEffects(model: AbstractMesh, effectType: ModelAnimation['additionalEffects']): void {
        if (!this.scene || !this.currentAnimationGroup) return;

        switch (effectType) {
            case 'pulsing':
                this.addPulsingEffect(model);
                break;
            case 'writhing':
                this.addWrithingEffect(model);
                break;
            case 'orbital':
                this.addOrbitalEffect(model);
                break;
            case 'mining-beam':
                this.addMiningBeamEffect(model);
                break;
        }
    }

    /**
     * Add pulsing effect for emblems
     */
    private addPulsingEffect(model: AbstractMesh): void {
        if (!this.scene || !this.currentAnimationGroup) return;

        const pulseAnimation = new Animation(
            'modelPulse',
            'scaling',
            30,
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        const keys = [
            { frame: 0, value: new Vector3(1, 1, 1) },
            { frame: 30, value: new Vector3(1.1, 1.1, 1.1) },
            { frame: 60, value: new Vector3(1, 1, 1) }
        ];

        pulseAnimation.setKeys(keys);
        this.currentAnimationGroup.addTargetedAnimation(pulseAnimation, model);
    }

    /**
     * Add writhing effect for organic models
     */
    private addWrithingEffect(model: AbstractMesh): void {
        if (!this.scene || !this.currentAnimationGroup) return;

        // Subtle scaling variation for organic movement
        const writheAnimation = new Animation(
            'modelWrithe',
            'scaling',
            30,
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        const keys = [
            { frame: 0, value: new Vector3(1, 1, 1) },
            { frame: 15, value: new Vector3(1.05, 0.95, 1.02) },
            { frame: 30, value: new Vector3(0.98, 1.03, 0.99) },
            { frame: 45, value: new Vector3(1.02, 0.97, 1.01) },
            { frame: 60, value: new Vector3(1, 1, 1) }
        ];

        writheAnimation.setKeys(keys);
        this.currentAnimationGroup.addTargetedAnimation(writheAnimation, model);
    }

    /**
     * Add orbital effect for orbital system
     */
    private addOrbitalEffect(model: AbstractMesh): void {
        // Orbital effects will be handled by the orbital system model itself
        // This is a placeholder for future implementation
    }

    /**
     * Add mining beam effect
     */
    private addMiningBeamEffect(model: AbstractMesh): void {
        // Mining beam effects will be handled by the orbital system model
        // This is a placeholder for future implementation
    }

    /**
     * Start model animation
     * Requirements: 9.3 - Start animation when model is loaded
     */
    public startAnimation(): void {
        if (this.currentAnimationGroup && !this.isDisposed) {
            this.currentAnimationGroup.start(true); // Loop animation
        }
    }

    /**
     * Stop model animation
     */
    public stopAnimation(): void {
        if (this.currentAnimationGroup) {
            this.currentAnimationGroup.stop();
        }
    }

    /**
     * Clear current model and cleanup resources
     * Requirements: 9.8 - Memory management and cleanup
     */
    private clearCurrentModel(): void {
        // Stop current animation
        this.stopAnimation();
        
        // Dispose animation group
        if (this.currentAnimationGroup) {
            this.currentAnimationGroup.dispose();
            this.currentAnimationGroup = null;
        }
        
        // Dispose current model
        if (this.currentModel) {
            this.currentModel.dispose();
            this.currentModel = null;
        }
        
        this.currentPageIndex = -1;
    }

    /**
     * Show placeholder when model loading fails or is not available
     */
    private showPlaceholder(text: string): void {
        this.clearCurrentModel();
        
        if (!this.scene || !this.materialManager) return;

        // Create simple placeholder box
        const placeholder = Mesh.CreateBox('placeholder', 2, this.scene);
        const material = this.materialManager.createCustomMaterial(
            'placeholderMaterial',
            new Color3(0.3, 0.3, 0.3),
            { emissive: new Color3(0.1, 0.1, 0.1) }
        );
        placeholder.material = material;
        
        this.currentModel = placeholder;
        
        // Add simple rotation
        this.setupModelAnimation(placeholder, { rotationSpeed: 0.2 });
        this.startAnimation();
    }

    /**
     * Show error placeholder when initialization fails
     */
    private showErrorPlaceholder(errorMessage: string): void {
        this.container.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: rgba(255, 100, 100, 0.8);
                font-family: 'Orbitron', monospace;
                font-size: 12px;
                text-align: center;
                padding: 20px;
                border: 1px dashed rgba(255, 100, 100, 0.3);
                border-radius: 4px;
                background: rgba(40, 0, 0, 0.3);
            ">
                <div style="margin-bottom: 10px;">⚠️ Error</div>
                <div style="font-size: 10px; opacity: 0.7;">${errorMessage}</div>
            </div>
        `;
    }

    /**
     * Dispose of all resources and cleanup with performance optimization cleanup
     * Requirements: 9.8 - Memory management and cleanup methods with optimization cleanup
     * Requirements: 9.8 - Handle memory constraints and cleanup edge cases
     */
    public dispose(): void {
        if (this.isDisposed) return;
        
        console.log('Starting IntroductionModelRenderer disposal...');
        this.isDisposed = true;
        
        try {
            // Hide loading state if active
            this.hideLoadingState();
            
            // Clear current model
            this.clearCurrentModel();
            
            // Dispose performance optimization systems
            if (this.performanceMonitor) {
                try {
                    this.performanceMonitor.dispose();
                } catch (error) {
                    console.warn('Error disposing performance monitor:', error);
                }
                this.performanceMonitor = null;
            }
            
            if (this.lodSystem) {
                try {
                    this.lodSystem.dispose();
                } catch (error) {
                    console.warn('Error disposing LOD system:', error);
                }
                this.lodSystem = null;
            }
            
            // Clear caches with error handling
            this.disposeCaches();
            
            // Dispose rendering pipeline
            if (this.renderingPipeline) {
                try {
                    this.renderingPipeline.dispose();
                } catch (error) {
                    console.warn('Error disposing rendering pipeline:', error);
                }
                this.renderingPipeline = null;
            }
            
            // Dispose lights
            if (this.hemisphericLight) {
                try {
                    this.hemisphericLight.dispose();
                } catch (error) {
                    console.warn('Error disposing hemispheric light:', error);
                }
                this.hemisphericLight = null;
            }
            
            if (this.directionalLight) {
                try {
                    this.directionalLight.dispose();
                } catch (error) {
                    console.warn('Error disposing directional light:', error);
                }
                this.directionalLight = null;
            }
            
            // Dispose camera
            if (this.camera) {
                try {
                    this.camera.dispose();
                } catch (error) {
                    console.warn('Error disposing camera:', error);
                }
                this.camera = null;
            }
            
            // Dispose component helpers
            this.disposeComponentHelpers();
            
            // Dispose material manager (if we created it)
            if (this.materialManager) {
                try {
                    this.materialManager.dispose();
                } catch (error) {
                    console.warn('Error disposing material manager:', error);
                }
                this.materialManager = null;
            }
            
            // Dispose scene
            if (this.scene) {
                try {
                    this.scene.dispose();
                } catch (error) {
                    console.warn('Error disposing scene:', error);
                }
                this.scene = null;
            }
            
            // Dispose engine
            if (this.engine) {
                try {
                    this.engine.stopRenderLoop();
                    this.engine.dispose();
                } catch (error) {
                    console.warn('Error disposing engine:', error);
                }
                this.engine = null;
            }
            
            // Clear container
            if (this.container) {
                try {
                    this.container.innerHTML = '';
                } catch (error) {
                    console.warn('Error clearing container:', error);
                }
            }
            
            // Reset state
            this.resetState();
            
            console.log('IntroductionModelRenderer disposed successfully with performance optimizations');
            
        } catch (error) {
            console.error('Error during IntroductionModelRenderer disposal:', error);
            // Continue with cleanup even if some parts fail
            this.forceCleanup();
        }
    }

    /**
     * Dispose caches with error handling
     * Requirements: 9.8 - Handle memory constraints and cleanup edge cases
     */
    private disposeCaches(): void {
        // Clear model cache
        try {
            this.modelCache.forEach((model, key) => {
                try {
                    if (model && !model.isDisposed()) {
                        model.dispose();
                    }
                } catch (error) {
                    console.warn(`Error disposing cached model ${key}:`, error);
                }
            });
            this.modelCache.clear();
        } catch (error) {
            console.warn('Error clearing model cache:', error);
            this.modelCache = new Map(); // Reset cache
        }
        
        // Clear material cache
        try {
            this.materialCache.forEach((material, key) => {
                try {
                    if (material && material.dispose) {
                        material.dispose();
                    }
                } catch (error) {
                    console.warn(`Error disposing cached material ${key}:`, error);
                }
            });
            this.materialCache.clear();
        } catch (error) {
            console.warn('Error clearing material cache:', error);
            this.materialCache = new Map(); // Reset cache
        }
    }

    /**
     * Dispose component helpers with error handling
     */
    private disposeComponentHelpers(): void {
        const helpers = [
            { name: 'emblemGeometry', instance: this.emblemGeometry },
            { name: 'planetRenderer', instance: this.planetRenderer },
            { name: 'parasiteRenderer', instance: this.parasiteRenderer },
            { name: 'terrainRenderer', instance: this.terrainRenderer }
        ];

        helpers.forEach(({ name, instance }) => {
            if (instance) {
                try {
                    // Check if dispose method exists before calling it
                    if (instance && 'dispose' in instance && typeof (instance as any).dispose === 'function') {
                        (instance as any).dispose();
                    }
                } catch (error) {
                    console.warn(`Error disposing ${name}:`, error);
                }
            }
        });

        this.emblemGeometry = null;
        this.planetRenderer = null;
        this.parasiteRenderer = null;
        this.terrainRenderer = null;
    }

    /**
     * Reset internal state
     */
    private resetState(): void {
        this.currentModel = null;
        this.currentAnimationGroup = null;
        this.currentPageIndex = -1;
        this.isLowPerformanceMode = false;
        this.isInTextOnlyMode = false;
        this.retryCount = 0;
        this.loadingStateElement = null;
        
        // Reset error state
        this.errorState = {
            hasWebGLSupport: false,
            hasBabylonSupport: false,
            hasMemoryConstraints: false,
            isInFallbackMode: false,
            lastError: null,
            errorCount: 0,
            maxRetries: 3
        };
    }

    /**
     * Force cleanup when normal disposal fails
     */
    private forceCleanup(): void {
        console.warn('Performing force cleanup of IntroductionModelRenderer');
        
        // Reset all references to null
        this.canvas = null;
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.materialManager = null;
        this.renderingPipeline = null;
        this.currentModel = null;
        this.currentAnimationGroup = null;
        this.hemisphericLight = null;
        this.directionalLight = null;
        this.emblemGeometry = null;
        this.planetRenderer = null;
        this.parasiteRenderer = null;
        this.terrainRenderer = null;
        this.lodSystem = null;
        this.performanceMonitor = null;
        this.loadingStateElement = null;
        
        // Clear caches
        this.modelCache = new Map();
        this.materialCache = new Map();
        
        // Reset state
        this.resetState();
        
        // Clear container if possible
        try {
            if (this.container) {
                this.container.innerHTML = '';
            }
        } catch (error) {
            console.warn('Could not clear container during force cleanup:', error);
        }
    }

    /**
     * Get current model (for testing and debugging)
     */
    public getCurrentModel(): AbstractMesh | null {
        return this.currentModel;
    }

    /**
     * Get current page index (for testing and debugging)
     */
    public getCurrentPageIndex(): number {
        return this.currentPageIndex;
    }

    /**
     * Check if renderer is properly initialized
     */
    public isInitialized(): boolean {
        return !this.isDisposed && 
               !this.isInTextOnlyMode &&
               !this.errorState.isInFallbackMode &&
               this.engine !== null && 
               this.scene !== null && 
               this.camera !== null;
    }

    /**
     * Check if renderer is in fallback mode
     */
    public isInFallbackMode(): boolean {
        return this.errorState.isInFallbackMode || this.isInTextOnlyMode;
    }

    /**
     * Get current error state for debugging
     */
    public getErrorState(): ErrorState {
        return { ...this.errorState };
    }

    /**
     * Get detailed status information for debugging
     */
    public getStatus(): {
        isInitialized: boolean;
        isInFallbackMode: boolean;
        isInTextOnlyMode: boolean;
        isLowPerformanceMode: boolean;
        hasWebGLSupport: boolean;
        hasBabylonSupport: boolean;
        hasMemoryConstraints: boolean;
        errorCount: number;
        retryCount: number;
        currentPageIndex: number;
        cacheStatistics: { modelCacheSize: number; materialCacheSize: number };
    } {
        return {
            isInitialized: this.isInitialized(),
            isInFallbackMode: this.isInFallbackMode(),
            isInTextOnlyMode: this.isInTextOnlyMode,
            isLowPerformanceMode: this.isLowPerformanceMode,
            hasWebGLSupport: this.errorState.hasWebGLSupport,
            hasBabylonSupport: this.errorState.hasBabylonSupport,
            hasMemoryConstraints: this.errorState.hasMemoryConstraints,
            errorCount: this.errorState.errorCount,
            retryCount: this.retryCount,
            currentPageIndex: this.currentPageIndex,
            cacheStatistics: this.getCacheStatistics()
        };
    }

    /**
     * Force fallback to text-only mode (for testing or emergency situations)
     */
    public forceFallbackMode(): void {
        console.warn('Forcing fallback to text-only mode');
        this.isInTextOnlyMode = true;
        this.errorState.isInFallbackMode = true;
        
        if (this.currentPageIndex >= 0) {
            this.showTextOnlyMode(this.currentPageIndex);
        }
    }

    /**
     * Attempt to recover from error state (for testing or retry scenarios)
     */
    public attemptRecovery(): boolean {
        if (this.isDisposed) {
            console.warn('Cannot attempt recovery: renderer is disposed');
            return false;
        }

        console.log('Attempting recovery from error state...');
        
        // Reset error state
        this.errorState.errorCount = 0;
        this.errorState.lastError = null;
        this.retryCount = 0;
        
        // Check if we can exit fallback mode
        if (this.errorState.hasWebGLSupport && !this.errorState.hasMemoryConstraints) {
            this.isInTextOnlyMode = false;
            this.errorState.isInFallbackMode = false;
            
            // Try to reinitialize if needed
            if (!this.engine || !this.scene) {
                try {
                    this.initialize();
                    return true;
                } catch (error) {
                    console.error('Recovery attempt failed:', error);
                    this.enterFallbackMode(error as Error);
                    return false;
                }
            }
            
            return true;
        }
        
        console.warn('Recovery not possible due to system constraints');
        return false;
    }

    /**
     * Get engine instance (for testing and debugging)
     */
    public getEngine(): Engine | null {
        return this.engine;
    }

    /**
     * Get scene instance (for testing and debugging)
     */
    public getScene(): Scene | null {
        return this.scene;
    }

    /**
     * Get current performance metrics
     * Requirements: 9.6 - Performance monitoring for 60fps maintenance
     */
    public getPerformanceMetrics(): PerformanceMetrics | null {
        return this.performanceMonitor ? this.performanceMonitor.getMetrics() : null;
    }

    /**
     * Check if currently in low performance mode
     */
    public isInLowPerformanceMode(): boolean {
        return this.isLowPerformanceMode;
    }

    /**
     * Get model cache statistics for debugging
     */
    public getCacheStatistics(): { modelCacheSize: number; materialCacheSize: number } {
        return {
            modelCacheSize: this.modelCache.size,
            materialCacheSize: this.materialCache.size
        };
    }

    /**
     * Force performance mode change (for testing)
     */
    public setPerformanceMode(lowPerformance: boolean): void {
        if (lowPerformance !== this.isLowPerformanceMode) {
            this.isLowPerformanceMode = lowPerformance;
            this.handlePerformanceModeChange(lowPerformance);
        }
    }

    /**
     * Clear model cache to free memory
     */
    public clearModelCache(): void {
        this.modelCache.forEach(model => {
            if (model && !model.isDisposed() && model !== this.currentModel) {
                model.dispose();
            }
        });
        this.modelCache.clear();
        console.log('Model cache cleared');
    }

    /**
     * Preload models for better performance (optional optimization)
     */
    public async preloadModels(pageIndices: number[]): Promise<void> {
        if (this.isDisposed) return;

        console.log('Preloading models for pages:', pageIndices);
        
        for (const pageIndex of pageIndices) {
            const modelConfig = MODEL_PAGE_MAPPING[pageIndex];
            if (modelConfig) {
                const cacheKey = `${modelConfig.modelType}_${pageIndex}`;
                if (!this.modelCache.has(cacheKey)) {
                    try {
                        const model = await this.createOptimizedModelByType(modelConfig.modelType, pageIndex);
                        if (model) {
                            model.setEnabled(false); // Hide preloaded models
                            this.modelCache.set(cacheKey, model);
                            console.log(`Preloaded model: ${modelConfig.modelType}`);
                        }
                    } catch (error) {
                        console.warn(`Failed to preload model for page ${pageIndex}:`, error);
                    }
                }
            }
        }
    }
}