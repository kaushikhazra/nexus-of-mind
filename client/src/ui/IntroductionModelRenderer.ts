/**
 * IntroductionModelRenderer - 3D Model Visualization Coordinator
 *
 * Manages dedicated Babylon.js canvas and engine for rendering contextual 3D models
 * during the introduction story presentation. Coordinates between scene, model,
 * animation, and effects subsystems.
 *
 * Refactored to use extracted modules for SOLID compliance.
 * Requirements: 9.5, 9.6, 9.8, 9.9
 */

import {
    Engine,
    Scene,
    ArcRotateCamera,
    HemisphericLight,
    DirectionalLight,
    AbstractMesh,
    AnimationGroup,
    DefaultRenderingPipeline,
    Material
} from '@babylonjs/core';
import { MaterialManager } from '../rendering/MaterialManager';

// Import from extracted modules
import {
    createScene,
    setupCamera,
    setupLighting,
    setupPostProcessing,
    startRenderLoop,
    reducePostProcessingQuality,
    disablePostProcessing
} from './introduction/IntroductionScene';
import {
    createModelByType,
    createPlaceholder,
    ModelType,
    ModelCreationContext
} from './introduction/IntroductionModels';
import {
    setupModelAnimation,
    startAnimation,
    stopAnimation,
    disposeAnimationGroup,
    ModelAnimation
} from './introduction/IntroductionAnimations';
import {
    LODSystem,
    PerformanceMonitor,
    PerformanceMetrics
} from './introduction/IntroductionEffects';

export interface ModelConfig {
    pageIndex: number;
    modelType: ModelType;
    containerWidth: number;
    containerHeight: number;
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

// Re-export types from modules
export type { ModelAnimation, PerformanceMetrics, ModelType };

// ==================== Page Mapping ====================

const MODEL_PAGE_MAPPING: { [pageIndex: number]: { modelType: ModelType; animation: ModelAnimation } } = {
    0: { modelType: 'empire-emblem', animation: { rotationSpeed: 0.5 } },
    1: { modelType: 'empire-emblem', animation: { rotationSpeed: 0.5 } },
    2: { modelType: 'desert-planet', animation: { rotationSpeed: 0.5 } },
    3: { modelType: 'desert-planet', animation: { rotationSpeed: 0.5 } },
    4: { modelType: 'radiation-sign', animation: { rotationSpeed: 0.4 } },
    5: { modelType: 'radiation-sign', animation: { rotationSpeed: 0.4 } },
    6: { modelType: 'energy-lords-emblem', animation: { rotationSpeed: 0.5 } },
    7: { modelType: 'energy-lords-emblem', animation: { rotationSpeed: 0.5 } },
    8: { modelType: 'parasites', animation: { rotationSpeed: 0.4 } },
    9: { modelType: 'parasites', animation: { rotationSpeed: 0.4 } },
    10: { modelType: 'orbital-system', animation: { rotationSpeed: 0.3 } },
    11: { modelType: 'orbital-system', animation: { rotationSpeed: 0.3 } },
    12: { modelType: 'orbital-system', animation: { rotationSpeed: 0.3 } },
    13: { modelType: 'orbital-system', animation: { rotationSpeed: 0.3 } }
};

// ==================== Main Class ====================

export class IntroductionModelRenderer {
    // Core components
    private container: HTMLElement;
    private canvas: HTMLCanvasElement | null = null;
    private engine: Engine | null = null;
    private scene: Scene | null = null;
    private camera: ArcRotateCamera | null = null;
    private materialManager: MaterialManager | null = null;

    // Lighting
    private hemisphericLight: HemisphericLight | null = null;
    private directionalLight: DirectionalLight | null = null;

    // Post-processing
    private renderingPipeline: DefaultRenderingPipeline | null = null;

    // Model state
    private currentModel: AbstractMesh | null = null;
    private currentAnimationGroup: AnimationGroup | null = null;
    private currentPageIndex: number = -1;

    // Caches
    private modelCache: Map<string, AbstractMesh> = new Map();
    private materialCache: Map<string, Material> = new Map();

    // Performance systems
    private lodSystem: LODSystem | null = null;
    private performanceMonitor: PerformanceMonitor | null = null;
    private isLowPerformanceMode: boolean = false;

    // State flags
    private isDisposed: boolean = false;
    private isInTextOnlyMode: boolean = false;
    private retryCount: number = 0;
    private loadingStateElement: HTMLElement | null = null;

    // Error handling
    private errorState: ErrorState = {
        hasWebGLSupport: false,
        hasBabylonSupport: false,
        hasMemoryConstraints: false,
        isInFallbackMode: false,
        lastError: null,
        errorCount: 0,
        maxRetries: 3
    };

