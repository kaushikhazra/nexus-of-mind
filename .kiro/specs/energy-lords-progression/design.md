# Energy Lords Progression System - Design Document

## Overview

This design implements a roguelike progression system with 60 levels organized into 12 tiers. Players earn titles by sustaining energy production above thresholds for specified durations. The system uses exponential scaling for energy targets and provides permanent upgrades between runs.

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GameEngine                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  EnergyLordsManager                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │   │
│  │  │ TierConfig   │  │ ThresholdMon │  │ ProgressStorage  │  │   │
│  │  │              │  │              │  │                  │  │   │
│  │  │ - tiers[]    │  │ - checkEnergy│  │ - save()         │  │   │
│  │  │ - levels[]   │  │ - resetTimer │  │ - load()         │  │   │
│  │  │ - titles[]   │  │ - onVictory  │  │ - currentLevel   │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     EnergyManager                            │   │
│  │                  (existing component)                        │   │
│  │              getTotalEnergy(): number                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
EnergyManager.getTotalEnergy()
        │
        ▼ (every 500ms)
┌──────────────────────┐
│  ThresholdMonitor    │
│  energy >= threshold?│
├──────────────────────┤
│  YES: increment time │
│  NO: reset time to 0 │
└──────────────────────┘
        │
        ▼ (when sustainedTime >= requiredTime)
┌──────────────────────┐
│  Victory Handler     │
│  - Award title       │
│  - Apply upgrade     │
│  - Save progress     │
│  - Reload game       │
└──────────────────────┘
```

## Component Details

### 1. TierConfig

Stores static configuration for all 12 tiers.

```typescript
interface TierDefinition {
    id: number;           // 0-11
    name: string;         // "Spark", "Ember", etc.
    startLevel: number;   // First level in tier
    endLevel: number;     // Last level in tier
    sustainTime: number;  // Seconds required for all levels in tier
}

const TIER_CONFIGS: TierDefinition[] = [
    { id: 0, name: "Spark", startLevel: 1, endLevel: 5, sustainTime: 60 },
    { id: 1, name: "Ember", startLevel: 6, endLevel: 10, sustainTime: 120 },
    { id: 2, name: "Flame", startLevel: 11, endLevel: 15, sustainTime: 180 },
    { id: 3, name: "Blaze", startLevel: 16, endLevel: 20, sustainTime: 240 },
    { id: 4, name: "Inferno", startLevel: 21, endLevel: 25, sustainTime: 300 },
    { id: 5, name: "Nova", startLevel: 26, endLevel: 30, sustainTime: 420 },
    { id: 6, name: "Pulsar", startLevel: 31, endLevel: 35, sustainTime: 540 },
    { id: 7, name: "Quasar", startLevel: 36, endLevel: 40, sustainTime: 660 },
    { id: 8, name: "Nebula", startLevel: 41, endLevel: 45, sustainTime: 780 },
    { id: 9, name: "Star", startLevel: 46, endLevel: 50, sustainTime: 840 },
    { id: 10, name: "Supernova", startLevel: 51, endLevel: 55, sustainTime: 900 },
    { id: 11, name: "Nexus", startLevel: 56, endLevel: 60, sustainTime: 900 }
];
```

### 2. LevelConfig

Stores configuration for all 60 levels, generated from tier configs.

```typescript
interface LevelDefinition {
    level: number;           // 1-60
    energyThreshold: number; // in Joules: 1000 × 1.08^(level-1)
    sustainTime: number;     // in seconds (from tier)
    title: string;           // "Spark I", "Ember III", etc.
    upgradeBonus: number;    // 1% regular, 3.5% tier completion
    tierIndex: number;       // 0-11
    rankInTier: number;      // 1-5
    isTierCompletion: boolean; // true for levels 5, 10, 15...
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

// Generated programmatically
function generateLevelConfigs(): LevelDefinition[] {
    const levels: LevelDefinition[] = [
        { level: 0, energyThreshold: 0, sustainTime: 0, title: "Initiate",
          upgradeBonus: 0, tierIndex: -1, rankInTier: 0, isTierCompletion: false }
    ];

    for (let level = 1; level <= 60; level++) {
        const tierIndex = Math.floor((level - 1) / 5);
        const tier = TIER_CONFIGS[tierIndex];
        const rankInTier = ((level - 1) % 5) + 1;
        const isTierCompletion = level % 5 === 0;

        levels.push({
            level,
            energyThreshold: Math.round(1000 * Math.pow(1.08, level - 1)),
            sustainTime: tier.sustainTime,
            title: `${tier.name} ${ROMAN_NUMERALS[rankInTier - 1]}`,
            upgradeBonus: isTierCompletion ? 3.5 : 1,
            tierIndex,
            rankInTier,
            isTierCompletion
        });
    }

    return levels;
}
```

### 3. Energy Threshold Reference Table

| Level | Tier | Title | Energy (J) | Time |
|-------|------|-------|------------|------|
| 1 | Spark | Spark I | 1,000 | 1 min |
| 2 | Spark | Spark II | 1,080 | 1 min |
| 3 | Spark | Spark III | 1,166 | 1 min |
| 4 | Spark | Spark IV | 1,260 | 1 min |
| 5 | Spark | Spark V | 1,360 | 1 min |
| 10 | Ember | Ember V | 1,999 | 2 min |
| 15 | Flame | Flame V | 2,937 | 3 min |
| 20 | Blaze | Blaze V | 4,316 | 4 min |
| 25 | Inferno | Inferno V | 6,341 | 5 min |
| 30 | Nova | Nova V | 9,317 | 7 min |
| 35 | Pulsar | Pulsar V | 13,690 | 9 min |
| 40 | Quasar | Quasar V | 20,115 | 11 min |
| 45 | Nebula | Nebula V | 29,560 | 13 min |
| 50 | Star | Star V | 43,427 | 14 min |
| 55 | Supernova | Supernova V | 63,800 | 15 min |
| 60 | Nexus | Nexus V | 93,749 | 15 min |

### 4. ThresholdMonitor

Monitors energy levels at 500ms intervals. (Unchanged from original)

```typescript
class ThresholdMonitor {
    private checkInterval: number = 500; // ms
    private sustainedTime: number = 0;
    private lastCheckTime: number = 0;

