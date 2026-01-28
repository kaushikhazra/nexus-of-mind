# Design Document

## Overview

The In-Game Help System provides a keyboard-triggered overlay window with tabbed content for game navigation, controls, and enemy information. The system integrates with the existing UI framework, following established patterns from UIComponentBase while maintaining visual consistency with other game windows (excluding PlayerStatsUI which has a different style).

## Architecture

### Component Integration
The help system integrates with existing game components:
- **GameEngine/InputHandler**: Handles 'H' key and Escape key events
- **UIComponentBase**: Provides base styling and patterns
- **UITheme**: Provides consistent colors and styling
- **Scene GUI**: Renders the help window using Babylon.js GUI

### Help Window Flow
```
H Key Press → Check if closed → Open HelpWindow → Show Navigation Tab (default)
                                      ↓
Tab Click → Switch active tab → Hide previous content → Show new content
                                      ↓
Escape/Close Button → Close HelpWindow → Resume normal input handling
```

## Components and Interfaces

### HelpWindow Class
**Purpose**: Main container for the help system UI

**Key Methods**:
- `show(): void` - Display the help window
- `hide(): void` - Hide the help window
- `isVisible(): boolean` - Check visibility state
- `selectTab(tabId: string): void` - Switch to specified tab
- `dispose(): void` - Clean up resources and event listeners

**Properties**:
- `container: Rectangle` - Main window container
- `tabNavigation: HelpTabNavigation` - Tab bar component
- `contentPanels: Map<string, StackPanel>` - Tab content panels
- `closeButton: Button` - Close button component
- `isOpen: boolean` - Current visibility state

### HelpTabNavigation Class
**Purpose**: Manages the horizontal tab bar and tab switching

**Key Methods**:
- `createTabs(): void` - Create tab buttons
- `selectTab(tabId: string): void` - Activate specified tab
- `onTabSelected: (tabId: string) => void` - Callback for tab changes

**Properties**:
- `tabContainer: StackPanel` - Horizontal container for tabs
- `tabs: Map<string, Button>` - Tab button references
- `activeTabId: string` - Currently active tab

### HelpContentBuilder Class
**Purpose**: Generates content for each help tab

**Key Methods**:
- `buildNavigationContent(): StackPanel` - Create navigation tab content
- `buildControlsContent(): StackPanel` - Create controls tab content
- `buildEnemyContent(): StackPanel` - Create enemy tab content
- `createSection(title: string, content: string[]): StackPanel` - Create content section
- `createTable(headers: string[], rows: string[][]): StackPanel` - Create data table

## Data Models

### Help Window Configuration
```typescript
interface HelpWindowConfig {
  width: number;           // 650px
  height: number;          // 500px
  backgroundColor: string; // rgba(0, 20, 40, 0.95)
  borderColor: string;     // #00ff88
  borderWidth: number;     // 2
  cornerRadius: number;    // 10
  padding: number;         // 20
}
```

### Tab Definition
```typescript
interface TabDefinition {
  id: string;              // 'navigation' | 'controls' | 'enemy'
  label: string;           // Display text
  icon?: string;           // Optional icon
  content: StackPanel;     // Content panel reference
}
```

### Tab Styling
```typescript
interface TabStyle {
  active: {
    backgroundColor: string;  // #00ff88
    textColor: string;        // #000000
    borderBottom: string;     // 2px solid #00ff88
  };
  inactive: {
    backgroundColor: string;  // transparent
    textColor: string;        // #00ff88
    borderBottom: string;     // 2px solid transparent
  };
  hover: {
    backgroundColor: string;  // rgba(0, 255, 136, 0.2)
  };
}
```

## UI Layout

### Window Structure
```
┌─────────────────────────────────────────────────────────┐
│  IN-GAME HELP                                    [X]    │  ← Title bar with close button
├─────────────────────────────────────────────────────────┤
│  [Navigation]  [Controls]  [Enemy]                      │  ← Tab bar
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Tab Content Area                                       │
│                                                         │
│  (Scrollable if content exceeds visible area)           │
│                                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Tab Content: Navigation
```
CAMERA CONTROLS

