/**
 * IntroductionScreen - Immersive narrative introduction coordinator
 *
 * Coordinates the introduction story presentation with typewriter effects,
 * 3D models, and responsive layouts. Refactored to use extracted modules.
 *
 * Requirements: 2.1-2.5, 3.1-3.5, 4.1-4.6, 6.1-6.4, 7.5, 9.1-9.8
 */

import { StoryContentParser, StoryContent, StoryPage } from './StoryContentParser';
import { TypewriterEffect } from './TypewriterEffect';
import { PreferenceManager } from './PreferenceManager';
import { TextColorizer } from './TextColorizer';
import { IntroductionModelRenderer } from './IntroductionModelRenderer';
import { MaterialManager } from '../rendering/MaterialManager';

// Import from extracted modules
import {
    detectViewport,
    updateResponsiveLayout,
    setupSwipeGestures
} from './screen/IntroductionResponsive';
import type { ViewportInfo, ResponsiveElements } from './screen/IntroductionResponsive';
import {
    buildIntroductionUI,
    showModelError,
    updateCheckboxVisualState,
    updateButtonState
} from './screen/IntroductionUIBuilder';
import type { UIElements } from './screen/IntroductionUIBuilder';

// ==================== Types ====================

export interface IntroductionScreenConfig {
    containerId: string;
    onComplete: () => void;
    skipPreferenceKey?: string;
}

export interface IntroductionState {
    currentPage: number;
    isTypewriterActive: boolean;
    skipIntroduction: boolean;
    isVisible: boolean;
    modelRenderer: IntroductionModelRenderer | null;
    isModelLoading: boolean;
    currentModelType: string | null;
}

export { ViewportInfo };

// ==================== Main Class ====================

export class IntroductionScreen {
    private container: HTMLElement | null = null;
    private config: IntroductionScreenConfig;
    private storyContent: StoryContent | null = null;
    private currentPageIndex: number = 0;
    private state: IntroductionState;
    private typewriterEffect: TypewriterEffect | null = null;
    private preferenceManager: PreferenceManager;
    private textColorizer: TextColorizer;
    private viewportInfo: ViewportInfo;
    private resizeObserver: ResizeObserver | null = null;
    private modelRenderer: IntroductionModelRenderer | null = null;
    private materialManager: MaterialManager | null = null;

    // UI Elements
    private uiElements: UIElements | null = null;

    constructor(config: IntroductionScreenConfig) {
        this.config = { skipPreferenceKey: 'skipIntroduction', ...config };
        this.preferenceManager = new PreferenceManager({
            storageKey: this.config.skipPreferenceKey || 'skipIntroduction',
            fallbackToMemory: true
        });
        this.textColorizer = new TextColorizer();

        this.state = {
            currentPage: 0,
            isTypewriterActive: false,
            skipIntroduction: false,
            isVisible: false,
            modelRenderer: null,
            isModelLoading: false,
            currentModelType: null
        };

        this.viewportInfo = detectViewport();
        this.initialize();
    }

