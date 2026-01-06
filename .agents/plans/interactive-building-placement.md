# US-006: Interactive Building Placement System

**User Story**: As a player, I want to interactively place buildings (bases and power plants) in the 3D world so that I can strategically expand my operations with visual feedback and energy cost validation.

**Epic**: Core Game Engine  
**Priority**: P0 (Must Have)  
**Estimate**: 6 hours  
**Dependencies**: US-001 (3D Foundation), US-003 (Energy System), US-005 (Building System)

## Acceptance Criteria

### Primary Functionality
- [x] **Building Selection UI**: Player can select "Build Base" or "Build Power Plant" from a UI panel
- [x] **3D Preview System**: Mouse movement shows a transparent preview of the building in the 3D world
- [x] **Interactive Placement**: Click to place the building at the mouse cursor location
- [x] **Energy Cost Validation**: System checks and consumes energy before allowing placement
- [x] **Visual Feedback**: Preview changes color (green/red) based on placement validity
- [x] **Placement Cancellation**: Player can cancel placement mode and return to normal view

### Technical Requirements
- [x] **Mouse-to-World Mapping**: Accurate conversion from 2D mouse to 3D world coordinates
- [x] **Preview Rendering**: Wireframe/transparent building preview that doesn't interfere with gameplay
- [x] **Energy Integration**: Real-time energy cost checking and consumption
- [x] **UI State Management**: Clean transitions between normal and placement modes
- [x] **Performance**: 60fps maintained during preview and placement operations

### User Experience
- [x] **Intuitive Controls**: Clear visual cues for placement mode activation/deactivation
- [x] **Error Handling**: Clear feedback for insufficient energy or invalid placement
- [x] **SciFi Aesthetics**: UI matches the game's futuristic design language
- [x] **Responsive Feedback**: Immediate visual response to user actions

## Implementation Plan

### Phase 1: Core Building Placement UI (2h)
**Goal**: Create the building selection interface and basic UI structure

**Tasks**:
1. **Create BuildingPlacementUI class** (45min)
   - UI panel with building selection buttons
   - SciFi styling consistent with energy HUD
   - Button states and hover effects
   - Energy cost display per building type

2. **Integrate with GameEngine** (30min)
   - Add BuildingPlacementUI to main application
   - Create UI container in HTML
   - Initialize after game engine startup
   - Connect to existing building and energy systems

3. **Basic State Management** (45min)
   - Track placement mode state
   - Handle building type selection
   - UI state transitions (normal ↔ placement mode)
   - Cancel placement functionality

**Validation Commands**:
```bash
npm run dev
# Check UI appears in browser
# Verify buttons are clickable and styled correctly
# Confirm state transitions work
```

### Phase 2: 3D Preview System (2h)
**Goal**: Implement mouse-to-world mapping and building preview visualization

**Tasks**:
1. **Mouse Interaction Setup** (45min)
   - Babylon.js pointer event handling
   - Mouse position to 3D world coordinate conversion
   - Ray casting for ground intersection
   - Smooth preview positioning

2. **Preview Mesh Creation** (45min)
   - Generate wireframe preview meshes for each building type
   - Transparent materials with color coding
   - Proper positioning and scaling
   - Non-pickable preview objects

3. **Real-time Preview Updates** (30min)
   - Update preview position on mouse move
   - Smooth preview mesh transitions
   - Handle edge cases (mouse outside world, etc.)
   - Performance optimization for continuous updates

**Validation Commands**:
```bash
# In browser console:
# 1. Click "Build Base" button
# 2. Move mouse around 3D world
# 3. Verify preview follows mouse cursor
# 4. Check preview appears at correct world positions
```

### Phase 3: Placement Logic & Validation (2h) ✅ COMPLETE
**Goal**: Implement building placement with energy costs and validation

**Tasks**:
1. **Placement Validation System** (45min) ✅
   - ✅ Check building placement rules
   - ✅ Validate energy requirements
   - ✅ Terrain suitability checks
   - ✅ Distance from other buildings validation

2. **Energy Integration** (45min) ✅
   - ✅ Real-time energy cost checking
   - ✅ Energy consumption on successful placement
   - ✅ Error handling for insufficient energy
   - ✅ Visual feedback for energy status

3. **Building Creation & Cleanup** (30min) ✅
   - ✅ Create actual building on successful placement
   - ✅ Remove preview mesh after placement
   - ✅ Reset UI to normal state
   - ✅ Update game state and energy display

**Validation Commands**:
```bash
# In browser console:
testEnergySystem() # Check initial energy
# 1. Place a base (should consume 50J)
# 2. Check energy decreased
# 3. Try placing without enough energy
# 4. Verify error handling
```

