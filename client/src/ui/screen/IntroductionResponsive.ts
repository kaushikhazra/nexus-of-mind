/**
 * IntroductionResponsive - Responsive layout management for Introduction Screen
 *
 * Handles viewport detection, responsive layouts, and touch interactions.
 * Extracted from IntroductionScreen.ts for SOLID compliance.
 *
 * Requirements: 7.5 - Responsive layout and touch interactions
 */

// ==================== Types ====================

export interface ViewportInfo {
    width: number;
    height: number;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    orientation: 'portrait' | 'landscape';
}

export interface ResponsiveElements {
    pageContainer: HTMLElement | null;
    titleElement: HTMLElement | null;
    contentElement: HTMLElement | null;
    nextButton: HTMLButtonElement | null;
    skipCheckbox: HTMLInputElement | null;
    skipLabel: HTMLLabelElement | null;
}

export interface ResponsiveCallbacks {
    onSwipeLeft?: () => void;
    getThemePrimaryText: () => string;
}

// ==================== Viewport Detection ====================

/**
 * Detect viewport size and device characteristics
 * Requirements: 7.5 - Viewport size detection
 */
export function detectViewport(): ViewportInfo {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const isMobile = width <= 768;
    const isTablet = width > 768 && width <= 1024;
    const isDesktop = width > 1024;
    const orientation = width > height ? 'landscape' : 'portrait';

    return { width, height, isMobile, isTablet, isDesktop, orientation };
}

// ==================== Layout Updates ====================

/**
 * Update page container layout for different screen sizes
 * Requirements: 7.5, 9.7 - Responsive layout, mobile model area collapse
 */
export function updatePageContainerLayout(
    pageContainer: HTMLElement,
    viewport: ViewportInfo
): void {
    const { isMobile, isTablet } = viewport;
    const modelArea = pageContainer.querySelector('.introduction-model-area') as HTMLElement;
    const storyArea = pageContainer.querySelector('.introduction-story-area') as HTMLElement;

    if (isMobile) {
        pageContainer.style.cssText = `
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
            position: relative;
            display: flex;
            flex-direction: column;
        `;

        if (modelArea) modelArea.style.display = 'none';
        if (storyArea) {
            storyArea.style.cssText = `
                flex: 1;
                padding: 20px 16px;
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                max-height: 100vh;
                background: rgba(0, 10, 20, 0.85);
            `;
        }
    } else if (isTablet) {
        pageContainer.style.cssText = `
            background: rgba(0, 10, 20, 0.85);
            border: 2px solid rgba(0, 255, 255, 0.6);
            border-radius: 8px;
            padding: 0;
            max-width: 95%;
            width: 95%;
            max-height: 85vh;
            overflow: hidden;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 25px rgba(0, 255, 255, 0.3);
            position: relative;
            display: flex;
            flex-direction: row;
        `;

        if (modelArea) {
            modelArea.style.cssText = `
                width: 250px;
                min-width: 250px;
                height: 100%;
                background: rgba(0, 10, 20, 0.85);
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
        }
        if (storyArea) {
            storyArea.style.cssText = `
                flex: 1;
                padding: 32px 24px;
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                max-height: 85vh;
                background: rgba(0, 10, 20, 0.85);
            `;
        }
    } else {
        pageContainer.style.cssText = `
            background: rgba(0, 10, 20, 0.85);
            border: 2px solid rgba(0, 255, 255, 0.6);
            border-radius: 8px;
            padding: 0;
            max-width: 1200px;
            width: 95%;
            max-height: 85vh;
            overflow: hidden;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
            position: relative;
            display: flex;
            flex-direction: row;
        `;

        if (modelArea) {
            modelArea.style.cssText = `
                width: 300px;
                min-width: 300px;
                height: 100%;
                background: rgba(0, 10, 20, 0.85);
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
        }
        if (storyArea) {
            storyArea.style.cssText = `
                flex: 1;
                padding: 40px;
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                max-height: 85vh;
                background: rgba(0, 10, 20, 0.85);
            `;
        }
    }
}

/**
 * Update typography for different screen sizes
 * Requirements: 7.5 - Text readability across screen sizes
 */
