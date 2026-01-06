# Worker Mining Assignment System - Implementation Plan

## Overview
Implement a click-based system where players can assign workers to mineral deposits for automated mining operations. This completes the core economic loop: workers → mining → energy generation → more workers.

## User Story
**US-007C: Worker Mining Assignment**
As a player, I want to assign workers to mineral deposits so that they automatically mine resources and generate energy for my economy.

## Acceptance Criteria
- [ ] Click on a worker to select it (visual selection indicator)
- [ ] Click on a mineral deposit while worker is selected to assign mining
- [ ] Worker moves to mineral deposit and starts mining automatically
- [ ] Mining generates energy over time and adds to global energy pool
- [ ] Visual feedback shows worker is mining (animation or indicator)
- [ ] Worker can be reassigned to different mineral deposits
- [ ] Multiple workers can mine the same deposit (up to capacity limit)
- [ ] UI shows mining status and energy generation rate

## Technical Implementation

### Phase 1: Worker Selection System (1 hour)
**Goal**: Implement click-to-select workers with visual feedback

**Components to modify:**
- `UnitRenderer.ts` - Add selection visualization
- `UnitManager.ts` - Handle unit selection logic
- `GameEngine.ts` - Add mouse click handling for unit selection

**Implementation:**
1. Add mouse click detection for units
2. Implement selection state management
3. Add visual selection indicator (glowing outline or ring)
4. Handle single worker selection (deselect others)

### Phase 2: Mining Assignment System (1.5 hours)
**Goal**: Implement click-on-deposit-to-assign-mining functionality

**Components to modify:**
- `Worker.ts` - Add mining assignment and pathfinding
- `MineralDeposit.ts` - Add worker assignment tracking
- `GameEngine.ts` - Handle deposit click when worker selected

**Implementation:**
1. Add mining assignment logic to Worker class
2. Implement simple pathfinding (direct line movement)
3. Add worker capacity tracking to mineral deposits
4. Handle mining state transitions (idle → moving → mining)

### Phase 3: Automated Mining Operations (1 hour)
**Goal**: Workers automatically mine and generate energy

**Components to modify:**
- `Worker.ts` - Add mining loop and energy generation
- `EnergyManager.ts` - Handle mining energy generation
- `MineralDeposit.ts` - Handle resource depletion

**Implementation:**
1. Implement mining animation/action loop
2. Connect mining to energy generation system
3. Handle mineral deposit depletion
4. Add mining efficiency and rate calculations

### Phase 4: Visual Feedback and Polish (0.5 hours)
**Goal**: Clear visual indicators for mining operations

**Components to modify:**
- `UnitRenderer.ts` - Add mining animation/indicators
- `MineralDeposit.ts` - Add visual mining effects

**Implementation:**
1. Add mining animation (bobbing, rotation, or particles)
2. Show energy generation numbers/effects
3. Visual connection between worker and deposit
4. Mining status indicators

## Technical Details

### Worker Selection
```typescript
// In UnitManager.ts
public selectWorker(workerId: string): void {
    this.clearSelection();
    const worker = this.getUnit(workerId);
    if (worker) {
        worker.setSelected(true);
        this.selectedWorker = worker;
    }
}
```

### Mining Assignment
```typescript
// In Worker.ts
public assignToMineralDeposit(deposit: MineralDeposit): boolean {
    if (deposit.canAcceptWorker()) {
        this.currentTarget = deposit;
        this.currentAction = 'moving_to_mine';
        this.moveToPosition(deposit.getPosition());
        return true;
    }
    return false;
}
```

### Energy Generation
```typescript
// In Worker.ts mining loop
private performMining(deltaTime: number): void {
    if (this.currentTarget && this.currentAction === 'mining') {
        const energyMined = this.currentTarget.mine(deltaTime * this.miningRate);
        if (energyMined > 0) {
            this.energyManager.generateEnergy(this.id, energyMined, 'worker_mining');
        }
    }
}
```

## User Experience Flow
1. **Worker Creation**: Player creates workers using workforce panel
2. **Worker Selection**: Player clicks on a worker (worker gets selection indicator)
3. **Mining Assignment**: Player clicks on mineral deposit (worker moves to deposit)
4. **Automatic Mining**: Worker reaches deposit and starts mining automatically
5. **Energy Generation**: Mining generates energy visible in energy bar
6. **Reassignment**: Player can select worker again and assign to different deposit

## Performance Considerations
- Limit pathfinding calculations (simple direct movement for now)
- Batch energy generation updates (every 0.5 seconds instead of every frame)
- Efficient worker-deposit distance calculations
- Visual effect optimization (reuse particles/animations)

## Testing Strategy
1. **Unit Tests**: Worker selection, mining assignment, energy generation
2. **Integration Tests**: Full mining workflow from selection to energy
3. **Performance Tests**: Multiple workers mining simultaneously
4. **User Experience Tests**: Click responsiveness, visual feedback clarity

## Success Metrics
- Workers can be selected and assigned within 2 clicks
- Mining generates visible energy increase within 3 seconds
- System maintains 60fps with 10+ workers mining
- Clear visual feedback for all mining states
- Intuitive user interaction flow

## Future Enhancements (Not in this implementation)
- Advanced pathfinding around obstacles
- Mining efficiency upgrades
- Worker specialization (different mining rates)
- Deposit quality variations
- Mining equipment/tools system

## Dependencies
- ✅ Worker creation system (completed)
- ✅ Mineral deposit system (completed)  
- ✅ Energy management system (completed)
- ✅ Unit rendering system (completed)

## Risk Mitigation
- **Mouse click conflicts**: Ensure proper event handling priority
- **Performance with many workers**: Implement efficient update loops
- **Visual clarity**: Clear selection and mining state indicators
- **User confusion**: Intuitive click-to-assign workflow

---

**Ready for implementation!** All dependencies are complete and the system design is clear.