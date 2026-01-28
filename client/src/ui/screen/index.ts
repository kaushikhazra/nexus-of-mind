/**
 * Screen Module - Barrel exports for introduction screen components
 */

// Responsive layout management
export {
    detectViewport,
    updatePageContainerLayout,
    updateTypographyLayout,
    updateControlsLayout,
    setupTouchInteractions,
    setupSwipeGestures,
    updateResponsiveLayout
} from './IntroductionResponsive';

export type {
    ViewportInfo,
    ResponsiveElements,
    ResponsiveCallbacks
} from './IntroductionResponsive';

// UI building
export {
    buildIntroductionUI,
    showModelError,
    updateCheckboxVisualState,
    updateButtonState
} from './IntroductionUIBuilder';

export type {
    UIElements,
    UICallbacks
} from './IntroductionUIBuilder';
