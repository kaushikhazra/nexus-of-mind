# Requirements Document

## Introduction

The In-Game Help System provides players with contextual information about game mechanics, controls, and enemy behavior through a keyboard-triggered overlay window. The help system uses a tabbed interface to organize information into logical categories, allowing players to quickly find the guidance they need without leaving the game.

## Glossary

- **HelpWindow**: The main overlay component that displays help information
- **TabNavigation**: The horizontal tab bar for switching between help categories
- **NavigationTab**: First tab showing camera and movement controls
- **ControlsTab**: Second tab showing building placement, unit creation, and interaction controls
- **EnemyTab**: Third tab showing basic overview of parasite behavior
- **HKey_Trigger**: The 'H' keyboard key that opens the help window
- **EscapeKey_Close**: The Escape key that closes the help window
- **CloseButton**: The UI button that closes the help window

## Requirements

### Requirement 1: Help Window Activation

**User Story:** As a player, I want to press the 'H' key to open the help window, so that I can quickly access game information without interrupting gameplay.

#### Acceptance Criteria

1. WHEN the player presses the 'H' key AND the help window is closed, THE HelpWindow SHALL become visible
2. WHEN the player presses the 'H' key AND the help window is already open, THE HelpWindow SHALL remain open (no toggle)
3. THE game SHALL continue running in the background while the help window is open
4. THE HelpWindow SHALL be centered on the screen
5. THE HelpWindow SHALL appear above all other UI elements

### Requirement 2: Help Window Closing

**User Story:** As a player, I want to close the help window using the Escape key or a close button, so that I can return to gameplay quickly.

#### Acceptance Criteria

1. WHEN the player presses the Escape key AND the help window is open, THE HelpWindow SHALL close
2. WHEN the player clicks the CloseButton, THE HelpWindow SHALL close
3. WHEN the help window closes, THE game SHALL continue normally
4. THE CloseButton SHALL be visually consistent with other UI close buttons (red theme)
5. THE CloseButton SHALL be positioned in the top-right corner of the HelpWindow

### Requirement 3: Tabbed Interface Navigation

**User Story:** As a player, I want to switch between help categories using tabs, so that I can find specific information quickly.

#### Acceptance Criteria

1. THE HelpWindow SHALL display exactly 3 tabs: Navigation, Controls, and Enemy
2. WHEN the player clicks a tab, THE corresponding content panel SHALL become visible
3. WHEN the player clicks a tab, THE previously active content panel SHALL become hidden
4. THE active tab SHALL be visually distinguished from inactive tabs
5. THE first tab (Navigation) SHALL be active by default when opening the help window
6. THE tabs SHALL be arranged horizontally at the top of the content area

### Requirement 4: Navigation Tab Content

**User Story:** As a player, I want to see camera and movement controls in the Navigation tab, so that I can learn how to navigate the game world.

#### Acceptance Criteria

1. THE NavigationTab SHALL display keyboard controls: W/S/A/D and Arrow keys
2. THE NavigationTab SHALL describe forward/backward camera movement
3. THE NavigationTab SHALL describe left/right camera rotation
4. THE NavigationTab SHALL describe mouse wheel zoom functionality
5. THE NavigationTab SHALL describe mouse drag camera rotation
6. THE content SHALL be organized in a readable table or list format

### Requirement 5: Controls Tab Content

**User Story:** As a player, I want to see unit and building controls in the Controls tab, so that I can learn how to interact with game elements.

#### Acceptance Criteria

1. THE ControlsTab SHALL explain building placement process (select building → position → click to place)
2. THE ControlsTab SHALL explain power plant packing (select → click pack button)
3. THE ControlsTab SHALL explain worker creation from base
4. THE ControlsTab SHALL explain protector creation from base
5. THE ControlsTab SHALL explain worker movement (click on mineral deposits)
6. THE ControlsTab SHALL explain protector movement (click on terrain or enemies)
7. THE ControlsTab SHALL explain right-click mineral checking feature
8. THE content SHALL be organized with clear headings for each action type

### Requirement 6: Enemy Tab Content

**User Story:** As a player, I want to see basic enemy information in the Enemy tab, so that I can understand the threats I face.

#### Acceptance Criteria

1. THE EnemyTab SHALL provide a basic overview of Energy Parasites
2. THE EnemyTab SHALL describe Combat Parasites and their target preference (Protectors)
3. THE EnemyTab SHALL describe Energy Parasites and their target preference (Workers)
4. THE EnemyTab SHALL explain basic parasite behavior states (patrol, hunt, attack)
5. THE EnemyTab SHALL provide basic strategic tips for dealing with parasites
6. THE content SHALL be concise and easy to read quickly

### Requirement 7: Visual Consistency

**User Story:** As a developer, I want the help window to match the existing UI style, so that the interface feels cohesive.

#### Acceptance Criteria

1. THE HelpWindow SHALL use the standard color scheme (#00ff88 borders, rgba(0,20,40,0.9) background)
2. THE HelpWindow SHALL use rounded corners (10px radius)
3. THE HelpWindow SHALL use the Orbitron font family
4. THE HelpWindow SHALL have consistent padding and spacing with other UI elements
5. THE HelpWindow SHALL NOT look like the PlayerStatsUI (different positioning and style)
6. THE tabs SHALL have clear active/inactive visual states
