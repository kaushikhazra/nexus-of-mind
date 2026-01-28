/**
 * HelpContentBuilder - Content generation for help tabs
 *
 * Builds the content panels for each help tab with consistent styling.
 */

import { StackPanel, TextBlock, Rectangle, Control } from '@babylonjs/gui';
import { HELP_COLORS, HELP_TYPOGRAPHY, HELP_DIMENSIONS } from './HelpStyles';

// ==================== Content Builder ====================

export class HelpContentBuilder {
    /**
     * Create a section with title and content
     */
    public static createSection(title: string, contentLines: string[]): StackPanel {
        const section = new StackPanel(`section_${title}`);
        section.isVertical = true;
        section.spacing = 5;
        section.paddingBottomInPixels = HELP_DIMENSIONS.sectionGap;

        // Title
        const titleText = new TextBlock(`title_${title}`, title);
        titleText.color = HELP_COLORS.sectionHeader;
        titleText.fontSize = HELP_TYPOGRAPHY.headerSize;
        titleText.fontWeight = 'bold';
        titleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        titleText.heightInPixels = 22;
        section.addControl(titleText);

        // Content lines
        for (const line of contentLines) {
            const lineText = new TextBlock(`line_${Date.now()}_${Math.random()}`, line);
            lineText.color = HELP_COLORS.text;
            lineText.fontSize = HELP_TYPOGRAPHY.bodySize;
            lineText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            lineText.textWrapping = true;
            lineText.resizeToFit = true;
            lineText.heightInPixels = line.length > 60 ? 36 : 18;
            section.addControl(lineText);
        }

        return section;
    }

    /**
     * Create a table with headers and rows
     */
    public static createTable(headers: string[], rows: string[][]): StackPanel {
        const table = new StackPanel(`table_${Date.now()}`);
        table.isVertical = true;
        table.spacing = 2;

        // Create rows
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowPanel = new StackPanel(`row_${i}`);
            rowPanel.isVertical = false;
            rowPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

            // Key column (first cell)
            const keyContainer = new Rectangle(`key_${i}`);
            keyContainer.widthInPixels = 160;
            keyContainer.heightInPixels = 24;
            keyContainer.thickness = 0;
            keyContainer.background = i % 2 === 0 ? HELP_COLORS.tableRowAlt : 'transparent';
            keyContainer.paddingLeftInPixels = 8;

            const keyText = new TextBlock(`keyText_${i}`, row[0] || '');
            keyText.color = HELP_COLORS.primary;
            keyText.fontSize = HELP_TYPOGRAPHY.tableSize;
            keyText.fontWeight = 'bold';
            keyText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            keyText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            keyContainer.addControl(keyText);

            rowPanel.addControl(keyContainer);

            // Value column (second cell)
            const valueContainer = new Rectangle(`value_${i}`);
            valueContainer.widthInPixels = 380;
            valueContainer.heightInPixels = 24;
            valueContainer.thickness = 0;
            valueContainer.background = i % 2 === 0 ? HELP_COLORS.tableRowAlt : 'transparent';
            valueContainer.paddingLeftInPixels = 8;

            const valueText = new TextBlock(`valueText_${i}`, row[1] || '');
            valueText.color = HELP_COLORS.text;
            valueText.fontSize = HELP_TYPOGRAPHY.tableSize;
            valueText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            valueText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            valueContainer.addControl(valueText);

            rowPanel.addControl(valueContainer);

            table.addControl(rowPanel);
        }

