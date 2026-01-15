# Energy Lords Progression System - Requirements Document

## Introduction

This specification implements a progression system where players are "Energy Lords" generating energy for the empire. Players must sustain energy production above thresholds for specified durations to advance through 60 levels organized into 12 tiers. The system uses exponential scaling for energy thresholds and provides permanent upgrades between runs.

## Glossary

- **Energy Lord**: The player's role as an energy generator for the empire
- **Threshold**: Minimum energy level that must be maintained
- **Sustain Time**: Duration the threshold must be maintained without dropping
- **Tier**: A group of 5 levels with a shared title theme (e.g., Spark, Ember, Flame)
- **Rank**: Position within a tier (I through V)
- **Title**: Player rank displayed as "Tier Rank" (e.g., "Ember III")
- **Tier Completion**: Reaching rank V of any tier (levels 5, 10, 15, etc.)
- **Power Generator**: Equipment that produces base energy, upgrades between runs
- **Run**: A single game session from start to victory/defeat

## Requirements

### Requirement 1: 60-Level Tiered Progression

**User Story:** As a player, I want a deep progression system with many levels, so that I have long-term goals to work toward.

#### Acceptance Criteria

1. THE System SHALL have 60 total levels (1-60)
2. THE System SHALL organize levels into 12 tiers of 5 ranks each
3. WHEN player starts, THE System SHALL begin at Level 0 (Initiate)
4. THE energy threshold SHALL follow exponential scaling: `1000 × 1.08^(level-1)` Joules
5. THE sustain time SHALL be fixed per tier (see Requirement 1.1)
6. THE System SHALL cap sustain time at 15 minutes maximum

#### Tier Structure

| Tier | Levels | Title | Sustain Time |
|------|--------|-------|--------------|
| Spark | 1-5 | Spark I-V | 1 min |
| Ember | 6-10 | Ember I-V | 2 min |
| Flame | 11-15 | Flame I-V | 3 min |
| Blaze | 16-20 | Blaze I-V | 4 min |
| Inferno | 21-25 | Inferno I-V | 5 min |
| Nova | 26-30 | Nova I-V | 7 min |
| Pulsar | 31-35 | Pulsar I-V | 9 min |
| Quasar | 36-40 | Quasar I-V | 11 min |
| Nebula | 41-45 | Nebula I-V | 13 min |
| Star | 46-50 | Star I-V | 14 min |
| Supernova | 51-55 | Supernova I-V | 15 min |
| Nexus | 56-60 | Nexus I-V | 15 min |

### Requirement 2: Energy Threshold Monitoring

**User Story:** As a player, I want the game to track my energy production fairly, so that I know exactly when I'm meeting the challenge.

#### Acceptance Criteria

1. THE System SHALL check energy levels every 500 milliseconds
2. WHEN energy is at or above threshold, THE System SHALL increment sustained time
3. WHEN energy drops below threshold, THE System SHALL reset sustained time to zero
4. THE System SHALL display current progress toward the goal
5. THE threshold check SHALL use current total energy from EnergyManager
6. THE System SHALL only start counting AFTER player has produced energy (totalGeneration > 0)

### Requirement 3: Victory Condition

**User Story:** As a player, I want to be rewarded when I achieve a level, so that I feel accomplished.

#### Acceptance Criteria

1. WHEN sustained time reaches required duration, THE System SHALL trigger victory
2. WHEN victory triggers, THE System SHALL display victory screen with new title
3. WHEN victory triggers, THE System SHALL upgrade power generator permanently
4. WHEN victory triggers, THE System SHALL save progress to persistent storage
5. THE victory screen SHALL show player's new title and achievement
6. WHEN victory triggers, THE System SHALL reload the game with upgraded equipment

### Requirement 4: Tiered Title System

**User Story:** As a player, I want to earn prestigious titles organized in tiers, so that I can see my progression through the ranks.

#### Acceptance Criteria

1. WHEN player starts at Level 0, THE System SHALL assign title "Initiate"
2. WHEN player completes a level, THE System SHALL assign title "[Tier] [Rank]"
3. THE rank SHALL be displayed as Roman numerals (I, II, III, IV, V)
4. WHEN player completes a tier (every 5th level), THE System SHALL show enhanced celebration
5. THE System SHALL track highest achieved title for display

### Requirement 5: Power Generator Upgrades

**User Story:** As a player, I want my equipment to improve after each victory, so that higher levels become achievable.

#### Acceptance Criteria

1. WHEN player completes a regular level, THE System SHALL grant 1% upgrade bonus
2. WHEN player completes a tier (levels 5, 10, 15...), THE System SHALL grant 3.5% upgrade bonus
3. THE upgrade bonus SHALL be cumulative across levels (max 90% at level 60)
4. WHEN new game starts, THE System SHALL apply all earned upgrades to power generators
5. THE System SHALL persist upgrade state between game sessions

### Requirement 6: Game Session Flow

**User Story:** As a player, I want a clear flow from start to victory, so that I understand the game loop.

#### Acceptance Criteria

1. WHEN game starts, THE System SHALL load player's current level and upgrades
2. WHEN game starts, THE System SHALL display current target and progress
3. WHEN victory occurs, THE System SHALL end the current game session
4. WHEN player continues after victory, THE System SHALL reload with upgraded equipment
5. THE System SHALL allow continuous play attempts without penalty for failure

### Requirement 7: Tier Completion Celebration

**User Story:** As a player, I want reaching a new tier to feel special, so that major milestones are memorable.

#### Acceptance Criteria

1. WHEN player completes a tier, THE System SHALL show "NEW TIER UNLOCKED!" message
2. WHEN player completes a tier, THE System SHALL display enhanced visual effects
3. WHEN player completes a tier, THE System SHALL grant bonus upgrade (3.5% vs 1%)
4. THE victory screen SHALL distinguish tier completion from regular level completion

### Requirement 8: Progress Persistence

**User Story:** As a player, I want my progress saved, so that I can continue from where I left off.

#### Acceptance Criteria

1. THE System SHALL save current level to SQLite database via backend API
2. THE System SHALL save power generator upgrade level to SQLite database
3. THE System SHALL save highest achieved title to SQLite database
4. WHEN game loads, THE System SHALL restore saved progress from backend
5. THE progress data SHALL persist across browser sessions via server-side storage
6. THE System SHALL provide API endpoint to reset progress for testing
