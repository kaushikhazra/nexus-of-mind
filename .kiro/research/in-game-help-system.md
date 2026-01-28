# In-Game Help System Research

## Overview

This document captures research findings for implementing an in-game help system that displays when the player presses the 'H' key. The help window should follow the existing UI patterns in the codebase (excluding PlayerStatsUI which has a different style).

## Requirements Summary

- **Trigger**: Press 'H' key to show help
- **Close**: Press 'Escape' key OR click close button
- **Position**: Centered on screen
- **Game State**: Game continues running in background
- **Structure**: Tabbed interface with 3 tabs

### Tab Content
1. **Game Navigation** - Camera controls, movement
2. **Controls** - Building placement, unit creation, unit movement, mineral checking
3. **Enemy** - Basic overview of parasites and their behavior

---

## UI Pattern Analysis

### Standard Window Style (from UIComponentBase)

The codebase uses a consistent UI pattern through Babylon.js GUI:

```typescript
// Container styling
container = {
  cornerRadius: 10,
  color: '#00ff88',          // Primary border color
  thickness: 2,
  background: 'rgba(0, 20, 40, 0.9)',  // Dark blue-black with opacity
  paddingTopInPixels: 10,
  paddingBottomInPixels: 10,
  paddingLeftInPixels: 15,
  paddingRightInPixels: 15
}
```

### Theme Colors (from UITheme.ts)

```typescript
primaryColor: '#00ff88'        // Cyan-green for active elements
secondaryColor: '#555555'      // Dark gray for borders
backgroundColor: 'rgba(0, 20, 40, 0.9)'  // Deep blue-black
textColor: '#ffffff'           // White text
secondaryTextColor: '#cccccc'  // Light gray for secondary text
errorColor: '#ff4444'          // Red for errors/close buttons
successColor: '#44ff44'        // Green for success
```

### Close Button Pattern

```typescript
closeButton = {
  background: 'rgba(255, 0, 0, 0.2)',
  border: '1px solid #ff4444',
  borderRadius: '4px',
  color: '#ff4444',
  fontFamily: "'Orbitron', monospace",
  fontSize: '11px'
}

// Hover effect
onHover: {
  background: 'rgba(80, 0, 40, 0.6)',
  boxShadow: '0 0 10px #ff444440'
}
```

### Hover Effects (from LearningProgressUI)

```typescript
onPointerEnterObservable.add(() => {
  container.color = '#00ffaa';
  container.background = 'rgba(0, 25, 45, 0.95)';
});

onPointerOutObservable.add(() => {
  container.color = '#00ff88';
  container.background = 'rgba(0, 20, 40, 0.9)';
});
```

---

## Tab Implementation Strategy

No existing tabbed interfaces exist in the codebase. Recommended approach:

```typescript
// Tab header styling
tabButton = {
  active: {
    background: '#00ff88',
    color: '#000000',
    borderBottom: '2px solid #00ff88'
  },
  inactive: {
    background: 'transparent',
    color: '#00ff88',
    borderBottom: '2px solid transparent'
  }
}

// Tab content visibility toggle
selectTab(tabId: string) {
  for (const [id, panel] of tabContent.entries()) {
    panel.isVisible = (id === tabId);
  }
  // Update tab button styles
}
```

---

## Keyboard Input Handling

### Current Pattern (from CameraController)

```typescript
private setupKeyboardControls(): void {
  this.keydownHandler = (event: KeyboardEvent) => {
    // Handle key press
  };

  window.addEventListener('keydown', this.keydownHandler);
}

// CRITICAL: Cleanup in dispose()
public dispose(): void {
  window.removeEventListener('keydown', this.keydownHandler);
}
```

### Required Bindings for Help System

- **'H' key (KeyH)**: Toggle help window visibility
- **Escape key (Escape)**: Close help window if open

---

## Game Dynamics to Document

### Tab 1: Game Navigation

| Control | Action |
|---------|--------|
| W / Arrow Up | Move camera forward |
| S / Arrow Down | Move camera backward |
| A / Arrow Left | Rotate camera left |
| D / Arrow Right | Rotate camera right |
| Mouse Wheel | Zoom in/out |
| Mouse Drag | Rotate camera view |

**Camera Constraints:**
- Zoom range: 8-60 units
- Smooth inertia movement (0.7 factor)

### Tab 2: Controls

#### Building Placement
1. Click a building button in the UI
2. Move mouse to preview placement location
3. Left-click to place (requires sufficient energy)
4. Press Cancel or ESC to exit placement mode

**Buildings:**
- **Base** (50 energy) - Central hub, yellow colored
- **Power Plant** (30 energy) - Energy generation, orange colored

**Packing Power Generator:**
- Select a deployed power plant
- Click the "Pack" button
- Power plant returns to portable state

#### Unit Creation
- **Workers**: Created from Base, cost energy, specialized for mining
- **Protectors**: Created from Base, cost energy, specialized for combat

#### Unit Movement
- **Select Unit**: Left-click on unit
- **Move Worker**: Left-click on mineral deposit (workers only move to resources)
- **Move Protector**: Left-click on terrain or enemy to move and auto-attack

#### Mineral Checking
- **Right-click** on terrain or units to view information tooltip
- Shows mineral content, unit stats, etc.

### Tab 3: Enemy (Parasites)

#### Overview
Energy Parasites are the native hostile creatures of this planet. They protect the Adaptive Queen and hunt for energy.

#### Parasite Types

**Combat Parasite**
- Prioritizes attacking Protectors
- Aggressive, combat-focused behavior
- Higher damage output

**Energy Parasite**
- Targets Workers specifically
- Steals energy from units
- More numerous but weaker

#### Parasite Behavior States
1. **Spawning** - Emerging from hive
2. **Patrolling** - Roaming within territory
3. **Hunting** - Pursuing detected targets
4. **Feeding** - Actively attacking
5. **Returning** - Moving back to hive

#### Strategic Notes
- Parasites operate within territory (50 unit radius)
- They learn from defeats and adapt tactics
- Protect your Workers with Protectors

---

## Implementation Notes

### Suggested Window Size
- Width: 600-700px (to fit all content comfortably)
- Height: 450-500px (with scrollable content if needed)
- Centered on screen

### File Structure
```
client/src/ui/help/
  ├── HelpWindow.ts         # Main help window component
  ├── HelpTabNavigation.ts  # Tab switching logic
  ├── HelpNavigationTab.ts  # Game navigation content
  ├── HelpControlsTab.ts    # Controls content
  ├── HelpEnemyTab.ts       # Enemy information content
  └── index.ts              # Exports
```

### Integration Points
- Register 'H' key handler in GameEngine or InputHandler
- Add Escape key handler for closing
- Ensure help window doesn't block game input when closed
- Use UIComponentBase patterns for consistency

### Font Recommendations
- Font family: 'Orbitron', monospace (matches existing UI)
- Header size: 16-18px
- Body text: 12-14px
- Table cells: 11-12px
