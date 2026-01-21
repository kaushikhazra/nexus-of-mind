# Enhanced Parasite System - Design Document

## Overview

The Enhanced Parasite System introduces Combat Parasites alongside existing Energy Parasites, creating a dual-threat ecosystem that challenges both mining operations and protector units. This system maintains the territorial behavior and spawning mechanics of the current parasite system while adding tactical depth through differentiated enemy types with distinct targeting priorities.

## Architecture

### System Components

```
ParasiteManager
├── EnergyParasite (75% spawn rate)
│   ├── Targets: Workers first
│   ├── Health: 2 hits
│   └── Behavior: Energy drain, territorial
├── CombatParasite (25% spawn rate) [NEW]
│   ├── Targets: Protectors first, workers second
│   ├── Health: 4-5 hits
│   └── Behavior: Aggressive hunting, territorial
└── Spawn Distribution System [ENHANCED]
    ├── 75/25 ratio enforcement
    ├── Spawn timing logic
    └── Visual differentiation
```

### Integration Points

- **CombatSystem**: Enhanced targeting logic for Combat Parasites
- **Auto-Attack System**: Protectors automatically engage both parasite types
- **Visual System**: Distinct appearances and combat effects
- **Energy System**: Balanced rewards for increased Combat Parasite difficulty

## Components and Interfaces

### Combat Parasite Entity

```typescript
export class CombatParasite extends EnergyParasite {
    // Enhanced properties
    protected health: number = 4; // 2x stronger than Energy Parasites
    protected maxHealth: number = 4;
    protected speed: number = 2.5; // Slightly faster for hunting
    protected attackDamage: number = 2; // Can damage protectors
    
    // Targeting behavior
    protected targetPriority: TargetType[] = ['protector', 'worker'];
    protected huntingRange: number = 60; // Larger hunting range
    protected aggressionLevel: number = 0.8; // More aggressive than Energy Parasites
    
    // Visual differentiation
    protected parasiteType: ParasiteType = ParasiteType.COMBAT;
    protected visualScale: number = 1.2; // 20% larger than Energy Parasites
    protected materialVariant: string = 'combat_parasite';
}
```

### Enhanced Parasite Manager

```typescript
export interface ParasiteSpawnDistribution {
    energyParasiteRate: number; // 0.75 (75%)
    combatParasiteRate: number; // 0.25 (25%)
    distributionAccuracy: number; // Tolerance for ratio enforcement
}

export class EnhancedParasiteManager extends ParasiteManager {
    private spawnDistribution: ParasiteSpawnDistribution;
    private spawnHistory: ParasiteSpawnRecord[];
    private distributionTracker: DistributionTracker;
    
    // Enhanced spawning logic
    protected determineParasiteType(): ParasiteType {
        return this.distributionTracker.getNextParasiteType();
    }
    
    // Factory method for parasite creation
    protected createParasite(type: ParasiteType, config: ParasiteConfig): BaseParasite {
        switch (type) {
            case ParasiteType.ENERGY:
                return new EnergyParasite(config);
            case ParasiteType.COMBAT:
                return new CombatParasite(config);
            default:
                throw new Error(`Unknown parasite type: ${type}`);
        }
    }
}
```

### Distribution Tracking System

```typescript
export class DistributionTracker {
    private spawnHistory: ParasiteType[] = [];
    private targetDistribution: ParasiteSpawnDistribution;
    private windowSize: number = 20; // Track last 20 spawns
    
    public getNextParasiteType(): ParasiteType {
        const currentRatio = this.calculateCurrentRatio();
        const targetRatio = this.targetDistribution;
        
        // Enforce distribution accuracy
        if (currentRatio.combat < targetRatio.combatParasiteRate - targetRatio.distributionAccuracy) {
            return ParasiteType.COMBAT;
        } else if (currentRatio.energy < targetRatio.energyParasiteRate - targetRatio.distributionAccuracy) {
            return ParasiteType.ENERGY;
        }
        
        // Random selection within acceptable range
        return Math.random() < targetRatio.combatParasiteRate 
            ? ParasiteType.COMBAT 
            : ParasiteType.ENERGY;
    }
}
```

## Data Models

### Parasite Type Enumeration

```typescript
export enum ParasiteType {
    ENERGY = 'energy',
    COMBAT = 'combat'
}

export interface ParasiteStats {
    health: number;
    maxHealth: number;
    speed: number;
    attackDamage: number;
    energyReward: number;
    visualScale: number;
}

export const PARASITE_STATS: Record<ParasiteType, ParasiteStats> = {
    [ParasiteType.ENERGY]: {
        health: 2,
        maxHealth: 2,
        speed: 2.0,
        attackDamage: 0, // Energy drain only
        energyReward: 2,
        visualScale: 1.0
    },
    [ParasiteType.COMBAT]: {
        health: 4,
        maxHealth: 4,
        speed: 2.5,
        attackDamage: 2,
        energyReward: 4, // 2x reward for 2x difficulty
        visualScale: 1.2
    }
};
```

### Enhanced Targeting System