**Implementation Status**: ✅ COMPLETE
- All placement logic implemented in `handleMouseClick` method
- Energy validation and consumption working
- GameState integration functional
- UI state management complete

## Technical Architecture

### Core Components
```typescript
BuildingPlacementUI
├── UI Management
│   ├── Building selection buttons
│   ├── Status text and feedback
│   └── Cancel placement controls
├── 3D Preview System
│   ├── Preview mesh creation
│   ├── Mouse-to-world mapping
│   └── Visual feedback (colors)
├── Placement Logic
│   ├── Position validation
│   ├── Energy cost checking
│   └── Building creation
└── State Management
    ├── Placement mode tracking
    ├── UI state transitions
    └── Event handling
```

### Integration Points
- **GameEngine**: Main application integration
- **BuildingManager**: Building creation and management
- **EnergyManager**: Cost validation and consumption
- **Scene**: 3D preview rendering and mouse interaction
- **GameState**: Building placement and world state updates

### File Structure
```
client/src/ui/BuildingPlacementUI.ts    # Main placement system
client/src/main.ts                      # Integration with app
client/public/index.html                # UI container
```

## Success Criteria

### Functional Validation
- [ ] **Building Selection**: Can select base or power plant from UI
- [ ] **3D Preview**: Preview appears and follows mouse in 3D world
- [ ] **Placement**: Click places building at cursor location
- [ ] **Energy Costs**: Energy is consumed correctly (Base: 50J, Power Plant: 75J)
- [ ] **Validation**: Cannot place with insufficient energy
- [ ] **Visual Feedback**: Preview color indicates placement validity

### Performance Validation
- [ ] **60fps Maintained**: No frame drops during preview or placement
- [ ] **Smooth Interactions**: Responsive mouse tracking and UI updates
- [ ] **Memory Management**: No memory leaks from preview meshes

### User Experience Validation
- [ ] **Intuitive Controls**: Clear what each button does
- [ ] **Visual Clarity**: Easy to see where building will be placed
- [ ] **Error Feedback**: Clear messages for placement failures
- [ ] **SciFi Aesthetics**: UI matches game's visual style

## Git Workflow

### Branch Strategy
```bash
git checkout develop
git checkout -b feature/US-006-interactive-building-placement
# Implement Phase 1
git add . && git commit -m "feat: US-006 Phase 1 - Building placement UI"
# Implement Phase 2  
git add . && git commit -m "feat: US-006 Phase 2 - 3D preview system"
# Implement Phase 3
git add . && git commit -m "feat: US-006 Phase 3 - Placement logic complete"
# Final commit
git add . && git commit -m "feat: US-006 - Interactive building placement system complete"
git checkout develop
git merge --no-ff feature/US-006-interactive-building-placement
git branch -d feature/US-006-interactive-building-placement
git push origin develop
```

### Commit Message Format
```
feat: US-006 - [Phase/Component] - [Brief description]

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
- [ ] UI appears correctly after game loads
- [ ] Building buttons are clickable and responsive
- [ ] Preview appears when entering placement mode
- [ ] Preview follows mouse cursor accurately
- [ ] Preview color changes based on validity
- [ ] Click places building at correct location
- [ ] Energy is consumed correctly
- [ ] Error messages appear for invalid placements
- [ ] Cancel button exits placement mode
- [ ] UI returns to normal state after placement

### Browser Console Testing
```javascript
// Test energy and placement integration
testEnergySystem()
testBuildingSystem()

// Manual placement testing
// 1. Click "Build Base" in UI
// 2. Move mouse around world
// 3. Click to place
// 4. Verify energy consumption
```

### Performance Testing
- Monitor FPS during preview mode
- Check memory usage with multiple previews
- Validate smooth mouse tracking
- Test with multiple building placements

## Risk Mitigation

### Technical Risks
- **Mouse-to-World Accuracy**: Use Babylon.js ray casting for precise positioning
- **Performance Impact**: Optimize preview mesh updates and disposal
- **Energy System Integration**: Thorough testing of cost validation
- **UI State Conflicts**: Clear state management and error handling

### User Experience Risks
- **Confusing Controls**: Clear visual feedback and status messages
- **Placement Errors**: Comprehensive validation and error messages
- **Visual Clarity**: High contrast preview colors and clear UI design

## Future Enhancements (Out of Scope)
- Multiple building selection
- Building rotation
- Advanced placement validation (terrain analysis)
- Building upgrade UI
- Batch building placement
- Keyboard shortcuts

---

**Ready for Implementation**: All dependencies met, clear acceptance criteria defined, technical approach validated.