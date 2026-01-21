# FPS Optimization Fixes - Requirements Document

## Introduction

This specification addresses performance issues causing low baseline FPS (25-38) and FPS degradation over time (dropping to 12 FPS after 1 hour of gameplay). The fixes target memory leaks, per-frame bottlenecks, and system update frequency optimization to achieve stable 60 FPS gameplay.

## Glossary

- **Memory Leak**: Resources allocated but never released, causing accumulation over time
- **Per-frame Allocation**: Creating new objects/arrays every render frame, causing garbage collection pressure
- **Update Throttling**: Reducing the frequency of non-critical system updates from 60Hz to lower rates
- **Material Disposal**: Properly releasing GPU resources when visual effects complete
- **Render Loop**: The main game loop running at 60 FPS that updates and renders the scene

## Requirements

### Requirement 1: Combat Effects Material Disposal

**User Story:** As a player, I want combat effects to not degrade performance over time, so that I can play extended sessions without FPS drops.

#### Acceptance Criteria

1. WHEN a laser beam effect is created, THE System SHALL track the cloned material reference
2. WHEN a laser beam effect is removed, THE System SHALL dispose the cloned material
3. WHEN any combat effect with cloned materials is removed, THE System SHALL dispose all associated materials
4. THE System SHALL NOT accumulate undisposed materials over time
5. AFTER 1 hour of gameplay with combat, THE FPS SHALL NOT drop below 50% of initial baseline

### Requirement 2: Duplicate UI Texture Elimination

**User Story:** As a player, I want efficient UI rendering, so that multiple UI systems don't compete for resources.

#### Acceptance Criteria

1. THE CombatEffects system SHALL reuse the existing MainUI AdvancedDynamicTexture from GameEngine
2. THE System SHALL NOT create a duplicate fullscreen UI texture
3. WHEN CombatEffects is initialized, THE System SHALL accept the GUI texture as a constructor parameter
4. THE System SHALL have only ONE fullscreen AdvancedDynamicTexture for the entire game

### Requirement 3: Remove PerformanceMonitor System

**User Story:** As a developer, I want to eliminate unnecessary monitoring overhead, so that the game runs with minimal system complexity.

#### Acceptance Criteria

1. THE PerformanceMonitor class SHALL be removed from the codebase
2. THE TerritoryPerformanceMonitor class SHALL be removed (depends on PerformanceMonitor)
3. ALL references to PerformanceMonitor SHALL be removed from GameEngine, TerritoryManager, DebugUI, and SystemIntegration
4. THE FPSCounter SHALL remain as the sole FPS monitoring solution
5. THE game SHALL compile and run without PerformanceMonitor

### Requirement 4: Synchronous Render Loop

**User Story:** As a player, I want smooth frame delivery, so that the game doesn't stutter from async delays.

#### Acceptance Criteria

1. THE render loop SHALL NOT contain async/await operations
2. THE UnitManager.update() method SHALL be synchronous
3. THE command processing SHALL be non-blocking
4. WHEN commands need async operations, THE System SHALL queue them for deferred execution
5. THE frame time variance SHALL be reduced by removing microtask delays

### Requirement 5: Round-Robin System Update Throttling

**User Story:** As a player, I want maximum FPS, so that non-critical systems don't consume frame budget unnecessarily and don't cause micro-stutters.

#### Acceptance Criteria

1. THE EnergyManager.update() SHALL run at 10Hz (every 100ms), not 60Hz
2. THE TerritoryManager.update() SHALL run at 10Hz (every 100ms), not 60Hz
3. THE LiberationManager.updateLiberations() SHALL run at 5Hz (every 200ms), not 60Hz
4. THE EnergyLordsManager.update() SHALL run at 10Hz (every 100ms), not 60Hz
5. THE render loop SHALL check at most ONE throttled system per frame (round-robin)
6. THE throttling SHALL use performance.now() for accurate timing
7. THE System SHALL NOT update multiple throttled systems in the same frame

