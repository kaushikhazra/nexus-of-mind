# Feature: Unit System Implementation

The following plan implements the three core unit types for Nexus of Mind: Workers, Scouts, and Protectors. Each unit type has unique capabilities, energy requirements, and visual representation, creating strategic depth through specialized roles.

## Feature Description

Implement three distinct unit types with energy-driven behaviors, 3D visualization, and AI-ready architecture. Units integrate seamlessly with the existing energy economy system, providing players with specialized tools for mining, exploration, and combat while creating strategic resource allocation decisions.

## User Story

As a player
I want to control three different unit types (Workers, Scouts, Protectors)
So that I can specialize my strategy with mining, exploration, and combat capabilities while managing energy resources efficiently

## Problem Statement

The game needs interactive units that:
- Provide distinct strategic roles and capabilities
- Integrate with the energy economy system for resource management
- Offer visual feedback and intuitive controls
- Support future AI decision-making systems
- Maintain 60fps performance with multiple active units

## Solution Statement

Implement a modular unit system with three specialized unit types, each with unique energy costs, capabilities, and visual representation. Units will use the existing energy economy for all actions, creating strategic depth through resource management and role specialization.

## Feature Metadata

**Feature Type**: Core Gameplay System
**Estimated Complexity**: High
**Primary Systems Affected**: Game entities, 3D rendering, energy integration, user interaction
**Dependencies**: US-001 ✅ (3D Foundation), US-002 ✅ (Terrain), US-003 ✅ (Energy Economy)

---

## CONTEXT REFERENCES

### Relevant Codebase Files

**Integration Points:**
- `client/src/game/GameState.ts` - Unit entity management and lifecycle
- `client/src/game/EnergyStorage.ts` - Per-unit energy storage integration
- `client/src/game/actions/` - Unit action implementations (mining, movement, building)
- `client/src/rendering/MaterialManager.ts` - Unit material and visual representation
- `client/src/rendering/SceneManager.ts` - 3D unit mesh management

**Game Design References:**
- `research/game-dynamics-brainstorm.md` - Unit specifications and energy costs
- `research/visual-design-concepts.md` - Low poly unit aesthetic and color coding
- `.kiro/steering/product.md` - Strategic gameplay mechanics and user experience

### Unit Specifications

**From Game Design:**
- **Workers (Green Spheres)**: Mining specialists, building construction, energy storage: 10
- **Scouts (Blue Spheres)**: Fast exploration, mineral discovery, energy storage: 8
- **Protectors (Red Spheres)**: Combat units, base defense, energy storage: 12

**Energy Costs:**
- **Movement**: Worker (0.5/unit), Scout (0.3/unit), Protector (0.8/unit)
- **Mining**: Workers only, 0.5 energy/second operation cost
- **Combat**: Protectors only, 2-5 energy per weapon shot
- **Special Abilities**: Scout discovery (1 energy), Protector shields (1 energy/second)

**Visual Design:**
- **Low Poly Aesthetic**: Simple sphere geometry with flat shading
- **Color Coding**: Green (Workers), Blue (Scouts), Red (Protectors)
- **Energy Indicators**: Visual feedback for energy levels and actions
- **Animation**: Simple movement and action animations

---

## IMPLEMENTATION PLAN

### Phase 1: Core Unit Architecture

Implement the foundational unit system with entity management and energy integration.

**Tasks:**
- Create Unit base class with energy integration
- Implement unit type specializations (Worker, Scout, Protector)
- Add unit lifecycle management to GameState
- Create unit factory for consistent unit creation

### Phase 2: 3D Unit Visualization

Add 3D representation and visual feedback for all unit types.

**Tasks:**
- Create unit meshes with low poly sphere geometry
- Implement material system for unit color coding
- Add energy level visualization (scaling, color changes)
- Create basic movement animations

### Phase 3: Unit Actions Integration

Connect units with existing action systems for complete functionality.

