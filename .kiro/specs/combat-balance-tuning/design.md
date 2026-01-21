# Combat Balance Tuning - Design Document

## Overview

This design rebalances combat to create asymmetric gameplay reflecting the game's lore: parasites are tough native creatures while humans are fragile colonizers with superior technology. The balance creates a meaningful learning problem for the Queen AI while giving human players tactical options.

## Architecture

### Faction Design Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│                    ASYMMETRIC BALANCE                           │
├─────────────────────────────┬───────────────────────────────────┤
│    PARASITES (Native)       │      HUMANS (Colonizers)          │
├─────────────────────────────┼───────────────────────────────────┤
│ ✓ High Health (tough)       │ ✗ Low Health (fragile)            │
│ ✗ Low Damage (natural)      │ ✓ High Damage (weapons)           │
│ ✗ Melee Range (close)       │ ✓ Long Range (technology)         │
│ ✓ Health Regen (biology)    │ ✓ Shields (technology)            │
│ ✓ Many Units (swarm)        │ ✗ Few Units (energy cost)         │
│ ✓ Fast Speed (adapted)      │ ✗ Slower Speed (equipment)        │
└─────────────────────────────┴───────────────────────────────────┘
```

### Combat Flow

```
Detection Phase:
├── Protector range: 12 units (shoots first)
└── Parasite range: 3 units (must close distance)

Engagement Phase:
├── Protector: High burst damage (35 per hit)
└── Parasites: Sustained chip damage (5 per hit, fast)

Resolution:
├── 1v1: Protector wins (tech advantage)
├── 3v1: Close fight (swarm building)
└── 4v1+: Parasites win (swarm overwhelms)
```

## Stat Changes

### Human Units

#### Worker
| Stat | Current | New | Rationale |
|------|---------|-----|-----------|
| Health | 80 | 60 | Fragile colonizer, not a fighter |
| Speed | 4.0 | 4.0 | Unchanged |
| Energy Capacity | 50 | 50 | Unchanged |

#### Scout
| Stat | Current | New | Rationale |
|------|---------|-----|-----------|
| Health | 60 | 40 | Lightest unit, relies on speed |
| Speed | 7.0 | 7.0 | Unchanged |
| Energy Capacity | 40 | 40 | Unchanged |

#### Protector
| Stat | Current | New | Rationale |
|------|---------|-----|-----------|
| Health | 120 | 80 | Lower base - colonizers are fragile |
| Shield | 50 | 0 | Removed for simpler combat |
| Health Regen | 0 | 0.05 HP/sec | Very slow tech-based recovery |
| Effective HP | 170 | 140 | Slightly lower total |
| Damage | 25 | 35 | Superior weapons technology |
| Attack Cooldown | 2.0 sec | 1.5 sec | Faster firing weapons |
| Attack Range | 8.0 | 12.0 | Long range weaponry |
| Detection Range | 10.0 | 12.0 | Match attack range |
| DPS | 12.5 | 23.3 | Significant increase |

### Parasites

#### Energy Parasite
| Stat | Current | New | Rationale |
|------|---------|-----|-----------|
| Health | 2 | 60 | Native toughness |
| Drain Rate | 3.0/sec | 2.0/sec | Balanced for longer fights |
| Speed | 2.0 | 4.0 | Slower for recognizable combat |
| Regen | 0 | 1.0/sec | Natural healing |
| Segments | 4 | 4 | Unchanged |
| Color | Yellow | Yellow | Unchanged |

#### Combat Parasite
| Stat | Current | New | Rationale |
|------|---------|-----|-----------|
| Health | 4 | 100 | Tougher combat variant |
| Damage | 2 | 5 | Natural attack |
| Attack Cooldown | N/A | 0.8 sec | Fast strikes |
| Speed | 2.5 | 5.0 | Hunter speed (slower for recognizable combat) |
| Regen | 0 | 1.0/sec | Natural healing |
| DPS | N/A | 6.25 | Sustained damage |
| Segments | 6 | 6 | Unchanged |
| Color | Red | Red | Unchanged |

#### Queen
| Stat | Current | New | Rationale |
|------|---------|-----|-----------|
| Health | 40-100 | 200 | Apex predator |
| Speed | 5.0 | 3.5 | Slowest - large apex predator |
| Regen | 0 | 2.0/sec | Superior biology |
| Segments | 12 | 12 | Unchanged |
| Color | Purple | Purple | Unchanged |

## Combat Math

### DPS Calculations

```
Protector DPS:
├── Damage: 35
├── Cooldown: 1.5 sec
└── DPS: 35 ÷ 1.5 = 23.3