### Requirement 6: Per-frame Allocation Elimination

**User Story:** As a player, I want consistent frame times, so that garbage collection doesn't cause stutters.

#### Acceptance Criteria

1. THE ParasiteManager.update() SHALL NOT create new arrays via filter/map/sort/slice each frame
2. THE System SHALL reuse pre-allocated arrays for deposit filtering
3. THE System SHALL cache camera position lookups within a frame
4. THE sorting operation SHALL only occur when deposits change, not every frame
5. THE per-frame object allocations in hot paths SHALL be eliminated or minimized

### Requirement 7: Singleton Lookup Caching

**User Story:** As a developer, I want efficient code patterns, so that repeated lookups don't waste CPU cycles.

#### Acceptance Criteria

1. WHEN a class frequently calls GameEngine.getInstance(), THE System SHALL cache the reference
2. THE cached references SHALL be stored as class properties
3. THE cache SHALL be invalidated only on disposal
4. THE ParasiteManager SHALL cache GameEngine, CameraController references
5. THE System SHALL eliminate redundant getInstance() calls in update loops

### Requirement 8: Mouse Move Handler Throttling

**User Story:** As a player, I want smooth FPS while moving my mouse, so that hovering over the game world doesn't cause performance drops.

#### Acceptance Criteria

1. THE handleMouseMove() method SHALL NOT call scene.pick() on every mouse move event
2. THE System SHALL throttle scene picking to at most 20Hz (every 50ms)
3. WHEN mouse moves rapidly, THE FPS SHALL remain above 55
4. THE tooltip responsiveness SHALL remain acceptable (< 100ms perceived delay)
5. THE System SHALL track lastMouseMoveCheckTime to implement throttling

### Requirement 9: Camera Traversal Per-Frame Allocation Elimination

**User Story:** As a player, I want smooth FPS while traversing the map with keyboard controls and rotating the camera, so that exploration doesn't cause performance stutters.

#### Acceptance Criteria

1. THE TreeRenderer.updateAnimations() SHALL NOT create new Vector3 objects every frame
2. THE System SHALL use Vector3.set() or copyFrom() to mutate existing scaling vectors
3. THE CameraController keyboard movement SHALL cache reusable Vector3 objects
4. THE GameEngine render loop SHALL cache arrays for workers, protectors, and mineral deposits
5. THE GameState.getAllMineralDeposits() SHALL support cached array access pattern
6. THE UnitManager.getUnitsByType() SHALL support cached array access pattern
7. WHEN traversing with 'W' key and rapid rotation, THE FPS SHALL remain above 50
8. THE per-frame object allocations SHALL be reduced by at least 90% (from ~4000 to <400)

### Requirement 10: Mining Operation Per-Frame Allocation Elimination

**User Story:** As a player, I want smooth FPS while workers are mining, so that resource gathering doesn't cause performance degradation.

#### Acceptance Criteria

1. THE MineralDeposit.updateVisual() SHALL NOT create new Vector3 objects every frame
2. THE System SHALL use mesh.scaling.set() to mutate existing scaling vectors
3. THE MineralDeposit.getPosition() SHALL return a reference or cached position, not a clone
4. THE Unit.getPosition() SHALL provide a non-allocating access method for internal use
5. THE MiningAction SHALL use copyFrom() instead of clone() for position updates
6. WHEN one worker is mining, THE FPS SHALL remain above 55
7. WHEN multiple workers are mining, THE FPS SHALL remain above 50
8. THE per-frame allocations during mining SHALL be reduced by at least 90%

### Requirement 11: Unit Rendering Per-Frame Allocation Elimination

**User Story:** As a player, I want smooth FPS during all unit activities (mining, moving, fleeing, combat), so that gameplay remains fluid regardless of unit actions.

#### Acceptance Criteria