**Tasks:**
- Integrate units with MiningAction, MovementAction, BuildingAction
- Add unit-specific capabilities and restrictions
- Implement unit selection and command system
- Create unit AI foundation for autonomous behavior

---

## STEP-BY-STEP TASKS

### CREATE client/src/game/entities/Unit.ts

- **IMPLEMENT**: Base unit class with energy integration and common functionality
- **PATTERN**: Entity component pattern with energy storage and action management
- **IMPORTS**: EnergyStorage, GameState, Vector3, action classes
- **GOTCHA**: Unit lifecycle management and proper disposal of resources
- **VALIDATE**: Units integrate seamlessly with energy system and game state

### CREATE client/src/game/entities/Worker.ts

- **IMPLEMENT**: Worker unit specialization with mining and building capabilities
- **PATTERN**: Inheritance from Unit base class with specialized methods
- **IMPORTS**: Unit, MiningAction, BuildingAction, energy system
- **GOTCHA**: Mining efficiency and energy optimization for sustained operations
- **VALIDATE**: Workers can mine minerals and construct buildings efficiently

### CREATE client/src/game/entities/Scout.ts

- **IMPLEMENT**: Scout unit specialization with exploration and discovery abilities
- **PATTERN**: Inheritance from Unit base class with movement optimization
- **IMPORTS**: Unit, MovementAction, mineral discovery system
- **GOTCHA**: Fast movement with energy efficiency and hidden deposit discovery
- **VALIDATE**: Scouts move quickly and can discover hidden mineral deposits

### CREATE client/src/game/entities/Protector.ts

- **IMPLEMENT**: Protector unit specialization with combat and defense capabilities
- **PATTERN**: Inheritance from Unit base class with combat systems
- **IMPORTS**: Unit, combat actions, shield system (future)
- **GOTCHA**: High energy consumption balanced with combat effectiveness
- **VALIDATE**: Protectors provide defensive capabilities with appropriate energy costs

### CREATE client/src/rendering/UnitRenderer.ts

- **IMPLEMENT**: 3D unit visualization with low poly aesthetic and energy feedback
- **PATTERN**: Renderer pattern with mesh management and material application
- **IMPORTS**: Scene, MaterialManager, Unit entities, Babylon.js mesh classes
- **GOTCHA**: Efficient mesh management for multiple units without performance impact
- **VALIDATE**: Units render correctly with color coding and energy level indicators

### CREATE client/src/game/UnitManager.ts

- **IMPLEMENT**: Central unit management system with selection and command handling
- **PATTERN**: Manager pattern with unit lifecycle and interaction management
- **IMPORTS**: Unit classes, GameState, input handling, rendering system
- **GOTCHA**: Efficient unit selection and command queuing for responsive gameplay
- **VALIDATE**: Players can select and command units intuitively

### UPDATE client/src/game/GameState.ts

- **IMPLEMENT**: Enhanced entity management with unit-specific functionality
- **PATTERN**: Extension of existing GameState with unit integration
- **IMPORTS**: Unit classes, UnitManager, enhanced entity tracking
- **GOTCHA**: Seamless integration with existing energy and building systems
- **VALIDATE**: Units integrate perfectly with existing game state management

### UPDATE client/src/game/GameEngine.ts

- **IMPLEMENT**: Unit system integration into main game loop
- **PATTERN**: System integration with existing engine architecture
- **IMPORTS**: UnitManager, UnitRenderer, enhanced game state
- **GOTCHA**: Proper initialization order and update frequency for smooth gameplay
- **VALIDATE**: Unit system runs smoothly within 60fps target

### CREATE client/src/ui/UnitUI.ts

- **IMPLEMENT**: Unit selection UI and information display
- **PATTERN**: UI component pattern with real-time unit status updates
- **IMPORTS**: Unit classes, energy display system, HTML DOM manipulation
- **GOTCHA**: Efficient UI updates without impacting game performance
- **VALIDATE**: Unit UI provides clear feedback on unit status and capabilities

