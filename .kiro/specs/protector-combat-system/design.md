# Design Document

## Overview

The Protector Combat System extends the existing unit framework to provide automatic combat capabilities with movement-based commands. Building on the current Energy Parasite environmental combat foundation, this system enables intuitive player control through click-to-move commands with automatic enemy detection and engagement, reducing micromanagement while maintaining strategic depth.

## Architecture

### Component Integration
The combat system integrates with existing game components:
- **UnitManager**: Manages Protector unit lifecycle and selection
- **EnergyManager**: Handles combat energy costs and rewards
- **GameEngine**: Coordinates combat actions within the main game loop
- **ParasiteManager**: Provides target entities for combat interactions
- **SceneManager**: Renders combat visual effects and feedback

### Combat Flow Architecture
```
Player Click → Movement Command → Enemy Detection (10 units) → Auto-Engagement → Range Validation → Attack Execution → Damage Resolution → Visual Feedback → Energy Transaction → Resume Movement
```

## Components and Interfaces

### CombatSystem Class
**Purpose**: Central coordinator for movement-based combat with automatic enemy detection

**Key Methods**:
- `initiateAutoAttack(protector: Protector, detectedTarget: CombatTarget): boolean`
- `detectNearbyEnemies(protector: Protector, detectionRange: number): CombatTarget[]`
- `validateTarget(target: Entity): TargetValidation`
- `calculateDamage(attacker: Protector, target: CombatTarget): number`
- `executeAttack(protector: Protector, target: CombatTarget): AttackResult`
- `handleTargetDestruction(target: CombatTarget): void`
- `resumeMovementAfterCombat(protector: Protector): void`

**Properties**:
- `activeCombats: Map<string, CombatAction>`
- `detectionRange: number = 10` // Units - auto-detection range
- `combatRange: number = 8` // Units - attack range
- `attackEnergyCost: number = 5`

### CombatAction Class
**Purpose**: Represents an ongoing combat action with movement integration

**Properties**:
- `protectorId: string`
- `targetId: string`
- `state: 'moving' | 'detecting' | 'engaging' | 'attacking' | 'resuming_movement' | 'completed'`
- `startTime: number`
- `lastAttackTime: number`
- `originalDestination: Vector3` // Where protector was originally moving
- `detectionTriggered: boolean`

### Enhanced Protector Class
**Purpose**: Extends existing Protector unit with automatic combat and movement integration

**New Methods**:
- `moveToLocation(destination: Vector3): void`
- `detectNearbyEnemies(): CombatTarget[]`
- `autoEngageTarget(target: CombatTarget): void`
- `isInDetectionRange(target: CombatTarget): boolean`
- `isInCombatRange(target: CombatTarget): boolean`
- `prioritizeTargets(targets: CombatTarget[]): CombatTarget`
- `resumeOriginalMovement(): void`

**New Properties**:
- `detectionRange: number = 10` // Auto-detection range
- `combatRange: number = 8` // Attack range
- `attackDamage: number = 1`
- `attackCooldown: number = 1000` // milliseconds
- `currentTarget: CombatTarget | null`
- `originalDestination: Vector3 | null`
- `combatState: 'moving' | 'detecting' | 'engaging' | 'attacking'`
- `autoAttackEnabled: boolean = true`

### CombatTarget Interface
**Purpose**: Unified interface for all attackable entities

```typescript
interface CombatTarget {
    id: string;
    position: Vector3;
    health: number;
    maxHealth: number;
    takeDamage(amount: number): boolean; // Returns true if destroyed
    onDestroyed(): void;
}
```

### CombatUI Class
**Purpose**: Manages combat-related user interface for movement-based combat

**Features**:
- Movement destination indicators
- Detection range visualization (10 units)
- Combat range indicators (8 units)
- Auto-engagement status displays
- Energy cost previews
- Damage number displays
- Combat status indicators
- Enemy detection highlights

## Data Models

### Combat Configuration
```typescript
interface CombatConfig {
    protectorDetectionRange: number; // 10 units - auto-detection
    protectorAttackRange: number; // 8 units - attack range
    attackEnergyCost: number; // 5 energy per attack
    attackCooldown: number; // 1000ms between attacks
    parasiteReward: number; // 10 energy for destroying parasite
    aiUnitRewards: {
        worker: number; // 15 energy
        scout: number; // 12 energy
        protector: number; // 20 energy
    };
    autoAttackEnabled: boolean; // Global auto-attack toggle
}
```

### Attack Result
```typescript
interface AttackResult {
    success: boolean;
    damageDealt: number;
    targetDestroyed: boolean;
    energyConsumed: number;
    energyRewarded: number;
}
```

