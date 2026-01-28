/**
 * UILayoutHelpers - Layout and container utilities
 * 
 * Provides utilities for creating consistent layouts and containers.
 */

import { StackPanel, Grid, Rectangle, Control } from '@babylonjs/gui';

// ==================== Layout Helpers ====================

/**
 * Create a horizontal stack panel
 */
export function createHorizontalPanel(): StackPanel {
    const panel = new StackPanel();
    panel.isVertical = false;
    panel.spacing = 10;
    return panel;
}

/**
 * Create a vertical stack panel
 */
export function createVerticalPanel(): StackPanel {
    const panel = new StackPanel();
    panel.isVertical = true;
    panel.spacing = 5;
    return panel;
}

/**
 * Create a grid layout
 */
export function createGrid(rows: number, columns: number): Grid {
    const grid = new Grid();
    
    // Add rows
    for (let i = 0; i < rows; i++) {
        grid.addRowDefinition(1 / rows);
    }
    
    // Add columns
    for (let i = 0; i < columns; i++) {
        grid.addColumnDefinition(1 / columns);
    }
    
    return grid;
}

/**
 * Add spacing between elements
 */
export function createSpacer(height: number = 10): Rectangle {
    const spacer = new Rectangle();
    spacer.heightInPixels = height;
    spacer.thickness = 0;
    spacer.background = 'transparent';
    return spacer;
}