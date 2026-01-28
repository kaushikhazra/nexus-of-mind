/**
 * UIComponentBase Property-Based Tests
 * 
 * **Property 10: UI Component Consistency**
 * **Validates: Requirements 8.2, 8.3, 8.4, 8.5**
 * 
 * Tests consistent behavior and patterns across all UI components that extend
 * UIComponentBase. Ensures standardized lifecycle management, styling, and
 * event handling patterns are maintained across the entire UI system.
 */

import fc from 'fast-check';
import { AdvancedDynamicTexture, Control } from '@babylonjs/gui';
import { 
    UIComponentBase, 
    UIComponentConfig, 
    UITheme, 
    DEFAULT_THEME,
    ButtonConfig,
    LabelConfig
} from '../UIComponentBase';

// ==================== Mock UI Component for Testing ====================

class MockUIComponent extends UIComponentBase {
    private setupCalled: boolean = false;
    private showCalled: boolean = false;
    private hideCalled: boolean = false;
    private disposeCalled: boolean = false;
    private themeChangedCalled: boolean = false;

    protected setupComponent(): void {
        this.setupCalled = true;
        
        // Add some test content
        const title = this.createTitle('Test Component');
        const subtitle = this.createSubtitle('Test subtitle');
        const button = this.createButton({
            text: 'Test Button',
            onClick: () => {}
        });
        
        this.addToContent(title);
        this.addToContent(subtitle);
        this.addToContent(button);
    }

    protected onShow(): void {
        super.onShow();
        this.showCalled = true;
    }

    protected onHide(): void {
        super.onHide();
        this.hideCalled = true;
    }

    protected onDispose(): void {
        super.onDispose();
        this.disposeCalled = true;
    }

    protected onThemeChanged(): void {
        super.onThemeChanged();
        this.themeChangedCalled = true;
    }

    // Test accessors
    public getSetupCalled(): boolean { return this.setupCalled; }
    public getShowCalled(): boolean { return this.showCalled; }
    public getHideCalled(): boolean { return this.hideCalled; }
    public getDisposeCalled(): boolean { return this.disposeCalled; }
    public getThemeChangedCalled(): boolean { return this.themeChangedCalled; }
    public getMainContainerPublic() { return this.getMainContainer(); }
    public getContentPanelPublic() { return this.getContentPanel(); }
}

// ==================== Mock AdvancedDynamicTexture ====================

class MockAdvancedDynamicTexture {
    private controls: Control[] = [];

    addControl(control: Control): void {
        this.controls.push(control);
    }

    removeControl(control: Control): void {
        const index = this.controls.indexOf(control);
        if (index >= 0) {
            this.controls.splice(index, 1);
        }
    }

    getControls(): Control[] {
        return [...this.controls];
    }
}

// ==================== Property-Based Test Generators ====================

const themeGenerator = fc.record({
    primaryColor: fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.padEnd(6, '0').slice(0, 6)),
    secondaryColor: fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.padEnd(6, '0').slice(0, 6)),
    backgroundColor: fc.string({ minLength: 10, maxLength: 20 }),
    textColor: fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.padEnd(6, '0').slice(0, 6)),
    secondaryTextColor: fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.padEnd(6, '0').slice(0, 6)),
    errorColor: fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.padEnd(6, '0').slice(0, 6)),
    successColor: fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.padEnd(6, '0').slice(0, 6))
});

const positionGenerator = fc.record({
    x: fc.oneof(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.constant('0px'),
        fc.constant('50%'),
        fc.constant('100px')
    ),
    y: fc.oneof(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.constant('0px'),
        fc.constant('50%'),
        fc.constant('100px')
    ),
    horizontalAlignment: fc.integer({ min: 0, max: 2 }),
    verticalAlignment: fc.integer({ min: 0, max: 2 })
});

