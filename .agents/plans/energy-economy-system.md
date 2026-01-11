# Feature: Energy Economy System Implementation

The following plan implements the core energy-based economy system for Nexus of Mind, where energy powers all game actions from mining to combat, creating strategic resource management gameplay.

## Feature Description

Implement a comprehensive energy economy system where energy is the primary resource that powers all game actions. Players must manage energy generation, storage, and consumption across mining, building, unit operations, and combat. The system includes mineral-to-energy conversion, energy reserves, consumption tracking, and strategic resource allocation.

## User Story

As a player
I want to manage energy as the core resource that powers all my actions
So that I must make strategic decisions about energy allocation between mining, building, combat, and defense

## Problem Statement

The game needs a central resource management system that:
- Makes energy the universal currency for all actions
- Creates strategic depth through resource scarcity and allocation decisions
- Provides clear feedback on energy generation, storage, and consumption
- Integrates with existing terrain system for mineral extraction
- Supports future AI decision-making for energy allocation

## Solution Statement

Implement a modular energy economy system with energy generation from minerals, storage in units and buildings, consumption tracking for all actions, and real-time energy management. The system will integrate with the existing 3D world and provide foundation for future gameplay mechanics.

## Feature Metadata

**Feature Type**: Core Gameplay System
**Estimated Complexity**: High
**Primary Systems Affected**: Game logic, resource management, UI foundation
**Dependencies**: US-001 ✅ (3D Foundation), US-002 ✅ (Procedural Terrain)

---

## CONTEXT REFERENCES

### Relevant Codebase Files

**Integration Points:**
- `client/src/game/GameEngine.ts` - Core game loop integration
- `client/src/rendering/TerrainGenerator.ts` - Mineral deposit placement
- `client/src/rendering/MaterialManager.ts` - Mineral visualization
- `client/src/rendering/SceneManager.ts` - Energy system initialization

**Game Design References:**
- `research/game-dynamics-brainstorm.md` - Energy economy specifications
- `research/visual-design-concepts.md` - Mineral and energy visualization
- `.kiro/steering/product.md` - Core gameplay mechanics

### Energy Economy Specifications

**From Game Design:**
- **Energy Source**: Radioactive minerals converted to energy (1 gram = 1 joule)
- **Energy Uses**: Mining, building, unit operations, combat, shields
- **Storage**: Units and bases can reserve energy
- **Consumption**: All actions require energy in varying amounts
- **Scarcity**: Energy becomes strategic bottleneck requiring allocation decisions

**Visual Design:**
- **Minerals**: Light blue crystals (already in MaterialManager)
- **Energy Effects**: Blue/white energy visualization
- **UI Elements**: Energy bars, consumption indicators, reserve displays

---

## IMPLEMENTATION PLAN

### Phase 1: Core Energy System

Implement the fundamental energy management classes and data structures.

**Tasks:**
- Create EnergyManager for global energy tracking
- Implement EnergyStorage for units and buildings
- Add EnergyConsumer interface for energy-using actions
- Create energy transaction and validation system

### Phase 2: Mineral System Integration

Connect energy generation to the terrain system through mineral deposits.

**Tasks:**
- Add mineral deposit generation to terrain chunks
- Create MineralDeposit class for energy extraction
- Implement mining mechanics and energy conversion
- Integrate mineral visualization with existing materials

### Phase 3: Energy Consumption Framework

Implement energy consumption for all game actions.

**Tasks:**
- Create action-based energy consumption system
- Add energy costs for building, mining, combat
- Implement energy validation before actions
- Add energy consumption feedback and notifications

---

## STEP-BY-STEP TASKS

### CREATE client/src/game/EnergyManager.ts

- **IMPLEMENT**: Global energy economy management and tracking
- **PATTERN**: Singleton pattern for centralized energy management
- **IMPORTS**: EventEmitter for energy change notifications
- **GOTCHA**: Thread-safe energy transactions for concurrent actions
- **VALIDATE**: Energy balance always maintained, no negative energy

### CREATE client/src/game/EnergyStorage.ts

- **IMPLEMENT**: Energy storage component for units and buildings
- **PATTERN**: Component pattern attachable to game entities
- **IMPORTS**: None (pure data structure with methods)
- **GOTCHA**: Maximum capacity limits and overflow handling
- **VALIDATE**: Storage capacity respected, energy transfer validation

### CREATE client/src/game/EnergyConsumer.ts