```typescript
export interface TargetingBehavior {
    primaryTargets: UnitType[];
    secondaryTargets: UnitType[];
    targetSwitchCooldown: number;
    maxTargetDistance: number;
    pursuitDistance: number;
}

export const TARGETING_BEHAVIORS: Record<ParasiteType, TargetingBehavior> = {
    [ParasiteType.ENERGY]: {
        primaryTargets: ['worker'],
        secondaryTargets: [],
        targetSwitchCooldown: 2000, // 2 seconds
        maxTargetDistance: 50,
        pursuitDistance: 60
    },
    [ParasiteType.COMBAT]: {
        primaryTargets: ['protector'],
        secondaryTargets: ['worker'],
        targetSwitchCooldown: 1500, // 1.5 seconds (more aggressive)
        maxTargetDistance: 60,
        pursuitDistance: 75
    }
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Spawn Distribution Accuracy
*For any* sequence of 20 consecutive parasite spawns, the ratio of Combat Parasites should be within 10% of the target 25% distribution (i.e., between 15% and 35%).
**Validates: Requirements 2.1, 2.2**

### Property 2: Combat Parasite Targeting Priority
*For any* Combat Parasite that detects both protectors and workers simultaneously, the parasite should target the protector first.
**Validates: Requirements 3.1, 3.2**

### Property 3: Health Differential Consistency
*For any* Combat Parasite, it should require exactly 2x the number of protector attacks to destroy compared to an Energy Parasite.
**Validates: Requirements 1.1, 4.1**

### Property 4: Visual Differentiation Requirement
*For any* spawned parasite, players should be able to distinguish between Energy and Combat Parasites within 2 seconds of visual contact.
**Validates: Requirements 5.1, 5.2**

### Property 5: Energy Reward Proportionality
*For any* destroyed Combat Parasite, the energy reward should be proportional to its increased difficulty (2x health = 2x reward).
**Validates: Requirements 1.4, 4.3**

### Property 6: Targeting Fallback Behavior
*For any* Combat Parasite that loses its protector target, it should switch to targeting workers as secondary targets within 3 seconds.
**Validates: Requirements 3.2, 3.3**

### Property 7: Spawn Timing Preservation
*For any* mineral deposit, the introduction of Combat Parasites should not alter the existing spawn timing intervals.
**Validates: Requirements 2.3, 6.2**

### Property 8: Performance Maintenance
*For any* combat scenario involving mixed parasite types, the system should maintain 60fps performance with up to 10 parasites active simultaneously.
**Validates: Requirements 4.5, 6.5**

### Property 9: Auto-Attack Integration
*For any* protector using the auto-attack system, it should seamlessly engage both Energy and Combat Parasites without requiring different player commands.
**Validates: Requirements 6.3, 6.4**

### Property 10: Territory Behavior Consistency
*For any* Combat Parasite, it should maintain the same territorial behavior patterns as Energy Parasites (15-unit patrol radius, return to territory when targets leave).
**Validates: Requirements 3.5, 6.1**

## Error Handling

### Spawn Distribution Errors
- **Distribution Drift**: If spawn ratio deviates beyond acceptable range, force correction in next spawn
- **Type Creation Failure**: Fallback to Energy Parasite if Combat Parasite creation fails
- **Resource Exhaustion**: Limit total parasite count to prevent performance degradation

### Combat Integration Errors
- **Invalid Target**: Combat Parasites gracefully handle invalid or destroyed targets
- **Targeting Conflicts**: Resolve multiple parasites targeting same unit through distance priority
- **State Synchronization**: Ensure parasite state remains consistent during combat transitions

### Visual System Errors
- **Material Loading Failure**: Fallback to default materials with color differentiation
- **Mesh Creation Errors**: Use simplified geometry if complex models fail to load
- **Performance Degradation**: Reduce visual effects quality if frame rate drops below 50fps

## Testing Strategy

### Unit Testing
- **Spawn Distribution Logic**: Test distribution tracker with various spawn sequences
- **Targeting Behavior**: Verify Combat Parasite target selection under different scenarios
- **Health and Damage**: Confirm Combat Parasite durability and reward calculations
- **Visual Differentiation**: Test material and mesh assignment for both parasite types

### Property-Based Testing
- **Distribution Accuracy**: Generate random spawn sequences and verify 75/25 ratio maintenance
- **Targeting Priority**: Test Combat Parasite behavior with randomized unit configurations
- **Performance Characteristics**: Validate frame rate maintenance with varying parasite counts
- **Integration Compatibility**: Test seamless operation with existing auto-attack system

### Integration Testing
- **End-to-End Combat**: Full combat scenarios with mixed parasite types
- **Spawn System Integration**: Verify enhanced spawning works with existing mineral deposit system
- **Visual Feedback**: Confirm players can distinguish parasite types during active gameplay
- **Performance Under Load**: Test system stability with maximum parasite counts

### Performance Testing
- **Frame Rate Monitoring**: Continuous FPS measurement during mixed combat scenarios
- **Memory Usage**: Track memory consumption with enhanced parasite system
- **Spawn Rate Impact**: Measure performance impact of distribution tracking algorithms
- **Visual Effect Overhead**: Assess rendering cost of differentiated parasite appearances

Each property-based test should run a minimum of 100 iterations to ensure comprehensive coverage of the randomized input space, with test tags following the format: **Feature: enhanced-parasite-system, Property {number}: {property_text}**.