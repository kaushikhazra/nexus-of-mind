# Combat System Brainstorm - Environmental Threats

**Date**: January 7, 2026  
**Status**: Research phase for US-008 Environmental Combat System  
**Context**: Need enemies that try to take our energy (not protectors attacking workers)  
**Next Step**: Choose approach and implement for US-008  

## Problem Statement

We need a combat system where:
- Enemies try to **take our energy** (not friendly fire)
- Protectors have a **defensive purpose** (protect workers/bases)
- Combat uses **energy-based mechanics** with variable costs
- System is **scalable** (can evolve into full AI opponent later)

## Combat System Options

### Option 1: Energy Parasites (Environmental Threats) ⭐ RECOMMENDED
**What**: Hostile creatures that spawn near mineral deposits and attack workers

**Behavior**:
- Spawn periodically near mineral deposits (especially rich ones)
- Seek out and attack workers within range
- Drain energy from workers they reach (2 energy/second)
- Force workers to flee when energy gets low

**Combat Mechanics**:
- Protectors can attack parasites within 15 units
- Each attack costs 5 energy from protector
- Parasites require 3 hits to destroy
- Successful kill awards 2 energy back to protector

**Strategic Balance**:
- 1 protector can defend 2-3 workers effectively
- Net positive energy when defense is successful
- Mining efficiency reduced 25% when parasites present
- Stronger parasites (5 hits) spawn at rich deposits

**Advantages**:
- ✅ Simple to implement with existing systems
- ✅ Clear defensive purpose for protectors
- ✅ Energy drain creates real threat
- ✅ Scalable foundation for future AI opponents
- ✅ Immediate strategic gameplay

**Implementation Complexity**: Low-Medium

---

### Option 2: Energy Vampires (Roaming Threats)
**What**: Mobile creatures that hunt for any energy sources

**Behavior**:
- Spawn randomly across the map
- Hunt for workers, bases, and power plants
- More intelligent pathfinding and target selection
- Can attack multiple target types

**Combat Mechanics**:
- Variable energy costs based on target type
- Different vampire types with different abilities
- Can drain energy from buildings too

**Advantages**:
- More dynamic and unpredictable threats
- Forces broader defensive strategies
- More varied combat scenarios

**Disadvantages**:
- More complex AI and pathfinding required
- Harder to balance (multiple target types)
- May overwhelm players early game

**Implementation Complexity**: Medium-High

---

### Option 3: Rival AI Faction (Full Opponent)
**What**: Complete AI faction that competes for resources

**Behavior**:
- Builds own bases and units
- Mines resources competitively
- Full strategic AI opponent
- Attacks player bases and units

**Combat Mechanics**:
- Full unit vs unit combat
- Base vs base warfare
- Resource competition and theft
- Complex strategic interactions

**Advantages**:
- Complete RTS experience
- Maximum strategic depth
- Showcases AI learning capabilities
- Full competitive gameplay

**Disadvantages**:
- Very complex to implement
- Requires complete AI strategy system
- May be too overwhelming for initial implementation
- Doesn't fit current "environmental threat" scope

**Implementation Complexity**: Very High

---

### Option 4: Energy Storms (Environmental Events)
**What**: Periodic weather events that drain energy

**Behavior**:
- Predictable storm patterns
- Drain energy from exposed units/buildings
- Force players to seek shelter or use shields
- Area-of-effect energy drain

**Combat Mechanics**:
- No direct combat, more about positioning
- Shield systems become critical
- Timing-based strategic decisions

**Advantages**:
- Unique environmental mechanic
- Forces shield system usage
- Predictable but challenging

**Disadvantages**:
- Not really "combat" in traditional sense
- Less engaging than active threats
- Doesn't provide target for protectors

**Implementation Complexity**: Medium

## Recommendation: Energy Parasites

**Why Energy Parasites are perfect for US-008:**

1. **Immediate Implementation**: Can build on existing unit and energy systems
2. **Clear Enemy Role**: Parasites drain energy from workers (clear threat)
3. **Defensive Combat**: Protectors defend mining operations (clear purpose)
4. **Energy Integration**: All mechanics use existing energy framework
5. **Strategic Depth**: Risk/reward for mining operations, defensive positioning
6. **Scalable Foundation**: Can evolve into full AI faction later

**Implementation Plan**:
1. **Phase 1**: Basic parasite spawning near mineral deposits
2. **Phase 2**: Parasite AI (seek workers, drain energy)
3. **Phase 3**: Protector combat system (attack parasites)
4. **Phase 4**: Visual effects and UI feedback
5. **Phase 5**: Balance tuning and strategic depth

**Technical Requirements**:
- New `EnergyParasite` unit type (dark purple sphere)
- Spawning system tied to mineral deposits
- Energy drain mechanics for worker attacks
- Combat system for protector vs parasite
- Visual effects for combat and energy drain

## Future Evolution Path

**Phase 1**: Energy Parasites (US-008)
- Environmental threats that drain energy
- Basic defensive combat

**Phase 2**: Enhanced Parasites (US-009+)
- Different parasite types
- More complex behaviors
- Coordinated attacks