### Target Validation
```typescript
interface TargetValidation {
    isValid: boolean;
    reason: 'valid' | 'friendly' | 'out_of_range' | 'invalid_type' | 'insufficient_energy';
    requiredEnergy?: number;
    currentRange?: number;
    maxRange?: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

<function_calls>
<invoke name="prework">
<parameter name="featureName">protector-combat-system

### Property Reflection

After reviewing all testable properties from the prework analysis, I identified several areas where properties can be consolidated to eliminate redundancy:

**Target Validation Consolidation**: Properties 2.3, 2.4, and 2.5 can be combined into a single comprehensive target classification property.

**UI Feedback Consolidation**: Properties 2.1, 2.2, 5.5 can be combined into a comprehensive UI feedback property.

**Visual Effects Consolidation**: Properties 5.1, 5.2, 5.3, 5.4 can be combined into a comprehensive visual feedback property.

**Energy Economics Consolidation**: Properties 4.1, 4.2, 4.3 can be combined into a comprehensive energy transaction property.

**Combat State Management**: Properties 6.1, 6.2, 6.3 address different aspects of state management and should remain separate.

### Correctness Properties

Property 1: Movement Command Execution
*For any* valid destination click, the protector should initiate movement to that location and maintain movement state until interrupted by enemy detection or arrival
**Validates: Requirements 1.1**

Property 2: Automatic Enemy Detection
*For any* enemy within 10 units of a moving protector, the detection system should identify the enemy and trigger auto-engagement
**Validates: Requirements 2.1**

Property 3: Target Prioritization Consistency
*For any* scenario with multiple enemies detected, the protector should consistently prioritize the closest enemy for engagement
**Validates: Requirements 2.2**

Property 4: Damage Application Consistency
*For any* protector attacking any valid target, damage should be applied consistently according to the target type and the target should be destroyed when health reaches zero
**Validates: Requirements 1.2, 1.3**

Property 5: Energy Consumption Per Attack
*For any* attack action, exactly 5 energy should be consumed from the global energy pool regardless of target type or attack outcome
**Validates: Requirements 1.4, 4.1**

Property 6: Energy Validation Prevents Attacks
*For any* protector with insufficient energy (less than 5), auto-attack should be prevented but movement should continue
**Validates: Requirements 1.6, 4.4**

Property 7: Target Classification Accuracy
*For any* entity in the game world, the target validation system should correctly classify Energy_Parasites and AI_Units as valid targets and friendly units as invalid targets
**Validates: Requirements 2.3, 2.4, 2.5**

Property 8: Range-Based Engagement Behavior
*For any* detected enemy, if within combat range (8 units) the protector should attack immediately, otherwise move to attack range first
**Validates: Requirements 3.1, 3.2, 3.3**

Property 9: Movement Resumption After Combat
*For any* completed combat action, the protector should resume movement to its original destination if the destination was not reached
**Validates: Requirements 3.4, 2.6**

Property 10: Detection Range Validation
*For any* protector, the detection range (10 units) should be larger than combat range (8 units) to ensure smooth engagement transitions
**Validates: Requirements 3.5**

Property 11: Energy Reward Consistency
*For any* target destruction, the energy reward should be consistent based on target type (10 for parasites, type-specific for AI units)
**Validates: Requirements 4.2, 4.3**

Property 12: Comprehensive Visual Feedback
*For any* combat interaction (enemy detection, auto-engagement, attack execution), appropriate visual feedback should be displayed including detection indicators, range displays, and combat effects
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

Property 13: Multi-Protector Damage Coordination
*For any* scenario where multiple protectors attack the same target, damage should be properly accumulated and the target should be destroyed when total damage exceeds health
**Validates: Requirements 6.1**

Property 14: Target Destruction Cleanup
*For any* target that is destroyed, all pending attacks on that target should be cancelled and protectors should resume their original movement
**Validates: Requirements 6.2**

Property 15: Protector Destruction Cleanup
*For any* protector that is destroyed during combat, its combat state should be properly cleaned up and any ongoing attacks should be cancelled
**Validates: Requirements 6.3**

Property 16: Combat Interruption Handling
*For any* combat action that is interrupted (target out of range, energy depletion, unit destruction), the system should handle state transitions gracefully and resume movement when appropriate
**Validates: Requirements 6.5**

## Error Handling

### Energy Insufficient Scenarios
- Display clear feedback when protectors cannot attack due to energy constraints
- Prevent attack initiation rather than failing mid-attack
- Provide energy cost information in UI tooltips

### Target Validation Failures
- Handle cases where targets become invalid during combat (destroyed, moved out of range)
- Graceful fallback when target validation fails
- Clear error messages for invalid target selection attempts

### Combat State Corruption
- Robust cleanup when units are destroyed during combat
- Prevention of orphaned combat actions
- State validation and recovery mechanisms

### Performance Degradation
- Combat action throttling during high-load scenarios
- Efficient cleanup of completed combat actions
- Memory management for visual effects and temporary objects

## Testing Strategy

### Unit Testing Approach
- **Specific Examples**: Test concrete scenarios like "Protector attacks Energy Parasite at range 5"
- **Edge Cases**: Test boundary conditions (exactly at range limit, zero energy, target destruction timing)
- **Error Conditions**: Test invalid inputs and failure scenarios
- **Integration Points**: Test interaction with EnergyManager, UnitManager, and visual systems

### Property-Based Testing Configuration
- **Framework**: Use Jest with fast-check for property-based testing
- **Test Iterations**: Minimum 100 iterations per property test
- **Test Tagging**: Each property test tagged with format: **Feature: protector-combat-system, Property {number}: {property_text}**
- **Generators**: Smart generators for valid protectors, targets, positions, and energy states
- **Shrinking**: Automatic test case reduction when properties fail

### Dual Testing Benefits
- **Unit Tests**: Catch specific bugs and validate concrete examples
- **Property Tests**: Verify universal correctness across all input combinations
- **Comprehensive Coverage**: Unit tests handle integration, property tests handle logic correctness
- **Regression Prevention**: Property tests catch edge cases that unit tests might miss

### Performance Testing
- **60fps Validation**: Ensure combat system maintains target frame rate during active combat
- **Memory Usage**: Monitor memory consumption during extended combat scenarios
- **Concurrent Combat**: Test performance with multiple simultaneous combat actions
- **Visual Effects**: Validate that combat visual effects don't impact performance