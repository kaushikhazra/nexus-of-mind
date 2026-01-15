# Combat Balance Tuning - Requirements Document

## Introduction

This specification rebalances combat stats to create asymmetric gameplay between native parasites and human colonizers. The balance reflects the game's lore: parasites are tough native creatures adapted to the planet, while humans rely on superior technology to compensate for their fragility.

## Glossary

- **TTK (Time to Kill)**: Duration required to eliminate a target
- **DPS (Damage Per Second)**: Sustained damage output over time
- **Effective HP**: Health + Shield combined
- **Swarm Threshold**: Number of parasites needed to overcome a protector
- **Attrition**: Gradual wearing down through sustained combat

## Requirements

### Requirement 1: Asymmetric Faction Balance

**User Story:** As a player, I want humans and parasites to have distinct strengths and weaknesses, so that gameplay requires different strategies for each faction.

#### Acceptance Criteria

1. WHEN comparing factions, THE parasites SHALL have higher base health than equivalent human units
2. WHEN comparing factions, THE human units SHALL have higher damage output than parasites
3. WHEN comparing factions, THE human units SHALL have longer attack range than parasites
4. WHEN comparing factions, THE parasites SHALL have health regeneration while humans rely on shields
5. THE balance SHALL require 4+ parasites to reliably defeat 1 protector

### Requirement 2: Human Unit Stats (Colonizers - Technology)

**User Story:** As a human player, I want my units to be technologically superior but physically fragile, so that I must use tactics and positioning to survive.

#### Acceptance Criteria

1. WHEN a Worker is created, THE System SHALL set health to 60 (reduced from 80)
2. WHEN a Scout is created, THE System SHALL set health to 40 (reduced from 60)
3. WHEN a Protector is created, THE System SHALL set health to 80, shield to 60 (140 effective HP)
4. WHEN a Protector attacks, THE System SHALL deal 35 damage (increased from 25)
5. WHEN a Protector detects enemies, THE System SHALL use 12 unit range (increased from 10)
6. WHEN a Protector attacks, THE System SHALL use 1.5 second cooldown (reduced from 2.0)

### Requirement 3: Parasite Stats (Native - Toughness)

**User Story:** As the AI, I want parasites to be naturally tough but individually weak, so that swarm tactics are required to overcome human technology.

#### Acceptance Criteria

1. WHEN an Energy Parasite spawns, THE System SHALL set health to 60 (increased from 2)
2. WHEN an Energy Parasite drains, THE System SHALL drain 2.0 energy/sec (reduced from 3.0)
3. WHEN a Combat Parasite spawns, THE System SHALL set health to 100 (increased from 4)
4. WHEN a Combat Parasite attacks, THE System SHALL deal 5 damage with 0.8 sec cooldown
5. WHEN a Parasite is idle, THE System SHALL regenerate 1 HP/sec
6. WHEN parasites move, THE System SHALL use speed 5.0 (Energy) and 6.0 (Combat)

### Requirement 4: Queen Stats (Apex Native)

**User Story:** As a player, I want the Queen to be a significant threat requiring multiple protectors to defeat, so that destroying the Queen feels like a major victory.

#### Acceptance Criteria

1. WHEN a Queen spawns, THE System SHALL set health to 200 (increased from 40-100)
2. WHEN a Queen is idle, THE System SHALL regenerate 2 HP/sec
3. WHEN a Queen moves, THE System SHALL use speed 4.0
4. THE Queen SHALL remain vulnerable only during ACTIVE_CONTROL phase

### Requirement 5: Combat Math Validation

**User Story:** As a designer, I want combat outcomes to be predictable and balanced, so that both factions have viable strategies.

#### Acceptance Criteria

1. WHEN 1 Protector fights 1 Combat Parasite, THE Protector SHALL win
2. WHEN 1 Protector fights 3 Combat Parasites, THE fight SHALL be close
3. WHEN 1 Protector fights 4+ Combat Parasites, THE Parasites SHALL win
4. WHEN calculating Protector DPS, THE System SHALL produce ~23 DPS (35 dmg / 1.5 sec)
5. WHEN calculating Combat Parasite DPS, THE System SHALL produce ~6.25 DPS (5 dmg / 0.8 sec)

### Requirement 6: AI Learning Opportunity

**User Story:** As the Queen AI, I want combat balance to reward tactical decisions, so that learning spawn count and location produces better outcomes.

#### Acceptance Criteria

1. THE balance SHALL make spawn count a meaningful decision (too few = loss, too many = waste)
2. THE balance SHALL make spawn location meaningful (near workers vs near protectors)
3. THE balance SHALL allow parasite attrition tactics via regeneration
4. THE balance SHALL reward swarm concentration over spread attacks