    // Callbacks
    private onError?: (error: Error, fallbackMode: boolean) => void;
    private onLoadingStateChange?: (isLoading: boolean) => void;
    private enableFallbacks: boolean = true;

    constructor(config: IntroductionModelRendererConfig) {
        this.container = config.container;
        this.materialManager = config.materialManager || null;
        this.enableFallbacks = config.enableFallbacks ?? true;
        this.onError = config.onError;
        this.onLoadingStateChange = config.onLoadingStateChange;

        this.checkEnvironment();
        this.initialize();
    }

    private checkEnvironment(): void {
        this.errorState.hasWebGLSupport = this.checkWebGLSupport();
        this.errorState.hasBabylonSupport = true;
        this.errorState.hasMemoryConstraints = this.checkMemoryConstraints();
    }

    private checkWebGLSupport(): boolean {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
        } catch {
            return false;
        }
    }

    private checkMemoryConstraints(): boolean {
        if ('deviceMemory' in navigator) {
            return (navigator as any).deviceMemory < 4;
        }
        return false;
    }

    private initialize(): void {
        if (!this.errorState.hasWebGLSupport) {
            this.enterFallbackMode(new Error('WebGL not supported'));
            return;
        }

        try {
            this.createCanvas();
            this.createEngine();
            this.initializeScene();
            this.initializePerformanceSystems();
        } catch (error) {
            console.error('Failed to initialize IntroductionModelRenderer:', error);
            this.enterFallbackMode(error as Error);
        }
    }

    private createCanvas(): void {
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.outline = 'none';
        this.container.appendChild(this.canvas);
    }

    private createEngine(): void {
        if (!this.canvas) return;

        this.engine = new Engine(this.canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
            antialias: !this.isLowPerformanceMode
        });

