/**
 * TypewriterEffect - Character-by-character text animation component
 * 
 * Provides configurable typewriter animation effects for text content,
 * with consistent timing regardless of text length and proper animation
 * control methods for integration with UI components.
 */

export interface TypewriterEffectConfig {
    speed?: number; // Characters per second
    onComplete?: () => void;
    onCharacterTyped?: (character: string, index: number) => void;
}

export class TypewriterEffect {
    private element: HTMLElement;
    private config: TypewriterEffectConfig;
    private animationId: number | null = null;
    private isActive: boolean = false;
    private isComplete: boolean = false;
    private currentText: string = '';
    private currentIndex: number = 0;
    private lastUpdateTime: number = 0;
    private characterInterval: number = 0; // Milliseconds between characters

    constructor(element: HTMLElement, config: TypewriterEffectConfig = {}) {
        this.element = element;
        this.config = {
            speed: 60, // Default: 60 characters per second
            ...config
        };

        // Calculate character interval from speed
        this.characterInterval = 1000 / (this.config.speed || 60);
    }

    /**
     * Start typewriter animation for the given text
     */
    public typeText(text: string, onComplete?: () => void): void {
        // Stop any existing animation
        this.stop();

        // Set up new animation
        this.currentText = text;
        this.currentIndex = 0;
        this.isActive = true;
        this.isComplete = false;
        this.lastUpdateTime = performance.now();

        // Clear the element
        this.element.textContent = '';

        // Override completion callback if provided
        if (onComplete) {
            this.config.onComplete = onComplete;
        }

        // Start animation loop
        this.animate();
    }

    /**
     * Animation loop using requestAnimationFrame for smooth performance
     */
    private animate(): void {
        if (!this.isActive) return;

        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastUpdateTime;

        // Check if enough time has passed to add the next character
        if (deltaTime >= this.characterInterval) {
            this.addNextCharacter();
            this.lastUpdateTime = currentTime;
        }

        // Continue animation if not complete
        if (this.isActive && !this.isComplete) {
            this.animationId = requestAnimationFrame(() => this.animate());
        }
    }

    /**
     * Add the next character to the display
     */
    private addNextCharacter(): void {
        if (this.currentIndex >= this.currentText.length) {
            this.complete();
            return;
        }

        const character = this.currentText[this.currentIndex];
        
        // Handle HTML content by building up the innerHTML gradually
        // This allows colored spans to render correctly during animation
        const currentContent = this.currentText.substring(0, this.currentIndex + 1);
        
        // Check if we're inside an HTML tag
        const openTags = (currentContent.match(/</g) || []).length;
        const closeTags = (currentContent.match(/>/g) || []).length;
        const isInsideTag = openTags > closeTags;
        
        if (isInsideTag) {
            // If we're inside an HTML tag, add characters until we close the tag
            // This prevents broken HTML during animation
            let tagEndIndex = this.currentIndex;
            while (tagEndIndex < this.currentText.length && this.currentText[tagEndIndex] !== '>') {
                tagEndIndex++;
            }
            
            if (tagEndIndex < this.currentText.length) {
                // Include the closing '>' character
                tagEndIndex++;
                this.currentIndex = tagEndIndex - 1; // Will be incremented at the end
            }
        }
        
        // Update element content (supports both plain text and HTML)
        const displayContent = this.currentText.substring(0, this.currentIndex + 1);
        if (displayContent.includes('<')) {
            this.element.innerHTML = displayContent;
        } else {
            this.element.textContent = displayContent;
        }

        // Call character typed callback if provided
        if (this.config.onCharacterTyped) {
            this.config.onCharacterTyped(character, this.currentIndex);
        }

        this.currentIndex++;
    }

    /**
     * Complete the animation immediately
     */
    public complete(): void {
        this.stop();
        
        // Display full text immediately (supports both plain text and HTML)
        if (this.currentText.includes('<')) {
            this.element.innerHTML = this.currentText;
        } else {
            this.element.textContent = this.currentText;
        }
        
        this.isComplete = true;
        this.currentIndex = this.currentText.length;

        // Call completion callback
        if (this.config.onComplete) {
            this.config.onComplete();
        }
    }

    /**
     * Stop the animation
     */
    public stop(): void {
        this.isActive = false;
        
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Check if animation is currently active
     */
    public isAnimating(): boolean {
        return this.isActive;
    }

    /**
     * Check if animation is complete
     */
    public isAnimationComplete(): boolean {
        return this.isComplete;
    }

    /**
     * Get current progress (0-1)
     */
    public getProgress(): number {
        if (this.currentText.length === 0) return 1;
        return this.currentIndex / this.currentText.length;
    }

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<TypewriterEffectConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Recalculate character interval if speed changed
        if (newConfig.speed !== undefined) {
            this.characterInterval = 1000 / newConfig.speed;
        }
    }

    /**
     * Set typing speed (characters per second)
     */
    public setSpeed(speed: number): void {
        this.config.speed = speed;
        this.characterInterval = 1000 / speed;
    }

    /**
     * Get current typing speed
     */
    public getSpeed(): number {
        return this.config.speed || 30;
    }

    /**
     * Get current text being typed
     */
    public getCurrentText(): string {
        return this.currentText;
    }

    /**
     * Get currently displayed text
     */
    public getDisplayedText(): string {
        return this.element.textContent || this.element.innerHTML || '';
    }

    /**
     * Reset the typewriter effect
     */
    public reset(): void {
        this.stop();
        this.currentText = '';
        this.currentIndex = 0;
        this.isComplete = false;
        this.element.textContent = '';
        this.element.innerHTML = '';
    }

    /**
     * Dispose the typewriter effect and clean up resources
     */
    public dispose(): void {
        this.stop();
        this.reset();
        
        // Clear callbacks to prevent memory leaks
        this.config.onComplete = undefined;
        this.config.onCharacterTyped = undefined;
    }
}