    public update(currentTime: number, currentEnergy: number, threshold: number): void {
        if (currentTime - this.lastCheckTime < this.checkInterval) {
            return;
        }

        this.lastCheckTime = currentTime;

        if (currentEnergy >= threshold) {
            this.sustainedTime += this.checkInterval;
        } else {
            this.sustainedTime = 0; // Reset on drop
        }
    }

    public getSustainedTime(): number {
        return this.sustainedTime;
    }

    public reset(): void {
        this.sustainedTime = 0;
    }
}
```

### 5. ProgressStorage (Backend SQLite)

Handles persistence via Python backend with SQLite database. (Unchanged from original)

#### Backend Database Schema

```sql
-- File: server/database/energy_lords.db

CREATE TABLE IF NOT EXISTS player_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT UNIQUE NOT NULL DEFAULT 'default',
    current_level INTEGER NOT NULL DEFAULT 0,
    highest_title TEXT NOT NULL DEFAULT 'Initiate',
    total_upgrade_bonus REAL NOT NULL DEFAULT 0,
    completed_levels TEXT NOT NULL DEFAULT '[]',  -- JSON array
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Backend API Endpoints

```python
# File: server/routes/progress_routes.py

# GET /api/progress - Load player progress
# POST /api/progress - Save player progress
# DELETE /api/progress - Reset player progress
# GET /api/progress/reset - Reset database (for testing)
```

### 6. Upgrade Bonus Calculation

```typescript
// Regular level (non-tier completion): 1% bonus
// Tier completion (levels 5, 10, 15...): 3.5% bonus

// Total possible bonus at level 60:
// - 48 regular levels × 1% = 48%
// - 12 tier completions × 3.5% = 42%
// - Total: 90%

function calculateUpgradeBonus(level: number): number {
    const levelConfig = getLevelConfig(level);
    return levelConfig?.upgradeBonus || 0;
}

function isTierCompletion(level: number): boolean {
    return level > 0 && level % 5 === 0;
}
```

### 7. Helper Functions

```typescript
function getTierForLevel(level: number): TierDefinition | undefined {
    if (level <= 0) return undefined;
    const tierIndex = Math.floor((level - 1) / 5);
    return TIER_CONFIGS[tierIndex];
}

function getRankInTier(level: number): number {
    if (level <= 0) return 0;
    return ((level - 1) % 5) + 1;
}

function formatTitle(level: number): string {
    if (level <= 0) return "Initiate";
    const tier = getTierForLevel(level);
    const rank = getRankInTier(level);
    return `${tier?.name} ${ROMAN_NUMERALS[rank - 1]}`;
}
```

## UI Components

### Progress Display (HUD)

```
┌────────────────────────────────────────┐
│  ENERGY LORD: Ember III                │
│  ────────────────────────────────────  │
│  Tier: Ember (6-10) ████░░░░░░ 3/5     │
│  Target: 1,260 J for 2:00              │
│  Current: 1,145 J                      │
│  Progress: [████████░░] 75%            │
│  Sustained: 1:30 / 2:00                │
└────────────────────────────────────────┘
```

### Victory Screen - Regular Level

```
┌────────────────────────────────────────┐
│                                        │
│         ★ LEVEL COMPLETE ★             │
│                                        │
│       You are now                      │
│       [SPARK III]                      │
│                                        │
│    Power Generator: +1%                │
│    Total Bonus: +3%                    │
│                                        │
│    [Continue to Next Challenge]        │
│                                        │
└────────────────────────────────────────┘
```

### Victory Screen - Tier Completion

```
┌────────────────────────────────────────┐
│                                        │
│    ✦✦✦ NEW TIER UNLOCKED! ✦✦✦          │
│                                        │
│         ★ SPARK MASTERED ★             │
│                                        │
│       You are now                      │
│       [EMBER I]                        │
│                                        │
│    Power Generator: +3.5%              │
│    Total Bonus: +8%                    │
│                                        │
│    [Continue to Next Challenge]        │
│                                        │
└────────────────────────────────────────┘
```

## Integration Points

### EnergyManager Integration

The system reads from the existing EnergyManager:
- `getTotalEnergy()` - Current total energy across all sources
- `getEnergyStats().totalGeneration` - Check if player has produced energy
- No modifications needed to EnergyManager

### Power Generator Integration

On victory, the upgrade bonus applies to:
- Base energy generation rate in power generators via BuildingManager
- `buildingManager.setEnergyGenerationBonus(totalBonus)`
- Cumulative bonuses stack additively

### Game Session Flow

1. Game Start → Load saved progress → Apply upgrades to BuildingManager
2. During Game → Monitor energy thresholds at 500ms intervals
3. Victory → Save progress → Show victory screen → Reload page
4. After Reload → Higher level target → Same terrain → Upgraded equipment

## Error Handling

- **Backend unavailable**: Fall back to session-only progress, retry on reconnect
- **API request fails**: Show error notification, allow retry
- **Corrupted save data**: Reset to default progress
- **Energy NaN/undefined**: Treat as 0, log warning

## Performance Considerations

- Check interval of 500ms prevents excessive computation
- No memory leaks from interval timers (use deltaTime-based checking)
- Minimal UI updates (only when progress changes)
- Level configs generated once at startup, not per-frame