**Phase 3**: AI Faction (US-015+)
- Parasites evolve into AI-controlled units
- AI builds bases and competes for resources
- Full strategic opponent

This approach gives us immediate gameplay while building toward our ultimate AI opponent goal.

## Deep Dive: Energy Parasite Dynamics

### Core Behavior Questions

**What attracts parasites?**
- Option A: Pure mineral presence (spawn near any deposit)
- Option B: Active mining operations (spawn when workers are mining)
- Option C: Energy signatures (spawn near high-energy areas - bases, power plants)
- Option D: Combination (mineral deposits + active operations increase spawn rate)

**How do they move and hunt?**
- Option A: Simple beeline to nearest worker
- Option B: Pack hunting (coordinate with other parasites)
- Option C: Ambush behavior (hide near deposits, attack when workers approach)
- Option D: Territorial (claim an area around deposit, attack intruders)

**What happens when they feed?**
- Option A: Continuous drain while attached (2 energy/sec)
- Option B: Burst drain (take 20 energy instantly, then move to next target)
- Option C: Growing stronger (drain rate increases the longer they feed)
- Option D: Reproduction (well-fed parasites spawn new ones)

**How do they interact with each other?**
- Option A: Independent (each acts alone)
- Option B: Swarm behavior (group up for coordinated attacks)
- Option C: Hierarchical (alpha parasites command others)
- Option D: Competitive (fight each other for feeding rights)

### Proposed Parasite Dynamics

**Attraction System**: Combination approach
- Base spawn rate: 1 parasite per mineral deposit every 60-90 seconds
- Active mining multiplier: +100% spawn rate when workers present
- Energy signature bonus: +50% spawn rate near bases/power plants
- Rich deposits (>75% resources): Spawn stronger parasites

**Movement & Hunting**: Territorial Ambush
- Parasites "claim" a 15-unit radius around their spawn point
- Hide/patrol within territory until worker enters
- When worker detected: aggressive pursuit within territory
- If worker flees territory: return to patrol mode
- Multiple parasites in same area: loose coordination (attack same target)

**Feeding Mechanics**: Progressive Drain
- Initial contact: 1 energy/sec drain
- After 5 seconds attached: 2 energy/sec
- After 10 seconds attached: 3 energy/sec (parasite "grows")
- Worker forced to flee when energy < 20% (not 10 - gives more buffer)
- Parasite detaches if worker moves >5 units away

**Parasite Lifecycle**:
1. **Spawn**: Near mineral deposit, starts small and weak
2. **Hunt**: Patrol territory, seek workers
3. **Feed**: Attach to worker, drain energy progressively
4. **Grow**: Well-fed parasites become larger and stronger
5. **Reproduce**: After draining 100+ energy, spawn a second parasite
6. **Death**: Killed by protectors OR starve after 3 minutes without feeding

**Visual Evolution**:
- **Newborn**: Small dark purple sphere (0.5 unit radius)
- **Fed**: Medium purple sphere with energy glow (0.75 unit radius)
- **Mature**: Large purple sphere with pulsing energy (1.0 unit radius)
- **Alpha**: Extra large with energy tendrils (1.25 unit radius, spawns others)

### Strategic Implications

**Early Game** (1-2 parasites per deposit):
- Single protector can handle defense
- Workers can mine with minimal interruption
- Low energy cost for defense

**Mid Game** (2-4 parasites, some mature):
- Need multiple protectors or strategic positioning
- Mining efficiency significantly impacted
- Higher energy investment required for defense

**Late Game** (Alpha parasites spawning others):
- Parasites become self-sustaining threat
- May need to abandon some mining sites temporarily
- Forces strategic decisions about which deposits to defend

**Risk/Reward Scaling**:
- Rich deposits = more valuable but more dangerous
- Undefended sites become parasite breeding grounds
- Well-defended sites remain profitable
- Creates natural expansion pressure (find new, clean deposits)

### Combat Dynamics

**Protector vs Parasite**:
- Newborn parasites: 2 hits to kill (5 energy each = 10 total)
- Fed parasites: 3 hits to kill (15 energy total)
- Mature parasites: 4 hits to kill (20 energy total)
- Alpha parasites: 5 hits to kill (25 energy total)

**Energy Economics**:
- Killing newborn: 10 energy cost, 5 energy reward = -5 net
- Killing fed: 15 energy cost, 8 energy reward = -7 net
- Killing mature: 20 energy cost, 12 energy reward = -8 net
- Killing alpha: 25 energy cost, 20 energy reward = -5 net

**Why negative energy?** 
- Defense is a cost, not profit
- Profit comes from protected mining operations
- Creates strategic tension: defend vs abandon
- Encourages proactive defense (kill them young)

### Emergent Behaviors

**Parasite Pressure**: Undefended areas become increasingly dangerous
**Strategic Abandonment**: Sometimes better to find new deposits
**Defensive Positioning**: Protectors become area denial units
**Mining Efficiency**: Need to balance workers vs protectors
**Expansion Incentive**: Clean deposits are valuable, infected ones costly

## Decision

**Selected Approach**: Energy Parasites with Progressive Dynamics
**Rationale**: Creates evolving threat that scales with game progression
**Next Step**: Implement Phase 1 - Basic territorial parasites with simple feeding