1. THE UnitRenderer.updateUnitPosition() SHALL NOT create new Vector3 via clone() every frame
2. THE UnitRenderer.updateEnergyVisualization() SHALL NOT create new Vector3 for scaling every frame
3. THE UnitRenderer.updateHealthVisualization() SHALL NOT create new Vector3 for scaling every frame
4. THE UnitRenderer.getEnergyColor() SHALL NOT create new Color3 every frame
5. THE UnitRenderer.getProtectorEnergyColor() SHALL NOT create new Color3 every frame
6. THE MineralDeposit.updateVisual() SHALL NOT create new Color3 for emissiveColor every frame
7. THE System SHALL cache Color3 objects and use copyFrom() or direct property assignment
8. WHEN units are active (mining, moving, fleeing), THE FPS SHALL remain above 55
9. THE per-frame allocations in unit rendering SHALL be reduced by at least 90%

### Requirement 12: Parasite-Unit Interaction Map Allocation Elimination

**User Story:** As a player, I want smooth FPS during parasite-unit interactions (combat, fleeing, targeting), so that the game remains fluid during swarm encounters.

#### Acceptance Criteria

1. THE ParasiteManager.updateParasites() SHALL NOT create new Map objects every frame
2. THE System SHALL reuse cached Map<string, Worker> for worker lookups
3. THE System SHALL reuse cached Map<string, Protector> for protector lookups
4. THE cached Maps SHALL be cleared and repopulated rather than recreated
5. WHEN multiple parasites interact with units, THE FPS SHALL remain above 50
6. THE per-frame Map allocations SHALL be reduced from 2 per frame to 0

### Requirement 13: Visual Effect Beam/Ray Per-Frame Allocation Elimination

**User Story:** As a player, I want smooth FPS during combat and mining, so that visual effects (laser beams, drain rays, mining rays) don't cause performance degradation.

#### Acceptance Criteria

1. THE EnergyParasite.updateDrainBeam() SHALL NOT dispose and recreate the beam mesh every frame
2. THE CombatParasite.updateDrainBeam() SHALL NOT dispose and recreate the beam mesh every frame
3. THE UnitRenderer.updateMiningConnectionLine() SHALL NOT dispose and recreate the mining line every frame
4. THE System SHALL update existing mesh vertex positions instead of creating new meshes
5. THE System SHALL cache and reuse beam/ray materials instead of creating new ones each frame
6. THE System SHALL cache Color3 objects for beam colors
7. WHEN parasites are draining and workers are mining, THE FPS SHALL remain above 50
8. THE per-frame mesh/material allocations for beams SHALL be reduced from ~12 to 0

### Requirement 14: Mouse Hover and UI Update Allocation Elimination

**User Story:** As a player, I want smooth FPS while hovering over game elements, so that tooltips and info panels don't cause frame drops.

#### Acceptance Criteria

1. THE BuildingPlacementUI.handleMouseMove() SHALL be throttled to reduce string allocations
2. THE ProtectorSelectionUI.updateContent() SHALL use targeted DOM updates instead of full innerHTML replacement
3. THE EnergyLordsHUD SHALL update at a slower rate (reduce from 500ms to 1000ms)
4. THE EnergyLordsHUD SHALL cache gradient and color strings instead of recreating them
5. THE System SHALL eliminate string concatenation in loops (use arrays and join())
6. WHEN hovering over game elements, THE FPS SHALL remain above 50
7. THE per-frame string allocations during hover SHALL be reduced by at least 80%

### Requirement 15: Energy Display Consolidation

**User Story:** As a player, I want a cleaner UI where energy information is consolidated in the Energy Lord window, reducing redundant displays.

#### Acceptance Criteria

1. THE EnergyLordsHUD SHALL display total energy prominently
2. THE EnergyDisplay (top right bar) SHALL remove total energy display
3. THE EnergyDisplay SHALL keep delta percentage tracking displays (generation, consumption, efficiency, net rate)
4. THE consolidated display SHALL not increase update frequency or allocations

