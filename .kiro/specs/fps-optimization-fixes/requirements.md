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