        return table;
    }

    /**
     * Build Navigation tab content
     */
    public static buildNavigationContent(): StackPanel {
        const content = new StackPanel('nav_content');
        content.isVertical = true;
        content.spacing = HELP_DIMENSIONS.itemGap;
        content.paddingTopInPixels = 10;
        content.paddingLeftInPixels = 10;
        content.paddingRightInPixels = 10;

        // Camera Movement section
        const movementTitle = this.createSectionTitle('CAMERA MOVEMENT');
        content.addControl(movementTitle);

        const movementTable = this.createTable([], [
            ['W / Arrow Up', 'Move camera forward'],
            ['S / Arrow Down', 'Move camera backward'],
            ['A / Arrow Left', 'Rotate camera left'],
            ['D / Arrow Right', 'Rotate camera right']
        ]);
        content.addControl(movementTable);

        // Spacer
        content.addControl(this.createSpacer(15));

        // Zoom & View section
        const zoomTitle = this.createSectionTitle('ZOOM & VIEW');
        content.addControl(zoomTitle);

        const zoomTable = this.createTable([], [
            ['Mouse Wheel', 'Zoom in/out'],
            ['Mouse Drag', 'Rotate camera view'],
            ['H Key', 'Open this help window'],
            ['Escape', 'Close help / Cancel action']
        ]);
        content.addControl(zoomTable);

        return content;
    }

    /**
     * Build Controls tab content
     */
    public static buildControlsContent(): StackPanel {
        const content = new StackPanel('controls_content');
        content.isVertical = true;
        content.spacing = HELP_DIMENSIONS.itemGap;
        content.paddingTopInPixels = 10;
        content.paddingLeftInPixels = 10;
        content.paddingRightInPixels = 10;

        // Buildings section
        const buildingsTitle = this.createSectionTitle('BUILDINGS');
        content.addControl(buildingsTitle);

        const buildingLines = this.createTextLines([
            'Placing Buildings:',
            '  1. Click a building button in the bottom panel',
            '  2. Move mouse to preview placement location',
            '  3. Left-click to place (requires energy)',
            '  4. Press ESC to cancel placement',
            '',
            'Packing Power Plants:',
            '  Select a power plant, then click "Pack" button'
        ]);
        content.addControl(buildingLines);

        content.addControl(this.createSpacer(10));

        // Units section
        const unitsTitle = this.createSectionTitle('UNITS');
        content.addControl(unitsTitle);

        const unitTable = this.createTable([], [
            ['Workers', 'Created from Base, mine minerals'],
            ['Protectors', 'Created from Base, combat units']
        ]);
        content.addControl(unitTable);

        content.addControl(this.createSpacer(10));

        // Movement section
        const movementTitle = this.createSectionTitle('UNIT MOVEMENT');
        content.addControl(movementTitle);

        const movementTable = this.createTable([], [
            ['Left-click unit', 'Select the unit'],
            ['Left-click mineral', 'Move worker to mine'],
            ['Left-click terrain', 'Move protector (auto-attacks enemies)'],
            ['Right-click', 'View information tooltip']
        ]);
        content.addControl(movementTable);

        return content;
    }

    /**
     * Build Enemy tab content
     */
    public static buildEnemyContent(): StackPanel {
        const content = new StackPanel('enemy_content');
        content.isVertical = true;
        content.spacing = HELP_DIMENSIONS.itemGap;
        content.paddingTopInPixels = 10;
        content.paddingLeftInPixels = 10;
        content.paddingRightInPixels = 10;

        // Overview section
        const overviewTitle = this.createSectionTitle('ENERGY PARASITES');
        content.addControl(overviewTitle);

        const overviewLines = this.createTextLines([
            'The planet is home to hostile Energy Parasites that',
            'protect the Adaptive Queen. They hunt your units for energy.'
        ]);
        content.addControl(overviewLines);

        content.addControl(this.createSpacer(10));

        // Types section
        const typesTitle = this.createSectionTitle('PARASITE TYPES');
        content.addControl(typesTitle);

        const combatLabel = this.createSubHeader('Combat Parasites');
        content.addControl(combatLabel);
        const combatLines = this.createTextLines([
            '  - Aggressive, combat-focused behavior',
            '  - Prioritize attacking your Protectors'
        ]);
        content.addControl(combatLines);

        const energyLabel = this.createSubHeader('Energy Parasites');
        content.addControl(energyLabel);
        const energyLines = this.createTextLines([
            '  - Target your Workers specifically',
            '  - Steal energy, weaker but more numerous'
        ]);
        content.addControl(energyLines);

        content.addControl(this.createSpacer(10));

        // Strategy section
        const strategyTitle = this.createSectionTitle('STRATEGY TIPS');
        content.addControl(strategyTitle);

        const strategyLines = this.createTextLines([
            '  - Keep Protectors near your Workers',
            '  - Parasites patrol around their hive territory',
            '  - Destroying parasites rewards energy',
            '  - The Queen adapts to your tactics over time'
        ]);
        content.addControl(strategyLines);

        return content;
    }

    // ==================== Helper Methods ====================

    private static createSectionTitle(text: string): TextBlock {
        const title = new TextBlock(`section_${text}`, text);
        title.color = HELP_COLORS.sectionHeader;
        title.fontSize = HELP_TYPOGRAPHY.headerSize;
        title.fontWeight = 'bold';
        title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        title.heightInPixels = 25;
        return title;
    }

    private static createSubHeader(text: string): TextBlock {
        const header = new TextBlock(`subheader_${text}`, text);
        header.color = HELP_COLORS.primary;
        header.fontSize = HELP_TYPOGRAPHY.subHeaderSize;
        header.fontWeight = 'bold';
        header.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        header.heightInPixels = 22;
        return header;
    }

    private static createTextLines(lines: string[]): StackPanel {
        const panel = new StackPanel(`lines_${Date.now()}`);
        panel.isVertical = true;
        panel.spacing = 2;

        for (const line of lines) {
            const text = new TextBlock(`line_${Date.now()}_${Math.random()}`, line);
            text.color = line.startsWith('  -') ? HELP_COLORS.secondaryText : HELP_COLORS.text;
            text.fontSize = HELP_TYPOGRAPHY.bodySize;
            text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            text.heightInPixels = line === '' ? 8 : 18;
            panel.addControl(text);
        }

        return panel;
    }

    private static createSpacer(height: number): Rectangle {
        const spacer = new Rectangle(`spacer_${Date.now()}`);
        spacer.heightInPixels = height;
        spacer.thickness = 0;
        spacer.background = 'transparent';
        return spacer;
    }
}
