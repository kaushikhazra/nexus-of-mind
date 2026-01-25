# Visual Design Concepts - Nexus of Mind

**Date**: January 5, 2026  
**Status**: Initial visual brainstorming session  
**Next Step**: Organize into formal art direction document  

## Art Direction & Theme

### SciFi Aesthetic
- **Setting**: Alien planet with radioactive mineral deposits
- **Tone**: Clean futuristic with industrial elements
- **Color Palette**: Vibrant primary colors for units/buildings, natural earth tones for environment
- **Visual Style**: Low poly geometric design with flat shading and minimal textures

## Visual Elements

### Units
- **Workers**: Green spheres (details to be added later)
- **Scouts**: Blue spheres
- **Protectors**: Red spheres

### Buildings
- **Base**: Yellow pyramid
- **Power Plants**: Orange semi-cylinder

### Environment
- **Terrain**: Low poly landscape with varied colors
  - Shades of green (vegetation areas)
  - Sand yellow (desert/arid regions)
  - Mud brown (rocky/barren areas)
- **Mineral Deposits**: Light blue, low poly stone-shaped crystals
- **Flora & Fauna**: Low poly vegetation
  - Shades of green for leaves/foliage
  - Brown stems where needed
- **World Generation**: Infinite procedurally generated scene
  - Random terrain generation
  - Random mineral deposit placement
  - Random flora/fauna distribution

### Visibility & Discovery
- **Human Base**: Always visible to player
- **AI Base**: Must be discovered through exploration
- **Player-Built Structures**: Visible once constructed

### Effects
- **Energy**: Glowing particle systems with blue/white colors, simple geometric shapes
- **Shields**: Translucent dome overlays with hexagonal grid patterns, matching unit colors
- **Combat**: Simple muzzle flashes and impact sparks, low poly explosion effects
- **Mining**: Particle streams from minerals to workers, glowing extraction beams

---

*Continue visual brainstorming session...*
## Technical Implementation Notes

### Low Poly Design Benefits
- **Performance**: Optimized for web-based 3D rendering
- **Clarity**: Easy unit/building identification during gameplay
- **Development Speed**: Simple geometry reduces modeling time
- **Scalability**: Clean shapes work well at different zoom levels

### Babylon.js Considerations
- **Flat Shading**: Use flat shading for authentic low poly look
- **Minimal Textures**: Rely on vertex colors and simple materials
- **Efficient Geometry**: Keep polygon counts low for smooth performance
- **Particle Systems**: Use built-in particle systems for effects

### Color Coding Strategy
- **Units**: Primary colors (Red, Blue, Green) for instant recognition
- **Buildings**: Warm colors (Yellow, Orange) for infrastructure
- **Environment**: Natural earth tones for immersion
- **Resources**: Light blue for valuable minerals

---

## Dashboard Visualizations

### Simulation Gate Pipeline Visualization

A horizontal workflow diagram showing real-time data flowing through the simulation gate stages:

```
┌─────────────┐    ┌─────────────────────┐    ┌──────────────────────────┐    ┌──────────────┐    ┌──────────────┐
│ OBSERVATION │ ─► │ NN OUTPUT           │ ─► │ GATE COMPONENTS          │ ─► │ COMBINED     │ ─► │ DECISION     │
│             │    │                     │    │                          │    │              │    │              │
│ • Workers   │    │ • Chunk ID: 145     │    │ • Survival: 0.85         │    │ R_expected   │    │   ✓ SEND     │
│ • Protectors│    │ • Type: energy      │    │ • Disruption: 0.45       │    │   = 0.342    │    │   ✗ WAIT     │
│ • Parasites │    │ • Confidence: 0.72  │    │ • Location: -0.12        │    │              │    │              │
│ • Energy    │    │                     │    │ • Exploration: 0.05      │    │              │    │ Reason:      │
│ • Minerals  │    │                     │    │                          │    │              │    │ positive_rwrd│
└─────────────┘    └─────────────────────┘    └──────────────────────────┘    └──────────────┘    └──────────────┘
```

**Design Principles:**
- Horizontal flow from left to right (data pipeline metaphor)
- Each stage is a distinct box/card with clear boundaries
- Arrows/connectors between stages to show data flow
- Real-time values displayed inside each box
- Color coding for decision outcome:
  - Green border/highlight for SEND decisions
  - Red/orange border for WAIT decisions
- Components section shows individual contribution values
- Weights shown below formula in Combined section

**Color Scheme (matching existing dashboard):**
- Box backgrounds: `--bg-primary` (#1a1a2e)
- Box borders: `--accent` (#0f3460)
- SEND decision: `--success` (#00c853)
- WAIT decision: `--danger` (#ff5252)
- Arrow connectors: `--text-secondary` (#aaa)

---

**Visual design complete and ready for implementation!**