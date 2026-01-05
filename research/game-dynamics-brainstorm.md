# Game Dynamics Brainstorm - Nexus of Mind

**Date**: January 5, 2026  
**Status**: Initial brainstorming session  
**Next Step**: Organize into formal game design document  

## Core Game Concept

### Setting & Theme
- **SciFi-based** real-time strategy game
- **Two factions** fighting for planetary resources
- **Human vs AI** control (player vs self-learning AI opponent)

## Resource System

### Energy Economy
- **Primary Resource**: Energy (measured in joules)
- **Source**: Radioactive minerals found on planet
- **Conversion Rate**: 1 gram mineral = 1 joule energy (fixed ratio)
- **Universal Currency**: Energy powers ALL game actions

### Energy Usage
Energy is consumed for:
- Exploration
- Mining operations
- Base building
- Unit construction
- Weapon firing
- All other game actions

*Note: This creates interesting strategic resource management decisions*

## Unit Types

### Three Core Unit Classes
1. **Workers**
   - Role: [Mining/building operations?]
   
2. **Protectors** 
   - Role: [Combat/defense units?]
   
3. **Scouts**
   - Role: [Exploration/reconnaissance?]

## Building Types

### Two Core Structures
1. **Base**
   - Role: [Command center/unit production?]
   
2. **Power Plants**
   - Role: [Mineral to energy conversion?]

---

## Design Notes

- Energy-centric economy creates tension and strategic depth
- Simple unit/building types keep complexity manageable for hackathon timeline
- Clear resource flow: Minerals → Energy → Everything else
- Perfect setup for AI learning (resource allocation decisions)

---

*Continue brainstorming session...*

## Combat & Victory Conditions

### Offensive Mechanics
- **Looting System**: Players can raid and steal from enemy faction
- **Targets for Looting**:
  - Enemy bases
  - Resource stockpiles
  - Energy reserves

### Victory/Defeat Conditions
- **Defeat Threshold**: When energy or resources drop below "recovery level"
- **Critical Resource Management**: Must maintain minimum viable economy
- **Economic Warfare**: Victory through resource denial rather than just destruction

*Note: This creates high-stakes resource protection and aggressive expansion strategies*

---

*Continue brainstorming session...*
## Energy & Resource Consumption System

### Construction Costs
- **Base Construction**: Requires resources (amount TBD)
- **Power Plant Construction**: Requires resources (amount TBD)
- **Unit Production**: Requires resources (amount TBD)

*Note: Need to balance construction costs for strategic depth*

### Energy Storage & Usage
- **Energy Reserves**: Both units and bases can store energy
- **Storage Capacity**: Variable by unit/building type (amounts TBD)
- **Energy Consumption Patterns**:
  - Units consume energy for work assignments
  - Bases consume energy for operations
  - Bases are energy-efficient compared to units

### Energy Management Strategy
- **Distributed Storage**: Energy can be stored across multiple units/buildings
- **Efficiency Hierarchy**: Bases > Units for energy efficiency
- **Work-Based Consumption**: Energy usage tied to active tasks

*Note: This creates interesting energy distribution and management decisions*

---

*Continue brainstorming session...*
### Resource Generation Process
- **Mineral Processing**: After extracting energy from radioactive minerals, the depleted material becomes "resources"
- **Dual Output**: Each mineral deposit provides both:
  1. **Energy** (1 joule per 1 gram mineral)
  2. **Resources** (depleted mineral material for construction)

*Note: This creates an elegant closed-loop economy - nothing is wasted!*

---

*Continue brainstorming session...*
## Starting Conditions

### Initial Unit Allocation
**Both Player and AI start with:**
- **10 Workers** (mining/construction force)
- **8 Scouts** (exploration units)
- **10 Protectors** (combat/defense units)

**Total Starting Army**: 28 units per faction

*Note: Balanced starting forces - slight emphasis on economy (workers) and defense (protectors) over exploration*

---

*Continue brainstorming session...*
### Initial Buildings & Energy
- **1 Base** (command center)
- **No Power Plants** (must be built)
- **Starting Energy Reserves**: TBD amount to power initial operations

*Note: Players must quickly establish power infrastructure to sustain operations*

---

*Continue brainstorming session...*
### Exploration & Resource Discovery
- **Mineral Node Visibility**: Some nodes may be visible at start, others hidden
- **Scouting Requirement**: Hidden mineral deposits must be discovered by scouts
- **Strategic Choice**: 
  - Rush to visible nodes (competitive risk)
  - Scout for hidden nodes (time investment, potential reward)

*Note: Creates tension between immediate action vs exploration investment*

---

*Continue brainstorming session...*
### Combat System
- **Protector Versatility**: Can attack any target type
- **Attack Targets**:
  - Enemy units (workers, scouts, other protectors)
  - Enemy bases
  - Enemy power plants
- **Variable Combat Costs**: Different targets require different:
  - Energy consumption per shot
  - Number of shots to destroy

*Note: Creates tactical decisions about target prioritization and energy management in combat*

---

*Continue brainstorming session...*
### Base Defense Systems
- **Base Reinforcement**: Bases can be upgraded for increased durability
- **Shield Technology**: Bases can generate protective shields
- **Shield Energy Cost**: Shield generation requires continuous energy consumption
- **Defense vs Economy Trade-off**: Energy spent on shields reduces available energy for other operations

*Note: Creates strategic tension between defense investment and economic growth*

---

*Continue brainstorming session...*
### Unit Upgrade System
- **Unit Enhancement**: All units can be upgraded for improved capabilities
- **Upgrade Categories**:
  - **Performance**: Better efficiency/speed for assigned tasks
  - **Shielding**: Personal energy shields for protection
  - **Firepower**: Enhanced combat abilities (for protectors)
- **Upgrade Investment**: Requires resources and/or energy

*Note: Creates progression system and specialization choices for unit development*

---

*Continue brainstorming session...*