/**
 * IntroductionScreen - Immersive narrative introduction for Nexus of Mind
 * 
 * Displays the Energy Lords origin story with typewriter animation effects,
 * allowing players to understand the game's lore and context before gameplay.
 * Integrates with the existing game initialization flow and follows the
 * established SciFi aesthetic of the Nexus of Mind interface.
 */

import { StoryContentParser, StoryContent, StoryPage } from './StoryContentParser';
import { TypewriterEffect } from './TypewriterEffect';
import { PreferenceManager } from './PreferenceManager';
import { TextColorizer } from './TextColorizer';
import { IntroductionModelRenderer } from './IntroductionModelRenderer';
import { MaterialManager } from '../rendering/MaterialManager';

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

export interface ViewportInfo {
    width: number;
    height: number;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    orientation: 'portrait' | 'landscape';
}

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
    private pageContainer: HTMLElement | null = null;
    private titleElement: HTMLElement | null = null;
    private contentElement: HTMLElement | null = null;
    private nextButton: HTMLButtonElement | null = null;
    private skipCheckbox: HTMLInputElement | null = null;
    private skipLabel: HTMLLabelElement | null = null;

    constructor(config: IntroductionScreenConfig) {
        this.config = {
            skipPreferenceKey: 'skipIntroduction',
            ...config
        };

        // Initialize PreferenceManager (Requirements: 3.2, 3.3, 3.4)
        this.preferenceManager = new PreferenceManager({
            storageKey: this.config.skipPreferenceKey || 'skipIntroduction',
            fallbackToMemory: true
        });

        // Initialize TextColorizer for enhanced text readability (Requirements: 8.1, 8.2)
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

        // Initialize viewport information for responsive design (Requirement 7.5)
        this.viewportInfo = this.detectViewport();

        this.initialize();
    }

    /**
     * Initialize the Introduction Screen
     */
    private initialize(): void {
        this.container = document.getElementById(this.config.containerId);

        if (!this.container) {
            // Create container if it doesn't exist
            this.container = document.createElement('div');
            this.container.id = this.config.containerId;
            this.container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 10000;
                display: none;
            `;
            document.body.appendChild(this.container);
        }

        // Load preference state on initialization (Requirements: 3.1, 5.2)
        this.loadPreferences();

        this.loadStoryContent();
        this.createUI();
        this.setupResponsiveHandlers();
    }

    /**
     * Detect viewport size and device characteristics for responsive design
     * Requirements: 7.5 - Viewport size detection and layout adjustment
     */
    private detectViewport(): ViewportInfo {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Device breakpoints based on common standards
        const isMobile = width <= 768;
        const isTablet = width > 768 && width <= 1024;
        const isDesktop = width > 1024;
        
        // Orientation detection
        const orientation = width > height ? 'landscape' : 'portrait';
        
        return {
            width,
            height,
            isMobile,
            isTablet,
            isDesktop,
            orientation
        };
    }

    /**
     * Setup responsive event handlers and observers
     * Requirements: 7.5 - Responsive layout handling
     */
    private setupResponsiveHandlers(): void {
        // Handle window resize events
        const handleResize = () => {
            this.viewportInfo = this.detectViewport();
            this.updateResponsiveLayout();
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', () => {
            // Delay to allow orientation change to complete
            setTimeout(handleResize, 100);
        });

        // Setup ResizeObserver for container changes if supported
        if (window.ResizeObserver && this.container) {
            this.resizeObserver = new ResizeObserver(() => {
                this.updateResponsiveLayout();
            });
            this.resizeObserver.observe(this.container);
        }

        // Initial layout update
        this.updateResponsiveLayout();
    }

    /**
     * Initialize the 3D model renderer for the introduction screen
     * Requirements: 9.1, 9.6, 9.8 - Initialize IntroductionModelRenderer instance
     */
    private initializeModelRenderer(modelContainer: HTMLElement): void {
        try {
            // Create MaterialManager instance if not already created
            // Note: In a real implementation, this would be passed from the main game
            // For now, we'll create a temporary scene to initialize MaterialManager
            if (!this.materialManager) {
                // We'll initialize MaterialManager when we have a proper scene
                // This is a placeholder for the integration
                console.log('MaterialManager will be initialized with scene from IntroductionModelRenderer');
            }

            // Initialize IntroductionModelRenderer with error handling callbacks
            this.modelRenderer = new IntroductionModelRenderer({
                container: modelContainer,
                materialManager: this.materialManager || undefined,
                enableFallbacks: true,
                onError: (error: Error, fallbackMode: boolean) => {
                    console.error('IntroductionModelRenderer error:', error);
                    if (fallbackMode) {
                        console.log('Model renderer has entered fallback mode');
                        // The model renderer will handle showing appropriate fallback content
                    }
                },
                onLoadingStateChange: (isLoading: boolean) => {
                    // Could be used to show/hide loading indicators in the main UI
                    console.log(`Model renderer loading state: ${isLoading ? 'loading' : 'ready'}`);
                }
            });

            // Update state
            this.state.modelRenderer = this.modelRenderer;

            console.log('IntroductionModelRenderer initialized successfully');

        } catch (error) {
            console.error('Failed to initialize IntroductionModelRenderer:', error);
            this.showModelError(modelContainer, 'Failed to initialize 3D renderer');
        }
    }

    /**
     * Show error message in model area when initialization or loading fails
     * Requirements: 9.8 - Error handling for model rendering
     */
    private showModelError(container: HTMLElement, errorMessage: string): void {
        container.innerHTML = `
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
                <div style="margin-bottom: 10px;">⚠️ 3D Model Error</div>
                <div style="font-size: 10px; opacity: 0.7; margin-bottom: 10px;">${errorMessage}</div>
                <div style="font-size: 9px; opacity: 0.6; font-style: italic;">
                    The introduction will continue with text descriptions
                </div>
            </div>
        `;
    }

    /**
     * Load 3D model for the current page
     * Requirements: 9.8 - Model loading on page transitions
     */
    private async loadModelForCurrentPage(): Promise<void> {
        if (!this.modelRenderer || this.state.isModelLoading) {
            return;
        }

        try {
            // Set loading state
            this.state.isModelLoading = true;
            
            // Load model for current page
            await this.modelRenderer.loadModelForPage(this.currentPageIndex);
            
            // Update state with current model type
            const modelTypes = [
                'empire-emblem',
                'desert-planet', 
                'terrain-closeup',
                'energy-lords-emblem',
                'parasites',
                'orbital-system'
            ];
            
            this.state.currentModelType = modelTypes[this.currentPageIndex] || null;
            
            console.log(`Loaded 3D model for page ${this.currentPageIndex + 1}: ${this.state.currentModelType}`);

        } catch (error) {
            console.error(`Failed to load 3D model for page ${this.currentPageIndex + 1}:`, error);
            // Model renderer will handle showing error placeholder
        } finally {
            // Clear loading state
            this.state.isModelLoading = false;
        }
    }

    /**
     * Update responsive layout based on current viewport information
     * Requirements: 7.5 - Ensure text readability across different screen sizes
     */
    private updateResponsiveLayout(): void {
        if (!this.pageContainer || !this.titleElement || !this.contentElement || !this.nextButton) {
            return;
        }

        const { isMobile, isTablet, orientation } = this.viewportInfo;

        // Update page container responsive styles
        this.updatePageContainerLayout(isMobile, isTablet, orientation);
        
        // Update typography for readability
        this.updateTypographyLayout(isMobile, isTablet);
        
        // Update controls layout
        this.updateControlsLayout(isMobile, isTablet, orientation);
        
        // Update touch interactions for mobile
        this.updateTouchInteractions(isMobile);

        console.log(`Layout updated for ${isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'} (${orientation})`);
    }

    /**
     * Update page container layout for different screen sizes
     * Requirements: 7.5 - Responsive layout adjustment, 9.7 - Mobile model area collapse
     */
    private updatePageContainerLayout(isMobile: boolean, isTablet: boolean, orientation: string): void {
        if (!this.pageContainer) return;

        const modelArea = this.pageContainer.querySelector('.introduction-model-area') as HTMLElement;
        const storyArea = this.pageContainer.querySelector('.introduction-story-area') as HTMLElement;

        let containerStyles: string;
        let modelAreaStyles: string = '';
        let storyAreaStyles: string = '';

        if (isMobile) {
            // Mobile layout - collapse model area, full screen story (Requirement 9.7)
            containerStyles = `
                background: rgba(0, 10, 20, 0.9);
                border: 1px solid rgba(0, 255, 255, 0.6);
                border-radius: 0;
                padding: 0;
                max-width: 100%;
                width: 100%;
                max-height: 100vh;
                height: 100vh;
                overflow: hidden;
                backdrop-filter: blur(8px);
                box-shadow: none;
                position: relative;
                display: flex;
                flex-direction: column;
            `;

            // Hide model area on mobile
            modelAreaStyles = `
                display: none;
            `;

            // Story area takes full width
            storyAreaStyles = `
                flex: 1;
                padding: 20px 16px;
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                max-height: 100vh;
                background: rgba(0, 10, 20, 0.85);
            `;
        } else if (isTablet) {
            // Tablet layout - smaller model area, adjusted story area
            containerStyles = `
                background: rgba(0, 10, 20, 0.85);
                border: 2px solid rgba(0, 255, 255, 0.6);
                border-radius: 8px;
                padding: 0;
                max-width: 95%;
                width: 95%;
                max-height: 85vh;
                overflow: hidden;
                backdrop-filter: blur(10px);
                box-shadow: 0 0 25px rgba(0, 255, 255, 0.3), inset 0 0 30px rgba(0, 100, 150, 0.1);
                position: relative;
                display: flex;
                flex-direction: row;
            `;

            // Smaller model area for tablet
            modelAreaStyles = `
                width: 250px;
                min-width: 250px;
                height: 100%;
                background: rgba(0, 10, 20, 0.85);
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            `;

            // Adjusted story area for tablet
            storyAreaStyles = `
                flex: 1;
                padding: 32px 24px;
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                max-height: 85vh;
                background: rgba(0, 10, 20, 0.85);
            `;
        } else {
            // Desktop layout - full split layout with 300px model area
            containerStyles = `
                background: rgba(0, 10, 20, 0.85);
                border: 2px solid rgba(0, 255, 255, 0.6);
                border-radius: 8px;
                padding: 0;
                max-width: 1200px;
                width: 95%;
                max-height: 85vh;
                overflow: hidden;
                backdrop-filter: blur(10px);
                box-shadow: 0 0 30px rgba(0, 255, 255, 0.3), inset 0 0 40px rgba(0, 100, 150, 0.1);
                position: relative;
                display: flex;
                flex-direction: row;
            `;

            // Full model area for desktop
            modelAreaStyles = `
                width: 300px;
                min-width: 300px;
                height: 100%;
                background: rgba(0, 10, 20, 0.85);
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            `;

            // Full story area for desktop
            storyAreaStyles = `
                flex: 1;
                padding: 40px;
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                max-height: 85vh;
                background: rgba(0, 10, 20, 0.85);
            `;
        }

        this.pageContainer.style.cssText += containerStyles;

        // Apply model area styles
        if (modelArea) {
            modelArea.style.cssText = modelAreaStyles;
        }

        // Apply story area styles
        if (storyArea) {
            storyArea.style.cssText = storyAreaStyles;
        }
    }

    /**
     * Update typography for different screen sizes to ensure readability
     * Requirements: 7.5 - Ensure text readability across different screen sizes
     */
    private updateTypographyLayout(isMobile: boolean, isTablet: boolean): void {
        if (!this.titleElement || !this.contentElement) return;

        if (isMobile) {
            // Mobile typography - smaller, more readable
            this.titleElement.style.cssText = `
                font-size: 18px;
                font-weight: 700;
                color: #00ffff;
                text-shadow: 0 0 10px rgba(0, 255, 255, 0.6);
                text-align: center;
                margin-bottom: 20px;
                letter-spacing: 1px;
                text-transform: uppercase;
                font-family: 'Orbitron', monospace;
                line-height: 1.3;
            `;

            this.contentElement.style.cssText = `
                font-size: 14px;
                line-height: 1.8;
                color: ${this.textColorizer.getTheme().primaryText};
                margin-bottom: 20px;
                min-height: 150px;
                white-space: pre-wrap;
                font-family: 'Orbitron', monospace;
                flex: 1;
                overflow-y: auto;
                letter-spacing: 0.8px;
                word-spacing: 2px;
            `;
        } else if (isTablet) {
            // Tablet typography - medium size
            this.titleElement.style.cssText = `
                font-size: 20px;
                font-weight: 700;
                color: #00ffff;
                text-shadow: 0 0 12px rgba(0, 255, 255, 0.6);
                text-align: center;
                margin-bottom: 25px;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                font-family: 'Orbitron', monospace;
                line-height: 1.3;
            `;

            this.contentElement.style.cssText = `
                font-size: 15px;
                line-height: 1.9;
                color: ${this.textColorizer.getTheme().primaryText};
                margin-bottom: 30px;
                min-height: 180px;
                white-space: pre-wrap;
                font-family: 'Orbitron', monospace;
                letter-spacing: 0.8px;
                word-spacing: 2px;
            `;
        } else {
            // Desktop typography - original size
            this.titleElement.style.cssText = `
                font-size: 24px;
                font-weight: 700;
                color: #00ffff;
                text-shadow: 0 0 15px rgba(0, 255, 255, 0.6);
                text-align: center;
                margin-bottom: 30px;
                letter-spacing: 2px;
                text-transform: uppercase;
                font-family: 'Orbitron', monospace;
            `;

            this.contentElement.style.cssText = `
                font-size: 16px;
                line-height: 2.0;
                color: ${this.textColorizer.getTheme().primaryText};
                margin-bottom: 40px;
                min-height: 200px;
                white-space: pre-wrap;
                font-family: 'Orbitron', monospace;
                letter-spacing: 0.8px;
                word-spacing: 2px;
            `;
        }
    }

    /**
     * Update controls layout for different screen sizes and orientations
     * Requirements: 7.5 - Responsive layout adjustment
     */
    private updateControlsLayout(isMobile: boolean, isTablet: boolean, orientation: string): void {
        const controlsContainer = this.nextButton?.parentElement;
        if (!controlsContainer) return;

        if (isMobile) {
            // Mobile controls - stack vertically or adjust for orientation
            const mobileControlsStyle = orientation === 'portrait' ? `
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
                margin-top: 20px;
                padding-top: 16px;
                border-top: 1px solid rgba(0, 255, 255, 0.3);
            ` : `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 16px;
                padding-top: 12px;
                border-top: 1px solid rgba(0, 255, 255, 0.3);
                flex-wrap: wrap;
                gap: 12px;
            `;

            controlsContainer.style.cssText = mobileControlsStyle;

            // Update button size for mobile
            if (this.nextButton) {
                this.nextButton.style.cssText += `
                    padding: 14px 28px;
                    font-size: 16px;
                    min-width: 140px;
                    touch-action: manipulation;
                `;
            }
        } else if (isTablet) {
            // Tablet controls - similar to desktop but slightly larger touch targets
            controlsContainer.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 25px;
                padding-top: 18px;
                border-top: 1px solid rgba(0, 255, 255, 0.3);
                flex-wrap: wrap;
                gap: 14px;
            `;

            if (this.nextButton) {
                this.nextButton.style.cssText += `
                    padding: 13px 26px;
                    font-size: 15px;
                    min-width: 130px;
                    touch-action: manipulation;
                `;
            }
        } else {
            // Desktop controls - original layout
            controlsContainer.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid rgba(0, 255, 255, 0.3);
                flex-wrap: wrap;
                gap: 16px;
            `;

            if (this.nextButton) {
                this.nextButton.style.cssText += `
                    padding: 12px 24px;
                    font-size: 14px;
                    min-width: 120px;
                `;
            }
        }
    }

    /**
     * Update touch interactions for mobile devices
     * Requirements: 7.5 - Add mobile-friendly touch interactions
     */
    private updateTouchInteractions(isMobile: boolean): void {
        if (!isMobile) return;

        // Enhanced touch interactions for mobile
        if (this.nextButton) {
            // Add touch feedback
            this.nextButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.nextButton!.style.transform = 'scale(0.95)';
                this.nextButton!.style.transition = 'transform 0.1s ease';
            });

            this.nextButton.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.nextButton!.style.transform = 'scale(1)';
                setTimeout(() => {
                    this.nextButton!.style.transition = 'all 0.3s ease';
                }, 100);
            });

            // Prevent double-tap zoom on button
            this.nextButton.style.touchAction = 'manipulation';
        }

        if (this.skipCheckbox && this.skipLabel) {
            // Larger touch target for skip toggle
            const skipContainer = this.skipCheckbox.parentElement;
            if (skipContainer) {
                skipContainer.style.cssText += `
                    padding: 12px 16px;
                    min-height: 44px;
                    touch-action: manipulation;
                `;
            }

            // Larger label touch target
            this.skipLabel.style.cssText += `
                font-size: 14px;
                padding: 8px 12px;
                touch-action: manipulation;
            `;
        }

        // Prevent zoom on double-tap for content area
        if (this.contentElement) {
            this.contentElement.style.touchAction = 'pan-y';
        }

        // Add swipe gesture support for page navigation (optional enhancement)
        this.addSwipeGestures();
    }

    /**
     * Add swipe gesture support for mobile navigation
     * Requirements: 7.5 - Mobile-friendly touch interactions
     */
    private addSwipeGestures(): void {
        if (!this.pageContainer) return;

        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;

        this.pageContainer.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });

        this.pageContainer.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            endY = e.changedTouches[0].clientY;

            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const minSwipeDistance = 50;

            // Only process horizontal swipes that are longer than vertical
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                // Swipe left to go to next page (if not during typewriter animation)
                if (deltaX < 0 && !this.state.isTypewriterActive && this.nextButton && !this.nextButton.disabled) {
                    this.handleNextClick();
                }
                // Note: Swipe right for previous page could be added here if needed
            }
        });
    }

    /**
     * Load preferences and update state
     * Requirements: 3.1, 3.5 - Preference checking on initialization
     */
    private loadPreferences(): void {
        try {
            // Get skip introduction preference (Requirement 3.3)
            const skipIntroduction = this.preferenceManager.getSkipIntroduction();
            this.state.skipIntroduction = skipIntroduction;
            
            console.log(`Loaded skip introduction preference: ${skipIntroduction}`);
            console.log(`Storage mechanism: ${this.preferenceManager.getStorageMechanism()}`);
        } catch (error) {
            console.error('Error loading preferences:', error);
            // Fallback to default state
            this.state.skipIntroduction = false;
        }
    }

    /**
     * Load story content using the StoryContentParser
     */
    private loadStoryContent(): void {
        try {
            // For now, use predefined content since we can't directly read files in browser
            // In a real implementation, this would fetch story.md from the server
            this.storyContent = StoryContentParser.getPredefinedStoryContent();
            
            // Validate the loaded content
            if (!StoryContentParser.validateStoryContent(this.storyContent)) {
                console.warn('Story content validation failed, using fallback');
                this.storyContent = this.createFallbackStoryContent();
            }
        } catch (error) {
            console.error('Error loading story content:', error);
            this.storyContent = this.createFallbackStoryContent();
        }
    }

    /**
     * Create fallback story content when loading fails
     */
    private createFallbackStoryContent(): StoryContent {
        return {
            pages: [{
                title: "Welcome to The Energy Lords",
                content: "Welcome to Nexus of Mind. You are about to embark on a journey as a member of The Energy Lords, an elite guild tasked with mining precious energy resources from a hostile alien world.\n\nYour mission is critical to the survival of your civilization. Prepare yourself for the challenges ahead.",
                isLastPage: true,
                pageNumber: 1,
                metadata: {
                    empireName: 'Korenthi',
                    guildName: 'The Energy Lords',
                    version: '1.0.0'
                }
            }],
            metadata: {
                empireName: 'Korenthi',
                guildName: 'The Energy Lords',
                version: '1.0.0'
            }
        };
    }

    /**
     * Create the UI elements following established SciFi aesthetic patterns
     */
    private createUI(): void {
        if (!this.container) return;

        // Clear existing content
        this.container.innerHTML = '';

        // Main introduction container with black background (Requirement 4.5)
        const introContainer = document.createElement('div');
        introContainer.className = 'introduction-screen';
        introContainer.style.cssText = `
            width: 100%;
            height: 100%;
            background: #000000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Orbitron', monospace;
            color: #00ffff;
            position: relative;
        `;

        // Content panel with SciFi styling matching existing components (Requirements 4.1, 4.2, 4.3, 4.6)
        this.pageContainer = document.createElement('div');
        this.pageContainer.className = 'introduction-content';
        this.pageContainer.style.cssText = `
            background: rgba(0, 10, 20, 0.85);
            border: 2px solid rgba(0, 255, 255, 0.6);
            border-radius: 8px;
            padding: 0;
            max-width: 1200px;
            width: 95%;
            max-height: 85vh;
            overflow: hidden;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 30px rgba(0, 255, 255, 0.3), inset 0 0 40px rgba(0, 100, 150, 0.1);
            position: relative;
            display: flex;
            flex-direction: row;
        `;

        // Create 3D model area (300px width) - Requirements 9.1, 9.4
        const modelArea = document.createElement('div');
        modelArea.className = 'introduction-model-area';
        modelArea.id = 'introduction-model-container';
        modelArea.style.cssText = `
            width: 300px;
            min-width: 300px;
            align-self: stretch;
            background: rgba(0, 10, 20, 0.85);
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        `;


        // Add placeholder content for model area
        const modelPlaceholder = document.createElement('div');
        modelPlaceholder.className = 'model-placeholder';
        modelPlaceholder.style.cssText = `
            color: rgba(0, 255, 255, 0.6);
            font-size: 12px;
            text-align: center;
            font-family: 'Orbitron', monospace;
            letter-spacing: 1px;
            text-transform: uppercase;
            padding: 20px;
            border: 1px dashed rgba(0, 255, 255, 0.3);
            border-radius: 4px;
            background: rgba(0, 20, 40, 0.3);
        `;
        modelPlaceholder.innerHTML = `
            <div style="margin-bottom: 10px;">3D Model</div>
            <div style="font-size: 10px; opacity: 0.7;">Loading...</div>
        `;

        modelArea.appendChild(modelPlaceholder);

        // Initialize 3D model renderer (Requirements: 9.1, 9.6, 9.8)
        this.initializeModelRenderer(modelArea);

        // Create story content area (remaining width)
        const storyArea = document.createElement('div');
        storyArea.className = 'introduction-story-area';
        storyArea.style.cssText = `
            flex: 1;
            padding: 40px;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            max-height: 85vh;
            background: rgba(0, 10, 20, 0.85);
        `;

        // Title element with consistent SciFi styling (Requirements 4.1, 4.3)
        this.titleElement = document.createElement('h1');
        this.titleElement.style.cssText = `
            font-size: 24px;
            font-weight: 700;
            color: #00ffff;
            text-shadow: 0 0 15px rgba(0, 255, 255, 0.6);
            text-align: center;
            margin-bottom: 30px;
            letter-spacing: 2px;
            text-transform: uppercase;
            font-family: 'Orbitron', monospace;
        `;

        // Content element for story text (Requirements 4.1, 4.3)
        this.contentElement = document.createElement('div');
        this.contentElement.style.cssText = `
            font-size: 16px;
            line-height: 2.0;
            color: ${this.textColorizer.getTheme().primaryText};
            margin-bottom: 40px;
            min-height: 200px;
            white-space: pre-wrap;
            font-family: 'Orbitron', monospace;
            letter-spacing: 0.8px;
            word-spacing: 2px;
            flex: 1;
        `;

        // Controls container with proper spacing
        const controlsContainer = document.createElement('div');
        controlsContainer.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid rgba(0, 255, 255, 0.3);
            flex-wrap: wrap;
            gap: 16px;
            flex-shrink: 0;
        `;

        // Skip checkbox and label with enhanced styling (Requirements 3.1, 4.4, 6.3)
        const skipContainer = document.createElement('div');
        skipContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            background: rgba(0, 20, 40, 0.4);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 4px;
            transition: all 0.3s ease;
        `;

        // Hidden checkbox for state management (Requirements 6.3, 6.4)
        this.skipCheckbox = document.createElement('input') as HTMLInputElement;
        this.skipCheckbox.type = 'checkbox';
        this.skipCheckbox.id = 'skip-introduction-checkbox';
        this.skipCheckbox.style.cssText = `
            position: absolute;
            opacity: 0;
            width: 0;
            height: 0;
            pointer-events: none;
        `;

        this.skipLabel = document.createElement('label') as HTMLLabelElement;
        this.skipLabel.htmlFor = 'skip-introduction-checkbox';
        this.skipLabel.style.cssText = `
            font-size: 12px;
            color: rgba(0, 255, 255, 0.9);
            cursor: pointer;
            user-select: none;
            font-family: 'Orbitron', monospace;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            transition: all 0.15s ease;
            padding: 4px 8px;
        `;
        this.skipLabel.textContent = "Don't show again";

        skipContainer.appendChild(this.skipCheckbox);
        skipContainer.appendChild(this.skipLabel);

        // Next/Continue button with enhanced styling matching existing components (Requirements 2.5, 4.4, 6.3)
        this.nextButton = document.createElement('button') as HTMLButtonElement;
        this.nextButton.style.cssText = `
            background: rgba(0, 40, 80, 0.6);
            border: 2px solid #00ffff;
            border-radius: 6px;
            color: #00ffff;
            padding: 12px 24px;
            font-family: 'Orbitron', monospace;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
            min-width: 120px;
            position: relative;
            overflow: hidden;
        `;
        this.nextButton.textContent = 'NEXT';
        this.nextButton.disabled = true;

        // Button click handler with immediate response (Requirement 6.2)
        this.nextButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.handleNextClick();
        });

        // Checkbox change handler with immediate response (Requirement 6.2)
        this.skipCheckbox.addEventListener('change', (event) => {
            event.stopPropagation();
            this.handleSkipCheckboxChange();
        });

        // Assemble controls
        controlsContainer.appendChild(skipContainer);
        controlsContainer.appendChild(this.nextButton);

        // Assemble story area
        storyArea.appendChild(this.titleElement);
        storyArea.appendChild(this.contentElement);
        storyArea.appendChild(controlsContainer);

        // Assemble page container with split layout
        this.pageContainer.appendChild(modelArea);
        this.pageContainer.appendChild(storyArea);

        // Assemble main container
        introContainer.appendChild(this.pageContainer);
        this.container.appendChild(introContainer);

        // Initialize checkbox state based on loaded preferences (Requirements: 3.1, 3.5)
        this.initializeCheckboxState();
    }

    /**
     * Initialize checkbox state based on loaded preferences
     * Requirements: 3.1, 3.5 - Connect checkbox state to preference storage
     */
    private initializeCheckboxState(): void {
        if (!this.skipCheckbox || !this.skipLabel) return;

        // Set checkbox state based on loaded preference
        this.skipCheckbox.checked = this.state.skipIntroduction;

        // Update visual state to match checkbox state
        if (this.skipCheckbox.checked) {
            this.skipLabel.style.color = '#00ff88'; // Green when checked
            this.skipLabel.style.textShadow = '0 0 5px rgba(0, 255, 136, 0.5)';
        } else {
            this.skipLabel.style.color = 'rgba(0, 255, 255, 0.9)'; // Default cyan
            this.skipLabel.style.textShadow = 'none';
        }

        console.log(`Checkbox initialized with preference state: ${this.state.skipIntroduction}`);
    }

    /**
     * Handle Next button click with enhanced navigation logic
     * Requirements: 2.3, 2.4, 6.1, 6.2
     */
    private handleNextClick(): void {
        // Prevent navigation during typewriter animation (Requirement 6.1)
        if (this.state.isTypewriterActive || !this.storyContent) {
            return;
        }

        // Check if this is the last page (Requirement 2.4)
        if (this.currentPageIndex >= this.storyContent.pages.length - 1) {
            // Last page - complete the introduction (Requirement 2.5)
            this.handleComplete();
            return;
        }

        // Advance to next page (Requirement 2.3)
        this.advanceToNextPage();
    }

    /**
     * Advance to the next page with proper state management
     * Requirements: 2.3, 6.1
     */
    private advanceToNextPage(): void {
        if (!this.storyContent) return;

        // Update page index
        this.currentPageIndex++;
        this.state.currentPage = this.currentPageIndex;

        // Display the new page
        this.displayCurrentPage();

        // Log navigation for debugging
        console.log(`Navigated to page ${this.currentPageIndex + 1} of ${this.storyContent.pages.length}`);
    }

    /**
     * Handle skip checkbox change - immediately skips to game
     * Requirements: 3.1, 3.2, 6.3, 6.4
     */
    private handleSkipCheckboxChange(): void {
        if (!this.skipCheckbox) return;

        // Only act when checked (skip button pressed)
        if (!this.skipCheckbox.checked) {
            // If unchecked, just update visual state
            if (this.skipLabel) {
                this.skipLabel.style.color = 'rgba(0, 255, 255, 0.9)';
                this.skipLabel.style.textShadow = 'none';
            }
            return;
        }

        // Update state
        this.state.skipIntroduction = true;

        // Save preference to storage so next refresh skips intro entirely
        try {
            const success = this.preferenceManager.setSkipIntroduction(true);
            if (!success) {
                console.warn('Failed to save skip introduction preference');
            }
        } catch (error) {
            console.error('Error saving skip introduction preference:', error);
        }

        console.log('Skip introduction - going directly to game');

        // Immediately skip the rest of the story and go to game
        this.handleComplete();
    }

    /**
     * Display the current page with typewriter effect and proper state management
     * Requirements: 2.1, 6.1, 6.2, 9.8 - Model loading on page transitions
     */
    private displayCurrentPage(): void {
        if (!this.titleElement || !this.contentElement || !this.nextButton || !this.storyContent) return;

        const currentPage = this.storyContent.pages[this.currentPageIndex];
        if (!currentPage) {
            console.warn('No page found at index:', this.currentPageIndex);
            return;
        }

        // Update title
        this.titleElement.textContent = currentPage.title;

        // Clear content
        this.contentElement.textContent = '';

        // TEMPORARILY DISABLED: Typewriter effect - display text immediately instead
        this.state.isTypewriterActive = false;

        // Apply text coloring to content (Requirements: 8.9, 8.10)
        const colorizedContent = this.textColorizer.colorizeText(currentPage.content);

        // Display content immediately (typewriter disabled for testing)
        this.contentElement.innerHTML = colorizedContent;

        // Update button state for new page
        this.updateButtonState();

        // Load 3D model for current page (Requirements: 9.8)
        this.loadModelForCurrentPage();

        console.log(`Displaying page ${this.currentPageIndex + 1}: "${currentPage.title}"`);
    }

    /**
     * Update button state based on current navigation context
     * Requirements: 6.1, 6.2
     */
    private updateButtonState(): void {
        if (!this.nextButton || !this.storyContent) return;

        const currentPage = this.storyContent.pages[this.currentPageIndex];
        if (!currentPage) return;

        // Update button text based on page position (Requirement 2.5)
        if (currentPage.isLastPage || this.currentPageIndex >= this.storyContent.pages.length - 1) {
            this.nextButton.textContent = 'CONTINUE';
            this.nextButton.style.background = 'rgba(0, 80, 40, 0.6)'; // Green for Continue
            this.nextButton.style.borderColor = '#00ff88';
            this.nextButton.style.color = '#00ff88';
        } else {
            this.nextButton.textContent = 'NEXT';
            this.nextButton.style.background = 'rgba(0, 40, 80, 0.6)'; // Blue for Next
            this.nextButton.style.borderColor = '#00ffff';
            this.nextButton.style.color = '#00ffff';
        }

        // Enable/disable based on typewriter state (Requirement 6.1)
        this.nextButton.disabled = this.state.isTypewriterActive;

        // Update visual state
        this.updateButtonVisualState();
    }

    /**
     * Update button visual state based on enabled/disabled status
     * Requirements: 6.2, 6.3
     */
    private updateButtonVisualState(): void {
        if (!this.nextButton) return;

        if (this.nextButton.disabled) {
            // Disabled state styling
            this.nextButton.style.background = 'rgba(0, 20, 40, 0.3)';
            this.nextButton.style.borderColor = 'rgba(0, 255, 255, 0.3)';
            this.nextButton.style.color = 'rgba(0, 255, 255, 0.5)';
            this.nextButton.style.cursor = 'not-allowed';
            this.nextButton.style.transform = 'none';
            this.nextButton.style.boxShadow = 'none';
        } else {
            // Enabled state styling - restore based on button type
            const isLastPage = this.nextButton.textContent === 'CONTINUE';
            if (isLastPage) {
                this.nextButton.style.background = 'rgba(0, 80, 40, 0.6)';
                this.nextButton.style.borderColor = '#00ff88';
                this.nextButton.style.color = '#00ff88';
            } else {
                this.nextButton.style.background = 'rgba(0, 40, 80, 0.6)';
                this.nextButton.style.borderColor = '#00ffff';
                this.nextButton.style.color = '#00ffff';
            }
            this.nextButton.style.cursor = 'pointer';
        }
    }

    /**
     * Handle introduction completion
     */
    private handleComplete(): void {
        this.hide();
        this.config.onComplete();
    }

    /**
     * Check if the introduction should be skipped based on preferences
     * Requirements: 5.1, 5.2 - Preference checking before showing introduction
     */
    public shouldSkipIntroduction(): boolean {
        return this.preferenceManager.getSkipIntroduction();
    }

    /**
     * Reset preferences to defaults (for testing purposes)
     * Requirements: 3.5 - Preference reset functionality for testing
     */
    public resetPreferences(): boolean {
        try {
            const success = this.preferenceManager.resetToDefaults();
            if (success) {
                // Update local state
                this.state.skipIntroduction = false;
                
                // Update checkbox if it exists
                if (this.skipCheckbox) {
                    this.skipCheckbox.checked = false;
                }
                
                // Update visual state
                this.initializeCheckboxState();
                
                console.log('Preferences reset to defaults');
            }
            return success;
        } catch (error) {
            console.error('Error resetting preferences:', error);
            return false;
        }
    }

    /**
     * Clear all preferences (for testing purposes)
     * Requirements: 3.5 - Preference reset functionality for testing
     */
    public clearPreferences(): boolean {
        try {
            const success = this.preferenceManager.clearPreferences();
            if (success) {
                // Update local state
                this.state.skipIntroduction = false;
                
                // Update checkbox if it exists
                if (this.skipCheckbox) {
                    this.skipCheckbox.checked = false;
                }
                
                // Update visual state
                this.initializeCheckboxState();
                
                console.log('All preferences cleared');
            }
            return success;
        } catch (error) {
            console.error('Error clearing preferences:', error);
            return false;
        }
    }

    /**
     * Get preference manager instance (for testing and debugging)
     * Requirements: 3.5 - Testing support
     */
    public getPreferenceManager(): PreferenceManager {
        return this.preferenceManager;
    }

    /**
     * Show the introduction screen
     */
    public show(): void {
        if (!this.container) return;

        this.state.isVisible = true;
        this.container.style.display = 'block';
        this.currentPageIndex = 0;
        this.state.currentPage = 0;
        this.displayCurrentPage();
    }

    /**
     * Hide the introduction screen
     */
    public hide(): void {
        if (!this.container) return;

        this.state.isVisible = false;
        this.container.style.display = 'none';
    }

    /**
     * Get current state
     */
    public getState(): IntroductionState {
        return { ...this.state };
    }

    /**
     * Get story content
     */
    public getStoryContent(): StoryContent | null {
        return this.storyContent;
    }

    /**
     * Get current page
     */
    public getCurrentPage(): StoryPage | null {
        if (!this.storyContent || this.currentPageIndex >= this.storyContent.pages.length) {
            return null;
        }
        return this.storyContent.pages[this.currentPageIndex];
    }

    /**
     * Get typewriter effect instance
     */
    public getTypewriterEffect(): TypewriterEffect | null {
        return this.typewriterEffect;
    }

    /**
     * Check if typewriter animation is currently active
     */
    public isTypewriterActive(): boolean {
        return this.state.isTypewriterActive;
    }

    /**
     * Get current viewport information
     * Requirements: 7.5 - Viewport size detection
     */
    public getViewportInfo(): ViewportInfo {
        return { ...this.viewportInfo };
    }

    /**
     * Get model renderer instance (for testing and debugging)
     * Requirements: 9.1 - Access to IntroductionModelRenderer instance
     */
    public getModelRenderer(): IntroductionModelRenderer | null {
        return this.modelRenderer;
    }

    /**
     * Check if model is currently loading
     * Requirements: 9.8 - Loading state access
     */
    public isModelLoading(): boolean {
        return this.state.isModelLoading;
    }

    /**
     * Get current model type
     * Requirements: 9.8 - Current model type access
     */
    public getCurrentModelType(): string | null {
        return this.state.currentModelType;
    }

    /**
     * Force responsive layout update (for testing)
     * Requirements: 7.5 - Responsive layout handling
     */
    public updateLayout(): void {
        this.viewportInfo = this.detectViewport();
        this.updateResponsiveLayout();
    }

    /**
     * Dispose the introduction screen and clean up resources
     * Requirements: 9.8 - Proper cleanup when Introduction Screen is disposed
     */
    public dispose(): void {
        // Clean up responsive handlers
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Remove event listeners (they will be cleaned up when container is removed)
        
        // Dispose model renderer (Requirements: 9.8)
        if (this.modelRenderer) {
            this.modelRenderer.dispose();
            this.modelRenderer = null;
        }

        // Dispose material manager if we created it
        if (this.materialManager) {
            this.materialManager.dispose();
            this.materialManager = null;
        }
        
        // Dispose typewriter effect
        if (this.typewriterEffect) {
            this.typewriterEffect.dispose();
            this.typewriterEffect = null;
        }

        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }

        // Reset state
        this.state = {
            currentPage: 0,
            isTypewriterActive: false,
            skipIntroduction: false,
            isVisible: false,
            modelRenderer: null,
            isModelLoading: false,
            currentModelType: null
        };

        // Clear references
        this.pageContainer = null;
        this.titleElement = null;
        this.contentElement = null;
        this.nextButton = null;
        this.skipCheckbox = null;
        this.skipLabel = null;
    }
}