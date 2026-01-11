# Base Placement Mining Preview System - Implementation Plan

## Feature Overview
Enhance base placement system with strategic mining range visualization and worker spawning mechanics.

## User Story Enhancement
**Enhancement to US-006**: Base Placement Strategic Preview System
- **Goal**: Transform base placement from simple positioning to strategic decision-making
- **Core Mechanic**: Show mining potential during base placement preview
- **Strategic Depth**: Players must consider mineral node proximity for optimal base positioning

## Acceptance Criteria
1. **Base Placement Preview Enhancement**:
   - Click terrain → Show base preview with mining range indicators
   - Proximity-based mineral node range display (show when mouse near nodes)
   - Distance measurements and reachability feedback
   - "X workers can mine here" text indicator
   - Green/yellow/red base preview based on mining efficiency

2. **10-Worker Spawning System**:
   - Base placement spawns exactly 10 workers (no more, no less)
   - Workers positioned 3 units in front of base in formation
   - Workers start with full energy (original energy validation restored)
   - Automatic mining assignment if nodes within range

3. **Proximity-Based Range Display**:
   - Show dotted circles around mineral nodes when mouse approaches
   - Display distance measurements during base placement
   - Range indicators fade when mouse moves away
   - Clean UI without permanent visual clutter

## Technical Implementation Plan

### Phase 1: Base Placement Preview Enhancement [2h]
**Files to Modify:**
- `client/src/ui/BuildingPlacementUI.ts` - Enhanced preview system
- `client/src/rendering/TerrainGenerator.ts` - Mineral node proximity detection
- `client/src/game/GameEngine.ts` - Mouse proximity tracking

**Implementation Steps:**
1. **Proximity Detection System**:
   ```typescript
   // In BuildingPlacementUI.ts
   private checkMineralProximity(basePosition: Vector3): MiningAnalysis {
     // Get all mineral nodes within reasonable distance
     // Calculate which nodes are within worker mining range
     // Return analysis: reachableNodes, workerCount, efficiency
   }
   ```

2. **Visual Range Indicators**:
   ```typescript
   // Create dotted circles around reachable mineral nodes
   private showMiningRangeIndicators(analysis: MiningAnalysis): void {
     // Dotted circle materials
     // Distance measurement lines
     // Text overlays for worker count
   }
   ```

3. **Base Preview Color Coding**:
   ```typescript
   // Green: 8-10 workers can mine
   // Yellow: 4-7 workers can mine  
   // Red: 0-3 workers can mine
   private updateBasePreviewColor(efficiency: number): void
   ```

### Phase 2: 10-Worker Spawning System [1.5h]
**Files to Modify:**
- `client/src/game/GameState.ts` - Worker spawning logic
- `client/src/game/UnitManager.ts` - Formation positioning
- `client/src/ui/BuildingPlacementUI.ts` - Integration with base placement

**Implementation Steps:**
1. **Worker Formation System**:
   ```typescript
   // In GameState.ts
   private spawnWorkersForBase(basePosition: Vector3): GameUnit[] {
     const workers: GameUnit[] = [];
     const formationPositions = this.calculateWorkerFormation(basePosition);
     
     for (let i = 0; i < 10; i++) {
       const worker = this.createUnit('worker', formationPositions[i]);
       workers.push(worker);
     }
     return workers;
   }
   ```

2. **Formation Positioning**:
   ```typescript
   // Semi-circle formation 3 units in front of base
   private calculateWorkerFormation(basePosition: Vector3): Vector3[] {
     // Calculate 10 positions in semi-circle
     // 3 units away from base
     // Facing outward toward mineral nodes
   }
   ```

3. **Automatic Mining Assignment**:
   ```typescript
   // Auto-assign workers to nearby mineral nodes
   private autoAssignMining(workers: GameUnit[], basePosition: Vector3): void {
     // Find reachable mineral nodes
     // Assign workers to closest nodes
     // Balance worker distribution
   }
   ```

### Phase 3: Proximity-Based UI System [1h]
**Files to Modify:**
- `client/src/game/GameEngine.ts` - Mouse tracking system
- `client/src/rendering/MaterialManager.ts` - Dotted line materials
- `client/src/ui/BuildingPlacementUI.ts` - Dynamic UI updates

**Implementation Steps:**
1. **Mouse Proximity Tracking**:
   ```typescript
   // In GameEngine.ts
   private trackMouseProximityToMinerals(): void {
     // Raycast from mouse to terrain
     // Check distance to all mineral nodes
     // Trigger UI updates when within proximity threshold
   }
   ```

2. **Dynamic Range Visualization**:
   ```typescript
   // Show/hide range indicators based on proximity
   private updateProximityUI(nearbyNodes: MineralDeposit[]): void {
     // Create dotted circles for nearby nodes
     // Show distance measurements
     // Fade out when mouse moves away
   }
   ```

## Energy System Integration
**Restore Original Energy Validation:**
- Remove temporary energy check bypasses from MovementAction.ts and MiningAction.ts
- Workers spawn with full energy (10/10) as originally designed
- Energy validation works correctly with strategic base placement
- Players must place bases near mineral nodes for workers to mine effectively

## Testing Strategy
1. **Base Placement Testing**:
   - Test base preview with various mineral node configurations
   - Verify color coding accuracy (green/yellow/red)
   - Test proximity-based range display activation/deactivation

2. **Worker Spawning Testing**:
   - Verify exactly 10 workers spawn per base
   - Test formation positioning (3 units away, semi-circle)
   - Test automatic mining assignment for reachable nodes

3. **Energy System Testing**:
   - Verify workers start with full energy (10/10)
   - Test mining assignment with original energy validation
   - Confirm energy generation loop works with strategic placement

## Performance Considerations
- **Proximity Detection**: Optimize distance calculations for real-time mouse tracking
- **Visual Effects**: Efficient dotted line rendering and material management
- **Worker Spawning**: Batch creation to maintain 60fps during base placement
- **Memory Management**: Proper disposal of temporary UI elements

## Git Workflow
1. **Feature Branch**: `feature/base-placement-mining-preview`
2. **Implementation Phases**: Separate commits for each phase
3. **Testing**: Comprehensive testing before merge
4. **Documentation**: Update DEVLOG with implementation details

## Success Metrics
- **Strategic Depth**: Base placement becomes meaningful strategic decision
- **User Experience**: Clear visual feedback for mining potential
- **Performance**: 60fps maintained during all preview operations
- **Energy Economy**: Original energy validation works with strategic placement
- **Worker Management**: Exactly 10 workers per base, proper formation positioning

## Ready for Implementation
All dependencies met:
- ✅ Building placement system (US-006) complete
- ✅ Mineral deposits system (US-007) complete  
- ✅ Worker system and energy economy functional
- ✅ Mouse interaction system established

**Estimated Time**: 4.5 hours total
**Priority**: P0 (Critical for strategic gameplay)
**Dependencies**: None (all systems ready)