---

## TECHNICAL SPECIFICATIONS

### Unit System Architecture

**Core Components:**
```typescript
interface UnitSystem {
    unitManager: UnitManager;           // Central unit management
    unitRenderer: UnitRenderer;         // 3D visualization system
    units: Map<string, Unit>;          // Active unit instances
    selectedUnits: Set<string>;        // Currently selected units
    commandQueue: UnitCommand[];       // Queued unit commands
}
```

**Unit Hierarchy:**
```typescript
abstract class Unit {
    // Base functionality: energy, position, actions
}

class Worker extends Unit {
    // Mining and building specialization
}

class Scout extends Unit {
    // Exploration and discovery specialization
}

class Protector extends Unit {
    // Combat and defense specialization
}
```

### Unit Specifications

**Worker Units:**
- **Energy Storage**: 10 capacity
- **Movement Cost**: 0.5 energy per unit distance
- **Special Abilities**: Mining (0.5 energy/second), Building construction
- **Visual**: Green sphere, 1.0 unit radius
- **AI Behavior**: Prioritize mining and construction tasks

**Scout Units:**
- **Energy Storage**: 8 capacity
- **Movement Cost**: 0.3 energy per unit distance (most efficient)
- **Special Abilities**: Hidden deposit discovery (1 energy per discovery)
- **Visual**: Blue sphere, 0.8 unit radius (smaller, faster appearance)
- **AI Behavior**: Explore unknown areas and locate resources

**Protector Units:**
- **Energy Storage**: 12 capacity (highest)
- **Movement Cost**: 0.8 energy per unit distance (heaviest)
- **Special Abilities**: Combat (2-5 energy per shot), Shield defense (1 energy/second)
- **Visual**: Red sphere, 1.2 unit radius (largest, most imposing)
- **AI Behavior**: Defend bases and engage threats

### 3D Visualization System

**Unit Meshes:**
- **Geometry**: Simple sphere with low polygon count for performance
- **Materials**: Flat shading with unit-type color coding
- **Scaling**: Dynamic scaling based on energy levels (0.8x to 1.2x)
- **Animation**: Smooth movement interpolation and action feedback

**Energy Visualization:**
- **Color Intensity**: Brighter colors indicate higher energy levels
- **Scale Variation**: Units shrink slightly when low on energy
- **Action Feedback**: Brief scaling or color changes during actions
- **Selection Indicators**: Outline or highlight for selected units

### Performance Optimization

**Rendering Efficiency:**
- **Instanced Rendering**: Use Babylon.js instancing for multiple units of same type
- **LOD System**: Reduce detail for distant units
- **Culling**: Only render units within camera view
- **Batching**: Group similar units for efficient rendering

**Update Optimization:**
- **Spatial Partitioning**: Only update units in active areas
- **Action Batching**: Process multiple unit actions efficiently
- **Memory Management**: Proper disposal of inactive units
- **Delta Time**: Smooth updates independent of frame rate

---

## TESTING STRATEGY

### Unit Tests

**Unit Creation and Management:**
- Unit factory creates correct unit types with proper specifications
- Energy storage integration works correctly for all unit types
- Unit lifecycle management (creation, updates, disposal) functions properly
- Unit selection and command systems respond accurately

**Energy Integration:**
- Units consume energy correctly for movement and actions
- Energy storage limits are enforced for all unit types
- Energy efficiency differences between unit types work as designed
- Low energy states properly restrict unit capabilities

### Integration Tests

**Game State Integration:**
- Units integrate seamlessly with existing GameState management
- Unit actions work correctly with energy economy system
- Multiple units can operate simultaneously without conflicts
- Unit persistence and state management function properly

**3D Rendering Integration:**
- Units render correctly with appropriate materials and scaling
- Energy level visualization updates in real-time
- Unit selection and highlighting work intuitively
- Performance remains stable with multiple active units