Movement
┌──────────────────┬────────────────────────────┐
│ W / Arrow Up     │ Move camera forward        │
│ S / Arrow Down   │ Move camera backward       │
│ A / Arrow Left   │ Rotate camera left         │
│ D / Arrow Right  │ Rotate camera right        │
└──────────────────┴────────────────────────────┘

Zoom & Rotation
┌──────────────────┬────────────────────────────┐
│ Mouse Wheel      │ Zoom in/out                │
│ Mouse Drag       │ Rotate camera view         │
└──────────────────┴────────────────────────────┘
```

### Tab Content: Controls
```
BUILDINGS

Placing Buildings:
1. Click a building button in the bottom panel
2. Move mouse to preview placement location
3. Left-click to place (requires energy)
4. Press ESC or Cancel to exit placement mode

Packing Power Plants:
1. Select a deployed power plant
2. Click the "Pack" button to make it portable

UNITS

Creating Units:
• Workers - Created from Base, specialized for mining
• Protectors - Created from Base, specialized for combat

Moving Units:
• Workers: Click on mineral deposits to mine
• Protectors: Click on terrain to move, auto-attacks nearby enemies

INTERACTIONS

• Right-click: View information tooltips
• Left-click unit: Select unit
• Left-click terrain: Move selected unit (Protectors only)
```

### Tab Content: Enemy
```
ENERGY PARASITES

The planet is home to hostile Energy Parasites that protect
the Adaptive Queen. They hunt your units for energy.

PARASITE TYPES

Combat Parasites
• Aggressive, combat-focused behavior
• Prioritize attacking your Protectors
• Higher damage output

Energy Parasites
• Target your Workers specifically
• Steal energy from units
• More numerous but weaker

BEHAVIOR

Parasites will:
• Patrol their territory around the hive
• Hunt when they detect your units
• Attack until target is destroyed or escapes

STRATEGY TIPS

• Keep Protectors near your Workers for protection
• Parasites have a limited patrol territory
• Destroying parasites rewards energy
```

## Keyboard Handling

### Key Registration
```typescript
// In HelpWindow or InputHandler
private setupKeyboardHandlers(): void {
  this.keydownHandler = (event: KeyboardEvent) => {
    if (event.code === 'KeyH' && !this.isOpen) {
      this.show();
      event.preventDefault();
    }
    if (event.code === 'Escape' && this.isOpen) {
      this.hide();
      event.preventDefault();
    }
  };

  window.addEventListener('keydown', this.keydownHandler);
}
```

### Event Cleanup
```typescript
public dispose(): void {
  window.removeEventListener('keydown', this.keydownHandler);
  // Dispose all GUI controls
}
```

## Styling Constants

### Colors (from UITheme)
```typescript
const HELP_COLORS = {
  primary: '#00ff88',
  background: 'rgba(0, 20, 40, 0.95)',
  text: '#ffffff',
  secondaryText: '#cccccc',
  closeButton: '#ff4444',
  tabActive: '#00ff88',
  tabInactive: 'transparent',
  sectionHeader: '#00ff88'
};
```

### Typography
```typescript
const HELP_TYPOGRAPHY = {
  fontFamily: "'Orbitron', monospace",
  titleSize: 18,
  headerSize: 14,
  bodySize: 12,
  tableSize: 11
};
```

### Spacing
```typescript
const HELP_SPACING = {
  windowPadding: 20,
  sectionGap: 15,
  tableRowGap: 5,
  tabGap: 10
};
```

## Error Handling

### Key Event Conflicts
- Check if other modal UI is open before handling 'H' key
- Prevent key events from propagating to game when help is open

### Cleanup on Disposal
- Remove all keyboard event listeners
- Dispose all Babylon.js GUI controls
- Clear content panel references

## File Structure

```
client/src/ui/help/
  ├── HelpWindow.ts           # Main help window component
  ├── HelpTabNavigation.ts    # Tab bar component
  ├── HelpContentBuilder.ts   # Content generation utilities
  ├── HelpStyles.ts           # Styling constants
  └── index.ts                # Exports
```

## Integration Points

### GameEngine Integration
- Register 'H' key handler during game initialization
- Pass scene reference for GUI rendering
- Ensure help window doesn't interfere with game loop

### InputHandler Integration
- Add help window keyboard handling to existing input system
- Coordinate with other UI modals (building placement, etc.)
