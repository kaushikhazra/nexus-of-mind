# Requirements Document

## Introduction

Phase 2 transforms Nexus of Mind from scattered parasite encounters into territorial warfare with Queen-controlled regions. This system introduces high-stakes hive assault missions and territory liberation mechanics that create the foundation for neural network learning in Phase 3. The Queen & Territory System builds directly on the Enhanced Parasite System (Phase 1) to create organized AI opponents with clear strategic objectives.

## Glossary

- **Territory**: A 16x16 chunk region (1024x1024 units) controlled by a Queen
- **Queen**: A powerful stationary entity that controls all parasites within its territory
- **Hive**: The above-ground structure that houses the Queen and makes it vulnerable
- **Territory_Liberation**: The 3-5 minute parasite-free period after Queen death
- **Underground_Growth**: The invulnerable phase when a new Queen regenerates
- **Defensive_Swarm**: 50+ parasites that spawn to protect the hive
- **Chunk**: 64x64 unit grid section used for world organization
- **Parasite_Manager**: System that controls parasite spawning and behavior
- **Game_World**: The main game environment containing all entities

## Requirements

### Requirement 1: Territory Grid System

**User Story:** As a player, I want to encounter distinct territorial zones so that I understand the game world has organized AI opponents rather than random parasite spawns.

#### Acceptance Criteria

1. THE Territory_Manager SHALL divide the game world into 16x16 chunk territories
2. WHEN calculating territory size, THE Territory_Manager SHALL use 1024x1024 units per territory
3. THE Territory_Manager SHALL ensure territories never overlap with each other
4. WHEN a player enters a territory, THE System SHALL provide visual indicators of territorial boundaries
5. THE Territory_Manager SHALL align all boundaries with the existing 64-unit chunk system

### Requirement 2: Queen Entity Management

**User Story:** As a player, I want to encounter powerful Queen entities that control territories so that I have meaningful boss-level opponents to challenge.

#### Acceptance Criteria

1. THE Queen SHALL have health between 40-100 hits (10x-20x parasite health)
2. THE Queen SHALL remain stationary and never leave its hive location
3. THE Queen SHALL control all parasites within its territory boundaries
4. WHEN the hive is not constructed above ground, THE Queen SHALL be invulnerable to damage
5. THE Queen SHALL have a distinct visual design that is large and imposing
6. WHEN the Queen dies, THE System SHALL trigger immediate territory-wide parasite explosion

### Requirement 3: Hive Structure System

**User Story:** As a player, I want to discover and assault Queen hives so that I have strategic objectives beyond just mining resources.

#### Acceptance Criteria

1. THE Hive SHALL have health between 20-30 hits separate from Queen health
2. WHEN a hive is constructed, THE System SHALL spawn 50+ parasites of both types for defense
3. THE Hive_Manager SHALL place hives randomly within territory boundaries
4. THE Hive SHALL require 10-15 seconds to emerge above ground during construction
5. THE Hive SHALL provide clear above-ground visual structure for player targeting
6. WHEN the hive is destroyed, THE System SHALL kill the Queen and liberate the territory

### Requirement 4: Queen Lifecycle Management

**User Story:** As a player, I want Queens to regenerate after death so that territories remain challenging and I have ongoing strategic objectives.

#### Acceptance Criteria

1. WHEN a Queen dies, THE System SHALL immediately explode all parasites in the territory
2. THE Territory SHALL become completely parasite-free for 3-5 minutes after Queen death
3. THE New_Queen SHALL begin growing underground in an invisible and invulnerable state
4. THE Growth_Phase SHALL last 60-120 seconds simulating neural network training
5. THE UI SHALL display Queen growth percentage in the top-right corner
6. WHEN the Queen reaches 100% growth, THE System SHALL select a random hive location
7. THE Hive_Construction SHALL make the Queen vulnerable to attack again

### Requirement 5: Territory Liberation Mechanics

**User Story:** As a player, I want territory liberation to provide significant rewards so that hive assaults feel worthwhile despite the risks.

#### Acceptance Criteria

1. THE Liberation_Period SHALL provide 3-5 minutes of guaranteed parasite-free mining
2. THE Mining_System SHALL provide 25% faster mining speed during liberation
3. THE UI SHALL display clear liberation timer countdown indicators
4. THE Queen_Kill SHALL provide significant energy rewards (50-100 energy)
5. THE Liberation_Window SHALL enable strategic expansion opportunities for players
6. THE Player SHALL be able to safely establish forward mining operations during liberation

### Requirement 6: Hive Discovery and Assault

**User Story:** As a player, I want to discover hive locations and coordinate assaults so that I have engaging tactical combat missions.

#### Acceptance Criteria

1. THE Player SHALL visually scan territories to locate hive construction
2. THE Player SHALL navigate through defensive parasite swarms to reach hives
3. THE Assault_System SHALL require coordination of multiple protectors for success
4. THE Player SHALL balance assault timing against energy costs and risks
5. THE Hive_Assault SHALL provide high-risk, high-reward gameplay mechanics
6. THE Discovery_Process SHALL create engaging exploration gameplay within territories

### Requirement 7: Visual Feedback System

**User Story:** As a player, I want clear visual feedback for all territorial mechanics so that I understand the Queen lifecycle and territory status.

#### Acceptance Criteria

1. THE UI SHALL show Queen growth progress with percentage and time remaining
2. THE Territory_Indicators SHALL clearly mark when entering or exiting territories
3. THE Hive_Construction SHALL display visual progress during the 10-15 second build time
4. THE Liberation_Timer SHALL provide countdown display with clear visual indicators
5. THE Queen_Status SHALL be communicated through distinct visual states
6. THE Parasite_Explosion SHALL provide satisfying visual feedback for Queen death

### Requirement 8: Performance and Integration

**User Story:** As a system architect, I want the territory system to integrate seamlessly with existing systems so that performance remains optimal and gameplay is smooth.

#### Acceptance Criteria

1. THE System SHALL maintain 60fps with Queen entities and hive structures active
2. THE Territory_System SHALL use less than 100MB additional memory
3. THE Queen_Lifecycle SHALL add less than 15% CPU overhead
4. THE Integration SHALL preserve all existing parasite spawning mechanics
5. THE Territory_System SHALL prepare data structures for Phase 3 neural network learning
6. THE Performance SHALL remain stable during Queen lifecycle transitions