export function updateTypographyLayout(
    titleElement: HTMLElement,
    contentElement: HTMLElement,
    viewport: ViewportInfo,
    primaryTextColor: string
): void {
    const { isMobile, isTablet } = viewport;

    const baseTitleStyle = `
        font-weight: 700;
        color: #00ffff;
        text-align: center;
        letter-spacing: 1px;
        text-transform: uppercase;
        font-family: 'Orbitron', monospace;
        line-height: 1.3;
    `;

    const baseContentStyle = `
        color: ${primaryTextColor};
        white-space: pre-wrap;
        font-family: 'Orbitron', monospace;
        letter-spacing: 0.8px;
        word-spacing: 2px;
        flex: 1;
        overflow-y: auto;
    `;

    if (isMobile) {
        titleElement.style.cssText = baseTitleStyle + `
            font-size: 18px;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.6);
            margin-bottom: 20px;
        `;
        contentElement.style.cssText = baseContentStyle + `
            font-size: 14px;
            line-height: 1.8;
            margin-bottom: 20px;
            min-height: 150px;
        `;
    } else if (isTablet) {
        titleElement.style.cssText = baseTitleStyle + `
            font-size: 20px;
            text-shadow: 0 0 12px rgba(0, 255, 255, 0.6);
            margin-bottom: 25px;
            letter-spacing: 1.5px;
        `;
        contentElement.style.cssText = baseContentStyle + `
            font-size: 15px;
            line-height: 1.9;
            margin-bottom: 30px;
            min-height: 180px;
        `;
    } else {
        titleElement.style.cssText = baseTitleStyle + `
            font-size: 24px;
            text-shadow: 0 0 15px rgba(0, 255, 255, 0.6);
            margin-bottom: 30px;
            letter-spacing: 2px;
        `;
        contentElement.style.cssText = baseContentStyle + `
            font-size: 16px;
            line-height: 2.0;
            margin-bottom: 40px;
            min-height: 200px;
        `;
    }
}

/**
 * Update controls layout for different screen sizes
 * Requirements: 7.5 - Responsive layout
 */
export function updateControlsLayout(
    nextButton: HTMLButtonElement,
    viewport: ViewportInfo
): void {
    const { isMobile, isTablet, orientation } = viewport;
    const controlsContainer = nextButton.parentElement;
    if (!controlsContainer) return;

    if (isMobile) {
        const mobileStyle = orientation === 'portrait' ? `
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

        controlsContainer.style.cssText = mobileStyle;
        nextButton.style.cssText += `
            padding: 14px 28px;
            font-size: 16px;
            min-width: 140px;
            touch-action: manipulation;
        `;
    } else if (isTablet) {
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
        nextButton.style.cssText += `
            padding: 13px 26px;
            font-size: 15px;
            min-width: 130px;
            touch-action: manipulation;
        `;
    } else {
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
        nextButton.style.cssText += `
            padding: 12px 24px;
            font-size: 14px;
            min-width: 120px;
        `;
    }
}

// ==================== Touch Interactions ====================

/**
 * Setup touch interactions for mobile
 * Requirements: 7.5 - Mobile-friendly touch interactions
 */
export function setupTouchInteractions(
    elements: ResponsiveElements,
    contentElement: HTMLElement | null
): void {
    const { nextButton, skipCheckbox, skipLabel } = elements;

    if (nextButton) {
        nextButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            nextButton.style.transform = 'scale(0.95)';
            nextButton.style.transition = 'transform 0.1s ease';
        });

        nextButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            nextButton.style.transform = 'scale(1)';
            setTimeout(() => {
                nextButton.style.transition = 'all 0.3s ease';
            }, 100);
        });

        nextButton.style.touchAction = 'manipulation';
    }

    if (skipCheckbox && skipLabel) {
        const skipContainer = skipCheckbox.parentElement;
        if (skipContainer) {
            skipContainer.style.cssText += `
                padding: 12px 16px;
                min-height: 44px;
                touch-action: manipulation;
            `;
        }
        skipLabel.style.cssText += `
            font-size: 14px;
            padding: 8px 12px;
            touch-action: manipulation;
        `;
    }

    if (contentElement) {
        contentElement.style.touchAction = 'pan-y';
    }
}

/**
 * Setup swipe gestures for page navigation
 * Requirements: 7.5 - Mobile-friendly touch interactions
 */
export function setupSwipeGestures(
    pageContainer: HTMLElement,
    onSwipeLeft: () => void
): void {
    let startX = 0;
    let startY = 0;

    pageContainer.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });

    pageContainer.addEventListener('touchend', (e) => {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;

        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const minSwipeDistance = 50;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
            if (deltaX < 0) {
                onSwipeLeft();
            }
        }
    });
}

// ==================== Full Layout Update ====================

/**
 * Update all responsive layouts
 */
export function updateResponsiveLayout(
    elements: ResponsiveElements,
    viewport: ViewportInfo,
    callbacks: ResponsiveCallbacks
): void {
    const { pageContainer, titleElement, contentElement, nextButton } = elements;

    if (pageContainer) {
        updatePageContainerLayout(pageContainer, viewport);
    }

    if (titleElement && contentElement) {
        updateTypographyLayout(
            titleElement,
            contentElement,
            viewport,
            callbacks.getThemePrimaryText()
        );
    }

    if (nextButton) {
        updateControlsLayout(nextButton, viewport);
    }

    if (viewport.isMobile) {
        setupTouchInteractions(elements, contentElement);
    }
}
