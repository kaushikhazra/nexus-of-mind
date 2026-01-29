/**
 * IntroductionUIBuilder - UI element creation for Introduction Screen
 *
 * Creates and styles all UI elements for the introduction screen.
 * Extracted from IntroductionScreen.ts for SOLID compliance.
 *
 * Requirements: 4.1-4.6 - SciFi aesthetic UI creation
 */

// ==================== Types ====================

export interface UIElements {
    introContainer: HTMLElement;
    pageContainer: HTMLElement;
    modelArea: HTMLElement;
    storyArea: HTMLElement;
    titleElement: HTMLElement;
    contentElement: HTMLElement;
    controlsContainer: HTMLElement;
    skipContainer: HTMLElement;
    skipCheckbox: HTMLInputElement;
    skipLabel: HTMLLabelElement;
    nextButton: HTMLButtonElement;
}

export interface UICallbacks {
    onNextClick: () => void;
    onSkipChange: () => void;
    getThemePrimaryText: () => string;
}

// ==================== Element Creators ====================

/**
 * Create the main introduction container
 */
function createIntroContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'introduction-screen';
    container.style.cssText = `
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
    return container;
}

/**
 * Create the page container with split layout
 */
function createPageContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'introduction-content';
    container.style.cssText = `
        background: rgba(0, 10, 20, 0.85);
        border: 1px solid rgba(0, 255, 255, 0.4);
        border-radius: 8px;
        padding: 0;
        max-width: 1200px;
        width: 95%;
        min-height: 400px;
        max-height: 85vh;
        overflow: hidden;
        backdrop-filter: blur(10px);
        box-shadow: 0 0 30px rgba(0, 255, 255, 0.3), inset 0 0 40px rgba(0, 100, 150, 0.1);
        position: relative;
        display: flex;
        flex-direction: row;
        align-items: stretch;
    `;
    return container;
}

/**
 * Create 3D model area
 */
function createModelArea(): HTMLElement {
    const area = document.createElement('div');
    area.className = 'introduction-model-area';
    area.id = 'introduction-model-container';
    area.style.cssText = `
        flex: 0 0 300px;
        align-self: stretch;
        background: rgba(0, 10, 20, 0.85);
        position: relative;
        overflow: hidden;
    `;

    // Add placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'model-placeholder';
    placeholder.style.cssText = `
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
    placeholder.innerHTML = `
        <div style="margin-bottom: 10px;">3D Model</div>
        <div style="font-size: 10px; opacity: 0.7;">Loading...</div>
    `;
    area.appendChild(placeholder);

    return area;
}

/**
 * Create story content area
 */
function createStoryArea(): HTMLElement {
    const area = document.createElement('div');
    area.className = 'introduction-story-area';
    area.style.cssText = `
        flex: 1;
        padding: 40px;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        max-height: 85vh;
        background: rgba(0, 10, 20, 0.85);
    `;
    return area;
}

/**
 * Create title element
 */
function createTitleElement(): HTMLElement {
    const title = document.createElement('h1');
    title.style.cssText = `
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
    return title;
}

/**
 * Create content element for story text
 */
function createContentElement(primaryTextColor: string): HTMLElement {
    const content = document.createElement('div');
    content.style.cssText = `
        font-size: 16px;
        line-height: 2.0;
        color: ${primaryTextColor};
        margin-bottom: 40px;
        min-height: 200px;
        white-space: pre-wrap;
        font-family: 'Orbitron', monospace;
        letter-spacing: 0.8px;
        word-spacing: 2px;
        flex: 1;
    `;
    return content;
}

/**
 * Create controls container
 */
function createControlsContainer(): HTMLElement {
    const controls = document.createElement('div');
    controls.style.cssText = `
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
    return controls;
}

/**
 * Create skip checkbox container
 */
