/**
 * UI Base Module - Clean exports for UI component infrastructure
 */

// Core base class
export { UIComponentBase } from './UIComponentBase';
export type { UIComponentConfig, LabelConfig } from './UIComponentBase';

// Theme
export { DEFAULT_THEME } from './UITheme';
export type { UITheme } from './UITheme';

// Button factory
export { createButton, applyButtonStyling, setButtonDisabled } from './UIButtonFactory';
export type { ButtonConfig } from './UIButtonFactory';

// Layout helpers
export { createHorizontalPanel, createVerticalPanel, createGrid, createSpacer } from './UILayoutHelpers';

// Progress bar
export { createProgressBar, updateProgressBar } from './UIProgressBar';