    private initialize(): void {
        this.container = document.getElementById(this.config.containerId);

        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = this.config.containerId;
            this.container.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                z-index: 10000; display: none;
            `;
            document.body.appendChild(this.container);
        }

        this.loadPreferences();
        this.loadStoryContent();
        this.createUI();
        this.setupResponsiveHandlers();
    }

    private setupResponsiveHandlers(): void {
        const handleResize = () => {
            this.viewportInfo = detectViewport();
            this.updateLayout();
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', () => setTimeout(handleResize, 100));

        if (window.ResizeObserver && this.container) {
            this.resizeObserver = new ResizeObserver(() => this.updateLayout());
            this.resizeObserver.observe(this.container);
        }

        this.updateLayout();
    }

    private initializeModelRenderer(modelContainer: HTMLElement): void {
        try {
            this.modelRenderer = new IntroductionModelRenderer({
                container: modelContainer,
                materialManager: this.materialManager || undefined,
                enableFallbacks: true,
                onError: (error, fallbackMode) => {
                    console.error('IntroductionModelRenderer error:', error);
                    if (fallbackMode) console.log('Model renderer in fallback mode');
                },
                onLoadingStateChange: (isLoading) => {
                    console.log(`Model loading: ${isLoading ? 'loading' : 'ready'}`);
                }
            });
            this.state.modelRenderer = this.modelRenderer;
        } catch (error) {
            console.error('Failed to initialize IntroductionModelRenderer:', error);
            showModelError(modelContainer, 'Failed to initialize 3D renderer');
        }
    }

    private async loadModelForCurrentPage(): Promise<void> {
        if (!this.modelRenderer || this.state.isModelLoading) return;

        try {
            this.state.isModelLoading = true;
            await this.modelRenderer.loadModelForPage(this.currentPageIndex);
            const modelTypes = ['empire-emblem', 'desert-planet', 'terrain-closeup',
                               'energy-lords-emblem', 'parasites', 'orbital-system'];
            this.state.currentModelType = modelTypes[this.currentPageIndex] || null;
        } catch (error) {
            console.error(`Failed to load 3D model for page ${this.currentPageIndex + 1}:`, error);
        } finally {
            this.state.isModelLoading = false;
        }
    }

    private updateLayout(): void {
        if (!this.uiElements) return;

        const elements: ResponsiveElements = {
            pageContainer: this.uiElements.pageContainer,
            titleElement: this.uiElements.titleElement,
            contentElement: this.uiElements.contentElement,
            nextButton: this.uiElements.nextButton,
            skipCheckbox: this.uiElements.skipCheckbox,
            skipLabel: this.uiElements.skipLabel
        };

        updateResponsiveLayout(elements, this.viewportInfo, {
            onSwipeLeft: () => this.handleSwipeNavigation(),
            getThemePrimaryText: () => this.textColorizer.getTheme().primaryText
        });
    }

    private handleSwipeNavigation(): void {
        if (!this.state.isTypewriterActive && this.uiElements?.nextButton && !this.uiElements.nextButton.disabled) {
            this.handleNextClick();
        }
    }

    private loadPreferences(): void {
        try {
            this.state.skipIntroduction = this.preferenceManager.getSkipIntroduction();
        } catch (error) {
            console.error('Error loading preferences:', error);
            this.state.skipIntroduction = false;
        }
    }

    private loadStoryContent(): void {
        try {
            this.storyContent = StoryContentParser.getPredefinedStoryContent();
            if (!StoryContentParser.validateStoryContent(this.storyContent)) {
                this.storyContent = this.createFallbackStoryContent();
            }
        } catch (error) {
            console.error('Error loading story content:', error);
            this.storyContent = this.createFallbackStoryContent();
        }
    }

    private createFallbackStoryContent(): StoryContent {
        return {
            pages: [{
                title: "Welcome to The Energy Lords",
                content: "Welcome to Nexus of Mind. You are about to embark on a journey...",
                isLastPage: true,
                pageNumber: 1,
                metadata: { empireName: 'Korenthi', guildName: 'The Energy Lords', version: '1.0.0' }
            }],
            metadata: { empireName: 'Korenthi', guildName: 'The Energy Lords', version: '1.0.0' }
        };
    }

    private createUI(): void {
        if (!this.container) return;

        this.uiElements = buildIntroductionUI(this.container, {
            onNextClick: () => this.handleNextClick(),
            onSkipChange: () => this.handleSkipCheckboxChange(),
            getThemePrimaryText: () => this.textColorizer.getTheme().primaryText
        });

        // Initialize model renderer
        this.initializeModelRenderer(this.uiElements.modelArea);

        // Initialize checkbox state
        this.initializeCheckboxState();

        // Setup swipe gestures
        if (this.viewportInfo.isMobile && this.uiElements.pageContainer) {
            setupSwipeGestures(this.uiElements.pageContainer, () => this.handleSwipeNavigation());
        }
    }

    private initializeCheckboxState(): void {
        if (!this.uiElements) return;
        this.uiElements.skipCheckbox.checked = this.state.skipIntroduction;
        updateCheckboxVisualState(this.uiElements.skipCheckbox, this.uiElements.skipLabel);
    }

    private handleNextClick(): void {
        if (this.state.isTypewriterActive || !this.storyContent) return;

        if (this.currentPageIndex >= this.storyContent.pages.length - 1) {
            this.handleComplete();
            return;
        }

        this.advanceToNextPage();
    }

    private advanceToNextPage(): void {
        if (!this.storyContent) return;
        this.currentPageIndex++;
        this.state.currentPage = this.currentPageIndex;
        this.displayCurrentPage();
    }

    private handleSkipCheckboxChange(): void {
        if (!this.uiElements?.skipCheckbox) return;

        if (!this.uiElements.skipCheckbox.checked) {
            updateCheckboxVisualState(this.uiElements.skipCheckbox, this.uiElements.skipLabel);
            return;
        }

        this.state.skipIntroduction = true;
        try {
            this.preferenceManager.setSkipIntroduction(true);
        } catch (error) {
            console.error('Error saving preference:', error);
        }

        this.handleComplete();
    }

    private displayCurrentPage(): void {
        if (!this.uiElements || !this.storyContent) return;

        const currentPage = this.storyContent.pages[this.currentPageIndex];
        if (!currentPage) return;

        this.uiElements.titleElement.textContent = currentPage.title;
        this.state.isTypewriterActive = false;

        const colorizedContent = this.textColorizer.colorizeText(currentPage.content);
        this.uiElements.contentElement.innerHTML = colorizedContent;

        this.updateButtonState();
        this.loadModelForCurrentPage();
    }

    private updateButtonState(): void {
        if (!this.uiElements || !this.storyContent) return;

        const currentPage = this.storyContent.pages[this.currentPageIndex];
        if (!currentPage) return;

        const isLastPage = currentPage.isLastPage || this.currentPageIndex >= this.storyContent.pages.length - 1;
        updateButtonState(this.uiElements.nextButton, isLastPage, this.state.isTypewriterActive);
    }

    private handleComplete(): void {
        // Auto-save skip preference so intro doesn't show again after completion
        if (!this.state.skipIntroduction) {
            this.state.skipIntroduction = true;
            try {
                this.preferenceManager.setSkipIntroduction(true);
            } catch (error) {
                console.error('Error saving skip preference on completion:', error);
            }
        }
        this.hide();
        this.config.onComplete();
    }

    // ==================== Public API ====================

    public shouldSkipIntroduction(): boolean {
        return this.preferenceManager.getSkipIntroduction();
    }

    public resetPreferences(): boolean {
        try {
            const success = this.preferenceManager.resetToDefaults();
            if (success) {
                this.state.skipIntroduction = false;
                if (this.uiElements) {
                    this.uiElements.skipCheckbox.checked = false;
                    this.initializeCheckboxState();
                }
            }
            return success;
        } catch (error) {
            console.error('Error resetting preferences:', error);
            return false;
        }
    }

    public clearPreferences(): boolean {
        try {
            const success = this.preferenceManager.clearPreferences();
            if (success) {
                this.state.skipIntroduction = false;
                if (this.uiElements) {
                    this.uiElements.skipCheckbox.checked = false;
                    this.initializeCheckboxState();
                }
            }
            return success;
        } catch (error) {
            console.error('Error clearing preferences:', error);
            return false;
        }
    }

    public getPreferenceManager(): PreferenceManager {
        return this.preferenceManager;
    }

    public show(): void {
        if (!this.container) return;
        this.state.isVisible = true;
        this.container.style.display = 'block';
        this.currentPageIndex = 0;
        this.state.currentPage = 0;
        this.displayCurrentPage();
    }

    public hide(): void {
        if (!this.container) return;
        this.state.isVisible = false;
        this.container.style.display = 'none';
    }

    public getState(): IntroductionState {
        return { ...this.state };
    }

    public getStoryContent(): StoryContent | null {
        return this.storyContent;
    }

    public getCurrentPage(): StoryPage | null {
        if (!this.storyContent || this.currentPageIndex >= this.storyContent.pages.length) {
            return null;
        }
        return this.storyContent.pages[this.currentPageIndex];
    }

    public getTypewriterEffect(): TypewriterEffect | null {
        return this.typewriterEffect;
    }

    public isTypewriterActive(): boolean {
        return this.state.isTypewriterActive;
    }

    public getViewportInfo(): ViewportInfo {
        return { ...this.viewportInfo };
    }

    public getModelRenderer(): IntroductionModelRenderer | null {
        return this.modelRenderer;
    }

    public isModelLoading(): boolean {
        return this.state.isModelLoading;
    }

    public getCurrentModelType(): string | null {
        return this.state.currentModelType;
    }

    public updateLayoutPublic(): void {
        this.viewportInfo = detectViewport();
        this.updateLayout();
    }

    public dispose(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        if (this.modelRenderer) {
            this.modelRenderer.dispose();
            this.modelRenderer = null;
        }

        if (this.materialManager) {
            this.materialManager.dispose();
            this.materialManager = null;
        }

        if (this.typewriterEffect) {
            this.typewriterEffect.dispose();
            this.typewriterEffect = null;
        }

        if (this.container) {
            this.container.innerHTML = '';
        }

        this.state = {
            currentPage: 0,
            isTypewriterActive: false,
            skipIntroduction: false,
            isVisible: false,
            modelRenderer: null,
            isModelLoading: false,
            currentModelType: null
        };

        this.uiElements = null;
    }
}
