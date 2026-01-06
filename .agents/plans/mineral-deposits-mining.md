# US-007: Mineral Deposits and Mining Mechanics

**User Story**: As a player, I want to mine mineral deposits with my workers to generate energy so that I can sustain and expand my operations beyond the initial energy allocation.

**Epic**: Core Game Engine  
**Priority**: P0 (Must Have)  
**Estimate**: 4 hours  
**Dependencies**: US-002 (Terrain), US-003 (Energy), US-004 (Units) - all complete

## Acceptance Criteria

### Primary Functionality
- [ ] **Mineral Deposits**: Light blue crystal deposits appear scattered across terrain
- [ ] **Worker Mining**: Workers can be assigned to mine specific deposits
- [ ] **Energy Generation**: Mining generates energy over time (1.5-2.5 energy/second)
- [ ] **Deposit Depletion**: Deposits have finite capacity and become depleted
- [ ] **Visual Feedback**: Mining progress and deposit status clearly visible
- [ ] **UI Integration**: Simple mining assignment through click interactions

### Technical Requirements
- [ ] **Deposit Generation**: Procedural placement of deposits across terrain chunks
- [ ] **Mining Actions**: Worker-deposit interaction system
- [ ] **Energy Integration**: Mining energy flows into global energy system
- [ ] **Performance**: 60fps maintained with active mining operations
- [ ] **Visual Polish**: Low poly crystal aesthetic matching game style

### User Experience
- [ ] **Intuitive Controls**: Click worker, click deposit to start mining
- [ ] **Clear Feedback**: Visual indicators for mining status and progress
- [ ] **Strategic Depth**: Deposit placement encourages exploration and expansion
- [ ] **Resource Management**: Finite deposits create strategic decisions

## Implementation Plan

### Phase 1: Mineral Deposit System (1.5h)
**Goal**: Create mineral deposits that appear in the world

**Tasks**:
1. **Re-enable Mineral Generation** (30min)
   - Uncomment mineral deposit generation in TerrainGenerator
   - Adjust deposit density and distribution
   - Ensure deposits appear on terrain surface

2. **Visual Polish** (45min)
   - Update mineral deposit appearance (light blue crystals)
   - Improve crystal geometry for low poly aesthetic
   - Add subtle glow/emissive materials
   - Position deposits properly on terrain

3. **Deposit Properties** (15min)
   - Set capacity ranges (20-80 energy per deposit)
   - Configure extraction rates (1.5-2.5 energy/second)
   - Add biome-based variations

**Validation Commands**:
```bash
npm run dev
# Check deposits appear in world
# Verify crystal appearance and positioning
# Confirm deposit stats in console: showTerrainStats()
```

### Phase 2: Worker Mining System (1.5h)
**Goal**: Enable workers to mine deposits and generate energy

**Tasks**:
1. **Mining Action Implementation** (45min)
   - Create MiningAction class for worker-deposit interaction
   - Implement mining state management
   - Add mining progress tracking
   - Handle deposit depletion

2. **Worker-Deposit Assignment** (30min)
   - Add mining assignment to Worker class
   - Implement pathfinding to deposit location
   - Create mining animation/visual feedback
   - Handle mining interruption and cancellation

3. **Energy Flow Integration** (15min)
   - Connect mining output to EnergyManager
   - Ensure energy generation appears in UI
   - Add mining statistics tracking

**Validation Commands**:
```bash
# In browser console:
testUnitActions() # Should show mining functionality
# Manually assign worker to deposit
# Verify energy increases over time
```

### Phase 3: UI and Interaction System (1h)
**Goal**: Implement user interface for mining operations

**Tasks**:
1. **Click-to-Mine Interface** (30min)
   - Add deposit selection highlighting
   - Implement worker selection system
   - Create mining assignment on click
   - Add visual feedback for assignments

2. **Mining Status Display** (20min)
   - Show mining progress indicators
   - Display deposit capacity/remaining
   - Add worker status (mining/idle)
   - Update energy generation rate in UI

3. **Polish and Testing** (10min)
   - Test complete mining workflow
   - Verify performance with multiple miners
   - Check edge cases (deposit depletion, worker death)
   - Ensure UI responsiveness

**Validation Commands**:
```bash
# Complete workflow test:
# 1. Click worker to select
# 2. Click deposit to assign mining
# 3. Watch energy increase
# 4. Verify deposit depletion
```

## Technical Architecture

### Core Components
```typescript
MineralDeposit (existing)
├── Visual representation (light blue crystals)
├── Capacity and extraction rate
├── Mining progress tracking
└── Depletion handling

MiningAction (new)
├── Worker-deposit binding
├── Mining progress calculation
├── Energy generation over time
└── Completion/interruption handling

Worker (enhanced)
├── Mining assignment capability
├── Pathfinding to deposits
├── Mining animation state
└── Mining status reporting

UI System (enhanced)
├── Deposit selection highlighting
├── Worker selection system
├── Mining assignment interface
└── Status display updates
```

