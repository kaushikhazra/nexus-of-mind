# Implementation Plan: In-Game Help System

## Overview

This implementation plan creates a keyboard-triggered help overlay with tabbed content for game navigation, controls, and enemy information. The help window follows existing UI patterns and integrates with the game's keyboard handling system.

## Tasks

- [x] 1. Create help system file structure
  - Create `client/src/ui/help/` directory
  - Create empty files: HelpWindow.ts, HelpTabNavigation.ts, HelpContentBuilder.ts, HelpStyles.ts, index.ts
  - _Requirements: None (setup)_

- [x] 2. Implement HelpStyles constants
  - [x] 2.1 Define color constants matching UITheme
    - Primary color: #00ff88
    - Background: rgba(0, 20, 40, 0.95)
    - Text colors, close button color
    - _Requirements: 7.1_

  - [x] 2.2 Define typography constants
    - Font family: Orbitron, monospace
    - Size values for title, headers, body, tables
    - _Requirements: 7.3_

  - [x] 2.3 Define spacing and dimension constants
    - Window dimensions: 650x500
    - Padding, gaps, border radius
    - _Requirements: 7.2, 7.4_

- [x] 3. Implement HelpTabNavigation component
  - [x] 3.1 Create tab bar container
    - Horizontal StackPanel for tabs
    - Positioned at top of content area
    - _Requirements: 3.6_

  - [x] 3.2 Create individual tab buttons
    - Three tabs: Navigation, Controls, Enemy
    - Click handlers for tab switching
    - _Requirements: 3.1_

  - [x] 3.3 Implement tab selection styling
    - Active tab visual state (filled background)
    - Inactive tab visual state (transparent)
    - Hover effects
    - _Requirements: 3.4_

  - [x] 3.4 Implement tab switching logic
    - Hide previous content, show new content
    - Update active tab styling
    - Callback for content switching
    - _Requirements: 3.2, 3.3_

- [x] 4. Implement HelpContentBuilder utility
  - [x] 4.1 Create section builder method
    - Title text with section styling
    - Content paragraphs with body styling
    - _Requirements: 4.6, 5.8, 6.6_

  - [x] 4.2 Create table builder method
    - Header row styling
    - Data row styling
    - Column alignment
    - _Requirements: 4.6_

  - [x] 4.3 Build Navigation tab content
    - Camera controls table (WASD, arrows)
    - Mouse controls (wheel, drag)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.4 Build Controls tab content
    - Building placement section
    - Power plant packing section
    - Unit creation section
    - Unit movement section
    - Right-click interactions section
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 4.5 Build Enemy tab content
    - Parasite overview section
    - Combat Parasite description
    - Energy Parasite description
    - Behavior states
    - Strategy tips
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 5. Implement HelpWindow main component
  - [x] 5.1 Create main window container
    - Rectangle with standard styling
    - Centered position on screen
    - Z-index above other UI
    - _Requirements: 1.4, 1.5, 7.1, 7.2_

  - [x] 5.2 Create title bar
    - Title text: "IN-GAME HELP"
    - Positioned at top of window
    - _Requirements: 7.3_

  - [x] 5.3 Create close button
    - Red theme styling
    - Positioned top-right
    - Click handler to close window
    - _Requirements: 2.2, 2.4, 2.5_

  - [x] 5.4 Integrate tab navigation
    - Add HelpTabNavigation component
    - Wire up tab change callbacks
    - _Requirements: 3.1_

  - [x] 5.5 Create content area
    - StackPanel for tab content
    - Scrollable if content exceeds height
    - _Requirements: 3.2, 3.3_

  - [x] 5.6 Implement show/hide methods
    - Show: make container visible
    - Hide: make container invisible
    - Track isOpen state
    - _Requirements: 1.1, 2.1, 2.3_

  - [x] 5.7 Set default tab on open
    - Select Navigation tab when opening
    - _Requirements: 3.5_

- [x] 6. Implement keyboard handling
  - [x] 6.1 Create keyboard event handler
    - Handle 'H' key to open help
    - Handle 'Escape' key to close help
    - Prevent event propagation when help is open
    - _Requirements: 1.1, 1.2, 2.1_

  - [x] 6.2 Register event listeners
    - Add keydown listener on window
    - Store handler reference for cleanup
    - _Requirements: 1.1, 2.1_

  - [x] 6.3 Implement dispose method
    - Remove keyboard event listeners
    - Dispose all GUI controls
    - Clear references
    - _Requirements: None (cleanup)_

- [x] 7. Integrate with GameEngine
  - [x] 7.1 Create HelpWindow instance in GameEngine
    - Initialize during game setup
    - Pass scene reference
    - _Requirements: 1.3_

  - [x] 7.2 Add help window to GUI layer
    - Add to advanced dynamic texture
    - Ensure proper z-ordering
    - _Requirements: 1.5_

  - [x] 7.3 Ensure game continues during help
    - Verify game loop runs while help is open
    - No pausing of game state
    - _Requirements: 1.3, 2.3_

- [x] 8. Create exports and integration
  - [x] 8.1 Create index.ts exports
    - Export HelpWindow class
    - Export types/interfaces
    - _Requirements: None (setup)_

  - [x] 8.2 Update main UI exports if needed
    - Add help module to UI index
    - _Requirements: None (setup)_

- [x] 9. Testing and verification
  - [x] 9.1 Test H key opens help window
    - Verify window appears centered
    - Verify Navigation tab is default
    - _Requirements: 1.1, 1.4, 3.5_

  - [x] 9.2 Test Escape key closes help window
    - Verify window closes
    - Verify game continues
    - _Requirements: 2.1, 2.3_

  - [x] 9.3 Test close button closes help window
    - Verify click closes window
    - _Requirements: 2.2_

  - [x] 9.4 Test tab switching
    - Verify all three tabs work
    - Verify content changes correctly
    - Verify active tab styling
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 9.5 Verify content accuracy
    - Check Navigation tab content
    - Check Controls tab content
    - Check Enemy tab content
    - _Requirements: 4.1-4.6, 5.1-5.8, 6.1-6.6_

  - [x] 9.6 Verify visual consistency
    - Match standard window styling
    - Confirm NOT like PlayerStatsUI
    - _Requirements: 7.1-7.5_

- [x] 10. Code quality verification
  - [x] 10.1 Run TypeScript compiler
    - Verify no type errors
    - _Requirements: client-code-quality_

  - [x] 10.2 Run ESLint
    - Fix any linting issues
    - _Requirements: client-code-quality_

  - [x] 10.3 Run import validation
    - Verify no circular dependencies
    - _Requirements: client-code-quality_

## Notes

- Each task references specific requirements for traceability
- The help window uses Babylon.js GUI (not HTML/CSS) for consistency
- Follow existing patterns from UIComponentBase and UITheme
- Test keyboard handling doesn't conflict with game controls
- Ensure proper cleanup on disposal to prevent memory leaks

## Completion Summary

All tasks completed on 2026-01-28. The in-game help system is fully functional with:
- H key to open help window
- Escape key or close button to close
- Three tabbed sections: Navigation, Controls, Enemy
- Visual styling consistent with existing UI
- Game continues running while help is open
- All code quality checks passing