function createSkipContainer(): {
    container: HTMLElement;
    checkbox: HTMLInputElement;
    label: HTMLLabelElement;
} {
    const container = document.createElement('div');
    container.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: rgba(0, 20, 40, 0.4);
        border: 1px solid rgba(0, 255, 255, 0.3);
        border-radius: 4px;
        transition: all 0.3s ease;
    `;

    const checkbox = document.createElement('input') as HTMLInputElement;
    checkbox.type = 'checkbox';
    checkbox.id = 'skip-introduction-checkbox';
    checkbox.style.cssText = `
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
        pointer-events: none;
    `;

    const label = document.createElement('label') as HTMLLabelElement;
    label.htmlFor = 'skip-introduction-checkbox';
    label.style.cssText = `
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
    label.textContent = "Skip";

    container.appendChild(checkbox);
    container.appendChild(label);

    return { container, checkbox, label };
}

/**
 * Create next/continue button
 */
function createNextButton(): HTMLButtonElement {
    const button = document.createElement('button') as HTMLButtonElement;
    button.style.cssText = `
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
    button.textContent = 'NEXT';
    button.disabled = true;

    return button;
}

// ==================== Main Builder ====================

/**
 * Build the complete introduction screen UI
 * Requirements: 4.1-4.6 - SciFi aesthetic UI creation
 */
export function buildIntroductionUI(
    container: HTMLElement,
    callbacks: UICallbacks
): UIElements {
    // Clear existing content
    container.innerHTML = '';

    // Create all elements
    const introContainer = createIntroContainer();
    const pageContainer = createPageContainer();
    const modelArea = createModelArea();
    const storyArea = createStoryArea();
    const titleElement = createTitleElement();
    const contentElement = createContentElement(callbacks.getThemePrimaryText());
    const controlsContainer = createControlsContainer();
    const skipComponents = createSkipContainer();
    const nextButton = createNextButton();

    // Setup event handlers
    nextButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        callbacks.onNextClick();
    });

    skipComponents.checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        callbacks.onSkipChange();
    });

    // Assemble controls
    controlsContainer.appendChild(skipComponents.container);
    controlsContainer.appendChild(nextButton);

    // Assemble story area
    storyArea.appendChild(titleElement);
    storyArea.appendChild(contentElement);
    storyArea.appendChild(controlsContainer);

    // Assemble page container
    pageContainer.appendChild(modelArea);
    pageContainer.appendChild(storyArea);

    // Assemble main container
    introContainer.appendChild(pageContainer);
    container.appendChild(introContainer);

    return {
        introContainer,
        pageContainer,
        modelArea,
        storyArea,
        titleElement,
        contentElement,
        controlsContainer,
        skipContainer: skipComponents.container,
        skipCheckbox: skipComponents.checkbox,
        skipLabel: skipComponents.label,
        nextButton
    };
}

/**
 * Show model error in container
 */
export function showModelError(container: HTMLElement, errorMessage: string): void {
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
 * Update checkbox visual state
 */
export function updateCheckboxVisualState(
    checkbox: HTMLInputElement,
    label: HTMLLabelElement
): void {
    if (checkbox.checked) {
        label.style.color = '#00ff88';
        label.style.textShadow = '0 0 5px rgba(0, 255, 136, 0.5)';
    } else {
        label.style.color = 'rgba(0, 255, 255, 0.9)';
        label.style.textShadow = 'none';
    }
}

/**
 * Update button state for navigation
 */
export function updateButtonState(
    button: HTMLButtonElement,
    isLastPage: boolean,
    isDisabled: boolean
): void {
    button.textContent = isLastPage ? 'CONTINUE' : 'NEXT';
    button.disabled = isDisabled;

    if (isDisabled) {
        button.style.background = 'rgba(0, 20, 40, 0.3)';
        button.style.borderColor = 'rgba(0, 255, 255, 0.3)';
        button.style.color = 'rgba(0, 255, 255, 0.5)';
        button.style.cursor = 'not-allowed';
    } else if (isLastPage) {
        button.style.background = 'rgba(0, 80, 40, 0.6)';
        button.style.borderColor = '#00ff88';
        button.style.color = '#00ff88';
        button.style.cursor = 'pointer';
    } else {
        button.style.background = 'rgba(0, 40, 80, 0.6)';
        button.style.borderColor = '#00ffff';
        button.style.color = '#00ffff';
        button.style.cursor = 'pointer';
    }
}