- **IMPLEMENT**: Interface and base class for energy-consuming actions
- **PATTERN**: Interface pattern for consistent energy consumption
- **IMPORTS**: EnergyStorage for energy source validation
- **GOTCHA**: Action validation before energy deduction
- **VALIDATE**: Actions fail gracefully when insufficient energy

### CREATE client/src/world/MineralDeposit.ts

- **IMPLEMENT**: Mineral deposits that generate energy when mined
- **PATTERN**: Entity pattern with position, capacity, and extraction rate
- **IMPORTS**: Vector3 for world positioning, MaterialManager for visualization
- **GOTCHA**: Finite mineral capacity with depletion over time
- **VALIDATE**: Mineral deposits spawn correctly on terrain, visible to players

### UPDATE client/src/rendering/TerrainGenerator.ts

- **IMPLEMENT**: Add mineral deposit generation to terrain chunks
- **PATTERN**: Procedural generation integrated with existing terrain system
- **IMPORTS**: MineralDeposit, NoiseGenerator for placement distribution
- **GOTCHA**: Mineral distribution balanced across biomes
- **VALIDATE**: Minerals spawn at appropriate density and locations

### CREATE client/src/game/actions/MiningAction.ts

- **IMPLEMENT**: Mining action that converts minerals to energy
- **PATTERN**: Action pattern implementing EnergyConsumer interface
- **IMPORTS**: MineralDeposit, EnergyStorage, EnergyManager
- **GOTCHA**: Mining requires initial energy investment for extraction
- **VALIDATE**: Mining produces net positive energy over time

### CREATE client/src/game/actions/BuildingAction.ts

- **IMPLEMENT**: Building construction with energy costs
- **PATTERN**: Action pattern with energy validation and consumption
- **IMPORTS**: EnergyConsumer, building cost configurations
- **GOTCHA**: Energy reserved during construction, released on completion/cancellation
- **VALIDATE**: Buildings cannot be constructed without sufficient energy

### CREATE client/src/game/GameState.ts

- **IMPLEMENT**: Central game state management including energy economy
- **PATTERN**: State management pattern with energy integration
- **IMPORTS**: EnergyManager, all game entities and systems
- **GOTCHA**: State synchronization between energy system and game entities
- **VALIDATE**: Game state remains consistent with energy constraints

### UPDATE client/src/game/GameEngine.ts

- **IMPLEMENT**: Integrate energy system into main game loop
- **PATTERN**: System integration with existing engine architecture
- **IMPORTS**: EnergyManager, GameState, all energy-related systems
- **GOTCHA**: Energy system initialization order and update frequency
- **VALIDATE**: Energy system runs smoothly within 60fps target

### CREATE client/src/ui/EnergyDisplay.ts

- **IMPLEMENT**: Basic energy UI display for current energy levels
- **PATTERN**: UI component pattern with real-time updates
- **IMPORTS**: EnergyManager for energy state, HTML DOM manipulation
- **GOTCHA**: UI updates efficiently without impacting game performance
- **VALIDATE**: Energy display updates in real-time, shows accurate values

---

## TECHNICAL SPECIFICATIONS

### Energy System Architecture

**Core Components:**
```typescript
interface EnergySystem {
    manager: EnergyManager;           // Global energy tracking
    storage: Map<EntityId, EnergyStorage>; // Per-entity energy storage
    consumers: EnergyConsumer[];      // All energy-consuming actions
    deposits: MineralDeposit[];       // Energy generation sources
}
```

**Energy Flow:**
1. **Generation**: Minerals → Mining → Energy Storage
2. **Storage**: Units and Buildings store energy reserves
3. **Consumption**: Actions validate and consume energy
4. **Feedback**: UI displays energy levels and consumption

### Energy Economics

**Energy Conversion:**
- 1 gram mineral = 1 joule energy (base conversion rate)
- Mining efficiency varies by unit type and upgrades
- Energy loss during transfer and storage (realistic economics)

**Energy Costs (Initial Values):**
- **Mining**: 0.1 energy per mineral gram (investment for extraction)
- **Building Base**: 50 energy
- **Building Power Plant**: 30 energy
- **Unit Movement**: 0.5 energy per unit distance
- **Combat**: 2-5 energy per weapon shot (varies by target)
- **Shields**: 1 energy per second active

**Storage Capacities:**
- **Worker**: 10 energy capacity
- **Scout**: 8 energy capacity  
- **Protector**: 12 energy capacity
- **Base**: 100 energy capacity
- **Power Plant**: 200 energy capacity

### Mineral Deposit System