### Gameplay Tests

**Unit Functionality:**
- Workers can mine minerals and construct buildings effectively
- Scouts move efficiently and discover hidden mineral deposits
- Protectors provide defensive capabilities with appropriate energy costs
- Unit specialization creates meaningful strategic choices

**User Experience:**
- Unit selection and command interface is intuitive and responsive
- Visual feedback clearly communicates unit status and capabilities
- Energy management creates strategic depth without frustration
- Unit AI behavior supports player intentions effectively

---

## VALIDATION COMMANDS

### Level 1: System Testing

```bash
# Test unit system in isolation
npm run test -- --grep "Unit"
npm run test -- --grep "UnitManager"
npm run test -- --grep "UnitRenderer"
```

### Level 2: Integration Testing

```bash
# Start development server
npm run dev

# Manual validation checklist:
# 1. Units spawn correctly with proper visual representation
# 2. Unit selection and command system works intuitively
# 3. Energy integration functions properly for all unit types
# 4. Unit actions (mining, movement, building) work as expected
# 5. Performance remains stable with multiple active units
```

### Level 3: Gameplay Validation

```bash
# Gameplay scenarios to test:
# 1. Create workers and assign mining tasks
# 2. Use scouts to explore and discover hidden deposits
# 3. Deploy protectors for base defense
# 4. Test energy management with mixed unit compositions
# 5. Verify unit specialization creates strategic choices
```

---

## ACCEPTANCE CRITERIA

- [ ] Three unit types (Worker, Scout, Protector) implemented with distinct capabilities
- [ ] Units integrate seamlessly with existing energy economy system
- [ ] 3D unit visualization with low poly aesthetic and color coding
- [ ] Unit selection and command system provides intuitive player control
- [ ] Energy storage and consumption work correctly for all unit types
- [ ] Unit-specific abilities (mining, exploration, combat) function as designed
- [ ] Visual feedback clearly communicates unit status and energy levels
- [ ] Performance maintains 60fps target with multiple active units
- [ ] Unit AI foundation supports future autonomous behavior development
- [ ] Unit system creates strategic depth through specialization and energy management
- [ ] Integration with existing terrain and building systems works seamlessly
- [ ] Unit lifecycle management (creation, updates, disposal) functions properly

---

## COMPLETION CHECKLIST

- [ ] Unit base class with energy integration implemented
- [ ] Worker, Scout, and Protector specializations created
- [ ] UnitRenderer provides 3D visualization with energy feedback
- [ ] UnitManager handles selection, commands, and lifecycle
- [ ] GameState integration with enhanced entity management
- [ ] GameEngine integration with unit system updates
- [ ] Unit UI provides clear status and control interface
- [ ] All acceptance criteria met and tested
- [ ] Performance targets maintained (60fps with multiple units)
- [ ] Integration with existing systems validated
- [ ] Browser testing functions for unit system validation
- [ ] Documentation updated with unit system architecture

---

## NOTES

**Design Decisions:**
- Unit specialization creates clear strategic roles and choices
- Energy integration ensures resource management remains central
- Low poly aesthetic maintains performance while providing clear visual identity
- Modular architecture supports future AI and multiplayer expansion

**Performance Considerations:**
- Instanced rendering for efficient multiple unit visualization
- Spatial partitioning for optimized unit updates
- Memory management for proper unit lifecycle handling
- Delta time updates for smooth gameplay independent of frame rate

**Future Expansion Points:**
- Advanced unit abilities and upgrades
- Combat system with tactical depth
- Unit formations and group commands
- AI behavior trees for autonomous unit control
- Multiplayer unit synchronization

**Integration Strategy:**
- Build on existing energy economy foundation
- Leverage established 3D rendering and material systems
- Extend GameState for comprehensive entity management
- Prepare architecture for future AI decision-making integration