### Integration Points
- **TerrainGenerator**: Re-enable mineral deposit generation
- **EnergyManager**: Receive mining energy generation
- **Worker**: Add mining capability and assignment
- **GameState**: Track mining operations and statistics
- **UI**: Mining assignment and status display

### File Structure
```
client/src/game/actions/MiningAction.ts     # New mining action class
client/src/game/entities/Worker.ts          # Enhanced with mining
client/src/rendering/TerrainGenerator.ts    # Re-enable deposits
client/src/ui/MiningUI.ts                   # New mining interface
client/src/world/MineralDeposit.ts          # Enhanced visual polish
```

## Success Criteria

### Functional Validation
- [ ] **Deposit Appearance**: Light blue crystals visible across terrain
- [ ] **Mining Assignment**: Click worker → click deposit → mining starts
- [ ] **Energy Generation**: Energy increases during mining operations
- [ ] **Deposit Depletion**: Deposits disappear when fully mined
- [ ] **Multiple Workers**: Multiple workers can mine simultaneously
- [ ] **UI Feedback**: Clear status indicators for all mining operations

### Performance Validation
- [ ] **60fps Maintained**: No frame drops with active mining
- [ ] **Memory Management**: No memory leaks from mining operations
- [ ] **Scalability**: Performance good with 5+ simultaneous mining operations

### User Experience Validation
- [ ] **Intuitive Controls**: Mining assignment feels natural
- [ ] **Visual Clarity**: Easy to see mining status and progress
- [ ] **Strategic Depth**: Deposit placement encourages exploration
- [ ] **Feedback Loop**: Clear connection between mining and energy gain

## Git Workflow

### Branch Strategy
```bash
git checkout develop
git checkout -b feature/US-007-mineral-deposits-mining
# Implement Phase 1
git add . && git commit -m "feat: US-007 Phase 1 - Mineral deposit generation and visuals"
# Implement Phase 2  
git add . && git commit -m "feat: US-007 Phase 2 - Worker mining system and energy integration"
# Implement Phase 3
git add . && git commit -m "feat: US-007 Phase 3 - Mining UI and interaction system"
# Final commit
git add . && git commit -m "feat: US-007 - Complete mineral deposits and mining system"
git checkout develop
git merge --no-ff feature/US-007-mineral-deposits-mining
git branch -d feature/US-007-mineral-deposits-mining
git push origin develop
```

### Commit Message Format
```
feat: US-007 - [Phase/Component] - [Brief description]

- [Technical implementation details]
- [Features added]
- [Integration points]
- [Performance considerations]

Acceptance Criteria: [List completed criteria]
Testing: [Validation commands used]
Performance: [60fps maintained/memory usage]

Ready for: [Next phase or completion]
```

## Testing Strategy

### Manual Testing Checklist
- [ ] Mineral deposits appear across different terrain biomes
- [ ] Deposits have correct visual appearance (light blue crystals)
- [ ] Worker selection and mining assignment works
- [ ] Energy generation increases during mining
- [ ] Deposits deplete and disappear when fully mined
- [ ] Multiple workers can mine simultaneously
- [ ] UI shows correct mining status and progress
- [ ] Performance remains smooth with active mining

### Browser Console Testing
```javascript
// Test deposit generation
showTerrainStats() // Should show mineral deposits

// Test mining system
testUnitActions() // Should show mining functionality

// Test energy integration
testEnergySystem() // Should show energy generation from mining
```

### Performance Testing
- Monitor FPS during mining operations
- Check memory usage with multiple active miners
- Validate smooth deposit generation across chunks
- Test mining assignment responsiveness

## Risk Mitigation

### Technical Risks
- **Performance Impact**: Optimize mining calculations and visual updates
- **Memory Leaks**: Proper disposal of mining actions and deposit references
- **UI Responsiveness**: Efficient selection and assignment systems
- **Energy Integration**: Thorough testing of energy flow and calculations

### User Experience Risks
- **Confusing Controls**: Clear visual feedback and intuitive interactions
- **Deposit Visibility**: High contrast crystals easy to spot on terrain
- **Mining Feedback**: Clear progress indicators and status messages

## Future Enhancements (Out of Scope)
- Advanced mining equipment and upgrades
- Deposit quality variations and rare minerals
- Mining efficiency research and improvements
- Automated mining assignment and management
- Mining convoy and transport systems

---

**Ready for Implementation**: All dependencies met, clear acceptance criteria defined, technical approach validated.