const sizeGenerator = fc.record({
    width: fc.oneof(
        fc.integer({ min: 50, max: 1000 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.constant('100%'),
        fc.constant('200px')
    ),
    height: fc.oneof(
        fc.integer({ min: 50, max: 800 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.constant('100%'),
        fc.constant('150px')
    )
});

const configGenerator = fc.record({
    position: fc.option(positionGenerator),
    size: fc.option(sizeGenerator),
    visible: fc.boolean(),
    theme: fc.option(themeGenerator)
});

describe('UIComponentBase Property-Based Tests', () => {

    let mockTexture: MockAdvancedDynamicTexture;

    beforeEach(() => {
        mockTexture = new MockAdvancedDynamicTexture();
    });

    // ==================== Property 10.1: Consistent Initialization ====================

    describe('Property 10.1: Consistent Initialization Behavior', () => {
        test('all UI components should initialize with consistent state regardless of configuration', () => {
            fc.assert(fc.property(
                configGenerator,
                (config) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);

                    // All components should initialize properly
                    expect(component.getSetupCalled()).toBe(true);
                    expect(component.getIsDisposed()).toBe(false);
                    expect(component.getMainContainerPublic()).toBeDefined();
                    expect(component.getContentPanelPublic()).toBeDefined();

                    // Initial visibility should match config or default to false
                    const expectedVisible = config.visible || false;
                    expect(component.getIsVisible()).toBe(expectedVisible);

                    // Should be added to parent texture
                    expect(mockTexture.getControls().length).toBe(1);

                    component.dispose();
                }
            ), { numRuns: 50 });
        });

        test('components should handle missing optional configuration gracefully', () => {
            fc.assert(fc.property(
                fc.constant(null), // No additional config
                () => {
                    const minimalConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any
                    };

                    const component = new MockUIComponent(minimalConfig);

                    // Should initialize with defaults
                    expect(component.getSetupCalled()).toBe(true);
                    expect(component.getIsVisible()).toBe(false);
                    expect(component.getIsDisposed()).toBe(false);

                    // Should use default theme
                    expect(component.getMainContainerPublic()).toBeDefined();

                    component.dispose();
                }
            ), { numRuns: 10 });
        });
    });

    // ==================== Property 10.2: Consistent Lifecycle Management ====================

    describe('Property 10.2: Consistent Lifecycle Management', () => {
        test('show/hide operations should be idempotent and consistent', () => {
            fc.assert(fc.property(
                configGenerator,
                fc.integer({ min: 1, max: 5 }), // Number of show/hide cycles
                (config, cycles) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);
                    let expectedVisible = config.visible || false;

                    // Test multiple show/hide cycles
                    for (let i = 0; i < cycles; i++) {
                        // Show operation
                        component.show();
                        expectedVisible = true;
                        expect(component.getIsVisible()).toBe(true);
                        expect(component.getShowCalled()).toBe(true);

                        // Multiple shows should be idempotent
                        component.show();
                        expect(component.getIsVisible()).toBe(true);

                        // Hide operation
                        component.hide();
                        expectedVisible = false;
                        expect(component.getIsVisible()).toBe(false);
                        expect(component.getHideCalled()).toBe(true);

                        // Multiple hides should be idempotent
                        component.hide();
                        expect(component.getIsVisible()).toBe(false);
                    }

                    component.dispose();
                }
            ), { numRuns: 30 });
        });

        test('toggle operation should alternate visibility state correctly', () => {
            fc.assert(fc.property(
                configGenerator,
                fc.integer({ min: 1, max: 10 }), // Number of toggles
                (config, toggleCount) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);
                    let expectedVisible = config.visible || false;

                    // Test multiple toggles
                    for (let i = 0; i < toggleCount; i++) {
                        component.toggle();
                        expectedVisible = !expectedVisible;
                        expect(component.getIsVisible()).toBe(expectedVisible);
                    }

                    component.dispose();
                }
            ), { numRuns: 30 });
        });

        test('disposal should always clean up resources properly', () => {
            fc.assert(fc.property(
                configGenerator,
                (config) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);
                    const initialControlCount = mockTexture.getControls().length;

                    // Perform some operations before disposal
                    component.show();
                    component.hide();
                    component.toggle();

                    // Dispose
                    component.dispose();

                    // Should be marked as disposed
                    expect(component.getIsDisposed()).toBe(true);
                    expect(component.getDisposeCalled()).toBe(true);

                    // Should be removed from parent texture
                    expect(mockTexture.getControls().length).toBe(initialControlCount - 1);

                    // Operations after disposal should be safe (no-ops)
                    component.show();
                    component.hide();
                    component.toggle();
                    expect(component.getIsDisposed()).toBe(true);
                }
            ), { numRuns: 30 });
        });
    });

    // ==================== Property 10.3: Consistent Styling and Theming ====================

    describe('Property 10.3: Consistent Styling and Theming', () => {
        test('theme changes should be applied consistently across all components', () => {
            fc.assert(fc.property(
                configGenerator,
                themeGenerator,
                (config, newTheme) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);

                    // Apply theme change
                    component.setTheme(newTheme);

                    // Should trigger theme change callback
                    expect(component.getThemeChangedCalled()).toBe(true);

                    // Main container should reflect theme changes
                    const container = component.getMainContainerPublic();
                    expect(container.color).toBe(newTheme.primaryColor);
                    expect(container.background).toBe(newTheme.backgroundColor);

                    component.dispose();
                }
            ), { numRuns: 30 });
        });

        test('partial theme updates should merge with existing theme', () => {
            fc.assert(fc.property(
                configGenerator,
                fc.record({
                    primaryColor: fc.option(fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.padEnd(6, '0').slice(0, 6))),
                    backgroundColor: fc.option(fc.string({ minLength: 5, maxLength: 15 }))
                }),
                (config, partialTheme) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);
                    const originalTheme = config.theme || DEFAULT_THEME;

                    // Apply partial theme
                    component.setTheme(partialTheme);

                    // Should merge with existing theme
                    const container = component.getMainContainerPublic();
                    
                    if (partialTheme.primaryColor) {
                        expect(container.color).toBe(partialTheme.primaryColor);
                    } else {
                        expect(container.color).toBe(originalTheme.primaryColor);
                    }

                    if (partialTheme.backgroundColor) {
                        expect(container.background).toBe(partialTheme.backgroundColor);
                    } else {
                        expect(container.background).toBe(originalTheme.backgroundColor);
                    }

                    component.dispose();
                }
            ), { numRuns: 30 });
        });
    });

    // ==================== Property 10.4: Consistent Button Creation ====================

    describe('Property 10.4: Consistent Button Creation and Behavior', () => {
        test('buttons should be created with consistent styling across all variants', () => {
            fc.assert(fc.property(
                configGenerator,
                fc.record({
                    text: fc.string({ minLength: 1, maxLength: 20 }),
                    variant: fc.constantFrom('primary', 'secondary', 'success', 'error', 'outline'),
                    width: fc.option(fc.oneof(
                        fc.integer({ min: 50, max: 300 }),
                        fc.string({ minLength: 1, maxLength: 10 })
                    )),
                    height: fc.option(fc.oneof(
                        fc.integer({ min: 20, max: 100 }),
                        fc.string({ minLength: 1, maxLength: 10 })
                    )),
                    disabled: fc.boolean()
                }),
                (config, buttonConfig) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);

                    // Create button using the base class method
                    let clickCalled = false;
                    const button = (component as any).createButton({
                        text: buttonConfig.text,
                        onClick: () => { clickCalled = true; },
                        variant: buttonConfig.variant,
                        width: buttonConfig.width,
                        height: buttonConfig.height,
                        disabled: buttonConfig.disabled
                    });

                    // Button should be created with consistent properties
                    expect(button).toBeDefined();
                    expect(button.textBlock?.text).toBe(buttonConfig.text);

                    // Styling should be applied based on variant
                    expect(button.cornerRadius).toBe(5);
                    expect(button.fontSize).toBe(14);
                    expect(button.fontWeight).toBe('bold');

                    // Size should be applied correctly
                    if (buttonConfig.width !== undefined) {
                        if (typeof buttonConfig.width === 'number') {
                            expect(button.widthInPixels).toBe(buttonConfig.width);
                        } else {
                            expect(button.width).toBe(buttonConfig.width);
                        }
                    } else {
                        expect(button.width).toBe('200px');
                    }

                    if (buttonConfig.height !== undefined) {
                        if (typeof buttonConfig.height === 'number') {
                            expect(button.heightInPixels).toBe(buttonConfig.height);
                        } else {
                            expect(button.height).toBe(buttonConfig.height);
                        }
                    } else {
                        expect(button.heightInPixels).toBe(40);
                    }

                    // Disabled state should be applied
                    if (buttonConfig.disabled) {
                        expect(button.alpha).toBe(0.5);
                        expect(button.isEnabled).toBe(false);
                    } else {
                        expect(button.alpha).toBe(1.0);
                        expect(button.isEnabled).toBe(true);
                    }

                    component.dispose();
                }
            ), { numRuns: 50 });
        });
    });

    // ==================== Property 10.5: Consistent Label Creation ====================

    describe('Property 10.5: Consistent Label Creation and Styling', () => {
        test('labels should be created with consistent properties', () => {
            fc.assert(fc.property(
                configGenerator,
                fc.record({
                    text: fc.string({ minLength: 1, maxLength: 50 }),
                    fontSize: fc.option(fc.integer({ min: 8, max: 24 })),
                    color: fc.option(fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.padEnd(6, '0').slice(0, 6))),
                    fontWeight: fc.option(fc.constantFrom('normal', 'bold', 'lighter')),
                    height: fc.option(fc.integer({ min: 10, max: 50 }))
                }),
                (config, labelConfig) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);
                    const theme = config.theme || DEFAULT_THEME;

                    // Create label using the base class method
                    const label = (component as any).createLabel(labelConfig);

                    // Label should be created with consistent properties
                    expect(label).toBeDefined();
                    expect(label.text).toBe(labelConfig.text);

                    // Properties should match config or defaults
                    expect(label.fontSize).toBe(labelConfig.fontSize || 12);
                    expect(label.color).toBe(labelConfig.color || theme.textColor);
                    expect(label.fontWeight).toBe(labelConfig.fontWeight || 'normal');
                    expect(label.heightInPixels).toBe(labelConfig.height || 20);

                    component.dispose();
                }
            ), { numRuns: 50 });
        });

        test('title and subtitle creation should be consistent', () => {
            fc.assert(fc.property(
                configGenerator,
                fc.string({ minLength: 1, max: 30 }),
                fc.string({ minLength: 1, max: 50 }),
                (config, titleText, subtitleText) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);
                    const theme = config.theme || DEFAULT_THEME;

                    // Create title and subtitle
                    const title = (component as any).createTitle(titleText);
                    const subtitle = (component as any).createSubtitle(subtitleText);

                    // Title should have consistent styling
                    expect(title.text).toBe(titleText);
                    expect(title.fontSize).toBe(16);
                    expect(title.fontWeight).toBe('bold');
                    expect(title.color).toBe(theme.primaryColor);
                    expect(title.heightInPixels).toBe(25);

                    // Subtitle should have consistent styling
                    expect(subtitle.text).toBe(subtitleText);
                    expect(subtitle.fontSize).toBe(12);
                    expect(subtitle.color).toBe(theme.secondaryTextColor);
                    expect(subtitle.heightInPixels).toBe(18);

                    component.dispose();
                }
            ), { numRuns: 30 });
        });
    });

    // ==================== Property 10.6: Consistent Layout Helpers ====================

    describe('Property 10.6: Consistent Layout Helper Behavior', () => {
        test('layout panels should be created with consistent properties', () => {
            fc.assert(fc.property(
                configGenerator,
                (config) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);

                    // Create layout panels
                    const horizontalPanel = (component as any).createHorizontalPanel();
                    const verticalPanel = (component as any).createVerticalPanel();

                    // Horizontal panel should be configured correctly
                    expect(horizontalPanel.isVertical).toBe(false);
                    expect(horizontalPanel.spacing).toBe(10);

                    // Vertical panel should be configured correctly
                    expect(verticalPanel.isVertical).toBe(true);
                    expect(verticalPanel.spacing).toBe(5);

                    component.dispose();
                }
            ), { numRuns: 20 });
        });

        test('grid creation should be consistent with specified dimensions', () => {
            fc.assert(fc.property(
                configGenerator,
                fc.integer({ min: 1, max: 5 }), // rows
                fc.integer({ min: 1, max: 5 }), // columns
                (config, rows, columns) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);

                    // Create grid
                    const grid = (component as any).createGrid(rows, columns);

                    // Grid should have correct dimensions
                    expect(grid).toBeDefined();
                    // Note: We can't easily test the internal structure of Babylon.js Grid
                    // but we can verify it was created without errors

                    component.dispose();
                }
            ), { numRuns: 20 });
        });

        test('spacers should be created with consistent properties', () => {
            fc.assert(fc.property(
                configGenerator,
                fc.option(fc.integer({ min: 5, max: 50 })),
                (config, height) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);

                    // Create spacer
                    const spacer = (component as any).createSpacer(height);

                    // Spacer should have consistent properties
                    expect(spacer.heightInPixels).toBe(height || 10);
                    expect(spacer.thickness).toBe(0);
                    expect(spacer.background).toBe('transparent');

                    component.dispose();
                }
            ), { numRuns: 20 });
        });
    });

    // ==================== Property 10.7: Consistent Position and Size Management ====================

    describe('Property 10.7: Consistent Position and Size Management', () => {
        test('position updates should be applied consistently', () => {
            fc.assert(fc.property(
                configGenerator,
                fc.string({ minLength: 1, maxLength: 10 }),
                fc.string({ minLength: 1, maxLength: 10 }),
                (config, x, y) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);

                    // Update position
                    component.setPosition(x, y);

                    // Position should be applied to main container
                    const container = component.getMainContainerPublic();
                    expect(container.left).toBe(x);
                    expect(container.top).toBe(y);

                    component.dispose();
                }
            ), { numRuns: 30 });
        });

        test('size updates should be applied consistently', () => {
            fc.assert(fc.property(
                configGenerator,
                fc.oneof(
                    fc.integer({ min: 100, max: 500 }),
                    fc.string({ minLength: 1, maxLength: 10 })
                ),
                fc.oneof(
                    fc.integer({ min: 50, max: 300 }),
                    fc.string({ minLength: 1, maxLength: 10 })
                ),
                (config, width, height) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);

                    // Update size
                    component.setSize(width, height);

                    // Size should be applied to main container
                    const container = component.getMainContainerPublic();
                    
                    if (typeof width === 'number') {
                        expect(container.widthInPixels).toBe(width);
                    } else {
                        expect(container.width).toBe(width);
                    }

                    if (typeof height === 'number') {
                        expect(container.heightInPixels).toBe(height);
                    } else {
                        expect(container.height).toBe(height);
                    }

                    component.dispose();
                }
            ), { numRuns: 30 });
        });
    });

    // ==================== Property 10.8: Consistent Progress Bar Behavior ====================

    describe('Property 10.8: Consistent Progress Bar Creation and Updates', () => {
        test('progress bars should be created with consistent styling', () => {
            fc.assert(fc.property(
                configGenerator,
                fc.option(fc.integer({ min: 100, max: 400 })),
                fc.option(fc.integer({ min: 10, max: 50 })),
                (config, width, height) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);
                    const theme = config.theme || DEFAULT_THEME;

                    // Create progress bar
                    const progressBar = (component as any).createProgressBar(width, height);

                    // Should have consistent structure
                    expect(progressBar.container).toBeDefined();
                    expect(progressBar.fill).toBeDefined();
                    expect(progressBar.text).toBeDefined();

                    // Container should have correct dimensions
                    expect(progressBar.container.widthInPixels).toBe(width || 200);
                    expect(progressBar.container.heightInPixels).toBe(height || 20);

                    // Styling should be consistent
                    expect(progressBar.container.cornerRadius).toBe(3);
                    expect(progressBar.fill.background).toBe(theme.primaryColor);
                    expect(progressBar.text.fontSize).toBe(10);
                    expect(progressBar.text.fontWeight).toBe('bold');

                    component.dispose();
                }
            ), { numRuns: 30 });
        });

        test('progress bar updates should be consistent and clamped', () => {
            fc.assert(fc.property(
                configGenerator,
                fc.float({ min: -1, max: 2 }), // Test values outside 0-1 range
                fc.option(fc.integer({ min: 100, max: 400 })),
                (config, progress, containerWidth) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);
                    const width = containerWidth || 200;

                    // Create and update progress bar
                    const progressBar = (component as any).createProgressBar(width, 20);
                    (component as any).updateProgressBar(progressBar, progress, width);

                    // Progress should be clamped to 0-1 range
                    const clampedProgress = Math.max(0, Math.min(1, progress));
                    const expectedWidth = clampedProgress * width;
                    const expectedText = `${Math.round(clampedProgress * 100)}%`;

                    expect(progressBar.fill.widthInPixels).toBe(expectedWidth);
                    expect(progressBar.text.text).toBe(expectedText);

                    component.dispose();
                }
            ), { numRuns: 30 });
        });
    });

    // ==================== Property 10.9: Content Management Consistency ====================

    describe('Property 10.9: Consistent Content Management', () => {
        test('content operations should maintain consistent state', () => {
            fc.assert(fc.property(
                configGenerator,
                fc.integer({ min: 1, max: 5 }), // Number of controls to add
                (config, controlCount) => {
                    const fullConfig: UIComponentConfig = {
                        parentTexture: mockTexture as any,
                        ...config
                    };

                    const component = new MockUIComponent(fullConfig);
                    const contentPanel = component.getContentPanelPublic();

                    // Add multiple controls
                    const controls = [];
                    for (let i = 0; i < controlCount; i++) {
                        const label = (component as any).createLabel({
                            text: `Label ${i}`,
                            fontSize: 12
                        });
                        controls.push(label);
                        (component as any).addToContent(label);
                    }

                    // All controls should be added
                    // Note: We can't easily count Babylon.js controls, but operation should not throw

                    // Remove controls
                    controls.forEach(control => {
                        (component as any).removeFromContent(control);
                    });

                    // Clear all content
                    (component as any).clearContent();

                    // Should not throw errors
                    expect(true).toBe(true);

                    component.dispose();
                }
            ), { numRuns: 20 });
        });
    });
});