        window.addEventListener('resize', () => this.engine?.resize());
    }

    private initializeScene(): void {
        if (!this.engine || !this.canvas) return;

        this.scene = createScene(this.engine);
        this.camera = setupCamera(this.scene, this.canvas);
        const lighting = setupLighting(this.scene);
        this.hemisphericLight = lighting.hemisphericLight;
        this.directionalLight = lighting.directionalLight;
        this.renderingPipeline = setupPostProcessing(
            this.scene,
            this.camera,
            {},
            this.isLowPerformanceMode
        );

        startRenderLoop(this.engine, this.scene);
    }

    private initializePerformanceSystems(): void {
        if (!this.scene) return;

        this.lodSystem = new LODSystem(this.scene);
        this.performanceMonitor = new PerformanceMonitor(
            this.scene,
            (isLow) => this.handlePerformanceModeChange(isLow)
        );
    }

    private handlePerformanceModeChange(isLow: boolean): void {
        if (isLow === this.isLowPerformanceMode) return;

        this.isLowPerformanceMode = isLow;
        console.log(`Performance mode: ${isLow ? 'LOW' : 'NORMAL'}`);

        if (isLow) {
            reducePostProcessingQuality(this.renderingPipeline);
        } else {
            disablePostProcessing(this.renderingPipeline);
        }
    }

    private enterFallbackMode(error: Error): void {
        console.warn('Entering fallback mode:', error.message);
        this.errorState.isInFallbackMode = true;
        this.errorState.lastError = error;
        this.errorState.errorCount++;
        this.isInTextOnlyMode = true;
        this.onError?.(error, true);
    }

    public async loadModelForPage(pageIndex: number): Promise<void> {
        if (this.isDisposed || this.isInTextOnlyMode) {
            if (this.isInTextOnlyMode) this.showTextOnlyMode(pageIndex);
            return;
        }

        const modelConfig = MODEL_PAGE_MAPPING[pageIndex];
        if (!modelConfig) {
            console.warn(`No model mapping for page ${pageIndex}`);
            return;
        }

        if (pageIndex === this.currentPageIndex) return;

        this.showLoadingState();

        try {
            this.clearCurrentModel();
            const context = this.createModelContext();
            const model = await createModelByType(modelConfig.modelType, context, pageIndex);

            if (model && !this.isDisposed) {
                this.currentModel = model;
                this.currentPageIndex = pageIndex;
                this.currentAnimationGroup = setupModelAnimation(
                    model,
                    modelConfig.animation,
                    this.scene!
                );
                startAnimation(this.currentAnimationGroup);
            }
        } catch (error) {
            console.error(`Failed to load model for page ${pageIndex}:`, error);
            this.showPlaceholder('Model loading failed');
        } finally {
            this.hideLoadingState();
        }
    }

    private createModelContext(): ModelCreationContext {
        return {
            scene: this.scene!,
            materialManager: this.materialManager,
            isLowPerformanceMode: this.isLowPerformanceMode,
            materialCache: this.materialCache
        };
    }

    private clearCurrentModel(): void {
        stopAnimation(this.currentAnimationGroup);
        disposeAnimationGroup(this.currentAnimationGroup);
        this.currentAnimationGroup = null;

        if (this.currentModel) {
            const descendants = this.currentModel.getChildMeshes(false);
            for (const child of descendants) {
                if (child && !child.isDisposed()) child.dispose(false, true);
            }
            this.currentModel.dispose(false, true);
            this.currentModel = null;
        }

        this.currentPageIndex = -1;
    }

    private showPlaceholder(text: string): void {
        this.clearCurrentModel();
        if (!this.scene) return;

        const context = this.createModelContext();
        const placeholder = createPlaceholder(context, text);
        this.currentModel = placeholder;
        this.currentAnimationGroup = setupModelAnimation(
            placeholder,
            { rotationSpeed: 0.2 },
            this.scene
        );
        startAnimation(this.currentAnimationGroup);
    }

    private showTextOnlyMode(pageIndex: number): void {
        const modelConfig = MODEL_PAGE_MAPPING[pageIndex];
        const modelType = modelConfig?.modelType || 'unknown';

        this.container.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                        height:100%;color:rgba(100,150,200,0.6);font-family:'Orbitron',monospace;
                        font-size:12px;text-align:center;padding:20px;
                        border:1px dashed rgba(100,150,200,0.3);border-radius:4px;">
                <div style="margin-bottom:10px;">📦 ${modelType}</div>
                <div style="font-size:10px;opacity:0.7;">3D Preview Unavailable</div>
            </div>
        `;
    }

    private showLoadingState(): void {
        this.onLoadingStateChange?.(true);
        if (!this.loadingStateElement) {
            this.loadingStateElement = document.createElement('div');
            this.loadingStateElement.style.cssText = `
                position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                color:rgba(100,150,200,0.8);font-family:'Orbitron',monospace;font-size:12px;
            `;
            this.loadingStateElement.textContent = 'Loading...';
        }
        this.container.appendChild(this.loadingStateElement);
    }

    private hideLoadingState(): void {
        this.onLoadingStateChange?.(false);
        if (this.loadingStateElement?.parentNode) {
            this.loadingStateElement.parentNode.removeChild(this.loadingStateElement);
        }
    }

    public startAnimation(): void {
        startAnimation(this.currentAnimationGroup);
    }

    public stopAnimation(): void {
        stopAnimation(this.currentAnimationGroup);
    }

    public dispose(): void {
        if (this.isDisposed) return;
        this.isDisposed = true;

        try {
            this.hideLoadingState();
            this.clearCurrentModel();

            this.performanceMonitor?.dispose();
            this.performanceMonitor = null;

            this.lodSystem?.dispose();
            this.lodSystem = null;

            this.disposeCaches();

            this.renderingPipeline?.dispose();
            this.renderingPipeline = null;

            this.hemisphericLight?.dispose();
            this.hemisphericLight = null;

            this.directionalLight?.dispose();
            this.directionalLight = null;

            this.camera?.dispose();
            this.camera = null;

            this.materialManager?.dispose();
            this.materialManager = null;

            this.scene?.dispose();
            this.scene = null;

            this.engine?.stopRenderLoop();
            this.engine?.dispose();
            this.engine = null;

            this.container.innerHTML = '';
        } catch (error) {
            console.error('Error during disposal:', error);
        }
    }

    private disposeCaches(): void {
        this.modelCache.forEach((model) => {
            if (model && !model.isDisposed()) model.dispose();
        });
        this.modelCache.clear();

        this.materialCache.forEach((material) => {
            if (material?.dispose) material.dispose();
        });
        this.materialCache.clear();
    }

    // ==================== Public API ====================

    public getCurrentModel(): AbstractMesh | null {
        return this.currentModel;
    }

    public getCurrentPageIndex(): number {
        return this.currentPageIndex;
    }

    public isInitialized(): boolean {
        return !this.isDisposed && !this.isInTextOnlyMode && !this.errorState.isInFallbackMode &&
               this.engine !== null && this.scene !== null && this.camera !== null;
    }

    public isInFallbackMode(): boolean {
        return this.errorState.isInFallbackMode || this.isInTextOnlyMode;
    }

    public getErrorState(): ErrorState {
        return { ...this.errorState };
    }

    public getPerformanceMetrics(): PerformanceMetrics | null {
        return this.performanceMonitor?.getMetrics() || null;
    }

    public isInLowPerformanceMode(): boolean {
        return this.isLowPerformanceMode;
    }

    public getCacheStatistics(): { modelCacheSize: number; materialCacheSize: number } {
        return {
            modelCacheSize: this.modelCache.size,
            materialCacheSize: this.materialCache.size
        };
    }

    public getEngine(): Engine | null {
        return this.engine;
    }

    public getScene(): Scene | null {
        return this.scene;
    }
}