**Deposit Generation:**
- Spawn probability based on biome type
- Higher concentration in rocky biomes
- Visible deposits vs hidden deposits (scouting required)
- Finite capacity per deposit (strategic depletion)

**Deposit Properties:**
```typescript
interface MineralDeposit {
    position: Vector3;
    capacity: number;        // Total energy available
    remaining: number;       // Current energy remaining
    extractionRate: number;  // Energy per second when mined
    visible: boolean;        // Discovered by player
    biome: BiomeType;       // Affects spawn probability
}
```

---

## TESTING STRATEGY

### Unit Tests

**Energy System Tests:**
- Energy transaction validation (no negative energy)
- Storage capacity limits and overflow handling
- Energy consumption validation before actions
- Mineral-to-energy conversion accuracy

**Integration Tests:**
- Energy system integration with game loop
- Mineral deposit generation and placement
- Action energy consumption and validation
- UI energy display accuracy and updates

### Gameplay Tests

**Energy Economy Validation:**
- Players can mine minerals and generate energy
- Energy consumption prevents actions when insufficient
- Energy storage limits create strategic decisions
- Mineral depletion creates resource scarcity

### Performance Tests

**System Performance:**
- Energy calculations don't impact 60fps target
- UI updates efficiently without frame drops
- Memory usage remains stable with energy tracking
- Large numbers of energy transactions handled smoothly

---

## VALIDATION COMMANDS

### Level 1: System Testing

```bash
# Test energy system in isolation
npm run test -- --grep "EnergyManager"
npm run test -- --grep "EnergyStorage"
npm run test -- --grep "MineralDeposit"
```

### Level 2: Integration Testing

```bash
# Start development server
npm run dev

# Manual validation checklist:
# 1. Energy display shows current energy levels
# 2. Mineral deposits visible on terrain
# 3. Mining actions consume and generate energy
# 4. Actions blocked when insufficient energy
# 5. Energy storage limits enforced
```

### Level 3: Gameplay Validation

```bash
# Gameplay scenarios to test:
# 1. Start with initial energy allocation
# 2. Mine minerals to increase energy
# 3. Attempt actions without sufficient energy
# 4. Verify energy consumption for all actions
# 5. Test energy storage capacity limits
```

---

## ACCEPTANCE CRITERIA

- [ ] Energy tracking system manages global energy economy
- [ ] Mineral deposits generate on terrain with appropriate distribution
- [ ] Mining converts minerals to energy at 1:1 ratio (base rate)
- [ ] All game actions consume energy according to specifications
- [ ] Energy storage system with capacity limits for units and buildings
- [ ] Actions are blocked when insufficient energy available
- [ ] Energy consumption provides clear feedback to players
- [ ] UI displays current energy levels and consumption
- [ ] System maintains 60fps performance with energy calculations
- [ ] Energy economy creates strategic resource allocation decisions
- [ ] Mineral deposits deplete over time creating resource scarcity
- [ ] Energy system integrates seamlessly with existing 3D world

---

## COMPLETION CHECKLIST

- [ ] EnergyManager implemented with global energy tracking
- [ ] EnergyStorage component for units and buildings
- [ ] EnergyConsumer interface for all energy-using actions
- [ ] MineralDeposit system integrated with terrain generation
- [ ] Mining actions convert minerals to energy
- [ ] Building actions consume energy for construction
- [ ] GameState manages energy economy integration
- [ ] GameEngine integrates energy system into main loop
- [ ] Basic energy UI display shows current levels
- [ ] All acceptance criteria met and tested
- [ ] Performance targets maintained (60fps)
- [ ] Integration with existing systems validated

---

## NOTES

**Design Decisions:**
- Energy as universal currency creates strategic depth
- Mineral-to-energy conversion provides clear resource generation
- Storage limits force strategic allocation decisions
- Action validation prevents impossible moves

**Performance Considerations:**
- Energy calculations optimized for real-time gameplay
- UI updates batched to prevent frame rate impact
- Mineral deposit generation integrated with existing chunk system
- Memory efficient energy tracking and storage

**Future Expansion Points:**
- Energy efficiency upgrades for units and buildings
- Advanced energy storage technologies
- Energy trading between players (multiplayer)
- AI energy allocation decision making
- Energy-based combat and defense systems

**Integration Strategy:**
- Build on existing 3D foundation and terrain system
- Prepare for future AI decision-making integration
- Design for multiplayer energy economy (future)
- Maintain low poly aesthetic with energy visualizations