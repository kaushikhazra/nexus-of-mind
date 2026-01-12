// Mock Babylon.js GUI classes for testing

class AdvancedDynamicTexture {
    static CreateFullscreenUI(name) {
        return new AdvancedDynamicTexture();
    }
    
    addControl(control) {
        // Mock implementation
    }
    
    removeControl(control) {
        // Mock implementation
    }
}

class TextBlock {
    constructor(name, text) {
        this.name = name;
        this.text = text;
        this.color = 'white';
        this.fontSize = 14;
        this.fontFamily = 'Arial';
        this.textHorizontalAlignment = 0;
        this.textVerticalAlignment = 0;
        this.widthInPixels = 100;
        this.heightInPixels = 30;
        this.leftInPixels = 0;
        this.topInPixels = 0;
    }
}

class Control {
    static HORIZONTAL_ALIGNMENT_LEFT = 0;
    static HORIZONTAL_ALIGNMENT_CENTER = 1;
    static HORIZONTAL_ALIGNMENT_RIGHT = 2;
    static VERTICAL_ALIGNMENT_TOP = 0;
    static VERTICAL_ALIGNMENT_CENTER = 1;
    static VERTICAL_ALIGNMENT_BOTTOM = 2;
}

module.exports = {
    AdvancedDynamicTexture,
    TextBlock,
    Control
};