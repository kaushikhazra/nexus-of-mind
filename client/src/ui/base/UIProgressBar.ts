/**
 * UIProgressBar - Progress bar utilities
 * 
 * Provides utilities for creating and managing progress bars.
 */

import { Rectangle, TextBlock, Control } from '@babylonjs/gui';
import { UITheme } from './UITheme';

// ==================== Progress Bar Utilities ====================

/**
 * Create a progress bar with consistent styling
 */
export function createProgressBar(width: number = 200, height: number = 20, theme: UITheme): {
    container: Rectangle;
    fill: Rectangle;
    text: TextBlock;
} {
    // Container
    const container = new Rectangle('progressBarContainer');
    container.widthInPixels = width;
    container.heightInPixels = height;
    container.color = theme.secondaryColor;
    container.thickness = 1;
    container.background = 'rgba(50, 50, 50, 0.8)';
    container.cornerRadius = 3;

    // Fill
    const fill = new Rectangle('progressFill');
    fill.color = theme.primaryColor;
    fill.thickness = 0;
    fill.background = theme.primaryColor;
    fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    fill.widthInPixels = 0;
    container.addControl(fill);

    // Text
    const text = new TextBlock('progressText', '0%');
    text.color = theme.textColor;
    text.fontSize = 10;
    text.fontWeight = 'bold';
    container.addControl(text);

    return { container, fill, text };
}

/**
 * Update progress bar value (0-1)
 */
export function updateProgressBar(
    progressBar: { fill: Rectangle; text: TextBlock },
    progress: number,
    containerWidth: number = 200
): void {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    progressBar.fill.widthInPixels = clampedProgress * containerWidth;
    progressBar.text.text = `${Math.round(clampedProgress * 100)}%`;
}