### Requirement 16: Parasite Segment Animation Per-Frame Allocation Elimination

**User Story:** As a player, I want smooth FPS during parasite combat encounters, so that multiple parasites don't cause performance degradation.

#### Acceptance Criteria

1. THE Parasite.updateSegmentAnimation() SHALL NOT create new Vector3 objects every frame
2. THE System SHALL cache Vector3 objects for segment positions as class members
3. THE System SHALL use Vector3.set() or copyFrom() to mutate existing vectors
4. THE System SHALL NOT call position.clone() in hot animation loops
5. THE System SHALL NOT call position.add() which creates new vectors - use addToRef() instead
6. WHEN 4-5 parasites are active in combat, THE FPS SHALL remain above 45
7. THE per-frame Vector3 allocations in parasite animation SHALL be reduced from ~50 to 0

### Requirement 17: BuildingRenderer Per-Frame Allocation Elimination

**User Story:** As a player, I want smooth FPS with multiple buildings on screen, so that base building doesn't cause performance issues.

#### Acceptance Criteria

1. THE BuildingRenderer animation methods SHALL NOT create new Vector3 for scaling every frame
2. THE BuildingRenderer SHALL NOT create new Color3 for emissive colors every frame
3. THE System SHALL cache Color3 and use direct r/g/b property assignment
4. THE System SHALL use mesh.scaling.set() instead of new Vector3 assignment
5. WHEN multiple buildings are animating, THE FPS SHALL remain above 50
6. THE per-frame allocations in building animation SHALL be reduced by at least 90%

### Requirement 18: CameraController Movement Per-Frame Allocation Elimination

**User Story:** As a player, I want smooth FPS during camera movement with WASD keys, so that map navigation doesn't cause performance stutters.

#### Acceptance Criteria

1. THE CameraController keyboard movement SHALL NOT call Vector3.Forward()/Backward() which create new vectors
2. THE CameraController SHALL cache direction vectors as class members
3. THE System SHALL use getDirectionToRef() if available, or cache and transform existing vectors
4. WHEN moving camera with WASD during combat, THE FPS SHALL remain above 50
5. THE per-frame Vector3 allocations during camera movement SHALL be reduced from 4 to 0

### Requirement 19: Mouse Move Scene.pick() Elimination via Click-Based Tooltips

**User Story:** As a player, I want smooth FPS during mouse movement, so that camera rotation and cursor positioning don't cause performance dips.

#### Acceptance Criteria

1. THE GameEngine.handleMouseMove() SHALL be removed entirely (no scene.pick() on mouse move)
2. THE Protector tooltip SHALL be displayed on right-click instead of hover
3. THE MiningAnalysisTooltip SHALL use correct PointerEventTypes.POINTERDOWN (was using wrong value 4 = POINTERMOVE)
4. THE MiningAnalysisTooltip SHALL be displayed on right-click only (consistent with Protector tooltip)
5. BOTH tooltips SHALL hide when left-clicking elsewhere
6. THE mouse movement FPS impact SHALL be eliminated (no scene.pick() on POINTERMOVE)
7. WHEN moving mouse during combat, THE FPS SHALL remain stable (no dips from scene.pick())

### Requirement 20: Memory Leak Prevention - Interval and Callback Cleanup

**User Story:** As a player, I want stable FPS during extended gameplay sessions with increasing difficulty, so that longer games don't degrade in performance over time.

#### Acceptance Criteria

1. THE MiningUI SHALL store setInterval ID and clear it on dispose
2. THE ProtectorCreationUI SHALL store setInterval ID and clear it on dispose
3. THE DifficultyDisplayUI SHALL store compact display setInterval ID and clear it on destroy
4. THE CameraController SHALL store registerBeforeRender callback and unregister it on dispose
5. THE CameraController SHALL store keydown/keyup event handlers and remove them on dispose
6. ALL intervals and callbacks SHALL be cleaned up when components are disposed
7. WHEN playing extended sessions (30+ minutes), THE FPS SHALL NOT degrade due to accumulated intervals/callbacks
8. THE System SHALL NOT accumulate duplicate intervals when UI components are recreated