Combat Parasite DPS:
├── Damage: 5
├── Cooldown: 0.8 sec
└── DPS: 5 ÷ 0.8 = 6.25
```

### Time to Kill (TTK)

```
Protector vs Combat Parasite:
├── Parasite HP: 100
├── Protector DPS: 23.3
├── TTK: 100 ÷ 23.3 = 4.3 seconds
└── Hits to kill: 3 (35 × 3 = 105 > 100)

Combat Parasite vs Protector:
├── Protector Effective HP: 140 (80 + 60 shield)
├── Parasite DPS: 6.25
├── TTK: 140 ÷ 6.25 = 22.4 seconds
└── Hits to kill: 28 (5 × 28 = 140)
```

### Swarm Threshold Analysis

```
1 Protector vs N Combat Parasites:

N=1: Protector wins in 4.3 sec, takes 27 damage
N=2: Protector wins in 4.3 sec, takes 54 damage
N=3: Protector wins in ~8 sec, takes 100 damage (close!)
N=4: Parasites win - combined 25 DPS kills in 5.6 sec
     Protector kills ~1 parasite before dying
N=5: Parasites win decisively
```

### Regeneration Impact

```
Attrition Scenario (hit and run):
├── Parasite takes 35 damage, retreats
├── Regen: 1 HP/sec
├── Full heal (from 65 HP): 35 seconds
└── Can return for another engagement

Protector has no HP regen:
├── Shield regens when not in combat
├── HP damage is permanent until healed
└── Sustained fights favor parasites
```

## Implementation Details

### File Modifications

| File | Changes |
|------|---------|
| `Worker.ts` | Change maxHealth: 80 → 60 |
| `Scout.ts` | Change maxHealth: 60 → 40 |
| `Protector.ts` | Health: 120→80, Shield: 50→60, Damage: 25→35, Cooldown: 2.0→1.5, Range: 8→12 |
| `EnergyParasite.ts` | Health: 2→60, Drain: 3→2, Speed: 2→5, Add regen: 1/sec |
| `CombatParasite.ts` | Health: 4→100, Damage: 2→5, Cooldown: add 0.8, Speed: 2.5→6, Add regen: 1/sec |
| `Queen.ts` | Health: 40-100→200, Speed: 5→4, Add regen: 2/sec |
| `ParasiteTypes.ts` | Update config constants |

### Regeneration Implementation

```typescript
// Add to Parasite base class
protected regenRate: number = 1.0; // HP per second

protected updateRegeneration(deltaTime: number): void {
    if (this.health < this.maxHealth) {
        this.health = Math.min(
            this.maxHealth,
            this.health + this.regenRate * deltaTime
        );
    }
}
```

### Attack Cooldown for Combat Parasite

```typescript
// Add to CombatParasite
private attackCooldown: number = 0.8;
private lastAttackTime: number = 0;

public canAttack(): boolean {
    return (performance.now() - this.lastAttackTime) >= this.attackCooldown * 1000;
}
```

## Correctness Properties

### Property 1: Asymmetric Health
*For any* parasite type, base health SHALL be greater than the equivalent role human unit.
**Validates: Requirement 1.1**

### Property 2: Asymmetric Damage
*For any* combat unit, human damage per hit SHALL be greater than parasite damage per hit.
**Validates: Requirement 1.2**

### Property 3: Swarm Threshold
*For any* combat scenario with 4+ Combat Parasites vs 1 Protector, parasites SHALL win.
**Validates: Requirement 1.5, 5.3**

### Property 4: Solo Advantage
*For any* 1v1 combat between Protector and Combat Parasite, Protector SHALL win.
**Validates: Requirement 5.1**

### Property 5: Regeneration Active
*For any* parasite below max health and not in combat, health SHALL increase over time.
**Validates: Requirement 3.5**

### Property 6: DPS Targets
*For any* Protector, DPS SHALL be within 22-24 range. *For any* Combat Parasite, DPS SHALL be within 6-7 range.
**Validates: Requirement 5.4, 5.5**

## Testing Strategy

### Unit Tests
- Verify each entity spawns with correct stats
- Verify damage calculations match expected values
- Verify regeneration increases health over time
- Verify attack cooldowns are enforced

### Combat Simulation Tests
- 1v1 Protector vs Combat Parasite → Protector wins
- 1v3 Protector vs Combat Parasites → Close fight
- 1v4 Protector vs Combat Parasites → Parasites win
- Verify TTK matches calculated values (±10%)

### Integration Tests
- Full combat engagement with spatial index
- Regeneration during patrol state
- Shield depletion before health damage