### Requirement 21: Parasite Segment Animation Per-Frame Allocation Elimination

**User Story:** As a player, I want smooth FPS when parasites are chasing and attacking my units, especially at ground-level camera angles, so that combat encounters don't cause performance degradation.

#### Acceptance Criteria

1. THE Parasite.updateSegmentAnimation() SHALL NOT call Vector3.Zero() every frame
2. THE Parasite.updateSegmentAnimation() SHALL NOT call position.clone() every frame
3. THE Parasite.updateSegmentAnimation() SHALL NOT create new Vector3 for segment positions every frame
4. THE Parasite.updateSegmentAnimation() SHALL NOT create new Vector3 for worldOffset every frame
5. THE Parasite.updateSegmentAnimation() SHALL NOT call position.add() which creates new Vector3 every frame
6. THE System SHALL use position.set() to mutate existing segment position vectors
7. THE System SHALL use copyFrom() to update segmentPositions array
8. THE System SHALL use addToRef() instead of add() for world position calculation
9. THE System SHALL cache a reusable worldOffset Vector3 as a class member
10. WHEN 5+ parasites are actively chasing units at ground-level camera, THE FPS SHALL remain above 50
11. THE per-frame Vector3 allocations in parasite animation SHALL be reduced from ~18 per parasite to 0

### Requirement 22: ParasiteManager updateParasites Per-Frame Allocation Elimination

**User Story:** As a player, I want smooth FPS when my units spread out across the map and parasites are chasing them, so that territorial expansion doesn't cause performance degradation that scales with spread distance.

#### Acceptance Criteria

1. THE ParasiteManager.updateParasites() SHALL NOT create new arrays from .map() every frame
2. THE ParasiteManager.updateParasites() SHALL NOT create new arrays from .filter() every frame
3. THE ParasiteManager.updateParasites() SHALL NOT call getPosition() (which clones) for spatial index updates every frame
4. THE System SHALL cache and reuse nearbyWorkers and nearbyProtectors arrays
5. THE System SHALL use getPositionRef() instead of getPosition() for spatial index updates
6. THE System SHALL clear and refill cached arrays instead of creating new ones
7. THE per-parasite loop SHALL NOT create 6+ array allocations per iteration
8. WHEN 10+ parasites are actively chasing spread-out units, THE FPS SHALL remain above 50
9. THE per-frame array allocations in updateParasites() SHALL be reduced from ~7 per parasite to 0
10. THE System SHALL scale efficiently regardless of unit/parasite spread distance

### Requirement 23: Tree Glow Animation GPU Optimization

**User Story:** As a player, I want smooth FPS at ground-level camera angles with many trees visible, so that exploring the terrain doesn't cause performance degradation.

#### Acceptance Criteria

1. THE TreeRenderer SHALL NOT iterate over all trees in JavaScript every frame
2. THE tree glow pulsing animation SHALL be handled by GPU shaders instead of CPU
3. THE glow spot meshes SHALL use Babylon.js thin instances for efficient rendering
4. THE System SHALL use a single ShaderMaterial shared across all glow spot instances
5. THE shader SHALL receive a time uniform updated once per frame
6. THE shader SHALL calculate glow pulsing per-vertex using sine wave
7. THE per-frame CPU cost of tree animations SHALL be reduced from O(n×m) to O(1) where n=trees, m=spots
8. WHEN 400+ trees are loaded at ground-level camera, THE FPS SHALL remain above 55
9. THE System SHALL use instanced rendering to minimize draw calls for glow spots
10. THE updateAnimations() method SHALL only update the time uniform, not iterate meshes

